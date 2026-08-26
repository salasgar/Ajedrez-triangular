#!/usr/bin/env node
// Barrido de profundidad sobre la posición REAL del ply 16: score de la
// captura gratis vs la jugada elegida, a cada profundidad, para ver dónde
// se invierte respecto a la evaluación estática.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = '/Users/salasgar/Documents/git/Ajedrez-triangular';

const ctx = vm.createContext({ console });
for (const f of ['geometry.js', 'variants.js', 'rules.js', 'ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
function run(code) { return vm.runInContext('(function () {' + code + '}())', ctx); }

const pos = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-salasgar-Documents-git-Ajedrez-triangular/2645ba0b-b4b2-461f-8671-b7d7192b9188/scratchpad/posicion-ply16.json', 'utf8'));

const r = run(`
  setVariant('rps');
  const tablero = ${JSON.stringify(pos.tablero)};
  const board = new Map(tablero.map(([k,v]) => [k, v]));
  const cfg = AI_LEVELS[8];
  const captura = { from: '-1,1,2', to: '-2,2,1' };
  const elegida = { from: '0,0,1', to: '-1,0,2' };

  function scoreMove(mv, depth) {
    const bd = new Map(board);
    const kings = { w: null, b: null };
    const plies = depth + QUIESCE_MAX_DEPTH + 4;
    const sx = {
      kings, probe: {},
      undo: Array.from({ length: plies }, () => ({})),
      killers: Array.from({ length: plies }, () => [-1, -1]),
      history: new Int32Array(128 * 128),
      h1: 0, h2: 0, nodos: 0, tope: 0, agotado: false,
    };
    const [rh1, rh2] = computeHash(bd);
    sx.h1 = rh1; sx.h2 = rh2;
    if (!TT) ttInit();
    ttGen++; ttAge++;
    const u = sx.undo[0];
    const nextEp = makeSim(bd, mv.from, mv.to, null, u, kings, sx);
    const score = -negamax(bd, 'b', nextEp, 0, new Map(), depth - 1, -Infinity, Infinity, cfg, sx, 1);
    unmakeSim(bd, u, kings);
    return score;
  }

  const out = [];
  for (let d = 1; d <= 10; d++) {
    out.push({ depth: d, captura: scoreMove(captura, d), elegida: scoreMove(elegida, d) });
  }
  return out;
`);
console.log(JSON.stringify(r, null, 2));
