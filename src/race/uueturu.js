// The Vanemuise / Ülikooli / Uueturu junction and Uueturu up to the Küüni plaza (Martin, 18 Nov, street
// view Aug 2024 and kaldaerofoto Apr 2024), in pastel colours: the zebra crossings round the junction, the
// street names painted on the road, the diamond paving of Uueturu (dark slate squares between slightly
// paler bands) from the building fronts to the green, and the left side of the street: the slate office
// building with its window bands, pale plinth and white annex, the parking bays in front of it, the bush
// island after the bays, lamp posts, bollards and three parked cars.
import * as THREE from 'three';
import { createTrack } from './race.js';
import { Parts, BOX } from './landmarks.js';
import { buildCarModel } from '../cars/models/index.js';

const ZEBRAS = [
  { i: 2303.5, w: 4.0 },                                    // across Vanemuise, before the junction
  { i: 2314.5, w: 3.6 },                                    // across Uueturu, leaving the junction
];
// the two crossings over Ülikooli either side of the junction: centre (game x, z), along Ülikooli, length
const SIDE_ZEBRAS = [
  { c: [1591.5, 3156.0], half: 5.2 },
  { c: [1576.0, 3141.5], half: 5.0 },
];
const ULIKOOLI = [0.70, 0.71];                              // direction of Ülikooli (x, z), from the orthophoto
const NAMES = [{ text: 'Ülikooli tn', i: 2305.5, lat: 2.2 }, { text: 'Uueturu tn', i: 2318, lat: 1.6 }];
const DIAMOND = { i0: 2316, i1: 2346, left: -23, right: 7.5, period: 2.6, band: 0.3 };
const COL = {
  white: 0xfaf8ff, slate: 0x66657e, band: 0x807f9a, patch: 0xb9b5c9,
  wall: 0x8885a4, glass: 0xa8cfd0, frame: 0x4a4760, plinth: 0xe8e3ee, annex: 0xf4efe6, annexGlass: 0x7d7a99,
  kerb: 0xd9d4e2, soil: 0x8f8499, bush: [0x6fbf7a, 0x5cae6c, 0x86cf86],
};

// The office building on the left, from the LOD2 building model (game x, z; top = roof edge, world y).
// Walls run a -> b with the street on their right.
const WALLS = {
  corner: { a: [1577.95, 3123.4], b: [1585.55, 3118.4], top: 24.2 },    // cut-off corner at the junction, entrance
  end: { a: [1585.55, 3118.4], b: [1590.75, 3127.25], top: 24.4 },      // end wall facing the junction
  front: { a: [1590.75, 3127.25], b: [1613.55, 3104.05], top: 20.3 },   // the long front on Uueturu
  step: { a: [1613.55, 3104.05], b: [1611.4, 3101.7], top: 20.3 },      // where the front steps back
  back: { a: [1611.4, 3101.7], b: [1627.5, 3086.45], top: 18.6 },       // set back 3.2 m, up to the Küüni corner
};
const TOWER = { s1: 5.73, top: 24.4 };                    // the first metres of the front are a storey higher
const ROWS = [[9.6, 11.8], [13.3, 15.1], [16.8, 18.6]];   // window bands of the front (world y)
const GROUPS = { s0: 6.7, pitch: 3.7, w: 3.0, n: 6 };     // six pairs of windows in each band
const ANNEX = { s0: 5.0, s1: 16.0, depth: 3.2, h: 12.1, cols: 5, rows: 4 };   // white annex, along the back wall
// in front of the long front, as (s along it, n out from it): the walkway, then the bays, then the lane
const BAYS = { s0: 3.3, step: 2.6, n: 9, n0: 3.4, n1: 8.4, lineFrom: 0.8, w: 0.14 };
const ISLAND = { s: 28.7, n: 5.6, hu: 2.75, hv: 1.8 };    // kerbed bush island after the last bay
const LAMP_S = [8.5, 13.7, 18.9, 24.1], BOLLARD_S = [1.4, 4.2, 7.0];   // lamp posts stand on bay lines
// cars parked nose-in in the bays (Martin, 18 Nov): bay number from the corner, model, builder options.
// Plain solid objects: they do not move when hit.
const PARKED = [
  { bay: 2, id: 'enyaq', opts: { rack: false, paint: 0xeceeef }, hl: 2.33, hw: 0.94, wb: 2.765, turn: 0.02 },
  { bay: 4, id: 'mazda6', hl: 2.4, hw: 0.92, wb: 2.75, turn: -0.03 },
  { bay: 6, id: 'rav4', hl: 2.3, hw: 0.93, wb: 2.69, turn: 0.015 },
];
// the map has this building's lamps and a sign inside it: they go out to the walkway instead
const LIGHT = 0, BOLLARD = 8;
const MOVED = [[0, 1606.3, 3102.5], [0, 1600.8, 3108.1], [0, 1598.1, 3116.5], [18, 1596.9, 3113.5]];

