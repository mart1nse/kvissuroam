// Painted house fronts for whole streets. The map's own 3D houses (LOD2) are plain blocks; here every wall of
// a chosen house gets a picture painted for it (boards, plinth, windows, doors, signs) that is laid a hand's
// breadth in front of the real wall, on exactly the wall's own triangles, so gables and odd shapes fit.
// All pictures of a street share a few big textures (an atlas), so a street costs a handful of draw calls.
import * as THREE from 'three';
import { rnd } from '../race/landmarks.js';

export const tone = (rgb, k) => `rgb(${Math.min(255, rgb[0] * k) | 0},${Math.min(255, rgb[1] * k) | 0},${Math.min(255, rgb[2] * k) | 0})`;
const hexRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const shade = (hex, k) => tone(hexRgb(hex), k);
export const rgbHex = (rgb) => (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];

// ---------------------------------------------------------------- the paint box
// Drawing in metres on a rectangle of an atlas canvas: x along the wall, y up from the house's ground line.
function painter(c, px, py, wm, y0, y1, ppm) {
  const X = (x) => px + x * ppm, Y = (y) => py + (y1 - y) * ppm;
  const P = {
    w: wm, y0, y1, c, ppm,
    r(x0, ya, x1, yb, col) { c.fillStyle = col; c.fillRect(X(x0), Y(yb), (x1 - x0) * ppm, (yb - ya) * ppm); },
    grad(x0, ya, x1, yb, top, bottom) {
      const g = c.createLinearGradient(0, Y(yb), 0, Y(ya));
      g.addColorStop(0, top); g.addColorStop(1, bottom);
      c.fillStyle = g; c.fillRect(X(x0), Y(yb), (x1 - x0) * ppm, (yb - ya) * ppm);
    },
    text(str, x, y, size, col, font = '700 %px Arial, sans-serif', align = 'center', angle = 0) {
      c.save(); c.translate(X(x), Y(y)); c.rotate(angle);
      c.font = font.replace('%', Math.max(4, Math.round(size * ppm))); c.fillStyle = col; c.textAlign = align; c.textBaseline = 'middle';
      c.fillText(str, 0, 0); c.restore();
    },
    arc(x, y, r, col, a0 = 0, a1 = Math.PI * 2) { c.fillStyle = col; c.beginPath(); c.moveTo(X(x), Y(y)); c.arc(X(x), Y(y), r * ppm, a0, a1); c.fill(); },
    poly(pts, col) { c.fillStyle = col; c.beginPath(); pts.forEach(([x, y], k) => (k ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)))); c.closePath(); c.fill(); },
    line(x0, ya, x1, yb, col, w = 0.04) { c.strokeStyle = col; c.lineWidth = Math.max(1, w * ppm); c.beginPath(); c.moveTo(X(x0), Y(ya)); c.lineTo(X(x1), Y(yb)); c.stroke(); },
    // a window: surround, frame, glass with mullions. T: a cross bar a third down with one upright under it
    win(x0, ya, x1, yb, { frame = '#f4f1ea', glass = '#5d6f8c', fw = 0.07, bars = 1, rails = 0, T = false, surround = 0, sc = '#f4f1ea', lit = 0, hood = 0, sill = 0.08, apron = 0 } = {}) {
      if (surround) P.r(x0 - surround, ya - surround * 0.6, x1 + surround, yb + surround, sc);
      if (hood) P.r(x0 - surround - 0.1, yb + surround, x1 + surround + 0.1, yb + surround + hood, sc);
      if (sill) P.r(x0 - surround - 0.06, ya - surround * 0.6 - sill, x1 + surround + 0.06, ya - surround * 0.6, sc);
      if (apron) P.r(x0 - surround * 0.5, ya - surround * 0.6 - sill - apron, x1 + surround * 0.5, ya - surround * 0.6 - sill, sc);
      P.r(x0, ya, x1, yb, frame);
      if (lit) P.grad(x0 + fw, ya + fw, x1 - fw, yb - fw, '#fff0c4', '#f6d79a'); else P.grad(x0 + fw, ya + fw, x1 - fw, yb - fw, glass, shade(glass, 0.72));
      if (T) {
        const yt = yb - (yb - ya) * 0.3;
        P.r(x0, yt - fw / 2, x1, yt + fw / 2, frame);
        P.r((x0 + x1) / 2 - fw / 2, ya, (x0 + x1) / 2 + fw / 2, yt, frame);
      } else {
        for (let k = 1; k <= bars; k++) { const x = x0 + (x1 - x0) * k / (bars + 1); P.r(x - fw / 2, ya, x + fw / 2, yb, frame); }
        for (let k = 1; k <= rails; k++) { const y = ya + (yb - ya) * k / (rails + 1); P.r(x0, y - fw / 2, x1, y + fw / 2, frame); }
      }
    },
    brick(x0, ya, x1, yb, rgb, seed = 1) {
      const r = rnd(seed);
      P.r(x0, ya, x1, yb, tone(rgb, 0.8));
      for (let y = ya, row = 0; y < yb; y += 0.09, row++) {
        for (let x = x0 - (row % 2) * 0.13; x < x1; x += 0.26) {
          c.fillStyle = tone(rgb, 0.9 + r() * 0.2);
          const xa = Math.max(x0, x + 0.012), xb = Math.min(x1, x + 0.25);
          if (xb > xa) c.fillRect(X(xa), Y(Math.min(yb, y + 0.078)), (xb - xa) * ppm, Math.max(1, 0.066 * ppm));
        }
      }
    },
    // field stones in mortar
    rubble(x0, ya, x1, yb, seed = 1, mortar = '#6f675f', tones = [[176, 160, 140], [150, 138, 128], [190, 172, 150], [160, 140, 124], [140, 134, 136], [186, 150, 132]], size = 1) {
      const r = rnd(seed);
      P.r(x0, ya, x1, yb, mortar);
      c.save(); c.beginPath(); c.rect(X(x0), Y(yb), (x1 - x0) * ppm, (yb - ya) * ppm); c.clip();
      for (let y = ya + 0.16 * size; y < yb + 0.1; y += 0.3 * size) {
        for (let x = x0 - r() * 0.2; x < x1; ) {
          const w = (0.24 + r() * 0.34) * size, h = (0.2 + r() * 0.14) * size, t = tones[Math.floor(r() * tones.length)];
          c.fillStyle = tone(t, 0.9 + r() * 0.2);
          c.beginPath(); c.ellipse(X(x + w / 2), Y(y + (r() - 0.5) * 0.06), w / 2 * ppm, h / 2 * ppm, (r() - 0.5) * 0.5, 0, 7); c.fill();
          x += w + 0.03;
        }
      }
      c.restore();
    },
    // weatherboards lying (or standing: upright = true)
    boards(x0, ya, x1, yb, rgb, pitch = 0.15, upright = false) {
      P.r(x0, ya, x1, yb, tone(rgb, 1));
      if (upright) for (let x = x0; x < x1; x += pitch) P.r(x, ya, Math.min(x1, x + 0.022), yb, tone(rgb, 0.8));
      else for (let y = ya; y < yb; y += pitch) P.r(x0, y, x1, Math.min(yb, y + 0.024), tone(rgb, 0.8));
    },
    // years of rain: darker and paler streaks over a stretch of wall
    weather(x0, ya, x1, yb, amount, seed = 1) {
      const r = rnd(seed);
      c.save(); c.beginPath(); c.rect(X(x0), Y(yb), (x1 - x0) * ppm, (yb - ya) * ppm); c.clip();
      for (let k = 0; k < (x1 - x0) * (yb - ya) * 1.6 * amount; k++) {
        // soft streaks running down the wall, never hard-edged blocks
        const x = x0 + r() * (x1 - x0), y = ya + r() * (yb - ya), w = 0.12 + r() * 0.5, h = 0.5 + r() * 1.6;
        const dark = r() < 0.6, a = (dark ? 0.035 + r() * 0.06 : 0.03 + r() * 0.05) * amount, col = dark ? '60,48,44' : '236,226,210';
        const g = c.createLinearGradient(X(x), 0, X(x + w), 0);
        g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
        c.fillStyle = g;
        c.fillRect(X(x), Y(y + h), w * ppm, h * ppm);
      }
      c.restore();
    },
    // a panelled door (two leaves when wider than 1.25 m)
    door(x0, x1, h, col, { frame = '#f4f1ea', fw = 0.1, light = 0.35, panels = 2, glass = '#5d6f8c' } = {}) {
      P.r(x0 - fw, 0, x1 + fw, h + fw, frame);
      P.r(x0, 0, x1, h, col);
      const leaves = x1 - x0 > 1.25 ? 2 : 1, lw = (x1 - x0) / leaves, dark = shade(col, 0.78);
      const hh = h - (light ? light + 0.06 : 0);
      if (light) { P.r(x0, h - light - 0.05, x1, h - light, frame); P.r(x0 + 0.04, h - light, x1 - 0.04, h - 0.04, glass); }
      for (let l = 0; l < leaves; l++) {
        const xa = x0 + l * lw;
        for (let k = 0; k < panels; k++) P.r(xa + 0.1, 0.18 + (hh - 0.3) * k / panels, xa + lw - 0.1, 0.1 + (hh - 0.3) * (k + 1) / panels, dark);
        if (l) P.r(xa - 0.012, 0, xa + 0.012, hh, dark);
      }
    },
  };
  return P;
}

