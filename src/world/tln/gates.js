// The Old Town's gate towers that the 3D houses (LOD2) leave out (Martin's landmark list, 28 Nov 2026), from Mapillary
// photos (Viru from inside the gate, August 2024 and May 2025, and from outside, July 2026) and OpenStreetMap's outlines:
//   - Viru gate: the two slender round towers of the 14th century foregate on either side of Viru street, 4.6 m across,
//     limestone with a string course, a few dark openings high up on the street side and slits below, a ring of stone
//     under the tall cone of red tiles (a little flared at the eaves, laid in courses), a finial with a ball and a vane.
//     The south one stands on its broken lower wall. The round annex south of it (in LOD2) gets its colours here.
// Built in steps through the work queue when the car comes within 400 m; the towers are solid from the start.
import * as THREE from 'three';
import { Parts } from '../../race/landmarks.js';
import { jobs } from '../../jobs.js';
import { still } from '../../still.js';

// x, z, radius, shaft height, street: the side looking into the Old Town (its way out as (sin, cos) of it), base: on a broken wall
const TOWERS = [
  { x: -5423.3, z: 3005.3, r: 2.3, top: 14.2, street: -Math.PI / 2 + 0.3, base: false },  // Viru 21a, north of the street
  { x: -5426.7, z: 3019.6, r: 2.3, top: 14.6, street: -Math.PI / 2 - 0.3, base: true },   // Viru 26a, south of it
];
const ANNEX = { key: '-8_5', base: 675, x: -5426.1, z: 3029.8, wall: 0xe2d9c8, roof: 0xc95a3c };
const C = [-5425, 3012];
const COL = { stone: 0xdcd2c0, stoneDark: 0xb9ad9a, rubble: 0xc4b8a4, hole: 0x2f2c38, tile: 0xd4603f, tile2: 0xc2533a, iron: 0x34313f, gold: 0xf0cf7a };

export function gatesWalls(walls) {
  const a = walls && walls.sectors && walls.sectors[ANNEX.key];
  if (!a) return;
  const extra = ((walls.extra ||= {})[ANNEX.key] ||= {});
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] === ANNEX.base && Math.hypot(a[i + 1] / 10 - 5920 - ANNEX.x, a[i + 2] / 10 + 2400 - ANNEX.z) < 3) { a[i + 3] = (a[i + 3] & 0x1000000) | ANNEX.wall; extra[i / 4] = { ...extra[i / 4], roof: ANNEX.roof }; }
  }
}

export function createGates(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  world.addSolids(TOWERS.flatMap((t) => [0, Math.PI / 4].map((yaw) => ({ x: t.x, z: t.z, yaw, hx: t.r * 0.93, hz: t.r * 0.93 }))));

  function* build() {
    const p = new Parts(), glow = new Parts();
    for (const t of TOWERS) {
      const y = Math.min(...[0, 1, 2, 3].map((k) => world.heightAt(t.x + Math.cos(k * 1.57) * t.r, t.z + Math.sin(k * 1.57) * t.r))) - 0.3;
      const cyl = (r0, r1, y0, y1, hex, seg = 18) => p.add(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg), hex, t.x, y + (y0 + y1) / 2, t.z);
      cyl(t.r, t.r * 0.97, 0, t.top, COL.stone);
      if (t.base) {                                     // the broken lower wall it stands on, toward the street
        const ox = Math.sin(t.street), oz = Math.cos(t.street);
        p.add(new THREE.CylinderGeometry(t.r + 0.5, t.r + 0.6, 4.6, 18, 1, false, t.street - 1.3, 2.6), COL.rubble, t.x, y + 2.3, t.z);
        p.box(1.0, 1.5, 0.1, COL.hole, t.x + ox * (t.r + 0.58), y + 2.9, t.z + oz * (t.r + 0.58), t.street);
      }
      cyl(t.r + 0.06, t.r + 0.06, 10.6, 10.85, COL.stoneDark);                 // the string course
      cyl(t.r * 0.97 + 0.05, t.r + 0.22, t.top - 0.35, t.top, COL.stoneDark);   // the stone ring under the eaves
      // dark openings: one tall one high up toward the street, slits round the shaft below
      const hole = (a, r, y0, w, hh) => p.box(w, hh, 0.12, COL.hole, t.x + Math.sin(a) * r, y + y0 + hh / 2, t.z + Math.cos(a) * r, a);
      hole(t.street, t.r * 0.97, 11.4, 0.8, 1.6);
      for (let k = 0; k < 4; k++) hole(t.street + Math.PI / 4 + (k * Math.PI) / 2, t.r * 0.985, 6.2 + (k % 2) * 1.3, 0.22, 0.9);
      // the cone of tiles: flared at the eaves, then straight to the point, in courses of two reds
      const R0 = t.r + 0.45, H = 5.4, y0 = y + t.top;
      p.add(new THREE.CylinderGeometry(t.r + 0.12, R0, 0.55, 20, 1, true), COL.tile2, t.x, y0 + 0.27, t.z);
      const N = 7;
      for (let k = 0; k < N; k++) {
        const f0 = k / N, f1 = (k + 1) / N, r0 = (t.r + 0.12) * (1 - f0), r1 = (t.r + 0.12) * (1 - f1) + (k === N - 1 ? 0.02 : 0);
        p.add(new THREE.CylinderGeometry(r1, r0, (H - 0.55) / N, 20, 1, true), k % 2 ? COL.tile2 : COL.tile, t.x, y0 + 0.55 + (H - 0.55) * (f0 + f1) / 2, t.z);
      }
      // the finial: a pole, a gold ball, a little vane
      p.add(new THREE.CylinderGeometry(0.04, 0.06, 2.4, 6), COL.iron, t.x, y0 + H + 1.0, t.z);
      glow.add(new THREE.SphereGeometry(0.14, 8, 6), COL.gold, t.x, y0 + H + 0.55, t.z);
      p.box(0.55, 0.32, 0.03, COL.iron, t.x + 0.27, y0 + H + 1.75, t.z, 0.4);
      yield;
    }
    const m = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    if (m) { m.castShadow = shadows; m.receiveShadow = true; m.matrixAutoUpdate = false; group.add(m); }
    const gm = glow.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    if (gm) { gm.matrixAutoUpdate = false; group.add(gm); }
  }

  let built = false;
  return {
    info: () => ({ built }),
    update(car) {
      if (built || !car || Math.hypot(car.x - C[0], car.z - C[1]) > 400 || !world.ready(C[0], C[1])) return;
      built = true;
      jobs.add(build, 'old town gates');
    },
  };
}
