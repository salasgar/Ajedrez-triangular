// ai.js — Jugador automático con varios niveles de capacidad.
//
// Trabaja siempre sobre copias del tablero (Map) y con un estado de captura
// al paso explícito, sin tocar el objeto global `game` salvo para leerlo
// en chooseAiMove.

// Valor de cada pieza en centipeones. Estos números salieron de una regresión
// tipo Texel sobre autojuego (ver tune-values.js) y se CONFIRMARON en matches
// emparejados —colores invertidos, libro de aperturas fijo— contra los valores
// clásicos { P:100, N:300, B:330, E:350, R:500, Q:900 }: el material ajustado
// junto con un peso de movilidad 4 (ver evaluate) gana ~+113 elo a prof. 3
// (p<0,0001, 134 partidas) y ~+89 a prof. 2. Antes vivían aislados en un
// "nivel 8 experimental"; al quedar confirmados pasan a ser el material de
// todos los niveles.
//
// Lo que NO sobrevivió a la confirmación y por eso no está aquí: las
// bonificaciones posicionales (centralidad/avance) que aprendió la regresión
// resultaron ruido (+12 elo, p=0,62), y el peso de movilidad 1,61 que también
// aprendió iba en el sentido CONTRARIO al que da fuerza (−81 elo); subirlo a 4
// es lo que gana. Ver la ablación en el historial de commits.
const PIECE_VALUE = { P: 100, N: 265, B: 335, E: 358, R: 483, Q: 981, K: 0 };
const MATE = 100000;
// Tope de capturas encadenadas que explora quiesce() antes de rendirse y
// devolver la evaluación tal cual. Es un cinturón de seguridad: sin poda
// por diferencia (ver DELTA_MARGIN) el número de capturas posibles en cada
// nivel puede ser alto en posiciones muy revueltas (p. ej. autojuego con
// jugadas al azar), así que aquí se prefiere un tope corto a arriesgar una
// búsqueda que tarde segundos en una sola hoja.
const QUIESCE_MAX_DEPTH = 6;
// Poda por diferencia en quiesce(): si ni ganando la pieza capturada (más
// este margen de seguridad) se alcanza alfa, no merece la pena explorar esa
// captura. El margen cubre que evaluate() no es exacto (movilidad, etc.).
const DELTA_MARGIN = 200;

// Las tablas se puntúan como ceder una fracción de la ventaja material: el
// bando que va ganando las rehúye (tanto más cuanto mayor sea su ventaja,
// hasta el tope) y el que va perdiendo las busca.
const DRAW_CONTEMPT = 0.3;
const DRAW_CAP = 500;

function drawScore(board, color, values = PIECE_VALUE) {
  let m = 0;
  for (const [, p] of board) m += (p.color === color ? 1 : -1) * values[p.type];
  return Math.max(-DRAW_CAP, Math.min(DRAW_CAP, Math.round(-DRAW_CONTEMPT * m)));
}

// nivel → configuración de búsqueda. `quiesce` solo se activa a partir del
// nivel 4: en autojuego muy revuelto (p. ej. tune-values.js, que mezcla
// jugadas al azar) puede haber muchas capturas posibles a la vez, y en los
// niveles 1-3 (pensados para ser simples y rápidos, no fuertes) el coste no
// compensa la mejora táctica.
const AI_LEVELS = {
  1: { random: true },                          // al azar
  2: { depth: 1 },                              // codicioso (material inmediato)
  3: { depth: 2 },                              // minimax + alfa-beta
  4: { depth: 3, mobility: true, order: true, quiesce: true }, // + ordenación, movilidad y quietud
  5: { depth: 4, mobility: true, order: true, quiesce: true },
  6: { depth: 5, mobility: true, order: true, quiesce: true },
  7: { depth: 6, mobility: true, order: true, quiesce: true }, // lento
  // Ranura experimental. Ya no lleva valores propios: los que probaba
  // (material ajustado + movilidad) se confirmaron y son ahora el estándar de
  // todos los niveles, así que hoy juega igual que el 4. Se mantiene definido
  // para no romper partidas guardadas que apunten al nivel 8, y queda libre
  // para el siguiente experimento.
  8: { depth: 3, mobility: true, order: true, quiesce: true },
};

// Centralidad de una casilla: 1 en el centro del tablero, 0 en el borde.
// Se precalcula una vez, cx/cy ya vienen calculados por geometry.js.
const BOARD_MAX_DIST = Math.max(...CELLS.map(c => Math.hypot(c.cx, c.cy)));
function centrality(cell) { return 1 - Math.hypot(cell.cx, cell.cy) / BOARD_MAX_DIST; }

// Avance de un peón hacia su fila de coronación: 0 en su fila de salida
// (justo tras la de piezas), 1 al coronar. Ver applyMoveSim para la misma
// condición de coronación (toCell.b === N / 1 - N) expresada como fila.
function pawnAdvance(cell, color) {
  const span = 2 * N - 1;
  return color === 'w' ? (cell.b - (1 - N)) / span : (N - cell.b) / span;
}

// Todas las jugadas legales de un color: [{from, to}], sin repeticiones.
//
// Hacen falta las dos comprobaciones porque legalMoves() SÍ repite destinos:
// por una casilla triangular pasan tres carriles, y cada vecina por arista
// pertenece a dos de ellos, así que la torre (y la dama, que la incluye)
// genera dos veces su primer paso en cada dirección. No era un error visible
// —la jugada es la misma—, pero se buscaba dos veces y aquí saldría dos veces
// en la lista del análisis.
function movesForSide(board, color, ep) {
  const out = [];
  const seen = new Set();
  for (const [key, p] of board) {
    if (p.color !== color) continue;
    for (const t of legalMoves(board, key, p, ep)) {
      const id = key + '>' + t.key;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ from: key, to: t.key });
    }
  }
  return out;
}

