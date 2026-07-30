# entrenamiento/ — herramientas y datos del ajuste de la IA

Banco de trabajo para medir y mejorar los parámetros de `ai.js`. Vive en el
repo (y no en un directorio temporal) porque las tandas duran días y el
limpiador de `/tmp` de macOS purga por antigüedad.

## Herramientas

| Fichero | Qué hace |
|---|---|
| `arena.js` | Match emparejado entre dos configuraciones arbitrarias del motor (`CFG_A`/`CFG_B` por entorno). Misma apertura con colores invertidos; registra el balance material de las partidas cortadas para adjudicarlas en el análisis. |
| `analiza.js` | Marcador de una tanda: elo con IC 95%, z, p-valor; el margen de adjudicación se pasa como argumento para poder comprobar la robustez. |
| `aperturas.js` | Genera `libro.json`: 400 aperturas fijas de 6 jugadas al azar sin capturas, para que todas las ramas comparen sobre las mismas posiciones. |
| `corpus.js` | Fase cara del ajuste tipo Texel: autojuego que vuelca posiciones etiquetadas con el resultado (una línea JSON por posición). Shards paralelos por `SEED`; `ADJ_MARGIN` adjudica por material las partidas cortadas (imprescindible a prof. ≥3). |
| `ajusta.js` | Fase barata: la regresión sobre un corpus ya generado. `--features=mat|matmob|matpos|all`, `--holdout` para validación fuera de muestra, `--reg` para estabilidad. |

## Cuánto se aceleró el motor, y por qué hay dos cifras

Los `bench-fase*.json` guardan el banco de cada fase de la optimización (7
posiciones, nivel 4). Sumando sus tiempos:

| fase | ms | nodos | ×acumulado |
|---|---|---|---|
| motor original | 7144 | 123 949 | 1,0× |
| 1. quiescence solo capturas | 1464 | 123 949 | 4,9× |
| 2b. make/unmake (+ desempate estable) | 1271 | 121 170 | 5,6× |
| 3. isAttackedFast | 931 | 121 170 | 7,7× |
| 4. Zobrist + TT de arrays | 968 | 121 170 | 7,4× |
| 5. ordenación (hash-move, MVV-LVA, killers, historia) | 413 | 62 216 | 17,3× |
| 6. TT persistente + profundización iterativa | 662 | 86 640 | 10,8× |
| 7. clavadas | 553 | 86 640 | 12,9× |

La fase 7 es **exacta**: el mismo recuento de nodos (86 640) demuestra que
genera exactamente las mismas jugadas, y el perft y los dorados salen idénticos
en las 21 posiciones. Por eso no necesitó arena. En el perfil, `isAttackedFast`
bajó del 16,0% al 7,0% y `makeSim`/`unmakeSim` desaparecieron de la cabeza.

**Cuidado al leer las dos últimas filas.** El banco hace *una* búsqueda por
posición con la tabla vacía, a propósito, para ser reproducible. Eso le cobra
a la profundización iterativa todo su coste (buscar a profundidad 1, 2, 3…
antes de la final) sin darle ninguno de sus beneficios, porque el beneficio
aparece cuando la tabla sobrevive de una jugada a la siguiente. Por eso la
fase 6 "empeora" en el banco y aun así se adoptó.

La medida honesta es con jugadas **consecutivas** de partida real. 36 jugadas
seguidas a profundidad 4, mismo libro y misma semilla:

- motor original: 33 699 ms por jugada
- motor actual: 613 ms por jugada → **55×**

Es decir: 10,8× es lo que se gana por nodo, y 55× lo que se gana jugando. La
diferencia entre ambos es exactamente lo que aporta la memoria entre jugadas.

## Resultados hasta la fecha (julio 2026)

**Ciclo 1 (corpus prof. 2, ablación y confirmación → commit `22407e1`):**
el paquete entrenado original mezclaba un acierto y un error que se cancelaban.
Material ajustado (N265 B335 E358 R483 Q981): +35 elo. Peso de movilidad 1,61
aprendido por la regresión: **−81 elo** (¡al revés!); subirlo a 4: +78. Pesos
posicionales: ruido (p=0,62). Combinación material+mov4 confirmada: +89 elo a
prof. 2, **+113 a prof. 3** (p<0,0001), +90 el componente de movilidad a
prof. 4. Se adoptó como `PIECE_VALUE` y movilidad por defecto de TODOS los
niveles.

**Ciclo 2 (corpus prof. 3, 6.291 posiciones, ~440 partidas decisivas):**
la regresión sobre el corpus profundo propuso P100 N231 B310 E415 R527 Q963
(mejora fuera de muestra; E y R sensibles a la regularización). En la arena a
prof. 3 (r6/): **bate a los clásicos (+78, p=0,0001) pero PIERDE contra los
valores vigentes (−37, p=0,04)**, robusto a márgenes 150–700. Según la regla
de parada, `ai.js` no se toca. Además la regresión volvió a pedir movilidad
~1,8 (como el 1,61 del ciclo 1): el sesgo de la regresión con la movilidad es
sistemático — **el material se aprende por regresión; la movilidad, solo en la
arena**.

Conclusión del ciclo 2: los valores vigentes sobrevivieron a un retador serio
entrenado con datos más profundos. Confianza reforzada; sin cambio de valores.

