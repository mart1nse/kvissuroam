// Ground at Kaubamaja, laid over the map's surface (Martin, 18 Nov): the grass of the Riia median under its
// limes, the lane lines of Riia on both sides of it with the stop lines at the junction, and a red tint
// on the Küüni paving. Measured from the 2024 orthophoto. No names or numbers are painted on the road.
import * as THREE from 'three';
import { roadFrame, streetKit } from './streetkit.js';

const S = [1713.8, 3144.9], UB = [0.7189, -0.6951];      // Kaubamaja's south corner, along its Riia face towards the junction
const CENTRE = [1750, 3120];

// before the road markings are built: Küüni round Kaubamaja's west corner is a pedestrian street, the
// generated lane lines are left off where the red cross lies (Martin, 19 Nov)
export function keskusTeeVectors(vectors) {
  const W = [1659.6, 3088.7], UA = [0.6943, 0.7197], UB = [0.7189, -0.6951];
  const prev = vectors.markSkip;
  vectors.markSkip = (x, z) => {
    const a = (x - W[0]) * UA[0] + (z - W[1]) * UA[1], b = (x - W[0]) * UB[0] + (z - W[1]) * UB[1];
    return (a > -88 && a < 86 && b > -22 && b < 0) || (a > -26 && a < 1 && b > -27 && b < 8) || (prev ? prev(x, z) : false);
  };
}

