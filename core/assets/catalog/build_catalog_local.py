"""
Local Catalog Builder — zero API, zero login.
Analyzes all 286 training images using Pillow + numpy + scikit-learn.

Extracted per image:
  - Dominant color palette (k-means, 6 swatches)
  - Color temperature (warm/cool/neutral)
  - Brightness category (dark / mid / light)
  - Saturation profile (vivid / muted / grayscale)
  - Layout type (inferred from edge/region density)
  - Complexity score (edge density)
  - Background darkness (is this a dark-bg image?)
  - Semantic style tag (mapped from color+brightness features)
  - Asset type (PROP vs STYLE)

Output: core/assets/catalog/index.json  (same schema as the API version)
"""

import os, json, math, re, sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from sklearn.cluster import KMeans

CATALOG_DIR = Path(__file__).parent
IMAGES_DIR  = CATALOG_DIR / "images"
INDEX_PATH  = CATALOG_DIR / "index.json"

# ── helpers ───────────────────────────────────────────────────────────────────

def dominant_palette(img_rgb: np.ndarray, n=6) -> list[str]:
    """k-means dominant palette → hex strings."""
    small = img_rgb[::4, ::4].reshape(-1, 3).astype(float)
    # sample max 2000 pixels for speed
    if len(small) > 2000:
        idx = np.random.choice(len(small), 2000, replace=False)
        small = small[idx]
    km = KMeans(n_clusters=n, n_init=4, random_state=42)
    km.fit(small)
    # sort by cluster size (most dominant first)
    counts = np.bincount(km.labels_)
    order  = np.argsort(-counts)
    return [
        "#{:02x}{:02x}{:02x}".format(
            int(km.cluster_centers_[i][0]),
            int(km.cluster_centers_[i][1]),
            int(km.cluster_centers_[i][2])
        )
        for i in order
    ]

def rgb_to_hsv(r, g, b):
    r, g, b = r/255, g/255, b/255
    mx, mn = max(r, g, b), min(r, g, b)
    df = mx - mn
    h = 0
    if df > 0:
        if mx == r: h = (60 * ((g-b)/df % 6))
        elif mx == g: h = (60 * ((b-r)/df + 2))
        else:          h = (60 * ((r-g)/df + 4))
    s = 0 if mx == 0 else df/mx
    v = mx
    return h, s, v

def color_temperature(r, g, b):
    """warm / cool / neutral"""
    warm_bias = r - b
    if warm_bias > 25:  return "warm"
    if warm_bias < -25: return "cool"
    return "neutral"

def saturation_profile(arr_flat):
    """vivid / muted / grayscale"""
    sat_vals = []
    for r, g, b in arr_flat[::8]:
        _, s, _ = rgb_to_hsv(r, g, b)
        sat_vals.append(s)
    mean_sat = np.mean(sat_vals)
    if mean_sat < 0.08: return "grayscale"
    if mean_sat < 0.25: return "muted"
    return "vivid"

def brightness_category(mean_v):
    if mean_v < 80:  return "dark"
    if mean_v < 160: return "mid"
    return "light"

def edge_density(img_gray):
    """fraction of edge pixels → complexity 0–1"""
    edges = img_gray.filter(ImageFilter.FIND_EDGES)
    arr   = np.array(edges)
    return float((arr > 30).mean())

