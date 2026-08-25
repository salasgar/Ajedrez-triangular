# entrenamiento/ — herramientas y datos del ajuste de la IA

Banco de trabajo para medir y mejorar los parámetros de `ai.js`. Vive en el
repo (y no en un directorio temporal) porque las tandas duran días y el
limpiador de `/tmp` de macOS purga por antigüedad.

## Herramientas

| Fichero | Qué hace |
|---|---|
| `arena.js` | Match emparejado entre dos configuraciones arbitrarias del motor (`CFG_A`/`CFG_B` por entorno). Misma apertura con colores invertidos; registra el balance material de las partidas cortadas para adjudicarlas en el análisis. |
| `analiza.js` | Marcador de una tanda: elo con IC 95%, z, p-valor; el margen de adjudicación se pasa como argumento para poder comprobar la robustez. |
| `aperturas.js` | Genera el libro de **una** modalidad (`MODALIDAD=dekle node aperturas.js > libro-dekle.json`): 400 aperturas fijas de 6 jugadas al azar sin capturas, para que todas las ramas comparen sobre las mismas posiciones. |
| `elo.js` | La aritmética que comparten `analiza.js` y `escalera.js`: puntos, elo, intervalo, esperado. |
| `escalera.js` | Encadena varios matches contiguos y dictamina cada escalón: imperceptible (< 50 elo), jugable, o insalvable (> 400). |
| `versus.js` | Como `arena.js`, pero compara dos **versiones del código** en contextos aislados (`motor-viejo/` contra el de ahora). |
| `modalidades.js` | Verifica las cinco modalidades por diferencia: generador rápido contra el lento, tablas de ataque contra el cálculo directo, peones sin salida, y que la IA devuelva jugada legal. |
| `valores-pdf.js` | Escribe `docs/valores-piezas.pdf`, la tabla de valores de las piezas de cada modalidad, leída de `variants.js`. Con `--check` no escribe: falla si el PDF se ha quedado atrás. |
| `corpus.js` | Fase cara del ajuste tipo Texel: autojuego que vuelca posiciones etiquetadas con el resultado (una línea JSON por posición). Shards paralelos por `SEED`; `ADJ_MARGIN` adjudica por material las partidas cortadas (imprescindible a prof. ≥3). |
| `ajusta.js` | Fase barata: la regresión sobre un corpus ya generado. `--features=mat|matmob|matpos|all`, `--holdout` para validación fuera de muestra, `--reg` para estabilidad. |
| `perft.js` | `check` (perft + dorados de búsqueda sobre 21 posiciones), `bench`, `divide`, `gen`. Lo que verifica que una optimización del motor no cambió lo que juega. |
| `test-worker.js` | Evalúa `aiWorkerSource()` en un contexto aislado y simula una petición: convierte "revienta en el navegador" en "falla un test". Obligatorio tras tocar `AI_WORKER_FNS`. |
| `prueba-humo.js` | Partida completa, circuito serializar → validar → aplicar, guardados antiguos, basura rechazada, coronación y tablas por material. Sin navegador. |

Antes de publicar (el repo se sirve con GitHub Pages desde la rama, así que
un push despliega la aplicación en vivo):

```sh
node perft.js check && node test-worker.js && node prueba-humo.js &&
  node modalidades.js && node valores-pdf.js --check
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
NUCLEOS=2 ./instalar-servicio.sh   # igual, pero ocupando solo dos núcleos
./instalar-servicio.sh estado      # ¿corre? ¿cuántas partidas lleva?
./instalar-servicio.sh resultados  # elo/IC/p de lo jugado hasta ahora
./instalar-servicio.sh parar       # detener (sigue instalado)
./instalar-servicio.sh quitar      # desinstalar del arranque
```

**`NUCLEOS` es el mando para decidir cuánta máquina se lleva esto** (6 por
defecto). Cada proceso es de un solo hilo y ocupa un núcleo entero, así que
`NUCLEOS=2` son dos núcleos de los ocho; las tandas y los ficheros son
exactamente los mismos, solo que en más oleadas. Lo único que cambia es el
reloj de pared, y de forma proporcional: la fase de corpus de la ronda 15 son
2 horas de CPU por modalidad, o sea 20 minutos con los seis procesos y una
hora con dos. El valor queda escrito en el plist, así que sobrevive a los
reinicios y a `parar`/`arrancar`; para cambiarlo se reinstala.

### Horario: muchos núcleos de noche, pocos de día

