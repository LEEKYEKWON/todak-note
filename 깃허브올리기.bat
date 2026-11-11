@echo off
cd /d "%~dp0"

echo [Step 0] Copying logo image to project root...
copy /y "C:\Users\user\.gemini\antigravity\brain\4693205f-a385-4be9-bc0a-d643472db6c2\.user_uploaded\media_1794184865072_1431b68a.jpg" "open_book_heart_clean_1794109984125.jpg"
copy /y "C:\Users\user\.gemini\antigravity\brain\4693205f-a385-4be9-bc0a-d643472db6c2\.user_uploaded\media_1794184865072_1431b68a.jpg" "logo.jpg"

echo [Step 1] Git Init...
git init
git branch -M main

echo [Step 2] Remote Setup...
git remote remove origin 2>nul
git remote add origin https://github.com/LEEKYEKWON/todak-note.git

echo [Step 3] Force Adding all files (HTML, CSS, JS, JPG)...
git add -f *.html
git add -f *.jpg
git add -f *.json
git add -f *.js
git add -f api/*
git add -A

echo [Step 4] Committing...
git commit -m "Deploy 100% static files with working links and logo"

echo [Step 5] Pushing to GitHub...
git push -u origin main --force

echo.
echo ==============================================
echo Upload finished!
echo ==============================================
pause
