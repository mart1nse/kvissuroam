// Kaardista "ERM and the Raadi manor park" (Martin, 23 Nov 2026), batch 2: the Kaupmehe flats and the Coop as
// they are seen from road 95 (Kõrveküla-Tartu) and from the north end of the Raadi rally stage, from his Street
// View shots along road 95 (June 2023, June and July 2024) and the Land Board's oblique air photos of April 2024.
//  - the new row between Kaupmehe tänav and road 95 (the even numbers 4 to 16): five-storey blocks, white with a
//    second cladding on part of each (salmon brick on 4, warm grey brick on 6, orange-brown panels on 8, pale
//    wood on 10 and 12, beige on 14, teal on 16), dark balconies with glass rails on the sides to the road and
//    the stage, flat roofs; Kaupmehe 12 is newer than the map's houses and is built here as two blocks;
//  - Kaupmehe 1 and 3 (white, dark window bands) and the Coop Konsum at Kaupmehe 2: charcoal, "coop | Konsum
//    9-22" over the car park, the blue panel at its road end;
//  - the older row behind (Kaupmehe 7 to 15, three storeys): cream walls and grey roofs only.
// Only the sides to the road and the stage are painted at the fronts' resolution; backs are seen from afar only.
// No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { still } from '../still.js';
import { jobs } from '../jobs.js';

const DEBUG = typeof location !== 'undefined' && /kaupdebug/.test(location.search);
const S51 = ['5_1', 2400, -160], S41 = ['4_1', 1760, -160];
const SANS = '700 %px Arial, sans-serif';
// towards road 95 and the stage: the row's long sides face (0.88, 0.48)
const ROAD = [0.88, 0.48];

// [name, sector, base, at, reach, painter options]
const HOUSES = [
  ['k4', S51, 2284, [2477, 206], 30, { second: '#c08a72', brick: true, side: 'right' }],
  ['k6', S51, 2200, [2510, 151], 28, { second: '#a69486', brick: true, side: 'right' }],
  ['k8', S51, 2306, [2538, 108], 28, { second: '#b5703e', side: 'left' }],
  ['k10', S51, 2187, [2581, 42], 26, { second: '#d6b27c', side: 'mid' }],
  ['k14', S51, 2173, [2627, -71], 30, { second: '#d9c9a8', side: 'left' }],
  ['k16', S51, 2091, [2654, -115], 26, { second: '#4f9893', side: 'mid' }],
  ['k1', S41, 2212, [2380, 327], 28, { second: '#3e4146', bands: true }],
  ['k3', S41, 2109, [2358, 238], 36, { second: '#3e4146', bands: true }],
  ['coop', S51, 2192, [2434, 284], 36, null],
];
// the older row: cream, grey roofs
const OLD = [[2108, 2442, 114], [2132, 2465, 55], [2104, 2500, 0], [2099, 2528, -49], [2071, 2553, -101]];

export function kaupmeheWalls(walls) {
  setHouseColours(walls, S51[0], S51[1], S51[2], [
    ...HOUSES.filter((H) => H[1] === S51).map(([n, , base, at, reach]) => ({ base, x: at[0], z: at[1], wall: n === 'coop' ? 0x3a3d43 : 0xf1f1ed, roof: 0x5a5d63, reach })),
    ...OLD.map(([base, x, z]) => ({ base, x, z, wall: 0xece3cc, roof: 0x56595f, reach: 24 })),
  ]);
  setHouseColours(walls, S41[0], S41[1], S41[2], HOUSES.filter((H) => H[1] === S41).map(([, , base, at, reach]) => ({ base, x: at[0], z: at[1], wall: 0xf1f1ed, roof: 0x5a5d63, reach })));
}

// the map's two box signs on the Coop: its name is painted on the wall instead
export function kaupmeheSignSkip(world) {
  const prev = world.signSkip;
  world.signSkip = (x, z) => Math.hypot(x - 2431, z - 281) < 30 || (prev ? prev(x, z) : false);
}

// does a wall face road 95 or the stage (south)?
const toRoad = (W) => W.nx * ROAD[0] + W.nz * ROAD[1] > 0.4 || W.nz > 0.75;

