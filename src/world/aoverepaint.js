// Road paint at the Haava junction, Aovere (Martin, 23 Nov: kaardista "Aovere junction", the last piece). From
// the Land Board's 10 cm orthophoto and his far shots from roads 43 and 44:
//  - the long band of diagonal hatching on road 3 south of the junction, between the southbound lane and the
//    left-turn lane, from the median island to where the lanes part, 60 m;
//  - the chevron-hatched gore after the median island where the lane to road 44 and Olerex leaves road 3;
//  - the hatched wedge west of the north-west island, tapering to the north.
// The zebra the street photos' map put across road 44 between the islands is not there (the photos show plain
// tarmac): left out. The map's own lines are left out under the hatching. No street name is painted on the road
// (the names in Street View are Google's).
//
// Freeze frames: a few hundred flat rectangles in one mesh, made in the work queue when the car is within 400 m.
import * as THREE from 'three';
import { jobs } from '../jobs.js';
import { still } from '../still.js';

// convex hatched areas: outline (map points, in order), stripe direction (a unit vector on the map), spacing
const AREAS = [
  // road 3 south of the junction: the band, square at the north end, tapering at the south
  { poly: [[6090.0, -4829], [6094.0, -4829], [6094.0, -4785], [6090.6, -4766], [6090.0, -4766]], dir: [0.6, 0.8], step: 2.0 },
  // the gore after the median island: chevrons pointing south, to its tip
  { poly: [[6095.6, -4837], [6101.6, -4837], [6100.4, -4811.5]], chevron: true, step: 2.6 },
  // the wedge west of the north-west island
  { poly: [[6093.6, -4868], [6094.4, -4868], [6096.5, -4858], [6097.0, -4847.6], [6092.6, -4847.6], [6092.6, -4858]], dir: [0.6, 0.8], step: 2.0 },
];
const FALSE_ZEBRA = [6121.1, -4842.3];

// is (x, z) inside the convex polygon, widened by m metres
function inside(poly, x, z, m = 0) {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    const c = (dx * (z - a[1]) - dz * (x - a[0])) / l;
    if (Math.abs(c) <= m) continue;
    const s = Math.sign(c);
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}
// the piece of the line through p along d that lies inside the polygon, or null
function clip(poly, p, d) {
  let t0 = -1e9, t1 = 1e9;
  const cx = poly.reduce((s, q) => s + q[0], 0) / poly.length, cz = poly.reduce((s, q) => s + q[1], 0) / poly.length;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    let nx = -(b[1] - a[1]), nz = b[0] - a[0];
    if (nx * (cx - a[0]) + nz * (cz - a[1]) < 0) { nx = -nx; nz = -nz; }       // the normal pointing inwards
    const den = nx * d[0] + nz * d[1], num = nx * (p[0] - a[0]) + nz * (p[1] - a[1]);
    if (Math.abs(den) < 1e-9) { if (num < 0) return null; continue; }
    const t = -num / den;
    if (den > 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
  }
  return t1 - t0 > 0.3 ? [[p[0] + d[0] * t0, p[1] + d[1] * t0], [p[0] + d[0] * t1, p[1] + d[1] * t1]] : null;
}

// where the generated road lines are left out
export function aoverePaintVectors(vectors) {
  const prev = vectors.markSkip;
  vectors.markSkip = (x, z) => (x > 6085 && x < 6105 && z > -4870 && z < -4764 && AREAS.some((A) => inside(A.poly, x, z, 0.7))) || (prev ? prev(x, z) : false);
}

// the false zebra across road 44 (a Mapillary crossing where there is none)
export function aovereClear(data) {
  const out = [];
  for (const [key, a] of Object.entries(data.sectors)) {
    for (let k = 0; k < a.length; k += data.stride) {
      if (a[k] === 7 && Math.hypot(a[k + 1] - FALSE_ZEBRA[0], a[k + 2] - FALSE_ZEBRA[1]) < 4) out.push(`${key}:${k / data.stride}`);
    }
  }
  return out;
}

export function createAoverePaint(scene, world) {
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
    for (const A of AREAS) {
      const P = A.poly;
      for (let i = 0; i < P.length; i++) strip(P[i], P[(i + 1) % P.length], 0.15);    // the outline
      if (A.chevron) {
        // V's whose arms run from the two long sides to the middle line, the point towards the tip
        const tip = P[2], l = P[0], r = P[1], mid = [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2];
        const len = Math.hypot(tip[0] - mid[0], tip[1] - mid[1]);
        for (let s = A.step * 0.6; s < len - 2; s += A.step) {
          const t = s / len, c = [mid[0] + (tip[0] - mid[0]) * t, mid[1] + (tip[1] - mid[1]) * t];
          const tb = Math.max(0, t - 2.2 / len);                                   // the arms reach 2.2 m back
          for (const e of [l, r]) {
            const ex = e[0] + (tip[0] - e[0]) * tb - c[0], ez = e[1] + (tip[1] - e[1]) * tb - c[1], el = Math.hypot(ex, ez);
            const piece = clip(P, c, [ex / el, ez / el]);
            if (piece) strip(c, piece[1], 0.4);
          }
        }
      } else {
        // parallel stripes along dir, every step metres measured across them
        const d = A.dir, n = [-d[1], d[0]];
        const ks = P.map((q) => q[0] * n[0] + q[1] * n[1]), k0 = Math.min(...ks), k1 = Math.max(...ks);
        for (let k = k0 + A.step / 2; k < k1; k += A.step) {
          const piece = clip(P, [n[0] * k, n[1] * k], d);
          if (piece) strip(piece[0], piece[1], 0.45);
        }
      }
      yield;
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
      if (Math.hypot(car.x - 6100, car.z + 4815) > 400) return;
      if (![[6092, -4830], [6095, -4860], [6092, -4770]].every((q) => world.ready(q[0], q[1]))) return;
      built = true;
      jobs.add(build, 'aovere paint');
    },
  };
}