`horario-nucleos.txt`, si existe, manda sobre `NUCLEOS`. Lleva una línea con
tres números: el instante límite en segundos desde 1970, los núcleos hasta ese
momento y los de después.

```
1785742343 8 2      # 8 núcleos hasta las 09:32, luego 2
```

**Es una hora absoluta a propósito, no un temporizador.** Un `sleep 7h` se
muere con el ordenador y al encenderlo otra vez volvería a contar siete horas
desde cero, que es lo contrario de lo que se quiere. Con una fecha en un
fichero, el guion mira el reloj al arrancar y sabe en qué tramo está, tanto si
el ordenador ha estado apagado cinco minutos como dos días. Pasado el límite se
queda en el segundo número indefinidamente.

El cambio de tramo no espera a que termine nada: al llegar la hora se **cortan
los procesos que sobran del cupo**, empezando por los últimos lanzados. Si no,
ocho arenas recién empezadas tendrían el ordenador ocupado horas después de la
hora convenida. Es barato porque todo se reanuda: una arena guarda cada partida
según la termina y pierde como mucho la que estuviera jugando; un shard de
corpus pierde sus 20 minutos, porque su línea de resumen es lo último que
escribe. Lo cortado no se da por hecho, así que la pasada siguiente lo retoma.

`./instalar-servicio.sh estado` dice en qué tramo va y hasta cuándo.

Lo que **no** hay que hacer es bajar la banda de prioridad (ver más abajo). Y
si el limitador se escribiera con `jobs -rp`, que es lo natural, no limitaría
nada: en un zsh no interactivo el control de trabajos está apagado y esa lista
sale siempre vacía, así que arrancarían todos de golpe sin dar ningún error.
Por eso `entrenamiento-continuo.sh` lleva la cuenta de los PID a mano.

Dos cosas que conviene saber:

- **La reanudación la hace `arena.js`, no launchd.** Con `SALIDA=<fichero>`
  añade cada partida al fichero (con volcado a disco inmediato) y al arrancar
  se salta los pares que ya estén dentro. Un corte solo pierde la partida a
  medias; el resto no se repite. Verificado matando el servicio con SIGKILL:
  launchd lo relanzó en 60 s y no duplicó ninguna partida.
- **El servicio no trabaja dentro del repo.** macOS no deja que un LaunchAgent
  lea `~/Documents`, así que `instalar-servicio.sh` copia el motor y las
  herramientas a `~/Library/Application Support/ajedrez-triangular-entrenamiento`
  y trabaja ahí (`MOTOR=` le dice dónde está el motor; lo entienden `arena.js`,
  `corpus.js`, `ajusta.js` y `aperturas.js`, que antes tenían la ruta del repo
  escrita a fuego y por eso no podían correr como servicio). La copia es una
  foto fija: para entrenar con una versión nueva del motor, vuelve a ejecutar
  `./instalar-servicio.sh`.
- **Desde la ronda 15 el servicio hace el ciclo entero solo**: corpus,
  regresión y arena, sin copiar a mano el `CFG=` de una fase a la siguiente.
  Antes la fase 1 había que lanzarla desde el repo porque las herramientas no
  sabían salir de él.
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

## Ronda 12: la escalera de elo de los niveles VIEJOS (cerrada)

El selector prometía "Fácil", "Difícil" o "Experto" sin que nadie hubiera
medido nunca cuánto se llevan entre sí. Parejas contiguas, niveles definidos
entonces por profundidad fija:

| escalón | elo | partidas |
|---|---|---|
| nivel 2 → 3 | 1040 | 400 |
| nivel 3 → 4 | 849 | 400 |
| nivel 4 → 5 | 198 | 400 |
| nivel 5 → 6 | 193 | 368 |

Dos muros abajo y dos peldaños cómodos arriba: el principiante no pasaba del
nivel 2 y la mitad de la escalera estaba desaprovechada. **Esta es la medida
que motivó tirar los niveles por profundidad**, así que no se relanzó el
escalón que faltaba. Ojo además con el 3 → 4, que no era comparable con los
demás: ahí cambiaban cuatro cosas a la vez (profundidad 2→3 y se encendían
movilidad, ordenación y quietud).

## Ronda 13: la escalera de los niveles NUEVOS (por presupuesto de nodos)

Los niveles ya no son profundidades sino presupuestos de nodos. Misma
pregunta, escalera nueva. Datos con el motor corregido (ver más abajo);
todavía en curso, los intervalos son al 95 %:

