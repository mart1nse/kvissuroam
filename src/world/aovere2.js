// Kaardista "Aovere junction" (Martin, 23 Nov), batch 2: the Haava junction of road 3 with roads 43 and 44, from
// his Street View shots (July and Aug 2024) and the Land Board's air photos.
//  - Olerex: the canopy with its yellow fascia and OLEREX on the sides to the roads, the solar panels on its
//    roof, yellow posts and pump islands; the shop's dark walls under the yellow band, its windows and
//    POOD+KOHVIK, the black parasols of its terrace; the tall yellow price sign by road 3; the two yellow gas
//    tanks on their trailers with the AUTOGAAS boards and the bottle cage; the three yellow banner flags, the
//    recycling bins, the transformer kiosk and the transformer on its pole; the charger; cars by the shop;
//  - the junction: the red paved islands with black and white kerbs where the map's keep-right signs stand,
//    the blue direction sign over road 43 (KALLASTE, KOOSA / RÄPINA, LUUNJA / VALGA, VÕRU) and the one by road
//    3 before the turn (RÄPINA, KALLASTE, LUUNJA).
// The lamps, small signs and poles are the map's own (from the street photos). Guessed: the distances half
// hidden on the direction sign, the shop's back. Nothing on a carriageway; no names on the road. Built only
// within 380 m.
import * as THREE from 'three';
import { setHouseColours, addHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { jobs } from '../jobs.js';

const DEBUG = typeof location !== 'undefined' && /aovdebug/.test(location.search);
const S = ['10_-7', 5600, -5280];
const CENTRE = [6135, -4810];
const YEL = 0xf5c400, BLACK = 0x1d1e21;
const SANS = '700 %px Arial, sans-serif';

export function aovere2Walls(walls) {
  setHouseColours(walls, S[0], S[1], S[2], [{ base: 2817, x: 6168.5, z: -4767, wall: 0x3a3c41, roof: 0x5d6066, reach: 16 }]);
  // the map's canopy, a block floating over a white mound: built again here
  addHouseColours(walls, S[0], S[1], S[2], [{ base: 3290, x: 6152, z: -4763, hide: true, reach: 18 }, { base: 3290, x: 6152, z: -4763, hide: true, shelter: true, reach: 18 }]);
}

// cars by the shop and at the west end of the forecourt: [x, z, yaw, id, paint, lift]
export const AOVERE2_CARS = [
  [6133.0, -4797.0, 1.35, 'passat', 'silver', 0.03],
  [6133.6, -4793.2, 1.35, 'mazda6', 'black', 0.03],
  [6134.2, -4789.4, 1.35, 'rav4', 'white', 0.03],
  [6175.5, -4752.5, -2.92, 'passat', 'grey', 0.03],
  [6178.5, -4753.0, -2.92, 'ceedsw', 'white', 0.03],
  [6181.5, -4753.6, -2.92, 'bz4x', 'silver', 0.03],
];

// ---------------------------------------------------------------- the shop's walls
// the shop's frame: U along its north side (0.976, -0.219), V = (0.219, 0.976) to the south
function shop(P, W) {
  const len = W.len, top = P.y1;
  P.r(0, P.y0, len, top, '#3a3c41');
  const band = Math.max(1.6, top * 0.45);
  P.r(0, top - band, len, top, '#f2c200');
  for (let y = top - band + 0.3; y < top; y += 0.3) P.r(0, y, len, y + 0.025, '#d9ad00');
  P.r(0, top - 0.15, len, top, '#26272b');
  const north = W.nx * -0.219 + W.nz * -0.976, west = W.nx * -0.976 + W.nz * 0.219, east = -west;
  const win = (x0, x1) => { P.r(x0, 0.6, x1, 2.6, '#26272b'); P.grad(x0 + 0.06, 0.66, x1 - 0.06, 2.54, '#6d8191', '#3a4753'); };
  if (north > 0.8 && len > 8) {
    for (let x = 2; x + 2 < len - 1; x += 3.4) win(x, x + 2.2);
    P.text('OLEREX', len * 0.5, top - band * 0.5, band * 0.5, '#1d1e21', '900 %px Arial, sans-serif');
  } else if (west > 0.8 && len > 8) {                                            // under the canopy: the doors and big windows
    win(1.0, len * 0.42); P.r(len * 0.45, 0, len * 0.45 + 2.0, 2.5, '#26272b'); P.grad(len * 0.45 + 0.08, 0.05, len * 0.45 + 1.92, 2.42, '#7d93a5', '#4b5d6c');
    win(len * 0.5 + 1.0, len - 1.0);
    P.text('POOD+KOHVIK', len * 0.5, top - band - 0.45, 0.42, '#e3262e', SANS);
  } else if (east > 0.8 && len > 8) {                                            // to the terrace
    win(1.5, len * 0.45); P.r(len * 0.55, 0, len * 0.55 + 1.6, 2.4, '#26272b'); win(len * 0.55 + 2.4, len - 1.5);
  } else if (len > 4) { P.r(len * 0.4, 0, len * 0.4 + 1.0, 2.2, '#2f3035'); }
}

// ---------------------------------------------------------------- the signs: one small picture for all of them
// painter metres: x 0..16, y 0..8 (y up); a panel shows a rectangle of it
const AW = 16, AH = 8;
function paintSigns(P) {
  P.r(0, 0, AW, AH, '#8d9096');
  // A: the fascia, x 0..16, y 0..1.25
  P.r(0, 0, 16, 1.25, '#f5c400'); P.r(0, 0, 16, 0.1, '#2b2c30'); P.r(0, 1.15, 16, 1.25, '#e3262e');
  P.text('OLEREX', 8, 0.62, 0.8, '#1d1e21', '900 %px Arial, sans-serif');
  // B: the price sign's face, x 0..1.6, y 1.3..8
  P.r(0, 1.3, 1.6, 8, '#f5c400');
  P.r(0.08, 6.4, 1.52, 7.9, '#1d1e21'); P.arc(0.8, 7.35, 0.38, '#f5c400'); P.arc(0.8, 7.35, 0.24, '#1d1e21');
  P.text('OLEREX', 0.8, 6.65, 0.24, '#f5c400', '900 %px Arial, sans-serif');
  for (const [y, t, p] of [[5.8, '95', '1.63'], [5.25, '98', '1.74'], [4.7, 'D', '1.59'], [4.15, 'LPG', '0.89']]) {
    P.r(0.08, y - 0.24, 1.52, y + 0.24, '#1d1e21');
    P.text(t, 0.35, y, 0.22, '#ffffff', SANS); P.text(p, 1.08, y, 0.26, '#ff3b2f', SANS);
  }
  P.r(0.15, 2.9, 1.45, 3.7, '#e3262e'); P.text('POOD', 0.8, 3.45, 0.2, '#ffffff', SANS); P.text('KOHVIK', 0.8, 3.12, 0.18, '#ffffff', SANS);
  P.r(0.15, 2.1, 1.45, 2.7, '#1d1e21'); P.text('24h', 0.8, 2.4, 0.3, '#f5c400', SANS);
  // C: the direction sign over road 43, x 2..5, y 1.3..4.0, three blue panels
  const blue = '#1f4fa3', wh = '#ffffff', big = '700 %px Arial Narrow, Arial, sans-serif';
  P.r(2, 1.3, 5, 4.0, wh);
  [[3.12, ['KALLASTE', '38'], ['KOOSA', '21'], true], [2.22, ['RÄPINA', '65'], ['LUUNJA', '13'], false], [1.32, ['VALGA', '107'], ['VÕRU', '90'], false]].forEach(([y, a, b, left]) => {
    P.r(2.04, y + 0.02, 4.96, y + 0.86, blue);
    if (left) { P.poly([[2.15, y + 0.62], [2.42, y + 0.8], [2.42, y + 0.44]], wh); P.r(2.4, y + 0.57, 2.68, y + 0.67, wh); }
    P.text(a[0], 3.05 + (left ? 0.2 : 0), y + 0.62, 0.24, wh, big, 'left'); P.text(a[1], 4.85, y + 0.62, 0.24, wh, big, 'right');
    P.text(b[0], 3.05 + (left ? 0.2 : 0), y + 0.3, 0.24, wh, big, 'left'); P.text(b[1], 4.85, y + 0.3, 0.24, wh, big, 'right');
  });
  // D: the sign by road 3 before the turn, x 5.2..8, y 1.3..2.6
  P.r(5.2, 1.3, 8, 2.6, wh); P.r(5.24, 1.34, 7.96, 2.56, blue);
  [['RÄPINA', '65', 2.27], ['KALLASTE', '38', 1.93], ['LUUNJA', '13', 1.59]].forEach(([t, n, y]) => { P.text(t, 5.35, y, 0.24, wh, big, 'left'); P.text(n, 7.2, y, 0.24, wh, big, 'right'); });
  P.r(7.35, 1.88, 7.7, 1.98, wh); P.poly([[7.9, 1.93], [7.65, 2.1], [7.65, 1.76]], wh);
  // E: the AUTOGAAS board, x 5.2..8, y 2.8..3.6
  P.r(5.2, 2.8, 8, 3.6, '#f5c400'); P.text('AUTOGAAS', 6.6, 3.28, 0.34, '#1d1e21', '900 %px Arial, sans-serif'); P.text('OLEREX', 6.6, 2.97, 0.16, '#1d1e21', SANS);
}

export function createAovere2(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  // the height map took the canopy for a 5 m mound of ground: laid level with the forecourt round it
  {
    const hm = world.meta.height, hn = hm.n, res = hm.res, hs = hm.scale, ho = hm.offset;
    const C = frame([6141.25, -4771.9], [0.976, -0.219]), flat = Math.round((28.22 - ho) / hs);
    world.onSectorLoad((sec) => {
      const H = sec.H;
      if (!H || sec.x0 > 6170 || sec.x0 + (hn - 1) * res < 6135 || sec.z0 > -4748 || sec.z0 + (hn - 1) * res < -4778) return;
      for (let r = 0; r < hn; r++) for (let c = 0; c < hn; c++) {
        const [s0, v0] = C.sv(sec.x0 + c * res, sec.z0 + r * res);
        if (s0 > -4.5 && s0 < 22.5 && v0 > -2.5 && v0 < 21.5 && H[r * hn + c] > flat) H[r * hn + c] = flat;
      }
    });
    // and the map's block for it stood in the way: the cars drive under the canopy
    const [x, z] = C.at(9.7, 9.5);
    world.addFree([{ x, z, yaw: C.YAW, hx: 9.9, hz: 10.0 }]);
  }

  function* build() {
    skinHouses(world, group, [{ name: 'shop', sec: S[0], base: 2817, at: [6168.5, -4767], r: 16, spec: { wall: [58, 60, 65], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: shop }] }], { label: 'aovere2 fronts', shadows, ppm: 16, far: 6, faces: (W) => W.len > 4, debug: DEBUG });
    yield;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    const tex = paintTexture(AW, 0, AH, 48, paintSigns);
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    // a picture panel facing (sin yaw, cos yaw), its centre at x, y, z, showing the atlas rectangle [x0, y0, x1, y1]
    const panels = [];
    const panel = (x, y, z, yaw, w, hh, r) => {
      const g = new THREE.PlaneGeometry(w, hh), uv = g.attributes.uv;
      const [u0, v0, u1, v1] = [r[0] / AW, r[1] / AH, r[2] / AW, r[3] / AH];
      uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
      g.rotateY(yaw); g.translate(x, y, z);
      panels.push(g);
    };
    yield;

    // ---- the canopy: s along (0.976, -0.219) from its north-west corner, v to the south; 19.9 by 19 m
    const C = frame([6141.25, -4771.9], [0.976, -0.219]);
    const CW = 19.9, CD = 19.0, cg = Math.min(...[[0, 0], [CW, 0], [CW, CD], [0, CD]].map(([s, v]) => h(...C.at(s, v)))), UNDER = 5.0, TOP = 6.3;
    A.box(C, CW / 2, CD / 2, CW, CD, UNDER, TOP, 0xeeeeec, cg);
    A.box(C, CW / 2, CD / 2, CW - 0.4, CD - 0.4, UNDER - 0.04, UNDER, 0xf4f3ef, cg);                       // the white soffit
    for (const [s0, v0, s1, v1, txt] of [[0, 0, CW, 0, true], [CW, CD, 0, CD, false], [0, CD, 0, 0, true], [CW, 0, CW, CD, false]]) {
      const [ax, az] = C.at(s0, v0), [bx, bz] = C.at(s1, v1), len = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / len, nz = (bx - ax) / len;                                                   // to the left going a -> b: outwards here
      const yaw = Math.atan2(-nx, -nz);
      if (txt) panel((ax + bx) / 2 - nx * 0.04, cg + (UNDER + TOP) / 2, (az + bz) / 2 - nz * 0.04, yaw, len, TOP - UNDER, [0, 0, 16, 1.25]);
      else A.bar([ax - nx * 0.03, az - nz * 0.03], [bx - nx * 0.03, bz - nz * 0.03], 0.04, UNDER, TOP, YEL, cg);
    }
    // the solar panels on the roof, in rows
    for (let s = 1.2; s < CW - 1; s += 2.15) A.box(C, s + 0.9, CD / 2, 1.8, CD - 2.4, TOP, TOP + 0.12, 0x262b3b, cg);
    // the posts and the pump islands
    for (const s of [4.2, 10.0, 15.8]) {
      A.box(C, s, CD / 2, 1.3, 7.4, -0.05, 0.18, 0xb9bbbd, cg);
      for (const dv of [-2.2, 2.2]) {
        A.box(C, s, CD / 2 + dv, 0.42, 0.42, 0.18, UNDER, YEL, cg);
        A.box(C, s, CD / 2 + dv * 0.45, 0.62, 0.9, 0.18, 1.85, 0xf2f2ee, cg); A.box(C, s, CD / 2 + dv * 0.45, 0.66, 0.94, 1.85, 2.15, YEL, cg);
        A.box(C, s + 0.33, CD / 2 + dv * 0.45, 0.02, 0.5, 1.0, 1.6, 0x26272b, cg);
      }
      for (const dv of [-3.5, 3.5]) A.box(C, s, CD / 2 + dv, 0.5, 0.25, 0.18, 0.95, 0xf5c400, cg);           // the yellow guards at the ends
    }
    yield;

    // ---- the price sign by road 3: yellow, 8 m, faces both ways
    {
      const x = 6120.0, z = -4814.0, g = h(x, z), yaw = Math.PI / 2 - 0.08;
      p.box(1.7, 0.5, 0.6, 0x55575c, x, g + 0.25, z, yaw);
      p.box(1.62, 6.7, 0.36, YEL, x, g + 0.5 + 3.35, z, yaw);
      const dx = Math.sin(yaw) * 0.19, dz = Math.cos(yaw) * 0.19;
      panel(x + dx, g + 0.5 + 3.35, z + dz, yaw, 1.6, 6.7, [0, 1.3, 1.6, 8]);
      panel(x - dx, g + 0.5 + 3.35, z - dz, yaw + Math.PI, 1.6, 6.7, [0, 1.3, 1.6, 8]);
    }
    // ---- the gas: two yellow tanks on trailers, the AUTOGAAS boards, the bottle cage
    for (const x of [6131.6, 6134.6]) {
      const z = -4806.5, g = h(x, z);
      p.add(new THREE.CylinderGeometry(1.05, 1.05, 6.2, 18).rotateX(Math.PI / 2), YEL, x, g + 1.75, z);
      for (const e of [-3.1, 3.1]) p.add(new THREE.SphereGeometry(1.05, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(e > 0 ? Math.PI / 2 : -Math.PI / 2).scale(1, 1, 0.4), YEL, x, g + 1.75, z + e);
      p.box(1.9, 0.18, 6.6, 0x3a3b3f, x, g + 0.68, z);
      for (const e of [-0.6, 0.6]) for (const s of [-0.98, 0.98]) p.add(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 12).rotateZ(Math.PI / 2), 0x1c1d20, x + s, g + 0.36, z + e);
      p.box(0.3, 0.15, 1.6, 0x3a3b3f, x, g + 0.6, z - 4.0);
    }
    for (const [x, z] of [[6129.0, -4810.5], [6129.0, -4803.0]]) {
      const g = h(x, z);
      p.box(0.07, 1.6, 0.07, 0x3a3b3f, x, g + 0.8, z - 1.3); p.box(0.07, 1.6, 0.07, 0x3a3b3f, x, g + 0.8, z + 1.3);
      panel(x - 0.04, g + 1.25, z, -Math.PI / 2, 2.8, 0.8, [5.2, 2.8, 8, 3.6]);
      p.box(0.04, 0.8, 2.8, 0x8d9096, x + 0.01, g + 1.25, z);
    }
    { const x = 6128.5, z = -4795.0, g = h(x, z);
      p.box(1.6, 2.0, 3.2, YEL, x, g + 1.0, z);
      for (let k = -1.4; k <= 1.4; k += 0.2) p.box(0.02, 1.7, 0.03, 0xb08a00, x - 0.81, g + 1.0, z + k); }
    yield;

    // ---- by the shop: the flags, the recycling bins, the transformer kiosk and pole, the charger, the terrace
    for (const [x, z] of [[6150.5, -4801.5], [6153.6, -4802.2], [6156.7, -4802.9]]) {
      const g = h(x, z);
      p.add(new THREE.CylinderGeometry(0.05, 0.07, 9, 8), 0xd9dbdf, x, g + 4.5, z);
      p.box(0.7, 3.2, 0.03, 0xf2cf3a, x + 0.36, g + 6.6, z, -0.22);
    }
    const bins = frame([6166.0, -4789.5], [0.976, -0.219]);
    [0x2f7a3e, 0x2f7a3e, 0xe8b600, 0x2f7a3e].forEach((c, k) => {
      A.box(bins, k * 1.9 + 0.8, 0, 1.6, 1.4, 0, 1.25, c);
      const [x, z] = bins.at(k * 1.9 + 0.8, 0);
      p.add(new THREE.CylinderGeometry(0.7, 0.7, 1.6, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(bins.YAW), c, x, h(x, z) + 1.25, z);
    });
    { const x = 6161.5, z = -4797.5, g = h(x, z);
      p.box(2.6, 2.4, 2.0, 0xc9cacb, x, g + 1.2, z, -0.22); p.box(2.9, 0.15, 2.3, 0x8d9096, x, g + 2.47, z, -0.22);
      p.box(1.0, 1.9, 0.04, 0x9a9b9c, x, g + 1.0, z - 1.02, -0.22);
      const px = 6164.7, pz = -4803.5, pg = h(px, pz);                                                  // the transformer on the map's pole
      p.box(0.18, 10, 0.18, 0x6e5a45, px + 0.9, pg + 5, pz);
      p.box(1.2, 1.4, 0.8, 0x8f9496, px + 0.45, pg + 4.8, pz);
      p.box(1.8, 0.14, 0.14, 0x6e5a45, px + 0.45, pg + 4.0, pz); }
    { const x = 6145.8, z = -4810.6, g = h(x, z);
      p.box(0.5, 1.7, 0.35, 0xf2f2ee, x, g + 0.85, z); p.box(0.52, 0.3, 0.37, 0x2f9a4a, x, g + 1.55, z); }
    const T = frame([6176.6, -4770.5], [0.219, 0.976]);
    for (const s of [1.6, 5.0, 8.4]) {
      const [x, z] = T.at(s, 1.8), g = h(x, z);
      p.add(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), 0x2b2c30, x, g + 1.2, z);
      p.add(new THREE.ConeGeometry(1.9, 0.5, 4, 1, true).rotateY(Math.PI / 4), 0x232427, x, g + 2.55, z, T.YAW);
      A.box(T, s, 1.8, 1.6, 0.8, 0.72, 0.76, 0x6b5440, g);
      for (const d of [-0.75, 0.75]) A.box(T, s, 1.8 + d, 1.6, 0.3, 0.42, 0.46, 0x6b5440, g);
    }
    yield;

    // ---- the junction: the red paved islands with black and white kerbs (from the orthophoto; the map's
    // keep-right and give-way signs stand on them)
    const isle = (pts) => {
      const tri = THREE.ShapeUtils.triangulateShape(pts.map(([x, z]) => new THREE.Vector2(x, z)), []);
      const pos = [];
      for (const t of tri) {
        const q = t.map((i) => pts[i]);
        const up = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]) < 0;
        for (const v of up ? q : [q[0], q[2], q[1]]) pos.push(v[0], h(v[0], v[1]) + 0.1, v[1]);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      p.add(g, 0x9e6a5f, 0, 0, 0);
      g.dispose();
      for (let i = 0; i < pts.length; i++) {
        const a2 = pts[i], b2 = pts[(i + 1) % pts.length], len = Math.hypot(b2[0] - a2[0], b2[1] - a2[1]);
        const F = frame(a2, [b2[0] - a2[0], b2[1] - a2[1]]);
        for (let s2 = 0, k = 0; s2 < len - 0.1; s2 += 0.5, k++) A.box(F, s2 + 0.25, 0, Math.min(0.5, len - s2), 0.18, -0.05, 0.13, k % 2 ? 0xf2f2ee : 0x2a2b2f);
      }
    };
    isle([[6098.2, -4840.8], [6099.5, -4842.5], [6113.5, -4842.6], [6119.4, -4842.0], [6113.5, -4840.6], [6099.5, -4839.1]]);   // road 43's mouth
    isle([[6096.5, -4858.0], [6097.0, -4847.6], [6110.0, -4847.4]]);                  // between road 3 and 43 to the north
    isle([[6100.0, -4832.5], [6105.0, -4832.0], [6101.0, -4822.8]]);                  // between road 3 and the turn from the south
    isle([[6168.4, -4859.0], [6160.0, -4849.4], [6169.7, -4840.6]]);                  // where 43 and 44 part
    isle([[6155.6, -4847.2], [6157.6, -4847.0], [6164.6, -4834.7], [6163.6, -4834.5]]);
    // the direction signs: over road 43 on the island where 43 and 44 part, facing west; by road 3 before the turn
    { const x = 6166.0, z = -4853.5, g = h(x, z), yaw = -1.30;
      for (const d of [-1.0, 1.0]) p.add(new THREE.CylinderGeometry(0.06, 0.06, 4.6, 8), 0x8d9096, x + Math.cos(yaw) * d, g + 2.3, z - Math.sin(yaw) * d);
      panel(x + Math.sin(yaw) * 0.05, g + 3.0, z + Math.cos(yaw) * 0.05, yaw, 3.0, 2.7, [2, 1.3, 5, 4.0]);
      p.box(3.0, 2.7, 0.04, 0x8d9096, x, g + 3.0, z, yaw); }
    { const x = 6107.5, z = -4806.0, g = h(x, z), yaw = 0.05;
      for (const d of [-0.9, 0.9]) p.add(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 8), 0x8d9096, x + Math.cos(yaw) * d, g + 1.6, z - Math.sin(yaw) * d);
      panel(x + Math.sin(yaw) * 0.05, g + 2.4, z + Math.cos(yaw) * 0.05, yaw, 2.8, 1.3, [5.2, 1.3, 8, 2.6]);
      p.box(2.8, 1.3, 0.04, 0x8d9096, x, g + 2.4, z, yaw); }
    yield;

    if (panels.length) {
      const pos = [], nor = [], uv = [], idx = [];
      let base = 0;
      for (const g of panels) {
        pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array);
        for (const i of g.index.array) idx.push(i + base);
        base += g.attributes.position.count; g.dispose();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = shadows;
      yield 'frame';
      jobs.upload(tex);
      group.add(m);
    }
    yield;
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 380) return;
      if (![[6120, -4814], [6152, -4763], [6168, -4767], [6166, -4853]].every((q) => world.ready(q[0], q[1]))) return;
      built = true;
      jobs.add(build, 'aovere2');
    },
  };
}
