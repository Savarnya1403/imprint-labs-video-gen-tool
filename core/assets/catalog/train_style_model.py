"""
Style Model Trainer — no API, no cloud, no login.

What this builds:
  For each of the 6 style clusters (EDITORIAL_CREAM, BOLD_TYPOGRAPHIC, etc.):

  1. SPATIAL MAP (8×8 grid) — where each color family lives on a typical editorial canvas.
     Trained from 286 images by: resize each to 8×8, k-means per cell, average across cluster.
     Used by: blob_painter.js to know WHERE to place each color blob.

  2. COLOR HISTOGRAM (32 bins × 3 channels) — the probability distribution of colors.
     Used by: blob_painter.js as the error target. Painting error → 0 means histogram matches.

  3. PCA COMPONENTS (top 12) — eigenfeatures in 32×32 pixel space.
     Used by: measuring how "inside" the style distribution a canvas is.
     Inspiration: eigenfaces (TomusD/ML-Face-Recognition-Gradient-Descent-and-Eigenfaces)

  4. PALETTE SAMPLES — top 10 actual 5-color palettes from training images.
     Used by: sampling realistic colors when painting blobs.

  5. BLOB TEMPLATES — per-style blob recipes (position, size, color, opacity distributions).
     Used by: blob_painter.js to know what kind of blobs to try at each step.

Output: core/assets/catalog/style_model.json

The gradient-descent / error-minimization approach at runtime:
  - Canvas starts as noise (or flat bg color)
  - Each step: try a blob (sample from templates), measure histogram error change
  - Accept if error ↓, reject if error ↑  (hill-climbing = SGD without gradients)
  - After ~60 steps the error approaches near-zero (matches training distribution)
  Ref: "skiing downhill blindfolded" (HuggingFace blog) = zeroth-order optimization
"""

import json, sys
from pathlib import Path
from collections import defaultdict

import numpy as np
from PIL import Image
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans

CATALOG_DIR = Path(__file__).parent
INDEX_PATH  = CATALOG_DIR / "index.json"
OUT_PATH    = CATALOG_DIR / "style_model.json"
IMAGES_DIR  = CATALOG_DIR / "images"

SPATIAL_SIZE = 8     # spatial map resolution (8×8 = 64 regions)
HIST_BINS    = 32    # color histogram bins per channel
THUMB_SIZE   = 32    # PCA image size (32×32 = 1024 dims)
N_COMPONENTS = 12    # PCA components per style
PALETTE_K    = 6     # colors per palette


# ── image helpers ──────────────────────────────────────────────────────────────

def load_rgb(path, size) -> np.ndarray:
    img = Image.open(path).convert("RGB").resize(size, Image.LANCZOS)
    return np.array(img, dtype=np.float32)

def build_spatial_map(images: list[np.ndarray]) -> list:
    """
    8×8 spatial map: for each cell, the mean dominant color across all training images.
    Returns 64 hex colors as a flat list (row-major).
    """
    H, W = SPATIAL_SIZE, SPATIAL_SIZE
    # resized to (H, W, 3) → average over all images
    resized = np.array([
        np.array(Image.fromarray(img.astype(np.uint8)).resize((W, H), Image.LANCZOS), dtype=float)
        for img in images
    ])  # (N, H, W, 3)
    mean_map = resized.mean(axis=0)  # (H, W, 3)

    result = []
    for gy in range(H):
        for gx in range(W):
            r, g, b = mean_map[gy, gx]
            result.append("#{:02x}{:02x}{:02x}".format(int(r), int(g), int(b)))
    return result  # 64 hex colors

