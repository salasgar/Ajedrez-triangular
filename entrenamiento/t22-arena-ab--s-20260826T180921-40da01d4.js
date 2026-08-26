#!/usr/bin/env node
// t22-arena-ab — arena A/B entre DOS configuraciones `rps` arbitrarias.
//
// arena-motor.js (tarea 17) fija siempre el asiento A al motor vigente; la
// tarea 22 necesita además comparar dos variantes del candidato ENTRE SÍ
// (acoso x10 contra x30, y el ganador contra el ganador+PROP_PESOS), porque
// contra un vigente aplastado al 14% los intervalos se solapan y el oponente
// común no separa nada. Este guion no toca arena-motor.js ni reimplementa la
// arena: lanza arena.js con CFG_A y CFG_B propios —el mismo contrato de
// variables de entorno que usa arena-motor— y el resumen lo hace
// `arena-motor.js --analiza=<log>`, así que el veredicto escrito y la
// aritmética de elo son exactamente los de siempre.
//
//   node entrenamiento/t22-arena-ab--<sid>.js \
//     --modalidad=rps-rey --nivel=4 --pares=100 --seed=42 --max-plies=800 \
//     --nombre-a=acoso10 --a='{"PROPORCIONAL":1,"PROP_ACOSO":10,"PROP_ACOSO_REY":10}' \
//     --nombre-b=acoso30 --b='{"PROPORCIONAL":1,"PROP_ACOSO":30,"PROP_ACOSO_REY":30}'
//
// OJO al signo, como siempre: elo(A−B) POSITIVO = gana A (el asiento --a).
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const args = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([a-z-]+)(?:=(.*))?$/s.exec(a);
  if (!m) { fatal('argumento no reconocido: ' + a); }
  args[m[1]] = m[2] === undefined ? '1' : m[2];
}
function fatal(msg) { process.stderr.write('t22-arena-ab: ' + msg + '\n'); process.exit(1); }
function opt(n, d) { return n in args ? args[n] : d; }

const MODALIDAD = opt('modalidad', 'rps-rey');
const NIVEL = Number(opt('nivel', 4));
const PARES = Number(opt('pares', 100));
const SEED = Number(opt('seed', 1));
const PROCESOS = Math.max(1, Math.min(2, Number(opt('procesos', 2))));
const MAX_PLIES = Number(opt('max-plies', 800));
const FIFTY = Number(opt('fifty', 80));
const OPENING_PLIES = Number(opt('aperturas', 6));
const RPS_A = JSON.parse(opt('a', '{}'));
const RPS_B = JSON.parse(opt('b', '{}'));
const NOMBRE_A = opt('nombre-a', 'A');
const NOMBRE_B = opt('nombre-b', 'B');
if (Number(opt('procesos', 2)) > 2) fatal('máximo 2 procesos node (autorización de la tarea 17)');

// El motor se lee de ai.js para validar claves y nivel con la verdad vigente
const motorSrc = ['geometry.js', 'variants.js', 'rules.js', 'ai.js']
  .map(f => fs.readFileSync(path.join(RAIZ, f), 'utf8')).join('\n');
const ctx = vm.createContext({ console, process });
const motor = vm.runInContext(motorSrc + '\n;({ VARIANTS, AI_LEVELS, RPS_DEFAULTS });', ctx);
if (!motor.VARIANTS[MODALIDAD]) fatal('modalidad desconocida: ' + MODALIDAD);
if (!motor.VARIANTS[MODALIDAD].captures) fatal(MODALIDAD + ' no tiene matriz de capturas');
const nivelCfg = motor.AI_LEVELS[NIVEL];
if (!nivelCfg) fatal('nivel desconocido: ' + NIVEL);
for (const [nombre, o] of [['--a', RPS_A], ['--b', RPS_B]]) {
  for (const k of Object.keys(o)) {
    if (!(k in motor.RPS_DEFAULTS)) fatal(nombre + ': clave desconocida ' + JSON.stringify(k));
  }
}
const CFG_A = Object.keys(RPS_A).length ? { ...nivelCfg, rps: { ...RPS_A } } : { ...nivelCfg };
const CFG_B = Object.keys(RPS_B).length ? { ...nivelCfg, rps: { ...RPS_B } } : { ...nivelCfg };

// la guardia del libro circular, como en arena-motor (pasarse no falla:
// repite aperturas en silencio e infla la significación)
const libro = path.join(__dirname, 'libro-' + MODALIDAD + '.json');
if (!fs.existsSync(libro)) fatal('no hay ' + path.basename(libro) + ': genera antes el libro');
{
  const n = JSON.parse(fs.readFileSync(libro, 'utf8')).length;
  const primero = Number(opt('primero', 1));
  if (primero + PARES - 1 > n) fatal('el libro tiene ' + n + ' aperturas y la tanda llega al par ' + (primero + PARES - 1));
}

const sello = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
const base = opt('salida', path.join(__dirname,
  `motor-${MODALIDAD}-${NOMBRE_A}-vs-${NOMBRE_B}-n${NIVEL}-${sello}.log`));

const partes = [], reparto = [];
let siguiente = Number(opt('primero', 1));
for (let i = 0; i < PROCESOS; i++) {
  const n = Math.floor(PARES / PROCESOS) + (i < PARES % PROCESOS ? 1 : 0);
  if (n === 0) continue;
  const parte = PROCESOS === 1 ? base : base.replace(/\.log$/, '') + '.p' + (i + 1) + '.log';
  partes.push(parte);
  reparto.push({ FIRST: siguiente, PAIRS: n, SEED: SEED + i, SALIDA: parte });
  siguiente += n;
}

console.log(`t22-arena-ab · ${MODALIDAD} · nivel ${NIVEL} · ${PARES} pares (${PARES * 2} partidas)`);
console.log(`  A = ${NOMBRE_A.padEnd(16)} ${JSON.stringify(CFG_A.rps || 'RPS_DEFAULTS')}`);
console.log(`  B = ${NOMBRE_B.padEnd(16)} ${JSON.stringify(CFG_B.rps || 'RPS_DEFAULTS')}`);
console.log(`  ${reparto.length} proceso(s), semillas ${reparto.map(r => r.SEED).join('/')}`);

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
      NAME_A: NOMBRE_A, NAME_B: NOMBRE_B,
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  hijo.on('error', rej);
  hijo.on('exit', c => c === 0 ? res() : rej(new Error('arena.js salió con ' + c)));
}))).then(() => {
  const segundos = ((Date.now() - t0) / 60000).toFixed(1);
  if (partes.length > 1) {
    fs.writeFileSync(base, partes.map(p => fs.readFileSync(p, 'utf8')).join('\n'));
    console.log('partes unidas en ' + base);
  }
  console.log(`hecho en ${segundos} min · resumen: node entrenamiento/arena-motor.js --analiza=${base}`);
}).catch(e => fatal(e.message));
