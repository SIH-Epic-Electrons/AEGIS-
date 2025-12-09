#!/bin/bash

# Start Hyperledger Fabric Network for AEGIS

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "Starting Hyperledger Fabric Network"
echo "=========================================="

cd "$NETWORK_DIR"

# Check if setup is done
if [ ! -d "network-config/crypto-config" ]; then
    echo "Network not set up. Running setup first..."
    ./scripts/setup-network.sh
fi

# Start network
echo "Starting Docker containers..."
docker-compose -f network-config/docker-compose.yaml up -d

echo "Waiting for network to be ready..."
sleep 15

# Wait for peers to be ready
echo "Waiting for peers to be ready..."
until docker exec peer0.org1.aegis.com peer node status > /dev/null 2>&1; do
    echo "Waiting for peer0.org1.aegis.com..."
    sleep 2
done

# Create channel (only if it doesn't exist)
echo "Creating channel..."
if [ ! -f "network-config/channel-artifacts/audit-channel.block" ]; then
    docker exec -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.aegis.com/users/Admin@org1.aegis.com/msp \
        -e CORE_PEER_LOCALMSPID=Org1MSP \
        -e CORE_PEER_ADDRESS=peer0.org1.aegis.com:7051 \
        cli peer channel create \
        -o orderer.aegis.com:7050 \
        -c audit-channel \
        -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/audit-channel.tx \
        --tls \
        --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/aegis.com/orderers/orderer.aegis.com/msp/tlscacerts/tlsca.aegis.com-cert.pem \
        --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/audit-channel.block
    
    # Copy block file out of container
    docker cp cli:/opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/audit-channel.block network-config/channel-artifacts/ 2>/dev/null || true
else
    echo "Channel already exists, copying block file..."
    docker cp network-config/channel-artifacts/audit-channel.block cli:/opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/ 2>/dev/null || true
fi

# Join peers to channel
echo "Joining peers to channel..."
# Set MSP config explicitly for the join command
docker exec -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.aegis.com/users/Admin@org1.aegis.com/msp \
    -e CORE_PEER_LOCALMSPID=Org1MSP \
    -e CORE_PEER_ADDRESS=peer0.org1.aegis.com:7051 \
    cli peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/audit-channel.block

# Install chaincode
echo "Installing chaincode..."
docker exec cli peer chaincode package audit-trail.tar.gz --path /opt/gopath/src/github.com/chaincode/audit-trail --lang node --label audit-trail_1.0

docker exec cli peer chaincode install audit-trail.tar.gz

# Instantiate chaincode
echo "Instantiating audit-trail chaincode..."
docker exec cli peer chaincode instantiate -o orderer.aegis.com:7050 --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/aegis.com/orderers/orderer.aegis.com/msp/tlscacerts/tlsca.aegis.com-cert.pem -C audit-channel -n audit-trail -v 1.0 -c '{"Args":[]}' -P "AND ('Org1MSP.peer','Org2MSP.peer')"

# Install predictions chaincode
echo "Installing predictions chaincode..."
docker exec cli peer chaincode package predictions.tar.gz --path /opt/gopath/src/github.com/chaincode/predictions --lang node --label predictions_1.0

docker exec cli peer chaincode install predictions.tar.gz

# Instantiate predictions chaincode
echo "Instantiating predictions chaincode..."
docker exec cli peer chaincode instantiate -o orderer.aegis.com:7050 --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/aegis.com/orderers/orderer.aegis.com/msp/tlscacerts/tlsca.aegis.com-cert.pem -C audit-channel -n predictions -v 1.0 -c '{"Args":[]}' -P "AND ('Org1MSP.peer','Org2MSP.peer')"

echo ""
echo "=========================================="
echo "Network Started Successfully!"
echo "=========================================="
echo "Network is running. Check status with:"
echo "  docker-compose -f network-config/docker-compose.yaml ps"
echo ""
echo "View logs with:"
echo "  docker-compose -f network-config/docker-compose.yaml logs -f"

