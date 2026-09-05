# Tarea 23 · Verificar si la IA sigue renunciando a capturas gratis en PPT tras el acoso al rey rival

Creada: 2026-09-05 (sesión s-20260905T113829-6fd2b04e, encargo directo de Juan Luis:
«comprobar si está solucionado el problema de que el ordenador renuncia a muchas
capturas gratis en los modos PPT»)
Precondición: 22 LISTA (ya lo está) · Disparo: MANUAL
Duración esperada: 2 h · Banda de modelo: MEDIO
Salida (dueña exclusiva): `entrenamiento/` (informe de la verificación) — **esta tarea
NO toca `ai.js` ni ninguna otra fuente**; si concluye que sigue roto, el arreglo de
fondo ya tiene dueño (ver abajo)

## Antes de empezar
1. Lee `reparto/proyecto.md` y `reparto/_ESTADO.md` enteros, y lista `reparto/hechos/`
   (reclamos, terminadas, incidencias) comparándolo con `git log`.
2. `date -u`, genera tu `sid` en el mismo comando (no lo guardes en un fichero
   genérico de `/tmp` — ver incidencia `s-20260825T090854-1758bb65`).
3. Reclama con `hechos/reclamos/23--<sid>.md` (`caduca:` = ahora + 4 h), lanza
   `sleep 30 && ls reparto/hechos/reclamos/` en segundo plano y cede si otra sesión
   llegó antes.
4. Comprobación barata: si ya existe `hechos/terminadas/23--*`, nada que hacer.

## AVISO CRÍTICO DE MÉTODO — lee esto antes de medir nada

Al listar `hechos/` para montar esta tarea apareció una nota que ninguna sesión
había integrado en el tablón: `hechos/notas/s-20260826T093311-622dce37.md`
(2026-08-26, sin reclamo, sin terminada — Juan Luis pidió esa medición aparte y la
sesión no tocó el estado de la 13 a propósito). Su hallazgo, si se confirma,
invalida el propio contador que usó la tarea 13 y que este fichero te iba a pedir
que reutilizaras:

**El contador «capturas gratis ignoradas» no mide fuerza de juego en PPT y está
sesgado en contra del motor.** Entre el 75% y el 93% de esas capturas «gratis»
**pierden** material en la moneda real del juego, porque el valor de las piezas es
dinámico (`rpsValor`): comerte una presa abarata a todos tus depredadores de ese
tipo a la vez. Bajar los pesos de amenaza (lo que hizo la 13) empuja al motor
precisamente hacia esas capturas que pierden valor, y esa medición **nunca se
validó en arena** — se validó solo contra el propio contador sesgado. Detalle
completo, con las tres mediciones y las hipótesis H1-H5/propuestas P1-P4, en
`entrenamiento/capturas-gratis/README.md` (carpeta nueva de esa sesión, con sus
guiones y datos — **existe en el árbol pero sigue SIN COMMITEAR** a propósito,
para que Juan Luis decida si entra; trátala como solo lectura, no la commitees tú).

**Por eso esta tarea NO puede limitarse a repetir el conteo de capturas gratis
ignoradas y compararlo con el 57/220 de la 13** — haría exactamente la medición
que esa nota dice que es circular. Lo que de verdad hace falta:
1. Lee `entrenamiento/capturas-gratis/README.md` entero antes de diseñar tu
   medición.
2. El árbitro no circular, que la propia nota señala y que ya usan las tareas
   03/10/17-22 de este reparto, es la **fuerza de juego medida en arena**
   (`entrenamiento/arena.js` + `elo.js`), no un contador de patrones sobre el
   árbol de búsqueda. Si vas a concluir algo sobre si el problema está resuelto,
   apóyalo en partidas jugadas de verdad (autojuego o arena, con el motor vigente
   de la 22) donde el bando que renuncia a una captura acaba perdiendo la
   partida o quedando peor — no en si el contador subió o bajó.
