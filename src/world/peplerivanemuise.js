// The lap from the Tiigi crossing down Pepleri, round the turn and up Vanemuise to W. Struve: the fronts and the
// garden edges that face the track (Martin, 21 Nov: a map with three areas marked and sixteen Street View shots
// of Aug 2023 and Aug 2024, "mainly focus on the facades on the racetrack ... with garden parts like fences").
// The map's own blocks keep their shapes; the walls that look onto the lap get painted fronts (houseskin.js),
// and what stands in front of them is built in boxes:
//   Pepleri, west side: the cream block beside the blue painting, the cream block with the fire ladder on its
//     gable, the pale green three-storey house at the Õpetaja corner with its plank fence, and Pepleri 21 at
//     the Vanemuise corner, pale yellow with a rusticated ground floor.
//   Pepleri, east side: the long sides of the two white 1950s blocks (the bird and the stripes on their gables
//     are pepleri.js), stair windows in tall strips, doors under flat canopies.
//   Across the turn: the white block on the far corner with its stack of balconies.
//   Vanemuise, north-west side: Jaan Poska gymnasium (ochre, white pilasters, the arched gate wing and the
//     field-stone wall), the Herbert Masingu school back on its forecourt (glass hall, flags, a spruce, the
//     field-stone wall and clipped hedge along the pavement).
//   Vanemuise, south-east side: the yellow houses before the Kunstimaja, the hedges along the pavements.
//   Past Akadeemia (vanemuise.js has the houses): the red picket fence and the brown gate before Vanemuise 12,
//   the white parapet and gate pillars in front of Vanemuise 19, the white wall with its lattice windows and
//   the gateway before it.
// Nothing stands on the road or the pavements; the track, its kerbs and paint are left as they were. Window
// panes, door colours and the backs of things the shots do not show are guessed.
import * as THREE from 'three';
import { Parts } from '../race/landmarks.js';
import { createTrack } from '../race/race.js';
import { setHouseColours, leafyPlants, wallOf } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { jobs } from '../jobs.js';

const CENTRE = [1250, 3390];
let TRACK = null;
// a point beside the lap at track index i, `lat` metres right of the direction of travel
function beside(i, lat) {
  TRACK ||= createTrack();
  const k = Math.floor(i), f = i - k, a = TRACK.P[k], b = TRACK.P[k + 1], [tx, tz] = TRACK.tan[k];
  return [a[0] + (b[0] - a[0]) * f - tz * lat, a[1] + (b[1] - a[1]) * f + tx * lat];
}

// The walls, as the map has them (sector 3_6): a and b with the outside on the right going from a to b.
const WL = {
  w2903: [[1168.4, 3309.5], [1198.1, 3363.4]],       // the bird block's long side to Pepleri
  w2725: [[1205.0, 3375.9], [1235.0, 3429.9]],       // the striped block's long side
  g2725: [[1215.8, 3369.9], [1205.0, 3375.9]],       //   and its north gable
  w2957: [[1169.1, 3355.7], [1151.9, 3323.8]],       // the block with the blue painting, its side to Pepleri
  w2857: [[1191.1, 3395.1], [1174.4, 3365.2]],       // the ladder block
  g2857: [[1174.4, 3365.2], [1162.0, 3372.1]],       //   its gable with the ladder
  e2796: [[1200.5, 3426.7], [1193.1, 3413.6]],       // the green house: to Pepleri
  n2796: [[1193.1, 3413.6], [1173.4, 3424.8]],       //   and to Õpetaja
  e2750: [[1223.8, 3454.6], [1210.8, 3431.3]],       // Pepleri 21: to Pepleri
  s2750: [[1212.6, 3464.4], [1223.8, 3454.6]],       //   and to Vanemuise
  n2603: [[1267.3, 3450.4], [1246.7, 3461.7]],       // the white block across the turn: to Vanemuise
  w2603: [[1246.7, 3461.7], [1259.7, 3485.3]],       //   and to Pepleri
  s2497: [[1275.6, 3407.6], [1304.5, 3382.0]],       // Poska gymnasium
  s2688: [[1290.2, 3352.8], [1320.3, 3326.1]],       // the Masingu school
  a2600: [[1305.2, 3406.8], [1290.8, 3420.4]],       // the yellow houses
  b2600: [[1323.9, 3391.2], [1306.2, 3407.8]],
  e2600: [[1333.7, 3401.6], [1323.9, 3391.2]],
};
const MID = (k) => { const [a, b] = WL[k]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };

