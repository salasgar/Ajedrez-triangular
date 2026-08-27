#!/usr/bin/env node
// test-rps.js — Pruebas de las modalidades «Piedra, papel y tijera».
//
// Ejecutar con:  node test-rps.js
//
// Carga geometry.js, variants.js y rules.js en un contexto de vm (son
// scripts de variables globales, sin módulos) y comprueba:
//   · que setVariant() de cada modalidad nueva no lanza y genera su posición
//   · la matriz de capturas (canCapture) de las cuatro modalidades
//   · que la generación de movimientos filtra las capturas ilegales
//   · el fin de partida por eliminación ('wiped'), el ahogado sin rey y las
//     tablas por incapacidad mutua de captura ('material')
//   · el jaque y la captura universal del rey en las modalidades -rey
//   · que las modalidades clásicas quedan intactas (recuento de jugadas
//     legales de la posición inicial, medido antes de este cambio)

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ctx = vm.createContext({ console });
for (const f of ['geometry.js', 'variants.js', 'rules.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), ctx, { filename: f });
}

let fallos = 0;
function ok(cond, msg) {
  if (cond) { console.log('  ✓ ' + msg); }
  else { console.error('  ✗ ' + msg); fallos++; }
}

// Cada fragmento corre dentro de una función para no contaminar el ámbito
// léxico global del contexto (sus const/let devolverían «already declared»
// en el fragmento siguiente).
function run(code) {
  return vm.runInContext('(function () {' + code + '}())', ctx);
}

// Jugadas legales de un color, sin repetir destinos (como movesForSide).
vm.runInContext(`
function _jugadas(color) {
  const out = [];
  const seen = new Set();
  for (const [key, p] of game.board) {
    if (p.color !== color) continue;
    for (const t of legalMoves(game.board, key, p)) {
      const s = key + '>' + t.key;
      if (!seen.has(s)) { seen.add(s); out.push({ from: key, to: t.key }); }
    }
  }
  return out;
}`, ctx);

// --- las cuatro modalidades arrancan y generan su posición -----------------

console.log('Posiciones iniciales de las modalidades nuevas:');
for (const id of ['rps-rey', 'rpsls-rey', 'rps-rey-muralla', 'rpsls-rey-muralla']) {
  const info = run(`
    setVariant('${id}');
    newGame();
    const tipos = {};
    for (const [, p] of game.board) {
      tipos[p.color + p.type] = (tipos[p.color + p.type] || 0) + 1;
    }
    return { size: game.board.size, status: game.status, tipos,
             jugadas: _jugadas('w').length };
  `);
  // Desde que se retiraron las modalidades sin rey, todas llevan rey.
  ok(info.size === 40, `${id}: 40 piezas en el tablero (hay ${info.size})`);
  ok(info.status === 'playing', `${id}: la partida arranca en 'playing'`);
  const tiposBlancas = Object.keys(info.tipos).filter(k => k[0] === 'w');
  const simetria = tiposBlancas.every(k => info.tipos[k] === info.tipos['b' + k.slice(1)]);
  ok(simetria, `${id}: mismo reparto de piezas por tipo en los dos bandos (negras en espejo)`);
  ok(!!info.tipos.wK && !!info.tipos.bK, `${id}: rey presente en los dos bandos`);
  ok(info.jugadas > 0, `${id}: las blancas tienen jugadas (${info.jugadas})`);
}

// --- matriz de capturas ----------------------------------------------------

console.log('Matriz de capturas:');
const MATRICES = {
  'rps-rey': { O: ['T'], A: ['O'], T: ['A'] },
  'rpsls-rey': { O: ['T', 'L'], A: ['O', 'S'], T: ['A', 'L'], L: ['S', 'A'], S: ['T', 'O'] },
};
for (const [id, matriz] of Object.entries(MATRICES)) {
  run(`setVariant('${id}')`);
  const tipos = Object.keys(matriz);
  let bien = true;
  for (const a of tipos) {
    for (const v of tipos) {
      const esperado = matriz[a].includes(v);
      if (run(`return canCapture('${a}', '${v}')`) !== esperado) bien = false;
    }
  }
  ok(bien, `${id}: canCapture coincide con la matriz en los ${tipos.length}×${tipos.length} pares`);
}
// En las -rey: el rey captura todo y todos capturan al rey; el resto igual.
for (const id of ['rps-rey', 'rpsls-rey']) {
  run(`setVariant('${id}')`);
  const figuras = id === 'rps-rey' ? ['O', 'A', 'T'] : ['O', 'A', 'T', 'L', 'S'];
  ok(figuras.every(t => run(`return canCapture('K', '${t}')`)),
    `${id}: el rey captura cualquier figura`);
  ok(figuras.every(t => run(`return canCapture('${t}', 'K')`)),
    `${id}: cualquier figura captura al rey`);
  ok(!run(`return canCapture('O', 'A')`) && run(`return canCapture('O', 'T')`),
    `${id}: las figuras conservan sus restricciones entre sí`);
}

// --- filtrado de capturas en la generación ---------------------------------

console.log('Generación de movimientos:');
{
  // Piedra blanca con un papel y una tijera negros al lado: solo la tijera
  // es capturable; a la casilla del papel no se puede ir.
  const r = run(`
    setVariant('rps-rey');
    newGame();
    const centro = CELLS.find(c => c.up && c.kingNbrs.length >= 3 &&
      c.kingNbrs.every(n => !game.board.get(n.key)) && !game.board.get(c.key));
    const [n1, n2] = centro.kingNbrs;
    game.board = new Map([
      [centro.key, { type: 'O', color: 'w', moved: false }],
      [n1.key, { type: 'A', color: 'b', moved: false }],
      [n2.key, { type: 'T', color: 'b', moved: false }],
    ]);
    const destinos = legalMoves(game.board, centro.key, game.board.get(centro.key))
      .map(t => t.key);
    return { papel: destinos.includes(n1.key), tijera: destinos.includes(n2.key),
             vacias: destinos.length };
  `);
  ok(!r.papel, 'rps-rey: la piedra NO puede capturar el papel');
  ok(r.tijera, 'rps-rey: la piedra SÍ puede capturar la tijera');
  ok(r.vacias >= 2, 'rps-rey: moverse a casilla vacía siempre se puede');
}

// Los finales sin rey ('wiped', y el ahogado y las tablas por material de las
// modalidades kingless) se probaban aquí sobre 'rps' y 'rpsls'. Esas dos
// modalidades se retiraron el 26-8-2026 (ver variants.js), así que no queda
// ninguna donde correr esos casos y el bloque se fue con ellas. El código
// kingless sigue en rules.js y ai.js, hoy sin usar.

// --- jaque y captura universal del rey en las modalidades -rey --------------

console.log('Modalidades con rey:');
{
  const r = run(`
    setVariant('rps-rey');
    newGame();
    const centro = CELLS.find(c => c.kingNbrs.length >= 5);
    const tijera = centro.kingNbrs[0];
    const lejos = CELLS.find(c => c !== centro && c !== tijera &&
      !centro.kingNbrs.includes(c) && !tijera.kingNbrs.includes(c));
    game.board = new Map([
      [centro.key, { type: 'K', color: 'w', moved: true }],
      [tijera.key, { type: 'T', color: 'b', moved: true }],
      [lejos.key, { type: 'K', color: 'b', moved: true }],
    ]);
    game.turn = 'w';
    game.history = [snapshot()]; game.histIndex = 0;
    const jaque = isAttacked(game.board, centro, 'b');
    const rey = legalMoves(game.board, centro.key, game.board.get(centro.key))
      .map(t => t.key);
    return { jaque, comeTijera: rey.includes(tijera.key) };
  `);
  ok(r.jaque, 'rps-rey: una tijera al lado del rey le da jaque');
  ok(r.comeTijera, 'rps-rey: el rey puede capturar cualquier pieza rival');
}
{
  // Una piedra rival junto al rey también da jaque (cualquier pieza captura
  // al rey).
  const r = run(`
    setVariant('rps-rey');
    const centro = CELLS.find(c => c.kingNbrs.length >= 5);
    const piedra = centro.kingNbrs[0];
    const lejos = CELLS.find(c => c !== centro && c !== piedra &&
      !centro.kingNbrs.includes(c) && !piedra.kingNbrs.includes(c));
    game.board = new Map([
      [centro.key, { type: 'K', color: 'w', moved: true }],
      [piedra.key, { type: 'O', color: 'b', moved: true }],
      [lejos.key, { type: 'K', color: 'b', moved: true }],
    ]);
    return isAttacked(game.board, centro, 'b');
  `);
  ok(r, 'rps-rey: también una piedra da jaque al rey');
}

// --- las modalidades clásicas quedan intactas ------------------------------

// Recuento de jugadas legales blancas en la posición inicial, medido en la
// versión ANTERIOR a este cambio (commit ca04315). Si alguno cambia, el
// filtrado de capturas ha tocado lo que no debía.
console.log('Modalidades clásicas (regresión):');
const CLASICAS = { salas: 28, 'salas-v4': 28, 'salas-1998': 21, dekle: 28, trigonal: 15 };
for (const [id, esperado] of Object.entries(CLASICAS)) {
  const r = run(`
    setVariant('${id}');
    newGame();
    return { n: _jugadas('w').length, cap: canCapture('R', 'Q'), status: game.status };
  `);
  ok(r.n === esperado, `${id}: ${esperado} jugadas iniciales (da ${r.n})`);
  ok(r.cap === true, `${id}: sin mapa de capturas, todo se puede capturar`);
}

console.log(fallos ? `\n${fallos} pruebas FALLADAS` : '\nTodas las pruebas pasan.');
process.exit(fallos ? 1 : 0);
