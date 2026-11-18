// Realistic trees: a bark-textured stem with real limbs, a crown of leaf-twig cards you can see
// through, and a flat picture of the same tree for the distance. Everything (bark, twigs, the
// distant picture) is drawn here at start-up, so there is nothing to download.
//
// A species is built once as a unit tree (height 1, crown diameter 1) like the simple trees in
// scenery.js, so the same per-tree instance matrices place both.
import * as THREE from 'three';

const AW = 1024, AH = 512;          // a species' atlas: four foliage cards (2 x 2, 256 px), stem bark, limb bark
const BARK = 544, DARK = 800;      // bark columns start clear of the leaf cells, so no bark creeps onto a card's edge
const LOD = 150;                    // m: cards nearer than this, the flat picture beyond

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ---------------------------------------------------------------- textures
function birchLeaf(g, x, y, ang, size, hue, light, sat) {
  g.save();
  g.translate(x, y); g.rotate(ang);
  const w = size * 0.42;
  // triangular-ovate blade with a drawn-out tip, stalk at the origin
  g.beginPath();
  g.moveTo(0, size * 0.12);
  g.bezierCurveTo(w * 1.25, size * 0.16, w * 1.05, size * 0.62, 0, size);
  g.bezierCurveTo(-w * 1.05, size * 0.62, -w * 1.25, size * 0.16, 0, size * 0.12);
  const grad = g.createLinearGradient(-w, 0, w, 0);
  grad.addColorStop(0, `hsl(${hue},${sat}%,${light - 5}%)`);
  grad.addColorStop(0.5, `hsl(${hue + 4},${sat}%,${light + 3}%)`);
  grad.addColorStop(1, `hsl(${hue - 3},${sat - 4}%,${light - 2}%)`);
  g.fillStyle = grad;
  g.fill();
  g.strokeStyle = `hsla(${hue + 12},${sat - 10}%,${light + 16}%,0.55)`;
  g.lineWidth = 0.7;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, size * 0.9); g.stroke();
  g.restore();
}

// Cells 0 and 1: a hanging spray of birch twigs, thin dark shoots falling from the top edge.
// Cells 2 and 3: a clump of foliage, the body of the crown.
function birchTwig(g, ox, oy, variant) {
  const r = rng(977 + variant * 7919);
  const leaves = [];
  g.lineCap = 'round';
  const shoot = (x0, y0, x1, y1, bend, every, both) => {
    const c1x = x0 + (x1 - x0) * 0.7 + bend, c1y = y0 + (y1 - y0) * 0.12, c2x = x1 + bend * 0.4, c2y = y0 + (y1 - y0) * 0.6;
    g.strokeStyle = `hsl(${12 + r() * 14},20%,${13 + r() * 7}%)`;
    g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(ox + x0, oy + y0); g.bezierCurveTo(ox + c1x, oy + c1y, ox + c2x, oy + c2y, ox + x1, oy + y1); g.stroke();
    const n = Math.floor(Math.hypot(x1 - x0, y1 - y0) / every);
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const px = u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x1;
      const py = u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y1;
      const side = i % 2 ? 1 : -1;
      // leaves hang, fanned to either side of the shoot
      leaves.push([px + side * (1 + r() * 4), py + r() * 3, side * -(0.2 + r() * 0.8) + (r() - 0.5) * 0.3, 9 + r() * 5, r()]);
      if (r() < both) leaves.push([px - side * (2 + r() * 5), py + 2 + r() * 4, side * (0.2 + r() * 0.9), 8 + r() * 5, r()]);
    }
  };
  if (variant < 2) {
    const shoots = 9 + variant * 2;
    for (let k = 0; k < shoots; k++) {
      const x0 = 128 + (r() - 0.5) * 110, x1 = Math.max(20, Math.min(236, x0 + (k / (shoots - 1) - 0.5) * 130 + (r() - 0.5) * 40));
      shoot(x0, 10 + r() * 14, x1, 130 + r() * 108, (r() - 0.5) * 30, 5, 0.6);
    }
  } else {
    // twigs fanning from the middle, hanging more the further out they get
    for (let k = 0; k < 26; k++) {
      const a = r() * 6.283, d0 = r() * 30, d1 = 50 + r() * 58;
      const x0 = 128 + Math.cos(a) * d0, y0 = 112 + Math.sin(a) * d0 * 0.8;
      shoot(x0, y0, 128 + Math.cos(a) * d1, 112 + Math.sin(a) * d1 * 0.8 + 16 + r() * 22, (r() - 0.5) * 24, 4.5, 0.75);
    }
    // and loose leaves to close the middle
    for (let i = 0; i < 150; i++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * 78;
      leaves.push([128 + Math.cos(a) * d, 112 + Math.sin(a) * d * 0.85, (r() - 0.5) * 2.4, 8 + r() * 5, r() * 0.7]);
    }
  }
  // back to front: darker leaves first, so the foliage has depth
  leaves.sort((a, b) => a[4] - b[4]);
  for (const [x, y, a, s, d] of leaves) {
    if (x < 18 || x > 238 || y < 14 || y > 238 - s) continue;
    const turned = r() < 0.025;
    birchLeaf(g, ox + x, oy + y, a, s, turned ? 64 + r() * 10 : 76 + r() * 24, 19 + d * 23 + (turned ? 5 : 0), turned ? 46 : 30 + r() * 16);
  }
}

// ---- the other species: one leaf, a clump of them, a conifer bough, furrowed bark
function leafShape(g, shape, x, y, ang, size, hue, light, sat) {
  if (shape === 'birch') return birchLeaf(g, x, y, ang, size, hue, light, sat);
  g.save();
  g.translate(x, y); g.rotate(ang);
  g.beginPath();
  let w;
  if (shape === 'lime') {
    // a lopsided heart with a short point
    w = size * 0.56;
    g.moveTo(0, size * 0.1);
    g.bezierCurveTo(w * 1.5, -size * 0.12, w * 1.35, size * 0.72, 0, size);
    g.bezierCurveTo(-w * 1.25, size * 0.7, -w * 1.5, -size * 0.08, 0, size * 0.1);
  } else if (shape === 'poplar') {
    // a broad triangle on a long stalk
    w = size * 0.5;
    g.moveTo(0, size * 0.2);
    g.bezierCurveTo(w * 1.6, size * 0.18, w * 0.8, size * 0.6, 0, size);
    g.bezierCurveTo(-w * 0.8, size * 0.6, -w * 1.6, size * 0.18, 0, size * 0.2);
  } else {
    // oak: long, widest beyond the middle, with a wavy lobed edge
    w = size * 0.36;
    const edge = (t, side) => [side * w * (0.35 + 1.1 * Math.sin(Math.PI * Math.pow(t, 1.3))) * (1 + 0.38 * Math.sin(t * 19)), size * (0.08 + 0.92 * t)];
    g.moveTo(0, size * 0.08);
    for (let i = 1; i <= 12; i++) g.lineTo(...edge(i / 12, 1));
    for (let i = 12; i >= 0; i--) g.lineTo(...edge(i / 12, -1));
  }
  const grad = g.createLinearGradient(-w, 0, w, 0);
  grad.addColorStop(0, `hsl(${hue},${sat}%,${light - 5}%)`);
  grad.addColorStop(0.5, `hsl(${hue + 4},${sat}%,${light + 3}%)`);
  grad.addColorStop(1, `hsl(${hue - 3},${sat - 4}%,${light - 2}%)`);
  g.fillStyle = grad;
  g.fill();
  g.strokeStyle = `hsla(${hue + 12},${sat - 10}%,${light + 16}%,0.5)`;
  g.lineWidth = 0.7;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, size * 0.9); g.stroke();
  g.restore();
}

