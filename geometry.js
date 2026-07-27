// geometry.js — Retícula triangular y tablero hexagonal.
//
// Cada casilla es un triángulo equilátero identificado por coordenadas
// de carril (a, b, c):
//   · a + b + c = 2  →  triángulo hacia arriba (▲)
//   · a + b + c = 1  →  triángulo hacia abajo (▽)
// El tablero es un hexágono de lado N: las casillas con 1−N ≤ a, b, c ≤ N.
// La coordenada b crece hacia arriba (filas horizontales); a y c siguen
// las otras dos direcciones de la retícula (a crece hacia la derecha).
//
// Los vértices de la retícula se identifican por (α, β) enteros; el vértice
// (α, β) está en pantalla en x = EDGE·(α + β/2), y = −ROW_H·β (y hacia abajo).

const N = 4;                            // lado del hexágono (en triángulos)
const EDGE = 44;                        // lado de cada triángulo (px del viewBox)
const ROW_H = EDGE * Math.sqrt(3) / 2;  // altura de cada fila

const CELLS = [];
const CELL_MAP = new Map();

function keyOf(a, b, c) { return a + ',' + b + ',' + c; }
function getCell(a, b, c) { return CELL_MAP.get(keyOf(a, b, c)) || null; }

function vertexXY(alpha, beta) {
  return [EDGE * (alpha + beta / 2), -ROW_H * beta];
}

// --- construcción de las casillas ---
for (let a = 1 - N; a <= N; a++) {
  for (let b = 1 - N; b <= N; b++) {
    for (const sum of [1, 2]) {
      const c = sum - a - b;
      if (c < 1 - N || c > N) continue;
      const up = (sum === 2);
      const corners = up
        ? [[a - 1, b - 1], [a - 1, b], [a, b - 1]]
        : [[a, b], [a, b - 1], [a - 1, b]];
      const pts = corners.map(v => vertexXY(v[0], v[1]));
      const cell = {
        a, b, c, up,
        // índice denso y estable (0..95): lo usan las tablas Zobrist y de
        // historia de ai.js; es un número plano, así que sobrevive al clon
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
        pawnAdv: { w: [], b: [] },  // casillas de avance del peón
        pawnCap: { w: [], b: [] },  // casillas de captura del peón
      };
      CELLS.push(cell);
      CELL_MAP.set(cell.key, cell);
    }
  }
}

// --- vecindades, calculadas a partir de los vértices compartidos ---
{
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
}

// --- direcciones de torre ---
// Una dirección se codifica como [i, j] (índices 0=a, 1=b, 2=c): desde un ▽
// se suma 1 a la coordenada i; desde un ▲ se resta 1 a la j. Cada paso cruza
// una arista y mantiene fija la tercera coordenada (el carril).
const ROOK_DIRS = [[0, 1], [1, 0], [0, 2], [2, 0], [1, 2], [2, 1]];
function laneOf(dir) { return 3 - dir[0] - dir[1]; }

function rookStep(cell, dir) {
  const co = [cell.a, cell.b, cell.c];
  if (cell.up) co[dir[1]] -= 1; else co[dir[0]] += 1;
  return getCell(co[0], co[1], co[2]);
}

// --- direcciones de alfil ---
// Desplazamientos e_i − e_j: saltan de vértice a vértice y conservan la
// orientación del triángulo (el alfil nunca cambia de orientación).
const BISHOP_DIRS = [
  [1, -1, 0], [1, 0, -1], [0, 1, -1], [-1, 1, 0], [-1, 0, 1], [0, -1, 1],
];
function bishopStep(cell, d) {
  return getCell(cell.a + d[0], cell.b + d[1], cell.c + d[2]);
}

// --- saltos de caballo ---
// Desde un ▲, el caballo salta a las 12 casillas ▽ cuyas coordenadas difieren
// en una permutación de (2, −2, −1) o de (1, 0, −2); desde un ▽, a los
// desplazamientos opuestos (la misma figura girada 180°). Son dos anillos de
// 6 casillas alrededor del caballo, siempre de orientación contraria.
const KNIGHT_DELTAS = (() => {
  const out = [];
  const idx = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const base of [[2, -2, -1], [1, 0, -2]]) {
    for (const p of idx) out.push([base[p[0]], base[p[1]], base[p[2]]]);
  }
  return out;
})();

// --- direcciones de elefante ---
// El elefante se desliza en línea recta hacia cualquiera de sus tres vecinas
// por arista o en el sentido opuesto: 6 rayos perpendiculares a los lados,
// que alternan cruzar una arista y atravesar un vértice.
// Dirección = (k, signo): la coordenada k cambia en ±1; las otras dos
// dependen de la orientación de la casilla actual.
const ELEPHANT_DIRS = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]];

function elephantStep(cell, k, sign) {
  const others = cell.up
    ? (sign === 1 ? -1 : 0)
    : (sign === 1 ? 0 : 1);
  const co = [cell.a + others, cell.b + others, cell.c + others];
  co[k] += sign - others;
  return getCell(co[0], co[1], co[2]);
}

// --- precálculo de rayos, saltos de caballo y pasos de peón ---
for (const cell of CELLS) {
  for (const dir of ROOK_DIRS) {
    const ray = [];
    let cur = rookStep(cell, dir);
    while (cur) { ray.push(cur); cur = rookStep(cur, dir); }
    cell.rookRays.push(ray);
  }
  for (const d of BISHOP_DIRS) {
    const ray = [];
    let cur = bishopStep(cell, d);
    while (cur) { ray.push(cur); cur = bishopStep(cur, d); }
    cell.bishopRays.push(ray);
  }
  for (const [k, sign] of ELEPHANT_DIRS) {
    const ray = [];
    let cur = elephantStep(cell, k, sign);
    while (cur) { ray.push(cur); cur = elephantStep(cur, k, sign); }
    cell.elephantRays.push(ray);
  }

  // Caballo: salta (por encima de lo que haya) a las casillas de KNIGHT_DELTAS.
  const { a, b, c } = cell;
  {
    const s = cell.up ? 1 : -1;
    for (const d of KNIGHT_DELTAS) {
      const t = getCell(a + s * d[0], b + s * d[1], c + s * d[2]);
      if (t) cell.knightTargets.push(t);
    }
  }

  // Peón: avanza (sin capturar) a la casilla frontal central —la que tiene
  // justo enfrente, por arista en un caso y por vértice en el otro— y captura
  // en las dos casillas frontales diagonales. Las blancas van hacia b
  // creciente; las negras, hacia b decreciente.
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

// --- caja del tablero, para el viewBox del SVG ---
const BBOX = (() => {
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
  return { x: minX - m, y: minY - m, w: maxX - minX + 2 * m, h: maxY - minY + 2 * m };
})();
