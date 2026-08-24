// ai.js — Jugador automático con varios niveles de capacidad.
//
// Trabaja siempre sobre copias del tablero (Map) y con un estado de captura
// al paso explícito, sin tocar el objeto global `game` salvo para leerlo
// en chooseAiMove.

// Valor de cada pieza en centipeones. Vive en la modalidad (variants.js),
// porque cada una tiene su juego de piezas: el unicornio de Dekle o el alfil
// en zigzag de Koval no valen lo que las piezas de Salas. PV() devuelve los de
// la modalidad activa.
//
// SOLO LOS DE SALAS ESTÁN AJUSTADOS. Salieron de una regresión tipo Texel
// sobre autojuego (ver tune-values.js) y se CONFIRMARON en matches emparejados
// —colores invertidos, libro de aperturas fijo— contra los valores clásicos
// { P:100, N:300, B:330, E:350, R:500, Q:900 }: el material ajustado junto con
// un peso de movilidad 4 (ver evaluate) gana ~+113 elo a prof. 3 (p<0,0001,
// 134 partidas) y ~+89 a prof. 2. Antes vivían aislados en un "nivel 8
// experimental"; al quedar confirmados pasan a ser el material de todos los
// niveles.
//
// Lo que NO sobrevivió a la confirmación y por eso no está: las bonificaciones
// posicionales (centralidad/avance) que aprendió la regresión resultaron ruido
// (+12 elo, p=0,62), y el peso de movilidad 1,61 que también aprendió iba en
// el sentido CONTRARIO al que da fuerza (−81 elo); subirlo a 4 es lo que gana.
// Ver la ablación en el historial de commits.
//
// Los de Dekle y Koval son un punto de partida a ojo, a la espera de pasar por
// tune-values.js y por la arena. Ahí el motor juega correctamente, pero no se
// puede decir todavía que juegue BIEN.
function PV() { return V.engine.pieceValues; }
const MATE = 100000;
// Tope de capturas encadenadas que explora quiesce() antes de rendirse y
// devolver la evaluación tal cual. Es un cinturón de seguridad: sin poda
// por diferencia (ver DELTA_MARGIN) el número de capturas posibles en cada
// nivel puede ser alto en posiciones muy revueltas (p. ej. autojuego con
// jugadas al azar), así que aquí se prefiere un tope corto a arriesgar una
// búsqueda que tarde segundos en una sola hoja.
const QUIESCE_MAX_DEPTH = 6;
// Poda por diferencia en quiesce(): si ni ganando la pieza capturada (más
// este margen de seguridad) se alcanza alfa, no merece la pena explorar esa
// captura. El margen cubre que evaluate() no es exacto (movilidad, etc.).
const DELTA_MARGIN = 200;

// Las tablas se puntúan como ceder una fracción de la ventaja material: el
// bando que va ganando las rehúye (tanto más cuanto mayor sea su ventaja,
// hasta el tope) y el que va perdiendo las busca.
const DRAW_CONTEMPT = 0.3;
const DRAW_CAP = 500;

function drawScore(board, color, values = PV()) {
  let m = 0;
  for (const [, p] of board) m += (p.color === color ? 1 : -1) * values[p.type];
  return Math.max(-DRAW_CAP, Math.min(DRAW_CAP, Math.round(-DRAW_CONTEMPT * m)));
}

// nivel → configuración de búsqueda. `quiesce` solo se activa a partir del
// nivel 4: en autojuego muy revuelto (p. ej. tune-values.js, que mezcla
// jugadas al azar) puede haber muchas capturas posibles a la vez, y en los
// niveles 1-3 (pensados para ser simples y rápidos, no fuertes) el coste no
// compensa la mejora táctica.
// NIVELES POR PRESUPUESTO DE NODOS, no por profundidad.
//
// La escalera anterior fijaba la profundidad, y eso la hacía a saltos: cada
// escalón multiplicaba el trabajo por 4-6, y medido en la arena los huecos
// eran de 300 a 1000 elo entre niveles contiguos. Con un presupuesto de
// nodos el mando es continuo, así que los peldaños se pueden repartir a
// gusto (aquí, cada uno ~3,7 veces el anterior).
//
// Además reparte el esfuerzo mejor: al bajar el número de piezas baja la
// ramificación, así que el mismo presupuesto profundiza mucho más en los
// finales, que es donde hace falta mirar lejos. La profundidad fija hacía lo
// contrario. Por eso `depth` va aquí como TOPE ALTO (24) que no debe llegar a
// estorbar: quien manda es `nodes`.
//
// Los dos niveles bajos llevan además `temperature`: sin ella, un motor con
// quietud no cuelga piezas ni pensando poco, y el principiante se queda sin
// rival asequible. La temperatura hace que se equivoque de verdad, que es lo
// que distingue a un jugador flojo de uno que solo mira poco.
const TOPE_PROF = 24;
const BASE_NIVEL = { depth: TOPE_PROF, mobility: true, order: true, quiesce: true };
const AI_LEVELS = {
  1: { random: true },                                    // al azar
  2: { ...BASE_NIVEL, nodes: 300, temperature: 150 },
  // 5.000 y no 1.200: con temperatura la búsqueda va con ventana completa y
  // cuesta 2-3 veces más, así que con 1.200 no pasaba de profundidad 1 y este
  // nivel era el 2 con otra temperatura. Con 5.000 llega a profundidad 2.
  3: { ...BASE_NIVEL, nodes: 5000, temperature: 70 },
  4: { ...BASE_NIVEL, nodes: 4500 },
  5: { ...BASE_NIVEL, nodes: 16000 },
  6: { ...BASE_NIVEL, nodes: 60000 },
  7: { ...BASE_NIVEL, nodes: 220000 },
  8: { ...BASE_NIVEL, nodes: 800000 },                    // lento
};

// Centralidad de una casilla: 1 en el centro del tablero, 0 en el borde.
// cx/cy ya vienen calculados por geometry.js. El máximo depende del tablero,
// así que se cachea por modalidad en vez de calcularse al cargar el fichero.
let boardMaxDist = { id: null, d: 1 };
function centrality(cell) {
  if (boardMaxDist.id !== V.id) {
    boardMaxDist = { id: V.id, d: Math.max(...CELLS.map(c => Math.hypot(c.cx, c.cy))) };
  }
  return 1 - Math.hypot(cell.cx, cell.cy) / boardMaxDist.d;
}

// Avance de un peón hacia la coronación: 0 en su casilla de salida, 1 al
// coronar. Lo precalcula variants.js, que es quien sabe hacia dónde corona
// cada modalidad (en el hexágono, la fila del borde rival; en Trigonal, el
// extremo contrario del propio carril).
function pawnAdvance(cell, color) { return cell.pawnProg[color]; }

// --- Evaluación de las modalidades Piedra, papel y tijera (V.captures) -----
//
// En estas modalidades todas las figuras se mueven igual, así que su valor no
// puede venir de la tabla de movimientos: viene de la matriz de capturas y de
// lo que quede vivo. Una piedra vale por las tijeras rivales que puede cazar
// y vale menos cuantos más papeles rivales la cazan a ella; si no le queda
// ninguna presa, cae a un suelo pequeño pero no nulo (sigue bloqueando y
// ocupando espacio). Es la consideración 1 del diseñador («Nuevas variantes
// del juego.txt»): el valor de cada pieza se modifica según el número de
// piedras, papeles y tijeras que queden en cada momento.
//
// La fórmula, lineal y barata (los recuentos por tipo y color se hacen en la
// misma pasada que ya da la movilidad):
//
//   valor(tipo) = RPS_VALOR_SUELO                     si presasVivas = 0
//   valor(tipo) = max(RPS_VALOR_SUELO,
//     RPS_VALOR_BASE + RPS_PESO_PRESA · presasVivas
//                    − RPS_PESO_DEPREDADOR · depredadoresVivos)   si no
//
// donde presas/depredadores se cuentan entre las piezas RIVALES vivas. El rey
// de las modalidades -rey queda fuera de los recuentos y conserva su
// tratamiento especial de siempre (pieceValues.K, el jaque y el mate).
//
// Además, un término de amenazas: estar en el radio de un depredador rival es
// peligro, y aquí «defender» no es lo del ajedrez —la matriz no es simétrica:
// la pieza atacada normalmente NO puede comerse a su atacante—, sino tener
// una pieza propia que pueda capturar al atacante si consuma la amenaza. Una
// pieza atacada sin esa respuesta está colgada de verdad.
//
// PESOS PROVISIONALES a la espera de la arena (la sesión siguiente ajustará
// posiciones iniciales y podrá tunearlos): todos con nombre y en un sitio.
const RPS_VALOR_BASE = 60;        // valor de partida de una figura
const RPS_PESO_PRESA = 12;        // + por cada pieza rival que puede capturar
const RPS_PESO_DEPREDADOR = 4;    // − por cada pieza rival que puede capturarla
const RPS_VALOR_SUELO = 25;       // mínimo: bloquear y ocupar espacio vale algo
const RPS_AMENAZA = 0.2;          // fracción del valor perdida si un depredador
                                  // la ataca pero el atacante tiene respuesta
