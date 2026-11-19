// Küüni tänav from the first corner of the lap (the turn into Vallikraavi) up to Raekoja plats (Martin, 19 Nov,
// from his Street View shots of July 2014 and the 2024 orthophoto), in pastel takes on the real colours:
//   - the park stretch: a clipped hedge along the Barclay park on the left, the row of big lindens on the right
//     in their gravel beds with benches and lamp posts, the yellow kvass trailer by the Poe corner;
//   - the Anderson's Taproom kiosk on the Poe corner with its little terrace, and the big hologram of the
//     Anderson's drop over the corner (hologram.js);
//   - the pedestrian stretch from Poe to Raekoja plats: the painted fronts of Küüni 5 (pale yellow, blue-grey
//     plinth, lanterns on brackets, flags at the door), the salmon house and the cream corner house on the
//     left, the cream shop fronts on the right; lindens in square planters with concrete benches, cafe
//     terraces with lattice fences, planters and square umbrellas, parked bicycles, bins.
//   - the ground: pale grey pavers along the shops, the red herringbone strip down the middle with a stepped edge
//     to the darker grey pavers along the west fronts, dark grey pavers and rough granite bands at the Poe
//     crossing (the park stretch keeps the red tint laid from Kaubamaja); no generated road lines north of Poe.
// Street names are never painted on the ground (Martin, 18 Nov).
import * as THREE from 'three';
import { Parts, BOX } from '../race/landmarks.js';
import { streetKit, setHouseColours, paverTex } from './streetkit.js';
import { drapeGeometry } from './drape.js';
import { skinHouses } from './houseskin.js';
import { createHologram } from './hologram.js';

// ---- frames
// the pedestrian stretch: s along the east fronts from the Poe corner towards Raekoja plats, w across to the west
const E0 = [1496.3, 2918.4], EU = [-0.5288, -0.8488], EL = [-0.8488, 0.5288];
const N = (s, w) => [E0[0] + EU[0] * s + EL[0] * w, E0[1] + EU[1] * s + EL[1] * w];
const NYAW = Math.atan2(-EU[1], EU[0]);                       // a box's local x along s
const westW = (s) => 20.05 + (s + 2) * 0.016;                 // where the west fronts stand
// the park stretch: t from the hedge's south-east end towards Poe, r across to the north-east of the hedge line
const S0 = [1526.0, 2982.0], SU = [-0.668, -0.744], SR = [0.744, -0.668];
const S = (t, r) => [S0[0] + SU[0] * t + SR[0] * r, S0[1] + SU[1] * t + SR[1] * r];
const SYAW = Math.atan2(-SU[1], SU[0]);
// the lindens on the park stretch carry on the row of limes on the right of the start/finish straight
// (trackside.js: 3.6 m beyond the lap's edge, every 11 m, which ends at t = -14, r = 21.6), and so do their
// gravel beds, benches, lamp posts and the bin (Martin, 19 Nov: they stood out in the middle of the street)
const ROW_T = [8, 19, 30, 41];                                // (one at 52 would stand in Poe)
const ROW = (t) => 21.6 - 0.025 * (t + 14);                  // the row's r, drifting as the start straight's does

// where the generated road lines are left out: Küüni beyond the first corner, the Poe crossing
const inN = (x, z, s0, s1, w0, w1) => { const dx = x - E0[0], dz = z - E0[1], s = dx * EU[0] + dz * EU[1], w = dx * EL[0] + dz * EL[1]; return s > s0 && s < s1 && w > w0 && w < w1; };
export function kuuniVectors(vectors) {
  const prev = vectors.markSkip;
  vectors.markSkip = (x, z) => inN(x, z, -18, 76, -3, 22) || (prev ? prev(x, z) : false);
}

export const HOLOGRAM = { x: 1487.0, z: 2939.0, url: 'https://andersonbeer.com/' };
const CENTRE = [1480, 2915];

// house colours for the LOD walls the paintings do not cover (sides, backs, roofs)
export function kuuniWalls(walls) {
  setHouseColours(walls, '3_5', 1120, 2400, [
    { base: 360, x: 1466.0, z: 2914.0, wall: 0xf4e4b4, roof: 0xd38f80, reach: 30 },        // Küüni 5, pale yellow
    { base: 392, x: 1490.0, z: 2906.0, wall: 0xf5eedb, roof: 0xcf8d7c, reach: 26 },        // the cream shop house on the Poe corner
    { base: 529, x: 1470.5, z: 2948.3, wall: 0xf2ebdc, roof: 0x5e5258, reach: 10 },        // the taproom kiosk
  ]);
}

