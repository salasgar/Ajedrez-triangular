// ajusta.js — Fase 2 del ajuste: la regresión, sobre un corpus ya generado
// por corpus.js. Barata (segundos), así que se puede repetir variando los
// mandos sin volver a jugar nada.
//
//   cat corp/*.jsonl | node ajusta.js [--reg=0.02] [--features=all] [--holdout=0.2]
//
// Dos cosas que tune-values.js no hacía y que aquí son el objetivo:
//
//  1. SUBCONJUNTOS DE CARACTERÍSTICAS (--features). El ajuste actual mete
//     material, centralidad, avance y movilidad en la misma regresión y
//     acepta el resultado en bloque. Si los pesos posicionales resultan ser
//     ruido, contaminan el paquete entero. Con --features=mat se ajusta solo
//     el material y los pesos posicionales se quedan en cero (= como hoy).
//
//  2. VALIDACIÓN FUERA DE MUESTRA (--holdout). El error sobre las mismas
//     posiciones con las que se ajustó siempre baja al añadir pesos; lo que
//     dice si un peso captura señal real es el error sobre posiciones que no
//     ha visto. Sin esto no hay forma de distinguir "aprendió" de "memorizó",
//     que es justo la duda con los pesos posicionales.
//
// Imprime, además del informe legible, una línea CFG_* con el JSON listo para
// pasárselo a arena.js y medir si de verdad juega mejor.
'use strict';
const fs = require('fs');

function arg(name, def) {
  const a = process.argv.find(x => x.startsWith('--' + name + '='));
  return a ? a.slice(name.length + 3) : def;
}
const REG = Number(arg('reg', 0.02));
const FEATURES = arg('features', 'all');     // mat | matmob | matpos | all
const HOLDOUT = Number(arg('holdout', 0.2));
const ITERATIONS = Number(arg('iters', 800));
const LEARNING_RATE = Number(arg('lr', 5));
const ETIQUETA = arg('nombre', FEATURES + '-r' + REG);

const PIECES = ['P', 'N', 'B', 'E', 'R', 'Q'];
const MOBILITY_SCALE = 10;
// Peso de movilidad del motor VIGENTE (ai.js usa 4 desde el commit 22407e1):
// es el término fijo sobre el que la regresión ajusta el material, y debe
// coincidir con el motor que generó el corpus y que jugará el candidato.
const MOBILITY_DEFAULT = 4;
const K = 1 / 400;

// --- CENTRALITY_BASE sale de la geometría, hay que cargarla ---
const dir = '/Users/salasgar/Documents/git/Ajedrez-triangular';
const gameSrc = ['geometry.js', 'rules.js', 'ai.js']
  .map(f => fs.readFileSync(dir + '/' + f, 'utf8')).join('\n');
let CENTRALITY_BASE, PIECE_VALUE_REF;
eval(gameSrc + `
CENTRALITY_BASE = CELLS.reduce((s, c) => s + centrality(c), 0) / CELLS.length;
PIECE_VALUE_REF = PIECE_VALUE;
`);
const ADVANCE_BASE = 0.5;

// --- leer corpus y sumar los resúmenes de todos los shards ---
const lineas = fs.readFileSync(0, 'utf8').trim().split('\n');
const dataset = [];
const mobTotal = PIECES.map(() => 0), mobCount = PIECES.map(() => 0);
let partidas = 0, shards = 0;
for (const l of lineas) {
  if (!l.startsWith('{')) continue;
  const o = JSON.parse(l);
  if (o.resumen) {
    shards++;
    partidas += o.resumen.usadas;
    o.resumen.mobTotal.forEach((v, i) => mobTotal[i] += v);
    o.resumen.mobCount.forEach((v, i) => mobCount[i] += v);
  } else {
    dataset.push({ diff: o.d, label: o.y });
  }
}
if (!dataset.length) { console.error('corpus vacio'); process.exit(1); }

// Centrado de la movilidad: restar a cada pieza la movilidad media de su
// tipo, para que la característica mida "mis piezas se mueven mejor de lo
// normal" y no "tengo más piezas" (que ya lo miden las seis de material).
const mobBase = PIECES.map((p, i) => (mobCount[i] ? mobTotal[i] / mobCount[i] : 0));
const mobIdx = 2 * PIECES.length + 1;
for (const row of dataset) {
  let c = row.diff[mobIdx];
  for (let t = 0; t < PIECES.length; t++) c -= mobBase[t] * row.diff[t];
  row.diff[mobIdx] = c / MOBILITY_SCALE;
}

// --- qué índices se dejan ajustar según --features ---
// El peón (índice 0) queda siempre fijo como ancla de escala.
const idxMat = [1, 2, 3, 4, 5];
const idxPos = [...Array(PIECES.length).keys()].map(i => PIECES.length + i).concat([2 * PIECES.length]);
const idxMob = [mobIdx];
const ENTRENABLES = {
  mat: idxMat,
  matmob: [...idxMat, ...idxMob],
  matpos: [...idxMat, ...idxPos],
  all: [...idxMat, ...idxPos, ...idxMob],
}[FEATURES];
if (!ENTRENABLES) { console.error('--features debe ser mat|matmob|matpos|all'); process.exit(1); }

