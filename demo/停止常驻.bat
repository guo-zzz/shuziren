@echo off
rem ============================================================
rem  Stop the digital-human demo server AND its keep-alive guard.
rem  Keep this file in GBK/ANSI encoding on Windows.
rem  Matching is done by folder path (not by Chinese file name),
rem  so it works no matter which console code page is active.
rem ============================================================
setlocal
set "GUARD_DIR=%~dp0"
echo Stopping keep-alive guard and demo server ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=$env:GUARD_DIR; $g=Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'cmd.exe' -and $_.CommandLine -and $_.CommandLine.Contains($d) }; Get-CimInstance Win32_Process | Where-Object { $g.ProcessId -contains $_.ParentProcessId } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; $g | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 900; $c=Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if($c){ Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue; 'killed the process listening on 8090' } else { 'port 8090 is free now' }"
echo Done.
pause