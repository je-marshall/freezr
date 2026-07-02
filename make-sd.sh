#!/bin/bash
# make-sd.sh — Prepares a Raspberry Pi SD card with Freezr pre-configured.
#
# Usage: sudo ./make-sd.sh <image.img> <device> [options]
# Run with -h for full help.

set -e

APP_DIR=$(cd "$(dirname "$0")" && pwd)

# ── Colour helpers ────────────────────────────────────────────────────────────
BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

header() { echo -e "\n${BOLD}${CYAN}▶ $1${RESET}"; }
step()   { echo -e "  ${GREEN}✓${RESET} $1"; }
info()   { echo -e "  ${DIM}$1${RESET}"; }
warn()   { echo -e "  ${YELLOW}⚠ $1${RESET}"; }
err()    { echo -e "\n  ${RED}✗ $1${RESET}\n"; }

# ── Usage ─────────────────────────────────────────────────────────────────────
usage() {
    cat << EOF

${BOLD}make-sd.sh${RESET} — Flash a Raspberry Pi SD card with Freezr pre-installed

${BOLD}USAGE${RESET}
  sudo $0 <image> <device> [options]

${BOLD}ARGUMENTS${RESET}
  <image>     Pi OS image file (.img, .img.xz, or .tar.xz)
  <device>    SD card block device (e.g. /dev/sdb, /dev/mmcblk0)

${BOLD}OPTIONS${RESET}
  --hostname  Hostname for the Pi          (default: freezr → freezr.local)
  --pi-pass   Password for the pi user     (default: raspberry — change this!)
  --ssid      WiFi network name
  --pass      WiFi password                (required if --ssid is set)
  --bake      Install Freezr now via QEMU chroot — first boot goes straight
              to a running service with no wait. Requires qemu-user-static:
                sudo dnf install qemu-user-static
  -h, --help  Show this help

${BOLD}EXAMPLES${RESET}
  sudo $0 raspios-bookworm-arm64-lite.img.xz /dev/sdb
  sudo $0 raspios-bookworm-armhf-lite.img.xz /dev/sdb --ssid MyWifi --pass x --bake

${BOLD}NOTE${RESET}
  Pi Zero / Zero W requires the 32-bit armhf image (Bookworm or earlier).
  Trixie (2025+) dropped ARMv6. Use --bake to avoid the 20-30 min first-boot
  compile wait on the Zero W.

EOF
}

# ── Argument parsing ───────────────────────────────────────────────────────────
POSITIONAL=()
WIFI_SSID=""
WIFI_PASS=""
HOSTNAME="freezr"
PI_PASS="raspberry"
BAKE=0

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)     usage; exit 0 ;;
        --hostname)    HOSTNAME="$2"; shift 2 ;;
        --pi-pass)     PI_PASS="$2"; shift 2 ;;
        --ssid)        WIFI_SSID="$2"; shift 2 ;;
        --pass)        WIFI_PASS="$2"; shift 2 ;;
        --bake)        BAKE=1; shift ;;
        -*)            err "Unknown option: $1"; usage; exit 1 ;;
        *)             POSITIONAL+=("$1"); shift ;;
    esac
done

IMAGE=${POSITIONAL[0]:-}
DEVICE=${POSITIONAL[1]:-}

# ── Validation ────────────────────────────────────────────────────────────────
if [ -z "$IMAGE" ] || [ -z "$DEVICE" ]; then
    usage; exit 1
fi

if [ -n "$WIFI_SSID" ] && [ -z "$WIFI_PASS" ]; then
    err "--pass is required when --ssid is set."; exit 1
fi

if [ ! -f "$IMAGE" ]; then
    err "Image file '$IMAGE' not found."; exit 1
fi

if [ ! -b "$DEVICE" ]; then
    err "'$DEVICE' is not a block device."; exit 1
fi

if [ "$BAKE" = "1" ]; then
    if ! command -v qemu-arm-static &>/dev/null && ! command -v qemu-aarch64-static &>/dev/null; then
        err "--bake requires qemu-user-static.\n    sudo dnf install qemu-user-static"
        exit 1
    fi
