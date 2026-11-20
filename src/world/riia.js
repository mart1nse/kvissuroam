// Riia tänav (road 3) in Tartu from the Küüni corner by Kaubamaja towards Pepleri (Martin, 20 Nov: a pink outline
// on a map), dressed from the Land Board's oblique air photos (2024) and Mapillary street photos (2022 to 2024).
// Kaubamaja, Kvartal and the Vanemuine theatre are built elsewhere. Batch 1, the Küüni end down to W. Struve:
//  - Hotel Pallas (Riia 4): the blue glass front to Riia over a sage-grey ground floor with its canopy, the
//    PALLAS sign on the corner, the grey corner to Kalevi with its column of company boards and the round
//    window, white walls with long window bands to the yard and to Küüni.
//  - The court house (Kalevi 1): light grey render with long bands of blue glass, the dark brown base, the black
//    entrance block with TARTU KOHTUMAJA on it, and the steel railing along the Riia pavement.
//  - Riia 3: the taupe six-storey block with its stacks of glazed balconies and the red brick end by the door.
//  - Riia 5: the dark brown-grey 1950s block with its tall pilasters and the shop windows on the ground floor,
//    Riia 5a in the yard behind, and the white back of W. Struve 8.
// Batch 2, W. Struve down to Pepleri:
//  - Riia 7 (the cream corner block with the pilasters and the second-hand bookshop), Riia 9 (grey-beige 1950s
//    with its row of shops), Riia 11 (light grey, shops), Riia 13 (white, the orange canopy over its shops),
//    Pepleri 34 on the corner (pale yellow).
//  - Across the road: Riia 8 (the orange brick block), Riia 10 (salmon render and shops, its dark wing down
//    Tähe), the old red-roofed houses on Võru 2 and 4, and Riia 14 (the low grey shop with the yellow band).
//  - The row of limes along both verges, which the map's tree survey had mostly missed, and the stray roof plate
//    that floated over the Riia 12 lot (that building is not in the map's 3D data, so the lot stays open).
// Cars parked at the kerb in front of Riia 3 and 5. What the photos do not show sharply (window counts, shop
// signs, the boards' names) is guessed. No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { BOX } from '../race/landmarks.js';

// ---------------------------------------------------------------- the road frame
// s metres along Riia from the Küüni junction towards Pepleri (south-west), v metres across it, + to the
// north-west (the theatre side), - to the south-east (Pallas, the court house, the park).
const RIIA = [[1712.7, 3164.8], [1657.2, 3233.3], [1604.4, 3325.0], [1543.8, 3429.3], [1482.6, 3502.1], [1466.0, 3517.4], [1331.8, 3636.5]];
const SEG = [];
{
  let acc = 0;
  for (let i = 0; i < RIIA.length - 1; i++) {
    const a = RIIA[i], b = RIIA[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    SEG.push({ a, s0: acc, len, u: [(b[0] - a[0]) / len, (b[1] - a[1]) / len] });
    acc += len;
  }
}
// a point s along the centre line and v across it (the corners between straight pieces are blended over 12 m)
function dirAt(s) {
  const k = SEG.findIndex((g) => s < g.s0 + g.len), g = SEG[k < 0 ? SEG.length - 1 : k];
  const nx = SEG[SEG.indexOf(g) + 1], pv = SEG[SEG.indexOf(g) - 1];
  let u = g.u;
  if (nx && s > g.s0 + g.len - 6) { const t = (s - (g.s0 + g.len - 6)) / 12; u = [g.u[0] * (1 - t) + nx.u[0] * t, g.u[1] * (1 - t) + nx.u[1] * t]; }
  else if (pv && s < g.s0 + 6) { const t = 0.5 + (s - g.s0) / 12; u = [pv.u[0] * (1 - t) + g.u[0] * t, pv.u[1] * (1 - t) + g.u[1] * t]; }
  const l = Math.hypot(u[0], u[1]);
  return [u[0] / l, u[1] / l];
}
function L(s, v = 0) {
  const k = SEG.findIndex((g) => s < g.s0 + g.len), g = SEG[k < 0 ? SEG.length - 1 : k];
  const t = s - g.s0, c = [g.a[0] + g.u[0] * t, g.a[1] + g.u[1] * t], u = dirAt(s);
  return [c[0] - u[1] * v, c[1] + u[0] * v];
}
const DEBUG = typeof location !== 'undefined' && /riiadebug/.test(location.search);

// ---------------------------------------------------------------- road paint
// The street photos (2021 to 2024) show two lanes each way with a DOUBLE solid centre line from the Kalevi corner
// to Pepleri; the map paints a single one. The generated centre strokes on those pieces are skipped here and the
// double line is drawn by the build below on the same centre lines (lane dashes stay as generated).
const PAINT_S = [95, 605];
let paintPieces = null;           // [[pts...]] the road pieces whose centre line is doubled
const onPiece = (x, z, pts) => {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
    if (Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z) < 0.4) return true;
  }
  return false;
};
function sAlong(x, z) {
  let best = 1e9, bs = 0;
  for (const g of SEG) {
    const t = Math.max(0, Math.min(g.len, (x - g.a[0]) * g.u[0] + (z - g.a[1]) * g.u[1]));
    const d = Math.hypot(g.a[0] + g.u[0] * t - x, g.a[1] + g.u[1] * t - z);
    if (d < best) { best = d; bs = g.s0 + t; }
  }
  return [bs, best];
}
// ---- the grass median between Kalevi and Küüni (Martin, 20 Nov: "here should be a row of trees in the middle"):
// 2.6 m of lawn between granite kerbs with eight young limes (black guards round their trunks) where the map's
// tree survey and the 2024 orthophoto have them, and two double-armed lamp posts, as on his Street View shots.
// The map draws the two carriageways as one sheet of asphalt.
const MED = frame([1668.8, 3219.7], [1711.8 - 1668.8, 3176.5 - 3219.7]), MED_LEN = 61, MED_HW = 1.3;
const MED_TREES = [[1671.4, 3216.7], [1676.1, 3212.6], [1681.1, 3207.8], [1686.3, 3201.8], [1695.1, 3193.5],
  [1698.5, 3189.5], [1704.2, 3184.4], [1709.6, 3178.5]].map(([x, z], i) => { const hh = 7 + ((i * 5) % 3) * 0.6; return [x, z, hh, hh * 0.5, 0]; });
