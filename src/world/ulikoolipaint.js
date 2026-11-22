// Road paint of the Ülikooli and Jakobi area (Martin, 22 Nov: kaardista, the last piece). From the Street View
// shots of Aug 2024:
//  - no centre lines: the old town's streets have none (setts on Rüütli, Küütri, Lossi and behind the town
//    hall, plain asphalt on Jakobi, Munga and Ülikooli), so the map's own dashes are left out here;
//  - Jakobi below Jakobi 4: short blue marks across the kerb side of the road, the ends of the parking bays;
//  - Lossi by the language centre: the yellow no-stopping line along the north kerb.
// No street name is painted on the road (the names in the shots are Google's).
//
// Freeze frames: some seventy flat rectangles in one mesh, made in the work queue when the car is within 300 m.
import * as THREE from 'three';
import { jobs } from '../jobs.js';
import { still } from '../still.js';

// [reach from the centre line (half the road's width in the game and a little more), the street's line]
const STREETS = [
  [4.5, [[1275.8, 2651.5], [1290.5, 2681.4], [1292.6, 2688.1], [1307.5, 2777.3], [1329.4, 2819.7], [1336.9, 2836.2], [1347.5, 2850.4], [1383.7, 2893.6], [1390.6, 2902.0], [1411.2, 2930.3], [1434.6, 2964.1]]],   // Ülikooli, Munga to Poe
  [5.0, [[1307.5, 2777.3], [1273.7, 2789.3], [1253.8, 2794.9], [1231.9, 2799.9], [1227.4, 2799.2], [1222.8, 2796.4], [1212.4, 2779.5], [1195.8, 2754.0], [1192.1, 2748.4], [1170.0, 2719.5]]],                       // Jakobi
  [3.5, [[1275.8, 2651.5], [1246.4, 2668.6], [1221.9, 2684.7], [1206.8, 2694.3], [1170.0, 2719.5]]],                  // Munga
  [5.0, [[1292.6, 2688.1], [1287.9, 2700.1], [1240.9, 2709.1], [1235.7, 2707.0]]],                                    // the lane to the university's yard
  [4.0, [[1292.6, 2688.1], [1365.3, 2674.1], [1382.7, 2671.1], [1451.4, 2656.4]]],                                    // Gildi
  [5.5, [[1365.3, 2674.1], [1391.2, 2745.1], [1426.5, 2844.6]]],                                                      // Rüütli
  [6.0, [[1307.5, 2777.3], [1391.2, 2745.1], [1472.1, 2713.1]]],                                                      // Küütri
  [4.5, [[1145.3, 2916.4], [1247.2, 2873.9], [1336.9, 2836.2]]],                                                      // Lossi
  [3.0, [[1434.6, 2964.1], [1462.6, 2946.4]]],                                                                        // Poe, the first steps
];
const near = (x, z, line, d) => {
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < d) return true;
  }
  return false;
};

// where the generated road lines are left out
export function ulikooliPaintVectors(vectors) {
  const prev = vectors.markSkip;
  vectors.markSkip = (x, z) => (x > 1130 && x < 1480 && z > 2640 && z < 2975 && STREETS.some(([d, line]) => near(x, z, line, d))) || (prev ? prev(x, z) : false);
}

const BLUE = 0x3f6fc0, YELLOW = 0xdcb93a;
const JAKOBI = [[1222.8, 2796.4], [1212.4, 2779.5], [1195.8, 2754.0]];             // uphill past Jakobi 4, the bays on the left
const LOSSI = [[1257.0, 2869.8], [1318.0, 2844.2]];                               // along the language centre, the line on the left

export function createUlikooliPaint(scene, world) {
  const group = still(new THREE.Group());
  scene.add(group);
  let built = false;
  function* build() {
    const pos = [], col = [], tint = new THREE.Color();
    const h = (x, z) => world.heightAt(x, z) + 0.09;
    // a flat strip from a to b, w wide, in pieces short enough to follow the slope
    const strip = (a, b, w, hex) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(len / 1.2)), nx = -dz / len * w / 2, nz = dx / len * w / 2;
      tint.set(hex);
      for (let i = 0; i < n; i++) {
        const p = [a[0] + dx * i / n, a[1] + dz * i / n], q = [a[0] + dx * (i + 1) / n, a[1] + dz * (i + 1) / n];
        const c = [[p[0] + nx, p[1] + nz], [p[0] - nx, p[1] - nz], [q[0] + nx, q[1] + nz], [q[0] - nx, q[1] - nz]].map(([x, z]) => [x, h(x, z), z]);
        for (const v of [c[0], c[1], c[2], c[2], c[1], c[3]]) { pos.push(v[0], v[1], v[2]); col.push(tint.r, tint.g, tint.b); }
      }
    };
    // along a line, on its left-hand side: fn(point on the line, unit vector along, unit vector to the left)
    const along = (line, step, fn) => {
      let carry = step / 2;
      for (let i = 0; i < line.length - 1; i++) {
        const a = line[i], b = line[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
        let d = carry;
        for (; d <= len; d += step) fn([a[0] + ux * d, a[1] + uz * d], [ux, uz], [uz, -ux]);
        carry = d - len;
      }
    };
    along(JAKOBI, 5.6, (p, u, l) => strip([p[0] + l[0] * 2.3, p[1] + l[1] * 2.3], [p[0] + l[0] * 4.15, p[1] + l[1] * 4.15], 0.14, BLUE));
    yield;
    { const [a, b] = LOSSI, len = Math.hypot(b[0] - a[0], b[1] - a[1]), l = [(b[1] - a[1]) / len, -(b[0] - a[0]) / len]; strip([a[0] + l[0] * 3.05, a[1] + l[1] * 3.05], [b[0] + l[0] * 3.05, b[1] + l[1] * 3.05], 0.12, YELLOW); }
    yield;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, side: THREE.DoubleSide }));
    m.receiveShadow = true;
    group.add(m);
  }
  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - 1240, car.z - 2820) > 300) return;
      if (![[1210, 2775], [1290, 2857]].every((q) => world.ready(q[0], q[1]))) return;
      built = true;
      jobs.add(build, 'ulikooli paint');
    },
  };
}