// ---- the paintings
const WHITE = '#fbf8f0';
const shopFronts = (P, W, { from = 0.8, bay = 4.4, sills = [0.3, 3.5], seed = 1 } = {}) => {
  const words = ['KOHVIK', 'RAAMATUD', 'REISID', 'KOMMID', 'KINGAD', 'LILLED', 'PAGAR', 'OPTIKA', 'SUVENIIRID', 'KELLAD'];
  const signs = ['#6d4a5a', '#3f5a7a', '#9a3f48', '#2f6a5e', '#7a5a3a', '#4a4a62'];
  let k = seed;
  for (let x = from; x + bay - 0.6 < W.len; x += bay, k++) {
    const x0 = x, x1 = x + bay - 0.8;
    if (Math.max(W.botAt(x0), W.botAt(x1)) > 0.6) continue;
    P.r(x0 - 0.12, sills[0] - 0.1, x1 + 0.12, sills[1] + 0.12, '#3d3a46');
    const door = k % 3 === 0;
    if (door) {
      P.r(x0, sills[0], x0 + 1.1, sills[1], '#5c6a84'); P.r(x0 + 0.52, sills[0], x0 + 0.58, sills[1], '#3d3a46');
      P.grad(x0 + 1.25, sills[0] + 0.5, x1, sills[1], '#6a7a98', '#4a5670');
    } else {
      const lit = k % 4 === 1;
      if (lit) P.grad(x0, sills[0] + 0.4, x1, sills[1], '#fff0c8', '#f2cf98'); else P.grad(x0, sills[0] + 0.4, x1, sills[1], '#6a7a98', '#48526c');
      P.r(x0, sills[0], x1, sills[0] + 0.4, '#3d3a46');
      P.r((x0 + x1) / 2 - 0.04, sills[0], (x0 + x1) / 2 + 0.04, sills[1], '#3d3a46');
    }
    // the shop's name board over its window
    const sc = signs[k % signs.length], wd = words[(k * 7) % words.length];
    P.r(x0 + 0.3, sills[1] + 0.25, x1 - 0.3, sills[1] + 0.85, sc);
    P.text(wd, (x0 + x1) / 2, sills[1] + 0.55, 0.36, '#fbf3e4', '700 %px Arial, sans-serif');
  }
};
// stucco panels over the first-floor windows of Küüni 5
const reliefs = (P, W) => {
  const n = Math.max(1, Math.round((W.len - 0.6) / 3.2));
  for (let k = 0; k < n; k++) {
    const x = ((k + 0.5) * W.len) / n;
    P.r(x - 0.75, 9.3, x + 0.75, 9.95, '#efdcac');
    P.r(x - 0.62, 9.4, x + 0.62, 9.85, '#f7ead0');
    P.arc(x, 9.62, 0.18, '#e9d39c');
  }
};
const SPEC = {
  kuuni5: { kind: 'plaster', wall: [246, 230, 182], trim: '#fcf6e6', plinth: { h: 1.35, type: 'plaster', col: '#a3aecb', vents: 3.2 }, corners: 0.32, belts: [5.6, 13.6], eaves: 0.7,
    floors: [{ sill: 2.3, h: 2.15 }, { sill: 6.55, h: 2.2 }, { sill: 10.6, h: 2.05 }], win: { w: 1.25, pitch: 3.2, frame: WHITE, T: false, bars: 1, rails: 1, surround: 0.14, sc: '#fcf6e6', hood: 0.12, glass: '#5a6884' },
    door: '#80604e', attic: null, lit: 0.12 },
  salmon: { kind: 'plaster', wall: [228, 156, 134], trim: '#f6e6dc', plinth: { h: 0.9, type: 'plaster', col: '#a49ea8' }, corners: false, belts: [4.6], eaves: 0.5,
    floors: [{ sill: 1.6, h: 2.0 }, { sill: 5.6, h: 1.95 }, { sill: 9.2, h: 1.9 }, { sill: 12.6, h: 1.7 }], win: { w: 1.1, pitch: 2.7, frame: WHITE, T: true, surround: 0.1, sc: '#f6e6dc' }, attic: null },
  creamCorner: { kind: 'plaster', wall: [248, 236, 198], trim: '#fdf8ea', plinth: { h: 1.0, type: 'plaster', col: '#b0b2c0' }, corners: 0.3, belts: [4.8], eaves: 0.6,
    floors: [{ sill: 1.9, h: 2.0 }, { sill: 5.9, h: 2.05 }, { sill: 9.6, h: 1.95 }, { sill: 13.0, h: 1.6 }], win: { w: 1.15, pitch: 2.9, frame: WHITE, T: false, bars: 1, rails: 1, surround: 0.12, sc: '#fdf8ea', hood: 0.1 }, attic: null },
  shops: { kind: 'plaster', wall: [246, 238, 216], trim: '#fdfaf2', plinth: { h: 0.3, type: 'plaster', col: '#8e8a94' }, corners: 0.25, belts: [4.4], eaves: 0.55,
    floors: [{ sill: 5.3, h: 1.75 }, { sill: 8.7, h: 1.75 }, { sill: 12.1, h: 1.7 }], win: { w: 1.25, pitch: 3.0, frame: WHITE, T: true, surround: 0.1, sc: '#fdfaf2' }, attic: null },
  shops2: { kind: 'plaster', wall: [242, 230, 204], trim: '#fbf5e6', plinth: { h: 0.3, type: 'plaster', col: '#8e8a94' }, corners: 0.25, belts: [4.4], eaves: 0.55,
    floors: [{ sill: 5.3, h: 1.75 }, { sill: 8.7, h: 1.75 }, { sill: 12.1, h: 1.7 }], win: { w: 1.2, pitch: 2.8, frame: WHITE, T: true, surround: 0.1, sc: '#fbf5e6' }, attic: null },
  kiosk: { kind: 'plaster', wall: [242, 234, 216], trim: '#5a463c', plinth: { h: 0.45, type: 'plaster', col: '#8c8890' }, corners: 0.16, eaves: 0.3,
    floors: [{ sill: 0.95, h: 1.55 }], win: { w: 1.5, pitch: 2.1, frame: '#5a463c', T: false, bars: 1, surround: 0.05, sc: '#5a463c', glass: '#4a5670' }, attic: { w: 1.4, h: 1.1, bars: 2 }, door: '#5a463c', lit: 0.5 },
};
// a wall belongs to the street when it is near the street's middle and looks at it
const nearSeg = (x, z, a, b, d) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
  return Math.hypot(a[0] + dx * k - x, a[1] + dz * k - z) < d;
};
const HOUSES = [
  { name: 'kuuni5', sec: '3_5', base: 360, at: [1468, 2915], r: 28, spec: SPEC.kuuni5,
    walls: [{ near: N(20, westW(20)), within: 12, draw: reliefs, doors: [{ x: 23.2, w: 1.5, h: 3.0, col: '#80604e', light: 0.6, panels: 3, steps: 2 }] }] },
  { name: 'salmon', sec: '3_5', base: 412, at: [1452.8, 2886.9], r: 9, pick: (x, z) => nearSeg(x, z, [1456.8, 2893.3], [1448.7, 2880.4], 1.5), spec: SPEC.salmon,
    walls: [{ near: [1452.8, 2886.9], within: 4, doors: [{ x: 7.6, w: 1.3, h: 2.6, col: '#7a5a50', light: 0.5 }] }] },
  { name: 'creamCorner', sec: '3_5', base: 412, at: [1442.5, 2870.8], r: 10, pick: (x, z) => nearSeg(x, z, [1447.2, 2878.2], [1437.9, 2863.4], 1.5), spec: SPEC.creamCorner,
    walls: [{ near: [1442.5, 2870.8], within: 4, doors: [{ x: 8.8, w: 1.4, h: 2.8, col: '#80604e', light: 0.6, panels: 3 }] }] },
  { name: 'shops392', sec: '3_5', base: 392, at: [1492, 2906], r: 26, pick: (x, z) => nearSeg(x, z, [1509.9, 2909.9], [1496.3, 2918.4], 1.5) || nearSeg(x, z, [1496.3, 2918.4], [1477.4, 2888.2], 1.5),
    spec: SPEC.shops, walls: [{ near: [1486.85, 2903.3], within: 6, draw: (P, W) => shopFronts(P, W, { seed: 2 }) }, { near: [1503.1, 2914.15], within: 4, draw: (P, W) => shopFronts(P, W, { seed: 5, from: 1.4 }) }] },
  { name: 'shops239', sec: '3_5', base: 239, at: [1467.4, 2872], r: 22, pick: (x, z) => nearSeg(x, z, [1477.4, 2888.2], [1457.3, 2855.8], 1.5),
    spec: SPEC.shops2, walls: [{ near: [1467.35, 2872.0], within: 6, draw: (P, W) => shopFronts(P, W, { seed: 7, bay: 4.8 }) }] },
  { name: 'kiosk', sec: '3_5', base: 529, at: [1470.5, 2948.3], r: 9, spec: SPEC.kiosk,
    walls: [{ near: [1476.3, 2946.1], within: 2.5, doors: [{ x: 2.6, w: 1.0, h: 2.2, col: '#5a463c', frame: '#5a463c', light: 0.5, panels: 1 }],
      draw: (P) => { P.r(0.5, 2.75, 4.6, 3.25, '#1e1c26'); P.text("ANDERSON'S TAPROOM", 2.55, 3.0, 0.3, '#7fe8ff', '800 %px Arial, sans-serif'); } }] },
];

