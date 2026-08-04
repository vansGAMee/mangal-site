@echo off
chcp 65001 > nul
echo Запуск локальной демо-версии mangal-site...
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\demo-local.ps1"
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo Произошла ошибка при запуске демо.
  pause
)
