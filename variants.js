// variants.js — Modalidades de ajedrez triangular.
//
// Una modalidad reúne: qué tablero usa (geometry.js), qué piezas hay, cómo se
// mueve cada una, la posición inicial, las reglas del peón y del enroque, y
// los parámetros con los que juega el motor.
//
// La modalidad activa vive en la variable global V. setVariant() la cambia:
// pone el tablero en geometry.js y cuelga de cada casilla las tablas
// precalculadas que esa modalidad necesita. rules.js y ai.js no conocen
// ninguna pieza en concreto: preguntan a V.
//
// CÓMO SE DESCRIBE UNA PIEZA
//
// Toda pieza que no sea el peón es de uno de estos dos tipos:
//   { rays: cell => [[casilla, …], …] }   deslizante: recorre rayos y se para
//                                         al chocar (captura si es rival)
//   { leaps: cell => [casilla, …] }       saltadora: llega directamente
// El peón lleva `pawn: true` y usa cell.pawnAdv / cell.pawnCap.
//
// Gracias a eso la generación de jugadas y la búsqueda son las mismas para
// todas las modalidades; lo único que cambia son las tablas.

// El selector de variación U+FE0E fuerza la presentación de TEXTO (no emoji):
// sin él, iOS/Safari pinta el peón ♟ como emoji coloreado de fábrica e ignora
// el fill del CSS. Es zero-width, no afecta al centrado ni al texto de jugadas.
// El elefante y el unicornio no aparecen aquí como carácter: se dibujan como
// icono SVG, salvo en el texto de las jugadas, donde el emoji sirve (ahí el
// color es indiferente).
const VS_TEXT = '︎';
const GLYPH = {
  K: '♚' + VS_TEXT, Q: '♛' + VS_TEXT, R: '♜' + VS_TEXT, B: '♝' + VS_TEXT,
  N: '♞' + VS_TEXT, E: '🐘', U: '🦄', P: '♟' + VS_TEXT,
  // Piedra, papel y tijera (más lagarto y Spock). Igual que el elefante y el
  // unicornio, sobre el tablero van como icono SVG monocromo (los emoji no
  // distinguen el bando); el emoji queda para el texto de las jugadas.
  O: '🪨', A: '📄', T: '✂️', L: '🦎', S: '🖖',
};

// --- utilidades de construcción -------------------------------------------

// Reparte los 6 rayos de elefante de una casilla en dos mitades según el
// primer paso: los que empiezan cruzando una ARISTA y los que empiezan
// atravesando un VÉRTICE. Es la base de la torre y el alfil de Dekle.
function splitElephantRays(cell) {
  const porArista = [], porVertice = [];
  for (const ray of cell.elephantRays) {
    if (!ray.length) continue;
    (cell.edgeNbrs.includes(ray[0]) ? porArista : porVertice).push(ray);
  }
  return { porArista, porVertice };
}

// Rayo en zigzag: alterna dos direcciones de alfil, empezando por la primera.
// Se corta al salir del tablero (y por si acaso al repetir casilla, que con
// direcciones opuestas sería un vaivén infinito).
function zigzagBishopRay(cell, i, j) {
  const ray = [];
  const visto = new Set([cell.key]);
  let cur = cell, k = 0;
  while (true) {
    const nx = bishopStep(cur, BISHOP_DIRS[k % 2 ? j : i]);
    if (!nx || visto.has(nx.key)) break;
    visto.add(nx.key);
    ray.push(nx);
    cur = nx;
    k++;
  }
  return ray;
}

// Saltos compuestos: `n` pasos seguidos por un rayo de `raysA` y luego UN paso
// por un rayo de `raysB` que se desvíe, ni siguiendo recto ni volviéndose.
// Salta por encima de lo que haya, como el caballo. Devuelve casillas únicas.
//
// «Desviarse» se comprueba por casillas, no por índices de dirección: se
// descartan la casilla anterior al pivote (volverse) y la siguiente del mismo
// rayo (seguir recto). Los índices no valdrían, porque en los bordes del
// tablero una casilla tiene menos rayos y el orden deja de ser comparable.
function compoundLeaps(cell, n, raysA, raysB) {
  const out = new Set();
  for (const rayA of raysA) {
    if (rayA.length < n) continue;
    const pivote = rayA[n - 1];
    const atras = n >= 2 ? rayA[n - 2] : cell;   // de dónde se viene
    const recto = rayA[n];                        // seguir en línea recta
    for (const rayB of raysB(pivote)) {
      const t = rayB[0];
      if (!t || t === atras || t === recto || t === cell) continue;
      out.add(t);
    }
  }
  return [...out];
}

// --- peones ----------------------------------------------------------------

// Peón "de fila": avanza a la casilla que tiene justo enfrente y captura en
// las dos frontales diagonales. Es el peón del ajedrez de Salas y (en esta
// reconstrucción) el de Dekle. Las blancas van hacia b creciente.
function setRowPawns() {
  for (const cell of CELLS) {
    const { a, b, c } = cell;
    cell.pawnAdv = { w: [], b: [] };
    cell.pawnCap = { w: [], b: [] };
    const add = (arr, a2, b2, c2) => { const t = getCell(a2, b2, c2); if (t) arr.push(t); };
    if (cell.up) {
      add(cell.pawnAdv.w, a - 1, b + 1, c - 1);  // justo encima (por el vértice)
      add(cell.pawnCap.w, a - 1, b + 1, c);      // diagonal arriba-izquierda
      add(cell.pawnCap.w, a, b + 1, c - 1);      // diagonal arriba-derecha
      add(cell.pawnAdv.b, a, b - 1, c);          // justo debajo (por la arista)
      add(cell.pawnCap.b, a, b - 1, c + 1);      // diagonal abajo-izquierda
      add(cell.pawnCap.b, a + 1, b - 1, c);      // diagonal abajo-derecha
    } else {
      add(cell.pawnAdv.w, a, b + 1, c);          // justo encima (por la arista)
      add(cell.pawnCap.w, a - 1, b + 1, c);      // diagonal arriba-izquierda
      add(cell.pawnCap.w, a, b + 1, c - 1);      // diagonal arriba-derecha
      add(cell.pawnAdv.b, a + 1, b - 1, c + 1);  // justo debajo (por el vértice)
      add(cell.pawnCap.b, a, b - 1, c + 1);      // diagonal abajo-izquierda
      add(cell.pawnCap.b, a + 1, b - 1, c);      // diagonal abajo-derecha
    }
  }
}

