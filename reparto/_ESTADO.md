# TABLÓN DE ESTADO — reparto-ajedrez

Ficha del proyecto —rutas, reglas del repo, frase de arranque—: `proyecto.md`
Autorizaciones firmadas: `autorizaciones.md`
Ninguno de los dos se regenera nunca; este fichero sí, entero.

**Este fichero es un resumen legible, no la fuente de verdad.** La verdad está en la
carpeta `reparto/hechos/`: un fichero por hecho, cada uno con el identificador de la
sesión que lo escribió en el nombre. Si la tabla de abajo contradice a `hechos/`, gana
`hechos/` y este tablón hay que regenerarlo.

Regenerado: 2026-08-26T11:49Z · por la sesión s-20260826T095832-0470517d al cerrar la
17, su segunda tarea seguida (antes cerró la 16). Ya está el instrumento de medida de la
cadena: los pesos de evaluación PPT son configurables (`cfg.rps`) y
`entrenamiento/arena-motor.js` los mide por elo, con tandas de humo limpias en las dos
modalidades. Queda libre la 18. La cadena en serie la recableó `a0bfaa7` al entrar la
21: va 18 → 21 → 19 → 20. Las modalidades sin rey siguen APARCADAS por decisión de Juan
Luis del 2026-08-26.

El árbol compartido está sobre `main` = `origin/main` (`74ca9d9`: la arena de motor de
la 17, sobre el `3ac4c3a` de la regla de reyes de la 16). Las
tareas de interfaz editan los ficheros directamente, con los reclamos del harness
(`.claude/sesiones/`) como siempre. Queda un `stash@{0}` de respaldo de la
reconciliación; ya no hace falta —la 08 está LISTA—, queda libre para que Juan Luis lo
tire cuando quiera.

