// tessellations.js — Teselaciones del plano distintas de la triangular.
//
// geometry.js construye tableros de casillas TRIANGULARES a partir de su
// retícula (a, b, c). Este módulo añade tableros hechos de otras teselaciones
// —cuadrados, hexágonos, ladrillos…— sin tocar esa retícula: cada tablero
// nuevo se registra en BOARDS con un método `teselacion()` que devuelve las
// casillas ya construidas, y setGeometry() delega en él (ver geometry.js).
//
// EL CONTRATO DE UNA CASILLA
//
// Del recorrido de rules.js, variants.js, ai.js y script.js sale lo que el
// resto del código espera encontrar colgado de cada casilla:
//
//   key, idx        identificador "a,b,c" y número denso (Zobrist, worker)
//   a, b, c         coordenadas; aquí a = columna, b = fila y c = 0.
//                   b es lo único con significado fuera (rowCells, pawnProg);
//                   a solo ordena dentro de la fila.
//   up              booleano que reparte las clases CSS light/dark; en los
//                   triángulos es la orientación, aquí el color del damero
//   pts, cx, cy     polígono (¡de cualquier número de lados!) y su centro
//   edgeNbrs        vecinas por ARISTA (comparten un lado)
//   kingNbrs        vecinas por arista o por VÉRTICE: la vecindad del rey, y
//                   la única que necesitan las modalidades tipo PPT
//   rookRays, bishopRays, elephantRays, knightTargets
//                   específicos de la retícula triangular: aquí quedan
//                   VACÍOS. Una modalidad sobre estas teselaciones no debe
//                   declararlos en `pieces` (ver los límites, al final).
//
// Y del tablero (la entrada de BOARDS): size, rotate, rowRanks, name(cell) y
// parse(str). Con rowRanks: true, variants.js trata la fila b como fila de
// ajedrez (coronación, avance del peón), igual que en el hexágono.
//
// CÓMO SE CALCULAN LAS VECINDADES
//
// Igual que en geometry.js: dos casillas son vecinas por arista si su
// polígono comparte DOS vértices o más, y solo por vértice si comparten UNO.
// Para que eso funcione en teselaciones donde una arista de una casilla toca
// media arista de otra (los ladrillos), el polígono debe llevar como vértice
// todo punto donde concurran tres o más casillas, aunque para el dibujo sea
// un punto interior de un lado (los ladrillos llevan el punto medio de sus
// lados largos). Los vértices se comparan redondeados a centésimas de px,
// que absorbe el error de coma flotante de los centros hexagonales.

// --- construcción genérica -------------------------------------------------

// `raw`: lista de { a, b, up, nombre, pts }. Devuelve las estructuras que
// setGeometry() necesita reasignar: CELLS, CELL_MAP y BBOX, con todas las
// casillas ya rematadas según el contrato de arriba.
function construirTeselacion(raw) {
  const cells = [];
  const map = new Map();
  for (const r of raw) {
    const pts = r.pts;
    const cell = {
      a: r.a, b: r.b, c: 0, up: r.up,
      idx: cells.length,
      key: keyOf(r.a, r.b, 0),
      nombre: r.nombre,
      pts,
      cx: pts.reduce((s, p) => s + p[0], 0) / pts.length,
      cy: pts.reduce((s, p) => s + p[1], 0) / pts.length,
      edgeNbrs: [],
      kingNbrs: [],
      // Tablas de la retícula triangular: vacías a propósito (ver arriba).
      rookRays: [],
      bishopRays: [],
      elephantRays: [],
      knightTargets: [],
    };
    cells.push(cell);
    map.set(cell.key, cell);
  }

  // Vecindades por vértices compartidos, redondeando a centésimas de px.
  const porVertice = new Map();
  const vkey = p => Math.round(p[0] * 100) + ',' + Math.round(p[1] * 100);
  for (const cell of cells) {
    for (const p of cell.pts) {
      const k = vkey(p);
      if (!porVertice.has(k)) porVertice.set(k, []);
      porVertice.get(k).push(cell);
    }
  }
  for (const cell of cells) {
    const compartidos = new Map();   // vecina → nº de vértices en común
    for (const p of cell.pts) {
      for (const otra of porVertice.get(vkey(p))) {
        if (otra !== cell) compartidos.set(otra, (compartidos.get(otra) || 0) + 1);
      }
    }
    for (const [otra, n] of compartidos) {
      cell.kingNbrs.push(otra);
      if (n >= 2) cell.edgeNbrs.push(otra);
    }
  }

  // Caja para el viewBox, con el mismo margen que geometry.js.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const cell of cells) {
    for (const [x, y] of cell.pts) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const m = EDGE * 0.3;
  return {
    CELLS: cells,
    CELL_MAP: map,
    BBOX: { x: minX - m, y: minY - m, w: maxX - minX + 2 * m, h: maxY - minY + 2 * m },
  };
}

