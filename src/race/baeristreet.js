// Upper Vallikraavi and K. E. von Baeri tänav on the lap, from the mural house to the last houses before
// the Jakobi corner (Martin, 18 Nov, from his Google street views of Aug 2024), in pastel colours.
//   Vallikraavi: the yellow wooden house, the terraced red-brown flats behind their hedge, granite wall and
//   rail fence, the red brick villa with its zinc mansard, the old iron fence on concrete posts round the
//   bend, the stone terraces in the hollow, the stair up the bank, lanterns, poles and signs
//   Baeri under Toomemägi: the old lanterns on the lawn, the long outbuilding covered in graffiti, the
//   pink clinic up on the bank, the stair to Hezeli, no-parking signs
//   Baeri down to Jakobi: the poster column, the stair up the hill, the green wooden corner house, the grey
//   plastered house, the blue and the yellow wooden houses, the tall board fence, the grey house with the
//   arched door, the red brick warehouses with boarded windows, posters and bracket lanterns
// The houses between the mural house and the yellow house had no photos: their fronts are guesses.
// Every house front is a painted picture standing a hand's breadth in front of the map's own wall.
// Nothing here is solid: the fences, walls and stairs are near the racing line. Posts and signs are props.
import * as THREE from 'three';
import { createTrack } from './race.js';
import { BOX, rnd } from './landmarks.js';
import { streetKit, wallOf, setHouseColours, grassTex } from '../world/streetkit.js';
import { facade } from './vallistreet.js';
import { drapeGeometry } from '../world/drape.js';

// wall lines from the LOD2 model (game x, z), the open side on the right-hand side going a -> b; top: world y
const WALLS = {
  // --- no photos: guessed fronts
  S60: { a: [1370.85, 3093.3], b: [1336.15, 3089.8], top: 21.6 },      // long house on the left after the mural
  S60e: { a: [1369.65, 3105.25], b: [1370.85, 3093.3], top: 21.2 },
  S60w: { a: [1333.65, 3092.8], b: [1340.5, 3104.55], top: 21.2 },
  N64: { a: [1361.05, 3082.45], b: [1371.35, 3084.3], top: 21.8 },
  N97: { a: [1328.0, 3076.2], b: [1355.85, 3081.15], top: 23.5 },
  N97e: { a: [1355.85, 3081.15], b: [1357.0, 3074.6], top: 19.1 },
  N97w: { a: [1330.7, 3061.05], b: [1328.0, 3076.2], top: 22.9 },
  N75: { a: [1311.2, 3074.45], b: [1323.3, 3074.45], top: 24.3 },
  N75e: { a: [1323.3, 3074.45], b: [1323.3, 3048.8], top: 22.2 },
  N75w: { a: [1311.25, 3055.2], b: [1311.2, 3073.5], top: 22.1 },
  S33a: { a: [1311.55, 3084.45], b: [1305.25, 3085.1], top: 25.1 },
  S33b: { a: [1305.2, 3084.3], b: [1290.3, 3085.95], top: 25.5 },
  S33c: { a: [1290.3, 3085.95], b: [1280.45, 3088.2], top: 25.9 },
  S33d: { a: [1281.85, 3094.4], b: [1266.85, 3097.85], top: 29.0 },
  S33e: { a: [1324.25, 3095.65], b: [1320.7, 3087.85], top: 25.1 },
  S33f: { a: [1312.0, 3088.6], b: [1311.55, 3084.45], top: 25.1 },
  S33w: { a: [1280.45, 3088.2], b: [1281.85, 3094.4], top: 26.2 },
  N18: { a: [1260.2, 3083.7], b: [1273.85, 3080.75], top: 19.8 },
  N18e: { a: [1273.55, 3079.4], b: [1272.1, 3072.5], top: 23.6 },
  // --- the yellow wooden house
  Y1: { a: [1244.0, 3084.85], b: [1253.65, 3082.25], top: 28.8 },
  Y2: { a: [1234.0, 3087.55], b: [1241.4, 3085.55], top: 28.8 },
  Y3: { a: [1228.65, 3074.5], b: [1232.3, 3088.0], top: 29.9 },
  Y4: { a: [1253.45, 3081.6], b: [1250.05, 3068.8], top: 30.1 },
  // --- the terraced flats
  K1: { a: [1228.2, 3107.35], b: [1206.65, 3119.15], top: 31.8 },
  K2: { a: [1238.1, 3107.25], b: [1229.4, 3109.5], top: 31.6 },
  K3: { a: [1242.85, 3121.2], b: [1238.1, 3107.25], top: 31.0 },
  K4: { a: [1206.65, 3119.15], b: [1215.85, 3135.95], top: 31.0 },
  // --- the red brick villa
  R1: { a: [1191.8, 3125.35], b: [1177.6, 3133.05], top: 31.7 },
  R2: { a: [1179.7, 3136.95], b: [1172.6, 3140.85], top: 33.4 },
  R3: { a: [1177.6, 3133.05], b: [1179.7, 3136.95], top: 33.4 },
  R4: { a: [1194.15, 3129.75], b: [1191.8, 3125.35], top: 31.6 },
  R5: { a: [1172.6, 3140.85], b: [1178.8, 3152.35], top: 31.6 },
  // --- the graffiti outbuilding on Baeri
  O1: { a: [990.55, 3024.95], b: [969.05, 3024.0], top: 28.6 },
  O2: { a: [990.2, 3032.8], b: [990.55, 3024.95], top: 28.6 },
  O3: { a: [969.05, 3024.0], b: [968.7, 3031.85], top: 28.6 },
  // --- Baeri down to Jakobi, left side
  G1: { a: [835.7, 2724.7], b: [846.75, 2708.35], top: 21.5 },         // the green wooden corner house
  G2: { a: [826.1, 2718.2], b: [835.7, 2724.7], top: 24.6 },
  P1: { a: [849.5, 2704.15], b: [858.1, 2696.3], top: 24.6 },          // grey plastered
  P2: { a: [837.35, 2688.2], b: [849.5, 2704.15], top: 23.9 },
  B1: { a: [857.75, 2695.85], b: [868.3, 2687.85], top: 27.5 },        // blue wooden
  B2: { a: [868.3, 2687.85], b: [859.05, 2675.7], top: 27.8 },
  J1: { a: [875.05, 2684.45], b: [890.6, 2674.25], top: 27.4 },        // yellow wooden
  J2: { a: [866.5, 2671.35], b: [875.05, 2684.45], top: 28.1 },
  J3: { a: [890.6, 2674.25], b: [884.1, 2664.35], top: 28.1 },
  A1: { a: [913.35, 2656.55], b: [930.15, 2638.4], top: 25.7 },        // the grey house with the arched door
  A2: { a: [904.25, 2648.1], b: [913.35, 2656.55], top: 24.1 },
  A3: { a: [930.15, 2638.4], b: [921.05, 2630.0], top: 23.9 },
  // --- right side
  W1: { a: [927.45, 2656.95], b: [901.65, 2674.7], top: 20.6 },        // the long brick warehouse
  W2: { a: [901.65, 2674.7], b: [905.45, 2680.25], top: 22.4 },        // its gable with the posters
  X1: { a: [944.2, 2630.7], b: [938.35, 2644.9], top: 22.2 },          // the second brick house
  X2: { a: [938.35, 2644.9], b: [935.25, 2649.45], top: 19.1 },
  X3: { a: [935.25, 2649.45], b: [942.05, 2654.05], top: 21.9 },
  U1: { a: [915.9, 2680.6], b: [895.25, 2694.8], top: 25.1 },          // the brick house up on the bank
};
const ZONES = [
  { c: [1290, 3090], ready: [[1360, 3090], [1300, 3085], [1240, 3100], [1185, 3130], [1100, 3110]], keys: ['S60', 'S60e', 'S60w', 'N64', 'N97', 'N97e', 'N97w', 'N75', 'N75e', 'N75w', 'S33a', 'S33b', 'S33c', 'S33d', 'S33e', 'S33f', 'S33w', 'N18', 'N18e', 'Y1', 'Y2', 'Y3', 'Y4', 'K1', 'K2', 'K3', 'K4', 'R1', 'R2', 'R3', 'R4', 'R5'] },
  { c: [980, 3020], ready: [[1060, 3050], [980, 3025], [900, 3010], [860, 2960]], keys: ['O1', 'O2', 'O3'] },
  { c: [880, 2700], ready: [[866, 2890], [862, 2830], [850, 2760], [850, 2710], [890, 2680], [930, 2650]], keys: ['G1', 'G2', 'P1', 'P2', 'B1', 'B2', 'J1', 'J2', 'J3', 'A1', 'A2', 'A3', 'W1', 'W2', 'X1', 'X2', 'X3', 'U1'] },
];
const COL = {
  granite: 0x7c7c88, graniteTop: 0x9a9aa6, concrete: 0x98948e, iron: 0x26252c, wood: 0x8a7868, woodDark: 0x6e5f54,
  stone: 0x9d9690, stoneDark: 0x87807a, step: 0xb5b1b6, hedge: [0x5fa565, 0x76b86c, 0x4f9560], bin: 0x3f7a52,
};
const SIGN0 = 10, PROHIBIT = SIGN0 + 1, NO_ENTRY = SIGN0 + 2, CROSSING = SIGN0 + 7, PARKING_SIGN = SIGN0 + 11, SPEED30 = SIGN0 + 12;
const LIGHT = 0, POLE = 1, LANTERN = 9;