**Las 15 tareas originales están completas, y también la 16 y la 17**; quedan las
18-21: los candidatos de mejora medidos por elo, EN SERIE (comparten ai.js y cada uno
parte del vigente que dejó el anterior). El instrumento ya está hecho y probado (17),
así que la 18 puede empezar a medir directamente. Las modalidades sin rey
(`rps`, `rpsls`) quedan aparcadas: ninguna tarea las toca.

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
   Nada de `$RANDOM`. **No lo guardes en un fichero de /tmp con nombre genérico entre
   dos llamadas de shell**: varias sesiones de este reparto corren en la misma máquina y
   pueden pisarte ese fichero (pasó el 2026-08-25, ver incidencia
   `s-20260825T090854-1758bb65`). Genera y usa el sid en el mismo comando, o guárdalo en
   el scratchpad aislado de tu propia sesión.
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
| 03 | Cerrar la arena de posiciones PPT e integrarla | tareas/tarea-03-arena-ppt.md | 02 LISTA | 2 h | MEDIO | rama `posiciones-ppt` → `main` | manual | **LISTA** | |
| 04 | Reconciliar el vaciado con el `main` nuevo | tareas/tarea-04-reconciliacion.md | 01 y 02 LISTAS | 2 h | ALTO | `main` + salidas/04-reconciliacion/ | manual | **LISTA** | |
| 05 | Pestaña «Problemas» en `index.html` y `script.js` | tareas/tarea-05-pestana-problemas.md | 04 LISTA | 3 h | MEDIO | `main` (index.html, script.js) | manual | **LISTA** | |
| 06 | Rendimiento y equilibrio del almacén de problemas | tareas/tarea-06-almacen-problemas.md | 05 LISTA | 1 h (queda) | MEDIO | `main` + `entrenamiento/` | manual | **LISTA** | |
| 07 | Interfaz de «Editar tablero» (§1, §4, §5) | tareas/tarea-07-editar-tablero-ui.md | 05 LISTA | 4 h | MEDIO | `main` (7 ficheros de UI) | manual | **LISTA** | |
| 08 | Verificación en navegador de todo lo publicado | tareas/tarea-08-verificacion.md | 05 y 07 LISTAS | 2 h | MEDIO | salidas/08-verificacion/ | manual | **LISTA** | |
| 09 | Limpieza de restos y duplicados | tareas/tarea-09-limpieza.md | 2 firmas en autorizaciones.md (YA firmadas) | 1 h | BAJO | reparto/_papelera/ | manual | **LISTA** | |
| 10 | Aplicar los resultados de la ronda 15 del entrenamiento | tareas/tarea-10-ronda-15.md | 03 y 04 LISTAS | 2 h | MEDIO | `main` (variants.js, PDF de valores) | manual | **LISTA** | |
| 11 | Ayuda y reglas adaptadas a cada modalidad (sin reglas de peón donde no hay peones) | tareas/tarea-11-ayuda-por-modalidad.md | ninguna | 1 h | MEDIO | `main` (index.html, script.js — solo la ayuda) | manual | **LISTA** | |
| 12 | Problemas bien planteados: mínimo real de jugadas y todas las soluciones admitidas | tareas/tarea-12-problemas-bien-planteados.md | ninguna | 3 h | MEDIO | `main` (problemas.js, problemas-ui.js, crear-problema.js) + `entrenamiento/` | manual | **LISTA** | |
| 13 | La IA no captura gratis en las modalidades PPT | tareas/tarea-13-ia-modalidades-ppt.md | 03 sin reclamo vivo | 6 h (subida) | MEDIO | `main` (ai.js, ai-async.js, test-ia-rps.js) | manual | **LISTA** | |
| 14 | Cosechar problemas de partidas ordenador contra ordenador | tareas/tarea-14-cosecha-de-partidas.md | 12 LISTA | 4 h | MEDIO | `entrenamiento/` (y problemas.js si exporta) | manual | **LISTA** | |
| 15 | `editor.html` no funciona sin conexión (desajuste `?v=N` con `sw.js`) | tareas/tarea-15-editor-offline.md | ninguna | 1 h | MEDIO | `main` (editor.html, sw.js) | manual | **LISTA** | |
| 16 | Dos reyes nunca adyacentes en las modalidades -rey (K→K en `capturesConRey`) + dorado de dekle | tareas/tarea-16-reyes-nunca-adyacentes.md | 13 LISTA | 1,5 h | MEDIO | `main` (variants.js — solo la entrada K de la matriz; test-ia-rps.js) | manual | **LISTA** | |
| 17 | Arena de motor A/B para rps-rey y rpsls-rey (arnés + parametrización RPS_CFG) | tareas/tarea-17-arena-motor.md | 16 LISTA | 3 h | MEDIO | `entrenamiento/arena-motor.js` + `main` (ai.js, solo parametrización) | manual | **LISTA** | |
| 18 | Candidato 1 en arena: pesos de amenaza (0.1/0.3 vs 0.2/0.6 vs 0.05/0.15) | tareas/tarea-18-arena-pesos-amenaza.md | 17 LISTA | 5 h | MEDIO | `main` (ai.js, constantes de amenaza) + `entrenamiento/` | manual | PENDIENTE | |
| 19 | Candidato en arena: prima de invencibilidad sobre el modelo aditivo | tareas/tarea-19-arena-invencibilidad.md | 21 LISTA (y que la proporcional NO haya entrado) | 5 h | MEDIO | `main` (ai.js, término nuevo) + `entrenamiento/` | manual | BLOQUEADA | |
| 20 | Candidato en arena: quiescencia con jugadas tranquilas (arreglo de fondo de la 13) | tareas/tarea-20-arena-quiescencia.md | 19 LISTA, o 21 si la 19 quedó sin objeto | 8 h | ALTO | `main` (ai.js, quiesce) + `entrenamiento/` | manual | BLOQUEADA | |
| 21 | Candidato en arena: evaluación PROPORCIONAL (media geométrica de cocientes; idea de Juan Luis) | tareas/tarea-21-evaluacion-proporcional.md | 18 LISTA | 8 h | MEDIO | `main` (ai.js, evaluación tras bandera) + `entrenamiento/` | manual | BLOQUEADA | |

Las tareas 11-14 entraron el 2026-08-25 a partir de los cuatro problemas y la
sugerencia (cosecha) reportados por Juan Luis; el porqué del corte, en
`hechos/incidencias/s-20260824T233011-d4d13c52.md` y en `proyecto.md`.

