#!/bin/zsh
# Cierre de la Etapa 2: ¿el motor optimizado (fases 1-6) juega IGUAL de
# fuerte que el original? Debe salir ≈50%: las optimizaciones prometen
# velocidad, no fuerza (dorados idénticos), y esto lo verifica por partidas.
# A = motor viejo (HEAD~5), B = motor nuevo (working tree). Nivel 4 real.
cd "$(dirname "$0")"
mkdir -p r7 && rm -f r7/*.log r7/*.err 2>/dev/null
export VIEJO=motor-viejo NUEVO=/Users/salasgar/Documents/git/Ajedrez-triangular
export LIBRO=libro.json LEVEL=4 MAX_PLIES=110 FIFTY=50
for s in 0 1 2 3 4 5; do
  FIRST=$((1 + s*16)) PAIRS=8 SEED=$((12000 + s)) \
    node versus.js > r7/v-$s.log 2> r7/v-$s.err &
done
wait
echo "RONDA 7 (versus) TERMINADA"
wc -l r7/*.log
