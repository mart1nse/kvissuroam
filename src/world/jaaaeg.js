// Äksi, Saadjärve 20: the Ice Age Centre (Jääaja Keskus) on the shore of Saadjärv, built by hand from Martin's
// Street View pictures and the Land Board's oblique photos in place of the map's block: the tall hall with its
// white end wall and the mammoth, the grey faceted long wall with three purple banners, the sun panels on the
// roof, the lower entrance block with its oval window and the canopy on rods, and the wing towards the lake.
// Next to it the white Järve building keeps the map's shape (its roofs are too many to draw by hand) but gets
// its real colours, windows, porch, the row of walking figures and its sign. In front: boulders, the stone bed
// under the banners, the flag, globe lamps and parked cars.
// On the lake the two pontoon piers, wide enough for a car and reached without a step: each starts as a ramp
// that leaves the ground level with it. The long one has the bathing platform on its side.
// Everything on land is measured in the hall's own frame: e metres along its south wall (east +), n metres
// north along its west wall, from the south-west corner; y above the car park at the long wall.
import * as THREE from 'three';
import { addHouseColours, leafyPlants } from './streetkit.js';
import { Parts, BOX } from '../race/landmarks.js';

const A = [-1930.1, -13218.8], ROT = Math.atan2(-9.1, 21.5), C = Math.cos(ROT), S = Math.sin(ROT);
const at = (e, n) => [A[0] + e * C + n * S, A[1] + e * S - n * C];
const HEADING = (fe, fn) => Math.atan2(fe * C + fn * S, -(fe * S - fn * C));       // a car's yaw for a direction in the hall's frame
const BEARING = (fe, fn) => (HEADING(fe, fn) * 180) / Math.PI;
const HW = 23.3, HL = 41.2;                    // the hall
const HALL = 11.8, WING = 8.2, ENT = 5.4;      // roof heights: hall, lake wing, entrance block
const SECTOR = '-2_-20', SX0 = -2080, SZ0 = -13600;
const COL = {
  white: 0xf2f1ee, grey: 0xa9a8a7, greyDark: 0x8f8f91, roof: 0x5d5f66, cap: 0x76777c, concrete: 0xb5b2ae, frame: 0x2a2c31,
  glass: 0x2c3a48, metal: 0x9da0a6, door: 0x8c8e93, stone: 0xb7a59c, boulder: 0xe9e7e2, wood: 0xb7a888, woodDark: 0x8d7f66,
  float: 0xd9dbde, purple: 0xb48ccc, lamp: 0xf4f1e4,
};

// ---- the piers, in map coordinates. A deck is a ribbon the cars can stand on (see data.js): the landing ramps
// from the ground down to the pier's height, the pier itself floats level.
const LAKE = 18.82, PIER_Y = 19.4, PIER_HW = 1.8;
const unit = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l, l]; };
const BIG = { shore: [-1959.0, -13290.5], end: [-2017.5, -13322.0], land: 9.5, landHw: 3.5, plat: { s: 23.8, lat0: 1.5, lat1: 8.3, hw: 3.5 } };
const SMALL = { from: [-1930.5, -13334.4], shore: [-1950.5, -13340.5], end: [-1976.0, -13359.5], landHw: 3.0, ramp: 12 };

// ---- the car park. Its bays run east-west on the map: a double row down the middle and a row nose-in to the
// east edge (which runs with the hall, so that row is stepped); a row square to the hedge in the south and
// one square to the Järve building's front.
const BAY = 2.6, EAST = Math.PI / 2;
const MID = { x: -1901, z0: -13252, count: 12, len: 5 };
const EDGE = { e: 66.3, z0: -13266, count: 12, len: 5 };
const edgeX = (z) => A[0] + (EDGE.e - (z - A[1]) * S) / C;         // the east edge of the paving at map z
const HEDGE = { from: [44.5, 7.4], dir: [0.913, 0.408], t0: 2, count: 8, len: 5 };
const JF = { from: [31.24, 66.1], dir: [0.9397, 0.3421], s0: 11.0, step: 2.8, count: 4, off0: 2.8, off1: 7.8 };      // the Järve front

// cars: [x, z, yaw, model, paint, lift] (stood there by parked.js like every other parked car)
const LIFT = 0.03;
const byJarve = (k, id, paint) => { const s = JF.s0 + JF.step * (k + 0.5), o = 5.3; return [...at(JF.from[0] + JF.dir[0] * s + JF.dir[1] * o, JF.from[1] + JF.dir[1] * s - JF.dir[0] * o), HEADING(-JF.dir[1], JF.dir[0]), id, paint, LIFT]; };
const inMid = (k, side, id, paint) => [MID.x + side * 2.5, MID.z0 - BAY * (k + 0.5), side * EAST, id, paint, LIFT];
const atEdge = (k, id, paint) => { const z = EDGE.z0 - BAY * (k + 0.5); return [edgeX(z) - 2.55, z, EAST, id, paint, LIFT]; };
export const JAAAEG_CARS = [
  byJarve(0, 'rav4', 'white'), byJarve(1, 'passat', 'silver'), byJarve(2, 'mazda6', 'grey'), byJarve(3, 'f31', 'black'),
  inMid(7, -1, 'mazda6', 'silver'), inMid(9, 1, 'rav4', 'black'),
  atEdge(4, 'passat', 'red'), atEdge(5, 'mazda6', 'blue'), atEdge(7, 'bz4x', 'silver'),
];

// street lamps round the edge of the car park and on the road up to it
export function jaaaegProps() {
  return [[38, -12, -1, 0], [52, 12.2, 0, 1], [67.8, 52, -1, 0], [63.8, 72, -1, 0]].map(([e, n, fe, fn]) => [0, ...at(e, n).map((v) => +v.toFixed(1)), BEARING(fe, fn)]);
}

