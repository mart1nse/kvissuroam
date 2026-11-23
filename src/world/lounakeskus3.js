// Round the Ringtee and Riia junction south of Lõunakeskus (Martin, 20 Nov: batch 3 of his pink outline round
// southern Tartu), from his Street View screenshots (Aug 2023) and the Land Board's oblique air photos (Apr 2024):
//  - Alexela (Lääneringtee 41): the dark top floor over the ochre ground floor, the IN Pesulad wash bays,
//    the white and blue band round the pump canopy and the blue price sign;
//  - Riia 179a: the grey four-storey block with its pale green stair glass;
//  - Decora (Riia 193): the black boxes along the road, the bronze patterned corner with the name,
//    the yellow boards, the entrance and the numbered loading bays to the car park, the red sign by the road;
//  - Stokker (Lääneringtee 45): grey ribbed hall, the blue band with the name along the front, the red sign;
//  - Spektri 6: the grey five-storey offices and the low wing;
//  - Aardla 113: the old brick boiler house and the grey hall beside it;
//  - Olerex (Aardla 107): the yellow band round the canopy, the yellow and black price sign.
// The map's own blocks keep their shapes and get painted walls. No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit } from './handbuilt.js';
import { BOX } from '../race/landmarks.js';

const DEBUG = typeof location !== 'undefined' && /lkdebug/.test(location.search);
const S9 = ['-1_9', -1440, 4960], S10 = ['-1_10', -1440, 5600], T10 = ['0_10', -800, 5600];
// [name, sector, base, at, reach, wall, roof]
const HOUSES = [
  ['alexela', S9, 4270, [-960, 5455], 14, 0x3b3431, 0x4e5054],
  ['r179', S9, 4406, [-955, 5543], 25, 0xb4b8bc, 0x4e5054],
  ['decora', S10, 4181, [-1135, 5864], 95, 0x232427, 0x4a4c50],
  ['stokker', T10, 4465, [-760, 5640], 50, 0xb9bcc0, 0x55585c],
  ['spektri', T10, 4427, [-762, 5735], 55, 0xaeb3ba, 0x4e5054],
  ['spektri', T10, 4464, [-781, 5778], 20, 0xaeb3ba, 0x4e5054],
  ['aardla', T10, 4214, [-720, 5856], 30, 0x97493a, 0x4e5054],
  ['hall', T10, 4273, [-696, 5829], 25, 0xc4c7ca, 0x9da1a6],
];

