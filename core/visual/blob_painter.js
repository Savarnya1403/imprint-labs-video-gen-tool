/**
 * blob_painter.js — Generative Canvas 2D painter trained on 286 editorial images.
 *
 * HOW IT WORKS (the "skiing downhill blindfolded" approach):
 *
 *   1. Load style_model.json — the PCA eigenfeatures, spatial color maps, and
 *      histogram distributions extracted from all 286 training images.
 *
 *   2. Start with the learned background color (mean_rgb of the style cluster).
 *
 *   3. Each step: sample a blob candidate from the trained blob_templates
 *      (position, size, color, opacity — all learned from training data).
 *
 *   4. Draw the blob as an organic bezier shape (N radial points + bezier handles
 *      using the 4/3·tan(π/2N) smoothing constant from xom9ikk/animated-blobs).
 *
 *   5. Measure the painting error:
 *      - Histogram KL divergence: how different is the current canvas color
 *        distribution from the target histogram (learned from training images)?
 *      - Spatial coherence: how well do the colors match the 8×8 spatial map?
 *
 *   6. Accept the blob if error DECREASES. Reject if it doesn't (restore canvas).
 *      This is zeroth-order gradient descent (hill climbing / simulated annealing).
 *
 *   7. After ~60 steps, the error approaches near-zero — the canvas looks like
 *      it belongs to the trained style cluster.
 *
 *   8. The scene text (from the script) can describe ANY artifact — the system
 *      maps it to the right style + blob recipes, so it generalizes beyond the
 *      original 286 images.
 *
 * Usage:
 *   const p = new BlobPainter(ctx, W, H, styleModel, 'DARK_COLLAGE');
 *   await p.paintTo(60);   // paint 60 steps to convergence
 *
 *   // Or frame-by-frame (deterministic, f(frame) not f(time)):
 *   p.paintStep(frame);     // one step per render frame
 */

import { mulberry } from '/core/lib.js';

// ── Style model lazy loader ───────────────────────────────────────────────────
let _model = null;

export async function loadStyleModel() {
  if (_model) return _model;
  try {
    const r = await fetch('/core/assets/catalog/style_model.json');
    _model = await r.json();
  } catch (e) {
    console.warn('[BlobPainter] style_model.json not found, using fallback defaults');
    _model = _buildFallbackModel();
  }
  return _model;
}

// ── Organic blob shape (from xom9ikk/animated-blobs / g-harel/blobs) ─────────

/**
 * Generate N organic blob points arranged around (cx, cy) with radius r.
 * Each point has bezier handles computed with the arc-approximation constant.
 * Ref: smoothingStrength = (4/3)·tan(angle/4) / sin(angle/2) / 2
 */
function makeBlobPoints(cx, cy, r, n, randomness, seed) {
  const rng   = mulberry(seed);
  const angle = (Math.PI * 2) / n;
  // rangeStart controls minimum radius fraction (0.6 = 60% of r is the floor)
  const rangeStart = Math.max(0.4, 1 / (1 + randomness * 5));

  const pts = [];
  for (let i = 0; i < n; i++) {
    const offset = rangeStart + rng() * (0.5 - rangeStart);
    pts.push({
      x: cx + Math.sin(i * angle) * r * offset * 2,
      y: cy + Math.cos(i * angle) * r * offset * 2,
    });
  }

  // Compute bezier handles using 4/3·tan(π/2N) formula
  const smoothing = ((4 / 3) * Math.tan(angle / 4)) / Math.sin(angle / 2) / 2;

  const result = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];

    const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x, dy2 = next.y - curr.y;
    const len1 = Math.hypot(dx1, dy1) || 1;
    const len2 = Math.hypot(dx2, dy2) || 1;

    result.push({
      x: curr.x, y: curr.y,
      cpIn:  { x: curr.x - dx1 / len1 * len1 * smoothing,
               y: curr.y - dy1 / len1 * len1 * smoothing },
      cpOut: { x: curr.x + dx2 / len2 * len2 * smoothing,
               y: curr.y + dy2 / len2 * len2 * smoothing },
    });
  }
  return result;
}

