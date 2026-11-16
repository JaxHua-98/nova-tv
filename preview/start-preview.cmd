@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js was not found. The TVBox proxy and live CMS preview need Node.js.
  echo Opening the static UI without remote source support...
  start "" "%~dp0index.html"
  exit /b 1
)

node "%~dp0preview-server.mjs"
