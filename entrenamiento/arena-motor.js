// arena-motor.js — Arena A/B para los PESOS DE EVALUACIÓN de las modalidades
// Piedra, papel y tijera (RPS_CFG en ai.js), con veredicto en castellano.
//
//   node arena-motor.js --modalidad=rps-rey --pares=8            # humo (A vs A)
//   node arena-motor.js --modalidad=rps-rey --pares=50 \
//     --nombre=amenaza-original --cand='{"AMENAZA":0.2,"AMENAZA_COLGADA":0.6}'
//   node arena-motor.js --analiza=motor-rps-rey-....log          # resumir un log
//
// QUÉ AÑADE SOBRE arena.js, Y QUÉ NO. No reimplementa la arena: la LANZA.
// arena.js ya sabe emparejar aperturas con los colores intercambiados,
// adjudicar por material en el análisis y reanudarse tras un corte, y elo.js
// ya tiene la aritmética de elo/intervalo/p que usaron las tareas 03 y 10.
// Repetir todo eso aquí sería tener dos arenas que se van separando. Lo que
// pone este guion es lo que faltaba:
//
//  1. LOS PESOS DE EVALUACIÓN COMO RAMA. arena.js compara configuraciones en
//     el formato de AI_LEVELS (profundidad, movilidad, valores de pieza…),
//     pero los pesos de las modalidades PPT no vivían ahí: eran constantes de
//     ai.js. Ahora son `cfg.rps` (tarea 17), así que basta con meterlos en
//     CFG_B. A = el motor vigente, tal cual; B = el vigente MÁS las
//     sobrescrituras de --cand, y nada más: una sola cosa cambia por tanda.
//  2. EL VEREDICTO ESCRITO. `elo(A-B)` POSITIVO significa que gana A, o sea
//     que el CANDIDATO PIERDE. Ese signo ya costó un bug real (el de trigonal,
//     c388624c), así que aquí no hay que interpretarlo: el resumen dice «el
//     candidato GANA / PIERDE / EMPATA» con todas las letras.
//  3. PARTIDAS POR HORA MEDIDAS, no estimadas. quiesce() y probSaldoQuieto
//     tienen coste fuera del tope de nodos, así que el coste por partida varía
//     mucho entre posiciones. Las tareas 18-20 dimensionan sus tandas con este
//     dato, y estimarlo saldría mal.
//  4. LAS TRAMPAS, CERRADAS. Modalidad sin matriz de capturas = los pesos no
//     harían nada y la tanda mediría un elo 0 perfectamente creíble: se aborta.
//     Clave mal escrita en --cand: aborta ai.js (ver rpsAplicaCfg). Libro de
//     aperturas que falta: se genera, en vez de dejar la tanda a medias.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const vm = require('vm');
const { puntosDe, resumen, leerJuegos } = require('./elo.js');

const RAIZ = path.join(__dirname, '..');

// ---------------------------------------------------------------- argumentos
const args = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([a-z-]+)(?:=(.*))?$/s.exec(a);
  if (!m) { fatal('argumento no reconocido: ' + a); }
  args[m[1]] = m[2] === undefined ? '1' : m[2];
}
function fatal(msg) { process.stderr.write('arena-motor: ' + msg + '\n'); process.exit(1); }
function opt(nombre, pordefecto) { return nombre in args ? args[nombre] : pordefecto; }

const MARGEN = Number(opt('margen', 300));

// Modo «solo resumir»: rehacer el marcador de un log ya jugado, por ejemplo
// para ver si la conclusión aguanta con otro margen de adjudicación.
if (args['analiza']) {
  const texto = fs.readFileSync(args['analiza'], 'utf8');
  imprimeResumen(leerJuegos(texto), cabecerasDe(texto), null);
  process.exit(0);
}

const MODALIDAD = opt('modalidad', 'rps-rey');
const NIVEL = Number(opt('nivel', 4));
const PARES = Number(opt('pares', 25));
const SEED = Number(opt('seed', 1));
const PROCESOS = Math.max(1, Math.min(2, Number(opt('procesos', 2))));
const MAX_PLIES = Number(opt('max-plies', 400));
const FIFTY = Number(opt('fifty', 80));
const OPENING_PLIES = Number(opt('aperturas', 6));
const CAND = JSON.parse(opt('cand', '{}'));
const NOMBRE_B = opt('nombre', Object.keys(CAND).length ? 'candidato' : 'A-igual');

