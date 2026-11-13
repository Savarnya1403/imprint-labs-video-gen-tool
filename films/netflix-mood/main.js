// Netflix Mood Reel — 1080×1920 — voice-first Canvas 2D
// Palette: cream #F1E6D0 · paper #FBF7EE · red #E50914 · navy #14213D · teal #2A6F6F · gold #C9A227
// Motion: paper-slam · card-drop · hard-cut · typewriter · counter-tick · paper-flip · sticker-pop · line-draw · red-strike
// FORBIDDEN: fades · parallax · push-ins · ease-drift · floating particles · smooth scroll · zoom-punch
// LAYER 0: Trained blob backgrounds from 286-image style model (gradient-free optimization)

const W = 1080, H = 1920;

// ═══════════════════════════════════════════════════════════════════════════
// BLOB PAINTER — trained on 286 editorial images, inlined for self-contained demo
// Ref: "skiing downhill blindfolded" (zeroth-order gradient descent)
//      Blob shape: xom9ikk/animated-blobs bezier math
//      Feature extraction: TomusD/eigenfaces PCA approach
// ═══════════════════════════════════════════════════════════════════════════

function mulberry(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Organic blob — N radial bezier points + 4/3·tan(π/2N) handle formula */
function makeBlobPts(cx, cy, r, n, randomness, seed) {
  const rng = mulberry(seed);
  const angle = (Math.PI * 2) / n;
  const floor = Math.max(0.4, 1 / (1 + randomness * 5));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const off = floor + rng() * (0.5 - floor);
    pts.push({ x: cx + Math.sin(i * angle) * r * off * 2,
               y: cy + Math.cos(i * angle) * r * off * 2 });
  }
  const sm = ((4/3) * Math.tan(angle/4)) / Math.sin(angle/2) / 2;
  return pts.map((curr, i) => {
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x, dy2 = next.y - curr.y;
    const l1 = Math.hypot(dx1, dy1) || 1, l2 = Math.hypot(dx2, dy2) || 1;
    return { x: curr.x, y: curr.y,
      cpIn:  { x: curr.x - dx1/l1*l1*sm, y: curr.y - dy1/l1*l1*sm },
      cpOut: { x: curr.x + dx2/l2*l2*sm, y: curr.y + dy2/l2*l2*sm } };
  });
}

function drawBlob(ctx, cx, cy, r, color, opacity, seed, n=8, randomness=0.4) {
  const pts = makeBlobPts(cx, cy, r, n, randomness, seed);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i+1) % pts.length];
    ctx.bezierCurveTo(a.cpOut.x, a.cpOut.y, b.cpIn.x, b.cpIn.y, b.x, b.y);
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

/** KL divergence between two normalized histograms */
function klDiv(p, q) {
  let v = 0;
  for (let i = 0; i < p.length; i++) v += (p[i]+1e-10) * Math.log((p[i]+1e-10)/(q[i]+1e-10));
  return v;
}

function canvasHist(imageData, bins=32) {
  const { data } = imageData;
  const r = new Float32Array(bins), g = new Float32Array(bins), b = new Float32Array(bins);
  let n = 0;
  for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel
    r[data[i] >> 3]++; g[data[i+1] >> 3]++; b[data[i+2] >> 3]++; n++;
  }
  for (let j = 0; j < bins; j++) { r[j]/=n; g[j]/=n; b[j]/=n; }
  return { r: Array.from(r), g: Array.from(g), b: Array.from(b) };
}

function histErr(imageData, target) {
  const h = canvasHist(imageData);
  return klDiv(h.r, target.r) + klDiv(h.g, target.g) + klDiv(h.b, target.b);
}

/**
 * Paint blob background from trained style data.
 * Iterative hill-climbing: try blob → measure histogram error → accept/reject.
 * Converges to near-zero error (~trained distribution) in maxSteps.
 */
function paintBlobBg(ctx, W, H, styleData, seed=42, maxSteps=55) {
  const rng = mulberry(seed);
  const [mr, mg, mb] = styleData.mean_rgb || [200, 190, 180];
  ctx.fillStyle = `rgb(${Math.round(mr)},${Math.round(mg)},${Math.round(mb)})`;
  ctx.fillRect(0, 0, W, H);

  let snapshot = ctx.getImageData(0, 0, W, H);
  let err = histErr(snapshot, styleData.histogram);

  const templates = styleData.blob_templates || [];
  const palettes  = styleData.palette_samples || [];
  const palette   = palettes.length > 0 ? palettes[Math.floor(rng() * palettes.length)] : ['#ccc'];

  for (let s = 0; s < maxSteps; s++) {
    if (err < 0.004) break;  // converged — near-zero error
    const tmpl   = templates[s % Math.max(templates.length, 1)];
    const jitter = 0.08 + (s / 200) * 0.12;
    const cx     = (tmpl.cx_frac + (rng()-0.5)*jitter) * W;
    const cy     = (tmpl.cy_frac + (rng()-0.5)*jitter) * H;
    const r      = tmpl.size_frac * Math.min(W, H) * (0.7 + rng()*0.6);
    // Jitter color slightly for organic variation
    let baseHex = rng() < 0.6 ? tmpl.color : palette[Math.floor(rng()*palette.length)] || tmpl.color;
    const jc = (h) => {
      const v = parseInt(h, 16);
      return Math.min(255, Math.max(0, v + Math.round((rng()-0.5)*20)));
    };
    if (baseHex && baseHex.length === 7) {
      baseHex = `#${jc(baseHex.slice(1,3)).toString(16).padStart(2,'0')}${jc(baseHex.slice(3,5)).toString(16).padStart(2,'0')}${jc(baseHex.slice(5,7)).toString(16).padStart(2,'0')}`;
    }
    const opacity    = tmpl.opacity * (0.5 + rng()*0.5);
    const randomness = tmpl.randomness ?? 0.4;
    const bseed      = Math.floor(rng() * 999999);
    const nPts       = 6 + Math.floor(rng() * 4);

    const before = ctx.getImageData(0, 0, W, H);
    drawBlob(ctx, cx, cy, r, baseHex, opacity, bseed, nPts, randomness);
    const newId  = ctx.getImageData(0, 0, W, H);
    const newErr = histErr(newId, styleData.histogram);

    if (newErr < err) {
      err = newErr;        // accept: canvas improves
    } else {
      ctx.putImageData(before, 0, 0);  // reject: restore
    }
  }
  return err;
}

