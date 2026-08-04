// script.js — Interfaz: dibujo del tablero en SVG e interacción.

const SVG_NS = 'http://www.w3.org/2000/svg';

const boardWrap = document.getElementById('board-wrap');
const turnEl = document.getElementById('turn');
const statusEl = document.getElementById('status');
const moveCounterEl = document.getElementById('move-counter');
const analysisBodyEl = document.getElementById('analysis-body');
const scoresheetBodyEl = document.getElementById('scoresheet-body');
const optAnalysisEl = document.getElementById('opt-analysis');
const optCoordsEl = document.getElementById('opt-coords');
const optSoundEl = document.getElementById('opt-sound');
const capWEl = document.getElementById('cap-w');
const capBEl = document.getElementById('cap-b');
const btnStart = document.getElementById('btn-start');
const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');
const btnEnd = document.getElementById('btn-end');
const btnPlayBack = document.getElementById('btn-play-back');
const btnPause = document.getElementById('btn-pause');
const btnStop = document.getElementById('btn-stop');
const btnPlayFwd = document.getElementById('btn-play-fwd');
const btnFlip = document.getElementById('btn-flip');
const modeEl = document.getElementById('mode');
const levelWEl = document.getElementById('level-w');
const levelBEl = document.getElementById('level-b');
const rowLevelW = document.getElementById('row-level-w');
const rowLevelB = document.getElementById('row-level-b');
const saveSelect = document.getElementById('save-select');
const btnSave = document.getElementById('btn-save');
const btnLoad = document.getElementById('btn-load');
const btnFavorite = document.getElementById('btn-favorite');
const btnDelete = document.getElementById('btn-delete');
const btnExport = document.getElementById('btn-export');
const btnImport = document.getElementById('btn-import');
const fileImport = document.getElementById('file-import');

const cellPolys = new Map();  // key de casilla → <polygon>
const coordTexts = new Map(); // key de casilla → <text> con su nombre
let coordsLayer = null;       // capa de nombres, se enseña con .visible
// {from, to} de la jugada que hay que animar en el próximo repintado, o null.
// Lo pone marcarParaAnimar() justo después de cada makeMove de la partida
// viva; navegar por el historial NO anima, porque saltar diez jugadas atrás
// con una pieza deslizándose no significaría nada.
let animarJugada = null;
function marcarParaAnimar() {
  const m = game.lastMove;
  // en el enroque, lastMove.to ya es la casilla de llegada del rey
  animarJugada = m ? { from: m.from, to: m.to } : null;
  const antes = game.history[game.histIndex - 1];
  const captura = !!antes &&
    (game.capturedBy.w.length + game.capturedBy.b.length) >
    (antes.capturedBy.w.length + antes.capturedBy.b.length);
  sonar(captura);
}

// --- sonido ---------------------------------------------------------------
//
// Sintetizado con WebAudio, sin ningún fichero de audio: un chasquido corto
// al mover y otro más grave al capturar. Viene APAGADO: una página que empieza
// a sonar sola sin que nadie se lo haya pedido molesta más de lo que aporta.
let audioCtx = null;
function sonar(captura) {
  if (!optSoundEl || !optSoundEl.checked) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const vol = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(captura ? 170 : 330, t);
    osc.frequency.exponentialRampToValueAtTime(captura ? 90 : 220, t + 0.09);
    vol.gain.setValueAtTime(0.0001, t);
    vol.gain.exponentialRampToValueAtTime(captura ? 0.20 : 0.12, t + 0.008);
    vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(vol).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  } catch { /* el navegador no deja sonar todavia: no pasa nada */ }
}

// --- reloj ----------------------------------------------------------------
//
// Cuenta lo que ha pensado cada bando. NO es un control de tiempo: nadie
// pierde por tiempo, solo se mide. Corre mientras la partida está viva, no
// está en pausa y no se está revisando el historial.
const relojEl = document.getElementById('reloj');
const consumido = { w: 0, b: 0 };
let relojDesde = null;   // cuándo empezó el intervalo que está corriendo
let relojLado = null;    // Y DE QUIÉN ES ese intervalo

// Guardar el lado no es redundante con game.turn. Al parar el reloj hay dos
// situaciones distintas: si se acaba de mover, el turno YA ha cambiado y el
// tiempo es del rival del que mueve ahora; si se pausa o se entra a revisar
// el historial, el turno NO ha cambiado y el tiempo es de quien está
// pensando. Deducirlo de game.turn acertaba en un caso y fallaba en el otro,
// y el tiempo de las blancas llegaba a BAJAR al pausar.
function pararReloj() {
  if (relojDesde !== null && relojLado) {
    consumido[relojLado] += Date.now() - relojDesde;
  }
  relojDesde = null;
  relojLado = null;
}

function reiniciarReloj() {
  consumido.w = 0; consumido.b = 0;
  relojDesde = null; relojLado = null;
  pintarReloj();
}

function mmss(ms) {
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function pintarReloj() {
  const corriendo = relojDesde !== null ? Date.now() - relojDesde : 0;
  const w = consumido.w + (relojLado === 'w' ? corriendo : 0);
  const b = consumido.b + (relojLado === 'b' ? corriendo : 0);
  relojEl.textContent = 'Tiempo — blancas ' + mmss(w) + ' · negras ' + mmss(b);
}

// El reloj corre mientras la partida está viva, en marcha y sin revisar. Al
// cambiar el turno se cierra el intervalo del anterior y se abre el del
// siguiente, así que no hace falta pararlo a mano en cada jugada.
function ajustarReloj() {
  const corre = !gameEnded() && !gamePaused && reviewIndex === null;
  if (corre && relojLado !== game.turn) {
    pararReloj();
    relojDesde = Date.now();
    relojLado = game.turn;
  } else if (!corre && relojDesde !== null) {
    pararReloj();
  }
  pintarReloj();
}
setInterval(pintarReloj, 500);
let piecesLayer = null;
let boardGroup = null;        // <g> con todo el dibujo, para poder voltearlo
let selected = null;          // key de la casilla seleccionada
let legalTargets = [];        // casillas destino legales de la selección
let analysisHover = null;     // {baseIndex, from, to}: fila del análisis señalada

// --- revisión del historial y pausa ---
//
// `reviewIndex` es una capa de visualización aparte de `game.histIndex`: si
// no es null, el tablero muestra ese snapshot de solo lectura sin tocar el
// estado real de la partida (`game.board`, `game.histIndex`...), así que el
// ordenador (si le toca) sigue pensando y jugando en segundo plano aunque el
// usuario esté revisando jugadas pasadas.
let reviewIndex = null;
let playTimer = null;   // intervalo activo de reproducción a velocidad (◀◀/▶▶)
let gamePaused = false; // si es true, el ordenador no mueve ficha

// Índice del historial que se está mostrando (revisión si la hay, si no la
// posición viva).
function effIndex() { return reviewIndex === null ? game.histIndex : reviewIndex; }

// Detiene la reproducción a velocidad en curso y vuelve a mostrar la
// posición viva de la partida.
function exitReview() {
  if (playTimer) { clearInterval(playTimer); playTimer = null; }
  reviewIndex = null;
}

// El tablero hexagonal tiene simetría rotacional de 180° respecto a su
// centro, así que "voltear" es simplemente girar todo el dibujo 180°
// alrededor del centro del viewBox.
let boardFlipped = false;

function applyBoardTransform() {
  const cx = BBOX.x + BBOX.w / 2, cy = BBOX.y + BBOX.h / 2;
  boardGroup.setAttribute('transform', boardFlipped ? `rotate(180 ${cx} ${cy})` : '');
  // el grupo entero va girado 180°, así que los nombres saldrían del revés:
  // cada uno se gira otros 180° sobre sí mismo para volver a leerse
  for (const [key, t] of coordTexts) {
    const c = CELL_MAP.get(key);
    t.setAttribute('transform', boardFlipped ? `rotate(180 ${c.cx} ${c.cy})` : '');
  }
}

function setFlip(v) {
  boardFlipped = v;
  applyBoardTransform();
  render();
}

function buildSvg() {
  // Se puede llamar más de una vez: al cambiar de modalidad el tablero es
  // otro (puede pasar de 96 casillas a 81), así que primero fuera lo viejo.
  // cellPolys y coordTexts guardan nodos del SVG anterior y hay que vaciarlos,
  // o quedarían apuntando a elementos ya desconectados del documento.
  boardWrap.innerHTML = '';
  cellPolys.clear();
  coordTexts.clear();
  focoTablero = null;

  // La proporción del tablero activo, para que el CSS pueda limitar la columna
  // también por el alto: el hexágono es apaisado, pero el rectángulo de 1998
  // es bastante más alto que ancho y sin esto se sale de la ventana por abajo
  // (ver #board-col en style.css).
  document.documentElement.style.setProperty(
    '--board-aspect', (BBOX.w / BBOX.h).toFixed(4));

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `${BBOX.x} ${BBOX.y} ${BBOX.w} ${BBOX.h}`);
  svg.setAttribute('role', 'grid');
  svg.setAttribute('aria-label', 'Tablero de ajedrez triangular');

  boardGroup = document.createElementNS(SVG_NS, 'g');
  const cellsLayer = document.createElementNS(SVG_NS, 'g');
  for (const cell of CELLS) {
    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points', cell.pts.map(p => p.join(',')).join(' '));
    poly.classList.add('cell', cell.up ? 'light' : 'dark');
    // Cada casilla se puede identificar, enfocar y activar con el teclado.
    // Antes solo respondía al ratón y no tenía ningún atributo que la
    // distinguiera: ni un lector de pantalla podía nombrarla ni una prueba
    // automática seleccionarla. El aria-label lo pone updateCellLabels con la
    // pieza que haya encima, porque cambia en cada jugada.
    poly.dataset.key = cell.key;
    poly.setAttribute('role', 'gridcell');
    poly.setAttribute('tabindex', '-1');    // ver focoTablero: solo una parada
    poly.addEventListener('click', () => onCellClick(cell));
    poly.addEventListener('keydown', (e) => teclaEnCasilla(e, cell));
    poly.addEventListener('focus', () => { focoTablero = cell.key; });
    cellsLayer.appendChild(poly);
    cellPolys.set(cell.key, poly);
  }
  piecesLayer = document.createElementNS(SVG_NS, 'g');
  // capa de nombres de casilla: se dibuja una sola vez y se enseña o se
  // esconde con una clase, que sale más barato que crear y destruir 96 textos
  // cada vez que se repinta el tablero
  coordsLayer = document.createElementNS(SVG_NS, 'g');
  coordsLayer.setAttribute('class', 'coords-layer');
  for (const cell of CELLS) {
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', cell.cx);
    // los triángulos que apuntan hacia arriba tienen el hueco abajo y al revés
    t.setAttribute('y', cell.cy + (cell.up ? 9 : -4));
    t.setAttribute('class', 'coord-txt');
    t.textContent = cellName(cell);
    coordsLayer.appendChild(t);
    coordTexts.set(cell.key, t);
  }
  boardGroup.appendChild(cellsLayer);
  // los nombres van DEBAJO de las piezas: encima las tapaban y el tablero se
  // volvia ilegible justo donde hay algo que mirar
  boardGroup.appendChild(coordsLayer);
  boardGroup.appendChild(piecesLayer);
  svg.appendChild(boardGroup);
  boardWrap.appendChild(svg);
  applyBoardTransform();
}

