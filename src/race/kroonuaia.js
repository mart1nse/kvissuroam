// Kroonuaia from the bridge corner to Jakobi, and Jakobi up the hill to the Veski turn (Martin, 18 Nov, from
// his Google street views of August 2024), house by house in lap order:
//   the long stone wall of the botanic garden on the left, the brown wooden house, the cream stone house,
//   the bus stop on its lawn, the grey and blue-grey wooden houses, the brick mill buildings, the red house
//   on its field-stone plinth, the green and yellow houses of the bends, the dark brown house at the zebra,
//   the blue-grey house with the street plate, the old green house with the painted windows, the ochre house
//   with red-brown trim, the long mint green house, the school (grey annex with leaves, orange wing, cream
//   old house with the gable), the salmon house, the ochre and olive houses with red window frames, and on
//   Jakobi the Kindlustus / Helen Doron corner house, the brown brick house, the red wooden house, the pink
//   house with the tall tin roof, the brick villa, the long olive house of no. 58 and the cream one opposite.
// Every wall is a painted picture on the map's own wall (src/world/houseskin.js). No street names on the road.
import * as THREE from 'three';
import { createTrack } from './race.js';
import { BOX } from './landmarks.js';
import { skinHouses, rgbHex, paintTexture, tone } from '../world/houseskin.js';
import { streetKit, setHouseColours } from '../world/streetkit.js';

const I0 = 1030, I1 = 1432;                 // the lap indexes this covers
const ROOF = { tin: 0x9aa3b0, dark: 0x5c5e6c, red: 0xb46a58, blue: 0x8ea2b8, brown: 0x7a6258, green: 0x7f9a8a };
const WHITE = '#f4f1ea';