// A clump of broad leaves in a 256 px cell: twigs fanning from the middle, leaves along them and
// loose ones between. o: { shape, size [from, span], hue [from, span], light [from, span], sat [from, span], twigs, loose }
function leafClump(g, ox, oy, variant, o) {
  const r = rng(o.seed + variant * 7919);
  const leaves = [];
  g.lineCap = 'round';
  const rx = variant < 2 ? 96 : 104, ry = variant < 2 ? 92 : 80;      // two rounder cells, two flatter
  for (let k = 0; k < o.twigs; k++) {
    const a = r() * 6.283, d0 = r() * 26, d1 = 44 + r() * 54;
    const x0 = 128 + Math.cos(a) * d0, y0 = 124 + Math.sin(a) * d0 * 0.8;
    const x1 = 128 + Math.cos(a) * d1 * (rx / 98), y1 = 124 + Math.sin(a) * d1 * (ry / 98) + 6 + r() * 12;
    g.strokeStyle = `hsl(${18 + r() * 14},20%,${13 + r() * 7}%)`;
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(ox + x0, oy + y0); g.quadraticCurveTo(ox + (x0 + x1) / 2 + (r() - 0.5) * 20, oy + (y0 + y1) / 2 - 6, ox + x1, oy + y1); g.stroke();
    const n = Math.floor(Math.hypot(x1 - x0, y1 - y0) / (o.size[0] * 0.5));
    for (let i = 1; i <= n; i++) {
      const t = i / n, side = i % 2 ? 1 : -1;
      // leaves lean out from the twig and droop a little
      leaves.push([x0 + (x1 - x0) * t + side * (1 + r() * 4), y0 + (y1 - y0) * t + r() * 3, a - 1.571 + side * (0.5 + r() * 0.7), o.size[0] + r() * o.size[1], r()]);
    }
  }
  for (let i = 0; i < o.loose; i++) {
    const a = r() * 6.283, d = Math.sqrt(r());
    leaves.push([128 + Math.cos(a) * d * rx * 0.86, 124 + Math.sin(a) * d * ry * 0.86, (r() - 0.5) * 2.6, o.size[0] + r() * o.size[1], r() * 0.75]);
  }
  leaves.sort((a, b) => a[4] - b[4]);
  for (const [x, y, a, sz, d] of leaves) {
    if (x < 18 + sz * 0.6 || x > 238 - sz * 0.6 || y < 14 + sz * 0.6 || y > 238 - sz) continue;
    leafShape(g, o.shape, ox + x, oy + y, a, sz, o.hue[0] + r() * o.hue[1], o.light[0] + d * o.light[1], o.sat[0] + r() * o.sat[1]);
  }
}

// A spruce bough seen flat: a spine from the top edge with side shoots swept back towards the tip,
// every shoot thick with short needles.
function spruceBough(g, ox, oy, variant) {
  const r = rng(555 + variant * 104729);
  g.lineCap = 'round';
  const drift = (r() - 0.5) * 30, tip = 232;
  const spine = (t) => [128 + drift * t * t, 14 + (tip - 14) * t];
  const shoots = [];
  for (let y = 20; y < tip - 8; y += 6.5) {
    const t = (y - 14) / (tip - 14), side = shoots.length % 2 ? 1 : -1;
    // widest a little over half way down, closing to a point
    const len = (16 + 88 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.7)), 0.8)) * (0.8 + r() * 0.35) * (variant < 2 ? 1 : 0.86);
    shoots.push([t, side, len, 0.75 + r() * 0.35, r()]);
  }
  // back shoots first
  shoots.sort((a, b) => a[4] - b[4]);
  for (const [t, side, len, sweep, d] of shoots) {
    const [sx, sy] = spine(t);
    const ang = side * (1.571 - sweep);                 // from straight down
    const ex = sx + Math.sin(ang) * len, ey = Math.min(240, sy + Math.cos(ang) * len);
    const lightness = 13 + d * 17;
    g.strokeStyle = `hsl(${24 + r() * 10},22%,${12 + r() * 6}%)`;
    g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(ox + sx, oy + sy); g.lineTo(ox + ex, oy + ey); g.stroke();
    const n = Math.floor(len / 1.7);
    g.lineWidth = 1.25;
    for (let i = 2; i <= n; i++) {
      const u = i / n, px = sx + (ex - sx) * u, py = sy + (ey - sy) * u;
      if (px < 18 || px > 238) break;
      for (const ns of [-1, 1]) {
        const na = ang + ns * (0.9 + r() * 0.5), nl = 4.5 + r() * 3;
        g.strokeStyle = `hsl(${106 + r() * 30},${26 + r() * 14}%,${lightness + r() * 9 + (u > 0.82 ? 7 : 0)}%)`;    // paler new growth at the tips
        g.beginPath(); g.moveTo(ox + px, oy + py); g.lineTo(ox + px + Math.sin(na) * nl, oy + Math.min(242, py + Math.cos(na) * nl)); g.stroke();
      }
    }
  }
  g.strokeStyle = 'hsl(22,24%,15%)';
  g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(ox + 128, oy + 14);
  for (let t = 0.1; t <= 1.001; t += 0.1) g.lineTo(ox + spine(t)[0], oy + spine(t)[1]);
  g.stroke();
}

// Pine: bursts of long paired needles at the twig ends, more of them pointing up than down.
function pineTufts(g, ox, oy, variant) {
  const r = rng(808 + variant * 15485863);
  g.lineCap = 'round';
  const tufts = [];
  for (let k = 0; k < 16; k++) {
    const a = r() * 6.283, d0 = r() * 24, d1 = 34 + r() * 50;
    const x0 = 128 + Math.cos(a) * d0, y0 = 132 + Math.sin(a) * d0 * 0.7;
    const x1 = 128 + Math.cos(a) * d1, y1 = 132 + Math.sin(a) * d1 * 0.72 - 8;
    g.strokeStyle = `hsl(${20 + r() * 12},38%,${22 + r() * 10}%)`;
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(ox + x0, oy + y0); g.quadraticCurveTo(ox + (x0 + x1) / 2, oy + (y0 + y1) / 2 - 8, ox + x1, oy + y1); g.stroke();
    tufts.push([x1, y1, a, r()], [(x0 + x1) / 2, (y0 + y1) / 2 - 4, a, r() * 0.6]);
  }
  tufts.sort((a, b) => a[3] - b[3]);
  g.lineWidth = 1.15;
  for (const [x, y, a, d] of tufts) {
    for (let i = 0; i < 46; i++) {
      // round the twig's own direction, tipped skywards
      const na = a + (r() - 0.5) * 3.6, len = 15 + r() * 13;
      const ex = x + Math.cos(na) * len, ey = y + Math.sin(na) * len * 0.9 - 5;
      if (ex < 18 || ex > 238 || ey < 14 || ey > 238) continue;
      g.strokeStyle = `hsl(${100 + r() * 36},${20 + r() * 16}%,${17 + d * 17 + r() * 10}%)`;
      g.beginPath(); g.moveTo(ox + x, oy + y); g.lineTo(ox + ex, oy + ey); g.stroke();
    }
  }
}

