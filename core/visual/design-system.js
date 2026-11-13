/**
 * OpusFlow Design System — Vox editorial aesthetic
 * Themes, typography, layout constants, and color utilities.
 */

// ── Color Themes ─────────────────────────────────────────────────────────────
export const THEMES = {
  "cream-navy": {
    bg:      "#FBF7EE",
    paper:   "#F1E6D0",
    ink:     "#14213D",
    accent:  "#B8312A",
    warm:    "#F2C230",
    mid:     "#7A8C99",
    white:   "#FFFFFF",
    black:   "#0D0D0D",
    overlay: "rgba(20,33,61,0.08)",
    // halftone dot color
    dot:     "#D4C5A9",
  },
  "dark-editorial": {
    bg:      "#0F0F0F",
    paper:   "#1A1A1A",
    ink:     "#F5F0E8",
    accent:  "#FF4B4B",
    warm:    "#FFB84D",
    mid:     "#888888",
    white:   "#F5F0E8",
    black:   "#000000",
    overlay: "rgba(245,240,232,0.06)",
    dot:     "#2A2A2A",
  },
  "warm-orange": {
    bg:      "#FFF5EC",
    paper:   "#FFE5CC",
    ink:     "#1A0A00",
    accent:  "#FF5500",
    warm:    "#FFB300",
    mid:     "#997755",
    white:   "#FFFFFF",
    black:   "#0A0500",
    overlay: "rgba(26,10,0,0.06)",
    dot:     "#F5D5A0",
  },
  "cool-blue": {
    bg:      "#F0F4F8",
    paper:   "#DDE8F0",
    ink:     "#0A1628",
    accent:  "#0066CC",
    warm:    "#00AA88",
    mid:     "#5577AA",
    white:   "#FFFFFF",
    black:   "#050D1A",
    overlay: "rgba(10,22,40,0.06)",
    dot:     "#B8C8D8",
  },
};

export function getTheme(name = "cream-navy") {
  return THEMES[name] || THEMES["cream-navy"];
}


// ── Typography ───────────────────────────────────────────────────────────────
export const FONTS = {
  display:  "'AB', 'Archivo Black', Impact, sans-serif",   // heavy headers
  body:     "'AR', 'Archivo', 'Inter', system-ui, sans-serif",  // body
  mono:     "'Courier New', Courier, monospace",            // data labels
  serif:    "'Georgia', 'Times New Roman', serif",          // editorial accent
};

export const SIZES = {
  // 1080×1920 (9:16) base
  display_xl: 142,
  display:    108,
  headline:    72,
  subhead:     52,
  body:        40,
  caption:     30,
  label:       24,
  micro:       18,
};

// Scale font sizes for different canvas dimensions
export function scaleSizes(W, H, baseW = 1080, baseH = 1920) {
  const s = Math.min(W / baseW, H / baseH);
  const out = {};
  for (const [k, v] of Object.entries(SIZES)) out[k] = Math.round(v * s);
  return out;
}


// ── Layout Grid ──────────────────────────────────────────────────────────────
export function grid(W, H) {
  const gutter = Math.round(W * 0.05);
  const col    = Math.round((W - gutter * 7) / 6);
  return {
    gutter,
    col,
    // Named zones (9:16 canvas)
    safe_top:    Math.round(H * 0.14),
    safe_bottom: Math.round(H * 0.86),
    safe_left:   gutter * 2,
    safe_right:  W - gutter * 2,
    center_x:    W / 2,
    center_y:    H / 2,
    thirds: {
      top:    Math.round(H / 3),
      bottom: Math.round(H * 2 / 3),
      left:   Math.round(W / 3),
      right:  Math.round(W * 2 / 3),
    },
  };
}


// ── Shadow Presets ───────────────────────────────────────────────────────────
export const SHADOWS = {
  paper: {
    offsetX: 6, offsetY: 10, blur: 24,
    color: "rgba(14,22,40,0.22)"
  },
  card: {
    offsetX: 3, offsetY: 6, blur: 16,
    color: "rgba(14,22,40,0.18)"
  },
  text: {
    offsetX: 2, offsetY: 3, blur: 8,
    color: "rgba(14,22,40,0.30)"
  },
  glow: {
    offsetX: 0, offsetY: 0, blur: 40,
    color: "rgba(255,255,255,0.15)"
  },
};

export function shadow(ctx, preset = "paper") {
  const s = SHADOWS[preset] || SHADOWS.paper;
  ctx.shadowOffsetX = s.offsetX;
  ctx.shadowOffsetY = s.offsetY;
  ctx.shadowBlur    = s.blur;
  ctx.shadowColor   = s.color;
}

export function clearShadow(ctx) {
  ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
}


// ── Tape / Sticker Colors ────────────────────────────────────────────────────
export const TAPE_COLORS = [
  "rgba(255,220,100,0.70)",   // yellow tape
  "rgba(200,230,255,0.65)",   // blue tape
  "rgba(255,180,180,0.65)",   // pink tape
  "rgba(180,255,200,0.60)",   // green tape
  "rgba(230,210,255,0.65)",   // lavender tape
];

export const STICKER_BG = [
  "#FF6B6B", "#4ECDC4", "#FFE66D", "#A8E6CF", "#FF8B94",
  "#B388FF", "#FF7043", "#26C6DA", "#D4E157", "#EC407A",
];


// ── Text Utilities ───────────────────────────────────────────────────────────
export function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  const lines = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return lines.length;
}

export function textBlock(ctx, lines, x, y, {
  font, size, color, align = "left", lineH = null, maxW = 9999,
  stroke = null, strokeW = 4,
}) {
  ctx.save();
  ctx.font = `${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  const lh = lineH || Math.round(size * 1.25);
  lines.forEach((line, i) => {
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeW;
      ctx.lineJoin = "round";
      ctx.strokeText(line, x, y + i * lh);
    }
    ctx.fillText(line, x, y + i * lh);
  });
  ctx.restore();
}
