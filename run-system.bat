@echo off
echo ==========================================================
echo Starting Sivakasi Logistics & GDM Management System...
echo ==========================================================
echo.

:: Get current folder path
set BASE_DIR=%~dp0
cd /d "%BASE_DIR%"

echo Launching Backend API Server (Port 5000)...
start "Sivakasi Logistics Backend" cmd /c "cd backend && npm run dev"

echo Launching Frontend Web Dashboard (Port 5173)...
start "Sivakasi Logistics Frontend" cmd /c "cd frontend && npm run dev"

echo Waiting for servers to initialize...
timeout /t 3 >nul

echo Opening browser at http://localhost:5173...
start http://localhost:5173

echo.
echo ==========================================================
echo System running! 
echo - Backend API running at http://localhost:5000
echo - Web Frontend running at http://localhost:5173
echo.
echo To shut down the services, close the opened console windows.
echo ==========================================================
