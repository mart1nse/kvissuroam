// Narva maantee at the Kivi junction, batch 2 of the Narva mnt kaardista (Martin, 22 Nov: Street View shots
// of July and Aug 2024 from the junction). Seen in his shots:
//  - the Linnamuuseum (Narva mnt 23): white classicist walls, the giant pilasters and banded ground floor of
//    the corner house, brown window frames, the pink MEIE TARTU banner and the pink door, the two flags
//    over the pavement, the red hipped roof; the white wall with its pillars and black gate along Kivi;
//  - Circle K in the wedge between the two carriageways: the canopy with the red fascia and the white CIRCLE K,
//    two islands of pumps with the red miles PLUS panels, the small grey shop with its red sign, the tall
//    red K at the canopy's north end;
//  - Coop Konsum: the blue ribbed box, the white coop | Konsum letters and the opening hours over the glass
//    entrance at the south-west corner, the poster panel, the shop windows;
//  - the dormitory behind it (Narva mnt 25): grey with rows of windows, its south end two white panels with
//    coloured dashes, the pink Tartu 2024 poster and the five tabby cats either side of the dark stair strip;
//  - Selver across Kivi: white, ribbon windows, the red SELVER by its north-west corner;
//  - the modern block south of the museum (Raatuse 18 side): white, the dark glass stair against the museum.
// Guessed: the backs, the garden wall's second leg towards Selver's car park (from the air photos).
// Nothing stands on a carriageway (every post checked against the road lines), no street names on the road.
import * as THREE from 'three';
import { setHouseColours, addHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { jobs } from '../jobs.js';
import { still } from '../still.js';
import { axes, row, classic, bands } from './ulikooli.js';

const DEBUG = typeof location !== 'undefined' && /narvadebug/.test(location.search);
const S45 = ['4_5', 1760, 2400], S35 = ['3_5', 1120, 2400];
const CENTRE = [1790, 2580];
const SANS = '700 %px Arial, sans-serif';

const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
// an ellipse as a polygon (rot in radians, counter-clockwise)
function ell(P, cx, cy, rx, ry, rot, col, n = 16) {
  const c = Math.cos(rot), s = Math.sin(rot), pts = [];
  for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; pts.push([cx + x * c - y * s, cy + x * s + y * c]); }
  P.poly(pts, col);
}

