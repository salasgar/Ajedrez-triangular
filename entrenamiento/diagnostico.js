// diagnostico.js — A qué profundidad se resuelven los problemas que genera el
// motor: distribución de jugadas de la solución, intentos y milisegundos por
// problema. Sirve para ver si un nivel promete una profundidad que casi nunca
// entrega (p. ej. Experto acepta 3-4 jugadas: ¿cuántos «en 4» salen de verdad?).
//
//   node entrenamiento/diagnostico.js --nivel=experto --n=20
//   node entrenamiento/diagnostico.js --nivel=dificil --tipo=mate --ms=20000
//
// Reconstruido el 2026-08-24: el original vivía en el scratchpad de una sesión
// y se purgó. Carga el juego con eval en un único ámbito, como test-edicion.js.
const fs = require('fs');
const path = require('path');

function arg(nombre, defecto) {
  const pre = '--' + nombre + '=';
  const a = process.argv.find(x => x.startsWith(pre));
  return a ? a.slice(pre.length) : defecto;
}

const raiz = path.join(__dirname, '..');
const src = ['geometry.js', 'variants.js', 'rules.js', 'ai.js', 'problemas.js']
  .map(f => fs.readFileSync(path.join(raiz, f), 'utf8')).join('\n');

eval(src + `

setVariant(arg('variant', DEFAULT_VARIANT));
newGame();

const nivel = arg('nivel', 'dificil');
if (!PROB_NIVELES[nivel]) { console.error('Nivel desconocido: ' + nivel); process.exit(1); }
const objetivo = Number(arg('n', 12));       // cuántos problemas juntar
const msCada = Number(arg('ms', 20000));     // presupuesto por problema
const tipoPedido = arg('tipo', null);
const tipos = tipoPedido ? [tipoPedido] : probTiposNivel(nivel);

console.log('Nivel ' + nivel + ' · hasta ' + objetivo + ' problemas · ' +
  (msCada / 1000) + ' s de tope por problema\\n');

const porJugadas = {}, porTipo = {};
let generados = 0, fallos = 0, msTotal = 0, intentosTotal = 0;

for (let i = 0; i < objetivo; i++) {
  const p = probGenera(nivel, tipos, msCada);
  if (!p) { fallos++; continue; }
  generados++;
  msTotal += p.ms;
  intentosTotal += p.intentos;
  porJugadas[p.obj.jugadas] = (porJugadas[p.obj.jugadas] || 0) + 1;
  porTipo[p.obj.tipo] = (porTipo[p.obj.tipo] || 0) + 1;
  console.log('  ' + p.obj.tipo.padEnd(8) + ' en ' + p.obj.jugadas +
    '  (' + p.intentos + ' intentos, ' + p.ms + ' ms)');
}

console.log('\\nGenerados ' + generados + ' de ' + objetivo +
  (fallos ? ' (' + fallos + ' presupuestos agotados sin problema)' : ''));
if (generados) {
  console.log('Por jugadas: ' + Object.entries(porJugadas)
    .map(([j, n]) => 'en ' + j + ' → ' + n).join(' · '));
  console.log('Por tipo: ' + Object.entries(porTipo)
    .map(([t, n]) => t + ' → ' + n).join(' · '));
  console.log('Media: ' + (intentosTotal / generados).toFixed(0) +
    ' intentos y ' + (msTotal / generados).toFixed(0) + ' ms por problema');
}
`);
