@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0启动真实后端Demo.ps1" -Lan
pause
