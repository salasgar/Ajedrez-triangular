#!/bin/zsh
# Fase 1 del reentrenamiento: corpus de autojuego con el motor REAL a prof. 3
# (LEVEL=4 = material ajustado + movilidad 4 + quiesce + ordenación). Más
# profundo y representativo que el corpus original (prof. 2, evaluación desnuda).
# 8 shards en paralelo con semilla distinta; se concatenan sus salidas para
# ajusta.js. ADJ_MARGIN rescata por material las partidas que no dan mate dentro
# del tope (a esta profundidad, casi todas), sin lo cual se tiraría el cómputo.
# Corre hasta pararlo a mano (GAMES alto); análisis incremental sobre corp/.
cd "$(dirname "$0")"
mkdir -p corp && rm -f corp/*.jsonl corp/*.err 2>/dev/null
for s in 1 2 3 4 5 6 7 8; do
  SEED=$((9000 + s)) LEVEL=4 ADJ_MARGIN=300 MAX_PLIES=160 FIFTY=40 \
    GAMES=1000 SAMPLE_STRIDE=8 \
    node corpus.js > corp/s$s.jsonl 2> corp/s$s.err &
done
wait
echo "CORPUS TERMINADO"
