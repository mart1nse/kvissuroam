// J. Kuperjanovi tänav on the lap, from the Veski corner to the Vallikraavi/Pepleri junction (Martin, 21 Nov:
// kaardista, "the facades on the racetrack, with garden parts like fences facing the track"; his street views of
// Aug 2024). The road itself, its paint and kerbs are left as they are, and nothing is put on the carriageway.
// The map's own blocks get painted fronts (skinHouses, queued a wall at a time):
//  - Kuperjanovi 5a: the salmon pink four-storey block, white window surrounds and belts, dark frames;
//  - Korp! Ugala (Kuperjanovi 16): the white house with the tall upper windows between pilasters, the porch
//    with the balcony on its roof, the bike stands and the brick-paved forecourt;
//  - Kuperjanovi 1: the dark grey block with white windows and the pale top floor;
//  - Kuperjanovi 2: the orange block with three-pane white windows over a dark grey plinth, and in front of it
//    the lawn with the row of poplars (OSM's trees) and the paved walk along the wall;
//  - Pepleri 1a, the Naerumaa kindergarten: bronze cladding, the glass corner, black square windows, and the
//    black bar fence along the car park;
//  - Vallikraavi 24 on the corner: rough ochre render, smooth cream bands, the dark metal mansard floor and the
//    grey boards in the gable, and the grey board fence beside it.
// Fences along the pavements: the building-site mesh panels with fireweed west of 5a, the white board fence by
// the big tree, the green mesh fence with the tall rowan hedge west of Ugala.
// Everything is built in small steps in the work queue once the car is near (see ../jobs.js).
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { jobs } from '../jobs.js';

const S6 = ['2_6', 480, 3040];
const CENTRE = [985, 3262];
// the lap's centre line along the street (from the track), for which way a wall faces
const ROAD = [[872.8, 3280.0], [1004.5, 3253.8], [1078.4, 3246.1], [1102.9, 3245.8]];
function roadZ(x) {
  for (let i = 0; i < ROAD.length - 1; i++) {
    const [a, b] = [ROAD[i], ROAD[i + 1]];
    if (x <= b[0] || i === ROAD.length - 2) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
  }
  return ROAD[0][1];
}
// does the wall look at the street (or the car park in front of it)?
const front = (W) => W.nz * Math.sign(roadZ(W.mid[0]) - W.mid[1]) > 0.75;

// [name, base, at, reach, wall, roof, pick]
const HOUSES = [
  ['pink', 3122, [937, 3251], 18, 0xe3a090, 0x9a9da6],
  ['ugala', 3121, [937.5, 3287], 15, 0xf2f3f6, 0x8d929e],
  ['grey', 3184, [996, 3238], 24, 0x5f5d5c, 0x8e9198, (x, z) => z > 3224.5],
  ['orange', 3212, [997, 3279.5], 30, 0xe28866, 0x7d828e],
  ['kinder', 3173, [1066, 3292], 32, null, null, (x, z) => z < 3316 && x < 1099],
  ['valli24', 3163, [1038.5, 3234], 11, null, null],
];

export function kuperjanovi2Walls(walls) {
  // (the kindergarten and Vallikraavi 24 keep the colours pepleri.js gives them; their fronts are painted here)
  setHouseColours(walls, S6[0], S6[1], S6[2], HOUSES.filter((H) => H[4] !== null).map(([, base, at, reach, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach })));
}

