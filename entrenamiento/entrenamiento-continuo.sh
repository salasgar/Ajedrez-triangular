#!/bin/zsh
# Entrenamiento de fondo que SOBREVIVE A APAGONES Y REINICIOS.
#
# Lo arranca solo macOS al iniciar sesión (ver instalar-servicio.sh) y también
# se puede lanzar a mano. Cada proceso escribe su propio fichero con SALIDA=,
# y arena.js se salta al arrancar los pares que ya estén ahí: si el ordenador
# se apaga, al volver se reanuda por donde iba sin repetir ni perder partidas.
#
# Qué mide esta tanda (ronda 10): ¿DEPENDE DE LA PROFUNDIDAD el peso de
# movilidad? La movilidad es un sustituto barato de lo que la búsqueda acabará
# viendo, así que en teoría su peso óptimo debería BAJAR al profundizar. Los
# picos medidos hasta ahora no lo muestran (prof. 2: ~4, prof. 3: 4, prof. 4:
# 3-4), pero la profundidad 5 nunca se había podido medir: hasta que el motor
# se hizo ~17x más rápido era inabordable. Aquí es donde la teoría predice el
# efecto más fuerte.
#
#   mov2: movilidad 4 contra 2 -> ¿sigue aportando la movilidad a esta
#         profundidad? (a prof. 4 ganaba +90 elo; si el efecto existe, aquí
#         la ventaja debería encogerse)
#   mov3: movilidad 4 contra 3 -> el pico fino
#
# La tanda anterior (prof. 4) queda intacta en r9.
cd "$(dirname "$0")"
mkdir -p r10

BASE='"depth":5,"mobility":true,"order":true,"quiesce":true'
# MOTOR: la copia del motor que hay junto a este script (el servicio no puede
# leer el repo, que vive en ~/Documents; ver instalar-servicio.sh)
#
# MAX_PLIES más corto que en prof. 4 (110): a esta profundidad cada partida
# cuesta varias horas y con el tope de 110 no habría muestra en días. La
# adjudicación por material ya demostró aguantar márgenes de 100 a 900 cp.
export MOTOR="$(pwd)/motor" LIBRO=libro.json MAX_PLIES=80 FIFTY=40

# Un proceso por rival y semilla. PAIRS alto: la tanda dura lo que haga falta
# y se interrumpe/reanuda sin problema.
lanzar() {
  local nombre=$1 extra=$2 s=$3
  SALIDA=r10/$nombre-$s.log FIRST=$((1 + s*120)) PAIRS=120 SEED=$((15000 + s)) \
    CFG_A="{$BASE}" CFG_B="{$BASE,$extra}" NAME_A=mov4 NAME_B=$nombre \
    node arena.js >> r10/$nombre-$s.err 2>&1
}

for s in 0 1 2; do
  lanzar mov2 '"mobilityWeight":2' $s &
  lanzar mov3 '"mobilityWeight":3' $s &
done
wait
echo "RONDA 10 TERMINADA $(date '+%Y-%m-%d %H:%M')" >> r10/estado.txt
