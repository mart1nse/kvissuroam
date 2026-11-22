// Tartu railway station (Vaksali 6), from the Land Board's oblique air photos (April 2023 and 2024), the
// orthophoto and the height model (no Street View pictures this time, so the window rows and colours are read
// from the air photos and some details are guessed):
//  - the station: the long two-storey wooden house in its khaki boards, with white corner boards, the white band
//    between the floors and the cornice, tall windows below and lower ones above, its light grey metal roofs
//    with the red brick chimneys; the entrance porch on the plaza side with its posts, its little hipped roof
//    and the steps up to it; the canopy on posts along the platform side;
//  - the long glazed shelter on the island platform across the first track;
//  - the round red brick water tower at the south end, with its wider top and its row of small windows;
//  - Vaksali 8 to the north-west and the hotel at Vaksali 4 to the south-east in their colours, with painted
//    fronts and chimneys, the dark timber goods shed beyond the platforms;
//  - a few cars waiting at the taxi stand before the station.
// No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours, addHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { still } from '../still.js';
import { jobs } from '../jobs.js';

const S26 = ['2_6', 480, 3040], S16 = ['1_6', -160, 3040], S27 = ['2_7', 480, 3680];
// s along the tracks (north-east to south-west is -s), v across them: + towards the platforms, - towards the plaza
const F = frame([530, 3600], [0.6716, 0.7409]);
const CENTRE = [520, 3590];
const P2 = (s, v) => F.at(s, v);
// the porch on the plaza side (s, v), the canopy along the platform side, the island platform's shelter
const PORCH = { s0: -9.8, s1: 0.2, v0: -21.2, v1: -16.0, roof: 35.4, eaves: 33.0 };
const CANOPY = { s0: -40.3, s1: 30.3, v0: 0.4, v1: 3.4, y: 34.25 };
const ISLAND = { s0: -136, s1: 20, v0: 10.9, v1: 20.2, sv0: 12.4, sv1: 18.7, y: 34.25 };
const TOWER = { x: 660.15, z: 3700.3, top: 57.37, peak: 58.37 };

// [name, sector, base, at, reach, wall, roof]
const HOUSES = [
  ['station', S26, 2692, [533.8, 3590.0], 44, 0xc4b68a, 0xb7bdc2],
  ['house', S26, 2852, [505.9, 3534.2], 22, 0xd9cda7, 0xa2aab1],
  ['hotel', S26, 2845, [586.0, 3622.5], 18, 0xd4c59c, 0x9aa3ab],
];

export function vaksaliWalls(walls) {
  setHouseColours(walls, S26[0], S26[1], S26[2], HOUSES.map(([, , base, at, reach, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach })));
  // the goods shed beyond the platforms: dark timber, a dark roof
  setHouseColours(walls, S16[0], S16[1], S16[2], [{ base: 2880, x: 390.6, z: 3516.0, wall: 0x5b4636, roof: 0x58534f, reach: 75 }]);
  // the map's porch roof, the platform canopy and the island shelter float on nothing: built again by hand
  // (each twice: the map takes the grey parts of a floating roof for a carport, which only a shelter entry hides;
  // and the colour survey's own entry for a block is changed in place, or the nearer of the two would win)
  const hide = (S, list) => { setHouseColours(walls, S[0], S[1], S[2], list); addHouseColours(walls, S[0], S[1], S[2], list.map((e) => ({ ...e, shelter: true }))); };
  hide(S26, [
    { base: 3363, x: 540.6, z: 3584.0, hide: true, reach: 8 },
    { base: 3284, x: 526.9, z: 3596.9, hide: true, reach: 44 },
    { base: 3335, x: 479.6, z: 3567.4, hide: true, reach: 82 },
  ]);
  // the water tower: a jagged block in the map, round here
  hide(S27, [{ base: 2796, x: TOWER.x, z: TOWER.z, hide: true, reach: 8 }]);
}

export const VAKSALI_CARS = [
  [-10.5, -35.2, 'passat', 'white'], [-5.0, -35.2, 'model3', 'black'], [0.5, -35.2, 'rav4', 'silver'], [6.0, -35.2, 'accord', 'white'],
].map(([s, v, id, paint]) => { const [x, z] = P2(s, v); return [x, z, Math.atan2(F.U[0], -F.U[1]), id, paint, 0]; });

