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

const { puntosDe, resumen } = require('./elo.js');
const puntos = puntosDe(juegos, MARGEN);
const r = resumen(puntos);
if (!r) { console.log('sin partidas'); process.exit(0); }
const { n, score, z, ganadas: g, tablas: t, perdidas: p, p: pval } = r;

const res = {};
for (const j of juegos) res[j.res] = (res[j.res] || 0) + 1;
const topeAdj = juegos.filter(j => j.ptsW === null &&
  Math.abs(j.balW) >= MARGEN).length;

console.log(`partidas: ${n}   (margen de adjudicacion: ${MARGEN} cp)`);
console.log(`A: +${g} =${t} -${p}   score ${(score * 100).toFixed(1)}%`);
console.log(`elo(A-B): ${r.elo.toFixed(0)}  [${r.lo.toFixed(0)}, ${r.hi.toFixed(0)}]  (IC 95%)`);
console.log(`z = ${z.toFixed(2)}   p = ${pval.toFixed(4)}${pval < 0.05 ? '  <- significativo' : ''}`);
console.log(`finales: ${JSON.stringify(res)}  (de las '${'tope'}', ${topeAdj} adjudicadas)`);
console.log(`duracion media: ${(juegos.reduce((a, j) => a + j.secs, 0) / n).toFixed(1)} s   jugadas medias: ${(juegos.reduce((a, j) => a + j.plies, 0) / n).toFixed(0)}`);