| escalón | presupuesto | elo | IC 95 % | partidas |
|---|---|---|---|---|
| n23 | 300 t150 → 5.000 t70 | 433 | [379, 506] | 288 |
| n34 | 5.000 t70 → 4.500 | 798 | [691, 1121] | 400 |
| n45 | 4.500 → 16.000 (×3,6) | 158 | [118, 203] | 218 |
| n56 | 16.000 → 60.000 (×3,75) | 213 | [136, 314] | 55 |

**Lo que sale bien**: la parte de arriba, donde lo único que cambia es el
presupuesto. Multiplicarlo por 3,6-3,75 vale 158 y 213 elo, o sea **unos 100
elo por cada vez que se dobla**. Los niveles 4 a 8 van multiplicando por esa
misma proporción, así que esa mitad de la escalera ya es pareja y no hay que
tocarla.

**Lo que sale mal**: la parte de abajo, 433 y 798 elo. Y el 798 tiene una
lectura muy limpia, porque enfrenta el nivel 3 (5.000 nodos, temperatura 70)
con el nivel 4 (4.500 nodos): el que pierde 99 de cada 100 partidas es el que
**más** presupuesto tiene. El presupuesto no explica nada ahí — los 798 elo
los paga enteros la temperatura (742 con margen de adjudicación 500, así que
no es cosa del margen).

El par no contiguo n25 (nivel 2 contra nivel 5) quedó 400-0. Es **compatible**
con la suma de sus escalones, pero no la comprueba: a 1.389 elo de distancia,
cualquier hueco de más de ~700 elo daría el mismo 400-0. La transitividad de
la escalera sigue sin poner a prueba, y para ponerla hará falta un par no
contiguo *corto*, de dos peldaños.

### Los primeros datos de la ronda 13 hubo que tirarlos

La primera tanda dio 20 elo para el escalón 5 → 6, con casi cuatro veces más
presupuesto. Era mentira: los dos rivales **compartían la tabla de
transposición**. Su firma (`ttCfgSig`) solo incluía lo que afecta a la
*evaluación*, y estas dos configuraciones se diferencian únicamente en el
presupuesto, así que el que pensaba poco se encontraba hechas las cuentas del
que pensaba mucho. Las rondas anteriores se libraron por casualidad, porque
sus ramas se diferenciaban en `mobilityWeight`, que sí estaba en la firma.
Arreglado añadiendo `nodes`, `temperature` y `depth`; comprobado contando
firmas y limpiezas antes y después (1 firma / 1 limpieza en 12 jugadas → 2
firmas / 12 limpiezas). Los datos malos están en `r13-tt-compartida/`.

## Ronda 14: la curva de la temperatura (a medias, detrás de la 15)

Tiene hechas `t_poda`, `t00_10` y `t10_25`, con 400 partidas cada una, y le
faltan `t25_45`, `t45_70` y `t70_150`. En el guion ha bajado detrás de la ronda
15 —no está comentada ni desactivada: retoma sus tres ramas en cuanto la 15
cierre—, porque un valor de pieza inventado se nota jugando y una etiqueta de
nivel mal calibrada, mucho menos.

Si la temperatura 70 cuesta ~800 elo, es un mando demasiado brusco para un
peldaño, y hay que saber cómo se comporta entre 0 y 70. Presupuesto congelado
en 4.500 nodos y solo cambia la temperatura: 0 → 10 → 25 → 45 → 70, más
70 → 150 por debajo.

Con un sexto par aparte, `t_poda`, porque **los 798 elo son de dos cosas y no
de una**: poner temperatura cambia además *cómo* se busca. Para repartir
probabilidad entre las jugadas hacen falta las puntuaciones de todas, así que
la raíz va con ventana completa y se pierden las podas. Con el presupuesto
congelado eso solo ya cuesta profundidad. `t_poda` enfrenta «sin temperatura»
con «temperatura 0,0001» —que no cambia ninguna jugada, porque
exp(−100/0,0001) es 0, pero pasa por el mismo camino de código—, de modo que
la única diferencia entre los dos es la pérdida de podas. Separa el efecto
lateral de la implementación del mando que se quiere graduar.

Comprobación incluida: los cinco escalones de 0 a 70 tienen que sumar los
~798 elo que la ronda 13 midió de un tirón.

## Ronda 15: los valores de las piezas de cada modalidad (la siguiente)

Es la primera que ejecuta el guion de las que quedan vivas: va **antes** que la
14, que se quedó a medias.

