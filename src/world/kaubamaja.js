// Tartu Kaubamaja, built by hand in place of the LOD2 box (Martin, 18 Nov, from his street views of
// 2023-24 and the Land Board's oblique photos):
//   - the big flat roof on slender round white columns all the way round, its white edge band with the
//     orange circle "lace" at the corners and the "tartu kaubamaja" letters on every side
//   - the grey stone body set back under the roof: glass strips, the black K ring on the Riia and park
//     faces, posters, orange board cladding over glazed corners, the black strip with gold circles on Vabaduse
//   - the entrance canopies on Riia and Küüni, the orange terrace wall and ramp on the Riia side, roof plant
//   - low platform benches on the plaza by the car park, the lime trees and steel railing of the Riia median
// Frame: a runs from the west corner along the Küüni face, b from the west corner along the park face.
import * as THREE from 'three';
import { Parts, BOX } from '../race/landmarks.js';
import { realTreeKit } from './scenery.js';
import { paintScale } from './paintscale.js';
import { medianShift } from './keskustee.js';
import { jobs } from '../jobs.js';
import { posterPlane } from './adverts.js';
import { winbaumLot } from './winbaum.js';

const O = [1659.6, 3088.7];                              // west corner of the roof (game x, z)
const UA = [0.6943, 0.7197], UB = [0.7189, -0.6951];     // along Küüni (to the south corner), along the park face (to the north corner)
const LA = 78.1, LB = 105.2, INSET = 4.5;                // roof size, how far the body stands back
const TOP = 22.2, BAND = 19.9;                           // roof top and the underside of its edge band (world y)
const CENTRE = [1724, 3080];
const COL = {
  white: 0xf6f5f2, soffit: 0xdcdbe2, roof: 0x4a4a58, stone: 0xd6d5da, plant: 0xc9cad2, orange: 0xf08a5c, orangeDark: 0xf5a070,
  wood: 0xc79a6a, steel: 0xb9bcc6, dark: 0x3a3d48, paving: 0xcfc9cf,
};
const at = (a, b) => [O[0] + UA[0] * a + UB[0] * b, O[1] + UA[1] * a + UB[1] * b];

// the four sides, each seen from outside: p0 is the left end at the roof edge, d runs to the right, n points out
const SIDES = {
  kuuni: { p0: at(0, 0), d: UA, n: [-UB[0], -UB[1]], len: LA },
  riia: { p0: at(LA, 0), d: UB, n: UA, len: LB },
  vabaduse: { p0: at(LA, LB), d: [-UA[0], -UA[1]], n: UB, len: LA },
  park: { p0: at(0, LB), d: [-UB[0], -UB[1]], n: [-UA[0], -UA[1]], len: LB },
};
for (const S of Object.values(SIDES)) {
  S.yaw = Math.atan2(-S.d[1], S.d[0]);
  S.at = (s, out = 0) => [S.p0[0] + S.d[0] * s + S.n[0] * out, S.p0[1] + S.d[1] * s + S.n[1] * out];
}

// the map's box is hidden: the colour survey lists it three times over
export function kaubamajaWalls(walls) {
  if (!walls || !walls.sectors) return;
  const a = walls.sectors['3_6'] || [], extra = ((walls.extra ||= {})['3_6'] ||= {});
  for (let i = 0; i < a.length; i += 4) {
    const x = 1120 + a[i + 1] * 0.1, z = 3040 + a[i + 2] * 0.1;
    if (a[i] === 30 && Math.hypot(x - CENTRE[0], z - CENTRE[1]) < 70) extra[i / 4] = { ...extra[i / 4], hide: true, reach: 95 };
  }
}

