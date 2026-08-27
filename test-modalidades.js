// test-modalidades.js — Que todas las modalidades sigan arrancando.
//
//   node test-modalidades.js
//
// POR QUE EXISTE. Las modalidades se reparten entre tres ficheros que no se
// conocen: variants.js trae las clásicas y las de Piedra, papel y tijera, y
// tessellations.js añade las demos de otras teselaciones registrándose en el
// mismo VARIANTS. Al mezclar ramas que tocan los tres, lo que se rompe no es
// una regla concreta sino una modalidad entera: deja de arrancar, o se cuela
// en el selector una demo que no debía salir. test-rps.js y test-ia-rps.js
// miran las reglas y la IA de las nuevas; esto mira que estén todas y que
// todas se puedan empezar a jugar.
//
// SIN DEPENDENCIAS, como el resto: se cargan las mismas fuentes que carga
// index.html, en el mismo orden, dentro de un contexto de vm.
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// tessellations.js se engancha al DOM nada más cargarse, para leer el
// ?modalidad= de la URL. Un document de mentira basta: lo que interesa es que
// la fuente termine de evaluarse con las demos ya registradas.
const ctx = vm.createContext({
  console,
  window: {},
  document: { addEventListener() {} },
  location: { search: '' },
});
for (const f of ['geometry.js', 'variants.js', 'tessellations.js', 'rules.js', 'ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), ctx, { filename: f });
}
const run = code => vm.runInContext('(function () {' + code + '}())', ctx);

let fallos = 0;
function ok(cond, msg) {
  if (cond) { console.log('  ✓ ' + msg); }
  else { console.error('  ✗ ' + msg); fallos++; }
}

// Las que tienen que estar, y cuáles de ellas salen en el selector. Van con
// `hidden`, y por tanto fuera del desplegable de modalidad, las demos de
// teselación (se abren con ?modalidad=<id>) y las combinaciones PPT × tablero,
// que se eligen con el selector de tablero (ver tessellations.js y
// test-teselaciones.js, que las mira una por una).
const EN_SELECTOR = ['salas', 'salas-v4', 'salas-1998', 'dekle', 'trigonal',
  'rps-rey', 'rpsls-rey', 'rps-rey-muralla', 'rpsls-rey-muralla'];
const OCULTAS = ['demo-cuadrado', 'demo-hexagonal', 'demo-ladrillos'];

const todas = run('return Object.keys(VARIANTS);');
const selector = run('return variantList().map(v => v.id);');

console.log(`Registradas ${todas.length}, en el selector ${selector.length}:`);
for (const id of EN_SELECTOR.concat(OCULTAS)) ok(todas.includes(id), `registrada: ${id}`);
for (const id of OCULTAS) ok(!selector.includes(id), `fuera del selector: ${id}`);
for (const id of EN_SELECTOR) ok(selector.includes(id), `en el selector: ${id}`);
ok(selector.length === EN_SELECTOR.length,
  `el selector trae ${EN_SELECTOR.length} modalidades (trae ${selector.length})`);

// El desplegable va por epígrafes: cada modalidad visible declara su `grupo`.
const grupos = run('return variantList().map(v => v.grupo);');
ok(grupos.every(g => g && g !== 'Otras'),
  'todas las del selector declaran su grupo (ninguna cae en «Otras»)');
ok(new Set(grupos).size === 2,
  `los epígrafes del desplegable son dos (son ${new Set(grupos).size}: ${[...new Set(grupos)].join(', ')})`);

console.log('Cada modalidad arranca y tiene jugadas desde la inicial:');
for (const id of todas) {
  let r;
  try {
    r = run(`
      setVariant(${JSON.stringify(id)});
      newGame();
      let jugadas = 0;
      for (const [k, p] of game.board) {
        if (p.color === game.turn) jugadas += legalMoves(game.board, k, p).length;
      }
      return { casillas: CELLS.length, piezas: game.board.size, jugadas };
    `);
  } catch (e) {
    ok(false, `${id} arranca (lanza: ${e.message})`);
    continue;
  }
  ok(r.piezas > 0 && r.jugadas > 0,
    `${id}: ${r.casillas} casillas, ${r.piezas} piezas, ${r.jugadas} jugadas`);
}

if (fallos) { console.error(`\n${fallos} fallos.`); process.exit(1); }
console.log('\nTodas las pruebas pasan.');
