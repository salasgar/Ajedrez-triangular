// perft.js — Harness de verificación del motor: perft, dorados de búsqueda
// y bench. Es el cinturón de seguridad para tocar el generador de jugadas y
// la búsqueda (make/unmake, Zobrist, ordenación...) sin cambiar su semántica.
//
//   node perft.js gen               genera el corpus y CONGELA los conteos
//                                   esperados en perft-esperado.json
//   node perft.js check             recalcula todo y compara con lo congelado
//                                   (sale con código != 0 si algo difiere)
//   node perft.js divide <id> <d>   desglose de perft por jugada raíz, para
//                                   localizar en qué rama difiere un conteo
//   node perft.js bench [etiqueta]  mide ms y nodos por posición del subconjunto
//                                   de bench y lo guarda en bench-<etiqueta>.json
//
// QUÉ ES UN "DORADO". Es el calco de golden test / golden file: se congela la
// salida de una versión que se da por buena y se guarda como referencia, de
// modo que cualquier cambio posterior que la altere salte a la vista. En
// español se diría "valores de referencia"; aquí se les llama dorados.
//
// OJO CON LO QUE PRUEBAN, que no es lo que parece: un dorado dice "esto sigue
// dando lo mismo que antes", NO "esto es correcto". No hay números perft
// publicados para esta variante, así que el oráculo es el propio generador
// (movesForSide/applyMoveSim, con copias de Map) el día que se dio por bueno.
// Detectan CAMBIOS, no errores preexistentes: un fallo que ya estuviera ahí
// el primer día se habría congelado tan tranquilo. `gen` se ejecuta UNA vez
// antes de tocar nada; a partir de ahí manda `check`.
//
// Se congelan dos cosas distintas:
//
//  - PERFT, que vigila el GENERADOR DE JUGADAS: cuántas secuencias legales de
//    d jugadas salen de cada posición (la inicial a profundidad 3: 23.489).
//    Un solo número que resume miles de casos, y que se mueve si se rompe el
//    enroque, la captura al paso, la coronación o la detección de jaque.
//  - DORADOS DE BÚSQUEDA, que vigilan el MOTOR: por posición y configuración,
//    la puntuación de la mejor jugada raíz y el CONJUNTO de jugadas dentro de
//    PLAY_TOLERANCE. Se guarda el conjunto y no la jugada elegida porque el
//    motor sortea dentro de esa banda: la elegida cambia entre ejecuciones, la
//    banda no. Con opts.analyze la ventana se abre del todo, así que esas
//    puntuaciones son exactas y estables.
'use strict';
const fs = require('fs');
const path = require('path');

const MODO = process.argv[2] || 'check';
const ESPERADO = path.join(__dirname, 'perft-esperado.json');

const dir = '/Users/salasgar/Documents/git/Ajedrez-triangular';
const gameSrc = ['geometry.js', 'rules.js', 'ai.js']
  .map(f => fs.readFileSync(path.join(dir, f), 'utf8'))
  .join('\n');

