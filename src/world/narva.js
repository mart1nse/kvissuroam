// Narva maantee from Võidu sild to the Fortuuna and Raatuse corners, batch 1 of the Narva mnt kaardista
// (Martin, 22 Nov: a map outline from Võidu sild up Narva mnt to Raadi Maxima and the Ujula loop, with 53
// Street View shots of Jun 2023 to Aug 2024). Seen in his shots from the bridge and the junction:
//  - Spark Hub (Narva mnt 3): plum-brown upper floors over a pale grey ground floor along Narva mnt, the
//    curved dark roof storey, the round glass shop floor of Gemoss on the corner with the pale drum over it,
//    and the green SPARK HUB letters on the roof facing the bridge;
//  - the white tower on the Fortuuna corner: a dark glass stair strip and a big advert on its Narva mnt
//    side, the teal glazed balconies at the east end of its south side, shops along the ground floor;
//  - Narva mnt 9: grey-green render, brown window frames in pairs, the tall windows of the ground floor.
// From the air photos only (guessed details): the tower's lower neighbour, the low block with the green
// roof on Fortuuna, Atlantis (Narva mnt 2) by the river.
// The obelisks and iron railings of Võidu sild itself are drawn with the bridge (decks.js).
// The houses are the map's own blocks with painted walls (skinHouses: a wall a step in the work queue, see
// ../jobs.js); the roof letters are one small picture. Nothing stands on a carriageway, no street names on
// the road (Martin, 18 Nov).
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { paintScale } from './paintscale.js';
import { jobs } from '../jobs.js';
import { still } from '../still.js';
import { axes, row } from './ulikooli.js';

const DEBUG = typeof location !== 'undefined' && /narvadebug/.test(location.search);
export const S45 = ['4_5', 1760, 2400];
const S35 = ['3_5', 1120, 2400];
const CENTRE = [1880, 2780];

// ---------------------------------------------------------------- Spark Hub, Narva mnt 3
const PLUM = '#5b4547', PALE = '#bdb8b5', ROOFDARK = '#3d3a3d', GLASS = '#2f3540', FRAME = '#2a2a2e';
function spark(P, W) {
  const len = W.len, top = P.y1;
  // the drum of the shop floor on the corner: glass all round between thin pale mullions, a pale band over it
  if (W.len < 4.2 && W.peak < 6.5) {
    P.r(0, P.y0, len, top, PALE);
    P.r(0, 0.25, len, 3.7, GLASS); P.grad(0.05, 0.3, len - 0.05, 3.65, '#3b4453', '#262b33');
    for (const x of axes(0, len, 2)) P.r(x - 0.04, 0.25, x + 0.04, 3.7, '#8d8a8c');
    P.r(0, 1.05, len, 1.1, '#8d8a8c');
    P.r(0, 3.7, len, top, PALE); P.r(0, 3.7, len, 3.85, '#9a9596');
    return;
  }
  // the drum's upper floor over the corner and the roof storey: pale with GEMOSS on it, dark above
  if (W.foot > 4) {
    const band = Math.min(top, 9.6);
    P.r(0, P.y0, len, band, PALE);
    P.r(0, band, len, top, PLUM);
    if (W.len > 15 && W.nz > 0.6) {                // the big face over the corner, towards the bridge
      P.r(0, 5.6, len * 0.55, 9.2, GLASS);
      for (const x of axes(0, len * 0.55, 4)) P.r(x - 0.05, 5.6, x + 0.05, 9.2, '#6d6a6c');
      P.text('GEMOSS', len * 0.78, 7.4, 1.4, '#f4f2ee', '600 %px Arial, sans-serif');
      row(P, W, axes(0, len, Math.round(len / 3.3)), 10.4, 2.1, 2.5, { frame: FRAME, glass: GLASS, fw: 0.08, bars: 1, T: false, surround: 0, sill: 0 });
    } else row(P, W, axes(0, len, Math.max(1, Math.round(len / 3.3))), 6.0, 2.4, Math.min(2.4, len - 0.8), { frame: FRAME, glass: GLASS, fw: 0.08, bars: 1, T: false, surround: 0, sill: 0 });
    P.r(0, top - 0.6, len, top, ROOFDARK);
    return;
  }
  // the long walls: pale ground floor, plum floors over it, the dark roof storey under its curved eaves
  P.r(0, P.y0, len, P.y1, PLUM);
  P.r(0, P.y0, len, 4.2, PALE); P.r(0, 4.05, len, 4.25, '#9a9596');
  const n = Math.max(1, Math.round((len - 0.6) / 3.3)), xs = axes(0, len, n);
  row(P, W, xs, 0.6, 2.8, 2.6, { frame: FRAME, glass: GLASS, fw: 0.07, bars: 1, T: false, surround: 0, sill: 0 });
  for (const s of [5.1, 8.3]) row(P, W, xs, s, 2.2, 2.6, { frame: FRAME, glass: GLASS, fw: 0.08, bars: 1, rails: 0, T: false, surround: 0.05, sc: '#3e3436', sill: 0 });
  const roof = Math.min(W.eaves, 15.2);
  if (roof > 12.5) {
    P.r(0, 11.3, len, roof + 0.2, ROOFDARK);
    row(P, W, axes(0, len, Math.max(1, Math.round(len / 2))), 11.8, 1.6, 1.7, { frame: '#58565a', glass: '#4a5568', fw: 0.06, bars: 0, T: false, surround: 0, sill: 0 });
  }
}

