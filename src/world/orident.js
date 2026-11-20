// The Orident house (Jakobi 40) on the inside corner where the lap turns from Baeri into Jakobi (Martin,
// 18 Nov, from his street views of Aug 2024), built by hand in place of the LOD2 model, in pastel colours:
//   - four storeys; the corner towards the junction is a curved curtain wall of sharp sawtooth glass bays, tall panes
//     between dark mullions, with dark floor bands and a heavy dark cornice
//   - red brick on both sides of the glass: a short wing along Jakobi with a glass shop front below,
//     and the face towards Baeri with stacked balconies behind black railings
//   - a one-storey brick annex along Baeri with the clinic's glass shop front (its sign comes from the map's shop list)
//   - a flat dark roof with a brick parapet, vent boxes and two chimneys
import * as THREE from 'three';
import { Parts, BOX } from '../race/landmarks.js';
import { setHouseColours } from './streetkit.js';
import { glassShards } from './shards.js';
import { stats } from '../stats.js';

const BASE = 10.58, H = 13.7;                       // ground (world y) and roof above it
const FLOORS = [0, 3.5, 6.9, 10.3];
// the curtain wall's line round the corner, from the Baeri side to the Jakobi side (from the LOD2 facets)
const CURVE = [[947.4, 2627.0], [949.3, 2624.0], [951.6, 2621.9], [954.0, 2620.3], [957.0, 2619.3], [960.5, 2618.95], [963.5, 2619.1], [966.85, 2619.65]];
// the rest of the outline, clockwise: the Jakobi wing, the back and the face towards Baeri
const REST = [[973.2, 2621.65], [969.4, 2630.55], [963.15, 2627.85], [959.85, 2629.15], [956.7, 2633.9], [947.9, 2628.1]];
const ANNEX = [[947.05, 2627.5], [947.9, 2628.1], [956.7, 2633.9], [955.1, 2636.35]];
const ANNEX_H = 3.6;
const CENTRE = [960, 2626];
const COL = {
  brick: 0xc9806f, brickDark: 0xb06d61, cope: 0xc2b8c0, frame: 0x3d404c, mullion: 0x353845,
  glass: [0x5f8592, 0x6a909c, 0x56798a, 0x7499a3], shopGlass: 0x8fb5b4, win: 0x6f879a,
  roof: 0x666b7c, vent: 0x8a8e9c, rail: 0x26272d, slab: 0xd9d4dc, sign: 0x2f3240,
  blind: 0xc4e0d6, blindBar: 0x4a4f5c, blindBox: 0x8d919e, bayFloor: 0x6d6a72, room: 0x2b2d37,
};

export function oridentWalls(walls) {
  setHouseColours(walls, '2_5', 480, 2400, [{ base: 1058, x: 958.4, z: 2624.9, wall: COL.brick, hide: true, reach: 20 }]);
}

