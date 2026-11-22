// Ülikooli tänav by the town hall, batch 1 of the old town centre (Martin, 21 Nov: kaardista, 13 Street View
// shots of Aug 2024 and a map outline round Jakobi, Munga, Ülikooli, Lossi, Küütri and Rüütli). This is the
// junction of Ülikooli, Lossi and Raekoja plats behind the town hall, all of it seen in his shots:
//  - the von Bock house (Ülikooli 16): the mural of the university's main building on its south gable
//    under bare brick, the salmon and yellow fronts on Ülikooli with their white pilasters and the door of
//    number 16, the yellow north gable with the portrait photos in its windows;
//  - the Werner house (Ülikooli 11): ochre ground floor with white panels, cream upper floor, the gateway;
//  - Küütri 1 beside it: cream, the middle bays under a gable with a round window;
//  - Draakon (Raekoja plats 2): white, dark windows, the arched gate with its name beside it, and the pale
//    pink neighbour with the carved doorway along the square's approach;
//  - Lossi 3: the pink university block with its white columns along Lossi, the banner on the end wall;
//  - Philosophicum (Jakobi 2): cream over a grey banded ground floor;
//  - the corner of Pirogov's park: the bust on its plinth, the flower beds, the bike share dock, lanterns
//    for the map's street lights, the brick paved little square under the mural with its bench and flower
//    pots, benches, red planters and the parked cars behind the town hall.
// The houses are the map's own blocks with painted walls (skinHouses: a wall at a time through the work
// queue), everything else is one merged mesh built in steps (see ../jobs.js). Nothing is on a carriageway.
// Street names are never painted on the ground (Martin, 18 Nov).
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { jobs } from '../jobs.js';
import { still } from '../still.js';

const DEBUG = typeof location !== 'undefined' && /ulikoolidebug/.test(location.search);
export const S35 = ['3_5', 1120, 2400];
const SERIF = '700 %px Georgia, "Times New Roman", serif';
const TILE = 0xb4583e, TIN = 0x8f98a3;
export const dot = (W, d) => W.nx * d[0] + W.nz * d[1];
export const axes = (x0, x1, n) => Array.from({ length: n }, (_, k) => x0 + (x1 - x0) * (k + 0.5) / n);
// Which walls are painted finely: the ones a house lists with a sharpness of their own (`ppm`), the fronts the
// street photos show. (A test on `W.foot` here never passes: skinHouses asks before it has measured the foot,
// so every wall came out at the coarse `far` sharpness, the listed fronts and their lettering too.)
export function fineWalls(houses) {
  const pts = houses.flatMap((H) => (H.walls || []).filter((o) => o.ppm).map((o) => [o.near[0], o.near[1], o.within || 2.5]));
  return (W) => W.len > 6 && pts.some((q) => Math.hypot(q[0] - W.mid[0], q[1] - W.mid[1]) < q[2]);
}
// horizontal joints of a banded (rusticated) ground floor
export function bands(P, x0, x1, y0, y1, step = 0.42, col = 'rgba(70,70,80,0.22)') { for (let y = y0 + step; y < y1 - 0.05; y += step) P.r(x0, y - 0.035, x1, y, col); }
// windows on the axes xs where the wall has room for them
export function row(P, W, xs, sill, h, w, opt) {
  for (const x of xs) {
    if (x - w / 2 < 0.25 || x + w / 2 > W.len - 0.25) continue;
    if (Math.min(W.topAt(x - w / 2), W.topAt(x + w / 2)) < sill + h + 0.2 || Math.max(W.botAt(x - w / 2), W.botAt(x + w / 2)) > sill - 0.2) continue;
    P.win(x - w / 2, sill, x + w / 2, sill + h, opt);
  }
}
// A plastered classicist wall: plinth, a ground floor that may be banded or of another colour, floors of
// windows on a pitch, belts, a cornice under the eaves. Used for the plain sides and for whole houses.
export function classic(P, W, o) {
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05);
  P.r(0, P.y0, len, P.y1, o.wall); if (W.front && o.weather !== 0) P.weather(0, P.y0, len, P.y1, o.weather ?? 0.3, o.seed || 7);      // (rain streaks only where the wall is painted finely: hundreds of soft strokes a wall)
  const raised = W.foot > 2.5, pl = o.plinth || [0.7, '#a7a6a8'];
  if (!raised) {
    if (o.ground) { P.r(0, pl[0], len, o.ground[0], o.ground[1]); if (o.ground[2]) bands(P, 0, len, pl[0], o.ground[0]); P.r(0, o.ground[0], len, o.ground[0] + 0.16, o.trim || '#f3f0e8'); }
    P.r(0, P.y0, len, pl[0], pl[1]);
  }
  for (const y of o.belts || []) if (y < top - 0.3 && y > W.foot) P.r(0, y, len, y + 0.14, o.trim || '#f3f0e8');
  if (o.cornice !== 0 && W.peak - W.eaves < 1.2) { const ch = o.cornice || 0.4; P.r(0, top - ch, len, top, o.trim || '#f3f0e8'); P.r(0, top - ch, len, top - ch + 0.05, 'rgba(60,60,70,0.25)'); }
  if (len < 2.2) return;
  const n = Math.max(1, Math.round((len - 0.8) / (o.pitch || 2.6))), xs = o.xs || axes(0, len, n);
  const win = { frame: '#f4f1ea', glass: '#55627a', fw: 0.07, T: true, surround: 0.1, sc: o.trim || '#f3f0e8', sill: 0.07, ...(o.win || {}) };
  (o.floors || []).forEach(([sill, h], k) => { if (raised && sill < W.foot + 0.4) return; row(P, W, xs, sill, h, o.w || 1.1, k === 0 && o.win0 ? { ...win, ...o.win0 } : win); });
  if (!raised) for (const x of o.doors || []) P.door(x - 0.7, x + 0.7, 2.5, o.door || '#5b4336', { frame: o.trim || '#f3f0e8', light: 0.4 });
}