export function baeriStreetWalls(walls) {
  const slate = 0x70727f, zinc = 0x9aa0ac, tin = 0xa9adb6, tile = 0xb0705e;
  setHouseColours(walls, '3_6', 1120, 3040, [
    { base: 1360, x: 1353, z: 3098, wall: 0xe6d9b8, roof: tin, reach: 26 },
    { base: 1364, x: 1366, z: 3076, wall: 0xc9d0dc, roof: tin, reach: 14 },
    { base: 1397, x: 1342, z: 3072, wall: 0xb9c4b0, roof: tile, reach: 20 },
    { base: 1475, x: 1317, z: 3062, wall: 0xe9dcc4, roof: tin, reach: 18 },
    { base: 1530, x: 1298, z: 3058, wall: 0xd9d2c4, roof: slate, reach: 14 },
    { base: 1433, x: 1298, z: 3100, wall: 0xe4e0e8, roof: tin, reach: 40 },
    { base: 1618, x: 1266, z: 3078, wall: 0xb4a79a, roof: slate, reach: 12 },
    { base: 1680, x: 1240, z: 3075, wall: 0xe6d9a0, roof: tin, reach: 22 },
    { base: 1719, x: 1224, z: 3120, wall: 0xb8705c, roof: 0x8f8f98, reach: 26 },
    { base: 1761, x: 1186, z: 3138, wall: 0xc98474, roof: zinc, reach: 22 },
  ]);
  setHouseColours(walls, '2_5', 480, 2400, [
    { base: 2498, x: 980, z: 3028, wall: 0xe4dccb, roof: 0x8c9099, reach: 14 },
    { base: 3126, x: 930, z: 2950, wall: 0xf0bcb6, roof: 0x9a9ea8, reach: 60 },
    { base: 1626, x: 836, z: 2714, wall: 0xa9b98c, roof: tin, reach: 16 },
    { base: 1607, x: 844, z: 2704, wall: 0xa9b98c, roof: tin, reach: 7 },
    { base: 1557, x: 848, z: 2694, wall: 0xb4b9c4, roof: tin, reach: 16 },
    { base: 1506, x: 861, z: 2685, wall: 0x8fa3c4, roof: tin, reach: 12 },
    { base: 1388, x: 878, z: 2674, wall: 0xe9d9a4, roof: tin, reach: 16 },
    { base: 1130, x: 917, z: 2644, wall: 0xc9c7cc, roof: zinc, reach: 20 },
    { base: 1189, x: 916, z: 2667, wall: 0xc47a66, roof: tin, reach: 20 },
    { base: 1197, x: 921, z: 2672, wall: 0xd98880, roof: tin, reach: 20 },
    { base: 1128, x: 943, z: 2643, wall: 0xc47a66, roof: zinc, reach: 14 },
    { base: 1003, x: 905, z: 2695, wall: 0xc47a66, roof: tin, reach: 24 },
  ]);
}