// ---------------------------------------------------------------- the painted fronts
function grid(P, x0, x1, pitch, w, fn) {
  const n = Math.max(1, Math.floor((x1 - x0 + pitch - w) / pitch)), off = x0 + (x1 - x0 - ((n - 1) * pitch + w)) / 2;
  for (let k = 0; k < n; k++) fn(off + k * pitch, k);
}
function pink(P, W) {
  const len = W.len, top = W.eaves;
  P.r(0, P.y0, len, P.y1, '#e3a090'); P.weather(0, P.y0, len, P.y1, 0.3, 51);
  P.r(0, P.y0, len, 0.75, '#b98c84');
  P.r(0, 3.05, len, 3.22, '#f5eee9');                                   // the belt over the ground floor
  P.r(0, top - 0.45, len, top, '#f5eee9');                              // and under the eaves
  if (len < 4) return;
  for (let y = 1.1; y + 1.5 < top - 0.6; y += 3.05) {
    grid(P, 0.8, len - 0.8, 3.3, 1.55, (x) => P.win(x, y, x + 1.55, y + 1.5, { frame: '#5b4438', glass: '#4d5a6a', fw: 0.08, bars: 1, surround: 0.15, sc: '#f7f2ee', sill: 0.09 }));
  }
  for (const x of [0.35, len - 0.5]) P.r(x, P.y0, x + 0.13, top - 0.3, '#a9a5a6');     // downpipes
  if (W.front && len > 20) {
    P.door(len * 0.5 - 0.7, len * 0.5 + 0.7, 2.3, '#6d4a3a', { frame: '#f2ece6' });
    P.arc(len * 0.3, 2.6, 0.5, '#c43a44'); P.arc(len * 0.3, 2.6, 0.38, '#d9535c');     // the round red sign
  }
}
function ugala(P, W) {
  const len = W.len, top = W.eaves;
  P.r(0, P.y0, len, P.y1, '#f2f3f6'); P.weather(0, P.y0, len, P.y1, 0.18, 16);
  P.r(0, P.y0, len, 0.95, '#d3d4d9');                                   // the plinth
  P.r(0, top - 0.55, len, top, '#fbfbfd'); P.r(0, top - 0.6, len, top - 0.55, '#c9cbd2');
  if (len < 4) return;
  const pitch = 2.35;
  grid(P, 0.6, len - 0.6, pitch, 1.25, (x) => {
    P.r(x - 0.42, 1.0, x + 1.67, top - 0.6, '#f9f9fb');                 // the pilasters' faces
    P.r(x - 0.04, 1.0, x + 1.29, top - 0.6, '#e6e7ec');                 // the recess between them
    P.win(x + 0.12, 0.25, x + 1.13, 0.8, { frame: '#e9eaee', glass: '#4a5462', fw: 0.06, bars: 0, sill: 0 });   // the cellar
    P.win(x, 1.35, x + 1.25, 2.95, { frame: '#fafafa', glass: '#55667a', fw: 0.07, bars: 1, rails: 1, sill: 0.08 });
    P.r(x, 3.15, x + 1.25, 3.85, '#f4f5f8');                            // the panel under the tall window
    const y1 = Math.min(top - 1.0, 7.8);
    P.win(x + 0.05, 4.0, x + 1.2, y1, { frame: '#fafafa', glass: '#5b6d82', fw: 0.07, bars: 1, rails: 2, sill: 0.08 });
    P.line(x + 0.25, y1 - 0.75, x + 1.0, y1 - 0.75, '#e7e8ee', 0.03);     // the light ironwork in the top pane
    P.arc(x + 0.625, y1 - 0.45, 0.16, '#e7e8ee');
  });
}
function grey(P, W) {
  const len = W.len, top = W.eaves;
  P.r(0, P.y0, len, P.y1, '#5f5d5c'); P.weather(0, P.y0, len, P.y1, 0.35, 71);
  P.r(0, P.y0, len, 0.8, '#4b4948');
  const attic = top > 13 ? top - 3.0 : top;                             // the pale top floor
  if (attic < top) P.r(0, attic, len, P.y1, '#d6d6d2');
  if (len < 4) return;
  grid(P, 0.7, len - 0.7, 2.7, 1.3, (x) => P.r(x + 1.6, 0.8, x + 1.95, attic, '#565453'));   // the lesenes
  for (let y = 1.3; y + 1.6 < top - 0.5; y += 3.05) {
    grid(P, 0.7, len - 0.7, 2.7, 1.3, (x) => P.win(x, y, x + 1.3, y + 1.6, { frame: '#f4f4f2', glass: '#4f5e70', fw: 0.08, bars: 1, rails: 1, sill: 0.08 }));
  }
  for (const x of [0.4, len - 0.55]) P.r(x, P.y0, x + 0.14, top, '#b9bbbe');
  if (W.front && len > 20) P.door(len * 0.55 - 0.75, len * 0.55 + 0.75, 2.4, '#3d3836', { frame: '#cfcfcb' });
}
function orange(P, W) {
  const len = W.len, top = W.eaves;
  P.r(0, P.y0, len, P.y1, '#e28866'); P.weather(0, P.y0, len, P.y1, 0.3, 22);
  P.r(0, P.y0, len, 0.95, '#55565b');                                   // the dark plinth
  if (len < 4) return;
  for (let y = 1.6; y + 1.5 < top - 0.5; y += 2.9) {
    grid(P, 0.8, len - 0.8, 3.6, 1.9, (x) => {
      P.win(x, y, x + 1.9, y + 1.5, { frame: '#f6f5f2', glass: '#4e5d6e', fw: 0.08, bars: 2, sill: 0.08 });
      if (y < 2) P.win(x + 0.5, 0.25, x + 1.4, 0.7, { frame: '#dcdcdc', glass: '#3e4650', fw: 0.05, bars: 0, sill: 0 });
    });
  }
  grid(P, 0.8, len - 0.8, 7.2, 0.14, (x) => P.r(x + 3.4, P.y0, x + 3.54, top, '#7f8187'));   // downpipes
  if (W.front && len > 20) for (const f of [0.25, 0.5, 0.75]) P.door(len * f - 0.65, len * f + 0.65, 2.3, '#6a4e3e', { frame: '#f2f0ea' });
}
function kinder(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#a88b56');
  for (let x = 0.6; x < len; x += 1.2) P.r(x, P.y0, x + 0.03, P.y1, '#8a7143');              // the cladding's seams
  for (let y = 1.2; y < top; y += 1.2) P.r(0, y, len, y + 0.02, '#957c4b');
  P.weather(0, P.y0, len, P.y1, 0.15, 33);
  if (len < 4) return;
  const glass = W.front && W.nx < -0.2;                                // the glass corner looks west along the car park
  if (glass) {
    P.grad(0.3, 0.3, Math.min(len - 0.3, 14), top - 0.8, '#6f8798', '#3f5263');
    for (let x = 0.3; x < Math.min(len - 0.3, 14); x += 1.5) P.r(x, 0.3, x + 0.06, top - 0.8, '#2c2f33');
    P.r(0.3, 3.2, Math.min(len - 0.3, 14), 3.28, '#2c2f33');
  } else {
    let k = 0;
    for (let y = 1.0; y + 1.3 < top - 0.6; y += 3.0) grid(P, 1.2, len - 1.2, 2.8, 1.2, (x) => { if ((k++ * 7) % 5 !== 1) P.r(x, y, x + 1.2, y + 1.3, '#25272b'); });
  }
  if (W.front && len > 25 && !glass) {
    P.arc(len - 5, top - 2.2, 1.2, '#8f7746'); P.arc(len - 5, top - 2.2, 1.05, '#a88b56');      // the round sign
    P.text('NAERUMAA', len - 5, top - 2.25, 0.36, '#7c6438', '700 %px Georgia, serif', 'center', -0.35);
  }
}
function valli24(P, W) {
  const len = W.len, top = W.peak, gable = top - W.eaves > 2.5;
  P.r(0, P.y0, len, P.y1, '#d9b77e'); P.weather(0, P.y0, len, P.y1, 0.55, 24);
  P.r(0, P.y0, len, 0.95, '#cbc6bd');                                   // the plinth
  if (len < 3) return;
  for (const x of [0, len - 0.7]) P.r(x, 0.95, x + 0.7, top, '#efe1c2');                 // the smooth corner bands
  P.r(0, 3.65, len, 3.95, '#efe1c2');
  if (gable) {
    P.boards(0, W.eaves + 1.6, len, top, [150, 152, 150], 0.16, true);  // grey boards in the gable's top
    P.arc(len / 2, W.eaves + 0.8, 0.22, '#efe1c2'); P.arc(len / 2, W.eaves + 0.8, 0.14, '#4a5462');
  } else if (W.eaves > 5) {
    P.r(0, 4.0, len, top, '#4f5560');                                   // the mansard floor in dark metal
    for (let x = 0.25; x < len; x += 0.5) P.r(x, 4.0, x + 0.03, top, '#3f444e');
  }
  grid(P, 0.9, len - 0.9, 2.6, 0.95, (x) => {
    P.win(x + 0.1, 0.3, x + 0.85, 0.75, { frame: '#e8e5df', glass: '#4a5462', fw: 0.05, bars: 0, sill: 0 });
    P.win(x, 1.4, x + 0.95, 3.0, { frame: '#f7f5f0', glass: '#55667a', fw: 0.07, bars: 1, rails: 1, sill: 0.08 });
    if (W.eaves > 5 || gable) P.win(x, 4.5, x + 0.95, 6.0, { frame: '#f7f5f0', glass: '#55667a', fw: 0.07, bars: 1, rails: 1, sill: 0.08 });
  });
}
const PAINT = { pink, ugala, grey, orange, kinder, valli24 };

