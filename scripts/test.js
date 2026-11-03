import { spawnSync } from 'child_process';
import path from 'path';

const tsx = path.resolve('node_modules/tsx/dist/cli.mjs');

console.log('--- Esecuzione test regole, punteggi e simulazioni ---');
const r1 = spawnSync(process.execPath, [tsx, 'tests/run-tests.ts'], { stdio: 'inherit' });
if (r1.status !== 0) {
  process.exit(r1.status ?? 1);
}

console.log('\n--- Esecuzione test carte e abilità regolamento ---');
const r2 = spawnSync(process.execPath, [tsx, 'tests/carte.ts'], { stdio: 'inherit' });
process.exit(r2.status ?? 0);
