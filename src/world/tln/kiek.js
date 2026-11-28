// Kiek in de Kök by hand (Martin's landmark list, 28 Nov 2026), from Mapillary photos along Komandandi tee (July 2021)
// and the LOD2 model's size and heights: the round artillery tower of grey limestone rubble, 20 m across, a little
// battered at its foot and narrowing to the eaves, slits and small square windows in rows up the shaft, a ring of
// small windows in the top storey over a corbel band, the cannon balls set in its face, the arched door at the foot,
// and the steep cone of red tiles (bell-cast at the eaves) with a finial and a vane. Its LOD2 shaft and cone are cut
// away and drawn again; the low annex beside it keeps its LOD2 shape, plain limestone. Built through the work queue
// when the car comes within 450 m.
import * as THREE from 'three';
import { Parts } from '../../race/landmarks.js';
import { jobs } from '../../jobs.js';
import { still } from '../../still.js';
import { addHouseColours } from '../streetkit.js';

const T = { x: -5933.37, z: 3227.34, r: 10.1, eaves: 60.3, top: 72.4 };
const KEY = '-9_6', BASE = 2406, X0 = -6560, Z0 = 3040;
const COL = { stone: 0xb9b3a7, stone2: 0xaaa497, stone3: 0xc4beb1, band: 0xa29c90, hole: 0x2c2a33, door: 0x5e432e, ball: 0x2b2a2e, tile: 0xc8573a, tile2: 0xb54b33, iron: 0x34313f, gold: 0xf0cf7a };

export function kiekWalls(walls) {
  const look = { roof: 0xc0573c, reach: 40, plain: true, cut: (x, z) => Math.hypot(x - T.x, z - T.z) < T.r + 0.9 };
  const a = walls && walls.sectors && walls.sectors[KEY];
  const extra = a && ((walls.extra ||= {})[KEY] ||= {});
  let seen = false;
  if (a) for (let i = 0; i < a.length; i += 4) if (a[i] === BASE) { a[i + 3] = (a[i + 3] & 0x1000000) | 0xcfc8bc; extra[i / 4] = { ...extra[i / 4], ...look }; seen = true; }
  if (!seen) addHouseColours(walls, KEY, X0, Z0, [{ base: BASE, x: T.x, z: T.z, wall: 0xcfc8bc, ...look }]);
}

