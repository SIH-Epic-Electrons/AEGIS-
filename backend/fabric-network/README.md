# Predictions Blockchain Storage

This document describes the blockchain storage implementation for AEGIS predictions.

## Overview

Predictions (top 3 ATM locations, confidence scores, time windows) are stored on Hyperledger Fabric blockchain for:
- **Immutability**: Predictions cannot be tampered with
- **Privacy**: Sensitive prediction data is stored securely
- **Audit Trail**: Complete history of all predictions
- **Transparency**: Verifiable prediction records

## Chaincode

**Location**: `backend/fabric-network/chaincode/predictions/`

**Language**: JavaScript (Node.js)

**Functions**:
- `StorePrediction(caseId, predictionData)` - Store prediction data
- `GetPrediction(caseId)` - Retrieve prediction by case ID
- `QueryPredictionsByDateRange(startDate, endDate)` - Query by date range
- `QueryPredictionsByModel(modelName)` - Query by model name
- `GetAllPredictions()` - Get all predictions (admin/testing)

## Data Structure

Predictions are stored with the following structure:

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
      "confidence": 0.855
    },
    {
      "rank": 2,
      "atm_id": "atm-id-2",
      "name": "ATM Name 2",
      "address": "Full Address 2",
      "lat": 19.0761,
      "lon": 72.8778,
      "bank": "Bank Name 2",
      "city": "City Name 2",
      "distance_km": 3.2,
      "confidence": 0.723
    },
    {
      "rank": 3,
      "atm_id": "atm-id-3",
      "name": "ATM Name 3",
      "address": "Full Address 3",
      "lat": 19.0762,
      "lon": 72.8779,
      "bank": "Bank Name 3",
      "city": "City Name 3",
      "distance_km": 4.1,
      "confidence": 0.689
    }
  ],
  "confidenceScores": {
    "primary": 0.855,
    "alternatives": [0.723, 0.689],
    "overall": 0.756
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
  },
  "txId": "transaction-id",
  "txTimestamp": "2025-01-15T12:00:00.000Z"
}
```

## Integration

### Backend Service

**File**: `backend/app/services/fabric_service.py`

**Method**: `store_prediction()`

```python
await fabric_service.store_prediction(
    case_id=str(case_id),
    top3_atm_locations=top3_locations,
    confidence_scores=confidence_scores,
    time_window=time_window,
    model_info=model_info
)
```

### API Endpoint

**File**: `backend/app/api/v1/endpoints/predictions.py`

Predictions are automatically stored on blockchain when:
- A prediction is generated via `GET /api/v1/predictions/case/{case_id}`
- The prediction includes top 3 ATM locations
- Storage happens asynchronously (non-blocking)

## Configuration

Add to `.env`:

```env
BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_NETWORK_CONFIG=./fabric-network/network-config
BLOCKCHAIN_CHANNEL_NAME=audit-channel
BLOCKCHAIN_USER_NAME=Admin
BLOCKCHAIN_ORG_NAME=org1
```

## Deployment

The predictions chaincode is automatically deployed when you run:

```bash
cd backend/fabric-network
./scripts/start-network.sh
```

This will:
1. Install the audit-trail chaincode
2. Install the predictions chaincode
3. Instantiate both chaincodes on the audit-channel

## Testing

### Test via CLI

```bash
# Enter CLI container
docker exec -it cli bash

# Store a test prediction
peer chaincode invoke \
  -o orderer.aegis.com:7050 \
  --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/aegis.com/orderers/orderer.aegis.com/msp/tlscacerts/tlsca.aegis.com-cert.pem \
  -C audit-channel \
  -n predictions \
  -c '{"Args":["StorePrediction","case-123","{\"top3AtmLocations\":[{\"rank\":1,\"atm_id\":\"atm-1\",\"confidence\":0.85}],\"confidenceScores\":{\"primary\":0.85},\"timeWindow\":{\"window_start\":\"2025-01-15T10:00:00Z\"},\"model_info\":{\"model_name\":\"CST-Transformer\"}}"]}'

# Query prediction
peer chaincode query \
  -C audit-channel \
  -n predictions \
  -c '{"Args":["GetPrediction","case-123"]}'
```

### Test via API

```bash
# Generate prediction (automatically stores on blockchain)
curl -X GET http://localhost:8000/api/v1/predictions/case/{case_id} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Fallback Behavior

If the Fabric network is not available:
- Predictions are stored locally in `fabric-network/local-predictions-log.jsonl`
- The API response is not affected (non-blocking storage)
- Logs indicate local storage is being used

## Benefits

1. **Data Integrity**: Predictions cannot be modified after storage
2. **Privacy**: Sensitive prediction data is stored securely
3. **Audit Trail**: Complete history for compliance and analysis
4. **Verification**: Anyone can verify prediction data hasn't been tampered with
5. **Scalability**: Handles thousands of predictions per second

## Cost

- **Software**: Free (Hyperledger Fabric is open source)
- **Infrastructure**: ~$50-200/month for small-medium scale
- **Total**: Significantly cheaper than managed blockchain services

## Next Steps

1. Start the Fabric network
2. Enable blockchain in `.env` (`BLOCKCHAIN_ENABLED=true`)
3. Test prediction storage
4. Monitor blockchain performance
5. Set up production configuration (Raft ordering, TLS, etc.)

For more information, see:
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Complete setup instructions
- [README.md](./README.md) - Network overview

