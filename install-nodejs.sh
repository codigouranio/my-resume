#!/bin/bash
# Install Node.js 20 on the server
# Run this on the server: bash install-nodejs.sh

echo "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
npm --version

echo "✅ Node.js installed!"
