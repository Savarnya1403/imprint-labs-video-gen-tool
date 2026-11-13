/**
 * OpusFlow Kinetics — $50k-editor-grade typography animation.
 *
 * Every function takes (ctx, t) where t=0→1 within the scene.
 * Spring physics, per-character animation, momentum, overshoot — the same
 * motion language you see in Apple keynotes and high-end motion graphics.
 */

import { clamp, lerp, eo, eio, back, spring, mulberry } from '/core/lib.js';

const TAU = Math.PI * 2;


// ── Core spring evaluator ─────────────────────────────────────────────────────
function springVal(t, delay = 0, stiffness = 180, damping = 18) {
  const lt = Math.max(0, t - delay);
  if (lt <= 0) return 0;
  // Underdamped spring: x(t) = 1 - e^(-dt*lt) * cos(wt*lt)
  const omega = Math.sqrt(Math.max(0, stiffness - damping * damping / 4));
  const e     = Math.exp(-damping / 2 * lt);
  return clamp(1 - e * Math.cos(omega * lt), 0, 1.08);  // 1.08 = allow mild overshoot
}


// ════════════════════════════════════════════════════════════════════════════
// LETTER SPRING — each character enters with its own spring, staggered
// ════════════════════════════════════════════════════════════════════════════
/**
 * @param {string} text
 * @param {number} x, y  — baseline start
 * @param {number} t      — 0→1
 * @param {object} opts
 *   font, color, size, stagger, direction ("up"|"down"|"left"|"scale"|"rotate")
 *   spacing, align
 */
