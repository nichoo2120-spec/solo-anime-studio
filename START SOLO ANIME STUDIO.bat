@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Solo Anime Studio v0.5.176 - Instant Offline Start
color 0B
echo.
echo ==============================================
echo  SOLO ANIME STUDIO v0.5.176 - OFFLINE START
 echo ==============================================
echo.
where node.exe >nul 2>nul
if errorlevel 1 goto :NO_NODE
node "scripts\launch-offline.mjs"
if errorlevel 1 goto :ERROR
exit /b 0
:NO_NODE
echo Node.js not found. Install Node.js LTS once from https://nodejs.org/
pause
exit /b 1
:ERROR
echo.
echo STARTUP FAILED - send a screenshot of this window.
pause
exit /b 1
