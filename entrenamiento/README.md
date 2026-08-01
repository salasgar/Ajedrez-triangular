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
| `perft.js` | `check` (perft + dorados de búsqueda sobre 21 posiciones), `bench`, `divide`, `gen`. Lo que verifica que una optimización del motor no cambió lo que juega. |
| `test-worker.js` | Evalúa `aiWorkerSource()` en un contexto aislado y simula una petición: convierte "revienta en el navegador" en "falla un test". Obligatorio tras tocar `AI_WORKER_FNS`. |
| `prueba-humo.js` | Partida completa, circuito serializar → validar → aplicar, guardados antiguos, basura rechazada, coronación y tablas por material. Sin navegador. |

Antes de publicar (el repo se sirve con GitHub Pages desde la rama, así que
un push despliega la aplicación en vivo):

```sh
node perft.js check && node test-worker.js && node prueba-humo.js
```

## Qué son los «dorados»

Es el calco de *golden test* / *golden file*: se **congela la salida de una
versión que se da por buena** y se guarda como referencia, de modo que
cualquier cambio posterior que la altere salte a la vista. En español se diría
«valores de referencia»; en este repo se les llama dorados y así aparecen en
los comentarios y en los mensajes de commit.

Viven todos en `perft-esperado.json` y son de dos clases:

**Perft** — vigila el *generador de jugadas*. Cuántas secuencias legales de
`d` jugadas salen de cada posición:

```json
"inicial": { "d": 3, "n": 23489 }
```

Un solo número que resume miles de casos. Se mueve si se rompe el enroque, la
captura al paso, la coronación o la detección de jaque.

**Dorados de búsqueda** — vigilan *el motor*. Por posición y configuración: la
puntuación de la mejor jugada raíz, el conjunto de jugadas que quedan dentro
de `PLAY_TOLERANCE` y cuántas legales hay:

```json
"DORADO_CARO": { "best": 164, "banda": ["2,-2,1>1,0,0", "…"], "legales": 28 }
```

Se guarda el **conjunto** y no la jugada elegida a propósito: el motor sortea
dentro de esa banda, así que la elegida cambia entre ejecuciones y la banda
no.

```sh
node perft.js gen     # congela (solo cuando el cambio es intencionado)
node perft.js check   # compara con lo congelado
```

**Lo que prueban no es lo que parece.** Un dorado dice «esto sigue dando lo
mismo que antes», no «esto es correcto». Nadie ha publicado números de perft
para esta variante, así que el oráculo es el propio generador el día que se
dio por bueno: detectan **cambios**, no errores preexistentes. Un fallo que ya
estuviera ahí el primer día se habría congelado tan tranquilo. De hecho el
enroque duplicado que apareció en la fase 2 no lo cazó un dorado, sino el
perft comparado contra un recuento hecho por otra vía.

Aun así son la red de seguridad de casi todo lo que hay en este README. Que
las clavadas (fase 7) fueran una optimización **exacta** no es un argumento:
es que los 21 perft y los 28 dorados salieron idénticos y el banco contó los
mismos 86.640 nodos. Y cuando los niveles se rediseñaron, los dorados estaban
atados a «el nivel 3» y «el nivel 4», así que el rediseño los habría
invalidado justo cuando más falta hacían; por eso ahora llevan sus dos
configuraciones escritas y son independientes del menú de niveles.

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

## Niveles intermedios: dos mandos nuevos en el motor

La escalera de niveles tiene saltos enormes —de 300 a 1000 elo entre niveles
contiguos, ver ronda 12—, así que `ai.js` admite ahora dos parámetros para
poner peldaños en medio. Los dos son **inertes si no se definen**: sin ellos
el motor juega exactamente igual que antes (perft y dorados idénticos).

**`nodes`: presupuesto de nodos.** En vez de fijar la profundidad, se deja
profundizar hasta gastar N nodos y se juega la mejor jugada de la **última
profundidad terminada** (una iteración a medias ha mirado bien las primeras
jugadas y nada las últimas, así que se descarta entera). Es el mando bueno:

- Es **continuo**, frente a la profundidad, que salta de 4 a 6 veces el
  trabajo en cada escalón. Medido en procesos limpios con tope de profundidad
  6: 500 → 8 ms/jugada, 2.000 → 17, 10.000 → 59, 50.000 → 297, 200.000 →
  1.129, sin tope → 4.822. Monótono y sin sorpresas.
- Es **honesto**: juega peor porque piensa menos, no porque se le inyecten
  errores. Es lo que distingue de verdad a un jugador más flojo.
- La profundidad 1 se termina siempre, gaste lo que gaste: sin ella no habría
  ninguna jugada que devolver.
- **Reparte el esfuerzo donde hace falta.** Al bajar el número de piezas baja
  el factor de ramificación, así que el mismo presupuesto compra mucha más
  profundidad. Con 10.000 nodos: apertura (40 piezas) profundidad 3, final (10
  piezas) profundidad 4, final mínimo (4 piezas) profundidad 8. Eso es
  exactamente lo contrario de lo que hace la profundidad fija, que se pasa el
  mediojuego pensando y despacha el final en un suspiro, que es donde más
  falta hace mirar lejos.