// Aplica una jugada sobre el Map dado (mutándolo), replicando los efectos de
// tablero de makeMove: captura al paso, promoción a dama y doble avance de
// peón. Devuelve el nuevo estado de captura al paso ({targetKey, pawnKey} o
// null). No mutar las piezas originales: los Maps copiados las comparten.
function applyMoveSim(board, fromKey, toKey, ep) {
  const piece = board.get(fromKey);
  const fromCell = CELL_MAP.get(fromKey);
  const toCell = CELL_MAP.get(toKey);

  // enroque: toKey es la casilla de la torre propia (ver CASTLING en rules.js)
  if (isCastling(board, fromKey, toKey)) {
    const rook = board.get(toKey);
    const { kingTo, rookTo } = castlingLanding(piece.color, fromKey, toKey);
    board.delete(fromKey);
    board.delete(toKey);
    board.set(kingTo, { ...piece, moved: true });
    board.set(rookTo, { ...rook, moved: true });
    return null;
  }

  if (piece.type === 'P' && !board.get(toKey) && ep && toKey === ep.targetKey) {
    board.delete(ep.pawnKey);
  }
  board.delete(fromKey);
  const moved = { ...piece, moved: true };
  if (moved.type === 'P' &&
    ((moved.color === 'w' && toCell.b === N) ||
      (moved.color === 'b' && toCell.b === 1 - N))) {
    moved.type = 'Q';
  }
  board.set(toKey, moved);
  return (piece.type === 'P' && Math.abs(toCell.b - fromCell.b) === 2)
    ? { targetKey: fromCell.pawnAdv[piece.color][0].key, pawnKey: toKey }
    : null;
}

// --- Zobrist: la firma de una posición como número, mantenida por XOR ---
//
// positionKey() serializa todas las piezas a strings, ORDENA el array y lo
// une: se pagaba en cada nodo interior para la TT y la repetición. El hash
// Zobrist asigna a cada (casilla, color, tipo, moved-relevante) un número
// aleatorio fijo; la firma de la posición es el XOR de los de sus piezas, y
// una jugada la actualiza con 2-4 XOR en vez de reserializar el tablero.
//
// Claves de 64 bits sin BigInt: dos mitades de 32 (h1/h2) en Uint32Array
// paralelos. Las tablas se generan con un PRNG sembrado (mulberry32): misma
// semilla ⇒ tablas idénticas también dentro del worker, que las reconstruye
// con initZobrist() porque no puede recibirlas como constante JSON.
//
// El estado `moved` entra en el hash solo para P/R/K, exactamente como en
// positionKey (MOVED_MATTERS, rules.js): es lo que distingue posiciones a
// efectos de enroque, doble avance y repetición.
const ZOBRIST_SEED = 0x9E3779B9;
const TT_BITS = 19;
const TT_SIZE = 1 << TT_BITS;
const TT_MASK = TT_SIZE - 1;
// código 0-9 dentro de la casilla+color: tipo, y variante "sin mover" para
// los tipos donde moved importa
const Z_CODE = { P: 0, N: 1, B: 2, E: 3, R: 4, Q: 5, K: 6 };
const Z_UNMOVED = { P: 7, R: 8, K: 9 };
const Z_PER_CELL = 20;   // 10 códigos × 2 colores

function initZobrist() {
  let s = ZOBRIST_SEED >>> 0;
  const rnd = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  const nCells = CELLS.length;
  const total = nCells * Z_PER_CELL + nCells + 1;   // piezas + al paso + turno
  const h1 = new Uint32Array(total), h2 = new Uint32Array(total);
  for (let i = 0; i < total; i++) { h1[i] = rnd(); h2[i] = rnd(); }
  return { h1, h2, epBase: nCells * Z_PER_CELL, turnIdx: total - 1 };
}

function zIndex(cell, p) {
  const code = (!p.moved && Z_UNMOVED[p.type] !== undefined)
    ? Z_UNMOVED[p.type] : Z_CODE[p.type];
  return cell.idx * Z_PER_CELL + (p.color === 'b' ? 10 : 0) + code;
}

// firma (solo piezas) de un tablero entero; acepta un Map o el array de
// pares de un snapshot del historial
function computeHash(boardEntries) {
  let h1 = 0, h2 = 0;
  for (const [key, p] of boardEntries) {
    const zi = zIndex(CELL_MAP.get(key), p);
    h1 ^= ZOBRIST.h1[zi];
    h2 ^= ZOBRIST.h2[zi];
  }
  return [h1 >>> 0, h2 >>> 0];
}

// clave completa del nodo (piezas + turno + al paso) como string, para el
// mapa de repeticiones (posiciones del historial + camino de búsqueda)
function hashKey(h1, h2, color, ep) {
  if (color === 'b') { h1 ^= ZOBRIST.h1[ZOBRIST.turnIdx]; h2 ^= ZOBRIST.h2[ZOBRIST.turnIdx]; }
  if (ep) {
    const i = ZOBRIST.epBase + CELL_MAP.get(ep.targetKey).idx;
    h1 ^= ZOBRIST.h1[i]; h2 ^= ZOBRIST.h2[i];
  }
  return (h1 >>> 0) + ',' + (h2 >>> 0);
}

