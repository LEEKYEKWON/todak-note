@echo off
cd /d C:\Users\user\Desktop\todak-note

echo Step 1: Copy logo image...
copy "C:\Users\user\.gemini\antigravity\brain\4693205f-a385-4be9-bc0a-d643472db6c2\.user_uploaded\media_1794184865072_1431b68a.jpg" "C:\Users\user\Desktop\todak-note\open_book_heart_clean_1794109984125.jpg"

echo Step 2: Git add all...
git add -A

echo Step 3: Git commit...
git commit -m "Fix: Remove build script for static Vercel deploy"

echo Step 4: Git push...
git push origin main

echo.
echo Done! Check https://todak-note.vercel.app in 2 minutes.
echo.
pause