3. Si igualmente quieres reportar el conteo bruto de «capturas gratis ignoradas»
   con el motor de hoy (es rápido y da una cifra comparable con el pasado), hazlo,
   pero etiquétalo explícitamente como **indicio, no conclusión** — y dilo así en
   el informe, citando esta nota.
4. Dile a Juan Luis en tu aviso de cierre que existe `entrenamiento/capturas-gratis/`
   sin commitear desde el 26-8-2026 con este hallazgo, por si quiere decidir ya si
   entra al repo — no es tu decisión, pero nadie se lo ha dicho todavía.

## Contexto — por qué se pide esto ahora
El síntoma («el ordenador no come aunque la captura le salga gratis, en modalidades
PPT muy pobladas») lo diagnosticó y mitigó la tarea 13
(`hechos/terminadas/13--s-20260826T022659-6a71f33e.md`, main = `bb3c534`): bajar
`RPS_AMENAZA` 0.2→0.1 y `RPS_AMENAZA_COLGADA` 0.6→0.3 quitó la inversión de signo en
un barrido de profundidad y redujo las capturas gratis ignoradas de 147/220 a 57/220
en autojuego (61% menos) — **mitigado, no eliminado**. La causa de fondo que quedó
señalada: `quiesce()` (ai.js) solo persigue capturas, nunca las jugadas tranquilas que
cambian mucho el término de amenaza, así que su variación entre profundidades nunca
se verifica tácticamente. El arreglo de raíz de eso **ya es la tarea 20** (banda ALTO,
extender la quiescencia), con el visto bueno de Juan Luis pendiente de premisa —no la
toques, no es el objeto de esta tarea—.

Desde ese diagnóstico (2026-08-26) la evaluación PPT ha cambiado dos veces más y las
dos SON el motor vigente hoy:
- Tarea 21: evaluación PROPORCIONAL medida y RECHAZADA por falta de iniciativa (queda
  tras bandera, apagada).
- Tarea 22 (`hechos/terminadas/22--s-20260826T180921-40da01d4.md`, main = `84dcac6`):
  PROPORCIONAL + ACOSO AL REY RIVAL — gana 346 elo al aditivo y **queda vigente por
  defecto** en `ai.js` (`RPS_DEFAULTS`: `PROPORCIONAL=1`, `PROP_ACOSO=10`,
  `PROP_ACOSO_REY=10`, `PROP_PESOS=1`). El propio informe de la 22 dice que en
  autojuego con 8 piezas de ventaja el modelo aditivo hacía CERO capturas; el modelo
  con acoso sí remata (t22-conversion pasa de 0 a 3/3 remates). Commits posteriores
  (`7cf7f3c`, `d00403c`, `5334e32`) no tocan la evaluación: son mejoras de teselación
  y service worker, fuera de esta pregunta.

Es decir: el motor con el que se midió el síntoma original (147/220) **ya no es el
motor vigente**. Esta tarea mide el síntoma de nuevo con el motor de hoy, en vez de dar
por buena una medida de hace diez días sobre un motor que ya no se juega.

## Qué hay que hacer
1. Diseña la medición como dice el aviso de arriba: el árbitro es la fuerza de juego
   (arena/autojuego con resultado real), no el contador de la tarea 13. Si además
   quieres el conteo bruto de «capturas gratis ignoradas» para tener un número
   comparable con el 57/220 de la 13 (mira
   `hechos/terminadas/13--s-20260826T022659-6a71f33e.md` para la semilla y el
   método exacto), inclúyelo como indicio aparte, nunca como la conclusión.
2. Repite la medición en las cuatro modalidades PPT vigentes hoy (PPTR, PPTLSR y sus
   dos Murallas de papel — el catálogo cambió el 2026-08-26, ver nota de `43725012`
   en `_ESTADO.md`), no solo en la que usó la 13, porque el acoso al rey rival puede
   comportarse distinto según la posición inicial.
