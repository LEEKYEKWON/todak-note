@echo off
cd /d "%~dp0"

echo [Step 0] Copying logo image...
copy "C:\Users\user\.gemini\antigravity\brain\4693205f-a385-4be9-bc0a-d643472db6c2\.user_uploaded\media_1794184865072_1431b68a.jpg" "open_book_heart_clean_1794109984125.jpg" /y 2>nul

echo [Step 1] Git Init...
git init
git branch -M main

echo [Step 2] Remote Setup...
git remote remove origin 2>nul
git remote add origin https://github.com/LEEKYEKWON/todak-note.git

echo [Step 3] Adding files...
git add -A

echo [Step 4] Committing...
git commit -m "TodakNote v1.0.0 Final"

echo [Step 5] Pushing to GitHub...
git push -u origin main

echo.
echo ==============================================
echo Upload finished!
echo ==============================================
pause
