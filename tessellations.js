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

// FILAS EN UNA TESELACIÓN CUALQUIERA. En el damero o en los ladrillos la fila
// se sabe de antemano; en una teselación irregular (rombos, octógonos con
// cuadrados, espiga) no, porque las casillas ni tienen la misma altura ni
// están alineadas. Este ayudante las reparte por la altura de su centro:
// agrupa los centros cuya `cy` cae dentro de `tol` px, numera las bandas de
// abajo (b = 1) arriba, y dentro de cada banda ordena por `cx` (a = 1 a la
// izquierda). Con eso, `rowCells(b)` sigue devolviendo «una fila» y las
// modalidades PPT se colocan igual en cualquier teselación.
//
// El nombre sale de la banda y la posición: a1, b3, f2… como siempre.
// `up` (el damero CSS) se deja alternando por (a + b), que en teselaciones
// irregulares no significa nada geométrico pero pinta un patrón legible.
function repartirFilas(poligonos, tol = 4) {
  const conCentro = poligonos.map(q => {
    const pts = q.pts;
    return { ...q, cy: pts.reduce((s, p) => s + p[1], 0) / pts.length,
             cx: pts.reduce((s, p) => s + p[0], 0) / pts.length };
  });
  // Bandas: recorrido de arriba abajo abriendo banda nueva cuando el salto
  // en cy pasa de `tol`. (En pantalla y crece hacia abajo, así que la última
  // banda es la fila 1.)
  const orden = [...conCentro].sort((p, q) => p.cy - q.cy);
  const bandas = [];
  for (const c of orden) {
    const ultima = bandas[bandas.length - 1];
    if (ultima && Math.abs(c.cy - ultima.cy0) <= tol) ultima.casillas.push(c);
    else bandas.push({ cy0: c.cy, casillas: [c] });
  }
  const raw = [];
  bandas.forEach((banda, i) => {
    const b = bandas.length - i;                  // 1 = la de abajo
    banda.casillas.sort((p, q) => p.cx - q.cx).forEach((c, j) => {
      const a = j + 1;
      raw.push({ a, b, up: (a + b) % 2 === 1, pts: c.pts,
                 nombre: LETRAS[b - 1] + a });
    });
  });
  return raw;
}

const LETRAS = 'abcdefghijklmnopqrstuvwxyz';

