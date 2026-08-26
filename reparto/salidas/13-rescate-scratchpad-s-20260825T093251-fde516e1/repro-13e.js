#!/usr/bin/env node
// Reproducción limpia: captura gratis aislada (piezas de relleno lejos de
// verdad, sin interacción posible en pocas jugadas) para el nivel "muy difícil".
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
  // ordena por distancia real (cx,cy) a centro, para relleno DE VERDAD lejano
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
  game.board = board;
  game.history = [snapshot()]; game.histIndex = 0;

  const distanciaMinRelleno = Math.min(...masLejanas.map(c =>
    Math.hypot(c.cx - centro.cx, c.cy - centro.cy)));

  const capturaEsperada = { from: centro.key, to: centro.kingNbrs[0].key };
  const resultados = {};
  for (const nivel of [4,5,6,7,8]) {
    const mv = chooseAiMove(nivel, undefined, { analyze: true });
    const esCaptura = mv.from === capturaEsperada.from && mv.to === capturaEsperada.to;
    const capScore = mv.analysis.find(a => a.from === capturaEsperada.from && a.to === capturaEsperada.to);
    resultados[nivel] = { elegida: { from: mv.from, to: mv.to }, esCaptura,
      scoreCaptura: capScore && capScore.score, scoreElegida: mv.analysis.find(a=>a.chosen).score };
  }
  return { distanciaMinRelleno, nPiezas: board.size, resultados };
`);
console.log(JSON.stringify(r, null, 2));
