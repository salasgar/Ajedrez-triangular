#!/usr/bin/env node
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = '/Users/salasgar/Documents/git/Ajedrez-triangular';

const ctx = vm.createContext({ console });
for (const f of ['geometry.js', 'variants.js', 'rules.js', 'ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
function run(code) { return vm.runInContext('(function () {' + code + '}())', ctx); }

const r = run(`
  setVariant('rps');
  newGame();
  const libres = CELLS.filter(c => c.kingNbrs.length >= 3);
  const board = new Map();
  board.set(libres[0].key, { type: 'O', color: 'w', moved: true });
  board.set(libres[0].kingNbrs[0].key, { type: 'T', color: 'b', moved: true });
  const lejos = libres.slice(10, 20);
  const tipos = ['O','A','T'];
  lejos.forEach((c, i) => {
    board.set(c.key, { type: tipos[i % 3], color: i % 2 === 0 ? 'w' : 'b', moved: true });
  });
  game.board = board;
  game.history = [snapshot()]; game.histIndex = 0;

  const capturaEsperada = { from: libres[0].key, to: libres[0].kingNbrs[0].key };
  const mv = chooseAiMove(8, undefined, { analyze: true });
  const bd = Array.from(board.entries());
  const chosenIsCapture = board.get(mv.to) ? { type: board.get(mv.to).type, color: board.get(mv.to).color } : null;
  const analysisSorted = mv.analysis.slice().sort((a,b) => b.score - a.score).slice(0, 8)
    .map(a => ({ from: a.from, to: a.to, score: a.score, capturaAhi: board.get(a.to) ? board.get(a.to).type + board.get(a.to).color : null }));
  const capEsperadaEnAnalisis = mv.analysis.find(a => a.from === capturaEsperada.from && a.to === capturaEsperada.to);
  return { board: bd, chosen: { from: mv.from, to: mv.to }, chosenIsCapture, analysisSorted, capEsperadaEnAnalisis };
`);
console.log(JSON.stringify(r, null, 2));