fi

# ── Plan summary ──────────────────────────────────────────────────────────────
echo -e "\n${BOLD}┌─────────────────────────────────────────┐${RESET}"
echo -e "${BOLD}│           Freezr SD Card Setup          │${RESET}"
echo -e "${BOLD}└─────────────────────────────────────────┘${RESET}"
echo -e "  Image    : ${DIM}$(basename "$IMAGE")${RESET}"
echo -e "  Device   : ${DIM}$DEVICE${RESET}"
echo -e "  Hostname : ${DIM}${HOSTNAME}.local${RESET}"
[ -n "$WIFI_SSID" ] && echo -e "  WiFi     : ${DIM}$WIFI_SSID${RESET}"
[ "$BAKE" = "1" ]   && echo -e "  Mode     : ${DIM}bake (QEMU chroot install)${RESET}" \
                     || echo -e "  Mode     : ${DIM}first-boot install${RESET}"

if echo "$DEVICE" | grep -qE '^/dev/(sda|nvme0n1|mmcblk0)$'; then
    echo ""
    warn "'$DEVICE' is a name commonly used by system drives."
    read -p "    Sure this is your SD card? [y/N] " syscheck
    [ "$syscheck" = "y" ] || { echo "Aborted."; exit 1; }
fi

echo ""
read -p "  This will ERASE $DEVICE. Continue? [y/N] " confirm
[ "$confirm" = "y" ] || { echo "Aborted."; exit 1; }

# ── Prepare working image on local fast storage ───────────────────────────────
# All heavy work (chroot compile, rsync) happens against a local .img file,
# then we dd just the used portion to the SD card. The first-boot process
# (cloud-init or firstboot) expands the root partition to fill the card,
# which is a fast metadata-only operation.
header "Preparing working image"

SD_SIZE=$(blockdev --getsize64 "$DEVICE")
SD_SIZE_H=$(numfmt --to=iec "$SD_SIZE")

WORK_IMG=$(mktemp -p /var/tmp --suffix=.img)
info "Decompressing to /var/tmp (fast local storage)..."
case "$IMAGE" in
    *.tar.xz) tar xJOf "$IMAGE" '*.img' > "$WORK_IMG" ;;
    *.xz)     xz -dc "$IMAGE" > "$WORK_IMG" ;;
    *)        cp "$IMAGE" "$WORK_IMG" ;;
esac

IMG_SIZE=$(stat -c%s "$WORK_IMG")
if [ "$IMG_SIZE" -gt "$SD_SIZE" ]; then
    err "Image ($(numfmt --to=iec "$IMG_SIZE")) is larger than SD card ($SD_SIZE_H). Use a bigger card."
    exit 1
fi

if [ "$BAKE" = "1" ]; then
    # Expand the image by 2 GB to give the chroot room for packages.
    # Check the expanded size still fits on the card.
    BAKE_SIZE=$((IMG_SIZE + 2*1024*1024*1024))
    if [ "$BAKE_SIZE" -gt "$SD_SIZE" ]; then
        err "Image + 2 GB for bake ($(numfmt --to=iec "$BAKE_SIZE")) won't fit on card ($SD_SIZE_H)."
        exit 1
    fi
    info "Expanding image by 2 GB for chroot packages..."
    truncate -s +2G "$WORK_IMG"
    parted -s "$WORK_IMG" resizepart 2 100%
    step "Working image ready ($(numfmt --to=iec "$IMG_SIZE") + 2 GB)"
else
    step "Working image ready ($(numfmt --to=iec "$IMG_SIZE"))"
fi

# Attach image as a loop device with partition scanning
LOOP=$(losetup -f --show --partscan "$WORK_IMG")
PART1="${LOOP}p1"
PART2="${LOOP}p2"
sleep 1   # give the kernel a moment to create the partition devices

if [ "$BAKE" = "1" ]; then
    e2fsck -f "$PART2" || true
    resize2fs "$PART2"
    step "Attached as $LOOP, root filesystem expanded for bake"
