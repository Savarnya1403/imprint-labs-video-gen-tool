#!/bin/sh
# OpusFlow setup: installs Node packages + Python venv
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
echo "=== OpusFlow setup ==="

# Node
if ! command -v node >/dev/null; then echo "ERROR: Node 20+ required"; exit 1; fi
if ! command -v ffmpeg >/dev/null; then echo "ERROR: ffmpeg 7+ required (brew install ffmpeg)"; exit 1; fi
echo "→ npm install..."
cd "$HERE" && npm install --silent
npx playwright install chromium 2>/dev/null || true

# Python venv
PY=${PYTHON:-python3}
if [ ! -d "$HERE/.venv" ]; then
  echo "→ creating Python venv..."
  $PY -m venv "$HERE/.venv"
fi
echo "→ pip install..."
"$HERE/.venv/bin/pip" install -q -r "$HERE/requirements.txt"

echo ""
echo "=== Done! ==="
echo ""
echo "API keys needed (add to .env or export):"
echo "  ANTHROPIC_API_KEY   — script writing (required)"
echo "  PEXELS_API_KEY      — Pexels photo search (free at pexels.com/api/)"
echo "  UNSPLASH_ACCESS_KEY — Unsplash photo search (free at unsplash.com/developers)"
echo ""
echo "Usage:"
echo "  python pipeline/director.py --topic 'your topic' --style vox-pro"
echo ""
echo "Library: $HERE"
