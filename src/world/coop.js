// Coop Konsum at Aruküla tee 7 in Kvissentali, built by hand from Martin's photos, Street View and the Land
// Board's oblique photos in place of the map's block: the navy ribbed front with the raised white
// "coop | Konsum 9-22" and BENU letters, the white side wall of triangle-scored panels with the big coop
// letters, the entrance canopy hung on rods with its icicle lights, the glazed sliding doors, parcel lockers,
// bike racks and bins, the pale flat roof with its hatches and vents, and the car park: bay lines, the
// hatched walkways, two pale islands, blue, pink and green bays, lamp posts, young staked trees, the grass
// bank down to Aruküla tee and the crossing of the side road.
// Everything is measured in the shop's own frame: e metres along the front (east +), n metres north, from the
// front's west corner; y above the paving at the door. The car park is square to this frame.
import * as THREE from 'three';
import { streetKit, addHouseColours, GRASS } from './streetkit.js';
import { Parts, BOX } from '../race/landmarks.js';
import { realTreeKit } from './scenery.js';

const A = [527.4, 481.4], ROT = Math.atan2(-5.1, 45.15), C = Math.cos(ROT), S = Math.sin(ROT);
const at = (e, n) => [A[0] + e * C + n * S, A[1] + e * S - n * C];
const local = (x, z) => [(x - A[0]) * C + (z - A[1]) * S, (x - A[0]) * S - (z - A[1]) * C];
const W = 45.44, D = 37.6, NW = [2.93, 37.56];      // the footprint is a trapezoid: the west wall follows the road
const ROOF = 5.05, REAR = 5.3, FRONT = 6.25, RAKE = 13;      // roof surface, parapet at the back, the tall front, where the side walls reach the low parapet
const CAN = { s0: 9.0, s1: 35.3, y0: 3.17, y1: 3.78, d: 2.25 };      // the entrance canopy
const DOOR = { s0: 12.6, s1: 16.5, y1: 2.95 };
const COL = {
  navy: 0x323a5a, navyDark: 0x262c44, white: 0xf1eee8, concrete: 0xb9b6b8, roof: 0xdcdde3, cap: 0x23283a, metal: 0xaeb2bc,
  frame: 0x23252b, black: 0x1b1c20, orange: 0xf0742a, kerb: 0xd9d5d2, grass: GRASS.hex, wood: 0xc9a274, letter: 0xf6f5f2,
};
// the footpath between the bank and the car park leans with the road: its centre line at n
const pathE = (n) => -3.0 + (n + 10) * 0.064;
const HEADING = (fe, fn) => Math.atan2(fe * C + fn * S, -(fe * S - fn * C));       // a car's yaw for a direction in the shop's frame
const BEARING = (fe, fn) => (HEADING(fe, fn) * 180) / Math.PI;                      // the same as a compass bearing for props

// ---- bays. Row A along the west edge, two double rows with a hatched walkway beside each, row D along the east edge
const ROW_A = { e0: 1.0, e1: 5.3, n0: -19.5, step: 2.8, count: 15 };
const ROW_1 = { e0: 12.3, mid: 17.2, e1: 22.2, n0: -19.3, step: 2.73, count: 14 };
const ROW_2 = { e0: 30.1, mid: 34.6, e1: 39.5, n0: -19.5, step: 2.7, count: 16 };
const ROW_D = { e0: 46.3, e1: 50.8, n0: -18.48, step: 2.72, count: 16 };
const bay = (row, k) => row.n0 - row.step * (k + 0.5);

// cars in the bays: [x, z, yaw, model, paint, lift] (stood there by parked.js like every other parked car)
const car = (e, n, fe, id, paint) => [...at(e, n), HEADING(fe, 0), id, paint, 0.04];
export const COOP_CARS = [
  car(3.2, bay(ROW_A, 0), -1, 'passat', 'grey'), car(3.2, bay(ROW_A, 3), 1, 'rav4', 'black'),
  car(14.7, bay(ROW_1, 0), -1, 'rav4', 'white'), car(19.75, bay(ROW_1, 1), 1, 'passat', 'black'), car(14.7, bay(ROW_1, 2), 1, 'mazda6', 'white'),
  car(14.7, bay(ROW_1, 6), -1, 'mazda6', 'blue'),
  car(32.3, bay(ROW_2, 0), 1, 'rav4', 'black'), car(32.3, bay(ROW_2, 2), -1, 'bz4x', 'white'), car(37.0, bay(ROW_2, 1), -1, 'passat', 'silver'),
  car(37.0, bay(ROW_2, 4), 1, 'mazda6', 'red'), car(48.5, bay(ROW_D, 7), 1, 'f31', 'black'),
  car(48.5, -21.6, 1, 'bz4x', 'silver'),         // on charge in the first green bay
];

// lamp posts: two-armed ones down the middle of the double rows, single ones along the edges
const LAMPS = [
  [17.2, -13.8, 2], [34.6, -14.0, 2], [17.2, -37.0, 2], [34.6, -38.4, 2], [17.2, -58.6, 2], [34.6, -63.6, 2],
  [0.2, -24.0, 1], [0.1, -44.0, 1], [51.6, -11.0, -1], [51.6, -33.0, -1], [51.6, -55.0, -1],
];
export function coopProps() {
  const out = [];
  for (const [e, n, arms] of LAMPS) {
    if (arms === 2) out.push([0, ...at(e, n), BEARING(0, 1)], [0, ...at(e, n), BEARING(0, -1)]);
    else out.push([0, ...at(e, n), BEARING(arms, 0)]);
  }
  return out;
}
// the map's stray poles and lamps on the plot (some stand inside the shop) make way for the ones above
export function coopClear(data) {
  const out = [];
  for (const key of ['2_1', '2_2']) {
    const a = data.sectors[key] || [];
    for (let k = 0; k < a.length; k += data.stride) {
      const [e, n] = local(a[k + 1], a[k + 2]);
      if (a[k] < 10 && e > -3 && e < 54 && n > -68 && n < 40) out.push(`${key}:${k / data.stride}`);
    }
  }
  return out;
}

