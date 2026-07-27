// versus.js — Match emparejado entre DOS VERSIONES DEL CÓDIGO del motor.
//
// arena.js compara dos configuraciones del MISMO código; esto compara dos
// commits (p. ej. el motor antes y después de una optimización que promete
// no cambiar la fuerza). Cada versión corre en un contexto vm AISLADO con
// sus propios geometry/rules/ai, y el driver les va pasando las jugadas:
// cada motor mantiene su propia partida y decide con su propio código.
//
//   VIEJO=<ruta-dir> NUEVO=<ruta-dir> node versus.js > v.log
//
// VIEJO/NUEVO son directorios con geometry.js, rules.js y ai.js (se extraen
// del git una vez con `git show ref:fichero > dir/fichero`, que aquí es
// lento y no conviene repetir por proceso).
//
// Mismo protocolo que arena.js: libro de aperturas compartido, colores
// invertidos por par, adjudicación por material diferida al análisis
// (analiza.js lee este log tal cual). Mismas variables: FIRST, PAIRS, SEED,
// MAX_PLIES, FIFTY, LIBRO, LEVEL (nivel de AI_LEVELS que juegan AMBOS).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FIRST = Number(process.env.FIRST || 1);
const PAIRS = Number(process.env.PAIRS || 10);
const SEED = Number(process.env.SEED || 1);
const MAX_PLIES = Number(process.env.MAX_PLIES || 110);
const FIFTY = Number(process.env.FIFTY || 50);
const LEVEL = Number(process.env.LEVEL || 4);
const LIBRO = JSON.parse(fs.readFileSync(process.env.LIBRO || 'libro.json', 'utf8'));
const DIR_A = process.env.VIEJO;   // A = viejo
const DIR_B = process.env.NUEVO;   // B = nuevo
if (!DIR_A || !DIR_B) { console.error('faltan VIEJO= y NUEVO='); process.exit(2); }

function motor(dir, nombre) {
  const src = ['geometry.js', 'rules.js', 'ai.js']
    .map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const ctx = vm.createContext({});
  vm.runInContext(src, ctx, { filename: nombre });
  // PRNG sembrado por partida (ver nuevaPartida) y regla de 50 acortada
  vm.runInContext(`
    let __s = 1;
    Math.random = function () {
      __s = (__s + 0x6D2B79F5) >>> 0;
      let t = __s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    FIFTY_MOVE_LIMIT = ${FIFTY};
    function __sembrar(s) { __s = s >>> 0; }
    function __jugar(nivel) { return JSON.stringify(chooseAiMove(nivel) || null); }
    function __mover(f, t) { makeMove(f, t); }
    function __estado() { return JSON.stringify({ status: game.status,
      winner: game.winner || null, fin: gameEnded() }); }
    function __balanceW() {
      let m = 0;
      for (const [, p] of game.board) m += (p.color === 'w' ? 1 : -1) * PIECE_VALUE[p.type];
      return m;
    }
  `, ctx);
  return ctx;
}

const A = motor(DIR_A, 'viejo');
const B = motor(DIR_B, 'nuevo');

function ambos(fn) { fn(A); fn(B); }

// juega una partida: white/black son 'A'|'B'; devuelve el resultado desde
// el punto de vista de las blancas (protocolo de arena.js)
function partida(opening, whiteIs, seed) {
  ambos(ctx => {
    ctx.__sembrar(seed);
    vm.runInContext('newGame()', ctx);
  });
  for (const mv of opening) ambos(ctx => ctx.__mover(mv.from, mv.to));
  let plies = 0;
  let turn = 'w';
  while (plies < MAX_PLIES) {
    const quien = (turn === 'w') === (whiteIs === 'A') ? A : B;
    const estado = JSON.parse(quien.__estado());
    if (estado.fin) break;
    const mv = JSON.parse(quien.__jugar(LEVEL));
    if (!mv) break;
    ambos(ctx => ctx.__mover(mv.from, mv.to));
    plies++;
    turn = turn === 'w' ? 'b' : 'w';
  }
  // el estado final se lee del motor NUEVO; los dos deben coincidir — si
  // divergieran (bug de reglas en una de las versiones) se avisa
  const eA = JSON.parse(A.__estado()), eB = JSON.parse(B.__estado());
  if (eA.status !== eB.status) {
    process.stderr.write(`DIVERGENCIA de estado: viejo=${eA.status} nuevo=${eB.status}\n`);
  }
  const balW = B.__balanceW();
  if (eB.status === 'checkmate') {
    return { pts: eB.winner === 'w' ? 1 : 0, res: 'mate', plies, balW };
  }
  if (plies >= MAX_PLIES) return { pts: null, res: 'tope', plies, balW };
  return { pts: 0.5, res: eB.status, plies, balW };
}

process.stderr.write(`versus: ${DIR_A} (A) vs ${DIR_B} (B) · nivel ${LEVEL} · pares ${FIRST}..${FIRST + PAIRS - 1}\n`);
for (let par = FIRST; par < FIRST + PAIRS; par++) {
  const jugadas = LIBRO[(par - 1) % LIBRO.length]
    .map(s => { const [from, to] = s.split('>'); return { from, to }; });
  const apertura = LIBRO[(par - 1) % LIBRO.length].join(' ');
  for (const whiteIs of ['A', 'B']) {
    const t0 = Date.now();
    const r = partida(jugadas, whiteIs, SEED * 100000 + par * 2 + (whiteIs === 'A' ? 0 : 1));
    process.stdout.write(JSON.stringify({
      par, whiteIs, ptsW: r.pts, res: r.res, plies: r.plies, balW: r.balW,
      secs: +((Date.now() - t0) / 1000).toFixed(1), apertura,
    }) + '\n');
  }
}