// the map's trees pick their species from a hash of where they stand: nudge each one a few centimetres until it
// comes out a lime (species 0 in scenery.js), not a birch
const PLANTERS = [6, 15, 24, 33, 42, 51, 60, 68];
function lime([x, z], height, crown) {
  for (let k = 0; k < 40; k++) {
    const fx = Math.fround(x + (k % 7) * 0.03), fz = Math.fround(z + Math.floor(k / 7) * 0.03);
    if (Math.abs(Math.sin(fx * 12.9898 + fz * 78.233) * 43758.5453) % 1 >= 0.3) return [fx, fz, height, crown, 0];
  }
  return [x, z, height, crown, 0];
}


// ---- the ground
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
function rand(seed) { let v = seed; return () => { v = (v * 9301 + 49297) % 233280; return v / 233280; }; }
// red clay bricks, 20 x 10 cm, in a herringbone; one tile is 1.6 m
function herringboneTex() {
  return canvasTex(256, (g, n) => {
    const r = rand(17), u = 16;
    g.fillStyle = 'rgb(176,116,110)'; g.fillRect(0, 0, n, n);
    const brick = (cx, cy, w, h) => {
      const v = 0.9 + r() * 0.16;
      g.fillStyle = `rgb(${Math.min(255, 232 * v) | 0},${Math.min(255, 158 * v) | 0},${Math.min(255, 146 * v) | 0})`;
      for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) g.fillRect(cx * u + ox + 1, cy * u + oy + 1, w * u - 2, h * u - 2);
    };
    // a staircase of a lying and a standing brick per step, staircases four cells apart
    for (let k = -2; k < n / u / 4 + 2; k++) for (let m = 0; m < n / u; m++) {
      const x = m, y = m + 4 * k;
      brick(x % (n / u), ((y % (n / u)) + n / u) % (n / u), 2, 1);
      brick(x % (n / u), (((y + 1) % (n / u)) + n / u) % (n / u), 1, 2);
    }
  });
}
// rough light granite setts of all sizes; one tile is 2 m
function graniteTex() {
  return canvasTex(256, (g, n) => {
    const r = rand(23);
    g.fillStyle = 'rgb(150,146,158)'; g.fillRect(0, 0, n, n);
    for (let y = 6; y < n + 10; y += 15 + r() * 6) {
      for (let x = -r() * 20; x < n; ) {
        const w = 14 + r() * 22, h = 12 + r() * 8, v = 0.86 + r() * 0.2, warm = r() < 0.3;
        g.fillStyle = `rgb(${(warm ? 236 : 224) * v | 0},${(warm ? 222 : 222) * v | 0},${(warm ? 214 : 230) * v | 0})`;
        g.beginPath(); g.ellipse(x + w / 2, y, w / 2, h / 2, (r() - 0.5) * 0.4, 0, 7); g.fill();
        if (y > n - 14) { g.beginPath(); g.ellipse(x + w / 2, y - n, w / 2, h / 2, 0, 0, 7); g.fill(); }
        x += w + 2;
      }
    }
  });
}
function rotateUV(geo, ang) {
  if (!geo) return geo;
  const uv = geo.attributes.uv, c = Math.cos(ang), sn = Math.sin(ang);
  for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, u * c - v * sn, u * sn + v * c); }
  return geo;
}
function pave(world, group) {
  const rect = (F, a0, a1, b0, b1) => [[F(a0, b0), F(a1, b0), F(a1, b1), F(a0, b1)]];      // one shape: its outer ring
  // the west pavement's edge to the red strip steps in and out every 6 m
  const STEP = 6, edge = (k) => (k % 2 ? 16.1 : 15.3);
  const steps = [];
  for (let s = -1.5, k = 0; s < 74; s += STEP, k++) steps.push([s, Math.min(74, s + STEP), edge(k)]);
  const west = steps.map(([a, b, e]) => [[N(a, e), N(b, e), N(b, westW(b) + 0.3), N(a, westW(a) + 0.3)]]);
  const red = steps.map(([a, b, e]) => [[N(a, 10.4), N(b, 10.4), N(b, e), N(a, e)]]);
  const ang = Math.atan2(EU[1], EU[0]) + Math.PI / 4;
  const layer = (shapes, map, lift, f, tile, rot = 0) => {
    const g = rotateUV(drapeGeometry(world, shapes, lift, tile, 1.6), rot);
    if (!g) return;
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map, polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f, side: THREE.DoubleSide }));
    m.receiveShadow = true;
    group.add(m);
  };
  layer([rect(N, -1.5, 74.2, -0.3, 10.4)], paverTex([216, 214, 226], 3), 0.07, -4, 1.6);                    // the shop side
  layer(west, paverTex([164, 162, 180], 9), 0.075, -4, 1.6);                                                    // along the west fronts
  layer(red, herringboneTex(), 0.075, -4, 1.6, -ang);                                                           // the red strip
  layer([rect(N, -15.5, -1.5, -2.2, 21.2)], paverTex([178, 174, 184], 11), 0.07, -4, 1.6);                        // the Poe crossing
  layer([rect(N, -15.5, -13.6, -0.4, 21.2), rect(N, -15.5, -1.5, -2.4, -0.4), rect(N, -1.9, -0.4, -0.4, 21.0)], graniteTex(), 0.085, -6, 2);
  // the park stretch keeps the see-through red brick tint of the Kaubamaja end (keskustee.js), so nothing is laid there
}

