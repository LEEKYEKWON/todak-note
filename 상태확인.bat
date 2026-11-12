@echo off
cd /d "%~dp0"
git status
echo.
git log -1 --oneline
pause

