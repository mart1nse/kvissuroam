// Shared pieces for hand-detailed residential streets (Pootsmani, Kvissentali tee): lawn and paving laid on
// the ground along a road, mesh panel fences, house fronts skinned with windows, thujas, shrubs and the
// small street furniture. Everything is measured in a "road frame": a distance along the street's centre
// line and a distance sideways from it.
import * as THREE from 'three';
import { Parts, BOX } from '../race/landmarks.js';
import { realTreeKit } from './scenery.js';

// A road frame over a centre line that runs steadily along one map axis (0: x, 1: z). at(t, lat) gives the
// point at map coordinate t along that axis, `lat` metres sideways (+: to the left of the direction of travel).
export function roadFrame(pts, axis = 1) {
  const seg = (t) => {
    let i = 0;
    while (i < pts.length - 2 && pts[i + 1][axis] < t) i++;
    return i;
  };
  return {
    pts, axis,
    at(t, lat = 0) {
      const i = seg(t), a = pts[i], b = pts[i + 1], k = (t - a[axis]) / (b[axis] - a[axis]);
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      return [a[0] + dx * k + (dz / l) * lat, a[1] + dz * k - (dx / l) * lat];
    },
    dir(t) {
      const i = seg(t), a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    },
  };
}

// a wall from a to b with the street on its right-hand side
export function wallOf(a, b, top) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
  return { a, top, len, ux, uz, nx: -uz, nz: ux, yaw: Math.atan2(-uz, ux), at: (s, n) => [a[0] + ux * s - uz * n, a[1] + uz * s + ux * n] };
}

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
function rnd(seed) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// concrete block paving, 20 x 10 cm stones laid in a running bond; one tile is 1.6 m
export function paverTex(base, seed) {
  return canvasTex(256, 256, (g, w) => {
    const r = rnd(seed), [R, G, B] = base;
    g.fillStyle = `rgb(${R * 0.8 | 0},${G * 0.8 | 0},${B * 0.82 | 0})`; g.fillRect(0, 0, w, w);
    for (let row = 0; row < 16; row++) for (let k = -1; k < 8; k++) {
      const v = 0.93 + r() * 0.14;
      g.fillStyle = `rgb(${Math.min(255, R * v) | 0},${Math.min(255, G * v) | 0},${Math.min(255, B * v) | 0})`;
      g.fillRect(k * 32 + (row % 2) * 16 + 1, row * 16 + 1, 30, 14);
    }
  });
}
// THE grass for every patch of grass laid by hand (Martin, 19 Nov: the painted strips were too contrasty
// and sharp green). It is the verge of the rebuilt Lai junction (PRs #193, #199): clumps, blades, clover
// and a few flowers, muted to about half saturation towards the olive-brown orthophoto grass round it so
// it sits in the map's own grass. One tile is GRASS.tile metres. Flat-coloured grass (extruded islands,
// vertex-coloured banks) uses GRASS.hex, about the average colour of the texture.
export const GRASS = { tile: 10, hex: 0x7e9068 };
let grassCanvas = null;
const grassCache = new Map();
// mute a green toward the orthophoto grass, as the texture is muted (half saturation, warmer)
export function muteGreen(r, g, b) {
  const l = 0.3 * r + 0.55 * g + 0.15 * b;
  return [l + (r - l) * 0.5 + 8, l + (g - l) * 0.5 - 4, l + (b - l) * 0.5 - 6].map((v) => Math.max(0, Math.min(255, Math.round(v))));
}
function drawGrass() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d'), w = 512;
  let seed = 23;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#6ea85a'; g.fillRect(0, 0, w, w);
  const blob = (x, y, rad, col) => {
    for (const ox of [-w, 0, w]) for (const oy of [-w, 0, w]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    }
  };
  const clumps = ['rgba(78,138,66,0.55)', 'rgba(92,152,74,0.5)', 'rgba(140,186,96,0.45)', 'rgba(168,184,98,0.35)', 'rgba(70,124,72,0.5)'];
  for (let k = 0; k < 70; k++) blob(r() * w, r() * w, 20 + r() * 70, clumps[(r() * clumps.length) | 0]);
  const blades = ['rgba(64,118,58,0.7)', 'rgba(98,158,80,0.6)', 'rgba(132,182,100,0.55)', 'rgba(84,140,70,0.65)', 'rgba(158,188,108,0.45)'];
  for (let k = 0; k < 14000; k++) {
    const x = r() * w, y = r() * w, l = 2 + r() * 5, a = -Math.PI / 2 + (r() - 0.5) * 1.2;
    g.strokeStyle = blades[(r() * blades.length) | 0]; g.lineWidth = 1 + r() * 0.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let k = 0; k < 160; k++) {                       // clover patches: darker round leaves
    const x = r() * w, y = r() * w;
    g.fillStyle = 'rgba(60,112,62,0.6)';
    for (let q = 0; q < 6; q++) { g.beginPath(); g.arc(x + (r() - 0.5) * 8, y + (r() - 0.5) * 8, 1.6 + r(), 0, Math.PI * 2); g.fill(); }
  }
  const flowers = ['rgba(255,255,250,0.9)', 'rgba(255,236,150,0.9)', 'rgba(222,196,240,0.85)'];
  for (let k = 0; k < 110; k++) { g.fillStyle = flowers[(r() * 3) | 0]; g.beginPath(); g.arc(r() * w, r() * w, 0.9 + r() * 0.9, 0, Math.PI * 2); g.fill(); }
  const img = g.getImageData(0, 0, w, w), d = img.data;
  for (let i = 0; i < d.length; i += 4) [d[i], d[i + 1], d[i + 2]] = muteGreen(d[i], d[i + 1], d[i + 2]);
  g.putImageData(img, 0, 0);
  return c;
}
// the grass texture for geometry whose UVs count in units of `uvMetres` (one canvas, shared)
export function grassTex(uvMetres = GRASS.tile) {
  if (grassCache.has(uvMetres)) return grassCache.get(uvMetres);
  grassCanvas ??= drawGrass();
  const t = new THREE.CanvasTexture(grassCanvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.repeat.set(uvMetres / GRASS.tile, uvMetres / GRASS.tile);
  grassCache.set(uvMetres, t);
  return t;
}
// lawns use the same grass (UVs in 4 m tiles)
export function lawnTex() { return grassTex(4); }
// concrete grid pavers with grass in the holes, 40 cm blocks; one tile is 1.2 m
export function turfTex() {
  const rgb = (c, a = 1) => `rgba(${muteGreen(...c).join(',')},${a})`;
  const HOLE = rgb([134, 196, 108]), BLADE = [rgb([160, 214, 120], 0.8), rgb([96, 160, 84], 0.8)];
  return canvasTex(192, 192, (g, w) => {
    const r = rnd(11);
    g.fillStyle = '#c9c6d2'; g.fillRect(0, 0, w, w);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (const [u, v] of [[8, 8], [36, 8], [8, 36], [36, 36]]) {
      g.fillStyle = HOLE; g.fillRect(a * 64 + u, b * 64 + v, 20, 20);
      for (let k = 0; k < 14; k++) { g.fillStyle = r() < 0.5 ? BLADE[0] : BLADE[1]; g.fillRect(a * 64 + u + r() * 18, b * 64 + v + r() * 18, 2, 3); }
    }
  });
}
// welded mesh panel: upright wires close together, a few cross wires; one tile is 0.5 m wide and the panel high
function meshTex() {
  return canvasTex(64, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(240,240,244,0.95)';
    for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 2, h);
    for (const y of [2, 14, 26, 58, 70, 104, 116, 124]) g.fillRect(0, y, w, 3);
  });
}

