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

lanzar e23 "$N2" "$N3" nivel2 nivel3 &
lanzar e34 "$N3" "$N4" nivel3 nivel4 &
lanzar e45 "$N4" "$N5" nivel4 nivel5 &
lanzar e56 "$N5" "$N6" nivel5 nivel6 &
wait
echo "RONDA 12 TERMINADA $(date '+%Y-%m-%d %H:%M')" >> r12/estado.txt

# ---------------------------------------------------------------------------
# RONDA 13: CALIBRAR EL PRESUPUESTO DE NODOS
#
# Va detrás de la 12 sin más ceremonia: cuando la 12 está terminada, arena.js
# ve que todos sus pares están hechos y vuelve enseguida, así que el script
# sigue de largo hasta aquí. Y si un apagón corta a mitad de la 13, al
# reanudar pasa otra vez de largo por la 12 y retoma donde iba.
#
# QUE SE MIDE. El presupuesto de nodos es un mando CONTINUO: en vez de fijar
# la profundidad, se deja profundizar hasta gastar N nodos y se juega la mejor
# jugada de la última profundidad terminada. Aquí se enfrenta cada
# presupuesto a un nivel existente cercano, para saber a qué altura de la
# escalera cae cada uno y poder colocar niveles intermedios donde hoy hay
# saltos de 300 a 1000 elo.
#
# El tope de profundidad es 6 en todos: quien manda es el presupuesto.
mkdir -p r13
TOPE='"depth":6,"mobility":true,"order":true,"quiesce":true'

calibrar() {
  local nombre=$1 nodos=$2 rival=$3 nomRival=$4
  SALIDA=r13/$nombre.log FIRST=1 PAIRS=200 SEED=19000 \
    CFG_A="{$TOPE,\"nodes\":$nodos}" CFG_B="{$rival}" \
    NAME_A=$nombre NAME_B=$nomRival \
    node arena.js >> r13/$nombre.err 2>&1
}

# cada presupuesto contra el nivel que por coste se le parece mas
calibrar b2000     2000 "$N3" nivel3 &
calibrar b10000   10000 "$N4" nivel4 &
calibrar b40000   40000 "$N5" nivel5 &
calibrar b150000 150000 "$N6" nivel6 &
wait
echo "RONDA 13 TERMINADA $(date '+%Y-%m-%d %H:%M')" >> r13/estado.txt