// verge trees in the city's tree survey (on the map) that the lidar trees missed: one by the court house, two
// at the Tähe corner, and the row in front of Riia 15 and 17 just past Pepleri (2024 air photos)
const SURVEY_TREES = [[1618.9, 3276, 12, 6, 0], [1601, 3304.3, 13.6, 6.8, 0], [1461.8, 3504.3, 13.6, 6.8, 0], [1465.9, 3500.6, 15.2, 7.6, 0],
  [1318.9, 3632.6, 12, 6, 0], [1314.3, 3636.3, 13.6, 6.8, 0], [1310.9, 3639.5, 15.2, 7.6, 0], [1307, 3642.3, 12.8, 6.4, 0],
  [1301.9, 3646.4, 14.4, 7.2, 0], [1298.7, 3649.1, 12, 6, 0], [1294.4, 3653.1, 13.6, 6.8, 0], [1289.8, 3656.8, 15.2, 7.6, 0],
  [1286.5, 3659.6, 12.8, 6.4, 0], [1277.4, 3667.5, 12, 6, 0], [1272.2, 3671.8, 13.6, 6.8, 0], [1265.5, 3677.6, 15.2, 7.6, 0],
  [1262, 3680.3, 12.8, 6.4, 0], [1257.9, 3683.6, 14.4, 7.2, 0], [1255.2, 3686.2, 12, 6, 0], [1249.1, 3691, 15.2, 7.6, 0],
  [1243.4, 3695.5, 12.8, 6.4, 0], [1235.4, 3703.1, 14.4, 7.2, 0]];
const onMedian = (x, z) => { const [s, v] = MED.sv(x, z); return s > -0.5 && s < MED_LEN + 0.5 && Math.abs(v) < MED_HW + 0.25; };

export function riiaVectors(vectors) {
  paintPieces = vectors.roads.filter((r) => (r.name === 'Riia tänav' || r.name === 'Jõhvi-Tartu-Valga tee') && r.w >= 11.5 && r.pts.length > 1 &&
    r.pts.every(([x, z]) => { const [s, d] = sAlong(x, z); return d < 2 && s >= PAINT_S[0] - 15 && s <= PAINT_S[1] + 15; })).map((r) => r.pts);
  const prev = vectors.markSkip;
  vectors.markSkip = (x, z) => {
    const [s, d] = sAlong(x, z);
    if (d < 1 && s > PAINT_S[0] && s < PAINT_S[1] && paintPieces.some((pts) => onPiece(x, z, pts))) return true;
    if (onMedian(x, z)) return true;
    return prev ? prev(x, z) : false;
  };
}
// the double centre line between s0 and s1: solid strokes 4.5 m long, 0.13 m wide, 0.12 m either side
function centreLines(world, group, s0, s1) {
  if (!paintPieces) return;
  const pos = [], W = 0.065, OFF = 0.12;
  for (const pts of paintPieces) {
    const len = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) { len.push(Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])); total += len[i]; }
    const at = (d, side) => {
      let i = 0;
      while (i < len.length - 1 && d > len[i]) d -= len[i++];
      const a = pts[i], b = pts[i + 1], dx = (b[0] - a[0]) / len[i], dz = (b[1] - a[1]) / len[i];
      return [a[0] + dx * d - dz * side, a[1] + dz * d + dx * side, dx, dz];
    };
    for (let d = 10; d + 4.5 <= total - 10; d += 4.5) {
      const m = at(d + 2.25, 0), [s] = sAlong(m[0], m[1]);
      if (s < Math.max(s0, PAINT_S[0]) || s >= Math.min(s1, PAINT_S[1])) continue;
      for (const side of [-OFF, OFF]) {
        const p = at(d, side), q = at(d + 4.5, side), nx = -p[3] * W, nz = p[2] * W;
        const y1 = world.heightAt(p[0], p[1]) + 0.06, y2 = world.heightAt(q[0], q[1]) + 0.06;
        pos.push(p[0] - nx, y1, p[1] - nz, p[0] + nx, y1, p[1] + nz, q[0] - nx, y2, q[1] - nz,
          q[0] - nx, y2, q[1] - nz, p[0] + nx, y1, p[1] + nz, q[0] + nx, y2, q[1] + nz);
      }
    }
  }
  if (!pos.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xdedbe6, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.receiveShadow = true;
  m.matrixAutoUpdate = false;
  group.add(m);
}

