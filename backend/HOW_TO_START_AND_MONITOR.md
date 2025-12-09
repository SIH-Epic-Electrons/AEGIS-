# How to Start Server and Monitor Blockchain in Real-Time

## ✅ Quick Start

### Step 1: Install Dependencies (if needed)

```bash
cd backend

# Install uvicorn and fastapi (if not already installed)
python3 -m pip install "uvicorn[standard]" fastapi

# Or install all requirements
python3 -m pip install -r requirements.txt
```

### Step 2: Start the Server

**Option A: Using the startup script**
```bash
cd backend
./start_server.sh
```

**Option B: Direct command**
```bash
cd backend
python3 -m uvicorn app.main:app --reload
```

**Option C: Using Python module**
```bash
cd backend
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 3: Monitor Blockchain Storage

**In the same console**, you'll see real-time blockchain storage messages:

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

**Or use a monitoring script in another terminal:**

```bash
# Simple monitor
python3 scripts/simple_blockchain_monitor.py

# Advanced monitor (requires: pip install rich)
python3 scripts/monitor_blockchain_live.py
```

## 🔍 What to Watch For

### When a Prediction is Generated

1. **API Call**: `GET /api/v1/predictions/case/{case_id}`
2. **Console Shows**:
   ```
   🚀 [BLOCKCHAIN] Initiating blockchain storage for case {case_id}
   📋 [BLOCKCHAIN] Prediction data prepared: 3 locations
   ⏳ [BLOCKCHAIN] Blockchain storage task queued for case {case_id}
   ```
3. **Storage Happens** (async):
   ```
   🔗 [BLOCKCHAIN] Storing prediction for case {case_id} on blockchain...
   📊 [BLOCKCHAIN] Data: 3 ATM locations, confidence: 85.50%
   ✅ [BLOCKCHAIN] Successfully stored prediction... (took 0.45s)
   ```
4. **Console Output**:
   ```
   ================================================================================
   🔗 BLOCKCHAIN STORAGE - [timestamp]
   ================================================================================
   ✅ Case ID: {case_id}
   📊 Locations: 3 ATM predictions
   🎯 Confidence: 85.50%
   ⏱️  Time: 0.45s
   ================================================================================
   ```

## 📊 Monitoring Endpoints

While server is running, you can check:

```bash
# Live status
curl http://localhost:8000/api/v1/predictions/blockchain/monitor/live \
  -H "Authorization: Bearer <token>"

# Recent operations
curl http://localhost:8000/api/v1/predictions/blockchain/monitor/recent?limit=10 \
  -H "Authorization: Bearer <token>"

# Statistics
curl http://localhost:8000/api/v1/predictions/blockchain/monitor/stats?hours=24 \
  -H "Authorization: Bearer <token>"
```

## 🎯 Testing Real-Time Storage

1. **Start server** (see Step 2 above)
2. **Make a prediction API call**:
   ```bash
   curl -X GET "http://localhost:8000/api/v1/predictions/case/{case_id}" \
     -H "Authorization: Bearer <your-token>"
   ```
3. **Watch console** - you'll see blockchain storage happen in real-time!

## ⚙️ Configuration

Make sure blockchain is enabled in `.env`:

```bash
BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_NETWORK_CONFIG=./blockchain/network.yaml
BLOCKCHAIN_USER_NAME=Admin
BLOCKCHAIN_ORG_NAME=Org1
```

## 🐛 Troubleshooting

### "No module named uvicorn"
```bash
python3 -m pip install "uvicorn[standard]"
```

### "python: command not found"
Use `python3` instead of `python`:
```bash
python3 -m uvicorn app.main:app --reload
```

### No blockchain output in console
- Check `BLOCKCHAIN_ENABLED=true` in `.env`
- Verify Fabric network is running: `docker ps | grep peer`
- Check logs for errors

### Server won't start
- Check Python version: `python3 --version` (needs 3.10+)
- Install dependencies: `python3 -m pip install -r requirements.txt`
- Check port 8000 is available

## 📝 Summary

1. **Start**: `python3 -m uvicorn app.main:app --reload`
2. **Watch**: Console shows real-time blockchain storage
3. **Monitor**: Use scripts or API endpoints
4. **Test**: Make prediction API calls and watch storage happen!

For detailed monitoring guide, see [REALTIME_BLOCKCHAIN_MONITORING.md](./REALTIME_BLOCKCHAIN_MONITORING.md)

