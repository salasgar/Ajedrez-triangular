// ajusta.js — Fase 2 del ajuste: la regresión, sobre un corpus ya generado
// por corpus.js. Barata (segundos), así que se puede repetir variando los
// mandos sin volver a jugar nada.
//
//   cat corp/*.jsonl | node ajusta.js [--reg=0.02] [--features=all] [--holdout=0.2]
//
// LA MODALIDAD Y LA LISTA DE PIEZAS SE LEEN DEL CORPUS, no se pasan por
// argumento: cada shard las escribe en su resumen (ver corpus.js). Así no hay
// forma de ajustar el corpus de una modalidad interpretándolo con las piezas
// de otra, que era el fallo que esperaba a quien reutilizase este script tal
// cual —las piezas estaban escritas a mano, y en Dekle la cuarta componente
// del vector es el unicornio, no el elefante—. Si se mezclan shards de
// modalidades distintas, aborta.
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

const MOBILITY_SCALE = 10;
const K = 1 / 400;

// --- leer corpus: primero, porque de él salen la modalidad y las piezas ---
const lineas = fs.readFileSync(0, 'utf8').trim().split('\n');
const dataset = [];
const resumenes = [];
for (const l of lineas) {
  if (!l.startsWith('{')) continue;
  const o = JSON.parse(l);
  if (o.resumen) resumenes.push(o.resumen);
  else dataset.push({ diff: o.d, label: o.y });
}
if (!dataset.length) { console.error('corpus vacio'); process.exit(1); }
if (!resumenes.length) {
  console.error('corpus sin linea de resumen: no se sabe de que modalidad es' +
    ' ni en que orden van las piezas. Regeneralo con corpus.js.');
  process.exit(1);
}

// Todos los shards tienen que ser de la misma modalidad y con las piezas en el
// mismo orden: si no, sus vectores de características no miden lo mismo y
// sumarlos daría un ajuste sin sentido.
const MODALIDAD = resumenes[0].modalidad;
const PIECES = resumenes[0].piezas;
if (!MODALIDAD || !PIECES) {
  console.error('resumen antiguo, sin modalidad/piezas. Regeneralo con corpus.js.');
  process.exit(1);
}
for (const r of resumenes) {
  if (r.modalidad !== MODALIDAD || r.piezas.join() !== PIECES.join()) {
    console.error('ABORTA: se estan mezclando shards de modalidades distintas (' +
      MODALIDAD + ' y ' + r.modalidad + ')');
    process.exit(1);
  }
}

const mobTotal = PIECES.map(() => 0), mobCount = PIECES.map(() => 0);
let partidas = 0;
const shards = resumenes.length;
for (const r of resumenes) {
  partidas += r.usadas;
  r.mobTotal.forEach((v, i) => mobTotal[i] += v);
  r.mobCount.forEach((v, i) => mobCount[i] += v);
}

// --- CENTRALITY_BASE y los valores de hoy salen de la geometría de ESA
// modalidad, que hay que cargar (el tablero de Trigonal no es el del resto) ---
const dir = process.env.MOTOR || '/Users/salasgar/Documents/git/Ajedrez-triangular';
const gameSrc = ['geometry.js', 'variants.js', 'rules.js', 'ai.js']
  .map(f => fs.readFileSync(dir + '/' + f, 'utf8')).join('\n');
let CENTRALITY_BASE, PIECE_VALUE_REF, MODALIDAD_FULL, MOBILITY_DEFAULT;
eval(gameSrc + `
setVariant(${JSON.stringify(MODALIDAD)});
CENTRALITY_BASE = CELLS.reduce((s, c) => s + centrality(c), 0) / CELLS.length;
PIECE_VALUE_REF = PV();
MODALIDAD_FULL = V.full;
// Peso de movilidad VIGENTE en esta modalidad: es el término fijo sobre el que
// la regresión ajusta el material, y tiene que ser el mismo con el que se jugó
// el corpus y con el que jugará el candidato.
MOBILITY_DEFAULT = V.engine.mobility ?? 4;
`);
const ADVANCE_BASE = 0.5;

// Comprobación de forma: el vector de cada posición tiene que traer una
// componente de material y una de centralidad por pieza, más avance y
// movilidad. Si no cuadra, el corpus no es de estas piezas.
const N_FEAT = 2 * PIECES.length + 2;
const raro = dataset.find(r => r.diff.length !== N_FEAT);
if (raro) {
  console.error('ABORTA: el corpus trae vectores de ' + raro.diff.length +
    ' componentes y ' + MODALIDAD + ' (' + PIECES.join(',') + ') necesita ' + N_FEAT);
  process.exit(1);
}

// Centrado de la movilidad: restar a cada pieza la movilidad media de su
// tipo, para que la característica mida "mis piezas se mueven mejor de lo
// normal" y no "tengo más piezas" (que ya lo mide el material).
const mobBase = PIECES.map((p, i) => (mobCount[i] ? mobTotal[i] / mobCount[i] : 0));
const mobIdx = 2 * PIECES.length + 1;
for (const row of dataset) {
  let c = row.diff[mobIdx];
  for (let t = 0; t < PIECES.length; t++) c -= mobBase[t] * row.diff[t];
  row.diff[mobIdx] = c / MOBILITY_SCALE;
}

// --- qué índices se dejan ajustar según --features ---
// El peón (índice 0) queda siempre fijo como ancla de escala.
const idxMat = [...Array(PIECES.length).keys()].slice(1);
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
  const pawnIdx = 0;   // el peón va siempre primero (ver corpus.js)
  const n = PIECES.length;
  const scale = 100 / w[pawnIdx];
  const s = w.map(v => v * scale);
  let material = s.slice(0, n);
  let cent = s.slice(n, 2 * n);
  let adv = s[2 * n];
  let mob = s[mobIdx];
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
console.log(`modalidad: ${MODALIDAD_FULL}   piezas: ${PIECES.join(' ')}`);
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
console.log('hoy      :', PIECES.map(p => `${p}=${PIECE_VALUE_REF[p]}`).join(' '));
console.log('centrali.:', PIECES.map((p, i) => `${p}=${r.cent[i].toFixed(1)}`).join(' '));
console.log(`avance(P): ${r.adv.toFixed(1)}   movilidad: ${r.mobPorJugada.toFixed(2)} (hoy ${MOBILITY_DEFAULT})`);

// Candidato para engine.pieceValues de esta modalidad en variants.js. Ojo:
// es una SUGERENCIA. La regresión minimiza el error de predecir el resultado,
// no la fuerza de juego; entra en variants.js solo después de ganar en la
// arena contra los valores vigentes.
console.log('\npieceValues: { ' + PIECES.map(p => `${p}: ${pv[p]}`).join(', ') + ', K: 0 },');

// JSON directamente pegable en CFG_B de arena.js (con MODALIDAD=<esta>, que
// arena.js necesita para poner el tablero y el juego de piezas correctos).
const cfg = { depth: 2, mobility: true, order: true, quiesce: true, pieceValues: pv };
if (Object.keys(posW).length) cfg.positionWeights = posW;
if (FEATURES === 'all' || FEATURES === 'matmob') cfg.mobilityWeight = +r.mobPorJugada.toFixed(2);
console.log('MODALIDAD=' + MODALIDAD);
console.log('CFG=' + JSON.stringify(cfg));