const RPS_AMENAZA_COLGADA = 0.6;  // fracción si nadie puede capturar al atacante
// Término de caza (solo kingless): bonificación por tener depredadores cerca
// de cada presa rival, decreciente con la distancia (0 en la otra punta del
// tablero, el peso entero al lado). Sin él, dos motores prudentes maniobran
// sin acercarse NUNCA: no hay regla de 50 jugadas que fuerce nada y las
// partidas no terminan; con él, el bando que va ganando tiene un gradiente
// que le lleva a acorralar (todas las piezas corren lo mismo, así que cazar
// exige arrinconar, y eso a la profundidad de un nivel medio no sale sin
// ayuda de la evaluación).
const RPS_PESO_CAZA = 30;
// Factor de «ya no puedo ganar» (solo kingless): la ventaja del bando que ya
// no puede eliminar al rival (ver el techo en evaluateRps) se multiplica por
// esto. No se recorta a tablas en seco porque eso aplana la evaluación y el
// bando que SÍ puede ganar se queda sin gradiente que seguir.
const RPS_SIN_VICTORIA = 0.1;

// Tablas derivadas de V.captures, cacheadas en la propia modalidad (V viaja
// clonada al worker con la caché o sin ella; se reconstruye sola):
//   presas/depredadores por tipo SIN el rey (para el valor dinámico),
//   capturadoPor con el rey (para las amenazas: el rey rival sí amenaza),
//   bit/preyMask (máscaras por tipo para la posición muerta sin recorridos).
function rpsInfo() {
  if (V._rpsInfo) return V._rpsInfo;
  const caps = V.captures;
  const tipos = Object.keys(caps);
  const bit = {}, preyMask = {}, capturadoPor = {};
  tipos.forEach((t, i) => { bit[t] = 1 << i; capturadoPor[t] = []; });
  for (const a of tipos) {
    let m = 0;
    for (const v of caps[a]) { m |= bit[v]; capturadoPor[v].push(a); }
    preyMask[a] = m;
  }
  // máscara de los tipos que pueden capturar a cada tipo (para saber con dos
  // AND si a una pieza le queda algún verdugo vivo)
  const capturadoPorMask = {};
  for (const t of tipos) {
    let m = 0;
    for (const a of capturadoPor[t]) m |= bit[a];
    capturadoPorMask[t] = m;
  }
  const figuras = tipos.filter(t => t !== 'K');
  const presas = {}, depredadores = {};
  for (const t of figuras) {
    presas[t] = caps[t].filter(v => v !== 'K');
    depredadores[t] = capturadoPor[t].filter(a => a !== 'K');
  }
  // para el término de caza: diámetro del tablero (normaliza la distancia) y
  // caché perezosa de distancias entre casillas, indexada por par de idx
  let radio = 0;
  for (const c of CELLS) radio = Math.max(radio, Math.hypot(c.cx, c.cy));
  const nCells = CELLS.length;
  return (V._rpsInfo = { tipos, figuras, bit, preyMask, capturadoPor,
                         capturadoPorMask, presas, depredadores,
                         diam: 2 * radio, nCells,
                         dist: new Float32Array(nCells * nCells) });
}

// Distancia euclídea entre dos casillas, cacheada en la tabla de rpsInfo
// (0 significa «sin calcular»: dos casillas distintas nunca distan 0).
function rpsDist(info, a, b) {
  const i = a.idx * info.nCells + b.idx;
  let d = info.dist[i];
  if (d === 0 && a !== b) {
    d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
    info.dist[i] = d;
  }
  return d;
}

// Valor dinámico del tipo `t` dado el recuento de piezas rivales vivas por
// tipo. Ver la fórmula y los pesos arriba. Sin ninguna presa viva el valor es
// el suelo directamente: en estas modalidades los tipos extinguidos no
// vuelven (no hay coronación), así que esa pieza no capturará nunca más y
// solo le queda bloquear y ocupar espacio.
function rpsValor(t, cntRival) {
  const info = rpsInfo();
  let presas = 0, depred = 0;
  for (const v of info.presas[t]) presas += cntRival[v] || 0;
  for (const a of info.depredadores[t]) depred += cntRival[a] || 0;
  if (presas === 0) return RPS_VALOR_SUELO;
  return Math.max(RPS_VALOR_SUELO,
    RPS_VALOR_BASE + RPS_PESO_PRESA * presas - RPS_PESO_DEPREDADOR * depred);
}

// Posición muerta sin rey (la versión barata de deadPositionKingless, en
// rules.js, con la que tiene que coincidir): la partida está muerta cuando
// ningún bando puede ya eliminar al otro, es decir, cuando a AMBOS les queda
// algún tipo vivo sin ningún verdugo vivo enfrente (los tipos extinguidos no
// vuelven: no hay coronación). Una pasada y máscaras de tipo, sin Sets ni
// bucles anidados: se paga en cada nodo de la búsqueda.
function rpsDeadPosition(board) {
  const info = rpsInfo();
  let mw = 0, mb = 0;
  for (const [, p] of board) {
    if (p.color === 'w') mw |= info.bit[p.type]; else mb |= info.bit[p.type];
  }
  // un bando sin piezas no es posición muerta: es la victoria por
  // eliminación ('wiped'), y de esa se ocupan la evaluación y el nodo sin
  // jugadas (llamar a esto tablas haría que la búsqueda evitara rematar)
  if (mw === 0 || mb === 0) return false;
  let inmortalW = false, inmortalB = false;
  for (const t of info.tipos) {
    const b = info.bit[t];
    if ((mw & b) && !(info.capturadoPorMask[t] & mb)) inmortalW = true;
    if ((mb & b) && !(info.capturadoPorMask[t] & mw)) inmortalB = true;
  }
  return inmortalW && inmortalB;
}

// ¿Puede alguna pieza de `color` capturar a la pieza de tipo `tipo` que está
// en la casilla `cell`? Mira desde la casilla hacia fuera con las tablas
// inversas de saltos (todas las figuras RPS son saltadoras); es la noción de
// «defensa» de estas modalidades: responder al atacante comiéndoselo.
function rpsContraataque(board, cell, tipo, color) {
  const info = rpsInfo();
  for (const d of info.capturadoPor[tipo]) {
    const desde = cell.leapAttackers[d];
    if (!desde) continue;
    for (const t of desde) {
      const o = board.get(t.key);
      if (o && o.color === color && o.type === d) return true;
    }
  }
  return false;
}