// La tabla de transposición: arrays paralelos de tamaño fijo, sin claves
// string ni Map. `gen` marca a qué búsqueda pertenece cada entrada, así
// "vaciar" la tabla es ttGen++ (sin recorrer nada). meta = depth*4 + flag
// (0 exact, 1 lower, 2 upper).
function ttInit() {
  TT = {
    h2: new Uint32Array(TT_SIZE),
    meta: new Int32Array(TT_SIZE),
    score: new Float64Array(TT_SIZE),
    gen: new Uint32Array(TT_SIZE),
    mv: new Int32Array(TT_SIZE),    // mejor jugada empaquetada (o -1)
  };
}

// Jugada como entero: idx(origen)*128 + idx(destino). Sirve de identidad
// compacta para el hash-move de la TT, los killers y la tabla de historia.
function packMove(m) {
  return CELL_MAP.get(m.from).idx * 128 + CELL_MAP.get(m.to).idx;
}

// XOR de la pieza `p` tal como está AHORA en `cellKey` sobre la firma de sx.
// Autoinversa: la misma llamada añade o quita. Se llama antes de mutar una
// pieza (quita su estado viejo) y después (añade el nuevo).
function zxor(sx, cellKey, p) {
  const zi = zIndex(CELL_MAP.get(cellKey), p);
  sx.h1 = (sx.h1 ^ ZOBRIST.h1[zi]) >>> 0;
  sx.h2 = (sx.h2 ^ ZOBRIST.h2[zi]) >>> 0;
}

// (el worker declara estos tres con líneas propias en aiWorkerSource; aquí
// viven para el hilo principal, Node y los drivers de entrenamiento)
let TT = null;
let ttGen = 0;
const ZOBRIST = initZobrist();

// --- make/unmake: la búsqueda muta UN tablero en sitio y deshace ---
//
// Hasta aquí cada nodo copiaba el Map entero (~40 piezas) y cada test de
// legalidad otro más. Ahora chooseAiMove hace UNA copia profunda en la raíz
// (innegociable: game.board llega por referencia en la vía síncrona, y los
// snapshots del historial comparten los objetos-pieza con el tablero vivo) y
// a partir de ahí makeSim/unmakeSim mutan esa copia y sus piezas en sitio.
// El registro de undo es un objeto reutilizable por ply: cero asignaciones
// por nodo.

function deepCopyBoard(board) {
  const out = new Map();
  for (const [k, p] of board) out.set(k, { ...p });
  return out;
}

// Aplica la jugada mutando tablero y pieza, apunta lo necesario para
// deshacerla en `u`, mantiene `kings` (color → clave de su rey) y devuelve
// el nuevo estado de captura al paso. Mismos efectos que applyMoveSim.
// Con `sx` (opcional) mantiene además la firma Zobrist de sx.h1/h2: los
// sondeos de legalidad llaman sin sx (nadie lee el hash ahí) y el que llama
// con sx guarda y repone h1/h2 alrededor del par make/unmake, que es más
// barato que deshacer los XOR uno a uno.
function makeSim(board, fromKey, toKey, ep, u, kings, sx) {
  const piece = board.get(fromKey);
  u.fromKey = fromKey; u.toKey = toKey; u.piece = piece;
  u.prevMoved = piece.moved; u.prevType = piece.type;
  u.captured = null; u.capturedKey = null; u.castle = null;

  // enroque: toKey es la casilla de la torre propia (ver CASTLING en rules.js)
  if (isCastling(board, fromKey, toKey)) {
    const rook = board.get(toKey);
    const { kingTo, rookTo } = castlingLanding(piece.color, fromKey, toKey);
    u.castle = { rook, rookPrevMoved: rook.moved, kingTo, rookTo };
    if (sx) { zxor(sx, fromKey, piece); zxor(sx, toKey, rook); }
    board.delete(fromKey);
    board.delete(toKey);
    piece.moved = true;
    rook.moved = true;
    board.set(kingTo, piece);
    board.set(rookTo, rook);
    kings[piece.color] = kingTo;
    if (sx) { zxor(sx, kingTo, piece); zxor(sx, rookTo, rook); }
    return null;
  }

  if (piece.type === 'P' && !board.get(toKey) && ep && toKey === ep.targetKey) {
    u.captured = board.get(ep.pawnKey);
    u.capturedKey = ep.pawnKey;
    if (sx) zxor(sx, ep.pawnKey, u.captured);
    board.delete(ep.pawnKey);
  } else {
    const v = board.get(toKey);
    if (v) {
      u.captured = v;
      u.capturedKey = toKey;
      if (sx) zxor(sx, toKey, v);
    }
  }
  if (sx) zxor(sx, fromKey, piece);   // estado viejo, antes de mutar
  board.delete(fromKey);
  piece.moved = true;
  const fromCell = CELL_MAP.get(fromKey);
  const toCell = CELL_MAP.get(toKey);
  if (piece.type === 'P' &&
    ((piece.color === 'w' && toCell.b === N) ||
      (piece.color === 'b' && toCell.b === 1 - N))) {
    piece.type = 'Q';
  }
  board.set(toKey, piece);
  if (sx) zxor(sx, toKey, piece);     // estado nuevo (movida y quizá coronada)
  if (u.prevType === 'K') kings[piece.color] = toKey;
  return (u.prevType === 'P' && Math.abs(toCell.b - fromCell.b) === 2)
    ? { targetKey: fromCell.pawnAdv[piece.color][0].key, pawnKey: toKey }
    : null;
}

function unmakeSim(board, u, kings) {
  const piece = u.piece;
  if (u.castle) {
    board.delete(u.castle.kingTo);
    board.delete(u.castle.rookTo);
    piece.moved = u.prevMoved;
    u.castle.rook.moved = u.castle.rookPrevMoved;
    board.set(u.fromKey, piece);
    board.set(u.toKey, u.castle.rook);
    kings[piece.color] = u.fromKey;
    return;
  }
  board.delete(u.toKey);
  piece.moved = u.prevMoved;
  piece.type = u.prevType;
  board.set(u.fromKey, piece);
  if (u.captured) board.set(u.capturedKey, u.captured);
  if (u.prevType === 'K') kings[piece.color] = u.fromKey;
}

