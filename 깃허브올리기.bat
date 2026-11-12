@echo off
cd /d "%~dp0"

echo [Step 0] Completely removing package.json...
if exist "package.json" del /f /q "package.json"
git rm -f package.json 2>nul

echo [Step 1] Staging all files...
git add -A

echo [Step 2] Committing...
git commit -m "Completely remove package.json for pure static web deployment"

echo [Step 3] Pushing to GitHub...
git push origin main

echo.
echo ==============================================
echo [SUCCESS] Push complete!
echo ==============================================
pause