// La evaluación de las modalidades con matriz de capturas: material con los
// valores dinámicos de arriba, movilidad (contando solo destinos legales: a
// diferencia de countPseudoMoves, aquí una casilla ocupada por un rival
// incomible NO es jugada) y amenazas. Una única pasada por el tablero; los
// valores se calculan al final a partir de los recuentos (a lo sumo 6 tipos).
function evaluateRps(board, color, cfg) {
  const info = rpsInfo();
  const values = cfg.pieceValues || PV();
  const mobilityWeight = cfg.mobilityWeight ?? 4;
  const cnt = { w: {}, b: {} };          // piezas vivas por color y tipo
  const ame = { w: {}, b: {} };          // amenazadas con respuesta posible
  const col = { w: {}, b: {} };          // amenazadas sin respuesta (colgadas)
  for (const t of info.tipos) {
    cnt.w[t] = 0; cnt.b[t] = 0;
    ame.w[t] = 0; ame.b[t] = 0;
    col.w[t] = 0; col.b[t] = 0;
  }
  let mob = 0;                           // movilidad con signo (blancas − negras)
  // posiciones por bando, solo si hace falta el término de caza (kingless)
  const conCaza = V.kingless;
  const cW = [], tW = [], cB = [], tB = [];
  for (const [key, p] of board) {
    const sw = p.color === 'w' ? 1 : -1;
    cnt[p.color][p.type]++;
    const cell = CELL_MAP.get(key);
    if (conCaza) {
      if (p.color === 'w') { cW.push(cell); tW.push(p.type); }
      else { cB.push(cell); tB.push(p.type); }
    }
    if (cfg.mobility) {
      const leaps = cell.leaps[p.type];
      if (leaps) {
        for (const t of leaps) {
          const o = board.get(t.key);
          if (!o || (o.color !== p.color && canCapture(p.type, o.type))) mob += sw;
        }
      } else {
        mob += sw * countPseudoMoves(board, cell, p);   // por si acaso; no pasa hoy
      }
    }
    // amenazas sobre las figuras (el rey no: de su seguridad se ocupa el
    // jaque de la búsqueda): ¿hay un depredador rival a un salto?
    if (p.type !== 'K') {
      const foe = p.color === 'w' ? 'b' : 'w';
      let amenazada = false, colgada = false;
      for (const a of info.capturadoPor[p.type]) {
        const desde = cell.leapAttackers[a];
        if (!desde) continue;
        for (const t of desde) {
          const o = board.get(t.key);
          if (!o || o.color !== foe || o.type !== a) continue;
          amenazada = true;
          if (!rpsContraataque(board, t, a, p.color)) { colgada = true; break; }
        }
        if (colgada) break;
      }
      if (colgada) col[p.color][p.type]++;
      else if (amenazada) ame[p.color][p.type]++;
    }
  }
  // quedarse sin piezas es la derrota ('wiped'); verlo ya en la hoja evita
  // que la quietud puntúe una eliminación como simple material
  if (V.kingless) {
    let mias = 0, suyas = 0;
    for (const t of info.tipos) {
      if (color === 'w') { mias += cnt.w[t]; suyas += cnt.b[t]; }
      else { mias += cnt.b[t]; suyas += cnt.w[t]; }
    }
    if (mias === 0) return -MATE;
    if (suyas === 0) return MATE;
  }
  // todo se acumula desde las blancas y se cambia el signo al final
  let score = cfg.mobility ? mobilityWeight * mob : 0;
  for (const t of info.figuras) {
    const vw = rpsValor(t, cnt.b);       // el valor blanco depende de lo negro
    const vb = rpsValor(t, cnt.w);
    score += cnt.w[t] * vw - cnt.b[t] * vb;
    score -= RPS_AMENAZA * (ame.w[t] * vw - ame.b[t] * vb) +
             RPS_AMENAZA_COLGADA * (col.w[t] * vw - col.b[t] * vb);
  }
  // el rey de las -rey, con su valor de tabla de siempre (0 por defecto)
  if (cnt.w.K !== undefined) score += values.K * (cnt.w.K - cnt.b.K);
  // caza: por cada presa, bonificación al bando rival según lo cerca que
  // tenga su depredador más próximo (ver RPS_PESO_CAZA)
  if (conCaza) {
    let caza = 0;                        // blancas − negras
    for (let i = 0; i < cW.length; i++) {
      const cazadores = info.depredadores[tW[i]];
      let dmin = Infinity;
      for (let j = 0; j < cB.length; j++) {
        if (cazadores.indexOf(tB[j]) < 0) continue;
        const d = rpsDist(info, cW[i], cB[j]);
        if (d < dmin) dmin = d;
      }
      if (dmin < Infinity) caza -= RPS_PESO_CAZA * (1 - dmin / info.diam);
    }
    for (let i = 0; i < cB.length; i++) {
      const cazadores = info.depredadores[tB[i]];
      let dmin = Infinity;
      for (let j = 0; j < cW.length; j++) {
        if (cazadores.indexOf(tW[j]) < 0) continue;
        const d = rpsDist(info, cB[i], cW[j]);
        if (d < dmin) dmin = d;
      }
      if (dmin < Infinity) caza += RPS_PESO_CAZA * (1 - dmin / info.diam);
    }
    score += caza;
  }
  // Rebaja de «ya no puedo ganar»: como los tipos no vuelven, un bando que no
  // tenga verdugos vivos para TODOS los tipos rivales vivos jamás podrá
  // eliminar al rival, y su mejor resultado posible son tablas — su ventaja
  // se multiplica por RPS_SIN_VICTORIA en vez de contarse entera. Esto quita
  // el incentivo perverso de conservar «rehenes» incapturables para inflar
  // el material dinámico, y hace que quien va ganando evite los cambios que
  // extinguen a sus propios verdugos. Se ESCALA en vez de recortar a tablas
  // en seco: el recorte aplanaría la evaluación y dejaría al bando que SÍ
  // puede ganar sin gradiente que seguir. (Si no puede ganar ninguno, la
  // posición está muerta: rpsDeadPosition la puntúa como tablas en la
  // búsqueda, y aquí queda una ventaja simbólica que no estorba.)
  if (V.kingless) {
    let mw = 0, mb = 0;
    for (const t of info.tipos) {
      if (cnt.w[t]) mw |= info.bit[t];
      if (cnt.b[t]) mb |= info.bit[t];
    }
    let ganaW = true, ganaB = true;
    for (const t of info.tipos) {
      const b = info.bit[t];
      if ((mb & b) && !(info.capturadoPorMask[t] & mw)) ganaW = false;
      if ((mw & b) && !(info.capturadoPorMask[t] & mb)) ganaB = false;
    }
    if (!ganaW && score > 0) score *= RPS_SIN_VICTORIA;
    if (!ganaB && score < 0) score *= RPS_SIN_VICTORIA;
  }
  return color === 'w' ? score : -score;
}

// Todas las jugadas legales de un color: [{from, to}], sin repeticiones.
//
// Hacen falta las dos comprobaciones porque legalMoves() SÍ repite destinos:
// por una casilla triangular pasan tres carriles, y cada vecina por arista
// pertenece a dos de ellos, así que la torre (y la dama, que la incluye)
// genera dos veces su primer paso en cada dirección. No era un error visible
// —la jugada es la misma—, pero se buscaba dos veces y aquí saldría dos veces
// en la lista del análisis.
function movesForSide(board, color, ep) {
  const out = [];
  const seen = new Set();
  for (const [key, p] of board) {
    if (p.color !== color) continue;
    for (const t of legalMoves(board, key, p, ep)) {
      const id = key + '>' + t.key;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ from: key, to: t.key });
    }
  }
  return out;
}

// Aplica una jugada sobre el Map dado (mutándolo), replicando los efectos de
// tablero de makeMove: captura al paso, promoción a dama y doble avance de
// peón. Devuelve el nuevo estado de captura al paso ({targetKey, pawnKey} o
// null). No mutar las piezas originales: los Maps copiados las comparten.
function applyMoveSim(board, fromKey, toKey, ep) {
  const piece = board.get(fromKey);
  const fromCell = CELL_MAP.get(fromKey);
  const toCell = CELL_MAP.get(toKey);

  // enroque: toKey es la casilla de la torre propia (ver CASTLING en rules.js)
  if (isCastling(board, fromKey, toKey)) {
    const rook = board.get(toKey);
    const { kingTo, rookTo } = castlingLanding(piece.color, fromKey, toKey);
    board.delete(fromKey);
    board.delete(toKey);
    board.set(kingTo, { ...piece, moved: true });
    board.set(rookTo, { ...rook, moved: true });
    return null;
  }

  if (piece.type === 'P' && !board.get(toKey) && ep && toKey === ep.targetKey) {
    board.delete(ep.pawnKey);
  }
  board.delete(fromKey);
  const moved = { ...piece, moved: true };
  if (moved.type === 'P' && toCell.promoFor[moved.color]) moved.type = 'Q';
  board.set(toKey, moved);
  return (piece.type === 'P' && toCell === fromCell.pawnTwo[piece.color])
    ? { targetKey: fromCell.pawnAdv[piece.color][0].key, pawnKey: toKey }
    : null;
}

// --- Zobrist: la firma de una posición como número, mantenida por XOR ---
//
// positionKey() serializa todas las piezas a strings, ORDENA el array y lo
// une: se pagaba en cada nodo interior para la TT y la repetición. El hash
// Zobrist asigna a cada (casilla, color, tipo, moved-relevante) un número
// aleatorio fijo; la firma de la posición es el XOR de los de sus piezas, y
// una jugada la actualiza con 2-4 XOR en vez de reserializar el tablero.
//
// Claves de 64 bits sin BigInt: dos mitades de 32 (h1/h2) en Uint32Array
// paralelos. Las tablas se generan con un PRNG sembrado (mulberry32): misma
// semilla ⇒ tablas idénticas también dentro del worker, que las reconstruye
// con initZobrist() porque no puede recibirlas como constante JSON.
//
// El estado `moved` entra en el hash solo para P/R/K, exactamente como en
// positionKey (MOVED_MATTERS, rules.js): es lo que distingue posiciones a
// efectos de enroque, doble avance y repetición.
const ZOBRIST_SEED = 0x9E3779B9;
const TT_BITS = 19;
const TT_SIZE = 1 << TT_BITS;
const TT_MASK = TT_SIZE - 1;
// Código dentro de la casilla+color: el tipo, más una variante "sin mover"
// para los tipos donde `moved` importa. La lista cubre las piezas de TODAS las
// modalidades (el elefante de Salas y el unicornio de Dekle incluidos) en vez
// de las de la activa: así los códigos no bailan al cambiar de modalidad, y da
// igual que una modalidad no use alguno.
// (las cinco figuras de Piedra, papel y tijera incluidas: sin código propio,
// zIndex daba NaN y TODAS las posiciones de esas modalidades compartían
// firma — repeticiones falsas en cuanto el reloj pasaba de 4 y una TT que
// mezclaba posiciones)
const Z_CODE = { P: 0, N: 1, B: 2, E: 3, U: 4, R: 5, Q: 6, K: 7,
                 O: 11, A: 12, T: 13, L: 14, S: 15 };
const Z_UNMOVED = { P: 8, R: 9, K: 10 };
const Z_PER_CELL = 32;   // 16 códigos × 2 colores

function initZobrist() {
  let s = ZOBRIST_SEED >>> 0;
  const rnd = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  const nCells = CELLS.length;
  const total = nCells * Z_PER_CELL + nCells + 1;   // piezas + al paso + turno
  const h1 = new Uint32Array(total), h2 = new Uint32Array(total);
  for (let i = 0; i < total; i++) { h1[i] = rnd(); h2[i] = rnd(); }
  return { h1, h2, epBase: nCells * Z_PER_CELL, turnIdx: total - 1 };
}

function zIndex(cell, p) {
  const code = (!p.moved && Z_UNMOVED[p.type] !== undefined)
    ? Z_UNMOVED[p.type] : Z_CODE[p.type];
  return cell.idx * Z_PER_CELL + (p.color === 'b' ? Z_PER_CELL / 2 : 0) + code;
}

// firma (solo piezas) de un tablero entero; acepta un Map o el array de
// pares de un snapshot del historial
function computeHash(boardEntries) {
  let h1 = 0, h2 = 0;
  for (const [key, p] of boardEntries) {
    const zi = zIndex(CELL_MAP.get(key), p);
    h1 ^= ZOBRIST.h1[zi];
    h2 ^= ZOBRIST.h2[zi];
  }
  return [h1 >>> 0, h2 >>> 0];
}

