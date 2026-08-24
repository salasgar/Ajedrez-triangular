// rendimiento.js — Cuántos problemas por minuto genera el motor de problemas,
// por nivel y por tipo, con la configuración real de PROB_NIVELES.
//
//   node entrenamiento/rendimiento.js
//   node entrenamiento/rendimiento.js --nivel=dificil,experto --ms=12000
//   node entrenamiento/rendimiento.js --variant=salas-v4 --tipo=mate
//
// `--ms` es el presupuesto POR CELDA (nivel × tipo); 12 s por defecto, que es
// la unidad en que se midió siempre (el traspaso de problemas da los números
// históricos «por cada 12 s de generación en un solo hilo»).
//
// Reconstruido el 2026-08-24: el original vivía en el scratchpad de una sesión
// y se purgó. Esta versión carga el juego con eval en un único ámbito, igual
// que test-edicion.js y tune-values.js.
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

const variante = arg('variant', DEFAULT_VARIANT);
if (!VARIANTS[variante]) {
  console.error('Modalidad desconocida: ' + variante);
  process.exit(1);
}
setVariant(variante);
newGame();

const MS = Number(arg('ms', 12000));
const niveles = arg('nivel', Object.keys(PROB_NIVELES).join(','))
  .split(',').filter(n => PROB_NIVELES[n]);
const soloTipo = arg('tipo', null);

console.log('Modalidad ' + variante + ' · ' + (MS / 1000) + ' s por celda\\n');
console.log('nivel     tipo     problemas  prob/min  intentos/prob  ms/prob');

for (const nivel of niveles) {
  const tipos = soloTipo ? [soloTipo] : probTiposNivel(nivel);
  for (const tipo of tipos) {
    const t0 = Date.now();
    let n = 0, intentos = 0;
    while (Date.now() - t0 < MS) {
      const p = probGenera(nivel, [tipo], MS - (Date.now() - t0));
      if (!p) break;
      n++;
      intentos += p.intentos;
    }
    const min = (Date.now() - t0) / 60000;
    console.log(
      nivel.padEnd(10) + tipo.padEnd(9) +
      String(n).padStart(6) + '    ' +
      (n / min).toFixed(1).padStart(8) + '  ' +
      (n ? (intentos / n).toFixed(0) : '—').padStart(9) + '      ' +
      (n ? ((Date.now() - t0) / n).toFixed(0) : '—').padStart(5));
  }
  console.log('');
}
`);
