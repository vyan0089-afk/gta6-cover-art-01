/* Neon Coast Cover Studio — cover renderer.
 * Pure canvas 2D drawing: multi-panel layouts, gradient-map colour grades,
 * sunset-gradient Anton lettering, neon Pacifico script, halftone title
 * block, badge ribbon, wanted-star heat meter, grain and vignette.
 * No network, no libraries: every pixel is drawn here from the photos the
 * user loaded on their own machine. */

export const COVER_LAYOUTS = [
  { id: 'grid9', label: 'Grid 9', panels: 9 },
  { id: 'heroThree', label: 'Hero + Three', panels: 4 },
  { id: 'fullBleed', label: 'Full Bleed', panels: 1 },
  { id: 'tilted', label: 'Tilted Snapshots', panels: 3 },
  { id: 'grid4', label: 'Grid 4', panels: 4 },
  { id: 'duo', label: 'Duo Split', panels: 2 },
];

export const COVER_GRADES = [
  { id: 'sunset', label: 'Sunset', stops: [[0, '#160a2e'], [0.35, '#7b1e5b'], [0.65, '#e8442e'], [0.85, '#ff9a3d'], [1, '#ffe9a3']] },
  { id: 'neon', label: 'Neon Pink', stops: [[0, '#0b0620'], [0.35, '#5b0f6e'], [0.65, '#e0218a'], [0.85, '#ff5e78'], [1, '#7ef9ff']] },
  { id: 'golden', label: 'Golden Hour', stops: [[0, '#1d1206'], [0.35, '#6b3a0e'], [0.65, '#c97b1e'], [0.85, '#ffb347'], [1, '#fff3c4']] },
  { id: 'dusk', label: 'Dusk Purple', stops: [[0, '#0a0618'], [0.35, '#2c1a5e'], [0.65, '#7a3fd1'], [0.85, '#c86dd7'], [1, '#ffd6f2']] },
  { id: 'noir', label: 'Noir', stops: [[0, '#000000'], [0.35, '#1a1a1a'], [0.65, '#5a5a5a'], [0.85, '#b5b5b5'], [1, '#ffffff']] },
  { id: 'vice', label: 'Vice Teal', stops: [[0, '#02141a'], [0.35, '#0b5e6b'], [0.65, '#12b5a5'], [0.85, '#ff7ab8'], [1, '#e8fff6']] },
];

export const EXPORT_SIZES = [
  { id: 'square', label: 'Square 1080 x 1080', width: 1080, height: 1080 },
  { id: 'portrait', label: 'Portrait 1080 x 1350', width: 1080, height: 1350 },
  { id: 'landscape', label: 'Landscape 1920 x 1080', width: 1920, height: 1080 },
];

/* A small seeded random generator so grain is identical on every run. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/* Build a 256-entry lookup table that maps grey level to a colour grade. */
export function buildGradeLookup(gradeId) {
  const grade = COVER_GRADES.find((g) => g.id === gradeId) || COVER_GRADES[0];
  const table = new Uint8Array(256 * 3);
  for (let v = 0; v < 256; v++) {
    const t = v / 255;
    let i = 0;
    while (i < grade.stops.length - 2 && t > grade.stops[i + 1][0]) i++;
    const [t0, c0] = grade.stops[i];
    const [t1, c1] = grade.stops[i + 1];
    const f = t1 === t0 ? 0 : Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    const rgb = mixRgb(hexToRgb(c0), hexToRgb(c1), f);
    table[v * 3] = rgb[0];
    table[v * 3 + 1] = rgb[1];
    table[v * 3 + 2] = rgb[2];
  }
  return table;
}

/* Paint one photo into a rectangle with cover-fit crop, pan and zoom,
 * then remap its tones through the grade lookup table. */