// ---------------------------------------------------------------- the Linnamuuseum, Narva mnt 23
const MWHITE = '#efeeea', MTRIM = '#f8f7f3', MFRAME = '#6a3326', MGLASS = '#3b414c', PINK = '#e7a3a1';
const mwin = { frame: MFRAME, glass: MGLASS, fw: 0.09, bars: 1, rails: 1, T: false, surround: 0.14, sc: MTRIM, sill: 0.1 };
function pilaster(P, x, y0, y1, w = 0.7) { P.r(x - w / 2, y0, x + w / 2, y1, MTRIM); P.r(x + w / 2 - 0.06, y0, x + w / 2, y1, 'rgba(90,90,100,0.18)'); }
function museum(P, W) {
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05);
  P.r(0, P.y0, len, P.y1, MWHITE);
  if (W.front) P.weather(0, P.y0, len, P.y1, 0.25, 3);
  P.r(0, P.y0, len, 0.55, '#c9c7c2');                                        // the plinth
  const west = W.nx < -0.7 && W.nz > 0.4 && len > 25, corner = W.nx < -0.6 && W.nz < -0.6 && len > 12;
  if (!west && !corner) {                                                    // the courtyard sides and the back
    classic(P, W, { wall: MWHITE, trim: MTRIM, plinth: [0.55, '#c9c7c2'], floors: [[1.2, 2.0], [5.3, 2.2]], pitch: 3.0, w: 1.25, win: mwin, belts: [4.4], cornice: 0.45, weather: 0 });
    return;
  }
  const n0 = west ? 13.5 : len;                                              // the corner house: to the pink bay
  // banded ground floor, belt, giant pilasters, cornice
  bands(P, 0, n0, 0.55, 4.2, 0.45, 'rgba(80,80,90,0.2)');
  P.r(0, 4.2, n0, 4.5, MTRIM); P.r(0, 4.18, n0, 4.22, 'rgba(70,70,80,0.3)');
  const xs = west ? axes(0.4, n0, 4) : axes(0, len, 3);
  const piers = west ? [0.45, 6.95, n0 - 0.4] : [0.45, len - 0.45];
  for (const x of piers) pilaster(P, x, 4.5, top - 0.7, 0.8);
  xs.forEach((x, k) => {
    const blind = corner && k === 1;                                         // the middle bay of the corner side
    if (blind) { P.r(x - 0.65, 1.2, x + 0.65, 3.2, '#e6e5e0'); P.r(x - 0.65, 5.3, x + 0.65, 7.6, '#e6e5e0'); }
    else { P.win(x - 0.62, 1.2, x + 0.62, 3.2, mwin); P.win(x - 0.65, 5.3, x + 0.65, 7.6, { ...mwin, hood: 0.18 }); }
    P.r(x - 0.85, 7.85, x + 0.85, 8.05, MTRIM);                              // a cornice over each upper window
  });
  P.r(0, top - 0.75, n0, top, MTRIM); P.r(0, top - 0.75, n0, top - 0.68, 'rgba(70,70,80,0.3)');
  if (!west) return;
  // the pink bay: the MEIE TARTU banner over the pink door, a little gable over the cornice
  const p0 = n0, p1 = 18.0, pm = (p0 + p1) / 2;
  P.r(p0, 0.55, p1, top, MWHITE);
  P.r(p0 + 0.15, 4.1, p1 - 0.15, top - 0.5, PINK);
  P.text('MEIE', pm, 7.6, 1.1, '#9a4a55', '800 %px Arial, sans-serif'); P.text('TARTU', pm, 6.3, 1.1, '#9a4a55', '800 %px Arial, sans-serif');
  P.r(p0 + 0.6, 4.9, p1 - 0.6, 5.2, '#f7f2f0');
  P.r(pm - 0.8, 0.55, pm + 0.8, 3.4, MTRIM); P.r(pm - 0.62, 0.55, pm + 0.62, 3.2, '#c98a8a');
  P.r(pm - 0.03, 0.55, pm + 0.03, 3.0, '#a86a6c'); P.r(pm - 0.55, 2.55, pm + 0.55, 3.1, '#3f4550');
  for (const x of [p0 + 0.9, p1 - 0.9]) P.win(x - 0.45, 1.3, x + 0.45, 3.1, mwin);
  for (const x of [p0, p1]) pilaster(P, x, 0.55, top, 0.5);
  // the lower white wing to the south: two floors of windows, a plain cornice
  const s0 = p1 + 0.3, xs2 = axes(s0, len, 5);
  for (const x of xs2) { P.win(x - 0.58, 1.2, x + 0.58, 3.1, mwin); P.win(x - 0.6, 5.2, x + 0.6, 7.3, mwin); }
  P.r(s0, 4.15, len, 4.35, MTRIM);
  P.r(p1, top - 0.6, len, top, MTRIM);
}

// ---------------------------------------------------------------- the modern block south of the museum
function block24(P, W) {
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05);
  P.r(0, P.y0, len, P.y1, '#e6e7e5');
  if (len < 7 && W.nx < -0.8 && W.mid[0] < 1806) {                                              // the glass stair against the museum
    P.r(0.3, 0.2, len - 0.3, top - 0.4, '#2d333c');
    for (let y = 1.0; y < top; y += 3.1) P.r(0.3, y, len - 0.3, y + 0.12, '#59606b');
    return;
  }
  P.r(0, P.y0, len, 0.4, '#a5a7aa');
  const xs = axes(0, len, Math.max(1, Math.round(len / 2.4)));
  for (let y = 0.9; y + 1.5 < top; y += 3.1) row(P, W, xs, y, 1.6, 1.5, { frame: '#3c4048', glass: '#4c5a6e', fw: 0.06, bars: 0, T: false, surround: 0, sill: 0 });
  if (W.nx < -0.7 && len > 8) {                                              // glass balconies at the corner to Narva mnt
    for (let y = 3.6; y + 1 < top; y += 3.1) { P.r(len - 4.2, y - 0.2, len, y + 0.95, '#9fb2bd'); P.r(len - 4.2, y + 0.9, len, y + 1.0, '#d9dddf'); }
  }
  P.r(0, top - 0.35, len, top, '#c9cbcc');
}