// ---- house styles
const wood = (wall, o = {}) => ({ kind: 'wood', wall, trim: WHITE, plinth: { h: 0.7, type: 'plaster', col: '#a09ca0' }, ...o });
const S = {
  brownOrange: wood([132, 100, 84], {
    upper: { from: 3.05, wall: [206, 122, 80] }, belts: [2.95],
    trim: '#b06c48', plinth: { h: 0.35, type: 'plaster', col: '#6f6660' }, weather: 0.9, corners: 0.12,
    floors: [{ sill: 1.0, h: 1.5 }, { sill: 3.75, h: 1.55, win: { frame: '#efe6c4', T: false, bars: 1, rails: 2, surround: 0.1, sc: '#c98a58' } }],
    win: { w: 0.95, pitch: 3.2, frame: '#e6dcc0', T: false, bars: 1, rails: 2, surround: 0.08, sc: '#7a5a48' },
    attic: { w: 0.7, h: 0.8 },
  }),
  cream: { kind: 'plaster', wall: [240, 232, 204], trim: '#f6f1de', plinth: { h: 1.15, type: 'plaster', col: '#b9b6b4', band: '#d8d4cc', vents: 4.2 }, belts: [4.25, 4.5], eaves: 0.5,
    win: { w: 1.05, pitch: 3.0, frame: WHITE, T: true, surround: 0.16, sc: '#fbf7ea', hood: 0.14, glass: '#5a6a84' }, floors: [{ sill: 2.0, h: 1.75 }, { sill: 5.3, h: 1.75 }], corners: 0.3 },
  blueGrey: wood([172, 190, 202], { win: { w: 1.0, pitch: 2.6 }, plinth: { h: 0.6, type: 'plaster', col: '#9b9aa2' } }),
  weathered: wood([168, 158, 146], { trim: '#b9aea0', weather: 1.2, plinth: { h: 0.6, type: 'rubble' }, win: { w: 0.95, pitch: 2.5, frame: '#f0d6cc', sc: '#c98c80', surround: 0.09 }, belts: [3.3] }),
  shed: wood([150, 124, 108], { trim: '#8c7466', weather: 1.0, plinth: { h: 0.2, type: 'plaster', col: '#77706c' }, floors: [], attic: null, upright: true, pitch: 0.18 }),
  red: wood([196, 86, 70], { trim: '#a8503e', plinth: { h: 0.95, type: 'rubble', vents: 5 }, weather: 0.5, win: { w: 1.0, pitch: 2.7, frame: WHITE, surround: 0.1, sc: '#d9c8b0' }, belts: [3.55], attic: { w: 0.8, h: 0.9 } }),
  green: wood([164, 204, 172], { plinth: { h: 0.7, type: 'plaster', col: '#a8a6a4' }, win: { w: 1.0, pitch: 2.5 }, belts: [3.6] }),
  paleYellow: wood([238, 216, 156], { win: { w: 1.0, pitch: 2.5 }, belts: [3.6] }),
  darkBrown: wood([128, 96, 84], { trim: '#8a5a4c', plinth: { h: 1.35, type: 'plaster', col: '#e9e4d8', band: '#9a4a44', bandH: 0.22, vents: 3.6 }, weather: 0.8, corners: 0.14,
    floors: [{ sill: 2.25, h: 1.7 }, { sill: 5.15, h: 1.7 }], win: { w: 1.0, pitch: 3.0, frame: WHITE, surround: 0.09, sc: '#e6ded0' }, attic: { w: 0.9, h: 1.0 } }),
  ochre: wood([236, 190, 104], { trim: '#a8604a', plinth: { h: 0.9, type: 'plaster', col: '#b4b0ae' }, belts: [3.75], corners: 0.16,
    win: { w: 0.95, pitch: 2.6, frame: WHITE, surround: 0.13, sc: '#a8604a', apron: 0.22 }, shutters: '#e8c684', door: '#8a4a3a', attic: { w: 0.7, h: 1.1 } }),
  yellow: wood([240, 210, 132], { trim: WHITE, win: { w: 1.0, pitch: 2.6, surround: 0.1, sc: '#c98a5c' }, belts: [3.6] }),
  mint: wood([160, 208, 178], { trim: '#eef0e6', plinth: { h: 0.9, type: 'plaster', col: '#b6b4b0' }, win: { w: 0.85, pitch: 1.75, frame: WHITE, surround: 0.07, sc: '#f2f2ea' }, floors: [{ sill: 1.75, h: 1.45 }, { sill: 4.55, h: 1.45 }], belts: [3.7] }),
  salmon: { kind: 'plaster', wall: [240, 170, 140], trim: '#f0b89c', plinth: { h: 0.8, type: 'plaster', col: '#b0a8a4' }, corners: false, eaves: 0.3,
    win: { w: 0.85, pitch: 3.4, frame: '#f1e6d6', T: true, surround: 0.06, sc: '#f6d2be' }, floors: [{ sill: 1.5, h: 1.5 }, { sill: 4.6, h: 1.5 }] },
  ochreBrown: wood([210, 168, 100], { trim: '#b08a58', plinth: { h: 1.4, type: 'rubble', band: '#a8584c', bandH: 0.3, vents: 3.4 }, weather: 0.6, corners: 0.14,
    floors: [{ sill: 2.3, h: 1.75 }, { sill: 5.2, h: 1.75 }], win: { w: 1.1, pitch: 2.9, frame: WHITE, surround: 0.12, sc: '#a04a40' }, attic: { w: 0.8, h: 1.0 } }),
  olive: wood([150, 150, 104], { trim: '#8e8a60', plinth: { h: 0.8, type: 'rubble', band: '#a8584c', bandH: 0.2 }, weather: 0.8, corners: 0.14,
    floors: [{ sill: 1.75, h: 1.6 }, { sill: 4.6, h: 1.6 }], win: { w: 0.95, pitch: 3.0, frame: WHITE, surround: 0.11, sc: '#a04a40' } }),
  oliveWhite: wood([170, 170, 122], { trim: WHITE, win: { w: 1.0, pitch: 2.6 }, belts: [3.5] }),
  brickRed: { kind: 'brick', wall: [198, 110, 88], trim: '#e9dccc', plinth: { h: 0.6, type: 'rubble' }, win: { w: 1.0, pitch: 2.8, frame: WHITE, T: true, surround: 0.1, sc: '#d9c4b0' }, storey: 3.4 },
  brickDark: { kind: 'brick', wall: [140, 96, 86], trim: '#c9b8a8', plinth: { h: 0.5, type: 'plaster', col: '#77706e' }, win: { w: 1.1, pitch: 3.0, frame: '#3c3a40', T: false, bars: 1, surround: 0, sill: 0.06, sc: '#5a4a48' }, storey: 3.2 },
  greyPlaster: { kind: 'plaster', wall: [206, 208, 216], trim: '#e9e9ee', plinth: { h: 0.6, type: 'plaster', col: '#8e8e98' }, corners: false, win: { w: 1.1, pitch: 2.8, frame: WHITE, T: true, surround: 0 } },
  greenOld: wood([158, 168, 136], { trim: '#8f9a7c', weather: 1.6, plinth: { h: 0.5, type: 'rubble' }, corners: 0.12,
    floors: [{ sill: 1.25, h: 1.45 }, { sill: 3.85, h: 1.4 }], win: { w: 1.0, pitch: 3.2, frame: '#e9e2d0', T: false, bars: 1, rails: 2, surround: 0.1, sc: '#7c8468' }, attic: { w: 0.5, h: 0.5, round: true } }),
  slateBlue: wood([182, 196, 210], { trim: '#5c6478', plinth: { h: 2.3, type: 'plaster', col: '#eeeadf', band: '#5c6478', bandH: 0.18 }, corners: 0.2, pitch: 0.2,
    floors: [{ sill: 3.4, h: 1.5 }, { sill: 6.3, h: 1.5 }], win: { w: 1.1, pitch: 3.2, frame: '#5c6478', T: false, bars: 1, surround: 0.1, sc: '#5c6478' }, attic: null }),
  orangeSchool: { kind: 'plaster', wall: [244, 176, 126], trim: '#f6f0e4', plinth: { h: 0.9, type: 'plaster', col: '#b8b4b2' }, corners: false, eaves: 0.25,
    win: { w: 1.25, pitch: 2.6, frame: WHITE, T: false, bars: 1, rails: 1, surround: 0.05, sc: WHITE }, storey: 3.2 },
  creamSchool: { kind: 'plaster', wall: [240, 224, 184], trim: '#f4ead2', plinth: { h: 2.0, type: 'plaster', col: '#cfd0d6', vents: 0 }, corners: 0.25, eaves: 0.35,
    win: { w: 1.5, pitch: 3.3, frame: WHITE, T: false, bars: 2, rails: 2, surround: 0.06, sc: WHITE, sill: 0.2 }, floors: [{ sill: 3.2, h: 2.2 }, { sill: 6.9, h: 2.2 }, { sill: 10.4, h: 1.9 }, { sill: 13.6, h: 1.8 }], attic: null },
  orangeGarage: { kind: 'plaster', wall: [240, 176, 110], trim: '#d99a5c', plinth: { h: 0.2, type: 'plaster', col: '#9a9088' }, corners: false, floors: [], attic: null },
  kindlustus: wood([188, 172, 156], { trim: '#cfc2b2', pitch: 0.12, plinth: { h: 0.5, type: 'plaster', col: '#b4b4bc' }, corners: 0.16,
    win: { w: 1.5, pitch: 4.4, frame: WHITE, T: false, bars: 2, rails: 1, surround: 0.1, sc: WHITE }, attic: null }),
  brickBrown: { kind: 'brick', wall: [160, 112, 92], trim: '#4c4244', plinth: { h: 0.4, type: 'plaster', col: '#6f6a6c' }, win: { w: 1.2, pitch: 3.0, frame: '#3a3438', T: false, bars: 0, surround: 0, sill: 0.05 }, upper: { from: 4.2, wall: [96, 80, 76], upright: true, pitch: 0.2 }, eaves: false },
  paleBlue: wood([190, 204, 214], { win: { w: 0.9, pitch: 2.4 }, plinth: { h: 0.8, type: 'rubble' } }),
  redLow: wood([188, 84, 72], { trim: WHITE, plinth: { h: 1.1, type: 'plaster', col: '#a8a49c' }, floors: [{ sill: 1.95, h: 1.45 }], win: { w: 1.05, pitch: 3.6, frame: WHITE, T: false, bars: 1, rails: 2, surround: 0.1, sc: WHITE }, attic: { w: 0.6, h: 0.6, round: true }, corners: 0.14 }),
  pink: { kind: 'plaster', wall: [240, 178, 168], trim: '#f6e2da', plinth: { h: 1.2, type: 'plaster', col: '#c9c2bc', vents: 3 }, corners: false,
    win: { w: 0.95, pitch: 2.9, frame: WHITE, T: true, surround: 0.08, sc: '#f6e2da' }, floors: [{ sill: 2.1, h: 1.7 }, { sill: 5.0, h: 1.5 }], upper: { from: 4.3, wall: [170, 186, 204], upright: true, pitch: 0.5, kind: 'wood' }, attic: null },
  villa: { kind: 'brick', wall: [206, 150, 128], trim: '#f1e6d2', plinth: { h: 1.0, type: 'rubble' }, win: { w: 1.0, pitch: 2.4, frame: WHITE, T: true, surround: 0.14, sc: '#f1e6d2', hood: 0.12 }, storey: 3.3 },
  oliveLong: wood([166, 170, 96], { trim: '#a8a878', weather: 1.4, plinth: { h: 0.9, type: 'plaster', col: '#a39c94' }, corners: 0.16, pitch: 0.17,
    floors: [{ sill: 1.75, h: 1.6 }], win: { w: 1.15, pitch: 4.6, frame: '#e9e6da', T: false, bars: 1, rails: 1, surround: 0.14, sc: '#a8a878', apron: 0.5 }, attic: null }),
  creamGreen: wood([238, 226, 190], { trim: '#7fa888', plinth: { h: 0.6, type: 'plaster', col: '#a8a49c' }, floors: [{ sill: 1.4, h: 1.5 }], win: { w: 1.0, pitch: 3.2, frame: WHITE, surround: 0.1, sc: '#7fa888' }, attic: null }),
  greyLeaf: { kind: 'plaster', wall: [176, 176, 186], trim: '#b9b9c4', plinth: { h: 0.25, type: 'plaster', col: '#8e8e98' }, corners: false, floors: [], attic: null, eaves: 0.12 },
};


