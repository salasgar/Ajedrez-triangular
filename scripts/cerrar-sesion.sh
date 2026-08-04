#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Uso: scripts/cerrar-sesion.sh <nombre>"
  echo ""
  echo "Cierra un worktree de sesión y registra los pasos para fusionar/limpiar."
  echo ""
  echo "Ejemplo:"
  echo "  scripts/cerrar-sesion.sh feature-x"
  exit 1
fi

NOMBRE="$1"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SESIONES_DIR="$(cd "$REPO_DIR/.." && pwd)/ajedrez-triangular-sesiones"
WORKTREE_PATH="$SESIONES_DIR/$NOMBRE"

cd "$REPO_DIR"

# Comprobar que la rama existe
if ! git show-ref --quiet "refs/heads/$NOMBRE" 2>/dev/null; then
  echo "❌ Error: la rama '$NOMBRE' no existe."
  exit 1
fi

# Comprobar que el worktree existe
if [ ! -d "$WORKTREE_PATH" ]; then
  echo "❌ Error: el worktree en $WORKTREE_PATH no existe."
  exit 1
fi

# Comprobar que el worktree no tiene cambios sin commitear
if ! git -C "$WORKTREE_PATH" diff --quiet || ! git -C "$WORKTREE_PATH" diff --cached --quiet; then
  echo "❌ Error: hay cambios sin commitear en el worktree '$NOMBRE'."
  echo "   Commitealo antes de cerrarlo:"
  echo "   cd $WORKTREE_PATH && git add ... && git commit ..."
  exit 1
fi

# Comprobar si hay commits nuevos en la rama
MASTER_HEAD=$(git rev-parse main)
RAMA_HEAD=$(git rev-parse "$NOMBRE")

if [ "$MASTER_HEAD" = "$RAMA_HEAD" ]; then
  echo "⚠️  La rama '$NOMBRE' no tiene commits nuevos respecto a 'main'."
  echo "   ¿Seguir y eliminarla? (s/n)"
  read -r RESPUESTA
  if [ "$RESPUESTA" != "s" ]; then
    exit 1
  fi
fi

# Eliminar worktree
echo "Eliminando worktree..."
git worktree remove "$WORKTREE_PATH"

echo ""
echo "✅ Worktree '$NOMBRE' cerrado."
echo ""
echo "Pasos siguientes:"
echo ""
echo "1. Fusionar la rama al repo principal:"
echo "   git merge $NOMBRE"
echo ""
echo "2. (Opcional) Eliminar la rama local:"
echo "   git branch -d $NOMBRE"
echo ""
echo "3. (Opcional) Si la rama está en remoto, hacer push de la eliminación:"
echo "   git push origin --delete $NOMBRE"
echo ""
echo "4. (Opcional) Limpiar el directorio de sesiones si está vacío:"
echo "   rmdir $SESIONES_DIR"
