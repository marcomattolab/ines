#!/usr/bin/env bash
#
# Start the MiniCPM-OCR inference service (llama.cpp with Metal on Apple Silicon).
# Listens on http://127.0.0.1:18499 with model name "minicpm-ocr".
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LLAMA_TAG="${LLAMA_TAG:-b11901}"
LLAMA_SERVER="$REPO_ROOT/tools/llama-$LLAMA_TAG/llama-server"
MODEL_DIR="$REPO_ROOT/models/MiniCPM-OCR-1.0-gguf"

if [ ! -x "$LLAMA_SERVER" ]; then
  echo "llama-server not found at $LLAMA_SERVER" >&2
  echo "Run: ./scripts/setup.sh llm" >&2
  exit 1
fi

MAIN="$MODEL_DIR/MiniCPM-OCR-1_0-Q8_0.gguf"
MMPROJ="$MODEL_DIR/mmproj-model-f16-4x.gguf"
DRAFT="$MODEL_DIR/dspark-MiniCPM-OCR-1_0-Q8_0.gguf"

for f in "$MAIN" "$MMPROJ" "$DRAFT"; do
  if [ ! -s "$f" ]; then
    echo "Missing model file: $f" >&2
    echo "Run: ./scripts/setup.sh llm" >&2
    exit 1
  fi
done

# Metal on Apple Silicon; CPU otherwise. Override with GPU_LAYERS env var.
GPU_LAYERS="${GPU_LAYERS:-}"
if [ -z "$GPU_LAYERS" ]; then
  case "$(uname -s)/$(uname -m)" in
    Darwin/arm64) GPU_LAYERS=99 ;;
    *)            GPU_LAYERS=0 ;;
  esac
fi

echo "Starting llama-server on http://127.0.0.1:18499 (model: minicpm-ocr)"
exec "$LLAMA_SERVER" \
  --model "$MAIN" \
  --mmproj "$MMPROJ" \
  --model-draft "$DRAFT" \
  --spec-type draft-dspark \
  --spec-draft-n-max 15 \
  --n-gpu-layers "$GPU_LAYERS" \
  --gpu-layers-draft "$GPU_LAYERS" \
  --flash-attn on \
  --ctx-size 8192 \
  --parallel 1 \
  --host 127.0.0.1 \
  --port 18499 \
  --alias minicpm-ocr \
  --jinja \
  --reasoning off
