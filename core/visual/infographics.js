/**
 * OpusFlow Infographics Library
 * Animated data visualization components for Canvas 2D.
 * All components are time-driven (t=0→1 animation progress).
 */

import { clamp, lerp, seg, mulberry } from '/core/lib.js';

const eo = t => 1 - Math.pow(1 - clamp(t), 3);
const eio = t => { t = clamp(t); return t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; };
const spring = (t, k=7, z=.35) => {
  t = Math.max(0,t);
  return 1 - Math.exp(-z*k*t) * Math.cos(k*Math.sqrt(1-z*z)*t*1.6);
};


// ── Bar Chart ────────────────────────────────────────────────────────────────
/**
 * Animated vertical bar chart.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{label, value, color?}>} data
 * @param {number} x, y, w, h — bounding box
 * @param {number} t — animation progress 0→1
 * @param {object} opts
 */
export function barChart(ctx, data, x, y, w, h, t, opts = {}) {
  const {
    barColor   = "#B8312A",
    bgColor    = "rgba(0,0,0,0.08)",
    labelColor = "#14213D",
    labelFont  = "16px 'AR', sans-serif",
    valueFont  = "bold 18px 'AB', sans-serif",
    valueColor = "#B8312A",
    maxValue   = null,
    animate    = "spring",   // "spring" | "eio" | "step"
    gap        = 0.3,        // fraction of bar width used as gap
    showValues = true,
    showLabels = true,
    showGrid   = true,
  } = opts;

  if (!data.length) return;
  const max = maxValue || Math.max(...data.map(d => d.value));
  const n   = data.length;
  const bw  = (w / n) * (1 - gap);
  const pad = (w / n) * gap / 2;

  // Grid lines
  if (showGrid) {
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const gy = y + h - (h * i / 4);
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
    }
    ctx.restore();
  }

  data.forEach((d, i) => {
    const delay = (i / n) * 0.3;
    let prog;
    if (animate === "spring")  prog = spring(clamp((t - delay) / 0.7) * 3);
    else if (animate === "eio") prog = eio(clamp((t - delay) / 0.7));
    else prog = t > delay + 0.05 ? 1 : 0;

    const bh    = (d.value / max) * h * prog;
    const bx    = x + i * (w / n) + pad;
    const by    = y + h - bh;
    const color = d.color || barColor;

    // Background bar
    ctx.fillStyle = bgColor;
    ctx.fillRect(bx, y, bw, h);

    // Active bar with gradient
    const grad = ctx.createLinearGradient(bx, by + bh, bx, by);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color + "DD");
    ctx.fillStyle = grad;
    ctx.fillRect(bx, by, bw, bh);

    // Value label on top
    if (showValues && prog > 0.5) {
      ctx.save();
      ctx.font = valueFont;
      ctx.fillStyle = valueColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.globalAlpha = clamp((prog - 0.5) * 2);
      const label = d.unit ? `${d.value}${d.unit}` : String(d.value);
      ctx.fillText(label, bx + bw / 2, by - 4);
      ctx.restore();
    }

    // X-axis label
    if (showLabels) {
      ctx.save();
      ctx.font = labelFont;
      ctx.fillStyle = labelColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(d.label, bx + bw / 2, y + h + 6);
      ctx.restore();
    }
  });
}