// the iron fence round the Vallikraavi bend: lap indexes, metres outside the road edge on the left
const FENCE = { i0: 243, i1: 286, off: 4.1 };
// the left side of Baeri past the tennis courts, from Martin's Street View (19 Nov): granite kerb, a strip of
// grass with the trees in it, then a grey brick footpath with an odd red brick. gap: grass width (m) beyond
// the kerb, widening down the hill
const SIDE = { i0: 471, i1: 541, kerb: 0.2, path: 2.6, gap: [[471, 0.9], [490, 1.2], [505, 2.0], [516, 2.5], [541, 2.5]] };
const sideGap = (i) => {
  const g = SIDE.gap;
  for (let k = 1; k < g.length; k++) if (i <= g[k][0]) { const [i0, a] = g[k - 1], [i1, b] = g[k]; return a + (b - a) * Math.max(0, i - i0) / (i1 - i0); }
  return g[g.length - 1][1];
};
// grey pavers (a few shades), roughly one in ten a faded red; 16 rows of 20 x 10 cm bricks to a 1.6 m tile
function footpathTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), r = rnd(23);
  g.fillStyle = '#8f8b92'; g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 16; row++) for (let k = -1; k < 8; k++) {
    const red = r() < 0.1, v = 0.9 + r() * 0.16;
    const [R, G, B] = red ? [196, 128, 130] : [184, 180, 186];
    g.fillStyle = `rgb(${Math.min(255, R * v) | 0},${Math.min(255, G * v) | 0},${Math.min(255, B * v) | 0})`;
    g.fillRect(k * 32 + (row % 2) * 16 + 1, row * 16 + 1, 30, 14);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

const bearing = (dx, dz) => (Math.atan2(dx, -dz) * 180) / Math.PI;
// lantern posts, lamp poles and signs: all knockable props
export function baeriStreetProps() {
  const track = createTrack();
  const out = [];
  const at = (kind, i, side, off, face = true) => {
    const k = Math.floor(i), [tx, tz] = track.tan[k], lat = side * (track.HW[k] + off);
    out.push([kind, track.P[k][0] - tz * lat, track.P[k][1] + tx * lat, face ? bearing(-tx, -tz) : bearing(-tz * -side, tx * -side)]);
  };
  // upper Vallikraavi
  for (const i of [152, 176, 196]) at(LIGHT, i, -1, 1.5, false);
  for (const i of [246, 262, 277]) at(LIGHT, i, -1, FENCE.off + 0.7, false);     // behind the iron fence (Martin, 19 Nov)
  at(POLE, 220, -1, 1.7);
  at(LANTERN, 211, -1, 2.3);
  at(NO_ENTRY, 217, 1, 1.3, true);
  at(PARKING_SIGN, 281, 1, 1.4);
  // Baeri under Toomemägi
  at(LANTERN, 303, -1, 4.6); at(LANTERN, 315, -1, 4.6);
  at(CROSSING, 322, 1, 1.2); at(CROSSING, 322, -1, 1.2);
  for (const i of [338, 366, 390]) at(LIGHT, i, -1, 1.4, false);
  at(LIGHT, 421, 1, 1.4, false);
  at(PROHIBIT, 347, 1, 1.3); at(PROHIBIT, 409, 1, 1.3); at(PROHIBIT, 441, 1, 1.3);
  // Baeri down to Jakobi
  at(LANTERN, 533, 1, 3.2); at(LANTERN, 549, 1, 2.8); at(LANTERN, 567, 1, 2.6); at(LANTERN, 582, 1, 2.6);
  at(PROHIBIT, 546, 1, 1.0); at(SPEED30, 557, 1, 1.0); at(PROHIBIT, 588, 1, 2.6);
  return out;
}

const tone = (rgb, k) => `rgb(${Math.min(255, rgb[0] * k) | 0},${Math.min(255, rgb[1] * k) | 0},${Math.min(255, rgb[2] * k) | 0})`;

function ironTex() {           // upright bars between two rails, see-through
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const c = cv.getContext('2d');
  c.fillStyle = '#26252c';
  for (let x = 6; x < 64; x += 16) c.fillRect(x, 0, 4, 64);
  c.fillRect(0, 6, 64, 4); c.fillRect(0, 50, 64, 4);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
function boardTex() {          // weathered upright boards
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const c = cv.getContext('2d'), r = rnd(7);
  for (let x = 0; x < 256; x += 16) {
    const k = 0.82 + r() * 0.3;
    c.fillStyle = tone([146, 132, 122], k); c.fillRect(x, 0, 16, 128);
    c.fillStyle = 'rgba(40,34,30,0.55)'; c.fillRect(x, 0, 1.5, 128);
    for (let q = 0; q < 3; q++) { c.fillStyle = `rgba(60,52,46,${0.08 + r() * 0.12})`; c.fillRect(x + 2 + r() * 10, r() * 128, 1.5, 20 + r() * 60); }
  }
  c.fillStyle = 'rgba(70,62,56,0.5)'; c.fillRect(0, 0, 256, 5);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
function posterTex() {         // the round poster column's skin
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const c = cv.getContext('2d'), r = rnd(23);
  c.fillStyle = '#c9c6c2'; c.fillRect(0, 0, 512, 256);
  const cols = ['#e86a8a', '#f2c14e', '#5aa9e6', '#2f2c34', '#f4f1ea', '#7fc8a9', '#e8894a', '#b06ad0', '#d94f4f'];
  for (let row = 0; row < 3; row++) for (let x = 4; x < 508; ) {
    const w = 36 + r() * 30, y = 42 + row * 68 + r() * 6;
    c.fillStyle = cols[Math.floor(r() * cols.length)]; c.fillRect(x, y, w, 60);
    c.fillStyle = cols[Math.floor(r() * cols.length)]; c.fillRect(x + 4, y + 6 + r() * 20, w - 8, 10 + r() * 16);
    c.fillStyle = 'rgba(20,20,26,0.75)'; for (let q = 0; q < 3; q++) c.fillRect(x + 5, y + 40 + q * 6, (w - 10) * (0.5 + r() * 0.5), 2);
    x += w + 3;
  }
  c.fillStyle = '#9a9792'; c.fillRect(0, 236, 512, 20); c.fillRect(0, 0, 512, 30);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

function gutterTex() {         // round field stones set in a strip along the kerb; one tile is 1.6 m
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d'), r = rnd(31);
  c.fillStyle = '#4f4a50'; c.fillRect(0, 0, 256, 256);
  const tones = [[168, 160, 166], [142, 136, 146], [186, 174, 172], [128, 124, 136], [176, 158, 156]];
  for (let y = 0; y < 256; y += 21) for (let x = (y / 21) % 2 ? -10 : 0; x < 256; x += 22) {
    const t = tones[Math.floor(r() * tones.length)], k = 0.85 + r() * 0.3;
    c.fillStyle = tone(t, k);
    c.beginPath(); c.ellipse(x + 11 + r() * 3, y + 10 + r() * 3, 9 + r() * 2, 8 + r() * 2, r() * 3, 0, 7); c.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

export function createBaeriStreet(world, group, { shadows = true } = {}) {
  const track = createTrack();
  const done = ZONES.map(() => false);
  const h = (x, z) => world.heightAt(x, z);
  const T = (i, lat) => {                                 // track frame at a fractional index; lat > 0 to the right
    const k = Math.floor(i), f = i - k, a = track.P[k], b = track.P[k + 1];
    const [tx, tz] = track.tan[k];
    return [a[0] + (b[0] - a[0]) * f - tz * lat, a[1] + (b[1] - a[1]) * f + tx * lat];
  };
  const hw = (i) => track.HW[Math.round(i)];
  // trees standing on the new footpath on the left of Baeri move just behind it, onto the bank
  if (world.addTreeMove) {
    const mid = Math.round((SIDE.i0 + SIDE.i1) / 2), c = track.P[mid];
    world.addTreeMove((x, z) => {
      if (Math.hypot(x - c[0], z - c[1]) > 90) return null;
      const n = track.nearest(x, z, mid);
      if (!n || n.i < SIDE.i0 || n.i > SIDE.i1) return null;
      const [tx, tz] = track.tan[n.i], dx = x - track.P[n.i][0], dz = z - track.P[n.i][1];
      const lat = -dx * tz + dz * tx, along = dx * tx + dz * tz, out = -lat - hw(n.i), g = sideGap(n.i);
      if (lat > 0 || out < g - 0.3 || out > g + SIDE.path + 1.6) return null;
      const want = -(hw(n.i) + g + SIDE.path + 1.4);
      return [track.P[n.i][0] + tx * along - tz * want, track.P[n.i][1] + tz * along + tx * want];
    });
  }
  // the avenue: broadleaved trees down the middle of the grass strip, about every 13 m
  if (world.addTrees) {
    const row = [];
    for (let i = SIDE.i0 + 3, k = 0; i < SIDE.i1 - 2; i += 6, k++) row.push([...T(i, -(hw(i) + (SIDE.kerb + sideGap(i)) / 2)), 16 + (k % 3) * 1.7, 8 + (k % 2), 0]);
    world.addTrees(row);
  }
  // the map's trees on the verge and pavement outside the Vallikraavi bend stand just behind the fence
  // instead (Martin, 19 Nov)
  if (world.addTreeMove) {
    const mid = track.P[Math.round((FENCE.i0 + FENCE.i1) / 2)];
    world.addTreeMove((x, z) => {
      if (Math.hypot(x - mid[0], z - mid[1]) > 70) return null;
      const n = track.nearest(x, z, Math.round((FENCE.i0 + FENCE.i1) / 2));
      if (!n || n.i < FENCE.i0 - 2 || n.i > FENCE.i1 + 2) return null;
      const [tx, tz] = track.tan[n.i], dx = x - track.P[n.i][0], dz = z - track.P[n.i][1];
      const lat = -dx * tz + dz * tx, along = dx * tx + dz * tz, out = -lat - hw(n.i);
      if (lat > 0 || out > FENCE.off + 1.2) return null;
      const want = -(hw(n.i) + FENCE.off + 1.3);
      return [track.P[n.i][0] + tx * along - tz * want, track.P[n.i][1] + tz * along + tx * want];
    });
  }
  // points along the road edge, `off` metres outside it, about `step` metres apart
  const edge = (i0, i1, side, off, step = 2.6) => {
    const raw = [];
    for (let i = i0; i <= i1 + 1e-6; i += 0.5) raw.push(T(Math.min(i, i1), side * (hw(i) + off)));
    return resample(raw, step);
  };
  const resample = (raw, step) => {
    let total = 0;
    for (let k = 1; k < raw.length; k++) total += Math.hypot(raw[k][0] - raw[k - 1][0], raw[k][1] - raw[k - 1][1]);
    const n = Math.max(1, Math.round(total / step)), out = [raw[0]];
    let k = 1, acc = 0;
    for (let j = 1; j < n; j++) {
      const want = total * j / n;
      for (;;) {
        const l = Math.hypot(raw[k][0] - raw[k - 1][0], raw[k][1] - raw[k - 1][1]);
        if (acc + l >= want || k === raw.length - 1) { const f = l ? (want - acc) / l : 0; out.push([raw[k - 1][0] + (raw[k][0] - raw[k - 1][0]) * f, raw[k - 1][1] + (raw[k][1] - raw[k - 1][1]) * f]); break; }
        acc += l; k++;
      }
    }
    out.push(raw[raw.length - 1]);
    return out;
  };

  function build(zone) {
    const K = streetKit(world, group, { shadows });
    const { p } = K;
    const extra = [], glow = [], solids = [];
    const iron = { pos: [], uv: [] }, boards = { pos: [], uv: [] };
    const lit = rnd(57 + zone);
    const on = (chance = 0.2) => lit() < chance;
    const W = {};
    for (const k of ZONES[zone].keys) {
      const v = WALLS[k];
      let w = wallOf(v.a, v.b, v.top);
      const out = w.at(w.len / 2, 1.0), inn = w.at(w.len / 2, -1.0);
      if (world.sdfAt(out[0], out[1]) < world.sdfAt(inn[0], inn[1])) { console.warn('baeristreet: wall', k, 'faces inwards, turned'); w = wallOf(v.b, v.a, v.top); }
      w.y = Math.min(...[0.05, 0.5, 0.95].map((t) => h(...w.at(w.len * t, 0.7))));
      W[k] = w;
    }
    // a painted front on wall w from s0 to s1 (default: all of it), from 1.2 m under the ground line to the top
    const skin = (w, draw, { s0 = 0, s1 = w.len, y0 = -1.2, y1 = w.top - w.y, ppm = 26, off = 0.1 } = {}) => {
      const tex = facade(s1 - s0, y0, y1, ppm, draw);
      const [x, z] = w.at((s0 + s1) / 2, off);
      const g = new THREE.PlaneGeometry(s1 - s0 + 0.06, y1 - y0).rotateY(Math.atan2(w.nx, w.nz)).translate(x, w.y + (y0 + y1) / 2, z);
      extra.push([g, new THREE.MeshLambertMaterial({ map: tex })]);
    };
    const put = (w, geo, hex, s, y, n, yaw = w.yaw) => { const [x, z] = w.at(s, n); p.add(geo, hex, x, w.y + y, z, yaw); };
    const seg = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return { l, ux: dx / l, uz: dz / l, mx: (a[0] + b[0]) / 2, mz: (a[1] + b[1]) / 2, yaw: Math.atan2(-dz, dx) }; };
    const quad = (G, a, b, y0, hgt, u0, u1) => {
      const ya = h(a[0], a[1]) + y0, yb = h(b[0], b[1]) + y0;
      G.pos.push(a[0], ya, a[1], b[0], yb, b[1], a[0], ya + hgt, a[1], a[0], ya + hgt, a[1], b[0], yb, b[1], b[0], yb + hgt, b[1]);
      G.uv.push(u0, 0, u1, 0, u0, 1, u0, 1, u1, 0, u1, 1);
    };
    // evenly spaced window positions along a wall of length len
    const even = (len, n, w, m = 1.0) => Array.from({ length: n }, (_, k) => (n === 1 ? (len - w) / 2 : m + (len - 2 * m - w) * k / (n - 1)));
    const fit = (len, pitch, w, m = 1.0) => even(len, Math.max(1, Math.floor((len - 2 * m - w) / pitch) + 1), w, m);
    const weather = (P, a = 0.1) => { const g = P.c.createLinearGradient(0, 0, 0, P.c.canvas.height); g.addColorStop(0, `rgba(60,50,60,${a})`); g.addColorStop(0.35, 'rgba(60,50,60,0)'); g.addColorStop(1, `rgba(50,44,40,${a * 1.6})`); P.c.fillStyle = g; P.c.fillRect(0, 0, P.c.canvas.width, P.c.canvas.height); };
    // zinc mansard with standing seams from y up, with dormers at xs
    const mansard = (P, y, xs = [], { col = [138, 146, 160], dw = 1.3, dh = 1.5 } = {}) => {
      P.grad(0, y, P.w, P.y1, tone(col, 1.06), tone(col, 0.9));
      for (let x = 0.3; x < P.w; x += 0.55) P.r(x, y, x + 0.03, P.y1, tone(col, 0.78));
      P.r(0, y - 0.12, P.w, y + 0.14, '#ece8e2');
      for (const x of xs) { P.r(x - 0.18, y + 0.35, x + dw + 0.18, y + 0.5 + dh + 0.25, tone(col, 0.82)); P.win(x, y + 0.5, x + dw, y + 0.5 + dh, { bars: 1, rails: 1, lit: on(), sill: 0.06 }); }
    };
    // a wooden house front: boards over a stone base, windows in painted surrounds on each floor
    const wooden = (P, { rgb, trim = '#f6f2e8', sc = trim, floors = [1.5, 4.7], wh = 1.75, ww = 1.05, pitch = 2.5, xs = null, base = 0.7, eave = null, door = null, doorCol = '#7a5a48', seed = 3, bars = 1, rails = 2, glass = '#56667f' }) => {
      P.boards(0, base, P.w, P.y1, rgb);
      P.rubble(0, -1.2, P.w, base, seed);
      P.r(0, base, P.w, base + 0.14, tone(rgb, 0.78));
      for (const x of [0, P.w - 0.16]) P.r(x, base, x + 0.16, P.y1, trim);
      const cols = xs || fit(P.w, pitch, ww, 0.9);
      floors.forEach((y, f) => {
        for (const x of cols) {
          if (door && f === 0 && Math.abs(x + ww / 2 - door) < 1.1) continue;
          P.win(x, y, x + ww, y + wh, { frame: trim, sc, surround: 0.11, hood: 0.07, bars, rails, lit: on(), glass, fw: 0.06 });
        }
        if (f > 0) P.r(0, y - 0.75, P.w, y - 0.62, tone(rgb, 0.84));
      });
      if (door) { P.r(door - 0.68, base - 0.25, door + 0.68, base + 2.25, sc); P.r(door - 0.55, base - 0.25, door + 0.55, base + 2.12, doorCol); P.r(door - 0.03, base - 0.25, door + 0.03, base + 2.12, tone([60, 44, 36], 1)); P.r(door - 0.8, base - 0.4, door + 0.8, base - 0.25, '#9a948c'); }
      if (eave) { P.r(0, eave, P.w, eave + 0.2, trim); }
      weather(P, 0.07);
    };
    // a plastered front
    const plaster = (P, { col, trim = '#f1eee8', floors = [1.4, 4.5], wh = 1.7, ww = 1.1, pitch = 2.6, xs = null, base = 0.8, baseCol = '#8f8c92', door = null, doorCol = '#6f5446', bars = 1, rails = 1, cornice = null, glass = '#56667f', surround = 0.09 }) => {
      P.r(0, -1.2, P.w, P.y1, col);
      P.r(0, -1.2, P.w, base, baseCol);
      const cols = xs || fit(P.w, pitch, ww, 0.9);
      floors.forEach((y, f) => {
        for (const x of cols) {
          if (door && f === 0 && Math.abs(x + ww / 2 - door) < 1.1) continue;
          P.win(x, y, x + ww, y + wh, { frame: '#f6f3ee', sc: trim, surround, bars, rails, lit: on(), glass, fw: 0.06 });
        }
      });
      if (door) { P.r(door - 0.6, base - 0.5, door + 0.6, base + 1.9, doorCol); P.r(door - 0.03, base - 0.5, door + 0.03, base + 1.9, '#3f3028'); }
      if (cornice) P.r(0, cornice, P.w, cornice + 0.22, trim);
      weather(P, 0.1);
    };
    // posters pasted over each other
    const posters = (P, x0, y0, x1, y1, seed) => {
      const r = rnd(seed), cols = ['#e86a8a', '#f2c14e', '#5aa9e6', '#2f2c34', '#f4f1ea', '#7fc8a9', '#e8894a', '#b06ad0', '#d94f4f'];
      P.r(x0, y0, x1, y1, '#d9d4cc');
      for (let y = y1; y > y0 + 0.2; y -= 0.62) for (let x = x0 + 0.03; x < x1 - 0.2; ) {
        const w = Math.min(0.42 + r() * 0.2, x1 - x - 0.02), hh = Math.min(0.58, y - y0);
        P.r(x, y - hh, x + w, y - 0.03, cols[Math.floor(r() * cols.length)]);
        P.r(x + 0.05, y - hh * 0.6, x + w - 0.05, y - hh * 0.35, cols[Math.floor(r() * cols.length)]);
        x += w + 0.03;
      }
    };
    // spray paint: fat characters and tags
    const graffiti = (P, x0, x1, y0, y1, seed, n = 8) => {
      const r = rnd(seed), cols = ['#3f7fe0', '#e85a9a', '#f2c84e', '#5ac8b0', '#f4f1ea', '#e8703a', '#9a5ad0', '#2a2830'];
      for (let k = 0; k < n; k++) {
        const x = x0 + (x1 - x0) * (k + 0.2 + r() * 0.6) / n, y = y0 + (y1 - y0) * (0.25 + r() * 0.35), s = 0.35 + r() * 0.3, col = cols[Math.floor(r() * 6)];
        if (r() < 0.6) {                                      // a creature: body, eyes, outline
          P.arc(x, y, s * 1.12, '#2a2830'); P.arc(x, y, s, col);
          P.r(x - s, y0, x + s, y, col);
          P.arc(x - s * 0.35, y + s * 0.2, s * 0.24, '#f8f6f0'); P.arc(x + s * 0.35, y + s * 0.2, s * 0.24, '#f8f6f0');
          P.arc(x - s * 0.3, y + s * 0.18, s * 0.1, '#2a2830'); P.arc(x + s * 0.4, y + s * 0.18, s * 0.1, '#2a2830');
        } else {
          P.text(['TRT', 'ZAK', 'EDWARD', 'OK!', 'SÖÖT', 'MÜRA'][Math.floor(r() * 6)], x, y, s * 0.9, col, 'italic 900 %px "Arial Black", Impact, sans-serif', 'center', (r() - 0.5) * 0.3);
        }
      }
      for (let k = 0; k < n * 2; k++) P.text(['zx', 'ek', 'R1', '///', 'luv', 'TÜ'][Math.floor(r() * 6)], x0 + (x1 - x0) * r(), y0 + (y1 - y0) * r(), 0.22 + r() * 0.15, cols[Math.floor(r() * cols.length)], 'italic 700 %px Arial, sans-serif', 'center', (r() - 0.5) * 0.6);
    };

    // ---- fences, walls, stairs (none of them solid)
    // iron bars on a low concrete footing between square concrete posts with caps
    const ironFence = (pts, { height = 1.25, foot = 0.35, solid = false } = {}) => {
      for (let k = 0; k < pts.length; k++) {
        const q = pts[k], y = h(q[0], q[1]);
        p.add(BOX(0.36, height + 0.2, 0.36), COL.concrete, q[0], y + (height + 0.2) / 2, q[1], k < pts.length - 1 ? seg(q, pts[k + 1]).yaw : 0);
        p.add(BOX(0.46, 0.09, 0.46), 0xaaa69f, q[0], y + height + 0.24, q[1], 0);
        if (k === pts.length - 1) break;
        const S = seg(q, pts[k + 1]);
        p.add(BOX(S.l, foot, 0.2), 0x8a8680, S.mx, h(S.mx, S.mz) + foot / 2 - 0.02, S.mz, S.yaw);
        quad(iron, q, pts[k + 1], foot - 0.03, height - foot, 0, S.l / 0.5);
        if (solid) solids.push({ x: S.mx, z: S.mz, yaw: S.yaw, hx: S.l / 2 + 0.2, hz: 0.22 });
      }
    };
    // three rough rails on short posts
    const railFence = (pts, height = 0.95) => {
      for (let k = 0; k < pts.length; k++) {
        const q = pts[k];
        p.add(BOX(0.1, height + 0.05, 0.1), COL.wood, q[0], h(q[0], q[1]) + (height + 0.05) / 2, q[1], 0);
        if (k === pts.length - 1) break;
        const S = seg(q, pts[k + 1]), dy = h(pts[k + 1][0], pts[k + 1][1]) - h(q[0], q[1]);
        for (const y of [0.3, 0.6, 0.9]) p.add(BOX(Math.hypot(S.l, dy), 0.09, 0.035).rotateZ(Math.atan2(dy, S.l)), y === 0.6 ? COL.woodDark : COL.wood, S.mx, h(q[0], q[1]) + dy / 2 + y * height / 0.95, S.mz, S.yaw);
      }
    };
    const boardFence = (pts, height = 1.85) => {
      let run = 0;
      for (let k = 0; k < pts.length - 1; k++) {
        const S = seg(pts[k], pts[k + 1]);
        quad(boards, pts[k], pts[k + 1], -0.05, height, run / 2.4, (run + S.l) / 2.4);
        run += S.l;
      }
    };
    // a stair laid on the slope from a to b, with a handrail each side
    const stair = (a, b, width = 1.6, rails = true) => {
      const S = seg(a, b), n = Math.max(2, Math.round(S.l / 0.42));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        p.add(BOX(S.l / n + 0.04, 0.22, width), k % 2 ? COL.step : 0xa6a2a8, x, h(x, z) + 0.03, z, S.yaw);
      }
      if (!rails) return;
      for (const side of [-1, 1]) {
        const o = side * (width / 2 + 0.05), m = Math.max(2, Math.round(S.l / 1.8));
        for (let k = 0; k <= m; k++) {
          const t = k / m, x = a[0] + (b[0] - a[0]) * t - S.uz * o, z = a[1] + (b[1] - a[1]) * t + S.ux * o, y = h(x, z);
          p.add(BOX(0.05, 0.95, 0.05), 0x8f939c, x, y + 0.47, z, 0);
          if (k === m) break;
          const t2 = (k + 1) / m, x2 = a[0] + (b[0] - a[0]) * t2 - S.uz * o, z2 = a[1] + (b[1] - a[1]) * t2 + S.ux * o, dy = h(x2, z2) - y, l = S.l / m;
          for (const yy of [0.92, 0.5]) p.add(BOX(Math.hypot(l, dy), 0.05, 0.05).rotateZ(Math.atan2(dy, l)), 0x8f939c, (x + x2) / 2, y + dy / 2 + yy, (z + z2) / 2, S.yaw);
        }
      }
    };
    const hedge = (pts, width = 1.1, height = 1.2) => {
      for (let k = 0; k < pts.length; k++) K.shrub(pts[k][0], pts[k][1], width / 2 + 0.1, COL.hedge[k % 3], height / (width / 2 + 0.1) / 1.9);
    };
    // an old lantern on a scrolled iron bracket, s along wall w, y above its ground
    const bracketLantern = (w, s, y) => {
      put(w, BOX(0.06, 0.06, 0.85), COL.iron, s, y, 0.45);
      put(w, BOX(0.05, 0.5, 0.05), COL.iron, s, y - 0.25, 0.08);
      put(w, BOX(0.04, 0.04, 0.6).rotateX(0.7), COL.iron, s, y - 0.22, 0.3);
      const [x, z] = w.at(s, 0.85);
      p.add(new THREE.CylinderGeometry(0.2, 0.12, 0.42, 6), 0xf2ead2, x, w.y + y + 0.3, z, 0);
      p.add(new THREE.ConeGeometry(0.27, 0.2, 6), COL.iron, x, w.y + y + 0.61, z, 0);
      p.add(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 5), COL.iron, x, w.y + y + 0.76, z, 0);
      glow.push(new THREE.SphereGeometry(0.11, 8, 6).translate(x, w.y + y + 0.3, z));
    };

    // ---- the road surface (lat > 0 to the right of the lap)
    const F = { at: (t, lat) => T(t, lat) };
    const paint = { gutter: [], kerb: [], white: [], red: [] };
    // a band along the road between lateral offsets a(i) and b(i)
    const band = (list, i0, i1, a, b, step = 1) => {
      for (let i = i0; i < i1 - 1e-6; i += step) {
        const j = Math.min(i1, i + step);
        list.push([[T(i, a(i)), T(j, a(j)), T(j, b(j)), T(i, b(i))]]);
      }
    };
    const pave = (i0, i1, a, b, kind = 'paver') => { for (let i = i0; i < i1; i++) K.ribbon(F, i, i + 1, (a(i) + a(i + 1)) / 2, (b(i) + b(i + 1)) / 2, kind); };
    // a see-through pastel lane on the ground along a line of [x, z] points: fades in and out over `fade`
    // metres at the ends and over the outer 0.25 m at the sides, so it lies on the paving like paint
    const soft = { paint: [], brick: [], grass: [] };
    const softLane = (line, half, fade = 4, list = soft.paint, edge = 0.25) => {
      const pts = [];                                            // resampled every 0.6 m
      for (let k = 0; k < line.length - 1; k++) {
        const [ax, az] = line[k], [bx, bz] = line[k + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.6));
        for (let q = 0; q < n; q++) pts.push([ax + (bx - ax) * q / n, az + (bz - az) * q / n]);
      }
      pts.push(line[line.length - 1]);
      let len = 0; const at = pts.map((p0, k) => (len += k ? Math.hypot(p0[0] - pts[k - 1][0], p0[1] - pts[k - 1][1]) : 0));
      const ease = (u) => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
      const across = [[-half, 0], [-half + edge, 1], [half - edge, 1], [half, 0]];
      const rows = pts.map((p0, k) => {
        const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
        let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        const e = ease(at[k] / fade) * ease((len - at[k]) / fade);
        // [x, y, z, alpha, u, v]: u along the lane, v across it, so the brick courses follow the path
        return across.map(([o, w]) => { const x = p0[0] - dz * o, z = p0[1] + dx * o; return [x, h(x, z) + 0.09, z, w * e, at[k] / 1.6, (o + half) / 1.6]; });
      });
      for (let k = 0; k < rows.length - 1; k++) for (let c = 0; c < 3; c++) {
        const A = rows[k][c], B = rows[k][c + 1], C = rows[k + 1][c + 1], D = rows[k + 1][c];
        list.push(A, B, C, A, C, D);
      }
    };
    const zebra = (i, bars = 6) => {
      const w = hw(i) * 2 - 0.6;
      for (let k = 0; k < bars; k++) { const lat = -w / 2 + (w - 0.5) * k / (bars - 1); band(paint.white, i - 1.0, i + 1.0, () => lat, () => lat + 0.5, 2); }
    };
    if (zone === 0) buildValli();
    if (zone === 1) buildToome();
    if (zone === 2) buildJakobi();

    // ============================================================ upper Vallikraavi
    function buildValli() {
      // ---- the houses without photos: quiet guessed fronts
      skin(W.S60, (P) => plaster(P, { col: '#e6d9b8', floors: [1.6, 4.6], pitch: 2.9, door: 17.5, cornice: P.y1 - 0.5, baseCol: '#9a948e' }));
      skin(W.S60e, (P) => plaster(P, { col: '#e6d9b8', floors: [4.6], xs: [P.w / 2 - 0.55], cornice: P.y1 - 0.5, baseCol: '#9a948e' }));
      skin(W.S60w, (P) => plaster(P, { col: '#e6d9b8', floors: [1.6, 4.6], pitch: 3.4, baseCol: '#9a948e' }));
      skin(W.N64, (P) => plaster(P, { col: '#c9d0dc', floors: [1.5, 4.7], pitch: 2.7, door: 5.2, cornice: P.y1 - 0.45 }));
      skin(W.N97, (P) => wooden(P, { rgb: [178, 192, 170], floors: [1.6, 4.9], pitch: 2.6, door: 8.4, eave: 8.2, seed: 5 }));
      skin(W.N97e, (P) => wooden(P, { rgb: [178, 192, 170], floors: [1.6], xs: [P.w / 2 - 0.5], seed: 6 }));
      skin(W.N97w, (P) => wooden(P, { rgb: [178, 192, 170], floors: [1.6, 4.9], pitch: 3.6, seed: 7 }));
      skin(W.N75, (P) => wooden(P, { rgb: [234, 222, 196], floors: [1.5, 4.8], pitch: 2.8, eave: 7.6, seed: 8, sc: '#b98a5a' }));
      skin(W.N75e, (P) => wooden(P, { rgb: [234, 222, 196], floors: [1.5, 4.8], pitch: 3.2, seed: 9, sc: '#b98a5a', door: 6 }));
      skin(W.N75w, (P) => wooden(P, { rgb: [234, 222, 196], floors: [1.5, 4.8], pitch: 3.6, seed: 10, sc: '#b98a5a' }));
      const white = (P, o = {}) => { plaster(P, { col: '#e9e6ee', trim: '#d4d0dc', floors: [1.3, 4.3, 7.3], wh: 1.6, ww: 1.5, pitch: 3.1, bars: 2, rails: 0, baseCol: '#8e8c98', glass: '#4f5d78', ...o }); P.r(0, P.y1 - 0.3, P.w, P.y1, '#b9b6c2'); };
      skin(W.S33a, (P) => white(P, { xs: [P.w / 2 - 0.75] }));
      skin(W.S33b, (P) => white(P, { door: 7.5 }));
      skin(W.S33c, (P) => white(P));
      skin(W.S33d, (P) => white(P, { floors: [1.3, 4.3, 7.3, 10.3] }));
      skin(W.S33e, (P) => white(P, { pitch: 3.6 }));
      skin(W.S33f, (P) => white(P, { xs: [P.w / 2 - 0.75] }));
      skin(W.S33w, (P) => white(P, { xs: [P.w / 2 - 0.75] }));
      skin(W.N18, (P) => { P.boards(0, -1.2, P.w, P.y1, [170, 158, 148], 0.2); for (const x of [1.2, 5.2, 9.4]) { P.r(x, 0, x + 2.6, 2.3, '#7d7068'); for (let q = 0.4; q < 2.6; q += 0.45) P.r(x + q, 0, x + q + 0.03, 2.3, '#665a54'); } weather(P, 0.12); });
      skin(W.N18e, (P) => wooden(P, { rgb: [170, 158, 148], floors: [1.5, 4.4], pitch: 3.0, seed: 12 }));

      // ---- the yellow wooden house: cream boards, tall windows in ochre surrounds
      const YEL = { rgb: [232, 218, 160], sc: '#c9933f', trim: '#f6f0dc', floors: [1.7, 5.3], wh: 2.1, ww: 1.15, base: 0.8, rails: 2 };
      const yellow = (P, o = {}) => {
        wooden(P, { ...YEL, ...o });
        P.r(0, 4.35, P.w, 4.55, '#c9933f');                                   // the band between the floors
        P.r(0, 8.5, P.w, 8.75, '#f6f0dc');
        P.boards(0, 8.75, P.w, P.y1, [222, 208, 150], 0.14);
      };
      skin(W.Y1, (P) => yellow(P, { xs: [1.2, 4.4, 7.6], seed: 14 }));
      skin(W.Y2, (P) => yellow(P, { xs: [1.0, 4.6], seed: 15, door: 3.4, doorCol: '#8a5a34' }));
      skin(W.Y3, (P) => { yellow(P, { xs: [2.2, 6.4, 10.6], seed: 16 }); P.win(P.w / 2 - 0.55, 9.3, P.w / 2 + 0.55, 10.7, { frame: '#f6f0dc', sc: '#c9933f', surround: 0.1, bars: 1, rails: 1 }); });
      skin(W.Y4, (P) => { yellow(P, { xs: [2.0, 5.9, 9.8], seed: 17 }); P.win(P.w / 2 - 0.55, 9.3, P.w / 2 + 0.55, 10.7, { frame: '#f6f0dc', sc: '#c9933f', surround: 0.1, bars: 1, rails: 1 }); });

      // ---- the terraced flats: red-brown brick, grey concrete floor bands, ribbon windows in red frames,
      // brown board panels, wooden balcony rails with flower boxes, the set-back top floor behind a rail
      const FB = [176, 96, 74];
      const flats = (P, seed, { door = null, balc = [] } = {}) => {
        const r = rnd(seed);
        P.brick(0, -1.2, P.w, P.y1, FB, seed);
        const top = P.y1 - 3.0;
        for (let f = 0, y = 0.2; y < top - 1; f++, y += 3.05) {
          // the ribbon: glass in red frames alternating with board panels
          for (let x = 0.4; x < P.w - 0.5; ) {
            const w = Math.min(P.w - 0.4 - x, 2.6 + r() * 1.2);
            if (r() < 0.3) { P.boards(x, y + 0.75, x + w, y + 2.65, [156, 104, 66], 0.12); }
            else {
              P.r(x, y + 0.75, x + w, y + 2.65, '#8e4636');
              const n = Math.max(1, Math.round(w / 0.95));
              for (let q = 0; q < n; q++) { const xa = x + 0.07 + (w - 0.07) * q / n, xb = x + (w - 0.07) * (q + 1) / n; if (on(0.18)) P.grad(xa, y + 0.84, xb, y + 2.56, '#fff0c4', '#f0cf96'); else P.grad(xa, y + 0.84, xb, y + 2.56, '#6f8496', '#46566a'); }
            }
            x += w + 0.25 + r() * 0.5;
          }
          P.r(0, y + 2.75, P.w, y + 3.1, '#b4b1b0');                           // the concrete band
          P.r(0, y + 2.72, P.w, y + 2.77, '#8f8c8c');
        }
        for (const [x0, x1, f] of balc) {                                     // balconies: slatted wooden rails, flowers
          const y = 0.2 + f * 3.05;
          P.r(x0, y - 0.1, x1, y + 0.02, '#a9a6a6');
          P.r(x0, y, x1, y + 1.0, '#9a5a3c');
          for (let q = y + 0.12; q < y + 1.0; q += 0.17) P.r(x0, q, x1, q + 0.04, '#6f3f2a');
          for (let x = x0 + 0.2; x < x1 - 0.2; x += 0.22) P.arc(x, y + 1.06 + r() * 0.08, 0.09, r() < 0.5 ? '#e8556a' : '#f08aa0');
          P.r(x0, y + 0.98, x1, y + 1.03, '#4f7a4a');
        }
        // the top floor stands back: glass and boards behind a thin rail, a grey roof edge
        P.r(0, top, P.w, P.y1, '#5f5a62');
        for (let x = 0.6; x < P.w - 1.4; x += 2.3) P.grad(x, top + 0.5, x + 1.9, top + 2.4, on(0.2) ? '#fff0c4' : '#7b8fa2', '#4a5a6e');
        P.r(0, top - 0.05, P.w, top + 0.2, '#b4b1b0');
        for (let x = 0; x < P.w; x += 0.14) P.r(x, top + 0.2, x + 0.03, top + 1.15, '#3a383e');
        P.r(0, top + 1.12, P.w, top + 1.18, '#3a383e');
        P.r(0, P.y1 - 0.3, P.w, P.y1, '#8c8a90');
        if (door !== null) { P.r(door - 1.0, -0.4, door + 1.0, 2.5, '#3c3438'); P.win(door - 0.8, -0.3, door + 0.8, 2.3, { frame: '#8e4636', glass: '#7a8fa0', bars: 1, sill: 0, lit: 1 }); P.r(door - 1.4, 2.5, door + 1.4, 2.7, '#b4b1b0'); }
      };
      skin(W.K1, (P) => flats(P, 31, { door: 6.5, balc: [[1.0, 6.0, 1], [9.5, 15.5, 2], [17.5, 23.6, 1]] }), { ppm: 30 });
      skin(W.K2, (P) => flats(P, 32, { balc: [[1.2, 7.8, 1], [1.2, 7.8, 2]] }), { ppm: 30 });
      skin(W.K3, (P) => flats(P, 33, { balc: [[2.0, 8.0, 2]] }));
      skin(W.K4, (P) => flats(P, 34, { balc: [[3.0, 9.0, 1], [10.0, 17.0, 2]] }));
      put(W.K1, BOX(1.3, 3.2, 1.1), 0xa9a6a6, 15, W.K1.top - W.K1.y + 1.0, -3.5);                         // the chimney block on the roof
      // number plate by the door
      // ---- the red brick villa: stone base, three floors of tall windows under brick arches, zinc mansard
      const VB = [202, 118, 98];
      const villa = (P, seed, { xs, door = null }) => {
        const m = P.y1 - 2.9;
        P.brick(0, 1.1, P.w, m, VB, seed);
        P.rubble(0, -1.2, P.w, 1.1, seed + 3);
        P.r(0, 1.05, P.w, 1.25, '#cfc6ba');
        for (const y of [4.55, 7.95]) { P.r(0, y, P.w, y + 0.16, tone(VB, 0.72)); P.r(0, y + 0.16, P.w, y + 0.24, tone(VB, 1.15)); }
        for (const x of [0, P.w - 0.5]) { P.r(x, 1.25, x + 0.5, m, tone(VB, 0.88)); }
        [1.9, 5.3, 8.6].forEach((y, f) => {
          for (const x of xs) {
            if (door !== null && f === 0 && Math.abs(x + 0.55 - door) < 1.2) continue;
            const hh = f === 2 ? 1.75 : 2.05;
            P.r(x - 0.14, y - 0.05, x + 1.24, y + hh + 0.28, tone(VB, 0.74));                              // the arch and jambs in darker brick
            P.arc(x + 0.55, y + hh, 0.69, tone(VB, 0.74), Math.PI, Math.PI * 2);
            P.win(x, y, x + 1.1, y + hh, { frame: '#f3efe6', bars: 1, rails: 2, lit: on(), sill: 0.1, sc: '#d9d0c4', fw: 0.06 });
          }
        });
        if (door !== null) {                                                  // the door under its flat canopy
          P.r(door - 0.75, 0.2, door + 0.75, 3.1, '#5a3d34'); P.r(door - 0.6, 0.2, door + 0.6, 2.6, '#7d5646'); P.r(door - 0.03, 0.2, door + 0.03, 2.6, '#3f2a24');
          P.grad(door - 0.6, 2.65, door + 0.6, 3.05, '#8fa3b4', '#5d6f84');
          P.r(door - 1.3, 3.15, door + 1.3, 3.32, '#4a4650');
          P.r(door - 1.0, 0, door + 1.0, 0.22, '#b9b2a8');
        }
        P.r(0, m - 0.35, P.w, m, '#e6ded2');                                   // the cornice
        mansard(P, m, xs.filter((_, k) => k % 2 === 0).map((x) => x - 0.1));
      };
      skin(W.R1, (P) => villa(P, 41, { xs: [1.3, 4.1, 6.9, 9.7, 12.5, 14.4].slice(0, 5), door: 7.45 }), { ppm: 30 });
      skin(W.R2, (P) => villa(P, 42, { xs: [1.2, 3.6, 6.0] }), { ppm: 30 });
      skin(W.R3, (P) => villa(P, 43, { xs: [1.6] }));
      skin(W.R4, (P) => villa(P, 44, { xs: [0.9, 3.0] }));
      skin(W.R5, (P) => villa(P, 45, { xs: [1.4, 4.4, 7.4, 10.4] }));
      { const w = W.R1; put(w, BOX(2.8, 0.14, 1.3), 0x4a4650, 7.45, 3.25, 0.65); for (let k = 0; k < 3; k++) put(w, BOX(2.4 - k * 0.2, 0.17, 0.34), 0xb9b2a8, 7.45, 0.08 + k * 0.17 - 0.3, 1.1 - k * 0.34); }

      // ---- along the street
      // the granite wall with its iron rail before the flats, and the hedge behind the pavement
      {
        const pts = edge(199, 206.5, -1, 2.5, 2.2);
        for (let k = 0; k < pts.length - 1; k++) {
          const S = seg(pts[k], pts[k + 1]), y = Math.max(h(pts[k][0], pts[k][1]), h(pts[k + 1][0], pts[k + 1][1]));
          p.add(BOX(S.l + 0.02, 1.25, 0.4), COL.granite, S.mx, y + 0.35, S.mz, S.yaw);
          p.add(BOX(S.l + 0.06, 0.08, 0.5), COL.graniteTop, S.mx, y + 1.0, S.mz, S.yaw);
          quad(iron, pts[k], pts[k + 1], 1.0 + (y - h(pts[k][0], pts[k][1])), 0.75, 0, S.l / 0.5);
        }
        const q = pts[pts.length - 1];
        p.add(BOX(0.6, 1.9, 0.6), COL.granite, q[0], h(q[0], q[1]) + 0.75, q[1], seg(pts[pts.length - 2], q).yaw);
        hedge(edge(208.5, 221, -1, 3.4, 0.95), 1.2, 1.25);
        K.box(...T(207.6, -(hw(207) + 2.6)), 0.9, 1.25, 0.4, 0x8f9498, seg(T(207, -5), T(208, -5)).yaw);     // the electrical cabinet
      }
      // the rail fence along the yard between the flats and the villa
      railFence(edge(222.5, 229.5, -1, 2.3, 2.0));
      // shrubs by the no-entry sign where the path climbs the hill
      for (const [i, o] of [[214, 2.6], [215, 3.2], [216, 2.4]]) K.shrub(...T(i, hw(i) + o), 0.9, COL.hedge[i % 3], 0.9);
      // the old iron fence on concrete posts round the bend and on towards Baeri
      // solid, and back in the grass behind a verge as in the street view (Martin, 19 Nov)
      ironFence(edge(FENCE.i0, FENCE.i1, -1, FENCE.off, 2.7), { solid: true });
      for (let i = FENCE.i0; i < FENCE.i1; i++) K.ribbon(F, i, i + 1, -(hw(i) + 2.4), -(hw(i) + 4.6), 'lawn');
      // the stone terraces in the hollow: rows of old steps on the slope
      {
        const c = [1086, 3123], e = 2;
        let gx = h(c[0] + e, c[1]) - h(c[0] - e, c[1]), gz = h(c[0], c[1] + e) - h(c[0], c[1] - e);
        const gl = Math.hypot(gx, gz) || 1;
        gx /= gl; gz /= gl;                                                   // uphill
        const yaw = Math.atan2(gx, gz);                                       // rows run across the slope
        for (let k = -4; k <= 4; k++) {
          const x = c[0] + gx * k * 1.15, z = c[1] + gz * k * 1.15;
          p.add(BOX(15 - Math.abs(k) * 0.4, 0.5, 1.15), k % 2 ? COL.stone : COL.stoneDark, x, h(x, z) + 0.12, z, yaw);
        }
      }
      // the stair with handrails up the bank on the right, to the path under the trees
      stair(T(266.5, hw(266) + 2.2), T(268.5, hw(268) + 8.5), 1.5);
      // the road: strips of round cobbles along both kerbs, granite kerbstones, herringbone pavements
      for (const side of [-1, 1]) {
        band(paint.gutter, 131, 289, (i) => side * (hw(i) - 0.85), (i) => side * (hw(i) + 0.02));
        band(paint.kerb, 131, 289, (i) => side * (hw(i) + 0.02), (i) => side * (hw(i) + 0.2));
      }
      pave(199, 287, (i) => -(hw(i) + 0.2), (i) => -(hw(i) + 2.4));
      pave(205, 290, (i) => hw(i) + 0.2, (i) => hw(i) + 2.0);
    }

    // ============================================================ Baeri under Toomemägi
    function buildToome() {
      // the long outbuilding: stained plaster, brown windows, a boarded door, spray paint all along
      const OUT = '#e2dccc';
      skin(W.O1, (P) => {
        P.r(0, -1.2, P.w, P.y1, OUT);
        P.r(0, -1.2, P.w, 0.35, '#b9b2a4');
        for (const x of [6.4, 9.6, 12.6, 15.4, 18.4]) P.win(x, 1.0, x + 1.05, 2.5, { frame: '#7a5444', glass: '#4a5462', bars: 1, rails: 2, sill: 0.08, sc: '#7a5444', fw: 0.07 });
        P.r(2.0, 0.1, 3.1, 2.3, '#6f4c3e'); P.r(2.1, 1.5, 3.0, 2.2, '#3a3438');                           // the door with its broken top
        P.r(4.6, 2.45, 5.9, 3.2, '#e8703a'); P.text('SD Vision', 5.25, 2.95, 0.2, '#f6f0e6'); P.text('TULES SIIA!', 5.25, 2.65, 0.13, '#f6f0e6');
        graffiti(P, 0.4, P.w - 0.3, 0.1, 2.3, 71, 11);
        P.r(0, P.y1 - 0.22, P.w, P.y1, '#8c9099');
        weather(P, 0.16);
      }, { ppm: 36 });
      skin(W.O2, (P) => { P.r(0, -1.2, P.w, P.y1, OUT); P.r(0, -1.2, P.w, 0.35, '#b9b2a4'); P.win(3.4, 1.0, 4.5, 2.5, { frame: '#7a5444', glass: '#4a5462', bars: 1, rails: 2, sc: '#7a5444' }); graffiti(P, 0.3, P.w - 0.3, 0.1, 2.3, 72, 5); P.r(0, P.y1 - 0.22, P.w, P.y1, '#8c9099'); weather(P, 0.16); }, { ppm: 36 });
      skin(W.O3, (P) => { P.r(0, -1.2, P.w, P.y1, OUT); P.r(0, -1.2, P.w, 0.35, '#b9b2a4'); graffiti(P, 0.3, P.w - 0.3, 0.1, 2.4, 73, 5); P.r(0, P.y1 - 0.22, P.w, P.y1, '#8c9099'); weather(P, 0.16); }, { ppm: 36 });
      // two brick chimneys on its roof
      for (const s of [4.5, 15.5]) put(W.O1, BOX(0.6, 1.7, 0.6), 0xb0705e, s, W.O1.top - W.O1.y + 1.3, -3.6);
      // the stair with handrails from the street up to Hezeli, on the left before the bend
      stair(T(403, -(hw(403) + 3.0)), T(403.5, -(hw(403) + 12.5)), 1.8);
      // the stair on the right bank near the junction
      stair(T(331, hw(331) + 4.0), T(333, hw(333) + 10.5), 1.6);
      // the road: the crossing by the lanterns, the paved pavement with its granite kerb on the left
      zebra(322);
      pave(292, 330, (i) => -(hw(i) + 0.2), (i) => -(hw(i) + 2.3));
      band(paint.kerb, 292, 330, (i) => -(hw(i) + 0.02), (i) => -(hw(i) + 0.2));
    }

    // ============================================================ Baeri down to Jakobi
    function buildJakobi() {
      // ---- left: the green wooden corner house
      const GRN = { rgb: [158, 176, 126], trim: '#f4f1e6', floors: [1.25], wh: 1.5, ww: 1.1, base: 0.5, rails: 1, bars: 2 };
      skin(W.G1, (P) => { wooden(P, { ...GRN, xs: [1.5, 4.3, 12.2, 15.0, 17.6], door: 8.6, doorCol: '#5f7a52', seed: 81 }); P.r(0, P.y1 - 0.25, P.w, P.y1, '#b4b8c0'); });
      skin(W.G2, (P) => {
        wooden(P, { ...GRN, xs: [2.0, 8.4], seed: 82 });
        P.win(P.w / 2 - 0.9, 4.6, P.w / 2 + 0.9, 6.1, { frame: '#f4f1e6', sc: '#f4f1e6', surround: 0.1, bars: 2, rails: 1, lit: on(0.4) });      // the gable window
        P.r(0, 3.7, P.w, 3.85, tone(GRN.rgb, 0.8));
      });
      // the grey plastered house: a door under a small tin canopy
      skin(W.P1, (P) => { plaster(P, { col: '#b6bcc8', trim: '#c9ced8', floors: [1.5, 4.8], wh: 1.8, pitch: 2.2, door: 2.2, doorCol: '#e6e2dc', cornice: 7.4, baseCol: '#8c9098' }); P.r(1.2, 3.05, 3.2, 3.25, '#7fae9a'); P.r(0, 7.6, P.w, P.y1, '#b6bcc8'); });
      skin(W.P2, (P) => plaster(P, { col: '#b6bcc8', trim: '#c9ced8', floors: [1.5, 4.8], wh: 1.8, pitch: 4.2, baseCol: '#8c9098' }));
      // the blue wooden house
      skin(W.B1, (P) => { wooden(P, { rgb: [128, 150, 184], floors: [1.6, 4.9], wh: 1.8, pitch: 2.4, door: 10.6, doorCol: '#8a5a3c', eave: 7.5, seed: 84 }); P.win(P.w / 2 - 0.9, 8.6, P.w / 2 + 0.9, 10.2, { frame: '#f6f2e8', sc: '#f6f2e8', surround: 0.1, bars: 2, rails: 1, lit: on(0.4) }); });
      skin(W.B2, (P) => wooden(P, { rgb: [128, 150, 184], floors: [1.6, 4.9], wh: 1.8, pitch: 3.6, seed: 85 }));
      // the yellow wooden house
      const YW = { rgb: [234, 216, 156], floors: [1.5, 4.7], wh: 1.75, seed: 86 };
      skin(W.J1, (P) => wooden(P, { ...YW, pitch: 2.35, door: 12.9, doorCol: '#9a6a44', eave: 7.3 }));
      skin(W.J2, (P) => wooden(P, { ...YW, pitch: 3.8, seed: 87 }));
      skin(W.J3, (P) => wooden(P, { ...YW, pitch: 3.4, seed: 88 }));
      // the tall board fence between the yellow house and the grey one
      boardFence(edge(588, 599.5, -1, 1.7, 2.4));
      // the grey house: rusticated arched doorway with a fanlight, three floors, zinc mansard with dormers
      const GH = '#cfccd2';
      skin(W.A1, (P) => {
        const m = P.y1 - 3.0;
        plaster(P, { col: GH, trim: '#e2dfe4', floors: [1.7, 5.0, 8.2], wh: 1.85, ww: 1.2, pitch: 2.75, door: 0, cornice: m - 0.3, baseCol: '#a9a5a8', bars: 1, rails: 2 });
        P.r(0, 4.2, P.w, 4.38, '#e2dfe4');
        // the doorway
        const d = 7.35;
        P.r(d - 1.25, -0.2, d + 1.25, 3.3, GH);
        for (let y = -0.1; y < 3.2; y += 0.42) { P.r(d - 1.2, y, d - 0.72, y + 0.36, '#e6e3e6'); P.r(d + 0.72, y, d + 1.2, y + 0.36, '#e6e3e6'); }
        P.arc(d, 2.5, 1.12, '#e6e3e6', Math.PI, Math.PI * 2);
        P.arc(d, 2.5, 0.74, '#56667f', Math.PI, Math.PI * 2);
        for (const a of [-0.5, 0, 0.5]) P.text('|', d + a * 0.9, 2.82, 0.5, '#e6e3e6', '400 %px Arial', 'center', a);
        P.r(d - 0.72, 0.0, d + 0.72, 2.5, '#7d4f48'); P.r(d - 0.03, 0, d + 0.03, 2.5, '#4f2f2c');
        for (const x of [d - 0.55, d + 0.12]) { P.r(x, 0.3, x + 0.43, 1.0, '#6a403a'); P.r(x, 1.3, x + 0.43, 2.3, '#6a403a'); }
        P.r(d - 1.5, 3.3, d + 1.5, 3.5, '#e2dfe4');
        P.r(d - 1.1, -0.45, d + 1.1, -0.2, '#b4b0b0');
        mansard(P, m, [2.0, 6.6, 11.2, 15.8, 20.4]);
      }, { ppm: 30 });
      skin(W.A2, (P) => { const m = P.y1 - 1.4; plaster(P, { col: GH, trim: '#e2dfe4', floors: [1.9, 5.6], wh: 1.4, ww: 1.3, xs: [2.2, 8.0], cornice: m - 0.25, baseCol: '#a9a5a8', bars: 1, rails: 1 }); mansard(P, m, []); for (let k = 0; k < 40; k++) P.arc(P.w - 0.6 + Math.sin(k * 7) * 0.5, 0.3 + k * 0.16, 0.28, k % 2 ? '#4f8a56' : '#5f9a62'); });
      skin(W.A3, (P) => { const m = P.y1 - 1.4; plaster(P, { col: GH, trim: '#e2dfe4', floors: [1.7, 5.0, 8.2], wh: 1.85, ww: 1.2, pitch: 3.0, cornice: m - 0.3, baseCol: '#a9a5a8', rails: 2 }); mansard(P, m, []); });
      put(W.A1, BOX(2.0, 0.2, 0.9), 0xb4b0b0, 7.35, -0.1, 0.5); put(W.A1, BOX(1.6, 0.2, 0.5), 0xbcb8b8, 7.35, 0.1, 0.3);

      // ---- right: the long brick warehouse
      const WB = [200, 112, 92];
      const boarded = (P, x, y, w, hh, seed, poster = false) => { P.r(x - 0.08, y - 0.08, x + w + 0.08, y + hh + 0.12, tone(WB, 0.7)); P.r(x, y, x + w, y + hh, '#b9b4ae'); if (poster) posters(P, x + 0.05, y + 0.05, x + w - 0.05, y + hh - 0.05, seed); else { P.r(x, y + hh * 0.5, x + w, y + hh * 0.52, '#9a958f'); } };
      skin(W.W1, (P) => {
        P.brick(0, 1.0, P.w, P.y1, WB, 91);
        P.rubble(0, -1.2, P.w, 1.0, 92);
        P.r(0, 0.95, P.w, 1.12, tone(WB, 0.72));
        P.r(0, 4.3, P.w, 4.5, tone(WB, 0.72)); P.r(0, 4.5, P.w, 4.58, tone(WB, 1.14));
        for (let x = 0; x < P.w; x += 3.9) P.r(x, 1.12, x + 0.42, P.y1 - 0.4, tone(WB, 0.86));            // pilasters
        P.r(0, P.y1 - 0.45, P.w, P.y1, tone(WB, 0.74));
        let k = 0;
        for (let x = 1.35; x + 1.0 < P.w; x += 3.9, k++) {
          boarded(P, x + 0.4, 5.1, 1.0, 1.7, 93 + k, k % 3 === 1);
          if (k % 2 === 0) P.win(x + 0.5, 1.9, x + 1.3, 3.5, { frame: '#5a3a34', glass: '#3f4654', bars: 1, rails: 2, sill: 0.08, sc: tone(WB, 0.7), surround: 0.07 });
          else boarded(P, x + 0.4, 1.9, 1.0, 1.6, 120 + k, k % 4 === 1);
        }
        graffiti(P, P.w - 9, P.w - 0.5, 1.1, 2.6, 95, 3);
        weather(P, 0.1);
      }, { ppm: 28 });
      skin(W.W2, (P) => {
        P.brick(0, 1.0, P.w, P.y1, WB, 96);
        P.rubble(0, -1.2, P.w, 1.0, 97);
        P.r(0, 4.3, P.w, 4.5, tone(WB, 0.72));
        boarded(P, 2.6, 5.0, 1.4, 2.1, 98); boarded(P, 2.6, 7.6, 1.2, 1.4, 99);
        boarded(P, 1.0, 1.3, 1.5, 2.3, 100, true); boarded(P, 3.4, 1.3, 1.5, 2.3, 101, true);
        graffiti(P, 0.3, P.w - 0.3, 1.1, 2.2, 102, 2);
        weather(P, 0.1);
      }, { ppm: 32 });
      bracketLantern(W.W1, 4.5, 3.9); bracketLantern(W.W1, 19.5, 3.9);
      // the old stone block lying by the gable
      { const [x, z] = W.W2.at(W.W2.len + 3.5, 1.5); K.box(x, z, 3.4, 0.7, 1.0, COL.stone, W.W2.yaw + 0.2, -0.1); K.box(x + 0.3, z + 0.2, 3.0, 0.12, 0.9, 0x7f9a70, W.W2.yaw + 0.2, 0.58); }
      // the second brick house, in use: framed windows, a door, bracket lanterns
      const second = (P, seed, xs, door = null) => {
        P.brick(0, 0.5, P.w, P.y1, WB, seed);
        P.rubble(0, -1.2, P.w, 0.5, seed + 1);
        P.r(0, 4.6, P.w, 4.78, tone(WB, 0.72));
        P.r(0, P.y1 - 0.4, P.w, P.y1, tone(WB, 0.74));
        for (const x of xs) {
          if (door === null || Math.abs(x + 0.5 - door) > 1.2) P.win(x, 1.5, x + 1.0, 3.5, { frame: '#f1ede4', glass: '#4a5668', bars: 1, rails: 2, sill: 0.1, sc: tone(WB, 0.7), surround: 0.08, lit: on(0.3) });
          P.win(x, 5.4, x + 1.0, 7.1, { frame: '#f1ede4', glass: '#4a5668', bars: 1, rails: 1, sill: 0.1, sc: tone(WB, 0.7), surround: 0.08, lit: on(0.3) });
        }
        if (door !== null) { P.r(door - 0.65, 0.1, door + 0.65, 2.6, tone(WB, 0.7)); P.r(door - 0.55, 0.1, door + 0.55, 2.5, '#5d6f8c'); P.r(door - 0.03, 0.1, door + 0.03, 2.5, '#2f3644'); }
        weather(P, 0.08);
      };
      skin(W.X1, (P) => second(P, 104, [1.2, 3.9, 6.6, 9.3, 12.0], 6.9));
      skin(W.X2, (P) => second(P, 106, [2.2]));
      skin(W.X3, (P) => second(P, 108, [1.4, 5.4]));
      bracketLantern(W.X1, 3.0, 4.0); bracketLantern(W.X1, 11.0, 4.0);
      skin(W.U1, (P) => second(P, 110, fit(P.w, 3.2, 1.0, 1.4)));

      // ---- the street: the poster column on the paved corner, the stair up the hill, the lantern's bin
      {
        const [x, z] = T(541, -(hw(541) + 5.2)), y = h(x, z);
        const g = new THREE.CylinderGeometry(0.72, 0.72, 2.9, 20, 1, true).translate(x, y + 1.45, z);
        extra.push([g, new THREE.MeshLambertMaterial({ map: posterTex() })]);
        p.add(new THREE.CylinderGeometry(0.8, 0.8, 0.14, 20), 0x8f8c88, x, y + 2.95, z, 0);
        p.add(new THREE.ConeGeometry(0.62, 0.34, 20), 0x7f8a72, x, y + 3.18, z, 0);
        p.add(new THREE.CylinderGeometry(0.78, 0.82, 0.3, 20), 0x9a9792, x, y + 0.15, z, 0);
      }
      stair(T(550.5, hw(550) + 5.0), T(552, hw(552) + 13.5), 2.2);
      // the road: the short-dashed cycle lane line down the left past the tennis courts, the red cycle
      // crossing at the corner, the solid lane lines between the houses, red and grey brick pavements
      for (let i = 470; i < 540; i += 1) band(paint.white, i, i + 0.5, () => -(hw(i) - 1.45), () => -(hw(i) - 1.3), 0.5);
      softLane([...Array(17)].map((_, k) => T(540 + k * 0.6, -(hw(540 + k * 0.6) - 0.95))), 0.75, 2.5);
      for (let i = 541; i < 549; i += 0.5) for (const o of [0.2, 1.55]) band(paint.white, i, i + 0.25, () => -(hw(i) - o), () => -(hw(i) - o - 0.15), 0.25);
      for (const side of [-1, 1]) band(paint.white, 556, 614, (i) => side * (hw(i) - 1.25), (i) => side * (hw(i) - 1.1));
      // the left side past the tennis courts: granite kerb, grass strip (the trees moved into it at load), grey brick footpath
      band(paint.kerb, SIDE.i0, SIDE.i1, (i) => -hw(i), (i) => -(hw(i) + SIDE.kerb));
      pave(SIDE.i0, SIDE.i1, (i) => -(hw(i) + SIDE.kerb), (i) => -(hw(i) + sideGap(i)), 'verge');
      {
        const line = [];
        for (let i = SIDE.i0; i <= SIDE.i1 - 1; i += 0.5) line.push(T(i, -(hw(i) + sideGap(i) + SIDE.path / 2)));
        softLane(line, SIDE.path / 2, 2.5, soft.brick, 0.05);
        // grass along the far side of the footpath, fading out into the bank, so the map's grey path under it is gone
        const out = [];
        for (let i = SIDE.i0; i <= SIDE.i1 - 1; i += 0.5) out.push(T(i, -(hw(i) + sideGap(i) + SIDE.path + 0.6)));
        softLane(out, 1.2, 2.5, soft.grass, 0.9);
      }
      pave(528, 614, (i) => hw(i) + 0.2, (i) => hw(i) + 2.4, 'red');
      { const [x, z] = T(533.4, hw(533) + 3.3); K.box(x, z, 0.34, 0.5, 0.26, COL.bin, 0, 0.75); }
    }

    {
      const deco = (list, lift, tile, opts, f) => { if (!list.length) return; const g = drapeGeometry(world, list, lift, tile, 1.5); if (g) extra.push([g, new THREE.MeshLambertMaterial({ ...opts, polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f, side: THREE.DoubleSide })]); };
      deco(paint.gutter, 0.07, 1.6, { map: gutterTex() }, -5);
      deco(paint.kerb, 0.1, 1, { color: 0xb9b6c0 }, -6);
      deco(paint.red, 0.08, 1, { color: 0xd98a80 }, -6);
      deco(paint.white, 0.1, 1, { color: 0xf6f3fa }, -7);
    }
    const softMesh = (list, opts, alpha, f = -6, order = 1) => {
      if (!list.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(list.flatMap((v) => v.slice(0, 3)), 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(list.flatMap((v) => [1, 1, 1, v[3] * alpha]), 4));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(list.flatMap((v) => [v[4], v[5]]), 2));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(list.flatMap(() => [0, 1, 0]), 3));
      const m = new THREE.MeshLambertMaterial({ ...opts, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f });
      const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.renderOrder = order; group.add(mesh);
    };
    softMesh(soft.paint, { color: 0xf59aa8 }, 0.72);
    softMesh(soft.grass, { map: grassTex(1.6) }, 1, -5, 1);     // the shared grass; this mesh's UVs count in 1.6 m
    softMesh(soft.brick, { map: footpathTex() }, 1, -6, 2);
    K.finish();
    if (solids.length) world.addSolids(solids);
    for (const [g, m] of extra) { const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; group.add(mesh); }
    const flat = (G, mat) => {
      if (!G.pos.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(G.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(G.uv, 2));
      g.computeVertexNormals();
      group.add(new THREE.Mesh(g, mat));
    };
    flat(iron, new THREE.MeshLambertMaterial({ map: ironTex(), alphaTest: 0.5, side: THREE.DoubleSide }));
    flat(boards, new THREE.MeshLambertMaterial({ map: boardTex(), side: THREE.DoubleSide }));
    if (glow.length) {
      const pos = [];
      for (const g0 of glow) pos.push(...g0.toNonIndexed().attributes.position.array);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffe6b0 })));
    }
  }

  return {
    update(x, z) {
      ZONES.forEach((Z, k) => {
        if (done[k] || Math.hypot(x - Z.c[0], z - Z.c[1]) > 600) return;
        if (Z.ready.every(([cx, cz]) => world.ready(cx, cz))) { done[k] = true; build(k); }
      });
    },
  };
}