// ---------------------------------------------------------------- the white tower on the Fortuuna corner
const WHITE = '#eef0ee', TEAL = '#4fa3a0';
const shopFloor = (P, len, sign) => {
  P.r(0, P.y0, len, 4.0, '#3a3e45');
  for (const x of axes(0, len, Math.max(1, Math.round(len / 3.2)))) { P.grad(x - 1.35, 0.3, x + 1.35, 3.0, '#4b5668', '#2c323b'); P.r(x - 1.4, 0.25, x - 1.32, 3.05, '#c9cdd0'); }
  P.r(0, 3.05, len, 3.9, '#2b2d31');
  for (const [x, w, col, txt] of sign) { P.r(x, 3.15, x + w, 3.8, col); if (txt) P.text(txt, x + w / 2, 3.48, 0.5, '#ffffff', '700 %px Arial, sans-serif'); }
};
function tower(P, W) {
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05);
  P.r(0, P.y0, len, P.y1, WHITE);
  if (W.foot > 20) {                                   // the roof storeys: plain, a band of windows
    row(P, W, axes(0, len, Math.max(1, Math.round(len / 2.6))), W.foot + 0.9, 1.4, 1.3, { frame: '#d9dcdc', glass: '#56647c', fw: 0.06, T: false, surround: 0, sill: 0 });
    return;
  }
  const floors = []; for (let y = 5.0; y < top - 2.6; y += 2.95) floors.push(y);
  const win = { frame: '#e9ecec', glass: '#4e5b70', fw: 0.06, T: false, bars: 1, surround: 0, sill: 0.05, sc: '#d6d9d9' };
  const west = W.nx < -0.8, south = W.nz > 0.8;
  let xs = axes(0, len, Math.max(1, Math.round(len / 2.7)));
  if (west && len > 20) {
    // Narva mnt side: the dark glass of the stair at the north end, the advert board low on the wall
    P.r(len - 4.2, 4.0, len - 0.4, top, '#30363f');
    for (let y = 4.6; y < top; y += 2.95) P.r(len - 4.2, y, len - 0.4, y + 0.12, '#5c6470');
    P.r(len - 2.35, 4.0, len - 2.25, top, '#5c6470');
    xs = xs.filter((x) => x < len - 5);
    P.r(3.0, 5.4, 11.4, 12.6, '#2c2c34'); P.grad(3.2, 5.6, 11.2, 12.4, '#7a5fa8', '#c26a9e');
    P.text('TARTU 2024', 7.3, 10.6, 1.0, '#ffffff', '800 %px Arial, sans-serif'); P.text('Euroopa kultuuripealinn', 7.3, 8.9, 0.5, '#f6e9f4');
    for (const y of floors) row(P, W, xs.filter((x) => x > 12.3 || y > 13), y, 1.6, 1.4, win);
    shopFloor(P, len, [[1.0, 5.5, '#d2322d', 'KEBAB'], [8.0, 5.0, TEAL, ''], [14.0, 7.0, '#2b2d31', ''], [22.0, 3.6, '#d2322d', '']]);
    return;
  }
  if (south && len > 30) {
    // Fortuuna side: windows in rows, the teal glazed balconies stacked at the east end
    const b0 = len - 9.5;
    for (const y of floors) {
      row(P, W, xs.filter((x) => x < b0 - 0.8), y, 1.6, 1.4, win);
      P.r(b0, y - 1.0, len - 0.6, y + 2.0, '#cfd6d6');
      P.r(b0 + 0.4, y - 0.95, len - 1.0, y + 1.9, '#3d4b57');
      P.r(b0, y - 1.05, len - 0.6, y - 0.05, TEAL); P.r(b0, y - 0.15, len - 0.6, y - 0.05, '#2f7c7a');
    }
    P.r(b0 - 0.2, 4.0, b0, top, '#d7dada');
    shopFloor(P, len, [[2.0, 6.0, '#2b2d31', ''], [9.0, 6.5, '#d2322d', 'GUSTAV'], [17.0, 6.0, TEAL, ''], [25.0, 5.0, '#d2322d', ''], [32.5, 6.5, '#2b2d31', '']]);
    return;
  }
  for (const y of floors) if (!(W.foot > y)) row(P, W, xs, y, 1.6, 1.4, win);
  if (W.foot < 1) shopFloor(P, len, []);
}

