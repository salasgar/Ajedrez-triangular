// tune-values.js — Ajusta los valores de las piezas (engine.pieceValues de
// cada modalidad, en variants.js; se elige con --variant=ID)
// aprendiendo de partidas de autojuego, con el método tipo Texel: en vez de
// hacer competir "individuos" (algoritmo genético, muy lento porque cada
// partida entera solo da un bit de señal), se genera un corpus de posiciones
// con el resultado final de su partida y se ajustan los pesos por descenso
// de gradiente sobre ese corpus ya guardado — sin jugar nada más.
//
// Herramienta de desarrollo, se ejecuta a mano: `node tune-values.js`.
// No toca ai.js; solo imprime los valores sugeridos.

'use strict';
const fs = require('fs');
const path = require('path');

// --- argumentos de línea de comandos (todos opcionales) ---
// --level=N     : usa el nivel N real de AI_LEVELS (con quiescence, tabla de
//                 transposición, etc., tal cual juega hoy) para el autojuego,
//                 en vez del SELF_PLAY_CFG de abajo. Pensado para comparar si
//                 los valores ajustados salen parecidos autojugando con
//                 distintos niveles reales (ver README de la sesión / plan).
// --minutes=M   : en vez de jugar N_GAMES partidas fijas, juega tantas como
//                 quepan en M minutos. Imprescindible para niveles lentos
//                 (5+), donde no se puede predecir de antemano cuántas
//                 partidas caben en un tiempo razonable.
// --fifty=N     : medias jugadas antes de tablas por la regla de los 50
//                 movimientos durante el autojuego (ver FIFTY_MOVE_LIMIT en
//                 rules.js). Por defecto 30 (15 jugadas completas): mucho
//                 más corto que el reglamentario 100, para no perder tiempo
//                 en partidas ya estancadas — solo afecta a este script, el
//                 juego real sigue arrancando en 100.
// --guardar-partidas=DIR : guarda todas las partidas del autojuego en
//                 DIR/partidas-<fecha>.jsonl, una por línea, para poder
//                 analizarlas después. Se guardan TAMBIÉN las descartadas
//                 (las que no entran al corpus), que suelen ser las más
//                 informativas cuando el ajuste sale raro. Formato compacto:
//                 solo la lista de jugadas (~3 KB por partida, ~5 MB la
//                 tanda entera), que replay.js vuelve a convertir en un
//                 guardado cargable desde la web para verla jugada a jugada.
function argValue(name, def) {
  const arg = process.argv.find(a => a.startsWith('--' + name + '='));
  return arg ? arg.slice(name.length + 3) : def;
}
const CLI_LEVEL = argValue('level', null);
const CLI_MINUTES = argValue('minutes', null);
// --variant=ID : qué modalidad se ajusta (salas por defecto). Cada una tiene su
// juego de piezas, así que sus valores se ajustan por separado.
const CLI_VARIANT = argValue('variant', 'salas');
const FIFTY_LIMIT_TRAINING = Number(argValue('fifty', 30));
const SAVE_GAMES_DIR = argValue('guardar-partidas', null);

