// Kaardista "ERM and the Raadi manor park" (Martin, 23 Nov 2026), batch 3: the park's edge along road 95 and
// Narva maantee, from his Street View shots (June 2023, July 2024) and the Land Board's air photos.
//  - the manor's cream wall (OSM's stone wall): pilasters with pale caps every 3.4 m and a blind arch in each
//    panel between them, from the old road east of the park round the gatehouse and down Narva maantee;
//  - the gatehouse (Mõisavärava): cream, white trim, its pale roof, a portico of four columns to the drive;
//  - the blue TARTU VALD letters on the grass behind the cycle path by the Mõisavärava bus stop, a flower tub
//    at each end;
//  - inside the park: the red brick water tower and the white house beside it.
// The Raadi rally stage runs outside the wall to its first corner: the wall's corner is set 0.4 m back from OSM's
// so that the wall and its pilasters stay 4.3 m or more from the stage's gravel everywhere (agreed with the stage).
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit } from './handbuilt.js';
import { still } from '../still.js';
import { jobs } from '../jobs.js';

const S42 = ['4_2', 1760, 480], S52 = ['5_2', 2400, 480];
const GATE = { base: 2564, at: [2386, 508] };
// the wall: east of the gatehouse to the path through the east gate, and from the drive's gate down Narva
// maantee (the drive and the east path go through gaps in it)
const WALLS = [
  [[2489.6, 511.7], [2414.6, 462.4], [2386, 501]],
  [[2380, 527], [2377, 530], [2370, 524], [2322, 581], [2320, 580], [2317, 582], [2316, 584], [2317, 586], [2296, 607], [2263, 641], [2250, 664], [2196, 784], [2209, 790]],
  // past the east gate the wall goes on along the stage (Martin, 24 Nov: "this wall actually extends near the track
  // for quite some time"): north-east beside the white house, 6 m or more from the stage's gravel at k85-k125, then
  // south-east along the path to the park's east corner. Traced from its line and shadow on the air photo.
  [[2499, 519.8], [2534.6, 473.2], [2568.3, 498.3], [2600, 523], [2661.5, 577]],
];
const PANEL = 3.4, WALL_H = 2.1, THICK = 0.4;
const CREAM = 0xeee3bf, CAP = 0xd4cfc2;
// the letters: by the bus stop, facing road 95
const LETTERS = { x: 2475.2, z: 357.8, nx: -0.78, nz: -0.62, len: 9.2, h: 1.45 };
const CENTRE = [2380, 520];

export function raadiManorWalls(walls) {
  setHouseColours(walls, S42[0], S42[1], S42[2], [{ base: GATE.base, x: GATE.at[0], z: GATE.at[1], wall: CREAM, roof: 0xc9ccd0, reach: 14 }]);
  setHouseColours(walls, S52[0], S52[1], S52[2], [
    { base: 2890, x: 2553, z: 564, wall: 0x8e4a3a, roof: 0x4a4f58, reach: 8 },          // the water tower
    { base: 2829, x: 2522, z: 519, wall: 0xf0efe9, roof: 0x3f4a5c, reach: 16 },         // the white house
  ]);
}

// the wall's segments as boxes, for the cars
function segments() {
  const out = [];
  for (const W of WALLS) for (let i = 0; i < W.length - 1; i++) {
    const [ax, az] = W[i], [bx, bz] = W[i + 1], len = Math.hypot(bx - ax, bz - az);
    out.push({ ax, az, bx, bz, len, ux: (bx - ax) / len, uz: (bz - az) / len });
  }
  return out;
}