export function lounakeskus3Walls(walls) {
  for (const S of [S9, S10, T10]) {
    setHouseColours(walls, S[0], S[1], S[2], HOUSES.filter((H) => H[1] === S).map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
  }
}

const dot = (W, d) => W.nx * d[0] + W.nz * d[1];
const SANS = '700 %px Arial, sans-serif', BOLD = '900 %px Arial, sans-serif';
const ESE = [0.87, 0.49], NNE = [0.49, -0.87], WNW = [-0.87, -0.49], SSW = [-0.49, 0.87];
function ribs(P, x0, x1, y0, y1, base, rib, step = 0.5) {
  P.r(x0, y0, x1, y1, base);
  for (let x = x0 + step / 2; x < x1; x += step) P.r(x, y0, x + 0.06, y1, rib);
}
function glass(P, x0, x1, y0, y1, tint = '#4c5d6e', frameCol = '#1c1d20') {
  P.r(x0, y0, x1, y1, frameCol);
  P.grad(x0 + 0.08, y0 + 0.08, x1 - 0.08, y1 - 0.08, tint, '#2e3946');
  for (let x = x0 + 1.5; x < x1 - 0.3; x += 1.5) P.r(x - 0.04, y0, x + 0.04, y1, frameCol);
}
// rows of windows, one row a floor
function rows(P, x0, x1, y0, top, { fh = 3.4, w = 1.6, gap = 1.2, h = 1.6, sill = 0.9, glassCol = '#4e5f72', frameCol = '#2b2c30' } = {}) {
  for (let y = y0 + sill; y + h < top - 0.6; y += fh) {
    for (let x = x0 + gap; x + w < x1 - gap / 2; x += w + gap) { P.r(x - 0.06, y - 0.06, x + w + 0.06, y + h + 0.06, frameCol); P.grad(x, y, x + w, y + h, glassCol, '#2e3946'); }
  }
}
// a small repeatable hash for patterns
const rnd = (k) => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function alexela(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#3b3431');
  for (let x = 0.6; x < len; x += 1.2) P.r(x, 4.6, x + 0.04, top, '#332d2a');
  P.r(0, 0, len, 4.4, '#c99a45');
  for (let x = 1.2; x < len; x += 1.2) P.r(x, 0, x + 0.05, 4.4, '#b58836');
  P.r(0, 4.4, len, 4.6, '#2b2c30');
  for (let x = 1.4; x + 2.2 < len - 1; x += 3.4) P.r(x, 6.0, x + 2.2, 8.2, '#55636f');
  if (dot(W, ESE) > 0.9) {                                       // the shop front to the pumps
    glass(P, 2, len - 2, 0, 3.6, '#5b7088', '#2b2c30');
    P.r(len / 2 - 4.2, top - 2.2, len / 2 + 4.2, top - 0.6, '#ffffff');
    P.text('alexela', len / 2, top - 1.4, 1.2, '#005eb8', BOLD);
  } else if (dot(W, SSW) > 0.9) {                                // the wash bays
    for (let x = 1.5; x + 3.6 < len; x += 4.6) { P.r(x, 0, x + 3.6, 3.6, '#9a9ea3'); for (let y = 0.3; y < 3.6; y += 0.3) P.r(x, y, x + 3.6, y + 0.04, '#80848a'); }
    P.r(1.5, 3.8, 8, 4.35, '#e3262e'); P.text('IN Pesulad', 4.75, 4.07, 0.42, '#ffffff', SANS);
  } else P.r(len / 2 - 0.6, 0, len / 2 + 0.6, 2.2, '#4a3a2a');
}

function r179(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#b4b8bc');
  for (let y = 3.3; y < top; y += 3.3) P.r(0, y, len, y + 0.05, '#a3a7ab');
  for (let x = 2.4; x < len; x += 2.4) P.r(x, 0, x + 0.04, top, '#a7abaf');
  if (len > 9) rows(P, 0, len, 0, top, { fh: 3.3, w: 1.5, gap: 1.6, h: 1.5, sill: 1.0 });
  else { P.r(0.6, 0, len - 0.6, top - 0.6, '#9cc7bd'); for (let y = 1.1; y < top; y += 1.1) P.r(0.6, y, len - 0.6, y + 0.05, '#7fa79e'); }
  P.r(0, top - 0.4, len, top, '#8d9196');
}

function bronze(P, x0, x1, y0, y1) {
  P.r(x0, y0, x1, y1, '#2f241a');
  let k = 0;
  for (let y = y0 + 0.2; y < y1; y += 0.32) {
    for (let x = x0; x < x1; x += 0.55) {
      k++; const l = 0.25 + rnd(k) * 0.7;
      P.line(x, y, x + l * 0.6, y + l, rnd(k + 9) > 0.5 ? '#b58a4c' : '#8a6738', 0.09);
    }
  }
}
function decoraName(P, x, y, s) {
  P.poly([[x - s * 2.7, y], [x - s * 2.35, y + s * 0.35], [x - s * 2.0, y], [x - s * 2.35, y - s * 0.35]], '#ffffff');
  P.text('DECORA', x + s * 0.4, y, s * 0.8, '#ffffff', BOLD);
}
function yellowBoard(P, x, y, w, h, lines) {
  P.r(x - w / 2, y, x + w / 2, y + h, '#ffd200');
  lines.forEach((t, i) => P.text(t, x, y + h * (0.68 - i * 0.34), h * 0.2, '#1d1e21', BOLD));
}
function decora(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#232427');
  for (let x = 1.2; x < len; x += 1.2) P.r(x, 0, x + 0.04, top, '#2b2c2f');
  P.r(0, top - 0.3, len, top, '#3a3b3e');
  const [mx, mz] = W.mid;
  const corner = mz > 5805 && mz < 5852 && mx > -1126;
  if (corner && (dot(W, ESE) > 0.9 || dot(W, NNE) > 0.9) && len > 12) {           // the bronze corner by the roundabout
    bronze(P, 0, len, 0, top - 0.3);
    decoraName(P, dot(W, ESE) > 0.9 ? len - 7 : 7, top - 1.8, 1.6);
    glass(P, len / 2 - 3, len / 2 + 3, 0, 3.2, '#4e5f72', '#1d1e21');
    return;
  }
  if (dot(W, ESE) > 0.9 && len > 60) {                                            // the long side to the road (x = 0 at the south end)
    rows(P, 3, 28, 0, top, { fh: 3.6, w: 0.7, gap: 1.5, h: 2.2, sill: 1.2 });
    yellowBoard(P, 37, top - 6.5, 7, 4.2, ['DECORA', 'ehitus & sisustus']);
    yellowBoard(P, 51, top - 6.5, 7, 4.2, ['AIAKAUP', 'kõik aeda']);
    yellowBoard(P, 65, top - 6.5, 7, 4.2, ['PLAAT', 'parkett & uksed']);
    rows(P, 74, len - 2, 0, top, { fh: 3.6, w: 0.7, gap: 1.8, h: 2.2, sill: 1.2 });
  } else if (dot(W, SSW) > 0.9 && len > 25) {
    yellowBoard(P, len - 9, top - 5.5, 8, 3.6, ['DECORA', 'Riia 193']);
  } else if (dot(W, WNW) > 0.9) {                                                 // the car park side
    if (mz < 5845 && len > 15 && len < 30) {                                      // the shop entrance
      glass(P, len / 2 - 5, len / 2 + 5, 0, 4.2, '#56697c', '#1d1e21');
      decoraName(P, len / 2, top - 2.2, 1.5);
    } else if (len > 30 && len < 60) {                                            // loading bays 1, 2
      [[0.3, '1'], [0.7, '2']].forEach(([f, t]) => {
        const x = len * f; P.r(x - 2, 0, x + 2, 4.4, '#55585e');
        for (let y = 0.35; y < 4.4; y += 0.35) P.r(x - 2, y, x + 2, y + 0.04, '#46494e');
        P.text(t, x, 6.2, 2.0, '#ffd200', BOLD);
      });
      rows(P, 2, len - 2, 7.0, top, { fh: 3.6, w: 0.7, gap: 2.2, h: 2.0, sill: 0.3 });
    } else if (len > 15) rows(P, 2, len - 2, 0, top, { fh: 3.6, w: 0.7, gap: 2.0, h: 2.2, sill: 1.2 });
  } else if (len > 20) rows(P, 2, len - 2, 0, top, { fh: 3.6, w: 0.7, gap: 2.4, h: 2.2, sill: 1.2 });
}

function stokkerName(P, x, y, s, col = '#ffffff') {
  P.arc(x - s * 2.6, y, s * 0.5, col); P.arc(x - s * 2.6, y, s * 0.34, '#0d6fb8');
  P.r(x - s * 2.95, y - s * 0.07, x - s * 2.25, y + s * 0.07, col);
  P.text('STOKKER', x + s * 0.3, y, s * 0.75, col, BOLD);
}
function stokker(P, W) {
  const len = W.len, top = W.peak;
  ribs(P, 0, len, P.y0, P.y1, '#b9bcc0', '#a9acb0', 0.5);
  P.r(0, top - 0.4, len, top, '#7d8186');
  if (dot(W, [0.73, -0.69]) > 0.9 && len > 60) {                  // the front to the ring road (x = 0 at the south end)
    P.r(12, 4.4, len, top - 0.4, '#0d6fb8');
    for (let x = 12.25; x < len; x += 0.5) P.r(x, 4.4, x + 0.05, top - 0.4, '#0b63a4');
    stokkerName(P, 44, top - 2.6, 2.2);
    stokkerName(P, len - 10, top - 2.6, 1.4);
    glass(P, 38, 50, 0, 4.2, '#56697c', '#2b2c30');
    glass(P, 14, 34, 1.0, 3.6, '#56697c', '#2b2c30');
    for (let x = 2; x < 10; x += 4.4) { P.r(x, 0, x + 3.6, 4.0, '#9a9ea3'); }
  } else if (dot(W, [-0.54, -0.84]) > 0.9 && len > 30) {          // the north end (x = 0 at the east end)
    P.r(1, top - 4.2, 15, top - 0.8, '#0d6fb8'); stokkerName(P, 9, top - 2.5, 1.1);
    glass(P, 4, 12, 0, 3.2, '#56697c', '#2b2c30');
    P.r(26, 0, 30, 4.2, '#9a9ea3');
  } else if (len > 25) for (let x = 6; x < len - 4; x += 14) P.r(x, 0, x + 4, 4.2, '#9a9ea3');
}

function spektri(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#aeb3ba');
  for (let x = 1.5; x < len; x += 1.5) P.r(x, 0, x + 0.04, top, '#a3a8af');
  if (top > 15) {
    for (let y = 3.6; y < top - 1; y += 3.6) P.r(0, y - 0.15, len, y + 0.15, '#9ca1a8');
    rows(P, 0, len, 0, top, { fh: 3.6, w: 1.4, gap: 0.6, h: 1.7, sill: 1.0, glassCol: '#4a5866' });
    P.r(0, top - 1.2, len, top - 0.5, '#8c4a32');
  } else if (len > 8) rows(P, 0, len, 0, top, { fh: 3.4, w: 1.6, gap: 1.4, h: 1.6, sill: 1.0 });
  if (len > 30 && dot(W, [-0.46, 0.89]) < 0.9) glass(P, len / 2 - 2, len / 2 + 2, 0, 3.0, '#56697c', '#2b2c30');
}

function aardla(P, W) {
  const len = W.len, top = W.peak;
  P.brick(0, P.y0, len, P.y1, [151, 73, 58], 7);
  if (len < 4) return;
  if (top > 20) { P.r(0, top - 0.6, len, top, '#7d3a2c'); return; }   // the chimney
  if (top > 12 && len > 8) { P.r(0, 9.6, len, top, '#8fa3b5'); for (let x = 0.5; x < len; x += 0.5) P.r(x, 9.6, x + 0.05, top, '#7e93a6'); }
  const hi = Math.min(top, 9.4);
  for (let x = 1.6; x + 1.6 < len - 0.6; x += 3.2) for (let y = 1.0; y + 2.0 < hi - 0.5; y += 3.6) {
    P.r(x - 0.1, y - 0.1, x + 1.7, y + 2.1, '#d8cfc2'); P.grad(x, y, x + 1.6, y + 2.0, '#4f5d6a', '#2e3946');
    P.arc(x + 0.8, y + 2.0, 0.8, '#4f5d6a', Math.PI, Math.PI * 2);
  }
  P.weather(0, 0, len, top, 0.25, 4);
}

function hall(P, W) {
  const len = W.len, top = W.peak;
  ribs(P, 0, len, P.y0, P.y1, '#c4c7ca', '#b4b7ba', 0.4);
  if (len > 25) for (let x = 5; x < len - 4; x += 9) P.r(x, 0, x + 4.2, 4.6, '#8a8e93');
  P.weather(0, 0, len, top, 0.15, 3);
}

const PAINT = { alexela, r179, decora, stokker, spektri, aardla, hall };

// a canopy's fascia: a band round the four corners of the map's own roof plate, its top at `top` (absolute)
function fascia(group, corners, top, hgt, tex, shadows) {
  const m = new THREE.MeshLambertMaterial({ map: tex });
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(len + 0.3, hgt, 0.3), m);
    mesh.position.set((a[0] + b[0]) / 2, top - hgt / 2 + 0.15, (a[1] + b[1]) / 2);
    mesh.rotation.y = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    mesh.castShadow = shadows;
    group.add(mesh);
  }
}

