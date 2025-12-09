#!/bin/bash

# Fix channel setup by ensuring proper MSP configuration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$NETWORK_DIR"

echo "Fixing channel setup..."

# Ensure CLI container is running
if ! docker ps | grep -q cli; then
    echo "Starting CLI container..."
    docker-compose -f network-config/docker-compose.yaml up -d cli
    sleep 5
fi

# Wait for peer to be ready
echo "Waiting for peer to be ready..."
for i in {1..30}; do
    if docker exec peer0.org1.aegis.com peer node status > /dev/null 2>&1; then
        echo "Peer is ready!"
        break
    fi
    echo "Waiting for peer... ($i/30)"
    sleep 2
done

# Check if channel already exists, if not create it
echo "Checking if channel exists..."
CHANNEL_EXISTS=$(docker exec -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.aegis.com/users/Admin@org1.aegis.com/msp \
    -e CORE_PEER_LOCALMSPID=Org1MSP \
    -e CORE_PEER_ADDRESS=peer0.org1.aegis.com:7051 \
    cli peer channel list 2>&1 | grep -q "audit-channel" && echo "yes" || echo "no")

if [ "$CHANNEL_EXISTS" = "no" ] && [ ! -f "network-config/channel-artifacts/audit-channel.block" ]; then
    echo "Creating new channel..."
    docker exec -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.aegis.com/users/Admin@org1.aegis.com/msp \
        -e CORE_PEER_LOCALMSPID=Org1MSP \
        -e CORE_PEER_ADDRESS=peer0.org1.aegis.com:7051 \
        -e CORE_PEER_TLS_ENABLED=false \
        cli peer channel create \
        -o orderer.aegis.com:7050 \
        -c audit-channel \
        -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/audit-channel.tx \
        --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/audit-channel.block
    
    # Copy block file
    docker cp cli:/opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/audit-channel.block network-config/channel-artifacts/ 2>/dev/null || true
    echo "Channel created successfully!"
else
    echo "Channel already exists, fetching latest config block..."
    # Fetch the latest config block
    docker exec -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.aegis.com/users/Admin@org1.aegis.com/msp \
        -e CORE_PEER_LOCALMSPID=Org1MSP \
        -e CORE_PEER_ADDRESS=peer0.org1.aegis.com:7051 \
        cli peer channel fetch newest /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/audit-channel.block -c audit-channel \
        -o orderer.aegis.com:7050 \
        --tls \
        --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/aegis.com/orderers/orderer.aegis.com/msp/tlscacerts/tlsca.aegis.com-cert.pem 2>/dev/null || true
fi

# Join channel without TLS (simpler for development)
echo "Joining peer to channel..."
docker exec -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.aegis.com/users/Admin@org1.aegis.com/msp \
    -e CORE_PEER_LOCALMSPID=Org1MSP \
    -e CORE_PEER_ADDRESS=peer0.org1.aegis.com:7051 \
    -e CORE_PEER_TLS_ENABLED=false \
    cli peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/audit-channel.block

echo "Channel setup complete!"

