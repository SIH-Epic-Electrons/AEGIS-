#!/bin/bash

# Stop Hyperledger Fabric Network for AEGIS

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Stopping Hyperledger Fabric Network..."

cd "$NETWORK_DIR"

docker-compose -f network-config/docker-compose.yaml down

# Optional: Remove volumes (uncomment to clean up completely)
# docker-compose -f network-config/docker-compose.yaml down -v

echo "Network stopped."