// Furrowed bark: long dark cracks and paler ridges on a base colour; plates adds the cross
// cracks of pine and spruce.
function furrowBark(g, x0, w, h, seed, base, dark, pale, plates = 0) {
  const r = rng(seed);
  g.save();
  g.beginPath(); g.rect(x0, 0, w, h); g.clip();
  g.fillStyle = base;
  g.fillRect(x0, 0, w, h);
  for (let i = 0; i < 1100; i++) {
    const x = x0 + r() * w, y = r() * h, len = 14 + r() * 70, crack = r() < 0.55;
    g.strokeStyle = crack ? `rgba(${dark},${0.25 + r() * 0.45})` : `rgba(${pale},${0.1 + r() * 0.22})`;
    g.lineWidth = crack ? 1 + r() * 3 : 1.5 + r() * 4;
    g.beginPath(); g.moveTo(x, y - len / 2); g.quadraticCurveTo(x + (r() - 0.5) * 9, y, x + (r() - 0.5) * 6, y + len / 2); g.stroke();
  }
  for (let i = 0; i < plates; i++) {
    const x = x0 + r() * w, y = r() * h, len = 10 + r() * 34;
    g.strokeStyle = `rgba(${dark},${0.3 + r() * 0.4})`;
    g.lineWidth = 1 + r() * 2;
    g.beginPath(); g.moveTo(x - len / 2, y); g.quadraticCurveTo(x, y + (r() - 0.5) * 8, x + len / 2, y + (r() - 0.5) * 5); g.stroke();
  }
  g.restore();
}

function birchBark(g, x0, w, h) {
  const r = rng(4242);
  g.fillStyle = '#e4e1d8';
  g.fillRect(x0, 0, w, h);
  // soft vertical tone, cream and grey blotches
  for (let i = 0; i < 260; i++) {
    const x = x0 + r() * w, y = r() * h, bw = 6 + r() * 34, bh = 14 + r() * 70;
    g.fillStyle = r() < 0.5 ? `rgba(246,243,234,${0.1 + r() * 0.25})` : `rgba(${150 + r() * 40},${146 + r() * 36},${138 + r() * 30},${0.05 + r() * 0.16})`;
    g.beginPath(); g.ellipse(x, y, bw, bh, 0, 0, 6.283); g.fill();
  }
  // lenticels: the short dark dashes that run round a birch stem
  for (let i = 0; i < 520; i++) {
    const x = x0 + r() * w, y = r() * h, len = 4 + r() * r() * 46;
    g.strokeStyle = `rgba(${40 + r() * 30},${36 + r() * 26},${34 + r() * 22},${0.35 + r() * 0.5})`;
    g.lineWidth = 0.8 + r() * 1.6;
    g.beginPath(); g.moveTo(x - len / 2, y); g.quadraticCurveTo(x, y + (r() - 0.5) * 3, x + len / 2, y + (r() - 0.5) * 2); g.stroke();
  }
  // black scars where limbs were: a blot with whiskers to both sides
  for (let i = 0; i < 9; i++) {
    const x = x0 + 20 + r() * (w - 40), y = 20 + r() * (h - 40), s = 8 + r() * 14;
    g.fillStyle = `rgba(22,20,20,${0.8 + r() * 0.2})`;
    g.beginPath();
    g.moveTo(x - s * 2.4, y + s * 0.5); g.quadraticCurveTo(x - s * 0.6, y - s * 0.2, x, y - s * 0.9);
    g.quadraticCurveTo(x + s * 0.6, y - s * 0.2, x + s * 2.4, y + s * 0.5);
    g.quadraticCurveTo(x, y + s * 0.5, x - s * 2.4, y + s * 0.5);
    g.fill();
  }
  // a little peeling paper bark
  for (let i = 0; i < 40; i++) {
    const x = x0 + r() * w, y = r() * h, len = 10 + r() * 30;
    g.strokeStyle = `rgba(255,252,244,${0.25 + r() * 0.3})`;
    g.lineWidth = 1 + r() * 2;
    g.beginPath(); g.moveTo(x - len / 2, y); g.lineTo(x + len / 2, y + (r() - 0.5) * 3); g.stroke();
  }
}

function darkBark(g, x0, w, h) {
  const r = rng(99);
  g.fillStyle = '#33262a';
  g.fillRect(x0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const x = x0 + r() * w, y = r() * h, len = 8 + r() * 40;
    g.strokeStyle = r() < 0.6 ? `rgba(16,12,14,${0.2 + r() * 0.4})` : `rgba(${110 + r() * 50},${84 + r() * 40},${80 + r() * 30},${0.1 + r() * 0.25})`;
    g.lineWidth = 0.8 + r() * 2.2;
    g.beginPath(); g.moveTo(x, y - len / 2); g.lineTo(x + (r() - 0.5) * 5, y + len / 2); g.stroke();
  }
}

// draw(g) paints the cells and bark columns; fill is the leaf colour the clear pixels are given.
function makeAtlas(draw, fill) {
  const cv = document.createElement('canvas');
  cv.width = AW; cv.height = AH;
  const g = cv.getContext('2d', { willReadFrequently: true });
  draw(g);
  const img = g.getImageData(0, 0, AW, AH), d = img.data;
  // Clear pixels come back black, and the smaller mip levels would mix that black into the leaf
  // edges. Give them leaf colour instead and keep only the outline in alpha.
  const [fr, fg, fb] = fill;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a === 0) { d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; }
    else if (a < 255) { const k = a / 255; d[i] = d[i] * k + fr * (1 - k); d[i + 1] = d[i + 1] * k + fg * (1 - k); d[i + 2] = d[i + 2] * k + fb * (1 - k); }
  }
  const tex = new THREE.DataTexture(new Uint8Array(d.buffer), AW, AH, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}
const cells = (g, fn) => { for (let v = 0; v < 4; v++) fn(g, (v % 2) * 256, (v >> 1) * 256, v); };

