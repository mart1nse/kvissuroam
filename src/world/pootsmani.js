// Pootsmani tänav, the west arm of the loop south of Kvissentali tee, detailed from Street View (July 2024),
// the Land Board's 2024 oblique photo and the orthophoto: mown verges, block-paved drives and parking
// strips, mesh panel fences, the houses in their own colours with the fronts that face the street,
// thujas, shrubs, lamp posts, bins and cable cabinets.
// Distances below are in the road frame: t = map z along the street (north to south), lat = metres
// sideways from the centre line, + east, - west.
import * as THREE from 'three';
import { roadFrame, wallOf, streetKit, addHouseColours, KIT } from './streetkit.js';

const ROAD = [[-287.6, 30.8], [-289.2, 62.1], [-286.9, 94.8], [-285.3, 106.4], [-276.8, 146.1], [-269.7, 168.2], [-265.9, 177.9], [-255.4, 201.2]];
const F = roadFrame(ROAD, 1);
const EDGE = 2.8, FENCE_E = 5.6, FENCE_W = -6.3;
const CENTRE = [-283, 115];

// paving: [t0, t1, lat0, lat1, kind]
const PAVED = [
  [41, 62, EDGE, FENCE_E - 0.2, 'paver'],          // parking strip by the east fence
  [62, 79, -EDGE, FENCE_W, 'paver'],               // in front of the white brick house's gate
  [68.5, 78.5, FENCE_W, -12.6, 'paver'],           // ... and its drive to the garage
  [77.5, 91, EDGE, 11.5, 'paver'],                 // east: apron of the house opposite
  [91, 101, EDGE, 5.4, 'paver'],
  [101, 108, EDGE, 9, 'red'],                      // red drive on the east side
  [94.5, 112, -EDGE, FENCE_W, 'paver'],            // along the brick-post fence
  [94.5, 100.5, FENCE_W, -16, 'paver'],
  [123, 135, -EDGE, FENCE_W, 'paver'],             // the yellow house: drive to the carport
  [124, 134.5, FENCE_W, -19, 'paver'],
  [136.5, 145, EDGE, 14, 'paver'],                 // the white house with the sun panels
  [155, 167, -EDGE, -13, 'paver'],
  [175, 180, EDGE, 9.5, 'paver'],
  [182, 190, -EDGE, -13, 'red'],
];
// fence gaps (drives) by side
const GAPS_E = [[77.5, 91], [101, 108], [136.5, 145], [175, 180]];
const GAPS_W = [[94.5, 100.5], [124, 134.5], [155, 167], [167, 182], [182, 190]];   // 167-182: no fence at the mouth of the footpath (Martin, 18 Nov)
const LAMPS = [58, 96, 127.5, 166, 198];           // east verge
const LIGHT = 0;

// the houses: LOD2 base height (cm), a point inside, wall and roof colours (pastel takes on the real ones)
const HOUSES = [
  { base: 55, x: -305.5, z: 79, wall: 0xf1eee8, roof: 0xc9ccd6 },      // white brick, pale metal roof
  { base: 55, x: -307, z: 49, wall: 0xe9e2d2, roof: 0xb4b6c4 },
  { base: 48, x: -305.7, z: 109.5, wall: 0xf0e6cf, roof: 0xa9796c },   // cream, brown tiles
  { base: 39, x: -300.7, z: 139.2, wall: 0xf2ead2, roof: 0x7d8090 },   // cream and yellow boards, grey roof
  { base: 2, x: -286.5, z: 167.7, wall: 0xefece6, roof: 0xb9bfcc },
  { base: -18, x: -278.2, z: 196.3, wall: 0xf1eee8, roof: 0x5b5c6c },
  { base: 43, x: -268.6, z: 79.8, wall: 0xf0e6cf, roof: 0xa9796c },
  { base: 33, x: -262.7, z: 106.2, wall: 0xf3f0ea, roof: 0x9c7468 },
  { base: 24, x: -258.2, z: 140.6, wall: 0xf3f1ee, roof: 0x9aa0b2 },   // white, grey band, sun panels
  { base: 28, x: -246.3, z: 175.2, wall: 0xf0e6cf, roof: 0xa9796c },
  { base: 62, x: -265.1, z: 44.9, wall: 0xefe9dc, roof: 0x8f8a8c },
];
const COL = {
  brick: 0xf1eee8, cream: 0xf2ead2, yellow: 0xf0cf86, wood: 0xdcae7a, band: 0xa9adba, door: 0xd9dbe2, garage: 0xfaf9f6,
  rail: 0xe6e6ea, recess: 0x8e8fa0, post: 0xe9dfc6, bin: 0x5f9a68, binDark: 0x4c5060, cabinet: 0xbfc2cb, panel: 0x3b4a78,
};

