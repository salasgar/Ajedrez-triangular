#!/usr/bin/env node
// Reconstruye la línea principal tras la captura, jugando greedy con la
// propia evaluate() a poca profundidad para ver qué "amenaza" ve la búsqueda.
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
  const centro = libres[0];
  const porDistancia = libres.slice().sort((a, b) =>
    Math.hypot(b.cx - centro.cx, b.cy - centro.cy) - Math.hypot(a.cx - centro.cx, a.cy - centro.cy));
  const masLejanas = porDistancia.slice(0, 10);

  const board = new Map();
  board.set(centro.key, { type: 'O', color: 'w', moved: true });
  board.set(centro.kingNbrs[0].key, { type: 'T', color: 'b', moved: true });
  const tipos = ['O','A','T'];
  masLejanas.forEach((c, i) => {
    board.set(c.key, { type: tipos[i % 3], color: i % 2 === 0 ? 'w' : 'b', moved: true });
  });

  // aplica la captura
  board.delete(centro.key);
  board.set(centro.kingNbrs[0].key, { type: 'O', color: 'w', moved: true });

  const cfg = AI_LEVELS[8];
  const kings = { w: null, b: null };

  // minimax exhaustivo a profundidad fija, SIN poda, para ver la línea real
  function minimax(bd, color, depth, path) {
    if (depth === 0) return { score: evaluate(bd, color, cfg), path };
    const moves = genMoves(bd, color, null, kings, {});
    if (moves.length === 0) return { score: evaluate(bd, color, cfg), path };
    let best = -Infinity, bestPath = null;
    for (const m of moves) {
      const bd2 = new Map(bd);
      const piece = bd2.get(m.from);
      bd2.delete(m.from);
      bd2.set(m.to, { ...piece, moved: true });
      const sub = minimax(bd2, color === 'w' ? 'b' : 'w', depth - 1, [...path, { ...m, color, capturada: bd.get(m.to) }]);
      const score = -sub.score;
      if (score > best) { best = score; bestPath = sub.path; }
    }
    return { score: best, path: bestPath };
  }

  const res = minimax(board, "b", 3, []);
  return { scoreDesdeBlancasTrasBusqueda: -res.score, linea: res.path };
`);
console.log(JSON.stringify(r, null, 2));