function wallOf({ a, b, top }) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
  return { a, top, len, ux, uz, nx: -uz, nz: ux, yaw: Math.atan2(-uz, ux), at: (s, n) => [a[0] + ux * s - uz * n, a[1] + uz * s + ux * n] };
}

// props layer: leave out the lamps and the sign the map has inside the building ...
export function uueturuClear(data, out) {
  for (const [key, a] of Object.entries(data.sectors)) {
    for (let k = 0; k < a.length; k += data.stride) {
      if (MOVED.some(([kind, x, z]) => a[k] === kind && Math.hypot(a[k + 1] - x, a[k + 2] - z) < 0.6)) out.add(`${key}:${k / data.stride}`);
    }
  }
}
// ... and stand lamp posts along the walkway line, bollards and the sign at the corner
export function uueturuProps() {
  const F = wallOf(WALLS.front), out = [];
  const arm = (Math.atan2(F.nx, -F.nz) * 180) / Math.PI;           // compass bearing of "out from the wall"
  for (const s of LAMP_S) out.push([LIGHT, ...F.at(s, BAYS.n0), arm]);
  for (const s of BOLLARD_S) out.push([BOLLARD, ...F.at(s, 2.6), arm]);
  out.push([18, ...F.at(-1.6, 2.4), 66]);
  return out;
}

