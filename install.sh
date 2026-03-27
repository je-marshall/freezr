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
# We include gcc and python3-devel as they are often required 
# to compile certain Python C-extensions via pip on Rocky
sudo dnf install -y python3 python3-pip python3-devel gcc

# 3. Create and activate virtual environment
echo "[2/5] Creating Python virtual environment..."
python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"

# 4. Install the application and Gunicorn
echo "[3/5] Installing Freezr and Gunicorn..."
pip install --upgrade pip
pip install -e .
pip install gunicorn

# 5. Initialize the Database
echo "[4/5] Initializing the database..."
export FLASK_APP=freezr
# This will trigger your newly created secure admin generation!
flask init-db 

# 6. Create the Systemd Service
echo "[5/5] Creating systemd service for Gunicorn..."
SERVICE_FILE="/etc/systemd/system/freezr.service"

# Note: Rocky Linux doesn't use the 'www-data' group. 
# We set Group to $CURRENT_USER so Gunicorn has perfect 
# read/write access to your SQLite database file.
sudo bash -c "cat > $SERVICE_FILE" <<EOF
[Unit]
Description=Gunicorn instance to serve Freezr
After=network.target

[Service]
User=$CURRENT_USER
Group=$CURRENT_USER
WorkingDirectory=$APP_DIR
Environment="PATH=$VENV_DIR/bin"
# Runs gunicorn with 4 workers, binding to localhost on port 8000
ExecStart=$VENV_DIR/bin/gunicorn -w 4 -b 127.0.0.1:8000 'freezr:create_app()'

[Install]
WantedBy=multi-user.target
EOF

# 7. Enable and start the service
echo "Starting and enabling the Freezr service..."
sudo systemctl daemon-reload
sudo systemctl start freezr
sudo systemctl enable freezr

echo "========================================"
echo " ✅ Installation Complete! "
echo " Freezr is now running locally on http://127.0.0.1:8000"
echo " Ensure your NGINX reverse proxy points to this address."
echo "========================================"