// ---------------------------------------------------------------- the von Bock house, Ülikooli 16
const BRICK = [152, 86, 68];
// the south gable: the mural of the main building as it stood in the 1860s, grey on grey, under bare brick
function mural(P, W) {
  if (W.len < 15) return bockSide(P, W);
  const len = W.len, top = P.y1;
  P.brick(0, P.y0, len, top, BRICK, 16); P.weather(0, 7, len, top, 0.8, 5);
  const m0 = 1.15, m1 = 7.9;
  // old render left on the brick above the picture, the sky of the picture, its ground
  P.poly([[0, m1], [len * 0.36, m1], [len * 0.36, m1 + 1.5], [len * 0.62, m1 + 1.5], [len * 0.64, m1 + 0.2], [len, m1 + 0.2], [len, m1 + 1.2], [len * 0.9, m1 + 2.3], [len * 0.72, m1 + 2.0], [len * 0.4, m1 + 2.6], [0, m1 + 2.2]], '#b9a59a');
  P.grad(0, m0, len, m1, '#c9ced6', '#e3e1dc');
  P.r(0, m0, len, 3.2, '#d9d3c8'); P.poly([[0, 3.2], [len, 3.2], [len, 3.9], [len * 0.45, 3.5], [0, 3.3]], '#cfc9be');
  // the main building: the long front running away to the right, the portico of six columns
  const body = [[1.0, 3.3], [9.2, 3.5], [9.2, 7.1], [1.0, 7.5]];
  P.poly(body, '#c3c8cf'); P.poly([[1.0, 7.5], [9.2, 7.1], [9.2, 7.3], [1.0, 7.75]], '#aab0b9');
  for (let f = 0; f < 3; f++) for (let k = 0; k < 9; k++) { const x = 1.5 + k * 0.85, y = 4.0 + f * 1.05 + (9.2 - x) * 0.012 * (f + 1); P.r(x, y, x + 0.34, y + 0.6 - f * 0.05, '#7d8794'); }
  P.poly([[9.0, 3.5], [12.6, 3.55], [12.6, 6.5], [9.0, 6.7]], '#d3d6da');
  P.poly([[8.8, 6.7], [12.8, 6.5], [10.8, 7.8]], '#c7cbd1'); P.poly([[9.3, 6.75], [12.3, 6.6], [10.8, 7.5]], '#b4bac2');
  for (let k = 0; k < 6; k++) { const x = 9.25 + k * 0.62; P.r(x, 3.6, x + 0.24, 6.6 - k * 0.03, '#eceef0'); P.r(x + 0.17, 3.6, x + 0.24, 6.6 - k * 0.03, '#a9b0ba'); }
  P.poly([[12.6, 3.55], [15.4, 3.6], [15.4, 5.6], [12.6, 6.3]], '#bcc2ca');
  for (let f = 0; f < 3; f++) for (let k = 0; k < 4; k++) P.r(12.95 + k * 0.6, 4.0 + f * 0.62 - k * 0.05, 13.15 + k * 0.6, 4.35 + f * 0.62 - k * 0.05, '#7d8794');
  // the houses down the street and the spire of Jaani church
  P.r(15.2, 3.6, 17.4, 4.9, '#d9d9d6'); P.poly([[15.1, 4.9], [17.5, 4.9], [16.3, 5.6]], '#b3a79d');
  for (let k = 0; k < 4; k++) P.r(15.45 + k * 0.5, 4.0, 15.65 + k * 0.5, 4.4, '#8d8f93');
  P.r(15.75, 4.9, 16.55, 6.4, '#bfb2a6'); P.poly([[15.6, 6.4], [16.7, 6.4], [16.15, 7.75]], '#a4877a');
  P.r(17.4, 3.6, len - 0.5, 4.6, '#cfcfcc'); P.poly([[17.3, 4.6], [len - 0.4, 4.6], [len - 1.4, 5.2], [18.2, 5.2]], '#a99f97');
  // people on the square, a carriage and pair
  const man = (x, y, s = 1, col = '#4e5158') => { P.r(x - 0.11 * s, y, x + 0.11 * s, y + 0.72 * s, col); P.arc(x, y + 0.84 * s, 0.11 * s, col); };
  const lady = (x, y, s = 1) => { P.poly([[x - 0.3 * s, y], [x + 0.3 * s, y], [x + 0.1 * s, y + 0.75 * s], [x - 0.1 * s, y + 0.75 * s]], '#6a6d74'); P.arc(x, y + 0.86 * s, 0.1 * s, '#6a6d74'); };
  [[1.6, 1.5, 1.6], [3.3, 1.9, 1.5], [3.8, 1.95, 1.5], [4.3, 1.9, 1.45], [18.4, 2.1, 1.3], [8.4, 2.9, 0.7], [8.9, 2.95, 0.7], [9.8, 3.0, 0.65], [14.6, 3.1, 0.6], [15.0, 3.1, 0.6]].forEach(([x, y, s]) => man(x, y, s));
  lady(15.6, 1.5, 1.7); lady(14.9, 2.6, 0.8);
  P.r(12.9, 2.45, 14.1, 3.0, '#5a5d63'); P.arc(13.1, 2.4, 0.26, '#3f4146'); P.arc(13.9, 2.4, 0.3, '#3f4146');
  for (const x of [11.3, 11.9]) { P.r(x, 2.5, x + 0.85, 2.9, '#eceae4'); P.r(x + 0.7, 2.8, x + 0.95, 3.2, '#eceae4'); P.r(x + 0.08, 2.15, x + 0.14, 2.5, '#dcd9d2'); P.r(x + 0.66, 2.15, x + 0.72, 2.5, '#dcd9d2'); }
  P.weather(0, m0, len, m1, 0.5, 9);
  // the plinth of painted field stones, the one real window, the little hatch
  P.rubble(0, P.y0, len, m0, 3, '#aeb4bb', [[214, 218, 222], [198, 204, 210], [226, 226, 224], [188, 192, 198], [206, 200, 196]], 1.25);
  P.win(5.3, 2.2, 6.9, 5.1, { frame: '#f5f3ee', glass: '#59667a', fw: 0.09, bars: 1, rails: 2, surround: 0.12, sc: '#e9e7e2', sill: 0.1 });
  P.r(10.3, 1.2, 11.5, 2.4, '#d5d0c6'); P.r(10.36, 1.2, 11.44, 2.34, '#e4e0d8');
}
// the front on Ülikooli: number 16 in salmon with the doorway and the bowed gable, the paler pink house, the
// yellow corner house; from the south corner
function bockFront(P, W) {
  if (W.len < 30) return bockSide(P, W);
  const len = W.len, top = Math.min(P.y1, W.eaves + 0.05), A = 13.6, B = 27.2;
  P.r(0, P.y0, A, P.y1, '#dc8f7c'); P.r(A, P.y0, B, P.y1, '#e3a594'); P.r(B, P.y0, len, P.y1, '#ead489');
  P.weather(0, P.y0, len, P.y1, 0.35, 16);
  // yellow house: banded ground floor, white belt, brown-red frames in white surrounds
  P.r(B, 1.2, len, 4.7, '#e6cf84'); bands(P, B, len, 1.2, 4.7, 0.5); P.r(B, 4.7, len, 4.9, '#f4f0e6');
  const brown = { frame: '#8b4a3c', glass: '#4d5870', fw: 0.08, T: true, surround: 0.14, sc: '#f6f2e8', sill: 0.09 };
  const yx = axes(B + 0.6, len - 0.4, 6);
  row(P, W, yx, 2.2, 1.85, 1.1, brown); row(P, W, yx, 5.6, 2.1, 1.15, { ...brown, hood: 0.12 });
  // the pink houses: white pilasters, white frames, the arched lights of the ground floor
  const white = { frame: '#f6f3ec', glass: '#515d74', fw: 0.07, T: true, surround: 0.12, sc: '#fbf8f2', sill: 0.09, hood: 0.1 };
  for (const x of [0, A - 0.55, A, B - 0.55, 4.9, 9.2, 17.6, 22.6]) P.r(x, 1.2, x + 0.55, top - 0.45, '#f7f3ec');
  row(P, W, [6.3, 7.9, 10.6, 12.0], 2.1, 1.9, 1.05, white); row(P, W, [6.3, 7.9, 10.6, 12.0], 5.5, 2.1, 1.05, white);
  for (const x of [15.0, 16.5, 19.1, 20.1, 21.1, 23.9, 25.4]) {
    P.arc(x, 3.5, 0.52, '#fbf8f2'); P.r(x - 0.52, 2.0, x + 0.52, 3.5, '#fbf8f2');
    P.arc(x, 3.5, 0.4, '#515d74'); P.r(x - 0.4, 2.1, x + 0.4, 3.5, '#515d74'); P.r(x - 0.03, 2.1, x + 0.03, 3.9, '#f6f3ec'); P.r(x - 0.4, 3.45, x + 0.4, 3.52, '#f6f3ec');
  }
  row(P, W, [15.0, 16.5, 19.1, 20.1, 21.1, 23.9, 25.4], 5.6, 2.0, 0.95, white);
  // belts, cornice, the bowed gables over the eaves line
  P.r(0, 4.75, B, 4.92, '#f7f3ec'); P.r(0, top - 0.45, len, top, '#f7f3ec'); P.r(0, top - 0.45, len, top - 0.4, 'rgba(60,50,50,0.25)');
  for (const [x, w, col] of [[2.7, 3.6, '#dc8f7c'], [20.1, 4.4, '#e3a594']]) {
    P.poly([[x - w / 2, top - 0.5], [x + w / 2, top - 0.5], [x + w / 2, top + 0.4], [x + w * 0.3, top + 1.3], [x, top + 1.6], [x - w * 0.3, top + 1.3], [x - w / 2, top + 0.4]], '#f7f3ec');
    P.poly([[x - w / 2 + 0.25, top - 0.5], [x + w / 2 - 0.25, top - 0.5], [x + w / 2 - 0.25, top + 0.3], [x + w * 0.26, top + 1.05], [x, top + 1.3], [x - w * 0.26, top + 1.05], [x - w / 2 + 0.25, top + 0.3]], col);
  }
  // number 16: the door in its white frame up three steps, the wide wooden window above it
  P.r(1.55, 0.3, 3.85, 4.3, '#f7f3ec'); P.r(1.4, 4.3, 4.0, 4.6, '#f7f3ec'); P.poly([[1.4, 4.6], [4.0, 4.6], [2.7, 5.0]], '#f7f3ec');
  P.r(1.95, 0.5, 3.45, 3.9, '#6a4632'); P.r(2.67, 0.5, 2.73, 3.3, '#4c3122'); P.r(1.95, 3.3, 3.45, 3.36, '#4c3122');
  for (const x of [2.08, 2.82]) { P.r(x, 0.75, x + 0.5, 1.7, '#573826'); P.r(x, 1.9, x + 0.5, 3.15, '#573826'); }
  P.r(2.1, 3.42, 3.3, 3.82, '#39424f');
  for (let k = 0; k < 3; k++) P.r(1.5 - k * 0.12, P.y0, 3.9 + k * 0.12, 0.5 - k * 0.17, '#9ea2a8');
  P.win(1.25, 5.6, 4.15, 8.3, { frame: '#8a5a34', glass: '#4f5a66', fw: 0.11, bars: 2, rails: 1, surround: 0.16, sc: '#a06a3c', sill: 0.12 });
  P.r(5.55, 3.05, 6.1, 3.4, '#f1f0ec'); P.text('16', 5.82, 3.22, 0.26, '#2c2f36');
  // the arched doorway of the pink house by the yellow one, plinth, cellar windows
  P.arc(26.2, 3.1, 0.75, '#f7f3ec'); P.r(25.45, 1.0, 26.95, 3.1, '#f7f3ec'); P.arc(26.2, 3.1, 0.6, '#a14234'); P.r(25.6, 0.4, 26.8, 3.1, '#a14234'); P.r(26.17, 0.4, 26.23, 3.6, '#7a2f26');
  P.r(0, P.y0, len, 1.2, '#a9adb4'); P.r(0, 1.2, len, 1.3, '#bfc2c7');
  P.r(1.5, P.y0, 3.9, 0.5, '#9ea2a8');
  for (const x of [...[6.3, 7.9, 10.6, 12.0, 15.0, 19.1, 21.1, 23.9], ...yx]) P.r(x - 0.4, 0.35, x + 0.4, 0.85, x > B ? '#8b4a3c' : '#3d4350');
  for (const x of yx) P.r(x - 0.32, 0.43, x + 0.32, 0.78, '#4d5870');
  P.r(A - 0.07, 0, A + 0.07, top, '#8b8f96'); P.r(B - 0.07, 0, B + 0.07, top, '#8b8f96');     // rain pipes
}
// the north gable, to Jakobi: yellow, banded below, the portrait photographs in its windows and lunette
function bockNorth(P, W) {
  if (W.len < 10) return bockSide(P, W);
  const len = W.len, ev = Math.min(W.eaves, 10.4);
  P.r(0, P.y0, len, P.y1, '#ead489'); P.weather(0, P.y0, len, P.y1, 0.3, 61);
  P.r(0, 1.3, len, 4.7, '#e6cf84'); bands(P, 0, len, 1.3, 4.7, 0.5); P.r(0, 4.7, len, 4.9, '#f4f0e6');
  P.r(0, ev - 0.35, len, ev, '#f4f0e6'); P.r(0, ev, len, P.y1, '#f0ece2');
  const xs = axes(0.5, len - 0.5, 6);
  const photo = (x, y, w, h) => {
    P.r(x - w / 2 - 0.12, y - 0.1, x + w / 2 + 0.12, y + h + 0.12, '#f6f2e8'); P.grad(x - w / 2, y, x + w / 2, y + h, '#3b3d42', '#1f2024');
    for (const [dx, s] of [[-0.24, 1], [0.2, 0.92]]) { P.arc(x + dx * w, y + h * 0.62, 0.17 * s, '#c9c9c7'); P.poly([[x + dx * w - 0.26, y + 0.05], [x + dx * w + 0.26, y + 0.05], [x + dx * w + 0.16, y + h * 0.5], [x + dx * w - 0.16, y + h * 0.5]], dx < 0 ? '#e4e4e2' : '#5c5e63'); }
  };
  xs.forEach((x, k) => {
    if (k === 1) P.win(x - 0.55, 2.3, x + 0.55, 4.2, { frame: '#8b4a3c', glass: '#4d5870', fw: 0.08, T: true, surround: 0.12, sc: '#f6f2e8' }); else photo(x, 2.3, 1.1, 1.9);
    if (k === 4) P.win(x - 0.55, 5.7, x + 0.55, 7.8, { frame: '#8b4a3c', glass: '#4d5870', fw: 0.08, T: true, surround: 0.12, sc: '#f6f2e8' }); else photo(x, 5.7, 1.1, 2.1);
  });
  const mx = len / 2, ly = ev + 0.9;
  if (W.topAt(mx) > ly + 1.9) { P.arc(mx, ly, 1.75, '#dcd8ce', Math.PI, Math.PI * 2); P.arc(mx, ly, 1.55, '#2a2b30', Math.PI, Math.PI * 2); for (const dx of [-0.6, 0, 0.6]) { P.arc(mx + dx, ly + 0.95 - Math.abs(dx) * 0.3, 0.2, '#c4c4c2'); P.r(mx + dx - 0.24, ly, mx + dx + 0.24, ly + 0.72 - Math.abs(dx) * 0.3, '#55575c'); } }
  P.r(0, P.y0, len, 1.3, '#a9adb4'); P.r(0, 1.3, len, 1.4, '#bfc2c7');
  for (const x of [xs[1], xs[4]]) { P.r(x - 0.42, 0.35, x + 0.42, 0.9, '#8b4a3c'); P.r(x - 0.34, 0.43, x + 0.34, 0.82, '#4d5870'); }
}
function bockSide(P, W) { return classic(P, W, { wall: W.len < 8 ? '#dc9a88' : '#ead9a2', plinth: [1.0, '#a9adb4'], floors: [[2.1, 1.7], [5.4, 1.8]], pitch: 3.1, seed: 26 }); }