function rnd(seed) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// a canvas painted in metres: s along the wall, y up from y0
export function painter(len, y0, y1, ppm) {
  const c = document.createElement('canvas');
  ppm *= paintScale();
  c.width = Math.min(4096, Math.max(4, Math.round(len * ppm))); c.height = Math.max(4, Math.round((y1 - y0) * ppm));
  const g = c.getContext('2d'), kx = c.width / len, ky = c.height / (y1 - y0);
  const X = (s) => s * kx, Y = (y) => (y1 - y) * ky;
  const P = {
    g, kx, ky, X, Y,
    rect(s0, s1, a, b, fill) { g.fillStyle = fill; g.fillRect(X(s0), Y(b), (s1 - s0) * kx, (b - a) * ky); },
    // glazing with mullions every `mx` m and rails every `my` m
    glass(s0, s1, a, b, fill = '#5b6b86', mx = 1.5, my = 1.9, line = '#aeb6c8') {
      P.rect(s0, s1, a, b, fill);
      const sh = g.createLinearGradient(0, Y(b), 0, Y(a));
      sh.addColorStop(0, 'rgba(190,170,230,0.30)'); sh.addColorStop(1, 'rgba(20,24,40,0.25)');
      g.fillStyle = sh; g.fillRect(X(s0), Y(b), (s1 - s0) * kx, (b - a) * ky);
      for (let s = s0; s <= s1 + 0.01; s += mx) P.rect(s - 0.04, s + 0.04, a, b, line);
      for (let y = a; y <= b + 0.01; y += my) P.rect(s0, s1, y - 0.04, y + 0.04, line);
    },
    // horizontal boards
    boards(s0, s1, a, b, fill, line, step = 0.28) {
      P.rect(s0, s1, a, b, fill);
      for (let y = a; y < b; y += step) P.rect(s0, s1, y, y + 0.03, line);
      for (let s = s0 + 2.4; s < s1; s += 2.4) P.rect(s - 0.02, s + 0.02, a, b, line);
    },
    disc(s, y, r, fill) { g.fillStyle = fill; g.beginPath(); g.ellipse(X(s), Y(y), r * kx, r * ky, 0, 0, 6.2832); g.fill(); },
    ring(s, y, r, w, stroke) { g.strokeStyle = stroke; g.lineWidth = w * ky; g.beginPath(); g.ellipse(X(s), Y(y), r * kx, r * ky, 0, 0, 6.2832); g.stroke(); },
    line(pts, w, stroke) { g.strokeStyle = stroke; g.lineWidth = w * ky; g.lineCap = 'butt'; g.beginPath(); pts.forEach(([s, y], k) => (k ? g.lineTo(X(s), Y(y)) : g.moveTo(X(s), Y(y)))); g.stroke(); },
    text(str, s, y, h, fill, font = '600', align = 'center') {
      g.save(); g.translate(X(s), Y(y)); g.scale(kx / ky, 1);
      g.fillStyle = fill; g.font = `${font} ${h * ky}px "Helvetica Neue", Arial, sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
      g.fillText(str, 0, 0); g.restore();
    },
    // upright text reading bottom to top
    vtext(str, s, y, h, fill, font = '600') {
      g.save(); g.translate(X(s), Y(y)); g.rotate(-Math.PI / 2);
      g.fillStyle = fill; g.font = `${font} ${h * ky}px "Helvetica Neue", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(str, 0, 0); g.restore();
    },
    texture() {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      return t;
    },
  };
  return P;
}

