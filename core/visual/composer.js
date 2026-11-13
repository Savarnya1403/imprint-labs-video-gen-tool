/**
 * composer.js — Canvas 2D image compositor
 * Draws training-library prop images onto canvas as collage elements.
 * Handles transparent PNGs, paper-cut treatment, shadow, rotation, entry animation.
 */

// ── paper-cut treatment ──────────────────────────────────────────────────
export function drawProp(ctx, img, opts = {}) {
  const {
    x = 0, y = 0, w = 300, h = 300,
    rotation = 0,
    paperCut = false,       // torn edge mask
    dropShadow = true,
    shadowColor = 'rgba(0,0,0,0.22)',
    shadowBlur = 18,
    shadowOffX = 6, shadowOffY = 10,
    opacity = 1,
    grayscale = false,
    tint = null,            // e.g. 'rgba(229,9,20,0.25)' for red tint
    entryT = 1,             // 0→1 controls entry animation progress (1=fully in)
    entryStyle = 'slam',    // slam | pop | slide-left | slide-right | slide-up | none
    borderColor = null,
    borderWidth = 3,
  } = opts;

  if (entryT <= 0) return;

  ctx.save();
  ctx.globalAlpha = opacity;

  // ── entry animation (step-based, no easing) ──────────────────────────
  let tx = 0, ty = 0, sx = 1, sy = 1;
  if (entryStyle === 'slam' && entryT < 1) {
    const f = Math.floor(entryT * 4);  // 0,1,2,3
    if (f === 0) { ty = -h * 1.5; }
    else if (f === 1) { ty = 8; }
    else if (f === 2) { ty = -2; }
    else { ty = 0; }
  } else if (entryStyle === 'pop' && entryT < 1) {
    const f = Math.floor(entryT * 5);
    if (f === 0) { sx = sy = 0; }
    else if (f === 1) { sx = sy = 0.5; }
    else if (f === 2) { sx = sy = 1.08; }
    else if (f === 3) { sx = sy = 0.97; }
    else { sx = sy = 1; }
  } else if (entryStyle === 'slide-left' && entryT < 1) {
    const f = Math.floor(entryT * 3);
    if (f === 0) { tx = w * 1.5; }
    else if (f === 1) { tx = -6; }
    else { tx = 0; }
  } else if (entryStyle === 'slide-right' && entryT < 1) {
    const f = Math.floor(entryT * 3);
    if (f === 0) { tx = -w * 1.5; }
    else if (f === 1) { tx = 6; }
    else { tx = 0; }
  } else if (entryStyle === 'slide-up' && entryT < 1) {
    const f = Math.floor(entryT * 3);
    if (f === 0) { ty = h * 1.5; }
    else if (f === 1) { ty = -6; }
    else { ty = 0; }
  }

  const cx = x + w / 2, cy = y + h / 2;
  ctx.translate(cx + tx, cy + ty);
  ctx.rotate(rotation);
  ctx.scale(sx, sy);
  ctx.translate(-w / 2, -h / 2);

  // ── shadow ────────────────────────────────────────────────────────────
  if (dropShadow) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur  = shadowBlur;
    ctx.shadowOffsetX = shadowOffX;
    ctx.shadowOffsetY = shadowOffY;
  }

  // ── paper-cut path mask ───────────────────────────────────────────────
  if (paperCut) {
    _tornMask(ctx, 0, 0, w, h, opts.seed || 42);
    ctx.clip();
  }

  // ── grayscale filter ──────────────────────────────────────────────────
  if (grayscale) {
    ctx.filter = 'grayscale(1) contrast(1.1)';
  }

  // ── draw image ────────────────────────────────────────────────────────
  ctx.drawImage(img, 0, 0, w, h);

  // ── tint overlay ──────────────────────────────────────────────────────
  if (tint) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur  = 0;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.filter = 'none';

  // ── border ────────────────────────────────────────────────────────────
  if (borderColor) {
    ctx.shadowColor   = 'transparent';
    ctx.shadowBlur    = 0;
    ctx.strokeStyle   = borderColor;
    ctx.lineWidth     = borderWidth;
    ctx.strokeRect(0, 0, w, h);
  }

  ctx.restore();
}

