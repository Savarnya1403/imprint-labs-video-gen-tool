/**
 * OpusFlow Cinema Effects
 * Cinematic overlays, light leaks, paper texture, halftone, color grading.
 * All drawn on top of Canvas 2D — zero external dependencies.
 */

import { mulberry, hash } from '/core/lib.js';

const clamp = (x, a=0, b=1) => Math.max(a, Math.min(b, x));
const lerp  = (a, b, t) => a + (b-a)*t;


// ── Halftone Pattern ─────────────────────────────────────────────────────────
/**
 * Draw halftone dots over a rectangular area.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x, y, w, h
 * @param {object} opts
 *   spacing: dot grid spacing in px
 *   maxR:    max dot radius as fraction of spacing
 *   color:   dot color
 *   angle:   grid rotation in radians
 */
export function halftone(ctx, x, y, w, h, opts = {}) {
  const {
    spacing = 14,
    maxR    = 0.44,
    color   = "rgba(0,0,0,0.12)",
    angle   = 0.4,
  } = opts;

  ctx.save();
  ctx.fillStyle = color;
  ctx.translate(x + w/2, y + h/2);
  ctx.rotate(angle);

  const diag = Math.sqrt(w*w + h*h);
  const nx   = Math.ceil(diag / spacing) + 2;
  const ny   = Math.ceil(diag / spacing) + 2;

  for (let i = -nx; i <= nx; i++) {
    for (let j = -ny; j <= ny; j++) {
      const px = i * spacing;
      const py = j * spacing;
      const r  = spacing * maxR * (0.5 + 0.5 * Math.sin(i * 0.4 + j * 0.7));
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.5, r), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}


// ── Paper Texture ─────────────────────────────────────────────────────────────
export function paperTexture(ctx, x, y, w, h, seed = 42, alpha = 0.04) {
  const rng = mulberry(seed);
  ctx.save();
  ctx.globalAlpha = alpha;

  // Coarse fibers
  for (let i = 0; i < 80; i++) {
    const lx  = x + rng() * w;
    const ly  = y + rng() * h;
    const len = 20 + rng() * 60;
    const ang = rng() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + Math.cos(ang) * len, ly + Math.sin(ang) * len);
    ctx.strokeStyle = `rgba(0,0,0,${0.3 + rng() * 0.4})`;
    ctx.lineWidth = 0.4 + rng() * 0.8;
    ctx.stroke();
  }

  // Fine noise grain
  for (let gx = x; gx < x + w; gx += 3) {
    for (let gy = y; gy < y + h; gy += 3) {
      const v = rng();
      if (v > 0.85) {
        ctx.fillStyle = v > 0.95
          ? `rgba(0,0,0,${rng() * 0.15})`
          : `rgba(255,255,255,${rng() * 0.08})`;
        ctx.fillRect(gx, gy, 2, 2);
      }
    }
  }
  ctx.restore();
}


// ── Torn Paper Edge ─────────────────────────────────────────────────────────
/**
 * Draw a torn paper strip with jagged edges on specified sides.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x, y, w, h — strip bounding box
 * @param {string} fillColor
 * @param {object} opts
 *   sides: ["top", "bottom", "left", "right"] — which sides are torn
 *   amp:   tear amplitude in px
 *   seed:  PRNG seed
 *   shadow: draw drop shadow
 */