// RECORTE SIMÉTRICO. Un tablero de dos bandos necesita que la mitad de abajo
// sea el espejo de la de arriba: si no, un bando empieza con más piezas que
// el otro y la modalidad no vale nada. En el damero eso sale solo; en una
// teselación irregular no tiene por qué (los rombos, por ejemplo: cada
// hexágono aporta un rombo por arriba y dos por abajo, así que un recorte
// ingenuo deja 3 casillas en la fila de abajo y 6 en la de arriba).
//
// Esto busca el eje horizontal que deja MÁS casillas emparejadas con su
// espejo y descarta las que se queden sin pareja. Los candidatos a eje son
// las alturas de las casillas y sus puntos medios: el eje de simetría de una
// teselación siempre cae en uno de los dos sitios.
function recorteSimetrico(poligonos, tol = 1.5) {
  const con = poligonos.map(q => ({
    ...q,
    cx: q.pts.reduce((t, p) => t + p[0], 0) / q.pts.length,
    cy: q.pts.reduce((t, p) => t + p[1], 0) / q.pts.length,
  }));
  const alturas = [...new Set(con.map(c => Math.round(c.cy * 100) / 100))].sort((a, b) => a - b);
  const ejes = [...alturas];
  for (let i = 1; i < alturas.length; i++) ejes.push((alturas[i - 1] + alturas[i]) / 2);

  let mejor = [];
  for (const y0 of ejes) {
    const quedan = con.filter(c => con.some(o =>
      Math.abs(o.cx - c.cx) <= tol && Math.abs(o.cy - (2 * y0 - c.cy)) <= tol));
    if (quedan.length > mejor.length) mejor = quedan;
  }
  return mejor;
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

// --- teselación cuadrada: square6, square8, square10, square12 -------------
//
// El tablero del ajedrez de siempre y sus hermanos de otro tamaño: N×N
// casillas cuadradas con nombres a1…h8 (o hasta l12). kingNbrs son los 8
// vecinos del rey clásico: 4 por arista y 4 solo por vértice (las diagonales).
//
// Hay una familia entera y no un solo tablero porque las modalidades PPT
// cuadradas dejan elegir el tamaño (ver `familia` en la fábrica de abajo):
// cambiar de tamaño es cambiar a la modalidad hermana, que trae otro tablero.
(() => {
  const LADO_TOTAL = 272;             // ancho del tablero en px del viewBox
  for (const N of [6, 8, 10, 12]) {
    const L = LADO_TOTAL / N;         // los tableros grandes llevan casilla menor
    registrarTeselacion('square' + N, N, () => {
      const raw = [];
      for (let b = 1; b <= N; b++) {
        for (let a = 1; a <= N; a++) {
          const x = (a - 1) * L, y = (N - b) * L;   // fila 1 abajo
          raw.push({
            a, b,
            up: (a + b) % 2 === 1,   // damero: a1 oscura, como en ajedrez
            nombre: LETRAS[a - 1] + b,
            pts: [[x, y], [x + L, y], [x + L, y + L], [x, y + L]],
          });
        }
      }
      return raw;
    });
  }
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

// --- teselación de rombos: rhomb3 ------------------------------------------
//
// La retícula «de cubos» de toda la vida: cada hexágono partido en tres
// rombos desde su centro. Es monoedral (una sola forma de casilla) pero NO
// regular, y a diferencia del damero sus casillas vienen en tres
// orientaciones distintas, así que la vecindad cambia según cómo esté puesta
// la casilla: unas tienen más vecinas por arista y otras más solo por
// vértice. Para una modalidad PPT eso significa que no todas las casillas
// valen lo mismo, cosa que en el damero no pasa.
(() => {
  const R = 20;                        // circunradio del hexágono de partida
  const RADIO = 3;                     // radio de la malla, en hexágonos
  registrarTeselacion('rhomb3', 5, () => {
    const poligonos = [];
    for (let r = -RADIO; r <= RADIO; r++) {
      for (let q = Math.max(-RADIO, -RADIO - r); q <= Math.min(RADIO, RADIO - r); q++) {
        const cx = R * Math.sqrt(3) * (q + r / 2), cy = -1.5 * R * r;
        const V = [];
        for (let k = 0; k < 6; k++) {
          const ang = Math.PI / 180 * (60 * k + 30);
          V.push([cx + R * Math.cos(ang), cy + R * Math.sin(ang)]);
        }
        // Tres rombos: centro, y cada tres vértices consecutivos.
        for (let k = 0; k < 6; k += 2) {
          poligonos.push({ pts: [[cx, cy], V[k], V[(k + 1) % 6], V[(k + 2) % 6]] });
        }
      }
    }
    return repartirFilas(recorteSimetrico(poligonos), 6);
  });
})();

// --- teselación de octógonos y cuadrados: octo6 ----------------------------
//
// La teselación 4.8.8, la del suelo de baldosas: octógonos regulares con un
// cuadradito girado en cada cruce. Dos formas de casilla y dos tamaños muy
// distintos: el octógono tiene 8 vecinas y el cuadradito solo 4, todas por
// arista. Es el primer tablero de esta lista donde una casilla puede valer
// bastante menos que su vecina solo por ser más pequeña.
(() => {
  const N = 6;                         // octógonos por lado
  const L = 44;                        // paso de la retícula
  const t = L / (2 + Math.sqrt(2));     // lado del octógono = corte de esquina
  const c = (L - t) / 2;               // cuánto se recorta de cada esquina
  registrarTeselacion('octo6', N, () => {
    const poligonos = [];
    for (let fila = 0; fila < N; fila++) {
      for (let col = 0; col < N; col++) {
        const x = col * L, y = fila * L;
        poligonos.push({ pts: [
          [x + c, y], [x + L - c, y],
          [x + L, y + c], [x + L, y + L - c],
          [x + L - c, y + L], [x + c, y + L],
          [x, y + L - c], [x, y + c],
        ] });
        // Cuadradito en el cruce inferior derecho (no en el borde).
        if (fila < N - 1 && col < N - 1) {
          poligonos.push({ pts: [
            [x + L - c, y + L], [x + L, y + L - c],
            [x + L + c, y + L], [x + L, y + L + c],
          ] });
        }
      }
    }
    return repartirFilas(poligonos, 6);
  });
})();

// --- teselación trihexagonal (kagome): kagome3 -----------------------------
//
// La 3.6.3.6: hexágonos y triángulos alternando, la retícula kagome de los
// físicos. Se construye sobre los PUNTOS MEDIOS de las aristas de una malla
// triangular: hexágono alrededor de cada vértice de la malla y triángulo
// medial dentro de cada triángulo. Como todos los polígonos apoyan en esos
// mismos puntos medios, las aristas casan exactas y no hace falta añadir
// vértices de más (cf. los ladrillos).
//
// Aquí NO hay vecinas solo por vértice entre hexágonos y triángulos —cada par
// que se toca comparte arista entera—, pero dos hexágonos sí se tocan en un
// vértice suelto, así que kingNbrs y edgeNbrs vuelven a ser distintos.
(() => {
  const L = 36;                                    // lado de la malla triangular
  const H = L * Math.sqrt(3) / 2;
  const RADIO = 3;
  const P = (i, j) => [i * L + j * L / 2, -j * H];  // vértice (i, j) de la malla
  const medio = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const dentro = (i, j) => Math.abs(i) <= RADIO && Math.abs(j) <= RADIO &&
    Math.abs(i + j) <= RADIO;
  registrarTeselacion('kagome3', 5, () => {
    const poligonos = [];
    const DIRS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];  // en orden angular
    for (let j = -RADIO; j <= RADIO; j++) {
      for (let i = -RADIO; i <= RADIO; i++) {
        if (!dentro(i, j)) continue;
        const centro = P(i, j);
        // Hexágono: los 6 puntos medios hacia los vecinos de la malla.
        poligonos.push({ pts: DIRS.map(([di, dj]) => medio(centro, P(i + di, j + dj))) });
        // Los dos triángulos mediales que «cuelgan» de este vértice, si sus
        // tres esquinas están dentro de la malla (así no salen medias piezas).
        for (const [[d1i, d1j], [d2i, d2j]] of [[[1, 0], [0, 1]], [[0, 1], [-1, 1]]]) {
          if (!dentro(i + d1i, j + d1j) || !dentro(i + d2i, j + d2j)) continue;
          const A = P(i + d1i, j + d1j), B = P(i + d2i, j + d2j);
          poligonos.push({ pts: [medio(centro, A), medio(A, B), medio(B, centro)] });
        }
      }
    }
    return repartirFilas(poligonos, 6);
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

// --- las modalidades PPT sobre cualquier teselación ------------------------
//
// Las cuatro modalidades PPT «de casa» (PPTR, PPTLSR y sus Murallas de papel)
// viven en variants.js sobre el hexágono triangular, con la posición inicial
// que midió la arena. Aquí se generan LAS MISMAS sobre los demás tableros.
//
// La diferencia de fondo: en variants.js las filas iniciales son listas fijas
// (nueve casillas de fondo, once de frente, siempre), y aquí no pueden serlo,
// porque cada teselación tiene filas de un ancho distinto —y dentro de una
// misma teselación, unas filas más largas que otras (los octógonos alternan
// 6 y 5; el kagome va de 4 a 7)—. Así que la posición se calcula en build(),
// que corre después de setGeometry(), cuando ya se sabe cuántas casillas tiene
// cada fila:
//
//   · formación «ciclo»: el ciclo de figuras (O-A-T, o el de cinco) repetido a
//     lo largo de las dos filas, desfasado entre ellas para que no queden
//     iguales enfrentadas;
//   · formación «muralla»: la fila de delante entera de papeles y la de atrás
//     alternando las demás figuras.
//
// En las dos, el rey va al centro de la fila de fondo. Si esa fila tiene un
// número PAR de casillas no hay centro exacto: cae en la de la izquierda de
// las dos centrales y la simetría se rompe ahí, como el rey del ajedrez en d1.
//
// Lo que NO se toca es la vecindad: las piezas siguen dando un paso a
// cualquier casilla vecina (kingNbrs). Es todo lo que necesitan, y por eso
// estas modalidades funcionan en teselaciones donde las clásicas no podrían
// (ver los límites, al final).

const PPT_TABLEROS = [
  { board: 'square6',  etiqueta: 'Cuadrado 6×6',                   familia: 'cuadrado' },
  { board: 'square8',  etiqueta: 'Cuadrado 8×8',                   familia: 'cuadrado' },
  { board: 'square10', etiqueta: 'Cuadrado 10×10',                 familia: 'cuadrado' },
  { board: 'square12', etiqueta: 'Cuadrado 12×12',                 familia: 'cuadrado' },
  { board: 'brick8',   etiqueta: 'Ladrillos 8×8',                  familia: 'otras' },
  { board: 'hexhex4',  etiqueta: 'Hexágonos (37)',                 familia: 'otras' },
  { board: 'rhomb3',   etiqueta: 'Rombos (97)',                    familia: 'otras' },
  { board: 'octo6',    etiqueta: 'Octógonos y cuadrados (61)',     familia: 'otras' },
  { board: 'kagome3',  etiqueta: 'Kagome: hexágonos y triángulos (91)', familia: 'otras' },
];

// Las cuatro familias de modalidad, con lo que las distingue.
const PPT_FAMILIAS = {
  'pptr':            { sigla: 'PPTR',   largo: 'Piedra, papel, tijera y rey', cinco: false, muralla: false },
  'pptr-muralla':    { sigla: 'PPTR · Muralla de papel',   largo: 'Piedra, papel, tijera y rey · Muralla de papel', cinco: false, muralla: true },
  'pptlsr':          { sigla: 'PPTLSR', largo: 'Piedra, papel, tijera, lagarto, Spock y rey', cinco: true, muralla: false },
  'pptlsr-muralla':  { sigla: 'PPTLSR · Muralla de papel', largo: 'Piedra, papel, tijera, lagarto, Spock y rey · Muralla de papel', cinco: true, muralla: true },
};

// Reparte un ciclo de figuras a lo largo de `n` casillas, empezando por
// `desde`. Se usa para las dos filas, con distinto arranque.
function repartirCiclo(ciclo, n, desde) {
  return Array.from({ length: n }, (_, i) => ciclo[(i + desde) % ciclo.length]);
}

function pptTeselada(idFamilia, spec) {
  const fam = PPT_FAMILIAS[idFamilia];
  const ciclo = fam.cinco ? ['O', 'A', 'T', 'L', 'S'] : ['O', 'A', 'T'];
  const sinPapel = ciclo.filter(t => t !== 'A');
  const capturas = capturesConRey(fam.cinco ? RPSLS_CAPTURES : RPS_CAPTURES);
  const ayuda = fam.cinco
    ? [RPS_HELP.O5, RPS_HELP.A5, RPS_HELP.T5, RPS_HELP.L5, RPS_HELP.S5, RPS_HELP.K]
    : [RPS_HELP.O, RPS_HELP.A, RPS_HELP.T, RPS_HELP.K];

  return {
    id: idFamilia + '-' + spec.board,
    name: fam.sigla + ' · ' + spec.etiqueta,
    full: fam.largo + ' · ' + spec.etiqueta,
    board: spec.board,
    hidden: true,              // se llega por el selector de tablero, no por el de modalidad
    familia: idFamilia,        // hermanas: mismo juego, distinto tablero
    tablero: spec.etiqueta,
    grupoTablero: spec.familia,
    promotionChoices: [],
    edgePromotion: false,
    captures: capturas,
    pieces: Object.fromEntries(
      ciclo.concat('K').map(t => [t, { leaps: c => c.kingNbrs }])),
    slideGroups: () => [],
    setup() {
      const abajo = Math.min(...CELLS.map(c => c.b));
      const arriba = Math.max(...CELLS.map(c => c.b));
      return {
        wBack: rowCells(abajo), wPawns: rowCells(abajo + 1),
        bBack: rowCells(arriba), bPawns: rowCells(arriba - 1),
      };
    },
    // Aquí se calcula la posición inicial: es lo único que depende del tablero.
    build() {
      setSinPeones();
      const abajo = Math.min(...CELLS.map(c => c.b));
      const nFondo = rowCells(abajo).length;
      const nFrente = rowCells(abajo + 1).length;
      const fondo = fam.muralla
        ? repartirCiclo(sinPapel, nFondo, 0)
        : repartirCiclo(ciclo, nFondo, 2 % ciclo.length);
      fondo[Math.floor((nFondo - 1) / 2)] = 'K';       // rey al centro
      this.backLayout = fondo;
      this.frontLayout = fam.muralla
        ? Array(nFrente).fill('A')
        : repartirCiclo(ciclo, nFrente, 0);
    },
    engine: {
      pieceValues: { O: 100, A: 100, T: 100, L: 100, S: 100, K: 0 },
      mobility: 4,
    },
    note: (fam.muralla
      ? 'La Muralla de papel sobre ' + spec.etiqueta.toLowerCase() + ': la fila ' +
        'de delante entera de papeles y, detrás, las demás figuras alternando ' +
        'con el rey en el centro. '
      : 'El ciclo de figuras repetido en las dos filas, con el rey en el centro ' +
        'del fondo, sobre ' + spec.etiqueta.toLowerCase() + '. ') +
      'Las piezas se mueven y capturan igual que en la modalidad de siempre; lo ' +
      'que cambia es la forma de las casillas, y con ella cuántas vecinas tiene ' +
      'cada una. Los valores del motor NO están medidos en este tablero.',
    help: ayuda,
  };
}

for (const idFamilia of Object.keys(PPT_FAMILIAS)) {
  for (const spec of PPT_TABLEROS) {
    const v = pptTeselada(idFamilia, spec);
    VARIANTS[v.id] = v;
  }
}

// Las cuatro de variants.js son la combinación «familia × hexágono
// triangular»: se les cuelga aquí la misma etiqueta para que el selector de
// tablero las encuentre junto a sus hermanas, en vez de duplicarlas.
const PPT_HEX = {
  'rps-rey': 'pptr', 'rps-rey-muralla': 'pptr-muralla',
  'rpsls-rey': 'pptlsr', 'rpsls-rey-muralla': 'pptlsr-muralla',
};
for (const [id, familia] of Object.entries(PPT_HEX)) {
  if (!VARIANTS[id]) continue;
  VARIANTS[id].familia = familia;
  VARIANTS[id].tablero = 'Triangular · hexágono de 96';
  VARIANTS[id].grupoTablero = 'triangular';
}

// Los tableros de una familia, en el orden del selector: el triangular
// primero (es el de casa) y detrás los demás.
function tablerosDeFamilia(familia) {
  return Object.keys(VARIANTS)
    .filter(id => VARIANTS[id].familia === familia)
    .map(id => ({ id, tablero: VARIANTS[id].tablero, grupo: VARIANTS[id].grupoTablero }))
    .sort((p, q) => {
      const orden = { triangular: 0, cuadrado: 1, otras: 2 };
      return orden[p.grupo] - orden[q.grupo];
    });
}

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
//
// --- PENDIENTE: UN MOTOR QUE SE ADAPTE A CUALQUIER TABLERO ----------------
//
// Las modalidades PPT ya se JUEGAN en todos estos tableros, pero el motor no
// sabe en cuál está: evalúa con los mismos números que se midieron en la arena
// sobre el hexágono triangular. Y esos números no son trasladables, porque lo
// que cambia de una teselación a otra no es el decorado, es el grafo.
//
// El caso más claro, medido sobre los tableros de este fichero (media de
// kingNbrs por casilla, que es la vecindad que usan TODAS las piezas PPT):
//
//   hex4 (triangular) 10,1  ·  rhomb3 8,4  ·  kagome3 7,1  ·  square8 6,6
//   octo6 5,2  ·  brick8 5,0  ·  hexhex4 4,9
//
// El término de movilidad de ai.js suma `engine.mobility` (4) por jugada
// disponible. Con 10 vecinas de media eso vale ~40 puntos por pieza, casi la
// mitad de una figura (100); con 4,9 vale la mitad de eso. O sea: la MISMA
// configuración pesa la movilidad el doble en un tablero que en otro, sin que
// nadie lo haya decidido. Lo mismo vale para el peso de amenaza medido en la
// tarea 18 y para cualquier término futuro que cuente vecinas o casillas.
//
// Tres cosas que habría que investigar, de menos a más ambiciosa:
//
//   1. NORMALIZAR por el grafo. Que `mobility` deje de ser un número absoluto
//      y pase a ser relativo al grado medio del tablero (o al grado de la
//      casilla), calculado al hacer setGeometry. Es barato y quita el sesgo
//      más grosero, pero es una hipótesis sin medir.
//   2. DISTANCIAS DE GRAFO. Todo lo que hoy razona con la retícula triangular
//      (dist() en variants.js, la cercanía al rey, el acoso) tendría que
//      pasar a distancias del grafo de kingNbrs, precalculadas por BFS al
//      cambiar de tablero. Sin eso, cualquier término posicional nuevo nace
//      atado al hexágono.
//   3. MEDIR POR TABLERO. Lo honesto de verdad: pasar la arena por cada
//      tablero. Es caro (hoy son 4 familias × 10 tableros) y hay que decidir
//      qué se mide y qué se hereda; quizá baste con medir un representante de
//      cada «grado medio» y interpolar.
//
// Mientras eso no se haga, las modalidades teseladas son jugables y honradas
// —las reglas son exactas— pero su motor está calibrado para otro tablero, y
// así lo dice la nota de cada una.