**Libre ahora mismo: la 18 (MEDIO), sin reclamo; detrás, la cadena en serie va
18 → 21 → 19 → 20** (recableada el 2026-08-26 al entrar la 21: la evaluación
proporcional de Juan Luis va antes que la prima y que la quiescencia, porque si gana
en arena la 19 pierde su objeto —la prima está dentro— y la 20 cambia de premisa; las
fichas de la 19 y la 20 llevan su comprobación barata). Todas comparten ai.js y cada
candidato se mide contra el vigente que dejó el anterior, con p<0.05. Recordatorio
del signo: elo(A-B) POSITIVO = el candidato PIERDE. Las tandas de arena de esta
cadena están expresamente autorizadas (máx. 2 procesos node, segundo plano). Los
criterios de Juan Luis, en `hechos/notas/s-20260825T093251-fde516e1.md`.

**La 17 quedó LISTA el 2026-08-26T11:49Z** (main = `74ca9d9`, sesión
`s-20260826T095832-0470517d`, su segunda tarea seguida): ya hay con qué medir. Los ocho
pesos `RPS_*` de `ai.js` pasan de constantes sueltas a `RPS_DEFAULTS` (congelado) +
`RPS_CFG` (activo), que `rpsAplicaCfg()` fija al entrar en `chooseAiMove()` y
`evaluateRps()` — por ahí y no como un parámetro más porque `rpsValor()`, `orderMoves()`
y `orderSearchMoves()` NO reciben `cfg`, y pasárselo obligaría a tocar el núcleo de
búsqueda. **Ningún valor por defecto cambia**: la corrida completa de `test-ia-rps.js`
sale idéntica LÍNEA POR LÍNEA a la de antes, salvo el bloque nuevo que prueba la
parametrización. `cfg.rps` entra en `cfgSig` (sin eso las dos ramas de una tanda
compartirían tabla de transposición y medirían ruido — ya pasó con la escalera 5 vs 6,
20 elo falsos), y una clave mal escrita ABORTA en vez de medir dos motores iguales en
silencio. `entrenamiento/arena-motor.js` no reimplementa la arena: **lanza `arena.js`**
y resume con `elo.js`, así que hereda aperturas emparejadas, colores invertidos,
adjudicación diferida y reanudación, y las medidas son comparables con las de las tareas
03 y 10. Escribe el veredicto con todas las letras («el candidato GANA/PIERDE/EMPATA»),
porque el signo de `elo(A−B)` ya costó el bug de trigonal. **Tandas de humo (A contra A,
16 partidas)**: `rps-rey` elo −44 [−175, +76] p=0,472; `rpsls-rey` elo +66 [−43, +190]
p=0,237 — el intervalo incluye el 0 en las dos, el arnés no favorece a ningún asiento.
**Coste medido, para dimensionar las tandas de 18-21**: 50-58 s por partida a nivel 4
compartiendo CPU (61-71 partidas/hora por proceso) y 25 s a solas; con 2 procesos y la
máquina libre, contar 200-280 partidas/hora, o sea 1-2 h por tanda de 200 partidas.
Detalle y modo de uso en `hechos/terminadas/17--s-20260826T095832-0470517d.md`.

**Hallazgo de esa tarea, ya arreglado: `test-worker.js` llevaba probando `salas` nueve
veces con nueve nombres distintos.** `setVariant()` no crea casillas nuevas, REESCRIBE
`cell.leaps`/`cell.rays` sobre los mismos objetos del grafo, y el test guardaba
`CELL_MAP` —referencia viva— para las nueve modalidades antes de usarlas. En las
modalidades PPT los tipos `O/A/T` no están en las tablas de `salas`, así que
`pseudoMoves()` caía a su último caso, el del peón: el worker respondía con un avance
doble de peón jugado con una tijera. Viejo (falla igual en `07d6265`) y **ajeno al
worker del navegador**, donde `CELL_MAP` viaja clonado. Las nueve modalidades pasan
ahora, y las cuatro de PPT se prueban de verdad por primera vez. Aviso general que deja:
cualquier guion que guarde `CELL_MAP`, `CELLS` o una casilla y luego llame a
`setVariant()` tiene el mismo agujero. Detalle en
`hechos/incidencias/s-20260826T095832-0470517d.md`.