// clave completa del nodo (piezas + turno + al paso) como string, para el
// mapa de repeticiones (posiciones del historial + camino de búsqueda)
function hashKey(h1, h2, color, ep) {
  if (color === 'b') { h1 ^= ZOBRIST.h1[ZOBRIST.turnIdx]; h2 ^= ZOBRIST.h2[ZOBRIST.turnIdx]; }
  if (ep) {
    const i = ZOBRIST.epBase + CELL_MAP.get(ep.targetKey).idx;
    h1 ^= ZOBRIST.h1[i]; h2 ^= ZOBRIST.h2[i];
  }
  return (h1 >>> 0) + ',' + (h2 >>> 0);
}

// La tabla de transposición: arrays paralelos de tamaño fijo, sin claves
// string ni Map. `gen` marca a qué búsqueda pertenece cada entrada, así
// "vaciar" la tabla es ttGen++ (sin recorrer nada). meta = depth*4 + flag
// (0 exact, 1 lower, 2 upper).
function ttInit() {
  TT = {
    h2: new Uint32Array(TT_SIZE),
    meta: new Int32Array(TT_SIZE),
    score: new Float64Array(TT_SIZE),
    gen: new Uint32Array(TT_SIZE),
    age: new Uint32Array(TT_SIZE),  // búsqueda que escribió la entrada
    mv: new Int32Array(TT_SIZE),    // mejor jugada empaquetada (o -1)
  };
}

// Jugada como entero: idx(origen)*128 + idx(destino). Sirve de identidad
// compacta para el hash-move de la TT, los killers y la tabla de historia.
function packMove(m) {
  return CELL_MAP.get(m.from).idx * 128 + CELL_MAP.get(m.to).idx;
}

// XOR de la pieza `p` tal como está AHORA en `cellKey` sobre la firma de sx.
// Autoinversa: la misma llamada añade o quita. Se llama antes de mutar una
// pieza (quita su estado viejo) y después (añade el nuevo).
function zxor(sx, cellKey, p) {
  const zi = zIndex(CELL_MAP.get(cellKey), p);
  sx.h1 = (sx.h1 ^ ZOBRIST.h1[zi]) >>> 0;
  sx.h2 = (sx.h2 ^ ZOBRIST.h2[zi]) >>> 0;
}

// (el worker declara estos con líneas propias en aiWorkerSource; aquí viven
// para el hilo principal, Node y los drivers de entrenamiento)
//
// La TT PERSISTE entre jugadas consecutivas: ttGen solo avanza cuando cambia
// la configuración de evaluación (ttCfgSig), porque los scores guardados
// dependen de ella — en la arena, que alterna dos configuraciones en el
// mismo proceso, esto vacía la tabla en cada jugada (correcto, aunque
// pierda la persistencia). ttAge avanza en CADA búsqueda: los scores de
// mate (-MATE - profundidad restante) llevan una distancia que caduca al
// cambiar de posición raíz, así que solo se reutilizan dentro de la misma
// búsqueda; como jugada de ordenación siguen valiendo siempre.
let TT = null;
let ttGen = 0;
let ttAge = 0;
let ttCfgSig = null;
let ZOBRIST = initZobrist();

// Cambio de modalidad: las tablas Zobrist se dimensionan con el número de
// casillas, así que hay que rehacerlas si el tablero cambia de forma, y la TT
// hay que vaciarla en cualquier caso (una misma firma significa otra cosa con
// otro reglamento). variants.js llama aquí, si existe, al final de setVariant().
// La centralidad se recalcula sola, por su caché.
//
// Es una expresión de función con `var`, no una declaración, y eso importa:
// variants.js se carga ANTES que ai.js y hace su primer setVariant() al
// cargarse. Una declaración estaría ya izada y se ejecutaría en ese momento,
// tocando constantes de aquí que aún no existen; con `var` el nombre vale
// `undefined` hasta esta línea, así que esa primera llamada no entra (y no
// hace falta: justo debajo se inicializa todo por primera vez).
var onVariantChange = function () {
  ZOBRIST = initZobrist();
  ttGen++;
};

// --- make/unmake: la búsqueda muta UN tablero en sitio y deshace ---
//
// Hasta aquí cada nodo copiaba el Map entero (~40 piezas) y cada test de
// legalidad otro más. Ahora chooseAiMove hace UNA copia profunda en la raíz
// (innegociable: game.board llega por referencia en la vía síncrona, y los
// snapshots del historial comparten los objetos-pieza con el tablero vivo) y
// a partir de ahí makeSim/unmakeSim mutan esa copia y sus piezas en sitio.
// El registro de undo es un objeto reutilizable por ply: cero asignaciones
// por nodo.

function deepCopyBoard(board) {
  const out = new Map();
  for (const [k, p] of board) out.set(k, { ...p });
  return out;
}

// Aplica la jugada mutando tablero y pieza, apunta lo necesario para
// deshacerla en `u`, mantiene `kings` (color → clave de su rey) y devuelve
// el nuevo estado de captura al paso. Mismos efectos que applyMoveSim.
// Con `sx` (opcional) mantiene además la firma Zobrist de sx.h1/h2: los
// sondeos de legalidad llaman sin sx (nadie lee el hash ahí) y el que llama
// con sx guarda y repone h1/h2 alrededor del par make/unmake, que es más
// barato que deshacer los XOR uno a uno.
function makeSim(board, fromKey, toKey, ep, u, kings, sx) {
  const piece = board.get(fromKey);
  u.fromKey = fromKey; u.toKey = toKey; u.piece = piece;
  u.prevMoved = piece.moved; u.prevType = piece.type;
  u.captured = null; u.capturedKey = null; u.castle = null;

  // enroque: toKey es la casilla de la torre propia (ver CASTLING en rules.js)
  if (isCastling(board, fromKey, toKey)) {
    const rook = board.get(toKey);
    const { kingTo, rookTo } = castlingLanding(piece.color, fromKey, toKey);
    u.castle = { rook, rookPrevMoved: rook.moved, kingTo, rookTo };
    if (sx) { zxor(sx, fromKey, piece); zxor(sx, toKey, rook); }
    board.delete(fromKey);
    board.delete(toKey);
    piece.moved = true;
    rook.moved = true;
    board.set(kingTo, piece);
    board.set(rookTo, rook);
    kings[piece.color] = kingTo;
    if (sx) { zxor(sx, kingTo, piece); zxor(sx, rookTo, rook); }
    return null;
  }

  if (piece.type === 'P' && !board.get(toKey) && ep && toKey === ep.targetKey) {
    u.captured = board.get(ep.pawnKey);
    u.capturedKey = ep.pawnKey;
    if (sx) zxor(sx, ep.pawnKey, u.captured);
    board.delete(ep.pawnKey);
  } else {
    const v = board.get(toKey);
    if (v) {
      u.captured = v;
      u.capturedKey = toKey;
      if (sx) zxor(sx, toKey, v);
    }
  }
  if (sx) zxor(sx, fromKey, piece);   // estado viejo, antes de mutar
  board.delete(fromKey);
  piece.moved = true;
  const fromCell = CELL_MAP.get(fromKey);
  const toCell = CELL_MAP.get(toKey);
  if (piece.type === 'P' && toCell.promoFor[piece.color]) piece.type = 'Q';
  board.set(toKey, piece);
  if (sx) zxor(sx, toKey, piece);     // estado nuevo (movida y quizá coronada)
  if (u.prevType === 'K') kings[piece.color] = toKey;
  return (u.prevType === 'P' && toCell === fromCell.pawnTwo[piece.color])
    ? { targetKey: fromCell.pawnAdv[piece.color][0].key, pawnKey: toKey }
    : null;
}

function unmakeSim(board, u, kings) {
  const piece = u.piece;
  if (u.castle) {
    board.delete(u.castle.kingTo);
    board.delete(u.castle.rookTo);
    piece.moved = u.prevMoved;
    u.castle.rook.moved = u.castle.rookPrevMoved;
    board.set(u.fromKey, piece);
    board.set(u.toKey, u.castle.rook);
    kings[piece.color] = u.fromKey;
    return;
  }
  board.delete(u.toKey);
  piece.moved = u.prevMoved;
  piece.type = u.prevType;
  board.set(u.fromKey, piece);
  if (u.captured) board.set(u.capturedKey, u.captured);
  if (u.prevType === 'K') kings[piece.color] = u.fromKey;
}

// --- CLAVADAS -------------------------------------------------------------
//
// Mover una pieza propia solo puede dejar al rey en jaque si esa pieza estaba
// TAPANDO un rayo enemigo, es decir, si está clavada. Localizando las clavadas
// una vez por nodo, la inmensa mayoría de las jugadas se dan por legales sin
// tocar el tablero, en vez de probarlas una por una con make/unmake.
//
// Sigue haciendo falta la comprobación completa en cuatro casos:
//   - jugadas del rey (cambia la casilla que hay que defender),
//   - cualquier jugada estando en jaque (hay que resolverlo),
//   - jugadas de una pieza clavada (puede seguir tapando, o no),
//   - captura al paso (el peón capturado desaparece de OTRA casilla, que
//     puede ser la que tapaba el rayo).
//
// Es una optimización exacta: genera exactamente el mismo conjunto de jugadas,
// así que el perft y los dorados de búsqueda la verifican sin arena.