// ---------------------------------------------------------------- what the map's own data needs
// Wall and roof colours of the map's blocks (LOD2 bases in cm, sector 3_6); the walls are painted over below.
export function riiaWalls(walls) {
  setHouseColours(walls, '3_6', 1120, 3040, [
    { base: 421, x: 1708.2, z: 3222.6, wall: 0x6f8fb4, roof: 0x5c5f66, reach: 40 },   // Hotel Pallas
    { base: 934, x: 1662.0, z: 3322.0, wall: 0xd4d6d8, roof: 0x55585e, reach: 50 },   // the court house
    { base: 1381, x: 1569.1, z: 3332.0, wall: 0x8c8075, roof: 0x55575c },             // Riia 3
    { base: 1439, x: 1562.0, z: 3365.4, wall: 0x6e645c, roof: 0x8d9198 },             // Riia 5
    { base: 1492, x: 1548.6, z: 3359.8, wall: 0x9a8f86, roof: 0x5d5f64 },             // Riia 5a
    { base: 2005, x: 1519.0, z: 3379.9, wall: 0xe9e8e3, roof: 0x5d5f64 },             // W. Struve 8
    { base: 1563, x: 1540.3, z: 3396.3, wall: 0xe6dcc2, roof: 0x9aa0a8 },             // Riia 7
    { base: 1931, x: 1485.1, z: 3443.7, wall: 0xbdb7ad, roof: 0x8e949c, reach: 40 },  // Riia 9
    { base: 2273, x: 1431.2, z: 3494.8, wall: 0xd8d8d4, roof: 0x5f6e80, reach: 40 },  // Riia 11
    { base: 2454, x: 1382.0, z: 3557.2, wall: 0xedebe5, roof: 0x5f6e80, reach: 40 },  // Riia 13
    { base: 2532, x: 1332.7, z: 3597.7, wall: 0xeadcb0, roof: 0x8e949c },             // Pepleri 34
    { base: 1971, x: 1576.5, z: 3480.2, wall: 0xc4744a, roof: 0x5d5f64 },             // Riia 8
    { base: 1961, x: 1548.4, z: 3470.2, wall: 0xdea88a, roof: 0x5d5f64 },             // Riia 10, the Riia wing
    { base: 1961, x: 1540.6, z: 3509.6, wall: 0x7a6e68, roof: 0x5d5f64 },             // its wing down Tähe
    { base: 2290, x: 1506.2, z: 3536.4, wall: 0xd9c4ae, roof: 0x8a4a3a },             // Võru 2
    { base: 2352, x: 1495.6, z: 3563.2, wall: 0xd9c4ae, roof: 0x8a4a3a },             // Võru 4
    { base: 2466, x: 1380.0, z: 3648.5, wall: 0xcfd0d0, roof: 0x5d5f64 },             // Riia 14
    { base: 3699, x: 1430.5, z: 3588.1, hide: true },                                 // a roof plate floating over the Riia 12 lot
    { base: 3699, x: 1430.5, z: 3588.1, hide: true, shelter: true },                  // (its triangles may be marked as a carport)
    { base: 3580, x: 1540.1, z: 3466.9, hide: true },                                 // and a dark plate over Riia 10's roof edge
    { base: 3580, x: 1540.1, z: 3466.9, hide: true, shelter: true },
  ]);
}

// Parked cars for src/world/parked.js: [x, z, yaw, id, paint, lift] (forward = (sin yaw, -cos yaw)). Nose to the
// south-west at the kerb in front of Riia 3 and Riia 5.
const yawAlong = (s) => { const u = dirAt(s); return Math.atan2(u[0], -u[1]); };
export const RIIA_CARS = [
  [...L(224, 7.0), yawAlong(224), 'passat', 'silver', 0.03],
  [...L(236, 7.0), yawAlong(236), 'mazda6', 'grey', 0.03],
  [...L(255, 7.0), yawAlong(255), 'rav4', 'white', 0.03],
  [...L(267, 7.0), yawAlong(267), 'model3', 'white', 0.03],
];

// The limes along the verges from the Riia 8 lane to Pepleri: [x, z, height, crown, type 0 = broadleaf]. The
// map's tree survey has only a handful here; the street photos show full rows on both sides.
const TREES = [[1563.7, 3424.0, 13, 6.5, 0], [1559.2, 3431.7, 16, 8.0, 0], [1537.7, 3452.1, 15, 7.5, 0], [1531.9, 3459.0, 13, 6.5, 0], [1526.1, 3465.9, 16, 8.0, 0], [1520.3, 3472.8, 14, 7.0, 0], [1514.5, 3479.7, 17, 8.5, 0], [1508.7, 3486.6, 15, 7.5, 0], [1502.9, 3493.4, 13, 6.5, 0], [1463.9, 3532.7, 16, 8.0, 0], [1457.1, 3538.6, 14, 7.0, 0], [1450.4, 3544.6, 17, 8.5, 0], [1443.7, 3550.6, 15, 7.5, 0], [1437.0, 3556.6, 13, 6.5, 0], [1376.4, 3610.3, 15, 7.5, 0], [1369.6, 3616.3, 13, 6.5, 0], [1362.9, 3622.3, 16, 8.0, 0], [1356.2, 3628.2, 14, 7.0, 0], [1349.4, 3634.2, 17, 8.5, 0], [1453.5, 3514.9, 13, 6.5, 0], [1446.7, 3520.9, 16, 8.0, 0], [1440.0, 3526.8, 14, 7.0, 0], [1433.3, 3532.8, 17, 8.5, 0], [1426.5, 3538.8, 15, 7.5, 0], [1406.3, 3556.7, 14, 7.0, 0], [1399.6, 3562.7, 17, 8.5, 0], [1392.9, 3568.7, 15, 7.5, 0], [1386.1, 3574.6, 13, 6.5, 0], [1379.4, 3580.6, 16, 8.0, 0], [1372.7, 3586.6, 14, 7.0, 0], [1366.0, 3592.6, 17, 8.5, 0], [1359.2, 3598.5, 15, 7.5, 0], [1352.5, 3604.5, 13, 6.5, 0], [1345.8, 3610.5, 16, 8.0, 0]];

// ---------------------------------------------------------------- the painted walls
const C = { glassBlue: '#4c6f9c', glass: '#4a5866', trim: '#f2f1ec', sage: '#7d8a83' };
const plaster = (wall, o = {}) => ({ kind: 'plaster', wall, trim: C.trim, weather: 0.4, ...o });
const sq = (o = {}) => ({ T: false, bars: 1, rails: 0, surround: 0.05, frame: '#f1f0ec', glass: C.glass, ...o });