export function createKuuni(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;
  const holo = createHologram(scene, world, { ...HOLOGRAM });

  // the lindens the map has no trees for: the row in the gravel beds on the park stretch, the planters up the street
  const PARK_TREES = ROW_T.map((t, k) => lime(S(t, ROW(t)), 16 + (k % 3) * 1.6, 8.5 + (k % 2)));
  const STREET_TREES = PLANTERS.map((s, k) => lime(N(s, 4.6), 12.5 + (k % 3) * 1.0, (12.5 + (k % 3) * 1.0) * 0.58));
  world.addTrees([...PARK_TREES, ...STREET_TREES]);

  function build() {
    built = true;
    const faces = (W) => nearSeg(W.mid[0], W.mid[1], N(-20, 10), N(76, 10), 16) || Math.hypot(W.mid[0] - HOLOGRAM.x, W.mid[1] - HOLOGRAM.z) < 20;
    skinHouses(world, group, HOUSES, { faces, shadows, debug: !!window.__skinDebug });
    pave(world, group);

    const K = streetKit(world, group, { shadows });
    const { p } = K;
    const h = (x, z) => world.heightAt(x, z);
    const glow = [];
    const solids = [];
    // a box in the street frame: s along, w across (from the east fronts), y above the ground there
    const nb = (s, w, len, wid, y0, y1, hex, yaw = 0) => { const [x, z] = N(s, w); p.add(BOX(len, y1 - y0, wid), hex, x, h(x, z) + (y0 + y1) / 2, z, NYAW + yaw); };
    const sb = (t, r, len, wid, y0, y1, hex, yaw = 0) => { const [x, z] = S(t, r); p.add(BOX(len, y1 - y0, wid), hex, x, h(x, z) + (y0 + y1) / 2, z, SYAW + yaw); };

    // ================= the park stretch
    // the clipped hedge along the park, on a low granite kerb
    {
      const t0 = 12, t1 = 49.5, n = Math.round((t1 - t0) / 1.6), hr = 1.0;
      for (let k = 0; k <= n; k++) {
        const t = t0 + ((t1 - t0) * k) / n, [x, z] = S(t, hr - 0.75), y = h(x, z);
        if (K.leafy.ok) K.leafy.bush(x, y - 0.02, z, 2.0, 1.15, SYAW + k, [0.82, 0.95, 0.82], 1.25);
        else p.add(BOX(1.7, 1.05, 1.2), 0x5e9a5e, x, y + 0.52, z, SYAW);
      }
      sb((t0 + t1) / 2, hr - 0.04, t1 - t0 + 1, 0.18, -0.2, 0.14, 0xd6d2dc);
      const [cx, cz] = S((t0 + t1) / 2, hr - 0.75);
      solids.push({ x: cx, z: cz, yaw: SYAW, hx: (t1 - t0) / 2 + 0.6, hz: 0.65 });
    }
    // gravel beds round the lindens, benches facing the street, lamp posts between
    for (const [k, t] of ROW_T.entries()) {
      const r = ROW(t);
      sb(t, r + 0.2, 6.2, 5.0, -0.2, 0.04, 0xcbbfae);                     // the bed
      sb(t, r - 2.4, 6.2, 0.16, -0.2, 0.1, 0xb9b4c2);                      // its kerb
      if (k < ROW_T.length - 1) {
        const tb = t + 5.5, rb = ROW(tb);                                  // half way to the next tree
        sb(tb, rb - 3.0, 2.0, 0.45, 0.42, 0.48, 0xa8806e); sb(tb, rb - 2.75, 2.0, 0.06, 0.48, 0.92, 0xa8806e);  // seat and back
        for (const d of [-0.85, 0.85]) sb(tb + d, rb - 2.95, 0.08, 0.5, 0, 0.44, 0x34313f);
        const [bx, bz] = S(tb, rb - 2.95);
        solids.push({ x: bx, z: bz, yaw: SYAW, hx: 1.05, hz: 0.35 });
      }
    }
    // the yellow kvass trailer by the Poe corner, with its umbrella and a table
    {
      const t = 43.5, r = 11.4, [x, z] = S(t, r), y = h(x, z);
      const tank = new THREE.CylinderGeometry(1.0, 1.0, 3.4, 20).rotateZ(Math.PI / 2);
      p.add(tank, 0xf6c048, x, y + 1.55, z, SYAW);
      for (const d of [-1.7, 1.7]) p.add(new THREE.SphereGeometry(1.0, 16, 10).scale(0.35, 1, 1), 0xf6c048, ...S(t + d, r).flatMap((v, i) => (i ? [y + 1.55, v] : [v])), SYAW);
      sb(t, r, 3.6, 1.6, 0.45, 0.6, 0x4a4652);
      for (const d of [-0.85, 0.85]) { const [wx, wz] = S(t, r + d); p.add(new THREE.CylinderGeometry(0.36, 0.36, 0.18, 14).rotateX(Math.PI / 2), 0x2a2830, wx, y + 0.36, wz, SYAW + Math.PI / 2); }
      sb(t + 2.6, r, 1.6, 0.12, 0.45, 0.55, 0x4a4652);
      sb(t - 1.2, r - 0.95, 0.6, 0.12, 1.1, 1.7, 0xd9d4e0);              // the tap box
      const [ux, uz] = S(t - 2.6, r - 2.4), uy = h(ux, uz);
      p.add(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 6), 0xe8e4ee, ux, uy + 1.2, uz);
      p.add(new THREE.ConeGeometry(1.5, 0.55, 8, 1, true), 0xe84a4a, ux, uy + 2.45, uz);
      sb(t - 2.6, r - 2.4, 0.7, 0.7, 0.72, 0.76, 0xe8e4ee);
      for (const d of [-0.7, 0.7]) sb(t - 2.6 + d, r - 2.4, 0.42, 0.42, 0.44, 0.48, 0x4c4858);
      solids.push({ x, z, yaw: SYAW, hx: 2.4, hz: 1.1 });
    }

    // ================= the kiosk's terrace on the Poe corner: barrel tables, an umbrella, planters
    {
      const F = [1479.6, 2946.0], y = h(...F), yaw = Math.atan2(-0.2, 0.98);
      for (const [dx, dz] of [[-0.6, -1.4], [0.9, 0.6], [-0.4, 1.9]]) {
        const bx = F[0] + dx, bz = F[1] + dz, by = h(bx, bz);
        p.add(new THREE.CylinderGeometry(0.34, 0.3, 1.0, 12), 0x8a5a3e, bx, by + 0.5, bz);
        for (const hy of [0.22, 0.78]) p.add(new THREE.CylinderGeometry(0.355, 0.355, 0.05, 12), 0x3a3640, bx, by + hy, bz);
        p.add(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 12), 0x5a463c, bx, by + 1.02, bz);
      }
      p.add(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 6), 0xf2eee6, F[0] + 0.2, y + 1.25, F[1]);
      p.add(new THREE.ConeGeometry(2.1, 0.6, 4, 1, true), 0xf6f2ea, F[0] + 0.2, y + 2.55, F[1], yaw + Math.PI / 4);
      for (const dz of [-2.6, 2.9]) {
        const [px, pz] = [F[0] + 1.6, F[1] + dz];
        p.add(BOX(1.1, 0.55, 0.5), 0x8a5a3e, px, h(px, pz) + 0.27, pz, yaw);
        for (let k = 0; k < 4; k++) p.add(new THREE.IcosahedronGeometry(0.17, 0), [0xe8456a, 0xfaf0f4, 0xf06a8c, 0x5f9a5e][k], px - 0.4 + k * 0.27, h(px, pz) + 0.65, pz, yaw);
      }
    }

    // ================= the pedestrian stretch
    // lindens in square planters with a timber edge, concrete benches beside them
    for (const [k, s] of PLANTERS.entries()) {
      for (const [ds, dw, l, wd] of [[0, -1.1, 2.4, 0.16], [0, 1.1, 2.4, 0.16], [-1.1, 0, 0.16, 2.2], [1.1, 0, 0.16, 2.2]]) nb(s + ds, 4.6 + dw, l, wd, -0.1, 0.38, 0x9a7a62);
      nb(s, 4.6, 2.1, 2.05, -0.1, 0.3, 0xb8ab9a);                          // bark and gravel inside
      const [px, pz] = N(s, 4.6);
      solids.push({ x: px, z: pz, yaw: NYAW, hx: 1.2, hz: 1.2 });
      if (k < PLANTERS.length - 1 && k % 2 === 0) {
        const bs = s + 3.6;
        for (let j = 0; j < 4; j++) nb(bs, 4.6 - 0.27 + j * 0.18, 2.0, 0.12, 0.3, 0.45, 0xc9c6cf);   // the slatted top
        nb(bs, 4.6, 1.9, 0.62, 0, 0.3, 0xb2afba);
        const [bx, bz] = N(bs, 4.6);
        solids.push({ x: bx, z: bz, yaw: NYAW, hx: 1.0, hz: 0.35 });
      }
      if (k % 3 === 1) { const [bx, bz] = N(s + 2.0, 6.0); p.add(new THREE.CylinderGeometry(0.28, 0.28, 0.95, 10), 0x8e8a96, bx, h(bx, bz) + 0.47, bz); }
    }
    // cafe terraces between the trees and the middle of the street
    for (const [s0, s1, seed] of [[10, 20, 1], [28, 43, 2], [50, 64, 3]]) {
      const w0 = 7.0, w1 = 10.4, sm = (s0 + s1) / 2, len = s1 - s0;
      nb(sm, (w0 + w1) / 2, len, w1 - w0, -0.15, 0.1, 0x9a8a92);                // the deck
      // the fence: green lattice panels between dark planter boxes of flowers
      const planter = (s, w) => {
        nb(s, w, 0.6, 0.6, 0.1, 0.85, 0x6e4e48);
        const [x, z] = N(s, w), y = h(x, z);
        for (let j = 0; j < 4; j++) p.add(new THREE.IcosahedronGeometry(0.16, 0), [0xe8456a, 0xfaf0f4, 0xf06a8c, 0x5f9a5e][(j + seed) % 4], x + (j % 2 - 0.5) * 0.3, y + 1.0 + (j > 1 ? 0.08 : 0), z + (j > 1 ? 0.15 : -0.15));
      };
      const nP = Math.max(2, Math.round(len / 2.5));
      for (let j = 0; j <= nP; j++) {
        const s = s0 + (len * j) / nP;
        planter(s, w1);
        if (j < nP) {
          const sMid = s + len / nP / 2, pl = len / nP - 0.6;
          nb(sMid, w1, pl, 0.05, 0.2, 0.95, 0x7aa486);
          for (let q = -2; q <= 2; q++) nb(sMid + q * pl / 5, w1 + 0.04, 0.05, 0.05, 0.2, 0.95, 0x5e8a6a, 0.6);
          nb(sMid, w1, pl, 0.07, 0.92, 0.98, 0x5e8a6a);
        }
      }
      for (const s of [s0, s1]) planter(s, w0 + 0.4);
      // square umbrellas over pairs of tables
      const nU = Math.max(1, Math.round(len / 4.6));
      for (let j = 0; j < nU; j++) {
        const s = s0 + ((j + 0.5) * len) / nU, w = (w0 + w1) / 2 - 0.2, [x, z] = N(s, w), y = h(x, z);
        p.add(new THREE.CylinderGeometry(0.045, 0.045, 2.7, 6), 0xf0ece4, x, y + 1.45, z);
        p.add(new THREE.ConeGeometry(2.6, 0.7, 4, 1, true), 0xf8f3e8, x, y + 2.85, z, NYAW + Math.PI / 4);
        for (const ds of [-1.0, 1.0]) {
          nb(s + ds, w, 0.72, 0.72, 0.84, 0.88, 0x3e3a4a);
          const [tx, tz] = N(s + ds, w);
          p.add(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 5), 0x3e3a4a, tx, h(tx, tz) + 0.48, tz);
          for (const dw of [-0.6, 0.6]) { nb(s + ds, w + dw, 0.44, 0.44, 0.44, 0.49, 0x5a4e58); nb(s + ds, w + dw * 1.3, 0.44, 0.05, 0.49, 0.95, 0x5a4e58); }
        }
      }
      const [cx, cz] = N(sm, (w0 + w1) / 2);
      solids.push({ x: cx, z: cz, yaw: NYAW, hx: len / 2, hz: (w1 - w0) / 2 });
    }
    // lanterns on curly brackets with baskets of flowers along Küüni 5 and the corner house; flags at their doors
    const wallLantern = (s, y) => {
      const wf = westW(s), [x, z] = N(s, wf - 0.45), g = h(x, z);
      nb(s, wf - 0.32, 0.06, 0.64, y + 0.55, y + 0.61, 0x2c2a34);
      nb(s, wf - 0.2, 0.05, 0.4, y + 0.2, y + 0.26, 0x2c2a34, 0);
      p.add(new THREE.CylinderGeometry(0.16, 0.1, 0.1, 6), 0x2c2a34, x, g + y + 0.5, z);
      glow.push([new THREE.CylinderGeometry(0.17, 0.12, 0.42, 6), 0xfff0c4, x, g + y + 0.24, z]);
      p.add(new THREE.ConeGeometry(0.24, 0.24, 6), 0x2c2a34, x, g + y + 0.56, z);
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9;
        p.add(new THREE.IcosahedronGeometry(0.12, 0), [0xe8456a, 0xf06a8c, 0xfaf0f4, 0x5f9a5e][k % 4], x + Math.cos(a) * 0.22, g + y - 0.35 - (k % 3) * 0.12, z + Math.sin(a) * 0.22);
      }
    };
    for (const s of [6, 15.5, 31, 39.5, 47.5, 66]) wallLantern(s, 3.5);
    const flag = (s, stripes) => {
      const wf = westW(s), [x0, z0] = N(s, wf), g = h(x0, z0), a = 0.6;
      const pole = new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6).translate(0, 1.3, 0).rotateZ(-a);
      p.add(pole, 0xe8e4ee, x0, g + 4.4, z0, NYAW - Math.PI / 2);
      const ex = 2.6 * Math.sin(a), ey = 2.6 * Math.cos(a), hh = 1.1 / stripes.length;
      stripes.forEach((col, k) => { const [cx, cz] = N(s, wf - ex + 0.06); p.add(BOX(0.03, hh, 1.6), col, cx, g + 4.4 + ey - 0.05 - hh * (k + 0.5), cz, NYAW); });
    };
    flag(19.9, [0x3a7bd5, 0x1c1c22, 0xf4f4f6]); flag(22.6, [0xf4f4f6, 0xd8323c]);
    flag(70.4, [0x3a7bd5, 0x1c1c22, 0xf4f4f6]);
    // bicycles parked along Küüni 5
    const bike = (s, w, col) => {
      const [x, z] = N(s, w), y = h(x, z);
      for (const d of [-0.52, 0.52]) { const [bx, bz] = N(s, w + d); p.add(new THREE.TorusGeometry(0.33, 0.03, 4, 14), 0x22222a, bx, y + 0.34, bz, NYAW + Math.PI / 2); }
      p.add(BOX(0.04, 0.04, 1.0), col, x, y + 0.55, z, NYAW);
      p.add(BOX(0.04, 0.5, 0.04), col, ...N(s, w + 0.15).flatMap((v, i) => (i ? [y + 0.6, v] : [v])), NYAW);
      p.add(BOX(0.5, 0.04, 0.06), 0x22222a, ...N(s, w - 0.45).flatMap((v, i) => (i ? [y + 0.95, v] : [v])), NYAW);
      p.add(BOX(0.12, 0.05, 0.26), 0x22222a, ...N(s, w + 0.18).flatMap((v, i) => (i ? [y + 0.88, v] : [v])), NYAW);
    };
    [[18.6, 0x3c6ea0], [19.6, 0xd8d4dc], [20.5, 0x9a3f48], [21.6, 0x2c2a34]].forEach(([s, c]) => bike(s, westW(s) - 1.0, c));
    // the street's lamp posts on the park stretch: tall poles with a flat head
    // (knockable props, see kuuniProps)

    const gp = new Parts();
    for (const g of glow) gp.add(...g);
    const gm = gp.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    if (gm) group.add(gm);
    K.finish();
    world.addSolids(solids);
  }

  return {
    holo,
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 500) return;
      if ([N(-2, 10), N(74, 10), S(12, 6), [1470, 2948]].every((q) => world.ready(q[0], q[1]))) build();
    },
    frame(dt, camera) { holo.update(dt, camera); },
  };
}

// knockable street furniture on the park stretch: [kind, x, z, bearing]
export function kuuniProps() {
  const LIGHT = 0, BIN = 4;
  const deg = (Math.atan2(SU[0], -SU[1]) * 180) / Math.PI;      // the bearing of the street towards Poe
  const out = [];
  // on the right, in the row of lindens like the start straight's lamps (1.4 m in front of its trees): the head over the street
  for (const t of [13.5, 35.5]) { const [x, z] = S(t - 2, ROW(t) - 1.4); out.push([LIGHT, x, z, deg - 90]); }
  for (const t of [24.5]) { const [x, z] = S(t + 1.6, ROW(t) - 3.0); out.push([BIN, x, z, deg]); }       // beside a bench
  return out;
}