// --- lo que oye quien no ve la pantalla ----------------------------------
//
// Se dice la última jugada en notación y el estado. Solo se escribe cuando el
// texto CAMBIA: un aria-live vuelve a leerlo todo cada vez que se toca, y
// render() se llama muchas veces por jugada (al pasar el ratón por el
// análisis, al repintar el reloj...), así que sin este filtro el lector de
// pantalla no callaría nunca.
const anuncioEl = document.getElementById('anuncio');
let ultimoAnuncio = '';

function anunciar(idx) {
  const partes = [];
  if (idx >= 1 && game.history[idx] && game.history[idx].lastMove) {
    const quien = idx % 2 === 1 ? 'Blancas' : 'Negras';
    partes.push(quien + ': ' + sheetEntry(idx).texto);
  }
  if (turnEl.textContent) partes.push(turnEl.textContent);
  if (statusEl.textContent) partes.push(statusEl.textContent);
  const texto = partes.join('. ');
  if (texto !== ultimoAnuncio) {
    ultimoAnuncio = texto;
    anuncioEl.textContent = texto;
  }
}

// --- teclado en el tablero -----------------------------------------------
//
// UNA SOLA PARADA DE TABULADOR para las 96 casillas, y dentro se anda con las
// flechas (el patrón "roving tabindex"). La primera versión dejaba las 96
// casillas tabulables, y eso, más que accesible, era impracticable: para
// llegar del tablero a los controles había que pulsar Tab casi cien veces.
//
// Izquierda y derecha recorren la fila; arriba y abajo saltan de fila
// buscando la casilla más cercana en horizontal, que es lo que espera
// cualquiera al mirar el tablero. Con el tablero volteado las direcciones se
// invierten, porque el dibujo está girado 180°.
let focoTablero = null;      // key de la casilla que está en el orden de tabulación

function aplicarFocoTablero(key, mover) {
  if (!cellPolys.has(key)) return;
  if (focoTablero && cellPolys.has(focoTablero)) {
    cellPolys.get(focoTablero).setAttribute('tabindex', '-1');
  }
  focoTablero = key;
  const poly = cellPolys.get(key);
  poly.setAttribute('tabindex', '0');
  if (mover) poly.focus();
}

function vecinaEnDireccion(cell, dx, dy) {
  const fila = rowCells(cell.b);                       // ya viene ordenada por cx
  if (dx) {
    const i = fila.findIndex(c => c.key === cell.key);
    return fila[i + dx] || null;
  }
  const otra = rowCells(cell.b + dy);
  if (!otra.length) return null;
  return otra.reduce((m, c) =>
    Math.abs(c.cx - cell.cx) < Math.abs(m.cx - cell.cx) ? c : m);
}

function teclaEnCasilla(e, cell) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onCellClick(cell);
    return;
  }
  const s = boardFlipped ? -1 : 1;
  const dir = {
    ArrowLeft: [-s, 0], ArrowRight: [s, 0],
    ArrowUp: [0, s], ArrowDown: [0, -s],
  }[e.key];
  if (!dir) return;
  e.preventDefault();
  const destino = vecinaEnDireccion(cell, dir[0], dir[1]);
  if (destino) aplicarFocoTablero(destino.key, true);
}

function onCellClick(cell) {
  if (reviewIndex !== null) return;   // revisando el historial: no se puede mover
  if (gameEnded()) return;
  if (aiConfig[game.turn] !== null) return;   // le toca al ordenador

  if (selected && legalTargets.some(t => t.key === cell.key)) {
    const from = selected, to = cell.key;
    selected = null;
    legalTargets = [];
    // coronando: hay que elegir pieza antes de mover (la IA siempre corona a
    // dama, pero el humano decide)
    if (isPromotion(game.board, from, to)) {
      askPromotion(game.board.get(from).color, (tipo) => {
        makeMove(from, to, tipo);
        marcarParaAnimar();
        gamePaused = false;
        render();
        scheduleAi();
      });
      render();   // repinta sin la selección mientras se elige
      return;
    }
    makeMove(from, to);
    marcarParaAnimar();
    // el humano mueve: si estaba en pausa, la partida se reanuda sola
    gamePaused = false;
    render();
    scheduleAi();
    return;
  }
  const piece = game.board.get(cell.key);
  if (piece && piece.color === game.turn && cell.key !== selected) {
    selected = cell.key;
    legalTargets = legalMoves(game.board, cell.key, piece);
  } else {
    selected = null;
    legalTargets = [];
  }
  render();
}

// Índice en game.history de la última jugada hecha por `color`, o null si
// ese color aún no ha movido en la posición mostrada (viva o revisada).
function lastOwnMoveIndex(color, turn) {
  const idx = effIndex();
  if (color === rival(turn)) return idx >= 1 ? idx : null;
  return idx >= 2 ? idx - 1 : null;
}

// Longitud de capturedBy[color] si su última jugada propia fue una captura
// (o -1 si no hay ninguna captura "vigente" que resaltar).
function recentCaptureLen(color, turn) {
  const idx = lastOwnMoveIndex(color, turn);
  if (idx === null) return -1;
  const before = game.history[idx - 1].capturedBy[color].length;
  const after = game.history[idx].capturedBy[color].length;
  return after > before ? after : -1;
}

// La pieza que se comió en la jugada `idx` del historial, o null si esa jugada
// no fue captura. Se deduce comparando capturedBy con la entrada anterior, como
// hace recentCaptureLen: el motor no guarda la comida en lastMove y no hace
// falta que lo haga, y así las partidas guardadas de antes también la enseñan.
function piezaComidaEn(idx) {
  const h = game.history[idx], antes = game.history[idx - 1];
  if (!h || !antes || !h.lastMove) return null;
  const quien = rival(h.turn);   // el que movió, no el que mueve ahora
  const lista = h.capturedBy[quien];
  return lista.length > antes.capturedBy[quien].length
    ? lista[lista.length - 1] : null;
}

function renderCaptured(el, color, turn, capturedBy) {
  el.innerHTML = '';
  const recentLen = recentCaptureLen(color, turn);
  capturedBy[color].forEach((p, i) => {
    const span = document.createElement('span');
    span.className = 'cap-piece' + (i === recentLen - 1 ? ' recent' : '');
    if (ICON_PIECES[p.type]) {
      // icono vectorial en línea (los emoji 🐘 y 🦄 no distinguen color en iOS)
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      const use = document.createElementNS(SVG_NS, 'use');
      use.setAttribute('href', ICON_PIECES[p.type]);
      use.setAttribute('class', `piece-${p.type} piece-${p.color === 'w' ? 'w' : 'b'}`);
      svg.appendChild(use);
      span.appendChild(svg);
    } else {
      span.textContent = GLYPH[p.type];
    }
    el.appendChild(span);
  });
}

// Piezas que no tienen glifo Unicode recoloreable y van como símbolo SVG: el
// elefante del ajedrez de Salas y el unicornio de Dekle. Los emoji 🐘 y 🦄
// vienen con color de fábrica y iOS ignora el fill del CSS.
const ICON_PIECES = { E: '#piece-elephant', U: '#piece-unicorn' };

// Un nodo SVG para una pieza en (cx, cy): texto Unicode para las piezas de
// ajedrez, o el icono vectorial para las de ICON_PIECES. En ambos casos con la
// clase de color, que aporta el fill/stroke.
function makePieceNode(type, color, cx, cy) {
  const cls = `piece piece-${type} ` + (color === 'w' ? 'piece-w' : 'piece-b');
  let node;
  if (ICON_PIECES[type]) {
    const s = 22;                       // lado del icono en unidades del tablero
    node = document.createElementNS(SVG_NS, 'use');
    node.setAttribute('href', ICON_PIECES[type]);
    node.setAttribute('x', cx - s / 2);
    node.setAttribute('y', cy - s / 2);
    node.setAttribute('width', s);
    node.setAttribute('height', s);
  } else {
    node = document.createElementNS(SVG_NS, 'text');
    node.setAttribute('x', cx);
    node.setAttribute('y', cy);
    node.textContent = GLYPH[type];
  }
  node.setAttribute('class', cls);
  return node;
}

