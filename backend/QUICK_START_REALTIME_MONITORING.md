# Quick Start: Real-Time Blockchain Monitoring

## 🚀 Quick Setup (3 Steps)

### Step 1: Enable Blockchain

Add to `.env`:
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

**Watch the console** - you'll see real-time blockchain storage messages like:

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

### Step 3: Monitor (Choose One)

**Option A: Simple Monitor (No extra dependencies)**
```bash
# In another terminal
python scripts/simple_blockchain_monitor.py
```

**Option B: Advanced Monitor (Requires rich library)**
```bash
pip install rich
python scripts/monitor_blockchain_live.py
```

**Option C: API Endpoint**
```bash
curl http://localhost:8000/api/v1/predictions/blockchain/monitor/live \
  -H "Authorization: Bearer <token>"
```

## 📊 What You'll See

### Console Output (Application)
- Real-time storage messages
- Success/failure indicators
- Timing information
- Case IDs and details

### Monitoring Script
- Live dashboard
- Recent operations table
- Statistics (success rate, counts)
- Auto-refreshing every 2 seconds

### API Endpoints
- `/api/v1/predictions/blockchain/monitor/live` - Current status
- `/api/v1/predictions/blockchain/monitor/recent` - Recent operations
- `/api/v1/predictions/blockchain/monitor/stats` - Statistics

## 🔄 How It Works

1. **API Call**: `GET /api/v1/predictions/case/{case_id}`
2. **Prediction Generated**: AI creates prediction
3. **Auto-Storage**: Data stored on blockchain (async)
4. **Real-Time Output**: Console shows storage status
5. **Monitoring**: Script/API shows operations

## ✅ Success Indicators

- Console shows: `✅ [BLOCKCHAIN] Successfully stored...`
- Monitoring shows: `status: "success"`
- No error messages in logs

## ❌ Troubleshooting

**No console output?**
- Check `BLOCKCHAIN_ENABLED=true` in `.env`
- Verify network is running: `docker ps | grep peer`

**Monitoring script not working?**
- Check API is running: `curl http://localhost:8000/health`
- Install dependencies: `pip install requests` (and `rich` for advanced monitor)

## 📚 Full Documentation

See [REALTIME_BLOCKCHAIN_MONITORING.md](./REALTIME_BLOCKCHAIN_MONITORING.md) for detailed guide.

