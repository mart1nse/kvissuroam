// Road paint of road 2 at the Lennu interchange, Ülenurme (Martin, 22 Nov: the airport kaardista, the last piece).
// From the Land Board's orthophoto and his Street View shots of June 2023 to June 2025:
//  - the two solid lines either side of the steel guard rail between the carriageways (src/world/ulenurme.js);
//  - south of where the rail ends, the painted wedge between the carriageways with its diagonal hatching;
//  - the chevron-hatched gore where the ramp to the roundabout leaves the northbound carriageway.
// The map's own dashes are left out under these. No street name is painted on the road (the names in the shots
// are Google's).
//
// Freeze frames: a few hundred flat rectangles in one mesh, made in the work queue when the car is within 400 m.
import * as THREE from 'three';
import { jobs } from '../jobs.js';
import { still } from '../still.js';

// the guard rail's line (as in ulenurme.js), and the wedge south of it: left and right edges, north to south
const MEDIAN = [[1537.0, 10120], [1539.6, 10140], [1542.5, 10170], [1546.0, 10200], [1549.5, 10240], [1551.4, 10265], [1552.4, 10287]];
const WEDGE_L = [[1551.6, 10289], [1550.0, 10297], [1549.6, 10346]], WEDGE_R = [[1553.2, 10289], [1554.0, 10297], [1550.0, 10346]];
// the gore: its point to the north, its two edges to the south where the ramp leaves
const GORE = { tip: [1554.0, 10182], l: [1557.8, 10245], r: [1561.6, 10245] };

const near = (x, z, line, d) => {
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < d) return true;
  }
  return false;
};
// x of a north-to-south polyline at z
const xAt = (line, z) => {
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    if (z >= a[1] && z <= b[1]) return a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]);
  }
  return z < line[0][1] ? line[0][0] : line[line.length - 1][0];
};
const inGore = (x, z) => {
  if (z < GORE.tip[1] || z > GORE.l[1]) return false;
  const t = (z - GORE.tip[1]) / (GORE.l[1] - GORE.tip[1]);
  return x > GORE.tip[0] + (GORE.l[0] - GORE.tip[0]) * t - 0.6 && x < GORE.tip[0] + (GORE.r[0] - GORE.tip[0]) * t + 0.6;
};

// where the generated road lines are left out
export function ulenurmePaintVectors(vectors) {
  const prev = vectors.markSkip;
  vectors.markSkip = (x, z) => (x > 1530 && x < 1570 && z > 10110 && z < 10350
    && (near(x, z, MEDIAN, 1.3) || (z > 10287 && z < 10348 && x > xAt(WEDGE_L, z) - 0.8 && x < xAt(WEDGE_R, z) + 0.8) || inGore(x, z))) || (prev ? prev(x, z) : false);
}

export function createUlenurmePaint(scene, world) {
  const group = still(new THREE.Group());
  scene.add(group);
  let built = false;
  function* build() {
    const pos = [];
    const h = (x, z) => world.heightAt(x, z) + 0.09;
    // a flat strip from a to b, w wide, in pieces short enough to follow the slope
    const strip = (a, b, w) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
      if (len < 0.05) return;
      const n = Math.max(1, Math.ceil(len / 1.5)), nx = -dz / len * w / 2, nz = dx / len * w / 2;
      for (let i = 0; i < n; i++) {
        const p = [a[0] + dx * i / n, a[1] + dz * i / n], q = [a[0] + dx * (i + 1) / n, a[1] + dz * (i + 1) / n];
        const c = [[p[0] + nx, p[1] + nz], [p[0] - nx, p[1] - nz], [q[0] + nx, q[1] + nz], [q[0] - nx, q[1] - nz]].map(([x, z]) => [x, h(x, z), z]);
        for (const v of [c[0], c[1], c[2], c[2], c[1], c[3]]) pos.push(v[0], v[1], v[2]);
      }
    };
    const line = (pts, off, w = 0.15) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / l * off, nz = (b[0] - a[0]) / l * off;
        strip([a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], w);
      }
    };
    // the solid lines either side of the rail
    line(MEDIAN, 0.55); line(MEDIAN, -0.55);
    yield;
    // the wedge: its edges and the hatching across it, every 2 m
    line(WEDGE_L, 0); line(WEDGE_R, 0);
    for (let z = 10291; z < 10344; z += 2) {
      const a = [xAt(WEDGE_L, z), z], b = [xAt(WEDGE_R, z + 1.2), z + 1.2];
      if (b[0] - a[0] > 0.4) strip(a, b, 0.4);
    }
    yield;
    // the gore: its edges and the chevrons, pointing north, every 4 m
    strip(GORE.tip, GORE.l, 0.2); strip(GORE.tip, GORE.r, 0.2);
    for (let z = GORE.tip[1] + 6; z < GORE.l[1] - 1; z += 4) {
      const t = (z - GORE.tip[1]) / (GORE.l[1] - GORE.tip[1]);
      const xl = GORE.tip[0] + (GORE.l[0] - GORE.tip[0]) * t, xr = GORE.tip[0] + (GORE.r[0] - GORE.tip[0]) * t, xm = (xl + xr) / 2, d = (xr - xl) / 2;
      if (d < 0.5) continue;
      strip([xl + 0.15, z + d * 0.8], [xm, z], 0.45); strip([xm, z], [xr - 0.15, z + d * 0.8], 0.45);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xf2f2ee, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, side: THREE.DoubleSide }));
    m.receiveShadow = true;
    group.add(m);
  }
  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - 1550, car.z - 10240) > 400) return;
      if (![[1540, 10140], [1552, 10300]].every((q) => world.ready(q[0], q[1]))) return;
      built = true;
      jobs.add(build, 'ulenurme paint');
    },
  };
}