**La 16 quedó LISTA el 2026-08-26T10:55Z** (main = `3ac4c3a`, sesión
`s-20260826T095832-0470517d`): en las modalidades `-rey`, los dos reyes ya no pueden
quedar adyacentes, como en el ajedrez clásico. Mecanismo elegido por Juan Luis y
aplicado tal cual: **la matriz `capturesConRey` declara que 'K' captura a 'K'**, un
solo cambio de una línea en `variants.js`. Basta porque `attacks()`/`isAttacked`
(`rules.js`, la vía que ve el jugador) e `isAttackedFast` (`ai.js`, la vía de búsqueda)
filtran los ataques de las saltadoras por `canCapture()` —el filtro que añadió
`6dcc509`—, así que la casilla vecina al rey rival pasa a contar como atacada. La
captura K×K nunca llega a ejecutarse. Comprobado contra el código de antes en las dos
modalidades: las 2 casillas compartidas por los dos reyes eran legales y ahora no lo
son, en `legalMoves` **y** en `genMoves`, sin perder ninguna de las otras 4 jugadas del
rey. El caso de regresión de `rpsls-rey` no necesitaba cambio: las cuatro partidas
sembradas y las 6 del match salen idénticas con y sin la regla. Prueba nueva («Reyes
nunca adyacentes», 10 aserciones) y **dorado de `dekle` remedido**, que estaba en rojo
permanente desde `56917bf` (tarea 10); al regenerar, solo cambió `dekle`. Las tres
pruebas de la ficha, en verde completo. Detalle en
`hechos/terminadas/16--s-20260826T095832-0470517d.md`. Suelto para Juan Luis: los
textos de ayuda `RPS_HELP.K` y las `note` de las modalidades `-rey` siguen diciendo que
el rey captura cualquier pieza rival, sin mencionar la restricción nueva — fuera del
alcance de esa ficha, retoque de dos frases si lo quiere.

**La 13 quedó A MEDIAS el 2026-08-26T01:43Z** (main = 6dcc509, sesión
`s-20260825T090706-b85c3e30`): dos bugs reales arreglados y commiteados. (1)
`orderMoves`/`orderSearchMoves`/`quiesce` ordenaban y podaban capturas en las
modalidades PPT con los valores PLANOS de la modalidad (todo a 100) en vez del valor
dinámico real (`rpsValor`); `quiesce()` podaba por diferencia con ese mismo plano, así
que descartaba capturas que en realidad valen más de 100. Arreglado con
`rpsDynValues()` nueva. (2) `isAttackedFast` no aplicaba `canCapture()` a los ataques
de piezas saltadoras: en las modalidades -rey, un rey rival adyacente se contaba como
jaque aunque K no puede "capturar" a K (la única excepción de `capturesConRey`), así
que `genMoves` rechazaba jugadas legales del rey. Bug preexistente, no de esa sesión.
`test-modalidades.js` y `test-rps.js` en verde completo; `test-ia-rps.js` en verde
salvo `dekle` en la regresión clásica, que es ajeno (el commit `56917bf` de la tarea 10
cambió los valores de dekle y dejó desactualizado el dorado de esa prueba).

**La 13 quedó LISTA el 2026-08-26T04:30Z** (main = `bb3c534`, sesión
`s-20260826T022659-6a71f33e`, relevando el reclamo abandonado de arriba): el síntoma
central —capturas gratis ignoradas en posiciones muy pobladas— **mitigado, no
eliminado de raíz**. Diagnóstico confirmado con un barrido de profundidad en una
posición real (ply 16, 40 piezas): con los pesos originales de amenaza
(`RPS_AMENAZA=0.2`, `RPS_AMENAZA_COLGADA=0.6`) capturar gana en profundidad 1, 2, 3 y
5, pero se invierte justo en profundidad 4 (donde cae el presupuesto de nodos real de
los niveles altos) por solo 2 puntos. Bajando esos pesos a la mitad (0.1/0.3) la
inversión desaparece en las seis profundidades probadas. Verificado en juego real
(autojuego nivel 8, semilla 100, 220 jugadas): **147/220 capturas gratis ignoradas con
los pesos originales → 57/220 con la mitad (61% menos)**. Aplicado a `ai.js`.
**La causa de fondo sigue sin arreglar**: `quiesce()` solo persigue capturas, nunca
las jugadas tranquilas que cambian mucho el término de "amenaza", así que su
variación entre profundidades nunca se verifica tácticamente — de ahí la oscilación.
Arreglarlo de raíz (extender `quiesce()` a jugadas que cambien mucho la
amenaza/caza) es un cambio en el núcleo de búsqueda compartido por TODAS las
modalidades: riesgo real de romper algo, se mide con la arena, **pide visto bueno
de Juan Luis antes de tocarlo** — no es tarea de esta sesión. Detalle completo en
`hechos/terminadas/13--s-20260826T022659-6a71f33e.md` (y el diagnóstico previo en
`hechos/fallos/13--s-20260825T090706-b85c3e30.md`).

