/**
 * OpusFlow — Vox-Dark Style
 * Cinematic investigative documentary: near-black canvas, photo composites,
 * high-contrast type, red accent, slow burn pacing.
 *
 * Injected by director:
 *   window.__FILM_DATA__  — { theme, logline, scenes[], subtitles[], transitions[], data_points[] }
 *   window.__TIMELINE__   — { FPS, dur, scenes[{id,start,end,frames}] }
 */

import { clamp, lerp, seg, ss, eio, eo, back, spring, mulberry } from '/core/lib.js';
import { getTheme, FONTS, scaleSizes, grid, shadow, clearShadow, wrapText } from '/core/visual/design-system.js';
import { TransitionManager } from '/core/visual/transitions.js';
import { statCard, counter, barChart } from '/core/visual/infographics.js';
import { ParticleSystem, dustCloud } from '/core/visual/particles.js';
import { paperTexture, vignette, lightLeak, halftone, tornStrip, tape } from '/core/visual/cinema.js';

const W = 1080, H = 1920;
const ACCENT = "#C0392B";   // deep crimson
const OFF_WHITE = "#F0EDE8";
const MID_GREY = "#8A8580";
const NEAR_BLACK = "#0A0A0A";

const FILM_DATA = window.__FILM_DATA__ || {
  theme: "dark-editorial",
  logline: "Some stories demand to be told.",
  scenes: [
    { id: "s1", vo: "Every year, 150,000 people die on Indian roads.", visual: "reveal",
      data: { label: "Road Deaths", value: 150000, unit: "/year" }, duration_hint: 5 },
    { id: "s2", vo: "It's not an accident. It's a policy failure.", visual: "text",
      duration_hint: 5 },
    { id: "s3", vo: "Here's why.", visual: "photo", duration_hint: 6 },
  ],
  subtitles: [],
  transitions: [
    { at: 4.4, dur: 0.5, type: "flash", seed: 1 },
  ],
  data_points: [],
};

const TL = window.__TIMELINE__ || (() => {
  const FPS = 30; let t = 0;
  const sc = FILM_DATA.scenes.map(s => {
    const frames = Math.ceil((s.duration_hint||5)*FPS) + 12;
    const r = { id: s.id, start: t, end: t+frames/FPS, frames };
    t += frames/FPS; return r;
  });
  return { FPS, dur: t, scenes: sc };
})();

const TH = getTheme("dark-editorial");
const SZ = scaleSizes(W, H);
const G  = grid(W, H);
const TM = new TransitionManager(FILM_DATA.transitions || []);

const IMGS = {}; let READY = false;
function loadImages() {
  const srcs = FILM_DATA.scenes.map(s => s.image).filter(Boolean);
  if (!srcs.length) { READY = true; return; }
  let pending = srcs.length;
  srcs.forEach(src => {
    const img = new Image();
    img.onload = img.onerror = () => { if (--pending === 0) READY = true; };
    img.src = src; IMGS[src] = img;
  });
}

const DUST = {};
FILM_DATA.scenes.forEach((s,i) => {
  DUST[s.id] = dustCloud(W/2, H*0.55, MID_GREY, i*11+3);
});

const ctx = document.getElementById("out").getContext("2d");

// ── Primitives ────────────────────────────────────────────────────────────────
function bg(fill="#0A0A0A") {
  ctx.fillStyle = fill; ctx.fillRect(0,0,W,H);
}

function photoFill(img, alpha=1.0, grade="dark") {
  if (!img) return;
  const ar = img.naturalWidth / img.naturalHeight;
  const ch = W / ar;
  const cy = (H - ch) / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, 0, Math.max(0, cy), W, Math.min(H, ch));
  // Dark overlay
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function headline(text, y, t, opts={}) {
  const { color=OFF_WHITE, size=SZ.h1, x=G.safe, maxW=W-G.safe*2 } = opts;
  const prog = clamp(t*2, 0, 1);
  ctx.save();
  ctx.globalAlpha = eo(prog);
  ctx.translate(0, (1-eo(prog)) * 24);
  ctx.font = `900 ${size}px AB`;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  wrapText(ctx, text, x, y, maxW, size*1.12, { maxLines: 5 });
  ctx.restore();
}

