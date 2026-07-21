// ai.js — Jugador automático con varios niveles de capacidad.
//
// Trabaja siempre sobre copias del tablero (Map) y con un estado de captura
// al paso explícito, sin tocar el objeto global `game` salvo para leerlo
// en chooseAiMove.

const PIECE_VALUE = { P: 100, N: 300, B: 330, E: 350, R: 500, Q: 900, K: 0 };
// Valores experimentales para el nivel 8: se actualizan pegando la línea que
// imprime `node tune-values.js` (aprendidos de autojuego, ver ese script).
// No los usa ningún otro nivel, así que se pueden probar sin arriesgar el
// balance de PIECE_VALUE.
const PIECE_VALUE_TUNED = { P: 100, N: 265, B: 335, E: 358, R: 483, Q: 981, K: 0 };
// Bonificación posicional experimental para el nivel 8, en las mismas
// unidades que PIECE_VALUE (centipeón): "centrality" premia estar cerca del
// centro del tablero, "advance" (solo peones) premia acercarse a la fila de
// coronación. Igual que PIECE_VALUE_TUNED, se actualiza pegando la salida de
// `node tune-values.js`; empieza en 0 (sin efecto) hasta la primera corrida.
const PIECE_POSITION_TUNED = {
  P: { centrality: -2, advance: 21 },
  N: { centrality: 13 },
  B: { centrality: -6 },
  E: { centrality: -3 },
  R: { centrality: 21 },
  Q: { centrality: 14 },
};
// Cuánto vale cada jugada disponible al contar movilidad; el resto de
// niveles usan el 2 fijo de siempre (ver evaluate()). También se actualiza
// pegando la salida de `node tune-values.js`.
const MOBILITY_WEIGHT_TUNED = 1.61;
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
  8: { depth: 3, mobility: true, order: true, quiesce: true, pieceValues: PIECE_VALUE_TUNED,
    positionWeights: PIECE_POSITION_TUNED, mobilityWeight: MOBILITY_WEIGHT_TUNED }, // experimental
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

