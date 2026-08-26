#!/usr/bin/env node
// Reproduce la partida real hasta el ply 16 (posición exacta donde el nivel 8
// ignora una captura gratis T come A) y analiza a fondo esa posición.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = '/Users/salasgar/Documents/git/Ajedrez-triangular';

const ctx = vm.createContext({ console });
for (const f of ['geometry.js', 'variants.js', 'rules.js', 'ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
function run(code) { return vm.runInContext('(function () {' + code + '}())', ctx); }

vm.runInContext(`
function _siembra(seed) {
  let s = seed >>> 0;
  Math.random = function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}`, ctx);

const r = run(`
  setVariant('rps');
  newGame();
  _siembra(100);
  for (let i = 0; i < 16; i++) {
    const mv = chooseAiMove(8);
    makeMove(mv.from, mv.to);
  }
  // ahora es el turno donde debería capturar -1,1,2 -> -2,2,1 (T come A)
  const board = game.board;
  const captura = { from: '-1,1,2', to: '-2,2,1' };
  const mv = chooseAiMove(8, undefined, { analyze: true });
  const capScore = mv.analysis.find(a => a.from === captura.from && a.to === captura.to);
  const elegidaScore = mv.analysis.find(a => a.chosen);
  return {
    turno: game.turn,
    tablero: Array.from(board.entries()),
    elegida: { from: mv.from, to: mv.to },
    scoreCaptura: capScore,
    scoreElegida: elegidaScore,
    top5: mv.analysis.slice().sort((a,b)=>b.score-a.score).slice(0,5),
  };
`);
fs.writeFileSync('/private/tmp/claude-501/-Users-salasgar-Documents-git-Ajedrez-triangular/2645ba0b-b4b2-461f-8671-b7d7192b9188/scratchpad/posicion-ply16.json', JSON.stringify(r, null, 2));
console.log(JSON.stringify(r, null, 2));