export function coopWalls(walls) {
  if (!walls || !walls.sectors) return;
  // the map's block is hidden: the colour survey already lists it several times over, so those entries are marked
  const a = walls.sectors['2_1'] || [], extra = ((walls.extra ||= {})['2_1'] ||= {});
  for (let i = 0; i < a.length; i += 4) {
    const [e, n] = local(480 + a[i + 1] * 0.1, -160 + a[i + 2] * 0.1);
    if (a[i] === 1208 && e > -2 && e < 48 && n > -3 && n < 40) extra[i / 4] = { ...extra[i / 4], hide: true };
  }
  // its entrance canopy lies in the next sector
  addHouseColours(walls, '2_2', 480, 480, [
    { base: 1585, x: 547, z: 480.3, wall: COL.navy, hide: true, reach: 18 },
    { base: 1585, x: 547, z: 480.3, wall: COL.navy, hide: true, reach: 18, shelter: true },
  ]);
  // the arched halls next door: grey sheet metal
  const b = walls.sectors['2_2'] || [], ex2 = ((walls.extra ||= {})['2_2'] ||= {});
  for (let i = 0; i < b.length; i += 4) if ([1312, 1413, 1434, 1446].includes(b[i])) { b[i + 3] = 0xb7bcc6; ex2[i / 4] = { ...ex2[i / 4], roof: 0xa4a9b4 }; }
}
// the map's lit box signs on the west wall give way to the real letters
export function coopSignSkip(world) {
  const prev = world.signSkip;
  world.signSkip = (x, z) => { const [e, n] = local(x, z); return (e > -3 && e < 48 && n > -4 && n < 40) || (prev ? prev(x, z) : false); };
}

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function rnd(seed) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
const FONT = '"Arial Rounded MT Bold", "Nunito", "Trebuchet MS", "Helvetica Neue", Arial, sans-serif';

// the surfaces that carry a pattern: [texture, tile size in metres (u, v)]
function textures() {
  return {
    // navy sheet metal with upright ribs every 12 cm
    rib: [canvasTex(64, 16, (g, w, h) => {
      g.fillStyle = '#323a5a'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 4; k++) {
        g.fillStyle = '#3d4669'; g.fillRect(k * 16 + 1, 0, 6, h);
        g.fillStyle = '#20263c'; g.fillRect(k * 16 + 11, 0, 4, h);
      }
    }), [0.48, 1]],
    // white panels 90 cm wide in courses 1.5 m high, each scored corner to corner so that the lines make tall diamonds
    panel: [canvasTex(256, 512, (g, w, h) => {
      g.fillStyle = '#f1eee8'; g.fillRect(0, 0, w, h);
      const r = rnd(4);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = `rgba(${200 + r() * 30 | 0},${198 + r() * 30 | 0},${196 + r() * 30 | 0},0.18)`; g.fillRect(i * 128, j * 256, 128, 256); }
      g.strokeStyle = 'rgba(96,98,110,0.75)'; g.lineWidth = 1.6;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const x0 = i * 128, y0 = j * 256, up = (i + j) % 2 === 0;
        g.beginPath(); g.moveTo(x0, up ? y0 + 256 : y0); g.lineTo(x0 + 128, up ? y0 : y0 + 256); g.stroke();
      }
      g.strokeStyle = 'rgba(70,72,84,0.9)'; g.lineWidth = 2.4;
      for (const x of [1, 128]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (const y of [1, 256]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    }), [1.8, 3.0]],
  };
}
// the sliding doors: four glass leaves under a transom, lit from inside, posters and the row of dots on the glass
function doorTex() {
  return canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#1d1f25'; g.fillRect(0, 0, w, h);
    const glass = (x, y, ww, hh) => {
      const gr = g.createLinearGradient(0, y, 0, y + hh);
      gr.addColorStop(0, '#d9c9a0'); gr.addColorStop(0.35, '#8fa0b4'); gr.addColorStop(1, '#3d4c66');
      g.fillStyle = gr; g.fillRect(x, y, ww, hh);
    };
    const top = 70;
    for (let k = 0; k < 4; k++) glass(8 + k * 126, 8, 118, top - 14);                 // transom lights
    for (let k = 0; k < 4; k++) {
      const x = 8 + k * 126;
      glass(x, top + 4, 118, h - top - 14);
      g.fillStyle = 'rgba(255,236,190,0.35)'; g.fillRect(x + 8, top + 30, 102, 90);    // the lit shop behind
      g.fillStyle = '#f4f4f4';
      for (let d = 0; d < 3; d++) { g.beginPath(); g.arc(x + 36 + d * 23, 236, 5, 0, 7); g.fill(); }
    }
    g.fillStyle = '#1f6fc4'; g.fillRect(20, 96, 64, 44);                                // blue posters
    g.fillStyle = '#e8eef6'; g.fillRect(28, 104, 48, 8);
    g.fillStyle = '#1f6fc4'; g.fillRect(150, 150, 76, 70);
    g.fillStyle = '#f2f4f6'; g.font = `bold 15px ${FONT}`; g.fillText('AVAME', 160, 172); g.fillText('UKSED', 160, 192);
    g.fillStyle = '#f4f4f4'; g.fillRect(292, 150, 70, 30);
    g.fillStyle = '#1b3a6b'; g.font = `bold 22px ${FONT}`; g.fillText('coop', 300, 173);
    g.fillStyle = '#1d1f25'; g.fillRect(252, top, 8, h);                                // the meeting stiles
  }, false);
}
// strings of small lamps hanging from the canopy's edge, each strand its own length; one tile is 4 m long, 0.5 m high
function icicleTex() {
  return canvasTex(1024, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = rnd(23);
    g.fillStyle = 'rgba(240,240,250,0.9)'; g.fillRect(0, 0, w, 3);
    for (let x = 6; x < w; x += 20) {
      const len = [28, 62, 44, 96, 36, 74][Math.floor(r() * 6)];
      g.fillStyle = 'rgba(210,214,230,0.55)'; g.fillRect(x, 0, 1.5, len);
      for (let y = 8; y <= len; y += 14) {
        g.fillStyle = 'rgba(255,246,214,0.55)'; g.beginPath(); g.arc(x + 0.7, y, 5.5, 0, 7); g.fill();
        g.fillStyle = '#fffdf2'; g.beginPath(); g.arc(x + 0.7, y, 3.2, 0, 7); g.fill();
      }
    }
  });
}
// white raised letters: the text on a clear ground; returns the picture and its width for a letter height of 1
function textTex(text, { plus = false, weight = 'bold' } = {}) {
  const px = 160, pad = 12;
  const m = document.createElement('canvas').getContext('2d');
  m.font = `${weight} ${px}px ${FONT}`;
  const tw = Math.ceil(m.measureText(text).width), w = tw + pad * 2 + (plus ? px * 0.92 : 0), h = px * 1.2;
  const tex = canvasTex(Math.ceil(w), Math.ceil(h), (g) => {
    g.clearRect(0, 0, w, h);
    g.font = `${weight} ${px}px ${FONT}`; g.textBaseline = 'alphabetic'; g.fillStyle = '#ffffff';
    g.fillText(text, pad, px * 0.98);
    if (plus) {       // the chemist's cross with its dark roundel
      const cx = tw + pad + px * 0.46, cy = px * 0.62, a = px * 0.4, b = px * 0.15;
      g.fillRect(cx - a, cy - b, a * 2, b * 2); g.fillRect(cx - b, cy - a, b * 2, a * 2);
      g.fillStyle = '#323a5a'; g.beginPath(); g.arc(cx, cy, px * 0.13, 0, 7); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx + px * 0.03, cy - px * 0.02, px * 0.05, 0, 7); g.fill();
    }
  }, false);
  return { tex, aspect: w / h, cap: px * 0.72 / h };       // cap: a capital's height as a share of the picture's
}
// a parcel locker's front: rows of doors and a screen
function lockerTex(base, line, logo) {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.strokeStyle = line; g.lineWidth = 2;
    for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) if (!(i === 3 && j < 3)) g.strokeRect(6 + i * 62.5, 8 + j * 48, 62.5, 48);
    g.fillStyle = '#20222a'; g.fillRect(200, 40, 50, 40);
    g.fillStyle = '#f6f4f0'; g.font = `bold 44px ${FONT}`; g.fillText(logo, 196, 128);
  }, false);
}
// a feather flag: blue teardrop with the name running up it
function flagTex() {
  return canvasTex(128, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#2f8fe0';
    g.beginPath(); g.moveTo(14, h - 6); g.lineTo(14, 70); g.quadraticCurveTo(18, 6, 70, 8); g.quadraticCurveTo(122, 40, 112, 210); g.quadraticCurveTo(96, 400, 14, h - 6); g.fill();
    g.save(); g.translate(86, 300); g.rotate(-Math.PI / 2);
    g.fillStyle = '#ffffff'; g.font = `bold 62px ${FONT}`; g.fillText('coop', 0, 0); g.restore();
  }, false);
}

