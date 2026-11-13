/**
 * OpusFlow Artifacts — high-end visual artifacts for $50k-editor look.
 *
 * Newspaper clippings, Polaroids, consulting exhibits, sticky notes,
 * pull quotes, redacted reveals, annotations, ticker bars, wax seals,
 * highlight pens, index cards, comparison tables — all in Canvas 2D.
 */

import { clamp, lerp, eo, eio, spring, mulberry } from '/core/lib.js';
import { wrapText } from '/core/visual/design-system.js';
import { tape } from '/core/visual/cinema.js';

const TAU = Math.PI * 2;


// ── Shared utilities ──────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function dropShadow(ctx, blur = 24, x = 4, y = 10, color = "rgba(14,22,40,0.22)") {
  ctx.shadowOffsetX = x;
  ctx.shadowOffsetY = y;
  ctx.shadowBlur    = blur;
  ctx.shadowColor   = color;
}

function clearShadow(ctx) {
  ctx.shadowOffsetX = ctx.shadowOffsetY = ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

function rngColor(rng, palette) {
  return palette[Math.floor(rng() * palette.length)];
}


// ════════════════════════════════════════════════════════════════════════════
// NEWSPAPER CLIPPING — full editorial newspaper front-page look
// ════════════════════════════════════════════════════════════════════════════
/**
 * @param {object} content — { headline, kicker, body, byline, date, source }
 * @param {object} opts    — { x, y, w, h, rotation, seed, t }
 */
export function newspaperClipping(ctx, content, opts = {}) {
  const {
    x = 60, y = 200, w = 900, h = 500,
    rotation = -0.02, seed = 1, t = 1,
    ink = "#1a1a1a", paper = "#F5F0E6",
  } = opts;

  const prog = clamp(eo(t * 2), 0, 1);
  if (prog <= 0) return;

  const rng = mulberry(seed);

  ctx.save();
  ctx.globalAlpha = prog;
  ctx.translate(x + w/2, y + h/2);
  ctx.rotate(rotation);
  ctx.translate(-(w/2), -(h/2));

  // Paper background with slight yellowing
  dropShadow(ctx, 32, 6, 14, "rgba(0,0,0,0.3)");
  ctx.fillStyle = paper;
  roundRect(ctx, 0, 0, w, h, 2);
  ctx.fill();
  clearShadow(ctx);

  // Fine grain
  ctx.save();
  ctx.globalAlpha = 0.04;
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = rng() > 0.5 ? "#000" : "#888";
    ctx.fillRect(rng()*w, rng()*h, 1 + rng(), 1 + rng());
  }
  ctx.globalAlpha = prog;
  ctx.restore();

  // Masthead rule
  ctx.fillStyle = ink;
  ctx.fillRect(20, 20, w - 40, 2);
  ctx.fillRect(20, 26, w - 40, 1);

  // Source / date line
  ctx.font = `600 18px "Courier New", monospace`;
  ctx.fillStyle = ink;
  ctx.textAlign = "left";
  ctx.fillText((content.source || "THE DAILY BRIEF").toUpperCase(), 24, 46);
  ctx.textAlign = "right";
  ctx.fillText(content.date || new Date().toLocaleDateString("en-US", {year:"numeric",month:"long",day:"numeric"}), w - 24, 46);
  ctx.textAlign = "left";

  ctx.fillStyle = ink;
  ctx.fillRect(20, 54, w - 40, 1);

  // Kicker
  if (content.kicker) {
    ctx.font = `600 20px "Courier New", monospace`;
    ctx.fillStyle = "#555";
    ctx.fillText(content.kicker.toUpperCase(), 24, 82);
  }

  // Headline — big, condensed
  ctx.font = `900 ${Math.min(72, Math.floor(w * 0.072))}px AB`;
  ctx.fillStyle = ink;
  const hl = content.headline || "HEADLINE";
  wrapText(ctx, hl, 24, 128, w - 48, 76, { maxLines: 2 });

  // Column rule
  ctx.fillRect(w/2 - 1, 160, 1, h - 220);

  // Body copy — left column
  ctx.font = `400 22px "Courier New", monospace`;
  ctx.fillStyle = ink;
  const body = content.body || "";
  const bodyWords = body.split(" ");
  let line = "", ly = 196, colW = w / 2 - 40;
  for (const word of bodyWords) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > colW) {
      ctx.fillText(line, 24, ly);
      ly += 28; line = word;
      if (ly > h - 60) break;
    } else { line = test; }
  }
  if (line && ly < h - 60) ctx.fillText(line, 24, ly);

  // Byline
  ctx.font = `600 18px "Courier New", monospace`;
  ctx.fillStyle = "#666";
  ctx.fillText(`By ${content.byline || "Staff Reporter"}`, 24, h - 32);

  // Bottom rule
  ctx.fillStyle = ink;
  ctx.fillRect(20, h - 20, w - 40, 1);

  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// POLAROID — photo with handwritten caption, slight rotation, shadow
