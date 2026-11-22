// Raekoja plats, the town hall square (Martin, 18 Nov), from Street View (July 2014), the 2024 orthophoto and
// the LOD2 building model, in pastel takes on the real colours:
//   - the town hall, modelled by hand instead of its LOD2 block: pink walls over a red ground floor, white
//     pilasters and cornices, nine window bays with window boxes of red flowers, the centre risalit with
//     its pediment and oval window, the entrance steps, the hipped tiled roof with two chimneys and the
//     dark clock tower with its bell cap, lantern and spire;
//   - the Kissing Students fountain on its round two-step plinth;
//   - the square: mixed granite setts with bands of granite slabs along the fronts, across the square and
//     round the fountain; lanterns with hanging flower baskets, stone benches, bollards at the Rüütli
//     mouth, and the cafe terraces with white planter fences and square white umbrellas on the north side;
//   - the other buildings round the square in their own colours (lower effort: colour and roof only).
// Street names are never painted on the ground (Martin, 18 Nov).
import * as THREE from 'three';
import { Parts, BOX } from '../race/landmarks.js';
import { addHouseColours } from './streetkit.js';
import { drapeGeometry } from './drape.js';
import { markGround, LOOK } from './groundlook.js';

// the town hall front, south corner -> north corner (square on its right); depth back from the front
const HALL = { a: [1402.65, 2873.9], b: [1386.1, 2841.5], depth: 18.6 };
const BAYS = [3.1, 6.4, 9.6, 13.8, 18.2, 22.6, 26.8, 30.0, 33.3];     // window axes along the front (m)
const RISALIT = { s0: 11.4, s1: 25.0, out: 0.45 };
const FLOORS = { belt: 4.4, top: 15.2, w1: [5.7, 7.9], w2: [10.0, 12.1], g: [1.1, 3.4] };
const ROOF = { over: 0.4, rise: 7.2 };
const TOWER = { s: 18.2, n: -9.3 };
const FOUNTAIN = { x: 1410.6, z: 2850.2 };

// the square: the fronts of the north row (west -> east), the south row (west -> east)
const NORTH = [[1391.8, 2830.8], [1412.0, 2827.6], [1423.8, 2825.1], [1431.8, 2822.8], [1445.8, 2818.8], [1458.8, 2815.7], [1485.8, 2807.3], [1499.6, 2801.6], [1523.8, 2791.3]];
const SOUTH = [[1413.1, 2877.7], [1422.7, 2871.7], [1432.0, 2865.7], [1437.2, 2862.4], [1456.5, 2854.5], [1462.5, 2851.8], [1470.5, 2848.2], [1475.2, 2846.1], [1497.5, 2835.8], [1514.0, 2827.0], [1526.8, 2820.1]];
const SQUARE = [HALL.b, ...NORTH, [1528, 2805], ...[...SOUTH].reverse(), HALL.a];
const CENTRE = [1450, 2840];
// cafe terraces in front of the north row: from x to x, metres out from the front
const TERRACES = [[1433, 1474], [1478, 1500], [1505, 1522]];
const TERRACE_N = [2.8, 9.4];

const COL = {
  pink: 0xf8d3da, red: 0xf2897c, white: 0xfdfaf8, cream: 0xf2ece6, roof: 0xd38d7c, roofDark: 0xb87668,
  tower: 0x5a5470, towerDark: 0x46415a, gold: 0xf0cf7a, clock: 0xfdfaf2, glass: 0x5d5c7e, glassLit: 0x8f8db0,
  door: 0x9a6a5c, step: 0xd4ced8, granite: 0xcdc6d2, graniteDark: 0xa9a2b2, water: 0xa6dcea, bronze: 0x7a6870,
  iron: 0x34313f, lamp: 0xfff0c4, flower: [0xe8456a, 0xf06a8c, 0xfaf0f4, 0xd93a5c], leaf: 0x5f9a5e,
  wood: 0xa8806e, deck: 0x8a7a88, umbrella: 0xfbf7ee, chair: 0x4c4858,
};

