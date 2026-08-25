# TABLÓN DE ESTADO — reparto-ajedrez

Ficha del proyecto —rutas, reglas del repo, frase de arranque—: `proyecto.md`
Autorizaciones firmadas: `autorizaciones.md`
Ninguno de los dos se regenera nunca; este fichero sí, entero.

**Este fichero es un resumen legible, no la fuente de verdad.** La verdad está en la
carpeta `reparto/hechos/`: un fichero por hecho, cada uno con el identificador de la
sesión que lo escribió en el nombre. Si la tabla de abajo contradice a `hechos/`, gana
`hechos/` y este tablón hay que regenerarlo.

Regenerado: 2026-08-25T01:34Z · por la sesión s-20260824T235504-fde8fd6d (cierre de la
tarea 15: `editor.html` ya funciona sin conexión)

El árbol compartido está sobre `main` = `origin/main` (`b62f941`: arreglo de la 15
sobre el `b102835` de la tarea 11). Las tareas de interfaz editan los ficheros
directamente, con los reclamos del harness (`.claude/sesiones/`) como siempre. Queda un
`stash@{0}` de respaldo de la reconciliación; ya no hace falta —la 08 está LISTA—,
queda libre para que Juan Luis lo tire cuando quiera.

## Antes de hacer nada

0. Lee `proyecto.md`: rutas, reglas propias de este repositorio (git lento, árbol
   compartido, prohibiciones de checkout) y la frase de arranque.
1. Lee este fichero entero.
2. **Lista `hechos/reclamos/`, `hechos/terminadas/` y `hechos/incidencias/`** y
   compáralo con las ramas y `git log`: en este reparto la salida de casi todas las
   tareas es git, así que el acta real son los commits más `hechos/terminadas/`.
   Resuelve lo que no cuadre antes de coger tarea. Cuando haya varios rastros de una
   misma tarea, gana el más reciente por su fecha interna.
3. Mira la hora de verdad: `date -u`.
4. Genera tu identificador de sesión y no lo cambies:
   `sid="s-$(date -u +%Y%m%dT%H%M%S)-$(head -c4 /dev/urandom | od -An -tx1 | tr -d ' \n')"`
   Nada de `$RANDOM`.
5. Reclama tu tarea: crea `hechos/reclamos/NN--<sid>.md`, ejecuta
   `sleep 30 && ls reparto/hechos/reclamos/` —OJO: el `sleep` en primer plano está
   bloqueado por el harness; lánzalo con `run_in_background`— y cede si otra sesión
   llegó antes (gana el reclamo de apertura más antigua; empate, sid menor).

El protocolo completo está en la skill `reparto`, fichero `referencias/concurrencia.md`.
Lo esencial: cada sesión escribe únicamente ficheros con su identificador en el nombre,
nadie edita el fichero de nadie, y este tablón se regenera a partir de los demás.

## Reglas de operación

0. **Coge una tarea que encaje con el modelo con el que te han abierto.** La banda la
   dice Juan Luis en la frase de arranque; si no la dice, pregúntala en una línea antes
   de reclamar, salvo que todas las tareas libres sean de la misma banda.
1. **Una sesión, una tarea, reclamada**, con `caduca:` calculado (2 × duración
   esperada) y el `sleep 30` de verdad (en segundo plano).
2. **Un reclamo está vivo** si su último `caduca:` está en el futuro, no tiene línea de
   cierre y nadie lo releva. Caducado = relevable con `releva a: <sid>`.
3. **Estira la caducidad antes de una operación larga** (aquí git tarda minutos), y
   comprueba después que nadie te ha relevado antes de seguir escribiendo.
4. **Cada sesión escribe solo lo suyo.** Ningún fichero tiene dos escritores.
5. **Una tarea, una salida, un dueño.** Aquí casi todas las salidas son git: la rama o
   los ficheros que declara cada ficha de tarea. En `reparto/salidas/`, ningún fichero
   cuenta sin su marcador `<nombre>.ok-<sid>`.
6. **Idempotencia obligatoria.** Comprueba qué hay hecho (ramas, commits, terminadas)
   antes de actuar; nunca des por supuesto que empiezas de cero.
7. **Los datos van al repo o a `reparto/`**, nunca al scratchpad de la sesión: se purga
   a medianoche (así se perdieron ya tres scripts de medición).
8. **Nada se borra sin firma de Juan Luis en `autorizaciones.md`.** «Borrar» significa
   mover a `reparto/_papelera/`, que vacía él.