// --- parámetros del experimento ---
const N_GAMES = 1500;        // nº de partidas si no se da --minutes (~20 min en total)
// Config de autojuego por defecto (sin --level): profundidad 2 (ve la
// respuesta del rival) + orden de jugadas para que la poda alfa-beta sea
// efectiva y no se dispare el coste. El ajuste de MATERIAL es robusto
// incluso con un motor ciego a 1 jugada (nivel 2, "codicioso"): una pieza
// capturada cuenta igual la vea venir o no quien la pierde. Pero el ajuste
// POSICIONAL (centralidad, avance de peones) no lo es: un motor a 1 jugada
// avanza y centraliza piezas sin comprobar si el rival se las puede comer a
// continuación, así que en su autojuego "estar avanzado/centralizado"
// tiende a significar "a punto de perderse la pieza" — el corpus sale con
// el signo cambiado (se comprobó: con profundidad 1 los seis pesos de
// centralidad y el de avance de peón salían negativos y muy estables, no
// era ruido de muestra pequeña). Con profundidad 2 el motor al menos ve si
// la casilla de destino queda a tiro, lo que basta para que el signo tenga
// sentido.
const SELF_PLAY_CFG = { depth: 2, order: true };
// Peso de movilidad de hoy: el término fijo sobre el que la regresión ajusta
// el material, así que tiene que ser el que de verdad usa evaluate(). Lo pone
// la modalidad (engine.mobility), y se rellena tras cargar variants.js —estaba
// congelado en 2 desde antes de que la arena confirmara el 4, y con el número
// equivocado el material sale sesgado.
let MOBILITY_DEFAULT = 4;
// factor de normalización de la característica de movilidad, ver
// mobilityDiff() dentro de driverSrc
const MOBILITY_SCALE = 10;
const MAX_PLIES = 160;        // corte de seguridad: por encima, la partida se descarta
// guarda una posición de cada SAMPLE_STRIDE medias jugadas: posiciones
// consecutivas casi no varían, así que muestrear muy seguido solo añade
// puntos muy correlados entre sí (y hace el ajuste más inestable) sin
// aportar información nueva
const SAMPLE_STRIDE = 8;
const K = 1 / 400;            // escala inicial de la sigmoide, ver fitValues()
const LEARNING_RATE = 5;
const ITERATIONS = 800;
// Cuánto se tira el ajuste hacia los valores actuales de PIECE_VALUE en vez
// de hacia lo que diga el corpus. Sin esto, los 6 valores quedan muy
// correlados entre sí dentro de una misma partida (p. ej. torre y dama
// suelen cambiar de manos en las mismas fases) y el ajuste sin restricciones
// da valores inestables, con signos que no tienen sentido (piezas con valor
// negativo). Más bajo = se fía más de los datos (arriesga inestabilidad,
// sobre todo con N_GAMES pequeño); más alto = se queda más cerca de hoy.
const REGULARIZATION = 0.02;

// Piezas que se ajustan: las de la modalidad menos el rey (que vale 0). No se
// puede fijar aquí porque la modalidad aún no está cargada: se rellena justo
// después del eval de más abajo.
let PIECES = [];

// --- cargar geometry.js + rules.js + ai.js en un único ámbito compartido ---
// Estos tres ficheros son scripts clásicos (const/let de nivel superior, sin
// module.exports) pensados para compartir el ámbito global vía <script> en
// el navegador. Un solo eval() sobre el código concatenado hace visibles sus
// declaraciones al código añadido a continuación, sin tocar los ficheros.
const dir = __dirname;
const gameSrc = ['geometry.js', 'variants.js', 'rules.js', 'ai.js']
  .map(f => fs.readFileSync(path.join(dir, f), 'utf8'))
  .join('\n');

// Diferencia de material (blancas − negras) por tipo de pieza, en el orden
// de PIECES. Es la misma cuenta que evaluate() en ai.js, separada por tipo.
function materialDiff(board) {
  const diff = PIECES.map(() => 0);
  for (const [, p] of board) {
    const idx = PIECES.indexOf(p.type);
    if (idx === -1) continue;   // el rey no se cuenta
    diff[idx] += p.color === 'w' ? 1 : -1;
  }
  return diff;
}

// Vector de características de cada posición sampleada: una de material por
// tipo de pieza + una de centralidad por tipo (mismo orden que PIECES) + 1 de
// avance de peones + 1 de movilidad total. positionalDiff()/mobilityDiff()
// se definen dentro de driverSrc (más abajo) porque necesitan
// centrality()/pawnAdvance()/pseudoMoves()/CELL_MAP, que solo existen
// dentro del eval de gameSrc; aquí solo se documenta el orden del vector.
//
// Es una función y no una constante porque PIECES depende de la modalidad y
// no se conoce hasta después de cargar variants.js.
function featureNames() {
  return [...PIECES, ...PIECES.map(p => p + '(centralidad)'),
    'peones(avance)', 'movilidad'];
}

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

