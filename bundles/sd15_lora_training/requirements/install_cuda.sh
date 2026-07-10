#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
REQ="$ROOT/requirements/requirements-cuda.txt"

if [ ! -f "$REQ" ]; then
  echo "Run this script from the copied ninebot_lora_training_bundle directory first." >&2
  echo "Expected requirements file: $REQ" >&2
  exit 1
fi

if [ -x "$ROOT/../.venv/bin/python" ]; then
  PYTHON="$ROOT/../.venv/bin/python"
elif [ -x "$ROOT/../../.venv/bin/python" ]; then
  PYTHON="$ROOT/../../.venv/bin/python"
elif command -v python >/dev/null 2>&1; then
  PYTHON="$(command -v python)"
else
  echo "No python executable found. Activate the target ComfyUI venv and rerun." >&2
  exit 1
fi

echo "Using python: $PYTHON"
"$PYTHON" - <<'PY'
import sys
print("Python:", sys.version)
try:
    import torch
    print("torch:", torch.__version__)
    print("cuda available:", torch.cuda.is_available())
    if torch.cuda.is_available():
        print("cuda device:", torch.cuda.get_device_name(0))
except Exception as exc:
    print("torch check failed:", exc)
PY

echo
echo "Installing CUDA LoRA training dependencies..."
"$PYTHON" -m pip install -r "$REQ"

echo
echo "Verifying key modules..."
"$PYTHON" - <<'PY'
mods = [
    "torch",
    "accelerate",
    "diffusers",
    "transformers",
    "xformers",
    "bitsandbytes",
    "lion_pytorch",
    "dadaptation",
    "tensorboard",
]
for name in mods:
    mod = __import__(name)
    print(f"{name}: {getattr(mod, '__version__', 'OK')}")
PY

echo
echo "Done. Restart ComfyUI before opening the LoRA training workflows."
