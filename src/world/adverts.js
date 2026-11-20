// The posters in the bus shelters (Martin, 20 Nov: "vary the advertisings, think of some fun ads"): fifteen
// made-up adverts in the game's vaporwave look plus the timetable, painted once into one small atlas
// (4 x 4 cells, under 1 Mpx so phones keep it as it is). No real shops or brands.
import * as THREE from 'three';

export const AD_COLS = 4, AD_ROWS = 4, AD_W = 208, AD_H = 296;
export const AD_COUNT = 15;          // cells 0..14 are adverts
export const TIMETABLE = 15;         // the last cell is the timetable

// texture coordinates of cell k: [u0, v0, u1, v1] (v up, the canvas is not flipped twice)
export function adCell(k) {
  const c = k % AD_COLS, r = Math.floor(k / AD_COLS);
  const pad = 1.5;
  return [(c * AD_W + pad) / (AD_COLS * AD_W), 1 - ((r + 1) * AD_H - pad) / (AD_ROWS * AD_H), ((c + 1) * AD_W - pad) / (AD_COLS * AD_W), 1 - (r * AD_H + pad) / (AD_ROWS * AD_H)];
}

const FONT = 'Arial, Helvetica, sans-serif';

function sky(g, w, h, stops) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c));
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
}

// the striped setting sun
function sun(g, x, y, r, top = '#ffe066', bottom = '#ff4f9a', gaps = '#00000000', bands = 5) {
  g.save();
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.clip();
  const gr = g.createLinearGradient(0, y - r, 0, y + r);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  g.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < bands; k++) {
    const yy = y + r * (0.1 + k * 0.19), hh = 1.5 + k * 1.6;
    g.fillStyle = '#000'; g.fillRect(x - r, yy, 2 * r, hh);
  }
  g.restore();
  if (gaps) { /* (the stripes let the sky through) */ }
}

