# How to Start the Server

## ✅ Quick Start

### If you have a virtual environment in parent directory:

```bash
# From project root
cd /Users/deekshi484/Downloads/AEGIS--main

# Activate virtual environment
source .venv/bin/activate

# Navigate to backend
cd backend

# Start server
python -m uvicorn app.main:app --reload
```

### If virtual environment is in backend directory:

```bash
cd backend
source .venv/bin/activate
python -m uvicorn app.main:app --reload
```

### Using the startup script:

```bash
cd backend
./start_server.sh
```

## 🔍 Real-Time Blockchain Monitoring

Once the server is running, you'll see real-time blockchain storage messages in the console when predictions are generated:

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

## 📊 Monitor in Another Terminal

```bash
# Simple monitor
python3 scripts/simple_blockchain_monitor.py

# Advanced monitor (requires: pip install rich)
python3 scripts/monitor_blockchain_live.py
```

## ⚠️ Troubleshooting

### Port 8000 already in use

```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Or use a different port
python -m uvicorn app.main:app --reload --port 8001
```

### uvicorn not found

```bash
# Install in virtual environment
source .venv/bin/activate
pip install "uvicorn[standard]"

# Or install all requirements
pip install -r requirements.txt
```

### Virtual environment location

Your `.venv` is in the parent directory (`/Users/deekshi484/Downloads/AEGIS--main/.venv`), so:

```bash
# From project root
source .venv/bin/activate
cd backend
python -m uvicorn app.main:app --reload
```