// ---------------------------------------------------------------- the Werner house, Ülikooli 11
// the front on Ülikooli, from its north end
function wernerFront(P, W) {
  if (W.len < 20) return wernerSide(P, W);
  const len = W.len, top = P.y1, ev = Math.min(P.y1, W.eaves + 0.05);
  P.r(0, P.y0, len, top, '#f0eadb'); P.weather(0, P.y0, len, top, 0.25, 11);
  P.r(0, 0.9, len, 4.25, '#e2b566'); P.r(0, 4.25, len, 4.45, '#f6f3ea');
  // the white panels over the ground floor openings, the tall windows of the upper floor
  const up = axes(0.3, len - 0.3, 8), white = { frame: '#f6f3ec', glass: '#505c72', fw: 0.07, T: true, surround: 0.13, sc: '#fbf9f3', sill: 0.09, hood: 0.12 };
  row(P, W, up, 5.35, 2.35, 1.15, white);
  up.forEach((x, k) => { if (k !== 5) P.r(x - 0.8, 3.45, x + 0.8, 3.95, '#f6f3ea'); });
  P.r(0, ev - 0.4, len, ev, '#f6f3ea'); P.r(0, ev - 0.4, len, ev - 0.35, 'rgba(60,50,40,0.25)');
  // shop windows with flower boxes, the doors, the carriage gateway with its iron gate
  const shop = { frame: '#f6f3ec', glass: '#48546a', fw: 0.08, bars: 1, rails: 1, surround: 0.1, sc: '#fbf9f3', sill: 0.08 };
  const gate = up[5];
  up.forEach((x, k) => {
    if (k === 5) return;
    if (k === 2) { P.door(x - 0.6, x + 0.6, 2.75, '#5a4334', { frame: '#f6f3ea', light: 0.5, panels: 2 }); return; }
    P.win(x - 0.85, 1.35, x + 0.85, 3.25, shop);
    P.r(x - 0.85, 1.05, x + 0.85, 1.3, '#3b3d40'); for (let j = 0; j < 6; j++) P.arc(x - 0.7 + j * 0.28, 1.36, 0.13, j % 2 ? '#d83a4a' : '#e2475a');
  });
  P.arc(gate, 2.3, 1.2, '#f6f3ea'); P.r(gate - 1.2, 0.2, gate + 1.2, 2.3, '#f6f3ea'); P.arc(gate, 2.3, 1.0, '#26282c'); P.r(gate - 1.0, P.y0, gate + 1.0, 2.3, '#26282c');
  for (let q = -0.85; q < 0.9; q += 0.17) P.r(gate + q - 0.015, P.y0, gate + q + 0.015, 2.3 + Math.sqrt(Math.max(0, 1 - q * q)) * 0.95, '#4a4d54');
  P.r(gate - 1.0, 1.5, gate + 1.0, 1.56, '#4a4d54');
  // the oval signs on their brackets
  for (const x of [up[3] + 1.38, up[6] + 1.38]) { P.arc(x - 0.5, 3.05, 0.33, '#17181b'); P.arc(x + 0.5, 3.05, 0.33, '#17181b'); P.r(x - 0.5, 2.72, x + 0.5, 3.38, '#17181b'); P.text('Werner', x, 3.05, 0.32, '#f1ece0', 'italic 700 %px Georgia, serif'); }
  P.r(0, P.y0, len, 0.9, '#a7abb2'); P.r(0, 0.9, len, 0.98, '#c2c5ca');
  P.r(gate - 1.0, P.y0, gate + 1.0, 0.9, '#26282c'); for (let q = -0.85; q < 0.9; q += 0.17) P.r(gate + q - 0.015, P.y0, gate + q + 0.015, 0.9, '#4a4d54');
}
function wernerSide(P, W) { return classic(P, W, { wall: '#f0eadb', plinth: [0.9, '#a7abb2'], floors: [[1.7, 1.7], [5.4, 2.0], [8.9, 1.5]], pitch: 3.1, seed: 12, win: { hood: 0.1 } }); }

