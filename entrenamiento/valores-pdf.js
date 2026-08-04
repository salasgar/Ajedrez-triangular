// valores-pdf.js — La tabla de valores de las piezas de cada modalidad, en PDF.
//
//   node valores-pdf.js            escribe docs/valores-piezas.pdf
//   node valores-pdf.js --check    no escribe: sale con 1 si el PDF esta viejo
//
// POR QUE SE GENERA Y NO SE ESCRIBE A MANO. Los valores viven en el bloque
// `engine` de cada modalidad en variants.js, y cambian: el entrenamiento los
// mide (ver la ronda 15 en el README) y a veces se retocan a mano. Una tabla
// copiada a mano estaria mal al segundo cambio y nadie se enteraria, porque
// nada la compara con el motor. Esta se lee del propio variants.js cada vez.
//
// El gancho de pre-commit (.git/hooks/pre-commit) la regenera cuando el commit
// toca variants.js, asi que el PDF no puede quedarse atras sin que salte.
//
// SIN DEPENDENCIAS, como todo lo demas del repo: el PDF se escribe a mano. Son
// cuatro objetos, una fuente de las catorce que todo lector trae puestas y un
// flujo de contenido con texto y rectangulos. No hace falta mas para una tabla,
// y asi esto sigue funcionando dentro de diez años sin instalar nada.
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = process.env.MOTOR || path.join(__dirname, '..');
const SALIDA = path.join(REPO, 'docs', 'valores-piezas.pdf');
const CHECK = process.argv.includes('--check');

// De donde salen los valores de cada modalidad: es lo unico que este guion no
// puede deducir del codigo. Si una modalidad no esta aqui, se dice.
const ORIGEN = JSON.parse(fs.readFileSync(path.join(__dirname, 'valores-origen.json'), 'utf8'));

// --- leer las modalidades del motor -----------------------------------------
const gameSrc = ['geometry.js', 'variants.js', 'rules.js', 'ai.js']
  .map(f => fs.readFileSync(path.join(REPO, f), 'utf8')).join('\n');

let MODALIDADES;
eval(gameSrc + `
MODALIDADES = Object.keys(VARIANTS).map(id => {
  setVariant(id);
  return {
    id,
    nombre: V.name,
    completo: V.full,
    tablero: BOARD_ID + ' (' + CELLS.length + ' casillas)',
    piezas: V.pieceTypes.slice(),
    valores: { ...V.engine.pieceValues },
    movilidad: V.engine.mobility,
  };
});
`);

// Orden de las columnas: el peon primero y la dama al final, que es como se
// leen; en medio, de menos a mas valor en la modalidad de casa.
const COLUMNAS = ['P', 'N', 'B', 'E', 'U', 'R', 'Q'];
const NOMBRE_PIEZA = {
  P: 'peón', N: 'caballo', B: 'alfil', E: 'elefante',
  U: 'unicornio', R: 'torre', Q: 'dama', K: 'rey',
};

// --- escritura del PDF -------------------------------------------------------
// Un PDF es una lista de objetos numerados, una tabla de posiciones (xref) que
// dice en que byte empieza cada uno, y un remolque que apunta a la tabla. Por
// eso hay que ir contando bytes segun se escribe.
const ANCHO = 595, ALTO = 842;          // A4 en puntos
const MARGEN = 40;

class Pdf {
  constructor() {
    this.ops = [];
  }
  // El texto va en latin1 (WinAnsiEncoding), que cubre los acentos y la eñe
  // pero NO los guiones largos ni las comillas tipográficas: Buffer los
  // trunca a un carácter de control y desaparecen de la página sin avisar.
  // Aquí se sustituyen por su equivalente de toda la vida antes de escapar.
  static esc(s) {
    return s.replace(/[‐-―]/g, '-').replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"').replace(/…/g, '...')
      .replace(/[\\()]/g, c => '\\' + c);
  }
  texto(x, y, s, { fuente = 'F1', tam = 10, gris = 0 } = {}) {
    this.ops.push(`BT ${gris} g /${fuente} ${tam} Tf 1 0 0 1 ${x} ${y} Tm (${Pdf.esc(s)}) Tj ET`);
    return this;
  }
  // Texto centrado en una columna. El ancho se estima con la anchura media de
  // Helvetica (0,5 em para digitos y mayusculas), que para numeros de tres
  // cifras centra de sobra; no hace falta cargar las metricas de la fuente.
  centrado(x, ancho, y, s, opts = {}) {
    const tam = opts.tam || 10;
    return this.texto(x + (ancho - s.length * tam * 0.52) / 2, y, s, opts);
  }
  rect(x, y, w, h, gris) {
    this.ops.push(`${gris} g ${x} ${y} ${w} ${h} re f`);
    return this;
  }
  linea(x1, y1, x2, y2, { grosor = 0.5, gris = 0.6 } = {}) {
    this.ops.push(`${gris} G ${grosor} w ${x1} ${y1} m ${x2} ${y2} l S`);
    return this;
  }
  buffer() {
    const contenido = Buffer.from(this.ops.join('\n'), 'latin1');
    const objetos = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}]` +
        ' /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${contenido.length} >>\nstream\n${contenido.toString('latin1')}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    ];
    let salida = '%PDF-1.4\n';
    const posiciones = [];
    objetos.forEach((o, i) => {
      posiciones.push(Buffer.byteLength(salida, 'latin1'));
      salida += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = Buffer.byteLength(salida, 'latin1');
    salida += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
    for (const p of posiciones) salida += String(p).padStart(10, '0') + ' 00000 n \n';
    salida += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\n` +
      `startxref\n${xref}\n%%EOF\n`;
    return Buffer.from(salida, 'latin1');
  }
}

