// editor.js — Editor de posiciones para ajedrez triangular.

const SVG_NS = 'http://www.w3.org/2000/svg';
const PIECE_NAMES = { P: 'Peón', N: 'Caballo', B: 'Alfil', E: 'Elefante',
  U: 'Unicornio', R: 'Torre', Q: 'Dama', K: 'Rey',
  O: 'Piedra', A: 'Papel', T: 'Tijera', L: 'Lagarto', S: 'Spock' };
const PIECE_FEM = new Set(['R', 'Q', 'O', 'T']);
const ICON_PIECES = {
  E: '#piece-elephant', U: '#piece-unicorn',
  O: '#piece-rock', A: '#piece-paper', T: '#piece-scissors',
  L: '#piece-lizard', S: '#piece-spock',
};

let board = new Map();
let turn = 'w';
let brush = null;
let cellPolys = new Map();
let coordTexts = new Map();
let piecesLayer = null;
let boardGroup = null;
let focoTablero = null;

// Duplicado de makePieceNode de script.js (necesario porque no se carga script.js)
function makePieceNode(type, color, cx, cy) {
  const cls = `piece piece-${type} ` + (color === 'w' ? 'piece-w' : 'piece-b');
  let node;
  if (ICON_PIECES[type]) {
    const s = 22;
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

// Un botón de la paleta es HTML, no una capa del SVG del tablero: un <text> o
// un <use> sueltos, sin un <svg> que los envuelva, no pintan nada. Mismo
// criterio que los botones de coronación de script.js.
function setPieceContent(btn, type) {
  if (ICON_PIECES[type]) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', ICON_PIECES[type]);
    svg.appendChild(use);
    btn.appendChild(svg);
  } else {
    btn.textContent = GLYPH[type];
  }
}

function cellName(cell) {
  return BOARD && BOARD.name ? BOARD.name(cell) : cell.key;
}

function buildEditorSvg() {
  const boardWrap = document.getElementById('board-wrap');
  if (!boardWrap) {
    console.error('buildEditorSvg: #board-wrap not found');
    return;
  }

  if (!CELLS || CELLS.length === 0) {
    console.error('buildEditorSvg: CELLS not initialized, length=' + (CELLS ? CELLS.length : 'undefined'));
    return;
  }

  boardWrap.innerHTML = '';
  cellPolys.clear();
  coordTexts.clear();
  focoTablero = null;

  if (!BBOX) {
    console.error('buildEditorSvg: BBOX not initialized');
    return;
  }

  document.documentElement.style.setProperty(
    '--board-aspect', (BBOX.w / BBOX.h).toFixed(4));

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `${BBOX.x} ${BBOX.y} ${BBOX.w} ${BBOX.h}`);
  svg.setAttribute('role', 'grid');
  svg.setAttribute('aria-label', 'Tablero de ajedrez triangular para editar');

  boardGroup = document.createElementNS(SVG_NS, 'g');
  const cellsLayer = document.createElementNS(SVG_NS, 'g');
  for (const cell of CELLS) {
    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points', cell.pts.map(p => p.join(',')).join(' '));
    poly.classList.add('cell', cell.up ? 'light' : 'dark');
    poly.dataset.key = cell.key;
    poly.setAttribute('role', 'gridcell');
    poly.setAttribute('tabindex', '-1');
    poly.addEventListener('click', () => placeOrErase(cell));
    poly.addEventListener('contextmenu', (e) => { e.preventDefault(); eraseCell(cell); });
    poly.addEventListener('keydown', (e) => teclaEnCasilla(e, cell));
    poly.addEventListener('focus', () => { focoTablero = cell.key; });
    cellsLayer.appendChild(poly);
    cellPolys.set(cell.key, poly);
  }
  piecesLayer = document.createElementNS(SVG_NS, 'g');
  const coordsLayer = document.createElementNS(SVG_NS, 'g');
  coordsLayer.setAttribute('class', 'coords-layer');
  for (const cell of CELLS) {
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', cell.cx);
    t.setAttribute('y', cell.cy + (cell.up ? 9 : -4));
    t.setAttribute('class', 'coord-txt');
    t.textContent = cellName(cell);
    coordsLayer.appendChild(t);
    coordTexts.set(cell.key, t);
  }
  boardGroup.appendChild(cellsLayer);
  boardGroup.appendChild(coordsLayer);
  boardGroup.appendChild(piecesLayer);
  svg.appendChild(boardGroup);
  boardWrap.appendChild(svg);
}

function redraw() {
  piecesLayer.innerHTML = '';
  for (const [key, p] of board) {
    const cell = CELL_MAP.get(key);
    const node = makePieceNode(p.type, p.color, cell.cx, cell.cy);
    piecesLayer.appendChild(node);
  }
}

function placeOrErase(cell) {
  if (!brush) { eraseCell(cell); return; }
  const existing = board.get(cell.key);
  if (existing && existing.type === brush.type && existing.color === brush.color) {
    board.delete(cell.key);
  } else {
    board.set(cell.key, { type: brush.type, color: brush.color });
  }
  redraw();
  updateStatus();
}

