# Resumen de la arena de posiciones PPT — tarea 03 del reparto

Arena: `entrenamiento/arena-rps.js`, datos en bruto (no commiteados; quedan en el
worktree local `.claude/worktrees/agent-a03cff377e94e7be5/`, rama `posiciones-ppt`).
Candidatas, azar sembrado y metodología: comentario de cabecera de ese fichero.

Criterio ya fijado (`traspaso-variantes-ppt.md`): descartados los setups «espejo puro»
(fila delantera de una sola letra, front/back monolíticos — bloqueo total en la línea de
choque) y, en las modalidades SIN rey, los de 20 piezas (sin jaque que corte la partida,
casi el 100% de las partidas agota el tope de jugadas).

## Lo medido

La criba se hizo con `PARTIDAS=16 NIVEL=3` (y una confirmación de 40 partidas a nivel 4
sobre la candidata ganadora de `rps-rey`). Tabla completa (`node entrenamiento/arena-rps.js
resumen ...`):

```
modalidad · candidato          n   %blancas %negras %tablas  plies  s/part  interés
rps · base                      16       31%     31%     38%    400    49.1     0.63
rps · base-desplazada           16       19%     25%     56%    400    51.1     0.84
rps · ciclo-espejo               15       27%     20%     53%    398    73.8     0.82
rps-rey · base                  16        6%      6%     88%    237    19.6     0.97
rps-rey · ciclo-K-espejo        40       20%     28%     53%    361    24.6     0.81
rps-rey · ciclo-K-giro          16       38%     19%     44%    361    38.6     0.78
rps-rey · eq-K-giro              16       25%      0%     75%    327    29.2     1.13
rps-rey · fondo-K-giro          16        0%      0%    100%    186     6.3     1.10
rps-rey · rey-frente             16        0%     13%     88%    190    19.5     1.04
rpsls · base                    16       31%     19%     50%    400    60.2     0.81
rpsls · ciclo-espejo             16       19%      6%     75%    400    98.8     1.06
rpsls · ciclo-giro                3        0%     67%     33%    400    70.8     1.25
rpsls-rey · base                16       19%      6%     75%    286    31.4     1.06
rpsls-rey · ciclo-K-espejo      16       31%     31%     38%    362    48.8     0.63
rpsls-rey · ciclo-K-giro        16       31%      6%     63%    386    75.3     1.00
rpsls-rey · eq-K-giro            12       17%      0%     83%    263    27.1     1.17
```

Nota sobre `plies=400/398`: es el tope de jugadas (`MAX_PLIES`); en `rps` y `rpsls` casi
todas las partidas de candidatos de 20 piezas lo agotan, confirmando el descarte del
traspaso. En las `-rey` no pasa (hay jaque mate), por eso ahí sí es válida una candidata
de 20 piezas.

## Decisión tomada (con datos)

- **`rps-rey` → `ciclo-K-espejo`**: `O-A-T` cíclico en las dos filas (front
  `OATOATOATOA`, back `TOATKATOA` con el rey al centro), negras en espejo. Puntuación de
  interés (0.81) casi empatada con `ciclo-K-giro` (0.78), pero el reparto blancas/negras
  está mucho más ajustado (20/28 frente a 38/19, casi 2:1 a favor de blancas en
  `ciclo-K-giro`), que es justo lo que pedía el encargo original. Coincide además con la
  candidata que una sesión anterior ya eligió para la confirmación de 40 partidas a nivel
  4 — se respeta esa decisión.
- **`rpsls-rey` → `ciclo-K-espejo`**: mismo patrón con las cinco figuras (front
  `OATLSOATLSO`, back `ATLSKATLS`). Gana con margen amplio sobre las otras dos candidatas
  medidas (interés 0.63 frente a 1.00 y 1.17) y con el reparto blancas/negras más
  equilibrado de toda la tabla (31/31).

Aplicado en `variants.js`: nuevas listas `RPS_REY_FRONT`/`RPS_REY_BACK` y
`RPSLS_REY_FRONT`/`RPSLS_REY_BACK`, separadas de las de `rps`/`rpsls` (antes las
`-rey` reusaban las mismas listas que las sin rey; ahora mismo sus posiciones ganadoras
no coinciden, así que hacía falta desacoplarlas).

## Decisión NO tomada — falta medir

**`rps` y `rpsls` siguen con el setup provisional del 2026-08-24** (`base`, un muro de
papeles con piedra/tijera alternada, negras en espejo). No es una decisión: es que no hay
con qué decidir.

La criba se paró antes de llegar a las candidatas que sobreviven al descarte de 20
piezas:
- `rps`: solo se midieron `base`, `base-desplazada`, `ciclo-espejo` (los tres de 20
  piezas, los tres descartados). Faltan `eq18-giro`, `fondo9-giro`, `frente11-giro` y
  `tijeras-flanco` (este último también de 20 piezas, descartado igual).
- `rpsls`: solo se midieron `base`, `ciclo-espejo`, `ciclo-giro` (de 20 piezas,
  descartados; `ciclo-giro` con solo 3 partidas, ni eso completo). Faltan `eq15-giro`,
  `fondo10-giro`, `frente11-giro`.

Con los datos de las `-rey` hay un indicio a vigilar: las candidatas «equilibrada»
(`eq-K-giro`) y «solo fondo» (`fondo-K-giro`) midieron mal (interés 1.13 y 1.10; la de
fondo con 100% tablas y partidas de 6 segundos, prácticamente degeneradas). Si ese patrón
se repite en las sin rey, ni `eq18-giro`/`eq15-giro` ni `fondo9-giro`/`fondo10-giro`
serían buena elección sin más — pero es una hipótesis, no una medición, y en las sin rey
no hay alternativa «ciclo» porque esa es precisamente la que se descarta por el tope de
jugadas. Puede hacer falta una candidata nueva (no está en la lista actual de
`arena-rps.js`) para las dos modalidades sin rey.

Terminar esto exige correr la arena para esas candidatas, y la ficha de la tarea 03 lo
prohíbe expresamente («Prohibido: relanzar procesos de arena») sin decisión de Juan
Luis — son procesos que ocupan el Mac. Queda para quien retome la tarea 03, con su visto
bueno.