// ---- walls that need more than rows of windows
// the Kindlustus / Helen Doron house: two boarded floors hung from the eaves, grey plaster below them
function kindlustus(P, W, { east = false } = {}) {
  const E = W.eaves, len = W.len, B = [188, 172, 156];
  P.r(0, P.y0, len, P.y1, '#b9b9c2');                                     // plastered ground floor
  P.boards(0, E - 6.35, len, P.y1, B, 0.12);
  P.r(0, E - 6.5, len, E - 6.3, '#d9cdbd'); P.r(0, E - 3.25, len, E - 3.05, '#cfc2b2'); P.r(0, E - 0.3, len, E, '#d9cdbd');
  P.r(0, E - 6.35, 0.16, E, '#cfc2b2'); P.r(len - 0.16, E - 6.35, len, E, '#cfc2b2');
  const xs = east ? [2.0, 5.9] : [2.2, 6.4, 10.6, 14.9, 17.4];
  for (const x of xs) {
    const w = x > 17 ? 0.9 : 1.5;
    P.win(x - w / 2, E - 2.55, x + w / 2, E - 0.95, { frame: '#f4f1ea', T: false, bars: w > 1 ? 2 : 1, rails: 1, surround: 0.1, sc: '#f4f1ea' });
    if (east && x < 3) continue;                                          // the name takes this place
    if (!east && x > 13 && x < 16) continue;
    P.win(x - w / 2, E - 5.65, x + w / 2, E - 3.95, { frame: '#f4f1ea', T: false, bars: w > 1 ? 2 : 1, rails: 1, surround: 0.1, sc: '#f4f1ea', lit: x > 5 && x < 7 });
  }
  // the insurance company's ring and name
  const nx = east ? 2.6 : 14.6, ny = E - 3.62;
  P.arc(nx - 1.75, ny, 0.34, '#f1eee8'); P.arc(nx - 1.75, ny, 0.25, '#b0a294'); P.text('pzu', nx - 1.75, ny, 0.2, '#f1eee8', 'italic 700 %px Georgia, serif');
  P.text('KINDLUSTUS', nx + 0.1, ny, 0.34, '#f1eee8', '700 %px Georgia, serif');
  // the language school's blue band, the Supilinn shield
  const b0 = east ? 0.6 : len - 5.2, b1 = east ? len - 1.6 : len - 0.3, by = E - 6.25;
  P.r(b0, by - 0.42, b1, by + 0.42, '#2f7fd8');
  P.text('HELEN DORON ENGLISH', (b0 + b1) / 2, by, 0.3, '#f4f8ff', '800 %px Arial, sans-serif');
  for (const x of [b0 + 0.35, b1 - 0.35]) { P.arc(x, by, 0.2, '#f4f8ff'); P.arc(x, by, 0.12, '#2f7fd8'); }
  if (east) { const sx = len - 0.9, sy = E - 5.0; P.poly([[sx - 0.3, sy + 0.4], [sx + 0.3, sy + 0.4], [sx + 0.3, sy], [sx, sy - 0.4], [sx - 0.3, sy]], '#f1eee8'); P.poly([[sx - 0.24, sy + 0.22], [sx + 0.24, sy + 0.22], [sx + 0.24, sy], [sx, sy - 0.32], [sx - 0.24, sy]], '#4f8a58'); P.poly([[sx - 0.24, sy + 0.05], [sx + 0.24, sy + 0.05], [sx + 0.24, sy], [sx, sy - 0.32], [sx - 0.24, sy]], '#a04a4a'); P.r(sx - 0.24, sy + 0.22, sx + 0.24, sy + 0.34, '#2a2c34'); }
  // ground floor: the door under its little roof, shop windows, a cabinet
  const gy = E - 6.5;
  if (east) {
    const g = W.botAt(1) > -9 ? 0 : 0;
    P.win(0.8, g + 0.9, 2.6, g + 2.3, { frame: '#f4f1ea', glass: '#4c5a70', T: false, bars: 1, rails: 0, surround: 0.06, sc: '#dcdce2' });
    P.door(3.5, 4.5, 2.15, '#8f97a6', { frame: '#e6e6ec', light: 0, panels: 1 });
    P.r(3.72, 1.0, 4.28, 1.9, '#f4f8ff'); P.r(3.78, 1.5, 4.22, 1.8, '#2f7fd8');
    P.poly([[3.1, 2.5], [4.9, 2.5], [4.0, 2.95]], '#6c7484');
    P.win(5.3, g + 0.9, 7.1, g + 2.3, { frame: '#f4f1ea', glass: '#4c5a70', T: false, bars: 1, rails: 0, surround: 0.06, sc: '#dcdce2' });
    P.arc(6.2, 1.6, 0.42, '#3a2f5a'); P.arc(1.7, 1.6, 0.4, '#4a8f6a');
  } else {
    for (const x of [len - 3.2, len - 6.4]) if (gy - Math.max(0, W.botAt(x)) > 1.6) P.win(x - 0.5, gy - 1.9, x + 0.5, gy - 0.5, { frame: '#f4f1ea', glass: '#4c5a70', T: false, bars: 0, surround: 0.06, sc: '#dcdce2' });
  }
}
// painted boards in the window openings of the old green house
function murals(P, W) {
  const pics = [[2.2, '#e8d6b0', ['#c96a5a', '#4f7fa8', '#6a9a5a']], [5.6, '#b9d4e6', ['#e6b04a', '#a85a8a', '#3f8f7a']], [9.3, '#e6c4a0', ['#5a7ac8', '#d9884a', '#7aa85a']]];
  for (const [x, bg, cols] of pics) {
    if (x + 1.3 > W.len) continue;
    P.r(x - 0.08, 1.05, x + 1.28, 2.95, '#e9e2d0');
    P.r(x, 1.13, x + 1.2, 2.87, bg);
    P.arc(x + 0.38, 2.1, 0.2, '#e8c4a0'); P.r(x + 0.2, 1.2, x + 0.56, 1.92, cols[0]);
    P.arc(x + 0.8, 2.2, 0.2, '#e8c4a0'); P.r(x + 0.62, 1.2, x + 0.98, 2.02, cols[1]);
    P.arc(x + 0.6, 2.62, 0.16, cols[2]); P.r(x, 1.13, x + 1.2, 1.3, cols[2]);
  }
}
// the school annex: big dark windows low down, pale leafy twigs printed on the grey wall
function leafWall(P, W) {
  const len = W.len;
  const twig = (x, y, h, n) => {
    P.line(x, y, x + 0.12, y + h, '#9c9cac', 0.035);
    for (let k = 0; k < n; k++) {
      const t = 0.25 + 0.7 * k / n, px = x + 0.12 * t, py = y + h * t, d = k % 2 ? 1 : -1, bx = px + d * 0.55, by = py + 0.35;
      P.line(px, py, bx, by, '#9c9cac', 0.03);
      for (const [ox, oy] of [[0, 0], [-0.16 * d, 0.02], [0.02 * d, -0.2], [0.14 * d, 0.14]]) P.arc(bx + ox, by + oy, 0.11, '#9a9aaa');
    }
  };
  for (let x = 0.9; x < len - 0.5; x += 2.3) twig(x, 3.2 + (Math.round(x * 3) % 2) * 0.5, 2.6, 5);
  for (const x of [1.4, 6.8]) if (x + 3.6 < len) { P.r(x - 0.1, 0.55, x + 3.7, 2.95, '#4a4c58'); for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) P.grad(x + 0.04 + k * 1.2, 0.65 + j * 1.15, x + 1.16 + k * 1.2, 1.72 + j * 1.15, '#e8ecf2', '#b4bcc8'); }
}
// tall arched windows in the school gable
function schoolGable(P, W) {
  let pk = 0; for (let k = 0; k < W.top.length; k++) if (W.top[k] > W.top[pk]) pk = k;
  const x = (pk + 0.5) * W.len / W.top.length, y = W.eaves + 0.6;
  if (W.peak - W.eaves < 3) return;
  for (const d of [-1.5, 0, 1.5]) { const hh = d ? 2.0 : 2.8; if (W.topAt(x + d - 0.6) < y + hh + 0.9) continue; P.r(x + d - 0.5, y, x + d + 0.5, y + hh, '#f4f1ea'); P.arc(x + d, y + hh, 0.5, '#f4f1ea', Math.PI, Math.PI * 2); P.r(x + d - 0.42, y + 0.08, x + d + 0.42, y + hh, '#5a6a84'); P.arc(x + d, y + hh, 0.42, '#5a6a84', Math.PI, Math.PI * 2); P.r(x + d - 0.03, y, x + d + 0.03, y + hh + 0.4, '#f4f1ea'); P.r(x + d - 0.42, y + hh * 0.6, x + d + 0.42, y + hh * 0.6 + 0.06, '#f4f1ea'); }
}
const plate = (P, x, y, str) => { P.r(x - 0.75, y - 0.17, x + 0.75, y + 0.17, '#f1ede4'); P.r(x - 0.71, y - 0.13, x + 0.71, y + 0.13, '#fbf9f4'); P.text(str, x, y, 0.19, '#3a3c48', '600 %px Georgia, serif'); };