// Jugadas legales para la búsqueda: como movesForSide pero validando con
// make/unmake sobre el mismo tablero en vez de copiar el Map por candidato
// (y con el rey localizado en `kings`, sin el barrido lineal de findKing).
// Conserva el orden de movesForSide: piezas en orden del Map y el enroque
// pegado a las demás jugadas del rey.
function genMoves(board, color, ep, kings, probe) {
  const out = [];
  const seen = new Set();
  // Lista congelada: el sondeo con make/unmake borra y reinserta entradas, y
  // un Map de JS recoloca lo reinsertado AL FINAL del orden de iteración —
  // iterando el Map vivo, cada pieza sondeada se visitaría otra vez.
  const entries = [...board.entries()];
  for (const [key, p] of entries) {
    if (p.color !== color) continue;
    const cell = CELL_MAP.get(key);
    for (const t of pseudoMoves(board, cell, p, ep)) {
      const id = key + '>' + t.key;
      if (seen.has(id)) continue;
      seen.add(id);
      makeSim(board, key, t.key, ep, probe, kings);
      const ok = !isAttackedFast(board, CELL_MAP.get(kings[color]), rival(color));
      unmakeSim(board, probe, kings);
      if (ok) out.push({ from: key, to: t.key });
    }
    // castleMoves ya devuelve el enroque comprobado; sus 2-6 copias de Map
    // solo se pagan mientras el rey conserva el derecho a enrocar
    if (p.type === 'K') {
      for (const t of castleMoves(board, key, p)) out.push({ from: key, to: t.key });
    }
  }
  return out;
}

// Material (y movilidad, según nivel) desde el punto de vista de `color`.
function evaluate(board, color, cfg) {
  const values = cfg.pieceValues || PIECE_VALUE;
  const posW = cfg.positionWeights;
  // 4 puntos por jugada disponible. Confirmado a prof. 2-3 que gana fuerza
  // sobre el 2 clásico (~+58 elo el salto de 2 a 4 junto con el material
  // ajustado). Un cfg puede seguir sustituyéndolo para experimentar.
  const mobilityWeight = cfg.mobilityWeight ?? 4;
  let score = 0;
  for (const [key, p] of board) {
    const sign = p.color === color ? 1 : -1;
    score += sign * values[p.type];
    if (cfg.mobility) {
      score += sign * mobilityWeight * countPseudoMoves(board, CELL_MAP.get(key), p);
    }
    const pw = posW && posW[p.type];
    if (pw) {
      const cell = CELL_MAP.get(key);
      if (pw.centrality) score += sign * pw.centrality * centrality(cell);
      if (pw.advance) score += sign * pw.advance * pawnAdvance(cell, p.color);
    }
  }
  return score;
}

// Pieza capturada por una jugada, o null si no captura. Ojo: "hay algo en la
// casilla de destino" no basta, porque el enroque aterriza sobre la torre
// propia (ver CASTLING en rules.js); de ahí la comprobación de color.
function capturedBy(board, m) {
  const v = board.get(m.to);
  return v && v.color !== board.get(m.from).color ? v : null;
}

// capturas primero, ordenadas por MVV-LVA (la víctima más valiosa con el
// atacante más barato antes: es lo que más probablemente aguanta la
// recaptura); los empates se rompen por la clave from>to para que el orden
// no dependa del orden interno del Map del tablero (make/unmake reinserta
// piezas al final y lo va barajando; sin desempate fijo, el árbol explorado
// cambiaría de una ejecución a otra)
function orderMoves(board, moves, values = PIECE_VALUE) {
  const gain = m => {
    const v = capturedBy(board, m);
    return v ? values[v.type] * 1024 - values[board.get(m.from).type] : -1;
  };
  moves.sort((m1, m2) => (gain(m2) - gain(m1)) ||
    (m1.from + m1.to < m2.from + m2.to ? -1 : 1));
}

// Ordenación de la búsqueda interior: hash-move de la TT primero (la mejor
// jugada que esta misma posición tuvo la última vez que se buscó), después
// capturas por MVV-LVA, después los dos killers del ply (jugadas tranquilas
// que acaban de provocar un corte a esta altura: suelen repetirse entre
// ramas hermanas), y el resto por la tabla de historia (cuántos cortes ha
// provocado cada par origen-destino en esta búsqueda, con más peso cuanto
// más profundos). Deja m.pk calculado para el bucle.
function orderSearchMoves(board, moves, values, hashMv, killers, history) {
  for (const m of moves) {
    const pk = packMove(m);
    m.pk = pk;
    if (pk === hashMv) { m.ord = 2e9; continue; }
    const v = capturedBy(board, m);
    if (v) { m.ord = 1e9 + values[v.type] * 1024 - values[board.get(m.from).type]; continue; }
    if (pk === killers[0]) { m.ord = 9e8; continue; }
    if (pk === killers[1]) { m.ord = 8.9e8; continue; }
    m.ord = history[pk];
  }
  moves.sort((m1, m2) => (m2.ord - m1.ord) || (m1.pk - m2.pk));
}

// Cuenta de una tirada de rayos sin construir el array (ver slideMoves, que
// es idéntico pero materializa la lista).
function countSlide(board, piece, rays) {
  let n = 0;
  for (const ray of rays) {
    for (const t of ray) {
      const occ = board.get(t.key);
      if (!occ) { n++; continue; }
      if (occ.color !== piece.color) n++;
      break;
    }
  }
  return n;
}

