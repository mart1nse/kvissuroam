// The small park in front of the Vanemuine theatre, between Ülikooli and the theatre's front (Martin, 20 Nov:
// "the small park, all the small details and how the road looks under Vanemuine"). Measured on the Land Board's
// orthophoto and its oblique air photos (2024):
//  - two lawns in the shared grass, cut by the slab path that runs from the Ülikooli corner to the theatre door,
//    edged with low white bollards;
//  - the Eduard Tubin memorial: a pale stone platform with rows of short dark round posts on it, a dark parapet
//    along the forecourt and steps at its corner (what the posts are is read from the air photos only);
//  - four benches and two bins along the Ülikooli pavement, where the map's survey has them;
//  - the forecourt under the theatre front is pale granite paving, not a street: the map's 11.6 m road there got
//    lane lines, which are left off now (only the asphalt car park in front of the side wing stays asphalt).
// The theatre walls themselves are painted in vanemuise.js. No names are painted on the ground.
import * as THREE from 'three';
import { areaKit, frame } from './handbuilt.js';
import { BOX } from '../race/landmarks.js';

// s metres along Ülikooli from the Vanemuise corner towards Kalevi, v metres from its centre towards the theatre
const F = frame([1591, 3154], [0.658, 0.753]);
// the slab path's centre line, from the Ülikooli pavement to the forecourt
const P0 = [16, 16], P1 = [39, 44];
const pathV = (s) => P0[1] + (s - P0[0]) * (P1[1] - P0[1]) / (P1[0] - P0[0]);
const PATH_HV = 1.5 / Math.cos(Math.atan2(P1[1] - P0[1], P1[0] - P0[0]));      // half its width, measured along v
const MEMO = { s0: 44, s1: 65, v0: 37.3, v1: 48.7 };                         // the Tubin memorial platform
// Ülikooli by the park (orthophoto, Street View Aug 2024): centre line at v -0.7, a lane line at 5.3, the
// parking and bus stop strip from 8.9 to the kerb at 13.4, blue angled bays (30 degrees, nose to the kerb) from
// the Vanemuise corner to the benches
const ULI = { centre: -0.7, lane: 5.3, edge: 8.9, kerb: 13.4 }, BAYS = [10, 15, 20, 25, 30, 35, 40, 45];
// Vanemuise tn along the park: taxi bays between a granite kerb strip and the pavement (s -8.1 .. -4.6), and up the
// street from them two long parking bays as far as the lawn wall by the Vanemuine steps, where the pavement comes
// out to the road (Martin's Street View, 4 Vanemuise, 20 Nov)
const TAXI = { s0: -8.1, s1: -4.6, bays: [20, 23.3, 26.6, 29.9, 33.2, 36.5, 39.8], long: [56.1, 69.1], end: 70.5, taper: 76.5 };
const at = (s, v) => F.at(s, v);
const carYaw = (ds, dv) => { const x = F.U[0] * ds + F.V[0] * dv, z = F.U[1] * ds + F.V[1] * dv; return Math.atan2(x, -z); };
const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
// parked cars, backed into the bays as in the Aug 2024 shots: five on Ülikooli. The two taxis that stood in the
// Vanemuise tn bays are left out (Martin, 20 Nov): they sat right beside the lap road there and could spoil a lap.
export const TEATRI_CARS = [
  [...at(10, 11.95), carYaw(-C30, -S30), 'passat', 'white', 0.03],
  [...at(15, 11.95), carYaw(-C30, -S30), 'mazda6', 'grey', 0.03],
  [...at(25, 11.95), carYaw(-C30, -S30), 'rav4', 'black', 0.03],
  [...at(30, 11.95), carYaw(-C30, -S30), 'model3', 'white', 0.03],
  [...at(40, 11.95), carYaw(-C30, -S30), 'accord', 'silver', 0.03],
];

// before the road markings are made: the theatre forecourt and its car park get no lane lines, and along the
// park Ülikooli's generated lines make way for the real ones (drawn in build: double solid centre, one lane
// line, the dashed edge of the parking and bus stop strip, the blue bays)
export function teatriparkVectors(vectors) {
  const prev = vectors.markSkip;
  vectors.markSkip = (x, z) => {
    const [s, v] = F.sv(x, z);
    return (s > -16 && s < 92 && v > 43 && v < 63) || (s > 3 && s < 76 && v > -6 && v < 14) || (prev ? prev(x, z) : false);
  };
}

