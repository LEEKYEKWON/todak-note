@echo off
title TodakNote Local Server
echo ==============================================
echo   TodakNote OpenAI AI Server Running...
echo ==============================================
cd /d "%~dp0"
start http://localhost:3000
node server.js
pause
