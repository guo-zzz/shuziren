@echo off
rem ============================================================
rem  Digital-Human demo server keep-alive launcher
rem  Started hidden by "服务器常驻.vbs" and by the Windows
rem  scheduled task "DigitalHumanDemoServer" (at logon).
rem  Keep this file in GBK/ANSI encoding on Windows.
rem ============================================================
setlocal
cd /d "%~dp0"

set "NODE=node"
where node >nul 2>nul
if errorlevel 1 set "NODE=C:\Program Files\nodejs\node.exe"

rem --- 监听地址 ---
rem   127.0.0.1  只有本机能访问（更安全）
rem   0.0.0.0    同一局域网的队友也能访问 http://本机IP:8090
set "DEMO_HOST=0.0.0.0"

rem --- 如果 8090 已经有服务在跑，就不重复启动 ---
curl -s -m 3 -o nul http://127.0.0.1:8090/api/health >nul 2>nul
if not errorlevel 1 (
  echo [keep-alive] server already running on 8090, nothing to do.
  exit /b 0
)

echo [keep-alive] starting server on %DEMO_HOST%:8090 ...
:loop
"%NODE%" server.mjs
echo [keep-alive] server exited with code %errorlevel%, restarting in 5s.
timeout /t 5 /nobreak >nul
goto loop