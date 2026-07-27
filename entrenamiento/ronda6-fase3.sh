#!/bin/zsh
# Fase 3 del reentrenamiento: el candidato del corpus profundo
# (P100 N231 B310 E415 R527 Q963, regresion final-r02 sobre 6291 posiciones)
# a la arena, prof. 3.
#   M1: actuales (A) vs candidato (B)  — la decisiva: ¿mejora lo que hay?
#   M2: clasicos+mov2 (A) vs candidato (B) — sanidad: ¿bate al motor original?
# Partidas acortadas (MAX_PLIES 110, FIFTY 50) como en la ronda 5: la
# adjudicacion por material ya demostro ser robusta al margen (100-900 cp).
cd "$(dirname "$0")"
mkdir -p r6 && rm -f r6/*.log r6/*.err 2>/dev/null
BASE='"depth":3,"mobility":true,"order":true,"quiesce":true'
CAND='"pieceValues":{"P":100,"N":231,"B":310,"E":415,"R":527,"Q":963,"K":0}'
ACT='"pieceValues":{"P":100,"N":265,"B":335,"E":358,"R":483,"Q":981,"K":0}'
CLAS='"pieceValues":{"P":100,"N":300,"B":330,"E":350,"R":500,"Q":900,"K":0}'
export LIBRO=libro.json MAX_PLIES=110 FIFTY=50
lanzar() { local nombre=$1 cfgA=$2 nameA=$3
  for s in 0 1 2 3; do
    FIRST=$((1 + s*100)) PAIRS=50 SEED=$((11000 + s)) \
      CFG_A="{$cfgA}" CFG_B="{$BASE,$CAND}" NAME_A=$nameA NAME_B=candidato \
      node arena.js > r6/$nombre-$s.log 2> r6/$nombre-$s.err & ; done }
lanzar m1 "$BASE,$ACT" actuales
lanzar m2 "$BASE,$CLAS,\"mobilityWeight\":2" clasicos
wait
echo "FASE 3 TERMINADA"
wc -l r6/*.log
