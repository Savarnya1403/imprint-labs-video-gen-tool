#!/usr/bin/env python3
"""Generate VO for Netflix mood reel + measure durations with ffprobe."""
import asyncio, json, subprocess, math, os, sys
import edge_tts

VOICE = "en-US-AndrewNeural"
RATE  = "-5%"
OUT   = os.path.join(os.path.dirname(__file__), "out/vo")

LINES = [
    ("s1", "You've opened Netflix. Scrolled for twenty minutes. And watched nothing."),
    ("s2", "That's not you being picky. That's your brain hitting a wall. "
           "The average person spends fourteen minutes searching — "
           "and one in five gives up and does something else entirely."),
    ("s3", "Netflix's own data says the problem isn't your taste. "
           "It's that your taste isn't the thing deciding. "
           "Your mood is. And your mood doesn't show up in your watch history."),
    ("s4", "So during lockdown in India, Netflix stopped asking "
           "'what do you want to watch?' "
           "and started reading mood signals from three places you wouldn't expect: "
           "Spotify playlists, Twitter emojis, and Swiggy orders."),
    ("s5", "Tweet a crying emoji, Netflix Matchmaker sends you a drama. "
           "Order biryani, it sends something that feels like biryani. "
           "Your Swiggy cart becomes a recommendation engine."),
    ("s6", "Because sometimes, understanding how someone feels "
           "is more useful than knowing what they watched yesterday."),
]

async def gen_one(slug, text):
    path = os.path.join(OUT, f"{slug}.mp3")
    if os.path.exists(path):
        print(f"  skip {slug} (exists)")
        return path
    # strip smart quotes → plain ASCII
    text = text.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
    for attempt in range(3):
        try:
            await asyncio.sleep(1.5 * attempt)
            comm = edge_tts.Communicate(text, VOICE, rate=RATE)
            await comm.save(path)
            print(f"  wrote {path}")
            return path
        except Exception as e:
            print(f"  attempt {attempt+1} failed: {e}")
            if attempt == 2:
                raise
    return path

def measure(path):
    r = subprocess.run(
        ["ffprobe","-v","error","-show_entries","format=duration",
         "-of","default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True, check=True
    )
    return float(r.stdout.strip())

async def main():
    os.makedirs(OUT, exist_ok=True)
    timings = {}
    for slug, text in LINES:
        await asyncio.sleep(1.0)
        path = await gen_one(slug, text)
        dur   = measure(path)
        frames = math.ceil(dur * 30) + 12
        timings[slug] = {"dur": round(dur, 3), "frames": frames}
        print(f"  {slug}: {dur:.3f}s → {frames} frames")

    total = sum(v["frames"] for v in timings.values())
    print(f"\n  TOTAL frames: {total}  (target ~1440)")

    out_path = os.path.join(os.path.dirname(__file__), "out/timings.json")
    with open(out_path, "w") as f:
        json.dump(timings, f, indent=2)
    print(f"  saved {out_path}")

asyncio.run(main())