// ── torn paper mask ───────────────────────────────────────────────────────
function _tornMask(ctx, x, y, w, h, seed) {
  const rng = _mulberry(seed);
  const pts = 24;
  ctx.beginPath();
  ctx.moveTo(x, y);
  // top edge
  for (let i = 0; i <= pts; i++) {
    const px = x + (i / pts) * w;
    const py = y + (rng() - 0.5) * 10;
    ctx.lineTo(px, py);
  }
  // right edge
  for (let i = 0; i <= pts; i++) {
    const px = x + w + (rng() - 0.5) * 10;
    const py = y + (i / pts) * h;
    ctx.lineTo(px, py);
  }
  // bottom edge (reverse)
  for (let i = pts; i >= 0; i--) {
    const px = x + (i / pts) * w;
    const py = y + h + (rng() - 0.5) * 10;
    ctx.lineTo(px, py);
  }
  // left edge (reverse)
  for (let i = pts; i >= 0; i--) {
    const px = x + (rng() - 0.5) * 10;
    const py = y + (i / pts) * h;
    ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function _mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── boil animation (from vox-styled-reels analysis) ───────────────────────
// Reproduced sub-pixel jitter at 10fps for organic "living" feel
export function boilOffset(seedStr, frame, fps = 30, boilFps = 10, jitterPx = 1.2) {
  const boilFrame = Math.floor(frame / (fps / boilFps));
  const rng = _mulberry(_hashStr(seedStr + '-' + boilFrame));
  return {
    dx: (rng() * 2 - 1) * jitterPx,
    dy: (rng() * 2 - 1) * jitterPx,
  };
}

function _hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return h >>> 0;
}

// ── prop collage layout presets ───────────────────────────────────────────
// Place a prop at a named position within a W×H canvas
export function propPosition(preset, W, H, propW, propH) {
  const presets = {
    'center':          { x: (W - propW) / 2,          y: (H - propH) / 2 },
    'center-low':      { x: (W - propW) / 2,          y: H * 0.52 },
    'bottom-anchor':   { x: (W - propW) / 2,          y: H - propH - 40 },
    'top-right':       { x: W - propW - 40,            y: 160 },
    'top-left':        { x: 40,                        y: 160 },
    'bottom-right':    { x: W - propW - 40,            y: H - propH - 80 },
    'bottom-left':     { x: 40,                        y: H - propH - 80 },
    'mid-right':       { x: W - propW - 20,            y: (H - propH) / 2 },
    'mid-left':        { x: 20,                        y: (H - propH) / 2 },
    'hero-full':       { x: (W - propW) / 2,          y: (H - propH) / 2 - 60 },
    'upper-center':    { x: (W - propW) / 2,          y: H * 0.18 },
  };
  return presets[preset] || presets['center'];
}

// ── image loader (browser-side) ───────────────────────────────────────────
const _imgCache = {};
export function loadPropImage(src) {
  if (_imgCache[src]) return Promise.resolve(_imgCache[src]);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => { _imgCache[src] = img; resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

// ── scene-level prop renderer ─────────────────────────────────────────────
// Called from scene functions: draws a matched prop asset with full treatment
export async function renderPropAsset(ctx, propEntry, sceneT, W, H, overrides = {}) {
  if (!propEntry) return;

  const imagePath = '/' + propEntry.path;
  let img;
  try {
    img = await loadPropImage(imagePath);
  } catch (e) {
    return;  // graceful degradation if image fails to load
  }

  const aspect = img.naturalWidth / (img.naturalHeight || 1);
  const baseSize = overrides.size || Math.min(W * 0.55, H * 0.38);
  const propW = baseSize;
  const propH = baseSize / aspect;

  const placement = overrides.placement || propEntry.canvas_placement || 'center';
  const { x, y } = propPosition(placement, W, H, propW, propH);

  drawProp(ctx, img, {
    x, y, w: propW, h: propH,
    rotation: overrides.rotation || (Math.random() - 0.5) * 0.08,
    paperCut:   overrides.paperCut   ?? propEntry.has_transparency,
    dropShadow: overrides.dropShadow ?? true,
    entryT:     Math.min(1, sceneT * 6),
    entryStyle: overrides.entryStyle || 'slam',
    grayscale:  overrides.grayscale  || false,
    tint:       overrides.tint       || null,
    seed:       overrides.seed       || 7,
    ...overrides,
  });
}
