# OpusFlow

**AI-directed video production pipeline.** Give it a topic; get a finished, narrated, music-scored vertical video — Vox-style editorial explainers, data journalism, or dark documentary.

## What it does

1. **Researches** the topic (Wikipedia + DuckDuckGo)
2. **Writes** a data-backed script (Claude API → structured JSON)
3. **Fetches** real photos from Pexels / Unsplash / Wikimedia
4. **Generates** VO narration (edge-tts, 5 voice options)
5. **Renders** every frame via headless Chromium on a Canvas 2D engine
6. **Scores** each film with procedural SFX + harmonic BGM
7. **Muxes** everything into a 1080×1920 H.264 MP4

## Quick start

```sh
# 1. Install
sh setup.sh
source .venv/bin/activate

# 2. Set API keys (at least ANTHROPIC for scripting)
export ANTHROPIC_API_KEY="sk-ant-..."
export PEXELS_API_KEY="..."         # optional but highly recommended
export UNSPLASH_ACCESS_KEY="..."    # optional

# 3. Make a film
python pipeline/director.py --topic "Why Indian roads kill 150,000 a year" --style vox-dark
# → films/why-indian-roads-kill/

# 4. Build it
sh films/why-indian-roads-kill/build.sh
# → films/why-indian-roads-kill/why-indian-roads-kill.mp4
```

## Styles

| Style | Look | Best for |
|---|---|---|
| `vox-pro` | Warm cream, torn-paper collage, editorial | Explainers, brand stories |
| `vox-data` | Dark navy, animated charts, terminal | Data stories, finance, tech |
| `vox-dark` | Near-black, photo + crimson, cinematic | Investigations, serious topics |

## Director options

```
python pipeline/director.py \
  --topic   "Your topic here"    # required
  --style   vox-pro              # vox-pro | vox-data | vox-dark
  --duration 45                  # target seconds
  --name    my-film-slug         # optional custom folder name
  --no-images                    # skip image fetch
  --no-render                    # skip proof still
```

## Pipeline architecture

```
pipeline/director.py          ← orchestrates everything
  pipeline/researcher.py      ← Wikipedia + DuckDuckGo
  pipeline/scripter.py        ← Claude API → structured JSON script
  core/assets/fetch_images.py ← Pexels / Unsplash / Wikimedia / DDG
  core/assets/process_images.py ← smart crop + grade + torn mask
  edge-tts                    ← voice narration per scene
  styles/<style>/template/    ← Canvas 2D animation engine
    index.html
    main.js                   ← scene renderers, transitions, infographics
    mix.py                    ← procedural SFX + BGM (per film)
    build.sh                  ← render orchestration (per film)
  core/render/
    video.mjs                 ← Playwright headless → frame capture → ffmpeg
    still.mjs                 ← single frame PNG/JPEG
    mux.sh                    ← loudnorm + audio mux
  pipeline/builder.py         ← build runner (called by build.sh)
```

## Film output layout

```
films/<slug>/
  index.html          ← Chromium loads this
  main.js             ← injected film data + animation engine
  mix.py              ← SFX + BGM for this film
  build.sh            ← run this to render
  research.json       ← raw research
  script.json         ← structured script
  timeline.json       ← frame-accurate timing
  film_data.json      ← merged FILM_DATA object
  assets/images/      ← fetched + processed photos
  out/
    vo/line{n}.mp3    ← per-scene voice narration
    vo_concat.wav
    sfxbgm.wav
    mix.wav
    video.mp4
  stills/             ← proof frames per scene
  <slug>.mp4          ← FINAL OUTPUT
```

## Core visual libraries

| File | What it provides |
|---|---|
| `core/lib.js` | clamp, lerp, seg, spring, easing, mulberry PRNG |
| `core/visual/design-system.js` | Themes, type scale, grid, text helpers |
| `core/visual/transitions.js` | 15 named transitions (tornWipe, flash, iris, …) |
| `core/visual/infographics.js` | barChart, lineChart, counter, statCard, donutChart, … |
| `core/visual/particles.js` | Physics-based particles (confetti, shreds, dust, dots) |
| `core/visual/cinema.js` | Halftone, torn paper, light leaks, vignette, grades |
| `core/audio/sfx.py` | Procedural SFX library (paper slams, clicks, pads, …) |

## API keys needed

| Key | Source | Required for |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com | AI scripting (falls back to template) |
| `PEXELS_API_KEY` | pexels.com/api | Image fetch (falls back to Wikimedia/DDG) |
| `UNSPLASH_ACCESS_KEY` | unsplash.com/developers | Image fetch (optional second source) |

## Requirements

- Python 3.10+
- Node.js 18+
- ffmpeg + ffprobe
- Chromium (installed by playwright: `playwright install chromium`)

## Render performance

On an M-series Mac with 4 workers at 30fps 1080×1920:
- ~25–40 real-time factor (a 45s film renders in ~60–90s)
- Peak RAM ~800 MB (4 Chromium workers)

Tune with `--workers` flag in `build.sh`.
