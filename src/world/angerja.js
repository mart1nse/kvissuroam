// Äksi, the houses along Angerja tänav round the jogger's loop (Martin, 19 Nov), detailed from the Land Board's
// 2024 oblique photos (kaldaerofotod) and the 10 cm orthophoto:
//   - every house in its real colours with painted fronts (boards or render, plinth, windows, doors), the solar
//     panels on the long outbuilding and on the brown house;
//   - the ground: mown lawns in every garden, the gravel drives and yards, the concrete pad by the garage, the
//     footpaths, the vegetable beds behind the big cream house;
//   - thuja rows and clipped hedges, greenhouses, a play house, wood stacks, compost bins and a washing line.
// Placed in game coordinates read off the orthophoto with a 2 m grid on it.
import * as THREE from 'three';
import { streetKit, addHouseColours, lawnTex, KIT } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { SURFACE } from './data.js';

const SEC = '-2_-20', SX0 = -2080, SZ0 = -13600;
const ZONE = { x0: -1834, x1: -1734, z0: -13300, z1: -13202 };    // the gardens that get lawn laid
const CENTRE = [-1785, -13252];

// LOD2 base (cm), a point inside, colours. The yellow house at the bend is the one shown purple before.
const HOUSES = [
  { name: 'yellow', base: 2342, x: -1780, z: -13266, wall: 0xf4e8a8, roof: 0xb4b8c4, r: 11,
    spec: { kind: 'wood', wall: [244, 232, 168], pitch: 0.14, trim: '#fbf8ee', corners: 0.16, plinth: { h: 0.55, type: 'plaster', col: '#a4a3ac' },
      win: { w: 1.1, pitch: 2.7, frame: '#fbf8ee', bars: 1, T: false, surround: 0.08, sc: '#fbf8ee' }, attic: { w: 0.9, h: 1.1, bars: 1 }, door: '#7a5c48', lit: 0.2 } },
  { name: 'grey', base: 2351, x: -1762, z: -13266, wall: 0xded8cc, roof: 0x5f616c, r: 10,
    spec: { kind: 'plaster', wall: [222, 216, 204], trim: '#f4f2ec', corners: false, plinth: { h: 0.6, type: 'plaster', col: '#8f8e96' },
      win: { w: 1.2, pitch: 2.8, frame: '#f6f4ee', bars: 1, T: true }, door: '#5e5a62' } },
  { name: 'garage', base: 2365, x: -1757.5, z: -13256, wall: 0xecece8, roof: 0x55565f, r: 7,
    spec: { kind: 'wood', wall: [236, 236, 230], upright: true, pitch: 0.12, trim: '#f8f8f4', plinth: { h: 0.3, type: 'plaster', col: '#9a99a0' },
      win: { w: 0.9, pitch: 4, frame: '#f8f8f4', bars: 1 }, attic: null, maxFloors: 1, storey: 2.4 } },
  { name: 'white', base: 2321, x: -1759, z: -13287, wall: 0xf4f4f0, roof: 0x3c3e4a, r: 12,
    spec: { kind: 'plaster', wall: [244, 244, 240], trim: '#3d3f4a', corners: false, plinth: { h: 0.45, type: 'plaster', col: '#6c6b74' },
      win: { w: 1.3, pitch: 2.9, frame: '#3d3f4a', bars: 1, T: false, glass: '#4a5872' }, attic: { w: 1.0, h: 1.2, bars: 1 }, door: '#3d3f4a', lit: 0.25 } },
  { name: 'long', base: 2393, x: -1762, z: -13244, wall: 0xe8e8e2, roof: 0x7e818e, r: 16,
    spec: { kind: 'wood', wall: [232, 232, 226], pitch: 0.15, trim: '#f8f8f2', plinth: { h: 0.4, type: 'plaster', col: '#94939a' },
      win: { w: 1.0, pitch: 3.4, frame: '#f8f8f2', bars: 1 }, maxFloors: 1, storey: 2.6, attic: null } },
  { name: 'shed', base: 2409, x: -1769, z: -13241, wall: 0x74605a, roof: 0x5a4a48, r: 6,
    spec: { kind: 'wood', wall: [128, 102, 92], upright: true, pitch: 0.16, trim: '#d8d2c8', plinth: { h: 0.25, type: 'plaster', col: '#77757c' },
      win: { w: 0.7, pitch: 5, frame: '#d8d2c8', bars: 0 }, maxFloors: 1, attic: null } },
  { name: 'brown', base: 2445, x: -1747, z: -13227, wall: 0xa07a80, roof: 0x6b4a46, r: 14,
    spec: { kind: 'plaster', wall: [164, 124, 130], trim: '#f2ece6', corners: false, plinth: { h: 0.5, type: 'plaster', col: '#6e6a72' },
      win: { w: 1.2, pitch: 2.8, frame: '#f6f2ee', bars: 1, T: true }, attic: { w: 0.9, h: 1.0, bars: 1 }, door: '#5a4040' } },
  { name: 'annex', base: 2744, x: -1738, z: -13232, wall: 0xe2ded6, roof: 0x9a9ca6, r: 7,
    spec: { kind: 'plaster', wall: [226, 222, 214], trim: '#f6f4ee', corners: false, plinth: { h: 0.3, type: 'plaster', col: '#8e8c94' }, win: { w: 1.0, pitch: 2.6, frame: '#f6f4ee' }, attic: null } },
  { name: 'cream', base: 2397, x: -1810, z: -13225, wall: 0xeee8d8, roof: 0x5e5659, r: 15,
    spec: { kind: 'plaster', wall: [238, 232, 216], trim: '#fbf8f0', corners: 0.2, plinth: { h: 0.7, type: 'plaster', col: '#9c9aa2' }, belts: [3.0],
      win: { w: 1.15, pitch: 2.7, frame: '#fbf8f0', bars: 1, T: true, surround: 0.08, sc: '#fbf8f0' }, door: '#6e5444', lit: 0.18 } },
  { name: 'cream2', base: 2265, x: -1818, z: -13285, wall: 0xece2c8, roof: 0x56575f, r: 14,
    spec: { kind: 'plaster', wall: [236, 226, 200], trim: '#fbf8ee', corners: 0.18, plinth: { h: 0.6, type: 'plaster', col: '#94929a' },
      win: { w: 1.2, pitch: 2.8, frame: '#fbf8ee', bars: 1, T: true }, door: '#5a4a44' } },
  { name: 'bluegrey', base: 2282, x: -1799, z: -13304, wall: 0xc4ccd6, roof: 0xdde1e8, r: 10,
    spec: { kind: 'plaster', wall: [196, 204, 214], trim: '#f6f8fa', corners: false, plinth: { h: 0.6, type: 'plaster', col: '#8a8c96' }, win: { w: 1.2, pitch: 2.7, frame: '#f6f8fa', bars: 1 } } },
];