function eraseCell(cell) {
  board.delete(cell.key);
  redraw();
  updateStatus();
}

function buildPalette() {
  const palette = document.getElementById('palette');
  if (!palette) {
    console.error('buildPalette: #palette not found');
    return;
  }

  if (!V || !V.pieceTypes) {
    console.error('buildPalette: V or V.pieceTypes not initialized, V=' + (V ? 'exists' : 'null'));
    return;
  }

  palette.innerHTML = '';
  palette.classList.add('editor-palette');

  // Blancas y negras van en un contenedor aparte de la goma: así el CSS las
  // pone como dos columnas enfrentadas (paleta a la izquierda del tablero) o
  // como dos filas (pantalla estrecha, paleta debajo) sin tocar el JS.
  const cols = document.createElement('div');
  cols.className = 'palette-cols';

  const whiteRow = document.createElement('div');
  whiteRow.className = 'palette-row';
  for (const type of V.pieceTypes) {
    const btn = document.createElement('button');
    btn.className = 'palette-btn piece-w';
    btn.dataset.type = type;
    btn.dataset.color = 'w';
    btn.title = PIECE_NAMES[type] + ' blanca';
    setPieceContent(btn, type);
    btn.addEventListener('click', () => setBrush(type, 'w', btn));
    whiteRow.appendChild(btn);
  }
  cols.appendChild(whiteRow);

  const blackRow = document.createElement('div');
  blackRow.className = 'palette-row';
  for (const type of V.pieceTypes) {
    const btn = document.createElement('button');
    btn.className = 'palette-btn piece-b';
    btn.dataset.type = type;
    btn.dataset.color = 'b';
    btn.title = PIECE_NAMES[type] + ' negra';
    setPieceContent(btn, type);
    btn.addEventListener('click', () => setBrush(type, 'b', btn));
    blackRow.appendChild(btn);
  }
  cols.appendChild(blackRow);
  palette.appendChild(cols);

  // Goma de borrar
  const eraserRow = document.createElement('div');
  eraserRow.className = 'palette-row';
  const eraserBtn = document.createElement('button');
  eraserBtn.className = 'palette-btn eraser-btn';
  eraserBtn.textContent = '🗑';
  eraserBtn.title = 'Goma de borrar';
  eraserBtn.addEventListener('click', () => setBrush(null, null, eraserBtn));
  eraserRow.appendChild(eraserBtn);
  palette.appendChild(eraserRow);
}

function setBrush(type, color, btn) {
  document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
  if (type === null) {
    brush = null;
  } else {
    brush = { type, color };
    btn.classList.add('active');
  }
}

function updateStatus() {
  const count = board.size;
  const el = document.getElementById('editor-status');
  el.textContent = `${count} pieza${count === 1 ? '' : 's'} en el tablero`;
}

function fillVariantSelect() {
  const sel = document.getElementById('variant');
  sel.innerHTML = '';
  for (const { id, name } of variantList()) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = name;
    if (V && id === V.id) o.selected = true;
    sel.appendChild(o);
  }
}

// Ojo con el nombre: `onVariantChange` es el gancho global que setVariant()
// llama al final (ver el final de setVariant en variants.js), y que ai.js usa
// para rehacer sus tablas. Si el manejador del selector se llamara así, el
// editor —que no carga ai.js— ocuparía ese hueco y se llamaría a sí mismo en
// bucle hasta desbordar la pila.
function aplicarModalidad() {
  if (board.size > 0) {
    if (!confirm('Cambiar de modalidad vaciará el tablero. ¿Continuar?')) return;
  }
  const newId = document.getElementById('variant').value;
  setVariant(newId);
  board.clear();
  buildEditorSvg();
  buildPalette();
  redraw();
  updateStatus();
}

function clearBoard() {
  board.clear();
  redraw();
  updateStatus();
}

function setInitialPosition() {
  board = initialPosition();
  redraw();
  updateStatus();
}

