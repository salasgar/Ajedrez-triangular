// saveload.js — Guardar y cargar partidas (localStorage y archivos .json).
//
// Formato de guardado: un "sobre" versionado con el historial completo de la
// partida (los snapshots de rules.js ya son serializables a JSON) más la
// configuración de modalidad y niveles del ordenador.

const SAVE_PREFIX = 'ajedrez-triangular:save:';
const DESIGN_POSITION_KEY = 'ajedrez-triangular:posicion-disenada';
// Traspaso de "Editar tablero": la partida en curso va aquí mientras el
// usuario está en editor.html retocándola. El editor añade `board`/`turn` al
// volver; sin ellos (p. ej. tras pulsar "atrás" en el navegador) la partida
// se restaura tal cual estaba, sin aplicar ninguna edición.
// { app, kind:'edicion', version:1, savedAt, envelope, board?, turn? }
//   envelope : lo que devuelve serializeGame(mode, levelW, levelB)
const EDIT_SESSION_KEY = 'ajedrez-triangular:edicion';
// "Diseñar tablero" desde cero (btn-design, sin partida ni posición de por medio):
// script.js deja aquí la modalidad activa justo antes de saltar a editor.html, para
// que el editor arranque en ELLA en vez de caer a DEFAULT_VARIANT. Solo el id; se
// sobrescribe en cada clic, no hace falta borrarlo después.
const EDITOR_LAST_VARIANT_KEY = 'ajedrez-triangular:editor-ultima-modalidad';
// v2: el sobre guarda con qué MODALIDAD se jugó la partida. Las de v1 ya no se
// cargan: no dicen su modalidad, y aunque todas fueran del ajedrez de Salas,
// desde la versión 2 ese reglamento incluye la coronación de flanco, así que
// tampoco se reproducirían con las reglas con las que se jugaron.
// v3: el historial puede llevar snapshots `edited: true` (edición del
// tablero a mitad de partida, ver applyEdit en rules.js), que no llevan
// `lastMove`. Los ficheros v2 siguen cargando: por definición no tienen
// ediciones, así que la validación de v3 los acepta sin más.
const SAVE_VERSION = 3;

// El análisis de una jugada puede tener 80 entradas, y una partida entera
// 200 jugadas: guardarlo entero multiplicaría por varias veces el tamaño del
// fichero (y localStorage no da para tanto). Se conservan solo las mejores
// más la elegida, que es lo que el panel enseña sin desplegar «ver todas».
const SAVED_ANALYSIS_ROWS = 12;

function trimAnalysis(list) {
  if (!Array.isArray(list) || list.length <= SAVED_ANALYSIS_ROWS) return list;
  const top = list.slice(0, SAVED_ANALYSIS_ROWS);
  const chosen = list.find(e => e.chosen);
  if (chosen && !top.includes(chosen)) top.push(chosen);
  return top;
}

function serializeGame(mode, levelW, levelB) {
  return {
    version: SAVE_VERSION,
    app: 'ajedrez-triangular',
    savedAt: new Date().toISOString(),
    variant: game.variant,
    mode,
    levelW,
    levelB,
    // `analysisTotal` recuerda cuántas jugadas legales había de verdad, para
    // que el panel no anuncie 13 cuando eran 74
    history: game.history.map(s => Array.isArray(s.analysis)
      ? { ...s, analysis: trimAnalysis(s.analysis), analysisTotal: s.analysis.length }
      : s),
    histIndex: game.histIndex,
  };
}