// Registra en BOARDS un tablero teselado. `size` es el parámetro de forma
// (variants.js hace cuentas con N = size para la coronación por filas, que
// aquí no significan nada mientras la modalidad no tenga peones) y
// `hacerCasillas()` devuelve la lista `raw` de construirTeselacion.
function registrarTeselacion(id, size, hacerCasillas) {
  const porNombre = new Map();
  BOARDS[id] = {
    size,
    rotate: 0,
    rowRanks: true,
    // has() no hace falta: setGeometry no recorre la retícula para estos
    // tableros, delega aquí (ver la rama spec.teselacion en geometry.js).
    name(cell) { return cell.nombre; },
    parse(str) {
      const cell = porNombre.get(String(str).trim().toLowerCase());
      return cell ? [cell.a, cell.b, cell.c] : null;
    },
    teselacion() {
      const built = construirTeselacion(hacerCasillas());
      porNombre.clear();
      for (const cell of built.CELLS) porNombre.set(cell.nombre.toLowerCase(), cell);
      return built;
    },
  };
}

// --- teselación cuadrada: square8 ------------------------------------------
//
// El tablero del ajedrez de siempre, 8×8 casillas cuadradas con nombres
// a1…h8. kingNbrs son los 8 vecinos del rey clásico: 4 por arista y 4 solo
// por vértice (las diagonales).
(() => {
  const L = 34;   // lado de cada cuadrado (px del viewBox)
  const FILAS = 8, COLS = 8;
  registrarTeselacion('square8', FILAS, () => {
    const raw = [];
    for (let b = 1; b <= FILAS; b++) {
      for (let a = 1; a <= COLS; a++) {
        const x = (a - 1) * L, y = (FILAS - b) * L;   // fila 1 abajo
        raw.push({
          a, b,
          up: (a + b) % 2 === 1,   // damero: a1 oscura, como en ajedrez
          nombre: 'abcdefgh'[a - 1] + b,
          pts: [[x, y], [x + L, y], [x + L, y + L], [x, y + L]],
        });
      }
    }
    return raw;
  });
})();

// --- teselación hexagonal: hexhex4 -----------------------------------------
//
// Tablero hexagonal de lado 4 hecho de hexágonos (37 casillas), como el de
// los ajedreces hexagonales pequeños. Filas horizontales de 4,5,6,7,6,5,4
// casillas, nombradas a1…a4 (abajo) hasta g1…g4 (arriba).
//
// OJO: en una teselación de hexágonos NO existen vecinas solo por vértice.
// En cada vértice concurren exactamente TRES hexágonos y cada par de ellos
// comparte además una arista, así que kingNbrs == edgeNbrs: los 6 vecinos de
// toda casilla interior. Una modalidad PPT jugada aquí tiene la vecindad
// «rey» y la vecindad «arista» idénticas, cosa que en triángulos y cuadrados
// no pasa.
(() => {
  const R = 22;                       // circunradio de cada hexágono
  const W = R * Math.sqrt(3);         // anchura (hexágono con vértice arriba)
  const N = 3;                        // radio del tablero en casillas (lado 4)
  registrarTeselacion('hexhex4', N + 1, () => {
    const raw = [];
    // Coordenadas axiales (q, r) con |q|, |r|, |q+r| ≤ N; la fila es r.
    for (let r = -N; r <= N; r++) {
      const fila = [];
      for (let q = Math.max(-N, -N - r); q <= Math.min(N, N - r); q++) fila.push(q);
      for (let i = 0; i < fila.length; i++) {
        const q = fila[i];
        const cx = W * (q + r / 2), cy = -1.5 * R * r;   // r = −3 es la fila de abajo
        const pts = [];
        for (let k = 0; k < 6; k++) {
          const ang = Math.PI / 180 * (60 * k + 30);
          pts.push([cx + R * Math.cos(ang), cy + R * Math.sin(ang)]);
        }
        raw.push({
          a: i + 1,                       // posición dentro de la fila (1 = izquierda)
          b: r + N + 1,                   // fila 1 (abajo) … 7 (arriba)
          up: ((q - r) % 2 + 2) % 2 === 0,   // alternancia para el damero CSS
          nombre: 'abcdefg'[r + N] + (i + 1),
          pts,
        });
      }
    }
    return raw;
  });
})();

