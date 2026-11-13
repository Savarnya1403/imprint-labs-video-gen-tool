/**
 * code_patterns.js — Canvas 2D drawing recipes trained on the 286-image library.
 *
 * Every pattern here was derived by studying the visual features extracted
 * from the training images (dominant palettes, layout types, edge density,
 * color temperature). No images needed at runtime — these are pure code.
 *
 * Usage:
 *   import { drawPattern, PATTERNS, pickPattern } from '/core/visual/code_patterns.js';
 *   drawPattern(ctx, W, H, 'EDITORIAL_GRID', { headline:'...', body:'...', t:0.6 });
 */

import { mulberry } from '/core/lib.js';

// ── shared micro-utilities ────────────────────────────────────────────────────

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = (text || '').split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trim(), x, cy);
      line = word + ' ';
      cy += lineH;
    } else {
      line = test;
    }
  }
  if (line.trim()) ctx.fillText(line.trim(), x, cy);
  return cy + lineH;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function paperGrain(ctx, x, y, w, h, seed, alpha = 0.025) {
  const rng = mulberry(seed);
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = `rgba(80,60,30,${rng() * alpha})`;
    ctx.fillRect(x + rng() * w, y + rng() * h, 1, 1);
  }
}

function inkSpeckle(ctx, x, y, w, h, seed, alpha = 0.03) {
  const rng = mulberry(seed);
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = `rgba(20,15,10,${rng() * alpha})`;
    const r = rng() * 2.5 + 0.5;
    ctx.beginPath();
    ctx.arc(x + rng() * w, y + rng() * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function ruleLines(ctx, x, y, w, h, spacing, color = 'rgba(26,26,26,0.07)') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let ly = y + spacing; ly < y + h; ly += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, ly);
    ctx.lineTo(x + w, ly);
    ctx.stroke();
  }
}

function gridLines(ctx, W, H, spacing, color = 'rgba(180,160,130,0.22)') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += spacing) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += spacing) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
}

function tornEdge(ctx, x, y, w, seed, amplitude = 8) {
  const rng = mulberry(seed);
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let px = x; px <= x + w; px += 6) {
    ctx.lineTo(px, y + (rng() - 0.5) * amplitude * 2);
  }
  ctx.lineTo(x + w, y);
  ctx.closePath();
}