// ---------------------------------------------------------------- the painters (W: one wall, x = 0 at its start)
const at = (W, x) => [W.a[0] + W.ux * x, W.a[1] + W.uz * x];
// a two-storey wooden house: boards, white corner boards, the band between the floors, the cornice, windows
function wooden(P, W, { boards, glass = '#3c4650', trim = '#f1efe8', door = null }) {
  const len = W.len, eav = Math.max(3.4, W.eaves);
  P.boards(0, P.y0, len, W.peak, boards, 0.17);
  P.weather(0, P.y0, len, eav, 0.25, Math.round(len * 7));
  P.r(0, P.y0, len, 0.55, '#8b847a');                                        // the stone plinth
  P.r(0, P.y0, 0.3, eav, trim); P.r(len - 0.3, P.y0, len, eav, trim);       // the corner boards
  const two = eav > 6.2;
  if (two) P.r(0, 3.75, len, 3.95, trim);
  P.r(0, eav - 0.4, len, eav, trim);
  if (len < 2.6) return;
  const n = Math.max(1, Math.round((len - 1.2) / 2.7)), step = (len - 0.6) / n;
  for (let k = 0; k < n; k++) {
    const xm = 0.3 + step * (k + 0.5), [wx, wz] = at(W, xm), top = W.topAt(xm);
    if (door && Math.hypot(wx - door[0], wz - door[1]) < door[2]) {         // the doors under the porch
      P.door(xm - 0.8, xm + 0.8, 2.9, '#6a4a32', { frame: trim, panels: 2, glass: '#46525e', light: 0.45 });
      continue;
    }
    if (top > 3.6) P.win(xm - 0.6, 1.0, xm + 0.6, 3.2, { frame: trim, glass, fw: 0.08, bars: 1, rails: 2, sill: 0.08, sc: trim, hood: 0.12 });
    if (two && top > 6.6) P.win(xm - 0.52, 4.55, xm + 0.52, 6.15, { frame: trim, glass, fw: 0.07, bars: 1, rails: 1, sill: 0.07, sc: trim });
  }
  // a small window in a gable end
  if (W.peak - eav > 2.4 && len < 18) P.win(len / 2 - 0.4, eav + 0.5, len / 2 + 0.4, eav + 1.5, { frame: trim, glass, fw: 0.06, bars: 1, sill: 0.05 });
}
const DOOR = [...P2(-4.8, -16.2), 6.5];
const PAINT = {
  station: (P, W) => wooden(P, W, { boards: [196, 182, 138], door: DOOR }),
  house: (P, W) => wooden(P, W, { boards: [217, 205, 167] }),
  hotel: (P, W) => wooden(P, W, { boards: [212, 197, 156], glass: '#45505a' }),
};

// the chimneys: [x, z, the roof's height there]
const CHIMNEYS = [
  [516, 3571, 38.91], [512, 3575, 39.0], [520, 3575, 38.31], [526, 3590, 39.34], [533, 3594, 40.61], [530, 3597, 40.5],
  [540, 3598, 37.46], [548, 3605, 38.58], [552, 3609, 38.7], [546, 3610, 39.34],
  [500, 3530, 38.64], [510, 3540, 38.99], [585, 3620, 38.44], [590, 3628, 38.68],
];