export function angerjaWalls(walls) {
  addHouseColours(walls, SEC, SX0, SZ0, HOUSES.map(({ base, x, z, wall, roof, r }) => ({ base, x, z, wall, roof, reach: r + 4 })));
}

// ---- the ground. Strips: a centre line, a width and a kind; a two-point strip is a rectangle.
const GROUND = [
  // the yellow house: its gravel drive along the north side to the grey house, the apron by the street
  [[[-1785.5, -13280.5], [-1777, -13274.6], [-1770, -13272.9], [-1764.5, -13273.6]], 3.0, 'gravel'],
  [[[-1786, -13276.5], [-1781, -13279.5]], 4.5, 'gravel'],
  // the white house: a wide gravel yard in front, the wooden deck at its door
  [[[-1776, -13283], [-1763, -13283]], 9.5, 'gravel'],
  [[[-1771, -13289.5], [-1763, -13289.5]], 3.5, 'gravel'],
  // the garage: concrete pad on its north side
  [[[-1761.5, -13262.3], [-1753.5, -13262.3]], 3.6, 'concrete'],
  // the drive east of the street (where the RAV4 stands), the yard between the long building and the brown house
  [[[-1779.5, -13222.8], [-1770, -13229.4], [-1761, -13235.5]], 4.2, 'gravel'],
  [[[-1763, -13238.5], [-1753, -13238.5]], 7.5, 'gravel'],
  // footpath of concrete slabs from the drive to the brown house
  [[[-1767, -13210.5], [-1753, -13221.5]], 1.0, 'slabs'],
  // the cream house west of the street: path from the street to its side door, the stub drive at its corner
  [[[-1797.5, -13237.5], [-1802.6, -13233.3]], 1.1, 'slabs'],
  // the cream house in the north: paved yard by the street and the car shelter
  [[[-1811, -13278], [-1802.5, -13278]], 6.5, 'paver'],
  [[[-1807, -13284], [-1803, -13284]], 4, 'paver'],
  // vegetable beds behind the big cream house and in the north garden
  [[[-1826, -13232], [-1826, -13222]], 1.2, 'soil'], [[[-1828.4, -13232], [-1828.4, -13222]], 1.2, 'soil'], [[[-1830.8, -13232], [-1830.8, -13222]], 1.2, 'soil'],
  [[[-1815.5, -13242], [-1808, -13242]], 3.4, 'soil'],
  [[[-1832, -13298], [-1824, -13298]], 1.1, 'soil'], [[[-1832, -13295.8], [-1824, -13295.8]], 1.1, 'soil'],
];