export function pootsmaniWalls(walls) {
  addHouseColours(walls, '0_1', -800, -160, HOUSES.map((e) => ({ ...e, reach: 17 })));
}
export function pootsmaniProps() {
  return LAMPS.map((t) => [LIGHT, ...F.at(t, 3.5), (Math.atan2(-F.dir(t)[1], -F.dir(t)[0]) * 180) / Math.PI]);
}

export function createPootsmani(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function build() {
    built = true;
    const K = streetKit(world, group, { shadows });
    const wall = (a, b, top) => { const W = wallOf(a, b, top); W.y = Math.min(K.h(...W.at(0, 0.6)), K.h(...W.at(W.len, 0.6))); return W; };

    // ---- ground: verges of mown grass, cut by the paved drives and strips
    const cut = (t0, t1, gaps) => {
      const out = [];
      let t = t0;
      for (const [a, b] of gaps) { if (a > t) out.push([t, Math.min(a, t1)]); t = Math.max(t, b); }
      if (t < t1) out.push([t, t1]);
      return out;
    };
    const pavedOn = (side) => PAVED.filter((q) => Math.sign(q[2] + q[3]) === side && Math.abs(q[2]) === EDGE).map((q) => [q[0], q[1]]).sort((a, b) => a[0] - b[0]);
    for (const [a, b] of cut(36, 200, pavedOn(1))) K.ribbon(F, a, b, EDGE - 0.15, FENCE_E + 0.6, 'lawn');
    for (const [a, b] of cut(40, 200, pavedOn(-1))) K.ribbon(F, a, b, -EDGE + 0.15, FENCE_W - 0.6, 'lawn');
    K.ribbon(F, 135, 147, FENCE_W - 0.6, -11, 'lawn');                  // front lawn of the yellow house
    K.ribbon(F, 145, 153, FENCE_E + 0.6, 13, 'lawn');
    for (const [t0, t1, l0, l1, kind] of PAVED) K.ribbon(F, t0, t1, l0, l1, kind);

    // ---- fences: mesh panels on both sides, open at the drives; gates stand half open
    for (const [a, b] of cut(60, 200, GAPS_E)) K.fence(F, a, b, FENCE_E);
    for (const [a, b] of cut(42, 200, GAPS_W)) K.fence(F, a, b, FENCE_W);
    K.panel(F.at(136.5, FENCE_E), F.at(138.2, FENCE_E + 3.4)); K.panel(F.at(145, FENCE_E), F.at(143.3, FENCE_E + 3.4));
    K.panel(F.at(124, FENCE_W), F.at(127.6, FENCE_W - 0.5)); K.panel(F.at(134.5, FENCE_W), F.at(130.9, FENCE_W - 0.5));
    // cream brick posts along the fence of the brown-roofed house, half lost in shrubs
    for (let t = 101; t <= 121.5; t += 3.4) { const q = F.at(t, FENCE_W); K.box(q[0], q[1], 0.5, 1.35, 0.5, COL.post); K.box(q[0], q[1], 0.6, 0.08, 0.6, KIT.post, 0, 1.35); }
    for (let k = 0; k < 15; k++) {
      const q = F.at(101.5 + k * 1.4, -7.1 - (k % 3) * 0.45), r = 0.85 + ((k * 7) % 5) * 0.12;
      K.shrub(q[0], q[1], r, KIT.shrub[k % 3], 1.05);
    }
    for (const [t, lat] of [[176, FENCE_E], [179.6, FENCE_E]]) { const q = F.at(t, lat); K.box(q[0], q[1], 0.5, 1.5, 0.5, 0xd9a58e); }

    // ---- the white brick house (west, north end): garage with a balcony over it, wide upper windows
    {
      const W = wall([-300.1, 87.95], [-301.25, 69.3], 6.45), top = W.top - W.y;
      K.face(W, COL.brick);
      for (let y = 0.5; y < top; y += 0.5) K.slab(W, 0, W.len, y, y + 0.02, 0.115, 0.01, 0xdedbd6);       // brick courses
      K.win(W, 1.6, 4.4, 3.4, 4.5, { bars: 1, frame: COL.band }); K.win(W, 6.2, 11.6, 3.4, 4.5, { bars: 2, frame: COL.band });
      K.win(W, 2.2, 4.2, 1.2, 2.1, { frame: COL.band }); K.win(W, 9.6, 11.6, 1.2, 2.1, { frame: COL.band });
      K.slab(W, 6.6, 7.6, 0.1, 2.25, 0.12, 0.06, COL.door); K.slab(W, 6.2, 8.0, 2.4, 2.5, 0.12, 0.9, COL.rail);          // door, canopy
      K.slab(W, 13.6, W.len - 0.3, 3.0, top - 0.25, 0.12, 0.05, COL.recess);                                        // the balcony recess
      K.slab(W, 13.4, W.len, 2.95, 3.95, 0.2, 0.06, COL.rail);                                                       // its parapet
      K.slab(W, 14.2, 17.9, 0.1, 2.5, 0.12, 0.06, COL.garage);
      for (let y = 0.7; y < 2.5; y += 0.6) K.slab(W, 14.2, 17.9, y, y + 0.03, 0.18, 0.01, 0xd8d8de);
      K.slab(W, -0.3, W.len + 0.3, top - 0.12, top + 0.05, 0.1, 0.5, 0xd4d6de);                                        // eaves
      for (const [t, lat, hgt, r, c] of [[66.2, -8.6, 3.6, 0.7, 0], [67.6, -8.7, 3.9, 0.75, 1], [64.3, -8.2, 1.9, 0.8, 2]]) { const q = F.at(t, lat); K.thuja(q[0], q[1], hgt, r, c); }
    }
    // ---- the cream house with brown tiles (west): plain windows behind the shrubs
    {
      const W = wall([-295.65, 119.65], [-298.15, 104.1], 5.8);
      K.face(W, COL.cream);
      for (const s of [1.6, 6.4, 11.4]) K.win(W, s, s + 1.8, 1.0, 2.3, { bars: 1, frame: KIT.white });
      for (const s of [3.0, 9.6]) K.win(W, s, s + 1.6, 3.6, 4.7, { bars: 1, frame: KIT.white });
    }
    // ---- the cream and yellow house (west): tall stair glazing, wood panels, yellow boards on the gable
    {
      const W = wall([-289.55, 146.05], [-292.1, 135.85], 6.5), top = W.top - W.y;
      K.face(W, COL.cream);
      K.win(W, 2.6, 4.9, 0.9, 5.3, { rails: 3, frame: KIT.white, glass: 0xc3dcda, fw: 0.1 });                 // four panes high
      K.slab(W, 6.2, 7.0, 3.5, 4.8, 0.12, 0.05, COL.wood); K.win(W, 7.1, 9.2, 3.5, 4.8, { bars: 1, frame: KIT.white });
      K.win(W, 6.4, 8.6, 1.25, 2.45, { bars: 1, frame: KIT.white }); K.slab(W, 6.3, 8.7, 0.45, 1.1, 0.12, 0.05, COL.wood);
      K.slab(W, 9.5, 10.4, 0.1, 2.3, 0.12, 0.06, COL.door);
      K.slab(W, -0.3, W.len + 0.3, top - 0.1, top + 0.06, 0.1, 0.55, COL.wood);                                // eaves board
      const N = wall([-292.7, 133.35], [-298.5, 134.8], 6.0);
      K.face(N, COL.cream); K.slab(N, 0, N.len, 3.2, 5.6, 0.12, 0.05, COL.yellow);
      for (let s = 0.25; s < N.len; s += 0.25) K.slab(N, s, s + 0.02, 3.2, 5.6, 0.17, 0.01, 0xdcb86c);
      K.win(N, 2.0, 3.6, 3.7, 4.8, { bars: 1, frame: KIT.white }); K.slab(N, 1.2, 2.2, 0.1, 2.25, 0.12, 0.06, COL.wood);
      // hydrangeas and clipped balls under the front, a small tree by the drive
      for (const [t, lat, r, hex] of [[137.5, -9.4, 0.75, KIT.bloom], [139.2, -9.0, 0.9, KIT.bloom], [141, -9.3, 0.8, 0xdfead8], [143, -9.6, 0.7, KIT.shrub[1]], [136, -8.4, 0.6, KIT.thuja[1]], [144.6, -9.9, 0.65, KIT.thuja[0]]]) {
        const q = F.at(t, lat); K.shrub(q[0], q[1], r, hex);
      }
      const q = F.at(121.6, -8.1); K.box(q[0], q[1], 0.12, 1.6, 0.12, 0x7a6a66); K.shrub(q[0], q[1], 1.25, KIT.shrub[0], 2.1);
    }
    // ---- the white house with the grey band and sun panels (east)
    for (const [a, b, top, wins] of [
      [[-262.9, 144.05], [-260.4, 152.7], 5.35, [[1.2, 2.8, 1.1, 2.2], [5.0, 7.6, 1.1, 2.2], [1.6, 3.0, 3.6, 4.5]]],
      [[-264.75, 134.8], [-262.15, 143.8], 4.25, [[1.0, 2.4, 1.3, 2.0], [6.4, 8.4, 1.0, 2.2]]],
    ]) {
      const W = wall(a, b, top), y1 = W.top - W.y;
      K.face(W, KIT.white);
      K.slab(W, 0, W.len, 2.45, 3.05, 0.12, 0.04, COL.band);
      for (const [s0, s1, y0, y1w] of wins) K.win(W, s0, s1, y0, y1w, { frame: KIT.white, bars: s1 - s0 > 1.8 ? 1 : 0 });
      K.slab(W, -0.2, W.len + 0.2, y1 - 0.1, y1 + 0.06, 0.1, 0.45, COL.band);
    }
    { const W = wall([-264.75, 134.8], [-262.15, 143.8], 4.25); K.slab(W, 3.6, 4.6, 0.1, 2.2, 0.12, 0.06, COL.band); }
    for (const [t, lat, hgt, r, c] of [[127.2, 7.6, 4.6, 1.1, 0], [129.6, 7.9, 5.0, 1.2, 1], [132.1, 7.7, 4.4, 1.05, 2]]) { const q = F.at(t, lat); K.thuja(q[0], q[1], hgt, r, c); }

    // ---- street furniture: wheelie bins, cable cabinets
    const yawAt = (t) => Math.atan2(-F.dir(t)[1], F.dir(t)[0]);
    for (const [t, lat, hex] of [[136, 4.6, COL.bin], [122.6, -5.3, COL.binDark], [92.5, -4.9, COL.bin], [174.3, 4.7, COL.binDark]]) {
      const q = F.at(t, lat);
      K.box(q[0], q[1], 0.58, 0.92, 0.55, hex, yawAt(t)); K.box(q[0], q[1], 0.64, 0.08, 0.62, hex, yawAt(t), 0.92);
    }
    for (const [t, lat] of [[126.2, 4.5], [120.8, -4.4], [60.5, 4.8]]) { const q = F.at(t, lat); K.box(q[0], q[1], 0.72, 1.15, 0.36, COL.cabinet, yawAt(t)); K.box(q[0], q[1], 0.78, 0.06, 0.42, 0x9da1ad, yawAt(t), 1.15); }
    K.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 500) return;
      if (ROAD.every((q) => world.ready(q[0], q[1])) && world.ready(-305, 110) && world.ready(-258, 140)) build();
    },
  };
}
