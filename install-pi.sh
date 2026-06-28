#!/bin/bash
set -e

echo "========================================"
echo "    Starting Freezr Installation...     "
echo "    (Raspberry Pi OS / Debian Edition)  "
echo "========================================"

APP_DIR=$(pwd)
VENV_DIR="$APP_DIR/venv"
CURRENT_USER=$(whoami)

echo "[1/5] Installing system prerequisites..."
sudo apt-get update -y
sudo apt-get install -y \
    python3 python3-pip python3-venv python3-dev \
    gcc git sqlite3 \
    libusb-1.0-0-dev libjpeg-dev zlib1g-dev libfreetype6-dev

# Allow the running user to access USB devices (Brother printer)
sudo usermod -a -G lp,plugdev "$CURRENT_USER"

echo "[2/5] Creating Python virtual environment..."
python3 -m venv "$VENV_DIR"

echo "[3/5] Installing Freezr and dependencies..."
"$VENV_DIR/bin/pip" install --upgrade pip wheel
"$VENV_DIR/bin/pip" install -e .

echo "[4/5] Initializing the database..."
export FLASK_APP=freezr
"$VENV_DIR/bin/flask" init-db

echo "[5/5] Configuring systemd service..."
LOCAL_SERVICE_FILE="$APP_DIR/freezr.service"
SYSTEMD_DEST="/etc/systemd/system/freezr.service"

if [ ! -f "$LOCAL_SERVICE_FILE" ]; then
    echo "Error: $LOCAL_SERVICE_FILE not found!"
    exit 1
fi

sudo sed -e "s|__USER__|$CURRENT_USER|g" \
         -e "s|__APP_DIR__|$APP_DIR|g" \
         -e "s|__VENV_DIR__|$VENV_DIR|g" \
         "$LOCAL_SERVICE_FILE" | sudo tee "$SYSTEMD_DEST" > /dev/null

sudo systemctl daemon-reload
sudo systemctl enable freezr
sudo systemctl start freezr

echo "========================================"
echo " Installation Complete!"
echo " Freezr is running at http://$(hostname -I | awk '{print $1}'):8000"
echo " The password was printed above during database init."
echo "========================================"
