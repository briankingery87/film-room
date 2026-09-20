@echo off
rem ===========================================================
rem  Atlas Starter - one-click publish
rem  Double-click. Stages, commits and pushes this folder.
rem ===========================================================
title Publish
cd /d "%~dp0"
echo.
echo   PUBLISH
echo   ---------------------------------------------------------
echo   Folder: %CD%
echo.
git --version >nul 2>&1
if errorlevel 1 goto nogit
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 goto norepo
set "CHANGED="
for /f "delims=" %%i in ('git status --porcelain') do set "CHANGED=1"
if not defined CHANGED goto nochanges
echo   These files changed:
echo.
git status --short
echo.
echo   ---------------------------------------------------------
set "MSG="
set /p "MSG=  Describe this update (or press Enter to skip): "
if not defined MSG set "MSG=Update %DATE% %TIME%"
echo.
echo   Staging...
git add -A
if errorlevel 1 goto failed
echo   Committing...
git commit -m "%MSG%"
if errorlevel 1 goto failed
echo   Pushing...
git rev-parse --abbrev-ref --symbolic-full-name @{u} >nul 2>&1
if errorlevel 1 goto firstpush
git push
if errorlevel 1 goto failed
goto done
:firstpush
echo   (first push on this branch - setting upstream)
git push -u origin main
if errorlevel 1 goto failed
goto done
:done
echo.
echo   ---------------------------------------------------------
echo   PUBLISHED. Live in about a minute.
echo   Settings ^> Pages in the repo shows the URL.
echo   ---------------------------------------------------------
echo.
pause
exit /b 0
:nochanges
echo   Nothing has changed since the last publish.
echo.
pause
exit /b 0
:nogit
echo   [X] Git is not installed, or this window opened before it was.
echo       https://git-scm.com/download/win  then reopen this file.
echo.
pause
exit /b 1
:norepo
echo   [X] This folder is not a Git repository yet.
echo       git init  /  git branch -M main  /  git remote add origin ^<url^>
echo.
pause
exit /b 1
:failed
echo.
echo   [X] Something went wrong - the text above says what.
echo       Common: sign-in window dismissed, or the repo changed on github.com (git pull).
echo       Nothing was lost.
echo.
pause
exit /b 1
