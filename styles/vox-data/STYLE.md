# Vox-Data Style Specification

Bloomberg terminal meets NYT graphics desk. Deep navy/charcoal canvas, electric cyan accent (#00D4FF), animated data visualizations, monospace grid lines, clean editorial type. Zero decorative noise — every pixel earns its place.

## Palette
| Token | Hex | Usage |
|---|---|---|
| bg | #0D1117 | Main background — deep navy |
| surface | #161B22 | Card / panel surfaces |
| ink | #FFFFFF | Primary text |
| accent | #00D4FF | Cyan — lines, counters, highlights |
| sub | rgba(255,255,255,0.55) | Secondary labels |
| grid | rgba(255,255,255,0.04) | Background grid lines |

## Scene types
| type | Use for |
|---|---|
| `text` | Opening hook, logline |
| `bar` | Comparative bar chart |
| `line` | Trend over time |
| `counter` | Single big number |
| `donut` | Share / proportion |
| `generic` | Photo + stat cards fallback |

## Motion language
- All chart elements spring in from zero (not fade)
- Counter rolls up with smooth easing
- Grid lines pulse at 0.04 alpha
- Ticker bar fills across the top at scene start
- Floating cyan dots as ambient particles
- No torn paper, no texture — this is a glass screen

## Audio palette
- Soft digital click on data reveals
- Sub bass on counter payoff
- Cool chord pad (Cmaj9) for BGM
- Target loudness: −14 LUFS