// --- teselación de ladrillos: brick8 ---------------------------------------
//
// Pared de ladrillos a soga (2×1, cada fila corrida medio ladrillo): 8 filas
// de 8 ladrillos, nombres a1…h8. El polígono lleva 6 puntos —los 4 vértices
// más el punto medio de los lados largos—, porque ahí es donde concurren
// tres ladrillos: sin esos puntos, dos ladrillos que comparten media arista
// no compartirían ningún vértice y la vecindad saldría vacía (ver la nota de
// construirTeselacion). Como en los hexágonos, en el aparejo a soga tampoco
// hay vecinas solo por vértice (las juntas forman T, nunca cruces): kingNbrs
// son los 2 vecinos de la fila más los 2 de arriba y los 2 de abajo, 6 en
// las casillas interiores.
(() => {
  const U = 24;                       // media soga: el ladrillo mide 2U × U
  const FILAS = 8, COLS = 8;
  registrarTeselacion('brick8', FILAS, () => {
    const raw = [];
    for (let b = 1; b <= FILAS; b++) {
      const corrida = (b % 2 === 0) ? U : 0;   // filas pares corridas medio ladrillo
      for (let a = 1; a <= COLS; a++) {
        const x = (a - 1) * 2 * U + corrida, y = (FILAS - b) * U;
        raw.push({
          a, b,
          up: (a + b) % 2 === 1,
          nombre: 'abcdefgh'[a - 1] + b,
          pts: [
            [x, y], [x + U, y], [x + 2 * U, y],                // lado de arriba, con su punto medio
            [x + 2 * U, y + U], [x + U, y + U], [x, y + U],    // lado de abajo, ídem
          ],
        });
      }
    }
    return raw;
  });
})();

// --- modalidades de demostración -------------------------------------------
//
// Prueba mínima de que una modalidad «solo kingNbrs» funciona sobre estas
// teselaciones: un rey y una fila de guardias que se mueven una casilla a
// cualquier vecina (por arista o por vértice), sin peones ni deslizantes. Es
// el tipo de movimiento que usan las modalidades PPT (rama variantes-ppt):
// cuando existan, les bastará con declarar board: 'square8', 'hexhex4' o
// 'brick8' y piezas con leaps: c => c.kingNbrs.
//
// Van con hidden: true: no salen en el selector; se abren con el parámetro
// de URL ?modalidad=demo-cuadrado, ?modalidad=demo-hexagonal o
// ?modalidad=demo-ladrillos (misma convención de query que ?posicion=1).

// Sin peones: variants.js precalcula pawnAdv/pawnCap de TODAS las casillas al
// activar la modalidad, así que aunque no haya peones las tablas deben
// existir (vacías).
function setSinPeones() {
  for (const cell of CELLS) {
    cell.pawnAdv = { w: [], b: [] };
    cell.pawnCap = { w: [], b: [] };
  }
}

