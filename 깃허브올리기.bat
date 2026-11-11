@echo off
cd /d "%~dp0"

echo [Step 1] Git Init...
git init
git branch -M main

echo [Step 2] Remote Setup...
git remote remove origin 2>nul
git remote add origin https://github.com/LEEKYEKWON/todak-note.git

echo [Step 3] Adding files...
git add -A

echo [Step 4] Committing...
git commit -m "TodakNote v1.0.0"

echo [Step 5] Pushing to GitHub...
git push -u origin main

echo.
echo ==============================================
echo Upload finished!
echo ==============================================
pause
