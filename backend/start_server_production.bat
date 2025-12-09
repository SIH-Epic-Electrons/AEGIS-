@echo off
REM AEGIS Backend - Production Startup Script (Windows)
REM This script starts the FastAPI server with multiple workers for production

echo Starting AEGIS Backend Server (Production Mode)...
echo.

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Check if virtual environment is activated
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment!
    echo Make sure you have created the virtual environment first.
    pause
    exit /b 1
)

REM Start the server with multiple workers
echo Starting uvicorn server with 4 workers on port 8000...
echo API will be available at: http://localhost:8000
echo.
echo Press Ctrl+C to stop the server
echo.

uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4

pause

