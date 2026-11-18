// Emajõe tänav along the river, from the Vabadussild junction to Kroonuaia (Martin, 18 Nov, street view
// Aug 2024), in pastel versions of the real colours:
//  - the botanical garden wall on the left: a fieldstone base with a pale rendered top and a red brick
//    coping. It starts at the junction as the low stone wall round the corner from Lai, then a driveway
//    gate between two red brick posts, and after the gate the wall is higher.
//  - the bus stop on the right: a bay beside the lane with a yellow zigzag, the dashed line between bay
//    and lane, a glass shelter with a bench and an advert panel, and the bus stop sign.
//  - the lane markings: a solid centre line (double at the junction),
//    and the pavers on the river side.
// The map's own wall line along the garden (Emajõe and Kroonuaia) is drawn here in the same style instead
// of the plain grey map wall; it stays solid through the baked obstacle field.
import * as THREE from 'three';
import { createTrack } from './race.js';
import { Parts, BOX } from './landmarks.js';

const E = { i0: 941, i1: 1032 };                         // the Emajõe stretch of the lap
const BAY = { i0: 959, i1: 989, width: 2.9, taper: 6 };  // the bus bay: track indices, width beyond the road edge
const SHELTER = { i: 973, len: 4.6, depth: 1.55 };
const DASH = { i0: 944, i1: 991 };                       // dashed line along the right edge of the lane
const DOUBLE = [943, 953];                               // double centre line at the junction
const PAVE = { i0: 944, i1: 1004, width: 3.4 };          // river-side pavement
// the map's wall line round the garden (vectors.json walls, game x, z): Emajõe, the Kroonuaia corner, Kroonuaia
const GARDEN_WALL = [[1417.2, 2290.9], [1396.6, 2258.5], [1336.4, 2198.0], [1329.8, 2197.9], [1224.4, 2316.8]];
const GATE = { a: [1437.6, 2321.3], w: 4.4 };            // driveway gate: first post at the end of the low wall
const LOW = { stone: 0.95, cope: 0.13 };                 // the low wall round the corner
const HIGH = { stone: 1.15, render: 0.95, cope: 0.13, thick: 0.62 };