// --- reparto entrenamiento / validación, por bloques ---
// Las posiciones de una misma partida están muy correladas; repartirlas al
// azar una a una dejaría posiciones de la misma partida a los dos lados y la
// validación saldría optimista. Se corta por bloques de SAMPLE_STRIDE
// posiciones consecutivas, que es aproximadamente una partida.
const BLOQUE = 20;
const train = [], test = [];
for (let i = 0; i < dataset.length; i++) {
  const bloque = Math.floor(i / BLOQUE);
  ((bloque % Math.round(1 / HOLDOUT) === 0 && HOLDOUT > 0) ? test : train).push(dataset[i]);
}

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

function logloss(data, w) {
  let s = 0;
  for (const { diff, label } of data) {
    let e = 0;
    for (let i = 0; i < w.length; i++) e += w[i] * diff[i];
    const p = Math.min(1 - 1e-12, Math.max(1e-12, sigmoid(e)));
    s += -(label * Math.log(p) + (1 - label) * Math.log(1 - p));
  }
  return s / data.length;
}

function fit(data, initialWeights, entrenables) {
  const w = initialWeights.slice();
  for (let it = 0; it < ITERATIONS; it++) {
    const grad = w.map(() => 0);
    for (const { diff, label } of data) {
      let e = 0;
      for (let i = 0; i < w.length; i++) e += w[i] * diff[i];
      const pred = sigmoid(e);
      const coef = (pred - label) * pred * (1 - pred);
      for (let i = 0; i < w.length; i++) grad[i] += coef * diff[i];
    }
    for (const i of entrenables) {
      const reg = 2 * REG * (w[i] - initialWeights[i]);
      w[i] -= LEARNING_RATE * (grad[i] / data.length + reg);
    }
  }
  return w;
}

// Pesos de partida: material actual escalado por K, posición en 0 (no hay
// valor de hoy del que partir), movilidad en el 2 de siempre.
const initial = [...PIECES.map(p => PIECE_VALUE_REF[p] * K), ...PIECES.map(() => 0), 0,
  MOBILITY_DEFAULT * MOBILITY_SCALE * K];

const wTrain = fit(train, initial, ENTRENABLES);
const wFull = HOLDOUT > 0 ? fit(dataset, initial, ENTRENABLES) : wTrain;

// --- traducir pesos a los números que espera evaluate() ---
// (misma transformación que report() en tune-values.js: deshacer el centrado
// de centralidad y movilidad pasándolo al valor de cada pieza, y renormalizar
// el peón a 100)
function traducir(w) {
  const pawnIdx = 0;
  const scale = 100 / w[pawnIdx];
  const s = w.map(v => v * scale);
  let material = s.slice(0, 6);
  let cent = s.slice(6, 12);
  let adv = s[12];
  let mob = s[13];
  const mobPorJugada = mob / MOBILITY_SCALE;
  material = material.map((v, i) => v - cent[i] * CENTRALITY_BASE - mobPorJugada * mobBase[i]);
  material[pawnIdx] -= adv * ADVANCE_BASE;
  const renorm = 100 / material[pawnIdx];
  material = material.map(v => v * renorm);
  cent = cent.map(v => v * renorm);
  adv *= renorm;
  mob *= renorm;
  return { material, cent, adv, mobPorJugada: mob / MOBILITY_SCALE };
}

const r = traducir(wFull);
const pv = {}; PIECES.forEach((p, i) => pv[p] = Math.round(r.material[i])); pv.K = 0;
const posW = {};
PIECES.forEach((p, i) => {
  const o = {};
  if (Math.round(r.cent[i]) !== 0) o.centrality = Math.round(r.cent[i]);
  if (p === 'P' && Math.round(r.adv) !== 0) o.advance = Math.round(r.adv);
  if (Object.keys(o).length) posW[p] = o;
});

console.log(`=== ${ETIQUETA} ===`);
console.log(`corpus: ${dataset.length} posiciones de ${partidas} partidas (${shards} shards)`);
console.log(`ajustando: ${FEATURES}   reg=${REG}   iters=${ITERATIONS}`);
if (HOLDOUT > 0) {
  const l0tr = logloss(train, initial), l0te = logloss(test, initial);
  const l1tr = logloss(train, wTrain), l1te = logloss(test, wTrain);
  console.log(`logloss entrenamiento: ${l0tr.toFixed(5)} -> ${l1tr.toFixed(5)}  (${((l1tr - l0tr) * 1000).toFixed(2)} milinats)`);
  console.log(`logloss validacion   : ${l0te.toFixed(5)} -> ${l1te.toFixed(5)}  (${((l1te - l0te) * 1000).toFixed(2)} milinats)` +
    (l1te < l0te ? '   <- mejora fuera de muestra' : '   <- NO mejora fuera de muestra'));
  console.log(`   (${test.length} posiciones de validacion, ${train.length} de entrenamiento)`);
}
console.log('material :', PIECES.map((p, i) => `${p}=${r.material[i].toFixed(1)}`).join(' '));
console.log('centrali.:', PIECES.map((p, i) => `${p}=${r.cent[i].toFixed(1)}`).join(' '));
console.log(`avance(P): ${r.adv.toFixed(1)}   movilidad: ${r.mobPorJugada.toFixed(2)} (hoy ${MOBILITY_DEFAULT})`);

// JSON directamente pegable en CFG_B de arena.js
const cfg = { depth: 2, mobility: true, order: true, quiesce: true, pieceValues: pv };
if (Object.keys(posW).length) cfg.positionWeights = posW;
if (FEATURES === 'all' || FEATURES === 'matmob') cfg.mobilityWeight = +r.mobPorJugada.toFixed(2);
console.log('CFG=' + JSON.stringify(cfg));
