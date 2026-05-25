#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/smart-closet}"
NODE_MAJOR="${NODE_MAJOR:-24}"

echo "[1/6] Updating apt packages..."
sudo apt update

echo "[2/6] Installing base packages..."
sudo apt install -y nginx git curl unzip

echo "[3/6] Installing Node.js ${NODE_MAJOR}..."
curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
sudo apt install -y nodejs

echo "[4/6] Installing PM2..."
sudo npm install -g pm2

echo "[5/6] Installing Certbot..."
sudo apt install -y certbot python3-certbot-nginx

echo "[6/6] Preparing app directories..."
sudo mkdir -p "${APP_DIR}"
sudo mkdir -p "${APP_DIR}/server/uploads"
sudo mkdir -p "${APP_DIR}/server/data"
sudo chown -R "$USER:$USER" "${APP_DIR}"

echo
echo "Server base setup complete."
echo "App directory: ${APP_DIR}"
echo "Next: upload project files into ${APP_DIR}"