export function createKeskusTee(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;
  function build() {
    built = true;
    const K = streetKit(world, group, { shadows });
    // Riia: t is the map x along the face, `out` metres from the roof edge towards Kvartal
    const F = roadFrame([[S[0] - UB[0] * 20, S[1] - UB[1] * 20], [S[0] + UB[0] * 130, S[1] + UB[1] * 130]], 0);
    const x = (s) => S[0] + UB[0] * s;
    const strip = (s0, s1, o0, o1, kind) => K.ribbon(F, x(s0), x(s1), -o0, -o1, kind, true);
    strip(3, 103, 17.7, 20.7, 'lawn');                                       // the median
    strip(3, 103, 17.45, 17.7, 'concrete'); strip(3, 103, 20.7, 20.95, 'concrete');
    const dashes = (s0, s1, o) => { for (let s = s0; s < s1; s += 6) strip(s, s + 2, o - 0.06, o + 0.06, 'white'); };
    dashes(4, 84, 14.9);                                                     // Kaubamaja side: two lanes
    for (const o of [24.0, 27.3, 30.6]) dashes(4, 78, o);                    // Kvartal side: four lanes
    for (const o of [24.0, 27.3, 30.6]) strip(78, 99, o - 0.06, o + 0.06, 'white');      // solid before the lights
    strip(84, 99, 14.84, 14.96, 'white');
    strip(99, 99.45, 21.2, 33.6, 'white');                                   // stop line towards the junction
    strip(1.5, 1.95, 12.4, 17.3, 'white');                                   // and the one before the Küüni crossing
    K.finish();
    redCross();
    junction();
  }
  // ---- the red brick cross round Kaubamaja's west corner, where the lap turns (Martin, 19 Nov, his lines on
  // the aerial): Küüni (the pedestrian street and the plaza by the kiosks) crossed by the mouth of Uueturu and
  // the way into the car park, with rounded inner corners. Only a see-through tint, so the cobbles of the
  // ground stay as they are and just turn a little red. In Kaubamaja's roof frame: a along the Küüni face from
  // the west corner, b along the park face (Küüni lies at b < 0, the car park at a < 0).
  function redCross() {
    const W = [1659.6, 3088.7], UA = [0.6943, 0.7197], UB = [0.7189, -0.6951];
    const at = (a, b) => [W[0] + UA[0] * a + UB[0] * b, W[1] + UA[1] * a + UB[1] * b];
    const BAR = { a0: -85, a1: 84, b0: -20.5, b1: -1.5 };                   // Küüni, the long bar of the cross
    const ARMS = [{ a0: -14, a1: 0, b0: -25, b1: BAR.b0 },                 // Uueturu side, between the office building and the kiosks
      { a0: -24, a1: 0, b0: BAR.b1, b1: 6 }];                              // car park side, up to its asphalt
    const R = 3;                                                            // radius of the inner corners
    const pos = [];
    const put = (q) => { const [x, z] = at(q[0], q[1]); pos.push(x, world.heightAt(x, z) + 0.09, z); };
    const tri = (p, q, r) => {          // wound to face up (the frame is left-handed on the map)
      const [x1, z1] = at(...p), [x2, z2] = at(...q), [x3, z3] = at(...r);
      const up = (z2 - z1) * (x3 - x1) - (x2 - x1) * (z3 - z1) > 0;
      for (const v of up ? [p, q, r] : [p, r, q]) put(v);
    };
    const rect = ({ a0, a1, b0, b1 }) => {
      const na = Math.ceil(a1 - a0), nb = Math.ceil(b1 - b0);
      for (let i = 0; i < na; i++) for (let j = 0; j < nb; j++) {
        const A0 = a0 + (a1 - a0) * i / na, A1 = a0 + (a1 - a0) * (i + 1) / na, B0 = b0 + (b1 - b0) * j / nb, B1 = b0 + (b1 - b0) * (j + 1) / nb;
        tri([A0, B0], [A1, B0], [A0, B1]); tri([A1, B0], [A1, B1], [A0, B1]);
      }
    };
    // an inner corner at c, filling towards (sa, sb): the square off the corner less the circle's quarter
    const fillet = (c, sa, sb) => {
      const o = [c[0] + sa * R, c[1] + sb * R], n = 8;
      for (let k = 0; k < n; k++) {
        const t0 = (k / n) * Math.PI / 2, t1 = ((k + 1) / n) * Math.PI / 2;
        const p = (t) => [o[0] - sa * R * Math.cos(t), o[1] - sb * R * Math.sin(t)];
        tri(c, p(t0), p(t1));
      }
    };
    rect(BAR); ARMS.forEach(rect);
    fillet([ARMS[0].a0, BAR.b0], -1, -1);       // by the office building
    fillet([ARMS[0].a1, BAR.b0], 1, -1);        // by the kiosks
    fillet([ARMS[1].a0, BAR.b1], -1, 1);        // by the sculptures
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const nor = new Float32Array(pos.length);
    for (let k = 1; k < nor.length; k += 3) nor[k] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({
      color: 0xe0705e, transparent: true, opacity: 0.3, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, side: THREE.DoubleSide,
    }));
    m.receiveShadow = true;
    m.renderOrder = 1;
    group.add(m);
  }
  // ---- the junction itself: hatching, the dotted lines that lead turning
  // traffic through, lane lines on the Turu arm. Flat triangles laid on the ground, wound to face up.
  function junction() {
    const white = [];
    const y = (x, z, lift) => world.heightAt(x, z) + lift;
    const tri = (out, a, b, c, lift) => {
      const up = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) > 0;
      for (const q of up ? [a, b, c] : [a, c, b]) out.push(q[0], y(q[0], q[1], lift), q[1]);
    };
    const seg = (a, b, w, out = white, lift = 0.1) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2;
      const q = [[a[0] + nx, a[1] + nz], [a[0] - nx, a[1] - nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz]];
      tri(out, q[0], q[1], q[2], lift); tri(out, q[2], q[1], q[3], lift);
    };
    // a line along a polyline: solid, or marks `on` metres long every `step` metres
    const line = (pts, w, on = 0, step = 0) => {
      let carry = 0;
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], b = pts[k], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (!on) { seg(a, b, w); continue; }
        for (let s = carry; s < l; s += step) {
          const e = Math.min(l, s + on), p = (t) => [a[0] + (b[0] - a[0]) * t / l, a[1] + (b[1] - a[1]) * t / l];
          seg(p(s), p(e), w);
        }
        carry = (carry - l) % step; if (carry < 0) carry += step;
      }
    };
    // the islands themselves are left as the map has them (Martin, 19 Nov: the pale patches looked wrong)
    // dotted lines leading the turns through the junction
    const dots = (pts) => {
      const fine = [];
      for (let k = 0; k < pts.length - 1; k++) for (let t = 0; t < 4; t++) {            // Catmull-Rom through the measured points
        const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(pts.length - 1, k + 2)], u = t / 4;
        fine.push([0, 1].map((i) => 0.5 * (2 * p1[i] + (p2[i] - p0[i]) * u + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * u * u + (3 * p1[i] - p0[i] - 3 * p2[i] + p3[i]) * u * u * u)));
      }
      fine.push(pts[pts.length - 1]);
      line(fine, 0.14, 0.5, 1.5);
    };
    dots([[1805, 3076.6], [1808.5, 3074.5], [1813, 3073.6], [1817.5, 3074], [1821, 3075]]);
    dots([[1811, 3069.5], [1816, 3071.75], [1821, 3072.75], [1826.5, 3072.25], [1830, 3071]]);
    dots([[1829, 3060], [1825, 3063.5], [1822.5, 3067.5], [1821.25, 3072.5], [1821.25, 3077.5], [1822.5, 3082.5], [1825, 3087.5], [1828.5, 3092], [1833, 3096]]);
    dots([[1825, 3077], [1830, 3080], [1834, 3084]]);
    // the hatched strip between the two directions of the bridge arm
    {
      const a = [1831.75, 3063.5], b = [1850.25, 3044.75], l = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l, nx = -uz, nz = ux, hw = 1.6;
      for (const o of [-hw, hw]) seg([a[0] + nx * o, a[1] + nz * o], [b[0] + nx * o, b[1] + nz * o], 0.14);
      for (let s = 0.8; s < l - 1.2; s += 1.9) seg([a[0] + ux * s + nx * hw, a[1] + uz * s + nz * hw], [a[0] + ux * (s + 1.3) - nx * hw, a[1] + uz * (s + 1.3) - nz * hw], 0.4);
    }
    // Turu arm towards Kvartal's far side: solid lane lines out of the junction
    for (const [x, z] of [[1837.3, 3082.2], [1839.5, 3080.0], [1841.8, 3077.7]]) seg([x + 1.5, z + 1.5], [x + 9.5, z + 9.5], 0.12);
    const flat = (pos, colour, f) => {
      if (!pos.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const nor = new Float32Array(pos.length);
      for (let k = 1; k < nor.length; k += 3) nor[k] = 1;
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: colour, polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f, side: THREE.DoubleSide }));
      m.receiveShadow = true;
      group.add(m);
    };
    flat(white, 0xf6f3fa, -7);
    carPark(seg);
  }
  // ---- Kaubamaja's car park along the park face (Street View Aug 2024, kaldaerofoto Apr 2019): a row of
  // angled bays by the columns and one along the tree verge, blue bay lines, the yellow hatched box at the
  // entrance at the far end and a yellow line along the kerb by the plaza
  function carPark(seg) {
    const W = [1659.6, 3088.7], UA = [0.6943, 0.7197], UB = [0.7189, -0.6951];
    const at = (a, b) => [W[0] + UA[0] * a + UB[0] * b, W[1] + UA[1] * a + UB[1] * b];
    const blue = [], yellow = [];
    const ROWS = [[-4, -9.5], [-20.5, -26]], LEAN = 5.5 / Math.tan(Math.PI / 3), STEP = 2.6 / Math.sin(Math.PI / 3);
    for (const [a0, a1] of ROWS) {
      const b1 = a0 === -4 ? 90 : 97;
      for (let b = 12; b <= b1; b += STEP) seg(at(a0, b), at(a1, b - LEAN), 0.12, blue);
      seg(at(a1, 12 - LEAN), at(a1, b1 - LEAN), 0.12, blue);                         // the line across the bay ends
    }
    // the hatched box before the first bays at the entrance end, and the kerb line by the plaza
    const box = [[-4, 92], [-9.5, 92], [-9.5, 101], [-4, 101]].map(([a, b]) => at(a, b));
    for (let k = 0; k < 4; k++) seg(box[k], box[(k + 1) % 4], 0.14, yellow);
    seg(box[0], box[2], 0.14, yellow); seg(box[1], box[3], 0.14, yellow);
    seg(at(-4, 3), at(-4, 12), 0.12, yellow);
    for (const [pos, colour] of [[blue, 0x7fa6e8], [yellow, 0xf2d36b]]) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const nor = new Float32Array(pos.length);
      for (let k = 1; k < nor.length; k += 3) nor[k] = 1;
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: colour, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7, side: THREE.DoubleSide }));
      m.receiveShadow = true;
      group.add(m);
    }
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 900) return;
      if ([[1650, 3080], [1600, 3050], [1700, 3010], [1720, 3160], [1805, 3085], [1770, 3110], [1850, 3045], [1840, 3096]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