// the perspective grid floor
function grid(g, w, h, y0, colour = '#ff4fd8', alpha = 0.8) {
  g.save();
  g.globalAlpha = alpha;
  g.strokeStyle = colour; g.lineWidth = 1.4;
  for (let k = -8; k <= 8; k++) { g.beginPath(); g.moveTo(w / 2 + k * 8, y0); g.lineTo(w / 2 + k * 60, h); g.stroke(); }
  for (let k = 0; k < 8; k++) { const y = y0 + (h - y0) * (k / 8) ** 1.8; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.restore();
}

function text(g, s, x, y, size, fill = '#fff', { bold = true, align = 'center', glow = null, italic = false, stroke = null, font = FONT, max = 0 } = {}) {
  g.save();
  g.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${size}px ${font}`;
  g.textAlign = align; g.textBaseline = 'middle';
  if (max) { const m = g.measureText(s).width; if (m > max) { g.translate(x, y); g.scale(max / m, 1); g.translate(-x, -y); } }
  if (glow) { g.shadowColor = glow; g.shadowBlur = 10; }
  if (stroke) { g.lineWidth = 4; g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(s, x, y); }
  g.fillStyle = fill;
  g.fillText(s, x, y);
  g.restore();
}

// chrome letters: a steel gradient with a dark rim
function chrome(g, s, x, y, size, max = 0) {
  const gr = g.createLinearGradient(0, y - size / 2, 0, y + size / 2);
  gr.addColorStop(0, '#e9f6ff'); gr.addColorStop(0.48, '#7fb8e6'); gr.addColorStop(0.52, '#2b2f6b'); gr.addColorStop(1, '#f0c7ff');
  text(g, s, x, y, size, gr, { stroke: '#1b1440', italic: true, max });
}

function rounded(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function palm(g, x, y, s, colour = '#1b0f3a') {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = colour; g.fillStyle = colour; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(8, -40, 2, -80); g.stroke();
  for (const a of [-2.6, -2.0, -1.2, -0.5, 0.2]) {
    g.beginPath(); g.moveTo(2, -80);
    g.quadraticCurveTo(2 + Math.cos(a) * 26, -80 + Math.sin(a) * 26 - 8, 2 + Math.cos(a) * 44, -80 + Math.sin(a) * 44 + 14);
    g.lineWidth = 6; g.stroke();
  }
  g.restore();
}

// fifteen adverts: each draws into a w x h cell
const ADS = [
  // 0 KAMA COLA: the fizzy drink of the old ground-grain breakfast
  (g, w, h) => {
    sky(g, w, h, ['#2a0f59', '#b8338f', '#ff9a6b']);
    sun(g, w / 2, h * 0.5, 62);
    grid(g, w, h, h * 0.62);
    // the bottle
    g.save(); g.translate(w / 2, h * 0.63);
    const bg = g.createLinearGradient(-22, 0, 22, 0); bg.addColorStop(0, '#5a2a12'); bg.addColorStop(0.4, '#c77a3c'); bg.addColorStop(1, '#3a1a08');
    g.fillStyle = bg; rounded(g, -22, -70, 44, 92, 14); g.fill(); g.fillRect(-9, -104, 18, 40);
    g.fillStyle = '#ffe9d0'; g.fillRect(-22, -42, 44, 24);
    text(g, 'KAMA', 0, -30, 13, '#b8338f');
    g.restore();
    chrome(g, 'KAMA COLA', w / 2, 40, 34, w - 20);
    text(g, 'tastes like 1987', w / 2, h - 34, 17, '#fff', { glow: '#ff4fd8', italic: true });
  },
  // 1 SAUNA FM: hot hits only
  (g, w, h) => {
    sky(g, w, h, ['#3b0b2b', '#d4475a', '#ffb36b']);
    g.strokeStyle = '#ffe2a8'; g.lineWidth = 3;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(w / 2, h * 0.52, 26 + k * 18, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
    // steam curls
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 4;
    for (const x of [w * 0.3, w * 0.5, w * 0.7]) { g.beginPath(); g.moveTo(x, h * 0.78); g.bezierCurveTo(x - 14, h * 0.7, x + 14, h * 0.66, x, h * 0.58); g.stroke(); }
    g.fillStyle = '#7a3a1e'; g.fillRect(16, h * 0.8, w - 32, 14); g.fillRect(16, h * 0.86, w - 32, 14);
    text(g, 'SAUNA', w / 2, 46, 40, '#fff2d6', { stroke: '#7a1f3d' });
    text(g, 'FM 99.9', w / 2, 86, 30, '#ffe066', { glow: '#ff4f9a' });
    text(g, 'only hot hits', w / 2, h - 18, 17, '#fff', { italic: true });
  },
  // 2 SIIL insurance: the hedgehog covers the prickly bits
  (g, w, h) => {
    sky(g, w, h, ['#0d2b4f', '#1d8f9c', '#a7f2d6']);
    g.save(); g.translate(w / 2, h * 0.58);
    g.fillStyle = '#4a2f22';
    for (let k = 0; k < 22; k++) { const a = Math.PI * (1.05 + k * 0.042); g.beginPath(); g.moveTo(Math.cos(a) * 30, Math.sin(a) * 26); g.lineTo(Math.cos(a) * 62, Math.sin(a) * 52); g.lineTo(Math.cos(a + 0.08) * 30, Math.sin(a + 0.08) * 26); g.fill(); }
    g.fillStyle = '#7b5640'; g.beginPath(); g.ellipse(0, 0, 54, 34, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#e8c9a0'; g.beginPath(); g.ellipse(46, -6, 22, 16, 0.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(66, -2, 4, 0, 7); g.fill(); g.beginPath(); g.arc(46, -12, 3, 0, 7); g.fill();
    g.fillStyle = '#ff6fb5'; g.fillRect(-56, 0, 112, 6);
    g.restore();
    text(g, 'SIIL', w / 2, 44, 44, '#fff', { stroke: '#0d2b4f' });
    text(g, 'INSURANCE', w / 2, 82, 20, '#c8fff0');
    text(g, 'we cover the', w / 2, h - 46, 16, '#0d2b4f');
    text(g, 'prickly bits', w / 2, h - 24, 18, '#0d2b4f', { italic: true });
  },
  // 3 Emajõe surf club
  (g, w, h) => {
    sky(g, w, h, ['#ff7eb3', '#ffb86b', '#47d6e0']);
    sun(g, w * 0.5, h * 0.42, 48, '#fff6a0', '#ff6f91');
    g.fillStyle = '#1b5fa8';
    for (let k = 0; k < 4; k++) { g.beginPath(); const y = h * 0.6 + k * 22; g.moveTo(0, y); for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x / 18 + k) * 6); g.lineTo(w, h); g.lineTo(0, h); g.fill(); g.fillStyle = ['#2b7fd0', '#3aa0e0', '#5cc4ea'][k] || '#7ad8f0'; }
    g.save(); g.translate(w * 0.5, h * 0.7); g.rotate(-0.35);
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, 58, 12, 0, 0, 7); g.fill();
    g.fillStyle = '#ff4fd8'; g.fillRect(-58, -2, 116, 4);
    g.restore();
    text(g, 'EMAJÕE', w / 2, 36, 32, '#2a0f59', { stroke: '#fff' });
    text(g, 'SURF CLUB', w / 2, 70, 24, '#fff', { glow: '#2a0f59' });
    text(g, 'waves any day now', w / 2, h - 18, 15, '#fff', { italic: true, glow: '#1b5fa8' });
  },
  // 4 Pixel pirukas: 8-bit pies
  (g, w, h) => {
    g.fillStyle = '#1a1033'; g.fillRect(0, 0, w, h);
    const P = 8, pie = ['..oooooo..', '.oyyyyyyo.', 'oyyyyyyyyo', 'oyyrryyyyo', 'oyyyyyrryo', 'oooooooooo', '.oooooooo.'];
    pie.forEach((row, r) => [...row].forEach((c, k) => { if (c === '.') return; g.fillStyle = c === 'o' ? '#c8742c' : c === 'y' ? '#ffd27a' : '#e2384f'; g.fillRect(w / 2 - 40 + k * P, h * 0.42 + r * P, P, P); }));
    for (let k = 0; k < 40; k++) { g.fillStyle = ['#ff4fd8', '#4ff0ff', '#ffe066'][k % 3]; g.fillRect((k * 53) % w, (k * 97) % (h * 0.35) + 10, 3, 3); }
    text(g, 'PIXEL', w / 2, 46, 36, '#4ff0ff', { font: 'Courier New, monospace', glow: '#4ff0ff' });
    text(g, 'PIRUKAS', w / 2, 84, 32, '#ff4fd8', { font: 'Courier New, monospace', glow: '#ff4fd8' });
    text(g, '8-BIT PIES', w / 2, h * 0.76, 20, '#fff', { font: 'Courier New, monospace' });
    text(g, '2 FOR 1 €', w / 2, h - 28, 26, '#ffe066', { font: 'Courier New, monospace', glow: '#ff7a00' });
  },
  // 5 Moon flats
  (g, w, h) => {
    sky(g, w, h, ['#05030f', '#1d0f45', '#4a1f7a']);
    for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(255,255,255,${0.3 + (k % 5) / 7})`; g.fillRect((k * 71) % w, (k * 37) % h, 2, 2); }
    g.fillStyle = '#e8e4f2'; g.beginPath(); g.arc(w / 2, h * 0.55, 58, 0, 7); g.fill();
    g.fillStyle = '#c3bcd6'; for (const [x, y, r] of [[-20, -18, 12], [18, 10, 16], [-14, 26, 8], [26, -26, 7]]) { g.beginPath(); g.arc(w / 2 + x, h * 0.55 + y, r, 0, 7); g.fill(); }
    // the little house on it
    g.fillStyle = '#ff6fb5'; g.fillRect(w / 2 - 12, h * 0.55 - 74, 24, 18);
    g.beginPath(); g.moveTo(w / 2 - 16, h * 0.55 - 74); g.lineTo(w / 2, h * 0.55 - 88); g.lineTo(w / 2 + 16, h * 0.55 - 74); g.fill();
    g.fillStyle = '#ffe066'; g.fillRect(w / 2 - 4, h * 0.55 - 70, 8, 7);
    text(g, 'MOON FLATS', w / 2, 40, 30, '#fff', { glow: '#ff6fb5', max: w - 20 });
    text(g, '1 room + crater', w / 2, h - 52, 18, '#ffd2f0');
    text(g, 'no neighbours. ever.', w / 2, h - 28, 15, '#bfaaff', { italic: true });
  },
  // 6 Tartu space programme
  (g, w, h) => {
    sky(g, w, h, ['#0b1440', '#3c1a6b', '#ff5f8f']);
    grid(g, w, h, h * 0.78, '#4ff0ff', 0.7);
    g.save(); g.translate(w / 2, h * 0.56);
    g.fillStyle = '#f2f2f8'; g.beginPath(); g.moveTo(0, -78); g.quadraticCurveTo(22, -40, 18, 30); g.lineTo(-18, 30); g.quadraticCurveTo(-22, -40, 0, -78); g.fill();
    g.fillStyle = '#ff4fd8'; g.beginPath(); g.moveTo(-18, 10); g.lineTo(-34, 40); g.lineTo(-18, 30); g.fill(); g.beginPath(); g.moveTo(18, 10); g.lineTo(34, 40); g.lineTo(18, 30); g.fill();
    g.fillStyle = '#4ff0ff'; g.beginPath(); g.arc(0, -28, 8, 0, 7); g.fill();
    const fl = g.createLinearGradient(0, 30, 0, 80); fl.addColorStop(0, '#ffe066'); fl.addColorStop(1, 'rgba(255,80,40,0)');
    g.fillStyle = fl; g.beginPath(); g.moveTo(-14, 30); g.lineTo(0, 84); g.lineTo(14, 30); g.fill();
    g.restore();
    text(g, 'TARTU SPACE', w / 2, 34, 26, '#fff', { glow: '#4ff0ff', max: w - 16 });
    text(g, 'PROGRAMME', w / 2, 62, 20, '#4ff0ff');
    text(g, 'next launch: Toomemägi', w / 2, h - 18, 14, '#fff', { max: w - 14 });
  },
  // 7 VHS palace
  (g, w, h) => {
    sky(g, w, h, ['#140a2e', '#2f1460', '#140a2e']);
    g.save(); g.translate(w / 2, h * 0.5);
    g.fillStyle = '#18181e'; rounded(g, -70, -40, 140, 80, 6); g.fill();
    g.fillStyle = '#ff4fd8'; g.fillRect(-56, -30, 112, 26);
    text(g, 'E-180', 0, -17, 14, '#fff');
    g.fillStyle = '#333'; g.beginPath(); g.arc(-30, 16, 14, 0, 7); g.arc(30, 16, 14, 0, 7); g.fill();
    g.fillStyle = '#ddd'; g.beginPath(); g.arc(-30, 16, 5, 0, 7); g.arc(30, 16, 5, 0, 7); g.fill();
    g.restore();
    for (let y = 0; y < h; y += 4) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y, w, 2); }
    chrome(g, 'VHS', w / 2, 44, 48);
    text(g, 'PALACE', w / 2, 84, 24, '#4ff0ff', { glow: '#4ff0ff' });
    text(g, 'be kind, rewind', w / 2, h - 30, 18, '#ffe066', { italic: true });
  },
  // 8 The slow car wash
  (g, w, h) => {
    sky(g, w, h, ['#66e0ff', '#b8f3ff', '#ffd6f5']);
    for (let k = 0; k < 16; k++) { g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2; g.beginPath(); g.arc(20 + (k * 47) % (w - 40), 30 + (k * 83) % (h * 0.5), 6 + (k % 4) * 4, 0, 7); g.stroke(); }
    // a snail with a car's shell
    g.save(); g.translate(w / 2, h * 0.66);
    g.fillStyle = '#9be37a'; g.beginPath(); g.ellipse(0, 18, 70, 12, 0, 0, 7); g.fill();
    g.fillStyle = '#ff4f9a'; rounded(g, -50, -26, 86, 36, 14); g.fill();
    g.fillStyle = '#bfe8ff'; rounded(g, -34, -20, 50, 16, 5); g.fill();
    g.fillStyle = '#9be37a'; g.fillRect(52, -18, 6, 26); g.beginPath(); g.arc(55, -20, 6, 0, 7); g.fill();
    g.restore();
    text(g, 'THE SLOW', w / 2, 42, 30, '#2a0f59');
    text(g, 'CAR WASH', w / 2, 76, 30, '#ff4f9a', { stroke: '#fff' });
    text(g, 'we take our time', w / 2, h - 22, 17, '#2a0f59', { italic: true });
  },
  // 9 Lap time lotion
  (g, w, h) => {
    sky(g, w, h, ['#ffd1ec', '#c79bff', '#6a5cff']);
    g.save(); g.translate(w / 2, h * 0.55);
    const bg = g.createLinearGradient(-30, 0, 30, 0); bg.addColorStop(0, '#e5f7ff'); bg.addColorStop(0.5, '#ffffff'); bg.addColorStop(1, '#b8d8ff');
    g.fillStyle = bg; rounded(g, -30, -56, 60, 110, 16); g.fill();
    g.fillStyle = '#2a0f59'; g.fillRect(-12, -76, 24, 22);
    text(g, '-0.3s', 0, -6, 20, '#ff4f9a');
    text(g, 'LOTION', 0, 18, 12, '#2a0f59');
    g.restore();
    text(g, 'LAP TIME', w / 2, 36, 32, '#fff', { stroke: '#2a0f59' });
    text(g, 'shave 0.3 s off every lap*', w / 2, h - 46, 14, '#fff', { max: w - 12 });
    text(g, '*not proven. at all.', w / 2, h - 24, 12, '#ffe0f4', { italic: true });
  },
  // 10 Grandma's wifi
  (g, w, h) => {
    sky(g, w, h, ['#ffe7c2', '#ffb6c9', '#d59bff']);
    g.strokeStyle = '#7a2f6b'; g.lineWidth = 6; g.lineCap = 'round';
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(w / 2, h * 0.58, 20 + k * 22, Math.PI * 1.22, Math.PI * 1.78); g.stroke(); }
    g.fillStyle = '#7a2f6b'; g.beginPath(); g.arc(w / 2, h * 0.58, 7, 0, 7); g.fill();
    // a knitted sock
    g.save(); g.translate(w / 2, h * 0.74);
    g.fillStyle = '#e2384f'; g.fillRect(-14, -20, 28, 30); g.beginPath(); g.ellipse(6, 12, 24, 12, 0, 0, 7); g.fill();
    g.fillStyle = '#fff'; for (let k = 0; k < 3; k++) g.fillRect(-14, -16 + k * 9, 28, 3);
    g.restore();
    text(g, "GRANNY'S", w / 2, 38, 30, '#7a2f6b');
    text(g, 'WIFI', w / 2, 76, 38, '#fff', { stroke: '#7a2f6b' });
    text(g, 'strong signal, warm socks', w / 2, h - 18, 13, '#4a1240', { max: w - 12 });
  },
  // 11 Neon milk
  (g, w, h) => {
    g.fillStyle = '#0c0820'; g.fillRect(0, 0, w, h);
    g.save(); g.translate(w / 2, h * 0.56);
    g.shadowColor = '#4ff0ff'; g.shadowBlur = 24;
    g.strokeStyle = '#4ff0ff'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(-34, -40); g.lineTo(-34, 60); g.lineTo(34, 60); g.lineTo(34, -40); g.lineTo(0, -66); g.closePath(); g.stroke();
    g.shadowColor = '#ff4fd8'; g.strokeStyle = '#ff4fd8';
    g.beginPath(); g.moveTo(-26, 0); for (let x = -26; x <= 26; x += 4) g.lineTo(x, Math.sin(x / 6) * 5); g.stroke();
    g.restore();
    text(g, 'NEON', w / 2, 40, 40, '#ff4fd8', { glow: '#ff4fd8' });
    text(g, 'MILK', w / 2, 80, 34, '#4ff0ff', { glow: '#4ff0ff' });
    text(g, 'glows in the fridge', w / 2, h - 22, 16, '#fff', { italic: true });
  },
  // 12 Kilu karaoke (the sprat sings)
  (g, w, h) => {
    sky(g, w, h, ['#2a0f59', '#7d2fbf', '#ff6fb5']);
    for (let k = 0; k < 7; k++) { g.fillStyle = ['#ffe066', '#4ff0ff', '#ff4fd8'][k % 3]; g.save(); g.translate(18 + k * 28, 110 + (k % 2) * 12); g.rotate(-0.3); g.fillRect(0, 0, 3, 14); g.beginPath(); g.arc(-1, 14, 4, 0, 7); g.fill(); g.restore(); }
    g.save(); g.translate(w / 2, h * 0.64);
    g.fillStyle = '#b9c7d6'; g.beginPath(); g.ellipse(0, 0, 58, 18, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(52, 0); g.lineTo(80, -16); g.lineTo(80, 16); g.fill();
    g.fillStyle = '#7f93a8'; g.fillRect(-40, -6, 80, 4);
    g.fillStyle = '#111'; g.beginPath(); g.arc(-38, -5, 4, 0, 7); g.fill();
    g.fillStyle = '#ff4f9a'; g.beginPath(); g.ellipse(-56, 4, 7, 5, 0, 0, 7); g.fill();
    // microphone
    g.fillStyle = '#333'; g.fillRect(-82, -2, 22, 6); g.fillStyle = '#ccc'; g.beginPath(); g.arc(-86, 1, 8, 0, 7); g.fill();
    g.restore();
    text(g, 'KILU', w / 2, 40, 42, '#ffe066', { stroke: '#2a0f59' });
    text(g, 'KARAOKE', w / 2, 78, 26, '#fff', { glow: '#ff4fd8' });
    text(g, 'sing like a fish', w / 2, h - 22, 17, '#fff', { italic: true });
  },
  // 13 Turbo socks
  (g, w, h) => {
    sky(g, w, h, ['#ff9a3c', '#ff3c7a', '#4b1d8f']);
    sun(g, w / 2, h * 0.36, 44);
    g.save(); g.translate(w / 2 - 6, h * 0.66); g.rotate(-0.2);
    g.fillStyle = '#4ff0ff'; g.fillRect(-16, -44, 32, 52); g.beginPath(); g.ellipse(10, 8, 32, 15, 0, 0, 7); g.fill();
    g.fillStyle = '#2a0f59'; for (let k = 0; k < 3; k++) g.fillRect(-16, -40 + k * 12, 32, 4);
    g.strokeStyle = '#fff'; g.lineWidth = 3; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-26 - k * 10, -20 + k * 12); g.lineTo(-50 - k * 14, -20 + k * 12); g.stroke(); }
    g.restore();
    chrome(g, 'TURBO', w / 2, 40, 40);
    text(g, 'SOCKS', w / 2, 80, 26, '#fff', { glow: '#2a0f59' });
    text(g, '+15 hp for your walk', w / 2, h - 20, 15, '#fff', { max: w - 12 });
  },
  // 14 Cloud bakery
  (g, w, h) => {
    sky(g, w, h, ['#7fd3ff', '#c6b6ff', '#ffc6e8']);
    g.fillStyle = '#fff';
    for (const [x, y, r] of [[0.3, 0.55, 30], [0.5, 0.5, 40], [0.7, 0.56, 30], [0.42, 0.62, 30], [0.6, 0.63, 32]]) { g.beginPath(); g.arc(w * x, h * y, r, 0, 7); g.fill(); }
    // a loaf on the cloud
    g.fillStyle = '#d6893f'; g.beginPath(); g.ellipse(w / 2, h * 0.45, 40, 20, 0, Math.PI, 0); g.fill(); g.fillRect(w / 2 - 40, h * 0.45, 80, 10);
    g.strokeStyle = '#a65a22'; g.lineWidth = 3; for (const k of [-18, 0, 18]) { g.beginPath(); g.moveTo(w / 2 + k - 6, h * 0.45 - 12); g.lineTo(w / 2 + k + 6, h * 0.45 - 4); g.stroke(); }
    text(g, 'CLOUD', w / 2, 38, 36, '#fff', { stroke: '#6a5cff' });
    text(g, 'BAKERY', w / 2, 74, 26, '#6a5cff');
    text(g, 'bread from 10 km up', w / 2, h - 22, 16, '#4a2f9a', { italic: true });
  },
];

