@echo off
chcp 65001 >nul
setlocal

if "%~1"=="" goto usage
if "%~2"=="" goto usage

set "WEEK=%~1"
set "DAY=%~2"

if not exist "weeks\week_%WEEK%\day_%DAY%.html" (
  echo.
  echo [X] لم يبن HTML لهذا اليوم بعد.
  echo     شغل اولا: npm run build:day -- %WEEK% %DAY%
  echo.
  goto end
)

git add "weeks/week_%WEEK%/day_%DAY%.html" "content/week_%WEEK%/day_%DAY%.md"
git commit -m "Day %DAY% of Week %WEEK%"
git push origin main

echo.
echo [V] تم! انتظر دقيقة لتحديث GitHub Pages.
echo     الرابط:
echo     https://s5xx5s.github.io/english-learning-system/weeks/week_%WEEK%/day_%DAY%.html
echo.
goto end

:usage
echo.
echo الاستخدام:  _scripts\upload_day.bat WW DD
echo مثال:       _scripts\upload_day.bat 01 01
echo.

:end
endlocal
pause