// ---------------------------------------------------------------- the map's blocks: wall and roof colours
export function pepleriVanemuiseWalls(walls) {
  setHouseColours(walls, '3_6', 1120, 3040, [
    { base: 2857, x: 1176.6, z: 3384.0, wall: 0xf0ead6, roof: 0x5f6670, reach: 30 },       // the ladder block
    { base: 2796, x: 1187.0, z: 3426.0, wall: 0xd6daae, roof: 0xa9adb3, reach: 16 },       // the green house
    { base: 2750, x: 1214.0, z: 3450.0, wall: 0xeee4c0, roof: 0x6f737c, reach: 18 },       // Pepleri 21
    { base: 2603, x: 1258.0, z: 3468.0, wall: 0xeceeeb, roof: 0x8e939b, reach: 20 },       // the white block over the turn
    { base: 2497, x: 1282.0, z: 3381.0, wall: 0xeac68c, roof: 0x7f848d, reach: 40 },       // Poska
    { base: 2688, x: 1304.0, z: 3330.0, wall: 0xece5cb, roof: 0x5d6068, reach: 30 },       // Masingu
    { base: 2600, x: 1314.0, z: 3404.0, wall: 0xe9c064, roof: 0x7f838b, reach: 22 },       // the yellow houses
  ]);
}

// ---------------------------------------------------------------- the painted fronts
const sq = (o = {}) => ({ T: false, bars: 1, rails: 0, surround: 0.06, frame: '#f3f2ee', glass: '#55627a', ...o });
const plaster = (wall, o = {}) => ({ kind: 'smooth', wall, trim: '#f6f5f1', weather: 0, ...o });     // (smooth, no rain streaks: blotches and streaks made a 60 m wall one painting step of 15 ms)
// window places along a wall of `len` at `pitch`, kept clear of the stair strips at `stairs`
const spaced = (len, pitch, stairs = [], clear = 1.7) => {
  const n = Math.max(1, Math.round((len - 0.6) / pitch)), out = [];
  for (let k = 0; k < n; k++) { const x = (k + 0.5) * len / n; if (!stairs.some((s) => Math.abs(s - x) < clear)) out.push(x); }
  return out;
};
// a 1950s stairwell: a tall strip of glass bands from over the door to under the eaves, the door below
function stairStrip(P, W, x, { frame = '#f2f2ef', glass = '#56647a', door = '#4c4540' } = {}) {
  const w = 1.25, y0 = 3.0, y1 = W.eaves - 0.7;
  P.r(x - w / 2 - 0.14, y0 - 0.12, x + w / 2 + 0.14, y1 + 0.12, frame);
  for (let y = y0; y < y1 - 0.2; y += 0.44) P.r(x - w / 2, y, x + w / 2, Math.min(y1, y + 0.32), glass);      // (flat: a gradient a band was slow)
  P.door(x - 0.7, x + 0.7, 2.35, door, { frame, light: 0.45, panels: 1 });
}
const sheetOf = (stairs) => (len) => stairs.map((f) => f * len);

