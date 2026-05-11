@echo off
chcp 65001 >nul
setlocal

if "%~1"=="" goto usage
if "%~2"=="" goto usage

set "WEEK=%~1"
set "DAY=%~2"

if not exist "content\week_%WEEK%" mkdir "content\week_%WEEK%"

if exist "content\week_%WEEK%\day_%DAY%.md" (
  echo.
  echo [!] الملف موجود مسبقا: content\week_%WEEK%\day_%DAY%.md
  echo     احذفه يدويا قبل اعادة التشغيل اذا اردت استبداله.
  echo.
  goto end
)

copy "templates\day_template.md" "content\week_%WEEK%\day_%DAY%.md" >nul

if errorlevel 1 (
  echo.
  echo [X] فشل النسخ. تاكد ان templates\day_template.md موجود.
  echo.
  goto end
)

echo.
echo [V] تم انشاء: content\week_%WEEK%\day_%DAY%.md
echo     املا المحتوى من Claude، ثم: npm run build:day -- %WEEK% %DAY%
echo.
goto end

:usage
echo.
echo الاستخدام:  _scripts\new_day.bat WW DD
echo مثال:       _scripts\new_day.bat 01 01
echo.

:end
endlocal
pause
