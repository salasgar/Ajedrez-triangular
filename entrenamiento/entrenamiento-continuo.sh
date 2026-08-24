#!/bin/zsh
# Entrenamiento de fondo que SOBREVIVE A APAGONES Y REINICIOS.
#
# Lo arranca solo macOS al iniciar sesión (ver instalar-servicio.sh) y también
# se puede lanzar a mano. Cada proceso escribe su propio fichero con SALIDA=,
# y arena.js se salta al arrancar los pares que ya estén ahí: si el ordenador
# se apaga, al volver se reanuda por donde iba sin repetir ni perder partidas.
#
# LAS RONDAS VAN UNA DETRÁS DE OTRA EN ESTE MISMO FICHERO, en el orden en que
# se quieren ejecutar, que ya no es el de su número: la 15 va antes que la 14.
# Una ronda terminada no se borra: se queda con sus conclusiones escritas al
# lado, y al pasar por ella el guion la ve hecha y sigue de largo en segundos.
# Así el fichero es a la vez el programa y el cuaderno de campo.
#
# TODAS LAS RONDAS HASTA LA 14 MIDIERON EL AJEDREZ DE SALAS Y NINGUNA LO DIJO:
# no exportaban MODALIDAD, así que jugaban la de por defecto. Desde que hay
# cinco modalidades eso ya no vale, y la ronda 15 en adelante llevan la
# modalidad escrita en cada proceso, en el nombre de cada fichero y en la
# cabecera de cada log. Un log sin modalidad es de Salas, por descarte.
#
# RONDA 12: ESCALERA DE ELO DE LOS NIVELES.
#
# El selector de nivel de la interfaz promete "Fácil", "Difícil", "Experto"…
# sin que nadie haya medido nunca cuánto se llevan de verdad entre sí. Esta
# ronda enfrenta cada nivel con el siguiente; encadenando las diferencias sale
# la escalera completa, y con ella se pueden poner etiquetas honestas.
#
# Solo parejas CONTIGUAS, no todos contra todos: con 4 procesos, medir bien 4
# escalones vale más que medir mal 21 parejas, y la escalera se reconstruye
# igual sumando los escalones.
#
#   e23: nivel 2 (codicioso) contra nivel 3 (minimax prof. 2)
#   e34: nivel 3 contra nivel 4 (prof. 3, con movilidad, orden y quietud)
#   e45: nivel 4 contra nivel 5 (prof. 4)
#   e56: nivel 5 contra nivel 6 (prof. 5)
#
# Falta el escalón 6-7 (profundidad 6): a ese ritmo no cabe en la misma tanda.
# Queda para una ronda propia cuando esta termine.
#
# Las rondas 10 y 11 quedan intactas en r10/ y r11/. La 11 contesto que el
# peso de movilidad NO depende de la profundidad (ver README).
cd "$(dirname "$0")"
mkdir -p r12

# Mismos topes que las rondas 10 y 11, para que los numeros sean comparables
# con todo lo medido hasta ahora.
#
# MOTOR: el servicio trabaja sobre la copia del motor que le deja
# instalar-servicio.sh en su directorio (macOS no le deja leer ~/Documents).
# Lanzado a mano desde el repo esa copia no existe, y entonces se usa el propio
# repo: asi el guion se puede probar tal cual antes de instalarlo.
if [ -d "$(pwd)/motor" ]; then
  export MOTOR="$(pwd)/motor"
else
  export MOTOR="$(cd .. && pwd)"
fi
export LIBRO=libro.json MAX_PLIES=80 FIFTY=40

# CUANTOS PROCESOS A LA VEZ. Es el unico mando para decidir cuanta maquina se
# lleva el entrenamiento, y el bueno: cada proceso es de un solo hilo y come un
# nucleo entero, asi que NUCLEOS=2 son dos nucleos ocupados de los ocho.
#
#   NUCLEOS=2 ./entrenamiento-continuo.sh      a mano
#   NUCLEOS=2 ./instalar-servicio.sh           como servicio (queda en el plist)
#
# NO SE HACE BAJANDO LA BANDA DE PRIORIDAD, que es lo que parece razonable y es
# una trampa: ProcessType=Background confina el proceso a los nucleos de
# eficiencia y lo deja 6,9 veces mas lento (ver el plist en
# instalar-servicio.sh). Cuatro procesos rapidos rinden mucho mas que seis
# estrangulados. Con Nice 10 + LowPriorityIO, dos procesos ceden el paso al
# trabajo en primer plano y aun asi corren a velocidad plena.
#
# Bajar NUCLEOS no cambia NADA de lo que se mide: las tandas son las mismas y
# los mismos ficheros, solo que en mas oleadas. Lo unico que cambia es cuanto
# tarda el reloj de pared.
NUCLEOS=${NUCLEOS:-6}

