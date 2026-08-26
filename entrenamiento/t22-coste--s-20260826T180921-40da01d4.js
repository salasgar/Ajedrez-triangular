#!/usr/bin/env node
// t22-coste — µs por evaluación del candidato de la tarea 22, comparado con
// el aditivo y con el proporcional puro de la 21 (que midió ×2,82: 37,9 µs
// contra 13,4). El término de acoso añade una consulta a la matriz de
// distancias por pieza y el freno del rey un recuento por hoja; aquí se mide
// cuánto es eso de verdad, en la misma posición de mediojuego para todos.
//
//   node entrenamiento/t22-coste--<sid>.js [modalidad]

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const MODALIDAD = process.argv[2] || 'rps-rey';

const ctx = vm.createContext({ console, process });
for (const f of ['geometry.js', 'variants.js', 'rules.js', 'ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f });
}
vm.runInContext(`
function _mide(id) {
  setVariant(id);
  newGame();
  // posición de mediojuego reproducible: 20 medias jugadas del nivel 2 con
  // semilla fija (bastan para desperdigar piezas sin vaciar el tablero)
  let s = 12345 >>> 0;
  Math.random = function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < 20 && !gameEnded(); i++) {
    const mv = chooseAiMove(2);
    if (!mv) break;
    makeMove(mv.from, mv.to);
  }
  const board = game.board;
  const configs = {
    'aditivo             ': { depth: 2, rps: { PROPORCIONAL: 0 } },
    'proporcional puro   ': { depth: 2, rps: { PROPORCIONAL: 1, PROP_PESOS: 0, PROP_ACOSO: 0, PROP_ACOSO_REY: 0 } },
    'prop.+acoso x10     ': { depth: 2, rps: { PROPORCIONAL: 1, PROP_PESOS: 0, PROP_ACOSO: 10, PROP_ACOSO_REY: 10 } },
    'candidato (defaults)': { depth: 2 },
  };
  const N = 20000;
  const out = [];
  // pasada completa de DESCARTE primero: el primer modelo en ejecutarse paga
  // la compilación del JIT de todo su camino y salía el doble de caro que los
  // siguientes (123 µs un modelo con menos trabajo que otro de 66)
  for (let pasada = 0; pasada < 2; pasada++) {
    out.length = 0;
    for (const [nombre, cfg] of Object.entries(configs)) {
      for (let i = 0; i < 5000; i++) evaluate(board, 'w', cfg);
      const t0 = process.hrtime.bigint();
      for (let i = 0; i < N; i++) evaluate(board, 'w', cfg);
      const us = Number(process.hrtime.bigint() - t0) / 1000 / N;
      out.push(nombre + ' ' + us.toFixed(1) + ' µs/eval');
    }
  }
  return { piezas: board.size, out };
}`, ctx);

const r = vm.runInContext(`_mide(${JSON.stringify(MODALIDAD)})`, ctx);
console.log(`coste por evaluación · ${MODALIDAD} · posición de mediojuego (${r.piezas} piezas) · 20000 evals`);
for (const l of r.out) console.log('  ' + l);
