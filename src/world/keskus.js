// The Riia / Turu junction, the middle of town, dressed by hand (Martin, 18 Nov, from his street views and
// the Land Board's oblique photos). The map's blocks stay as the masses; in front of them stand painted faces:
//   - Kvartal: bays of brick, white render and dark timber over two glazed shop floors, the dark glass top
//     floor, "Tartu südames" banners, the black canopy along Riia with its letters, steel posts and the
//     big screen at the corner, the "kvartal" letters on the roof
//   - Tasku: the curved glass front with its billboard, the stone pylon, the lower wing along Turu, the
//     letters on the roof, and the glass tower behind it
//   - the market hall (Turuhoone): brown render, pilasters and tall small-paned windows over the low plinth storey
//   - benches, bins, shrubs in planters and young trees around them
import * as THREE from 'three';
import { Parts, BOX } from '../race/landmarks.js';
import { painter } from './kaubamaja.js';
import { realTreeKit } from './scenery.js';
import { leafyPlants, addHouseColours } from './streetkit.js';

const CENTRE = [1840, 3080];
const COL = {
  canopy: 0x2c2c36, steel: 0x8f93a0, kvartal: 0x55555f, tasku: 0x7d93b4, turg: 0xb09284, stone: 0xe6dccb, wood: 0xc79a6a,
  planter: 0x5a5a66, towerCap: 0x8fa3c2,
};

// walls, each left to right as seen from the street: [x, z] points, bottom and top (world y)
const KV_RIIA = [
  { pts: [[1823.0, 3120.3], [1799.6, 3142.7]], top: 21.4, kind: 'corner' },
  { pts: [[1801.0, 3144.2], [1780.9, 3163.5]], top: 21.4, kind: 'middle' },
  { pts: [[1770.5, 3152.8], [1747.9, 3174.5]], top: 21.4, kind: 'end' },
];
const KV_TURU = [
  { pts: [[1884.0, 3183.9], [1860.4, 3159.3]], top: 21.4, kind: 'far' },
  { pts: [[1858.9, 3160.6], [1842.6, 3143.6]], top: 21.4, kind: 'mid' },
  { pts: [[1844.0, 3142.2], [1823.0, 3120.3]], top: 21.4, kind: 'turu' },
];
const TASKU_CURVE = [[1927.1, 3020.3], [1919.2, 3026.3], [1895.6, 3043.0], [1879.8, 3055.4], [1870.0, 3065.8], [1865.9, 3070.8], [1864.1, 3077.2]];
const TASKU_TURU = [[1877.5, 3092.6], [1896.2, 3111.4]];
const TASKU_LOW = [[1896.2, 3111.4], [1922.8, 3137.8]];
const TOWER = { a: [1915.2, 3008.5], b: [1947.8, 2981.6], sag: 10.5, top: 52.1 };
const TURG = { a: [1759.4, 2992.2], b: [1791.0, 2961.6], c: [1810.6, 2983.0], d: [1779.6, 3013.0], y0: 5.4, top: 13.0 };

// the map's blocks in colours that suit what stands in front of them
export function keskusWalls(walls) {
  if (!walls || !walls.sectors) return;
  const paint = (key, x0, z0, base, hex, box, roof) => {
    const a = walls.sectors[key] || [], extra = ((walls.extra ||= {})[key] ||= {});
    for (let i = 0; i < a.length; i += 4) {
      const x = x0 + a[i + 1] * 0.1, z = z0 + a[i + 2] * 0.1;
      if (a[i] !== base || x < box[0] || x > box[2] || z < box[1] || z > box[3]) continue;
      a[i + 3] = (a[i + 3] & 0x1000000) | hex;
      if (roof !== undefined) extra[i / 4] = { ...extra[i / 4], roof };
    }
  };
  paint('4_6', 1760, 3040, 69, COL.kvartal, [1740, 3100, 1920, 3270], 0x4b4b58);
  paint('4_6', 1760, 3040, -38, COL.tasku, [1850, 3000, 2030, 3150], 0x6d7388);
  paint('4_5', 1760, 2400, 3, COL.tasku, [1880, 2940, 2000, 3040]);
  paint('4_5', 1760, 2400, 23, COL.turg, [1740, 2940, 1840, 3040], 0x8e8f9c);
  // the map's stray roof plate floating over Kvartal's canopy
  addHouseColours(walls, '4_6', 1760, 3040, [{ base: 877, x: 1775, z: 3147, wall: COL.kvartal, hide: true, reach: 45 }]);
}

