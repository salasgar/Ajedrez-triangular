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

La tanda instalada (ronda 9) mide el **pico de movilidad a profundidad 4**:
movilidad 4 (lo que juega hoy el motor) contra 3 y contra 5.

## Datos

- `corp/` — corpus de posiciones del ciclo 2 (autojuego nivel 4, prof. 3).
- `libro.json` — libro de aperturas (regenerado 2026-07-27; el original se lo
  llevó el limpiador de /tmp, la comparabilidad dentro de cada tanda no cambia).
- `r4/` `r5/` `r6/` — logs de las confirmaciones (prof. 3, prof. 4 y ciclo 2).
  Los logs de la ablación original (prof. 2) se perdieron en la purga de /tmp;
  sus conclusiones están en el mensaje del commit `22407e1`.
