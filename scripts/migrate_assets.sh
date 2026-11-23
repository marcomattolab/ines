#!/usr/bin/env bash
#
# Migra gli asset pesanti (modelli GGUF + binari llama.cpp) dalla vecchia repo
# minicpm-document-studio dentro INES, così non devi riscaricare ~2 GB.
#
# I venv NON vengono copiati (dipendono dai percorsi assoluti):
# ricreali con ./scripts/setup.sh backend e ./scripts/setup.sh sdk.
#
# Uso:
#   ./scripts/migrate_assets.sh [/percorso/vecchia/repo]
#
set -euo pipefail

OLD_REPO="${1:-$HOME/Downloads/minicpm-document-studio}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -d "$OLD_REPO" ]; then
  echo "Repo sorgente non trovata: $OLD_REPO" >&2
  echo "Uso: ./scripts/migrate_assets.sh /percorso/vecchia/repo" >&2
  exit 1
fi

copy_dir() {
  local src="$1" dst="$2"
  if [ -d "$src" ]; then
    if [ -d "$dst" ]; then
      echo "  ~ $dst già presente, salto."
    else
      echo "  -> copio $src → $dst"
      cp -R "$src" "$dst"
    fi
  fi
}

echo "Migrazione assets da: $OLD_REPO"
echo "Destinazione:        $REPO_ROOT"
echo ""

copy_dir "$OLD_REPO/models" "$REPO_ROOT/models"
copy_dir "$OLD_REPO/tools" "$REPO_ROOT/tools"

echo ""
echo "Fatto. Ora esegui:"
echo "  ./scripts/setup.sh backend   # ricrea il venv FastAPI"
echo "  ./scripts/setup.sh sdk       # ricrea il venv SDK MiniCPM-OCR"
echo "  ./scripts/setup.sh office    # (opzionale) LibreOffice"
