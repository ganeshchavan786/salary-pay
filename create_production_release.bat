@echo off
echo ========================================================
echo HRMS Production Release Builder (DEBUG MODE)
echo ========================================================
echo.

set RELEASES_BASE=d:\HR\V1\HRMS\Releases
set RELEASE_DIR=%RELEASES_BASE%\HRMS_v1.0

echo [STEP 0] Cleaning up processes...
taskkill /F /IM backend.exe /T 2>nul
taskkill /F /IM node.exe /T 2>nul
timeout /t 2 /nobreak > nul

echo [STEP 0] Creating Release Directory...
mkdir "%RELEASES_BASE%" 2>nul
mkdir "%RELEASE_DIR%" 2>nul
mkdir "%RELEASE_DIR%\public" 2>nul
mkdir "%RELEASE_DIR%\public\admin" 2>nul
mkdir "%RELEASE_DIR%\public\face" 2>nul
mkdir "%RELEASE_DIR%\proxy" 2>nul
echo Done.
pause

echo.
echo [STEP 1] Building Admin Panel Frontend...
cd /d d:\HR\V1\HRMS\admin-panel
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Admin Panel build failed!
    pause
    exit /b %ERRORLEVEL%
)
xcopy /E /Y dist\* "%RELEASE_DIR%\public\admin\"
echo Admin Build Success.
pause

echo.
echo [STEP 2] Building Employee App Frontend...
cd /d d:\HR\V1\HRMS\employee-app
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Employee App build failed!
    pause
    exit /b %ERRORLEVEL%
)
xcopy /E /Y dist\* "%RELEASE_DIR%\public\employee\"
echo Employee Build Success.
pause

echo.
echo [STEP 2.5] Building PWA Face Attendance...
cd /d d:\HR\V1\HRMS\pwa-app
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] PWA build failed!
    pause
    exit /b %ERRORLEVEL%
)
xcopy /E /Y dist\* "%RELEASE_DIR%\public\face\"
echo PWA Build Success.
pause

echo.
echo [STEP 3] Compiling Backend to backend.exe...
cd /d d:\HR\V1\HRMS\backend

echo Installing PyInstaller...
call venv\Scripts\activate.bat
python -m pip install pyinstaller
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] PyInstaller installation failed!
    pause
    exit /b %ERRORLEVEL%
)

echo Running PyInstaller Build...
pyinstaller --onefile --collect-all app --collect-all aiosqlite --collect-all sqlalchemy run_server.py --name backend
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Backend compilation failed!
    pause
    exit /b %ERRORLEVEL%
)

echo Copying backend.exe...
copy /Y dist\backend.exe "%RELEASE_DIR%\"
echo Backend Build Success.
pause

echo.
echo [STEP 4] Setting up Proxy Server...
cd /d d:\HR\V1\HRMS
copy /Y landing.html "%RELEASE_DIR%\"
copy /Y proxy-server-production.js "%RELEASE_DIR%\proxy\proxy-server.js"
copy /Y package.json "%RELEASE_DIR%\proxy\"
echo Proxy Setup Success.

echo.
echo Creating START script for Customer...
cd /d "%RELEASE_DIR%"
echo @echo off > start.bat
echo echo ============================================= >> start.bat
echo echo Starting HRMS Professional v1.0 >> start.bat
echo echo ============================================= >> start.bat
echo echo 1. Starting Backend Server (Port 8401)... >> start.bat
echo start "" /min "backend.exe" >> start.bat
echo timeout /t 3 /nobreak ^> nul >> start.bat
echo echo 2. Installing Frontend Proxy dependencies... >> start.bat
echo cd proxy >> start.bat
echo call npm install --production >> start.bat
echo echo 3. Starting Frontend Web Server (Port 3401)... >> start.bat
echo start "" /min "node" proxy-server.js >> start.bat
echo cd .. >> start.bat
echo echo. >> start.bat
echo echo ============================================= >> start.bat
echo echo ALL SYSTEMS RUNNING IN BACKGROUND! >> start.bat
echo echo Admin Panel: http://localhost:3401/admin >> start.bat
echo echo Employee App: http://localhost:3401/employee >> start.bat
echo echo Face App: http://localhost:3401/face >> start.bat
echo echo ============================================= >> start.bat
echo pause >> start.bat

echo.
echo Creating Background Runner (Hidden Mode)...
cd /d "%RELEASE_DIR%"
echo Set WshShell = CreateObject("WScript.Shell") > run_background.vbs
echo WshShell.Run "cmd.exe /c start.bat", 0 >> run_background.vbs
echo Set WshShell = Nothing >> run_background.vbs

echo.
echo ========================================================
echo SUCCESS! Your Release is ready at: %RELEASE_DIR%
echo ========================================================
pause
