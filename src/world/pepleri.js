// Pepleri tänav on the lap, from the Kuperjanovi end to the turn onto Vanemuise (Martin, 19 Nov, from his
// street views of Aug 2024), built by hand over the map's plain blocks, in pastel colours:
//   - Maarja kirik: the blue and white west front with its tower, belfry, spire and gold cross, the flags by
//     the door, and the old red-brick nave with arched windows behind it (the map's block is hidden)
//   - the bollards, lamp and signs of the church square, the cars standing on it
//   - Ettevõtluskõrgkool Mainor: the red front with white bands, quoins and lettering, the flags, and the
//     glass stair tower with its canopy on the left
//   - the white 1950s block beside it and the yellow one opposite the church, the latter in scaffolding
//   - the bird and the blue abstract painted on the gables at the Tiigi crossing, a third on the gable
//     over the car park at Vanemuise
//   - plank fences, hedges, thujas, a hydrant, lamps and signs (all the posts can be knocked over)
// The ground: block paving on the church square, zebra crossings at Tiigi and at Vanemuise, and on Vanemuise
// after the turn the two solid lines that set the cycle lanes off (no centre line there).
import * as THREE from 'three';
import { Parts, BOX } from '../race/landmarks.js';
import { createTrack } from '../race/race.js';
import { setHouseColours, leafyPlants, streetKit } from './streetkit.js';
import { paintScale } from './paintscale.js';

const CENTRE = [1150, 3340];
const COL = {
  blue: 0xa3bce6, blueDark: 0x86a3d4, white: 0xf6f7fb, stone: 0xd9dbe3, brick: 0xc0655a, brickDark: 0xa9544c, pink: 0xeab9b2,
  roof: 0x666b7c, spire: 0x5f6d86, gold: 0xe8c45a, door: 0xa06a45, glass: 0x56657e, opening: 0x3b4353,
  steel: 0xb4bac6, plank: 0xd2bd92, red: 0xd8604e, dark: 0x3a3c46, canopy: 0x4b4a52, glassBlue: 0x5f7896,
  fence: 0xa9b4c6, slat: 0xe6e2d2, hydrant: 0xd4443c,
};

// ---------------------------------------------------------------- the map's blocks: colours, the church hidden
export function pepleriWalls(walls) {
  setHouseColours(walls, '2_6', 480, 3040, [
    { base: 3115, x: 1108.4, z: 3286.4, wall: 0xc0655a, hide: true, reach: 45 },          // Maarja kirik: by hand
    { base: 3221, x: 1074.4, z: 3229.8, wall: 0xf1eedd, roof: 0x8d93a3, reach: 15 },       // the white block
    { base: 3221, x: 1103.8, z: 3227.6, wall: 0xd8604e, roof: 0x8a5a55, reach: 14 },       // Mainor
    { base: 3221, x: 1095.7, z: 3227.6, wall: 0xd8604e, roof: 0x4b4a52, reach: 9 },
    { base: 3163, x: 1033.7, z: 3234.7, wall: 0xe2cf96, roof: 0x7a7f90, reach: 16 },       // the yellow wooden house
    { base: 3173, x: 1068.6, z: 3306.5, wall: 0x5f7896, roof: 0x8fa36c, reach: 40 },       // the glass house with the green roof
    { base: 3173, x: 1072.6, z: 3318.8, wall: 0x5f7896, roof: 0x8fa36c, reach: 40 },
  ]);
  setHouseColours(walls, '3_6', 1120, 3040, [
    { base: 3058, x: 1146.0, z: 3256.4, wall: 0xf0e29c, roof: 0x7d8394, reach: 40 },       // the yellow block
    { base: 3058, x: 1141.3, z: 3240.7, wall: 0xf0e29c, roof: 0x7d8394, reach: 40 },
    { base: 3058, x: 1156.6, z: 3268.5, wall: 0xf0e29c, roof: 0x7d8394, reach: 40 },
    { base: 2903, x: 1188.7, z: 3333.5, wall: 0xe6e5e2, roof: 0x5f6474, reach: 40 },       // the block with the bird
    { base: 2957, x: 1155.0, z: 3342.7, wall: 0xefe7c8, roof: 0xd9dce4, reach: 30 },       // the block with the blue painting
    { base: 2725, x: 1225.4, z: 3399.9, wall: 0xdedfe2, roof: 0x5f6474, reach: 40 },
  ]);
}

// ---------------------------------------------------------------- along the lap
let TRACK = null;
const LANES = { i0: 2081, i1: 2128, at: 2.15 };       // Vanemuise: solid lines this far either side of the middle
// before the road markings are built: Vanemuise after the turn has cycle lane lines, not a centre line
export function pepleriVectors(vectors) {
  TRACK ||= createTrack();
  const prev = vectors.markSkip;
  vectors.markSkip = (x, z) => {
    const n = TRACK.nearest(x, z);
    return (n.i >= LANES.i0 - 1 && n.i <= LANES.i1 + 1 && n.d < 3) || (prev ? prev(x, z) : false);
  };
}
// a point beside the lap at track index i, `lat` metres to the right of the direction of travel, and the heading there
function beside(i, lat) {
  TRACK ||= createTrack();
  const k = Math.floor(i), f = i - k, a = TRACK.P[k], b = TRACK.P[k + 1], [tx, tz] = TRACK.tan[k];
  return { x: a[0] + (b[0] - a[0]) * f - tz * lat, z: a[1] + (b[1] - a[1]) * f + tx * lat, yaw: Math.atan2(tx, -tz), deg: Math.atan2(tx, -tz) * 180 / Math.PI };
}

const LIGHT = 0, BOLLARD = 8, PROHIBIT = 11, NOENTRY = 12, YIELD = 15, INFO = 18;
// knockable street furniture: [kind, x, z, bearing]
export function pepleriProps() {
  const out = [];
  // the row of bollards between the pavement and the church square
  for (let k = 0; k < 18; k++) out.push([BOLLARD, 1050 + k * 2.3, 3256.6 - k * 0.14, 0]);
  for (let k = 1; k < 5; k++) out.push([BOLLARD, 1089.1 + k * 0.9, 3254.2 + k * 2.0, 0]);
  out.push([LIGHT, 1062.2, 3254.6, 5], [LIGHT, 1062.2, 3254.6, 185]);                       // the two-armed lamp on the square
  out.push([INFO, 1064.6, 3254.4, 275], [INFO, 1093.2, 3253.2, 275]);                       // the parking signs
  out.push([PROHIBIT, 1049.2, 3242.4, 275], [NOENTRY, 1066.5, 3240.9, 275], [YIELD, 1046.4, 3255.4, 200]);
  const lamp = (i, lat) => { const q = beside(i, lat); out.push([LIGHT, q.x, q.z, q.deg + (lat > 0 ? -90 : 90)]); };
  lamp(1964, 6.3); lamp(1998, -6.2); lamp(2012, 5.3); lamp(2044, -6.1); lamp(2058, 5.4);
  const sign = (kind, i, lat) => { const q = beside(i, lat); out.push([kind, q.x, q.z, q.deg + 180]); };
  sign(PROHIBIT, 2004, -6.4); sign(YIELD, 2064, 5.5); sign(PROHIBIT, 2046, 6.0);
  return out;
}