// Recorre los rayos que salen del rey buscando el patrón "pieza propia, y
// detrás un deslizador enemigo del tipo adecuado". Qué tipos amenazan por cada
// rayo, y a qué distancia, lo dice el haz de la modalidad (`tipos`): en Salas
// la dama clava por los rayos de torre y de elefante pero no por los de alfil,
// y en Dekle el tipo cambia según la distancia.
function scanPins(board, haces, color, foe, out) {
  for (const g of haces) {
    const ray = g.ray;
    let tapon = null;
    for (let i = 0; i < ray.length; i++) {
      const o = board.get(ray[i].key);
      if (!o) continue;
      if (tapon === null) {
        if (o.color !== color) break;   // el primero es enemigo: no clava nada
        tapon = ray[i].key;             // candidato a clavado
        continue;
      }
      if (o.color === foe && g.types[i].includes(o.type)) out.push(tapon);
      break;                            // segunda pieza del rayo: se acabó
    }
  }
}

// Claves de las piezas propias clavadas. Suelen ser cero o una, así que un
// array pequeño con indexOf sale más barato que un Set.
function findPins(board, kingCell, color, out) {
  out.length = 0;
  // sin rey (modalidades kingless) no hay clavadas; ver isAttackedFast
  if (!kingCell) return out;
  scanPins(board, kingCell.atk, color, rival(color), out);
  return out;
}

// ¿Hay que probar esta jugada con make/unmake, o es legal de oficio?
function needsProbe(board, p, key, t, ep, enJaque, clavadas) {
  if (enJaque || p.type === 'K') return true;
  if (clavadas.length && clavadas.indexOf(key) >= 0) return true;
  // captura al paso: el peón que desaparece no está en la casilla de destino
  return p.type === 'P' && ep && t.key === ep.targetKey && !board.get(t.key);
}

// Jugadas legales para la búsqueda: como movesForSide pero validando con
// make/unmake sobre el mismo tablero en vez de copiar el Map por candidato
// (y con el rey localizado en `kings`, sin el barrido lineal de findKing).
// Conserva el orden de movesForSide: piezas en orden del Map y el enroque
// pegado a las demás jugadas del rey.
function genMoves(board, color, ep, kings, probe) {
  const out = [];
  const seen = new Set();
  // Lista congelada: el sondeo con make/unmake borra y reinserta entradas, y
  // un Map de JS recoloca lo reinsertado AL FINAL del orden de iteración —
  // iterando el Map vivo, cada pieza sondeada se visitaría otra vez.
  const entries = [...board.entries()];
  const kingCell = CELL_MAP.get(kings[color]);
  const enJaque = isAttackedFast(board, kingCell, rival(color));
  const clavadas = findPins(board, kingCell, color, []);
  for (const [key, p] of entries) {
    if (p.color !== color) continue;
    const cell = CELL_MAP.get(key);
    for (const t of pseudoMoves(board, cell, p, ep)) {
      const id = key + '>' + t.key;
      if (seen.has(id)) continue;
      seen.add(id);
      if (!needsProbe(board, p, key, t, ep, enJaque, clavadas)) {
        out.push({ from: key, to: t.key });
        continue;
      }
      makeSim(board, key, t.key, ep, probe, kings);
      const ok = !isAttackedFast(board, CELL_MAP.get(kings[color]), rival(color));
      unmakeSim(board, probe, kings);
      if (ok) out.push({ from: key, to: t.key });
    }
    // castleMoves ya devuelve el enroque comprobado; sus 2-6 copias de Map
    // solo se pagan mientras el rey conserva el derecho a enrocar
    if (p.type === 'K') {
      for (const t of castleMoves(board, key, p)) out.push({ from: key, to: t.key });
    }
  }
  return out;
}

// Material (y movilidad, según nivel) desde el punto de vista de `color`.
function evaluate(board, color, cfg) {
  // Las modalidades con matriz de capturas (Piedra, papel y tijera) tienen
  // evaluación propia: valores dinámicos y amenazas, ver evaluateRps. Con
  // cfg.dynamicValues === false se desactiva y se cae al camino clásico con
  // los valores planos de la modalidad (sirve para medir la dinámica contra
  // la plana en la arena y en test-ia-rps.js). Las clásicas no tienen
  // V.captures y siguen por aquí abajo, intactas.
  if (V.captures && cfg.dynamicValues !== false) return evaluateRps(board, color, cfg);
  const values = cfg.pieceValues || PV();
  const posW = cfg.positionWeights;
  // Puntos por jugada disponible. Sale de la modalidad (engine.mobility), como
  // los valores de las piezas: no tiene por qué ser el mismo número en un
  // tablero de 96 casillas que en uno de 81, ni con un alfil que recorre 3
  // casillas que con uno en zigzag que cruza el tablero. Hoy las cuatro
  // declaran 4, que es el valor confirmado en la arena para el ajedrez de
  // Salas (~+58 elo el salto de 2 a 4 junto con el material ajustado, a
  // profundidad 2-3); en las demás está sin medir. Un cfg puede seguir
  // sustituyéndolo para experimentar, que es como lo mide arena.js.
  const mobilityWeight = cfg.mobilityWeight ?? V.engine.mobility ?? 4;
  let score = 0;
  for (const [key, p] of board) {
    const sign = p.color === color ? 1 : -1;
    score += sign * values[p.type];
    if (cfg.mobility) {
      score += sign * mobilityWeight * countPseudoMoves(board, CELL_MAP.get(key), p);
    }
    const pw = posW && posW[p.type];
    if (pw) {
      const cell = CELL_MAP.get(key);
      if (pw.centrality) score += sign * pw.centrality * centrality(cell);
      if (pw.advance) score += sign * pw.advance * pawnAdvance(cell, p.color);
    }
  }
  return score;
}

// Pieza capturada por una jugada, o null si no captura. Ojo: "hay algo en la
// casilla de destino" no basta, porque el enroque aterriza sobre la torre
// propia (ver CASTLING en rules.js); de ahí la comprobación de color.
function capturedBy(board, m) {
  const v = board.get(m.to);
  return v && v.color !== board.get(m.from).color ? v : null;
}

// capturas primero, ordenadas por MVV-LVA (la víctima más valiosa con el
// atacante más barato antes: es lo que más probablemente aguanta la
// recaptura); los empates se rompen por la clave from>to para que el orden
// no dependa del orden interno del Map del tablero (make/unmake reinserta
// piezas al final y lo va barajando; sin desempate fijo, el árbol explorado
// cambiaría de una ejecución a otra)
function orderMoves(board, moves, values = PV()) {
  const gain = m => {
    const v = capturedBy(board, m);
    return v ? values[v.type] * 1024 - values[board.get(m.from).type] : -1;
  };
  moves.sort((m1, m2) => (gain(m2) - gain(m1)) ||
    (m1.from + m1.to < m2.from + m2.to ? -1 : 1));
}

// Ordenación de la búsqueda interior: hash-move de la TT primero (la mejor
// jugada que esta misma posición tuvo la última vez que se buscó), después
// capturas por MVV-LVA, después los dos killers del ply (jugadas tranquilas
// que acaban de provocar un corte a esta altura: suelen repetirse entre
// ramas hermanas), y el resto por la tabla de historia (cuántos cortes ha
// provocado cada par origen-destino en esta búsqueda, con más peso cuanto
// más profundos). Deja m.pk calculado para el bucle.
function orderSearchMoves(board, moves, values, hashMv, killers, history) {
  for (const m of moves) {
    const pk = packMove(m);
    m.pk = pk;
    if (pk === hashMv) { m.ord = 2e9; continue; }
    const v = capturedBy(board, m);
    if (v) { m.ord = 1e9 + values[v.type] * 1024 - values[board.get(m.from).type]; continue; }
    if (pk === killers[0]) { m.ord = 9e8; continue; }
    if (pk === killers[1]) { m.ord = 8.9e8; continue; }
    m.ord = history[pk];
  }
  moves.sort((m1, m2) => (m2.ord - m1.ord) || (m1.pk - m2.pk));
}

// Cuenta de una tirada de rayos sin construir el array (ver slideMoves, que
// es idéntico pero materializa la lista).
function countSlide(board, piece, rays) {
  let n = 0;
  for (const ray of rays) {
    for (const t of ray) {
      const occ = board.get(t.key);
      if (!occ) { n++; continue; }
      if (occ.color !== piece.color) n++;
      break;
    }
  }
  return n;
}

// pseudoMoves(...).length sin materializar los arrays: es lo único que
// necesita la movilidad de evaluate(), que generaba y descartaba un array
// por pieza en cada hoja. Replica la cuenta EXACTA con ep = null, incluidos
// los destinos repetidos donde los rayos solapan (la movilidad de siempre
// los cuenta, y cambiarlo sería cambiar la evaluación). El peón delega en
// pseudoMoves: sus listas son diminutas y la deduplicación del doble avance
// es demasiado delicada para duplicarla.
function countPseudoMoves(board, cell, piece) {
  const rays = cell.rays[piece.type];
  if (rays) return countSlide(board, piece, rays);
  const leaps = cell.leaps[piece.type];
  if (leaps) {
    let n = 0;
    for (const t of leaps) {
      const o = board.get(t.key);
      if (!o || o.color !== piece.color) n++;
    }
    return n;
  }
  return pseudoMoves(board, cell, piece, null).length;   // peón
}

