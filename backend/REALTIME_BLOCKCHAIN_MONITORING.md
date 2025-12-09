# Real-Time Blockchain Monitoring Guide

This guide explains how to monitor blockchain storage operations in real-time while your AEGIS application is running.

> **📖 For complete blockchain documentation, see [BLOCKCHAIN_COMPLETE_GUIDE.md](./BLOCKCHAIN_COMPLETE_GUIDE.md)**

## Overview

When predictions are generated via the API, they are automatically stored on Hyperledger Fabric blockchain. This guide shows you how to monitor these operations in real-time.

## How Data is Stored

### Automatic Storage Flow

1. **API Call**: `GET /api/v1/predictions/case/{case_id}`
2. **Prediction Generated**: AI model generates prediction
3. **Blockchain Storage**: Data automatically stored (async, non-blocking)
4. **Console Output**: Real-time console messages show storage status
5. **Logs**: Detailed logs in application logs

### What Gets Stored

- Case ID
- Top 3 ATM locations with coordinates
- Confidence scores
- Time window predictions
- Model information
- Timestamp

## Method 1: Console Output (Real-Time)

When the application is running, you'll see real-time console output like this:

```
================================================================================
🔗 BLOCKCHAIN STORAGE - 2025-12-09 14:30:45
================================================================================
✅ Case ID: 123e4567-e89b-12d3-a456-426614174000
📊 Locations: 3 ATM predictions
🎯 Confidence: 85.50%
⏱️  Time: 0.45s
🔗 Channel: mychannel
📦 Chaincode: aegis-predictions
================================================================================
```

### Viewing Console Output

```bash
# Run your application
cd backend
python -m uvicorn app.main:app --reload

# Or if using a script
./start_server.bat  # Windows
# or
python app/main.py  # Direct
```

The console will show blockchain operations in real-time as they happen.

## Method 2: Application Logs

Check application logs for detailed information:

```bash
# If using uvicorn, logs appear in console
# Look for lines starting with:
# [BLOCKCHAIN] - Storage operations
# ✅ [BLOCKCHAIN] - Success messages
# ❌ [BLOCKCHAIN] - Error messages
```

### Log Levels

- `🔗 [BLOCKCHAIN]` - Storage initiated
- `📊 [BLOCKCHAIN]` - Data details
- `✅ [BLOCKCHAIN]` - Success
- `❌ [BLOCKCHAIN]` - Failure
- `⏳ [BLOCKCHAIN]` - Queued

## Method 3: Monitoring API Endpoints

### Get Live Status

```bash
curl -X GET "http://localhost:8000/api/v1/predictions/blockchain/monitor/live" \
  -H "Authorization: Bearer <your-token>"
```

Response:
```json
{
  "blockchain_enabled": true,
  "service_enabled": true,
  "recent_operations_count": 5,
  "last_operation": {
    "timestamp": "2025-12-09T14:30:45",
    "operation_type": "store_prediction",
    "case_id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "success"
  },
  "timestamp": "2025-12-09T14:31:00"
}
```

### Get Recent Operations

```bash
curl -X GET "http://localhost:8000/api/v1/predictions/blockchain/monitor/recent?limit=10" \
  -H "Authorization: Bearer <your-token>"
```

Response:
```json
{
  "total": 10,
  "limit": 10,
  "operations": [
    {
      "timestamp": "2025-12-09T14:30:45",
      "operation_type": "store_prediction",
      "case_id": "123e4567-e89b-12d3-a456-426614174000",
      "status": "success",
      "details": {
        "locations_count": 3,
        "confidence": 0.855,
        "elapsed_seconds": 0.45,
        "channel": "mychannel",
        "chaincode": "aegis-predictions"
      }
    }
  ]
}
```

### Get Statistics

```bash
curl -X GET "http://localhost:8000/api/v1/predictions/blockchain/monitor/stats?hours=24" \
  -H "Authorization: Bearer <your-token>"
```

Response:
```json
{
  "period_hours": 24,
  "total_operations": 50,
  "successful": 48,
  "failed": 2,
  "success_rate": 96.0,
  "recent_operations": [...]
}
```

## Method 4: Real-Time Monitoring Script

Use the provided monitoring script for a live dashboard:

```bash
cd backend

# Install rich library if not already installed
pip install rich

# Run monitoring script
python scripts/monitor_blockchain_live.py
```

