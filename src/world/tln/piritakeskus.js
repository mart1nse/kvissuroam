// The end of Kloostrimetsa tee before the lap's left turn onto Merivälja tee (Martin, 28 Nov 2026, with Street View
// shots of June and August 2024 and a marked air photo: "on the right hand side there is a white house, detail that
// house please. also in front of the house there are a few features ... pink line: higher kerb. yellow circle: big
// tree! so you cannot widen the outside of the corner before turning in. Also on the left turn itself, there is a
// bit more bushes, a few smaller trees and greenery").
//
//  - Pirita Keskus, the white shopping centre on the right. The map's own block for it is only the tall hall behind;
//    what the street sees is built here in front of it: the white drum on the corner (the wood-lined entrance with
//    its two columns, the band of dark windows under a canopy, the portholes, the Rimi letters, the red PIRITA
//    letters on the roof), the two-storey wing along Kloostrimetsa tee with the terrace railing on top and the
//    parcel lockers at its foot, and the glazed wing along Merivälja tee. One painted picture for all of it.
//  - A higher kerb (18 cm) on his pink lines: round the plaza's corner, behind the parking bays and round the tree's
//    island that reaches out to the road's edge between them; and on the other side along the park, round the real
//    corner's curve to where the Rummu corner's kerb begins.
//  - The big tree on that island (solid, like every tree), the planters, two advert stands, the sign gantry.
//  - On the left turn: a tree by the gantry's pole, three small ones, the shrubbery and the hedge behind the pavement.
//
// Nothing stands on the carriageway. Built as the car comes near, in steps through the work queue; the kerbs, the
// trees and the solid things are known from the start.
import * as THREE from 'three';
import { jobs } from '../../jobs.js';
import { still } from '../../still.js';
import { painter } from '../houseskin.js';
import { paintScale } from '../paintscale.js';
import { leafyPlants, setHouseColours } from '../streetkit.js';
import { createKerb, rounded, shaped } from './kerb.js';
import { MERI_IN, meriIn } from '../../race/piritaedge.js';

const KERB_H = 0.18;
const E = (x) => -579.5 - 0.1175 * (x + 670);      // Kloostrimetsa tee's north edge on the air photo (z at x)
const B = (x) => E(x) - 6.2;                       // the back of the parking bays
const ISLAND = [-656.5, -653.1];                   // the tree's island between the bays (x from, to)
const TREE = [-654.8, -583.6];
// the park side's kerb round the real corner (the road fans out here: the painted edge is 10 m further in)
// (the inside of the turn onto Merivälja tee is one round curve since 28 Nov, src/race/piritaedge.js; the real kerb's
// own line, traced from the air photo, was up to 3 m further in and kinked)
const I_SOUTH = 2168, I_ARC = MERI_IN.i0, I_BACK = MERI_IN.i1, I_END = 2219;       // lap points: the park kerb's start, where the curve takes over, back on the lap's edge, its end