// ---------------------------------------------------------------- Küütri 1, the cream house north of Werner
const K1 = { wall: '#f1ecdf', plinth: [0.9, '#a7abb2'], floors: [[1.6, 1.9], [5.3, 2.2], [9.2, 1.6], [12.2, 1.5]], pitch: 2.7, seed: 13, win: { hood: 0.12 }, belts: [4.3] };
function kuutri1(P, W) {
  const street = dot(W, [-0.9, 0.43]) > 0.9;
  if (street && W.len > 5 && W.len < 11) {                                 // the middle bays, a step forward under their gable
    classic(P, W, { ...K1, wall: '#f6f2e8', xs: axes(0.3, W.len - 0.3, 3), cornice: 0 });
    const ev = Math.min(W.eaves, 9.4), mx = W.len / 2;
    P.r(0, ev - 0.3, W.len, ev, '#fbf9f3'); P.r(0, 0.9, 0.3, ev, '#fbf9f3'); P.r(W.len - 0.3, 0.9, W.len, ev, '#fbf9f3');
    if (W.topAt(mx) > ev + 1.3) { P.arc(mx, ev + 0.8, 0.45, '#fbf9f3'); P.arc(mx, ev + 0.8, 0.32, '#505c72'); }
    return;
  }
  classic(P, W, street && W.len > 20 ? { ...K1, doors: [W.len - 2.6] } : K1);
}