export function jaaaegWalls(walls) {
  const c = at(10, 33), j = at(39, 80), w = at(-18.7, 10);
  addHouseColours(walls, SECTOR, SX0, SZ0, [
    { base: 1968, x: c[0], z: c[1], wall: COL.grey, hide: true, reach: 42 },                      // the centre is built by hand
    { base: 2105, x: j[0], z: j[1], wall: 0xf3f0e4, roof: 0x6e625e, reach: 26, plain: true },     // Järve: cream render, brown roof, its own windows
    { base: 2053, x: w[0], z: w[1], wall: 0xf2f1ec, roof: 0x8a8c92, reach: 16 },                  // the white house behind
  ]);
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
const SCRIPT = '"Segoe Script", "Brush Script MT", "Lucida Handwriting", "Apple Chancery", "URW Chancery L", cursive';

// the long wall: big flat triangles in a few greys, like folded paper
function facetTex(seed, nx, ny) {
  return canvasTex(1024, 512, (g, w, h) => {
    const r = rnd(seed), P = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) P.push([(i + (i > 0 && i < nx ? (r() - 0.5) * 0.75 : 0)) * w / nx, (j + (j > 0 && j < ny ? (r() - 0.5) * 0.75 : 0)) * h / ny]);
    const tones = ['#b9b8b6', '#a8a7a6', '#c6c5c2', '#9c9b9b', '#b1b0ae', '#bfbebb'];
    g.lineWidth = 2; g.strokeStyle = 'rgba(226,226,222,0.75)'; g.lineJoin = 'round';
    const tri = (a, b, c) => { g.fillStyle = tones[Math.floor(r() * tones.length)]; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.closePath(); g.fill(); g.stroke(); };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = P[j * (nx + 1) + i], b = P[j * (nx + 1) + i + 1], c = P[(j + 1) * (nx + 1) + i], d = P[(j + 1) * (nx + 1) + i + 1];
      if (r() < 0.5) { tri(a, b, c); tri(b, d, c); } else { tri(a, b, d); tri(a, d, c); }
    }
  }, false);
}
// a banner: purple cloth with paler veins, like ice seen close
function bannerTex(seed) {
  return canvasTex(256, 512, (g, w, h) => {
    const r = rnd(seed);
    g.fillStyle = '#b48ccc'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 9; k++) {
      const x = r() * w, y = r() * h, rad = 50 + r() * 110, gr = g.createRadialGradient(x, y, 4, x, y, rad);
      const pale = r() < 0.6;
      gr.addColorStop(0, pale ? 'rgba(226,204,238,0.75)' : 'rgba(142,98,176,0.7)'); gr.addColorStop(1, 'rgba(180,140,204,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
    g.strokeStyle = 'rgba(240,228,250,0.6)'; g.lineWidth = 2.2;
    for (let k = 0; k < 7; k++) {
      g.beginPath(); let x = 30 + r() * 190, y = 20 + r() * 80; g.moveTo(x, y);
      for (let q = 0; q < 5; q++) { const nx = x + (r() - 0.5) * 90, ny = y + 50 + r() * 60; g.quadraticCurveTo(x + (r() - 0.5) * 80, (y + ny) / 2, nx, ny); x = nx; y = ny; }
      g.stroke();
    }
    g.strokeStyle = 'rgba(120,84,150,0.5)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  }, false);
}
// the centre's mark: a mammoth folded out of pale blue ice, and the name in handwriting under it. 100 px to the metre.
function logoTex() {
  return canvasTex(680, 480, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const body = () => {
      g.beginPath();
      g.moveTo(196, 292); g.lineTo(182, 150); g.quadraticCurveTo(196, 52, 300, 34); g.quadraticCurveTo(372, 6, 438, 44);
      g.quadraticCurveTo(512, 86, 496, 196); g.lineTo(470, 276); g.lineTo(432, 236); g.lineTo(424, 150);
      g.lineTo(398, 262); g.lineTo(352, 298); g.lineTo(336, 168); g.lineTo(300, 180); g.lineTo(262, 290); g.closePath();
    };
    g.fillStyle = '#bfe0f5'; body(); g.fill();
    g.save(); body(); g.clip();
    g.fillStyle = '#8dbbdd'; g.beginPath(); g.moveTo(170, 300); g.lineTo(176, 120); g.lineTo(262, 150); g.lineTo(250, 300); g.fill();
    g.fillStyle = '#a3cbe8'; g.beginPath(); g.moveTo(330, 20); g.lineTo(372, 0); g.lineTo(352, 300); g.lineTo(330, 300); g.fill();
    g.fillStyle = '#d6ecf9'; g.beginPath(); g.moveTo(372, 0); g.lineTo(520, 60); g.lineTo(430, 170); g.fill();
    g.fillStyle = '#9cc6e4'; g.beginPath(); g.moveTo(436, 150); g.lineTo(520, 120); g.lineTo(470, 290); g.lineTo(430, 250); g.fill();
    g.restore();
    g.fillStyle = '#6f8fab'; g.font = `italic 600 96px ${SCRIPT}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText('Jääaja Keskus', w / 2, 434, 600);
  }, false);
}
// dark glass in pale frames; repeated along a strip it gives the mullions
function glassTex(frame = '#dcdcd8') {
  return canvasTex(128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#4d6076'); gr.addColorStop(0.5, '#2c3a4a'); gr.addColorStop(1, '#1f2a36');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(190,214,232,0.16)'; g.beginPath(); g.moveTo(0, h); g.lineTo(w * 0.7, 0); g.lineTo(w, 0); g.lineTo(w * 0.3, h); g.fill();
    g.strokeStyle = frame; g.lineWidth = 9; g.strokeRect(0, 0, w, h);
  });
}
// sun panels: dark blue cells in thin pale lines; one tile is a panel 1.05 m wide and 1.75 m up the slope
function solarTex() {
  return canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#1d2740'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,140,180,0.55)'; g.lineWidth = 1;
    for (let x = 0; x <= w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = '#b9bcc4'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
  });
}
// weathered boards laid across the pier: one tile is 1.2 m along it (eight boards)
function plankTex() {
  return canvasTex(256, 64, (g, w, h) => {
    const r = rnd(12);
    for (let k = 0; k < 8; k++) {
      const v = 0.84 + r() * 0.2;
      g.fillStyle = `rgb(${188 * v | 0},${172 * v | 0},${142 * v | 0})`; g.fillRect(k * 32, 0, 32, h);
      g.fillStyle = 'rgba(70,58,42,0.75)'; g.fillRect(k * 32, 0, 2, h);
      g.fillStyle = 'rgba(96,82,60,0.25)';
      for (let q = 0; q < 5; q++) g.fillRect(k * 32 + 4 + r() * 24, r() * h, 1, 6 + r() * 20);
    }
  });
}
// upright white boards (the balcony over the Järve porch); one tile is 0.36 m wide
function ribTex() {
  return canvasTex(64, 16, (g, w, h) => {
    g.fillStyle = '#f4f2ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c9c6ba'; g.fillRect(0, 0, 5, h); g.fillRect(32, 0, 5, h);
  });
}
// the row of figures on the Järve wall, from a stooped walker to an upright one
function figuresTex() {
  return canvasTex(560, 220, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = g.strokeStyle = '#17181b'; g.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      const x = 48 + k * 92, tall = 104 + k * 17, lean = 0.5 - k * 0.09, base = h - 8;
      const hipY = base - tall * 0.48, hx = x + Math.sin(lean) * tall * 0.36, hy = hipY - Math.cos(lean) * tall * 0.36;
      g.lineWidth = 11; g.beginPath(); g.moveTo(x - 14, base); g.lineTo(x - 3, hipY + tall * 0.2); g.lineTo(x, hipY); g.stroke();
      g.beginPath(); g.moveTo(x + 20, base); g.lineTo(x + 8, hipY + tall * 0.22); g.lineTo(x, hipY); g.stroke();
      g.lineWidth = 19; g.beginPath(); g.moveTo(x, hipY); g.lineTo(hx, hy); g.stroke();
      g.lineWidth = 8; g.beginPath(); g.moveTo(hx, hy + 6); g.lineTo(hx + 18, hy + tall * 0.22); g.lineTo(hx + 30, hy + tall * 0.3); g.stroke();
      g.beginPath(); g.arc(hx + Math.sin(lean) * 15 + 4, hy - 13, 11, 0, 7); g.fill();
      if (k === 2 || k === 4) { g.lineWidth = 4; g.beginPath(); g.moveTo(hx + 30, hy + tall * 0.3 - 44); g.lineTo(hx + 30, base); g.stroke(); }       // a spear
    }
  }, false);
}
// the Järve sign: a white board cut to a point, the name in handwriting
function jarveTex() {
  return canvasTex(360, 200, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#fbfaf6'; g.strokeStyle = '#5a5d66'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(8, 20); g.lineTo(270, 20); g.lineTo(350, 100); g.lineTo(270, 180); g.lineTo(8, 180); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#3c4654'; g.font = `italic 600 92px ${SCRIPT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Järve', 160, 104, 250);
  }, false);
}
// the glazed front under the canopy: tall panes, a double door in the middle, lit from inside
function entranceTex() {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#23262c'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 6; k++) {
      const x = 6 + k * 84.5, gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#c9b78e'); gr.addColorStop(0.4, '#6f8296'); gr.addColorStop(1, '#2f3c4c');
      g.fillStyle = gr; g.fillRect(x, 8, 76, h - 16);
      if (k === 2 || k === 3) { g.fillStyle = '#d7d9dc'; g.fillRect(k === 2 ? x + 64 : x + 6, 120, 6, 50); }       // door handles
    }
    g.fillStyle = '#23262c'; g.fillRect(0, 62, w, 6);
  }, false);
}
// the flag: white, the mark small in the middle
function flagTex() {
  return canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = '#f7f7f4'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8fc0e2'; g.beginPath(); g.moveTo(88, 108); g.lineTo(84, 60); g.quadraticCurveTo(100, 28, 140, 26); g.quadraticCurveTo(178, 34, 172, 76); g.lineTo(162, 104); g.lineTo(150, 70); g.lineTo(138, 106); g.lineTo(126, 66); g.lineTo(112, 108); g.closePath(); g.fill();
    g.fillStyle = '#5d7f9c'; g.font = `italic 600 22px ${SCRIPT}`; g.textAlign = 'center'; g.fillText('Jääaja Keskus', w / 2, 138);
  }, false);
}

