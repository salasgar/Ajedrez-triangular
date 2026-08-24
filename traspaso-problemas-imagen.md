# Traspaso — Problemas en imagen

Actualizado: 2026-08-24 · Sesiones previas: 1

## Objetivo

Que cualquier problema de ajedrez triangular se pueda descargar como archivo de
imagen `.png` —el diagrama del tablero y, debajo, el enunciado tipo «Las blancas
juegan y dan mate en 3 jugadas»— y que Juan Luis pueda crear sus propios
problemas desde el editor de posiciones, verificados por el motor antes de
guardarse.

## Estado actual

Hecho y verificado:

- `problema-imagen.js` y `crear-problema.js` escritos, probados con un banco en
  Node (genera un problema real y lo pasa por las dos rutas) y con Chrome
  headless sobre `editor.html`.
- `editor.html` carga los cuatro scripts tras `editor.js`. La caja «Crear un
  problema» aparece en el panel y funciona de punta a punta: comprobar, guardar
  en el navegador, exportar `.json` y descargar la imagen. Probados también los
  caminos negativos: enunciado falso, autocorrección de la profundidad, posición
  ilegal, sin reyes y coronar sin peones.
- `sw.js`: `VERSION` en `ajedrez-triangular-v5` y los cinco archivos nuevos en
  `FICHEROS`.
- `README.md`: sección «Problemas en imagen» (línea 250) y dos filas en la tabla
  de «Estructura» (líneas 392-393).

A medias, y es lo único que queda:

- `index.html` carga `problema-imagen.js`, pero **está inerte**: la pestaña
  «Problemas» todavía no existe en esa página. `problemas.js`, `problemas-ui.js`
  y `problemas.css` están en el repo pero no los carga ninguna página, y no hay
  marcado de pestaña (`tab-problemas`, `panel-problemas`, `prob-exportar`). El
  botón «Imagen (.png)» se monta solo junto a `#prob-exportar` en cuanto ese
  marcado exista, sin tocar `problemas-ui.js`.

Nada de esto está en git: el último commit es `ca04315` (2026-08-04) y todo vive
en el working tree.

## Siguiente paso

Enganchar la pestaña «Problemas» en `index.html` —el marcado de la pestaña más
`problemas.js`, `problemas-ui.js` y `problemas.css`— y comprobar en el navegador
que el botón «Imagen (.png)» aparece junto a «Exportar» y descarga el diagrama
del problema montado. No hay nada que tocar en `problema-imagen.js` para eso.

Esa pestaña es trabajo de otra sesión (ver «Contexto»); si ya la ha enganchado,
el siguiente paso se reduce a la comprobación en el navegador.

Banda de modelo para retomar: MEDIO — enganchar unos scripts y comprobar en el
navegador, con el criterio ya fijado.

## Decisiones tomadas

| Decisión | Por qué |
|---|---|
| El diagrama se redibuja en un `<canvas>`, no se serializa el SVG de la página | El SVG obliga a arrastrar media hoja de estilos y aun así sale con las marcas de la partida (selección, último movimiento, jaque) |
| Las coordenadas solo se escriben en las casillas vacías | En pantalla el nombre asomando tras la pieza no molesta; en un diagrama impreso ensucia justo lo que hay que leer |
| `problema-imagen.js` monta su botón solo, buscando `#prob-exportar` | Permite añadir la exportación sin tocar `problemas-ui.js`, que estaba en manos de otra sesión |
| El problema se verifica con `probSoluciones` antes de guardarse | «Mate en 3» es comprobable: si el objetivo no se puede forzar contra cualquier defensa, el enunciado es falso y no debe guardarse |
| Si se resuelve en menos jugadas de las pedidas, se ajusta el enunciado en vez de rechazarlo | El problema es válido, solo que de otra profundidad; rechazarlo perdería trabajo bueno |
| Las piezas del problema nacen con `moved: true` | En un problema no hay enroque ni avance doble de peón, y con ellos entraría la captura al paso y un montón de casos raros que no aportan nada |
| Tope de 1 200 000 nodos al comprobar desde el editor | La búsqueda es síncrona y congela la pestaña: hay que responder siempre, pero acotado |
| Varias soluciones avisan, no bloquean | Un problema hecho a mano con dos soluciones sigue siendo un problema; el filtro estricto es cosa del generador automático |
| `crear-problema.js` envuelve `updateStatus()` en vez de modificar `editor.js` | Es el único punto por el que pasa el editor tras cada cambio del tablero, y así los dos archivos no quedan atados |
| Los estilos de la caja van en un `<style>` inyectado desde el JS | `style.css` estaba reclamado por otra sesión, y así la funcionalidad queda autocontenida |

## Descartado — no volver a proponer

| Se descartó | Motivo |
|---|---|
| Serializar el SVG del tablero para generar la imagen | Arrastra el CSS y las marcas de la partida en curso |
| Exportar el diagrama también en SVG | El encargo era «archivo de imagen»; el PNG basta y duplicar el renderizador no compensa |
| Una página aparte tipo `crear-problema.html` | El encargo dice «desde el editor de tablero»; duplicar el editor era peor que esperar a poder tocarlo |
| Forzar el desbloqueo borrando el `.json` de otra sesión en `.claude/sesiones/` | Rompe la coordinación entre sesiones; se esperó a que el reclamo caducara |
| Reutilizar `PROB_GUARDADO_PREFIX` de `problemas-ui.js` | El editor no carga ese archivo; se repite el literal en `PROB_CREA_PREFIJO` |

## Archivos

| Ruta | Contenido |
|---|---|
| `problema-imagen.js` | Dibuja un problema en un `<canvas>` y lo descarga en `.png` con el enunciado debajo. Monta solo el botón junto a `#prob-exportar`. |
| `crear-problema.js` | La caja «Crear un problema» del editor: verifica el objetivo, guarda en el navegador, exporta `.json` e imagen. |
| `editor.html` | Carga `ai.js`, `problemas.js`, `problema-imagen.js` y `crear-problema.js` tras `editor.js`. |
| `index.html` | Carga `problema-imagen.js` al final; inerte hasta que exista la pestaña «Problemas». |
| `sw.js` | `VERSION` v5 y los cinco archivos nuevos en `FICHEROS`. |
| `README.md` | Sección «Problemas en imagen» y las dos filas de la tabla de «Estructura». |
| `problemas.js`, `problemas-ui.js`, `problemas.css` | Motor y pestaña de problemas. No son de este trabajo: los lleva otra sesión. |

## Contexto que no está en los archivos

- Hay varias sesiones de Claude trabajando a la vez sobre este mismo working
  tree. Los reclamos viven en `.claude/sesiones/*.json` y bloquean la edición de
  los archivos que otra sesión tenga cogidos; caducan solos a los 30 minutos sin
  actividad. Buena parte de las decisiones de arriba (montaje automático del
  botón, estilos inyectados) existen para no depender de archivos reclamados.
- La pestaña «Problemas» del juego la lleva la sesión `d9ab6ba0`. `problemas.js`,
  `problemas-ui.js` y `problemas.css` son suyos.
- El 2026-08-04 se arregló un fallo en `problemas.js` que no es de este trabajo:
  al renombrar la constante `PROB_MAX_SOLUCIONES` a la función
  `probMaxSoluciones(tipo, jugadas)` quedó una referencia colgada en
  `problemas.js:726` que lanzaba `ReferenceError` justo al encontrar un problema
  bueno, y la constante seguía en la lista que `problemas-ui.js` copia al worker.
  Si otra sesión rehace esos archivos, comprobar que el arreglo sigue puesto.