// Peón de Trigonal Chess: avanza UN paso por su fila hacia el rival (las
// blancas hacia la derecha de la retícula) y ataca en las tres diagonales
// de delante. En este tablero las filas son las columnas de la pantalla,
// porque se dibuja girado.
const TRI_FWD = { w: [0, 2], b: [2, 0] };   // direcciones de torre dentro de la fila
function setTrigonalPawns() {
  for (const cell of CELLS) {
    cell.pawnAdv = { w: [], b: [] };
    cell.pawnCap = { w: [], b: [] };
    for (const color of ['w', 'b']) {
      const adelante = rookStep(cell, TRI_FWD[color]);
      if (adelante) cell.pawnAdv[color].push(adelante);
      // Las tres diagonales de delante: de las 6 direcciones de alfil, las que
      // avanzan hacia el rival (la coordenada que mide el avance aumenta).
      const signo = color === 'w' ? 1 : -1;
      for (const d of BISHOP_DIRS) {
        if (signo * (d[0] - d[2]) <= 0) continue;
        const t = bishopStep(cell, d);
        if (t) cell.pawnCap[color].push(t);
      }
    }
  }
}

// --- el registro de modalidades -------------------------------------------

// Conjuntos de tipos que atacan por cada haz de rayos, como constantes para no
// crear arrays nuevos dentro de la búsqueda.
const SALAS_R = ['R', 'Q'], SALAS_E = ['E', 'Q'], SALAS_B = ['B'];
const SALAS4_R = ['R', 'Q'], SALAS4_E = ['E', 'Q'], SALAS4_B = ['B', 'Q'];
const S98_R = ['R', 'Q'], S98_B = ['B', 'Q'];
const DEKLE_R = ['R', 'Q'], DEKLE_B = ['B', 'Q'];
const KOVAL_R = ['R', 'Q'], KOVAL_B = ['B', 'Q'];