// ---------------------------------------------------------------- the atlas
function createAtlas(size = 2048) {
  const pages = [];
  const page = () => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const p = { cv, c: cv.getContext('2d'), x: 2, y: 2, row: 0 };
    pages.push(p);
    return p;
  };
  // a rectangle of w x h pixels: { page index, x, y }
  function take(w, h) {
    let p = pages[pages.length - 1] || page();
    if (p.x + w + 2 > size) { p.x = 2; p.y += p.row + 4; p.row = 0; }
    if (p.y + h + 2 > size) { p = page(); }
    const r = { k: pages.indexOf(p), x: p.x, y: p.y };
    p.x += w + 4; p.row = Math.max(p.row, h);
    return r;
  }
  return { pages, take, size };
}

// ---------------------------------------------------------------- the walls of a house
// All upright wall faces of the buildings in a sector that share `base` (the LOD2 base height in cm) and
// whose triangles pass pick(x, z), sorted into flat walls.
export function wallPlanes(world, secKey, base, pick) {
  const [sx, sz] = secKey.split('_').map(Number);
  const s = world.sectors.get((sx + 512) * 4096 + (sz + 512));
  if (!s || !s.buildings || !s.buildings.nv) return [];
  const { nv, buf, offset } = s.buildings;
  const cache = (s.buildings.skin ||= {
    pq: new Int16Array(buf.slice(offset, offset + nv * 6)), nq: new Int8Array(buf, offset + nv * 6, nv * 3),
    kind: new Uint8Array(buf, offset + nv * 12, nv), base: new Int16Array(buf.slice(offset + nv * 13, offset + nv * 15)),
  });
  const { pq, nq, kind } = cache, bs = cache.base;
  const groups = [];
  for (let t = 0; t < nv; t += 3) {
    if (bs[t] !== base || kind[t] === 1) continue;
    const ny = nq[t * 3 + 1] / 127;
    if (Math.abs(ny) > 0.3) continue;
    const v = [];
    for (let i = t; i < t + 3; i++) v.push([s.x0 + pq[i * 3] * 0.05, pq[i * 3 + 1] * 0.01, s.z0 + pq[i * 3 + 2] * 0.05]);
    if (!pick((v[0][0] + v[1][0] + v[2][0]) / 3, (v[0][2] + v[1][2] + v[2][2]) / 3)) continue;
    let nx = nq[t * 3] / 127, nz = nq[t * 3 + 2] / 127;
    const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
    const d = v[0][0] * nx + v[0][2] * nz;
    let g = groups.find((q) => q.nx * nx + q.nz * nz > 0.996 && Math.abs(q.d - d) < 0.3);
    if (!g) groups.push((g = { nx, nz, d, tris: [] }));
    g.tris.push(v);
  }
  const out = [];
  for (const g of groups) {
    const ux = g.nz, uz = -g.nx;                       // along the wall with the outside on the right-hand side
    let s0 = 1e9, s1 = -1e9, ylo = 1e9, yhi = -1e9;
    for (const tr of g.tris) for (const p of tr) { const q = p[0] * ux + p[2] * uz; if (q < s0) s0 = q; if (q > s1) s1 = q; if (p[1] < ylo) ylo = p[1]; if (p[1] > yhi) yhi = p[1]; }
    const len = s1 - s0;
    if (len < 0.9 || yhi - ylo < 0.8) continue;
    // the wall's upper and lower edge every 25 cm
    const n = Math.max(2, Math.ceil(len / 0.25)), top = new Float32Array(n).fill(-1e9), bot = new Float32Array(n).fill(1e9);
    for (const tr of g.tris) {
      const q = tr.map((p) => [p[0] * ux + p[2] * uz - s0, p[1]]);
      const a = Math.min(q[0][0], q[1][0], q[2][0]), b = Math.max(q[0][0], q[1][0], q[2][0]);
      for (let k = Math.max(0, Math.floor(a / len * n)); k <= Math.min(n - 1, Math.floor(b / len * n)); k++) {
        const sc = Math.min(b, Math.max(a, (k + 0.5) * len / n));
        for (let e = 0; e < 3; e++) {
          const p = q[e], r = q[(e + 1) % 3];
          if ((p[0] - sc) * (r[0] - sc) > 0 && Math.abs(p[0] - r[0]) > 1e-6) continue;
          const y = Math.abs(p[0] - r[0]) < 1e-6 ? null : p[1] + (r[1] - p[1]) * (sc - p[0]) / (r[0] - p[0]);
          for (const yy of y === null ? [p[1], r[1]] : [y]) { if (yy > top[k]) top[k] = yy; if (yy < bot[k]) bot[k] = yy; }
        }
      }
    }
    const ax = g.nx * g.d + ux * s0, az = g.nz * g.d + uz * s0;
    out.push({ ...g, ux, uz, s0, len, ylo, yhi, top, bot, a: [ax, az], b: [ax + ux * len, az + uz * len], mid: [ax + ux * len / 2, az + uz * len / 2] });
  }
  return out;
}

