# Freezr

A self-hosted freezer inventory management system designed to run on a Raspberry Pi. Check items in and out, track what's in which drawer, and print QR-code labels on a Brother QL printer — all from a mobile-friendly web interface on your local network.

## Features

- **Inventory management** — check items in and out, move between freezers and drawers, add notes and quantities
- **Three-level categories** — Category → Subcategory → Type (e.g. Meat → Chicken → Breast)
- **QR label printing** — generates and sends labels directly to a Brother QL printer over USB
- **Date backdating** — optionally set a custom date when checking in existing stock
- **Mobile-first UI** — designed to be used on a phone in the kitchen
- **QR code scanning** — scan a label to pull up an item instantly

## Hardware

- Raspberry Pi (any model; Zero W supported with reduced workers)
- Brother QL-600 or compatible label printer with 62mm continuous tape (DK-22205)
- SD card (8GB+)

## Raspberry Pi Deployment

The `make-sd.sh` script flashes a Pi OS image and configures WiFi, SSH, and the Freezr service. Run it on a Linux host with `qemu-user-static` installed.

```bash
sudo ./make-sd.sh [OPTIONS] <image.img.xz> <sd-device>
```

### Options

| Flag | Description |
|------|-------------|
| `--bake` | Pre-install everything in a QEMU chroot — Pi boots straight to a running Freezr service |
| `--hostname NAME` | Set the Pi hostname (default: `freezr`) |
| `--ssh-user NAME` | System/SSH username (default: `pi`) |
| `--ssh-pass PASS` | System/SSH password (default: `raspberry` — change this!) |
| `--ip ADDR` | Static IP address, e.g. `192.168.1.50` or `192.168.1.50/24` (default: DHCP) |
| `--gateway ADDR` | Default gateway for static IP (default: `x.x.x.1` of `--ip` address) |
| `--ssid NAME` | WiFi network name |
| `--pass PASS` | WiFi password (required when `--ssid` is set) |

### Examples

```bash
# Basic flash (first-boot installs Freezr automatically)
sudo ./make-sd.sh --ssid "MyNetwork" --pass "mypassword" \
    2024-11-19-raspios-bookworm-arm64.img.xz /dev/sdb

# Pre-baked image with static IP — instant first boot, known address
sudo ./make-sd.sh --bake --hostname freezr \
    --ssh-user pi --ssh-pass secret \
    --ip 192.168.1.50 --gateway 192.168.1.1 --ssid "MyNetwork" --pass "mypassword" \
    2024-11-19-raspios-bookworm-arm64.img.xz /dev/sdb
```

The script detects the Pi OS version automatically and uses the correct headless configuration method (cloud-init for newer images, firstboot for older ones).

### Requirements

```bash
# Fedora / RHEL
sudo dnf install qemu-user-static

# Debian / Ubuntu
sudo apt-get install qemu-user-static
```

## Manual Setup

To run Freezr on an existing machine (not via `make-sd.sh`):

```bash
git clone https://github.com/je-marshall/freezr.git
cd freezr
python3 -m venv venv
venv/bin/pip install -e .
sudo apt-get install -y fonts-liberation  # for label printing
FLASK_APP=freezr venv/bin/flask init-db
FLASK_APP=freezr venv/bin/gunicorn -w 2 -b 0.0.0.0:8000 'freezr:create_app()'
```

The web interface is then available at `http://<hostname>:8000`.

## Admin

The `freezr-admin.sh` helper script wraps common admin tasks:

```bash
# Wipe and reinitialise the database (prompts for confirmation)
./freezr-admin.sh init-db

# Generate a new random password
./freezr-admin.sh reset-password

# Set a specific password
./freezr-admin.sh reset-password mysecretpassword
```

## Printer Setup

1. Go to **Manage** in the web interface
2. Set **Printer Model** to `QL-700` (works for QL-600 hardware)
3. Set **Label Size** to `62 (Continuous)` for a 62mm continuous tape roll, or `62x29 (Standard)` for die-cut labels
4. Set **Printer Identifier** to `usb://0x04f9:0x20c0` (standard for QL-600/700 over USB)
5. Ensure the `pi` user is in the `lp` and `plugdev` groups (done automatically by the install scripts)

Labels are printed directly from the item view — no driver installation needed on the Pi.

## Categories

The default category tree covers common freezer contents including British and French food. Categories, subcategories, and types are fully editable from the **Manage** page. The three-level structure generates the item description shown on labels (e.g. *Sausage toulouse*, *Cheese comté*).

## Development

```bash
git clone https://github.com/je-marshall/freezr.git
cd freezr
python3 -m venv venv
venv/bin/pip install -e .
FLASK_APP=freezr FLASK_DEBUG=1 venv/bin/flask run
```

On the Pi, after making changes:

```bash
cd ~/freezr && git pull && sudo systemctl restart freezr
```
