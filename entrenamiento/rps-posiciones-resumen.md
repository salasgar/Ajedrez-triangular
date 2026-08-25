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

Segunda tanda (2026-08-25, sesión s-20260824T233011-d4d13c52, con el visto bueno de
Juan Luis para relanzar la arena; mismas condiciones, `PARTIDAS=16 NIVEL=3`):

```
rps · eq18-giro                 16       13%      6%     81%    400   105.3     1.09
rps · fondo9-giro               16        6%     13%     81%    400    18.9     1.09
rps · frente11-giro             16        6%     19%     75%    400    24.9     1.06
rpsls · eq15-giro               16       19%      6%     75%    400    98.2     1.06
rpsls · fondo10-giro            16        0%      6%     94%    399    27.1     1.22
rpsls · frente11-giro           16       13%     19%     69%    400    30.7     0.97
```

(`rpsls · ciclo-giro` queda con 3 partidas: es de 20 piezas, descartada por criterio,
y completarla habría sido gastar máquina en una descartada.)

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

## Decisión tomada para `rps` y `rpsls` (2026-08-25, segunda tanda)

**Se mantiene `base` como setup definitivo en las dos modalidades sin rey**, ahora con
datos. `variants.js` no cambia: la provisional resulta ser la ganadora.

El razonamiento, en tres pasos:

1. **La hipótesis del indicio se confirmó**: las candidatas «equilibrada», «solo fondo»
   y «solo frente» miden mal también sin rey (69-94 % de tablas, interés 0.97-1.22),
   igual que sus análogas en las `-rey`.
2. **El criterio del descarte quedó obsoleto con los datos nuevos**: se descartaron las
   de 20 piezas «por agotar el tope de jugadas», pero la segunda tanda muestra que en
   las modalidades sin rey TODAS las candidatas agotan el tope siempre (plies medios
   399-400 en las seis), tengan 9, 11, 15, 18 o 20 piezas. Agotar el tope no distingue
   setups: es una propiedad de la modalidad (sin jaque mate, las partidas no acaban
   solas) y los resultados salen de la adjudicación por material (`MARGEN=3`).
3. **Con ese criterio caído, manda la pregunta original del encargo** («que no siempre
   ganen blancas, ni negras, ni siempre empate»): `base` da el mejor reparto de toda la
   tabla en las dos modalidades — `rps` 31/31/38 (interés 0.63, idéntico al de la
   ganadora de `rps-rey`) y `rpsls` 31/19/50 (interés 0.81).

**Cuestión de diseño que queda abierta (fuera del alcance de la tarea 03):** que en las
modalidades sin rey ninguna partida termine de forma natural es un rasgo de las reglas
de la modalidad, no de la posición inicial — ninguna posición inicial lo va a arreglar.
Si se quiere que estas partidas puedan acabar antes del tope (contra humanos no hay
adjudicación por material que corte), habría que tocar las condiciones de victoria
(por ejemplo: ganar al capturar N piezas, o al coronar una figura en la fila rival).
Eso es decisión de Juan Luis y, si la toma, una tarea nueva del reparto.