export function createRaadiManor(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  let built = false;
  const SEG = segments();
  world.addSolids(SEG.map((s) => ({ x: (s.ax + s.bx) / 2, z: (s.az + s.bz) / 2, yaw: Math.atan2(-s.uz, s.ux), hx: s.len / 2 + 0.2, hz: THICK / 2 + 0.05 })));
  world.addSolids([{ x: LETTERS.x, z: LETTERS.z, yaw: Math.atan2(LETTERS.nx, LETTERS.nz), hx: LETTERS.len / 2, hz: 0.25 }]);

  function* build() {
    const h = (x, z) => world.heightAt(x, z);
    // ---- the gatehouse: cream, white trim and window frames
    skinHouses(world, group, [{ name: 'gate', sec: S42[0], base: GATE.base, at: GATE.at, r: 12, spec: { wall: [238, 227, 191], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: gatePaint }] }],
      { label: 'raadi gate', shadows, ppm: 18, far: 8 });
    yield;

    // ---- the wall: one panel picture (a blind arch between two pilasters) repeated along both faces
    const panel = paintTexture(PANEL, -0.4, WALL_H, 30, (P) => {
      P.r(0, -0.4, PANEL, WALL_H, '#efe5c2');
      P.r(0, -0.4, PANEL, 0.25, '#d9cfae');                                                     // the plinth
      const a = 0.45, b = PANEL - 0.45, top = 1.55, rise = 0.32, n = 10;
      const arch = [[a, 0.4], [b, 0.4], [b, top]];
      for (let k = 0; k <= n; k++) { const t = k / n, x = b - (b - a) * t; arch.push([x, top + rise * Math.sin(Math.PI * t)]); }
      P.poly(arch, '#e2d6ae');                                                                  // the recess
      for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n; P.line(b - (b - a) * t0, top + rise * Math.sin(Math.PI * t0), b - (b - a) * t1, top + rise * Math.sin(Math.PI * t1), '#cbbf98', 0.05); }
      P.r(a, 0.38, b, 0.44, '#d3c7a0');
      P.r(0, WALL_H - 0.1, PANEL, WALL_H, '#e6dcba');
    }, { repeat: true });
    yield;
    const pos = [], uv = [], nor = [];
    const A = areaKit(world, group, { shadows });
    const { p } = A;
    let n = 0;
    for (const s of SEG) {
      const k = Math.max(1, Math.round(s.len / PANEL)), step = s.len / k, nx = -s.uz, nz = s.ux, yaw = Math.atan2(-s.uz, s.ux);
      for (let i = 0; i < k; i++) {
        const x0 = s.ax + s.ux * step * i, z0 = s.az + s.uz * step * i, x1 = x0 + s.ux * step, z1 = z0 + s.uz * step;
        const g0 = h(x0, z0), g1 = h(x1, z1), gm = (g0 + g1) / 2, lo = Math.min(g0, g1) - 0.4, top = gm + WALL_H;
        const vlo = (lo - gm + 0.4) / (WALL_H + 0.4);
        for (const side of [1, -1]) {
          const ox = nx * THICK / 2 * side, oz = nz * THICK / 2 * side;
          const V = [[x0 + ox, lo, z0 + oz, 0, vlo], [x1 + ox, lo, z1 + oz, step / PANEL, vlo], [x1 + ox, top, z1 + oz, step / PANEL, 1], [x0 + ox, top, z0 + oz, 0, 1]];
          for (const q of side > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]) { pos.push(V[q][0], V[q][1], V[q][2]); uv.push(V[q][3], V[q][4]); nor.push(nx * side, 0, nz * side); }
        }
        p.box(step + 0.02, 0.1, THICK + 0.14, CAP, (x0 + x1) / 2, top + 0.05, (z0 + z1) / 2, yaw);              // the coping
        // a pilaster at the panel's start (and at the segment's end)
        for (const [px, pz, g] of i === k - 1 ? [[x0, z0, g0], [x1, z1, g1]] : [[x0, z0, g0]]) {
          p.box(0.55, WALL_H + 0.75, THICK + 0.22, CREAM, px, g - 0.3 + (WALL_H + 0.75) / 2, pz, yaw);
          p.box(0.72, 0.14, THICK + 0.38, CAP, px, g + WALL_H + 0.52, pz, yaw);
        }
        if (++n % 40 === 0 && jobs.late()) yield;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const wall = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: panel }));
    wall.castShadow = shadows; wall.receiveShadow = shadows; group.add(wall);
    yield;

    // ---- the gatehouse's portico: four columns to the drive on its south-west side
    { const mx = 2381, mz = 513, nx = -0.6, nz = 0.8, ux = 0.8, uz = 0.6, yaw = Math.atan2(-uz, ux), g = h(mx + nx * 1.4, mz + nz * 1.4);
      for (const d of [-3, -1, 1, 3]) {
        const x = mx + nx * 1.4 + ux * d, z = mz + nz * 1.4 + uz * d;
        p.add(new THREE.CylinderGeometry(0.2, 0.24, 3.9, 10), 0xf4f1e8, x, g + 1.95, z);
        p.box(0.55, 0.16, 0.55, 0xf4f1e8, x, g + 3.98, z, yaw);
      }
      p.box(7.6, 0.5, 1.9, 0xf4f1e8, mx + nx * 0.95, g + 4.3, mz + nz * 0.95, yaw);                          // the entablature
      p.box(7.9, 0.12, 2.1, 0xc9ccd0, mx + nx * 0.95, g + 4.6, mz + nz * 0.95, yaw);
      p.box(8.0, 0.25, 2.6, 0xd3d0c6, mx + nx * 1.2, g - 0.05, mz + nz * 1.2, yaw);                         // the step
      // the pediment: a low triangle over the columns
      const tri = new THREE.Shape([new THREE.Vector2(-3.9, 0), new THREE.Vector2(3.9, 0), new THREE.Vector2(0, 1.1)]);
      const ped = new THREE.ExtrudeGeometry(tri, { depth: 0.3, bevelEnabled: false });
      ped.rotateY(yaw);
      p.add(ped, 0xf1ede2, mx + nx * 1.85, g + 4.66, mz + nz * 1.85);
    }
    yield;

    // ---- TARTU VALD: blue letters with a darker side, a flower tub at each end
    { const L = LETTERS, ux = -L.nz, uz = L.nx, g = h(L.x, L.z), yaw = Math.atan2(L.nx, L.nz);
      const face = paintTexture(L.len, 0, L.h, 40, (P) => { P.text('TARTU VALD', L.len / 2, L.h * 0.47, L.h * 1.05, '#2f4fb3', '900 %px Arial, sans-serif'); }, { alpha: true });
      const side = paintTexture(L.len, 0, L.h, 40, (P) => { P.text('TARTU VALD', L.len / 2, L.h * 0.47, L.h * 1.05, '#1d327a', '900 %px Arial, sans-serif'); }, { alpha: true });
      for (const [tex, off] of [[side, -0.16], [side, -0.08], [face, 0]]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(L.len, L.h), new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
        m.position.set(L.x + L.nx * (off + 0.12), g + L.h / 2 + 0.05, L.z + L.nz * (off + 0.12)); m.rotation.y = yaw; group.add(m);
      }
      for (const d of [-L.len / 2 - 1.0, L.len / 2 + 1.0]) {
        const x = L.x + ux * d, z = L.z + uz * d, gg = h(x, z);
        p.add(new THREE.CylinderGeometry(0.42, 0.34, 0.6, 12), 0x2f4fb3, x, gg + 0.3, z);
        p.add(new THREE.IcosahedronGeometry(0.42, 1).scale(1, 0.7, 1), 0x4f8a3e, x, gg + 0.75, z);
        for (const [a, b] of [[0.2, 0.1], [-0.15, 0.2], [0.05, -0.22]]) p.add(new THREE.IcosahedronGeometry(0.12, 0), 0xd23a3a, x + a, gg + 0.95, z + b);
      }
    }
    yield;
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 650) return;
      if ([[2386, 508], [2489, 511], [2250, 664], [2462, 360]].every((q) => world.ready(q[0], q[1]))) { built = true; jobs.add(build, 'raadimanor'); }
    },
  };
}

// the gatehouse: cream, a white band under the eaves, tall windows with white frames; plain where a wall is short
function gatePaint(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, P.y1, '#eee3bf');
  P.r(0, P.y0, len, 0.45, '#d8cfb4');
  P.r(0, top - 0.5, len, top, '#f6f3ea');
  if (len < 4 || W.foot > 1.6) return;
  for (let x = 1.2; x + 1.1 < len - 0.8; x += 2.6) P.win(x, 1.0, x + 1.1, 3.0, { frame: '#f7f5ee', glass: '#56677a', fw: 0.07, bars: 1, rails: 2, surround: 0.08, sc: '#f7f5ee', sill: 0.06 });
}
