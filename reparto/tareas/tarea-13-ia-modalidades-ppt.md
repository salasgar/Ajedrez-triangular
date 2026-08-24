# Tarea 13 · La IA juega mal en las modalidades PPT: no captura ni lo que sale gratis

Creada: 2026-08-25 (sesión s-20260824T233011-d4d13c52, ampliación del reparto)
Precondición: tarea 03 sin reclamo vivo (LISTA, o A MEDIAS como quedó el 2026-08-25) · Disparo: MANUAL
Duración esperada: 3 h · Banda de modelo: MEDIO
Salida (dueña exclusiva): `main` (ai.js, ai-async.js, test-ia-rps.js)

## Antes de empezar
1. Lee `reparto/proyecto.md` y `reparto/_ESTADO.md`; lista `reparto/hechos/`.
2. Comprueba el estado de la 03 en `hechos/`: vale que esté LISTA, o A MEDIAS **sin
   reclamo vivo** (así quedó el 2026-08-24T23:26Z: `rps-rey` y `rpsls-rey` ya tienen
   setup medido y publicado en `origin/main` = 53b32e6; `rps` y `rpsls` esperan una
   arena que necesita el visto bueno de Juan Luis). Con la 03 A MEDIAS, reproduce y
   ajusta sobre las modalidades CON rey —que es además donde Juan Luis vio el fallo—
   y trata los resultados en `rps`/`rpsls` como provisionales: sus setups pueden
   cambiar cuando la 03 se retome. Si la 03 tiene un reclamo vivo, espera: variants.js
   está en obras.
3. `date -u`, `sid`, reclamo `13--<sid>.md` (caduca: +6 h), `sleep 30` en segundo
   plano, volver a mirar.
4. Comprobación barata: si `hechos/terminadas/13--*` existe, nada que hacer.

## El problema, contado por Juan Luis (2026-08-25)
En «Piedra, papel, tijera + rey» el ordenador juega mal incluso en nivel muy difícil:
a veces no captura aunque la captura le salga gratis. Probablemente pasa en las cuatro
modalidades PPT. Que un nivel alto deje piezas gratis sin comer es el síntoma a
reproducir primero; «juega mal» en general viene después.

## Por dónde empezar (lo que ya se sabe del código)
- La evaluación PPT está en ai.js: `evaluateRps` (ai.js:280) con el modelo de valor
  dinámico `rpsValor` (ai.js:223, comentado en ai.js:126-163: valor según presas y
  depredadores vivos, constantes RPS_* en ai.js:143-163).
- Los niveles van por PRESUPUESTO DE NODOS, no por profundidad (ai.js:61-98). Hipótesis
  a comprobar, no verdades:
  - Presupuesto: si en PPT cada nodo cuesta mucho más (la evaluación recuenta presas y
    depredadores), «muy difícil» puede quedarse en profundidad 1-2 y no ver ni una
    captura gratis. Medir a qué profundidad llega de verdad en una posición PPT.
  - Quiescencia: si `quiesce` no genera/valora capturas PPT correctamente (la relación
    de captura es piedra>tijera>papel>piedra, no simétrica: que A capture a B no
    implica que B capture a A), el motor puede estar podando justo las capturas.
  - Evaluación: con RPS_PESO_PRESA=12 y valores dinámicos, capturar puede parecer
    malo si al comerse la presa el valor de la propia figura cae (pierde presas
    vivas). Comprobar si la evaluación castiga capturar.
  - Nota de ai.js:818: la evaluación «en las demás [modalidades] está sin medir».
- Ya existe `node test-ia-rps.js`: ejecútalo ANTES de tocar nada, para saber qué
  cubría y qué daba por bueno.

## Qué hay que hacer
1. Reproducir: una posición PPT con captura gratis obvia donde el nivel máximo no
   captura. Convertirla en caso de prueba en test-ia-rps.js (posición + jugada
   esperada o, al menos, «captura algo»).
2. Diagnosticar con las hipótesis de arriba (profundidad real alcanzada, quiescencia,
   evaluación) y arreglar la causa, no el síntoma.
3. Comprobar el arreglo en las 4 modalidades PPT (con rey y sin rey) y a varios
   niveles: el fallo se notó en «muy difícil», pero el arreglo no debe romper los
   niveles bajos (que deben seguir siendo flojos a propósito).
4. Comprobar que las modalidades clásicas no cambian: `node test-modalidades.js` y
   `node test-rps.js` en verde, además de test-ia-rps.js.
5. Commit a `main` y push.

## Datos de entrada
- ai.js (evaluación y búsqueda), ai-async.js (si el nivel/presupuesto se decide ahí).
- variants.js — SOLO LECTURA: define las modalidades y sus setups (recién medidos por
  la 03; sus datos de arena en `entrenamiento/` justifican los setups).
- test-ia-rps.js, test-rps.js, test-modalidades.js.
- traspaso-variantes-ppt.md — decisiones y descartes sobre las modalidades PPT.

## Cómo saber que ha terminado
El caso de reproducción pasa (el nivel alto captura lo gratis); las tres pruebas en
verde; jugadas unas manos manuales en navegador contra el nivel alto en PPT+rey sin
ver piezas regaladas sin comer.

## Al terminar
Cierre estándar: terminada `13--<sid>.md`, `CERRADA` en el reclamo, incidencias,
regenerar el tablón (recopiando Bandas), `git add reparto/` + commit + push, avisar a
Juan Luis. Si el arreglo cambió constantes RPS_* o presupuestos de nivel, anotar los
valores viejos y nuevos en la terminada.

## Trampas conocidas
- Git tarda 1-3 minutos por orden; en segundo plano, vigilando `.git/index.lock`.
- No relanzar la arena de posiciones (cuatro procesos node que ocupan el Mac). Ajustar
  constantes con partidas sueltas de prueba, no con torneos masivos, salvo encargo
  expreso de Juan Luis.
- El árbol lo comparten varias sesiones: mirar `.claude/sesiones/*.json` y el diff
  antes de cualquier `git add`.
- Si esta tarea resulta ser «la IA de PPT hay que rehacerla entera», eso es una tarea
  mal cortada: incidencia con el corte natural, ABANDONADA, y avisar — no rehacer el
  motor dentro de esta tarea.

## Prohibido
- Tocar variants.js (setups recién medidos, dueño: tarea 03) y problemas*.js (dueño:
  tarea 12, puede estar cogida).
- Cambiar el comportamiento de la IA en las modalidades clásicas: los tres tests son
  la red; si alguno cambia de resultado, hay que poder explicar por qué es mejora.