// The coop mark as outlines: four fat rings 1.28 high that just touch, the c open to the right, the p with its stem.
// Width 5.9 for scale 1; origin at the left end of the base line (the p's stem drops 0.3 below it).
function coopShapes() {
  const rx = 0.78, ry = 0.64, hx = 0.36, hy = 0.25, out = [];
  const ring = (cx) => { const s = new THREE.Shape(); s.absellipse(cx, ry, rx, ry, 0, Math.PI * 2, false); const hole = new THREE.Path(); hole.absellipse(cx, ry, hx, hy, 0, Math.PI * 2, true); s.holes.push(hole); return s; };
  const c = new THREE.Shape(), a = 0.42, b = 0.75;
  c.absellipse(rx, ry, rx, ry, a, Math.PI * 2 - a, false);
  c.absellipse(rx, ry, hx, hy, Math.PI * 2 - b, b, true);
  out.push(c, ring(2.23), ring(3.68), ring(5.13));
  const stem = new THREE.Shape();
  stem.moveTo(5.13 - rx, -0.3); stem.lineTo(5.13 - rx + 0.44, -0.3); stem.lineTo(5.13 - rx + 0.44, ry); stem.lineTo(5.13 - rx, ry); stem.closePath();
  out.push(stem);
  return out;
}

// the paving at the doors, from the ground along the front
function floorY(world) {
  let y = 0;
  for (const e of [4, 14, 24, 34, 42]) y += world.heightAt(...at(e, -1.2));
  return y / 5 + 0.09;
}