9. **Si paras sin terminar**, `hechos/fallos/NN--<sid>.md` (crea la carpeta si no
   existe) con `parada por: sesión agotada` o `parada por: avería`, y `ABANDONADA` en
   tu reclamo.
10. **Un cierre en falso se anula, no se borra**: escribe la incidencia y, cuando de
    verdad cierre, una terminada nueva con fecha posterior.
11. **Una tarea mal cortada no se renumera**: incidencia con el corte natural,
    `ABANDONADA`, y avisar. Las tareas nuevas se añaden al final de la numeración (así
    entró la 10).
12. **No modificar nunca** los seis `traspaso-*.md` de los trabajos (son el registro de
    las sesiones que se fueron; `traspaso-reparto-ajedrez.md` sí se actualiza, pero
    solo al hacer traspaso de sesión) ni `reparto/autorizaciones.md`.

## Tabla de tareas

Vista derivada. LISTA si el rastro más reciente es una terminada; EN CURSO si hay
reclamo vivo; A MEDIAS / FALLIDA según la línea `parada por:` del fallo más reciente;
BLOQUEADA si le falta una precondición; PENDIENTE en lo demás.

**La columna «Banda» no sale de `hechos/`: se copia del fichero de tarea al regenerar.**
ALTO = el más capaz del menú, MEDIO = el intermedio, BAJO = el más rápido; la
equivalencia de hoy está en `proyecto.md`.