// grey stone panels with faint joints
function stone(P, len, a, b) {
  P.rect(0, len, a, b, '#e2e1e6');
  const r = rnd(5);
  for (let s = 0; s < len; s += 1.2) for (let y = a; y < b; y += 0.6) { const v = r(); if (v < 0.3) P.rect(s, s + 1.2, y, y + 0.6, v < 0.15 ? 'rgba(255,255,255,0.10)' : 'rgba(90,90,120,0.07)'); }
  for (let s = 0; s < len; s += 1.2) P.rect(s, s + 0.025, a, b, 'rgba(120,120,140,0.35)');
  for (let y = a; y < b; y += 0.6) P.rect(0, len, y, y + 0.02, 'rgba(120,120,140,0.3)');
}
// the K mark: a thick ring cut by a bar, the two arms of the K inside it
function kMark(P, s, y, R) {
  P.ring(s, y, R, R * 0.13, '#1c1c22');
  P.line([[s - R * 0.28, y - R * 1.02], [s - R * 0.28, y + R * 1.02]], R * 0.16 * P.kx / P.ky, '#1c1c22');
  P.line([[s + R * 0.62, y + R * 0.74], [s - R * 0.2, y], [s + R * 0.62, y - R * 0.74]], R * 0.15, '#1c1c22');
}
const poster = (P, s0, s1, a, b, top, bottom, word) => {
  const gr = P.g.createLinearGradient(0, P.Y(b), 0, P.Y(a));
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  P.g.fillStyle = gr; P.g.fillRect(P.X(s0), P.Y(b), (s1 - s0) * P.kx, (b - a) * P.ky);
  P.disc((s0 + s1) / 2, a + (b - a) * 0.62, (s1 - s0) * 0.22, 'rgba(255,236,220,0.85)');
  if (word) P.text(word, (s0 + s1) / 2, a + (b - a) * 0.16, (s1 - s0) * 0.16, '#ffffff', '700');
};
// a glazed ground floor that follows the ground: shop windows, a white slab line above
function shopfront(P, s0, s1, gy, h = 4.2, fill = '#4c5670') {
  for (let s = s0; s < s1; s += 1.2) {
    const e = Math.min(s1, s + 1.2), y = gy((s + e) / 2);
    P.rect(s, e, y - 1, y + h, fill);
    P.rect(s, e, y + h * 0.45, y + h, 'rgba(200,170,235,0.16)');
    P.rect(s, e, y + h - 0.9, y + h - 0.82, '#aeb6c8');
    P.rect(s, e, y - 1, y + 0.25, '#8f8f9c');
    P.rect(s, e, y + h, y + h + 0.3, '#f4f3f6');
    if (Math.round(s / 1.2) % 2 === 0) P.rect(s - 0.035, s + 0.035, y, y + h, '#aeb6c8');
  }
}
const ORANGE = '#f6a07a', ORANGE_LINE = '#e58a62';
// where the TOREPOOD poster hangs on the Küüni face, by the lap start: s0..s1 along the body wall, a..b over
// the ground at its middle (416 x 592, so 6.6 m by 9.4 m)
const KUUNI_POSTER = [0.35, 6.95, 5.2, 14.6];

