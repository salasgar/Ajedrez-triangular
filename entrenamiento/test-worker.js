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
const gameSrc = ['geometry.js', 'variants.js', 'rules.js', 'ai.js', 'ai-async.js']
  .map(f => fs.readFileSync(path.join(dir, f), 'utf8'))
  .join('\n');

// Se prueba con TODAS las modalidades, no solo con la de por defecto: el
// worker recibe la modalidad en el mensaje inicial y las tablas de movimiento
// dentro del propio grafo de casillas, así que un fallo ahí (un campo de V que
// no sobrevive al clonado, una tabla que se quedó como función) solo saldría
// al jugar con esa modalidad concreta — y en el navegador, callado, dentro del
// onerror del worker.
const driverSrc = `
RESULTADO.workerSrc = aiWorkerSource();
RESULTADO.casos = [];
for (const id of Object.keys(VARIANTS)) {
  setVariant(id);
  newGame();
  RESULTADO.casos.push({
    id,
    // El worker ya no lleva la modalidad cableada: le llega en el mensaje
    // inicial, junto a las casillas (ver variantForWorker en ai-async.js).
    cells: CELL_MAP,
    variant: variantForWorker(),
    boardSize: N,
    state: { board: game.board, turn: game.turn, enPassant: null,
      clock: 0, posKeys: [] },
    legales: new Set(movesForSide(game.board, 'w', null).map(m => m.from + '>' + m.to)),
  });
}
setVariant('salas');
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

for (const caso of RESULTADO.casos) {
  mensajes.length = 0;
  try {
    ctx.onmessage({ data: { cells: caso.cells, variant: caso.variant,
      boardSize: caso.boardSize } });
    ctx.onmessage({ data: { level: 4, state: caso.state, opts: {} } });
  } catch (err) {
    console.error('[' + caso.id + '] El worker revienta al buscar (¿falta una ' +
      'dependencia en AI_WORKER_FNS/AI_WORKER_CONSTS de ai-async.js?):', err.message);
    process.exit(1);
  }
  const mv = mensajes[0];
  if (!mv || !caso.legales.has(mv.from + '>' + mv.to)) {
    console.error('[' + caso.id + '] El worker no devolvió una jugada legal:',
      JSON.stringify(mv));
    process.exit(1);
  }
  console.log('  ok  ' + caso.id.padEnd(12) + ' nivel 4 jugó ' + mv.from + '>' + mv.to +
    ' (' + caso.legales.size + ' legales)');
}
console.log('OK: worker íntegro en las ' + RESULTADO.casos.length + ' modalidades');
