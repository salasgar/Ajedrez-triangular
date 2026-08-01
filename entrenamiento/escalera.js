// escalera.js — ¿Sube la escalera de niveles a pasos parejos?
//
//   node escalera.js <dir> <fichero...>       (en orden de nivel creciente)
//   node escalera.js ~/…/r13 n23.log n34.log n45.log n56.log
//   MARGEN=500 node escalera.js …             para comprobar la robustez
//
// Cada fichero es un match entre un nivel (A) y el siguiente (B). La
// herramienta encadena los escalones, da el elo acumulado y —lo importante—
// dice de cada escalón si es JUGABLE, IMPERCEPTIBLE o INSALVABLE.
//
// LOS UMBRALES NO SON DE GUSTO, salen de traducir el elo a partidas ganadas,
// que es lo que nota quien juega:
//
//    +50 elo -> gana 57 de cada 100      +200 -> 76 de 100
//   +100 elo -> gana 64 de cada 100      +400 -> 91 de 100
//
// - Por debajo de 50 el escalón es IMPERCEPTIBLE: subir de nivel no se nota,
//   son dos rivales que parecen el mismo y uno de los dos sobra.
// - Por encima de 400 es INSALVABLE: ganas menos de 1 de cada 10 partidas, y
//   el jugador que llega ahí se queda atascado sin poder progresar.
// - En medio está la zona jugable; lo cómodo son 100-250, que se nota al
//   cambiar de nivel pero se puede remontar con práctica.
//
// UNA ADVERTENCIA sobre encadenar: el elo acumulado supone que la escala es
// transitiva, y no tiene por qué serlo del todo (un estilo puede irle mejor a
// un rival que a otro, y las tasas de tablas cambian con la fuerza). Para
// comprobarlo hace falta medir además un par NO contiguo —el 2 contra el 5,
// por ejemplo— y ver si cuadra con la suma de sus escalones. Si no cuadra, la
// escalera no es una sola escala y los números acumulados son orientativos.
'use strict';
const fs = require('fs');
const path = require('path');
const { puntosDe, resumen, esperado, leerJuegos } = require('./elo.js');

const MARGEN = Number(process.env.MARGEN || 300);
const dir = process.argv[2];
const ficheros = process.argv.slice(3);
if (!dir || !ficheros.length) {
  console.error('uso: node escalera.js <dir> <fichero...>   (nivel creciente)');
  process.exit(2);
}

const IMPERCEPTIBLE = 50;
const INSALVABLE = 400;

console.log(`escalera (margen de adjudicacion ${MARGEN} cp)\n`);
console.log('escalon              partidas      elo   IC 95%            gana de 100   veredicto');

let acumulado = 0;
const acum = [];
let avisos = 0;
for (const f of ficheros) {
  const ruta = path.join(dir, f);
  if (!fs.existsSync(ruta)) { console.log(`${f}: sin datos`); continue; }
  const juegos = leerJuegos(fs.readFileSync(ruta, 'utf8'));
  const r = resumen(puntosDe(juegos, MARGEN));
  if (!r) { console.log(`${f}: sin partidas`); continue; }

  // El match es A(nivel n) contra B(nivel n+1), asi que el escalon —lo que
  // el nivel de arriba le saca al de abajo— es el elo cambiado de signo.
  const salto = -r.elo;
  const anchoIC = Math.abs(r.hi - r.lo);
  let veredicto;
  if (!isFinite(salto)) veredicto = 'INSALVABLE (sin apenas victorias)';
  else if (salto < IMPERCEPTIBLE) veredicto = 'IMPERCEPTIBLE';
  else if (salto > INSALVABLE) veredicto = 'INSALVABLE';
  else veredicto = 'jugable';
  if (veredicto !== 'jugable') avisos++;
  // un escalon medido con un intervalo mas ancho que el propio escalon no
  // esta medido: se avisa aparte para no confundirlo con un veredicto
  const flojo = isFinite(anchoIC) && anchoIC > Math.abs(salto) ? '  (pocas partidas)' : '';

  acumulado += isFinite(salto) ? salto : 0;
  acum.push({ f, salto, acumulado });
  const ic = isFinite(r.lo) && isFinite(r.hi)
    ? `[${(-r.hi).toFixed(0)}, ${(-r.lo).toFixed(0)}]` : '[muy ancho]';
  const pct = isFinite(salto) ? (100 * esperado(salto)).toFixed(0) : '>99';
  console.log(
    f.replace(/\.log$/, '').padEnd(18) +
    String(r.n).padStart(9) + '  ' +
    (isFinite(salto) ? salto.toFixed(0) : '  ∞').padStart(7) + '   ' +
    ic.padEnd(18) +
    (pct + ' de 100').padStart(11) + '   ' +
    veredicto + flojo);
}

console.log('\nelo acumulado desde el nivel mas bajo medido:');
let previo = 0;
console.log('  base                    0');
for (const a of acum) {
  console.log('  tras ' + a.f.replace(/\.log$/, '').padEnd(18) + String(Math.round(a.acumulado)).padStart(5));
  previo = a.acumulado;
}

if (acum.length > 1) {
  const saltos = acum.map(a => a.salto).filter(isFinite);
  if (saltos.length > 1) {
    const min = Math.min(...saltos), max = Math.max(...saltos);
    console.log(`\nescalon mas corto ${min.toFixed(0)} elo, mas largo ${max.toFixed(0)} elo` +
      `  ->  el largo es ${(max / min).toFixed(1)} veces el corto`);
    console.log('(una escalera pareja tiene ese cociente cerca de 1)');
  }
}
console.log(avisos ? `\n${avisos} escalon(es) fuera de la zona jugable.` : '\nTodos los escalones en la zona jugable.');