// ---------------------------------------------------------------- Draakon, Raekoja plats 2
const DARKWIN = { frame: '#3b2f2a', glass: '#3f4654', fw: 0.07, bars: 1, rails: 2, surround: 0.1, sc: '#fbfaf7', sill: 0.07 };
// the end to Ülikooli, from its north corner
function draakonEnd(P, W) {
  if (W.len < 12) return draakonPlain(P, W);
  const len = W.len;
  P.r(0, P.y0, len, P.y1, '#f2efec'); P.weather(0, P.y0, len, P.y1, 0.25, 22);
  const xs = axes(0.6, len - 0.6, 4);
  row(P, W, xs, 4.55, 1.55, 1.25, DARKWIN); row(P, W, [xs[0], xs[3]], 1.4, 1.6, 1.25, DARKWIN);
  const gx = xs[1] + 0.9;
  const arch = (q) => 2.25 + Math.sqrt(Math.max(0, 1 - (q / 1.75) ** 2)) * 0.8;
  P.poly([[gx - 1.75, P.y0], ...Array.from({ length: 15 }, (_, k) => [gx - 1.75 + k * 0.25, arch(-1.75 + k * 0.25)]), [gx + 1.75, P.y0]], '#2a2523');
  for (let q = -1.4; q < 1.5; q += 0.47) P.r(gx + q - 0.025, 0.3, gx + q + 0.025, arch(q), '#5a4a40');
  for (const y of [1.0, 1.7] ) P.r(gx - 1.75, y, gx + 1.75, y + 0.05, '#5a4a40');
  P.text('Draakoni', gx - 0.3, 3.6, 0.42, '#1d1b1b', SERIF); P.text('restoran', xs[2] + 1.4, 3.35, 0.3, '#1d1b1b', SERIF); P.text('baar', xs[2] + 1.4, 2.95, 0.3, '#1d1b1b', SERIF);
  P.r(0, P.y0, len, 0.45, '#b8b5b3');
}
// the long side to the town hall: Draakon's dark windows, then the pale pink house with the carved doorway
function draakonSide(P, W) {
  if (W.len < 25) return draakonPlain(P, W);
  const len = W.len, A = 15.4, top = Math.min(P.y1, W.eaves + 0.05);
  P.r(0, P.y0, A, P.y1, '#efecee'); P.r(A, P.y0, len, P.y1, '#f1dfdc'); P.weather(0, P.y0, len, P.y1, 0.25, 23);
  row(P, W, [2.0, 5.6, 9.4, 13.0], 4.6, 1.55, 1.25, DARKWIN); row(P, W, [2.0, 9.4, 13.0], 1.4, 1.6, 1.25, DARKWIN);
  P.door(5.0, 6.2, 2.5, '#3b2f2a', { frame: '#fbfaf7', light: 0.4 });
  const white = { frame: '#f6f3ec', glass: '#434b5c', fw: 0.07, bars: 1, rails: 2, surround: 0.13, sc: '#fbf9f6', sill: 0.08, hood: 0.1 };
  const xs = axes(A + 0.5, len - 0.5, 7);
  for (const x of [A, A + (len - A) * 0.36, A + (len - A) * 0.64, len - 0.5]) P.r(x, 0.5, x + 0.5, top - 0.4, '#fbf9f6');
  row(P, W, xs, 4.7, 1.7, 1.1, white); row(P, W, xs.filter((_, k) => k !== 3), 1.45, 1.75, 1.1, white);
  const dx = xs[3];                                                       // the doorway: scrolled white frame, dark arched door
  P.poly([[dx - 1.5, 0.3], [dx + 1.5, 0.3], [dx + 1.3, 3.5], [dx + 1.7, 3.7], [dx + 0.9, 4.25], [dx, 4.5], [dx - 0.9, 4.25], [dx - 1.7, 3.7], [dx - 1.3, 3.5]], '#fbf9f6');
  P.arc(dx, 2.5, 0.8, '#4a332a'); P.r(dx - 0.8, 0.3, dx + 0.8, 2.5, '#4a332a'); P.r(dx - 0.03, 0.3, dx + 0.03, 3.2, '#2e1f19');
  P.r(0, top - 0.4, len, top, '#fbf9f6'); P.r(0, P.y0, len, 0.5, '#b8b5b8'); P.r(A - 0.06, 0, A + 0.06, top, '#8d9096');
}
function draakonPlain(P, W) { return classic(P, W, { wall: '#f2efec', plinth: [0.45, '#b8b5b3'], floors: [[1.4, 1.6], [4.55, 1.55]], pitch: 3.4, w: 1.2, win: { ...DARKWIN, T: false }, seed: 24 }); }

