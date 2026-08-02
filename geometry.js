// geometry.js — Retícula triangular y tableros.
//
// Cada casilla es un triángulo equilátero identificado por coordenadas
// de carril (a, b, c):
//   · a + b + c = 2  →  triángulo hacia arriba (▲)
//   · a + b + c = 1  →  triángulo hacia abajo (▽)
// La coordenada b crece hacia arriba (filas horizontales); a y c siguen
// las otras dos direcciones de la retícula (a crece hacia la derecha).
//
// Los vértices de la retícula se identifican por (α, β) enteros; el vértice
// (α, β) está en x = EDGE·(α + β/2), y = −ROW_H·β (y hacia abajo), antes de
// aplicar la rotación del tablero.
//
// SOBRE LOS DOS TABLEROS
//
// La misma retícula sirve para las tres formas que usan las modalidades; lo
// único que cambia es qué casillas pertenecen al tablero:
//
//   hex4   hexágono de lado 4:   1−4 ≤ a, b, c ≤ 4      → 96 casillas
//   tri9   triángulo de lado 9:  a, b, c ≥ −2           → 81 casillas
//   rect8  rectángulo de 8×8:    hex4 sin los dos picos → 64 casillas
//
// Que el triángulo salga de una sola desigualdad no es casualidad: acotar las
// tres coordenadas por abajo recorta un triángulo grande de la retícula, y con
// la cota en −2 salen 45 ▲ + 36 ▽ = 81, que es el tablero de Trigonal Chess.
//
// El tablero activo se elige con setGeometry(); CELLS, CELL_MAP, cellName y
// compañía son `let` y se reasignan ahí. Todo lo que dependa del tablero debe
// leerlos en el momento de usarlos, no guardarse una copia al cargar el módulo.

const EDGE = 44;                        // lado de cada triángulo (px del viewBox)
const ROW_H = EDGE * Math.sqrt(3) / 2;  // altura de cada fila

function keyOf(a, b, c) { return a + ',' + b + ',' + c; }

// --- direcciones de la retícula (independientes del tablero) ---------------

// Torre: una dirección se codifica como [i, j] (índices 0=a, 1=b, 2=c): desde
// un ▽ se suma 1 a la coordenada i; desde un ▲ se resta 1 a la j. Cada paso
// cruza una arista y mantiene fija la tercera coordenada (el carril).
const ROOK_DIRS = [[0, 1], [1, 0], [0, 2], [2, 0], [1, 2], [2, 1]];
function laneOf(dir) { return 3 - dir[0] - dir[1]; }

// Alfil: desplazamientos e_i − e_j; saltan de vértice a vértice y conservan la
// orientación del triángulo (el alfil nunca cambia de orientación).
const BISHOP_DIRS = [
  [1, -1, 0], [1, 0, -1], [0, 1, -1], [-1, 1, 0], [-1, 0, 1], [0, -1, 1],
];

// Elefante: 6 rayos perpendiculares a los lados, que alternan cruzar una
// arista y atravesar un vértice. Dirección = (k, signo).
const ELEPHANT_DIRS = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]];

// Caballo (el de Salas): desde un ▲ salta a las 12 casillas ▽ cuyas
// coordenadas difieren en una permutación de (2, −2, −1) o de (1, 0, −2);
// desde un ▽, a los desplazamientos opuestos. Dos anillos de 6 casillas.
const KNIGHT_DELTAS = (() => {
  const out = [];
  const idx = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const base of [[2, -2, -1], [1, 0, -2]]) {
    for (const p of idx) out.push([base[p[0]], base[p[1]], base[p[2]]]);
  }
  return out;
})();