// Todas las jugadas legales de un color: [{from, to}].
function movesForSide(board, color, ep) {
  const out = [];
  for (const [key, p] of board) {
    if (p.color !== color) continue;
    for (const t of legalMoves(board, key, p, ep)) out.push({ from: key, to: t.key });
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

// Material (y movilidad, según nivel) desde el punto de vista de `color`.
function evaluate(board, color, cfg) {
  const values = cfg.pieceValues || PIECE_VALUE;
  const posW = cfg.positionWeights;
  // 2 puntos por jugada disponible es el valor de siempre; el nivel 8 puede
  // sustituirlo por MOBILITY_WEIGHT_TUNED (ver AI_LEVELS y tune-values.js)
  const mobilityWeight = cfg.mobilityWeight ?? 2;
  let score = 0;
  for (const [key, p] of board) {
    const sign = p.color === color ? 1 : -1;
    score += sign * values[p.type];
    if (cfg.mobility) {
      score += sign * mobilityWeight * pseudoMoves(board, CELL_MAP.get(key), p, null).length;
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

// capturas primero, la pieza más valiosa antes
function orderMoves(board, moves, values = PIECE_VALUE) {
  const gain = m => { const v = board.get(m.to); return v ? values[v.type] : -1; };
  moves.sort((m1, m2) => gain(m2) - gain(m1));
}

// Búsqueda de quietud: al llegar a una hoja, evaluate() puede pillar la
// posición a mitad de un intercambio de capturas (efecto horizonte) y ver
// una pieza como perdida sin ver la recaptura que la compensa. quiesce()
// sigue explorando, pero solo capturas, hasta que no quede ninguna a mano
// o el resultado ya sea peor que lo que el rival puede forzar (poda alfa-
// beta), y usa evaluate() como "stand pat": la posición tal cual, sin más
// capturas, es al menos tan buena como el peor caso de seguir capturando.
function quiesce(board, color, ep, clock, keys, alpha, beta, cfg, qdepth) {
  const values = cfg.pieceValues || PIECE_VALUE;
  const standPat = evaluate(board, color, cfg);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;
  if (qdepth <= 0) return alpha;

  const captures = movesForSide(board, color, ep).filter(m => board.get(m.to));
  if (captures.length === 0) return alpha;
  if (cfg.order) orderMoves(board, captures, values);
  for (const m of captures) {
    const gain = values[board.get(m.to).type];
    if (standPat + gain + DELTA_MARGIN < alpha) continue;   // poda por diferencia
    const copy = new Map(board);
    const nextEp = applyMoveSim(copy, m.from, m.to, ep);
    const score = -quiesce(copy, rival(color), nextEp, 0, keys, -beta, -alpha, cfg, qdepth - 1);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

// `clock` son las medias jugadas sin captura ni peón; `keys` es un Map con
// las posiciones ya vistas (historial real + camino de búsqueda actual);
// `tt` es la tabla de transposición de esta búsqueda (ver chooseAiMove): un
// Map posición → { depth, score, flag } que evita repetir trabajo cuando
// dos secuencias de jugadas distintas llegan a la misma posición (algo
// frecuente: intercambiar dos jugadas propias que no interfieren entre sí
// da la misma posición final). Vive solo dentro de una llamada a
// chooseAiMove; no se comparte entre jugadas ni entre niveles.
function negamax(board, color, ep, clock, keys, depth, alpha, beta, cfg, tt) {
  const values = cfg.pieceValues || PIECE_VALUE;
  // tablas por la regla de los 50 movimientos (ver FIFTY_MOVE_LIMIT en rules.js)
  if (clock >= FIFTY_MOVE_LIMIT) return drawScore(board, color, values);
  // repetición: ver una posición por segunda vez ya se puntúa como tablas
  // (basta para detectar perpetuos con poca profundidad); solo puede darse
  // tras al menos 4 medias jugadas reversibles, de ahí la guarda
  const key = clock >= 4 ? positionKey(board, color, ep) : null;
  if (key && keys.has(key)) return drawScore(board, color, values);

  // en las hojas, los niveles que lo piden siguen explorando por capturas
  // (quiesce) en vez de evaluar tal cual, para no cortar a mitad de un
  // intercambio; el resto evalúa directamente, como antes
  if (depth === 0) {
    return cfg.quiesce
      ? quiesce(board, color, ep, clock, keys, alpha, beta, cfg, QUIESCE_MAX_DEPTH)
      : evaluate(board, color, cfg);
  }

  const myKey = key || positionKey(board, color, ep);
  const alphaOrig = alpha;
  const entry = tt.get(myKey);
  if (entry && entry.depth >= depth) {
    if (entry.flag === 'exact') return entry.score;
    if (entry.flag === 'lower') { if (entry.score > alpha) alpha = entry.score; }
    else if (entry.score < beta) beta = entry.score;   // 'upper'
    if (alpha >= beta) return entry.score;
  }

  const moves = movesForSide(board, color, ep);
  if (moves.length === 0) {
    const king = findKing(board, color);
    // mate (los más rápidos puntúan más) o tablas por ahogado
    return isAttacked(board, king, rival(color)) ? -MATE - depth : drawScore(board, color, values);
  }
  if (cfg.order) orderMoves(board, moves, values);
  // registrar la posición para que las líneas descendientes la detecten
  keys.set(myKey, (keys.get(myKey) || 0) + 1);
  let best = -Infinity;
  for (const m of moves) {
    const copy = new Map(board);
    const nextClock = (board.get(m.to) || board.get(m.from).type === 'P') ? 0 : clock + 1;
    const nextEp = applyMoveSim(copy, m.from, m.to, ep);
    const score = -negamax(copy, rival(color), nextEp, nextClock, keys, depth - 1,
      -beta, -alpha, cfg, tt);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  const n = keys.get(myKey) - 1;
  if (n > 0) keys.set(myKey, n); else keys.delete(myKey);

  // flag: si ningún movimiento superó alfa, `best` es solo una cota
  // superior (podría ser peor con más tiempo); si se produjo un corte beta,
  // es una cota inferior (podría ser mejor); si no, es el valor exacto
  if (!entry || entry.depth <= depth) {
    const flag = best <= alphaOrig ? 'upper' : best >= beta ? 'lower' : 'exact';
    tt.set(myKey, { depth, score: best, flag });
  }
  return best;
}

// Estado mínimo que necesita la búsqueda, extraído de `game`. Es también lo
// que viaja al worker de ai-async.js, por lo que solo contiene datos
// clonables (el Map del tablero, escalares y claves de posición).
function searchState() {
  const posKeys = [];
  for (let i = 0; i <= game.histIndex; i++) posKeys.push(game.history[i].posKey);
  return { board: game.board, turn: game.turn, enPassant: game.enPassant,
           clock: game.clock, posKeys };
}

// Margen (en centipeones) dentro del cual una jugada se considera tan buena
// como la mejor a efectos del sorteo de chooseAiMove.
const PLAY_TOLERANCE = 25;

// Elige la jugada del ordenador según el nivel, para la posición actual o
// para el estado `st` dado. Devuelve {from, to} o null si no hay jugadas.
function chooseAiMove(level, st = searchState()) {
  const cfg = AI_LEVELS[level] || AI_LEVELS[1];
  const moves = movesForSide(st.board, st.turn, st.enPassant);
  if (moves.length === 0) return null;
  if (cfg.random) return moves[Math.floor(Math.random() * moves.length)];
  if (cfg.order) orderMoves(st.board, moves, cfg.pieceValues || PIECE_VALUE);

  // posiciones ya vistas en la partida, para las repeticiones en la búsqueda
  const keys = new Map();
  for (const k of st.posKeys) keys.set(k, (keys.get(k) || 0) + 1);
  // tabla de transposición de esta jugada, ver negamax()
  const tt = new Map();

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
  let best = -Infinity;
  const scored = [];
  for (const m of moves) {
    const copy = new Map(st.board);
    const nextClock = (st.board.get(m.to) || st.board.get(m.from).type === 'P')
      ? 0 : st.clock + 1;
    const nextEp = applyMoveSim(copy, m.from, m.to, st.enPassant);
    const score = -negamax(copy, rival(st.turn), nextEp, nextClock, keys,
      cfg.depth - 1, -Infinity, -best + PLAY_TOLERANCE + 1, cfg, tt);
    if (score > best) best = score;
    scored.push({ move: m, score });
  }

  // el filtro va al final porque `best` sube durante el bucle; las jugadas
  // buscadas antes con un `best` más bajo tenían una ventana MÁS ancha, así
  // que su puntuación sigue siendo exacta (o una cota aún más baja) y el
  // filtro las trata igual de bien
  const top = scored.filter(s => s.score >= best - PLAY_TOLERANCE);
  return top[Math.floor(Math.random() * top.length)].move;
}