else
    step "Attached as $LOOP"
fi

# ── Mounts and cleanup ────────────────────────────────────────────────────────
BOOT_MNT=$(mktemp -d)
ROOT_MNT=$(mktemp -d)

cleanup() {
    umount "$ROOT_MNT/tmp"     2>/dev/null || true
    umount "$ROOT_MNT/dev/pts" 2>/dev/null || true
    umount "$ROOT_MNT/dev"     2>/dev/null || true
    umount "$ROOT_MNT/sys"     2>/dev/null || true
    umount "$ROOT_MNT/proc"    2>/dev/null || true
    rm -f "$ROOT_MNT/usr/bin/qemu-arm-static" "$ROOT_MNT/usr/bin/qemu-aarch64-static"
    [ -f "$ROOT_MNT/etc/resolv.conf.bak" ] && \
        mv "$ROOT_MNT/etc/resolv.conf.bak" "$ROOT_MNT/etc/resolv.conf"
    umount "$BOOT_MNT" 2>/dev/null || true
    umount "$ROOT_MNT" 2>/dev/null || true
    rmdir "$BOOT_MNT" "$ROOT_MNT" 2>/dev/null || true
    losetup -d "$LOOP" 2>/dev/null || true
    rm -f "$WORK_IMG"
}
trap cleanup EXIT

header "Mounting partitions"
mount "$PART1" "$BOOT_MNT"
mount "$PART2" "$ROOT_MNT"
step "Boot: $PART1  Root: $PART2"

# ── Headless config ───────────────────────────────────────────────────────────
header "Writing headless configuration"

# Pi OS has two different headless config mechanisms depending on the version:
#   - Newer images (Trixie / late Bookworm): cloud-init reads user-data,
#     network-config, and meta-data from the boot partition (NoCloud datasource)
#   - Older images (Bookworm): firstboot binary processes custom.toml; we must
#     add init=firstboot to cmdline.txt to trigger it
if [ ! -f "$ROOT_MNT/usr/lib/raspberrypi-sys-mods/firstboot" ] && \
   [ -f "$BOOT_MNT/user-data" ]; then

    info "Detected cloud-init Pi OS — writing user-data + network-config"

    # user-data: hostname, user, SSH, locale
    cat > "$BOOT_MNT/user-data" << EOF
#cloud-config
hostname: ${HOSTNAME}
manage_etc_hosts: true
timezone: Europe/London
keyboard:
  layout: gb

users:
  - name: pi
    gecos: Pi User
    groups: [adm, dialout, cdrom, sudo, audio, video, plugdev, games, users,
             input, netdev, spi, i2c, gpio, lp]
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    lock_passwd: false
    plain_text_passwd: "${PI_PASS}"

ssh_pwauth: true

runcmd:
  - [ systemctl, enable, --now, ssh ]
EOF

    # network-config: netplan format; cloud-init applies this before NM starts,
    # so the regulatory-domain is set correctly and rfkill doesn't block WiFi
    if [ -n "$WIFI_SSID" ]; then
        cat > "$BOOT_MNT/network-config" << EOF
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: true
      optional: true
  wifis:
    wlan0:
      dhcp4: true
      optional: true
      regulatory-domain: GB
      access-points:
        "${WIFI_SSID}":
          password: "${WIFI_PASS}"
EOF
    else
        cat > "$BOOT_MNT/network-config" << EOF
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: true
      optional: true
EOF
    fi

    # Changing instance_id ensures cloud-init treats this as a fresh instance
    # and re-runs even if the card was previously used
    cat > "$BOOT_MNT/meta-data" << EOF
instance_id: freezr-$(date +%s)
dsmode: local
EOF

    step "cloud-init files written (hostname, user, SSH$([ -n "$WIFI_SSID" ] && echo ", WiFi"))"

else

    info "Detected firstboot Pi OS — writing custom.toml"

    WIFI_SECTION=""
    if [ -n "$WIFI_SSID" ]; then
        WIFI_SECTION="