def region_layout(arr_rgb):
    """
    Rough layout detection by comparing top/bottom/left/right quadrant brightness.
    Returns: 'full-bleed' | 'split-left' | 'split-right' | 'top-heavy' | 'bottom-heavy' | 'center-focus'
    """
    H, W = arr_rgb.shape[:2]
    gray = arr_rgb.mean(axis=2)
    top    = gray[:H//2, :].mean()
    bot    = gray[H//2:, :].mean()
    left   = gray[:, :W//2].mean()
    right  = gray[:, W//2:].mean()
    center = gray[H//4:3*H//4, W//4:3*W//4].mean()
    edge   = (top + bot + left + right) / 4

    if abs(left - right) > 30:
        return "split-left" if left < right else "split-right"
    if abs(top - bot) > 25:
        return "top-heavy" if top < bot else "bottom-heavy"
    if abs(center - edge) > 20:
        return "center-focus"
    return "full-bleed"

# ── semantic style tag ────────────────────────────────────────────────────────

def infer_style_tag(brightness, saturation, temperature, complexity, layout):
    """
    Rule-based: maps visual features → one of the 7 style DNA families.
    """
    if brightness == "dark":
        return "DARK_COLLAGE"
    if saturation == "vivid" and temperature == "cool":
        return "INFOGRAPHIC_TEAL"
    if saturation == "muted" and brightness == "light" and temperature == "warm":
        return "EDITORIAL_CREAM"
    if saturation == "vivid" and brightness == "light":
        if layout in ("split-left", "split-right"):
            return "RETRO_GRID"
        return "TEAL_EDITORIAL"
    if saturation == "grayscale":
        return "BOLD_TYPOGRAPHIC"
    if complexity > 0.08 and brightness == "mid":
        return "PAPER_ILLUS"
    if temperature == "warm" and brightness == "light":
        return "EDITORIAL_CREAM"
    return "EDITORIAL_CREAM"

def infer_mood(brightness, saturation, temperature):
    if brightness == "dark" and saturation == "vivid":
        return "dramatic"
    if brightness == "light" and temperature == "warm":
        return "editorial"
    if saturation == "vivid" and temperature == "cool":
        return "energetic"
    if saturation == "muted":
        return "calm"
    if brightness == "dark":
        return "serious"
    return "neutral"

def infer_categories(filename, saturation, brightness, temperature, layout):
    cats = []
    fn = filename.lower()

    # number-only files (171, 303-352) tend to be PROP cutouts
    if re.match(r'^\d+\.(jpg|png)$', fn):
        cats.append("prop")
        cats.append("cutout")
    else:
        cats.append("style")
        cats.append("reference")

    if brightness == "dark": cats.append("dark-bg")
    if temperature == "warm": cats.append("warm-tone")
    if temperature == "cool": cats.append("teal-tone")
    if saturation == "vivid": cats.append("bold")
    if layout in ("split-left","split-right"): cats.append("split-layout")
    return list(dict.fromkeys(cats))  # dedup

def infer_description(filename, palette, brightness, saturation, temperature,
                      complexity, layout, style_tag):
    """Generate a natural-language NLP description from visual features."""
    tone = temperature + " tone"
    bri  = {"dark": "dark background", "mid": "mid-tone", "light": "bright/light background"}[brightness]
    sat  = {"vivid": "vibrant, high-saturation", "muted": "muted, desaturated", "grayscale": "grayscale or near-monochrome"}[saturation]
    comp = "complex/detailed" if complexity > 0.1 else "clean/minimal"
    dominant = palette[0] if palette else "#unknown"
    style_name = {
        "DARK_COLLAGE":     "dark editorial collage with photo cutouts",
        "INFOGRAPHIC_TEAL": "teal infographic with card layouts",
        "EDITORIAL_CREAM":  "warm cream editorial layout",
        "RETRO_GRID":       "retro grid-paper browser-window style",
        "TEAL_EDITORIAL":   "teal editorial poster",
        "BOLD_TYPOGRAPHIC": "bold typographic minimal design",
        "PAPER_ILLUS":      "paper illustration with ink texture",
    }.get(style_tag, "editorial layout")

    fn = filename.lower()
    asset_type = "prop/cutout asset" if re.match(r'^\d+\.(jpg|png)$', fn) else "T-series style reference"

    return (
        f"{asset_type}: {style_name}. "
        f"{sat} palette, {bri}, {tone}, {comp} composition. "
        f"Layout: {layout}. Dominant color: {dominant}."
    )

def infer_asset_type(filename):
    if re.match(r'^\d+\.(jpg|png)$', filename.lower()):
        return "PROP"
    return "STYLE"

# ── main ──────────────────────────────────────────────────────────────────────

def analyze_image(path: Path) -> dict:
    img = Image.open(path).convert("RGB")

    # downsample for processing speed
    thumb = img.resize((128, 128), Image.LANCZOS)
    arr   = np.array(thumb)
    gray  = thumb.convert("L")

    # mean rgb for quick metrics
    mean_r = float(arr[:,:,0].mean())
    mean_g = float(arr[:,:,1].mean())
    mean_b = float(arr[:,:,2].mean())
    mean_v = (mean_r + mean_g + mean_b) / 3

    # features
    palette     = dominant_palette(arr, n=6)
    temp        = color_temperature(mean_r, mean_g, mean_b)
    sat         = saturation_profile(arr.reshape(-1, 3))
    brightness  = brightness_category(mean_v)
    complexity  = edge_density(gray)
    layout      = region_layout(arr)
    style_tag   = infer_style_tag(brightness, sat, temp, complexity, layout)
    mood        = infer_mood(brightness, sat, temp)
    cats        = infer_categories(path.name, sat, brightness, temp, layout)
    desc        = infer_description(path.name, palette, brightness, sat, temp,
                                    complexity, layout, style_tag)
    asset_type  = infer_asset_type(path.name)

    return {
        "file":        path.name,
        "path":        str(path.relative_to(CATALOG_DIR.parent.parent.parent)),
        "asset_type":  asset_type,
        "description": desc,
        "style_tag":   style_tag,
        "mood":        mood,
        "categories":  cats,
        "palette":     palette,
        "features": {
            "brightness":    brightness,
            "saturation":    sat,
            "temperature":   temp,
            "complexity":    round(complexity, 4),
            "layout":        layout,
            "mean_rgb":      [round(mean_r,1), round(mean_g,1), round(mean_b,1)],
        },
        "size": list(img.size),
    }

def build():
    files = sorted(IMAGES_DIR.iterdir())
    files = [f for f in files if f.suffix.lower() in (".jpg",".jpeg",".png")]

    # load existing index to allow resuming
    existing = {}
    if INDEX_PATH.exists():
        try:
            existing = {e["file"]: e for e in json.loads(INDEX_PATH.read_text())}
        except Exception:
            pass

    index = []
    for i, path in enumerate(files):
        if path.name in existing:
            index.append(existing[path.name])
            print(f"  [{i+1:3d}/{len(files)}] {path.name:25s}  (cached)")
            continue
        try:
            entry = analyze_image(path)
            index.append(entry)
            print(f"  [{i+1:3d}/{len(files)}] {path.name:25s}  {entry['style_tag']:20s}  {entry['mood']:10s}  {entry['asset_type']}")
        except Exception as e:
            print(f"  [{i+1:3d}/{len(files)}] {path.name:25s}  ERROR: {e}", file=sys.stderr)

    INDEX_PATH.write_text(json.dumps(index, indent=2))

    # print summary
    from collections import Counter
    styles = Counter(e["style_tag"] for e in index)
    types  = Counter(e["asset_type"] for e in index)
    print(f"\n✓ Indexed {len(index)} images → {INDEX_PATH}")
    print("  Style distribution:")
    for s, c in styles.most_common():
        print(f"    {s:25s}  {c}")
    print("  Asset types:", dict(types))

if __name__ == "__main__":
    np.random.seed(42)
    build()
