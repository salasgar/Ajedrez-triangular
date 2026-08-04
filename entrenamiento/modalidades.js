// modalidades.js — Comprueba que todas las modalidades son correctas (seis en total).
//
// Herramienta de desarrollo, se ejecuta a mano: `node entrenamiento/modalidades.js`.
//
// No hay dorados que mantener: todo se comprueba POR DIFERENCIA contra la
// implementación lenta y evidente, que es la que se da por buena.
//
//   · genMoves (que se ahorra la comprobación de legalidad detectando las
//     clavadas) contra movesForSide (que copia el tablero y prueba jugada a
//     jugada).
//   · isAttackedFast (que mira desde la casilla hacia fuera con las tablas
//     precalculadas) contra isAttacked (que recorre todas las piezas rivales
//     generando sus ataques).
//
// La segunda es la que de verdad hace falta en Dekle, donde el tipo de pieza
// que ataca por un rayo cambia con la distancia (ver buildAttackTables en
// variants.js). Se comparan TODAS las casillas del tablero en posiciones de
// partidas aleatorias, no solo la del rey.
//
// Ojo con el dominio: las dos funciones solo son equivalentes cuando la
// casilla consultada NO está ocupada por una pieza del bando que ataca. Fuera
// de ahí, la genérica arrastra rarezas heredadas (un peón "ataca" casillas
// ocupadas por los suyos, un caballo no) que isAttackedFast no replica a
// propósito. Ese es justo su dominio de uso: siempre se pregunta por el rey
// del otro color.
'use strict';
const fs = require('fs'), path = require('path');
const REPO = path.join(__dirname, '..');
const src = ['geometry.js', 'variants.js', 'rules.js', 'ai.js']
  .map(f => fs.readFileSync(path.join(REPO, f), 'utf8')).join('\n');

const PARTIDAS = Number(process.argv.find(a => a.startsWith('--partidas='))
  ?.slice('--partidas='.length) || 8);
const JUGADAS = 60;

let fallos = 0;
const comprueba = (n, ok) => {
  console.log((ok ? '  ok    ' : '  FALLA ') + n);
  if (!ok) fallos++;
};

eval(src + `
// generador sembrado: la tanda es reproducible
let _s = 20260802 >>> 0;
const rnd = () => {
  _s = (_s + 0x6D2B79F5) >>> 0;
  let t = _s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

for (const id of Object.keys(VARIANTS)) {
  setVariant(id);
  console.log('\\n=== ' + V.full + ' ===');

  newGame();
  comprueba('reparte ' + game.board.size + ' piezas, con dos reyes y sin jaque',
    game.board.size >= 32 &&
    [...game.board].filter(([, p]) => p.type === 'K').length === 2 &&
    game.status === 'playing');

  let compAtaque = 0, difAtaque = 0, pos = 0, difMov = 0, ejemplo = '';
  for (let g = 0; g < ${PARTIDAS}; g++) {
    newGame();
    for (let j = 0; j < ${JUGADAS} && !gameEnded(); j++) {
      // 1) ataques: todas las casillas, los dos colores
      for (const cell of CELLS) {
        for (const color of ['w', 'b']) {
          const occ = game.board.get(cell.key);
          if (occ && occ.color === color) continue;   // fuera del dominio
          compAtaque++;
          if (isAttacked(game.board, cell, color) !==
              isAttackedFast(game.board, cell, color)) {
            difAtaque++;
            if (!ejemplo) ejemplo = cellName(cell) + ' por ' + color;
          }
        }
      }
      // 2) generación de jugadas
      const lento = movesForSide(game.board, game.turn, game.enPassant)
        .map(m => m.from + '>' + m.to).sort();
      const copia = deepCopyBoard(game.board);
      const kings = {};
      for (const [k, p] of copia) if (p.type === 'K') kings[p.color] = k;
      const rapido = genMoves(copia, game.turn, game.enPassant, kings, {})
        .map(m => m.from + '>' + m.to).sort();
      pos++;
      if (lento.join('|') !== rapido.join('|')) difMov++;

      const cand = movesForSide(game.board, game.turn, game.enPassant);
      if (!cand.length) break;
      const m = cand[Math.floor(rnd() * cand.length)];
      makeMove(m.from, m.to);
    }
  }
  comprueba('isAttackedFast == isAttacked  (' + compAtaque + ' casillas' +
    (difAtaque ? ', ' + difAtaque + ' MAL, p. ej. ' + ejemplo : '') + ')', difAtaque === 0);
  comprueba('genMoves == movesForSide  (' + pos + ' posiciones' +
    (difMov ? ', ' + difMov + ' MAL' : '') + ')', difMov === 0);

  // 3) todo peón debe poder coronar solo avanzando, desde cualquier casilla.
  const atascados = CELLS.filter(c => {
    if (c.promoFor.w) return false;
    const visto = new Set([c.key]), pila = [c];
    while (pila.length) {
      const x = pila.pop();
      if (x.promoFor.w) return false;
      for (const t of x.pawnPush.w) if (!visto.has(t.key)) { visto.add(t.key); pila.push(t); }
    }
    return true;
  });
  comprueba('todo peón blanco puede coronar solo avanzando', atascados.length === 0);

  // 4) el motor devuelve una jugada legal
  newGame();
  const mv = chooseAiMove(5, searchState(), {});
  const legales = movesForSide(game.board, 'w', null).map(m => m.from + '>' + m.to);
  comprueba('chooseAiMove(5) devuelve jugada legal: ' +
    (mv ? cellName(CELL_MAP.get(mv.from)) + '-' + cellName(CELL_MAP.get(mv.to)) : 'ninguna'),
    !!mv && legales.includes(mv.from + '>' + mv.to));
}
`);

console.log(fallos ? '\nFALLOS: ' + fallos : '\nTodo en verde');
process.exit(fallos ? 1 : 0);