// ---------------------------------------------------------------- Lossi 3 and Philosophicum
const PINK = '#e9bdb0', LWIN = { frame: '#f6f4ef', glass: '#4f5b70', fw: 0.07, bars: 1, rails: 1, surround: 0, sill: 0.06 };
// the long front on Lossi from its west end: white square columns three storeys high before the glass
function lossiFront(P, W) {
  if (W.len < 50) return lossiPlain(P, W);
  const len = W.len, top = P.y1, c0 = 7.5, c1 = len - 9.5;
  P.r(0, P.y0, len, top, PINK); P.weather(0, P.y0, len, top, 0.25, 31);
  P.r(c0, P.y0, c1, top - 1.1, '#3f4854');                                 // the recess behind the columns
  for (let y = 0.4; y < top - 1.4; y += 3.3) {
    P.r(c0, y + 2.3, c1, y + 3.3, '#dcb3a6');                              // spandrels
    for (let x = c0 + 0.5; x < c1 - 0.5; x += 1.45) P.r(x, y, x + 0.07, y + 2.3, '#eef0f0');
    P.r(c0, y + 1.5, c1, y + 1.56, '#eef0f0');
  }
  const n = Math.round((c1 - c0) / 4.6);
  for (let k = 0; k <= n; k++) { const x = c0 + (c1 - c0) * k / n; P.r(x - 0.38, P.y0, x + 0.38, top - 1.1, '#f6f4ef'); P.r(x + 0.26, P.y0, x + 0.38, top - 1.1, '#d9d7d2'); }
  P.r(0, top - 1.1, len, top, '#f6f4ef'); P.r(0, top - 1.1, len, top - 1.03, 'rgba(60,60,70,0.3)');
  for (const [a, b] of [[0, c0 - 0.4], [c1 + 0.4, len]]) row(P, W, axes(a + 0.4, b - 0.4, 2), 1.3, 1.9, 1.3, LWIN), row(P, W, axes(a + 0.4, b - 0.4, 2), 4.7, 1.9, 1.3, LWIN), row(P, W, axes(a + 0.4, b - 0.4, 2), 8.1, 1.9, 1.3, LWIN);
  P.r(0, P.y0, len, 0.4, '#b7b2b4');
}
// the end to Ülikooli, from the Lossi corner: the low entrance wing, the banner, three windows up the right
function lossiEnd(P, W) {
  if (W.len < 12) return lossiPlain(P, W);
  const len = W.len, top = P.y1;
  P.r(0, P.y0, len, top, PINK); P.weather(0, P.y0, len, top, 0.25, 32);
  P.r(0, 4.3, 11.2, 4.75, '#f6f4ef'); P.r(0, 4.3, 11.2, 4.36, 'rgba(60,60,70,0.3)');
  P.r(4.1, 0.3, 6.3, 3.5, '#f6f4ef'); P.r(4.4, 0.45, 6.0, 3.2, '#4a4f58'); P.r(5.17, 0.45, 5.23, 3.2, '#f6f4ef'); P.r(4.4, 2.5, 6.0, 2.56, '#f6f4ef');
  for (let k = 0; k < 3; k++) P.r(3.9 - k * 0.15, P.y0, 6.5 + k * 0.15, 0.45 - k * 0.15, '#a9a6a6');
  P.win(8.6, 0.9, 9.9, 3.6, { ...LWIN, rails: 2, surround: 0.08, sc: '#f6f4ef' });
  row(P, W, [13.4], 5.6, 1.8, 1.4, LWIN); row(P, W, [13.4], 8.9, 1.8, 1.4, LWIN); row(P, W, [13.4], 12.1, 1.8, 1.4, LWIN);
  // the banner in its frame
  if (top > 13.5) {
    P.r(4.2, 7.0, 8.6, 13.8, '#8f9499'); P.grad(4.3, 7.1, 8.5, 13.7, '#f6eef0', '#f3dfe4');
    P.arc(6.4, 11.2, 1.5, '#f1a9be'); P.arc(5.7, 11.6, 0.9, '#f7c6d4'); P.arc(7.1, 11.5, 0.9, '#f7c6d4');
    for (const [x, col] of [[5.7, '#e8e6e2'], [7.0, '#d9c9b8']]) { P.r(x - 0.42, 7.4, x + 0.42, 9.9, col); P.arc(x, 10.3, 0.36, '#e3c0a6'); P.r(x - 0.4, 7.4, x - 0.02, 8.4, '#4a5a78'); P.r(x + 0.02, 7.4, x + 0.4, 8.4, x > 6 ? '#e2632f' : '#4a5a78'); }
    for (const y of [13.25, 12.9]) P.r(4.9, y, 7.9, y + 0.14, '#b0486a');
  }
  P.r(0, top - 0.9, len, top, '#f6f4ef'); P.r(0, P.y0, len, 0.4, '#b7b2b4');
}
function lossiPlain(P, W) {
  if (W.foot > 8) {                                                        // the set-back top storey: a white band of windows
    P.r(0, P.y0, W.len, P.y1, '#ecebe7');
    if (W.len > 6) for (let x = 0.8; x < W.len - 1.6; x += 2.4) P.r(x, W.foot + 0.9, x + 1.5, Math.min(P.y1 - 0.5, W.foot + 2.4), '#4f5b70');
    return;
  }
  classic(P, W, { wall: PINK, plinth: [0.4, '#b7b2b4'], floors: [[1.3, 1.9], [4.7, 1.9], [8.1, 1.9], [11.5, 1.8]], pitch: 3.0, w: 1.3, win: { ...LWIN, T: false }, cornice: 0.7, seed: 33 });
}
export const philo = (P, W) => classic(P, W, {
  wall: W.foot > 8 ? '#e9e4d2' : '#eedf9f', plinth: [1.0, '#a3a7ae'], ground: [4.2, '#d5d8dc', true], floors: [[1.9, 1.7], [5.2, 2.0], [8.6, 2.0], [12.0, 1.7]],
  pitch: 2.75, w: 1.15, cornice: 1.1, belts: [7.9], win: { hood: 0.1 }, seed: 44,
});