export function tornStrip(ctx, x, y, w, h, fillColor, opts = {}) {
  const {
    sides  = ["bottom"],
    amp    = 14,
    seed   = 42,
    shadow = true,
    shadowColor = "rgba(14,22,40,0.20)",
    steps  = 48,
  } = opts;

  const rng = mulberry(seed);
  const pts = { top: [], bottom: [], left: [], right: [] };

  // Generate torn edge points
  for (let i = 0; i <= steps; i++) {
    const t  = i / steps;
    const j  = rng() - 0.5;

    if (sides.includes("top")) {
      pts.top.push([x + t*w, y + j*amp]);
    }
    if (sides.includes("bottom")) {
      pts.bottom.push([x + t*w, y + h + j*amp]);
    }
  }
  for (let i = 0; i <= steps / 2; i++) {
    const t  = i / (steps / 2);
    const j  = rng() - 0.5;
    if (sides.includes("left")) {
      pts.left.push([x + j*amp, y + t*h]);
    }
    if (sides.includes("right")) {
      pts.right.push([x + w + j*amp, y + t*h]);
    }
  }

  ctx.save();
  if (shadow) {
    ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 8;
    ctx.shadowBlur = 20; ctx.shadowColor = shadowColor;
  }

  ctx.beginPath();

  // Build path: TL corner → along top → TR → along right → BR → along bottom (reversed) → BL → along left (reversed) → close
  const topPts   = pts.top.length    ? pts.top    : [[x, y], [x+w, y]];
  const bottomPts= pts.bottom.length ? pts.bottom : [[x, y+h], [x+w, y+h]];
  const leftPts  = pts.left.length   ? pts.left   : [[x, y], [x, y+h]];
  const rightPts = pts.right.length  ? pts.right  : [[x+w, y], [x+w, y+h]];

  ctx.moveTo(topPts[0][0], topPts[0][1]);
  for (const pt of topPts) ctx.lineTo(pt[0], pt[1]);
  for (const pt of rightPts) ctx.lineTo(pt[0], pt[1]);
  for (const pt of [...bottomPts].reverse()) ctx.lineTo(pt[0], pt[1]);
  for (const pt of [...leftPts].reverse()) ctx.lineTo(pt[0], pt[1]);
  ctx.closePath();

  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}


// ── Torn Paper Circle ─────────────────────────────────────────────────────────
export function tornCircle(ctx, cx, cy, r, fillColor, seed = 99, amp = 10) {
  const rng = mulberry(seed);
  const steps = 60;

  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const ang = (i / steps) * Math.PI * 2 - Math.PI / 2;
    const jitter = 1 + (rng() - 0.5) * (amp / r);
    const px = cx + Math.cos(ang) * r * jitter;
    const py = cy + Math.sin(ang) * r * jitter;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 6;
  ctx.shadowBlur = 18; ctx.shadowColor = "rgba(14,22,40,0.18)";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}


// ── Tape Strip ────────────────────────────────────────────────────────────────
export function tape(ctx, x, y, w, h, angle = -0.06, color = "rgba(255,220,100,0.70)", seed = 1) {
  const rng = mulberry(seed);
  ctx.save();
  ctx.translate(x + w/2, y + h/2);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.fillRect(-w/2, -h/2, w, h);

  // Tape grain
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 20; i++) {
    const lx = -w/2 + rng() * w;
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(lx, -h/2); ctx.lineTo(lx + 2, h/2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}


// ── Vignette ─────────────────────────────────────────────────────────────────
export function vignette(ctx, W, H, strength = 0.4, color = "#000000") {
  const grad = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.8);
  grad.addColorStop(0, "transparent");
  grad.addColorStop(1, `${color}${Math.round(strength*255).toString(16).padStart(2,"0")}`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}


// ── Light Leak ────────────────────────────────────────────────────────────────
export function lightLeak(ctx, W, H, t, seed = 7, alpha = 0.12) {
  const rng = mulberry(seed);
  const e   = Math.sin(t * Math.PI);  // fade in/out
  ctx.save();
  ctx.globalAlpha = alpha * e;
  ctx.globalCompositeOperation = "screen";

  for (let i = 0; i < 3; i++) {
    const lx = rng() * W;
    const ly = rng() * H * 0.3;
    const lr = 150 + rng() * 300;
    const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
    grad.addColorStop(0, `hsl(${30 + rng()*40},90%,80%)`);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.restore();
}


// ── Color Grade Overlay ───────────────────────────────────────────────────────
/**
 * Apply a cinematic color grade via CSS filter + overlay.
 * Call once per frame before drawing.
 */
export const GRADES = {
  "bleach-bypass": "contrast(1.3) saturate(0.6)",
  "cross-process":  "contrast(1.2) hue-rotate(15deg) saturate(1.3)",
  "golden":         "sepia(0.3) saturate(1.2) brightness(1.05)",
  "cool":           "hue-rotate(195deg) saturate(0.8) brightness(0.95)",
  "vintage":        "sepia(0.25) contrast(1.1) brightness(0.95)",
  "none":           "",
};

export function setGrade(canvas, grade = "none") {
  canvas.style.filter = GRADES[grade] || "";
}