// OJO CON LOS NOMBRES. El `id` de cada modalidad es su identificador
// PERMANENTE: viaja dentro de las partidas guardadas, de los libros de
// aperturas y del corpus de entrenamiento, así que no se toca aunque cambie el
// nombre visible. Por eso la que se enseña como «Salas v2» sigue siendo
// `salas` por dentro, y la v3, `salas-v4`.
const VARIANTS = {

  // =========================================================================
  // Salas v2 (2026) — la modalidad de casa.
  // =========================================================================
  salas: {
    id: 'salas',
    name: 'Salas v2 (2026)',
    full: 'Ajedrez triangular de Salas v2 (2026)',
    board: 'hex4',
    // La fila del borde completa (9 casillas), de izquierda a derecha para las
    // blancas. Los índices pares son ▽ y los impares ▲. Las negras usan la
    // misma lista y el mismo orden de columnas, de modo que la reina blanca
    // queda justo enfrente de la reina negra y el rey blanco enfrente del rey
    // negro.
    backLayout: ['R', 'B', 'N', 'K', 'E', 'Q', 'B', 'N', 'R'],
    promotionChoices: ['Q', 'R', 'E', 'B', 'N'],
    // Por el lado corto el rey se desplaza dos casillas hacia la torre y esta
    // salta al otro lado; por el lado largo, tres.
    castling: [
      { king: 3, rook: 0, kingTo: 1, rookTo: 2 },   // corto
      { king: 3, rook: 8, kingTo: 6, rookTo: 5 },   // largo
    ],
    // Coronación de flanco (regla tomada de Dekle 1986, ver README): el peón
    // que se queda sin casilla de avance puede seguir hacia la coronación por
    // su casilla de captura, haya o no pieza que capturar. Sin ella, dos de
    // los once peones de cada bando no pueden coronar nunca.
    edgePromotion: true,
    setup() {
      const filas = {
        wBack: rowCells(1 - N), wPawns: rowCells(2 - N),
        bBack: rowCells(N), bPawns: rowCells(N - 1),
      };
      return filas;
    },
    build() { setRowPawns(); },
    pieces: {
      R: { rays: c => c.rookRays },
      B: { rays: c => c.bishopRays },
      Q: { rays: c => c.rookRays.concat(c.elephantRays) },
      E: { rays: c => c.elephantRays },
      N: { leaps: c => c.knightTargets },
      K: { leaps: c => c.kingNbrs },
      P: { pawn: true },
    },
    slideGroups: () => [
      { rays: c => c.rookRays, typeAt: () => SALAS_R },
      { rays: c => c.elephantRays, typeAt: () => SALAS_E },
      { rays: c => c.bishopRays, typeAt: () => SALAS_B },
    ],
    note: 'Hexágono de 96 triángulos. La modalidad de casa, y la única con los ' +
      'valores del motor ajustados y confirmados en la arena.',
    help: [
      ['R', '<b>Torre ♜</b>: se desliza por los tres carriles de casillas que pasan por ella, cruzando aristas.'],
      ['B', '<b>Alfil ♝</b>: se desliza en las 6 direcciones diagonales, de vértice a vértice, siempre por triángulos de su misma orientación.'],
      ['Q', '<b>Dama ♛</b>: combina torre y elefante.'],
      ['N', '<b>Caballo ♞</b>: salta a las 12 casillas de orientación contraria que forman dos anillos a su alrededor; puede saltar por encima de otras piezas.'],
      ['E', '<b>Elefante 🐘</b>: se desliza en línea recta hacia cualquiera de sus tres casillas vecinas por arista o en el sentido opuesto (6 direcciones, alternando aristas y vértices); no salta piezas.'],
      ['K', '<b>Rey ♚</b>: un paso a cualquier casilla que toque la suya (por arista o por vértice).'],
      ['P', '<b>Peón ♟</b>: avanza sin capturar a la casilla que tiene justo enfrente (azul) y captura en las dos casillas frontales diagonales (rojo). Puede avanzar dos veces en su primer movimiento y corona al llegar a la última fila. <b>Coronación de flanco</b>: si se queda sin casilla de enfrente, contra el borde del tablero, avanza en diagonal —sin capturar— para poder seguir coronando. Sin esa regla, los dos peones de los extremos no coronarían nunca.'],
    ],
    engine: {
      pieceValues: { P: 100, N: 265, B: 335, E: 358, R: 483, Q: 981, K: 0 },
      mobility: 4,
    },
  },

  // =========================================================================
  // Salas v3 (2026) — experimental: dama con las tres familias de rayos.
  // =========================================================================
  'salas-v4': {
    id: 'salas-v4',
    name: 'Salas v3 (2026)',
    full: 'Ajedrez triangular de Salas v3 (2026)',
    board: 'hex4',
    backLayout: ['R', 'B', 'N', 'K', 'E', 'Q', 'B', 'N', 'R'],
    promotionChoices: ['Q', 'R', 'E', 'B', 'N'],
    castling: [
      { king: 3, rook: 0, kingTo: 1, rookTo: 2 },
      { king: 3, rook: 8, kingTo: 6, rookTo: 5 },
    ],
    edgePromotion: true,
    setup() {
      const filas = {
        wBack: rowCells(1 - N), wPawns: rowCells(2 - N),
        bBack: rowCells(N), bPawns: rowCells(N - 1),
      };
      return filas;
    },
    build() { setRowPawns(); },
    pieces: {
      R: { rays: c => c.rookRays },
      B: { rays: c => c.bishopRays },
      Q: { rays: c => c.rookRays.concat(c.bishopRays, c.elephantRays) },
      E: { rays: c => c.elephantRays },
      N: { leaps: c => c.knightTargets },
      K: { leaps: c => c.kingNbrs },
      P: { pawn: true },
    },
    slideGroups: () => [
      { rays: c => c.rookRays, typeAt: () => SALAS4_R },
      { rays: c => c.elephantRays, typeAt: () => SALAS4_E },
      { rays: c => c.bishopRays, typeAt: () => SALAS4_B },
    ],
    note: 'Hexágono de 96 triángulos. La dama combina las tres familias de ' +
      'deslizante (torre, alfil y elefante); el rey es esa misma dama a un ' +
      'solo paso, que aquí coincide exactamente con las 12 casillas vecinas.',
    help: [
      ['R', '<b>Torre ♜</b>: se desliza por los tres carriles de casillas que pasan por ella, cruzando aristas.'],
      ['B', '<b>Alfil ♝</b>: se desliza en las 6 direcciones diagonales, de vértice a vértice, siempre por triángulos de su misma orientación.'],
      ['Q', '<b>Dama ♛</b>: combina torre, alfil y elefante.'],
      ['N', '<b>Caballo ♞</b>: salta a las 12 casillas de orientación contraria que forman dos anillos a su alrededor; puede saltar por encima de otras piezas.'],
      ['E', '<b>Elefante 🐘</b>: se desliza en línea recta hacia cualquiera de sus tres casillas vecinas por arista o en el sentido opuesto (6 direcciones, alternando aristas y vértices); no salta piezas.'],
      ['K', '<b>Rey ♚</b>: un paso a cualquier casilla que toque la suya (por arista o por vértice) — es la dama a un solo paso.'],
      ['P', '<b>Peón ♟</b>: avanza sin capturar a la casilla que tiene justo enfrente (azul) y captura en las dos casillas frontales diagonales (rojo). Puede avanzar dos veces en su primer movimiento y corona al llegar a la última fila. <b>Coronación de flanco</b>: si se queda sin casilla de enfrente, contra el borde del tablero, avanza en diagonal —sin capturar— para poder seguir coronando.'],
    ],
    engine: {
      pieceValues: { P: 100, N: 265, B: 335, E: 358, R: 483, Q: 1380, K: 0 },
      mobility: 4,
    },
  },

  // =========================================================================
  // Salas v1 (1998) — la primera versión, la de 1998.
  //
  // Es el antepasado de las de 2026: mismo alfil, mismo caballo y mismo peón,
  // pero sobre un tablero de 8×8 y con el ejército del ajedrez de siempre.
  //
  // La pieza que aquí se llama TORRE es la que en 2026 pasó a llamarse
  // elefante 🐘 (los 6 rayos perpendiculares a los lados, alternando aristas y
  // vértices); en 2026 se le añadió al juego una torre nueva —la de los tres
  // carriles— y la dama se rehizo con ella. Aquí la dama es alfil + torre de
  // 1998, o sea alfil + elefante, y el rey es esa misma dama a un solo paso,
  // que en esta retícula resulta ser justo las 12 casillas que tocan la suya:
  // los 6 primeros pasos del alfil y los 6 del elefante son disjuntos y suman
  // exactamente la vecindad del rey (comprobado casilla a casilla).
  // =========================================================================
  'salas-1998': {
    id: 'salas-1998',
    name: 'Salas v1 (1998)',
    full: 'Ajedrez triangular de Salas v1 (1998)',
    board: 'rect8',
    // La colocación del ajedrez tradicional, en el orden que le dio el autor:
    // torre, caballo, alfil, REY, DAMA, alfil, caballo y torre. Ojo, que el rey
    // va a la izquierda de la dama, al revés que en el ajedrez moderno: está
    // puesto así a propósito, no es una errata.
    // Las negras usan la misma lista y las mismas columnas, de modo que quedan
    // rey contra rey (d1/d8) y dama contra dama (e1/e8).
    backLayout: ['R', 'N', 'B', 'K', 'Q', 'B', 'N', 'R'],
    promotionChoices: ['Q', 'R', 'B', 'N'],
    // Enroque tradicional: el rey se aparta dos casillas hacia la torre y esta
    // salta al otro lado. Por el lado corto (columnas d→b, torre a→c) y por el
    // largo (d→f, torre h→e).
    castling: [
      { king: 3, rook: 0, kingTo: 1, rookTo: 2 },   // corto
      { king: 3, rook: 7, kingTo: 5, rookTo: 4 },   // largo
    ],
    // Aquí no hace falta la coronación de flanco: al recortar el hexágono a un
    // rectángulo, las 8 columnas llegan enteras de la fila 1 a la 8, así que
    // ningún peón se queda sin casilla de avance por mucho que ande.
    edgePromotion: false,
    setup() {
      return {
        wBack: rowCells(1 - N), wPawns: rowCells(2 - N),
        bBack: rowCells(N), bPawns: rowCells(N - 1),
      };
    },
    build() { setRowPawns(); },
    pieces: {
      R: { rays: c => c.elephantRays },
      B: { rays: c => c.bishopRays },
      Q: { rays: c => c.elephantRays.concat(c.bishopRays) },
      N: { leaps: c => c.knightTargets },
      K: { leaps: c => c.kingNbrs },
      P: { pawn: true },
    },
    slideGroups: () => [
      { rays: c => c.elephantRays, typeAt: () => S98_R },
      { rays: c => c.bishopRays, typeAt: () => S98_B },
    ],
    note: 'La primera versión, de 1998. Rectángulo de 8×8 = 64 triángulos —el ' +
      'hexágono con los dos picos laterales cortados, de ahí el zigzag de los ' +
      'bordes— con el ejército del ajedrez de siempre, su colocación y sus ' +
      'coordenadas a1…h8. Su torre es la pieza que en 2026 pasó a llamarse ' +
      'elefante.',
    help: [
      ['R', '<b>Torre ♜</b>: se desliza en línea recta hacia cualquiera de sus tres casillas vecinas por arista o en el sentido opuesto (6 direcciones, alternando aristas y vértices); no salta piezas. Es la que en la versión de 2026 se llama elefante 🐘.'],
      ['B', '<b>Alfil ♝</b>: se desliza en las 6 direcciones diagonales, de vértice a vértice, siempre por triángulos de su misma orientación. El mismo que en 2026.'],
      ['Q', '<b>Dama ♛</b>: combina torre y alfil, las 12 direcciones.'],
      ['N', '<b>Caballo ♞</b>: salta a las 12 casillas de orientación contraria que forman dos anillos a su alrededor; puede saltar por encima de otras piezas. El mismo que en 2026.'],
      ['K', '<b>Rey ♚</b>: la dama, pero una sola casilla cada vez; en esta retícula eso son justo las 12 casillas que tocan la suya, por arista o por vértice.'],
      ['P', '<b>Peón ♟</b>: avanza sin capturar a la casilla que tiene justo enfrente (azul) y captura en las dos casillas frontales diagonales (rojo). Puede avanzar dos veces en su primer movimiento y corona al llegar a la última fila. Aquí no hay coronación de flanco, y no hace falta: en este tablero las 8 columnas llegan enteras hasta la fila del rival.'],
    ],
    engine: {
      // Sin ajustar todavía. El alfil, el caballo y el peón se copian de la
      // modalidad de casa; la torre de 1998 es su elefante; y la dama se
      // estima con la misma proporción que allí guarda con sus dos mitades.
      // Pendiente de tune-values.js.
      pieceValues: { P: 100, N: 265, B: 335, R: 358, Q: 810, K: 0 },
      mobility: 4,
    },
  },

  // =========================================================================
  // Triangular Chess (George R. Dekle Sr., 1986)
  //
  // RECONSTRUCCIÓN. El tablero, la dotación y los deslizantes están bien
  // asentados; el caballo, el unicornio y el orden de la fila de fondo se han
  // reconstruido a partir de descripciones secundarias. Ver el README.
  //
  // Su tablero es EL MISMO hexágono de 96 casillas, y su dotación (juego
  // completo + 3 peones + un unicornio) da 9 piezas de fondo y 11 peones, que
  // es justo lo que miden estas dos filas.
  //
  // Sus deslizantes son el elefante de Salas partido en dos: la torre son los
  // 3 rayos que arrancan cruzando una arista, el alfil los 3 que arrancan por
  // un vértice, y la dama los 6. Su alfil, por tanto, NO está atado al color.
  // =========================================================================
  dekle: {
    id: 'dekle',
    name: 'Dekle (1986)',
    full: 'Triangular Chess (George R. Dekle Sr., 1986)',
    board: 'hex4',
    backLayout: ['R', 'B', 'N', 'K', 'U', 'Q', 'B', 'N', 'R'],
    promotionChoices: ['Q', 'R', 'U', 'B', 'N'],
    castling: [
      { king: 3, rook: 0, kingTo: 1, rookTo: 2 },
      { king: 3, rook: 8, kingTo: 6, rookTo: 5 },
    ],
    edgePromotion: true,      // la regla es suya
    setup() {
      return {
        wBack: rowCells(1 - N), wPawns: rowCells(2 - N),
        bBack: rowCells(N), bPawns: rowCells(N - 1),
      };
    },
    build() {
      setRowPawns();
      for (const cell of CELLS) {
        const { porArista, porVertice } = splitElephantRays(cell);
        cell.dekleRook = porArista;
        cell.dekleBishop = porVertice;
        // Rey: un paso como la dama, o sea la primera casilla de cada uno de
        // los 6 rayos (3 por arista y 3 por vértice), no las 12 que toca.
        cell.dekleKing = cell.elephantRays.filter(r => r.length).map(r => r[0]);
      }
      // Compuestas: se calculan aparte porque necesitan los rayos ya puestos.
      for (const cell of CELLS) {
        cell.dekleKnight = compoundLeaps(cell, 2, cell.dekleBishop, c => c.dekleRook);
        cell.dekleUnicorn = compoundLeaps(cell, 2, cell.dekleRook, c => c.dekleRook);
      }
    },
    pieces: {
      R: { rays: c => c.dekleRook },
      B: { rays: c => c.dekleBishop },
      Q: { rays: c => c.elephantRays },
      U: { leaps: c => c.dekleUnicorn },
      N: { leaps: c => c.dekleKnight },
      K: { leaps: c => c.dekleKing },
      P: { pawn: true },
    },
    // Un solo haz —los 6 rayos de elefante—, pero con el tipo alternando:
    // desde la casilla atacada, si el rayo arranca cruzando una ARISTA, la
    // vecina ataca como torre, la siguiente como alfil, y así; si arranca por
    // un VÉRTICE, al revés. La dama ataca desde cualquier posición.
    slideGroups: () => [{
      rays: c => c.elephantRays,
      typeAt: (ray, i, desde) => {
        const arista = desde.edgeNbrs.includes(ray[0]);
        return ((i % 2 === 0) === arista) ? DEKLE_R : DEKLE_B;
      },
    }],
    note: 'Mismo hexágono de 96 triángulos que el de Salas. RECONSTRUCCIÓN a ' +
      'partir de descripciones secundarias: el caballo, el unicornio y el orden ' +
      'de la fila de fondo son una interpretación razonada, no la fuente original.',
    help: [
      ['R', '<b>Torre ♜</b>: se desliza en línea recta en las 3 direcciones que arrancan cruzando una arista.'],
      ['B', '<b>Alfil ♝</b>: se desliza en línea recta en las 3 direcciones que arrancan atravesando un vértice. A diferencia del alfil de Salas, no está atado al color de la casilla.'],
      ['Q', '<b>Dama ♛</b>: torre y alfil juntos, las 6 direcciones.'],
      ['N', '<b>Caballo ♞</b>: dos pasos de alfil y luego uno de torre que se desvíe; salta por encima de lo que haya.'],
      ['U', '<b>Unicornio 🦄</b>: dos pasos de torre y luego uno de torre que se desvíe; también salta.'],
      ['K', '<b>Rey ♚</b>: un paso como la dama, o sea a las 6 casillas que tiene en línea, no a las 12 que le tocan.'],
      ['P', '<b>Peón ♟</b>: como el de Salas, con la <b>coronación de flanco</b> —que es regla suya, y de donde la toma prestada el ajedrez de Salas—: al quedarse sin casilla de enfrente contra el borde, avanza en diagonal aunque no haya nada que capturar.'],
    ],
    engine: {
      // Punto de partida, sin ajustar: se copian los de Salas y el unicornio
      // se estima entre caballo y torre. Pendiente de tune-values.js.
      pieceValues: { P: 100, N: 300, B: 320, U: 400, R: 400, Q: 800, K: 0 },
      mobility: 4,
    },
  },

  // =========================================================================
  // Trigonal Chess (Max Koval, 2023)
  //
  // Tablero triangular de 81 casillas, juego de ajedrez normal sin piezas de
  // fantasía. Posición inicial y coordenadas son las publicadas por el autor.
  //
  // RECONSTRUCCIÓN PARCIAL: su torre ("siempre por el lado más lejano") es
  // exactamente la torre de Salas, comprobado contra su diagrama. Su alfil
  // alternante se ha reconstruido como el análogo de esa torre —zigzag entre
  // dos direcciones diagonales a 120°, cuya deriva neta va por una diagonal—.
  // Ver el README.
  // =========================================================================
  trigonal: {
    id: 'trigonal',
    name: 'Trigonal (Koval, 2023)',
    full: 'Trigonal Chess (Max Koval, 2023)',
    board: 'tri9',
    promotionChoices: ['Q', 'R', 'B', 'N'],
    edgePromotion: false,
    // Posición inicial publicada por el autor. La única corrección es el
    // caballo negro: aparece como «i15», que ya está ocupada por un peón; el
    // reflejo exacto de la posición blanca (posición p de una fila de L pasa a
    // L+1−p) lo sitúa en i16, y así queda simétrica, que es lo que él busca.
    position: {
      w: { K: ['h2'], Q: ['g1'], B: ['g2', 'h1'], N: ['f1', 'i2'], R: ['f2', 'i1'],
           P: ['f3', 'f4', 'g3', 'g4', 'h3', 'h4', 'i3', 'i4'] },
      b: { K: ['h14'], Q: ['g13'], B: ['g12', 'h15'], N: ['f11', 'i16'], R: ['f10', 'i17'],
           P: ['f8', 'f9', 'g10', 'g11', 'h12', 'h13', 'i14', 'i15'] },
    },
    build() {
      setTrigonalPawns();
      for (const cell of CELLS) {
        // Alfil: 12 rayos en zigzag (6 direcciones de deriva × 2 fases).
        const rays = [];
        for (let i = 0; i < 6; i++) {
          rays.push(zigzagBishopRay(cell, i, (i + 2) % 6));
          rays.push(zigzagBishopRay(cell, i, (i + 4) % 6));
        }
        cell.kovalBishop = rays.filter(r => r.length);
        // Caballo: un paso ortogonal y luego uno diagonal hacia fuera.
        const saltos = new Set();
        for (const dir of ROOK_DIRS) {
          const p = rookStep(cell, dir);
          if (!p) continue;
          for (const d of BISHOP_DIRS) {
            const t = bishopStep(p, d);
            if (t && t !== cell && dist(t, cell) > dist(p, cell)) saltos.add(t);
          }
        }
        cell.kovalKnight = [...saltos];
      }
    },
    pieces: {
      R: { rays: c => c.rookRays },
      B: { rays: c => c.kovalBishop },
      Q: { rays: c => c.rookRays.concat(c.kovalBishop) },
      N: { leaps: c => c.kovalKnight },
      K: { leaps: c => c.kingNbrs },
      P: { pawn: true },
    },
    slideGroups: () => [
      { rays: c => c.rookRays, typeAt: () => KOVAL_R },
      { rays: c => c.kovalBishop, typeAt: () => KOVAL_B },
    ],
    note: 'Triángulo de 81 casillas, juego de ajedrez normal sin piezas de ' +
      'fantasía. Los dos ejércitos ocupan los dos extremos de la base y el peón ' +
      'corona al llegar al final de su carril. Sin enroque: el autor dice que lo ' +
      'hay, pero no publica sobre qué casillas, así que aquí no se inventa.',
    help: [
      ['R', '<b>Torre ♜</b>: se desliza por los tres carriles que pasan por ella, cruzando aristas. Es exactamente la torre del ajedrez de Salas.'],
      ['B', '<b>Alfil ♝</b>: se desliza en diagonal, pero en zigzag: alterna dos direcciones diagonales de modo que la deriva neta va en línea recta. Atado al color de la casilla, y llega mucho más lejos que el alfil de Salas.'],
      ['Q', '<b>Dama ♛</b>: torre y alfil juntos.'],
      ['N', '<b>Caballo ♞</b>: un paso ortogonal y luego uno en diagonal hacia fuera; salta por encima de lo que haya.'],
      ['K', '<b>Rey ♚</b>: un paso a cualquier casilla que toque la suya.'],
      ['P', '<b>Peón ♟</b>: avanza un paso por su carril hacia el rival y captura en las tres diagonales de delante. Desde la tercera posición puede avanzar dos (que, como advierte el autor, se solapa con una de sus capturas).'],
    ],
    engine: {
      // Ajustados en la ronda 15: regresión sobre autojuego a profundidad 2
      // (fase barata), confirmados en la arena contra los valores clásicos.
      // El candidato "all" (con pesos posicionales) ganó +76 elo [48, 104].
      // Los pesos posicionales no se guardan aquí: se aplican como cfg en la
      // arena, pero el valor de pieza limpio es el que entra en variants.js.
      pieceValues: { P: 100, N: 277, B: 360, R: 469, Q: 785, K: 0 },
      mobility: 7.27,
    },
  },
};

