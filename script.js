// script.js — Interfaz: dibujo del tablero en SVG e interacción.

const SVG_NS = 'http://www.w3.org/2000/svg';

const boardWrap = document.getElementById('board-wrap');
const turnEl = document.getElementById('turn');
const statusEl = document.getElementById('status');
const moveCounterEl = document.getElementById('move-counter');
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
let piecesLayer = null;
let boardGroup = null;        // <g> con todo el dibujo, para poder voltearlo
let selected = null;          // key de la casilla seleccionada
let legalTargets = [];        // casillas destino legales de la selección

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
}

function setFlip(v) {
  boardFlipped = v;
  applyBoardTransform();
  render();
}

function buildSvg() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `${BBOX.x} ${BBOX.y} ${BBOX.w} ${BBOX.h}`);

  boardGroup = document.createElementNS(SVG_NS, 'g');
  const cellsLayer = document.createElementNS(SVG_NS, 'g');
  for (const cell of CELLS) {
    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points', cell.pts.map(p => p.join(',')).join(' '));
    poly.classList.add('cell', cell.up ? 'light' : 'dark');
    poly.addEventListener('click', () => onCellClick(cell));
    cellsLayer.appendChild(poly);
    cellPolys.set(cell.key, poly);
  }
  piecesLayer = document.createElementNS(SVG_NS, 'g');
  boardGroup.appendChild(cellsLayer);
  boardGroup.appendChild(piecesLayer);
  svg.appendChild(boardGroup);
  boardWrap.appendChild(svg);
  applyBoardTransform();
}

function onCellClick(cell) {
  if (reviewIndex !== null) return;   // revisando el historial: no se puede mover
  if (gameEnded()) return;
  if (aiConfig[game.turn] !== null) return;   // le toca al ordenador

  if (selected && legalTargets.some(t => t.key === cell.key)) {
    makeMove(selected, cell.key);
    selected = null;
    legalTargets = [];
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

function renderCaptured(el, color, turn, capturedBy) {
  el.innerHTML = '';
  const recentLen = recentCaptureLen(color, turn);
  capturedBy[color].forEach((p, i) => {
    const span = document.createElement('span');
    span.className = 'cap-piece' + (i === recentLen - 1 ? ' recent' : '');
    span.textContent = GLYPH[p.type];
    el.appendChild(span);
  });
}

function render() {
  const reviewing = reviewIndex !== null;
  // posición mostrada: la revisada (solo lectura) o la viva de `game`
  const snap = reviewing ? game.history[reviewIndex] : null;
  const board = snap ? new Map(snap.board) : game.board;
  const turn = snap ? snap.turn : game.turn;
  const status = snap ? snap.status : game.status;
  const winner = snap ? snap.winner : game.winner;
  const lastMove = snap ? snap.lastMove : game.lastMove;
  const capturedBy = snap ? snap.capturedBy : game.capturedBy;
  const idx = effIndex();

  for (const poly of cellPolys.values()) {
    poly.classList.remove('selected', 'legal', 'capture', 'last-move', 'in-check');
  }
  if (lastMove) {
    cellPolys.get(lastMove.from).classList.add('last-move');
    cellPolys.get(lastMove.to).classList.add('last-move');
  }
  if (!reviewing && selected) cellPolys.get(selected).classList.add('selected');
  if (!reviewing) {
    for (const t of legalTargets) {
      cellPolys.get(t.key).classList.add(board.get(t.key) ? 'capture' : 'legal');
    }
  }
  if (status === 'check' || status === 'checkmate') {
    const king = findKing(board, turn);
    if (king) cellPolys.get(king.key).classList.add('in-check');
  }

  piecesLayer.innerHTML = '';
  for (const [key, p] of board) {
    const cell = CELL_MAP.get(key);
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', cell.cx);
    text.setAttribute('y', cell.cy);
    text.setAttribute('class',
      `piece piece-${p.type} ` + (p.color === 'w' ? 'piece-w' : 'piece-b'));
    if (boardFlipped) text.setAttribute('transform', `rotate(180 ${cell.cx} ${cell.cy})`);
    text.textContent = GLYPH[p.type];
    piecesLayer.appendChild(text);
  }

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
  } else {
    turnEl.textContent = `Juegan las ${names[turn]}`;
    let msg = status === 'check' ? '¡Jaque!' : '';
    if (isAiTurn() && atHistoryEnd()) {
      msg += (msg ? ' ' : '') + 'El ordenador piensa…';
    }
    statusEl.textContent = msg;
  }
  if (reviewing) {
    turnEl.textContent = 'Revisando historial';
  } else if (gamePaused) {
    statusEl.textContent = (statusEl.textContent ? statusEl.textContent + ' ' : '') +
      '⏸ Partida en pausa.';
  }
  moveCounterEl.textContent = `Jugada ${idx} de ${game.history.length - 1}`;
  renderCaptured(capWEl, 'w', turn, capturedBy);
  renderCaptured(capBEl, 'b', turn, capturedBy);

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

// --- modos de juego y turno del ordenador ---

// Quién controla cada color: null = humano, o nivel 1..8 del ordenador.
const aiConfig = { w: null, b: null };
let aiToken = 0;   // invalida los timers y búsquedas pendientes de la IA

function atHistoryEnd() { return game.histIndex === game.history.length - 1; }
function gameOver() { return gameEnded(); }
function isAiTurn() { return !gamePaused && aiConfig[game.turn] !== null && !gameOver(); }
function cancelAi() { aiToken++; abortAiSearch(); }

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
      render();
      scheduleAi();
    });
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

