# Tarea 17 · Arena de motor A/B para rps-rey y rpsls-rey

Creada: 2026-08-26 (sesión coordinadora s-20260825T093251-fde516e1, encargo de Juan
Luis del mismo día: comprobar en la arena qué modificaciones del motor mejoran el elo,
centrándose en `rps-rey` —PPTR— y `rpsls-rey` —PPTLSR—; las sin rey quedan aparcadas)
Precondición: 16 LISTA (las tandas deben jugarse con la regla de reyes definitiva)
Disparo: MANUAL · Duración esperada: 3 h · Banda de modelo: MEDIO
Salida (dueña exclusiva): `entrenamiento/arena-motor.js` (+ sus resultados en
`entrenamiento/`) y `main` (ai.js — SOLO la parametrización de constantes, ver abajo)

## Antes de empezar
1. Lee `reparto/proyecto.md` y `reparto/_ESTADO.md`; lista `reparto/hechos/`.
2. `date -u`, `sid`, reclamo `17--<sid>.md` (caduca: +6 h), `sleep 30` en segundo
   plano, volver a mirar. Comprobación barata: si `hechos/terminadas/17--*` existe,
   nada que hacer.
3. Contexto: `hechos/notas/s-20260825T093251-fde516e1.md` (los tres criterios de Juan
   Luis), `hechos/fallos/13--s-20260825T090706-b85c3e30.md` y
   `hechos/terminadas/13--s-20260826T022659-6a71f33e.md` (qué se quiere medir y por
   qué), y el análisis existente de arena en `entrenamiento/` (los scripts de la 03 y
   `analiza.js` de r15: reutiliza su matemática de elo/intervalo/p en vez de rehacerla).

## Qué hay que hacer
1. **Parametrizar las constantes RPS_* de ai.js** tras un objeto de configuración
   (p. ej. `RPS_CFG` con los valores actuales por defecto, sobrescribible desde
   fuera en node). SIN cambiar ningún valor por defecto ni ningún comportamiento:
   los tres tests (`test-modalidades.js`, `test-rps.js`, `test-ia-rps.js`) deben dar
   idéntico resultado antes y después.
2. **Escribir `entrenamiento/arena-motor.js`**: juega N partidas entre el motor
   vigente (A) y un candidato (B) que difiere solo en la configuración pasada por
   CLI (JSON de sobrescrituras de `RPS_CFG` y, más adelante, banderas de búsqueda),
   en una modalidad dada (`--modalidad=rps-rey|rpsls-rey`), alternando colores,
   semillas reproducibles, nivel de IA configurable (por defecto el que usó la arena
   de la 03). Registro por partida en JSON (como los logs que ya analiza `analiza.js`)
   y resumen final: `elo(A-B)` con intervalo de confianza y p — mismo criterio de
   significación que usó todo el proyecto (p<0.05).
   OJO con la lectura del signo: elo(A-B) POSITIVO = gana A = el candidato pierde.
   Este malentendido ya causó el bug de trigonal (`c388624c`); escríbelo en la salida
   del script («el candidato GANA/PIERDE/EMPATA») para que no haya que interpretarlo.
3. **Tanda de humo**: 8-16 partidas de A contra A (config idéntica) en cada
   modalidad, para verificar que el arnés no favorece a un asiento (elo ~0) y medir
   el coste real por partida (apunta partidas/hora en la terminada: las tareas 18-20
   dimensionarán sus tandas con ese dato).

## Autorización de máquina
Juan Luis encargó expresamente estas tandas (2026-08-26): la prohibición general de
«no relanzar la arena» no aplica a esta cadena de tareas. Aun así: máximo 2 procesos
node simultáneos, en segundo plano, y estira la caducidad del reclamo ANTES de cada
tanda larga.

## Cómo saber que ha terminado
Los tres tests idénticos a antes de tocar ai.js; la tanda de humo da elo ~0 (el
intervalo incluye 0) en ambas modalidades; partidas/hora medidas y anotadas; commit
y push hechos.

## Al terminar
Cierre estándar: terminada `17--<sid>.md` (con partidas/hora y el comando exacto de
uso), `CERRADA` en el reclamo, regenerar el tablón, commit + push, avisar a Juan Luis.

## Trampas conocidas
- Git tarda 1-3 min por orden; en segundo plano, vigilando `.git/index.lock`.
- Sellos y latidos en UTC de verdad (`date -u`), no hora local con Z.
- Los datos van al repo (`entrenamiento/`), NUNCA al scratchpad (se purga a
  medianoche; ya se perdieron scripts así).
- El árbol es compartido: `git add` solo por ruta de lo tuyo, mirando el diff.
- `quiesce()` y `probSaldoQuieto` tienen coste fuera del tope de nodos: el coste por
  partida puede variar mucho entre posiciones; mide de verdad, no estimes.

## Prohibido
- Cambiar ningún valor por defecto de RPS_* ni ninguna heurística: esta tarea solo
  construye el instrumento de medida.
- Tocar las modalidades sin rey (`rps`, `rpsls`): aparcadas por decisión de Juan Luis.
- Torneos por encima de lo dimensionado (esto no es la arena masiva de la 03).