// ---------------------------------------------------------------- Circle K's shop
function ckShop(P, W) {
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05);
  P.r(0, P.y0, len, P.y1, '#d6d7d9');
  P.r(0, top - 1.2, len, top, '#bfc1c4');
  P.r(0, P.y0, len, 0.3, '#8f9196');
  if (W.nz < -0.7 && len > 5) {                                              // the front to the pumps
    P.r(len * 0.5 - 1.8, 2.75, len * 0.5 + 1.8, 3.55, '#dc2a2f');
    P.text('CIRCLE', len * 0.5 - 0.35, 3.15, 0.5, '#ffffff', '800 %px Arial, sans-serif');
    P.arc(len * 0.5 + 1.25, 3.15, 0.3, '#ffffff'); P.text('K', len * 0.5 + 1.25, 3.13, 0.4, '#dc2a2f', '900 %px Arial, sans-serif');
    P.r(len * 0.5 - 1.1, 0.0, len * 0.5 + 1.1, 2.5, '#2a2d33'); P.grad(len * 0.5 - 1.0, 0.05, len * 0.5 + 1.0, 2.45, '#b7a98f', '#6d6350');
    P.r(len * 0.5 - 0.02, 0.05, len * 0.5 + 0.02, 2.45, '#2a2d33');
    P.r(0.4, 0.6, len * 0.5 - 1.5, 2.5, '#2a2d33'); P.r(0.5, 0.7, 1.4, 2.4, '#dc2a2f'); P.text('K', 0.95, 1.6, 0.5, '#ffffff', '900 %px Arial, sans-serif');
    P.r(len * 0.5 + 1.5, 0.8, len - 0.3, 2.5, '#353a42'); P.grad(len * 0.5 + 1.6, 0.9, len - 0.4, 2.4, '#d8c9a6', '#8c7f62');
  } else if (len > 3) {
    P.r(0.6, 1.0, len - 0.6, 2.4, '#3a3f47');
  }
}

// ---------------------------------------------------------------- Coop Konsum
const BLUE = '#2b4fae', BLUE2 = '#244497';
function coop(P, W) {
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05);
  const low = W.eaves < 6;                                                   // the low link to the dormitory
  P.r(0, P.y0, len, P.y1, low ? '#c4c5c3' : BLUE);
  if (low) { row(P, W, axes(0, len, Math.max(1, Math.round(len / 3))), 1.0, 1.6, 1.8, { frame: '#5a5e66', glass: '#3d4552', fw: 0.06, bars: 0, T: false, surround: 0, sill: 0 }); return; }
  for (let x = 1.25; x < len; x += 2.5) P.r(x - 0.05, 3.3, x + 0.05, top, BLUE2);                 // the ribs
  P.r(0, top - 0.25, len, top, '#1f3b86');
  P.r(0, P.y0, len, 3.3, '#d3d4d2'); P.r(0, 3.2, len, 3.35, '#9da0a6');
  const south = W.nz > 0.8 && len > 30, west = W.nx < -0.9 && len > 20;
  if (!south && !west) return;
  // the entrance at the south-west corner: south side x = 0 at that corner, west side x = len there
  const e0 = south ? 0 : len - 6.5, e1 = south ? 6.5 : len;
  P.r(e0, P.y0, e1, 3.3, '#2a2e35');
  P.grad(e0 + 0.15, 0.05, e1 - 0.15, 3.1, '#e7d9b4', '#b9a77d');
  for (const x of axes(e0, e1, 5)) P.r(x - 0.04, 0, x + 0.04, 3.2, '#2a2e35');
  P.r(e0, 2.45, e1, 2.55, '#2a2e35');
  const lx = south ? 4.6 : len - 8.2;
  P.text('coop', lx, 5.5, 2.6, '#ffffff', '800 %px "Arial Rounded MT Bold", Arial, sans-serif');
  P.r(lx + 3.75, 4.6, lx + 3.85, 6.6, '#ffffff');
  P.text('Konsum', lx + 3.95, 5.55, 0.95, '#ffffff', '600 %px Arial, sans-serif', 'left');
  P.text('E-R 7.30-23   L-P 9-23', lx, 3.8, 0.55, '#ffffff', '700 %px Arial, sans-serif');
  if (south) {
    P.r(7.0, 0.3, 11.6, 3.0, '#f2f2f0');                                     // the poster panel
    for (let k = 0; k < 5; k++) { const x = 7.8 + k * 0.75; P.arc(x, 2.25, 0.16, '#d8b49a'); P.r(x - 0.2, 0.6, x + 0.2, 2.05, '#2f5fb0'); }
    P.r(12.0, 0.3, 21.0, 3.0, '#2c323b'); P.grad(12.1, 0.35, 20.9, 2.95, '#4a5566', '#2d343f');      // the shop windows
    for (const x of axes(12.0, 21.0, 4)) P.r(x - 0.04, 0.3, x + 0.04, 3.0, '#6d737c');
    P.r(len * 0.62, 3.6, len * 0.62 + 1.3, 4.6, '#ffffff'); P.text('P', len * 0.62 + 0.65, 4.1, 0.75, BLUE, '800 %px Arial, sans-serif');
  }
}