// Quien haya pedido al sistema que no le muevan cosas en pantalla no recibe ni
// el destello de la captura (la insignia sí: informa, no adorna).
const sinAnimacion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Insignia de captura: la pieza que se acaba de comer, en miniatura dentro de
// un círculo rojo, como un superíndice de la pieza que la ha comido. Se queda
// hasta la jugada siguiente —igual que el resaltado .last-move—, porque un
// efecto que se desvanece no sirve de nada a quien estaba mirando otra cosa;
// lo que solo pasa una vez, con la jugada recién hecha, es el destello.
function makeCaptureBadge(pieza, cell, destellar) {
  // Arriba a la derecha del centro de la casilla. En los ▲ el hueco de arriba
  // es el estrecho (el vértice), así que la insignia baja un poco. Al voltear
  // el tablero un ▲ se ve como un ▽, de ahí `arriba` y no `cell.up`.
  const arriba = boardFlipped ? !cell.up : cell.up;
  const dx = 12, dy = arriba ? -7 : -12;

  const g = document.createElementNS(SVG_NS, 'g');
  // El mismo truco que las piezas: la rotación propia cancela la del tablero
  // volteado, así que la insignia sale derecha, y como ambas son de 180° el
  // desplazamiento (dx, dy) conserva su signo EN PANTALLA.
  const giro = boardFlipped ? `rotate(180 ${cell.cx} ${cell.cy}) ` : '';
  g.setAttribute('transform', `${giro}translate(${cell.cx + dx} ${cell.cy + dy})`);

  const destello = destellar && !sinAnimacion.matches;
  if (destello) {
    const aura = document.createElementNS(SVG_NS, 'circle');
    aura.setAttribute('class', 'captura-aura');
    aura.setAttribute('r', 7);
    // se borra por reloj y no con animationend: si la animación no llega a
    // arrancar (la pestaña estaba en segundo plano) ese evento no llega nunca
    // y la onda se quedaría colgada del SVG
    setTimeout(() => aura.remove(), 800);
    g.appendChild(aura);
  }

  // La escala del pop va en un grupo aparte porque la transform de CSS
  // sustituiría al atributo transform, que es el que coloca la insignia. Va con
  // @keyframes y no con el doble rAF de las piezas —donde hace falta porque la
  // casilla de salida es un dato variable— para que la insignia no pueda
  // quedarse encogida si nunca llega el fotograma que la devuelve a su tamaño.
  const marca = document.createElementNS(SVG_NS, 'g');
  marca.setAttribute('class', 'captura-marca' + (destello ? ' captura-nueva' : ''));
  const disco = document.createElementNS(SVG_NS, 'circle');
  disco.setAttribute('class', 'captura-disco');
  disco.setAttribute('r', 7);
  marca.appendChild(disco);
  const mini = document.createElementNS(SVG_NS, 'g');
  mini.setAttribute('class', 'captura-mini');
  mini.setAttribute('transform', 'scale(0.5)');
  mini.appendChild(makePieceNode(pieza.type, pieza.color, 0, 0));
  marca.appendChild(mini);
  g.appendChild(marca);
  return g;
}

// Dibujo del tablero (casillas resaltadas y piezas). Va aparte de render()
// porque al recorrer con el ratón la lista del análisis solo cambia el
// tablero: un render() completo reconstruiría las filas justo debajo del
// cursor y volvería a disparar sus eventos de entrada y salida del ratón.
function drawBoard() {
  const reviewing = reviewIndex !== null;
  // posición dibujada: la de la jugada del análisis señalada con el ratón
  // (que es la ANTERIOR a esa jugada, con la pieza todavía en su casilla de
  // salida), la revisada, o la viva de `game`
  const snapIndex = analysisHover ? analysisHover.baseIndex : reviewIndex;
  const snap = snapIndex === null ? null : game.history[snapIndex];
  const board = snap ? new Map(snap.board) : game.board;
  const turn = snap ? snap.turn : game.turn;
  const status = snap ? snap.status : game.status;
  const lastMove = snap ? snap.lastMove : game.lastMove;

  for (const poly of cellPolys.values()) {
    poly.classList.remove('selected', 'legal', 'capture', 'castle', 'last-move',
      'in-check', 'analysis-from', 'analysis-to');
  }
  if (lastMove && !analysisHover) {
    cellPolys.get(lastMove.from).classList.add('last-move');
    cellPolys.get(lastMove.to).classList.add('last-move');
  }
  if (analysisHover) {
    cellPolys.get(analysisHover.from).classList.add('analysis-from');
    cellPolys.get(analysisHover.to).classList.add('analysis-to');
  }
  if (!reviewing && !analysisHover && selected) {
    cellPolys.get(selected).classList.add('selected');
  }
  if (!reviewing && !analysisHover) {
    for (const t of legalTargets) {
      // el enroque se marca sobre la casilla de la torre propia, así que ahí
      // hay una pieza pero no es una captura (ver CASTLING en rules.js)
      const occ = board.get(t.key);
      cellPolys.get(t.key).classList.add(
        !occ ? 'legal' : (occ.color === turn ? 'castle' : 'capture'));
    }
  }
  if (status === 'check' || status === 'checkmate') {
    const king = findKing(board, turn);
    if (king) cellPolys.get(king.key).classList.add('in-check');
  }

  piecesLayer.innerHTML = '';
  // Animación de la jugada recién hecha: la pieza se dibuja en su destino,
  // pero se ARRANCA desplazada hasta el origen y se deja que la transición de
  // CSS la lleve a su sitio. Así no hace falta conservar los nodos entre
  // repintados (se recrean todos), que era el motivo de que esto no
  // existiera. Solo se anima la posición viva, no la revisión del historial.
  const animar = animarJugada;
  animarJugada = null;
  for (const [key, p] of board) {
    const cell = CELL_MAP.get(key);
    const node = makePieceNode(p.type, p.color, cell.cx, cell.cy);
    const giro = boardFlipped ? `rotate(180 ${cell.cx} ${cell.cy})` : '';
    if (animar && animar.to === key) {
      const org = CELL_MAP.get(animar.from);
      node.setAttribute('transform',
        `translate(${org.cx - cell.cx} ${org.cy - cell.cy}) ${giro}`);
      node.classList.add('mueve');
      // en el fotograma siguiente se quita el desplazamiento y la transición
      // hace el resto; sin el doble rAF el navegador junta los dos estados y
      // no se ve nada
      requestAnimationFrame(() => requestAnimationFrame(() => {
        node.setAttribute('transform', giro);
      }));
    } else if (giro) {
      node.setAttribute('transform', giro);
    }
    piecesLayer.appendChild(node);
  }
  // Insignia de la pieza recién comida, encima de todas las piezas. Vive
  // mientras la captura sea la última jugada mostrada; como piecesLayer se
  // vacía en cada repintado, no hay nada que limpiar.
  if (lastMove && !analysisHover) {
    const comida = piezaComidaEn(reviewIndex === null ? game.histIndex : reviewIndex);
    if (comida) {
      piecesLayer.appendChild(
        makeCaptureBadge(comida, CELL_MAP.get(lastMove.to), !!animar));
    }
  }
  updateCellLabels(board);
}

// Nombre hablado de cada casilla: sus coordenadas y lo que hay encima. Las
// piezas se dibujan en su propia capa, así que sin esto un lector de pantalla
// anunciaría 96 casillas indistinguibles y vacías.
function updateCellLabels(board) {
  for (const cell of CELLS) {
    const p = board.get(cell.key);
    const poly = cellPolys.get(cell.key);
    const que = p ? `${PIECE_NAMES[p.type]} ${colorAdj(p.type, p.color)}` : 'vacía';
    poly.setAttribute('aria-label', `${cellName(cell)}: ${que}`);
  }
}

function render() {
  const reviewing = reviewIndex !== null;
  // posición mostrada: la revisada (solo lectura) o la viva de `game`
  const snap = reviewing ? game.history[reviewIndex] : null;
  const turn = snap ? snap.turn : game.turn;
  const status = snap ? snap.status : game.status;
  const winner = snap ? snap.winner : game.winner;
  const capturedBy = snap ? snap.capturedBy : game.capturedBy;
  const idx = effIndex();

  drawBoard();

  const names = { w: 'blancas', b: 'negras' };
  if (status === 'checkmate') {
    turnEl.textContent = 'Fin de la partida';
    statusEl.textContent = `¡Jaque mate! Ganan las ${names[winner]}.`;
  } else if (status === 'stalemate') {
    turnEl.textContent = 'Fin de la partida';
    statusEl.textContent = 'Tablas por ahogado.';
  } else if (status === 'repetition') {
    turnEl.textContent = 'Fin de la partida';
    statusEl.textContent = 'Tablas por triple repetición.';
  } else if (status === 'fifty') {
    turnEl.textContent = 'Fin de la partida';
    statusEl.textContent = 'Tablas por la regla de los 50 movimientos.';
  } else if (status === 'material') {
    turnEl.textContent = 'Fin de la partida';
    statusEl.textContent = 'Tablas: solo quedan los reyes.';
  } else {
    turnEl.textContent = `Juegan las ${names[turn]}`;
    let msg = status === 'check' ? '¡Jaque!' : '';
    if (isAiTurn() && atHistoryEnd()) {
      msg += (msg ? ' ' : '') + 'El ordenador piensa…';
    }
    statusEl.textContent = msg;
  }
  anunciar(idx);
  ajustarReloj();
  if (reviewing) {
    turnEl.textContent = 'Revisando historial';
  } else if (gamePaused) {
    statusEl.textContent = (statusEl.textContent ? statusEl.textContent + ' ' : '') +
      '⏸ Partida en pausa.';
  }
  moveCounterEl.textContent = `Jugada ${idx} de ${game.history.length - 1}`;
  renderCaptured(capWEl, 'w', turn, capturedBy);
  renderCaptured(capBEl, 'b', turn, capturedBy);
  renderScoresheet();
  renderAnalysis();

  const playing = !!playTimer;
  // revisando, estos botones siguen útiles para volver a la partida en vivo
  // aunque la posición viva ya esté en ese extremo del historial
  btnStart.disabled = btnUndo.disabled = playing || (!reviewing && game.histIndex === 0);
  btnRedo.disabled = btnEnd.disabled =
    playing || (!reviewing && game.histIndex === game.history.length - 1);
  btnPlayBack.disabled = playing || idx === 0;
  btnPlayFwd.disabled = playing || idx === game.history.length - 1;
  btnStop.disabled = !playing;
  btnPause.classList.toggle('active', gamePaused);
  btnPause.title = gamePaused ? 'Reanudar partida' : 'Pausar partida';
}

