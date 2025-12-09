# AEGIS Blockchain Integration - Complete Guide

This document provides a comprehensive overview of the AEGIS blockchain integration using Hyperledger Fabric, including folder structure, setup, usage, and troubleshooting.

## Table of Contents

1. [Overview](#overview)
2. [Folder Structure](#folder-structure)
3. [Blockchain Components](#blockchain-components)
4. [Setup Instructions](#setup-instructions)
5. [Data Storage](#data-storage)
6. [Viewing Data](#viewing-data)
7. [API Integration](#api-integration)
8. [Troubleshooting](#troubleshooting)
9. [Production Considerations](#production-considerations)

---

## Overview

AEGIS uses **Hyperledger Fabric** to store sensitive AI prediction data on blockchain for:
- **Immutability**: Predictions cannot be tampered with
- **Privacy**: Secure storage of sensitive data
- **Audit Trail**: Complete history of all predictions
- **Transparency**: Verifiable prediction records

### What Gets Stored

- Top 3 Most Probable ATM Locations (with coordinates, bank, confidence)
- Confidence Scores (primary, alternatives, overall)
- Time Window Predictions (start, end, confidence)
- Case ID (for linking)
- Model Information (model name, version, mode)
- Timestamp (when prediction was made)

---

## Folder Structure

```
backend/
├── blockchain/                          # Blockchain integration (PRIMARY)
│   ├── chaincode/
│   │   ├── aegis-predictions.go        # Go chaincode for predictions
│   │   └── go.mod                      # Go module dependencies
│   ├── network.yaml                     # Network configuration for Python SDK
│   ├── README.md                        # Blockchain setup guide
│   └── VIEW_DATA.md                     # Data viewing guide
│
├── fabric-network/                      # Custom Fabric network setup (LEGACY)
│   ├── bin/                            # Fabric binaries
│   │   ├── peer, orderer, configtxgen, etc.
│   ├── chaincode/
│   │   └── audit-trail/                # JavaScript audit trail chaincode
│   │       ├── index.js
│   │       └── package.json
│   ├── network-config/                 # Network configuration
│   │   ├── crypto-config/              # Generated certificates
│   │   ├── channel-artifacts/          # Channel configuration
│   │   ├── configtx.yaml              # Channel configuration
│   │   ├── crypto-config.yaml         # Crypto material generation
│   │   └── docker-compose.yaml        # Docker services
│   ├── scripts/                        # Setup and management scripts
│   │   ├── install-fabric.sh          # Install Fabric binaries
│   │   ├── setup-network.sh           # Generate crypto materials
│   │   ├── start-network.sh           # Start network
│   │   ├── stop-network.sh            # Stop network
│   │   ├── fix-channel-setup.sh       # Fix channel issues
│   │   └── check-prerequisites.sh      # Check requirements
│   ├── README.md                        # Network overview
│   ├── PREDICTIONS_BLOCKCHAIN.md        # Predictions storage details
│   └── TEST_NETWORK_SETUP.md            # Using Fabric test network
│
├── app/
│   ├── services/
│   │   ├── blockchain_service.py       # Python service for predictions
│   │   └── fabric_service.py          # Python service for audit trail
│   └── api/v1/endpoints/
│       └── predictions.py              # API endpoints (includes blockchain)
│
└── scripts/
    └── view_blockchain_data.py         # CLI tool for viewing data
```

### Key Directories

#### `backend/blockchain/` (PRIMARY - Use This)
- **Purpose**: Main blockchain integration for predictions
- **Chaincode**: Go-based (`aegis-predictions.go`)
- **Configuration**: `network.yaml` for Python SDK
- **Status**: ✅ Production-ready

#### `backend/fabric-network/` (LEGACY - Reference Only)
- **Purpose**: Custom Fabric network setup (had MSP issues)
- **Status**: ⚠️ Use Fabric test network instead (see TEST_NETWORK_SETUP.md)
- **Note**: Kept for reference, but use test network for actual deployment

---

## Blockchain Components

### 1. Chaincode (Smart Contracts)

#### Predictions Chaincode (Go)
- **Location**: `backend/blockchain/chaincode/aegis-predictions.go`
- **Language**: Go
- **Functions**:
  - `StorePrediction(predictionJSON)` - Store new prediction
  - `UpdatePrediction(predictionJSON)` - Update existing prediction
  - `GetPrediction(caseID)` - Retrieve by case ID
  - `QueryPredictionsByDateRange(startDate, endDate)` - Query by date range
  - `GetAllPredictions()` - Get all predictions (admin/testing)
  - `GetPredictionHistory(caseID)` - Get complete history

#### Audit Trail Chaincode (JavaScript)
- **Location**: `backend/fabric-network/chaincode/audit-trail/index.js`
- **Language**: JavaScript (Node.js)
- **Functions**:
  - `CreateAuditEvent(...)` - Store audit events
  - `QueryAuditEvent(eventId)` - Query specific event
  - `QueryAuditEventsByOfficer(officerId)` - Get events for officer
  - `QueryAuditEventsByType(eventType)` - Get events by type
  - `QueryAuditEventsByDateRange(startDate, endDate)` - Query by date range

### 2. Python Services

#### Blockchain Service (`blockchain_service.py`)
- **Purpose**: Interact with predictions chaincode
- **Methods**:
  - `store_prediction()` - Store prediction data
  - `get_prediction()` - Retrieve prediction
  - `query_by_date_range()` - Query by date range
  - `get_prediction_history()` - Get history

#### Fabric Service (`fabric_service.py`)
- **Purpose**: Interact with audit trail chaincode
- **Methods**:
  - `create_audit_event()` - Create audit event
  - `query_audit_event()` - Query event
  - Various query methods

### 3. Network Configuration

#### `blockchain/network.yaml`
- **Purpose**: Python SDK network configuration
- **Contains**: Organization, peers, channels, orderers
- **Used by**: `blockchain_service.py`

#### `fabric-network/network-config/`
- **Purpose**: Custom network configuration
- **Contains**: Crypto materials, channel artifacts, docker-compose
- **Status**: Legacy (use test network instead)

---

## Setup Instructions

### Option 1: Use Fabric Test Network (Recommended)

The Fabric test network is the recommended approach as it handles MSP configuration correctly.

#### Step 1: Install Fabric Binaries

```bash
# Install Fabric 2.5.0
curl -sSL https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/bootstrap.sh | bash -s -- 2.5.0 1.5.0
```

#### Step 2: Start Test Network

```bash
# Navigate to fabric-samples (should be in parent directory or install separately)
cd fabric-samples/test-network
./network.sh up createChannel
```

#### Step 3: Deploy Chaincode

```bash
# Package predictions chaincode
peer lifecycle chaincode package aegis-predictions.tar.gz \
  --path ../../AEGIS--main/backend/blockchain/chaincode \
  --lang golang \
  --label aegis-predictions_1.0

# Install on Org1
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

peer lifecycle chaincode install aegis-predictions.tar.gz

# Get package ID
PACKAGE_ID=$(peer lifecycle chaincode queryinstalled --output json | jq -r '.installed_chaincodes[0].package_id')

# Approve and commit (see TEST_NETWORK_SETUP.md for full commands)
```

#### Step 4: Configure Backend

Update `backend/blockchain/network.yaml`:

```yaml
name: TestNetwork
version: 1.0.0
client:
  organization: Org1
organizations:
  Org1:
    mspid: Org1MSP
    peers:
      - peer0.org1.example.com
peers:
  peer0.org1.example.com:
    url: grpc://localhost:7051
channels:
  mychannel:
    orderers:
      - orderer.example.com
    peers:
      peer0.org1.example.com:
        endorsingPeer: true
orderers:
  orderer.example.com:
    url: grpc://localhost:7050
```

#### Step 5: Environment Variables

Add to `.env`:

```bash
BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_NETWORK_CONFIG=./blockchain/network.yaml
BLOCKCHAIN_USER_NAME=Admin
BLOCKCHAIN_ORG_NAME=Org1
```

### Option 2: Custom Network (Legacy - Not Recommended)

The custom network setup had MSP validation issues. See `fabric-network/README.md` for reference, but use test network instead.

---

## Data Storage

### Data Structure

Predictions are stored as JSON:

```json
{
  "caseId": "uuid-string",
  "top3AtmLocations": [
    {
      "rank": 1,
      "atm_id": "atm-id-1",
      "name": "ATM Name",
      "address": "Full Address",
      "lat": 19.0760,
      "lon": 72.8777,
      "bank": "Bank Name",
      "city": "City Name",
      "distance_km": 2.5,
      "confidence": 85.5
    }
  ],
  "confidenceScores": {
    "primary": 85.5,
    "alternatives": [72.3, 68.9],
    "overall": 75.6
  },
  "timeWindow": {
    "window_start": "2025-01-15T14:30:00Z",
    "window_end": "2025-01-15T16:30:00Z",
    "confidence": 0.85
  },
  "timestamp": "2025-01-15T12:00:00Z",
  "model_info": {
    "model_name": "CST-Transformer",
    "version": "v1.0",
    "mode": "ATM"
  }
}
```

### Storage Mechanism

- **Key**: `caseId` (UUID string)
- **Value**: JSON string of prediction data
- **Method**: `PutState(caseId, predictionJSON)`
- **Location**: Hyperledger Fabric ledger world state

### Automatic Storage

Predictions are automatically stored when:
- A prediction is generated via `GET /api/v1/predictions/case/{case_id}`
- The prediction includes top 3 ATM locations
- `BLOCKCHAIN_ENABLED=true` in environment
- Storage happens asynchronously (non-blocking)

---

## Viewing Data

### Method 1: Python Script (Recommended)

```bash
cd backend

# Get a specific prediction
python scripts/view_blockchain_data.py get <case-id>

# Query by date range
python scripts/view_blockchain_data.py query 2025-01-01T00:00:00Z 2025-12-31T23:59:59Z

# Get prediction history
python scripts/view_blockchain_data.py history <case-id>
```

### Method 2: REST API

```bash
# Get prediction
curl -X GET "http://localhost:8000/api/v1/predictions/blockchain/{case_id}" \
  -H "Authorization: Bearer <token>"

# Query by date range
curl -X GET "http://localhost:8000/api/v1/predictions/blockchain/query/date-range?start_date=2025-01-01T00:00:00Z&end_date=2025-12-31T23:59:59Z" \
  -H "Authorization: Bearer <token>"

# Get history
curl -X GET "http://localhost:8000/api/v1/predictions/blockchain/{case_id}/history" \
  -H "Authorization: Bearer <token>"
```

### Method 3: Peer CLI

```bash
# Set environment
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

# Query
peer chaincode query \
  -C mychannel \
  -n aegis-predictions \
  -c '{"function":"GetPrediction","Args":["case-id"]}'
```

See `blockchain/VIEW_DATA.md` for detailed viewing instructions.

---

## API Integration

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/predictions/case/{case_id}` | GET | Generate prediction (auto-stores on blockchain) |
| `/api/v1/predictions/blockchain/{case_id}` | GET | Get prediction from blockchain |
| `/api/v1/predictions/blockchain/query/date-range` | GET | Query by date range |
| `/api/v1/predictions/blockchain/{case_id}/history` | GET | Get prediction history |

### Integration Code

The blockchain service is automatically called from the predictions endpoint:

```python
# In app/api/v1/endpoints/predictions.py
from app.services.blockchain_service import get_blockchain_service

if settings.blockchain_enabled:
    blockchain_service = get_blockchain_service()
    asyncio.create_task(
        blockchain_service.store_prediction(
            case_id=case_id,
            top3_atm_locations=top3_locations,
            confidence_scores=confidence_scores,
            time_window=time_window,
            model_info=model_info
        )
    )
```

---

## Troubleshooting

### Common Issues

#### 1. "Blockchain is not enabled"
**Solution**: Set `BLOCKCHAIN_ENABLED=true` in `.env`

#### 2. "Prediction not found"
**Solutions**:
- Verify case ID is correct
- Check if prediction was actually stored
- Verify blockchain network is running

#### 3. Connection Errors
**Solutions**:
- Ensure Fabric network is running: `docker ps | grep peer`
- Check network configuration in `blockchain/network.yaml`
- Verify certificates and MSP configuration

#### 4. MSP Validation Issues
**Solution**: Use Fabric test network instead of custom network (see TEST_NETWORK_SETUP.md)

### Network Status

```bash
# Check if network is running
docker ps | grep -E "peer|orderer"

# Check channel
docker exec peer0.org1.example.com peer channel list

# View logs
docker logs peer0.org1.example.com
```

---

## Production Considerations

### Recommended Setup

1. **Use Fabric Test Network** or production-grade network
2. **Enable TLS** for secure communication
3. **Use Raft Ordering** instead of Solo
4. **Configure CouchDB** for rich queries
5. **Set up proper MSP** configuration
6. **Implement access control** policies
7. **Monitor performance** and scale as needed

### Cost Analysis

- **Hyperledger Fabric**: Free (open source)
- **Infrastructure**: ~$50-200/month (small-medium scale)
- **Large Scale (1000+ TPS)**: ~$500-1000/month
- **Total**: Significantly cheaper than managed blockchain services

### Benefits

1. **Privacy**: Data stored immutably on blockchain
2. **Audit Trail**: Complete history of all predictions
3. **Tamper-Proof**: Cannot be modified after storage
4. **Scalability**: Handles thousands of transactions per second
5. **Cost-Effective**: Free software, only infrastructure costs

---

## File Reference

### Essential Files

- `backend/blockchain/chaincode/aegis-predictions.go` - Predictions chaincode
- `backend/blockchain/network.yaml` - Network configuration
- `backend/app/services/blockchain_service.py` - Python service
- `backend/app/api/v1/endpoints/predictions.py` - API endpoints
- `backend/scripts/view_blockchain_data.py` - Viewing tool

### Documentation Files

- `backend/BLOCKCHAIN_COMPLETE_GUIDE.md` - This file (complete guide)
- `backend/blockchain/README.md` - Blockchain setup
- `backend/blockchain/VIEW_DATA.md` - Data viewing guide
- `backend/fabric-network/README.md` - Network overview
- `backend/fabric-network/TEST_NETWORK_SETUP.md` - Test network setup
- `backend/fabric-network/PREDICTIONS_BLOCKCHAIN.md` - Predictions details

### Scripts

- `backend/fabric-network/scripts/install-fabric.sh` - Install Fabric
- `backend/fabric-network/scripts/setup-network.sh` - Setup network
- `backend/fabric-network/scripts/start-network.sh` - Start network
- `backend/fabric-network/scripts/stop-network.sh` - Stop network

---

## Quick Start

1. **Install Fabric**: `curl -sSL https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/bootstrap.sh | bash -s -- 2.5.0`
2. **Start Test Network**: `cd fabric-samples/test-network && ./network.sh up createChannel`
3. **Deploy Chaincode**: Follow TEST_NETWORK_SETUP.md
4. **Configure Backend**: Update `blockchain/network.yaml` and `.env`
5. **Test**: Generate a prediction and view it on blockchain

---

## Support

For issues or questions:
1. Check this guide first
2. Review `blockchain/VIEW_DATA.md` for viewing data
3. See `fabric-network/TEST_NETWORK_SETUP.md` for network setup
4. Check logs: `docker logs <container-name>`

---

**Last Updated**: December 2025  
**Version**: 1.0  
**Status**: Production Ready