// ---------------------------------------------------------------- Narva mnt 9
const SAGE = '#b3bdb4', BROWN = '#6c3a2f';
function narva9(P, W) {
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05);
  P.r(0, P.y0, len, P.y1, SAGE);
  if (W.foot > 12) { P.r(0, P.y0, len, P.y1, '#8f9a92'); row(P, W, axes(0, len, Math.max(1, Math.round(len / 3))), W.foot + 0.6, 1.3, 2.2, { frame: BROWN, glass: '#4d5466', fw: 0.08, T: false, surround: 0, sill: 0 }); return; }
  P.r(0, P.y0, len, 0.5, '#8d938e');
  const n = Math.max(1, Math.round((len - 0.6) / 3.1)), xs = axes(0, len, n);
  const w = { frame: BROWN, glass: '#3f4656', fw: 0.09, bars: 1, T: false, surround: 0, sill: 0.06, sc: '#9aa39b' };
  row(P, W, xs, 0.75, 2.3, 1.5, w);                    // the tall windows of the ground floor, deep in the wall
  for (const y of [4.3, 7.5, 10.6]) if (y + 1.6 < top) row(P, W, xs, y, 1.55, 1.5, w);
  P.r(0, top - 0.35, len, top, '#9aa39b');
}

// ---------------------------------------------------------------- the air photo ones
function plainWhite(o) {
  return (P, W) => {
    const len = W.len, top = Math.min(P.y1, W.eaves + 0.05);
    P.r(0, P.y0, len, P.y1, o.wall);
    if (W.foot < 1) P.r(0, P.y0, len, 0.5, o.plinth || '#8e8f92');
    const xs = axes(0, len, Math.max(1, Math.round((len - 0.6) / (o.pitch || 3))));
    for (let y = W.foot > 1 ? W.foot + 0.9 : 1.0; y + 1.5 < top; y += o.storey || 3.2) {
      if (o.ribbon) { P.r(0.6, y, len - 0.6, y + 1.5, o.glass || '#3c4350'); for (const x of xs) P.r(x - 0.05, y, x + 0.05, y + 1.5, o.frame || '#d6d8da'); }
      else row(P, W, xs, y, 1.5, o.w || 1.4, { frame: o.frame || '#e4e6e6', glass: o.glass || '#4e5b70', fw: 0.07, T: false, bars: 1, surround: 0, sill: 0.05 });
    }
    P.r(0, top - 0.3, len, top, o.cap || '#c9cbcd');
  };
}