// ---- the house
const DRUM_C = [-668, -607];
// the drum's roof edge on the air photo, from its north end on the Merivälja side round to the wing
const DRUM_EDGE = [[-685.0, -618], [-685.0, -612], [-684.9, -605], [-684.2, -600.5], [-682.5, -596.5], [-680, -593.6], [-677, -591.9], [-673.5, -591.0], [-670, -590.7], [-666.5, -591.1], [-663.6, -592.0]];
const DRUM_H = 11.3, WING_H = 7.2, WEST_H = 6.5, RAIL = 1.1;
const WING_END = [-623.6, -597.6];                                    // the east end of the wing's front on Kloostrimetsa tee (it begins at the drum's end)
const WEST = [[-679.4, -639.4], [-684.2, -618]];                       // the glazed wing's front on Merivälja tee, north to south
const ENTRANCE = [-684.1, -600.2];                                     // the middle of the entrance on the drum
const LOCKERS = [[2.3, 3.3, 0xc8102e], [5.6, 3.0, 0x8d9196], [8.9, 7.6, 0xf26a1b], [16.7, 2.4, 0xffcc00]];   // from (m along the wing), width, colour
// planters (wooden boxes with grasses), advert stands [x, z, facing], the gantry's two poles
const PLANTERS = [[-676.0, -583.6], [-677.7, -581.6], [-679.4, -579.9], [-687.8, -603.2], [-685.9, -605.4], [-690.3, -597.6]];
const ADS = [[-672.3, -583.4, 0.12], [-688.9, -595.2, 1.45]];
const GANTRY = [[-681.6, -579.7], [-679.8, -566.8]];
// trees on the turn: [x, z, height, crown] (broad-leaved), and the shrubbery [x, z, width, height]
const TREES = [[TREE[0], TREE[1], 10.5, 10], [-683.6, -563.4, 12, 8.5], [-690.6, -557.4, 6, 4.2], [-695.8, -551.2, 5.5, 3.6], [-700.6, -545.0, 6.5, 4.2]];
const SHRUBS = [
  [-692.6, -555.4, 3.2, 1.9], [-691.4, -552.6, 3.4, 2.2], [-693.2, -550.2, 3.0, 1.8], [-689.6, -549.6, 2.8, 2.0],      // the dark mass behind the pavement
  [-698.6, -549.6, 3.0, 1.6], [-700.4, -546.4, 3.2, 1.7], [-702.0, -543.0, 3.2, 1.6], [-703.2, -539.6, 3.0, 1.7], [-704.2, -536.2, 3.0, 1.6], [-705.0, -532.8, 2.8, 1.5],   // the hedge along the pavement
  [-681.6, -565.0, 2.2, 1.5], [-685.6, -562.2, 2.4, 1.6], [-679.0, -563.6, 2.0, 1.3],                                   // round the gantry's pole
  [-672.4, -565.6, 2.6, 1.0], [-668.2, -566.4, 2.4, 0.9], [-663.6, -567.2, 2.6, 1.0],                                   // clipped mounds in the lawn
  [-646, -598.6, 2.0, 0.8], [-642, -599.0, 2.0, 0.8], [-638, -599.5, 2.0, 0.8], [-634, -599.9, 2.0, 0.8], [-630, -600.3, 2.0, 0.8], [-626.4, -600.7, 2.0, 0.8],   // the low bed at the wing's foot
];

// the map's hall behind: white, a dark roof
export function piritaKeskusWalls(walls) {
  setHouseColours(walls, '0_0', -800, -800, [{ base: 523, x: -640, z: -618, wall: 0xf1f0ec, roof: 0x55585c, reach: 75 }]);
}

const cumOf = (line) => { const c = [0]; for (let j = 1; j < line.length; j++) c.push(c[j - 1] + Math.hypot(line[j][0] - line[j - 1][0], line[j][1] - line[j - 1][1])); return c; };
// the stretch of a polyline between a and b metres along it: [[x, z, metres along], ...]
function between(line, cum, a, b) {
  const pt = (s) => { let j = 0; while (j < cum.length - 2 && cum[j + 1] < s) j++; const t = (s - cum[j]) / ((cum[j + 1] - cum[j]) || 1); return [line[j][0] + (line[j + 1][0] - line[j][0]) * t, line[j][1] + (line[j + 1][1] - line[j][1]) * t, s]; };
  const out = [pt(a)];
  for (let j = 0; j < line.length; j++) if (cum[j] > a + 0.01 && cum[j] < b - 0.01) out.push([line[j][0], line[j][1], cum[j]]);
  out.push(pt(b));
  return out;
}