// ---- the houses: sector, LOD2 base (cm), a point inside, reach; roof colour
const HOUSES = [
  // right-hand side going round the lap
  { name: 'brown', sec: '3_4', base: -38, at: [1283, 2230], r: 14, spec: S.brownOrange, roof: ROOF.dark,
    walls: [{ near: [1284.2, 2230.9], n: 5, doors: [{ x: -6.3, w: 1.1, h: 2.2, col: '#8a7462', frame: '#6f5a4c' }], blind: [[1, 1], [0, 3]] }] },
  { name: 'cream', sec: '3_4', base: 36, at: [1234, 2283], r: 14, spec: S.cream, roof: ROOF.tin },
  { name: 'bluegrey', sec: '3_4', base: 71, at: [1206, 2294], r: 10, spec: S.blueGrey, roof: ROOF.blue },
  { name: 'weathered', sec: '3_4', base: 76, at: [1198, 2318], r: 17, spec: S.weathered, roof: ROOF.blue },
  { name: 'shed97', sec: '3_4', base: 97, at: [1174, 2350], r: 11, spec: S.shed, roof: ROOF.dark },
  { name: 'shed113', sec: '3_4', base: 113, at: [1173, 2352], r: 10, spec: S.shed, roof: ROOF.dark },
  { name: 'shed84', sec: '3_4', base: 84, at: [1180, 2345], r: 8, spec: S.shed, roof: ROOF.dark },
  { name: 'red', sec: '3_4', base: 151, at: [1148, 2372], r: 19, spec: S.red, roof: ROOF.tin },
  { name: 'green', sec: '3_4', base: 155, at: [1125, 2390], r: 13, spec: S.green, roof: ROOF.tin },
  { name: 'paleyellow', sec: '2_4', base: 168, at: [1100, 2398], r: 14, spec: S.paleYellow, roof: ROOF.blue },
  { name: 'darkbrown', sec: '2_5', base: 194, at: [1070, 2410], r: 16, spec: S.darkBrown, roof: ROOF.blue,
    walls: [{ near: [1072.6, 2411.4], n: 7, doors: [{ x: -2.0, w: 1.0, h: 3.3, col: '#a8483e', frame: '#e6ded0', light: 0.5, steps: 0 }] }] },
  { name: 'yellow234', sec: '2_5', base: 234, at: [1040, 2422], r: 12, spec: S.yellow, roof: ROOF.tin },
  { name: 'ochre', sec: '2_5', base: 251, at: [1020, 2428], r: 11, spec: S.ochre, roof: ROOF.red,
    walls: [{ near: [1020.9, 2432.8], n: 5, doors: [{ x: 4.9, w: 1.1, h: 3.0, col: '#8a4a3a', frame: '#a8604a', canopy: '#a8604a', light: 0.4 }] }] },
  { name: 'mint', sec: '2_5', base: 303, at: [1003, 2447], r: 22, spec: S.mint, roof: ROOF.tin,
    walls: [{ near: [1009, 2448.1], doors: [{ x: 11.9, w: 1.1, h: 2.9, col: '#6f8a7a', frame: '#eef0e6', light: 0.5 }], draw: (P, W) => { for (let x = 1.75; x < W.len - 1; x += 3.5) if (Math.abs(x - 11.9) > 2) for (const y of [1.75, 4.55]) P.r(x - 0.42, y, x + 0.42, y + 1.45, '#9a4a5a'); P.r(11.2, 3.3, 12.6, P.y1 - 0.3, '#8fc0a4'); P.win(11.5, 4.3, 12.3, 6.4, { frame: '#f4f1ea', T: false, bars: 0, rails: 2 }); } },
      { near: [1042.5, 2433.3], skip: true }] },
  { name: 'salmon', sec: '2_5', base: 471, at: [978, 2512], r: 16, spec: S.salmon, roof: ROOF.dark },
  { name: 'ochrebrown', sec: '2_5', base: 574, at: [967, 2538], r: 15, spec: S.ochreBrown, roof: ROOF.dark },
  { name: 'olive718', sec: '2_5', base: 718, at: [956, 2566], r: 20, spec: S.ochreBrown, roof: ROOF.tin,
    walls: [{ near: [957.5, 2570.9], spec: S.olive, n: 7, doors: [{ x: -3.6, w: 1.5, h: 2.75, col: '#7a4a40', frame: '#a04a40', light: 0.45, panels: 3, canopy: '#8a4a40' }] }] },
  // left-hand side
  { name: 'brick43', sec: '3_4', base: 43, at: [1212, 2336], r: 17, spec: S.brickRed, roof: ROOF.tin },
  { name: 'brick126', sec: '3_4', base: 126, at: [1200, 2361], r: 15, spec: S.brickDark, roof: ROOF.tin },
  { name: 'yellow67', sec: '3_4', base: 67, at: [1175, 2380], r: 21, spec: S.yellow, roof: ROOF.blue },
  { name: 'shed192', sec: '3_5', base: 192, at: [1131, 2400], r: 8, spec: { ...S.shed, wall: [128, 164, 118], trim: '#7a9a70' }, roof: ROOF.brown },
  { name: 'blue212', sec: '2_5', base: 212, at: [1113, 2409], r: 10, spec: S.blueGrey, roof: ROOF.red },
  { name: 'slate', sec: '2_5', base: 206, at: [1097, 2420], r: 14, spec: S.slateBlue, roof: ROOF.tin,
    walls: [{ near: [1091.9, 2414.05], n: 2, draw: (P, W) => { plate(P, W.len - 1.6, 4.9, 'Kroonuaia'); P.r(1.0, 0, 4.4, 1.9, '#3f4658'); for (let x = 1.1; x < 4.3; x += 0.55) P.r(x, 0.05, x + 0.03, 1.85, '#2e3444'); } }] },
  { name: 'murals', sec: '2_5', base: 257, at: [1073, 2426], r: 13, spec: S.greenOld, roof: ROOF.brown,
    walls: [{ near: [1069.7, 2422], floors: [{ sill: 3.85, h: 1.4 }], n: 4, doors: [{ x: 12.6, w: 1.1, h: 2.4, col: '#c98a5a', frame: '#e9e2d0', panels: 3 }], draw: murals },
      { near: [1080.7, 2423.7], n: 3, draw: (P) => murals(P, { len: 6 }) }] },
  { name: 'olive337', sec: '2_5', base: 337, at: [1047, 2445], r: 15, spec: S.oliveWhite, roof: ROOF.dark },
  { name: 'shed303', sec: '2_5', base: 303, at: [1042, 2434], r: 8, spec: S.shed, roof: ROOF.dark },
  { name: 'grey353', sec: '2_5', base: 353, at: [1019, 2458], r: 11, spec: S.greyPlaster, roof: ROOF.tin },
  { name: 'tan375', sec: '2_5', base: 375, at: [1012, 2473], r: 9, spec: S.paleYellow, roof: ROOF.tin },
  { name: 'leaf', sec: '2_5', base: 409, at: [1006, 2489], r: 10, spec: S.greyLeaf, roof: ROOF.tin, walls: [{ near: [1003.3, 2487], draw: leafWall }] },
  { name: 'schoolA', sec: '2_5', base: 441, at: [1005, 2506], r: 13, pick: (x, z) => z < 2516, spec: S.orangeSchool, roof: ROOF.tin },
  { name: 'schoolB', sec: '2_5', base: 441, at: [988, 2548], r: 34, pick: (x, z) => z >= 2516, spec: S.creamSchool, roof: ROOF.brown,
    walls: [{ near: [981.6, 2552.05], draw: schoolGable, doors: [{ x: -2.2, w: 1.2, h: 2.6, col: '#7a3a44', frame: '#f4f1ea', light: 0 }] }] },
  { name: 'garage', sec: '2_5', base: 789, at: [977, 2582], r: 6, spec: S.orangeGarage, roof: ROOF.dark },
  // Jakobi, going up
  { name: 'kindlustus', sec: '2_5', base: 1097, at: [925, 2590], r: 15, spec: S.kindlustus, roof: ROOF.tin,
    walls: [{ near: [922.8, 2592.85], ppm: 34, only: (P, W) => kindlustus(P, W) }, { near: [933.8, 2592.2], ppm: 34, only: (P, W) => kindlustus(P, W, { east: true }) }] },
  { name: 'kindlustus2', sec: '2_5', base: 1563, at: [932, 2582], r: 13, spec: S.kindlustus, roof: ROOF.tin },
  { name: 'brickbrown', sec: '2_5', base: 1181, at: [900, 2586], r: 9, spec: S.brickBrown, roof: ROOF.dark },
  { name: 'paleblue', sec: '2_5', base: 1585, at: [886, 2579], r: 9, spec: S.paleBlue, roof: ROOF.tin },
  { name: 'redlow', sec: '2_5', base: 1693, at: [870, 2578], r: 13, spec: S.redLow, roof: ROOF.tin },
  { name: 'pink', sec: '2_5', base: 1885, at: [855, 2572], r: 11, spec: S.pink, roof: ROOF.blue },
  { name: 'pink2', sec: '2_5', base: 1898, at: [855, 2574], r: 11, spec: S.pink, roof: ROOF.blue },
  { name: 'villa', sec: '2_5', base: 2282, at: [822, 2592], r: 15, spec: S.villa, roof: ROOF.tin },
  { name: 'olivelong', sec: '2_5', base: 2279, at: [791, 2558], r: 24, spec: S.oliveLong, roof: ROOF.dark,
    walls: [{ near: [791, 2560.45], n: 8, doors: [{ x: -13.2, w: 1.0, h: 3.0, col: '#d9d6cc', frame: '#a8a878', light: 0.5, panels: 3 }, { x: 9.5, w: 1.0, h: 3.0, col: '#d9d6cc', frame: '#a8a878', light: 0.5, panels: 3 }] }] },
  { name: 'creamgreen', sec: '2_5', base: 2374, at: [782, 2573], r: 17, spec: S.creamGreen, roof: ROOF.tin },
];

