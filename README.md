# Imprint Labs Video Gen Tool

> **Canvas 2D → Playwright → H.264.** Give it a topic; get a finished, narrated vertical reel — Vox-style editorial explainers, data journalism, or dark documentary. No AI image generation, no stock media. Everything rendered frame-by-frame in headless Chromium.

---

## What it does

1. **Researches** the topic from credible sources (consulting reports, VC essays, Substack newsletters, Tier-1 news RSS, government data) — Wikipedia only as a last resort
2. **Scripts** a data-backed narration using Claude (hook → body → payoff structure)
3. **Generates** VO audio with `edge-tts` (voice-first timing: measure → compute frames)
4. **Renders** every frame via headless Chromium on a Canvas 2D engine — zero AI images, zero stock
5. **Scores** the film with procedural SFX + harmonic BGM
6. **Muxes** video + loudnorm'd audio into a 1080×1920 H.264 MP4 (+faststart)

---

## Quick start

```sh
# 1. Clone and install
git clone https://github.com/Savarnya1403/imprint-labs-video-gen-tool.git
cd imprint-labs-video-gen-tool
sh setup.sh
source .venv/bin/activate

# 2. Set API keys
cp .env.example .env
# edit .env with your keys

# 3. Make a film
python pipeline/director.py --topic "Why Indian roads kill 150,000 a year" --style vox-dark

# 4. Build it
sh films/why-indian-roads-kill/build.sh
# → films/why-indian-roads-kill/why-indian-roads-kill.mp4
```

### Manual film (no AI scripting needed)

The `films/netflix-mood/` directory is a complete working demo — hand-crafted Canvas 2D film with no Claude dependency:

```sh
# Render the included Netflix mood reel demo
node core/render/video.mjs films/netflix-mood --fps 30 --size 1080x1920 --workers 4 \
  --out films/netflix-mood/out/video.mp4
```

---

## Requirements