// El tope de 2 procesos no es una preferencia: es la autorización de máquina
// que dio Juan Luis para esta cadena de tareas (ficha de la 17).
if (Number(opt('procesos', 2)) > 2) fatal('máximo 2 procesos node simultáneos (autorización de la tarea 17)');
if (!Number.isFinite(PARES) || PARES < 1) fatal('--pares debe ser un entero positivo');

// ------------------------------------------------- el motor, para consultarlo
// Se carga una copia del motor en un contexto aparte para leer AI_LEVELS y la
// modalidad. Leerlo del propio ai.js, en vez de copiar aquí los niveles, evita
// que este guion mida con una definición de nivel que dejó de ser la de verdad.
const motorSrc = ['geometry.js', 'variants.js', 'rules.js', 'ai.js']
  .map(f => fs.readFileSync(path.join(RAIZ, f), 'utf8')).join('\n');
const ctx = vm.createContext({ console, process });
// OJO: `const`/`let` de nivel superior NO se asoman al objeto de contexto (son
// del ámbito del script, no globales). Por eso el motor termina en una
// expresión que devuelve lo que hace falta, en vez de leerlo de `ctx`.
const motor = vm.runInContext(motorSrc + '\n;({ VARIANTS, AI_LEVELS, RPS_DEFAULTS });', ctx);

const variante = motor.VARIANTS[MODALIDAD];
if (!variante) {
  fatal('modalidad desconocida: ' + MODALIDAD + '. Hay: ' + Object.keys(motor.VARIANTS).join(', '));
}
// Sin matriz de capturas no hay evaluación dinámica y RPS_CFG no se consulta
// jamás: la tanda no fallaría, mediría un elo 0 impecable de dos motores
// idénticos. Es justo el modo de error que este proyecto ya ha pagado dos
// veces (el libro de la modalidad equivocada, la firma de la tabla), así que
// aquí se para en seco.
if (!variante.captures) {
  fatal(MODALIDAD + ' no tiene matriz de capturas: los pesos de RPS_CFG no se' +
    ' usan ahí y la tanda mediría dos motores idénticos. Modalidades válidas: ' +
    Object.keys(motor.VARIANTS).filter(k => motor.VARIANTS[k].captures).join(', '));
}
if (variante.kingless) {
  process.stderr.write('AVISO: ' + MODALIDAD + ' es una modalidad SIN REY, y Juan Luis' +
    ' las dejó aparcadas el 2026-08-26. La cadena 17-20 mide rps-rey y rpsls-rey.\n');
}
const nivelCfg = motor.AI_LEVELS[NIVEL];
if (!nivelCfg) fatal('nivel desconocido: ' + NIVEL + '. Hay: ' + Object.keys(motor.AI_LEVELS).join(', '));

// Las claves de --cand se validan aquí Y en ai.js (rpsAplicaCfg). Aquí para
// que el error salga antes de jugar nada; allí porque es donde de verdad
// importa, y porque el worker del navegador no pasa por este guion.
for (const k of Object.keys(CAND)) {
  if (!(k in motor.RPS_DEFAULTS)) {
    fatal('--cand: clave desconocida ' + JSON.stringify(k) +
      '. Hay: ' + Object.keys(motor.RPS_DEFAULTS).join(', '));
  }
}

const CFG_A = { ...nivelCfg };
const CFG_B = Object.keys(CAND).length ? { ...nivelCfg, rps: { ...CAND } } : { ...nivelCfg };

