$ErrorActionPreference = "Stop"

# Set ROOT directory
$Root = $PSScriptRoot
if (-not $Root) {
    $Root = (Get-Location).Path
}

Write-Host ""
Write-Host "========================================"
Write-Host " Building Production Apps"
Write-Host "========================================"
Write-Host ""

# ── Build PWA App ──────────────────────────────────────────────────────
Write-Host "[1/2] Building PWA App..." -ForegroundColor Cyan
Set-Location -Path "$Root\pwa-app"

if (-Not (Test-Path "node_modules")) {
    Write-Host "      Installing PWA dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] PWA npm install failed." -ForegroundColor Red
        exit 1
    }
}

Write-Host "      Running build..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] PWA build failed." -ForegroundColor Red
    exit 1
}

if (Test-Path "dist") {
    Write-Host "      ✅ PWA built successfully → pwa-app\dist" -ForegroundColor Green
} else {
    Write-Host "[ERROR] PWA dist folder not created." -ForegroundColor Red
    exit 1
}

# ── Build Admin Panel ──────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/2] Building Admin Panel..." -ForegroundColor Cyan
Set-Location -Path "$Root\admin-panel"

if (-Not (Test-Path "node_modules")) {
    Write-Host "      Installing Admin dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Admin npm install failed." -ForegroundColor Red
        exit 1
    }
}

Write-Host "      Running build..." -ForegroundColor Yellow
npm run build:ngrok
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Admin build failed." -ForegroundColor Red
    exit 1
}

if (Test-Path "dist") {
    Write-Host "      ✅ Admin Panel built successfully → admin-panel\dist" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Admin dist folder not created." -ForegroundColor Red
    exit 1
}

# ── Build Employee App ─────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/3] Building Employee App..." -ForegroundColor Cyan
Set-Location -Path "$Root\employee-app"

if (-Not (Test-Path "node_modules")) {
    Write-Host "      Installing Employee dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Employee npm install failed." -ForegroundColor Red
        exit 1
    }
}

Write-Host "      Running build..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Employee build failed." -ForegroundColor Red
    exit 1
}

if (Test-Path "dist") {
    Write-Host "      ✅ Employee App built successfully → employee-app\dist" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Employee dist folder not created." -ForegroundColor Red
    exit 1
}

# ── Done ───────────────────────────────────────────────────────────────
Set-Location -Path $Root

Write-Host ""
Write-Host "========================================"
Write-Host " ✅ Production Build Complete!"
Write-Host "========================================"
Write-Host ""
Write-Host " Built files:"
Write-Host "   PWA:   $Root\pwa-app\dist"
Write-Host "   Admin: $Root\admin-panel\dist"
Write-Host ""
Write-Host " Next: Run start-zrok.ps1 to start the application"
Write-Host ""

exit 0
