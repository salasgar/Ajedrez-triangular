# Traspaso — Insignia de captura

Actualizado: 2026-08-24 · Sesiones previas: 1

## Objetivo

Dejar `main` coherente. La insignia de captura —la miniatura de la pieza recién
comida, dentro de un disco rojo, junto a la lista de capturadas— está publicada a
medias: el JavaScript que la pinta está en `main`, el CSS que la define no. Hasta
que se arregle, al capturar una pieza aparece un círculo SVG sin `fill`, o sea un
churretón negro, sin disco rojo, sin borde blanco y sin animación.

## Estado actual

**Terminado y pusheado** (commit `4c13e5f`, 2026-08-04): el editor de posiciones
ya no está escondido dentro del desplegable «Reglas». Ahora es un botón
`#btn-design` en el panel lateral, justo debajo de «Nueva partida». Verificado en
`HEAD`: el botón está y el enlace ya no aparece en la lista de reglas.

**Roto, y es lo que queda por hacer**: ese mismo commit arrastró 82 líneas de otra
sesión en `script.js` (`piezaComidaEn`, `makeCaptureBadge`) sin su CSS. Verificado
el 2026-08-24: `git show HEAD:script.js` contiene `makeCaptureBadge`, y
`git show HEAD:style.css` no contiene ni una regla `.captura-*`.

`style.css` sigue modificado en el árbol de trabajo, con tres hunks:

| Hunk | De quién |
|---|---|
| `@@ -765,6 +765,58 @@` (+52 líneas, bloque `.captura-*`) | el que falta en `main` |
| `@@ -776,20 +828,31 @@` | otra sesión, no tocar |
| `@@ -824,6 +887,33 @@` | otra sesión, no tocar |

## Siguiente paso

Commitear **solo el primer hunk** de `style.css` y pushear. La receta para
commitear hunks sueltos en este árbol compartido está en la memoria del proyecto,
en `commit-parcial-arbol-compartido.md`: los números de hunk de la tabla de arriba
hay que recalcularlos, porque las otras sesiones siguen editando el fichero.

Comprobar después, abriendo `index.html` y capturando una pieza, que sale el disco
rojo con la miniatura y no un círculo negro.

Banda de modelo para retomar: **MEDIO** — la receta ya está escrita, pero es un
árbol compartido y equivocarse de hunk vuelve a arrastrar trabajo ajeno a `main`.

## Decisiones tomadas

| Decisión | Por qué |
|---|---|
| El editor va junto a «Nueva partida», no en «Reglas» | Diseñar una posición es otra forma de empezar partida —el editor acaba en `index.html?posicion=1`—, no una regla del juego |
| El botón reutiliza la clase `.save-row` en vez de CSS propio | `style.css` estaba reclamado por otra sesión; así sale con el estilo secundario gris sin tocar ese fichero |
| «Valores de piezas» se queda dentro de «Reglas» | Eso sí es documentación de referencia, no una acción |
| Completar el CSS que falta en vez de revertir el JS de `main` | Encima ya hay commits nuevos (`ca04315`) y el JS de la insignia está asentado; sale más barato añadir las 52 líneas que quitar las 82 |

## Descartado — no volver a proponer

| Se descartó | Motivo |
|---|---|
| Dejar el editor en el desplegable «Reglas» | Quedaba a dos clics y mezclado con documentación de referencia |
| Revertir de `main` los hunks ajenos de `script.js` | Se propuso el 2026-08-04 y el mundo siguió adelante; ahora rompería trabajo que ya está asentado |
| Añadir reglas nuevas a `style.css` para el botón del editor | Innecesario: `.save-row` ya da el estilo que hace falta |

## Archivos

- `index.html` (líneas 138-144) — botón «Diseñar una posición…» bajo «Nueva partida»
- `script.js` (líneas 1480-1482) — el listener que navega a `editor.html`
- `style.css` — sin commitear, contiene el bloque `.captura-*` que falta en `main`
- `editor.html` / `editor.js` — el editor en sí; vuelve al juego con «← Volver al juego»

## Contexto que no está en los archivos

La incoherencia de `main` la causó esta sesión: se hizo `git add index.html
script.js` dando por hecho que esos ficheros solo tenían el cambio propio, cuando
el `git status` de arranque ya los marcaba como modificados por otras sesiones.

El 2026-08-04 se le preguntó a Juan Luis cómo arreglarlo y no llegó a contestar.
La opción que entonces se planteó como preferible —esperar a que la otra sesión
commiteara `style.css`— no ha ocurrido en veinte días, así que el siguiente paso
de arriba ya no espera por ella.