function fronts() {
  const S50 = [0.18, 0.5, 0.82];                                       // the three stairwells of a 1950s block
  const white50 = plaster([236, 236, 232], { storey: 2.9, maxFloors: 4, corners: false, plinth: { h: 0.85, col: '#b7b6b1', vents: 3.3 }, win: sq({ w: 1.45, pitch: 2.9, glass: '#566279' }) });
  const block50 = (key, o = {}) => {
    const [a, b] = WL[key], len = Math.hypot(b[0] - a[0], b[1] - a[1]), st = sheetOf(S50)(len);
    return { near: MID(key), xs: spaced(len, 2.9, st), draw: (P, W) => st.forEach((x) => stairStrip(P, W, x)), ...o };
  };
  const cream = (rgb, frame) => plaster(rgb, { storey: 2.9, maxFloors: 4, corners: false, plinth: { h: 1.0, col: '#a9a7a1', vents: 2.9 }, win: sq({ w: 1.35, pitch: 2.8, frame, glass: '#4b5566', surround: 0.05, sc: '#ece9e0' }) });
  return [
    // ---- Pepleri, east side: the white 1950s blocks
    { name: 'pv2903', sec: '3_6', base: 2903, at: MID('w2903'), r: 34, segs: ['w2903'], spec: white50, walls: [block50('w2903')] },
    { name: 'pv2725', sec: '3_6', base: 2725, at: [1220, 3400], r: 40, segs: ['w2725', 'g2725'], spec: white50,
      walls: [block50('w2725'), { near: MID('g2725'), n: 2 }] },
    // ---- Pepleri, west side
    { name: 'pv2957', sec: '3_6', base: 2957, at: MID('w2957'), r: 22, segs: ['w2957'], spec: cream([239, 232, 205], '#4d5159'),
      walls: [{ near: MID('w2957'), doors: [{ x: 8.5, w: 1.3, h: 2.4, col: '#5a4a3e', steps: 2 }, { x: 27.5, w: 1.3, h: 2.4, col: '#5a4a3e', steps: 2 }] }] },
    { name: 'pv2857', sec: '3_6', base: 2857, at: [1180, 3378], r: 24, segs: ['w2857', 'g2857'], spec: cream([241, 235, 214], '#3f434b'),
      walls: [{ near: MID('w2857'), doors: [{ x: 9.0, w: 1.3, h: 2.4, col: '#5a4a3e', steps: 2 }, { x: 25.0, w: 1.3, h: 2.4, col: '#5a4a3e', steps: 2 }] },
        { near: MID('g2857'), xs: [3.6, 10.7], noAttic: true,
          draw: (P, W) => {                                                        // the damp streak down the middle, behind the ladder
            const x = W.len * 0.5, top = W.eaves;
            P.grad(x - 0.9, 0.9, x + 0.9, top, 'rgba(84,92,70,0.55)', 'rgba(70,74,60,0.25)');
            P.grad(x - 0.45, 0.9, x + 0.3, top - 1.5, 'rgba(52,58,46,0.5)', 'rgba(52,58,46,0.15)');
          } }] },
    { name: 'pv2796', sec: '3_6', base: 2796, at: [1192, 3420], r: 18, segs: ['e2796', 'n2796'],
      spec: plaster([214, 218, 172], { storey: 3.0, maxFloors: 3, trim: '#f5f5ee', corners: 0.35, plinth: { h: 0.7, col: '#aeb19a', vents: 3.0 }, win: { w: 1.15, pitch: 2.4, T: true, surround: 0.08, sc: '#f5f5ee', frame: '#f7f7f2', glass: '#56627a' } }),
      walls: [{ near: MID('n2796'), doors: [{ x: 15.6, w: 1.2, h: 2.4, col: '#e9e6dc', light: 0.5, panels: 1, canopy: '#7d97ad' }] }, { near: MID('e2796') }] },
    { name: 'pv2750', sec: '3_6', base: 2750, at: [1217, 3450], r: 18, segs: ['e2750', 's2750'],
      spec: plaster([238, 229, 194], { storey: 3.6, maxFloors: 3, trim: '#f7f4ea', corners: false, belts: [4.3, 7.75], plinth: { h: 1.25, col: '#9d9b96', vents: 2.9 },
        win: { w: 1.25, pitch: 2.9, T: true, surround: 0.14, sc: '#f7f4ea', frame: '#f8f6f0', glass: '#56627a', hood: 0.2 } }),
      walls: [{ near: MID('e2750'), doors: [{ x: 14.0, w: 1.3, h: 2.6, col: '#5b4a3c' }], draw: classical }, { near: MID('s2750'), draw: classical }] },
    // ---- the white block across the turn, its balconies stacked on the side to Vanemuise
    { name: 'pv2603', sec: '3_6', base: 2603, at: [1257, 3466], r: 20, segs: ['n2603', 'w2603'],
      spec: plaster([237, 238, 235], { storey: 2.85, maxFloors: 5, corners: false, plinth: { h: 0.7, col: '#b3b4b2', vents: 3.2 }, win: sq({ w: 1.4, pitch: 2.9 }) }),
      walls: [{ near: MID('n2603'), xs: [2.0, 5.0, 8.0, 11.0, 18.0, 21.4], draw: (P, W) => balconies(P, W, 14.6) }, { near: MID('w2603') }] },
    // ---- Vanemuise, north-west side
    { name: 'pv2497', sec: '3_6', base: 2497, at: MID('s2497'), r: 24, segs: ['s2497'],
      spec: plaster([234, 199, 142], { storey: 3.9, maxFloors: 3, trim: '#f6f1e5', corners: false, belts: [4.75, 8.6], plinth: { h: 1.4, col: '#e4e1da', vents: 2.95 },
        win: { w: 1.3, pitch: 2.95, T: true, surround: 0.16, sc: '#f6f1e5', frame: '#f7f5ef', glass: '#4f5b6c', hood: 0.16 } }),
      walls: [{ near: MID('s2497'), noAttic: true, draw: poska, floors: [{ sill: 2.0, h: 2.0 }, { sill: 5.9, h: 2.0 }, { sill: 9.8, h: 2.0 }, { sill: 13.7, h: 1.8 }] }] },
    { name: 'pv2688', sec: '3_6', base: 2688, at: MID('s2688'), r: 24, segs: ['s2688'],
      spec: plaster([236, 229, 203], { storey: 3.0, maxFloors: 4, corners: false, plinth: { h: 0.8, col: '#aaa59b', vents: 3.0 }, win: sq({ w: 1.3, pitch: 2.75, glass: '#4d596b' }) }),
      walls: [{ near: MID('s2688'), doors: [{ x: 20.0, w: 1.8, h: 2.5, col: '#40444c', light: 0.5, panels: 1 }] }] },
    // ---- Vanemuise, south-east side: the yellow houses
    { name: 'pv2600', sec: '3_6', base: 2600, at: [1313, 3403], r: 22, segs: ['a2600', 'b2600', 'e2600'],
      spec: plaster([233, 193, 104], { storey: 3.1, maxFloors: 3, trim: '#f6f4ee', corners: 0.18, plinth: { h: 0.75, col: '#a79d8a', vents: 3.0 }, win: { w: 1.2, pitch: 2.6, T: true, surround: 0.08, sc: '#f6f4ee', frame: '#f7f6f1', glass: '#55617a' } }),
      walls: [{ near: MID('b2600'), doors: [{ x: 19.5, w: 1.2, h: 2.3, col: '#d9d7cf', light: 0.5, panels: 1 }], draw: (P, W) => bay(P, W, 8.0) }] },
  ];
}
// Pepleri 21: grooves across the rusticated ground floor, quoins at the corners, a cornice under the roof
function classical(P, W) {
  for (let y = 1.6; y < 4.2; y += 0.42) P.r(0, y, W.len, y + 0.035, 'rgba(150,138,104,0.55)');
  for (const x0 of [0, W.len - 0.75]) for (let y = 4.45, k = 0; y < W.eaves - 0.5; y += 0.5, k++) P.r(x0 + (k % 2 && x0 ? 0.25 : 0), y, x0 + 0.75 - (k % 2 && !x0 ? 0.25 : 0), y + 0.44, '#f5f1e4');
  P.r(0, W.eaves - 0.55, W.len, W.eaves - 0.25, '#f7f4ea'); P.r(0, W.eaves - 0.25, W.len, W.eaves, '#d9d2bd');
  if (W.len > 20) P.text('Pepleri 21', W.len - 2.6, 4.9, 0.18, '#3f4f8a', '600 %px Arial, sans-serif');
}
// a stack of balconies with white solid fronts and dark doors behind
function balconies(P, W, x) {
  for (let y = 3.3; y < W.eaves - 1.5; y += 2.85) {
    P.r(x - 1.3, y - 1.9, x + 1.3, y + 0.55, '#3d4450');                  // the dark of the balcony
    P.r(x - 0.5, y - 1.85, x + 0.5, y + 0.3, '#56627a');                  // its door
    P.r(x - 1.45, y - 2.0, x + 1.45, y - 0.95, '#f4f4f2');                // the front
    P.r(x - 1.45, y - 0.95, x + 1.45, y - 0.9, '#c9cac8');
  }
}
// Poska: white pilaster strips between pairs of windows, round-headed windows on the ground floor, a white
// cornice and a frieze band under it
function poska(P, W) {
  const len = W.len;
  for (let x = 0.3; x < len; x += 5.9) P.r(x, 1.4, x + 0.55, W.eaves - 0.6, '#f4eee1');
  const n = Math.max(1, Math.round((len - 0.6) / 2.95));
  for (let k = 0; k < n; k++) { const x = (k + 0.5) * len / n; P.arc(x, 4.0, 0.79, '#f6f1e5', Math.PI, Math.PI * 2); P.arc(x, 4.0, 0.62, '#4f5b6c', Math.PI, Math.PI * 2); }   // round heads on the ground-floor windows
  P.r(0, W.eaves - 1.0, len, W.eaves - 0.65, '#f6f1e5'); P.r(0, W.eaves - 0.45, len, W.eaves, '#f6f1e5');
  P.r(0, 1.25, len, 1.4, '#f6f1e5');
}
// the yellow house's glazed stair bay: a tall window over the door, white bars
function bay(P, W, x) {
  P.r(x - 0.95, 1.0, x + 0.95, W.eaves - 0.4, '#f6f4ee');
  for (let y = 1.15; y < W.eaves - 0.6; y += 0.85) P.r(x - 0.8, y, x + 0.8, Math.min(W.eaves - 0.55, y + 0.75), '#56627e');
}

