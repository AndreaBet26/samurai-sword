# 🗡️ Samurai Sword - Edizione Digitale

Una trasposizione digitale multiplayer del celebre gioco da tavolo **Samurai Sword** (ideato da Emiliano Sciarra ed edito da dV Games). 
Progettato per essere giocato direttamente da browser web (PC, tablet o smartphone) senza dover installare nulla, condividendo un semplice codice stanza con i tuoi amici.

---

## 🌟 Caratteristiche Principali

- **Fedeltà alle Regole Ufficiali:**
  - **Nessuna Eliminazione:** Quando un giocatore va a 0 PV (Resistenza), cede 1 Punto Onore (🪷) a chi lo ha abbattuto, scarta le carte e diventa *Inoffensivo* fino al suo prossimo turno, quando recupera la vita al massimo.
  - **4 Fasi di Turno:** Recupero (gestione sconfitta & Bushido), Pesca (2 carte dal mazzo; 3 per Hideyoshi; opzione scarti per Ieyasu), Gioco (armi, proprietà, azioni), Scarto (fino al limite dei propri PV).
  - **Ruoli & Condizioni di Vittoria:**
    - **Shōgun (Giallo):** Palese a tutti, guida l'impero assieme al Samurai.
    - **Samurai (Giallo):** Alleato segreto dello Shōgun.
    - **Ninja (Blu):** Squadra segreta che collabora per abbattere lo Shōgun.
    - **Ronin (Rosso):** Guerriero solitario il cui punteggio di fine partita viene moltiplicato (x2 o x3).
  - **I 12 Personaggi del Gioco Base:** *Benkei, Chiyome, Ginchiyo, Goemon, Hanzō, Hideyoshi, Ieyasu, Kojirō, Musashi, Nobunaga, Tomoe, Ushiwaka* con tutte le rispettive abilità speciali implementate.
  - **Il Mazzo Completo da 90 Carte:**
    - 32 Carte Arma (*Bokken, Bo, Kiseru, Kusarigama, Katana, Shuriken, Kanabo, Nodachi, Naginata, Nagayari, Tanegashima, Daikyu, Wakizashi* con gittata e danni reali).
    - 15 Carte Proprietà (*Armatura, Concentrazione, Estrazione Rapida, Bushido*).
    - 43 Carte Azione (*Parata, Cerimonia del Tè, Daimyo, Diversione, Geisha, Grido di Battaglia, Jiujitsu, Respirazione*).
- **Intelligenza Artificiale (Bot):** Possibilità di aggiungere bot IA nella lobby con un clic per testare la partita anche da solo o completare il tavolo da 3 a 7 giocatori.
- **Interfaccia Grafica Giapponese Feudale:** Tavolo virtuale circolare, animazioni, indicatore dinamico delle distanze e difficoltà, registro eventi in tempo reale e modal per reazioni (Parata), scarti e bersagli.

---

## 🚀 Come Avviare il Gioco in Locale

### 1. Requisiti
- [Node.js](https://nodejs.org/) (versione 18 o superiore raccomandata)

### 2. Installazione
Apri il terminale nella cartella del progetto:
```bash
npm install
```

### 3. Avvio in Modalità Sviluppo
Avvia contemporaneamente sia il server Socket.IO che il client Vite:
```bash
npm run dev
```
- **Client (Interfaccia di gioco):** [http://localhost:5173](http://localhost:5173)
- **Server WebSocket:** [http://localhost:3001](http://localhost:3001)

### 4. Avvio in Modalità Produzione (Singolo Server Tutto-in-Uno)
```bash
npm run build
npm start
```
Il server Express servirà sia il gioco che i WebSocket direttamente all'indirizzo [http://localhost:3001](http://localhost:3001).

---

## 🌐 Giocare Online a Distanza con gli Amici

Puoi ospitare il progetto gratuitamente online in pochi minuti:

### Opzione A: Render.com (Gratuito)
1. Carica questa cartella su un repository GitHub privato.
2. Vai su [Render.com](https://render.com) e crea un **Web Service**.
3. Collega il tuo repository.
4. Imposta:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
5. Render genererà un URL pubblico (es. `https://samurai-sword.onrender.com`). Condividi il link con i tuoi amici!

### Opzione B: Giocare da Rete Locale (Stesso Wi-Fi) o con Ngrok / Cloudflare Tunnel
- Avviando `npm start`, chiunque sulla tua stessa rete Wi-Fi può collegarsi usando il tuo IP locale (es. `http://192.168.1.X:3001`).
- Per invitare amici via internet dal tuo PC senza deploy, puoi usare [ngrok](https://ngrok.com/):
  ```bash
  npx ngrok http 3001
  ```
  e inviare l'URL pubblico temporaneo ai tuoi amici.
