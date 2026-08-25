# Tarea 14 · Cosechar problemas de partidas ordenador contra ordenador

Creada: 2026-08-25 (sesión s-20260824T233011-d4d13c52, ampliación del reparto)
Precondición: tarea 12 LISTA · Disparo: MANUAL
Duración esperada: 4 h (más las horas de máquina de las partidas, que corren solas)
Banda de modelo: MEDIO
Salida (dueña exclusiva): `entrenamiento/` (script de cosecha y almacén cosechado) y,
si hace falta exportar algo del verificador, `problemas.js` — por eso la precondición:
hasta que la 12 cierre, problemas.js tiene otro dueño.

## Antes de empezar
1. Lee `reparto/proyecto.md` y `reparto/_ESTADO.md`; lista `reparto/hechos/`.
2. Comprueba que la 12 tiene su fichero en `hechos/terminadas/`: la cosecha verifica
   con el verificador que la 12 arregla. Cosechar antes es llenar el almacén de
   problemas mal planteados, que es justo lo que la 12 vino a limpiar.
3. `date -u`, `sid`, reclamo `14--<sid>.md` (caduca: +8 h), `sleep 30` en segundo
   plano, volver a mirar.
4. Comprobación barata: si `hechos/terminadas/14--*` existe, nada que hacer.

## La idea, contada por Juan Luis (2026-08-25, literal en lo esencial)
Jugar partidas ordenador contra ordenador y aprovechar situaciones concretas de cada
partida para transformarlas en problemas. Ejemplo suyo: si un bando pierde una torre y
no lo puede evitar, ahí hay un posible problema del tipo «blancas juegan y capturan
una torre en 3 jugadas».

## Por qué encaja (lo que ya se sabe del código)
- El tipo de problema del ejemplo YA existe: `'gana'` (problemas.js:22, «capturar una
  pieza del tipo `pieza` GANANDO material»). No hay que inventar tipos nuevos, solo
  alimentarlos con posiciones de partida real.
- El generador actual construye posiciones colocando piezas (problemas.js:620-642) y
  el propio código admite el defecto (problemas.js:675: posiciones que «no habrían
  podido darse nunca en una partida»). La cosecha ataca exactamente eso: posiciones
  con historia real detrás.
- El verificador de la 12 (minimalidad + todas las soluciones) es el juez: la cosecha
  solo propone candidatas; ningún problema entra al almacén sin pasar por él.

## Qué hay que hacer
1. Un script de cosecha en `entrenamiento/` (node, sin DOM) que:
   - juegue partidas motor contra motor a nivel decente (presupuesto de nodos alto;
     variar nivel o temperatura entre partidas para diversidad);
   - en cada posición de la partida, o con un muestreo razonable, pregunte al
     verificador si desde ahí hay un objetivo forzado corto: mate en N, tablas, o
     `'gana'` (capturar pieza X ganando material) con N dentro de las bandas de
     dificultad de `PROB_NIVELES`;
   - guarde las candidatas que pasen la verificación completa, con su partida de
     origen y jugada anotadas (para poder auditar de dónde salió cada problema).
2. Deduplicar: la misma partida da posiciones casi iguales en jugadas consecutivas
   (la de la jugada 30 y la de la 31 suelen ser el mismo problema con una jugada
   menos). Quedarse con la de N mayor dentro de cada racha, que además es la difícil.
3. Volcar la cosecha al almacén con el mismo formato que ya usa (mirar cómo guarda la
   06 / el libro en `entrenamiento/`), sin retirar los problemas existentes: la
   cosecha AÑADE. Repartir por niveles según las bandas ya definidas.
4. Medir y dejar escrito en la terminada: partidas jugadas, candidatas encontradas,
   supervivientes tras verificación, reparto por tipo y por nivel.
5. `node entrenamiento/prueba-problemas.js` en verde sobre el almacén ampliado, y
   probar en navegador que «Nuevo problema» sirve problemas cosechados con normalidad.
6. Commit a `main` y push.