function dist2Seg(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
  return (a[0] + dx * k - x) ** 2 + (a[1] + dz * k - z) ** 2;
}
const inStrip = (x, z, [pts, w]) => { for (let i = 0; i < pts.length - 1; i++) if (dist2Seg(x, z, pts[i], pts[i + 1]) < (w / 2) ** 2) return true; return false; };

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function rnd(seed) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
// pale gravel with stones and wheel tracks worn darker; one tile is 3 m
const gravelTex = () => canvasTex(256, 256, (g, w) => {
  const r = rnd(5);
  g.fillStyle = '#d9cfc2'; g.fillRect(0, 0, w, w);
  for (let k = 0; k < 9000; k++) { const v = r(); g.fillStyle = v < 0.4 ? 'rgba(170,158,150,0.6)' : v < 0.8 ? 'rgba(240,232,222,0.7)' : 'rgba(140,128,124,0.6)'; g.fillRect(r() * w, r() * w, 1 + r() * 2.5, 1 + r() * 2); }
});
// big concrete slabs with joints; one tile is 2 m
const slabTex = () => canvasTex(128, 128, (g, w) => {
  const r = rnd(3);
  g.fillStyle = '#8f8c98'; g.fillRect(0, 0, w, w);
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) { const v = 0.92 + r() * 0.1; g.fillStyle = `rgb(${210 * v | 0},${207 * v | 0},${216 * v | 0})`; g.fillRect(a * 32 + 1, b * 32 + 1, 30, 30); }
});
// dug garden soil in rows; one tile is 2 m
const soilTex = () => canvasTex(128, 128, (g, w) => {
  const r = rnd(9);
  g.fillStyle = '#8a6e62'; g.fillRect(0, 0, w, w);
  for (let y = 0; y < w; y += 16) { g.fillStyle = '#9c8072'; g.fillRect(0, y, w, 7); }
  for (let k = 0; k < 900; k++) { g.fillStyle = r() < 0.5 ? 'rgba(110,86,78,0.6)' : 'rgba(170,146,132,0.5)'; g.fillRect(r() * w, r() * w, 1 + r() * 2, 1 + r() * 2); }
});
// cast concrete; one tile is 3 m
const concreteTex = () => canvasTex(128, 128, (g, w) => {
  const r = rnd(4);
  g.fillStyle = '#d6d3dc'; g.fillRect(0, 0, w, w);
  for (let k = 0; k < 1500; k++) { g.fillStyle = r() < 0.5 ? 'rgba(180,176,188,0.5)' : 'rgba(236,234,240,0.5)'; g.fillRect(r() * w, r() * w, 1 + r() * 3, 1 + r() * 3); }
  g.fillStyle = '#a8a4b2'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, w);
});
const KINDS = {
  lawn: { lift: 0.05, tile: 4, f: -3, tex: lawnTex },
  gravel: { lift: 0.07, tile: 3, f: -5, tex: gravelTex },
  concrete: { lift: 0.08, tile: 3, f: -6, tex: concreteTex },
  slabs: { lift: 0.09, tile: 2, f: -7, tex: slabTex },
  paver: { lift: 0.08, tile: 1.6, f: -6, tex: null },
  soil: { lift: 0.07, tile: 2, f: -5, tex: soilTex },
};