export function createCoop(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function build() {
    built = true;
    // the bank is steep: lawn laid on it follows the ground's own triangles (2 m grid, split like the terrain mesh)
    const triH = (x, z) => {
      const i = Math.floor(x / 2), j = Math.floor(z / 2), fx = x / 2 - i, fz = z / 2 - j, H = (a, b) => world.heightAt(a * 2, b * 2);
      return fx + fz <= 1 ? H(i, j) + (H(i + 1, j) - H(i, j)) * fx + (H(i, j + 1) - H(i, j)) * fz
        : H(i + 1, j + 1) + (H(i, j + 1) - H(i + 1, j + 1)) * (1 - fx) + (H(i + 1, j) - H(i + 1, j + 1)) * (1 - fz);
    };
    const K = streetKit({ heightAt: triH, sdfAt: (x, z) => world.sdfAt(x, z) }, group, { shadows, fenceColour: 0x4a6a58 });
    const FE = { at: (t, lat) => at(t, lat) }, FN = { at: (t, lat) => at(lat, t) }, FP = { at: (t, lat) => at(pathE(t) + lat, t) };
    const Y0 = floorY(world);
    const loc = new THREE.Group();                   // the shop's frame: x = e, z = -n
    loc.position.set(A[0], Y0, A[1]);
    loc.rotation.y = -ROT;
    group.add(loc);
    const gy = (e, n) => world.heightAt(...at(e, n)) - Y0;       // the ground in the shop's heights

    const p = new Parts(), lit = new Parts();        // lit: the white letters, which glow a little
    const add = (geo, hex, to = p) => to.add(geo, hex, 0, 0, 0, 0);
    const box = (e0, e1, n0, n1, y0, y1, hex) => add(BOX(Math.abs(e1 - e0), Math.abs(y1 - y0), Math.abs(n1 - n0)).translate((e0 + e1) / 2, (y0 + y1) / 2, -(n0 + n1) / 2), hex);
    const bar = (a, b, t, hex) => {       // a thin bar between two points (e, y, n)
      const va = new THREE.Vector3(a[0], a[1], -a[2]), vb = new THREE.Vector3(b[0], b[1], -b[2]), d = vb.clone().sub(va), len = d.length();
      const g = BOX(t, len, t);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
      g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
      add(g, hex);
    };

    // ---- walls. A wall runs from its left end to its right end as seen from outside; things on it are placed
    // by s (metres along it), y and `off` (metres out from its face).
    const wallOf = (e0, n0, e1, n1) => {
      const len = Math.hypot(e1 - e0, n1 - n0), ue = (e1 - e0) / len, un = (n1 - n0) / len, oe = un, on = -ue;
      const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(ue, 0, -un), new THREE.Vector3(0, 1, 0), new THREE.Vector3(oe, 0, -on)).setPosition(e0, 0, -n0);
      return { len, M, pt: (s, y, off = 0) => [e0 + ue * s + oe * off, y, n0 + un * s + on * off] };
    };
    const WF = wallOf(0, 0, W, 0), WE = wallOf(W, 0, W, D), WN = wallOf(W, D, NW[0], NW[1]), WW = wallOf(NW[0], NW[1], 0, 0);
    const onWall = (Wl, geo, hex, to = p) => add(geo.applyMatrix4(Wl.M), hex, to);
    // a box on a wall: s0..s1, y0..y1, standing off0..off1 out from it
    const wbox = (Wl, s0, s1, y0, y1, off0, off1, hex) => onWall(Wl, BOX(s1 - s0, y1 - y0, off1 - off0).translate((s0 + s1) / 2, (y0 + y1) / 2, (off0 + off1) / 2), hex);
    const wbar = (Wl, a, b, t, hex) => bar(Wl.pt(...a), Wl.pt(...b), t, hex);

    // patterned surfaces: polygons on a wall with the pattern laid in metres
    const TEX = textures(), quads = {};
    for (const k of Object.keys(TEX)) quads[k] = { pos: [], uv: [] };
    // pts: a convex outline of [s, y] on the wall, `off` out from it
    const skin = (kind, Wl, pts, off = 0.02) => {
      const Q = quads[kind], [tu, tv] = TEX[kind][1];
      for (let k = 1; k < pts.length - 1; k++) for (const q of [pts[0], pts[k], pts[k + 1]]) {
        const v = new THREE.Vector3(q[0], q[1], off).applyMatrix4(Wl.M);
        Q.pos.push(v.x, v.y, v.z); Q.uv.push(q[0] / tu, q[1] / tv);
      }
    };
    const rect = (s0, s1, y0, y1) => [[s0, y0], [s1, y0], [s1, y1], [s0, y1]];
    // a quad in space with the pattern running a -> b (u) and a -> d (v); points (e, y, n)
    const sheet = (kind, a, b, d) => {
      const Q = quads[kind], [tu, tv] = TEX[kind][1];
      const P = [a, b, d].map((q) => new THREE.Vector3(q[0], q[1], -q[2])), c = P[1].clone().add(P[2]).sub(P[0]);
      const u = P[1].distanceTo(P[0]) / tu, v = P[2].distanceTo(P[0]) / tv;
      for (const [q, uu, vv] of [[P[0], 0, 0], [P[1], u, 0], [c, u, v], [P[0], 0, 0], [c, u, v], [P[2], 0, v]]) { Q.pos.push(q.x, q.y, q.z); Q.uv.push(uu, vv); }
    };
    // one picture on a wall (not tiled)
    const pictures = [];
    const picture = (Wl, tex, s0, s1, y0, y1, off, { glow = 0, clear = false, basic = false, repeat = 1 } = {}) => {
      const g = new THREE.PlaneGeometry(s1 - s0, y1 - y0).translate((s0 + s1) / 2, (y0 + y1) / 2, off).applyMatrix4(Wl.M);
      if (repeat !== 1) { const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * repeat); }
      const opts = { map: tex, side: THREE.DoubleSide, alphaTest: clear ? 0.4 : 0, transparent: false };
      const mat = basic ? new THREE.MeshBasicMaterial({ ...opts, toneMapped: false })
        : new THREE.MeshLambertMaterial({ ...opts, emissive: glow ? 0xffffff : 0x000000, emissiveMap: glow ? tex : null, emissiveIntensity: glow });
      pictures.push(new THREE.Mesh(g, mat));
    };
    // raised letters from a picture: a few layers one behind the other; cap: the capitals' height in metres. Returns the right end.
    const letters = (Wl, T, s0, yBase, cap) => {
      const h = cap / T.cap, w = h * T.aspect, y0 = yBase - h * (1 - 0.98 / 1.2);
      for (const off of [0.035, 0.06, 0.085, 0.11]) picture(Wl, T.tex, s0, s0 + w, y0, y0 + h, off, { clear: true, glow: 0.35 });
      return s0 + w;
    };
    // the coop mark, raised: left end s0, base line y, k times life size (1: 5.9 m wide)
    const mark = (Wl, s0, y, k, depth) => {
      const g = new THREE.ExtrudeGeometry(coopShapes(), { depth: depth / k, bevelEnabled: false, curveSegments: 14 });
      onWall(Wl, g.scale(k, k, k).translate(s0, y, 0.03), COL.letter, lit);
    };

    // ================= the shell =================
    {
      const foot = new THREE.Shape();
      foot.moveTo(0, 0); foot.lineTo(W, 0); foot.lineTo(W, D); foot.lineTo(NW[0], NW[1]); foot.closePath();
      add(new THREE.ExtrudeGeometry(foot, { depth: ROOF + 1.5, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -1.5, 0), COL.navyDark);
      const top = new THREE.Shape();
      top.moveTo(0.35, 0.35); top.lineTo(W - 0.35, 0.35); top.lineTo(W - 0.35, D - 0.35); top.lineTo(NW[0] + 0.35, NW[1] - 0.35); top.closePath();
      add(new THREE.ExtrudeGeometry(top, { depth: 0.06, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, ROOF, 0), COL.roof);
      // parapets: the tall front, the sides raking down from it, the low back
      const slab = (Wl, pts, thick, hex, off = 0) => {
        const s = new THREE.Shape();
        pts.forEach((q, k) => (k ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])));
        onWall(Wl, new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false }).translate(0, 0, off - thick), hex);
      };
      slab(WF, rect(0, W, ROOF, FRONT), 0.34, COL.navyDark);
      slab(WE, [[0, ROOF], [D, ROOF], [D, REAR], [RAKE, REAR], [0, FRONT]], 0.3, COL.navyDark);
      slab(WN, rect(0, WN.len, ROOF, REAR), 0.3, COL.navyDark);
      slab(WW, [[0, ROOF], [WW.len, ROOF], [WW.len, FRONT], [WW.len - RAKE, REAR], [0, REAR]], 0.3, 0xdedbd6);
      // dark metal capping along the tops
      slab(WF, rect(-0.04, W + 0.04, FRONT, FRONT + 0.06), 0.42, COL.cap, 0.04);
      slab(WN, rect(-0.04, WN.len + 0.04, REAR, REAR + 0.05), 0.38, COL.cap, 0.04);
      for (const [Wl, a, b, c] of [[WE, [0, FRONT], [RAKE, REAR], [D, REAR]], [WW, [WW.len, FRONT], [WW.len - RAKE, REAR], [0, REAR]]]) {
        wbar(Wl, [a[0], a[1] + 0.03, -0.15], [b[0], b[1] + 0.03, -0.15], 0.07, COL.cap);
        wbar(Wl, [b[0], b[1] + 0.03, -0.15], [c[0], c[1] + 0.03, -0.15], 0.07, COL.cap);
      }
      // the concrete plinth all round, deeper where the ground falls away to the west
      slab(WF, rect(-0.03, W + 0.03, -1.5, 0.35), 0.1, COL.concrete, 0.05);
      slab(WE, rect(-0.03, D + 0.03, -1.5, 0.35), 0.1, COL.concrete, 0.05);
      slab(WN, rect(-0.03, WN.len + 0.03, -1.5, 0.35), 0.1, COL.concrete, 0.05);
      slab(WW, rect(-0.03, WW.len + 0.03, -2.5, 0.6), 0.1, COL.concrete, 0.05);
    }
    // navy ribbed sheet on the front, the east side and the back
    skin('rib', WF, rect(0, W, 0.35, FRONT));
    skin('rib', WE, rect(0, D, 0.35, REAR)); skin('rib', WE, [[0, REAR], [RAKE, REAR], [0, FRONT]]);
    skin('rib', WN, rect(0, WN.len, 0.35, REAR));
    // the white side wall to the road
    skin('panel', WW, rect(0, WW.len, 0.6, REAR)); skin('panel', WW, [[WW.len - RAKE, REAR], [WW.len, REAR], [WW.len, FRONT]]);
    // corner trims
    wbox(WF, -0.03, 0.05, 0.35, FRONT, 0, 0.05, COL.cap); wbox(WF, W - 0.05, W + 0.03, 0.35, FRONT, 0, 0.05, COL.cap);
    // back doors and a goods door, so the back is not blank
    wbox(WN, 6, 7.1, 0.1, 2.25, 0, 0.06, 0x8f939c); wbox(WN, 20, 23.2, 0.1, 3.3, 0, 0.06, 0x9a9ea8); wbox(WE, 30, 31.1, 0.1, 2.25, 0, 0.06, 0x8f939c);

    // ================= letters =================
    mark(WF, 3.0, 4.52, 1, 0.22);                                              // coop
    wbox(WF, 9.32, 9.42, 4.5, 5.72, 0.03, 0.12, COL.letter);                   // |
    lit.add(BOX(0.1, 1.22, 0.09).translate(9.37, 5.11, 0.075).applyMatrix4(WF.M), COL.letter, 0, 0, 0, 0);
    const T = { konsum: textTex('Konsum'), hours: textTex('9-22'), benu: textTex('BENU', { plus: true }) };
    letters(WF, T.konsum, 9.75, 4.72, 0.86);
    letters(WF, T.hours, 15.35, 4.42, 1.12);
    letters(WF, T.benu, 2.9, 2.95, 0.64);
    mark(WW, WW.len - 12.3, 2.55, 1.72, 0.3);                                  // the big one on the white wall

    // ================= canopy, doors, lights =================
    {
      const c = CAN;
      skin('panel', WF, rect(c.s0 + 0.1, c.s1 - 0.1, 0.35, c.y0), 0.045);     // white panels under the canopy
      wbox(WF, c.s0, c.s1, c.y0, c.y1, 0, c.d, COL.navyDark);
      wbox(WF, c.s0 - 0.03, c.s1 + 0.03, c.y1, c.y1 + 0.05, 0, c.d + 0.03, 0x3a4058);             // its dark top, a little proud
      wbox(WF, c.s0 + 0.04, c.s1 - 0.04, c.y0 - 0.03, c.y0 + 0.01, 0.02, c.d - 0.04, 0xf4f2ee);   // white soffit
      const f = (s, off) => WF.pt(s, c.y0, off), up = c.y1 - c.y0;
      const face = (a, b) => sheet('rib', [a[0], a[1], a[2]], [b[0], b[1], b[2]], [a[0], a[1] + up, a[2]]);
      face(f(c.s0, c.d + 0.012), f(c.s1, c.d + 0.012)); face(f(c.s0 - 0.012, 0), f(c.s0 - 0.012, c.d)); face(f(c.s1 + 0.012, c.d), f(c.s1 + 0.012, 0));
      // the rods it hangs on
      for (let k = 0; k < 7; k++) { const s = c.s0 + 0.5 + (k * (c.s1 - c.s0 - 1)) / 6; wbar(WF, [s, c.y1 + 0.03, c.d - 0.12], [s, 5.0, 0.04], 0.045, 0x3a3f52); wbox(WF, s - 0.07, s + 0.07, 4.93, 5.07, 0.02, 0.07, 0x3a3f52); }
      // downlights in the soffit
      for (let s = c.s0 + 1.6; s < c.s1 - 1; s += 3.1) wbox(WF, s - 0.09, s + 0.09, c.y0 - 0.045, c.y0 - 0.03, 1.0, 1.18, 0xfff3d0);
      // the doors
      const d = DOOR;
      wbox(WF, d.s0 - 0.09, d.s1 + 0.09, 0, d.y1 + 0.09, 0, 0.075, COL.frame);
      picture(WF, doorTex(), d.s0, d.s1, 0.03, d.y1, 0.085, { glow: 0.45 });
      wbox(WF, d.s0 - 0.3, d.s1 + 0.3, -0.2, 0.012, 0.05, 1.3, 0x5c5e68);                         // the door mat
      // icicle lights along the front edge and both ends
      const ice = icicleTex();
      picture(WF, ice, c.s0, c.s1, c.y0 - 0.5, c.y0, c.d + 0.02, { clear: true, basic: true, repeat: (c.s1 - c.s0) / 4 });
      for (const s of [c.s0, c.s1]) {
        const g = new THREE.PlaneGeometry(c.d, 0.5).rotateY(-Math.PI / 2).translate(s, c.y0 - 0.25, c.d / 2).applyMatrix4(WF.M);
        const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * (c.d / 4));
        pictures.push(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: ice, side: THREE.DoubleSide, alphaTest: 0.4, toneMapped: false })));
      }
      // a camera and the red alarm sounder on the white wall
      wbox(WF, c.s0 + 0.5, c.s0 + 0.72, 2.75, 2.87, 0.05, 0.3, 0xe9e9ec); wbox(WF, 22.4, 22.56, 2.6, 2.76, 0.05, 0.12, 0xc8342c);
    }

    // ================= along the front: bin, flags, racks, lockers =================
    {
      const cyl = (s, off, r, h, hex, y0 = 0) => onWall(WF, new THREE.CylinderGeometry(r, r, h, 14).translate(s, y0 + h / 2, off), hex);
      cyl(17.3, 0.55, 0.22, 0.85, 0x9a9da6); cyl(17.3, 0.55, 0.24, 0.05, 0x3a3c44, 0.85); cyl(17.3, 0.55, 0.13, 0.04, 0x1b1c20, 0.9);
      cyl(34.2, 0.55, 0.22, 0.85, 0x9a9da6); cyl(34.2, 0.55, 0.24, 0.05, 0x3a3c44, 0.85);
      // feather flags either side of the doors
      const flag = flagTex();
      for (const s of [11.7, 17.9]) {
        cyl(s, 3.3, 0.022, 4.0, 0x2a2c33); cyl(s, 3.3, 0.3, 0.04, 0x2a2c33);
        picture(WF, flag, s - 0.06, s + 0.74, 0.75, 3.95, 3.3, { clear: true });
      }
      // bike racks: a row of black hoops out on the paving
      for (let k = 0; k < 9; k++) {
        const s = 26.6 + k * 0.82;
        wbar(WF, [s, 0, 3.0], [s, 0.82, 3.0], 0.05, COL.black); wbar(WF, [s, 0, 3.95], [s, 0.82, 3.95], 0.05, COL.black); wbar(WF, [s, 0.82, 2.98], [s, 0.82, 3.97], 0.05, COL.black);
      }
      wbar(WF, [26.5, 0.03, 3.0], [33.3, 0.03, 3.0], 0.05, COL.black); wbar(WF, [26.5, 0.03, 3.95], [33.3, 0.03, 3.95], 0.05, COL.black);
      // parcel lockers: the orange one under its own little roof, a white one beside it
      wbox(WF, 36.5, 40.3, 0.04, 2.12, 0.05, 0.85, COL.orange); wbox(WF, 36.4, 40.4, 2.12, 2.22, 0, 1.15, 0x8e929c);
      picture(WF, lockerTex('#f0742a', 'rgba(150,60,10,0.75)', 'O'), 36.52, 40.28, 0.08, 2.1, 0.86);
      wbox(WF, 41.0, 43.3, 0.04, 1.98, 0.05, 0.75, 0xe6e8ec); wbox(WF, 40.95, 43.35, 1.98, 2.05, 0.03, 0.8, 0x3c5a9c);
      picture(WF, lockerTex('#e6e8ec', 'rgba(110,116,130,0.8)', ''), 41.02, 43.28, 0.08, 1.96, 0.76);
    }

    // ================= the roof =================
    {
      const hatch = (e, n, w, d, glass = true) => {       // smoke hatches with a domed light
        box(e - w / 2, e + w / 2, n - d / 2, n + d / 2, ROOF, ROOF + 0.38, 0xb4b8c2);
        if (glass) add(BOX(w - 0.16, 0.2, d - 0.16).translate(e, ROOF + 0.46, -n), 0xc9dfe8);
      };
      for (const [e, n] of [[13, 24.5], [23.5, 29], [33.5, 32.5], [27, 14], [38, 9.5], [9, 33]]) hatch(e, n, 1.9, 1.4);
      hatch(8.2, 7.4, 1.6, 1.6, false); box(7.4, 9.0, 6.6, 8.2, ROOF + 0.38, ROOF + 0.46, 0x4a4d57);                 // the roof hatch
      box(5.2, 6.4, 8.6, 9.4, ROOF, ROOF + 0.7, 0x9a9ea8);                                                         // a fan unit beside it
      for (const [e, n] of [[40.5, 30.5], [41.6, 30.5]]) add(new THREE.CylinderGeometry(0.28, 0.28, 0.8, 12).translate(e, ROOF + 0.4, -n), 0xa9adb6);
      const r = rnd(9);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {       // rust-brown vent caps in loose rows
        const e = 8 + i * 9.6 + (r() - 0.5) * 1.5, n = 5 + j * 8.6 + (r() - 0.5) * 1.5;
        add(new THREE.CylinderGeometry(0.16, 0.16, 0.28, 10).translate(e, ROOF + 0.14, -n), 0x9a5a48);
      }
    }

    // ================= the car park =================
    // flat colour laid on the ground in the shop's frame, in layers: [colour, height above the ground, draw order]
    const LAY = { path: [0xa3a1ae, 0.05, -2], asphalt: [0x9d9ba9, 0.035, -3], blue: [0x86b4e8, 0.042, -4], pink: [0xeaa9a9, 0.042, -4], green: [0xa6dfc2, 0.042, -4], white: [0xf3f1f7, 0.05, -6] };
    const lay = {};
    for (const k of Object.keys(LAY)) lay[k] = [];
    const patch = (kind, e0, e1, n0, n1, map = (e, n) => [e, n]) => {
      const cell = kind === 'path' ? 1 : 2, ne = Math.max(1, Math.ceil(Math.abs(e1 - e0) / cell)), nn = Math.max(1, Math.ceil(Math.abs(n1 - n0) / cell)), lift = LAY[kind][1];
      const v = (e, n) => { const [x, z] = at(...map(e, n)); return [x, (kind === 'path' ? triH(x, z) : world.heightAt(x, z)) + lift, z]; };
      for (let i = 0; i < ne; i++) for (let j = 0; j < nn; j++) {
        const ea = e0 + ((e1 - e0) * i) / ne, eb = e0 + ((e1 - e0) * (i + 1)) / ne, na = n0 + ((n1 - n0) * j) / nn, nb = n0 + ((n1 - n0) * (j + 1)) / nn;
        const q = [v(ea, na), v(eb, na), v(ea, nb), v(eb, nb)];
        const up = (q[1][2] - q[0][2]) * (q[2][0] - q[0][0]) - (q[1][0] - q[0][0]) * (q[2][2] - q[0][2]) > 0;
        for (const k of up ? [0, 1, 2, 2, 1, 3] : [0, 2, 1, 1, 2, 3]) lay[kind].push(...q[k]);
      }
    };
    // the footpath: fresh asphalt from the crossing up past the shop's side wall (the ground picture has the shop's shadow on it)
    const alongPath = (lat, n) => [pathE(n) + lat, n];
    patch('path', -1.9, 1.9, -65, -6.6, alongPath);
    patch('path', -1.9, 3.4, -6.6, 40, alongPath);
    const LW = 0.06;       // half a painted line's width
    const lineE = (e0, e1, n) => patch('white', e0, e1, n - LW, n + LW), lineN = (e, n0, n1) => patch('white', e - LW, e + LW, n0, n1);
    patch('asphalt', 0.8, 50.9, -64.4, -6.6);
    // coloured bays at the head of the rows: disabled (blue), families (pink), charging (green)
    patch('blue', ROW_A.e0, ROW_A.e1, -18.2, -14.9); patch('blue', ROW_1.e0, ROW_1.e1, -18.9, -15.3);
    patch('pink', ROW_2.e0, ROW_2.e1, -19.1, -15.6); patch('green', ROW_D.e0, ROW_D.e1, -26.6, -18.48);
    for (const e of [ROW_1.e0, 14.75, ROW_1.mid, 19.7, ROW_1.e1]) lineN(e, -18.9, -15.3);
    for (const e of [ROW_2.e0, 32.35, ROW_2.mid, 36.95, ROW_2.e1]) lineN(e, -19.1, -15.6);
    lineE(ROW_A.e0, ROW_A.e1, -14.9);
    // bay lines
    for (let k = 0; k <= ROW_A.count; k++) lineE(ROW_A.e0, ROW_A.e1, ROW_A.n0 - k * ROW_A.step);
    for (const R of [ROW_1, ROW_2]) {
      for (let k = 0; k <= R.count; k++) lineE(R.e0, R.e1, R.n0 - k * R.step);
      lineN(R.mid, R.n0 - R.count * R.step, R.n0);
    }
    for (let k = 0; k <= ROW_D.count; k++) lineE(ROW_D.e0, ROW_D.e1, ROW_D.n0 - k * ROW_D.step);
    // hatched walkways from the shop down beside the rows
    for (const [e0, e1, n1] of [[10.7, 12.1, -57.6], [22.4, 23.8, -57.6], [39.7, 41.1, -62.7]]) for (let n = -7.2; n > n1; n -= 1.0) patch('white', e0, e1, n - 0.5, n);
    // the crossing of the side road at the foot of the path
    for (let n = -66.6; n > -77; n -= 1.0) patch('white', -9.4, -5.9, n - 0.5, n);
    // give-way triangles would go here; the arrows on the asphalt are left to the ground picture

    // pale concrete islands at the head of the double rows, grass islands with kerbs at the foot; all solid
    const island = (e0, e1, n0, n1, grass) => {
      const r = Math.min(1.3, (n1 - n0) / 2 - 0.01), s = new THREE.Shape();
      s.moveTo(e0 + r, n0); s.lineTo(e1 - r, n0); s.absarc(e1 - r, n0 + r, r, -Math.PI / 2, 0, false); s.lineTo(e1, n1 - r); s.absarc(e1 - r, n1 - r, r, 0, Math.PI / 2, false);
      s.lineTo(e0 + r, n1); s.absarc(e0 + r, n1 - r, r, Math.PI / 2, Math.PI, false); s.lineTo(e0, n0 + r); s.absarc(e0 + r, n0 + r, r, Math.PI, Math.PI * 1.5, false);
      // each piece follows the ground under it
      const settle = (g) => { const q = g.attributes.position; for (let k = 0; k < q.count; k++) q.setY(k, q.getY(k) + gy(q.getX(k), -q.getZ(k))); return g; };
      const steps = Math.max(1, Math.round((e1 - e0) / 3));
      for (let k = 0; k < steps; k++) {       // cut along its length so that it can bend with the ground
        const a = e0 + ((e1 - e0) * k) / steps, b = e0 + ((e1 - e0) * (k + 1)) / steps, cut = new THREE.Shape();
        const pts = s.getPoints(6).filter((q) => q.x >= a - 1e-6 && q.x <= b + 1e-6);
        if (k > 0) pts.push(new THREE.Vector2(a, n0), new THREE.Vector2(a, n1));
        if (k < steps - 1) pts.push(new THREE.Vector2(b, n0), new THREE.Vector2(b, n1));
        const cx = (a + b) / 2, cn = (n0 + n1) / 2;
        pts.sort((u, v) => Math.atan2(u.y - cn, u.x - cx) - Math.atan2(v.y - cn, v.x - cx));
        pts.forEach((q, i) => (i ? cut.lineTo(q.x, q.y) : cut.moveTo(q.x, q.y)));
        add(settle(new THREE.ExtrudeGeometry(cut, { depth: 0.5, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -0.36, 0)), COL.kerb);
        if (grass) {
          const g = new THREE.ExtrudeGeometry(cut, { depth: 0.05, bevelEnabled: false });
          g.translate(-(e0 + e1) / 2, -cn, 0).scale(1 - 0.36 / (e1 - e0), 1 - 0.36 / (n1 - n0), 1).translate((e0 + e1) / 2, cn, 0);
          add(settle(g.rotateX(-Math.PI / 2).translate(0, 0.12, 0)), COL.grass);
        }
      }
      return { x: at((e0 + e1) / 2, (n0 + n1) / 2)[0], z: at((e0 + e1) / 2, (n0 + n1) / 2)[1], yaw: -ROT, hx: (e1 - e0) / 2 - 0.25, hz: (n1 - n0) / 2 - 0.2 };
    };
    const solids = [
      island(13.0, 21.9, -15.0, -12.4, false), island(29.9, 39.3, -15.4, -12.6, false),
      island(1.0, 22.0, -68.4, -64.6, true), island(30.2, 39.2, -68.6, -65.2, true),
    ];

    // recycling containers and the charging posts at the east edge
    {
      const bell = (e, n, hex) => {
        const y = gy(e, n);
        add(new THREE.CylinderGeometry(0.72, 0.78, 1.25, 14).translate(e, y + 0.625, -n), hex);
        add(new THREE.SphereGeometry(0.72, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1).translate(e, y + 1.25, -n), hex);
        add(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 10).rotateZ(Math.PI / 2).translate(e - 0.75, y + 1.0, -n), COL.black);
      };
      bell(48.0, -15.6, 0xe9c63a); bell(48.9, -17.4, 0x3f9a5c);
      for (const n of [-21.6, -24.3]) { const y = gy(51.0, n); box(50.88, 51.12, n - 0.16, n + 0.16, y, y + 1.45, 0xeef0f2); box(50.86, 51.14, n - 0.17, n + 0.17, y + 1.05, y + 1.3, 0x35a56a); }
      solids.push({ x: at(48.45, -16.5)[0], z: at(48.45, -16.5)[1], yaw: -ROT, hx: 1.2, hz: 1.7 });
    }

    // ================= ground: paving, grass, fence =================
    K.ribbon(FE, 0, 46.3, -6.6, 0, 'paver', true);                       // the paved apron along the front
    K.ribbon(FE, 0.8, 5.6, -14.6, -6.6, 'paver', true);                  // its pocket at the west end
    K.ribbon(FE, 46.3, 50.9, -18.4, -4, 'paver', true);
    K.ribbon(FP, -64, -15, 1.9, 3.6, 'lawn', true);                      // the strip between the path and the car park
    K.ribbon(FP, -64, 42, -13.2, -1.9, 'lawn', true);                    // the bank down to Aruküla tee
    K.ribbon(FN, -64, -4, 51.0, 53.0, 'lawn', true);                     // the east edge
    K.fence(FN, -64, -4, 52.2, 1.5, 0x4a6a58);
    K.finish();

    // ================= young trees, each between two stakes =================
    const kit = realTreeKit(), r = rnd(31);
    const trees = [];
    for (const n of [-21, -28.5, -36, -43.5, -51, -58.5]) trees.push([pathE(n) + 2.75, n]);                     // the strip by the car park
    for (let n = -60; n < 40; n += 8.2) trees.push([pathE(n) - 3.1, n + r() * 1.5]);                             // the top of the bank
    for (let n = -52; n < 36; n += 12.3) trees.push([pathE(n) - 6.8, n + r() * 1.5]);                             // a second row down the bank
    for (const e of [3.5, 8.5, 13.5, 18.5]) trees.push([e, -66.5]);
    for (const e of [32.6, 36.8]) trees.push([e, -66.9]);
    const list = trees.map(([e, n]) => [e, n, 3.0 + r() * 1.3, 1.15 + r() * 0.5, r()]);
    for (const [e, n, , , t] of list) {
      const y = gy(e, n) + (n < -64 ? 0.15 : 0), a = t * 3;
      for (const s of [-1, 1]) { const de = Math.cos(a) * 0.36 * s, dn = Math.sin(a) * 0.36 * s; bar([e + de, y - 0.2, n + dn], [e + de, y + 1.25, n + dn], 0.06, COL.wood); }
      bar([e - Math.cos(a) * 0.36, y + 1.1, n - Math.sin(a) * 0.36], [e + Math.cos(a) * 0.36, y + 1.1, n + Math.sin(a) * 0.36], 0.035, 0x2c2d33);
    }
    const plant = (sp, items) => {
      if (!sp || !sp.near) return false;
      const im = new THREE.InstancedMesh(sp.near, sp.soloMat, items.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
      items.forEach((t, k) => {
        const [x, z] = at(t[0], t[1]);
        m.compose(new THREE.Vector3(x, world.heightAt(x, z) - 0.05 + (t[1] < -64 ? 0.15 : 0), z), q.setFromAxisAngle(up, t[4] * 6.283), new THREE.Vector3(t[3], t[2], t[3]));
        im.setMatrixAt(k, m);
        im.setColorAt(k, col.setScalar(0.92 + t[4] * 0.14));
      });
      im.castShadow = shadows;
      im.frustumCulled = false;
      group.add(im);
      return true;
    };
    const half = list.filter((_, k) => k % 2 === 0), rest = list.filter((_, k) => k % 2 === 1);
    const ok = plant(kit && kit.species[1], half) && plant(kit && (kit.species[2] || kit.species[1]), rest);
    if (!ok) for (const [e, n, h, w] of list) {       // the simple trees
      const y = gy(e, n);
      add(new THREE.CylinderGeometry(0.04, 0.06, h * 0.6, 6).translate(e, y + h * 0.3, -n), 0x6b5444);
      add(new THREE.IcosahedronGeometry(w / 2, 1).scale(1, 1.25, 1).translate(e, y + h * 0.7, -n), 0x7fbf6a);
    }

    // ---- assemble
    for (const k of Object.keys(quads)) {
      const Q = quads[k];
      if (!Q.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(Q.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(Q.uv, 2));
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: TEX[k][0], side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
      mesh.receiveShadow = true;
      loc.add(mesh);
    }
    for (const m of pictures) loc.add(m);
    const body = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    body.castShadow = shadows; body.receiveShadow = true;
    loc.add(body);
    const glowing = lit.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: 0.3 }));
    glowing.castShadow = shadows;
    loc.add(glowing);
    for (const k of Object.keys(lay)) {
      if (!lay[k].length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(lay[k], 3));
      const nor = new Float32Array(lay[k].length);
      for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      const f = LAY[k][2];
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: LAY[k][0], side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f }));
      m.receiveShadow = true;
      group.add(m);
    }

    // ---- what a car cannot drive through (the shop itself is solid in the map already)
    const solid = (e, n, he, hn) => { const [x, z] = at(e, n); return { x, z, yaw: -ROT, hx: he, hz: hn }; };
    world.addSolids([
      ...solids,
      solid(38.4, -0.55, 1.95, 0.5), solid(42.15, -0.45, 1.2, 0.4),       // lockers
      solid(29.9, -3.5, 3.5, 0.55),                                       // bike racks
    ]);
  }

  return {
    update(car) {
      if (built || !car) return;
      const c = at(22, -20);
      if (Math.hypot(car.x - c[0], car.z - c[1]) > 520) return;
      if ([[0, 0], [45, 38], [-18, 44], [-18, -76], [52, -70], [52, 0]].every((q) => world.ready(...at(q[0], q[1])))) build();
    },
  };
}
