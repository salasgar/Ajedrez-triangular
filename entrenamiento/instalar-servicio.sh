#!/bin/zsh
# Instala el entrenamiento como servicio de macOS: arranca solo al iniciar
# sesión y sigue después de apagar y encender el ordenador, retomando el
# trabajo donde se quedó.
#
#   ./instalar-servicio.sh            instala y arranca
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
cd "$(dirname "$0")"
REPO="$(cd .. && pwd)"
CASA="$HOME/Library/Application Support/ajedrez-triangular-entrenamiento"
ETIQUETA="com.salasgar.ajedreztriangular.entrenamiento"
PLIST="$HOME/Library/LaunchAgents/$ETIQUETA.plist"
NODE="$(command -v node)"
# qué mide cada tanda, para que el estado y los resultados se lean solos
typeset -A DESC_RONDA
DESC_RONDA=(
  r9  "profundidad 4: movilidad 4 contra 3 y 5"
  r10 "profundidad 5: movilidad 4 contra 2 y 3"
  r11 "movilidad 4 contra 2 a profundidades 3 y 4 (la de 5 esta en r10)"
  r12 "escalera de elo: cada nivel contra el siguiente"
  r13 "escalera de elo de los niveles NUEVOS (por presupuesto de nodos)"
)
RONDAS=(r13 r12 r11 r10 r9)

case "${1:-instalar}" in
  estado)
    if launchctl list | grep -q "$ETIQUETA"; then
      echo "servicio: CARGADO"
      launchctl list | grep "$ETIQUETA" | awk '{print "   pid:", $1, "· ultimo codigo de salida:", $2}'
    else
      echo "servicio: NO cargado"
    fi
    echo "procesos de arena vivos: $(pgrep -f 'arena.js' | wc -l | tr -d ' ')"
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
    done
    exit 0 ;;
  resultados)
    for ronda in $RONDAS; do
      [ -d "$CASA/$ronda" ] || continue
      echo "########## $ronda: $DESC_RONDA[$ronda] ##########"
      for rival in n23 n34 n45 n56 n25 e23 e34 e45 e56 d3 d4 mov2 mov3 mov5; do
        # con y sin sufijo de semilla: las rondas 9-11 parten cada rama en
        # varios procesos (mov2-0.log), la 12 usa uno solo (e23.log)
        archivos=("$CASA"/$ronda/$rival-*.log(N) "$CASA"/$ronda/$rival.log(N))
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
mkdir -p "$CASA/motor" "$HOME/Library/LaunchAgents"
cp "$REPO"/geometry.js "$REPO"/rules.js "$REPO"/ai.js "$CASA/motor/"
cp arena.js analiza.js libro.json entrenamiento-continuo.sh "$CASA/"
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
  </dict>
</dict>
</plist>
PLISTEOF

launchctl bootout "gui/$(id -u)/$ETIQUETA" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "Instalado y arrancado: $ETIQUETA"
echo "   trabaja en: $CASA"
echo "   estado:     ./instalar-servicio.sh estado"
echo "   resultados: ./instalar-servicio.sh resultados"
