@echo off
rem ============================================================
rem  Digital-Human demo server keep-alive launcher
rem  Started hidden by "·þÎñÆ÷³£×¤.vbs" and by the Windows
rem  scheduled task "DigitalHumanDemoServer" (at logon).
rem  This file must stay in GBK/ANSI encoding on Windows.
rem ============================================================
setlocal
cd /d "%~dp0"

set "NODE=node"
where node >nul 2>nul
if errorlevel 1 set "NODE=C:\Program Files\nodejs\node.exe"

rem --- if a server is already answering on 8090, do nothing ---
curl -s -m 3 -o nul http://127.0.0.1:8090/api/health >nul 2>nul
if not errorlevel 1 (
  echo [keep-alive] server already running on 8090, nothing to do.
  exit /b 0
)

echo [keep-alive] starting server, it will be restarted automatically if it exits.
:loop
"%NODE%" server.mjs
echo [keep-alive] server exited with code %errorlevel%, restarting in 5s.
timeout /t 5 /nobreak >nul
goto loop