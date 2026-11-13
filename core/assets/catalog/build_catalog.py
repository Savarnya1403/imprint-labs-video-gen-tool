#!/usr/bin/env python3
"""
Asset Catalog Builder — processes all training library images with Claude vision.
Generates NLP labels so images can be semantically matched to video scenes.

Two asset types detected:
  PROP    — photo cutout of a real object (transparent/white bg) → composited into canvas
  STYLE   — design reference frame showing editorial/visual style → teaches Canvas 2D code

Output: core/assets/catalog/index.json
"""
import os, sys, json, base64, re, time
from pathlib import Path
import anthropic

HERE   = Path(__file__).parent
IMAGES = HERE / "images"
OUT    = HERE / "index.json"

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

PROP_PROMPT = """Analyze this image asset for a video production pipeline. It appears to be a photo cutout / compositing prop.

Return ONLY valid JSON (no markdown) with this exact structure:
{
  "type": "prop",
  "subject": "one-line description of what this is",
  "category": "one of: animal|person|building|vehicle|object|food|nature|technology|symbol|collage",
  "tags": ["tag1","tag2","tag3","tag4","tag5"],
  "topics": ["topic1","topic2"],
  "mood": "one of: powerful|playful|serious|celebratory|dark|neutral|inspiring",
  "dominant_colors": ["#hex1","#hex2"],
  "has_transparency": true,
  "orientation": "portrait|landscape|square",
  "use_cases": ["use1","use2","use3"],
  "canvas_placement": "one of: center|bottom-anchor|floating|background-element|foreground-pop",
  "scale_hint": "one of: large|medium|small|flexible"
}"""

STYLE_PROMPT = """Analyze this design reference frame for a video production pipeline. It shows a visual/editorial style to replicate in Canvas 2D.

Return ONLY valid JSON (no markdown) with this exact structure:
{
  "type": "style",
  "style_name": "short descriptive style name",
  "style_family": "one of: editorial|infographic|typographic|collage|minimal|bold|retro|dark|data-viz|presentation",
  "tags": ["tag1","tag2","tag3","tag4","tag5"],
  "topics": ["topic1","topic2"],
  "mood": "one of: authoritative|playful|modern|warm|energetic|minimal|cinematic|corporate|academic",
  "bg_color": "#hex or 'gradient' or 'image'",
  "dominant_colors": ["#hex1","#hex2","#hex3"],
  "typography_style": "description of type treatment",
  "layout_pattern": "description of layout: e.g. hero-left-text-right, full-bleed-headline, split-column",
  "key_visual_elements": ["element1","element2","element3"],
  "animation_hints": ["what could animate: e.g. text-slam-in","illustration-pop","counter-roll"],
  "canvas_code_notes": "2-3 sentences on how to replicate this in Canvas 2D: shapes, colors, font weights, composition",
  "scene_types": ["which scene types this fits: text-slam|stat-reveal|consulting-brief|kinetic-type|newspaper|etc"]
}"""

def encode_image(path: Path) -> str:
    with open(path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")

def is_style_ref(name: str) -> bool:
    """T-series = style references; numbered = props."""
    stem = name.lower().replace(".jpg","").replace(".png","")
    return stem.startswith("t") and len(stem) > 1

def analyze_image(path: Path) -> dict:
    ext = path.suffix.lower().lstrip(".")
    media = "image/jpeg" if ext in ("jpg","jpeg") else "image/png"
    b64   = encode_image(path)
    is_style = is_style_ref(path.name)
    prompt   = STYLE_PROMPT if is_style else PROP_PROMPT

    for attempt in range(3):
        try:
            resp = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=512,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": media, "data": b64}},
                        {"type": "text",  "text": prompt}
                    ]
                }]
            )
            raw = resp.content[0].text.strip()
            # strip markdown fences if present
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)
            data = json.loads(raw)
            data["file"] = path.name
            data["path"] = f"core/assets/catalog/images/{path.name}"
            return data
        except Exception as e:
            print(f"    attempt {attempt+1} failed: {e}")
            time.sleep(2 ** attempt)
    return {"file": path.name, "path": f"core/assets/catalog/images/{path.name}",
            "type": "style" if is_style_ref(path.name) else "prop",
            "error": "analysis_failed", "tags": [], "topics": []}

def main():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY not set")
        sys.exit(1)

    images = sorted(IMAGES.glob("*.[jp][pn]g")) + sorted(IMAGES.glob("*.png"))
    images = list({p.name: p for p in images}.values())  # deduplicate
    print(f"Found {len(images)} images to catalog")

    # load existing index to allow resume
    existing = {}
    if OUT.exists():
        try:
            existing = {e["file"]: e for e in json.loads(OUT.read_text())}
            print(f"  resuming — {len(existing)} already processed")
        except Exception:
            pass

    catalog = list(existing.values())
    done    = set(existing.keys())

    for i, img_path in enumerate(images):
        if img_path.name in done:
            continue
        print(f"  [{i+1}/{len(images)}] {img_path.name}...")
        entry = analyze_image(img_path)
        catalog.append(entry)
        done.add(img_path.name)

        if (i + 1) % 10 == 0:
            OUT.write_text(json.dumps(catalog, indent=2))
            print(f"    saved progress ({len(catalog)} entries)")

        time.sleep(0.3)  # gentle rate limit

    OUT.write_text(json.dumps(catalog, indent=2))
    print(f"\nDone. Catalog: {OUT}  ({len(catalog)} entries)")

    # summary stats
    props  = sum(1 for e in catalog if e.get("type") == "prop")
    styles = sum(1 for e in catalog if e.get("type") == "style")
    errors = sum(1 for e in catalog if "error" in e)
    print(f"  Props: {props}  |  Style refs: {styles}  |  Errors: {errors}")

if __name__ == "__main__":
    main()