// ── Line Chart ───────────────────────────────────────────────────────────────
export function lineChart(ctx, data, x, y, w, h, t, opts = {}) {
  const {
    lineColor = "#B8312A",
    lineWidth = 3,
    dotColor  = "#14213D",
    dotR      = 5,
    fillAlpha = 0.15,
    labelColor = "#14213D",
    labelFont  = "14px 'AR', sans-serif",
  } = opts;

  if (data.length < 2) return;
  const max  = Math.max(...data.map(d => d.value));
  const pts  = data.map((d, i) => ({
    x: x + (i / (data.length - 1)) * w,
    y: y + h - (d.value / max) * h,
    label: d.label,
    value: d.value,
  }));

  // Draw up to t-th fraction
  const drawN = Math.round(t * (pts.length - 1));
  if (drawN < 1) return;

  // Fill area
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, y + h);
  for (let i = 0; i <= drawN; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.lineTo(pts[drawN].x, y + h);
  ctx.closePath();
  ctx.fillStyle = lineColor;
  ctx.globalAlpha = fillAlpha;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // Line
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i <= drawN; i++) {
    // Smooth bezier
    const cp = pts[i-1];
    const c  = pts[i];
    ctx.bezierCurveTo(
      cp.x + (c.x - cp.x) / 2, cp.y,
      cp.x + (c.x - cp.x) / 2, c.y,
      c.x, c.y
    );
  }
  ctx.strokeStyle = lineColor;
  ctx.lineWidth   = lineWidth;
  ctx.lineJoin    = "round";
  ctx.lineCap     = "round";
  ctx.stroke();

  // Dots
  for (let i = 0; i <= drawN; i++) {
    ctx.beginPath();
    ctx.arc(pts[i].x, pts[i].y, dotR, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}


// ── Animated Counter ─────────────────────────────────────────────────────────
/**
 * Ticks up from 0 → targetValue over t=0→1
 */
export function counter(ctx, targetValue, x, y, t, opts = {}) {
  const {
    font       = "bold 96px 'AB', sans-serif",
    color      = "#B8312A",
    unit       = "",
    unitFont   = "bold 48px 'AB', sans-serif",
    unitColor  = "#14213D",
    align      = "center",
    stepFn     = "smooth",  // "smooth" | "tick" (12/s) | "fast"
  } = opts;

  let display;
  if (stepFn === "smooth") {
    display = Math.round(targetValue * spring(t * 2.5));
  } else if (stepFn === "tick") {
    // 12 steps/s feel
    const steps = 24;
    const step  = Math.floor(clamp(t) * steps);
    const e     = step / steps;
    display = Math.round(targetValue * e);
  } else {
    display = Math.round(targetValue * eo(t * 2));
  }

  ctx.save();
  ctx.font          = font;
  ctx.fillStyle     = color;
  ctx.textAlign     = align;
  ctx.textBaseline  = "alphabetic";

  const valStr  = display.toLocaleString();
  const valW    = ctx.measureText(valStr).width;

  if (unit) {
    // Position value + unit side by side
    ctx.font = unitFont;
    const unitW = ctx.measureText(unit).width + 8;
    ctx.font = font;
    const totalW = valW + unitW;
    const startX = align === "center" ? x - totalW / 2 : x;
    ctx.fillText(valStr, startX, y);
    ctx.font      = unitFont;
    ctx.fillStyle = unitColor;
    ctx.textAlign = "left";
    ctx.fillText(unit, startX + valW + 8, y - 12);
  } else {
    ctx.fillText(valStr, x, y);
  }
  ctx.restore();
}


// ── Pie / Donut Chart ────────────────────────────────────────────────────────
export function donutChart(ctx, data, cx, cy, outerR, innerR, t, opts = {}) {
  const { gap = 0.02, labelFont = "14px 'AR'", labelColor = "#14213D" } = opts;
  const total  = data.reduce((s, d) => s + d.value, 0);
  let angle    = -Math.PI / 2;

  data.forEach((d, i) => {
    const frac  = d.value / total;
    const sweep = frac * Math.PI * 2 * eio(t) - gap;
    const a0    = angle;
    const a1    = angle + sweep;
    angle      += frac * Math.PI * 2;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, a0, a1);
    ctx.arc(cx, cy, innerR, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = d.color || "#B8312A";
    ctx.fill();

    // Label
    if (t > 0.8 && d.label) {
      const mid = a0 + sweep / 2;
      const r   = (outerR + innerR) / 2 + 20;
      const lx  = cx + Math.cos(mid) * r;
      const ly  = cy + Math.sin(mid) * r;
      ctx.save();
      ctx.font      = labelFont;
      ctx.fillStyle = labelColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(d.label, lx, ly);
      ctx.restore();
    }
  });
}


// ── Progress Bar ─────────────────────────────────────────────────────────────
export function progressBar(ctx, value, max, x, y, w, h, t, opts = {}) {
  const {
    bgColor     = "rgba(0,0,0,0.10)",
    fillColor   = "#B8312A",
    radius      = h / 2,
    showLabel   = true,
    labelFont   = "bold 14px 'AR'",
    labelColor  = "#FFFFFF",
  } = opts;

  const frac = (value / max) * spring(t * 2.5);

  // Track
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = bgColor;
  ctx.fill();

  // Fill
  const fw = Math.max(w * frac, radius * 2);
  ctx.beginPath();
  ctx.roundRect(x, y, fw, h, radius);
  ctx.fillStyle = fillColor;
  ctx.fill();

  // Label
  if (showLabel && t > 0.5) {
    ctx.font = labelFont;
    ctx.fillStyle = labelColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${Math.round(value * frac)}`, x + fw / 2, y + h / 2);
  }
  ctx.restore();
}


// ── Stat Card ────────────────────────────────────────────────────────────────
/**
 * A complete animated stat card: big number + label + optional trend arrow.
 */
export function statCard(ctx, x, y, w, h, { value, unit, label, sublabel, trend, color, bgColor, t }) {
  const e    = spring(t * 2.5);
  const alpha = eio(t * 3);

  ctx.save();
  ctx.globalAlpha = alpha;

  // Card background
  if (bgColor) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16);
    ctx.fillStyle = bgColor;
    ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 8;
    ctx.shadowBlur = 20; ctx.shadowColor = "rgba(0,0,0,0.12)";
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Big number
  const valStr = typeof value === "number" ? Math.round(value * e).toLocaleString() : value;
  ctx.font = `bold ${Math.round(w * 0.28)}px 'AB', sans-serif`;
  ctx.fillStyle = color || "#B8312A";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(valStr, x + 24, y + 20);

  if (unit) {
    const vw = ctx.measureText(valStr).width;
    ctx.font = `bold ${Math.round(w * 0.14)}px 'AR', sans-serif`;
    ctx.fillStyle = "#14213D";
    ctx.fillText(unit, x + 24 + vw + 8, y + 32);
  }

  // Label
  ctx.font = `${Math.round(w * 0.08)}px 'AR', sans-serif`;
  ctx.fillStyle = "#14213D";
  ctx.textBaseline = "bottom";
  ctx.fillText(label, x + 24, y + h - 20);

  if (sublabel) {
    ctx.font = `${Math.round(w * 0.065)}px 'AR', sans-serif`;
    ctx.fillStyle = "#888888";
    ctx.fillText(sublabel, x + 24, y + h - 42);
  }

  // Trend arrow
  if (trend && t > 0.6) {
    const ax = x + w - 40;
    const ay = y + 30;
    const ar = 12;
    ctx.beginPath();
    if (trend === "up") {
      ctx.moveTo(ax, ay + ar); ctx.lineTo(ax, ay);
      ctx.lineTo(ax - ar, ay + ar);
      ctx.moveTo(ax, ay); ctx.lineTo(ax + ar, ay + ar);
    } else {
      ctx.moveTo(ax, ay); ctx.lineTo(ax, ay + ar);
      ctx.lineTo(ax - ar, ay);
      ctx.moveTo(ax, ay + ar); ctx.lineTo(ax + ar, ay);
    }
    ctx.strokeStyle = trend === "up" ? "#22AA66" : "#CC3333";
    ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.stroke();
  }

  ctx.restore();
}


// ── Timeline ─────────────────────────────────────────────────────────────────
export function timeline(ctx, events, x, y, w, h, t, opts = {}) {
  const { lineColor = "#14213D", dotColor = "#B8312A",
          font = "14px 'AR'", color = "#14213D" } = opts;
  const n = events.length;
  if (!n) return;

  const drawN = Math.round(t * n);

  // Spine line
  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + h * Math.min(1, t * 1.2));
  ctx.stroke();

  events.forEach((ev, i) => {
    if (i >= drawN) return;
    const ey    = y + (i / (n - 1)) * h;
    const delay = i / n;
    const e     = eo(clamp((t - delay) / (1 / n)));

    // Dot
    ctx.beginPath();
    ctx.arc(x, ey, 6, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.globalAlpha = e;
    ctx.fill();

    // Label
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${ev.year || ""} ${ev.label}`, x + 20, ey);
    ctx.globalAlpha = 1;
  });
  ctx.restore();
}