// Descenso de gradiente por lotes sobre la regresión logística
// sigmoid(Σ valor_i · diff_i) ≈ resultado (K ya viene absorbida en la escala
// inicial de `initialWeights`, ver más abajo). Como el eval es lineal en los
// pesos, el gradiente tiene forma cerrada y no hace falta jugar nada más:
// todo el ajuste corre sobre el corpus ya guardado.
//
// El peón (índice 0, ver PIECES) se deja fijo como ancla: solo se ajustan
// los otros 5 valores relativos a él. Sin un ancla, la normalización final
// (pegar el peón a 100) amplifica cualquier ruido en su propio valor
// ajustado, y con un corpus de este tamaño resulta muy inestable.
function fitValues(dataset, initialWeights) {
  const w = initialWeights.slice();

  for (let it = 0; it < ITERATIONS; it++) {
    const grad = w.map(() => 0);
    for (const { diff, label } of dataset) {
      let evalScore = 0;
      for (let i = 0; i < w.length; i++) evalScore += w[i] * diff[i];
      const pred = sigmoid(evalScore);
      const coef = (pred - label) * pred * (1 - pred);
      for (let i = 0; i < w.length; i++) grad[i] += coef * diff[i];
    }
    for (let i = 1; i < w.length; i++) {   // i=0 (peón) se queda fijo
      const reg = 2 * REGULARIZATION * (w[i] - initialWeights[i]);
      w[i] -= LEARNING_RATE * (grad[i] / dataset.length + reg);
    }
  }
  return w;
}

function report(w, centralityBase, advanceBase, mobBase) {
  // normaliza para que el peón siga valiendo 100, como hoy (ya está fijo en
  // su valor inicial escalado por K, así que esto solo deshace esa escala).
  // Las 14 componentes de w comparten la misma escala interna (todas entran
  // en el mismo Σ w_i·diff_i de la sigmoide), así que un único factor sirve
  // para reescalar material, posición y movilidad por igual.
  const pawnIdx = PIECES.indexOf('P');
  const scale = 100 / w[pawnIdx];
  const scaled = w.map(v => v * scale);
  let material = scaled.slice(0, PIECES.length);
  let centralityW = scaled.slice(PIECES.length, 2 * PIECES.length);
  let advanceW = scaled[2 * PIECES.length];
  let mobilityW = scaled[2 * PIECES.length + 1];

  // Deshacer la referencia que positionalDiff resta a cada pieza. El ajuste
  // modela  Σ w_cent·(centralidad − base),  mientras que evaluate() suma
  // w_cent·centralidad en bruto; la diferencia, −w_cent·base por pieza, es una
  // constante por pieza, es decir, parte del VALOR de la pieza. Pasarla al
  // material deja una evaluación idénticamente equivalente pero expresada como
  // la espera evaluate().
  // ídem para la movilidad media de cada tipo (ver el centrado en run()):
  // −w_mov·media[tipo] por pieza también es una constante por pieza
  const mobilityPerMove = mobilityW / MOBILITY_SCALE;
  material = material.map((v, i) =>
    v - centralityW[i] * centralityBase - mobilityPerMove * mobBase[i]);
  material[pawnIdx] -= advanceW * advanceBase;

  // el traspaso mueve el valor del peón, así que se renormaliza a 100. Escalar
  // todos los pesos por un mismo factor no cambia qué jugada prefiere
  // evaluate(), solo las unidades.
  const renorm = 100 / material[pawnIdx];
  material = material.map(v => v * renorm);
  centralityW = centralityW.map(v => v * renorm);
  advanceW *= renorm;
  mobilityW *= renorm;

  // igual que material/posición, pero deshaciendo también MOBILITY_SCALE
  // para que este número ya sea comparable al 2 de hoy
  const displayValues = [...material, ...centralityW, advanceW,
    mobilityW / MOBILITY_SCALE];
  console.log('Valores ajustados (en bruto):');
  featureNames().forEach((name, i) => console.log(`  ${name}: ${displayValues[i].toFixed(2)}`));

  // Son SUGERENCIAS, no un cambio listo para producción: la regresión
  // minimiza el error de predecir el resultado, no la fuerza de juego. Antes
  // de reemplazar PIECE_VALUE (o el peso de movilidad por defecto) en ai.js
  // hay que confirmar el candidato en un match emparejado contra los valores
  // vigentes (ver arena.js/analiza.js en el historial). Así se descubrió que
  // los pesos posicionales de abajo eran ruido y que la movilidad la aprendía
  // en el sentido contrario.
  console.log('\nRedondeados (candidato para engine.pieceValues de la modalidad' +
    ' «' + V.id + '» en variants.js, a confirmar):');
  const rounded = {};
  PIECES.forEach((p, i) => { rounded[p] = Math.round(material[i]); });
  const line = 'pieceValues: { ' +
    PIECES.map(p => `${p}: ${rounded[p]}`).join(', ') + ', K: 0 },';
  console.log('  ' + line);

  console.log('\nPesos posicionales sugeridos (centralidad/avance; ojo: en la' +
    ' confirmación salieron ruido, +12 elo p=0,62):');
  const roundedAdvance = Math.round(advanceW);
  const posLines = PIECES.map((p, i) => {
    const parts = [`centrality: ${Math.round(centralityW[i])}`];
    if (p === 'P') parts.push(`advance: ${roundedAdvance}`);
    return `  ${p}: { ${parts.join(', ')} },`;
  });
  console.log('{\n' + posLines.join('\n') + '\n}');

  // mobilityW está en unidades de la característica normalizada (dividida
  // por MOBILITY_SCALE en mobilityDiff); deshacer esa división para obtener
  // el peso real por jugada disponible, comparable al 4 por defecto de ai.js
  const mobilityReal = mobilityW / MOBILITY_SCALE;
  console.log(`\nPeso de movilidad sugerido: ${mobilityReal.toFixed(2)}  (por` +
    ` defecto en ai.js: 4; la regresión tiende a subestimarlo, confírmalo en la arena)`);
}