// ------------------------------------------------------- libro de aperturas
// El libro es POR MODALIDAD (ver aperturas.js). Si no está, se genera: dejar
// que arena.js aborte a mitad de una cadena de tareas es peor que tardar un
// minuto en construirlo.
const libro = path.join(__dirname, 'libro-' + MODALIDAD + '.json');
if (!fs.existsSync(libro)) {
  process.stderr.write('no hay ' + path.basename(libro) + ': generándolo...\n');
  const json = execFileSync(process.execPath, [path.join(__dirname, 'aperturas.js')],
    { env: { ...process.env, MODALIDAD }, maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(libro, json);
  process.stderr.write('libro generado: ' + libro + '\n');
}

// ------------------------------------------------------------------- salida
const sello = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
const base = opt('salida', path.join(__dirname,
  `motor-${MODALIDAD}-${NOMBRE_B}-n${NIVEL}-${sello}.log`));

// Un fichero por proceso y luego se concatenan: dos procesos escribiendo en el
// mismo descriptor pueden entrelazar líneas, y una línea JSON partida por la
// mitad se pierde entera. Además cada parte se reanuda por su cuenta.
const partes = [];
const reparto = [];
// --primero: por qué par del libro empieza esta tanda. Sirve para AMPLIAR una
// comparación ya jugada sin repetir aperturas: la segunda tanda arranca donde
// acabó la primera, y los dos logs se pueden juntar (`cat a b > c` y
// `--analiza=c`) sin que las mismas posiciones cuenten dos veces. Repetir
// apertura con otra semilla también da partidas distintas, pero las medidas
// dejan de ser independientes y el intervalo de confianza sale más estrecho de
// lo que le corresponde.
let siguiente = Number(opt('primero', 1));
if (!Number.isInteger(siguiente) || siguiente < 1) fatal('--primero debe ser un entero >= 1');

// El libro se recorre en círculo (`(par-1) % libro.length` en arena.js): pasarse
// del final no falla, REPITE aperturas en silencio, que es justo lo que --primero
// existe para evitar. Así que aquí se para.
{
  const n = JSON.parse(fs.readFileSync(libro, 'utf8')).length;
  const ultimo = siguiente + PARES - 1;
  if (ultimo > n) {
    fatal(`el libro de ${MODALIDAD} tiene ${n} aperturas y esta tanda llega al par ` +
      `${ultimo}: se repetirían aperturas. Baja --pares, o regenera el libro con ` +
      `MODALIDAD=${MODALIDAD} node entrenamiento/aperturas.js > ${path.basename(libro)}`);
  }
}
for (let i = 0; i < PROCESOS; i++) {
  const n = Math.floor(PARES / PROCESOS) + (i < PARES % PROCESOS ? 1 : 0);
  if (n === 0) continue;
  const parte = PROCESOS === 1 ? base : base.replace(/\.log$/, '') + '.p' + (i + 1) + '.log';
  partes.push(parte);
  reparto.push({ FIRST: siguiente, PAIRS: n, SEED: SEED + i, SALIDA: parte });
  siguiente += n;
}

console.log(`arena-motor · ${MODALIDAD} · nivel ${NIVEL} · ${PARES} pares (${PARES * 2} partidas)`);
console.log(`  A = vigente        ${JSON.stringify(CFG_A.rps || 'RPS_DEFAULTS')}`);
console.log(`  B = ${NOMBRE_B.padEnd(16)} ${JSON.stringify(CFG_B.rps || 'RPS_DEFAULTS (misma rama: tanda de humo)')}`);
console.log(`  ${reparto.length} proceso(s), semillas ${reparto.map(r => r.SEED).join('/')}`);
console.log('');

const t0 = Date.now();
Promise.all(reparto.map(r => new Promise((res, rej) => {
  const hijo = spawn(process.execPath, [path.join(__dirname, 'arena.js')], {
    env: {
      ...process.env,
      MODALIDAD, MAX_PLIES: String(MAX_PLIES), FIFTY: String(FIFTY),
      OPENING_PLIES: String(OPENING_PLIES),
      FIRST: String(r.FIRST), PAIRS: String(r.PAIRS), SEED: String(r.SEED),
      SALIDA: r.SALIDA,
      CFG_A: JSON.stringify(CFG_A), CFG_B: JSON.stringify(CFG_B),
      NAME_A: 'vigente', NAME_B: NOMBRE_B,
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  hijo.on('error', rej);
  hijo.on('exit', c => c === 0 ? res() : rej(new Error('arena.js salió con ' + c)));
}))).then(() => {
  const segundos = (Date.now() - t0) / 1000;
  const texto = partes.map(p => fs.readFileSync(p, 'utf8')).join('\n');
  if (partes.length > 1) {
    fs.writeFileSync(base, texto);
    console.log('\npartes unidas en ' + base);
  }
  imprimeResumen(leerJuegos(texto), cabecerasDe(texto), segundos);
}).catch(e => fatal(e.message));

// ------------------------------------------------------------------ resumen
function cabecerasDe(texto) {
  return [...new Set(texto.split('\n').filter(l => l.startsWith('#')))];
}

function imprimeResumen(juegos, cabeceras, segundos) {
  if (!juegos.length) { console.log('sin partidas'); return; }
  for (const c of cabeceras.slice(0, 1)) {
    try {
      const m = JSON.parse(c.slice(1));
      console.log(`\nmodalidad ${m.modalidad} · tope ${m.MAX_PLIES} jugadas · regla de 50 acortada a ${m.FIFTY}`);
      console.log(`A = ${m.A.nombre} · rps = ${JSON.stringify(m.A.cfg.rps || 'por defecto')}`);
      console.log(`B = ${m.B.nombre} · rps = ${JSON.stringify(m.B.cfg.rps || 'por defecto')}`);
    } catch { /* cabecera de otra versión */ }
  }

  const r = resumen(puntosDe(juegos, MARGEN));
  const res = {};
  for (const j of juegos) res[j.res] = (res[j.res] || 0) + 1;
  const sinAdjudicar = juegos.filter(j => j.ptsW === null && Math.abs(j.balW) < MARGEN).length;

  console.log(`\n${r.n} partidas · finales: ` +
    Object.entries(res).map(([k, v]) => `${k} ${v}`).join(', ') +
    ` · ${sinAdjudicar} cortadas dentro del margen ${MARGEN} (tablas)`);
  console.log(`A (vigente): ${r.ganadas} ganadas, ${r.tablas} tablas, ${r.perdidas} perdidas` +
    ` · puntuación ${(r.score * 100).toFixed(1)}%`);

  const fmt = x => (Number.isFinite(x) ? (x >= 0 ? '+' : '') + x.toFixed(0) : (x > 0 ? '+∞' : '−∞'));
  console.log(`elo(A−B) = ${fmt(r.elo)}  [${fmt(r.lo)}, ${fmt(r.hi)}]  p = ${r.p.toFixed(3)}`);

  // El veredicto, escrito. elo(A−B) POSITIVO = gana A = el candidato PIERDE.
  const mismaRama = juegos.length && cabeceras.some(c => {
    try { const m = JSON.parse(c.slice(1)); return JSON.stringify(m.A.cfg) === JSON.stringify(m.B.cfg); }
    catch { return false; }
  });
  if (mismaRama) {
    // Un p ≥ 0.05 no basta: con varianza cero (todas las partidas iguales) el
    // p-valor sale 1 y colaría un sesgo de asiento perfecto como «limpio». Solo
    // el caso de todas tablas (score 0.5) es varianza cero y sano.
    const limpio = r.p >= 0.05 && (r.se > 0 || r.score === 0.5);
    console.log(`\nTANDA DE HUMO (las dos ramas son idénticas): el arnés ` +
      (limpio ? 'NO favorece a ningún asiento — el intervalo incluye el 0, como debe.'
              : '¡FAVORECE A UN ASIENTO! p < 0.05 con configuraciones iguales: algo está mal.'));
  } else if (r.se === 0) {
    // Varianza nula: todas las partidas dieron el MISMO resultado. elo.js
    // calcula la barra de error a partir de la varianza de la muestra, así que
    // aquí devuelve se = 0, z = 0 y p = 1 — y un p de 1 se lee como «empate»,
    // que es justo lo contrario de lo que ha pasado. Sin este caso aparte, un
    // barrido 4-0 se anunciaría como «el candidato EMPATA».
    const quien = r.score > 0.5 ? 'PIERDE' : r.score < 0.5 ? 'GANA' : 'EMPATA';
    console.log(`\nVEREDICTO: el candidato ${quien} las ${r.n} partidas` +
      (quien === 'EMPATA' ? ' (todas tablas).' : ', sin una sola excepción.'));
    console.log(`  Pero la varianza de la muestra es CERO, y de ahí no sale ni` +
      ` intervalo ni p-valor: el resultado de arriba (elo ±∞, p = 1) no significa nada.` +
      ` Juega más partidas antes de concluir.`);
  } else if (r.p >= 0.05) {
    console.log(`\nVEREDICTO: el candidato EMPATA (diferencia no significativa, p ≥ 0.05).`);
  } else if (r.elo > 0) {
    console.log(`\nVEREDICTO: el candidato PIERDE por ${fmt(r.elo).replace('+', '')} elo (p < 0.05).`);
  } else {
    console.log(`\nVEREDICTO: el candidato GANA por ${(-r.elo).toFixed(0)} elo (p < 0.05).`);
  }

  const secsJugados = juegos.reduce((a, j) => a + (j.secs || 0), 0);
  if (segundos !== null) {
    console.log(`\ncoste: ${(segundos / 60).toFixed(1)} min de reloj para ${r.n} partidas` +
      ` = ${(r.n / (segundos / 3600)).toFixed(0)} partidas/hora con ${PROCESOS} proceso(s)` +
      ` · ${(secsJugados / r.n).toFixed(1)} s por partida de media`);
  } else {
    console.log(`\ncoste registrado: ${(secsJugados / r.n).toFixed(1)} s por partida de media` +
      ` (${(3600 / (secsJugados / r.n)).toFixed(0)} partidas/hora por proceso)`);
  }
}