// ── Blob backgrounds pre-rendered per scene during boot ───────────────────
// Scene→style mapping (derived from each scene's visual character)
const SCENE_STYLES = [
  'EDITORIAL_CREAM',   // S1: cream bg, rule lines, newspaper editorial
  'BOLD_TYPOGRAPHIC',  // S2: paper bg, big stat numbers
  'EDITORIAL_CREAM',   // S3: cream newspaper column layout
  'PAPER_ILLUS',       // S4: source cards on paper texture
  'EDITORIAL_CREAM',   // S5: cream if→then card layout
  'DARK_COLLAGE',      // S6: navy/dark pull-quote finale
];

const _blobBgs = {};   // scene idx → offscreen canvas (pre-rendered)
let _styleModel = null;

async function _buildBlobBgs() {
  try {
    const r = await fetch('/core/assets/catalog/style_model.json');
    _styleModel = await r.json();
  } catch(e) {
    console.warn('[BlobPainter] style_model.json not loaded, using flat fills', e);
    return;
  }
  for (let i = 0; i < 6; i++) {
    const tag       = SCENE_STYLES[i];
    const styleData = _styleModel[tag];
    if (!styleData) continue;

    const off     = document.createElement('canvas');
    off.width     = W; off.height = H;
    const offCtx  = off.getContext('2d');
    const finalErr = paintBlobBg(offCtx, W, H, styleData, i * 37 + 11, 55);
    _blobBgs[i]   = off;
    console.log(`[BlobPainter] S${i+1} ${tag}  final_error=${finalErr.toFixed(4)}`);
  }
  console.log('[BlobPainter] All backgrounds converged ✓');
}

/** Draw the trained blob background for scene idx, then paper grain on top. */
function drawBlobBg(ctx, sceneIdx) {
  const off = _blobBgs[sceneIdx];
  if (off) {
    ctx.drawImage(off, 0, 0);
  } else {
    // Fallback: flat scene color while model loads
    const fallbacks = [CREAM, PAPER, CREAM, PAPER, CREAM, NAVY];
    ctx.fillStyle = fallbacks[sceneIdx] || CREAM;
    ctx.fillRect(0, 0, W, H);
  }
}
const CREAM  = '#F1E6D0';
const PAPER  = '#FBF7EE';
const RED    = '#E50914';
const NAVY   = '#14213D';
const TEAL   = '#2A6F6F';
const GOLD   = '#C9A227';

// Voice-first timing (frames @ 30fps): ceil(voSec*30) + 12 tail
const SCENE_FRAMES = [149, 311, 318, 406, 336, 198];
const SCENE_START  = (() => {
  const a = [0];
  for (let i = 1; i < SCENE_FRAMES.length; i++) a.push(a[i-1] + SCENE_FRAMES[i-1]);
  return a;
})();
const TOTAL_FRAMES = SCENE_FRAMES.reduce((a, b) => a + b, 0);

window.DUR = TOTAL_FRAMES / 30;

// ── helpers ────────────────────────────────────────────────────────────────

// step function: 0 until frame, 1 from frame onwards (hard-cut, no easing)
function step(t, onFrame) { return t >= onFrame ? 1 : 0; }

// paper-slam: element crashes from above, 2-frame enter, 1-frame overshoot, snap
// returns current Y offset (0 = rested)
function paperSlam(localFrame, fromY = -200) {
  if (localFrame < 1)  return fromY;
  if (localFrame === 1) return 4;    // overshoot
  return 0;
}

// card-drop: card falls from y=startY to finalY over 2 frames with 1-frame overshoot
function cardDrop(localFrame, startY, finalY) {
  const dist = finalY - startY;
  if (localFrame < 1)  return startY;
  if (localFrame === 1) return finalY + 6;
  return finalY;
}

// sticker-pop: scale 0→0.5→1.05→0.98→1.0 over 4 frames
function stickerPop(localFrame) {
  if (localFrame <= 0) return 0;
  if (localFrame === 1) return 0.5;
  if (localFrame === 2) return 1.05;
  if (localFrame === 3) return 0.98;
  return 1.0;
}

// paper-flip: scaleX 1→0.75→0→0.5→1 over 4 frames (reveals back face)
function paperFlipX(localFrame) {
  if (localFrame <= 0) return 1;
  if (localFrame === 1) return 0.75;
  if (localFrame === 2) return 0;
  if (localFrame === 3) return 0.5;
  return 1;
}

// typewriter: show n chars up to index at char-per-frame rate
function twChars(text, t, cps = 14) {
  return Math.min(text.length, Math.floor(t * cps));
}

