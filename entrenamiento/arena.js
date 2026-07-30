// arena.js — Torneo emparejado entre DOS CONFIGURACIONES ARBITRARIAS del
// motor, no entre dos niveles de AI_LEVELS.
//
// Sucesor de match2.js. Mantiene sus tres aciertos (aperturas aleatorias,
// colores intercambiados sobre cada apertura, adjudicación por material en
// vez de descartar) y cambia dos cosas:
//
//  1. LAS CONFIGURACIONES VIENEN POR ENTORNO (CFG_A / CFG_B, JSON), así que
//     se puede medir cualquier combinación —solo el material ajustado, solo
//     los pesos posicionales, solo la movilidad— sin editar ai.js. Eso es lo
//     que permite ABLACIONAR: saber qué componente del ajuste ayuda y cuál
//     estorba, en vez de aceptar o rechazar el paquete entero.
//  2. NO ADJUDICA AL ESCRIBIR. Registra el balance material (balW) de toda
//     partida que llega al tope y deja la decisión para el análisis. Con
//     match2.js el margen de 500 quedó congelado en el log y el 43% de las
//     partidas acabó en 'adj-tablas' sin poder revisar ese umbral después.
//
// Carga geometry/rules/ai igual que tune-values.js (scripts clásicos, ámbito
// compartido vía un solo eval). Una línea JSON por partida en stdout.
'use strict';
const fs = require('fs');
const path = require('path');

const FIRST = Number(process.env.FIRST || 1);   // primer par de este proceso
const PAIRS = Number(process.env.PAIRS || 25);  // pares que juega
const SEED = Number(process.env.SEED || 1);
const MAX_PLIES = Number(process.env.MAX_PLIES || 200);
const OPENING_PLIES = Number(process.env.OPENING_PLIES || 6);
// Regla de los 50 movimientos acortada, igual que hace tune-values.js: sin
// esto las partidas empatadas consumen el presupuesto entero sin aportar
// señal. Se aplica a las dos configuraciones por igual.
const FIFTY = Number(process.env.FIFTY || 80);
// Guardar la lista de jugadas de cada partida (para reconstruirlas con
// envelope.js). Multiplica por ~50 el tamaño del log, así que va apagado:
// en una criba de cientos de partidas solo interesa el marcador.
const SAVE_MOVES = process.env.SAVE_MOVES === '1';

// Las dos configuraciones a comparar, en el formato de AI_LEVELS (depth,
// mobility, order, quiesce, pieceValues, positionWeights, mobilityWeight).
const CFG_A = process.env.CFG_A || '{"depth":2,"mobility":true,"order":true,"quiesce":true}';
const CFG_B = process.env.CFG_B || CFG_A;
const NAME_A = process.env.NAME_A || 'A';
const NAME_B = process.env.NAME_B || 'B';
// Libro de aperturas compartido (ver aperturas.js). Con LIBRO, el par número
// `par` juega siempre la apertura `par` del libro, sea cual sea la
// configuración: todas las ramas de una ablación se comparan sobre el mismo
// conjunto de posiciones de partida. Sin LIBRO, cada proceso las sortea.
const LIBRO = process.env.LIBRO
  ? JSON.stringify(JSON.parse(fs.readFileSync(process.env.LIBRO, 'utf8')))
  : 'null';

// Reanudación: con SALIDA=<fichero>, arena.js escribe ahí (añadiendo) y al
// arrancar lee lo que ya haya para SALTARSE los pares terminados. Así una
// tanda de días sobrevive a un apagón o a un reinicio sin perder trabajo ni
// repetirlo: basta con volver a lanzar exactamente la misma orden.
// Sin SALIDA escribe en stdout como siempre y no se reanuda nada.
const SALIDA = process.env.SALIDA || null;
const hechos = new Set();
if (SALIDA && fs.existsSync(SALIDA)) {
  for (const l of fs.readFileSync(SALIDA, 'utf8').split('\n')) {
    if (!l.startsWith('{')) continue;
    try {
      const g = JSON.parse(l);
      hechos.add(g.par + '/' + g.whiteIs);
    } catch { /* línea a medias de un corte: se ignora y se rejugará */ }
  }
}

// Dónde están geometry/rules/ai. Por defecto el repo; con MOTOR= se puede
// apuntar a otra copia, que es lo que hace el servicio de arranque
// automático: macOS no deja que un LaunchAgent lea ~/Documents (protección
// de privacidad), así que trabaja sobre una copia del motor fuera de ahí.
const dir = process.env.MOTOR || '/Users/salasgar/Documents/git/Ajedrez-triangular';
const gameSrc = ['geometry.js', 'rules.js', 'ai.js']
  .map(f => fs.readFileSync(path.join(dir, f), 'utf8'))
  .join('\n');

