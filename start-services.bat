@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "ROOT=%cd%"
set "PYTHONUTF8=1"

echo.
echo ========================================
echo  Face Attendance - Services Only
echo  (Start ngrok separately)
echo ========================================
echo.
echo  After services start, run ngrok manually:
echo    ngrok http 8080
echo  OR use ngrok.yml:
echo    ngrok start --config ngrok.yml attendance
echo ========================================
echo.

:: Start Backend
echo [1/4] Starting Backend API on port 8551...
start "Face Attendance API [8551]" cmd /k cd /d "%ROOT%\backend" ^&^& call venv\Scripts\activate.bat ^&^& python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8551

timeout /t 3 /nobreak >nul

:: Start PWA
echo [2/4] Starting PWA dev server on port 5173...
start "PWA [5173]" cmd /k cd /d "%ROOT%\pwa-app" ^&^& npm run dev

:: Start Admin Panel
echo [3/4] Starting Admin Panel dev server on port 3551...
start "Admin [3551]" cmd /k cd /d "%ROOT%\admin-panel" ^&^& npm run dev

timeout /t 2 /nobreak >nul

:: Start Proxy
echo [4/4] Starting Node.js proxy server on port 8080...
start "Proxy [8080]" cmd /k cd /d "%ROOT%" ^&^& node proxy-server.js

echo.
echo ========================================
echo  Services started!
echo ========================================
echo.
echo  NOW: Open a new terminal and run:
echo    ngrok http 8080
echo.
echo  OR if ngrok.yml is configured:
echo    ngrok start --config ngrok.yml attendance
echo.
echo  Then update backend/.env with your ngrok URL in CORS_ORIGINS.
echo  Default login: admin / admin123
echo.
pause
endlocal