// --- especificación de cada tablero ---------------------------------------
//
// `size`     parámetro de forma (lado del hexágono / lado del triángulo)
// `has`      ¿pertenece (a,b,c) al tablero?
// `rotate`   cuartos de vuelta en sentido antihorario al dibujar
// `rowRanks` ¿las filas de la retícula (b constante) hacen de filas de ajedrez?
//            Si sí, los dos ejércitos ocupan la fila de arriba y la de abajo y
//            el peón corona al llegar a la del rival; si no (Trigonal), corona
//            al llegar al final de su propio carril. Lo consulta variants.js.
// `name`     nombre legible de una casilla
// `parse`    nombre legible → coordenadas (o null)
const BOARDS = {
  // Hexágono de lado 4: el tablero del ajedrez de Salas y el de Dekle 1986.
  //
  // Nombre de casilla: B1A, N4H…
  //   B o N   color: Blanca si apunta hacia arriba, Negra si apunta hacia abajo
  //   1..8    la franja HORIZONTAL, que es la coordenada b (1 abajo, 8 arriba)
  //   A..H    la franja de abajo-derecha a arriba-izquierda, la coordenada c
  //           (A la de más a la izquierda, H la de más a la derecha)
  //
  // Una franja es el recorrido que haría una torre de un borde del tablero al
  // otro, y por cada casilla pasan tres. Nombrarla por DOS franjas más el color
  // basta: la tercera coordenada sale sola, porque a+b+c vale 2 en las casillas
  // que apuntan hacia arriba y 1 en las que apuntan hacia abajo. Comprobado que
  // (color, b, c) identifica una sola casilla de las 96.
  //
  // La casilla de más abajo del tablero es B1A y la de más a la derecha, N4H.
  hex4: {
    size: 4,
    rotate: 0,
    rowRanks: true,
    has(a, b, c) {
      const N = 4;
      return a >= 1 - N && a <= N && b >= 1 - N && b <= N && c >= 1 - N && c <= N;
    },
    name(cell) {
      const N = 4;
      return (cell.up ? 'B' : 'N') + (cell.b - (1 - N) + 1) + 'ABCDEFGH'[N - cell.c];
    },
    parse(str) {
      const N = 4;
      const m = /^([BN])(\d)([A-H])$/i.exec(str);
      if (!m) return null;
      const up = m[1].toUpperCase() === 'B';
      const b = Number(m[2]) - 1 + (1 - N);
      const c = N - 'ABCDEFGH'.indexOf(m[3].toUpperCase());
      return [(up ? 2 : 1) - b - c, b, c];
    },
  },

  // Rectángulo de 8×8: el tablero de Salas 1998 (Original).
  //
  // Es el hexágono de arriba con los dos picos laterales cortados: se quedan
  // sus 8 filas, recortadas todas a 8 casillas, y salen 64 triángulos. Los
  // bordes de la izquierda y de la derecha van en zigzag, porque la casilla
  // del extremo de cada fila apunta hacia arriba o hacia abajo alternándose.
  //
  // La COLUMNA de una casilla es a − c: su centro está en x = EDGE·(a − c)/2,
  // apunte hacia arriba o hacia abajo, así que cada paso a la derecha dentro
  // de una fila la sube en 1. Acotarla a [−4, 3] deja 8 columnas, y las cotas
  // del hexágono (−3 ≤ a, c ≤ 4) se cumplen entonces solas.
  //
  // Nombre de casilla: a1, e4, h8 — el del ajedrez de siempre, y por una vez
  // sin letra de color, porque aquí (columna, fila) ya identifica UNA casilla:
  // dentro de una columna las filas van alternando ▲ y ▽, de modo que la
  // orientación sale de la paridad de b + (a − c). Las blancas ocupan las
  // filas 1 y 2, las negras la 7 y la 8.
  rect8: {
    size: 4,
    rotate: 0,
    rowRanks: true,
    has(a, b, c) {
      const N = 4;
      return b >= 1 - N && b <= N && a - c >= -N && a - c <= N - 1;
    },
    name(cell) {
      const N = 4;
      return 'abcdefgh'[cell.a - cell.c + N] + (cell.b - (1 - N) + 1);
    },
    parse(str) {
      const N = 4;
      const m = /^([a-h])([1-8])$/i.exec(str);
      if (!m) return null;
      const col = 'abcdefgh'.indexOf(m[1].toLowerCase()) - N;
      const b = Number(m[2]) - 1 + (1 - N);
      // & 1 y no % 2: la paridad de un número negativo (b + col puede serlo)
      const sum = ((b + col) & 1) === 0 ? 2 : 1;
      const a = (sum - b + col) / 2;
      return [a, b, sum - a - b];
    },
  },

  // Triángulo de lado 9: el tablero de Trigonal Chess (Koval, 2023).
  //
  // Nombre de casilla: a1, d3, h13, i17… (el del autor)
  //   a..i    la fila, que es la coordenada b al revés: `a` es el vértice
  //           (1 casilla) e `i` la base (17 casillas)
  //   1..17   la posición dentro de la fila, de izquierda a derecha
  //
  // Cada fila alterna ▲ ▽ ▲ ▽ … empezando y acabando en ▲, así que la posición
  // sale de la coordenada a: pos = 2·(a+2) + (▲ ? 1 : 2). La fila b tiene
  // 13 − 2b casillas.
  //
  // Se dibuja girado un cuarto de vuelta respecto a la retícula natural, para
  // que quede como lo publicó Koval: vértice a la izquierda, base vertical a la
  // derecha, blancas abajo y negras arriba.
  tri9: {
    size: 9,
    rotate: 1,
    has(a, b, c) { return a >= -2 && b >= -2 && c >= -2; },
    name(cell) {
      return 'abcdefghi'[6 - cell.b] + (2 * (cell.a + 2) + (cell.up ? 1 : 2));
    },
    parse(str) {
      const m = /^([a-i])(\d{1,2})$/i.exec(str);
      if (!m) return null;
      const b = 6 - 'abcdefghi'.indexOf(m[1].toLowerCase());
      const pos = Number(m[2]);
      const up = pos % 2 === 1;
      const a = ((pos - (up ? 1 : 2)) / 2) - 2;
      return [a, b, (up ? 2 : 1) - a - b];
    },
  },
};

