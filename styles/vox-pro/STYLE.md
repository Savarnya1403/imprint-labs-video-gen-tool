# Vox-Pro Style Specification

Editorial paper-collage. Warm cream backgrounds, navy ink, hand-cut torn-paper textures, bold Archivo Black headlines, Scotch-tape accents. The reference aesthetic is Vox explainers circa 2022–24 and the best Pinterest collage accounts.

## Palette
| Token | Hex | Usage |
|---|---|---|
| bg | #FBF7EE | Main background — warm cream |
| paper | #F1E6D0 | Card / torn-strip surfaces |
| ink | #14213D | Primary text |
| accent | #B8312A | Red punch — counters, underlines, arrows |
| warm | #E8995E | Secondary highlight |
| mid | #A0A88F | Body copy, captions |
| white | #FFFFFF | Reverse text on dark |

## Typography
| Role | Family | Weight | Size |
|---|---|---|---|
| H1 | Archivo Black | 900 | 108px |
| H2 | Archivo Black | 900 | 72px |
| Body | Archivo | 400 | 44px |
| Caption | Archivo | 400 | 32px |
| Mono labels | system-ui mono | 500 | 28px |

## Layout (1080×1920)
- Safe insets: 72px horizontal, 180px top, 120px bottom
- 4-column grid with 24px gutters
- Thirds: H/3 = 640px, 2H/3 = 1280px — key horizontal lock lines

## Scene types
| type | Use for |
|---|---|
| `text-slam` | Opening hook, single bold statement |
| `stat-reveal` | One big number with context |
| `image-collage` | Photo composite with torn-paper crop |
| `split-reveal` | Two-column then/now comparison |
| `payoff-flip` | Closing CTA / share moment |
| `generic` | Fallback: headline + optional stat cards |

## Motion language
- **Arrival**: elements enter on easeOut spring from +Y or small scale
- **Data**: bar charts spring up, counters ease to target, line traces left-to-right
- **Transitions**: tornWipe → flash → slideUp → paperFlip → wipeRight → iris (cycled)
- **Tape**: always slightly rotated ±3–6°
- **Photo crops**: upper-third bias, torn-paper mask on bottom edge

## Image treatment
1. Fetch from Pexels / Unsplash / Wikimedia
2. Smart-crop to 1080×720 (upper-third bias)
3. Colour-grade: `vox` preset (+8% sat, +5% warm tint)
4. Torn-paper mask on bottom edge (seed = scene index)
5. Drop shadow below torn edge

## Audio palette
- Paper slams on scene 1 open
- Card drops on subsequent scenes
- Tape-pull accent at mid-scene
- Fmaj7 → Cmaj7 floating pad for BGM
- Low piano hit at payoff
- Room noise bed throughout
- Target loudness: −14 LUFS, true-peak ≤ −1 dBFS