// Leafy plants in the foliage of the realistic trees, for hand-placed hedges, bushes and thujas: collect
// them with bush()/thuja(), then finish() adds one instanced mesh to the group. `ok` is false when the
// simple trees are on (?trees=old); the caller then draws its plain shapes instead.
// The bush it is made of is 2.7 m across and 2 m high.
export function leafyPlants(group, shadows = true) {
  const kit = realTreeKit(), proto = kit && kit.bush && kit.bush();
  const list = [];
  // a bush `width` across and `height` high with its foot at (x, y, z); tint: [r, g, b] multipliers
  const bush = (x, y, z, width, height, yaw = 0, tint = [1, 1, 1], depth = width) => list.push([x, y, z, width / 2.7, height / 2.0, depth / 2.7, yaw, tint]);
  // a thuja: a dense dark column, narrower at the top
  const thuja = (x, y, z, height, r, c = 0, base = [0.5, 0.74, 0.56]) => {
    const d = 0.86 + (Math.abs(c) % 3) * 0.07, t = base.map((v) => v * d);
    bush(x, y - 0.05, z, r * 2.3, height * 0.7, c * 1.3, t);
    bush(x, y + height * 0.28, z, r * 1.6, height * 0.6, c * 1.3 + 2, t);
    bush(x, y + height * 0.58, z, r * 0.9, height * 0.46, c * 1.3 + 4, t);
  };
  function finish() {
    if (!proto || !list.length) return null;
    const im = new THREE.InstancedMesh(proto.geometry, proto.material, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    list.forEach((b, k) => {
      m.compose(new THREE.Vector3(b[0], b[1], b[2]), q.setFromAxisAngle(up, b[6]), new THREE.Vector3(b[3], b[4], b[5]));
      im.setMatrixAt(k, m);
      im.setColorAt(k, col.setRGB(b[7][0], b[7][1], b[7][2]));
    });
    im.castShadow = shadows; im.receiveShadow = true;
    im.frustumCulled = false;
    group.add(im);
    return im;
  }
  return { ok: !!proto, bush, thuja, finish };
}

export const KIT = {
  frame: 0x4a4b57, glass: 0xa8cfd0, darkGlass: 0x6f8f9c, white: 0xf3f1ee, post: 0xc4c7cf,
  thuja: [0x3f7d55, 0x4a8a5c, 0x376f4e], shrub: [0x5fa565, 0x76b86c, 0x4f9560], bloom: 0xeef3e6,
};

export function streetKit(world, group, { shadows = true, fenceColour = 0xd8d4e6, asphalt: ASPHALT = 0xaba7ba } = {}) {
  const p = new Parts(), leafy = leafyPlants(group, shadows);
  const KINDS = {       // ground covers: height above the terrain, texture tile (m), draw order
    lawn: { lift: 0.06, tile: 4, f: -3 }, paver: { lift: 0.075, tile: 1.6, f: -4 }, red: { lift: 0.075, tile: 1.6, f: -4 },
    dark: { lift: 0.075, tile: 1.6, f: -4 }, concrete: { lift: 0.075, tile: 3, f: -4 }, white: { lift: 0.09, tile: 1, f: -6 },
    asphalt: { lift: 0.05, tile: 3, f: -3 }, kerb: { lift: 0.06, tile: 1, f: -5 },       // a tarmac pavement and its kerb stones
    verge: { lift: 0.06, tile: 4, f: -3 }, turf: { lift: 0.07, tile: 1.2, f: -4 },     // turf: grass growing through concrete grid pavers                                               // rougher, deeper green grass beside a road
  };
  const ground = {};
  for (const k of Object.keys(KINDS)) ground[k] = { pos: [], uv: [] };
  const mesh = { pos: [], uv: [] };
  const h = (x, z) => world.heightAt(x, z);

  // ground cover between t0..t1 along the road and lat0..lat1 across it; not laid inside buildings unless forced
  // (lat0 and lat1 may be functions of t, for a strip whose edges move smoothly along the road)
  function ribbon(F, t0, t1, lat0, lat1, kind = 'lawn', force = false) {
    const A = typeof lat0 === 'function' ? lat0 : () => lat0, B = typeof lat1 === 'function' ? lat1 : () => lat1;
    const G = ground[kind], n = Math.max(1, Math.round(Math.abs(t1 - t0))), m = Math.max(1, Math.round(Math.abs(B((t0 + t1) / 2) - A((t0 + t1) / 2)) / 1.25));
    const L = (t, j) => A(t) + (B(t) - A(t)) * j / m;
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const ta = t0 + (t1 - t0) * i / n, tb = t0 + (t1 - t0) * (i + 1) / n, tm = (ta + tb) / 2;
      const c = F.at(tm, (L(tm, j) + L(tm, j + 1)) / 2);
      if (!force && world.sdfAt(c[0], c[1]) < 0.15) continue;
      const q = [F.at(ta, L(ta, j)), F.at(ta, L(ta, j + 1)), F.at(tb, L(tb, j)), F.at(tb, L(tb, j + 1))];
      // wound so that the top is the front face, whichever way the frame runs
      const up = (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]) - (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) > 0;
      for (const k of up ? [0, 1, 2, 2, 1, 3] : [0, 2, 1, 1, 2, 3]) {
        G.pos.push(q[k][0], h(q[k][0], q[k][1]) + KINDS[kind].lift, q[k][1]);
        G.uv.push(q[k][0] / KINDS[kind].tile, q[k][1] / KINDS[kind].tile);
      }
    }
  }

  // welded mesh panel fence along the road at `lat`, posts every 2.5 m
  function fence(F, t0, t1, lat, height = 1.25, post = KIT.post) {
    const n = Math.max(1, Math.round(Math.abs(t1 - t0) / 2.5));
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const q = F.at(t0 + (t1 - t0) * i / n, lat), y = h(q[0], q[1]);
      p.box(0.07, height + 0.1, 0.07, post, q[0], y + (height + 0.1) / 2, q[1], 0);
      if (prev) panel(prev, q, height);
      prev = q;
    }
  }
  function panel(a, b, height = 1.25) {
    const ya = h(a[0], a[1]) + 0.06, yb = h(b[0], b[1]) + 0.06, u = Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5;
    mesh.pos.push(a[0], ya, a[1], b[0], yb, b[1], a[0], ya + height, a[1], a[0], ya + height, a[1], b[0], yb, b[1], b[0], yb + height, b[1]);
    mesh.uv.push(0, 0, u, 0, 0, 1, 0, 1, u, 0, u, 1);
  }

  // ---- house fronts: flat boxes standing against a wall (s along it, y above the house's ground)
  const slab = (W, s0, s1, y0, y1, off, thick, hex) => {
    const [x, z] = W.at((s0 + s1) / 2, off + thick / 2);
    p.box(s1 - s0, y1 - y0, thick, hex, x, W.y + (y0 + y1) / 2, z, W.yaw);
  };
  const face = (W, hex, y0 = -1, y1 = W.top - W.y + 0.03) => slab(W, -0.04, W.len + 0.04, y0, y1, 0.03, 0.09, hex);
  // a window: frame, glass, `bars` uprights and `rails` cross bars
  const win = (W, s0, s1, y0, y1, { bars = 0, rails = 0, frame = KIT.frame, glass = KIT.glass, fw = 0.08, off = 0.12 } = {}) => {
    slab(W, s0 - fw, s1 + fw, y0 - fw, y1 + fw, off, 0.05, frame);
    slab(W, s0, s1, y0, y1, off + 0.03, 0.05, glass);
    for (let k = 1; k <= bars; k++) { const s = s0 + (s1 - s0) * k / (bars + 1); slab(W, s - 0.035, s + 0.035, y0, y1, off + 0.06, 0.04, frame); }
    for (let k = 1; k <= rails; k++) { const y = y0 + (y1 - y0) * k / (rails + 1); slab(W, s0, s1, y - 0.035, y + 0.035, off + 0.06, 0.04, frame); }
  };

  // ---- plants
  const thuja = (x, z, height, r, c = 0) => {
    const y = h(x, z);
    if (leafy.ok) { leafy.thuja(x, y, z, height, r, c); return; }
    p.add(new THREE.CylinderGeometry(r * 0.85, r, height * 0.45, 8), KIT.thuja[Math.abs(c) % 3], x, y + height * 0.225, z, c);
    p.add(new THREE.ConeGeometry(r * 0.85, height * 0.55, 8), KIT.thuja[Math.abs(c) % 3], x, y + height * 0.725, z, c);
  };
  const shrub = (x, z, r, hex, squash = 0.8) => {
    const g = KIT.shrub.indexOf(hex);
    if (leafy.ok && g >= 0) { leafy.bush(x, h(x, z) - 0.05, z, r * 2.5, r * squash * 1.9, x + z, [0.88 + g * 0.08, 0.92 + g * 0.06, 0.88 + g * 0.06]); return; }
    p.add(new THREE.IcosahedronGeometry(r, 1).scale(1.1, squash, 1), hex, x, h(x, z) + r * squash * 0.75, z, x + z);
  };
  // a box standing on the ground
  const box = (x, z, w, height, d, hex, yaw = 0, y0 = 0) => p.box(w, height, d, hex, x, h(x, z) + y0 + height / 2, z, yaw);

  function finish() {
    const flat = (G, mat) => {
      if (!G.pos.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(G.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(G.uv, 2));
      const nor = new Float32Array(G.pos.length);
      for (let k = 1; k < nor.length; k += 3) nor[k] = 1;
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      group.add(m);
    };
    const decal = (kind, opts) => { const f = KINDS[kind].f; flat(ground[kind], new THREE.MeshLambertMaterial({ ...opts, polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f, side: THREE.DoubleSide })); };
    if (ground.lawn.pos.length) decal('lawn', { map: lawnTex() });
    if (ground.verge.pos.length) decal('verge', { map: lawnTex() });     // the same grass as lawn now (was tinted deeper green)
    if (ground.paver.pos.length) decal('paver', { map: paverTex([208, 206, 218], 3) });
    if (ground.red.pos.length) decal('red', { map: paverTex([226, 164, 152], 5) });
    if (ground.dark.pos.length) decal('dark', { map: paverTex([150, 150, 166], 9) });
    if (ground.turf.pos.length) decal('turf', { map: turfTex() });
    decal('concrete', { color: 0xd9d6de });
    decal('white', { color: 0xf6f3fa });
    decal('asphalt', { color: ASPHALT });
    decal('kerb', { color: 0xd6d3dc });
    if (mesh.pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(mesh.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(mesh.uv, 2));
      g.computeVertexNormals();
      group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: meshTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide, color: fenceColour })));
    }
    leafy.finish();
    const m = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    if (m) { m.castShadow = shadows; m.receiveShadow = true; group.add(m); }
  }

  return { p, h, ribbon, fence, panel, slab, face, win, thuja, shrub, box, finish, leafy };
}

