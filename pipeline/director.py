#!/usr/bin/env python3
"""
OpusFlow Director — end-to-end film pipeline.

Usage:
  python pipeline/director.py --topic "Spotify Wrapped" --style vox-pro --duration 45
  python pipeline/director.py --topic "OpenAI's $157B valuation" --style vox-data
  python pipeline/director.py --topic "Why Indian roads kill 150,000 a year" --style vox-dark

The director:
  1. Researches the topic (Wikipedia + search)
  2. Writes a data-backed script (Claude API)
  3. Plans visual scenes
  4. Fetches real images
  5. Generates VO audio (edge-tts)
  6. Measures timing
  7. Generates film code (main.js, mix.py, build.sh)
  8. Runs the render pipeline
"""

import os, sys, json, math, asyncio, re, shutil, subprocess, argparse
from pathlib import Path
from datetime import datetime

HERE = Path(__file__).parent.parent  # opusflow root
sys.path.insert(0, str(HERE))

from pipeline.researcher  import research
from pipeline.scripter    import write_script
from core.assets.fetch_images   import ImageFetcher
from core.assets.process_images import batch_process


# ── Configuration ─────────────────────────────────────────────────────────────
STYLES    = ["vox-pro", "vox-data", "vox-dark"]
FPS       = 30
VENV_PY   = str(HERE / ".venv/bin/python")
EDGE_TTS_VOICE = "en-US-AndrewNeural"


# ── Slug generation ───────────────────────────────────────────────────────────
def slugify(text: str) -> str:
    s = re.sub(r'[^a-z0-9]+', '-', text.lower())
    return s.strip('-')[:40]


# ── TTS generation ────────────────────────────────────────────────────────────
async def gen_vo(text: str, out_path: str, voice: str = EDGE_TTS_VOICE):
    import edge_tts
    for attempt in range(5):
        try:
            # Sanitize text
            text_clean = text.replace("—", ", ").replace('"', "'").replace("\n", " ")
            comm = edge_tts.Communicate(text_clean, voice=voice)
            await comm.save(out_path)
            return True
        except Exception as e:
            print(f"    [tts] attempt {attempt+1} failed: {e}", file=sys.stderr)
            await asyncio.sleep(2 ** attempt)
    return False


def measure_duration(mp3_path: str) -> float:
    """Measure audio duration with ffprobe"""
    result = subprocess.run([
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_streams", mp3_path
    ], capture_output=True, text=True)
    try:
        d = json.loads(result.stdout)
        return float(d["streams"][0]["duration"])
    except Exception:
        return 3.0


def compute_scene_boundaries(scenes: list, vo_durations: list) -> dict:
    """Compute frame-accurate scene boundaries from VO durations"""
    boundaries = []
    t = 0.0
    for i, (scene, vo_dur) in enumerate(zip(scenes, vo_durations)):
        frames = math.ceil(vo_dur * FPS) + 12  # 12 tail frames
        end_t  = t + frames / FPS
        boundaries.append({
            "id":    scene["id"],
            "start": round(t, 4),
            "end":   round(end_t, 4),
            "frames": frames,
        })
        t = end_t

    total_frames = sum(b["frames"] for b in boundaries)
    total_dur    = total_frames / FPS

    return {
        "FPS":    FPS,
        "scenes": boundaries,
        "dur":    round(total_dur, 4),
        "total_frames": total_frames,
    }


def build_adelay_filter(timeline: dict, vo_dir: Path) -> str:
    """Build ffmpeg adelay filtergraph for VO concat"""
    n = len(timeline["scenes"])
    inputs = " ".join(f"-i {vo_dir}/line{i+1}.mp3" for i in range(n))
    filters = []
    for i, sc in enumerate(timeline["scenes"]):
        ms = int(sc["start"] * 1000)
        filters.append(f"[{i}:a]adelay={ms}|{ms}[a{i+1}]")
    mix = "".join(f"[a{i+1}]" for i in range(n))
    filters.append(f"{mix}amix=inputs={n}:normalize=0[out]")
    return f"{inputs} -filter_complex \"{'; '.join(filters)}\" -map [out] -t {timeline['dur']} -ar 48000 -ac 1"


