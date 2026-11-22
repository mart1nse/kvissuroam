// Kaardista "Raadi, Mööbliait and Kvissentali tee" (Martin, 21 Nov), batch 4 and the road paint: road 3
// (Jõhvi-Tartu-Valga tee) from Kvissentali tee north to where the road to Jõgeva and the ramp to Jõhvi part, from
// his Street View shots ("Jõhvi-Tartu-Valga, Raadi" and "42 Jõhvi-Tartu-Valga", July 2024) and the air photos.
//  - paint: two lanes with a broken centre line and solid edge lines on the wide stretch north of Kvissentali tee
//    (the map's four-lane marking was wrong there), solid edge lines on to the fork and on the ramps, and the
//    chevron island where the ramp leaves;
//  - white roadside posts with a black band along both verges, every 50 m;
//  - the blue direction sign before the Mööbliait corner (Jõgeva ahead, Jõhvi to the right).
// No street names or road numbers are painted on the road (the "Jõhvi-Tartu-Valga" in Street View is Google's).
import * as THREE from 'three';
import { paintTexture } from './houseskin.js';
import { still } from '../still.js';
import { warm } from '../warm.js';

const ROAD3 = 'Jõhvi-Tartu-Valga tee';
const SPLIT = [471.7, -202.1];
// the stretch north of Kvissentali tee, the road to the fork, the Jõhvi ramp (centre lines from the map)
const WIDE = [[482.4, -76], [471.7, -202.1]];
const WEST = [[471.7, -202.1], [469.5, -222.5], [442.9, -394.3], [435.5, -441.1]];
const RAMP = [[471.7, -202.1], [475.3, -238.5], [482.7, -284.6], [490.8, -311.8], [502.9, -343.8], [511.6, -362.8], [522.3, -383.2]];
const LANE = 3.6;               // half the painted width of the wide stretch: two 3.5 m lanes, a shoulder outside

// a point t metres along a polyline, its direction and its right-hand normal (east for a road heading north)
function along(pts, t) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], l = Math.hypot(bx - ax, bz - az);
    if (t <= l || i === pts.length - 2) {
      const ux = (bx - ax) / l, uz = (bz - az) / l;
      return { x: ax + ux * t, z: az + uz * t, ux, uz, nx: -uz, nz: ux };
    }
    t -= l;
  }
}
const lengthOf = (pts) => pts.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]), 0);

export function road3PaintVectors(vectors) {
  const L = (vectors.extraLines ||= []);
  const seg = (a, b) => L.push(a[0], a[1], b[0], b[1]);
  for (const r of vectors.roads) {
    if (r.pts.length < 2) continue;
    const [x0, z0] = r.pts[0], [x1, z1] = r.pts[r.pts.length - 1];
    if (r.name === ROAD3 && Math.abs(r.w - 12.6) < 0.05 && Math.hypot(x0 - WIDE[0][0], z0 - WIDE[0][1]) < 0.6) r.nomark = true;
    if (r.name === ROAD3 && Math.abs(r.w - 10.6) < 0.05 && Math.min(z0, z1) < -190 && Math.max(x0, x1) < 480) r.edges = true;
    if (r.type === 'Ramp või ühenduste' && /Aru ühendustee/.test(r.name)) r.edges = true;
  }
  // the wide stretch: a broken centre line (3 m lines, 9 m gaps) and solid edges, broken at Kvissentali tee
  const lw = lengthOf(WIDE);
  for (let t = 14; t + 3 < lw - 4; t += 12) { const a = along(WIDE, t), b = along(WIDE, t + 3); seg([a.x, a.z], [b.x, b.z]); }
  for (const side of [-1, 1]) {
    for (let t = 16; t + 4 <= lw; t += 4) {
      const a = along(WIDE, t), b = along(WIDE, t + 4);
      seg([a.x + a.nx * LANE * side, a.z + a.nz * LANE * side], [b.x + b.nx * LANE * side, b.z + b.nz * LANE * side]);
    }
  }
  // the chevron island where the ramp leaves: its two sides from the point where the lanes part, V bars every 5 m
  const inner = (t) => {
    const w = along(WEST, t), r = along(RAMP, t);
    return [[w.x + w.nx * LANE, w.z + w.nz * LANE], [r.x - r.nx * 3.0, r.z - r.nz * 3.0]];
  };
  let apex = 0;
  for (let t = 0; t < 80; t += 0.5) { const [a, b] = inner(t); if ((b[0] - a[0]) * along(WEST, t).nx + (b[1] - a[1]) * along(WEST, t).nz > 0.05) { apex = t; break; } }
  if (!apex) return;
  const tip = inner(apex), mid = [(tip[0][0] + tip[1][0]) / 2, (tip[0][1] + tip[1][1]) / 2];
  // from the edge of the wide stretch to the tip, both lines solid
  const a0 = along(WIDE, lw);
  seg([a0.x + a0.nx * LANE, a0.z + a0.nz * LANE], mid);
  let prev = [mid, mid];
  for (let t = apex + 2; t <= apex + 46; t += 2) {
    const cur = inner(t);
    seg(prev[0], cur[0]); seg(prev[1], cur[1]); prev = cur;
  }
  for (let t = apex + 6; t + 3 <= apex + 44; t += 5) {
    const [a, b] = inner(t), [c, d] = inner(t + 3), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (Math.hypot(c[0] - d[0], c[1] - d[1]) < 1.2) continue;
    seg(m, c); seg(m, d);
  }
}