const driverSrc = `
// PRNG con semilla (mulberry32) sustituyendo a Math.random: hace la tanda
// reproducible de punta a punta, incluido el desempate al azar entre jugadas
// dentro de PLAY_TOLERANCE que hace chooseAiMove.
let _s = ${SEED} >>> 0;
Math.random = function () {
  _s = (_s + 0x6D2B79F5) >>> 0;
  let t = _s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

FIFTY_MOVE_LIMIT = ${FIFTY};
AI_LEVELS.A = ${CFG_A};
AI_LEVELS.B = ${CFG_B};

let ultimasJugadas = [];

// Balance material con los valores por defecto del ai.js cargado. Solo se usa
// para adjudicar con un margen amplio partidas cortadas, así que la tabla
// exacta es poco crítica; lo importante es que es LA MISMA para las dos
// configuraciones (juez común, nunca los valores de una de las dos ramas).
function materialBalance(board, color) {
  let m = 0;
  for (const [, p] of board) m += (p.color === color ? 1 : -1) * PIECE_VALUE[p.type];
  return m;
}

// Apertura: OPENING_PLIES jugadas legales al azar. Se rechaza y se reintenta
// si la partida ya acabó o si hubo capturas (material desigual): el par debe
// arrancar de una posición equilibrada para que la inversión de colores
// compare lo mismo en ambos sentidos.
const LIBRO_APERTURAS = ${LIBRO};

// Apertura del par indicado: la del libro si lo hay (compartida entre
// ramas), si no una sorteada sobre la marcha.
function openingFor(par) {
  if (LIBRO_APERTURAS) {
    const jugadas = LIBRO_APERTURAS[(par - 1) % LIBRO_APERTURAS.length];
    return jugadas.map(s => { const [from, to] = s.split('>'); return { from, to }; });
  }
  return randomOpening();
}

function randomOpening() {
  for (let intento = 0; intento < 100; intento++) {
    newGame();
    const moves = [];
    let ok = true;
    for (let i = 0; i < ${OPENING_PLIES}; i++) {
      const ms = movesForSide(game.board, game.turn, game.enPassant);
      if (ms.length === 0) { ok = false; break; }
      const m = ms[Math.floor(Math.random() * ms.length)];
      moves.push(m);
      makeMove(m.from, m.to);
    }
    if (ok && !gameEnded() && materialBalance(game.board, 'w') === 0) return moves;
  }
  return null;
}

// Devuelve el resultado desde el punto de vista de quien lleva blancas:
// 1 gana, 0 pierde, 0.5 tablas, o null si llegó al tope (entonces la decide
// el análisis a partir de balW).
function playFrom(opening, white, black) {
  newGame();
  for (const m of opening) makeMove(m.from, m.to);
  let plies = 0;
  const jugadas = opening.map(m => m.from + '>' + m.to);
  while (!gameEnded() && plies < ${MAX_PLIES}) {
    const mv = chooseAiMove(game.turn === 'w' ? white : black);
    if (!mv) break;
    makeMove(mv.from, mv.to);
    jugadas.push(mv.from + '>' + mv.to);
    plies++;
  }
  ultimasJugadas = jugadas;
  const balW = materialBalance(game.board, 'w');
  if (game.status === 'checkmate') {
    return { pts: game.winner === 'w' ? 1 : 0, res: 'mate', plies, balW };
  }
  if (plies >= ${MAX_PLIES}) return { pts: null, res: 'tope', plies, balW };
  return { pts: 0.5, res: game.status, plies, balW };   // stalemate|repetition|fifty
}

for (let par = ${FIRST}; par < ${FIRST} + ${PAIRS}; par++) {
  // si las dos partidas del par ya están en el fichero de salida, ni se
  // genera la apertura (ver la reanudación en la cabecera)
  if (HECHOS.has(par + '/A') && HECHOS.has(par + '/B')) continue;
  const opening = openingFor(par);
  if (!opening) continue;
  const apertura = opening.map(m => m.from + '>' + m.to).join(' ');
  // las dos partidas del par: misma apertura, colores intercambiados
  for (const whiteIs of ['A', 'B']) {
    if (HECHOS.has(par + '/' + whiteIs)) continue;
    const t0 = Date.now();
    const r = playFrom(opening, whiteIs, whiteIs === 'A' ? 'B' : 'A');
    const linea = {
      par, whiteIs, ptsW: r.pts, res: r.res, plies: r.plies, balW: r.balW,
      secs: +((Date.now() - t0) / 1000).toFixed(1), apertura,
    };
    if (${SAVE_MOVES}) linea.jugadas = ultimasJugadas;
    ESCRIBE(JSON.stringify(linea) + '\\n');
  }
}
`;

// Escritura de cada partida. Con SALIDA se añade al fichero y se fuerza el
// volcado a disco: si el ordenador se apaga a mitad de la siguiente partida,
// todo lo anterior ya está guardado y la reanudación no lo repite.
const salidaFd = SALIDA ? fs.openSync(SALIDA, 'a') : null;

// Cabecera con las configuraciones comparadas. Va en una línea que empieza
// por '#', que tanto la reanudación de aquí arriba como analiza.js ignoran
// (ambas exigen '{'), así que no rompe ningún log anterior.
//
// No es un adorno: los logs de la ronda 5 quedaron con las ramas llamadas
// 'b1' y 'b2' y sin rastro de qué configuración era cada una, lo que impidió
// después comparar aquella medida a profundidad 4 con la de profundidad 5.
// Un log que no dice qué midió no sirve para nada dentro de un mes.
const CABECERA = '# ' + JSON.stringify({
  fecha: new Date().toISOString(),
  A: { nombre: NAME_A, cfg: JSON.parse(CFG_A) },
  B: { nombre: NAME_B, cfg: JSON.parse(CFG_B) },
  MAX_PLIES, FIFTY, OPENING_PLIES, SEED, FIRST, PAIRS,
  libro: process.env.LIBRO || null,
}) + '\n';
const ESCRIBE = salidaFd === null
  ? (s) => process.stdout.write(s)
  : (s) => { fs.writeSync(salidaFd, s); fs.fsyncSync(salidaFd); };
const HECHOS = hechos;
// una cabecera por proceso; al reanudar se añade otra, que documenta que ese
// tramo se jugó en otra tanda (y con qué motor, si se hubiera cambiado)
ESCRIBE(CABECERA);

process.stderr.write(`arena: ${NAME_A} vs ${NAME_B} · pares ${FIRST}..${FIRST + PAIRS - 1}` +
  ` · seed ${SEED}` + (SALIDA ? ` · ${hechos.size} partidas ya hechas en ${SALIDA}` : '') + '\n');
eval(gameSrc + '\n' + driverSrc);
if (salidaFd !== null) fs.closeSync(salidaFd);
