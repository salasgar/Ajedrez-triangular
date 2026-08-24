#!/bin/sh
# Mantiene docs/valores-piezas.pdf al dia con los valores del motor.
#
# Los valores de las piezas viven en el bloque `engine` de cada modalidad en
# variants.js. Cuando un commit los toca, este gancho regenera el PDF y lo mete
# en el mismo commit, para que la tabla y el motor no puedan separarse. Si el
# PDF se quedara atras, nadie se enteraria: nada lo compara con el codigo.
#
# Instalado por entrenamiento/instalar-servicio.sh; tambien se puede copiar a
# mano desde entrenamiento/pre-commit.sh. Los ganchos no viajan en el repo.
if git diff --cached --name-only | grep -q '^variants\.js$'; then
  if ! node entrenamiento/valores-pdf.js; then
    echo "pre-commit: no se pudo regenerar docs/valores-piezas.pdf" >&2
    exit 1
  fi
  git add docs/valores-piezas.pdf
  echo "pre-commit: docs/valores-piezas.pdf regenerado y añadido al commit"
fi
