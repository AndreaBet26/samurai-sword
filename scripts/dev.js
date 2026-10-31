import { spawn } from 'child_process';
import path from 'path';

console.log('🚀 Avvio di Samurai Sword (Server + Client)...');

const tsxPath = path.resolve('node_modules/tsx/dist/cli.mjs');
const vitePath = path.resolve('node_modules/vite/bin/vite.js');

const server = spawn(process.execPath, [tsxPath, 'watch', 'server/src/index.ts']);
server.stdout.on('data', (d) => process.stdout.write(`[SERVER] ${d}`));
server.stderr.on('data', (d) => process.stderr.write(`[SERVER ERR] ${d}`));

const client = spawn(process.execPath, [vitePath, 'client', '--port', '5173']);
client.stdout.on('data', (d) => process.stdout.write(`[CLIENT] ${d}`));
client.stderr.on('data', (d) => process.stderr.write(`[CLIENT ERR] ${d}`));

const cleanup = () => {
  try {
    server.kill();
    client.kill();
  } catch {}
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
