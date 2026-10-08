@echo off
chcp 65001 >nul
setlocal
call "%~dp0scripts\install-fhl-image-plugin.cmd"
exit /b %errorlevel%
