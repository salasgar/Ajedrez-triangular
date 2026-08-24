// test-edicion.js — Prueba del núcleo de «editar el tablero a mitad de partida»:
// applyEdit, lastEditIndex, capturedFromBoard, positionProblem y el corte de la
// cuenta de repeticiones.
//
//   node test-edicion.js
//
// Carga geometry.js + variants.js + rules.js en un único ámbito con eval(),
// igual que tune-values.js y arena.js: son scripts clásicos pensados para
// compartir el ámbito global vía <script>, sin module.exports.
const fs = require('fs');
const path = require('path');
const src = ['geometry.js', 'variants.js', 'rules.js']
  .map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');

let fallos = 0;
function ok(cond, msg) {
  console.log((cond ? '  ok   ' : '  FALLO') + '  ' + msg);
  if (!cond) fallos++;
}

eval(src + `

setVariant(DEFAULT_VARIANT);
newGame();

// --- 1. una edición se apila como un snapshot más ---
const antes = new Map(game.board);
const pre = game.history.length;
const sinPeon = new Map(game.board);
const peonW = [...sinPeon].find(([k, p]) => p.type === 'P' && p.color === 'w')[0];
sinPeon.delete(peonW);
applyEdit(sinPeon, 'b');
ok(game.history.length === pre + 1, 'la edición añade un snapshot');
ok(game.history[game.histIndex].edited === true, 'el snapshot va marcado edited');
ok(!game.board.has(peonW), 'el tablero editado es el que se pasó');
ok(game.turn === 'b', 'el turno es el elegido en el editor');
ok(game.clock === 0 && game.enPassant === null && game.lastMove === null,
   'reloj, captura al paso y última jugada se reinician');

// --- 2. capturedBy se reconstruye del material ---
ok(game.capturedBy.b.length === 1 && game.capturedBy.b[0].type === 'P' &&
   game.capturedBy.b[0].color === 'w',
   'el peón que falta aparece como capturado por las negras');
ok(game.capturedBy.w.length === 0, 'las blancas no han capturado nada');

// --- 3. deshacer revierte la edición ---
undoMove();
ok(game.board.size === antes.size && game.board.has(peonW),
   'deshacer sobre la edición devuelve la posición previa');
ok(game.turn === 'w', 'y el turno de antes');
redoMove();
ok(!game.board.has(peonW), 'rehacer vuelve a la posición editada');

// --- 4. lastEditIndex acota el historial ---
ok(lastEditIndex() === game.histIndex, 'lastEditIndex apunta a la edición');
game.histIndex = 0;
ok(lastEditIndex() === 0, 'por debajo de la edición vuelve a valer todo');
game.histIndex = game.history.length - 1;

// --- 5. el estado no se hereda: editar reabre una partida terminada ---
newGame();
game.status = 'checkmate'; game.winner = 'w';
applyEdit(initialPosition(), 'w');
ok(game.status === 'playing' && game.winner === null,
   'editar reabre una partida que constaba terminada');

// --- 6. positionProblem rechaza lo injugable ---
ok(positionProblem(initialPosition(), 'w') === null, 'la posición inicial es válida');
const sinRey = new Map(initialPosition());
for (const [k, p] of sinRey) if (p.type === 'K' && p.color === 'b') sinRey.delete(k);
ok(positionProblem(sinRey, 'w') !== null, 'sin rey negro se rechaza');
// bando que no mueve en jaque: dama blanca dando jaque al rey negro con turno blanco
const enJaque = new Map();
const reyN = findKing(initialPosition(), 'b');
const reyB = findKing(initialPosition(), 'w');
enJaque.set(reyN.key, { type: 'K', color: 'b', moved: true });
enJaque.set(reyB.key, { type: 'K', color: 'w', moved: true });
// se coloca una dama blanca en una casilla desde la que ataque al rey negro
let colocada = false;
for (const c of CELLS) {
  if (enJaque.has(c.key)) continue;
  const prueba = new Map(enJaque);
  prueba.set(c.key, { type: 'Q', color: 'w', moved: true });
  if (isAttacked(prueba, reyN, 'w')) {
    ok(positionProblem(prueba, 'w') !== null,
       'con el bando que no mueve en jaque se rechaza');
    ok(positionProblem(prueba, 'b') === null,
       'y esa misma posición sí vale si mueve el bando en jaque');
    colocada = true;
    break;
  }
}
ok(colocada, 'se pudo construir la posición de prueba con jaque');

// --- 7. la repetición no cuenta posiciones anteriores a la edición ---
newGame();
const inicial = positionKey(game.board, 'w', null);
game.history.push({ ...snapshot(), posKey: inicial });
game.histIndex++;
game.history.push({ ...snapshot(), posKey: inicial });
game.histIndex++;
applyEdit(initialPosition(), 'w');
game.clock = 10;   // pasa la guarda de los 4 medios movimientos
const key = positionKey(game.board, game.turn, game.enPassant);
let reps = 1;
for (let i = lastEditIndex(); i <= game.histIndex; i++) {
  if (game.history[i].posKey === key) reps++;
}
ok(reps < 3, 'las posiciones previas a la edición no cuentan (reps=' + reps + ')');
let sinCorte = 1;
for (let i = 0; i <= game.histIndex; i++) {
  if (game.history[i].posKey === key) sinCorte++;
}
ok(sinCorte >= 3, 'sin el corte habrían contado (reps=' + sinCorte + '): ese es el fallo evitado');

// --- 8. coronación: una dama de más no es un peón capturado ---
newGame();
const conDama = new Map(game.board);
const otroPeon = [...conDama].find(([k, p]) => p.type === 'P' && p.color === 'w')[0];
conDama.set(otroPeon, { type: 'Q', color: 'w', moved: true });
applyEdit(conDama, 'b');
ok(game.capturedBy.b.length === 0,
   'un peón coronado no se cuenta como capturado (capturedBy.b=' + game.capturedBy.b.length + ')');

// --- 9. partida de verdad: jugar, editar y seguir jugando ---
function jugadasDe(color) {
  const out = [];
  for (const [k, p] of game.board) {
    if (p.color !== color) continue;
    for (const t of legalMoves(game.board, k, p)) out.push([k, t.key]);
  }
  return out;
}
newGame();
ok(lastEditIndex() === 0, 'sin ediciones, lastEditIndex es 0 (igual que antes del cambio)');
let n = 0;
while (n < 12 && !gameEnded()) {
  const ms = jugadasDe(game.turn);
  if (!ms.length) break;
  const [f, t] = ms[(n * 7) % ms.length];
  makeMove(f, t);
  n++;
}
ok(game.history.length === n + 1, 'las ' + n + ' jugadas previas se apilaron bien');
const historialPrevio = game.history.length;
const editado = new Map(game.board);
const caballo = [...editado].find(([k, p]) => p.type === 'N' && p.color === 'b');
if (caballo) editado.delete(caballo[0]);
applyEdit(editado, 'w');
ok(game.history.length === historialPrevio + 1, 'la edición se apila tras las jugadas');
ok(positionProblem(game.board, game.turn) === null, 'la posición editada es jugable');
let m = 0;
while (m < 6 && !gameEnded()) {
  const ms = jugadasDe(game.turn);
  if (!ms.length) break;
  const [f, t] = ms[(m * 5) % ms.length];
  makeMove(f, t);
  m++;
}
ok(m === 6, 'se siguen jugando ' + m + ' jugadas después de editar');
ok(game.history.length === historialPrevio + 1 + m, 'el historial sigue creciendo con normalidad');
ok(lastEditIndex() === historialPrevio, 'lastEditIndex sigue apuntando a la edición');
while (game.histIndex > historialPrevio) undoMove();
ok(game.history[game.histIndex].edited === true, 'deshaciendo se llega al snapshot de la edición');
ok(!game.board.has(caballo[0]), 'y ahí el caballo sigue quitado');
undoMove();
ok(game.board.has(caballo[0]), 'un deshacer más revierte la edición y devuelve el caballo');
ok(lastEditIndex() === 0, 'por debajo de la edición el historial vuelve a contar entero');
`);

console.log(fallos === 0 ? '\nTodo correcto.' : `\n${fallos} fallo(s).`);
process.exit(fallos === 0 ? 0 : 1);