function layGround(world, group) {
  const h = (x, z) => world.heightAt(x, z);
  const G = {};
  for (const k of Object.keys(KINDS)) G[k] = { pos: [], uv: [], col: [] };
  const quad = (kind, q, tint = 1) => {
    const K = KINDS[kind], A = G[kind];
    const up = (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]) - (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) > 0;
    for (const k of up ? [0, 1, 2, 2, 1, 3] : [0, 2, 1, 1, 2, 3]) {
      A.pos.push(q[k][0], h(q[k][0], q[k][1]) + K.lift, q[k][1]);
      A.uv.push(q[k][0] / K.tile, q[k][1] / K.tile);
      A.col.push(tint, tint, tint);
    }
  };
  // lawn: a 0.5 m mesh over the gardens wherever the map has grass and no building. The grass map is
  // in 1 m squares, so the lawn's edge fades out over about a metre (bilinear over the squares)
  // instead of showing their saw-tooth along the road. Faint mowing stripes ride on the tint.
  const NX = ZONE.x1 - ZONE.x0, NZ = ZONE.z1 - ZONE.z0, cell = new Float32Array(NX * NZ);
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
    const cx = ZONE.x0 + i + 0.5, cz = ZONE.z0 + j + 0.5;
    if (world.surfaceAt(cx, cz) !== SURFACE.GRASS || world.sdfAt(cx, cz) < 0.2) continue;
    if (GROUND.some((s) => s[2] !== 'soil' && inStrip(cx, cz, s) && inStrip(cx - 0.5, cz - 0.5, s) && inStrip(cx + 0.5, cz + 0.5, s))) continue;
    cell[i * NZ + j] = 1;
  }
  const C = (i, j) => cell[Math.min(NX - 1, Math.max(0, i)) * NZ + Math.min(NZ - 1, Math.max(0, j))];
  const alphaAt = (x, z) => {
    const u = x - ZONE.x0 - 0.5, v = z - ZONE.z0 - 0.5, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const w = (C(i, j) * (1 - fu) + C(i + 1, j) * fu) * (1 - fv) + (C(i, j + 1) * (1 - fu) + C(i + 1, j + 1) * fu) * fv;
    const t = Math.min(1, Math.max(0, (w - 0.3) / 0.45));
    // and fade out over the last 6 m of the zone so it melts into the photo ground beyond
    const e = Math.min(1, (x - ZONE.x0) / 6, (ZONE.x1 - x) / 6, (z - ZONE.z0) / 6, (ZONE.z1 - z) / 6);
    return t * t * (3 - 2 * t) * Math.max(0, e);
  };
  const L = G.lawn, LK = KINDS.lawn;
  L.alpha = true;
  // (the mesh's corners are worked out once each, not once for each of the squares and triangles that meet
  // there: fade, height and tint. Done per triangle corner this loop was 60 ms of standstill on the way in.)
  const MX = NX * 2 + 1, MZ = NZ * 2 + 1, fade = new Float32Array(MX * MZ), hy = new Float32Array(MX * MZ).fill(NaN), tint = new Float32Array(MX * MZ);
  for (let i = 0; i < MX; i++) for (let j = 0; j < MZ; j++) fade[i * MZ + j] = alphaAt(ZONE.x0 + i * 0.5, ZONE.z0 + j * 0.5);
  const CORNER = [0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1];           // the two triangles of a square, as steps in x and z
  for (let i = 0; i < MX - 1; i++) for (let j = 0; j < MZ - 1; j++) {
    if (fade[i * MZ + j] + fade[(i + 1) * MZ + j] + fade[i * MZ + j + 1] + fade[(i + 1) * MZ + j + 1] === 0) continue;
    for (let k = 0; k < 12; k += 2) {
      const ci = i + CORNER[k], cj = j + CORNER[k + 1], n = ci * MZ + cj, px = ZONE.x0 + ci * 0.5, pz = ZONE.z0 + cj * 0.5;
      if (hy[n] !== hy[n]) {
        hy[n] = h(px, pz) + LK.lift;
        tint[n] = (0.94 + 0.06 * ((Math.floor((px * 0.6 + pz * 0.8) / 1.2) & 1)))
          * (0.9 + 0.05 * Math.sin(px * 0.21 + 2 * Math.sin(pz * 0.13)) + 0.04 * Math.sin(pz * 0.37 - px * 0.11));   // drier and lusher patches
      }
      L.pos.push(px, hy[n], pz);
      L.uv.push(px / LK.tile, pz / LK.tile);
      L.col.push(tint[n], tint[n], tint[n], fade[n]);
    }
  }
  // the strips: cut in 1 m pieces along and across
  for (const [pts, w, kind] of GROUND) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
      const nx = -uz, nz = ux, n = Math.max(1, Math.ceil(len)), m = Math.max(1, Math.ceil(w / 1.2));
      // the joints between pieces of a bent strip: run each piece on by half the width
      const s0 = i > 0 ? -w / 2 : 0, s1 = len + (i < pts.length - 2 ? w / 2 : 0);
      for (let j = 0; j < n; j++) for (let k = 0; k < m; k++) {
        const sa = s0 + (s1 - s0) * j / n, sb = s0 + (s1 - s0) * (j + 1) / n, la = -w / 2 + w * k / m, lb = -w / 2 + w * (k + 1) / m;
        const P = (s, l) => [a[0] + ux * s + nx * l, a[1] + uz * s + nz * l];
        const c = P((sa + sb) / 2, (la + lb) / 2);
        if (world.sdfAt(c[0], c[1]) < 0.1) continue;
        quad(kind, [P(sa, la), P(sa, lb), P(sb, la), P(sb, lb)]);
      }
    }
  }
  for (const [kind, K] of Object.entries(KINDS)) {
    const A = G[kind];
    if (!A.pos.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(A.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(A.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(A.col, A.alpha ? 4 : 3));
    const nor = new Float32Array(A.pos.length);
    for (let k = 1; k < nor.length; k += 3) nor[k] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    const tex = K.tex ? K.tex() : null;
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex, color: K.tex ? 0xffffff : 0xcfcdd8, vertexColors: true, transparent: !!A.alpha, depthWrite: !A.alpha, polygonOffset: true, polygonOffsetFactor: K.f, polygonOffsetUnits: K.f, side: THREE.DoubleSide }));
    m.receiveShadow = true;
    group.add(m);
  }
}