// ---- the four body faces. s runs along the body wall (the roof edge side less the inset), gy(s) is the ground there
const FACES = {
  kuuni(P, len, gy) {
    stone(P, len, 0, 20);
    shopfront(P, 0, 12, gy, 3.6, '#59607a');
    // the TOREPOOD poster hangs here (Martin, 25 Nov: in place of the red SUUR banner): its own small plane
    // with the bus stops' advert atlas (KUUNI_POSTER), only a thin white frame is painted on the wall behind it
    { const [s0, s1, a, b] = KUUNI_POSTER, y = gy((s0 + s1) / 2); P.rect(s0 - 0.18, s1 + 0.18, y + a - 0.18, y + b + 0.18, '#f7f6fa'); }
    P.glass(12, 22, gy(17) - 1, 19.4, '#4f5d7c', 1.25, 1.9);                    // the main entrance: glass to the roof
    P.rect(13.5, 20.5, gy(17), gy(17) + 2.7, '#2d3344');
    for (const s of [15.25, 17, 18.75]) P.rect(s - 0.05, s + 0.05, gy(17), gy(17) + 2.7, '#c9cfdd');
    shopfront(P, 22, 46, gy, 4.0);
    P.glass(22.5, 45.5, gy(34) + 5.1, gy(34) + 6.3, '#7f8ca6', 1.9, 9);         // the café terrace's glass rail
    P.glass(24, 44, gy(34) + 9.6, gy(34) + 11.2, '#56637f', 2, 9);
    P.boards(46, len, gy(58) + 4.4, 19.6, ORANGE, ORANGE_LINE);
    P.rect(52, 60, gy(58) + 10.5, gy(58) + 12.3, '#e58a62');
    shopfront(P, 46, len, gy, 4.2, '#46506a');
  },
  riia(P, len, gy) {
    stone(P, len, 0, 20);
    shopfront(P, 0, 10, gy, 4.2, '#46506a');
    P.boards(0, 10, gy(5) + 4.5, 19.6, ORANGE, ORANGE_LINE);
    shopfront(P, 10, 52, gy, 4.0);
    P.glass(11, 22, gy(16) + 9.4, gy(16) + 11, '#56637f', 2, 9);
    P.glass(24, 40, gy(32) - 1, 19.4, '#4f5d7c', 1.33, 1.9);                    // the Riia entrance under the canopy
    P.rect(27, 37, gy(32), gy(32) + 2.8, '#2d3344');
    for (let s = 28.25; s < 37; s += 1.25) P.rect(s - 0.05, s + 0.05, gy(32), gy(32) + 2.8, '#c9cfdd');
    P.glass(41.5, 50.5, gy(46) + 9.4, gy(46) + 11, '#56637f', 2, 9);
    kMark(P, 62, 11.6, 6.6);
    P.glass(72, 74.2, gy(73) + 0.3, 19.2, '#4f5d7c', 1.1, 1.9);
    shopfront(P, 52, 86, gy, 3.4, '#565f78');
    poster(P, 79.5, 85.5, 7.2, 17, '#c2334a', '#e8707c', 'BALLETT');
    P.boards(86, len, gy(91) + 4.5, 19.6, ORANGE, ORANGE_LINE);
    shopfront(P, 86, len, gy, 4.2, '#46506a');
  },
  vabaduse(P, len, gy) {
    stone(P, len, 0, 20);
    P.boards(0, 11, gy(5) + 4.5, 19.6, ORANGE, ORANGE_LINE);
    shopfront(P, 0, 11, gy, 4.2, '#46506a');
    P.rect(11.6, 13.8, gy(12) + 5, gy(12) + 14, '#f2d24a');                     // the tall yellow banner
    // the black strip with gold circles along the pavement
    const r = rnd(9);
    for (let s = 16; s < len - 1; s += 1.2) P.rect(s, Math.min(len - 1, s + 1.2), gy(s) - 1, gy(s) + 3.1, '#26262e');
    for (let s = 17; s < len - 2; s += 0.9 + r() * 1.6) {
      const rad = 0.25 + r() * 0.75, y = gy(s) + 0.6 + r() * 1.8;
      if (r() < 0.5) P.disc(s, y, rad, '#d9b25a'); else P.ring(s, y, rad, 0.14, '#d9b25a');
    }
    poster(P, 22, 29, gy(25) + 4.6, gy(25) + 13.6, '#3d8fd0', '#9fd3ee', '');
    P.glass(16, 60, 15.6, 16.7, '#56637f', 2.2, 9);
    P.rect(40, 42.2, gy(41) + 6.5, gy(41) + 8.6, '#eeeef2');
  },
  park(P, len, gy) {
    stone(P, len, 0, 20);
    P.glass(8, 11, gy(9) + 0.3, 19.2, '#4f5d7c', 1.5, 1.9);
    kMark(P, 24, 11.4, 6.6);
    P.rect(38, 47, gy(42) - 1, gy(42) + 3.4, '#22232b');                       // the way into the car park
    P.rect(38, 47, gy(42) + 3.4, gy(42) + 3.9, '#f08a5c');
    P.glass(34, 60, 15.6, 16.7, '#56637f', 2.2, 9);
    P.glass(50, 58, gy(54) + 9.4, gy(54) + 11, '#56637f', 2, 9);
    P.glass(60, 72, gy(66) - 1, 19.4, '#4f5d7c', 1.33, 1.9);
    P.rect(63, 69, gy(66), gy(66) + 2.7, '#2d3344');
    shopfront(P, 72, 86, gy, 3.8);
    poster(P, 76, 81.5, gy(78) + 6, gy(78) + 15, '#d9434f', '#f08a8f', '%');
    P.boards(86, len, gy(91) + 4.4, 19.6, ORANGE, ORANGE_LINE);
    shopfront(P, 86, len, gy, 4.2, '#46506a');
  },
};