def inject_film_data(template_js: str, film_data: dict, timeline: dict) -> str:
    """Inject __FILM_DATA__ and __TIMELINE__ into main.js"""
    inject = f"""
// ── INJECTED BY DIRECTOR ──────────────────────────────────────────────────
window.__FILM_DATA__ = {json.dumps(film_data, indent=2)};
window.__TIMELINE__  = {json.dumps(timeline,  indent=2)};
// ─────────────────────────────────────────────────────────────────────────
"""
    # Find the const FILM_DATA line and replace the whole default block
    if "window.__FILM_DATA__" in template_js:
        # Already injected — replace
        template_js = re.sub(
            r'// ── INJECTED BY DIRECTOR ──.*?// ─+\n',
            inject, template_js, flags=re.DOTALL
        )
    else:
        # Inject at top after first import block
        last_import = max(template_js.rfind("\nimport "), 0)
        end_of_imports = template_js.find("\n", last_import + 1) + 1
        # Find the FILM_DATA const and replace with inject
        template_js = re.sub(
            r'// ═+\n// FILM_DATA.*?(?=// ═)',
            inject + "\n",
            template_js, flags=re.DOTALL
        )
    return template_js


def build_subtitles(script: dict, timeline: dict) -> list:
    """Build subtitle cues from script scenes and timeline"""
    subs = []
    for i, (scene, tl) in enumerate(zip(script["scenes"], timeline["scenes"])):
        vo = scene["vo"]
        # Simple sentence split into cues
        words = vo.split()
        dur = tl["end"] - tl["start"]
        words_per_cue = max(4, len(words) // max(1, round(dur / 2.5)))
        for j in range(0, len(words), words_per_cue):
            chunk = " ".join(words[j:j+words_per_cue])
            cue_a = tl["start"] + (j / len(words)) * dur
            cue_b = tl["start"] + min(1.0, (j + words_per_cue) / len(words)) * dur
            subs.append({"a": round(cue_a, 3), "b": round(cue_b, 3), "text": chunk})
    return subs


def script_to_film_data(script: dict, processed_images: list, subtitles: list) -> dict:
    """Convert script + images into the __FILM_DATA__ structure"""
    # Build image index by query
    img_by_query = {}
    for img in processed_images:
        q = img.get("query", "")
        if q not in img_by_query:
            img_by_query[q] = img["rel"]

    # Enrich scenes with image paths
    enriched_scenes = []
    for scene in script.get("scenes", []):
        s = dict(scene)
        if s.get("image_query") and s["image_query"] in img_by_query:
            s["image"] = img_by_query[s["image_query"]]
        elif processed_images:
            # Pick the first available image
            s["image"] = processed_images[0]["rel"] if not s.get("image") else s.get("image")
        enriched_scenes.append(s)

    return {
        "theme":       script.get("color_theme", "cream-navy"),
        "logline":     script.get("logline", ""),
        "scenes":      enriched_scenes,
        "subtitles":   subtitles,
        "transitions": _auto_transitions(enriched_scenes, None),  # filled after timeline
        "data_points": script.get("data_points", []),
    }


def _auto_transitions(scenes: list, timeline) -> list:
    """Generate automatic transitions between scenes"""
    types = ["tornWipe", "flash", "slideUp", "paperFlip", "wipeRight", "iris"]
    if not timeline:
        return []
    trs = []
    for i in range(len(scenes) - 1):
        at = timeline["scenes"][i]["end"] - 0.4
        trs.append({
            "at":   round(at, 3),
            "dur":  0.4,
            "type": types[i % len(types)],
            "seed": i * 7 + 3,
        })
    return trs


# ── Mix.py generation ─────────────────────────────────────────────────────────
def generate_mix_py(film_dir: Path, script: dict, timeline: dict) -> str:
    scenes = timeline["scenes"]
    scene_times = "\n".join(
        f"S{i+1} = {sc['start']:.4f}  # {sc['id']}"
        for i, sc in enumerate(scenes)
    )
    n_scenes = len(scenes)

    return f'''"""Audio mix for {film_dir.name} — generated by OpusFlow director"""
import sys, os, math
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
LIB  = os.environ.get('LIB', os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(LIB, 'core', 'audio'))
import sfx; import soundfile as sf

SR    = sfx.SR
FPS   = {FPS}
DUR   = {timeline["dur"]}
TOTAL = {timeline["total_frames"]}

# Scene starts
{scene_times}

buf = np.zeros((int(math.ceil(DUR * SR)) + SR, 2))
def add(x, at, gain=1.0, pan=0.0): sfx.add(buf, x, at, gain, pan)

# ── SFX ──────────────────────────────────────────────────────────────────────
def paper_slam(pitch=1.0, v=1.0):
    d = 0.18; tt = sfx.t_(d)
    n   = sfx.hp(sfx.noise(d), 800) * sfx.env_exp(d, 0.008)
    low = np.sin(2*np.pi*110*pitch*tt) * sfx.env_exp(d, 0.030) * 0.6
    mid = sfx.bp(sfx.noise(d), 2000, 5000) * sfx.env_exp(d, 0.004) * 0.4
    return sfx.norm(n*0.5 + low + mid) * v

def card_drop(freq=90, v=1.0):
    d = 0.22; tt = sfx.t_(d)
    body  = np.sin(2*np.pi*freq*tt) * sfx.env_exp(d, 0.045)
    click = sfx.hp(sfx.noise(0.04), 1500) * sfx.env_exp(0.04, 0.005)
    out   = np.zeros(len(body))
    out  += body; out[:len(click)] += click * 0.4
    return sfx.norm(out) * v

def thunk(v=1.0):
    d = 0.30; tt = sfx.t_(d)
    sub  = np.sin(2*np.pi*55*tt) * sfx.env_exp(d, 0.055)
    snap = sfx.hp(sfx.noise(0.06), 1200) * sfx.env_exp(0.06, 0.007)
    wood = sfx.bp(sfx.noise(0.1), 300, 900) * sfx.env_exp(0.1, 0.030) * 0.5
    out  = np.zeros(int(d*SR))
    out += sub; out[:len(snap)] += snap*0.6; out[:int(0.1*SR)] += wood[:int(0.1*SR)]
    return sfx.norm(out) * v

def paper_flip(v=1.0):
    d = 0.14; tt = sfx.t_(d)
    swish = sfx.bp(sfx.noise(d), 1500, 4500) * np.abs(np.sin(np.pi*tt/d)**2)
    pat   = np.sin(2*np.pi*220*tt) * sfx.env_exp(d, 0.018) * 0.3
    return sfx.norm(swish * 0.8 + pat) * v

# Scene SFX
add(paper_slam(1.0, 0.95), S1 + 0/FPS)
add(paper_slam(0.9, 0.80), S1 + 10/FPS)

{chr(10).join(f"add(card_drop({70 + i*30}, 0.88), S{i+1} + 0/FPS)" for i in range(1, min(n_scenes, 4)))}

add(thunk(1.0), S{min(n_scenes-1, 4)} + 2.0)

if DUR > S{n_scenes}:
    add(paper_flip(0.90), S{n_scenes} + 2.0)

# ── BGM: warm Fmaj7 pad ───────────────────────────────────────────────────────
def gen_pad(freq, dur, amp):
    tt = sfx.t_(dur)
    out = np.sin(2*np.pi*freq*tt) * amp
    out += np.sin(2*np.pi*freq*2*tt) * amp * 0.3
    out += np.sin(2*np.pi*freq*3*tt) * amp * 0.1
    env = np.ones(len(tt))
    fade = min(int(1.5*SR), len(tt)//3)
    env[:fade] = np.linspace(0, 1, fade)
    env[-fade:] = np.linspace(1, 0, fade)
    return out * env

bgm_start = S2 if {n_scenes} > 1 else S1
bgm_end   = S{max(1, n_scenes-1)} if {n_scenes} > 2 else DUR
bgm_dur   = max(0.1, bgm_end - bgm_start)

for freq in [174.6, 220.0, 261.6, 329.6]:
    add(gen_pad(freq, bgm_dur, 0.063), bgm_start)

# Piano hit at payoff
def piano_hit(freq=65.4, v=0.18):
    d = 3.5; tt = sfx.t_(d)
    tone = np.sin(2*np.pi*freq*tt) * np.exp(-tt/1.2)
    tone += np.sin(2*np.pi*freq*2*tt) * 0.5 * np.exp(-tt/0.8)
    out = np.zeros(int(d*SR)); out += tone
    return sfx.norm(out) * v

add(piano_hit(65.4, 0.18), S{n_scenes})

# Room bed
bed_dur = min(S{max(1,n_scenes-1)}, DUR) - S1
bed_noise = sfx.bp(sfx.noise(bed_dur), 300, 2000) * 0.010
bs = int(S1 * SR); be = min(len(buf), bs + len(bed_noise))
buf[bs:be, 0] += bed_noise[:be-bs]
buf[bs:be, 1] += bed_noise[:be-bs]

# ── Write stem ────────────────────────────────────────────────────────────────
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
out_path = os.path.join(HERE, 'out', 'sfxbgm.wav')
peak = np.abs(buf).max()
if peak > 0: buf = buf / peak * 0.55
sf.write(out_path, buf, SR, subtype='PCM_16')
print(f'sfxbgm.wav written  ({{DUR:.2f}}s)')
'''


def generate_build_sh(film_dir: Path, timeline: dict, style: str = "vox-pro") -> str:
    n = len(timeline["scenes"])
    vo_inputs = " ".join(f'-i "$HERE/out/vo/line{i+1}.mp3"' for i in range(n))
    delays    = " ".join(
        f'[{i}:a]adelay={int(sc["start"]*1000)}|{int(sc["start"]*1000)}[a{i+1}];'
        for i, sc in enumerate(timeline["scenes"])
    )
    amix_in   = "".join(f"[a{i+1}]" for i in range(n))

    return f'''#!/bin/sh
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
LIB=${{LIB:-$(cd "$HERE/../.." && pwd)}}
export LIB
[ -f "$LIB/core/render/video.mjs" ] || {{ echo "set LIB to opusflow root"; exit 1; }}
cd "$LIB"

echo "=== {film_dir.name} ==="
mkdir -p "$HERE/out/vo" "$HERE/out"

# ── Step 1: Voice (if not already generated) ────────────────────────────────
for i in $(seq 1 {n}); do
  [ -f "$HERE/out/vo/line${{i}}.mp3" ] || {{
    echo "→ VO line ${{i}} missing — regenerate with:"
    echo "  python pipeline/director.py --topic '...' --only-vo --film {film_dir.name}"
  }}
done

# ── Step 2: VO concat ────────────────────────────────────────────────────────
ffmpeg -y -loglevel error \\
  {vo_inputs} \\
  -filter_complex \\
    "{delays}{amix_in}amix=inputs={n}:normalize=0[out]" \\
  -map "[out] " -t {timeline["dur"]} -ar 48000 -ac 1 \\
  "$HERE/out/vo_concat.wav"
echo "→ vo_concat.wav"

# ── Step 3: SFX + BGM ───────────────────────────────────────────────────────
"$LIB/.venv/bin/python" "$HERE/mix.py"
echo "→ sfxbgm.wav"

# ── Step 4: Mix VO + SFX ───────────────────────────────────────────────────
ffmpeg -y -loglevel error \\
  -i "$HERE/out/vo_concat.wav" -i "$HERE/out/sfxbgm.wav" \\
  -filter_complex "[0:a]volume=1.0[vo];[1:a]volume=0.251[bg];[vo][bg]amix=inputs=2:normalize=0[out]" \\
  -map "[out]" -t {timeline["dur"]} -ar 48000 -ac 1 \\
  "$HERE/out/mix.wav"
echo "→ mix.wav"

# ── Step 5: Render picture ──────────────────────────────────────────────────
node "$LIB/core/render/video.mjs" "$HERE" \\
  --fps {FPS} --size 1080x1920 --workers 4 \\
  --out "$HERE/out/video.mp4"
echo "→ video.mp4"

# ── Step 6: Mux ─────────────────────────────────────────────────────────────
sh "$LIB/core/render/mux.sh" \\
  "$HERE/out/video.mp4" "$HERE/out/mix.wav" \\
  "$HERE/{film_dir.name}.mp4" {FPS} 2
echo "→ {film_dir.name}.mp4"

# ── Step 7: QA stills ───────────────────────────────────────────────────────
mkdir -p "$HERE/stills"
for t in {" ".join(str(round((s["start"]+s["end"])/2, 2)) for s in timeline["scenes"])}; do
  node "$LIB/core/render/still.mjs" "$HERE" $t 1 \\
    --size 1080x1920 --out "$HERE/stills/t_${{t}}.jpg" 2>/dev/null || true
done
echo "→ stills/"

echo ""
echo "=== Done: $HERE/{film_dir.name}.mp4 ==="
'''


# ═════════════════════════════════════════════════════════════════════════════
# MAIN DIRECTOR
# ═════════════════════════════════════════════════════════════════════════════
async def direct(topic: str, style: str = "vox-pro", duration: int = 45,
                 film_name: str = None, skip_render: bool = False,
                 skip_images: bool = False):

    slug      = film_name or slugify(topic)
    film_dir  = HERE / "films" / slug
    film_dir.mkdir(parents=True, exist_ok=True)
    assets_dir = film_dir / "assets" / "images"
    vo_dir     = film_dir / "out" / "vo"
    vo_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"OpusFlow Director: {topic!r}")
    print(f"Style: {style} | Duration: ~{duration}s | Film: {slug}")
    print(f"{'='*60}\n")

    # ── 1. Research ───────────────────────────────────────────────────────────
    print("▶ Step 1: Research")
    research_data = research(topic, depth="standard")
    with open(film_dir / "research.json", "w") as f:
        json.dump(research_data, f, indent=2)
    print(f"  ✓ {len(research_data.get('facts',[]))} facts, {len(research_data.get('numbers',[]))} stats\n")

    # ── 2. Script ─────────────────────────────────────────────────────────────
    print("▶ Step 2: Script")
    script = write_script(topic, research_data, duration=duration, style=style)
    with open(film_dir / "script.json", "w") as f:
        json.dump(script, f, indent=2)
    scenes = script.get("scenes", [])
    print(f"  ✓ {len(scenes)} scenes, logline: {script.get('logline','')[:60]}\n")

    # ── 3. Voice ──────────────────────────────────────────────────────────────
    print("▶ Step 3: Voice (edge-tts)")
    vo_durations = []
    for i, scene in enumerate(scenes):
        vo_text = scene.get("vo", f"Scene {i+1}.")
        out_path = str(vo_dir / f"line{i+1}.mp3")
        if Path(out_path).exists():
            dur = measure_duration(out_path)
            print(f"  ✓ line{i+1}.mp3 exists ({dur:.2f}s)")
        else:
            print(f"  → line{i+1}: {vo_text[:50]}...")
            ok = await gen_vo(vo_text, out_path)
            dur = measure_duration(out_path) if ok else 3.0
            if ok:
                print(f"  ✓ line{i+1}.mp3 ({dur:.2f}s)")
            else:
                print(f"  ✗ line{i+1} failed — using 3.0s fallback")
        vo_durations.append(dur)
    print()

    # ── 4. Timeline ───────────────────────────────────────────────────────────
    print("▶ Step 4: Timeline")
    timeline = compute_scene_boundaries(scenes, vo_durations)
    with open(film_dir / "timeline.json", "w") as f:
        json.dump(timeline, f, indent=2)
    print(f"  ✓ {timeline['total_frames']} frames | {timeline['dur']:.2f}s total\n")

    # ── 5. Images ─────────────────────────────────────────────────────────────
    if not skip_images:
        print("▶ Step 5: Images")
        queries = research_data.get("img_queries", [topic])[:5]
        # Add scene-specific queries
        for scene in scenes:
            if scene.get("image_query"):
                queries.append(scene["image_query"])
        queries = list(dict.fromkeys(queries))[:8]  # deduplicate, max 8

        fetcher   = ImageFetcher(out_dir=str(assets_dir))
        raw_imgs  = fetcher.fetch(queries, count_per_query=2)
        processed = batch_process(raw_imgs, str(assets_dir / "proc"),
                                  {"w": 1080, "h": 720, "grade": "vox",
                                   "torn_sides": ["bottom"]})
        with open(film_dir / "images.json", "w") as f:
            json.dump(processed, f, indent=2)
        print(f"  ✓ {len(processed)} images processed\n")
    else:
        processed = []
        print("▶ Step 5: Images (skipped)\n")

    # ── 6. Subtitles ─────────────────────────────────────────────────────────
    print("▶ Step 6: Subtitles")
    subtitles = build_subtitles(script, timeline)
    with open(film_dir / "subtitles.json", "w") as f:
        json.dump(subtitles, f, indent=2)
    print(f"  ✓ {len(subtitles)} subtitle cues\n")

    # ── 7. Film data ──────────────────────────────────────────────────────────
    print("▶ Step 7: Film data")
    film_data = script_to_film_data(script, processed, subtitles)
    film_data["transitions"] = _auto_transitions(film_data["scenes"], timeline)
    with open(film_dir / "film_data.json", "w") as f:
        json.dump(film_data, f, indent=2)
    print(f"  ✓ film_data.json\n")

    # ── 8. Generate film code ─────────────────────────────────────────────────
    print("▶ Step 8: Generate film code")
    template_dir = HERE / "styles" / style / "template"
    # Copy and inject index.html
    shutil.copy(template_dir / "index.html", film_dir / "index.html")

    # Read main.js template and inject film data
    main_tmpl = (template_dir / "main.js").read_text()
    # Inject __FILM_DATA__ and __TIMELINE__ as window globals before the first import
    inject_block = f"""
// ── INJECTED BY DIRECTOR ─────────────────────────────────────────────────
window.__FILM_DATA__ = {json.dumps(film_data, indent=2)};
window.__TIMELINE__  = {json.dumps(timeline, indent=2)};
// ─────────────────────────────────────────────────────────────────────────

"""
    # Remove the default FILM_DATA block from template
    main_code = re.sub(
        r'const FILM_DATA = window\.__FILM_DATA__ \|\| \{.*?\};',
        f'const FILM_DATA = window.__FILM_DATA__;',
        main_tmpl, flags=re.DOTALL
    )
    main_code = re.sub(
        r'const TL = window\.__TIMELINE__ \|\| \{.*?\};',
        f'const TL = window.__TIMELINE__;',
        main_code, flags=re.DOTALL
    )
    # Prepend injected globals (before module imports, can't do that in ES module)
    # Instead: emit a data script tag in index.html
    index_html = (film_dir / "index.html").read_text()
    data_script = f"""<script>
{inject_block}
</script>
"""
    index_html = index_html.replace("<script type=\"module\" src=\"main.js\"></script>",
                                    data_script + "<script type=\"module\" src=\"main.js\"></script>")
    (film_dir / "index.html").write_text(index_html)
    (film_dir / "main.js").write_text(main_code)

    # Generate mix.py
    mix_code = generate_mix_py(film_dir, script, timeline)
    (film_dir / "mix.py").write_text(mix_code)

    # Generate build.sh
    build_code = generate_build_sh(film_dir, timeline, style)
    (film_dir / "build.sh").write_text(build_code)

    print(f"  ✓ index.html, main.js, mix.py, build.sh\n")

    # ── 9. Summary ───────────────────────────────────────────────────────────
    print(f"{'='*60}")
    print(f"✓ Film ready: films/{slug}/")
    print(f"  Duration:   {timeline['dur']:.1f}s ({timeline['total_frames']} frames)")
    print(f"  Scenes:     {len(scenes)}")
    print(f"  Images:     {len(processed)}")
    print(f"  Build:      sh films/{slug}/build.sh")
    print(f"{'='*60}\n")

    if not skip_render:
        # Quick proof still at first frame
        print("▶ Rendering proof still...")
        subprocess.run([
            "node", str(HERE / "core/render/still.mjs"),
            str(film_dir), "0.1", "1",
            "--size", "1080x1920",
            "--out", str(film_dir / "stills/proof_s1.jpg")
        ], cwd=str(HERE))

    return film_dir


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OpusFlow Director")
    parser.add_argument("--topic",    required=True, help="Film topic")
    parser.add_argument("--style",    default="vox-pro", choices=STYLES)
    parser.add_argument("--duration", type=int, default=45)
    parser.add_argument("--name",     default=None, help="Custom film slug")
    parser.add_argument("--no-render", action="store_true")
    parser.add_argument("--no-images", action="store_true")
    args = parser.parse_args()

    asyncio.run(direct(
        topic       = args.topic,
        style       = args.style,
        duration    = args.duration,
        film_name   = args.name,
        skip_render = args.no_render,
        skip_images = args.no_images,
    ))
