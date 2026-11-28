// Tallinn's town walls (Martin 28 Nov 2026, the Old Town in full detail). The map's buildings have the towers (they are
// in the Land Board's 3D houses) but not the walls between them. These are OpenStreetMap's city walls
// (tools/tln/marks.py -> marks.json `walls`), cut where a street goes through a gate: limestone 2 m thick and 11 m
// high over the ground, its foot sunk into the slope, under a dark shingled roof over the wall walk. Drawn with the
// map's own building material (src/world/scenery.js, style 3.4: rubble limestone) and solid for the cars.
// Built once, through the work queue, when the car comes within 1.3 km of the Old Town.
import * as THREE from 'three';
import { jobs } from '../../jobs.js';
import { still } from '../../still.js';
import { centreMarksData } from './centre.js';

const H = 11, T = 2.0, RIDGE = 1.3, EAVE = 0.3, SINK = 1.5;
const MID = [-5750, 2750], NEAR = 1300;

export function createCityWalls(scene, world, material) {
  const pieces = centreMarksData()?.walls || [];
  let built = !pieces.length || !material;
  const group = still(new THREE.Group());
  scene.add(group);
  const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
  const STONE = lin(0.63, 0.61, 0.55), ROOF = lin(0.3, 0.27, 0.25);

  function* build() {
    const pos = [], nor = [], col = [], kind = [], base = [], info = [], idx = [];
    const solids = [];
    let n = 0;
    // one quad from four corners (a b along the bottom, c d along the top), its normal, colour and kind
    const quad = (a, b, c, d, nx, ny, nz, C, k, gys, seed) => {
      for (const [p, gy] of [[a, gys[0]], [b, gys[1]], [c, gys[0]], [d, gys[1]]]) {
        pos.push(p[0], p[1], p[2]); nor.push(nx, ny, nz); col.push(C.r, C.g, C.b); kind.push(k); base.push(gy); info.push(H, 3.4, seed);
      }
      idx.push(n, n + 1, n + 2, n + 2, n + 1, n + 3);
      n += 4;
    };
    let count = 0;
    for (const P of pieces) {
      const seed = Math.round((Math.abs(Math.sin(P[0][0] * 12.9898 + P[0][1] * 78.233)) * 43758.5453 % 1) * 1023) / 1023;
      for (let i = 0; i + 1 < P.length; i++) {
        const [ax, az] = P[i], [bx, bz] = P[i + 1];
        const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz);
        if (l < 0.2) continue;
        const ux = dx / l, uz = dz / l, nx = -uz, nz = ux;          // nx, nz: across the wall
        // (each stretch is its own straight block, a little longer so the corners close)
        const e = Math.min(T / 2, l / 2);
        const x0 = ax - ux * e * 0.5, z0 = az - uz * e * 0.5, x1 = bx + ux * e * 0.5, z1 = bz + uz * e * 0.5;
        const g0 = world.heightAt(x0, z0), g1 = world.heightAt(x1, z1);
        let gmin = Math.min(g0, g1);
        for (let t = 0.25; t < 1; t += 0.25) gmin = Math.min(gmin, world.heightAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t));
        const f0 = gmin - SINK, t0 = g0 + H, t1 = g1 + H;
        const gys = [g0, g1];
        for (const sd of [1, -1]) {
          const ox = nx * sd * T / 2, oz = nz * sd * T / 2;
          // a face of the wall
          const A = sd > 0 ? [[x0 + ox, f0, z0 + oz], [x1 + ox, f0, z1 + oz], [x0 + ox, t0, z0 + oz], [x1 + ox, t1, z1 + oz]]
            : [[x1 + ox, f0, z1 + oz], [x0 + ox, f0, z0 + oz], [x1 + ox, t1, z1 + oz], [x0 + ox, t0, z0 + oz]];
          quad(A[0], A[1], A[2], A[3], nx * sd, 0, nz * sd, STONE, 0, sd > 0 ? gys : [g1, g0], seed);
          // its side of the roof: from the eave out over the face up to the ridge
          const ex = nx * sd * (T / 2 + EAVE), ez = nz * sd * (T / 2 + EAVE), ny = (T / 2 + EAVE), nh = RIDGE;
          const L = Math.hypot(ny, nh), rnx = nx * sd * nh / L, rnz = nz * sd * nh / L, rny = ny / L;
          const R = sd > 0 ? [[x0 + ex, t0 - 0.1, z0 + ez], [x1 + ex, t1 - 0.1, z1 + ez], [x0, t0 + RIDGE, z0], [x1, t1 + RIDGE, z1]]
            : [[x1 + ex, t1 - 0.1, z1 + ez], [x0 + ex, t0 - 0.1, z0 + ez], [x1, t1 + RIDGE, z1], [x0, t0 + RIDGE, z0]];
          quad(R[0], R[1], R[2], R[3], rnx, rny, rnz, ROOF, 1, sd > 0 ? gys : [g1, g0], seed);
        }
        // the ends (seen at a gate)
        for (const [ex, ez, gy, top, s] of [[x0, z0, g0, t0, -1], [x1, z1, g1, t1, 1]]) {
          const a = [ex + nx * T / 2 * s, f0, ez + nz * T / 2 * s], b = [ex - nx * T / 2 * s, f0, ez - nz * T / 2 * s];      // (wound to face out)
          quad(a, b, [a[0], top, a[2]], [b[0], top, b[2]], ux * s, 0, uz * s, STONE, 0, [gy, gy], seed);
        }
        solids.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, yaw: Math.atan2(-uz, ux), hx: (l + e) / 2, hz: T / 2 });
        if (++count % 60 === 0 && jobs.late()) yield;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
    geo.setAttribute('aBase', new THREE.Float32BufferAttribute(base, 1));
    geo.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 3));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    yield;
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    world.addSolids(solids);
  }

  return {
    info: () => ({ pieces: pieces.length, built: group.children.length }),
    update(car) {
      if (built || !car || Math.hypot(car.x - MID[0], car.z - MID[1]) > NEAR) return;
      built = true;
      jobs.add(function* cityWalls() { yield* build(); }, 'city walls');
    },
  };
}
