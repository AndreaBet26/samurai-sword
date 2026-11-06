import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoomManager } from './roomManager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static build from client/dist if present
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', game: 'Samurai Sword Digital' });
});

// Fallback to client/dist/index.html for SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/socket.io')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('Samurai Sword API Server Online. Inizia il frontend Vite con npm run dev:client');
    }
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 10000, // Ping attivo ogni 10 secondi per prevenire timeout proxy e cadute di rete
  pingTimeout: 10000,  // 10s di tolleranza prima di considerare perso il socket
  transports: ['websocket', 'polling']
});

const roomManager = new RoomManager(io);

io.on('connection', (socket) => {
  roomManager.handleConnection(socket);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🗡️ Server Samurai Sword in esecuzione su http://localhost:${PORT}`);
});