// ¿Ataca `byColor` la casilla `cell`? Como isAttacked (rules.js), pero
// dirigida: en vez de recorrer todas las piezas rivales generando sus listas
// completas de ataques, mira DESDE la casilla hacia fuera con los rayos y
// saltos precalculados de geometry.js, que son simétricos (el camino de ida
// es el de vuelta; el salto de caballo invierte la orientación ▲/▽ en ambos
// sentidos; los atacantes-peón de un color están en las casillas de captura
// del color contrario). Cientos de arrays y .includes() se convierten en
// ~40-60 board.get() con parada temprana y cero asignaciones.
//
// Equivalente a la vieja en su dominio de uso (el objetivo nunca es una
// casilla ocupada por una pieza de byColor: siempre se pregunta por el rey
// del OTRO color). Fuera de ese dominio la vieja tiene rarezas heredadas
// (el peón "ataca" casillas ocupadas por los suyos, el caballo no) que no
// merece la pena replicar.
// Los haces de rayos y las tablas inversas de saltos y peones las prepara
// variants.js (ver buildAttackTables): ahí es donde se resuelve que en Dekle
// el tipo de pieza que ataca por un rayo cambia con la distancia, y que un
// salto compuesto no tiene por qué ser simétrico.
function isAttackedFast(board, cell, byColor) {
  // Modalidades sin rey (V.kingless, ver variants.js): aquí llega `cell`
  // undefined porque kings[color] es null, y sin rey no hay jaque que
  // detectar. CAMBIO MÍNIMO para que la búsqueda no casque; la evaluación
  // específica de estas modalidades queda pendiente.
  if (!cell) return false;
  for (const g of cell.atk) {
    const ray = g.ray;
    for (let i = 0; i < ray.length; i++) {
      const o = board.get(ray[i].key);
      if (!o) continue;
      if (o.color === byColor && g.types[i].includes(o.type)) return true;
      break;
    }
  }
  for (const type in cell.leapAttackers) {
    for (const t of cell.leapAttackers[type]) {
      const o = board.get(t.key);
      if (o && o.color === byColor && o.type === type) return true;
    }
  }
  for (const t of cell.pawnAttackers[byColor]) {
    const o = board.get(t.key);
    if (o && o.color === byColor && o.type === 'P') return true;
  }
  return false;
}

// Primer ocupante de cada rayo, si es rival capturable: los únicos destinos
// de captura de una pieza deslizante. El filtro de canCapture replica el de
// slideMoves (rules.js): en las modalidades con matriz de capturas una pieza
// incomible corta el rayo pero no es captura; sin matriz, canCapture es
// siempre true y esto es lo de siempre.
function rayCaptures(board, piece, rays, out) {
  for (const ray of rays) {
    for (const t of ray) {
      const occ = board.get(t.key);
      if (!occ) continue;
      if (occ.color !== piece.color && canCapture(piece.type, occ.type)) out.push(t);
      break;
    }
  }
}

// Capturas legales de un color, generadas directamente. quiesce() pagaba
// movesForSide entero —generación Y comprobación de legalidad de TODOS los
// movimientos, cada una con su copia de tablero— para quedarse con 2-6
// capturas. Aquí solo nacen los destinos con pieza rival y solo esos pasan
// el test de legalidad.
//
// Replica el filtro actual `capturedBy != null`: NI captura al paso (su
// destino está vacío, así que hoy tampoco entra en quiesce — corregir eso
// será un cambio aparte y medido con la arena), NI enroque (aterriza sobre
// torre propia). El Set deduplica el primer paso de los rayos de torre/dama
// que solapan, como hace movesForSide.
function genCaptures(board, color, ep, kings, probe) {
  const out = [];
  const seen = new Set();
  const cands = [];
  // lista congelada por la misma razón que en genMoves: el sondeo reordena el Map
  const entries = [...board.entries()];
  const kingCell = CELL_MAP.get(kings[color]);
  const enJaque = isAttackedFast(board, kingCell, rival(color));
  const clavadas = findPins(board, kingCell, color, []);
  for (const [key, p] of entries) {
    if (p.color !== color) continue;
    const cell = CELL_MAP.get(key);
    cands.length = 0;
    if (cell.rays[p.type]) {
      rayCaptures(board, p, cell.rays[p.type], cands);
    } else {
      // saltadoras y peón: los destinos con pieza rival capturable encima
      // (canCapture filtra la matriz de las modalidades Piedra, papel y
      // tijera; sin matriz es siempre true, como en pseudoMoves)
      const destinos = cell.leaps[p.type] || cell.pawnCap[color];
      for (const t of destinos) {
        const o = board.get(t.key);
        if (o && o.color !== color && canCapture(p.type, o.type)) cands.push(t);
      }
    }
    for (const t of cands) {
      const id = key + '>' + t.key;
      if (seen.has(id)) continue;
      seen.add(id);
      if (!needsProbe(board, p, key, t, ep, enJaque, clavadas)) {
        out.push({ from: key, to: t.key });
        continue;
      }
      makeSim(board, key, t.key, ep, probe, kings);
      const ok = !isAttackedFast(board, CELL_MAP.get(kings[color]), rival(color));
      unmakeSim(board, probe, kings);
      if (ok) out.push({ from: key, to: t.key });
    }
  }
  return out;
}