function drawGradedPhoto(ctx, photo, rect, panel, lookup) {
  const off = document.createElement('canvas');
  off.width = Math.max(2, Math.round(rect.w));
  off.height = Math.max(2, Math.round(rect.h));
  const octx = off.getContext('2d');
  const iw = photo.naturalWidth || photo.width;
  const ih = photo.naturalHeight || photo.height;
  const base = Math.max(off.width / iw, off.height / ih);
  const scale = base * (panel.zoom || 1);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (off.width - dw) / 2 + (panel.ox || 0);
  const dy = (off.height - dh) / 2 + (panel.oy || 0);
  octx.fillStyle = '#111';
  octx.fillRect(0, 0, off.width, off.height);
  octx.drawImage(photo, dx, dy, dw, dh);
  const img = octx.getImageData(0, 0, off.width, off.height);
  const d = img.data;
  for (let p = 0; p < d.length; p += 4) {
    const grey = Math.round(0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]);
    const k = grey * 3;
    // Blend the grade with the original so faces keep their warmth.
    d[p] = Math.round(d[p] * 0.35 + lookup[k] * 0.65);
    d[p + 1] = Math.round(d[p + 1] * 0.35 + lookup[k + 1] * 0.65);
    d[p + 2] = Math.round(d[p + 2] * 0.35 + lookup[k + 2] * 0.65);
  }
  octx.putImageData(img, 0, 0);
  ctx.save();
  if (rect.rotate) {
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.rotate(rect.rotate);
    ctx.translate(-rect.w / 2, -rect.h / 2);
    ctx.drawImage(off, 0, 0);
  } else {
    ctx.drawImage(off, rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
}

function drawPhotoPlaceholder(ctx, rect, index) {
  ctx.save();
  if (rect.rotate) {
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.rotate(rect.rotate);
    ctx.translate(-rect.w / 2, -rect.h / 2);
    rect = { x: 0, y: 0, w: rect.w, h: rect.h };
  }
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  grad.addColorStop(0, '#3a1c5e');
  grad.addColorStop(0.5, '#c22e6e');
  grad.addColorStop(1, '#ff8a3d');
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(2, rect.w * 0.012);
  ctx.strokeRect(rect.x + 6, rect.y + 6, rect.w - 12, rect.h - 12);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.max(14, rect.w * 0.09)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`PANEL ${index + 1}`, rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.restore();
}

/* Panel rectangles for each layout, in fractions of the cover size.
 * The title band always takes the bottom strip; panels fill above it. */
export function layoutPanelRects(layoutId, width, height) {
  const band = Math.round(height * 0.24);
  const top = height - band;
  const gap = Math.max(4, Math.round(width * 0.008));
  const rects = [];
  const push = (fx, fy, fw, fh, rotate) => {
    rects.push({ x: Math.round(fx * width), y: Math.round(fy * top), w: Math.round(fw * width), h: Math.round(fh * top), rotate: rotate || 0 });
  };
  if (layoutId === 'grid9') {
    const cw = (1 - gap * 4 / width) / 3;
    const ch = (1 - gap * 4 / top) / 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        push(gap / width + c * (cw + gap / width), gap / top + r * (ch + gap / top), cw, ch);
      }
    }
  } else if (layoutId === 'heroThree') {
    push(0, 0, 0.62, 1);
    push(0.62 + gap / width, 0, 0.38 - gap / width, 0.325);
    push(0.62 + gap / width, 0.3375, 0.38 - gap / width, 0.325);
    push(0.62 + gap / width, 0.675, 0.38 - gap / width, 0.325);
  } else if (layoutId === 'fullBleed') {
    push(0, 0, 1, 1);
  } else if (layoutId === 'tilted') {
    push(0.06, 0.06, 0.30, 0.78, -0.10);
    push(0.36, 0.10, 0.30, 0.78, 0.02);
    push(0.66, 0.06, 0.30, 0.78, 0.09);
  } else if (layoutId === 'grid4') {
    push(0, 0, 0.495, 0.49);
    push(0.505, 0, 0.495, 0.49);
    push(0, 0.51, 0.495, 0.49);
    push(0.505, 0.51, 0.495, 0.49);
  } else if (layoutId === 'duo') {
    push(0, 0, 0.495, 1);
    push(0.505, 0, 0.495, 1);
  } else {
    push(0, 0, 1, 1);
  }
  return { rects, bandTop: top, bandHeight: band };
}

