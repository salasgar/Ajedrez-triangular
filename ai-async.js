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
  positionKey, canCapture, slideMoves, pseudoMoves, attacks, findKing,
  isAttacked, rival,
  legalMoves, rowCells, backRow, castlingLanding, isCastling, castleMoves,
  // ai.js
  PV, drawScore, movesForSide, applyMoveSim, deepCopyBoard, makeSim, unmakeSim,
  genMoves, isAttackedFast, scanPins, findPins, needsProbe,
  initZobrist, zIndex, computeHash, hashKey, zxor,
  ttInit, packMove, orderSearchMoves, centrality, pawnAdvance, evaluate,
  capturedBy, orderMoves,
  countSlide, countPseudoMoves, rayCaptures, genCaptures, quiesce, negamax,
  pickSoftmax, chooseAiMove,
];
// Constantes que no dependen de la modalidad. Las que sí (N, los valores de
// las piezas, el enroque…) viajan dentro de V, en el mensaje inicial.
const AI_WORKER_CONSTS = {
  MATE, DRAW_CONTEMPT, DRAW_CAP, QUIESCE_MAX_DEPTH, DELTA_MARGIN,
  FIFTY_MOVE_LIMIT, AI_LEVELS, PLAY_TOLERANCE,
  MOVED_MATTERS, ZOBRIST_SEED, TT_BITS, TT_SIZE, TT_MASK, Z_CODE, Z_UNMOVED,
  Z_PER_CELL,
};

// La modalidad, recortada a lo que el worker necesita y a lo que sobrevive al
// clonado estructurado (datos, no funciones). Todo lo demás —cómo se mueve
// cada pieza, qué ataca cada casilla, las reglas del peón— viaja ya resuelto
// dentro del propio grafo de casillas, en las tablas que monta variants.js.
// `rows` son referencias a casillas: se manda en el MISMO mensaje que
// CELL_MAP para que el clonado conserve la identidad de los objetos.
function variantForWorker() {
  return {
    id: V.id, board: V.board, edgePromotion: V.edgePromotion,
    promotionChoices: V.promotionChoices, castling: V.castling || null,
    pieceTypes: V.pieceTypes, engine: V.engine, rows: V.rows || null,
    // las modalidades de Piedra, papel y tijera: la matriz de capturas que
    // consulta canCapture() y el flag de juego sin rey
    captures: V.captures || null, kingless: V.kingless || false,
  };
}

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
    // estado del motor que en el hilo principal declara ai.js en su nivel
    // superior (solo las FUNCIONES viajan serializadas, así que el worker
    // necesita sus propias declaraciones). ZOBRIST se reconstruye con la
    // misma semilla: tablas idénticas a las del hilo principal, que es lo
    // que hace comparables los posHashes que llegan en cada petición.
    'let TT = null;',
    'let ttGen = 0;',
    'let ttAge = 0;',
    'let ttCfgSig = null;',
    'let ZOBRIST = null;',
    // la modalidad activa y su parámetro de forma, que aquí llegan clonados
    'let V = null;',
    'let N = 0;',
    'onmessage = (e) => {',
    '  if (e.data.cells) {',
    '    CELL_MAP = e.data.cells;',
    '    CELLS = [...CELL_MAP.values()];',
    '    V = e.data.variant;',
    '    N = e.data.boardSize;',
    '    ZOBRIST = initZobrist();',
    '    TT = null;',
    '    return;',
    '  }',
    '  postMessage(chooseAiMove(e.data.level, e.data.state, e.data.opts));',
    '};',
  ].join('\n');
}

function startAiWorker() {
  const url = URL.createObjectURL(
    new Blob([aiWorkerSource()], { type: 'text/javascript' }));
  try {
    const w = new Worker(url);
    w.postMessage({ cells: CELL_MAP, variant: variantForWorker(), boardSize: N });
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
  if (req) req.cb(chooseAiMove(req.level, req.state, req.opts));
}

// Calcula la jugada del nivel dado para la posición actual y llama a
// cb(move): de forma asíncrona con el worker, o síncrona si no hay worker.
// `opts` viaja tal cual a chooseAiMove (p. ej. {analyze: true}); `state`
// permite analizar una posición que no sea la viva (ver stateAtIndex).
function requestAiMove(level, cb, opts = {}, state = searchState()) {
  // Petición sobre petición: antes se sobrescribía aiPending en silencio y la
  // PRIMERA respuesta del worker (de la búsqueda vieja) se entregaba al
  // callback nuevo — una jugada para otra posición. Los llamantes de
  // script.js comprueban aiBusy(), así que llegar aquí es un descuido:
  // se descarta la búsqueda vieja de forma explícita (con su worker, que es
  // la única manera de interrumpirla) y se avisa por consola.
  if (aiPending) {
    console.warn('requestAiMove con una búsqueda en curso: se descarta la anterior.');
    abortAiSearch();
  }
  if (!aiWorkerBroken && !aiWorker) {
    try { aiWorker = startAiWorker(); }
    catch (err) {
      console.warn('No se pudo crear el worker de la IA; cálculo síncrono.', err);
      aiWorkerBroken = true;
    }
  }
  if (aiWorkerBroken) { cb(chooseAiMove(level, state, opts)); return; }
  aiPending = { cb, level, state, opts };
  aiWorker.postMessage({ level, state, opts });
}

// ¿Hay una búsqueda en marcha? (el worker atiende una petición cada vez)
function aiBusy() { return aiPending !== null; }

// Da otra oportunidad al worker (p. ej. al empezar partida nueva): un fallo
// puntual —pestaña sin memoria, extensión que bloquea blobs— no debería
// condenar la sesión entera al cálculo síncrono, que congela la página.
function resetAiWorker() {
  if (aiPending) return;              // no tocar una búsqueda en curso
  aiWorkerBroken = false;
}

// El worker se queda con una copia del grafo de casillas y de la modalidad del
// momento en que se creó, así que al cambiar de modalidad hay que tirarlo: la
// siguiente petición lo reconstruye con el tablero y las tablas nuevas.
function aiWorkerReload() {
  abortAiSearch();
  if (aiWorker) { aiWorker.terminate(); aiWorker = null; }
}

// Descarta la búsqueda en curso, si la hay. Matar el worker es la única forma
// de interrumpirlo; se recreará en la siguiente petición.
function abortAiSearch() {
  if (!aiPending) return;
  aiPending = null;
  if (aiWorker) { aiWorker.terminate(); aiWorker = null; }
}