// a glass curtain wall: blue panes in a white grid, one row a floor, over a ground floor of sage panels and shop
// glass with a flat canopy
function curtain(P, W, { floor = 3.4, base = 4.4, pitch = 1.5 } = {}) {
  const len = W.len, top = P.y1;
  P.r(0, P.y0, len, top, '#dfe3e6');
  P.grad(0, base, len, top - 0.6, '#5d84b4', '#3d5f8c');
  for (let y = base; y < top - 0.6; y += floor) {
    P.r(0, y - 0.09, len, y + 0.09, '#e9edf0');
    P.r(0, y + floor * 0.62, len, y + floor * 0.64, 'rgba(235,240,245,0.5)');
    for (let k = 0; k < 5; k++) { const x = (y * 3.7 + k * 9.1) % len; P.r(x, y + 0.2, x + pitch * 0.9, y + floor - 0.3, 'rgba(255,255,255,0.08)'); }
  }
  for (let x = 0.2; x < len; x += pitch) P.r(x - 0.05, base, x + 0.05, top - 0.6, '#e9edf0');
  P.r(0, top - 0.6, len, top, '#cfd4d8');
  // the ground floor: sage panels, shop glass, a door now and then
  P.r(0, P.y0, len, base, C.sage);
  for (let x = 1.2; x < len - 2.5; x += 5.2) { P.r(x, 0.35, x + 3.9, 3.1, '#2f3a42'); P.r(x + 1.9, 0.35, x + 2.0, 3.1, '#8f9a93'); }
  for (let x = 0; x < len; x += 1.2) P.r(x, 3.3, x + 0.03, base, '#6d7972');
  P.r(0, 3.3, len, 3.45, '#3d4247');                            // the canopy's edge
  P.r(0, P.y0, len, 0.3, '#5b625f');
}
// rendered walls with long window bands, one a floor
function ribbon(P, W, { wall = '#f1f1ee', glass = C.glassBlue, floor = 3.4, first = 1.0, band = 1.55, base = null, baseH = 0, stair = null } = {}) {
  const len = W.len, top = P.y1;
  P.r(0, P.y0, len, top, wall);
  if (base) { P.r(0, P.y0, len, baseH, base); for (let x = 1.0; x < len - 2.5; x += 3.2) P.r(x, 0.5, x + 2.4, baseH - 0.6, '#2c3640'); }
  for (let y = first; y + band < Math.min(top, W.eaves) - 0.5; y += floor) {
    if (base && y < baseH) continue;
    P.grad(0.6, y, len - 0.6, y + band, glass, '#2f4560');
    for (let x = 0.6; x < len - 0.6; x += 1.35) P.r(x - 0.04, y, x + 0.04, y + band, '#e6e9ec');
    P.r(0.5, y - 0.12, len - 0.5, y, '#c9ccd0');
  }
  if (stair) { const [x0, x1] = stair; P.grad(x0, 0.3, x1, Math.min(top, W.eaves) - 0.8, '#3d4e60', '#24303c'); for (let y = 1; y < W.eaves - 1; y += 1.7) P.r(x0, y, x1, y + 0.05, '#8e99a4'); }
  P.weather(0, P.y0, len, top, 0.3, Math.round(W.mid[0]));
}

