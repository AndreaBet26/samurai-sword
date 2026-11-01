@echo off
title Samurai Sword - Gioco in Esecuzione
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================================
echo               SAMURAI SWORD - AVVIO GIOCO
echo ========================================================
echo.
echo  Sto avviando il server e l'interfaccia di gioco...
echo  Tra pochi secondi il gioco si aprira nel tuo browser!
echo.
echo  [SUGGERIMENTO] Non chiudere questa finestra mentre giochi.
echo                 Per terminare il gioco, chiudila pure.
echo ========================================================
echo.

:: Apre il browser su localhost:5173 dopo 2 secondi di attesa per permettere a Vite e al server di avviarsi
start "" powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:5173'"

npm run dev
