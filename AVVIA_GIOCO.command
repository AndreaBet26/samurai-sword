#!/bin/bash
# Samurai Sword - avvio rapido su Mac (doppio clic nel Finder)
cd "$(dirname "$0")"
clear
echo "========================================================"
echo "              SAMURAI SWORD - AVVIO GIOCO"
echo "========================================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js non è installato."
  echo "Scaricalo da https://nodejs.org (versione LTS), installalo e riprova."
  read -n 1 -s -r -p "Premi un tasto per chiudere..."
  exit 1
fi

# Il gioco è già acceso in un'altra finestra? Allora basta aprire il browser
if lsof -nP -iTCP:3001 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Il gioco è già in esecuzione in un'altra finestra del Terminale."
  echo "Apro il browser... (questa finestra si può chiudere)"
  open "http://localhost:5173"
  sleep 2
  exit 0
fi

# Prima volta (o librerie cambiate): installa le dipendenze
if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
  echo "Installo le librerie del gioco (solo la prima volta, qualche minuto)..."
  npm install || { read -n 1 -s -r -p "Installazione non riuscita. Premi un tasto..."; exit 1; }
  touch node_modules
fi

echo "Avvio server e gioco... tra pochi secondi si apre il browser."
echo "Per chiudere il gioco chiudi questa finestra (o premi Ctrl+C)."
echo
(sleep 4 && open "http://localhost:5173") &
npm run dev