// --- estado del tablero activo --------------------------------------------
// `let` a propósito: setGeometry() los reasigna al cambiar de modalidad.

let BOARD_ID = null;
let BOARD = null;
let N = 0;              // parámetro de forma del tablero activo
let CELLS = [];
let CELL_MAP = new Map();
let BBOX = null;

function getCell(a, b, c) { return CELL_MAP.get(keyOf(a, b, c)) || null; }
function cellName(cell) { return BOARD.name(cell); }
function cellFromName(nombre) {
  const co = BOARD.parse(String(nombre).trim());
  return co ? getCell(co[0], co[1], co[2]) : null;
}

// Casillas de una fila de la retícula (b constante), en orden.
//
// El orden es el de la retícula, no el de la pantalla: primero por la
// coordenada a y, a igualdad de a, el ▲ antes que el ▽. En el hexágono sin
// girar eso coincide exactamente con ordenar por cx (izquierda a derecha),
// pero en un tablero girado cx ya no sirve, porque una fila de la retícula
// se dibuja entonces como una columna.
function rowCells(b) {
  return CELLS.filter(c => c.b === b)
    .sort((p, q) => (p.a - q.a) || ((p.up ? 0 : 1) - (q.up ? 0 : 1)));
}

// --- pasos elementales -----------------------------------------------------
// Devuelven la casilla vecina en esa dirección, o null si se sale del tablero.

function rookStep(cell, dir) {
  const co = [cell.a, cell.b, cell.c];
  if (cell.up) co[dir[1]] -= 1; else co[dir[0]] += 1;
  return getCell(co[0], co[1], co[2]);
}

function bishopStep(cell, d) {
  return getCell(cell.a + d[0], cell.b + d[1], cell.c + d[2]);
}

function elephantStep(cell, k, sign) {
  const others = cell.up
    ? (sign === 1 ? -1 : 0)
    : (sign === 1 ? 0 : 1);
  const co = [cell.a + others, cell.b + others, cell.c + others];
  co[k] += sign - others;
  return getCell(co[0], co[1], co[2]);
}

// Rayo completo: repite `step` desde `cell` hasta salirse del tablero.
function rayFrom(cell, step) {
  const ray = [];
  let cur = step(cell);
  while (cur) { ray.push(cur); cur = step(cur); }
  return ray;
}

// --- construcción del tablero ---------------------------------------------