// Extra building colours for houses the colour survey did not reach: entries { base (cm), x, z, wall, roof }
// in game coordinates. They only claim triangles within `reach` metres of their centre.
export function addHouseColours(walls, sectorKey, x0, z0, list) {
  if (!walls || !walls.sectors) return;
  const a = (walls.sectors[sectorKey] ||= []);
  const extra = ((walls.extra ||= {})[sectorKey] ||= {});
  for (const e of list) {
    extra[a.length / 4] = { roof: e.roof, reach: e.reach || 16, hide: e.hide, shelter: e.shelter, plain: e.plain, cut: e.cut };       // hide: the house is modelled by hand instead; shelter: claims a carport; plain: walls without the generated windows; cut(x, z, top): only the triangles it picks are hidden
    a.push(e.base, Math.round((e.x - x0) * 10), Math.round((e.z - z0) * 10), e.wall);
  }
}

// Colours for houses that may already be in the colour survey: an entry the survey has (same LOD2 base,
// within 30 m) gets these colours in place, since the survey's own entry would win; the rest are added.
export function setHouseColours(walls, sectorKey, x0, z0, list) {
  if (!walls || !walls.sectors) return;
  const a = walls.sectors[sectorKey] || [], extra = ((walls.extra ||= {})[sectorKey] ||= {}), fresh = [];
  for (const e of list) {
    let k = -1, best = 30;                                             // the nearest one, where two houses share a base
    for (let i = 0; i < a.length; i += 4) { const d = Math.hypot(a[i + 1] / 10 + x0 - e.x, a[i + 2] / 10 + z0 - e.z); if (a[i] === e.base && d < best) { best = d; k = i; } }
    if (k < 0) { fresh.push(e); continue; }
    if (e.wall !== undefined) a[k + 3] = e.wall;
    extra[k / 4] = { roof: e.roof, reach: e.reach || 16, hide: e.hide };
  }
  addHouseColours(walls, sectorKey, x0, z0, fresh);
}
