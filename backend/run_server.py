import uvicorn
import os
import sys
import aiosqlite
from app.main import app

if __name__ == "__main__":
    # Ensure the 'app' module is in the system path if running from PyInstaller
    if hasattr(sys, '_MEIPASS'):
        sys.path.append(sys._MEIPASS)

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8401"))
    print(f"Starting Backend Server on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
