# TABLÓN DE ESTADO — reparto-ajedrez

Ficha del proyecto —rutas, reglas del repo, frase de arranque—: `proyecto.md`
Autorizaciones firmadas: `autorizaciones.md`
Ninguno de los dos se regenera nunca; este fichero sí, entero.

**Este fichero es un resumen legible, no la fuente de verdad.** La verdad está en la
carpeta `reparto/hechos/`: un fichero por hecho, cada uno con el identificador de la
sesión que lo escribió en el nombre. Si la tabla de abajo contradice a `hechos/`, gana
`hechos/` y este tablón hay que regenerarlo.

Regenerado: 2026-08-24T18:10Z · por la sesión s-20260824T180039-ac278f27 (montaje)

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
   `sleep 30 && ls reparto/hechos/reclamos/` —el comando, no la intención— y cede si
   otra sesión llegó antes (gana el reclamo de apertura más antigua; empate, sid menor).

El protocolo completo está en la skill `reparto`, fichero `referencias/concurrencia.md`.
Lo esencial: cada sesión escribe únicamente ficheros con su identificador en el nombre,
nadie edita el fichero de nadie, y este tablón se regenera a partir de los demás.

## Reglas de operación

0. **Coge una tarea que encaje con el modelo con el que te han abierto.** La banda la
   dice Juan Luis en la frase de arranque; si no la dice, pregúntala en una línea antes
   de reclamar, salvo que todas las tareas libres sean de la misma banda.
1. **Una sesión, una tarea, reclamada**, con `caduca:` calculado (2 × duración
   esperada) y el `sleep 30` de verdad.
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
    `ABANDONADA`, y avisar. Las tareas nuevas se añaden al final de la numeración.
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
| 01 | Vaciar el árbol compartido a git, un commit por trabajo | tareas/tarea-01-vaciado.md | ninguna | 3 h | ALTO | rama `vaciado-arbol` | manual | PENDIENTE | |
| 02 | Integrar la línea PPT en `main` (PR #2 → #3 → #1) | tareas/tarea-02-integrar-ppt.md | ninguna | 1 h | MEDIO | `main` en `origin` | manual | PENDIENTE | |
| 03 | Cerrar la arena de posiciones PPT e integrarla | tareas/tarea-03-arena-ppt.md | 02 LISTA | 2 h | MEDIO | rama `posiciones-ppt` → `main` | manual | BLOQUEADA | |
| 04 | Reconciliar el vaciado con el `main` nuevo | tareas/tarea-04-reconciliacion.md | 01 y 02 LISTAS | 2 h | ALTO | `main` + salidas/04-reconciliacion/ | manual | BLOQUEADA | |
| 05 | Pestaña «Problemas» en `index.html` y `script.js` | tareas/tarea-05-pestana-problemas.md | 04 LISTA | 3 h | MEDIO | `main` (index.html, script.js) | manual | BLOQUEADA | |
| 06 | Rendimiento y equilibrio del almacén de problemas | tareas/tarea-06-almacen-problemas.md | 05 LISTA | 2 h | MEDIO | `main` + `entrenamiento/` | manual | BLOQUEADA | |
| 07 | Interfaz de «Editar tablero» (§1, §4, §5) | tareas/tarea-07-editar-tablero-ui.md | 05 LISTA | 4 h | MEDIO | `main` (7 ficheros de UI) | manual | BLOQUEADA | |
| 08 | Verificación en navegador de todo lo publicado | tareas/tarea-08-verificacion.md | 05 y 07 LISTAS | 2 h | MEDIO | salidas/08-verificacion/ | manual | BLOQUEADA | |
| 09 | Limpieza de restos y duplicados | tareas/tarea-09-limpieza.md | 01 LISTA + 2 firmas en autorizaciones.md | 1 h | BAJO | reparto/_papelera/ | manual | BLOQUEADA | |

Pueden ir en paralelo desde ya: **01 y 02** (no comparten ni un fichero; se juntan en
la 04). Máximo de sesiones útiles a la vez en este reparto: **dos** hasta que cierre la
04; después, también dos (05+algo de git-solo, luego 06/07 en serie por `script.js` —
la 06 y la 07 sí pueden ir a la vez: no comparten ficheros).

## Registro de finalizaciones

Derivado de `hechos/terminadas/`. Una línea por fichero, más reciente arriba.

Formato: `LISTA · tarea NN · AAAA-MM-DD HH:MM · sid · recuento · salida`

(vacío todavía)

## Incidencias de coordinación

Derivado de `hechos/incidencias/`.

(vacío todavía)
