// analiza.js — Marcador y barra de error de una tanda de arena.js.
//
//   cat r-*.log | node analiza.js [margen]
//
// `margen` (centipeones, 300 por defecto) es la ventaja material con la que
// se adjudica una partida que llegó al tope de jugadas. Va como argumento y
// no congelado en el log a propósito: es el parámetro más discutible del
// montaje, y así se puede ver si la conclusión aguanta al moverlo.
'use strict';
const MARGEN = Number(process.argv[2] || 300);

const lineas = require('fs').readFileSync(0, 'utf8').trim().split('\n');
const juegos = lineas.filter(l => l.startsWith('{')).map(JSON.parse);

// Cabeceras que escribe arena.js ('# {...}'): dicen qué configuración es A y
// cuál B. Se imprimen las distintas, para que el marcador diga qué comparó y
// no haya que adivinarlo por el nombre del fichero. Los logs antiguos no las
// tienen y siguen funcionando igual.
const cabeceras = [...new Set(lineas.filter(l => l.startsWith('#')))];
for (const c of cabeceras) {
  try {
    const m = JSON.parse(c.slice(1));
    console.log(`A = ${m.A.nombre} ${JSON.stringify(m.A.cfg)}`);
    console.log(`B = ${m.B.nombre} ${JSON.stringify(m.B.cfg)}`);
    console.log(`tope ${m.MAX_PLIES} jugadas, regla de 50 acortada a ${m.FIFTY}`);
    break;                                  // todas iguales salvo semilla
  } catch { /* cabecera de otra version: se ignora */ }
}

// Puntos de A en cada partida. ptsW viene desde el punto de vista de las
// blancas; `whiteIs` dice cuál de las dos configuraciones las llevaba.
const puntos = juegos.map(g => {
  let ptsW = g.ptsW;
  if (ptsW === null) {                       // llegó al tope: adjudicar ahora
    if (g.balW >= MARGEN) ptsW = 1;
    else if (g.balW <= -MARGEN) ptsW = 0;
    else ptsW = 0.5;
  }
  return g.whiteIs === 'A' ? ptsW : 1 - ptsW;
});

const n = puntos.length;
if (!n) { console.log('sin partidas'); process.exit(0); }
const g = puntos.filter(p => p === 1).length;
const t = puntos.filter(p => p === 0.5).length;
const p = puntos.filter(p => p === 0).length;
const score = puntos.reduce((a, b) => a + b, 0) / n;

// Barra de error: desviación típica de la puntuación por partida, sin
// suponer nada sobre el reparto de tablas (con muchas tablas la aproximación
// binomial subestima la incertidumbre).
const varianza = puntos.reduce((a, x) => a + (x - score) ** 2, 0) / n;
const se = Math.sqrt(varianza / n);
const elo = s => (s <= 0 || s >= 1) ? (s <= 0 ? -Infinity : Infinity)
  : -400 * Math.log10(1 / s - 1);
// p-valor a dos colas de "no hay diferencia" (score = 0.5)
const z = se > 0 ? (score - 0.5) / se : 0;
const erf = x => {                      // Abramowitz-Stegun 7.1.26
  const s = Math.sign(x); x = Math.abs(x);
  const tt = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * tt - 1.453152027) * tt + 1.421413741) * tt
    - 0.284496736) * tt + 0.254829592) * tt * Math.exp(-x * x);
  return s * y;
};
const pval = 1 - erf(Math.abs(z) / Math.SQRT2);

const res = {};
for (const j of juegos) res[j.res] = (res[j.res] || 0) + 1;
const topeAdj = juegos.filter(j => j.ptsW === null &&
  Math.abs(j.balW) >= MARGEN).length;

console.log(`partidas: ${n}   (margen de adjudicacion: ${MARGEN} cp)`);
console.log(`A: +${g} =${t} -${p}   score ${(score * 100).toFixed(1)}%`);
console.log(`elo(A-B): ${elo(score).toFixed(0)}  [${elo(score - 1.96 * se).toFixed(0)}, ${elo(score + 1.96 * se).toFixed(0)}]  (IC 95%)`);
console.log(`z = ${z.toFixed(2)}   p = ${pval.toFixed(4)}${pval < 0.05 ? '  <- significativo' : ''}`);
console.log(`finales: ${JSON.stringify(res)}  (de las '${'tope'}', ${topeAdj} adjudicadas)`);
console.log(`duracion media: ${(juegos.reduce((a, j) => a + j.secs, 0) / n).toFixed(1)} s   jugadas medias: ${(juegos.reduce((a, j) => a + j.plies, 0) / n).toFixed(0)}`);
