// editor.js — Editor de posiciones para ajedrez triangular.

const SVG_NS = 'http://www.w3.org/2000/svg';
const PIECE_NAMES = { P: 'Peón', N: 'Caballo', B: 'Alfil', E: 'Elefante',
  U: 'Unicornio', R: 'Torre', Q: 'Dama', K: 'Rey' };
const PIECE_FEM = new Set(['R', 'Q']);
const ICON_PIECES = { E: '#piece-elephant', U: '#piece-unicorn' };

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

function cellName(cell) {
  return V.board ? V.board.name(cell) : cell.key;
}

function buildEditorSvg() {
  const boardWrap = document.getElementById('board-wrap');
  boardWrap.innerHTML = '';
  cellPolys.clear();
  coordTexts.clear();
  focoTablero = null;

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
  palette.innerHTML = '';
  palette.classList.add('editor-palette');

  // Fila de blancas
  const whiteRow = document.createElement('div');
  whiteRow.className = 'palette-row';
  for (const type of V.pieceTypes) {
    const btn = document.createElement('button');
    btn.className = 'palette-btn piece-w';
    btn.dataset.type = type;
    btn.dataset.color = 'w';
    btn.title = PIECE_NAMES[type] + ' blanca';
    btn.appendChild(makePieceNode(type, 'w', 12, 12));
    btn.addEventListener('click', () => setBrush(type, 'w', btn));
    whiteRow.appendChild(btn);
  }
  palette.appendChild(whiteRow);

  // Fila de negras
  const blackRow = document.createElement('div');
  blackRow.className = 'palette-row';
  for (const type of V.pieceTypes) {
    const btn = document.createElement('button');
    btn.className = 'palette-btn piece-b';
    btn.dataset.type = type;
    btn.dataset.color = 'b';
    btn.title = PIECE_NAMES[type] + ' negra';
    btn.appendChild(makePieceNode(type, 'b', 12, 12));
    btn.addEventListener('click', () => setBrush(type, 'b', btn));
    blackRow.appendChild(btn);
  }
  palette.appendChild(blackRow);

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
    if (id === V.id) o.selected = true;
    sel.appendChild(o);
  }
}

function onVariantChange() {
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
  const data = {
    app: 'ajedrez-triangular',
    kind: 'posicion',
    version: 1,
    variant: V.id,
    turn: turn,
    board: [...board],
  };
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

function validatePosition(data) {
  if (!data || data.version !== 1 || data.kind !== 'posicion') return false;
  if (!data.variant || !data.turn || !Array.isArray(data.board)) return false;
  if (data.turn !== 'w' && data.turn !== 'b') return false;
  const variant = VARIANTS[data.variant];
  if (!variant) return false;
  const forma = BOARDS[variant.board];
  const piezas = new Set(Object.keys(variant.pieces || VARIANTS[variant.inherits].pieces));
  for (const ent of data.board) {
    if (!Array.isArray(ent) || ent.length !== 2) return false;
    const [key, p] = ent;
    const co = String(key).split(',').map(Number);
    if (co.length !== 3 || co.some(n => !Number.isInteger(n))) return false;
    const suma = co[0] + co[1] + co[2];
    if (!(suma === 1 || suma === 2) || !forma.has(co[0], co[1], co[2])) return false;
    if (!p || !piezas.has(p.type) || (p.color !== 'w' && p.color !== 'b')) return false;
  }
  return true;
}

function importPosition() {
  document.getElementById('file-import').click();
}

document.getElementById('file-import').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  readSaveFile(file, (data) => {
    setVariant(data.variant);
    board = new Map(data.board);
    turn = data.turn;
    document.querySelector(`input[name="turn"][value="${turn}"]`).checked = true;
    buildEditorSvg();
    buildPalette();
    redraw();
    updateStatus();
    showMessage('Posición importada correctamente.');
  }, () => {
    showMessage('Error: archivo de posición no válido.', true);
  }, validatePosition);
  e.target.value = '';
});

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
  if (!kingW || !kingB) {
    showMessage('Error: se necesita un rey blanco y uno negro para jugar.', true);
    return;
  }
  const data = {
    app: 'ajedrez-triangular',
    kind: 'posicion',
    version: 1,
    variant: V.id,
    turn: turn,
    board: [...board],
  };
  localStorage.setItem(DESIGN_POSITION_KEY, JSON.stringify(data));
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
fillVariantSelect();
document.getElementById('variant').addEventListener('change', onVariantChange);

const turnRadios = document.querySelectorAll('input[name="turn"]');
turnRadios.forEach(r => r.addEventListener('change', (e) => { turn = e.target.value; }));

document.getElementById('btn-clear').addEventListener('click', clearBoard);
document.getElementById('btn-initial').addEventListener('click', setInitialPosition);
document.getElementById('btn-export').addEventListener('click', exportPosition);
document.getElementById('btn-import').addEventListener('click', importPosition);
document.getElementById('btn-play').addEventListener('click', playPosition);

buildEditorSvg();
buildPalette();
updateStatus();