// parked cars: [x, z, yaw, model, paint, lift] (stood there by parked.js, they can be shoved)
const carAt = (i, lat, id, paint, turn = 0) => { const q = beside(i, lat); return [q.x, q.z, q.yaw + turn, id, paint, 0.04]; };
export const PEPLERI_CARS = [
  [1082.8, 3252.6, -Math.PI / 2, 'rav4', 'white', 0.04], [1073.5, 3263.5, 1.4, 'f31', 'black', 0.04],                      // on the church square
  carAt(2030, -6.3, 'mazda6', 'blue'), carAt(2036.2, -6.3, 'rav4', 'black'),
  // none on the outside of the bend by Mainor and the yellow block, none inside the turn onto Vanemuise (Martin, 19 Nov)
];

// ---------------------------------------------------------------- painted walls
// A picture of a wall drawn in metres (x along it, y up from its foot).
function painting(wm, hm, draw) {
  const ppm = Math.min(44 * paintScale(), 2048 / wm, 2048 / hm);
  const cv = document.createElement('canvas');
  cv.width = Math.max(4, Math.round(wm * ppm)); cv.height = Math.max(4, Math.round(hm * ppm));
  const c = cv.getContext('2d');
  c.setTransform(ppm, 0, 0, -ppm, 0, cv.height);
  const P = {
    c, w: wm, h: hm,
    r(x0, y0, x1, y1, col) { c.fillStyle = col; c.fillRect(x0, y0, x1 - x0, y1 - y0); },
    poly(pts, col) { c.fillStyle = col; c.beginPath(); pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); },
    line(pts, col, lw) { c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); },
    disc(x, y, rx, ry, col, rot = 0) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fill(); },
    measure(str, size, font = 'Georgia, "Times New Roman", serif') { c.font = `${size * ppm}px ${font}`; return c.measureText(str).width / ppm; },
    text(str, x, y, size, col, font = 'Georgia, "Times New Roman", serif', spacing = 0) {
      c.save(); c.translate(x, y); c.scale(1 / ppm, -1 / ppm);
      c.fillStyle = col; c.font = `${size * ppm}px ${font}`; c.textBaseline = 'middle';
      if ('letterSpacing' in c) c.letterSpacing = `${spacing * ppm}px`;
      c.fillText(str, 0, 0); c.restore();
    },
    // a window: surround, frame, glass, `panes` across and a transom
    win(x0, y0, x1, y1, { surround = '#f4f4f6', frame = '#f4f4f6', glass = '#5a6b86', panes = 2, sw = 0.12, transom = 0.7 } = {}) {
      if (sw) P.r(x0 - sw, y0 - sw, x1 + sw, y1 + sw, surround);
      P.r(x0, y0, x1, y1, frame);
      const m = 0.07, pw = (x1 - x0 - m) / panes;
      for (let k = 0; k < panes; k++) {
        const a = x0 + m + k * pw;
        if (transom) { P.r(a, y0 + m, a + pw - m, y0 + (y1 - y0) * transom - m / 2, glass); P.r(a, y0 + (y1 - y0) * transom + m / 2, a + pw - m, y1 - m, glass); }
        else P.r(a, y0 + m, a + pw - m, y1 - m, glass);
      }
      c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(x0 + m, y0 + (y1 - y0) * 0.55, (x1 - x0) * 0.4, (y1 - y0) * 0.3);
    },
  };
  draw(P);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// a wall from a to b with the street on its right-hand side
function wallOf(a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
  return { a, b, len, ux, uz, nx: -uz, nz: ux, yaw: Math.atan2(-uz, ux), at: (s, n = 0) => [a[0] + ux * s - uz * n, a[1] + uz * s + ux * n] };
}