// The houses, with the walls that need more than the house's own spec. `near` points are the walls' middles.
function houses(later) {
  return [
    // ---- Hotel Pallas: blue glass to Riia, the grey corner to Kalevi, white long windows behind
    { name: 'pallas', sec: '3_6', base: 421, at: [1712, 3226], r: 45,
      spec: plaster([240, 240, 236], { storey: 3.4, maxFloors: 8, win: sq({ w: 2.4, pitch: 2.7, bars: 2, glass: '#4f6680' }), plinth: { h: 0.5, col: '#9fa2a5' } }),
      walls: [
        { near: [1697.9, 3222.5], within: 3, only: (P, W) => { curtain(P, W); later.push(() => canopy(W, 0.5, W.len - 0.5, 3.35, 1.6, 0x3a3e44)); } },
        { near: [1719.9, 3210.6], within: 3, only: (P, W) => curtain(P, W, { base: -1 }) },
        { near: [1692.9, 3234.7], within: 3, only: (P, W) => curtain(P, W, { base: -1 }) },
        { near: [1726.1, 3198.8], within: 3, only: (P, W) => ribbon(P, W, { stair: [W.len - 3.2, W.len - 0.6] }) },
        { near: [1689.3, 3248.8], within: 3, only: (P, W) => kalevi(P, W) },
        { near: [1737.0, 3201.6], within: 3, only: (P, W) => ribbon(P, W, { wall: '#d9e5ee' }) },
        { near: [1708.9, 3233.8], within: 3, only: (P, W) => ribbon(P, W) },
        { near: [1716.0, 3218.8], within: 3, only: (P, W) => ribbon(P, W) },
      ] },
    // ---- the court house: grey render, bands of blue glass, the dark base; the black entrance block to Kalevi
    { name: 'court', sec: '3_6', base: 934, at: [1665, 3322], r: 50,
      spec: plaster([214, 216, 218], { storey: 3.6, maxFloors: 6, win: sq({ w: 2.0, pitch: 2.6, bars: 1, glass: '#4f6680' }), plinth: { h: 0.6, col: '#5c4a42' } }),
      walls: [
        { near: [1641.4, 3316.2], within: 3, only: (P, W) => ribbon(P, W, { wall: '#d9dbdc', floor: 3.6, first: 4.6, band: 1.7, base: '#5e4b42', baseH: 3.8, stair: [W.len * 0.58, W.len * 0.58 + 2.6] }) },
        { near: [1646.2, 3344.7], within: 3, only: (P, W) => ribbon(P, W, { wall: '#d9dbdc', floor: 3.6, first: 1.2, band: 1.7 }) },
        { near: [1632.4, 3350.2], within: 3, only: (P, W) => ribbon(P, W, { wall: '#d9dbdc', floor: 3.6, first: 1.2, band: 1.7 }) },
        { near: [1671.7, 3294.2], within: 3, only: (P, W) => blackBlock(P, W) },
        { near: [1679.7, 3311.3], within: 3, only: (P, W) => blackBlock(P, W, false) },
        { near: [1668.5, 3299.2], within: 3, only: (P, W) => ribbon(P, W, { wall: '#e4e5e6', floor: 3.6, first: -0.4, band: 1.7 }) },
        { near: [1689.8, 3329.9], within: 3, only: (P, W) => ribbon(P, W, { wall: '#e4e5e6', floor: 3.6, first: 1.2, band: 1.7 }) },
      ] },
    // ---- Riia 3: taupe render, glazed balcony stacks on its long sides, red brick at the door end
    { name: 'riia3', sec: '3_6', base: 1381, at: [1570, 3332], r: 26,
      spec: plaster([146, 140, 133], { storey: 3.0, maxFloors: 6, win: sq({ w: 1.3, pitch: 2.8 }), plinth: { h: 0.9, col: '#6c625b' }, belts: [] }),
      walls: [
        // the end to Kalevi's side: red brick, open concrete balconies by the street corner
        { near: [1573.7, 3321.9], within: 3, only: (P, W) => {
          P.brick(0, P.y0, W.len, P.y1, [156, 78, 60], 33);
          for (let y = 1.5; y < (P.y1 - 0.6) - 1.5; y += 3.0) for (const x of [3.0, W.len - 9.0, W.len - 4.0]) P.win(x - 0.65, y, x + 0.65, y + 1.5, sq({ frame: '#e6e2da' }));
          for (let y = 3.1; y < (P.y1 - 0.6) - 2; y += 3.0) later.box(W, W.len - 2.2, 0.7, y, 2.6, 0.16, 1.4, 0xb9b4ad);
        } },
        { near: [1562.4, 3331.5], within: 3, draw: (P, W) => balconies(P, W, [W.len * 0.25, W.len * 0.62], 1.2) },
        // the street front: glazed balcony stacks, the brick ground floor and the steps up to the door at the north end
        { near: [1581.6, 3343.8], within: 3, only: (P, W) => {
          P.r(0, P.y0, W.len, P.y1, 'rgb(146,140,133)');
          P.weather(0, P.y0, W.len, P.y1, 0.4, 5);
          for (let k = 0; k < 6; k++) { const y = 1.4 + k * 3.0; if (y + 1.6 > (P.y1 - 0.6)) break; for (let x = 7.6; x < W.len - 0.8; x += 2.9) if (Math.abs(x - W.len * 0.62) > 2.2) P.win(x - 0.65, y, x + 0.65, y + 1.55, sq()); }
          balconies(P, W, [W.len * 0.62], 1.2);
          P.brick(0, P.y0, 6.4, 3.4, [158, 76, 56], 31); P.r(0, 3.4, 6.4, 3.55, '#d8d4cc');
          P.door(2.65, 4.15, 2.5, '#4b3530', { light: 0.5, panels: 1 });
          for (let y = 4.4; y < (P.y1 - 0.6) - 1.6; y += 3.0) P.win(2.75, y, 4.05, y + 1.55, sq());
          for (let k = 0; k < 4; k++) P.r(1.9 + k * 0.08, P.y0, 4.9 - k * 0.08, 0.02 - (3 - k) * 0.17, '#a39c98');
          later.push(() => canopy(W, 1.8, 5.0, 3.0, 1.5, 0xe4e1da));
        } },
      ] },
    // ---- Riia 5: the dark 1950s block, pilasters, shops on the ground floor
    { name: 'riia5', sec: '3_6', base: 1439, at: [1562, 3365.4], r: 24,
      spec: plaster([112, 102, 94], { storey: 3.3, maxFloors: 5, win: sq({ w: 1.15, pitch: 2.5, frame: '#ece8e0', glass: '#3e4650' }), plinth: { h: 0.6, col: '#4f4945' }, belts: [4.3], weather: 0.5 }),
      walls: [
        { near: [1567.2, 3368.6], within: 3, floors: [4.9, 8.2, 11.5, 14.8].map((sill) => ({ sill, h: 1.65 })),
          draw: (P, W) => {
            for (let x = 1.25; x < W.len; x += 2.5) P.r(x - 0.2, 4.4, x + 0.2, W.eaves - 0.4, 'rgba(150,138,128,0.55)');
            P.r(0, W.eaves - 0.6, W.len, W.eaves, '#857a72');
            for (const [x0, x1] of [[1.0, 6.4], [8.2, 13.6], [19.6, 25.0], [26.8, 32.2]]) { P.r(x0, 0.45, x1, 3.6, '#2e3236'); P.r((x0 + x1) / 2 - 0.04, 0.45, (x0 + x1) / 2 + 0.04, 3.6, '#7d7670'); P.r(x0, 3.6, x1, 4.1, '#e6e1d8'); }
            P.door(15.7, 17.2, 2.7, '#3d3631', { light: 0.6, panels: 1 });
          } },
      ] },
    { name: 'riia5a', sec: '3_6', base: 1492, at: [1548.6, 3359.8], r: 22, spec: plaster([154, 143, 134], { storey: 3.0, maxFloors: 3, win: sq({ w: 1.2, pitch: 2.6 }) }) },
    // ---- batch 2, the west side
    { name: 'riia7', sec: '3_6', base: 1563, at: [1541, 3396], r: 24,
      spec: plaster([230, 220, 194], { storey: 3.3, maxFloors: 5, win: sq({ w: 1.15, pitch: 2.5, frame: '#f4f1e8' }), plinth: { h: 0.7, col: '#8f877c' }, belts: [3.9] }),
      walls: [{ near: [1549.6, 3399.2], within: 3, floors: [4.6, 7.9, 11.2, 14.5].map((sill) => ({ sill, h: 1.6 })),
        draw: (P, W) => { pilasters(P, W, 3.9, '#efe7d2'); shops(P, W, [[2, 7], [9, 14], [24, 29], [31, 35.5]], '#2f3338', '#e9e2cf'); P.door(18.4, 19.8, 2.7, '#4a3b30', { light: 0.6, panels: 1 }); P.r(26, 3.0, 28.6, 3.5, '#3c3027'); P.text('ANTIKVARIAAT', 27.3, 3.25, 0.32, '#e8d9a8'); } }] },
    { name: 'riia9', sec: '3_6', base: 1931, at: [1490, 3448], r: 40,
      spec: plaster([190, 184, 174], { storey: 3.2, maxFloors: 5, win: sq({ w: 1.2, pitch: 2.6, frame: '#ece9e2' }), plinth: { h: 0.6, col: '#6f6a64' }, belts: [4.0], weather: 0.5 }),
      walls: [{ near: [1506.8, 3452.2], within: 3, floors: [4.7, 7.9, 11.1, 14.3].map((sill) => ({ sill, h: 1.65 })),
        draw: (P, W) => { pilasters(P, W, 4.0, '#c9c3b8'); shops(P, W, [[1.5, 7.5], [9.5, 15.5], [17.5, 22], [26, 32], [34, 40], [42, 46.5]], '#2c3136', '#d8d2c6'); P.door(23.4, 24.9, 2.7, '#3c3631', { light: 0.6, panels: 1 }); } }] },
    { name: 'riia11', sec: '3_6', base: 2273, at: [1432, 3497], r: 40,
      spec: plaster([216, 216, 212], { storey: 3.2, maxFloors: 5, win: sq({ w: 1.3, pitch: 2.7, frame: '#f2f2ef' }), plinth: { h: 0.6, col: '#7c7b78' }, belts: [3.9] }),
      walls: [{ near: [1438.4, 3512.0], within: 3, floors: [4.6, 7.8, 11.0, 14.2].map((sill) => ({ sill, h: 1.6 })),
        draw: (P, W) => { shops(P, W, Array.from({ length: 9 }, (_, k) => [1.5 + k * 6.8, 6.3 + k * 6.8]), '#2a3036', '#f1f0ec'); } }] },
    { name: 'riia13', sec: '3_6', base: 2454, at: [1382.4, 3557.7], r: 40,
      spec: plaster([236, 234, 228], { storey: 3.3, maxFloors: 4, win: sq({ w: 1.2, pitch: 2.6 }), plinth: { h: 0.6, col: '#8a8783' }, belts: [4.0] }),
      walls: [{ near: [1382.4, 3558.7], within: 3, floors: [4.8, 8.1, 11.4].map((sill) => ({ sill, h: 1.65 })),
        draw: (P, W) => { shops(P, W, Array.from({ length: 10 }, (_, k) => [1.5 + k * 6.6, 6.0 + k * 6.6]), '#2b4a66', '#efece6'); later.push(() => canopy(W, 1.0, W.len - 1.0, 3.75, 1.3, 0xc8643a)); } }] },
    { name: 'pepleri34', sec: '3_6', base: 2532, at: [1331.9, 3597.1], r: 24,
      spec: plaster([234, 220, 176], { storey: 3.4, maxFloors: 5, win: sq({ w: 1.2, pitch: 2.6, frame: '#f6f2e6' }), plinth: { h: 0.8, col: '#958c7c' }, belts: [4.0] }),
      walls: [{ near: [1340.5, 3603.6], within: 3, doors: [{ x: 11.3, w: 1.5, h: 2.7, col: '#4f3e33', steps: 2 }], draw: (P, W) => pilasters(P, W, 4.0, '#f2e8cc') }] },
    // ---- batch 2, the east side
    { name: 'riia8', sec: '3_6', base: 1971, at: [1576.5, 3480.2], r: 30,
      spec: { kind: 'brick', wall: [190, 106, 70], trim: '#efe9df', weather: 0.3, storey: 3.0, maxFloors: 7, win: sq({ w: 1.3, pitch: 2.7, frame: '#f2efe8' }), plinth: { h: 0.6, col: '#6f6560' } } },
    { name: 'riia10', sec: '3_6', base: 1961, at: [1545, 3478], r: 30, pick: (x, z) => z < 3497,
      spec: plaster([222, 168, 138], { storey: 3.1, maxFloors: 6, win: sq({ w: 1.25, pitch: 2.6 }), plinth: { h: 0.6, col: '#7d6a60' }, belts: [3.9] }),
      walls: [{ near: [1538.2, 3471.3], within: 3, floors: [4.5, 7.6, 10.7, 13.8].map((sill) => ({ sill, h: 1.6 })),
        draw: (P, W) => { shops(P, W, Array.from({ length: 7 }, (_, k) => [1.5 + k * 6.6, 6.0 + k * 6.6]), '#3a2a24', '#f2d9c4', '#d5733a'); } }] },
    { name: 'riia10t', sec: '3_6', base: 1961, at: [1548, 3512], r: 34, pick: (x, z) => z >= 3497,
      spec: plaster([122, 112, 106], { storey: 3.2, maxFloors: 6, win: sq({ w: 1.2, pitch: 2.5, frame: '#e4e0d8', glass: '#3c4450' }), plinth: { h: 0.6, col: '#4f4945' }, belts: [3.9], weather: 0.5 }) },
    { name: 'voru2', sec: '3_6', base: 2290, at: [1504.6, 3537.7], r: 20, spec: plaster([217, 196, 174], { storey: 3.0, maxFloors: 2, win: { w: 1.0, pitch: 2.3, T: true, surround: 0.1, sc: '#f4efe6' }, plinth: { h: 0.6, col: '#8d8378' } }) },
    { name: 'voru4', sec: '3_6', base: 2352, at: [1495.6, 3563.2], r: 18, spec: plaster([217, 196, 174], { storey: 3.0, maxFloors: 1, win: sq({ w: 1.6, pitch: 3.0 }) }) },
    { name: 'riia14', sec: '3_6', base: 2466, at: [1379.6, 3649.3], r: 24,
      spec: plaster([206, 207, 207], { storey: 3.4, maxFloors: 3, win: sq({ w: 2.2, pitch: 3.0, bars: 2 }), plinth: { h: 0.4, col: '#6d6f72' } }),
      walls: [{ near: [1371.1, 3643.0], within: 3, draw: (P, W) => { P.r(0, 3.4, W.len, 4.1, '#e9b92c'); shops(P, W, [[1, 7], [8.5, 14.5]], '#2a3a4a', '#d9dadb'); } },
        { near: [1382.1, 3635.0], within: 3, draw: (P, W) => { P.r(0, 3.4, W.len, 4.1, '#e9b92c'); shops(P, W, [[1.5, 9.5], [11, 20]], '#2a3a4a', '#d9dadb'); } }] },
    { name: 'struve8', sec: '3_6', base: 2005, at: [1519.0, 3379.9], r: 20, spec: plaster([234, 233, 228], { storey: 3.1, maxFloors: 6, win: sq({ w: 1.3, pitch: 2.7 }), plinth: { h: 0.7, col: '#8d8a86' } }) },
  ];

  // the corner to Kalevi: grey stone, the column of company boards, the round window and the steps
  function kalevi(P, W) {
    const len = W.len, top = P.y1;
    P.r(0, P.y0, len, top, '#8f969c');
    for (let y = 0; y < top; y += 1.2) P.r(0, y, len, y + 0.02, '#7c838a');
    for (let x = 0; x < len; x += 2.4) P.r(x, 0, x + 0.02, top, '#7c838a');
    // the grey fins on the corner tower
    for (let x = len - 7; x < len - 0.3; x += 0.9) P.r(x, 4.5, x + 0.35, top - 0.5, '#c9ced2');
    const boards = [['GRANT THORNTON', '#ffffff', '#3b2e6b'], ['GLASAKEN', '#c8282e', '#ffffff'], ['KINNISVARA', '#ffffff', '#163f7a'], ['DOMUS', '#ffffff', '#c47a12'], ['AVAAERE', '#f2e24a', '#2a2a2a'], ['HANSAKESKUS', '#ffffff', '#1d1d1f']];
    boards.forEach(([t, bg, fg], k) => { const y = 6 + k * 1.55; P.r(1.2, y, 7.2, y + 1.3, bg); P.r(1.2, y, 7.2, y + 0.05, '#555'); P.text(t, 4.2, y + 0.65, 0.55, fg); });
    P.arc(10.5, 2.6, 0.9, '#c9ced2'); P.arc(10.5, 2.6, 0.75, '#3a4652');
    P.r(12.5, 0, 15.5, 3.1, '#2f3a44'); P.r(13.95, 0, 14.05, 3.1, '#a9b0b6');
    for (let k = 0; k < 3; k++) P.r(12.0 + k * 0.1, P.y0, 16.0 - k * 0.1, 0.02 - (2 - k) * 0.17, '#a39c98');
    // the red PALLAS box at the top
    P.r(len - 6.5, top - 4.2, len - 1.0, top - 1.4, '#c8323a');
    P.text('PALLAS', len - 3.75, top - 2.8, 1.4, '#ffffff', '700 %px Georgia, serif');
  }
  // pilaster strips from the shop band up to the eaves, one between each pair of windows
  function pilasters(P, W, from, col) {
    for (let x = 0; x <= W.len + 0.1; x += 2.5) P.r(x - 0.22, from, x + 0.22, W.eaves - 0.5, col);
    P.r(0, W.eaves - 0.7, W.len, W.eaves - 0.2, col);
  }
  // a ground floor of shop windows [x0, x1] with a band over them (and an optional coloured fascia)
  function shops(P, W, list, glass, band, fascia = null) {
    for (const [x0, x1] of list) {
      if (x1 > W.len - 0.5) continue;
      P.r(x0 - 0.1, 0.35, x1 + 0.1, 3.35, band);
      P.grad(x0, 0.45, x1, 3.2, glass, '#1d2126');
      P.r((x0 + x1) / 2 - 0.04, 0.45, (x0 + x1) / 2 + 0.04, 3.2, band);
      if (fascia) P.r(x0, 3.0, x1, 3.35, fascia);
    }
  }
  // the court's entrance block: black panels, the name in white letters
  function blackBlock(P, W, name = true) {
    const len = W.len, top = P.y1;
    P.r(0, P.y0, len, top, '#26272b');
    for (let x = 0; x < len; x += 1.8) P.r(x, P.y0, x + 0.03, top, '#3a3b40');
    if (name) P.text('TARTU KOHTUMAJA', len * 0.5, Math.min(top - 1.2, 6.2), 1.1, '#f1f1ee', '600 %px Georgia, serif');
    P.r(len * 0.35, 0, len * 0.65, 3.0, '#3b4752');
    for (let k = 1; k < 4; k++) P.r(len * (0.35 + k * 0.075) - 0.03, 0, len * (0.35 + k * 0.075) + 0.03, 3.0, '#7d858d');
  }
  // stacks of glazed balconies, one a floor, white frames
  function balconies(P, W, xs, w = 1.2) {
    if (DEBUG) console.log('riia balconies', W.mid.map((v) => v.toFixed(1)).join(','), W.len.toFixed(1), W.eaves.toFixed(1));
    const top = Math.max(W.eaves, P.y1 - 0.6);
    for (const xc of xs) {
      for (let y = 3.3; y < top - 2.6; y += 3.0) {
        P.r(xc - w * 1.6, y - 0.15, xc + w * 1.6, y + 2.6, '#d6d2cc');
        P.r(xc - w * 1.5, y + 0.95, xc + w * 1.5, y + 2.45, '#5a6874');
        for (let k = 0; k <= 4; k++) { const x = xc - w * 1.5 + k * w * 0.75; P.r(x - 0.04, y + 0.95, x + 0.04, y + 2.45, '#f2f1ee'); }
        P.r(xc - w * 1.6, y - 0.15, xc + w * 1.6, y + 0.95, '#bfbab3');
      }
    }
  }
  // a flat canopy sticking out of a wall from x0 to x1 at height y, `depth` deep
  function canopy(W, x0, x1, y, depth, c) {
    later.box(W, (x0 + x1) / 2, depth / 2, y, x1 - x0, 0.2, depth, c);
  }
}

