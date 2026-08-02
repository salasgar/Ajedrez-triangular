// corpus.js — Fase 1 del ajuste, separada de la fase 2.
//
// tune-values.js hace las dos cosas de una vez: juega N partidas de autojuego
// y ajusta los pesos sobre ellas. El problema es que la parte cara (jugar) y
// la parte barata (ajustar) quedan atadas, así que probar otra
// REGULARIZATION, otro subconjunto de características o otro SAMPLE_STRIDE
// obliga a repetir horas de autojuego para nada.
//
// Este script hace SOLO la parte cara: juega y escribe el corpus de
// posiciones (vector de características + resultado) a stdout, una línea
// JSON por posición. ajusta.js hace la parte barata y se puede correr tantas
// veces como haga falta sobre el mismo corpus.
//
// Es un shard: se lanzan varios en paralelo con SEED distinto y se concatenan
// sus salidas. La última línea de cada uno es un resumen ({resumen:...}) con
// los acumuladores de movilidad, que ajusta.js necesita para centrar esa
// característica y que hay que sumar entre shards.
//
// Variables de entorno:
//   SEED     semilla del PRNG (distinta por shard)
//   GAMES    partidas concluyentes objetivo (por shard)
//   MINUTES  alternativa a GAMES: presupuesto de tiempo
//   LEVEL    nivel real de AI_LEVELS para el autojuego; si no, CFG
//   CFG      configuración de autojuego (JSON), por defecto profundidad 2
//   FIFTY    regla de los 50 movimientos durante el autojuego
'use strict';
const fs = require('fs');
const path = require('path');

const SEED = Number(process.env.SEED || 1);
const GAMES = Number(process.env.GAMES || 200);
const MINUTES = process.env.MINUTES ? Number(process.env.MINUTES) : null;
const LEVEL = process.env.LEVEL || null;
const CFG = process.env.CFG || '{"depth":2,"order":true}';
const FIFTY = Number(process.env.FIFTY || 30);
const MAX_PLIES = Number(process.env.MAX_PLIES || 160);
const SAMPLE_STRIDE = Number(process.env.SAMPLE_STRIDE || 8);
// Adjudicación por material de las partidas que no terminan solas (tope de
// jugadas o regla de 50 acortada): con ADJ_MARGIN>0, si al cortar la ventaja
// material supera ese margen (centipeones, valores clásicos) se etiquetan como
// victoria en vez de descartarlas. A profundidad alta el juego es limpio y casi
// ninguna partida da mate dentro del tope; sin esto se tiraría la mayoría del
// cómputo. 0 = comportamiento antiguo (descartar). Ver README de la fase.
const ADJ_MARGIN = Number(process.env.ADJ_MARGIN || 0);

const dir = '/Users/salasgar/Documents/git/Ajedrez-triangular';
const gameSrc = ['geometry.js', 'variants.js', 'rules.js', 'ai.js']
  .map(f => fs.readFileSync(path.join(dir, f), 'utf8'))
  .join('\n');

