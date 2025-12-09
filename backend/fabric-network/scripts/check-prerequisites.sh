#!/bin/bash

# Check prerequisites for Hyperledger Fabric setup

echo "=========================================="
echo "Checking Prerequisites for Fabric Setup"
echo "=========================================="

ERRORS=0

# Check Docker
echo -n "Checking Docker... "
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo "✓ Found: $DOCKER_VERSION"
    
    # Check if Docker is running
    if docker info &> /dev/null; then
        echo "  ✓ Docker daemon is running"
    else
        echo "  ✗ Docker daemon is not running. Please start Docker Desktop."
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "✗ Docker not found. Please install Docker Desktop."
    ERRORS=$((ERRORS + 1))
fi

# Check Docker Compose
echo -n "Checking Docker Compose... "
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    echo "✓ Found: $COMPOSE_VERSION"
elif docker compose version &> /dev/null; then
    echo "✓ Found: Docker Compose (plugin)"
else
    echo "✗ Docker Compose not found."
    ERRORS=$((ERRORS + 1))
fi

# Check Node.js
echo -n "Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✓ Found: $NODE_VERSION"
    
    # Check version (should be v18+)
    NODE_MAJOR=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        echo "  ✓ Version is 18+ (required)"
    else
        echo "  ⚠ Warning: Node.js version should be 18+ (found v$NODE_MAJOR)"
    fi
else
    echo "✗ Node.js not found. Please install Node.js 18+."
    ERRORS=$((ERRORS + 1))
fi

# Check npm
echo -n "Checking npm... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✓ Found: v$NPM_VERSION"
else
    echo "✗ npm not found."
    ERRORS=$((ERRORS + 1))
fi

# Check curl
echo -n "Checking curl... "
if command -v curl &> /dev/null; then
    CURL_VERSION=$(curl --version | head -1)
    echo "✓ Found: $CURL_VERSION"
else
    echo "✗ curl not found."
    ERRORS=$((ERRORS + 1))
fi

# Check jq
echo -n "Checking jq... "
if command -v jq &> /dev/null; then
    JQ_VERSION=$(jq --version)
    echo "✓ Found: $JQ_VERSION"
else
    echo "✗ jq not found. Install with: brew install jq (macOS) or apt-get install jq (Linux)"
    ERRORS=$((ERRORS + 1))
fi

# Check Go (optional)
echo -n "Checking Go (optional)... "
if command -v go &> /dev/null; then
    GO_VERSION=$(go version)
    echo "✓ Found: $GO_VERSION"
    echo "  ℹ Go is optional (only needed for Go chaincode)"
else
    echo "⚠ Not found (optional - only needed for Go chaincode)"
fi

# Check Python (optional for SDK)
echo -n "Checking Python... "
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "✓ Found: $PYTHON_VERSION"
else
    echo "⚠ Not found (optional - needed for Python SDK integration)"
fi

echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
    echo "✓ All required prerequisites are installed!"
    echo ""
    echo "Next steps:"
    echo "1. Run ./scripts/install-fabric.sh"
    echo "2. Run ./scripts/setup-network.sh"
    echo "3. Run ./scripts/start-network.sh"
else
    echo "✗ Found $ERRORS error(s). Please fix them before proceeding."
    echo ""
    echo "Installation guides:"
    echo "- Docker: https://www.docker.com/products/docker-desktop"
    echo "- Node.js: https://nodejs.org/"
    echo "- jq: brew install jq (macOS) or apt-get install jq (Linux)"
fi
echo "=========================================="

exit $ERRORS

