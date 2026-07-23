// saveload.js — Guardar y cargar partidas (localStorage y archivos .json).
//
// Formato de guardado: un "sobre" versionado con el historial completo de la
// partida (los snapshots de rules.js ya son serializables a JSON) más la
// configuración de modalidad y niveles del ordenador.

const SAVE_PREFIX = 'ajedrez-triangular:save:';
const SAVE_VERSION = 1;

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

function validateSave(data) {
  if (!data || data.version !== SAVE_VERSION) return false;
  if (!Array.isArray(data.history) || data.history.length === 0) return false;
  if (!Number.isInteger(data.histIndex) ||
      data.histIndex < 0 || data.histIndex >= data.history.length) return false;
  if (!['hh', 'hc', 'ch', 'cc'].includes(data.mode)) return false;
  const okSnap = s => s && Array.isArray(s.board) && typeof s.turn === 'string';
  return okSnap(data.history[0]) && okSnap(data.history[data.histIndex]);
}

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

function readSaveFile(file, onOk, onError) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!validateSave(data)) { onError(); return; }
      onOk(data);
    } catch {
      onError();
    }
  };
  reader.onerror = () => onError();
  reader.readAsText(file);
}
