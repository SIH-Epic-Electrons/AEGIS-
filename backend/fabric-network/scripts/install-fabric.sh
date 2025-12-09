#!/bin/bash

# Hyperledger Fabric Installation Script for AEGIS
# This script installs Fabric binaries and Docker images

set -e

echo "=========================================="
echo "Installing Hyperledger Fabric for AEGIS"
echo "=========================================="

# Set Fabric version
FABRIC_VERSION=2.5.0
CA_VERSION=1.5.6

# Create bin directory
BIN_DIR="$(pwd)/bin"
mkdir -p "$BIN_DIR"

echo "Step 1: Downloading Fabric binaries..."
curl -sSL https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/bootstrap.sh | bash -s -- $FABRIC_VERSION $CA_VERSION

# Move binaries to our bin directory
if [ -d "fabric-samples/bin" ]; then
    echo "Step 2: Copying binaries..."
    cp -r fabric-samples/bin/* "$BIN_DIR/" 2>/dev/null || true
    echo "Binaries installed to: $BIN_DIR"
fi

echo "Step 3: Pulling Docker images..."
docker pull hyperledger/fabric-peer:${FABRIC_VERSION}
docker pull hyperledger/fabric-orderer:${FABRIC_VERSION}
docker pull hyperledger/fabric-ca:${CA_VERSION}
docker pull hyperledger/fabric-tools:${FABRIC_VERSION}
docker pull hyperledger/fabric-ccenv:${FABRIC_VERSION}
docker pull couchdb:3.3

echo ""
echo "=========================================="
echo "Installation Complete!"
echo "=========================================="
echo "Fabric binaries: $BIN_DIR"
echo "Docker images: Pulled successfully"
echo ""
echo "Next steps:"
echo "1. Run ./scripts/start-network.sh to start the network"
echo "2. Or run ./scripts/setup-network.sh for full setup"

