#!/usr/bin/env node
// Reproducción tarea 13: ¿el nivel alto deja piezas gratis sin comer en PPT?
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = '/Users/salasgar/Documents/git/Ajedrez-triangular';

const ctx = vm.createContext({ console });
for (const f of ['geometry.js', 'variants.js', 'rules.js', 'ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}

function run(code) {
  return vm.runInContext('(function () {' + code + '}())', ctx);
}

// Posición con varias piezas, con UNA captura obvia y gratis para blancas
// (una tijera negra que ninguna piedra negra puede recapturar), rodeada de
// más piezas para que el nivel tenga alternativas y el presupuesto de nodos
// se reparta de verdad.
const r = run(`
  setVariant('rps');
  newGame();
  const centro = CELLS.find(c => c.kingNbrs.length >= 3);
  // exploramos un anillo de casillas libres para dispersar piezas
  const libres = CELLS.filter(c => c.kingNbrs.length >= 3);
  const board = new Map();
  // captura gratis: piedra blanca junto a tijera negra, sin papel negro cerca
  board.set(libres[0].key, { type: 'O', color: 'w', moved: true });
  board.set(libres[0].kingNbrs[0].key, { type: 'T', color: 'b', moved: true });
  // relleno: piezas lejanas para dar alternativas y ocupar presupuesto
  const lejos = libres.slice(10, 20);
  const tipos = ['O','A','T'];
  lejos.forEach((c, i) => {
    board.set(c.key, { type: tipos[i % 3], color: i % 2 === 0 ? 'w' : 'b', moved: true });
  });
  game.board = board;
  game.history = [snapshot()]; game.histIndex = 0;
  const capturaEsperada = { from: libres[0].key, to: libres[0].kingNbrs[0].key };
  const resultados = {};
  for (const nivel of [4,5,6,7,8]) {
    const mv = chooseAiMove(nivel, undefined, { analyze: true });
    resultados[nivel] = { from: mv.from, to: mv.to,
      esCaptura: mv.from === capturaEsperada.from && mv.to === capturaEsperada.to };
  }
  return { capturaEsperada, resultados, nPiezas: board.size };
`);
console.log(JSON.stringify(r, null, 2));