// El bucle de autojuego (`run`) va dentro del mismo eval que gameSrc: así ve
// sus declaraciones (newGame, game, chooseAiMove, movesForSide, makeMove,
// gameEnded, PIECE_VALUE...) sin necesidad de exportarlas. `run`, a su vez,
// sí puede llamar libremente a las funciones normales de este módulo
// (materialDiff, fitValues, report y las constantes de arriba): el código
// evaluado siempre puede leer el ámbito desde el que se invocó, aunque no
// pueda filtrar sus propias declaraciones hacia fuera.
const driverSrc = `
// Referencias de "colocación neutra": la centralidad media de una casilla del
// tablero, y el avance de un peón a mitad de camino. Ver positionalDiff.
const CENTRALITY_BASE = CELLS.reduce((s, c) => s + centrality(c), 0) / CELLS.length;
const ADVANCE_BASE = 0.5;   // simétrico: avance(w) + avance(b) = 1 en la misma casilla

// Diferencia de centralidad por tipo de pieza + diferencia de avance de
// peones (blancas − negras), en ese orden. Va dentro del eval porque usa
// centrality()/pawnAdvance()/CELL_MAP, definidas en ai.js/geometry.js.
//
// Cada pieza aporta su centralidad MENOS la de una casilla media, no la
// centralidad en bruto. Sin esa resta, la característica es una suma que crece
// con el NÚMERO de piezas, así que mide sobre todo material — justo lo que ya
// miden las seis características de material. Esa colinealidad hacía que el
// ajuste explicase "más piezas = ganar" con el material (anclado a PIECE_VALUE
// por la regularización) y dejase a la centralidad un residuo negativo: salían
// pesos posicionales negativos corrida tras corrida, aunque el autojuego fuese
// limpio. Restando la referencia, un bando con muchas piezas colocadas del
// montón aporta ~0 y la característica mide COLOCACIÓN, no cantidad.
// report() deshace la resta para que los valores impresos sigan sirviendo tal
// cual en evaluate(), que suma la bonificación en bruto pieza a pieza.
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

// Diferencia de movilidad total (blancas − negras): la misma cuenta que
// evaluate() hace pieza a pieza, aquí sin ponderar (el peso lo pone
// fitValues). Va dentro del eval porque usa pseudoMoves()/CELL_MAP.
// Se divide por MOBILITY_SCALE: la diferencia de movilidad ronda decenas
// (muchas más jugadas posibles que piezas de diferencia hay normalmente),
// mientras que el material ronda unidades — con la misma escala que el
// material, la MISMA REGULARIZATION tira de este peso mucho más flojo en
// proporción (el gradiente y el término de regularización no "compiten" en
// pie de igualdad si las características tienen escalas muy distintas), y
// el peso salía disparado e inestable entre corridas (550, luego -243,
// luego 130). report() deshace esta escala al final.
// Acumuladores para la movilidad media de cada tipo de pieza, con los que
// run() centra esta característica una vez generado el corpus.
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
  return m;   // en bruto: run() la centra y le aplica MOBILITY_SCALE
}

// El autojuego usa directamente chooseAiMove (ai.js), que ya sortea entre las
// jugadas dentro de PLAY_TOLERANCE centipeones de la mejor: el entrenamiento
// juega exactamente como juega el ordenador de verdad, sin criterio propio.
//
// Historia de este punto, porque el equilibrio es delicado. Primero fue
// EPSILON (jugada uniforme al azar en cualquier momento de la partida), que
// metía posiciones caóticas: disparaban quiesce() en niveles 4+ y cambiaban el
// signo de las features posicionales (una pieza "avanzada" justo antes de un
// blunder correlaciona con perder). Lo sustituyó un umbral relativo sobre la
// probabilidad de victoria sigmoid(K·score), muestreando proporcional a ella;
// tenía que ir en espacio de PROBABILIDAD y no de puntuación bruta porque un
// porcentaje aplicado a un score negativo se rompe (0.95·(-300) = -285 es
// MEJOR que -300, excluiría a la propia mejor jugada). Ya entonces se vio que
// aflojar el umbral no compraba diversidad y sí partidas flojas: con 0.85 un
// 24% de las partidas vagaba hasta el corte de MAX_PLIES sin concluir
// (descartadas), y con 0.95 bajaba al ~5%, con las mismas aperturas ~100%
// distintas. La banda absoluta de PLAY_TOLERANCE es más estrecha todavía en
// casi toda posición, así que va en esa misma dirección buena, y de paso
// evita el problema del signo (25 centipeones son 25 tanto arriba como abajo
// del cero) y ahorra la segunda pasada de búsqueda que exigía el umbral.

function run() {
  // durante el entrenamiento, tablas por la regla de los 50 movimientos
  // mucho antes que en una partida real (ver FIFTY_LIMIT_TRAINING arriba)
  FIFTY_MOVE_LIMIT = FIFTY_LIMIT_TRAINING;

  // autojuego: con --level=N, el nivel N real de AI_LEVELS (tal cual juega
  // hoy, con quiescence/TT/etc.); si no, el SELF_PLAY_CFG de este script
  const selfPlayLevel = CLI_LEVEL ? Number(CLI_LEVEL) : 'tuning';
  if (!CLI_LEVEL) AI_LEVELS.tuning = SELF_PLAY_CFG;

  // sin --minutes, juega N_GAMES partidas fijas; con --minutes, tantas como
  // quepan en ese tiempo (necesario para niveles lentos, donde no se puede
  // predecir de antemano cuántas partidas caben)
  const budgetMs = CLI_MINUTES ? Number(CLI_MINUTES) * 60000 : null;
  const t0 = Date.now();

  // { diff: [material×6, centralidad×6, avance×1, movilidad×1] desde el
  // punto de vista de blancas, label }
  const dataset = [];
  let g = 0;             // partidas usadas (terminan de verdad)
  let attempted = 0;     // partidas jugadas (incluidas las descartadas)
  const discarded = { fifty: 0, maxplies: 0 };

  // --guardar-partidas: un .jsonl por corrida, abierto en modo añadir y
  // escrito partida a partida, para que una tanda interrumpida conserve todo
  // lo jugado hasta ese momento.
  let saveFd = null;
  if (SAVE_GAMES_DIR) {
    fs.mkdirSync(SAVE_GAMES_DIR, { recursive: true });
    const nombre = 'partidas-' + new Date().toISOString().replace(/[:.]/g, '-') + '.jsonl';
    saveFd = fs.openSync(path.join(SAVE_GAMES_DIR, nombre), 'a');
    process.stderr.write('  guardando partidas en ' +
      path.join(SAVE_GAMES_DIR, nombre) + '\\n');
  }

  while (true) {
    if (budgetMs ? (Date.now() - t0 >= budgetMs) : (g >= N_GAMES)) break;
    newGame();
    const featuresThisGame = [];
    const jugadas = [];
    let plies = 0;
    let aborted = false;

    while (!gameEnded() && plies < MAX_PLIES) {
      // una partida puede acercarse a MAX_PLIES aunque se haya acortado la
      // regla de los 50; comprobar el presupuesto solo entre partidas no
      // basta — una sola puede agotarlo entera. Se mira en cada jugada y, si
      // se acaba el tiempo a medias, esa partida se descarta entera (no se
      // conoce su resultado).
      if (budgetMs && Date.now() - t0 >= budgetMs) { aborted = true; break; }
      const mv = chooseAiMove(selfPlayLevel);
      if (!mv) break;   // sin jugadas (gameEnded ya lo cubre, por si acaso)
      makeMove(mv.from, mv.to);
      if (saveFd) jugadas.push(mv.from + '>' + mv.to);
      plies++;

      if (plies % SAMPLE_STRIDE === 0) {
        featuresThisGame.push([...materialDiff(game.board), ...positionalDiff(game.board),
          mobilityDiff(game.board)]);
      }
    }
    if (aborted) break;   // presupuesto agotado a media partida: se descarta

    attempted++;

    if (saveFd) {
      const concluyente = game.status === 'checkmate' || game.status === 'stalemate' ||
        game.status === 'repetition';
      fs.writeSync(saveFd, JSON.stringify({
        n: attempted, status: game.status, winner: game.winner || null,
        plies, usada: concluyente, nivel: selfPlayLevel, jugadas,
      }) + '\\n');
    }

    // solo cuentan las partidas que terminan de verdad: mate, ahogado o
    // repetición. 'fifty' es artificial (regla acortada a --fifty durante el
    // entrenamiento) y un corte por MAX_PLIES deja el estado en
    // 'playing'/'check' — ninguno es un final genuino ni tiene resultado
    // fiable, así que no se añaden al corpus.
    if (game.status !== 'checkmate' && game.status !== 'stalemate' &&
        game.status !== 'repetition') {
      if (game.status === 'fifty') discarded.fifty++; else discarded.maxplies++;
      continue;
    }

    // resultado desde el punto de vista de las blancas
    let label = 0.5;
    if (game.status === 'checkmate') label = game.winner === 'w' ? 1 : 0;
    // stalemate / repetition se quedan en 0.5 (tablas)

    for (const diff of featuresThisGame) dataset.push({ diff, label });
    g++;

    if (g % 50 === 0) {
      const mins = ((Date.now() - t0) / 60000).toFixed(1);
      process.stderr.write('  ' + g + (budgetMs ? '' : '/' + N_GAMES) +
        ' partidas · ' + dataset.length + ' posiciones · ' +
        discarded.fifty + '+' + discarded.maxplies + ' descartadas · ' + mins + ' min\\n');
    }
  }

  if (saveFd) fs.closeSync(saveFd);

  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log('--- nivel de autojuego: ' + selfPlayLevel +
    (CLI_LEVEL ? ' (real, AI_LEVELS[' + selfPlayLevel + '])' : ' (' + JSON.stringify(SELF_PLAY_CFG) + ')') +
    ' · fifty=' + FIFTY_MOVE_LIMIT + ' ---');
  console.log('Corpus generado: ' + dataset.length + ' posiciones de ' + g +
    ' partidas concluyentes (de ' + attempted + ' jugadas; descartadas ' +
    discarded.fifty + ' por 50-mov y ' + discarded.maxplies + ' por MAX_PLIES) en ' + mins + ' min.\\n');
  // arranque en los valores actuales de PIECE_VALUE/MOBILITY_DEFAULT (aquí sí
  // son visibles, porque el eval que los declaró es el mismo que ejecuta
  // run()), escalados por K para que sigmoid(Σ valor_i·diff_i) parta ya en
  // un rango razonable (si no, con valores en cientos la sigmoide arranca
  // saturada en 0 o 1 y el gradiente es información nula). Los pesos
  // posicionales (centralidad y avance) no tienen un valor de hoy del que
  // partir: arrancan en 0, así que la regularización los deja en 0 salvo
  // que el corpus sí respalde un valor distinto.
  // La movilidad en bruto es una suma que crece con el número de piezas, así
  // que arrastra la misma colinealidad con el material que la centralidad (ver
  // positionalDiff). Se le resta a cada pieza la movilidad MEDIA de su tipo,
  // de modo que la característica mida "mis piezas se mueven mejor de lo
  // normal", no "tengo más piezas". Como la cuenta de piezas por tipo ya está
  // en las seis primeras componentes del vector, el centrado se puede aplicar
  // aquí, con el corpus ya generado. report() lo deshace hacia el material.
  const mobBase = PIECES.map((p, i) => (mobCount[i] ? mobTotal[i] / mobCount[i] : 0));
  const mobIdx = 2 * PIECES.length + 1;
  for (const row of dataset) {
    let centered = row.diff[mobIdx];
    for (let t = 0; t < PIECES.length; t++) centered -= mobBase[t] * row.diff[t];
    row.diff[mobIdx] = centered / MOBILITY_SCALE;
  }

  const initial = [...PIECES.map(p => PV()[p] * K), ...PIECES.map(() => 0), 0,
    MOBILITY_DEFAULT * MOBILITY_SCALE * K];
  const values = fitValues(dataset, initial);
  report(values, CENTRALITY_BASE, ADVANCE_BASE, mobBase);
}
run();
`;

