#!/usr/bin/env node
// t21-gradiente — ¿Se aplana el modelo proporcional cuando ya vas ganando?
//
// La arena de la tarea 21 dejó un patrón raro: el modelo proporcional acaba por
// delante en material en 61 de las 62 partidas que llegan al tope (mediana +600)
// y aun así PIERDE los mates 19-50. La hipótesis es que la media geométrica
// SATURA: cuando ya vas muy por delante, capturar una pieza más apenas mueve la
// puntuación, así que el motor deja de tener motivo para rematar.
//
// Esto lo mide: partiendo de la posición inicial, va quitando piezas negras y en
// cada escalón pregunta cuánto vale capturar UNA MÁS, en los dos modelos.
//
//   node entrenamiento/t21-gradiente--<sid>.js [modalidad]

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const MODALIDAD = process.argv[2] || 'rps-rey';

const ctx = vm.createContext({ console });
for (const f of ['geometry.js', 'variants.js', 'rules.js', 'ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f });
}
const run = code => vm.runInContext('(function () {' + code + '}())', ctx);

const filas = run(`
  setVariant(${JSON.stringify(MODALIDAD)});
  newGame();
  const board = game.board;            // el tablero vivo de rules.js
  const info = rpsInfo();
  const prop = { ...AI_LEVELS[4], rps: { PROPORCIONAL: 1 } };
  const adit = { ...AI_LEVELS[4], rps: { PROPORCIONAL: 0 } };

  // Las negras del tablero, agrupadas por tipo, para ir quitándolas en rueda y
  // no vaciar un tipo entero antes que los demás (eso dispararía la prima de
  // invencibilidad y mediría otra cosa).
  const porTipo = {};
  for (const t of info.figuras) porTipo[t] = [];
  for (const [k, p] of board) if (p.color === 'b' && info.figuras.includes(p.type)) porTipo[p.type].push(k);

  const orden = [];
  for (let i = 0; ; i++) {
    let quedan = false;
    for (const t of info.figuras) if (porTipo[t][i]) { orden.push(porTipo[t][i]); quedan = true; }
    if (!quedan) break;
  }

  // Cuánto vale capturar UNA pieza negra más, ahora mismo: la media del delta
  // sobre todas las negras que quedan (para no depender de cuál se elija).
  function valorDeUnaMas(cfg) {
    const base = evaluate(board, 'w', cfg);
    const vivas = [...board].filter(([k, p]) => p.color === 'b' && info.figuras.includes(p.type));
    if (!vivas.length) return null;
    let suma = 0;
    for (const [k, p] of vivas) {
      board.delete(k);
      suma += evaluate(board, 'w', cfg) - base;
      board.set(k, p);
    }
    return suma / vivas.length;
  }

  const filas = [];
  for (let quitadas = 0; quitadas <= 12; quitadas++) {
    const negras = [...board.values()].filter(p => p.color === 'b' && info.figuras.includes(p.type)).length;
    filas.push({ ventaja: quitadas, negras, prop: valorDeUnaMas(prop), adit: valorDeUnaMas(adit) });
    const k = orden[quitadas];
    if (!k) break;
    board.delete(k);
  }
  return filas;
`);

console.log('modalidad ' + MODALIDAD + ' · cuánto vale capturar UNA pieza más,');
console.log('según cuántas piezas de ventaja llevan ya las blancas\n');
console.log(' ventaja │ negras │ proporcional │ aditivo');
console.log('─────────┼────────┼──────────────┼─────────');
for (const f of filas) {
  if (f.prop === null) continue;
  console.log(
    `  +${String(f.ventaja).padStart(2)}    │   ${String(f.negras).padStart(2)}   │ ` +
    `${f.prop.toFixed(1).padStart(11)}  │ ${f.adit.toFixed(1).padStart(7)}`);
}
const p0 = filas[0], pN = filas.filter(f => f.prop !== null).pop();
console.log(`\nde +0 a +${pN.ventaja} piezas de ventaja:`);
console.log(`  proporcional: ${p0.prop.toFixed(1)} -> ${pN.prop.toFixed(1)}  (x${(pN.prop / p0.prop).toFixed(2)})`);
console.log(`  aditivo:      ${p0.adit.toFixed(1)} -> ${pN.adit.toFixed(1)}  (x${(pN.adit / p0.adit).toFixed(2)})`);
