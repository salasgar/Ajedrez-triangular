#!/bin/zsh
# Entrenamiento de fondo que SOBREVIVE A APAGONES Y REINICIOS.
#
# Lo arranca solo macOS al iniciar sesión (ver instalar-servicio.sh) y también
# se puede lanzar a mano. Cada proceso escribe su propio fichero con SALIDA=,
# y arena.js se salta al arrancar los pares que ya estén ahí: si el ordenador
# se apaga, al volver se reanuda por donde iba sin repetir ni perder partidas.
#
# RONDA 11: ¿BAJA CON LA PROFUNDIDAD el peso de movilidad?
#
# La ronda 10 contestó que la movilidad sigue valiendo a profundidad 5
# (movilidad 4 contra 2: +39 elo, p=0,005) y que los pesos 3 y 4 son
# indistinguibles ahí. Lo que NO pudo contestar es si el óptimo baja al
# profundizar, porque la medida de profundidad 4 que había se hizo con tope de
# 110 jugadas y la de profundidad 5 con tope de 80, y el tope mueve el elo por
# sí solo. Comparar esos dos números sería comparar dos reglas distintas.
#
# Aquí se mide LO MISMO a varias profundidades: movilidad 4 contra 2, mismo
# libro, mismas semillas, mismos topes. Si el peso de movilidad pierde valor
# al profundizar, la ventaja debe encogerse de d3 a d4 a d5.
#
#   d3: profundidad 3
#   d4: profundidad 4
#   d5: YA JUGADA. Son las 179 partidas de r10/mov2-*.log, que usan
#       exactamente estos ajustes (tope 80, regla de 50 acortada a 40, libro y
#       semillas 15000/15001, pares 1..240). No se repiten: se analizan junto
#       con estas. Ver el README.
#
# Al usar las mismas semillas y los mismos rangos de pares que la ronda 10,
# las tres profundidades juegan LAS MISMAS APERTURAS, así que la comparación
# entre ellas está emparejada y no depende de qué posiciones tocaron.
cd "$(dirname "$0")"
mkdir -p r11

# MOTOR: la copia del motor que hay junto a este script (el servicio no puede
# leer el repo, que vive en ~/Documents; ver instalar-servicio.sh)
#
# Los topes son los de la ronda 10, y eso es el punto entero de esta ronda:
# solo cambia la profundidad.
export MOTOR="$(pwd)/motor" LIBRO=libro.json MAX_PLIES=80 FIFTY=40

# Un proceso por profundidad y semilla. PAIRS y FIRST idénticos a la ronda 10
# para heredar sus aperturas.
lanzar() {
  local nombre=$1 prof=$2 s=$3
  local base="\"depth\":$prof,\"mobility\":true,\"order\":true,\"quiesce\":true"
  SALIDA=r11/$nombre-$s.log FIRST=$((1 + s*120)) PAIRS=120 SEED=$((15000 + s)) \
    CFG_A="{$base}" CFG_B="{$base,\"mobilityWeight\":2}" NAME_A=mov4-$nombre NAME_B=mov2-$nombre \
    node arena.js >> r11/$nombre-$s.err 2>&1
}

# Dos semillas por profundidad = 4 procesos, la mitad de la máquina (ver
# instalar-servicio.sh: nada de ProcessType=Background).
for s in 0 1; do
  lanzar d3 3 $s &
  lanzar d4 4 $s &
done
wait
echo "RONDA 11 TERMINADA $(date '+%Y-%m-%d %H:%M')" >> r11/estado.txt
