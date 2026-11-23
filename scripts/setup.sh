#!/usr/bin/env bash
#
# MiniCPM Document Studio — setup script.
#
# Installs the project dependencies in an idempotent way. Nothing is ever
# downloaded or rebuilt if it is already present.
#
# Usage:
#   ./scripts/setup.sh all        # everything (backend + frontend + OCR + LibreOffice)
#   ./scripts/setup.sh backend    # FastAPI backend venv only
#   ./scripts/setup.sh frontend   # Angular frontend (npm install)
#   ./scripts/setup.sh office     # LibreOffice (Office -> PDF conversion)
#   ./scripts/setup.sh sdk        # MiniCPM-OCR SDK venv (layout detection)
#   ./scripts/setup.sh llm        # llama.cpp + GGUF models (inference service)
#
# Environment overrides (optional):
#   PYTHON            Python executable (>= 3.10) used to build the venvs
#   LLAMA_TAG         llama.cpp release tag (default: b11901)
#   HF_ENDPOINT       Hugging Face mirror, e.g. https://hf-mirror.com
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_VENV="$REPO_ROOT/backend/.venv"
SDK_VENV="$REPO_ROOT/.minicpm-ocr"
MODELS_DIR="$REPO_ROOT/models"
TOOLS_DIR="$REPO_ROOT/tools"

LLAMA_TAG="${LLAMA_TAG:-b11901}"
LLAMA_VER="llama-$LLAMA_TAG"

# ---------------------------------------------------------------------------
# Platform detection
# ---------------------------------------------------------------------------
detect_platform() {
  OS="$(uname -s)"
  ARCH="$(uname -m)"
  case "$OS" in
    Darwin) OS="macos" ;;
    Linux)  OS="linux" ;;
    *) echo "Unsupported OS: $OS" >&2; exit 1 ;;
  esac
  case "$ARCH" in
    arm64|aarch64|x86_64) ;;
    *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
  esac
}

# ---------------------------------------------------------------------------
# Python detection (>= 3.10)
# ---------------------------------------------------------------------------
find_python() {
  if [ -n "${PYTHON:-}" ]; then
    "$PYTHON" -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' && { echo "$PYTHON"; return; }
    echo "PYTHON=$PYTHON is not a valid Python >= 3.10" >&2; exit 1
  fi
  for cand in python3.13 python3.12 python3.11 python3.10 python3; do
    if command -v "$cand" >/dev/null 2>&1 && "$cand" -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' 2>/dev/null; then
      command -v "$cand"
      return
    fi
  done
  echo "No Python >= 3.10 found. Install it (e.g. 'brew install python@3.12')." >&2
  exit 1
}

# ---------------------------------------------------------------------------
# Backend
# ---------------------------------------------------------------------------
setup_backend() {
  PY="$(find_python)"
  echo "==> Backend venv: $BACKEND_VENV ($("$PY" --version 2>&1))"
  if [ ! -x "$BACKEND_VENV/bin/python" ]; then
    "$PY" -m venv "$BACKEND_VENV"
  fi
  "$BACKEND_VENV/bin/python" -m pip install --upgrade pip >/dev/null
  "$BACKEND_VENV/bin/pip" install -r "$REPO_ROOT/backend/requirements.txt"
  echo "==> Backend ready."
}

# ---------------------------------------------------------------------------
# Frontend
# ---------------------------------------------------------------------------
setup_frontend() {
  if ! command -v npm >/dev/null 2>&1; then
    echo "npm not found. Install Node.js >= 22 first." >&2; exit 1
  fi
  echo "==> Frontend (INES): npm install"
  (cd "$REPO_ROOT/ines-ng" && npm install)
  echo "==> Frontend ready."
}

# ---------------------------------------------------------------------------
# LibreOffice (Office -> PDF)
# ---------------------------------------------------------------------------
setup_office() {
  if command -v libreoffice >/dev/null 2>&1 || command -v soffice >/dev/null 2>&1; then
    echo "==> LibreOffice already installed ($(command -v libreoffice || command -v soffice))."
    return
  fi
  echo "==> Installing LibreOffice..."
  case "$OS" in
    macos)
      if ! command -v brew >/dev/null 2>&1; then
        echo "Homebrew not found. Install it from https://brew.sh first." >&2; exit 1
      fi
      brew install --cask libreoffice
      ;;
    linux)
      if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update && sudo apt-get install -y libreoffice
      else
        echo "Only apt-based Linux is supported by this script. Install LibreOffice manually." >&2; exit 1
      fi
      ;;
  esac
  echo "==> LibreOffice ready."
}