// the roof's edge band: white tiles, the orange circle lace towards both corners, the letters
function bandTexture(len, lettersAt, seed) {
  const P = painter(len, 0, 2.3, 4096 / len);
  P.rect(0, len, 0, 2.3, '#fbfaf8');
  for (let s = 0; s < len; s += 0.6) P.rect(s, s + 0.02, 0, 2.3, 'rgba(150,150,170,0.28)');
  P.rect(0, len, 1.14, 1.16, 'rgba(150,150,170,0.28)');
  const r = rnd(seed), lace = (s0, dir) => {
    for (let k = 0; k < 34; k++) {
      const u = r() ** 1.5, s = s0 + dir * u * 17, rad = 0.38 + r() * 0.62 * (1 - u * 0.5), y = 0.2 + r() * 1.9;
      const v = r();
      if (v < 0.45) P.disc(s, y, rad, '#f39468');
      else if (v < 0.8) { P.disc(s, y, rad, '#f39468'); P.disc(s + (r() - 0.5) * rad * 0.5, y + (r() - 0.5) * rad * 0.5, rad * 0.58, '#fbfaf8'); }
      else P.ring(s, y, rad, 0.16, '#f39468');
    }
  };
  lace(0, 1); lace(len, -1);
  P.rect(lettersAt - 11, lettersAt + 11, 0.05, 2.25, '#fbfaf8');
  P.text('tartu', lettersAt - 7.1, 1.2, 2.0, '#dc5a2c', '500');
  P.text('kaubamaja', lettersAt + 3.3, 1.2, 2.0, '#dc5a2c', '800');
  return P.texture();
}

