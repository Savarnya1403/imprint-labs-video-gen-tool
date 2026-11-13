"""
Smart Scene Splitter — prevents scenes from getting "stuck" on one visual.

Rules (absorbed from vox-animated-ad-mcp analysis):
  - Any VO segment > 8s is too long for one static visual → auto-split
  - Splits must align with natural sentence boundaries in the VO
  - Each sub-scene gets a distinct visual continuation from the SCENE_CONTINUATION_TYPES
  - The first sub-scene carries the main visual; subsequent ones evolve it

Also provides the VO word-timing parser (from htlin222/vox-styled-reels analysis):
  - Edge TTS word-boundary metadata drives karaoke-style word highlighting
  - Words per second: typical 2.3 at normal rate, 2.0 at -5% speed
"""
import re
import math
from typing import List, Dict, Any

MAX_SCENE_DURATION = 8.5   # seconds — anything longer gets split
TARGET_SPLIT_DUR   = 6.0   # aim for this per sub-scene
WORDS_PER_SEC      = 2.1   # Andrew Neural @ -5% rate

# Visual continuations that work for each scene when audio is still playing
SCENE_CONTINUATION_TYPES = [
    "stat-pull",           # pull out a data point mentioned in the VO as a big number card
    "annotation-appear",   # hand-drawn annotation pointing at a visual element
    "subtext-reveal",      # additional context text reveals typewriter-style
    "prop-enter",          # a matching prop asset slides in from the side
    "highlight-word",      # red highlight marker under a key phrase
    "counter-tick",        # a number counts up reinforcing what's being said
    "sticky-note-pop",     # sticky note pops in with a supporting fact
    "comparison-split",    # screen splits to show before/after
    "quote-fragment",      # a pullquote fragment appears
    "line-draw-diagram",   # a simple line diagram draws itself
]

SENTENCE_ENDINGS = re.compile(r'(?<=[.!?—])\s+')
CLAUSE_BOUNDARIES = re.compile(r'(?<=,)\s+|(?<=;)\s+|(?<= —)\s+| and | but | so | then | because | while ')


def split_scene(scene: Dict[str, Any], vo_duration: float) -> List[Dict[str, Any]]:
    """
    Split a scene whose VO is too long into sub-scenes.
    Returns list of scene dicts with updated vo_text, visual_type, duration_hint.
    """
    if vo_duration <= MAX_SCENE_DURATION:
        return [scene]  # no split needed

    vo_text = scene.get("vo", "")
    if not vo_text:
        return [scene]

    # split at sentence boundaries first
    sentences = SENTENCE_ENDINGS.split(vo_text.strip())
    if len(sentences) <= 1:
        # no sentence breaks → split at clause boundaries
        sentences = re.split(CLAUSE_BOUNDARIES, vo_text.strip())

    if len(sentences) <= 1:
        # still can't split cleanly — force a word-count split
        words = vo_text.split()
        mid   = len(words) // 2
        sentences = [" ".join(words[:mid]), " ".join(words[mid:])]

    # group sentences into chunks targeting TARGET_SPLIT_DUR
    chunks  = []
    current = []
    cur_dur = 0.0

    for sent in sentences:
        sent = sent.strip()
        if not sent:
            continue
        sent_dur = len(sent.split()) / WORDS_PER_SEC
        if cur_dur + sent_dur > TARGET_SPLIT_DUR and current:
            chunks.append(" ".join(current))
            current = [sent]
            cur_dur = sent_dur
        else:
            current.append(sent)
            cur_dur += sent_dur

    if current:
        chunks.append(" ".join(current))

    if len(chunks) <= 1:
        return [scene]

    # build sub-scenes
    sub_scenes = []
    continuations = _pick_continuations(scene.get("visual_type", "text-slam"), len(chunks))

    for i, chunk in enumerate(chunks):
        chunk_dur = len(chunk.split()) / WORDS_PER_SEC
        is_first  = (i == 0)

        sub = {
            **scene,
            "id": f"{scene.get('id','S')}_{chr(97+i)}",   # S1_a, S1_b, ...
            "vo": chunk,
            "duration_hint": round(chunk_dur + 0.4, 1),
            "is_continuation": not is_first,
            "parent_scene_id": scene.get("id", "S"),
        }

        if not is_first:
            # override visual for continuation
            sub["visual_type"] = continuations[i]
            sub["continuation_hint"] = _continuation_hint(chunk, continuations[i])
            sub.pop("data", None)  # don't repeat a data card in continuations

        sub_scenes.append(sub)

    return sub_scenes