[wlan]
ssid = \"${WIFI_SSID}\"
password = \"${WIFI_PASS}\"
password_encrypted = false
hidden = false
country = \"GB\""
    fi

    cat > "$BOOT_MNT/custom.toml" << EOF
config_version = 1

[system]
hostname = "${HOSTNAME}"

[user]
name = "pi"
password = "${PI_PASS}"
password_encrypted = false

[ssh]
enabled = true
password_authentication = true
${WIFI_SECTION}

[locale]
keymap = "gb"
timezone = "Europe/London"
EOF

    CMDLINE=$(cat "$BOOT_MNT/cmdline.txt")
    if ! echo "$CMDLINE" | grep -q "init=/usr/lib/raspberrypi-sys-mods/firstboot"; then
        echo "$CMDLINE init=/usr/lib/raspberrypi-sys-mods/firstboot" > "$BOOT_MNT/cmdline.txt"
    fi

    step "custom.toml + cmdline.txt written (hostname, user, SSH$([ -n "$WIFI_SSID" ] && echo ", WiFi"))"

fi

# sshswitch.service enables SSH when this file is present on the boot partition
touch "$BOOT_MNT/ssh"

# ── Bake or first-boot ────────────────────────────────────────────────────────
if [ "$BAKE" = "1" ]; then

    header "Detecting image architecture"
    ELF_MACHINE=$(od -An -tx1 -j18 -N2 "$ROOT_MNT/bin/ls" 2>/dev/null | tr -d ' \n' || true)
    case "$ELF_MACHINE" in
        2800)
            QEMU_BIN=$(command -v qemu-arm-static 2>/dev/null || true)
            QEMU_DEST="$ROOT_MNT/usr/bin/qemu-arm-static"
            BINFMT_ENTRY="/proc/sys/fs/binfmt_misc/qemu-arm"
            ARCH_NAME="ARMv6/7 (armhf)"
            ;;
        b700)
            QEMU_BIN=$(command -v qemu-aarch64-static 2>/dev/null || true)
            QEMU_DEST="$ROOT_MNT/usr/bin/qemu-aarch64-static"
            BINFMT_ENTRY="/proc/sys/fs/binfmt_misc/qemu-aarch64"
            ARCH_NAME="AArch64 (arm64)"
            ;;
        *)
            err "Could not detect rootfs architecture (ELF machine: $ELF_MACHINE)."
            exit 1
            ;;
    esac
    if [ -z "$QEMU_BIN" ]; then
        err "Required QEMU binary not found for $ARCH_NAME.\n    sudo dnf install qemu-user-static"
        exit 1
    fi
    if [ ! -f "$BINFMT_ENTRY" ]; then
        err "binfmt_misc handler not registered for $ARCH_NAME.\n    sudo systemctl restart systemd-binfmt"
        exit 1
    fi
    step "Detected $ARCH_NAME → $(basename "$QEMU_BIN")"

    header "Setting up QEMU chroot"
    cp "$QEMU_BIN" "$QEMU_DEST"
    cp /etc/resolv.conf "$ROOT_MNT/etc/resolv.conf.bak" 2>/dev/null || true
    cp /etc/resolv.conf "$ROOT_MNT/etc/resolv.conf"
    mount --bind /proc       "$ROOT_MNT/proc"
    mount --bind /sys        "$ROOT_MNT/sys"
    mount --bind /dev        "$ROOT_MNT/dev"
    mount --bind /dev/pts    "$ROOT_MNT/dev/pts"
    mount -t tmpfs tmpfs     "$ROOT_MNT/tmp"
    step "Bind mounts ready"

    header "Installing Freezr (chroot) — this will take a few minutes"
    info "Note the Freezr password printed below."
    echo ""
    chroot "$ROOT_MNT" /bin/bash << 'CHROOT'
set -e
export DEBIAN_FRONTEND=noninteractive
export FLASK_APP=freezr

apt-get update -y
apt-get install -y \
    python3-venv python3-dev python3-pip \
    gcc git sqlite3 \
    libusb-1.0-0-dev libjpeg-dev zlib1g-dev libfreetype6-dev fonts-liberation

