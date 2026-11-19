// The beginning of Vallikraavi on the lap, from the Küüni corner up to the mural house (Martin, 18 Nov, from
// his Google street views of 2011-2024 and an oblique aerial photo), in pastel colours:
//   the green glass corner building with the Clubhotel entrance on Küüni, its planter and terrace
//   the dark brick tower house with its clock, slate mansard and the ISAMAA entrance; Vallikraavi 2 behind
//   Proekspert: white tiles, ribbon windows, the name over the glazed ground floor
//   Vabank: the dark glass grid, the concrete tower with the name down it, the white annex
//   Vallikraavi 4: red brick with white window surrounds, a balcony, the hanging sign
//   the rubble stone wall under Toomemägi, the green wooden house on its stone and brick base, the brick
//   house no. 3, the dark wooden house, the long brick house and the painted gable (the theatre mural)
//   parking bays on both sides of the first stretch, the
//   paved car park with its row of waste containers, the old lantern posts
// Every house front is a painted picture standing a hand's breadth in front of the map's own wall; the
// parked cars are rows in PARKING (landmarks.js). No street names on the ground.
import * as THREE from 'three';
import { createTrack } from './race.js';
import { BOX, rnd, PARKING } from './landmarks.js';
import { streetKit, wallOf, addHouseColours } from '../world/streetkit.js';
import { drapeGeometry } from '../world/drape.js';

// wall lines from the LOD2 model (game x, z), the street on the right-hand side going a -> b;
// y: ground at the wall, top: the wall's top (world y)
const WALLS = {
  G1: { a: [1570.65, 3027.05], b: [1547.1, 3000.6], y: 4.4, top: 21.7 },      // glass building, Küüni
  G2: { a: [1547.1, 3000.6], b: [1544.5, 3002.85], y: 4.4, top: 21.7 },       // the notch with the hotel door
  G3: { a: [1544.5, 3002.85], b: [1537.95, 2992.6], y: 4.4, top: 21.7 },      // the glass corner
  G4: { a: [1537.95, 2992.6], b: [1517.75, 3010.6], y: 4.4, top: 18.9 },      // glass, Vallikraavi
  G5: { a: [1517.75, 3010.6], b: [1523.85, 3021.15], y: 5.5, top: 19.1 },
  T0: { a: [1511.95, 3014.9], b: [1507.1, 3014.45], y: 5.5, top: 23.5 },      // the tower
  T1: { a: [1507.1, 3014.45], b: [1506.65, 3019.25], y: 5.6, top: 24.2 },
  T2: { a: [1506.65, 3019.25], b: [1497.85, 3027.9], y: 5.7, top: 24.2 },     // brick front, ISAMAA
  T3: { a: [1497.85, 3027.9], b: [1493.8, 3031.9], y: 6.9, top: 24.3 },
  T4: { a: [1493.8, 3031.9], b: [1493.3, 3037.2], y: 8.2, top: 24.6 },
  T5: { a: [1493.3, 3037.2], b: [1505.85, 3049.2], y: 8.15, top: 23.8 },      // Vallikraavi 2, the ticket office
  TE: { a: [1519.25, 3026.8], b: [1511.95, 3014.9], y: 5.55, top: 24.0 },
  P1: { a: [1504.95, 3073.1], b: [1479.0, 3044.8], y: 8.2, top: 29.1 },       // Proekspert, Ülikooli
  P2: { a: [1479.0, 3044.8], b: [1468.0, 3054.85], y: 8.5, top: 28.9 },
  P3: { a: [1468.0, 3054.85], b: [1482.25, 3070.4], y: 9.8, top: 28.8 },
  V1: { a: [1464.6, 3027.05], b: [1452.3, 3005.4], y: 7.95, top: 24.0 },      // Vabank glass grid
  V2: { a: [1458.4, 3043.5], b: [1464.6, 3027.05], y: 8.0, top: 20.7 },       // the name tower
  V3: { a: [1444.55, 3036.55], b: [1458.4, 3043.5], y: 9.0, top: 20.4 },      // the white annex
  B1: { a: [1475.45, 3066.45], b: [1459.85, 3057.5], y: 9.6, top: 22.2 },     // Vallikraavi 4, the statue front
  B2: { a: [1459.85, 3057.5], b: [1443.85, 3085.5], y: 9.7, top: 22.4 },      // and along the street
  H1: { a: [1434.0, 3088.85], b: [1433.75, 3076.75], y: 12.1, top: 20.8 },    // green wooden house
  H2: { a: [1427.45, 3090.45], b: [1434.0, 3088.85], y: 12.2, top: 21.4 },
  H3: { a: [1411.3, 3090.75], b: [1427.45, 3090.45], y: 12.4, top: 21.8 },
  L1: { a: [1371.45, 3083.75], b: [1405.1, 3089.4], y: 12.95, top: 22.1 },    // dark wooden house, long brick house
  M1: { a: [1390.1, 3108.35], b: [1391.55, 3094.8], y: 13.2, top: 21.3 },     // the painted gable
};
const CENTRE = [1470, 3040];
// the bays square to the road on the park side: lines only, kept free of cars (they are on the racing line);
// they reach 2.5 m towards the road from the row line and stop 0.1 m past it, where the grass begins
// (the map's paving ends 0.35..1.25 m past it; Martin, 19 Nov: they ran out onto the grass)
const PARK_BAYS = { a: [1501.4, 2999.9], b: [1484.5, 3015.4], n: 9, perp: true, back: 0.1 };
const COL = {
  concrete: 0xc9c7d0, iron: 0x24232a, white: 0xf6f3fa, blue: 0x7fa0e6, brick: 0xc0725e, stone: 0xa3978c,
  bin: 0x3a3c46, binLid: 0x2c2d36, binGreen: 0x4f8a58, binBrown: 0x8a6248, parasol: 0xf1ecdc,
  shrub: [0x5a9a5e, 0x6fae66, 0x4a8a56], bloom: [0xd870a8, 0xe08abc], slate: 0x55566a,
};

export function valliStreetWalls(walls) {
  if (!walls || !walls.sectors) return;
  const set = (key, z0, base, hex) => {
    const list = walls.sectors[key];
    if (!list) return;
    for (let k = 0; k < list.length; k += 4) {
      const x = 1120 + list[k + 1] * 0.1, z = z0 + list[k + 2] * 0.1;
      if (list[k] === base && x > 1370 && x < 1510 && z > 2990 && z < 3110) list[k + 3] = hex;
    }
  };
  set('3_5', 2400, 805, 0x4a4c5e);
  set('3_6', 3040, 826, 0xe9e8ee); set('3_6', 3040, 949, 0xb86a55); set('3_6', 3040, 1194, 0xa9bd8f);
  set('3_6', 3040, 1308, 0xb8705c); set('3_6', 3040, 1319, 0xe8d9b8);
  for (const [key, z0] of [['3_5', 2400], ['3_6', 3040]]) {
    addHouseColours(walls, key, 1120, z0, [
      { base: 268, x: 1545, z: 3012, wall: 0x5f9f98, roof: 0x5a5c68, reach: 40 },
      { base: 549, x: 1503, z: 3032, wall: 0x8f5d4f, roof: 0x55566a, reach: 30 },
    ]);
  }
}