// ---------------------------------------------------------------- the dormitory, Narva mnt 25
const DGREY = '#b8b9b6';
const DASH = ['#f2cf3a', '#ea8cc0', '#47b2e6', '#e8513e', '#f59b3a', '#8fd0f0', '#f2cf3a', '#ea8cc0'];
function dashes(P, x0, x1, y0, y1, seed) {
  const r = rnd(seed);
  for (let y = y0; y < y1; y += 1.15 + r() * 0.5) {
    for (let x = x0 + r() * 1.2; x < x1 - 0.8; ) {
      const L = Math.min(x1 - x, 1.4 + r() * 2.6), t = 0.06 + r() * 0.05, col = DASH[Math.floor(r() * DASH.length)];
      P.poly([[x, y], [x + L, y + L * t], [x + L, y + L * t + 0.34], [x, y + 0.34]], col);
      x += L + 0.6 + r() * 2.2;
    }
  }
}
// a tabby lying, stretching or leaping: (cx, cy) the body's middle, s its scale, dir +1 head to the right
function cat(P, cx, cy, s, dir, rot) {
  const c = Math.cos(rot), sn = Math.sin(rot), at = (x, y) => [cx + (x * c - y * sn) * dir, cy + x * sn * dir + y * c];
  const body = '#7c7d80', dark = '#45464a', light = '#b9b8b3';
  const tail = [[-1.2, 0.05], [-1.75, 0.25], [-2.2, 0.55], [-2.5, 0.95]].map(([x, y]) => at(x * s, y * s));
  for (let k = 0; k < tail.length - 1; k++) P.line(tail[k][0], tail[k][1], tail[k + 1][0], tail[k + 1][1], body, 0.22 * s);
  for (const [lx, ly] of [[-0.85, -0.45], [-0.55, -0.55], [0.75, -0.5], [1.05, -0.4]]) {               // legs
    const a = at(lx * s, -0.1 * s), b = at((lx + 0.2) * s, (ly - 0.15) * s);
    P.line(a[0], a[1], b[0], b[1], body, 0.22 * s);
  }
  const [bx, by] = at(0, 0); ell(P, bx, by, 1.3 * s, 0.48 * s, rot, body);
  const [hx, hy] = at(1.45 * s, 0.32 * s); P.arc(hx, hy, 0.4 * s, body);
  for (const e of [-0.2, 0.22]) { const [ex, ey] = at((1.45 + e) * s, 0.62 * s); P.poly([[ex - 0.13 * s, ey - 0.08 * s], [ex + 0.13 * s, ey - 0.08 * s], [ex, ey + 0.28 * s]], body); }
  const [mx, my] = at(1.55 * s, 0.18 * s); ell(P, mx, my, 0.2 * s, 0.13 * s, 0, light);
  for (let k = -3; k <= 3; k++) { const a = at(k * 0.3 * s, 0.42 * s), b = at((k * 0.3 + 0.12) * s, -0.15 * s); P.line(a[0], a[1], b[0], b[1], dark, 0.08 * s); }
}
function dorm(P, W) {
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05);
  P.r(0, P.y0, len, P.y1, DGREY);
  if (W.foot > 25) { P.r(0, P.y0, len, P.y1, '#a9aaa7'); return; }             // the lift rooms on the roof
  const south = W.nz > 0.9 && len > 15;
  if (south) {
    // the south end: two white panels with the mural either side of the dark stair strip; x = 0 at the west
    const a1 = len * 0.42, b0 = len * 0.58;
    P.r(0, 0, len, 3.0, '#9fa09d');
    P.r(0, 3.0, a1, top, '#e9e9e5'); P.r(b0, 3.0, len, top, '#e9e9e5');
    P.r(a1, 0, b0, top, '#2b2f37');
    for (let y = 3.0; y < top; y += 2.8) { P.r(a1, y - 0.15, b0, y + 0.05, '#8d9094'); P.r(a1 + 0.2, y + 0.05, b0 - 0.2, y + 0.95, '#5a5f68'); }
    dashes(P, 0.2, a1 - 0.2, 15, top - 1.5, 11); dashes(P, b0 + 0.2, len - 0.2, 4, top - 1.0, 23);
    P.text('Tartu 2024', a1 / 2, top - 1.6, 0.95, '#c7cbd8', '700 %px Arial, sans-serif');
    P.text('Euroopa', a1 / 2 - 1.2, 21.5, 0.75, '#c7cbd8', SANS); P.text('kultuuripealinn', a1 / 2, 20.6, 0.75, '#c7cbd8', SANS);
    // the pink poster low on the west panel
    P.r(0.6, 3.6, a1 - 0.6, 13.6, '#e6a6d4');
    P.text('Tartu 2024', a1 / 2, 12.6, 0.45, '#5b2d6e', SANS);
    P.text('See on', a1 / 2, 11.3, 0.9, '#ffffff', '800 %px Arial, sans-serif'); P.text('vaib!', a1 / 2, 10.2, 0.9, '#ffffff', '800 %px Arial, sans-serif');
    P.arc(a1 / 2, 6.6, 1.25, '#d9d4cc'); cat(P, a1 / 2, 6.5, 0.55, 1, 0.3);
    // the five cats on the east panel
    const m = (a1 + b0) / 2 + len * 0.29;
    [[6.6, 1.35, -1, 0.15], [12.2, 1.3, 1, -0.2], [17.7, 1.3, -1, 0.05], [23.2, 1.25, 1, 0.3], [28.4, 1.1, -1, -0.1]].forEach(([y, s, d, r], k) => {
      if (y < top - 1) cat(P, m + (k % 2 ? -0.3 : 0.3), y, s * Math.min(1, (len - b0) / 7.2), d, r);
    });
    return;
  }
  // the long sides: rows of windows in pairs, the ground floor glazed in part
  P.r(0, P.y0, len, 0.45, '#8f908d');
  const n = Math.max(1, Math.round((len - 0.6) / 1.55)), xs = axes(0, len, n);
  const win = { frame: '#3a3d44', glass: '#46505f', fw: 0.07, bars: 0, T: false, surround: 0, sill: 0 };
  for (let y = 3.6; y + 1.5 < top; y += 2.75) { P.r(0.3, y - 0.12, len - 0.3, y + 1.55, '#a7a8a5'); row(P, W, xs, y, 1.4, 1.2, win); }
  if (len > 8) row(P, W, axes(0, len, Math.max(1, Math.round(len / 3.2))), 0.7, 2.2, 2.4, { ...win, bars: 1 });
  P.r(0, top - 0.4, len, top, '#9fa09d');
}