function drawStarPath(ctx, cx, cy, outer, inner) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/* The halftone dot field behind the title: dots grow toward the bottom. */
function drawHalftoneTitleBlock(ctx, width, bandTop, bandHeight) {
  const grad = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandHeight);
  grad.addColorStop(0, '#12081f');
  grad.addColorStop(0.55, '#2a0f3d');
  grad.addColorStop(1, '#12081f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, bandTop, width, bandHeight);
  const step = Math.max(10, Math.round(width / 90));
  ctx.fillStyle = 'rgba(255, 122, 61, 0.55)';
  for (let y = bandTop + step / 2; y < bandTop + bandHeight; y += step) {
    const depth = (y - bandTop) / bandHeight;
    const r = step * 0.10 + depth * step * 0.28;
    for (let x = step / 2; x < width; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, bandTop, width, Math.max(3, bandHeight * 0.03));
}

function drawBadgeRibbon(ctx, width, height, text) {
  if (!text) return;
  const ribbonH = Math.max(26, Math.round(height * 0.045));
  const ribbonW = Math.max(120, Math.round(width * 0.30));
  ctx.save();
  ctx.translate(ribbonW * 0.55, ribbonH * 1.15);
  ctx.rotate(-0.06);
  ctx.fillStyle = '#ff2e88';
  ctx.fillRect(-ribbonW / 2, -ribbonH / 2, ribbonW, ribbonH);
  ctx.fillStyle = '#ffd319';
  ctx.fillRect(-ribbonW / 2, ribbonH / 2 - 4, ribbonW, 4);
  ctx.fillStyle = '#fff';
  ctx.font = `${Math.round(ribbonH * 0.52)}px Anton, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), 0, 1);
  ctx.restore();
}

function heatMeterGeometry(ctx, width, bandHeight) {
  const starR = Math.max(10, Math.round(bandHeight * 0.13));
  const gap = starR * 0.35;
  const starsWidth = 5 * starR * 2 + 4 * gap;
  ctx.font = `bold ${Math.round(starR * 1.1)}px Anton, Arial, sans-serif`;
  const labelWidth = ctx.measureText('WANTED').width;
  const totalWidth = labelWidth + starR * 2 + starsWidth;
  const margin = Math.round(width * 0.03);
  return { starR, gap, starsWidth, labelWidth, totalWidth, margin, x: width - margin - starsWidth };
}

function drawHeatMeter(ctx, width, bandTop, bandHeight, heat) {
  const geo = heatMeterGeometry(ctx, width, bandHeight);
  const { starR, gap } = geo;
  const x = geo.x;
  const cy = bandTop + bandHeight * 0.30;
  ctx.font = `bold ${Math.round(starR * 1.1)}px Anton, Arial, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd319';
  ctx.fillText('WANTED', x - starR, cy);
  for (let i = 0; i < 5; i++) {
    const cx = x + starR + i * (starR * 2 + gap);
    drawStarPath(ctx, cx, cy, starR, starR * 0.45);
    if (i < heat) {
      ctx.fillStyle = '#ffd319';
      ctx.fill();
      ctx.strokeStyle = '#7a4d00';
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    }
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  return geo;
}

function drawSunsetTitle(ctx, width, bandTop, bandHeight, title, subtitle, caption, captionSize, captionColor, titleCenterX, titleMaxWidth) {
  const cx = titleCenterX == null ? width / 2 : titleCenterX;
  let titleSize = Math.min(Math.round(bandHeight * 0.42), Math.round(width * 0.11));
  ctx.font = `${titleSize}px Anton, Arial, sans-serif`;
  if (titleMaxWidth) {
    while (titleSize > 16 && ctx.measureText(title.toUpperCase()).width > titleMaxWidth) {
      titleSize = Math.round(titleSize * 0.92);
      ctx.font = `${titleSize}px Anton, Arial, sans-serif`;
    }
  }
  ctx.save();
  ctx.translate(cx, bandTop + bandHeight * 0.36);
  ctx.rotate(-0.02);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const grad = ctx.createLinearGradient(0, -titleSize / 2, 0, titleSize / 2);
  grad.addColorStop(0, '#fff3c4');
  grad.addColorStop(0.45, '#ffb347');
  grad.addColorStop(0.75, '#ff5e3a');
  grad.addColorStop(1, '#e0218a');
  ctx.font = `${titleSize}px Anton, Arial, sans-serif`;
  ctx.lineWidth = Math.max(3, titleSize * 0.09);
  ctx.strokeStyle = '#160a2e';
  ctx.lineJoin = 'round';
  ctx.strokeText(title.toUpperCase(), 0, 0);
  ctx.fillStyle = grad;
  ctx.fillText(title.toUpperCase(), 0, 0);
  ctx.restore();
  if (subtitle) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const subSize = Math.round(bandHeight * 0.16);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = Math.round(subSize * 0.55);
    ctx.fillStyle = '#ff8fd0';
    ctx.fillText(subtitle, width / 2, bandTop + bandHeight * 0.66);
    ctx.restore();
  }
  if (caption) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const capSize = Math.max(12, Math.round(bandHeight * 0.13 * (captionSize || 1)));
    ctx.font = `bold ${capSize}px Anton, Arial, sans-serif`;
    ctx.fillStyle = captionColor || '#ffffff';
    ctx.fillText(caption.toUpperCase(), width / 2, bandTop + bandHeight * 0.88);
    ctx.restore();
  }
}

