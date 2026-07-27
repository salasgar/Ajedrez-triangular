// test-worker.js — Integridad del Web Worker de la IA, sin navegador.
//
//   node test-worker.js        (sale con código != 0 si el worker está roto)
//
// El worker de ai-async.js se autoensambla desde AI_WORKER_FNS (lista manual
// de funciones) y AI_WORKER_CONSTS. Si la búsqueda gana una dependencia nueva
// y nadie la añade a la lista, el worker revienta EN EJECUCIÓN, y en el
// navegador eso solo se ve en el onerror (y la partida sigue en síncrono, así
// que es fácil no darse cuenta). Este test lo convierte en un fallo de CI:
//
//  1. Carga geometry+rules+ai+ai-async en Node (mismo eval que arena.js).
//  2. Pide el fuente del worker con aiWorkerSource().
//  3. Lo ejecuta en un contexto vm AISLADO (sin acceso a los globales ya
//     cargados, igual que el worker real) con postMessage de mentira.
//  4. Simula el mensaje inicial {cells} y una petición de jugada del nivel 4
//     (el que ejercita quiesce, movilidad y ordenación) y comprueba que
//     devuelve una jugada legal.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = '/Users/salasgar/Documents/git/Ajedrez-triangular';
const gameSrc = ['geometry.js', 'rules.js', 'ai.js', 'ai-async.js']
  .map(f => fs.readFileSync(path.join(dir, f), 'utf8'))
  .join('\n');

const driverSrc = `
// El estado que viajaría al worker: la posición inicial real.
newGame();
RESULTADO.workerSrc = aiWorkerSource();
RESULTADO.cells = CELL_MAP;
RESULTADO.state = { board: game.board, turn: game.turn, enPassant: null,
  clock: 0, posKeys: [] };
RESULTADO.legales = new Set(
  movesForSide(game.board, 'w', null).map(m => m.from + '>' + m.to));
`;

const RESULTADO = {};
eval(gameSrc + '\n' + driverSrc);

// Contexto aislado: si el fuente del worker usa algo que no viaja en él,
// aquí da ReferenceError con el nombre exacto de lo que falta.
const mensajes = [];
const ctx = vm.createContext({ postMessage: (m) => mensajes.push(m) });
try {
  vm.runInContext(RESULTADO.workerSrc, ctx, { filename: 'worker-blob.js' });
} catch (err) {
  console.error('El fuente del worker no carga:', err.message);
  process.exit(1);
}
if (typeof ctx.onmessage !== 'function') {
  console.error('El worker no definió onmessage');
  process.exit(1);
}

try {
  ctx.onmessage({ data: { cells: RESULTADO.cells } });
  ctx.onmessage({ data: { level: 4, state: RESULTADO.state, opts: {} } });
} catch (err) {
  console.error('El worker revienta al buscar (¿falta una dependencia en ' +
    'AI_WORKER_FNS/AI_WORKER_CONSTS de ai-async.js?):', err.message);
  process.exit(1);
}

const mv = mensajes[0];
if (!mv || !RESULTADO.legales.has(mv.from + '>' + mv.to)) {
  console.error('El worker no devolvió una jugada legal:', JSON.stringify(mv));
  process.exit(1);
}
console.log('OK: worker íntegro; nivel 4 jugó ' + mv.from + '>' + mv.to +
  ' (' + RESULTADO.legales.size + ' legales)');