export function createRoad3(scene, world) {
  const group = still(new THREE.Group());
  let built = false;

  function build() {
    const h = (x, z) => world.heightAt(x, z);
    // ---- roadside posts: white, black band and a small reflector, on both verges every 50 m
    const spots = [];
    const verge = (pts, half, t0, t1) => {
      for (let t = t0; t <= t1; t += 50) {
        const a = along(pts, t);
        for (const side of [-1, 1]) spots.push([a.x + a.nx * (half + 0.7) * side, a.z + a.nz * (half + 0.7) * side]);
      }
    };
    verge(WIDE, 6.3, 30, lengthOf(WIDE) - 25);
    verge(WEST, 5.3, 40, lengthOf(WEST) - 25);
    verge(RAMP, 3.3, 40, lengthOf(RAMP) - 20);
    const keep = spots.filter(([x, z]) => Math.hypot(x - SPLIT[0], z - SPLIT[1]) > 25);
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.8, 0.11), new THREE.MeshLambertMaterial({ color: 0xf2f2f0 }), keep.length);
    const band = new THREE.InstancedMesh(new THREE.BoxGeometry(0.115, 0.25, 0.115), new THREE.MeshLambertMaterial({ color: 0x202124 }), keep.length);
    const m = new THREE.Matrix4();
    keep.forEach(([x, z], i) => {
      const y = h(x, z);
      body.setMatrixAt(i, m.makeTranslation(x, y + 0.4, z));
      band.setMatrixAt(i, m.makeTranslation(x, y + 0.925, z));
    });
    group.add(body, band);

    // ---- the direction sign before the Mööbliait corner, for drivers heading north
    const [sx, sz] = [495.6, 22], sy = h(sx, sz);
    const tex = paintTexture(2.8, 0, 1.7, 40, (P) => {
      P.r(0, 0, 2.8, 1.7, '#1f5fae'); P.r(0.04, 0.04, 2.76, 1.66, '#1f5fae');
      const F = '700 %px Arial, sans-serif';
      P.r(0.12, 1.12, 2.68, 1.14, '#ffffff');
      P.poly([[0.32, 1.58], [0.2, 1.38], [0.28, 1.38], [0.28, 1.2], [0.36, 1.2], [0.36, 1.38], [0.44, 1.38]], '#ffffff');
      P.r(0.6, 1.24, 0.9, 1.52, '#f2c230'); P.text('39', 0.75, 1.38, 0.2, '#1d1e21', F);
      P.text('JÕGEVA', 1.75, 1.38, 0.24, '#ffffff', F);
      P.poly([[0.2, 0.5], [0.2, 0.82], [0.4, 0.82], [0.4, 0.92], [0.56, 0.74], [0.4, 0.56], [0.4, 0.66], [0.28, 0.66], [0.28, 0.5]], '#ffffff');
      P.r(0.62, 0.62, 1.04, 0.88, '#2f9a49'); P.text('E264', 0.83, 0.75, 0.16, '#ffffff', F);
      P.r(1.1, 0.62, 1.38, 0.88, '#f2c230'); P.text('3', 1.24, 0.75, 0.2, '#1d1e21', F);
      P.text('JÕHVI', 2.05, 0.75, 0.24, '#ffffff', F);
      P.r(0.12, 0.42, 2.68, 0.44, '#ffffff');
      P.text('Raadi', 1.4, 0.22, 0.2, '#ffffff', F);
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.7), new THREE.MeshLambertMaterial({ map: tex }));
    face.position.set(sx, sy + 2.35, sz + 0.06);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.7, 0.08), new THREE.MeshLambertMaterial({ color: 0x9a9da4 }));
    back.position.set(sx, sy + 2.35, sz);
    group.add(face, back);
    const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.045, 3.2, 8), new THREE.MeshLambertMaterial({ color: 0x9a9da4 }), 3);
    [-1.0, 0, 1.0].forEach((dx, i) => post.setMatrixAt(i, m.makeTranslation(sx + dx, sy + 1.6, sz - 0.08)));
    group.add(post);
    world.addSolids?.([{ x: sx, z: sz - 0.08, yaw: 0, hx: 1.1, hz: 0.1 }]);
    warm.scope(() => scene.add(group));
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - 480, car.z + 120) > 600 || !world.ready(480, -120)) return;
      built = true;
      build();                    // a few dozen instances and one small canvas: well under a millisecond
    },
  };
}