// ════════════════════════════════════════════════════════════════════════════
export function polaroid(ctx, img, caption, cx, cy, t, opts = {}) {
  const {
    size       = 300,  // photo area width
    rotation   = -0.04,
    seed       = 1,
    captionFont = "italic 28px Georgia, serif",
    inkColor    = "#2C2416",
  } = opts;

  const prog = clamp(eo(t * 2.5), 0, 1);
  if (prog <= 0) return;

  const border = 18;
  const bottom = 80;  // caption area
  const tw = size + border * 2;
  const th = size + border + bottom;

  ctx.save();
  ctx.globalAlpha = prog;
  ctx.translate(cx, cy);
  ctx.rotate(rotation * (1 - prog * 0.1));
  ctx.scale(0.6 + prog * 0.4, 0.6 + prog * 0.4);

  dropShadow(ctx, 28, 4, 12, "rgba(0,0,0,0.35)");
  ctx.fillStyle = "#FDFAF4";
  roundRect(ctx, -tw/2, -th/2, tw, th, 3);
  ctx.fill();
  clearShadow(ctx);

  // Photo area
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-tw/2 + border, -th/2 + border, size, size);
    ctx.clip();
    const ar = img.naturalWidth / img.naturalHeight;
    const ph = size / ar;
    ctx.drawImage(img, -tw/2 + border, -th/2 + border + (size - ph)/2, size, ph);
    // Photo overlay — slightly desaturated, warmer
    ctx.fillStyle = "rgba(255,210,170,0.08)";
    ctx.fillRect(-tw/2 + border, -th/2 + border, size, size);
    ctx.restore();
  } else {
    ctx.fillStyle = "#D4CAB8";
    ctx.fillRect(-tw/2 + border, -th/2 + border, size, size);
  }

  // Handwritten caption
  ctx.font = captionFont;
  ctx.fillStyle = inkColor;
  ctx.textAlign = "center";
  ctx.fillText(caption || "", 0, th/2 - 24);

  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// STICKY NOTE — post-it with slight rotation and curl shadow
// ════════════════════════════════════════════════════════════════════════════
const STICKY_COLORS = {
  yellow: { bg: "#FFE55C", shadow: "rgba(200,160,0,0.25)", text: "#2C2416" },
  blue:   { bg: "#A8DAFF", shadow: "rgba(0,80,180,0.18)", text: "#0A2444" },
  pink:   { bg: "#FFB3C6", shadow: "rgba(180,0,80,0.18)",  text: "#3A0020" },
  green:  { bg: "#B6F2C0", shadow: "rgba(0,120,40,0.18)",  text: "#0A2810" },
  white:  { bg: "#F8F4EE", shadow: "rgba(0,0,0,0.15)",     text: "#1A1410" },
};

