# AEGIS Backend - Deployment Guide with Nginx

This guide explains how to deploy the AEGIS backend using nginx as a reverse proxy, making it accessible to frontend developers on your network.

---

## Overview

**Yes, it will work when your computer is on!** Here's how:

1. **Your computer** runs the FastAPI backend (port 8000)
2. **Nginx** acts as a reverse proxy (port 80) and forwards requests to FastAPI
3. **Frontend developers** can access the API through nginx
4. **Your computer must be on** and both services running for it to work

---

## Prerequisites

- Python 3.10+ installed
- Backend dependencies installed (see `SETUP.md`)
- Nginx installed on your Windows machine
- Your computer's firewall configured to allow connections
- Your computer and frontend developers on the same network (or use a tunnel)

---

## Step 1: Install Nginx on Windows

### Option A: Download from Official Site

1. **Download Nginx for Windows**: http://nginx.org/en/download.html
   - **Recommended**: Download **nginx/Windows-1.28.0** (Stable version)
   - Direct link: http://nginx.org/download/nginx-1.28.0.zip
   - Extract the zip file to `C:\nginx` (or your preferred location)
   - **Alternative**: If you want latest features, use nginx/Windows-1.29.3 (Mainline), but stable is recommended

2. **Verify Installation**:
   ```powershell
   cd C:\nginx
   .\nginx.exe
   ```
   - Open browser: http://localhost
   - You should see "Welcome to nginx!" page
   - Stop nginx: `.\nginx.exe -s stop`

### Option B: Using Chocolatey (if installed)
```powershell
choco install nginx
```

---

## Step 2: Configure Nginx

1. **Copy the nginx configuration**:
   - Copy `nginx.conf` from the backend folder
   - Place it in your nginx `conf` directory:
     - Default: `C:\nginx\conf\nginx.conf`
     - Or create: `C:\nginx\conf\sites-available\aegis-backend.conf`

2. **Edit the configuration** (if needed):
   - Open `nginx.conf` in a text editor
   - Change `server_name localhost;` to your computer's IP address or domain
   - Example: `server_name 192.168.1.100;` (your local IP)

3. **Find your computer's IP address**:
   ```powershell
   ipconfig
   ```
   - Look for "IPv4 Address" under your active network adapter
   - Example: `192.168.1.100`

---

## Step 3: Configure Windows Firewall

Allow incoming connections on port 80 (nginx) and optionally 8000 (direct FastAPI access):

```powershell
# Run PowerShell as Administrator

# Allow nginx (port 80)
New-NetFirewallRule -DisplayName "AEGIS Nginx" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow

# Optional: Allow direct FastAPI access (port 8000)
New-NetFirewallRule -DisplayName "AEGIS FastAPI" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

Or use Windows Firewall GUI:
1. Open Windows Defender Firewall
2. Advanced Settings → Inbound Rules → New Rule
3. Port → TCP → Specific local ports: `80` → Allow connection
4. Name: "AEGIS Nginx"

---

## Step 4: Start the Backend Server

### Development Mode (with auto-reload):
```powershell
cd D:\Ageis\backend
.\start_server.bat
```

### Production Mode (multiple workers):
```powershell
cd D:\Ageis\backend
.\start_server_production.bat
```

Or manually:
```powershell
cd D:\Ageis\backend
.\venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Verify it's running**: Open http://localhost:8000/health in your browser

---

## Step 5: Start Nginx

```powershell
cd C:\nginx
.\nginx.exe
```

**Verify nginx is running**:
```powershell
# Check if nginx process is running
tasklist | findstr nginx

# Test nginx configuration
.\nginx.exe -t
```

---

## Step 6: Test the Setup

### On Your Computer:

1. **Test nginx directly**: http://localhost/health
2. **Test API docs**: http://localhost/docs
3. **Test API endpoint**: http://localhost/api/v1/...

### From Another Computer (Frontend Developer):

1. **Find your computer's IP**: (from Step 2)
   - Example: `192.168.1.100`

2. **Test from their computer**:
   - API Health: `http://192.168.1.100/health`
   - API Docs: `http://192.168.1.100/docs`
   - API Endpoint: `http://192.168.1.100/api/v1/...`

---

## Step 7: Configure Frontend to Use Your API

Frontend developers should update their API base URL:

**Development/Testing**:
```typescript
// In frontend config
const API_BASE_URL = "http://192.168.1.100";  // Your computer's IP
// or
const API_BASE_URL = "http://YOUR_COMPUTER_NAME";  // Your computer name
```

