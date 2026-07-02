@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
    echo Node.js/npm is required.
    echo Install it from https://nodejs.org/ and then run this file again.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies first...
    call npm install
    if errorlevel 1 (
        echo Dependency install failed.
        pause
        exit /b 1
    )
)

echo Starting Shreeram ERP desktop app...
call npm run desktop:dev
