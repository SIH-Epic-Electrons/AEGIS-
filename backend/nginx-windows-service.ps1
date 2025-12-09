# PowerShell script to install nginx as a Windows service
# Run this script as Administrator

$nginxPath = "C:\nginx"
$serviceName = "nginx"

Write-Host "Installing Nginx as Windows Service..." -ForegroundColor Green

# Check if nginx exists
if (-not (Test-Path "$nginxPath\nginx.exe")) {
    Write-Host "ERROR: Nginx not found at $nginxPath" -ForegroundColor Red
    Write-Host "Please install nginx first or update the path in this script." -ForegroundColor Yellow
    exit 1
}

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Check if NSSM is installed (Non-Sucking Service Manager)
$nssmPath = Get-Command nssm -ErrorAction SilentlyContinue
if (-not $nssmPath) {
    Write-Host "NSSM not found. Installing NSSM..." -ForegroundColor Yellow
    
    # Try to install via Chocolatey
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        choco install nssm -y
    } else {
        Write-Host "Please install NSSM manually:" -ForegroundColor Yellow
        Write-Host "1. Download from: https://nssm.cc/download" -ForegroundColor Yellow
        Write-Host "2. Extract and add to PATH" -ForegroundColor Yellow
        Write-Host "3. Or install Chocolatey and run: choco install nssm" -ForegroundColor Yellow
        exit 1
    }
}

# Check if service already exists
$existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "Service '$serviceName' already exists. Removing..." -ForegroundColor Yellow
    nssm stop $serviceName
    nssm remove $serviceName confirm
    Start-Sleep -Seconds 2
}

# Install nginx as service
Write-Host "Installing nginx service..." -ForegroundColor Green
nssm install $serviceName "$nginxPath\nginx.exe"
nssm set $serviceName AppDirectory $nginxPath
nssm set $serviceName Description "Nginx Web Server for AEGIS Backend"
nssm set $serviceName Start SERVICE_AUTO_START
nssm set $serviceName AppStdout "$nginxPath\logs\service.log"
nssm set $serviceName AppStderr "$nginxPath\logs\service_error.log"

# Start the service
Write-Host "Starting nginx service..." -ForegroundColor Green
Start-Service $serviceName

# Verify
Start-Sleep -Seconds 2
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($service -and $service.Status -eq "Running") {
    Write-Host "SUCCESS: Nginx service installed and running!" -ForegroundColor Green
    Write-Host "Service Name: $serviceName" -ForegroundColor Cyan
    Write-Host "Status: $($service.Status)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Useful commands:" -ForegroundColor Yellow
    Write-Host "  Start:   Start-Service $serviceName" -ForegroundColor White
    Write-Host "  Stop:    Stop-Service $serviceName" -ForegroundColor White
    Write-Host "  Restart: Restart-Service $serviceName" -ForegroundColor White
    Write-Host "  Status:  Get-Service $serviceName" -ForegroundColor White
} else {
    Write-Host "WARNING: Service installed but may not be running." -ForegroundColor Yellow
    Write-Host "Check the service status: Get-Service $serviceName" -ForegroundColor Yellow
}