La 03 quedó LISTA el 2026-08-25T01:55Z (main = 74cbb1a): la segunda tanda de arena
(96 partidas, con el visto bueno de Juan Luis) midió las 6 candidatas pendientes y
todas salieron mal (69-94 % tablas); `rps` y `rpsls` **se quedan con `base`**, la mejor
de la tabla en ambas, y `variants.js` no cambia (más tarde sí lo tocó la 10, ver abajo).
Decisión razonada, con la tabla completa, en `entrenamiento/rps-posiciones-resumen.md`.
Queda abierta para Juan Luis una cuestión de diseño que NO es de posiciones: en las
modalidades sin rey ninguna partida termina de forma natural (siempre se llega al tope
de jugadas); arreglarlo sería tocar las condiciones de victoria — tarea nueva si él la
pide.

**La 09 quedó LISTA el 2026-08-25T08:59Z** (sid `e6fe09b4`, relevando el reclamo
caducado de `b78fd0ac`): 11 ficheros retirados a `reparto/_papelera/` (8 de depuración
del editor, 3 duplicados « 2» idénticos). Un duplicado más,
`scripts/nueva-sesion 2.sh`, tenía un cambio real de implementación (`git checkout -b`
sobre el árbol compartido, justo la operación que prohíbe `proyecto.md`) y se dejó para
que Juan Luis decidiera; **decidido y cerrado el mismo día** por la sesión coordinadora
`s-20260825T093251-fde516e1`: Juan Luis firmó autorización nueva y el fichero pasó
también a `_papelera/` (no era una variante válida a conservar). Detalle en
`hechos/terminadas/09--s-20260825T085457-e6fe09b4.md` y
`hechos/incidencias/s-20260825T093251-fde516e1.md`.

**La 10 quedó LISTA el 2026-08-25T12:29Z** (main = 56917bf). De los seis candidatos de
la ronda 15 (dos por modalidad × tres modalidades sin medir), solo uno gana en la
arena: `dekle`/`all` (elo(vigente-candidato) = -28 [-56, -0], p=0.046 — al límite, pero
significativo con el mismo criterio que usó el resto del proyecto). Entra: `N298 B320
U378 R392 Q750`, movilidad 7.63. Ni `dekle`/`mat` ni ningún candidato de `salas-1998`
fueron significativos: sin cambios ahí.

**Hallazgo importante, ya corregido:** `trigonal` llevaba desde el commit `c388624c`
(2026-08-04, anterior a este reparto) con el candidato `all` de esa misma ronda 15
aplicado en `variants.js` **pese a haber perdido** en su propia arena — el commit
interpretó `elo(A-B): 76 [48, 104]` (A=vigente por delante) como que el candidato ganaba
+76 elo, cuando significa lo contrario: A anotó 60.7% de 424 partidas, el candidato
perdió por 76 elo. Revertido a los valores a ojo (`P100 N300 B400 R500 Q900`, movilidad
4). Tres semanas jugando con un alfil, una torre y una dama de Trigonal infravalorados
sin que se notara. PDF regenerado, `valores-origen.json` y la sección de la ronda 15 del
README de `entrenamiento/` actualizados, `node test-modalidades.js` y `node test-rps.js`
en verde. Detalle completo en `hechos/terminadas/10--s-20260825T090655-e89d6030.md` y
`hechos/incidencias/s-20260825T090655-e89d6030.md` (incluye además un aviso sobre
`./instalar-servicio.sh resultados`: lee de un directorio en
`~/Library/Application Support/` que quedó con un corpus más viejo y más pequeño que el
que se acabó commiteando al repo — para decidir se usaron siempre los ficheros de
`entrenamiento/r15/` del repo, re-corriendo `node analiza.js` sobre ellos).

