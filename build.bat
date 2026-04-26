@echo off
echo.
echo ========================================
echo  Building Production Files
echo ========================================
echo.
"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-production.ps1"
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed.
    pause
    exit /b 1
)
echo.
echo [SUCCESS] Build complete!
echo.
echo Next: Run zrok-start.bat to start the application
echo.
pause