## Entrenamiento continuo (sobrevive a apagones)

`./instalar-servicio.sh` deja el entrenamiento corriendo como servicio de
macOS: arranca solo al iniciar sesión y, si se apaga el ordenador, al volver
sigue por donde iba.

```sh
./instalar-servicio.sh             # instalar y arrancar
./instalar-servicio.sh estado      # ¿corre? ¿cuántas partidas lleva?
./instalar-servicio.sh resultados  # elo/IC/p de lo jugado hasta ahora
./instalar-servicio.sh parar       # detener (sigue instalado)
./instalar-servicio.sh quitar      # desinstalar del arranque
```

Dos cosas que conviene saber:

- **La reanudación la hace `arena.js`, no launchd.** Con `SALIDA=<fichero>`
  añade cada partida al fichero (con volcado a disco inmediato) y al arrancar
  se salta los pares que ya estén dentro. Un corte solo pierde la partida a
  medias; el resto no se repite. Verificado matando el servicio con SIGKILL:
  launchd lo relanzó en 60 s y no duplicó ninguna partida.
- **El servicio no trabaja dentro del repo.** macOS no deja que un LaunchAgent
  lea `~/Documents`, así que `instalar-servicio.sh` copia el motor y las
  herramientas a `~/Library/Application Support/ajedrez-triangular-entrenamiento`
  y trabaja ahí (`MOTOR=` le dice a `arena.js` dónde está el motor). La copia
  es una foto fija: para entrenar con una versión nueva del motor, vuelve a
  ejecutar `./instalar-servicio.sh`.
- **Nunca `ProcessType=Background` en el plist.** Parece lo correcto para una
  tarea de fondo y es una trampa: en Apple Silicon esa banda confina el
  proceso a los núcleos de eficiencia. Medido con `taskpolicy -b`: 208 → 1429
  ms por jugada, **6,9× más lento**, y encima los procesos se reparten solo 4
  núcleos lentos. Así, las partidas de la ronda 9 costaron 3219 s de media
  cuando sin restricción son ~18 s, y la ronda 10 (prof. 5) llevaba 3 horas
  con cero partidas. Con `Nice 10` + `LowPriorityIO` el servicio cede el paso
  igual pero corre a velocidad plena (~105% de CPU por proceso frente al 22%
  de antes). Regla práctica: **cuatro procesos rápidos rinden mucho más que
  seis estrangulados**, y dejan media máquina libre. Medido después del
  cambio: 655 s por partida de profundidad 5 con los cuatro procesos en
  marcha, o sea ~22 partidas/hora. Las 500 partidas que hacen falta para
  decidir la ronda salen en un día de máquina encendida, no en dos meses.

## Ronda 10: la movilidad a profundidad 5 (406 partidas)

Primera medida a profundidad 5, imposible antes de acelerar el motor.

| | elo | IC 95% | p |
|---|---|---|---|
| movilidad 4 contra 2 | **+39** | [12, 66] | 0,005 |
| movilidad 4 contra 3 | +8 | [−17, 32] | 0,54 |

Robusto: repetido con márgenes de adjudicación de 100, 200, 300 y 500 cp, el
primero sale positivo y con el intervalo fuera del cero en los cuatro casos
(+59, +51, +39, +25) y el segundo nunca se separa del cero.

Dos conclusiones:

- **La movilidad sigue valiendo a profundidad 5.** No es un sustituto que la
  búsqueda profunda vuelva innecesario.
- **Los pesos 3 y 4 son indistinguibles ahí.** El intervalo descarta cualquier
  diferencia mayor de ±32 elo. No hay motivo para tocar `ai.js`: afinar sobre
  una diferencia no significativa es afinar sobre ruido.

**Lo que esta ronda NO contesta** es si el peso óptimo baja con la
profundidad, y conviene decir por qué. La comparación exigiría medir lo mismo
a varias profundidades con el mismo tope de jugadas, y no se puede: el +90 de
profundidad 4 que figura en el ciclo 1 se midió con tope 110 y esta ronda con
tope 80, y el tope cambia el elo por sí solo (en estos mismos datos, la misma
tanda da +59 o +25 según el margen). Encima los logs de la ronda 5 no
guardaban qué configuración era cada rama. Por eso `arena.js` escribe ahora
una cabecera con las configuraciones en cada log. El control limpio sería una
ronda con movilidad 4 contra 2 a profundidades 3, 4 y 5 con topes idénticos.

La ronda 9 (profundidad 4, 127 partidas) quedó sin veredicto: movilidad 4
contra 3 empate (−37 elo, p=0,36) y contra 5 va +70 sin alcanzar
significación (p=0,064). Sus datos siguen en `r9/`.

## Datos

- `corp/` — corpus de posiciones del ciclo 2 (autojuego nivel 4, prof. 3).
- `libro.json` — libro de aperturas (regenerado 2026-07-27; el original se lo
  llevó el limpiador de /tmp, la comparabilidad dentro de cada tanda no cambia).
- `r4/` `r5/` `r6/` — logs de las confirmaciones (prof. 3, prof. 4 y ciclo 2).
  Los logs de la ablación original (prof. 2) se perdieron en la purga de /tmp;
  sus conclusiones están en el mensaje del commit `22407e1`.
