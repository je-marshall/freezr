#!/bin/bash
# make-sd.sh — Prepares a Raspberry Pi SD card with Freezr pre-configured.
#
# Usage: sudo ./make-sd.sh <image.img> <device> [--ssid <name> --pass <password>]
#   e.g. sudo ./make-sd.sh raspios-lite.img /dev/sdb
#        sudo ./make-sd.sh raspios-lite.img /dev/sdb --ssid MyWifi --pass secret123
#
# Accepts .img, .img.xz, or .tar.xz (as downloaded from raspberrypi.com).
#
# On first boot the Pi will:
#   1. Connect to WiFi (if --ssid provided), or use ethernet
#   2. Install dependencies via apt
#   3. Set up the venv and install Freezr
#   4. Initialise the database (password written to /home/pi/freezr-setup.log)
#   5. Start the freezr systemd service on port 8000
# First boot takes ~5 minutes. After that Freezr is available at http://<pi-ip>:8000

set -e

APP_DIR=$(cd "$(dirname "$0")" && pwd)

usage() {
    cat << EOF
Usage: sudo $0 <image> <device> [options]

Arguments:
  <image>     Pi OS image file (.img, .img.xz, or .tar.xz)
  <device>    SD card block device (e.g. /dev/sdb, /dev/mmcblk0)

Options:
  --hostname  Hostname for the Pi (default: freezr, accessible as freezr.local)
  --ssid      WiFi network name
  --pass      WiFi password (required if --ssid is set)
  -h, --help  Show this help

Examples:
  sudo $0 raspios-bookworm-arm64-lite.img.xz /dev/sdb                        # Pi 3/4/5
  sudo $0 raspios-bookworm-armhf-lite.img.xz /dev/sdb --ssid MyWifi --pass x  # Pi Zero W (ARMv6)

Note: Pi Zero / Zero W requires the 32-bit armhf image (Bookworm or earlier).
      Trixie (2025+) has dropped ARMv6 support. First boot on a Zero W takes
      ~20-30 mins as some Python packages compile from source.
EOF
}

POSITIONAL=()
WIFI_SSID=""
WIFI_PASS=""
HOSTNAME="freezr"

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)     usage; exit 0 ;;
        --hostname)    HOSTNAME="$2"; shift 2 ;;
        --ssid)        WIFI_SSID="$2"; shift 2 ;;
        --pass)        WIFI_PASS="$2"; shift 2 ;;
        -*)            echo "Unknown option: $1"; echo; usage; exit 1 ;;
        *)             POSITIONAL+=("$1"); shift ;;
    esac
done

IMAGE=${POSITIONAL[0]:-}
DEVICE=${POSITIONAL[1]:-}

if [ -z "$IMAGE" ] || [ -z "$DEVICE" ]; then
    usage; exit 1
fi

if [ -n "$WIFI_SSID" ] && [ -z "$WIFI_PASS" ]; then
    echo "Error: --pass is required when --ssid is set."
    exit 1
fi

if [ ! -f "$IMAGE" ]; then
    echo "Error: image file '$IMAGE' not found."
    exit 1
fi

if [ ! -b "$DEVICE" ]; then
    echo "Error: '$DEVICE' is not a block device."
    exit 1
fi

# Warn but don't bail on common system drive names — SD card adapters often show up as sda
if echo "$DEVICE" | grep -qE '^/dev/(sda|nvme0n1|mmcblk0)$'; then
    echo "Warning: '$DEVICE' is a name commonly used by system drives."
    read -p "    Are you sure this is your SD card and not your system disk? [y/N] " syscheck
    [ "$syscheck" = "y" ] || { echo "Aborted."; exit 1; }
fi

echo "==> Flashing $IMAGE to $DEVICE (this will erase $DEVICE)..."
[ -n "$WIFI_SSID" ] && echo "    WiFi: $WIFI_SSID"
read -p "    Are you sure? [y/N] " confirm
[ "$confirm" = "y" ] || { echo "Aborted."; exit 1; }

case "$IMAGE" in
    *.tar.xz)
        echo "    (extracting .tar.xz on the fly)"
        tar xJOf "$IMAGE" '*.img' | dd of="$DEVICE" bs=4M status=progress conv=fsync
        ;;
    *.xz)
        echo "    (decompressing .xz on the fly)"
        xz -dc "$IMAGE" | dd of="$DEVICE" bs=4M status=progress conv=fsync
        ;;
    *)
        dd if="$IMAGE" of="$DEVICE" bs=4M status=progress conv=fsync
        ;;
esac
sync

# Determine partition naming (e.g. /dev/sdb1 vs /dev/mmcblk1p1)
if echo "$DEVICE" | grep -q "mmcblk\|nvme"; then
    PART1="${DEVICE}p1"
    PART2="${DEVICE}p2"
else
    PART1="${DEVICE}1"
    PART2="${DEVICE}2"
fi

# Wait for kernel to re-read partition table
sleep 2
partprobe "$DEVICE" 2>/dev/null || true
sleep 1

BOOT_MNT=$(mktemp -d)
ROOT_MNT=$(mktemp -d)