// ---------------------------------------------------------------- a street's worth of house fronts
// houses: [{ sec, base, at: [x, z], r, spec, walls: [{ near: [x, z], ...overrides }] }]
// spec (all lengths in metres; colours [r, g, b] or css):
//   kind 'wood' | 'plaster' | 'brick' | 'stone'; wall; upright; pitch; weather; trim (corner boards, belts, eaves);
//   plinth { h, type 'plaster' | 'rubble' | 'brick', col }; floors [{ sill, h }] ; win { w, pitch, ... P.win options };
//   belts [y]; attic { w, h }; doors [{ x, w, h, col, canopy }] (per wall via walls[].doors); draw(P, W, auto)
export function skinHouses(world, group, houses, { faces = () => true, ppm = 26, far = 11, shadows = true, debug = false } = {}) {
  const atlas = createAtlas();
  const jobs = [];
  const h = (x, z) => world.heightAt(x, z);
  for (const H of houses) {
    const r2 = (H.r || 16) ** 2;
    const planes = wallPlanes(world, H.sec, H.base, (x, z) => (x - H.at[0]) ** 2 + (z - H.at[1]) ** 2 < r2 && (!H.pick || H.pick(x, z)));
    if (debug) console.log('house', H.name || H.base, planes.map((w) => `${w.mid[0].toFixed(1)},${w.mid[1].toFixed(1)} L${w.len.toFixed(1)} n${w.nx.toFixed(2)},${w.nz.toFixed(2)}`).join(' | '));
    for (const W of planes) {
      const over = (H.walls || []).find((o) => Math.hypot(o.near[0] - W.mid[0], o.near[1] - W.mid[1]) < (o.within || 2.5)) || {};
      if (over.skip) continue;
      const spec = { ...H.spec, ...(over.spec || {}) };
      // the ground along the wall's foot; the house's ground line is its highest point
      let gmax = -1e9, gmin = 1e9;
      for (let k = 0; k <= 4; k++) { const y = h(W.a[0] + W.ux * W.len * k / 4 + W.nx * 0.6, W.a[1] + W.uz * W.len * k / 4 + W.nz * 0.6); if (y > gmax) gmax = y; if (y < gmin) gmin = y; }
      W.yref = over.yref ?? gmax;
      const ylo = Math.max(W.ylo, gmin - 0.6), yhi = W.yhi;
      if (yhi - ylo < 0.6) continue;
      const front = faces(W);
      let q = front ? (over.ppm || spec.ppm || ppm) : far;
      q = Math.min(q, 1800 / W.len, 1800 / (yhi - ylo));
      const pw = Math.max(4, Math.round(W.len * q)), ph = Math.max(4, Math.round((yhi - ylo) * q));
      const rect = atlas.take(pw, ph);
      const pg = atlas.pages[rect.k], c = pg.c;
      c.save();
      c.beginPath(); c.rect(rect.x - 2, rect.y - 2, pw + 4, ph + 4); c.clip();
      const P = painter(c, rect.x, rect.y, W.len, ylo - W.yref, yhi - W.yref, pw / W.len);
      // helpers that know the wall's outline
      const k = (x) => Math.max(0, Math.min(W.top.length - 1, Math.floor(x / W.len * W.top.length)));
      W.topAt = (x) => W.top[k(x)] - W.yref;
      W.botAt = (x) => W.bot[k(x)] - W.yref;
      const sorted = Array.from(W.top).filter((v) => v > -1e8).sort((a, b) => a - b);
      W.eaves = (sorted[Math.floor(sorted.length * 0.12)] ?? yhi) - W.yref;
      W.peak = yhi - W.yref;
      W.foot = Math.min(...Array.from(W.bot)) - W.yref;
      W.front = front;
      c.fillStyle = typeof spec.wall === 'string' ? spec.wall : tone(spec.wall || [200, 200, 200], 1);
      c.fillRect(rect.x - 2, rect.y - 2, pw + 4, ph + 4);
      paintWall(P, W, spec, over, H);
      c.restore();
      jobs.push({ W, rect, pw, ph, ylo, yhi });
    }
  }
  // geometry: every wall's own triangles, pushed 7 cm out, one mesh per atlas page
  const S = atlas.size, OFF = 0.07;
  atlas.pages.forEach((pg, pk) => {
    const pos = [], nor = [], uv = [];
    for (const { W, rect, pw, ph, ylo, yhi } of jobs) {
      if (rect.k !== pk) continue;
      for (const tr of W.tris) {
        const ex = tr[1][0] - tr[0][0], ey = tr[1][1] - tr[0][1], ez = tr[1][2] - tr[0][2], fx = tr[2][0] - tr[0][0], fy = tr[2][1] - tr[0][1], fz = tr[2][2] - tr[0][2];
        const cx = ey * fz - ez * fy, cz = ex * fy - ey * fx;
        const order = cx * W.nx + cz * W.nz >= 0 ? [0, 1, 2] : [0, 2, 1];
        for (const i of order) {
          const p = tr[i], sm = p[0] * W.ux + p[2] * W.uz - W.s0;
          pos.push(p[0] + W.nx * OFF, p[1], p[2] + W.nz * OFF);
          nor.push(W.nx, 0, W.nz);
          uv.push((rect.x + sm / W.len * pw) / S, 1 - (rect.y + (yhi - Math.max(ylo, p[1])) / (yhi - ylo) * ph) / S);
        }
      }
    }
    if (!pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const tex = new THREE.CanvasTexture(pg.cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex }));
    m.receiveShadow = shadows;
    group.add(m);
  });
  return jobs.map((j) => j.W);
}

