// rules.js — Estado de la partida y reglas de movimiento.
//
// El tablero se representa como un Map: key de casilla → {type, color, moved}.
//   type:  'K' rey, 'Q' dama, 'R' torre, 'B' alfil, 'N' caballo,
//          'E' elefante, 'P' peón
//   color: 'w' blancas (abajo), 'b' negras (arriba)

const GLYPH = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', E: '🐘', P: '♟' };

// Disposición inicial: la fila del borde completa (9 casillas), de izquierda
// a derecha para las blancas. Los índices pares son ▽ y los impares ▲ (los
// triángulos con la base en el borde). Las negras usan la misma lista y el
// mismo orden de columnas (misma coordenada x en el tablero), de modo que
// la reina blanca queda justo enfrente de la reina negra y el rey blanco
// justo enfrente del rey negro.
const BACK_LAYOUT = ['R', 'B', 'N', 'K', 'E', 'Q', 'B', 'N', 'R'];

// Medias jugadas sin captura ni peón antes de tablas por la regla de los 50
// movimientos (100 = 50 jugadas completas). `let`, no `const`: tune-values.js
// lo reduce para acortar las partidas de autojuego durante el entrenamiento,
// sin tocar este fichero; el juego real siempre arranca con el valor de aquí.
let FIFTY_MOVE_LIMIT = 100;

let game = null;

function rowCells(b) {
  return CELLS.filter(c => c.b === b).sort((p, q) => p.cx - q.cx);
}

// Fila del borde de cada color, de izquierda a derecha: las 9 casillas de
// BACK_LAYOUT, con el rey en el índice 3 y las torres en el 0 y el 8.
function backRow(color) {
  return rowCells(color === 'w' ? 1 - N : N);
}

// --- enroque ---
// Índices dentro de la fila del borde. El rey se aleja del centro tres
// casillas por el lado largo; por el corto solo caben dos, porque la tercera
// es la de su propia torre. La torre salta al otro lado del rey.
// Nótese que por el lado corto el rey acaba en una casilla a la que también
// llega con un movimiento normal (en esta retícula triangular el rey alcanza
// dos casillas a cada lado dentro de su fila). No hay ambigüedad porque el
// enroque se introduce como "rey a la casilla de su propia torre" —una
// jugada imposible de otro modo—, no como "rey a su casilla de destino".
const CASTLING = [
  { king: 3, rook: 0, kingTo: 1, rookTo: 2 },   // corto
  { king: 3, rook: 8, kingTo: 6, rookTo: 5 },   // largo
];

// Casillas de llegada de un enroque, o null si (kingKey, rookKey) no es uno.
function castlingLanding(color, kingKey, rookKey) {
  const row = backRow(color);
  const ki = row.findIndex(c => c.key === kingKey);
  const ri = row.findIndex(c => c.key === rookKey);
  const c = CASTLING.find(x => x.king === ki && x.rook === ri);
  return c ? { kingTo: row[c.kingTo].key, rookTo: row[c.rookTo].key } : null;
}

// ¿La jugada (fromKey → toKey) es un enroque sobre este tablero?
function isCastling(board, fromKey, toKey) {
  const piece = board.get(fromKey);
  const target = board.get(toKey);
  return !!(piece && piece.type === 'K' && target && target.type === 'R' &&
    target.color === piece.color &&
    castlingLanding(piece.color, fromKey, toKey));
}