// ===========================================================================
// Piedra, papel y tijera — cuatro modalidades sobre el hexágono de 96.
//
// Todas las figuras se mueven como el rey (un paso a cualquier casilla vecina
// por arista o por vértice), pero cada una solo puede capturar a las que
// vence en el juego de siempre: piedra 🪨 a tijera, tijera ✂️ a papel y papel
// 📄 a piedra (y en la versión de cinco, el lagarto 🦎 y Spock 🖖 con la regla
// de Big Bang Theory). Las restricciones van en el mapa `captures` de cada
// modalidad, que consulta canCapture() en rules.js.
//
// Dos parejas: sin rey (kingless: gana quien elimina TODAS las piezas del
// rival, estado 'wiped') y con rey (el rey captura todo y todos capturan al
// rey; el objetivo vuelve a ser el jaque mate; esa regla del rey no es un
// caso especial: está escrita dentro del propio mapa `captures`).
//
// Letras de tipo (fijas, viajan en las partidas guardadas): Piedra 'O',
// Papel 'A', Tijera 'T', Lagarto 'L', Spock 'S', Rey 'K'.
// ===========================================================================

// POSICIONES INICIALES PROVISIONALES, pendientes de ajuste. Para cambiarlas
// basta tocar estas listas: la fila delantera (11 casillas, donde van los
// peones en las modalidades clásicas) y la del fondo (9 casillas). Los dos
// bandos usan las mismas listas y las mismas columnas, así que quedan figuras
// iguales enfrentadas, como en las clásicas.
const RPS_FRONT = Array(11).fill('A');            // una fila entera de papeles
const RPS_BACK = ['O', 'T', 'O', 'T', 'O', 'T', 'O', 'T', 'O'];
const RPSLS_FRONT = Array(11).fill('A');
const RPSLS_BACK = ['O', 'T', 'L', 'S', 'O', 'S', 'L', 'T', 'O'];
// En las -rey, el rey ocupa el centro de la fila del fondo.
const conRey = fila => fila.map((t, i) => (i === 4 ? 'K' : t));

