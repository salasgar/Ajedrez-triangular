// problema-imagen.js — Exportar un problema como archivo de imagen: el
// diagrama del tablero y, debajo, el enunciado («Las blancas juegan y dan mate
// en 3 jugadas»).
//
// El diagrama NO se saca del SVG que hay en la página. Serializar ese SVG
// obligaría a arrastrar con él media hoja de estilos —los colores de casilla,
// el grosor del trazo, el tamaño de cada pieza— y aun así saldría con las
// marcas de la partida en curso (casilla seleccionada, último movimiento,
// jaque). Aquí se vuelve a dibujar desde cero sobre un <canvas>, leyendo la
// misma geometría que usa el tablero de verdad (CELLS y BBOX de geometry.js) y
// repitiendo a mano los pocos valores de estilo que hacen falta. A cambio la
// imagen es reproducible, sale siempre limpia y no depende de que el tablero
// esté montado: basta con el objeto del problema.
//
// Depende de geometry.js (CELLS, CELL_MAP, BBOX, setGeometry), de variants.js
// (GLYPH, V, VARIANTS, setVariant) y de nada más. En particular NO depende de
// problemas-ui.js: si esos textos están cargados los aprovecha, y si no los
// genera por su cuenta, de modo que el mismo archivo sirve en el juego y en el
// editor de posiciones.

// Ancho del PNG en píxeles. 1000 da un diagrama que se lee bien en pantalla y
// aguanta imprimirse a media página sin que se vean los dientes de sierra.
const PROB_IMG_ANCHO = 1000;

// Márgenes y huecos, en píxeles de la imagen final.
const PROB_IMG_MARGEN = 44;
const PROB_IMG_HUECO = 30;      // entre el tablero y la raya del enunciado
const PROB_IMG_INTERLINEA = 1.35;

// Tipografías. La del enunciado es la del sistema; la de las piezas lleva
// delante las familias que sí traen los símbolos de ajedrez (U+2654…265F),
// porque en la letra de interfaz de algunos sistemas ese bloque no existe y el
// navegador dibujaría el rectángulo del carácter que falta.
const PROB_IMG_FUENTE = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ' +
  '"Helvetica Neue", Arial, sans-serif';
const PROB_IMG_FUENTE_PIEZA = '"Apple Symbols", "Segoe UI Symbol", ' +
  '"Noto Sans Symbols 2", "DejaVu Sans", serif';
const PROB_IMG_FUENTE_COORD = 'ui-monospace, SFMono-Regular, Menlo, monospace';

// Los mismos colores que el tablero de la página (ver style.css). Se repiten
// aquí en vez de leerlos del CSS porque la imagen tiene que salir igual
// aunque se exporte desde una página que no cargue esa hoja.
const PROB_IMG_COLOR = {
  fondo: '#ffffff',
  clara: '#f0d9b5',
  oscura: '#b58863',
  borde: '#2b2b2b',
  coord: 'rgba(0, 0, 0, 0.45)',
  blancaRelleno: '#fdfdfd',
  blancaTrazo: '#333333',
  negraRelleno: '#1c1c1c',
  negraTrazo: '#dddddd',
  raya: '#d8d8d8',
  enunciado: '#141414',
  letraPequena: '#5a5a5a',
  pie: '#9a9a9a',
};

