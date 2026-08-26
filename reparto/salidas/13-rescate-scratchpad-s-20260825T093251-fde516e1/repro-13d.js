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

  const cfgBase = AI_LEVELS[8];
  const captura = { from: libres[0].key, to: libres[0].kingNbrs[0].key };
  const alternativa = { from: '-2,2,1', to: '-1,3,0' };

  function scoreMove(mv, depth) {
    const kings = { w: null, b: null };
    for (const [key, p] of board) if (p.type === 'K') kings[p.color] = key;
    const plies = depth + QUIESCE_MAX_DEPTH + 4;
    const sx = {
      kings, probe: {},
      undo: Array.from({ length: plies }, () => ({})),
      killers: Array.from({ length: plies }, () => [-1, -1]),
      history: new Int32Array(128 * 128),
      h1: 0, h2: 0, nodos: 0, tope: 0, agotado: false,
    };
    const [rh1, rh2] = computeHash(board);
    sx.h1 = rh1; sx.h2 = rh2;
    if (!TT) ttInit();
    ttGen++; ttAge++;
    const u = sx.undo[0];
    const nextEp = makeSim(board, mv.from, mv.to, null, u, kings, sx);
    const score = -negamax(board, 'b', nextEp, 0, new Map(), depth - 1, -Infinity, Infinity, cfgBase, sx, 1);
    unmakeSim(board, u, kings);
    return score;
  }

  const out = [];
  for (let d = 1; d <= 8; d++) {
    out.push({ depth: d, captura: scoreMove(captura, d), alternativa: scoreMove(alternativa, d) });
  }
  return out;
`);
console.log(JSON.stringify(r, null, 2));
