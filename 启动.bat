@echo off
REM Rixu - Windows one-click launcher.
REM Keep this file ASCII-only because cmd.exe may use a legacy code page.
setlocal

where powershell >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Windows PowerShell not found.
  echo Open a terminal in this folder and run: cd web ^&^& npm install ^&^& npm run dev
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-windows.ps1" %*
set EXITCODE=%ERRORLEVEL%

if not "%EXITCODE%"=="0" (
  echo.
  echo [ERROR] Launcher exited with code %EXITCODE%.
  pause
)

endlocal & exit /b %EXITCODE%