// pseudoMoves(...).length sin materializar los arrays: es lo único que
// necesita la movilidad de evaluate(), que generaba y descartaba un array
// por pieza en cada hoja. Replica la cuenta EXACTA con ep = null, incluidos
// los destinos repetidos donde los rayos solapan (la movilidad de siempre
// los cuenta, y cambiarlo sería cambiar la evaluación). El peón delega en
// pseudoMoves: sus listas son diminutas y la deduplicación del doble avance
// es demasiado delicada para duplicarla.
function countPseudoMoves(board, cell, piece) {
  switch (piece.type) {
    case 'R': return countSlide(board, piece, cell.rookRays);
    case 'B': return countSlide(board, piece, cell.bishopRays);
    case 'Q': return countSlide(board, piece, cell.rookRays)
      + countSlide(board, piece, cell.elephantRays);
    case 'E': return countSlide(board, piece, cell.elephantRays);
    case 'N': {
      let n = 0;
      for (const t of cell.knightTargets) {
        const o = board.get(t.key);
        if (!o || o.color !== piece.color) n++;
      }
      return n;
    }
    case 'K': {
      let n = 0;
      for (const t of cell.kingNbrs) {
        const o = board.get(t.key);
        if (!o || o.color !== piece.color) n++;
      }
      return n;
    }
    case 'P': return pseudoMoves(board, cell, piece, null).length;
  }
  return 0;
}

// ¿Ataca `byColor` la casilla `cell`? Como isAttacked (rules.js), pero
// dirigida: en vez de recorrer todas las piezas rivales generando sus listas
// completas de ataques, mira DESDE la casilla hacia fuera con los rayos y
// saltos precalculados de geometry.js, que son simétricos (el camino de ida
// es el de vuelta; el salto de caballo invierte la orientación ▲/▽ en ambos
// sentidos; los atacantes-peón de un color están en las casillas de captura
// del color contrario). Cientos de arrays y .includes() se convierten en
// ~40-60 board.get() con parada temprana y cero asignaciones.
//
// Equivalente a la vieja en su dominio de uso (el objetivo nunca es una
// casilla ocupada por una pieza de byColor: siempre se pregunta por el rey
// del OTRO color). Fuera de ese dominio la vieja tiene rarezas heredadas
// (el peón "ataca" casillas ocupadas por los suyos, el caballo no) que no
// merece la pena replicar.
function isAttackedFast(board, cell, byColor) {
  for (const ray of cell.rookRays) {
    for (const t of ray) {
      const o = board.get(t.key);
      if (!o) continue;
      if (o.color === byColor && (o.type === 'R' || o.type === 'Q')) return true;
      break;
    }
  }
  for (const ray of cell.elephantRays) {
    for (const t of ray) {
      const o = board.get(t.key);
      if (!o) continue;
      if (o.color === byColor && (o.type === 'E' || o.type === 'Q')) return true;
      break;
    }
  }
  for (const ray of cell.bishopRays) {
    for (const t of ray) {
      const o = board.get(t.key);
      if (!o) continue;
      if (o.color === byColor && o.type === 'B') return true;
      break;
    }
  }
  for (const t of cell.knightTargets) {
    const o = board.get(t.key);
    if (o && o.color === byColor && o.type === 'N') return true;
  }
  for (const t of cell.kingNbrs) {
    const o = board.get(t.key);
    if (o && o.color === byColor && o.type === 'K') return true;
  }
  for (const t of cell.pawnCap[rival(byColor)]) {
    const o = board.get(t.key);
    if (o && o.color === byColor && o.type === 'P') return true;
  }
  return false;
}

// Primer ocupante de cada rayo, si es rival: los únicos destinos de captura
// de una pieza deslizante.
function rayCaptures(board, color, rays, out) {
  for (const ray of rays) {
    for (const t of ray) {
      const occ = board.get(t.key);
      if (!occ) continue;
      if (occ.color !== color) out.push(t);
      break;
    }
  }
}

// Capturas legales de un color, generadas directamente. quiesce() pagaba
// movesForSide entero —generación Y comprobación de legalidad de TODOS los
// movimientos, cada una con su copia de tablero— para quedarse con 2-6
// capturas. Aquí solo nacen los destinos con pieza rival y solo esos pasan
// el test de legalidad.
//
// Replica el filtro actual `capturedBy != null`: NI captura al paso (su
// destino está vacío, así que hoy tampoco entra en quiesce — corregir eso
// será un cambio aparte y medido con la arena), NI enroque (aterriza sobre
// torre propia). El Set deduplica el primer paso de los rayos de torre/dama
// que solapan, como hace movesForSide.
function genCaptures(board, color, ep, kings, probe) {
  const out = [];
  const seen = new Set();
  const cands = [];
  // lista congelada por la misma razón que en genMoves: el sondeo reordena el Map
  const entries = [...board.entries()];
  for (const [key, p] of entries) {
    if (p.color !== color) continue;
    const cell = CELL_MAP.get(key);
    cands.length = 0;
    switch (p.type) {
      case 'R': rayCaptures(board, color, cell.rookRays, cands); break;
      case 'B': rayCaptures(board, color, cell.bishopRays, cands); break;
      case 'Q':
        rayCaptures(board, color, cell.rookRays, cands);
        rayCaptures(board, color, cell.elephantRays, cands);
        break;
      case 'E': rayCaptures(board, color, cell.elephantRays, cands); break;
      case 'N':
        for (const t of cell.knightTargets) {
          const o = board.get(t.key);
          if (o && o.color !== color) cands.push(t);
        }
        break;
      case 'K':
        for (const t of cell.kingNbrs) {
          const o = board.get(t.key);
          if (o && o.color !== color) cands.push(t);
        }
        break;
      case 'P':
        for (const t of cell.pawnCap[color]) {
          const o = board.get(t.key);
          if (o && o.color !== color) cands.push(t);
        }
        break;
    }
    for (const t of cands) {
      const id = key + '>' + t.key;
      if (seen.has(id)) continue;
      seen.add(id);
      makeSim(board, key, t.key, ep, probe, kings);
      const ok = !isAttackedFast(board, CELL_MAP.get(kings[color]), rival(color));
      unmakeSim(board, probe, kings);
      if (ok) out.push({ from: key, to: t.key });
    }
  }
  return out;
}

