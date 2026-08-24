// aperturas.js — Genera el libro fijo de aperturas para arena.js.
//
//   node aperturas.js > libro-salas.json
//   MODALIDAD=dekle node aperturas.js > libro-dekle.json
//
// UN LIBRO POR MODALIDAD, no uno compartido. Las aperturas son claves de
// casilla, y ni el tablero ni las jugadas coinciden entre modalidades:
// comprobado, de 100 aperturas de Salas solo 44 son legales en Dekle (las de
// peón, que se mueve igual) y ninguna en Trigonal, que ni siquiera tiene el
// mismo tablero. Un libro equivocado no revienta: sesga la muestra en
// silencio. Por eso arena.js comprueba la legalidad del libro al arrancar.
//
// 400 aperturas únicas de 6 jugadas legales al azar, rechazando las que
// terminan la partida o desequilibran el material (capturas): cada par de la
// arena debe arrancar de una posición igualada para que la inversión de
// colores compare lo mismo en los dos sentidos. Con semilla fija, para que el
// libro sea reproducible.
//
// (Reconstruido el 2026-07-27: el libro original del scratchpad lo purgó el
// limpiador de temporales. Las aperturas concretas cambian; la metodología y
// la comparabilidad DENTRO de cada tanda, no.)
'use strict';
const fs = require('fs');
const path = require('path');

const SEED = Number(process.env.SEED || 20260721);
const N_APERTURAS = Number(process.env.N_APERTURAS || 400);
const OPENING_PLIES = Number(process.env.OPENING_PLIES || 6);
const MODALIDAD = process.env.MODALIDAD || 'salas';

const dir = process.env.MOTOR || '/Users/salasgar/Documents/git/Ajedrez-triangular';
const gameSrc = ['geometry.js', 'variants.js', 'rules.js', 'ai.js']
  .map(f => fs.readFileSync(path.join(dir, f), 'utf8'))
  .join('\n');

const driverSrc = `
if (!VARIANTS[${JSON.stringify(MODALIDAD)}]) {
  process.stderr.write('modalidad desconocida: ${MODALIDAD}. Hay: ' +
    Object.keys(VARIANTS).join(', ') + '\\n');
  process.exit(1);
}
setVariant(${JSON.stringify(MODALIDAD)});

let _s = ${SEED} >>> 0;
Math.random = function () {
  _s = (_s + 0x6D2B79F5) >>> 0;
  let t = _s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function materialBalanceW(board) {
  let m = 0;
  for (const [, p] of board) m += (p.color === 'w' ? 1 : -1) * PV()[p.type];
  return m;
}

const libro = [];
const vistas = new Set();
while (libro.length < ${N_APERTURAS}) {
  newGame();
  const moves = [];
  let ok = true;
  for (let i = 0; i < ${OPENING_PLIES}; i++) {
    const ms = movesForSide(game.board, game.turn, game.enPassant);
    if (ms.length === 0) { ok = false; break; }
    const m = ms[Math.floor(Math.random() * ms.length)];
    moves.push(m.from + '>' + m.to);
    makeMove(m.from, m.to);
  }
  if (!ok || gameEnded() || materialBalanceW(game.board) !== 0) continue;
  const clave = moves.join(' ');
  if (vistas.has(clave)) continue;
  vistas.add(clave);
  libro.push(moves);
}
process.stdout.write(JSON.stringify(libro));
process.stderr.write('libro[' + V.id + ']: ' + libro.length + ' aperturas de ' +
  ${OPENING_PLIES} + ' jugadas, semilla ' + ${SEED} + '\\n');
`;

eval(gameSrc + '\n' + driverSrc);