// ---------------------------------------------------------------- along the pavements
// Ugala's north wall (s from its west corner, v + into the house) and Kuperjanovi 2's (the same)
const UG = frame([926.0, 3280.1], [19.3, -3.7]);
const OR = frame([972.1, 3277.4], [48.4, -7.2]);
// OSM's trees in the lawn before Kuperjanovi 2: the street views show a row of poplars there
const POPLARS = [[962.3, 3271.7], [965.1, 3271.2], [969.5, 3270.4], [974.7, 3269.1], [980.9, 3267.7], [985.9, 3267.0],
  [991.0, 3265.9], [997.2, 3264.4], [1002.7, 3263.7], [1007.5, 3263.0]];
const FENCES = {
  site: [[883.4, 3271.6], [898.2, 3268.4], [903.5, 3266.5], [912.4, 3263.8], [917.9, 3262.1]],   // the building site west of 5a
  white: [[951.1, 3255.5], [972.9, 3251.7], [978.5, 3250.7]],                                  // the white boards by the big tree
  ugala: [[903.6, 3282.4], [925.6, 3278.2]],                                                   // the green mesh west of Ugala
  grey: [[1046.2, 3239.4], [1058.8, 3238.4]],                                                  // the grey boards by Vallikraavi 24
  kinder: [[1041.5, 3273.0], [1060.0, 3278.5], [1081.0, 3284.8]],                              // the black bars along the car park
};

