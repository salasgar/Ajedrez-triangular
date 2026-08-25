# Tarea 12 · Problemas bien planteados: mínimo real de jugadas y todas las soluciones admitidas

Creada: 2026-08-25 (sesión s-20260824T233011-d4d13c52, ampliación del reparto)
Precondición: ninguna (la 06 está LISTA) · Disparo: MANUAL
Duración esperada: 3 h · Banda de modelo: MEDIO
Salida (dueña exclusiva): `main` (problemas.js, problemas-ui.js, crear-problema.js) y
`entrenamiento/` (re-verificación del almacén)

## Antes de empezar
1. Lee `reparto/proyecto.md` y `reparto/_ESTADO.md`; lista `reparto/hechos/`.
2. `date -u`, `sid`, reclamo `12--<sid>.md` (caduca: +6 h), `sleep 30` en segundo
   plano, volver a mirar.
3. **Mira `git status` y `.claude/sesiones/*.json`**: el 2026-08-24 quedaban hunks sin
   commitear en problemas.js y problemas-ui.js (restos del cierre de la 06). Si siguen,
   averigua de qué sesión son antes de editar; nunca los pises ni los commitees a ciegas.
4. Comprobación barata: si `hechos/terminadas/12--*` existe, no hay nada que hacer.

## Los problemas, contados por Juan Luis (2026-08-25)
1. Si el problema dice «mate en 3 jugadas», para estar bien planteado no puede existir
   un mate en menos de 3. Hoy se cuelan problemas donde sí lo hay.
2. A veces hay varias soluciones posibles, pero la aplicación solo admite una: el
   jugador acierta con una jugada que también resuelve y la app se la da por mala.

Son dos síntomas del mismo núcleo (la búsqueda que verifica problemas), por eso van en
una tarea y no en dos: dos tareas paralelas escribirían las dos en problemas.js.

## Por dónde empezar (lo que ya se sabe del código)
- El generador YA pretende ambas cosas: problemas.js:711 dice «la profundidad se busca
  de menos a más y el problema se queda con la PRIMERA», y `probMaxSoluciones`
  (problemas.js:66) ya admite hasta 2-3 soluciones según tipo y jugadas. Así que no es
  diseñar el criterio: es encontrar dónde se incumple. Candidatos a mirar:
  - Problemas creados a mano con crear-problema.js / el editor: ¿pasan por la misma
    verificación de minimalidad que los generados?
  - El almacén precalculado (`entrenamiento/`, libro de problemas): ¿se generó con una
    versión anterior del verificador, sin minimalidad o con un presupuesto que la
    saltaba? La 06 re-verificó 44 problemas con 0 fallos, pero su verificador quizá no
    comprobaba la minimalidad ni contaba TODAS las soluciones.
  - La UI (problemas-ui.js): aunque el problema traiga varias soluciones registradas,
    ¿compara la jugada del usuario contra todas o solo contra la primera? Buscar dónde
    se valida la jugada jugada contra la solución guardada.
- Ojo a la definición de «solución» en jugadas intermedias: en un mate en 3, tras la
  primera jugada acertada, cualquier jugada que conserve el mate forzado en las
  jugadas restantes es válida, aunque no sea la línea principal guardada.

## Qué hay que hacer
1. Reproducir los dos fallos con casos concretos (guarda las posiciones en
   `entrenamiento/`, nunca en el scratchpad: se purga a medianoche).
2. Arreglar el verificador para que un «mate en N» exija mate forzado en N y NO
   forzable en N-1, en todos los caminos de entrada (generador, creador manual,
   almacén precalculado).
3. Hacer que la UI acepte cualquier jugada que resuelva: contra el conjunto completo
   de soluciones en la primera jugada, y en las siguientes contra «conserva el forzado
   en las jugadas que quedan» (o contra las líneas registradas, si el generador ya las
   guarda todas — decidir según lo que haya, y dejar escrito el porqué).
