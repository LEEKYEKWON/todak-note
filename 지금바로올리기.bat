@echo off
cd /d C:\Users\user\Desktop\todak-note

echo Step 1: Delete package.json...
del /f package.json
echo package.json deleted!

echo Step 2: Copy logo image...
copy "C:\Users\user\.gemini\antigravity\brain\4693205f-a385-4be9-bc0a-d643472db6c2\.user_uploaded\media_1794184865072_1431b68a.jpg" "C:\Users\user\Desktop\todak-note\open_book_heart_clean_1794109984125.jpg"

echo Step 3: Git remove package.json from tracking...
git rm --cached package.json

echo Step 4: Git add all...
git add -A

echo Step 5: Git commit...
git commit -m "Fix: Delete package.json - force pure static site"

echo Step 6: Git push...
git push origin main

echo.
echo Done! Check https://todak-note.vercel.app in 2 minutes.
echo.
pause