// the houses' own colours on the walls that are not painted (back yards) and on the roofs
export function kroonuaiaWalls(walls) {
  if (!walls || !walls.sectors) return;
  for (const H of HOUSES) {
    const [sx, sz] = H.sec.split('_').map(Number), wall = H.spec.wall;
    setHouseColours(walls, H.sec, -800 + sx * 640, -800 + sz * 640, [{ base: H.base, x: H.at[0], z: H.at[1], wall: typeof wall === 'string' ? parseInt(wall.slice(1), 16) : rgbHex(wall), roof: H.roof, reach: H.r }]);
  }
}


// ---- street furniture
// track frame: a point at lap index i, `lat` metres to the right of the centre line
function frameOf(track) {
  return (i, lat = 0) => {
    const k = Math.floor(i), f = i - k, a = track.P[k], b = track.P[k + 1], [tx, tz] = track.tan[k];
    return [a[0] + (b[0] - a[0]) * f - tz * lat, a[1] + (b[1] - a[1]) * f + tx * lat];
  };
}
// sign posts where the photos show them: [lap index, side (1 right, -1 left, 0 the island in the middle),
// metres beyond the road edge, faces from the bottom up]. Faces: 13 mandatory arrow, 16 priority, 17 crossing,
// 21 parking, 22 speed 30, 23 keep right, 26 steep hill, 27 children, 28 no stopping, 29 no parking, 30 bus stop
const SIGNS = [
  [1068, 1, 0.5, [21]], [1070.5, 1, 0.5, [28, 22]],
  [1072.2, 1, 0.9, [17]], [1074.2, -1, 0.9, [17]],
  [1109, 1, 1.5, [30]],
  [1158.5, 1, 1.2, [22]],
  [1205, 1, 1.1, [28, 22]], [1206.6, 1, 2.0, [17]], [1209.2, -1, 0.7, [17]], [1206.2, 0, 0, [23]],
  [1273.6, 1, 1.2, [17, 22, 27]], [1277.6, -1, 1.2, [17]], [1273.8, 0, 0, [23]],
  [1289, -1, 1.3, [29]],
  [1303, 1, 1.4, [13, 16]], [1299, -1, 1.2, [28]],
  [1314.6, 1, 0.4, [17]], [1314.4, 0, 0, [23]],
  [1340, 1, 0.7, [26]],
  [1371, -1, 1.6, [29]],
  [1419, 1, 1.3, [28, 22, 27]],
];
const ISLANDS = [1206.2, 1273.8, 1314.4];          // the small kerbed islands with the keep-right arrow
const ISLE = { a: 1.26, c: 0.74, h: 0.12, edge: 0.08 };   // their half length and width, the kerb height
const BOLLARDS = { i0: 1412, i1: 1427, n: 7, off: 0.45 };      // along the left edge before the Veski turn
// zebra crossings: the map has one too early at the start and two in the bend that are not there; the photos
// show one past the brown house and one before the Jakobi junction
const ZEBRA_OFF = [1054, 1229, 1243], ZEBRA_ON = [1073, 1316];
const ZEBRAS = [1073, 1208, 1278, 1316, 1418];                 // every crossing on the stretch: the centre line stops for them
const inStretch = (i) => (i > 1038 && i < 1321) || (i > 1335 && i < 1429);

