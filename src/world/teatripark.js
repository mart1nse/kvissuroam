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

// before the road markings are made: the theatre forecourt and its car park get no lane lines
export function teatriparkVectors(vectors) {
  const prev = vectors.markSkip;
  vectors.markSkip = (x, z) => {
    const [s, v] = F.sv(x, z);
    return (s > -16 && s < 92 && v > 43 && v < 63) || (prev ? prev(x, z) : false);
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

    // ---- the Tubin memorial: four stone terraces stepping up the slope towards the theatre (about 1.7 m in all),
    // a row of short dark posts on each, a dark retaining wall with a low parapet to the forecourt above, and
    // steps beside it from the path up to the forecourt
    const STONE = 0xd8d2c6, DARK = 0x2b2a2e, WALL = 0x3b3937, ROWS = 4, DEP = (MEMO.v1 - MEMO.v0) / ROWS;
    const ms = (MEMO.s0 + MEMO.s1) / 2, W = MEMO.s1 - MEMO.s0;
    const level = (v) => Math.max(...[MEMO.s0 + 1, ms, MEMO.s1 - 1].map((s) => h(...F.at(s, v))));
    const post = new THREE.CylinderGeometry(0.3, 0.3, 0.45, 9);
    for (let j = 0; j < ROWS; j++) {
      const v = MEMO.v0 + (j + 0.5) * DEP, top = level(v) + 0.12;
      A.box(F, ms, v, W, DEP + 0.02, -1.8, 0, STONE, top);
      for (let i = 0; i < 11; i++) { const [x, z] = F.at(MEMO.s0 + 2.2 + i * 1.66, v); p.add(post, DARK, x, top + 0.22, z); }
    }
    const court = level(MEMO.v1 + 1);
    A.box(F, ms, MEMO.v1 - 0.2, W + 0.4, 0.4, -2.2, 0.4, WALL, court);       // retaining wall and parapet
    for (let k = 0; k < 4; k++) {                                            // steps from the path up to the forecourt
      const v = MEMO.v1 - 7 + k * 2, [x, z] = F.at(MEMO.s0 - 1.3, v + 1);
      A.box(F, MEMO.s0 - 1.3, v + 1, 2.4, 2.02, -1.8, 0, STONE, h(x, z) + 0.1);
    }

    // ---- benches and bins on the Ülikooli pavement (map survey), backs to the lawn
    const WOOD = 0x8a6a4c, IRON = 0x34363a;
    for (const s of [52.2, 54.6, 57, 59.4]) {
      const [x, z] = F.at(s, 17.6), y = h(x, z);
      p.add(BOX(1.8, 0.07, 0.46), WOOD, x, y + 0.45, z, F.YAW);
      const [bx, bz] = F.at(s, 17.85);
      p.add(BOX(1.8, 0.38, 0.06), WOOD, bx, y + 0.72, bz, F.YAW);
      for (const e of [-0.75, 0.75]) { const [lx, lz] = F.at(s + e, 17.7); p.add(BOX(0.07, 0.45, 0.42), IRON, lx, y + 0.22, lz, F.YAW); }
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
