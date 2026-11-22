// Vanemuise tänav in Tartu from the Akadeemia corner up to the theatre (Martin, 20 Nov: a purple outline on a map,
// "give it a shot"), dressed from the Land Board's oblique air photos (2021 to 2024, all four directions). The map's
// own blocks keep their shapes; every wall that shows from the street gets a painted front, and the roofs take
// their real colours:
//  - Tartu Kunstimaja (Vanemuise 26): the white three-storey house with the dark slate hipped roof, the big
//    painting on its front by the corner and the dark canopy over the door.
//  - Akadeemia 5 across the corner: four storeys of white render under a light grey metal roof.
//  - Vanemuise 12: the white two-storey villa with the grey metal roof, its middle door with the arched window
//    over it, and the two white sheds in the yard behind (one with a brown felt roof), two cars in the yard.
//  - W. Struve 3: the long beige four-storey block whose narrow end comes to Vanemuise, silver roof.
//  - Vanemuise 8: the cream three-storey block with the silver hipped roof, thirteen windows a floor and the
//    door in the middle.
//  - The Vanemuine theatre (Vanemuise 6): the red brick stage tower and the brick side to Vanemuise with its row
//    of round windows, grey rendered wings, the front block on the forecourt with its tall white fins, the
//    VANEMUINE letters along the front roof, the granite terrace wall and three flags.
//  - Across the road: Vanemuise 19 (the white old house in the trees) and Vanemuise 21 (the cream block at the
//    corner).
// What the photos do not show sharply (window panes, door colours, the painting's picture) is guessed. No street
// name is painted on the road.
import * as THREE from 'three';
import { streetKit, setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { BOX } from '../race/landmarks.js';
import { frontCut } from './kontserdimaja.js';
import { jobs } from '../jobs.js';

// the street frame: s metres along Vanemuise from the Akadeemia junction towards Ülikooli (north-east), v metres
// across it towards the theatre side (south-east)
const O = [1352.4, 3349.1];
const D = [0.752, -0.659], N = [0.659, 0.752];
const L = (s, v) => [O[0] + D[0] * s + N[0] * v, O[1] + D[1] * s + N[1] * v];
const SV = (x, z) => [(x - O[0]) * D[0] + (z - O[1]) * D[1], (x - O[0]) * N[0] + (z - O[1]) * N[1]];
const CENTRE = L(120, 20);

// ---------------------------------------------------------------- what the map's own data needs
// Wall and roof colours of the map's blocks (LOD2 bases in cm, sector 3_6); the walls are painted over below.
export function vanemuiseWalls(walls) {
  setHouseColours(walls, '3_6', 1120, 3040, [
    { base: 2472, x: 1356.5, z: 3385.0, wall: 0xeeede8, roof: 0x464953 },     // Kunstimaja
    { base: 2437, x: 1377.0, z: 3350.5, wall: 0xe4bf7c, roof: 0x7a6f68 },     // Akadeemia 5 (ochre in the street views of Aug 2023)
    { base: 2431, x: 1407.0, z: 3316.5, wall: 0xefebe6, roof: 0x8e9299 },     // Vanemuise 12
    { base: 2508, x: 1398.5, z: 3339.5, wall: 0xe8e5de, roof: 0x5c4a42 },     // its sheds
    { base: 2504, x: 1404.0, z: 3349.0, wall: 0xe8e5de, roof: 0x9a9ca2 },
    { base: 2303, x: 1442.5, z: 3318.0, wall: 0xd9ccae, roof: 0xa9b0b8 },     // W. Struve 3
    { base: 2076, x: 1463.5, z: 3276.0, wall: 0xebe5d6, roof: 0x99a1ad },     // Vanemuise 8
    { base: 1627, x: 1534.5, z: 3263.0, wall: 0xc4c3bf, roof: 0x5d5e63 },     // the theatre
    { base: 2422, x: 1382.0, z: 3289.5, wall: 0xe9e7e1, roof: 0xa3a7ae },     // Vanemuise 19
    { base: 2515, x: 1355.5, z: 3323.0, wall: 0xc9ccc3, roof: 0x8f949b },     // Vanemuise 21 (grey green, ditto)
  ]);
}

// Parked cars for src/world/parked.js: [x, z, yaw, id, paint, lift] (forward = (sin yaw, -cos yaw)). The two cars
// in the yard behind Vanemuise 12, nose to the house.
const TO_SE = Math.atan2(N[0], -N[1]);
export const VANEMUISE_CARS = [
  [...L(48.4, 25.0), TO_SE, 'passat', 'sage', 0.03],
  [...L(51.2, 25.6), TO_SE, 'mazda6', 'grey', 0.03],
];

// ---------------------------------------------------------------- the painted fronts
const C = {
  white: [238, 237, 232], trim: '#f6f5f1', glass: '#4f5c6d', dark: '#3b3c41',
  cream: [235, 229, 214], beige: [217, 204, 174], villa: [239, 235, 230], grey: [196, 195, 191],
  brick: [150, 72, 58], c21: [201, 204, 195], ochre: [228, 191, 124],
};
const plaster = (wall, o = {}) => ({ kind: 'plaster', wall, trim: C.trim, weather: 0.5, ...o });
const sq = (o = {}) => ({ T: false, bars: 1, rails: 0, surround: 0.06, frame: '#f3f2ee', glass: C.glass, ...o });

// the big painting on the Kunstimaja front: a warm field with a figure, in a white frame
function mural(P, x0, y0, x1, y1) {
  P.r(x0 - 0.15, y0 - 0.15, x1 + 0.15, y1 + 0.15, '#f7f6f2');
  P.grad(x0, y0, x1, y1, '#9cb4c6', '#e7d8c0');
  P.poly([[x0, y0], [x1, y0], [x1, y0 + (y1 - y0) * 0.38], [x0 + (x1 - x0) * 0.55, y0 + (y1 - y0) * 0.5], [x0, y0 + (y1 - y0) * 0.3]], '#d2552f');
  P.poly([[x0 + (x1 - x0) * 0.2, y0], [x0 + (x1 - x0) * 0.62, y0], [x0 + (x1 - x0) * 0.5, y0 + (y1 - y0) * 0.2]], '#a8341f');
  const cx = x0 + (x1 - x0) * 0.42, w = x1 - x0, hh = y1 - y0;
  P.poly([[cx - w * 0.08, y0 + hh * 0.3], [cx + w * 0.1, y0 + hh * 0.3], [cx + w * 0.07, y0 + hh * 0.72], [cx - w * 0.06, y0 + hh * 0.72]], '#2d3442');
  P.arc(cx, y0 + hh * 0.8, w * 0.07, '#2d3442');
  P.poly([[cx + w * 0.08, y0 + hh * 0.66], [cx + w * 0.3, y0 + hh * 0.86], [cx + w * 0.28, y0 + hh * 0.9], [cx + w * 0.06, y0 + hh * 0.7]], '#2d3442');
  P.r(x0 + w * 0.68, y0 + hh * 0.55, x0 + w * 0.9, y0 + hh * 0.85, '#f0c544');
}
// the theatre's front block: tall white fins in front of dark glass, a white band at the top
function fins(P, W) {
  const len = W.len, top = P.y1;
  P.r(0, P.y0, len, top, '#e9e8e4');
  P.grad(0, 0.3, len, top - 2.2, '#4a5562', '#2f3843');
  for (let x = 0.4; x < len; x += 1.25) P.r(x - 0.2, 0.3, x + 0.2, top - 2.2, '#efeee9');
  for (let x = 0.4; x < len; x += 1.25) P.r(x + 0.18, 0.3, x + 0.26, top - 2.2, 'rgba(70,70,74,0.35)');
  P.r(0, top - 2.25, len, top - 2.1, '#bdbcb7');
  P.r(0, P.y0, len, 0.3, '#9f9d98');
  for (let k = 0; k < 4; k++) { const x = len * (0.2 + k * 0.2); P.r(x - 0.9, 0.3, x + 0.9, 2.9, '#2a2f36'); P.r(x - 0.03, 0.3, x + 0.03, 2.9, '#c9c9c5'); }
  P.weather(0, P.y0, len, top, 0.4, 7);
}
// the concert house's brick box over the street (Street View, 4 Vanemuise): the logo by the south-east end, the name
// in two lines of spaced metal letters, two round windows one over the other by the north-west end (x runs north-west)
function concertFront(P, W) {
  const len = W.len, y0 = P.y0, hh = P.y1 - P.y0, Y = (f) => y0 + hh * f;
  P.brick(0, y0, len, P.y1, C.brick, 17);
  P.r(0, P.y1 - 0.18, len, P.y1, '#6f3a2f');
  const spaced = (word, cx, y, size, pitch) => {
    const x0 = cx - (word.length - 1) * pitch / 2;
    for (let i = 0; i < word.length; i++) P.text(word[i], x0 + i * pitch, y, size, '#d2c3ad', '600 %px Arial, sans-serif');
  };
  spaced('VANEMUISE', len * 0.55, Y(0.5), 0.66, 0.68);
  spaced('KONTSERDIMAJA', len * 0.55, Y(0.33), 0.6, 0.66);
  // the logo: a pale metal shield with the U-shaped mark in it
  const lx = len * 0.3, ly = Y(0.44);
  P.r(lx - 0.55, ly - 0.85, lx + 0.55, ly + 0.95, '#c6c8cb');
  P.arc(lx, ly - 0.85, 0.55, '#c6c8cb');
  P.r(lx - 0.36, ly - 0.45, lx - 0.18, ly + 0.75, '#6f7378');
  P.r(lx + 0.18, ly - 0.45, lx + 0.36, ly + 0.75, '#6f7378');
  P.arc(lx, ly - 0.45, 0.36, '#6f7378'); P.arc(lx, ly - 0.45, 0.18, '#c6c8cb');
  P.r(lx - 0.05, ly - 0.6, lx + 0.05, ly + 0.75, '#6f7378');
  for (const f of [0.72, 0.38]) { P.arc(len * 0.82, Y(f), 0.72, '#d9d6cf'); P.arc(len * 0.82, Y(f), 0.58, '#3f4955'); }
}
const brickPlain = (P, W) => P.brick(0, P.y0, W.len, P.y1, C.brick, 13);
function brickGrid(P, W) {
  const len = W.len;
  P.brick(0, P.y0, len, P.y1, C.brick, 13);
  for (let y = 1.2; y < W.eaves - 2; y += 3.4) for (let x = 2; x < len - 1.5; x += 3.0) P.win(x - 0.65, y, x + 0.65, y + 1.7, sq({ frame: '#d9d6cf' }));
}

// The houses, with the walls that need more than the house's own spec. `near` points are the walls' middles.
function houses(later) {
  return [
    // ---- Kunstimaja: its front to Vanemuise (the painting by the Akadeemia corner, the door under its canopy)
    { name: 'kunstimaja', sec: '3_6', base: 2472, at: [1356.5, 3385], r: 40,
      spec: plaster(C.white, { storey: 4.2, maxFloors: 3, plinth: { h: 0.75, col: '#a8a6a2' }, win: sq({ w: 1.5, pitch: 2.6, rails: 1 }), attic: { w: 0.9, h: 1.1 } }),
      walls: [{ near: [1342.8, 3372.3], doors: [{ x: 11.2, w: 2.0, h: 2.7, col: '#3a3a3e', light: 0.7, panels: 1 }],
        draw: (P, W) => { mural(P, 1.6, 3.7, 5.6, 8.3); later.push(() => canopy(W, 9.8, 12.6, 3.05, 1.7)); } }] },
    // (ochre, three storeys and a strip of dark stair windows in Martin's street views of Aug 2023)
    { name: 'akadeemia5', sec: '3_6', base: 2437, at: [1377, 3350.5], r: 20,
      spec: plaster(C.ochre, { storey: 3.3, maxFloors: 3, plinth: { h: 0.7, col: '#a39a8c' }, win: sq({ w: 1.3, pitch: 2.6, frame: '#f6f3ec' }), attic: null }),
      walls: [{ near: [1369.5, 3341.9], doors: [{ x: 7.7, w: 1.4, h: 2.4, col: '#5d544c', steps: 2 }], draw: (P, W) => { for (let y = 1.2; y < W.eaves - 0.8; y += 0.62) P.r(W.len * 0.7 - 0.45, y, W.len * 0.7 + 0.45, y + 0.5, '#3e4451'); } }] },
    // ---- Vanemuise 12 and its sheds
    { name: 'v12', sec: '3_6', base: 2431, at: [1407, 3316.5], r: 16,
      spec: plaster(C.villa, { storey: 3.4, maxFloors: 2, plinth: { h: 0.7, col: '#9d9893' }, win: { w: 1.0, pitch: 2.4, T: true, surround: 0.12, sc: '#f7f5f0' }, belts: [3.75] }),
      walls: [{ near: [1401.4, 3312], n: 6, doors: [{ x: 9.6, w: 1.3, h: 2.6, col: '#6b5240', steps: 2 }],
        draw: (P) => { P.arc(9.6, 5.6, 0.75, '#f7f5f0'); P.r(8.85, 4.3, 10.35, 5.6, '#f7f5f0'); P.arc(9.6, 5.6, 0.6, C.glass); P.r(9.0, 4.4, 10.2, 5.6, C.glass); P.r(9.57, 4.4, 9.63, 6.2, '#f7f5f0'); } }] },
    { name: 'v12sheds', sec: '3_6', base: 2508, at: [1398.5, 3339.5], r: 12, spec: plaster([232, 229, 222], { storey: 2.8, maxFloors: 2, win: sq({ w: 0.9, pitch: 3.2 }), attic: null }) },
    { name: 'v12shed2', sec: '3_6', base: 2504, at: [1404, 3349], r: 8, spec: plaster([232, 229, 222], { storey: 2.8, maxFloors: 1, win: sq({ w: 0.9, pitch: 3.5 }), attic: null }) },
    // ---- W. Struve 3: the narrow end on Vanemuise, the long sides down Struve
    { name: 'struve3', sec: '3_6', base: 2303, at: [1442.5, 3318], r: 32,
      spec: plaster(C.beige, { storey: 3.0, maxFloors: 4, plinth: { h: 0.8, col: '#9e968a', vents: 3.4 }, win: sq({ w: 1.3, pitch: 2.9, frame: '#f1ede4' }) }),
      walls: [{ near: [1428.9, 3296.6], n: 2,
        draw: (P, W) => {                                                // the KOOPIAKESKUS and REISID signs over the door (Street View, 12 Vanemuise)
          P.r(W.len * 0.35, 3.0, W.len * 0.95, 3.7, '#2e6fd0'); P.text('KOOPIAKESKUS', W.len * 0.65, 3.35, 0.42, '#f4e9a8', '800 %px Georgia, serif');
          P.r(W.len * 0.38, 3.75, W.len * 0.92, 4.55, '#e9edf2'); P.text('REISID', W.len * 0.65, 4.15, 0.5, '#8fa3c0', '800 %px Georgia, serif');
        } }] },
    // ---- Vanemuise 8: thirteen windows a floor on the front, the door in the middle
    { name: 'v8', sec: '3_6', base: 2076, at: [1463.5, 3276], r: 32,
      spec: plaster(C.cream, { storey: 3.3, maxFloors: 3, plinth: { h: 0.95, col: '#a29b8f', vents: 2.5 }, win: sq({ w: 1.25, pitch: 2.45, rails: 1 }), belts: [] }),
      walls: [{ near: [1457, 3261.2], n: 12, doors: [{ x: 16.15, w: 1.6, h: 2.6, col: '#594a3f', steps: 3 }],
        draw: (P, W) => { later.push(() => canopy(W, 14.9, 17.4, 3.0, 1.1)); } }] },
    // ---- the theatre
    // (its front block on columns over the terrace is built in kontserdimaja.js: its walls are left out here)
    { name: 'vanemuine', sec: '3_6', base: 1627, at: [1534.5, 3263], r: 70, pick: (x, z, top) => !frontCut(x, z, top),
      spec: plaster(C.grey, { storey: 3.6, maxFloors: 4, plinth: { h: 0.6, col: '#8f8d89' }, win: sq({ w: 1.6, pitch: 2.5, frame: '#d9d9d6', glass: '#3f4a58' }), weather: 0.6, attic: null }),
      walls: [
        { near: [1548.9, 3241.7], within: 3, only: fins },                                          // the front block's fins
        { near: [1504.1, 3228.2], within: 0.6, only: concertFront },                                // the brick box over the street
        { near: [1504.7, 3229], within: 0.5, only: brickPlain },
        ...[[1498.3, 3237.9], [1502.5, 3243.1]].map((near) => ({ near, within: 1, only: brickPlain })),   // its north-west end
        { near: [1525.7, 3236.8], within: 3, only: brickGrid },                                     // over the forecourt
        ...[[1521.9, 3266], [1545.8, 3263.8], [1547.3, 3279.6], [1531.1, 3261.7]].map((near) => ({ near, within: 3, only: brickGrid })),   // the stage tower
        { near: [1576.5, 3239.6], within: 3, only: (P, W) => { P.r(0, P.y0, W.len, P.y1, '#8e8c8a'); for (let x = 0; x < W.len; x += 1.2) P.r(x, P.y0, x + 0.02, P.y1, '#6f6d6b'); P.r(0, P.y1 - 0.35, W.len, P.y1, '#a7a5a1'); } },   // the granite terrace wall
        { near: [1565, 3248.2], within: 3, only: (P, W) => { P.r(0, P.y0, W.len, P.y1, '#e8e7e2'); P.text('VANEMUINE', W.len / 2, (P.y0 + P.y1) / 2, Math.min(2.2, (P.y1 - P.y0) * 0.62), '#2b2d33', '700 %px Georgia, serif'); } },
      ] },
    // ---- across the road
    { name: 'v19', sec: '3_6', base: 2422, at: [1382, 3289.5], r: 30,
      spec: plaster([233, 231, 225], { storey: 3.2, maxFloors: 2, plinth: { h: 0.6, col: '#8f8e8c' }, win: { w: 1.0, pitch: 2.3, T: true, surround: 0.1, sc: '#f6f5f0' } }),
      walls: [{ near: [1392.8, 3297.5], doors: [{ x: 8.0, w: 1.2, h: 2.5, col: '#5b4b40', steps: 2 }] }] },
    { name: 'v21', sec: '3_6', base: 2515, at: [1355.5, 3323], r: 30,
      spec: plaster(C.c21, { storey: 3.3, maxFloors: 3, plinth: { h: 0.8, col: '#9b958a' }, win: { w: 1.3, pitch: 2.6, T: true, surround: 0.14, sc: '#f2f1ec', frame: '#f4f3ef', glass: '#4d5868' }, belts: [] }),
      walls: [{ near: [1365.1, 3328.4], doors: [{ x: 13.0, w: 1.4, h: 2.5, col: '#5f5246', steps: 2 }],
        draw: (P, W) => { P.r(0, W.eaves - 0.5, W.len, W.eaves, '#eeede8'); P.text('aurora', W.len * 0.78, 3.15, 0.42, '#2f62c9', '700 %px Arial, sans-serif'); } }] },
  ];
  // a flat dark canopy sticking out of a wall from x0 to x1, at height y, `depth` deep
  function canopy(W, x0, x1, y, depth) {
    later.box(W, (x0 + x1) / 2, depth / 2, y, x1 - x0, 0.18, depth, 0x3b3c40);
  }
}

// ---------------------------------------------------------------- the build
export function createVanemuise(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  // (through the work queue, ../jobs.js: the fronts are painted by skinHouses' own queued job, and the boxes
  // their draw callbacks ask for are laid by the job after it, once the walls are measured. Built in one go
  // the canopies were laid before any wall had asked for them, and were missing.)
  function build() {
    const K = streetKit(world, group, { shadows });
    const { p } = K;
    const h = (x, z) => world.heightAt(x, z);
    // 3D pieces fixed to a painted wall: x along it, out from it, y above its ground line
    const later = [];
    later.box = (W, x, out, y, w, hh, d, c) => later.push(() => {
      const px = W.a[0] + W.ux * x + W.nx * out, pz = W.a[1] + W.uz * x + W.nz * out;
      p.box(w, hh, d, c, px, W.yref + y, pz, Math.atan2(W.nx, W.nz));
    });
    const faces = (W) => { const [, v] = SV(W.mid[0], W.mid[1]); return Math.abs(v) < 62; };
    skinHouses(world, group, houses(later), { faces, shadows, ppm: 24, far: 10 });
    jobs.add(function* () {
      for (let k = 0; k < later.length; k++) { later[k](); if (jobs.late()) yield; }        // (draw callbacks queue boxes that queue more)
      flags();
      yield;
      K.finish();
    }, 'vanemuise boxes');
    // the three flags on the theatre's forecourt by the front entrance
    function flags() {
      for (const [k, v] of [36, 39, 42].entries()) {
        const [x, z] = L(244.5, v), y = h(x, z);
        p.add(new THREE.CylinderGeometry(0.05, 0.07, 9, 10), 0xe9e9e6, x, y + 4.5, z);
        p.box(0.02, 1.0, 1.6, [0x2a62b8, 0xb1282e, 0xf1f1ee][k], x + D[0] * 0.8, y + 8.3, z + D[1] * 0.8, Math.atan2(D[0], D[1]));
      }
    }
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 450) return;
      if ([L(-36, 50), L(-10, -30), L(240, 80), L(200, 0)].every((q) => world.ready(q[0], q[1]))) { built = true; jobs.add(build, 'vanemuise'); }
    },
  };
}