// the timetable: bus numbers along the top, rows of minutes per hour
function timetable(g, w, h) {
  g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1f55b5'; g.fillRect(0, 0, w, 38);
  text(g, 'SÕIDUPLAAN', w / 2, 20, 18, '#fff');
  const lines = ['4', '7', '12', '25'];
  lines.forEach((n, k) => {
    const x = 12 + k * 48;
    g.fillStyle = '#ffd400'; g.fillRect(x, 46, 40, 24);
    text(g, n, x + 20, 59, 16, '#111');
  });
  g.font = `12px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
  for (let r = 0; r < 14; r++) {
    const y = 84 + r * 13.5;
    g.fillStyle = r % 2 ? '#e3e8ee' : '#f4f6f8'; g.fillRect(4, y - 6, w - 8, 13);
    g.fillStyle = '#1f2633'; g.fillText(String(6 + r).padStart(2, '0'), 8, y);
    let s = '';
    for (let k = 0; k < 4; k++) s += String((7 + r * 13 + k * 17) % 60).padStart(2, '0') + '  ';
    g.fillStyle = '#4b5566'; g.fillText(s, 34, y);
  }
  g.fillStyle = '#1f55b5'; g.fillRect(0, h - 22, w, 22);
  text(g, 'linnaring.com', w / 2, h - 11, 12, '#fff', { bold: false });
}

let atlas = null;
export function adAtlas() {
  if (atlas) return atlas;
  const cv = document.createElement('canvas');
  cv.width = AD_COLS * AD_W; cv.height = AD_ROWS * AD_H;
  const g = cv.getContext('2d');
  for (let k = 0; k < AD_COLS * AD_ROWS; k++) {
    const c = k % AD_COLS, r = Math.floor(k / AD_COLS);
    g.save();
    g.translate(c * AD_W, r * AD_H);
    g.beginPath(); g.rect(0, 0, AD_W, AD_H); g.clip();
    if (k === TIMETABLE) timetable(g, AD_W, AD_H);
    else ADS[k % ADS.length](g, AD_W, AD_H);
    g.restore();
  }
  atlas = new THREE.CanvasTexture(cv);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 4;
  return atlas;
}