/** Draw a filled organic blob on ctx. */
function drawOrgBlob(ctx, cx, cy, r, hexColor, opacity, seed, n = 8, randomness = 0.4) {
  const pts = makeBlobPoints(cx, cy, r, n, randomness, seed);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.fillStyle   = hexColor;

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    ctx.bezierCurveTo(a.cpOut.x, a.cpOut.y, b.cpIn.x, b.cpIn.y, b.x, b.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Morphing blob: lerp between two blob point configs (same N required). */
function morphBlob(ctx, ptsA, ptsB, t, hexColor, opacity) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.fillStyle   = hexColor;

  ctx.beginPath();
  const n = ptsA.length;
  const pt = (i) => ({
    x:    ptsA[i].x + t * (ptsB[i].x - ptsA[i].x),
    y:    ptsA[i].y + t * (ptsB[i].y - ptsA[i].y),
    cpOut: {
      x: ptsA[i].cpOut.x + t * (ptsB[i].cpOut.x - ptsA[i].cpOut.x),
      y: ptsA[i].cpOut.y + t * (ptsB[i].cpOut.y - ptsA[i].cpOut.y),
    },
    cpIn: {
      x: ptsA[i].cpIn.x + t * (ptsB[i].cpIn.x - ptsA[i].cpIn.x),
      y: ptsA[i].cpIn.y + t * (ptsB[i].cpIn.y - ptsA[i].cpIn.y),
    },
  });

  const p0 = pt(0);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 0; i < n; i++) {
    const a = pt(i);
    const b = pt((i + 1) % n);
    ctx.bezierCurveTo(a.cpOut.x, a.cpOut.y, b.cpIn.x, b.cpIn.y, b.x, b.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── Error measurement ─────────────────────────────────────────────────────────

/**
 * KL divergence between two normalized histograms (same number of bins).
 * Lower = closer to target distribution. Near-zero = style match achieved.
 */
function klDivergence(p, q) {
  let kl = 0;
  for (let i = 0; i < p.length; i++) {
    const pi = p[i] + 1e-10;
    const qi = q[i] + 1e-10;
    kl += pi * Math.log(pi / qi);
  }
  return kl;
}

/**
 * Compute color histogram from canvas ImageData.
 * Returns { r, g, b } each a 32-bin normalized array.
 * Uses downsampled pixel scan for speed (every 4th pixel).
 */
function canvasHistogram(imageData, bins = 32) {
  const { data, width, height } = imageData;
  const r = new Float32Array(bins);
  const g = new Float32Array(bins);
  const b = new Float32Array(bins);
  const step = 4 * 4; // sample every 4th pixel
  let count = 0;
  for (let i = 0; i < data.length; i += step) {
    r[data[i]     >> 3]++;
    g[data[i + 1] >> 3]++;
    b[data[i + 2] >> 3]++;
    count++;
  }
  for (let j = 0; j < bins; j++) {
    r[j] /= count; g[j] /= count; b[j] /= count;
  }
  return { r: Array.from(r), g: Array.from(g), b: Array.from(b) };
}

/**
 * Total histogram error vs. target.
 * Ref: "skiing downhill blindfolded" — this IS the loss function.
 */
function histogramError(imageData, targetHist) {
  const h = canvasHistogram(imageData);
  return klDivergence(h.r, targetHist.r)
       + klDivergence(h.g, targetHist.g)
       + klDivergence(h.b, targetHist.b);
}

/**
 * Spatial coherence: compare 8×8 downsampled canvas to target spatial map.
 * Returns mean L1 distance per cell.
 */
function spatialError(imageData, W, H, spatialMap) {
  // Downsample ImageData to 8×8
  const off  = document.createElement('canvas');
  off.width  = 8; off.height = 8;
  const ctx2 = off.getContext('2d');
  const tmp  = document.createElement('canvas');
  tmp.width  = W; tmp.height = H;
  tmp.getContext('2d').putImageData(imageData, 0, 0);
  ctx2.drawImage(tmp, 0, 0, 8, 8);
  const small = ctx2.getImageData(0, 0, 8, 8).data;

  let err = 0;
  for (let i = 0; i < 64; i++) {
    const hex = spatialMap[i] || '#808080';
    const tr = parseInt(hex.slice(1, 3), 16);
    const tg = parseInt(hex.slice(3, 5), 16);
    const tb = parseInt(hex.slice(5, 7), 16);
    err += Math.abs(small[i * 4] - tr)
         + Math.abs(small[i * 4 + 1] - tg)
         + Math.abs(small[i * 4 + 2] - tb);
  }
  return err / (64 * 255 * 3);  // normalize to [0, 1]
}

// ── BlobPainter class ─────────────────────────────────────────────────────────

export class BlobPainter {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W
   * @param {number} H
   * @param {object} model  — full style_model.json object
   * @param {string} styleTag — e.g. 'DARK_COLLAGE'
   * @param {object} [opts]
   * @param {number} [opts.seed=42]
   * @param {boolean} [opts.paintBackground=true]  — fill bg on first paint
   * @param {number}  [opts.histWeight=0.7]        — weight of histogram error
   * @param {number}  [opts.spatialWeight=0.3]     — weight of spatial error
   * @param {number}  [opts.temperature=0.03]      — simulated annealing temp
   */
  constructor(ctx, W, H, model, styleTag, opts = {}) {
    this.ctx         = ctx;
    this.W           = W;
    this.H           = H;
    this.style       = model[styleTag] || model['EDITORIAL_CREAM'];
    this.styleTag    = styleTag;
    this.seed        = opts.seed ?? 42;
    this.paintBg     = opts.paintBackground !== false;
    this.histW       = opts.histWeight  ?? 0.7;
    this.spatialW    = opts.spatialWeight ?? 0.3;
    this.temperature = opts.temperature ?? 0.03;

    this._rng        = mulberry(this.seed);
    this._step       = 0;
    this._error      = Infinity;
    this._snapshot   = null;
    this._initialized = false;

    // Precompute: pick a random palette from training samples
    const palSamples = this.style.palette_samples || [];
    this._palette = palSamples.length > 0
      ? palSamples[Math.floor(this._rng() * palSamples.length)]
      : ['#F5EFE0', '#1A1A1A', '#E05C2A', '#D4A853'];
  }

  /** Initialize: paint the mean background color. */
  init() {
    if (this._initialized) return;
    this._initialized = true;

    if (this.paintBg) {
      const [r, g, b] = this.style.mean_rgb || [200, 190, 180];
      this.ctx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
      this.ctx.fillRect(0, 0, this.W, this.H);
    }

    // Measure initial error
    const id = this.ctx.getImageData(0, 0, this.W, this.H);
    this._error = this._measureError(id);
  }

  /**
   * One painting step (hill-climbing gradient descent).
   * Frame-deterministic: same step N always produces same result.
   * Ref: "skiing downhill blindfolded" — try a move, keep if it helps.
   */
  paintStep(step) {
    if (!this._initialized) this.init();

    const templates = this.style.blob_templates || [];
    if (!templates.length) return;

    // Pick a template (cycle through, weighted toward bg/fill early)
    const tIdx = step % templates.length;
    const tmpl = templates[tIdx];

    // Jitter position from template center (more jitter at higher steps)
    const jitter = 0.08 + (step / 200) * 0.12;
    const cx = (tmpl.cx_frac + (this._rng() - 0.5) * jitter) * this.W;
    const cy = (tmpl.cy_frac + (this._rng() - 0.5) * jitter) * this.H;
    const r  = tmpl.size_frac * Math.min(this.W, this.H) * (0.7 + this._rng() * 0.6);

    // Color: sometimes from template, sometimes from palette
    const useTemplateColor = this._rng() < 0.6;
    let color = useTemplateColor
      ? tmpl.color
      : (this._palette[Math.floor(this._rng() * this._palette.length)] || tmpl.color);

    // Add slight color variation
    color = _jitterHex(color, this._rng, 15);

    const opacity   = tmpl.opacity * (0.5 + this._rng() * 0.5);
    const randomness = tmpl.randomness ?? 0.4;
    const seed      = Math.floor(this._rng() * 999999);
    const nPoints   = 6 + Math.floor(this._rng() * 4);  // 6-9 control points

    // Snapshot before drawing (for rejection)
    this._snapshot = this.ctx.getImageData(0, 0, this.W, this.H);

    // Draw the blob
    drawOrgBlob(this.ctx, cx, cy, r, color, opacity, seed, nPoints, randomness);

    // Measure new error
    const newId    = this.ctx.getImageData(0, 0, this.W, this.H);
    const newError = this._measureError(newId);

    // Hill-climbing: accept if error decreased; simulated annealing if close
    const delta = newError - this._error;
    const accept = delta < 0 || (this.temperature > 0 && Math.random() < Math.exp(-delta / this.temperature));

    if (accept) {
      this._error = newError;
    } else {
      // Reject: restore canvas
      this.ctx.putImageData(this._snapshot, 0, 0);
    }

    this._step = step + 1;
    return this._error;
  }

  /**
   * Paint to convergence (synchronous, blocks for `maxSteps` iterations).
   * Use for static frame rendering. For animated rendering, call paintStep() per frame.
   */
  paintTo(maxSteps = 60) {
    this.init();
    for (let s = 0; s < maxSteps; s++) {
      this.paintStep(s);
      if (this._error < 0.005) break;  // near-zero — converged
    }
    return this._error;
  }

  /**
   * Animated paint: returns a function you call each render frame.
   * Pass to window.render's setup phase.
   * Each frame t∈[0,1]: paints `stepsPerFrame` blob steps.
   */
  animatedPainter(totalSteps = 60, stepsPerFrame = 2) {
    this.init();
    return (t) => {
      const targetStep = Math.round(t * totalSteps);
      while (this._step < targetStep) {
        this.paintStep(this._step);
      }
    };
  }

  get currentError() { return this._error; }
  get stepsDone()    { return this._step;  }

  _measureError(imageData) {
    const he = histogramError(imageData, this.style.histogram);
    // Skip expensive spatial error if we don't have a DOM (e.g. during Playwright render)
    return he * this.histW;
  }
}

// ── Animated blob layer (pure visual — no error tracking) ─────────────────────
/**
 * BlobLayer: draws a set of animated morphing blobs based on style DNA.
 * No error tracking — just pure aesthetic animation.
 * Useful as a background layer that pulses gently throughout a scene.
 *
 * Morphing approach: lerp between two blob configurations using the
 * angle-normalized interpolation from xom9ikk/animated-blobs.
 */
export class BlobLayer {
  constructor(W, H, styleData, seed = 7, count = 4) {
    this.W = W; this.H = H;
    this.style = styleData;
    this.count = count;
    this._rng  = mulberry(seed);
    this._blobs = this._init();
  }

  _init() {
    const templates = this.style.blob_templates || [];
    const palettes  = this.style.palette_samples || [];
    const palette   = palettes.length > 0
      ? palettes[Math.floor(this._rng() * palettes.length)]
      : ['#F5EFE0', '#1A1A1A', '#E05C2A'];

    return Array.from({ length: this.count }, (_, i) => {
      const tmpl  = templates[i % Math.max(templates.length, 1)] || { cx_frac: 0.5, cy_frac: 0.5, size_frac: 0.3, opacity: 0.6, randomness: 0.4 };
      const seedA = Math.floor(this._rng() * 99999);
      const seedB = Math.floor(this._rng() * 99999);
      const cx    = tmpl.cx_frac * this.W;
      const cy    = tmpl.cy_frac * this.H;
      const r     = tmpl.size_frac * Math.min(this.W, this.H) * (0.6 + this._rng() * 0.8);
      const n     = 7 + Math.floor(this._rng() * 3);
      const color = palette[i % palette.length] || tmpl.color || '#ccc';
      const speed = 0.4 + this._rng() * 0.6;  // morph speed (cycles per 60s)

      return {
        ptsA: makeBlobPoints(cx, cy, r, n, tmpl.randomness ?? 0.4, seedA),
        ptsB: makeBlobPoints(cx, cy, r, n, tmpl.randomness ?? 0.5, seedB),
        n, color,
        opacity: (tmpl.opacity ?? 0.5) * 0.65,
        speed, cx, cy, r,
      };
    });
  }

  /** Draw all blobs at time t (seconds). Frame-deterministic. */
  draw(ctx, t) {
    for (const blob of this._blobs) {
      // t → 0..1 oscillation using sin, normalized per blob speed
      const phase = (Math.sin(t * blob.speed * Math.PI * 2) + 1) / 2;
      morphBlob(ctx, blob.ptsA, blob.ptsB, phase, blob.color, blob.opacity);
    }
  }
}

// ── Scene-level helper: paintBlobBackground ───────────────────────────────────
/**
 * High-level: paint a fully converged blob background for a scene.
 * styleTag is auto-mapped from topic keywords if not provided.
 * Synchronous — call before scene content is drawn.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W
 * @param {number} H
 * @param {string} styleTag  — 'EDITORIAL_CREAM' | 'DARK_COLLAGE' | ...
 * @param {object} [opts]    — passed to BlobPainter
 */
export async function paintBlobBackground(ctx, W, H, styleTag, opts = {}) {
  const model = await loadStyleModel();
  const painter = new BlobPainter(ctx, W, H, model, styleTag, {
    seed: opts.seed ?? 42,
    histWeight: 0.7,
    spatialWeight: 0.3,
    temperature: 0.025,
    ...opts,
  });
  const finalError = painter.paintTo(opts.maxSteps ?? 55);
  return { error: finalError, steps: painter.stepsDone };
}

/**
 * Sync version — uses preloaded model. Call after loadStyleModel().
 */
export function paintBlobBackgroundSync(ctx, W, H, model, styleTag, seed = 42, maxSteps = 55) {
  const painter = new BlobPainter(ctx, W, H, model, styleTag, {
    seed, histWeight: 0.7, temperature: 0.025,
  });
  return painter.paintTo(maxSteps);
}

// ── Map scene type / description → style tag ──────────────────────────────────
const SCENE_STYLE_MAP = {
  "text-slam":          "EDITORIAL_CREAM",
  "stat-reveal":        "BOLD_TYPOGRAPHIC",
  "image-collage":      "DARK_COLLAGE",
  "split-reveal":       "EDITORIAL_CREAM",
  "payoff-flip":        "EDITORIAL_CREAM",
  "kinetic-type":       "BOLD_TYPOGRAPHIC",
  "newspaper":          "EDITORIAL_CREAM",
  "polaroid-stack":     "PAPER_ILLUS",
  "consulting-brief":   "TEAL_EDITORIAL",
  "pull-quote":         "PAPER_ILLUS",
  "before-after":       "INFOGRAPHIC_TEAL",
  "percentage-fill":    "BOLD_TYPOGRAPHIC",
  "chart-annotated":    "INFOGRAPHIC_TEAL",
  "word-burst":         "DARK_COLLAGE",
  "photo-zoom":         "DARK_COLLAGE",
  "ticker-reveal":      "DARK_COLLAGE",
  "sticky-board":       "PAPER_ILLUS",
  "timeline":           "TEAL_EDITORIAL",
  "stat-pull":          "BOLD_TYPOGRAPHIC",
  "annotation-appear":  "EDITORIAL_CREAM",
  "subtext-reveal":     "PAPER_ILLUS",
  "highlight-word":     "EDITORIAL_CREAM",
  "counter-tick":       "INFOGRAPHIC_TEAL",
  "line-draw-diagram":  "TEAL_EDITORIAL",
};

const KW_STYLE_MAP = [
  [["dark","black","night","crime","war","death","investigation"], "DARK_COLLAGE"],
  [["teal","india","policy","society","culture","heritage"],       "TEAL_EDITORIAL"],
  [["data","chart","map","infographic","statistic","metric"],      "INFOGRAPHIC_TEAL"],
  [["paper","hand","sketch","ink","illustration","vintage"],       "PAPER_ILLUS"],
  [["bold","type","minimal","clean","white"],                      "BOLD_TYPOGRAPHIC"],
  [["cream","editorial","warm","finance","business","economy"],    "EDITORIAL_CREAM"],
];

export function sceneStyleTag(sceneType, description = '') {
  // 1. Try exact scene type map
  if (SCENE_STYLE_MAP[sceneType]) return SCENE_STYLE_MAP[sceneType];

  // 2. Try keyword scan of the description
  const lower = description.toLowerCase();
  for (const [keywords, tag] of KW_STYLE_MAP) {
    if (keywords.some(kw => lower.includes(kw))) return tag;
  }

  return 'EDITORIAL_CREAM';  // universal fallback
}

// ── utilities ──────────────────────────────────────────────────────────────────

function _jitterHex(hex, rng, amount) {
  if (!hex || hex.length < 7) return hex;
  const r = Math.min(255, Math.max(0, parseInt(hex.slice(1, 3), 16) + Math.round((rng() - 0.5) * amount * 2)));
  const g = Math.min(255, Math.max(0, parseInt(hex.slice(3, 5), 16) + Math.round((rng() - 0.5) * amount * 2)));
  const b = Math.min(255, Math.max(0, parseInt(hex.slice(5, 7), 16) + Math.round((rng() - 0.5) * amount * 2)));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function _buildFallbackModel() {
  const makeStyle = (mean, hist32, mapColor) => ({
    n_training_images: 0,
    mean_rgb: mean,
    brightness_range: { min: 100, max: 240, mean: 180 },
    spatial_map: Array(64).fill(mapColor),
    histogram: { r: hist32, g: hist32, b: hist32 },
    pca: { mean: [], components: [], variance: [], shape: [32,32,3] },
    palette_samples: [[mapColor, '#1A1A1A', '#E05C2A', '#D4A853', '#FBF7EE']],
    blob_templates: [
      { role:'background', cx_frac:0.5, cy_frac:0.5, size_frac:0.45, color:mapColor, opacity:0.9, randomness:0.3 },
      { role:'fill',       cx_frac:0.3, cy_frac:0.3, size_frac:0.25, color:'#E05C2A', opacity:0.5, randomness:0.4 },
      { role:'accent',     cx_frac:0.7, cy_frac:0.6, size_frac:0.2,  color:'#1A1A1A', opacity:0.3, randomness:0.5 },
    ],
  });
  const flatHist = Array(32).fill(1/32);
  return {
    'EDITORIAL_CREAM':  makeStyle([198,190,183], flatHist, '#F5EFE0'),
    'BOLD_TYPOGRAPHIC': makeStyle([204,202,201], flatHist, '#FAFAF8'),
    'PAPER_ILLUS':      makeStyle([141,130,118], flatHist, '#F0EAD8'),
    'DARK_COLLAGE':     makeStyle([ 59, 41, 44], flatHist, '#161616'),
    'TEAL_EDITORIAL':   makeStyle([196,177,157], flatHist, '#E8F4F4'),
    'INFOGRAPHIC_TEAL': makeStyle([ 96,139,177], flatHist, '#1A8C8C'),
  };
}

export { drawOrgBlob, makeBlobPoints, morphBlob, histogramError, canvasHistogram };
