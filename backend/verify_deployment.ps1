# AEGIS Backend - Deployment Verification Script
# This script checks if all services are running correctly

Write-Host "AEGIS Backend Deployment Verification" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check 1: Backend Server (Port 8000)
Write-Host "1. Checking Backend Server (Port 8000)..." -ForegroundColor Yellow
$backendCheck = Test-NetConnection -ComputerName localhost -Port 8000 -WarningAction SilentlyContinue
if ($backendCheck.TcpTestSucceeded) {
    Write-Host "   ✓ Backend server is running on port 8000" -ForegroundColor Green
    
    # Try to get health endpoint
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "   ✓ Backend health check passed" -ForegroundColor Green
        }
    } catch {
        Write-Host "   ⚠ Backend is running but health check failed" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ✗ Backend server is NOT running on port 8000" -ForegroundColor Red
    Write-Host "     Start it with: .\start_server.bat" -ForegroundColor Yellow
    $allGood = $false
}

Write-Host ""

# Check 2: Nginx (Port 80)
Write-Host "2. Checking Nginx (Port 80)..." -ForegroundColor Yellow
$nginxCheck = Test-NetConnection -ComputerName localhost -Port 80 -WarningAction SilentlyContinue
if ($nginxCheck.TcpTestSucceeded) {
    Write-Host "   ✓ Nginx is running on port 80" -ForegroundColor Green
    
    # Try to get health endpoint through nginx
    try {
        $response = Invoke-WebRequest -Uri "http://localhost/health" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "   ✓ Nginx proxy is working correctly" -ForegroundColor Green
        }
    } catch {
        Write-Host "   ⚠ Nginx is running but proxy may not be configured correctly" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ✗ Nginx is NOT running on port 80" -ForegroundColor Red
    Write-Host "     Start it with: cd C:\nginx; .\nginx.exe" -ForegroundColor Yellow
    $allGood = $false
}

Write-Host ""

# Check 3: Get IP Address
Write-Host "3. Network Configuration..." -ForegroundColor Yellow
$ipAddresses = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1
if ($ipAddresses) {
    $localIP = $ipAddresses.IPAddress
    Write-Host "   Your IP Address: $localIP" -ForegroundColor Cyan
    Write-Host "   Frontend developers should use: http://$localIP" -ForegroundColor Cyan
} else {
    Write-Host "   ⚠ Could not determine IP address" -ForegroundColor Yellow
}

Write-Host ""

# Check 4: Firewall Rules
Write-Host "4. Checking Firewall Rules..." -ForegroundColor Yellow
$firewallRule80 = Get-NetFirewallRule -DisplayName "*AEGIS*" -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*80*" -or $_.DisplayName -like "*Nginx*" }
if ($firewallRule80) {
    Write-Host "   ✓ Firewall rule for port 80 found" -ForegroundColor Green
} else {
    Write-Host "   ⚠ No firewall rule found for port 80" -ForegroundColor Yellow
    Write-Host "     You may need to allow port 80 in Windows Firewall" -ForegroundColor Yellow
}

Write-Host ""

# Check 5: Test API Endpoint
Write-Host "5. Testing API Endpoint..." -ForegroundColor Yellow
try {
    $apiResponse = Invoke-WebRequest -Uri "http://localhost/api/v1" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✓ API endpoint is accessible through nginx" -ForegroundColor Green
} catch {
    Write-Host "   ⚠ API endpoint test failed" -ForegroundColor Yellow
    Write-Host "     Error: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""

# Summary
Write-Host "=====================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "✓ All services are running!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your API is accessible at:" -ForegroundColor Cyan
    Write-Host "  Local:  http://localhost" -ForegroundColor White
    if ($localIP) {
        Write-Host "  Network: http://$localIP" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "API Documentation:" -ForegroundColor Cyan
    Write-Host "  http://localhost/docs" -ForegroundColor White
} else {
    Write-Host "⚠ Some services are not running. Please check the errors above." -ForegroundColor Yellow
}
Write-Host ""

