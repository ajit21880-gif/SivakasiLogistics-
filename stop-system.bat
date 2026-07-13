@echo off
echo ==========================================================
echo Stopping Sivakasi Logistics & GDM Services...
echo ==========================================================
echo.

echo Checking and terminating Backend API Server on Port 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000') do (
    echo Killing process PID %%a
    taskkill /F /PID %%a 2>nul
)

echo Checking and terminating Frontend Vite Server on Port 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    echo Killing process PID %%a
    taskkill /F /PID %%a 2>nul
)

echo.
echo ==========================================================
echo All services stopped successfully!
echo ==========================================================