| # | Tarea | Fichero | Precondición | Duración esperada | Banda | Salida (dueño único) | Disparo | Estado | Reclamo vivo (sid · caduca) |
|---|---|---|---|---|---|---|---|---|---|
| 01 | Vaciar el árbol compartido a git, un commit por trabajo | tareas/tarea-01-vaciado.md | ninguna | 3 h | ALTO | rama `vaciado-arbol` | manual | **LISTA** | |
| 02 | Integrar la línea PPT en `main` (PR #2 → #3 → #1) | tareas/tarea-02-integrar-ppt.md | ninguna | 1 h | MEDIO | `main` en `origin` | manual | **LISTA** | |
| 03 | Cerrar la arena de posiciones PPT e integrarla | tareas/tarea-03-arena-ppt.md | 02 LISTA + visto bueno de Juan Luis para relanzar la arena | 2 h (queda) | MEDIO | rama `posiciones-ppt` → `main` | manual | EN CURSO (reanudada, visto bueno dado) | s-20260824T233011-d4d13c52 · 2026-08-25T08:38:00Z |
| 04 | Reconciliar el vaciado con el `main` nuevo | tareas/tarea-04-reconciliacion.md | 01 y 02 LISTAS | 2 h | ALTO | `main` + salidas/04-reconciliacion/ | manual | **LISTA** | |
| 05 | Pestaña «Problemas» en `index.html` y `script.js` | tareas/tarea-05-pestana-problemas.md | 04 LISTA | 3 h | MEDIO | `main` (index.html, script.js) | manual | **LISTA** | |
| 06 | Rendimiento y equilibrio del almacén de problemas | tareas/tarea-06-almacen-problemas.md | 05 LISTA | 1 h (queda) | MEDIO | `main` + `entrenamiento/` | manual | **LISTA** | |
| 07 | Interfaz de «Editar tablero» (§1, §4, §5) | tareas/tarea-07-editar-tablero-ui.md | 05 LISTA | 4 h | MEDIO | `main` (7 ficheros de UI) | manual | **LISTA** | |
| 08 | Verificación en navegador de todo lo publicado | tareas/tarea-08-verificacion.md | 05 y 07 LISTAS | 2 h | MEDIO | salidas/08-verificacion/ | manual | **LISTA** | |
| 09 | Limpieza de restos y duplicados | tareas/tarea-09-limpieza.md | 2 firmas en autorizaciones.md | 1 h | BAJO | reparto/_papelera/ | manual | EN CURSO | s-20260825T005707-b78fd0ac · 2026-08-25T02:57:07Z |
| 10 | Aplicar los resultados de la ronda 15 del entrenamiento | tareas/tarea-10-ronda-15.md | 03 y 04 LISTAS | 2 h | MEDIO | `main` (variants.js, PDF de valores) | manual | BLOQUEADA (falta 03 LISTA; está EN CURSO) | |
| 11 | Ayuda y reglas adaptadas a cada modalidad (sin reglas de peón donde no hay peones) | tareas/tarea-11-ayuda-por-modalidad.md | ninguna | 1 h | MEDIO | `main` (index.html, script.js — solo la ayuda) | manual | **LISTA** | |
| 12 | Problemas bien planteados: mínimo real de jugadas y todas las soluciones admitidas | tareas/tarea-12-problemas-bien-planteados.md | ninguna | 3 h | MEDIO | `main` (problemas.js, problemas-ui.js, crear-problema.js) + `entrenamiento/` | manual | EN CURSO | s-20260824T235458-3ccd1290 · 2026-08-25T05:54:58Z |
| 13 | La IA no captura gratis en las modalidades PPT | tareas/tarea-13-ia-modalidades-ppt.md | 03 sin reclamo vivo | 3 h | MEDIO | `main` (ai.js, ai-async.js, test-ia-rps.js) | manual | EN CURSO | s-20260824T235417-04eac74c · 2026-08-25T05:54:24Z |
| 14 | Cosechar problemas de partidas ordenador contra ordenador | tareas/tarea-14-cosecha-de-partidas.md | 12 LISTA | 4 h | MEDIO | `entrenamiento/` (y problemas.js si exporta) | manual | BLOQUEADA | |
| 15 | `editor.html` no funciona sin conexión (desajuste `?v=N` con `sw.js`) | tareas/tarea-15-editor-offline.md | ninguna | 1 h | MEDIO | `main` (editor.html, sw.js) | manual | **LISTA** | |

Las tareas 11-14 entraron el 2026-08-25 a partir de los cuatro problemas y la
sugerencia (cosecha) reportados por Juan Luis; el porqué del corte, en
`hechos/incidencias/s-20260824T233011-d4d13c52.md` y en `proyecto.md`.

Estado de la 03: `rps-rey` y `rpsls-rey` ya cerrados y publicados (main = 53b32e6, ya
bajo el `b102835` actual); `rps` y `rpsls` seguían sin medir a la espera del visto bueno
de Juan Luis para relanzar la arena. **Ese visto bueno ya se dio** (2026-08-25T00:37Z,
«Lanza la arena esa de la tarea 03») y la sesión `s-20260824T233011-d4d13c52` reanudó la
03 a las 00:38Z: 2 procesos node en paralelo (tope prudente, la tanda anterior de 4 ya
notaba en el Mac), midiendo `rps` (eq18-giro, fondo9-giro, frente11-giro) y `rpsls`
(eq15-giro, fondo10-giro, frente11-giro) sobre la criba ya hecha; NO repite lo de las
-rey. Caduca 2026-08-25T08:38:00Z (se estirará si hace falta; son horas de máquina).

**Juan Luis firmó las dos autorizaciones pendientes en `autorizaciones.md`** (25-8-2026):
retirar los ocho ficheros de depuración del editor, y consolidar/retirar los duplicados
« 2» de sincronización. Eso desbloqueó la 09, que ya está reclamada (sid `b78fd0ac`,
abierta 00:57:07Z, caduca 02:57:07Z).

La tarea 08 (verificación) encontró 6/7 comprobaciones BIEN y 1 FALLA parcial: el editor
de posiciones (`editor.html`) no funcionaba sin conexión por un desajuste entre las
cadenas `?v=N` de sus `<script>` y las rutas sin versión que cachea `sw.js`. **Ya está
arreglado** por la tarea 15 (nueva, abierta y cerrada por la misma sesión que hizo la
08, con autorización expresa de Juan Luis): se quitaron las cadenas `?v=N` de
`editor.html` (el `VERSION` de `sw.js` ya invalida la caché entera cuando cambia) y se
subió `VERSION` a v8 para forzar la actualización en navegadores con caché vieja.
Verificado offline con Playwright: tablero y selector de modalidad cargan sin errores;
`index.html` sigue funcionando igual que antes. Detalle completo en
`hechos/terminadas/15--s-20260824T235504-fde8fd6d.md`.

Libres ahora mismo: **ninguna sin reclamo**. En curso: la **03** (reanudada), la **09**
(limpieza, recién reclamada), la **12** (sid `3ccd1290`, caduca 05:54Z) y la **13** (sid
`04eac74c`, caduca 05:54Z). La 10 y la 14 siguen bloqueadas hasta que cierren la 03 y la
12 respectivamente.

## Registro de finalizaciones

Derivado de `hechos/terminadas/`. Una línea por fichero, más reciente arriba.

Formato: `LISTA · tarea NN · AAAA-MM-DD HH:MM · sid · recuento · salida`

- LISTA · tarea 15 · 2026-08-25 01:07 · s-20260824T235504-fde8fd6d · 2 ficheros (editor.html: quitadas las 9 cadenas `?v=N`; sw.js: VERSION v7→v8); verificado offline con Playwright: editor.html carga tablero + 9 opciones de modalidad, 0 errores; index.html sigue igual · main = b62f941
- LISTA · tarea 08 · 2026-08-25 00:23 · s-20260824T235504-fde8fd6d · 7/7 comprobaciones en navegador (Playwright/Chromium headless), 6 BIEN (insignia de captura, editor de posiciones, pestaña Problemas, problemas en imagen, editar tablero, PPT+teselación) + 1 FALLA parcial (service worker: VERSION/FICHEROS bien, pero `editor.html` no sirve sin conexión) · informe + 30 capturas/JSON en salidas/08-verificacion/, incidencia en hechos/incidencias/s-20260824T235504-fde8fd6d.md · HEAD = b102835
- LISTA · tarea 11 · 2026-08-25 00:03 · s-20260824T235449-a524a145 · 1 fichero modificado (script.js), 1 línea; arreglado `help-draws` para no mencionar peón en rps-rey/rpsls-rey (mantenía la mención heredada de `V.kingless` sin comprobar `V.pieces.P`); verificado en Chromium headless sobre las 4 PPT + salas de control · main = b102835
- LISTA · tarea 06 · 2026-08-24 23:11 · s-20260824T214036-9bb6b2c2 · 2 ficheros modificados (problemas.js, problemas-ui.js) + 1 nuevo (entrenamiento/prueba-problemas.js); difícil/experto sí generan (el 0 medido era la ventana de medición, no el generador); arreglado el presupuesto real (`msEspera` por nivel) que hacía fallar «Nuevo problema» en difícil/experto; verificador independiente reconstruido, 44 problemas reverificados (32 fácil/medio + 12 difícil/experto), 0 fallos · main = 8336795
- LISTA · tarea 07 · 2026-08-24 22:52 · s-20260824T213344-deadcf4b · 7 ficheros (290 inserciones, 41 borrados); node test-edicion.js 31/31; ciclo completo en Chromium headless vía Playwright, 19/19, 0 errores de consola · origin/main = daa0f28
- LISTA · tarea 05 · 2026-08-24 20:50 · s-20260824T180039-ac278f27 · 4 cambios html + 3 ganchos + 1 fallo CSS arreglado, verificado en Chrome · main = 792e745
- LISTA · tarea 04 · 2026-08-24 19:35 · s-20260824T180039-ac278f27 · 5 choques resueltos, 4 pruebas en verde, árbol limpio · main = e0dd26e
- LISTA · tarea 02 · 2026-08-24 18:55 · s-20260824T180039-ac278f27 · 3 PR mezcladas + 2 commits, 2 pruebas en verde · origin/main = 299d176
- LISTA · tarea 01 · 2026-08-24 18:35 · s-20260824T180039-ac278f27 · 7 commits, 0 hunks sin dueño, 13 js verificados · rama `vaciado-arbol` en origin

## Incidencias de coordinación

Derivado de `hechos/incidencias/`.

- s-20260824T235504-fde8fd6d: la tarea 08 (verificación) encontró un fallo real —no de
  coordinación, de código—: `editor.html` no funciona sin conexión (9 `<script
  src="...?v=N">` que `sw.js` no cachea con esa query string; `index.html` sí funciona
  sin red). Sin arreglar por protocolo de la 08; tres correcciones candidatas sin
  decidir. También nota menor: al arrancar, `git status` traía el cierre de la 11 en
  marcha (sin impacto), y un choque de reserva del harness sobre `_ESTADO.md` con la
  sesión montadora (7369dfea), resuelto esperando a que liberase el fichero en vez de
  forzar el desbloqueo. **Arreglado por la tarea 15** (misma sesión, autorizada por
  Juan Luis): ver `hechos/terminadas/15--s-20260824T235504-fde8fd6d.md`.
- s-20260824T233011-d4d13c52: ampliación con las tareas 11-14 (cuatro problemas + una
  sugerencia de Juan Luis, 2026-08-25); duplicados de sincronización con « 2» en el
  nombre detectados (libro-trigonal, tres scripts) — candidatos para la 09; hunks sin
  commitear en problemas*.js a las 23:30Z cuya autoría debe aclarar quien coja la 12.
- s-20260824T180039-ac278f27: séptimo trabajo sin traspaso (paleta del editor)
  descubierto en la 01 y commiteado como `0f91612`; la ronda 15 del entrenamiento
  cerró → tarea 10 nueva; `libro-salas-v4.json` no salía en `git status` del
  inventario; el `sleep` en primer plano está bloqueado por el harness; `du` marca 0B
  en ficheros evictados por iCloud.