export function createTeatripark(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;
  const centre = F.at(40, 30), ready = [F.at(0, 20), F.at(80, 20), F.at(10, 55), F.at(75, 55)];

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const { p, h } = A;
    const IRON0 = 0x34363a;
    // painted lines: segments [s0, v0, s1, v1] of the frame, 0.13 m wide, a few cm over the road or the strip
    function stripes(list, hex) {
      const pos = [], HW = 0.065;
      for (const [s0, v0, s1, v1] of list) {
        const l = Math.hypot(s1 - s0, v1 - v0), ns = -(v1 - v0) / l * HW, nv = (s1 - s0) / l * HW;
        const q = [[s0 + ns, v0 + nv], [s0 - ns, v0 - nv], [s1 + ns, v1 + nv], [s1 - ns, v1 - nv]].map(([a, b]) => { const [x, z] = F.at(a, b); return [x, h(x, z) + 0.11, z]; });
        for (const k of [0, 1, 2, 2, 1, 3]) pos.push(...q[k]);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      const m = new THREE.MeshLambertMaterial({ color: hex, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = shadows; group.add(mesh);
    }

    // ---- ground: the two lawns either side of the path, the path, the forecourt
    A.pave(F, 0, 37, (s) => Math.max(19, pathV(s) + PATH_HV), 44, 'lawn');
    A.pave(F, 20.5, 80, 19, (s) => Math.max(19, Math.min(s > MEMO.s0 - 1 && s < MEMO.s1 + 1 ? MEMO.v0 : 41, pathV(s) - PATH_HV)), 'lawn');
    const d = [F.at(...P1)[0] - F.at(...P0)[0], F.at(...P1)[1] - F.at(...P0)[1]], len = Math.hypot(d[0], d[1]);
    const FP = frame(F.at(...P0), d);
    A.pave(FP, -2, len + 1, -1.5, 1.5, 'slabs');
    A.pave(F, 30, 82, MEMO.v1, 59, 'slabs');                                 // the forecourt under the theatre front
    A.pave(F, 36, MEMO.s0, 41, MEMO.v1, 'slabs');                            // from the path's end round the memorial

    // ---- low white bollards along the lawn edges and the path
    const WHITE = 0xe8e7e2;
    for (let s = 21; s <= 80; s += 4.5) { const [x, z] = F.at(s, 18.7); A.bollard(x, z, WHITE, 0.5); }
    for (let v = 21; v <= 43; v += 4.5) { const [x, z] = F.at(0.4, v); A.bollard(x, z, WHITE, 0.5); }
    for (let t = 2; t < len - 1; t += 4.5) for (const side of [-1.7, 1.7]) { const [x, z] = FP.at(t, side); A.bollard(x, z, WHITE, 0.5); }

    // ---- the Tubin memorial (Street View Aug 2024): white terraces stepping up the slope towards the theatre,
    // the lawn-side face a white wall with a row of black round openings, short dark round seats on each
    // terrace, a dark retaining wall with a low parapet to the forecourt above, steps beside it from the path,
    // and the bronze figure of Eduard Tubin standing on the lowest terrace
    const STONE = 0xeeece6, DARK = 0x2b2a2e, WALL = 0x3b3937, ROWS = 4, DEP = (MEMO.v1 - MEMO.v0) / ROWS;
    const ms = (MEMO.s0 + MEMO.s1) / 2, W = MEMO.s1 - MEMO.s0;
    const level = (v) => Math.max(...[MEMO.s0 + 1, ms, MEMO.s1 - 1].map((s) => h(...F.at(s, v))));
    const post = new THREE.CylinderGeometry(0.3, 0.3, 0.45, 9);
    const disc = new THREE.CylinderGeometry(1, 1, 0.05, 14).rotateX(Math.PI / 2);
    const g0 = level(MEMO.v0 - 0.3), STATUE = [62.6, MEMO.v0 + 1.1];
    let below = g0;
    for (let j = 0; j < ROWS; j++) {
      const v = MEMO.v0 + (j + 0.5) * DEP, top = Math.max(level(v) + 0.12, g0 + 0.95 + j * 0.3), rise = top - below;
      A.box(F, ms, v, W, DEP + 0.02, -1.8, 0, STONE, top);
      for (let i = 0; i < 11; i++) {
        const sp = MEMO.s0 + 2.2 + i * 1.66;
        if (j === 0 && Math.abs(sp - STATUE[0]) < 1) continue;
        const [x, z] = F.at(sp, v); p.add(post, DARK, x, top + 0.22, z);
        if (rise > 0.45) {
          const r = Math.min(0.34, rise * 0.36), g = disc.clone().scale(r, r, 1), [dx, dz] = F.at(sp, MEMO.v0 + j * DEP - 0.03);
          p.add(g, 0x1c1c1f, dx, top - rise / 2, dz, F.YAW);
        }
      }
      below = top;
    }
    const court = level(MEMO.v1 + 1);
    A.box(F, ms, MEMO.v1 - 0.2, W + 0.4, 0.4, -2.2, Math.max(0.4, below + 0.3 - court), WALL, court);   // retaining wall and parapet
    for (let k = 0; k < 4; k++) {                                            // steps from the path up to the forecourt
      const v = MEMO.v1 - 7 + k * 2, [x, z] = F.at(MEMO.s0 - 1.3, v + 1);
      A.box(F, MEMO.s0 - 1.3, v + 1, 2.4, 2.02, -1.8, 0, STONE, h(x, z) + 0.1);
    }
    {                                                                        // the bronze Tubin, life size
      const [x, z] = F.at(...STATUE), y = g0 + 0.95, BR = 0x3d4239;
      p.add(new THREE.CylinderGeometry(0.17, 0.2, 0.9, 8), BR, x, y + 0.45, z);
      p.box(0.5, 0.72, 0.3, BR, x, y + 1.25, z, F.YAW);
      p.add(new THREE.SphereGeometry(0.13, 10, 8), BR, x, y + 1.76, z);
      const [ax, az] = F.at(STATUE[0] + 0.3, STATUE[1] - 0.25);
      p.box(0.12, 0.55, 0.12, BR, ax, y + 1.45, az, F.YAW);           // the raised conducting arm
    }

    // ---- the big grey display board at the top of the lawn, a dark screen on its face to Ülikooli
    {
      const [x, z] = F.at(22, 47.5), y = h(x, z);
      p.box(4.6, 3.3, 0.4, 0x9b9fa4, x, y + 1.65, z, F.YAW);
      const [sx, sz] = F.at(22, 47.28);
      p.box(4.1, 2.2, 0.02, 0x23262b, sx, y + 2.05, sz, F.YAW);
    }
    // ---- poster stands (dark green, by the pavement) and the corner's signpost with brown finger signs
    for (const [ps, pv, w, hh, c] of [[63.5, 20.3, 0.62, 1.9, 0x2d3b32], [2.6, 21.5, 1.2, 1.7, 0x222326]]) {
      const [x, z] = F.at(ps, pv), y = h(x, z);
      p.box(0.08, 0.6, 0.08, IRON0, x, y + 0.3, z);
      p.box(w, hh, 0.22, c, x, y + 0.6 + hh / 2, z, F.YAW);
    }
    {
      const [x, z] = F.at(4.2, 19.6), y = h(x, z);
      p.add(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), 0x5a3a2c, x, y + 1.6, z);
      for (let k = 0; k < 8; k++) {
        const yaw = F.YAW + [0.4, 0.4, -1.2, 0.4, -1.2, 2.0, 0.4, -1.2][k], [ox, oz] = [Math.cos(yaw) * 0.5, -Math.sin(yaw) * 0.5];
        p.box(1.0, 0.17, 0.03, 0x7a3b2a, x + ox, y + 1.9 + k * 0.2, z + oz, yaw);
      }
    }

    // ---- Ülikooli: the parking and bus stop strip, its granite kerb, and the lines as in the street photos
    A.pave(F, 2, 80, ULI.edge, ULI.kerb, 'asphalt');
    for (let q = 2; q < 80; q += 3) A.box(F, q + 1.5, ULI.kerb + 0.1, 3.02, 0.2, -0.2, 0.12, 0xb9b7bc);
    const lines = [], blue = [];
    for (let q = 3; q < 76; q += 4.5) for (const o of [-0.12, 0.12]) lines.push([q, ULI.centre + o, q + 4.5, ULI.centre + o]);
    for (let q = 4; q < 75; q += 9) lines.push([q, ULI.lane, q + 3, ULI.lane]);
    for (let q = 7.5; q < 80; q += 2.5) lines.push([q, ULI.edge, q + 1, ULI.edge]);
    const run = (ULI.kerb - 0.15 - ULI.edge) / Math.tan(Math.PI / 6);
    for (const b of [...BAYS, BAYS[BAYS.length - 1] + 5]) blue.push([b - run, ULI.edge + 0.1, b, ULI.kerb - 0.15]);
    // ---- Vanemuise tn: the taxi bays, the granite strip between them and the lane, black bollards and the
    // white bowl planters on the pavement
    // (the bays are the street's own tarmac, no lighter cover; the granite line between them and the lane is flush
    // with the road and follows its fall: Martin, 20 Nov)
    A.pave(F, TAXI.s0 - 0.4, TAXI.s0, 17, TAXI.end, 'kerb');
    for (const b of [...TAXI.bays, TAXI.bays[TAXI.bays.length - 1] + 3.3]) lines.push([TAXI.s0 + 0.15, b, TAXI.s1 - 0.15, b + (TAXI.s1 - TAXI.s0 - 0.3) / Math.tan(50 * Math.PI / 180)]);
    for (const b of TAXI.long) lines.push([TAXI.s0 + 0.15, b, TAXI.s1 - 0.15, b]);
    // at the top the pavement's kerb comes out to the road's edge on a slant, by the lawn wall at the foot of the steps
    {
      const a = F.at(TAXI.s1, TAXI.end - 0.6), b = F.at(TAXI.s0 + 0.1, TAXI.taper);
      const n = 8;
      for (let k = 0; k < n; k++) {
        const u0 = k / n, u1 = (k + 1) / n, P = (u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
        A.bar(P(u0), P(u1), 0.25, -0.2, 0.06, 0xb9b7bc);
      }
      lines.push([TAXI.s0 + 0.15, TAXI.end - 0.4, TAXI.s1 - 0.3, TAXI.end - 0.4]);
    }
    // one row of black bollards along the pavement side of the bays (Street View, Aug 2024), all the way up; at the
    // top it bends right along the slanting kerb to the roadside, by two white bowl planters. Past the last taxi bay
    // at the bottom it bends round the pavement corner and a few come back to the roadside by the zebra.
    const BOL = [];
    for (let v = 17.5; v <= TAXI.end + 0.2; v += 3.2) BOL.push([TAXI.s1 + 0.25, v]);
    BOL.push([-5.2, 72.6], [-6.1, 74.3], [-7.0, 75.9], [-5.3, 15.4], [-6.3, 13.8], [-7.1, 12.4]);
    for (const [s, v] of BOL) { const [x, z] = F.at(s, v); A.bollard(x, z, 0x1c1d20, 0.95); }
    const bowl = new THREE.CylinderGeometry(0.6, 0.36, 0.45, 14);
    for (const [s, v] of [[-2.6, 28.6], [-2.6, 31.2], [-2.3, 74.2], [-2.0, 76.6]]) { const [x, z] = F.at(s, v); p.add(bowl, 0xeeeeea, x, h(x, z) + 0.22, z); }
    // the round pavement corner (src/race/junctionkerbs.js) ends in a point at Ülikooli's edge (v 6.8, s 1): a kerb
    // runs back up from there to the one behind the parking strip, and the strip's white edge line comes out of the
    // point on a smooth curve to its own line (Martin, 20 Nov: "the white line should then be round")
    {
      const a = F.at(1.0, 6.95), b = F.at(2.3, ULI.kerb);
      for (let k = 0; k < 4; k++) {
        const P = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        A.bar(P(k / 4), P((k + 1) / 4), 0.25, -0.2, 0.09, 0xb9b7bc);
      }
      const c = (t) => [1.1 + 5.9 * t, 6.95 + (ULI.edge - 6.95) * t * t * (3 - 2 * t)];
      for (let k = 0; k < 8; k++) { const p0 = c(k / 8), p1 = c((k + 1) / 8); lines.push([p0[0], p0[1], p1[0], p1[1]]); }
    }
    stripes(lines, 0xe4e2ea);
    stripes(blue, 0x2f6fd8);

    // ---- benches and bins on the Ülikooli pavement (map survey), backs to the lawn
    const WOOD = 0x8a6a4c, IRON = IRON0;
    for (const s of [52.2, 54.6, 57, 59.4]) {
      const [x, z] = F.at(s, 17.6), y = h(x, z);
      p.box(1.8, 0.07, 0.46, WOOD, x, y + 0.45, z, F.YAW);
      const [bx, bz] = F.at(s, 17.85);
      p.box(1.8, 0.38, 0.06, WOOD, bx, y + 0.72, bz, F.YAW);
      for (const e of [-0.75, 0.75]) { const [lx, lz] = F.at(s + e, 17.7); p.box(0.07, 0.45, 0.42, IRON, lx, y + 0.22, lz, F.YAW); }
    }
    const bin = new THREE.CylinderGeometry(0.24, 0.22, 0.8, 9);
    for (const s of [50.6, 61]) { const [x, z] = F.at(s, 17.7); p.add(bin, 0x2f4a3c, x, h(x, z) + 0.4, z); }

    A.finish();
  }

  return {
    update(car) {
      if (built || !car || Math.hypot(car.x - centre[0], car.z - centre[1]) > 300) return;
      if (ready.every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
