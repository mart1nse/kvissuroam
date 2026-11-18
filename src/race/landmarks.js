// Real things around the spawn and the start/finish, measured from the Land Board's oblique aerial
// photos (kaldaerofotod, 2024) and orthophoto: the white colonnade, roof band and sign of Tartu Kaubamaja,
// the row of white kiosks on Küüni, the café terrace at the start line and
// the Barclay park playground. Modelled geometry only (no photos are pasted). Kiosks are solid.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Kaubamaja footprint corners from the LOD2 building model (game x, z), and its roof height (world y)
const KM = { N: [1735.2, 3015.6], E: [1789.5, 3071.8], S: [1713.8, 3144.9], W: [1659.6, 3088.7], roof: 22.5 };
const KIOSKS = { a: [1652, 3113], b: [1696, 3159], n: 10 };
// parked cars: kerb rows a -> b with the number of bays (some left empty). The cars themselves are
// real models that can be shoved: src/world/parked.js
// (perp: nose-in bays across the row instead of cars nose to tail)
export const PARKING = [
  { a: [1667, 3047], b: [1700, 3016], n: 8, seed: 1 },      // Kaubamaja, north-west side
  { a: [1554, 3087], b: [1579, 3120], n: 6, seed: 2 },      // the cross street north of the spawn
  // the car park by the river across from Kaubamaja, around the pavilion
  { a: [1731, 2951], b: [1779, 2943], n: 18, perp: true, seed: 3 },
  { a: [1737, 2961], b: [1778, 2953], n: 15, perp: true, seed: 4 },
  { a: [1744, 2970], b: [1777, 2961], n: 12, perp: true, seed: 5 },
  { a: [1812, 2976], b: [1825, 2994], n: 7, perp: true, seed: 6 },
  { a: [1821, 2962], b: [1839, 2978], n: 8, perp: true, seed: 7 },
  { a: [1801, 3026], b: [1839, 2993], n: 18, perp: true, seed: 8 },
  // Vallikraavi (vallistreet.js): along the kerb under the tower house, the car park under the hill (the
  // asphalt bays after it stay empty as run-off room). The bays on the park side stay empty, they are on the racing line (Martin, 18 Nov):
  // those cars stand along the left of Ülikooli past Vabank instead
  { a: [1463.8, 3018.3], b: [1440.1, 2976.6], n: 8, seed: 31 },
  { a: [1505.7, 3009.1], b: [1492.1, 3021.6], n: 3, seed: 32 },
  { a: [1426, 3102], b: [1440, 3102], n: 5, perp: true, seed: 33 },
];
const TERRACE = [1586, 3046];       // café terrace by the start line (moved to the kerb at run time)
const PLAY = [[1602, 3019, 5.2], [1616, 3031, 4.2]];      // playground rubber discs: x, z, radius

export const CAR_COLOURS = [0xb9bcc2, 0x8d9197, 0x3b3e44, 0x18191c, 0xe9e9e6, 0x23344f, 0x7b1d22, 0x4d5a6b, 0xc8c3b6, 0x2c4a3a];

export function rnd(seed) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// "tartu kaubamaja" in red lower case and the black K mark, on a white panel
function signTex() {
  return canvasTex(1024, 192, (g, w, h) => {
    g.fillStyle = '#f6f4f1'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d0202f';
    g.font = '600 92px "Helvetica Neue", Arial, sans-serif';
    g.textBaseline = 'middle';
    g.fillText('tartu kaubamaja', 40, h / 2 + 4);
    // the K mark: a bar and two arcs facing away from each other
    const x = 840, y = h / 2;
    g.fillStyle = '#141416';
    g.fillRect(x - 14, y - 70, 26, 140);
    g.lineWidth = 24; g.strokeStyle = '#141416';
    g.beginPath(); g.arc(x - 70, y, 68, -0.95, 0.95); g.stroke();
    g.beginPath(); g.arc(x + 95, y, 68, Math.PI - 0.95, Math.PI + 0.95); g.stroke();
  });
}

// collects coloured parts and merges them into one mesh
export class Parts {
  constructor() { this.list = []; }
  add(geo, hex, x, y, z, yaw = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv');
    g.rotateY(yaw).translate(x, y, z);
    const c = new THREE.Color(hex), n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.list.push(g);
  }
  mesh(mat) {
    if (!this.list.length) return null;
    const m = new THREE.Mesh(mergeGeometries(this.list), mat);
    for (const g of this.list) g.dispose();
    this.list = [];
    return m;
  }
}