// Enroques legales del rey que está en kingKey: devuelve las casillas de las
// torres con las que puede enrocarse (ver CASTLING sobre por qué el destino
// es la torre y no la casilla de llegada del rey).
function castleMoves(board, kingKey, piece) {
  if (piece.moved) return [];
  const row = backRow(piece.color);
  const ki = row.findIndex(c => c.key === kingKey);
  if (ki === -1) return [];
  const foe = rival(piece.color);
  // el rey no puede enrocarse estando en jaque
  if (isAttacked(board, row[ki], foe)) return [];

  const out = [];
  for (const c of CASTLING) {
    if (c.king !== ki) continue;
    const rookCell = row[c.rook];
    const rook = board.get(rookCell.key);
    if (!rook || rook.type !== 'R' || rook.color !== piece.color || rook.moved) continue;
    // todo lo que hay entre rey y torre debe estar vacío
    const lo = Math.min(c.rook, ki) + 1, hi = Math.max(c.rook, ki) - 1;
    let ok = true;
    for (let i = lo; i <= hi && ok; i++) if (board.get(row[i].key)) ok = false;
    if (!ok) continue;
    // el rey no puede cruzar ni acabar en casilla atacada; se simula el paso
    // porque al vaciar su casilla puede abrir una línea contra sí mismo
    const step = Math.sign(c.kingTo - ki);
    for (let i = ki + step; ok; i += step) {
      const copy = new Map(board);
      copy.delete(kingKey);
      copy.set(row[i].key, piece);
      if (i === c.kingTo) {   // la última: con la torre ya colocada
        copy.delete(rookCell.key);
        copy.set(row[c.rookTo].key, rook);
      }
      if (isAttacked(copy, row[i], foe)) ok = false;
      if (i === c.kingTo) break;
    }
    if (ok) out.push(rookCell);
  }
  return out;
}

function newGame() {
  game = {
    board: new Map(),
    turn: 'w',
    capturedBy: { w: [], b: [] },   // piezas capturadas POR cada color
    lastMove: null,                 // {from, to} (keys de casilla)
    enPassant: null,                // {targetKey, pawnKey} si cabe captura al paso
    status: 'playing',              // playing | check | checkmate | stalemate
                                    // | repetition | fifty (tablas)
    winner: null,
    clock: 0,                       // medias jugadas sin captura ni peón (regla de los 50)
    history: [],                    // instantáneas del estado tras cada jugada
    histIndex: 0,                   // posición actual dentro del historial
  };
  const put = (cell, color, type) =>
    game.board.set(cell.key, { type, color, moved: false });

  const wBack = rowCells(1 - N), wPawns = rowCells(2 - N);
  const bBack = rowCells(N), bPawns = rowCells(N - 1);
  BACK_LAYOUT.forEach((type, i) => {
    put(wBack[i], 'w', type);
    put(bBack[i], 'b', type);
  });
  for (const cell of wPawns) put(cell, 'w', 'P');
  for (const cell of bPawns) put(cell, 'b', 'P');
  game.history = [snapshot()];
  game.histIndex = 0;
}

// --- historial: deshacer y rehacer ---

function snapshot() {
  return {
    board: [...game.board].map(([k, p]) => [k, { ...p }]),
    turn: game.turn,
    capturedBy: { w: [...game.capturedBy.w], b: [...game.capturedBy.b] },
    lastMove: game.lastMove,
    enPassant: game.enPassant,
    status: game.status,
    winner: game.winner,
    clock: game.clock,
    posKey: positionKey(game.board, game.turn, game.enPassant),
  };
}

function restore(s) {
  game.board = new Map(s.board.map(([k, p]) => [k, { ...p }]));
  game.turn = s.turn;
  game.capturedBy = { w: [...s.capturedBy.w], b: [...s.capturedBy.b] };
  game.lastMove = s.lastMove;
  game.enPassant = s.enPassant;
  game.status = s.status;
  game.winner = s.winner;
  game.clock = s.clock;
}

function undoMove() {
  if (game.histIndex > 0) restore(game.history[--game.histIndex]);
}

function redoMove() {
  if (game.histIndex < game.history.length - 1) restore(game.history[++game.histIndex]);
}

function goToStart() {
  game.histIndex = 0;
  restore(game.history[0]);
}

function goToEnd() {
  game.histIndex = game.history.length - 1;
  restore(game.history[game.histIndex]);
}

// --- tablas por repetición y por la regla de los 50 movimientos ---

// Clave que identifica una posición a efectos de repetición: piezas, turno y
// casilla de captura al paso. El flag `moved` altera las jugadas futuras de
// los peones (doble avance) y las del rey y las torres (enroque), así que
// solo se incluye en esos tres tipos.
const MOVED_MATTERS = { P: true, K: true, R: true };
function positionKey(board, turn, ep) {
  const parts = [];
  for (const [key, p] of board) {
    parts.push(key + ':' + p.type + p.color + (MOVED_MATTERS[p.type] && !p.moved ? '*' : ''));
  }
  parts.sort();
  return turn + '|' + (ep ? ep.targetKey : '-') + '|' + parts.join(' ');
}