// Matrices de captura: tipo → tipos rivales capturables.
const RPS_CAPTURES = { O: ['T'], A: ['O'], T: ['A'] };
const RPSLS_CAPTURES = {
  O: ['T', 'L'],   // la piedra aplasta la tijera y aplasta al lagarto
  A: ['O', 'S'],   // el papel tapa la piedra y desautoriza a Spock
  T: ['A', 'L'],   // la tijera corta el papel y decapita al lagarto
  L: ['S', 'A'],   // el lagarto envenena a Spock y devora el papel
  S: ['T', 'O'],   // Spock rompe la tijera y vaporiza la piedra
};
// Con rey: cada mapa gana la fila del rey (captura todo) y la columna del rey
// (todos lo capturan, por eso cualquier pieza da jaque).
function capturesConRey(base) {
  const out = { K: Object.keys(base) };
  for (const [t, victimas] of Object.entries(base)) out[t] = victimas.concat('K');
  return out;
}

const RPS_HELP = {
  O: ['O', '<b>Piedra 🪨</b>: un paso a cualquier casilla que toque la suya (por arista o por vértice). Solo puede capturar tijeras (la piedra aplasta la tijera).'],
  A: ['A', '<b>Papel 📄</b>: se mueve igual. Solo puede capturar piedras (el papel envuelve la piedra).'],
  T: ['T', '<b>Tijera ✂️</b>: se mueve igual. Solo puede capturar papeles (la tijera corta el papel).'],
  O5: ['O', '<b>Piedra 🪨</b>: un paso a cualquier casilla que toque la suya (por arista o por vértice). Captura tijeras y lagartos (los aplasta).'],
  A5: ['A', '<b>Papel 📄</b>: se mueve igual. Captura piedras (las tapa) y a Spock (lo desautoriza).'],
  T5: ['T', '<b>Tijera ✂️</b>: se mueve igual. Captura papeles (los corta) y lagartos (los decapita).'],
  L5: ['L', '<b>Lagarto 🦎</b>: se mueve igual. Captura a Spock (lo envenena) y papeles (los devora).'],
  S5: ['S', '<b>Spock 🖖</b>: se mueve igual. Captura tijeras (las rompe) y piedras (las vaporiza).'],
  K: ['K', '<b>Rey ♚</b>: se mueve igual que las demás figuras, pero sin restricciones: puede capturar cualquier pieza rival. Y cualquier pieza rival puede capturarlo a él, así que todas dan jaque. El objetivo es el jaque mate de siempre.'],
};