# HORARIO: usar muchos nucleos de noche y pocos de dia.
#
# El fichero horario-nucleos.txt, si existe, lleva una linea con tres numeros:
#
#   <instante limite en segundos desde 1970>  <nucleos antes>  <nucleos despues>
#
# ES UNA HORA ABSOLUTA A PROPOSITO, no un temporizador. Un `sleep 7h` se muere
# con el ordenador y al encenderlo otra vez volveria a contar siete horas desde
# cero, que es justo lo contrario de lo que se quiere. Una fecha en un fichero
# sobrevive al apagon: al arrancar, el guion mira el reloj y sabe en que tramo
# esta, tanto si se ha apagado cinco minutos como dos dias.
#
# Cuando el limite ya ha pasado, se queda en el segundo numero para siempre,
# que es el comportamiento razonable: pasada la noche, el entrenamiento se
# queda pequeño hasta que alguien diga otra cosa.
HORARIO=horario-nucleos.txt
nucleos_ahora() {
  local linea
  linea=$(grep -v '^#' $HORARIO 2>/dev/null | grep -v '^$' | head -1)
  if [ -n "$linea" ]; then
    local -a campos
    campos=(${=linea})
    if [ ${#campos} -ge 3 ]; then
      if [ "$(date +%s)" -lt "$campos[1]" ]; then echo $campos[2]; else echo $campos[3]; fi
      return
    fi
  fi
  echo $NUCLEOS
}

# Lleva la cuenta de los PID a mano porque `jobs` no vale: en un zsh no
# interactivo el control de trabajos esta apagado y la lista sale siempre
# vacia, asi que un limitador escrito con `jobs -rp` los lanzaria todos de
# golpe sin dar ningun error.
LANZADOS=()
poda_lanzados() {
  local vivos=()
  for p in $LANZADOS; do
    if kill -0 $p 2>/dev/null; then vivos+=($p); fi
  done
  LANZADOS=($vivos)
}

# Espera a que quede sitio antes de lanzar otro proceso. Relee el horario en
# cada vuelta, asi que si el limite cae en mitad de una fase, las oleadas que
# quedan por lanzar ya salen con el cupo nuevo.
espera_hueco() {
  while true; do
    poda_lanzados
    if (( ${#LANZADOS} < $(nucleos_ahora) )); then break; fi
    sleep 5
  done
}

# Sustituye a `wait`. Ademas de esperar, HACE CUMPLIR EL CUPO sobre los
# procesos que ya estan corriendo: si el limite del horario cae con ocho
# arenas en marcha, esperar a que terminen dejaria el ordenador ocupado horas
# despues de la hora convenida. Se cortan los ultimos lanzados, que es lo que
# menos trabajo tira:
#
#   - una arena guarda cada partida en el disco segun la termina, asi que
#     pierde como mucho la que estuviera jugando y se reanuda sola;
#   - un shard de corpus pierde sus 20 minutos, porque su linea de resumen es
#     lo ultimo que escribe y sin ella se rehace entero. Es el precio de
#     devolver la maquina a su hora, y son minutos, no horas.
#
# Lo cortado no se pierde de vista: la modalidad no se dara por terminada y el
# reintento de mas abajo (o el siguiente arranque del servicio) lo retoma.
espera_a_todos() {
  while true; do
    poda_lanzados
    if (( ${#LANZADOS} == 0 )); then break; fi
    local tope=$(nucleos_ahora)
    while (( ${#LANZADOS} > tope )); do
      local p=$LANZADOS[-1]
      pkill -P $p 2>/dev/null
      kill $p 2>/dev/null
      wait $p 2>/dev/null      # recogerlo aqui mismo; si no, queda de zombi y
      LANZADOS[-1]=()          # kill -0 seguiria diciendo que sigue vivo
    done
    sleep 5
  done
  wait      # recoge los que hayan terminado solos
}

# Las configuraciones son las de AI_LEVELS tal cual: aqui no se experimenta
# con parametros, se mide lo que el jugador recibe al elegir cada nivel.
N2='"depth":1'
N3='"depth":2'
N4='"depth":3,"mobility":true,"order":true,"quiesce":true'
N5='"depth":4,"mobility":true,"order":true,"quiesce":true'
N6='"depth":5,"mobility":true,"order":true,"quiesce":true'

lanzar() {
  local nombre=$1 cfgA=$2 cfgB=$3 nA=$4 nB=$5
  SALIDA=r12/$nombre.log FIRST=1 PAIRS=200 SEED=17000 \
    CFG_A="{$cfgA}" CFG_B="{$cfgB}" NAME_A=$nA NAME_B=$nB \
    node arena.js >> r12/$nombre.err 2>&1
}

# RONDA 12 CERRADA. Median los niveles POR PROFUNDIDAD, que ya no existen: sus
# resultados son los que motivaron sustituirlos, y ahi se quedan como
# constancia. No se relanza —terminar el ultimo escalon seria gastar la
# maquina en medir algo que hemos borrado—. Los logs siguen en r12/.
#
#   nivel 2 -> 3: -1040 elo   (400 partidas)
#   nivel 3 -> 4:  -849       (400)
#   nivel 4 -> 5:  -198       (400)
#   nivel 5 -> 6:  -193       (368)
#
# Dos escalones insalvables abajo y dos razonables arriba: el principiante no
# podia pasar del nivel 2 y el resto de la escalera estaba desaprovechada.

# ---------------------------------------------------------------------------
# RONDA 13: CALIBRAR EL PRESUPUESTO DE NODOS
#
# Va detrás de la 12 sin más ceremonia: cuando la 12 está terminada, arena.js
# ve que todos sus pares están hechos y vuelve enseguida, así que el script
# sigue de largo hasta aquí. Y si un apagón corta a mitad de la 13, al
# reanudar pasa otra vez de largo por la 12 y retoma donde iba.
#
# QUE SE MIDE. Los niveles ya NO son por profundidad: desde el rediseño, cada
# uno es un presupuesto de nodos (ver AI_LEVELS en ai.js). Esta ronda mide la
# escalera NUEVA, cada nivel contra el siguiente, igual que la 12 midió la
# vieja. Si los peldaños salen desiguales, se corrigen moviendo presupuestos,
# que ahora es un mando continuo y no un salto de 4-6 veces el trabajo.
#
# Los escalones altos (6-7 y 7-8) no entran aquí: a 1 y 4,5 segundos por
# jugada, una partida cuesta demasiado para la misma tanda. Van en su propia
# ronda cuando esta termine.
#
# EL TOPE DE PROFUNDIDAD VA MUY ALTO (24) A PROPOSITO. Con un presupuesto de
# nodos, el tope no debe llegar a estorbar nunca, y con pocas piezas estorba
# enseguida: al bajar el factor de ramificacion, el mismo presupuesto compra
# mucha mas profundidad. Medido con 10.000 nodos:
#
#   apertura (40 piezas) -> profundidad 3
#   final (10 piezas)    -> profundidad 4
#   final minimo (4)     -> profundidad 8   (con tope 6 se quedaba en 6)
#
# Y con 50.000 nodos en el final minimo: profundidad 12 con tope alto, contra
# 6 en 0 ms con tope 6, o sea sin gastar siquiera el presupuesto. Poner el
# tope bajo tira justamente la mejor virtud de este mando —profundizar donde
# hay poco que mirar— y encima donde mas falta hace, porque los finales se
# ganan con secuencias largas. En la apertura el tope no cambia nada: alli
# manda el presupuesto.
mkdir -p r13
TOPE='"depth":24,"mobility":true,"order":true,"quiesce":true'

# los niveles nuevos, tal como estan en AI_LEVELS
L2="$TOPE,\"nodes\":300,\"temperature\":150"
L3="$TOPE,\"nodes\":5000,\"temperature\":70"
L4="$TOPE,\"nodes\":4500"
L5="$TOPE,\"nodes\":16000"
L6="$TOPE,\"nodes\":60000"

escalon() {
  local nombre=$1 cfgA=$2 cfgB=$3 nA=$4 nB=$5
  SALIDA=r13/$nombre.log FIRST=1 PAIRS=200 SEED=19000 \
    CFG_A="{$cfgA}" CFG_B="{$cfgB}" NAME_A=$nA NAME_B=$nB \
    node arena.js >> r13/$nombre.err 2>&1
}

espera_hueco; escalon n23 "$L2" "$L3" nivel2 nivel3 & LANZADOS+=($!)
espera_hueco; escalon n34 "$L3" "$L4" nivel3 nivel4 & LANZADOS+=($!)
espera_hueco; escalon n45 "$L4" "$L5" nivel4 nivel5 & LANZADOS+=($!)
espera_hueco; escalon n56 "$L5" "$L6" nivel5 nivel6 & LANZADOS+=($!)
# PAR NO CONTIGUO, para comprobar que la escalera es UNA SOLA ESCALA. Encadenar
# escalones supone transitividad, y no tiene por que cumplirse: un estilo puede
# irle mejor a un rival que a otro, y la tasa de tablas cambia con la fuerza.
# Si el 2 contra el 5 no cuadra con la suma de n23+n34+n45, el elo acumulado es
# orientativo y no una escala.
espera_hueco; escalon n25 "$L2" "$L5" nivel2 nivel5 & LANZADOS+=($!)
espera_a_todos
echo "RONDA 13 TERMINADA $(date '+%Y-%m-%d %H:%M')" >> r13/estado.txt

# ---------------------------------------------------------------------------
# RONDA 15: LOS VALORES DE LAS PIEZAS DE CADA MODALIDAD
#
# VA ANTES QUE LA 14, QUE SE QUEDÓ A MEDIAS. Es una decisión de prioridad, no
# un abandono: la 14 afina las etiquetas del selector de nivel en una modalidad
# que ya juega bien, y la 15 arregla que otras tres jueguen con valores de
# pieza inventados. Lo segundo se nota jugando y lo primero no. La 14 sigue
# entera al final del fichero y retoma sus tres ramas pendientes en cuanto la
# 15 cierre; no hay nada comentado ni que acordarse de descomentar.
#
# EL PROBLEMA. De las cinco modalidades, solo el ajedrez de Salas tiene los
# valores de las piezas medidos. Los de las otras tres están puestos a ojo, y
# se nota en cómo están escritos en variants.js: la torre de 1998 «se copia
# del elefante», la dama «se estima con la misma proporción», el unicornio de
# Dekle vale 400 «como la torre» porque hay que poner algo. Son conjeturas
# razonables, no medidas, y una conjetura razonable en el valor de una pieza
# es exactamente el tipo de error que hace jugar mal a un motor por lo demás
# correcto: cambia lo que cree que es una buena jugada en cada posición.
#
#   salas       P100 N265 B335 E358 R483 Q981   <- medida y confirmada (ronda 6)
#   salas-1998  P100 N265 B335 R358 Q810        <- a ojo
#   dekle       P100 N300 B320 U400 R400 Q800   <- a ojo
#   trigonal    P100 N300 B400 R500 Q900        <- a ojo, valores del ajedrez normal
#
# Y no hay razón para esperar que se parezcan: el alfil de Trigonal va en
# zigzag, el alfil de Dekle no está atado al color, y en 1998 el tablero tiene
# 64 casillas en vez de 96, así que las mismas piezas tienen otro alcance.
#
# salas-2026 no entra: hereda el motor de salas (solo cambia la coronación de
# flanco), y esa regla no toca el valor de ninguna pieza salvo, como mucho, el
# del peón. Si alguna vez se quiere medir eso, es una ronda propia.
#
# QUÉ SE MIDE. El ciclo de ajuste completo, el mismo de la ronda 6, aplicado a
# cada modalidad por separado:
#
#   fase 0  el libro de aperturas de la modalidad, si no está hecho
#   fase 1  corpus de autojuego (caro, en shards paralelos)
#   fase 2  la regresión sobre ese corpus (barata), dos veces:
#             mat  solo el material (los pesos posicionales a cero, como hoy)
#             all  material + centralidad + avance + movilidad
#   fase 3  arena: cada candidato contra los valores VIGENTES de la modalidad
#
# La fase 3 es la que decide. La regresión minimiza el error al predecir el
# resultado de una partida, que no es lo mismo que jugar mejor: en la ronda 6
# el candidato de la regresión perdió contra los valores de entonces. Nada
# entra en variants.js sin ganar antes en la arena.
#
# UNA MODALIDAD ENTERA CADA VEZ, no las tres a la vez. Con seis procesos
# repartidos entre tres modalidades, las tres tardarían el triple y ninguna
# daría una respuesta cerrada hasta el final. De la otra manera, cada día sale
# una modalidad decidida y publicable.
#
# LOS DOS CANDIDATOS SE MIDEN POR SEPARADO Y CONTRA EL MISMO RIVAL. Si se
# comparasen entre sí no se sabría cuál de los dos —si alguno— mejora lo que
# hay; midiendo los dos contra los valores vigentes, las dos preguntas
# (¿mejora el material?, ¿aportan algo los pesos posicionales?) se contestan
# de una tanda.
mkdir -p r15

MODALIDADES_R15=(salas-1998 dekle trigonal)
# El trabajo se parte SIEMPRE en estos trozos, haya los nucleos que haya: 8
# shards de corpus y 4 procesos por rama de arena, que es lo que llena la
# maquina entera cuando se le deja. Con el cupo bajo salen en mas oleadas.
CORPUS_SHARDS=8           # 8 x 20 min = 2 h 40 min de CPU por modalidad
CORPUS_MINUTOS=20
CORPUS_CFG='{"depth":2,"order":true}'
SHARDS_ARENA=4
PARES_SHARD=53            # 4 x 53 = 212 pares = 424 partidas por rama
OBJETIVO_R15=$((2 * SHARDS_ARENA * PARES_SHARD * 2))   # dos ramas, dos colores
# Adjudicar por material las partidas que no acaban solas. Sin esto se tira la
# mayor parte del computo: a este nivel casi ninguna partida da mate dentro del
# tope de jugadas (ver corpus.js y el README).
ADJ=300
# Presupuesto de la arena: el del nivel 4, que es el que juega la mayoria de la
# gente y con el que se midieron las rondas 13 y 14.
FIJO_R15='"depth":24,"mobility":true,"order":true,"quiesce":true,"nodes":4500'

# Coge la linea CFG= que imprime ajusta.js y le pega el presupuesto de la
# arena, quedandose SOLO con lo ajustado (valores, pesos posicionales y peso de
# movilidad). El CFG de ajusta.js viene con "depth":2, que es como se jugo el
# corpus y no como se quiere medir: si se pasara tal cual, la arena compararia
# ademas dos profundidades distintas y no se sabria a que atribuir la
# diferencia.
cfg_arena() {
  node -e '
    const fs = require("fs");
    const l = fs.readFileSync(process.argv[1], "utf8").split("\n")
      .find(x => x.startsWith("CFG="));
    if (!l) { process.stderr.write("sin linea CFG= en " + process.argv[1] + "\n"); process.exit(1); }
    const c = JSON.parse(l.slice(4));
    const out = JSON.parse("{" + process.argv[2] + "}");
    for (const k of ["pieceValues", "positionWeights", "mobilityWeight"]) {
      if (c[k] !== undefined) out[k] = c[k];
    }
    process.stdout.write(JSON.stringify(out));
  ' "$1" "$FIJO_R15"
}

for M in $MODALIDADES_R15; do
 # HASTA TRES PASADAS POR MODALIDAD. Una pasada puede quedarse corta sin que
 # haya nada roto: si el limite del horario cae en mitad de la fase 3, se
 # cortan los procesos que sobran del cupo y faltaran partidas. Como todo se
 # reanuda, la pasada siguiente solo juega lo que falte y cuesta lo que falte.
 # El tope de tres es para no dar vueltas eternas si lo que falla es otra cosa;
 # en ese caso la modalidad queda como INCOMPLETA en estado.txt y el servicio
 # volvera a intentarlo la proxima vez que arranque.
 for intento in 1 2 3; do
  [ -f r15/$M-hecha.txt ] && break

  # --- fase 0: el libro de aperturas de esta modalidad ---
  # Las jugadas son claves de casilla y no valen de una modalidad a otra (ver
  # aperturas.js). Se genera aparte y se renombra al final para que un corte a
  # medias no deje un libro truncado que luego se daria por bueno.
  if [ ! -s libro-$M.json ]; then
    MODALIDAD=$M node aperturas.js > libro-$M.json.parcial 2>> r15/$M.err \
      && mv libro-$M.json.parcial libro-$M.json
  fi

  # --- fase 1: el corpus (la parte cara) ---
  # Un shard cuenta como hecho cuando tiene su linea de resumen al final: es lo
  # ultimo que escribe corpus.js, asi que un fichero sin ella es de un proceso
  # cortado a medias y se rehace entero.
  #
  # Los shards s1 y s2 de dekle y trigonal ya estaban hechos a mano el
  # 2026-08-02 (10 min cada uno en vez de 20, misma configuracion de autojuego)
  # y se reaprovechan: son 40 minutos de maquina y el nombre coincide. Que unos
  # shards sean mas largos que otros no importa, se concatenan igual.
  for i in {1..$CORPUS_SHARDS}; do
    f=r15/corp-$M-adj$ADJ-s$i.jsonl
    if [ -s $f ] && tail -c 2000 $f | grep -q '"resumen"'; then continue; fi
    espera_hueco
    SEED=$((15000 + i)) MINUTES=$CORPUS_MINUTOS ADJ_MARGIN=$ADJ MODALIDAD=$M \
      CFG=$CORPUS_CFG node corpus.js > $f 2>> r15/$M.err &
    LANZADOS+=($!)
  done
  espera_a_todos

  # --- fase 2: la regresion (la parte barata) ---
  # ajusta.js lee la modalidad y el orden de las piezas del propio corpus y
  # aborta si se mezclan modalidades, asi que el glob no puede colar un shard
  # que no toque.
  for feat in mat all; do
    inf=r15/ajuste-$M-$feat.txt
    if [ ! -s $inf ]; then
      cat r15/corp-$M-adj$ADJ-*.jsonl 2>/dev/null \
        | node ajusta.js --features=$feat --holdout=0.2 --nombre=$M-$feat \
          > $inf.parcial 2>> r15/$M.err && mv $inf.parcial $inf
    fi
  done

  # --- fase 3: la arena (la que decide) ---
  # Cada rama se parte en SHARDS_ARENA procesos con tramos de pares distintos;
  # los ficheros -1 -2 -3 -4 los reagrupa `instalar-servicio.sh resultados`.
  #
  # EL REPARTO NO DEPENDE DE CUANTOS NUCLEOS HAYA, a proposito: si el numero de
  # ficheros cambiara con el cupo, los nombres bailarian entre pasadas y ni la
  # reanudacion ni la cuenta de partidas cuadrarian. El cupo decide cuantos
  # corren a la vez, no en cuantos trozos se parte el trabajo.
  for feat in mat all; do
    cfgB=$(cfg_arena r15/ajuste-$M-$feat.txt) || continue
    for k in {1..$SHARDS_ARENA}; do
      espera_hueco
      SALIDA=r15/$M-$feat-$k.log FIRST=$((1 + (k - 1) * PARES_SHARD)) PAIRS=$PARES_SHARD \
        SEED=$((25000 + k)) MODALIDAD=$M LIBRO=libro-$M.json \
        CFG_A="{$FIJO_R15}" CFG_B="$cfgB" NAME_A=vigente NAME_B=$feat \
        node arena.js >> r15/$M.err 2>&1 &
      LANZADOS+=($!)
    done
  done
  espera_a_todos

  # La modalidad no se da por hecha porque los procesos hayan vuelto, sino
  # porque las partidas estan en el disco: si falto el corpus, si la regresion
  # no dio candidato, si la arena revento o si el horario corto procesos a
  # media faena, los logs no suman y se vuelve a intentar.
  hechas=0
  for f in r15/$M-mat-[1-9].log(N) r15/$M-all-[1-9].log(N); do
    hechas=$((hechas + $(grep -c '^{' $f)))
  done
  if [ $hechas -ge $OBJETIVO_R15 ]; then
    echo "RONDA 15 $M TERMINADA $(date '+%Y-%m-%d %H:%M') · $hechas partidas" >> r15/estado.txt
    # Sin esta marca, cada relanzamiento del servicio tendria que releer los
    # corpus y arrancar ocho arenas para descubrir que no queda nada por hacer.
    date '+%Y-%m-%d %H:%M' > r15/$M-hecha.txt
  else
    echo "RONDA 15 $M pasada $intento: $hechas de $OBJETIVO_R15 partidas" \
      "($(date '+%Y-%m-%d %H:%M'))" >> r15/estado.txt
  fi
 done
done

# ---------------------------------------------------------------------------
# RONDA 16: LO QUE LA 15 DEJÓ ABIERTO, Y LOS VALORES DE SALAS v3
#
# QUÉ DEJÓ LA RONDA 15. Tres modalidades medidas y tres respuestas distintas:
#
#   trigonal    el candidato "all" ganó +75 elo [48, 103]  <- se aplicó
#   dekle       el candidato "all" ganó +49 elo [22, 77]   <- sin aplicar
#   salas-1998  ganaron LOS VALORES VIGENTES, +27 y +26 elo contra los dos
#               candidatos: la regresión no encontró nada mejor que el ojo
#
# Y quedan dos cosas por hacer, que son esta ronda:
#
# 1) LO QUE GANÓ EN LA ARENA NO ES LO QUE SE PUBLICA. El candidato "all" lleva
#    tres cosas —valores de pieza, peso de movilidad y pesos posicionales— y en
#    variants.js solo caben las dos primeras: no hay hueco para positionWeights
#    en el bloque engine, así que al aplicarlo se tiran por el camino. Nadie ha
#    medido nunca esa mezcla concreta, y hay motivos para dudar: en las dos
#    modalidades, la rama "mat" —valores solos, sin nada posicional— quedó en
#    tablas (-5 elo en dekle, +7 en trigonal). Es perfectamente posible que la
#    ganancia de "all" viniera casi entera de la centralidad de la dama (+22 y
#    +7 centipeones) y del peso de movilidad, y no de los valores.
#
#    Trigonal ya está publicado así, sin haberlo comprobado. O sea que la fase
#    1 no es un trámite: puede acabar en aplicar dekle, o en DESHACER trigonal.
#
# 2) SALAS v3 (id salas-v4) NO SE HA MEDIDO NUNCA. Se quedó fuera de la 15 y es
#    donde más falta hace: su dama tiene las tres familias de rayos y vale
#    Q=1380 porque alguien sumó a ojo las dos mitades. Es el número menos
#    fundado de todo variants.js, y el de la pieza que más decide.
#
# QUÉ SE MIDE, EN ESTE ORDEN (lo barato y decisivo primero):
#
#   fase 1  dekle y trigonal: la mezcla PUBLICABLE del ganador de la 15
#           (valores + movilidad, SIN pesos posicionales) contra los valores
#           de antes de la ronda 15. Es lo único que de verdad se puede
#           aplicar, así que es lo que hay que medir.
#   fase 2  salas-v4: el ciclo completo de la 15 —libro, corpus, regresión
#           mat/all, arena de los dos candidatos— y además su publicable.
#   fase 3  salas-v4: barrido de la dama. Seis valores de Q alrededor de 1380,
#           cambiando SOLO la dama, cada uno contra los valores vigentes.
#   fase 4  salas-1998: sondeo por coordenadas. La regresión ya dijo lo suyo y
#           perdió dos veces, así que aquí no se regresiona nada: se mueve UNA
#           pieza cada vez, arriba y abajo, y se juega. La regresión contesta
#           "qué valores predicen mejor el resultado"; esto contesta "con qué
#           valores se juega mejor", que es la pregunta de verdad.
#
# POR QUÉ UNA PIEZA CADA VEZ Y NO UNA REGRESIÓN MEJOR. En la 15 los dos
# candidatos de salas-1998 movían las cinco piezas a la vez: el "mat" las subía
# un 5% en bloque y el "all" las bajaba un 19%. Perdieron los dos, y de una
# derrota en bloque no se aprende en qué dirección tirar de cada pieza. Un
# sondeo por coordenadas sí: cada rama contesta por su cuenta.
#
# EL AVISO ESTADÍSTICO VA AQUÍ, no en la sorpresa de mañana. Con 16 candidatos
# a p<0,05 se espera casi una rama "significativa" por puro azar. Ninguna entra
# en variants.js por ganar aquí: esto es un mapa para saber dónde mirar, y lo
# que salga se confirma en una tanda propia (ronda 17) antes de aplicarse. Un
# resultado se toma en serio si además es coherente con su vecino —si N=240
# gana, N=292 debería perder—; una rama suelta rodeada de tablas es ruido.
mkdir -p r16

# Mismo presupuesto de arena que la 15 y la 14: nivel 4, 4.500 nodos. Los elos
# de las tres rondas son comparables entre sí porque se juegan igual.
FIJO_R16='"depth":24,"mobility":true,"order":true,"quiesce":true,"nodes":4500'
# 8 procesos x 60 pares = 480 pares = 960 partidas por candidato (la 15 jugaba
# 424 por rama). Con 960 el intervalo de confianza baja a unos ±18 elo, que es
# lo que hace falta para creerse una diferencia de un solo valor de pieza.
SHARDS_R16=8
PARES_R16=60
OBJ_R16=$((SHARDS_R16 * PARES_R16 * 2))

# Juega un candidato entero y espera a que acabe.
#
# Antes de lanzar nada mira lo que ya hay en el disco: si el candidato está
# completo se sale en el acto, así que repasar una ronda hecha cuesta segundos.
# Si está a medias, arena.js se salta por su cuenta los pares ya jugados.
arena16() {   # $1 etiqueta  $2 modalidad  $3 cfgA  $4 cfgB
  local et=$1 M=$2 cfgA=$3 cfgB=$4 k hechas=0
  for f in r16/$et-[1-9].log(N); do hechas=$((hechas + $(grep -c '^{' $f))); done
  if [ $hechas -ge $OBJ_R16 ]; then return 0; fi
  for k in {1..$SHARDS_R16}; do
    espera_hueco
    SALIDA=r16/$et-$k.log FIRST=$((1 + (k - 1) * PARES_R16)) PAIRS=$PARES_R16 \
      SEED=$((26000 + k)) MODALIDAD=$M LIBRO=libro-$M.json \
      CFG_A="$cfgA" CFG_B="$cfgB" NAME_A=vigente NAME_B=$et \
      node arena.js >> r16/$M.err 2>&1 &
    LANZADOS+=($!)
  done
  espera_a_todos
}

# Como cfg_arena, pero DEJANDO FUERA los pesos posicionales: construye la
# configuración que de verdad se puede escribir en variants.js. Es toda la
# gracia de la fase 1.
cfg_publicable() {
  node -e '
    const fs = require("fs");
    const l = fs.readFileSync(process.argv[1], "utf8").split("\n")
      .find(x => x.startsWith("CFG="));
    if (!l) { process.stderr.write("sin linea CFG= en " + process.argv[1] + "\n"); process.exit(1); }
    const c = JSON.parse(l.slice(4));
    const out = JSON.parse("{" + process.argv[2] + "}");
    for (const k of ["pieceValues", "mobilityWeight"]) {
      if (c[k] !== undefined) out[k] = c[k];
    }
    process.stdout.write(JSON.stringify(out));
  ' "$1" "$FIJO_R16"
}

# --- fase 1: lo que de verdad se publica (dekle y trigonal) ---
#
# EL RIVAL VA ESCRITO A MANO, no se toma de variants.js. En trigonal es
# obligatorio —sus valores ya se cambiaron al aplicar la 15, así que el motor
# ya no sabe cuáles eran los de antes— y en dekle es por simetría: las dos
# ramas tienen que medirse contra la misma referencia para poder compararse.
VIEJO_DEKLE="{$FIJO_R16,\"pieceValues\":{\"P\":100,\"N\":300,\"B\":320,\"U\":400,\"R\":400,\"Q\":800,\"K\":0},\"mobilityWeight\":4}"
VIEJO_TRIGONAL="{$FIJO_R16,\"pieceValues\":{\"P\":100,\"N\":300,\"B\":400,\"R\":500,\"Q\":900,\"K\":0},\"mobilityWeight\":4}"

if [ -s r15/ajuste-dekle-all.txt ]; then
  cfgB=$(cfg_publicable r15/ajuste-dekle-all.txt) \
    && arena16 dekle-pub dekle "$VIEJO_DEKLE" "$cfgB"
fi
if [ -s r15/ajuste-trigonal-all.txt ]; then
  cfgB=$(cfg_publicable r15/ajuste-trigonal-all.txt) \
    && arena16 trigonal-pub trigonal "$VIEJO_TRIGONAL" "$cfgB"
fi

# --- fase 2: el ciclo completo de salas-v4 (Salas v3 de 2026) ---
#
# Idéntico al de la ronda 15, fase por fase, con sus mismos tamaños: el libro
# de aperturas de la modalidad, ocho shards de corpus de autojuego, la
# regresión en sus dos variantes y la arena de cada candidato contra lo
# vigente. Al final, la mezcla publicable del candidato "all", por lo mismo
# que la fase 1: es lo único que cabe en variants.js.
M=salas-v4
for intento in 1 2 3; do
  [ -f r16/$M-hecha.txt ] && break

  if [ ! -s libro-$M.json ]; then
    MODALIDAD=$M node aperturas.js > libro-$M.json.parcial 2>> r16/$M.err \
      && mv libro-$M.json.parcial libro-$M.json
  fi

  for i in {1..$CORPUS_SHARDS}; do
    f=r16/corp-$M-adj$ADJ-s$i.jsonl
    if [ -s $f ] && tail -c 2000 $f | grep -q '"resumen"'; then continue; fi
    espera_hueco
    SEED=$((16000 + i)) MINUTES=$CORPUS_MINUTOS ADJ_MARGIN=$ADJ MODALIDAD=$M \
      CFG=$CORPUS_CFG node corpus.js > $f 2>> r16/$M.err &
    LANZADOS+=($!)
  done
  espera_a_todos

  for feat in mat all; do
    inf=r16/ajuste-$M-$feat.txt
    if [ ! -s $inf ]; then
      cat r16/corp-$M-adj$ADJ-*.jsonl 2>/dev/null \
        | node ajusta.js --features=$feat --holdout=0.2 --nombre=$M-$feat \
          > $inf.parcial 2>> r16/$M.err && mv $inf.parcial $inf
    fi
  done

  for feat in mat all; do
    cfgB=$(cfg_arena r16/ajuste-$M-$feat.txt) || continue
    arena16 $M-$feat $M "{$FIJO_R16}" "$cfgB"
  done
  if [ -s r16/ajuste-$M-all.txt ]; then
    cfgB=$(cfg_publicable r16/ajuste-$M-all.txt) \
      && arena16 $M-pub $M "{$FIJO_R16}" "$cfgB"
  fi

  hechas=0
  for f in r16/$M-mat-[1-9].log(N) r16/$M-all-[1-9].log(N) r16/$M-pub-[1-9].log(N); do
    hechas=$((hechas + $(grep -c '^{' $f)))
  done
  if [ $hechas -ge $((3 * OBJ_R16)) ]; then
    echo "RONDA 16 $M TERMINADA $(date '+%Y-%m-%d %H:%M') · $hechas partidas" >> r16/estado.txt
    date '+%Y-%m-%d %H:%M' > r16/$M-hecha.txt
  else
    echo "RONDA 16 $M pasada $intento: $hechas de $((3 * OBJ_R16)) partidas" \
      "($(date '+%Y-%m-%d %H:%M'))" >> r16/estado.txt
  fi
done

# --- fase 3: el barrido de la dama de salas-v4 ---
#
# Solo se mueve la dama; las otras cinco piezas se quedan en los valores
# vigentes, que vienen medidos de la ronda 6 (salas v2 tiene las mismas piezas
# salvo la dama). Seis puntos entre 1000 y 1800 alrededor del 1380 de hoy: no
# es una búsqueda, es dibujar la curva. Si el óptimo está lejos del 1380 se ve
# en la forma —un lado gana y el otro pierde—, y si está cerca salen seis
# tablas, que también es una respuesta: el ojo acertó.
q_v4() {   # $1 valor de la dama
  echo "{$FIJO_R16,\"pieceValues\":{\"P\":100,\"N\":265,\"B\":335,\"E\":358,\"R\":483,\"Q\":$1,\"K\":0}}"
}
for q in 1000 1100 1200 1500 1650 1800; do
  arena16 salas-v4-q$q salas-v4 "{$FIJO_R16}" "$(q_v4 $q)"
done

# --- fase 4: el sondeo por coordenadas de salas-1998 ---
#
# Base: P100 N265 B335 R358 Q810 (la R de 1998 es el elefante de 2026). Cada
# rama mueve UNA pieza un ~10% arriba o abajo, salvo las dos últimas, que
# escalan las cuatro piezas mayores a la vez sin tocar el peón: son la pregunta
# "¿vale el peón más de lo que parece?" separada de la de cada pieza. El 5%
# arriba en bloque ya se probó en la 15 (fue el candidato "mat") y perdió, así
# que aquí solo se mira hacia abajo.
pv_1998() {   # $1 N  $2 B  $3 R  $4 Q
  echo "{$FIJO_R16,\"pieceValues\":{\"P\":100,\"N\":$1,\"B\":$2,\"R\":$3,\"Q\":$4,\"K\":0}}"
}
arena16 salas-1998-n240  salas-1998 "{$FIJO_R16}" "$(pv_1998 240 335 358 810)"
arena16 salas-1998-n292  salas-1998 "{$FIJO_R16}" "$(pv_1998 292 335 358 810)"
arena16 salas-1998-b305  salas-1998 "{$FIJO_R16}" "$(pv_1998 265 305 358 810)"
arena16 salas-1998-b368  salas-1998 "{$FIJO_R16}" "$(pv_1998 265 368 358 810)"
arena16 salas-1998-r325  salas-1998 "{$FIJO_R16}" "$(pv_1998 265 335 325 810)"
arena16 salas-1998-r395  salas-1998 "{$FIJO_R16}" "$(pv_1998 265 335 395 810)"
arena16 salas-1998-q735  salas-1998 "{$FIJO_R16}" "$(pv_1998 265 335 358 735)"
arena16 salas-1998-q890  salas-1998 "{$FIJO_R16}" "$(pv_1998 265 335 358 890)"
arena16 salas-1998-esc96 salas-1998 "{$FIJO_R16}" "$(pv_1998 254 322 344 778)"
arena16 salas-1998-esc92 salas-1998 "{$FIJO_R16}" "$(pv_1998 244 308 329 745)"

echo "RONDA 16 TERMINADA $(date '+%Y-%m-%d %H:%M')" >> r16/estado.txt

# ---------------------------------------------------------------------------
# RONDA 14: LA CURVA DE LA TEMPERATURA
#
# ESTÁ A MEDIAS Y POR ESO HA BAJADO AQUÍ, detrás de la 15: tiene hechas t_poda,
# t00_10 y t10_25 (400 partidas cada una) y le faltan t25_45, t45_70 y t70_150.
# Al llegar aquí, las tres primeras se ven terminadas y el guion pasa de largo;
# las tres que faltan arrancan solas. Las modalidades van primero porque un
# valor de pieza inventado se nota jugando y una etiqueta de nivel mal
# calibrada, mucho menos.
#
# QUE ENSEÑO LA RONDA 13. Los escalones de arriba —los que solo cambian el
# presupuesto de nodos— salieron parejos y en la zona jugable:
#
#   n45  4.500 -> 16.000 nodos  (x3,6)   158 elo   [118, 203]
#   n56 16.000 -> 60.000 nodos  (x3,75)  213 elo   [136, 314]
#
# O sea, unos 100 elo por cada vez que se dobla el presupuesto. Como los
# niveles 4 a 8 van multiplicando por 3,6-3,75, esa parte de la escalera ya
# está bien y no hay que tocarla.
#
# Los escalones de abajo, en cambio, son un muro: 433 y 798 elo. Y el de 798
# tiene una lectura muy limpia, porque enfrenta
#
#   nivel 3 = 5.000 nodos, temperatura 70   contra   nivel 4 = 4.500 nodos
#
# es decir, el que pierde 99 de cada 100 partidas es el que MAS presupuesto
# tiene. El presupuesto no explica nada ahí: los 798 elo los paga enteros la
# temperatura 70. (Robusto: 742 elo con margen de adjudicación 500.)
#
# PERO LOS 798 ELO SON DE DOS COSAS, NO DE UNA. Poner temperatura cambia
# ademas como se busca: para repartir probabilidad entre las jugadas hacen
# falta las puntuaciones de TODAS, asi que la raiz va con ventana completa y
# se pierden las podas (ver `opts.analyze || cfg.temperature` en ai.js). Con
# el presupuesto congelado, eso solo ya cuesta profundidad. Asi que
#
#   798 elo  =  precio de la ventana completa  +  precio del azar
#
# y hay que separarlos, porque el primero es un efecto lateral de la
# implementacion y el segundo es el mando que se quiere graduar.
#
# QUE SE MIDE AQUI. Con el presupuesto CONGELADO en 4.500 nodos:
#
#   t_poda   sin temperatura -> temperatura 0,0001   (la ventana completa sola:
#            0,0001 no cambia ninguna jugada —exp(-100/0,0001) es 0— pero pasa
#            por el mismo camino de codigo, asi que la unica diferencia es la
#            perdida de podas)
#
#   t00_10   0,0001 -> 10      t25_45  25 -> 45
#   t10_25   10 -> 25          t45_70  45 -> 70
#
# y t70_150 por debajo, para saber que compra la temperatura alta: es la que
# usa hoy el nivel 2, y hace falta saber si el suelo esta donde debe.
#
# COMPROBACION INCLUIDA: t_poda + t00_10 + t10_25 + t25_45 + t45_70 tiene que
# dar los ~798 elo que la ronda 13 midio de un tiron (menos unos 15 elo por
# los 500 nodos de diferencia). Si no cuadra, algo esta mal medido.
#
# PARA QUE SIRVE. Con la curva se pueden repartir los niveles bajos a pasos
# iguales igual que ya lo estan los altos: si hacen falta tres peldaños de unos
# 200 elo por debajo del nivel 4, las temperaturas saldran de leer esta curva y
# no de adivinar. Hasta entonces, las etiquetas del selector siguen sin medir.
mkdir -p r14
FIJO='"depth":24,"mobility":true,"order":true,"quiesce":true,"nodes":4500'

grado() {
  local nombre=$1 cfgA=$2 cfgB=$3 nA=$4 nB=$5
  SALIDA=r14/$nombre.log FIRST=1 PAIRS=200 SEED=23000 \
    CFG_A="{$FIJO$cfgA}" CFG_B="{$FIJO$cfgB}" NAME_A=$nA NAME_B=$nB \
    node arena.js >> r14/$nombre.err 2>&1
}

espera_hueco; grado t_poda  ''                      ',"temperature":0.0001' sin_temp t0   & LANZADOS+=($!)
espera_hueco; grado t00_10  ',"temperature":0.0001' ',"temperature":10'     t0       t10  & LANZADOS+=($!)
espera_hueco; grado t10_25  ',"temperature":10'     ',"temperature":25'     t10      t25  & LANZADOS+=($!)
espera_hueco; grado t25_45  ',"temperature":25'     ',"temperature":45'     t25      t45  & LANZADOS+=($!)
espera_hueco; grado t45_70  ',"temperature":45'     ',"temperature":70'     t45      t70  & LANZADOS+=($!)
espera_hueco; grado t70_150 ',"temperature":70'     ',"temperature":150'    t70      t150 & LANZADOS+=($!)
espera_a_todos
echo "RONDA 14 TERMINADA $(date '+%Y-%m-%d %H:%M')" >> r14/estado.txt