// building colours: the two parts of this building the map knows become slate grey like the real one
export function uueturuWalls(walls) {
  const list = walls && walls.sectors && walls.sectors['3_6'];
  if (!list) return;
  for (let k = 0; k < list.length; k += 4) {
    const x = 1120 + list[k + 1] * 0.1, z = 3040 + list[k + 2] * 0.1;
    if (list[k] === 486 && Math.hypot(x - 1598.2, z - 3104.8) < 4.5) list[k + 3] = COL.wall;
  }
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// one tile of the lattice, in axes turned 45 degrees to the street: a dark square inside a pale band
function diamondTex() {
  const t = canvasTex(256, 256, (g, w, h) => {
    const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
    g.fillStyle = hex(COL.band); g.fillRect(0, 0, w, h);
    const b = (DIAMOND.band / DIAMOND.period) * w / 2;
    g.fillStyle = hex(COL.slate);
    g.fillRect(b, b, w - 2 * b, h - 2 * b);
    // faint joints between the small pavers inside the squares
    g.strokeStyle = 'rgba(40, 36, 60, 0.12)'; g.lineWidth = 1;
    for (let k = b + 16; k < w - b; k += 16) {
      g.beginPath(); g.moveTo(k, b); g.lineTo(k, h - b); g.stroke();
      g.beginPath(); g.moveTo(b, k); g.lineTo(w - b, k); g.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function nameTex(text) {
  return canvasTex(1024, 256, (g, w, h) => {
    g.font = 'bold 200px "Arial Narrow", Arial, sans-serif';
    g.textBaseline = 'middle'; g.textAlign = 'center';
    g.lineWidth = 14; g.strokeStyle = 'rgba(70, 60, 95, 0.35)';
    g.strokeText(text, w / 2, h / 2 + 10);
    g.fillStyle = '#ffffff';
    g.fillText(text, w / 2, h / 2 + 10);
  });
}

// before the road markings are built: no generated centre line through the junction and on Uueturu
export function uueturuVectors(vectors) {
  const track = createTrack(), prev = vectors.markSkip;
  vectors.markSkip = (x, z) => {
    if (prev && prev(x, z)) return true;
    const n = track.nearest(x, z, 2320);
    return n.i >= 2300 && n.i <= 2350 && n.d < track.HW[n.i] + 1;
  };
}

export function createUueturu(world, group) {
  const track = createTrack();
  const lerpP = (fi) => {
    const i = Math.floor(fi), t = fi - i, a = track.P[i], b = track.P[i + 1];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  const tanAt = (fi) => track.tan[Math.round(fi)];
  const markMat = new THREE.MeshLambertMaterial({ color: COL.white, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, side: THREE.DoubleSide });
  let built = false;

  // a flat quad on the ground: centre, unit axis u (length 2*hu) and v (2*hv), split so it follows the ground
  function quad(pos, cx, cz, ux, uz, hu, hv, lift) {
    const vx = -uz, vz = ux, n = Math.max(1, Math.ceil(hu)), m = Math.max(1, Math.ceil(hv));
    const P = (a, b) => { const x = cx + ux * a + vx * b, z = cz + uz * a + vz * b; return [x, world.heightAt(x, z) + lift, z]; };
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const a0 = -hu + 2 * hu * i / n, a1 = -hu + 2 * hu * (i + 1) / n, b0 = -hv + 2 * hv * j / m, b1 = -hv + 2 * hv * (j + 1) / m;
      pos.push(...P(a0, b0), ...P(a0, b1), ...P(a1, b0), ...P(a1, b0), ...P(a0, b1), ...P(a1, b1));
    }
  }
  function meshFrom(pos, mat, uv) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const nor = new Float32Array(pos.length);
    for (let k = 1; k < nor.length; k += 3) nor[k] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    group.add(m);
    return m;
  }

  // a zebra: stripes 0.5 m wide every 1.0 m across the road, each `len` long in the direction of travel
  function zebra(pos, cx, cz, ux, uz, half, len) {
    const rx = -uz, rz = ux;
    for (let o = -half + 0.25; o <= half - 0.25; o += 1.0) quad(pos, cx + rx * o, cz + rz * o, ux, uz, len / 2, 0.25, 0.075);
  }

  // the left side of the street: the building's faces towards the street, the bush island
  function buildLeft(F, B) {
    const p = new Parts(), g = (q) => world.heightAt(q[0], q[1]);
    // a flat box standing against wall W: s0..s1 along it, y0..y1, its back `off` out from the wall
    const slab = (W, s0, s1, y0, y1, off, thick, hex) => {
      const [x, z] = W.at((s0 + s1) / 2, off + thick / 2);
      p.add(BOX(s1 - s0, y1 - y0, thick), hex, x, (y0 + y1) / 2, z, W.yaw);
    };
    // a window: dark frame, glass, upright bars
    const win = (W, s0, s1, y0, y1, bars, glass = COL.glass) => {
      slab(W, s0 - 0.09, s1 + 0.09, y0 - 0.09, y1 + 0.09, 0.14, 0.05, COL.frame);
      slab(W, s0, s1, y0, y1, 0.17, 0.05, glass);
      for (let k = 1; k <= bars; k++) slab(W, s0 + (s1 - s0) * k / (bars + 1) - 0.04, s0 + (s1 - s0) * k / (bars + 1) + 0.04, y0, y1, 0.2, 0.04, COL.frame);
    };
    // the wall itself, and a pale plinth that follows the ground
    const face = (W) => slab(W, 0, W.len, Math.min(g(W.at(0, 0.5)), g(W.at(W.len, 0.5))) - 1, W.top + 0.05, 0.03, 0.11, COL.wall);
    const plinth = (W, s0 = 0, s1 = W.len, off = 0.14) => {
      const n = Math.max(1, Math.round((s1 - s0) / 5));
      for (let k = 0; k < n; k++) {
        const a = s0 + (s1 - s0) * k / n, b = s0 + (s1 - s0) * (k + 1) / n, ya = g(W.at(a, 0.6)) + 1.25, yb = g(W.at(b, 0.6)) + 1.25;
        const box = BOX(b - a, 2.2, 0.1), q = box.attributes.position;
        for (let i = 0; i < q.count; i++) q.setY(i, q.getY(i) + q.getX(i) * (yb - ya) / (b - a));
        const [x, z] = W.at((a + b) / 2, off + 0.05);
        p.add(box, COL.plinth, x, (ya + yb) / 2 - 1.1, z, W.yaw);
      }
    };

    // ---- the long front: plain tower end, then three bands of six window pairs
    face(F); slab(F, 0, TOWER.s1, F.top, TOWER.top + 0.05, 0.03, 0.11, COL.wall); plinth(F);
    for (const [y0, y1] of ROWS) for (let k = 0; k < GROUPS.n; k++) win(F, GROUPS.s0 + GROUPS.pitch * k, GROUPS.s0 + GROUPS.pitch * k + GROUPS.w, y0, y1, 1);
    // ---- end wall towards the junction: two window pairs on four floors
    const E = wallOf(WALLS.end);
    face(E); plinth(E);
    for (const [y0, y1] of [...ROWS, [20.4, 22.2]]) for (const s0 of [1.5, 5.75]) win(E, s0, s0 + 3.0, y0, y1, 1);
    // ---- the cut-off corner: glazed stair, entrance under a pale canopy
    const C = wallOf(WALLS.corner), gc = g(C.at(C.len / 2, 0.6));
    face(C); plinth(C, 0, 2.6); plinth(C, 6.6, C.len);
    win(C, 3.0, 6.2, gc + 4.2, C.top - 1.6, 2);
    for (let y = gc + 6.6; y < C.top - 2; y += 2.4) slab(C, 3.0, 6.2, y - 0.04, y + 0.04, 0.2, 0.04, COL.frame);
    win(C, 3.3, 5.9, gc + 0.05, gc + 2.7, 1, COL.annexGlass);
    { const [x, z] = C.at(4.6, 0.95); p.add(BOX(5.0, 0.22, 1.9), COL.plinth, x, gc + 3.15, z, C.yaw); }
    // ---- where the front steps back, and the set-back wall with the white annex standing out of it
    const S = wallOf(WALLS.step);
    face(S); face(B); plinth(S); plinth(B, 0, ANNEX.s0); plinth(B, ANNEX.s1, B.len);
    const brows = [[7.4, 9.2], [10.9, 12.7], [14.4, 16.2]];
    for (const [y0, y1] of brows) { win(B, 1.0, 4.0, y0, y1, 1); win(B, ANNEX.s1 + 1.6, ANNEX.s1 + 4.6, y0, y1, 1); }
    {
      const A = ANNEX, ga = Math.min(g(B.at(A.s0, A.depth + 0.5)), g(B.at(A.s1, A.depth + 0.5))), top = ga + A.h;
      const [x, z] = B.at((A.s0 + A.s1) / 2, A.depth / 2);
      p.add(BOX(A.s1 - A.s0, A.h + 1, A.depth), COL.annex, x, top - (A.h + 1) / 2, z, B.yaw);
      p.add(BOX(A.s1 - A.s0 + 0.3, 0.25, A.depth + 0.3), COL.plinth, x, top + 0.12, z, B.yaw);       // coping
      const Aw = { ...B, at: (s, n) => B.at(s, n + A.depth) };                                      // its front face
      const pitch = (A.s1 - A.s0) / A.cols;
      for (let r = 0; r < A.rows; r++) for (let c = 0; c < A.cols; c++) {
        const s0 = A.s0 + pitch * (c + 0.5) - 0.62, y0 = ga + 1.1 + r * 2.85;
        slab(Aw, s0, s0 + 1.24, y0, y0 + 1.5, 0.0, 0.05, COL.annexGlass);
        slab(Aw, s0 + 0.58, s0 + 0.66, y0, y0 + 1.5, 0.03, 0.04, COL.annex);
      }
      world.addSolids([{ x, z, yaw: B.yaw, hx: (A.s1 - A.s0) / 2, hz: A.depth / 2 }]);
    }

    // ---- the bush island after the last bay: a low kerb, soil, a clump of bushes
    {
      const I = ISLAND, [x, z] = F.at(I.s, I.n), y = g([x, z]);
      p.add(new THREE.CylinderGeometry(1, 1, 0.6, 22).scale(I.hu, 1, I.hv), COL.kerb, x, y - 0.12, z, F.yaw);
      p.add(new THREE.CylinderGeometry(1, 1, 0.6, 22).scale(I.hu - 0.2, 1, I.hv - 0.2), COL.soil, x, y - 0.09, z, F.yaw);
      const blobs = [[-0.9, 0.2, 1.15, 0], [0.5, -0.2, 1.3, 1], [1.3, 0.35, 0.95, 2], [-0.1, 0.5, 1.0, 2], [-1.7, -0.25, 0.8, 1]];
      for (const [s, n, r, c] of blobs) {
        const [bx, bz] = F.at(I.s + s, I.n + n);
        p.add(new THREE.IcosahedronGeometry(r, 1).scale(1.15, 0.85, 1), COL.bush[c], bx, y + r * 0.7, bz, F.yaw + c);
      }
      world.addSolids([{ x, z, yaw: F.yaw, hx: I.hu - 0.35, hz: I.hv - 0.3 }]);
    }

    const m = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }

  // parked cars: the real models standing still, each on the ground under its wheels and solid
  function parkCars(F) {
    const up = new THREE.Vector3(0, 1, 0), qYaw = new THREE.Quaternion(), qTilt = new THREE.Quaternion();
    PARKED.forEach((c, k) => {
      const [x, z] = F.at(BAYS.s0 + BAYS.step * (c.bay + 0.5), (BAYS.n0 + BAYS.n1) / 2 + 0.1);
      const yaw = Math.atan2(-F.nx, F.nz) + c.turn;                  // nose to the building: forward = (sin yaw, -cos yaw)
      const fx = Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = Math.sin(yaw);
      world.addSolids([{ x, z, yaw: Math.atan2(-fz, fx), hx: c.hl, hz: c.hw }]);
      // one car at a time, so that building them does not hold a frame for long
      setTimeout(() => {
        const model = buildCarModel(c.id, c.opts);
        model.setLights({ headlights: false });
        const h = (l, t) => world.heightAt(x + fx * l + rx * t, z + fz * l + rz * t);
        const fl = h(c.wb / 2, -0.78), fr = h(c.wb / 2, 0.78), rl = h(-c.wb / 2, -0.78), rr = h(-c.wb / 2, 0.78);
        const nrm = new THREE.Vector3(0, 1, 0)
          .addScaledVector(new THREE.Vector3(fx, 0, fz), -(fl + fr - rl - rr) / 2 / c.wb)
          .addScaledVector(new THREE.Vector3(rx, 0, rz), -(fr + rr - fl - rl) / 2 / 1.56).normalize();
        qYaw.setFromAxisAngle(up, -yaw);
        qTilt.setFromUnitVectors(up, nrm);
        model.group.quaternion.copy(qTilt).multiply(qYaw);
        model.group.position.set(x, (fl + fr + rl + rr) / 4, z);
        model.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        group.add(model.group);
      }, 400 * (k + 1));
    });
  }

  function build() {
    built = true;
    // ---- the diamond paving: a grid over the street, clipped at buildings, uv in the street's own axes
    {
      const pos = [], uv = [];
      const D = DIAMOND, [ox, oz] = track.P[D.i0], [ax, az] = tanAt((D.i0 + D.i1) / 2);
      for (let i = D.i0; i < D.i1; i++) {
        const fade0 = Math.min(1, (i - D.i0 + 1) / 2), fade1 = Math.min(1, (D.i1 - i) / 3);
        const side = (k, lat) => {
          const [tx, tz] = track.tan[k];
          return [track.P[k][0] - tz * lat, track.P[k][1] + tx * lat];
        };
        for (let lat = D.left; lat < D.right; lat += 1) {
          if (fade0 * fade1 < 1 && Math.abs(lat + 0.5) > track.HW[i] + 0.5) continue;
          const c = side(i, lat + 0.5);
          if (world.sdfAt(c[0], c[1]) < 0.3) continue;
          const p = [side(i, lat), side(i, lat + 1), side(i + 1, lat), side(i + 1, lat + 1)];
          const V = (q) => {
            const dx = q[0] - ox, dz = q[1] - oz;
            pos.push(q[0], world.heightAt(q[0], q[1]) + 0.07, q[1]);
            const a = dx * ax + dz * az, b = dx * -az + dz * ax;          // along and across the street
            uv.push((a + b) / Math.SQRT2 / D.period, (a - b) / Math.SQRT2 / D.period);
          };
          V(p[0]); V(p[1]); V(p[2]); V(p[2]); V(p[1]); V(p[3]);
        }
      }
      meshFrom(pos, new THREE.MeshLambertMaterial({ map: diamondTex(), polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide }), uv);
    }
    // ---- zebras on the lap and over Ülikooli
    const pos = [];
    for (const z of ZEBRAS) {
      const [cx, cz] = lerpP(z.i), [ux, uz] = tanAt(z.i);
      zebra(pos, cx, cz, ux, uz, track.HW[Math.round(z.i)] - 0.2, z.w);
    }
    for (const z of SIDE_ZEBRAS) zebra(pos, z.c[0], z.c[1], ULIKOOLI[0], ULIKOOLI[1], z.half, 3.4);
    meshFrom(pos, markMat);
    // ---- in front of the building: plain paved patch where the front steps back, the bay lines
    const F = wallOf(WALLS.front), B = wallOf(WALLS.back);
    {
      const patch = [], [cx, cz] = B.at(1.4, 3.6);
      quad(patch, cx, cz, B.ux, B.uz, 3.4, 3.6, 0.075);
      meshFrom(patch, new THREE.MeshLambertMaterial({ color: COL.patch, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5, side: THREE.DoubleSide }));
      const lines = [], Y = BAYS;
      const line = (p, q) => {
        const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
        quad(lines, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, dx / len, dz / len, len / 2, Y.w / 2, 0.08);
      };
      const last = Y.s0 + Y.step * (Y.n - 1);
      line(F.at(Y.lineFrom, Y.n0), F.at(last, Y.n0));                       // along the walkway
      line(F.at(Y.lineFrom - 5.6, Y.n0 + 2.2), F.at(Y.lineFrom, Y.n0));     // from the corner kerb
      for (let k = 0; k < Y.n; k++) line(F.at(Y.s0 + Y.step * k, Y.n0), F.at(Y.s0 + Y.step * k, Y.n1));
      meshFrom(lines, markMat);
    }
    buildLeft(F, B);
    parkCars(F);
    // ---- street names along the lane, read from behind, letter tops to the left
    for (const n of NAMES) {
      const [px, pz] = lerpP(n.i), [tx, tz] = tanAt(n.i);
      const x = px - tz * n.lat, z = pz + tx * n.lat;
      const g = new THREE.PlaneGeometry(5.0, 1.3, 6, 1);
      g.rotateX(-Math.PI / 2);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const lx = p.getX(k), lz = p.getZ(k), wx = x + tx * lx - tz * lz, wz = z + tz * lx + tx * lz;
        p.setXYZ(k, wx, world.heightAt(wx, wz) + 0.085, wz);
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: nameTex(n.text), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7 }));
      m.receiveShadow = true;
      group.add(m);
    }
  }

  const ref = track.P[2318];
  return {
    update(x, z) {
      if (built || Math.hypot(ref[0] - x, ref[1] - z) > 700) return;
      if ([2296, 2318, 2346].every((i) => world.ready(...track.P[i])) && SIDE_ZEBRAS.every((s) => world.ready(...s.c))
        && Object.values(WALLS).every((w) => world.ready(...w.a) && world.ready(...w.b))) build();
    },
  };
}