// ---------------------------------------------------------------- geometry
// Collects triangles in metres for a reference tree, then squeezes them into the unit tree.
function builder(refH, refC) {
  const pos = [], nor = [], uv = [], col = [], sway = [], idx = [];
  const v = (x, y, z, nx, ny, nz, u, w, c, s) => {
    pos.push(x / refC, y / refH, z / refC); nor.push(nx, ny, nz); uv.push(u / AW, w / AH); col.push(c, c, c); sway.push(s);
    return pos.length / 3 - 1;
  };
  return {
    v, idx,
    // a tapering limb along a list of points [x, y, z, radius]; bark from the atlas column at u0
    limb(pts, sides, u0, uw, vPerM, shade, swayFn, lift = 0) {
      let vv = 0;
      const rings = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        if (i > 0) vv += Math.hypot(p[0] - a[0], p[1] - a[1], p[2] - a[2]) * vPerM;
        // a frame across the limb
        let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
        const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
        let ax = Math.abs(ty) > 0.9 ? 1 : 0, ay = Math.abs(ty) > 0.9 ? 0 : 1;
        let ux = ay * tz - 0 * ty, uy = 0 * tx - ax * tz, uz = ax * ty - ay * tx;
        const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
        const wx = ty * uz - tz * uy, wy = tz * ux - tx * uz, wz = tx * uy - ty * ux;
        // the bark runs up and back down (mirrored) so it never shows a seam along the limb
        const m = vv % 2, vt = (m > 1 ? 2 - m : m) * (AH - 8) + 4;
        const ring = [];
        for (let k = 0; k <= sides; k++) {
          const ang = (k / sides) * 6.283, c = Math.cos(ang), s = Math.sin(ang);
          const nx = ux * c + wx * s, ny = uy * c + wy * s, nz = uz * c + wz * s;
          const kk = k / sides, ut = u0 + 4 + (kk > 0.5 ? 2 - 2 * kk : 2 * kk) * (uw - 8);
          // (lift tips the lighting normal skywards: a pale stem catches the sky's light all round)
          const ll = Math.hypot(nx, ny + lift, nz);
          ring.push(v(p[0] + nx * p[3], p[1] + ny * p[3], p[2] + nz * p[3], nx / ll, (ny + lift) / ll, nz / ll, ut, vt, shade(p), swayFn(p)));
        }
        rings.push(ring);
      }
      for (let i = 0; i + 1 < rings.length; i++) for (let k = 0; k < sides; k++) {
        const a = rings[i][k], b = rings[i][k + 1], c = rings[i + 1][k], d = rings[i + 1][k + 1];
        idx.push(a, c, b, b, c, d);
      }
    },
    // a twig card hanging from (x, y, z): w wide, h tall, turned by yaw, leaning by tilt
    card(x, y, z, w, h, yaw, tilt, variant, normalOf, shade, swayTop, anchor = 0) {
      const cx = Math.cos(yaw), sz = Math.sin(yaw);
      const u0 = (variant % 2) * 256 + 8, v0 = ((variant >> 1) & 1) * 256 + 8, us = 240;
      const flip = variant & 4 ? -1 : 1;
      const q = [];
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const lx = (i - 0.5) * w * flip, drop = (j - anchor) * h;
        // tilt swings the lower edge out of the plane
        const ox = lx * cx + Math.sin(tilt) * drop * -sz, oz = lx * sz + Math.sin(tilt) * drop * cx, oy = -Math.cos(tilt) * drop;
        const px = x + ox, py = y + oy, pz = z + oz;
        const n = normalOf(px, py, pz);
        q.push(v(px, py, pz, n[0], n[1], n[2], u0 + i * us, v0 + j * us, shade(px, py, pz), swayTop + j * 0.75));
      }
      idx.push(q[0], q[2], q[1], q[1], q[2], q[3]);
    },
    build() {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setAttribute('sway', new THREE.Float32BufferAttribute(sway, 1));
      geo.setIndex(idx);
      return geo;
    },
  };
}

// Silver birch: one pale leaning stem, dark limbs that rise and then weep, twigs hanging in curtains.
function birchGeometry() {
  const H = 16, C = 9, b = builder(H, C), r = rng(31337);   // (the laser-scan crown widths run wide: 9 m is typical)
  // crown: an egg from 4.2 m to the top, widest a third of the way up
  const crownR = (y) => {
    const t = (y - 4.2) / (H - 4.2);
    if (t <= 0 || t >= 1) return 0.25;
    return 0.3 + 2.5 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.8);
  };
  const leanX = (y) => 0.35 * Math.sin((y / H) * 2.2) + 0.012 * y, leanZ = (y) => 0.22 * Math.sin((y / H) * 3.1 + 1);
  // the nearer the stem and the lower in the crown, the darker
  const shadeAt = (x, y, z) => {
    const d = Math.hypot(x - leanX(y), z - leanZ(y)) / crownR(y);
    return Math.min(1, 0.5 + 0.34 * Math.min(1, d) + 0.2 * Math.min(1, Math.max(0, (y - 3.5) / 9)));
  };
  // leaf cards are lit as if the crown were one soft egg
  const normalOf = (x, y, z) => {
    let nx = x - leanX(y), ny = (y - 9.6) * 0.5 + 1.1, nz = z - leanZ(y);
    const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  };

  const stem = [];
  for (let i = 0; i <= 10; i++) {
    const y = (i / 10) * H * 0.95;
    stem.push([leanX(y), y, leanZ(y), 0.02 + 0.2 * Math.pow(1 - i / 10, 1.15) + (i === 0 ? 0.07 : 0)]);
  }
  // dark, fissured foot; white above
  b.limb(stem, 8, BARK, 224, 0.42, (p) => (p[1] < 0.3 ? 0.3 : p[1] < 1.7 ? 0.62 : 0.5 + 0.5 * Math.min(1, 0.75 + (p[1] - 1.7) / 14)), (p) => Math.pow(p[1] / H, 2) * 0.3, 0.7);

  let variant = 0;
  // hanging sprays (cells 0, 1) and clumps of foliage (cells 2, 3); bit 2 mirrors the card
  const hang = (x, y, z, scale, n) => {
    for (let k = 0; k < n; k++) {
      const w = (1.7 + r() * 0.8) * scale, h = (2.2 + r() * 1.3) * scale;
      b.card(x + (r() - 0.5) * 0.5, y + 0.2 + r() * 0.3, z + (r() - 0.5) * 0.5, w, h, r() * 6.283, (r() - 0.5) * 0.4, (variant++ % 2) + (r() < 0.5 ? 4 : 0), normalOf, shadeAt, 0.25);
    }
  };
  const clump = (x, y, z, scale, n) => {
    for (let k = 0; k < n; k++) {
      const w = (2.3 + r() * 0.9) * scale;
      b.card(x + (r() - 0.5) * 0.7, y + (r() - 0.3) * 0.6, z + (r() - 0.5) * 0.7, w, w * (0.95 + r() * 0.25), r() * 6.283, (r() - 0.5) * 0.9, 2 + (variant++ % 2) + (r() < 0.5 ? 4 : 0), normalOf, shadeAt, 0.3, 0.45);
    }
  };
  const limbs = 14;
  for (let i = 0; i < limbs; i++) {
    const t = i / (limbs - 1), y0 = 4.0 + t * (H * 0.88 - 4.0) + (r() - 0.5) * 0.5;
    const az = i * 2.39996 + r() * 0.5, reach = crownR(y0 + 1.2) * (0.8 + r() * 0.25);
    const dx = Math.cos(az), dz = Math.sin(az), rise = 0.75 + 0.5 * (1 - t);
    const pts = [];
    for (let k = 0; k <= 5; k++) {
      const s = k / 5, out = reach * s;
      // up and out, then drooping at the tip
      const y = y0 + rise * reach * (s - 0.55 * s * s * s) * 1.25;
      pts.push([leanX(y0) + dx * out, y, leanZ(y0) + dz * out, Math.max(0.012, (0.07 - 0.035 * t) * (1 - s * 0.85))]);
    }
    b.limb(pts, 3, DARK, 224, 0.5, (p) => 0.6 + 0.3 * Math.min(1, Math.hypot(p[0], p[2]) / 2.5), (p) => Math.pow(p[1] / H, 2) * 0.4);
    const sc = 0.8 + 0.3 * (1 - t);
    for (let k = 2; k <= 5; k++) clump(pts[k][0], pts[k][1], pts[k][2], sc, 1);
    hang(pts[4][0], pts[4][1], pts[4][2], sc, 1);
    hang(pts[5][0], pts[5][1], pts[5][2], sc, 2);
  }
  // fill the middle of the crown and feather the top
  for (let i = 0; i < 22; i++) {
    const y = 6 + r() * (H - 7), a = r() * 6.283, d = crownR(y) * (0.15 + r() * 0.6);
    clump(leanX(y) + Math.cos(a) * d, y, leanZ(y) + Math.sin(a) * d, 0.9, 1);
  }
  // a skirt of hanging twigs round the widest part
  for (let i = 0; i < 12; i++) {
    const y = 6.5 + r() * 4.5, a = i * 0.5236 + r() * 0.4, d = crownR(y) * (0.8 + r() * 0.2);
    hang(leanX(y) + Math.cos(a) * d, y, leanZ(y) + Math.sin(a) * d, 0.95, 1);
  }
  clump(leanX(H * 0.95), H * 0.97, leanZ(H * 0.95), 0.6, 3);
  return b.build();
}