Por eso, **con presupuesto el tope de profundidad debe ir muy alto** (24 en la
ronda 13) para no llegar a estorbar nunca. Con tope 6, el final mínimo se
quedaba en profundidad 6 gastando 0 ms: ni siquiera usaba el presupuesto. Con
tope alto llega a 12. En la apertura el tope da igual: allí manda el
presupuesto.

Un detalle que costó una medición equivocada: la firma de la tabla de
transposición (`ttCfgSig`) **no** incluye `nodes` ni `temperature`, y hace
bien, porque no cambian lo que vale una posición. Pero eso significa que
midiendo varios presupuestos en el mismo proceso, los últimos encuentran el
trabajo ya hecho: la primera tanda dio tiempos absurdos (200.000 nodos en 3
ms) hasta que se midió cada presupuesto en un proceso propio.

**`temperature`: sorteo ponderado.** La jugada *i* sale con probabilidad
proporcional a `exp((score_i − best) / T)`, con T en centipeones. Sustituye al
sorteo dentro de la ventana dura de `PLAY_TOLERANCE`, que como mando de
dificultad reparte mal el castigo: la ventana es absoluta, así que en una
posición tranquila sortea entre veinte jugadas y en una posición aguda —donde
una sola salva— no se equivoca nunca. Debilita justo donde da igual. Medido
sobre una misma posición, 200 sorteos:

| T | jugadas distintas | la más frecuente |
|---|---|---|
| clásico | 1 | 100% |
| 30 | 21 | 32% |
| 100 | 32 | 9% |
| 300 | 34 | 8% |

Cuesta como el modo análisis (2-3× la ventana justa), porque necesita la
puntuación **exacta** de las jugadas malas: con la ventana estrecha una jugada
pésima solo devuelve una cota superior y el sorteo ponderado saldría mal.

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

## Ronda 12: la escalera de elo de los niveles (en curso)

El selector prometía "Fácil", "Difícil" o "Experto" sin que nadie hubiera
medido nunca cuánto se llevan entre sí. Parejas contiguas, mismos topes que
las rondas anteriores:

| escalón | elo | partidas |
|---|---|---|
| nivel 2 → 3 | −1040 | 400 · cerrado |
| nivel 3 → 4 | −797 | 400 · cerrado |
| nivel 4 → 5 | −382 | en curso |
| nivel 5 → 6 | −280 | en curso |

Saltos de 300 a 1000 elo. De ahí la ronda 13 y los dos mandos nuevos: hay
sitio de sobra para niveles intermedios. Ojo con el escalón 3→4, que no es
comparable con los demás: ahí cambian **cuatro cosas a la vez** (profundidad
2→3 y se encienden movilidad, ordenación y quietud), lo que por sí solo da
peldaños intermedios gratis apagándolas por separado.

## Ronda 13: calibrar el presupuesto de nodos (en cola)

Cada presupuesto contra el nivel que por coste se le parece más: 2.000 contra
el nivel 3, 10.000 contra el 4, 40.000 contra el 5 y 150.000 contra el 6.
Encadenada detrás de la 12 en el mismo script: cuando la 12 está terminada,
`arena.js` ve todos sus pares hechos y vuelve enseguida, así que el servicio
pasa de largo y sigue con la 13 sin intervención.

## Ronda 11: ¿baja el peso de movilidad con la profundidad? NO

1.162 partidas, movilidad 4 contra 2, **mismo libro, mismas aperturas, mismos
topes** a las tres profundidades (la pata de profundidad 5 son las partidas de
`r10/mov2-*.log`, que ya se jugaron con estos ajustes).

| profundidad | elo | IC 95% | p | partidas |
|---|---|---|---|---|
| 3 | +25 | [6, 43] | 0,008 | 480 |
| 4 | +39 | [14, 64] | 0,002 | 480 |
| 5 | +40 | [13, 67] | 0,003 | 202 |

Repetido con márgenes de adjudicación de 200, 300 y 500 cp: significativo en
las nueve combinaciones, y el orden entre profundidades no se invierte nunca.

**La teoría no se cumple.** Se esperaba que la movilidad, por ser un sustituto
barato de lo que la búsqueda acaba viendo, perdiera valor al profundizar. No
lo pierde: la ventaja es plana entre profundidad 4 y 5, y de hecho es MENOR a
profundidad 3. Los intervalos se solapan mucho, así que lo prudente es
quedarse con "no hay efecto detectable" antes que con "crece".

Consecuencia práctica: **no hace falta un `mobilityWeight` por nivel**.
`AI_LEVELS` admite el ajuste por si algún día hiciera falta, pero hoy ponerlo
sería afinar sobre nada. Junto con la ronda 10 (pesos 3 y 4 indistinguibles a
profundidad 5), el peso 4 único para todos los niveles queda confirmado.

## Datos

- `corp/` — corpus de posiciones del ciclo 2 (autojuego nivel 4, prof. 3).
- `libro.json` — libro de aperturas (regenerado 2026-07-27; el original se lo
  llevó el limpiador de /tmp, la comparabilidad dentro de cada tanda no cambia).
- `r4/` `r5/` `r6/` — logs de las confirmaciones (prof. 3, prof. 4 y ciclo 2).
  Los logs de la ablación original (prof. 2) se perdieron en la purga de /tmp;
  sus conclusiones están en el mensaje del commit `22407e1`.
