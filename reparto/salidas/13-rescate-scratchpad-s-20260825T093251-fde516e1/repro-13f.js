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

  const cfg = AI_LEVELS[8];
  const evalAntes_w = evaluate(board, 'w', cfg);

  const board2 = new Map(board);
  board2.delete(centro.key);
  board2.set(centro.kingNbrs[0].key, { type: 'O', color: 'w', moved: true });
  const evalDespues_w = evaluate(board2, 'w', cfg);
  const evalDespues_b = evaluate(board2, 'b', cfg);

  // desglose manual: solo material dinámico, sin movilidad/amenaza/caza
  function soloMaterial(bd) {
    const info = rpsInfo();
    const cnt = { w: {}, b: {} };
    for (const t of info.tipos) { cnt.w[t]=0; cnt.b[t]=0; }
    for (const [,p] of bd) cnt[p.color][p.type]++;
    let score = 0;
    for (const t of info.figuras) {
      const vw = rpsValor(t, cnt.b), vb = rpsValor(t, cnt.w);
      score += cnt.w[t]*vw - cnt.b[t]*vb;
    }
    return score;
  }

  return {
    evalAntes_w, evalDespues_w, evalDespues_b,
    gananciaEstaticaTotal: evalDespues_w - evalAntes_w,
    materialAntes: soloMaterial(board),
    materialDespues: soloMaterial(board2),
  };
`);
console.log(JSON.stringify(r, null, 2));