// A broad crown on a stem: lime, oak, poplar and (with needle tufts) pine. The crown is a shell of
// foliage cards facing outwards over a few limbs, with some more inside so it is not hollow.
// c: H, C (m), seed, base (m, where the crown starts), maxR (m), profile(t) 0..1 up the crown -> 0..1 width,
// lumpy, lean, stemR, stemTop, lift, stemShade(y), limbs, rise, droop, limbR, shell, inner, card [from, span] (m), squat
function crownGeometry(c) {
  const { H, C } = c, b = builder(H, C), r = rng(c.seed);
  const crownR = (y) => {
    const t = (y - c.base) / (H - c.base);
    return t <= 0 || t >= 1 ? 0.3 : 0.3 + c.maxR * c.profile(t);
  };
  const leanX = (y) => c.lean * (0.4 * Math.sin((y / H) * 2.2) + 0.012 * y), leanZ = (y) => c.lean * 0.25 * Math.sin((y / H) * 3.1 + 1);
  const mid = c.base + (H - c.base) * 0.45;
  const shadeAt = (x, y, z) => {
    const d = Math.hypot(x - leanX(y), z - leanZ(y)) / crownR(y);
    return Math.min(1, 0.46 + 0.36 * Math.min(1, d) + 0.22 * Math.min(1, Math.max(0, (y - c.base) / (H - c.base))));
  };
  const normalOf = (x, y, z) => {
    const nx = x - leanX(y), ny = (y - mid) * 0.7 + c.maxR * 0.3, nz = z - leanZ(y);
    const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  };

  const stem = [];
  for (let i = 0; i <= 8; i++) {
    const y = (i / 8) * H * c.stemTop;
    stem.push([leanX(y), y, leanZ(y), 0.03 + c.stemR * Math.pow(1 - i / 8, 0.9) + (i === 0 ? c.stemR * 0.35 : 0)]);
  }
  b.limb(stem, 7, BARK, 224, 0.4, (p) => c.stemShade(p[1]), (p) => Math.pow(p[1] / H, 2) * 0.25, c.lift);

  let variant = 0;
  // a card that faces out of the crown at azimuth az; high in the crown it lies back like a roof tile
  const clump = (x, y, z, az, scale) => {
    const up = Math.max(0, Math.min(1, (y - mid) / (H - mid)));
    const w = (c.card[0] + r() * c.card[1]) * scale * (1 - 0.3 * up * up);        // smaller at the very top, or they stick out like sheets
    b.card(x, y, z, w, w * (c.squat || 1) * (0.9 + r() * 0.25), az + 1.571 + (r() - 0.5) * 1.5, -up * 0.75 + (r() - 0.5) * 0.6,
      (variant++ % 4) + (r() < 0.5 ? 4 : 0), normalOf, shadeAt, 0.3, 0.45);
  };
  for (let i = 0; i < c.limbs; i++) {
    const t = i / Math.max(1, c.limbs - 1), y0 = c.base * 0.92 + t * (H * 0.8 - c.base * 0.92) + (r() - 0.5) * 0.5;
    const az = i * 2.39996 + r() * 0.5, reach = crownR(y0 + c.rise * 1.5) * (0.7 + r() * 0.2);
    const dx = Math.cos(az), dz = Math.sin(az);
    const pts = [];
    for (let k = 0; k <= 4; k++) {
      const s = k / 4, out = reach * s, bend = c.crook ? Math.sin(s * 5 + i) * c.crook * reach : 0;
      const y = y0 + c.rise * reach * (s - c.droop * s * s * s);
      pts.push([leanX(y0) + dx * out - dz * bend, y, leanZ(y0) + dz * out + dx * bend, Math.max(0.015, c.limbR * (1 - 0.5 * t) * (1 - s * 0.8))]);
    }
    b.limb(pts, 3, DARK, 224, 0.5, () => 0.75, (p) => Math.pow(p[1] / H, 2) * 0.35);
    for (let k = 2; k <= 4; k++) clump(pts[k][0], pts[k][1], pts[k][2], az + (r() - 0.5), 0.95);
  }
  // the shell, spread evenly over the crown's height and round it
  for (let i = 0; i < c.shell; i++) {
    const t = Math.pow((i + 0.5) / c.shell, 0.85), y = c.base + 0.2 + t * (H - c.base - 0.7);
    const az = i * 2.39996 + r() * 0.6;
    const d = crownR(y) * (0.78 + r() * 0.16) * (1 + (c.lumpy || 0) * Math.sin(az * 3 + y * 0.6));
    clump(leanX(y) + Math.cos(az) * d, y, leanZ(y) + Math.sin(az) * d, az, 1);
  }
  for (let i = 0; i < c.inner; i++) {
    const y = c.base + 0.8 + r() * (H - c.base - 1.6), az = r() * 6.283, d = crownR(y) * (0.15 + r() * 0.4);
    clump(leanX(y) + Math.cos(az) * d, y, leanZ(y) + Math.sin(az) * d, az, 0.9);
  }
  return b.build();
}