export function createLounakeskus3(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;
  const CENTRE = [-880, 5680];

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    const houses = HOUSES.map(([name, S, base, at0, r]) => ({ name, sec: S[0], base, at: at0, r, spec: { wall: [200, 200, 200], floors: [], attic: null, eaves: false } }));
    for (const H of houses) { const paint = PAINT[H.name]; H.walls = [{ near: [0, 0], within: 1e9, only: (P, W) => paint(P, W) }]; }
    skinHouses(world, group, houses, { label: 'lounakeskus3 fronts', shadows, ppm: 8, far: 5, faces: (W) => W.foot < 2 && W.len > 6 && W.peak > 3, debug: DEBUG });

    const dark = new THREE.MeshLambertMaterial({ color: 0x2b2c30 });
    const tall = (x, z, w, hh, d, tex, yaw, side = dark) => {
      const t = new THREE.MeshLambertMaterial({ map: tex });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), [side, side, side, side, t, t]);
      m.position.set(x, h(x, z) + hh / 2, z); m.rotation.y = yaw; m.castShadow = shadows; group.add(m);
    };
    // Alexela: the band round the pump canopy, the pumps, the blue price sign (on the verge between the forecourt and the road)
    const ax = paintTexture(18, 0, 1.0, 24, (P) => { P.r(0, 0, 18, 1.0, '#ffffff'); P.r(0, 0, 18, 0.22, '#005eb8'); P.text('alexela', 9, 0.6, 0.62, '#005eb8', BOLD); });
    fascia(group, [[-940.3, 5465.4], [-923.9, 5459.2], [-920.9, 5467.1], [-937.3, 5473.3]], 49.1, 1.0, ax, shadows);
    for (const [x, z] of [[-935.0, 5466.8], [-929.6, 5464.8], [-924.2, 5462.8]]) {
      p.box(0.9, 0.25, 4.0, 0xb9bbbd, x, h(x, z) + 0.12, z + 2.0, -0.36);
      p.box(0.6, 1.9, 0.9, 0xeeeeec, x, h(x, z) + 1.2, z + 2.0, -0.36);
      p.box(0.62, 0.35, 0.92, 0x005eb8, x, h(x, z) + 2.0, z + 2.0, -0.36);
    }
    tall(-919, 5462, 1.8, 8.5, 0.5, paintTexture(1.8, 0, 8.5, 24, (P) => {
      P.r(0, 0, 1.8, 8.5, '#005eb8'); P.r(0, 0, 1.8, 1.6, '#2b2c30'); P.r(0.1, 6.6, 1.7, 8.2, '#ffffff'); P.text('alexela', 0.9, 7.4, 0.36, '#005eb8', BOLD);
      [['95', '1.652'], ['98', '1.711'], ['D', '1.960']].forEach(([a, b], k) => { P.r(0.1, 5.1 - k * 1.1, 1.7, 5.9 - k * 1.1, '#1d1e21'); P.text(a + ' ' + b, 0.9, 5.5 - k * 1.1, 0.42, '#ffffff', SANS); });
    }), 1.1, new THREE.MeshLambertMaterial({ color: 0x005eb8 }));
    // Olerex: the yellow band round the canopy, the pumps, the yellow and black sign
    const ol = paintTexture(20, 0, 1.0, 24, (P) => { P.r(0, 0, 20, 1.0, '#ffd100'); P.r(0, 0, 20, 0.14, '#1d1e21'); P.text('OLEREX', 10, 0.58, 0.62, '#1d1e21', BOLD); });
    fascia(group, [[-586.3, 5833.2], [-567.1, 5832.4], [-566.8, 5842.0], [-585.9, 5842.8]], 47.1, 1.0, ol, shadows);
    for (const x of [-582, -576.5, -571]) {
      const z = 5837.6;
      p.box(0.9, 0.25, 4.0, 0xb9bbbd, x, h(x, z) + 0.12, z, 0.04);
      p.box(0.6, 1.9, 0.9, 0x2b2c30, x, h(x, z) + 1.2, z, 0.04);
      p.box(0.62, 0.35, 0.92, 0xffd100, x, h(x, z) + 2.0, z, 0.04);
    }
    tall(-559, 5846, 1.7, 8, 0.5, paintTexture(1.7, 0, 8, 24, (P) => {
      P.r(0, 0, 1.7, 8, '#ffd100'); P.r(0, 0, 1.7, 1.4, '#1d1e21'); P.text('OLEREX', 0.85, 7.1, 0.36, '#1d1e21', BOLD);
      [['95', '1.680'], ['98', '1.738'], ['D', '1.954']].forEach(([a, b], k) => { P.r(0.1, 5.0 - k * 1.1, 1.6, 5.8 - k * 1.1, '#1d1e21'); P.text(a + ' ' + b, 0.85, 5.4 - k * 1.1, 0.4, '#ffd100', SANS); });
    }), Math.PI / 2, new THREE.MeshLambertMaterial({ color: 0xffd100 }));
    // Stokker's red sign at the north end, Decora's on the grass inside the cycle path
    tall(-796, 5606, 1.8, 8, 0.6, paintTexture(1.8, 0, 8, 24, (P) => { P.r(0, 0, 1.8, 8, '#d2232a'); P.r(0.1, 5.6, 1.7, 7.8, '#ffffff'); P.text('STOKKER', 0.9, 6.7, 0.34, '#0d6fb8', BOLD); }), 0.57, new THREE.MeshLambertMaterial({ color: 0xd2232a }));
    tall(-1069, 5793, 2.4, 9, 0.6, paintTexture(2.4, 0, 9, 22, (P) => {
      P.r(0, 0, 2.4, 9, '#d8562c'); P.r(0, 0, 2.4, 1.0, '#2b2c30');
      P.r(0.15, 6.2, 2.25, 8.6, '#232427'); P.text('DECORA', 1.2, 7.4, 0.44, '#ffffff', BOLD);
      P.text('ehitus', 1.2, 5.2, 0.36, '#ffffff', SANS); P.text('sisustus', 1.2, 4.5, 0.36, '#ffffff', SANS); P.text('aed', 1.2, 3.8, 0.36, '#ffffff', SANS);
    }), 0.5, new THREE.MeshLambertMaterial({ color: 0xd8562c }));
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 420) return;
      if ([[-960, 5455], [-1135, 5864], [-760, 5640]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