| Dependency | Version | Install |
|---|---|---|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Python | 3.10+ | [python.org](https://python.org) |
| ffmpeg + ffprobe | 6+ | `brew install ffmpeg` |
| Chromium | auto | installed by `setup.sh` via playwright |

---

## API keys

| Variable | Required for | Get it at |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI script writing | [console.anthropic.com](https://console.anthropic.com) |
| `PEXELS_API_KEY` | Pexels photo search | [pexels.com/api](https://www.pexels.com/api/) |
| `UNSPLASH_ACCESS_KEY` | Unsplash photo search | [unsplash.com/developers](https://unsplash.com/developers) |

> Script writing falls back to a template if `ANTHROPIC_API_KEY` is missing. Images fall back to Wikimedia Commons if photo API keys are absent.

---

## Styles

| Style | Look | Best for |
|---|---|---|
| `vox-pro` | Warm cream, paper-collage, editorial | Explainers, brand stories |
| `vox-data` | Dark navy, animated charts, terminal | Data stories, finance, tech |
| `vox-dark` | Near-black, photo + crimson, cinematic | Investigations, serious topics |

---

## Director options

```
python pipeline/director.py \
  --topic    "Your topic here"   # required
  --style    vox-pro             # vox-pro | vox-data | vox-dark
  --duration 45                  # target seconds (default 45)
  --name     my-film-slug        # optional custom output folder name
  --no-images                    # skip image fetch (faster iteration)
  --no-render                    # skip proof still render
  --depth    standard            # research depth: quick | standard | deep
```

---

## Scene types (19)

| Type | Use for |
|---|---|
| `text-slam` | Bold hook, single statement |
| `stat-reveal` | One dramatic number |
| `image-collage` | Photo evidence grid |
| `split-reveal` | Side-by-side comparison |
| `payoff-flip` | Closing reframe |
| `kinetic-type` | Bold typographic statement, hook scenes |
| `newspaper` | Story framing, "as reported by" moments |
| `polaroid-stack` | Photo evidence, case studies, examples |
| `consulting-brief` | Data-heavy B2B/strategy topics |
| `pull-quote` | Attributed statements from real sources |
| `before-after` | Comparisons, transformations, contrasts |
| `percentage-fill` | Single dramatic stat — 73% of Indians, etc. |
| `chart-annotated` | Charts with callout arrows to key data points |
| `word-burst` | Topic/concept explosion, brainstorm aesthetics |
| `photo-zoom` | Cinematic push into a photo detail |
| `ticker-reveal` | Breaking news moment + stat underneath |
| `sticky-board` | Multi-fact cork board, research aesthetics |
| `timeline` | Chronological event sequences |
| *(fallback)* | Generic layout for any unrecognized type |

---

## Core visual libraries

### `core/visual/kinetics.js` — 10 typography animation primitives

| Function | What it does |
|---|---|
| `letterSpring` | Per-character spring physics — the signature Apple/Google motion |
| `wordCascade` | Lines of text stack in with stagger, used in editorial reveals |
| `titleCrash` | Text slams in from edge with overshoot + shock ring on impact |
| `typewriterPro` | Cursor, variable speed, pauses on punctuation marks |
| `scrubReveal` | Text revealed by a moving clip mask, left-to-right |
| `emphasisPop` | One word scales up 1.35× mid-sentence then settles back |
| `glitchText` | Chromatic aberration + scan-line slices for tech/dark subjects |
| `counterRoll` | Slot-machine digit roll with eased progress and progress underline |
| `stackLines` | Multi-line editorial stack with per-line spring + accent underline |
| `wordBurst` | Words explode from center to orbiting positions |

### `core/visual/artifacts.js` — 14 visual artifact primitives

| Artifact | The $50k-editor detail |
|---|---|
| `newspaperClipping` | Real masthead, column rule, dateline, byline, ruled with inked grain |
| `polaroid` | Handwriting font for caption, curl shadow, photo fills precisely |
| `stickyNote` | Cork board colors, ruled lines, fold line at top, push-pin support |
| `consultingExhibit` | Numbered exhibit header, accent bar top, source citation bottom |
| `pullQuote` | Giant background quotation mark at 15% opacity, animated rule |
| `annotation` | Wobbly hand-drawn circle + arrow with ink speckle physics |
| `redactedReveal` | Black bar lifts left-to-right at a specified reveal time |
| `breakingTicker` | Scrolling news bar with "BREAKING" label, slides in from below |
| `highlightPen` | Irregular marker stroke, two-pass for natural overlap |
| `waxSeal` | Irregular blob shape, speckled ink, inner circle rule |
| `indexCard` | Blue ruled lines, red margin line, Courier New font, paper clip |
| `comparisonTable` | Alt-row shading, animated column-by-column, source-aware accent |
| `stampSeal` | Double rectangle border, ink bleed with mulberry-seeded speckles |
| `filmFrameBorder` | Random vertical scratches, corner vignette, optional letterbox bars |

### Other core libraries

| File | What it provides |
|---|---|
| `core/lib.js` | `clamp`, `lerp`, `seg`, `spring`, `eio`, mulberry PRNG |
| `core/visual/design-system.js` | Themes, type scale, grid, text helpers |
| `core/visual/transitions.js` | 15 named transitions (tornWipe, flash, iris, …) |
| `core/visual/infographics.js` | `barChart`, `lineChart`, `counter`, `statCard`, `donutChart`, … |
| `core/visual/particles.js` | Physics-based particles (confetti, shreds, dust, dots) |
| `core/visual/cinema.js` | Halftone, torn paper, light leaks, vignette, colour grades |
| `core/audio/sfx.py` | Procedural SFX (paper slams, clicks, pads, foley) |

---

## Research sources

The researcher pulls from a 5-tier credibility hierarchy before falling back to Wikipedia:

1. **Government / central banks** — FRED, World Bank, RBI, MoSPI
2. **Strategy consulting** — McKinsey, BCG, Bain, Deloitte, PwC
3. **Major VCs** — a16z, Sequoia, Bessemer, NFX, YCombinator
4. **Trusted Substack writers** — Stratechery, Not Boring, The Diff, Lenny's Newsletter, Sajith Pai, Noahpinion
5. **Tier-1 news** — Reuters, FT, The Economist, Bloomberg

Wikipedia fires only if fewer than 3 sources respond for a given topic.

---

## Pipeline architecture

```
pipeline/director.py          ← orchestrates everything
  pipeline/researcher.py      ← 5-tier credible source hierarchy
  pipeline/scripter.py        ← Claude API → structured JSON script
  core/assets/fetch_images.py ← Pexels / Unsplash / Wikimedia
  core/assets/process_images.py ← smart crop + grade + torn mask
  edge-tts                    ← voice narration per scene
  styles/<style>/template/
    index.html
    main.js                   ← 19 scene renderers + all visual libraries
    mix.py                    ← procedural SFX + BGM (per film)
    build.sh                  ← render orchestration (per film)
  core/render/
    video.mjs                 ← Playwright headless → frame capture → ffmpeg
    still.mjs                 ← single frame PNG/JPEG for QA
    mux.sh                    ← loudnorm + audio mux
  pipeline/builder.py         ← build runner
```

## Film output layout

```
films/<slug>/
  index.html          ← Chromium loads this
  main.js             ← injected film data + animation engine
  mix.py              ← SFX + BGM for this film
  build.sh            ← run this to render
  research.json       ← raw research output
  script.json         ← structured script from Claude
  timeline.json       ← frame-accurate timing
  film_data.json      ← merged FILM_DATA object
  assets/images/      ← fetched + processed photos
  out/
    vo/line{n}.mp3    ← per-scene voice narration
    video.mp4         ← raw render (no audio)
    mix.wav           ← loudnorm'd audio track
  <slug>.mp4          ← FINAL OUTPUT (H.264, yuv420p, +faststart)
```

## Render performance

On an M-series Mac with 4 workers at 30fps 1080×1920:
- ~25–40× real-time factor (a 45s film renders in ~60–90s)
- Peak RAM ~800MB (4 Chromium workers)

Adjust `--workers` in `build.sh` or the render command.

---

## Training Library + Enhanced Pipeline

### Visual Asset Catalog (`core/assets/catalog/`)

286 reference images from the Vox/editorial training library are stored in `core/assets/catalog/images/` and NLP-labeled with Claude vision. At generation time, the director matches each scene description against the catalog to pull in real photo props.

```sh
# Build the catalog index (requires ANTHROPIC_API_KEY — only needed once)
python core/assets/catalog/build_catalog.py

# Output: core/assets/catalog/index.json — NLP-tagged entries for every image
```

The matcher ranks images by semantic overlap with the scene description, respects category and mood filters, and returns absolute paths ready for `drawProp()` to composite onto the Canvas.

### Smart Scene Splitter (`pipeline/scene_splitter.py`)

Any scene whose VO exceeds 8.5 seconds is automatically split at sentence boundaries. Each sub-scene gets a distinct visual continuation type so the frame keeps progressing while the audio plays:

| Continuation type | What appears |
|---|---|
| `stat-pull` | Key number extracted from VO and slammed in big |
| `annotation-appear` | Hand-drawn arrow + label popping onto the visual |
| `highlight-word` | Red marker sweeping under the key phrase |
| `sticky-note-pop` | Sticky note with 1–3 word summary pops in |
| `counter-tick` | Number counts up reinforcing the narration |
| `line-draw-diagram` | Simple arrow/line diagram draws itself |
| `subtext-reveal` | Supporting context typewriters in |
| `prop-enter` | Catalog prop asset slides in from side |
| `comparison-split` | Screen splits to show before/after |
| `quote-fragment` | Key phrase pulled out as large pull-quote |

### Script Upgrader (`pipeline/script_upgrader.py`)

Every raw topic or rough draft is automatically upgraded to Vox creator level before rendering:

- **Structure enforced**: hook (3–5s surprising stat) → tension → data beat 1 → pivot → data beat 2 → payoff
- **Iron rules**: max 10 words per sentence · no passive voice in first 15 words · specific numbers not generic adjectives · no "basically/essentially/kind of"
- **Quality score**: 0–100 with specific issue flags before render
- **Auto-fix**: splits sentences >20 words, assigns scene types from mood, estimates duration hints

```sh
# Preview script upgrade without rendering
python pipeline/director.py --topic "Why Indian EV startups keep failing" --upgrade-only
```

### Boil Animation + Catalog Props (in `styles/vox-pro/template/main.js`)

The render loop now includes:

- **Boil offset**: 10fps seeded per-character jitter on headline text (from htlin222/vox-styled-reels analysis) — gives the organic "living paper" feel
- **Catalog prop layer**: after each scene renders, matched catalog props are composited as torn-paper cutouts with drop shadow + entry animation
- **Word-level karaoke**: red highlight under the active word as VO plays (requires word timing data from the script)

### Visual Style DNA (`core/visual/style_dna.js`)

7 Canvas 2D drawing recipes extracted from the training library:

| Style | Topics | Look |
|---|---|---|
| `EDITORIAL_CREAM` | Finance, economics, education | Warm cream, rule lines, Swiss type |
| `BOLD_TYPOGRAPHIC` | Business, startups, brands | Oversized headline, minimal BW photo accent |
| `RETRO_GRID` | Technology, software | Grid paper, browser window card, badge stickers |
| `DARK_COLLAGE` | Politics, investigations | Near-black, BW cutouts, bold color blocks |
| `TEAL_EDITORIAL` | India, society, environment | Teal bg, cream cards, event poster hierarchy |
| `INFOGRAPHIC_TEAL` | Data, research, science | Teal bg, mind-map cards, section boxes |
| `PAPER_ILLUS` | Culture, history | Paper texture, ink sketch, hand-drawn style |

The style is auto-selected from topic keywords (`finance` → EDITORIAL_CREAM, `politics` → DARK_COLLAGE, etc.).

### Visual Composer (`core/visual/composer.js`)

High-level scene prop renderer with:

- `drawProp(ctx, img, opts)` — entry animations (slam/pop/slide), torn paper mask, drop shadow, grayscale, tint, border
- `boilOffset(seedStr, frame)` — 10fps mulberry-seeded jitter for organic text feel
- `propPosition(preset, W, H, propW, propH)` — 11 placement presets (center, bottom-anchor, hero-full, mid-right, etc.)
- `renderPropAsset(ctx, propEntry, sceneT, W, H)` — high-level one-call prop renderer

---

## Demo: Netflix Mood Reel

`films/netflix-mood/` is a fully hand-crafted 55-second reel (no Claude needed) demonstrating the motion vocabulary:

- **Motion**: `paper-slam`, `card-drop`, `typewriter`, `counter-tick`, `paper-flip`, `sticker-pop`, `line-draw`, `red-strike`
- **Palette**: cream `#F1E6D0` · paper `#FBF7EE` · Netflix red `#E50914` · navy `#14213D` · teal `#2A6F6F` · gold `#C9A227`
- **Format**: 1080×1920, 9:16, 30fps

```sh
# Regenerate the VO (requires edge-tts from requirements.txt)
python films/netflix-mood/gen_vo.py

# Render
node core/render/video.mjs films/netflix-mood \
  --fps 30 --size 1080x1920 --workers 4 \
  --out films/netflix-mood/out/video.mp4

# Mux audio
ffmpeg -i films/netflix-mood/out/video.mp4 \
       -i films/netflix-mood/out/audio_raw.aac \
       -c:v copy -af "loudnorm=I=-16:TP=-1.5:LRA=11" \
       -c:a aac -b:a 192k -movflags +faststart -shortest \
       reel.mp4
```