// [name, base, at, reach, wall colour, roof colour, default painter, walls]
const HOUSES = [
  ['bock', 605, [1310, 2811], 30, 0xe9d79c, TILE, bockSide, [
    { near: [1317.7, 2826.1], within: 4, only: mural, ppm: 14 }, { near: [1315.7, 2802.6], within: 5, only: bockFront, ppm: 14 }, { near: [1297.4, 2786.3], within: 4, only: bockNorth, ppm: 14 }]],
  ['werner', 515, [1338, 2808], 19, 0xf0eadb, TILE, wernerSide, [{ near: [1329.4, 2810.5], within: 4, only: wernerFront, ppm: 14 }]],
  ['kuutri1', 485, [1333, 2787], 27, 0xf1ecdf, TILE, kuutri1, []],
  ['draakon', 551, [1358, 2828], 22, 0xf2efec, TILE, draakonPlain, [
    { near: [1339.7, 2831.8], within: 4, only: draakonEnd, ppm: 14 }, { near: [1359.8, 2837.1], within: 5, only: draakonSide, ppm: 12 }]],
  ['lossi3', 736, [1264, 2846], 45, 0xe9bdb0, 0x4c4f57, lossiPlain, [
    { near: [1269.9, 2857.7], within: 5, only: lossiFront, ppm: 10 }, { near: [1301.1, 2835.6], within: 4, only: lossiEnd, ppm: 12 }]],
  ['philo', 544, [1255, 2821], 45, 0xeedf9f, TIN, philo, []],
];
const CENTRE = [1322, 2825];