document.getElementById('new-game').addEventListener('click', () => {
  // Si ya estaba en pausa sin ninguna jugada hecha, pulsar "Nueva partida"
  // no reinicia nada nuevo: se interpreta como que el usuario quiere arrancar.
  const alreadyFreshAndPaused = gamePaused && game.history.length === 1;
  exitReview();
  cancelAi();
  newGame();
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
  applySave(data);
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
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', cell.cx);
    text.setAttribute('y', cell.cy);
    text.setAttribute('class',
      `piece piece-${type} ` + (color === 'w' ? 'piece-w' : 'piece-b'));
    text.textContent = GLYPH[type];
    svg.appendChild(text);
  }
  return svg;
}

function buildRuleMinis() {
  const c = getCell(1, 0, 1);  // ▲ central, con tablero vacío alrededor
  const flat = rays => rays.flat().map(t => t.key);
  const sets = {
    R: flat(c.rookRays),
    B: flat(c.bishopRays),
    Q: flat(c.rookRays).concat(flat(c.elephantRays)),
    N: c.knightTargets.map(t => t.key),
    E: flat(c.elephantRays),
    K: c.kingNbrs.map(t => t.key),
  };
  for (const [type, keys] of Object.entries(sets)) {
    const li = document.querySelector(`#help li[data-piece="${type}"]`);
    li.appendChild(makeMini([[c.key, type, 'w']], new Set(keys)));
  }
  // Peón: uno de cada orientación, con peones negros en sus capturas
  const pUp = getCell(-1, 0, 3), pDown = getCell(2, 0, -1);
  const adv = new Set([...pUp.pawnAdv.w, ...pDown.pawnAdv.w].map(t => t.key));
  const cap = new Set([...pUp.pawnCap.w, ...pDown.pawnCap.w].map(t => t.key));
  const pieces = [[pUp.key, 'P', 'w'], [pDown.key, 'P', 'w']];
  for (const key of cap) pieces.push([key, 'P', 'b']);
  const liP = document.querySelector('#help li[data-piece="P"]');
  liP.appendChild(makeMini(pieces, adv, cap));
}

buildSvg();
buildRuleMinis();
newGame();
render();
applyModeFromUI();
refreshSaveList();
