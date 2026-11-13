/**
 * OpusFlow Cinematic Transitions Library
 * 15+ named transitions, all deterministic, all frame-accurate.
 *
 * Usage:
 *   import { transition } from '/core/visual/transitions.js';
 *   // in render(t):
 *   if (t < SCENE_END) transition.wipeRight(ctx, prog, drawPrev, drawNext);
 */

import { clamp, seg, mulberry } from '/core/lib.js';

const W = () => document.getElementById('out').width;
const H = () => document.getElementById('out').height;


// ── Easing ───────────────────────────────────────────────────────────────────
const eio  = t => { t = clamp(t); return t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; };
const eo   = t => 1 - Math.pow(1 - clamp(t), 3);
const ei   = t => Math.pow(clamp(t), 3);
const back = (t, s = 2.0) => { t = clamp(t); const c1 = s, c2 = c1 + 1; return c2*t*t*t - c1*t*t; };


// ── Helper: draw both scenes, clip between ───────────────────────────────────
function withClip(ctx, clipFn, drawFn) {
  ctx.save();
  ctx.beginPath();
  clipFn();
  ctx.clip();
  drawFn();
  ctx.restore();
}


export const transition = {

  // Hard cut — no blend, just switches at p=0.5
  cut(ctx, p, drawA, drawB) {
    if (p < 0.5) drawA();
    else drawB();
  },

  // Wipe right: B slides in from left over A
  wipeRight(ctx, p, drawA, drawB) {
    const w = W(), h = H(), e = eio(p);
    drawA();
    withClip(ctx, () => { ctx.rect(0, 0, w * e, h); }, drawB);
  },

  // Wipe left
  wipeLeft(ctx, p, drawA, drawB) {
    const w = W(), h = H(), e = eio(p);
    drawA();
    withClip(ctx, () => { ctx.rect(w * (1-e), 0, w, h); }, drawB);
  },

  // Wipe up: B rises from bottom
  wipeUp(ctx, p, drawA, drawB) {
    const w = W(), h = H(), e = eio(p);
    drawA();
    withClip(ctx, () => { ctx.rect(0, h * (1-e), w, h); }, drawB);
  },

  // Iris — B appears through growing circle
  iris(ctx, p, drawA, drawB) {
    const w = W(), h = H();
    const r = Math.sqrt(w*w + h*h) * eio(p);
    drawA();
    withClip(ctx, () => {
      ctx.arc(w/2, h/2, r, 0, Math.PI*2);
    }, drawB);
  },

  // Torn paper wipe — jagged vertical edge
  tornWipe(ctx, p, drawA, drawB, seed = 42) {
    const w = W(), h = H();
    const rng = mulberry(seed);
    const e = eio(p);
    const edgeX = w * e;
    const amp = 32;

    drawA();
    withClip(ctx, () => {
      ctx.moveTo(edgeX, 0);
      const steps = 36;
      for (let i = 0; i <= steps; i++) {
        const y = h * i / steps;
        const jitter = (rng() - 0.5) * amp;
        ctx.lineTo(edgeX + jitter, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(w, 0);
    }, drawB);
  },

  // Shred — B appears through vertical strips
  shred(ctx, p, drawA, drawB, strips = 12) {
    const w = W(), h = H();
    const sw = w / strips;
    drawA();
    for (let i = 0; i < strips; i++) {
      // Each strip starts slightly offset
      const delay = (i / strips) * 0.4;
      const e = eio(clamp((p - delay) / 0.6));
      withClip(ctx, () => {
        ctx.rect(i * sw, h * (1 - e), sw + 1, h);
      }, drawB);
    }
  },

  // Flash → cut (white flash on cut)
  flash(ctx, p, drawA, drawB) {
    const w = W(), h = H();
    if (p < 0.5) {
      drawA();
      const a = p < 0.3 ? 0 : ei((p - 0.3) / 0.2);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(0, 0, w, h);
    } else {
      drawB();
      const a = eo(1 - p);  // fade from white
      ctx.fillStyle = `rgba(255,255,255,${eo(1 - (p - 0.5) / 0.4)})`;
      ctx.fillRect(0, 0, w, h);
    }
  },

  // Ink wash — dark ink floods frame, then recedes to reveal B
  inkWash(ctx, p, drawA, drawB, color = "#14213D") {
    const w = W(), h = H();
    if (p < 0.5) {
      drawA();
      const a = eio(p * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = a;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      const a = eio((p - 0.5) * 2);
      ctx.globalAlpha = a;
      drawB();
      ctx.globalAlpha = 1;
    }
  },

  // Morph scale — A shrinks while B grows from center
  scaleThrough(ctx, p, drawA, drawB) {
    const w = W(), h = H();
    const eA = 1 - ei(p);
    const eB = eo(p);
    if (p < 0.5) {
      ctx.save();
      ctx.translate(w/2, h/2);
      ctx.scale(eA, eA);
      ctx.translate(-w/2, -h/2);
      drawA();
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(w/2, h/2);
      ctx.scale(eB, eB);
      ctx.translate(-w/2, -h/2);
      drawB();
      ctx.restore();
    }
  },

  // Paper flip (page turn) — horizontal flip from A to B
  paperFlip(ctx, p, drawA, drawB) {
    const w = W(), h = H();
    const phase = p < 0.5 ? p * 2 : (p - 0.5) * 2;
    const scaleX = p < 0.5 ? 1 - phase : phase;
    ctx.save();
    ctx.translate(w/2, h/2);
    ctx.scale(scaleX, 1);
    ctx.translate(-w/2, -h/2);
    if (p < 0.5) drawA();
    else drawB();
    ctx.restore();
  },

  // Scanline — A dissolves out line by line
  scanline(ctx, p, drawA, drawB, lines = 48) {
    const w = W(), h = H();
    drawB();
    const lineH = h / lines;
    for (let i = 0; i < lines; i++) {
      const delay = i / lines * 0.6;
      const e = eo(clamp((p - delay) / 0.4));
      if (e < 1) {
        withClip(ctx, () => {
          ctx.rect(0, i * lineH, w, lineH * (1 - e));
        }, drawA);
      }
    }
  },

  // Particle dissolve — A breaks into dots, B materializes
  particleDissolve(ctx, p, drawA, drawB, seed = 7) {
    const w = W(), h = H();
    const rng = mulberry(seed);
    const grid = 20;
    const cw = w / grid, ch = h / grid;
    drawB();
    for (let gx = 0; gx < grid; gx++) {
      for (let gy = 0; gy < grid; gy++) {
        const delay = rng() * 0.6;
        const e = eo(clamp((p - delay) / 0.4));
        if (e < 1) {
          withClip(ctx, () => {
            ctx.rect(gx * cw, gy * ch, cw + 1, ch + 1);
          }, drawA);
        }
      }
    }
  },

  // Squeeze & pop — B squeezes in from top/bottom
  squeezeIn(ctx, p, drawA, drawB) {
    const w = W(), h = H();
    drawA();
    const e = back(p);
    const cy = h / 2;
    ctx.save();
    ctx.translate(0, cy);
    ctx.scale(1, e);
    ctx.translate(0, -cy);
    drawB();
    ctx.restore();
  },

  // Slide up — B slides up from below
  slideUp(ctx, p, drawA, drawB) {
    const h = H();
    const e = eio(p);
    drawA();
    ctx.save();
    ctx.translate(0, h * (1 - e));
    drawB();
    ctx.restore();
  },

  // Push right — both move: A exits left, B enters right
  pushRight(ctx, p, drawA, drawB) {
    const w = W();
    const e = eio(p);
    ctx.save();
    ctx.translate(-w * e, 0);
    drawA();
    ctx.restore();
    ctx.save();
    ctx.translate(w * (1 - e), 0);
    drawB();
    ctx.restore();
  },
};


// ── Transition scheduler ──────────────────────────────────────────────────────
/**
 * Manage transitions between scenes.
 * const mgr = new TransitionManager([
 *   { at: 4.0, dur: 0.5, type: "tornWipe" },
 *   { at: 8.5, dur: 0.4, type: "flash" },
 * ]);
 * // in render(t):
 * mgr.apply(ctx, t, drawScene1, drawScene2, drawScene3);
 */
export class TransitionManager {
  constructor(cues) {
    // cues: [{at, dur, type, ...opts}]
    this.cues = cues;
  }

  // Returns the active transition at time t, or null
  active(t) {
    for (const c of this.cues) {
      if (t >= c.at && t < c.at + c.dur) return c;
    }
    return null;
  }

  // Returns progress 0→1 for the active transition at t
  progress(t, cue) {
    return clamp((t - cue.at) / cue.dur);
  }
}