export function createOrident(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function build() {
    built = true;
    const p = new Parts();
    const y0 = BASE;
    const curve = new THREE.CatmullRomCurve3(CURVE.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    // the glass corner is a row of sharp bays stepping out like a sawtooth (Martin, 19 Nov): each bay has
    // two glass faces meeting at a point TOOTH metres out from the curve
    const NSEG = 12, TOOTH = 1.0;
    const C = curve.getSpacedPoints(NSEG).map((v) => [v.x, v.z]);
    const G = [C[0]];
    for (let k = 0; k < NSEG; k++) {
      const a = C[k], b = C[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      G.push([(a[0] + b[0]) / 2 + (dz / l) * TOOTH, (a[1] + b[1]) / 2 - (dx / l) * TOOTH], b);
    }
    const outlineMain = [...G, ...REST];
    const prism = (pts, a, b, hex) => {
      const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: b - a, bevelEnabled: false, curveSegments: 1 });
      g.rotateX(-Math.PI / 2);
      p.add(g, hex, 0, y0 + a, 0);
    };
    // (the ground floor stands back on the curve: the glass bays in front of it are hollow, with roller blinds
    // inside and a dark room behind; the floors above fill the bays)
    prism([...C, ...REST], -1.2, FLOORS[1] - 0.05, COL.brick);
    prism(outlineMain, FLOORS[1] - 0.05, H, COL.brick);
    prism(ANNEX, -1.2, ANNEX_H, COL.brick);
    // roofs
    const flat = (pts, y, hex) => p.add(new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)))).rotateX(-Math.PI / 2), hex, 0, y0 + y + 0.02, 0);
    flat(outlineMain, H, COL.roof);
    flat(ANNEX, ANNEX_H, COL.roof);

    // a face along a → b; the street is on the left of a → b (outline is clockwise seen from above)
    const face = (a, b) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), d = [dx / len, dz / len], n = [d[1], -d[0]];
      return { len, d, n, yaw: Math.atan2(-d[1], d[0]), at: (s, o) => [a[0] + d[0] * s + n[0] * o, a[1] + d[1] * s + n[1] * o] };
    };
    const slab = (F, s0, s1, a, b, off, th, hex) => { const [x, z] = F.at((s0 + s1) / 2, off + th / 2); p.add(BOX(s1 - s0, b - a, th), hex, x, y0 + (a + b) / 2, z, F.yaw); };
    const win = (F, s0, s1, a, b) => {
      slab(F, s0 - 0.08, s1 + 0.08, a - 0.08, b + 0.08, 0, 0.05, COL.frame);
      slab(F, s0, s1, a, b, 0.03, 0.04, COL.win);
      slab(F, (s0 + s1) / 2 - 0.03, (s0 + s1) / 2 + 0.03, a, b, 0.05, 0.04, COL.frame);
      slab(F, s0 - 0.1, s1 + 0.1, a - 0.14, a - 0.06, 0, 0.12, COL.brickDark);
    };
    const shop = (F, s0, s1, top = 3.0) => {
      slab(F, s0, s1, 0.05, top, 0, 0.06, COL.frame);
      const n = Math.max(1, Math.round((s1 - s0) / 1.6));
      for (let k = 0; k < n; k++) {
        const a = s0 + (s1 - s0) * k / n + 0.06, b = s0 + (s1 - s0) * (k + 1) / n - 0.06;
        slab(F, a, b, 0.15, top - 0.1, 0.04, 0.04, COL.shopGlass);
      }
    };
    const balcony = (F, s0, s1, y) => {
      slab(F, s0, s1, y - 0.05, y + 0.12, 0, 1.2, COL.slab);
      const [ax, az] = F.at(s0 + 0.04, 1.15), [bx, bz] = F.at(s1 - 0.04, 1.15), len = s1 - s0 - 0.08;
      for (const yy of [1.1, 0.55, 0.25]) p.add(BOX(len, 0.04, 0.04), COL.rail, (ax + bx) / 2, y0 + y + yy, (az + bz) / 2, F.yaw);
      for (let s = s0 + 0.05; s < s1; s += 0.6) { const [x, z] = F.at(s, 1.15); p.add(BOX(0.04, 1.0, 0.04), COL.rail, x, y0 + y + 0.6, z, F.yaw); }
      for (const s of [s0 + 0.04, s1 - 0.04]) for (const yy of [1.1, 0.55]) { const [x, z] = F.at(s, 0.6); p.add(BOX(0.04, 0.04, 1.15), COL.rail, x, y0 + y + yy, z, F.yaw); }
      slab(F, s0 + 0.3, s0 + 1.2, y + 0.12, y + 2.4, 0.02, 0.05, COL.frame);
      slab(F, s0 + 0.38, s0 + 1.12, y + 0.2, y + 2.32, 0.05, 0.03, COL.win);
      win(F, s0 + 1.6, s1 - 0.3, y + 0.9, y + 2.4);
    };
    const parapet = (F, hex) => { slab(F, -0.05, F.len + 0.05, H - 0.02, H + 0.55, -0.25, 0.27, hex); slab(F, -0.08, F.len + 0.08, H + 0.55, H + 0.65, -0.29, 0.33, COL.cope); };
    const band = (F, y, hex = COL.brickDark) => slab(F, -0.02, F.len + 0.02, y - 0.12, y + 0.06, 0, 0.06, hex);

    // ---- the curved curtain wall
    {
      for (let k = 0; k < G.length - 1; k++) {
        const F = face(G[k], G[k + 1]);
        for (let f = 1; f < 4; f++) {            // (the ground floor's glass, blinds and frame: see breakable below)
          const a = FLOORS[f] + 0.35, b = f < 3 ? FLOORS[f + 1] - 0.05 : H - 0.65;
          slab(F, 0.04, F.len - 0.04, a, b, 0.02, 0.04, COL.glass[(k * 3 + f * 5) % 4]);
          slab(F, -0.02, F.len + 0.02, FLOORS[f] - 0.05, FLOORS[f] + 0.35, 0, 0.12, COL.mullion);   // floor band
          slab(F, 0, F.len, a + (b - a) * 0.5 - 0.02, a + (b - a) * 0.5 + 0.02, 0.05, 0.05, COL.mullion);   // transom
        }
        slab(F, -0.03, F.len + 0.03, H - 0.65, H + 0.65, 0, 0.34, COL.mullion);                          // the heavy cornice
        const [x, z] = F.at(0, 0.1), m0 = FLOORS[1] + 0.3;
        p.add(BOX(0.12, H + 0.35 - m0, 0.2), COL.mullion, x, y0 + (m0 + H + 0.35) / 2, z, F.yaw);        // mullion, above the ground floor
        // inside the bay: the roller blind's box under the ceiling, the ceiling and the floor
        slab(F, 0.08, F.len - 0.08, FLOORS[1] - 0.2, FLOORS[1] - 0.06, -0.24, 0.12, COL.blindBox);
      }
      for (let k = 0; k < NSEG; k++) {
        const a = C[k], t = G[2 * k + 1], b = C[k + 1];
        const fy = floorAt(a, t, b);
        tri(p, [a, t, b], fy, true, COL.bayFloor);
        tri(p, [a, t, b], y0 + FLOORS[1] - 0.07, false, COL.slab);
        const B = face(a, b);                                                                   // the room's dark back wall
        slab(B, 0, B.len, -0.2, FLOORS[1] - 0.05, 0, 0.02, COL.room);
      }
      const [x, z] = G[G.length - 1];
      p.add(BOX(0.4, H + 0.7, 0.4), COL.mullion, x, y0 + (H + 0.7) / 2, z);
      const [x0, z0] = G[0];
      p.add(BOX(0.4, H + 0.7, 0.4), COL.mullion, x0, y0 + (H + 0.7) / 2, z0);
    }

    // ---- the brick faces
    const ring = [...REST, G[0]];
    const faces = [face(G[G.length - 1], REST[0])];
    for (let k = 0; k < ring.length - 1; k++) faces.push(face(ring[k], ring[k + 1]));
    faces.forEach((F, k) => {
      parapet(F, COL.brick);
      for (const y of FLOORS.slice(1)) band(F, y);
      const n = Math.floor((F.len - 0.6) / 2.4);
      if (F.len < 2) return;
      const isJakobi = k === 0, isBaeri = k === 5;
      for (let f = isBaeri ? 1 : 0; f < 4; f++) {
        if (f === 0 && isJakobi) { shop(F, 0.4, F.len - 0.5, 3.1); continue; }
        if (isBaeri && f > 0) {
          balcony(F, 0.8, 3.6, FLOORS[f]); balcony(F, F.len - 3.6, F.len - 0.8, FLOORS[f]);
          win(F, F.len / 2 - 0.65, F.len / 2 + 0.65, FLOORS[f] + 0.9, FLOORS[f] + 2.5);
          continue;
        }
        for (let w = 0; w < n; w++) {
          const s = (F.len - n * 2.4) / 2 + w * 2.4 + 0.55;
          win(F, s, s + 1.3, FLOORS[f] + 0.85, FLOORS[f] + 2.6);
        }
      }
    });

    // ---- the annex along Baeri: glass shop front, sign, parapet
    {
      const A = face(ANNEX[3], ANNEX[0]);
      shop(A, 0.6, A.len - 0.6, 2.8);
      slab(A, 0.4, A.len - 0.4, 2.85, ANNEX_H - 0.05, 0, 0.08, COL.brickDark);
      for (let k = 0; k < ANNEX.length; k++) {
        const F = face(ANNEX[k], ANNEX[(k + 1) % ANNEX.length]);
        if (k === 1) continue;                                  // against the main block
        slab(F, -0.05, F.len + 0.05, ANNEX_H - 0.02, ANNEX_H + 0.35, -0.22, 0.24, COL.brick);
        slab(F, -0.08, F.len + 0.08, ANNEX_H + 0.35, ANNEX_H + 0.43, -0.26, 0.3, COL.cope);
      }
      const S = face(ANNEX[2], ANNEX[3]);
      win(S, 0.6, 1.8, 0.9, 2.5);
    }

    // ---- roof: vent boxes and two chimneys
    for (const [x, z, w, h, d] of [[960, 2624, 2.4, 0.9, 1.6], [965.5, 2625.5, 1.4, 0.7, 1.4], [953, 2627.5, 1.8, 0.8, 1.2]]) p.add(BOX(w, h, d), COL.vent, x, y0 + H + h / 2, z, 0.32);
    for (const [x, z] of [[968.5, 2627.2], [955.3, 2631.2]]) {
      p.add(BOX(0.8, 1.8, 0.8), COL.brick, x, y0 + H + 0.9, z, 0.32);
      p.add(BOX(0.95, 0.12, 0.95), COL.cope, x, y0 + H + 1.85, z, 0.32);
    }

    const mesh = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    if (mesh) { mesh.castShadow = shadows; mesh.receiveShadow = true; group.add(mesh); }

    breakable = breakableCorner(world, group, { G, C, y0, face, floorAt, shadows });
    trimCut(world);
  }

  // the floor of a bay: the ground under its three corners, never below the glass's foot
  const floorAt = (...pts) => Math.max(BASE + 0.08, ...pts.map(([x, z]) => world.heightAt(x, z) + 0.03));

  let breakable = null;
  return {
    update(car, dt = 1 / 60, sound = null) {
      if (breakable) { breakable.update(car, dt, sound); return; }
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 450) return;
      if ([CURVE[0], REST[1], REST[4]].every((q) => world.ready(q[0], q[1]))) build();
    },
    // (for the tools)
    info: () => breakable?.info() ?? null,
  };
}

