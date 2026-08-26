#!/usr/bin/env node
// test-ia-rps.js — Pruebas de la IA en las modalidades «Piedra, papel y
// tijera» (evaluación dinámica, búsqueda sin rey) y regresión de las clásicas.
//
// Ejecutar con:  node test-ia-rps.js            (todas las pruebas)
//                node test-ia-rps.js goldens    (regenera los dorados de
//                                                regresión; ejecutar SOLO
//                                                sobre la versión de ai.js
//                                                que se toma como referencia)
//                node test-ia-rps.js match 30   (solo el match dinámico vs
//                                                plano, con 30 partidas)
//
// Carga geometry.js, variants.js, rules.js y ai.js en un contexto de vm (son
// scripts de variables globales, sin módulos) y comprueba:
//   · REGRESIÓN: en las modalidades clásicas (salas, salas-v4, salas-1998,
//     dekle, trigonal), la evaluación estática, la puntuación de la búsqueda
//     y la jugada elegida coinciden EXACTAMENTE con las medidas en la rama
//     base (dorados de abajo), con el azar sembrado para que el sorteo entre
//     jugadas equivalentes sea reproducible.
//   · que los valores dinámicos responden a presas y depredadores (rpsValor)
//   · el término de amenazas de evaluateRps (pieza atacada, colgada o no)
//   · que la quietud no genera capturas prohibidas por la matriz
//   · que en las modalidades -rey los dos reyes nunca quedan adyacentes
//     (ni por legalMoves ni por genMoves)
//   · que la búsqueda puntúa la eliminación ('wiped') como un mate y no
//     aplica la regla de los 50 movimientos en las modalidades sin rey
//   · partidas completas IA contra IA en las cuatro modalidades nuevas
//   · un match 'rps' de la evaluación dinámica contra los valores planos

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ctx = vm.createContext({ console });
for (const f of ['geometry.js', 'variants.js', 'rules.js', 'ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), ctx, { filename: f });
}

let fallos = 0;
function ok(cond, msg) {
  if (cond) { console.log('  ✓ ' + msg); }
  else { console.error('  ✗ ' + msg); fallos++; }
}

function run(code) {
  return vm.runInContext('(function () {' + code + '}())', ctx);
}

// Azar sembrado (mulberry32) DENTRO del contexto: chooseAiMove sortea entre
// jugadas casi empatadas con Math.random, y la regresión necesita que ese
// sorteo caiga igual en la rama base y en la nueva.
vm.runInContext(`
function _siembra(seed) {
  let s = seed >>> 0;
  Math.random = function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}`, ctx);

// Juega `plies` medias jugadas con la IA (analyze para tener la puntuación
// exacta de la mejor) y devuelve la traza: jugada elegida, mejor puntuación
// de la búsqueda y evaluación estática de la posición ANTES de mover.
vm.runInContext(`
function _traza(id, plies, nivel, seed) {
  setVariant(id);
  newGame();
  _siembra(seed);
  const out = [];
  for (let i = 0; i < plies; i++) {
    const ev = evaluate(game.board, game.turn, AI_LEVELS[nivel]);
    const mv = chooseAiMove(nivel, undefined, { analyze: true });
    if (!mv) break;
    let best = -Infinity;
    for (const a of mv.analysis) if (a.score > best) best = a.score;
    out.push(mv.from + '>' + mv.to + '|' + best + '|' + ev);
    makeMove(mv.from, mv.to);
    if (gameEnded()) break;
  }
  return out;
}`, ctx);

// Partida completa IA contra IA. levelW/levelB pueden ser claves de
// AI_LEVELS añadidas por la prueba (p. ej. configuraciones a medida).
vm.runInContext(`
function _partida(id, levelW, levelB, cap, seed) {
  setVariant(id);
  newGame();
  _siembra(seed);
  let plies = 0;
  while (!gameEnded() && plies < cap) {
    const mv = chooseAiMove(game.turn === 'w' ? levelW : levelB);
    if (!mv) break;
    makeMove(mv.from, mv.to);
    plies++;
  }
  const piezas = { w: 0, b: 0 };
  for (const [, p] of game.board) piezas[p.color]++;
  return { status: game.status, winner: game.winner, plies, piezas,
           ended: gameEnded() };
}`, ctx);

const CLASICAS = ['salas', 'salas-v4', 'salas-1998', 'dekle', 'trigonal'];
const NIVEL_REG = 4;      // sin temperatura: determinista con el azar sembrado
const PLIES_REG = 6;
const SEED_REG = 20260824;

// --- modo goldens: imprime la referencia y sale ----------------------------

if (process.argv[2] === 'goldens') {
  const g = {};
  for (const id of CLASICAS) {
    g[id] = run(`return _traza('${id}', ${PLIES_REG}, ${NIVEL_REG}, ${SEED_REG})`);
  }
  console.log(JSON.stringify(g, null, 1));
  process.exit(0);
}

// --- REGRESIÓN: las clásicas evalúan y juegan exactamente igual ------------
//
// Dorados medidos en la rama base (variantes-ppt, commit 0e15027), con
// `node test-ia-rps.js goldens` ANTES de tocar ai.js. Formato de cada media
// jugada: 'origen>destino|mejor puntuación de la búsqueda|evaluación
// estática de la posición'.
//
// EXCEPCIÓN: el dorado de `dekle` se remidió el 2026-08-26 (tarea 16 del
// reparto). No era una regresión: el commit 56917bf (tarea 10) cambió los
// valores de las piezas de dekle y su movilidad tras la ronda 15 del
// entrenamiento, de modo que el dorado de la rama base quedó midiendo una
// evaluación que ya no existe. El resto de las clásicas siguen con el dorado
// original, y al remedir salieron idénticas (comprobado). Las puntuaciones de
// dekle ya no son enteras porque su movilidad medida es 7.63.

const GOLDENS = {
 "salas": [
  "0,-2,4>-1,-1,3|0|0",
  "-3,3,1>-2,2,2|-36|-20",
  "1,-3,4>-1,-1,4|-4|0",
  "0,4,-3>1,2,-1|-28|-36",
  "2,-2,1>1,0,0|0|8",
  "-2,3,0>-1,1,1|8|-40"
 ],
 "salas-v4": [
  "1,-2,3>0,0,2|8|0",
  "0,3,-1>1,1,0|-20|-28",
  "4,-3,1>2,-1,0|-140|-4",
  "-1,4,-2>0,2,-1|80|-24",
  "1,-3,4>1,1,0|-80|-180",
  "0,4,-2>0,0,2|80|20"
 ],
 "salas-1998": [
  "1,-2,2>1,-1,2|80|0",
  "-1,3,0>0,1,1|0|-36",
  "2,-3,2>-2,1,2|20|-4",
  "-1,4,-1>-1,2,1|-24|-80",
  "-2,1,2>1,1,-1|12|20",
  "-1,2,1>-1,0,3|4|-24"
 ],
 "dekle": [
  "0,-2,3>-1,0,2|9.237055564881302e-14|-2.3092638912203256e-14",
  "-3,3,1>-2,1,2|-15.26000000000035|-7.6299999999999715",
  "2,-2,1>1,0,0|-7.629999999999789|-2.3092638912203256e-14",
  "0,3,-1>1,1,0|-45.78000000000019|-7.6299999999999715",
  "3,-3,2>2,-2,1|15.260000000000062|-2.842170943040401e-14",
  "-1,4,-2>0,2,-1|-45.77999999999976|-68.67"
 ],
 "trigonal": [
  "-2,1,2>-2,4,0|48|0",
  "2,1,-2>2,2,-2|8|-68",
  "-2,-2,5>0,-2,4|12|28",
  "2,2,-2>0,2,-1|-28|-44",
  "-1,-1,3>0,-1,3|12|12",
  "2,0,-1>2,0,0|-84|-44"
 ]
};

if (process.argv[2] !== 'match') {
  console.log('Regresión de las modalidades clásicas:');
  for (const id of CLASICAS) {
    const traza = run(`return _traza('${id}', ${PLIES_REG}, ${NIVEL_REG}, ${SEED_REG})`);
    const igual = JSON.stringify(traza) === JSON.stringify(GOLDENS[id]);
    ok(igual, `${id}: evaluación, puntuación y jugadas idénticas a la rama base`);
    if (!igual) {
      console.error('    esperado:', GOLDENS[id]);
      console.error('    obtenido:', traza);
    }
  }

  // --- valores dinámicos -----------------------------------------------------

  console.log('Valores dinámicos (rpsValor):');
  run(`setVariant('rps')`);
  const suelo = run(`return RPS_CFG.VALOR_SUELO`);
  {
    const con3 = run(`return rpsValor('O', { O: 0, A: 0, T: 3 })`);
    const con1 = run(`return rpsValor('O', { O: 0, A: 0, T: 1 })`);
    const sin = run(`return rpsValor('O', { O: 0, A: 0, T: 0 })`);
    ok(con3 > con1 && con1 > sin,
      `más presas vivas = más valor (${con3} > ${con1} > ${sin})`);
    ok(sin === suelo,
      `sin presas ni depredadores, el valor cae al suelo (${sin} = RPS_CFG.VALOR_SUELO)`);
    ok(suelo > 0, 'el suelo no es cero: bloquear y ocupar espacio vale algo');
  }
  {
    const pocos = run(`return rpsValor('O', { O: 0, A: 1, T: 2 })`);
    const muchos = run(`return rpsValor('O', { O: 0, A: 5, T: 2 })`);
    ok(muchos < pocos,
      `más depredadores vivos = menos valor (${muchos} < ${pocos})`);
    const acosada = run(`return rpsValor('O', { O: 0, A: 20, T: 0 })`);
    ok(acosada === suelo, `los depredadores nunca hunden el valor bajo el suelo (${acosada})`);
  }
  {
    // En rpsls cada tipo tiene dos presas y dos depredadores.
    run(`setVariant('rpsls')`);
    const v1 = run(`return rpsValor('O', { O: 0, A: 0, T: 2, L: 2, S: 0 })`);
    const v2 = run(`return rpsValor('O', { O: 0, A: 0, T: 2, L: 0, S: 0 })`);
    ok(v1 > v2, `rpsls: las dos especies de presa cuentan (${v1} > ${v2})`);
  }
  {
    // En las -rey el rey no entra en los recuentos (tratamiento especial).
    run(`setVariant('rps-rey')`);
    const conK = run(`return rpsValor('O', { O: 0, A: 0, T: 2, K: 1 })`);
    const sinK = run(`return rpsValor('O', { O: 0, A: 0, T: 2, K: 0 })`);
    ok(conK === sinK, 'rps-rey: el rey rival no cuenta como presa ni depredador');
  }

  // El ejemplo literal del diseñador, visto desde evaluate(): «si no quedan
  // tijeras (rivales), una piedra tendrá menos valor que un papel». Contra
  // una piedra negra sola, tener un papel (que puede cazarla) vale más que
  // tener una piedra (que ya no puede capturar nada).
  {
    const r = run(`
      setVariant('rps');
      // dos casillas no vecinas (que el término de amenazas no entre)
      const a = CELLS[0];
      const b = CELLS.find(c => c !== a && !a.kingNbrs.includes(c));
      const cfg = { mobility: false };
      const conPiedra = new Map([
        [a.key, { type: 'O', color: 'w', moved: true }],
        [b.key, { type: 'O', color: 'b', moved: true }],
      ]);
      const conPapel = new Map([
        [a.key, { type: 'A', color: 'w', moved: true }],
        [b.key, { type: 'O', color: 'b', moved: true }],
      ]);
      return { piedra: evaluate(conPiedra, 'w', cfg), papel: evaluate(conPapel, 'w', cfg) };
    `);
    ok(r.papel > r.piedra,
      `sin tijeras rivales, un papel vale más que una piedra (${r.papel} > ${r.piedra})`);
  }

  // --- término de amenazas ---------------------------------------------------

  console.log('Amenazas:');
  {
    const r = run(`
      setVariant('rps');
      const centro = CELLS.find(c => c.kingNbrs.length >= 6);
      const [n1, n2] = centro.kingNbrs;
      const lejos = CELLS.find(c => c !== centro && !centro.kingNbrs.includes(c) &&
        !c.kingNbrs.includes(n1) && !c.kingNbrs.includes(n2) &&
        c.kingNbrs.length >= 2);
      const cfg = { mobility: false };
      // tijera blanca tranquila (la piedra negra está lejos)
      const tranquila = new Map([
        [centro.key, { type: 'T', color: 'w', moved: true }],
        [lejos.key, { type: 'O', color: 'b', moved: true }],
      ]);
      // tijera blanca atacada por la piedra negra vecina, sin defensa posible
      const colgada = new Map([
        [centro.key, { type: 'T', color: 'w', moved: true }],
        [n1.key, { type: 'O', color: 'b', moved: true }],
      ]);
      // lo mismo pero con un papel blanco que puede comerse a la piedra
      const defensor = n1.kingNbrs.find(c => c !== centro);
      const defendida = new Map([
        [centro.key, { type: 'T', color: 'w', moved: true }],
        [n1.key, { type: 'O', color: 'b', moved: true }],
        [defensor.key, { type: 'A', color: 'w', moved: true }],
      ]);
      return { tranquila: evaluate(tranquila, 'w', cfg),
               colgada: evaluate(colgada, 'w', cfg),
               defendida: evaluate(defendida, 'w', cfg) };
    `);
    ok(r.colgada < r.tranquila,
      `estar atacada por un depredador penaliza (${r.colgada} < ${r.tranquila})`);
    ok(r.defendida > r.colgada,
      `poder capturar al atacante amortigua la amenaza (${r.defendida} > ${r.colgada})`);
  }

  // --- la quietud respeta la matriz de capturas ------------------------------

  console.log('Generación de capturas de la quietud:');
  {
    const r = run(`
      setVariant('rps');
      const centro = CELLS.find(c => c.kingNbrs.length >= 3);
      const [n1, n2] = centro.kingNbrs;
      const board = new Map([
        [centro.key, { type: 'O', color: 'w', moved: true }],
        [n1.key, { type: 'A', color: 'b', moved: true }],
        [n2.key, { type: 'T', color: 'b', moved: true }],
      ]);
      const kings = { w: null, b: null };
      const caps = genCaptures(board, 'w', null, kings, {});
      return caps.map(m => m.to);
    `);
    ok(r.length === 1, `la piedra solo tiene una captura legal (da ${r.length})`);
    ok(run(`
      setVariant('rps');
      const centro = CELLS.find(c => c.kingNbrs.length >= 3);
      const board = new Map([
        [centro.key, { type: 'O', color: 'w', moved: true }],
        [centro.kingNbrs[0].key, { type: 'A', color: 'b', moved: true }],
      ]);
      return genCaptures(board, 'w', null, { w: null, b: null }, {}).length === 0;
    `), 'piedra junto a papel: ninguna captura (la matriz lo prohíbe)');
  }

  // --- los dos reyes nunca adyacentes (modalidades -rey) ---------------------
  //
  // La regla (decisión de Juan Luis, 2026-08-26) está codificada como un DATO:
  // 'K' figura entre las víctimas de 'K' en capturesConRey (variants.js). De
  // ahí sale sola la ilegalidad, porque tanto attacks()/isAttacked (rules.js,
  // el camino de la interfaz) como isAttackedFast (ai.js, el de la búsqueda)
  // filtran los ataques de las saltadoras por canCapture().
  //
  // Posición mínima: los dos reyes a distancia 2, de forma que las casillas
  // vecinas del rey blanco se parten en dos grupos — las que también tocan al
  // rey negro (prohibidas) y las que no (siguen siendo legales). Se comprueban
  // los dos generadores, porque son código distinto y podrían discrepar.

  console.log('Reyes nunca adyacentes:');
  for (const id of ['rps-rey', 'rpsls-rey']) {
    const r = run(`
      setVariant('${id}');
      newGame();
      const a = CELLS.find(c => c.kingNbrs.length >= 6);
      const b = CELLS.find(c => c !== a && !a.kingNbrs.includes(c) &&
        c.kingNbrs.some(n => a.kingNbrs.includes(n)));
      const comunes = a.kingNbrs.filter(n => b.kingNbrs.includes(n)).map(c => c.key);
      const otras = a.kingNbrs.filter(n => !b.kingNbrs.includes(n)).map(c => c.key);
      const wk = { type: 'K', color: 'w', moved: true };
      game.board = new Map([[a.key, wk], [b.key, { type: 'K', color: 'b', moved: true }]]);
      game.turn = 'w';
      const legales = legalMoves(game.board, a.key, wk, null).map(c => c.key);
      const busqueda = genMoves(game.board, 'w', null, { w: a.key, b: b.key }, {}).map(m => m.to);
      return {
        kxk: canCapture('K', 'K'),
        nComunes: comunes.length,
        nOtras: otras.length,
        prohibidasEnReglas: comunes.filter(k => legales.includes(k)).length,
        prohibidasEnBusqueda: comunes.filter(k => busqueda.includes(k)).length,
        perdidasEnReglas: otras.filter(k => !legales.includes(k)).length,
        perdidasEnBusqueda: otras.filter(k => !busqueda.includes(k)).length,
      };
    `);
    ok(r.kxk, `${id}: la matriz declara que el rey captura al rey (regla de adyacencia)`);
    ok(r.nComunes > 0 && r.nOtras > 0,
      `${id}: la posición de prueba separa casillas prohibidas y permitidas ` +
      `(${r.nComunes} y ${r.nOtras})`);
    ok(r.prohibidasEnReglas === 0,
      `${id}: legalMoves no ofrece ninguna casilla junto al rey rival`);
    ok(r.prohibidasEnBusqueda === 0,
      `${id}: genMoves tampoco la ofrece`);
    ok(r.perdidasEnReglas === 0 && r.perdidasEnBusqueda === 0,
      `${id}: las demás jugadas del rey siguen ahí (${r.nOtras} casillas)`);
  }

  // --- pesos configurables (RPS_CFG) -----------------------------------------

  // La cadena de tareas 17-20 mide por elo variantes de estos pesos, así que la
  // arena necesita poder cambiarlos SIN editar ai.js y sin que una rama
  // contamine a la otra: las dos juegan en el MISMO proceso, alternándose jugada
  // a jugada. Lo que se comprueba aquí es justo eso, porque si falla no falla
  // ruidosamente: la tanda mediría dos motores iguales y daría un elo 0 creíble.

  console.log('Pesos configurables (cfg.rps → RPS_CFG):');
  {
    const r = run(`
      setVariant('rps-rey');
      newGame();
      // Posición asimétrica: en la inicial la evaluación es 0 por simetría y no
      // distinguiría un peso de otro.
      let quitadas = 0;
      for (const [k, p] of [...game.board]) {
        if (p.color === 'b' && p.type !== 'K' && quitadas < 2) { game.board.delete(k); quitadas++; }
      }
      const base = { depth: 2, mobility: true, order: true, quiesce: true };
      const porDefecto = evaluate(game.board, 'w', base);
      const cambiado = evaluate(game.board, 'w', { ...base, rps: { VALOR_SUELO: 900 } });
      const vuelta = evaluate(game.board, 'w', base);
      let claveMala = null, valorMalo = null;
      try { evaluate(game.board, 'w', { ...base, rps: { NOEXISTE: 1 } }); }
      catch (e) { claveMala = e.message; }
      try { evaluate(game.board, 'w', { ...base, rps: { AMENAZA: 'mucho' } }); }
      catch (e) { valorMalo = e.message; }
      // el camino de la BÚSQUEDA, que es otro: rpsValor() y orderMoves() no
      // reciben cfg y leen RPS_CFG directamente
      AI_LEVELS.PRUEBA_A = { ...base, nodes: 4500 };
      AI_LEVELS.PRUEBA_B = { ...base, nodes: 4500, rps: { PESO_PRESA: 400 } };
      const mvA = chooseAiMove('PRUEBA_A');
      const cfgTrasBuscar = { ...RPS_CFG };
      const mvB = chooseAiMove('PRUEBA_B');
      return { porDefecto, cambiado, vuelta, claveMala, valorMalo,
        buscaOk: !!(mvA && mvB), cfgTrasBuscar, defectos: { ...RPS_DEFAULTS } };
    `);
    ok(r.cambiado !== r.porDefecto,
      `cfg.rps cambia de verdad la evaluación (${r.porDefecto} → ${r.cambiado})`);
    ok(r.vuelta === r.porDefecto,
      `y no se queda pegado: sin cfg.rps se vuelve al valor de siempre (${r.vuelta})`);
    ok(/clave desconocida/.test(r.claveMala || ''),
      'una clave mal escrita ABORTA en vez de medir dos motores iguales en silencio');
    ok(/debe ser un número/.test(r.valorMalo || ''),
      'un valor que no es número también aborta');
    ok(r.buscaOk, 'la búsqueda entera funciona con pesos sobrescritos');
    ok(JSON.stringify(r.cfgTrasBuscar) === JSON.stringify(r.defectos),
      'una búsqueda sin cfg.rps deja los pesos activos en los de por defecto');
  }

  // --- búsqueda sin rey ------------------------------------------------------

  console.log('Búsqueda kingless:');
  {
    // Capturar la última pieza rival tiene que puntuar como un mate.
    const r = run(`
      setVariant('rps');
      newGame();
      const centro = CELLS.find(c => c.kingNbrs.length >= 3);
      game.board = new Map([
        [centro.key, { type: 'O', color: 'w', moved: true }],
        [centro.kingNbrs[0].key, { type: 'T', color: 'b', moved: true }],
      ]);
      game.history = [snapshot()]; game.histIndex = 0;
      _siembra(7);
      const mv = chooseAiMove(4, undefined, { analyze: true });
      let best = -Infinity;
      for (const a of mv.analysis) if (a.score > best) best = a.score;
      return { best, to: mv.to, tijera: centro.kingNbrs[0].key };
    `);
    ok(r.best >= run('return MATE'), `eliminar al rival puntúa como mate (${r.best})`);
    ok(r.to === r.tijera, 'la IA elige la captura que elimina al rival');
  }
  {
    // La regla de los 50 movimientos NO aplica sin rey: con el reloj al
    // límite, una posición ganadora se sigue puntuando como ganadora.
    const r = run(`
      setVariant('rps');
      newGame();
      const libres = CELLS.filter(c => c.kingNbrs.length >= 3);
      game.board = new Map([
        [libres[0].key, { type: 'O', color: 'w', moved: true }],
        [libres[2].key, { type: 'O', color: 'w', moved: true }],
        [libres[libres.length - 1].key, { type: 'T', color: 'b', moved: true }],
      ]);
      game.clock = FIFTY_MOVE_LIMIT;   // reloj agotado
      game.history = [snapshot()]; game.histIndex = 0;
      _siembra(7);
      const mv = chooseAiMove(4, undefined, { analyze: true });
      let best = -Infinity;
      for (const a of mv.analysis) if (a.score > best) best = a.score;
      return best;
    `);
    ok(r > 100, `con el reloj de los 50 agotado la ventaja sigue contando (${r})`);
  }
  {
    // Posición muerta (piedra contra piedra): la búsqueda la ve como tablas.
    const r = run(`
      setVariant('rps');
      newGame();
      const libres = CELLS.filter(c => c.kingNbrs.length >= 3);
      game.board = new Map([
        [libres[0].key, { type: 'O', color: 'w', moved: true }],
        [libres[libres.length - 1].key, { type: 'O', color: 'b', moved: true }],
      ]);
      game.history = [snapshot()]; game.histIndex = 0;
      return rpsDeadPosition(game.board);
    `);
    ok(r === true, 'rpsDeadPosition reconoce piedra contra piedra');
    ok(run(`
      const centro = CELLS.find(c => c.kingNbrs.length >= 3);
      return rpsDeadPosition(new Map([
        [centro.key, { type: 'O', color: 'w', moved: true }],
        [centro.kingNbrs[0].key, { type: 'T', color: 'b', moved: true }],
      ])) === false;
    `), 'rpsDeadPosition no salta si alguien puede aún eliminar al rival');
    // Ineliminabilidad mutua con capturas aún posibles: papel+piedra contra
    // papel+piedra (los papeles son inmortales sin tijeras enfrente, así que
    // nadie puede eliminar a nadie, aunque los papeles aún coman piedras).
    ok(run(`
      const libres = CELLS.filter(c => c.kingNbrs.length >= 3);
      const b = new Map();
      b.set(libres[0].key, { type: 'A', color: 'w', moved: true });
      b.set(libres[1].key, { type: 'O', color: 'w', moved: true });
      b.set(libres[libres.length - 2].key, { type: 'A', color: 'b', moved: true });
      b.set(libres[libres.length - 1].key, { type: 'O', color: 'b', moved: true });
      return rpsDeadPosition(b) === true && deadPositionKingless(b) === true;
    `), 'papeles inmortales por ambos lados = posición muerta (IA y reglas coinciden)');
  }

  // --- partidas completas IA contra IA ---------------------------------------

  // Sin regla de 50 jugadas ni jaque, las partidas kingless entre dos
  // motores prudentes son LARGAS (cientos de jugadas de maniobra); el tope
  // es generoso a propósito.
  console.log('Partidas completas (nivel 4, puede tardar unos minutos):');
  const FINALES = {
    rps: ['wiped', 'stalemate', 'repetition', 'material'],
    rpsls: ['wiped', 'stalemate', 'repetition', 'material'],
    'rps-rey': ['checkmate', 'stalemate', 'repetition', 'material', 'fifty'],
    'rpsls-rey': ['checkmate', 'stalemate', 'repetition', 'material', 'fifty'],
  };
  for (const [id, validos] of Object.entries(FINALES)) {
    const r = run(`return _partida('${id}', 4, 4, 1600, 99)`);
    ok(r.ended, `${id}: la partida termina (${r.status ?? '?'} en ${r.plies} medias jugadas)`);
    ok(validos.includes(r.status),
      `${id}: resultado válido ('${r.status}'${r.winner ? ', gana ' + r.winner : ''})`);
  }
}

// --- match: valores dinámicos contra valores planos en 'rps' ----------------
//
// Mismo nivel de búsqueda para los dos; la única diferencia es la evaluación
// (cfg.dynamicValues === false desactiva la dinámica y deja los valores
// planos de la modalidad). Nivel 4: sin temperatura, pero el sorteo sembrado
// entre jugadas casi empatadas (PLAY_TOLERANCE) hace cada semilla una
// partida distinta. Los colores se alternan y la firma de la TT incluye
// dynamicValues, así que cada jugador usa su propia tabla.

const NGAMES = Number(process.argv[3] ?? process.argv[2]) || 6;
console.log(`Match rps: evaluación dinámica contra valores planos (${NGAMES} partidas, nivel 4):`);
run(`
  AI_LEVELS['dinamica'] = { ...AI_LEVELS[4] };
  AI_LEVELS['plana'] = { ...AI_LEVELS[4], dynamicValues: false };
`);
// Una partida que llega al tope se adjudica por material, como hace
// entrenamiento/arena.js con las suyas (aquí, por número de piezas con un
// margen: sin regla de 50 jugadas, rematar un final ganado puede necesitar
// cientos de jugadas más y no hace falta jugarlas para saber quién domina).
const MARGEN_ADJUDICACION = 3;
let dinamica = 0, plana = 0, tablas = 0;
for (let i = 0; i < NGAMES; i++) {
  const dinBlancas = i % 2 === 0;
  const r = run(`return _partida('rps',
    '${dinBlancas ? 'dinamica' : 'plana'}', '${dinBlancas ? 'plana' : 'dinamica'}',
    1200, ${3001 + i})`);
  const piezasDin = dinBlancas ? r.piezas.w : r.piezas.b;
  const piezasPla = dinBlancas ? r.piezas.b : r.piezas.w;
  let res;
  if (r.status === 'wiped') res = (r.winner === 'w') === dinBlancas ? 'din' : 'pla';
  else if (!r.ended) {
    res = piezasDin - piezasPla >= MARGEN_ADJUDICACION ? 'din'
      : piezasPla - piezasDin >= MARGEN_ADJUDICACION ? 'pla' : 'tablas';
  } else res = 'tablas';
  if (res === 'din') dinamica++; else if (res === 'pla') plana++; else tablas++;
  const detalle = `${r.ended ? r.status : 'tope, adjudicada'}, ` +
    `${r.plies} medias jugadas, piezas ${piezasDin}-${piezasPla}`;
  console.log(`  partida ${i + 1}: ${res === 'tablas' ? 'tablas'
    : 'gana la ' + (res === 'din' ? 'dinámica' : 'plana')} (${detalle})`);
}
console.log(`  Resultado: dinámica ${dinamica} — plana ${plana} — tablas ${tablas}`);
ok(dinamica > plana, `la evaluación dinámica gana el match (${dinamica}–${plana}–${tablas})`);

console.log(fallos ? `\n${fallos} pruebas FALLADAS` : '\nTodas las pruebas pasan.');
process.exit(fallos ? 1 : 0);