def build_histogram(images: list[np.ndarray]) -> dict:
    """Per-channel 32-bin histogram averaged across all training images."""
    r_all, g_all, b_all = [], [], []
    for img in images:
        px = img.reshape(-1, 3)
        r_all.append(px[:, 0])
        g_all.append(px[:, 1])
        b_all.append(px[:, 2])
    r_px = np.concatenate(r_all)
    g_px = np.concatenate(g_all)
    b_px = np.concatenate(b_all)
    rh, _ = np.histogram(r_px, bins=HIST_BINS, range=(0, 256), density=True)
    gh, _ = np.histogram(g_px, bins=HIST_BINS, range=(0, 256), density=True)
    bh, _ = np.histogram(b_px, bins=HIST_BINS, range=(0, 256), density=True)
    # normalize to sum=1
    rh = (rh / rh.sum()).tolist()
    gh = (gh / gh.sum()).tolist()
    bh = (bh / bh.sum()).tolist()
    return {"r": rh, "g": gh, "b": bh}

def build_pca_components(images: list[np.ndarray]) -> dict:
    """
    PCA on (THUMB_SIZE × THUMB_SIZE) flattened images.
    Returns mean vector + top N_COMPONENTS eigenvectors + explained_variance.
    Identical approach to eigenfaces (TomusD/ML-Face-Recognition).
    """
    # resize all to THUMB_SIZE × THUMB_SIZE
    vectors = []
    for img in images:
        pil = Image.fromarray(img.astype(np.uint8)).resize(
            (THUMB_SIZE, THUMB_SIZE), Image.LANCZOS)
        vectors.append(np.array(pil, dtype=float).flatten())
    vectors = np.array(vectors)  # (N, THUMB_SIZE*THUMB_SIZE*3)

    if len(vectors) < 2:
        return {"mean": [], "components": [], "variance": []}

    n_comp = min(N_COMPONENTS, len(vectors) - 1)
    pca = PCA(n_components=n_comp, random_state=42)
    pca.fit(vectors)

    return {
        "mean":       pca.mean_.tolist(),
        "components": [c.tolist() for c in pca.components_],
        "variance":   pca.explained_variance_ratio_.tolist(),
        "shape":      [THUMB_SIZE, THUMB_SIZE, 3],
    }

def build_palette_samples(catalog_entries: list) -> list:
    """
    Top 10 actual palettes from training images for this style.
    Each palette: 5 hex colors.
    """
    palettes = [e.get("palette", [])[:5] for e in catalog_entries if e.get("palette")]
    # deduplicate roughly (by first color)
    seen = set()
    result = []
    for p in palettes:
        key = p[0] if p else ""
        if key not in seen:
            seen.add(key)
            result.append(p)
        if len(result) >= 10:
            break
    return result