// the buildings round the square in their own colours (LOD2 base height in cm, a point inside)
const HOUSES = [
  { base: 542, x: 1386.9, z: 2860.5, hide: true },                                  // the town hall: by hand below
  { base: 412, x: 1436.7, z: 2883.7, wall: 0xf6e4b0, roof: 0xcf8d7c, reach: 40 },   // pale yellow, the portico and flags
  { base: 532, x: 1408.1, z: 2892.3, wall: 0xf5f0e6, roof: 0xcf8d7c, reach: 30 },
  { base: 239, x: 1471.7, z: 2859.7, wall: 0xf4e9cf, roof: 0xc98a7c, reach: 35 },   // the long cream south row
  { base: 270, x: 1489.2, z: 2845.4, wall: 0xf3e6c8, roof: 0xc98a7c, reach: 35 },
  { base: 198, x: 1515.3, z: 2830.1, wall: 0xf2ebda, roof: 0xbf8a80, reach: 35 },
  { base: 401, x: 1400, z: 2806, wall: 0xf7f3f0, roof: 0xcf8d7c, reach: 35 },        // white, the Rüütli corner
  { base: 500, x: 1381.3, z: 2818.7, wall: 0xf4f0ea, roof: 0xcf8d7c, reach: 35 },
  { base: 371, x: 1404.6, z: 2802.5, wall: 0xf8f6f4, roof: 0xc98a7c, reach: 60 },   // white, ornate, red-brown frames
  { base: 335, x: 1447, z: 2802.6, wall: 0xe6ddcf, roof: 0xc98a7c, reach: 30 },     // grey-beige stone front
  { base: 267, x: 1469.3, z: 2798.1, wall: 0xf5f2ec, roof: 0xcf8d7c, reach: 35 },
  { base: 257, x: 1487.3, z: 2788.2, wall: 0xf0edf2, roof: 0xc4a3a0, reach: 35 },
  { base: 189, x: 1504.8, z: 2784.1, wall: 0xf3e9d4, roof: 0xc98a7c, reach: 35 },
];
const LIGHT = 0, BENCH = 3;

export function raekodaWalls(walls) {
  if (!walls || !walls.sectors) return;
  // a house the colour survey already has keeps its entry, with the colours set here; the rest are added
  const a = walls.sectors['3_5'] || [], extra = ((walls.extra ||= {})['3_5'] ||= {}), fresh = [];
  for (const e of HOUSES) {
    let k = -1;
    for (let i = 0; i < a.length; i += 4) if (a[i] === e.base && Math.hypot(a[i + 1] / 10 + 1120 - e.x, a[i + 2] / 10 + 2400 - e.z) < 30) { k = i; break; }
    if (k < 0) { fresh.push(e); continue; }
    if (e.wall !== undefined) a[k + 3] = e.wall;
    extra[k / 4] = { roof: e.roof, reach: e.reach || 16, hide: e.hide };
  }
  addHouseColours(walls, '3_5', 1120, 2400, fresh);
}

function inRing(x, z, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i], b = r[j];
    if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
// props layer: the map's lamps and benches on the square make way for the ones drawn here
export function raekodaClear(data, out) {
  for (const [key, a] of Object.entries(data.sectors)) {
    for (let k = 0; k < a.length; k += data.stride) {
      if ((a[k] === LIGHT || a[k] === BENCH) && inRing(a[k + 1], a[k + 2], SQUARE)) out.add(`${key}:${k / data.stride}`);
    }
  }
}

// a frame along a front from a to b: s along it, n out to its right-hand side
function frame(a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
  return { len, ux, uz, yaw: Math.atan2(-uz, ux), at: (s, n) => [a[0] + ux * s - uz * n, a[1] + uz * s + ux * n] };
}