export const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// a generic hatchback / saloon, local +x along the car
export function addCar(p, x, y, z, yaw, colour, r) {
  const L = 4.2 + r() * 0.6, W = 1.78, wagon = r() < 0.35;
  p.add(BOX(L, 0.62, W), colour, x, y + 0.58, z, yaw);                                   // body
  const cl = wagon ? L * 0.62 : L * 0.5, cx = wagon ? -L * 0.08 : -L * 0.04;
  const ox = Math.cos(yaw), oz = -Math.sin(yaw);
  p.add(BOX(cl, 0.55, W - 0.16), 0x1b1f27, x + ox * cx, y + 1.16, z + oz * cx, yaw);      // glass house
  p.add(BOX(cl - 0.3, 0.06, W - 0.2), colour, x + ox * cx, y + 1.46, z + oz * cx, yaw);   // roof
  const wheel = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 10).rotateX(Math.PI / 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lx = sx * (L / 2 - 0.75), lz = sz * (W / 2 - 0.08);
    p.add(wheel, 0x111113, x + ox * lx + Math.sin(yaw) * lz, y + 0.33, z + oz * lx + Math.cos(yaw) * lz, yaw);
  }
  for (const sz of [-1, 1]) {                                                             // tail lights
    const lx = -L / 2 - 0.01, lz = sz * (W / 2 - 0.22);
    p.add(BOX(0.04, 0.12, 0.32), 0x8a1018, x + ox * lx + Math.sin(yaw) * lz, y + 0.75, z + oz * lx + Math.cos(yaw) * lz, yaw);
  }
}