// El elefante y el unicornio no son un carácter, son un icono: en la página
// viven como <symbol> dentro del SVG oculto de la cabecera. Para el canvas hace
// falta el atributo `d` en crudo, que se lee de ahí cuando la página lo tiene;
// la copia de abajo es el respaldo para cuando no (exportar desde una página
// sin esos símbolos, o desde una prueba sin DOM completo).
const PROB_IMG_ICONO_ID = { E: 'piece-elephant', U: 'piece-unicorn' };
const PROB_IMG_ICONO_D = {
  E: 'M14.03 3.08L12.75 3.2L10.9 3.89L9.05 4.24L8 5.05L5.34 4.93L4.06 5.86L2.5 7.66L2.5 19.01L4.76 20.8L5.45 20.69L6.21 20.05L6.79 19.47L6.79 18.78L6.27 18.26L5.92 18.26L5.22 18.95L4.59 18.55L4.59 14.61L8.23 11.65L8.58 13.04L10.09 13.16L10.55 12.93L14.2 9.74L14.2 3.25ZM8.41 20.63L8.7 20.92L11.59 20.92L11.88 20.52L12.23 17.85L12.75 16.98L16.81 16.87L17.79 18.31L17.97 20.46L19.24 20.92L21.21 20.92L21.5 20.63L21.38 9.86L16.69 5.51L14.95 5.4L14.66 5.69L14.66 9.62L10.67 13.27L10.32 13.51L8.7 13.51L8.41 13.8ZM4.62 8.62Q5.55 8.84 5.98 7.98Q5.05 7.76 4.62 8.62Z',
  U: 'M17.4 2.1L15.1 6.4L12.9 5.9L10.2 6.5L7.6 8.3L6.1 10.8L3.1 12.6L2.6 13.7L4.4 13.4L3.5 15.1L5.6 14.2L5.1 16.2L6.9 14.6L7.4 16.6L8.6 14.9L10.1 16.1L10.6 21.6L12.4 21.6L12.1 16.9L13.9 18.1L14.4 21.6L16.2 21.6L15.7 17.4L17.9 15.2L19.4 11.6L19.1 8.4L17.2 6.6ZM15.6 8.9Q16.4 8.9 16.4 9.7Q16.4 10.5 15.6 10.5Q14.8 10.5 14.8 9.7Q14.8 8.9 15.6 8.9Z',
};

// Tamaño del icono y de los glifos dentro del viewBox del tablero, calcados de
// style.css: .piece {font-size: 24px}, .piece-P {19.2px}, y el <use> de
// script.js, que pone el icono a 22 unidades de lado.
const PROB_IMG_GLIFO = 24;
const PROB_IMG_GLIFO_PEON = 19.2;
const PROB_IMG_ICONO_LADO = 22;
const PROB_IMG_TRAZO_PIEZA = 0.9;
const PROB_IMG_TRAZO_ELEFANTE = 0.8;   // .piece-E lo afina un poco

// --- textos ----------------------------------------------------------------
//
// Cuando problemas-ui.js está cargado (el juego), el enunciado sale de allí:
// una sola redacción para la pantalla y para la imagen. En el editor de
// posiciones ese archivo no está, así que hay una copia de respaldo. Los
// nombres llevan el prefijo `probImg` justo para poder convivir con los de
// problemas-ui.js sin chocar: los dos son globales del mismo ámbito.

const PROB_IMG_PIEZA = {
  Q: 'dama', R: 'torre', B: 'alfil', N: 'caballo',
  E: 'elefante', U: 'unicornio', P: 'peón', K: 'rey',
};

function probImgArticulo(t) { return (t === 'Q' || t === 'R') ? 'una' : 'un'; }

function probImgEnunciado(p) {
  if (typeof probEnunciadoTexto === 'function') return probEnunciadoTexto(p);
  const bando = p.turn === 'w' ? 'Las blancas' : 'Las negras';
  const n = p.obj.jugadas;
  const jug = n === 1 ? '1 jugada' : n + ' jugadas';
  switch (p.obj.tipo) {
    case 'mate':   return `${bando} juegan y dan mate en ${jug}.`;
    case 'gana':   return `${bando} juegan y capturan ${probImgArticulo(p.obj.pieza)} ` +
                          `${PROB_IMG_PIEZA[p.obj.pieza]} en ${jug}.`;
    case 'corona': return `${bando} juegan y coronan un peón en ${jug}.`;
    case 'tablas': return `${bando} juegan y consiguen tablas en ${jug}.`;
    default:       return '';
  }
}

function probImgSubtexto(p) {
  if (typeof probSubtexto === 'function') return probSubtexto(p);
  switch (p.obj.tipo) {
    case 'gana':
      return 'Hay que ganarlo de verdad: no vale capturarlo y perder ' +
        'después más material del que se captura.';
    case 'corona':
      return 'La pieza coronada tiene que quedar en pie: no vale coronar ' +
        'para que la capturen a continuación.';
    case 'tablas':
      return 'Vale el ahogado, el jaque perpetuo y quedarse los dos reyes ' +
        'solos. El rival va ganando: cualquier otra cosa se pierde.';
    default:
      return 'Cualquier defensa del rival tiene que acabar en mate: ' +
        'no basta con que caiga en una trampa.';
  }
}

function probImgModalidad(id) {
  const v = (typeof VARIANTS !== 'undefined' && VARIANTS[id]) || null;
  return v ? v.name : id;
}

// --- utilidades ------------------------------------------------------------

