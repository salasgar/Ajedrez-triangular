// repro-tarea-12-presupuesto.js — ¿Hace falta más presupuesto para VOLVER a
// verificar el primer movimiento de un problema "experto" que el que usa la
// partida en vivo (PROB_TOPE_VIVO)? Sesión s-20260824T235458-3ccd1290, tarea 12.
const fs = require('fs');
const raiz = '.';
const src = ['geometry.js', 'variants.js', 'rules.js', 'ai.js', 'problemas.js']
  .map(f => fs.readFileSync(f, 'utf8')).join('\n');

eval(src + `
setVariant(DEFAULT_VARIANT);
newGame();

const cfg = PROB_NIVELES.experto;
let peor = 0, muestras = 0, sobrePasaVivo = 0;
const t0 = Date.now();
while (Date.now() - t0 < 60000 && muestras < 15) {
  const p = probGenera('experto', ['mate'], cfg.msEspera || 90000);
  if (!p) continue;
  muestras++;
  const board = new Map(p.board);
  const ctx = probCtx(p.turn, p.obj, p.base, 5000000);
  let nodos = 0, abortado = false;
  try {
    for (const h of probHijos(board, null, p.turn)) {
      probNodoOR([h], p.obj.jugadas, false, null, ctx);
    }
  } catch (e) { if (e !== PROB_ABORTO) throw e; abortado = true; }
  nodos = ctx.nodos;
  if (nodos > peor) peor = nodos;
  if (nodos > 400000) sobrePasaVivo++;
  console.log('jugadas=' + p.obj.jugadas + ' piezas=' + board.size +
    ' nodos-reverificacion=' + nodos + (abortado ? ' (ABORTADO a los 5M)' : ''));
}
console.log('\\npeor caso de ' + muestras + ' muestras: ' + peor + ' nodos');
console.log(sobrePasaVivo + '/' + muestras + ' superan PROB_TOPE_VIVO=400000');
console.log('(PROB_CREA_TOPE=1200000, cfg.tope experto=' + cfg.tope + ')');
`);