function accentBar(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// ── PATTERN REGISTRY ─────────────────────────────────────────────────────────

export const PATTERNS = {

  // ── EDITORIAL_CREAM ── warm cream, Swiss type, rule lines, dateline ──────
  EDITORIAL_GRID: {
    name: 'Editorial Grid',
    style: 'EDITORIAL_CREAM',
    moods: ['editorial', 'calm'],
    draw(ctx, W, H, { headline = '', body = '', label = '', accent = '#E05C2A', t = 1 }) {
      // base
      ctx.fillStyle = '#F5EFE0';
      ctx.fillRect(0, 0, W, H);
      paperGrain(ctx, 0, 0, W, H, 101);
      ruleLines(ctx, 48, 220, W - 96, H - 220, 46);

      // dateline bar
      accentBar(ctx, 48, 220, W - 96, 2, '#1A1A1A');

      // label (category tag)
      if (label) {
        ctx.font = `700 ${Math.floor(W * 0.028)}px 'Arial', sans-serif`;
        ctx.fillStyle = accent;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(label.toUpperCase(), 48, 170);
      }

      // headline — giant, one word per line
      const hSz = Math.floor(W * 0.082);
      ctx.font = `900 ${hSz}px 'Arial Black', sans-serif`;
      ctx.fillStyle = '#1A1A1A';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const words = (headline || '').split(' ');
      let hy = 240;
      const revealWords = Math.ceil(words.length * Math.min(1, t * 2));
      for (let i = 0; i < revealWords; i++) {
        ctx.fillText(words[i], 48, hy);
        hy += hSz * 1.1;
      }

      // body text
      if (body && t > 0.5) {
        const bodyT = Math.min(1, (t - 0.5) * 3);
        ctx.globalAlpha = bodyT;
        ctx.font = `400 ${Math.floor(W * 0.036)}px Georgia, serif`;
        ctx.fillStyle = '#3A3A3A';
        wrapText(ctx, body, 48, hy + 30, W - 96, 52);
        ctx.globalAlpha = 1;
      }

      // bottom rule
      accentBar(ctx, 48, H - 90, W - 96, 2, '#1A1A1A');
      ctx.font = `400 ${Math.floor(W * 0.025)}px 'Arial', sans-serif`;
      ctx.fillStyle = '#888';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('IMPRINT LABS', 48, H - 60);
    }
  },

  EDITORIAL_SPLIT: {
    name: 'Editorial Split Column',
    style: 'EDITORIAL_CREAM',
    moods: ['editorial', 'calm'],
    draw(ctx, W, H, { headline = '', stat = '', statLabel = '', accent = '#E05C2A', t = 1 }) {
      ctx.fillStyle = '#FBF7EE';
      ctx.fillRect(0, 0, W, H);
      paperGrain(ctx, 0, 0, W, H, 77);

      // left accent strip
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, 10, H);

      // big stat box — upper half
      ctx.fillStyle = '#1A1A1A';
      ctx.fillRect(0, 0, W, H * 0.42);
      ctx.fillStyle = accent;
      ctx.fillRect(0, H * 0.42, W, 6);

      // stat number
      const statSz = Math.floor(W * 0.22);
      ctx.font = `900 ${statSz}px 'Arial Black', sans-serif`;
      ctx.fillStyle = '#F5EFE0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = Math.min(1, t * 2.5);
      ctx.fillText(stat, W / 2, H * 0.21);
      ctx.globalAlpha = 1;

      ctx.font = `700 ${Math.floor(W * 0.038)}px 'Arial', sans-serif`;
      ctx.fillStyle = accent;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(statLabel, W / 2, H * 0.36);

      // headline below
      const hSz = Math.floor(W * 0.072);
      ctx.font = `900 ${hSz}px 'Arial Black', sans-serif`;
      ctx.fillStyle = '#1A1A1A';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.globalAlpha = Math.min(1, (t - 0.3) * 3);
      wrapText(ctx, headline, 48, H * 0.46, W - 96, hSz * 1.15);
      ctx.globalAlpha = 1;
    }
  },

  // ── BOLD_TYPOGRAPHIC ── oversized stacked words, minimal, BW accent ───────
  WORD_STACK: {
    name: 'Word Stack',
    style: 'BOLD_TYPOGRAPHIC',
    moods: ['neutral', 'dramatic'],
    draw(ctx, W, H, { words = [], accent = '#E05C2A', bg = '#FAFAF8', ink = '#0D0D0D', t = 1 }) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const sz = Math.floor(W * 0.135);
      ctx.font = `900 ${sz}px 'Arial Black', 'Impact', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      let y = 160;
      const revealCount = Math.ceil(words.length * Math.min(1, t * 2));
      for (let i = 0; i < revealCount; i++) {
        // alternating ink / accent for drama
        ctx.fillStyle = i % 3 === 1 ? accent : ink;
        ctx.fillText(words[i], 48, y);
        y += sz * 1.08;
      }

      // accent underline
      if (t > 0.6) {
        const p = Math.min(1, (t - 0.6) * 3);
        ctx.fillStyle = accent;
        ctx.fillRect(48, y + 12, (W - 96) * p, 7);
      }
    }
  },

  KINETIC_HEADLINE: {
    name: 'Kinetic Headline',
    style: 'BOLD_TYPOGRAPHIC',
    moods: ['neutral', 'energetic'],
    draw(ctx, W, H, { headline = '', sub = '', accent = '#E50914', t = 1 }) {
      ctx.fillStyle = '#F0EDE6';
      ctx.fillRect(0, 0, W, H);

      // giant italic headline with offset shadow
      const sz = Math.floor(W * 0.11);
      ctx.font = `900 italic ${sz}px 'Arial Black', sans-serif`;

      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      wrapText(ctx, headline, 52, 262, W - 96, sz * 1.1);

      // main
      ctx.fillStyle = '#0D0D0D';
      const p = Math.min(1, t * 2);
      ctx.globalAlpha = p;
      wrapText(ctx, headline, 48, 258, W - 96, sz * 1.1);
      ctx.globalAlpha = 1;

      // sub
      if (sub && t > 0.4) {
        ctx.globalAlpha = Math.min(1, (t - 0.4) * 3);
        ctx.font = `400 ${Math.floor(W * 0.038)}px Georgia, serif`;
        ctx.fillStyle = '#555';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(sub, 48, H * 0.72);
        ctx.globalAlpha = 1;
      }

      // bottom accent bar
      const bp = Math.min(1, t * 3);
      accentBar(ctx, 0, H - 12, W * bp, 12, accent);
    }
  },

  // ── RETRO_GRID ── browser window cards, cream grid, badge stickers ─────────
  BROWSER_CARD: {
    name: 'Browser Window Card',
    style: 'RETRO_GRID',
    moods: ['energetic', 'neutral'],
    draw(ctx, W, H, { title = '', body = '', badge = '', t = 1 }) {
      ctx.fillStyle = '#FBF7EE';
      ctx.fillRect(0, 0, W, H);
      gridLines(ctx, W, H, 40);

      const PAD  = 56;
      const CY   = 260;
      const CW   = W - PAD * 2;
      const CH   = H * 0.52;

      // card shadow
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      roundRect(ctx, PAD + 6, CY + 8, CW, CH, 20);
      ctx.fill();

      // card body
      ctx.fillStyle = '#4B7BE5';
      roundRect(ctx, PAD, CY, CW, CH, 20);
      ctx.fill();

      // traffic lights
      const tl = ['#E05C2A', '#F5C842', '#4FB04F'];
      tl.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(PAD + 28 + i * 30, CY + 26, 11, 0, Math.PI * 2);
        ctx.fill();
      });

      // title inside card
      if (title) {
        const tsz = Math.floor(CW * 0.11);
        ctx.font = `900 ${tsz}px 'Arial Black', sans-serif`;
        ctx.fillStyle = '#F5C842';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = Math.min(1, t * 2.5);
        ctx.fillText(title, PAD + CW / 2, CY + CH * 0.5);
        ctx.globalAlpha = 1;
      }

      // badge sticker
      if (badge && t > 0.5) {
        const bx = W - PAD - 110, by = CY - 50;
        ctx.save();
        ctx.translate(bx + 55, by + 55);
        ctx.rotate(0.18);
        ctx.fillStyle = '#D45D1E';
        roundRect(ctx, -55, -28, 110, 56, 8);
        ctx.fill();
        ctx.font = `700 ${Math.floor(W * 0.03)}px 'Arial Black', sans-serif`;
        ctx.fillStyle = '#FFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badge.toUpperCase(), 0, 0);
        ctx.restore();
      }

      // body below card
      if (body && t > 0.6) {
        ctx.globalAlpha = Math.min(1, (t - 0.6) * 4);
        ctx.font = `500 ${Math.floor(W * 0.038)}px 'Arial', sans-serif`;
        ctx.fillStyle = '#333';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        wrapText(ctx, body, PAD, CY + CH + 40, CW, 54);
        ctx.globalAlpha = 1;
      }
    }
  },

  // ── DARK_COLLAGE ── near-black, bold color blocks, BW cutout areas ─────────
  DARK_EDITORIAL: {
    name: 'Dark Editorial',
    style: 'DARK_COLLAGE',
    moods: ['dramatic', 'serious'],
    draw(ctx, W, H, { headline = '', sub = '', accent1 = '#E50914', accent2 = '#1D9BF0', t = 1 }) {
      ctx.fillStyle = '#161616';
      ctx.fillRect(0, 0, W, H);
      inkSpeckle(ctx, 0, 0, W, H, 55, 0.02);

      // color block — lower left
      ctx.fillStyle = accent1;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(0, H * 0.55, W * 0.44, H * 0.24);
      ctx.globalAlpha = 1;

      // color block — upper right
      ctx.fillStyle = accent2;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(W * 0.62, H * 0.08, W * 0.38, H * 0.18);
      ctx.globalAlpha = 1;

      // headline
      const sz = Math.floor(W * 0.098);
      ctx.font = `900 ${sz}px 'Arial Black', sans-serif`;
      ctx.fillStyle = '#F5F0E8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.globalAlpha = Math.min(1, t * 2);
      wrapText(ctx, headline, 48, 220, W - 96, sz * 1.12);
      ctx.globalAlpha = 1;

      // sub
      if (sub && t > 0.45) {
        ctx.globalAlpha = Math.min(1, (t - 0.45) * 3);
        ctx.font = `400 italic ${Math.floor(W * 0.036)}px Georgia, serif`;
        ctx.fillStyle = '#AAA';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        wrapText(ctx, sub, 48, H * 0.72, W - 96, 52);
        ctx.globalAlpha = 1;
      }

      // top rule
      accentBar(ctx, 0, 60, W, 2, accent1);
      accentBar(ctx, 0, 65, W, 2, '#333');
    }
  },

  DARK_STAT: {
    name: 'Dark Stat Card',
    style: 'DARK_COLLAGE',
    moods: ['dramatic', 'serious'],
    draw(ctx, W, H, { stat = '', statLabel = '', headline = '', accent = '#E50914', t = 1 }) {
      ctx.fillStyle = '#0F0F0F';
      ctx.fillRect(0, 0, W, H);
      inkSpeckle(ctx, 0, 0, W, H, 23, 0.025);

      // full-width accent bar at top
      accentBar(ctx, 0, 0, W, 8, accent);

      // big number
      const nSz = Math.floor(W * 0.26);
      ctx.font = `900 ${nSz}px 'Arial Black', sans-serif`;
      ctx.fillStyle = accent;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = Math.min(1, t * 3);
      ctx.fillText(stat, W / 2, H * 0.35);
      ctx.globalAlpha = 1;

      // stat label
      ctx.font = `700 ${Math.floor(W * 0.042)}px 'Arial', sans-serif`;
      ctx.fillStyle = '#AAA';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.globalAlpha = Math.min(1, (t - 0.2) * 3);
      ctx.fillText(statLabel.toUpperCase(), W / 2, H * 0.52);
      ctx.globalAlpha = 1;

      // headline
      if (headline && t > 0.5) {
        ctx.globalAlpha = Math.min(1, (t - 0.5) * 3);
        ctx.font = `400 ${Math.floor(W * 0.038)}px Georgia, serif`;
        ctx.fillStyle = '#F0EDE6';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        wrapText(ctx, headline, 48, H * 0.66, W - 96, 52);
        ctx.globalAlpha = 1;
      }

      // bottom rule
      accentBar(ctx, 0, H - 6, W, 6, '#222');
    }
  },

  // ── TEAL_EDITORIAL ── teal bg, cream cards, strong poster hierarchy ────────
  TEAL_POSTER: {
    name: 'Teal Poster',
    style: 'TEAL_EDITORIAL',
    moods: ['editorial', 'energetic'],
    draw(ctx, W, H, { headline = '', sub = '', tag = '', t = 1 }) {
      ctx.fillStyle = '#E8F4F4';
      ctx.fillRect(0, 0, W, H);

      // teal top bar
      ctx.fillStyle = '#2A6F6F';
      ctx.fillRect(0, 0, W, 90);
      // teal bottom bar
      ctx.fillStyle = '#2A6F6F';
      ctx.fillRect(0, H - 90, W, 90);

      // cream card
      const cy = 160, ch = H * 0.56;
      ctx.fillStyle = '#FDFAF3';
      ctx.shadowColor = 'rgba(42,111,111,0.18)';
      ctx.shadowBlur = 20;
      ctx.fillRect(50, cy, W - 100, ch);
      ctx.shadowBlur = 0;

      // tag
      if (tag) {
        ctx.font = `700 ${Math.floor(W * 0.028)}px 'Arial', sans-serif`;
        ctx.fillStyle = '#2A6F6F';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(tag.toUpperCase(), 76, cy + 28);
        accentBar(ctx, 76, cy + 60, 60, 3, '#2A6F6F');
      }

      // headline
      const hSz = Math.floor(W * 0.085);
      ctx.font = `900 ${hSz}px 'Arial Black', sans-serif`;
      ctx.fillStyle = '#14213D';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.globalAlpha = Math.min(1, t * 2);
      wrapText(ctx, headline, 76, cy + 90, W - 152, hSz * 1.15);
      ctx.globalAlpha = 1;

      // sub
      if (sub && t > 0.5) {
        ctx.globalAlpha = Math.min(1, (t - 0.5) * 3);
        ctx.font = `400 ${Math.floor(W * 0.036)}px Georgia, serif`;
        ctx.fillStyle = '#3A5050';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        wrapText(ctx, sub, 76, cy + ch * 0.65, W - 152, 50);
        ctx.globalAlpha = 1;
      }

      // white tag at top bar
      ctx.font = `700 ${Math.floor(W * 0.028)}px 'Arial', sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('IMPRINT LABS', W / 2, 45);
    }
  },

  TEAL_MINDMAP: {
    name: 'Teal Info Card Grid',
    style: 'INFOGRAPHIC_TEAL',
    moods: ['energetic', 'neutral'],
    draw(ctx, W, H, { title = '', items = [], accent = '#F5C842', t = 1 }) {
      ctx.fillStyle = '#1A8C8C';
      ctx.fillRect(0, 0, W, H);
      inkSpeckle(ctx, 0, 0, W, H, 88, 0.015);

      // title card
      ctx.fillStyle = '#FBF7EE';
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 16;
      roundRect(ctx, 50, 160, W - 100, 130, 14);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.font = `700 ${Math.floor(W * 0.072)}px 'Courier New', monospace`;
      ctx.fillStyle = '#1A1A1A';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = Math.min(1, t * 2.5);
      ctx.fillText(title, W / 2, 225);
      ctx.globalAlpha = 1;

      // item cards (2-col grid)
      const colors = [accent, '#E05C2A', '#4B7BE5', '#4FB04F', '#E50914', '#9B59B6'];
      const cols = 2;
      const cw = (W - 120) / cols;
      const ch = 150;
      const startY = 340;

      items.slice(0, 6).forEach((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = 60 + col * (cw + 20);
        const cy = startY + row * (ch + 20);
        const delay = i * 0.1;

        if (t < 0.3 + delay) return;
        ctx.globalAlpha = Math.min(1, (t - 0.3 - delay) * 4);

        ctx.fillStyle = '#FBF7EE';
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 10;
        roundRect(ctx, cx, cy, cw, ch, 10);
        ctx.fill();
        ctx.shadowBlur = 0;

        // color accent dot
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.arc(cx + 20, cy + 20, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `600 ${Math.floor(cw * 0.085)}px 'Arial', sans-serif`;
        ctx.fillStyle = '#1A1A1A';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        wrapText(ctx, item, cx + 14, cy + 40, cw - 28, 44);

        ctx.globalAlpha = 1;
      });
    }
  },

  // ── PAPER_ILLUS ── paper texture, ink lines, hand-drawn feel ──────────────
  PAPER_SKETCH: {
    name: 'Paper Sketch',
    style: 'PAPER_ILLUS',
    moods: ['calm', 'neutral'],
    draw(ctx, W, H, { headline = '', body = '', lineArt = [], accent = '#3B7ABF', t = 1 }) {
      ctx.fillStyle = '#F0EAD8';
      ctx.fillRect(0, 0, W, H);
      paperGrain(ctx, 0, 0, W, H, 42, 0.04);
      inkSpeckle(ctx, 0, 0, W, H, 17, 0.025);

      // margin line
      accentBar(ctx, 90, 0, 2, H, 'rgba(200,80,80,0.35)');

      // blue ruled lines
      ctx.strokeStyle = 'rgba(70,120,200,0.18)';
      ctx.lineWidth = 1;
      for (let ly = 180; ly < H; ly += 44) {
        ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke();
      }

      // headline in ink serif
      const hSz = Math.floor(W * 0.082);
      ctx.font = `700 italic ${hSz}px Georgia, 'Times New Roman', serif`;
      ctx.fillStyle = '#2C2416';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.globalAlpha = Math.min(1, t * 2.5);
      wrapText(ctx, headline, 108, 190, W - 150, hSz * 1.2);
      ctx.globalAlpha = 1;

      // body
      if (body && t > 0.4) {
        ctx.globalAlpha = Math.min(1, (t - 0.4) * 3);
        ctx.font = `400 ${Math.floor(W * 0.036)}px Georgia, serif`;
        ctx.fillStyle = '#3A2E20';
        wrapText(ctx, body, 108, H * 0.55, W - 150, 48);
        ctx.globalAlpha = 1;
      }

      // ink underline squiggle on headline
      if (t > 0.3) {
        const up = Math.min(1, (t - 0.3) * 4);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        const ux = 108, uy = 190 + hSz * 1.3;
        ctx.moveTo(ux, uy);
        const uw = (W - 160) * up;
        for (let px = 0; px < uw; px += 12) {
          ctx.lineTo(ux + px + 6, uy + (px % 24 < 12 ? 4 : -4));
        }
        ctx.stroke();
      }
    }
  },

  PAPER_TORN: {
    name: 'Paper Torn Reveal',
    style: 'PAPER_ILLUS',
    moods: ['calm', 'editorial'],
    draw(ctx, W, H, { headline = '', sub = '', accent = '#E05C2A', t = 1 }) {
      // base dark background (shows through torn edge)
      ctx.fillStyle = '#1A1510';
      ctx.fillRect(0, 0, W, H);

      // torn paper coming down from top
      const paperH = H * 0.6 + (1 - Math.min(1, t * 2)) * H * 0.4;
      const rng = mulberry(99);

      ctx.fillStyle = '#F0EAD8';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(W, 0);
      ctx.lineTo(W, paperH);
      for (let px = W; px >= 0; px -= 8) {
        ctx.lineTo(px, paperH + (rng() - 0.5) * 20);
      }
      ctx.lineTo(0, paperH);
      ctx.closePath();
      ctx.fill();

      paperGrain(ctx, 0, 0, W, paperH, 55, 0.035);

      // headline on paper
      const hSz = Math.floor(W * 0.088);
      ctx.font = `900 ${hSz}px 'Arial Black', sans-serif`;
      ctx.fillStyle = '#1A1A1A';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.globalAlpha = Math.min(1, t * 3);
      wrapText(ctx, headline, 48, 180, W - 96, hSz * 1.1);
      ctx.globalAlpha = 1;

      // sub on dark area (below torn)
      if (sub && t > 0.6) {
        ctx.globalAlpha = Math.min(1, (t - 0.6) * 4);
        ctx.font = `400 italic ${Math.floor(W * 0.038)}px Georgia, serif`;
        ctx.fillStyle = '#C8B89A';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        wrapText(ctx, sub, 48, paperH + 40, W - 96, 52);
        ctx.globalAlpha = 1;
      }

      // accent line on torn edge
      accentBar(ctx, 0, paperH - 4, W, 4, accent);
    }
  },

  // ── Stat Pull (continuation type) ─────────────────────────────────────────
  STAT_SLAM: {
    name: 'Stat Slam',
    style: 'EDITORIAL_CREAM',
    moods: ['dramatic', 'editorial'],
    draw(ctx, W, H, { stat = '', label = '', context = '', accent = '#E50914', bg = '#F5EFE0', t = 1 }) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      paperGrain(ctx, 0, 0, W, H, 71);

      // top accent strip
      accentBar(ctx, 0, 0, W, 8, accent);

      // number — absolute maximum size
      const nSz = Math.floor(W * 0.3);
      ctx.font = `900 ${nSz}px 'Arial Black', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillText(stat, W / 2 + 4, H * 0.4 + 4);

      // main
      ctx.fillStyle = accent;
      ctx.globalAlpha = Math.min(1, t * 3);
      ctx.fillText(stat, W / 2, H * 0.4);
      ctx.globalAlpha = 1;

      // label
      if (label) {
        ctx.font = `700 ${Math.floor(W * 0.048)}px 'Arial Black', sans-serif`;
        ctx.fillStyle = '#1A1A1A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.globalAlpha = Math.min(1, (t - 0.2) * 3);
        ctx.fillText(label.toUpperCase(), W / 2, H * 0.6);
        ctx.globalAlpha = 1;
      }

      // context
      if (context && t > 0.5) {
        ctx.globalAlpha = Math.min(1, (t - 0.5) * 4);
        ctx.font = `400 italic ${Math.floor(W * 0.034)}px Georgia, serif`;
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        wrapText(ctx, context, 60, H * 0.72, W - 120, 48);
        ctx.globalAlpha = 1;
      }

      // bottom rule
      accentBar(ctx, 0, H - 8, W, 8, '#1A1A1A');
    }
  },
};

// ── picker ───────────────────────────────────────────────────────────────────

const STYLE_TO_PATTERNS = {};
for (const [key, pat] of Object.entries(PATTERNS)) {
  const s = pat.style;
  if (!STYLE_TO_PATTERNS[s]) STYLE_TO_PATTERNS[s] = [];
  STYLE_TO_PATTERNS[s].push(key);
}

export function pickPattern(styleTag, mood) {
  const candidates = STYLE_TO_PATTERNS[styleTag] || Object.keys(PATTERNS);
  // prefer mood match
  const moodMatch = candidates.filter(k => PATTERNS[k].moods.includes(mood));
  const pool = moodMatch.length > 0 ? moodMatch : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function drawPattern(ctx, W, H, patternKey, props) {
  const pat = PATTERNS[patternKey];
  if (!pat) {
    console.warn(`[code_patterns] Unknown pattern: ${patternKey}`);
    return;
  }
  pat.draw(ctx, W, H, props);
}

// ── palette extractor ─────────────────────────────────────────────────────────
// Runtime access to real extracted palettes from the training library.
// index.json is loaded lazily once.
let _catalogCache = null;

export async function getPaletteForStyle(styleTag) {
  if (!_catalogCache) {
    try {
      const r = await fetch('/core/assets/catalog/index.json');
      _catalogCache = await r.json();
    } catch { return null; }
  }
  const matches = _catalogCache.filter(e => e.style_tag === styleTag && e.palette?.length > 0);
  if (!matches.length) return null;
  // pick a random matching entry's palette
  return matches[Math.floor(Math.random() * matches.length)].palette;
}

export { STYLE_TO_PATTERNS };