function canvasTex(n, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  draw(c.getContext('2d'), n);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function rnd(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
// mixed granite setts, about 11 cm, in pinks, greys and lilacs; one tile is 2 m
function settTex() {
  return canvasTex(512, (g, n) => {
    const r = rnd(5), cols = [[214, 200, 206], [196, 190, 204], [226, 214, 214], [184, 178, 194], [218, 206, 196], [204, 186, 196]];
    g.fillStyle = 'rgb(150,142,158)'; g.fillRect(0, 0, n, n);
    const k = 18, c = n / k;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
      const [R, G, B] = cols[Math.floor(r() * cols.length)], v = 0.92 + r() * 0.12;
      g.fillStyle = `rgb(${R * v | 0},${G * v | 0},${B * v | 0})`;
      const o = (j % 2) * c * 0.5, jx = (r() - 0.5) * 2, jy = (r() - 0.5) * 2;
      g.fillRect(i * c + o + 2 + jx, j * c + 2 + jy, c - 4, c - 4);
      if (i === 0 && o) g.fillRect(-c + o + 2 + jx, j * c + 2 + jy, c - 4, c - 4);
    }
  });
}
// big granite slabs, 1 x 0.6 m, pale; one tile is 3 m
function slabTex() {
  return canvasTex(256, (g, n) => {
    const r = rnd(9);
    g.fillStyle = 'rgb(176,170,186)'; g.fillRect(0, 0, n, n);
    const rows = 5, h = n / rows;
    for (let j = 0; j < rows; j++) {
      let x = -r() * 40;
      while (x < n) {
        const w = n / 3 * (0.7 + r() * 0.6), v = 0.93 + r() * 0.1;
        g.fillStyle = `rgb(${226 * v | 0},${222 * v | 0},${232 * v | 0})`;
        g.fillRect(x + 1.5, j * h + 1.5, w - 3, h - 3);
        x += w;
      }
    }
  });
}

export function createRaekoda(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function build() {
    built = true;
    const p = new Parts(), glow = new Parts();
    const h = (x, z) => world.heightAt(x, z);
    const solids = [];

    // ================= the town hall
    const F = frame(HALL.a, HALL.b), L = F.len, D = HALL.depth;
    const Y0 = Math.min(h(...F.at(0, 0.5)), h(...F.at(L, 0.5)), h(...F.at(L / 2, 0.5)));
    // a box in the hall's frame: s along the front, n out of it (body: n < 0), y above the front's foot
    const B = (s0, s1, n0, n1, y0, y1, hex) => p.box(s1 - s0, y1 - y0, n1 - n0, hex, ...F.at((s0 + s1) / 2, (n0 + n1) / 2).flatMap((v, i) => (i ? [Y0 + (y0 + y1) / 2, v] : [v])), F.yaw);
    const G = (geo, hex, s, n, y, rot = 0, parts = p) => { const [x, z] = F.at(s, n); parts.add(geo, hex, x, Y0 + y, z, F.yaw + rot); };
    const front = (s) => (s > RISALIT.s0 && s < RISALIT.s1 ? RISALIT.out : 0);

    // body: red ground floor, pink above, plinth, belt course, cornice
    B(0, L, -D, 0, -0.8, FLOORS.belt, COL.red);
    B(0, L, -D, 0, FLOORS.belt, FLOORS.top, COL.pink);
    B(RISALIT.s0, RISALIT.s1, -0.2, RISALIT.out, -0.8, FLOORS.belt, COL.red);
    B(RISALIT.s0, RISALIT.s1, -0.2, RISALIT.out, FLOORS.belt, FLOORS.top, COL.pink);
    B(-0.08, L + 0.08, -D - 0.08, 0.08, -0.8, 0.45, COL.cream);
    B(RISALIT.s0 - 0.08, RISALIT.s1 + 0.08, -0.2, RISALIT.out + 0.08, -0.8, 0.45, COL.cream);
    B(-0.12, L + 0.12, -D - 0.12, 0.12, FLOORS.belt - 0.05, FLOORS.belt + 0.35, COL.white);
    B(RISALIT.s0 - 0.12, RISALIT.s1 + 0.12, -0.2, RISALIT.out + 0.12, FLOORS.belt - 0.05, FLOORS.belt + 0.35, COL.white);
    B(-0.35, L + 0.35, -D - 0.35, 0.35, FLOORS.top - 0.7, FLOORS.top, COL.white);
    B(RISALIT.s0 - 0.3, RISALIT.s1 + 0.3, -0.2, RISALIT.out + 0.35, FLOORS.top - 0.7, FLOORS.top, COL.white);
    B(-0.2, L + 0.2, -D - 0.2, 0.2, FLOORS.top - 1.05, FLOORS.top - 0.7, COL.white);           // frieze under the cornice
    // white pilasters: corners, the risalit edges and between its windows; also on the end walls
    const pil = (s, w, n0 = 0, out = 0.12) => B(s - w / 2, s + w / 2, n0 - 0.1, n0 + out, FLOORS.belt + 0.35, FLOORS.top - 1.05, COL.white);
    pil(0.35, 0.7); pil(L - 0.35, 0.7);
    for (const s of [RISALIT.s0 + 0.35, RISALIT.s1 - 0.35]) pil(s, 0.7, RISALIT.out);
    for (const s of [16.0, 20.4]) pil(s, 0.5, RISALIT.out);
    for (const [sa, sb] of [[-0.12, 0.1], [L - 0.1, L + 0.12]]) {
      for (const [na, nb] of [[-0.7, 0.12], [-D - 0.12, -D + 0.7]]) B(sa, sb, na, nb, FLOORS.belt + 0.35, FLOORS.top - 1.05, COL.white);
    }

    // windows: white frame, dark glass, a cross of white glazing bars; hood above, flower box below
    const flowerBox = (s, nf, y, w) => {
      B(s - w / 2, s + w / 2, nf, nf + 0.32, y - 0.28, y, 0x6f8f66);
      for (let k = 0; k < 6; k++) {
        const fs = s - w / 2 + 0.12 + (k + 0.5) * (w - 0.24) / 6;
        G(new THREE.IcosahedronGeometry(0.13 + (k % 2) * 0.03, 0), k % 3 === 2 ? COL.leaf : COL.flower[k % 2 ? 3 : 0], fs, nf + 0.16 + (k % 2 ? 0.06 : -0.04), y + 0.08);
      }
    };
    const win = (s, y0, y1, w, nf, { hood = true, box = true } = {}) => {
      B(s - w / 2 - 0.14, s + w / 2 + 0.14, nf - 0.02, nf + 0.1, y0 - 0.14, y1 + 0.14, COL.white);
      B(s - w / 2, s + w / 2, nf, nf + 0.12, y0, y1, COL.glass);
      B(s - 0.035, s + 0.035, nf + 0.12, nf + 0.16, y0, y1, COL.white);
      B(s - w / 2, s + w / 2, nf + 0.12, nf + 0.16, y0 + (y1 - y0) * 0.68, y0 + (y1 - y0) * 0.68 + 0.07, COL.white);
      if (hood) B(s - w / 2 - 0.3, s + w / 2 + 0.3, nf, nf + 0.24, y1 + 0.22, y1 + 0.4, COL.white);
      if (box) flowerBox(s, nf + 0.06, y0 - 0.06, w + 0.1);
    };
    for (const s of BAYS) {
      const nf = front(s);
      win(s, FLOORS.w1[0], FLOORS.w1[1], 1.3, nf);
      win(s, FLOORS.w2[0], FLOORS.w2[1], 1.3, nf);
      if (Math.abs(s - 18.2) < 0.1) {
        // the entrance: double door with a fanlight, white surround, steps down to the square
        B(s - 1.25, s + 1.25, nf - 0.02, nf + 0.12, 0.3, 3.9, COL.white);
        B(s - 0.95, s + 0.95, nf, nf + 0.16, 0.4, 3.0, COL.door);
        B(s - 0.03, s + 0.03, nf + 0.16, nf + 0.19, 0.4, 3.0, 0x7d5348);
        B(s - 0.95, s + 0.95, nf, nf + 0.14, 3.08, 3.7, COL.glass);
        for (let k = 0; k < 3; k++) B(s - 3.2 + k * 0.25, s + 3.2 - k * 0.25, nf, nf + 1.35 - k * 0.42, -0.8, 0.42 - (2 - k) * 0.15, COL.step);
      } else {
        win(s, FLOORS.g[0], FLOORS.g[1], 1.25, nf, { hood: false, box: false });
        // white planter at the foot of the wall
        B(s - 0.55, s + 0.55, nf + 0.1, nf + 0.6, -0.8, 0.5, COL.white);
        for (let k = 0; k < 4; k++) G(new THREE.IcosahedronGeometry(0.16, 0), COL.flower[k % 4 === 2 ? 2 : k % 2 ? 1 : 0], s - 0.36 + k * 0.24, nf + 0.35, 0.58);
      }
    }
    // windows on the end walls (two bays each), seen across the square
    const endWin = (n, sEnd, dir) => {
      for (const y of [FLOORS.w1, FLOORS.w2]) {
        const [cx, cz] = F.at(sEnd + dir * 0.06, n);
        p.box(0.1, y[1] - y[0] + 0.28, 1.58, COL.white, cx, Y0 + (y[0] + y[1]) / 2, cz, F.yaw);
        p.box(0.14, y[1] - y[0], 1.3, COL.glass, cx + F.ux * dir * 0.03, Y0 + (y[0] + y[1]) / 2, cz + F.uz * dir * 0.03, F.yaw);
      }
    };
    for (const n of [-4.5, -9.3, -14.1]) { endWin(n, 0, -1); endWin(n, L, 1); }

    // pediment over the risalit, white frame, pink field, oval window
    const pedW = RISALIT.s1 - RISALIT.s0 + 0.6, pedH = 3.4;
    const tri = (w, hh) => { const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, hh); sh.closePath(); return sh; };
    const ped = (w, hh, depth, hex, n) => {
      const geo = new THREE.ExtrudeGeometry(tri(w, hh), { depth, bevelEnabled: false });
      G(geo, hex, (RISALIT.s0 + RISALIT.s1) / 2, n, FLOORS.top);
    };
    ped(pedW, pedH, 0.7, COL.white, RISALIT.out - 0.5);
    ped(pedW - 1.1, pedH - 0.55, 0.62, COL.pink, RISALIT.out - 0.5);
    const ring = new THREE.TorusGeometry(0.62, 0.11, 6, 18).scale(1.35, 1, 1);
    G(ring, COL.white, 18.2, RISALIT.out + 0.32, FLOORS.top + 1.25);
    G(new THREE.CircleGeometry(0.6, 18).scale(1.35, 1, 1), COL.glass, 18.2, RISALIT.out + 0.29, FLOORS.top + 1.25);

    // hipped roof of tiles: built in the hall's frame, each face turned to look outwards
    {
      const s0 = -ROOF.over, s1 = L + ROOF.over, n0 = -D - ROOF.over, n1 = ROOF.over, y = FLOORS.top, top = y + ROOF.rise;
      const nm = (n0 + n1) / 2, ri = (n1 - n0) / 2;
      const P = (s, n, yy) => [s, yy, n];
      const c = [s0, n0, s1, n1], k0 = P(s0, n0, y), k1 = P(s1, n0, y), k2 = P(s1, n1, y), k3 = P(s0, n1, y);
      const r0 = P(s0 + ri, nm, top), r1 = P(s1 - ri, nm, top);
      const pos = [];
      const mid = [(c[0] + c[2]) / 2, y, nm];
      const face = (a, b, d) => {
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const cx = (a[0] + b[0] + d[0]) / 3 - mid[0], cy = (a[1] + b[1] + d[1]) / 3 - mid[1], cz = (a[2] + b[2] + d[2]) / 3 - mid[2];
        if (nx * cx + ny * cy + nz * cz >= 0) pos.push(...a, ...b, ...d); else pos.push(...a, ...d, ...b);
      };
      face(k3, k2, r1); face(k3, r1, r0);       // front slope
      face(k0, k1, r1); face(k0, r1, r0);       // back slope
      face(k0, k3, r0); face(k1, k2, r1);       // hips
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.computeVertexNormals();
      G(geo, COL.roof, 0, 0, 0);
      // tile courses: thin darker ribs along the front and back slopes
      for (let k = 1; k < 9; k++) {
        const t = k / 9, yy = y + ROOF.rise * t, sA = s0 + ri * t, sB = s1 - ri * t;
        B(sA, sB, n1 - ri * t - 0.05, n1 - ri * t + 0.05, yy - FLOORS.top - 0.02 + FLOORS.top, yy + 0.06, COL.roofDark);
        B(sA, sB, n0 + ri * t - 0.05, n0 + ri * t + 0.05, yy - 0.02, yy + 0.06, COL.roofDark);
      }
      B(s0 + ri, s1 - ri, nm - 0.18, nm + 0.18, top - 0.1, top + 0.12, COL.roofDark);          // ridge
    }
    // two white chimneys either side of the tower
    for (const s of [11.7, 24.7]) {
      B(s - 0.55, s + 0.55, -6.6, -5.4, FLOORS.top + 2, FLOORS.top + ROOF.rise + 1.3, COL.white);
      B(s - 0.7, s + 0.7, -6.75, -5.25, FLOORS.top + ROOF.rise + 1.3, FLOORS.top + ROOF.rise + 1.55, COL.cream);
    }

    // the clock tower on the ridge
    {
      const s = TOWER.s, n = TOWER.n, y0 = FLOORS.top + ROOF.rise - 0.6;
      const yC = y0 + 3.2;                                                  // clock centre
      B(s - 1.8, s + 1.8, n - 1.8, n + 1.8, y0 - 1.5, y0 + 4.6, COL.tower);
      B(s - 2.0, s + 2.0, n - 2.0, n + 2.0, y0 + 4.6, y0 + 4.9, COL.towerDark);
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2, ds = Math.sin(a) * 1.83, dn = Math.cos(a) * 1.83;
        const disc = new THREE.CylinderGeometry(0.78, 0.78, 0.06, 20).rotateX(Math.PI / 2);
        G(disc, COL.gold, s + ds, n + dn, yC, a);
        G(new THREE.CylinderGeometry(0.68, 0.68, 0.08, 20).rotateX(Math.PI / 2), COL.clock, s + ds * 1.01, n + dn * 1.01, yC, a);
        G(BOX(0.06, 0.55, 0.04).translate(0, 0.22, 0), COL.iron, s + ds * 1.03, n + dn * 1.03, yC, a);                       // minute hand at twelve
        G(BOX(0.07, 0.4, 0.04).translate(0, 0.16, 0).rotateZ(-1.2), COL.iron, s + ds * 1.035, n + dn * 1.035, yC, a);      // hour hand
        // arched opening of the belfry above
        G(BOX(0.7, 1.3, 0.1), COL.towerDark, s + Math.sin(a) * 1.5, n + Math.cos(a) * 1.5, y0 + 6.2, a);
      }
      G(new THREE.CylinderGeometry(1.45, 1.55, 2.6, 8), COL.tower, s, n, y0 + 6.2, Math.PI / 8);
      G(new THREE.CylinderGeometry(1.75, 1.75, 0.25, 8), COL.towerDark, s, n, y0 + 7.55, Math.PI / 8);
      // bell cap: a lathe of a swelling profile
      const prof = [[1.7, 0], [1.75, 0.3], [1.55, 0.9], [1.0, 1.5], [0.55, 1.9], [0.42, 2.2], [0, 2.25]].map(([r, yy]) => new THREE.Vector2(r, yy));
      G(new THREE.LatheGeometry(prof, 8), COL.towerDark, s, n, y0 + 7.65, Math.PI / 8);
      G(new THREE.CylinderGeometry(0.42, 0.45, 1.0, 8), COL.tower, s, n, y0 + 10.3, Math.PI / 8);
      G(new THREE.ConeGeometry(0.55, 0.7, 8), COL.towerDark, s, n, y0 + 11.15, Math.PI / 8);
      G(new THREE.CylinderGeometry(0.05, 0.09, 2.2, 6), COL.iron, s, n, y0 + 12.5);
      G(new THREE.SphereGeometry(0.22, 10, 8), COL.gold, s, n, y0 + 12.0);
      G(BOX(0.7, 0.3, 0.03), COL.iron, s + 0.3, n, y0 + 13.3);                                                         // weathervane
    }

    // ================= the Kissing Students fountain
    {
      const { x, z } = FOUNTAIN, y = Math.min(h(x - 6, z), h(x + 6, z), h(x, z - 6), h(x, z + 6));
      p.add(new THREE.CylinderGeometry(6.3, 6.3, 1.0, 40), COL.granite, x, y - 0.25, z);
      p.add(new THREE.CylinderGeometry(5.5, 5.5, 0.5, 40), COL.graniteDark, x, y + 0.25, z);
      const basin = new THREE.LatheGeometry([[3.0, 0], [3.4, 0], [3.4, 0.75], [3.05, 0.75], [3.05, 0.2]].map(([r, yy]) => new THREE.Vector2(r, yy)), 36);
      p.add(basin, COL.graniteDark, x, y + 0.5, z);
      p.add(new THREE.CylinderGeometry(3.05, 3.05, 0.08, 36), COL.water, x, y + 1.05, z);
      p.add(new THREE.CylinderGeometry(0.85, 1.05, 1.5, 16), COL.granite, x, y + 1.6, z);                // pedestal
      p.add(new THREE.CylinderGeometry(1.0, 1.0, 0.15, 16), COL.graniteDark, x, y + 2.4, z);
      // two figures leaning into the kiss under one umbrella
      for (const d of [-1, 1]) {
        const fx = x + d * 0.3, b = 2.48 + y;
        p.add(new THREE.CylinderGeometry(0.22, 0.3, 1.35, 8).rotateZ(d * 0.12), COL.bronze, fx, b + 0.68, z);
        p.add(new THREE.SphereGeometry(0.17, 10, 8), COL.bronze, fx - d * 0.12, b + 1.5, z);
      }
      p.add(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 5).rotateZ(0.25), COL.bronze, x - 0.1, y + 3.7, z);
      p.add(new THREE.ConeGeometry(0.95, 0.42, 10, 1, true), COL.bronze, x - 0.25, y + 4.45, z);
      p.add(new THREE.ConeGeometry(0.95, 0.42, 10, 1, true).scale(0.98, 1, 0.98), COL.bronze, x - 0.25, y + 4.43, z, Math.PI);
      // water: jets round the pedestal rising and falling into the basin
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, r0 = 1.25;
        p.add(new THREE.CylinderGeometry(0.03, 0.07, 1.0, 5).rotateZ(-0.35).rotateY(-a), 0xeefaff, x + Math.cos(a) * (r0 + 0.17), y + 1.6, z + Math.sin(a) * (r0 + 0.17));
      }
      solids.push({ x, z, yaw: 0, hx: 3.4, hz: 3.4 });
    }

    // ================= street furniture
    // lantern on a black post with a hanging basket of flowers
    const lantern = (x, z, basket = true) => {
      const y = h(x, z);
      p.add(new THREE.CylinderGeometry(0.2, 0.24, 0.55, 8), COL.iron, x, y + 0.27, z);
      p.add(new THREE.CylinderGeometry(0.055, 0.075, 3.4, 8), COL.iron, x, y + 2.1, z);
      p.add(new THREE.CylinderGeometry(0.16, 0.1, 0.12, 6), COL.iron, x, y + 3.85, z);
      glow.add(new THREE.CylinderGeometry(0.2, 0.14, 0.5, 6), COL.lamp, x, y + 4.15, z);
      p.add(new THREE.ConeGeometry(0.28, 0.3, 6), COL.iron, x, y + 4.55, z);
      p.add(new THREE.SphereGeometry(0.05, 6, 4), COL.iron, x, y + 4.74, z);
      if (!basket) return;
      p.add(new THREE.TorusGeometry(0.42, 0.025, 4, 12).rotateX(Math.PI / 2), COL.iron, x, y + 2.95, z);
      const r = rnd(Math.round(x * 13 + z));
      for (let k = 0; k < 16; k++) {
        const a = r() * Math.PI * 2, rr = 0.25 + r() * 0.35, yy = 2.35 + r() * 0.65;
        p.add(new THREE.IcosahedronGeometry(0.13 + r() * 0.08, 0), k % 5 === 4 ? COL.leaf : COL.flower[Math.floor(r() * 4)], x + Math.cos(a) * rr, y + yy, z + Math.sin(a) * rr);
      }
    };
    const bench = (x, z, yaw) => {
      const y = h(x, z);
      p.box(2.2, 0.38, 0.55, COL.granite, x, y + 0.19, z, yaw);
      p.box(2.25, 0.07, 0.6, COL.wood, x, y + 0.42, z, yaw);
    };
    const bollard = (x, z) => { const y = h(x, z); p.add(new THREE.CylinderGeometry(0.17, 0.24, 0.8, 8), 0xd2bcb6, x, y + 0.4, z); p.add(new THREE.SphereGeometry(0.17, 8, 6), 0xd2bcb6, x, y + 0.8, z); };

    // along both rows of fronts: lanterns every ~16 m and benches between, 3.6 m out from the fronts
    const along = (line, side, step, start, fn) => {
      const len = [0];
      for (let k = 1; k < line.length; k++) len.push(len[k - 1] + Math.hypot(line[k][0] - line[k - 1][0], line[k][1] - line[k - 1][1]));
      for (let d = start; d < len[len.length - 1]; d += step) {
        let k = 1;
        while (k < line.length - 1 && len[k] < d) k++;
        const a = line[k - 1], b = line[k], t = (d - len[k - 1]) / (len[k] - len[k - 1]);
        const dx = (b[0] - a[0]) / (len[k] - len[k - 1]), dz = (b[1] - a[1]) / (len[k] - len[k - 1]);
        fn(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, -dz * side, dx * side, Math.atan2(-dz, dx));
      }
    };
    along(SOUTH, -1, 16, 6, (x, z, nx, nz) => lantern(x + nx * 3.6, z + nz * 3.6));
    along(NORTH, 1, 16, 6, (x, z, nx, nz) => { if (!TERRACES.some(([a, b]) => x > a - 1 && x < b + 1)) lantern(x + nx * 3.6, z + nz * 3.6); else lantern(x + nx * 1.8, z + nz * 1.8, false); });
    along(SOUTH, -1, 16, 14, (x, z, nx, nz, yaw) => bench(x + nx * 4.2, z + nz * 4.2, yaw));
    for (const s of [2.5, 33.9]) { const [x, z] = F.at(s, 4.2); lantern(x, z); }
    for (const s of [6, 30.4]) { const [x, z] = F.at(s, 5.4); bench(x, z, F.yaw); }
    // bollards across the mouth of Rüütli, between the hall and the north row
    for (let k = 0; k <= 4; k++) { const t = k / 4; bollard(1386.8 + (1391.6 - 1386.8) * t + 2.0, 2840.0 + (2831.4 - 2840.0) * t + 1.0); }

    // cafe terraces with a deck, white planter fence, square white umbrellas, tables and chairs
    for (const [xa, xb] of TERRACES) {
      // the stretch of the north row between xa and xb
      const at = (x) => { for (let k = 1; k < NORTH.length; k++) { const a = NORTH[k - 1], b = NORTH[k]; if (x >= a[0] && x <= b[0]) { const t = (x - a[0]) / (b[0] - a[0]); return [x, a[1] + (b[1] - a[1]) * t]; } } return null; };
      const A = at(xa), Bq = at(xb);
      if (!A || !Bq) continue;
      const T = frame(A, Bq), [n0, n1] = TERRACE_N, len = T.len;
      const yT = Math.max(h(...T.at(0, n0)), h(...T.at(len, n0)), h(...T.at(0, n1)), h(...T.at(len, n1)));
      const TB = (s0, s1, a0, a1, y0, y1, hex) => { const [x, z] = T.at((s0 + s1) / 2, (a0 + a1) / 2); p.box(s1 - s0, y1 - y0, a1 - a0, hex, x, yT + (y0 + y1) / 2, z, T.yaw); };
      TB(0, len, n0, n1, -1.2, 0.12, COL.deck);
      // fence: planter boxes every ~2.4 m along the front and the two ends, white panels between
      const planter = (s, a) => {
        TB(s - 0.28, s + 0.28, a - 0.28, a + 0.28, 0.12, 0.85, COL.white);
        const r = rnd(Math.round(s * 31 + a * 7 + xa));
        for (let k = 0; k < 5; k++) {
          const [x, z] = T.at(s + (r() - 0.5) * 0.4, a + (r() - 0.5) * 0.4);
          p.add(new THREE.IcosahedronGeometry(0.14, 0), k === 4 ? COL.leaf : COL.flower[Math.floor(r() * 4)], x, yT + 0.98 + r() * 0.1, z);
        }
      };
      const nP = Math.max(2, Math.round(len / 2.4));
      for (let k = 0; k <= nP; k++) planter((k / nP) * len, n1);
      for (const s of [0, len]) for (let a = n0 + 0.4; a < n1 - 0.5; a += 2.2) planter(s, a);
      TB(0, len, n1 - 0.03, n1 + 0.03, 0.2, 0.75, COL.white);
      TB(-0.03, 0.03, n0, n1, 0.2, 0.75, COL.white);
      TB(len - 0.03, len + 0.03, n0, n1, 0.2, 0.75, COL.white);
      // umbrellas over pairs of tables
      const nU = Math.max(1, Math.round(len / 4.4));
      for (let k = 0; k < nU; k++) {
        const s = ((k + 0.5) / nU) * len, a = (n0 + n1) / 2;
        const [x, z] = T.at(s, a);
        p.add(new THREE.CylinderGeometry(0.04, 0.04, 2.7, 6), COL.white, x, yT + 1.45, z);
        p.add(new THREE.ConeGeometry(3.0, 0.75, 4, 1, true), COL.umbrella, x, yT + 2.85, z, T.yaw + Math.PI / 4);
        for (const ds of [-1.05, 1.05]) {
          const [tx, tz] = T.at(s + ds, a);
          p.box(0.75, 0.05, 0.75, 0x3e3a4a, tx, yT + 0.86, tz, T.yaw);
          p.add(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 5), 0x3e3a4a, tx, yT + 0.48, tz);
          for (const da of [-0.62, 0.62]) {
            const [cx, cz] = T.at(s + ds, a + da);
            p.box(0.44, 0.05, 0.44, COL.chair, cx, yT + 0.58, cz, T.yaw);
            p.box(0.44, 0.5, 0.05, COL.chair, ...T.at(s + ds, a + da * 1.32).flatMap((v, i) => (i ? [yT + 0.85, v] : [v])), T.yaw);
          }
        }
      }
      const [cx, cz] = T.at(len / 2, (n0 + n1) / 2);
      solids.push({ x: cx, z: cz, yaw: T.yaw, hx: len / 2, hz: (n1 - n0) / 2 });
    }

    // ================= ground: granite setts over the square, slab bands along the fronts, across, round the fountain
    const band = (line, side, w) => {
      const off = line.map((q, k) => {
        const a = line[Math.max(0, k - 1)], b = line[Math.min(line.length - 1, k + 1)];
        const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
        return [q[0] - (dz / l) * side * w, q[1] + (dx / l) * side * w];
      });
      return [[...line, ...off.reverse()]];
    };
    const circle = (x, z, r, n = 48) => Array.from({ length: n }, (_, k) => [x + Math.cos((k / n) * Math.PI * 2) * r, z + Math.sin((k / n) * Math.PI * 2) * r]);
    // straight bands across the square, cut at the two rows of fronts
    const cross = (x, w) => {
      const hit = (line) => { for (let k = 1; k < line.length; k++) { const a = line[k - 1], b = line[k]; if (x >= a[0] && x <= b[0]) return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]); } return null; };
      const zn = hit(NORTH), zs = hit(SOUTH);
      if (zn === null || zs === null) return null;
      return [[[x - w / 2, zn], [x + w / 2, zn], [x + w / 2, zs], [x - w / 2, zs]]];
    };
    const slabs = [
      band(NORTH, 1, 2.6), band(SOUTH, -1, 2.6),
      [[HALL.a, HALL.b, F.at(L, 3.6), F.at(0, 3.6)]],
      [circle(FOUNTAIN.x, FOUNTAIN.z, 7.6), circle(FOUNTAIN.x, FOUNTAIN.z, 6.25).reverse()],
      ...[1440, 1468, 1496].map((x) => cross(x, 1.4)).filter(Boolean),
    ];
    const mat = (map, f) => new THREE.MeshLambertMaterial({ map, polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f, side: THREE.DoubleSide });
    const addG = (g, m) => { if (!g) return; const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; group.add(mesh); };
    const square = drapeGeometry(world, [[SQUARE]], 0.06, 2, 2), slabG = drapeGeometry(world, slabs, 0.075, 3, 2);
    markGround(square, LOOK.SETTS, 0.06); markGround(slabG, LOOK.PAVED, 0.075);      // for the tyre marks
    addG(square, mat(settTex(), -3));
    addG(slabG, mat(slabTex(), -4));

    const m = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    if (m) { m.castShadow = shadows; m.receiveShadow = true; group.add(m); }
    const gm = glow.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    if (gm) group.add(gm);
    world.addSolids(solids);
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 450) return;
      if ([HALL.a, HALL.b, NORTH[NORTH.length - 1], SOUTH[SOUTH.length - 1]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
