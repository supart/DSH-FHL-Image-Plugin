@echo off
chcp 65001 >nul
setlocal
set "ROOT=%~dp0.."
echo Installing DSH FHL Image plugin into profile fhl-image...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-to-dsh.ps1" -Profile fhl-image -TarballPath "%ROOT%\dsh-fhl-image-plugin-0.1.0.tgz"
if errorlevel 1 (
  echo.
  echo Installation failed. Read docs\INSTALL.zh-CN.md and docs\TROUBLESHOOTING.zh-CN.md.
  pause
  exit /b 1
)
echo.
echo Installation completed. Next run: dsh --profile fhl-image
pause
