@echo off
cd /d "C:\Users\user\Desktop\todak-note"

echo.
echo ========================================================
echo   TODAK NOTE - GitHub and Vercel Auto Deploy
echo ========================================================
echo.

echo [1/3] Git Add All Files...
git add -A

echo.
echo [2/3] Git Commit...
git commit -m "Update clinic and report features"

echo.
echo [3/3] Git Push...
git push origin main

echo.
echo ========================================================
echo   [SUCCESS] Deploy Completed!
echo   Please refresh (F5) in 30 seconds:
echo   https://todak-note.vercel.app/clinic.html
echo ========================================================
echo.
pause