**La 14 quedó LISTA el 2026-08-25T18:20Z**: `entrenamiento/cosecha-problemas.js`
(nuevo, node, sin DOM) juega partidas motor contra motor y convierte en problema
cualquier posición real donde el que mueve pueda forzar mate, ganar una pieza sin
recaptura o tablas, reutilizando el mismo verificador Y/O del generador y, antes de
guardar, el mismo camino que un `.json` importado (`probVerificaForzado`, tarea 12).
Tanda real: 15 partidas modalidad `salas`, 1380 jugadas, **89 problemas nuevos en
`entrenamiento/problemas-cosechados.json`, 0 rechazados** en la reverificación
completa (85 fácil, 4 medio). `node entrenamiento/prueba-problemas.js` en verde
(63 OK, 0 mal) como regresión del generador existente. **No toca `problemas-ui.js`,
`crear-problema.js`, `index.html` ni `script.js`** (prohibido por la ficha): el
almacén cosechado existe pero todavía no está enganchado al almacén en vivo del
navegador — queda como tarea futura, a decidir por Juan Luis. El primer intento del
script se disparó (>100 min en una sola partida: un filtro barato copiado del
generador no distingue "pieza atacada" de "pieza sin defender" sobre posiciones
reales) y se corrigió antes de la tanda real; detalle en
`hechos/terminadas/14--s-20260825T090854-1758bb65.md`, en las «Trampas conocidas»
de `tareas/tarea-14-cosecha-de-partidas.md` y en la incidencia de abajo.

La ronda 14 del entrenamiento (curva de temperatura) **está completa** en disco (6
pares, incluido `t_poda`), aunque una memoria del proyecto de hace tres semanas la daba
«a medias». La tarea 10 no la tocó a propósito (no era su encargo); queda para que
decida Juan Luis si se aplica.

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

La 12 quedó LISTA el 2026-08-25T02:38Z (main = 96af0f6): los dos síntomas reportados
—mate en N con mate en menos, y jugada alternativa dada por mala— no se reprodujeron
en el código actual (generador, creador manual y `probJuzga` ya buscaban mínimo y
reverificaban en fresco por diseño; >500 problemas frescos probados sin fallos). Sí
se encontró y arregló un desajuste real de presupuesto entre crear-problema.js
(verificaba con 1 200 000 nodos) y la reverificación en partida (`PROB_TOPE_VIVO`,
400 000 → ahora igualados a 1 200 000), que podía dejar sin poder rejugarse un
problema manual caro de demostrar. Añadida `probVerificaForzado` para la importación
de `.json` externos. Detalle en `hechos/notas/s-20260824T235458-3ccd1290.md` y
`hechos/terminadas/12--s-20260824T235458-3ccd1290.md`.

## Registro de finalizaciones

Derivado de `hechos/terminadas/`. Una línea por fichero, más reciente arriba.

Formato: `LISTA · tarea NN · AAAA-MM-DD HH:MM · sid · recuento · salida`