function clearSelection() {
  selected = null;
  legalTargets = [];
}

// --- elección de pieza al coronar ---
//
// Se pregunta solo al humano: la IA corona siempre a dama (subcoronar es
// rarísimo y multiplicaría por cinco las ramas de cada peón en la séptima).
// El diálogo se monta sobre el tablero y no deja seguir hasta elegir; con
// Escape se toma la dama, que es lo que se querrá en la práctica.
const PIECE_NAMES = { P: 'Peón', N: 'Caballo', B: 'Alfil', E: 'Elefante',
  U: 'Unicornio', R: 'Torre', Q: 'Dama', K: 'Rey' };
// torre y dama son femeninas: "torre blanca", pero "peón blanco"
const PIECE_FEM = new Set(['R', 'Q']);
const colorAdj = (tipo, color) => PIECE_FEM.has(tipo)
  ? (color === 'w' ? 'blanca' : 'negra')
  : (color === 'w' ? 'blanco' : 'negro');
const PROMOTION_NAMES = PIECE_NAMES;

function askPromotion(color, onPick) {
  const back = document.createElement('div');
  back.className = 'promo-back';
  const box = document.createElement('div');
  box.className = 'promo-box';
  const title = document.createElement('p');
  title.className = 'promo-title';
  title.textContent = 'Corona el peón:';
  box.appendChild(title);

  const cerrar = (tipo) => {
    document.removeEventListener('keydown', onKey);
    back.remove();
    onPick(tipo);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); cerrar('Q'); }
  };

  const fila = document.createElement('div');
  fila.className = 'promo-row';
  for (const tipo of V.promotionChoices) {
    const b = document.createElement('button');
    b.className = 'promo-btn piece-' + (color === 'w' ? 'w' : 'b');
    b.title = PROMOTION_NAMES[tipo];
    if (ICON_PIECES[tipo]) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', ICON_PIECES[tipo]);
      svg.appendChild(use);
      b.appendChild(svg);
    } else {
      b.textContent = GLYPH[tipo];
    }
    b.addEventListener('click', () => cerrar(tipo));
    fila.appendChild(b);
  }
  box.appendChild(fila);
  back.appendChild(box);
  document.body.appendChild(back);
  document.addEventListener('keydown', onKey);
  fila.firstChild.focus();
}

// --- panel de análisis: puntuación de las jugadas ---
//
// Para elegir su jugada, la búsqueda ya puntúa TODAS las legales (ver el
// bucle raíz de chooseAiMove) y luego tira esa lista. Con la casilla
// «Guardar el análisis» activada, la lista se guarda en la instantánea de la
// posición RESULTANTE —igual que `lastMove`—, de modo que al mirar una jugada
// del ordenador se ve a la vez qué puntuación tenía y qué alternativas
// descartó. Guardarla obliga a buscar con la ventana abierta, y por eso es
// opcional: ver el comentario del bucle raíz en ai.js.
//
// Sin análisis guardado (jugada humana, casilla desactivada, partida vieja)
// queda el botón «Analizar esta posición», que calcula a petición las jugadas
// disponibles DESDE la posición mostrada.

const ANALYSIS_ROWS = 8;    // filas visibles antes de «ver todas»
const ANALYSIS_LEVEL = 4;   // nivel del análisis a petición si no juega el ordenador

let liveAnalysis = null;    // {posKey, list} análisis pedido a mano
let analysisBusy = false;   // hay un análisis a petición en marcha
let analysisShowAll = false;

// Puntuación en peones, desde el punto de vista de quien mueve (positivo =
// bueno para él). Los mates valen ±MATE±profundidad, no un número de peones.
function formatScore(s) {
  if (s >= MATE - 1000) return 'mate';
  if (s <= -MATE + 1000) return '−mate';
  const v = s / 100;
  return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
}

// El panel puede enseñar dos análisis distintos de la posición idx, y a la vez:
//
// - RETROSPECTIVO: las alternativas de la jugada que llevó HASTA idx (la que el
//   ordenador ya hizo). Su tablero de partida es el anterior, idx − 1. 'random'
//   si ese bando jugó al azar (nivel 1, sin puntuaciones).
// - PRÓXIMO: lo que el bando al que le toca puede jugar AHORA desde idx. No se
//   guarda en el historial; se calcula a petición (ver requestLiveAnalysis) y
//   vive en liveAnalysis. Su tablero de partida es idx.
//
// `baseIndex` es, en cada caso, el tablero que hay que consultar para saber qué
// pieza mueve en cada fila.
function retroAnalysis(idx) {
  const stored = idx > 0 ? game.history[idx].analysis : null;
  if (stored === 'random') return { random: true };
  if (Array.isArray(stored)) {
    // en una partida cargada la lista viene recortada (ver trimAnalysis)
    const total = game.history[idx].analysisTotal || stored.length;
    return { list: stored, baseIndex: idx - 1, total };
  }
  return null;
}

function nextAnalysis(idx) {
  if (liveAnalysis && liveAnalysis.posKey === game.history[idx].posKey) {
    return { list: liveAnalysis.list, baseIndex: idx };
  }
  return null;
}

// Texto legible de una jugada sobre `board`: «♞ 1,0,1 → 0,1,0 ×♟». Se usa
// tanto en el panel de análisis como en la lista de jugadas, para que ambos
// muestren exactamente el mismo formato. `castle` fuerza la marca de enroque:
// en la lista de jugadas `to` es la casilla de llegada del rey (no la de la
// torre), así que isCastling() no lo detectaría (ver lastMove.castle en
// rules.js); en el análisis se omite y basta isCastling sobre la torre.
// --- notación de las jugadas ---------------------------------------------
//
// Antes una jugada se leía "♞ 1,-3,3 → -1,-1,4": las coordenadas en bruto del
// motor, ilegibles y sin poder copiarse a ningún sitio. Ahora se escribe como
// en el ajedrez de siempre, con las casillas nombradas B1A, N4H… (ver
// cellName en geometry.js) y las iniciales españolas de las piezas.
//
//   CB3D×N4E+   caballo de B3D captura en N4E y da jaque
//   B2D-B4D     peón de B2D a B4D
//   0-0         enroque corto        0-0-0  enroque largo
//   B7E-B8E=D   peón corona en B8E eligiendo dama
//
// SE ESCRIBE EL ORIGEN SIEMPRE (notación larga), y no por gusto: los nombres
// de casilla empiezan por B o N y contienen letras A..H, que son justo las
// iniciales de las piezas. En notación corta salían jugadas como "D×N5D",
// que lo mismo es la Dama capturando que un peón de la franja D, o "CBB3C",
// que no hay quien lo lea. Con el origen delante y un separador en medio no
// hay ambigüedad posible, y de paso sobra toda la lógica de desambiguar, que
// es una fuente de fallos menos.
const LETRA_PIEZA = { K: 'R', Q: 'D', R: 'T', B: 'A', N: 'C', E: 'E', U: 'U', P: '' };

// '+' si la jugada dio jaque, '#' si fue mate. Solo se sabe de las jugadas ya
// hechas (el estado viene del snapshot siguiente); las jugadas propuestas del
// panel de análisis se quedan sin marca.
function marcaFinal(status) {
  return status === 'checkmate' ? '#' : status === 'check' ? '+' : '';
}

function moveText(board, from, to, castle, opts = {}) {
  const piece = board.get(from);
  if (!piece) return from + '→' + to;                 // historial incoherente
  if (castle || isCastling(board, from, to)) {
    // `to` es la casilla de la torre en una jugada propuesta y la de llegada
    // del rey en una ya hecha; las dos caen en el lado corto para el enroque
    // corto (índices 0 y 1 de la fila del borde, ver CASTLING en rules.js)
    const fila = backRow(piece.color).map(c => c.key);
    const i = fila.indexOf(to);
    return (i === 0 || i === 1 ? '0-0' : '0-0-0') + marcaFinal(opts.status);
  }
  const celda = CELL_MAP.get(from);
  const target = board.get(to);
  // al paso: el peón va en diagonal a una casilla vacía, así que la captura
  // no se ve mirando el destino
  const esCaptura = !!(target && target.color !== piece.color) ||
    (piece.type === 'P' && celda.pawnCap[piece.color].some(c => c.key === to));
  const corona = opts.promo ? '=' + LETRA_PIEZA[opts.promo] : '';
  return LETRA_PIEZA[piece.type] + cellName(celda) + (esCaptura ? '×' : '-') +
    cellName(CELL_MAP.get(to)) + corona + marcaFinal(opts.status);
}