// Fábrica de las cuatro: comparten tablero, filas, movimiento y motor.
function rpsVariant(extra) {
  return {
    board: 'hex4',
    promotionChoices: [],       // no hay peones, nadie corona
    edgePromotion: false,
    setup() {
      return {
        wBack: rowCells(1 - N), wPawns: rowCells(2 - N),
        bBack: rowCells(N), bPawns: rowCells(N - 1),
      };
    },
    // Sin peones, pero setVariant precalcula las tablas de peón sobre todas
    // las casillas, así que se montan igual (no las usa nadie).
    build() { setRowPawns(); },
    slideGroups: () => [],      // ninguna pieza deslizante
    engine: {
      // Valores planos provisionales: la evaluación dinámica (el valor de una
      // figura depende de cuántas presas y depredadores le queden) es de ai.js
      // y queda pendiente.
      pieceValues: { O: 100, A: 100, T: 100, L: 100, S: 100, K: 0 },
      mobility: 4,
    },
    ...extra,
  };
}

Object.assign(VARIANTS, {
  rps: rpsVariant({
    id: 'rps',
    name: 'Piedra, papel y tijera',
    full: 'Piedra, papel y tijera sobre el tablero triangular',
    kingless: true,
    captures: RPS_CAPTURES,
    backLayout: RPS_BACK,
    frontLayout: RPS_FRONT,
    pieces: {
      O: { leaps: c => c.kingNbrs },
      A: { leaps: c => c.kingNbrs },
      T: { leaps: c => c.kingNbrs },
    },
    note: 'Hexágono de 96 triángulos. Tres figuras que se mueven como el rey; ' +
      'cada una solo captura a la que vence: piedra a tijera, tijera a papel ' +
      'y papel a piedra. No hay jaque: gana quien deja al rival sin piezas.',
    help: [RPS_HELP.O, RPS_HELP.A, RPS_HELP.T],
  }),

  rpsls: rpsVariant({
    id: 'rpsls',
    name: 'Piedra, papel, tijera, lagarto, Spock',
    full: 'Piedra, papel, tijera, lagarto, Spock sobre el tablero triangular',
    kingless: true,
    captures: RPSLS_CAPTURES,
    backLayout: RPSLS_BACK,
    frontLayout: RPSLS_FRONT,
    pieces: {
      O: { leaps: c => c.kingNbrs },
      A: { leaps: c => c.kingNbrs },
      T: { leaps: c => c.kingNbrs },
      L: { leaps: c => c.kingNbrs },
      S: { leaps: c => c.kingNbrs },
    },
    note: 'Como Piedra, papel y tijera pero con las cinco figuras de la regla ' +
      'de Big Bang Theory: cada una captura exactamente a dos y es capturada ' +
      'por otras dos. Gana quien deja al rival sin piezas.',
    help: [RPS_HELP.O5, RPS_HELP.A5, RPS_HELP.T5, RPS_HELP.L5, RPS_HELP.S5],
  }),

  'rps-rey': rpsVariant({
    id: 'rps-rey',
    name: 'Piedra, papel y tijera con rey',
    full: 'Piedra, papel y tijera con rey sobre el tablero triangular',
    captures: capturesConRey(RPS_CAPTURES),
    backLayout: conRey(RPS_BACK),
    frontLayout: RPS_FRONT,
    pieces: {
      O: { leaps: c => c.kingNbrs },
      A: { leaps: c => c.kingNbrs },
      T: { leaps: c => c.kingNbrs },
      K: { leaps: c => c.kingNbrs },
    },
    note: 'Piedra, papel y tijera con un rey por bando: el rey captura ' +
      'cualquier pieza y cualquier pieza lo captura a él (todas dan jaque). ' +
      'El objetivo vuelve a ser el jaque mate.',
    help: [RPS_HELP.O, RPS_HELP.A, RPS_HELP.T, RPS_HELP.K],
  }),

  'rpsls-rey': rpsVariant({
    id: 'rpsls-rey',
    name: 'Piedra, papel, tijera, lagarto, Spock con rey',
    full: 'Piedra, papel, tijera, lagarto, Spock con rey sobre el tablero triangular',
    captures: capturesConRey(RPSLS_CAPTURES),
    backLayout: conRey(RPSLS_BACK),
    frontLayout: RPSLS_FRONT,
    pieces: {
      O: { leaps: c => c.kingNbrs },
      A: { leaps: c => c.kingNbrs },
      T: { leaps: c => c.kingNbrs },
      L: { leaps: c => c.kingNbrs },
      S: { leaps: c => c.kingNbrs },
      K: { leaps: c => c.kingNbrs },
    },
    note: 'Las cinco figuras de la regla de Big Bang Theory más un rey por ' +
      'bando: el rey captura cualquier pieza y cualquier pieza lo captura a ' +
      'él (todas dan jaque). El objetivo es el jaque mate.',
    help: [RPS_HELP.O5, RPS_HELP.A5, RPS_HELP.T5, RPS_HELP.L5, RPS_HELP.S5, RPS_HELP.K],
  }),
});

