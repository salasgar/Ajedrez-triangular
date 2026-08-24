# Tarea 05 · Pestaña «Problemas» en `index.html` y `script.js`

Actualizado: 2026-08-24
Precondición: tarea 04 LISTA · Disparo: MANUAL
Duración esperada: 3 h · Banda de modelo: MEDIO
Salida (dueña exclusiva): `main` (los ficheros `index.html` y `script.js` del árbol,
ya limpio tras la 04)

## Antes de empezar
1. Lee `reparto/_ESTADO.md`, lista `reparto/hechos/`, comprueba la terminada de la 04.
2. `date -u`, `sid`, reclamo `05--<sid>.md` (caduca: +6 h), `sleep 30`, volver a mirar.
3. Mira `.claude/sesiones/*.json`: si otra sesión del harness tiene reclamados
   `index.html` o `script.js`, espera o coordina antes de editar.

## Objetivo
El motor de problemas está terminado y verificado (fuera del navegador); lo que no
existe es la pestaña. Esta tarea aplica la integración en `index.html` y `script.js`,
que está **especificada al detalle, sin nada que decidir**, en `traspaso-problemas.md`
(secciones «1. index.html — cuatro cambios» y «2. script.js — tres ganchos»), y la
depura en el navegador. Con la pestaña existiendo, el botón «Imagen (.png)» de
`problema-imagen.js` se monta solo junto a `#prob-exportar`.

## Qué hay que hacer
1. Aplicar los cuatro cambios de `index.html` tal como los lista el traspaso —ojo a la
   lista completa de nodos `prob-*` del `<aside id="panel-problemas">`: si falta uno,
   la página revienta al cargar— y el orden de carga: `problemas.js` ANTES de
   `script.js`, `problemas-ui.js` DESPUÉS.
2. Aplicar los tres ganchos de `script.js`, todos con guarda
   `typeof … === 'function'`.
3. Abrir la app (Chrome headless con captura vale) y comprobar: la pestaña aparece, el
   worker de generación arranca, se puede pedir un problema, jugarlo, pedir pista y
   solución, y el botón «Imagen (.png)» aparece junto a «Exportar».
4. Commitear (el árbol ya es de fiar tras la 04, pero sigue mirando el diff antes del
   add) y push de `main`.

## Datos de entrada
- `traspaso-problemas.md` — la especificación exacta. No hay que decidir nada.
- `problemas.js`, `problemas-ui.js`, `problemas.css` — ya en `main` tras la 01+04.
- `traspaso-problemas-imagen.md` — el botón PNG que debe aparecer solo.

## Salida esperada
`origin/main` con la pestaña funcionando. `sw.js` NO se toca aquí salvo que haga falta
subir `VERSION` para publicar; si se sube, una sola vez y anotado en el commit.

## Cómo saber que ha terminado
En el navegador: la pestaña «Problemas» carga sin errores de consola, genera y resuelve
un problema de cada tipo disponible, y el botón «Imagen (.png)» está junto a
«Exportar». `node --check` en verde para `index.html` no aplica; para `script.js` sí.

## Al terminar
Cierre estándar: terminada `05--<sid>.md`, `CERRADA`, incidencias, regenerar tablón
(la 06 y la 07 pasan a PENDIENTE; la 08 sigue BLOQUEADA hasta la 07), `git add
reparto/` + commit + push, y decir a Juan Luis qué queda libre y con qué banda.

## Trampas conocidas
- El worker puede fallar al arrancar: entonces avisa por consola y genera en el hilo
  principal, que congela la página. Compruébalo expresamente.
- El 2026-08-04 se arregló en `problemas.js:726` una referencia colgada a
  `PROB_MAX_SOLUCIONES` (renombrada a la función `probMaxSoluciones`); comprueba que el
  arreglo sigue tras los merges, también en la lista que `problemas-ui.js` copia al
  worker.
- Al entrar en la pestaña se guarda la partida y al salir se restaura: pruébalo, es
  fácil de romper.
- Git tarda 1-3 minutos por orden.

## Prohibido
- Tocar `style.css` (los estilos de la pestaña viven en `problemas.css`; descartado en
  el traspaso).
- Rendimiento y equilibrio del almacén: eso es la 06, no la alargues aquí.
- Una página `problemas.html` aparte (descartado).