// ---------------------------------------------------------------- the build
export function createRiia(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  world.addTrees([...TREES, ...MED_TREES, ...SURVEY_TREES]);

  // the walls that face the road (within 45 m of the centre line) get the sharper pictures
  const faces = (W) => {
    let best = 1e9, bs = 0;
    for (let s = 0; s <= 620; s += 4) { const q = L(s, 0), d = Math.hypot(q[0] - W.mid[0], q[1] - W.mid[1]); if (d < best) { best = d; bs = s; } }
    const q = L(bs, 0), tx = q[0] - W.mid[0], tz = q[1] - W.mid[1];
    return best < 45 && (tx * W.nx + tz * W.nz) / (Math.hypot(tx, tz) || 1) > 0.3;
  };
  // Two halves, each built (with its own small atlas) only when the car comes within 300 m of it, so the far
  // half costs nothing at the start (phones: the spawn is about 140 m from the north half, 370 m from the south)
  const parts = [
    { centre: L(150, 0), ready: [L(0, -40), L(80, 40), L(200, -60), L(280, 50)], pick: (H) => H.at[1] <= 3390, extra: (A) => { railing(A); median(A); }, paint: [0, 330] },
    { centre: L(470, 0), ready: [L(300, 40), L(380, -50), L(500, 40), L(590, -40)], pick: (H) => H.at[1] > 3390, paint: [330, 700] },
  ];

  function build(part) {
    part.built = true;
    const A = areaKit(world, group, { shadows });
    const { p } = A;
    // 3D pieces fixed to a painted wall: x along it, out from it, y above its ground line
    const later = [];
    later.box = (W, x, out, y, w, hh, d, c) => later.push(() => {
      const px = W.a[0] + W.ux * x + W.nx * out, pz = W.a[1] + W.uz * x + W.nz * out;
      p.add(BOX(w, hh, d), c, px, W.yref + y, pz, Math.atan2(W.nx, W.nz));
    });
    skinHouses(world, group, houses(later).filter(part.pick), { faces, shadows, ppm: 16, far: 6, debug: DEBUG });
    for (let k = 0; k < later.length; k++) later[k]();
    if (part.extra) part.extra(A);
    centreLines(world, group, ...part.paint);
    A.finish();
  }
  // the steel railing along the pavement on the court and park side, from Kalevi to the Riia 8 lane
  function railing(A) {
    const { p, h } = A, post = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), rail = [];
    for (let s = 100; s <= 330; s += 2.5) rail.push(L(s, -8.6));
    A.walk(rail, 2.5, ([x, z]) => p.add(post, 0x9a9ea4, x, h(x, z) + 0.5, z));
    for (let i = 0; i < rail.length - 1; i++) { A.bar(rail[i], rail[i + 1], 0.05, 0.95, 1.02, 0xa9adb3); A.bar(rail[i], rail[i + 1], 0.03, 0.45, 0.5, 0x9a9ea4); }
  }

  // the median's lawn and its kerbs (granite grey, 13 cm, low enough to drive over) with round stone noses at
  // both ends, the guards round the young limes' trunks, and the lamp posts lighting both carriageways
  function median(A) {
    const KERB = 0xc4c2c8, { p, h } = A;
    A.pave(MED, 0, MED_LEN, -MED_HW, MED_HW, 'lawn');
    for (const v of [-MED_HW, MED_HW]) A.box(MED, MED_LEN / 2, v, MED_LEN, 0.22, -0.15, 0.13, KERB);
    for (const s of [0, MED_LEN]) {
      const [x, z] = MED.at(s, 0);
      p.add(new THREE.CylinderGeometry(MED_HW + 0.11, MED_HW + 0.11, 0.28, 14), KERB, x, h(x, z) - 0.01, z);
    }
    const guard = new THREE.CylinderGeometry(0.17, 0.26, 0.85, 7);
    for (const [x, z] of MED_TREES) p.add(guard, 0x1d1e21, x, h(x, z) + 0.42, z);
    for (const s of [13.6, 46.2]) {
      const [x, z] = MED.at(s, 0);
      for (const k of [-1, 1]) A.lamp(x, z, [MED.V[0] * k, MED.V[1] * k], 10, 2.2);
    }
  }

  return {
    update(car) {
      if (!car) return;
      for (const part of parts) {
        if (part.built || Math.hypot(car.x - part.centre[0], car.z - part.centre[1]) > 300) continue;
        if (part.ready.every((q) => world.ready(q[0], q[1]))) build(part);
      }
    },
  };
}
