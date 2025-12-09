# AEGIS Backend API - Team Access Guide

## 🌐 API Base URL

**For Frontend Developers:**

```
http://192.168.137.248
```

**Important Notes:**
- This server is running on a local development machine
- The server must be **ON** and both services running for API to work
- All team members must be on the **same network** (same WiFi/router)

---

## 📋 API Endpoints

### Base URL
```
http://192.168.137.248
```

### Common Endpoints

| Endpoint | Description | Method |
|----------|-------------|--------|
| `/health` | Health check | GET |
| `/docs` | API Documentation (Swagger UI) | GET |
| `/redoc` | Alternative API Docs (ReDoc) | GET |
| `/api/v1/auth/login` | Officer login | POST |
| `/api/v1/cases` | Get all cases | GET |
| `/api/v1/public/complaints` | Submit complaint (public) | POST |

### Full API Documentation
Visit: **http://192.168.137.248/docs**

---

## 🔧 Frontend Configuration

### Update API Base URL in Frontend

**Option 1: Environment Variable**
```typescript
// .env or config file
const API_BASE_URL = "http://192.168.137.248";
```

**Option 2: Direct Configuration**
```typescript
// In your API service file
const API_BASE_URL = "http://192.168.137.248";
const API_V1_BASE = `${API_BASE_URL}/api/v1`;
```

**Example API Calls:**
```typescript
// Login
POST http://192.168.137.248/api/v1/auth/login
Body: { "username": "...", "password": "..." }

// Get cases
GET http://192.168.137.248/api/v1/cases
Headers: { "Authorization": "Bearer <token>" }

// Submit complaint
POST http://192.168.137.248/api/v1/public/complaints
Body: { ...complaint data... }
```

---

## ✅ Testing Connection

### Quick Test
1. Open browser: http://192.168.137.248/health
2. Should see: `{"status":"healthy",...}`

### API Documentation
1. Open browser: http://192.168.137.248/docs
2. Should see Swagger UI with all API endpoints

---

## ⚠️ Troubleshooting

### Can't Connect?

1. **Check if server is running:**
   - Ask the backend developer if services are up
   - Try: http://192.168.137.248/health

2. **Check network:**
   - Are you on the same WiFi/network?
   - Try pinging: `ping 192.168.137.248`

3. **Check firewall:**
   - Backend developer needs to allow port 80 in Windows Firewall

4. **CORS Errors:**
   - Backend is configured to allow all origins in debug mode
   - If you see CORS errors, contact backend developer

### Common Issues

| Issue | Solution |
|-------|----------|
| Connection refused | Server is not running or firewall blocking |
| Timeout | Wrong IP address or not on same network |
| CORS error | Backend CORS settings (should work in debug mode) |
| 502 Bad Gateway | Backend server (port 8000) is not running |

---

## 📞 Contact

If you have issues connecting:
1. Verify the IP address is correct: `192.168.137.248`
2. Check if you're on the same network
3. Try accessing http://192.168.137.248/health in browser
4. Contact the backend developer

---

## 🔄 Alternative: If IP Changes

If the server IP address changes, the backend developer will share the new IP. Update your API_BASE_URL accordingly.

**To find current IP (for backend developer):**
```powershell
ipconfig
# Look for IPv4 Address under your active network adapter
```

---

**Last Updated:** [Current Date]  
**Server IP:** 192.168.137.248  
**Status:** Development Server