// Distancia en la retícula (mitad de la suma de diferencias absolutas).
function dist(p, q) {
  return (Math.abs(p.a - q.a) + Math.abs(p.b - q.b) + Math.abs(p.c - q.c)) / 2;
}

// --- modalidad activa ------------------------------------------------------

const DEFAULT_VARIANT = 'salas';
let V = null;

function variantList() {
  // `hidden`: modalidades que no salen en los selectores (las demos de
  // tessellations.js); se abren con ?modalidad=<id> en la URL.
  return Object.keys(VARIANTS).filter(id => !VARIANTS[id].hidden)
    .map(id => ({ id, name: VARIANTS[id].name }));
}

function setVariant(id) {
  const base = VARIANTS[id];
  if (!base) throw new Error('modalidad desconocida: ' + id);
  // Una modalidad puede heredar de otra y cambiar solo lo que la distingue
  // (así «Salas original» es «Salas» con edgePromotion en false).
  const v = base.inherits ? { ...VARIANTS[base.inherits], ...base } : base;
  // La lista de reglas de una modalidad heredada sale de la madre, cambiando
  // solo lo que la distingue.
  if (base.inherits && base.help === null) {
    v.help = VARIANTS[base.inherits].help.map(([t, texto]) => t !== 'P' ? [t, texto] : [t,
      '<b>Peón ♟</b>: avanza sin capturar a la casilla que tiene justo enfrente ' +
      '(azul) y captura en las dos casillas frontales diagonales (rojo). Puede ' +
      'avanzar dos veces en su primer movimiento y corona al llegar a la última ' +
      'fila. Los dos peones de los extremos no llegan: se quedan contra el borde ' +
      'sin casilla de avance, y solo salen de ahí capturando.']);
  }
  V = v;
  setGeometry(v.board);
  v.build();

  // Filas del borde y de peones, ya resueltas, para no recalcularlas.
  V.rows = v.setup ? v.setup() : null;
  // Índice de tipos de pieza presentes, en orden estable (Zobrist, valores).
  V.pieceTypes = Object.keys(v.pieces);

  // Todo lo del peón que depende de la modalidad se precalcula aquí y se
  // cuelga de la casilla. Son consultas del camino caliente de la búsqueda:
  // resolverlas con un `if` por modalidad en cada nodo costaría de verdad.
  // `porFilas`: los dos ejércitos se enfrentan fila contra fila (hexágono y
  // rectángulo) en vez de carril contra carril (Trigonal). Lo dice el tablero,
  // no la modalidad, ver BOARDS en geometry.js.
  const porFilas = BOARD.rowRanks;
  for (const cell of CELLS) {
    cell.promoFor = {};
    cell.pawnProg = {};
    cell.pawnPush = {};
    for (const color of ['w', 'b']) {
      // ¿corona aquí? Por filas, al llegar a la fila del borde rival. En
      // Trigonal, donde los dos ejércitos ocupan los dos extremos de la base,
      // al llegar al final del propio carril.
      cell.promoFor[color] = porFilas
        ? (color === 'w' ? cell.b === N : cell.b === 1 - N)
        : cell.pawnAdv[color].length === 0;

      // Avance hacia la coronación: 0 al salir, 1 al coronar.
      if (porFilas) {
        const span = 2 * N - 1;
        cell.pawnProg[color] = color === 'w'
          ? (cell.b - (1 - N)) / span
          : (N - cell.b) / span;
      } else {
        const fila = rowCells(cell.b);
        const i = fila.indexOf(cell);
        const span = Math.max(1, fila.length - 1);
        cell.pawnProg[color] = color === 'w' ? i / span : (span - i) / span;
      }

      // Casillas a las que puede AVANZAR sin capturar, ya con la regla de
      // coronación de flanco aplicada: cuando el peón se queda sin casilla de
      // enfrente, sus casillas de captura pasan a valer también como avance
      // (haya o no pieza que capturar), que es lo que le deja seguir hacia la
      // coronación pegado al borde del tablero.
      const adv = cell.pawnAdv[color];
      cell.pawnPush[color] = (adv.length || !v.edgePromotion) ? adv : cell.pawnCap[color];
    }
  }

  // Doble paso inicial. Se precalculan las casillas desde las que se permite y
  // la casilla a la que lleva, porque la condición no es la misma en todas las
  // modalidades y el destino tampoco se reconoce igual:
  //
  //   por filas  desde la fila de peones (equivale a «el peón no se ha movido»,
  //              porque un peón nunca puede volver a su casilla de salida) y el
  //              destino queda dos filas más allá
  //   Trigonal   desde la 3ª posición de la fila, que es lo que dice Koval; los
  //              peones que empiezan en la 4ª no lo tienen. Aquí el doble paso
  //              NO cambia de fila, así que mirar la fila de llegada no serviría
  //              para reconocerlo: por eso se guarda la casilla concreta.
  for (const cell of CELLS) {
    cell.pawnTwo = {};        // casilla del doble paso, o null
    cell.pawnDoubleOk = {};   // ¿se permite desde aquí?
    for (const color of ['w', 'b']) {
      const uno = cell.pawnAdv[color][0] || null;
      const dos = uno ? (uno.pawnAdv[color][0] || null) : null;
      cell.pawnTwo[color] = dos;
      if (porFilas) {
        cell.pawnDoubleOk[color] = color === 'w' ? cell.b === 2 - N : cell.b === N - 1;
      } else {
        const fila = rowCells(cell.b);
        const i = fila.indexOf(cell);
        cell.pawnDoubleOk[color] = color === 'w' ? i === 2 : i === fila.length - 3;
      }
    }
  }

  buildMoveTables(v);
  buildAttackTables(v);
  // ai.js se engancha aquí para rehacer las tablas Zobrist y vaciar la tabla
  // de transposición. Se comprueba que exista porque variants.js se carga
  // antes que ai.js, y también se usa sin motor en las pruebas.
  if (typeof onVariantChange === 'function') onVariantChange();
  return V;
}

