# Quick Start: Deploy Backend with Nginx

**TL;DR**: Yes, it will work when your computer is on! Frontend developers can access your API through nginx.

---

## 🚀 Quick Setup (5 Minutes)

### 1. Install Nginx
- Download: **nginx/Windows-1.28.0** (Stable) from http://nginx.org/en/download.html
- Direct link: http://nginx.org/download/nginx-1.28.0.zip
- Extract to `C:\nginx`
- Test: `cd C:\nginx; .\nginx.exe` → Open http://localhost

### 2. Configure Nginx
- Copy `nginx.conf` to `C:\nginx\conf\nginx.conf`
- Find your IP: `ipconfig` (look for IPv4 Address)
- Edit `nginx.conf`: Change `server_name localhost;` to your IP (optional)

### 3. Allow Firewall
```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "AEGIS Nginx" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
```

### 4. Start Services

**Terminal 1 - Backend:**
```powershell
cd D:\Ageis\backend
.\start_server.bat
```

**Terminal 2 - Nginx:**
```powershell
cd C:\nginx
.\nginx.exe
```

### 5. Test
- Your computer: http://localhost/health
- Frontend devs: http://YOUR_IP/health (replace YOUR_IP with your actual IP)

---

## 📋 What Frontend Developers Need

Give them this information:

```
API Base URL: http://YOUR_IP
API Docs: http://YOUR_IP/docs
Health Check: http://YOUR_IP/health

Example endpoints:
- POST http://YOUR_IP/api/v1/auth/login
- GET http://YOUR_IP/api/v1/cases
- POST http://YOUR_IP/api/v1/public/complaints
```

**To find YOUR_IP:**
```powershell
ipconfig
# Look for "IPv4 Address" (e.g., 192.168.1.100)
```

---

## ✅ Verify Everything Works

Run the verification script:
```powershell
cd D:\Ageis\backend
.\verify_deployment.ps1
```

---

## 🔧 Common Issues

**Frontend can't connect:**
- ✅ Is your computer on?
- ✅ Are both services running? (backend + nginx)
- ✅ Is firewall allowing port 80?
- ✅ Are they using the correct IP address?
- ✅ Are they on the same network?

**Backend not accessible:**
- Check backend: http://localhost:8000/health
- Check nginx: http://localhost/health
- Check nginx logs: `C:\nginx\logs\aegis_error.log`

---

## 📚 Full Documentation

See `DEPLOYMENT.md` for complete setup instructions.

---

## 🎯 Summary

✅ **Yes, it works when your computer is on!**

- Backend runs on port 8000 (your computer)
- Nginx proxies from port 80 to 8000
- Frontend devs access via `http://YOUR_IP`
- Both services must be running
- Your computer must be on and accessible

**For 24/7 access**, consider cloud deployment instead.