export function letterSpring(ctx, text, x, y, t, opts = {}) {
  const {
    font       = "900 108px AB",
    color      = "#14213D",
    size       = 108,
    stagger    = 0.045,
    direction  = "up",
    yOffset    = 60,
    align      = "left",
    tracking   = 0,
    maxWidth   = Infinity,
  } = opts;

  ctx.save();
  ctx.font  = font || `900 ${size}px AB`;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";

  // Measure each character to handle proportional spacing
  const chars = [...text];
  const widths = chars.map(c => ctx.measureText(c).width + tracking);
  const totalW = widths.reduce((a, b) => a + b, 0);

  let startX = x;
  if (align === "center") startX = x - totalW / 2;
  if (align === "right")  startX = x - totalW;

  let cx = startX;
  chars.forEach((ch, i) => {
    const prog = clamp(springVal(t, i * stagger, 160, 20), 0, 1.08);
    const alpha = clamp(prog * 2, 0, 1);

    ctx.save();
    ctx.globalAlpha = alpha;

    let tx = cx, ty = y;
    switch (direction) {
      case "up":    ty = y + (1 - prog) * yOffset;    break;
      case "down":  ty = y - (1 - prog) * yOffset;    break;
      case "left":  tx = cx + (1 - prog) * yOffset;   break;
      case "scale":
        ctx.translate(cx + widths[i] / 2, y);
        ctx.scale(prog, prog);
        ctx.translate(-(cx + widths[i] / 2), -y);
        break;
      case "rotate":
        ctx.translate(cx + widths[i] / 2, y);
        ctx.rotate((1 - prog) * Math.PI * 0.4);
        ctx.translate(-(cx + widths[i] / 2), -y);
        break;
    }
    ctx.fillText(ch, tx, ty);
    ctx.restore();

    cx += widths[i];
  });

  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// WORD CASCADE — words enter line-by-line with spring stagger
// ════════════════════════════════════════════════════════════════════════════
export function wordCascade(ctx, lines, x, y, t, opts = {}) {
  const {
    font      = "900 96px AB",
    color     = "#14213D",
    lineH     = 112,
    stagger   = 0.14,
    direction = "up",
    yOff      = 48,
    align     = "left",
  } = opts;

  ctx.save();
  ctx.font = font;
  ctx.textBaseline = "alphabetic";

  lines.forEach((line, i) => {
    const prog  = clamp(springVal(t, i * stagger, 200, 22), 0, 1.05);
    const alpha = clamp(prog * 3, 0, 1);
    const dy    = direction === "up"  ? (1 - prog) * yOff : -(1 - prog) * yOff;

    let lx = x;
    if (align === "center") lx = x - ctx.measureText(line).width / 2;
    if (align === "right")  lx = x - ctx.measureText(line).width;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillText(line, lx, y + i * lineH + dy);
    ctx.restore();
  });

  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// TITLE CRASH — text slams in from edges with heavy overshoot
// ════════════════════════════════════════════════════════════════════════════
export function titleCrash(ctx, text, cx, cy, t, opts = {}) {
  const {
    font     = "900 144px AB",
    color    = "#14213D",
    fromEdge = "top",   // "top"|"bottom"|"left"|"right"
    distance = 300,
    shockR   = 0,       // 0=no shock ring
  } = opts;

  const prog  = clamp(springVal(t, 0, 220, 16), 0, 1.12);
  const alpha = clamp(t * 8, 0, 1);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let tx = cx, ty = cy;
  const offset = (1 - prog) * distance;
  if (fromEdge === "top")    ty = cy - offset;
  if (fromEdge === "bottom") ty = cy + offset;
  if (fromEdge === "left")   tx = cx - offset;
  if (fromEdge === "right")  tx = cx + offset;

  // Shock ring on impact
  if (shockR > 0 && prog > 0.85) {
    const impactProg = clamp((prog - 0.85) / 0.15, 0, 1);
    ctx.save();
    ctx.globalAlpha = (1 - impactProg) * 0.25;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4 * (1 - impactProg);
    ctx.beginPath();
    ctx.arc(cx, cy, shockR * impactProg, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillText(text, tx, ty);
  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// TYPEWRITER PRO — with cursor blink, variable speed, pause on punctuation
// ════════════════════════════════════════════════════════════════════════════
export function typewriterPro(ctx, text, x, y, t, opts = {}) {
  const {
    font          = "400 44px AR",
    color         = "#14213D",
    cursorColor   = "#B8312A",
    speed         = 28,    // chars per second
    maxWidth      = 800,
    lineH         = 56,
    showCursor    = true,
  } = opts;

  // Compute how many chars to show, with pauses on punctuation
  let charsToShow = 0;
  let elapsed     = t * (text.length / speed) * speed;
  let acc         = 0;
  for (let i = 0; i < text.length; i++) {
    const pause = /[.,!?;:]/.test(text[i]) ? 0.4 : 0;
    acc += 1 + pause * speed;
    if (acc > elapsed) break;
    charsToShow = i + 1;
  }
  charsToShow = Math.min(charsToShow, text.length);

  const visible = text.slice(0, charsToShow);

  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";

  // Word-wrap the visible text
  const words   = visible.split(" ");
  let line      = "";
  let ly        = y;
  let lastLineW = 0;
  const lines   = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  lines.push(line);

  lines.forEach((l, i) => {
    ctx.fillText(l, x, y + i * lineH);
    if (i === lines.length - 1) lastLineW = ctx.measureText(l).width;
  });

  // Cursor
  if (showCursor && charsToShow < text.length) {
    const cursorX = x + lastLineW + 4;
    const cursorY = y + (lines.length - 1) * lineH;
    const blink   = Math.sin(t * 60 * Math.PI) > 0;
    if (blink) {
      ctx.fillStyle = cursorColor;
      ctx.fillRect(cursorX, cursorY - parseInt(font) * 0.8, 3, parseInt(font) * 0.9);
    }
  }

  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// SCRUB REVEAL — text revealed by a moving clip mask (like ink spreading)
// ════════════════════════════════════════════════════════════════════════════
export function scrubReveal(ctx, text, x, y, t, opts = {}) {
  const {
    font      = "900 108px AB",
    color     = "#14213D",
    direction = "right",  // "right"|"up"|"down"
    W         = 1080,
    H         = 300,
    ease      = "eio",
  } = opts;

  const prog = ease === "eio"
    ? (eio ? eio(clamp(t * 1.5, 0, 1)) : clamp(t * 1.5, 0, 1))
    : clamp(t * 1.5, 0, 1);

  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";

  // Create clip region that expands
  ctx.beginPath();
  if (direction === "right") {
    ctx.rect(x - 10, y - parseInt(font) * 1.1, W * prog + 20, H);
  } else if (direction === "up") {
    const revealH = H * prog;
    ctx.rect(x - 10, y - revealH, W + 20, revealH + 20);
  }
  ctx.clip();
  ctx.fillText(text, x, y);
  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// EMPHASIS POP — a word mid-sentence punches out larger then springs back
// ════════════════════════════════════════════════════════════════════════════
/**
 * Draw a line of text with one "pop" word that scales up dramatically.
 * @param {number[]} popRange  — [startCharIdx, endCharIdx] of the pop word
 */
export function emphasisPop(ctx, text, x, y, t, popRange, opts = {}) {
  const {
    font      = "900 72px AB",
    normalColor = "#14213D",
    popColor    = "#B8312A",
    popScale    = 1.35,
    popDelay    = 0.3,
  } = opts;

  const popProg = clamp(springVal(t, popDelay, 280, 22), 0, popScale);
  const scale   = lerp(1, popScale, popProg > 1 ? 2 - popProg : popProg);

  ctx.save();
  ctx.font = font;
  ctx.textBaseline = "alphabetic";

  const pre   = text.slice(0, popRange[0]);
  const pop   = text.slice(popRange[0], popRange[1]);
  const post  = text.slice(popRange[1]);

  const preW  = ctx.measureText(pre).width;
  const popW  = ctx.measureText(pop).width;

  // Pre text
  ctx.fillStyle = normalColor;
  if (pre) ctx.fillText(pre, x, y);

  // Pop word
  const pcx = x + preW + popW / 2;
  ctx.save();
  ctx.translate(pcx, y);
  ctx.scale(scale, scale);
  ctx.translate(-pcx, -y);
  ctx.fillStyle = popColor;
  ctx.fillText(pop, x + preW, y);
  ctx.restore();

  // Post text
  if (post) {
    ctx.fillStyle = normalColor;
    ctx.fillText(post, x + preW + popW * scale, y);
  }
  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// GLITCH TEXT — digital scan-line glitch effect for tech/dark topics
// ════════════════════════════════════════════════════════════════════════════
export function glitchText(ctx, text, x, y, t, opts = {}) {
  const {
    font       = "900 108px AB",
    color      = "#FFFFFF",
    glitchColor = "#00FFE0",
    intensity   = 0.3,
    seed        = 7,
  } = opts;

  const rng = mulberry(seed + Math.floor(t * 24));

  ctx.save();
  ctx.font = font;
  ctx.textBaseline = "alphabetic";
  const W = ctx.measureText(text).width;
  const H = parseInt(font) * 1.2;

  // Base text
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);

  // Glitch slices (random horizontal bands)
  if (intensity > 0 && rng() < intensity * 2) {
    const slices = Math.floor(2 + rng() * 4);
    for (let i = 0; i < slices; i++) {
      const sy    = y - H + rng() * H;
      const sh    = 2 + rng() * 8;
      const shift = (rng() - 0.5) * 20 * intensity;
      ctx.save();
      ctx.rect(x + shift - 5, sy, W + 10, sh);
      ctx.clip();
      ctx.fillStyle = rng() > 0.5 ? glitchColor : color;
      ctx.fillText(text, x + shift, y);
      ctx.restore();
    }
    // Chromatic aberration
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#FF003C";
    ctx.fillText(text, x + 3 * intensity, y);
    ctx.fillStyle = "#0033FF";
    ctx.fillText(text, x - 3 * intensity, y);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// COUNTER ROLL — slot-machine digit roll for dramatic number reveals
// ════════════════════════════════════════════════════════════════════════════
export function counterRoll(ctx, targetValue, x, y, t, opts = {}) {
  const {
    font        = "900 144px AB",
    color       = "#14213D",
    accentColor = "#B8312A",
    prefix      = "",
    suffix      = "",
    decimals    = 0,
    align       = "left",
  } = opts;

  // Eased progress
  const prog = eio ? eio(clamp(t * 1.4, 0, 1)) : clamp(t * 1.4, 0, 1);
  const current = targetValue * prog;
  const display = decimals > 0
    ? current.toFixed(decimals)
    : Math.round(current).toLocaleString();

  ctx.save();
  ctx.font = font;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = align;
  ctx.fillStyle = accentColor;

  const full = `${prefix}${display}${suffix}`;
  ctx.fillText(full, x, y);

  // Rolling digit underline
  if (prog < 0.98) {
    const W = ctx.measureText(full).width;
    const startX = align === "center" ? x - W/2 : x;
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = 0.15;
    ctx.fillRect(startX, y + 12, W * prog, 4);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// STACK LINES — editorial multi-line stack with per-line spring + color split
// ════════════════════════════════════════════════════════════════════════════
/**
 * @param {Array<{text, color?, size?, weight?}>} lines
 */
export function stackLines(ctx, lines, x, y, t, opts = {}) {
  const {
    defaultFont  = "AB",
    defaultColor = "#14213D",
    defaultSize  = 96,
    lineH        = 108,
    stagger      = 0.12,
    underlineIdx = -1,  // which line gets an accent underline
    underlineColor = "#B8312A",
    align        = "left",
    maxW         = 900,
  } = opts;

  ctx.save();

  lines.forEach((line, i) => {
    const prog  = clamp(springVal(t, i * stagger, 180, 20), 0, 1.04);
    const alpha = clamp(prog * 2.5, 0, 1);
    const dy    = (1 - clamp(prog, 0, 1)) * 36;

    const size   = line.size   || defaultSize;
    const weight = line.weight || "900";
    const family = line.font   || defaultFont;
    const color  = line.color  || defaultColor;
    const text   = typeof line === "string" ? line : line.text;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillStyle = color;
    ctx.textBaseline = "alphabetic";

    let lx = x;
    if (align === "center") lx = x - ctx.measureText(text).width / 2;
    if (align === "right")  lx = x - ctx.measureText(text).width;

    ctx.fillText(text, lx, y + i * lineH + dy);

    // Accent underline
    if (i === underlineIdx && prog > 0.5) {
      const tw  = ctx.measureText(text).width;
      const ulP = clamp((prog - 0.5) * 3, 0, 1);
      ctx.fillStyle = underlineColor;
      ctx.fillRect(lx, y + i * lineH + dy + 8, tw * ulP, 5);
    }
    ctx.restore();
  });

  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// WORD BURST — key words explode onto screen from center, scatter to positions
// ════════════════════════════════════════════════════════════════════════════
export function wordBurst(ctx, words, cx, cy, t, opts = {}) {
  const {
    font    = "900 56px AB",
    colors  = ["#B8312A", "#14213D", "#F2C230", "#4A7C59"],
    seed    = 1,
    radius  = 280,
  } = opts;

  const rng = mulberry(seed);

  ctx.save();
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  words.forEach((word, i) => {
    const delay = i * 0.08;
    const prog  = clamp(springVal(t, delay, 200, 20), 0, 1.06);
    const alpha = clamp(prog * 2, 0, 1);

    const angle = (i / words.length) * TAU + rng() * 0.4;
    const r     = radius * (0.7 + rng() * 0.6);
    const wx    = cx + Math.cos(angle) * r * prog;
    const wy    = cy + Math.sin(angle) * r * prog;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colors[i % colors.length];
    ctx.translate(wx, wy);
    ctx.rotate((1 - prog) * (rng() - 0.5) * Math.PI * 0.5);
    ctx.scale(0.5 + prog * 0.5, 0.5 + prog * 0.5);
    ctx.fillText(word, 0, 0);
    ctx.restore();
  });

  ctx.restore();
}
