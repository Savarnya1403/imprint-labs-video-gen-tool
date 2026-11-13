"""
Image processor: crop, color-grade, overlay, extract palette.
Applies Pinterest-aesthetic treatment: clean whites, muted darks, punchy accent.
"""
import os, json, sys
from pathlib import Path
from typing import Optional
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw, ImageOps
import colorsys


# ── Color Grading Presets ──────────────────────────────────────────────────────
GRADES = {
    "vox":       dict(sat=0.85, contrast=1.10, brightness=0.98, warm=8),
    "editorial": dict(sat=0.70, contrast=1.20, brightness=0.95, warm=4),
    "dark":      dict(sat=0.65, contrast=1.35, brightness=0.80, warm=-4),
    "warm":      dict(sat=1.05, contrast=1.08, brightness=1.02, warm=18),
    "cool":      dict(sat=0.80, contrast=1.12, brightness=0.97, warm=-10),
    "neutral":   dict(sat=1.00, contrast=1.00, brightness=1.00, warm=0),
}


def _apply_grade(img: Image.Image, grade: str = "vox") -> Image.Image:
    g = GRADES.get(grade, GRADES["vox"])
    img = img.convert("RGB")
    img = ImageEnhance.Color(img).enhance(g["sat"])
    img = ImageEnhance.Contrast(img).enhance(g["contrast"])
    img = ImageEnhance.Brightness(img).enhance(g["brightness"])
    # warm/cool tint
    if g["warm"] != 0:
        r, gr, b = img.split()
        w = g["warm"]
        if w > 0:
            r = r.point(lambda x: min(255, x + w))
            b = b.point(lambda x: max(0, x - w // 2))
        else:
            b = b.point(lambda x: min(255, x - w))
            r = r.point(lambda x: max(0, x + w // 2))
        img = Image.merge("RGB", (r, gr, b))
    return img


def _smart_crop(img: Image.Image, w: int, h: int) -> Image.Image:
    """Center-bias smart crop maintaining aspect"""
    iw, ih = img.size
    target_ar = w / h
    source_ar = iw / ih

    if source_ar > target_ar:
        # source wider → crop sides, keep center
        new_w = int(ih * target_ar)
        x0 = (iw - new_w) // 2
        img = img.crop((x0, 0, x0 + new_w, ih))
    else:
        # source taller → crop top/bottom, keep upper-center
        new_h = int(iw / target_ar)
        y0 = max(0, (ih - new_h) // 3)  # upper third bias
        img = img.crop((0, y0, iw, y0 + new_h))

    return img.resize((w, h), Image.LANCZOS)


def _torn_mask(w: int, h: int, side: str = "bottom",
               amp: int = 18, seed: int = 42) -> Image.Image:
    """Create a torn-paper alpha mask for one side of an image"""
    import random
    rng = random.Random(seed)
    mask = Image.new("L", (w, h), 255)
    draw = ImageDraw.Draw(mask)

    pts = []
    steps = 48
    if side == "bottom":
        for i in range(steps + 1):
            x = int(i / steps * w)
            y = h - int(amp * (0.5 + rng.random()))
            pts.append((x, y))
        pts.append((w, h))
        pts.append((0, h))
        draw.polygon(pts, fill=0)
    elif side == "top":
        for i in range(steps + 1):
            x = int(i / steps * w)
            y = int(amp * (0.5 + rng.random()))
            pts.append((x, y))
        pts = [(w, 0), (0, 0)] + pts
        draw.polygon(pts, fill=0)
    elif side == "left":
        for i in range(steps + 1):
            y = int(i / steps * h)
            x = int(amp * (0.5 + rng.random()))
            pts.append((x, y))
        pts = [(0, h), (0, 0)] + pts
        draw.polygon(pts, fill=0)
    elif side == "right":
        for i in range(steps + 1):
            y = int(i / steps * h)
            x = w - int(amp * (0.5 + rng.random()))
            pts.append((x, y))
        pts.append((w, h))
        pts.append((w, 0))
        draw.polygon(pts, fill=0)

    return mask.filter(ImageFilter.GaussianBlur(1.5))


def process_for_canvas(src_path: str, out_path: str,
                       w: int = 800, h: int = 600,
                       grade: str = "vox",
                       torn_sides: Optional[list[str]] = None,
                       seed: int = 42) -> str:
    """
    Full image processing pipeline: crop → grade → torn edges → save PNG.
    torn_sides: list of sides to apply torn mask ["bottom", "top", "left", "right"]
    Returns: out_path
    """
    img = Image.open(src_path).convert("RGBA")
    img = _smart_crop(img.convert("RGB"), w, h).convert("RGBA")
    img = _apply_grade(img.convert("RGB"), grade).convert("RGBA")

    if torn_sides:
        combined_mask = Image.new("L", (w, h), 255)
        for side in torn_sides:
            torn = _torn_mask(w, h, side, seed=seed + hash(side) % 100)
            combined_mask = Image.fromarray(
                __import__("numpy").minimum(
                    __import__("numpy").array(combined_mask),
                    __import__("numpy").array(torn)
                )
            )
        r, g, b, a = img.split()
        new_a = Image.fromarray(
            __import__("numpy").minimum(
                __import__("numpy").array(a),
                __import__("numpy").array(combined_mask)
            )
        )
        img = Image.merge("RGBA", (r, g, b, new_a))

    img.save(out_path, "PNG", optimize=True)
    return out_path


def extract_palette(img_path: str, n: int = 6) -> list[str]:
    """
    Extract n dominant colors as hex strings.
    Returns them sorted from lightest to darkest.
    """
    from colorthief import ColorThief
    ct = ColorThief(img_path)
    if n == 1:
        rgb = ct.get_color(quality=1)
        return [f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"]
    palette = ct.get_palette(color_count=n, quality=1)
    # Sort by perceived lightness
    def lightness(rgb):
        r, g, b = [x / 255 for x in rgb]
        h, l, s = colorsys.rgb_to_hls(r, g, b)
        return l
    palette.sort(key=lightness, reverse=True)
    return [f"#{r:02x}{g:02x}{b:02x}" for r, g, b in palette]


def batch_process(manifest: list[dict], out_dir: str,
                  spec: dict) -> list[dict]:
    """
    Process a full image manifest with per-image spec overrides.
    spec: {"w": 800, "h": 600, "grade": "vox", "torn_sides": ["bottom"]}
    Returns updated manifest with "processed_path" and "palette" fields.
    """
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    result = []

    for i, item in enumerate(manifest):
        src = item["path"]
        name = Path(src).stem
        out_path = str(out / f"{name}_proc.png")

        try:
            process_for_canvas(
                src_path=src,
                out_path=out_path,
                w=spec.get("w", 800),
                h=spec.get("h", 600),
                grade=spec.get("grade", "vox"),
                torn_sides=spec.get("torn_sides"),
                seed=i * 7 + 13,
            )
            palette = extract_palette(src, n=4)
            item = {**item, "processed_path": out_path, "palette": palette}
            print(f"  [process] ✓ {name}_proc.png  palette: {palette}", file=sys.stderr)
        except Exception as e:
            print(f"  [process] ✗ {name}: {e}", file=sys.stderr)
            item = {**item, "processed_path": src, "palette": ["#F1E6D0", "#14213D"]}

        result.append(item)

    return result
