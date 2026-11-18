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
// mown lawn: speckled green; one tile is 4 m
export function lawnTex() {
  return canvasTex(128, 128, (g, w) => {
    const r = rnd(7);
    g.fillStyle = '#96d878'; g.fillRect(0, 0, w, w);
    for (let k = 0; k < 2600; k++) {
      const v = r();
      g.fillStyle = v < 0.5 ? 'rgba(110,186,96,0.5)' : v < 0.85 ? 'rgba(176,228,128,0.5)' : 'rgba(124,196,108,0.6)';
      g.fillRect(r() * w, r() * w, 1 + r() * 2, 1 + r() * 3);
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

export function streetKit(world, group, { shadows = true, fenceColour = 0xd8d4e6 } = {}) {
  const p = new Parts(), leafy = leafyPlants(group, shadows);
  const KINDS = {       // ground covers: height above the terrain, texture tile (m), draw order
    lawn: { lift: 0.06, tile: 4, f: -3 }, paver: { lift: 0.075, tile: 1.6, f: -4 }, red: { lift: 0.075, tile: 1.6, f: -4 },
    dark: { lift: 0.075, tile: 1.6, f: -4 }, concrete: { lift: 0.075, tile: 3, f: -4 }, white: { lift: 0.09, tile: 1, f: -6 },
  };
  const ground = {};
  for (const k of Object.keys(KINDS)) ground[k] = { pos: [], uv: [] };
  const mesh = { pos: [], uv: [] };
  const h = (x, z) => world.heightAt(x, z);

  // ground cover between t0..t1 along the road and lat0..lat1 across it; not laid inside buildings unless forced
  function ribbon(F, t0, t1, lat0, lat1, kind = 'lawn', force = false) {
    const G = ground[kind], n = Math.max(1, Math.round(Math.abs(t1 - t0))), m = Math.max(1, Math.round(Math.abs(lat1 - lat0) / 1.25));
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const ta = t0 + (t1 - t0) * i / n, tb = t0 + (t1 - t0) * (i + 1) / n, la = lat0 + (lat1 - lat0) * j / m, lb = lat0 + (lat1 - lat0) * (j + 1) / m;
      const c = F.at((ta + tb) / 2, (la + lb) / 2);
      if (!force && world.sdfAt(c[0], c[1]) < 0.15) continue;
      const q = [F.at(ta, la), F.at(ta, lb), F.at(tb, la), F.at(tb, lb)];
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
      p.add(BOX(0.07, height + 0.1, 0.07), post, q[0], y + (height + 0.1) / 2, q[1], 0);
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
    p.add(BOX(s1 - s0, y1 - y0, thick), hex, x, W.y + (y0 + y1) / 2, z, W.yaw);
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
  const box = (x, z, w, height, d, hex, yaw = 0, y0 = 0) => p.add(BOX(w, height, d), hex, x, h(x, z) + y0 + height / 2, z, yaw);

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
    if (ground.paver.pos.length) decal('paver', { map: paverTex([208, 206, 218], 3) });
    if (ground.red.pos.length) decal('red', { map: paverTex([226, 164, 152], 5) });
    if (ground.dark.pos.length) decal('dark', { map: paverTex([150, 150, 166], 9) });
    decal('concrete', { color: 0xd9d6de });
    decal('white', { color: 0xf6f3fa });
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
    extra[a.length / 4] = { roof: e.roof, reach: e.reach || 16, hide: e.hide, shelter: e.shelter };       // hide: the house is modelled by hand instead; shelter: claims a carport
    a.push(e.base, Math.round((e.x - x0) * 10), Math.round((e.z - z0) * 10), e.wall);
  }
}