// a flat triangle at height y (world), facing up or down
function tri(p, pts, y, up, hex) {
  let [a, b, c] = pts;
  const ny = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);     // y of (b - a) x (c - a)
  if ((ny > 0) !== up) [b, c] = [c, b];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([a, b, c].flatMap(([x, z]) => [x, 0, z]), 3));
  g.computeVertexNormals();
  p.add(g, hex, 0, y, 0);
}

// Martin, 20 Nov: cars may still cut the corner a little through the outside of the glass bays, only about
// 5 cm less than before: the map's footprint of the house reads 5 cm fuller round the corner (and the two
// brick wings beside it), easing out over 1.5 m to the sides of the rectangle so nothing jumps.
function trimCut(world) {
  world.addGrow?.({ x0: 943, z0: 2615, x1: 972, z1: 2632, by: 0.05, edge: 1.5 });
}

// ---- the ground floor of the glass corner, which a car can break (Martin, 20 Nov) ----
// Every face of every bay has one tall pane: touch it with the car and it bursts into pieces that fall in and
// round the bay. Behind each pane a roller blind hangs from a box under the ceiling (as in his street view of
// Aug 2024, pale and striped); a car pushing on into the bay swings it in, and it swings back when the car
// goes. The black frame (a post at every corner of the bays, a rail along the foot and a transom half way up)
// gets little dents where it is hit, and is pressed out of the way, bent, where the car goes on into it.
// The damage stays until the page is loaded again.
const PANE_SHARDS = 140;
const BLIND_IN = 0.16;                 // m behind the glass
const STRIPE = 0.32;                   // m, one tile of the blind's stripes
const DENT_MAX = 1.2;                  // m, the most the frame is pushed anywhere

