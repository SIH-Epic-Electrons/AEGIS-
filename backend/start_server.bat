@echo off
REM AEGIS Backend - Windows Startup Script
REM This script starts the FastAPI server with uvicorn

echo Starting AEGIS Backend Server...
echo.

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Check if virtual environment is activated
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment!
    echo Make sure you have created the virtual environment first.
    echo Run: python -m venv venv
    pause
    exit /b 1
)

REM Start the server
echo Starting uvicorn server on port 8000...
echo API will be available at: http://localhost:8000
echo API Docs will be available at: http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server
echo.

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

pause

