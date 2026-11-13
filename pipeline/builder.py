#!/usr/bin/env python3
"""
OpusFlow Builder — runs the render pipeline for an already-prepared film directory.

Usage:
  python pipeline/builder.py films/my-topic          # render + mux
  python pipeline/builder.py films/my-topic --stills  # also extract proof stills

The director produces all source assets; builder drives the render pipeline.
"""
import os, sys, json, subprocess, argparse
from pathlib import Path

HERE = Path(__file__).parent.parent  # opusflow root


def run(cmd: list, cwd=None, check=True):
    print(f"  $ {' '.join(str(c) for c in cmd)}")
    result = subprocess.run(cmd, cwd=cwd or str(HERE), check=check,
                            capture_output=False)
    return result.returncode


def build(film_dir: Path, stills: bool = False, workers: int = 4,
          fps: int = 30, size: str = "1080x1920"):
    film_dir = film_dir.resolve()
    if not (film_dir / "index.html").exists():
        sys.exit(f"No index.html in {film_dir} — run director first")
    if not (film_dir / "timeline.json").exists():
        sys.exit(f"No timeline.json in {film_dir}")

    with open(film_dir / "timeline.json") as f:
        tl = json.load(f)
    dur = tl["dur"]
    scenes = tl["scenes"]

    (film_dir / "out").mkdir(parents=True, exist_ok=True)
    (film_dir / "stills").mkdir(parents=True, exist_ok=True)

    venv_py = str(HERE / ".venv/bin/python")
    have_venv = Path(venv_py).exists()
    py = venv_py if have_venv else "python3"

    print(f"\n{'='*60}")
    print(f"Building: {film_dir.name}")
    print(f"Duration: {dur:.1f}s | Scenes: {len(scenes)} | {fps}fps {size}")
    print(f"{'='*60}\n")

    # ── 1. VO concat ──────────────────────────────────────────────────────────
    vo_dir = film_dir / "out" / "vo"
    vo_files = sorted(vo_dir.glob("line*.mp3"), key=lambda p: int(p.stem.replace("line", "")))
    have_audio = len(vo_files) > 0

    if have_audio:
        print("▶ VO concat")
        # Build adelay filtergraph
        fc_parts = []
        for i, sc in enumerate(scenes):
            ms = int(sc["start"] * 1000)
            fc_parts.append(f"[{i}:a]adelay={ms}|{ms}[a{i+1}]")
        amix = "".join(f"[a{i+1}]" for i in range(len(scenes)))
        fc_parts.append(f"{amix}amix=inputs={len(scenes)}:normalize=0[out]")
        fc = ";".join(fc_parts)

        cmd = ["ffmpeg", "-y", "-loglevel", "error"]
        for vf in vo_files[:len(scenes)]:
            cmd += ["-i", str(vf)]
        cmd += ["-filter_complex", fc, "-map", "[out]",
                "-t", str(dur), "-ar", "48000", "-ac", "1",
                str(film_dir / "out/vo_concat.wav")]
        run(cmd)

        # ── 2. SFX + BGM ──────────────────────────────────────────────────────
        print("▶ SFX + BGM")
        mix_py = film_dir / "mix.py"
        if mix_py.exists():
            env = os.environ.copy()
            env["FILM_DIR"] = str(film_dir)
            env["LIB"] = str(HERE)
            subprocess.run([py, str(mix_py)], env=env, check=True)
        else:
            print("  (no mix.py — skipping SFX)")
            have_audio = False

        # ── 3. Mix VO + SFX ───────────────────────────────────────────────────
        if (film_dir / "out/sfxbgm.wav").exists():
            print("▶ Mixing VO + SFX")
            run([
                "ffmpeg", "-y", "-loglevel", "error",
                "-i", str(film_dir / "out/vo_concat.wav"),
                "-i", str(film_dir / "out/sfxbgm.wav"),
                "-filter_complex",
                "[0:a]volume=1.0[vo];[1:a]volume=0.251[bg];[vo][bg]amix=inputs=2:normalize=0[out]",
                "-map", "[out]", "-t", str(dur), "-ar", "48000", "-ac", "1",
                str(film_dir / "out/mix.wav"),
            ])
        else:
            # Just loudnorm the VO
            run([
                "ffmpeg", "-y", "-loglevel", "error",
                "-i", str(film_dir / "out/vo_concat.wav"),
                "-af", "loudnorm=I=-14:TP=-1:LRA=11",
                "-ar", "48000", "-t", str(dur),
                str(film_dir / "out/mix.wav"),
            ])

    # ── 4. Render frames ──────────────────────────────────────────────────────
    print("▶ Render frames → video")
    run([
        "node", str(HERE / "core/render/video.mjs"),
        str(film_dir),
        "--fps", str(fps),
        "--size", size,
        "--workers", str(workers),
        "--out", str(film_dir / "out/video.mp4"),
    ])

    # ── 5. Mux ───────────────────────────────────────────────────────────────
    print("▶ Mux")
    audio_in = str(film_dir / "out/mix.wav") if have_audio else ""
    mux_script = str(HERE / "core/render/mux.sh")
    out_film = str(film_dir / f"{film_dir.name}.mp4")
    run(["sh", mux_script,
         str(film_dir / "out/video.mp4"), audio_in, out_film,
         str(fps), "2"])

    # ── 6. Stills ─────────────────────────────────────────────────────────────
    if stills:
        print("▶ Proof stills")
        for sc in scenes:
            t = round((sc["start"] + sc["end"]) / 2, 2)
            out_still = str(film_dir / f"stills/t_{str(t).replace('.','_')}.jpg")
            subprocess.run([
                "node", str(HERE / "core/render/still.mjs"),
                str(film_dir), str(t), "1",
                "--size", size, "--out", out_still,
            ], capture_output=True)
        print(f"  ✓ {len(scenes)} stills")

    print(f"\n{'='*60}")
    print(f"✓ {out_film}")
    print(f"{'='*60}\n")
    return out_film


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("film_dir", help="Path to film directory")
    p.add_argument("--stills",   action="store_true")
    p.add_argument("--workers",  type=int, default=4)
    p.add_argument("--fps",      type=int, default=30)
    p.add_argument("--size",     default="1080x1920")
    args = p.parse_args()
    build(Path(args.film_dir), args.stills, args.workers, args.fps, args.size)
