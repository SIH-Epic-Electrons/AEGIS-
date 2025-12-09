# AEGIS Backend - Nginx Setup Script
# This script helps you configure nginx for the AEGIS backend

Write-Host "AEGIS Backend - Nginx Configuration Setup" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Check if nginx is installed
$nginxPath = "C:\nginx"
if (-not (Test-Path "$nginxPath\nginx.exe")) {
    Write-Host "ERROR: Nginx not found at $nginxPath" -ForegroundColor Red
    Write-Host "Please install nginx first or update the path in this script." -ForegroundColor Yellow
    exit 1
}

Write-Host "Step 1: Stopping nginx..." -ForegroundColor Yellow
cd $nginxPath
.\nginx.exe -s stop 2>$null
Start-Sleep -Seconds 2
Write-Host "✓ Nginx stopped" -ForegroundColor Green
Write-Host ""

# Backup existing config
Write-Host "Step 2: Backing up existing nginx.conf..." -ForegroundColor Yellow
$configPath = "$nginxPath\conf\nginx.conf"
if (Test-Path $configPath) {
    $backupPath = "$nginxPath\conf\nginx.conf.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $configPath $backupPath
    Write-Host "✓ Backup created: $backupPath" -ForegroundColor Green
} else {
    Write-Host "⚠ No existing config found" -ForegroundColor Yellow
}
Write-Host ""

# Copy new config
Write-Host "Step 3: Copying AEGIS nginx configuration..." -ForegroundColor Yellow
$sourceConfig = Join-Path $PSScriptRoot "nginx.conf"
if (-not (Test-Path $sourceConfig)) {
    Write-Host "ERROR: nginx.conf not found in backend folder!" -ForegroundColor Red
    Write-Host "Make sure you're running this from the backend directory." -ForegroundColor Yellow
    exit 1
}

# Read the source config
$configContent = Get-Content $sourceConfig -Raw

# Check if we need to merge with existing config or replace
$existingConfig = ""
if (Test-Path $configPath) {
    $existingConfig = Get-Content $configPath -Raw
}

# If existing config has http block, we need to merge
if ($existingConfig -match "http\s*\{") {
    Write-Host "⚠ Existing nginx.conf has http block. We'll replace the server block." -ForegroundColor Yellow
    Write-Host "   The backup has been saved, so you can restore if needed." -ForegroundColor Yellow
    
    # Try to preserve the http block structure
    if ($existingConfig -match "(?s)(.*?http\s*\{)(.*?)(\})") {
        $httpStart = $matches[1]
        $httpContent = $matches[2]
        $httpEnd = $matches[3]
        
        # Replace the entire config with our new one
        # But first, let's check if there's an include directive we should preserve
        $newConfig = $configContent
    }
}

# Write the new config
Set-Content -Path $configPath -Value $configContent -Encoding UTF8
Write-Host "✓ Configuration copied to $configPath" -ForegroundColor Green
Write-Host ""

# Test nginx configuration
Write-Host "Step 4: Testing nginx configuration..." -ForegroundColor Yellow
cd $nginxPath
$testResult = .\nginx.exe -t 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Nginx configuration is valid!" -ForegroundColor Green
} else {
    Write-Host "✗ Nginx configuration has errors:" -ForegroundColor Red
    Write-Host $testResult -ForegroundColor Red
    Write-Host ""
    Write-Host "You may need to manually edit the config file." -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Get IP address
Write-Host "Step 5: Network Information..." -ForegroundColor Yellow
$ipAddresses = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" 
} | Select-Object -First 1

if ($ipAddresses) {
    $localIP = $ipAddresses.IPAddress
    Write-Host "✓ Your IP Address: $localIP" -ForegroundColor Green
    Write-Host "  Frontend developers should use: http://$localIP" -ForegroundColor Cyan
} else {
    Write-Host "⚠ Could not determine IP address" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "✓ Nginx configuration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Start your backend server:" -ForegroundColor White
Write-Host "   cd D:\Ageis\backend" -ForegroundColor Gray
Write-Host "   .\start_server.bat" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Start nginx:" -ForegroundColor White
Write-Host "   cd C:\nginx" -ForegroundColor Gray
Write-Host "   .\nginx.exe" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Test the setup:" -ForegroundColor White
Write-Host "   http://localhost/health" -ForegroundColor Gray
Write-Host "   http://localhost/docs" -ForegroundColor Gray
Write-Host ""
if ($localIP) {
    Write-Host "4. Share with frontend developers:" -ForegroundColor White
    Write-Host "   http://$localIP" -ForegroundColor Cyan
}
Write-Host ""