Las catorce rondas anteriores midieron el ajedrez de Salas, y ninguna lo dijo:
no exportaban `MODALIDAD`, así que jugaban la de por defecto. Desde que hay
cinco modalidades eso ya no vale. **Un log sin modalidad en la cabecera es de
Salas, por descarte; de la 15 en adelante, todos la llevan escrita** —en cada
proceso, en el nombre de cada fichero y en la cabecera de cada log.

De las cinco, solo Salas tiene los valores de las piezas medidos. Los otros
están puestos a ojo, y se nota en cómo aparecen escritos en `variants.js`: la
torre de 1998 «se copia del elefante», su dama «se estima con la misma
proporción», el unicornio de Dekle vale 400 «como la torre» porque hay que
poner algo.

| modalidad | valores | de dónde salen |
|---|---|---|
| `salas` | P100 N265 B335 E358 R483 Q981 | medidos, confirmados en la arena (ronda 6) |
| `salas-1998` | P100 N265 B335 R358 Q810 | a ojo |
| `dekle` | P100 N300 B320 U400 R400 Q800 | a ojo |
| `trigonal` | P100 N300 B400 R500 Q900 | a ojo, los del ajedrez normal |

Y no hay razón para esperar que se parezcan: el alfil de Trigonal va en
zigzag, el de Dekle no está atado al color, y en 1998 el tablero tiene 64
casillas en vez de 96, así que las mismas piezas tienen otro alcance. Un valor
de pieza mal puesto es de los errores que peor se ven y peor sientan: el motor
busca perfectamente, pero hacia donde no debe.


**Una modalidad entera cada vez**, con el ciclo de ajuste completo —el mismo de
la ronda 6— y sin intervención manual entre fases:

| fase | qué hace | procesos |
|---|---|---|
| 0 | el libro de aperturas de la modalidad, si falta | 1 |
| 1 | corpus de autojuego (`corpus.js`, `ADJ_MARGIN=300`) | 6 shards × 20 min |
| 2 | la regresión (`ajusta.js`), dos veces: `mat` y `all` | 2, segundos |
| 3 | arena: cada candidato contra los valores **vigentes** | 2 ramas × 3 shards |

Tres cosas que hacen que la ronda signifique algo:

- **La fase 3 es la que decide.** La regresión minimiza el error al predecir el
  resultado de una partida, que no es lo mismo que jugar mejor: en la ronda 6
  el candidato de la regresión perdió contra los valores de entonces. Nada
  entra en `variants.js` sin ganar antes en la arena.
- **Los dos candidatos se miden contra el mismo rival, no entre sí.** Así las
  dos preguntas —¿mejora el material?, ¿aportan algo los pesos posicionales?—
  se contestan de una tanda. Comparándolos entre ellos no se sabría si alguno
  mejora lo que ya hay.
- **El candidato se juega con el presupuesto de la arena, no con el del
  corpus.** `ajusta.js` imprime su `CFG=` con `"depth":2`, que es como se jugó
  el autojuego; pasarlo tal cual haría que la arena comparase además dos
  profundidades y no se sabría a qué atribuir la diferencia. El guion se queda
  solo con lo ajustado (valores, pesos posicionales, peso de movilidad) y le
  pega el presupuesto fijo de 4.500 nodos.

Se reanuda a tres niveles, porque son horas de máquina: un shard de corpus está
hecho cuando tiene su línea de resumen (lo último que escribe `corpus.js`), una
arena se salta los pares que ya estén en su log, y una modalidad no se da por
terminada porque los procesos hayan vuelto sino porque las 840 partidas están
en el disco (`r15/<modalidad>-hecha.txt`).

### Resultado (tarea 10 del reparto, 2026-08-25)

Cerró el 2026-08-04 con corpus completo (8 shards, ~350.000 posiciones por
modalidad) y 424 partidas de arena por candidato (margen de adjudicación
300 cp). `A` es siempre la configuración vigente en `variants.js` antes de la
tarea, `B` el candidato de la regresión:

| modalidad | candidato | elo(A-B) | IC 95% | p | ¿entra? |
|---|---|---|---|---|---|
| `dekle` | `all` (con pesos posicionales) | -28 | [-56, -0] | 0.046 | **sí, al límite** |
| `dekle` | `mat` (solo material) | -4 | [-31, 23] | 0.76 | no |
| `salas-1998` | `all` | +20 | [-4, 43] | 0.10 | no |
| `salas-1998` | `mat` | +21 | [-2, 45] | 0.07 | no |
| `trigonal` | `all` | +76 | [48, 104] | <0.0001 | no (pierde claro) |
| `trigonal` | `mat` | 0 | [-27, 27] | 1.00 | no (empate exacto) |

