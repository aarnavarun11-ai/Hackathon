@echo off
REM GhostFit launcher: serves this folder at http://localhost:8000 and opens it in your browser.
REM Camera and voice input work most reliably from http://localhost (not by double-clicking index.html).
cd /d "%~dp0"
echo.
echo   Starting GhostFit at http://localhost:8000
echo   Keep this window open while you use GhostFit. Close it to stop.
echo.
REM open the browser after the server has had 2 seconds to start
start "" /min cmd /c "timeout /t 2 >nul & start "" http://localhost:8000/index.html"
python -c "import sys" >nul 2>nul && (python -m http.server 8000 --bind 127.0.0.1 & goto :eof)
py -c "import sys" >nul 2>nul && (py -m http.server 8000 --bind 127.0.0.1 & goto :eof)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
