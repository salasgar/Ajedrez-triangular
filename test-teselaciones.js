// test-teselaciones.js — Que los tableros teselados sean tableros de verdad y
// que las modalidades PPT se puedan jugar en todos ellos.
//
//   node test-teselaciones.js
//
// POR QUÉ EXISTE. Una teselación se define con geometría de coma flotante:
// polígonos que deben encajar al milímetro para que dos casillas se
// reconozcan como vecinas (construirTeselacion compara vértices redondeados a
// centésimas de px). Un error de medio píxel no rompe nada visible —el tablero
// se dibuja igual— pero deja casillas sin vecinas, o vecindades que van en un
// sentido y no en el otro, y eso solo se descubre jugando. Aquí se comprueba
// de una vez y para todos los tableros.
//
// Lo que se exige a un tablero:
//   · ninguna casilla suelta, y la vecindad simétrica (si A es vecina de B,
//     B lo es de A);
//   · ningún par de casillas con el mismo centro (polígonos duplicados o
//     solapados);
//   · SIMETRÍA ARRIBA-ABAJO: la fila del borde de abajo y la de arriba con el
//     mismo número de casillas, y lo mismo para las segundas filas. Sin eso un
//     bando empezaría con más piezas que el otro (ver recorteSimetrico).
//
// Y a las modalidades PPT sobre ellos: que arranquen, que los dos bandos
// tengan lo mismo, que haya dos reyes y que la IA sepa jugar.
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ctx = vm.createContext({
  console, window: {}, document: { addEventListener() {} }, location: { search: '' },
});
for (const f of ['geometry.js', 'variants.js', 'tessellations.js', 'rules.js', 'ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), ctx, { filename: f });
}
const run = code => vm.runInContext('(function () {' + code + '}())', ctx);

let fallos = 0;
function ok(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { console.error('  ✗ ' + msg); fallos++; }
}

// --- los tableros ----------------------------------------------------------

const TABLEROS = run('return Object.keys(BOARDS).filter(id => BOARDS[id].teselacion);');

console.log(`Geometría de los ${TABLEROS.length} tableros teselados:`);
for (const id of TABLEROS) {
  const r = run(`
    setGeometry('${id}');
    const filas = {};
    for (const c of CELLS) filas[c.b] = (filas[c.b] || 0) + 1;
    const bs = Object.keys(filas).map(Number).sort((x, y) => x - y);
    let sueltas = 0, asimetricas = 0;
    const centros = new Set();
    for (const c of CELLS) {
      if (c.kingNbrs.length === 0) sueltas++;
      for (const n of c.kingNbrs) if (!n.kingNbrs.includes(c)) asimetricas++;
      centros.add(Math.round(c.cx * 10) + ':' + Math.round(c.cy * 10));
      // las vecinas por arista tienen que serlo también «de rey»
      for (const n of c.edgeNbrs) if (!c.kingNbrs.includes(n)) asimetricas++;
    }
    return {
      casillas: CELLS.length, filas: bs.length, sueltas, asimetricas,
      centros: centros.size,
      borde: [filas[bs[0]], filas[bs[bs.length - 1]]],
      segundas: [filas[bs[1]], filas[bs[bs.length - 2]]],
    };
  `);
  ok(r.sueltas === 0, `${id}: ninguna casilla sin vecinas (${r.casillas} casillas, ${r.filas} filas)`);
  ok(r.asimetricas === 0, `${id}: vecindad simétrica y edgeNbrs ⊆ kingNbrs`);
  ok(r.centros === r.casillas, `${id}: ninguna casilla duplicada`);
  ok(r.borde[0] === r.borde[1], `${id}: las filas del borde miden igual (${r.borde.join(' y ')})`);
  ok(r.segundas[0] === r.segundas[1], `${id}: las segundas filas miden igual (${r.segundas.join(' y ')})`);
}

// --- las modalidades PPT sobre cada tablero --------------------------------

const PPT = run('return Object.keys(VARIANTS).filter(id => VARIANTS[id].familia);');
console.log(`\nLas ${PPT.length} modalidades de Piedra, papel y tijera (familia × tablero):`);

const familias = run('return Object.keys(PPT_FAMILIAS);');
for (const fam of familias) {
  const hermanas = run(`return tablerosDeFamilia('${fam}');`);
  const visibles = run(`return tablerosDeFamilia('${fam}').filter(h => !VARIANTS[h.id].hidden).length;`);
  ok(hermanas.length === run('return PPT_TABLEROS.length;') + 1,
    `${fam}: un tablero triangular + ${run('return PPT_TABLEROS.length;')} teselados (${hermanas.length})`);
  ok(visibles === 1, `${fam}: exactamente una hermana sale en el desplegable de modalidad`);
  ok(hermanas[0].grupo === 'triangular', `${fam}: el hexágono triangular va primero en el selector de tablero`);
}

let malas = 0;
for (const id of PPT) {
  const r = run(`
    setVariant('${id}'); newGame();
    const t = {};
    for (const [, p] of game.board) t[p.color + p.type] = (t[p.color + p.type] || 0) + 1;
    let jw = 0, jb = 0;
    for (const [k, p] of game.board) {
      const n = legalMoves(game.board, k, p).length;
      if (p.color === 'w') jw += n; else jb += n;
    }
    const wt = Object.keys(t).filter(k => k[0] === 'w');
    return {
      piezas: game.board.size, status: game.status, jw, jb,
      reyes: (t.wK || 0) + (t.bK || 0),
      espejo: wt.every(k => t[k] === t['b' + k.slice(1)]),
      papeles: (t.wA || 0),
      muralla: VARIANTS['${id}'].id.includes('muralla'),
      frente: V.frontLayout.join(''),
    };
  `);
  const bien = r.reyes === 2 && r.espejo && r.jw > 0 && r.jb > 0 && r.status === 'playing' &&
    (!r.muralla || /^A+$/.test(r.frente));
  if (!bien) { malas++; console.error('  ✗ ' + id + ': ' + JSON.stringify(r)); }
}
ok(malas === 0, `las ${PPT.length} arrancan: dos reyes, bandos en espejo, jugadas para ambos ` +
  `y muralla = fila entera de papeles`);

// --- la IA juega en un tablero que no es el suyo ---------------------------

console.log('\nLa IA sobre teselaciones (12 medias jugadas, nivel 4):');
for (const id of ['pptr-muralla-square8', 'pptr-rhomb3', 'pptlsr-octo6', 'pptr-muralla-kagome3']) {
  const r = run(`
    setVariant('${id}'); newGame();
    let n = 0;
    for (let i = 0; i < 12 && !gameEnded(); i++) {
      const mv = chooseAiMove(4);
      if (!mv) break;
      makeMove(mv.from, mv.to);
      n++;
    }
    return { n, status: game.status };
  `);
  ok(r.n === 12 || r.status !== 'playing', `${id}: la IA juega sin tropezar (${r.n} medias jugadas)`);
}

console.log(fallos ? `\n${fallos} fallos.` : '\nTodas las pruebas pasan.');
process.exit(fallos ? 1 : 0);