// Norway spruce: a straight stem to the tip, whorls of boughs that droop and lift at the ends,
// short curtains of twigs hanging from them. Green to the ground.
function spruceGeometry() {
  const H = 18, C = 7, b = builder(H, C), r = rng(2024);
  const base = 1.2;
  const coneR = (y) => Math.max(0.15, 3.3 * Math.pow(Math.max(0, 1 - (y - base) / (H - base)), 0.82));
  const shadeAt = (x, y, z) => Math.min(1, 0.42 + 0.42 * Math.min(1, Math.hypot(x, z) / coneR(y)) + 0.18 * Math.min(1, y / H));
  const normalOf = (x, y, z) => {
    const l = Math.hypot(x, z) || 1, nx = x / l, nz = z / l, n = Math.hypot(1, 0.75);
    return [nx / n, 0.75 / n, nz / n];
  };
  const stem = [];
  for (let i = 0; i <= 6; i++) { const y = (i / 6) * H * 0.98; stem.push([0, y, 0, 0.015 + 0.2 * (1 - i / 6) + (i === 0 ? 0.06 : 0)]); }
  b.limb(stem, 6, BARK, 224, 0.4, (p) => (p[1] < 0.4 ? 0.5 : 0.75), (p) => Math.pow(p[1] / H, 2) * 0.2, 0.2);
  let variant = 0;
  const whorls = 15;
  for (let i = 0; i < whorls; i++) {
    const t = i / (whorls - 1), y = base + 0.5 + Math.pow(t, 0.92) * (H - base - 1.4), R = coneR(y - 0.4);
    const n = t > 0.8 ? 4 : 7, turn = r() * 6.283;
    for (let k = 0; k < n; k++) {
      const az = turn + (k / n) * 6.283 + (r() - 0.5) * 0.4, dx = Math.cos(az), dz = Math.sin(az);
      const len = R * (0.95 + r() * 0.2), w = Math.max(0.9, len * (0.95 + r() * 0.3));
      // the bough: a card from the stem outwards, drooping
      b.card(dx * 0.1, y + 0.25, dz * 0.1, w, len * 1.12, az - 1.571, 1.08 + r() * 0.22, (variant++ % 4) + (r() < 0.5 ? 4 : 0), normalOf, shadeAt, 0.05, 0);
      // and a curtain of twigs hanging across it, which is what you see from the side
      if (len > 0.9) {
        const d = len * (0.45 + r() * 0.3), cw = Math.max(1.1, len * 1.1), ch = 1.3 + R * 0.5;
        b.card(dx * d, y + 0.15 - d * 0.42, dz * d, cw, ch, az + (r() - 0.5) * 0.5, (r() - 0.5) * 0.3, (variant++ % 4) + (r() < 0.5 ? 4 : 0), normalOf, shadeAt, 0.3, 0.12);
      }
    }
  }
  // the leader
  for (let k = 0; k < 3; k++) b.card(0, H * 1.0, 0, 0.9, 1.7, k * 2.09, 0.12, k, normalOf, shadeAt, 0.4, 0);
  return b.build();
}

// One lump of a laser-scanned hedge or bush: a unit clump (1 wide, 1 high, foot at the origin) of six leaf
// cards, five standing round it facing outwards and one lying over the top. Thousands are drawn, one per
// half-metre cell, each scaled to the hedge's height, so it has to be this cheap (12 triangles).
function lumpGeometry() {
  const b = builder(1, 1), r = rng(909);
  const shadeAt = (x, y) => Math.min(1, 0.5 + 0.5 * Math.min(1, Math.max(0, y) / 0.8));
  const normalOf = (x, y, z) => { const l = Math.hypot(x, y - 0.3, z) || 1; return [x / l, (y - 0.3) / l, z / l]; };
  for (let k = 0; k < 5; k++) {
    const az = k * 1.2566 + r() * 0.4, d = 0.2 + r() * 0.06;
    b.card(Math.cos(az) * d, 0.5, Math.sin(az) * d, 1.08, 1.04, az + 1.571, -0.22 + (r() - 0.5) * 0.2, k + (r() < 0.5 ? 4 : 0), normalOf, shadeAt, 0.12, 0.5);
  }
  b.card(0, 0.92, 0, 1.05, 1.05, r() * 3, 1.22, 2, normalOf, shadeAt, 0.15, 0.5);
  return b.build();
}

// A garden bush, in metres with its foot at the origin: a low dome of the lime's leaf clumps on a
// few woody stems. Not instanced: placed as an ordinary mesh.
function bushGeometry() {
  const b = builder(1, 1), r = rng(606);
  const R = 1.35, top = 2.0;
  const shadeAt = (x, y, z) => Math.min(1, 0.5 + 0.3 * Math.min(1, Math.hypot(x, z) / R) + 0.25 * Math.min(1, y / top));
  const normalOf = (x, y, z) => { const l = Math.hypot(x, y - 0.5, z) || 1; return [x / l, (y - 0.5) / l, z / l]; };
  for (let k = 0; k < 4; k++) {
    const a = k * 1.7 + r(), d = 0.35 + r() * 0.3;
    b.limb([[Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12, 0.035], [Math.cos(a) * d, 0.7, Math.sin(a) * d, 0.022], [Math.cos(a) * d * 1.6, 1.3, Math.sin(a) * d * 1.6, 0.012]],
      3, DARK, 224, 1.2, () => 0.7, () => 0);
  }
  let variant = 0;
  const leaf = (x, y, z, az, w, lie) => b.card(x, y, z, w, w * (0.9 + r() * 0.2), az + 1.571 + (r() - 0.5) * 1.4, lie + (r() - 0.5) * 0.6,
    (variant++ % 4) + (r() < 0.5 ? 4 : 0), normalOf, shadeAt, 0.3, 0.45);
  for (let i = 0; i < 20; i++) {
    // from the skirt up over the top
    const t = (i + 0.5) / 20, el = t * 1.45, az = i * 2.39996 + r() * 0.5;
    const d = Math.cos(el) * R * (0.8 + r() * 0.15), y = 0.75 + Math.sin(el) * (top - 0.95);
    leaf(Math.cos(az) * d, y, Math.sin(az) * d, az, 1.35 + r() * 0.45, -t * 0.8);
  }
  for (let i = 0; i < 5; i++) { const az = r() * 6.283, d = r() * 0.5; leaf(Math.cos(az) * d, 0.8 + r() * 0.7, Math.sin(az) * d, az, 1.3, 0); }
  return b.build();
}

