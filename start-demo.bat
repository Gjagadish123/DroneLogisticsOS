@echo off
cd /d "%~dp0"
echo Drone Logistics OS demo running at http://localhost:8765  (close this window to stop)
start "" http://localhost:8765
python -m http.server 8765
