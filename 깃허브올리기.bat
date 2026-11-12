@echo off
cd /d "%~dp0"

echo [Step 1] Force staging all files...
git add -A

echo [Step 2] Committing...
git commit -m "Fix Vercel build command with static output"

echo [Step 3] Pushing to GitHub...
git push origin main

echo.
echo ==============================================
echo [SUCCESS] Push completed!
echo ==============================================
pause
