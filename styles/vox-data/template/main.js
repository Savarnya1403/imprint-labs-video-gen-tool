/**
 * OpusFlow — Vox-Data Style
 * Dark-screen data journalism: Bloomberg terminal meets NYT graphics desk.
 * White text on deep navy/charcoal, animated data visualizations, clean grid.
 *
 * Injected by director:
 *   window.__FILM_DATA__  — { theme, logline, scenes[], subtitles[], transitions[], data_points[] }
 *   window.__TIMELINE__   — { FPS, dur, scenes[{id,start,end,frames}] }
 */

import { clamp, lerp, seg, ss, eio, eo, back, spring, mulberry } from '/core/lib.js';
import { getTheme, FONTS, scaleSizes, grid, shadow, clearShadow, wrapText, textBlock } from '/core/visual/design-system.js';
import { TransitionManager } from '/core/visual/transitions.js';
import { barChart, lineChart, counter, statCard, donutChart, progressBar, timeline as tlChart } from '/core/visual/infographics.js';
import { ParticleSystem, floatingDots } from '/core/visual/particles.js';
import { paperTexture, vignette, lightLeak, halftone } from '/core/visual/cinema.js';

const W = 1080, H = 1920;

// ── Film data ─────────────────────────────────────────────────────────────────
const FILM_DATA = window.__FILM_DATA__ || {
  theme: "dark-editorial",
  logline: "Data tells the story.",
  scenes: [
    { id: "s1", vo: "The numbers don't lie.", visual: "text", data: null,
      image_query: null, duration_hint: 4 },
    { id: "s2", vo: "Here's what the data shows.", visual: "bar",
      data: { type: "bar", values: [42, 78, 55, 91, 33], labels: ["A","B","C","D","E"], unit: "%" },
      image_query: null, duration_hint: 6 },
    { id: "s3", vo: "The trend is clear.", visual: "line",
      data: { type: "line", values: [10, 25, 18, 44, 61, 55, 80], labels: ["2018","2019","2020","2021","2022","2023","2024"] },
      image_query: null, duration_hint: 6 },
    { id: "s4", vo: "One number changes everything.", visual: "counter",
      data: { type: "counter", value: 157000000000, prefix: "$", label: "Valuation" },
      image_query: null, duration_hint: 5 },
  ],
  subtitles: [],
  transitions: [],
  data_points: [],
};

const TL = window.__TIMELINE__ || (() => {
  const FPS = 30;
  let t = 0;
  const sc = FILM_DATA.scenes.map(s => {
    const frames = Math.ceil((s.duration_hint||5) * FPS) + 12;
    const r = { id: s.id, start: t, end: t + frames/FPS, frames };
    t += frames/FPS;
    return r;
  });
  return { FPS, dur: t, scenes: sc };
})();

// ── Theme ─────────────────────────────────────────────────────────────────────
const TH = getTheme("dark-editorial");
const SZ = scaleSizes(W, H);
const G  = grid(W, H);

// ── Transition manager ────────────────────────────────────────────────────────
const TM = new TransitionManager(FILM_DATA.transitions || []);

// ── Image loading ─────────────────────────────────────────────────────────────
const IMGS = {};
let READY   = false;

function loadImages() {
  const queries = FILM_DATA.scenes
    .map(s => s.image)
    .filter(Boolean);

  if (queries.length === 0) { READY = true; return; }

  let pending = queries.length;
  queries.forEach(src => {
    const img = new Image();
    img.onload  = () => { if (--pending === 0) READY = true; };
    img.onerror = () => { if (--pending === 0) READY = true; };
    img.src = src;
    IMGS[src] = img;
  });
}

// ── Particle systems (pre-built per scene) ────────────────────────────────────
const PARTICLES = {};
FILM_DATA.scenes.forEach((s, i) => {
  PARTICLES[s.id] = floatingDots(0, H * 0.6, W, H, "#00D4FF", i * 7 + 11);
});

// ── Drawing helpers ───────────────────────────────────────────────────────────
const ctx = document.getElementById("out").getContext("2d");

function bg(fillColor) {
  ctx.fillStyle = fillColor;
  ctx.fillRect(0, 0, W, H);
}

function gridLines(alpha = 0.04) {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = 1;
  // Vertical
  for (let x = G.gutter; x < W; x += G.col + G.gutter) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  // Horizontal thirds
  [H/3, H*2/3].forEach(y => {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  });
  ctx.restore();
}

function tickerBar(t, label) {
  const y = 110;
  ctx.fillStyle = "#00D4FF";
  ctx.fillRect(0, y - 2, W * clamp(t * 2, 0, 1), 2);

  ctx.fillStyle = "rgba(0,212,255,0.08)";
  ctx.fillRect(0, 0, W, y);

  ctx.font = `600 28px ${FONTS.mono || "'AR', monospace"}`;
  ctx.fillStyle = "#00D4FF";
  ctx.fillText(label.toUpperCase(), G.safe, 72);
}