// ---------------------------------------------------------------- the painters
const glassWin = { frame: '#2c2e33', glass: '#4d5c6b', fw: 0.06, bars: 0, T: false, sill: 0.04, surround: 0 };
// a five-storey block: white, the second cladding over part of the wall, windows, and on the sides to the road
// and the stage stacks of balconies (dark slab edges, glass rails, the dark doors behind)
function flats(P, W, o) {
  const len = W.len, top = W.peak, base = '#f1f1ed';
  P.r(0, P.y0, len, P.y1, base);
  if (W.foot > 1.6 || top < 3) { P.r(0, P.y0, len, P.y1, '#e4e4df'); return; }       // the roof's stair houses
  const a = o.side === 'right' ? len * 0.55 : o.side === 'left' ? 0 : len * 0.3, b = o.side === 'right' ? len : o.side === 'left' ? len * 0.45 : len * 0.7;
  if (len > 8) {
    if (o.brick) P.brick(a, 0.6, b, top, hexRgb(o.second), len * 7 | 0); else P.r(a, 0.6, b, top, o.second);
    if (o.bands) for (let x = 1.4; x < len - 1; x += 3.2) P.r(x, 0.6, x + 1.0, top - 0.4, o.second);      // dark window bands up the wall
  }
  P.r(0, P.y0, len, 0.6, '#6c6e73');
  P.r(0, top - 0.25, len, top, '#d9d9d4');                                                     // the parapet's flashing
  const front = o.bay || (toRoad(W) && len > 9);
  for (let y = 0.9, k = 0; y + 1.8 < top - 0.3; y += 3.0, k++) {
    if (front) {
      // balconies in pairs of bays 6 m wide; between them a narrow window
      for (let x = 0.8; x + 4.4 < len - 0.4; x += 6.2) {
        P.r(x, y - 0.05, x + 4.4, y + 2.4, '#3a3c41');                                          // the recess, dark
        P.grad(x + 0.4, y + 0.1, x + 1.6, y + 2.25, '#5d6c7a', '#36404a');                       // the door
        P.grad(x + 2.0, y + 0.6, x + 4.0, y + 2.25, '#5d6c7a', '#36404a');                       // the window
        P.r(x - 0.1, y - 0.15, x + 4.5, y + 0.05, '#2b2d31');                                    // the slab's edge
        P.r(x, y + 0.05, x + 4.4, y + 1.05, 'rgba(170,190,200,0.55)');                          // the glass rail
        P.r(x, y + 1.02, x + 4.4, y + 1.08, '#2b2d31');
        if (x + 6.2 < len - 1.6) P.win(x + 5.0, y + 0.5, x + 5.8, y + 2.2, glassWin);
      }
    } else {
      for (let x = 1.0; x + 1.3 < len - 0.6; x += 2.8) P.win(x, y + 0.5, x + 1.3, y + 2.1, glassWin);
    }
  }
}
function coop(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#3a3d43');
  for (let x = 0.6; x < len; x += 1.2) P.r(x, P.y0, x + 0.03, top, '#44474e');                 // the cladding's joints
  P.r(0, P.y0, len, 0.5, '#55575c');
  if (len < 20) return;
  if (W.nx > 0.4 && W.nz < -0.6) {                                   // over the car park: the name, the doors
    P.r(len * 0.08, top - 2.6, len * 0.08 + 6.6, top - 0.8, '#3a3d43');
    P.text('coop', len * 0.08 + 2.4, top - 1.7, 1.5, '#f4f4f0', '800 %px Arial, sans-serif');
    P.r(len * 0.08 + 4.8, top - 2.4, len * 0.08 + 4.86, top - 1.0, '#f4f4f0');
    P.text('Konsum', len * 0.08 + 5.0, top - 1.7, 0.55, '#f4f4f0', SANS, 'left');
    P.text('9-22', len * 0.45, top - 1.7, 1.3, '#f4f4f0', SANS);
    P.r(len * 0.86, 0.5, len - 0.4, top - 0.6, '#1f5fae');                                     // the blue panel
    P.text('HOIAME', len * 0.93 - 0.2, top - 2.0, 0.42, '#ffffff', SANS);
    P.text('KOKKU', len * 0.93 - 0.2, top - 2.6, 0.42, '#ffffff', SANS);
    P.r(len * 0.05, 0.1, len * 0.05 + 4.2, 3.0, '#24272b');                                     // the glass doors
    P.grad(len * 0.05 + 0.1, 0.15, len * 0.05 + 4.1, 2.9, '#7f94a5', '#3f4e5b');
    P.r(len * 0.05 + 2.08, 0.15, len * 0.05 + 2.14, 2.9, '#24272b');
  }
}
const PAINT = { coop };
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }

