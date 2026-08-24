// rules.js — Estado de la partida y reglas de movimiento.
//
// El tablero se representa como un Map: key de casilla → {type, color, moved}.
//   type:  'K' rey, 'Q' dama, 'R' torre, 'B' alfil, 'N' caballo,
//          'E' elefante, 'U' unicornio, 'P' peón
//          (qué piezas hay depende de la modalidad, ver variants.js)
//   color: 'w' blancas (abajo), 'b' negras (arriba)
//
// Este fichero no conoce ninguna modalidad en concreto: la forma de mover de
// cada pieza, la posición inicial, el enroque y las reglas del peón salen de
// la modalidad activa V (variants.js).

// Medias jugadas sin captura ni peón antes de tablas por la regla de los 50
// movimientos (100 = 50 jugadas completas). `let`, no `const`: tune-values.js
// lo reduce para acortar las partidas de autojuego durante el entrenamiento,
// sin tocar este fichero; el juego real siempre arranca con el valor de aquí.
let FIFTY_MOVE_LIMIT = 100;

let game = null;

// --- restricciones de captura ---
// Una modalidad puede declarar `captures`: un mapa tipo → tipos rivales que
// esa pieza puede capturar (las de «Piedra, papel y tijera»). Si no lo
// declara, todo se puede capturar, que es el ajedrez de siempre. La regla del
// rey de las modalidades -rey (el rey captura todo y todos capturan al rey)
// no es un caso especial: va codificada dentro del propio mapa.
function canCapture(attackerType, victimType) {
  const caps = V.captures;
  if (!caps) return true;
  const lista = caps[attackerType];
  return !!lista && lista.includes(victimType);
}

// --- enroque ---
// Los índices de CASTLING son posiciones dentro de la fila del borde. El rey
// se aleja del centro tres casillas por el lado largo; por el corto solo caben
// dos, porque la tercera es la de su propia torre. La torre salta al otro lado.
//
// Nótese que por el lado corto el rey acaba en una casilla a la que también
// llega con un movimiento normal (en esta retícula el rey alcanza dos casillas
// a cada lado dentro de su fila). No hay ambigüedad porque el enroque se
// introduce como "rey a la casilla de su propia torre" —una jugada imposible
// de otro modo—, no como "rey a su casilla de destino".