export function createJaaaeg(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function build() {
    built = true;
    let Y0 = 0;
    for (const n of [6, 16, 26, 36]) Y0 += world.heightAt(...at(26, n)) / 4;
    Y0 += 0.05;
    const loc = new THREE.Group();                   // the hall's frame: x = e, z = -n
    loc.position.set(A[0], Y0, A[1]);
    loc.rotation.y = -ROT;
    group.add(loc);
    const gy = (e, n) => world.heightAt(...at(e, n)) - Y0;       // the ground in the hall's heights

    const p = new Parts(), glow = new Parts();
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
    // by s (metres along it), y (above y0) and `off` (metres out from its face).
    const wallOf = (e0, n0, e1, n1, y0 = 0) => {
      const len = Math.hypot(e1 - e0, n1 - n0), ue = (e1 - e0) / len, un = (n1 - n0) / len, oe = un, on = -ue;
      const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(ue, 0, -un), new THREE.Vector3(0, 1, 0), new THREE.Vector3(oe, 0, -on)).setPosition(e0, y0, -n0);
      return { len, M, pt: (s, y, off = 0) => [e0 + ue * s + oe * off, y0 + y, n0 + un * s + on * off] };
    };
    const onWall = (Wl, geo, hex, to = p) => add(geo.applyMatrix4(Wl.M), hex, to);
    const wbox = (Wl, s0, s1, y0, y1, off0, off1, hex, to = p) => onWall(Wl, BOX(s1 - s0, y1 - y0, off1 - off0).translate((s0 + s1) / 2, (y0 + y1) / 2, (off0 + off1) / 2), hex, to);
    const wbar = (Wl, a, b, t, hex) => bar(Wl.pt(...a), Wl.pt(...b), t, hex);
    // a wedge or other outline [s, y] standing `thick` out from the wall
    const slab = (Wl, pts, thick, hex) => {
      const s = new THREE.Shape();
      pts.forEach((q, k) => (k ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])));
      onWall(Wl, new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false }), hex);
    };
    // pictures: one image on a wall, or repeated along it
    const pictures = [];
    const picture = (Wl, tex, s0, s1, y0, y1, off, { clear = false, repeat = 1, glowing = 0 } = {}) => {
      const g = new THREE.PlaneGeometry(s1 - s0, y1 - y0).translate((s0 + s1) / 2, (y0 + y1) / 2, off).applyMatrix4(Wl.M);
      if (repeat !== 1) { const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * repeat); }
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, alphaTest: clear ? 0.4 : 0, emissive: glowing ? 0xffffff : 0x000000, emissiveMap: glowing ? tex : null, emissiveIntensity: glowing }));
      m.receiveShadow = true;
      pictures.push(m);
    };
    // tiled surfaces in space: a quad a -> b (u) and a -> d (v), points (e, y, n)
    const TEX = { solar: [solarTex(), [1.05, 1.75]], rib: [ribTex(), [0.36, 1]] }, quads = {};
    for (const k of Object.keys(TEX)) quads[k] = { pos: [], uv: [] };
    const sheet = (kind, a, b, d) => {
      const Q = quads[kind], [tu, tv] = TEX[kind][1];
      const P = [a, b, d].map((q) => new THREE.Vector3(q[0], q[1], -q[2])), c = P[1].clone().add(P[2]).sub(P[0]);
      const u = P[1].distanceTo(P[0]) / tu, v = P[2].distanceTo(P[0]) / tv;
      for (const [q, uu, vv] of [[P[0], 0, 0], [P[1], u, 0], [c, u, v], [P[0], 0, 0], [c, u, v], [P[2], 0, v]]) { Q.pos.push(q.x, q.y, q.z); Q.uv.push(uu, vv); }
    };
    const GLASS = glassTex(), GLASS_DARK = glassTex('#3a3d44');
    // a band of windows: panes side by side in one frame
    const windows = (Wl, s0, s1, y0, y1, panes, { frame = 0xe4e3df, tex = GLASS, off = 0.05 } = {}) => {
      wbox(Wl, s0 - 0.07, s1 + 0.07, y0 - 0.07, y1 + 0.07, 0, off, frame);
      picture(Wl, tex, s0, s1, y0, y1, off + 0.012, { repeat: panes });
    };
    // a block with a flat roof behind a low parapet
    const block = (e0, e1, n0, n1, top, wall, roof = COL.roof) => {
      box(e0, e1, n0, n1, -3.5, top - 0.3, wall);
      box(e0 + 0.25, e1 - 0.25, n0 + 0.25, n1 - 0.25, top - 0.3, top - 0.24, roof);
      for (const [a, b, c, d] of [[e0, e1, n0, n0 + 0.25], [e0, e1, n1 - 0.25, n1], [e0, e0 + 0.25, n0, n1], [e1 - 0.25, e1, n0, n1]]) box(a, b, c, d, top - 0.3, top, wall);
      for (const [a, b, c, d] of [[e0 - 0.03, e1 + 0.03, n0 - 0.03, n0 + 0.28], [e0 - 0.03, e1 + 0.03, n1 - 0.28, n1 + 0.03], [e0 - 0.03, e0 + 0.28, n0, n1], [e1 - 0.28, e1 + 0.03, n0, n1]]) box(a, b, c, d, top, top + 0.04, COL.cap);
    };

    // ================= the hall =================
    block(0, HW, 0, HL, HALL, COL.white);
    box(-2.4, 0, 26.4, 35.4, -3.5, HALL - 1.0, COL.white);                         // the stair tower on the garden side
    box(-2.43, 0, 26.37, 35.43, HALL - 1.0, HALL - 0.96, COL.cap);
    const WS = wallOf(0, 0, HW, 0), WE = wallOf(HW, 0, HW, HL), WN = wallOf(HW, HL, 0, HL), WW = wallOf(0, HL, 0, 0);
    // the long wall to the car park and the north end: grey facets
    picture(WE, facetTex(5, 9, 3), 0, HL, -0.6, HALL, 0.03);
    picture(WN, facetTex(8, 5, 3), 0, HW, 0, HALL, 0.03);
    // three banners
    const banners = [bannerTex(3), bannerTex(11), bannerTex(17)];
    [16, 24.7, 33.2].forEach((s, k) => {
      wbox(WE, s - 2.62, s + 2.62, 1.05, 10.45, 0.03, 0.08, 0x8a8a8c);
      picture(WE, banners[k], s - 2.5, s + 2.5, 1.15, 10.35, 0.095);
    });
    // the white end wall: the mark, four small windows, the goods canopy and dock
    picture(WS, logoTex(), 14.3, 21.9, 4.75, 10.1, 0.035, { clear: true });
    for (const s of [2.2, 5.9, 9.6, 13.2]) windows(WS, s - 0.4, s + 0.4, 4.6, 6.3, 1, { frame: 0xdddcd8 });
    {
      const d = 2.6, y = gy(9, -1.5);              // the yard in front of the dock
      wbox(WS, 0.8, 17.2, y + 3.0, y + 3.22, 0, d, 0x8b8b8d);                     // canopy
      wbox(WS, 0.8, 17.2, y + 0.9, y + 3.0, 0, 0.03, 0xdcdad6);
      for (const s of [0.95, 6.3, 11.7, 17.05]) wbar(WS, [s, y, d - 0.12], [s, y + 3.0, d - 0.12], 0.1, COL.metal);
      wbox(WS, 1.4, 13.6, y - 0.6, y + 0.95, 0, d, COL.concrete);                 // the dock
      slab(WS, [[13.6, y - 0.6], [19.8, y - 0.6], [19.8, y], [13.6, y + 0.95]], d, COL.concrete);       // its ramp
      wbox(WS, 2.6, 3.7, y + 0.95, y + 3.0, 0, 0.07, COL.door); wbox(WS, 11.3, 12.4, y + 0.95, y + 3.0, 0, 0.07, COL.door);
      wbox(WS, 6.4, 9.6, y + 0.95, y + 2.95, 0, 0.07, 0x9a9ca1);                  // the roller door
      for (let k = 1; k < 8; k++) wbox(WS, 6.4, 9.6, y + 0.95 + k * 0.25, y + 0.97 + k * 0.25, 0.07, 0.08, 0x7f8186);
      wbar(WS, [13.6, y + 1.95, d - 0.06], [19.8, y + 1.0, d - 0.06], 0.05, COL.metal);      // the ramp's rail
      for (const [s, yy] of [[13.6, 0.95], [16.7, 0.48], [19.8, 0]]) wbar(WS, [s, y + yy, d - 0.06], [s, y + yy + 1.0, d - 0.06], 0.05, COL.metal);
    }
    // the side door at the corner of the long wall: glass, a small canopy, two steps
    wbox(WE, 0.7, 4.3, 2.75, 2.93, 0, 1.9, 0x8b8b8d);
    wbox(WE, 0.6, 4.4, -0.6, 0.34, 0, 1.7, COL.concrete); wbox(WE, 0.4, 4.6, -0.6, 0.17, 1.7, 2.05, COL.concrete);
    windows(WE, 1.5, 3.1, 0.36, 2.55, 2, { frame: COL.frame, tex: GLASS_DARK });
    for (const s of [0.8, 4.2]) wbar(WE, [s, 0.34, 1.75], [s, 2.75, 1.75], 0.08, COL.metal);
    // a narrow light slot high on the north end, and the garden side: white, a few windows
    for (const s of [7.3, 8.8, 10.3]) windows(WN, s - 0.2, s + 0.2, 6.9, 10.1, 1, { frame: 0x5d5e62, tex: GLASS_DARK });
    for (const s of [3.5, 9.5, 20, 26, 32, 38]) windows(WW, s - 0.6, s + 0.6, 5.2, 6.9, 1, { frame: 0xdddcd8 });
    for (const s of [20, 26, 32, 38]) windows(WW, s - 0.6, s + 0.6, 1.4, 3.1, 1, { frame: 0xdddcd8 });

    // ================= the roof: sun panels on the north half, lights and plant on the south =================
    {
      const R = HALL - 0.24;
      for (let n = 20.6; n < 39.5; n += 2.35) for (const [e0, e1] of [[2.3, 10.7], [12.5, 20.9]]) {
        sheet('solar', [e0, R + 0.1, n], [e1, R + 0.1, n], [e0, R + 0.46, n + 1.72]);
        box(e0, e1, n + 1.68, n + 1.72, R, R + 0.46, 0x8d9097);
      }
      for (const [e, n] of [[6.5, 5], [15.5, 5.5], [5.5, 13], [11, 9.5], [17, 13.5], [11.6, 17]]) { box(e - 0.9, e + 0.9, n - 0.7, n + 0.7, R, R + 0.42, 0xcfd1d5); box(e - 0.75, e + 0.75, n - 0.55, n + 0.55, R + 0.42, R + 0.5, 0xeef2f5); }
      bar([4.5, R + 0.32, 17.5], [11.5, R + 0.32, 3.2], 0.55, 0xc3c6cb);         // the long duct
      box(18.6, 21.4, 1.6, 3.4, R, R + 1.05, 0xb1b4ba); box(1.6, 3.4, 1.6, 4.4, R, R + 0.8, 0xb1b4ba);
    }

    // ================= the entrance block and the wing to the lake =================
    block(10.5, 19.4, HL - 0.3, 55.3, ENT, COL.grey);
    block(-2.4, 10.5, HL - 0.3, 65.9, WING, 0xa2a1a2);
    const WX = wallOf(19.4, HL, 19.4, 55.3), WXN = wallOf(19.4, 55.3, 10.5, 55.3);
    const WL = wallOf(10.5, 65.9, -2.4, 65.9), WLE = wallOf(10.5, 55.3, 10.5, 65.9), WLW = wallOf(-2.4, 65.9, -2.4, HL);
    picture(WX, facetTex(21, 4, 2), 0, WX.len, -0.6, ENT, 0.03);
    picture(WXN, facetTex(27, 3, 2), 0, WXN.len, -0.6, ENT, 0.03);
    {
      // the oval window
      const oval = (r, hex, off) => onWall(WX, new THREE.CylinderGeometry(r, r, 0.06, 28).rotateX(Math.PI / 2).scale(1, 0.66, 1).translate(3.3, 1.75, off), hex);
      oval(1.02, 0x77787b, 0.05); oval(0.9, 0x15171b, 0.075);
      // the terrace in front of the doors, three steps down to the car park
      const T = 0.5, d = 4.0;
      wbox(WX, 5.6, 14.3, -0.8, T, 0, d, COL.concrete);
      for (let k = 0; k < 2; k++) wbox(WX, 7.2, 12.4, -0.8, T - (k + 1) * 0.167, d + k * 0.32, d + (k + 1) * 0.32, 0xa9a6a2);
      const rail = (a, b) => { wbar(WX, [a[0], T + 0.95, a[1]], [b[0], T + 0.95, b[1]], 0.05, COL.metal); wbar(WX, [a[0], T + 0.5, a[1]], [b[0], T + 0.5, b[1]], 0.035, COL.metal); for (const q of [a, b]) wbar(WX, [q[0], T, q[1]], [q[0], T + 0.95, q[1]], 0.05, COL.metal); };
      rail([5.7, 0.1], [5.7, d - 0.1]); rail([5.7, d - 0.1], [7.1, d - 0.1]); rail([12.5, d - 0.1], [14.2, d - 0.1]); rail([14.2, d - 0.1], [14.2, 0.1]);
      // glass front, canopy and its white rods
      wbox(WX, 6.5, 14.1, T, 3.0, 0, 0.06, COL.frame);
      picture(WX, entranceTex(), 6.6, 14.0, T + 0.04, 2.95, 0.075, { glowing: 0.3 });
      wbox(WX, 6.2, 14.3, 3.05, 3.27, 0, 3.3, 0x8b8b8d);
      wbox(WX, 6.3, 14.2, 3.02, 3.05, 0.05, 3.2, 0xe6e5e1);
      for (let k = 0; k < 7; k++) { const s = 6.6 + k * 1.22; wbar(WX, [s, 3.27, 3.15], [s + 0.9, 4.75, 0.04], 0.09, 0xf1f0ec); }
      wbox(WX, 0.9, 1.5, 2.2, 2.5, 0.03, 0.3, 0xe8e8ea);                           // a lamp by the oval
    }
    // the wing: bands of glass towards the lake and the square, a door on the square
    windows(WL, 0.8, 12.1, 5.0, 6.7, 9, { frame: 0x77787b });
    windows(WL, 0.8, 7.4, 1.2, 3.0, 5, { frame: 0x77787b });
    windows(WLE, 1.0, 9.6, 5.0, 6.7, 6, { frame: 0x77787b });
    windows(WLE, 3.4, 9.6, 1.2, 3.0, 4, { frame: 0x77787b });
    wbox(WLE, 1.0, 2.2, gy(11.2, 57), 2.5, 0, 0.07, COL.door);
    windows(WLW, 1.0, 23.6, 5.0, 6.7, 16, { frame: 0x77787b });
    windows(WLW, 1.0, 23.6, 1.2, 3.0, 16, { frame: 0x77787b });
    for (const [e, n] of [[1, 46], [5, 52], [7.5, 60]]) box(e - 0.7, e + 0.7, n - 0.6, n + 0.6, WING - 0.24, WING + 0.3, 0xcfd1d5);
    box(12.5, 14.5, 44, 46, ENT - 0.24, ENT + 0.5, 0xb1b4ba);

    // ================= in front: the stone bed, boulders, grasses, lamps, the flag =================
    const solids = [];
    const solid = (e, n, he, hn) => { const [x, z] = at(e, n); solids.push({ x, z, yaw: -ROT, hx: he, hz: hn }); };
    {
      const r = rnd(41), rock = (e, n, rad, hex, squash = 0.7) => add(new THREE.IcosahedronGeometry(rad, 1).scale(1, squash, 0.85 + r() * 0.3).rotateY(r() * 6).translate(e, gy(e, n) + rad * squash * 0.55, -n), hex);
      // rounded field stones banked against the long wall
      box(HW, HW + 2.5, 5.2, HL, -0.5, 0.12, 0x9c8f88);
      const tones = [0xb7a59c, 0xa9a29c, 0xc2b0a4, 0x9a9390, 0xb39a90];
      for (let n = 5.5; n < HL; n += 0.62) {
        rock(HW + 0.3 + r() * 0.3, n, 0.3 + r() * 0.2, tones[Math.floor(r() * 5)], 0.85);
        rock(HW + 1.1 + r() * 0.4, n + 0.3, 0.24 + r() * 0.14, tones[Math.floor(r() * 5)]);
        rock(HW + 2.0 + r() * 0.4, n + 0.1, 0.16 + r() * 0.12, tones[Math.floor(r() * 5)]);
      }
      solid(HW + 1.25, 23.2, 1.25, 18);
      // white boulders along the edge of the car park, and the heap of field stones by the square
      for (const [e, n, rad] of [[28.6, 12.5, 0.55], [28.9, 19.5, 0.5], [28.6, 40.5, 0.52], [28.3, 52.6, 0.5]]) { rock(e, n, rad, COL.boulder, 0.82); solid(e, n, rad * 0.75, rad * 0.75); }
      for (const [e, n, rad] of [[21.5, 73.6, 0.5], [22.6, 74.6, 0.42], [21.7, 75.4, 0.36], [23.2, 73.4, 0.3], [20.6, 74.7, 0.3]]) rock(e, n, rad, tones[Math.floor(r() * 5)], 0.8);
      solid(21.9, 74.4, 1.5, 1.2);
      for (const [e, n] of [[30.5, 81], [35, 84.5], [27, 88]]) rock(e, n, 0.55, 0xb9b3ab, 0.75);       // on the lawn by the lake
      // a globe lamp at each end of the long wall
      for (const [e, n] of [[27.1, 8.5], [25.2, 45.2]]) {
        const y = gy(e, n);
        add(new THREE.CylinderGeometry(0.05, 0.07, 3.6, 10).translate(e, y + 1.8, -n), 0x8e9197);
        add(new THREE.SphereGeometry(0.24, 14, 10).translate(e, y + 3.75, -n), COL.lamp, glow);
      }
      // the flag pole on the square
      const fe = 27.6, fn = 55.4, fy = gy(fe, fn);
      add(new THREE.CylinderGeometry(0.04, 0.06, 8.5, 10).translate(fe, fy + 4.25, -fn), 0xe9eaec);
      add(new THREE.SphereGeometry(0.07, 8, 6).translate(fe, fy + 8.55, -fn), 0xe9eaec);
      const fg = new THREE.PlaneGeometry(1.7, 1.06, 6, 1);
      const q = fg.attributes.position;
      for (let k = 0; k < q.count; k++) q.setZ(k, Math.sin(q.getX(k) * 3.2) * 0.09);
      fg.rotateY(0.5).translate(fe + 0.82, fy + 7.85, -fn - 0.42);
      pictures.push(new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ map: flagTex(), side: THREE.DoubleSide })));
      // tufts of grass in the bed between the paving and the square
      const leafy = leafyPlants(group, shadows);
      for (const [e, n, s] of [[26.4, 42.5, 1], [27.6, 46.5, 1.2], [26.0, 50.2, 0.9], [27.2, 58.6, 1.1], [29.0, 57.4, 0.9], [26.6, 3.0, 1], [29.2, 44.0, 0.8]]) {
        const [x, z] = at(e, n), y = world.heightAt(x, z);
        if (leafy.ok) leafy.bush(x, y - 0.05, z, 0.9 * s, 1.0 * s, e, [1.25, 1.2, 0.8]);
        else add(new THREE.ConeGeometry(0.4 * s, 0.9 * s, 7).translate(e, y - Y0 + 0.45 * s, -n), 0xa9c27a);
      }
      leafy.finish();
    }
    solid(21.6, 48.2, 2.3, 4.6);            // the terrace
    solid(25.0, 2.5, 1.0, 2.1);             // the side door's steps
    solid(8.6, -1.3, 7.4, 1.3); solid(16.7, -1.3, 3.1, 1.3);       // the dock and its ramp

    // ================= the Järve building: the map's walls and roofs, dressed =================
    {
      const yj = gy(44, 67.5), WJ = wallOf(31.24, 66.1, 53.51, 74.21, yj);
      const pane = { frame: 0xfbfaf6, tex: GLASS_DARK, off: 0.07 };
      // the tall end: the walkers along the foot of the wall, small windows above
      picture(WJ, figuresTex(), 0.4, 5.9, 0.15, 2.3, 0.06, { clear: true });
      for (const s of [1.4, 2.9]) windows(WJ, s - 0.4, s + 0.4, 3.5, 4.4, 1, pane);
      windows(WJ, 4.5, 5.15, 3.3, 5.7, 1, pane);
      // the long low part: seven windows with flower boxes, the sign at the far end
      for (let k = 0; k < 7; k++) {
        const s = 11.5 + k * 1.55;
        windows(WJ, s - 0.5, s + 0.5, 1.1, 2.15, 1, pane);
        wbox(WJ, s - 0.55, s + 0.55, 0.86, 1.02, 0.05, 0.3, 0x5a4a3c);                                  // flower boxes
        wbox(WJ, s - 0.5, s + 0.5, 1.02, 1.14, 0.08, 0.28, [0xc8553f, 0xd9a13c, 0xb84a6a][k % 3]);
      }
      picture(WJ, jarveTex(), 21.85, 23.55, 1.2, 2.15, 0.09, { clear: true });
      // the porch: glass below, the white boarded balcony above
      const WP = wallOf(37.74, 65.96, 41.75, 67.35, yj);
      wbox(WP, 0.05, WP.len - 0.05, 0.05, 2.5, 0, 0.06, 0xfbfaf6);
      picture(WP, GLASS_DARK, 0.2, WP.len - 0.2, 0.15, 2.4, 0.075, { repeat: 4 });
      const boards = (Wl) => { const a = Wl.pt(0, 2.6, 0.03), b = Wl.pt(Wl.len, 2.6, 0.03); sheet('rib', a, b, [a[0], a[1] + 1.1, a[2]]); };
      boards(WP); boards(wallOf(36.98, 68.12, 37.74, 65.96, yj)); boards(wallOf(41.75, 67.35, 40.99, 69.52, yj));
      // the other sides: rows of plain windows
      const row = (Wl, list, y0, y1, w = 1.0) => { for (const s of list) windows(Wl, s - w / 2, s + w / 2, y0, y1, 1, pane); };
      const WJS = wallOf(24.33, 85.7, 30.96, 66.87, gy(26.5, 76) + 0.3), WJN = wallOf(53.51, 74.21, 46.68, 93.61, gy(51.5, 84)), WJL = wallOf(46.68, 93.61, 24.33, 85.7, gy(36, 91) + 0.3);
      row(WJS, [2.5, 6, 9.5, 13, 16.5], 1.1, 2.3); row(WJS, [2.5, 6, 9.5, 13, 16.5], 3.7, 4.7);
      row(WJN, [2.5, 6, 9.5, 13, 16.5], 1.1, 2.15);
      row(WJL, [2.5, 5.5, 8.5, 11.5, 14.5, 17.5, 20.5], 1.1, 2.15);
      row(WJL, [14.5, 17.5, 20.5], 3.9, 4.9);
    }

    // ================= the piers =================
    const wood = new Parts();               // in map coordinates
    const plank = { pos: [], uv: [] }, slabTop = { pos: [], uv: [] };       // boards, and the concrete landing
    const decks = [];
    const yawOf = (dx, dz) => Math.atan2(-dz, dx);
    // a ribbon from a to b: `hw` half width, a station every `step`; heightAt(s, lat) gives the deck there
    const ribbon = (a, b, hw, step, heightAt, { top = 'plank', floats = true } = {}) => {
      const [dx, dz, len] = unit(a, b), n = Math.max(1, Math.round(len / step)), lats = [hw, hw / 2, 0, -hw / 2, -hw], pts = [];
      // the deck's own sideways axis (data.js: heights run from +lat to -lat, lat along (-dz, dx))
      for (let i = 0; i <= n; i++) {
        const s = (len * i) / n, x = a[0] + dx * s, z = a[1] + dz * s;
        pts.push([x, z, ...lats.map((lat) => heightAt(s, lat, x - dz * lat, z + dx * lat))]);
      }
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (const q of pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
      decks.push({ kind: 1, hw, pts, rail: null, w: 0, b: '', name: '', own: true, x0: x0 - hw - 2, z0: z0 - hw - 2, x1: x1 + hw + 2, z1: z1 + hw + 2 });
      // the boards (or the concrete), the edge beams and the floats under it
      for (let i = 0; i < n; i++) {
        const P = pts[i], Q = pts[i + 1], s0 = (len * i) / n, s1 = (len * (i + 1)) / n;
        for (let j = 0; j < 4; j++) {
          const la = lats[j], lb = lats[j + 1];
          const v = [[P[0] - dz * la, P[2 + j] + 0.035, P[1] + dx * la, s0, la], [P[0] - dz * lb, P[3 + j] + 0.035, P[1] + dx * lb, s0, lb],
            [Q[0] - dz * la, Q[2 + j] + 0.035, Q[1] + dx * la, s1, la], [Q[0] - dz * lb, Q[3 + j] + 0.035, Q[1] + dx * lb, s1, lb]];
          const T = top === 'concrete' ? slabTop : plank;
          for (const k of [0, 1, 2, 2, 1, 3]) { T.pos.push(v[k][0], v[k][1], v[k][2]); T.uv.push(v[k][3] / 1.2, v[k][4] / 4); }
        }
        const mx = (P[0] + Q[0]) / 2, mz = (P[1] + Q[1]) / 2, sl = len / n;
        for (const side of [0, 4]) {
          const lat = lats[side], my = (P[2 + side] + Q[2 + side]) / 2, pitch = Math.atan2(Q[2 + side] - P[2 + side], sl);
          wood.add(BOX(Math.hypot(sl, Q[2 + side] - P[2 + side]) + 0.02, 0.26, 0.12).rotateZ(pitch), top === 'concrete' ? 0x9d9a96 : COL.woodDark, mx - dz * lat, my - 0.1, mz + dx * lat, yawOf(dx, dz));
        }
        const over = world.heightAt(mx, mz) < LAKE - 0.2;
        if (floats && over && i % 2 === 0) wood.add(BOX(Math.min(2.6, sl * 1.3), 0.62, hw * 2 - 0.5), COL.float, mx, PIER_Y - 0.45, mz, yawOf(dx, dz));
      }
      return { dx, dz, len };
    };
    const level = () => PIER_Y;
    // a landing leaves the ground level with it and comes down to the pier's height over `run` metres
    const ramp = (run) => {
      const start = new Map();
      return (s, lat, x, z) => {
        if (!start.has(lat)) start.set(lat, world.heightAt(x, z) + 0.03);
        const t = Math.min(1, s / run), k = t * t * (3 - 2 * t);
        return start.get(lat) + (PIER_Y - start.get(lat)) * k;
      };
    };
    const post = (x, z, h = 1.0) => wood.add(new THREE.CylinderGeometry(0.07, 0.07, h + 0.9, 8), 0x7c7f86, x, PIER_Y + (h - 0.9) / 2, z, 0);
    {
      // the long pier past the centre, with its bathing platform on the south side
      const [dx, dz] = unit(BIG.shore, BIG.end), land = [BIG.shore[0] - dx * BIG.land, BIG.shore[1] - dz * BIG.land];
      ribbon(land, BIG.shore, BIG.landHw, 1.9, ramp(BIG.land), { floats: false });
      const R = ribbon(BIG.shore, BIG.end, PIER_HW, 3.0, level);
      for (let s = 9; s < R.len; s += 12) for (const side of [-1, 1]) post(BIG.shore[0] + dx * s - dz * side * (PIER_HW + 0.1), BIG.shore[1] + dz * s + dx * side * (PIER_HW + 0.1), 0.5);
      const P = BIG.plat, qx = dz, qz = -dx, c = [BIG.shore[0] + dx * P.s, BIG.shore[1] + dz * P.s];
      ribbon([c[0] + qx * P.lat0, c[1] + qz * P.lat0], [c[0] + qx * P.lat1, c[1] + qz * P.lat1], P.hw, 2.3, level);
      // its railing: the far side and both ends (boards on posts), open towards the pier
      const railAt = (s0, l0, s1, l1) => {
        const a = [c[0] + dx * s0 + qx * l0, c[1] + dz * s0 + qz * l0], b = [c[0] + dx * s1 + qx * l1, c[1] + dz * s1 + qz * l1], [ux, uz, len] = unit(a, b);
        for (const y of [0.45, 0.95]) wood.add(BOX(len, 0.1, 0.05), COL.wood, (a[0] + b[0]) / 2, PIER_Y + y, (a[1] + b[1]) / 2, yawOf(ux, uz));
        for (let k = 0; k <= Math.round(len / 1.7); k++) { const t = k / Math.round(len / 1.7); wood.add(BOX(0.09, 1.05, 0.09), COL.woodDark, a[0] + (b[0] - a[0]) * t, PIER_Y + 0.52, a[1] + (b[1] - a[1]) * t, yawOf(ux, uz)); }
        solids.push({ x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, yaw: yawOf(ux, uz), hx: len / 2, hz: 0.25 });
      };
      const far = P.lat1 - 0.15, h = P.hw - 0.15;
      railAt(-h, far, h, far); railAt(-h, PIER_HW + 1.6, -h, far); railAt(h, PIER_HW + 1.6, h, far);
      // a ladder into the water
      for (const o of [-0.25, 0.25]) wood.add(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 6), 0xc9ccd2, c[0] + dx * o + qx * (P.lat1 + 0.06), PIER_Y + 0.1, c[1] + dz * o + qz * (P.lat1 + 0.06), 0);
    }
    {
      // the short pier north of the Järve building: a concrete landing at the end of the road, then the pontoon
      const [lx, lz] = unit(SMALL.from, SMALL.shore), [dx, dz] = unit(SMALL.shore, SMALL.end);
      ribbon(SMALL.from, [SMALL.shore[0] + lx * 1.6, SMALL.shore[1] + lz * 1.6], SMALL.landHw, 2.0, ramp(SMALL.ramp), { top: 'concrete', floats: false });
      const start = [SMALL.shore[0] - dx * 1.0, SMALL.shore[1] - dz * 1.0];
      const R = ribbon(start, SMALL.end, PIER_HW, 3.0, level);
      for (let s = 8; s < R.len; s += 12) for (const side of [-1, 1]) post(start[0] + dx * s - dz * side * (PIER_HW + 0.1), start[1] + dz * s + dx * side * (PIER_HW + 0.1), 0.5);
    }
    world.decks.push(...decks);

    // ================= the car park's lines =================
    const paint = { white: [], yellow: [] };
    const stripe = (kind, a, b, w = 0.14) => {       // a painted line between two map points
      const [dx, dz, len] = unit(a, b), n = Math.max(1, Math.ceil(len / 2)), hx = (-dz * w) / 2, hz = (dx * w) / 2;
      for (let i = 0; i < n; i++) {
        const p0 = [a[0] + (dx * len * i) / n, a[1] + (dz * len * i) / n], p1 = [a[0] + (dx * len * (i + 1)) / n, a[1] + (dz * len * (i + 1)) / n];
        const v = [[p0[0] + hx, p0[1] + hz], [p0[0] - hx, p0[1] - hz], [p1[0] + hx, p1[1] + hz], [p1[0] - hx, p1[1] - hz]];
        for (const k of [0, 1, 2, 2, 1, 3]) paint[kind].push(v[k][0], world.heightAt(v[k][0], v[k][1]) + 0.05, v[k][1]);
      }
    };
    const fr = (kind, a, b, w) => stripe(kind, at(...a), at(...b), w);       // the same between two points of the hall's frame
    {
      // the double row down the middle: a spine with bays on both sides
      stripe('white', [MID.x, MID.z0], [MID.x, MID.z0 - BAY * MID.count]);
      for (let k = 0; k <= MID.count; k++) stripe('white', [MID.x - MID.len, MID.z0 - BAY * k], [MID.x + MID.len, MID.z0 - BAY * k]);
      // nose-in along the east edge
      for (let k = 0; k <= EDGE.count; k++) { const z = EDGE.z0 - BAY * k, x = edgeX(z) - 0.3; stripe('white', [x - EDGE.len, z], [x, z]); }
      // square to the hedge in the south
      const H = HEDGE, hp = (t, o) => [H.from[0] + H.dir[0] * t - H.dir[1] * o, H.from[1] + H.dir[1] * t + H.dir[0] * o];
      for (let k = 0; k <= H.count; k++) fr('white', hp(H.t0 + BAY * k, 0.4), hp(H.t0 + BAY * k, 0.4 + H.len));
      // square to the Järve building's front
      const jp = (s, o) => [JF.from[0] + JF.dir[0] * s + JF.dir[1] * o, JF.from[1] + JF.dir[1] * s - JF.dir[0] * o];
      for (let k = 0; k <= JF.count; k++) fr('white', jp(JF.s0 + JF.step * k, JF.off0), jp(JF.s0 + JF.step * k, JF.off1));
      // yellow: a crossed box kept clear in front of the Järve porch and one at the mouth of the square, and the
      // line along the kerb in front of the long wall
      const crossed = (q) => { for (let k = 0; k < 4; k++) fr('yellow', q[k], q[(k + 1) % 4]); fr('yellow', q[0], q[2]); fr('yellow', q[1], q[3]); };
      crossed([jp(6.3, 3.2), jp(10.6, 3.2), jp(10.6, 7.6), jp(6.3, 7.6)]);
      crossed([[29.6, 55.5], [34.2, 55.5], [34.2, 63.5], [29.6, 63.5]]);
      fr('yellow', [29.4, 5], [29.4, 41]);
      stripe('yellow', [MID.x - MID.len - 1.2, MID.z0 + 1.6], [MID.x + MID.len + 1.2, MID.z0 + 1.6]);       // across the south end of the rows
    }
    for (const [kind, hex] of [['white', 0xf3f1f7], ['yellow', 0xe9c53a]]) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(paint[kind], 3));
      const nor = new Float32Array(paint[kind].length);
      for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.45, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));       // the ground picture is very pale here: plain white paint would read as grey on it
      m.receiveShadow = true;
      group.add(m);
    }

    // ---- assemble
    for (const k of Object.keys(quads)) {
      const Q = quads[k];
      if (!Q.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(Q.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(Q.uv, 2));
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: TEX[k][0], side: THREE.DoubleSide }));
      mesh.receiveShadow = true;
      loc.add(mesh);
    }
    for (const m of pictures) loc.add(m);
    const body = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    body.castShadow = shadows; body.receiveShadow = true;
    loc.add(body);
    const lamps = glow.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xfff2cc, emissiveIntensity: 0.55 }));
    if (lamps) loc.add(lamps);
    {
      for (const [T, mat] of [[plank, { map: plankTex() }], [slabTop, { color: COL.concrete }]]) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(T.pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(T.uv, 2));
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ ...mat, side: THREE.DoubleSide }));
        m.receiveShadow = true;
        group.add(m);
      }
      const w = wood.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
      w.castShadow = shadows; w.receiveShadow = true;
      group.add(w);
    }
    world.addSolids(solids);
  }

  return {
    update(car) {
      if (built || !car) return;
      const c = at(15, 55);
      if (Math.hypot(car.x - c[0], car.z - c[1]) > 520) return;
      if ([[0, 0], [23, 41], [-3, 66], [54, 74], [47, 94]].every((q) => world.ready(...at(q[0], q[1]))) && world.ready(...BIG.end) && world.ready(...SMALL.end)) build();
    },
  };
}