const css = (v, k = 1) => (typeof v === 'string' ? (k === 1 ? v : shade(v, k)) : tone(v, k));

// The standard house wall: plinth, cladding, trim, rows of windows fitted to the wall's length and outline,
// doors, a window in the gable. over.draw(P, W) paints extras on top; over.only(P, W) replaces everything.
export function paintWall(P, W, spec, over = {}, H = {}) {
  const len = W.len, seed = Math.round(Math.abs(W.mid[0] * 7.3 + W.mid[1] * 3.1)) % 997 + 1, r = rnd(seed);
  if (over.only) { over.only(P, W, spec); return; }
  const wall = spec.wall || [200, 200, 200], trim = spec.trim || '#f1ede4';
  const pl = spec.plinth || { h: 0.6, type: 'plaster', col: '#9a989e' };
  const raised = W.foot > 1.6;                          // a wall that starts above a roof: no plinth, no door
  const top = P.y1, low = P.y0;
  // cladding
  if (spec.kind === 'brick') P.brick(0, low, len, top, wall, seed);
  else if (spec.kind === 'stone') P.rubble(0, low, len, top, seed);
  else if (spec.kind === 'plaster') {
    P.r(0, low, len, top, css(wall));
    for (let k = 0; k < len * (top - low) * 0.5; k++) { P.c.fillStyle = `rgba(${r() < 0.5 ? '255,250,240' : '90,80,80'},${0.03 + r() * 0.04})`; const x = r() * len, y = low + r() * (top - low); P.r(x, y, x + 0.4 + r() * 1.5, y + 0.2 + r() * 0.8, P.c.fillStyle); }
  } else P.boards(0, low, len, top, wall, spec.pitch || 0.15, !!spec.upright);
  if (spec.upper && !raised) {                           // a different cladding above a height
    const u = spec.upper;
    if (u.kind === 'plaster') P.r(0, u.from, len, top, css(u.wall)); else P.boards(0, u.from, len, top, u.wall, u.pitch || spec.pitch || 0.15, !!u.upright);
  }
  if (spec.weather) P.weather(0, low, len, top, spec.weather, seed);
  if (!raised) {
    // plinth
    if (pl.type === 'rubble') P.rubble(0, low, len, pl.h, seed + 3); else if (pl.type === 'brick') P.brick(0, low, len, pl.h, pl.col || [170, 96, 80], seed + 3); else P.r(0, low, len, pl.h, css(pl.col || '#9a989e'));
    if (pl.band) P.r(0, pl.h, len, pl.h + (pl.bandH || 0.14), css(pl.band));
    if (pl.vents) for (let x = 1.2 + r() * 1.5; x < len - 1.2; x += pl.vents) P.r(x, Math.max(0.12, pl.h - 0.5), x + 0.55, Math.max(0.3, pl.h - 0.18), '#2e2c33');
  }
  for (const y of spec.belts || []) if (y < W.eaves - 0.2 && y > W.foot) P.r(0, y, len, y + 0.14, css(trim));
  if (spec.corners !== false && spec.kind !== 'brick' && spec.kind !== 'stone') {
    const cw = spec.corners || 0.14, y0 = raised ? low : pl.h;
    P.r(0, y0, cw, top, css(trim)); P.r(len - cw, y0, len, top, css(trim));
  }
  // doors first, windows keep clear of them
  const doors = (over.doors || []).map((d) => ({ w: 1.0, h: 2.15, col: spec.door || '#6a4a3c', ...d, x: d.x < 0 ? len + d.x : d.x }));
  // windows
  const wn = { w: 1.0, pitch: 2.4, T: true, surround: 0.1, sc: trim, frame: '#f4f1ea', glass: '#56647c', ...(spec.win || {}), ...(over.win || {}) };
  let floors = over.floors || spec.floors;
  if (!floors) {                                         // storeys fitted between the plinth and the eaves
    const y0 = raised ? W.foot : pl.h, room = W.eaves - y0 - 0.25, st = spec.storey || 3.0;
    const nf = Math.max(1, Math.min(spec.maxFloors || 4, Math.round(room / st))), sh = room / nf, wh = Math.min(spec.winH || 1.55, sh - 1.15);
    floors = wh < 0.5 ? [] : Array.from({ length: nf }, (_, k) => ({ sill: y0 + k * sh + Math.max(0.55, (sh - wh) * 0.52), h: wh }));
  }
  const n = over.n ?? Math.max(1, Math.round((len - 0.6) / wn.pitch));
  const xs = over.xs ? over.xs.map((x) => (x < 0 ? len + x : x)) : Array.from({ length: n }, (_, k) => (k + 0.5) * len / n);
  const { w: ww, pitch: _p, ...wopt } = wn;
  const blind = over.blind || [];
  floors.forEach((f, fi) => {
    if (len < ww + 0.7) return;
    const fxs = f.xs ? f.xs.map((x) => (x < 0 ? len + x : x)) : xs, fw = f.w || ww;
    fxs.forEach((x, xi) => {
      const y0 = f.sill, y1 = f.sill + f.h;
      if (Math.min(W.topAt(x - fw / 2), W.topAt(x + fw / 2), W.topAt(x)) < y1 + 0.3) return;      // under the roof slope
      if (Math.max(W.botAt(x - fw / 2), W.botAt(x + fw / 2)) > y0 - 0.25) return;                  // the wall starts higher here
      if (fi === 0 && doors.some((d) => Math.abs(d.x - x) < (d.w + fw) / 2 + 0.3)) return;
      if (blind.some(([bf, bx]) => bf === fi && bx === xi)) {                                         // boarded up
        P.r(x - fw / 2 - 0.08, y0 - 0.08, x + fw / 2 + 0.08, y1 + 0.08, css(trim)); P.boards(x - fw / 2, y0, x + fw / 2, y1, typeof wall === 'string' ? hexRgb(wall) : wall.map((v) => v * 0.9), 0.15, true);
        return;
      }
      const lit = W.front && r() < (spec.lit ?? 0.16);
      P.win(x - fw / 2, y0, x + fw / 2, y1, { ...wopt, ...(f.win || {}), lit });
      if (f.shutters || (fi === 0 && spec.shutters)) { const sc = css(f.shutters || spec.shutters); for (const d of [-1, 1]) { const xa = x + d * (fw / 2 + 0.12), xb = xa + d * fw * 0.48; P.r(Math.min(xa, xb), y0, Math.max(xa, xb), y1, sc); P.r(Math.min(xa, xb) + 0.05, y0 + 0.08, Math.max(xa, xb) - 0.05, y1 - 0.08, shade(sc.startsWith('#') ? sc : '#b0a080', 0.9)); } }
    });
  });
  // the gable: a window (or two) under the ridge
  const at = spec.attic === undefined ? { w: 0.8, h: 1.0 } : spec.attic;
  const lastTop = floors.length ? floors[floors.length - 1].sill + floors[floors.length - 1].h : 0;
  if (at && !over.noAttic && W.peak - W.eaves > 2.0 && len > 3) {
    let pk = 0; for (let k = 0; k < W.top.length; k++) if (W.top[k] > W.top[pk]) pk = k;
    const x = (pk + 0.5) * len / W.top.length, y0 = Math.max(W.eaves + 0.25, lastTop + 0.9);
    if (x > 1.2 && x < len - 1.2 && W.topAt(x - at.w / 2 - 0.3) > y0 + at.h + 0.3 && W.topAt(x + at.w / 2 + 0.3) > y0 + at.h + 0.3) {
      if (at.round) { P.arc(x, y0 + at.h / 2, at.h / 2 + 0.08, css(trim)); P.arc(x, y0 + at.h / 2, at.h / 2 - 0.04, '#56647c'); }
      else P.win(x - at.w / 2, y0, x + at.w / 2, y0 + at.h, { ...wopt, T: false, bars: at.bars ?? 1, rails: 0 });
    }
  }
  if (spec.eaves !== false && W.peak - W.eaves < 0.6) P.r(0, top - (spec.eaves || 0.22), len, top, css(trim));
  for (const d of doors) {
    if (raised) break;
    P.door(d.x - d.w / 2, d.x + d.w / 2, d.h, d.col, { frame: css(d.frame || trim), light: d.light ?? 0.35, panels: d.panels ?? 2 });
    if (d.canopy) { P.poly([[d.x - d.w / 2 - 0.5, d.h + 0.35], [d.x + d.w / 2 + 0.5, d.h + 0.35], [d.x + d.w / 2 + 0.3, d.h + 0.6], [d.x - d.w / 2 - 0.3, d.h + 0.6]], css(d.canopy)); }
    if (d.steps) for (let k = 0; k < d.steps; k++) P.r(d.x - d.w / 2 - 0.3 + k * 0.05, low, d.x + d.w / 2 + 0.3 - k * 0.05, 0.02 - (d.steps - 1 - k) * 0.17, '#a39c98');
  }
  if (over.draw) over.draw(P, W, spec);
}

// A picture of its own (not in an atlas), drawn in metres: for fences, walls and signs
export function paintTexture(wm, y0, y1, ppm, draw, { repeat = false, alpha = false } = {}) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(4, Math.round(wm * ppm)); cv.height = Math.max(4, Math.round((y1 - y0) * ppm));
  const c = cv.getContext('2d');
  if (alpha) c.clearRect(0, 0, cv.width, cv.height);
  draw(painter(c, 0, 0, wm, y0, y1, ppm));
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) t.wrapS = THREE.RepeatWrapping;
  return t;
}