3. Compara con el 57/220 de la tarea 13 solo como referencia histórica, sabiendo que
   ese número puede estar sesgado (ver el aviso de arriba). Tres desenlaces posibles, y
   los tres son un cierre válido de esta tarea (no hace falta que el problema
   desaparezca para terminar bien):
   - **Ya no hay capturas gratis ignoradas** (o el número es marginal, p.ej. <5%):
     escribe la conclusión con los números, y dilo en el tablón — puede que la 20
     pase a SIN OBJETO, igual que le pasó a la 19 con la 22; esa decisión es de Juan
     Luis, tú solo la propones con los datos.
   - **El número mejoró pero sigue habiendo casos** (probable, porque el acoso ataca
     la falta de iniciativa, no la cobertura de quiescencia que diagnosticó la 13):
     deja el número nuevo y confirma que el diagnóstico de fondo (quiesce no ve
     jugadas tranquilas) sigue vigente — la 20 sigue siendo el arreglo que hace falta,
     con este dato nuevo como motivación actualizada.
   - **El número empeoró**: repórtalo igual, con las partidas que lo prueben; sería un
     hallazgo importante sobre una interacción entre el acoso y la elusión de
     capturas que nadie ha medido todavía.
4. Si al reproducir encuentras que el guión de medición de la 13 ya no existe o no
   corre tal cual con el motor de hoy (nombres de modalidad cambiados por el catálogo
   nuevo del 2026-08-26), adáptalo — es lo esperable, no una tarea mal cortada.

## Datos de entrada
- `entrenamiento/capturas-gratis/README.md` y su carpeta — SOLO LECTURA, sin
  commitear a propósito: léelo antes de nada, ver el aviso de arriba.
- `ai.js` — SOLO LECTURA: la evaluación y el motor de búsqueda vigentes.
- `hechos/terminadas/13--s-20260826T022659-6a71f33e.md` y
  `hechos/fallos/13--s-20260825T090706-b85c3e30.md` — método y números originales.
- `hechos/terminadas/22--s-20260826T180921-40da01d4.md` — motor vigente y sus
  constantes.
- `tareas/tarea-20-arena-quiescencia.md` — el arreglo de fondo, para no invadirlo.
- `variants.js` — SOLO LECTURA: catálogo de modalidades PPT vigente.

## Salida esperada
- `entrenamiento/verificacion-capturas-gratis-<sid>.md` (o `.json` si el conteo es
  programático): metodología, semillas, número de capturas gratis ignoradas por
  modalidad, comparación con el 57/220 de la 13, y la conclusión de cuál de los tres
  desenlaces de arriba aplica.
- Marcador `entrenamiento/verificacion-capturas-gratis-<sid>.md.ok-<sid>` al lado.

## Cómo saber que ha terminado
El informe existe con un número concreto de capturas gratis ignoradas por cada una de
las cuatro modalidades PPT vigentes, comparado con el número de la tarea 13, y una
recomendación explícita sobre si la 20 sigue haciendo falta.

## Al terminar
Cierre estándar: `hechos/terminadas/23--<sid>.md`, `CERRADA` en el reclamo, regenerar
`_ESTADO.md` (recopiando la banda), `git add reparto/` + commit + push, avisar a Juan
Luis con el número y la recomendación.

## Trampas conocidas
- El catálogo de modalidades PPT cambió el 2026-08-26 (`rps`/`rpsls` retiradas,
  entran PPTR/PPTLSR y las Murallas de papel): usa los ids de hoy, no los que cita la
  ficha de la 13 literalmente.
- El aviso de método de la cadena 17→22: si más del ~15% de las partidas de una tanda
  terminan en «tope» de jugadas, el veredicto por adjudicación de material puede salir
  invertido — sube `--max-plies` si mides con arena.js en vez de autojuego suelto.
- Git tarda 1-3 minutos por orden; lanzarlas en segundo plano.

## Prohibido
- Tocar `ai.js` (evaluación o búsqueda): si el diagnóstico pide cambiar `quiesce()` o
  cualquier constante, eso es la tarea 20, no esta. Esta tarea mide, no arregla.
- Relanzar torneos masivos de arena sin encargo expreso: un autojuego suelto de unas
  pocas partidas por modalidad basta para contar el síntoma.