// ---------------------------------------------------------------- the pictures on the gables
function birdMural(P) {
  const { w, h } = P;
  P.r(0, 0, w, h, '#e6e4de');
  P.r(0, 0, w, 1.3, '#b9b8b6');
  // the pale underside sweeping down to the left
  P.poly([[0.3, 2.2], [0.2, 9.5], [1.6, 12.6], [4.2, 9.0], [3.4, 4.2], [1.5, 1.6]], '#cfcdc8');
  for (let k = 0; k < 16; k++) P.line([[0.5 + k * 0.2, 2.4 + k * 0.1], [1.2 + k * 0.2, 9.6 - k * 0.2]], 'rgba(120,118,116,0.5)', 0.05);
  // the ochre back and wing
  P.poly([[0.4, 10.2], [1.4, 14.6], [4.6, 15.6], [8.2, 14.4], [9.6, 11.4], [8.8, 8.4], [6.6, 6.0], [5.0, 4.4], [3.9, 6.6], [3.0, 9.6]], '#e6a23f');
  P.poly([[3.0, 9.6], [3.9, 6.6], [5.0, 4.4], [5.9, 3.0], [6.5, 5.6], [5.4, 8.6]], '#d98f2f');
  // dark feathers: long quills fanning from the shoulder
  for (let k = 0; k < 13; k++) {
    const t = k / 12, x0 = 2.0 + t * 5.6, y0 = 14.6 - t * 1.0;
    P.line([[x0, y0], [x0 + 0.5 - t * 1.4, y0 - 2.8], [x0 + 0.2 - t * 2.6, y0 - 5.6 - t * 1.4]], k % 3 ? '#2b2a2c' : '#f1eee6', k % 3 ? 0.2 : 0.13);
  }
  for (let k = 0; k < 9; k++) P.line([[1.0 + k * 0.45, 10.8 + k * 0.42], [1.9 + k * 0.5, 12.0 + k * 0.3]], '#2b2a2c', 0.12);
  // head and beak, looking down to the right
  P.disc(8.9, 8.2, 1.55, 1.2, '#2b2a2c', 0.5);
  P.poly([[9.6, 7.5], [11.2, 6.3], [9.4, 6.9]], '#2b2a2c');
  P.disc(9.3, 8.0, 0.2, 0.2, '#f1eee6');
  P.poly([[7.2, 9.4], [8.2, 10.6], [9.6, 9.6], [8.6, 8.9]], '#e6a23f');
  // breast and legs
  P.poly([[6.6, 6.0], [8.2, 7.2], [8.9, 5.8], [7.6, 3.6], [6.2, 3.2]], '#efe9dc');
  P.line([[7.0, 3.5], [6.6, 1.9], [7.2, 1.5]], '#2b2a2c', 0.1);
  P.line([[6.4, 3.4], [5.8, 1.9], [6.3, 1.5]], '#2b2a2c', 0.1);
  for (const x of [2.7, 7.3]) for (const y of [2.3, 5.3, 8.3, 11.3]) P.win(x, y, x + 1.5, y + 1.5, { panes: 2, transom: 0 });
}
function blueMural(P) {
  const { w, h, c } = P;
  P.r(0, 0, w, h, '#d9d6dc');
  P.r(0, 0, w, 1.2, '#b9b8b6');
  // pale dotted fields
  const dots = (x0, y0, x1, y1) => { P.r(x0, y0, x1, y1, '#e9e3ea'); for (let x = x0 + 0.12; x < x1; x += 0.24) for (let y = y0 + 0.12; y < y1; y += 0.24) P.disc(x, y, 0.05, 0.05, '#bdb2c4'); };
  dots(3.0, 10.5, 5.4, h); dots(6.6, 11.0, 8.6, h); dots(0.2, 1.2, 1.6, 3.4); dots(8.6, 1.2, 10.4, 4.0);
  // big blue shapes
  c.fillStyle = '#2fb6e2';
  c.beginPath(); c.moveTo(0.4, 1.2); c.lineTo(0.4, 7.2); c.bezierCurveTo(1.2, 10.4, 4.2, 10.6, 5.2, 8.2); c.lineTo(5.2, 1.2); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(8.6, h); c.lineTo(w, h); c.lineTo(w, 4.0); c.bezierCurveTo(9.4, 6.4, 8.8, 9.6, 8.6, 12.5); c.closePath(); c.fill();
  P.poly([[5.6, 1.2], [7.0, 1.2], [8.2, 9.6], [6.9, 9.6]], '#53c4ea');
  // charcoal bands
  P.r(1.2, 7.2, 3.3, h, '#3c4250');
  P.poly([[4.6, 1.2], [5.8, 1.2], [6.9, 13.8], [5.4, 13.8]], '#3c4250');
  P.r(5.4, 13.0, 6.0, h, '#2fb6e2');
  P.poly([[7.6, 1.2], [9.4, 1.2], [8.6, 5.0], [7.9, 5.0]], '#3c4250');
  // pink and pale blobs
  P.disc(7.8, 8.9, 0.9, 0.6, '#e8a8b4', 0.3);
  P.disc(0.9, 12.6, 0.7, 1.4, '#c9c3cf');
  P.line([[2.0, 1.4], [2.6, 5.4]], '#f0eef2', 0.06);
  for (const x of [3.6, 7.2]) for (const y of [2.2, 5.1, 8.0, 10.9]) P.win(x, y, x + 1.4, y + 1.5, { panes: 2, transom: 0, surround: '#3c4250', frame: '#d9d6dc', glass: '#4d5b72' });
}
function bandMural(P) {
  const { w, h } = P;
  P.r(0, 0, w, h, '#e7e0d2');
  P.r(0, 0, w, 3.1, '#cfcdcf');
  const cols = ['#58a79d', '#e7e0d2', '#4f6475', '#c7a47c', '#e7e0d2', '#7fbdb3', '#3f5262', '#efe9dc'];
  // nested angular bands stepping across the wall
  for (let k = 0; k < 14; k++) {
    const o = k * 0.62, col = cols[k % cols.length];
    P.line([[-1 + o, 3.4], [2.2 + o * 0.6, 7.4 + o * 0.3], [0.6 + o, 10.6], [4.2 + o * 0.5, 13.2 + o * 0.2], [3.0 + o, h + 1]], col, 0.46);
  }
  for (let k = 0; k < 6; k++) P.line([[7.4 + k * 0.6, 3.4], [9.6 + k * 0.4, 6.2], [8.2 + k * 0.6, 8.8]], cols[(k + 3) % cols.length], 0.4);
  P.r(0, 0, w, 3.1, '#cfcdcf');
  P.win(0.9, 1.3, 2.3, 2.3, { panes: 2, transom: 0, sw: 0.08 });
}

// ---------------------------------------------------------------- the house fronts
function mainorFront(P, { letters = true, cols = 8 } = {}) {
  const { w, h } = P, red = '#de6a57', white = '#f5f2ee';
  P.r(0, 0, w, h, red);
  P.r(0, 0, w, 1.35, '#b9bcc6'); P.r(0, 1.25, w, 1.45, white);                 // the grey plinth and its top course
  P.r(0, 4.55, w, 4.85, white); P.r(0, 4.95, w, 5.05, white);                   // band under the first floor
  P.r(0, 8.15, w, 8.3, white); P.r(0, 8.95, w, 9.1, white);                     // the frieze with the lettering
  P.r(0, h - 0.75, w, h, white); P.r(0, h - 1.0, w, h - 0.9, white);            // the cornice
  for (let k = 0; k < 40; k++) P.r(0.2 + k * (w - 0.4) / 40, h - 0.72, 0.2 + k * (w - 0.4) / 40 + 0.18, h - 0.5, '#d9d4cf');
  // quoins on the corners of the ground floor, pilaster strips above
  for (const x of [0, w - 0.75]) {
    for (let k = 0; k < 7; k++) P.r(x + (k % 2 ? 0.1 : 0), 1.5 + k * 0.44, x + 0.75 - (k % 2 ? 0 : 0.1), 1.5 + k * 0.44 + 0.38, white);
    P.r(x + 0.12, 5.05, x + 0.63, h - 1.0, white); P.r(x + 0.22, 5.2, x + 0.53, h - 1.15, red);
  }
  const step = (w - 2.6) / cols;
  for (let k = 0; k < cols; k++) {
    const x = 1.3 + step * (k + 0.5);
    P.r(x - 0.35, 0.35, x + 0.35, 1.0, '#4b5263');                                            // cellar windows
    P.win(x - 0.6, 2.0, x + 0.6, 4.1, { glass: '#4b5a74', sw: 0.16 });
    P.r(x - 0.85, 4.2, x + 0.85, 4.38, white);
    P.win(x - 0.6, 5.6, x + 0.6, 7.75, { glass: '#4b5a74', sw: 0.16 });
    P.r(x - 0.9, 7.86, x + 0.9, 8.04, white); P.r(x - 0.8, 5.3, x + 0.8, 5.44, white);
    P.win(x - 0.6, 9.5, x + 0.6, 11.4, { glass: '#4b5a74', sw: 0.16 });
    P.r(x - 0.85, 11.5, x + 0.85, 11.66, white);
  }
  if (letters) {
    const str = 'ETTEVÕTLUSKÕRGKOOL MAINOR', size = 0.62;
    const spaced = 'letterSpacing' in P.c, tw = P.measure(str, size), sp = spaced ? Math.max(0, (w - 3.0 - tw) / (str.length - 1)) : 0;
    P.text(str, spaced ? 1.5 : (w - tw) / 2, 8.62, size, white, undefined, sp);
    P.r(1.5, 3.0, 2.5, 3.3, '#eef0f4'); P.text('Pepleri 6', 1.56, 3.15, 0.2, '#30405c', 'Arial, sans-serif');
  }
}
// a rendered 1950s block: `cols` window columns, four floors, doors at the given columns
function blockFront(P, { wall, cols, doors = [], frame = '#f4f4f6', glass = '#56667f', panes = 2, ww = 1.5, plinth = '#b4b6c0', bands = false, floors = 4, f0 = 1.9, fh = 3.0, wh = 1.55 }) {
  const { w, h } = P;
  P.r(0, 0, w, h, wall);
  P.r(0, 0, w, 1.0, plinth); P.r(0, 0.95, w, 1.05, 'rgba(0,0,0,0.12)');
  if (bands) { P.r(0, 1.05, w, 1.2, 'rgba(255,255,255,0.5)'); P.r(0, h - 0.5, w, h - 0.38, 'rgba(255,255,255,0.6)'); }
  P.r(0, h - 0.22, w, h, '#77798a');
  const step = w / cols;
  for (let k = 0; k < cols; k++) {
    const x = step * (k + 0.5), door = doors.includes(k);
    for (let f = 0; f < floors; f++) {
      const y = f0 + f * fh;
      if (door && f === 0) continue;
      if (door) { P.win(x - 0.55, y - 1.3, x + 0.55, y + 0.4, { frame, glass, panes: 1, sw: 0.08 }); continue; }       // stair windows sit half a floor lower
      P.win(x - ww / 2, y, x + ww / 2, y + wh, { frame, glass, panes, sw: 0.1 });
      P.r(x - ww / 2 - 0.16, y - 0.2, x + ww / 2 + 0.16, y - 0.1, 'rgba(255,255,255,0.75)');
    }
    if (door) {
      P.r(x - 1.0, 0, x + 1.0, 2.75, '#e9e2c6'); P.r(x - 0.7, 0.15, x + 0.7, 2.45, '#7d8698');
      P.r(x - 0.03, 0.15, x + 0.03, 2.45, '#5c6474'); P.r(x - 0.6, 1.5, x - 0.12, 2.3, glass); P.r(x + 0.12, 1.5, x + 0.6, 2.3, glass);
      P.r(x - 1.25, 2.75, x + 1.25, 2.93, '#8a8c9a');
    } else P.r(x - 0.3, 0.3, x + 0.3, 0.7, '#5a6072');
  }
}