def build_blob_templates(images: list[np.ndarray], spatial_map: list) -> list:
    """
    Per-style blob placement recipes:
    For each of 6 canonical blob "roles" (background, fill, accent, shadow, detail, noise),
    compute: typical position (cx_frac, cy_frac), size_frac, color (hex), opacity.

    Derived from spatial map statistics — the 6 most distinct spatial clusters.
    """
    # rebuild 8×8 spatial grid as (64, 3) float array
    grid_colors = []
    for hex_color in spatial_map:
        r = int(hex_color[1:3], 16)
        g = int(hex_color[3:5], 16)
        b = int(hex_color[5:7], 16)
        grid_colors.append([r, g, b])
    grid_colors = np.array(grid_colors, dtype=float)

    # k-means on (cell_position + color) to find dominant "regions"
    H, W = SPATIAL_SIZE, SPATIAL_SIZE
    features = []
    for idx, color in enumerate(grid_colors):
        gx = (idx % W) / W   # normalize to [0, 1]
        gy = (idx // W) / H
        features.append([gx * 0.5, gy * 0.5, color[0]/255, color[1]/255, color[2]/255])
    features = np.array(features)

    n_blobs = min(6, len(features))
    km = KMeans(n_clusters=n_blobs, n_init=5, random_state=42).fit(features)

    templates = []
    role_names = ["background", "fill", "accent", "shadow", "detail", "noise"]
    # sort by cy (top to bottom in canvas order)
    centers = sorted(enumerate(km.cluster_centers_), key=lambda x: x[1][1])
    for i, (_, c) in enumerate(centers):
        cx_frac = float(c[0] / 0.5)   # un-normalize
        cy_frac = float(c[1] / 0.5)
        r = int(c[2] * 255)
        g = int(c[3] * 255)
        b = int(c[4] * 255)
        color = "#{:02x}{:02x}{:02x}".format(r, g, b)
        # size is larger near the center, smaller near edges
        dist_from_center = abs(cx_frac - 0.5) + abs(cy_frac - 0.5)
        size_frac = max(0.08, 0.35 - dist_from_center * 0.15)
        opacity = 0.9 if i == 0 else (0.7 - i * 0.08)
        templates.append({
            "role":      role_names[i % len(role_names)],
            "cx_frac":   round(cx_frac, 3),
            "cy_frac":   round(cy_frac, 3),
            "size_frac": round(size_frac, 3),
            "color":     color,
            "opacity":   round(max(0.1, opacity), 2),
            "randomness": 0.3 + i * 0.1,  # more organic as we go deeper
        })
    return templates

def compute_mean_rgb(images: list[np.ndarray]) -> list:
    all_pxl = np.concatenate([img.reshape(-1, 3) for img in images])
    return [round(float(all_pxl[:, i].mean()), 1) for i in range(3)]

def brightness_range(images: list[np.ndarray]) -> dict:
    brightnesses = [img.reshape(-1, 3).mean() for img in images]
    return {"min": round(float(np.min(brightnesses)), 1),
            "max": round(float(np.max(brightnesses)), 1),
            "mean": round(float(np.mean(brightnesses)), 1)}


# ── main ───────────────────────────────────────────────────────────────────────

def train():
    print("Loading catalog index...")
    index = json.loads(INDEX_PATH.read_text())

    # group by style_tag
    by_style: dict[str, list] = defaultdict(list)
    for entry in index:
        by_style[entry.get("style_tag", "EDITORIAL_CREAM")].append(entry)

    model = {}

    for style_tag, entries in sorted(by_style.items(), key=lambda x: -len(x[1])):
        print(f"\n{'─'*60}")
        print(f"Training: {style_tag}  ({len(entries)} images)")

        # load images for this style
        images = []
        for e in entries:
            path = IMAGES_DIR / e["file"]
            if not path.exists():
                continue
            try:
                img = load_rgb(path, (128, 128))
                images.append(img)
            except Exception as ex:
                print(f"  skip {e['file']}: {ex}")

        if not images:
            print(f"  No images loaded, skipping.")
            continue

        print(f"  Loaded {len(images)} images")

        print("  → Building spatial map (8×8)...")
        spatial_map = build_spatial_map(images)

        print("  → Building color histogram...")
        histogram = build_histogram(images)

        print(f"  → Running PCA ({N_COMPONENTS} components, {THUMB_SIZE}×{THUMB_SIZE})...")
        pca_data = build_pca_components(images)

        print("  → Sampling palette library...")
        palette_samples = build_palette_samples(entries)

        print("  → Building blob templates...")
        blob_templates = build_blob_templates(images, spatial_map)

        mean_rgb = compute_mean_rgb(images)
        brange   = brightness_range(images)

        model[style_tag] = {
            "n_training_images": len(images),
            "mean_rgb":          mean_rgb,
            "brightness_range":  brange,
            "spatial_map":       spatial_map,
            "histogram":         histogram,
            "pca":               pca_data,
            "palette_samples":   palette_samples,
            "blob_templates":    blob_templates,
        }
        print(f"  ✓ {style_tag}  mean_rgb={mean_rgb}")

    # write model
    OUT_PATH.write_text(json.dumps(model, indent=2))
    total_imgs = sum(m["n_training_images"] for m in model.values())
    print(f"\n{'═'*60}")
    print(f"✓ Trained on {total_imgs} images → {OUT_PATH}")
    print(f"  Style clusters: {len(model)}")
    for style, m in sorted(model.items(), key=lambda x: -x[1]['n_training_images']):
        var = sum(m['pca']['variance'][:3]) * 100 if m['pca']['variance'] else 0
        print(f"  {style:25s}  images={m['n_training_images']:3d}  "
              f"PCA top-3 variance={var:.1f}%  blobs={len(m['blob_templates'])}")

if __name__ == "__main__":
    np.random.seed(42)
    train()
