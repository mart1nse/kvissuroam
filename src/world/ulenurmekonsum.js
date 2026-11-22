// Kaardista "Tartu Airport at Ülenurme" (Martin, 22 Nov), batch 4: Coop Ülenurme Konsum (Võru mnt 2) and the
// red house beside it (Võru mnt 4), from his Street View shots of June 2023 and the Land Board's orthophoto.
//  - the shop: the map's own block painted. The front to Võru mnt in white panels over the yellow band, the
//    dark ribbon of windows, "coop | Konsum" in blue, the hours 9-22, the shop windows with the GasUp posters;
//    the other sides in the same panels and band, a back door and the loading door;
//  - the entrance at the north end built by hand: red brick piers, glass doors, the yellow fascia with the BENU
//    Apteek sign and the blue round signs, and over it the yellow steel frame box with its pale panels;
//  - the car park before the front in concrete pavers, the bench, the cars in it;
//  - Võru mnt 4: red walls, white windows, a brown roof.
// No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours, addHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { still } from '../still.js';
import { jobs } from '../jobs.js';

const DEBUG = typeof location !== 'undefined' && /ukdebug/.test(location.search);
const S16 = ['3_16', 1120, 9440], S17 = ['3_17', 1120, 10080];
const SANS = '700 %px Arial, sans-serif';
const HOUSES = [
  ['coop', S16, 1944, [1696, 10082], 30, 0xf2f2f0, 0x8c8f94],
  ['red', S17, 1940, [1695, 10117], 12, 0xb3312e, 0x6b4a3a],
];

export function ulenurmeKonsumWalls(walls) {
  for (const S of [S16, S17]) setHouseColours(walls, S[0], S[1], S[2], HOUSES.filter((H) => H[1] === S).map(([, , base, at, reach, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach })));
  // the map's slab over the entrance: the porch is built by hand
  addHouseColours(walls, S16[0], S16[1], S16[2], [{ base: 2333, x: 1681.6, z: 10070, hide: true, reach: 9 }]);
}

// the front to Võru mnt, from its north corner to its south corner; v > 0 is out in front
const FRONT = frame([1678.2, 10066.4], [5.7, 35.8]), FLEN = 36.3;
const ENTRY = 12.7;                    // the entrance porch along the front from the north corner

function coop(P, W) {
  const len = W.len, top = W.topAt(len / 2), front = W.nx < -0.9, north = W.nz < -0.9;
  P.r(0, P.y0, len, top, '#f1f1ef');
  for (let x = 1.2; x < len; x += 1.2) P.r(x - 0.02, 0.3, x + 0.02, top, '#d9dadb');          // the panel joints
  P.r(0, P.y0, len, 0.3, '#8f9196');
  P.r(0, 2.35, len, 2.85, '#e8c235');                                                         // the yellow band
  P.r(0, top - 0.25, len, top, '#dcdddf');
  if (len < 4) return;
  if (front) {
    // the shop windows under the band: dark glazing in frames, posters in some
    for (let x = ENTRY + 0.3; x < len - 0.4; x += 2.4) {
      const x1 = Math.min(x + 2.3, len - 0.4);
      P.r(x, 0.3, x1, 2.25, '#bfc3c7'); P.grad(x + 0.06, 0.36, x1 - 0.06, 2.19, '#3e4954', '#232a31');
    }
    for (const [x, t, c] of [[ENTRY + 1.5, 'GasUp', '#e2342d'], [ENTRY + 4.0, 'GasUp', '#e2342d'], [ENTRY + 9.4, 'Konsum', '#f07d22'], [ENTRY + 12, 'Coop', '#2a5bd7']]) {
      P.r(x - 1.05, 0.6, x + 1.05, 1.9, '#f4f2ee'); P.text(t, x, 1.25, 0.42, c, SANS);
    }
    // the ribbon of dark windows above the band
    P.r(ENTRY - 0.2, 3.15, len * 0.86, 4.25, '#9a9ea3');
    for (let x = ENTRY; x < len * 0.86 - 0.3; x += 1.55) P.grad(x + 0.08, 3.22, x + 1.47, 4.18, '#4f5b66', '#2d353d');
    // coop | Konsum, the hours
    const lx = ENTRY + 9.5, ly = 5.35;
    P.text('coop', lx - 1.0, ly, 1.25, '#2a5bd7', '800 %px "Arial Rounded MT Bold", Arial, sans-serif');
    P.r(lx + 0.75, ly - 0.45, lx + 0.85, ly + 0.45, '#2a5bd7');
    P.text('Konsum', lx + 1.0, ly - 0.05, 0.62, '#2a5bd7', SANS, 'left');
    P.text('9-22', len - 4.3, ly, 1.1, '#26282c', SANS);
    // the blue round sign by the porch
    P.arc(ENTRY + 1.2, 4.95, 0.42, '#ffffff'); P.arc(ENTRY + 1.2, 4.95, 0.36, '#2a5bd7'); P.r(ENTRY + 1.06, 4.75, ENTRY + 1.34, 5.15, '#ffffff');
    // behind the porch: the glass doors and the windows
    P.r(0.4, 0.3, ENTRY - 0.4, 2.9, '#a8adb2');
    P.grad(0.5, 0.35, ENTRY - 0.5, 2.85, '#55626e', '#2a3239');
    for (let x = 0.5 + 2.35; x < ENTRY - 0.5; x += 2.35) P.r(x - 0.04, 0.35, x + 0.04, 2.85, '#a8adb2');
    return;
  }
  if (north) {
    P.r(len * 0.25, 3.15, len * 0.75, 4.25, '#9a9ea3');
    for (let x = len * 0.25; x < len * 0.75 - 0.3; x += 1.55) P.grad(x + 0.08, 3.22, x + 1.47, 4.18, '#4f5b66', '#2d353d');
    P.text('9-22', len * 0.5, 5.4, 1.0, '#26282c', SANS);
    return;
  }
  // the back and the south end: a plain door, a loading door on the long back wall
  P.r(len * 0.2, 0.3, len * 0.2 + 1.0, 2.2, '#7d8085');
  if (len > 25) { P.r(len * 0.55, 0.3, len * 0.55 + 3.2, 3.4, '#b9bcc0'); for (let y = 0.6; y < 3.4; y += 0.3) P.r(len * 0.55 + 0.05, y, len * 0.55 + 3.15, y + 0.02, '#a2a5aa'); }
}