// Street furniture round the car park at Vallikraavi 4, as props (props.js kinds), so a car that runs wide
// knocks them flat with hardly a bump. Per Martin's marked photo (19 Nov): at the road edge only the
// Europark sign at the entrance, the no-stopping sign where the kerbside bays begin and one lantern post
// by the mural wall; the other old lantern posts and a parking sign stand at the back of the car park
// where the grass starts. The map's own signs and lamps along this kerb go (valliStreetClear).
const PARK_PROPS = [
  // [kind, track index, metres out from the road edge (left)]
  [11, 106.5, 0.6],   // Europark no-parking sign at the car park entrance
  [11, 116.6, 0.5],   // no stopping, where the kerbside bays begin
  [9, 123.8, 0.55],   // the one lantern post left on the road side, 10 m before the mural (Martin, 19 Nov)
  [9, 114.5, 10.2],   // lantern posts on the grass line at the back of the car park
  [9, 124.5, 9.1],
  [21, 119.5, 8.7],   // blue parking sign on the grass line
];
const PARK_CLEAR = [
  [11, 1411.1, 3098.1], [0, 1411.4, 3098.1],   // sign + lamp at the kerb, i 120
  [18, 1434.1, 3085.2], [14, 1443.3, 3088.6],  // info and warning signs at the entrance
  [11, 1429.2, 3103.4], [11, 1396.5, 3085.2],
  [0, 1413.2, 3087.4], [0, 1388.3, 3096.0],    // kerb lamps, i 119 and i 130
];
export function valliStreetProps() {
  const track = createTrack();
  return PARK_PROPS.map(([kind, i, out]) => {
    const k = Math.floor(i), f = i - k, a = track.P[k], b = track.P[k + 1], [tx, tz] = track.tan[k], lat = -(track.HW[Math.round(i)] + out);
    const deg = kind === 9 ? 0 : Math.atan2(-tx, tz) * 180 / Math.PI;   // signs face the oncoming cars
    return [kind, a[0] + (b[0] - a[0]) * f - tz * lat, a[1] + (b[1] - a[1]) * f + tx * lat, deg];
  });
}
export function valliStreetClear(data, out) {
  for (const [key, a] of Object.entries(data.sectors)) {
    for (let k = 0; k < a.length; k += data.stride) {
      if (PARK_CLEAR.some(([kind, x, z]) => a[k] === kind && Math.hypot(a[k + 1] - x, a[k + 2] - z) < 0.6)) out.add(`${key}:${k / data.stride}`);
    }
  }
}

// ---------------------------------------------------------------- painting house fronts
// A picture of a wall, drawn in metres: x along the wall, y up from the house's ground line.
export function facade(wm, y0, y1, ppm, draw) {
  const hm = y1 - y0;
  ppm = Math.min(ppm, 2048 / wm, 2048 / hm);
  const cv = document.createElement('canvas');
  cv.width = Math.max(4, Math.round(wm * ppm)); cv.height = Math.max(4, Math.round(hm * ppm));
  const c = cv.getContext('2d');
  const X = (x) => x * ppm, Y = (y) => (y1 - y) * ppm;
  const P = {
    w: wm, y0, y1, c,
    r(x0, ya, x1, yb, col) { c.fillStyle = col; c.fillRect(X(x0), Y(yb), (x1 - x0) * ppm, (yb - ya) * ppm); },
    grad(x0, ya, x1, yb, top, bottom) {
      const g = c.createLinearGradient(0, Y(yb), 0, Y(ya));
      g.addColorStop(0, top); g.addColorStop(1, bottom);
      c.fillStyle = g; c.fillRect(X(x0), Y(yb), (x1 - x0) * ppm, (yb - ya) * ppm);
    },
    text(str, x, y, size, col, font = '700 %px Arial, sans-serif', align = 'center', angle = 0) {
      c.save(); c.translate(X(x), Y(y)); c.rotate(angle);
      c.font = font.replace('%', Math.round(size * ppm)); c.fillStyle = col; c.textAlign = align; c.textBaseline = 'middle';
      c.fillText(str, 0, 0); c.restore();
    },
    arc(x, y, r, col, a0 = 0, a1 = Math.PI * 2) { c.fillStyle = col; c.beginPath(); c.moveTo(X(x), Y(y)); c.arc(X(x), Y(y), r * ppm, a0, a1); c.fill(); },
    // a window: surround, frame, glass with mullions; now and then one with the light on
    win(x0, ya, x1, yb, { frame = '#f4f1ea', glass = '#5d6f8c', fw = 0.08, bars = 1, rails = 0, surround = 0, sc = '#f4f1ea', lit = 0, hood = 0, sill = 0.1 } = {}) {
      if (surround) P.r(x0 - surround, ya - surround * 0.6, x1 + surround, yb + surround, sc);
      if (hood) P.r(x0 - surround - 0.1, yb + surround, x1 + surround + 0.1, yb + surround + hood, sc);
      if (sill) P.r(x0 - surround - 0.08, ya - surround * 0.6 - sill, x1 + surround + 0.08, ya - surround * 0.6, sc);
      P.r(x0, ya, x1, yb, frame);
      if (lit) P.grad(x0 + fw, ya + fw, x1 - fw, yb - fw, '#fff0c4', '#f6d79a'); else P.grad(x0 + fw, ya + fw, x1 - fw, yb - fw, glass, shade(glass, 0.78));
      for (let k = 1; k <= bars; k++) { const x = x0 + (x1 - x0) * k / (bars + 1); P.r(x - fw / 2, ya, x + fw / 2, yb, frame); }
      for (let k = 1; k <= rails; k++) { const y = ya + (yb - ya) * k / (rails + 1); P.r(x0, y - fw / 2, x1, y + fw / 2, frame); }
    },
    // brickwork: courses of 9 cm, each brick its own shade
    brick(x0, ya, x1, yb, rgb, seed = 1) {
      const r = rnd(seed);
      P.r(x0, ya, x1, yb, tone(rgb, 0.8));
      for (let y = ya, row = 0; y < yb; y += 0.09, row++) {
        for (let x = x0 - (row % 2) * 0.13; x < x1; x += 0.26) {
          c.fillStyle = tone(rgb, 0.9 + r() * 0.2);
          const xa = Math.max(x0, x + 0.012), xb = Math.min(x1, x + 0.25);
          if (xb > xa) c.fillRect(X(xa), Y(Math.min(yb, y + 0.078)), (xb - xa) * ppm, Math.max(1, 0.066 * ppm));
        }
      }
    },
    // field stones in mortar
    rubble(x0, ya, x1, yb, seed = 1) {
      const r = rnd(seed);
      P.r(x0, ya, x1, yb, '#6f675f');
      const tones = [[176, 160, 140], [150, 138, 128], [190, 172, 150], [160, 140, 124], [140, 134, 136], [186, 150, 132]];
      for (let y = ya + 0.16; y < yb + 0.1; y += 0.3) {
        for (let x = x0 + r() * 0.2; x < x1; ) {
          const w = 0.24 + r() * 0.34, h = 0.2 + r() * 0.14, t = tones[Math.floor(r() * tones.length)];
          c.fillStyle = tone(t, 0.9 + r() * 0.2);
          c.beginPath(); c.ellipse(X(x + w / 2), Y(y + (r() - 0.5) * 0.06), w / 2 * ppm, h / 2 * ppm, (r() - 0.5) * 0.5, 0, 7); c.fill();
          x += w + 0.03;
        }
      }
    },
    // horizontal boards
    boards(x0, ya, x1, yb, rgb, pitch = 0.16) {
      P.r(x0, ya, x1, yb, tone(rgb, 1));
      for (let y = ya; y < yb; y += pitch) P.r(x0, y, x1, y + 0.025, tone(rgb, 0.8));
    },
    // a curtain wall: panes cw x ch, sky at the top, the trees across the street in the lower panes
    glass(x0, ya, x1, yb, { cw = 1.35, ch = 1.9, top = [150, 200, 196], bottom = [78, 138, 130], mull = '#2f4b4c', seed = 3, trees = 0.45 } = {}) {
      const r = rnd(seed);
      P.r(x0, ya, x1, yb, mull);
      const nx = Math.max(1, Math.round((x1 - x0) / cw)), ny = Math.max(1, Math.round((yb - ya) / ch));
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const t = (j + 0.5) / ny, k = 0.94 + r() * 0.12;
        const cA = top.map((v, q) => (bottom[q] + (v - bottom[q]) * t) * k);
        const xa = x0 + (x1 - x0) * i / nx + 0.035, xb = x0 + (x1 - x0) * (i + 1) / nx - 0.035;
        const yA = ya + (yb - ya) * j / ny + 0.035, yB = ya + (yb - ya) * (j + 1) / ny - 0.035;
        P.grad(xa, yA, xb, yB, tone(cA, 1.06), tone(cA, 0.92));
        if (t < trees) {                                   // the dark trees across the street, mirrored low down
          c.fillStyle = `rgba(36,80,66,${(0.1 + r() * 0.28) * (1 - t / trees * 0.7)})`; c.fillRect(X(xa), Y(yB), (xb - xa) * ppm, (yB - yA) * ppm);
        } else if (t > 0.72 && r() < 0.5) {               // evening sky in the top panes
          c.fillStyle = `rgba(236,170,214,${0.12 + r() * 0.18})`; c.fillRect(X(xa), Y(yB), (xb - xa) * ppm, (yB - yA) * ppm);
        }
      }
    },
  };
  draw(P);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
