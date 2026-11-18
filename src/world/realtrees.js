// Realistic trees: a bark-textured stem with real limbs, a crown of leaf-twig cards you can see
// through, and a flat picture of the same tree for the distance. Everything (bark, twigs, the
// distant picture) is drawn here at start-up, so there is nothing to download.
//
// A species is built once as a unit tree (height 1, crown diameter 1) like the simple trees in
// scenery.js, so the same per-tree instance matrices place both.
import * as THREE from 'three';

const AW = 1024, AH = 512;          // atlas: four twig cards (2 x 2, 256 px), pale bark, dark bark
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

function birchAtlas() {
  const cv = document.createElement('canvas');
  cv.width = AW; cv.height = AH;
  const g = cv.getContext('2d', { willReadFrequently: true });
  for (let v = 0; v < 4; v++) birchTwig(g, (v % 2) * 256, (v >> 1) * 256, v);
  birchBark(g, BARK, 224, AH);
  darkBark(g, DARK, 224, AH);
  const img = g.getImageData(0, 0, AW, AH), d = img.data;
  // Clear pixels come back black, and the smaller mip levels would mix that black into the leaf
  // edges. Give them leaf green instead and keep only the outline in alpha.
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a === 0) { d[i] = 58; d[i + 1] = 92; d[i + 2] = 36; }
    else if (a < 255) { const k = a / 255; d[i] = d[i] * k + 58 * (1 - k); d[i + 1] = d[i + 1] * k + 92 * (1 - k); d[i + 2] = d[i + 2] * k + 36 * (1 - k); }
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

// ---------------------------------------------------------------- materials
// Shared by the close tree and the flat one: each tree draws itself only on its side of LOD,
// sways in the wind, and lets some sun through its leaves.
function treeMaterial(map, uniforms, opts) {
  const mat = new THREE.MeshLambertMaterial({ map, vertexColors: true, alphaTest: opts.alphaTest, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float sway;
        ${opts.flat ? 'attribute float lie;' : ''}
        uniform float uTime;
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
        if (dCam ${opts.lod > 0 ? '>' : '<'} ${Math.abs(opts.lod).toFixed(1)}) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);` : ''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n        varying float vLeaf;')
      // cards are lit by the crown's shape, whichever way a card happens to face
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n        normal = normalize(vNormal);')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        #if NUM_DIR_LIGHTS > 0
          // sunlight coming through the leaves on the far side of the crown
          float through = max(0.0, dot(-normal, directionalLights[0].direction)) * 0.5 + 0.12;
          reflectedLight.directDiffuse += vLeaf * through * 0.3 * directionalLights[0].color * diffuseColor.rgb * vec3(0.95, 1.0, 0.45);
        #endif`);
  };
  mat.customProgramCacheKey = () => `tree:${opts.lod}:${opts.flat}:${opts.sway}`;
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
function snapshot(renderer, geo, map, halfW) {
  const W = 768, Hh = 512;
  const rt = new THREE.WebGLRenderTarget(W, Hh, { samples: 4, depthBuffer: true });
  rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
  rt.texture.generateMipmaps = true;
  rt.texture.anisotropy = 4;
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, vertexColors: true, alphaTest: 0.4, side: THREE.DoubleSide })));
  const keep = { target: renderer.getRenderTarget(), color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), auto: renderer.autoClear };
  renderer.setRenderTarget(rt);
  renderer.setClearColor(new THREE.Color(58 / 255, 92 / 255, 36 / 255).convertSRGBToLinear(), 0);
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

// Returns { 1: { near, nearMat, far, farMat } } for the species that have a realistic tree, keyed by
// the species numbers of scenery.js, and update(time) to move the wind.
export function createRealTrees(renderer, { cards, lod = LOD }) {
  const uniforms = { uTime: { value: 0 } };
  const atlas = birchAtlas();
  const near = birchGeometry();
  const halfW = 0.5;
  const picture = snapshot(renderer, near, atlas, halfW);
  const species = {
    1: {
      near: cards ? near : null,
      nearMat: treeMaterial(atlas, uniforms, { alphaTest: 0.4, lod, sway: 0.16, flat: false }),
      far: flatGeometry(halfW),
      // where there are no close trees to take over, the flat one is drawn at every distance
      farMat: treeMaterial(picture, uniforms, { alphaTest: 0.45, lod: cards ? -lod : 0, sway: 0.1, flat: true }),
    },
  };
  return { species, update(t) { uniforms.uTime.value = t; } };
}
