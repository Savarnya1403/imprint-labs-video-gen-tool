/**
 * style_dna.js — Extracted visual DNA from the training library T-series images.
 * Each style is a complete drawing recipe for Canvas 2D.
 * Used by scene renderers to replicate specific aesthetics.
 *
 * Visual styles analyzed from 286-image training library:
 *   EDITORIAL_CREAM  — warm cream bg, illustrated characters, Swiss modern type
 *   BOLD_TYPOGRAPHIC — oversized headline, minimal layout, BW photo accent
 *   RETRO_GRID       — cream grid paper, rounded browser windows, badge stickers
 *   DARK_COLLAGE     — near-black bg, BW cutout photos, bold color accent blocks
 *   TEAL_EDITORIAL   — teal bg, cream cards, event poster, strong hierarchy
 *   INFOGRAPHIC_TEAL — teal + cream, mind-map layout, section boxes, icons
 *   PORTFOLIO_BLUE   — royal blue panels, clean sans, metric circles, photo grid
 *   PAPER_ILLUS      — paper texture, hand-drawn illustration, ink sketch lines
 *   SURREALIST_COLLAGE — transparent cutouts, mixed media, botanical
 */

export const STYLE_DNA = {

  EDITORIAL_CREAM: {
    name: 'Editorial Cream',
    bgColor: '#F5EFE0',
    paperColor: '#FDFAF3',
    primaryText: '#1A1A1A',
    accentColor: '#E05C2A',
    secondaryColor: '#D4A853',
    fontHeadline: "'Arial Black', sans-serif",
    fontBody: "Georgia, serif",
    headlineWeight: 900,
    bodyWeight: 400,
    headlineSize: (W) => W * 0.082,
    bodySize: (W) => W * 0.034,
    lineHeight: 1.35,
    layout: 'split-left-illustration',
    hasIllustration: true,
    illustrationSide: 'left',
    paperTexture: true,
    ruleLines: true,
    ruleColor: 'rgba(26,26,26,0.08)',
    ruleSpacing: 44,
    draw: (ctx, W, H, content, t) => {
      // cream bg
      ctx.fillStyle = '#F5EFE0';
      ctx.fillRect(0, 0, W, H);
      // paper rule lines
      ctx.strokeStyle = 'rgba(26,26,26,0.07)';
      ctx.lineWidth = 1;
      for (let y = 100; y < H; y += 44) {
        ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(W - 50, y); ctx.stroke();
      }
      // top dateline bar
      ctx.fillStyle = '#1A1A1A';
      ctx.fillRect(50, 240, W - 100, 2);
      // headline
      ctx.font = `900 ${Math.floor(W * 0.078)}px 'Arial Black', sans-serif`;
      ctx.fillStyle = '#1A1A1A';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      if (content.headline) ctx.fillText(content.headline, 50, 260);
    }
  },

  BOLD_TYPOGRAPHIC: {
    name: 'Bold Typographic',
    bgColor: '#FAFAF8',
    primaryText: '#0D0D0D',
    accentColor: '#E05C2A',
    fontHeadline: "'Arial Black', 'Impact', sans-serif",
    headlineWeight: 900,
    headlineSize: (W) => W * 0.14,
    layout: 'full-bleed-headline',
    hasIllustration: false,
    photoSide: 'right',
    photoTreatment: 'bw-cutout',
    noBackground: false,
    draw: (ctx, W, H, content, t) => {
      ctx.fillStyle = '#FAFAF8';
      ctx.fillRect(0, 0, W, H);
      // giant headline
      const sz = Math.floor(W * 0.13);
      ctx.font = `900 ${sz}px 'Arial Black', sans-serif`;
      ctx.fillStyle = '#0D0D0D';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const words = (content.headline || '').split(' ');
      let y = 220;
      for (const word of words) {
        ctx.fillText(word, 50, y);
        y += sz * 1.08;
      }
      // accent underline
      ctx.fillStyle = '#E05C2A';
      ctx.fillRect(50, y + 10, W * 0.35, 6);
    }
  },

  RETRO_GRID: {
    name: 'Retro Grid',
    bgColor: '#FBF7EE',
    panelColor: '#4B7BE5',
    accentText: '#F5C842',
    badgeColors: ['#D45D1E', '#4FB04F'],
    fontHeadline: "'Arial Black', sans-serif",
    headlineWeight: 900,
    headlineSize: (W) => W * 0.12,
    layout: 'browser-window-card',
    gridLines: true,
    gridSpacing: 40,
    gridColor: 'rgba(180,160,130,0.25)',
    draw: (ctx, W, H, content, t) => {
      ctx.fillStyle = '#FBF7EE';
      ctx.fillRect(0, 0, W, H);
      // grid
      ctx.strokeStyle = 'rgba(180,160,130,0.25)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      // browser window card
      const cx = 60, cy = 300, cw = W - 120, ch = H * 0.42;
      ctx.fillStyle = '#4B7BE5';
      ctx.beginPath();
      ctx.roundRect(cx, cy, cw, ch, 18);
      ctx.fill();
      // traffic lights
      const dots = ['#E05C2A','#F5C842','#4FB04F'];
      dots.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(cx + 28 + i * 28, cy + 24, 10, 0, Math.PI * 2);
        ctx.fill();
      });
      // headline inside card
      if (content.headline) {
        ctx.font = `900 ${Math.floor(cw * 0.11)}px 'Arial Black', sans-serif`;
        ctx.fillStyle = '#F5C842';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(content.headline, cx + cw / 2, cy + ch * 0.52);
      }
    }
  },

  DARK_COLLAGE: {
    name: 'Dark Collage',
    bgColor: '#161616',
    accentColors: ['#E50914','#1D9BF0','#F5C842'],
    textColor: '#F5F0E8',
    fontHeadline: "'Arial Black', sans-serif",
    headlineWeight: 900,
    photoTreatment: 'bw-grayscale',
    colorBlocks: true,
    stars: true,
    scratches: true,
    draw: (ctx, W, H, content, t) => {
      ctx.fillStyle = '#161616';
      ctx.fillRect(0, 0, W, H);
      // color blocks
      ctx.fillStyle = '#E50914';
      ctx.fillRect(0, H * 0.3, W * 0.4, H * 0.22);
      ctx.fillStyle = '#1D9BF0';
      ctx.fillRect(W * 0.6, H * 0.1, W * 0.4, H * 0.18);
      // headline
      if (content.headline) {
        ctx.font = `900 ${Math.floor(W * 0.1)}px 'Arial Black', sans-serif`;
        ctx.fillStyle = '#F5F0E8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(content.headline, W / 2, H * 0.08);
      }
    }
  },

  TEAL_EDITORIAL: {
    name: 'Teal Editorial Poster',
    bgColor: '#E8F4F4',
    accentColor: '#2A6F6F',
    textColor: '#14213D',
    paperColor: '#FDFAF3',
    fontHeadline: "'Arial Black', sans-serif",
    headlineWeight: 900,
    headlineSize: (W) => W * 0.09,
    layout: 'poster-with-figure',
    hasIllustration: true,
    illustrationStyle: 'sketch-linework',
    draw: (ctx, W, H, content, t) => {
      ctx.fillStyle = '#E8F4F4';
      ctx.fillRect(0, 0, W, H);
      // top teal strip
      ctx.fillStyle = '#2A6F6F';
      ctx.fillRect(0, 0, W, 90);
      // bottom teal strip
      ctx.fillStyle = '#2A6F6F';
      ctx.fillRect(0, H - 90, W, 90);
      // main headline
      if (content.headline) {
        ctx.font = `900 ${Math.floor(W * 0.085)}px 'Arial Black', sans-serif`;
        ctx.fillStyle = '#14213D';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(content.headline, W / 2, 120);
      }
    }
  },

  INFOGRAPHIC_TEAL: {
    name: 'Infographic Teal Mindmap',
    bgColor: '#1A8C8C',
    cardColor: '#FBF7EE',
    accentColors: ['#F5C842','#E05C2A','#4B7BE5','#4FB04F'],
    textDark: '#1A1A1A',
    textLight: '#FBF7EE',
    fontHeadline: "'Courier New', monospace",
    fontBody: "'Arial', sans-serif",
    layout: 'grid-cards',
    cardRadius: 12,
    gridCols: 2,
    draw: (ctx, W, H, content, t) => {
      ctx.fillStyle = '#1A8C8C';
      ctx.fillRect(0, 0, W, H);
      // title card
      ctx.fillStyle = '#FBF7EE';
      ctx.beginPath();
      ctx.roundRect(50, 200, W - 100, 160, 12);
      ctx.fill();
      if (content.headline) {
        ctx.font = `700 ${Math.floor(W * 0.07)}px 'Courier New', monospace`;
        ctx.fillStyle = '#1A1A1A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(content.headline, W / 2, 280);
      }
    }
  },

  PAPER_ILLUS: {
    name: 'Paper Illustration',
    bgColor: '#F0EAD8',
    inkColor: '#2C2416',
    accentColor: '#3B7ABF',
    fontHeadline: "'Georgia', serif",
    headlineWeight: 700,
    textureStrength: 0.4,
    inkLines: true,
    sketchStyle: true,
    draw: (ctx, W, H, content, t) => {
      ctx.fillStyle = '#F0EAD8';
      ctx.fillRect(0, 0, W, H);
      // paper grain
      for (let i = 0; i < 800; i++) {
        const gx = Math.random() * W, gy = Math.random() * H;
        ctx.fillStyle = `rgba(80,60,30,${Math.random() * 0.04})`;
        ctx.fillRect(gx, gy, 1, 1);
      }
      // ink headline
      if (content.headline) {
        ctx.font = `700 ${Math.floor(W * 0.085)}px Georgia, serif`;
        ctx.fillStyle = '#2C2416';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(content.headline, W / 2, 320);
      }
    }
  },
};

