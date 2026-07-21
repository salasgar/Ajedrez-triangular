// ai-async.js — Ejecuta la búsqueda de la IA en un Web Worker para que la
// interfaz siga respondiendo mientras el ordenador piensa.
//
// El worker no se carga desde un archivo: se construye desde un Blob con el
// código fuente (toString) de las funciones ya cargadas más las constantes
// necesarias. Así funciona también al abrir index.html directamente desde el
// disco (file://), donde el navegador prohíbe los workers con URL de archivo.
// Si aun así no se puede crear, se recurre al cálculo síncrono de siempre
// (que congela la página mientras piensa, pero funciona).

// Todo lo que necesita chooseAiMove dentro del worker (de rules.js y ai.js).
// Si la búsqueda gana dependencias nuevas, hay que añadirlas aquí.
const AI_WORKER_FNS = [
  // rules.js
  positionKey, slideMoves, pseudoMoves, attacks, findKing, isAttacked, rival,
  legalMoves, rowCells, backRow, castlingLanding, isCastling, castleMoves,
  // ai.js
  drawScore, movesForSide, applyMoveSim, centrality, pawnAdvance, evaluate,
  capturedBy, orderMoves, quiesce, negamax, chooseAiMove,
];
const AI_WORKER_CONSTS = {
  N, PIECE_VALUE, MATE, DRAW_CONTEMPT, DRAW_CAP, QUIESCE_MAX_DEPTH, DELTA_MARGIN,
  BOARD_MAX_DIST, FIFTY_MOVE_LIMIT, AI_LEVELS, PLAY_TOLERANCE, CASTLING,
  MOVED_MATTERS,
};

let aiWorker = null;        // worker vivo (se crea bajo demanda)
let aiWorkerBroken = false; // si algo falla, cálculo síncrono en adelante
let aiPending = null;       // {cb, level, state} de la petición en curso

function aiWorkerSource() {
  return [
    // los parámetros por defecto de rules.js consultan `game`
    'let game = null;',
    // el grafo de casillas no es JSON (tiene referencias cruzadas): llega
    // clonado en el mensaje inicial
    'let CELL_MAP = null;',
    // rowCells() recorre el array de casillas de geometry.js; se reconstruye
    // del mapa clonado en vez de mandarlo aparte (son los mismos objetos)
    'let CELLS = null;',
    ...Object.entries(AI_WORKER_CONSTS)
      .map(([name, v]) => `const ${name} = ${JSON.stringify(v)};`),
    ...AI_WORKER_FNS.map(f => f.toString()),
    'onmessage = (e) => {',
    '  if (e.data.cells) {',
    '    CELL_MAP = e.data.cells;',
    '    CELLS = [...CELL_MAP.values()];',
    '    return;',
    '  }',
    '  postMessage(chooseAiMove(e.data.level, e.data.state));',
    '};',
  ].join('\n');
}

function startAiWorker() {
  const url = URL.createObjectURL(
    new Blob([aiWorkerSource()], { type: 'text/javascript' }));
  try {
    const w = new Worker(url);
    w.postMessage({ cells: CELL_MAP });
    w.onmessage = (e) => {
      const req = aiPending;
      aiPending = null;
      if (req) req.cb(e.data);
    };
    // p. ej. una dependencia que falta en AI_WORKER_FNS
    w.onerror = (err) => {
      console.warn('Error en el worker de la IA; paso a cálculo síncrono.', err);
      aiWorkerBroken = true;
      failoverToSync();
    };
    return w;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Resuelve la petición pendiente, si la hay, con el cálculo síncrono.
function failoverToSync() {
  if (aiWorker) { aiWorker.terminate(); aiWorker = null; }
  const req = aiPending;
  aiPending = null;
  if (req) req.cb(chooseAiMove(req.level, req.state));
}

// Calcula la jugada del nivel dado para la posición actual y llama a
// cb(move): de forma asíncrona con el worker, o síncrona si no hay worker.
function requestAiMove(level, cb) {
  const state = searchState();
  if (!aiWorkerBroken && !aiWorker) {
    try { aiWorker = startAiWorker(); }
    catch (err) {
      console.warn('No se pudo crear el worker de la IA; cálculo síncrono.', err);
      aiWorkerBroken = true;
    }
  }
  if (aiWorkerBroken) { cb(chooseAiMove(level, state)); return; }
  aiPending = { cb, level, state };
  aiWorker.postMessage({ level, state });
}

// Descarta la búsqueda en curso, si la hay. Matar el worker es la única forma
// de interrumpirlo; se recreará en la siguiente petición.
function abortAiSearch() {
  if (!aiPending) return;
  aiPending = null;
  if (aiWorker) { aiWorker.terminate(); aiWorker = null; }
}