def _pick_continuations(parent_type: str, n_parts: int) -> List[str]:
    """Pick visual continuation types that are different from the parent and each other."""
    avoid = {parent_type}
    # prefer these for most cases
    priority = ["annotation-appear", "stat-pull", "highlight-word",
                "subtext-reveal", "prop-enter", "sticky-note-pop",
                "counter-tick", "line-draw-diagram", "comparison-split"]
    result = [parent_type]  # first part keeps parent type
    for ctype in priority:
        if ctype not in avoid:
            result.append(ctype)
            avoid.add(ctype)
        if len(result) >= n_parts:
            break
    # fill remaining with cycling
    for c in SCENE_CONTINUATION_TYPES:
        if len(result) >= n_parts:
            break
        if c not in avoid:
            result.append(c)
    return result[:n_parts]


def _continuation_hint(vo_text: str, cont_type: str) -> str:
    """Generate a brief visual instruction for the continuation type."""
    hints = {
        "stat-pull":        f"Pull out the key number/stat mentioned in: '{vo_text[:60]}...'",
        "annotation-appear": f"Hand-drawn arrow annotation pointing to main visual element",
        "subtext-reveal":   f"Typewriter reveal of supporting context for: '{vo_text[:40]}...'",
        "prop-enter":       f"Slide in a thematically matching prop asset from the catalog",
        "highlight-word":   f"Marker highlight under the most impactful word in the VO",
        "counter-tick":     f"Count up a number implied by the narration",
        "sticky-note-pop":  f"Pop in a sticky note with 1-3 word summary of the point",
        "comparison-split": f"Split screen showing contrast mentioned in the VO",
        "quote-fragment":   f"Fragment of the VO pulled out as a large pull-quote",
        "line-draw-diagram": f"Simple diagram or arrow drawing illustrating the concept",
    }
    return hints.get(cont_type, "Visual continuation of the scene")


def process_script_scenes(scenes: List[Dict]) -> List[Dict]:
    """
    Takes a full script's scene list and applies smart splitting to all long scenes.
    Returns a flattened list with all sub-scenes included.
    """
    result = []
    for scene in scenes:
        vo = scene.get("vo", "")
        vo_dur = scene.get("duration_hint") or (len(vo.split()) / WORDS_PER_SEC)
        split = split_scene(scene, vo_dur)
        result.extend(split)
    return result


# ── word-timing parser (from htlin222 analysis) ───────────────────────────
def estimate_word_timings(vo_text: str, total_dur: float) -> List[Dict]:
    """
    Estimate word-level timings for karaoke/highlight effects.
    Returns list of {word, start_sec, end_sec}.
    Uses uniform distribution with brief pauses at punctuation.
    """
    words   = vo_text.split()
    if not words:
        return []

    # assign weights: punctuation-ending words get a 1.4× weight (pause)
    weights = []
    for w in words:
        w_clean = w.rstrip('.,;:!?—')
        pause = 1.4 if w.endswith(('.','!','?','—')) else 1.1 if w.endswith(',') else 1.0
        weights.append(len(w_clean) / 5.0 + pause * 0.3)

    total_w = sum(weights) or 1.0
    timings = []
    t = 0.0
    for i, (word, weight) in enumerate(zip(words, weights)):
        dur = (weight / total_w) * total_dur
        timings.append({"word": word, "start_sec": round(t, 3), "end_sec": round(t + dur, 3)})
        t += dur

    return timings


if __name__ == "__main__":
    # demo
    test_scene = {
        "id": "S2",
        "vo": "That's not you being picky. That's your brain hitting a wall. The average person spends fourteen minutes searching — and one in five gives up and does something else entirely. This is a behavioural phenomenon documented in Netflix's own internal data.",
        "visual_type": "stat-reveal",
    }
    dur = len(test_scene["vo"].split()) / WORDS_PER_SEC
    print(f"Original VO duration: {dur:.1f}s")
    subs = split_scene(test_scene, dur)
    print(f"Split into {len(subs)} sub-scenes:")
    for s in subs:
        d = len(s["vo"].split()) / WORDS_PER_SEC
        print(f"  [{s['id']}] {d:.1f}s — {s['visual_type']} — {s['vo'][:60]}...")
        if s.get("continuation_hint"):
            print(f"         → {s['continuation_hint']}")
