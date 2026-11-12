@echo off
cd /d "%~dp0"
git log --name-status -1
pause