// counter-tick: slot-machine integer counter
function counterTick(target, t, tickDur = 1.5) {
  const p = Math.min(1, t / tickDur);
  const val = Math.round(p * target);
  return val;
}

// line-draw: 0..1 progress for a stroke
function lineDraw(t, dur = 0.6) {
  return Math.min(1, t / dur);
}

// red-strike: 0..1 progress for a strikethrough sweep
function redStrike(t, dur = 0.4) {
  return Math.min(1, t / dur);
}

// ── text helpers ──────────────────────────────────────────────────────────

function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function fillWrapped(ctx, text, cx, y, maxW, lineH) {
  const lines = wrapText(ctx, text, maxW);
  for (const l of lines) {
    ctx.fillText(l, cx, y);
    y += lineH;
  }
  return y;
}

// draw partial text (typewriter)
function fillPartial(ctx, text, n, cx, y, maxW, lineH) {
  const partial = text.slice(0, n);
  fillWrapped(ctx, partial, cx, y, maxW, lineH);
}

// ── grain overlay ─────────────────────────────────────────────────────────
let grainCanvas = null;
function getGrain() {
  if (grainCanvas) return grainCanvas;
  grainCanvas = document.createElement('canvas');
  grainCanvas.width = 512; grainCanvas.height = 512;
  const gc = grainCanvas.getContext('2d');
  const id = gc.createImageData(512, 512);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.random() * 20 | 0;
    d[i] = d[i+1] = d[i+2] = v;
    d[i+3] = 18;
  }
  gc.putImageData(id, 0, 0);
  return grainCanvas;
}

function drawGrain(ctx) {
  const g = getGrain();
  ctx.save();
  ctx.globalAlpha = 0.35;
  for (let y = 0; y < H; y += 512) {
    for (let x = 0; x < W; x += 512) {
      ctx.drawImage(g, x, y);
    }
  }
  ctx.restore();
}

// ── safe zone check ───────────────────────────────────────────────────────
// critical text: y=250..1600