// La modalidad se elige ANTES del driver: fija el tablero, el juego de piezas
// y los valores de partida del ajuste. PIECES se rellena aquí porque hasta
// este punto no existe la lista de piezas de la modalidad.
const prepSrc = `
if (!VARIANTS[${JSON.stringify(CLI_VARIANT)}]) {
  console.error('Modalidad desconocida: ${CLI_VARIANT}. Hay: ' + Object.keys(VARIANTS).join(', '));
  process.exit(1);
}
setVariant(${JSON.stringify(CLI_VARIANT)});
// El peón va SIEMPRE el primero. fitValues() deja fijo el índice 0 como ancla
// de la escala y da por hecho que ese índice es el peón; el orden que trae la
// modalidad (Object.keys de sus piezas) lo dejaba el último, así que el ancla
// caía sobre la torre y el valor del peón —el que después normaliza a 100 toda
// la tabla— quedaba suelto. Mismo orden que usa corpus.js, para que los
// vectores de los dos caminos sean intercambiables.
PIECES = ['P', ...V.pieceTypes.filter(t => t !== 'K' && t !== 'P')];
MOBILITY_DEFAULT = V.engine.mobility ?? 4;
console.log('Modalidad: ' + V.full + '   piezas: ' + PIECES.join(' ') +
  '   movilidad de hoy: ' + MOBILITY_DEFAULT);
`;

eval(gameSrc + '\n' + prepSrc + '\n' + driverSrc);
