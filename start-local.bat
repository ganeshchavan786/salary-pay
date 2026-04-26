@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "ROOT=%cd%"
set "PYTHONUTF8=1"

echo.
echo ========================================
echo  Face Attendance - Local (Windows, no Docker)
echo ========================================
echo   API:   http://localhost:8551   (docs: /docs)
echo   PWA:   http://localhost:5173
echo   Admin: http://localhost:3551
echo ========================================
echo.

if not exist "%ROOT%\backend\" (
    echo [ERROR] backend folder missing. Run this file from project root.
    pause
    exit /b 1
)
if not exist "%ROOT%\pwa-app\" (
    echo [ERROR] pwa-app folder missing. Run this file from project root.
    pause
    exit /b 1
)
if not exist "%ROOT%\admin-panel\" (
    echo [ERROR] admin-panel folder missing. Run this file from project root.
    pause
    exit /b 1
)

if not exist "%ROOT%\backend\venv\Scripts\activate.bat" (
    echo [INFO] backend venv not found. Creating virtual environment...
    where py >nul 2>nul
    if errorlevel 1 (
        where python >nul 2>nul
        if errorlevel 1 (
            echo [ERROR] Python not found. Install Python 3.11/3.12/3.13 first.
            pause
            exit /b 1
        )
        python -m venv "%ROOT%\backend\venv"
    ) else (
        py -3 -m venv "%ROOT%\backend\venv"
    )
    if errorlevel 1 (
        echo [ERROR] Failed to create venv.
        pause
        exit /b 1
    )
)

if not exist "%ROOT%\backend\venv\Scripts\python.exe" (
    echo [ERROR] backend python executable missing in venv.
    pause
    exit /b 1
)

echo [INFO] Ensuring backend dependencies...
call "%ROOT%\backend\venv\Scripts\python.exe" -m pip install -r "%ROOT%\backend\requirements-simple.txt"
if errorlevel 1 (
    echo [ERROR] Backend dependencies install failed.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm not found. Install Node.js LTS first.
    pause
    exit /b 1
)

if not exist "%ROOT%\pwa-app\node_modules\" (
    echo [INFO] Installing pwa-app dependencies...
    call npm --prefix "%ROOT%\pwa-app" install
    if errorlevel 1 (
        echo [ERROR] pwa-app npm install failed.
        pause
        exit /b 1
    )
)
if not exist "%ROOT%\admin-panel\node_modules\" (
    echo [INFO] Installing admin-panel dependencies...
    call npm --prefix "%ROOT%\admin-panel" install
    if errorlevel 1 (
        echo [ERROR] admin-panel npm install failed.
        pause
        exit /b 1
    )
)

set "MODEL_MISSING=0"
if not exist "%ROOT%\pwa-app\public\models\ssd_mobilenetv1_model-weights_manifest.json" set "MODEL_MISSING=1"
if not exist "%ROOT%\pwa-app\public\models\ssd_mobilenetv1_model-shard1" set "MODEL_MISSING=1"
if not exist "%ROOT%\pwa-app\public\models\ssd_mobilenetv1_model-shard2" set "MODEL_MISSING=1"
if not exist "%ROOT%\pwa-app\public\models\face_landmark_68_model-weights_manifest.json" set "MODEL_MISSING=1"
if not exist "%ROOT%\pwa-app\public\models\face_landmark_68_model-shard1" set "MODEL_MISSING=1"
if not exist "%ROOT%\pwa-app\public\models\face_recognition_model-weights_manifest.json" set "MODEL_MISSING=1"
if not exist "%ROOT%\pwa-app\public\models\face_recognition_model-shard1" set "MODEL_MISSING=1"
if not exist "%ROOT%\pwa-app\public\models\face_recognition_model-shard2" set "MODEL_MISSING=1"

if "%MODEL_MISSING%"=="1" (
    echo [WARN] Face models missing in pwa-app\public\models.
    echo        Check: pwa-app\public\models\README.md
    echo        App will run, but face recognition will fail until models are added.
)

start "Face Attendance API [8551]" cmd /k cd /d "%ROOT%\backend" ^&^& call venv\Scripts\activate.bat ^&^& python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8551

timeout /t 2 /nobreak >nul

start "PWA [5173]" cmd /k cd /d "%ROOT%\pwa-app" ^&^& npm run dev

start "Admin [3551]" cmd /k cd /d "%ROOT%\admin-panel" ^&^& npm run dev

echo.
echo Three windows started. Default login: admin / admin123
echo Close each window to stop that app.
echo.
pause
endlocal