// lap: { at(s, o), SS } of pirita.js; L: its lay() (road widths)
export function createPiritaKeskus(scene, world, lap, L, { shadows = true } = {}) {
  const { at, SS } = lap;
  const group = still(new THREE.Group());
  scene.add(group);

  // ---- the kerbs (the pavement on their left)
  const front = (x) => [x, E(x) - 0.25];
  const north = shaped([
    [-691.5, -616], [-693.0, -606], [-694.6, -596], [-695.0, -588], [-694.0, -583.6], [-691.2, -580.2], front(-687),
    front(-671.8), [-671.8, B(-671.8)], [ISLAND[0], B(ISLAND[0])], front(ISLAND[0]), front(ISLAND[1]), [ISLAND[1], B(ISLAND[1])],
    [-590.6, B(-590.6)], [-590.0, B(-590.0) - 4.5],
  ]);
  const south = [];
  for (let s = SS[I_SOUTH]; s < SS[I_ARC] - 1; s += 2) { const p = at(s, -L.W[at(s)[4]] / 2); south.push([p[0], p[1]]); }
  for (let k = 0; k <= 24; k++) south.push(meriIn(k / 24).slice(0, 2));
  for (let s = SS[I_BACK] + 2; s <= SS[I_END] + 2; s += 2) { const p = at(s, -L.W[at(s)[4]] / 2); south.push([p[0], p[1]]); }
  const kerb = createKerb(world, group, [north, rounded(south, 2)], { H: KERB_H, name: 'kloostrimetsa kerb' });

  // ---- the house's lines
  const drum = rounded(DRUM_EDGE.map(([x, z]) => { const d = Math.hypot(x - DRUM_C[0], z - DRUM_C[1]); return [x - ((x - DRUM_C[0]) / d) * 0.8, z - ((z - DRUM_C[1]) / d) * 0.8]; }), 1);
  const drumCum = cumOf(drum), drumLen = drumCum[drumCum.length - 1];
  let uE = 0;
  { let bd = Infinity; drum.forEach((p, j) => { const d = Math.hypot(p[0] - ENTRANCE[0], p[1] - ENTRANCE[1]); if (d < bd) { bd = d; uE = drumCum[j]; } }); }
  const WING = [drum[drum.length - 1], WING_END];
  const wingLen = Math.hypot(WING[1][0] - WING[0][0], WING[1][1] - WING[0][1]), westLen = Math.hypot(WEST[1][0] - WEST[0][0], WEST[1][1] - WEST[0][1]);
  // a line's unit way and its inward side (into the house: to the left of the way it is drawn)
  const frame = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l; return { ux, uz, ix: uz, iz: -ux, l }; };
  const FW = frame(WING[0], WING[1]), FS = frame(WEST[0], WEST[1]);

  // ---- the trees and the solid things, known before the map squares come
  world.addTrees(TREES.map(([x, z, h, c]) => [x, z, h, c, 0]));
  {
    const solids = [];
    const slab = (a, b, depth) => { const f = frame(a, b); solids.push({ x: (a[0] + b[0]) / 2 + f.ix * depth / 2, z: (a[1] + b[1]) / 2 + f.iz * depth / 2, yaw: Math.atan2(-f.uz, f.ux), hx: f.l / 2 + 0.15, hz: depth / 2 }); };
    for (let j = 0; j + 1 < drum.length; j++) slab(drum[j], drum[j + 1], 1.4);
    slab(WING[0], WING[1], 3.2);
    slab(WEST[0], WEST[1], 5);
    for (const [u, w] of LOCKERS) slab([WING[0][0] + FW.ux * u - FW.ix * 0.8, WING[0][1] + FW.uz * u - FW.iz * 0.8], [WING[0][0] + FW.ux * (u + w) - FW.ix * 0.8, WING[0][1] + FW.uz * (u + w) - FW.iz * 0.8], 0.8);
    for (const [x, z] of PLANTERS) solids.push({ x, z, yaw: Math.PI / 4, hx: 0.55, hz: 0.55 });
    for (const [x, z, yaw] of ADS) solids.push({ x, z, yaw, hx: 0.35, hz: 0.65 });
    for (const [x, z] of GANTRY) solids.push({ x, z, yaw: 0, hx: 0.2, hz: 0.2 });
    world.addSolids(solids);
  }

  // ---- the picture: every painted face of the house in one canvas (metres on it: x along, y up)
  const ppm = 24 * paintScale();
  const SHEET_W = Math.max(drumLen, wingLen) + 0.5;
  const R = {};                                           // name -> { x, y (metres from the sheet's top left), w, y0, y1 }
  {
    let y = 0;
    const row = (list) => { let x = 0, h = 0; for (const [name, w, y0, y1] of list) { R[name] = { x, y, w, y0, y1 }; x += w + 0.25; h = Math.max(h, y1 - y0); } y += h + 0.25; };
    row([['drum', drumLen, -0.4, DRUM_H]]);
    row([['wing', wingLen, -0.4, WING_H + RAIL]]);
    row([['west', westLen, -0.4, WEST_H + RAIL], ['lockers', 16.8, 0, 2.3]]);
    row([['pirita', 12.4, 0, 2.2], ['ad', 1.3, 0, 1.9], ['board', 3.6, 0, 1.7]]);
    R.h = y;
  }
  let tex = null;
  function* paint() {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(SHEET_W * ppm); cv.height = Math.ceil(R.h * ppm);
    const c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    const P = (name) => { const r = R[name]; return painter(c, r.x * ppm, r.y * ppm, r.w, r.y0, r.y1, ppm); };
    const WHITE = '#f1f0ec', GREY = '#b4b4b0', GLASS = '#2b3848', GLASS2 = '#141b24', FRAME = '#3a4048';
    const rails = (p, len, y) => {
      for (let x = 0.04; x < len; x += 1.5) p.r(x - 0.035, y, x + 0.035, y + RAIL - 0.05, '#6c7177');
      for (const dy of [0.32, 0.64, RAIL - 0.1]) p.r(0, y + dy, len, y + dy + 0.055, '#6c7177');
    };
    {   // the drum
      const p = P('drum'), len = drumLen, a = Math.max(1.5, uE - 12), b = Math.min(len - 2.2, uE + 20.5);
      p.r(0, -0.4, len, DRUM_H, WHITE);
      p.weather(0, 0, len, DRUM_H, 0.35, 5);
      p.r(0, -0.4, len, 0.22, GREY);
      // the band of windows, leaning out under its canopy
      p.r(a - 0.2, 6.1, b + 0.2, 6.3, '#c6c6c2');
      p.grad(a, 6.3, b, 8.75, GLASS, GLASS2);
      for (let x = a; x <= b + 0.01; x += (b - a) / Math.round((b - a) / 2.9)) p.r(x - 0.045, 6.3, x + 0.045, 8.75, FRAME);
      p.r(a, 7.5, b, 7.56, FRAME);
      p.r(a - 0.2, 8.75, b + 0.2, 8.95, '#8c9094');
      p.r(0, DRUM_H - 0.16, len, DRUM_H, '#96989a');
      p.text('K E S K U S', uE, 9.95, 0.62, '#d2233c', '700 %px Arial, sans-serif');
      // the entrance: wood round a recess of dark glass, three steps, two white columns
      p.r(uE - 4.7, 0, uE + 4.7, 4.4, '#8b5b36');
      for (let x = uE - 4.7; x < uE + 4.7; x += 0.16) p.r(x, 0, x + 0.02, 4.4, '#75492a');
      p.grad(uE - 3.7, 0.45, uE + 3.7, 3.95, '#27313b', '#0e1318');
      for (let x = uE - 3.7; x <= uE + 3.71; x += 1.85) p.r(x - 0.04, 0.45, x + 0.04, 3.95, '#4a5058');
      p.r(uE - 3.7, 2.75, uE + 3.7, 2.81, '#4a5058');
      p.grad(uE - 0.85, 0.45, uE + 0.85, 2.75, '#3a4652', '#1b232b');
      p.r(uE - 0.03, 0.45, uE + 0.03, 2.75, '#9aa0a6');
      p.r(uE - 3.7, 0, uE + 3.7, 0.45, '#a9a7a1');
      for (const y of [0.15, 0.3]) p.r(uE - 3.7, y - 0.012, uE + 3.7, y + 0.012, '#7d7b76');
      for (const x of [uE - 1.75, uE + 1.75]) { p.r(x - 0.17, 0.45, x + 0.17, 4.4, '#ecebe6'); p.r(x + 0.09, 0.45, x + 0.17, 4.4, '#cfcec9'); }
      p.text('Rimi', uE + 0.05, 5.17, 1.3, '#7e8286', 'italic 700 %px Arial, sans-serif');
      p.text('Rimi', uE, 5.22, 1.3, '#c2c5c9', 'italic 700 %px Arial, sans-serif');
      // the portholes
      for (const x of [uE - 8.6, Math.min(len - 3.2, uE + 17.6)]) {
        if (x < 1.2) continue;
        p.arc(x, 2.95, 1.0, '#d5d5d1'); p.arc(x, 2.95, 0.88, '#161d26'); p.r(x - 0.03, 2.07, x + 0.03, 3.83, '#59606a');
      }
    }
    yield;
    {   // the wing on Kloostrimetsa tee: a row of dark windows upstairs, the gym's signs, the railing of the terrace
      const p = P('wing'), len = wingLen;
      p.r(0, -0.4, len, WING_H, WHITE);
      p.weather(0, 0, len, WING_H, 0.3, 9);
      p.r(0, -0.4, len, 0.2, GREY);
      for (let x = 1.5; x + 2.3 < len - 0.8; x += 3.15) p.win(x, 3.95, x + 2.3, 5.4, { frame: FRAME, glass: GLASS, fw: 0.06, bars: 1, sill: 0.06, sc: '#cfcfcb' });
      for (let x = 20.4; x + 2.3 < len - 0.8; x += 6.3) p.win(x, 1.0, x + 2.3, 2.5, { frame: FRAME, glass: GLASS, fw: 0.06, bars: 1, sill: 0.06, sc: '#cfcfcb' });
      p.text('my', 5.2, 3.3, 0.5, '#d2233c', 'italic 700 %px Arial, sans-serif');
      p.text('fitness', 6.9, 3.3, 0.5, '#6f7378', 'italic 700 %px Arial, sans-serif');
      p.r(9.1, 3.05, 12.3, 3.55, '#2f6fb5'); p.text('FITPOINTEE', 10.7, 3.3, 0.34, '#ffffff', '700 %px Arial, sans-serif');
      p.r(0, WING_H - 0.14, len, WING_H, '#96989a');
      rails(p, len, WING_H);
    }
    yield;
    {   // the glazed wing on Merivälja tee
      const p = P('west'), len = westLen;
      p.r(0, -0.4, len, WEST_H, WHITE);
      p.r(0, -0.4, len, 0.2, GREY);
      for (let x = 0.5; x + 2.3 < len; x += 2.7) for (const [ya, yb] of [[0.5, 3.0], [3.55, 5.95]]) p.win(x, ya, x + 2.3, yb, { frame: '#e6e5e0', glass: GLASS, fw: 0.07, bars: 1, sill: 0 });
      p.r(0, WEST_H - 0.14, len, WEST_H, '#96989a');
      rails(p, len, WEST_H);
    }
    {   // the parcel lockers' fronts
      const p = P('lockers'), u0 = LOCKERS[0][0];
      for (const [u, w, hex] of LOCKERS) {
        const x = u - u0, col = `#${hex.toString(16).padStart(6, '0')}`;
        p.r(x, 0, x + w, 2.3, col);
        for (let q = x + 0.5; q < x + w - 0.2; q += 0.5) p.r(q - 0.012, 0.12, q + 0.012, 2.0, 'rgba(0,0,0,0.28)');
        for (let y = 0.12; y < 2.05; y += 0.31) p.r(x + 0.06, y - 0.012, x + w - 0.06, y + 0.012, 'rgba(0,0,0,0.28)');
        p.r(x + w / 2 - 0.3, 0.9, x + w / 2 + 0.3, 1.55, '#20242a'); p.r(x + w / 2 - 0.24, 1.2, x + w / 2 + 0.24, 1.5, '#5d7f9c');
        p.r(x, 2.04, x + w, 2.3, col);
      }
      p.text('dpd', 1.65, 2.17, 0.24, '#ffffff'); p.text('omniva', 6.6 + 3.8, 2.17, 0.24, '#ffffff'); p.text('DHL', 14.4 + 1.2, 2.17, 0.24, '#d40511', 'italic 700 %px Arial, sans-serif');
    }
    yield;
    {   // the red letters on the roof, a poster, the gantry's dark board
      const p = P('pirita');
      p.text('PIRITA', 6.2, 1.12, 2.5, '#d2233c', '700 %px Arial, sans-serif');
      p.text('PIRITA', 6.2, 1.12, 2.5, 'rgba(255,120,140,0.35)', '400 %px Arial, sans-serif');
      const a = P('ad');
      a.r(0, 0, 1.3, 1.9, '#2a2d33'); a.grad(0.07, 0.07, 1.23, 1.83, '#2f7fd0', '#184a8a'); a.arc(0.78, 0.8, 0.36, '#ffd23c');
      a.text('PIRITA', 0.65, 1.52, 0.2, '#ffffff'); a.text('KESKUS', 0.65, 1.3, 0.13, '#ffffff'); a.r(0.2, 0.26, 1.1, 0.3, '#ffffff');
      const b = P('board');
      b.r(0, 0, 3.6, 1.7, '#16181c'); b.r(0.08, 0.08, 3.52, 1.62, '#22252a');
      for (const y of [0.55, 1.1]) b.r(0.08, y - 0.015, 3.52, y + 0.015, '#16181c');
    }
    yield 'frame';
    tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    jobs.upload(tex);
  }

  // ---- the shapes
  function* build() {
    yield* paint();
    yield;
    const h = (x, z) => world.heightAt(x, z);
    const G = h(-672, -589.5);                                           // the plaza's level at the drum's foot
    const tp = [], tu = [], ti = [];                                     // painted faces
    const cp = [], cc = [], ci = [];                                     // plain coloured ones
    const col = new THREE.Color();
    const uvOf = (name, x, y) => { const r = R[name]; return [(r.x + x) / SHEET_W, 1 - (r.y + (r.y1 - y)) / R.h]; };
    // an upright painted face along [[x, z, metres along]...] from ya to yb over G, out of the picture `name` (its x shifted by -x0)
    // (ta, tb: the picture's own heights for ya and yb, where they differ)
    const wall = (pts, ya, yb, name, x0 = 0, ta = ya, tb = yb) => {
      const n = tp.length / 3;
      pts.forEach(([x, z, s], k) => {
        tp.push(x, G + ya, z, x, G + yb, z);
        tu.push(...uvOf(name, s - x0, ta), ...uvOf(name, s - x0, tb));
        if (k) { const a = n + k * 2; ti.push(a - 2, a, a - 1, a - 1, a, a + 1); }
      });
    };
    const quad = (pts, hex, k = 1) => {            // four corners [x, y, z]
      const n = cp.length / 3;
      col.set(hex).multiplyScalar(k);
      for (const q of pts) { cp.push(q[0], q[1], q[2]); cc.push(col.r, col.g, col.b); }
      ci.push(n, n + 1, n + 2, n, n + 2, n + 3);
    };
    // a box w along its yaw, d across, from y0 to y1 with its foot's middle at (x, z)
    const box = (x, z, y0, y1, w, d, yaw, hex, top = hex) => {
      const cs = Math.cos(yaw), sn = Math.sin(yaw), c = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([a, b]) => [x + a * cs + b * sn, z - a * sn + b * cs]);
      for (let k = 0; k < 4; k++) { const a = c[k], b = c[(k + 1) % 4]; quad([[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], hex, k % 2 ? 0.86 : 1); }
      quad(c.map((q) => [q[0], y1, q[1]]), top, 1.05);
    };
    const pole = (x, z, y0, y1, r, hex) => { for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.2832, b = ((k + 1) / 6) * 6.2832; quad([[x + Math.cos(a) * r, y0, z + Math.sin(a) * r], [x + Math.cos(b) * r, y0, z + Math.sin(b) * r], [x + Math.cos(b) * r, y1, z + Math.sin(b) * r], [x + Math.cos(a) * r, y1, z + Math.sin(a) * r]], hex, 0.82 + 0.2 * Math.abs(Math.cos(a + 0.6))); } };

    // the drum: its wall, the red letters standing on it, the canopy over the windows, the roof
    wall(drum.map((p, j) => [p[0], p[1], drumCum[j]]), -0.4, DRUM_H, 'drum');
    wall(between(drum, drumCum, uE - 6.2, uE + 6.2), DRUM_H - 0.05, DRUM_H + 2.15, 'pirita', uE - 6.2, 0, 2.2);
    {
      const pts = between(drum, drumCum, Math.max(1.5, uE - 12) - 0.3, Math.min(drumLen - 2.2, uE + 20.5) + 0.3);
      for (let k = 0; k + 1 < pts.length; k++) {
        const out = (p) => { const d = Math.hypot(p[0] - DRUM_C[0], p[1] - DRUM_C[1]); return [p[0] + ((p[0] - DRUM_C[0]) / d) * 1.0, p[1] + ((p[1] - DRUM_C[1]) / d) * 1.0]; };
        const a = pts[k], b = pts[k + 1], ao = out(a), bo = out(b);
        quad([[a[0], G + 8.98, a[1]], [b[0], G + 8.98, b[1]], [bo[0], G + 8.9, bo[1]], [ao[0], G + 8.9, ao[1]]], 0x9ea2a6);
        quad([[ao[0], G + 8.9, ao[1]], [bo[0], G + 8.9, bo[1]], [bo[0], G + 8.78, bo[1]], [ao[0], G + 8.78, ao[1]]], 0x7c8084);
      }
      const n = cp.length / 3, top = G + DRUM_H - 0.12;
      col.set(0x4c4f54);
      cp.push(DRUM_C[0], top, DRUM_C[1]); cc.push(col.r, col.g, col.b);
      drum.forEach((p, j) => { cp.push(p[0], top, p[1]); cc.push(col.r, col.g, col.b); if (j) ci.push(n, n + j, n + j + 1); });
      for (const p of [drum[0], drum[drum.length - 1]]) quad([[p[0], G + 6, p[1]], [DRUM_C[0], G + 6, DRUM_C[1]], [DRUM_C[0], top, DRUM_C[1]], [p[0], top, p[1]]], 0xf1f0ec);
    }
    yield;
    // the two wings: the painted front with its railing, the deck behind, the end wall
    const wingOf = (line, F, len, hgt, name, depth, deck) => {
      wall([[line[0][0], line[0][1], 0], [line[1][0], line[1][1], len]], -0.4, hgt + RAIL, name);
      const a = line[0], b = line[1], a2 = [a[0] + F.ix * depth, a[1] + F.iz * depth], b2 = [b[0] + F.ix * depth, b[1] + F.iz * depth];
      deck(a, b, a2, b2);
      for (const [p, q] of [[a, a2], [b, b2]]) quad([[p[0], G - 0.4, p[1]], [q[0], G - 0.4, q[1]], [q[0], G + hgt, q[1]], [p[0], G + hgt, p[1]]], 0xf1f0ec, 0.94);
    };
    const flat = (a, b, a2, b2, y, hex) => quad([[a[0], y, a[1]], [b[0], y, b[1]], [b2[0], y, b2[1]], [a2[0], y, a2[1]]], hex);
    wingOf(WING, FW, wingLen, WING_H, 'wing', 3.3, (a, b, a2, b2) => flat(a, b, a2, b2, G + WING_H - 0.1, 0xd9cfb4));
    wingOf(WEST, FS, westLen, WEST_H, 'west', 9, (a, b, a2, b2) => {
      // (the terrace's north part is laid with green turf)
      const m = [a[0] + (b[0] - a[0]) * 0.62, a[1] + (b[1] - a[1]) * 0.62], m2 = [a2[0] + (b2[0] - a2[0]) * 0.62, a2[1] + (b2[1] - a2[1]) * 0.62];
      flat(a, m, a2, m2, G + WEST_H - 0.1, 0x5f9a4a); flat(m, b, m2, b2, G + WEST_H - 0.1, 0xcfc9b8);
    });
    // the lockers at the wing's foot: a painted front, plain sides and top
    {
      const u0 = LOCKERS[0][0], yaw = Math.atan2(-FW.uz, FW.ux);
      for (const [u, w, hex] of LOCKERS) {
        const at2 = (s, o) => [WING[0][0] + FW.ux * s - FW.ix * o, WING[0][1] + FW.uz * s - FW.iz * o];
        const m = at2(u + w / 2, 0.42);
        box(m[0], m[1], G - 0.1, G + 2.3, w, 0.78, yaw, hex, 0x8b8f94);
        const a = at2(u, 0.82), b = at2(u + w, 0.82);
        wall([[a[0], a[1], u - u0], [b[0], b[1], u + w - u0]], 0, 2.3, 'lockers');
      }
    }
    yield;
    // planters, advert stands, the gantry
    for (const [x, z] of PLANTERS) { const y = h(x, z); box(x, z, y - 0.05, y + 0.72, 1.1, 1.1, Math.PI / 4, 0x7b5b45, 0x3c3a30); }
    for (const [x, z, yaw] of ADS) {
      const y = h(x, z), cs = Math.cos(yaw), sn = Math.sin(yaw);
      box(x, z, y - 0.05, y + 0.5, 0.18, 0.5, yaw, 0x2a2d33);
      box(x, z, y + 0.5, y + 2.45, 0.2, 1.36, yaw, 0x2a2d33);
      for (const sd of [-1, 1]) {            // the poster on both faces
        const a = [x + cs * 0.11 * sd - sn * 0.65 * sd, z - sn * 0.11 * sd - cs * 0.65 * sd], b = [x + cs * 0.11 * sd + sn * 0.65 * sd, z - sn * 0.11 * sd + cs * 0.65 * sd];
        const n = tp.length / 3, pts = [[a, 0], [b, 1.3]];
        pts.forEach(([q, s]) => { tp.push(q[0], y + 0.53, q[1], q[0], y + 2.43, q[1]); tu.push(...uvOf('ad', s, 0), ...uvOf('ad', s, 1.9)); });
        ti.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      }
    }
    {
      const [N, S] = GANTRY, yN = h(N[0], N[1]), yS = h(S[0], S[1]), top = Math.max(yN, yS) + 6.7;
      pole(N[0], N[1], yN - 0.1, top + 0.25, 0.17, 0xa6aaae); pole(S[0], S[1], yS - 0.1, top + 0.25, 0.17, 0xa6aaae);
      const f = frame(N, S), yaw = Math.atan2(-f.uz, f.ux), m = [(N[0] + S[0]) / 2, (N[1] + S[1]) / 2];
      box(m[0], m[1], top - 0.2, top + 0.15, f.l, 0.3, yaw, 0xa6aaae);
      // the board over the lanes towards the junction, its dark face to the traffic coming from the east
      const c = [N[0] + f.ux * f.l * 0.42, N[1] + f.uz * f.l * 0.42];
      box(c[0], c[1], top - 1.0, top + 0.9, 3.7, 0.22, yaw, 0x16181c);
      const a = [c[0] - f.ux * 1.8 + f.ix * 0.13, c[1] - f.uz * 1.8 + f.iz * 0.13], b = [c[0] + f.ux * 1.8 + f.ix * 0.13, c[1] + f.uz * 1.8 + f.iz * 0.13];
      wall([[a[0], a[1], 0], [b[0], b[1], 3.6]], 0, 1.7, 'board');
      // (wall() counts from G: lift those four corners to the board)
      for (let k = tp.length - 12; k < tp.length; k += 3) tp[k + 1] += top - 0.9 - G;
    }
    {   // the island's grass
      const x0 = ISLAND[0] + 0.3, x1 = ISLAND[1] - 0.3, y = h(TREE[0], TREE[1]) + 0.05;
      quad([[x0, y, E(x0) - 0.55], [x1, y, E(x1) - 0.55], [x1, y, B(x1)], [x0, y, B(x0)]], 0x587f4a);
    }
    yield;
    const mesh = (pos, idx, mat, extra) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      extra(g);
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.castShadow = shadows; m.receiveShadow = true; m.matrixAutoUpdate = false;
      group.add(m);
    };
    mesh(tp, ti, new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide }), (g) => g.setAttribute('uv', new THREE.Float32BufferAttribute(tu, 2)));
    mesh(cp, ci, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), (g) => g.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3)));
    yield;
    // everything leafy (its own step: the bush's shape is made on its first use)
    yield 'frame';
    const leafy = leafyPlants(group, shadows);
    if (leafy.ok) {
      SHRUBS.forEach(([x, z, w, hgt], k) => leafy.bush(x, h(x, z) - 0.05, z, w, hgt, k * 1.7, [0.78 + (k % 3) * 0.07, 0.9 + (k % 2) * 0.06, 0.8 + (k % 4) * 0.04]));
      PLANTERS.forEach(([x, z], k) => leafy.bush(x, h(x, z) + 0.6, z, 1.0, 0.8, k, [1.0, 1.02, 0.8]));
      leafy.finish();
    }
  }

  let built = false;
  return {
    info: () => ({ built, kerb: kerb.pieces.filter((p) => p.built).length, of: kerb.pieces.length }),
    update(car) {
      if (!car) return;
      kerb.update(car);
      if (built || Math.hypot(car.x - ENTRANCE[0], car.z - ENTRANCE[1]) > 380 || !world.ready(ENTRANCE[0], ENTRANCE[1]) || !world.ready(WING[1][0], WING[1][1])) return;
      built = true;
      jobs.add(build, 'pirita keskus');
    },
  };
}
