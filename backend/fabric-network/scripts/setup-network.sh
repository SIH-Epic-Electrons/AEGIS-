#!/bin/bash

# Hyperledger Fabric Network Setup Script for AEGIS
# This script sets up a basic 2-org network for development

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN_DIR="$NETWORK_DIR/bin"

echo "=========================================="
echo "Setting up Hyperledger Fabric Network"
echo "=========================================="

# Check if binaries exist
if [ ! -f "$BIN_DIR/configtxgen" ]; then
    echo "Error: Fabric binaries not found. Run ./scripts/install-fabric.sh first"
    exit 1
fi

# Set PATH
export PATH="$BIN_DIR:$PATH"
export FABRIC_CFG_PATH="$NETWORK_DIR/network-config"

cd "$NETWORK_DIR"

echo "Step 1: Generating crypto materials..."
if [ ! -d "network-config/crypto-config" ]; then
    cryptogen generate --config=network-config/crypto-config.yaml --output="network-config/crypto-config"
    echo "✓ Crypto materials generated"
    
    # Ensure Admin certificates are in peer admincerts (required for channel operations)
    echo "Step 1a: Copying Admin certificates to peer admincerts..."
    for org in org1 org2; do
        ADMIN_CERT="network-config/crypto-config/peerOrganizations/${org}.aegis.com/users/Admin@${org}.aegis.com/msp/signcerts/Admin@${org}.aegis.com-cert.pem"
        PEER_ADMINCERTS="network-config/crypto-config/peerOrganizations/${org}.aegis.com/peers/peer0.${org}.aegis.com/msp/admincerts/"
        if [ -f "$ADMIN_CERT" ] && [ -d "$PEER_ADMINCERTS" ]; then
            cp "$ADMIN_CERT" "$PEER_ADMINCERTS"
            echo "  ✓ Copied Admin cert for ${org}"
        fi
    done
else
    echo "✓ Crypto materials already exist"
    # Still ensure admincerts are populated even if crypto exists
    for org in org1 org2; do
        ADMIN_CERT="network-config/crypto-config/peerOrganizations/${org}.aegis.com/users/Admin@${org}.aegis.com/msp/signcerts/Admin@${org}.aegis.com-cert.pem"
        PEER_ADMINCERTS="network-config/crypto-config/peerOrganizations/${org}.aegis.com/peers/peer0.${org}.aegis.com/msp/admincerts/"
        if [ -f "$ADMIN_CERT" ] && [ -d "$PEER_ADMINCERTS" ] && [ ! -f "${PEER_ADMINCERTS}Admin@${org}.aegis.com-cert.pem" ]; then
            cp "$ADMIN_CERT" "$PEER_ADMINCERTS"
            echo "  ✓ Ensured Admin cert for ${org}"
        fi
    done
fi

echo "Step 2: Generating genesis block..."
if [ ! -f "network-config/channel-artifacts/genesis.block" ]; then
    mkdir -p network-config/channel-artifacts
    configtxgen -profile AegisOrdererGenesis -channelID system-channel -outputBlock network-config/channel-artifacts/genesis.block
    echo "✓ Genesis block generated"
else
    echo "✓ Genesis block already exists"
fi

echo "Step 3: Generating channel configuration..."
if [ ! -f "network-config/channel-artifacts/audit-channel.tx" ]; then
    configtxgen -profile AegisChannel -outputCreateChannelTx network-config/channel-artifacts/audit-channel.tx -channelID audit-channel
    echo "✓ Channel configuration generated"
else
    echo "✓ Channel configuration already exists"
fi

echo "Step 4: Generating anchor peer updates..."
if [ ! -f "network-config/channel-artifacts/Org1MSPanchors.tx" ]; then
    configtxgen -profile AegisChannel -outputAnchorPeersUpdate network-config/channel-artifacts/Org1MSPanchors.tx -channelID audit-channel -asOrg Org1MSP
    configtxgen -profile AegisChannel -outputAnchorPeersUpdate network-config/channel-artifacts/Org2MSPanchors.tx -channelID audit-channel -asOrg Org2MSP
    echo "✓ Anchor peer updates generated"
else
    echo "✓ Anchor peer updates already exist"
fi

echo ""
echo "=========================================="
echo "Network Setup Complete!"
echo "=========================================="
echo "Next: Run ./scripts/start-network.sh to start the network"