// solar panels laid over the roof triangles of a house that face `dir` (a unit vector on the map)
function solarPanels(world, group, base, at, r, dir) {
  const s = [...world.sectors.values()].find((q) => `${q.sx}_${q.sz}` === SEC);
  if (!s || !s.buildings) return;
  const { nv, buf, offset } = s.buildings;
  const pq = new Int16Array(buf.slice(offset, offset + nv * 6));
  const kind = new Uint8Array(buf, offset + nv * 12, nv);
  const bs = new Int16Array(buf.slice(offset + nv * 13, offset + nv * 15));
  const pos = [], uv = [];
  const V = (i) => [SX0 + pq[i * 3] * 0.05, pq[i * 3 + 1] * 0.01, SZ0 + pq[i * 3 + 2] * 0.05];
  for (let t = 0; t < nv; t += 3) {
    if (bs[t] !== base || kind[t] !== 1) continue;
    const a = V(t), b = V(t + 1), c = V(t + 2);
    if (Math.hypot((a[0] + b[0] + c[0]) / 3 - at[0], (a[2] + b[2] + c[2]) / 3 - at[1]) > r) continue;
    const e = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], f = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]];
    const l = Math.hypot(...n); n = n.map((v) => v / l);
    if (n[1] < 0) n = n.map((v) => -v);
    if (n[1] > 0.97 || n[0] * dir[0] + n[2] * dir[1] < 0.2) continue;       // flat or facing away
    // shrink the triangle towards its middle so the panels stop short of the eaves and the ridge
    const m = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    // panel rows run across the slope: u along the eaves, v up the slope
    const ux = -dir[1], uz = dir[0];
    for (const p of [a, b, c]) {
      const q = [m[0] + (p[0] - m[0]) * 0.86 + n[0] * 0.12, m[1] + (p[1] - m[1]) * 0.86 + n[1] * 0.12, m[2] + (p[2] - m[2]) * 0.86 + n[2] * 0.12];
      pos.push(...q);
      uv.push((q[0] * ux + q[2] * uz) / 1.05, (q[1] / Math.max(0.2, Math.hypot(n[0], n[2]))) / 1.7);
    }
  }
  if (!pos.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const tex = canvasTex(64, 96, (c, w, h) => {
    c.fillStyle = '#c9ccd6'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#28345e'; c.fillRect(2, 2, w - 4, h - 4);
    c.fillStyle = 'rgba(120,140,200,0.35)';
    for (let x = 2; x < w - 2; x += 10) c.fillRect(x, 2, 1, h - 4);
    for (let y = 2; y < h - 2; y += 10) c.fillRect(2, y, w - 4, 1);
  });
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.receiveShadow = true;
  group.add(m);
}