Solo `dekle` entra: `N298 B320 U378 R392 Q750`, movilidad 7.63 (antes
`N300 B320 U400 R400 Q800`, movilidad 4). El resto se queda con sus valores a
ojo — `salas-1998` porque ninguno de los dos candidatos fue significativo, y
`trigonal` porque su candidato `all` pierde con claridad (el `mat` empata
exacto) y su regresión ya avisaba: logloss de validación **peor**, no mejor,
que los valores a ojo (`ajuste-trigonal-all.txt`, la única de las seis con esa
marca).

**Trigonal llevaba desde el 2026-08-04 con el candidato perdedor aplicado.**
El commit `c388624c` («Ronda 15: valores de Trigonal Chess medidos y
confirmados en arena») leyó `elo(A-B): 76 [48, 104]` —A por delante, o sea el
candidato perdiendo por 76 elo— como si el candidato hubiera ganado +76, y lo
aplicó a `variants.js`. Revertido en esta tarea: valores a ojo de vuelta
(`N300 B360→400 R469→500 Q785→900`… ver el diff). Tres semanas jugando
Trigonal con un alfil, una torre y una dama infravalorados sin que se notara
—precisamente el tipo de error que la nota de la tabla de arriba avisa que es
«de los que peor se ven y peor sientan»—.

Detrás de la 15 en el guion viene la ronda 14 (curva de temperatura): **ya
está completa**, los 6 pares incluido `t_poda`, aunque quedó registrada como
«a medias» en una memoria de hace tres semanas. No se toca aquí —no es el
encargo de esta tarea—; sus resultados están en `r14/` para quien decida
aplicarlos.

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

## La tabla de valores en PDF

`docs/valores-piezas.pdf` es la tabla de los valores de las piezas de todas las
modalidades, con el tablero de cada una y de dónde salen sus números. **Se
genera, no se escribe a mano**: `node valores-pdf.js` la lee del bloque
`engine` de `variants.js`, que es la única fuente de verdad. Una tabla copiada
a mano estaría mal al segundo cambio y nadie se enteraría, porque nada la
compara con el motor.

Para que no se quede atrás sola, hay dos redes:

- **El gancho de pre-commit** (`.git/hooks/pre-commit`, que instala
  `instalar-servicio.sh` desde `pre-commit.sh`) regenera el PDF y lo mete en el
  mismo commit cuando el commit toca `variants.js`. Los ganchos no viajan
  dentro del repo, de ahí la copia.
- **`node valores-pdf.js --check`** falla si el PDF no refleja los valores de
  hoy. Va en la lista de comprobaciones de antes de publicar. Ignora la fecha
  de generación, que cambia todos los días sin que cambie ningún valor.

Cuando una ronda cambie valores, hay que tocar también
`valores-origen.json`: es la nota de cada fila («medidos y confirmados en la
arena», «estimados a ojo»), y es lo único de la tabla que no se puede deducir
del código.

El PDF se escribe a mano byte a byte (unas 60 líneas en `valores-pdf.js`), sin
librerías, como todo lo demás del repo. Un aviso por si se edita: el texto va
en latin1, así que los guiones largos y las comillas tipográficas hay que
sustituirlos antes o desaparecen de la página sin dar ningún error.

## Datos

- `corp/` — corpus de posiciones del ciclo 2 (autojuego nivel 4, prof. 3).
- `libro-<modalidad>.json` — un libro de aperturas **por modalidad**. Las
  jugadas son claves de casilla y no valen de una a otra: de 100 aperturas de
  Salas solo 44 son legales en Dekle (las de peón, que se mueve igual) y
  ninguna en Trigonal, que ni siquiera tiene el mismo tablero. Un libro
  equivocado no revienta, sesga la muestra en silencio, así que `arena.js` coge
  por defecto el de su modalidad y comprueba al arrancar que las primeras 20
  aperturas sean legales.
- `libro.json` — el libro viejo, idéntico a `libro-salas.json` (regenerado
  2026-07-27; el original se lo llevó el limpiador de /tmp). Lo siguen usando
  `ronda6-fase3.sh`, `ronda7-versus.sh` y `ruido-anotaciones.js`.
- `r4/` `r5/` `r6/` — logs de las confirmaciones (prof. 3, prof. 4 y ciclo 2).
  Los logs de la ablación original (prof. 2) se perdieron en la purga de /tmp;
  sus conclusiones están en el mensaje del commit `22407e1`.
