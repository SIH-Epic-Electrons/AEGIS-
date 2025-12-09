#!/bin/bash

# AEGIS Backend Server Startup Script

cd "$(dirname "$0")"

echo "Starting AEGIS Backend Server..."
echo ""

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: python3 not found. Please install Python 3.10+"
    exit 1
fi

# Check if virtual environment exists
if [ -d ".venv" ]; then
    echo "📦 Activating virtual environment..."
    source .venv/bin/activate
    PYTHON_CMD="python"
else
    echo "⚠️  No virtual environment found. Using system Python."
    echo "   Consider creating one: python3 -m venv .venv"
    PYTHON_CMD="python3"
fi

# Check if uvicorn is installed
if ! $PYTHON_CMD -c "import uvicorn" 2>/dev/null; then
    echo "📥 Installing uvicorn..."
    $PYTHON_CMD -m pip install --quiet "uvicorn[standard]" fastapi
fi

# Check if requirements are installed
if [ -f "requirements.txt" ]; then
    echo "📦 Checking dependencies..."
    $PYTHON_CMD -m pip install --quiet -r requirements.txt 2>/dev/null || echo "⚠️  Some dependencies may be missing"
fi

# Check if port 8000 is in use
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 8000 is already in use. Attempting to free it..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null
    sleep 1
fi

echo ""
echo "🚀 Starting server..."
echo "   API Docs: http://localhost:8000/docs"
echo "   Health: http://localhost:8000/health"
echo "   Press Ctrl+C to stop"
echo ""

# Start server
$PYTHON_CMD -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

