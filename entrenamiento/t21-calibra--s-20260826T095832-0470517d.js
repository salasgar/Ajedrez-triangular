#!/usr/bin/env node
// t21-calibra — Calibración de PROP_K y radiografía del modelo proporcional
// de la tarea 21. NO es un test: es el instrumento con el que se eligió la
// escala, y se deja en el repo para que el número de ai.js sea reproducible.
//
//   node entrenamiento/t21-calibra--<sid>.js [modalidad]
//
// La ficha pide: «k escala al rango habitual de la evaluación (~valor de una
// pieza ≈ 100); elígelo para que capturar una pieza normal en la posición
// inicial mueva el score en ese orden».

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

const CFG = JSON.stringify({ rps: { PROPORCIONAL: 1 } });

console.log('modalidad ' + MODALIDAD + ' · posición inicial\n');

// --- 1) delta de capturar una pieza de cada tipo, con PROP_K = 1 ----------
// Con k=1 el delta es el que impone la fórmula; k es un simple factor, así
// que la k buena sale de una división.
const crudo = run(`
  setVariant(${JSON.stringify(MODALIDAD)});
  newGame();
  const board = game.board;   // el tablero vivo de rules.js
  const cfg = { ...AI_LEVELS[4], rps: { PROPORCIONAL: 1, PROP_K: 1, PROP_INVENCIBLE: 0 } };
  const info = rpsInfo();
  const base = evaluate(board, 'w', cfg);
  const out = { base, cnt: {}, delta: {} };
  for (const t of info.figuras) {
    // quita UNA pieza negra del tipo t y mide cuánto sube la evaluación blanca
    let quitada = null;
    for (const [k, p] of game.board) if (p.color === 'b' && p.type === t) { quitada = k; break; }
    out.cnt[t] = [...game.board.values()].filter(p => p.type === t && p.color === 'w').length;
    if (!quitada) { out.delta[t] = null; continue; }
    const p = board.get(quitada);
    board.delete(quitada);
    out.delta[t] = evaluate(board, 'w', cfg) - base;
    board.set(quitada, p);
  }
  return out;
`);

console.log('piezas blancas por tipo: ' + JSON.stringify(crudo.cnt));
console.log('evaluación inicial con k=1: ' + crudo.base.toFixed(6) +
            '   (debe ser 0: posición simétrica)');
console.log('\ndelta de capturar una pieza rival, con k=1:');
const deltas = [];
for (const [t, d] of Object.entries(crudo.delta)) {
  if (d === null) { console.log(`  ${t}: no hay`); continue; }
  deltas.push(d);
  console.log(`  ${t}: ${d.toFixed(6)}`);
}
const media = deltas.reduce((a, b) => a + b, 0) / deltas.length;
console.log(`  media: ${media.toFixed(6)}`);
console.log(`\n=> para que una captura valga 100: PROP_K = ${(100 / media).toFixed(1)}`);

// --- 2) comprobación con el PROP_K que está puesto en ai.js --------------
const conK = run(`
  setVariant(${JSON.stringify(MODALIDAD)});
  newGame();
  const board = game.board;   // el tablero vivo de rules.js
  const cfg = { ...AI_LEVELS[4], rps: { PROPORCIONAL: 1 } };
  const info = rpsInfo();
  const base = evaluate(board, 'w', cfg);
  const out = { k: RPS_CFG.PROP_K, prima: RPS_CFG.PROP_INVENCIBLE, base, delta: {}, dyn: null };
  for (const t of info.figuras) {
    let quitada = null;
    for (const [k, p] of game.board) if (p.color === 'b' && p.type === t) { quitada = k; break; }
    if (!quitada) { out.delta[t] = null; continue; }
    const p = board.get(quitada);
    board.delete(quitada);
    out.delta[t] = evaluate(board, 'w', cfg) - base;
    board.set(quitada, p);
  }
  out.dyn = rpsDynValues(game.board);
  return out;
`);
console.log(`\ncon el PROP_K de ai.js (${conK.k}) y prima ${conK.prima}:`);
for (const [t, d] of Object.entries(conK.delta)) {
  if (d !== null) console.log(`  capturar ${t} vale ${d.toFixed(1)}`);
}
console.log('  valores para MVV-LVA (delta de recuentos, sin la parte posicional):');
console.log('    ' + JSON.stringify(conK.dyn));

// --- 3) el escenario de Juan Luis: comerse el ÚLTIMO papel rival ---------
// El criterio 3 de hechos/notas/s-20260825T093251-fde516e1.md. En el modelo
// aditivo salía casi neutro (~+19) donde la intuición dice ventaja grande.
const inv = run(`
  setVariant(${JSON.stringify(MODALIDAD)});
  newGame();
  const board = game.board;   // el tablero vivo de rules.js
  const info = rpsInfo();
  const cfgP = { ...AI_LEVELS[4], rps: { PROPORCIONAL: 1 } };
  const cfgA = { ...AI_LEVELS[4] };
  // deja al negro con UNA sola pieza del primer tipo; luego quítasela
  const t0 = info.figuras[0];
  const negras = [...game.board.entries()].filter(([, p]) => p.color === 'b' && p.type === t0);
  for (const [k] of negras.slice(1)) board.delete(k);
  const antesP = evaluate(board, 'w', cfgP), antesA = evaluate(board, 'w', cfgA);
  const ultima = negras[0][0];
  board.delete(ultima);
  return {
    tipo: t0,
    prop: [antesP, evaluate(board, 'w', cfgP)],
    adit: [antesA, evaluate(board, 'w', cfgA)],
  };
`);
console.log(`\nescenario «me como el último ${inv.tipo} rival» (criterio 3 de Juan Luis):`);
console.log(`  proporcional: ${inv.prop[0].toFixed(1)} → ${inv.prop[1].toFixed(1)}` +
            `   (salto de ${(inv.prop[1] - inv.prop[0]).toFixed(1)})`);
console.log(`  aditivo:      ${inv.adit[0].toFixed(1)} → ${inv.adit[1].toFixed(1)}` +
            `   (salto de ${(inv.adit[1] - inv.adit[0]).toFixed(1)})`);

// --- 4) coste por evaluación --------------------------------------------
const coste = run(`
  setVariant(${JSON.stringify(MODALIDAD)});
  newGame();
  const board = game.board;   // el tablero vivo de rules.js
  const cfgP = { ...AI_LEVELS[4], rps: { PROPORCIONAL: 1 } };
  const cfgA = { ...AI_LEVELS[4] };
  const N = 20000;
  let t0 = Date.now(); for (let i = 0; i < N; i++) evaluate(board, 'w', cfgA);
  const ta = Date.now() - t0;
  t0 = Date.now(); for (let i = 0; i < N; i++) evaluate(board, 'w', cfgP);
  const tp = Date.now() - t0;
  return { N, ta, tp };
`);
console.log(`\ncoste por evaluación (posición inicial, ${coste.N} llamadas):`);
console.log(`  aditiva:      ${(coste.ta * 1000 / coste.N).toFixed(2)} µs`);
console.log(`  proporcional: ${(coste.tp * 1000 / coste.N).toFixed(2)} µs` +
            `   (×${(coste.tp / coste.ta).toFixed(2)})`);