// ---------------------------------------------------------------- Selver
function selver(P, W) {
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05);
  P.r(0, P.y0, len, P.y1, '#eeeeec');
  P.r(0, P.y0, len, 0.4, '#b5b6b7');
  for (const y of [3.9, 7.1, 10.3]) if (y + 1.4 < top) {
    P.r(0.5, y, len - 0.5, y + 1.5, '#38404d');
    for (let x = 0.5; x < len - 0.5; x += 1.25) P.r(x - 0.04, y, x + 0.04, y + 1.5, '#d9dadb');
  }
  if (len > 15) row(P, W, axes(0, len, Math.round(len / 3.6)), 0.9, 1.9, 2.4, { frame: '#d9dadb', glass: '#3d4655', fw: 0.06, bars: 1, T: false, surround: 0, sill: 0 });
  if (W.nx < -0.6 && W.nz > 0.6 && len > 30) {                              // SELVER by the north-west end (x = 0)
    P.r(0.8, 0.3, 7.2, 2.0, '#f6f6f4'); P.text('SELVER', 4.0, 1.12, 1.15, '#d4202e', '900 %px Arial, sans-serif');
  }
  P.r(0, top - 0.3, len, top, '#d3d4d4');
}

// [name, sector, base, at, reach, wall colour, roof colour, painter]
const HOUSES = [
  ['linnamuuseum', S45, 44, [1795, 2620], 24, 0xefeeea, 0xb4502f, museum],
  ['raatuse block', S45, 24, [1825, 2636], 30, 0xe6e7e5, 0x8f9295, block24],
  ['circle k', S45, 54, [1773.5, 2639.5], 8, 0xd6d7d9, 0x9a9da1, ckShop],
  ['coop', S45, 39, [1777, 2558], 26, 0x2b4fae, 0x8d9096, coop],
  ['dormitory', S35, 30, [1753, 2528], 34, 0xb8b9b6, 0x8e9093, dorm],
  ['selver', S45, -42, [1867, 2584], 56, 0xeeeeec, 0x9a9da1, selver],
];
// the walls painted finely: the ones Martin's shots show
const FINE = [[1787.5, 2627.9], [1783.9, 2609.2], [1803.6, 2648.9], [1803.2, 2639.9], [1772.0, 2637.7], [1777.2, 2573.6], [1760.4, 2568.4],
  [1754.4, 2555.6], [1746.3, 2547.9], [1764.1, 2540.7], [1853.8, 2568.3], [1847.1, 2545.8]];