// Casillas de llegada de un enroque, o null si (kingKey, rookKey) no es uno.
function castlingLanding(color, kingKey, rookKey) {
  if (!V.castling) return null;
  const row = backRow(color);
  const ki = row.findIndex(c => c.key === kingKey);
  const ri = row.findIndex(c => c.key === rookKey);
  const c = V.castling.find(x => x.king === ki && x.rook === ri);
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
// torres con las que puede enrocarse (ver arriba sobre por qué el destino es
// la torre y no la casilla de llegada del rey).
function castleMoves(board, kingKey, piece) {
  if (!V.castling || piece.moved) return [];
  const row = backRow(piece.color);
  const ki = row.findIndex(c => c.key === kingKey);
  if (ki === -1) return [];
  const foe = rival(piece.color);
  // el rey no puede enrocarse estando en jaque
  if (isAttacked(board, row[ki], foe)) return [];

  const out = [];
  for (const c of V.castling) {
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

function initialPosition() {
  const board = new Map();
  const put = (cell, color, type) =>
    board.set(cell.key, { type, color, moved: false });

  if (V.position) {
    // Modalidad que da la posición inicial casilla a casilla (Trigonal).
    for (const color of ['w', 'b']) {
      for (const [type, casillas] of Object.entries(V.position[color])) {
        for (const nombre of casillas) {
          const cell = cellFromName(nombre);
          if (!cell) throw new Error('casilla inicial desconocida: ' + nombre);
          put(cell, color, type);
        }
      }
    }
  } else {
    // Modalidad de fila de fondo + fila delantera (hexágono). La delantera
    // son peones salvo que la modalidad dé un `frontLayout` propio (las de
    // «Piedra, papel y tijera» ponen ahí sus papeles).
    const { wBack, wPawns, bBack, bPawns } = V.rows;
    V.backLayout.forEach((type, i) => {
      put(wBack[i], 'w', type);
      put(bBack[i], 'b', type);
    });
    if (V.frontLayout) {
      V.frontLayout.forEach((type, i) => {
        put(wPawns[i], 'w', type);
        put(bPawns[i], 'b', type);
      });
    } else {
      for (const cell of wPawns) put(cell, 'w', 'P');
      for (const cell of bPawns) put(cell, 'b', 'P');
    }
  }
  return board;
}

function newGame() {
  game = {
    board: initialPosition(),
    variant: V.id,                  // con qué reglas se juega
    turn: 'w',
    capturedBy: { w: [], b: [] },   // piezas capturadas POR cada color
    lastMove: null,                 // {from, to} (keys de casilla)
    enPassant: null,                // {targetKey, pawnKey} si cabe captura al paso
    status: 'playing',              // playing | check | checkmate | stalemate
                                    // | repetition | fifty | material (tablas)
                                    // | wiped (sin rey: un bando se quedó sin piezas)
    winner: null,
    clock: 0,                       // medias jugadas sin captura ni peón (regla de los 50)
    history: [],                    // instantáneas del estado tras cada jugada
    histIndex: 0,                   // posición actual dentro del historial
  };
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

// Primer índice del historial que pertenece a la posición que se está jugando
// ahora. Normalmente es 0, pero una edición del tablero a mitad de partida
// (applyEdit) rompe la cadena: las posiciones anteriores describen otra
// partida y no deben contar ni para la repetición ni para la búsqueda de la
// máquina. Se toma la última edición hasta la jugada actual, no hasta el final
// del historial, para que al deshacer por debajo de una edición vuelva a valer
// todo lo que había antes de ella.
function lastEditIndex(upTo = game.histIndex) {
  for (let i = upTo; i > 0; i--) if (game.history[i].edited) return i;
  return 0;
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
    game.status === 'repetition' || game.status === 'fifty' ||
    game.status === 'material' || game.status === 'wiped';
}

// --- generación de movimientos ---

function slideMoves(board, piece, rays) {
  const out = [];
  for (const ray of rays) {
    for (const t of ray) {
      const occ = board.get(t.key);
      if (!occ) { out.push(t); continue; }
      // la primera pieza corta el rayo aunque no se pueda capturar
      if (occ.color !== piece.color && canCapture(piece.type, occ.type)) out.push(t);
      break;
    }
  }
  return out;
}

// Movimientos "pseudolegales": respetan la forma de mover de cada pieza pero
// aún no comprueban si dejan al propio rey en jaque.
function pseudoMoves(board, cell, piece, ep = game && game.enPassant) {
  // Las tablas por casilla y tipo las prepara variants.js; el peón no tiene
  // ninguna de las dos y cae al caso de abajo.
  const rays = cell.rays[piece.type];
  if (rays) return slideMoves(board, piece, rays);
  const leaps = cell.leaps[piece.type];
  if (leaps) {
    return leaps.filter(t => {
      const o = board.get(t.key);
      return !o || (o.color !== piece.color && canCapture(piece.type, o.type));
    });
  }

  // peón
  const color = piece.color;
  const free = t => !board.get(t.key);
  const out = [];
  // Avance. pawnPush ya lleva aplicada la coronación de flanco de la
  // modalidad: cuando el peón se queda sin casilla de enfrente, avanza en
  // diagonal (sin capturar) para poder seguir hacia la coronación.
  const adv1 = cell.pawnPush[color].filter(free);
  out.push(...adv1);
  // Doble avance inicial: solo desde las casillas que la modalidad permite y
  // solo si las dos casillas están libres.
  if (!piece.moved && cell.pawnDoubleOk[color] && cell.pawnTwo[color]) {
    const paso = cell.pawnAdv[color][0];
    const dos = cell.pawnTwo[color];
    if (paso && free(paso) && free(dos) && !out.includes(dos)) out.push(dos);
  }
  // Capturas
  for (const t of cell.pawnCap[color]) {
    const o = board.get(t.key);
    if (o && o.color !== color && canCapture(piece.type, o.type) &&
      !out.includes(t)) out.push(t);
  }
  // Captura al paso: la casilla intermedia que un peón rival acaba de saltar.
  if (ep) {
    const epCell = CELL_MAP.get(ep.targetKey);
    const victim = board.get(ep.pawnKey);
    if (cell.pawnCap[color].includes(epCell) && free(epCell) &&
      victim && victim.color !== color && !out.includes(epCell)) {
      out.push(epCell);
    }
  }
  return out;
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
// En las modalidades sin rey (V.kingless) no hay jaque del que protegerse:
// los legales SON los pseudolegales.
function legalMoves(board, fromKey, piece, ep = game && game.enPassant) {
  const cell = CELL_MAP.get(fromKey);
  if (V.kingless) return pseudoMoves(board, cell, piece, ep);
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

// ¿Esta jugada corona? (la comprobación vive aquí para que la interfaz no
// tenga que repetir la condición de la fila de coronación)
function isPromotion(board, fromKey, toKey) {
  const p = board.get(fromKey);
  if (!p || p.type !== 'P') return false;
  return CELL_MAP.get(toKey).promoFor[p.color];
}

// `promo` es el tipo elegido al coronar; si no se pasa, dama (comportamiento
// de siempre, y el que usan la IA y las partidas guardadas antiguas).
function makeMove(fromKey, toKey, promo) {
  const piece = game.board.get(fromKey);
  const target = game.board.get(toKey);
  const fromCell = CELL_MAP.get(fromKey);
  const toCell = CELL_MAP.get(toKey);

  // Enroque: toKey es la casilla de la torre propia, no el destino del rey.
  // Ni captura, ni promoción, ni captura al paso posible.
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
  // Promoción: el peón que alcanza la coronación se convierte en la pieza
  // elegida (dama si no se eligió ninguna)
  let promoted = null;
  if (moved.type === 'P' && toCell.promoFor[moved.color]) {
    promoted = V.promotionChoices.includes(promo) ? promo : 'Q';
    moved.type = promoted;
  }
  game.board.set(toKey, moved);
  // Un doble avance de peón deja al rival la opción de capturar al paso. Se
  // reconoce por la casilla de destino y no por las filas recorridas: en
  // Trigonal Chess el doble paso no cambia de fila.
  game.enPassant = (piece.type === 'P' && toCell === fromCell.pawnTwo[piece.color])
    ? { targetKey: fromCell.pawnAdv[piece.color][0].key, pawnKey: toKey }
    : null;
  game.lastMove = { from: fromKey, to: toKey, ...(promoted ? { promo: promoted } : {}) };
  finishMove(piece.color, !!captured, piece.type === 'P');
}

// Posición muerta: con este material ya no puede darse mate de ninguna
// manera, así que la partida son tablas.
//
// En el hexágono de Salas la regla es MUCHO más corta que en el ajedrez
// clásico, y se ha comprobado por fuerza bruta, no copiado: en esta retícula
// el rey se acorrala contra el borde con muy poco, y K+N contra K o K+B
// contra K —tablas muertas en el ajedrez de siempre— SÍ tienen posiciones de
// mate. Lo mismo el elefante, la torre, la dama y hasta el peón (que además
// corona). El único final sin mate posible es rey contra rey.
//
// Para las demás modalidades no se ha hecho esa comprobación, así que se
// aplica la misma condición mínima, que es la única segura en cualquier caso:
// dos reyes solos nunca dan mate en ninguna geometría.
function deadPosition(board) {
  return board.size === 2;   // los dos reyes y nada más
}

// Posición muerta de las modalidades sin rey (Piedra, papel y tijera): la
// partida está muerta cuando NINGÚN bando puede ya eliminar al otro. Como los
// tipos extinguidos no vuelven (no hay coronación), basta mirar los tipos
// vivos: si a un bando le queda un tipo que ningún tipo vivo del rival puede
// capturar, ese bando tiene piezas inmortales y nunca será eliminado; si eso
// les pasa a los dos, ninguna serie de jugadas legales acaba en 'wiped' y la
// partida son tablas. Es el análogo exacto del «material insuficiente» del
// ajedrez (ninguna serie de jugadas legales lleva al mate), y cubre de paso
// el caso antiguo de «nadie puede capturar a nadie»: sin él, dos ejércitos de
// papeles enfrentados jugarían para siempre (no hay regla de 50 jugadas que
// lo corte). [Cambio de la sesión de la IA, ver PR: antes solo se declaraba
// muerta la incapacidad TOTAL de captura.]
function deadPositionKingless(board) {
  const tipos = { w: new Set(), b: new Set() };
  for (const [, p] of board) tipos[p.color].add(p.type);
  // ¿puede el bando `a` aspirar a eliminar al bando `v`? (todo tipo vivo de
  // `v` tiene que ser capturable por algún tipo vivo de `a`)
  const puedeEliminar = (a, v) =>
    [...tipos[v]].every(tv => [...tipos[a]].some(ta => canCapture(ta, tv)));
  return !puedeEliminar('w', 'b') && !puedeEliminar('b', 'w');
}

// Cierre común a toda jugada, ya aplicada sobre el tablero: pasa el turno,
// actualiza el reloj de los 50 movimientos, decide el estado de la partida
// (jaque, mate, ahogado, tablas) y registra la posición en el historial.
function finishMove(color, captured, isPawn) {
  const next = rival(color);
  game.turn = next;
  game.clock = (captured || isPawn) ? 0 : game.clock + 1;
  // veces que la posición resultante ha aparecido ya en la partida (una
  // repetición exige al menos 4 medias jugadas reversibles, de ahí la guarda)
  let reps = 1;
  if (game.clock >= 4) {
    const key = positionKey(game.board, next, game.enPassant);
    for (let i = lastEditIndex(); i <= game.histIndex; i++) {
      if (game.history[i].posKey === key) reps++;
    }
  }
  evaluateStatus(color, reps);

  // registrar en el historial (descartando las jugadas «rehacibles» futuras)
  game.history = game.history.slice(0, game.histIndex + 1);
  game.history.push(snapshot());
  game.histIndex++;
}

// Decide el estado de la partida sobre la posición ya puesta en el tablero y
// con el turno ya pasado. `mover` es quien acaba de mover (o de editar) y
// `reps` las veces que la posición resultante ha aparecido ya.
function evaluateStatus(mover, reps) {
  const next = game.turn;
  const hasMoves = sideHasMoves(game.board, next);
  if (V.kingless) {
    // Sin rey no hay jaque ni mate: pierde el bando que se queda sin piezas
    // ('wiped'); sin jugadas pero con piezas es ahogado, o sea tablas. La
    // regla de los 50 movimientos no aplica (sin peones, el reloj solo se
    // reiniciaría capturando y castigaría la maniobra legítima); el material
    // insuficiente es la incapacidad mutua de captura, ver arriba.
    let piezas = 0;
    for (const [, p] of game.board) if (p.color === next) piezas++;
    if (piezas === 0) { game.status = 'wiped'; game.winner = mover; }
    else if (!hasMoves) { game.status = 'stalemate'; }
    else if (reps >= 3) { game.status = 'repetition'; }
    else if (deadPositionKingless(game.board)) { game.status = 'material'; }
    else { game.status = 'playing'; }
    return;
  }
  const inCheck = isAttacked(game.board, findKing(game.board, next), mover);
  if (inCheck && !hasMoves) { game.status = 'checkmate'; game.winner = mover; }
  else if (!hasMoves) { game.status = 'stalemate'; }
  else if (reps >= 3) { game.status = 'repetition'; }   // aun con jaque: perpetuo
  else if (deadPosition(game.board)) { game.status = 'material'; }
  else if (game.clock >= FIFTY_MOVE_LIMIT) { game.status = 'fifty'; }
  else if (inCheck) { game.status = 'check'; }
  else { game.status = 'playing'; }
}

// --- edición del tablero a mitad de partida ---
//
// Una edición se guarda en el historial como un snapshot más, marcado con
// `edited: true`. Así deshacer, rehacer, revisar y guardar la partida siguen
// funcionando sin código aparte: «deshacer» sobre ese snapshot devuelve la
// posición anterior a la edición, y serializeGame lo vuelca como cualquier
// otra entrada. Lo que sí cambia es que la cadena de posiciones se rompe: de
// ahí lastEditIndex(), que acota las búsquedas de repetición.

// Reconstruye `capturedBy` comparando el material de la posición editada con
// el de la posición inicial de la modalidad. No puede acertar el orden en que
// se capturaron las piezas (esa información no está en el tablero), solo el
// conjunto. Una pieza de más que no sea peón se entiende como coronación, y
// no como un peón capturado. Si se coloca material que no existía al empezar,
// el excedente simplemente no aparece en la lista.
function capturedFromBoard(board) {
  const cuenta = (b) => {
    const m = new Map();
    for (const p of b.values()) m.set(p.color + p.type, (m.get(p.color + p.type) || 0) + 1);
    return m;
  };
  const inicial = cuenta(initialPosition());
  const actual = cuenta(board);
  const out = { w: [], b: [] };
  for (const color of ['w', 'b']) {
    let coronadas = 0;
    for (const [k, n] of actual) {
      if (k[0] !== color || k.slice(1) === 'P') continue;
      coronadas += Math.max(0, n - (inicial.get(k) || 0));
    }
    for (const [k, n] of inicial) {
      if (k[0] !== color) continue;
      const type = k.slice(1);
      let faltan = n - (actual.get(k) || 0);
      if (type === 'P') faltan -= coronadas;
      // las piezas que le faltan a un color las capturó el rival
      for (let i = 0; i < faltan; i++) out[rival(color)].push({ type, color });
    }
  }
  return out;
}

// ¿Se puede seguir jugando desde esta posición? Devuelve null si sí, o el
// motivo (para enseñárselo al usuario) si no. Lo usan tanto el editor antes de
// volver a la partida como la carga de una posición diseñada.
function positionProblem(board, turn) {
  const reyes = { w: 0, b: 0 };
  for (const p of board.values()) if (p.type === 'K') reyes[p.color]++;
  if (reyes.w !== 1 || reyes.b !== 1) {
    return 'Tiene que haber un rey de cada color, y solo uno.';
  }
  if (isAttacked(board, findKing(board, rival(turn)), turn)) {
    return 'El bando que no mueve está en jaque: esa posición no puede darse en una partida.';
  }
  return null;
}

// Aplica una posición editada a la partida en curso. `boardEntries` es un Map
// o una lista de pares [key, pieza] tal cual sale del editor; conviene que las
// piezas conserven su `moved`, porque de él dependen el enroque y el doble
// avance del peón.
function applyEdit(boardEntries, turn) {
  game.board = new Map(Array.from(boardEntries, ([k, p]) => [k, { ...p }]));
  game.turn = turn;
  game.enPassant = null;    // el doble avance que la permitía ya no consta
  game.clock = 0;           // el reloj de los 50 movimientos arranca de cero
  game.lastMove = null;     // no hay jugada anterior que resaltar
  game.winner = null;       // una partida terminada puede reabrirse editando
  game.capturedBy = capturedFromBoard(game.board);
  evaluateStatus(rival(turn), 1);   // sin repetición: la cuenta empieza aquí
  game.history = game.history.slice(0, game.histIndex + 1);
  game.history.push({ ...snapshot(), edited: true });
  game.histIndex++;
}