// Se valida contra la modalidad DEL SOBRE, no contra la que esté activa: si no,
// cargar una partida de Trigonal con el hexágono puesto la rechazaría por
// casillas inexistentes. Y sin cambiar de modalidad por el camino, que un
// validador no debe tener efectos secundarios: basta consultar la forma del
// tablero y el juego de piezas que declara esa modalidad.
function validateSave(data) {
  if (!data || (data.version !== SAVE_VERSION && data.version !== 2)) return false;
  if (!Array.isArray(data.history) || data.history.length === 0) return false;
  if (!Number.isInteger(data.histIndex) ||
      data.histIndex < 0 || data.histIndex >= data.history.length) return false;
  if (!['hh', 'hc', 'ch', 'cc'].includes(data.mode)) return false;
  const modalidad = VARIANTS[data.variant];
  if (!modalidad) return false;
  const forma = BOARDS[modalidad.board];
  const piezas = new Set(Object.keys(
    modalidad.pieces || VARIANTS[modalidad.inherits].pieces));
  const enTablero = (key) => {
    const co = String(key).split(',').map(Number);
    if (co.length !== 3 || co.some(n => !Number.isInteger(n))) return false;
    const suma = co[0] + co[1] + co[2];
    return (suma === 1 || suma === 2) && forma.has(co[0], co[1], co[2]);
  };
  // Se valida CADA snapshot, no solo el primero y el actual: los datos entran
  // directos al motor (applySave no clona) y la interfaz los desestructura
  // sin red (renderScoresheet lee lastMove.from de todas las filas). Un .json
  // importado con un snapshot a medias no debe pasar de aquí.
  return data.history.every((s, i) => {
    if (!s || (s.turn !== 'w' && s.turn !== 'b')) return false;
    if (!Array.isArray(s.board) || s.board.length === 0) return false;
    let reyes = 0;
    for (const ent of s.board) {
      if (!Array.isArray(ent) || ent.length !== 2) return false;
      const [key, p] = ent;
      if (!enTablero(key)) return false;
      if (!p || !piezas.has(p.type) ||
          (p.color !== 'w' && p.color !== 'b')) return false;
      if (p.type === 'K') reyes++;
    }
    // el mate no captura al rey: siempre 2 (salvo en las modalidades sin rey,
    // donde no hay ninguno que contar: ahí `piezas` ya rechaza el tipo 'K')
    if (piezas.has('K') && reyes !== 2) return false;
    // toda jugada del historial (i >= 1) lleva su lastMove, salvo los
    // snapshots de una edición del tablero, que no son una jugada y no
    // llevan ninguna
    if (i > 0) {
      if (s.edited) {
        if (s.lastMove !== null) return false;
      } else if (!s.lastMove || typeof s.lastMove.from !== 'string' ||
          typeof s.lastMove.to !== 'string') return false;
    }
    return true;
  });
}

// Ojo: la modalidad del sobre debe estar ya puesta antes de llamar aquí (lo
// hace loadEnvelope en script.js). newGame() reparte la posición inicial de la
// modalidad activa, y luego se pisa con el historial guardado.
function applySave(data) {
  newGame();   // garantiza la estructura base de `game`
  game.history = data.history;
  game.histIndex = data.histIndex;
  restore(game.history[game.histIndex]);
}

// --- partidas con nombre en localStorage ---

function listSaves() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key.startsWith(SAVE_PREFIX)) continue;
    try {
      const data = JSON.parse(localStorage.getItem(key));
      out.push({
        name: key.slice(SAVE_PREFIX.length),
        savedAt: data.savedAt,
        favorite: !!data.favorite,
      });
    } catch {
      // entrada corrupta: se omite
    }
  }
  out.sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return (b.savedAt || '').localeCompare(a.savedAt || '');
  });
  return out;
}

function saveToStorage(name, envelope) {
  try {
    if (envelope.favorite === undefined) {
      envelope.favorite = isFavorite(name);   // conserva el estado al sobrescribir
    }
    localStorage.setItem(SAVE_PREFIX + name, JSON.stringify(envelope));
    return true;
  } catch {
    return false;   // cuota de almacenamiento superada
  }
}

function loadFromStorage(name) {
  const raw = localStorage.getItem(SAVE_PREFIX + name);
  if (raw === null) return null;
  try {
    const data = JSON.parse(raw);
    return validateSave(data) ? data : null;
  } catch {
    return null;
  }
}