let stripeTex = null;
function blindTexture() {
  if (stripeTex) return stripeTex;
  const c = document.createElement('canvas');
  c.width = 4; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 4, 32);
  g.fillStyle = '#d6dcdb';
  for (let y = 0; y < 32; y += 4) g.fillRect(0, y, 4, 1);      // the slats' shadow lines
  stripeTex = new THREE.CanvasTexture(c);
  stripeTex.wrapS = stripeTex.wrapT = THREE.RepeatWrapping;
  stripeTex.colorSpace = THREE.SRGBColorSpace;
  return stripeTex;
}

function breakableCorner(world, group, { G, C, y0, face, floorAt, shadows }) {
  const panes = [];
  for (let k = 0; k < G.length - 1; k++) {
    const F = face(G[k], G[k + 1]), bay = k >> 1;
    const bottom = floorAt(C[bay], G[2 * bay + 1], C[bay + 1]) - y0;
    panes.push({ F, k, bottom, top: FLOORS[1] - 0.05, broken: false });
  }

  // ---- glass: one mesh, a broken pane's corners are folded onto one point
  const glassGeo = new THREE.BufferGeometry(), gpos = new Float32Array(panes.length * 18);
  panes.forEach((q, i) => {
    const [ax, az] = q.F.at(0.05, 0.03), [bx, bz] = q.F.at(q.F.len - 0.05, 0.03), ya = y0 + q.bottom, yb = y0 + q.top;
    gpos.set([ax, ya, az, bx, ya, bz, bx, yb, bz, ax, ya, az, bx, yb, bz, ax, yb, az], i * 18);
    q.a = [ax, az]; q.b = [bx, bz];
  });
  glassGeo.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
  glassGeo.computeVertexNormals();
  const glass = new THREE.Mesh(glassGeo, new THREE.MeshLambertMaterial({ color: 0x8fb5b4, transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false }));
  group.add(glass);
  const shards = glassShards(world, group, PANE_SHARDS * panes.length);

  // ---- the frame: square tubes along a line of stations; each station can be pushed (R) and the tube follows
  const rods = [];
  const rod = (pts, u, v, ha, hb, anchor) => {
    const n = pts.length, s = new Float32Array(n);
    for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
    const cx = pts.reduce((t, q) => t + q[0], 0) / n, cz = pts.reduce((t, q) => t + q[2], 0) / n;
    rods.push({ c: pts.flat(), u, v, ha, hb, s, n, R: new Float32Array(n * 3), noise: Float32Array.from(pts, () => Math.random() * 2 - 1),
      w: Float32Array.from(s, anchor), cx, cz, rad: Math.max(...pts.map((q) => Math.hypot(q[0] - cx, q[2] - cz))) + 0.3, touched: -9, start: 0 });
  };
  const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const m0 = FLOORS[1] + 0.3;                                         // where the posts meet the floor band
  for (let k = 1; k < G.length - 1; k++) {                            // (the two end posts are thick and stay put)
    const F = panes[k].F, [x, z] = F.at(0, 0.1), b = Math.min(panes[k].bottom, panes[k - 1].bottom) - 0.15, pts = [];
    for (let i = 0; i <= 14; i++) pts.push([x, y0 + b + (m0 - b) * i / 14, z]);
    const h = m0 - b;
    rod(pts, [F.d[0], 0, F.d[1]], [F.n[0], 0, F.n[1]], 0.06, 0.1, (s) => smooth(0.05, 0.4, s) * (1 - smooth(h - 1.4, h - 0.15, s)));
  }
  for (const q of panes) {
    const F = q.F, n = Math.max(3, Math.ceil(F.len / 0.18));
    for (const [y, hb] of [[q.bottom + 0.07, 0.07], [(q.bottom + q.top) / 2, 0.025]]) {
      const pts = [];
      for (let i = 0; i <= n; i++) { const [x, z] = F.at(F.len * i / n, 0.05); pts.push([x, y0 + y, z]); }
      rod(pts, [F.n[0], 0, F.n[1]], [0, 1, 0], 0.05, hb, () => 1);
    }
  }
  let nv = 0;
  for (const r of rods) { r.start = nv; nv += (r.n - 1) * 24; }
  const fpos = new Float32Array(nv * 3), fnor = new Float32Array(nv * 3);
  const P = new Float32Array(3 * 16);
  function writeRod(r) {
    const { c, R, noise, u, v, ha, hb } = r;
    for (let i = 0; i < r.n; i++) {
      const f = 1 + 0.15 * noise[i];
      const px = c[i * 3] + R[i * 3] * f, py = c[i * 3 + 1] + R[i * 3 + 1] * f, pz = c[i * 3 + 2] + R[i * 3 + 2] * f;
      for (let j = 0; j < 4; j++) {
        const sa = j === 0 || j === 3 ? ha : -ha, sb = j < 2 ? hb : -hb;
        P[(i % 4) * 12 + j * 3] = px + u[0] * sa + v[0] * sb;
        P[(i % 4) * 12 + j * 3 + 1] = py + u[1] * sa + v[1] * sb;
        P[(i % 4) * 12 + j * 3 + 2] = pz + u[2] * sa + v[2] * sb;
      }
      if (i === 0) continue;
      const A = ((i - 1) % 4) * 12, B = (i % 4) * 12;
      for (let j = 0; j < 4; j++) {
        const j1 = (j + 1) % 4, o = (r.start + (i - 1) * 24 + j * 6) * 3;
        const q = [A + j * 3, B + j * 3, B + j1 * 3, A + j * 3, B + j1 * 3, A + j1 * 3];
        for (let t = 0; t < 6; t++) { fpos[o + t * 3] = P[q[t]]; fpos[o + t * 3 + 1] = P[q[t] + 1]; fpos[o + t * 3 + 2] = P[q[t] + 2]; }
        // flat normal of the quad
        const e1x = P[q[1]] - P[q[0]], e1y = P[q[1] + 1] - P[q[0] + 1], e1z = P[q[1] + 2] - P[q[0] + 2];
        const e2x = P[q[2]] - P[q[0]], e2y = P[q[2] + 1] - P[q[0] + 1], e2z = P[q[2] + 2] - P[q[0] + 2];
        let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        for (let t = 0; t < 6; t++) { fnor[o + t * 3] = nx; fnor[o + t * 3 + 1] = ny; fnor[o + t * 3 + 2] = nz; }
      }
    }
  }
  for (const r of rods) writeRod(r);
  const frameGeo = new THREE.BufferGeometry();
  frameGeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3).setUsage(THREE.DynamicDrawUsage));
  frameGeo.setAttribute('normal', new THREE.BufferAttribute(fnor, 3).setUsage(THREE.DynamicDrawUsage));
  frameGeo.computeBoundingSphere();
  const frame = new THREE.Mesh(frameGeo, new THREE.MeshLambertMaterial({ color: COL.mullion, side: THREE.DoubleSide }));
  frame.castShadow = shadows; frame.receiveShadow = true;
  group.add(frame);

  // ---- the roller blinds: a striped sheet and a bar at its foot, hinged under the ceiling
  const hingeY = FLOORS[1] - 0.14;
  const blinds = panes.map((q) => ({ q, s0: 0.12, s1: q.F.len - 0.12, L: hingeY - q.bottom - 0.25, th: 0, om: 0, moving: false }));
  const bpos = new Float32Array(blinds.length * 18 * 3), bnor = new Float32Array(blinds.length * 18 * 3);
  const buv = new Float32Array(blinds.length * 18 * 2), bcol = new Float32Array(blinds.length * 18 * 3);
  const cBlind = new THREE.Color(COL.blind), cBar = new THREE.Color(COL.blindBar);
  blinds.forEach((B, i) => {
    const w = (B.s1 - B.s0) / STRIPE * 0.25, h = B.L / STRIPE;
    buv.set([0, h, w, h, w, 0, 0, h, w, 0, 0, 0], i * 36);
    for (let t = 0; t < 18; t++) { const c = t < 6 ? cBlind : cBar; bcol.set([c.r, c.g, c.b], (i * 18 + t) * 3); }
  });
  function writeBlind(i) {
    const B = blinds[i], F = B.q.F, sn = Math.sin(B.th), cs = Math.cos(B.th), o = i * 54;
    const at = (s, h, off = 0) => { const [x, z] = F.at(s, -BLIND_IN - h * sn + off * cs); return [x, y0 + hingeY - h * cs - off * sn, z]; };
    const a0 = at(B.s0, 0), a1 = at(B.s1, 0), b0 = at(B.s0, B.L), b1 = at(B.s1, B.L);
    const bar = [at(B.s0, B.L - 0.02), at(B.s1, B.L - 0.02), at(B.s1, B.L + 0.03), at(B.s0, B.L + 0.03), at(B.s0, B.L, 0.025), at(B.s1, B.L, 0.025), at(B.s1, B.L, -0.025), at(B.s0, B.L, -0.025)];
    const quads = [[b0, b1, a1, a0], bar.slice(0, 4), bar.slice(4, 8)];
    const nx = F.n[0] * cs, ny = -sn, nz = F.n[1] * cs;
    quads.forEach(([p0, p1, p2, p3], j) => {
      const verts = [p0, p1, p2, p0, p2, p3];
      verts.forEach((p, t) => bpos.set(p, o + (j * 6 + t) * 3));
      const [qx, qy, qz] = j === 2 ? [-sn * F.n[0], -cs, -sn * F.n[1]] : [nx, ny, nz];
      for (let t = 0; t < 6; t++) bnor.set([qx, qy, qz], o + (j * 6 + t) * 3);
    });
  }
  blinds.forEach((_, i) => writeBlind(i));
  const blindGeo = new THREE.BufferGeometry();
  blindGeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3).setUsage(THREE.DynamicDrawUsage));
  blindGeo.setAttribute('normal', new THREE.BufferAttribute(bnor, 3).setUsage(THREE.DynamicDrawUsage));
  blindGeo.setAttribute('uv', new THREE.BufferAttribute(buv, 2));
  blindGeo.setAttribute('color', new THREE.BufferAttribute(bcol, 3));
  blindGeo.computeBoundingSphere();
  const blindMesh = new THREE.Mesh(blindGeo, new THREE.MeshLambertMaterial({ map: blindTexture(), vertexColors: true, side: THREE.DoubleSide }));
  blindMesh.receiveShadow = true;
  group.add(blindMesh);

  // ---- the car against it all
  let time = 0, cool = 0, busy = false;
  const near = (car) => Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) < 22;
  function update(car, dt, sound) {
    time += dt;
    cool = Math.max(0, cool - dt);
    if (car && near(car)) contact(car, dt, sound);
    if (!busy) return;
    let moving = shards.update(dt), swung = false;
    for (let i = 0; i < blinds.length; i++) {
      const B = blinds[i];
      if (!B.moving) continue;
      // a sheet hanging from its top edge: swings back under its own weight, the air damps it
      B.om += (-4.9 * Math.sin(B.th) - 1.4 * B.om) * dt;
      B.th = Math.max(-0.5, B.th + B.om * dt);
      if (B.need > B.th) { B.th = B.need; B.om = Math.max(B.om, 0); }
      B.need = 0;
      if (Math.abs(B.th) < 0.002 && Math.abs(B.om) < 0.004) { B.th = 0; B.om = 0; B.moving = false; }
      writeBlind(i);
      moving = swung = true;
    }
    if (swung) { blindGeo.attributes.position.needsUpdate = true; blindGeo.attributes.normal.needsUpdate = true; }
    if (!moving && !(car && near(car))) busy = false;
  }

  function contact(car, dt, sound) {
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
    const hl = car.halfLen, hw = car.halfWid;
    const wvx = car.vx * fx + car.vy * rx, wvz = car.vx * fz + car.vy * rz, speed = Math.hypot(wvx, wvz);
    const lo = car.y + 0.15, hi = car.y + (hl > 4 ? 3.1 : 1.45);
    const inside = (x, z, m) => {
      const dx = x - car.x, dz = z - car.z, lx = dx * fx + dz * fz, ly = dx * rx + dz * rz;
      return Math.abs(lx) < hl + m && Math.abs(ly) < hw + m ? [lx, ly] : null;
    };
    const reach = Math.hypot(hl, hw);

    // the glass: any touch breaks a pane
    let broke = 0;
    for (const q of panes) {
      if (q.broken) continue;
      let hit = false;
      for (let t = 0; t <= 10 && !hit; t++) hit = !!inside(q.a[0] + (q.b[0] - q.a[0]) * t / 10, q.a[1] + (q.b[1] - q.a[1]) * t / 10, 0.02);
      if (!hit) continue;
      q.broken = true; broke++; busy = true;
      for (let t = 0; t < 18; t += 3) { gpos[q.k * 18 + t] = gpos[q.k * 18]; gpos[q.k * 18 + t + 1] = gpos[q.k * 18 + 1]; gpos[q.k * 18 + t + 2] = gpos[q.k * 18 + 2]; }
      // (thrown in, the way the car goes)
      const v = Math.max(speed, 1), dx = 0.5 * wvx / v - 0.5 * q.F.n[0], dz = 0.5 * wvz / v - 0.5 * q.F.n[1], l = Math.hypot(dx, dz) || 1;
      shards.burst(q.a, q.b, y0 + q.bottom, y0 + q.top, dx / l, dz / l, Math.max(speed, 1.5), PANE_SHARDS);
    }
    if (broke) {
      glassGeo.attributes.position.needsUpdate = true;
      sound?.smash?.(broke, Math.max(0.35, Math.min(1.5, speed / 8)));
      stats.smash('glass', broke);
      cool = 0.3;
    }

    // the frame: every station inside the car's outline is pushed out of it, the tube bends round it
    let dented = false, hardest = 0;
    for (const r of rods) {
      if (Math.hypot(r.cx - car.x, r.cz - car.z) > r.rad + reach) continue;
      let moved = false;
      for (let i = 0; i < r.n; i++) {
        const f = 1 + 0.15 * r.noise[i];
        const px = r.c[i * 3] + r.R[i * 3] * f, py = r.c[i * 3 + 1] + r.R[i * 3 + 1] * f, pz = r.c[i * 3 + 2] + r.R[i * 3 + 2] * f;
        if (py + r.hb < lo || py - r.hb > hi) continue;
        const m = Math.max(r.ha, r.hb) + 0.02, L = inside(px, pz, m);
        if (!L) continue;
        const ex = hl + m - Math.abs(L[0]), ey = hw + m - Math.abs(L[1]);
        let dx, dz;
        if (ey < ex) { dx = Math.sign(L[1]) * rx * ey; dz = Math.sign(L[1]) * rz * ey; }
        else { dx = Math.sign(L[0]) * fx * ex; dz = Math.sign(L[0]) * fz * ex; }
        // a fresh knock leaves a little dent on top of that, deeper the faster the car came
        if (time - r.touched > 0.5) {
          const pl = Math.hypot(dx, dz) || 1, extra = Math.min(0.07, 0.012 + 0.002 * speed * speed);
          dx += dx / pl * extra; dz += dz / pl * extra;
          hardest = Math.max(hardest, speed);
        }
        r.touched = time;
        const k = 1 / Math.max(r.w[i], 0.3) / f;
        for (let j = 0; j < r.n; j++) {
          const g = Math.exp(-(((r.s[j] - r.s[i]) / 0.45) ** 2)) * r.w[j];
          if (g < 0.01) continue;
          r.R[j * 3] += dx * k * g; r.R[j * 3 + 2] += dz * k * g;
          r.R[j * 3 + 1] -= Math.hypot(dx, dz) * k * g * 0.08;          // (bent metal sags a touch)
          const l = Math.hypot(r.R[j * 3], r.R[j * 3 + 2]);
          if (l > DENT_MAX) { r.R[j * 3] *= DENT_MAX / l; r.R[j * 3 + 2] *= DENT_MAX / l; }
        }
        moved = true;
      }
      if (moved) { writeRod(r); dented = true; }
    }
    if (dented) {
      frameGeo.attributes.position.needsUpdate = true;
      frameGeo.attributes.normal.needsUpdate = true;
      frameGeo.computeBoundingSphere();
      if (hardest > 1.5 && !broke && cool === 0) { sound?.smash?.(0, Math.min(1.2, hardest / 8)); cool = 0.3; }
    }

    // the blinds: how far the car reaches in behind each one; it swings in far enough to clear the car's top
    for (const B of blinds) {
      const F = B.q.F;
      if (Math.hypot(F.at(F.len / 2, 0)[0] - car.x, F.at(F.len / 2, 0)[1] - car.z) > reach + F.len) continue;
      let pen = -1;
      const dlx = -(F.n[0] * fx + F.n[1] * fz), dly = -(F.n[0] * rx + F.n[1] * rz);
      for (let t = 0; t <= 6; t++) {
        const [x, z] = F.at(B.s0 + (B.s1 - B.s0) * t / 6, -BLIND_IN), ox = x - car.x, oz = z - car.z;
        const plx = ox * fx + oz * fz, ply = ox * rx + oz * rz;
        let t0 = -Infinity, t1 = Infinity;
        for (const [p, d, half] of [[plx, dlx, hl], [ply, dly, hw]]) {
          if (Math.abs(d) < 1e-6) { if (Math.abs(p) > half) { t0 = 1; t1 = 0; } continue; }
          const a = (-half - p) / d, b = (half - p) / d;
          t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
        }
        if (t0 < t1 && t1 > 0) pen = Math.max(pen, t1);
      }
      if (pen <= 0) continue;
      const Lc = Math.max(0.3, Math.min(B.L, y0 + hingeY - hi));
      B.need = Math.asin(Math.min(0.97, (pen + 0.05) / Lc));
      if (B.need > B.th) {
        if (!B.moving && speed > 0.5) B.om = Math.min(3, speed * 0.4);   // shoved: it flies in a bit further than the car
        B.moving = true; busy = true;
      }
    }
  }

  return {
    update,
    info: () => ({
      panes: panes.length, broken: panes.filter((q) => q.broken).length, shards: shards.count,
      dent: Math.max(0, ...rods.map((r) => { let m = 0; for (let i = 0; i < r.n; i++) m = Math.max(m, Math.hypot(r.R[i * 3], r.R[i * 3 + 2])); return m; })),
      blinds: blinds.filter((B) => B.th > 0.01).length, maxBlind: Math.max(...blinds.map((B) => B.th)),
    }),
  };
}
