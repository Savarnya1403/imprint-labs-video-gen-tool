"""
Extracts real dominant palettes from the catalog index and bakes them into
a static JS file (palette_library.js) so the renderer can sample them
without fetch overhead.

Grouped by style_tag. Each style → array of palette arrays (one per training image).
"""
import json
from pathlib import Path
from collections import defaultdict

CATALOG  = Path(__file__).parent / "index.json"
OUT_JS   = Path(__file__).parent.parent.parent / "visual" / "palette_library.js"

def run():
    index = json.loads(CATALOG.read_text())

    by_style = defaultdict(list)
    for entry in index:
        tag     = entry.get("style_tag", "EDITORIAL_CREAM")
        palette = entry.get("palette", [])
        mood    = entry.get("mood", "neutral")
        if palette:
            by_style[tag].append({
                "palette": palette[:5],
                "mood":    mood,
                "file":    entry.get("file", ""),
            })

    lines = [
        "// palette_library.js — auto-generated from training catalog.",
        "// Real dominant color palettes extracted from 286 training images.",
        "// Re-run: python3 core/assets/catalog/extract_palettes.py",
        "",
        "export const PALETTE_LIBRARY = " + json.dumps(dict(by_style), indent=2) + ";",
        "",
        "/** Sample a random palette for a given style + mood. */",
        "export function samplePalette(styleTag, mood) {",
        "  const pool = PALETTE_LIBRARY[styleTag] || PALETTE_LIBRARY['EDITORIAL_CREAM'] || [];",
        "  const moodMatch = pool.filter(e => e.mood === mood);",
        "  const src = moodMatch.length > 0 ? moodMatch : pool;",
        "  if (!src.length) return ['#F5EFE0','#1A1A1A','#E05C2A','#D4A853','#FBF7EE'];",
        "  return src[Math.floor(Math.random() * src.length)].palette;",
        "}",
        "",
        "/** Get the most common (dominant) color for a style. */",
        "export function dominantColor(styleTag) {",
        "  const pool = PALETTE_LIBRARY[styleTag] || [];",
        "  const counts = {};",
        "  pool.forEach(e => { const c = e.palette[0]; counts[c] = (counts[c]||0)+1; });",
        "  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || '#F5EFE0';",
        "}",
    ]

    OUT_JS.write_text("\n".join(lines))
    print(f"✓ Wrote {len(index)} entries → {OUT_JS}")
    for style, entries in sorted(by_style.items(), key=lambda x: -len(x[1])):
        print(f"  {style:25s}  {len(entries)} palettes")

if __name__ == "__main__":
    run()