// Un problema puede llegar con el tablero como Map (recién montado) o como
// lista de pares (recién salido de un .json o del almacén).
function probImgTablero(p) {
  if (p.board instanceof Map) return p.board;
  return new Map((p.board || []).map(([k, pieza]) => [k, pieza]));
}

// Dibuja con la geometría de la modalidad del problema y deja luego la que
// había. Un problema guardado puede ser de otra modalidad que la que está
// puesta —el usuario exporta desde la lista, sin abrirlo—, y CELLS/BBOX son
// globales: pintar sin restaurarlas dejaría la página con el tablero de otro.
//
// Se pasa por setVariant() y no por setGeometry(), aunque para dibujar bastaría
// con la retícula: setVariant deja además coherentes las tablas que cuelgan de
// cada casilla, y así ningún otro módulo se encuentra un CELLS a medias.
function probImgConModalidad(id, fn) {
  const previa = (typeof V !== 'undefined' && V) ? V.id : null;
  const cambia = id && id !== previa && typeof VARIANTS !== 'undefined' && VARIANTS[id];
  if (cambia) setVariant(id);
  try {
    return fn();
  } finally {
    if (cambia && previa) setVariant(previa);
  }
}

// Parte un texto en líneas que quepan en `ancho`, con la fuente que el
// contexto tenga puesta en ese momento.
function probImgLineas(ctx, texto, ancho) {
  const palabras = String(texto).split(/\s+/).filter(Boolean);
  const out = [];
  let linea = '';
  for (const palabra of palabras) {
    const prueba = linea ? linea + ' ' + palabra : palabra;
    if (linea && ctx.measureText(prueba).width > ancho) {
      out.push(linea);
      linea = palabra;
    } else {
      linea = prueba;
    }
  }
  if (linea) out.push(linea);
  return out;
}

function probImgIconoD(tipo) {
  const id = PROB_IMG_ICONO_ID[tipo];
  if (!id) return null;
  if (typeof document !== 'undefined') {
    const nodo = document.querySelector('#' + id + ' path');
    const d = nodo && nodo.getAttribute('d');
    if (d) return d;
  }
  return PROB_IMG_ICONO_D[tipo] || null;
}

// --- dibujo del tablero ----------------------------------------------------
//
// Todo lo de aquí abajo dibuja en unidades del viewBox del tablero (las mismas
// que el SVG de la página): el llamante ya ha dejado el contexto escalado y
// trasladado, así que un grosor de 1 sale con el mismo aspecto relativo que
// `stroke-width: 1` en el CSS, y un `font-size` de 24 con el de `.piece`.

function probImgCasillas(ctx, coords, board) {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = PROB_IMG_COLOR.borde;
  ctx.lineWidth = 1;
  for (const cell of CELLS) {
    ctx.beginPath();
    ctx.moveTo(cell.pts[0][0], cell.pts[0][1]);
    ctx.lineTo(cell.pts[1][0], cell.pts[1][1]);
    ctx.lineTo(cell.pts[2][0], cell.pts[2][1]);
    ctx.closePath();
    ctx.fillStyle = cell.up ? PROB_IMG_COLOR.clara : PROB_IMG_COLOR.oscura;
    ctx.fill();
    ctx.stroke();
  }
  if (!coords) return;
  // Mismo sitio que en el SVG del tablero: el nombre va bajo el centro en los
  // triángulos que apuntan hacia arriba y sobre él en los que apuntan hacia
  // abajo, que es donde cada uno tiene sitio.
  //
  // Las casillas ocupadas se saltan. En la pantalla el nombre asomando por
  // detrás de la pieza no molesta —ahí está para señalar con el ratón—, pero en
  // un diagrama que se va a mirar impreso ensucia justo lo que hay que leer, y
  // la casilla de una pieza se lee igual de bien por sus vecinas.
  ctx.fillStyle = PROB_IMG_COLOR.coord;
  ctx.font = `9px ${PROB_IMG_FUENTE_COORD}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (const cell of CELLS) {
    if (board.has(cell.key)) continue;
    ctx.fillText(cellName(cell), cell.cx, cell.cy + (cell.up ? 9 : -4));
  }
}

function probImgPieza(ctx, tipo, color, cx, cy) {
  const blanca = color === 'w';
  ctx.fillStyle = blanca ? PROB_IMG_COLOR.blancaRelleno : PROB_IMG_COLOR.negraRelleno;
  ctx.strokeStyle = blanca ? PROB_IMG_COLOR.blancaTrazo : PROB_IMG_COLOR.negraTrazo;
  ctx.lineJoin = 'round';

  const d = probImgIconoD(tipo);
  if (d) {
    // El icono viene en un viewBox de 24×24 y se dibuja a 22 unidades de lado,
    // centrado en la casilla: igual que el <use> del tablero.
    const lado = PROB_IMG_ICONO_LADO;
    ctx.save();
    ctx.translate(cx - lado / 2, cy - lado / 2);
    ctx.scale(lado / 24, lado / 24);
    ctx.lineWidth = PROB_IMG_TRAZO_ELEFANTE * (24 / lado);
    const path = new Path2D(d);
    // `paint-order: stroke` del CSS: el trazo va debajo, para que engorde la
    // silueta hacia fuera y no se coma el dibujo.
    ctx.stroke(path);
    ctx.fill(path, 'evenodd');
    ctx.restore();
    return;
  }

  const tam = tipo === 'P' ? PROB_IMG_GLIFO_PEON : PROB_IMG_GLIFO;
  ctx.font = `${tam}px ${PROB_IMG_FUENTE_PIEZA}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = PROB_IMG_TRAZO_PIEZA;
  const glifo = (typeof GLYPH !== 'undefined' && GLYPH[tipo]) || tipo;
  ctx.strokeText(glifo, cx, cy);
  ctx.fillText(glifo, cx, cy);
}

