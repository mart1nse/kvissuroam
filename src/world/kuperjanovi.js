// The white functionalist house on the corner of Kuperjanovi and Veski, just after the lap turns left
// at the end of Veski (Martin, 18 Nov, from his street views of Aug 2024 and a kaldaerofoto), built by hand
// in place of the LOD2 model, in pastel colours:
//   - four storeys of white render over a dark grey ground floor, a thin flat eave all round, a low grey
//     hipped roof with skylights and two chimneys
//   - the round corner bay towards the junction: curved bands of tall windows on the first and second
//     floors with white ledges between, dark brown cladding and the shop door below, a porthole above
//   - stacked balconies with black railings beside the bay on both faces
//   - wide three-pane and narrow two-pane windows in brown wooden frames, round portholes on the top floor,
//     brown doors and shop windows on the ground floor, grey downpipes
import * as THREE from 'three';
import { Parts, BOX } from '../race/landmarks.js';
import { setHouseColours } from './streetkit.js';

// the four walls from the LOD2 model (game x, z): north along Kuperjanovi, west towards the junction
const N = [[899.7, 3280.15], [871.45, 3286.2]];
const W = [[870.5, 3287.45], [875.65, 3299.95]];
const E = [[899.7, 3280.15], [902.7, 3294.15]];
const S = [[902.7, 3294.15], [875.65, 3299.95]];
const BASE = 30.51, EAVE = 12.3, RIDGE = 14.4, R = 2.6;             // ground (world y), eave and ridge above it, corner bay radius
const FLOORS = [0, 3.0, 6.1, 9.2];                                    // floor levels above the ground
const CENTRE = [886, 3290];
const COL = {
  render: 0xf3f4f8, ground: 0x8f8c97, groundDark: 0x6f6b75, clad: 0x6a5252, wood: 0xa8705e, door: 0x9a6650,
  glass: 0x75879e, mullion: 0xf7f7fa, ledge: 0xfbfbfd, rail: 0x2a2a30, roof: 0x8f95a6, roofDark: 0x6f7586,
  skylight: 0x3d4656, pipe: 0xb9bcc6, chimney: 0xb4b2bb,
};

export function kuperjanoviWalls(walls) {
  setHouseColours(walls, '2_6', 480, 3040, [{ base: 3051, x: 883.3, z: 3292.2, wall: 0xf3f4f8, hide: true, reach: 22 }]);
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const unit = (v) => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };
function meet(p, d, q, e) {                                           // where p + t d crosses q + s e
  const den = d[0] * e[1] - d[1] * e[0], t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den;
  return [p[0] + d[0] * t, p[1] + d[1] * t];
}
// the house's outline pushed out by `off` metres (in for off < 0), the corner bay as an arc
function outline(off, seg = 16) {
  const dN = unit(sub(N[1], N[0])), nN = [-dN[1], dN[0]];
  const dW = unit(sub(W[1], W[0])), nW = [-dW[1], dW[0]];
  const dE = unit(sub(E[1], E[0])), nE = [dE[1], -dE[0]];
  const dS = unit(sub(S[1], S[0])), nS = [dS[1], -dS[0]];
  const sh = (p, n, o) => [p[0] + n[0] * o, p[1] + n[1] * o];
  const ne = meet(sh(N[0], nN, off), dN, sh(E[0], nE, off), dE);
  const se = meet(sh(E[0], nE, off), dE, sh(S[0], nS, off), dS);
  const sw = meet(sh(S[0], nS, off), dS, sh(W[0], nW, off), dW);
  const O = meet(sh(N[0], nN, -R), dN, sh(W[0], nW, -R), dW);         // the bay's centre
  const a0 = Math.atan2(nN[1], nN[0]), a1 = Math.atan2(nW[1], nW[0]);
  let da = a1 - a0;
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;
  const arc = [];
  for (let k = 0; k <= seg; k++) { const a = a0 + da * k / seg; arc.push([O[0] + Math.cos(a) * Math.max(0.05, R + off), O[1] + Math.sin(a) * Math.max(0.05, R + off)]); }
  return { pts: [ne, ...arc, sw, se], O, a0, da, dN, nN, dW, nW, arc };
}