// ── Comparison Columns ───────────────────────────────────────────────────────
export function comparison(ctx, left, right, x, y, w, h, t, opts = {}) {
  const {
    dividerColor = "rgba(0,0,0,0.12)",
    colorA       = "#B8312A",
    colorB       = "#14213D",
    font         = "bold 48px 'AB'",
    labelFont    = "24px 'AR'",
  } = opts;

  const e = eio(t);
  const half = w / 2;

  // Divider
  ctx.save();
  ctx.strokeStyle = dividerColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + half, y); ctx.lineTo(x + half, y + h);
  ctx.stroke();

  // Left side
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = font;
  ctx.fillStyle = colorA;
  ctx.globalAlpha = e;
  ctx.fillText(left.value, x + half / 2, y + h * 0.4);
  ctx.globalAlpha = 1;
  ctx.font = labelFont;
  ctx.fillStyle = "#666666";
  ctx.fillText(left.label, x + half / 2, y + h * 0.65);

  // Right side
  ctx.font = font;
  ctx.fillStyle = colorB;
  ctx.globalAlpha = e;
  ctx.fillText(right.value, x + half + half / 2, y + h * 0.4);
  ctx.globalAlpha = 1;
  ctx.font = labelFont;
  ctx.fillStyle = "#666666";
  ctx.fillText(right.label, x + half + half / 2, y + h * 0.65);

  ctx.restore();
}