const driverSrc = `
const PIECES = ['P', 'N', 'B', 'E', 'R', 'Q'];

let _s = ${SEED} >>> 0;
Math.random = function () {
  _s = (_s + 0x6D2B79F5) >>> 0;
  let t = _s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// --- las mismas tres características que tune-values.js, sin cambios ---
const CENTRALITY_BASE = CELLS.reduce((s, c) => s + centrality(c), 0) / CELLS.length;
const ADVANCE_BASE = 0.5;

function materialDiff(board) {
  const diff = PIECES.map(() => 0);
  for (const [, p] of board) {
    const idx = PIECES.indexOf(p.type);
    if (idx === -1) continue;
    diff[idx] += p.color === 'w' ? 1 : -1;
  }
  return diff;
}

// Centralidad por tipo y avance de peones, cada pieza medida contra una
// casilla media: sin esa resta la característica crece con el NÚMERO de
// piezas y mide material, no colocación (ver tune-values.js).
function positionalDiff(board) {
  const cent = PIECES.map(() => 0);
  let advance = 0;
  for (const [key, p] of board) {
    const idx = PIECES.indexOf(p.type);
    if (idx === -1) continue;
    const sign = p.color === 'w' ? 1 : -1;
    const cell = CELL_MAP.get(key);
    cent[idx] += sign * (centrality(cell) - CENTRALITY_BASE);
    if (p.type === 'P') advance += sign * (pawnAdvance(cell, p.color) - ADVANCE_BASE);
  }
  return [...cent, advance];
}

const mobTotal = PIECES.map(() => 0);
const mobCount = PIECES.map(() => 0);

function mobilityDiff(board) {
  let m = 0;
  for (const [key, p] of board) {
    const n = pseudoMoves(board, CELL_MAP.get(key), p, null).length;
    m += p.color === 'w' ? n : -n;
    const idx = PIECES.indexOf(p.type);
    if (idx !== -1) { mobTotal[idx] += n; mobCount[idx]++; }
  }
  return m;   // en bruto; ajusta.js lo centra y escala
}

// Balance material desde el punto de vista de las blancas (PIECE_VALUE del
// ai.js). Solo se usa para adjudicar partidas cortadas con un margen amplio, no
// para el ajuste, así que la elección exacta de valores es irrelevante: una
// ventaja de +300 cp es ventaja con cualquier tabla de piezas razonable.
function materialBalanceW(board) {
  let m = 0;
  for (const [, p] of board) m += (p.color === 'w' ? 1 : -1) * PV()[p.type];
  return m;
}

FIFTY_MOVE_LIMIT = ${FIFTY};
const selfPlayLevel = ${LEVEL ? Number(LEVEL) : "'tuning'"};
${LEVEL ? '' : 'AI_LEVELS.tuning = ' + CFG + ';'}

const budgetMs = ${MINUTES ? MINUTES * 60000 : 'null'};
const t0 = Date.now();
let usadas = 0, jugadas_total = 0, posiciones = 0, adjudicadas = 0;
const descartadas = { fifty: 0, maxplies: 0 };

while (budgetMs ? (Date.now() - t0 < budgetMs) : (usadas < ${GAMES})) {
  newGame();
  const feats = [];
  let plies = 0, aborted = false;
  while (!gameEnded() && plies < ${MAX_PLIES}) {
    if (budgetMs && Date.now() - t0 >= budgetMs) { aborted = true; break; }
    const mv = chooseAiMove(selfPlayLevel);
    if (!mv) break;
    makeMove(mv.from, mv.to);
    plies++;
    if (plies % ${SAMPLE_STRIDE} === 0) {
      feats.push([...materialDiff(game.board), ...positionalDiff(game.board),
        mobilityDiff(game.board)]);
    }
  }
  if (aborted) break;
  jugadas_total++;

  // etiqueta = resultado de la partida. Mate/ahogado/repetición son finales
  // genuinos y van directos. 'fifty' (regla acortada) y el corte por MAX_PLIES
  // no son terminales: por defecto se descartan, pero con ADJ_MARGIN>0 se
  // adjudican por ventaja material cuando es grande (rescata partidas largas de
  // juego profundo, que si no se tirarían casi todas).
  let label;
  if (game.status === 'checkmate') label = game.winner === 'w' ? 1 : 0;
  else if (game.status === 'stalemate' || game.status === 'repetition') label = 0.5;
  else if (${ADJ_MARGIN} > 0) {
    const bal = materialBalanceW(game.board);
    if (bal >= ${ADJ_MARGIN}) { label = 1; adjudicadas++; }
    else if (bal <= -${ADJ_MARGIN}) { label = 0; adjudicadas++; }
    else { if (game.status === 'fifty') descartadas.fifty++; else descartadas.maxplies++; continue; }
  } else {
    if (game.status === 'fifty') descartadas.fifty++; else descartadas.maxplies++;
    continue;
  }
  for (const diff of feats) {
    process.stdout.write(JSON.stringify({ d: diff.map(x => +x.toFixed(4)), y: label }) + '\\n');
    posiciones++;
  }
  usadas++;
  if (usadas % 25 === 0) {
    process.stderr.write('  seed ${SEED}: ' + usadas + ' partidas · ' + posiciones +
      ' posiciones · ' + ((Date.now() - t0) / 60000).toFixed(1) + ' min\\n');
  }
}

process.stdout.write(JSON.stringify({ resumen: {
  seed: ${SEED}, usadas, adjudicadas, jugadas: jugadas_total, posiciones, descartadas,
  mobTotal, mobCount, mins: +((Date.now() - t0) / 60000).toFixed(1),
} }) + '\\n');
`;

eval(gameSrc + '\n' + driverSrc);