export function kroonuaiaProps() {
  const track = createTrack(), T = frameOf(track), out = [];
  for (const [i, side, off, faces] of SIGNS) {
    const k = Math.floor(i), [tx, tz] = track.tan[k], [x, z] = T(i, side ? side * (track.HW[k] + off) : -0.2);
    const yaw = (Math.atan2(-tx, tz) * 180) / Math.PI;
    faces.forEach((f, n) => out.push([f, x, z, yaw, n * 8]));
  }
  for (const i of ZEBRA_ON) { const [tx, tz] = track.tan[i]; out.push([7, ...T(i, 0), (Math.atan2(tx, -tz) * 180) / Math.PI, track.HW[i] * 2]); }
  for (let k = 0; k < BOLLARDS.n; k++) {
    const i = BOLLARDS.i0 + (BOLLARDS.i1 - BOLLARDS.i0) * k / (BOLLARDS.n - 1);
    out.push([8, ...T(i, -(track.HW[Math.round(i)] + BOLLARDS.off)), 0]);
  }
  return out;
}
// the map's own guesses at signs along these streets go: the real ones are placed by hand
export function kroonuaiaClear(data) {
  const track = createTrack(), out = [];
  for (const key of ['2_4', '3_4', '2_5', '3_5']) {
    const a = data.sectors[key] || [];
    for (let k = 0; k < a.length; k += data.stride) {
      if (a[k] < 10 && a[k] !== 7) continue;
      const n = track.nearest(a[k + 1], a[k + 2], 1200);
      if (a[k] === 7) { if (n.d < 3 && ZEBRA_OFF.some((i) => Math.abs(n.i - i) < 4)) out.push(`${key}:${k / data.stride}`); continue; }
      if (inStretch(n.i) && n.d < track.HW[n.i] + 9) out.push(`${key}:${k / data.stride}`);
    }
  }
  return out;
}
// before the road markings are built: these streets paint their own lines
export function kroonuaiaRoads(vectors) {
  const track = createTrack(), prev = vectors.markSkip;
  vectors.markSkip = (x, z) => {
    const n = track.nearest(x, z, 1200);
    return (n.i >= PAINT.i0 && n.i <= PAINT.i1 && n.d < 2.5) || (prev ? prev(x, z) : false);
  };
}
// road paint from the photos, in lap indexes (about 2 m each) and metres right of the centre line
const PAINT = {
  i0: 1040, i1: 1429,
  // centre line: [from, to, metres painted, metres bare] (bare 0: solid), 'double' for the pair at the top of Jakobi
  centre: [[1040, 1212, 3, 4.5], [1256, 1326, 1.5, 2.5], [1333, 1400, 1, 0], [1400, 1428, 1, 0, 'double']],
  bus: { i0: 1104, i1: 1117, teeth: 5, in: 0.35, out: 2.5 },          // yellow zigzag on the right, measured from the kerb
  // painted build-outs with bars: [from, to, side, widest (m), taper in (indexes), taper out, bar every (m), bar width]
  hatch: [[1220, 1240, 1, 2.3, 1.5, 11, 3.2, 0.45], [1232, 1251, -1, 1.2, 4, 4, 2.6, 0.4], [1406, 1428, -1, 1.5, 3, 0.5, 3.4, 0.6]],
  blue: { at: [1283.5, 1286.5, 1289.5, 1292.5, 1295.5], side: -1, len: 2.3 },     // parking bay marks on the left
  // patched and newer tarmac: [from, to, lat from, lat to, darkness]
  patch: [
    [1046, 1066, -3.7, -1.9, 0.14], [1050, 1071, 2.9, 3.7, 0.18], [1084, 1087, -0.6, 1.8, 0.2],
    [1097.5, 1100.5, -0.4, 2.4, 0.24], [1100, 1102, -3.2, -1.3, 0.2], [1118, 1121, 0.3, 3.4, 0.16], [1136, 1144, -3.6, -2.6, 0.18],
    [1152, 1155, -1.2, 1.6, 0.2], [1176, 1186, 1.8, 3.4, 0.14], [1228, 1256, -4.3, 0.2, 0.13], [1262, 1265, 0.4, 3.2, 0.2],
    [1286, 1300, 0.3, 2.3, 0.15], [1304, 1306.5, -3.4, -0.6, 0.2], [1344, 1349, -2.2, 1.0, 0.18], [1367, 1370, 0.5, 3.6, 0.2],
    [1385, 1392, -3.7, -1.6, 0.15], [1406, 1409, 0.4, 3.0, 0.2],
  ],
};
// fences: [lap index from, to, side, metres beyond the road edge, height, [r, g, b], style, solid]
// styles: 'boards' close boards, 'pickets' with gaps, 'rails' posts and two rails, 'iron' thin black bars
const FENCES = [
  [1040.5, 1052.5, 1, 3.3, 1.5, [44, 44, 54], 'iron'],
  [1105, 1123, 1, 6.2, 1.1, [150, 104, 84], 'rails'],
  [1150, 1159.5, 1, 2.7, 1.85, [200, 92, 74], 'boards'],
  [1150, 1168, -1, 3.0, 1.5, [150, 172, 120], 'boards'],
  [1217, 1233, -1, 2.8, 1.15, [168, 100, 80], 'pickets'],
  [1294.2, 1298.6, 1, 2.6, 1.7, [190, 160, 110], 'boards'],
  [1309.5, 1320.5, 1, 2.5, 1.95, [136, 116, 100], 'pickets'],
  [1396, 1405, -1, 2.3, 1.5, [196, 202, 176], 'pickets'],
];

