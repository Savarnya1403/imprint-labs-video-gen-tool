#!/bin/sh
# Imprint Labs Video Gen Tool — setup
# Installs Node packages, Playwright Chromium, Python venv + pip deps
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
echo "=== Imprint Labs Video Gen Tool — setup ==="

# ── system deps check ─────────────────────────────────────────────────────
if ! command -v node >/dev/null; then
  echo "ERROR: Node.js 18+ is required."
  echo "       Install: https://nodejs.org  or  brew install node"
  exit 1
fi
if ! command -v ffmpeg >/dev/null; then
  echo "ERROR: ffmpeg is required."
  echo "       Install: brew install ffmpeg  (macOS)  or  apt install ffmpeg  (Linux)"
  exit 1
fi
NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "ERROR: Node.js 18+ required (found $NODE_MAJOR). Please upgrade."
  exit 1
fi

# ── Node packages + Playwright Chromium ───────────────────────────────────
echo "→ npm install..."
cd "$HERE" && npm install --silent

echo "→ installing Playwright Chromium headless shell..."
node node_modules/.bin/playwright install chromium-headless-shell 2>/dev/null || \
node node_modules/.bin/playwright install chromium 2>/dev/null || true

# ── Python venv ───────────────────────────────────────────────────────────
PY=${PYTHON:-python3}
if ! $PY -c "import sys; assert sys.version_info >= (3,10)" 2>/dev/null; then
  echo "ERROR: Python 3.10+ required."
  exit 1
fi
if [ ! -d "$HERE/.venv" ]; then
  echo "→ creating Python venv (.venv)..."
  $PY -m venv "$HERE/.venv"
fi
echo "→ pip install..."
"$HERE/.venv/bin/pip" install -q --upgrade pip
"$HERE/.venv/bin/pip" install -q -r "$HERE/requirements.txt"

# ── .env ──────────────────────────────────────────────────────────────────
if [ ! -f "$HERE/.env" ]; then
  cp "$HERE/.env.example" "$HERE/.env"
  echo "→ created .env from .env.example — add your API keys"
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Activate venv:     source .venv/bin/activate"
echo ""
echo "Add API keys to:   .env"
echo "  ANTHROPIC_API_KEY       — required for AI script writing"
echo "  PEXELS_API_KEY          — recommended for photo search"
echo "  UNSPLASH_ACCESS_KEY     — optional second photo source"
echo ""
echo "Make a film:"
echo "  python pipeline/director.py --topic 'your topic' --style vox-pro"
echo ""
echo "Run the included demo (no API key needed):"
echo "  node core/render/video.mjs films/netflix-mood --fps 30 --size 1080x1920 --workers 4"
echo ""
