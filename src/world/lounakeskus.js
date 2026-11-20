// Lõunakeskus, the shopping centre on Lääneringtee (Ringtee 75), Hotel Sophia on its south-east corner and the
// Tartu Teaduspark offices behind it (Martin, 20 Nov: the first batch of his pink outline round southern Tartu),
// from his Street View screenshots (Aug 2023, Jun 2024) and the Land Board's oblique air photos (Apr 2024).
// The map's own blocks keep their shapes; every wall gets a painted picture:
//  - the long front over the north-east car park: the black east half with the Coop Maksimarket band, the grey
//    TERE TULEMAST entrance with the blue "2", the shop sign band (ILU, Kalev, Salamander, Apranga ...) over
//    the glass shop fronts, the brown and orange panelled west half with APRANGA and my fitness, RESERVED and
//    terranova round the corner, the Euronics glass front with Jysk at the west end, Sinsay, Pepco and H&M;
//  - the black east end with dark fins and the billboard tower on its north corner (H&M, Rimi, Jysk, Takko);
//  - the south side: the open parking floor under the deck, the white wall with APOLLO and the gold letters;
//  - Hotel Sophia: white with dark window strips in pairs, black glass at the street, its name on top;
//  - the service walls at the back with loading doors;
//  - Teaduspark: the light green office with its name, the red brick blocks, the grey ribbed halls; Riia 181a.
// In 3D: the tall sign by the car park entrance, the gold "Lõunakeskus" letters on their frame on the roof, the
// billboard tower, Rimi Hyper boxes on the roof, the columnar thujas along the front, a few parked cars.
// No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { BOX } from '../race/landmarks.js';

const DEBUG = typeof location !== 'undefined' && /lkdebug/.test(location.search);
const S9 = ['-1_9', -1440, 4960], S10 = ['-1_10', -1440, 5600];
// [name, sector, base, at, reach, wall, roof]
const HOUSES = [
  ['mallW', S9, 3829, [-1280, 5385], 170, 0x5a4a42, 0x5c5e62],
  ['mallE', S9, 3981, [-1100, 5430], 150, 0x26272b, 0x5c5e62],
  ['ribbed', S9, 4090, [-1201, 5553], 45, 0x9ea3a8, 0x55585c],
  ['ribbed', S9, 4079, [-1214, 5595], 22, 0x8e9398, 0x55585c],
  ['green', S9, 4168, [-1131, 5562], 26, 0xb3cc84, 0x4e5054],
  ['green', S9, 4144, [-1155, 5553], 14, 0xb3cc84, 0x4e5054],
  ['brick', S9, 4061, [-1132, 5596], 28, 0x9b4a35, 0x4e5054],
  ['brick', S9, 4050, [-1162, 5593], 24, 0x9b4a35, 0x4e5054],
  ['brick', S10, 4166, [-1105, 5610], 24, 0x9b4a35, 0x4e5054],
  ['brick', S10, 4269, [-1085, 5618], 40, 0x9b4a35, 0x4e5054],
  ['beige', S10, 4326, [-1004, 5611], 70, 0xc9bda8, 0x55585c],
];