export function createKuperjanovi(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function build() {
    built = true;
    const p = new Parts();
    const y0 = BASE;
    // a vertical prism over an outline, from height a to b above the ground
    const prism = (pts, a, b, hex) => {
      const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: b - a, bevelEnabled: false, curveSegments: 1 });
      g.rotateX(-Math.PI / 2);
      p.add(g, hex, 0, y0 + a, 0);
    };
    const body = outline(0);
    prism(outline(0.02).pts, -0.8, 0.45, COL.groundDark);          // plinth
    prism(outline(0.01).pts, 0.45, FLOORS[1], COL.ground);          // the dark ground floor
    prism(body.pts, FLOORS[1] - 0.02, EAVE, COL.render);
    prism(outline(0.06).pts, FLOORS[1] - 0.06, FLOORS[1] + 0.1, COL.ledge);
    prism(outline(0.42).pts, EAVE, EAVE + 0.18, COL.ledge);         // the thin flat eave

    // the roof: a low hip from the eave outline to an inner ridge outline
    {
      const lo = outline(0.3).pts, hi = outline(-3.4).pts, pos = [];
      const ya = y0 + EAVE + 0.18, yb = y0 + RIDGE;
      for (let k = 0; k < lo.length; k++) {
        const a = lo[k], b = lo[(k + 1) % lo.length], c = hi[(k + 1) % hi.length], d = hi[k];
        pos.push(a[0], ya, a[1], b[0], ya, b[1], c[0], yb, c[1], a[0], ya, a[1], c[0], yb, c[1], d[0], yb, d[1]);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      // wind every face outwards (up)
      const P = g.attributes.position.array;
      for (let t = 0; t < P.length; t += 9) {
        const ux = P[t + 3] - P[t], uy = P[t + 4] - P[t + 1], uz = P[t + 5] - P[t + 2], vx = P[t + 6] - P[t], vy = P[t + 7] - P[t + 1], vz = P[t + 8] - P[t + 2];
        if (uz * vx - ux * vz >= 0) continue;                       // y of the cross product is up already
        for (let q = 0; q < 3; q++) { const s = P[t + 3 + q]; P[t + 3 + q] = P[t + 6 + q]; P[t + 6 + q] = s; }
      }
      g.computeVertexNormals();
      p.add(g, COL.roof, 0, 0, 0);
      const top = new THREE.Shape(hi.map(([x, z]) => new THREE.Vector2(x, -z)));
      const tg = new THREE.ShapeGeometry(top).rotateX(-Math.PI / 2);
      p.add(tg, COL.roofDark, 0, yb + 0.01, 0);
    }

    // ---- flat-wall frames: s along the wall from `a` (the bay end), n out to the street
    const face = (a, d, n) => ({
      at: (s, o) => [a[0] + d[0] * s + n[0] * o, a[1] + d[1] * s + n[1] * o],
      yaw: Math.atan2(-d[1], d[0]),
    });
    const tN = body.arc[0], tW = body.arc[body.arc.length - 1];      // where the bay meets the two flat walls
    const FN = face(tN, [-body.dN[0], -body.dN[1]], body.nN);         // along Kuperjanovi, away from the corner
    const FW = face(tW, body.dW, body.nW);                            // along the junction side, away from the corner
    const slab = (F, s0, s1, a, b, off, th, hex) => { const [x, z] = F.at((s0 + s1) / 2, off + th / 2); p.add(BOX(s1 - s0, b - a, th), hex, x, y0 + (a + b) / 2, z, F.yaw); };
    // a window in a brown wooden frame with white reveals and sill, `panes` across
    const win = (F, s0, s1, a, b, panes = 2) => {
      slab(F, s0 - 0.12, s1 + 0.12, a - 0.1, b + 0.1, 0, 0.05, COL.mullion);
      slab(F, s0, s1, a, b, 0.03, 0.04, COL.wood);
      slab(F, s0 + 0.07, s1 - 0.07, a + 0.07, b - 0.07, 0.05, 0.03, COL.glass);
      for (let k = 1; k < panes; k++) { const s = s0 + (s1 - s0) * k / panes; slab(F, s - 0.035, s + 0.035, a, b, 0.06, 0.04, COL.wood); }
      slab(F, s0, s1, a + (b - a) * 0.72, a + (b - a) * 0.72 + 0.06, 0.06, 0.04, COL.wood);   // transom
      slab(F, s0 - 0.15, s1 + 0.15, a - 0.16, a - 0.08, 0, 0.16, COL.ledge);
    };
    const porthole = (F, s, y, r = 0.33) => {
      const [x, z] = F.at(s, 0.04);
      p.add(new THREE.CylinderGeometry(r + 0.08, r + 0.08, 0.05, 20).rotateX(Math.PI / 2), COL.mullion, x, y0 + y, z, F.yaw);
      const [gx, gz] = F.at(s, 0.08);
      p.add(new THREE.CylinderGeometry(r, r, 0.04, 20).rotateX(Math.PI / 2), COL.glass, gx, y0 + y, gz, F.yaw);
    };
    const door = (F, s0, s1, hex = COL.door) => { slab(F, s0 - 0.1, s1 + 0.1, 0.25, 2.45, 0, 0.05, COL.groundDark); slab(F, s0, s1, 0.3, 2.35, 0.03, 0.05, hex); slab(F, s0 + 0.1, s1 - 0.1, 1.5, 2.2, 0.07, 0.02, COL.glass); };
    const shop = (F, s0, s1) => { slab(F, s0, s1, 0.7, 2.55, 0.02, 0.05, COL.wood); slab(F, s0 + 0.08, s1 - 0.08, 0.78, 2.47, 0.05, 0.03, COL.glass); slab(F, s0 - 0.1, s1 + 0.1, 0.6, 0.7, 0, 0.14, COL.ledge); };
    // a balcony: slab, a black railing (top rail and bars), the door and a window behind it
    const balcony = (F, s0, s1, floor) => {
      const y = FLOORS[floor];
      slab(F, s0, s1, y - 0.04, y + 0.14, 0, 1.15, COL.ledge);
      const [ax, az] = F.at(s0 + 0.05, 1.08), [bx, bz] = F.at(s1 - 0.05, 1.08);
      const yaw = F.yaw, len = s1 - s0 - 0.1;
      p.add(BOX(len, 0.05, 0.05), COL.rail, (ax + bx) / 2, y0 + y + 1.12, (az + bz) / 2, yaw);
      p.add(BOX(len, 0.03, 0.03), COL.rail, (ax + bx) / 2, y0 + y + 0.32, (az + bz) / 2, yaw);
      for (let s = s0 + 0.08; s < s1 - 0.04; s += 0.12) { const [x, z] = F.at(s, 1.08); p.add(BOX(0.018, 0.98, 0.018), COL.rail, x, y0 + y + 0.64, z, yaw); }
      for (const s of [s0 + 0.05, s1 - 0.05]) for (let o = 0.12; o < 1.05; o += 0.12) { const [x, z] = F.at(s, o); p.add(BOX(0.018, 0.98, 0.018), COL.rail, x, y0 + y + 0.64, z, yaw); }
      win(F, s0 + 0.25, s0 + 1.15, y + 0.95, y + 2.5, 1);
      slab(F, s0 + 1.45, s0 + 2.35, y + 0.16, y + 2.5, 0.03, 0.05, COL.wood);
      slab(F, s0 + 1.53, s0 + 2.27, y + 0.9, y + 2.42, 0.06, 0.03, COL.glass);
    };
    const pipe = (F, s) => { const [x, z] = F.at(s, 0.12); p.add(new THREE.CylinderGeometry(0.06, 0.06, EAVE - 0.2, 8), COL.pipe, x, y0 + EAVE / 2, z); };

    // ---- the junction side (west face)
    for (const f of [1, 2]) balcony(FW, 0.15, 3.05, f);
    pipe(FW, 3.35);
    door(FW, 2.2, 3.1);
    for (const f of [1, 2]) {
      const y = FLOORS[f];
      win(FW, 3.9, 6.2, y + 0.85, y + 2.4, 3);
      win(FW, 7.15, 8.55, y + 0.85, y + 2.4, 2);
      win(FW, 9.4, 10.5, y + 0.85, y + 2.4, 2);
    }
    shop(FW, 3.9, 6.2); door(FW, 7.35, 8.35); shop(FW, 9.2, 10.6);
    porthole(FW, 1.6, 10.7); porthole(FW, 5.9, 10.7);
    for (const s of [3.4, 9.9]) slab(FW, s - 0.18, s + 0.18, 10.55, 10.91, 0.02, 0.04, COL.mullion);
    win(FW, 7.3, 8.4, 9.9, 11.3, 2);

    // ---- along Kuperjanovi (north face)
    const LN = Math.hypot(tN[0] - N[0][0], tN[1] - N[0][1]);
    for (const f of [1, 2]) balcony(FN, 0.15, 2.85, f);
    pipe(FN, 3.15);
    door(FN, 0.6, 1.5, COL.clad);
    for (let s = 3.7, k = 0; s < LN - 1.6; s += 3.05, k++) {
      const wide = k % 2 === 0, w = wide ? 2.2 : 1.4;
      for (const f of [1, 2]) win(FN, s, s + w, FLOORS[f] + 0.85, FLOORS[f] + 2.4, wide ? 3 : 2);
      if (k % 3 === 1) porthole(FN, s + w / 2, 10.7); else win(FN, s + (w - 1.1) / 2, s + (w + 1.1) / 2, 9.9, 11.3, 2);
      if (k === 2 || k === 6) door(FN, s + 0.2, s + 1.2); else shop(FN, s, s + w);
      if (k % 3 === 2) pipe(FN, s + w + 0.4);
    }

    // ---- the corner bay: curved window bands on the first and second floors, ledges, the shop door below
    {
      const { O, a0, da } = body;
      const at = (a, r) => [O[0] + Math.cos(a) * r, O[1] + Math.sin(a) * r];
      const tang = (a) => Math.atan2(-Math.cos(a), -Math.sin(a));     // yaw so that local x runs along the arc
      const n = 7, m = 0.12;
      for (const f of [1, 2]) {
        const y = FLOORS[f], ya = y + 0.75, yb = y + 2.5;
        for (let k = 0; k < n; k++) {
          const a = a0 + da * (k + 0.5) / n, w = Math.abs(da) * R / n;
          const [x, z] = at(a, R + 0.04);
          p.add(BOX(w - m, yb - ya, 0.05), COL.glass, x, y0 + (ya + yb) / 2, z, tang(a));
          const [fx, fz] = at(a, R + 0.07);
          p.add(BOX(w - m, 0.05, 0.04), COL.wood, fx, y0 + ya + (yb - ya) * 0.72, fz, tang(a));
        }
        for (let k = 0; k <= n; k++) {
          const a = a0 + da * k / n, [x, z] = at(a, R + 0.08);
          p.add(BOX(m + 0.04, yb - ya + 0.04, 0.12), COL.mullion, x, y0 + (ya + yb) / 2, z, tang(a));
        }
        // the white ledges under and over the band
        for (const [yy, out] of [[ya - 0.1, 0.22], [yb + 0.1, 0.16]]) {
          for (let k = 0; k < 16; k++) {
            const a = a0 + da * (k + 0.5) / 16, w = Math.abs(da) * (R + out / 2) / 16 + 0.04;
            const [x, z] = at(a, R + out / 2);
            p.add(BOX(w, 0.12, out + 0.02), COL.ledge, x, y0 + yy, z, tang(a));
          }
        }
      }
      // brown cladding and the shop door on the ground floor of the bay, a porthole at the top
      for (let k = 0; k < 16; k++) {
        const a = a0 + da * (k + 0.5) / 16, w = Math.abs(da) * R / 16 + 0.03, [x, z] = at(a, R + 0.03);
        p.add(BOX(w, 2.6, 0.04), COL.clad, x, y0 + 0.45 + 1.3, z, tang(a));
      }
      {
        const a = a0 + da * 0.5, [x, z] = at(a, R + 0.07);
        p.add(BOX(1.0, 2.2, 0.05), COL.door, x, y0 + 0.4 + 1.1, z, tang(a));
        const [gx, gz] = at(a, R + 0.1);
        p.add(BOX(0.7, 0.8, 0.02), COL.glass, gx, y0 + 1.95, gz, tang(a));
        const [px, pz] = at(a, R + 0.05);
        p.add(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 20).rotateX(Math.PI / 2), COL.mullion, px, y0 + 10.7, pz, tang(a));
        const [qx, qz] = at(a, R + 0.08);
        p.add(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 20).rotateX(Math.PI / 2), COL.glass, qx, y0 + 10.7, qz, tang(a));
      }
    }

    // ---- skylights and chimneys on the roof
    {
      const { pts } = outline(-1.6);
      const ne = pts[0], se = pts[pts.length - 1];
      for (let k = 1; k <= 4; k++) {
        const t = k / 5, x = N[1][0] + (N[0][0] - N[1][0]) * t, z = N[1][1] + (N[0][1] - N[1][1]) * t;
        const [ox, oz] = [x - body.nN[0] * 1.4, z - body.nN[1] * 1.4];
        p.add(BOX(0.8, 0.12, 1.0).rotateX(-0.45), COL.skylight, ox, y0 + EAVE + 0.95, oz, FN.yaw);
      }
      for (const [x, z] of [[ne[0] - 6, ne[1] + 4], [se[0] - 9, se[1] - 3]]) p.add(BOX(0.7, 1.4, 0.7), COL.chimney, x, y0 + RIDGE + 0.4, z, FN.yaw);
    }

    const mesh = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    if (mesh) { mesh.castShadow = shadows; mesh.receiveShadow = true; group.add(mesh); }
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 450) return;
      if ([N[0], N[1], S[0], S[1]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