const fine = (W) => FINE.some((q) => Math.hypot(q[0] - W.mid[0], q[1] - W.mid[1]) < 3);

export function narva2Walls(walls) {
  for (const S of [S45, S35]) {
    const list = HOUSES.filter((H) => H[1] === S).map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r }));
    setHouseColours(walls, S[0], S[1], S[2], list);
  }
  // the map's canopy, a flat plate on four sticks: built again with its fascia, islands and pumps
  addHouseColours(walls, S45[0], S45[1], S45[2], [{ base: 575, x: 1767, z: 2629, hide: true, reach: 14 }, { base: 575, x: 1767, z: 2629, hide: true, shelter: true, reach: 14 }]);
}

// ---------------------------------------------------------------- the frames
// Circle K's canopy (the map's four posts): s from the north end along the axis, v + = west (to the Jõhvi road)
const CAN = frame([1761.35, 2619.8], [0.517, 0.856]), CAN_L = 20.2;
const ISLANDS = [6.0, 13.5], ISL_V = 1.2;                    // across the canopy, kept 1.5 m off the road lines
const PYLON = CAN.at(-1, 2);
// the white wall from the museum's north corner along Kivi, and on along the garden to Selver's car park
const WALL = [[1789.9, 2603.9], [1814.0, 2581.9], [1843.0, 2612.0]];
// the museum's front to Narva mnt: x from its north end
const MF = { a: [1778.4, 2614.86], u: [0.57, 0.82], n: [-0.82, 0.57] };

