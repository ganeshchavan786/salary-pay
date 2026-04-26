$ErrorActionPreference = "Stop"

# Set ROOT directory
$Root = $PSScriptRoot
if (-not $Root) {
    # Fallback if run directly from console instead of script
    $Root = (Get-Location).Path
}

$env:PYTHONUTF8 = "1"
$ZROK_EXE = "C:\zrok\zrok.exe"

# ======================================================================
# ZROK FIXED URL SETTING
# ======================================================================
# To get a fixed (permanent) URL, you must reserve it once:
# 1. Open Terminal/CMD and run: C:\zrok\zrok.exe reserve public http://localhost:8080
# 2. It will give you a reserved token, e.g., "h87zau70fgxs"
# 3. Paste that token inside the quotes below:
$ZROK_RESERVED_TOKEN = "drne2yi2f6fd" 
# (Leave it empty "" if you want a random URL every time)
# ======================================================================

Write-Host ""
Write-Host "========================================"
Write-Host " Face Attendance - zrok Public Access"
Write-Host "========================================"
if ($ZROK_RESERVED_TOKEN) {
    Write-Host "  PWA:   https://$ZROK_RESERVED_TOKEN.share.zrok.io/"
    Write-Host "  Admin: https://$ZROK_RESERVED_TOKEN.share.zrok.io/admin/"
    Write-Host "  API:   https://$ZROK_RESERVED_TOKEN.share.zrok.io/api/"
} else {
    Write-Host "  (Random URL will be generated. Check the zrok Tunnel tab)"
}
Write-Host "========================================"
Write-Host ""

# ── Pre-flight checks ──────────────────────────────────────────────────────

# Check if production builds exist
$PWA_DIST = "$Root\pwa-app\dist"
$ADMIN_DIST = "$Root\admin-panel\dist"
$PRODUCTION_MODE = $false

if ((Test-Path $PWA_DIST) -and (Test-Path $ADMIN_DIST)) {
    Write-Host "[INFO] Production builds found. Running in PRODUCTION mode." -ForegroundColor Green
    Write-Host "       PWA:   $PWA_DIST" -ForegroundColor Gray
    Write-Host "       Admin: $ADMIN_DIST" -ForegroundColor Gray
    $PRODUCTION_MODE = $true
} else {
    Write-Host "[INFO] Production builds not found. Running in DEV mode." -ForegroundColor Yellow
    Write-Host "       To build for production, run: .\build-production.ps1" -ForegroundColor Yellow
    $PRODUCTION_MODE = $false
}
Write-Host ""

if (-Not (Test-Path $ZROK_EXE)) {
    Write-Host "[ERROR] zrok.exe not found at $ZROK_EXE" -ForegroundColor Red
    Write-Host "        Make sure C:\zrok\zrok.exe exists." -ForegroundColor Yellow
    Pause
    exit 1
}

if (-Not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js not found on PATH." -ForegroundColor Red
    Write-Host "        Install Node.js LTS from https://nodejs.org/" -ForegroundColor Yellow
    Pause
    exit 1
}

if (-Not (Test-Path "$Root\proxy-server.js")) {
    Write-Host "[ERROR] proxy-server.js not found in $Root" -ForegroundColor Red
    Pause
    exit 1
}

if (-Not (Test-Path "$Root\backend")) {
    Write-Host "[ERROR] backend folder missing." -ForegroundColor Red
    Pause
    exit 1
}

if (-Not (Test-Path "$Root\backend\venv\Scripts\activate.bat")) {
    Write-Host "[ERROR] backend venv not found. Run start-local.bat first." -ForegroundColor Red
    Pause
    exit 1
}

if (-Not (Test-Path "$Root\node_modules\http-proxy")) {
    Write-Host "[INFO] Installing proxy dependencies..." -ForegroundColor Cyan
    Set-Location -Path $Root
    cmd /c npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] npm install failed." -ForegroundColor Red
        Pause
        exit 1
    }
}

# ── Build Multi-Tab Command for Windows Terminal ─────────────────────────────

Write-Host "[INFO] Starting services in Windows Terminal..." -ForegroundColor Cyan
Write-Host ""

# Windows terminal command arguments string
# Production mode: Only API + Proxy + zrok (3 tabs)
# Dev mode: API + PWA + Admin + Proxy + zrok (5 tabs)

if ($ZROK_RESERVED_TOKEN) {
    $zrokCommand = "set ZROK_API_ENDPOINT=https://api-v1.zrok.io && C:\zrok\zrok.exe share reserved $ZROK_RESERVED_TOKEN"
} else {
    $zrokCommand = "set ZROK_API_ENDPOINT=https://api-v1.zrok.io && C:\zrok\zrok.exe share public http://localhost:8080"
}