## Datos de entrada
- problemas.js — el verificador (tras la 12) y las bandas `PROB_NIVELES`.
- ai.js / ai-async.js — el motor que juega las partidas (tras la 13, si está LISTA,
  mejor: en modalidades PPT el motor de antes regalaba piezas y sus partidas valen
  poco como cantera; si la 13 no ha cerrado, cosechar solo en modalidades clásicas).
- entrenamiento/ — formato del almacén actual y prueba-problemas.js.
- El registro de la 06 (`hechos/terminadas/06--*`): cómo se equilibró el almacén.

## Cómo saber que ha terminado
El script de cosecha existe, es relanzable (idempotente: puede correr otra vez y solo
añade lo nuevo) y está documentado en su cabecera; el almacén tiene problemas
cosechados en varios niveles; los números de la cosecha están en la terminada.

## Al terminar
Cierre estándar: terminada `14--<sid>.md`, `CERRADA` en el reclamo, incidencias,
regenerar el tablón (recopiando Bandas), `git add reparto/` + commit + push, avisar a
Juan Luis. Si la cosecha resulta barata y útil, proponerle —sin montarlo por tu
cuenta— programarla como rutina recurrente: eso exige antes mover el protocolo del
reparto al remoto (ver proyecto.md, «No puede haber dos hechos/»).

## Trampas conocidas
- Git tarda 1-3 minutos por orden; en segundo plano, vigilando `.git/index.lock`.
- Las partidas motor contra motor comen CPU del Mac de Juan Luis: pocas a la vez
  (la arena de la 03 eran cuatro procesos y ya se notaba), y nunca dejar procesos
  huérfanos al cerrar la sesión.
- El scratchpad se purga a medianoche: partidas y candidatas, a `entrenamiento/`.
- Una posición de partida real puede venir con derechos de enroque o al paso a
  cuestas: guardar el estado completo que el verificador necesite, no solo el tablero.
- Muestrear todas las posiciones de todas las partidas con verificación completa es
  carísimo: filtrar barato primero (¿cambió el material en las últimas jugadas?
  ¿hay jaques?) y verificar caro solo las que prometen.
- **El filtro barato de `probPosicion` ("pieza a tiro") NO vale tal cual sobre
  posiciones reales de partida** (descubierto 2026-08-25, sesión
  `s-20260825T090854-1758bb65`): en el generador sirve porque la pieza objetivo ya
  se coloca aislada; en una partida real casi cualquier pieza desarrollada está "a
  tiro" de algo sin que signifique nada. Con el tope de nodos del generador
  (`PROB_TOPE` ≈150 000) esto disparó la búsqueda cara en casi cada jugada: una
  sola partida tardó más de 100 minutos sin terminar. Hace falta exigir además que
  la pieza esté SIN DEFENDER (colgada de verdad), un presupuesto de cribado bajo
  (unos 6000 nodos) y, sobre todo, un límite de RELOJ aparte (unos 3 s por jugada
  de partida): `probSaldoQuieto` (la quiescencia dentro de `probVeredicto`) no
  cuenta contra el tope de nodos y por sí sola puede tardar bastante en una
  posición con muchas capturas posibles, así que el tope de nodos solo no basta
  para acotar el tiempo real.
- Exigir "colgada de verdad" (sin defensor) en vez de solo "a tiro" resuelve el
  rendimiento pero sesga fuerte hacia jugadas=1 (85 de 89 en la primera tanda
  real): un "gana en 2/3/4" que empieza con la pieza todavía defendida y se
  destapa con jaques o desviaciones no lo coge este cribado. Limitación conocida,
  no error; ver `hechos/terminadas/14--s-20260825T090854-1758bb65.md`.

## Prohibido
- Meter en el almacén nada que no haya pasado el verificador completo de la 12.
- Retirar o reordenar los problemas ya existentes del almacén.
- Tocar problemas-ui.js, crear-problema.js, index.html o script.js: no son de esta
  tarea.
- Lanzar tandas masivas de partidas sin decírselo antes a Juan Luis si el Mac está en
  uso (misma cortesía que con la arena de la 03).
