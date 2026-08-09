@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [开工台] 未找到 Node.js。请安装 Node.js 20 或更高版本后重试。
  pause
  exit /b 1
)
echo [开工台] 正在启动本地只读工作台...
node src\server.js --open
if errorlevel 1 pause