**Example**: If your IP is `192.168.1.100`, they would call:
- `http://192.168.1.100/api/v1/cases`
- `http://192.168.1.100/api/v1/auth/login`
- etc.

---

## Making It Accessible Over Internet (Optional)

If frontend developers are not on your local network, you have options:

### Option A: Use ngrok (Easiest)

1. **Install ngrok**: https://ngrok.com/download
2. **Start ngrok tunnel**:
   ```powershell
   ngrok http 80
   ```
3. **Share the ngrok URL** with frontend developers:
   - Example: `https://abc123.ngrok.io`
   - They use: `https://abc123.ngrok.io/api/v1/...`

### Option B: Port Forwarding (Advanced)

1. Configure your router to forward port 80 to your computer
2. Use your public IP address (find it: https://whatismyipaddress.com/)
3. **Security Warning**: Only do this if you have proper security measures!

---

## Managing Services

### Start Services:
```powershell
# Start backend
cd D:\Ageis\backend
.\start_server.bat

# Start nginx (in another terminal)
cd C:\nginx
.\nginx.exe
```

### Stop Services:
```powershell
# Stop backend: Press Ctrl+C in the terminal

# Stop nginx
cd C:\nginx
.\nginx.exe -s stop

# Or force stop
.\nginx.exe -s quit
```

### Reload Nginx (after config changes):
```powershell
cd C:\nginx
.\nginx.exe -s reload
```

---

## Running as Windows Services (Advanced)

To run both services automatically on startup:

### For FastAPI Backend:

1. **Install NSSM** (Non-Sucking Service Manager): https://nssm.cc/download
2. **Create service**:
   ```powershell
   nssm install AEGISBackend "D:\Ageis\backend\venv\Scripts\python.exe" "D:\Ageis\backend\venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000"
   nssm set AEGISBackend AppDirectory "D:\Ageis\backend"
   nssm start AEGISBackend
   ```

### For Nginx:

Nginx can run as a Windows service using the built-in service wrapper or NSSM.

---

## Troubleshooting

### Backend not accessible:

1. **Check if backend is running**:
   ```powershell
   netstat -an | findstr :8000
   ```
   Should show `LISTENING`

2. **Check if nginx is running**:
   ```powershell
   netstat -an | findstr :80
   ```
   Should show `LISTENING`

3. **Check nginx error logs**:
   ```powershell
   type C:\nginx\logs\aegis_error.log
   ```

4. **Test nginx configuration**:
   ```powershell
   cd C:\nginx
   .\nginx.exe -t
   ```

### Frontend can't connect:

1. **Check firewall**: Make sure port 80 is allowed
2. **Check IP address**: Verify you're using the correct IP
3. **Check network**: Ensure both computers are on the same network
4. **Test from your computer first**: `http://localhost/health`

### CORS Errors:

The backend already has CORS configured to allow all origins in debug mode. If you see CORS errors:
- Check `backend/app/main.py` - CORS middleware should allow `["*"]` in debug mode
- Verify `DEBUG=true` in your `.env` file

---

## Security Considerations

⚠️ **Important for Production**:

1. **Change CORS settings**: Don't allow `["*"]` in production
2. **Use HTTPS**: Set up SSL certificates (Let's Encrypt)
3. **Authentication**: Ensure API endpoints are properly secured
4. **Firewall**: Only allow necessary ports
5. **Environment variables**: Never commit `.env` file with real secrets

---

## Quick Reference

| Service | Port | URL (Local) | URL (Network) |
|---------|------|-------------|---------------|
| Nginx | 80 | http://localhost | http://YOUR_IP |
| FastAPI (Direct) | 8000 | http://localhost:8000 | http://YOUR_IP:8000 |
| API Docs | 80 | http://localhost/docs | http://YOUR_IP/docs |
| Health Check | 80 | http://localhost/health | http://YOUR_IP/health |

---

## Summary

✅ **Yes, it will work when your computer is on!**

- Your computer runs the backend (FastAPI on port 8000)
- Nginx proxies requests from port 80 to port 8000
- Frontend developers access via `http://YOUR_IP/api/v1/...`
- Both services must be running
- Your computer must be on and accessible on the network

**For 24/7 access**, consider deploying to a cloud server (AWS, Azure, DigitalOcean, etc.) instead of your local machine.

