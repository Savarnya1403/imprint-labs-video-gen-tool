# Vox-Dark Style Specification

Cinematic investigative documentary. Near-black canvas, real photo composites, high-contrast white/cream type, crimson red accent. Pacing is slow-burn; every beat lands with weight. Reference: Netflix investigative docs, NYT Opinion video, Al Jazeera investigates.

## Palette
| Token | Hex | Usage |
|---|---|---|
| bg | #0A0A0A | Main — near black |
| off_white | #F0EDE8 | Primary text — slightly warm |
| accent | #C0392B | Crimson — rules, stats, emphasis |
| mid_grey | #8A8580 | Labels, captions |
| surface | rgba(255,255,255,0.03) | Subtle card surfaces |

## Scene types
| type | Use for |
|---|---|
| `reveal` | Big stat with context |
| `text` | Bare statement, no photo |
| `photo` | Real photo + torn-paper title band |
| `generic` | Headline + optional photo panel |

## Motion language
- Vertical accent line grows down before headline enters
- Headlines ease in from +Y with slow spring
- Photos dissolve in with dark overlay
- Torn-paper band slides up from bottom over photo
- Film grain overlay cycles at 24fps
- Dust cloud particles (grey) as ambient atmosphere
- Light leak on photo scenes (5% alpha screen blend)
- No bouncy transitions — flash only, or hard cut

## Photo treatment
- Full-bleed photo fills canvas, 65% black overlay
- Color grade: cooler, slightly desaturated
- Vignette: 55% strength
- Light leak: `seed=3`, alpha=0.05

## Audio palette
- No paper sounds — this is not a collage style
- Low thud on stat reveal
- Sparse piano for BGM (single notes, not chords)
- Room tone bed
- Target loudness: −14 LUFS
