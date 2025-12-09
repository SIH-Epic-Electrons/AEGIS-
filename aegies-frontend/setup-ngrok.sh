#!/bin/bash

# Ngrok Installation Script for macOS
# This script installs ngrok without requiring sudo

echo "🚀 Installing ngrok..."

# Create bin directory in home if it doesn't exist
mkdir -p ~/bin

# Download ngrok
echo "📥 Downloading ngrok..."
curl -o /tmp/ngrok.zip https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-darwin-amd64.zip

# Extract ngrok
echo "📦 Extracting ngrok..."
unzip -o /tmp/ngrok.zip -d /tmp/

# Copy to user's bin directory
echo "📋 Installing ngrok to ~/bin..."
cp /tmp/ngrok ~/bin/ngrok
chmod +x ~/bin/ngrok

# Add to PATH in .zshrc if not already there
if ! grep -q 'export PATH="$HOME/bin:$PATH"' ~/.zshrc 2>/dev/null; then
    echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
    echo "✅ Added ~/bin to PATH in ~/.zshrc"
fi

# Clean up
rm /tmp/ngrok.zip

echo ""
echo "✅ Ngrok installed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Restart your terminal or run: source ~/.zshrc"
echo "2. Verify installation: ngrok version"
echo "3. Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken"
echo "4. Authenticate: ngrok config add-authtoken YOUR_AUTHTOKEN"
echo ""
echo "🚀 Then you can run: npm run deploy:backend"

