@echo off
cd /d "%~dp0"
echo.
echo PulseBurn local server
echo Open in browser: http://127.0.0.1:8080/
echo Close this window to stop the server.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"
pause