function demoTeselacion(id, name, board, backLayout, notaTablero) {
  return {
    id,
    name,
    full: name,
    board,
    hidden: true,                 // no sale en el selector: solo por URL
    backLayout,
    promotionChoices: [],
    edgePromotion: false,
    setup() {
      const abajo = Math.min(...CELLS.map(c => c.b));
      const arriba = Math.max(...CELLS.map(c => c.b));
      return {
        wBack: rowCells(abajo), wPawns: [],
        bBack: rowCells(arriba), bPawns: [],
      };
    },
    build() { setSinPeones(); },
    pieces: {
      K: { leaps: c => c.kingNbrs },
      N: { leaps: c => c.kingNbrs },   // «guardia»: glifo de caballo, paso de rey
      // Sin peón: aun así setSinPeones() deja las tablas pawnAdv/pawnCap
      // vacías, porque variants.js las consulta para TODAS las casillas.
    },
    slideGroups: () => [],
    note: 'Modalidad de demostración de las teselaciones (tessellations.js). ' +
      notaTablero + ' Rey y guardias: todas las piezas dan un paso a ' +
      'cualquier casilla vecina por arista o por vértice (kingNbrs).',
    help: [
      ['K', '<b>Rey ♚</b>: un paso a cualquier casilla vecina por arista o por vértice.'],
      ['N', '<b>Guardia ♞</b>: se mueve exactamente igual que el rey (es la vecindad kingNbrs, la que usan las modalidades PPT).'],
    ],
    engine: {
      pieceValues: { K: 0, N: 300 },
      mobility: 4,
    },
  };
}

VARIANTS['demo-cuadrado'] = demoTeselacion(
  'demo-cuadrado', 'Demo: teselación cuadrada', 'square8',
  ['N', 'N', 'N', 'K', 'N', 'N', 'N', 'N'],
  'Tablero 8×8 de casillas cuadradas; kingNbrs son los 8 vecinos del ajedrez clásico.');

VARIANTS['demo-hexagonal'] = demoTeselacion(
  'demo-hexagonal', 'Demo: teselación hexagonal', 'hexhex4',
  ['N', 'K', 'N', 'N'],
  'Hexágono de 37 casillas hexagonales; aquí kingNbrs == edgeNbrs (6 vecinos), porque los hexágonos no tienen vecinas solo por vértice.');

VARIANTS['demo-ladrillos'] = demoTeselacion(
  'demo-ladrillos', 'Demo: teselación de ladrillos', 'brick8',
  ['N', 'N', 'N', 'K', 'N', 'N', 'N', 'N'],
  'Pared de 8×8 ladrillos a soga; kingNbrs son los 6 vecinos de las juntas en T (tampoco hay vecinas solo por vértice).');

// --- arranque por URL ------------------------------------------------------
//
// ?modalidad=<id> abre la página con esa modalidad, oculta o no. Se registra
// aquí y no en script.js para no tocarlo (lo está editando otra sesión);
// como los <script> van al final del <body>, DOMContentLoaded salta después
// del arranque de script.js, cuando applyVariant ya existe.
document.addEventListener('DOMContentLoaded', () => {
  const id = new URL(window.location).searchParams.get('modalidad');
  if (id && VARIANTS[id] && typeof applyVariant === 'function' && V.id !== id) {
    applyVariant(id);
  }
});

// --- LÍMITES DE LA ABSTRACCIÓN (qué falta para las modalidades clásicas) ---
//
// Estas teselaciones dan polígono, vecinas por arista y vecinas por vértice:
// suficiente para piezas de UN paso (kingNbrs), que es todo lo que piden las
// modalidades PPT. Para llevar aquí las modalidades clásicas haría falta lo
// que hoy solo existe en la retícula triangular:
//
//   · DIRECCIONES Y RAYOS. Torre, alfil y elefante necesitan «seguir recto»,
//     y eso no sale de la vecindad: es una estructura extra (en cada casilla,
//     qué vecina continúa cada dirección). La generalización natural es que
//     cada teselación declare sus familias de direcciones y un paso por
//     dirección, como hacen rookStep/bishopStep/elephantStep, y rayFrom haga
//     el resto; en cuadrados serían las 4+4 direcciones clásicas, en
//     hexágonos las 6 por arista y las 6 por vértice de los ajedreces
//     hexagonales. En ladrillos ni siquiera está claro qué es «recto»: la
//     media corrida hace que cruzar aristas alternas derive en diagonal.
//
//   · PEONES. pawnAdv/pawnCap por color, más la fila de coronación. Con
//     rowRanks: true la coronación por filas ya funcionaría; lo que hay que
//     decidir por teselación es qué casillas son «las de delante».
//
//   · CABALLOS Y SALTOS. knightTargets es un patrón de la retícula; cada
//     teselación tendría que declarar el suyo (en cuadrados, el (1,2) de
//     siempre).
//
// Nada de esto lo necesita PPT, así que se deja analizado y sin implementar.