# ---------------------------------------------------------------------------
# MiniCPM-OCR SDK (layout detection)
# ---------------------------------------------------------------------------
setup_sdk() {
  PY="$(find_python)"
  echo "==> SDK venv: $SDK_VENV"
  if [ ! -x "$SDK_VENV/bin/python" ]; then
    "$PY" -m venv "$SDK_VENV"
  fi
  "$SDK_VENV/bin/python" -m pip install --upgrade pip >/dev/null
  "$SDK_VENV/bin/pip" install "minicpm-ocr[all]"
  # PaddlePaddle provides the layout-detection runtime and is installed
  # separately (it is not a dependency of the SDK wheel).
  if [ "$OS" = macos ]; then
    "$SDK_VENV/bin/pip" install "paddlepaddle==3.3.0"
  elif command -v nvidia-smi >/dev/null 2>&1; then
    "$SDK_VENV/bin/pip" install "paddlepaddle-gpu==3.3.0" \
      -i https://www.paddlepaddle.org.cn/packages/stable/cu129/
  else
    "$SDK_VENV/bin/pip" install "paddlepaddle==3.3.0"
  fi
  "$SDK_VENV/bin/pip" install "pypdfium2>=4"
  echo "==> Verifying SDK CLI..."
  "$SDK_VENV/bin/minicpmvocr" parse --help >/dev/null
  echo "==> SDK ready: $SDK_VENV/bin/minicpmvocr"
}

# ---------------------------------------------------------------------------
# llama.cpp + GGUF models (inference service)
# ---------------------------------------------------------------------------
setup_llm() {
  # --- llama.cpp binary ---
  if [ "$OS" = macos ] && [ "$ARCH" = arm64 ]; then
    PKG="llama-$LLAMA_TAG-bin-macos-arm64.tar.gz"
    URL="https://github.com/ggml-org/llama.cpp/releases/download/$LLAMA_TAG/$PKG"
    if [ ! -x "$TOOLS_DIR/$LLAMA_VER/llama-server" ]; then
      echo "==> Downloading llama.cpp ($LLAMA_TAG, macOS arm64)..."
      mkdir -p "$TOOLS_DIR"
      TMP="$(mktemp -d)"
      curl -fL --retry 3 -o "$TMP/$PKG" "$URL"
      tar xzf "$TMP/$PKG" -C "$TOOLS_DIR"
      rm -rf "$TMP"
    fi
    LLAMA_SERVER="$TOOLS_DIR/$LLAMA_VER/llama-server"
  elif [ "$OS" = linux ]; then
    PKG="llama-$LLAMA_TAG-bin-ubuntu-x64.tar.gz"
    if [ "$ARCH" = arm64 ]; then PKG="llama-$LLAMA_TAG-bin-ubuntu-arm64.tar.gz"; fi
    URL="https://github.com/ggml-org/llama.cpp/releases/download/$LLAMA_TAG/$PKG"
    if [ ! -x "$TOOLS_DIR/$LLAMA_VER/llama-server" ]; then
      echo "==> Downloading llama.cpp ($LLAMA_TAG, $OS/$ARCH)..."
      mkdir -p "$TOOLS_DIR"
      TMP="$(mktemp -d)"
      curl -fL --retry 3 -o "$TMP/$PKG" "$URL"
      tar xzf "$TMP/$PKG" -C "$TOOLS_DIR"
      rm -rf "$TMP"
    fi
    LLAMA_SERVER="$TOOLS_DIR/$LLAMA_VER/llama-server"
  else
    echo "llama.cpp prebuilt packages are only provided for macOS arm64 and Linux. Build from source for other platforms." >&2
    exit 1
  fi
  echo "==> llama.cpp: $LLAMA_SERVER"

  # --- GGUF models ---
  MODEL_DIR="$MODELS_DIR/MiniCPM-OCR-1.0-gguf"
  MAIN="MiniCPM-OCR-1_0-Q8_0.gguf"
  MMPROJ="mmproj-model-f16-4x.gguf"
  DRAFT="dspark-MiniCPM-OCR-1_0-Q8_0.gguf"
  mkdir -p "$MODEL_DIR"

  download_model() {
    local name="$1" repo="$2"
    local dest="$MODEL_DIR/$name"
    if [ -s "$dest" ]; then
      echo "    ~ $name already present."
      return
    fi
    echo "    -> downloading $name ($repo)"
    curl -fL --retry 3 -o "$dest.part" "https://huggingface.co/$repo/resolve/main/$name" \
      || curl -fL --retry 3 -o "$dest.part" "https://modelscope.cn/models/$repo/resolve/master/$name"
    mv "$dest.part" "$dest"
  }

  echo "==> Downloading MiniCPM-OCR 1.0 GGUF models (~2 GB)..."
  download_model "$MAIN"   "openbmb/MiniCPM-OCR-1.0-gguf"
  download_model "$MMPROJ" "openbmb/MiniCPM-OCR-1.0-gguf"
  download_model "$DRAFT"  "openbmb/MiniCPM-OCR-1.0-DSpark-gguf"
  echo "==> Models ready in $MODEL_DIR"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
detect_platform
echo "Platform: $OS/$ARCH"
STAGE="${1:-all}"

case "$STAGE" in
  all)       setup_backend; setup_frontend; setup_office; setup_sdk; setup_llm ;;
  backend)   setup_backend ;;
  frontend)  setup_frontend ;;
  office)    setup_office ;;
  sdk)       setup_sdk ;;
  llm)       setup_llm ;;
  *)
    echo "Unknown stage: $STAGE" >&2
    echo "Valid stages: all, backend, frontend, office, sdk, llm" >&2
    exit 1
    ;;
esac

echo ""
echo "Done. Next steps:"
echo "  1. ./scripts/start_be.sh        # start OCR + backend together"
echo "  2. (cd ines-ng && npm start)    # start the INES UI"
echo "  UI:  http://127.0.0.1:4200"