function rnd(seed) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// ---------------------------------------------------------------- painters (s along the wall, y world height)
const BRICK = '#dc9a80', BRICK2 = '#c98468', WHITE = '#f1f0f4', TIMBER = '#7b6a6c', DARK = '#33343e', GLASS = '#55627e';
function brick(P, s0, s1, a, b, base) {
  P.rect(s0, s1, a, b, base);
  for (let y = a; y < b; y += 0.32) P.rect(s0, s1, y, y + 0.03, 'rgba(255,235,225,0.22)');
}
function windowAt(P, s, y, w = 1.3, hh = 1.9) {
  P.rect(s - w / 2 - 0.08, s + w / 2 + 0.08, y - 0.08, y + hh + 0.08, '#2a2b34');
  P.rect(s - w / 2, s + w / 2, y, y + hh, '#5d6b88');
  P.rect(s - w / 2, s + w / 2, y + hh * 0.5, y + hh, 'rgba(215,180,240,0.22)');
  P.rect(s - 0.03, s + 0.03, y, y + hh, '#2a2b34');
}
function shops(P, s0, s1, gy, h, names = []) {
  for (let s = s0; s < s1; s += 1.25) {
    const e = Math.min(s1, s + 1.25), y = gy((s + e) / 2);
    P.rect(s, e, y - 1.2, y + h, '#3c4358');
    P.rect(s, e, y + 0.4, y + 3.0, '#56627c');
    P.rect(s, e, y + 1.9, y + 3.0, 'rgba(255,214,170,0.22)');                // lit shop windows
    P.rect(s, e, y + 3.0, y + 3.9, '#25262e');
    P.rect(s, e, y + 4.2, y + h - 0.3, '#4c5871');
    if (Math.round(s / 1.25) % 3 === 0) P.rect(s - 0.05, s + 0.05, y, y + h, '#22232b');
  }
  names.forEach(([word, s, colour = '#ffffff', size = 0.62]) => P.text(word, s, gy(s) + 3.45, size, colour, '700'));
}
const banner = (P, s, y, hh = 5.2) => { P.rect(s - 0.62, s + 0.62, y, y + hh, '#f7f6f9'); P.rect(s - 0.62, s + 0.62, y, y + 0.08, '#2a2b34'); P.rect(s - 0.62, s + 0.62, y + hh - 0.08, y + hh, '#2a2b34'); P.vtext('Tartu südames', s, y + hh / 2, 0.62, '#22232b', '600'); };

// Kvartal: bays over the two shop floors; `opts.top` adds the dark glass top floor
function kvartal(P, len, gy, { seed = 1, names = [], penthouse = false, shopH = 7.2, banners = true } = {}) {
  const top = P.top, r = rnd(seed);
  P.rect(0, len, 0, top, WHITE);
  const mats = [BRICK, WHITE, TIMBER, BRICK2, WHITE, BRICK];
  let s = 0, k = Math.floor(r() * 6);
  const roofY = penthouse ? top - 3.4 : top;
  while (s < len - 0.5) {
    const w = Math.min(len - s, 4.6 + r() * 2.6), m = mats[k++ % mats.length], g0 = gy(s + w / 2) + shopH;
    const dip = m === TIMBER ? 1.6 : m === WHITE ? 0.5 : 0;
    if (m === BRICK || m === BRICK2) brick(P, s, s + w, g0, roofY - dip, m);
    else if (m === TIMBER) { P.rect(s, s + w, g0, roofY - dip, m); for (let q = s; q < s + w; q += 0.22) P.rect(q, q + 0.02, g0, roofY - dip, 'rgba(30,24,30,0.3)'); }
    else P.rect(s, s + w, g0, roofY - dip, m);
    if (dip) P.rect(s, s + w, roofY - dip, roofY, '#8f95a8');
    const n = w > 5.6 ? 2 : 1;
    for (let f = 0; g0 + 0.9 + f * 3.3 + 2.1 < roofY - dip; f++) for (let j = 0; j < n; j++) windowAt(P, s + w * (j + 0.5) / n, g0 + 0.9 + f * 3.3);
    if (banners && r() < 0.55 && w > 4.2) banner(P, s + 0.72, g0 + 2.2);
    s += w;
  }
  if (penthouse) {
    P.glass(0, len, roofY + 0.3, top, '#4a5773', 1.4, 9, '#2a2b34');
    P.rect(0, len, roofY, roofY + 0.3, '#22232b');
  }
  shops(P, 0, len, gy, shopH, names);
}