// Una fila: «3. ♞ 1,0,1 → 0,1,0 ×♟   +0.35». Al señalarla con el ratón, el
// tablero muestra la posición de partida con esa jugada marcada. Si `action`
// no es null, pulsarla la ejecuta (`action(from, to)`), con `hint` de tooltip.
function analysisRow(board, entry, rank, baseIndex, markChosen, action, hint) {
  // `chosen` sale de la búsqueda, que siempre acaba eligiendo una jugada;
  // solo tiene sentido enseñarla cuando esa jugada se llegó a jugar
  const chosen = markChosen && entry.chosen;
  const li = document.createElement('li');
  li.className = 'an-row' + (chosen ? ' chosen' : '') + (action ? ' playable' : '');
  li.title = action ? hint : chosen ? 'Jugada elegida por el ordenador' : '';
  const add = (cls, txt) => {
    const s = document.createElement('span');
    s.className = cls;
    s.textContent = txt;
    li.appendChild(s);
  };
  add('an-rank', rank + '.');
  // jugada propuesta: no se sabe si dará jaque, así que no lleva +/#
  add('an-move', moveText(board, entry.from, entry.to));
  add('an-score', formatScore(entry.score));

  li.addEventListener('mouseenter', () => {
    analysisHover = { baseIndex, from: entry.from, to: entry.to };
    drawBoard();   // solo el tablero: ver el comentario de drawBoard()
  });
  li.addEventListener('mouseleave', () => { analysisHover = null; drawBoard(); });
  if (action) li.addEventListener('click', () => action(entry.from, entry.to));
  return li;
}

// Juega desde la lista del análisis, igual que pinchar en el tablero (ver la
// rama del movimiento en onCellClick): es el humano moviendo en su turno, así
// que reanuda la partida para que el ordenador (si lo hay) responda.
function playAnalysisMove(from, to) {
  applyListMove(from, to);
  gamePaused = false;
  render();
  scheduleAi();
}

// Fuerza la jugada del bando que mueve (aunque lo controle el ordenador) y deja
// la partida EN PAUSA, para examinar la posición resultante antes de seguir.
function forceNextMove(from, to) {
  applyListMove(from, to);
  render();
}

// Rehace la última jugada de otra forma: deshace y juega la alternativa
// elegida. Como makeMove→finishMove trunca el futuro rehacible, queda una rama
// nueva. También en pausa.
function replaceLastMove(from, to) {
  undoMove();
  applyListMove(from, to);
  render();
}

// Parte común: aplica una jugada elegida en la lista sin decidir el después
// (pausa/reanudación la pone quien llama). La posición cambia, así que el
// análisis a petición y el resalte caducan.
function applyListMove(from, to) {
  analysisHover = null;
  clearSelection();
  makeMove(from, to);
  marcarParaAnimar();
  liveAnalysis = null;
}

function analysisNote(txt) {
  const p = document.createElement('p');
  p.className = 'an-note';
  p.textContent = txt;
  analysisBodyEl.appendChild(p);
}

// Pinta una sección (encabezado + lista + «ver todas»). `action`, si no es
// null, hace jugables las filas; `played` marca la jugada elegida y la saca al
// final si se quedó fuera de las visibles.
function appendAnalysisSection({ list, baseIndex, played, action, hint, header }) {
  analysisNote(header);
  const board = new Map(game.history[baseIndex].board);
  const ul = document.createElement('ul');
  ul.className = 'an-list';
  const shown = analysisShowAll ? list.length : Math.min(ANALYSIS_ROWS, list.length);
  for (let i = 0; i < shown; i++) {
    ul.appendChild(analysisRow(board, list[i], i + 1, baseIndex, played, action, hint));
  }
  // la elegida no siempre está entre las mejores: el sorteo por
  // PLAY_TOLERANCE puede coger cualquiera de la banda (ver ai.js)
  const chosenAt = played ? list.findIndex(e => e.chosen) : -1;
  if (chosenAt >= shown) {
    const sep = document.createElement('li');
    sep.className = 'an-gap';
    sep.textContent = '⋮';
    ul.appendChild(sep);
    ul.appendChild(analysisRow(board, list[chosenAt], chosenAt + 1, baseIndex, true, action, hint));
  }
  analysisBodyEl.appendChild(ul);

  if (list.length > ANALYSIS_ROWS) {
    const more = document.createElement('button');
    more.className = 'an-more';
    more.textContent = analysisShowAll ? 'Ver solo las mejores' : `Ver todas (${list.length})`;
    more.addEventListener('click', () => { analysisShowAll = !analysisShowAll; renderAnalysis(); });
    analysisBodyEl.appendChild(more);
  }
}

// Lista de todas las jugadas de la partida, una por fila. Pulsar una salta a
// esa posición en modo revisión (solo lectura, como la reproducción ◀◀/▶▶):
// no toca game.histIndex ni interrumpe al ordenador. La fila de la posición
// mostrada queda resaltada (clase `current`).
// Texto y anotación de cada jugada, cacheados por índice del historial: el
// texto exige reconstruir el tablero anterior (un Map de ~40 piezas) y la
// lista entera se repinta en cada render(), también cada 500 ms durante la
// reproducción. Solo se calcula la fila que aún no está en la caché; se
// invalida al deshacer, cargar o empezar partida (ver invalidateSheetCache).
// Se autovalida comparando la jugada guardada con la del historial, así que
// no hay que acordarse de invalidarla al deshacer, cargar o empezar partida:
// si la entrada i ya no describe la misma jugada (o le ha llegado el
// análisis después), se recalcula sola.
const sheetCache = [];

// Anotación de error: cuánto empeoró la evaluación al hacer la jugada,
// comparando la de la posición anterior con la de la resultante.
//
// No sirve comparar la jugada con la mejor de su propia lista: el ordenador
// siempre elige dentro de PLAY_TOLERANCE (25 cp) de la mejor, así que por
// construcción nunca se desviaría lo bastante. La comparación entre
// posiciones consecutivas, en cambio, mide lo que de verdad pasó —y es lo
// que hacen los analizadores de partidas—: la evaluación de después la hizo
// una búsqueda que ya vio la respuesta del rival.
//
// Necesita evaluación en las dos posiciones, así que solo aparece con el
// análisis guardado en ambas (típicamente ordenador contra ordenador).
//
// UMBRALES CALIBRADOS CONTRA EL RUIDO, no elegidos a ojo. Las dos
// evaluaciones que se restan salen de búsquedas distintas —una desde la
// posición anterior y otra desde la siguiente—, así que no están en la misma
// escala: cada motor, recién buscado, se ve un poco mejor a sí mismo (el
// clásico efecto par-impar). Midiéndolo con el mismo nivel jugando contra sí
// mismo, donde por definición nadie se equivoca (entrenamiento/
// ruido-anotaciones.js, 165 jugadas a profundidad 4):
//
//   sesgo medio +17,8 cp por jugada (deberia ser 0; 130 de 165 positivas)
//   |perdida|: mediana 26, p95 60, MAXIMO 107
//   con umbral 50 se marcaba el 6,1% de las jugadas normales; con 100, ninguna
//
// Por eso la imprecisión empieza en 120 cp, por encima del máximo observado.
// El 50 de antes no marcaba errores: marcaba el desacuerdo entre dos
// búsquedas. Vuelve a medirlo si cambias la evaluación o PLAY_TOLERANCE.
const BLUNDER_MARKS = [[500, '??', 'Error grave'], [250, '?', 'Error'],
  [120, '?!', 'Imprecisión']];

// Evaluación de la posición i en centipeones desde el punto de vista de las
// BLANCAS, o null si esa posición no tiene análisis guardado. El análisis de
// history[i] puntúa desde quien movió (blancas cuando i es impar).
function evalWhiteAt(i) {
  const an = game.history[i] && game.history[i].analysis;
  if (!Array.isArray(an)) return null;
  const jugada = an.find(e => e.chosen);
  if (!jugada) return null;
  return (i % 2 === 1) ? jugada.score : -jugada.score;
}

function moveAnnotation(i) {
  const antes = evalWhiteAt(i - 1);
  const despues = evalWhiteAt(i);
  if (antes === null || despues === null) return null;
  // pérdida del que movió: las blancas pierden cuando la evaluación baja
  const perdida = (i % 2 === 1) ? antes - despues : despues - antes;
  for (const [umbral, marca, titulo] of BLUNDER_MARKS) {
    if (perdida >= umbral) {
      return { marca, titulo: `${titulo}: la evaluación empeoró ${(perdida / 100).toFixed(2)} peones` };
    }
  }
  return null;
}

function sheetEntry(i) {
  const h = game.history[i];
  const { from, to, castle, promo } = h.lastMove;
  // marca del análisis: cambia cuando el ordenador lo adjunta tras mover
  const anTag = Array.isArray(h.analysis) ? h.analysis.length : (h.analysis || 0);
  const hit = sheetCache[i];
  if (hit && hit.from === from && hit.to === to && hit.anTag === anTag) return hit;
  const prevBoard = new Map(game.history[i - 1].board);
  sheetCache[i] = {
    from, to, anTag,
    // el estado sale del snapshot de DESPUÉS: el jaque o el mate lo da
    // justamente esta jugada
    texto: moveText(prevBoard, from, to, castle, { promo, status: h.status }),
    anot: moveAnnotation(i),
  };
  return sheetCache[i];
}

function renderScoresheet() {
  scoresheetBodyEl.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'sheet-list';
  const cur = effIndex();

  for (let i = 1; i < game.history.length; i++) {
    const entrada = sheetEntry(i);
    const row = document.createElement('div');
    row.className = 'sheet-row' + (i === cur ? ' current' : '');

    const num = document.createElement('span');
    num.className = 'sheet-num';
    // el número de jugada solo en la ply de las blancas (i impar); i=1 es la
    // primera jugada blanca, i=2 la primera negra, etc.
    num.textContent = (i % 2 === 1) ? Math.ceil(i / 2) + '.' : '';
    const mv = document.createElement('span');
    mv.className = 'sheet-move';
    mv.textContent = entrada.texto;
    row.appendChild(num);
    row.appendChild(mv);
    if (entrada.anot) {
      const marca = document.createElement('span');
      marca.className = 'sheet-mark mark-' + (entrada.anot.marca === '??' ? 'bad'
        : entrada.anot.marca === '?' ? 'mid' : 'soft');
      marca.textContent = entrada.anot.marca;
      marca.title = entrada.anot.titulo;
      row.appendChild(marca);
    }

    row.addEventListener('click', () => {
      if (playTimer) { clearInterval(playTimer); playTimer = null; }
      // saltar a la última jugada = volver a seguir la partida en vivo
      reviewIndex = (i === game.history.length - 1) ? null : i;
      render();
    });
    list.appendChild(row);
  }

  if (game.history.length <= 1) {
    const empty = document.createElement('p');
    empty.className = 'an-note';
    empty.textContent = 'Aún no se ha jugado ninguna jugada.';
    scoresheetBodyEl.appendChild(empty);
    return;
  }
  scoresheetBodyEl.appendChild(list);
  // mantener a la vista la jugada actual al crecer la lista
  const currentRow = list.querySelector('.sheet-row.current');
  if (currentRow) currentRow.scrollIntoView({ block: 'nearest' });
}