// El driver corre dentro del mismo eval que el motor (mismo patrón que
// arena.js): así ve movesForSide, applyMoveSim, chooseAiMove, etc.
const driverSrc = `
// PRNG sembrado: reproducibilidad total (el sorteo de PLAY_TOLERANCE usa
// Math.random aunque los dorados no dependan de él)
function sembrar(seed) {
  let _s = seed >>> 0;
  Math.random = function () {
    _s = (_s + 0x6D2B79F5) >>> 0;
    let t = _s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// contadores de nodos, enchufados envolviendo las funciones globales del
// motor (las llamadas recursivas internas resuelven el nombre global, así
// que el envoltorio también las cuenta)
let NODOS = 0;
const _negamax = negamax, _quiesce = quiesce;
negamax = function (...a) { NODOS++; return _negamax(...a); };
quiesce = function (...a) { NODOS++; return _quiesce(...a); };

// --- serialización estable de una posición ---
function volcarPos(board, turn, ep) {
  const piezas = [...board.entries()]
    .map(([k, p]) => [k, { type: p.type, color: p.color, moved: !!p.moved }])
    .sort((x, y) => x[0] < y[0] ? -1 : 1);
  return { board: piezas, turn, ep: ep || null };
}
function cargarPos(pos) {
  return {
    board: new Map(pos.board.map(([k, p]) => [k, { ...p }])),
    turn: pos.turn, ep: pos.ep || null,
  };
}

// --- perft con conteo agrupado (bulk counting): en profundidad 1 basta el
// número de jugadas, sin aplicarlas. Ahorra el nivel más ancho del árbol. ---
function perft(board, turn, ep, depth) {
  const moves = movesForSide(board, turn, ep);
  if (depth <= 1) return moves.length;
  let n = 0;
  for (const m of moves) {
    const copy = new Map(board);
    const nextEp = applyMoveSim(copy, m.from, m.to, ep);
    n += perft(copy, rival(turn), nextEp, depth - 1);
  }
  return n;
}

function perftDivide(board, turn, ep, depth) {
  const out = [];
  for (const m of movesForSide(board, turn, ep)) {
    const copy = new Map(board);
    const nextEp = applyMoveSim(copy, m.from, m.to, ep);
    out.push([m.from + '>' + m.to, depth <= 1 ? 1 : perft(copy, rival(turn), nextEp, depth - 1)]);
  }
  return out.sort((a, b) => a[0] < b[0] ? -1 : 1);
}

// --- construcción del corpus: paseos aleatorios sembrados, clasificando las
// posiciones por lo que ejercitan (al paso, enroque pendiente, coronación
// inminente, jaque, final con pocas piezas) ---
function reyEnJaque(board, turn) {
  const k = findKing(board, turn);   // devuelve la CELDA, no la clave
  return k ? isAttacked(board, k, rival(turn)) : false;
}
function coronacionCerca(board, turn) {
  for (const [key, p] of board) {
    if (p.type !== 'P' || p.color !== turn) continue;
    const b = CELL_MAP.get(key).b;
    if ((turn === 'w' && b >= N - 1) || (turn === 'b' && b <= 2 - N)) return true;
  }
  return false;
}
function enroquePendiente(board, turn) {
  let rey = false, torre = false;
  for (const [, p] of board) {
    if (p.color !== turn || p.moved) continue;
    if (p.type === 'K') rey = true;
    if (p.type === 'R') torre = true;
  }
  return rey && torre;
}

function construirCorpus() {
  sembrar(20260727);
  const corpus = [];   // {id, desc, pos}
  const cupos = { alpaso: 4, enroque: 4, corona: 4, jaque: 4, final: 4, media: 4 };
  const anadir = (tipo, board, turn, ep) => {
    if (cupos[tipo] <= 0) return;
    cupos[tipo]--;
    corpus.push({ id: tipo + '-' + (4 - cupos[tipo]), desc: tipo, pos: volcarPos(board, turn, ep) });
  };

  // la inicial siempre, con perft más profundo que las demás
  newGame();
  corpus.push({ id: 'inicial', desc: 'posición inicial', pos: volcarPos(game.board, 'w', null) });

  for (let partida = 0; partida < 400 && corpus.length < 26; partida++) {
    newGame();
    let board = new Map(game.board), turn = 'w', ep = null;
    for (let ply = 0; ply < 120; ply++) {
      const moves = movesForSide(board, turn, ep);
      if (!moves.length) break;
      const m = moves[Math.floor(Math.random() * moves.length)];
      board = new Map(board);
      ep = applyMoveSim(board, m.from, m.to, ep);
      turn = rival(turn);
      if (ep) anadir('alpaso', board, turn, ep);
      else if (ply > 60 && board.size <= 12) { anadir('final', board, turn, ep); break; }
      else if (reyEnJaque(board, turn)) anadir('jaque', board, turn, ep);
      else if (coronacionCerca(board, turn)) anadir('corona', board, turn, ep);
      else if (ply >= 20 && ply <= 40 && enroquePendiente(board, turn)) anadir('enroque', board, turn, ep);
      else if (ply === 50) anadir('media', board, turn, ep);
    }
  }
  return corpus;
}

// --- dorados: best de raíz + banda de PLAY_TOLERANCE, por nivel ---
function dorado(pos, level) {
  sembrar(97);
  const { board, turn, ep } = cargarPos(pos);
  const st = { board, turn, enPassant: ep, clock: 0, posKeys: [] };
  const r = chooseAiMove(level, st, { analyze: true });
  if (!r || !r.analysis) return null;
  const best = r.analysis[0].score;
  const banda = r.analysis.filter(a => a.score >= best - PLAY_TOLERANCE)
    .map(a => a.from + '>' + a.to).sort();
  return { best, banda, legales: r.analysis.length };
}

// --- modos ---
//
// Las dos configuraciones de los dorados van ESCRITAS AQUI, no tomadas de
// AI_LEVELS por su numero. Antes eran "el nivel 3" y "el nivel 4", y eso
// ataba la verificacion al menu de niveles: rediseñarlo invalidaba los
// dorados de golpe, que es justo la red de seguridad que hace falta mientras
// se rediseña. Lo que estos dorados vigilan es la BUSQUEDA, no qué nivel
// ofrece la interfaz. Son las que eran el nivel 3 y el nivel 4 el dia que se
// congelo perft-esperado.json; no se tocan aunque los niveles cambien.
AI_LEVELS.DORADO_BARATO = { depth: 2 };
AI_LEVELS.DORADO_CARO = { depth: 3, mobility: true, order: true, quiesce: true };
const NIVEL_DORADO_TODAS = 'DORADO_BARATO';   // prof. 2, barato: todas
const NIVEL_DORADO_CARO = 'DORADO_CARO';      // prof. 3 completo: subconjunto
const CARO_CADA = 3;              // 1 de cada 3 posiciones al nivel caro
const PROF_PERFT = { inicial: 3 };  // profundidad de perft por id (resto: 2)
const PROF_PERFT_DEF = 2;

function calcular(corpus, conDorados) {
  const perftRes = {}, dorados = {};
  for (let i = 0; i < corpus.length; i++) {
    const c = corpus[i];
    const d = PROF_PERFT[c.id] || PROF_PERFT_DEF;
    const { board, turn, ep } = cargarPos(c.pos);
    const t0 = Date.now();
    perftRes[c.id] = { d, n: perft(board, turn, ep, d) };
    if (conDorados) {
      dorados[c.id] = { [NIVEL_DORADO_TODAS]: dorado(c.pos, NIVEL_DORADO_TODAS) };
      if (i % CARO_CADA === 0) dorados[c.id][NIVEL_DORADO_CARO] = dorado(c.pos, NIVEL_DORADO_CARO);
    }
    process.stderr.write('  ' + c.id + ': perft(' + d + ')=' + perftRes[c.id].n +
      ' · ' + ((Date.now() - t0) / 1000).toFixed(1) + 's\\n');
  }
  return { perftRes, dorados };
}

if (MODO_JS === 'gen') {
  const corpus = construirCorpus();
  const { perftRes, dorados } = calcular(corpus, true);
  RESULTADO = { generado: new Date().toISOString(), corpus, perft: perftRes, dorados };
} else if (MODO_JS === 'check') {
  const esperado = ESPERADO_JSON;
  const { perftRes, dorados } = calcular(esperado.corpus, true);
  let fallos = 0;
  for (const c of esperado.corpus) {
    const e = esperado.perft[c.id], v = perftRes[c.id];
    if (e.n !== v.n || e.d !== v.d) {
      console.log('PERFT DIFIERE en ' + c.id + ': esperado ' + e.n + ' (d' + e.d + '), obtenido ' + v.n);
      fallos++;
    }
    for (const nivel of Object.keys(esperado.dorados[c.id] || {})) {
      const ed = esperado.dorados[c.id][nivel], vd = (dorados[c.id] || {})[nivel];
      if (!vd || ed.best !== vd.best || ed.legales !== vd.legales ||
          JSON.stringify(ed.banda) !== JSON.stringify(vd.banda)) {
        console.log('DORADO DIFIERE en ' + c.id + ' nivel ' + nivel +
          ': esperado best=' + ed.best + ' banda=' + ed.banda.join(',') +
          ' / obtenido ' + (vd ? 'best=' + vd.best + ' banda=' + vd.banda.join(',') : 'null'));
        fallos++;
      }
    }
  }
  RESULTADO = { fallos, total: esperado.corpus.length };
} else if (MODO_JS === 'divide') {
  const esperado = ESPERADO_JSON;
  const c = esperado.corpus.find(x => x.id === DIVIDE_ID);
  if (!c) { console.log('id no encontrado; ids: ' + esperado.corpus.map(x => x.id).join(' ')); }
  else {
    const { board, turn, ep } = cargarPos(c.pos);
    for (const [mv, n] of perftDivide(board, turn, ep, DIVIDE_D)) console.log(mv + '  ' + n);
  }
  RESULTADO = null;
} else if (MODO_JS === 'bench') {
  const esperado = ESPERADO_JSON;
  const filas = [];
  for (let i = 0; i < esperado.corpus.length; i += CARO_CADA) {
    const c = esperado.corpus[i];
    sembrar(97);
    const { board, turn, ep } = cargarPos(c.pos);
    NODOS = 0;
    const t0 = Date.now();
    chooseAiMove(4, { board, turn, enPassant: ep, clock: 0, posKeys: [] });
    filas.push({ id: c.id, ms: Date.now() - t0, nodos: NODOS });
    process.stderr.write('  ' + c.id + ': ' + filas[filas.length - 1].ms + ' ms · ' + NODOS + ' nodos\\n');
  }
  const totMs = filas.reduce((a, f) => a + f.ms, 0), totN = filas.reduce((a, f) => a + f.nodos, 0);
  RESULTADO = { etiqueta: BENCH_ETIQUETA, fecha: new Date().toISOString(),
    nivel: 4, filas, totalMs: totMs, totalNodos: totN,
    nodosPorSeg: Math.round(totN / (totMs / 1000)) };
}
`;