// Búsqueda de quietud: al llegar a una hoja, evaluate() puede pillar la
// posición a mitad de un intercambio de capturas (efecto horizonte) y ver
// una pieza como perdida sin ver la recaptura que la compensa. quiesce()
// sigue explorando, pero solo capturas, hasta que no quede ninguna a mano
// o el resultado ya sea peor que lo que el rival puede forzar (poda alfa-
// beta), y usa evaluate() como "stand pat": la posición tal cual, sin más
// capturas, es al menos tan buena como el peor caso de seguir capturando.
function quiesce(board, color, ep, clock, keys, alpha, beta, cfg, qdepth, sx, ply) {
  const values = cfg.pieceValues || PIECE_VALUE;
  const standPat = evaluate(board, color, cfg);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;
  if (qdepth <= 0) return alpha;

  const captures = genCaptures(board, color, ep, sx.kings, sx.probe);
  if (captures.length === 0) return alpha;
  if (cfg.order) orderMoves(board, captures, values);
  const u = sx.undo[ply];
  for (const m of captures) {
    const gain = values[capturedBy(board, m).type];
    if (standPat + gain + DELTA_MARGIN < alpha) continue;   // poda por diferencia
    const nextEp = makeSim(board, m.from, m.to, ep, u, sx.kings);
    const score = -quiesce(board, rival(color), nextEp, 0, keys, -beta, -alpha, cfg,
      qdepth - 1, sx, ply + 1);
    unmakeSim(board, u, sx.kings);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

// `clock` son las medias jugadas sin captura ni peón; `keys` es un Map con
// las posiciones ya vistas (historial real + camino de búsqueda actual),
// con claves 'h1,h2' de hashKey(). La tabla de transposición es la TT
// global de arrays (ver ttInit): evita repetir trabajo cuando dos
// secuencias distintas llegan a la misma posición, indexada por la firma
// Zobrist que sx.h1/h2 mantienen por XOR — aquí ya no se serializa nada.
function negamax(board, color, ep, clock, keys, depth, alpha, beta, cfg, sx, ply) {
  const values = cfg.pieceValues || PIECE_VALUE;
  // tablas por la regla de los 50 movimientos (ver FIFTY_MOVE_LIMIT en rules.js)
  if (clock >= FIFTY_MOVE_LIMIT) return drawScore(board, color, values);

  // clave completa del nodo: firma de piezas + turno + al paso
  let kh1 = sx.h1, kh2 = sx.h2;
  if (color === 'b') { kh1 ^= ZOBRIST.h1[ZOBRIST.turnIdx]; kh2 ^= ZOBRIST.h2[ZOBRIST.turnIdx]; }
  if (ep) {
    const i = ZOBRIST.epBase + CELL_MAP.get(ep.targetKey).idx;
    kh1 ^= ZOBRIST.h1[i]; kh2 ^= ZOBRIST.h2[i];
  }
  kh1 >>>= 0; kh2 >>>= 0;

  // repetición: ver una posición por segunda vez ya se puntúa como tablas
  // (basta para detectar perpetuos con poca profundidad); la DETECCIÓN solo
  // puede saltar tras 4 medias jugadas reversibles (guarda del clock), pero
  // el REGISTRO (más abajo) es incondicional: un descendiente con clock
  // alto tiene que poder reconocer a un ancestro que aún lo tenía bajo. El
  // string solo se construye cuando hace falta: las hojas que se van a
  // quiesce con clock bajo no pagan nada.
  let key = null;
  if (clock >= 4) {
    key = kh1 + ',' + kh2;
    if (keys.has(key)) return drawScore(board, color, values);
  }

  // en las hojas, los niveles que lo piden siguen explorando por capturas
  // (quiesce) en vez de evaluar tal cual, para no cortar a mitad de un
  // intercambio; el resto evalúa directamente, como antes
  if (depth === 0) {
    return cfg.quiesce
      ? quiesce(board, color, ep, clock, keys, alpha, beta, cfg, QUIESCE_MAX_DEPTH, sx, ply)
      : evaluate(board, color, cfg);
  }
  if (key === null) key = kh1 + ',' + kh2;

  const alphaOrig = alpha;
  const idx = kh1 & TT_MASK;
  // entrada válida: de esta búsqueda (gen) y verificada con la otra mitad
  // de la firma (la probabilidad de que dos posiciones distintas compartan
  // índice Y h2 es despreciable)
  const hit = TT.gen[idx] === ttGen && TT.h2[idx] === kh2;
  if (hit && (TT.meta[idx] >> 2) >= depth) {
    const sc = TT.score[idx], flag = TT.meta[idx] & 3;
    if (flag === 0) return sc;                        // exact
    if (flag === 1) { if (sc > alpha) alpha = sc; }   // lower
    else if (sc < beta) beta = sc;                    // upper
    if (alpha >= beta) return sc;
  }

  const moves = genMoves(board, color, ep, sx.kings, sx.probe);
  if (moves.length === 0) {
    // mate (los más rápidos puntúan más) o tablas por ahogado
    return isAttackedFast(board, CELL_MAP.get(sx.kings[color]), rival(color))
      ? -MATE - depth : drawScore(board, color, values);
  }
  if (cfg.order) {
    orderSearchMoves(board, moves, values, hit ? TT.mv[idx] : -1,
      sx.killers[ply], sx.history);
  }
  // registrar la posición para que las líneas descendientes la detecten
  keys.set(key, (keys.get(key) || 0) + 1);
  let best = -Infinity;
  let bestMv = -1;
  const u = sx.undo[ply];
  for (const m of moves) {
    const captura = capturedBy(board, m);
    const nextClock = (captura || board.get(m.from).type === 'P') ? 0 : clock + 1;
    const ph1 = sx.h1, ph2 = sx.h2;
    const nextEp = makeSim(board, m.from, m.to, ep, u, sx.kings, sx);
    const score = -negamax(board, rival(color), nextEp, nextClock, keys, depth - 1,
      -beta, -alpha, cfg, sx, ply + 1);
    unmakeSim(board, u, sx.kings);
    sx.h1 = ph1; sx.h2 = ph2;
    if (score > best) {
      best = score;
      bestMv = m.pk !== undefined ? m.pk : packMove(m);
    }
    if (best > alpha) alpha = best;
    if (alpha >= beta) {
      // una jugada tranquila que corta se apunta como killer del ply y suma
      // historia (con más peso cuanto más profunda era la búsqueda restante)
      if (!captura && cfg.order) {
        const k = sx.killers[ply];
        if (k[0] !== m.pk) { k[1] = k[0]; k[0] = m.pk; }
        sx.history[m.pk] += depth * depth;
      }
      break;
    }
  }
  const n = keys.get(key) - 1;
  if (n > 0) keys.set(key, n); else keys.delete(key);

  // flag: si ningún movimiento superó alfa, `best` es solo una cota
  // superior (podría ser peor con más tiempo); si se produjo un corte beta,
  // es una cota inferior (podría ser mejor); si no, es el valor exacto.
  // Política de reemplazo de siempre (la entrada previa gana si es más
  // profunda); una entrada de otra posición o de otra búsqueda (gen) se
  // pisa sin contemplaciones.
  if (!hit || (TT.meta[idx] >> 2) <= depth) {
    TT.gen[idx] = ttGen;
    TT.h2[idx] = kh2;
    TT.meta[idx] = depth * 4 + (best <= alphaOrig ? 2 : best >= beta ? 1 : 0);
    TT.score[idx] = best;
    TT.mv[idx] = bestMv;
  }
  return best;
}

// Estado mínimo que necesita la búsqueda, extraído de `game`. Es también lo
// que viaja al worker de ai-async.js, por lo que solo contiene datos
// clonables (el Map del tablero, escalares y claves de posición).
function searchState() {
  const posKeys = [], posHashes = [];
  for (let i = 0; i <= game.histIndex; i++) {
    const s = game.history[i];
    posKeys.push(s.posKey);
    // clave 'h1,h2' de cada posición del historial, en el mismo formato que
    // usa negamax para las repeticiones (se calcula aquí, en el hilo que
    // tiene el historial; al worker viajan solo los strings)
    const [h1, h2] = computeHash(s.board);
    posHashes.push(hashKey(h1, h2, s.turn, s.enPassant));
  }
  return { board: game.board, turn: game.turn, enPassant: game.enPassant,
           clock: game.clock, posKeys, posHashes };
}

// Lo mismo, pero para una posición cualquiera del historial (la usa el
// análisis a petición cuando se está revisando una jugada pasada). Solo se
// llama desde el hilo principal, para construir el mensaje: no hace falta
// mandarla al worker.
function stateAtIndex(i) {
  const s = game.history[i];
  const posKeys = [], posHashes = [];
  for (let j = 0; j <= i; j++) {
    const sj = game.history[j];
    posKeys.push(sj.posKey);
    const [h1, h2] = computeHash(sj.board);
    posHashes.push(hashKey(h1, h2, sj.turn, sj.enPassant));
  }
  return { board: new Map(s.board.map(([k, p]) => [k, { ...p }])), turn: s.turn,
           enPassant: s.enPassant, clock: s.clock, posKeys, posHashes };
}

// Margen (en centipeones) dentro del cual una jugada se considera tan buena
// como la mejor a efectos del sorteo de chooseAiMove.
const PLAY_TOLERANCE = 25;

// Elige la jugada del ordenador según el nivel, para la posición actual o
// para el estado `st` dado. Devuelve {from, to} o null si no hay jugadas.
//
// Con opts.analyze, además, adjunta a la jugada devuelta un `analysis`: la
// lista de TODAS las jugadas legales con su puntuación, ordenada de mejor a
// peor y con `chosen` marcado en la elegida (que no siempre es la primera,
// ver el sorteo por PLAY_TOLERANCE más abajo). Eso obliga a buscar con
// ventana completa, que cuesta 2-3 veces más: ver el comentario del bucle.
function chooseAiMove(level, st = searchState(), opts = {}) {
  const cfg = AI_LEVELS[level] || AI_LEVELS[1];
  // Copia profunda ÚNICA de la posición: en la vía síncrona st.board es el
  // Map vivo de la partida (searchState no copia) y los snapshots del
  // historial comparten los objetos-pieza. La búsqueda muta tablero y piezas
  // en sitio (make/unmake), así que necesita ejemplares propios.
  const board = deepCopyBoard(st.board);
  const kings = { w: null, b: null };
  for (const [key, p] of board) if (p.type === 'K') kings[p.color] = key;
  // contexto de búsqueda: registros de undo preasignados por ply (ninguna
  // asignación por nodo), otro para los sondeos de legalidad, killers por
  // ply y tabla de historia origen-destino. Killers e historia viven SOLO
  // dentro de esta llamada: la arena alterna dos configuraciones en el
  // mismo proceso y no deben contaminarse entre sí.
  const plies = (cfg.depth || 1) + QUIESCE_MAX_DEPTH + 4;
  const sx = {
    kings,
    probe: {},
    undo: Array.from({ length: plies }, () => ({})),
    killers: Array.from({ length: plies }, () => [-1, -1]),
    history: new Int32Array(128 * 128),
    h1: 0, h2: 0,
  };
  const moves = genMoves(board, st.turn, st.enPassant, kings, sx.probe);
  if (moves.length === 0) return null;
  // el nivel 1 juega al azar: no hay puntuaciones que enseñar
  if (cfg.random) {
    const m = moves[Math.floor(Math.random() * moves.length)];
    return opts.analyze ? { ...m, analysis: null } : m;
  }
  if (cfg.order) orderMoves(board, moves, cfg.pieceValues || PIECE_VALUE);

  // firma Zobrist de la raíz y TT lista (ttGen++ = tabla "vacía" sin borrar)
  const [rh1, rh2] = computeHash(board);
  sx.h1 = rh1; sx.h2 = rh2;
  if (!TT) ttInit();
  ttGen++;

  // posiciones ya vistas en la partida, para las repeticiones en la
  // búsqueda; las claves 'h1,h2' las trae st.posHashes (searchState). El
  // st.posKeys de siempre sigue existiendo para quien lo lea, pero la
  // búsqueda ya no lo usa.
  const keys = new Map();
  for (const k of (st.posHashes || [])) keys.set(k, (keys.get(k) || 0) + 1);

  // Bucle raíz: acumula las jugadas que quedan a menos de PLAY_TOLERANCE de
  // la mejor y sortea entre ellas. Antes se acumulaban solo las EMPATADAS a
  // mejor puntuación, pero con la ventana estrecha los empates exactos casi
  // nunca se dan: la partida salía idéntica cada vez (muy visible en
  // ordenador contra ordenador).
  //
  // De ahí el +PLAY_TOLERANCE en beta: con la ventana justa (-best + 1) las
  // jugadas peores que la mejor solo devuelven una COTA superior, y una
  // jugada con cota best−5 puede ser en realidad malísima, así que no se
  // puede sortear con ellas. Ensanchando la ventana esa tolerancia, toda
  // jugada dentro de la banda devuelve su puntuación EXACTA, y las que se
  // salen fallan alto y quedan por debajo de best − PLAY_TOLERANCE, que es
  // justo lo que hace falta para descartarlas. Cuesta prácticamente lo mismo
  // que la ventana justa (25 centipeones apenas abren nodos extra); la otra
  // vía, una segunda pasada que rebusque cada candidata con ventana acotada,
  // medía 2,6x.
  //
  // La banda es absoluta, no un porcentaje: un umbral relativo se rompe con
  // puntuaciones negativas (ver la historia de este criterio junto a run() en
  // tune-values.js) y se ensancharía de más en posiciones ya decididas. Con
  // 25 centipeones el sorteo solo entra entre jugadas prácticamente
  // equivalentes, así que da variedad sin debilitar el juego.
  //
  // El autojuego de entrenamiento (tune-values.js) usa esta misma función:
  // aprende de partidas jugadas exactamente como juega el ordenador real.
  //
  // En modo análisis la ventana se abre del todo (beta = Infinity). Es justo
  // lo que la ventana estrecha evita, y por eso cuesta 2-3 veces más: sin
  // beta no hay cortes entre jugadas hermanas. Pero es la única forma de que
  // las jugadas MALAS devuelvan su puntuación real y no una cota superior
  // (una jugada con cota −40 puede ser en realidad −900), que es justo lo
  // que hay que enseñar para poder comparar unas jugadas con otras.
  let best = -Infinity;
  const scored = [];
  const u = sx.undo[0];
  for (const m of moves) {
    const nextClock = (capturedBy(board, m) || board.get(m.from).type === 'P')
      ? 0 : st.clock + 1;
    const ph1 = sx.h1, ph2 = sx.h2;
    const nextEp = makeSim(board, m.from, m.to, st.enPassant, u, kings, sx);
    const score = -negamax(board, rival(st.turn), nextEp, nextClock, keys,
      cfg.depth - 1, -Infinity, opts.analyze ? Infinity : -best + PLAY_TOLERANCE + 1,
      cfg, sx, 1);
    unmakeSim(board, u, kings);
    sx.h1 = ph1; sx.h2 = ph2;
    if (score > best) best = score;
    scored.push({ move: m, score });
  }

  // el filtro va al final porque `best` sube durante el bucle; las jugadas
  // buscadas antes con un `best` más bajo tenían una ventana MÁS ancha, así
  // que su puntuación sigue siendo exacta (o una cota aún más baja) y el
  // filtro las trata igual de bien
  const top = scored.filter(s => s.score >= best - PLAY_TOLERANCE);
  const chosen = top[Math.floor(Math.random() * top.length)].move;
  if (!opts.analyze) return chosen;
  scored.sort((a, b) => b.score - a.score);
  return {
    ...chosen,
    analysis: scored.map(s => ({
      from: s.move.from, to: s.move.to, score: s.score,
      // por identidad, no por from/to: en el enroque `to` es la casilla de
      // la torre y no distingue lo bastante (ver CASTLING en rules.js)
      ...(s.move === chosen ? { chosen: true } : {}),
    })),
  };
}

