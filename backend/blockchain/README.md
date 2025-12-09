# AEGIS Blockchain Integration - Hyperledger Fabric

This directory contains the blockchain integration for storing sensitive prediction data.

> **📖 For complete documentation, see [BLOCKCHAIN_COMPLETE_GUIDE.md](../BLOCKCHAIN_COMPLETE_GUIDE.md)**

## What Gets Stored

- **Top 3 Most Probable ATM Locations** (with coordinates, bank, confidence)
- **Confidence Scores** (primary, alternatives, overall)
- **Time Window Predictions** (start, end, confidence)
- **Case ID** (for linking)
- **Model Information** (model name, version, mode)
- **Timestamp** (when prediction was made)

## Setup Instructions

### 1. Install Hyperledger Fabric

```bash
# Install prerequisites
curl -sSL https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/bootstrap.sh | bash -s -- 2.5.0

# Or clone fabric-samples
git clone https://github.com/hyperledger/fabric-samples.git
cd fabric-samples
./scripts/bootstrap.sh
```

### 2. Start Test Network

```bash
cd fabric-samples/test-network
./network.sh up createChannel
```

### 3. Deploy Chaincode

```bash
# Package chaincode
peer lifecycle chaincode package aegis-predictions.tar.gz \
  --path ./chaincode/aegis-predictions \
  --lang golang \
  --label aegis-predictions_1.0

# Install chaincode (follow Hyperledger Fabric deployment guide)
```

### 4. Configure Environment

Update `.env` file:

```bash
BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_NETWORK_CONFIG=./blockchain/network.yaml
BLOCKCHAIN_USER_NAME=admin
BLOCKCHAIN_ORG_NAME=Org1
```

### 5. Install Python Dependencies

```bash
pip install fabric-sdk-py grpcio grpcio-tools protobuf
```

## Testing

The blockchain integration is automatically called when predictions are generated. Check logs for:

- "Queued blockchain storage for case {case_id}"
- "Successfully stored prediction for case {case_id} on blockchain"

## Cost

- **Hyperledger Fabric**: Free (open source)
- **Infrastructure**: ~$50-200/month (cloud VMs)
- **Total**: Very cost-effective for enterprise use

## Benefits

1. **Privacy**: Data stored immutably on blockchain
2. **Audit Trail**: Complete history of all predictions
3. **Tamper-Proof**: Cannot be modified after storage
4. **Scalable**: Handles thousands of transactions per second

## Chaincode Functions

The Go chaincode (`aegis-predictions.go`) provides:

- `StorePrediction(predictionJSON)` - Store new prediction
- `UpdatePrediction(predictionJSON)` - Update existing prediction
- `GetPrediction(caseID)` - Retrieve prediction by case ID
- `QueryPredictionsByDateRange(startDate, endDate)` - Query by date range
- `GetAllPredictions()` - Get all predictions (admin/testing)
- `GetPredictionHistory(caseID)` - Get complete history of a prediction

## Network Configuration

The `network.yaml` file configures:
- Organization: AegisOrg
- Channel: aegis-channel
- Chaincode: aegis-predictions
- Peers: peer0.aegis.org
- Orderer: orderer.aegis.org

## Integration

The blockchain service is automatically called from the predictions endpoint:

```python
# In app/api/v1/endpoints/predictions.py
from app.services.blockchain_service import get_blockchain_service

blockchain_service = get_blockchain_service()
await blockchain_service.store_prediction(...)
```

## Troubleshooting

1. **SDK not available**: Install `fabric-sdk-py` or use gRPC directly
2. **Network not found**: Check `network.yaml` path in `.env`
3. **Connection failed**: Ensure Fabric network is running
4. **Chaincode errors**: Verify chaincode is deployed and instantiated

## Next Steps

1. Deploy the Go chaincode to your Fabric network
2. Configure network.yaml with your actual network details
3. Enable blockchain in `.env` (`BLOCKCHAIN_ENABLED=true`)
4. Test prediction storage
5. Monitor blockchain performance

For detailed setup, see the main Fabric network documentation in `../fabric-network/`.

