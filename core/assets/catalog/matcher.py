"""
Asset Matcher — fast keyword/semantic lookup against the catalog index.
Works with both the local (build_catalog_local.py) and API schemas.
No API calls — pure in-memory index from index.json.
"""
import json, re, math
from pathlib import Path
from functools import lru_cache

HERE      = Path(__file__).parent
INDEX     = HERE / "index.json"
REPO_ROOT = Path(__file__).parents[2]   # opusflow/

@lru_cache(maxsize=1)
def _load() -> list:
    if not INDEX.exists():
        return []
    return json.loads(INDEX.read_text())

def _score(entry: dict, query_tokens: set) -> float:
    """
    TF-style overlap score. Works against both local and API schemas by
    reading all string/list fields that carry semantic meaning.
    """
    text_parts = []
    for key in ("description", "style_tag", "mood", "categories",
                # API schema fields (kept for back-compat)
                "subject", "category", "tags", "topics", "use_cases",
                "style_name", "style_family", "key_visual_elements",
                "animation_hints", "layout_pattern"):
        v = entry.get(key, "")
        if isinstance(v, list):
            text_parts.extend(str(x) for x in v)
        elif v:
            text_parts.append(str(v))

    all_text   = " ".join(text_parts).lower()
    all_tokens = set(re.findall(r"\w+", all_text))
    hits       = len(query_tokens & all_tokens)
    if not hits:
        return 0.0
    return hits / math.sqrt(max(len(query_tokens), 1) * max(len(all_tokens), 1))

def _is_prop(entry: dict) -> bool:
    # local schema uses 'asset_type'; API schema uses 'type'
    at = entry.get("asset_type", entry.get("type", "")).upper()
    return at == "PROP" or "prop" in entry.get("categories", [])

def _is_style(entry: dict) -> bool:
    at = entry.get("asset_type", entry.get("type", "")).upper()
    return at == "STYLE" or "style" in entry.get("categories", [])

# ── public API ────────────────────────────────────────────────────────────────

def find_props(scene_description: str, n: int = 3,
               categories: list = None, moods: list = None) -> list:
    """
    Best-matching PROP (cutout / numbered) assets for a scene.
    Returns list of dicts with 'file', 'path', 'score', and all entry fields.
    """
    catalog = _load()
    tokens  = set(re.findall(r"\w+", scene_description.lower()))
    results = []

    for entry in catalog:
        if not _is_prop(entry):
            continue
        if categories:
            entry_cats = entry.get("categories", [])
            if not any(c in entry_cats for c in categories):
                continue
        if moods:
            em = entry.get("mood", entry.get("features", {}).get("mood", ""))
            if em not in moods:
                continue
        sc = _score(entry, tokens)
        # all props get a minimum score so we always return something
        results.append({**entry, "score": sc if sc > 0 else 0.001})

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:n]

def find_styles(scene_description: str, n: int = 3,
                family: list = None) -> list:
    """
    Best-matching STYLE reference images for a scene.
    'family' filters by style_tag (e.g. ['DARK_COLLAGE','EDITORIAL_CREAM']).
    """
    catalog = _load()
    tokens  = set(re.findall(r"\w+", scene_description.lower()))
    results = []

    for entry in catalog:
        if not _is_style(entry):
            continue
        if family:
            st = entry.get("style_tag", entry.get("style_family", ""))
            if st not in family:
                continue
        sc = _score(entry, tokens)
        results.append({**entry, "score": sc if sc > 0 else 0.001})

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:n]

def find_by_style_tag(style_tag: str, mood: str = None, n: int = 5) -> list:
    """Find STYLE entries that match a specific style_tag (from STYLE_DNA)."""
    catalog = _load()
    results = [
        e for e in catalog
        if _is_style(e) and e.get("style_tag") == style_tag
        and (mood is None or e.get("mood") == mood)
    ]
    return results[:n]

def get_palette_for_style(style_tag: str, mood: str = None) -> list[str]:
    """Return a real dominant palette from a training image matching the style."""
    matches = find_by_style_tag(style_tag, mood, n=20)
    if not matches:
        return ["#F5EFE0", "#1A1A1A", "#E05C2A", "#D4A853", "#FBF7EE"]
    import random
    entry = random.choice(matches)
    return entry.get("palette", [])[:5]

def prop_path(entry: dict) -> str:
    """Absolute filesystem path to a prop/style image."""
    p = entry.get("path", "")
    if p:
        return str(REPO_ROOT / p)
    return str(HERE / "images" / entry["file"])

def all_props() -> list:
    return [e for e in _load() if _is_prop(e)]

def all_styles() -> list:
    return [e for e in _load() if _is_style(e)]

def stats() -> dict:
    catalog = _load()
    from collections import Counter
    style_dist = Counter(e.get("style_tag", "?") for e in catalog)
    return {
        "total":        len(catalog),
        "props":        sum(1 for e in catalog if _is_prop(e)),
        "styles":       sum(1 for e in catalog if _is_style(e)),
        "style_dist":   dict(style_dist),
    }

# ── CLI ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    q = " ".join(sys.argv[1:]) or "technology data charts"
    print(f"Query: {q!r}\n")
    print("--- PROPS ---")
    for p in find_props(q, n=5):
        print(f"  {p['file']:25s}  style={p.get('style_tag','?'):22s}  mood={p.get('mood','?'):10s}  score={p['score']:.3f}")
    print("\n--- STYLES ---")
    for s in find_styles(q, n=5):
        print(f"  {s['file']:25s}  style={s.get('style_tag','?'):22s}  mood={s.get('mood','?'):10s}  score={s['score']:.3f}")
    print(f"\nCatalog stats:")
    for k, v in stats().items():
        print(f"  {k}: {v}")