export function createKuperjanovi2(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  world.addTrees(POPLARS.map(([x, z], k) => [x, z, 15 + (k * 7 % 5) * 0.8, 3.0 + (k % 3) * 0.4, 0]));
  let built = false;

  function* build() {
    const houses = HOUSES.map(([name, base, at, r, , , pick]) => ({ name, sec: S6[0], base, at, r, pick,
      spec: { wall: [220, 220, 218], floors: [], attic: null, eaves: false },
      walls: [{ near: [0, 0], within: 1e9, only: (P, W) => { W.front = front(W); PAINT[name](P, W); } }] }));
    skinHouses(world, group, houses, { shadows, ppm: 16, far: 5, faces: (W) => W.len > 5 && W.foot < 2 && front(W) });
    yield;
    const A = areaKit(world, group, { shadows, fenceColour: 0x8d958f });
    const { p, h } = A;
    // the lawn and the poplars' walk before Kuperjanovi 2, the paved walk along its wall
    A.pave(OR, 0.5, 48, -9.0, -2.2, 'lawn');
    A.pave(OR, 0, 48.4, -2.2, -0.2, 'pavers');
    yield;
    // Ugala: the brick-paved forecourt, the porch with the balcony on its roof, the bike stands
    A.pave(UG, 0.3, 19.3, -2.6, -0.2, 'pavers');
    A.box(UG, 17.3, -1.1, 3.0, 2.2, -0.3, 2.85, 0xf4f5f8);
    A.box(UG, 17.3, -1.2, 3.4, 2.5, 2.85, 3.0, 0xe6e7ec);
    A.box(UG, 17.3, -2.27, 0.9, 0.12, 0, 2.2, 0x6b5a4c);                 // the door
    const rail = [UG.at(15.7, -0.1), UG.at(15.7, -2.4), UG.at(18.9, -2.4), UG.at(18.9, -0.1)];
    const ry = h(...UG.at(17.3, -1.2));
    for (let k = 0; k < 3; k++) A.bar(rail[k], rail[k + 1], 0.04, 3.9, 3.95, 0x2b2c30, ry);
    for (let k = 0; k < 3; k++) A.walk([rail[k], rail[k + 1]], 0.4, ([x, z]) => p.box(0.025, 0.95, 0.025, 0x2b2c30, x, ry + 3.45, z));
    for (let s = 3; s < 12; s += 1.1) {
      const [a, b] = [UG.at(s, -1.0), UG.at(s, -1.7)];
      A.bar(a, b, 0.05, 0.72, 0.78, 0x9a9ea6);
      for (const q of [a, b]) p.box(0.05, 0.78, 0.05, 0x9a9ea6, q[0], h(q[0], q[1]) + 0.39, q[1]);
    }
    yield;
    // the green mesh fence west of Ugala and the tall rowan hedge behind it
    A.mesh(FENCES.ugala, 1.6, 0x34463a);
    const back = (pts, d) => pts.map(([x, z]) => [x + UG.V[0] * d, z + UG.V[1] * d]);
    A.hedge(back(FENCES.ugala, 1.1), 2.7, 1.3, [0.46, 0.7, 0.44]);
    A.bushes([[907.5, 3285.0, 2.6, 3.4, [0.5, 0.62, 0.42]], [914.5, 3283.8, 2.8, 3.6, [0.5, 0.62, 0.42]], [921.5, 3282.4, 2.6, 3.3, [0.5, 0.62, 0.42]]]);
    // the building site's mesh panels west of 5a, fireweed and long grass behind them
    A.mesh(FENCES.site, 2.0, 0x9aa1a6);
    A.walk(FENCES.site, 1.6, ([x, z], [ux, uz]) => A.bushes([[x + uz * 0.9, z - ux * 0.9, 1.1, 1.2, (Math.round(x) % 3) ? [1.25, 0.62, 1.05] : [0.8, 0.95, 0.6]]]));
    yield;
    // the white board fence by the big tree, the grey one by Vallikraavi 24
    boards(A, FENCES.white, 2.0, 0xf1f1f3, 0xe0e0e4);
    boards(A, FENCES.grey, 1.4, 0xa6a9ad, 0x8f9296);
    // the black bar fence along the kindergarten's car park
    bars(A, FENCES.kinder, 1.3, 0x222327);
    yield;
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 420) return;
      if ([[900, 3272], [995, 3262], [1060, 3262]].every((q) => world.ready(q[0], q[1]))) { built = true; jobs.add(build, 'kuperjanovi2'); }
    },
  };
}

