# How to View Blockchain Data

This guide explains how to view prediction data stored on the Hyperledger Fabric blockchain.

## Data Structure

Data is stored as JSON with the following structure:

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

## Method 1: Using Python Script (Recommended)

Use the provided script to view blockchain data:

```bash
cd backend

# Get a specific prediction
python scripts/view_blockchain_data.py get <case-id>

# Query by date range
python scripts/view_blockchain_data.py query 2025-01-01T00:00:00Z 2025-12-31T23:59:59Z

# Get prediction history
python scripts/view_blockchain_data.py history <case-id>
```

### Examples:

```bash
# Get prediction for a specific case
python scripts/view_blockchain_data.py get 123e4567-e89b-12d3-a456-426614174000

# Query all predictions in January 2025
python scripts/view_blockchain_data.py query 2025-01-01T00:00:00Z 2025-01-31T23:59:59Z

# View history of a prediction (all versions)
python scripts/view_blockchain_data.py history 123e4567-e89b-12d3-a456-426614174000
```

## Method 2: Using REST API

### Get a Specific Prediction

```bash
# Get prediction by case ID
curl -X GET "http://localhost:8000/api/v1/predictions/blockchain/{case_id}" \
  -H "Authorization: Bearer <your-token>"
```

### Query by Date Range

```bash
# Query predictions between dates
curl -X GET "http://localhost:8000/api/v1/predictions/blockchain/query/date-range?start_date=2025-01-01T00:00:00Z&end_date=2025-12-31T23:59:59Z" \
  -H "Authorization: Bearer <your-token>"
```

### Get Prediction History

```bash
# Get all versions of a prediction
curl -X GET "http://localhost:8000/api/v1/predictions/blockchain/{case_id}/history" \
  -H "Authorization: Bearer <your-token>"
```

### Using Python Requests

```python
import requests

# Get a specific prediction
response = requests.get(
    "http://localhost:8000/api/v1/predictions/blockchain/123e4567-e89b-12d3-a456-426614174000",
    headers={"Authorization": "Bearer <your-token>"}
)
print(response.json())

# Query by date range
response = requests.get(
    "http://localhost:8000/api/v1/predictions/blockchain/query/date-range",
    params={
        "start_date": "2025-01-01T00:00:00Z",
        "end_date": "2025-12-31T23:59:59Z"
    },
    headers={"Authorization": "Bearer <your-token>"}
)
print(response.json())
```

## Method 3: Using Peer CLI Commands

If you have direct access to the Fabric network:

```bash
# Set environment variables (for Fabric test network)
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

# Query a specific prediction
peer chaincode query \
  -C mychannel \
  -n aegis-predictions \
  -c '{"function":"GetPrediction","Args":["your-case-id-here"]}'

# Query by date range
peer chaincode query \
  -C mychannel \
  -n aegis-predictions \
  -c '{"function":"QueryPredictionsByDateRange","Args":["2025-01-01T00:00:00Z","2025-12-31T23:59:59Z"]}'

# Get prediction history
peer chaincode query \
  -C mychannel \
  -n aegis-predictions \
  -c '{"function":"GetPredictionHistory","Args":["your-case-id-here"]}'
```

## Method 4: Using Python Service Directly

```python
import asyncio
from app.services.blockchain_service import get_blockchain_service
from uuid import UUID
from datetime import datetime

async def view_data():
    blockchain_service = get_blockchain_service()
    
    # Get a specific prediction
    case_id = UUID("123e4567-e89b-12d3-a456-426614174000")
    prediction = await blockchain_service.get_prediction(case_id)
    print(prediction)
    
    # Query by date range
    start_date = datetime(2025, 1, 1)
    end_date = datetime(2025, 12, 31)
    predictions = await blockchain_service.query_by_date_range(start_date, end_date)
    print(predictions)
    
    # Get history
    history = await blockchain_service.get_prediction_history(case_id)
    print(history)

asyncio.run(view_data())
```

## API Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/predictions/blockchain/{case_id}` | GET | Get a specific prediction |
| `/api/v1/predictions/blockchain/query/date-range` | GET | Query by date range |
| `/api/v1/predictions/blockchain/{case_id}/history` | GET | Get prediction history |

## Response Format

### Single Prediction

```json
{
  "caseId": "123e4567-e89b-12d3-a456-426614174000",
  "top3AtmLocations": [...],
  "confidenceScores": {...},
  "timeWindow": {...},
  "timestamp": "2025-01-15T12:00:00Z",
  "model_info": {...}
}
```

### Date Range Query

```json
{
  "count": 10,
  "start_date": "2025-01-01T00:00:00Z",
  "end_date": "2025-12-31T23:59:59Z",
  "predictions": [...]
}
```

### History

```json
{
  "case_id": "123e4567-e89b-12d3-a456-426614174000",
  "version_count": 3,
  "history": [...]
}
```

## Important Notes

1. **Authentication Required**: All API endpoints require authentication (JWT token)
2. **Blockchain Must Be Enabled**: Set `BLOCKCHAIN_ENABLED=true` in environment variables
3. **Data Immutability**: Once stored, data cannot be modified (only updated with new timestamp)
4. **History Preservation**: All versions of predictions are preserved
5. **Privacy**: Data is only visible to channel members

## Troubleshooting

### "Blockchain is not enabled" Error

Set in your `.env` file:
```bash
BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_NETWORK_CONFIG=./blockchain/network.yaml
BLOCKCHAIN_USER_NAME=Admin
BLOCKCHAIN_ORG_NAME=Org1
```

### "Prediction not found" Error

- Verify the case ID is correct
- Check if the prediction was actually stored on blockchain
- Verify blockchain network is running

### Connection Errors

- Ensure Fabric network is running: `docker ps | grep peer`
- Check network configuration in `blockchain/network.yaml`
- Verify certificates and MSP configuration

## Next Steps

1. **Store a prediction**: Use the prediction endpoint to generate and store a prediction
2. **View stored data**: Use any of the methods above to view the data
3. **Query by date**: Use date range queries to analyze predictions over time
4. **View history**: Check how predictions were updated over time