export function createNarva2(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  // no trees under the canopy, and the islands and the K's post are solid
  world.addClearing({ test: (x, z) => { const [s, v] = CAN.sv(x, z); return s > -3 && s < CAN_L + 1 && v > -5.5 && v < 5.5; } });
  world.addSolids([
    ...ISLANDS.map((s) => { const [x, z] = CAN.at(s, ISL_V); return { x, z, yaw: CAN.YAW, hx: 0.65, hz: 2.1 }; }),
    { x: PYLON[0], z: PYLON[1], yaw: CAN.YAW, hx: 0.35, hz: 0.35 },
  ]);
  let built = false;

  function* build() {
    const houses = HOUSES.map(([name, S, base, at, r, , , paint]) => ({ name, sec: S[0], base, at, r, spec: { wall: [220, 220, 216], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: paint }] }));
    skinHouses(world, group, houses, { shadows, ppm: 12, far: 5, faces: fine, debug: DEBUG, label: 'narva2 fronts' });
    yield;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;

    // ---- Circle K: the canopy, one box: white top, red fascia with CIRCLE K on the long sides, pale soffit
    const corners = [[0, -4.8], [0, 4.8], [CAN_L, -4.8], [CAN_L, 4.8]].map(([s, v]) => h(...CAN.at(s, v)));
    const cg = Math.min(...corners);
    const fasc = paintTexture(21.4, 0, 1.2, 20, (P) => {
      P.r(0, 0, 21.4, 1.2, '#dc2a2f'); P.r(0, 0, 21.4, 0.12, '#f39200'); P.r(0, 1.1, 21.4, 1.2, '#f2f2f0');
      P.text('CIRCLE', 15.3, 0.62, 0.66, '#ffffff', '800 %px Arial, sans-serif');
      P.arc(18.25, 0.62, 0.44, '#ffffff'); P.text('K', 18.25, 0.6, 0.6, '#dc2a2f', '900 %px Arial, sans-serif');
    });
    const red = new THREE.MeshLambertMaterial({ color: 0xdc2a2f }), fm = new THREE.MeshLambertMaterial({ map: fasc });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(21.4, 1.2, 10.2), [red, red, new THREE.MeshLambertMaterial({ color: 0xe9e9e7 }), new THREE.MeshLambertMaterial({ color: 0xd7d8da }), fm, fm]);
    { const [x, z] = CAN.at(CAN_L / 2, 0); roof.position.set(x, cg + 5.0 + 0.6, z); roof.rotation.y = CAN.YAW; roof.castShadow = shadows; roof.updateMatrix(); group.add(roof); }
    // the white trusses under it, the lights
    for (const v of [-2.6, 2.6]) A.box(CAN, CAN_L / 2, v, CAN_L - 1, 0.18, 4.65, 5.0, 0xeeeeec, cg);
    for (const s of [1.5, 7.5, 13.5, 18.5]) A.box(CAN, s, 0, 0.18, 9.4, 4.75, 5.0, 0xeeeeec, cg);
    for (const s of [3.5, 9.8, 16.2]) for (const v of [-2.6, 2.6]) A.box(CAN, s, v + 1.2, 0.5, 0.5, 4.6, 4.65, 0xfff4d8, cg);
    // the islands: kerb, a post up through each, two pumps with the red miles PLUS panels, red bollards
    for (const s of ISLANDS) {
      const ig = Math.min(h(...CAN.at(s, ISL_V - 2)), h(...CAN.at(s, ISL_V + 2)));
      A.box(CAN, s, ISL_V, 1.2, 4.2, -0.2, 0.18, 0xb9bbbd, ig);
      A.box(CAN, s, ISL_V, 0.35, 0.35, 0.18, 4.7, 0xdedfe1, ig);
      for (const dv of [-0.9, 1.3]) {
        A.box(CAN, s, ISL_V + dv, 0.55, 0.9, 0.18, 0.75, 0xdc2a2f, ig);
        A.box(CAN, s, ISL_V + dv, 0.5, 0.85, 0.75, 1.9, 0xe9e9e7, ig);
        A.box(CAN, s, ISL_V + dv, 0.52, 0.87, 1.9, 2.1, 0x3b3e44, ig);
      }
      for (const dv of [-2.0, 2.0]) { const [x, z] = CAN.at(s, ISL_V + dv); p.add(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 8), 0xdc2a2f, x, ig + 0.45, z); }
    }
    // the waste bins along the shop's back to the Jõhvi road: three green, one brown (2.7 m or more off the road)
    { const u = [0.86, -0.51], n = [0.51, 0.86], a0 = [1770.0, 2643.17], yaw = Math.atan2(-u[1], u[0]);
      [[0.8, 0x3f7a45], [2.2, 0x3f7a45], [3.6, 0x3f7a45], [4.8, 0x6b4a36]].forEach(([t, c]) => {
        const x = a0[0] + u[0] * t + n[0] * 0.75, z = a0[1] + u[1] * t + n[1] * 0.75, g = h(x, z), w = c === 0x6b4a36 ? 0.75 : 1.25;
        p.box(w, 1.15, 0.95, c, x, g + 0.62, z, yaw); p.box(w + 0.05, 0.08, 1.0, 0x2f5a35, x, g + 1.24, z, yaw);
      });
    }
    yield;

    // ---- the tall red K at the north end: a grey mast, the red box with the white K both ways
    { const g = h(...PYLON), kt = paintTexture(2.0, 0, 2.4, 40, (P) => {
        P.r(0, 0, 2.0, 2.4, '#dc2a2f'); P.r(0, 0, 2.0, 0.08, '#f39200');
        P.arc(1.0, 1.25, 0.78, '#ffffff'); P.text('K', 1.0, 1.22, 1.05, '#dc2a2f', '900 %px Arial, sans-serif');
      });
      const km = new THREE.MeshLambertMaterial({ map: kt });
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.4, 0.6), [red, red, red, red, km, km]);
      m.position.set(PYLON[0], g + 9.0 + 1.2, PYLON[1]); m.rotation.y = CAN.YAW + Math.PI / 2; m.castShadow = shadows; m.updateMatrix(); group.add(m);
      A.box(CAN, -1, 2, 0.45, 0.45, 0, 9.0, 0x9ea1a6, g);
    }
    yield;

    // ---- the museum's flags over the pavement: the Estonian flag and the red one of the city museum
    const MX = (x, out) => [MF.a[0] + MF.u[0] * x + MF.n[0] * out, MF.a[1] + MF.u[1] * x + MF.n[1] * out];
    [[14.4, [0x2f6fc6, 0x16171a, 0xf4f4f2]], [17.1, [0xd32f2f, 0xd32f2f, 0xf4f4f2]]].forEach(([x, cols]) => {
      const [wx, wz] = MX(x, 0.1), g = h(wx, wz), lean = 0.8, L = 2.4, yaw = Math.atan2(MF.n[0], MF.n[1]);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, L, 6), new THREE.MeshLambertMaterial({ color: 0x8a6b4e }));
      const [mx, mz] = MX(x, 0.1 + Math.sin(lean) * L / 2);
      pole.position.set(mx, g + 4.6 + Math.cos(lean) * L / 2, mz); pole.rotation.set(lean, yaw, 0, 'YXZ'); pole.updateMatrix(); group.add(pole);
      // the flag hangs from the pole's outer half
      const [fx, fz] = MX(x, 0.1 + Math.sin(lean) * L * 0.72);
      cols.forEach((c, k) => p.box(1.3, 0.3, 0.03, c, fx, g + 4.6 + Math.cos(lean) * L * 0.72 - 0.25 - k * 0.3, fz, Math.atan2(-MF.n[1], MF.n[0])));
    });

    // ---- the white wall along Kivi: pillars every 3.4 m, a cap, the black gate near the museum
    const gy = (q) => h(q[0], q[1]);
    for (let i = 0; i < WALL.length - 1; i++) {
      const a = WALL[i], b = WALL[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
      const at = (d) => [a[0] + ux * d, a[1] + uz * d];
      const gate = i === 0 ? [3.2, 7.4] : null;
      const parts = gate ? [[0.3, gate[0]], [gate[1], len]] : [[0, len]];
      for (const [d0, d1] of parts) { A.bar(at(d0), at(d1), 0.38, -0.3, 1.95, 0xeeede8, Math.min(gy(at(d0)), gy(at(d1)))); A.bar(at(d0), at(d1), 0.48, 1.95, 2.08, 0xf6f5f0, Math.min(gy(at(d0)), gy(at(d1)))); }
      const nP = Math.round(len / 3.4);
      for (let k = 0; k <= nP; k++) { const q = at(len * k / nP); p.box(0.62, 2.45, 0.62, 0xf3f2ed, q[0], gy(q) + 1.1, q[1], Math.atan2(-uz, ux)); }
      if (gate) { A.gate(at(gate[0] + 0.15), at(gate[1] - 0.15), 1.85, 0x26272b); for (const d of gate) { const q = at(d); p.box(0.7, 2.55, 0.7, 0xf3f2ed, q[0], gy(q) + 1.15, q[1], Math.atan2(-uz, ux)); } }
    }
    world.addSolids(WALL.slice(1).map((b, i) => { const a = WALL[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]); return { x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, yaw: Math.atan2(-(b[1] - a[1]), b[0] - a[0]), hx: len / 2, hz: 0.3 }; }));
    yield;
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 250) return;   // (300 m from the centre test drive's route past Delta: phones are near their limit there)
      if (![[1795, 2620], [1773, 2639], [1777, 2558], [1753, 2528], [1867, 2584]].every((q) => world.ready(q[0], q[1]))) return;
      built = true;
      jobs.add(build, 'narva2');
    },
  };
}
