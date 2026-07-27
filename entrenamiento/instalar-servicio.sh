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

case "${1:-instalar}" in
  estado)
    if launchctl list | grep -q "$ETIQUETA"; then
      echo "servicio: CARGADO"
      launchctl list | grep "$ETIQUETA" | awk '{print "   pid:", $1, "· ultimo codigo de salida:", $2}'
    else
      echo "servicio: NO cargado"
    fi
    echo "procesos de arena vivos: $(pgrep -f 'arena.js' | wc -l | tr -d ' ')"
    echo "trabajo en: $CASA/r9"
    total=0
    for f in "$CASA"/r9/*.log(N); do
      # grep -c sale con 1 cuando no hay ninguna coincidencia, pero ya imprime
      # el 0; el `|| true` evita que set -e corte y que se sumen dos ceros
      n=$(grep -c '^{' "$f" 2>/dev/null || true)
      total=$((total + n))
      echo "   $(basename $f): $n partidas"
    done
    echo "TOTAL: $total partidas"
    exit 0 ;;
  resultados)
    for rival in mov3 mov5; do
      archivos=("$CASA"/r9/$rival-*.log(N))
      [ ${#archivos} -eq 0 ] && continue
      echo "===== movilidad 4 (A) contra $rival (B) ====="
      cat "${archivos[@]}" | node analiza.js 300
      echo
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
mkdir -p "$CASA/motor" "$CASA/r9" "$HOME/Library/LaunchAgents"
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
  <!-- prioridad baja: no debe estorbar al uso normal del ordenador -->
  <key>Nice</key><integer>10</integer>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$CASA/r9/servicio.out</string>
  <key>StandardErrorPath</key><string>$CASA/r9/servicio.err</string>
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
