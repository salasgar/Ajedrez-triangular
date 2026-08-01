// elo.js — la aritmética común de analiza.js y escalera.js.
//
// Estaba solo dentro de analiza.js; se saca aquí para que la escalera no
// tenga una segunda implementación que se vaya separando de la primera.
'use strict';

// Puntos de A en cada partida. ptsW viene desde el punto de vista de las
// blancas; `whiteIs` dice cuál de las dos configuraciones las llevaba. Las
// partidas que llegaron al tope se adjudican AHORA, con el margen que se
// pase, para poder comprobar si la conclusión aguanta al moverlo.
function puntosDe(juegos, margen) {
  return juegos.map(g => {
    let ptsW = g.ptsW;
    if (ptsW === null) {
      if (g.balW >= margen) ptsW = 1;
      else if (g.balW <= -margen) ptsW = 0;
      else ptsW = 0.5;
    }
    return g.whiteIs === 'A' ? ptsW : 1 - ptsW;
  });
}

const elo = s => (s <= 0 || s >= 1) ? (s <= 0 ? -Infinity : Infinity)
  : -400 * Math.log10(1 / s - 1);

// Puntuación esperada de quien va `d` elo por delante. Es la traducción útil:
// +50 elo son 57 partidas de cada 100, +400 son 91.
const esperado = d => 1 / (1 + Math.pow(10, -d / 400));

const erf = x => {                      // Abramowitz-Stegun 7.1.26
  const s = Math.sign(x); x = Math.abs(x);
  const tt = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * tt - 1.453152027) * tt + 1.421413741) * tt
    - 0.284496736) * tt + 0.254829592) * tt * Math.exp(-x * x);
  return s * y;
};

function resumen(puntos) {
  const n = puntos.length;
  if (!n) return null;
  const score = puntos.reduce((a, b) => a + b, 0) / n;
  // Barra de error sin suponer nada sobre el reparto de tablas: con muchas
  // tablas la aproximación binomial subestima la incertidumbre.
  const varianza = puntos.reduce((a, x) => a + (x - score) ** 2, 0) / n;
  const se = Math.sqrt(varianza / n);
  const z = se > 0 ? (score - 0.5) / se : 0;
  return {
    n, score, se, z,
    ganadas: puntos.filter(p => p === 1).length,
    tablas: puntos.filter(p => p === 0.5).length,
    perdidas: puntos.filter(p => p === 0).length,
    elo: elo(score),
    lo: elo(score - 1.96 * se),
    hi: elo(score + 1.96 * se),
    p: 1 - erf(Math.abs(z) / Math.SQRT2),
  };
}

function leerJuegos(texto) {
  return texto.split('\n').filter(l => l.startsWith('{')).map(JSON.parse);
}

module.exports = { puntosDe, resumen, elo, esperado, leerJuegos };