function exportPosition() {
  const data = serializePosition(board, turn);
  const filename = `posicion-${new Date().toISOString().split('T')[0]}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Volcar un sobre en el editor: la modalidad primero, porque cambia el tablero
// entero (y con él la paleta de piezas), y solo después el contenido.
function aplicarPosicion(data) {
  setVariant(data.variant);
  board = new Map(data.board);
  turn = data.turn;
  document.querySelector(`input[name="turn"][value="${turn}"]`).checked = true;
  document.getElementById('variant').value = V.id;
  buildEditorSvg();
  buildPalette();
  redraw();
  updateStatus();
}

function importPosition() {
  document.getElementById('file-import').click();
}

document.getElementById('file-import').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  readSaveFile(file, (data) => {
    aplicarPosicion(data);
    showMessage('Posición importada correctamente.');
  }, () => {
    showMessage('Error: archivo de posición no válido.', true);
  }, validatePosition);
  e.target.value = '';
});

// --- posiciones guardadas en el navegador ---

const positionSelect = document.getElementById('position-select');
const btnOpenPos = document.getElementById('btn-open-pos');
const btnDeletePos = document.getElementById('btn-delete-pos');

function refreshPositionList(selectedName) {
  positionSelect.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = '— ninguna —';
  positionSelect.appendChild(empty);
  for (const { name, savedAt } of listPositions()) {
    const opt = document.createElement('option');
    opt.value = name;
    const fecha = savedAt
      ? new Date(savedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
      : '';
    opt.textContent = fecha ? `${name} · ${fecha}` : name;
    positionSelect.appendChild(opt);
  }
  if (selectedName) positionSelect.value = selectedName;
  actualizarBotonesPosicion();
}

function actualizarBotonesPosicion() {
  btnOpenPos.disabled = btnDeletePos.disabled = !positionSelect.value;
}

function savePosition() {
  const name = (prompt('Nombre de la posición:', positionSelect.value || '') || '').trim();
  if (!name) return;
  if (positionExists(name) &&
      !confirm(`Ya existe una posición llamada «${name}». ¿Sobrescribirla?`)) return;
  if (!savePositionToStorage(name, serializePosition(board, turn))) {
    showMessage('No se pudo guardar la posición (almacenamiento lleno).', true);
    return;
  }
  refreshPositionList(name);
  showMessage(`Posición «${name}» guardada.`);
}

function openPosition() {
  const name = positionSelect.value;
  if (!name) return;
  const data = loadPositionFromStorage(name);
  if (!data) {
    showMessage('No se pudo abrir la posición: datos dañados o incompatibles.', true);
    return;
  }
  aplicarPosicion(data);
  refreshPositionList(name);
  showMessage(`Posición «${name}» abierta.`);
}

function deletePosition() {
  const name = positionSelect.value;
  if (!name) return;
  if (!confirm(`¿Borrar la posición «${name}»?`)) return;
  deletePositionFromStorage(name);
  refreshPositionList();
  showMessage(`Posición «${name}» borrada.`);
}

function showMessage(msg, isError = false) {
  const el = document.getElementById('editor-message');
  el.textContent = msg;
  el.className = 'editor-message ' + (isError ? 'error' : 'success');
  setTimeout(() => { el.textContent = ''; el.className = 'editor-message'; }, 3000);
}

function playPosition() {
  let kingW = null, kingB = null;
  for (const [key, p] of board) {
    if (p.type === 'K') {
      if (p.color === 'w') kingW = key;
      if (p.color === 'b') kingB = key;
    }
  }
  // en las modalidades sin rey (Piedra, papel y tijera) no hay rey que exigir
  if (!V.kingless && (!kingW || !kingB)) {
    showMessage('Error: se necesita un rey blanco y uno negro para jugar.', true);
    return;
  }
  localStorage.setItem(DESIGN_POSITION_KEY,
    JSON.stringify(serializePosition(board, turn)));
  window.location.href = 'index.html?posicion=1';
}

function teclaEnCasilla(e, cell) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    placeOrErase(cell);
    return;
  }
  const dir = {
    ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    ArrowUp: [0, 1], ArrowDown: [0, -1],
  }[e.key];
  if (!dir) return;
  e.preventDefault();
  const destino = vecinaEnDireccion(cell, dir[0], dir[1]);
  if (destino) aplicarFocoTablero(destino.key, true);
}

function vecinaEnDireccion(cell, dx, dy) {
  const fila = rowCells(cell.b);
  if (dx) {
    const i = fila.findIndex(c => c.key === cell.key);
    return fila[i + dx] || null;
  }
  const otra = rowCells(cell.b + dy);
  if (!otra.length) return null;
  return otra.reduce((m, c) =>
    Math.abs(c.cx - cell.cx) < Math.abs(m.cx - cell.cx) ? c : m);
}

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

function rowCells(b) {
  return CELLS.filter(c => c.b === b).sort((a, c) => a.cx - c.cx);
}

// Inicialización
// Asegurar que V está inicializado (debería estarlo por variants.js, pero por si acaso)
if (!V) setVariant(DEFAULT_VARIANT || 'salas');

fillVariantSelect();
document.getElementById('variant').addEventListener('change', aplicarModalidad);

const turnRadios = document.querySelectorAll('input[name="turn"]');
turnRadios.forEach(r => r.addEventListener('change', (e) => { turn = e.target.value; }));

document.getElementById('btn-clear').addEventListener('click', clearBoard);
document.getElementById('btn-initial').addEventListener('click', setInitialPosition);
document.getElementById('btn-export').addEventListener('click', exportPosition);
document.getElementById('btn-import').addEventListener('click', importPosition);
document.getElementById('btn-play').addEventListener('click', playPosition);

document.getElementById('btn-save-pos').addEventListener('click', savePosition);
btnOpenPos.addEventListener('click', openPosition);
btnDeletePos.addEventListener('click', deletePosition);
positionSelect.addEventListener('change', actualizarBotonesPosicion);

buildEditorSvg();
buildPalette();
updateStatus();
refreshPositionList();
