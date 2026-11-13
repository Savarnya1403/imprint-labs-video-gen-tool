"""
Vox-Pro mix template — procedural SFX + BGM for a vox-pro film.
The director generates a film-specific copy of this file; this is the reference implementation.

Usage (from opusflow root):
  python styles/vox-pro/template/mix.py
Expects:
  __TIMELINE__ in timeline.json (or hardcoded below)
Writes:
  out/sfxbgm.wav
"""
import sys, os, math
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
LIB  = os.environ.get('LIB', os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(LIB, 'core', 'audio'))
import sfx
import soundfile as sf
import json

# ── Load timeline ─────────────────────────────────────────────────────────────
tl_path = os.path.join(HERE, '..', '..', '..', 'timeline.json')
if os.path.exists(tl_path):
    with open(tl_path) as f:
        TL = json.load(f)
else:
    TL = {"FPS": 30, "dur": 30.0, "scenes": []}

SR    = sfx.SR
FPS   = TL.get("FPS", 30)
DUR   = TL.get("dur", 30.0)
SCENES = TL.get("scenes", [])
N     = len(SCENES)

buf = np.zeros((int(math.ceil(DUR * SR)) + SR, 2))
def add(x, at, gain=1.0, pan=0.0):
    sfx.add(buf, x, at, gain, pan)

# ── Scene start times ─────────────────────────────────────────────────────────
starts = [s["start"] for s in SCENES] if SCENES else [0.0]

# ── Paper-slam transient (scene opens) ───────────────────────────────────────
def paper_slam(pitch=1.0, v=1.0):
    d  = 0.18; tt = sfx.t_(d)
    n  = sfx.hp(sfx.noise(d), 800) * sfx.env_exp(d, 0.008)
    lo = np.sin(2*np.pi * 110*pitch * tt) * sfx.env_exp(d, 0.030) * 0.6
    hi = sfx.bp(sfx.noise(d), 2000, 5000) * sfx.env_exp(d, 0.004) * 0.4
    return sfx.norm(n*0.5 + lo + hi) * v

# ── Card-drop (scene 2+) ──────────────────────────────────────────────────────
def card_drop(freq=90, v=1.0):
    d = 0.22; tt = sfx.t_(d)
    body  = np.sin(2*np.pi*freq*tt) * sfx.env_exp(d, 0.045)
    click = sfx.hp(sfx.noise(0.04), 1500) * sfx.env_exp(0.04, 0.005)
    out = np.zeros(len(body))
    out += body
    out[:len(click)] += click * 0.4
    return sfx.norm(out) * v

# ── Tape-pull (mid-scene accent) ──────────────────────────────────────────────
def tape_pull(v=0.7):
    d = 0.25; tt = sfx.t_(d)
    swish = sfx.bp(sfx.noise(d), 1200, 5000) * np.sin(np.pi * tt/d)**1.5
    crinkle = sfx.hp(sfx.noise(d), 3000) * sfx.env_exp(d, 0.010) * 0.3
    return sfx.norm(swish * 0.7 + crinkle) * v

# ── Paper-flip (last scene) ───────────────────────────────────────────────────
def paper_flip(v=1.0):
    d = 0.14; tt = sfx.t_(d)
    swish = sfx.bp(sfx.noise(d), 1500, 4500) * np.abs(np.sin(np.pi*tt/d)**2)
    pat   = np.sin(2*np.pi*220*tt) * sfx.env_exp(d, 0.018) * 0.3
    return sfx.norm(swish * 0.8 + pat) * v

# ── Thunk (data reveal) ───────────────────────────────────────────────────────
def thunk(v=1.0):
    d = 0.30; tt = sfx.t_(d)
    sub  = np.sin(2*np.pi*55*tt) * sfx.env_exp(d, 0.055)
    snap = sfx.hp(sfx.noise(0.06), 1200) * sfx.env_exp(0.06, 0.007)
    wood = sfx.bp(sfx.noise(0.1), 300, 900) * sfx.env_exp(0.1, 0.030) * 0.5
    out  = np.zeros(int(d*SR))
    out += sub
    out[:len(snap)] += snap * 0.6
    out[:int(0.1*SR)] += wood[:int(0.1*SR)]
    return sfx.norm(out) * v

# ── Scene SFX ─────────────────────────────────────────────────────────────────
# Scene 1: big paper slam
add(paper_slam(1.0, 0.95), starts[0])
add(paper_slam(0.9, 0.80), starts[0] + 10/FPS)

# Scene 2+: card drops
for i, t in enumerate(starts[1:], 2):
    freq = 70 + (i % 5) * 30
    add(card_drop(freq, 0.88), t)

# Tape pull accents — mid-way through each scene
for i, s in enumerate(SCENES):
    mid = s["start"] + (s["end"] - s["start"]) * 0.4
    add(tape_pull(0.55), mid)

# Payoff thunk
if N >= 2:
    payoff = starts[min(N-1, max(0, N-2))] + 2.0
    add(thunk(1.0), payoff)

# Last scene flip
if N > 0:
    add(paper_flip(0.90), starts[-1] + 2.0)

# ── BGM: Fmaj7 → Cmaj7 floating pad ──────────────────────────────────────────
def gen_pad(freq, dur, amp):
    tt = sfx.t_(dur)
    out  = np.sin(2*np.pi*freq*tt) * amp
    out += np.sin(2*np.pi*freq*2*tt) * amp * 0.3
    out += np.sin(2*np.pi*freq*3*tt) * amp * 0.1
    env  = np.ones(len(tt))
    fade = min(int(1.5*SR), len(tt)//3)
    env[:fade]  = np.linspace(0, 1, fade)
    env[-fade:] = np.linspace(1, 0, fade)
    return out * env

bgm_start = starts[1] if N > 1 else starts[0]
bgm_end   = starts[max(0, N-2)] if N > 2 else DUR
bgm_dur   = max(0.1, bgm_end - bgm_start)

# Fmaj7: F3 A3 C4 E4
for freq in [174.6, 220.0, 261.6, 329.6]:
    add(gen_pad(freq, bgm_dur, 0.063), bgm_start)

# Piano root hit at payoff
def piano_hit(freq=65.4, v=0.18):
    d = 3.5; tt = sfx.t_(d)
    tone  = np.sin(2*np.pi*freq*tt) * np.exp(-tt/1.2)
    tone += np.sin(2*np.pi*freq*2*tt) * 0.5 * np.exp(-tt/0.8)
    out = np.zeros(int(d*SR))
    out += tone
    return sfx.norm(out) * v

if N > 0:
    add(piano_hit(65.4, 0.18), starts[-1])

# ── Room presence ─────────────────────────────────────────────────────────────
bed_dur   = max(0.1, min(DUR, bgm_end) - starts[0])
bed_noise = sfx.bp(sfx.noise(bed_dur), 300, 2000) * 0.010
bs = int(starts[0] * SR)
be = min(len(buf), bs + len(bed_noise))
buf[bs:be, 0] += bed_noise[:be-bs]
buf[bs:be, 1] += bed_noise[:be-bs]

# ── Write ─────────────────────────────────────────────────────────────────────
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
out_path = os.path.join(HERE, 'out', 'sfxbgm.wav')
peak = np.abs(buf).max()
if peak > 0:
    buf = buf / peak * 0.55
sf.write(out_path, buf, SR, subtype='PCM_16')
print(f'sfxbgm.wav written  ({DUR:.2f}s, {SR}Hz, stereo)')
