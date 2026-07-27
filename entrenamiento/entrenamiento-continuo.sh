#!/bin/zsh
# Entrenamiento de fondo que SOBREVIVE A APAGONES Y REINICIOS.
#
# Lo arranca solo macOS al iniciar sesión (ver instalar-servicio.sh) y también
# se puede lanzar a mano. Cada proceso escribe su propio fichero con SALIDA=,
# y arena.js se salta al arrancar los pares que ya estén ahí: si el ordenador
# se apaga, al volver se reanuda por donde iba sin repetir ni perder partidas.
#
# Qué mide esta tanda (ronda 9): el barrido de movilidad a profundidad 4, que
# quedó pendiente. La movilidad 4 está confirmada a prof. 2, 3 y 4 frente a la
# 2, pero no se sabe si el óptimo a esta profundidad es 3, 4 o 5. A = motor
# actual (movilidad 4) contra B = cada alternativa.
cd "$(dirname "$0")"
mkdir -p r9

BASE='"depth":4,"mobility":true,"order":true,"quiesce":true'
# MOTOR: la copia del motor que hay junto a este script (el servicio no puede
# leer el repo, que vive en ~/Documents; ver instalar-servicio.sh)
export MOTOR="$(pwd)/motor" LIBRO=libro.json MAX_PLIES=110 FIFTY=50

# Un proceso por rival y semilla. PAIRS alto: la tanda dura lo que haga falta
# y se interrumpe/reanuda sin problema.
lanzar() {
  local nombre=$1 extra=$2 s=$3
  SALIDA=r9/$nombre-$s.log FIRST=$((1 + s*120)) PAIRS=120 SEED=$((14000 + s)) \
    CFG_A="{$BASE}" CFG_B="{$BASE,$extra}" NAME_A=mov4 NAME_B=$nombre \
    node arena.js >> r9/$nombre-$s.err 2>&1
}

for s in 0 1 2; do
  lanzar mov3 '"mobilityWeight":3' $s &
  lanzar mov5 '"mobilityWeight":5' $s &
done
wait
echo "RONDA 9 TERMINADA $(date '+%Y-%m-%d %H:%M')" >> r9/estado.txt