function headline(text, y, t, opts = {}) {
  const { color = "#FFFFFF", size = SZ.h1, align = "left" } = opts;
  const prog = clamp(t * 2.5, 0, 1);
  const eo_p = eo(prog);
  ctx.save();
  ctx.globalAlpha = eo_p;
  ctx.translate(0, (1 - eo_p) * 30);
  ctx.font = `900 ${size}px AB`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  wrapText(ctx, text, align === "center" ? W/2 : G.safe, y,
           W - G.safe*2, size * 1.15, { maxLines: 4 });
  ctx.restore();
}

function dataLabel(value, label, x, y, t) {
  const prog = clamp(t * 2, 0, 1);
  ctx.save();
  ctx.globalAlpha = eo(prog);
  ctx.font = `900 96px AB`;
  ctx.fillStyle = "#00D4FF";
  ctx.textAlign = "left";
  ctx.fillText(value, x, y);
  ctx.font = `400 32px AR`;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(label.toUpperCase(), x, y + 44);
  ctx.restore();
}

function sourceTag(text, t) {
  const prog = clamp(t - 2, 0, 1);
  ctx.save();
  ctx.globalAlpha = clamp(prog * 3, 0, 0.5);
  ctx.font = `400 22px AR`;
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.textAlign = "right";
  ctx.fillText(`SOURCE: ${text.toUpperCase()}`, W - G.safe, H - 60);
  ctx.restore();
}

function drawSubtitles(t) {
  const subs = FILM_DATA.subtitles || [];
  const active = subs.filter(s => t >= s.a && t < s.b);
  if (!active.length) return;
  const sub = active[active.length - 1];

  ctx.save();
  ctx.font = `400 38px AR`;
  ctx.textAlign = "center";

  // measure for bg pill
  const mw = ctx.measureText(sub.text).width;
  const ph = 52, pw = mw + 48;
  const sx = (W - pw) / 2, sy = H - 180;

  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.beginPath();
  ctx.roundRect(sx, sy, pw, ph, 8);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(sub.text, W/2, sy + ph * 0.70);
  ctx.restore();
}

// ── Scene renderers ───────────────────────────────────────────────────────────

function sceneTitle(scene, t, tl) {
  const dur = tl.end - tl.start;
  const lt  = t - tl.start;

  bg("#0D1117");
  gridLines();

  // Animated line under headline
  const lineW = W * clamp(lt * 1.5, 0, 1) * 0.75;
  ctx.fillStyle = "#00D4FF";
  ctx.fillRect(G.safe, H * 0.38 - 6, lineW, 3);

  headline(scene.vo || "Data Story", H * 0.38, lt, { size: SZ.h1, color: "#FFFFFF" });

  tickerBar(lt / dur, FILM_DATA.logline || "OpusFlow");

  if (scene.data_point) {
    const v = scene.data_point.value;
    const lbl = scene.data_point.label;
    dataLabel(v, lbl, G.safe, H * 0.60, lt);
  }

  PARTICLES[scene.id]?.draw(ctx, lt);
  vignette(ctx, W, H, 0.5, "#000000");
  paperTexture(ctx, 0, 0, W, H, 7, 0.02);
}

function sceneBarViz(scene, t, tl) {
  const lt = t - tl.start;

  bg("#0D1117");
  gridLines(0.03);
  tickerBar(lt / (tl.end - tl.start), scene.id);

  headline(scene.vo || "", H * 0.18, lt, { size: SZ.h2, color: "#FFFFFF" });

  const data = scene.data || {};
  if (data.values) {
    const labels = data.labels || data.values.map((_, i) => i+1+'');
    const unit   = data.unit || '';
    barChart(ctx, data.values, G.safe, H * 0.32, W - G.safe*2, H * 0.38,
             clamp(lt - 0.5, 0, 1), {
               labels,
               barColor: "#00D4FF",
               axisColor: "rgba(255,255,255,0.3)",
               labelColor: "rgba(255,255,255,0.7)",
               valueColor: "#FFFFFF",
               unit,
               fontSize: 28,
             });
  }

  PARTICLES[scene.id]?.draw(ctx, lt);
  vignette(ctx, W, H, 0.4, "#000000");
}

function sceneLineViz(scene, t, tl) {
  const lt = t - tl.start;

  bg("#0D1117");
  gridLines(0.025);
  tickerBar(lt / (tl.end - tl.start), scene.id);

  headline(scene.vo || "", H * 0.16, lt, { size: SZ.h2, color: "#FFFFFF" });

  const data = scene.data || {};
  if (data.values) {
    lineChart(ctx, data.values, G.safe, H * 0.30, W - G.safe*2, H * 0.40,
              clamp(lt - 0.3, 0, 1), {
                labels: data.labels,
                lineColor: "#00D4FF",
                fillColor: "rgba(0,212,255,0.08)",
                dotColor: "#FFFFFF",
                axisColor: "rgba(255,255,255,0.25)",
                labelColor: "rgba(255,255,255,0.6)",
                fontSize: 26,
              });
  }

  vignette(ctx, W, H, 0.4, "#000000");
}