// --- gráfica de la evaluación a lo largo de la partida ---
//
// Aprovecha lo que ya está guardado: la puntuación de cada jugada del
// ordenador (history[i].analysis, la entrada `chosen`). Esa puntuación viene
// del punto de vista de quien movía; aquí se normaliza a «desde las blancas»
// para que la curva se lea como en cualquier motor: arriba = mejor para
// blancas. Los mates se recortan a ±10 peones para que no aplasten la escala.
const EVAL_CAP = 1000;
const CHART_W = 260, CHART_H = 68;

function evalSeries() {
  const pts = [];
  for (let i = 1; i < game.history.length; i++) {
    const v = evalWhiteAt(i);   // ya viene normalizada a «desde las blancas»
    if (v === null) continue;
    pts.push({ i, v: Math.max(-EVAL_CAP, Math.min(EVAL_CAP, v)) });
  }
  return pts;
}

function buildEvalChart() {
  const pts = evalSeries();
  if (pts.length < 2) return null;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${CHART_W} ${CHART_H}`);
  svg.setAttribute('class', 'eval-chart');
  const maxI = game.history.length - 1;
  const x = i => (maxI <= 1 ? 0 : (i / maxI) * CHART_W);
  // Escala vertical AJUSTADA A LA PARTIDA, no fija a EVAL_CAP. Con el tope de
  // 10 peones clavado, una partida equilibrada —que es la mayoría— salía como
  // una raya plana en el centro y no se leía nada. El suelo de 150 cp evita
  // el efecto contrario: que el ruido de una partida igualada se vea como
  // dientes de sierra dramáticos.
  const tope = Math.max(150, ...pts.map(p => Math.abs(p.v)));
  const y = v => CHART_H / 2 - (v / tope) * (CHART_H / 2 - 2);

  const el = (tag, attrs) => {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };
  // banda de igualdad y línea del cero
  svg.appendChild(el('rect', { x: 0, y: y(50), width: CHART_W,
    height: Math.max(1, y(-50) - y(50)), class: 'eval-band' }));
  svg.appendChild(el('line', { x1: 0, y1: y(0), x2: CHART_W, y2: y(0), class: 'eval-zero' }));
  // área bajo la curva y curva
  const d = pts.map((p, k) => (k ? 'L' : 'M') + x(p.i).toFixed(1) + ' ' + y(p.v).toFixed(1)).join(' ');
  svg.appendChild(el('path', {
    d: d + ` L${x(pts[pts.length - 1].i).toFixed(1)} ${y(0).toFixed(1)} L${x(pts[0].i).toFixed(1)} ${y(0).toFixed(1)} Z`,
    class: 'eval-area',
  }));
  svg.appendChild(el('path', { d, class: 'eval-line' }));
  // marca de la jugada que se está viendo
  const cur = effIndex();
  if (cur >= 1) {
    svg.appendChild(el('line', { x1: x(cur), y1: 0, x2: x(cur), y2: CHART_H, class: 'eval-cursor' }));
  }
  // zonas clicables: una por jugada con dato, para saltar a esa posición
  for (const p of pts) {
    const hit = el('rect', { x: Math.max(0, x(p.i) - 3), y: 0, width: 6, height: CHART_H,
      class: 'eval-hit' });
    const tip = el('title', {});
    tip.textContent = `Jugada ${Math.ceil(p.i / 2)}${p.i % 2 ? '' : '…'}: ` +
      `${formatScore(p.v)} para las blancas`;
    hit.appendChild(tip);
    hit.addEventListener('click', () => {
      if (playTimer) { clearInterval(playTimer); playTimer = null; }
      reviewIndex = (p.i === game.history.length - 1) ? null : p.i;
      render();
    });
    svg.appendChild(hit);
  }
  return svg;
}

function renderAnalysis() {
  analysisBodyEl.innerHTML = '';
  const idx = effIndex();
  const retro = retroAnalysis(idx);
  const next = nextAnalysis(idx);

  const chart = buildEvalChart();
  if (chart) {
    const caja = document.createElement('div');
    caja.className = 'eval-box';
    caja.title = 'Evaluación desde el punto de vista de las blancas; pulsa para ir a esa jugada';
    caja.appendChild(chart);
    analysisBodyEl.appendChild(caja);
  }

  // Intervenir (rehacer/forzar) solo tiene sentido en el extremo vivo del
  // historial, sin una búsqueda a medias y con la partida en pausa (el análisis
  // retrospectivo solo existe para jugadas del ordenador, así que rehacer sin
  // pausa competiría con el worker que sigue jugando).
  const canEdit = reviewIndex === null && game.histIndex === game.history.length - 1 &&
    !analysisBusy && !aiBusy() && gamePaused;

  // --- la jugada que el ordenador ya hizo, y sus alternativas ---
  if (retro && retro.random) {
    analysisNote('El nivel 1 juega al azar: no puntúa las jugadas.');
  } else if (retro) {
    const total = retro.total || retro.list.length;
    appendAnalysisSection({
      list: retro.list, baseIndex: retro.baseIndex, played: true,
      action: canEdit ? replaceLastMove : null,
      hint: 'Pulsa para rehacer la última jugada así',
      header: `Jugada que hizo el ordenador — sus alternativas, de mejor a peor (${total} legales).`,
    });
  }

  // --- lo que se puede jugar ahora desde esta posición ---
  if (next) {
    const humanTurn = aiConfig[game.turn] === null;
    // forzar la jugada del ordenador exige la partida en pausa, para no competir
    // con el worker; el humano juega en su turno como siempre (y reanuda)
    const canPlay = reviewIndex === null && idx === game.histIndex && !gameEnded() &&
      (humanTurn || gamePaused) && !analysisBusy && !aiBusy();
    appendAnalysisSection({
      list: next.list, baseIndex: next.baseIndex, played: false,
      action: canPlay ? (humanTurn ? playAnalysisMove : forceNextMove) : null,
      hint: humanTurn ? 'Pulsa para hacer esta jugada'
        : 'Pulsa para forzar esta jugada del ordenador',
      header: humanTurn
        ? `Jugadas posibles desde esta posición, de mejor a peor (${next.list.length}).`
        : `Próxima jugada — pulsa una para forzarla, de mejor a peor (${next.list.length}).`,
    });
    return;
  }

  // Sin lista de la posición actual: ofrecer calcularla. En una jugada del
  // ordenador esto es «elegir/forzar»; en el turno del humano, «analizar».
  const status = game.history[idx].status;
  const hasMoves = status === 'playing' || status === 'check';
  if (!retro && idx > 0 && !optAnalysisEl.checked) {
    analysisNote('Marca «Guardar el análisis de cada jugada del ordenador» para ver aquí sus alternativas.');
  }
  if (reviewIndex !== null || idx !== game.histIndex || !hasMoves) return;

  const btn = document.createElement('button');
  btn.className = 'an-btn';
  const forcing = aiConfig[game.turn] !== null;   // le toca al ordenador
  btn.textContent = analysisBusy ? 'Analizando…'
    : forcing ? 'Elegir la próxima jugada' : 'Analizar esta posición';
  // el worker es el mismo que juega la partida: no se puede pedir mientras el
  // ordenador piensa o le toca mover sin estar en pausa (isAiTurn ya es falso
  // en pausa)
  btn.disabled = analysisBusy || aiBusy() || isAiTurn();
  if (!analysisBusy && (aiBusy() || isAiTurn())) {
    btn.title = 'Pausa la partida para elegir la jugada (el ordenador está usando la búsqueda)';
  }
  btn.addEventListener('click', requestLiveAnalysis);
  analysisBodyEl.appendChild(btn);
}

// Analiza a petición la posición mostrada (la revisada o la viva). Si el
// bando que mueve no lo lleva el ordenador, se usa el nivel del rival o, en
// humano contra humano, ANALYSIS_LEVEL; el nivel 1 no vale, no puntúa.
function requestLiveAnalysis() {
  const idx = effIndex();
  const turn = game.history[idx].turn;
  const level = Math.max(2, aiConfig[turn] ?? aiConfig[rival(turn)] ?? ANALYSIS_LEVEL);
  const token = aiToken;
  analysisBusy = true;
  renderAnalysis();
  requestAiMove(level, (mv) => {
    if (token !== aiToken) return;   // deshacer, nueva partida, cambio de modo…
    analysisBusy = false;
    liveAnalysis = mv && mv.analysis
      ? { posKey: game.history[idx].posKey, list: mv.analysis } : null;
    render();
  }, { analyze: true }, stateAtIndex(idx));
}

// --- modos de juego y turno del ordenador ---

// Quién controla cada color: null = humano, o nivel 1..8 del ordenador.
const aiConfig = { w: null, b: null };
let aiToken = 0;   // invalida los timers y búsquedas pendientes de la IA

function atHistoryEnd() { return game.histIndex === game.history.length - 1; }
function gameOver() { return gameEnded(); }
function isAiTurn() { return !gamePaused && aiConfig[game.turn] !== null && !gameOver(); }
function cancelAi() { aiToken++; abortAiSearch(); analysisBusy = false; }

// Si le toca al ordenador (y estamos al final del historial), juega tras una
// pequeña pausa. La búsqueda corre en un worker (ai-async.js), así que la
// interfaz sigue viva mientras piensa; el token invalida el resultado si
// entre tanto el usuario deshizo, cargó otra partida, etc.
// En ordenador vs ordenador se encadena solo hasta el final.
function scheduleAi() {
  if (!isAiTurn() || !atHistoryEnd()) return;
  const token = aiToken;
  setTimeout(() => {
    if (token !== aiToken || !isAiTurn() || !atHistoryEnd()) return;
    requestAiMove(aiConfig[game.turn], (mv) => {
      if (token !== aiToken || !isAiTurn() || !atHistoryEnd()) return;
      if (!mv) return;
      makeMove(mv.from, mv.to);
      marcarParaAnimar();
      // el análisis se guarda en la instantánea que acaba de crear makeMove,
      // la de la posición resultante (ver el panel de análisis); el nivel 1
      // juega al azar y no puntúa nada, de ahí la marca 'random'
      if (mv.analysis !== undefined) {
        game.history[game.histIndex].analysis = mv.analysis || 'random';
      }
      render();
      scheduleAi();
    }, { analyze: optAnalysisEl.checked });
  }, 400);
}

let lastMode = null;   // para detectar cambios reales de modalidad

function applyModeFromUI() {
  const m = modeEl.value;
  aiConfig.w = (m === 'ch' || m === 'cc') ? parseInt(levelWEl.value, 10) : null;
  aiConfig.b = (m === 'hc' || m === 'cc') ? parseInt(levelBEl.value, 10) : null;
  rowLevelW.classList.toggle('hidden', aiConfig.w === null);
  rowLevelB.classList.toggle('hidden', aiConfig.b === null);
  // Al cambiar de modalidad (no al tocar solo el nivel), orientar el tablero
  // automáticamente: si el humano lleva negras, se voltea para que las vea
  // abajo. El usuario puede voltearlo manualmente después con btn-flip.
  if (m !== lastMode) {
    boardFlipped = (m === 'ch');
    applyBoardTransform();
    gamePaused = true;   // cambiar de modalidad pausa la partida
  }
  lastMode = m;
  exitReview();
  cancelAi();
  clearSelection();
  render();
  scheduleAi();
}

modeEl.addEventListener('change', applyModeFromUI);
levelWEl.addEventListener('change', applyModeFromUI);
levelBEl.addEventListener('change', applyModeFromUI);
btnFlip.addEventListener('click', () => setFlip(!boardFlipped));
// solo cambia el texto del panel: el análisis se guarda en la jugada siguiente
optAnalysisEl.addEventListener('change', render);

btnStart.addEventListener('click', () => { exitReview(); cancelAi(); goToStart(); clearSelection(); render(); scheduleAi(); });
btnUndo.addEventListener('click', () => {
  exitReview();
  cancelAi();
  undoMove();
  // contra el ordenador se deshace el par: su respuesta y la jugada humana
  const oneAi = (aiConfig.w === null) !== (aiConfig.b === null);
  if (oneAi && aiConfig[game.turn] !== null && game.histIndex > 0) undoMove();
  clearSelection();
  render();
});
btnRedo.addEventListener('click', () => { exitReview(); cancelAi(); redoMove(); clearSelection(); render(); scheduleAi(); });
btnEnd.addEventListener('click', () => { exitReview(); cancelAi(); goToEnd(); clearSelection(); render(); scheduleAi(); });

// --- reproducción a velocidad (una jugada cada 0.5 s) y pausa ---

const PLAY_INTERVAL_MS = 500;

btnPlayBack.addEventListener('click', () => {
  if (playTimer) return;
  if (reviewIndex === null) reviewIndex = game.histIndex;
  playTimer = setInterval(() => {
    if (reviewIndex === 0) { clearInterval(playTimer); playTimer = null; render(); return; }
    reviewIndex--;
    render();
  }, PLAY_INTERVAL_MS);
  render();
});

btnPlayFwd.addEventListener('click', () => {
  if (playTimer) return;
  if (reviewIndex === null) reviewIndex = game.histIndex;
  const target = game.history.length - 1;   // fijo: se detiene aquí aunque el historial siga creciendo
  playTimer = setInterval(() => {
    if (reviewIndex >= target) {
      clearInterval(playTimer);
      playTimer = null;
      if (reviewIndex === game.history.length - 1) reviewIndex = null;   // vuelve a seguir la partida en vivo
      render();
      return;
    }
    reviewIndex++;
    render();
  }, PLAY_INTERVAL_MS);
  render();
});

btnStop.addEventListener('click', () => {
  if (playTimer) { clearInterval(playTimer); playTimer = null; render(); }
});

btnPause.addEventListener('click', () => {
  gamePaused = !gamePaused;
  render();
  if (!gamePaused) scheduleAi();
});

// --- selector de modalidad ---
//
// Cambiar de modalidad cambia el tablero entero, así que hay que rehacerlo
// todo: la geometría (que puede pasar de 96 a 81 casillas), el SVG, las
// miniaturas del panel de reglas y el worker de la IA, que se quedó con una
// copia del tablero viejo. Y se empieza partida nueva, claro: una posición de
// una modalidad no significa nada en otra.
const variantSelect = document.getElementById('variant');
const variantNote = document.getElementById('variant-note');

function fillVariantSelect() {
  for (const { id, name } of variantList()) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = name;
    if (id === V.id) o.selected = true;
    variantSelect.appendChild(o);
  }
}

// Aplica la modalidad y reconstruye todo lo que depende del tablero. Se usa
// tanto desde el selector como al cargar una partida guardada.
function applyVariant(id, empezarPartida = true) {
  if (V.id !== id) {
    cancelAi();
    abortAiSearch();
    setVariant(id);
    aiWorkerReload();
    buildSvg();
    buildRuleMinis();
    aplicarFocoTablero(casillaInicialFoco().key, false);
  }
  variantNote.textContent = V.note || '';
  variantSelect.value = V.id;
  if (!empezarPartida) return;
  exitReview();
  newGame();
  liveAnalysis = null;
  reiniciarReloj();
  gamePaused = true;          // en pausa: da tiempo a mirar el tablero nuevo
  clearSelection();
  render();
}

variantSelect.addEventListener('change', () => applyVariant(variantSelect.value));

// Carga una posición diseñada en el editor, si se pasa ?posicion=1 en la URL.
function tryLoadDesignedPosition() {
  const url = new URL(window.location);
  if (url.searchParams.get('posicion') !== '1') return;

  // Limpia la URL para que no se vuelva a cargar la posición
  history.replaceState({}, '', window.location.pathname);

  const raw = localStorage.getItem(DESIGN_POSITION_KEY);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    if (!data || !data.variant || !data.board) return;
    localStorage.removeItem(DESIGN_POSITION_KEY);

    // Cambia a la modalidad de la posición sin iniciar partida nueva
    applyVariant(data.variant, false);

    // Carga el tablero diseñado
    game.board = new Map(data.board);
    game.turn = data.turn || 'w';
    game.history = [snapshot()];
    game.histIndex = 0;
    gamePaused = true;
    clearSelection();
    render();
  } catch {
    // Ignora si el JSON está corrupto
  }
}

document.getElementById('btn-design').addEventListener('click', () => {
  window.location.href = 'editor.html';
});

document.getElementById('new-game').addEventListener('click', () => {
  // Si ya estaba en pausa sin ninguna jugada hecha, pulsar "Nueva partida"
  // no reinicia nada nuevo: se interpreta como que el usuario quiere arrancar.
  const alreadyFreshAndPaused = gamePaused && game.history.length === 1;
  exitReview();
  cancelAi();
  resetAiWorker();   // partida nueva = otra oportunidad para el worker caído
  newGame();
  liveAnalysis = null;
  reiniciarReloj();
  gamePaused = !alreadyFreshAndPaused;   // si no, arranca en pausa: da tiempo a elegir modalidad/nivel
  clearSelection();
  render();
  scheduleAi();
});

// --- guardar y cargar partidas ---

function refreshSaveList(selectedName) {
  saveSelect.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = '— ninguna —';
  saveSelect.appendChild(empty);
  for (const { name, savedAt, favorite } of listSaves()) {
    const opt = document.createElement('option');
    opt.value = name;
    const date = savedAt
      ? new Date(savedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
      : '';
    const label = date ? `${name} · ${date}` : name;
    opt.textContent = favorite ? `★ ${label}` : label;
    saveSelect.appendChild(opt);
  }
  if (selectedName) saveSelect.value = selectedName;
  btnLoad.disabled = btnFavorite.disabled = btnDelete.disabled = !saveSelect.value;
  btnFavorite.classList.toggle('active', !!saveSelect.value && isFavorite(saveSelect.value));
}

function currentEnvelope() {
  return serializeGame(modeEl.value, levelWEl.value, levelBEl.value);
}

function loadEnvelope(data) {
  exitReview();
  cancelAi();
  // Primero la modalidad —puede cambiar el tablero entero— y solo después el
  // historial, que se interpreta sobre ese tablero. `false` porque la partida
  // no se empieza de cero: la pone applySave.
  applyVariant(data.variant, false);
  applySave(data);
  liveAnalysis = null;
  modeEl.value = data.mode;
  levelWEl.value = data.levelW;
  levelBEl.value = data.levelB;
  applyModeFromUI();   // ya hace cancelAi + clearSelection + render + scheduleAi
}

saveSelect.addEventListener('change', () => {
  btnLoad.disabled = btnFavorite.disabled = btnDelete.disabled = !saveSelect.value;
  btnFavorite.classList.toggle('active', !!saveSelect.value && isFavorite(saveSelect.value));
});

btnFavorite.addEventListener('click', () => {
  const name = saveSelect.value;
  if (!name) return;
  toggleFavorite(name);
  refreshSaveList(name);
});

btnSave.addEventListener('click', () => {
  const name = (prompt('Nombre de la partida:', saveSelect.value || '') || '').trim();
  if (!name) return;
  if (localStorage.getItem(SAVE_PREFIX + name) !== null &&
      !confirm(`Ya existe una partida llamada «${name}». ¿Sobrescribirla?`)) return;
  if (!saveToStorage(name, currentEnvelope())) {
    alert('No se pudo guardar la partida (almacenamiento lleno).');
  } else {
    refreshSaveList(name);
  }
});

btnLoad.addEventListener('click', () => {
  const name = saveSelect.value;
  if (!name) return;
  const data = loadFromStorage(name);
  if (!data) {
    alert('No se pudo cargar la partida: datos dañados o incompatibles.');
    return;
  }
  loadEnvelope(data);
});

btnDelete.addEventListener('click', () => {
  const name = saveSelect.value;
  if (!name) return;
  if (!confirm(`¿Borrar la partida «${name}»?`)) return;
  deleteFromStorage(name);
  refreshSaveList();
});

btnExport.addEventListener('click', () => {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
  downloadSave(currentEnvelope(), `ajedrez-triangular-${stamp}.json`);
});

btnImport.addEventListener('click', () => {
  fileImport.value = '';
  fileImport.click();
});

// --- copiar las jugadas como texto ---------------------------------------
//
// El .json guarda la partida entera para volver a cargarla; esto es lo otro
// que hace falta: el texto de las jugadas, para pegarlo en un mensaje, un
// cuaderno o donde sea. Sale numerado en pares, como una planilla.
function movesAsText() {
  const lineas = [];
  lineas.push('Ajedrez Triangular — ' + new Date().toLocaleString('es'));
  const modo = modeEl.options[modeEl.selectedIndex].text;
  lineas.push('Modalidad: ' + modo +
    (aiConfig.w !== null ? '  ·  blancas: nivel ' + aiConfig.w : '') +
    (aiConfig.b !== null ? '  ·  negras: nivel ' + aiConfig.b : ''));
  lineas.push('');
  for (let i = 1; i < game.history.length; i += 2) {
    const n = Math.ceil(i / 2) + '.';
    const blancas = sheetEntry(i).texto;
    const negras = game.history[i + 1] ? '  ' + sheetEntry(i + 1).texto : '';
    lineas.push(n.padStart(4) + ' ' + blancas.padEnd(12) + negras);
  }
  const fin = { checkmate: 'Jaque mate', stalemate: 'Ahogado',
    repetition: 'Tablas por repetición', fifty: 'Tablas por la regla de 50',
    material: 'Tablas por material insuficiente' }[game.status];
  if (fin) {
    lineas.push('');
    lineas.push(fin + (game.winner ? ', ganan las ' +
      (game.winner === 'w' ? 'blancas' : 'negras') : ''));
  }
  return lineas.join('\n');
}

optCoordsEl.addEventListener('change', () => {
  coordsLayer.classList.toggle('visible', optCoordsEl.checked);
});

document.getElementById('btn-copy-moves').addEventListener('click', async (e) => {
  const boton = e.currentTarget;
  const texto = movesAsText();
  const original = boton.textContent;
  try {
    // el portapapeles falla en file:// en algunos navegadores y siempre que
    // la página no tenga el foco: se avisa en vez de quedarse callado
    await navigator.clipboard.writeText(texto);
    boton.textContent = '¡Copiado!';
  } catch {
    boton.textContent = 'No se pudo copiar';
    console.warn('Portapapeles no disponible. Jugadas:\n' + texto);
  }
  setTimeout(() => { boton.textContent = original; }, 1500);
});

fileImport.addEventListener('change', () => {
  const file = fileImport.files[0];
  if (!file) return;
  readSaveFile(file, loadEnvelope,
    () => alert('El archivo no es una partida válida de Ajedrez Triangular.'));
});

// --- miniaturas de movimientos en el panel de reglas ---

// Tablero pequeño no interactivo: piezas = [key, tipo, color] (la casilla de
// la primera pieza blanca queda resaltada), blueKeys = casillas a las que
// puede moverse, capKeys = capturas del peón.
function makeMini(pieces, blueKeys, capKeys) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `${BBOX.x} ${BBOX.y} ${BBOX.w} ${BBOX.h}`);
  svg.setAttribute('class', 'mini-board');
  const ownKeys = new Set(pieces.filter(p => p[2] === 'w').map(p => p[0]));
  for (const cell of CELLS) {
    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points', cell.pts.map(p => p.join(',')).join(' '));
    poly.classList.add('cell', cell.up ? 'light' : 'dark');
    if (ownKeys.has(cell.key)) poly.classList.add('selected');
    if (blueKeys.has(cell.key)) poly.classList.add('legal');
    if (capKeys && capKeys.has(cell.key)) poly.classList.add('capture');
    svg.appendChild(poly);
  }
  for (const [key, type, color] of pieces) {
    const cell = CELL_MAP.get(key);
    svg.appendChild(makePieceNode(type, color, cell.cx, cell.cy));
  }
  return svg;
}

// Casilla por la que empieza el recorrido con el tabulador: la de más abajo a
// la izquierda del dibujo, que es por donde empieza a leer cualquiera. Se
// calcula sobre las coordenadas de pantalla y no sobre la fila del borde,
// porque no todas las modalidades tienen fila de borde (Trigonal no).
function casillaInicialFoco() {
  let mejor = null;
  for (const cell of CELLS) {
    if (!mejor || cell.cy > mejor.cy + 1 ||
      (Math.abs(cell.cy - mejor.cy) <= 1 && cell.cx < mejor.cx)) {
      mejor = cell;
    }
  }
  return mejor;
}

// La casilla de la orientación pedida más cercana al centro del tablero,
// opcionalmente desplazado. Antes era una constante (el ▲ central del
// hexágono); ahora se busca, porque cada tablero tiene el centro en un sitio
// distinto y el triángulo de Koval no lo tiene en el origen.
function centralCell(up, dx = 0) {
  const cx = BBOX.x + BBOX.w / 2 + dx * BBOX.w, cy = BBOX.y + BBOX.h / 2;
  let mejor = null, d = Infinity;
  for (const cell of CELLS) {
    if (cell.up !== up) continue;
    const dist = Math.hypot(cell.cx - cx, cell.cy - cy);
    if (dist < d) { d = dist; mejor = cell; }
  }
  return mejor;
}

// Cuánto se aparta el rey al enrocarse no es igual en todas las modalidades:
// en el hexágono son dos casillas por el lado corto y tres por el largo, y en
// el rectángulo de 1998 son dos por los dos lados. Así que la frase se compone
// a partir de V.castling en vez de estar escrita en el HTML.
const NUMERO = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco'];
function textoEnroque() {
  const casillas = n => n === 1 ? 'una casilla' : NUMERO[n] + ' casillas';
  // el lado corto es aquel en el que la torre está más cerca del rey
  const reglas = V.castling
    .map(c => ({ lado: Math.abs(c.rook - c.king), pasos: Math.abs(c.kingTo - c.king) }))
    .sort((x, y) => x.lado - y.lado);
  const salta = ' hacia la torre y esta salta al otro lado';
  if (reglas.every(r => r.pasos === reglas[0].pasos)) {
    return 'El rey se desplaza ' + casillas(reglas[0].pasos) + salta + '.';
  }
  return 'Por el lado corto el rey se desplaza ' + casillas(reglas[0].pasos) +
    salta + '; por el lado largo, ' + casillas(reglas[1].pasos) + '.';
}

// Rellena el panel de reglas con la modalidad activa: la cabecera, la lista de
// piezas (de V.help) y una miniatura por pieza mostrando a dónde llega desde
// una casilla central. Se rehace entera al cambiar de modalidad.
function buildRuleMinis() {
  document.getElementById('help-variant').innerHTML =
    '<b>' + V.full + '</b>. ' + (V.note || '');
  // el enroque no existe en todas las modalidades
  document.getElementById('help-castling').classList.toggle('hidden', !V.castling);
  document.getElementById('help-castling-how').textContent =
    V.castling ? textoEnroque() : '';

  const ul = document.getElementById('help-pieces');
  ul.innerHTML = '';
  const c = centralCell(true);
  for (const [type, texto] of V.help) {
    const li = document.createElement('li');
    li.innerHTML = texto;
    ul.appendChild(li);
    if (type === 'P') continue;   // el peón lleva su propia miniatura, abajo
    const rays = c.rays[type], leaps = c.leaps[type];
    const keys = rays ? rays.flat().map(t => t.key) : leaps.map(t => t.key);
    li.appendChild(makeMini([[c.key, type, 'w']], new Set(keys)));
  }
  // Peón: uno de cada orientación, con peones negros en sus capturas, para que
  // se vea que el avance depende de hacia dónde apunta el triángulo.
  const liP = [...ul.children][V.help.findIndex(([t]) => t === 'P')];
  if (liP) {
    // uno a cada lado del centro, para que sus casillas no se pisen
    const pUp = centralCell(true, -0.15), pDown = centralCell(false, 0.15);
    const adv = new Set([...pUp.pawnPush.w, ...pDown.pawnPush.w].map(t => t.key));
    const cap = new Set([...pUp.pawnCap.w, ...pDown.pawnCap.w].map(t => t.key));
    const pieces = [[pUp.key, 'P', 'w'], [pDown.key, 'P', 'w']];
    for (const key of cap) pieces.push([key, 'P', 'b']);
    liP.appendChild(makeMini(pieces, adv, cap));
  }
}

fillVariantSelect();
variantNote.textContent = V.note || '';
buildSvg();
// la parada de tabulador del tablero arranca en su esquina de abajo a la
// izquierda, que es de donde empieza a leer cualquiera
aplicarFocoTablero(casillaInicialFoco().key, false);
buildRuleMinis();
newGame();
render();
applyModeFromUI();
refreshSaveList();
tryLoadDesignedPosition();