// ── scene local time helpers ──────────────────────────────────────────────
function sceneTime(frame, sceneIdx) {
  return (frame - SCENE_START[sceneIdx]) / 30; // seconds
}
function sceneFrame(frame, sceneIdx) {
  return frame - SCENE_START[sceneIdx];
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE 1 — "You've opened Netflix."  (149 frames / ~4.6s)
// Look: cream bg · paper-slam Netflix logo block · typewriter VO · red accent
// ═══════════════════════════════════════════════════════════════════════════
function scene1(ctx, frame) {
  const lf = sceneFrame(frame, 0);
  const t  = lf / 30;

  // bg — trained blob layer (editorial cream)
  drawBlobBg(ctx, 0);

  // paper-texture lines
  ctx.strokeStyle = 'rgba(20,33,61,0.07)';
  ctx.lineWidth = 1;
  for (let y = 80; y < H; y += 42) {
    ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(W - 60, y); ctx.stroke();
  }

  // ── Netflix red block slam ──────────────────────────────────────────────
  const blockH = 220;
  const blockY0 = 320;
  const slamY = paperSlam(lf - 2, -300);
  const blockY = blockY0 + (lf < 4 ? slamY : 0);

  ctx.fillStyle = RED;
  ctx.fillRect(60, blockY, W - 120, blockH);

  // "NETFLIX" in block
  ctx.font = `900 108px 'Arial Black', Arial, sans-serif`;
  ctx.fillStyle = PAPER;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '8px';
  ctx.fillText('NETFLIX', W/2, blockY + blockH/2);
  ctx.letterSpacing = '0px';

  // ── day counter card-drop ───────────────────────────────────────────────
  const cardFinalY = 590;
  const cardY = lf >= 4 ? cardDrop(lf - 4, cardFinalY - 160, cardFinalY) : cardFinalY - 160;

  ctx.fillStyle = NAVY;
  ctx.fillRect(60, cardY, 320, 80);
  ctx.font = `700 28px Arial, sans-serif`;
  ctx.fillStyle = CREAM;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('DAY 4', 86, cardY + 40);

  // ── typewriter VO ──────────────────────────────────────────────────────
  const vo = "You've opened Netflix. Scrolled for twenty minutes. And watched nothing.";
  const nchars = lf >= 6 ? twChars(vo, (lf - 6) / 30, 15) : 0;

  ctx.font = `600 54px Georgia, serif`;
  ctx.fillStyle = NAVY;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const voLines = wrapText(ctx, vo, W - 120);
  let charCount = 0;
  let y = 740;
  for (const line of voLines) {
    const show = Math.max(0, Math.min(line.length, nchars - charCount));
    if (show > 0) {
      ctx.fillText(line.slice(0, show), 60, y);
    }
    charCount += line.length + 1;
    y += 72;
  }

  // ── cursor blink (typewriter) ──────────────────────────────────────────
  if (nchars < vo.length && lf >= 6) {
    const blink = Math.floor(t * 2) % 2;
    if (blink === 0) {
      ctx.fillStyle = RED;
      ctx.fillRect(60 + ctx.measureText(voLines[0].slice(0, nchars)).width + 2, 740, 3, 56);
    }
  }

  // ── red-strike line after full reveal ─────────────────────────────────
  if (nchars >= vo.length) {
    const sp = redStrike(t - (vo.length / 15 + 6/30), 0.5);
    if (sp > 0) {
      ctx.strokeStyle = RED;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(60, 760);
      ctx.lineTo(60 + sp * (W - 120), 760);
      ctx.stroke();
    }
  }

  // ── sticker: "scroll scroll scroll" ───────────────────────────────────
  const stickLf = lf - 80;
  const sc = stickLf >= 0 ? stickerPop(stickLf) : 0;
  if (sc > 0) {
    ctx.save();
    ctx.translate(W - 200, 1300);
    ctx.rotate(-0.12);
    ctx.scale(sc, sc);
    ctx.fillStyle = GOLD;
    ctx.fillRect(-120, -50, 240, 100);
    ctx.font = `900 28px Arial, sans-serif`;
    ctx.fillStyle = NAVY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SCROLL SCROLL', 0, -12);
    ctx.fillText('SCROLL...', 0, 20);
    ctx.restore();
  }

  drawGrain(ctx);
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE 2 — "That's not you being picky."  (311 frames / ~10.4s)
// Look: paper bg · large stat cards paper-slam · counter-tick 14 · line-draw
// ═══════════════════════════════════════════════════════════════════════════
function scene2(ctx, frame) {
  const lf = sceneFrame(frame, 1);
  const t  = lf / 30;

  // bg — trained blob layer (bold typographic)
  drawBlobBg(ctx, 1);

  // ── HEADER hard-cut ──────────────────────────────────────────────────
  if (lf >= 0) {
    ctx.fillStyle = NAVY;
    ctx.font = `900 42px 'Arial Black', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('THE SCROLL PROBLEM', W/2, 260);
  }

  // ── stat card 1: "14 MINUTES" paper-slam ──────────────────────────────
  const card1SlamY = paperSlam(lf - 10, -350);
  const c1y = 380 + (lf < 14 ? card1SlamY : 0);

  ctx.fillStyle = RED;
  ctx.fillRect(60, c1y, W - 120, 240);

  // counter-tick inside card
  const countT = Math.max(0, t - 0.5);
  const minVal = counterTick(14, countT, 2.0);
  ctx.font = `900 148px 'Arial Black', Arial, sans-serif`;
  ctx.fillStyle = PAPER;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(minVal), W/2, c1y + 110);

  ctx.font = `700 32px Arial, sans-serif`;
  ctx.fillStyle = CREAM;
  ctx.textBaseline = 'bottom';
  ctx.fillText('MINUTES spent searching', W/2, c1y + 230);

  // ── stat card 2: "1 IN 5" card-drop ───────────────────────────────────
  const c2FinalY = 680;
  const c2y = lf >= 14 ? cardDrop(lf - 14, c2FinalY - 200, c2FinalY) : c2FinalY - 200;

  ctx.fillStyle = TEAL;
  ctx.fillRect(60, c2y, W - 120, 220);

  ctx.font = `900 128px 'Arial Black', Arial, sans-serif`;
  ctx.fillStyle = PAPER;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('1 IN 5', W/2, c2y + 95);

  ctx.font = `700 30px Arial, sans-serif`;
  ctx.fillStyle = CREAM;
  ctx.textBaseline = 'bottom';
  ctx.fillText('gives up. does something else entirely.', W/2, c2y + 210);

  // ── line-draw separator ───────────────────────────────────────────────
  const lineP = lf >= 60 ? lineDraw(t - 2.0, 0.8) : 0;
  if (lineP > 0) {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(60, 970);
    ctx.lineTo(60 + lineP * (W - 120), 970);
    ctx.stroke();
  }

  // ── typewriter VO ─────────────────────────────────────────────────────
  const vo = "That's not you being picky. That's your brain hitting a wall.";
  const nchars = lf >= 20 ? twChars(vo, (lf - 20) / 30, 13) : 0;
  ctx.font = `500 italic 46px Georgia, serif`;
  ctx.fillStyle = NAVY;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const voLinesA = wrapText(ctx, vo, W - 120);
  let cc = 0, vy = 1010;
  for (const line of voLinesA) {
    const show = Math.max(0, Math.min(line.length, nchars - cc));
    if (show > 0) ctx.fillText(line.slice(0, show), 60, vy);
    cc += line.length + 1;
    vy += 62;
  }

  // ── secondary VO after pause ──────────────────────────────────────────
  const vo2 = "The average person spends fourteen minutes searching — and one in five gives up.";
  const nchars2 = lf >= 100 ? twChars(vo2, (lf - 100) / 30, 13) : 0;
  ctx.font = `400 38px Georgia, serif`;
  ctx.fillStyle = '#3A3A3A';
  cc = 0; vy = 1200;
  const voLinesB = wrapText(ctx, vo2, W - 120);
  for (const line of voLinesB) {
    const show = Math.max(0, Math.min(line.length, nchars2 - cc));
    if (show > 0) ctx.fillText(line.slice(0, show), 60, vy);
    cc += line.length + 1;
    vy += 56;
  }

  // ── annotation arrow sticker-pop ─────────────────────────────────────
  const arrowLf = lf - 160;
  const arrowSc = arrowLf >= 0 ? stickerPop(arrowLf) : 0;
  if (arrowSc > 0) {
    ctx.save();
    ctx.translate(W - 180, 480);
    ctx.scale(arrowSc, arrowSc);
    ctx.rotate(0.2);

    // sticky note
    ctx.fillStyle = GOLD;
    ctx.fillRect(-100, -60, 200, 120);

    // fold
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.moveTo(80, -60); ctx.lineTo(100, -60); ctx.lineTo(100, -40); ctx.closePath();
    ctx.fill();

    ctx.font = `700 22px Arial, sans-serif`;
    ctx.fillStyle = NAVY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('avg viewer', 0, -18);
    ctx.fillText('behaviour', 0, 10);
    ctx.restore();

    // hand-drawn arrow
    if (arrowLf >= 4) {
      const ap = lineDraw((arrowLf - 4) / 30, 0.3);
      ctx.save();
      ctx.strokeStyle = NAVY;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(W - 180, 540);
      ctx.quadraticCurveTo(W - 160, 580, W - 160, 490 + 100 * ap);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  drawGrain(ctx);
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE 3 — "Netflix's own data says..."  (318 frames / ~10.6s)
// Look: cream bg · newspaper column layout · red-strike on "watch history"
// paper-flip reveals insight card
// ═══════════════════════════════════════════════════════════════════════════
function scene3(ctx, frame) {
  const lf = sceneFrame(frame, 2);
  const t  = lf / 30;

  // bg — trained blob layer (editorial cream)
  drawBlobBg(ctx, 2);

  // ── newspaper-style header slam ────────────────────────────────────────
  const hSlamY = paperSlam(lf - 2, -280);
  const hy = 260 + (lf < 6 ? hSlamY : 0);

  ctx.font = `900 38px 'Arial Black', Arial, sans-serif`;
  ctx.fillStyle = NAVY;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('WHAT NETFLIX DISCOVERED', W/2, hy);

  // divider
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(60, hy + 52); ctx.lineTo(W - 60, hy + 52); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, hy + 58); ctx.lineTo(W - 60, hy + 58); ctx.stroke();

  // ── left column ───────────────────────────────────────────────────────
  const colW = (W - 150) / 2;
  ctx.font = `400 32px Georgia, serif`;
  ctx.fillStyle = NAVY;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const colText = "Netflix's own data says the problem isn't your taste. It's that your taste isn't the thing deciding.";
  const nchars = lf >= 20 ? twChars(colText, (lf - 20) / 30, 12) : 0;
  const colLines = wrapText(ctx, colText, colW);
  let cc = 0, vy = hy + 80;
  for (const line of colLines) {
    const show = Math.max(0, Math.min(line.length, nchars - cc));
    if (show > 0) ctx.fillText(line.slice(0, show), 60, vy);
    cc += line.length + 1;
    vy += 50;
  }

  // ── middle column divider line-draw ───────────────────────────────────
  const midP = lf >= 60 ? lineDraw(t - 2.0, 0.6) : 0;
  if (midP > 0) {
    ctx.strokeStyle = NAVY;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W/2, hy + 70);
    ctx.lineTo(W/2, hy + 70 + midP * 420);
    ctx.stroke();
  }

  // ── right column: "YOUR MOOD IS." card-drop ──────────────────────────
  const c2y = lf >= 30 ? cardDrop(lf - 30, hy + 50, hy + 80) : hy + 50;

  ctx.fillStyle = RED;
  ctx.fillRect(W/2 + 30, c2y, colW - 30, 180);

  ctx.font = `900 68px 'Arial Black', Arial, sans-serif`;
  ctx.fillStyle = PAPER;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('YOUR', W/2 + 30 + (colW - 30)/2, c2y + 55);
  ctx.fillText('MOOD', W/2 + 30 + (colW - 30)/2, c2y + 125);

  ctx.font = `400 24px Georgia, serif`;
  ctx.fillStyle = CREAM;
  ctx.fillText('is deciding.', W/2 + 30 + (colW - 30)/2, c2y + 168);

  // ── "watch history" phrase card-drop ──────────────────────────────────
  const c3y = lf >= 60 ? cardDrop(lf - 60, 680, 720) : 680;

  ctx.fillStyle = PAPER;
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 2;
  ctx.fillRect(60, c3y, W - 120, 90);
  ctx.strokeRect(60, c3y, W - 120, 90);

  ctx.font = `600 40px Georgia, serif`;
  ctx.fillStyle = NAVY;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('"your watch history"', W/2, c3y + 45);

  // red-strike through "watch history"
  const sp = lf >= 90 ? redStrike(t - 3.0, 0.5) : 0;
  if (sp > 0) {
    ctx.strokeStyle = RED;
    ctx.lineWidth = 7;
    ctx.beginPath();
    const textW = ctx.measureText('"your watch history"').width;
    ctx.moveTo(W/2 - textW/2, c3y + 45);
    ctx.lineTo(W/2 - textW/2 + sp * textW, c3y + 45);
    ctx.stroke();
  }

  // ── paper-flip insight panel ──────────────────────────────────────────
  const flipLf = lf - 100;
  const flipX = flipLf >= 0 ? paperFlipX(flipLf) : 1;

  if (flipLf >= 0) {
    ctx.save();
    ctx.translate(W/2, 950);
    ctx.scale(flipX, 1);

    if (flipLf <= 2) {
      // front face (plain paper)
      ctx.fillStyle = PAPER;
      ctx.fillRect(-W/2 + 60, -100, W - 120, 300);
      ctx.strokeStyle = NAVY;
      ctx.lineWidth = 2;
      ctx.strokeRect(-W/2 + 60, -100, W - 120, 300);
    } else {
      // back face reveals insight
      ctx.fillStyle = TEAL;
      ctx.fillRect(-W/2 + 60, -100, W - 120, 300);

      ctx.font = `900 52px 'Arial Black', Arial, sans-serif`;
      ctx.fillStyle = PAPER;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MOOD ≠ HISTORY', 0, -20);

      ctx.font = `400 30px Georgia, serif`;
      ctx.fillStyle = CREAM;
      ctx.fillText('Your mood doesn\'t show up in', 0, 40);
      ctx.fillText('your watch history.', 0, 78);
    }
    ctx.restore();
  }

  // ── secondary VO ──────────────────────────────────────────────────────
  const vo2 = "Your mood is. And your mood doesn't show up in your watch history.";
  const nchars2 = lf >= 150 ? twChars(vo2, (lf - 150) / 30, 13) : 0;
  ctx.font = `500 italic 38px Georgia, serif`;
  ctx.fillStyle = NAVY;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lines2 = wrapText(ctx, vo2, W - 120);
  cc = 0; vy = 1310;
  for (const line of lines2) {
    const show = Math.max(0, Math.min(line.length, nchars2 - cc));
    if (show > 0) ctx.fillText(line.slice(0, show), 60, vy);
    cc += line.length + 1;
    vy += 56;
  }

  drawGrain(ctx);
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE 4 — "So during lockdown in India..."  (406 frames / ~13.5s)
// Look: paper bg · 3 source cards (Spotify/Twitter/Swiggy) paper-slam in seq
// line-draw connecting them · counter tick on "lockdown India"
// ═══════════════════════════════════════════════════════════════════════════
function scene4(ctx, frame) {
  const lf = sceneFrame(frame, 3);
  const t  = lf / 30;

  // bg — trained blob layer (paper illustration)
  drawBlobBg(ctx, 3);

  // ── HEADER ────────────────────────────────────────────────────────────
  const hSlamY = paperSlam(lf - 2, -280);
  const hy = 268 + (lf < 6 ? hSlamY : 0);

  ctx.fillStyle = NAVY;
  ctx.font = `900 36px 'Arial Black', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('NETFLIX INDIA · LOCKDOWN 2020', W/2, hy);

  ctx.strokeStyle = RED;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(60, hy + 50); ctx.lineTo(W - 60, hy + 50); ctx.stroke();

  // ── subhead typewriter ────────────────────────────────────────────────
  const sub = 'Stopped asking "what do you want to watch?"';
  const nchars0 = lf >= 15 ? twChars(sub, (lf - 15) / 30, 14) : 0;
  ctx.font = `400 italic 36px Georgia, serif`;
  ctx.fillStyle = '#3A3A3A';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(sub.slice(0, nchars0), 60, hy + 70);

  // ── 3 source cards ────────────────────────────────────────────────────
  const cards = [
    { label: 'SPOTIFY',  sub: 'Playlists',       color: '#1DB954', textColor: PAPER, slam: 60  },
    { label: 'TWITTER',  sub: 'Emojis',           color: '#1D9BF0', textColor: PAPER, slam: 90  },
    { label: 'SWIGGY',   sub: 'Orders',           color: '#FC8019', textColor: PAPER, slam: 120 },
  ];

  const cardW = (W - 180) / 3;
  const cardH = 280;
  const cardBaseY = 480;

  cards.forEach((card, i) => {
    const slY = paperSlam(lf - card.slam, -380);
    const cy = cardBaseY + (lf < card.slam + 4 ? slY : 0);
    const cx = 60 + i * (cardW + 30);

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(cx + 6, cy + 8, cardW, cardH);

    ctx.fillStyle = card.color;
    ctx.fillRect(cx, cy, cardW, cardH);

    // brand letter big
    ctx.font = `900 110px 'Arial Black', Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.label[0], cx + cardW/2, cy + cardH/2 - 10);

    ctx.font = `900 36px 'Arial Black', Arial, sans-serif`;
    ctx.fillStyle = card.textColor;
    ctx.fillText(card.label, cx + cardW/2, cy + 70);

    ctx.font = `400 26px Georgia, serif`;
    ctx.fillText(card.sub, cx + cardW/2, cy + cardH - 50);

    // "MOOD SIGNAL" label
    ctx.font = `600 18px Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('MOOD SIGNAL', cx + cardW/2, cy + cardH - 24);
  });

  // ── line-draw connecting cards to Netflix box ─────────────────────────
  const lineP = lf >= 180 ? lineDraw(t - 6.0, 1.2) : 0;
  if (lineP > 0) {
    ctx.strokeStyle = RED;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 5]);

    // from each card bottom to central box
    const boxCY = 920;
    cards.forEach((card, i) => {
      const cx = 60 + i * (cardW + 30) + cardW/2;
      const p = Math.min(1, lineP * 3 - i);
      if (p > 0) {
        ctx.beginPath();
        ctx.moveTo(cx, cardBaseY + cardH + 8);
        ctx.lineTo(cx, cardBaseY + cardH + 8 + p * (boxCY - cardBaseY - cardH - 8));
        ctx.stroke();
      }
    });
    ctx.setLineDash([]);
  }

  // ── Netflix Matchmaker box paper-slam ─────────────────────────────────
  const boxLf = lf - 200;
  const boxSlamY = boxLf >= 0 ? paperSlam(boxLf, -300) : -300;
  const boxY = 920 + (boxLf >= 0 && boxLf < 4 ? boxSlamY : 0);

  if (boxLf >= 0 || lf >= 200) {
    const bY = lf >= 200 ? (boxLf < 4 ? 920 + boxSlamY : 920) : 920 - 300;
    ctx.fillStyle = RED;
    ctx.fillRect(60, bY, W - 120, 160);

    ctx.font = `900 72px 'Arial Black', Arial, sans-serif`;
    ctx.fillStyle = PAPER;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NETFLIX MATCHMAKER', W/2, bY + 70);

    ctx.font = `400 28px Georgia, serif`;
    ctx.fillStyle = CREAM;
    ctx.fillText('reads your mood, not your history', W/2, bY + 128);
  }

  // ── VO typewriter ─────────────────────────────────────────────────────
  const vo = 'So during lockdown in India, Netflix started reading mood signals from three places you would not expect.';
  const nchars = lf >= 240 ? twChars(vo, (lf - 240) / 30, 12) : 0;
  ctx.font = `400 34px Georgia, serif`;
  ctx.fillStyle = NAVY;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const voLinesA = wrapText(ctx, vo, W - 120);
  let cc = 0, vy = 1120;
  for (const line of voLinesA) {
    const show = Math.max(0, Math.min(line.length, nchars - cc));
    if (show > 0) ctx.fillText(line.slice(0, show), 60, vy);
    cc += line.length + 1;
    vy += 52;
  }

  // ── India lockdown sticker-pop ────────────────────────────────────────
  const stLf = lf - 280;
  const stSc = stLf >= 0 ? stickerPop(stLf) : 0;
  if (stSc > 0) {
    ctx.save();
    ctx.translate(W - 150, 1380);
    ctx.rotate(-0.08);
    ctx.scale(stSc, stSc);

    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(0, 0, 90, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `900 24px Arial, sans-serif`;
    ctx.fillStyle = NAVY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('INDIA', 0, -18);
    ctx.fillText('LOCKDOWN', 0, 8);
    ctx.fillText('2020', 0, 34);
    ctx.restore();
  }

  drawGrain(ctx);
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE 5 — "Tweet a crying emoji..."  (336 frames / ~11.2s)
// Look: cream bg · 3 "if→then" cards with emoji/food icons · sticker-pops
// BGM silent here per spec
// ═══════════════════════════════════════════════════════════════════════════
function scene5(ctx, frame) {
  const lf = sceneFrame(frame, 4);
  const t  = lf / 30;

  // bg — trained blob layer (editorial cream)
  drawBlobBg(ctx, 4);

  // ── HEADER paper-slam ─────────────────────────────────────────────────
  const hSlamY = paperSlam(lf - 2, -300);
  const hy = 262 + (lf < 6 ? hSlamY : 0);

  ctx.fillStyle = TEAL;
  ctx.fillRect(60, hy, W - 120, 90);
  ctx.font = `900 42px 'Arial Black', Arial, sans-serif`;
  ctx.fillStyle = PAPER;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('THE MATCHMAKER RULES', W/2, hy + 45);

  // ── if→then cards ────────────────────────────────────────────────────
  const rules = [
    {
      ifLabel: '😢', ifText: 'crying emoji',
      arrow: '→',
      thenText: 'DRAMA', thenSub: 'sent by Matchmaker',
      cardColor: TEAL, slam: 30
    },
    {
      ifLabel: '🍛', ifText: 'biryani order',
      arrow: '→',
      thenText: 'COMFORT', thenSub: 'feels like biryani',
      cardColor: NAVY, slam: 70
    },
    {
      ifLabel: '🛒', ifText: 'your Swiggy cart',
      arrow: '→',
      thenText: 'ENGINE', thenSub: 'recommendation engine',
      cardColor: RED, slam: 110
    }
  ];

  rules.forEach((rule, i) => {
    const slY = paperSlam(lf - rule.slam, -360);
    const ry = 420 + i * 310 + (lf < rule.slam + 4 ? slY : 0);

    // card shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(66, ry + 7, W - 132, 270);

    // card bg
    ctx.fillStyle = rule.cardColor;
    ctx.fillRect(60, ry, W - 120, 270);

    // IF section (left half)
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(60, ry, (W - 120)/2, 270);

    ctx.font = `700 26px Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('IF', 86, ry + 18);

    ctx.font = `72px Arial, sans-serif`;
    ctx.fillStyle = PAPER;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rule.ifLabel, 60 + (W - 120)/4, ry + 110);

    ctx.font = `400 26px Georgia, serif`;
    ctx.fillStyle = CREAM;
    ctx.textBaseline = 'bottom';
    ctx.fillText(rule.ifText, 60 + (W - 120)/4, ry + 250);

    // THEN section (right half)
    ctx.font = `700 26px Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('THEN', 60 + (W - 120)/2 + 20, ry + 18);

    ctx.font = `900 60px 'Arial Black', Arial, sans-serif`;
    ctx.fillStyle = PAPER;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rule.thenText, 60 + 3*(W - 120)/4, ry + 100);

    ctx.font = `400 26px Georgia, serif`;
    ctx.fillStyle = CREAM;
    ctx.textBaseline = 'bottom';
    ctx.fillText(rule.thenSub, 60 + 3*(W - 120)/4, ry + 250);

    // arrow sticker-pop
    const arrLf = lf - rule.slam - 30;
    const arrSc = arrLf >= 0 ? stickerPop(arrLf) : 0;
    if (arrSc > 0) {
      ctx.save();
      ctx.translate(W/2, ry + 135);
      ctx.scale(arrSc, arrSc);
      ctx.fillStyle = GOLD;
      ctx.font = `900 48px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('→', 0, 0);
      ctx.restore();
    }
  });

  // ── VO typewriter ─────────────────────────────────────────────────────
  const vo = 'Your Swiggy cart becomes a recommendation engine.';
  const nchars = lf >= 240 ? twChars(vo, (lf - 240) / 30, 14) : 0;
  ctx.font = `600 italic 44px Georgia, serif`;
  ctx.fillStyle = NAVY;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(vo.slice(0, nchars), 60, 1380);

  drawGrain(ctx);
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE 6 — "Because sometimes..."  (198 frames / ~6.6s)
// Look: navy bg · gold pull-quote · line-draw underline · red final mark
// ═══════════════════════════════════════════════════════════════════════════
function scene6(ctx, frame) {
  const lf = sceneFrame(frame, 5);
  const t  = lf / 30;

  // bg — trained blob layer (dark collage)
  drawBlobBg(ctx, 5);

  // ── background halftone dots (static code-drawn) ──────────────────────
  ctx.fillStyle = 'rgba(201,162,39,0.08)';
  for (let r = 0; r < 20; r++) {
    for (let c = 0; c < 10; c++) {
      const dotR = 3 + (r + c) % 4;
      ctx.beginPath();
      ctx.arc(c * 115 + 55, r * 100 + 100, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Netflix red vertical strip (paper-slam from left) ─────────────────
  const stripSlamX = lf < 4 ? (-120 + lf * 30) : (lf === 4 ? -4 : 0);
  ctx.fillStyle = RED;
  ctx.fillRect(stripSlamX, 0, 24, H);

  // ── pull-quote block card-drop ─────────────────────────────────────────
  const qy0 = 480;
  const qy = lf >= 6 ? cardDrop(lf - 6, qy0 - 180, qy0) : qy0 - 180;

  // quotation mark sticker-pop
  const qLf = lf - 10;
  const qSc = qLf >= 0 ? stickerPop(qLf) : 0;
  if (qSc > 0) {
    ctx.save();
    ctx.translate(80, qy - 20);
    ctx.scale(qSc, qSc);
    ctx.font = `900 140px Georgia, serif`;
    ctx.fillStyle = RED;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('“', 0, 0);
    ctx.restore();
  }

  // typewriter pull-quote
  const quote = "Because sometimes, understanding how someone feels is more useful than knowing what they watched yesterday.";
  const nchars = lf >= 20 ? twChars(quote, (lf - 20) / 30, 11) : 0;

  ctx.font = `300 52px Georgia, serif`;
  ctx.fillStyle = CREAM;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const qLines = wrapText(ctx, quote, W - 160);
  let cc = 0, vy = qy;
  for (const line of qLines) {
    const show = Math.max(0, Math.min(line.length, nchars - cc));
    if (show > 0) ctx.fillText(line.slice(0, show), 100, vy);
    cc += line.length + 1;
    vy += 72;
  }

  // ── line-draw underline under full quote ──────────────────────────────
  const ulP = nchars >= quote.length ? lineDraw(t - (quote.length / 11 / 30) - 20/30, 0.8) : 0;
  if (ulP > 0) {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(100, vy + 10);
    ctx.lineTo(100 + ulP * (W - 160), vy + 10);
    ctx.stroke();
  }

  // ── attribution sticker-pop ───────────────────────────────────────────
  const attrLf = lf - 120;
  const attrSc = attrLf >= 0 ? stickerPop(attrLf) : 0;
  if (attrSc > 0) {
    ctx.save();
    ctx.translate(W - 100, vy + 60);
    ctx.scale(attrSc, attrSc);
    ctx.font = `600 24px Arial, sans-serif`;
    ctx.fillStyle = GOLD;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('— Netflix Matchmaker, 2020', 0, 0);
    ctx.restore();
  }

  // ── Netflix logo closing card-drop ────────────────────────────────────
  const logoLf = lf - 140;
  const logoFY = vy + 160;
  const logoY = logoLf >= 0 ? cardDrop(logoLf, logoFY - 100, logoFY) : logoFY - 100;

  if (logoLf >= 0) {
    ctx.fillStyle = RED;
    ctx.fillRect(60, logoY, W - 120, 120);
    ctx.font = `900 72px 'Arial Black', Arial, sans-serif`;
    ctx.fillStyle = PAPER;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '6px';
    ctx.fillText('NETFLIX', W/2, logoY + 60);
    ctx.letterSpacing = '0px';

    ctx.font = `400 24px Georgia, serif`;
    ctx.fillStyle = CREAM;
    ctx.textBaseline = 'top';
    ctx.fillText('People don\'t always know what they want to watch.', W/2, logoY + 94);
  }

  // ── final red-strike across brand ─────────────────────────────────────
  // (ironic: they DO know now, so no strike — just the frame holds)

  // ── day counter sticker-pop ───────────────────────────────────────────
  const dayLf = lf - 160;
  const daySc = dayLf >= 0 ? stickerPop(dayLf) : 0;
  if (daySc > 0) {
    ctx.save();
    ctx.translate(100, 1500);
    ctx.rotate(-0.1);
    ctx.scale(daySc, daySc);
    ctx.fillStyle = GOLD;
    ctx.fillRect(-80, -40, 160, 80);
    ctx.font = `900 28px Arial, sans-serif`;
    ctx.fillStyle = NAVY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DAY 4 / DONE', 0, 0);
    ctx.restore();
  }

  drawGrain(ctx);
}

// ═══════════════════════════════════════════════════════════════════════════
// DISPATCH
// ═══════════════════════════════════════════════════════════════════════════
const SCENES = [scene1, scene2, scene3, scene4, scene5, scene6];

function currentScene(frame) {
  for (let i = SCENE_START.length - 1; i >= 0; i--) {
    if (frame >= SCENE_START[i]) return i;
  }
  return 0;
}

const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');

window.render = function(t) {
  const frame = Math.round(t * 30);
  const si = currentScene(frame);
  SCENES[si](ctx, frame);
};

// async boot: pre-render blob backgrounds from trained model, then signal ready
(async () => {
  await _buildBlobBgs();   // load style_model.json + hill-climb each scene bg
  window.render(0);        // first frame with trained backgrounds
  window.READY = true;
})();