export const tone = (rgb, k) => `rgb(${Math.min(255, rgb[0] * k) | 0},${Math.min(255, rgb[1] * k) | 0},${Math.min(255, rgb[2] * k) | 0})`;
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  return tone([(n >> 16) & 255, (n >> 8) & 255, n & 255], k);
}

export function createValliStreet(world, group, { shadows = true } = {}) {
  const track = createTrack();
  let built = false;

  function build() {
    built = true;
    const K = streetKit(world, group, { shadows });
    const { p } = K;
    const h = (x, z) => world.heightAt(x, z);
    const solids = [], extra = [], glow = [];
    const W = {};
    for (const [k, v] of Object.entries(WALLS)) { W[k] = wallOf(v.a, v.b, v.top); W[k].y = v.y; }
    const lit = rnd(41);
    const on = (chance = 0.22) => lit() < chance;

    // a painted front on wall w from s0 to s1 (default: all of it), from 1 m under the ground line to the top
    const skin = (w, draw, { s0 = 0, s1 = w.len, y0 = -1.2, y1 = w.top - w.y, ppm = 26, off = 0.1 } = {}) => {
      const tex = facade(s1 - s0, y0, y1, ppm, draw);
      const [x, z] = w.at((s0 + s1) / 2, off);
      const g = new THREE.PlaneGeometry(s1 - s0 + 0.06, y1 - y0).rotateY(Math.atan2(w.nx, w.nz)).translate(x, w.y + (y0 + y1) / 2, z);
      extra.push([g, new THREE.MeshLambertMaterial({ map: tex })]);
    };
    const put = (w, geo, hex, s, y, n, yaw = w.yaw) => { const [x, z] = w.at(s, n); p.add(geo, hex, x, w.y + y, z, yaw); };
    const gnd = (w, s, n) => { const [x, z] = w.at(s, n); return h(x, z) - w.y; };

    // ================= the glass corner building =================
    const GL = { top: [156, 206, 200], bottom: [84, 146, 138] };
    skin(W.G4, (P) => {
      P.glass(0, 3.3, P.w, P.y1, { ...GL, seed: 4 });
      P.r(0, -1.2, P.w, 3.3, '#3d4450');                                      // the set-back ground floor
      P.r(0, 3.1, P.w, 3.45, '#5d6470');
      for (let x = 0.8; x < 18; x += 2.7) P.win(x, 0.5, x + 2.3, 2.8, { frame: '#2a2e38', glass: '#52687a', bars: 1, lit: on(0.5), sill: 0 });
      P.r(19.2, -1.2, 25.4, 2.9, '#1f2128');                                  // the way down to the garage
      P.r(19.2, 2.9, 25.4, 3.1, '#8b8f9a');
      P.text('Aasia Köök', 5.6, 3.02, 0.36, '#e9dfb8', 'italic 600 %px Georgia, serif');
    });
    skin(W.G3, (P) => {
      P.glass(0, 0.5, P.w, P.y1, { ...GL, seed: 5 });
      P.r(0, -1.2, P.w, 0.5, '#4a4f5a');
    });
    skin(W.G2, (P) => {
      P.r(0, -1.2, P.w, P.y1, '#3b414e');
      P.glass(0, 4.2, P.w, P.y1, { top: [96, 124, 136], bottom: [60, 84, 96], mull: '#23272f', seed: 6, trees: 0 });
      P.win(0.5, 0, 2.9, 2.7, { frame: '#23272f', glass: '#7c93a0', bars: 1, lit: 1, sill: 0 });
    });
    skin(W.G1, (P) => {
      P.glass(0, 4.3, P.w, P.y1, { cw: 1.45, ch: 1.75, top: [120, 168, 172], bottom: [70, 112, 118], mull: '#26323a', seed: 7, trees: 0.3 });
      P.r(0, -1.2, P.w, 4.3, '#383d49');
      P.r(0, 3.9, P.w, 4.3, '#6a707c');
      for (let x = 1.2; x < 26; x += 4.1) {                                   // shop fronts between stone piers
        P.win(x, 0.25, x + 3.4, 3.3, { frame: '#23272f', glass: '#5d7486', bars: 2, lit: on(0.6), sill: 0 });
        P.r(x - 0.5, -1.2, x - 0.2, 3.9, '#8e929c');
      }
      // the hotel end: speckled grey stone, the name in gold, the glass doors
      P.r(27.2, -1.2, P.w, 9.2, '#2f343f');
      P.r(31.6, 3.3, P.w, 8.4, '#9a9ca6');
      P.r(27.2, 3.2, P.w, 3.45, '#7d8089');
      P.win(27.9, 0, 31.2, 2.9, { frame: '#3a3f4a', glass: '#6f8794', bars: 2, lit: 1, sill: 0 });
      P.text('Clubhotel', 30.3, 5.3, 1.25, '#d8c890', 'italic 700 %px "Brush Script MT", "Segoe Script", Georgia, serif');
      P.text('restoranis', 30.0, 6.7, 0.7, '#d8c890', 'italic 600 %px "Brush Script MT", "Segoe Script", Georgia, serif');
      P.text('O', 23.6, 13.6, 1.1, '#e8a04a'); P.text('R', 23.6, 12.1, 1.1, '#e8a04a'); P.text('D', 23.6, 10.6, 1.1, '#e8a04a'); P.text('I', 23.6, 9.1, 1.1, '#e8a04a');
    });
    skin(W.G5, (P) => {
      P.glass(0, 3.3, P.w, P.y1, { ...GL, seed: 8, trees: 0.2 });
      P.r(0, -1.2, P.w, 3.3, '#3d4450');
    });
    // hotel steps on Küüni
    for (let k = 0; k < 3; k++) put(W.G1, BOX(5.2 - k * 0.3, 0.16, 1.6 - k * 0.45), 0x5a5d68, 29.6, gnd(W.G1, 29.6, 0.9) + 0.08 + k * 0.16, 0.85 - k * 0.2);
    // the planter along Vallikraavi: a low concrete wall full of juniper and pink spiraea, the terrace beside it
    {
      const w = W.G4;
      for (const [s0, s1] of [[8.6, 18.4]]) {
        const sm = (s0 + s1) / 2, y = gnd(w, sm, 2.2);
        put(w, BOX(s1 - s0, 0.85, 3.0), COL.concrete, sm, y + 0.42, 2.1);
        put(w, BOX(s1 - s0 + 0.1, 0.07, 3.1), 0xdedce4, sm, y + 0.88, 2.1);
        for (let s = s0 + 0.5, k = 0; s < s1 - 0.3; s += 0.8, k++) {
          for (const n of [1.2, 2.2, 3.1]) {
            const flowering = (k + Math.round(n)) % 4 === 0, ss = s + (n - 2) * 0.2;
            if (!K.leafy.ok) { put(w, new THREE.IcosahedronGeometry(0.55 + (k % 3) * 0.08, 1).scale(1.1, 0.7, 1), flowering ? COL.bloom[k % 2] : COL.shrub[(k + Math.round(n * 2)) % 3], ss, y + 1.1, n, k); continue; }
            // leafy: dark juniper, and spiraea with its pink flower heads over the leaves
            const [bx, bz] = w.at(ss, n), wd = 1.45 + (k % 3) * 0.15, t = (k + Math.round(n * 2)) % 3;
            K.leafy.bush(bx, w.y + y + 0.82, bz, wd, flowering ? 0.95 : 0.8 + t * 0.08, k * 1.9 + n, flowering ? [0.95, 1, 0.9] : [0.6 + t * 0.06, 0.82 + t * 0.04, 0.7 + t * 0.04]);
            if (flowering) for (let f = 0; f < 11; f++) {
              const a = f * 2.4 + k, d = 0.12 + ((f * 7) % 5) * 0.11;
              put(w, new THREE.IcosahedronGeometry(0.075 + (f % 3) * 0.02, 0).scale(1, 0.6, 1), COL.bloom[f % 2], ss + Math.cos(a) * d, y + 1.72 - d * d * 0.9 + (f % 2) * 0.04, n + Math.sin(a) * d, f);
            }
          }
        }
        const [x, z] = w.at(sm, 2.1);
        solids.push({ x, z, yaw: Math.atan2(-w.uz, w.ux), hx: (s1 - s0) / 2, hz: 1.55 });
      }
      // (the terrace deck beside it, a raised slab on the inside of the first corner, is gone: Martin, 19 Nov)
    }

    // ================= the brick tower house =================
    const TB = [136, 88, 74], TBs = '#8a5a4c';
    const whiteWin = (P, x, y, w, hh, o = {}) => P.win(x, y, x + w, y + hh, { bars: 2, rails: 1, fw: 0.07, lit: on(), ...o });
    const tower = (P, clock) => {
      P.brick(0, -1.2, P.w, P.y1, TB, 11);
      P.r(P.w / 2 - 0.45, 3.4, P.w / 2 + 0.45, 14.8, '#30343e');              // the tall strip of stair windows
      for (let y = 3.6; y < 14.6; y += 1.1) P.r(P.w / 2 - 0.38, y, P.w / 2 + 0.38, y + 0.95, '#7f93a8');
      if (clock) { P.arc(P.w / 2, 16.6, 0.72, '#2a2c34'); P.arc(P.w / 2, 16.6, 0.6, '#f0ece2'); P.r(P.w / 2 - 0.03, 16.6, P.w / 2 + 0.03, 17.05, '#2a2c34'); P.r(P.w / 2, 16.57, P.w / 2 + 0.34, 16.63, '#2a2c34'); }
    };
    skin(W.T0, (P) => tower(P, true), { ppm: 30 });
    skin(W.T1, (P) => tower(P, true), { ppm: 30 });
    skin(W.TE, (P) => {
      P.brick(0, -1.2, P.w, P.y1, TB, 12);
      for (let f = 0; f < 4; f++) for (const x of [2.2, 6.4, 10.2]) whiteWin(P, x, 4.4 + f * 3.3, 1.6, 1.7);
    });
    skin(W.T2, (P) => {
      P.brick(0, -1.2, P.w, 13.6, TB, 13);
      // the slate mansard with two dormers
      P.r(0, 13.6, P.w, P.y1, '#5a5b70');
      for (let y = 13.75; y < P.y1; y += 0.3) P.r(0, y, P.w, y + 0.03, '#494a5c');
      P.r(0, 13.45, P.w, 13.7, '#3f4050');
      for (const x of [2.9, 7.6]) { P.r(x - 0.25, 14.2, x + 1.75, 16.7, '#4a4b5e'); whiteWin(P, x, 14.5, 1.5, 1.8, { bars: 1 }); }
      // three floors of three-light windows
      for (let f = 0; f < 3; f++) for (const x of [2.6, 7.3]) whiteWin(P, x, 4.9 + f * 2.95, 2.1, 1.75);
      // the ground floor: lit arcade under a flat canopy, the party's name above the door
      P.r(0.8, -1.2, P.w - 0.8, 3.3, '#3a2c2a');
      for (const [x0, x1] of [[1.2, 4.2], [4.9, 7.6], [8.3, 11.3]]) {
        P.grad(x0, 0, x1, 2.6, '#ffe9b8', '#e9c58a');
        P.arc((x0 + x1) / 2, 2.6, (x1 - x0) / 2, '#ffe9b8', Math.PI, Math.PI * 2);
        P.r(x0, 0, x1, 0.08, '#3a2c2a');
      }
      P.r(5.0, 0, 7.5, 2.4, '#2c3038'); P.win(5.2, 0, 7.3, 2.3, { frame: '#2c3038', glass: '#8fa3b4', bars: 1, sill: 0, lit: 1 });
      P.r(4.6, 2.55, 7.9, 3.05, '#28407c');
      P.text('LÄVI  ÄRIKESKUS', 6.25, 2.8, 0.26, '#f4f4fa');
      P.r(0.6, 3.3, P.w - 0.6, 3.75, '#6f4a40');
      P.text('ISAMAA', 6.6, 4.25, 0.5, '#4a8fd8');
      P.arc(8.5, 4.3, 0.22, '#f4f4fa');
    }, { ppm: 30 });
    const render = (P, seed) => {
      P.r(0, -1.2, P.w, P.y1, '#d9cdbd');
      P.brick(0, -1.2, P.w, 3.4, TB, seed);
      P.r(0, 3.4, P.w, 3.6, '#bfb3a4');
      for (let f = 0; f < 4; f++) for (let x = 0.8; x + 1.3 < P.w; x += 2.3) whiteWin(P, x, 4.5 + f * 3.0, 1.3, 1.6, { bars: 1 });
      for (let x = 0.8; x + 1.5 < P.w; x += 2.6) { P.grad(x, 0.3, x + 1.6, 2.3, '#ffe9b8', '#e9c58a'); P.arc(x + 0.8, 2.3, 0.8, '#ffe9b8', Math.PI, Math.PI * 2); }
    };
    skin(W.T3, (P) => render(P, 14));
    skin(W.T4, (P) => render(P, 15));
    skin(W.T5, (P) => {
      P.r(0, -1.2, P.w, P.y1, '#a9a7ae');
      for (let y = 4.0; y < P.y1; y += 3.0) P.r(0, y, P.w, y + 0.05, '#8f8d96');
      for (let f = 0; f < 4; f++) for (const x of [1.6, 6.2, 10.8, 14.2]) P.win(x, 5.0 + f * 3.0, x + (x > 14 ? 1.6 : 2.6), 6.9 + f * 3.0, { frame: '#3c3e4a', glass: '#5d6f8c', bars: x > 14 ? 1 : 2, lit: on(), sill: 0.12, sc: '#8f8d96' });
      P.brick(0, -1.2, P.w, 3.9, TB, 16);
      for (const x of [1.2, 6.0, 10.8]) {                                     // arched shop windows, the ticket office
        P.grad(x, 0.7, x + 3.6, 2.2, '#f3d9a4', '#e3c08a');
        P.arc(x + 1.8, 2.2, 1.8, '#f3d9a4', Math.PI, Math.PI * 2);
        P.r(x - 0.1, 0.45, x + 3.7, 0.7, '#6a443a');
      }
      P.r(5.6, 0.75, 10.0, 1.35, '#2a4fc0');
      P.text('Laevapiletid', 7.8, 1.05, 0.38, '#f4f4fa', 'italic 700 %px Arial, sans-serif');
      P.r(13.2, 4.3, 16.6, 4.7, '#f1eff4'); P.text('Vallikraavi 2', 14.9, 4.5, 0.26, '#3a3c48', '600 %px Arial, sans-serif');
    });
    // the canopy over the ISAMAA door and its lamps
    put(W.T2, BOX(11.2, 0.22, 1.5), 0x4a3a36, 6.2, 3.5, 0.75);
    for (const s of [2.7, 6.2, 9.8]) { const [x, z] = W.T2.at(s, 0.8); glow.push(new THREE.SphereGeometry(0.1, 8, 6).translate(x, W.T2.y + 3.32, z)); }
    // the steps and the low brick wall in front of Vallikraavi 2
    {
      const w = W.T5;
      for (let k = 0; k < 4; k++) put(w, BOX(3.6, 0.17, 0.32), 0x9a8f8c, 3.2, gnd(w, 3.2, 1.0) + 0.09 + k * 0.17, 1.5 - k * 0.32);
      put(w, BOX(7.5, 1.0, 0.4), 0x8f5d4f, 10.8, gnd(w, 10.8, 3.2) + 0.5, 3.2);
      put(w, BOX(7.6, 0.07, 0.5), 0xb9b4b8, 10.8, gnd(w, 10.8, 3.2) + 1.03, 3.2);
      const [x, z] = w.at(10.8, 3.2);
      solids.push({ x, z, yaw: Math.atan2(-w.uz, w.ux), hx: 3.75, hz: 0.22 });
    }

    // ================= Proekspert =================
    const tiles = (P) => {
      P.r(0, -1.2, P.w, P.y1, '#ecebf1');
      for (let x = 0; x < P.w; x += 0.6) P.r(x, 0, x + 0.02, P.y1, '#d6d5de');
      for (let y = 0; y < P.y1; y += 0.6) P.r(0, y, P.w, y + 0.02, '#d6d5de');
    };
    const ribbon = (P, x0, x1, y, hh = 1.55, pane = 1.25) => {
      P.r(x0, y, x1, y + hh, '#f7f6fa');
      for (let x = x0 + 0.06; x < x1 - 0.2; x += pane) {
        const xb = Math.min(x1 - 0.06, x + pane - 0.07);
        if (on(0.18)) P.grad(x, y + 0.07, xb, y + hh - 0.07, '#fff0c4', '#f6d79a'); else P.grad(x, y + 0.07, xb, y + hh - 0.07, '#4e5a70', '#3a4356');
      }
      P.r(x0 - 0.15, y + hh, x1 + 0.15, y + hh + 0.14, '#fbfaff');            // the thin sun shelf over each band
    };
    const proTop = (P) => { P.r(0, P.y1 - 3.1, P.w, P.y1, '#3d4252'); P.glass(0, P.y1 - 3.0, P.w, P.y1 - 0.5, { cw: 1.2, ch: 2.5, top: [150, 160, 190], bottom: [86, 98, 124], mull: '#f1f0f6', seed: 21, trees: 0 }); P.r(0, P.y1 - 0.5, P.w, P.y1, '#8e4a48'); };
    skin(W.P1, (P) => {
      tiles(P);
      for (let f = 0; f < 4; f++) {
        const y = 5.6 + f * 3.25;
        ribbon(P, 1.2, 8.6, y); ribbon(P, 10.2, 15.6, y); ribbon(P, 22.6, 28.4, y); ribbon(P, 30.2, 36.8, y);
      }
      // the glass oriel
      P.r(16.6, 4.4, 21.6, 17.6, '#30343e');
      P.glass(16.7, 4.5, 21.5, 17.5, { cw: 1.2, ch: 1.6, top: [130, 150, 176], bottom: [70, 84, 108], mull: '#262a33', seed: 22, trees: 0.2 });
      proTop(P);
      // the glazed ground floor and the name
      P.r(0, -1.2, P.w, 3.9, '#2b2e38');
      for (let x = 0.5; x < P.w - 2; x += 2.45) P.win(x, 0.15, x + 2.2, 3.2, { frame: '#1f2128', glass: '#56677c', bars: 0, lit: on(0.35), sill: 0 });
      P.r(0, 3.9, P.w, 4.15, '#c9c8d2');
      P.text('PROEKSPERT', 31.0, 4.85, 1.1, '#3f9fc4', '800 %px Arial, sans-serif');
    });
    skin(W.P2, (P) => {
      tiles(P);
      for (let f = 0; f < 4; f++) ribbon(P, 5.4, 13.6, 5.6 + f * 3.25);
      P.r(0, -1.2, 4.2, P.y1, '#30343e');                                     // the dark glass return at the corner
      P.glass(0.1, 4.2, 4.1, P.y1 - 3.1, { cw: 1.0, ch: 1.6, top: [120, 138, 166], bottom: [62, 74, 98], mull: '#262a33', seed: 23, trees: 0.25 });
      proTop(P);
      P.r(0, -1.2, P.w, 3.9, '#2b2e38');
      for (let x = 0.5; x < P.w - 2; x += 2.45) P.win(x, 0.15, x + 2.2, 3.2, { frame: '#1f2128', glass: '#56677c', bars: 0, lit: on(0.35), sill: 0 });
      P.r(0, 3.9, P.w, 4.15, '#c9c8d2');
    });
    skin(W.P3, (P) => {
      tiles(P);
      for (let f = 0; f < 5; f++) for (const x of [3.0, 9.5, 16.0]) P.win(x, 2.2 + f * 3.25, x + 1.5, 3.7 + f * 3.25, { frame: '#f7f6fa', glass: '#4e5a70', bars: 1, lit: on(), sill: 0 });
      P.r(0, P.y1 - 0.5, P.w, P.y1, '#8e4a48');
      P.r(0, -1.2, P.w, 0.5, '#8d8f9a');
    });
    put(W.P3, BOX(0.9, 0.7, 0.4), 0xd9d8de, 1.6, 3.4, 0.3);                    // the air conditioner by the corner

    // ================= Vabank =================
    const VG = { cw: 1.55, ch: 1.55, top: [92, 100, 140], bottom: [44, 48, 72], mull: '#c9cbd8', trees: 0.3 };
    skin(W.V1, (P) => {
      P.r(0, -1.2, P.w, P.y1, '#30323e');
      P.glass(0, 0.4, P.w, P.y1 - 0.6, { ...VG, seed: 31 });
      P.r(0, P.y1 - 0.6, P.w, P.y1, '#565a6a');
      P.text('AB FARMACIA', 9, P.y1 - 1.5, 0.75, '#b9c4ea', '600 %px Arial, sans-serif');
    });
    skin(W.V2, (P) => {
      P.r(0, -1.2, P.w, P.y1, '#343640');
      P.glass(9.5, 0.4, P.w, P.y1 - 0.6, { ...VG, seed: 32 });
      P.glass(0, 3.6, 4.4, P.y1, { cw: 1.1, ch: 1.3, top: [80, 88, 120], bottom: [40, 44, 64], mull: '#22242c', seed: 33, trees: 0.2 });
      // the concrete tower with the name down it
      P.r(4.4, -1.2, 9.5, P.y1, '#8f909a');
      P.r(6.6, 3.2, 7.5, P.y1 - 1.2, '#3a3c48');
      for (let y = 3.6; y < P.y1 - 1.6; y += 2.6) P.r(5.0, y, 6.2, y + 0.2, '#6f717c');
      'VABANK'.split('').forEach((ch, k) => P.text(ch, 8.5, P.y1 - 2.0 - k * 1.25, 0.95, '#f4f2f8', '800 %px Arial, sans-serif'));
      P.text('Club', 8.4, P.y1 - 9.9, 1.0, '#e2504c', 'italic 700 %px "Brush Script MT", "Segoe Script", Georgia, serif', 'center', -0.5);
      P.r(3.6, -1.2, 10.4, 3.0, '#24252d');                                   // the entrance under its canopy
      P.win(5.6, 0, 8.2, 2.5, { frame: '#1a1b20', glass: '#5a6a84', bars: 1, sill: 0, lit: 1 });
    });
    skin(W.V3, (P) => {
      P.r(0, -1.2, P.w, P.y1, '#3a3c48');
      P.glass(0, 7.6, P.w, P.y1, { ...VG, seed: 34, trees: 0 });
      P.r(5.2, -1.2, P.w, 7.4, '#eeedf2');                                    // the white annex
      for (const [x, y] of [[7.0, 1.2], [7.0, 4.3], [11.6, 4.3], [13.4, 1.2]]) P.win(x, y, x + 0.9, y + 1.5, { frame: '#3c3e4a', glass: '#4e5a70', bars: 0, sill: 0, lit: on() });
      P.rubble(0, -1.2, 5.2, 4.2, 35);
    });
    put(W.V2, BOX(6.8, 0.3, 2.2), 0x2a2b33, 7.0, 3.1, 1.1);
    for (const s of [4.0, 8.0, 12.0]) {                                       // flag poles in front of the glass grid
      const [x, z] = W.V1.at(s, 1.5), y = h(x, z);
      p.add(new THREE.CylinderGeometry(0.04, 0.06, 8.5, 8), 0xe6e6ee, x, y + 4.25, z, 0);
      solids.push({ x, z, yaw: 0, hx: 0.07, hz: 0.07 });
    }

    // ================= Vallikraavi 4, the red brick house =================
    const RB = [190, 112, 92], TRIM = '#f1ede4';
    const brickHouse = (P, axes, x0, pitch, seed, { door = -1, blind = [] } = {}) => {
      P.brick(0, 1.5, P.w, P.y1, RB, seed);
      P.rubble(0, -1.2, P.w, 1.2, seed + 1);
      P.brick(0, 1.2, P.w, 1.75, [170, 96, 80], seed + 2);
      P.r(0, 5.9, P.w, 6.2, TRIM);                                            // string course under the upper floor
      P.r(0, P.y1 - 2.3, P.w, P.y1 - 2.1, TRIM);                              // attic frieze
      P.r(0, P.y1 - 0.45, P.w, P.y1, TRIM);                                   // cornice
      for (let k = 0; k < axes; k++) {
        const x = x0 + k * pitch;
        if (k === door) {
          P.r(x - 0.5, 0.4, x + 1.75, 4.6, '#2a2e2c'); P.arc(x + 0.62, 4.6, 1.12, '#2a2e2c', Math.PI, Math.PI * 2);
          for (let q = 0; q < 3; q++) P.r(x - 0.3 + q * 0.75, 0.6, x + 0.3 + q * 0.75, 4.2, '#3f5a50');
        } else if (blind.includes(k)) {
          P.r(x - 0.2, 2.5, x + 1.45, 5.2, TRIM); P.brick(x, 2.7, x + 1.25, 5.0, RB, seed + k);
        } else {
          P.win(x, 2.7, x + 1.25, 5.0, { frame: '#f6f3ec', glass: '#56647c', bars: 1, rails: 2, surround: 0.2, sc: TRIM, hood: 0.16, lit: on(0.3) });
          if (k % 2 === 0) P.win(x + 0.1, 0.25, x + 1.15, 0.95, { frame: '#f6f3ec', glass: '#4a5568', bars: 1, sill: 0 });      // cellar windows
        }
        P.win(x, 7.0, x + 1.25, 9.3, { frame: '#f6f3ec', glass: '#56647c', bars: 1, rails: 2, surround: 0.2, sc: TRIM, hood: 0.16, lit: on(0.3) });
        P.win(x + 0.1, P.y1 - 1.75, x + 1.15, P.y1 - 1.0, { frame: '#f6f3ec', glass: '#4a5568', bars: 1, surround: 0.1, sc: TRIM, sill: 0 });   // attic lights
      }
    };
    skin(W.B1, (P) => brickHouse(P, 6, 1.9, 2.85, 51, { door: 0, blind: [2] }), { ppm: 34 });
    skin(W.B2, (P) => brickHouse(P, 11, 1.6, 2.85, 61, { blind: [4, 9] }), { ppm: 34 });
    // the balcony on the statue front: slab on brackets, white iron railing, flower boxes
    {
      const w = W.B1, s0 = 10.2, s1 = 14.0;
      put(w, BOX(s1 - s0, 0.16, 1.1), 0xf1ede4, (s0 + s1) / 2, 6.55, 0.65);
      for (const s of [s0 + 0.3, s1 - 0.3]) put(w, BOX(0.14, 0.5, 0.9), 0xf1ede4, s, 6.25, 0.5);
      put(w, BOX(s1 - s0, 0.05, 0.05), 0xfaf8f4, (s0 + s1) / 2, 7.6, 1.17);
      for (let s = s0; s <= s1 + 0.01; s += 0.15) put(w, BOX(0.025, 0.95, 0.025), 0xfaf8f4, s, 7.1, 1.17);
      for (const s of [s0, s1]) { put(w, BOX(0.05, 0.05, 1.0), 0xfaf8f4, s, 7.6, 0.67); for (let n = 0.3; n < 1.1; n += 0.2) put(w, BOX(0.025, 0.95, 0.025), 0xfaf8f4, s, 7.1, n); }
      for (let s = s0 + 0.3, k = 0; s < s1; s += 0.45, k++) put(w, new THREE.IcosahedronGeometry(0.2, 1), k % 3 ? COL.shrub[k % 3] : 0xf2f2f6, s, 7.75, 1.2, k);
      put(w, new THREE.CylinderGeometry(0.02, 0.02, 2.4, 6).rotateX(0.9), 0xd8d4cc, 13.0, 8.4, 1.3);        // the flag staff
    }
    // the hanging sign at the street corner and the downpipe
    put(W.B2, BOX(0.08, 1.9, 1.5), 0x34343c, 0.5, 6.4, 0.95);
    put(W.B2, BOX(0.1, 1.5, 1.2), 0xe8e4dc, 0.5, 6.4, 0.95);
    put(W.B2, BOX(0.05, 0.05, 1.7), COL.iron, 0.5, 7.5, 0.85);
    put(W.B2, new THREE.CylinderGeometry(0.06, 0.06, 11.5, 8), 0x9aa0a8, 0.12, 5.7, 0.2);
    {
      // "Vilde ja Vine" on the sign board, both sides
      const tex = facade(1.2, 0, 1.5, 96, (P) => { P.r(0, 0, 1.2, 1.5, '#34343c'); P.text('Vilde', 0.6, 1.0, 0.32, '#f1ede4', 'italic 700 %px Georgia, serif'); P.text('ja Vine', 0.6, 0.62, 0.26, '#f1ede4', 'italic 700 %px Georgia, serif'); P.r(0.2, 0.3, 1.0, 0.33, '#f1ede4'); });
      for (const d of [-1, 1]) {
        const [x, z] = W.B2.at(0.5 + d * 0.06, 0.95);
        const g = new THREE.PlaneGeometry(1.2, 1.5).rotateY(Math.atan2(W.B2.ux * d, W.B2.uz * d)).translate(x, W.B2.y + 6.4, z);
        extra.push([g, new THREE.MeshLambertMaterial({ map: tex })]);
      }
    }
    // the stone step along the statue front
    put(W.B1, BOX(6.0, 0.3, 1.6), 0x9b8f8c, 11.2, gnd(W.B1, 11.2, 0.9) + 0.1, 0.9);

    // ================= the green wooden house and its neighbours =================
    const GREEN = [172, 194, 150], CREAM = '#efe6c8';
    const greenHouse = (P, seed, xs, plinth) => {
      P.boards(0, 3.9, P.w, P.y1, GREEN);
      P.brick(0, plinth, P.w, 3.9, RB, seed);
      P.rubble(0, -1.2, P.w, plinth, seed + 1);
      P.r(0, 3.8, P.w, 4.05, CREAM); P.r(0, P.y1 - 0.4, P.w, P.y1, CREAM);
      P.r(0, 3.9, 0.22, P.y1, CREAM); P.r(P.w - 0.22, 3.9, P.w, P.y1, CREAM);
      for (const x of xs) {
        P.win(x, 5.0, x + 1.15, 7.2, { frame: '#f3ecd6', glass: '#56647c', bars: 1, rails: 1, surround: 0.16, sc: CREAM, hood: 0.14, lit: on(0.3) });
        if (plinth < 1.6) P.win(x, 1.6, x + 1.15, 3.3, { frame: '#f3ecd6', glass: '#56647c', bars: 1, rails: 1, surround: 0.1, sc: '#d8d0c0', lit: on(0.3) });
      }
    };
    skin(W.H1, (P) => greenHouse(P, 71, [1.6, 4.4, 7.4], 2.4), { ppm: 30 });
    skin(W.H2, (P) => greenHouse(P, 73, [1.2, 4.0], 1.0), { ppm: 30 });
    skin(W.H3, (P) => {
      greenHouse(P, 75, [9.0, 11.8, 14.4], 0.7);
      // no. 3: the brick house with the green double door under a little pediment
      P.brick(0, 0.5, 7.2, P.y1, RB, 77);
      P.rubble(0, -1.2, 7.2, 0.5, 78);
      P.r(0, P.y1 - 0.4, 7.2, P.y1, CREAM);
      P.r(4.4, 0.3, 6.5, 3.7, CREAM);
      P.r(4.55, 0.3, 6.35, 3.55, '#a9bfa0');
      for (const x of [4.7, 5.55]) for (const y of [0.55, 1.5, 2.55]) P.r(x, y, x + 0.6, y + 0.75, '#8f96a8');
      P.r(5.43, 0.3, 5.47, 3.55, '#6f8a70');
      P.win(4.8, 4.6, 6.1, 6.6, { frame: '#f3ecd6', glass: '#56647c', bars: 1, rails: 1, surround: 0.2, sc: CREAM, hood: 0.3, lit: 1 });
      P.win(1.2, 4.6, 2.5, 6.6, { frame: '#f3ecd6', glass: '#56647c', bars: 1, rails: 1, surround: 0.2, sc: CREAM, hood: 0.3 });
      P.win(1.2, 1.3, 2.5, 3.2, { frame: '#f3ecd6', glass: '#56647c', bars: 1, rails: 1, surround: 0.2, sc: CREAM, hood: 0.3 });
      P.text('3', 3.8, 2.9, 0.32, '#f1ede4');
    }, { ppm: 30 });
    put(W.H1, new THREE.CylinderGeometry(0.07, 0.07, 8.4, 8), 0xa7adb6, 0.25, 4.3, 0.2);
    skin(W.L1, (P) => {
      const DB = [150, 84, 76];
      P.brick(0, -1.2, 24.6, P.y1, DB, 81);
      for (let x = 0.3; x < 24; x += 3.0) {                                   // window bays between dark pilasters
        P.r(x, 0.3, x + 0.35, P.y1 - 0.5, '#6b4a4a');
        for (let f = 0; f < 3; f++) P.win(x + 1.05, 0.9 + f * 2.85 + (f ? 0.5 : 0), x + 2.2, (f ? 3.2 : 2.3) + f * 2.85, { frame: '#5a4648', glass: '#5d6f8c', bars: 0, rails: f ? 1 : 0, surround: 0.12, sc: '#6b4a4a', lit: on(0.25) });
      }
      P.r(0, P.y1 - 0.5, 24.6, P.y1, '#6b4a4a');
      // the dark wooden house with its ladder
      P.boards(24.6, 2.3, P.w, P.y1, [96, 72, 66], 0.12);
      P.r(24.6, -1.2, P.w, 2.3, '#2c2a30');
      for (const y of [3.4, 6.2]) P.win(26.4, y, 27.9, y + 1.9, { frame: '#3a3034', glass: '#6f8194', bars: 0, sill: 0.08, sc: '#3a3034', lit: on(0.4) });
      P.r(29.4, 2.3, 29.46, P.y1, '#1f1e24'); P.r(29.9, 2.3, 29.96, P.y1, '#1f1e24');
      for (let y = 2.5; y < P.y1; y += 0.3) P.r(29.4, y, 29.96, y + 0.04, '#1f1e24');
    }, { ppm: 28 });
    // fence across the gap between the wooden house and no. 3
    {
      const a = WALLS.L1.b, b = WALLS.H3.a, dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      const y = Math.min(h(a[0], a[1] + 0.5), h(b[0], b[1] + 0.5));
      p.add(BOX(l, 2.0, 0.08), 0xc4c896, (a[0] + b[0]) / 2, y + 1.0, (a[1] + b[1]) / 2 + 0.05, Math.atan2(-dz, dx));
      for (let k = 0; k <= 5; k++) p.add(BOX(0.04, 2.0, 0.1), 0xa9ae80, a[0] + dx * k / 5, y + 1.0, a[1] + dz * k / 5 + 0.06, Math.atan2(-dz, dx));
    }
    // the painted gable: a theatre stage full of people, in faded colours
    skin(W.M1, (P) => {
      const r = rnd(91);
      P.r(0, -1.2, P.w, P.y1, '#ead9b6');
      P.r(0, -1.2, P.w, 0.4, '#bfae96');
      const x0 = 3.2, x1 = 11.6, y0 = 0.9, y1 = 6.4;
      P.r(x0 - 0.5, y0 - 0.3, x1 + 0.5, y1 + 0.5, '#c9bca8');                 // painted stone frame with columns
      P.grad(x0, y0, x1, y1, '#f2deb0', '#d9b88c');
      P.arc((x0 + x1) / 2, y1 - 2.4, 2.6, 'rgba(255,244,214,0.75)');
      for (const x of [x0, x1 - 0.9]) { P.grad(x, y0, x + 0.9, y1, '#b9706a', '#96524f'); for (let q = 0.15; q < 0.9; q += 0.25) P.r(x + q, y0, x + q + 0.05, y1, '#84464a'); }
      P.r(x0, y1 - 0.7, x1, y1, '#a86060');
      for (const x of [x0 - 0.5, x1 + 0.1]) { P.r(x, y0 - 0.3, x + 0.4, y1 + 0.2, '#d9d0c0'); P.r(x - 0.08, y1 + 0.1, x + 0.48, y1 + 0.35, '#e6dfd2'); }
      P.r(x0, y0, x1, y0 + 0.5, '#9c8468');                                   // the stage floor and the crowd on it
      const cols = ['#5a5560', '#7a4a4c', '#3f4a5c', '#8a7a5a', '#b9a9a0', '#4c5a4e', '#96687a', '#2f2c34', '#c9b890'];
      for (let k = 0; k < 46; k++) {
        const x = x0 + 1.0 + r() * (x1 - x0 - 2.0), back = r(), y = y0 + 0.25 + back * 0.6, s = 1 - back * 0.25, col = cols[Math.floor(r() * cols.length)];
        P.r(x - 0.16 * s, y, x + 0.16 * s, y + 0.95 * s, col);
        P.arc(x, y + 1.08 * s, 0.11 * s, '#e3c4a8');
        if (r() < 0.3) P.r(x - 0.3 * s, y + 0.7 * s, x + 0.3 * s, y + 0.78 * s, col);
      }
      P.c.fillStyle = 'rgba(234,217,182,0.28)'; P.c.fillRect(0, 0, P.c.canvas.width, P.c.canvas.height);       // weathered
    }, { ppm: 40 });

    // ================= the street =================
    const T = (i, lat) => {                                 // track frame at a fractional index; lat > 0 to the right
      const k = Math.floor(i), f = i - k, a = track.P[k], b = track.P[k + 1];
      const [tx, tz] = track.tan[k];
      return [a[0] + (b[0] - a[0]) * f - tz * lat, a[1] + (b[1] - a[1]) * f + tx * lat];
    };
    const F = { at: (t, lat) => T(t, lat) };
    const hw = (i) => track.HW[Math.round(i)];
    const whites = [], blues = [];
    const line = (list, a, b, w = 0.12) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = (-dz / l) * w / 2, nz = (dx / l) * w / 2;
      list.push([[[a[0] - nx, a[1] - nz], [b[0] - nx, b[1] - nz], [b[0] + nx, b[1] + nz], [a[0] + nx, a[1] + nz]]]);
    };
    // bays square to the road on the park side, parallel bays under the tower house
    const rows = [PARK_BAYS, ...[32, 33].map((s) => PARKING.find((r) => r.seed === s))];
    for (const row of rows.slice(0, 2)) {
      const dx = row.b[0] - row.a[0], dz = row.b[1] - row.a[1], l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
      const depth = row.perp ? 2.5 : 1.1, back = row.back ?? depth;     // reach towards the road, and away from it
      let nx = -uz, nz = ux;
      const side = track.nearest(row.a[0] + nx, row.a[1] + nz).d < track.nearest(row.a[0] - nx, row.a[1] - nz).d ? 1 : -1;      // the road side of the row
      nx *= side; nz *= side;
      for (let k = 0; k <= row.n; k++) {
        const x = row.a[0] + dx * k / row.n, z = row.a[1] + dz * k / row.n;
        line(whites, [x - nx * back, z - nz * back], [x + nx * depth, z + nz * depth]);
      }
      line(blues, [row.a[0] + nx * depth, row.a[1] + nz * depth], [row.b[0] + nx * depth, row.b[1] + nz * depth], 0.1);
    }
    // the car park under the hill: paving, bay lines, then the asphalt bays with blue lines along the street
    K.ribbon(F, 106.5, 116, -(hw(110) + 0.4), -(hw(110) + 9.5), 'dark');
    {
      const row = rows[2], dx = row.b[0] - row.a[0], dz = row.b[1] - row.a[1];
      for (let k = 0; k <= row.n; k++) { const x = row.a[0] + dx * k / row.n, z = row.a[1] + dz * k / row.n; line(whites, [x, z - 2.4], [x, z + 2.4]); }
      for (let i = 117; i <= 128; i += 2.75) line(blues, T(i, -(hw(i) + 0.5)), T(i, -(hw(i) + 2.6)), 0.1);
      line(blues, T(117, -(hw(117) + 2.6)), T(128, -(hw(128) + 2.6)), 0.1);
    }
    for (const [list, hex] of [[whites, COL.white], [blues, COL.blue]]) {
      const g = drapeGeometry(world, list, 0.1, 1, 1.5);
      if (g) extra.push([g, new THREE.MeshLambertMaterial({ color: hex, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7, side: THREE.DoubleSide })]);
    }
    // waste containers along the back of the car park: big dark ones on wheels, a green one, a small brown one
    {
      const bins = [[1407.2, COL.bin, 1.35], [1410.4, COL.bin, 1.35], [1413.6, COL.bin, 1.35], [1416.2, COL.binBrown, 0.7], [1418.6, COL.bin, 1.35], [1421.6, COL.binGreen, 1.35]];
      for (const [x, hex, wd] of bins) {
        let z = 3104.6;
        while (z > 3099 && world.surfaceAt && world.surfaceAt(x, z) === 0) z -= 0.4;
        const y = h(x, z), tall = wd > 1 ? 1.15 : 0.95;
        p.add(BOX(wd, tall, 1.05), hex, x, y + 0.2 + tall / 2, z, 0);
        p.add(BOX(wd + 0.08, 0.1, 1.13), wd > 1 ? COL.binLid : hex, x, y + 0.25 + tall, z, 0);
        for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.add(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 8).rotateZ(Math.PI / 2), COL.iron, x + ox * (wd / 2 - 0.15), y + 0.1, z + oz * 0.4, 0);
        solids.push({ x, z, yaw: 0, hx: wd / 2, hz: 0.55 });
      }
    }
    // lanterns on the house walls (the lantern posts along the car park kerb are props: valliStreetProps)
    const lantern = (x, y, z) => {
      p.add(new THREE.CylinderGeometry(0.13, 0.2, 0.36, 4).rotateY(Math.PI / 4), COL.iron, x, y + 0.02, z, 0);
      p.add(new THREE.ConeGeometry(0.24, 0.2, 4).rotateY(Math.PI / 4), COL.iron, x, y + 0.36, z, 0);
      glow.push(new THREE.SphereGeometry(0.1, 8, 6).translate(x, y + 0.05, z));
    };
    for (const s of [6.5, 16.5, 26.5]) {
      const [x, z] = W.L1.at(s, 0.75);
      put(W.L1, BOX(0.05, 0.05, 0.75), COL.iron, s, 4.1, 0.4);
      lantern(x, W.L1.y + 3.75, z);
    }
    { const [x, z] = W.H3.at(3.2, 0.7); put(W.H3, BOX(0.05, 0.05, 0.7), COL.iron, 3.2, 4.2, 0.38); lantern(x, W.H3.y + 3.85, z); }

    // the rubble face of the stone wall under the hill
    {
      const tex = facade(8, 0, 2.2, 48, (P) => { P.rubble(0, 0, 8, 2.2, 99); P.r(0, 2.05, 8, 2.2, '#8f877e'); });
      tex.wrapS = THREE.RepeatWrapping;
      const pos = [], uv = [];
      let run = 0;
      for (const wl of world.vectors.walls || []) {
        for (let k = 0; k < wl.length - 1; k++) {
          const a = wl[k], b = wl[k + 1], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
          if (mx < 1428 || mx > 1462 || mz < 3040 || mz > 3092) continue;
          const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
          let nx = -dz / l, nz = dx / l;
          const nr = track.nearest(mx, mz, 92);
          if ((track.P[nr.i][0] - mx) * nx + (track.P[nr.i][1] - mz) * nz < 0) { nx = -nx; nz = -nz; }
          const o = 0.34, ya = h(a[0], a[1]), yb = h(b[0], b[1]);
          const A = [a[0] + nx * o, a[1] + nz * o], B = [b[0] + nx * o, b[1] + nz * o];
          const q = [[A, ya - 0.45, 0], [B, yb - 0.45, 0], [B, yb + 1.75, 1], [A, ya + 1.75, 1]];
          const flip = dx * nz - dz * nx > 0;
          for (const j of flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]) {
            const [pt, y, v] = q[j];
            pos.push(pt[0], y, pt[1]); uv.push((run + (pt === B ? l : 0)) / 8, v);
          }
          // coping
          p.add(BOX(l + 0.05, 0.1, 0.8), 0x9a9288, mx, (ya + yb) / 2 + 1.76, mz, Math.atan2(-dz, dx));
          run += l;
        }
      }
      if (pos.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.computeVertexNormals();
        extra.push([g, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })]);
      }
    }

    K.finish();
    for (const [g, m] of extra) { const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; group.add(mesh); }
    if (glow.length) {
      const pos = [];
      for (const g0 of glow) pos.push(...g0.toNonIndexed().attributes.position.array);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffe6b0 })));
    }
    world.addSolids(solids);
  }

  return {
    update(x, z) {
      if (built || Math.hypot(x - CENTRE[0], z - CENTRE[1]) > 600) return;
      if ([[1545, 3010], [1500, 3030], [1470, 3050], [1440, 3080], [1395, 3095]].every(([cx, cz]) => world.ready(cx, cz))) build();
    },
  };
}
