#!/bin/zsh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -f "$SCRIPT_DIR/tools/launch_collage_web.py" ]; then
  PROJECT_ROOT="$SCRIPT_DIR"
else
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/launchers/mac/../.." && pwd)"
fi

cd "$PROJECT_ROOT" || exit 1

PYTHON_BIN="/Users/lipeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
PYTHONPATH="$PROJECT_ROOT" "$PYTHON_BIN" tools/launch_collage_web.py
