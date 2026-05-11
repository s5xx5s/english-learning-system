@echo off
chcp 65001 >nul
setlocal

if "%~1"=="" goto usage

set "WEEK=%~1"

if not exist "weeks\week_%WEEK%" (
  echo.
  echo [X] مجلد الاسبوع غير موجود: weeks\week_%WEEK%
  echo     شغل اولا: npm run build:week -- %WEEK%
  echo.
  goto end
)

git add "weeks/week_%WEEK%/" "content/week_%WEEK%/"
git commit -m "Week %WEEK% complete"
git push origin main

echo.
echo [V] تم رفع الاسبوع %WEEK%! انتظر دقيقة لتحديث GitHub Pages.
echo     لوحة التحكم:
echo     https://s5xx5s.github.io/english-learning-system/
echo.
goto end

:usage
echo.
echo الاستخدام:  _scripts\upload_week.bat WW
echo مثال:       _scripts\upload_week.bat 01
echo.

:end
endlocal
pause