// Tasku's glass: floors and mullions, the evening sky in it
function glassFront(P, len, gy, { board = null, entrance = null } = {}) {
  const top = P.top, g = P.g;
  const gr = g.createLinearGradient(0, P.Y(top), 0, P.Y(0));
  gr.addColorStop(0, '#c9a6e6'); gr.addColorStop(0.35, '#8aa6d6'); gr.addColorStop(1, '#4d6592');
  g.fillStyle = gr; g.fillRect(0, 0, P.X(len), P.Y(0));
  const r = rnd(4);
  for (let s = 0; s < len; s += 1.5) for (let y = 0; y < top; y += 3.6) { const v = r(); if (v < 0.22) P.rect(s, s + 1.5, y, y + 3.6, v < 0.11 ? 'rgba(255,255,255,0.10)' : 'rgba(20,30,70,0.12)'); }
  for (let s = 0; s <= len; s += 1.5) P.rect(s - 0.04, s + 0.04, 0, top, '#dfe6f2');
  for (let y = gy(len / 2) + 4.4; y < top; y += 3.6) P.rect(0, len, y - 0.12, y + 0.12, '#cfd8e8');
  P.rect(0, len, top - 0.5, top, '#e8edf5');
  for (let s = 0; s < len; s += 1.5) { const y = gy(s + 0.75); P.rect(s, s + 1.5, y - 1.5, y + 0.3, '#7c8296'); }
  if (entrance) { const [s0, s1] = entrance, y = gy((s0 + s1) / 2); P.rect(s0, s1, y, y + 3.2, '#2b3348'); P.rect(s0 - 0.6, s1 + 0.6, y + 3.2, y + 3.6, '#e8edf5'); for (let s = s0 + 1.2; s < s1; s += 1.2) P.rect(s - 0.04, s + 0.04, y, y + 3.2, '#cfd8e8'); }
  if (board) {
    const [s0, s1, a, b] = board, gg = g.createLinearGradient(P.X(s0), 0, P.X(s1), 0);
    gg.addColorStop(0, '#e2485a'); gg.addColorStop(0.45, '#f08a7c'); gg.addColorStop(1, '#7fb6e6');
    g.fillStyle = gg; g.fillRect(P.X(s0), P.Y(b), P.X(s1) - P.X(s0), P.Y(a) - P.Y(b));
    P.disc(s0 + (s1 - s0) * 0.7, (a + b) / 2, (b - a) * 0.3, 'rgba(255,240,225,0.9)');
  }
}
function stoneWing(P, len, gy) {
  const top = P.top;
  P.rect(0, len, 0, top, '#eadfce');
  for (let s = 0; s < len; s += 2.4) P.rect(s, s + 0.03, 0, top, 'rgba(120,100,90,0.3)');
  for (let y = 0; y < top; y += 1.2) P.rect(0, len, y, y + 0.025, 'rgba(120,100,90,0.25)');
  shops(P, 0, len, gy, 4.6, [['Rimi', len * 0.3, '#ff6a5c', 0.9], ['Apollo', len * 0.72, '#ffffff', 0.7]]);
  for (const [s0, s1] of [[len * 0.12, len * 0.3], [len * 0.55, len * 0.7]]) { P.rect(s0, s1, gy(s0) + 6.2, gy(s0) + 10.4, s0 < len / 2 ? '#f0c95a' : '#e2485a'); }
}
// the market hall: pilasters and tall small-paned windows
function hall(P, len) {
  const y0 = TURG.y0, top = P.top;
  P.rect(0, len, 0, top, '#c7a898');
  P.rect(0, len, top - 0.7, top, '#b39686'); P.rect(0, len, top - 0.85, top - 0.7, '#e3cfc2');
  const n = Math.round(len / 4.3), w = len / n;
  for (let k = 0; k < n; k++) {
    const s = k * w;
    P.rect(s + 0.95, s + w - 0.95, y0 + 0.9, top - 1.9, '#7c3f42');
    P.rect(s + 1.08, s + w - 1.08, y0 + 1.02, top - 2.02, '#9db3a8');
    for (let q = 1; q < 4; q++) P.rect(s + 1.08 + (w - 2.16) * q / 4 - 0.035, s + 1.08 + (w - 2.16) * q / 4 + 0.035, y0 + 1.02, top - 2.02, '#7c3f42');
    for (let y = y0 + 1.9; y < top - 2.1; y += 0.9) P.rect(s + 1.08, s + w - 1.08, y - 0.03, y + 0.03, '#7c3f42');
    P.rect(s + 1.3, s + w - 1.3, top - 1.6, top - 1.05, '#8fa39b');
  }
  for (let k = 0; k <= n; k++) { const s = k * w; P.rect(s - 0.42, s + 0.42, y0, top - 0.85, '#b89a8a'); P.rect(s - 0.42, s - 0.3, y0, top - 0.85, '#d5bcae'); P.rect(s - 0.5, s + 0.5, top - 1.15, top - 0.85, '#d5bcae'); P.rect(s - 0.5, s + 0.5, y0, y0 + 0.5, '#d5bcae'); }
}
function plinth(P, len, gy, { kiosks = false } = {}) {
  const top = P.top;
  P.rect(0, len, 0, top, '#e2d2c6');
  P.rect(0, len, top - 0.35, top, '#8e8f9c');
  for (let s = 2; s < len - 2.5; s += 4.3) { const y = gy(s) + 1.3; P.rect(s, s + 2.2, y, y + 1.3, '#8a3d42'); P.rect(s + 0.1, s + 2.1, y + 0.1, y + 1.2, '#93a8a0'); for (const q of [0.75, 1.45]) P.rect(s + q - 0.03, s + q + 0.03, y, y + 1.3, '#8a3d42'); }
  if (kiosks) {
    P.rect(2, len - 2, gy(len / 2), gy(len / 2) + 2.9, '#2e3550');
    P.rect(2, len - 2, gy(len / 2) + 2.3, gy(len / 2) + 2.9, '#f2c33c');
    P.text('KEBAB', len * 0.3, gy(len / 2) + 2.6, 0.5, '#22232b', '800'); P.text('JÄÄTIS', len * 0.72, gy(len / 2) + 2.6, 0.5, '#22232b', '800');
    for (let s = 3; s < len - 3; s += 2.2) P.rect(s, s + 1.8, gy(len / 2) + 0.9, gy(len / 2) + 2.1, '#6a7694');
  }
}