export function createKiek(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  world.addSolids([0, Math.PI / 8, Math.PI / 4, (3 * Math.PI) / 8].map((yaw) => ({ x: T.x, z: T.z, yaw, hx: T.r * 0.96, hz: T.r * 0.96 })));

  function* build() {
    const p = new Parts(), glow = new Parts(), geos = [];
    const keep = (g) => (geos.push(g), g);
    const gs = Array.from({ length: 8 }, (_, k) => world.heightAt(T.x + Math.sin((k * Math.PI) / 4) * (T.r + 1), T.z + Math.cos((k * Math.PI) / 4) * (T.r + 1)));
    const FOOT = Math.min(...gs) - 0.5;
    const S0 = Math.max(FOOT + 2, 31), S1 = 56.6;
    const rAt = (y) => 10.3 + (9.9 - 10.3) * Math.max(0, Math.min(1, (y - S0) / (S1 - S0)));
    // the battered foot, then the shaft in courses of three greys
    p.add(keep(new THREE.CylinderGeometry(10.3, 11.0, S0 - FOOT, 32, 1, true)), COL.stone2, T.x, (FOOT + S0) / 2, T.z);
    const tones = [COL.stone, COL.stone3, COL.stone, COL.stone2, COL.stone3, COL.stone, COL.stone2];
    for (let k = 0, y = S0; y < S1 - 0.01; k++) {
      const y1 = Math.min(S1, y + 1.7 + ((k * 7) % 5) * 0.35);
      p.add(keep(new THREE.CylinderGeometry(rAt(y1), rAt(y), y1 - y, 32, 1, true)), tones[k % tones.length], T.x, (y + y1) / 2, T.z);
      y = y1;
    }
    yield;
    // the corbel band and the top storey, a hair wider
    p.add(keep(new THREE.CylinderGeometry(10.12, 9.9, 0.7, 32, 1, true)), COL.band, T.x, S1 + 0.35, T.z);
    p.add(keep(new THREE.CylinderGeometry(10.1, 10.1, T.eaves - S1 - 0.7, 32, 1, true)), COL.stone3, T.x, (S1 + 0.7 + T.eaves) / 2, T.z);
    p.add(keep(new THREE.CircleGeometry(10.1, 32).rotateX(Math.PI / 2)), COL.stone2, T.x, T.eaves - 0.05, T.z);
    // openings: rows of slits and small windows up the shaft (staggered), the ring of windows up top
    const hole = (a, y, w, hh, r) => p.box(w, hh, 0.12, COL.hole, T.x + Math.sin(a) * r, y, T.z + Math.cos(a) * r, a);
    const rows = [[S0 + 3.5, 5, 0.35, 1.1], [S0 + 9, 6, 0.7, 0.9], [S0 + 15, 6, 0.75, 1.0], [S0 + 20.5, 7, 0.8, 1.0]];
    rows.forEach(([y, n, w, hh], j) => { for (let k = 0; k < n; k++) { const a = ((k + j * 0.5) / n) * Math.PI * 2 + 0.2; if (y < S1 - 1) hole(a, y, w, hh, rAt(y) - 0.04); } });
    for (let k = 0; k < 16; k++) hole((k / 16) * Math.PI * 2, 58.4, 0.65, 0.8, 10.06);
    // cannon balls set in the face (a handful, on the side to the town)
    const ball = keep(new THREE.SphereGeometry(0.24, 8, 6));
    for (const [a, y] of [[2.0, 38.5], [2.3, 44.2], [1.7, 47.8], [2.6, 41.0], [1.4, 51.5], [2.9, 49.0]]) { const r = rAt(y) - 0.08; p.add(ball, COL.ball, T.x + Math.sin(a) * r, y, T.z + Math.cos(a) * r); }
    // the arched door at the foot on the town side, its stone frame and two steps
    {
      const a = 2.45, y0 = Math.max(FOOT + 0.5, world.heightAt(T.x + Math.sin(a) * (T.r + 1.5), T.z + Math.cos(a) * (T.r + 1.5)));
      const arch = (w, hh) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(-w / 2, hh - w / 2); s.absarc(0, hh - w / 2, w / 2, Math.PI, 0, true); s.lineTo(w / 2, 0); return keep(new THREE.ShapeGeometry(s, 6)); };
      const r = rAt(y0 + 1) + 0.02;
      p.add(arch(2.2, 3.4), COL.band, T.x + Math.sin(a) * r, y0, T.z + Math.cos(a) * r, a);
      p.add(arch(1.5, 2.9), COL.door, T.x + Math.sin(a) * (r + 0.03), y0, T.z + Math.cos(a) * (r + 0.03), a);
      for (let k = 0; k < 2; k++) p.box(2.4, 0.18, 0.5, COL.band, T.x + Math.sin(a) * (r + 0.25 + k * 0.45), y0 - 0.09 - k * 0.18, T.z + Math.cos(a) * (r + 0.25 + k * 0.45), a);
    }
    yield;
    // the roof: bell-cast eaves, then the cone in courses of two reds, the finial
    const R0 = T.r + 0.65, H = T.top - T.eaves;
    p.add(keep(new THREE.CylinderGeometry(T.r - 0.15, R0, 0.9, 32, 1, true)), COL.tile2, T.x, T.eaves + 0.45, T.z);
    const N = 8, Rb = T.r - 0.15;
    for (let k = 0; k < N; k++) {
      const f0 = k / N, f1 = (k + 1) / N, r0 = Rb * (1 - f0), r1 = Rb * (1 - f1) + (k === N - 1 ? 0.05 : 0);
      p.add(keep(new THREE.CylinderGeometry(r1, r0, (H - 0.9) / N, 32, 1, true)), k % 2 ? COL.tile2 : COL.tile, T.x, T.eaves + 0.9 + (H - 0.9) * (f0 + f1) / 2, T.z);
    }
    p.add(keep(new THREE.CylinderGeometry(0.05, 0.08, 2.6, 6)), COL.iron, T.x, T.top + 1.1, T.z);
    glow.add(keep(new THREE.SphereGeometry(0.16, 8, 6)), COL.gold, T.x, T.top + 0.6, T.z);
    p.box(0.65, 0.38, 0.03, COL.iron, T.x + 0.32, T.top + 2.0, T.z, -0.5);
    yield 'frame';

    const m = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    if (m) { m.castShadow = shadows; m.receiveShadow = true; m.matrixAutoUpdate = false; group.add(m); }
    const gm = glow.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    if (gm) { gm.matrixAutoUpdate = false; group.add(gm); }
    for (const g of geos) g.dispose();
  }

  let built = false;
  return {
    info: () => ({ built }),
    update(car) {
      if (built || !car || Math.hypot(car.x - T.x, car.z - T.z) > 450 || !world.ready(T.x, T.z) || !world.ready(T.x + 12, T.z) || !world.ready(T.x - 12, T.z)) return;
      built = true;
      jobs.add(build, 'kiek in de kok');
    },
  };
}
