#!/usr/bin/env node
// t21-barrido — Verificación funcional BARATA del modelo proporcional, antes
// de gastar CPU de arena (paso 2 de la ficha de la tarea 21).
//
// La tarea 13 encontró que con los pesos de amenaza originales la captura
// gratis obvia PERDÍA justo en la profundidad 4 —donde cae el presupuesto de
// nodos real de los niveles altos— y ganaba en las demás: una oscilación entre
// profundidades, no una preferencia. Bajar los pesos (13) lo mitigó y la 18 lo
// confirmó por elo. La promesa del modelo proporcional es atacar la RAÍZ: con
// todos los términos acotados en (0,1] ninguno puede desbocarse.
//
// Esto compara, sobre la MISMA posición real del ply 16, los dos modelos a
// cada profundidad. Criterio de la ficha: con el modelo nuevo la captura debe
// ganar en TODAS las profundidades y la oscilación no debe reaparecer.
//
//   node entrenamiento/t21-barrido--<sid>.js [profundidadMax]

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DMAX = Number(process.argv[2] || 6);
const POS = path.join(RAIZ, 'reparto/salidas',
  '13-rescate-scratchpad-s-20260825T093251-fde516e1', 'posicion-ply16.json');

const ctx = vm.createContext({ console });
for (const f of ['geometry.js', 'variants.js', 'rules.js', 'ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f });
}
const pos = JSON.parse(fs.readFileSync(POS, 'utf8'));

// OJO: la posición es de la modalidad `rps` (sin rey). Es la que dejó la tarea
// 13 y la que la ficha manda usar; que las modalidades sin rey estén aparcadas
// se refiere a NO gastar arena en ellas, no a renunciar a la única posición de
// regresión documentada que tiene este problema.
const r = vm.runInContext(`(function () {
  setVariant('rps');
  const tablero = ${JSON.stringify(pos.tablero)};
  const base = new Map(tablero.map(([k, v]) => [k, v]));
  // las dos jugadas que enfrentó la tarea 13: la captura gratis y la tranquila
  // que el motor prefería por el artefacto
  const captura = { from: '-1,1,2', to: '-2,2,1' };
  const elegida = { from: '0,0,1', to: '-1,0,2' };

  function scoreMove(mv, depth, cfg) {
    const bd = new Map(base);
    const kings = { w: null, b: null };
    const plies = depth + QUIESCE_MAX_DEPTH + 4;
    const sx = {
      kings, probe: {},
      undo: Array.from({ length: plies }, () => ({})),
      killers: Array.from({ length: plies }, () => [-1, -1]),
      history: new Int32Array(128 * 128),
      h1: 0, h2: 0, nodos: 0, tope: 0, agotado: false,
    };
    const [rh1, rh2] = computeHash(bd);
    sx.h1 = rh1; sx.h2 = rh2;
    if (!TT) ttInit();
    ttGen++; ttAge++;
    const u = sx.undo[0];
    const nextEp = makeSim(bd, mv.from, mv.to, null, u, kings, sx);
    const score = -negamax(bd, 'b', nextEp, 0, new Map(), depth - 1,
      -Infinity, Infinity, cfg, sx, 1);
    unmakeSim(bd, u, kings);
    return score;
  }

  const modelos = {
    // el aditivo con los pesos ANTIGUOS: es el que oscilaba, y se incluye
    // para que la comparación tenga el caso malo de verdad y no solo el ya
    // arreglado por la tarea 13
    'aditivo 0.2/0.6': { ...AI_LEVELS[8], rps: { AMENAZA: 0.2, AMENAZA_COLGADA: 0.6 } },
    'aditivo vigente': { ...AI_LEVELS[8] },
    proporcional: { ...AI_LEVELS[8], rps: { PROPORCIONAL: 1 } },
  };
  const out = {};
  for (const [nombre, cfg] of Object.entries(modelos)) {
    out[nombre] = [];
    for (let d = 1; d <= ${DMAX}; d++) {
      out[nombre].push({
        d,
        captura: scoreMove(captura, d, cfg),
        elegida: scoreMove(elegida, d, cfg),
      });
    }
  }
  return out;
}())`, ctx);

console.log('posición real del ply 16 (modalidad rps, 40 piezas)');
console.log('captura gratis  -1,1,2>-2,2,1   contra   tranquila  0,0,1>-1,0,2\n');
let malo = 0;
for (const [nombre, filas] of Object.entries(r)) {
  console.log(nombre + ':');
  console.log('  prof │  captura │ tranquila │ diferencia │ ¿gana la captura?');
  let ganas = 0;
  for (const f of filas) {
    const dif = f.captura - f.elegida;
    const gana = dif > 0;
    if (gana) ganas++;
    console.log(`  ${String(f.d).padStart(4)} │ ${f.captura.toFixed(1).padStart(8)} │ ` +
      `${f.elegida.toFixed(1).padStart(9)} │ ${dif.toFixed(1).padStart(10)} │ ` +
      (gana ? 'sí' : 'NO  <<<'));
  }
  const ok = ganas === filas.length;
  console.log(`  => la captura gana en ${ganas}/${filas.length} profundidades` +
    (ok ? '  (sin oscilación)' : '  (OSCILA)'));
  if (nombre === 'proporcional' && !ok) malo = 1;
  console.log('');
}
process.exit(malo);