// --- tablas de movimiento por casilla --------------------------------------
//
// Cada casilla acaba con `rays` y `leaps` indexados por tipo de pieza, ya
// resueltos para esta modalidad. Hay dos razones para dejarlo en datos y no en
// funciones:
//
//   · La búsqueda no vuelve a componer nada: la dama no concatena sus dos
//     familias de rayos en cada nodo, están concatenadas de antemano.
//   · El worker de la IA (ai-async.js) recibe el grafo de casillas por
//     clonado estructurado, que copia datos pero NO funciones. Con accesores
//     en forma de closure, dentro del worker no habría forma de mover.
function buildMoveTables(v) {
  for (const cell of CELLS) {
    cell.rays = {};
    cell.leaps = {};
    for (const t of V.pieceTypes) {
      const spec = v.pieces[t];
      if (spec.rays) cell.rays[t] = spec.rays(cell).filter(r => r.length);
      else if (spec.leaps) cell.leaps[t] = spec.leaps(cell);
    }
  }
}

// --- tablas inversas de ataque --------------------------------------------
//
// La búsqueda pregunta miles de veces «¿está atacada esta casilla?», y la
// respuesta rápida consiste en mirar DESDE la casilla hacia fuera en vez de
// recorrer todas las piezas rivales. Eso solo es correcto si las tablas de
// movimiento se pueden recorrer al revés, y no siempre se puede dar por hecho:
//
//   · Saltadoras. Que A salte a B no obliga a que B salte a A. El caballo de
//     Salas sí es simétrico, pero las piezas compuestas de Dekle no tienen por
//     qué serlo. Aquí se invierte la tabla de verdad, casilla por casilla, así
//     que la simetría deja de importar.
//
//   · Peones. Igual: se invierte la tabla de capturas en lugar de suponer que
//     la del color contrario sirve de espejo.
//
//   · Deslizantes. El rayo sí se recorre al revés (todas las familias de
//     rayos que usamos son reversibles), pero OJO con el tipo de pieza: en
//     Dekle la torre y el alfil son las dos mitades de un mismo haz de rayos,
//     partido según el primer paso cruce una arista o un vértice. Como los
//     pasos de ese rayo van alternando arista/vértice, el tipo de pieza que
//     ataca desde el rayo VA CAMBIANDO con la distancia: la vecina ataca como
//     torre, la siguiente como alfil, la siguiente como torre… Por eso el haz
//     de Dekle lleva `alterna: true` y se anota qué tipo corresponde a cada
//     paso, en vez de un tipo fijo para todo el rayo.
function buildAttackTables(v) {
  // Saltadoras y peones: inversión directa.
  const saltadoras = V.pieceTypes.filter(t => v.pieces[t].leaps);
  for (const cell of CELLS) {
    cell.leapAttackers = {};
    for (const t of saltadoras) cell.leapAttackers[t] = [];
    cell.pawnAttackers = { w: [], b: [] };
  }
  for (const origen of CELLS) {
    for (const t of saltadoras) {
      for (const destino of v.pieces[t].leaps(origen)) destino.leapAttackers[t].push(origen);
    }
    for (const color of ['w', 'b']) {
      for (const destino of origen.pawnCap[color]) destino.pawnAttackers[color].push(origen);
    }
  }

  // Deslizantes: cada modalidad declara sus haces en `slideGroups`, y aquí se
  // aplanan a una lista por casilla, `cell.atk`, con los tipos ya resueltos
  // posición a posición. Igual que las tablas de movimiento, queda en datos
  // puros para que el worker pueda usarla tras el clonado.
  for (const cell of CELLS) cell.atk = [];
  for (const g of v.slideGroups()) {
    for (const cell of CELLS) {
      for (const ray of g.rays(cell)) {
        if (!ray.length) continue;
        cell.atk.push({ ray, types: ray.map((_, i) => g.typeAt(ray, i, cell)) });
      }
    }
  }
}

// Fila del borde de un color, de izquierda a derecha, para el enroque y la
// posición inicial. Solo la usan las modalidades con `backLayout`.
function backRow(color) {
  return color === 'w' ? V.rows.wBack : V.rows.bBack;
}

setVariant(DEFAULT_VARIANT);
