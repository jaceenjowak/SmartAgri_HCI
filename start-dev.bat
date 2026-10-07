@echo off
set ROOT=%~dp0
if not exist "%ROOT%backend\.env" (
  echo backend\.env is missing.
  echo Run: powershell -ExecutionPolicy Bypass -File setup-env.ps1
  pause
  exit /b 1
)
start "SmartAgri Backend" cmd /k "cd /d %ROOT%backend && npm install && npm run dev"
start "SmartAgri Frontend" cmd /k "cd /d %ROOT%frontend && npm install && npm run dev"
echo Started backend and frontend terminals.