// ---------------------------------------------------------------- the build
export function createPepleriVanemuise(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  // (in steps, see ../jobs.js: the fronts are painted a wall at a time by skinHouses, the boxes here in parts)
  function* build() {
    TRACK ||= createTrack();
    const hAt = (x, z) => world.heightAt(x, z);
    // only the listed walls of each house are painted
    const near = (keys) => (x, z) => keys.some((k) => {
      const [a, b] = WL[k], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
      return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < 0.9;
    });
    const list = fronts().map((H) => ({ ...H, pick: near(H.segs) }));
    // the walls the lap passes close by are painted finer than the ones back on the forecourts
    const faces = (W) => { for (let i = 1985; i < 2215; i += 3) if (Math.hypot(TRACK.P[i][0] - W.mid[0], TRACK.P[i][1] - W.mid[1]) < 30) return true; return false; };
    skinHouses(world, group, list, { label: 'peplerivanemuise fronts', faces, shadows, ppm: 18, far: 8 });
    yield;

    const p = new Parts(), leafy = leafyPlants(group, shadows);
    // a box along a wall frame F: s0..s1 along it, n0..n1 out from it, y0..y1 over the ground `g`
    const slab = (F, g, s0, s1, n0, n1, y0, y1, hex) => { const [x, z] = F.at((s0 + s1) / 2, (n0 + n1) / 2); p.box(s1 - s0, y1 - y0, n1 - n0, hex, x, g + (y0 + y1) / 2, z, F.yaw); };
    const groundOf = (F, s0 = 0, s1 = F.len, n = 0.6) => Math.max(hAt(...F.at(s0, n)), hAt(...F.at(s1, n)), hAt(...F.at((s0 + s1) / 2, n)));
    const clear = (x, z, m = 0.4) => world.sdfAt(x, z) > m;            // not on a road
    // a clipped hedge from a to b
    const hedge = (a, b, width, height, tint = [0.82, 0.95, 0.8]) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / (width * 0.8))), yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
      for (let k = 0; k <= n; k++) {
        const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n;
        if (!clear(x, z, 0.3)) continue;
        if (leafy.ok) leafy.bush(x, hAt(x, z) - 0.05, z, width * 1.5, height, yaw + k, tint, width);
        else p.box(len / n + 0.1, height, width, 0x5fa565, x, hAt(x, z) + height / 2, z, yaw);
      }
    };
    const alongLap = (i0, i1, lat, width, height, tint) => hedge(beside(i0, lat), beside(i1, lat), width, height, tint);
    // a wall of field stones with a cement cap, from a to b
    function* stones(a, b, height, thick = 0.5) {
      const F = wallOf(a, b), g = Math.min(groundOf(F, 0, F.len, 0), hAt(...b));
      const n = Math.max(1, Math.round(F.len / 1.2));
      for (let k = 0; k < n; k++) {                                     // in short lengths, so that it follows the ground
        const s0 = k * F.len / n, s1 = (k + 1) * F.len / n, gy = Math.min(hAt(...F.at(s0, 0)), hAt(...F.at(s1, 0)));
        slab(F, gy, s0, s1 + 0.02, -thick / 2, thick / 2, -0.4, height, [0x9d8f86, 0x8c8079, 0xa69688][k % 3]);
        // stones standing out of the face on both sides
        for (const side of [-1, 1]) for (let j = 0; j < 3; j++) {
          const s = s0 + (j + 0.3 + ((k * 7 + j * 3) % 5) * 0.08) * (s1 - s0) / 3, y = 0.15 + ((k + j) % 3) * height * 0.28;
          slab(F, gy, s - 0.17, s + 0.17, side * thick / 2 - 0.05, side * thick / 2 + 0.05, y, y + 0.24, [0xb2a294, 0x8a7a72, 0x9b9a98, 0xa58673][(k + j) % 4]);
        }
        slab(F, gy, s0, s1 + 0.02, -thick / 2 - 0.03, thick / 2 + 0.03, height, height + 0.07, 0xb9b6b0);
        if (jobs.late()) yield;
      }
      return g;
    }

    // ================================================================ Pepleri
    // the fire ladder up the gable of the cream block, from the first floor to over the eaves
    {
      const F = wallOf(...WL.g2857), g = groundOf(F), s = F.len * 0.56;
      for (const d of [-0.28, 0.28]) slab(F, g, s + d - 0.025, s + d + 0.025, 0.28, 0.33, 3.1, 15.6, 0x3a3d42);
      for (let y = 3.3; y < 15.5; y += 0.32) slab(F, g, s - 0.28, s + 0.28, 0.29, 0.32, y, y + 0.03, 0x3a3d42);
      for (const y of [3.2, 8.5, 14.0]) for (const d of [-0.28, 0.28]) slab(F, g, s + d - 0.02, s + d + 0.02, 0, 0.3, y, y + 0.04, 0x3a3d42);   // its brackets
      for (const d of [-0.28, 0.28]) { const [x, z] = F.at(s + d, 0.3); p.box(0.05, 1.0, 0.05, 0x3a3d42, x, g + 16.1, z, F.yaw); }
    }
    // the stairwell canopies of the white blocks: thin flat slabs over the doors
    for (const k of ['w2903', 'w2725']) {
      const F = wallOf(...WL[k]);
      for (const f of [0.18, 0.5, 0.82]) { const s = F.len * f, g = hAt(...F.at(s, 1.5)); slab(F, g, s - 1.3, s + 1.3, 0.05, 1.35, 2.55, 2.7, 0xdcdcd8); }
    }
    // the canopy over the green house's door (a sheet of blue glass on a steel frame)
    { const F = wallOf(...WL.n2796), g = hAt(...F.at(15.6, 1)); slab(F, g, 14.6, 16.6, 0.05, 1.2, 2.65, 2.72, 0x7d97ad); slab(F, g, 14.6, 16.6, 1.15, 1.2, 2.5, 2.72, 0x9aa3ad); }
    // the plank fence along Õpetaja from the Pepleri corner to the green house, thujas behind it
    {
      const a = beside(2039.5, 7.4), F = wallOf(a, [1196.6, 3413.4]);
      if (F.len > 1 && F.len < 12) {
        const g = Math.min(hAt(...a), hAt(1196.6, 3413.4));
        slab(F, g, 0, F.len, -0.07, 0.07, -0.2, 0.3, 0xcfcbbf);
        for (let s = 0.06; s < F.len; s += 0.13) slab(F, g, s - 0.04, s + 0.04, -0.03, 0.0, 0.3, 1.35, 0xe6e2d2);
        for (let s = 0; s <= F.len + 0.01; s += F.len / 3) slab(F, g, s - 0.09, s + 0.09, -0.07, 0.07, 0.3, 1.45, 0xcfcbbf);
        for (let k = 0; k < 4; k++) { const [x, z] = F.at(1 + k * (F.len - 2) / 3, -1.0); if (clear(x, z) && leafy.ok) leafy.thuja(x, hAt(x, z), z, 1.6 + (k % 2) * 0.4, 0.4, k + 3); }
      }
    }
    // a clipped bush by the white blocks' doors and the round shrubs on their lawns
    for (const k of ['w2903', 'w2725']) {
      const F = wallOf(...WL[k]);
      for (const f of [0.1, 0.34, 0.66, 0.9]) { const [x, z] = F.at(F.len * f, 1.6); if (clear(x, z, 1.0) && leafy.ok) leafy.bush(x, hAt(x, z) - 0.1, z, 2.2, 1.4, f * 9, [0.8, 0.94, 0.8]); }
    }
    yield;

    // ================================================================ the turn and Vanemuise to Akadeemia
    // the clipped hedge along the kindergarten's fence on the right after the turn
    alongLap(2086, 2101, 6.9, 1.1, 1.35);
    // Poska: the arched gate wing at the south-west end and the field-stone wall going on from it
    {
      const F = wallOf(...WL.s2497), g = hAt(...F.at(-3, 0.5));
      const ochre = 0xeac68c, white = 0xf4efe3, dark = 0x2f3236;
      slab(F, g, -5.6, -0.1, -0.6, 0.6, -0.5, 4.6, ochre);                                     // the wing
      slab(F, g, -5.75, 0.05, -0.65, 0.68, 4.6, 4.85, white);                                   // its cornice
      for (let s = -5.5; s < -0.2; s += 0.42) slab(F, g, s, s + 0.14, -0.2, 0.25, 4.85, 5.4, white);   // the balustrade
      slab(F, g, -5.75, 0.05, -0.65, 0.68, 5.4, 5.55, white);
      for (const [c, open] of [[-4.0, true], [-1.6, false]]) {                                   // two arches: an open one with its iron gate, a blind one
        slab(F, g, c - 0.95, c + 0.95, 0.6, 0.66, 0, 2.6, white);
        { const [x, z] = F.at(c, 0.63); p.add(new THREE.CylinderGeometry(0.95, 0.95, 0.06, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), white, x, g + 2.6, z, F.yaw); }
        slab(F, g, c - 0.75, c + 0.75, 0.62, 0.68, 0, 2.6, open ? dark : 0xe4bd80);
        { const [x, z] = F.at(c, 0.69); p.add(new THREE.CylinderGeometry(0.75, 0.75, 0.04, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), open ? dark : 0xe4bd80, x, g + 2.6, z, F.yaw); }
        if (open) for (let s = c - 0.7; s < c + 0.72; s += 0.14) slab(F, g, s, s + 0.03, 0.7, 0.73, 0, 2.5, 0x1f2124);
      }
      const end = F.at(-15.5, 0.0);
      if (clear(end[0], end[1], 1.0)) yield* stones(F.at(-5.6, 0), end, 1.55, 0.55);
    }
    yield;
    // the Masingu school: the glass hall at its south-west end, flags, a spruce, two stone lions on the forecourt,
    // and the field-stone wall with the clipped hedge on it along the pavement up to the Akadeemia corner
    {
      const F = wallOf(...WL.s2688), g = groundOf(F, 0, 10, 4);
      slab(F, g, 0.2, 8.6, 0, 5.8, -0.4, 12.6, 0x5f7896);                                     // the glass hall
      for (let y = 0.1; y < 12.6; y += 0.95) slab(F, g, 0.15, 8.65, 5.8, 5.86, y, y + 0.05, 0x9aa6b3);
      for (let s = 0.2; s < 8.7; s += 1.4) slab(F, g, s, s + 0.06, 5.8, 5.88, -0.4, 12.6, 0x9aa6b3);
      slab(F, g, 2.8, 6.6, 5.86, 5.96, 3.2, 11.2, 0x7d8188);                                   // the grey louvres over the door
      for (let y = 3.4; y < 11.1; y += 0.35) slab(F, g, 2.8, 6.6, 5.96, 6.06, y, y + 0.14, 0xa3a8ae);
      slab(F, g, 3.4, 6.0, 5.86, 5.95, 0, 2.6, 0x3a3f48);                                       // the doors
      slab(F, g, 0, 8.8, -0.1, 6.3, 12.6, 12.85, 0x6d7078);
      // flagpoles: two by the door, three on the lawn; white flags with a blue mark, the tricolour, a red one
      const pole = (s, n, hgt, cols) => {
        const [x, z] = F.at(s, n), y = hAt(x, z);
        p.add(new THREE.CylinderGeometry(0.04, 0.06, hgt, 8), 0xe9e9e6, x, y + hgt / 2, z);
        cols.forEach((hex, j) => { const [fx, fz] = F.at(s + 0.6, n); p.box(1.1, 0.42, 0.02, hex, fx, y + hgt - 0.35 - j * 0.42, fz, F.yaw); });
      };
      pole(9.6, 9.0, 6.5, [0x2f62b4, 0x1c1c22, 0xf4f4f6]); pole(11.0, 9.4, 6.5, [0xd5423b, 0xf4f4f6, 0xd5423b]);
      pole(20.5, 17.5, 9.5, [0xf4f4f6, 0xf4f4f6, 0xf4f4f6]); pole(22.6, 18.0, 9.5, [0xd5423b, 0xd5423b, 0xd5423b]); pole(24.7, 18.5, 9.5, [0xf4f4f6, 0xf4f4f6, 0xf4f4f6]);
      // the spruce in its round lawn
      { const [x, z] = F.at(15.0, 15.5); if (leafy.ok) { leafy.thuja(x, hAt(x, z), z, 8.5, 2.3, 5, [0.36, 0.56, 0.42]); } }
      // the stone lions by the forecourt's mouth
      for (const s of [3.2, 4.4]) { const [x, z] = F.at(s, 27.5), y = hAt(x, z); p.box(1.0, 0.55, 0.5, 0xc9c4b8, x, y + 0.28, z, F.yaw); p.box(0.4, 0.45, 0.45, 0xc9c4b8, x + F.ux * 0.35, y + 0.75, z + F.uz * 0.35, F.yaw); }
      // benches along the hedge
      for (const s of [13, 17]) { const [x, z] = F.at(s, 23.5), y = hAt(x, z); p.box(1.6, 0.06, 0.45, 0x8a6a4c, x, y + 0.45, z, F.yaw); p.box(1.5, 0.42, 0.35, 0x55585e, x, y + 0.21, z, F.yaw); }
    }
    yield;
    // the field-stone wall along the pavement in front of the school, the hedge clipped behind it
    {
      const a = beside(2120.5, -7.3), b = beside(2145.5, -7.3);
      if (clear(...a) && clear(...b)) yield* stones(a, b, 0.6, 0.5);
      alongLap(2121, 2145.5, -8.2, 1.2, 1.5, [0.78, 0.95, 0.72]);
    }
    // the yellow houses' front gardens: a clipped hedge behind the pavement, a low one by the door
    alongLap(2104, 2112, 7.0, 0.9, 1.0);
    // the hedge along the Kunstimaja's front
    alongLap(2134, 2146, 8.4, 1.0, 1.1);
    yield;

    // ================================================================ past Akadeemia (the houses are vanemuise.js)
    // south-east side: the red picket fence from Akadeemia 5 to the brown gate of Vanemuise 12
    {
      const a = [1376.3, 3337.6], gate = [1391.4, 3323.2], F = wallOf(a, gate);
      const n = Math.round(F.len / 0.15);
      for (let k = 0; k < n; k++) {
        const s = (k + 0.5) * F.len / n, [x, z] = F.at(s, 0.5), y = hAt(x, z);
        p.box(0.08, 1.25, 0.03, 0xbf5a44, x, y + 0.62, z, F.yaw);
        if (jobs.late()) yield;
      }
      for (const y of [0.3, 1.0]) { const s = F.len / 2, [x, z] = F.at(s, 0.47), gy = Math.min(hAt(...a), hAt(...gate)); p.box(F.len, 0.08, 0.03, 0xa24c3a, x, gy + y, z, F.yaw); }
      for (let s = 0; s <= F.len + 0.01; s += F.len / 8) { const [x, z] = F.at(s, 0.45), y = hAt(x, z); p.box(0.1, 1.35, 0.1, 0x8e4434, x, y + 0.62, z, F.yaw); }
      // the gateway: two white pillars under a moss-topped lintel, the brown double gate of boards laid in chevrons
      const G = wallOf(gate, [1395.0, 3319.7]), gy = hAt(...G.at(G.len / 2, 0.5)), wid = G.len;
      for (const s of [0, wid]) slab(G, gy, s - 0.35, s + 0.35, 0.1, 0.8, -0.3, 3.3, 0xeeebe4);
      slab(G, gy, -0.45, wid + 0.45, 0.05, 0.85, 3.3, 3.75, 0xeeebe4);
      slab(G, gy, -0.5, wid + 0.5, 0.0, 0.9, 3.75, 3.85, 0x6f7a55);
      slab(G, gy, 0.35, wid - 0.35, 0.4, 0.5, 0, 3.2, 0x6b3f2c);
      for (let y = 0.25; y < 3.1; y += 0.3) for (const [s0, s1] of [[0.4, wid / 2 - 0.03], [wid / 2 + 0.03, wid - 0.4]]) slab(G, gy, s0, s1, 0.5, 0.53, y, y + 0.05, 0x55301f);
    }
    yield;
    // north-west side: the white wall with its lattice windows and the gateway before Vanemuise 19, then the low
    // white parapet with its pillars in front of the villa
    {
      const white = 0xeeece6, cap = 0xd9d6ce;
      const a = beside(2166.5, -6.9), b = beside(2175.5, -6.9), F = wallOf(a, b), g = Math.min(hAt(...a), hAt(...b));
      slab(F, g, 0, F.len * 0.55, -0.25, 0.25, -0.4, 3.0, white);
      slab(F, g, -0.1, F.len * 0.55 + 0.1, -0.32, 0.32, 3.0, 3.2, cap);
      for (const s of [1.4, 3.4]) { slab(F, g, s - 0.55, s + 0.55, 0.26, 0.3, 1.2, 2.4, 0x2b2d31); for (let d = -0.5; d <= 0.5; d += 0.2) { slab(F, g, s + d - 0.02, s + d + 0.02, 0.3, 0.33, 1.2, 2.4, 0xe9e6df); slab(F, g, s - 0.55, s + 0.55, 0.3, 0.33, 1.25 + (d + 0.5) * 1.1, 1.29 + (d + 0.5) * 1.1, 0xe9e6df); } }
      const s0 = F.len * 0.55, s1 = F.len;                                                       // the gateway: pilasters, a cornice, grey doors
      slab(F, g, s0, s1, -0.3, 0.3, -0.4, 3.6, 0xe7e1d2);
      slab(F, g, s0 - 0.1, s1 + 0.1, -0.4, 0.42, 3.6, 3.95, 0xf1eee6);
      slab(F, g, s0 + 0.6, s1 - 0.6, 0.3, 0.38, 0, 2.9, 0xa9adb0);
      slab(F, g, (s0 + s1) / 2 - 0.02, (s0 + s1) / 2 + 0.02, 0.38, 0.4, 0, 2.9, 0x84888c);
      // the parapet: a low white wall with stepped caps, square pillars every few metres
      const c = beside(2177.5, -8.0), d = beside(2191.5, -8.0), Q = wallOf(c, d);
      if (clear(...c) && clear(...d)) {
        const n = Math.round(Q.len / 3.2);
        for (let k = 0; k < n; k++) {
          const sa = k * Q.len / n, sb = (k + 1) * Q.len / n, gy = Math.min(hAt(...Q.at(sa, 0)), hAt(...Q.at(sb, 0)));
          slab(Q, gy, sa, sb, -0.2, 0.2, -0.4, 0.7, white);
          slab(Q, gy, sa, sb, -0.26, 0.26, 0.7, 0.8, cap);
          slab(Q, gy, sa - 0.25, sa + 0.25, -0.28, 0.28, -0.4, 1.15, white);
          slab(Q, gy, sa - 0.3, sa + 0.3, -0.33, 0.33, 1.15, 1.25, cap);
        }
      }
    }
    yield;

    leafy.finish();
    const mesh = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    if (mesh) { mesh.castShadow = shadows; mesh.receiveShadow = true; group.add(mesh); }
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 460) return;
      if ([[1170, 3330], [1220, 3440], [1300, 3400], [1390, 3320]].every((q) => world.ready(q[0], q[1]))) { built = true; jobs.add(build, 'pepleri-vanemuise'); }      // (the flag first: see pepleri.js)
    },
  };
}