usermod -a -G lp,plugdev pi

git clone https://github.com/je-marshall/freezr.git /home/pi/freezr
cd /home/pi/freezr
python3 -m venv venv
venv/bin/pip install --upgrade pip wheel
venv/bin/pip install -e .
venv/bin/flask init-db

chown -R 1000:1000 /home/pi/freezr
CHROOT
    echo ""

    header "Enabling Freezr service"
    sed -e "s|__USER__|pi|g" \
        -e "s|__APP_DIR__|/home/pi/freezr|g" \
        -e "s|__VENV_DIR__|/home/pi/freezr/venv|g" \
        "$ROOT_MNT/home/pi/freezr/freezr.service" > "$ROOT_MNT/etc/systemd/system/freezr.service"
    mkdir -p "$ROOT_MNT/etc/systemd/system/multi-user.target.wants"
    ln -sf /etc/systemd/system/freezr.service \
        "$ROOT_MNT/etc/systemd/system/multi-user.target.wants/freezr.service"
    step "freezr.service enabled"

else

    header "Writing first-boot installer"

    cat > "$ROOT_MNT/opt/freezr-setup.sh" << 'SETUP'
#!/bin/bash
set -e

apt-get update -y
apt-get install -y \
    python3-venv python3-dev python3-pip \
    gcc git sqlite3 \
    libusb-1.0-0-dev libjpeg-dev zlib1g-dev libfreetype6-dev fonts-liberation

usermod -a -G lp,plugdev pi

git clone https://github.com/je-marshall/freezr.git /home/pi/freezr
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

    mkdir -p "$ROOT_MNT/etc/systemd/system/multi-user.target.wants"
    ln -sf /etc/systemd/system/freezr-setup.service \
        "$ROOT_MNT/etc/systemd/system/multi-user.target.wants/freezr-setup.service"
    step "First-boot service installed"

fi

# ── Write to SD card ──────────────────────────────────────────────────────────
# Tear down mounts and loop device, then dd the finished image to the SD card
# in a single sequential pass — much faster than random writes to the card.
header "Writing finished image to SD card"
umount "$ROOT_MNT/tmp"     2>/dev/null || true
umount "$ROOT_MNT/dev/pts" 2>/dev/null || true
umount "$ROOT_MNT/dev"     2>/dev/null || true
umount "$ROOT_MNT/sys"     2>/dev/null || true
umount "$ROOT_MNT/proc"    2>/dev/null || true
rm -f "$ROOT_MNT/usr/bin/qemu-arm-static" "$ROOT_MNT/usr/bin/qemu-aarch64-static"
[ -f "$ROOT_MNT/etc/resolv.conf.bak" ] && \
    mv "$ROOT_MNT/etc/resolv.conf.bak" "$ROOT_MNT/etc/resolv.conf"
umount "$BOOT_MNT"
umount "$ROOT_MNT"
rmdir "$BOOT_MNT" "$ROOT_MNT"
losetup -d "$LOOP"

dd if="$WORK_IMG" of="$DEVICE" bs=4M status=progress conv=fsync
sync
rm -f "$WORK_IMG"

echo -e "\n${BOLD}${GREEN}┌─────────────────────────────────────────┐${RESET}"
echo -e "${BOLD}${GREEN}│               All done!                 │${RESET}"
echo -e "${BOLD}${GREEN}└─────────────────────────────────────────┘${RESET}"
if [ "$BAKE" = "1" ]; then
    echo -e "  Eject the SD card and insert it into your Pi."
    echo -e "  Freezr will be up at ${BOLD}http://${HOSTNAME}.local:8000${RESET} once it has booted."
else
    echo -e "  Eject the SD card and insert it into your Pi."
    echo -e "  First boot will take ${BOLD}5-25 minutes${RESET} to install (longer on a Zero W)."
    echo -e "  The Freezr password will be in ${BOLD}/home/pi/freezr-setup.log${RESET} on the Pi."
    echo -e "  Freezr will be up at ${BOLD}http://${HOSTNAME}.local:8000${RESET} after that."
fi
echo ""
