#!/bin/zsh
# Entrenamiento de fondo que SOBREVIVE A APAGONES Y REINICIOS.
#
# Lo arranca solo macOS al iniciar sesión (ver instalar-servicio.sh) y también
# se puede lanzar a mano. Cada proceso escribe su propio fichero con SALIDA=,
# y arena.js se salta al arrancar los pares que ya estén ahí: si el ordenador
# se apaga, al volver se reanuda por donde iba sin repetir ni perder partidas.
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
export MOTOR="$(pwd)/motor" LIBRO=libro.json MAX_PLIES=80 FIFTY=40

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

escalon n23 "$L2" "$L3" nivel2 nivel3 &
escalon n34 "$L3" "$L4" nivel3 nivel4 &
escalon n45 "$L4" "$L5" nivel4 nivel5 &
escalon n56 "$L5" "$L6" nivel5 nivel6 &
# PAR NO CONTIGUO, para comprobar que la escalera es UNA SOLA ESCALA. Encadenar
# escalones supone transitividad, y no tiene por que cumplirse: un estilo puede
# irle mejor a un rival que a otro, y la tasa de tablas cambia con la fuerza.
# Si el 2 contra el 5 no cuadra con la suma de n23+n34+n45, el elo acumulado es
# orientativo y no una escala.
escalon n25 "$L2" "$L5" nivel2 nivel5 &
wait
echo "RONDA 13 TERMINADA $(date '+%Y-%m-%d %H:%M')" >> r13/estado.txt

# ---------------------------------------------------------------------------
# RONDA 14: LA CURVA DE LA TEMPERATURA
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

grado t_poda  ''                    ',"temperature":0.0001' sin_temp t0 &
grado t00_10  ',"temperature":0.0001' ',"temperature":10'    t0   t10 &
grado t10_25  ',"temperature":10'     ',"temperature":25'    t10  t25 &
grado t25_45  ',"temperature":25'     ',"temperature":45'    t25  t45 &
grado t45_70  ',"temperature":45'     ',"temperature":70'    t45  t70 &
grado t70_150 ',"temperature":70'     ',"temperature":150'   t70  t150 &
wait
echo "RONDA 14 TERMINADA $(date '+%Y-%m-%d %H:%M')" >> r14/estado.txt
