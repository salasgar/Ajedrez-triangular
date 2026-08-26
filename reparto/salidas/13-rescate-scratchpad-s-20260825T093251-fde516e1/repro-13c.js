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

  const cfg = AI_LEVELS[8];
  const evalAntes = evaluate(board, 'w', cfg);

  // aplica la captura manualmente
  const board2 = new Map(board);
  board2.delete(libres[0].key);
  board2.set(libres[0].kingNbrs[0].key, { type: 'O', color: 'w', moved: true });
  const evalDespues_desdeBlancas = evaluate(board2, 'w', cfg);
  // tras mover, el turno pasa a negras: evaluate desde el punto de vista de quien mueve ahora
  const evalDespues_desdeNegras = evaluate(board2, 'b', cfg);

  return {
    evalAntesBlancas: evalAntes,
    evalDespuesBlancas: evalDespues_desdeBlancas,
    evalDespuesNegras: evalDespues_desdeNegras,
    gananciaEstatica: evalDespues_desdeBlancas - evalAntes,
  };
`);
console.log(JSON.stringify(r, null, 2));