export function ulikooliWalls(walls) {
  setHouseColours(walls, S35[0], S35[1], S35[2], HOUSES.map(([, base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
}

// the map's tall street lights round the junction make way for the old town's lanterns
const LIGHT = 0;
export function ulikooliClear(data) {
  const out = [], a = data.sectors['3_5'] || [];
  for (let k = 0; k < a.length; k += data.stride) {
    if (a[k] === LIGHT && a[k + 1] > 1300 && a[k + 1] < 1368 && a[k + 2] > 2795 && a[k + 2] < 2862) out.push(`3_5:${k / data.stride}`);
  }
  return out;
}
// the cafe's name is painted on its own house (the map hangs its sign on the neighbour)
export function ulikooliSignSkip(world) {
  const prev = world.signSkip;
  world.signSkip = (x, z) => Math.hypot(x - 1339.6, z - 2831.8) < 3 || (prev ? prev(x, z) : false);
}
export function ulikooliProps() {
  // lanterns: by the bike dock, at the Draakon corner, before the carved doorway, behind the town hall, on the little square
  return [[9, 1336.6, 2851.0, 0], [9, 1358.6, 2841.6, 180], [9, 1368.0, 2856.6, 250], [9, 1323.6, 2831.2, 160]];
}

// the row behind the town hall: bays square to its back wall, clear of the street to Poe
const HALL = [[1402.65, 2873.9], [1386.1, 2841.5]];                         // the town hall's front, as in raekoda.js
const HALL_BACK = frame([1369.5, 2849.6], [0.454, 0.891]);                // s along the back wall to the south, v out from the hall
export const ULIKOOLI_CARS = [];
{
  const ids = ['rav4', 'passat', 'mazda6', 'ceedsw', 'model3', 'passat'], paints = ['white', 'grey', 'black', 'silver', 'white', 'red'];
  const yaw = Math.atan2(-HALL_BACK.V[0], HALL_BACK.V[1]);                 // noses to the hall
  [5.5, 8.4, 11.3, 16.8, 19.7, 22.6].forEach((s, k) => ULIKOOLI_CARS.push([...HALL_BACK.at(s, 3.4), yaw, ids[k], paints[k], 0.03]));
}

export function createUlikooli(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  let built = false;

  // (in steps, see ../jobs.js: each `yield` is a place to stop until the next frame)
  function* build() {
    const houses = HOUSES.map(([name, base, at, r, , , paint, walls]) => ({ name, sec: S35[0], base, at, r, spec: { wall: [230, 225, 215], floors: [], attic: null, eaves: false }, walls: [...walls, { near: [0, 0], within: 1e9, only: paint }] }));
    skinHouses(world, group, houses, { shadows, ppm: 11, far: 6, faces: fineWalls(houses), debug: DEBUG, label: 'ulikooli fronts' });
    yield;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    yield;
    // ---- the little square under the mural: brick paving, the bench between two flower balls, low pots
    const M = frame([1308.2, 2830.3], [0.913, -0.408]);                     // s along the gable to the street, v out from it
    A.pave(M, -5.5, 19.4, 0.3, 10.6, 'red');
    yield;
    const bench = (F, s, v, turn = 0) => {
      const [x, z] = F.at(s, v), y = h(x, z), yaw = F.YAW + turn;
      p.box(1.9, 0.07, 0.5, 0x8a5f3e, x, y + 0.46, z, yaw); p.box(1.9, 0.5, 0.06, 0x8a5f3e, x - Math.sin(yaw) * 0.26, y + 0.78, z - Math.cos(yaw) * 0.26, yaw);
      for (const e of [-0.85, 0.85]) p.box(0.07, 0.46, 0.46, 0x2c2c31, x + Math.cos(yaw) * e, y + 0.23, z - Math.sin(yaw) * e, yaw);
    };
    const blob = (x, y, z, r, hex) => p.add(new THREE.IcosahedronGeometry(r, 1), hex, x, y, z);
    const pot = (x, z, r = 0.55, flower = 0xd8324a) => { const y = h(x, z); p.add(new THREE.CylinderGeometry(r, r * 0.7, 0.4, 10), 0x6b6d72, x, y + 0.2, z); blob(x, y + 0.52, z, r * 0.85, flower); blob(x + r * 0.3, y + 0.62, z - r * 0.2, r * 0.45, 0x4f8a4a); };
    const ball = (x, z) => { const y = h(x, z); p.box(0.08, 0.9, 0.08, 0x2c2c31, x, y + 0.45, z); blob(x, y + 1.2, z, 0.5, 0xc93a52); blob(x + 0.16, y + 1.4, z + 0.1, 0.24, 0xe05a6a); };
    bench(M, 8.2, 1.5);
    ball(...M.at(5.2, 1.6)); ball(...M.at(11.2, 1.6));
    for (const [s, v, f] of [[13.4, 4.6, 0xd8324a], [15.6, 3.0, 0xe2b93a], [11.0, 7.2, 0xd8324a], [7.4, 8.8, 0xc93a52], [16.4, 6.6, 0xd8324a]]) pot(...M.at(s, v), 0.42, f);
    yield;
    // ---- Pirogov's corner: the bust on its granite plinth, the flower beds, the bike share dock
    {
      const [x, z] = [1324.8, 2873.2], y = h(x, z);
      p.box(2.6, 0.3, 2.6, 0xa9a6a2, x, y + 0.15, z, 0.4); p.box(1.9, 0.3, 1.9, 0xb3b0ac, x, y + 0.45, z, 0.4);
      p.box(1.15, 2.5, 1.15, 0x9a9792, x, y + 1.85, z, 0.4); p.box(1.3, 0.16, 1.3, 0xb3b0ac, x, y + 3.18, z, 0.4);
      p.add(new THREE.CylinderGeometry(0.42, 0.5, 0.55, 10), 0x4a4f4c, x, y + 3.52, z); blob(x, y + 4.05, z, 0.36, 0x4a4f4c);
    }
    const BED = frame([1332.6, 2852.6], [0.877, 0.48]);                     // the front edge of the lawn by the dock
    A.pave(BED, -0.5, 15.5, 0.2, 6.2, 'lawn');
    for (let s = 0.4, k = 0; s < 14.8; s += 0.75, k++) {                    // white and red flowers in rows along the lawn's edge
      A.box(BED, s, 1.1, 0.7, 0.55, 0.05, 0.3, k % 2 ? 0xf4f2ee : 0xe9e6f0); A.box(BED, s, 1.75, 0.7, 0.6, 0.05, 0.36, k % 3 ? 0xd8324a : 0xc22f47);
    }
    yield;
    for (let s = 1.2; s < 14.4; s += 1.1) {                                  // the dock: a row of grey stands on the paving
      const [x, z] = BED.at(s, -1.3), y = h(x, z);
      p.box(0.3, 0.62, 0.42, 0x8d9299, x, y + 0.31, z, BED.YAW); p.box(0.22, 0.16, 0.5, 0x5f646b, x, y + 0.66, z, BED.YAW);
    }
    { const [x, z] = BED.at(15.2, -1.3), y = h(x, z); p.box(0.5, 2.1, 0.22, 0x3c4046, x, y + 1.05, z, BED.YAW); p.box(0.42, 0.7, 0.24, 0xd6e0e4, x, y + 1.5, z, BED.YAW); }
    for (const [s, k] of [[2.3, 0x3a8f7c], [5.6, 0x2d2f33], [9.0, 0x3a8f7c]]) {  // three of the city's bikes in it
      const [x, z] = BED.at(s, -0.5), y = h(x, z), ux = BED.V[0], uz = BED.V[1];
      p.box(1.05, 0.07, 0.07, k, x, y + 0.62, z, BED.YAW + Math.PI / 2);
      for (const e of [-0.52, 0.52]) p.add(new THREE.TorusGeometry(0.31, 0.03, 5, 12).rotateY(Math.atan2(ux, uz) + Math.PI / 2), 0x1f2023, x + ux * e, y + 0.33, z + uz * e);
      p.box(0.06, 0.4, 0.06, k, x - ux * 0.25, y + 0.8, z - uz * 0.25); p.box(0.24, 0.05, 0.12, 0x1f2023, x - ux * 0.25, y + 1.0, z - uz * 0.25, BED.YAW);
    }
    yield;
    // ---- behind the town hall: benches, the big red planters, the steps of Lossi 3's door
    bench(HALL_BACK, -3.0, 3.0, Math.PI / 2 + 0.3); bench(HALL_BACK, 4.0, 1.0);
    for (const [x, z] of [[1357.0, 2850.5], [1351.2, 2842.6], [1361.5, 2845.6]]) {
      const y = h(x, z);
      p.add(new THREE.CylinderGeometry(0.5, 0.34, 0.8, 12), 0xd4413a, x, y + 0.4, z); blob(x, y + 0.98, z, 0.42, 0x4f8a4a); blob(x + 0.15, y + 1.22, z, 0.26, 0x5d9a55); blob(x - 0.2, y + 1.0, z + 0.16, 0.18, 0x7a5fb0);
    }
    yield;
    // ---- the town hall's back wall (the hall itself is raekoda.js): its nine bays of windows between
    // white pilasters, as on the front
    {
      const fr = (s) => [HALL[0][0] + (HALL[1][0] - HALL[0][0]) * s + 0.2, HALL[0][1] + (HALL[1][1] - HALL[0][1]) * s - 0.1];
      const Y0 = Math.min(h(...fr(0)), h(...fr(1)), h(...fr(0.5)));
      const L = 36.4, win = (s, y0, y1, w) => { A.box(HALL_BACK, s, 0.04, w + 0.28, 0.1, y0 - 0.14, y1 + 0.14, 0xfdfaf8, Y0); A.box(HALL_BACK, s, 0.09, w, 0.08, y0, y1, 0x5d5c7e, Y0); A.box(HALL_BACK, s, 0.13, 0.07, 0.04, y0, y1, 0xfdfaf8, Y0); A.box(HALL_BACK, s, 0.13, w, 0.04, y0 + (y1 - y0) * 0.68, y0 + (y1 - y0) * 0.68 + 0.07, 0xfdfaf8, Y0); };
      const bays = [3.1, 6.4, 9.6, 13.8, 18.2, 22.6, 26.8, 30.0, 33.3].map((s) => L - s);
      for (const s of bays) { win(s, 5.7, 7.9, 1.3); win(s, 10.0, 12.1, 1.3); win(s, 1.1, 3.4, 1.25); }
      for (let k = 0; k < bays.length - 1; k++) A.box(HALL_BACK, (bays[k] + bays[k + 1]) / 2, 0.06, 0.5, 0.14, 4.75, 14.15, 0xfdfaf8, Y0);
    }
    { const E = frame([1304.3, 2843.2], [-0.388, -0.922]); for (let k = 0; k < 3; k++) A.box(E, 5.2, 0.4 + k * 0.3, 2.6 + k * 0.5, 0.3, 0, 0.45 - k * 0.15, 0xa9a6a6); }
    yield;
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 330) return;
      if ([[1310, 2811], [1358, 2828], [1264, 2846], [1255, 2821], [1325, 2873]].every((q) => world.ready(q[0], q[1]))) { built = true; jobs.add(build, 'ulikooli'); }
    },
  };
}