// ---------------------------------------------------------------- materials
// Shared by the close tree and the flat one: each tree draws itself only on its side of LOD,
// sways in the wind, and lets some sun through its leaves.
function treeMaterial(map, uniforms, opts) {
  const mat = new THREE.MeshLambertMaterial({ map, vertexColors: true, alphaTest: opts.alphaTest, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.uniforms.uLod = uniforms.uLod;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float sway;
        ${opts.flat ? 'attribute float lie;' : ''}
        uniform float uTime;
        uniform float uLod;
        varying float vLeaf;`)
      .replace('#include <project_vertex>', `
        vec4 wp = vec4(transformed, 1.0);
        vec3 root = vec3(0.0);
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
          root = instanceMatrix[3].xyz;
        #endif
        wp = modelMatrix * wp;
        // gusts roll across the map; each tree picks them up a little differently
        float ph = uTime * 1.15 + root.x * 0.06 + root.z * 0.045;
        float gust = sin(ph) + 0.5 * sin(ph * 2.3 + 1.7);
        wp.xz += sway * ${opts.sway.toFixed(3)} * (vec2(0.8, 0.55) * gust + 0.35 * vec2(sin(uTime * 3.1 + wp.y * 1.7 + root.x), cos(uTime * 2.7 + wp.x * 1.3 + root.z)));
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        vLeaf = ${opts.flat ? '1.0' : 'step(uv.x, 0.51)'};
        ${opts.flat ? `// the lying picture is only for looking down on the tree: from the road it would be a plate
        vec3 toCam = cameraPosition - wp.xyz;
        if (lie > 0.5 && toCam.y < 0.5 * length(toCam.xz)) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);` : ''}
        ${opts.lod ? `float dCam = distance(root.xz, cameraPosition.xz);
        if (dCam ${opts.lod > 0 ? '>' : '<'} uLod) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);` : ''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n        varying float vLeaf;')
      // cards are lit by the crown's shape, whichever way a card happens to face
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n        normal = normalize(vNormal);')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        #if NUM_DIR_LIGHTS > 0
          // sunlight coming through the leaves on the far side of the crown
          float through = max(0.0, dot(-normal, directionalLights[0].direction)) * 0.5 + 0.12;
          reflectedLight.directDiffuse += vLeaf * through * ${opts.through.toFixed(2)} * directionalLights[0].color * diffuseColor.rgb * vec3(0.95, 1.0, 0.45);
        #endif`);
  };
  mat.customProgramCacheKey = () => `tree:${opts.lod}:${opts.flat}:${opts.sway}:${opts.through}`;
  return mat;
}

// The flat tree: two crossed upright pictures and one lying in the crown for views from above.
function flatGeometry(halfW) {
  const pos = [], nor = [], uv = [], col = [], sway = [], lie = [], idx = [];
  const quad = (pts, uvs, nrm, lying = 0) => {
    const o = pos.length / 3;
    for (let i = 0; i < 4; i++) {
      pos.push(...pts[i]); uv.push(...uvs[i]); col.push(1, 1, 1); sway.push(pts[i][1] * pts[i][1]); lie.push(lying);
      const n = nrm(pts[i]), l = Math.hypot(...n); nor.push(n[0] / l, n[1] / l, n[2] / l);
    }
    idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
  };
  const S = 2 / 3;                                   // the side view takes the left two thirds of the picture
  const side = (c, s) => quad(
    [[-halfW * c, 0, -halfW * s], [halfW * c, 0, halfW * s], [-halfW * c, 1.04, -halfW * s], [halfW * c, 1.04, halfW * s]],
    [[0, 0], [S, 0], [0, 1], [S, 1]],
    // lit like a round crown: the edge towards the sun is the bright one
    (p) => [p[0] * 2.2, 0.3 + (p[1] - 0.5) * 0.5, p[2] * 2.2]);
  side(1, 0); side(0, 1);
  quad([[-halfW, 0.6, halfW], [halfW, 0.6, halfW], [-halfW, 0.6, -halfW], [halfW, 0.6, -halfW]],
    [[S, 0], [1, 0], [S, 0.5], [1, 0.5]], (p) => [p[0], 0.9, p[2]], 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('sway', new THREE.Float32BufferAttribute(sway, 1));
  geo.setAttribute('lie', new THREE.Float32BufferAttribute(lie, 1));
  geo.setIndex(idx);
  return geo;
}

// Photograph the close tree, unlit, from the side and from above: the picture the flat tree wears.
function snapshot(renderer, geo, map, halfW, fill) {
  const W = 768, Hh = 512;
  const rt = new THREE.WebGLRenderTarget(W, Hh, { depthBuffer: true });      // (no multisampling: its buffers would stay allocated for every species)
  rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
  rt.texture.generateMipmaps = true;
  rt.texture.anisotropy = 4;
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, vertexColors: true, alphaTest: 0.4, side: THREE.DoubleSide })));
  const keep = { target: renderer.getRenderTarget(), color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), auto: renderer.autoClear };
  renderer.setRenderTarget(rt);
  renderer.setClearColor(new THREE.Color(fill[0] / 255, fill[1] / 255, fill[2] / 255).convertSRGBToLinear(), 0);
  renderer.autoClear = false;
  renderer.clear();
  const cam = new THREE.OrthographicCamera(-halfW, halfW, 1.04, 0, 0.1, 10);
  cam.position.set(0, 0, 5); cam.updateMatrixWorld();
  rt.viewport.set(0, 0, 512, 512); rt.scissor.set(0, 0, 512, 512); rt.scissorTest = true;
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  const top = new THREE.OrthographicCamera(-halfW, halfW, halfW, -halfW, 0.1, 10);
  top.position.set(0, 5, 0); top.up.set(0, 0, -1); top.lookAt(0, 0, 0); top.updateMatrixWorld();
  rt.viewport.set(512, 0, 256, 256); rt.scissor.set(512, 0, 256, 256);
  renderer.setRenderTarget(rt);
  renderer.render(scene, top);
  rt.viewport.set(0, 0, W, Hh); rt.scissorTest = false;
  renderer.setRenderTarget(keep.target);
  renderer.setClearColor(keep.color, keep.alpha);
  renderer.autoClear = keep.auto;
  return rt.texture;
}