// Variables que el driver espera encontrar en el ámbito del eval.
let RESULTADO = null;
const MODO_JS = MODO;
const ESPERADO_JSON = fs.existsSync(ESPERADO)
  ? JSON.parse(fs.readFileSync(ESPERADO, 'utf8')) : null;
const DIVIDE_ID = process.argv[3] || '';
const DIVIDE_D = Number(process.argv[4] || 2);
const BENCH_ETIQUETA = process.argv[3] || 'sin-etiqueta';

if ((MODO === 'check' || MODO === 'divide' || MODO === 'bench') && !ESPERADO_JSON) {
  console.error('No existe perft-esperado.json: ejecuta antes `node perft.js gen`');
  process.exit(2);
}

eval(gameSrc + '\n' + driverSrc);

if (MODO === 'gen') {
  fs.writeFileSync(ESPERADO, JSON.stringify(RESULTADO));
  console.log('Congelado: ' + RESULTADO.corpus.length + ' posiciones en ' + ESPERADO);
} else if (MODO === 'check') {
  if (RESULTADO.fallos) { console.log(RESULTADO.fallos + ' FALLOS'); process.exit(1); }
  console.log('OK: ' + RESULTADO.total + ' posiciones, perft y dorados idénticos');
} else if (MODO === 'bench') {
  const f = path.join(__dirname, 'bench-' + BENCH_ETIQUETA + '.json');
  fs.writeFileSync(f, JSON.stringify(RESULTADO, null, 1));
  console.log('Bench "' + BENCH_ETIQUETA + '": ' + RESULTADO.totalMs + ' ms · ' +
    RESULTADO.totalNodos + ' nodos · ' + RESULTADO.nodosPorSeg + ' nodos/s → ' + f);
}
