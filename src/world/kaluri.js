// Kaluri tänav and the EuroPark car park behind Circle K and McDonald's (Martin, 20 Nov: "exactly the shape of
// the car park, the small green parts, round edges where needed, parking space lines ... then between the car
// park and the glassy building there is a narrow road which has cobbles on both sides").
// Measured on the Land Board's orthophoto (10 cm) and his air photo, dressed from his Street View shots
// (Jul 2014, Aug 2018, Jul 2023):
//  - the lane: 3.7 m of newer dark asphalt between two strips of fieldstone cobbles, concrete kerb lines,
//    cars parked along the cobbles on the Kaluri 2 side, the red brick band and grey pavers to the building,
//    bikes at the Soola end, the bike share dock, scooters and the ticket machine at the AHHAA end, the zebra;
//  - the car park: older pale asphalt, 59 bays in two rows facing each other across the aisle (29 by the lane,
//    19 + 11 on the Circle K and McDonald's side with the way in between them), white lines;
//  - five kerbed islands with rounded corners: the old grey switch cabinets at the head of the lane row, the
//    gravel bed with the new substation and two green skips and the grass strip behind the Circle K row, the
//    thin grass strip behind the McDonald's row, the big grass island at the AHHAA end with its boulders, and
//    Circle K's lawn with the yellow kerb;
//  - concrete wheel stops and the EUROPARK sign at the Soola end, two green skips by the way in, lamp posts
//    and parking signs on the cobble strip, the hatched box by the car wash.
// The islands are kerbs the car can mount; the cabinets, the substation and the skips are solid.
// Circle K, McDonald's and Kaluri 2 themselves are turu.js and turu2.js. No street name is painted on the road.
import * as THREE from 'three';
import { frame } from './handbuilt.js';
import { canvasTex } from './arhitekti.js';
import { pixelSheet } from './houseskin.js';
import { jobs } from '../jobs.js';
import { lawnTex, paverTex, leafyPlants } from './streetkit.js';
import { paintScale } from './paintscale.js';
import { greyBack } from './signback.js';
import { Parts, BOX } from '../race/landmarks.js';

// s metres along the lane from its Soola end towards AHHAA (the map's own centre line is v = 0), v metres
// across it: + is the car park side (Circle K, McDonald's), - the Kaluri 2 side
export const KALURI = frame([2000, 3121], [1, 1]);
const F = KALURI;

// ---------------------------------------------------------------- the plan, in the frame
const LANE = { v0: -1.5, v1: 2.2, s0: -17, s1: 81.2 };       // the asphalt of the lane
const COB = { sw: 3.9, ne: -3.9 };                            // outer edges of the two cobble strips
const ROW1 = { v0: 3.95, v1: 8.7, s0: -2.9, pitch: 2.655, n: 29 };          // bays by the lane
const ROW2 = { v0: 16.1, v1: 20.8, s0: -9.6, pitch: 2.655, n: 19 };         // bays on the Circle K side
const ROW3 = { v0: 16.1, v1: 20.8, s0: 46.9, pitch: 2.645, n: 11 };         // bays on the McDonald's side
const KERB = 0.12;                                           // how high the islands stand

// a corner list with a radius at each corner -> a closed outline with rounded corners
function fillet(pts, radius, n = 6) {
  const out = [], N = pts.length;
  for (let i = 0; i < N; i++) {
    const B = pts[i], A = pts[(i + N - 1) % N], C = pts[(i + 1) % N], r = Array.isArray(radius) ? radius[i] : radius;
    const a = [A[0] - B[0], A[1] - B[1]], c = [C[0] - B[0], C[1] - B[1]], la = Math.hypot(...a), lc = Math.hypot(...c);
    a[0] /= la; a[1] /= la; c[0] /= lc; c[1] /= lc;
    const half = Math.acos(Math.max(-1, Math.min(1, a[0] * c[0] + a[1] * c[1]))) / 2;
    if (!(r > 0.02) || half < 0.05 || half > 1.52) { out.push(B); continue; }
    const t = Math.min(r / Math.tan(half), la * 0.49, lc * 0.49), rr = t * Math.tan(half);
    const bx = a[0] + c[0], bz = a[1] + c[1], bl = Math.hypot(bx, bz), d = rr / Math.sin(half);
    const O = [B[0] + bx / bl * d, B[1] + bz / bl * d];
    const P1 = [B[0] + a[0] * t, B[1] + a[1] * t], P2 = [B[0] + c[0] * t, B[1] + c[1] * t];
    let a1 = Math.atan2(P1[1] - O[1], P1[0] - O[0]), a2 = Math.atan2(P2[1] - O[1], P2[0] - O[0]);
    if (a2 - a1 > Math.PI) a2 -= Math.PI * 2;
    if (a1 - a2 > Math.PI) a2 += Math.PI * 2;
    for (let k = 0; k <= n; k++) { const q = a1 + (a2 - a1) * k / n; out.push([O[0] + Math.cos(q) * rr, O[1] + Math.sin(q) * rr]); }
  }
  return out;
}
const rect = (s0, s1, v0, v1) => [[s0, v0], [s1, v0], [s1, v1], [s0, v1]];
const area = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
// the outline moved d metres inward
function inset(P, d) {
  const sg = area(P) > 0 ? 1 : -1, N = P.length, out = [];
  for (let i = 0; i < N; i++) {
    const A = P[(i + N - 1) % N], B = P[i], C = P[(i + 1) % N];
    let e1 = [B[0] - A[0], B[1] - A[1]], e2 = [C[0] - B[0], C[1] - B[1]];
    const l1 = Math.hypot(...e1) || 1, l2 = Math.hypot(...e2) || 1;
    e1 = [e1[0] / l1, e1[1] / l1]; e2 = [e2[0] / l2, e2[1] / l2];
    const n1 = [-e1[1] * sg, e1[0] * sg], n2 = [-e2[1] * sg, e2[0] * sg];
    let nx = n1[0] + n2[0], nz = n1[1] + n2[1];
    const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
    const k = d / Math.max(0.5, nx * n1[0] + nz * n1[1]);
    out.push([B[0] + nx * k, B[1] + nz * k]);
  }
  return out;
}
function inside(P, s, v) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    if ((P[i][1] > v) !== (P[j][1] > v) && s < (P[j][0] - P[i][0]) * (v - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c;
  }
  return c;
}