// [name, sector, base, at, reach, wall colour, roof colour, painter]
const HOUSES = [
  ['spark hub', S45, -14, [1878, 2720], 40, 0x5b4547, 0x3d3a3d, spark],
  ['narva 9', S45, 9, [1846, 2690], 25, 0xb3bdb4, 0x707578, narva9],
  ['fortuuna tower', S45, -81, [1939, 2779], 25, 0xeef0ee, 0x9ea4a8, tower],
  ['tower east', S45, -96, [1957, 2773], 10, 0xe9ebea, 0x9ea4a8, plainWhite({ wall: '#e9ebea', storey: 2.95 })],
  ['fortuuna low', S45, -88, [1941, 2747], 25, 0xd9dad6, 0x7c9a6e, plainWhite({ wall: '#d9dad6', pitch: 2.6 })],
  ['atlantis', S35, -243, [1737, 2805], 40, 0xf1f1ef, 0x9ea2a6, plainWhite({ wall: '#f1f1ef', ribbon: true, glass: '#34404c', storey: 3.6, pitch: 2.2 })],
];
// the walls painted finely: the ones Martin's shots show
const FINE = [[1855.0, 2719.1, 3], [1866.6, 2732.4, 3], [1882.5, 2729.3, 3], [1889, 2738, 14], [1922.0, 2780.1, 3], [1939.3, 2788.1, 3], [1840.5, 2696.4, 3]];
const fine = (W) => FINE.some((q) => Math.hypot(q[0] - W.mid[0], q[1] - W.mid[1]) < q[2]);

// The map's posts on Võidu sild: none stand on the span (the obelisks light it), and a wooden pole stood
// in the north-west obelisk
const LIGHT = 0, POLE = 1;
const OBELISKS = [[1907.1, 2886.3], [1886.2, 2884.7], [1902.6, 2946.1], [1881.6, 2944.5]];
export function narvaClear(data) {
  const out = [], a = data.sectors['4_5'] || [];
  for (let k = 0; k < a.length; k += data.stride) {
    if (a[k] !== LIGHT && a[k] !== POLE) continue;
    const x = a[k + 1], z = a[k + 2];
    const onSpan = z > 2889 && z < 2942 && x > 1876 && x < 1914;
    if (onSpan || OBELISKS.some((q) => Math.hypot(q[0] - x, q[1] - z) < 6)) out.push(`4_5:${k / data.stride}`);
  }
  return out;
}

export function narvaWalls(walls) {
  for (const S of [S45, S35]) {
    const list = HOUSES.filter((H) => H[1] === S).map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r }));
    setHouseColours(walls, S[0], S[1], S[2], list);
  }
}

// The SPARK HUB letters on the roof: green capitals edged in white on a light frame of posts, turned to the
// bridge (one small picture with see-through between the letters)
function roofLetters(group) {
  const q = paintScale() < 1 ? 0.5 : 1, cv = document.createElement('canvas');
  cv.width = Math.round(512 * q); cv.height = Math.round(96 * q);
  // (lit letters: they read green in any light, as the real ones do)
  const c = cv.getContext('2d');
  c.font = `800 ${Math.round(78 * q)}px Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 7 * q; c.strokeStyle = '#f2f6ef'; c.strokeText('SPARK HUB', cv.width / 2, cv.height / 2 + 3 * q);
  c.fillStyle = '#3f9b48'; c.fillText('SPARK HUB', cv.width / 2, cv.height / 2 + 3 * q);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(13.5, 2.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
  // over the face above the corner (wall mid 1882.5, 2729.3, facing 0.57, 0.82), standing on its roof edge
  const nx = 0.57, nz = 0.82;
  m.position.set(1882.5 - nx * 0.6, 16.3 + 1.65, 2729.3 - nz * 0.6);
  m.rotation.y = Math.atan2(nx, nz);
  m.updateMatrix();
  group.add(m);
  const posts = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.08, 0.08), new THREE.MeshLambertMaterial({ color: 0x8d9096 }));
  posts.position.set(m.position.x - nx * 0.1, 16.5, m.position.z - nz * 0.1); posts.rotation.y = m.rotation.y; posts.updateMatrix();
  group.add(posts);
}

export function createNarva(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  let built = false;
  function* build() {
    const houses = HOUSES.map(([name, S, base, at, r, , , paint]) => ({ name, sec: S[0], base, at, r, spec: { wall: [220, 220, 216], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: paint }] }));
    skinHouses(world, group, houses, { shadows, ppm: 12, far: 5, faces: fine, debug: DEBUG, label: 'narva fronts' });
    yield;
    roofLetters(group);
  }
  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 320) return;
      if (![[1878, 2720], [1939, 2779], [1846, 2690], [1737, 2805]].every((q) => world.ready(q[0], q[1]))) return;
      built = true;
      jobs.add(build, 'narva');
    },
  };
}
