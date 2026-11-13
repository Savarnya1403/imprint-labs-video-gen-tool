"""
Asset Matcher — fast keyword/semantic lookup against the catalog.
Used by director.py and scripter.py at scene-build time.
No API calls — pure in-memory index built from index.json.
"""
import json, re, math
from pathlib import Path
from functools import lru_cache

HERE    = Path(__file__).parent
INDEX   = HERE / "index.json"
REPO_ROOT = Path(__file__).parents[3]  # opusflow/

@lru_cache(maxsize=1)
def _load() -> list:
    if not INDEX.exists():
        return []
    return json.loads(INDEX.read_text())

def _score(entry: dict, query_tokens: set) -> float:
    """Simple TF-style overlap score over all text fields."""
    text_fields = []
    for key in ("subject","category","tags","topics","use_cases",
                "style_name","style_family","key_visual_elements",
                "animation_hints","mood","layout_pattern"):
        v = entry.get(key, "")
        if isinstance(v, list):
            text_fields.extend(v)
        elif v:
            text_fields.append(str(v))
    all_text = " ".join(text_fields).lower()
    all_tokens = set(re.findall(r"\w+", all_text))
    hits = len(query_tokens & all_tokens)
    if not hits:
        return 0.0
    return hits / math.sqrt(len(query_tokens) * max(len(all_tokens), 1))

def find_props(scene_description: str, n: int = 3,
               categories: list = None, moods: list = None) -> list:
    """
    Find the best-matching prop assets for a scene.
    Returns list of dicts with keys: file, path, subject, tags, score
    """
    catalog = _load()
    tokens  = set(re.findall(r"\w+", scene_description.lower()))
    results = []
    for entry in catalog:
        if entry.get("type") != "prop":
            continue
        if "error" in entry:
            continue
        if categories and entry.get("category") not in categories:
            continue
        if moods and entry.get("mood") not in moods:
            continue
        sc = _score(entry, tokens)
        if sc > 0:
            results.append({**entry, "score": sc})
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:n]

def find_styles(scene_description: str, n: int = 3,
                family: list = None) -> list:
    """
    Find best-matching style reference frames for a scene type.
    Returns list of style entries with canvas_code_notes and animation_hints.
    """
    catalog = _load()
    tokens  = set(re.findall(r"\w+", scene_description.lower()))
    results = []
    for entry in catalog:
        if entry.get("type") != "style":
            continue
        if "error" in entry:
            continue
        if family and entry.get("style_family") not in family:
            continue
        sc = _score(entry, tokens)
        if sc > 0:
            results.append({**entry, "score": sc})
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:n]

def prop_path(entry: dict) -> str:
    """Absolute filesystem path to a prop image."""
    return str(REPO_ROOT / entry["path"])

def all_props() -> list:
    return [e for e in _load() if e.get("type") == "prop" and "error" not in e]

def all_styles() -> list:
    return [e for e in _load() if e.get("type") == "style" and "error" not in e]

def stats() -> dict:
    catalog = _load()
    return {
        "total": len(catalog),
        "props":  sum(1 for e in catalog if e.get("type") == "prop"),
        "styles": sum(1 for e in catalog if e.get("type") == "style"),
        "errors": sum(1 for e in catalog if "error" in e),
    }

if __name__ == "__main__":
    import sys
    q = " ".join(sys.argv[1:]) or "technology data politics"
    print(f"Query: {q!r}\n")
    print("--- PROPS ---")
    for p in find_props(q, n=5):
        print(f"  {p['file']:20s} [{p.get('category','?'):12s}] {p.get('subject','')[:60]}  score={p['score']:.3f}")
    print("\n--- STYLES ---")
    for s in find_styles(q, n=5):
        print(f"  {s['file']:20s} [{s.get('style_family','?'):14s}] {s.get('style_name','')[:50]}  score={s['score']:.3f}")
    print(f"\nCatalog stats: {stats()}")