function sceneCounter(scene, t, tl) {
  const lt = t - tl.start;

  bg("#0D1117");
  gridLines(0.03);
  tickerBar(lt / (tl.end - tl.start), scene.id);

  const data = scene.data || {};
  const target = data.value || 0;
  const prefix = data.prefix || "";
  const lbl    = data.label  || "";

  counter(ctx, target, W/2, H * 0.52, clamp(lt - 0.3, 0, 1), {
    prefix,
    color: "#FFFFFF",
    accentColor: "#00D4FF",
    fontSize: 112,
    mode: "smooth",
    align: "center",
  });

  // Label below
  const prog = clamp(lt - 0.6, 0, 1);
  ctx.save();
  ctx.globalAlpha = eo(prog);
  ctx.font = `400 36px AR`;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.textAlign = "center";
  ctx.fillText(lbl.toUpperCase(), W/2, H * 0.52 + 68);
  ctx.restore();

  // Animated ring
  const prog2 = clamp(lt * 0.8, 0, 1);
  ctx.save();
  ctx.strokeStyle = "rgba(0,212,255,0.15)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(W/2, H * 0.52 - 50, 180 + prog2 * 20, -Math.PI/2, -Math.PI/2 + prog2 * Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  PARTICLES[scene.id]?.draw(ctx, lt);
  vignette(ctx, W, H, 0.5, "#000000");
}

function sceneGenericData(scene, t, tl) {
  const lt = t - tl.start;

  bg("#0D1117");
  gridLines(0.025);
  tickerBar(lt / (tl.end - tl.start), scene.id);

  headline(scene.vo || "", H * 0.25, lt, { size: SZ.h2, color: "#FFFFFF" });

  // Show image if available
  const img = scene.image ? IMGS[scene.image] : null;
  if (img) {
    const iw = W - G.safe * 2;
    const ih = iw * 0.5;
    const ix = G.safe, iy = H * 0.42;
    ctx.save();
    ctx.globalAlpha = clamp(lt * 1.5, 0, 0.75);
    // Clip to rounded rect
    ctx.beginPath();
    ctx.roundRect(ix, iy, iw, ih, 4);
    ctx.clip();
    ctx.drawImage(img, ix, iy, iw, ih);
    ctx.restore();
    // Overlay tint
    ctx.fillStyle = "rgba(0,212,255,0.08)";
    ctx.fillRect(ix, iy, iw, ih);
  }

  if (scene.data_points?.length) {
    scene.data_points.slice(0, 3).forEach((dp, i) => {
      statCard(ctx, G.safe, H * 0.72 + i * 160, W - G.safe*2, 140, {
        value: dp.value,
        label: dp.label,
        trend: dp.trend,
        accentColor: "#00D4FF",
        bg: "rgba(255,255,255,0.03)",
        textColor: "#FFFFFF",
        subColor: "rgba(255,255,255,0.5)",
      }, clamp(lt - 0.3 - i * 0.15, 0, 1));
    });
  }

  PARTICLES[scene.id]?.draw(ctx, lt);
  vignette(ctx, W, H, 0.4, "#000000");
}

// ── Dispatch ──────────────────────────────────────────────────────────────────
function dispatchScene(idx, t) {
  const scene = FILM_DATA.scenes[idx];
  if (!scene) return;
  const tl = TL.scenes[idx];
  if (!tl) return;

  const visual = scene.visual || scene.data?.type || "text";

  switch (visual) {
    case "bar":     sceneBarViz(scene, t, tl); break;
    case "line":    sceneLineViz(scene, t, tl); break;
    case "counter": sceneCounter(scene, t, tl); break;
    case "text":    sceneTitle(scene, t, tl);   break;
    default:        sceneGenericData(scene, t, tl);
  }

  sourceTag(FILM_DATA.logline || "OpusFlow", t - tl.start);
  drawSubtitles(t);
}

function getActiveScene(t) {
  for (let i = TL.scenes.length - 1; i >= 0; i--) {
    if (t >= TL.scenes[i].start) return i;
  }
  return 0;
}

// ── Main render ───────────────────────────────────────────────────────────────
window.render = function(t) {
  if (!READY) {
    bg("#0D1117");
    ctx.fillStyle = "#00D4FF";
    ctx.font = `400 32px AR`;
    ctx.textAlign = "center";
    ctx.fillText("Loading…", W/2, H/2);
    return;
  }

  const idx = getActiveScene(t);
  const handled = TM.render(ctx, t, W, H,
    (ctx2, t2) => dispatchScene(idx, t2),
    (ctx2, t2) => { const ni = Math.min(idx+1, TL.scenes.length-1); dispatchScene(ni, t2); }
  );
  if (!handled) dispatchScene(idx, t);
};

window.DUR = TL.dur;

document.fonts.ready.then(() => {
  loadImages();
  if (typeof window.onReady === "function") window.onReady();
});