function red(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, top, '#b3312e'); P.weather(0, P.y0, len, top, 0.2, 17);
  P.r(0, P.y0, len, 0.45, '#8e8a86');
  if (len < 3) return;
  const gable = top > W.eaves + 1.2;
  const n = Math.max(1, Math.round(len / 3.2)), step = len / n;
  for (let k = 0; k < n; k++) {
    const x = step * (k + 0.5);
    P.win(x - 0.6, 0.95, x + 0.6, 2.35, { frame: '#f6f4ef', glass: '#4a5866', fw: 0.08, bars: 1, sill: 0.06, surround: 0.06, sc: '#f6f4ef' });
  }
  if (gable) for (const x of [len * 0.38, len * 0.62]) P.win(x - 0.45, W.eaves + 0.5, x + 0.45, W.eaves + 1.6, { frame: '#f6f4ef', glass: '#4a5866', fw: 0.07, bars: 1, sill: 0.05 });
  P.r(0, W.eaves - 0.18, len, W.eaves, '#f3f1ec');
}
const PAINT = { coop, red };

// cars in the bays before the front, nose to the shop ([x, z, yaw, id, paint, lift]; forward = (sin yaw, -cos yaw))
const NOSE = Math.atan2(-FRONT.V[0], FRONT.V[1]);        // facing the shop: forward = -V
export const ULENURME_KONSUM_CARS = [
  [16, 'passat', 'black'], [18.6, 'rav4', 'red'], [21.2, 'ceedsw', 'grey'], [26.4, 'mazda6', 'black'], [29, 'rav4', 'red'], [31.6, 'passat', 'silver'],
  [3.0, 'bz4x', 'white'], [11.0, 'passat', 'grey'],
].map(([s, id, paint], i) => { const [x, z] = FRONT.at(s, i < 6 ? 9.0 : 16.5); return [x, z, NOSE, id, paint, 0]; });
const CENTRE = [1690, 10085];