function probImgPiezas(ctx, board) {
  for (const [key, pieza] of board) {
    const cell = CELL_MAP.get(key);
    if (!cell) continue;          // casilla que no existe en este tablero
    probImgPieza(ctx, pieza.type, pieza.color, cell.cx, cell.cy);
  }
}

// --- la imagen entera ------------------------------------------------------

// Devuelve un <canvas> con el diagrama y el enunciado. `opts`:
//   ancho        px del PNG (por defecto PROB_IMG_ANCHO)
//   coordenadas  ¿se escriben los nombres de casilla? (por defecto sí)
//   titulo       línea en negrita sobre el tablero (el nombre del problema)
//   detalle      ¿se añade la letra pequeña del objetivo? (por defecto sí)
//   pie          ¿se añade la línea de modalidad al final? (por defecto sí)
function probImagenCanvas(p, opts = {}) {
  const ancho = opts.ancho || PROB_IMG_ANCHO;
  const coords = opts.coordenadas !== false;
  const conDetalle = opts.detalle !== false;
  const conPie = opts.pie !== false;

  return probImgConModalidad(p.variant, () => {
    const board = probImgTablero(p);
    const util = ancho - 2 * PROB_IMG_MARGEN;
    const escala = util / BBOX.w;
    const altoTablero = BBOX.h * escala;

    // Primera pasada: medir. Cuánto ocupa el texto no se sabe hasta haberlo
    // partido en líneas, y para partirlo hace falta un contexto con la fuente
    // puesta; el canvas de verdad no se puede crear antes de saber su alto, así
    // que se mide sobre uno de usar y tirar.
    const regla = document.createElement('canvas').getContext('2d');
    const tipos = [];
    const anota = (texto, tam, peso, color, hueco) => {
      if (!texto) return;
      regla.font = `${peso} ${tam}px ${PROB_IMG_FUENTE}`;
      tipos.push({
        lineas: probImgLineas(regla, texto, util),
        tam, peso, color, hueco,
        alto: tam * PROB_IMG_INTERLINEA,
      });
    };

    anota(opts.titulo, 22, '600', PROB_IMG_COLOR.enunciado, 0);
    const titulo = tipos.length ? tipos.pop() : null;
    const arribaTablero = PROB_IMG_MARGEN +
      (titulo ? titulo.lineas.length * titulo.alto + 18 : 0);

    anota(probImgEnunciado(p), 30, '700', PROB_IMG_COLOR.enunciado, 0);
    if (conDetalle) anota(probImgSubtexto(p), 17, '400', PROB_IMG_COLOR.letraPequena, 14);
    if (conPie) {
      anota('Ajedrez triangular · ' + probImgModalidad(p.variant),
        15, '400', PROB_IMG_COLOR.pie, 20);
    }

    const arribaTexto = arribaTablero + altoTablero + PROB_IMG_HUECO;
    let alto = arribaTexto;
    for (const t of tipos) alto += t.hueco + t.lineas.length * t.alto;
    alto += PROB_IMG_MARGEN;

    // Segunda pasada: pintar.
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(ancho);
    canvas.height = Math.round(alto);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = PROB_IMG_COLOR.fondo;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (titulo) {
      ctx.font = `${titulo.peso} ${titulo.tam}px ${PROB_IMG_FUENTE}`;
      ctx.fillStyle = titulo.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      let y = PROB_IMG_MARGEN + titulo.tam;
      for (const linea of titulo.lineas) { ctx.fillText(linea, ancho / 2, y); y += titulo.alto; }
    }

    ctx.save();
    ctx.translate(PROB_IMG_MARGEN, arribaTablero);
    ctx.scale(escala, escala);
    ctx.translate(-BBOX.x, -BBOX.y);
    probImgCasillas(ctx, coords, board);
    probImgPiezas(ctx, board);
    ctx.restore();

    // Raya fina entre el diagrama y el enunciado: separa el problema de lo que
    // se pide sin meter un recuadro.
    ctx.strokeStyle = PROB_IMG_COLOR.raya;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const yRaya = Math.round(arribaTablero + altoTablero + PROB_IMG_HUECO / 2) + 0.5;
    ctx.moveTo(PROB_IMG_MARGEN, yRaya);
    ctx.lineTo(ancho - PROB_IMG_MARGEN, yRaya);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    let y = arribaTexto;
    for (const t of tipos) {
      ctx.font = `${t.peso} ${t.tam}px ${PROB_IMG_FUENTE}`;
      ctx.fillStyle = t.color;
      y += t.hueco;
      for (const linea of t.lineas) {
        y += t.tam;                 // de la línea base al hombro de la letra
        ctx.fillText(linea, ancho / 2, y);
        y += t.alto - t.tam;        // y el resto de la interlínea
      }
    }

    return canvas;
  });
}