// Búsqueda de quietud: al llegar a una hoja, evaluate() puede pillar la
// posición a mitad de un intercambio de capturas (efecto horizonte) y ver
// una pieza como perdida sin ver la recaptura que la compensa. quiesce()
// sigue explorando, pero solo capturas, hasta que no quede ninguna a mano
// o el resultado ya sea peor que lo que el rival puede forzar (poda alfa-
// beta), y usa evaluate() como "stand pat": la posición tal cual, sin más
// capturas, es al menos tan buena como el peor caso de seguir capturando.
function quiesce(board, color, ep, clock, keys, alpha, beta, cfg, qdepth, sx, ply) {
  // cuenta para el presupuesto, pero no corta aquí: la quietud está acotada
  // por qdepth y no puede dispararse, y así el corte vive en un solo sitio
  if (sx.tope) sx.nodos++;
  const values = cfg.pieceValues || PV();
  const standPat = evaluate(board, color, cfg);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;
  if (qdepth <= 0) return alpha;

  const captures = genCaptures(board, color, ep, sx.kings, sx.probe);
  if (captures.length === 0) return alpha;
  if (cfg.order) orderMoves(board, captures, values);
  const u = sx.undo[ply];
  for (const m of captures) {
    const gain = values[capturedBy(board, m).type];
    if (standPat + gain + DELTA_MARGIN < alpha) continue;   // poda por diferencia
    const nextEp = makeSim(board, m.from, m.to, ep, u, sx.kings);
    const score = -quiesce(board, rival(color), nextEp, 0, keys, -beta, -alpha, cfg,
      qdepth - 1, sx, ply + 1);
    unmakeSim(board, u, sx.kings);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

// `clock` son las medias jugadas sin captura ni peón; `keys` es un Map con
// las posiciones ya vistas (historial real + camino de búsqueda actual),
// con claves 'h1,h2' de hashKey(). La tabla de transposición es la TT
// global de arrays (ver ttInit): evita repetir trabajo cuando dos
// secuencias distintas llegan a la misma posición, indexada por la firma
// Zobrist que sx.h1/h2 mantienen por XOR — aquí ya no se serializa nada.
function negamax(board, color, ep, clock, keys, depth, alpha, beta, cfg, sx, ply) {
  // Presupuesto de nodos: cuando se agota se corta la búsqueda en seco. La
  // puntuación que se devuelve aquí es basura a propósito —no hay nada que
  // devolver—, y por eso chooseAiMove DESCARTA la iteración entera y se queda
  // con la última profundidad terminada. Ver cfg.nodes en AI_LEVELS.
  if (sx.tope) {
    if (sx.agotado) return 0;
    if (++sx.nodos > sx.tope) { sx.agotado = true; return 0; }
  }
  const values = cfg.pieceValues || PV();
  // tablas por la regla de los 50 movimientos (ver FIFTY_MOVE_LIMIT en
  // rules.js); en las modalidades sin rey NO aplica, igual que en finishMove
  if (!V.kingless && clock >= FIFTY_MOVE_LIMIT) return drawScore(board, color, values);

  // clave completa del nodo: firma de piezas + turno + al paso
  let kh1 = sx.h1, kh2 = sx.h2;
  if (color === 'b') { kh1 ^= ZOBRIST.h1[ZOBRIST.turnIdx]; kh2 ^= ZOBRIST.h2[ZOBRIST.turnIdx]; }
  if (ep) {
    const i = ZOBRIST.epBase + CELL_MAP.get(ep.targetKey).idx;
    kh1 ^= ZOBRIST.h1[i]; kh2 ^= ZOBRIST.h2[i];
  }
  kh1 >>>= 0; kh2 >>>= 0;

  // repetición: ver una posición por segunda vez ya se puntúa como tablas
  // (basta para detectar perpetuos con poca profundidad); la DETECCIÓN solo
  // puede saltar tras 4 medias jugadas reversibles (guarda del clock), pero
  // el REGISTRO (más abajo) es incondicional: un descendiente con clock
  // alto tiene que poder reconocer a un ancestro que aún lo tenía bajo. El
  // string solo se construye cuando hace falta: las hojas que se van a
  // quiesce con clock bajo no pagan nada.
  let key = null;
  if (clock >= 4) {
    key = kh1 + ',' + kh2;
    if (keys.has(key)) return drawScore(board, color, values);
  }

  // sin rey, la incapacidad mutua de captura es tablas (el 'material' de
  // finishMove): sin esto la búsqueda perseguiría posiciones muertas
  // creyendo que la ventaja de material sigue valiendo algo
  if (V.kingless && rpsDeadPosition(board)) return drawScore(board, color, values);

  // en las hojas, los niveles que lo piden siguen explorando por capturas
  // (quiesce) en vez de evaluar tal cual, para no cortar a mitad de un
  // intercambio; el resto evalúa directamente, como antes
  if (depth === 0) {
    return cfg.quiesce
      ? quiesce(board, color, ep, clock, keys, alpha, beta, cfg, QUIESCE_MAX_DEPTH, sx, ply)
      : evaluate(board, color, cfg);
  }
  if (key === null) key = kh1 + ',' + kh2;

  const alphaOrig = alpha;
  const idx = kh1 & TT_MASK;
  // entrada válida: de esta búsqueda (gen) y verificada con la otra mitad
  // de la firma (la probabilidad de que dos posiciones distintas compartan
  // índice Y h2 es despreciable)
  const hit = TT.gen[idx] === ttGen && TT.h2[idx] === kh2;
  if (hit && (TT.meta[idx] >> 2) >= depth) {
    const sc = TT.score[idx], flag = TT.meta[idx] & 3;
    // los scores de mate llevan distancia y caducan al cambiar de búsqueda
    // (ver ttAge); la jugada de ordenación (TT.mv) se usa igualmente
    if (Math.abs(sc) < MATE || TT.age[idx] === ttAge) {
      if (flag === 0) return sc;                        // exact
      if (flag === 1) { if (sc > alpha) alpha = sc; }   // lower
      else if (sc < beta) beta = sc;                    // upper
      if (alpha >= beta) return sc;
    }
  }

  const moves = genMoves(board, color, ep, sx.kings, sx.probe);
  if (moves.length === 0) {
    if (V.kingless) {
      // sin piezas es derrota por eliminación ('wiped'), puntuada como el
      // mate (los más rápidos puntúan más); sin jugadas pero con piezas es
      // ahogado, o sea tablas — exactamente como decide finishMove
      for (const [, p] of board) {
        if (p.color === color) return drawScore(board, color, values);
      }
      return -MATE - depth;
    }
    // mate (los más rápidos puntúan más) o tablas por ahogado
    return isAttackedFast(board, CELL_MAP.get(sx.kings[color]), rival(color))
      ? -MATE - depth : drawScore(board, color, values);
  }
  if (cfg.order) {
    orderSearchMoves(board, moves, values, hit ? TT.mv[idx] : -1,
      sx.killers[ply], sx.history);
  }
  // registrar la posición para que las líneas descendientes la detecten
  keys.set(key, (keys.get(key) || 0) + 1);
  let best = -Infinity;
  let bestMv = -1;
  const u = sx.undo[ply];
  for (const m of moves) {
    const captura = capturedBy(board, m);
    const nextClock = (captura || board.get(m.from).type === 'P') ? 0 : clock + 1;
    const ph1 = sx.h1, ph2 = sx.h2;
    const nextEp = makeSim(board, m.from, m.to, ep, u, sx.kings, sx);
    const score = -negamax(board, rival(color), nextEp, nextClock, keys, depth - 1,
      -beta, -alpha, cfg, sx, ply + 1);
    unmakeSim(board, u, sx.kings);
    sx.h1 = ph1; sx.h2 = ph2;
    if (score > best) {
      best = score;
      bestMv = m.pk !== undefined ? m.pk : packMove(m);
    }
    if (best > alpha) alpha = best;
    if (alpha >= beta) {
      // una jugada tranquila que corta se apunta como killer del ply y suma
      // historia (con más peso cuanto más profunda era la búsqueda restante)
      if (!captura && cfg.order) {
        const k = sx.killers[ply];
        if (k[0] !== m.pk) { k[1] = k[0]; k[0] = m.pk; }
        sx.history[m.pk] += depth * depth;
      }
      break;
    }
  }
  const n = keys.get(key) - 1;
  if (n > 0) keys.set(key, n); else keys.delete(key);

  // flag: si ningún movimiento superó alfa, `best` es solo una cota
  // superior (podría ser peor con más tiempo); si se produjo un corte beta,
  // es una cota inferior (podría ser mejor); si no, es el valor exacto.
  // Política de reemplazo de siempre (la entrada previa gana si es más
  // profunda); una entrada de otra posición o de otra búsqueda (gen) se
  // pisa sin contemplaciones.
  // política de reemplazo: la entrada previa gana solo si es de esta misma
  // búsqueda Y más profunda; lo viejo se pisa (su valor de ordenación ya se
  // aprovechó en el sondeo de arriba)
  if (!hit || TT.age[idx] !== ttAge || (TT.meta[idx] >> 2) <= depth) {
    TT.gen[idx] = ttGen;
    TT.age[idx] = ttAge;
    TT.h2[idx] = kh2;
    TT.meta[idx] = depth * 4 + (best <= alphaOrig ? 2 : best >= beta ? 1 : 0);
    TT.score[idx] = best;
    TT.mv[idx] = bestMv;
  }
  return best;
}

// Estado mínimo que necesita la búsqueda, extraído de `game`. Es también lo
// que viaja al worker de ai-async.js, por lo que solo contiene datos
// clonables (el Map del tablero, escalares y claves de posición).
function searchState() {
  const posKeys = [], posHashes = [];
  // desde la última edición del tablero: lo anterior es otra partida y contarlo
  // haría ver repeticiones que no existen (ver lastEditIndex en rules.js)
  for (let i = lastEditIndex(); i <= game.histIndex; i++) {
    const s = game.history[i];
    posKeys.push(s.posKey);
    // clave 'h1,h2' de cada posición del historial, en el mismo formato que
    // usa negamax para las repeticiones (se calcula aquí, en el hilo que
    // tiene el historial; al worker viajan solo los strings)
    const [h1, h2] = computeHash(s.board);
    posHashes.push(hashKey(h1, h2, s.turn, s.enPassant));
  }
  return { board: game.board, turn: game.turn, enPassant: game.enPassant,
           clock: game.clock, posKeys, posHashes };
}

// Lo mismo, pero para una posición cualquiera del historial (la usa el
// análisis a petición cuando se está revisando una jugada pasada). Solo se
// llama desde el hilo principal, para construir el mensaje: no hace falta
// mandarla al worker.
function stateAtIndex(i) {
  const s = game.history[i];
  const posKeys = [], posHashes = [];
  for (let j = lastEditIndex(i); j <= i; j++) {
    const sj = game.history[j];
    posKeys.push(sj.posKey);
    const [h1, h2] = computeHash(sj.board);
    posHashes.push(hashKey(h1, h2, sj.turn, sj.enPassant));
  }
  return { board: new Map(s.board.map(([k, p]) => [k, { ...p }])), turn: s.turn,
           enPassant: s.enPassant, clock: s.clock, posKeys, posHashes };
}

// Margen (en centipeones) dentro del cual una jugada se considera tan buena
// como la mejor a efectos del sorteo de chooseAiMove.
const PLAY_TOLERANCE = 25;

// Elige la jugada del ordenador según el nivel, para la posición actual o
// para el estado `st` dado. Devuelve {from, to} o null si no hay jugadas.
//
// Con opts.analyze, además, adjunta a la jugada devuelta un `analysis`: la
// lista de TODAS las jugadas legales con su puntuación, ordenada de mejor a
// peor y con `chosen` marcado en la elegida (que no siempre es la primera,
// ver el sorteo por PLAY_TOLERANCE más abajo). Eso obliga a buscar con
// ventana completa, que cuesta 2-3 veces más: ver el comentario del bucle.
// Sorteo ponderado por puntuación: la jugada i sale con probabilidad
// proporcional a exp((score_i − best) / T), con T en centipeones.
//
// Es el mando de dificultad "blando", frente a la ventana dura de
// PLAY_TOLERANCE. La ventana es absoluta y por eso reparte mal el castigo:
// en una posición tranquila hay veinte jugadas dentro de la banda y sortea
// entre todas, mientras que en una posición aguda —donde una sola jugada
// salva— las diferencias son de cientos de centipeones y nunca se equivoca.
// Debilita justo donde da igual. Con temperatura, en cambio, una jugada
// claramente peor nunca es imposible pero sí rara, y el comportamiento es el
// mismo en posiciones tranquilas y agudas.
//
// T = 0 (o sin definir) devuelve el comportamiento clásico y no pasa por
// aquí. Cuanto mayor T, más plano el reparto: con T muy grande juega al azar.
function pickSoftmax(scored, best, T) {
  let suma = 0;
  const pesos = scored.map(s => {
    // restar `best` antes de exponenciar evita el desbordamiento; el mate,
    // que vale decenas de miles, da peso 0 a todo lo demás, que es lo suyo
    const w = Math.exp((s.score - best) / T);
    suma += w;
    return w;
  });
  let r = Math.random() * suma;
  for (let i = 0; i < pesos.length; i++) {
    r -= pesos[i];
    if (r <= 0) return scored[i].move;
  }
  return scored[scored.length - 1].move;   // por redondeo
}

function chooseAiMove(level, st = searchState(), opts = {}) {
  const cfg = AI_LEVELS[level] || AI_LEVELS[1];
  // Copia profunda ÚNICA de la posición: en la vía síncrona st.board es el
  // Map vivo de la partida (searchState no copia) y los snapshots del
  // historial comparten los objetos-pieza. La búsqueda muta tablero y piezas
  // en sitio (make/unmake), así que necesita ejemplares propios.
  const board = deepCopyBoard(st.board);
  const kings = { w: null, b: null };
  for (const [key, p] of board) if (p.type === 'K') kings[p.color] = key;
  // contexto de búsqueda: registros de undo preasignados por ply (ninguna
  // asignación por nodo), otro para los sondeos de legalidad, killers por
  // ply y tabla de historia origen-destino. Killers e historia viven SOLO
  // dentro de esta llamada: la arena alterna dos configuraciones en el
  // mismo proceso y no deben contaminarse entre sí.
  const plies = (cfg.depth || 1) + QUIESCE_MAX_DEPTH + 4;
  const sx = {
    kings,
    probe: {},
    undo: Array.from({ length: plies }, () => ({})),
    killers: Array.from({ length: plies }, () => [-1, -1]),
    history: new Int32Array(128 * 128),
    h1: 0, h2: 0,
    // presupuesto de nodos (ver cfg.nodes en AI_LEVELS): 0 = sin límite
    nodos: 0, tope: 0, agotado: false,
  };
  const moves = genMoves(board, st.turn, st.enPassant, kings, sx.probe);
  if (moves.length === 0) return null;
  // el nivel 1 juega al azar: no hay puntuaciones que enseñar
  if (cfg.random) {
    const m = moves[Math.floor(Math.random() * moves.length)];
    return opts.analyze ? { ...m, analysis: null } : m;
  }
  if (cfg.order) orderMoves(board, moves, cfg.pieceValues || PV());

  // firma Zobrist de la raíz y TT lista. La tabla PERSISTE entre jugadas
  // mientras la configuración de evaluación no cambie (ver ttCfgSig arriba):
  // en una partida normal las búsquedas consecutivas comparten muchísimas
  // posiciones y arrancan con la tabla caliente.
  const [rh1, rh2] = computeHash(board);
  sx.h1 = rh1; sx.h2 = rh2;
  if (!TT) ttInit();
  // La firma incluye `nodes` y `temperature` aunque NO cambien lo que vale una
  // posición. El motivo no es la evaluación, es la INDEPENDENCIA: cuando dos
  // configuraciones se alternan en el mismo proceso (la arena, y el modo
  // ordenador contra ordenador), una firma común significa una sola tabla
  // compartida, y entonces el que piensa poco se encuentra hechas las cuentas
  // que hizo el que piensa mucho.
  //
  // No es hipotético: la primera medición de la escalera por presupuesto dio
  // 20 elo entre el nivel 5 y el 6 —con casi cuatro veces más presupuesto—
  // porque compartían tabla. La firma tiene que identificar al JUGADOR, no
  // solo a la evaluación.
  const cfgSig = JSON.stringify([cfg.pieceValues || null, cfg.positionWeights || null,
    cfg.mobilityWeight ?? 4, !!cfg.mobility, !!cfg.quiesce,
    cfg.nodes || 0, cfg.temperature || 0, cfg.depth || 0,
    // la evaluación dinámica de las modalidades RPS entra en la firma: dos
    // configuraciones que solo difieren en esto no pueden compartir tabla
    cfg.dynamicValues !== false]);
  if (cfgSig !== ttCfgSig) { ttCfgSig = cfgSig; ttGen++; }
  ttAge++;

  // posiciones ya vistas en la partida, para las repeticiones en la
  // búsqueda; las claves 'h1,h2' las trae st.posHashes (searchState). El
  // st.posKeys de siempre sigue existiendo para quien lo lea, pero la
  // búsqueda ya no lo usa.
  const keys = new Map();
  for (const k of (st.posHashes || [])) keys.set(k, (keys.get(k) || 0) + 1);

  // Bucle raíz: acumula las jugadas que quedan a menos de PLAY_TOLERANCE de
  // la mejor y sortea entre ellas. Antes se acumulaban solo las EMPATADAS a
  // mejor puntuación, pero con la ventana estrecha los empates exactos casi
  // nunca se dan: la partida salía idéntica cada vez (muy visible en
  // ordenador contra ordenador).
  //
  // De ahí el +PLAY_TOLERANCE en beta: con la ventana justa (-best + 1) las
  // jugadas peores que la mejor solo devuelven una COTA superior, y una
  // jugada con cota best−5 puede ser en realidad malísima, así que no se
  // puede sortear con ellas. Ensanchando la ventana esa tolerancia, toda
  // jugada dentro de la banda devuelve su puntuación EXACTA, y las que se
  // salen fallan alto y quedan por debajo de best − PLAY_TOLERANCE, que es
  // justo lo que hace falta para descartarlas. Cuesta prácticamente lo mismo
  // que la ventana justa (25 centipeones apenas abren nodos extra); la otra
  // vía, una segunda pasada que rebusque cada candidata con ventana acotada,
  // medía 2,6x.
  //
  // La banda es absoluta, no un porcentaje: un umbral relativo se rompe con
  // puntuaciones negativas (ver la historia de este criterio junto a run() en
  // tune-values.js) y se ensancharía de más en posiciones ya decididas. Con
  // 25 centipeones el sorteo solo entra entre jugadas prácticamente
  // equivalentes, así que da variedad sin debilitar el juego.
  //
  // El autojuego de entrenamiento (tune-values.js) usa esta misma función:
  // aprende de partidas jugadas exactamente como juega el ordenador real.
  //
  // En modo análisis la ventana se abre del todo (beta = Infinity). Es justo
  // lo que la ventana estrecha evita, y por eso cuesta 2-3 veces más: sin
  // beta no hay cortes entre jugadas hermanas. Pero es la única forma de que
  // las jugadas MALAS devuelvan su puntuación real y no una cota superior
  // (una jugada con cota −40 puede ser en realidad −900), que es justo lo
  // que hay que enseñar para poder comparar unas jugadas con otras.
  // Profundización iterativa: la búsqueda a d-1 deja la TT caliente (el
  // hash-move de cada posición) y ordena las jugadas raíz para la búsqueda
  // a d, que es la única cuyos resultados se usan. Las iteraciones previas
  // salen casi gratis con buena ordenación y suelen amortizarse de sobra.
  let best = -Infinity;
  let scored = [];
  const u = sx.undo[0];
  // La profundidad 1 se termina SIEMPRE, agote lo que agote: sin ella no hay
  // ninguna jugada que devolver. El presupuesto empieza a regir a partir de
  // la 2, que es donde de verdad se gasta el tiempo.
  const topeNodos = cfg.nodes || 0;
  for (let d = 1; d <= cfg.depth; d++) {
    sx.tope = (d === 1) ? 0 : topeNodos;
    if (d > 1 && topeNodos && sx.nodos >= topeNodos) break;
    const bestPrevio = best, scoredPrevio = scored;
    best = -Infinity;
    scored = [];
    for (const m of moves) {
      const nextClock = (capturedBy(board, m) || board.get(m.from).type === 'P')
        ? 0 : st.clock + 1;
      const ph1 = sx.h1, ph2 = sx.h2;
      const nextEp = makeSim(board, m.from, m.to, st.enPassant, u, kings, sx);
      // La temperatura necesita la puntuación EXACTA de las jugadas malas,
      // igual que el modo análisis: con la ventana estrecha una jugada
      // pésima solo devuelve una cota superior y el sorteo ponderado saldría
      // mal. Por eso una configuración con temperatura cuesta como el
      // análisis, 2-3 veces más que la ventana justa.
      const score = -negamax(board, rival(st.turn), nextEp, nextClock, keys,
        d - 1, -Infinity,
        (opts.analyze || cfg.temperature) ? Infinity : -best + PLAY_TOLERANCE + 1,
        cfg, sx, 1);
      unmakeSim(board, u, kings);
      sx.h1 = ph1; sx.h2 = ph2;
      if (score > best) best = score;
      scored.push({ move: m, score });
      if (sx.agotado) break;
    }
    if (sx.agotado) {
      // iteración a medias: sus puntuaciones no valen nada (las primeras
      // jugadas se miraron enteras y las últimas ni se tocaron, así que
      // quedarse con ellas sería peor que no haber profundizado)
      best = bestPrevio; scored = scoredPrevio;
      break;
    }
    if (d < cfg.depth) {
      // mejor raíz primero en la siguiente iteración (desempate estable)
      const orden = new Map(scored.map(s => [s.move, s.score]));
      moves.sort((a, b) => (orden.get(b) - orden.get(a)) ||
        (a.from + a.to < b.from + b.to ? -1 : 1));
    }
  }

  // el filtro va al final porque `best` sube durante el bucle; las jugadas
  // buscadas antes con un `best` más bajo tenían una ventana MÁS ancha, así
  // que su puntuación sigue siendo exacta (o una cota aún más baja) y el
  // filtro las trata igual de bien
  const top = scored.filter(s => s.score >= best - PLAY_TOLERANCE);
  const chosen = cfg.temperature
    ? pickSoftmax(scored, best, cfg.temperature)
    : top[Math.floor(Math.random() * top.length)].move;
  if (!opts.analyze) return chosen;
  scored.sort((a, b) => b.score - a.score);
  return {
    ...chosen,
    analysis: scored.map(s => ({
      from: s.move.from, to: s.move.to, score: s.score,
      // por identidad, no por from/to: en el enroque `to` es la casilla de
      // la torre y no distingue lo bastante (ver CASTLING en rules.js)
      ...(s.move === chosen ? { chosen: true } : {}),
    })),
  };
}