let grainCanvas = null;
function grainPattern(ctx) {
  if (grainCanvas) return grainCanvas;
  grainCanvas = document.createElement('canvas');
  grainCanvas.width = 128;
  grainCanvas.height = 128;
  const gctx = grainCanvas.getContext('2d');
  const img = gctx.createImageData(128, 128);
  const rnd = seededRandom(20261120);
  for (let p = 0; p < img.data.length; p += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[p] = v;
    img.data[p + 1] = v;
    img.data[p + 2] = v;
    img.data[p + 3] = 22;
  }
  gctx.putImageData(img, 0, 0);
  return grainCanvas;
}

function drawGrainAndVignette(ctx, width, height) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = ctx.createPattern(grainPattern(ctx), 'repeat');
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
  const vig = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.42, width / 2, height / 2, Math.max(width, height) * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(10,4,24,0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(4, Math.round(width * 0.006));
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);
}

/* Render one cover into a canvas of the given size.
 * state: layout, grade, title, subtitle, caption, captionSize, captionColor,
 * heat, badge, panels[{photo, zoom, ox, oy}]. photos: array of images. */
export function renderCover(canvas, state, photos, width, height) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const lookup = buildGradeLookup(state.grade);
  const { rects, bandTop, bandHeight } = layoutPanelRects(state.layout, width, height);
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#1b0b2e');
  bg.addColorStop(0.5, '#7b1e5b');
  bg.addColorStop(1, '#ff8a3d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  rects.forEach((rect, i) => {
    const panel = (state.panels && state.panels[i]) || { photo: -1, zoom: 1, ox: 0, oy: 0 };
    const photo = panel.photo >= 0 ? photos[panel.photo] : null;
    if (photo) drawGradedPhoto(ctx, photo, rect, panel, lookup);
    else drawPhotoPlaceholder(ctx, rect, i);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(3, Math.round(width * 0.004));
    if (rect.rotate) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rotate);
      ctx.strokeRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
    } else {
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
  });
  drawHalftoneTitleBlock(ctx, width, bandTop, bandHeight);
  const meter = heatMeterGeometry(ctx, width, bandHeight);
  const titleMaxWidth = Math.max(120, width - meter.totalWidth - meter.margin * 3);
  const titleCenterX = meter.margin + titleMaxWidth / 2;
  drawSunsetTitle(ctx, width, bandTop, bandHeight, state.title || 'NEON COAST', state.subtitle || '', state.caption || '', state.captionSize || 1, state.captionColor || '#ffffff', titleCenterX, titleMaxWidth);
  drawHeatMeter(ctx, width, bandTop, bandHeight, state.heat == null ? 5 : state.heat);
  drawBadgeRibbon(ctx, width, height, state.badge || '');
  drawGrainAndVignette(ctx, width, height);
  return { rects, bandTop, bandHeight };
}