if ($PRODUCTION_MODE) {
    # Production mode: 3 tabs (API, Proxy, zrok)
    $wtArgs = "-w ZrokWindow new-tab --title `"API [8551]`" -d `"$Root\backend`" cmd /k `"call venv\Scripts\activate.bat && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8551`" " +
              "; new-tab --title `"Proxy [8080] - PRODUCTION`" -d `"$Root`" cmd /k `"node proxy-server.js`" " +
              "; new-tab --title `"zrok Tunnel`" -d `"$Root`" cmd /k `"$zrokCommand`""
} else {
    # Dev mode: 5 tabs (API, PWA, Admin, Proxy, zrok)
    $wtArgs = "-w ZrokWindow new-tab --title `"API [8551]`" -d `"$Root\backend`" cmd /k `"call venv\Scripts\activate.bat && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8551`" " +
              "; new-tab --title `"PWA [5173]`" -d `"$Root\pwa-app`" cmd /k `"npm run dev`" " +
              "; new-tab --title `"Admin [3551]`" -d `"$Root\admin-panel`" cmd /k `"npm run dev`" " +
              "; new-tab --title `"Proxy [8080] - DEV`" -d `"$Root`" cmd /k `"node proxy-server.js`" " +
              "; new-tab --title `"zrok Tunnel`" -d `"$Root`" cmd /k `"$zrokCommand`""
}

try {
    Start-Process "wt.exe" -ArgumentList $wtArgs
} catch {
    Write-Host "[WARNING] Windows Terminal (wt.exe) not found. Opening in separate windows..." -ForegroundColor Yellow
    
    if ($PRODUCTION_MODE) {
        # Production mode: 3 windows
        Start-Process "cmd.exe" -ArgumentList "/c start `"API [8551]`" cmd /k `"cd /d `"$Root\backend`" && call venv\Scripts\activate.bat && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8551`""
        Start-Process "cmd.exe" -ArgumentList "/c start `"Proxy [8080] - PRODUCTION`" cmd /k `"cd /d `"$Root`" && node proxy-server.js`""
        Start-Process "cmd.exe" -ArgumentList "/c start `"zrok Tunnel`" cmd /k `"cd /d `"$Root`" && $zrokCommand`""
    } else {
        # Dev mode: 5 windows
        Start-Process "cmd.exe" -ArgumentList "/c start `"API [8551]`" cmd /k `"cd /d `"$Root\backend`" && call venv\Scripts\activate.bat && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8551`""
        Start-Process "cmd.exe" -ArgumentList "/c start `"PWA [5173]`" cmd /k `"cd /d `"$Root\pwa-app`" && npm run dev`""
        Start-Process "cmd.exe" -ArgumentList "/c start `"Admin [3551]`" cmd /k `"cd /d `"$Root\admin-panel`" && npm run dev`""
        Start-Process "cmd.exe" -ArgumentList "/c start `"Proxy [8080] - DEV`" cmd /k `"cd /d `"$Root`" && node proxy-server.js`""
        Start-Process "cmd.exe" -ArgumentList "/c start `"zrok Tunnel`" cmd /k `"cd /d `"$Root`" && $zrokCommand`""
    }
}

Write-Host "========================================"
if ($PRODUCTION_MODE) {
    Write-Host " All services started! (PRODUCTION MODE)"
} else {
    Write-Host " All services started! (DEV MODE)"
}
Write-Host "========================================"
Write-Host ""
Write-Host " NEXT STEPS:"
Write-Host " 1. Look at the `"zrok Tunnel`" tab for your public URL"
Write-Host "    e.g. https://abc123.share.zrok.io"
Write-Host ""
Write-Host " 2. Update backend\.env:"
Write-Host "    CORS_ORIGINS=http://localhost:5173,http://localhost:3551,https://abc123.share.zrok.io"
Write-Host "    Then RESTART the API tab."
Write-Host ""
Write-Host " 3. Share the URL with your team!"
Write-Host "    PWA (employees): https://abc123.share.zrok.io/"
Write-Host "    Admin Panel:     https://abc123.share.zrok.io/admin/"
Write-Host "    API Docs:        https://abc123.share.zrok.io/api/docs"
Write-Host ""
if ($PRODUCTION_MODE) {
    Write-Host " MODE: Production (serving built files)"
    Write-Host "       Faster, optimized, ready for deployment"
} else {
    Write-Host " MODE: Development (hot reload enabled)"
    Write-Host "       To switch to production mode, run: .\build-production.ps1"
}
Write-Host ""
Write-Host " Default login: admin / admin123"
Write-Host ""
Start-Sleep -Seconds 2
exit 0