- LISTA · tarea 13 · 2026-08-26 04:30 · s-20260826T022659-6a71f33e · RPS_AMENAZA 0.2→0.1, RPS_AMENAZA_COLGADA 0.6→0.3; barrido de profundidad en posición real (ply16) sin inversión en 6 profundidades (antes se invertía en la 4); autojuego nivel 8/220 jugadas: 147→57 capturas gratis ignoradas (61% menos); test-modalidades.js y test-rps.js en verde, test-ia-rps.js en verde salvo el dekle ajeno (tarea 10); causa de fondo (cobertura de quiescencia) diagnosticada, sin arreglar, pendiente de visto bueno · main = bb3c534
- LISTA · tarea 14 · 2026-08-25 18:20 · s-20260825T090854-1758bb65 · entrenamiento/cosecha-problemas.js nuevo (script + almacén); tanda real de 15 partidas modalidad salas (1380 jugadas): 89 problemas nuevos, 0 rechazados en la reverificación completa (85 fácil, 4 medio); node entrenamiento/prueba-problemas.js 63 OK/0 mal · entrenamiento/problemas-cosechados.json
- LISTA · tarea 10 · 2026-08-25 12:29 · s-20260825T090655-e89d6030 · dekle entra (candidato "all" de la ronda 15, elo(A-B)=-28 [-56,-0] p=0.046: N298 B320 U378 R392 Q750, movilidad 7.63); trigonal revertido a valores a ojo (bug de signo del commit c388624c del 2026-08-04, que aplicó un candidato que en realidad perdió -76 elo); PDF regenerado, valores-origen.json y README de entrenamiento/ actualizados; node test-modalidades.js y node test-rps.js en verde · main = 56917bf
- LISTA · tarea 09 · 2026-08-25 08:59 · s-20260825T085457-e6fe09b4 · 11 ficheros retirados (8 depuración del editor, 3 duplicados « 2» idénticos), 1 duplicado « 2» con cambios reales → incidencia; papelera lista para vaciar · reparto/_papelera/movidos-s-20260825T085457-e6fe09b4.ok-s-20260825T085457-e6fe09b4.md + incidencia s-20260825T085457-e6fe09b4-duplicado.md
- LISTA · tarea 12 · 2026-08-25 02:00 · s-20260824T235458-3ccd1290 · 4 ficheros modificados (problemas.js, crear-problema.js, problemas-ui.js, entrenamiento/prueba-problemas.js) + 4 nuevos en entrenamiento/; ningún fallo reproducido en el código actual (>500 problemas frescos, 0 atajos, 0 alternativas rechazadas); arreglado el desajuste de presupuesto crear-problema.js/partida en vivo (`PROB_TOPE_VIVO` 400 000→1 200 000); `probVerificaForzado` nueva, enganchada a la importación; prueba-problemas.js con tercera comprobación (alternativa vía `probJuzga`), 71 OK/0 mal · main = 96af0f6
- LISTA · tarea 03 · 2026-08-25 01:55 · s-20260824T233011-d4d13c52 · 96 partidas nuevas de arena (6 candidatas × 16, 0 fallos); las 6 malas (69-94% tablas); decisión con números: `rps` y `rpsls` mantienen `base` (mejor de la tabla en ambas), `variants.js` sin cambios; resumen actualizado; 2 pruebas en verde · main = 74cbb1a (la mitad -rey la cerró s-20260824T214012-f5750bb7 en 53b32e6)
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

- s-20260825T090655-e89d6030 (tarea 10): dos hallazgos. (1) `./instalar-servicio.sh
  resultados` lee de `~/Library/Application Support/ajedrez-triangular-entrenamiento/`,
  que se quedó con un corpus de la ronda 15 más viejo y más pequeño que el que acabó
  commiteado al repo en la tarea 01; para decidir se usaron siempre los ficheros de
  `entrenamiento/r15/` del repo, re-corriendo `node analiza.js` sobre ellos. (2) el
  commit `c388624c` (2026-08-04, anterior a este reparto) aplicó a `variants.js` el
  candidato de Trigonal de la ronda 15 pese a que PERDÍA en su propia arena —confusión
  de signo en `elo(A-B)`—; revertido. Detalle completo en el fichero.
- s-20260825T093251-fde516e1 (coordinadora, banda ALTO): resolvió la decisión pendiente
  de la tarea 09 sobre `scripts/nueva-sesion 2.sh` (no era una variante válida a
  conservar: usaba `git checkout -b` sobre el árbol compartido, la operación prohibida
  por `proyecto.md`). Juan Luis firmó autorización nueva; movido a `_papelera/`.
- s-20260825T090854-1758bb65 (tarea 14): guardó su sid recién generado en un fichero
  genérico de `/tmp` para reutilizarlo entre dos comandos; otra sesión activa en la
  misma máquina sobrescribió ese fichero con el suyo propio entre medias, y el segundo
  comando escribió `hechos/reclamos/10--s-20260825T090706-b85c3e30.md` con un sid que no
  es el autor real. Marcado `ABANDONADA (fichero inválido)` en ese reclamo, sin tocar
  nada más; la tarea 10 siguió con el reclamo válido, abierto antes. Lección para el
  tablón: no guardar el sid en un fichero de `/tmp` con nombre genérico entre dos
  llamadas de shell — ver regla 4 de «Antes de hacer nada», arriba.
