@echo off
cd /d "%~dp0"
title 双自我对话 Demo

where node >nul 2>nul
if errorlevel 1 goto nonode

echo ============================================================
echo   双自我对话 Demo  （当下的我 + 理想的我）
echo   服务地址：http://127.0.0.1:8090
echo ------------------------------------------------------------
echo   这个窗口就是服务本体，演示期间请不要关闭。
echo   关闭窗口、注销或重启电脑，服务都会停止。
echo   要停止服务：直接关闭本窗口即可。
echo ============================================================
echo.

start "" http://127.0.0.1:8090
node server.mjs

echo.
echo [服务已停止]
echo 如果上面提示端口被占用，说明已经有一个 Demo 在运行，
echo 直接打开 http://127.0.0.1:8090 就能用，不用再启动一次。
echo 重新启动请再次双击本文件。
pause
exit /b 0

:nonode
echo [启动失败] 没有找到 node 命令。
echo 请先安装 Node.js：https://nodejs.org
echo 安装完成后重新双击本文件。
echo.
pause
exit /b 1