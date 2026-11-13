/**
 * OpusFlow Particle System
 * Lightweight, deterministic particle engine for Canvas 2D.
 * All particles are seeded — same seed = same animation every frame.
 */

import { mulberry } from '/core/lib.js';

const clamp = (x, a=0, b=1) => Math.max(a, Math.min(b, x));


export class ParticleSystem {
  /**
   * @param {object} config
   *   seed       — PRNG seed (deterministic)
   *   count      — number of particles
   *   origin     — { x, y } or { x0, y0, x1, y1 } (rect spawn area)
   *   velocity   — { x: [min,max], y: [min,max] }
   *   gravity    — y acceleration (px/s²), default 0
   *   drag       — friction 0–1, default 0.98
   *   life       — [minSecs, maxSecs]
   *   size       — [minPx, maxPx] at birth, shrinks to 0 at death
   *   color      — hex string | array of hex strings
   *   shape      — "circle" | "square" | "torn" | "dot"
   *   blend      — Canvas globalCompositeOperation
   *   burst      — if true, all spawn at t=0; else stagger over spawnDur
   *   spawnDur   — seconds over which particles spawn (if !burst)
   */
  constructor(config = {}) {
    this.cfg = {
      seed: 42, count: 60,
      origin: { x: 0, y: 0 },
      velocity: { x: [-50, 50], y: [-200, -50] },
      gravity: 300, drag: 0.97,
      life: [0.5, 1.5],
      size: [4, 14],
      color: "#B8312A",
      shape: "circle",
      blend: "source-over",
      burst: true, spawnDur: 1.0,
      ...config,
    };
    this._particles = [];
    this._init();
  }

  _init() {
    const { cfg } = this;
    const rng = mulberry(cfg.seed);

    for (let i = 0; i < cfg.count; i++) {
      const spawnT = cfg.burst ? 0 : rng() * cfg.spawnDur;
      const ox = cfg.origin.x0 != null
        ? cfg.origin.x0 + rng() * (cfg.origin.x1 - cfg.origin.x0)
        : cfg.origin.x + (rng() - 0.5) * (cfg.origin.spread || 0);
      const oy = cfg.origin.y0 != null
        ? cfg.origin.y0 + rng() * (cfg.origin.y1 - cfg.origin.y0)
        : cfg.origin.y + (rng() - 0.5) * (cfg.origin.spread || 0);

      const [vxMin, vxMax] = cfg.velocity.x;
      const [vyMin, vyMax] = cfg.velocity.y;
      const color = Array.isArray(cfg.color)
        ? cfg.color[Math.floor(rng() * cfg.color.length)]
        : cfg.color;

      this._particles.push({
        spawnT,
        x0: ox, y0: oy,
        vx: vxMin + rng() * (vxMax - vxMin),
        vy: vyMin + rng() * (vyMax - vyMin),
        life: cfg.life[0] + rng() * (cfg.life[1] - cfg.life[0]),
        size: cfg.size[0] + rng() * (cfg.size[1] - cfg.size[0]),
        color,
        rot: rng() * Math.PI * 2,
        rotV: (rng() - 0.5) * 8,
      });
    }
  }

  draw(ctx, t) {
    const { cfg } = this;
    ctx.save();
    if (cfg.blend !== "source-over") ctx.globalCompositeOperation = cfg.blend;

    for (const p of this._particles) {
      const lt = t - p.spawnT;
      if (lt < 0 || lt > p.life) continue;

      const prog = lt / p.life;
      const alpha = prog < 0.1 ? prog / 0.1 : 1 - (prog - 0.1) / 0.9;
      if (alpha <= 0) continue;

      // Physics: position from velocity + gravity + drag
      const dt   = lt;
      const dragFactor = Math.pow(cfg.drag, lt * 60); // approximate continuous drag
      const px   = p.x0 + p.vx * dt * dragFactor;
      const py   = p.y0 + p.vy * dt * dragFactor + 0.5 * cfg.gravity * dt * dt;
      const size = p.size * (1 - prog * 0.6);
      const rot  = p.rot + p.rotV * lt;

      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.translate(px, py);
      ctx.rotate(rot);
      ctx.fillStyle = p.color;

      switch (cfg.shape) {
        case "circle":
          ctx.beginPath();
          ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "square":
          ctx.fillRect(-size / 2, -size / 2, size, size);
          break;
        case "torn":
          // Small torn paper scrap
          ctx.beginPath();
          ctx.moveTo(-size/2, -size/4);
          ctx.lineTo(size/3, -size/2);
          ctx.lineTo(size/2, size/4);
          ctx.lineTo(-size/4, size/2);
          ctx.closePath();
          ctx.fill();
          break;
        case "dot":
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(1.5, size / 3), 0, Math.PI * 2);
          ctx.fill();
          break;
      }
      ctx.restore();
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}


// ── Pre-made particle effects ─────────────────────────────────────────────────

export function confettiBurst(cx, cy, seed = 1) {
  return new ParticleSystem({
    seed,
    count: 80,
    origin: { x: cx, y: cy, spread: 20 },
    velocity: { x: [-180, 180], y: [-320, -60] },
    gravity: 500, drag: 0.96,
    life: [0.8, 2.0],
    size: [5, 14],
    color: ["#B8312A", "#F2C230", "#14213D", "#4ECDC4", "#FF8B94"],
    shape: "torn",
    burst: true,
  });
}

export function paperShreds(x0, y0, x1, y1, seed = 2) {
  return new ParticleSystem({
    seed,
    count: 50,
    origin: { x0, y0, x1, y1 },
    velocity: { x: [-40, 40], y: [-80, 20] },
    gravity: 200, drag: 0.98,
    life: [1.0, 2.5],
    size: [6, 20],
    color: ["#F1E6D0", "#FBF7EE", "#E8DCC8"],
    shape: "torn",
    burst: true,
  });
}

export function dustCloud(cx, cy, color = "#D4C5A9", seed = 3) {
  return new ParticleSystem({
    seed,
    count: 40,
    origin: { x: cx, y: cy, spread: 60 },
    velocity: { x: [-60, 60], y: [-40, 40] },
    gravity: 0, drag: 0.94,
    life: [0.6, 1.4],
    size: [3, 10],
    color,
    shape: "dot",
    blend: "multiply",
    burst: true,
  });
}

export function floatingDots(x0, y0, x1, y1, color = "#F2C230", seed = 4) {
  return new ParticleSystem({
    seed,
    count: 30,
    origin: { x0, y0, x1, y1 },
    velocity: { x: [-15, 15], y: [-30, -5] },
    gravity: 0, drag: 0.99,
    life: [1.5, 3.5],
    size: [3, 8],
    color,
    shape: "circle",
    burst: false,
    spawnDur: 2.0,
  });
}