export function stickyNote(ctx, lines, x, y, t, opts = {}) {
  const {
    w        = 340,
    color    = "yellow",
    rotation = 0.04,
    seed     = 1,
    font     = "400 32px 'AR', sans-serif",
    titleFont = "700 36px 'AR', sans-serif",
  } = opts;

  const prog = clamp(eo(t * 2.5), 0, 1);
  if (prog <= 0) return;

  const rng     = mulberry(seed);
  const palette = STICKY_COLORS[color] || STICKY_COLORS.yellow;
  const lineH   = 42;
  const pad     = 28;
  const h       = pad * 2 + lines.length * lineH;

  ctx.save();
  ctx.globalAlpha = prog;
  ctx.translate(x + w/2, y + h/2);
  ctx.rotate(rotation);
  ctx.translate(-w/2, -h/2);

  // Curl shadow
  ctx.save();
  ctx.fillStyle = palette.shadow;
  ctx.beginPath();
  ctx.ellipse(w - 24, h, 28, 10, Math.PI/4, 0, TAU);
  ctx.fill();
  ctx.restore();

  dropShadow(ctx, 16, 2, 6, palette.shadow);
  ctx.fillStyle = palette.bg;
  roundRect(ctx, 0, 0, w, h, 3);
  ctx.fill();
  clearShadow(ctx);

  // Top fold line (like a physical sticky note)
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.fillRect(0, 0, w, 8);

  // Lines
  lines.forEach((line, i) => {
    const isTitle = i === 0 && lines.length > 1;
    ctx.font = isTitle ? titleFont : font;
    ctx.fillStyle = palette.text;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillText(typeof line === "string" ? line : line.text, pad, pad + lineH * i + lineH * 0.72);
    // Ruled line
    if (!isTitle) {
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(pad, pad + lineH * i + lineH - 6, w - pad * 2, 1);
    }
  });

  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// CONSULTING EXHIBIT — McKinsey/BCG numbered exhibit with source citation
// ════════════════════════════════════════════════════════════════════════════
export function consultingExhibit(ctx, x, y, w, h, content, t, opts = {}) {
  const {
    firm   = "McKinsey & Company",
    number = "Exhibit 1",
    bg     = "#FFFFFF",
    ink    = "#1A1A2E",
    accent = "#003087",  // McKinsey blue
    source = "",
  } = opts;

  const prog = clamp(eo(t * 2), 0, 1);
  if (prog <= 0) return;

  ctx.save();
  ctx.globalAlpha = prog;

  dropShadow(ctx, 20, 3, 8, "rgba(0,0,48,0.15)");
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, 2);
  ctx.fill();
  clearShadow(ctx);

  // Top bar
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, w, 8);

  // Header area
  ctx.fillStyle = ink;
  ctx.font = `600 20px "AR", sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(firm.toUpperCase(), x + 20, y + 36);

  ctx.font = `900 28px AB`;
  ctx.fillText(number, x + 20, y + 68);

  if (content.title) {
    ctx.font = `600 36px AB`;
    ctx.fillStyle = ink;
    wrapText(ctx, content.title, x + 20, y + 112, w - 40, 42, { maxLines: 2 });
  }

  // Divider
  ctx.fillStyle = "rgba(0,48,135,0.15)";
  ctx.fillRect(x + 20, y + 128, w - 40, 1);

  // Content area — delegated to caller via callback
  if (typeof content.draw === "function") {
    content.draw(ctx, x + 20, y + 148, w - 40, h - 200);
  }

  // Source line
  ctx.font = `400 18px "AR", monospace`;
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.textAlign = "left";
  if (source) ctx.fillText(`Source: ${source}`, x + 20, y + h - 16);

  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// PULL QUOTE — large editorial pull-quote with accent rule
// ════════════════════════════════════════════════════════════════════════════
export function pullQuote(ctx, quote, attribution, x, y, w, t, opts = {}) {
  const {
    quoteFont  = "italic 56px Georgia, serif",
    attribFont = "600 28px AR",
    color      = "#14213D",
    accentColor = "#B8312A",
    quoteMarkSize = 120,
    align      = "left",
  } = opts;

  const prog = clamp(eo(t * 1.8), 0, 1);
  if (prog <= 0) return;

  ctx.save();
  ctx.globalAlpha = prog;

  // Giant quotation mark
  ctx.font = `900 ${quoteMarkSize}px Georgia, serif`;
  ctx.fillStyle = accentColor;
  ctx.globalAlpha = prog * 0.15;
  ctx.fillText("“", x, y + quoteMarkSize * 0.8);
  ctx.globalAlpha = prog;

  // Accent rule
  const ruleW = w * clamp(t * 2.5, 0, 1);
  ctx.fillStyle = accentColor;
  ctx.fillRect(x, y - 8, ruleW, 4);

  // Quote text
  ctx.font = quoteFont;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";
  wrapText(ctx, `“${quote}”`, x, y + 48, w, 64, { maxLines: 5 });

  // Attribution
  if (attribution) {
    const lineCount = Math.ceil(ctx.measureText(quote).width / (w * 60 / 56));
    const attY = y + 48 + Math.max(1, lineCount) * 68 + 24;
    ctx.font = attribFont;
    ctx.fillStyle = accentColor;
    ctx.fillText(`— ${attribution}`, x, attY);
  }

  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// ANNOTATION — hand-drawn circle callout + arrow pointing to a data element
// ════════════════════════════════════════════════════════════════════════════
export function annotation(ctx, fromX, fromY, toX, toY, label, t, opts = {}) {
  const {
    color  = "#B8312A",
    font   = "700 28px AR",
    circleR = 40,
    seed   = 1,
  } = opts;

  const prog = clamp(t * 2.5, 0, 1);
  if (prog <= 0) return;

  const rng = mulberry(seed);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = 3;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";

  // Hand-drawn arrow (slightly wobbly)
  const steps = 12;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  for (let i = 1; i <= Math.floor(steps * prog); i++) {
    const p  = i / steps;
    const ix = lerp(fromX, toX, p) + (rng() - 0.5) * 6;
    const iy = lerp(fromY, toY, p) + (rng() - 0.5) * 6;
    ctx.lineTo(ix, iy);
  }
  ctx.stroke();

  // Arrowhead (when line is complete enough)
  if (prog > 0.8) {
    const alpha = clamp((prog - 0.8) * 5, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.translate(toX, toY);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-16, -8);
    ctx.lineTo(-16, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Wobbly circle callout at fromX, fromY
  if (circleR > 0 && prog > 0.3) {
    const circleProg = clamp((prog - 0.3) / 0.7, 0, 1);
    const rng2 = mulberry(seed + 7);
    const steps2 = 32;
    ctx.beginPath();
    for (let i = 0; i <= Math.floor(steps2 * circleProg); i++) {
      const angle = (i / steps2) * TAU - Math.PI / 2;
      const jitter = 1 + (rng2() - 0.5) * 0.15;
      const px = fromX + Math.cos(angle) * circleR * jitter;
      const py = fromY + Math.sin(angle) * circleR * jitter;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Label
  if (label && prog > 0.6) {
    const labelProg = clamp((prog - 0.6) * 2.5, 0, 1);
    ctx.save();
    ctx.globalAlpha = labelProg;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.fillText(label, fromX + circleR + 8, fromY + 10);
    ctx.restore();
  }

  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// REDACTED REVEAL — classified document redaction that peels away
// ════════════════════════════════════════════════════════════════════════════
export function redactedReveal(ctx, text, x, y, w, t, opts = {}) {
  const {
    font       = "400 44px AR",
    color      = "#14213D",
    barColor   = "#0A0A0A",
    revealAt   = 0.5,  // t at which redaction starts lifting
  } = opts;

  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";

  const size     = parseInt(font);
  const tw       = ctx.measureText(text).width;
  const barH     = size * 1.1;

  // Always draw text underneath
  ctx.fillText(text, x, y);

  // Redaction bar that reveals left-to-right after revealAt
  const revealProg = t < revealAt ? 1 : clamp(1 - (t - revealAt) / 0.4, 0, 1);
  if (revealProg > 0.01) {
    ctx.fillStyle = barColor;
    ctx.fillRect(x - 4, y - barH * 0.85, (tw + 8) * revealProg, barH);
  }

  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// BREAKING NEWS TICKER — scrolling lower-third news bar
// ════════════════════════════════════════════════════════════════════════════
export function breakingTicker(ctx, headline, y, t, W, opts = {}) {
  const {
    bgColor   = "#CC0000",
    textColor = "#FFFFFF",
    labelBg   = "#FFFFFF",
    labelText = "#CC0000",
    font      = "700 32px AB",
    h         = 68,
    scrollSpeed = 0.3,  // canvas widths per second
  } = opts;

  const slideIn = clamp(eo(t * 4), 0, 1);
  const slideY  = y + (1 - slideIn) * h;

  ctx.save();

  // Background bar
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, slideY, W, h);

  // BREAKING label
  ctx.fillStyle = labelBg;
  ctx.fillRect(0, slideY, 220, h);
  ctx.font = `900 24px AB`;
  ctx.fillStyle = labelText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("BREAKING", 110, slideY + h/2);

  // Scrolling text
  ctx.font = font;
  ctx.fillStyle = textColor;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  // Clip to ticker area
  ctx.save();
  ctx.rect(230, slideY, W - 230, h);
  ctx.clip();

  const textW  = ctx.measureText(headline + "   •   ").width;
  const offset = ((t * scrollSpeed * W) % (textW + W - 230));
  ctx.fillText(headline + "   •   " + headline, 230 - offset, slideY + h/2);

  ctx.restore();

  // Separator
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(224, slideY); ctx.lineTo(224, slideY + h);
  ctx.stroke();

  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// HIGHLIGHT PEN — marker highlight over text, like a physical highlighter
// ════════════════════════════════════════════════════════════════════════════
export function highlightPen(ctx, x, y, w, t, opts = {}) {
  const {
    color  = "rgba(255,230,0,0.55)",
    h      = 28,
    angle  = 0.008,
    seed   = 1,
  } = opts;

  const prog = clamp(eo(t * 3), 0, 1);
  if (prog <= 0) return;

  const rng = mulberry(seed);

  ctx.save();
  ctx.translate(x + w * prog / 2, y);
  ctx.rotate(angle);
  ctx.translate(-(w * prog / 2), 0);

  // Slightly irregular highlight strokes
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    ctx.moveTo(0, (rng() - 0.5) * 4);
    for (let i = 1; i <= 8; i++) {
      const px = (w * prog) * (i / 8);
      const py = (rng() - 0.5) * h * 0.3 + (pass === 1 ? 4 : 0);
      ctx.lineTo(px, py);
    }
    ctx.lineTo(w * prog, h * 0.6);
    ctx.lineTo(0, h * 0.6);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// WAX SEAL — circular seal with text, like on official documents
// ════════════════════════════════════════════════════════════════════════════
export function waxSeal(ctx, cx, cy, r, text, t, opts = {}) {
  const {
    color   = "#8B0000",
    textColor = "#F5E6D0",
    font    = "900 20px AB",
    seed    = 3,
  } = opts;

  const prog = clamp(eo(t * 3), 0, 1);
  if (prog <= 0) return;

  const rng = mulberry(seed);

  ctx.save();
  ctx.globalAlpha = prog;
  ctx.translate(cx, cy);
  ctx.scale(prog, prog);

  // Wax blob — irregular circle
  ctx.fillStyle = color;
  dropShadow(ctx, 12, 2, 4, "rgba(0,0,0,0.4)");
  ctx.beginPath();
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const angle  = (i / steps) * TAU;
    const jitter = r * (0.9 + rng() * 0.2);
    const px = Math.cos(angle) * jitter;
    const py = Math.sin(angle) * jitter;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  clearShadow(ctx);

  // Inner circle
  ctx.strokeStyle = textColor;
  ctx.lineWidth = 2;
  ctx.globalAlpha = prog * 0.5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.75, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = prog;

  // Text around arc
  ctx.font = font;
  ctx.fillStyle = textColor;
  ctx.textAlign  = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), 0, 0);

  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// INDEX CARD — 3×5 card with typed facts, paper clip optional
// ════════════════════════════════════════════════════════════════════════════
export function indexCard(ctx, title, bullets, x, y, t, opts = {}) {
  const {
    w        = 580,
    rotation = 0.02,
    seed     = 1,
    paperClip = false,
    ink      = "#1a1a1a",
    paper    = "#FEFCF8",
  } = opts;

  const lineH   = 38;
  const h       = 60 + 36 + bullets.length * lineH + 32;
  const prog    = clamp(eo(t * 2.5), 0, 1);
  if (prog <= 0) return;

  const rng = mulberry(seed);

  ctx.save();
  ctx.globalAlpha = prog;
  ctx.translate(x + w/2, y + h/2);
  ctx.rotate(rotation);
  ctx.translate(-w/2, -h/2);

  dropShadow(ctx, 20, 3, 8, "rgba(0,0,0,0.25)");
  ctx.fillStyle = paper;
  roundRect(ctx, 0, 0, w, h, 3);
  ctx.fill();
  clearShadow(ctx);

  // Ruled lines
  ctx.strokeStyle = "rgba(0,100,200,0.15)";
  ctx.lineWidth = 1;
  for (let i = 0; i < bullets.length + 2; i++) {
    const ly = 60 + i * lineH;
    ctx.beginPath(); ctx.moveTo(16, ly); ctx.lineTo(w - 16, ly); ctx.stroke();
  }
  // Red margin line
  ctx.strokeStyle = "rgba(200,0,0,0.3)";
  ctx.beginPath(); ctx.moveTo(48, 0); ctx.lineTo(48, h); ctx.stroke();

  // Title
  ctx.font = `900 30px "Courier New", monospace`;
  ctx.fillStyle = "#003087";
  ctx.textAlign = "left";
  ctx.fillText(title, 56, 44);

  // Bullets
  ctx.font = `400 24px "Courier New", monospace`;
  ctx.fillStyle = ink;
  bullets.forEach((b, i) => {
    ctx.fillText(`• ${b}`, 56, 60 + 36 + i * lineH + lineH * 0.72);
  });

  // Paper clip
  if (paperClip) {
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(w - 48, -20);
    ctx.quadraticCurveTo(w - 20, -20, w - 20, 20);
    ctx.quadraticCurveTo(w - 20, 60, w - 48, 60);
    ctx.quadraticCurveTo(w - 76, 60, w - 76, 20);
    ctx.quadraticCurveTo(w - 76, -4, w - 56, -4);
    ctx.stroke();
  }

  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// COMPARISON TABLE — clean side-by-side table in report style
// ════════════════════════════════════════════════════════════════════════════
/**
 * @param {Array<{label, left, right}>} rows
 * @param {string} headerLeft, headerRight
 */
export function comparisonTable(ctx, rows, headerLeft, headerRight,
                                 x, y, w, t, opts = {}) {
  const {
    rowH       = 60,
    ink        = "#14213D",
    headerBg   = "#14213D",
    headerText = "#FFFFFF",
    altBg      = "rgba(20,33,61,0.04)",
    accentColor = "#B8312A",
    font        = "400 28px AR",
    headerFont  = "700 28px AB",
    labelFont   = "600 28px AR",
  } = opts;

  const h    = rowH * (rows.length + 1) + 2;
  const prog = clamp(eo(t * 2), 0, 1);
  if (prog <= 0) return;
  const colW = (w - 240) / 2;

  ctx.save();
  ctx.globalAlpha = prog;

  dropShadow(ctx, 16, 2, 6, "rgba(0,0,0,0.12)");
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  clearShadow(ctx);

  // Header
  ctx.fillStyle = headerBg;
  roundRect(ctx, x, y, w, rowH, [4, 4, 0, 0]);
  ctx.fill();

  ctx.font = headerFont;
  ctx.fillStyle = headerText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(headerLeft,  x + 240 + colW / 2, y + rowH / 2);
  ctx.fillText(headerRight, x + 240 + colW + colW / 2, y + rowH / 2);

  ctx.font = headerFont;
  ctx.textAlign = "left";
  ctx.fillText("", x + 20, y + rowH / 2);

  // Rows
  rows.forEach((row, i) => {
    const ry  = y + (i + 1) * rowH;
    const rowProg = clamp((prog - i * 0.06) * 3, 0, 1);

    if (i % 2 === 1) {
      ctx.fillStyle = altBg;
      ctx.fillRect(x, ry, w * rowProg, rowH);
    }

    ctx.save();
    ctx.globalAlpha = rowProg;
    ctx.font = labelFont;
    ctx.fillStyle = ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(row.label, x + 20, ry + rowH / 2);

    ctx.font = font;
    ctx.textAlign = "center";
    ctx.fillText(String(row.left),  x + 240 + colW / 2,          ry + rowH / 2);
    ctx.fillStyle = row.highlight === "right" ? accentColor : ink;
    ctx.fillText(String(row.right), x + 240 + colW + colW / 2,   ry + rowH / 2);

    ctx.restore();

    // Row rule
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, ry + rowH);
    ctx.lineTo(x + w * prog, ry + rowH);
    ctx.stroke();
  });

  // Column separator
  ctx.strokeStyle = "rgba(0,0,0,0.1)";
  ctx.lineWidth = 1;
  [240, 240 + colW].forEach(ox => {
    ctx.beginPath();
    ctx.moveTo(x + ox, y);
    ctx.lineTo(x + ox, y + h * prog);
    ctx.stroke();
  });

  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// STAMP SEAL — rubber stamp "CONFIDENTIAL" / "APPROVED" etc.
// ════════════════════════════════════════════════════════════════════════════
export function stampSeal(ctx, text, cx, cy, t, opts = {}) {
  const {
    color   = "rgba(180,20,20,0.75)",
    font    = "900 52px AB",
    padding = 20,
    angle   = -0.18,
    seed    = 2,
  } = opts;

  const rng = mulberry(seed);
  const prog = clamp(eo(t * 4), 0, 1);
  if (prog <= 0) return;

  ctx.save();
  ctx.globalAlpha = prog * 0.9;
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  ctx.font = font;
  const tw = ctx.measureText(text).width;
  const th = parseInt(font);

  // Stamp border — double rectangle
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.strokeRect(-tw/2 - padding, -th*0.6 - padding/2, tw + padding*2, th + padding);
  ctx.lineWidth = 2;
  ctx.strokeRect(-tw/2 - padding - 6, -th*0.6 - padding/2 - 6, tw + padding*2 + 12, th + padding + 12);

  // Stamp text with ink bleed (slightly blurry)
  ctx.shadowBlur = 2;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 0);
  ctx.shadowBlur = 0;

  // Ink speckles (authentic worn stamp look)
  ctx.fillStyle = color;
  for (let i = 0; i < 20; i++) {
    if (rng() > 0.6) {
      ctx.globalAlpha = prog * rng() * 0.4;
      ctx.beginPath();
      ctx.arc(
        (rng() - 0.5) * (tw + padding * 2),
        (rng() - 0.5) * (th + padding),
        rng() * 3, 0, TAU
      );
      ctx.fill();
    }
  }

  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// DEPTH LAYER SYSTEM — 3-plane parallax for cinematic depth
// ════════════════════════════════════════════════════════════════════════════
/**
 * Wrap draw calls with a parallax offset based on layer depth.
 * depth: 0=background (slow), 0.5=mid, 1=foreground (fast)
 * scrollT: normalized scroll/zoom time (can be scene time)
 */
export function withParallax(ctx, depth, scrollT, amplitude, drawFn) {
  const offset = (depth - 0.5) * amplitude * Math.sin(scrollT * Math.PI * 0.4);
  ctx.save();
  ctx.translate(0, offset);
  drawFn(ctx);
  ctx.restore();
}


// ════════════════════════════════════════════════════════════════════════════
// FILM FRAME BORDER — subtle cinematic frame overlay (letterbox / 2.39:1)
// ════════════════════════════════════════════════════════════════════════════
export function filmFrameBorder(ctx, W, H, t, opts = {}) {
  const {
    bars     = false,  // true = black letterbox bars
    barH     = H * 0.07,
    scratches = true,
    seed     = 1,
  } = opts;

  const rng = mulberry(seed + Math.floor(t * 24));

  ctx.save();

  if (bars) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, barH);
    ctx.fillRect(0, H - barH, W, barH);
  }

  // Film scratches — vertical lines that flash on randomly
  if (scratches) {
    for (let i = 0; i < 3; i++) {
      if (rng() > 0.85) {
        const sx = rng() * W;
        ctx.save();
        ctx.globalAlpha = rng() * 0.15;
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 0.5 + rng();
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx + (rng() - 0.5) * 8, H);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Subtle corner vignette darkening
  const grad = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.75);
  grad.addColorStop(0, "transparent");
  grad.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.restore();
}
