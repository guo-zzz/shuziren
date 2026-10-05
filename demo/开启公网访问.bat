@echo off
rem ============================================================
rem  Publish the local demo (port 8090) to the internet with a
rem  Cloudflare quick tunnel. No account needed.
rem  Keep this window open - closing it cuts the public URL.
rem  Keep this file in GBK/ANSI encoding on Windows.
rem ============================================================
setlocal
cd /d "%~dp0"
set "CF=%~dp0..\tools\cloudflared.exe"
if not exist "%CF%" (
  echo [ERROR] tools\cloudflared.exe not found.
  echo Download it from:
  echo   https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
  echo and save it as  tools\cloudflared.exe  in the project folder.
  pause
  exit /b 1
)
echo.
echo   Starting the public tunnel, please wait 5-20 seconds ...
echo   The public URL looks like:  https://xxxx-xxxx-xxxx.trycloudflare.com
echo   Send that URL to your teammates. Keep this window OPEN.
echo   Press Ctrl + C or close this window to cut public access.
echo.
"%CF%" tunnel --url http://127.0.0.1:8090 --no-autoupdate
pause