#!/bin/zsh
# Instala el entrenamiento como servicio de macOS: arranca solo al iniciar
# sesión y sigue después de apagar y encender el ordenador, retomando el
# trabajo donde se quedó.
#
#   ./instalar-servicio.sh            instala y arranca
#   NUCLEOS=2 ./instalar-servicio.sh  igual, pero ocupando solo dos nucleos
#   ./instalar-servicio.sh estado     ¿corre? ¿cuántas partidas lleva?
#   ./instalar-servicio.sh resultados analiza lo jugado hasta ahora
#   ./instalar-servicio.sh parar      lo detiene (sigue instalado)
#   ./instalar-servicio.sh arrancar   lo vuelve a poner en marcha
#   ./instalar-servicio.sh quitar     lo desinstala del arranque
#
# DOS DETALLES IMPORTANTES DE macOS:
#
#  1. Un LaunchAgent NO puede leer ~/Documents (protección de privacidad de
#     macOS: un servicio de fondo no hereda el permiso de la terminal). Por eso
#     el servicio no trabaja dentro del repo: se copia lo que necesita —el
#     motor y las herramientas— a ~/Library/Application Support/…, que sí es
#     accesible, y trabaja ahí. Vuelve a ejecutar este script para llevarle una
#     versión nueva del motor.
#  2. La reanudación no la hace launchd, la hace arena.js: cada proceso escribe
#     su fichero con SALIDA= y al arrancar se salta los pares que ya estén
#     dentro. Un apagón a mitad de partida solo pierde esa partida.
set -e
# Hace falta para el `##` (una o más veces) del patrón que agrupa los shards de
# una misma rama en `resultados`. Un zsh no interactivo no lo trae puesto, así
# que sin esta línea el patrón no casaba con nada y cada shard se analizaba por
# separado: tres marcadores de 140 partidas en vez de uno de 420, con el
# intervalo de confianza casi al doble de ancho. No se notó antes porque las
# rondas 12 a 14 tenían un solo fichero por rama.
setopt extended_glob
cd "$(dirname "$0")"
REPO="$(cd .. && pwd)"
CASA="$HOME/Library/Application Support/ajedrez-triangular-entrenamiento"
ETIQUETA="com.salasgar.ajedreztriangular.entrenamiento"
PLIST="$HOME/Library/LaunchAgents/$ETIQUETA.plist"
NODE="$(command -v node)"
# Procesos simultaneos del entrenamiento; cada uno ocupa un nucleo entero. Se
# queda escrito en el plist, asi que el valor sobrevive a los reinicios y a
# `parar`/`arrancar`: para cambiarlo, se reinstala con otro NUCLEOS.
NUCLEOS="${NUCLEOS:-6}"
# qué mide cada tanda, para que el estado y los resultados se lean solos
typeset -A DESC_RONDA
DESC_RONDA=(
  r9  "profundidad 4: movilidad 4 contra 3 y 5"
  r10 "profundidad 5: movilidad 4 contra 2 y 3"
  r11 "movilidad 4 contra 2 a profundidades 3 y 4 (la de 5 esta en r10)"
  r12 "escalera de elo: cada nivel contra el siguiente"
  r13 "escalera de elo de los niveles NUEVOS (por presupuesto de nodos)"
  r14 "curva de la temperatura a presupuesto congelado (4.500 nodos)"
  r15 "valores de las piezas de Salas 1998, Dekle y Trigonal, contra los puestos a ojo"
)
RONDAS=(r15 r14 r13 r12 r11 r10 r9)