export function createVaksali(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  const h = (x, z) => world.heightAt(x, z);
  let built = false;
  // the island shelter and the water tower stand in the way; the porch and its steps too
  { const [x, z] = P2((ISLAND.s0 + ISLAND.s1) / 2, (ISLAND.sv0 + ISLAND.sv1) / 2);
    world.addSolids([{ x, z, yaw: F.YAW, hx: (ISLAND.s1 - ISLAND.s0) / 2, hz: (ISLAND.sv1 - ISLAND.sv0) / 2 }]);
    const [px, pz] = P2((PORCH.s0 + PORCH.s1) / 2, (PORCH.v0 - 2.6 + PORCH.v1) / 2);
    world.addSolids([{ x: px, z: pz, yaw: F.YAW, hx: (PORCH.s1 - PORCH.s0) / 2 + 0.3, hz: (PORCH.v1 - PORCH.v0 + 2.6) / 2 }]);
    world.addSolids([{ x: TOWER.x, z: TOWER.z, yaw: 0, hx: 4.6, hz: 4.6 }]); }

  function* build() {
    const houses = HOUSES.map(([name, S, base, at0, r]) => ({ name, sec: S[0], base, at: at0, r, spec: { wall: [200, 200, 200], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: (P, W) => PAINT[name](P, W) }] }));
    skinHouses(world, group, houses, { shadows, ppm: 12, far: 5, faces: (W) => W.len > 4 && W.ylo - W.yref < 2, label: 'vaksali fronts' });
    yield;
    const A = areaKit(world, group, { shadows });
    const { p } = A;
    const trim = 0xf1efe8, roofGrey = 0xb7bdc2;

    // ---- the chimneys: red brick with a grey cap
    for (const [x, z, y] of CHIMNEYS) { p.box(0.75, 2.0, 0.6, 0x9a4a36, x, y + 0.4, z, F.YAW); p.box(0.95, 0.14, 0.8, 0x7d7f82, x, y + 1.45, z, F.YAW); }
    yield;

    // ---- the porch: a stone floor up the steps, white posts, the hipped roof over a white fascia
    { const g = Math.min(h(...P2(PORCH.s0, PORCH.v0)), h(...P2(PORCH.s1, PORCH.v0)));
      const floor = 0.9, sm = (PORCH.s0 + PORCH.s1) / 2, ls = PORCH.s1 - PORCH.s0;
      A.box(F, sm, (PORCH.v0 + PORCH.v1) / 2, ls, PORCH.v1 - PORCH.v0, -0.4, floor, 0x9d978e, g);
      for (let k = 0; k < 5; k++) { const d = (k + 1) * 0.5; A.box(F, sm, PORCH.v0 - d + 0.25, ls + 0.6, 0.5, -0.4, floor - (k + 1) * 0.18, 0x8f8a82, g); }
      for (const s of [PORCH.s0 + 0.4, PORCH.s0 + 3.6, PORCH.s1 - 3.6, PORCH.s1 - 0.4]) for (const v of [PORCH.v0 + 0.35, PORCH.v1 - 0.6]) A.box(F, s, v, 0.28, 0.28, floor, PORCH.eaves - g, trim, g);
      const [x, z] = P2(sm, (PORCH.v0 + PORCH.v1) / 2);
      p.box(ls + 0.6, 0.4, PORCH.v1 - PORCH.v0 + 0.6, trim, x, PORCH.eaves + 0.2, z, F.YAW);
      p.add(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).scale(ls + 1.0, PORCH.roof - PORCH.eaves - 0.4, PORCH.v1 - PORCH.v0 + 1.0), roofGrey, x, PORCH.eaves + 0.4 + (PORCH.roof - PORCH.eaves - 0.4) / 2, z, F.YAW); }
    yield;

    // ---- the canopy along the platform side: a thin grey roof on dark posts with brackets
    { const C = CANOPY, sm = (C.s0 + C.s1) / 2;
      const [x, z] = P2(sm, (C.v0 + C.v1) / 2);
      p.box(C.s1 - C.s0, 0.22, C.v1 - C.v0, roofGrey, x, C.y - 0.11, z, F.YAW);
      { const [fx, fz] = P2(sm, C.v1 - 0.05); p.box(C.s1 - C.s0, 0.35, 0.1, trim, fx, C.y - 0.3, fz, F.YAW); }
      for (let s = C.s0 + 1.5; s < C.s1 - 1; s += 5.8) {
        const [px, pz] = P2(s, C.v1 - 0.55), g = h(px, pz);
        p.box(0.16, C.y - 0.22 - g, 0.16, 0x3f4744, px, (g + C.y - 0.22) / 2, pz, F.YAW);
        A.box(F, s, C.v1 - 1.15, 0.08, 1.2, C.y - 0.62 - g, C.y - 0.3 - g, 0x3f4744, g);
      }
      A.pave(F, C.s0, C.s1, 0.6, C.v1 + 0.2, 'slabs'); }
    yield;

    // ---- the island platform and its long glazed shelter
    { const I = ISLAND, sm = (I.s0 + I.s1) / 2, ls = I.s1 - I.s0;
      let g = 1e9; for (let s = I.s0; s <= I.s1; s += 26) g = Math.min(g, h(...P2(s, (I.v0 + I.v1) / 2)));
      A.box(F, sm, (I.v0 + I.v1) / 2, ls, I.v1 - I.v0, -0.6, 0.55, 0xa6a39d, g);
      for (const v of [I.v0 + 0.25, I.v1 - 0.25]) A.box(F, sm, v, ls, 0.3, 0.55, 0.57, 0xe8e0a6, g);
      const top = I.y - 0.5, base = g + 0.55;
      const glass = paintTexture(3, 0, top - base, 12, (P) => {
        P.r(0, 0, 3, top - base, '#cfd3d6');
        P.grad(0.08, 0.9, 2.92, top - base - 0.25, '#55646f', '#28323a');
        P.r(1.46, 0.9, 1.54, top - base - 0.25, '#cfd3d6');
        P.r(0, 0, 3, 0.9, '#7e8489');
      }, { repeat: true });
      glass.repeat.set(ls / 3, 1);
      const side = new THREE.MeshLambertMaterial({ map: glass }), end = new THREE.MeshLambertMaterial({ color: 0xa9b0b5 });
      const [x, z] = P2(sm, (I.sv0 + I.sv1) / 2);
      const m = new THREE.Mesh(new THREE.BoxGeometry(ls - 2, top - base, I.sv1 - I.sv0), [end, end, end, end, side, side]);
      m.position.set(x, (top + base) / 2, z); m.rotation.y = F.YAW; m.castShadow = shadows; m.receiveShadow = true; m.updateMatrix();
      group.add(m);
      p.box(ls, 0.3, I.sv1 - I.sv0 + 1.4, 0xaeb7c0, x, I.y - 0.35, z, F.YAW);
      p.add(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).scale(ls, 0.45, I.sv1 - I.sv0 + 1.4), 0xaeb7c0, x, I.y - 0.2 + 0.22, z, F.YAW); }
    yield 'frame';

    // ---- the water tower: a stone foot, the brick shaft, the wider top with its windows, the cornice, the roof
    { const T = TOWER, g = h(T.x, T.z) - 0.4, ring = 2 * Math.PI * 5;
      const brick = paintTexture(4, 0, 4, 14, (P) => P.brick(0, 0, 4, 4, [128, 60, 46], 3), { repeat: true });
      brick.wrapT = THREE.RepeatWrapping; brick.repeat.set(ring / 4, (T.top - 8 - g) / 4);
      const shaftH = T.top - 7.5 - (g + 2.4);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(4.7, 4.95, shaftH, 28, 1, true), new THREE.MeshLambertMaterial({ map: brick }));
      shaft.position.set(T.x, g + 2.4 + shaftH / 2, T.z); shaft.castShadow = shadows; shaft.updateMatrix(); group.add(shaft);
      const band = paintTexture(3.3, 0, 6.5, 14, (P) => {
        P.brick(0, 0, 3.3, 6.5, [122, 57, 44], 5);
        P.r(0, 5.6, 3.3, 5.8, '#6c3326');
        P.win(1.15, 3.2, 2.15, 4.6, { frame: '#d8d2c6', glass: '#2a2f35', fw: 0.08, bars: 1, sill: 0.06, sc: '#d8d2c6' });
        P.r(0, 0, 3.3, 0.35, '#6c3326');
      }, { repeat: true });
      band.repeat.set(10, 1);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(5.25, 5.25, 6.5, 28, 1, true), new THREE.MeshLambertMaterial({ map: band }));
      drum.position.set(T.x, T.top - 0.5 - 3.25, T.z); drum.castShadow = shadows; drum.updateMatrix(); group.add(drum);
      p.add(new THREE.CylinderGeometry(5.3, 5.35, 2.4, 28), 0x8a8680, T.x, g + 1.2, T.z);                 // the stone foot
      p.add(new THREE.CylinderGeometry(5.25, 4.7, 1.0, 28), 0x7a392b, T.x, T.top - 7.5, T.z);              // the corbels under the top
      p.add(new THREE.CylinderGeometry(5.6, 5.3, 0.55, 28), 0x6f3528, T.x, T.top - 0.3, T.z);               // the cornice
      p.add(new THREE.ConeGeometry(5.65, T.peak - T.top + 0.8, 28), 0x6c564a, T.x, T.top + (T.peak - T.top + 0.8) / 2 - 0.02, T.z);
      p.box(0.3, 2.3, 1.4, 0x4a3328, T.x - 5.2, g + 2.4 + 1.15, T.z); }                                    // the door on the street side
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      // (within 380 m: the race lap passes 470 m away on Kuperjanovi, and the station is hidden from there)
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 380) return;
      if (![[533, 3590], [480, 3567], [660, 3700], [586, 3622], [506, 3534]].every((q) => world.ready(q[0], q[1]))) return;
      built = true;
      jobs.add(build, 'vaksali');
    },
  };
}