// the islands: outline, what grows on top, kerb colour
const GREY_KERB = 0xc6c3c9, YELLOW_KERB = 0xd9b532;
const ISLANDS = [
  { name: 'cabinets', top: 'grass', kerb: GREY_KERB, P: fillet(rect(-10.3, -2.95, 4.0, 8.3), 1.0) },
  { name: 'substation', top: 'gravel', kerb: GREY_KERB, P: fillet(rect(-11.3, 1.5, 20.95, 25.4), [1.2, 0.15, 0.15, 1.2]) },
  { name: 'strip', top: 'grass', kerb: GREY_KERB, P: fillet(rect(1.5, 41.9, 20.95, 23.8), [0.15, 1.3, 1.3, 0.15]) },
  { name: 'strip2', top: 'grass', kerb: GREY_KERB, P: fillet(rect(45.6, 76.3, 21.25, 22.45), [0.55, 0.1, 0.1, 0.55]) },
  { name: 'big', top: 'grass', kerb: GREY_KERB, P: fillet([[76, 15.8], [78, 15.8], [78.2, 10.6], [80.5, 8.2], [84.6, 8.0], [85.6, 9.6], [85.7, 21], [86.3, 22.6], [85.8, 23.6], [76, 23.6]], [0.6, 0.6, 1.4, 1.2, 0.9, 0.9, 1.5, 0.5, 0.6, 0.9]) },
  { name: 'tuft', top: 'grass', kerb: GREY_KERB, P: fillet(rect(75.6, 77.8, 5.7, 7.9), 1.05) },
  { name: 'lawn', top: 'grass', kerb: YELLOW_KERB, P: fillet(rect(25.2, 38.7, 32.4, 46.9), [0.4, 3.2, 3.2, 0.4]) },
];
// concrete wheel stops across the Soola end of the Circle K row: [s, v] of each, lying along v
const STOPS = [[-12.1, 15.4], [-12.1, 17.5], [-12.1, 19.6]];
// boxes that stop a car: [s, v, half length along s, half width, turned by (rad)]
const SOLIDS = [
  [-6.55, 5.4, 2.85, 0.75, 0],        // the old switch cabinets
  [-1.0, 22.7, 1.7, 1.3, 0],          // the substation
  [-5.2, 23.2, 1.6, 0.95, 0.12], [-8.9, 23.3, 1.6, 0.95, -0.1],      // its two skips
  [48.6, 24.9, 1.6, 0.95, 0.5], [52.0, 25.4, 1.6, 0.95, 0.42],       // the two skips by the way in
];

// ---------------------------------------------------------------- parked cars
// [x, z, yaw, id, paint, lift]; forward = (sin yaw, -cos yaw)
const carYaw = (ds, dv) => Math.atan2(F.U[0] * ds + F.V[0] * dv, -(F.U[1] * ds + F.V[1] * dv));
export const KALURI_CARS = [];
{
  // one entry per bay, '-' = empty; a trailing ! = backed in. BMWs (the M3 coupé and the 3 Touring) in cyan,
  // white, black and red, four 190Es in black and beige, one F40, one Carrera GT, ordinary cars between them
  const R1 = 'f31:black passat:silver m3:white - m3:cyan! rav4:white f31:bmwred w201:beige - m3:black mazda6:grey! f31:cyan m3:bmwred - f40: m3:white! model3:black - f31:white w201:black! m3:cyan - accord:silver m3:black passat:blue! - f31:black bz4x:silver -';
  const R2 = '- rav4:grey m3:bmwred f31:white! - passat:black m3:white w201:beige f31:cyan - mazda6:white! m3:black cgt: - f31:bmwred accord:blue m3:cyan! - model3:white';
  const R3 = 'w201:black - m3:white! f31:black rav4:silver - m3:bmwred mazda6:bronze f31:cyan! - passat:grey';
  const row = (R, list, noseDv) => list.split(' ').forEach((e, k) => {
    if (e === '-') return;
    const back = e.endsWith('!'), [id, paint] = e.replace('!', '').split(':');
    const j = ((k * 37 + R.n) % 11) / 11 - 0.5;                              // each car a little off square
    const dv = back ? -noseDv : noseDv, vc = (R.v0 + R.v1) / 2 + (back ? -noseDv * 0.12 : 0) + j * 0.14;
    KALURI_CARS.push([...F.at(R.s0 + R.pitch * (k + 0.5) + j * 0.22, vc), carYaw(j * 0.05, dv), id, paint || null, 0.05]);
  });
  row(ROW1, R1, -1);                     // noses to the lane
  row(ROW2, R2, 1);                      // noses to the kerb on the Circle K side
  row(ROW3, R3, 1);
  // along the lane, on the cobbles by Kaluri 2
  for (const [s, id, paint, rev] of [[6, 'mazda6', 'silver'], [12.3, 'passat', 'white'], [18.7, 'rav4', 'black', 1], [38.2, 'bz4x', 'grey'], [45.2, 'accord', 'black'], [63.2, 'model3', 'blue', 1]]) {
    KALURI_CARS.push([...F.at(s, -2.78), carYaw(rev ? -1 : 1, 0.01), id, paint, 0.08]);
  }
}

// lamp posts on the cobble strip between the lane and the bays: two arms each, one over the lane and one
// over the car park ([kind 0 = street light, x, z, compass bearing of the arm])
export function kaluriProps() {
  const out = [];
  for (const s of [24.5, 50.6, 76.3]) { const [x, z] = F.at(s, 3.05); out.push([0, x, z, 45], [0, x, z, 225]); }
  return out;
}
// the map's lights and poles that stand in the bays make way for those
export function kaluriClear(data) {
  const out = [], a = data.sectors['4_6'] || [];
  for (let k = 0; k < a.length; k += data.stride) {
    const [s, v] = F.sv(a[k + 1], a[k + 2]);
    if (a[k] < 7 && a[k] !== 4 && s > -13 && s < 81 && v > 2 && v < 21) out.push(`4_6:${k / data.stride}`);
  }
  return out;
}
// the lane and the car park have no generated centre line
export function kaluriVectors(vectors) {
  const prev = vectors.markSkip;
  vectors.markSkip = (x, z) => {
    const [s, v] = F.sv(x, z);
    return (s > -24 && s < 88 && v > -4.5 && v < 22) || (prev ? prev(x, z) : false);
  };
}

