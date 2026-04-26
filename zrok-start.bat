@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo  Face Attendance - Quick Start
echo ========================================
echo.

REM Check if production builds exist
set "PWA_DIST=%~dp0pwa-app\dist"
set "ADMIN_DIST=%~dp0admin-panel\dist"

if exist "%PWA_DIST%" (
    if exist "%ADMIN_DIST%" (
        echo [INFO] Production builds found.
    ) else (
        echo [INFO] Production builds not found.
    )
) else (
    echo [INFO] Production builds not found.
)

echo.
echo Choose mode:
echo   1. Rebuild for PRODUCTION and start (recommended after code changes)
echo   2. Start with EXISTING build (fast restart, no rebuild)
echo   3. Start in DEVELOPMENT mode (hot reload)
echo.
choice /C 123 /N /M "Enter choice (1, 2 or 3): "

if errorlevel 3 goto :dev_mode
if errorlevel 2 goto :start
if errorlevel 1 goto :build_mode

:build_mode
echo.
echo [INFO] Building production files...
echo.
"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-production.ps1"
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed. Press any key to exit...
    pause >nul
    exit /b 1
)
echo.
echo [INFO] Build complete! Starting application...
goto :start

:dev_mode
echo.
echo [INFO] Starting in DEVELOPMENT mode...
goto :start

:start
echo.
"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-zrok.ps1"
