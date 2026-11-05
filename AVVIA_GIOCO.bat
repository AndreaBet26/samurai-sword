@echo off
setlocal
title Samurai Sword - Gioco in Esecuzione
chcp 65001 >nul
cd /d "%~dp0"

:: Rimuove eventuali virgolette spurie dal PATH di Windows (evita errori cmd.exe)
set "PATH=%PATH:"=%"

:: Verifica se node e gia raggiungibile nel PATH
where node >nul 2>&1
if %ERRORLEVEL% equ 0 goto node_found

:: Fallback se node non e nel PATH
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%" & goto node_found
if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%" & goto node_found
if exist "%LOCALAPPDATA%\Programs\node\node.exe" set "PATH=%LOCALAPPDATA%\Programs\node;%PATH%" & goto node_found

:node_found
where node >nul 2>&1
if %ERRORLEVEL% equ 0 goto start_game

echo.
echo ========================================================
echo  ERRORE: Node.js non e stato trovato nel sistema!
echo ========================================================
echo  Per giocare a Samurai Sword e necessario aver installato
echo  Node.js (scaricabile gratuitamente da https://nodejs.org).
echo.
echo  Premi un tasto per uscire...
pause >nul
exit /b 1

:start_game
echo ========================================================
echo               SAMURAI SWORD - AVVIO GIOCO
echo ========================================================
echo.
echo  Sto avviando il server di gioco e l'interfaccia...
echo.
echo  * Link per te (in locale):     http://localhost:5173
echo  * Link per AMICI (online):     http://178.104.245.26:3001
echo.
echo  [SUGGERIMENTO] Non chiudere questa finestra mentre giochi.
echo                 Dalla lobby puoi cliccare "Copia link invito"
echo                 per inviarlo direttamente ai tuoi amici!
echo ========================================================
echo.

:: Apre il browser predefinito su localhost:5173 dopo 2.5 secondi
start "" powershell -NoProfile -Command "Start-Sleep -Milliseconds 2500; Start-Process 'http://localhost:5173'"

:: Avvia l'orchestratore del gioco (Server Socket.io su 3001 + Client Vite su 5173)
node scripts/dev.js

if %ERRORLEVEL% neq 0 (
    echo.
    echo ========================================================
    echo  Il processo e terminato o si e verificato un errore.
    echo ========================================================
    echo.
    pause
)