This will show:
- ✅ Real-time status
- 📊 Statistics (success rate, total operations)
- 🔄 Recent operations table
- ⏱️ Timestamps and details

### Features

- **Auto-refresh**: Updates every 2 seconds
- **Color-coded**: Green for success, red for failures
- **Detailed info**: Shows case IDs, timestamps, confidence scores
- **Statistics**: Success rate, total operations

## Method 5: Direct Blockchain Query

Query the blockchain directly to see stored data:

```bash
# Using Python script
python scripts/view_blockchain_data.py get <case-id>

# Using API
curl -X GET "http://localhost:8000/api/v1/predictions/blockchain/{case_id}" \
  -H "Authorization: Bearer <token>"

# Using peer CLI (if you have access)
peer chaincode query \
  -C mychannel \
  -n aegis-predictions \
  -c '{"function":"GetPrediction","Args":["case-id"]}'
```

## Real-Time Monitoring Setup

### Step 1: Enable Blockchain

In your `.env` file:

```bash
BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_NETWORK_CONFIG=./blockchain/network.yaml
BLOCKCHAIN_USER_NAME=Admin
BLOCKCHAIN_ORG_NAME=Org1
```

### Step 2: Start Application

```bash
cd backend
python -m uvicorn app.main:app --reload
```

### Step 3: Monitor in Real-Time

**Option A: Watch Console**
- Keep the application console open
- Watch for blockchain storage messages

**Option B: Use Monitoring Script**
```bash
# In another terminal
python scripts/monitor_blockchain_live.py
```

**Option C: Poll API**
```bash
# Watch API endpoint
watch -n 2 'curl -s http://localhost:8000/api/v1/predictions/blockchain/monitor/live -H "Authorization: Bearer <token>" | jq'
```

### Step 4: Generate Predictions

Make API calls to generate predictions:

```bash
curl -X GET "http://localhost:8000/api/v1/predictions/case/{case_id}" \
  -H "Authorization: Bearer <token>"
```

You'll see blockchain storage happen in real-time!

## What to Look For

### Success Indicators

✅ Console shows:
```
✅ [BLOCKCHAIN] Successfully stored prediction...
🔗 BLOCKCHAIN STORAGE - [timestamp]
```

✅ API returns:
- `status: "success"` in monitoring endpoints
- Data appears in recent operations

✅ Logs show:
- No error messages
- Transaction details logged

### Failure Indicators

❌ Console shows:
```
❌ BLOCKCHAIN STORAGE FAILED
Error: [error message]
```

❌ API returns:
- `status: "failed"` in operations
- Error details in response

❌ Common Issues:
- Blockchain not enabled
- Network not running
- Connection errors
- Chaincode not deployed

## Troubleshooting

### No Console Output

1. Check blockchain is enabled: `BLOCKCHAIN_ENABLED=true`
2. Verify network is running: `docker ps | grep peer`
3. Check logs for errors

### Operations Not Appearing

1. Verify predictions are being generated
2. Check if blockchain service is initialized
3. Look for error messages in logs

### Monitoring Script Not Working

1. Install rich: `pip install rich`
2. Check API is running: `curl http://localhost:8000/health`
3. Verify authentication token

## Best Practices

1. **Keep Console Open**: Easiest way to see real-time storage
2. **Use Monitoring Script**: Best for detailed monitoring
3. **Check Logs**: For troubleshooting errors
4. **Verify Storage**: Query blockchain to confirm data is stored
5. **Monitor Statistics**: Track success rate over time

## Example Workflow

```bash
# Terminal 1: Start application
cd backend
python -m uvicorn app.main:app --reload

# Terminal 2: Start monitoring
python scripts/monitor_blockchain_live.py

# Terminal 3: Generate predictions
curl -X GET "http://localhost:8000/api/v1/predictions/case/{case_id}" \
  -H "Authorization: Bearer <token>"

# Watch Terminal 1 (console) and Terminal 2 (monitor) for real-time updates
```

## Summary

- **Console Output**: Real-time messages in application console
- **Monitoring Script**: Live dashboard with statistics
- **API Endpoints**: Programmatic access to operations
- **Logs**: Detailed information for debugging
- **Direct Query**: Verify data is actually stored

All methods work simultaneously - use whichever is most convenient for your workflow!

