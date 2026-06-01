@echo off
title SmartPO Dashboard Launcher (Mock Mode)
echo ========================================================
echo   SmartPO Dashboard - One-Click Launcher (Mock Mode)
echo ========================================================
echo.

echo [1/3] Starting Express Mock API server (Port: 5000)...
start cmd /k "cd backend && npm run dev"

echo [2/3] Starting Vite Frontend server (Port: 5173)...
start cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo [3/3] Launching web browser...
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo ========================================================
echo   Services started successfully in background windows!
echo   You can close this window now.
echo ========================================================
timeout /t 5 >nul
