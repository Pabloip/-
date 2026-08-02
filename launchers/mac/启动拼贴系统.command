#!/bin/zsh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT" || exit 1

PYTHON_BIN="/Users/lipeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
PYTHONPATH="$PROJECT_ROOT" "$PYTHON_BIN" tools/launch_collage_web.py