function deleteFromStorage(name) {
  localStorage.removeItem(SAVE_PREFIX + name);
}

function isFavorite(name) {
  const raw = localStorage.getItem(SAVE_PREFIX + name);
  if (raw === null) return false;
  try {
    return !!JSON.parse(raw).favorite;
  } catch {
    return false;
  }
}

function toggleFavorite(name) {
  const raw = localStorage.getItem(SAVE_PREFIX + name);
  if (raw === null) return false;
  try {
    const data = JSON.parse(raw);
    data.favorite = !data.favorite;
    localStorage.setItem(SAVE_PREFIX + name, JSON.stringify(data));
    return data.favorite;
  } catch {
    return false;
  }
}

// --- posiciones diseñadas con nombre en localStorage ---
//
// Lo que guarda el editor no es una partida: no hay historial, ni modo, ni
// niveles, solo un tablero y a quién le toca. Por eso lleva su propio sobre y
// su propio prefijo, y así `listSaves` sigue enseñando únicamente partidas.
// Ojo con el prefijo: acaba en dos puntos para no solaparse con
// DESIGN_POSITION_KEY, que empieza igual ('...:posicion-disenada').

const POSITION_PREFIX = 'ajedrez-triangular:posicion:';
const POSITION_VERSION = 1;

function serializePosition(board, turn) {
  return {
    app: 'ajedrez-triangular',
    kind: 'posicion',
    version: POSITION_VERSION,
    savedAt: new Date().toISOString(),
    variant: V.id,
    turn,
    board: [...board],
  };
}

// Igual que validateSave, se valida contra la modalidad DEL SOBRE, no contra
// la activa, y sin cambiar de modalidad por el camino. A diferencia de una
// partida, una posición puede no tener reyes: el editor deja diseñar finales
// de peones y solo exige los dos reyes al pulsar «Jugar esta posición».
function validatePosition(data) {
  if (!data || data.version !== POSITION_VERSION || data.kind !== 'posicion') return false;
  if (!data.variant || !data.turn || !Array.isArray(data.board)) return false;
  if (data.turn !== 'w' && data.turn !== 'b') return false;
  const modalidad = VARIANTS[data.variant];
  if (!modalidad) return false;
  const forma = BOARDS[modalidad.board];
  const piezas = new Set(Object.keys(
    modalidad.pieces || VARIANTS[modalidad.inherits].pieces));
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

function listPositions() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key.startsWith(POSITION_PREFIX)) continue;
    try {
      const data = JSON.parse(localStorage.getItem(key));
      out.push({
        name: key.slice(POSITION_PREFIX.length),
        savedAt: data.savedAt,
        variant: data.variant,
      });
    } catch {
      // entrada corrupta: se omite
    }
  }
  out.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
  return out;
}

function positionExists(name) {
  return localStorage.getItem(POSITION_PREFIX + name) !== null;
}

function savePositionToStorage(name, envelope) {
  try {
    localStorage.setItem(POSITION_PREFIX + name, JSON.stringify(envelope));
    return true;
  } catch {
    return false;   // cuota de almacenamiento superada
  }
}

function loadPositionFromStorage(name) {
  const raw = localStorage.getItem(POSITION_PREFIX + name);
  if (raw === null) return null;
  try {
    const data = JSON.parse(raw);
    return validatePosition(data) ? data : null;
  } catch {
    return null;
  }
}

function deletePositionFromStorage(name) {
  localStorage.removeItem(POSITION_PREFIX + name);
}

// --- exportar e importar archivos .json ---

function downloadSave(envelope, filename) {
  const blob = new Blob([JSON.stringify(envelope, null, 2)],
    { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function readSaveFile(file, onOk, onError, validate = validateSave) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!validate(data)) { onError(); return; }
      onOk(data);
    } catch {
      onError();
    }
  };
  reader.onerror = () => onError();
  reader.readAsText(file);
}