cleanup() {
    umount "$BOOT_MNT" 2>/dev/null || true
    umount "$ROOT_MNT" 2>/dev/null || true
    rmdir "$BOOT_MNT" "$ROOT_MNT" 2>/dev/null || true
}
trap cleanup EXIT

echo "==> Mounting partitions..."
mount "$PART1" "$BOOT_MNT"
mount "$PART2" "$ROOT_MNT"

echo "==> Enabling SSH..."
touch "$BOOT_MNT/ssh"

echo "==> Setting hostname to '$HOSTNAME'..."
echo "$HOSTNAME" > "$ROOT_MNT/etc/hostname"
sed -i "s/raspberrypi/$HOSTNAME/g" "$ROOT_MNT/etc/hosts"

# Configure WiFi — written directly into the image so it's live before firstrun.
# Writes both NetworkManager keyfile (Pi OS Bookworm) and wpa_supplicant.conf
# (Pi OS Bullseye and earlier) for compatibility.
if [ -n "$WIFI_SSID" ]; then
    echo "==> Configuring WiFi ($WIFI_SSID)..."

    # NetworkManager keyfile (Bookworm)
    NM_DIR="$ROOT_MNT/etc/NetworkManager/system-connections"
    mkdir -p "$NM_DIR"
    cat > "$NM_DIR/${WIFI_SSID}.nmconnection" << EOF
[connection]
id=${WIFI_SSID}
type=wifi
autoconnect=true

[wifi]
mode=infrastructure
ssid=${WIFI_SSID}

[wifi-security]
auth-alg=open
key-mgmt=wpa-psk
psk=${WIFI_PASS}

[ipv4]
method=auto

[ipv6]
addr-gen-mode=default
method=auto
EOF
    chmod 600 "$NM_DIR/${WIFI_SSID}.nmconnection"

    # wpa_supplicant.conf on boot partition (Bullseye and earlier)
    cat > "$BOOT_MNT/wpa_supplicant.conf" << EOF
country=GB
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1

network={
    ssid="${WIFI_SSID}"
    psk="${WIFI_PASS}"
}
EOF
fi

echo "==> Copying Freezr application..."
mkdir -p "$ROOT_MNT/home/pi/freezr"
rsync -a --exclude='venv' --exclude='instance' --exclude='__pycache__' \
    --exclude='*.pyc' --exclude='.git' \
    "$APP_DIR/" "$ROOT_MNT/home/pi/freezr/"
chown -R 1000:1000 "$ROOT_MNT/home/pi/freezr"

echo "==> Writing first-boot setup script and service..."

# Write the setup script to the rootfs
cat > "$ROOT_MNT/opt/freezr-setup.sh" << 'SETUP'
#!/bin/bash
set -e

apt-get update -y
apt-get install -y \
    python3-venv python3-dev python3-pip \
    gcc git sqlite3 \
    libusb-1.0-0-dev libjpeg-dev zlib1g-dev libfreetype6-dev

usermod -a -G lp,plugdev pi

cd /home/pi/freezr
sudo -u pi python3 -m venv venv
sudo -u pi venv/bin/pip install --upgrade pip wheel
sudo -u pi venv/bin/pip install -e .

export FLASK_APP=freezr
sudo -u pi venv/bin/flask init-db

sed -e "s|__USER__|pi|g" \
    -e "s|__APP_DIR__|/home/pi/freezr|g" \
    -e "s|__VENV_DIR__|/home/pi/freezr/venv|g" \
    /home/pi/freezr/freezr.service > /etc/systemd/system/freezr.service

systemctl daemon-reload
systemctl enable freezr
systemctl start freezr || true

systemctl disable freezr-setup.service
rm -f /opt/freezr-setup.sh

echo "=== Freezr setup complete. ==="
SETUP

chmod +x "$ROOT_MNT/opt/freezr-setup.sh"

# Write a systemd service that runs the script once on first boot
cat > "$ROOT_MNT/etc/systemd/system/freezr-setup.service" << 'SERVICE'
[Unit]
Description=Freezr First Boot Setup
After=network-online.target
Wants=network-online.target
ConditionPathExists=/opt/freezr-setup.sh

[Service]
Type=oneshot
ExecStart=/bin/bash /opt/freezr-setup.sh
StandardOutput=append:/home/pi/freezr-setup.log
StandardError=append:/home/pi/freezr-setup.log
TimeoutStartSec=1800

[Install]
WantedBy=multi-user.target
SERVICE

# Enable the service
mkdir -p "$ROOT_MNT/etc/systemd/system/multi-user.target.wants"
ln -sf /etc/systemd/system/freezr-setup.service \
    "$ROOT_MNT/etc/systemd/system/multi-user.target.wants/freezr-setup.service"

echo "==> Done!"
echo ""
echo "    Insert the SD card into your Pi and power it on."
echo "    First boot will take ~5 minutes to install everything."
echo "    The login password will be written to /home/pi/freezr-setup.log on the Pi."
echo "    Freezr will be available at http://${HOSTNAME}.local:8000"
