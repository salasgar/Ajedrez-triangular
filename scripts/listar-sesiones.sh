#!/bin/bash

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$REPO_DIR"

echo "Sesiones activas (worktrees):"
echo ""
git worktree list --porcelain | while read -r linea; do
  if [ -z "$linea" ]; then
    continue
  fi
  CAMINO=$(echo "$linea" | cut -d' ' -f2)
  RAMA=$(echo "$linea" | cut -d' ' -f3 | sed 's/^\[//' | sed 's/\]$//')
  NOMBRE=$(basename "$CAMINO")
  echo "  $NOMBRE  →  $RAMA"
done

echo ""
echo "(Ejecuta 'git worktree list' para más detalles)"