export function createKaubamaja(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function* build() {
    built = true;
    const p = new Parts(), solids = [];
    const h = (x, z) => world.heightAt(x, z);
    const box = (q, w, hh, d, hex, y, yaw) => p.box(w, hh, d, hex, q[0], y, q[1], yaw);
    // a box given in the a/b frame: a0..a1, b0..b1, y0..y1
    const slab = (a0, a1, b0, b1, y0, y1, hex) => box(at((a0 + a1) / 2, (b0 + b1) / 2), a1 - a0, y1 - y0, b1 - b0, hex, (y0 + y1) / 2, SIDES.kuuni.yaw);
    const plane = (S, s0, s1, y0, y1, out, tex) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s1 - s0, y1 - y0), new THREE.MeshLambertMaterial({ map: tex }));
      const [x, z] = S.at((s0 + s1) / 2, out);
      m.position.set(x, (y0 + y1) / 2, z);
      m.rotation.y = S.yaw;
      m.receiveShadow = true;
      group.add(m);
    };

    // ---- roof, soffit, body, plant on the roof
    slab(0, LA, 0, LB, BAND + 0.12, TOP, COL.roof);
    slab(0.05, LA - 0.05, 0.05, LB - 0.05, BAND, BAND + 0.12, COL.soffit);
    slab(INSET, LA - INSET, INSET, LB - INSET, -1.5, BAND, COL.stone);
    slab(8, 26, 14, 44, TOP, TOP + 1.9, COL.plant);
    slab(26, 50, 22, 80, TOP, TOP + 5.6, COL.plant);
    slab(50, 62, 30, 62, TOP, TOP + 1.8, COL.plant);
    slab(12, 24, 78, 96, TOP, TOP + 1.3, COL.plant);
    slab(37, 39, 30, 72, TOP + 5.6, TOP + 5.9, 0x6f86a8);                           // the skylight strip

    // ---- the colonnade: round columns just inside the roof edge
    yield;
    const column = new THREE.CylinderGeometry(0.4, 0.4, 1, 14);
    const colAt = (a, b) => {
      const [x, z] = at(a, b), y0 = h(x, z) - 0.4;
      const g = column.clone().scale(1, BAND - y0, 1);
      p.add(g, COL.white, x, (y0 + BAND) / 2, z);
      solids.push({ x, z, yaw: 0, hx: 0.4, hz: 0.4 });
    };
    const E = 0.75;
    for (let k = 0; k <= 12; k++) { const b = E + (LB - 2 * E) * k / 12; colAt(E, b); colAt(LA - E, b); }
    for (let k = 1; k < 9; k++) { const a = E + (LA - 2 * E) * k / 9; colAt(a, E); colAt(a, LB - E); }

    // ---- edge band and body faces
    yield;
    const letters = { kuuni: 27, riia: 43, vabaduse: 50, park: 22 };
    let seed = 3;
    for (const [name, S] of Object.entries(SIDES)) {
      plane(S, -0.06, S.len + 0.06, BAND, TOP + 0.1, 0.06, bandTexture(S.len + 0.12, letters[name], seed++));
      const len = S.len - 2 * INSET;
      const gy = (s) => { const [x, z] = S.at(INSET + s, 0.5); return h(x, z); };
      const P = painter(len, 0, 20, Math.min(22, 4096 / len));
      FACES[name](P, len, gy);
      plane(S, INSET, S.len - INSET, 0, 20, -INSET + 0.07, P.texture());
      yield;
    }
    // the TOREPOOD poster on the Küüni face: the poster's corner of the shared advert atlas, no texture of its
    // own; clicking it opens the shop like the ones in the bus shelters
    {
      const S = SIDES.kuuni, [s0, s1, a, b] = KUUNI_POSTER;
      const [gx, gz] = S.at(INSET + (s0 + s1) / 2, 0.5), y = h(gx, gz);
      const m = posterPlane(s1 - s0, b - a);
      const [x, z] = S.at(INSET + (s0 + s1) / 2, -INSET + 0.12);
      m.position.set(x, y + (a + b) / 2, z);
      m.rotation.y = S.yaw;
      group.add(m);
    }

    // ---- Riia side: entrance canopy, the paved terrace behind its orange wall, the orange ramp down to the pavement
    yield;
    {
      const S = SIDES.riia, gy = (s, out = 0.5) => { const [x, z] = S.at(s, out); return h(x, z); };
      const fl = gy(INSET + 32);                                                     // floor level at the doors
      const along = (s0, s1, o0, o1, y0, y1, hex) => box(S.at((s0 + s1) / 2, (o0 + o1) / 2), s1 - s0, y1 - y0, o1 - o0, hex, (y0 + y1) / 2, S.yaw);
      along(INSET + 21, INSET + 43, -INSET, 2.2, fl + 4.5, fl + 5.0, COL.white);    // canopy
      for (const s of [INSET + 22, INSET + 29, INSET + 35.5, INSET + 42]) along(s - 0.18, s + 0.18, 1.6, 1.96, fl - 1, fl + 4.5, COL.white);
      along(INSET + 44, LB - 7, -INSET, 1.6, fl - 4, fl + 0.02, COL.paving);         // terrace
      along(INSET + 44, LB - 7, 1.6, 2.0, fl - 4, fl + 0.95, COL.orange);            // its orange wall
      along(LB - 7, LB - 6.6, -INSET, 2.0, fl - 4, fl + 0.95, COL.orange);
      // the ramp: a sloping orange-walled walk outside the terrace
      const s0 = INSET + 50, s1 = LB - 12, y1 = gy(s1, 4.5), run = s1 - s0, tilt = Math.atan2(fl - y1, run);
      const [rx, rz] = S.at((s0 + s1) / 2, 3.4);
      const deck = BOX(Math.hypot(run, fl - y1), 0.3, 2.6); deck.rotateZ(tilt);
      p.add(deck, COL.paving, rx, (fl + y1) / 2 - 0.15, rz, S.yaw);
      const [wx, wz] = S.at((s0 + s1) / 2, 4.85);
      const wall = BOX(Math.hypot(run, fl - y1), 1.5, 0.3); wall.rotateZ(tilt);
      p.add(wall, COL.orangeDark, wx, (fl + y1) / 2 + 0.1, wz, S.yaw);
      solids.push({ x: wx, z: wz, yaw: S.yaw, hx: run / 2, hz: 0.25 });
      along(s0 - 6, s0, 2.0, 5.0, fl - 4, fl + 0.02, COL.paving);                    // the landing at its top
    }
    // ---- Küüni side: the entrance canopy; platform benches on the plaza
    yield;
    {
      const S = SIDES.kuuni, gy = (s) => { const [x, z] = S.at(s, 0.5); return h(x, z); };
      const fl = gy(INSET + 17);
      box(S.at(INSET + 17, -INSET + 1.6), 11, 0.35, 3.2, COL.white, fl + 3.3, S.yaw);
      // low platform benches on the plaza by the car park, as on the orthophoto and Street View: off the racing
      // line of the last corner (Martin, 19 Nov), each (a, b) in the roof frame: a along Küüni, b along the park face
      for (const [a, b] of [[-21, 1.5], [-25.5, -1], [-28.5, 3.5], [-32.5, 0], [-36.5, 3.2]]) {
        const [x, z] = at(a, b), y = h(x, z), yaw = SIDES.kuuni.yaw;
        if (winbaumLot(x, z, 2.2, 2)) continue;            // (room for the Winbaum cabin, ?winbaum=1)
        p.box(3.8, 0.1, 1.7, COL.wood, x, y + 0.42, z, yaw);
        p.box(3.5, 0.38, 1.45, 0x55525e, x, y + 0.18, z, yaw);
        solids.push({ x, z, yaw, hx: 1.9, hz: 0.85 });
      }
    }

    // ---- the Riia median: a steel railing along its Kaubamaja edge and a row of young limes
    yield;
    {
      // the median's line bends 1.65 m out at the Küüni end to meet the median past the crossing (medianShift)
      const S = SIDES.riia, OUT = 18.9, list = [], M = (s, o) => S.at(s, o + medianShift(s));
      const s0 = 6, s1 = LB - 5, n = Math.round((s1 - s0) / 2.5), posts = [];
      for (let k = 0; k <= n; k++) {
        const s = s0 + (s1 - s0) * k / n, [x, z] = M(s, OUT - 1.1), y = h(x, z);
        p.box(0.07, 1.05, 0.07, COL.steel, x, y + 0.52, z, S.yaw);
        posts.push([x, y, z]);
      }
      // the rails from post to post, so they follow the ground and the bend
      for (let k = 0; k < n; k++) {
        const [xa, ya, za] = posts[k], [xb, yb, zb] = posts[k + 1], l = Math.hypot(xb - xa, zb - za);
        for (const yy of [0.55, 1.02]) {
          const rail = BOX(Math.hypot(l, yb - ya), 0.06, 0.06); rail.rotateZ(Math.atan2(yb - ya, l));
          p.add(rail, COL.steel, (xa + xb) / 2, (ya + yb) / 2 + yy, (za + zb) / 2, Math.atan2(-(zb - za), xb - xa));
        }
        if (k % 4 === 0) { const e = posts[Math.min(n, k + 4)], m = posts[k]; solids.push({ x: (m[0] + e[0]) / 2, z: (m[2] + e[2]) / 2, yaw: S.yaw, hx: Math.hypot(e[0] - m[0], e[2] - m[2]) / 2 + 0.05, hz: 0.12 }); }
      }
      const r = rnd(17);
      for (let s = 9; s < LB - 6; s += 6.7) { const t = s + r() * 0.8; list.push([...M(t, OUT + 0.3), 6.2 + r() * 1.8, 0.55 + r() * 0.16, r()]); }
      // black plastic guards round the young trunks (Street View 2023/2024)
      const guard = new THREE.CylinderGeometry(0.17, 0.26, 0.85, 7);
      for (const [x, z] of list) p.add(guard, 0x1d1e21, x, h(x, z) + 0.42, z);
      const kit = realTreeKit(), sp = kit && kit.species && kit.species[0];
      if (sp && sp.near) {
        const im = new THREE.InstancedMesh(sp.near, sp.soloMat, list.length);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
        list.forEach(([x, z, hh, w, t], k) => {
          m.compose(new THREE.Vector3(x, h(x, z) - 0.05, z), q.setFromAxisAngle(up, t * 6.283), new THREE.Vector3(hh * w, hh, hh * w));
          im.setMatrixAt(k, m);
          im.setColorAt(k, col.setRGB(0.95 + t * 0.1, 0.92 + t * 0.1, 0.8 + t * 0.12));
        });
        im.castShadow = shadows; im.frustumCulled = false;
        group.add(im);
      } else for (const [x, z, hh] of list) {
        p.add(new THREE.CylinderGeometry(0.08, 0.12, hh * 0.5, 6), 0x6b5444, x, h(x, z) + hh * 0.25, z);
        p.add(new THREE.IcosahedronGeometry(hh * 0.3, 1), 0x7fbf6a, x, h(x, z) + hh * 0.68, z);
      }
    }

    yield;
    const mesh = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    if (mesh) { mesh.castShadow = shadows; mesh.receiveShadow = true; group.add(mesh); }
    world.addSolids(solids);
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 900) return;
      if ([at(0, 0), at(LA, 0), at(LA, LB), at(0, LB), SIDES.riia.at(50, 18)].every((q) => world.ready(q[0], q[1]))) { built = true; jobs.add(build, 'kaubamaja'); }
    },
  };
}