export function createKroonuaia(world, group, { shadows = true } = {}) {
  const track = createTrack();
  let built = false;

  // the islands stand on their kerb for the cars too (Martin, 19 Nov): a 12 cm oval, rounded at the edge
  const isleAt = ISLANDS.map((I) => {
    const [x, z] = frameOf(track)(I, -0.2), [tx, tz] = track.tan[Math.floor(I)];
    return { I, x, z, tx, tz };
  });
  for (const o of isleAt) {
    world.addBump({
      x0: o.x - 1.6, z0: o.z - 1.6, x1: o.x + 1.6, z1: o.z + 1.6,
      at(x, z) {
        const dx = x - o.x, dz = z - o.z, a = dx * o.tx + dz * o.tz, c = -dx * o.tz + dz * o.tx;
        const r = Math.hypot(a / ISLE.a, c / ISLE.c);
        if (r >= 1) return 0;
        const u = Math.min(1, ((1 - r) * ISLE.c) / ISLE.edge);
        return ISLE.h * u * u * (3 - 2 * u);
      },
    });
  }

  function build() {
    built = true;
    const P = track.P;
    // a wall is "seen from the road" when the lap passes in front of it within 45 m
    const faces = (W) => {
      let best = 1e9, bi = I0;
      for (let i = I0; i <= I1; i += 2) { const d = (P[i][0] - W.mid[0]) ** 2 + (P[i][1] - W.mid[1]) ** 2; if (d < best) { best = d; bi = i; } }
      return best < 45 * 45 && (P[bi][0] - W.mid[0]) * W.nx + (P[bi][1] - W.mid[1]) * W.nz > 0.5;
    };
    skinHouses(world, group, HOUSES, { faces, shadows, debug: !!window.__skinDebug });

    const K = streetKit(world, group, { shadows });
    const { p } = K;
    const h = (x, z) => world.heightAt(x, z);
    const T = frameOf(track), hw = (i) => track.HW[Math.round(i)];
    const solids = [], extra = [];
    const quads = (tex, opts = {}) => { const q = { pos: [], uv: [], col: [], mat: new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, ...opts }) }; extra.push(q); return q; };
    // an upright strip from a to b: y0..y1 above the ground at each end, texture u from u0 to u1
    const strip = (q, a, b, y0, y1, u0, u1, rgb = [255, 255, 255], level = false) => {
      let ya = h(a[0], a[1]), yb = h(b[0], b[1]);
      if (level) ya = yb = Math.max(ya, yb);
      const v = [[a[0], ya + y0, a[1], u0, 0], [b[0], yb + y0, b[1], u1, 0], [b[0], yb + y1, b[1], u1, 1], [a[0], ya + y1, a[1], u0, 1]];
      for (const k of [0, 1, 2, 0, 2, 3]) { q.pos.push(v[k][0], v[k][1], v[k][2]); q.uv.push(v[k][3], v[k][4]); q.col.push(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255); }
    };

    // the botanic garden's stone wall itself is drawn in emajoe.js; here only the pier where it steps
    { const [gx, gz] = [1267.0, 2268.7]; K.box(gx, gz, 0.95, 2.3, 0.95, 0xcdb4ae); K.box(gx, gz, 1.1, 0.12, 1.1, 0xd98d7f, 0, 2.3); }

    // ================= the low stone wall under the car park on Jakobi =================
    {
      const tex = paintTexture(8, 0, 1.3, 44, (P) => { P.rubble(0, 0, 8, 1.3, 61, '#5a5458', [[132, 124, 128], [110, 104, 112], [150, 138, 132], [120, 110, 108]], 1.1); }, { repeat: true });
      const q = quads(tex);
      let run = 0;
      for (let i = 1333.5; i < 1352; i += 1.5) {
        const o = -(hw(i) + 2.7), a = T(i, o), b = T(i + 1.5, o), a2 = T(i, o - 0.5), b2 = T(i + 1.5, o - 0.5), l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (world.sdfAt(a[0], a[1]) < 0.4) continue;
        strip(q, a, b, -0.3, 1.0, run / 8, (run + l) / 8);
        strip(q, a2, b2, -0.3, 1.0, run / 8, (run + l) / 8);
        const m = T(i + 0.75, o - 0.25);
        p.add(BOX(l + 0.05, 0.08, 0.62), 0x8f8a8c, m[0], (h(a[0], a[1]) + h(b[0], b[1])) / 2 + 1.02, m[1], Math.atan2(-(b[1] - a[1]), b[0] - a[0]));
        solids.push({ x: m[0], z: m[1], yaw: Math.atan2(-(b[1] - a[1]), b[0] - a[0]), hx: l / 2, hz: 0.3 });
        run += l;
      }
    }

    // ================= fences =================
    {
      const pick = paintTexture(0.5, 0, 1, 128, (P) => { P.c.clearRect(0, 0, 64, 128); P.r(0.03, 0, 0.21, 0.97, '#ffffff'); P.r(0.28, 0, 0.46, 0.97, '#ffffff'); P.poly([[0.03, 0.97], [0.12, 1], [0.21, 0.97]], '#ffffff'); P.poly([[0.28, 0.97], [0.37, 1], [0.46, 0.97]], '#ffffff'); P.r(0, 0.2, 0.5, 0.27, '#d8d8d8'); P.r(0, 0.74, 0.5, 0.81, '#d8d8d8'); }, { repeat: true, alpha: true });
      const board = paintTexture(0.5, 0, 1, 128, (P) => { P.r(0, 0, 0.5, 1, '#ffffff'); for (let x = 0; x < 0.5; x += 0.125) P.r(x, 0, x + 0.012, 1, '#b8b8b8'); P.r(0, 0.96, 0.5, 1, '#e4e4e4'); }, { repeat: true });
      const iron = paintTexture(0.5, 0, 1, 128, (P) => { P.c.clearRect(0, 0, 64, 128); for (let x = 0.03; x < 0.5; x += 0.125) P.r(x, 0, x + 0.03, 1, '#ffffff'); P.r(0, 0.1, 0.5, 0.14, '#ffffff'); P.r(0, 0.88, 0.5, 0.92, '#ffffff'); }, { repeat: true, alpha: true });
      const Q = { pickets: quads(pick, { alphaTest: 0.5, vertexColors: true }), boards: quads(board, { vertexColors: true }), iron: quads(iron, { alphaTest: 0.5, vertexColors: true }) };
      for (const [i0, i1, side, off, height, rgb, style] of FENCES) {
        const n = Math.max(1, Math.round((i1 - i0) / 1.2));
        let prev = null, run = 0;
        for (let k = 0; k <= n; k++) {
          const i = i0 + (i1 - i0) * k / n, pt = T(i, side * (hw(i) + off));
          const free = world.sdfAt(pt[0], pt[1]) > 0.25;
          if (prev && free) {
            const l = Math.hypot(pt[0] - prev[0], pt[1] - prev[1]), yaw = Math.atan2(-(pt[1] - prev[1]), pt[0] - prev[0]), mx = (pt[0] + prev[0]) / 2, mz = (pt[1] + prev[1]) / 2;
            if (style === 'rails') {
              const y = (h(pt[0], pt[1]) + h(prev[0], prev[1])) / 2, hexc = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
              for (const yy of [0.45, 0.9]) p.add(BOX(l, 0.1, 0.05), hexc, mx, y + yy, mz, yaw);
            } else strip(Q[style] || Q.boards, prev, pt, 0.04, height, run / 0.5, (run + l) / 0.5, rgb);
            run += l;
            solids.push({ x: mx, z: mz, yaw, hx: l / 2, hz: 0.06 });
          }
          if (free) K.box(pt[0], pt[1], style === 'iron' ? 0.05 : 0.11, height + 0.08, style === 'iron' ? 0.05 : 0.11, style === 'iron' ? 0x2c2c36 : ((rgb[0] * 0.85) << 16) | ((rgb[1] * 0.85) << 8) | (rgb[2] * 0.85 | 0));
          prev = free ? pt : null;
        }
      }
      // the hedge behind the brown picket fence
      for (let i = 1217.5; i < 1233; i += 0.7) { const [x, z] = T(i, -(hw(i) + 3.6)); if (world.sdfAt(x, z) > 0.6) K.shrub(x, z, 0.75, 0x5fa565, 0.9); }
    }

    // ================= the bus stop =================
    {
      const I = 1112.5, o = hw(I) + 3.1, [x, z] = T(I, o), [tx, tz] = track.tan[Math.floor(I)], yaw = Math.atan2(-tz, tx), y = h(x, z);
      const G = 0x2f5a4c;
      const at = (s, n) => [x + tx * s - tz * n, z + tz * s + tx * n];                      // s along the road, n away from it
      K.ribbon({ at: (t, lat) => T(t, lat) }, 1104.5, 1123, hw(1112) + 4.4, hw(1112) + 12, 'lawn');
      for (const s of [-2.0, 0, 2.0]) for (const n of [-0.7, 0.7]) { const [px, pz] = at(s, n); p.add(BOX(0.08, 2.35, 0.08), G, px, y + 1.18, pz, yaw); }
      { const [px, pz] = at(0, 0); p.add(BOX(4.5, 0.1, 1.9), 0x3a4a48, px, y + 2.42, pz, yaw); p.add(BOX(4.3, 0.06, 0.06), G, px, y + 2.3, pz, yaw); }
      { const [px, pz] = at(0, 0.45); p.add(BOX(2.6, 0.06, 0.4), 0x8a6a50, px, y + 0.48, pz, yaw); for (const s of [-1.1, 1.1]) { const [qx, qz] = at(s, 0.45); p.add(BOX(0.06, 0.46, 0.34), G, qx, y + 0.24, qz, yaw); } }
      const glass = new THREE.MeshLambertMaterial({ color: 0xbfe0e2, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false });
      const pane = (s0, n0, s1, n1) => { const a = at(s0, n0), b = at(s1, n1), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([a[0], y + 0.25, a[1], b[0], y + 0.25, b[1], b[0], y + 2.25, b[1], a[0], y + 0.25, a[1], b[0], y + 2.25, b[1], a[0], y + 2.25, a[1]], 3)); g.computeVertexNormals(); group.add(new THREE.Mesh(g, glass)); };
      pane(-2.0, 0.7, 2.0, 0.7); pane(-2.0, -0.7, -2.0, 0.7); pane(2.0, -0.2, 2.0, 0.7);
      solids.push({ x, z, yaw: Math.atan2(-tz, tx), hx: 2.1, hz: 0.8 });
      const [bx, bz] = at(-3.1, 0.3); p.add(new THREE.CylinderGeometry(0.2, 0.17, 0.75, 10), 0x2f8a78, bx, y + 0.5, bz, 0);       // the green bin
    }

    // ================= the islands at the crossings =================
    for (const I of ISLANDS) {
      // (the ground beside the island: under it the bump already lifts the height)
      const [x, z] = T(I, -0.2), [tx, tz] = track.tan[Math.floor(I)], yaw = Math.atan2(-tz, tx), y = (h(...T(I - 1, -0.2)) + h(...T(I + 1, -0.2))) / 2;
      p.add(new THREE.CylinderGeometry(0.62, 0.74, 0.13, 14).scale(1.7, 1, 1), 0xf0c84a, x, y + 0.07, z, yaw);
      for (const a of [-0.8, 0, 0.8]) p.add(BOX(0.2, 0.135, 1.2), 0x2a2a30, x + tx * a, y + 0.07, z + tz * a, yaw);
    }
    // the planters in front of the school annex
    for (const I of [1262.5, 1264.5]) { const [x, z] = T(I, -(hw(I) + 2.2)); if (world.sdfAt(x, z) > 0.5) K.box(x, z, 1.5, 0.6, 0.7, 0x2c2c34, Math.atan2(-track.tan[1263][1], track.tan[1263][0])); }
    // the stone half-balls along the drive on Jakobi
    for (let i = 1358; i < 1372; i += 2.2) { const [x, z] = T(i, -(hw(i) + 3.4)); if (world.sdfAt(x, z) > 0.5) p.add(new THREE.SphereGeometry(0.42, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x9a98a4, x, h(x, z), z, 0); }
    // steps and railing at the Helen Doron door
    { const [x, z] = [936.6, 2591.4]; if (world.sdfAt(x, z) > 0.1) for (let k = 0; k < 3; k++) K.box(x + k * 0.3, z + k * 0.16, 1.4, 0.16, 0.34, 0xa8a4a8, Math.atan2(-0.88, 0.48) + Math.PI / 2, k * 0.16); }

    // ================= road paint and patched tarmac =================
    {
      const WHITE = [0.98, 0.97, 1], YELLOW = [1, 0.84, 0.36], BLUE = [0.42, 0.62, 0.95];
      const paint = { pos: [], col: [] }, patch = { pos: [], col: [] };
      // a flat four-cornered piece on the ground, wound top up
      const quad = (q, a, b, c, d, rgb, lift = 0.07) => {
        const up = (b[1] - a[1]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[1] - a[1]) > 0;
        for (const v of up ? [a, b, c, a, c, d] : [a, c, b, a, d, c]) { q.pos.push(v[0], h(v[0], v[1]) + lift, v[1]); q.col.push(rgb[0], rgb[1], rgb[2]); }
      };
      // a stripe along the road between two offsets (numbers or functions of the lap index)
      const along = (q, i0, i1, la, lb, rgb, lift) => {
        const f = (l, i) => (typeof l === 'function' ? l(i) : l), n = Math.max(1, Math.ceil((i1 - i0) / 0.5));
        for (let k = 0; k < n; k++) {
          const a = i0 + (i1 - i0) * k / n, b = i0 + (i1 - i0) * (k + 1) / n;
          quad(q, T(a, f(la, a)), T(b, f(la, b)), T(b, f(lb, b)), T(a, f(lb, a)), rgb, lift);
        }
      };
      // a straight painted bar from one point to another
      const bar = (q, a, b, w, rgb) => {
        const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2, n = Math.max(1, Math.ceil(l / 1.2));
        for (let k = 0; k < n; k++) {
          const p = [a[0] + dx * k / n, a[1] + dz * k / n], r = [a[0] + dx * (k + 1) / n, a[1] + dz * (k + 1) / n];
          quad(q, [p[0] - nx, p[1] - nz], [r[0] - nx, r[1] - nz], [r[0] + nx, r[1] + nz], [p[0] + nx, p[1] + nz], rgb);
        }
      };
      const M = 2.03;                                   // metres per lap index here
      const atZebra = (i) => ZEBRAS.some((z) => Math.abs(i - z) < 2.6);
      for (const [i0, i1, on, off, kind] of PAINT.centre) {
        if (!off) {
          for (let i = i0; i < i1; i += 0.5) {
            if (atZebra(i + 0.25)) continue;
            if (kind === 'double') { along(paint, i, i + 0.5, -0.21, -0.09, WHITE); along(paint, i, i + 0.5, 0.09, 0.21, WHITE); }
            else along(paint, i, i + 0.5, -0.06, 0.06, WHITE);
          }
        } else for (let i = i0; i + on / M <= i1; i += (on + off) / M) if (!atZebra(i) && !atZebra(i + on / M)) along(paint, i, i + on / M, -0.06, 0.06, WHITE);
      }
      // the bus stop's yellow zigzag
      { const B = PAINT.bus, n = B.teeth * 2;
        for (let k = 0; k < n; k++) {
          const a = B.i0 + (B.i1 - B.i0) * k / n, b = B.i0 + (B.i1 - B.i0) * (k + 1) / n;
          bar(paint, T(a, hw(a) - (k % 2 ? B.out : B.in)), T(b, hw(b) - (k % 2 ? B.in : B.out)), 0.12, YELLOW);
        }
        along(paint, B.i0, B.i1, (i) => hw(i) - B.out - 0.06, (i) => hw(i) - B.out + 0.06, YELLOW); }
      // build-outs: an edge line swinging off the kerb and bars across the dead ground
      for (const [i0, i1, side, wide, tin, tout, every, bw] of PAINT.hatch) {
        const sm = (t) => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u); };
        const w = (i) => wide * sm((i - i0) / tin) * sm((i1 - i) / tout);
        along(paint, i0, i1, (i) => side * (hw(i) - w(i) - 0.07), (i) => side * (hw(i) - w(i) + 0.07), WHITE);
        for (let i = i0 + every / M / 2; i < i1; i += every / M) if (w(i) > 0.5) bar(paint, T(i + 0.5, side * (hw(i) - 0.12)), T(i - 0.3, side * (hw(i) - w(i) + 0.1)), bw, WHITE);
      }
      for (const i of PAINT.blue.at) bar(paint, T(i, PAINT.blue.side * (hw(i) - 0.15)), T(i, PAINT.blue.side * (hw(i) - PAINT.blue.len)), 0.13, BLUE);
      for (const [i0, i1, la, lb, dark] of PAINT.patch) along(patch, i0, i1, la, lb, [dark, dark, dark], 0.045);
      const mesh = (q, mat) => {
        if (!q.pos.length) return;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(q.pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(q.col, 3));
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.matrixAutoUpdate = false; group.add(m);
      };
      mesh(paint, new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      // patches darken the tarmac under them: black at the opacity given per patch (kept in the vertex colour)
      const pm = new THREE.MeshBasicMaterial({ color: 0x1a1620, vertexColors: false, transparent: true, opacity: 0.17, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      mesh(patch, pm);
    }

    K.finish();
    for (const q of extra) {
      if (!q.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(q.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(q.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(q.col, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, q.mat); m.receiveShadow = true; m.castShadow = shadows; group.add(m);
    }
    world.addSolids(solids);
  }

  return {
    update(x, z) {
      if (built || Math.hypot(x - 1050, z - 2450) > 700) return;
      if ([[1300, 2200], [1100, 2390], [1100, 2410], [1000, 2500], [800, 2570]].every(([cx, cz]) => world.ready(cx, cz))) build();
    },
  };
}