export function lounakeskusWalls(walls) {
  for (const S of [S9, S10]) {
    setHouseColours(walls, S[0], S[1], S[2], HOUSES.filter((H) => H[1] === S).map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
  }
}

const dot = (W, d) => W.nx * d[0] + W.nz * d[1];
const NNE = [0.46, -0.89], WNW = [-0.89, -0.46], SSW = [-0.46, 0.89], ESE = [0.89, 0.46];

// ---------------------------------------------------------------- paint helpers
function ribs(P, x0, x1, y0, y1, base, rib, step = 0.5) {
  P.r(x0, y0, x1, y1, base);
  for (let x = x0 + step / 2; x < x1; x += step) P.r(x, y0, x + 0.06, y1, rib);
}
// a glazed shop front: dark frame, mullions every 1.5 m, a transom
function glass(P, x0, x1, y0, y1, tint = '#4c5d6e', frameCol = '#1c1d20') {
  P.r(x0, y0, x1, y1, frameCol);
  P.grad(x0 + 0.08, y0 + 0.08, x1 - 0.08, y1 - 0.08, tint, '#2e3946');
  for (let x = x0 + 1.5; x < x1 - 0.3; x += 1.5) P.r(x - 0.04, y0, x + 0.04, y1, frameCol);
  if (y1 - y0 > 3) P.r(x0, y0 + 2.6, x1, y0 + 2.68, frameCol);
}
// a sign: a box with text in it
function sign(P, x, y, w, h, bg, fg, text, font = '700 %px Arial, sans-serif', k = 0.62) {
  if (bg) P.r(x - w / 2, y - h / 2, x + w / 2, y + h / 2, bg);
  P.text(text, x, y, h * k, fg, font);
}
const SERIF = 'italic 700 %px Georgia, serif', SANS = '700 %px Arial, sans-serif', THIN = '400 %px Arial, sans-serif';
// the shop sign band along a front: names over the glass, spaced out
const SHOPS = [
  ['ILU', '#ffffff', SANS], ['Kalev', '#e7d39a', SERIF], ['GOLDTIME', '#e9c46a', THIN], ['SALAMANDER', '#ffffff', SANS],
  ['NN KING', '#ffffff', THIN], ['Apranga', '#ffffff', SERIF], ['elisa', '#ffffff', SANS], ['PRO OPTIKA', '#f2f2f2', THIN],
  ['Telia', '#c58cf0', SANS], ['Rademar', '#ffffff', SANS], ['DEICHMANN', '#f4c400', SANS], ['Reserved', '#ffffff', THIN],
];
function shopBand(P, x0, x1, y, h, seed = 0) {
  let k = seed;
  for (let x = x0 + 5; x < x1 - 4; x += 11) {
    const [t, c, f] = SHOPS[k++ % SHOPS.length];
    P.text(t, x, y, h, c, f);
  }
}

// ---------------------------------------------------------------- the mall, west half (3829)
const CHECK = ['#7a4a2e', '#a0623a', '#c47a3c', '#5b3524', '#8d5a3a', '#b46d36', '#6b4029'];
function checker(P, x0, x1, y0, y1, seed = 1) {
  let r = seed;
  for (let y = y0; y < y1; y += 1.0) for (let x = x0; x < x1; x += 1.25) {
    r = (r * 9301 + 49297) % 233280;
    P.r(x, y, Math.min(x1, x + 1.22), Math.min(y1, y + 0.97), CHECK[r % CHECK.length]);
  }
}
function mallW(P, W) {
  const top = W.peak, len = W.len, mx = W.mid[0];
  if (W.foot > 2) { ribs(P, 0, len, P.y0, P.y1, '#4d4e53', '#45464b', 0.6); return; }     // walls over the lower roofs
  if (dot(W, NNE) > 0.9) {
    if (mx < -1330) {                                        // the west piece: brown front, Sinsay, Pepco, H&M
      P.r(0, P.y0, len, P.y1, '#4a2f25');
      checker(P, 0, len, 4.2, top - 1.6, 11);
      glass(P, 0.5, len - 0.5, 0, 3.6);
      P.r(0, top - 1.6, len, top, '#26272b');
      sign(P, len * 0.18, 5.4, 9, 1.6, '#111214', '#ffffff', 'sinsay', SANS);
      sign(P, len * 0.38, 5.4, 6, 1.4, '#ffffff', '#1d4f9a', 'PEPCO', SANS);
      sign(P, len * 0.58, 5.6, 5, 2.4, null, '#e2001a', 'H&M', SERIF, 0.9);
      sign(P, len * 0.8, 5.4, 7, 1.4, null, '#ffffff', 'astri', SANS);
      return;
    }
    checker(P, 0, len, 0, top, 3 + Math.round(len));
    if (Math.abs(mx + 1298) < 8 && len < 50) {               // the Apranga corner
      P.r(1, 4.2, len - 1, top - 0.6, '#5b3524');
      P.text('APRANGA', len / 2, top - 2.6, 2.2, '#ffffff', '400 %px Georgia, serif');
      P.text('my fitness', len * 0.3, 5.6, 1.4, '#e3262e', SERIF);
      glass(P, 1, len - 1, 0, 3.6);
      return;
    }
    glass(P, 0.5, len - 0.5, 0, 3.8);
    P.r(0, 4.2, len, 6.0, '#2b2c30');
    shopBand(P, 0, len, 5.1, 1.0, Math.round(-mx) % 7);
    P.r(0, top - 0.5, len, top, '#2b2c30');
    return;
  }
  if (dot(W, WNW) > 0.9) {
    if (mx < -1340) {                                        // Euronics' glass front, Jysk and the air-con shop
      P.r(0, P.y0, len, P.y1, '#e9e9e7');
      glass(P, 0.6, len * 0.62, 0, top - 2.6, '#6f8faf', '#d9dbdd');
      P.text('euronics', len * 0.31, top - 1.3, 2.2, '#1f3f9b', '700 %px Arial, sans-serif');
      P.text('★', len * 0.31 - 11, top - 1.2, 1.6, '#f2c200');
      glass(P, len * 0.64, len - 0.6, 0, 4.5, '#5f7d99', '#2b2c30');
      sign(P, len * 0.82, top - 1.6, 8, 1.8, '#1b3a8c', '#ffffff', 'JYSK', SANS);
      P.text('kliimakaubamaja.ee', len * 0.82, 5.4, 0.9, '#2b2c30', SANS);
      return;
    }
    P.brick(0, P.y0, len, P.y1, [107, 61, 44], 5);
    glass(P, 1, len - 1, 0, 3.8);
    if (len > 60) {                                          // RESERVED and terranova round the Apranga corner
      sign(P, len * 0.3, top - 2.4, 16, 2.0, null, '#ffffff', 'RESERVED', THIN, 0.9);
      sign(P, len * 0.66, top - 2.4, 12, 2.0, null, '#ffffff', 'terranova', SERIF, 0.9);
    }
    return;
  }
  // the back: service walls with loading doors
  ribs(P, 0, len, P.y0, P.y1, '#5d5653', '#544d4a', 0.4);
  P.r(0, top - 0.4, len, top, '#3d3a39');
  if (len > 20) for (let x = 9; x < len - 6; x += 16) { P.r(x, 0, x + 3.6, 4.2, '#8f9398'); for (let y = 0.4; y < 4.2; y += 0.4) P.r(x, y, x + 3.6, y + 0.04, '#7c8085'); }
  if (dot(W, ESE) > 0.9 && len > 60) sign(P, len * 0.55, 5.5, 9, 1.8, '#e31e24', '#ffffff', 'Rimi', SERIF);
}

// ---------------------------------------------------------------- the mall, east half (3981) and Hotel Sophia
const HOTEL_FROM = 16;                                       // a wall stretch taller than this is the hotel
function hotelStretch(P, W, x0, x1, named) {
  const top = (x) => W.topAt(x);
  P.r(x0, 0, x1, 4.4, '#1a1b1e');                             // black glass at the street
  for (let x = x0 + 1.8; x < x1 - 0.3; x += 1.8) P.r(x - 0.03, 0, x + 0.03, 4.4, '#33363b');
  P.r(x0, 4.4, x1, P.y1, '#f2f2f0');
  const t = Math.min(top(x0 + 0.5), top(x1 - 0.5), top((x0 + x1) / 2));
  for (let x = x0 + 1.4; x < x1 - 1.6; x += 3.1) {             // window strips in pairs
    P.r(x, 5.6, x + 0.85, t - 2.2, '#1f2834');
    for (let y = 8.3; y < t - 2.2; y += 3.0) P.r(x, y, x + 0.85, y + 0.08, '#c9ccd0');
  }
  if (named && x1 - x0 > 20) {
    const cx = (x0 + x1) / 2;
    P.r(cx - 10, t - 2.0, cx + 10, t - 0.4, '#f2f2f0');
    P.text('HOTELL', cx - 4.6, t - 1.2, 1.3, '#1d1d1f', SANS);
    P.text('SOPHIA', cx + 4.4, t - 1.2, 1.3, '#c8102e', SANS);
  }
}
function mallE(P, W) {
  const top = W.peak, len = W.len;
  // the hotel: wherever the wall runs up past the mall's roof
  const tall = [];
  for (let x = 0.25; x < len; x += 0.5) {
    const up = W.topAt(x) > HOTEL_FROM && W.botAt(x) < 2;
    if (up && (!tall.length || tall[tall.length - 1][1] < x - 0.6)) tall.push([x - 0.25, x + 0.25]);
    else if (up) tall[tall.length - 1][1] = x + 0.25;
  }
  if (W.foot > 2) {                                           // over the lower roofs
    if (top > HOTEL_FROM) {
      P.r(0, P.y0, len, P.y1, '#f2f2f0');
      for (let x = 1.4; x < len - 1.6; x += 3.1) P.r(x, Math.max(P.y0, 13), x + 0.85, top - 2.2, '#1f2834');
      if (dot(W, NNE) > 0.9 && len > 20) { P.r(len / 2 - 10, top - 2.0, len / 2 + 10, top - 0.4, '#f2f2f0'); P.text('HOTELL', len / 2 - 4.6, top - 1.2, 1.3, '#1d1d1f', SANS); P.text('SOPHIA', len / 2 + 4.4, top - 1.2, 1.3, '#c8102e', SANS); }
    }
    else ribs(P, 0, len, P.y0, P.y1, '#2c2d31', '#26272b', 0.6);
    return;
  }
  if (dot(W, NNE) > 0.9) {                                   // the front over the car park (x = 0 at the east end)
    P.r(0, P.y0, len, P.y1, '#232428');
    for (let x = 0; x < len; x += 1.2) P.r(x, 4.4, x + 0.04, top, '#2d2e33');
    if (len > 140) { P.r(0, top - 1.2, len, top, '#2b2c30'); return; }   // the taller wall behind the front
    glass(P, 30, len - 2, 0, 3.8, '#56697c');
    sign(P, 14, top - 3.2, 14, 2.4, null, '#ffffff', 'coop', '700 %px Arial Rounded MT Bold, Arial, sans-serif', 0.95);
    P.text('Maksimarket', 25.5, top - 3.6, 1.0, '#ffffff', THIN);
    glass(P, 3, 26, 0, 3.2, '#4e6070');
    // TERE TULEMAST: the grey entrance portal
    const e = 62;
    P.r(e - 5.5, 0, e + 5.5, top + 0.2, '#8e9196');
    P.r(e - 4.3, 0, e + 4.3, top - 2.6, '#2a2d33');
    glass(P, e - 4.0, e + 4.0, 0, 3.4, '#6b8096', '#34373c');
    P.text('TERE TULEMAST!', e, top - 1.3, 1.0, '#e3262e', SANS);
    sign(P, e + 7.4, top - 3.0, 1.8, 2.2, '#1d4f9a', '#ffffff', '2', SANS, 0.8);
    P.r(e + 7.4 - 0.08, 0, e + 7.4 + 0.08, top - 4.1, '#9ea2a6');
    P.r(30, 4.2, e - 6, 5.8, '#1a1b1e'); shopBand(P, 30, e - 6, 5.0, 0.95, 3);
    P.r(e + 9, 4.2, len, 5.8, '#1a1b1e'); shopBand(P, e + 9, len, 5.0, 0.95, 6);
    return;
  }
  if (dot(W, ESE) > 0.9) {                                   // the black east end with fins (x = 0 at the south)
    const eh = 10.5;
    P.r(0, P.y0, len, P.y1, '#1e1f22');
    for (let x = 1; x < len - 1; x += 3.2) P.poly([[x, 0.6], [x + 1.6, 0.6], [x + 0.4, eh - 0.6]], '#34363b');
    if (len > 60) {                                          // the screens towards the north corner
      P.r(len - 30, 3, len - 18, eh - 1, '#d8c9c0'); P.text('H&M', len - 24, eh * 0.55, 3.2, '#e2001a', SERIF);
      P.r(len - 16, 3, len - 3, eh - 1, '#3a2a4a'); P.arc(len - 9.5, eh * 0.55, 3.2, '#e6b8a8');
    }
    tall.forEach(([a, b]) => hotelStretch(P, W, a, b, true));
    return;
  }
  if (dot(W, SSW) > 0.9) {
    // the south side: the open parking floor under the deck, the white wall above with the cinema's name
    {
      P.r(0, P.y0, len, 3.4, '#1d1e21');
      for (let x = 4; x < len; x += 8) P.r(x - 0.3, 0, x + 0.3, 3.4, '#a9a9a6');
      P.r(0, 3.4, len, 4.1, '#b8b8b4');
      for (let x = 0.6; x < len; x += 1.2) P.r(x, 4.1, x + 0.04, 5.1, '#7d8085');
      P.r(0, 5.06, len, 5.14, '#7d8085');
      P.r(0, 5.1, len, P.y1, '#ececea');
      if (dot(W, SSW) > 0.9 && len > 100) {
        P.text('APOLLO', 26, top - 2.0, 1.8, '#d4202a', '900 %px Arial, sans-serif');
        P.text('KINO-CINEMA', 26, top - 3.3, 0.6, '#1d1d1f', SANS);
        P.text('Lõunakeskus', 52, top - 2.4, 2.6, '#c9a24a', '700 %px Georgia, serif');
      }
    }
    tall.forEach(([a, b], i) => hotelStretch(P, W, a, b, i === 0));
    return;
  }
  ribs(P, 0, len, P.y0, P.y1, '#2c2d31', '#26272b', 0.6);
  tall.forEach(([a, b], i) => hotelStretch(P, W, a, b, i === 0 && dot(W, WNW) < 0.9));
}

// ---------------------------------------------------------------- Teaduspark and Riia 181a
function rows(P, W, { y0 = 1.0, storey = 3.3, w = 1.6, pitch = 3.0, frame = '#f4f2ec', glassC = '#4f5e70', band = null } = {}) {
  const top = W.peak;
  for (let y = y0; y + 1.6 < top - 0.6; y += storey) {
    if (band) P.r(0, y - 0.25, W.len, y + 1.75, band);
    for (let x = pitch / 2 + 0.4; x < W.len - 0.6; x += pitch) {
      if (W.topAt(x) < y + 2.2 || W.botAt(x) > y - 0.3) continue;
      P.win(x - w / 2, y, x + w / 2, y + 1.5, { frame, glass: glassC, T: false, bars: 1, sill: 0.06, fw: 0.06 });
    }
  }
}
function green(P, W) {
  P.grad(0, P.y0, W.len, P.y1, '#a9cf86', '#8dbb70');
  P.r(0, P.y0, W.len, 0.8, '#7f8f63');
  rows(P, W, { pitch: 2.6, w: 1.8 });
  if (dot(W, [0.88, 0.47]) > 0.8 && W.len < 20 && W.peak > 8) {      // the name on the end wall
    P.text('TARTU TEADUSPARK', W.len / 2, W.peak - 1.2, 1.1, '#ffffff', SANS);
  }
}
function brick(P, W) {
  P.brick(0, P.y0, W.len, P.y1, [150, 74, 54], Math.round(W.mid[0]));
  P.r(0, P.y0, W.len, 0.6, '#5d4038');
  rows(P, W, { pitch: 3.2, w: 2.0, frame: '#e9e6df' });
  if (W.len > 12) P.r(W.len / 2 - 1, 0, W.len / 2 + 1, 2.4, '#3a3c40');
}
function ribbed(P, W) {
  ribs(P, 0, W.len, P.y0, P.y1, '#a3a8ad', '#8f949a', 0.35);
  if (W.len > 30) for (let x = 8; x < W.len - 6; x += 14) { P.r(x, 0, x + 1.2, 4.5, '#24262a'); for (let y = 0.3; y < 4.5; y += 0.3) P.r(x, y, x + 1.2, y + 0.1, '#3a3d42'); }
  if (W.len > 8) P.r(W.len - 4, 0, W.len - 3, 2.2, '#5a5e64');
}
function beige(P, W) {
  P.r(0, P.y0, W.len, P.y1, '#c9bda8');
  P.r(0, P.y0, W.len, 0.7, '#8d867c');
  rows(P, W, { pitch: 2.8, w: 1.4, glassC: '#55616d' });
  if (W.len > 4 && W.len < 9 && W.peak > 10) P.r(0.6, 0.8, W.len - 0.6, W.peak - 0.6, '#a9c9a2');   // the light green stair tower
}

const PAINT = { mallW, mallE, green, brick, ribbed, beige };
const FRONTS = new Set(['mallW', 'mallE']);

// ---------------------------------------------------------------- the 3D extras
// the tall sign by the car park: stacked shop boxes on a dark column
function pylonTex() {
  return paintTexture(3.2, 0, 17, 22, (P) => {
    P.r(0, 0, 3.2, 17, '#1d1e21');
    P.r(0, 15.2, 3.2, 17, '#141517'); P.text('Lõunakeskus', 1.6, 16.1, 0.55, '#ffffff', SANS);
    P.r(0.2, 14.4, 3.0, 15.2, '#141517'); P.text('10 - 21', 1.6, 14.8, 0.55, '#f2c200', SANS);
    const box = (y, h, bg, t, c, f, k = 0.55) => { P.r(0.15, y, 3.05, y + h, bg); P.text(t, 1.6, y + h / 2, h * k, c, f); };
    box(12.6, 1.8, '#ffffff', 'H&M', '#e2001a', SERIF, 0.7);
    box(11.6, 0.9, '#2b2c30', 'APOLLO', '#f0a030', SANS);
    box(9.8, 1.7, '#ffffff', 'coop', '#1b62b5', SANS, 0.6);
    box(8.1, 1.6, '#1b3a8c', 'JYSK', '#ffffff', SANS);
    box(6.4, 1.6, '#ffffff', 'Rimi', '#e31e24', SERIF);
    box(4.7, 1.6, '#1f3f9b', 'EURONICS', '#ffffff', SANS, 0.36);
  });
}
// the billboard tower on the north-east corner: four faces of adverts round one picture
function cubeTex() {
  return paintTexture(48, 0, 13, 10, (P) => {
    const face = (x0, draw) => { P.r(x0, 0, x0 + 12, 13, '#16171a'); draw(x0); };
    face(0, (x) => { P.r(x + 0.4, 0.6, x + 11.6, 12.4, '#efe8e4'); P.text('H&M', x + 6, 9.6, 3.4, '#e2001a', SERIF); P.r(x + 1, 1, x + 5.6, 6.4, '#f6c9b7'); P.r(x + 6.4, 1, x + 11, 6.4, '#ffffff'); P.text('Rimi', x + 8.7, 4.4, 1.4, '#e31e24', SERIF); P.text('eDrinks', x + 8.7, 2.4, 0.9, '#e31e24', SERIF); });
    face(12, (x) => { P.grad(x + 0.4, 0.6, x + 11.6, 12.4, '#6c4f86', '#d7a6a0'); P.arc(x + 6, 7, 3.4, '#f0c8b4'); P.text('kingitus', x + 6, 2.2, 0.9, '#ffffff', SANS); });
    face(24, (x) => { P.r(x + 0.4, 0.6, x + 11.6, 12.4, '#e9e9e9'); P.text('H&M', x + 6, 10.2, 2.6, '#e2001a', SERIF); P.text('NEW YORKER', x + 6, 8, 0.9, '#e2001a', SANS); P.r(x + 1, 4.8, x + 11, 6.6, '#1f2a5a'); P.text('SPORTS DIRECT', x + 6, 5.7, 0.8, '#ffffff', SANS); P.text('TAKKO', x + 6, 3, 1.6, '#1d1d1f', SANS); });
    face(36, (x) => { P.r(x + 0.4, 0.6, x + 11.6, 12.4, '#ffffff'); P.text('JYSK', x + 6, 9, 2.2, '#1b3a8c', SANS); P.text('Rimi', x + 6, 5, 2.2, '#e31e24', SERIF); P.text('kino', x + 6, 2.2, 1.0, '#d4202a', SANS); });
  });
}
function lettersTex() {
  return paintTexture(30, 0, 4.4, 26, (P) => {
    P.text('Lõunakeskus', 15, 2.0, 3.6, '#7a5a1e', '700 %px Georgia, serif');
    P.text('Lõunakeskus', 14.85, 2.15, 3.6, '#d6ae4c', '700 %px Georgia, serif');
  }, { alpha: true });
}
function rimiTex() {
  return paintTexture(9, 0, 3, 20, (P) => {
    P.r(0, 0, 9, 3, '#e31e24'); P.r(0.15, 0.15, 8.85, 2.85, '#ef3b3f');
    P.text('Rimi', 4.1, 1.75, 1.7, '#ffffff', 'italic 900 %px Arial, sans-serif'); P.text('HYPER', 4.3, 0.55, 0.45, '#ffffff', SANS);
  });
}

// parked cars by the front: [x, z, yaw, id, paint, lift]; forward = (sin yaw, -cos yaw)
const BAY = frame([-1016.5, 5390.0], [-0.89, -0.46]);                 // along the east half's front, v + = out
const nose = Math.atan2(-0.46, -0.89);                                 // facing the front (south-south-west)
const at = (s, v) => BAY.at(s, v);
// the bays in front of the east half: rows of 2.6 m bays across the front, v from the wall out
const ROWS = [[7, 12], [18.5, 23.5], [23.5, 28.5], [35, 40], [40, 45]], BAY0 = 30, BAY1 = 125, BW = 2.6;
const bay = (k) => BAY0 + (k + 0.5) * BW;
export const LOUNA_CARS = [
  [...at(bay(1), 9.6), nose, 'passat', 'silver', 0.03],
  [...at(bay(2), 9.6), nose, 'rav4', 'white', 0.03],
  [...at(bay(5), 9.6), nose, 'model3', 'white', 0.03],
  [...at(bay(8), 21.2), nose, 'mazda6', 'red', 0.03],
  [...at(bay(9), 25.8), nose + Math.PI, 'passat', 'black', 0.03],
  [...at(bay(20), 9.6), nose, 'rav4', 'blue', 0.03],
  [...at(bay(23), 25.8), nose + Math.PI, 'mazda6', 'white', 0.03],
];

export function createLounakeskus(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;
  const CENTRE = [-1150, 5440];
  // columnar thujas in the strip along the front and the tall spruces at the hotel's corner
  const trees = [];
  for (let s = 6; s < 128; s += 7.5) if (Math.abs(s - 62) > 8) trees.push([...at(s, 4.2), 3.6 + (s % 3) * 0.3, 0.9, 1]);
  for (const s of [10, 22, 34, 46, 58, 70, 82]) trees.push([...frame([-1151.8, 5318.2], [-0.89, -0.46]).at(s, 4.0), 3.4, 0.9, 1]);
  world.addTrees(trees);

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    const houses = HOUSES.map(([name, S, base, at0, r]) => ({ name, sec: S[0], base, at: at0, r, spec: { wall: [200, 200, 200], floors: [], attic: null, eaves: false } }));
    for (const H of houses) {
      const paint = PAINT[H.name];
      H.walls = [{ near: [-1178.2, 5376.0], within: 3, skip: true }, { near: [0, 0], within: 1e9, only: (P, W) => paint(P, W) }];
    }
    const front = houses.filter((H) => FRONTS.has(H.name)), rest = houses.filter((H) => !FRONTS.has(H.name));
    skinHouses(world, group, front, { shadows, ppm: 10, far: 6, faces: (W) => W.foot < 2 && (W.nx * NNE[0] + W.nz * NNE[1] > 0.9 || W.peak > HOTEL_FROM), debug: DEBUG });
    skinHouses(world, group, rest, { shadows, ppm: 8, far: 5, debug: DEBUG });

    const mat = (t, o = {}) => new THREE.MeshLambertMaterial({ map: t, ...o });
    const dark = new THREE.MeshLambertMaterial({ color: 0x1d1e21 });
    const add = (m, x, y, z, yaw) => { m.position.set(x, y, z); m.rotation.y = yaw; m.castShadow = shadows; group.add(m); return m; };
    const faceYaw = Math.atan2(NNE[0], NNE[1]);                        // a plane's front (+z) turned to the north-north-east
    // the tall sign by the car park entrance
    {
      const [x, z] = at(24, 31.5), g = h(x, z), t = pylonTex();
      A.pave(BAY, 21, 27, 29.5, 33.5, 'lawn');
      add(new THREE.Mesh(new THREE.BoxGeometry(3.2, 17, 1.4), [dark, dark, dark, dark, mat(t), mat(t)]), x, g + 8.5, z, faceYaw + Math.PI / 2);
    }
    // the billboard tower on the north-east corner: four faces of one texture
    {
      const t = cubeTex(), [x, z] = BAY.at(6.5, -6.5), g = h(...BAY.at(0, 2)), mats = [0, 1, 2, 3].map((k) => { const c = t.clone(); c.repeat.set(0.25, 1); c.offset.set(k * 0.25, 0); c.needsUpdate = true; return mat(c); });
      add(new THREE.Mesh(new THREE.BoxGeometry(12, 13, 12), [mats[3], mats[1], dark, dark, mats[0], mats[2]]), x, g + 6.5 + 6.2, z, faceYaw);
    }
    // the gold letters on their frame over the west half's front
    {
      const F = frame([-1156.1, 5333.2], [-0.89, -0.46]), [x, z] = F.at(30, -1.2), g = h(...F.at(30, 6)), R = 13.4;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(30, 4.4), mat(lettersTex(), { transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
      add(m, x, g + R + 2.9, z, faceYaw);
      for (let s = 16; s <= 44; s += 4) { A.box(F, s, -1.6, 0.12, 0.12, R, R + 5.4, 0x6f7276, g); A.box(F, s, -3.0, 0.12, 2.8, R, R + 0.15, 0x6f7276, g); }
      A.box(F, 30, -1.6, 28.5, 0.12, R + 0.6, R + 0.75, 0x6f7276, g);
      A.box(F, 30, -1.6, 28.5, 0.12, R + 5.25, R + 5.4, 0x6f7276, g);
    }
    // Rimi Hyper: two red boxes on the roof of the west end
    {
      const t = rimiTex(), F = frame([-1330, 5354], [-0.89, -0.46]);
      for (const [s, turn] of [[3, 0], [11, -0.5]]) {
        const [x, z] = F.at(s, -4), g = h(...F.at(s, 3)) + 14.3;
        add(new THREE.Mesh(new THREE.BoxGeometry(9, 3, 0.4), [dark, dark, dark, dark, mat(t), mat(t)]), x, g + 1.5, z, faceYaw + turn + 1.2);
        p.add(BOX(0.2, 1.2, 0.2), 0x2b2c30, x, g - 0.4, z);
      }
    }
    // lamp posts down the car park, double heads
    for (let s = BAY0 + 6; s < BAY1; s += 26) {
      const [x, z] = at(s, 23.5), y = h(x, z);
      p.add(new THREE.CylinderGeometry(0.08, 0.13, 10, 8), 0x9a9da2, x, y + 5, z);
      for (const d of [-1, 1]) {
        const q = BAY.at(s + d * 1.4, 23.5);
        p.add(BOX(2.8, 0.08, 0.08), 0x9a9da2, (x + q[0]) / 2, y + 10, (z + q[1]) / 2, Math.atan2(0.46, -0.89));
        p.add(BOX(0.7, 0.14, 0.3), 0x6d7076, q[0], y + 9.95, q[1], Math.atan2(0.46, -0.89));
      }
    }
    // the car park's tarmac (the air photo under it is bleached pale) and the bay lines
    A.pave(BAY, 0, BAY1 + 3, 6.2, 47, 'asphalt');
    for (const [v0, v1] of ROWS) {
      for (let s = BAY0; s <= BAY1 + 0.01; s += BW) A.pave(BAY, s - 0.06, s + 0.06, v0, v1, 'white');
    }
    for (const v of [7, 28.5, 35, 45]) A.pave(BAY, BAY0, BAY1, v - 0.06, v + 0.06, 'white');
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 380) return;
      if ([[-1280, 5385], [-1100, 5430], [-1085, 5618]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
