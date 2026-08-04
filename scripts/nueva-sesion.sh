#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Uso: scripts/nueva-sesion.sh <nombre>"
  echo ""
  echo "Crea una rama nueva a partir de main y un worktree aislado para trabajar sin interferencias."
  echo ""
  echo "Ejemplo:"
  echo "  scripts/nueva-sesion.sh feature-x"
  echo "  cd ../ajedrez-triangular-sesiones/feature-x"
  echo "  # ... trabajar ..."
  echo "  cd - && scripts/cerrar-sesion.sh feature-x"
  exit 1
fi

NOMBRE="$1"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SESIONES_DIR="$(cd "$REPO_DIR/.." && pwd)/ajedrez-triangular-sesiones"
WORKTREE_PATH="$SESIONES_DIR/$NOMBRE"

# Comprobar que estamos en el repo principal
if [ ! -d "$REPO_DIR/.git" ]; then
  echo "❌ Error: no se encontró .git en $REPO_DIR"
  exit 1
fi

# Comprobar que estamos en rama main
RAMA_ACTUAL=$(cd "$REPO_DIR" && git rev-parse --abbrev-ref HEAD)
if [ "$RAMA_ACTUAL" != "main" ]; then
  echo "⚠️  Aviso: estás en rama '$RAMA_ACTUAL', no en 'main'."
  echo "   ¿Seguir usando '$RAMA_ACTUAL' como base? (s/n)"
  read -r RESPUESTA
  if [ "$RESPUESTA" != "s" ]; then
    exit 1
  fi
fi

# Comprobar que no hay cambios sin commitear en el repo principal
cd "$REPO_DIR"
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "❌ Error: hay cambios sin commitear en el repo principal."
  echo "   Commitealo o guárdalo (git stash) antes de crear una sesión nueva."
  exit 1
fi

# Crear directorio de sesiones si no existe
mkdir -p "$SESIONES_DIR"

# Comprobar que el worktree/rama no exista ya
if git show-ref --quiet "refs/heads/$NOMBRE" 2>/dev/null; then
  echo "❌ Error: la rama '$NOMBRE' ya existe."
  exit 1
fi

if [ -d "$WORKTREE_PATH" ]; then
  echo "❌ Error: el worktree en $WORKTREE_PATH ya existe."
  exit 1
fi

# Crear rama y worktree de una vez (git worktree add -b crea ambos)
if ! git worktree add -b "$NOMBRE" "$WORKTREE_PATH" main; then
  echo "❌ Error al crear el worktree/rama."
  exit 1
fi

echo ""
echo "✅ Sesión '$NOMBRE' creada en:"
echo "   $WORKTREE_PATH"
echo ""
echo "Próximos pasos:"
echo "   cd $WORKTREE_PATH"
echo "   claude    # abre Claude Code en el worktree"
echo ""
echo "Al terminar, desde el repo principal:"
echo "   git merge $NOMBRE"
echo "   scripts/cerrar-sesion.sh $NOMBRE"