// --- la pagina ---------------------------------------------------------------
const p = new Pdf();
let y = ALTO - MARGEN - 20;

p.texto(MARGEN, y, 'Valores de las piezas por modalidad', { fuente: 'F2', tam: 18 });
y -= 18;
const hoy = new Date().toISOString().slice(0, 10);
p.texto(MARGEN, y, `Ajedrez triangular · generado el ${hoy} a partir de variants.js`,
  { tam: 9, gris: 0.45 });
y -= 26;

p.texto(MARGEN, y, 'En centipeones: el peón vale 100 por definición y todo lo demás se mide',
  { tam: 10 });
y -= 13;
p.texto(MARGEN, y, 'contra él. Son los números con los que la IA decide si una jugada le conviene.',
  { tam: 10 });
y -= 26;

// Anchuras: la primera columna se lleva lo que necesita el nombre mas largo y
// el resto se reparte a partes iguales.
const ANCHO_UTIL = ANCHO - 2 * MARGEN;
const COL_NOMBRE = 132;
const COL_MOV = 58;
const COL_PIEZA = (ANCHO_UTIL - COL_NOMBRE - COL_MOV) / COLUMNAS.length;
const ALTO_FILA = 22;

function xDe(i) { return MARGEN + COL_NOMBRE + i * COL_PIEZA; }

// cabecera
p.rect(MARGEN, y - 6, ANCHO_UTIL, ALTO_FILA, 0.92);
p.texto(MARGEN + 4, y, 'Modalidad', { fuente: 'F2', tam: 10 });
COLUMNAS.forEach((c, i) => p.centrado(xDe(i), COL_PIEZA, y, c, { fuente: 'F2', tam: 10 }));
p.centrado(MARGEN + ANCHO_UTIL - COL_MOV, COL_MOV, y, 'movil.', { fuente: 'F2', tam: 9 });
y -= ALTO_FILA;
p.linea(MARGEN, y + 14, MARGEN + ANCHO_UTIL, y + 14, { grosor: 0.8, gris: 0.3 });

// filas
for (const m of MODALIDADES) {
  p.texto(MARGEN + 4, y, m.nombre, { fuente: 'F2', tam: 10 });
  COLUMNAS.forEach((c, i) => {
    // Una raya cuando la modalidad no tiene esa pieza: un hueco en blanco se
    // lee como "no lo sabemos", y esto es "no existe".
    const tiene = m.piezas.includes(c);
    const v = tiene ? String(m.valores[c]) : '–';
    p.centrado(xDe(i), COL_PIEZA, y, v, { tam: 10, gris: tiene ? 0 : 0.6 });
  });
  p.centrado(MARGEN + ANCHO_UTIL - COL_MOV, COL_MOV, y, String(m.movilidad), { tam: 10 });
  y -= 12;
  const origen = ORIGEN[m.id] || 'sin anotar de dónde salen';
  p.texto(MARGEN + 4, y, `${m.tablero} · ${origen}`, { tam: 8, gris: 0.45 });
  y -= ALTO_FILA - 12 + 8;
  p.linea(MARGEN, y + 14, MARGEN + ANCHO_UTIL, y + 14, { grosor: 0.3, gris: 0.8 });
}

y -= 12;
p.texto(MARGEN, y, 'Las piezas', { fuente: 'F2', tam: 11 });
y -= 15;
for (const c of COLUMNAS) {
  p.texto(MARGEN, y, `${c}   ${NOMBRE_PIEZA[c]}`, { tam: 9 });
  y -= 12;
}
p.texto(MARGEN, y, 'K   rey: vale 0 en todas las modalidades, porque no se puede capturar',
  { tam: 9 });
y -= 12;
p.texto(MARGEN, y, 'movil.   lo que suma cada jugada disponible, no es una pieza', { tam: 9 });
y -= 22;

p.texto(MARGEN, y, 'Por qué no coinciden entre modalidades', { fuente: 'F2', tam: 11 });
y -= 15;
for (const l of [
  'Una pieza no vale lo mismo en dos tableros distintos. El alfil de Trigonal avanza en',
  'zigzag; el de Dekle no está atado al color de la casilla; la torre de Salas v1 (1998) es la',
  'pieza que en 2026 se llama elefante, y se mueve sobre 64 casillas en vez de 96. Los',
  'valores se miden modalidad por modalidad, no se traspasan.',
]) { p.texto(MARGEN, y, l, { tam: 9 }); y -= 12; }

const pdf = p.buffer();

if (CHECK) {
  // Compara sin la fecha de generación, que cambia todos los días y no es un
  // cambio de valores.
  const sinFecha = (b) => b.toString('latin1').replace(/generado el \d{4}-\d\d-\d\d/, '');
  const viejo = fs.existsSync(SALIDA) ? fs.readFileSync(SALIDA) : Buffer.alloc(0);
  if (sinFecha(viejo) === sinFecha(pdf)) { console.log('docs/valores-piezas.pdf al dia'); process.exit(0); }
  console.error('docs/valores-piezas.pdf NO refleja los valores de variants.js.' +
    ' Regeneralo con: node entrenamiento/valores-pdf.js');
  process.exit(1);
}

fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
fs.writeFileSync(SALIDA, pdf);
console.log(`escrito ${path.relative(REPO, SALIDA)} · ${MODALIDADES.length} modalidades, ${pdf.length} bytes`);
for (const m of MODALIDADES) {
  console.log('  ' + m.nombre.padEnd(22) +
    COLUMNAS.filter(c => m.piezas.includes(c)).map(c => `${c}${m.valores[c]}`).join(' '));
}