case "${1:-instalar}" in
  estado)
    if launchctl list | grep -q "$ETIQUETA"; then
      echo "servicio: CARGADO"
      launchctl list | grep "$ETIQUETA" | awk '{print "   pid:", $1, "· ultimo codigo de salida:", $2}'
    else
      echo "servicio: NO cargado"
    fi
    echo "procesos vivos: $(pgrep -f '(arena|corpus).js' | wc -l | tr -d ' ')"
    if [ -f "$CASA/horario-nucleos.txt" ]; then
      linea=$(grep -v '^#' "$CASA/horario-nucleos.txt" | grep -v '^$' | head -1)
      campos=(${=linea})
      ahora=$(date +%s)
      if [ "$ahora" -lt "$campos[1]" ]; then
        echo "cupo: $campos[2] nucleos hasta las $(date -r $campos[1] '+%H:%M del %d/%m'), luego $campos[3]"
      else
        echo "cupo: $campos[3] nucleos (el tramo largo acabo a las $(date -r $campos[1] '+%H:%M del %d/%m'))"
      fi
    fi
    for ronda in $RONDAS; do
      [ -d "$CASA/$ronda" ] || continue
      total=0
      linea=""
      for f in "$CASA"/$ronda/*.log(N); do
        # grep -c sale con 1 cuando no hay coincidencias, pero ya imprime el 0;
        # el `|| true` evita que set -e corte y que se sumen dos ceros
        n=$(grep -c '^{' "$f" 2>/dev/null || true)
        total=$((total + n))
        linea="$linea   $(basename $f): $n"
      done
      echo "$ronda ($DESC_RONDA[$ronda]): $total partidas"
      echo "$linea"
      # La ronda 15 empieza generando corpus, y durante esas horas no hay ni un
      # log: sin esta linea el estado diria "0 partidas" y pareceria colgada.
      # Un shard esta terminado cuando tiene su linea de resumen al final.
      corp=0; listos=0
      for f in "$CASA"/$ronda/*.jsonl(N); do
        corp=$((corp + 1))
        if tail -c 2000 "$f" | grep -q '"resumen"'; then listos=$((listos + 1)); fi
      done
      if [ $corp -gt 0 ]; then echo "   corpus: $listos de $corp shards terminados"; fi
      for f in "$CASA"/$ronda/*-hecha.txt(N); do
        echo "   $(basename $f .txt | sed 's/-hecha$//'): ciclo completo el $(cat $f)"
      done
    done
    exit 0 ;;
  resultados)
    for ronda in $RONDAS; do
      [ -d "$CASA/$ronda" ] || continue
      echo "########## $ronda: $DESC_RONDA[$ronda] ##########"
      # Los pares se descubren mirando qué .log hay, no de una lista escrita
      # aquí: esa lista se quedó en los nombres de las rondas 9 a 12, así que
      # las rondas nuevas no salían en el informe aunque tuvieran cientos de
      # partidas. El sufijo -<numero> agrupa los shards de una misma rama
      # (rondas 9-11, que parten cada rama en varios procesos).
      typeset -aU ramas
      ramas=()
      for f in "$CASA"/$ronda/*.log(N); do
        ramas+=("${${$(basename $f .log)}%%-[0-9]##}")
      done
      for rival in $ramas; do
        archivos=("$CASA"/$ronda/$rival-[0-9]*.log(N) "$CASA"/$ronda/$rival.log(N))
        [ ${#archivos} -eq 0 ] && continue
        # la etiqueta no describe ya la comparacion: desde que arena.js
        # escribe cabecera, analiza.js imprime las dos configuraciones reales
        echo "===== $ronda/$rival ====="
        cat "${archivos[@]}" | node analiza.js 300
        echo
      done
    done
    exit 0 ;;
  parar)
    launchctl bootout "gui/$(id -u)/$ETIQUETA" 2>/dev/null || true
    pkill -f "$CASA" 2>/dev/null || true
    echo "detenido"; exit 0 ;;
  arrancar)
    launchctl bootstrap "gui/$(id -u)" "$PLIST"; echo "arrancado"; exit 0 ;;
  quitar)
    launchctl bootout "gui/$(id -u)/$ETIQUETA" 2>/dev/null || true
    rm -f "$PLIST"; echo "desinstalado (el trabajo hecho sigue en $CASA)"; exit 0 ;;
esac

# --- copiar a la zona de trabajo accesible para el servicio ---
#
# ESTE PASO ES EL QUE HAY QUE ACORDARSE DE EJECUTAR. El servicio no lee el
# repo: trabaja sobre estas copias. Una ronda escrita en
# entrenamiento-continuo.sh y no copiada aquí no se ejecuta nunca, y el
# síntoma no es un error sino silencio: launchd relanza cada dos minutos el
# script VIEJO, que ve sus rondas ya terminadas y vuelve a salir. Le pasó a la
# ronda 14, que se quedó con tres de sus seis pares durante horas mientras el
# servicio giraba en vacío. Si añades una ronda, vuelve a lanzar este script.
#
# variants.js entra en la copia del motor desde que hay modalidades: sin él,
# arena.js no arranca. Y los libros de aperturas van uno por modalidad, porque
# las jugadas son claves de casilla y no valen de una a otra (ver aperturas.js).
#
# Y van TODAS las herramientas que la ronda usa, no solo arena.js: desde la
# ronda 15 el guion hace el ciclo entero sin intervención —corpus, regresión y
# arena—, así que también necesita corpus.js, ajusta.js y aperturas.js allí.
# elo.js va porque analiza.js lo carga con require: sin él, la copia de
# analiza.js que hay en $CASA no arranca.
mkdir -p "$CASA/motor" "$HOME/Library/LaunchAgents"
cp "$REPO"/geometry.js "$REPO"/variants.js "$REPO"/rules.js "$REPO"/ai.js "$CASA/motor/"
cp arena.js analiza.js elo.js escalera.js corpus.js ajusta.js aperturas.js \
   entrenamiento-continuo.sh "$CASA/"
cp libro-*.json "$CASA/"
# El horario de nucleos, si lo hay. Va aquí y no al plist porque cambia de
# tramo con el reloj y el guion tiene que poder releerlo mientras corre.
if [ -f horario-nucleos.txt ]; then cp horario-nucleos.txt "$CASA/"; fi

# Gancho de git que mantiene docs/valores-piezas.pdf al día con los valores del
# motor. Se instala aquí porque los ganchos no viajan dentro del repo y este es
# el único script que ya se ejecuta al preparar la máquina.
if [ -d "$REPO/.git/hooks" ]; then
  cp pre-commit.sh "$REPO/.git/hooks/pre-commit"
  chmod +x "$REPO/.git/hooks/pre-commit"
fi
chmod +x "$CASA/entrenamiento-continuo.sh"

cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$ETIQUETA</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>$CASA/entrenamiento-continuo.sh</string>
  </array>
  <key>WorkingDirectory</key><string>$CASA</string>
  <!-- arranca al iniciar sesion; si el script termina o lo corta un apagon,
       launchd lo relanza y arena.js se reanuda sola -->
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>120</integer>
  <!-- Prioridad baja para no estorbar al uso normal del ordenador, PERO SIN
       ProcessType=Background. En Apple Silicon esa banda confina el proceso a
       los núcleos de eficiencia: medido con taskpolicy -b, 208 -> 1429 ms por
       jugada, 6,9x más lento. Con 6 procesos repartiéndose 4 núcleos lentos,
       las partidas de la ronda 9 costaron 3219 s de media en vez de ~18 s, y
       la profundidad 5 habría tardado semanas. Nice 10 + E/S de baja
       prioridad ya ceden el paso al trabajo en primer plano. -->
  <key>Nice</key><integer>10</integer>
  <key>LowPriorityIO</key><true/>
  <key>StandardOutPath</key><string>$CASA/servicio.out</string>
  <key>StandardErrorPath</key><string>$CASA/servicio.err</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$(dirname $NODE):/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>NUCLEOS</key><string>$NUCLEOS</string>
  </dict>
</dict>
</plist>
PLISTEOF

launchctl bootout "gui/$(id -u)/$ETIQUETA" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "Instalado y arrancado: $ETIQUETA"
echo "   trabaja en: $CASA"
echo "   procesos:   $NUCLEOS a la vez (NUCLEOS=N para cambiarlo)"
echo "   estado:     ./instalar-servicio.sh estado"
echo "   resultados: ./instalar-servicio.sh resultados"
