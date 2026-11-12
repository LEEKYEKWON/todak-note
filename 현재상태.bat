@echo off
cd /d "%~dp0"
git log --oneline -2
echo.
git status
pause