function gameEnded() {
  return game.status === 'checkmate' || game.status === 'stalemate' ||
    game.status === 'repetition' || game.status === 'fifty';
}

// --- generación de movimientos ---

function slideMoves(board, piece, rays) {
  const out = [];
  for (const ray of rays) {
    for (const t of ray) {
      const occ = board.get(t.key);
      if (!occ) { out.push(t); continue; }
      if (occ.color !== piece.color) out.push(t);
      break;
    }
  }
  return out;
}

// Movimientos "pseudolegales": respetan la forma de mover de cada pieza pero
// aún no comprueban si dejan al propio rey en jaque.
function pseudoMoves(board, cell, piece, ep = game && game.enPassant) {
  const free = t => !board.get(t.key);
  const enemy = t => { const o = board.get(t.key); return o && o.color !== piece.color; };
  const notOwn = t => { const o = board.get(t.key); return !o || o.color !== piece.color; };

  switch (piece.type) {
    case 'R': return slideMoves(board, piece, cell.rookRays);
    case 'B': return slideMoves(board, piece, cell.bishopRays);
    case 'Q': return slideMoves(board, piece, cell.rookRays)
      .concat(slideMoves(board, piece, cell.elephantRays));
    case 'E': return slideMoves(board, piece, cell.elephantRays);
    case 'N': return cell.knightTargets.filter(notOwn);
    case 'K': return cell.kingNbrs.filter(notOwn);
    case 'P': {
      const out = [];
      const adv1 = cell.pawnAdv[piece.color].filter(free);
      out.push(...adv1);
      if (!piece.moved) {
        // doble avance en el primer movimiento
        for (const t1 of adv1) {
          for (const t2 of t1.pawnAdv[piece.color]) {
            if (free(t2) && !out.includes(t2)) out.push(t2);
          }
        }
      }
      out.push(...cell.pawnCap[piece.color].filter(enemy));
      // captura al paso: la casilla intermedia que un peón rival acaba de saltar
      if (ep) {
        const epCell = CELL_MAP.get(ep.targetKey);
        const victim = board.get(ep.pawnKey);
        if (cell.pawnCap[piece.color].includes(epCell) && free(epCell) &&
          victim && victim.color !== piece.color) {
          out.push(epCell);
        }
      }
      return out;
    }
  }
  return [];
}

// Casillas que la pieza amenaza (para detectar jaques): como pseudoMoves,
// salvo el peón, que solo amenaza sus casillas de captura.
function attacks(board, cell, piece) {
  if (piece.type === 'P') return cell.pawnCap[piece.color];
  return pseudoMoves(board, cell, piece);
}

function findKing(board, color) {
  for (const [key, p] of board) {
    if (p.type === 'K' && p.color === color) return CELL_MAP.get(key);
  }
  return null;
}

function isAttacked(board, target, byColor) {
  for (const [key, p] of board) {
    if (p.color !== byColor) continue;
    if (attacks(board, CELL_MAP.get(key), p).includes(target)) return true;
  }
  return false;
}

function rival(color) { return color === 'w' ? 'b' : 'w'; }

// Movimientos legales: los pseudolegales que no dejan al propio rey en jaque.
function legalMoves(board, fromKey, piece, ep = game && game.enPassant) {
  const cell = CELL_MAP.get(fromKey);
  const out = [];
  for (const t of pseudoMoves(board, cell, piece, ep)) {
    const copy = new Map(board);
    copy.delete(fromKey);
    copy.set(t.key, piece);
    // en la captura al paso desaparece también el peón saltador
    if (piece.type === 'P' && ep && t.key === ep.targetKey && !board.get(t.key)) {
      copy.delete(ep.pawnKey);
    }
    const king = piece.type === 'K' ? t : findKing(copy, piece.color);
    if (!isAttacked(copy, king, rival(piece.color))) out.push(t);
  }
  // el enroque no sale de pseudoMoves (aterriza sobre una pieza propia y no
  // es una casilla amenazada, ver attacks()), se añade aquí ya comprobado
  if (piece.type === 'K') out.push(...castleMoves(board, fromKey, piece));
  return out;
}