- s-20260825T090854-1758bb65 (tarea 14, segunda incidencia): el primer intento del
  script de cosecha se disparó de verdad (>100 min de CPU al 99% en una sola partida
  de prueba, matado a mano). Causa: el filtro barato "pieza a tiro" de `probPosicion`
  no distingue una pieza atacada de una pieza sin defender, y sobre una posición real
  (a diferencia de las que arma el generador) casi cualquier pieza desarrollada está
  "a tiro" de algo; con el tope de nodos del generador (~150 000) cada intento sin
  suerte agotaba el presupuesto entero, y `probSaldoQuieto` (quiescencia) ni siquiera
  cuenta contra ese tope. Arreglado sin tocar `problemas.js`: filtro de pieza
  realmente colgada (sin defensor), tope de cribado bajado a 6000 y un límite de
  RELOJ nuevo de 3 s por jugada de partida. No de código compartido — nada llegó a
  guardarse mal verificado, el almacén cosechado no existía todavía. Detalle en
  `hechos/terminadas/14--s-20260825T090854-1758bb65.md`.
- s-20260825T085457-e6fe09b4-duplicado: `scripts/nueva-sesion 2.sh` no era idéntico al
  original (usaba `git checkout -b` en vez de `git worktree add -b`); dejado sin mover
  por la tarea 09 a la espera de que Juan Luis decidiera. Resuelto por
  `s-20260825T093251-fde516e1`, ver arriba.
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
- s-20260824T235458-3ccd1290: no de código — dos ficheros míos (`tareas/tarea-12-*.md`
  y `hechos/notas/s-20260824T235458-3ccd1290.md`) quedaron commiteados sin querer
  dentro del cierre de la 03 (`74cbb1a`), porque esa sesión hizo `git add reparto/`
  mientras los míos estaban sin commitear ahí dentro. Contenido correcto (verificado
  con `git diff HEAD`, cero diferencia), nada que corregir. Aviso: «`git add
  reparto/` es seguro» no evita colar ficheros de OTRA tarea a medio escribir cuando
  hay varias sesiones dentro de `reparto/` a la vez — sí evita colar ficheros de
  fuera. Con la disciplina de un solo escritor por nombre de fichero el daño es nulo,
  pero conviene saberlo.

## El reparto está completo — qué queda para que decida Juan Luis

Las 15 tareas están LISTA. Ninguna sesión nueva encontrará nada que reclamar en este
tablón. Lo que sigue no son tareas del reparto, son los cabos sueltos que cada tarea
fue dejando explícitamente para una decisión suya — candidatos a un reparto nuevo o a
un encargo directo, no algo que ninguna sesión deba iniciar por su cuenta:

- ~~Arreglo de fondo de la 13~~ → **ya es la tarea 20** (2026-08-26): Juan Luis fijó
  la vía de decisión (bandera + arena, p<0.05); deja de ser un cabo suelto.
- **Enganchar el almacén cosechado de la 14** (`entrenamiento/problemas-cosechados.json`,
  89 problemas) al almacén en vivo de `problemas-ui.js`, y/o repetir la cosecha en las
  otras modalidades PPT. Ver `hechos/terminadas/14--s-20260825T090854-1758bb65.md`.
- ~~Condiciones de victoria en las modalidades sin rey~~ → **APARCADO** (2026-08-26):
  Juan Luis decidió dejar aparte `rps` y `rpsls` por poco jugables; ni se arreglan ni
  se tocan. Si algún día quiere ocultarlas del selector de la app, sería un encargo
  nuevo.
- **Ronda 14 del entrenamiento** (curva de temperatura, 6 pares): completa en disco,
  sin aplicar todavía a propósito — la 10 no la tocó por no ser su encargo.
- `stash@{0}` de respaldo de la reconciliación (tarea 04): ya no hace falta, libre
  para que Juan Luis lo tire cuando quiera.
- ~~`scripts/nueva-sesion 2.sh`~~: YA RESUELTO el 2026-08-25 — Juan Luis firmó la
  autorización y la coordinadora lo movió a `reparto/_papelera/` (ver
  `hechos/incidencias/s-20260825T093251-fde516e1.md`). No queda nada pendiente de él;
  la papelera entera la vacía Juan Luis desde el Finder cuando quiera.
- **Criterio fijado por Juan Luis para el arreglo de fondo de la 13** (2026-08-26):
  renunciar a una captura gratis por una jugada estratégica puede ser legítimo en
  PPT; el arreglo debe hacer honesta la comparación (verificar la ganancia de la
  jugada tranquila igual de bien que la captura), no imponer «captura siempre».
  Nota completa en `hechos/notas/s-20260825T093251-fde516e1.md`.