export function createLandmarks(world, track) {
  const group = new THREE.Group();
  const solidMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  let built = false;

  function onTrack(x, z, margin) {
    const n = track.nearest(x, z, -1);
    return n.d < (track.HW[n.i] ?? 6) + margin;
  }

  function build() {
    built = true;
    const p = new Parts(), solids = [];
    const g = (x, z) => world.heightAt(x, z);

    // ---- Kaubamaja: slender white columns standing in front of every face, white roof band and first floor slab
    const corners = [KM.N, KM.E, KM.S, KM.W];
    const cxm = (KM.N[0] + KM.S[0]) / 2, czm = (KM.N[1] + KM.S[1]) / 2;
    for (let k = 0; k < 4; k++) {
      const a = corners[k], b = corners[(k + 1) % 4];
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
      let nx = uz, nz = -ux;                                       // outward normal
      if ((a[0] + dx / 2 - cxm) * nx + (a[1] + dz / 2 - czm) * nz < 0) { nx = -nx; nz = -nz; }
      const off = 0.7, yaw = Math.atan2(-uz, ux);
      const n = Math.round(len / 6.3);
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = a[0] + dx * t + nx * off, z = a[1] + dz * t + nz * off;
        const y0 = g(x, z) - 0.5, h = KM.roof - y0;
        p.add(BOX(0.42, h, 0.42), 0xf2f0ec, x, y0 + h / 2, z, yaw);
      }
      const mx = a[0] + dx / 2 + nx * off, mz = a[1] + dz / 2 + nz * off;
      p.add(BOX(len + 2.6, 1.5, 0.5), 0xf4f2ee, mx, KM.roof - 0.55, mz, yaw);                 // roof band
      const ys = Math.max(g(a[0], a[1]), g(b[0], b[1])) + 5.4;
      p.add(BOX(len + 2.6, 0.45, 0.3), 0xe8e4de, mx - nx * 0.2, ys, mz - nz * 0.2, yaw);      // first floor slab edge
      if (k === 1) {
        // the sign: on the Riia side (S -> E face here runs E -> S), near the south corner, between the columns and the wall
        const t = 0.72, sx = a[0] + dx * t + nx * 0.7, sz = a[1] + dz * t + nz * 0.7;
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(17, 3.2), new THREE.MeshBasicMaterial({ map: signTex(), fog: true }));
        sign.position.set(sx, g(sx, sz) + 12.5, sz);
        sign.rotation.y = Math.atan2(nx, nz);
        group.add(sign);
      }
    }

    // ---- white kiosks on Küüni: a row of booths with pointed roofs, serving windows towards Kaubamaja
    {
      const { a, b, n } = KIOSKS;
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
      const fx = uz, fz = -ux;                     // front: towards Kaubamaja
      const yaw = Math.atan2(-uz, ux);
      const roof = new THREE.ConeGeometry(1.95, 1.5, 4, 1).rotateY(Math.PI / 4);
      const r = rnd(7);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), x = a[0] + dx * t, z = a[1] + dz * t, y = g(x, z);
        p.add(BOX(2.5, 2.5, 2.3), 0xf1efe9, x, y + 1.25, z, yaw);
        p.add(roof, 0xfbfaf8, x, y + 2.5 + 0.75, z, yaw);
        p.add(BOX(1.7, 0.95, 0.06), 0x262a33, x + fx * 1.17, y + 1.45, z + fz * 1.17, yaw);   // window
        p.add(BOX(1.9, 0.08, 0.45), 0xd8d4cc, x + fx * 1.3, y + 0.95, z + fz * 1.3, yaw);    // counter
        if (r() < 0.6) p.add(BOX(2.2, 0.3, 0.05), [0xc8323c, 0x2f6f8f, 0x3c8a4f, 0xd8a12c][Math.floor(r() * 4)], x + fx * 1.18, y + 2.25, z + fz * 1.18, yaw);   // name board
        solids.push({ x, z, yaw, hx: 1.3, hz: 1.2 });
      }
    }

    // ---- café terrace beside the start line: parasols, tables and a low fence, on the building side
    {
      const n = track.nearest(TERRACE[0], TERRACE[1], -1), [tx, tz] = track.tan[n.i], P = track.P[n.i];
      const lx = tz, lz = -tx;                                     // left of the direction of travel
      // it stands against the building on the left: find the wall, then step back out of it
      let wall = 4;
      while (wall < 22 && world.sdfAt(P[0] + lx * wall, P[1] + lz * wall) > 0.4) wall += 0.5;
      const cx = P[0] + lx * (wall - 2.2), cz = P[1] + lz * (wall - 2.2);
      const yaw = Math.atan2(-tz, tx);
      const r = rnd(11);
      for (let i = -2; i <= 2; i++) {
        const x = cx + tx * i * 3.2, z = cz + tz * i * 3.2, y = g(x, z);
        p.add(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), 0x777777, x, y + 1.2, z);
        p.add(new THREE.ConeGeometry(1.5, 0.55, 8), i % 2 ? 0xf3d24a : 0xf6f1e4, x, y + 2.55, z);
        p.add(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 10), 0x2b2b2e, x, y + 0.74, z);
        p.add(new THREE.CylinderGeometry(0.05, 0.05, 0.74, 6), 0x2b2b2e, x, y + 0.37, z);
        for (let c = 0; c < 4; c++) {
          const a = c * Math.PI / 2 + r() * 0.4, chx = x + Math.cos(a) * 0.75, chz = z + Math.sin(a) * 0.75;
          p.add(BOX(0.42, 0.45, 0.42), 0x5a3a26, chx, y + 0.22, chz, a);
          p.add(BOX(0.42, 0.45, 0.05), 0x5a3a26, chx + Math.cos(a) * 0.2, y + 0.65, chz + Math.sin(a) * 0.2, a + Math.PI / 2);
        }
      }
      // fence on the street side of the terrace
      const fx = cx - lx * 1.7, fz = cz - lz * 1.7;
      p.add(BOX(16.5, 0.9, 0.08), 0x3d2f2a, fx, g(fx, fz) + 0.45, fz, yaw);
    }

    // ---- playground in Barclay park: green rubber discs, a climbing frame with a slide, swings
    for (const [x, z, rad] of PLAY) {
      const y = g(x, z);
      p.add(new THREE.CylinderGeometry(rad, rad, 0.12, 28), 0x3c9a5a, x, y + 0.06, z);
    }
    {
      const [x, z] = PLAY[0], y = g(x, z);
      for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.add(BOX(0.12, 2.6, 0.12), 0xd9c08a, x + ox, y + 1.3, z + oz);
      p.add(BOX(2.2, 0.12, 2.2), 0xc8402f, x, y + 1.3, z);
      p.add(new THREE.ConeGeometry(1.6, 1.0, 4).rotateY(Math.PI / 4), 0x2d6fb5, x, y + 3.1, z);
      const slide = BOX(0.7, 0.06, 3.2);
      slide.rotateX(0.42);
      p.add(slide, 0xf0c22c, x, y + 0.65, z + 2.55);
      const [sx, sz] = PLAY[1], sy = g(sx, sz);
      for (const s of [-1, 1]) {
        p.add(BOX(0.1, 2.5, 0.1), 0x4a4f58, sx + s * 1.6, sy + 1.25, sz - 0.6);
        p.add(BOX(0.1, 2.5, 0.1), 0x4a4f58, sx + s * 1.6, sy + 1.25, sz + 0.6);
      }
      p.add(BOX(3.4, 0.1, 0.1), 0x4a4f58, sx, sy + 2.5, sz);
      for (const s of [-0.7, 0.7]) p.add(BOX(0.5, 0.06, 0.25), 0xd6352f, sx + s, sy + 0.5, sz);
    }

    const m = p.mesh(solidMat);
    if (m) { m.castShadow = true; m.receiveShadow = true; group.add(m); }
    world.addSolids(solids);
  }

  return {
    group,
    update(x, z) {
      if (built) return;
      const [kx, kz] = KM.W;
      if (Math.hypot(kx - x, kz - z) < 900 && world.ready(KM.N[0], KM.N[1]) && world.ready(KM.S[0], KM.S[1])
        && world.ready(TERRACE[0], TERRACE[1]) && world.ready(PARKING[1].a[0], PARKING[1].a[1])) build();
    },
  };
}
