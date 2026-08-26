#!/usr/bin/env node
// t21-conversion — ¿Sabe REMATAR el modelo proporcional?
//
// La arena de la tarea 21 dejó esto: el proporcional acaba por delante en material
// en 61 de las 62 partidas que llegan al tope (mediana +600) y aun así pierde los
// mates 19-50. El gradiente descarta la saturación (t21-gradiente: capturar una
// pieza más vale MÁS cuanto más ganas). Queda la otra explicación: que gane
// material y no sepa convertirlo en mate.
//
// Aquí se mide directo: se le regala a las blancas una ventaja aplastante y se
// deja que el MISMO modelo juegue los dos bandos. Un motor sano remata; uno sin
// instinto de mate da vueltas hasta los 50 movimientos o el tope.
//
//   node entrenamiento/t21-conversion--<sid>.js [modalidad]

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const MODALIDAD = process.argv[2] || 'rps-rey';
const QUITAR = 8;      // piezas negras retiradas (el rey negro NUNCA se toca)
const CAP = 400;       // el mismo tope de plies que usa la arena

const ctx = vm.createContext({ console });
for (const f of ['geometry.js', 'variants.js', 'rules.js', 'ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f });
}
vm.runInContext(`
function _siembra(seed) {
  let s = seed >>> 0;
  Math.random = function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
AI_LEVELS.PROP = { ...AI_LEVELS[4], rps: { PROPORCIONAL: 1 } };
AI_LEVELS.ADIT = { ...AI_LEVELS[4], rps: { PROPORCIONAL: 0 } };
AI_LEVELS.PESO = { ...AI_LEVELS[4], rps: { PROPORCIONAL: 1, PROP_PESOS: 1 } };

// Juega una partida entera con el MISMO modelo en los dos bandos, desde la
// posición inicial menos QUITAR piezas negras.
function _convierte(id, modelo, quitar, cap, seed) {
  setVariant(id);
  newGame();
  _siembra(seed);
  const info = rpsInfo();
  // se quitan en rueda por tipos, para no extinguir un tipo entero (eso
  // dispararía la prima de invencibilidad y mediría otra cosa)
  const porTipo = {};
  for (const t of info.figuras) porTipo[t] = [];
  for (const [k, p] of game.board)
    if (p.color === 'b' && info.figuras.includes(p.type)) porTipo[p.type].push(k);
  const orden = [];
  for (let i = 0; ; i++) {
    let quedan = false;
    for (const t of info.figuras) if (porTipo[t][i]) { orden.push(porTipo[t][i]); quedan = true; }
    if (!quedan) break;
  }
  for (let i = 0; i < quitar; i++) game.board.delete(orden[i]);

  let plies = 0;
  const capturas = { w: 0, b: 0 };   // el dato que decide: ¿llega a capturar?
  while (!gameEnded() && plies < cap) {
    const mv = chooseAiMove(modelo);
    if (!mv) break;
    const quien = game.turn;
    const habia = game.board.size;
    makeMove(mv.from, mv.to);
    if (game.board.size < habia) capturas[quien]++;
    plies++;
  }
  const piezas = { w: 0, b: 0 };
  for (const [, p] of game.board) piezas[p.color]++;
  return { status: game.status, winner: game.winner, plies, piezas, capturas };
}`, ctx);

const run = code => vm.runInContext('(function () {' + code + '}())', ctx);

console.log(`modalidad ${MODALIDAD} · blancas con ${QUITAR} piezas de ventaja,`);
console.log(`el mismo modelo juega los dos bandos, tope ${CAP} medias jugadas\n`);
console.log(' modelo       │ semilla │ final        │ gana │ plies │ piezas w-b │ capturas w-b');
console.log('──────────────┼─────────┼──────────────┼──────┼───────┼────────────┼─────────────');
const resumen = { PROP: [], ADIT: [], PESO: [] };
for (const seed of [101, 202, 303]) {
  for (const modelo of ['ADIT', 'PROP', 'PESO']) {
    const r = run(`return _convierte(${JSON.stringify(MODALIDAD)}, ${JSON.stringify(modelo)}, ${QUITAR}, ${CAP}, ${seed});`);
    resumen[modelo].push(r);
    const nombre = modelo === 'PROP' ? 'proporcional' : modelo === 'PESO' ? 'proporc.PESOS' : 'aditivo      ';
    console.log(` ${nombre} │   ${seed}   │ ${String(r.status).padEnd(12)} │  ${(r.winner || '-').padEnd(3)} │  ${String(r.plies).padStart(4)} │  ${String(r.piezas.w).padStart(2)}-${String(r.piezas.b).padStart(2)}    │   ${String(r.capturas.w).padStart(3)}-${String(r.capturas.b).padStart(3)}`);
  }
}
console.log('');
for (const modelo of ['ADIT', 'PROP', 'PESO']) {
  const rs = resumen[modelo];
  const mates = rs.filter(r => r.status === 'checkmate' && r.winner === 'w').length;
  const cap = rs.reduce((x, r) => x + r.capturas.w + r.capturas.b, 0);
  console.log(`${modelo === 'PROP' ? 'proporcional ' : modelo === 'PESO' ? 'proporc.PESOS' : 'aditivo      '}: remata en ${mates}/${rs.length} · ${cap} capturas en total` +
    (mates ? ` · media ${(rs.filter(r => r.status === 'checkmate').reduce((s, r) => s + r.plies, 0) / mates).toFixed(0)} medias jugadas` : ''));
}