function accentRule(y, t, w=W*0.55) {
  const prog = clamp(t*2.5, 0, 1);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(G.safe, y, w * prog, 4);
}

function label(text, y, t, opts={}) {
  const { color=MID_GREY, size=28, x=G.safe } = opts;
  const prog = clamp(t*3, 0, 1);
  ctx.save();
  ctx.globalAlpha = eo(prog);
  ctx.font = `600 ${size}px AR`;
  ctx.fillStyle = color;
  ctx.letterSpacing = "0.08em";
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.restore();
}

function bigStat(value, unit, lbl, cx, y, t) {
  const prog = clamp(t*1.8, 0, 1);
  ctx.save();
  ctx.globalAlpha = eo(prog);

  ctx.font = `900 128px AB`;
  ctx.fillStyle = ACCENT;
  ctx.textAlign = "left";
  const valStr = typeof value === "number" ? value.toLocaleString() : String(value);
  ctx.fillText(valStr, cx, y);

  ctx.font = `600 36px AR`;
  ctx.fillStyle = "rgba(240,237,232,0.55)";
  ctx.fillText(unit.toUpperCase(), cx, y + 52);

  ctx.font = `400 28px AR`;
  ctx.fillStyle = MID_GREY;
  ctx.fillText(lbl.toUpperCase(), cx, y + 92);

  ctx.restore();
}