const COL = {
  render: 0xf3e6df, cope: 0xd98d7f, brick: 0xd99282, postCap: 0xb9bac8, iron: 0x3f4a55,
  white: 0xfaf8ff, yellow: 0xffd768, pave: 0xf0c9c0, kerb: 0xdcd8e4,
  frame: 0x464b59, roof: 0x575c6b, bench: 0xa98670, pole: 0x9a9eab,
};

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// rounded fieldstones in pastel ochres, pinks and greys on lilac-grey mortar; 512 px = 2 m by 1 m, tiles
function stoneTex() {
  const t = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#b9aab4'; g.fillRect(0, 0, w, h);
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const tones = ['#d8b7a0', '#c9a596', '#e2c9b0', '#bfa7a6', '#d4b9b8', '#c7b29a', '#e0bfb0', '#b8a2a0', '#d9c6bb', '#cba08e'];
    for (let row = 0; row < 7; row++) {
      let x = -r() * 40;
      const y0 = row * (h / 6.4) + 6;
      while (x < w + 30) {
        const sw = 34 + r() * 46, sh = 26 + r() * 16;
        const cx = x + sw / 2, cy = y0 + (r() - 0.5) * 10;
        g.fillStyle = tones[(r() * tones.length) | 0];
        g.beginPath();
        g.ellipse(cx, cy, sw / 2 - 3, sh / 2 - 2, (r() - 0.5) * 0.5, 0, Math.PI * 2);
        g.fill();
        for (const off of [-w, w]) {          // wrap round so the texture tiles
          g.beginPath(); g.ellipse(cx + off, cy, sw / 2 - 3, sh / 2 - 2, 0, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.beginPath(); g.ellipse(cx - sw * 0.12, cy - sh * 0.15, sw / 4, sh / 6, 0, 0, Math.PI * 2); g.fill();
        x += sw + 2 + r() * 6;
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// the blue bus stop sign: a white bus on blue
function busSignTex() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#6f9fe0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; g.fillRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#6f9fe0'; g.fillRect(12, 12, w - 24, h - 24);
    g.fillStyle = '#ffffff';
    g.fillRect(28, 40, 72, 40);                                // body
    g.fillStyle = '#6f9fe0';
    for (let k = 0; k < 3; k++) g.fillRect(34 + k * 22, 46, 16, 14);   // windows
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(44, 84, 8, 0, Math.PI * 2); g.arc(86, 84, 8, 0, Math.PI * 2); g.fill();
  });
}

// the advert in the shelter: a soft gradient poster with a few shapes, lit from inside
function advertTex() {
  return canvasTex(128, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#f6d7e6'); gr.addColorStop(0.55, '#c9d8f5'); gr.addColorStop(1, '#f7efd9');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8a6fc4';
    g.font = 'bold 22px Arial, sans-serif';
    g.fillText('TARTU', 12, 40);
    g.fillText('2026', 12, 64);
    g.fillStyle = '#e58fb0';
    g.beginPath(); g.arc(80, 140, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7fc3c0';
    g.fillRect(14, 196, 100, 10); g.fillRect(14, 214, 70, 10);
  });
}

// the two lamp posts by the bay (Martin, 18 Nov): moved off the bay and its kerb to behind the shelter
// and the two bins that stood in the bay go onto the pavement either side of the shelter
const LIGHT = 0, BIN = 4;
const LAMPS = [
  { kind: LIGHT, from: [1424.6, 2280.4], i: 970, lat: 10.3 }, { kind: LIGHT, from: [1432.9, 2287.2], i: 977, lat: 10.3 },
  { kind: BIN, from: [1425.4, 2281.6], i: 966, lat: 7.6 }, { kind: BIN, from: [1416.7, 2267.3], i: 981, lat: 7.6 },
];

// props layer: leave the map's lamps at the bay out ...
export function emajoeClear(data, out) {
  for (const [key, a] of Object.entries(data.sectors)) {
    for (let k = 0; k < a.length; k += data.stride) {
      if (LAMPS.some((l) => a[k] === l.kind && Math.hypot(a[k + 1] - l.from[0], a[k + 2] - l.from[1]) < 0.6)) out.add(`${key}:${k / data.stride}`);
    }
  }
}
// ... and stand them behind the shelter, the lamp still reaching over the road
export function emajoeProps() {
  const track = createTrack();
  return LAMPS.map(({ kind, i, lat }) => {
    const [tx, tz] = track.tan[i];
    const x = track.P[i][0] - tz * lat, z = track.P[i][1] + tx * lat;
    const b = (Math.atan2(tz, tx) * 180) / Math.PI;      // arm towards the road, as the map lamps had it
    return [kind, x, z, b];
  });
}

// before the road markings and map walls are built: no generated centre line on this stretch (it gets its
// own lines), and the garden wall is drawn by this file instead of as a plain grey map wall
export function emajoeVectors(vectors) {
  const track = createTrack();
  vectors.markSkip = (x, z) => {
    const n = track.nearest(x, z, 990);
    return n.i >= E.i0 && n.i <= E.i1 && n.d < track.HW[n.i] + 1;
  };
  const first = GARDEN_WALL[GARDEN_WALL.length - 1];
  vectors.walls = (vectors.walls || []).filter((w) => !w.some((p) => Math.hypot(p[0] - first[0], p[1] - first[1]) < 0.5));
}

export function createEmajoe(world, group) {
  const track = createTrack();
  const right = (i) => { const [tx, tz] = track.tan[i]; return [-tz, tx]; };
  const at = (i, lat) => { const [rx, rz] = right(i); return [track.P[i][0] + rx * lat, track.P[i][1] + rz * lat]; };
  const hw = (i) => track.HW[i];
  const bayW = (i) => BAY.width * smooth((i - BAY.i0) / BAY.taper) * smooth((BAY.i1 - i) / BAY.taper);

  const markMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide });
  const paveMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
  const solidMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const stoneMat = new THREE.MeshLambertMaterial({ map: stoneTex() });
  let built = false, lowBuilt = false;

  // ---- flat things on the ground: a quad strip along a polyline [[x, z, halfWidth], ...]
  function strip(pts, colour, lift, out) {
    const c = new THREE.Color(colour);
    const pos = [], col = [];
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az, aw] = pts[k], [bx, bz, bw] = pts[k + 1];
      const p0 = pts[Math.max(0, k - 1)], p3 = pts[Math.min(pts.length - 1, k + 2)];
      const side = (p, q, w0) => { const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1; return [-dz / l * w0, dx / l * w0]; };
      const [na, ma] = side(p0, pts[k + 1], aw), [nb, mb] = side(pts[k], p3, bw);
      const v = (x, z) => [x, world.heightAt(x, z) + lift, z];
      const A0 = v(ax - na, az - ma), A1 = v(ax + na, az + ma), B0 = v(bx - nb, bz - mb), B1 = v(bx + nb, bz + mb);
      pos.push(...A0, ...B0, ...A1, ...A1, ...B0, ...B1);
      for (let q = 0; q < 6; q++) col.push(c.r, c.g, c.b);
    }
    out.push([pos, col]);
  }
  function meshOf(list, mat) {
    let n = 0;
    for (const [p] of list) n += p.length;
    if (!n) return null;
    const pos = new Float32Array(n), col = new Float32Array(n);
    let o = 0;
    for (const [p, c] of list) { pos.set(p, o); col.set(c, o); o += p.length; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const nor = new Float32Array(n);
    for (let k = 1; k < n; k += 3) nor[k] = 1;                 // flat on the ground: lit from above whichever way it winds
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    return m;
  }
  // a line at a lateral offset over track indices, with dashes of `on` metres every `on + off` (off 0: solid)
  function line(i0, i1, latOf, width, colour, on, off, out) {
    const pts = [];
    for (let i = i0; i <= i1; i++) pts.push(at(i, latOf(i)));
    if (!off) { strip(pts.map(([x, z]) => [x, z, width / 2]), colour, 0.06, out); return; }
    const len = [0];
    for (let k = 1; k < pts.length; k++) len.push(len[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    const pointAt = (d) => {
      let k = 1;
      while (k < pts.length - 1 && len[k] < d) k++;
      const t = (d - len[k - 1]) / ((len[k] - len[k - 1]) || 1);
      return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t, width / 2];
    };
    for (let d = 0; d + on <= len[len.length - 1]; d += on + off) strip([pointAt(d), pointAt(d + on / 2), pointAt(d + on)], colour, 0.06, out);
  }

  // ---- walls with a fieldstone texture: boxes along a polyline following the ground at each end
  function wallParts(pts, layers, stone, flat) {
    let u = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      if (l < 0.05) continue;
      const ya = world.heightAt(a[0], a[1]), yb = world.heightAt(b[0], b[1]);
      let h0 = -0.4;
      for (const L of layers) {
        const h1 = L.top;
        const t = L.thick / 2, ext = L.ext || 0;
        const nx = -dz / l * t, nz = dx / l * t;
        const ex = dx / l * ext, ez = dz / l * ext;
        const A = [a[0] - ex, a[1] - ez], B = [b[0] + ex, b[1] + ez];
        const P = (p, s, y) => [p[0] + nx * s, y, p[1] + nz * s];
        const corners = [
          P(A, -1, ya + h0), P(B, -1, yb + h0), P(A, -1, ya + h1), P(B, -1, yb + h1),
          P(A, 1, ya + h0), P(B, 1, yb + h0), P(A, 1, ya + h1), P(B, 1, yb + h1),
        ];
        const faces = [[0, 1, 2, 3], [5, 4, 7, 6], [2, 3, 6, 7], [4, 0, 6, 2], [1, 5, 3, 7]];
        for (const f of faces) {
          const [q0, q1, q2, q3] = f.map((i) => corners[i]);
          if (L.tex) {
            const span = f === faces[3] || f === faces[4] ? L.thick : l;
            const u0 = f === faces[1] ? u + l : u, u1 = f === faces[1] ? u : u + l;
            const uu0 = span === l ? u0 / 2 : 0, uu1 = span === l ? u1 / 2 : span / 2;
            const v0 = h0 + 0.4, v1 = h1 + 0.4;
            stone.pos.push(...q0, ...q1, ...q2, ...q2, ...q1, ...q3);
            stone.uv.push(uu0, v0, uu1, v0, uu0, v1, uu0, v1, uu1, v0, uu1, v1);
          } else {
            const c = new THREE.Color(L.colour);
            flat.pos.push(...q0, ...q1, ...q2, ...q2, ...q1, ...q3);
            for (let q = 0; q < 6; q++) flat.col.push(c.r, c.g, c.b);
          }
        }
        h0 = h1;
      }
      u += l;
    }
  }
  function wallMeshes(stone, flat) {
    const out = [];
    if (stone.pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(stone.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(stone.uv, 2));
      g.computeVertexNormals();
      out.push(new THREE.Mesh(g, stoneMat));
    }
    if (flat.pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(flat.pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(flat.col, 3));
      g.computeVertexNormals();
      out.push(new THREE.Mesh(g, solidMat));
    }
    for (const m of out) { m.castShadow = m.receiveShadow = true; group.add(m); }
  }

  // the low wall round the corner from Lai (its line and collisions live in trackside.js)
  function drawLowWall(segs, thick) {
    if (lowBuilt) return;
    lowBuilt = true;
    const stone = { pos: [], uv: [] }, flat = { pos: [], col: [] };
    for (const [a, b] of segs) {
      wallParts([a, b], [
        { top: LOW.stone, thick, tex: true, ext: thick * 0.3 },
        { top: LOW.stone + LOW.cope, thick: thick + 0.1, colour: COL.cope, ext: thick * 0.3 + 0.05 },
      ], stone, flat);
    }
    wallMeshes(stone, flat);
  }

  function build() {
    built = true;
    const marks = [], pave = [];
    const edge = (i) => hw(i) - 0.18;

    // ---- markings
    line(E.i0 + 2, E.i1 - 2, () => 0, 0.13, COL.white, 0, 0, marks);                       // solid centre line
    line(DOUBLE[0], DOUBLE[1], () => -0.24, 0.12, COL.white, 0, 0, marks);                  // its twin at the junction
    line(DASH.i0, BAY.i0 + 3, edge, 0.13, COL.white, 1.2, 1.3, marks);                     // short dashes to the bay
    line(BAY.i0 + 3, BAY.i1 - 3, edge, 0.15, COL.white, 2.8, 2.2, marks);                  // along the bay
    line(BAY.i1 - 3, DASH.i1, edge, 0.13, COL.white, 1.2, 1.3, marks);
    // yellow zigzag in the bay: legs between the lane line and the kerb
    {
      const zig = [];
      const a0 = BAY.i0 + BAY.taper - 1, a1 = BAY.i1 - BAY.taper + 1, legs = 7;
      for (let k = 0; k <= legs; k++) {
        const i = Math.round(a0 + (a1 - a0) * k / legs);
        const lat = hw(i) + (k % 2 ? bayW(i) - 0.35 : 0.3);
        zig.push([...at(i, lat), 0.1]);
      }
      for (let k = 0; k < zig.length - 1; k++) strip([zig[k], zig[k + 1]], COL.yellow, 0.065, marks);
    }
    // ---- the river-side pavement, the kerb of the bay
    {
      const inner = [], outer = [];
      for (let i = PAVE.i0; i <= PAVE.i1; i++) {
        const fade = smooth((i - PAVE.i0) / 4) * smooth((PAVE.i1 - i) / 4);
        const a = hw(i) + bayW(i) + 0.25, b = a + PAVE.width * fade;
        inner.push([...at(i, (a + b) / 2), (b - a) / 2]);
        outer.push([...at(i, a), 0.14]);
      }
      strip(inner, COL.pave, 0.04, pave);
      strip(outer, COL.kerb, 0.05, pave);
    }
    for (const [list, mat] of [[marks, markMat], [pave, paveMat]]) { const m = meshOf(list, mat); if (m) group.add(m); }


    // ---- the glass shelter, its bench and advert, and the bus stop sign
    const p = new Parts(), solids = [];
    const glass = [];
    {
      const i = SHELTER.i, [ux, uz] = track.tan[i], [rx, rz] = right(i);
      const lat = hw(i) + BAY.width + 0.25 + 0.6 + SHELTER.depth / 2;
      const [cx, cz] = at(i, lat);
      const y = Math.max(world.heightAt(cx, cz), world.heightAt(...at(i, hw(i) + BAY.width + 0.3))) + 0.05;
      const yaw = Math.atan2(-uz, ux);
      const W = (lu, lr) => [cx + ux * lu + rx * lr, cz + uz * lu + rz * lr];
      const add = (geo, colour, lu, yy, lr) => { const [x, z] = W(lu, lr); p.add(geo, colour, x, y + yy, z, yaw); };
      const L = SHELTER.len, D = SHELTER.depth, H = 2.45;
      p.add(BOX(L + 0.5, 0.12, D + 0.4), COL.pave, cx, y - 0.04, cz, yaw);                    // slab
      for (const lu of [-L / 2, -L / 6, L / 6, L / 2]) {
        add(BOX(0.07, H, 0.07), COL.frame, lu, H / 2, D / 2);                                 // back posts
        if (Math.abs(lu) > L / 3) add(BOX(0.07, H, 0.07), COL.frame, lu, H / 2, -D / 2);      // front posts at the ends
      }
      add(BOX(L + 0.35, 0.1, D + 0.35), COL.roof, 0, H + 0.05, 0);                             // roof
      add(BOX(L + 0.35, 0.18, 0.06), COL.frame, 0, H - 0.04, -D / 2 - 0.17);                  // fascia
      add(BOX(L, 0.06, 0.06), COL.frame, 0, 0.12, D / 2);                                     // bottom rail
      // bench along the back
      add(BOX(L * 0.55, 0.05, 0.38), COL.bench, L * 0.08, 0.46, D / 2 - 0.3);
      add(BOX(L * 0.55, 0.32, 0.04), COL.bench, L * 0.08, 0.7, D / 2 - 0.12);
      for (const lu of [-L * 0.17, L * 0.33]) add(BOX(0.05, 0.46, 0.34), COL.frame, lu, 0.23, D / 2 - 0.3);
      // glass: the back and the downstream end; the advert panel closes the upstream end
      glass.push([W(0, D / 2), L, yaw, y, H]);
      glass.push([W(L / 2, 0), D, yaw + Math.PI / 2, y, H]);
      add(BOX(0.16, H - 0.25, D * 0.92), COL.frame, -L / 2, (H - 0.25) / 2 + 0.1, 0);
      for (const s of [-1, 1]) {
        const ad = new THREE.Mesh(new THREE.PlaneGeometry(D * 0.8, 1.75), new THREE.MeshBasicMaterial({ map: advertTex(), fog: true }));
        const [x, z] = W(-L / 2 + s * 0.085, 0);
        ad.position.set(x, y + 1.2, z);
        ad.rotation.y = yaw + (s < 0 ? -Math.PI / 2 : Math.PI / 2);
        group.add(ad);
      }
      solids.push({ x: cx, z: cz, yaw, hx: L / 2 + 0.1, hz: D / 2 + 0.1 });
    }
    {
      const i = BAY.i0 + 4, lat = hw(BAY.i0 + 4) + bayW(BAY.i0 + 4) + 0.55;
      const [x, z] = at(i, lat), y = world.heightAt(x, z);
      const [ux, uz] = track.tan[i], yaw = Math.atan2(-uz, ux);
      p.add(new THREE.CylinderGeometry(0.04, 0.04, 2.9, 8), COL.pole, x, y + 1.45, z);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshLambertMaterial({ map: busSignTex(), side: THREE.DoubleSide }));
      sign.position.set(x, y + 2.5, z);
      sign.rotation.y = yaw + Math.PI / 2;
      group.add(sign);
    }

    // ---- the garden wall: driveway gate, then the high wall along the map's wall line
    const stone = { pos: [], uv: [] }, flat = { pos: [], col: [] };
    const first = GARDEN_WALL[0];
    const gd = [first[0] - GATE.a[0], first[1] - GATE.a[1]], gl = Math.hypot(gd[0], gd[1]);
    const gu = [gd[0] / gl, gd[1] / gl];
    const postB = [GATE.a[0] + gu[0] * GATE.w, GATE.a[1] + gu[1] * GATE.w];
    const high = [
      { top: HIGH.stone, thick: HIGH.thick, tex: true },
      { top: HIGH.stone + HIGH.render, thick: HIGH.thick - 0.04, colour: COL.render },
      { top: HIGH.stone + HIGH.render + HIGH.cope, thick: HIGH.thick + 0.08, colour: COL.cope, ext: 0.04 },
    ];
    // the new piece from the gate to the map's line keeps clear of the garden building beside it
    const lead = [];
    const n = Math.ceil(Math.hypot(first[0] - postB[0], first[1] - postB[1]) / 2);
    for (let k = 0; k <= n; k++) lead.push([postB[0] + (first[0] - postB[0]) * k / n, postB[1] + (first[1] - postB[1]) * k / n]);
    for (let k = 0; k < lead.length - 1; k++) {
      const a = lead[k], b = lead[k + 1];
      const free = k === lead.length - 2 || world.sdfAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) > 0.6;
      if (!free) continue;
      wallParts([a, b], high, stone, flat);
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      solids.push({ x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, yaw: Math.atan2(-(b[1] - a[1]), b[0] - a[0]), hx: l / 2 + 0.05, hz: HIGH.thick / 2 });
    }
    wallParts(GARDEN_WALL, high, stone, flat);
    wallMeshes(stone, flat);
    // brick gate posts with grey caps, and the iron gate between them
    const gyaw = Math.atan2(-gu[1], gu[0]);
    for (const [x, z] of [GATE.a, postB]) {
      const y = world.heightAt(x, z);
      p.add(BOX(0.72, 2.75, 0.72), COL.brick, x, y + 1.375 - 0.2, z, gyaw);
      p.add(BOX(0.86, 0.14, 0.86), COL.postCap, x, y + 2.62, z, gyaw);
      p.add(new THREE.ConeGeometry(0.5, 0.32, 4).rotateY(Math.PI / 4), COL.postCap, x, y + 2.85, z, gyaw);
      solids.push({ x, z, yaw: gyaw, hx: 0.38, hz: 0.38 });
    }
    {
      const mx = (GATE.a[0] + postB[0]) / 2, mz = (GATE.a[1] + postB[1]) / 2, y = world.heightAt(mx, mz);
      const span = GATE.w - 0.72, bars = 16;
      for (const h of [0.15, 1.05, 1.75]) p.add(BOX(span, 0.06, 0.05), COL.iron, mx, y + h, mz, gyaw);
      for (let k = 0; k <= bars; k++) {
        const o = -span / 2 + span * k / bars;
        p.add(BOX(0.035, 1.95, 0.035), COL.iron, mx + gu[0] * o, y + 0.97, mz + gu[1] * o, gyaw);
      }
      p.add(BOX(0.05, 1.8, 0.05), COL.iron, mx, y + 0.95, mz, gyaw);                          // where the leaves meet
      solids.push({ x: mx, z: mz, yaw: gyaw, hx: span / 2, hz: 0.12 });
    }

    const m = p.mesh(solidMat);
    if (m) { m.castShadow = m.receiveShadow = true; group.add(m); }
    const glassMat = new THREE.MeshLambertMaterial({ color: 0xcfe6f2, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
    for (const [[x, z], w, yaw, y, H] of glass) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(w, H - 0.25), glassMat);
      g.position.set(x, y + 0.15 + (H - 0.25) / 2, z);
      g.rotation.y = yaw;
      group.add(g);
    }
    world.addSolids(solids);
  }

  const ref = track.P[SHELTER.i];
  return {
    drawLowWall,
    update(x, z) {
      if (built || Math.hypot(ref[0] - x, ref[1] - z) > 700) return;
      const pts = [...GARDEN_WALL, GATE.a, track.P[E.i0], track.P[E.i1], track.P[SHELTER.i]];
      if (pts.every(([px, pz]) => world.ready(px, pz))) build();
    },
  };
}