export function createUlenurmeKonsum(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  const { at } = FRONT;
  // the porch's piers stop cars
  world.addSolids([0.3, ENTRY / 2, ENTRY - 0.3].map((s) => { const [x, z] = at(s, 1.75); return { x, z, yaw: FRONT.YAW, hx: 0.3, hz: 0.3 }; }));
  let built = false;

  // (world.ready is also true for a square of the map not yet asked for, and a square can be loading again by
  // the time the job starts: the walls need their square loaded)
  const SPOTS = [[1700, 10070], [1665, 10090], [1695, 10117]];        // (the shop's block is kept in the square north of 10080)
  const loaded = ([x, z]) => world.sectors.get((Math.floor((x + 800) / 640) + 512) * 4096 + Math.floor((z + 800) / 640) + 512)?.state === 'ready';
  function* build() {
    while (!SPOTS.every(loaded)) yield;
    const houses = HOUSES.map(([name, S, base, at0, r]) => ({ name, sec: S[0], base, at: at0, r, spec: { wall: [220, 220, 220], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: (P, W) => PAINT[name](P, W) }] }));
    skinHouses(world, group, houses, { shadows, ppm: 14, far: 5, faces: (W) => W.len > 4 && W.ylo - W.yref < 2, debug: DEBUG, label: 'ulenurme konsum fronts' });
    yield 'frame';
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    const g = h(...at(ENTRY / 2, 1));
    // ---- the porch: brick piers, the yellow fascia, the steel frame box over it
    for (const s of [0.3, ENTRY / 2, ENTRY - 0.3]) A.box(FRONT, s, 1.75, 0.6, 0.6, -0.2, 3.0, 0x9c4a36, g);
    A.box(FRONT, ENTRY / 2, 1.2, ENTRY + 0.2, 2.6, 3.0, 3.55, 0xe8c235, g);
    A.box(FRONT, ENTRY / 2, 1.2, ENTRY + 0.1, 2.5, 3.55, 3.6, 0xcfd1d4, g);
    const Y0 = 3.6, Y1 = 6.3;
    for (let s = 0.1; s <= ENTRY - 0.05; s += ENTRY / 5) for (const v of [0.15, 2.3]) A.box(FRONT, s, v, 0.16, 0.16, Y0, Y1, 0xe1b72a, g);
    for (const y of [Y0 + 0.08, (Y0 + Y1) / 2, Y1 - 0.08]) for (const v of [0.15, 2.3]) A.box(FRONT, ENTRY / 2, v, ENTRY, 0.16, y - 0.08, y + 0.08, 0xe1b72a, g);
    for (let k = 0; k < 5; k++) {         // the diagonals of the front face
      const s0 = 0.1 + k * ENTRY / 5, s1 = s0 + ENTRY / 5, [ax, az] = at(s0, 2.3), [bx, bz] = at(s1, 2.3), d = Math.hypot(ENTRY / 5, Y1 - Y0);
      const geo = new THREE.BoxGeometry(d, 0.12, 0.12).rotateZ(Math.atan2(Y1 - Y0, ENTRY / 5) * (k % 2 ? 1 : -1));
      p.add(geo, 0xe1b72a, (ax + bx) / 2, g + (Y0 + Y1) / 2, (az + bz) / 2, FRONT.YAW);
    }
    { const tex = paintTexture(ENTRY, 0, Y1 - Y0, 20, (P) => { P.r(0, 0, ENTRY, Y1 - Y0, '#f3eccb'); for (let x = 0; x < ENTRY; x += 0.8) P.r(x, 0, x + 0.03, Y1 - Y0, '#e0d39a'); });
      const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(ENTRY, Y1 - Y0), mat);
      const [x, z] = at(ENTRY / 2, 2.25); m.position.set(x, g + (Y0 + Y1) / 2, z); m.rotation.y = Math.atan2(FRONT.V[0], FRONT.V[1]); group.add(m);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(ENTRY, 2.3).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xd9dadc }));
      const [tx, tz] = at(ENTRY / 2, 1.2); top.position.set(tx, g + Y1, tz); top.rotation.y = FRONT.YAW; group.add(top); }
    // the BENU Apteek sign on the fascia, a blue round sign beside it
    { const tex = paintTexture(4.2, 0, 0.5, 60, (P) => { P.r(0, 0, 4.2, 0.5, '#3d5a3a'); P.text('BENU Apteek', 2.1, 0.25, 0.32, '#ffffff', SANS); });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.5), new THREE.MeshLambertMaterial({ map: tex }));
      const [x, z] = at(ENTRY * 0.7, 2.53); m.position.set(x, g + 3.28, z); m.rotation.y = Math.atan2(FRONT.V[0], FRONT.V[1]); group.add(m);
      const dt = paintTexture(0.7, 0, 0.7, 60, (P) => { P.arc(0.35, 0.35, 0.35, '#ffffff'); P.arc(0.35, 0.35, 0.3, '#2a5bd7'); P.r(0.24, 0.22, 0.46, 0.48, '#ffffff'); }, { alpha: true });
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshLambertMaterial({ map: dt, alphaTest: 0.5 }));
      const [dx, dz] = at(ENTRY * 0.25, 2.53); d.position.set(dx, g + 3.28, dz); d.rotation.y = m.rotation.y; group.add(d); }
    yield;

    // ---- the car park in concrete pavers before the front, the footway along it, the bench
    A.pave(FRONT, -4, FLEN + 2, 0.2, 3.0, 'paver');
    A.pave(FRONT, -6, FLEN + 4, 3.0, 20.5, 'pavers');
    for (let s = 14.7; s < 34; s += 2.6) A.box(FRONT, s, 9.0, 0.1, 5.0, 0, 0.012, 0xf2f2f0);
    { const [x, z] = at(ENTRY + 3.5, 4.0), y = h(x, z);
      p.box(1.8, 0.08, 0.45, 0x8a6a48, x, y + 0.45, z, FRONT.YAW + Math.PI / 2);
      for (const d of [-0.7, 0.7]) { const [bx, bz] = at(ENTRY + 3.5 + d, 4.0); p.box(0.4, 0.42, 0.08, 0x3a3b40, bx, y + 0.21, bz, FRONT.YAW + Math.PI / 2); } }
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 500) return;
      if (SPOTS.every(loaded)) { built = true; jobs.add(build, 'ulenurme konsum'); }
    },
  };
}
