# Tarea 16 · Dos reyes nunca adyacentes en las modalidades -rey

Creada: 2026-08-26 (sesión coordinadora s-20260825T093251-fde516e1, por decisión
expresa de Juan Luis del mismo día — ver hechos/notas/s-20260825T093251-fde516e1.md)
Precondición: 13 LISTA (lo está desde 2026-08-26) · Disparo: MANUAL
Duración esperada: 1,5 h · Banda de modelo: MEDIO
Salida (dueña exclusiva): `main` (variants.js — SOLO la entrada K de `capturesConRey`;
test-ia-rps.js — el caso de regresión afectado)

## Antes de empezar
1. Lee `reparto/proyecto.md` y `reparto/_ESTADO.md`; lista `reparto/hechos/`.
2. `date -u`, `sid`, reclamo `16--<sid>.md` (caduca: +3 h), `sleep 30` en segundo
   plano (el de primer plano lo bloquea el harness), volver a mirar.
3. Comprobación barata: si `hechos/terminadas/16--*` existe, nada que hacer.
4. Lee la nota `hechos/notas/s-20260825T093251-fde516e1.md` (la decisión y su porqué)
   y la parte de `isAttackedFast` en `hechos/fallos/13--s-20260825T090706-b85c3e30.md`
   y `hechos/terminadas/13--s-20260826T022659-6a71f33e.md` (el contexto del commit
   `6dcc509`).

## La decisión de Juan Luis (2026-08-26)
En las modalidades con rey hay que garantizar que un rey nunca se coloque en una
casilla adyacente al otro rey, como en el ajedrez clásico. La forma elegida por él:
**que `capturesConRey` (variants.js) diga que 'K' SÍ puede capturar a 'K'**. Con eso
la casilla junto al rey rival cuenta como atacada (`isAttackedFast` ya aplica
`canCapture()` a las saltadoras desde `6dcc509`), moverse ahí es ilegal, y desaparece
la única excepción de esa matriz. El K×K nunca llega a ejecutarse — igual que en el
ajedrez clásico, donde el rey «ataca» las casillas adyacentes sin poder capturarse
los reyes de verdad.

## Qué hay que hacer
1. Cambiar la entrada K de `capturesConRey` en variants.js para incluir 'K' entre sus
   víctimas. Nada más de variants.js.
2. Revisar el caso de regresión de `rpsls-rey` en test-ia-rps.js: la «captura gratis
   del rey» que el commit `6dcc509` liberó pasa a ser ILEGAL con la regla nueva (era
   moverse junto al rey rival). Ajustar o regenerar ese caso para que la prueba
   refleje la regla nueva.
3. Comprobar en una posición manual de cada modalidad -rey (rps-rey, rpsls-rey) que
   `genMoves` ya no ofrece al rey casillas adyacentes al rey rival, y que el resto de
   sus jugadas legales siguen ahí.
4. **Actualizar el dorado de `dekle` en test-ia-rps.js** (desactualizado por el
   commit `56917bf` de la tarea 10; documentado en el fallo de la 13). Era opcional;
   desde el 2026-08-26 es parte de la tarea: esta ficha abre la cadena de arena
   (tareas 17-20) y un test rojo permanente ensucia la señal de toda la cadena.
5. `node test-modalidades.js`, `node test-rps.js` y `node test-ia-rps.js` en verde
   COMPLETO (sin excepciones tras el punto 4).
6. Commit a `main` y push.

## Cómo saber que ha terminado
Las posiciones de prueba del punto 3 rechazan la adyacencia de reyes; los tres tests
en verde completo; commit y push hechos. Esta tarea es la precondición de la 17 (la
cadena de arena juega con la regla de reyes definitiva).

## Al terminar
Cierre estándar: terminada `16--<sid>.md`, `CERRADA` en el reclamo, incidencias si
las hay, regenerar el tablón (recopiando Bandas), commit + push, avisar a Juan Luis.

## Trampas conocidas
- Git tarda 1-3 minutos por orden; en segundo plano, vigilando `.git/index.lock`.
- Las horas de los sellos (`cerrado:`, latidos) van en UTC de verdad (`date -u`): dos
  sesiones anteriores escribieron la hora local con sufijo Z y confunden el orden de
  los rastros.
- El árbol lo comparten sesiones: mirar `.claude/sesiones/*.json` y el diff antes de
  cualquier `git add`; añadir por ruta solo lo tuyo.

## Prohibido
- Tocar `quiesce()` o cualquier otra parte del núcleo de búsqueda de ai.js: el
  arreglo de fondo de la 13 está expresamente a la espera del visto bueno de Juan
  Luis y se mediría con arena.
- Tocar nada de variants.js que no sea la entrada K de `capturesConRey`.
- Relanzar la arena o torneos masivos.