export function createPepleri(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function build() {
    built = true;
    const p = new Parts(), leafy = leafyPlants(group, shadows);
    const hAt = (x, z) => world.heightAt(x, z);

    // a painted sheet standing `off` metres in front of a wall, from height y0 (world) up `hm` metres; with a
    // `peak` the top is a gable that high over the middle
    const sheet = (W, y0, hm, tex, { off = 0.07, peak = 0, s0 = 0, s1 = W.len } = {}) => {
      const A = W.at(s0, off), B = W.at(s1, off), M = W.at((s0 + s1) / 2, off), H = hm + peak;
      const pos = [A[0], y0, A[1], B[0], y0, B[1], B[0], y0 + hm, B[1], A[0], y0, A[1], B[0], y0 + hm, B[1], A[0], y0 + hm, A[1]];
      const uv = [0, 0, 1, 0, 1, hm / H, 0, 0, 1, hm / H, 0, hm / H];
      if (peak) { pos.push(A[0], y0 + hm, A[1], B[0], y0 + hm, B[1], M[0], y0 + H, M[1]); uv.push(0, hm / H, 1, hm / H, 0.5, 1); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const nor = [];
      for (let k = 0; k < pos.length / 3; k++) nor.push(W.nx, 0, W.nz);
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
      m.receiveShadow = true;
      group.add(m);
    };
    // a box against a wall: s along it, y above y0, standing out from `off`
    const slab = (W, y0, s0, s1, a, b, off, th, hex) => { const [x, z] = W.at((s0 + s1) / 2, off + th / 2); p.box(s1 - s0, b - a, th, hex, x, y0 + (a + b) / 2, z, W.yaw); };

    // ================================================================ Maarja kirik
    {
      const G = 31.15, F0 = [1095.85, 3264.5], u = [0.4947, 0.8691], v = [0.8691, -0.4947];
      const yaw = Math.atan2(-v[1], v[0]);
      const at = (a, b) => [F0[0] + u[0] * a + v[0] * b, F0[1] + u[1] * a + v[1] * b];
      // a box in the church's frame: a along the nave from the west front, b across it, y above the ground
      const cb = (a0, a1, b0, b1, y0, y1, hex) => { const [x, z] = at((a0 + a1) / 2, (b0 + b1) / 2); p.box(Math.abs(b1 - b0), y1 - y0, Math.abs(a1 - a0), hex, x, G + (y0 + y1) / 2, z, yaw); };
      // triangles given in the church's frame as [a, b, y], wound to face up or outwards from the middle
      const tris = (list, hex, mid = [25, 0, 8]) => {
        const pos = [];
        for (const t of list) {
          const q = t.map(([a, b, y]) => [...at(a, b), y]).map(([x, z, y]) => [x, G + y, z]);
          const c = t.reduce((s, e) => [s[0] + e[0] / 3, s[1] + e[1] / 3, s[2] + e[2] / 3], [0, 0, 0]);
          const [mx, mz] = at(mid[0], mid[1]), [cx, cz] = at(c[0], c[1]);
          const ux = q[1][0] - q[0][0], uy = q[1][1] - q[0][1], uz = q[1][2] - q[0][2], vx = q[2][0] - q[0][0], vy = q[2][1] - q[0][1], vz = q[2][2] - q[0][2];
          const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
          const out = n[0] * (cx - mx) + n[1] * (c[2] - mid[2]) + n[2] * (cz - mz);
          pos.push(...q[0], ...(out >= 0 ? q[1] : q[2]), ...(out >= 0 ? q[2] : q[1]));
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.computeVertexNormals();
        p.add(g, hex, 0, 0, 0);
      };
      // an arched opening on a wall facing along the nave (dir 'a', at a = pos) or across it (dir 'b', at b = pos):
      // centre c along the wall, sill y0, spring y1, half width r; out: +1 or -1, the way the wall faces
      const arch = (dir, pos, out, c, y0, y1, r, hex, th = 0.08) => {
        const o0 = pos, o1 = pos + out * th;
        if (dir === 'a') cb(Math.min(o0, o1), Math.max(o0, o1), c - r, c + r, y0, y1, hex);
        else cb(c - r, c + r, Math.min(o0, o1), Math.max(o0, o1), y0, y1, hex);
        const g = new THREE.CylinderGeometry(r, r, th, 18);
        if (dir === 'a') g.rotateX(Math.PI / 2); else g.rotateZ(Math.PI / 2);
        const [x, z] = dir === 'a' ? at(pos + out * th / 2, c) : at(c, pos + out * th / 2);
        p.add(g, hex, x, G + y1, z, yaw);
      };
      const window = (dir, pos, out, c, y0, y1, r, glass = COL.glass) => {
        arch(dir, pos, out, c, y0 - 0.25, y1, r + 0.28, COL.white, 0.1);
        arch(dir, pos, out, c, y0, y1, r, glass, 0.16);
        // glazing bars
        const o = pos + out * 0.17;
        if (dir === 'a') { cb(o - 0.02, o + 0.02, c - 0.04, c + 0.04, y0, y1 + r * 0.9, COL.white); for (let y = y0 + 0.9; y < y1; y += 0.9) cb(o - 0.02, o + 0.02, c - r, c + r, y - 0.03, y + 0.03, COL.white); }
        else { cb(c - 0.04, c + 0.04, o - 0.02, o + 0.02, y0, y1 + r * 0.9, COL.white); for (let y = y0 + 0.9; y < y1; y += 0.9) cb(c - r, c + r, o - 0.02, o + 0.02, y - 0.03, y + 0.03, COL.white); }
      };

      // ---- the brick nave
      const NW = 10.55, N0 = 7.6, N1 = 50.9, EAVE = 11.1, RIDGE = 16.8;
      cb(N0, N1, -NW, NW, -1.2, EAVE, COL.brick);
      cb(N0 - 0.05, N1 + 0.08, -NW - 0.08, NW + 0.08, -1.2, 1.0, COL.stone);
      cb(N0, N1 + 0.14, -NW - 0.16, NW + 0.16, EAVE - 0.55, EAVE, COL.white);              // cornice
      cb(N0, N1 + 0.1, -NW - 0.1, NW + 0.1, EAVE - 0.85, EAVE - 0.7, COL.white);
      for (const side of [1, -1]) {
        for (let k = 0; k < 7; k++) {
          const c = 12.2 + k * 5.6;
          window('b', side * NW, side, c, 3.0, 7.6, 0.95);
          cb(c - 1.5, c + 1.5, side * NW, side * (NW + 0.07), 2.4, 2.62, COL.white);                       // sill course
        }
        for (let k = 0; k <= 7; k++) { const c = 9.4 + k * 5.6; cb(c - 0.42, c + 0.42, side * NW, side * (NW + 0.1), 1.0, EAVE - 0.85, COL.brickDark); }   // pilaster strips
      }
      // the rendered east end with its three windows
      cb(N1, N1 + 0.07, -NW, NW, 1.0, EAVE - 0.55, COL.pink);
      for (const b of [-6, 0, 6]) window('a', N1 + 0.07, 1, b, 3.0, 7.2, 0.9);
      // the roof: a ridge along the nave, hipped at the east end
      {
        const o = 0.45, e = EAVE, r = RIDGE, h1 = N1 - 8.5;
        tris([
          [[N0, -NW - o, e], [N1 + o, -NW - o, e], [h1, 0, r]], [[N0, -NW - o, e], [h1, 0, r], [N0, 0, r]],
          [[N0, NW + o, e], [N1 + o, NW + o, e], [h1, 0, r]], [[N0, NW + o, e], [h1, 0, r], [N0, 0, r]],
          [[N1 + o, -NW - o, e], [N1 + o, NW + o, e], [h1, 0, r]],
        ], COL.roof, [25, 0, 0]);
        tris([[[N0, -NW, e], [N0, NW, e], [N0, 0, r]]], COL.white, [25, 0, 12]);          // the gable over the west front
      }

      // ---- the west front: a broad two-storey block in blue with white dressings
      const FW = 11.3, FD = 8.0, FH = 11.5;
      cb(-0.4, FD, -FW, FW, -1.2, FH, COL.blue);
      cb(-0.5, FD + 0.05, -FW - 0.1, FW + 0.1, -1.2, 0.9, COL.white);                       // plinth
      cb(-0.62, FD + 0.1, -FW - 0.22, FW + 0.22, FH - 1.25, FH - 0.95, COL.white);           // architrave
      cb(-0.75, FD + 0.15, -FW - 0.35, FW + 0.35, FH - 0.4, FH, COL.white);                  // cornice
      cb(-0.5, FD, -FW - 0.1, FW + 0.1, FH - 0.95, FH - 0.4, COL.blueDark);                  // frieze
      cb(-0.6, FD + 0.1, -FW - 0.2, FW + 0.2, FH, FH + 0.25, COL.stone);                     // the flat roof
      for (const s of [1, -1]) {
        cb(-0.55, 0.6, s * (FW - 1.3), s * (FW + 0.12), 0.9, FH - 1.25, COL.white);          // corner pilasters
        cb(FD - 1.0, FD + 0.08, s * (FW - 0.2), s * (FW + 0.12), 0.9, FH - 1.25, COL.white);
        cb(-0.5, 1.0, s * (FW - 0.2), s * (FW + 0.12), 0.9, FH - 1.25, COL.white);
        window('a', -0.4, -1, s * 7.2, 2.6, 6.6, 0.85);                                     // the tall arched windows of the front
        cb(-0.5, -0.4, s * 7.2 - 1.0, s * 7.2 + 1.0, 8.3, 9.3, COL.white);                   // blind panels over them
        window('b', s * FW, s, 3.8, 2.6, 6.6, 0.85);                                        // and one on each side
      }
      // the middle bay under the tower stands forward: pilasters, the door in its pedimented surround
      cb(-1.3, 0, -4.7, 4.7, -1.2, FH, COL.blue);
      cb(-1.4, 0, -4.8, 4.8, -1.2, 0.9, COL.white);
      cb(-1.5, 0, -4.9, 4.9, FH - 1.25, FH - 0.95, COL.white);
      cb(-1.65, 0, -5.05, 5.05, FH - 0.4, FH, COL.white);
      cb(-1.4, 0, -4.8, 4.8, FH - 0.95, FH - 0.4, COL.blueDark);
      for (const s of [1, -1]) cb(-1.42, -0.2, s * 3.6, s * 4.82, 0.9, FH - 1.25, COL.white);
      cb(-1.42, -1.3, -1.75, 1.75, 0.3, 4.3, COL.white);                                     // door surround
      cb(-1.47, -1.3, -1.05, 1.05, 0.3, 3.7, COL.door);
      cb(-1.5, -1.3, -0.03, 0.03, 0.3, 3.7, 0x7d4f33);
      for (const s of [1, -1]) for (const y of [0.7, 2.0]) cb(-1.5, -1.3, s * 0.2, s * 0.9, y, y + 1.0, 0x8b5a3a);
      cb(-1.62, -1.3, -2.1, 2.1, 4.3, 4.6, COL.white);
      tris([[[-1.5, -2.1, 4.6], [-1.5, 2.1, 4.6], [-1.5, 0, 5.6]], [[-1.3, -2.1, 4.6], [-1.3, 2.1, 4.6], [-1.3, 0, 5.6]],
        [[-1.5, -2.1, 4.6], [-1.3, -2.1, 4.6], [-1.3, 0, 5.6]], [[-1.5, -2.1, 4.6], [-1.3, 0, 5.6], [-1.5, 0, 5.6]],
        [[-1.5, 2.1, 4.6], [-1.3, 2.1, 4.6], [-1.3, 0, 5.6]], [[-1.5, 2.1, 4.6], [-1.3, 0, 5.6], [-1.5, 0, 5.6]]], COL.white, [-1.4, 0, 4.9]);
      cb(-1.36, -1.3, -1.0, 1.0, 6.6, 8.0, COL.white);                                       // the tablet over the door
      cb(-2.9, -1.3, -2.6, 2.6, -1.2, 0.16, COL.stone); cb(-3.3, -2.9, -2.6, 2.6, -1.2, 0.0, COL.stone);   // steps
      // flags on slanting staffs beside the door: the Estonian tricolour and the town's white and red
      const flag = (b, stripes) => {
        const [x, z] = at(-1.4, b);
        p.add(BOX(0.05, 2.3, 0.05).translate(0, 1.15, 0).rotateX(-0.85), 0xd9dbe3, x, G + 3.3, z, yaw);
        stripes.forEach((hex, j) => p.add(BOX(0.03, 1.25, 0.26).translate(0, 1.6, -(0.15 + 0.26 * j)).rotateX(-0.85), hex, x, G + 3.3, z, yaw));
      };
      flag(-2.5, [0x3f77d6, 0x1c1c22, 0xf4f4f6]); flag(2.5, [0xf4f4f6, 0xd8453f, 0xf4f4f6]);
      { const [x, z] = at(9.2, 11.0); p.add(BOX(0.05, 2.3, 0.05).translate(0, 1.15, 0).rotateX(-0.85).rotateY(-Math.PI / 2), 0xd9dbe3, x, G + 3.0, z, yaw);
        [0x3f77d6, 0x1c1c22, 0xf4f4f6].forEach((hex, j) => p.add(BOX(0.03, 1.25, 0.26).translate(0, 1.6, -(0.15 + 0.26 * j)).rotateX(-0.85).rotateY(-Math.PI / 2), hex, x, G + 3.0, z, yaw)); }

      // ---- the tower, square stages stepping in, each with its cornice
      const TA = 3.4;                                                                        // its centre along the nave
      const stage = (half, y0, y1, hex = COL.blue) => cb(TA - half, TA + half, -half, half, y0, y1, hex);
      const sides = (half, f) => { f('a', TA - half, -1); f('a', TA + half, 1); f('b', half, 1); f('b', -half, -1); };
      const corner = (half, y0, y1, w = 0.75) => { for (const sa of [1, -1]) for (const sb of [1, -1]) cb(TA + sa * (half - w), TA + sa * (half + 0.1), sb * (half - w), sb * (half + 0.1), y0, y1, COL.white); };
      stage(4.75, FH, 14.3); stage(4.95, 14.3, 14.75, COL.white);                            // the plain base stage
      cb(TA - 4.85, TA + 4.85, -4.85, 4.85, FH + 0.25, FH + 0.6, COL.white);
      stage(3.9, 14.75, 22.0); corner(3.9, 14.75, 21.2); stage(4.05, 21.2, 21.5, COL.white); stage(4.3, 21.9, 22.3, COL.white);   // the belfry
      sides(3.9, (d, pos, out) => { arch(d, pos, out, d === 'a' ? 0 : TA, 16.2, 19.0, 1.25, COL.white, 0.1); arch(d, pos, out, d === 'a' ? 0 : TA, 16.4, 19.0, 0.95, COL.opening, 0.16); });
      stage(3.2, 22.3, 28.0); corner(3.2, 22.3, 27.3, 0.6); stage(3.35, 27.3, 27.55, COL.white); stage(3.6, 27.9, 28.3, COL.white);  // the lantern stage
      sides(3.2, (d, pos, out) => window(d, pos, out, d === 'a' ? 0 : TA, 23.6, 25.6, 0.8, 0xdfe6f2));
      { const [x, z] = at(TA, 0);
        p.add(new THREE.CylinderGeometry(2.25, 2.4, 2.4, 8), COL.blue, x, G + 29.5, z, yaw + Math.PI / 8);
        p.add(new THREE.CylinderGeometry(2.6, 2.6, 0.3, 8), COL.white, x, G + 30.85, z, yaw + Math.PI / 8);
        p.add(new THREE.ConeGeometry(2.35, 2.6, 8), COL.spire, x, G + 32.3, z, yaw + Math.PI / 8);            // the swelling foot of the spire
        p.add(new THREE.ConeGeometry(1.25, 13.6, 8), COL.spire, x, G + 37.8, z, yaw + Math.PI / 8);
        p.add(new THREE.SphereGeometry(0.32, 10, 8), COL.gold, x, G + 44.7, z, 0);
        p.box(0.09, 1.7, 0.09, COL.gold, x, G + 45.8, z, yaw);
        p.box(0.8, 0.09, 0.09, COL.gold, x, G + 46.1, z, yaw); }
    }

    // ================================================================ Mainor and the white block
    {
      const G = 32.21, EAVE = 12.8;
      const S = wallOf([1096.0, 3236.8], [1114.8, 3236.9]), E = wallOf([1114.8, 3236.9], [1115.0, 3221.3]);
      sheet(S, G - 0.6, EAVE + 0.6, painting(S.len, EAVE + 0.6, (P) => { P.c.translate(0, 0.6); P.r(0, -0.6, S.len, 0, '#b9bcc6'); P.h = EAVE; mainorFront(P); }));
      sheet(E, G - 0.6, EAVE + 0.6, painting(E.len, EAVE + 0.6, (P) => { P.c.translate(0, 0.6); P.r(0, -0.6, E.len, 0, '#b9bcc6'); P.h = EAVE; mainorFront(P, { letters: false, cols: 6 }); }));
      slab(S, G, -0.3, S.len + 0.3, EAVE - 0.3, EAVE + 0.05, 0, 0.35, COL.white);             // the cornice stands out
      slab(E, G, -0.3, E.len + 0.3, EAVE - 0.3, EAVE + 0.05, 0, 0.35, COL.white);
      // two flags over the door end: the tricolour and the school's green and white
      const flag = (s, stripes) => {
        const [x, z] = S.at(s, 0.1);
        p.add(BOX(0.05, 2.2, 0.05).translate(0, 1.1, 0).rotateX(0.9), 0xd9dbe3, x, G + 4.6, z, S.yaw);
        stripes.forEach((hex, j) => p.add(BOX(0.03, 1.2, 0.26).translate(0, 1.5, 0.15 + 0.26 * j).rotateX(0.9), hex, x, G + 4.6, z, S.yaw));
      };
      flag(2.2, [0x3f77d6, 0x1c1c22, 0xf4f4f6]); flag(2.9, [0x6aa05a, 0xf4f4f6, 0x6aa05a]);

      // the glass stair tower on the left, its dark roof slab, the canopy on two posts and the steps
      const T = wallOf([1086.7, 3231.9], [1096.0, 3231.8]);
      slab(T, G, 0, T.len, -0.6, 15.6, -0.5, 0.56, COL.glassBlue);
      slab(T, G, 0, 3.0, 4.2, 15.6, 0.06, 0.06, COL.red);
      for (let k = 0; k <= 5; k++) slab(T, G, 3.0 + k * (T.len - 3.0) / 5 - 0.04, 3.0 + k * (T.len - 3.0) / 5 + 0.04, 4.2, 15.6, 0.06, 0.08, COL.dark);
      for (const y of [4.2, 7.0, 9.8, 12.6, 15.5]) slab(T, G, 3.0, T.len, y - 0.05, y + 0.05, 0.06, 0.08, COL.dark);
      slab(T, G, 4.6, 5.6, 9.0, 10.4, 0.1, 0.03, 0xe2c64a);                                    // the yellow banner behind the glass
      slab(T, G, -0.6, T.len + 0.4, 15.6, 15.95, -6.0, 7.2, COL.canopy);
      slab(T, G, 3.2, T.len - 0.4, 0.2, 3.9, 0.02, 0.06, 0x2e3340);                            // the dark glazed entrance
      slab(T, G, -1.0, T.len + 0.6, 4.0, 4.3, 0, 6.4, COL.canopy);                             // the canopy
      for (const s of [-0.5, T.len + 0.1]) { const [x, z] = T.at(s, 5.9); p.add(new THREE.CylinderGeometry(0.11, 0.11, 5.2, 10), 0x9aa0ae, x, G + 1.5, z, 0); }
      for (let k = 0; k < 4; k++) slab(T, G, 1.0, T.len, -1.2, 0.72 - k * 0.2, 2.6 + k * 0.42, 0.42, COL.stone);
      slab(T, G, 1.0, T.len, -1.2, 0.74, 0, 2.6, COL.stone);

      // the white block: its street side and the gable end towards the yellow house
      const B = wallOf([1063.8, 3239.6], [1086.5, 3237.8]), BW = wallOf([1062.4, 3221.8], [1063.8, 3239.6]);
      const BE = 13.7;
      sheet(B, G - 0.6, BE + 0.6, painting(B.len, BE + 0.6, (P) => { P.c.translate(0, 0.6); P.r(0, -0.6, B.len, 0, '#b4b6c0'); P.h = BE; blockFront(P, { wall: '#f3f0e0', cols: 9, doors: [5], frame: '#3d3b42', glass: '#566279', panes: 2, ww: 1.45 }); }));
      sheet(BW, G - 0.6, BE + 0.6, painting(BW.len, BE + 0.6, (P) => { P.c.translate(0, 0.6); P.r(0, -0.6, BW.len, 0, '#b4b6c0'); P.h = BE; blockFront(P, { wall: '#f3f0e0', cols: 4, frame: '#3d3b42', glass: '#566279', panes: 2, ww: 1.45 }); }));
      slab(B, G, -0.3, B.len + 0.3, BE, BE + 0.16, 0, 0.5, 0x5e6070); slab(BW, G, -0.3, BW.len + 0.3, BE, BE + 0.16, 0, 0.3, 0x5e6070);
      { const [x, z] = B.at(B.len - 0.4, 0.14); p.add(new THREE.CylinderGeometry(0.06, 0.06, BE, 8), 0xd4d6de, x, G + BE / 2, z, 0); }
      { const [x, z] = B.at(3.0, -4); p.add(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 16).rotateX(1.1), 0xe9eaee, x, G + 17.6, z, B.yaw); }      // the satellite dish

      // the grey plank fence between the yellow house and the white block, bins behind its end
      const F = wallOf([1046.6, 3241.3], [1063.5, 3240.7]), fy = hAt(1055, 3241);
      slab(F, fy, 0, F.len, 0.05, 1.65, 0, 0.05, COL.fence);
      for (let s = 0; s <= F.len; s += 2.4) slab(F, fy, s - 0.06, s + 0.06, 0, 1.75, -0.08, 0.14, 0x8e98aa);
      for (let s = 0.15; s < F.len; s += 0.15) slab(F, fy, s - 0.008, s + 0.008, 0.08, 1.62, 0.05, 0.01, 0x8e98aa);
    }

    // ================================================================ the yellow block in its scaffolding
    {
      const G = 30.58, EAVE = 14.6;
      const W = wallOf([1128.3, 3237.1], [1153.0, 3281.6]), N = wallOf([1139.1, 3231.1], [1128.3, 3237.1]);
      sheet(W, G - 0.8, EAVE + 0.8, painting(W.len, EAVE + 0.8, (P) => { P.c.translate(0, 0.8); P.r(0, -0.8, W.len, 0, '#aeb0ba'); P.h = EAVE; blockFront(P, { wall: '#f2e49c', cols: 17, doors: [2, 8, 14], panes: 3, ww: 1.75, bands: true, f0: 2.0, fh: 3.1 }); }));
      sheet(N, G - 0.8, EAVE + 0.8, painting(N.len, EAVE + 0.8, (P) => { P.c.translate(0, 0.8); P.r(0, -0.8, N.len, 0, '#aeb0ba'); P.h = EAVE; blockFront(P, { wall: '#f2e49c', cols: 3, panes: 2, ww: 1.3, bands: true, f0: 2.0, fh: 3.1 }); }));
      // tube scaffolding: standards every 2.5 m in two rows, ledgers and planks at every lift, guard rails
      const scaffold = (F, top) => {
        const n = Math.round((F.len - 0.6) / 2.5), step = (F.len - 0.6) / n, y0 = Math.min(hAt(...F.at(0, 1)), hAt(...F.at(F.len, 1)), G) - 0.3;
        const lifts = [];
        for (let y = 2.1; y < top; y += 2.05) lifts.push(G + y);
        for (let k = 0; k <= n; k++) for (const o of [0.3, 1.15]) {
          const [x, z] = F.at(0.3 + k * step, o);
          p.add(new THREE.CylinderGeometry(0.03, 0.03, G + top + 1.3 - y0, 5), COL.steel, x, (G + top + 1.3 + y0) / 2, z, 0);
        }
        for (const y of lifts) {
          for (const o of [0.3, 1.15]) slab(F, 0, 0.3, F.len - 0.3, y - 0.03, y + 0.03, o - 0.03, 0.06, COL.steel);
          slab(F, 0, 0.3, F.len - 0.3, y + 0.03, y + 0.08, 0.34, 0.78, COL.plank);
          slab(F, 0, 0.3, F.len - 0.3, y + 1.0, y + 1.05, 1.13, 0.05, COL.steel);
          slab(F, 0, 0.3, F.len - 0.3, y + 0.08, y + 0.23, 1.1, 0.03, COL.plank);              // toe board
          for (let k = 0; k <= n; k++) { const [x, z] = F.at(0.3 + k * step, 0.72); p.box(0.05, 0.05, 0.85, COL.steel, x, y - 0.06, z, F.yaw); }
        }
      };
      scaffold(W, EAVE); scaffold(N, EAVE);
    }

    // ================================================================ the painted gables
    {
      const bird = wallOf([1179.3, 3303.5], [1168.4, 3309.5]);
      sheet(bird, 29.03 - 0.6, 15.1, painting(bird.len, 17.3, (P) => { P.c.translate(0, 0.6); P.r(0, -0.6, bird.len, 0, '#b9b8b6'); P.h = 16.7; birdMural(P); }), { peak: 2.2 });
      const blue = wallOf([1151.0, 3324.3], [1141.0, 3329.8]);
      sheet(blue, 29.57 - 0.6, 14.5, painting(blue.len, 16.6, (P) => { P.c.translate(0, 0.6); P.r(0, -0.6, blue.len, 0, '#b9b8b6'); P.h = 16.0; blueMural(P); }), { peak: 2.1 });
      const band = wallOf([1235.0, 3429.9], [1245.8, 3423.9]);
      sheet(band, 27.25 - 0.6, 15.6, painting(band.len, 17.7, (P) => { P.c.translate(0, 0.6); P.r(0, -0.6, band.len, 0, '#cfcdcf'); P.h = 17.1; bandMural(P); }), { peak: 2.1 });
    }

    // ================================================================ small things along the street
    {
      // the red hydrant on the church side
      { const q = beside(1979, 5.7), y = hAt(q.x, q.z);
        p.add(new THREE.CylinderGeometry(0.11, 0.13, 0.75, 10), COL.hydrant, q.x, y + 0.37, q.z, 0);
        p.add(new THREE.SphereGeometry(0.13, 10, 6), COL.hydrant, q.x, y + 0.76, q.z, 0);
        p.box(0.42, 0.1, 0.1, COL.hydrant, q.x, y + 0.52, q.z, q.yaw); }
      // a hedge: bushes shoulder to shoulder from a to b
      const hedge = (a, b, width, height) => {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / (width * 0.8))), yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
        for (let k = 0; k <= n; k++) {
          const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n;
          if (world.sdfAt(x, z) < 0.3) continue;
          if (leafy.ok) leafy.bush(x, hAt(x, z) - 0.05, z, width * 1.5, height, yaw + k, [0.8 + (k % 3) * 0.05, 0.95, 0.8], width);
          else p.box(len / n + 0.1, height, width, 0x5fa565, x, hAt(x, z) + height / 2, z, yaw);
        }
      };
      const along = (i0, i1, lat, width, height) => { const a = beside(i0, lat), b = beside(i1, lat); hedge([a.x, a.z], [b.x, b.z], width, height); };
      hedge([1228.6, 3466.5], [1240.6, 3488.2], 1.4, 1.6); hedge([1232.2, 3464.6], [1244.0, 3486.0], 1.4, 1.6);       // the clipped rows past the junction
      // the slatted fence with thujas behind it on the right before the junction
      { const a = beside(2039, 7.4), b = beside(2052, 7.4), F = wallOf([b.x, b.z], [a.x, a.z]), fy = Math.min(hAt(a.x, a.z), hAt(b.x, b.z));
        if (world.sdfAt(a.x, a.z) > 0.3 && world.sdfAt(b.x, b.z) > 0.3) {
          slab(F, fy, 0, F.len, -0.2, 0.3, 0, 0.14, 0xcfcbbf);
          for (let s = 0.06; s < F.len; s += 0.13) slab(F, fy, s - 0.04, s + 0.04, 0.3, 1.35, 0.03, 0.03, COL.slat);
          for (let s = 0; s <= F.len + 0.01; s += F.len / 6) slab(F, fy, s - 0.09, s + 0.09, 0.3, 1.45, 0, 0.14, 0xcfcbbf);
          for (let k = 0; k < 9; k++) { const [x, z] = F.at(1 + k * (F.len - 2) / 8, -1.3); if (world.sdfAt(x, z) > 0.4) { if (leafy.ok) leafy.thuja(x, hAt(x, z), z, 2.3 + (k % 3) * 0.3, 0.55, k); else p.add(new THREE.ConeGeometry(0.55, 2.4, 8), 0x3f7d55, x, hAt(x, z) + 1.2, z, 0); } }
        } }
      // round bushes on the lawn under the bird and by the doors of that block
      for (const [i, lat, r] of [[1999, -9.5, 2.6], [2001.5, -10.5, 2.2], [2010, -9.0, 1.8]]) {
        const q = beside(i, lat);
        if (world.sdfAt(q.x, q.z) < 0.5) continue;
        if (leafy.ok) leafy.bush(q.x, hAt(q.x, q.z) - 0.1, q.z, r * 2, r * 1.3, i, [0.85, 0.95, 0.85]);
        else p.add(new THREE.IcosahedronGeometry(r, 1).scale(1, 0.7, 1), 0x5fa565, q.x, hAt(q.x, q.z) + r * 0.5, q.z, 0);
      }
    }

    // ================================================================ the ground
    {
      const K = streetKit(world, group, { shadows });
      const hw = (t) => { const k = Math.floor(t); return TRACK.HW[k] + (TRACK.HW[k + 1] - TRACK.HW[k]) * (t - k); };
      const F = { at: (t, lat) => { const q = beside(t, lat); return [q.x, q.z]; } };                 // along the lap, metres right of the middle
      const right = (d) => ({ at: (t, u) => { const q = beside(t, hw(t) + d(t, u)); return [q.x, q.z]; } });
      // the church square: a kerb, a band of pale paving along the street, darker blocks across the square
      K.ribbon(right((t, u) => -0.03 + u * 0.18), 1921, 1947, 0, 1, 'kerb', true);
      for (let b = 0; b < 2; b++) K.ribbon(right((t, u) => 0.15 + u * 2.5), 1921, 1947, b / 2, (b + 1) / 2, 'paver');
      for (let b = 0; b < 16; b++) K.ribbon(right((t, u) => 2.65 + u * 22), 1921, 1947, b / 16, (b + 1) / 16, 'dark');
      // a zebra: stripes half a metre wide lying along the road it crosses
      const zebra = (frame, t0, t1, lat0, lat1) => { for (let l = lat0 + 0.25; l + 0.5 <= lat1; l += 1.0) K.ribbon(frame, t0, t1, l, l + 0.5, 'white', true); };
      zebra(F, 1989.7, 1992.0, -4.6, 4.6);                                                            // across Pepleri at Tiigi
      zebra(F, 2064.9, 2067.2, -4.5, 4.5);                                                            // across Pepleri before Vanemuise
      zebra(F, 2078.2, 2080.5, -3.7, 3.7);                                                            // across Vanemuise after the turn
      // the side streets' zebras, in their own frames: t along the street, lat across it
      const street = (c, d) => ({ at: (t, lat) => [c[0] + d[0] * t - d[1] * lat, c[1] + d[1] * t + d[0] * lat] });
      zebra(street([1151.3, 3292.6], [0.872, -0.49]), -2, 2, -4, 4);                                  // Tiigi, towards the centre
      zebra(street([1113.6, 3317.2], [0.872, -0.49]), -2, 2, -4, 4);                                  // Tiigi, behind the church
      // inside the turn onto Vanemuise: a narrow kerbed strip of grass pavers between the road and the car park
      { const left = (d) => ({ at: (t, u) => { const q = beside(t, -(hw(t) + d(t, u))); return [q.x, q.z]; } }), nose = (t) => Math.min(1, (t - 2056.5) / 1.2, (2066.8 - t) / 1.2);
        K.ribbon(left((t, u) => -0.03 + u * 0.16), 2056.5, 2066.8, 0, 1, 'kerb', true);
        K.ribbon(left((t, u) => 0.13 + u * Math.max(0.05, 1.25 * nose(t))), 2056.5, 2066.8, 0, 1, 'turf', true);
        K.ribbon(left((t, u) => 0.13 + Math.max(0.05, 1.25 * nose(t)) + u * 0.14), 2056.5, 2066.8, 0, 1, 'kerb', true); }
      // Vanemuise: the solid lines of the two cycle lanes
      for (const side of [-1, 1]) K.ribbon(F, LANES.i0, LANES.i1, side * LANES.at - 0.07, side * LANES.at + 0.07, 'white', true);
      K.finish();
    }

    leafy.finish();
    const mesh = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    if (mesh) { mesh.castShadow = shadows; mesh.receiveShadow = true; group.add(mesh); }
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 520) return;
      if ([[1050, 3250], [1140, 3260], [1180, 3340], [1240, 3440]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
