@echo off
cd /d "%~dp0"

echo [Step 1] Git status check...
git status

echo.
echo [Step 2] Staging all files...
git add -A

echo.
echo [Step 3] Committing...
git commit -m "Switch to static deployment with direct html navigation"

echo.
echo [Step 4] Pushing to GitHub...
git push origin main

echo.
echo ==============================================
echo [SUCCESS] Git push completed!
echo ==============================================
pause