// Kaupmehe 12: newer than the map's houses. Two blocks off its outline (s along (0.4755, -0.8797), v towards
// the road), 15.4 m high like 10, its twin.
const K12 = frame([2587.31, -3.70], [0.4755, -0.8797]);
const K12_BOXES = [[0, 20, 2.7, 20.1], [19.6, 35.6, 0, 16.5]];
const K12_H = 15.4;
const CENTRE = [2530, 120];

export function createKaupmehe(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  let built = false;
  // Kaupmehe 12 stops cars from the start, as the map's houses do
  world.addSolids(K12_BOXES.map(([s0, s1, v0, v1]) => { const [x, z] = K12.at((s0 + s1) / 2, (v0 + v1) / 2); return { x, z, yaw: K12.YAW, hx: (s1 - s0) / 2, hz: (v1 - v0) / 2 }; }));

  // (in steps, see ../jobs.js: each `yield` is a place to stop until the next frame)
  function* build() {
    const houses = HOUSES.map(([name, S, base, at, r, o]) => ({ name, sec: S[0], base, at, r, spec: { wall: [241, 241, 237], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: (P, W) => (o ? flats(P, W, o) : PAINT[name](P, W)) }] }));
    // (the fronts to the road and the stage at the track's 18 pixels a metre; the backs from afar only)
    skinHouses(world, group, houses, { label: 'kaupmehe fronts', shadows, ppm: 18, far: 4, faces: (W) => W.len > 5 && W.foot < 1.6 && (toRoad(W) || (W.nx > 0.4 && W.nz < -0.6 && Math.hypot(W.mid[0] - 2434, W.mid[1] - 284) < 30)), debug: DEBUG });
    yield;

    // ---- Kaupmehe 12: one bay of 6.2 m painted and repeated round both blocks
    const W = { len: 6.2, peak: K12_H, foot: 0, nx: ROAD[0], nz: ROAD[1] };
    const bay = paintTexture(6.2, 0, K12_H, 14, (P) => flats(P, W, { second: '#d6b27c', side: 'none', bay: true }), { repeat: true });
    yield;
    const pos = [], uv = [], nor = [], g = world.heightAt(...K12.at(18, -10)) - 0.3;
    for (const [s0, s1, v0, v1] of K12_BOXES) {
      const c = [[s0, v0], [s1, v0], [s1, v1], [s0, v1]];
      for (let k = 0; k < 4; k++) {
        const [as, av] = c[k], [bs, bv] = c[(k + 1) % 4];
        const [ax, az] = K12.at(as, av), [bx, bz] = K12.at(bs, bv), len = Math.hypot(bx - ax, bz - az);
        let nx = bz - az, nz = -(bx - ax); const nl = Math.hypot(nx, nz); nx /= nl; nz /= nl;
        const cx = (ax + bx) / 2 - K12.at((s0 + s1) / 2, (v0 + v1) / 2)[0], cz = (az + bz) / 2 - K12.at((s0 + s1) / 2, (v0 + v1) / 2)[1];
        if (nx * cx + nz * cz < 0) { nx = -nx; nz = -nz; }
        const u1 = len / 6.2, top = g + K12_H + 0.3;
        const V = [[ax, g, az, 0, 0], [bx, g, bz, u1, 0], [bx, top, bz, u1, 1], [ax, top, az, 0, 1]];
        for (const q of [0, 1, 2, 0, 2, 3]) { pos.push(V[q][0], V[q][1], V[q][2]); uv.push(V[q][3], V[q][4]); nor.push(nx, 0, nz); }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: bay, side: THREE.DoubleSide }));
    m.castShadow = shadows; m.receiveShadow = shadows; group.add(m);
    const A = areaKit(world, group, { shadows });
    for (const [s0, s1, v0, v1] of K12_BOXES) {
      A.box(K12, (s0 + s1) / 2, (v0 + v1) / 2, s1 - s0, v1 - v0, K12_H + 0.25, K12_H + 0.4, 0x5a5d63, g + 0.05);
      A.box(K12, (s0 + s1) / 2, (v0 + v1) / 2, (s1 - s0) * 0.3, (v1 - v0) * 0.3, K12_H + 0.4, K12_H + 2.6, 0xe4e4df, g + 0.05);   // the stair house
    }
    yield;
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 700) return;
      if ([[2477, 206], [2581, 42], [2654, -115], [2380, 327], [2434, 284]].every((q) => world.ready(q[0], q[1]))) { built = true; jobs.add(build, 'kaupmehe'); }
    },
  };
}