function filmStrip(t) {
  const grain = Math.sin(t * 60) * 0.5 + 0.5;
  ctx.save();
  ctx.globalAlpha = 0.025 * grain;
  for (let i = 0; i < 800; i++) {
    const rng = mulberry(i * 999 + Math.floor(t*24));
    ctx.fillStyle = rng() > 0.5 ? "#FFFFFF" : "#000000";
    ctx.fillRect(rng()*W, rng()*H, 1, 1);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawSubtitles(t) {
  const subs = FILM_DATA.subtitles || [];
  const sub = subs.filter(s => t>=s.a && t<s.b).at(-1);
  if (!sub) return;
  ctx.save();
  ctx.font = `400 38px AR`;
  ctx.textAlign = "center";
  const mw = ctx.measureText(sub.text).width;
  const ph=52, pw=mw+48;
  const sx=(W-pw)/2, sy=H-200;
  ctx.fillStyle = "rgba(0,0,0,0.80)";
  ctx.beginPath(); ctx.roundRect(sx,sy,pw,ph,6); ctx.fill();
  ctx.strokeStyle = `${ACCENT}44`; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle = OFF_WHITE;
  ctx.fillText(sub.text, W/2, sy+ph*0.70);
  ctx.restore();
}

// ── Scene renderers ───────────────────────────────────────────────────────────

function sceneReveal(scene, t, tl) {
  const lt = t - tl.start;
  bg();

  // Stat reveal
  const data = scene.data || {};
  accentRule(H*0.42, lt);
  label(data.label || "Fact", H*0.42 - 44, lt);
  bigStat(data.value || "?", data.unit || "", data.label2 || "", G.safe, H*0.56, lt);

  headline(scene.vo||"", H*0.72, lt, { size: SZ.h2 });
  DUST[scene.id]?.draw(ctx, lt);
  filmStrip(t);
  vignette(ctx, W, H, 0.6, "#000000");
  paperTexture(ctx, 0, 0, W, H, 42, 0.03);
  drawSubtitles(t);
}

function sceneText(scene, t, tl) {
  const lt = t - tl.start;
  bg();

  // Thin vertical accent line
  const lineH = H * 0.42 * clamp(lt * 1.8, 0, 1);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(G.safe - 24, H * 0.28, 3, lineH);

  headline(scene.vo || "", H * 0.30, lt, { size: SZ.h1, x: G.safe + 12 });
  label(FILM_DATA.logline || "", H * 0.30 - 56, lt, { size: 26, x: G.safe + 12 });

  DUST[scene.id]?.draw(ctx, lt);
  filmStrip(t);
  vignette(ctx, W, H, 0.65, "#000000");
  paperTexture(ctx, 0, 0, W, H, 7, 0.025);
  drawSubtitles(t);
}

function scenePhoto(scene, t, tl) {
  const lt = t - tl.start;
  const img = scene.image ? IMGS[scene.image] : null;

  bg();
  if (img) photoFill(img, clamp(lt * 1.2, 0, 1));
  else {
    // Placeholder gradient
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, "#1a1a2e"); grd.addColorStop(1, "#0A0A0A");
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  }

  // Torn-paper title band
  if (lt > 0.6) {
    const prog = clamp((lt - 0.6) * 2, 0, 1);
    ctx.save();
    ctx.globalAlpha = prog;
    tornStrip(ctx, 0, H * 0.60, W, H * 0.30, NEAR_BLACK, {
      sides: ["top"], amp: 18, seed: 55 });
    headline(scene.vo || "", H * 0.70, lt - 0.6, { size: SZ.h2, x: G.safe });
    ctx.restore();
  }

  DUST[scene.id]?.draw(ctx, lt);
  filmStrip(t);
  vignette(ctx, W, H, 0.55, "#000000");
  lightLeak(ctx, W, H, lt / (tl.end - tl.start), 3, 0.05);
  drawSubtitles(t);
}

function sceneGeneric(scene, t, tl) {
  const lt = t - tl.start;
  bg();
  accentRule(H * 0.38, lt);
  headline(scene.vo || "", H * 0.44, lt, { size: SZ.h2 });
  if (scene.image && IMGS[scene.image]) {
    const img = IMGS[scene.image];
    const iw = W * 0.85, ih = iw * 0.6;
    const ix = (W - iw)/2, iy = H * 0.60;
    ctx.save();
    ctx.globalAlpha = clamp(lt * 1.5, 0, 0.8);
    ctx.beginPath(); ctx.roundRect(ix, iy, iw, ih, 3); ctx.clip();
    ctx.drawImage(img, ix, iy, iw, ih);
    ctx.restore();
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(ix, iy, iw, ih);
  }
  filmStrip(t);
  vignette(ctx, W, H, 0.55, "#000000");
  drawSubtitles(t);
}

function dispatchScene(idx, t) {
  const scene = FILM_DATA.scenes[idx];
  if (!scene) return;
  const tl = TL.scenes[idx];
  if (!tl) return;
  switch (scene.visual || "text") {
    case "reveal": sceneReveal(scene, t, tl); break;
    case "photo":  scenePhoto(scene, t, tl);  break;
    case "text":   sceneText(scene, t, tl);   break;
    default:       sceneGeneric(scene, t, tl);
  }
}

function getActiveScene(t) {
  for (let i = TL.scenes.length-1; i >= 0; i--) {
    if (t >= TL.scenes[i].start) return i;
  }
  return 0;
}

window.render = function(t) {
  if (!READY) {
    bg(); ctx.fillStyle=ACCENT; ctx.font=`900 44px AB`;
    ctx.textAlign="center"; ctx.fillText("…", W/2, H/2); return;
  }
  const idx = getActiveScene(t);
  const handled = TM.render(ctx, t, W, H,
    (c,t2) => dispatchScene(idx, t2),
    (c,t2) => { const ni=Math.min(idx+1,TL.scenes.length-1); dispatchScene(ni,t2); }
  );
  if (!handled) dispatchScene(idx, t);
};

window.DUR = TL.dur;
document.fonts.ready.then(() => { loadImages(); if (typeof window.onReady==="function") window.onReady(); });
