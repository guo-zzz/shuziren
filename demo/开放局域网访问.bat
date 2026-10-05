@echo off
rem ============================================================
rem  Allow teammates on the same LAN to open the demo on port 8090.
rem  Needs administrator rights - this script re-launches itself
rem  elevated and then adds one inbound firewall rule.
rem  Keep this file in GBK/ANSI encoding on Windows.
rem ============================================================
net session >nul 2>&1
if errorlevel 1 (
  echo Requesting administrator rights, please click "Yes" ...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
set "RULE=DigitalHumanDemo-8090"
netsh advfirewall firewall delete rule name="%RULE%" >nul 2>&1
netsh advfirewall firewall add rule name="%RULE%" dir=in action=allow protocol=TCP localport=8090 remoteip=localsubnet
echo.
echo Done. Teammates on the same network can now open:
echo    http://YOUR-LAN-IP:8090
echo To undo it, run:  netsh advfirewall firewall delete rule name="DigitalHumanDemo-8090"
pause