// white (or coloured) letters on a clear ground, for signs that stand free on a roof or a canopy edge
function letters(word, w, h, colour = '#ffffff', font = '700') {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d');
  g.fillStyle = colour; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = c.height * 0.86;
  g.font = `${font} ${size}px "Helvetica Neue", Arial, sans-serif`;
  const m = g.measureText(word).width;
  if (m > c.width * 0.96) { size *= c.width * 0.96 / m; g.font = `${font} ${size}px "Helvetica Neue", Arial, sans-serif`; }
  g.fillText(word, c.width / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function screenTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 288;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 512, 288);
  gr.addColorStop(0, '#ff7ac8'); gr.addColorStop(0.5, '#8a6cff'); gr.addColorStop(1, '#39d0ff');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 288);
  g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.arc(150, 150, 78, 0, 6.3); g.fill();
  g.fillStyle = '#ffffff'; g.font = '800 58px Arial'; g.fillText('LINNARING', 190, 110);
  g.font = '600 30px Arial'; g.fillText('Tartu südames', 262, 170);
  for (let y = 0; y < 288; y += 4) { g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, y, 512, 1); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createKeskus(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function build() {
    built = true;
    const p = new Parts(), solids = [];
    const h = (x, z) => world.heightAt(x, z);

    // a painted skin over a wall line: quads `out` metres in front of it, from y0 up to top
    const skin = (pts, y0, top, paint, out = 0.09, ppm = 20) => {
      const cum = [0];
      for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      const len = cum[cum.length - 1];
      const where = (s, o = 0.6) => {
        let k = 1;
        while (k < pts.length - 1 && cum[k] < s) k++;
        const a = pts[k - 1], b = pts[k], t = (s - cum[k - 1]) / (cum[k] - cum[k - 1]), dx = (b[0] - a[0]) / (cum[k] - cum[k - 1]), dz = (b[1] - a[1]) / (cum[k] - cum[k - 1]);
        return [a[0] + (b[0] - a[0]) * t - dz * o, a[1] + (b[1] - a[1]) * t + dx * o, dx, dz];
      };
      const gy = (s) => { const q = where(Math.min(len, Math.max(0, s))); return h(q[0], q[1]); };
      const P = painter(len, y0, top, Math.min(ppm, 4096 / len));
      P.top = top;
      paint(P, len, gy);
      const pos = [], uv = [], nor = [];
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], b = pts[k], l = cum[k] - cum[k - 1], dx = (b[0] - a[0]) / l, dz = (b[1] - a[1]) / l, nx = -dz, nz = dx;
        const ax = a[0] + nx * out, az = a[1] + nz * out, bx = b[0] + nx * out, bz = b[1] + nz * out, u0 = cum[k - 1] / len, u1 = cum[k] / len;
        pos.push(ax, y0, az, bx, y0, bz, bx, top, bz, ax, y0, az, bx, top, bz, ax, top, az);
        uv.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1);
        for (let q = 0; q < 6; q++) nor.push(nx, 0, nz);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      // pulled a little toward the camera in depth as well, so a map wall standing just behind never shows through
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: P.texture(), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
      m.receiveShadow = true;
      group.add(m);
      return { len, where, gy };
    };
    // a free-standing sign: letters on a clear ground, lit from within
    const sign = (word, x, y, z, w, hh, yaw, colour, font) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), new THREE.MeshBasicMaterial({ map: letters(word, w, hh, colour, font), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, fog: true }));
      m.position.set(x, y, z); m.rotation.y = yaw;
      group.add(m);
    };
    const yawOf = (dx, dz) => Math.atan2(-dz, dx);

    // ================= Kvartal =================
    const names = {
      corner: [['kvartal', 6, '#ffffff', 0.8], ['VAPIANO', 16, '#ff5a4a', 0.7], ['café', 26, '#ffffff', 0.6]],
      middle: [['coop', 6, '#ffffff', 0.8], ['weekend', 15, '#ffffff', 0.7], ['crocs', 23, '#ffffff', 0.6]],
      end: [['MELIVA', 6, '#ffffff', 0.7], ['JUHU', 15, '#ffffff', 0.6], ['Tokumaru', 24, '#ffffff', 0.55]],
      turu: [['VAPIANO', 6, '#ff5a4a', 0.7], ['DOUGLAS', 15, '#ffffff', 0.7], ['salon+', 24, '#ffffff', 0.6]],
      mid: [['Sportland', 7, '#ffffff', 0.6], ['coop', 16, '#ffffff', 0.7]],
      far: [['P kvartal', 8, '#ffffff', 0.7], ['Swedbank', 22, '#ffb14a', 0.7]],
    };
    let seed = 11;
    for (const W of [...KV_RIIA, ...KV_TURU]) {
      // 0.3 m out: the map's walls of the end and far blocks stand 7 to 11 cm in front of these lines, which with
      // the old 9 cm made the painted face and the grey block fight for the same depth (Martin, 20 Nov: "kvartal
      // has a flickering wall")
      skin(W.pts, 0, W.top, (P, len, gy) => kvartal(P, len, gy, { seed: seed++, names: names[W.kind], penthouse: W.kind === 'corner' || W.kind === 'turu', banners: W.kind !== 'middle' }), 0.3);
    }
    {
      // the canopy along Riia: from the junction corner to the block that steps forward, on steel posts
      const c = KV_RIIA[0].pts[0], dx = -0.7224, dz = 0.6915, nx = -0.6915, nz = -0.7224;        // along Riia away from the corner, out to the street
      const q = (s, o) => [c[0] + dx * s + nx * o, c[1] + dz * s + nz * o];
      const yaw = yawOf(dx, dz), S0 = -3, S1 = 59.5, D = 12.2;
      const g0 = h(...q(10, D)), top = g0 + 8.3;
      const [mx, mz] = q((S0 + S1) / 2, D / 2);
      p.box(S1 - S0, 0.5, D + 0.3, COL.canopy, mx, top - 0.25, mz, yaw);                      // the deck
      const edge = (s0, s1, o, hh = 1.5) => { const [x, z] = q((s0 + s1) / 2, o); p.box(s1 - s0, hh, 0.35, COL.canopy, x, top - hh / 2 + 0.25, z, yaw); };
      edge(S0, S1, D, 1.5);
      { const [x, z] = q(S0, D / 2); p.box(0.35, 1.5, D + 0.3, COL.canopy, x, top - 0.5, z, yaw); }
      // the higher block of the canopy at the corner, with the name on both of its faces
      edge(S0, 17, D + 0.2, 3.0);
      { const [x, z] = q(S0 - 0.2, D / 2); p.box(0.4, 3.0, D + 0.6, COL.canopy, x, top - 1.25, z, yaw); }
      for (let s = 2; s <= S1; s += 8.2) {
        const [x, z] = q(s, D - 0.5), y = h(x, z);
        p.box(0.28, top - y, 0.28, COL.steel, x, (y + top) / 2, z, yaw);
        solids.push({ x, z, yaw, hx: 0.16, hz: 0.16 });
      }
      const face = yaw;                                                                           // a plane turned to look out over the street
      const word = (text, s, w, hh, y, colour = '#ffffff', font = '700') => { const [x, z] = q(s, D + 0.42); sign(text, x, top + y, z, w, hh, face, colour, font); };
      word('kvartal', 3.2, 7.5, 1.7, -1.2); word('kvartal', 12, 7.5, 1.7, -1.2);
      word('H&M', 22, 3.2, 1.0, -0.5, '#ff4a4a', '800'); word('coop', 30, 3.4, 1.0, -0.5); word('weekend', 38.5, 5.4, 0.9, -0.5); word('MELIVA', 48, 5.2, 0.9, -0.5); word('JUHU', 55.5, 3.2, 0.8, -0.5);
      { const [x, z] = q(S0 - 0.45, D / 2); sign('kvartal', x, top - 1.2, z, 8, 1.8, yaw - Math.PI / 2, '#ffffff'); }
      // the big screen under the corner of the canopy: one face to Riia, one to the junction
      const tex = screenTexture(), sm = new THREE.MeshBasicMaterial({ map: tex, fog: true });
      const scr = (s, o, w, hh, y, yw) => { const [x, z] = q(s, o); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), sm); m.position.set(x, y, z); m.rotation.y = yw; group.add(m); };
      scr(4.6, D + 0.5, 9.4, 5.0, top - 4.6, face);
      scr(S0 - 0.5, D - 3.4, 6.4, 5.0, top - 4.6, yaw - Math.PI / 2);
      { const [x, z] = q(4.4, D + 0.2); p.box(9.8, 5.4, 0.5, 0x18181e, x, top - 4.6, z, yaw); }
      { const [x, z] = q(S0 - 0.2, D - 3.4); p.box(0.5, 5.4, 6.8, 0x18181e, x, top - 4.6, z, yaw); }
      // the roof letters over the corner, looking north over the junction
      const cy = KV_RIIA[0].top;
      sign('kvartal', c[0] + 1.5, cy + 2.2, c[1] + 7.5, 17, 3.6, Math.PI, '#ffffff', '600');
      for (const ox of [-7, 0, 7]) p.box(0.12, 4.2, 0.12, COL.steel, c[0] + 1.5 + ox, cy + 2.0, c[1] + 7.8);
      // benches and shrub planters under the canopy
      for (const s of [20, 34, 48]) {
        const [x, z] = q(s, 4.2), y = h(x, z);
        p.box(6, 0.5, 1.6, COL.planter, x, y + 0.25, z, yaw);
        p.box(6.4, 0.1, 0.5, COL.wood, x + nx * 1.05, y + 0.5, z + nz * 1.05, yaw);
        solids.push({ x, z, yaw, hx: 3, hz: 0.8 });
        plants.push([x, y + 0.45, z, 5.4, 1.3, yaw, 1.3]);
      }
    }

    // ================= Tasku =================
    const curve = skin(TASKU_CURVE, 0, 23.8, (P, len, gy) => glassFront(P, len, gy, { board: [len * 0.52, len * 0.52 + 12, 12.5, 18.5], entrance: [len * 0.62, len * 0.62 + 7] }));
    skin([[1864.6, 3079.7], [1872.8, 3087.6]], 0, 23.8, (P, len, gy) => glassFront(P, len, gy));
    skin(TASKU_TURU, 0, 23.8, (P, len, gy) => glassFront(P, len, gy, { entrance: [4, 10] }));
    skin(TASKU_LOW, 0, 12.8, stoneWing);
    {
      // the stone pylon between the curve and the Turu face
      const x = 1870.6, z = 3091.4, y = h(x, z);
      p.box(6.6, 27 - y, 5.4, COL.stone, x, (y + 27) / 2, z, yawOf(0.72, 0.69));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 9), new THREE.MeshLambertMaterial({ map: (() => { const P = painter(3.6, 0, 9, 40); P.rect(0, 3.6, 0, 9, '#f1dc8a'); P.disc(1.8, 5.6, 1.3, '#e8a0c0'); P.disc(1.8, 5.6, 0.8, '#f1dc8a'); P.vtext('TASKU', 1.8, 2.2, 0.8, '#5a4a6a', '800'); return P.texture(); })() }));
      m.position.set(x - 0.69 * 2.76, 14, z + 0.72 * 2.76); m.rotation.y = yawOf(0.72, 0.69);
      group.add(m);
      // the letters on the roof over the curve
      const q = curve.where(curve.len * 0.6, 0.3);
      sign('tasku', q[0] + q[3] * 0.4, 26.6, q[1] - q[2] * 0.4, 16, 4.6, yawOf(q[2], q[3]), '#bfe9ee', '500');
      for (const e of [-6, 0, 6]) p.box(0.14, 3.6, 0.14, COL.steel, q[0] + q[3] * 0.7 + q[2] * e, 25.4, q[1] - q[2] * 0.7 + q[3] * e);
    }
    {
      // the glass tower: a curved front on the river side, a flat back
      const { a, b, sag, top } = TOWER, n = 18, arc = [];
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), nx = dz / l, nz = -dx / l;      // bulges to the north-west
      for (let k = 0; k <= n; k++) { const t = k / n, o = sag * 4 * t * (1 - t); arc.push([a[0] + dx * t + nx * o, a[1] + dz * t + nz * o]); }
      const front = arc.slice().reverse(), y0 = 0;
      const tower = (P, len) => {
        const g = P.g, gr = g.createLinearGradient(0, 0, 0, P.Y(0));
        gr.addColorStop(0, '#d6b2ea'); gr.addColorStop(0.3, '#93aede'); gr.addColorStop(1, '#55709e');
        g.fillStyle = gr; g.fillRect(0, 0, P.X(len), P.Y(0));
        for (let y = 4.5; y < top; y += 3.4) { P.rect(0, len, y, y + 0.9, 'rgba(235,240,250,0.55)'); P.rect(0, len, y + 0.9, y + 1.0, 'rgba(40,50,90,0.25)'); }
        for (let s = 0; s <= len; s += 1.35) P.rect(s - 0.03, s + 0.03, 0, top, 'rgba(225,232,245,0.8)');
        P.rect(0, len, top - 1.2, top, '#e8edf5');
      };
      skin(front, y0, top, tower, 0, 12);
      skin([[a[0] + 4.6, a[1] + 3.4], [b[0] + 0.6, b[1] + 8.6]], y0, top, tower, 0.2, 12);
      skin([[a[0] + 4.6, a[1] + 3.4], a], y0, top, tower, 0, 12);
      skin([b, [b[0] + 0.6, b[1] + 8.6]], y0, top, tower, 0, 12);
      const cap = new THREE.Shape([...arc, [b[0] + 0.6, b[1] + 8.6], [a[0] + 4.6, a[1] + 3.4]].map(([x, z]) => new THREE.Vector2(x, -z)));
      p.add(new THREE.ShapeGeometry(cap).rotateX(-Math.PI / 2), COL.towerCap, 0, top + 0.02, 0);
      sign('tasku', (a[0] + b[0]) / 2 + nx * (sag + 0.4), top - 3.2, (a[1] + b[1]) / 2 + nz * (sag + 0.4), 9, 2.6, yawOf(-dx / l, -dz / l), '#ffffff', '500');
    }

    // ================= the market hall =================
    {
      const { a, b, c, d, y0, top } = TURG;
      for (const W of [[a, d], [d, c], [c, b], [b, a]]) skin(W, y0, top, (P, len) => hall(P, len), 0.08, 22);
      skin([[1756.8, 2992.4], [1779.3, 3015.8]], 0, 5.45, (P, len, gy) => plinth(P, len, gy), 0.08, 22);
      skin([[1790.5, 2960.0], [1756.8, 2992.4]], 0, 5.45, (P, len, gy) => plinth(P, len, gy), 0.08, 22);
      skin([[1795.4, 3018.1], [1815.4, 2998.8]], 0, 3.65, (P, len, gy) => plinth(P, len, gy, { kiosks: true }), 0.08, 22);
      const [mx, mz] = [(a[0] + d[0]) / 2 - 0.72 * 0.2, (a[1] + d[1]) / 2 + 0.7 * 0.2];
      sign('TURUHOONE', mx, top - 0.42, mz, 9, 0.6, yawOf(0.7, 0.72), '#f3e6da', '700');
    }

    // ================= green things =================
    const r = rnd(23), trees = [];
    for (let k = 0; k < 6; k++) trees.push([1872.5 + k * 7.6, 3103.2 + k * 7.9, 5.2 + r() * 1.4, 0]);       // the row along Tasku's Turu side
    for (const [x, z] of [[1838, 3008], [1846, 3001], [1829, 3016], [1857, 2992]]) trees.push([x, z, 8 + r() * 2.5, 0]);    // by the market hall lawn
    for (const [x, z] of [[1858, 3072], [1862, 3062]]) trees.push([x, z, 6 + r() * 1.5, 1]);                // the lawn at Tasku's corner
    const kit = realTreeKit();
    for (const sp of [0, 1]) {
      const list = trees.filter((t) => t[3] === sp), S = kit && kit.species && kit.species[sp];
      if (!list.length) continue;
      if (S && S.near) {
        const im = new THREE.InstancedMesh(S.near, S.soloMat, list.length);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
        list.forEach(([x, z, hh], k) => { m.compose(new THREE.Vector3(x, h(x, z) - 0.05, z), q.setFromAxisAngle(up, k * 2.1), new THREE.Vector3(hh * 0.6, hh, hh * 0.6)); im.setMatrixAt(k, m); im.setColorAt(k, col.setRGB(0.95, 0.95, 0.85)); });
        im.castShadow = shadows; im.frustumCulled = false;
        group.add(im);
      } else for (const [x, z, hh] of list) { p.add(new THREE.CylinderGeometry(0.08, 0.12, hh * 0.5, 6), 0x6b5444, x, h(x, z) + hh * 0.25, z); p.add(new THREE.IcosahedronGeometry(hh * 0.3, 1), 0x7fbf6a, x, h(x, z) + hh * 0.68, z); }
    }
    // shrubs: the planter beside Kvartal's car park ramp, the ring of the flower bed by the market hall
    for (let k = 0; k < 7; k++) plants.push([1839 + k * 1.5, h(1839 + k * 1.5, 3119 + k * 3.1) - 0.05, 3119 + k * 3.1, 3.2, 1.5 + (k % 3) * 0.3, k, 3.2]);
    for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283, x = 1814 + Math.cos(a) * 4.6, z = 3033 + Math.sin(a) * 4.6; plants.push([x, h(x, z) - 0.05, z, 2.3, 0.8, a, 2.3]); }
    plants.push([1814, h(1814, 3033) - 0.05, 3033, 3.4, 1.1, 0, 3.4]);
    const leafy = leafyPlants(group, shadows);
    for (const [x, y, z, w, hh, yaw, depth] of plants) {
      if (leafy.ok) leafy.bush(x, y, z, w, hh, yaw, [0.95, 1, 0.92], depth);
      else p.add(new THREE.IcosahedronGeometry(0.5, 1).scale(w, hh * 1.2, depth), 0x5fa565, x, y + hh * 0.5, z, yaw);
    }
    leafy.finish();

    const mesh = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    if (mesh) { mesh.castShadow = shadows; mesh.receiveShadow = true; group.add(mesh); }
    world.addSolids(solids);
  }
  const plants = [];

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 900) return;
      if ([[1750, 3175], [1884, 3184], [1927, 3020], [1947, 2982], [1757, 2992], [1814, 3033], [1920, 3137]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}

// benches, bins and keep-right signs on the island noses: [kind, x, z, compass yaw]. All of them can be knocked over.
export function keskusProps() {
  const BENCH = 3, BIN = 4, MANDATORY = 13;
  return [
    [BENCH, 1822, 3108, 315], [BENCH, 1830, 3112, 315], [BIN, 1826, 3106, 0],
    [BENCH, 1872, 3082, 225], [BIN, 1869, 3085.5, 0], [BENCH, 1884, 3060, 315],
    [BENCH, 1806, 3040, 135], [BENCH, 1822, 3040, 225], [BIN, 1810, 3043, 0],
    [MANDATORY, 1803.5, 3083.5, 45],
  ];
}
