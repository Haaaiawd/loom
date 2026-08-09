@echo off
setlocal
set "PROTOTYPE_DIR=%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [Moonwake] Node.js is required but was not found on PATH.
  echo Install a supported Node.js release, then run this file again.
  pause
  exit /b 2
)
echo [Moonwake] Starting the local workbench...
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROTOTYPE_DIR%scripts\start-interactive.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo [Moonwake] Startup stopped with exit code %EXIT_CODE%.
  pause
)
exit /b %EXIT_CODE%