// ── style selector ────────────────────────────────────────────────────────
const STYLE_TOPIC_MAP = {
  politics:    'DARK_COLLAGE',
  government:  'DARK_COLLAGE',
  protest:     'DARK_COLLAGE',
  military:    'DARK_COLLAGE',
  finance:     'EDITORIAL_CREAM',
  economy:     'EDITORIAL_CREAM',
  business:    'BOLD_TYPOGRAPHIC',
  startup:     'BOLD_TYPOGRAPHIC',
  brand:       'BOLD_TYPOGRAPHIC',
  technology:  'RETRO_GRID',
  software:    'RETRO_GRID',
  data:        'INFOGRAPHIC_TEAL',
  research:    'INFOGRAPHIC_TEAL',
  science:     'INFOGRAPHIC_TEAL',
  education:   'EDITORIAL_CREAM',
  health:      'EDITORIAL_CREAM',
  culture:     'PAPER_ILLUS',
  history:     'PAPER_ILLUS',
  india:       'TEAL_EDITORIAL',
  society:     'TEAL_EDITORIAL',
  environment: 'TEAL_EDITORIAL',
};

export function pickStyleForTopic(topicKeywords) {
  const kw = topicKeywords.toLowerCase();
  for (const [keyword, styleName] of Object.entries(STYLE_TOPIC_MAP)) {
    if (kw.includes(keyword)) return STYLE_DNA[styleName];
  }
  return STYLE_DNA.EDITORIAL_CREAM;  // universal default
}

// ── extract palette from style DNA ────────────────────────────────────────
export function getStylePalette(styleName) {
  const dna = STYLE_DNA[styleName] || STYLE_DNA.EDITORIAL_CREAM;
  return {
    bg:      dna.bgColor,
    primary: dna.textColor || dna.primaryText || '#1A1A1A',
    accent:  dna.accentColor || (dna.accentColors && dna.accentColors[0]) || '#E05914',
    paper:   dna.paperColor  || dna.bgColor,
    font:    dna.fontHeadline || "'Arial Black', sans-serif",
  };
}