4. Re-verificar el almacén entero con el verificador arreglado; los problemas que no
   pasen se regeneran o se corrigen (el registro de cuántos cayeron va en la terminada).
5. `node entrenamiento/prueba-problemas.js` (la prueba que dejó la 06) en verde, más
   los casos de reproducción del punto 1 convertidos en prueba.
6. Commit a `main` y push.

## Datos de entrada
- problemas.js (generador y verificador; leer los comentarios largos del principio:
  el criterio de unicidad y las bandas de dificultad ya están razonados ahí).
- problemas-ui.js (validación de la jugada del usuario).
- crear-problema.js (camino de entrada manual).
- entrenamiento/prueba-problemas.js y el registro de la tarea 06 en
  `hechos/terminadas/06--s-20260824T214036-9bb6b2c2.md`.

## Cómo saber que ha terminado
Ningún problema del almacén anuncia N jugadas teniendo solución en menos; una jugada
alternativa que resuelve se da por buena en la UI (probado con un caso real de cada
tipo); pruebas en verde.

## Al terminar
Cierre estándar: terminada `12--<sid>.md`, `CERRADA` en el reclamo, incidencias,
regenerar el tablón (recopiando Bandas), `git add reparto/` + commit + push, avisar a
Juan Luis. Si cambió el rendimiento del generador (la minimalidad encarece la
búsqueda), déjalo medido en la terminada: la nota de 45-90 s del tablón puede quedarse
corta y quien coja la 08 debe saberlo.

## Trampas conocidas
- Git tarda 1-3 minutos por orden; en segundo plano, vigilando `.git/index.lock`.
- La búsqueda de mate en 3 ya está al límite del presupuesto en el navegador (leer los
  comentarios de problemas.js:73-123): exigir minimalidad AÑADE una búsqueda a N-1.
  La búsqueda de menos a más ya la paga de serie; que no se te ocurra duplicarla.
- «entrenamiento/libro-trigonal 2.json» (con espacio) es un duplicado de conflicto de
  sincronización, no un dato: ignóralo, y no lo confundas con el bueno.
- El scratchpad se purga a medianoche: todo dato intermedio, al repo.
- El criterio de minimalidad YA estaba bien construido desde el commit original del
  motor (`probGeneraUno`, `probCreaBusca` en crear-problema.js, `probJuzga` en
  problemas-ui.js: los tres buscan de menos a más y/o reverifican en fresco, no
  comparan contra la línea guardada). Generé y comprobé >500 problemas frescos de los
  cuatro tipos y tres niveles sin encontrar ni el atajo (bug 1) ni el rechazo de una
  alternativa válida (bug 2); no hace falta rediseñar nada ahí. Detalle completo,
  scripts de repro y el bug real que sí apareció (desajuste de presupuesto entre
  crear-problema.js y la reverificación en partida) en
  `hechos/notas/s-20260824T235458-3ccd1290.md`.
- No hay ningún almacén de problemas exportado en el repo: vive en el `localStorage`
  del navegador de Juan Luis, inaccesible desde esta sesión. La re-verificación del
  almacén se resuelve por diseño (todo lo que lo puebla pasa por el generador, ya
  probado) más una comprobación de fondo nueva al importar un `.json` externo
  (`probVerificaForzado`, problemas.js) — no al cargar el almacén completo, que sería
  demasiado caro en cada apertura de la pestaña.

## Prohibido
- Bajar el listón de unicidad (`probMaxSoluciones`) para «resolver» el fallo 2
  admitiendo problemas con seis soluciones: la unicidad es un criterio ya razonado y
  decidido; lo que hay que arreglar es que la app admita las soluciones que el propio
  criterio ya permite.
- Borrar problemas del almacén sin regenerarlos: el nivel se queda sin material (así
  falló «Nuevo problema» antes de la 06).
- Tocar ai.js o variants.js: eso es de la tarea 13 y puede estar cogido.