export function createAngerja(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function build() {
    built = true;
    skinHouses(world, group, HOUSES.map((H) => ({ sec: SEC, base: H.base, at: [H.x, H.z], r: H.r, spec: H.spec, walls: H.walls || [], name: H.name })),
      { label: 'angerja fronts', faces: () => true, shadows, debug: !!window.__skinDebug });
    layGround(world, group);
    solarPanels(world, group, 2393, [-1762, -13244], 16, [-0.55, 0.83]);       // the long building's south-west slope
    solarPanels(world, group, 2445, [-1747, -13227], 14, [-0.55, 0.83]);

    const K = streetKit(world, group, { shadows });
    const { box } = K;
    // thuja rows: by the garage pad, south of the greenhouses, along the brown house's garden
    const row = (a, b, n, hgt, r) => { for (let k = 0; k < n; k++) { const t = n > 1 ? k / (n - 1) : 0; K.thuja(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, hgt * (0.92 + 0.16 * ((k * 7) % 5) / 5), r, k); } };
    row([-1752.5, -13265], [-1744, -13270.5], 9, 2.6, 0.45);
    row([-1752, -13250.5], [-1741.5, -13256.5], 11, 2.2, 0.42);
    row([-1733.5, -13217], [-1733.5, -13205], 10, 3.0, 0.5);
    // clipped hedges on plot lines: the north cream house's garden, east of the cream house west of the street
    const hedge = (a, b, hgt, wd) => {
      const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.4));
      for (let k = 0; k <= n; k++) { const t = k / n; K.shrub(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, wd, KIT.shrub[k % 3], hgt / wd); }
    };
    hedge([-1825, -13271.5], [-1809.5, -13278.5], 1.4, 0.75);
    hedge([-1818.5, -13301], [-1803, -13289.5], 1.5, 0.8);
    hedge([-1797.5, -13216], [-1790.5, -13210.5], 1.2, 0.7);
    // greenhouses: polycarbonate tunnels on low frames
    const glasshouse = (x, z, w, l, yaw) => {
      const y = K.h(x, z);
      K.p.add(new THREE.BoxGeometry(l, 0.3, w), 0x8a7a72, x, y + 0.15, z, yaw);
      K.p.add(new THREE.CylinderGeometry(w / 2, w / 2, l, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), 0xe4eef2, x, y + 0.3 + 0.6, z, yaw);
      K.p.add(new THREE.BoxGeometry(l, 0.6, w), 0xdde8ee, x, y + 0.6, z, yaw);
    };
    glasshouse(-1747.5, -13265, 2.6, 4.2, 0.55);
    glasshouse(-1746, -13257, 2.4, 3.6, 0.55);
    glasshouse(-1822, -13236.5, 2.6, 5.5, 0.6);
    // the play house and swing frame in the brown house's garden
    {
      const [x, z] = [-1741, -13246], y = K.h(x, z), yaw = 0.55;
      box(x, z, 1.4, 1.3, 1.2, 0xe9d2a0, yaw, 0.35);
      for (const [ox, oz] of [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.5], [0.6, 0.5]]) K.p.add(new THREE.BoxGeometry(0.1, 0.35, 0.1), 0x8a6a50, x + ox, y + 0.18, z + oz, yaw);
      K.p.add(new THREE.ConeGeometry(1.15, 0.9, 4).rotateY(Math.PI / 4), 0xc8504a, x, y + 2.1, z, yaw);
      const [sx, sz] = [-1736.5, -13241.5], sy = K.h(sx, sz);
      for (const s of [-1, 1]) for (const t of [-0.6, 0.6]) K.p.add(new THREE.BoxGeometry(0.09, 2.2, 0.09), 0x7a5a44, sx + s * 1.3, sy + 1.1, sz + t, 0);
      K.p.add(new THREE.BoxGeometry(2.8, 0.1, 0.1), 0x7a5a44, sx, sy + 2.2, sz, 0);
      for (const s of [-0.5, 0.5]) K.p.add(new THREE.BoxGeometry(0.45, 0.05, 0.2), 0x3a8ad0, sx + s, sy + 0.5, sz, 0);
    }
    // wood stacks against the shed and the long building, compost bins, a washing line
    for (const [x, z, l, yaw] of [[-1771.2, -13236.6, 3.2, 0.6], [-1752.5, -13232.7, 4.0, 0.6], [-1815.5, -13212.5, 2.6, 0.55]]) {
      box(x, z, l, 1.3, 0.6, 0xb08868, yaw);
      for (let k = 0; k < 7; k++) K.p.add(new THREE.BoxGeometry(l, 0.05, 0.62), 0x8a6650, x, K.h(x, z) + 0.12 + k * 0.18, z, yaw);
      box(x, z, l + 0.3, 0.06, 0.9, 0x5a5c66, yaw, 1.35);
    }
    for (const [x, z] of [[-1823.5, -13218.5], [-1744.5, -13248.5]]) { box(x, z, 1.1, 0.9, 1.1, 0x4f6a48, 0.5); box(x + 1.3, z - 0.8, 1.1, 0.9, 1.1, 0x5a7650, 0.5); }
    {
      const a = [-1813, -13247.5], b = [-1806.5, -13243.5];
      for (const q of [a, b]) { box(q[0], q[1], 0.08, 1.9, 0.08, 0xd4d2da); box(q[0], q[1], 0.9, 0.06, 0.06, 0xd4d2da, 0.55, 1.85); }
      const ya = K.h(...a) + 1.8, yb = K.h(...b) + 1.8, l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (const o of [-0.3, 0, 0.3]) K.p.add(new THREE.BoxGeometry(l, 0.015, 0.015), 0xf2f0f6, (a[0] + b[0]) / 2 + o * 0.53, (ya + yb) / 2, (a[1] + b[1]) / 2 + o * 0.85, Math.atan2(-(b[1] - a[1]), b[0] - a[0]));
    }
    // the white house's wooden deck and the yellow house's porch steps
    box(-1756.5, -13281.2, 4.5, 0.3, 3.0, 0xc89a70, 0.0);
    box(-1774.6, -13274.0, 1.6, 0.35, 1.0, 0xb8b6be, 0.38);
    K.finish();
  }

  return {
    group,
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 420) return;
      if ([[ZONE.x0, ZONE.z0], [ZONE.x1, ZONE.z1], [ZONE.x0, ZONE.z1], [ZONE.x1, ZONE.z0]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