// The six species, by their numbers in scenery.js. Each: atlas painter, leaf colour, close-tree
// builder, half width of the flat picture (unit tree), wind, and how much sun the foliage lets through.
const dome = (t) => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.6);
const SPECIES = {
  // lime or maple: a full, even, rounded crown
  0: {
    fill: [50, 86, 34], halfW: 0.62, sway: 0.13, through: 0.3,
    draw(g) {
      cells(g, (g2, x, y, v) => leafClump(g2, x, y, v, { seed: 11, shape: 'lime', size: [11, 6], hue: [80, 24], light: [17, 23], sat: [32, 16], twigs: 22, loose: 190 }));
      furrowBark(g, BARK, 224, AH, 71, '#5b5149', '26,22,20', '150,138,122');
      furrowBark(g, DARK, 224, AH, 72, '#3d342f', '14,12,12', '120,104,92');
    },
    geo: () => crownGeometry({ H: 15, C: 9, seed: 101, base: 3.6, maxR: 4.0, profile: dome, lumpy: 0.07, lean: 0.4, stemR: 0.26, stemTop: 0.7, lift: 0.25,
      stemShade: (y) => (y < 0.4 ? 0.55 : 0.85), limbs: 9, rise: 0.75, droop: 0.3, limbR: 0.09, shell: 78, inner: 16, card: [3.0, 0.9] }),
  },
  // silver birch
  1: {
    fill: [58, 92, 36], halfW: 0.5, sway: 0.16, through: 0.3,
    draw(g) { cells(g, birchTwig); birchBark(g, BARK, 224, AH); darkBark(g, DARK, 224, AH); },
    geo: birchGeometry,
  },
  // oak: low, wide and lumpy on a thick stem, heavy crooked limbs
  2: {
    fill: [42, 72, 30], halfW: 0.68, sway: 0.09, through: 0.24,
    draw(g) {
      cells(g, (g2, x, y, v) => leafClump(g2, x, y, v, { seed: 23, shape: 'oak', size: [13, 6], hue: [76, 22], light: [14, 20], sat: [28, 16], twigs: 20, loose: 170 }));
      furrowBark(g, BARK, 224, AH, 81, '#4a4038', '16,13,12', '128,116,100');
      furrowBark(g, DARK, 224, AH, 82, '#372e29', '12,10,10', '104,92,80');
    },
    geo: () => crownGeometry({ H: 14, C: 11, seed: 202, base: 3.0, maxR: 5.0, profile: (t) => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 0.5), lumpy: 0.16, lean: 0.5, stemR: 0.4, stemTop: 0.55, lift: 0.2,
      stemShade: (y) => (y < 0.4 ? 0.5 : 0.8), limbs: 8, rise: 0.5, droop: 0.2, limbR: 0.16, crook: 0.12, shell: 86, inner: 18, card: [3.5, 1.0] }),
  },
  // poplar: a tall narrow column, limbs swept up against the stem
  3: {
    fill: [48, 84, 36], halfW: 0.4, sway: 0.2, through: 0.32,
    draw(g) {
      cells(g, (g2, x, y, v) => leafClump(g2, x, y, v, { seed: 37, shape: 'poplar', size: [10, 5], hue: [84, 24], light: [18, 22], sat: [30, 16], twigs: 24, loose: 200 }));
      furrowBark(g, BARK, 224, AH, 91, '#716d5f', '34,32,28', '170,166,148');
      furrowBark(g, DARK, 224, AH, 92, '#4a463c', '20,18,16', '130,124,108');
    },
    geo: () => crownGeometry({ H: 22, C: 6, seed: 303, base: 2.2, maxR: 1.35, profile: (t) => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.55)), 0.45), lean: 0.15, stemR: 0.24, stemTop: 0.9, lift: 0.3,
      stemShade: (y) => (y < 0.4 ? 0.55 : 0.85), limbs: 10, rise: 2.4, droop: 0.1, limbR: 0.06, shell: 84, inner: 10, card: [2.1, 0.7], squat: 1.25 }),
  },
  // Norway spruce
  4: {
    fill: [30, 58, 36], halfW: 0.56, sway: 0.07, through: 0.14,
    draw(g) {
      cells(g, spruceBough);
      furrowBark(g, BARK, 224, AH, 61, '#5a4840', '24,18,16', '140,118,104', 260);
      furrowBark(g, DARK, 224, AH, 62, '#3a2e2a', '14,11,10', '110,92,82', 160);
    },
    geo: spruceGeometry,
  },
  // Scots pine: a long bare stem, orange towards the top, under a flat ragged crown
  5: {
    fill: [44, 72, 48], halfW: 0.6, sway: 0.1, through: 0.14,
    draw(g) {
      cells(g, pineTufts);
      furrowBark(g, BARK, 224, AH, 51, '#a8643c', '60,30,18', '214,150,96', 420);
      furrowBark(g, DARK, 224, AH, 52, '#8a5234', '48,24,16', '190,128,84', 300);
    },
    geo: () => crownGeometry({ H: 20, C: 8, seed: 404, base: 10.5, maxR: 3.7, profile: (t) => Math.pow(Math.sin(Math.PI * Math.pow(t, 1.5)), 0.45), lumpy: 0.25, lean: 0.6, stemR: 0.3, stemTop: 0.9, lift: 0.35,
      // grey and plated below, the orange showing from half way up
      stemShade: (y) => (y < 0.4 ? 0.35 : y < 9 ? 0.45 + 0.05 * y : 1), limbs: 8, rise: 0.5, droop: 0.4, limbR: 0.13, crook: 0.18, shell: 58, inner: 10, card: [3.3, 1.0], squat: 0.72 }),
  },
};

// Returns species { n: { near, nearMat, far, farMat } } keyed by the species numbers of scenery.js,
// update(time) to move the wind, setLod(m) to move the distance where the flat picture takes over, and
// bush() for a hand-placed bush.
// only: a list of species to build (the lab page); cards false leaves out the close trees.
export function createRealTrees(renderer, { cards = true, lod = LOD, only = null } = {}) {
  const uniforms = { uTime: { value: 0 }, uLod: { value: lod } };
  const species = {};
  for (const id in SPECIES) {
    if (only && !only.includes(+id)) continue;
    const sp = SPECIES[id];
    const atlas = makeAtlas(sp.draw, sp.fill);
    const near = sp.geo();
    const picture = snapshot(renderer, near, atlas, sp.halfW, sp.fill);
    species[id] = {
      near: cards ? near : null,
      nearMat: treeMaterial(atlas, uniforms, { alphaTest: 0.4, lod: lod ? 1 : 0, sway: sp.sway, through: sp.through, flat: false }),
      far: flatGeometry(sp.halfW),
      // where there are no close trees to take over, the flat one is drawn at every distance
      farMat: treeMaterial(picture, uniforms, { alphaTest: 0.45, lod: cards && lod ? -1 : 0, sway: sp.sway * 0.6, through: sp.through, flat: true }),
      // for a hand-placed tree that is always drawn in full (the row on the start straight)
      soloMat: treeMaterial(atlas, uniforms, { alphaTest: 0.4, lod: 0, sway: sp.sway, through: sp.through, flat: false }),
    };
    if (!cards) { near.dispose(); atlas.dispose(); }
  }
  // a leafy bush in the lime's foliage: a mesh in metres, foot at its origin
  let bushGeo = null;
  const bush = () => (species[0] ? new THREE.Mesh((bushGeo ||= bushGeometry()), species[0].soloMat) : null);
  // the unit lump that hedges and bushes from the map data are built of, in the same foliage
  let lumpGeo = null;
  const lump = () => (species[0] ? { geometry: (lumpGeo ||= lumpGeometry()), material: species[0].soloMat } : null);
  return { species, bush, lump, update(t) { uniforms.uTime.value = t; }, setLod(m) { uniforms.uLod.value = m; } };
}
