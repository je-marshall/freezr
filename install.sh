#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "========================================"
echo "    Starting Freezr Installation...     "
echo "    (Rocky Linux / RHEL Edition)        "
echo "========================================"

# 1. Define paths and current user
APP_DIR=$(pwd)
VENV_DIR="$APP_DIR/venv"
CURRENT_USER=$(whoami)

# 2. Update packages and install prerequisites
echo "[1/5] Installing system prerequisites (requires sudo)..."
sudo dnf install -y epel-release
sudo dnf update -y
sudo dnf install -y python3 python3-pip python3-devel gcc sqlite sqlite-devel git \
    libjpeg-turbo-devel zlib-devel freetype-devel libusb1 libusb1-devel
# 3. Create virtual environment
echo "[2/5] Creating Python virtual environment..."
python3 -m venv "$VENV_DIR"

# 4. Install the application and build tools
echo "[3/5] Installing Freezr and dependencies..."
# Use the venv's pip directly to guarantee it installs in the right place
"$VENV_DIR/bin/pip" install --upgrade pip
"$VENV_DIR/bin/pip" install wheel setuptools
"$VENV_DIR/bin/pip" install -e .

# 5. Initialize the Database
echo "[4/5] Initializing the database..."
export FLASK_APP=freezr
# Calling the venv's flask binary directly completely guarantees the venv is used!
"$VENV_DIR/bin/flask" init-db 

# 6. Create the Systemd Service
echo "[5/5] Configuring systemd service..."
LOCAL_SERVICE_FILE="$APP_DIR/freezr.service"
SYSTEMD_DEST="/etc/systemd/system/freezr.service"

if [ ! -f "$LOCAL_SERVICE_FILE" ]; then
    echo "Error: $LOCAL_SERVICE_FILE not found in the current directory!"
    exit 1
fi

# Use sed to replace the placeholders in the template and write to systemd
sudo sed -e "s|__USER__|$CURRENT_USER|g" \
         -e "s|__APP_DIR__|$APP_DIR|g" \
         -e "s|__VENV_DIR__|$VENV_DIR|g" \
         "$LOCAL_SERVICE_FILE" | sudo tee "$SYSTEMD_DEST" > /dev/null

# 7. Enable and start the service
echo "Starting and enabling the Freezr service..."
sudo systemctl daemon-reload
sudo systemctl start freezr
sudo systemctl enable freezr

echo "========================================"
echo " ✅ Installation Complete! "
echo " Freezr is now running locally on http://0.0.0.0:8000"
echo " Ensure your NGINX reverse proxy points to this address."
echo "========================================"