// Nombre de archivo a partir del enunciado: «Las blancas juegan y dan mate en 2
// jugadas.» → problema-las-blancas-juegan-y-dan-mate-en-2-jugadas.png
function probImagenNombre(p, titulo) {
  const base = (titulo || probImgEnunciado(p) || 'problema')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // fuera las tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return `problema-${base || 'ajedrez-triangular'}.png`;
}

// Descarga el problema como PNG. Devuelve una promesa que se resuelve cuando el
// navegador ya tiene el archivo (o se rechaza si el canvas no da un blob).
function probImagenDescarga(p, opts = {}) {
  const canvas = probImagenCanvas(p, opts);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('no se pudo generar la imagen')); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = opts.archivo || probImagenNombre(p, opts.titulo);
      document.body.appendChild(a);
      a.click();
      a.remove();
      // El objeto URL se libera al ciclo siguiente: revocarlo en el mismo deja
      // descargas a medias en algunos navegadores.
      setTimeout(() => URL.revokeObjectURL(url), 0);
      resolve(blob);
    }, 'image/png');
  });
}

// --- botón en la pestaña «Problemas» ---------------------------------------
//
// El botón se cuelga desde aquí en vez de venir escrito en index.html para que
// este archivo sea autosuficiente: se añade su <script> y la exportación
// aparece, sin tocar ni el HTML ni problemas-ui.js. Si la pestaña no está en la
// página (el editor de posiciones, por ejemplo), no hace nada.
function probImagenMontaBoton() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('prob-imagen')) return;
  const exportar = document.getElementById('prob-exportar');
  if (!exportar || !exportar.parentNode) return;

  const btn = document.createElement('button');
  btn.id = 'prob-imagen';
  btn.textContent = 'Imagen (.png)';
  btn.title = 'Descargar el problema como imagen, con el enunciado debajo';
  btn.addEventListener('click', () => {
    // `probActual` es de problemas-ui.js: el problema montado ahora mismo.
    const p = typeof probActual !== 'undefined' ? probActual : null;
    if (!p) return;
    probImagenDescarga(p).catch(() => {
      if (typeof probPinta === 'function') {
        probMensaje = 'No se pudo generar la imagen.';
        probMensajeTono = 'mal';
        probPinta();
      }
    });
  });
  exportar.parentNode.insertBefore(btn, exportar.nextSibling);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', probImagenMontaBoton);
  } else {
    probImagenMontaBoton();
  }
}