// a fence of upright boards: one panel per stretch with a top rail, posts every 2.4 m
function boards(A, pts, height, c, post) {
  const { p, h } = A;
  for (let i = 0; i < pts.length - 1; i++) {
    A.bar(pts[i], pts[i + 1], 0.04, 0.05, height, c);
    A.bar(pts[i], pts[i + 1], 0.07, height - 0.08, height + 0.02, post);
  }
  A.walk(pts, 2.4, ([x, z]) => p.box(0.09, height + 0.06, 0.09, post, x, h(x, z) + (height + 0.06) / 2, z));
  const e = pts[pts.length - 1];
  p.box(0.09, height + 0.06, 0.09, post, e[0], h(e[0], e[1]) + (height + 0.06) / 2, e[1]);
}
// a fence of steel bars: two rails, a bar every 0.22 m, a post every 2.5 m
function bars(A, pts, height, c) {
  const { p, h } = A;
  for (let i = 0; i < pts.length - 1; i++) { A.bar(pts[i], pts[i + 1], 0.04, 0.1, 0.15, c); A.bar(pts[i], pts[i + 1], 0.04, height - 0.08, height - 0.03, c); }
  A.walk(pts, 0.22, ([x, z]) => p.box(0.02, height - 0.08, 0.02, c, x, h(x, z) + 0.06 + (height - 0.08) / 2, z));
  A.walk(pts, 2.5, ([x, z]) => p.box(0.07, height + 0.05, 0.07, c, x, h(x, z) + (height + 0.05) / 2, z));
}