// ---------------------------------------------------------------- ground pictures (small, tiled)
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
// asphalt: fine speckle on a base tone, a few darker blotches and (old) hair cracks
function asphaltTex(base, seed, old) {
  const N = paintScale() < 1 ? 256 : 512;
  return canvasTex(N, N, (g, w) => {
    const r = rng(seed), k = w / 512;
    g.fillStyle = `rgb(${base.join(',')})`; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 26; i++) {                                  // soft blotches, wrapped round the edges
      const x = r() * w, y = r() * w, rad = (30 + r() * 80) * k, dark = r() < 0.6;
      for (const ox of [-w, 0, w]) for (const oy of [-w, 0, w]) {
        if (x + ox + rad <= 0 || x + ox - rad >= w || y + oy + rad <= 0 || y + oy - rad >= w) continue;   // (a copy that does not reach the picture)
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        gr.addColorStop(0, dark ? `rgba(40,38,48,${old ? 0.13 : 0.08})` : `rgba(255,250,255,${old ? 0.1 : 0.05})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
    // (the 26 000 grains go on in one piece: drawn one by one they were most of the 0.17 s the car park took)
    const sh = pixelSheet(g, 0, 0, w, w);
    for (let i = 0; i < 26000 * k * k; i++) {
      const v = 1 + (r() - 0.5) * (old ? 0.5 : 0.36);
      const cr = Math.max(0, Math.min(255, base[0] * v)) | 0, cg = Math.max(0, Math.min(255, base[1] * v)) | 0, cb = Math.max(0, Math.min(255, base[2] * v)) | 0;
      const x = r() * w, y = r() * w, sw = 1 + r() * 1.6, sv = 1 + r() * 1.6;
      if (sh) sh.add(x, y, x + sw, y + sv, cr, cg, cb);
      else { g.fillStyle = `rgb(${cr},${cg},${cb})`; g.fillRect(x, y, sw, sv); }
    }
    if (sh) sh.lay();
    if (old) {
      g.strokeStyle = 'rgba(52,48,60,0.5)'; g.lineWidth = Math.max(1, 1.3 * k);
      for (let i = 0; i < 7; i++) {
        let x = r() * w, y = r() * w, a = r() * 6.28;
        g.beginPath(); g.moveTo(x, y);
        for (let q = 0; q < 9; q++) { a += (r() - 0.5) * 1.1; x += Math.cos(a) * 22 * k; y += Math.sin(a) * 22 * k; g.lineTo(x, y); }
        g.stroke();
      }
    }
  });
}
// fieldstone cobbles: rounded stones of many greys, browns and dull reds in dark joints; one tile is 1.7 m
function cobbleTex() {
  const N = 256;
  return canvasTex(N, N, (g, w) => {
    const r = rng(77);
    g.fillStyle = '#5a5458'; g.fillRect(0, 0, w, w);
    const tones = [[176, 168, 170], [150, 144, 150], [196, 186, 180], [158, 132, 122], [128, 122, 130], [182, 160, 146], [140, 128, 120], [206, 198, 196]];
    const n = 13, cell = w / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const t = tones[(r() * tones.length) | 0], k = 0.85 + r() * 0.3;
      const cx = (i + 0.5 + (j % 2) * 0.5 + (r() - 0.5) * 0.3) * cell, cy = (j + 0.5 + (r() - 0.5) * 0.3) * cell;
      const rx = cell * (0.4 + r() * 0.14), ry = cell * (0.36 + r() * 0.14), a = r() * 3.1;
      for (const ox of [-w, 0, w]) for (const oy of [-w, 0, w]) {
        if (cx + ox < -cell || cx + ox > w + cell || cy + oy < -cell || cy + oy > w + cell) continue;
        g.fillStyle = `rgb(${t.map((c) => Math.min(255, c * k) | 0).join(',')})`;
        g.beginPath(); g.ellipse(cx + ox, cy + oy, rx, ry, a, 0, 6.3); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.16)';
        g.beginPath(); g.ellipse(cx + ox - rx * 0.2, cy + oy - ry * 0.25, rx * 0.5, ry * 0.4, a, 0, 6.3); g.fill();
      }
    }
  });
}
function gravelTex() {
  return canvasTex(128, 128, (g, w) => {
    const r = rng(5), base = [190, 184, 176];
    g.fillStyle = `rgb(${base.join(',')})`; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 2600; i++) { const v = 1 + (r() - 0.5) * 0.5; g.fillStyle = `rgb(${base.map((c) => Math.min(255, c * v) | 0).join(',')})`; g.fillRect(r() * w, r() * w, 1.5 + r() * 2, 1.5 + r() * 2); }
  });
}

// the painted faces of the signs and boxes, all on one small canvas: [x, y, w, h] in its 512 x 512 plan
const CELL = { euro: [4, 4, 128, 396], psign: [140, 4, 96, 150], kiosk: [244, 4, 264, 184], cab: [140, 196, 368, 124], kend: [140, 328, 200, 180], machine: [348, 328, 72, 180] };
function atlasTex() {
  const N = paintScale() < 1 ? 256 : 512, k = N / 512;
  return canvasTex(N, N, (g) => {
    g.scale(k, k);
    const text = (t, x, y, px, col, font = 'Arial, sans-serif', weight = 700) => { g.font = `${weight} ${px}px ${font}`; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x, y); };
    const rr = (x, y, w, h, rad, col) => { g.fillStyle = col; g.beginPath(); g.roundRect(x, y, w, h, rad); g.fill(); };
    g.fillStyle = '#8d9096'; g.fillRect(0, 0, 512, 512);
    const BLUE = '#1c63c7';
    // ---- the EUROPARK sign: P, the zone and prices, the tow-away plate, the name, the small print
    {
      const [x, y, w] = CELL.euro;
      rr(x, y, w, 396, 6, '#e9ecf2'); rr(x + 3, y + 3, w - 6, 178, 5, BLUE);
      text('P', x + w / 2, y + 62, 118, '#ffffff');
      rr(x + 10, y + 126, 26, 42, 3, '#ffffff'); rr(x + 14, y + 131, 18, 14, 2, BLUE);
      text('TSOON EP33', x + 80, y + 132, 13, '#ffffff'); text('30min / 1,5€', x + 82, y + 149, 12, '#ffffff'); text('24h / 7€', x + 84, y + 165, 12, '#ffffff');
      rr(x + 3, y + 186, w - 6, 86, 5, BLUE);
      // a tow truck with a car on the hook, in white
      g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x + 18, y + 250); g.lineTo(x + 18, y + 232); g.lineTo(x + 42, y + 232); g.lineTo(x + 42, y + 250); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(x + 42, y + 236); g.lineTo(x + 62, y + 204); g.lineTo(x + 78, y + 236); g.stroke();
      g.beginPath(); g.moveTo(x + 70, y + 244); g.lineTo(x + 80, y + 228); g.lineTo(x + 104, y + 232); g.lineTo(x + 112, y + 248); g.closePath(); g.stroke();
      for (const cx of [26, 80, 104]) { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + cx, y + 254, 6, 0, 6.3); g.fill(); }
      rr(x + 3, y + 277, w - 6, 46, 5, '#17191d'); text('EUROPARK', x + w / 2, y + 301, 21, '#ffffff');
      rr(x + 3, y + 328, w - 6, 62, 5, '#17191d'); text('Parkimistingimused', x + w / 2, y + 349, 12, '#ffffff'); text('märgi tagaküljel', x + w / 2, y + 368, 12, '#ffffff');
    }
    // ---- a parking sign with its pay plate
    {
      const [x, y, w] = CELL.psign;
      rr(x, y, w, 96, 5, BLUE); text('P', x + w / 2, y + 50, 84, '#ffffff');
      rr(x, y + 102, w, 48, 4, BLUE); text('TASULINE', x + w / 2, y + 118, 13, '#ffffff'); text('EP33', x + w / 2, y + 136, 14, '#ffffff');
    }
    // ---- the substation: pale grey panels, two louvred doors, a warning triangle
    const louvres = (x, y, w, h) => { g.fillStyle = '#a9acb0'; g.fillRect(x, y, w, h); for (let q = y + 3; q < y + h - 2; q += 5) { g.fillStyle = '#7f8388'; g.fillRect(x + 2, q, w - 4, 2); } };
    const warn = (x, y, s) => { g.fillStyle = '#f2c81d'; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y + s * 0.8); g.lineTo(x - s, y + s * 0.8); g.closePath(); g.fill(); g.fillStyle = '#1c1c1c'; g.fillRect(x - 1, y - s * 0.3, 2, s * 0.7); };
    {
      const [x, y, w, h] = CELL.kiosk;
      g.fillStyle = '#c3c5c8'; g.fillRect(x, y, w, h);
      g.fillStyle = '#2f3034'; g.fillRect(x, y, w, 16);                        // the dark roof edge
      g.fillStyle = '#a2a5a9'; g.fillRect(x, y + h - 10, w, 10);
      g.strokeStyle = '#9b9ea3'; g.lineWidth = 2; g.strokeRect(x + 96, y + 26, 156, h - 40);
      g.beginPath(); g.moveTo(x + 174, y + 26); g.lineTo(x + 174, y + h - 14); g.stroke();
      louvres(x + 108, y + 40, 54, h - 70); louvres(x + 186, y + 40, 54, h - 70);
      louvres(x + 18, y + 36, 26, 54); louvres(x + 52, y + 36, 26, 54);
      warn(x + 174, y + 34, 7);
    }
    {
      const [x, y, w, h] = CELL.kend;
      g.fillStyle = '#c3c5c8'; g.fillRect(x, y, w, h);
      g.fillStyle = '#2f3034'; g.fillRect(x, y, w, 16); g.fillStyle = '#a2a5a9'; g.fillRect(x, y + h - 10, w, 10);
      louvres(x + 30, y + 40, 60, 60); louvres(x + 110, y + 40, 60, 60);
    }
    // ---- the old switch cabinets: five grey steel doors, rust, tags sprayed across them
    {
      const [x, y, w, h] = CELL.cab, r = rng(41);
      g.fillStyle = '#a7abb0'; g.fillRect(x, y, w, h);
      g.fillStyle = '#c9ccd0'; g.fillRect(x, y, w, 12);                        // the pale roof edge
      for (let d = 0; d < 5; d++) {
        const dx = x + 4 + d * (w - 8) / 5, dw = (w - 8) / 5 - 4;
        g.fillStyle = d % 2 ? '#9a9ea4' : '#a3a7ac'; g.fillRect(dx, y + 16, dw, h - 22);
        g.strokeStyle = '#7b7f85'; g.lineWidth = 1.5; g.strokeRect(dx, y + 16, dw, h - 22);
        if (d > 1) for (let q = y + 26; q < y + 52; q += 5) { g.fillStyle = '#7d8187'; g.fillRect(dx + 12, q, dw - 24, 2); }
        warn(dx + dw / 2, y + 66, 6);
      }
      for (let i = 0; i < 46; i++) { g.fillStyle = `rgba(${130 + r() * 40 | 0},${70 + r() * 30 | 0},${40 + r() * 20 | 0},${0.12 + r() * 0.22})`; g.fillRect(x + r() * w, y + 14 + r() * (h - 14), 3 + r() * 12, 4 + r() * 22); }
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const [col, ox] of [['#1d1d22', 8], ['#22222a', 250], ['#5a2a6a', 150]]) {
        g.strokeStyle = col; g.lineWidth = 3;
        let px = x + ox, py = y + 60 + r() * 30;
        g.beginPath(); g.moveTo(px, py);
        for (let q = 0; q < 12; q++) { px += 4 + r() * 12; py = y + 40 + r() * 70; g.lineTo(Math.min(x + w - 4, px), py); }
        g.stroke();
      }
    }
    // ---- the ticket machine: dark blue, a white P, the screen and the slot
    {
      const [x, y, w, h] = CELL.machine;
      g.fillStyle = '#1d2c4f'; g.fillRect(x, y, w, h);
      rr(x + 16, y + 10, 40, 40, 4, BLUE); text('P', x + 36, y + 31, 34, '#ffffff');
      rr(x + 12, y + 62, 48, 34, 3, '#9fb3c4'); rr(x + 12, y + 104, 48, 10, 2, '#0f1524'); rr(x + 22, y + 124, 28, 22, 3, '#c9ccd0');
    }
  }, false);
}

export function createKaluri(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;
  const CENTRE = F.at(36, 10);

  // ---- what the car feels, from the start: the islands and wheel stops are kerbs, the boxes are solid
  {
    const box = (P) => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [s, v] of P) { const [x, z] = F.at(s, v); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return { x0, z0, x1, z1 }; };
    for (const I of ISLANDS) world.addBump({ ...box(I.P), at(x, z) { const [s, v] = F.sv(x, z); return inside(I.P, s, v) ? KERB : 0; } });
    world.addBump({ ...box([[-12.4, 14.4], [-11.8, 20.6]]), at(x, z) { const [s, v] = F.sv(x, z); return Math.abs(s + 12.1) < 0.16 && STOPS.some((q) => Math.abs(v - q[1]) < 0.9) ? 0.11 : 0; } });
    world.addSolids(SOLIDS.map(([s, v, hx, hz, turn]) => { const [x, z] = F.at(s, v); return { x, z, yaw: F.YAW + turn, hx, hz }; }));
    world.addSolids([[-12.1, 14.15], [60, 21.85]].map(([s, v]) => { const [x, z] = F.at(s, v); return { x, z, yaw: 0, hx: 0.22, hz: 0.22 }; }));     // the sign posts
  }

  // (in steps, see ../jobs.js: each `yield` is a place to stop until the next frame)
  function* build() {
    built = true;
    const h = (x, z) => world.heightAt(x, z);
    const gy = (s, v) => { const [x, z] = F.at(s, v); return h(x, z); };
    const p = new Parts(), leafy = leafyPlants(group, shadows);

    // ---- textured ground: one mesh for each picture
    const layers = {};
    const layer = (name, map, tile, lift, order) => (layers[name] = { map, tile, lift, order, pos: [], uv: [] });
    layer('park', asphaltTex([158, 154, 168], 3, true), 6, 0.04, -3);
    yield;
    layer('lane', asphaltTex([108, 106, 120], 9, false), 5, 0.045, -3.5);
    yield;
    layer('patch', asphaltTex([138, 135, 149], 21, false), 5, 0.045, -3.5);
    yield;
    layer('cobble', cobbleTex(), 1.7, 0.05, -4);
    layer('red', paverTex([216, 150, 136], 5), 1.6, 0.05, -4);
    layer('paver', paverTex([206, 204, 216], 3), 1.6, 0.05, -4);
    layer('grass', lawnTex(), 4, 0, -4.5);
    layer('gravel', gravelTex(), 1.4, 0, -4.5);
    yield;
    const vert = (L, s, v, up) => { const [x, z] = F.at(s, v); L.pos.push(x, h(x, z) + L.lift + up, z); L.uv.push(s / L.tile, v / L.tile); };
    // a rectangle of the frame, in cells of about 2.2 m so that it follows the ground
    function strip(name, s0, s1, v0, v1, up = 0) {
      const L = layers[name], n = Math.max(1, Math.ceil((s1 - s0) / 2.2)), m = Math.max(1, Math.ceil((v1 - v0) / 2.2));
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
        const sa = s0 + (s1 - s0) * i / n, sb = s0 + (s1 - s0) * (i + 1) / n, va = v0 + (v1 - v0) * j / m, vb = v0 + (v1 - v0) * (j + 1) / m;
        for (const [s, v] of [[sa, va], [sa, vb], [sb, va], [sb, va], [sa, vb], [sb, vb]]) vert(L, s, v, up);
      }
    }
    // any outline, cut into triangles of about 2.2 m
    function fill(name, P, up = 0) {
      const L = layers[name];
      for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(P.map(([s, v]) => new THREE.Vector2(s, v)), [])) {
        const A = P[a], B = P[b], C = P[c];
        const n = Math.max(1, Math.ceil(Math.max(Math.hypot(B[0] - A[0], B[1] - A[1]), Math.hypot(C[0] - B[0], C[1] - B[1]), Math.hypot(A[0] - C[0], A[1] - C[1])) / 2.2));
        const Q = (i, j) => [A[0] + (B[0] - A[0]) * i / n + (C[0] - A[0]) * j / n, A[1] + (B[1] - A[1]) * i / n + (C[1] - A[1]) * j / n];
        for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) {
          for (const q of [Q(i, j), Q(i + 1, j), Q(i, j + 1)]) vert(L, q[0], q[1], up);
          if (j < n - i - 1) for (const q of [Q(i + 1, j), Q(i + 1, j + 1), Q(i, j + 1)]) vert(L, q[0], q[1], up);
        }
      }
    }

    // ---- flat colours: painted lines, kerb stones
    const flat = { pos: [], col: [] }, tint = new THREE.Color();
    const fpush = (pts, hex) => { tint.set(hex); for (const q of pts) { flat.pos.push(q[0], q[1], q[2]); flat.col.push(tint.r, tint.g, tint.b); } };
    const at3 = (s, v, up) => { const [x, z] = F.at(s, v); return [x, h(x, z) + up, z]; };
    // a painted line from (s0, v0) to (s1, v1), w wide
    function line(s0, v0, s1, v1, hex, w = 0.12, up = 0.065) {
      const len = Math.hypot(s1 - s0, v1 - v0), n = Math.max(1, Math.ceil(len / 2.4)), ns = -(v1 - v0) / len * w / 2, nv = (s1 - s0) / len * w / 2;
      for (let i = 0; i < n; i++) {
        const a = [s0 + (s1 - s0) * i / n, v0 + (v1 - v0) * i / n], b = [s0 + (s1 - s0) * (i + 1) / n, v0 + (v1 - v0) * (i + 1) / n];
        const q = [at3(a[0] + ns, a[1] + nv, up), at3(a[0] - ns, a[1] - nv, up), at3(b[0] + ns, b[1] + nv, up), at3(b[0] - ns, b[1] - nv, up)];
        fpush([q[0], q[1], q[2], q[2], q[1], q[3]], hex);
      }
    }
    const WHITE = 0xe6e3ea, CONC = 0xcbc8ce;
    // a kerbed island: the kerb stones round it, its top filled
    function island(I) {
      const P = I.P, In = inset(P, 0.14), N = P.length;
      for (let i = 0; i < N; i++) {
        const a = P[i], b = P[(i + 1) % N], c = In[(i + 1) % N], d = In[i];
        const A = at3(a[0], a[1], KERB + 0.01), B = at3(b[0], b[1], KERB + 0.01), C = at3(c[0], c[1], KERB + 0.01), D = at3(d[0], d[1], KERB + 0.01);
        const A0 = at3(a[0], a[1], -0.03), B0 = at3(b[0], b[1], -0.03);
        fpush([A, B, D, D, B, C], I.kerb);                              // the top of the stones
        fpush([A0, B0, A, A, B0, B], I.kerb === GREY_KERB ? 0xaeabb2 : 0xc19f2a);   // their face
      }
      fill(I.top, In, KERB - 0.015);
    }

    // ---------------- the lane
    strip('lane', LANE.s0, LANE.s1 + 6.5, LANE.v0, LANE.v1);
    strip('cobble', -10.5, LANE.s1, LANE.v1, COB.sw);
    strip('cobble', -11, LANE.s1, COB.ne, LANE.v0);
    for (const v of [LANE.v0, LANE.v1]) line(-11, v, LANE.s1, v, CONC, 0.16, 0.07);                // kerb lines of the lane
    line(-10.5, COB.sw, 75.4, COB.sw, CONC, 0.14, 0.07); line(-11, COB.ne, LANE.s1, COB.ne, CONC, 0.14, 0.07);
    strip('red', -11, 52, -5.1, COB.ne);                                                             // the red brick band
    strip('paver', -11, 52, -9.3, -5.1);                                                             // grey pavers to the building
    strip('paver', 52, LANE.s1, -8.6, COB.ne);                                                       // the paved corner at the AHHAA end
    // the zebra at the AHHAA end (bars along the lane) and the give-way teeth before it
    yield;
    for (const v of [-0.95, 0.1, 1.15, 2.2]) line(82.5, v, 85.9, v, WHITE, 0.5);
    for (const v of [-0.9, 0.0, 0.9, 1.8]) { const q = [at3(80.6, v - 0.3, 0.065), at3(80.6, v + 0.3, 0.065), at3(81.3, v, 0.065)]; fpush(q, WHITE); }

    // ---------------- the car park
    yield;
    strip('park', -16.8, 80.5, COB.sw, 21.3);
    strip('park', -16.8, -10.5, LANE.v1, COB.sw);
    strip('park', 41.4, 46.2, 21.3, 25.2);                                                           // the way in from the Circle K yard
    // patches of newer asphalt, as in the photos
    for (const [s0, s1, v0, v1] of [[28, 33.5, 10.2, 13.4], [9, 12, 9.4, 15.2], [55, 63, 11.5, 13.2], [66.5, 69, 9.2, 14.6], [-9, -4.5, 10.6, 12.4]]) strip('patch', s0, s1, v0, v1, 0.004);
    // bay lines
    for (const R of [ROW1, ROW2, ROW3]) for (let k = 0; k <= R.n; k++) line(R.s0 + R.pitch * k, R.v0, R.s0 + R.pitch * k, R.v1, WHITE);
    // the hatched box by the car wash door, behind the grass strip
    {
      const a = [3.2, 24.7], b = [16.6, 26.7];
      line(a[0], a[1], b[0], a[1], WHITE, 0.1); line(a[0], b[1], b[0], b[1], WHITE, 0.1); line(a[0], a[1], a[0], b[1], WHITE, 0.1); line(b[0], a[1], b[0], b[1], WHITE, 0.1);
      for (let s = a[0]; s < b[0] - 1.9; s += 1.6) line(s, b[1], s + 2, a[1], WHITE, 0.1);
    }
    for (const I of ISLANDS) { island(I); yield; }

    // ---------------- things standing on it
    yield;
    const quads = { pos: [], uv: [] };
    // an upright picture from (s0, v0) to (s1, v1), y0..y1 above gyv, showing an atlas cell (seen from the right going a -> b)
    function face(a, b, y0, y1, g, cell) {
      const [x, y, w, hh] = CELL[cell], u0 = x / 512, u1 = (x + w) / 512, t0 = 1 - (y + hh) / 512, t1 = 1 - y / 512;
      const A = F.at(...a), B = F.at(...b);
      const q = [[A[0], g + y0, A[1]], [B[0], g + y0, B[1]], [A[0], g + y1, A[1]], [B[0], g + y1, B[1]]], uv = [[u0, t0], [u1, t0], [u0, t1], [u1, t1]];
      for (const k of [0, 1, 2, 2, 1, 3]) { quads.pos.push(...q[k]); quads.uv.push(...uv[k]); }
    }
    const boxAt = (s, v, ls, lv, y0, y1, hex, g, turn = 0) => { const [x, z] = F.at(s, v); p.box(ls, y1 - y0, lv, hex, x, (g ?? h(x, z)) + (y0 + y1) / 2, z, F.YAW + turn); };

    // the old switch cabinets on their island at the Soola end, weeds round them
    {
      const g = gy(-6.55, 5.4) + KERB;
      boxAt(-6.55, 5.4, 5.6, 1.4, 0, 1.92, 0x9da1a6, g);
      boxAt(-6.55, 5.4, 5.8, 1.6, 1.92, 2.0, 0xc4c7cb, g);
      face([-3.75, 4.69], [-9.35, 4.69], 0, 1.92, g, 'cab');                       // to the lane
      face([-9.35, 6.11], [-3.75, 6.11], 0, 1.92, g, 'cab');                       // to the car park
      for (const [s, v, w, hh, t] of [[-9.2, 7.2, 1.5, 0.8, [0.7, 0.86, 0.6]], [-7.4, 7.4, 1.8, 0.9, [0.62, 0.8, 0.56]], [-5.4, 7.3, 1.6, 0.7, [0.74, 0.88, 0.6]], [-3.9, 7.1, 1.2, 0.6, [0.66, 0.8, 0.58]], [-9.6, 5.2, 1.0, 0.7, [0.9, 0.62, 0.5]]]) {
        const [x, z] = F.at(s, v);
        if (leafy.ok) leafy.bush(x, h(x, z) + KERB - 0.05, z, w, hh, s * 3, t);
      }
    }
    // the substation on its gravel bed: pale panels, a dark flat roof, louvred doors to the bays
    {
      const g = gy(-1.0, 22.7) + KERB;
      boxAt(-1.0, 22.7, 3.3, 2.5, 0, 2.3, 0xc0c2c5, g);
      boxAt(-1.0, 22.7, 3.5, 2.7, 2.3, 2.44, 0x2f3034, g);
      face([-2.65, 21.44], [0.65, 21.44], 0, 2.3, g, 'kiosk');
      face([0.65, 23.96], [-2.65, 23.96], 0, 2.3, g, 'kiosk');
      face([-2.66, 23.95], [-2.66, 21.45], 0, 2.3, g, 'kend');
      face([0.66, 21.45], [0.66, 23.95], 0, 2.3, g, 'kend');
    }
    // green steel skips: sloping sides, a ridged lid with two hatches
    yield;
    const skip = (() => {
      const L = 3.1, w0 = 1.3, w1 = 1.85, hb = 1.15, hr = 1.5, l0 = 2.3;          // length, bottom and top width, body and ridge height, bottom length
      const v = [[-l0 / 2, 0, -w0 / 2], [l0 / 2, 0, -w0 / 2], [l0 / 2, 0, w0 / 2], [-l0 / 2, 0, w0 / 2], [-L / 2, hb, -w1 / 2], [L / 2, hb, -w1 / 2], [L / 2, hb, w1 / 2], [-L / 2, hb, w1 / 2], [-L / 2 + 0.25, hr, 0], [L / 2 - 0.25, hr, 0]];
      const f = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 9, 8], [6, 7, 8, 9]], t = [[5, 6, 9], [7, 4, 8]];
      const pos = [];
      for (const [a, b, c, d] of f) for (const k of [a, c, b, a, d, c]) pos.push(...v[k]);
      for (const tr of t) for (const k of [tr[0], tr[2], tr[1]]) pos.push(...v[k]);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      return g;
    })();
    for (const [s, v, turn, up, hex] of [[-5.2, 23.2, 0.12, KERB, 0x2e8a57], [-8.9, 23.3, -0.1, KERB, 0x2a7f50], [48.6, 24.9, 0.5, 0, 0x2e8a57], [52.0, 25.4, 0.42, 0, 0x34935e]]) {
      const [x, z] = F.at(s, v), g = h(x, z) + up;
      p.add(skip, hex, x, g, z, F.YAW + turn);
      p.box(0.5, 0.36, 0.02, 0xd8452e, x + F.V[0] * -0.96, g + 0.75, z + F.V[1] * -0.96, F.YAW + turn);   // the red notice on its side
    }
    // wheel stops: sand-coloured concrete humps
    yield;
    const hump = new THREE.CylinderGeometry(0.15, 0.15, 1.75, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).scale(1, 0.85, 1);
    for (const [s, v] of STOPS) { const [x, z] = F.at(s, v); p.add(hump, 0xc9b27c, x, h(x, z) + 0.03, z, F.YAW + Math.PI / 2); }
    // the EUROPARK sign on its round concrete foot at the Soola end, another on the thin strip by McDonald's
    const pole = new THREE.CylinderGeometry(0.04, 0.04, 1, 8), foot = new THREE.SphereGeometry(0.34, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1);
    for (const [s, v, ds, dv, up] of [[-12.1, 14.15, -1, 0, 0], [60, 21.85, 0, 1, KERB]]) {
      const [x, z] = F.at(s, v), g = h(x, z) + up;
      p.add(pole.clone().scale(1, 3.3, 1), 0x9da0a6, x, g + 1.65, z);
      if (!up) p.add(foot, 0xb9b6b2, x, g, z);
      // the plates face (ds, dv): both ends of the plate 0.32 m either side of the post
      const a = [s - dv * 0.32 + ds * 0.05, v + ds * 0.32 + dv * 0.05], b = [s + dv * 0.32 + ds * 0.05, v - ds * 0.32 + dv * 0.05];
      face(a, b, 1.42, 3.4, g, 'euro');
    }
    // parking signs on the cobble strip, facing the car park
    for (const s of [11, 40.7, 66]) {
      const [x, z] = F.at(s, 3.1), g = h(x, z);
      p.add(pole.clone().scale(1, 2.9, 1), 0x9da0a6, x, g + 1.45, z);
      face([s + 0.24, 3.15], [s - 0.24, 3.15], 2.15, 2.9, g, 'psign');
    }
    // boulders and tall grass at the AHHAA end
    const rock = new THREE.IcosahedronGeometry(1, 1);
    for (const [s, v, r, hex] of [[76.9, 6.9, 0.55, 0x9a928c], [76.1, 6.4, 0.34, 0x8a8480], [82.4, 6.7, 0.6, 0x8f8a86], [83.6, 7.0, 0.36, 0xa39a92]]) {
      const [x, z] = F.at(s, v);
      p.add(rock.clone().scale(r * 1.2, r * 0.75, r), hex, x, h(x, z) + r * 0.35, z, s);
    }
    if (leafy.ok) for (const [s, v, w, hh] of [[76.9, 7.0, 1.3, 1.1], [76.3, 6.2, 0.9, 0.8]]) { const [x, z] = F.at(s, v); leafy.bush(x, h(x, z) + KERB - 0.05, z, w, hh, s, [0.82, 0.9, 0.56]); }

    // ---- bikes: a simple frame on two thin wheels, x along the bike
    yield;
    const bikeParts = (() => {
      const wheel = new THREE.TorusGeometry(0.33, 0.022, 4, 12), out = [];
      const bar = (x0, y0, x1, y1, t = 0.035) => { const l = Math.hypot(x1 - x0, y1 - y0); return new THREE.BoxGeometry(l, t, t).rotateZ(Math.atan2(y1 - y0, x1 - x0)).translate((x0 + x1) / 2, (y0 + y1) / 2, 0); };
      out.push([wheel.clone().translate(-0.52, 0.35, 0), 0], [wheel.clone().translate(0.52, 0.35, 0), 0]);
      for (const q of [[-0.52, 0.35, -0.12, 0.85], [-0.12, 0.85, 0.42, 0.88], [-0.12, 0.85, 0.02, 0.36], [0.02, 0.36, 0.42, 0.88], [-0.52, 0.35, 0.02, 0.36], [0.52, 0.35, 0.4, 1.02]]) out.push([bar(...q), 1]);
      out.push([new THREE.BoxGeometry(0.22, 0.05, 0.12).translate(-0.14, 0.93, 0), 0], [new THREE.BoxGeometry(0.04, 0.04, 0.5).translate(0.4, 1.04, 0), 0]);
      return out;
    })();
    const bike = (s, v, yaw, hex, lean = 0) => {
      const [x, z] = F.at(s, v), g = h(x, z) + 0.05;
      for (const [geo, painted] of bikeParts) p.add(lean ? geo.clone().rotateX(lean) : geo, painted ? hex : 0x1b1c20, x, g, z, yaw);
    };
    // the rack by Kaluri 2's Soola corner
    const BIKES = [0x8a2f2a, 0x2f5f8a, 0xd9d6cf, 0x2a2b30, 0x3a7a55, 0xb87f2a, 0x55585e, 0x7a3a6a];
    yield;
    for (let k = 0; k < 8; k++) bike(-8.6 + k * 0.72, -6.4 + (k % 2) * 0.12, F.YAW + Math.PI / 2 + (k % 3 - 1) * 0.08, BIKES[k], (k % 2 ? 1 : -1) * 0.1);
    for (let k = 0; k < 5; k++) { boxAt(-8.6 + k * 1.44 + 0.36, -6.95, 0.05, 0.05, 0, 0.8, 0x8d9096); }
    boxAt(-5.36, -6.95, 6.2, 0.05, 0.76, 0.81, 0x8d9096);
    // the bike share dock at the AHHAA end: a low dark rail, white and blue bikes nose in
    yield;
    boxAt(64, -6.9, 8.4, 0.3, 0, 0.12, 0x2b2d31);
    for (let k = 0; k < 9; k++) {
      boxAt(60.2 + k * 0.95, -6.9, 0.12, 0.2, 0.12, 0.85, 0x33363b);
      if (k % 4 !== 3) bike(60.2 + k * 0.95 + 0.3, -6.1, F.YAW + Math.PI / 2, k % 2 ? 0x2f6fb5 : 0xe6e8ec);
    }
    // rental scooters in a row, teal
    for (let k = 0; k < 9; k++) {
      const s = 69.6 + k * 0.5, v = -6.5 - (k % 2) * 0.1, g = gy(s, v) + 0.05;
      boxAt(s, v, 0.16, 0.95, 0.08, 0.14, 0x1f2226, g);
      boxAt(s, v + 0.4, 0.05, 0.05, 0.1, 1.12, 0x35c9ae, g);
      boxAt(s, v + 0.4, 0.46, 0.05, 1.1, 1.15, 0x1f2226, g);
    }
    // the ticket machine and the information pylon beside it
    {
      const g = gy(57.4, -5.7) + 0.05;
      boxAt(57.4, -5.7, 0.55, 0.36, 0, 1.62, 0x1d2c4f, g);
      face([57.68, -5.51], [57.12, -5.51], 0.0, 1.62, g, 'machine');
      boxAt(58.7, -6.3, 0.7, 0.22, 0, 2.3, 0x383b40, g);
      boxAt(58.7, -6.18, 0.56, 0.02, 0.9, 2.1, 0xd9dce0, g);
    }

    // ---------------- into the scene
    yield;
    const upNormals = (n) => { const a = new Float32Array(n); for (let k = 1; k < n; k += 3) a[k] = 1; return new THREE.BufferAttribute(a, 3); };
    for (const L of Object.values(layers)) {
      if (!L.pos.length) continue;
      // every triangle wound to face up (the outlines come either way round)
      for (let t = 0; t < L.pos.length; t += 9) {
        const P = L.pos, ny = (P[t + 5] - P[t + 2]) * (P[t + 6] - P[t]) - (P[t + 3] - P[t]) * (P[t + 8] - P[t + 2]);
        if (ny >= 0) continue;
        for (let k = 0; k < 3; k++) { const q = P[t + 3 + k]; P[t + 3 + k] = P[t + 6 + k]; P[t + 6 + k] = q; }
        const u = t / 9 * 6;
        for (let k = 0; k < 2; k++) { const q = L.uv[u + 2 + k]; L.uv[u + 2 + k] = L.uv[u + 4 + k]; L.uv[u + 4 + k] = q; }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(L.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(L.uv, 2));
      g.setAttribute('normal', upNormals(L.pos.length));
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: L.map, polygonOffset: true, polygonOffsetFactor: L.order, polygonOffsetUnits: L.order, side: THREE.DoubleSide }));
      m.receiveShadow = true; group.add(m);
    }
    yield;
    {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(flat.pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(flat.col, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, side: THREE.DoubleSide }));
      m.receiveShadow = true; group.add(m);
    }
    {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(quads.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(quads.uv, 2));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, greyBack(new THREE.MeshLambertMaterial({ map: atlasTex() })));
      group.add(m);
    }
    yield;
    leafy.finish();
    const m = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    if (m) { m.castShadow = shadows; m.receiveShadow = true; group.add(m); }
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 380) return;
      if ([F.at(-10, 10), F.at(40, 0), F.at(80, 15), F.at(30, 40)].every((q) => world.ready(q[0], q[1]))) { built = true; jobs.add(build, 'kaluri'); }
    },
  };
}