function sideHasMoves(board, color, ep = game && game.enPassant) {
  for (const [key, p] of board) {
    if (p.color === color && legalMoves(board, key, p, ep).length > 0) return true;
  }
  return false;
}

function makeMove(fromKey, toKey) {
  const piece = game.board.get(fromKey);
  const target = game.board.get(toKey);
  const fromCell = CELL_MAP.get(fromKey);
  const toCell = CELL_MAP.get(toKey);

  // Enroque: toKey es la casilla de la torre propia, no el destino del rey
  // (ver CASTLING). Ni captura, ni promoción, ni captura al paso posible.
  const castle = isCastling(game.board, fromKey, toKey)
    ? castlingLanding(piece.color, fromKey, toKey) : null;
  if (castle) {
    game.board.delete(fromKey);
    game.board.delete(toKey);
    game.board.set(castle.kingTo, { ...piece, moved: true });
    game.board.set(castle.rookTo, { ...target, moved: true });
    game.enPassant = null;
    // `to` es la casilla de llegada del rey, no la de la torre; el flag marca
    // el enroque para que la lista de jugadas pueda distinguirlo de un
    // movimiento normal del rey a esa casilla (en esta retícula el rey llega
    // por sí solo a dos casillas de su fila, así que `to` no basta).
    game.lastMove = { from: fromKey, to: castle.kingTo, castle: true };
    finishMove(piece.color, false, false);
    return;
  }

  // captura normal o al paso
  let captured = target;
  if (piece.type === 'P' && !target && game.enPassant &&
    toKey === game.enPassant.targetKey) {
    captured = game.board.get(game.enPassant.pawnKey);
    game.board.delete(game.enPassant.pawnKey);
  }
  if (captured) game.capturedBy[piece.color].push(captured);

  game.board.delete(fromKey);
  const moved = { ...piece, moved: true };
  // Promoción: el peón que alcanza la fila del borde rival se convierte en dama
  if (moved.type === 'P' &&
    ((moved.color === 'w' && toCell.b === N) ||
      (moved.color === 'b' && toCell.b === 1 - N))) {
    moved.type = 'Q';
  }
  game.board.set(toKey, moved);
  // un doble avance de peón deja al rival la opción de capturar al paso
  game.enPassant = (piece.type === 'P' && Math.abs(toCell.b - fromCell.b) === 2)
    ? { targetKey: fromCell.pawnAdv[piece.color][0].key, pawnKey: toKey }
    : null;
  game.lastMove = { from: fromKey, to: toKey };
  finishMove(piece.color, !!captured, piece.type === 'P');
}

// Cierre común a toda jugada, ya aplicada sobre el tablero: pasa el turno,
// actualiza el reloj de los 50 movimientos, decide el estado de la partida
// (jaque, mate, ahogado, tablas) y registra la posición en el historial.
function finishMove(color, captured, isPawn) {
  const next = rival(color);
  game.turn = next;
  game.clock = (captured || isPawn) ? 0 : game.clock + 1;
  const inCheck = isAttacked(game.board, findKing(game.board, next), color);
  const hasMoves = sideHasMoves(game.board, next);
  // veces que la posición resultante ha aparecido ya en la partida (una
  // repetición exige al menos 4 medias jugadas reversibles, de ahí la guarda)
  let reps = 1;
  if (game.clock >= 4) {
    const key = positionKey(game.board, next, game.enPassant);
    for (let i = 0; i <= game.histIndex; i++) {
      if (game.history[i].posKey === key) reps++;
    }
  }
  if (inCheck && !hasMoves) { game.status = 'checkmate'; game.winner = color; }
  else if (!hasMoves) { game.status = 'stalemate'; }
  else if (reps >= 3) { game.status = 'repetition'; }   // aun con jaque: perpetuo
  else if (game.clock >= FIFTY_MOVE_LIMIT) { game.status = 'fifty'; }
  else if (inCheck) { game.status = 'check'; }
  else { game.status = 'playing'; }

  // registrar en el historial (descartando las jugadas «rehacibles» futuras)
  game.history = game.history.slice(0, game.histIndex + 1);
  game.history.push(snapshot());
  game.histIndex++;
}
