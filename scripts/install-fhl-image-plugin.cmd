@echo off
chcp 65001 >nul
setlocal
echo Installing DSH FHL Image plugin into profile fhl-image...
rem install-to-dsh.ps1 finds the newest .tgz in artifacts\, the project root, or scripts\.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-to-dsh.ps1" -Profile fhl-image
if errorlevel 1 (
  echo.
  echo Installation failed. Read docs\INSTALL.zh-CN.md and docs\TROUBLESHOOTING.zh-CN.md.
  pause
  exit /b 1
)
echo.
echo Installation completed. Next run: dsh --profile fhl-image
pause
