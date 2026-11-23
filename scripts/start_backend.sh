#!/usr/bin/env bash
#
# Start the FastAPI backend, wired to the local OCR SDK and inference service.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_VENV="$REPO_ROOT/backend/.venv"
SDK_VENV="$REPO_ROOT/.minicpm-ocr"

if [ ! -x "$BACKEND_VENV/bin/python" ]; then
  echo "Backend venv not found. Run: ./scripts/setup.sh backend" >&2
  exit 1
fi

# Point the backend at the isolated SDK CLI (falls back to $PATH otherwise).
if [ -x "$SDK_VENV/bin/minicpmvocr" ]; then
  export MINICPM_OCR_COMMAND="$SDK_VENV/bin/minicpmvocr"
fi

export MINICPM_OCR_SERVER_URL="${MINICPM_OCR_SERVER_URL:-http://127.0.0.1:18499}"
export MINICPM_OCR_MODEL="${MINICPM_OCR_MODEL:-minicpm-ocr}"
export MINICPM_OCR_BACKEND="${MINICPM_OCR_BACKEND:-llamacpp}"

# Seconda passata: converte i diagrammi di flusso grafici (blocchi immagine) in Mermaid.
# Per disattivarla: MINICPM_DIAGRAM_MERMAID=0 ./scripts/start_backend.sh
export MINICPM_DIAGRAM_MERMAID="${MINICPM_DIAGRAM_MERMAID:-1}"

# Layout detection runs on CPU everywhere except NVIDIA Linux boxes.
if [ -z "${MINICPM_OCR_DEVICE:-}" ]; then
  if [ "$(uname -s)" = Linux ] && command -v nvidia-smi >/dev/null 2>&1; then
    MINICPM_OCR_DEVICE="cuda:0"
  else
    MINICPM_OCR_DEVICE="cpu"
  fi
  export MINICPM_OCR_DEVICE
fi

# Centralize SDK downloads/intermediates inside the repo (git-ignored).
export OCR_ASSETS_DIR="${OCR_ASSETS_DIR:-$REPO_ROOT/models}"
export OCR_RUN_ROOT="${OCR_RUN_ROOT:-$REPO_ROOT/.runs}"

cd "$REPO_ROOT/backend"
exec "$BACKEND_VENV/bin/python" run.py