function setGeometry(id) {
  if (BOARD_ID === id) return;
  const spec = BOARDS[id];
  if (!spec) throw new Error('tablero desconocido: ' + id);
  BOARD_ID = id;
  BOARD = spec;
  N = spec.size;

  // Un cuarto de vuelta antihorario en pantalla (y crece hacia abajo).
  const rot = spec.rotate & 3;
  const vertexXY = (alpha, beta) => {
    let x = EDGE * (alpha + beta / 2), y = -ROW_H * beta;
    for (let i = 0; i < rot; i++) { const t = x; x = y; y = -t; }
    return [x, y];
  };

  CELLS = [];
  CELL_MAP = new Map();

  // Recorrido generoso de la retícula: se filtra con spec.has(). El rango
  // cubre de sobra las dos formas (el triángulo llega hasta 6 en una
  // coordenada cuando las otras dos están en su mínimo, −2).
  const LO = -12, HI = 12;
  for (let a = LO; a <= HI; a++) {
    for (let b = LO; b <= HI; b++) {
      for (const sum of [1, 2]) {
        const c = sum - a - b;
        if (c < LO || c > HI) continue;
        if (!spec.has(a, b, c)) continue;
        const up = (sum === 2);
        const corners = up
          ? [[a - 1, b - 1], [a - 1, b], [a, b - 1]]
          : [[a, b], [a, b - 1], [a - 1, b]];
        const pts = corners.map(v => vertexXY(v[0], v[1]));
        const cell = {
          a, b, c, up,
          // índice denso y estable: lo usan las tablas Zobrist y de historia
          // de ai.js; es un número plano, así que sobrevive al clon
          // estructurado hacia el worker (a diferencia del orden de un Map)
          idx: CELLS.length,
          key: keyOf(a, b, c),
          corners, pts,
          cx: (pts[0][0] + pts[1][0] + pts[2][0]) / 3,
          cy: (pts[0][1] + pts[1][1] + pts[2][1]) / 3,
          edgeNbrs: [],     // vecinas por arista (3 como máximo)
          kingNbrs: [],     // vecinas por arista o vértice (12 como máximo)
          rookRays: [],     // 6 rayos de torre: listas de casillas en orden
          bishopRays: [],   // 6 rayos de alfil
          elephantRays: [], // 6 rayos de elefante
          knightTargets: [],
        };
        CELLS.push(cell);
        CELL_MAP.set(cell.key, cell);
      }
    }
  }

  // --- vecindades, calculadas a partir de los vértices compartidos ---
  const byCorner = new Map();
  for (const cell of CELLS) {
    for (const v of cell.corners) {
      const k = v[0] + ',' + v[1];
      if (!byCorner.has(k)) byCorner.set(k, []);
      byCorner.get(k).push(cell);
    }
  }
  for (const cell of CELLS) {
    const shared = new Map();  // casilla vecina → nº de vértices compartidos
    for (const v of cell.corners) {
      for (const other of byCorner.get(v[0] + ',' + v[1])) {
        if (other !== cell) shared.set(other, (shared.get(other) || 0) + 1);
      }
    }
    for (const [other, n] of shared) {
      cell.kingNbrs.push(other);
      if (n === 2) cell.edgeNbrs.push(other);
    }
  }

  // --- rayos y saltos comunes ---
  for (const cell of CELLS) {
    for (const dir of ROOK_DIRS) cell.rookRays.push(rayFrom(cell, c => rookStep(c, dir)));
    for (const d of BISHOP_DIRS) cell.bishopRays.push(rayFrom(cell, c => bishopStep(c, d)));
    for (const [k, sign] of ELEPHANT_DIRS) {
      cell.elephantRays.push(rayFrom(cell, c => elephantStep(c, k, sign)));
    }
    const s = cell.up ? 1 : -1;
    for (const d of KNIGHT_DELTAS) {
      const t = getCell(cell.a + s * d[0], cell.b + s * d[1], cell.c + s * d[2]);
      if (t) cell.knightTargets.push(t);
    }
  }

  // --- caja del tablero, para el viewBox del SVG ---
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const cell of CELLS) {
    for (const [x, y] of cell.pts) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const m = EDGE * 0.3;
  BBOX = { x: minX - m, y: minY - m, w: maxX - minX + 2 * m, h: maxY - minY + 2 * m };
}

// Tablero por defecto: el del ajedrez de Salas. Las modalidades lo cambian a
// través de setVariant() (variants.js), que llama aquí.
setGeometry('hex4');
