// The Orident house (Jakobi 40) on the inside corner where the lap turns from Baeri into Jakobi (Martin,
// 18 Nov, from his street views of Aug 2024), built by hand in place of the LOD2 model, in pastel colours:
//   - four storeys; the corner towards the junction is one big curved curtain wall of tall glass panes
//     between dark mullions, with dark floor bands and a heavy dark cornice
//   - red brick on both sides of the glass: a short wing along Jakobi with a glass shop front below,
//     and the face towards Baeri with stacked balconies behind black railings
//   - a one-storey brick annex along Baeri with the clinic's glass shop front (its sign comes from the map's shop list)
//   - a flat dark roof with a brick parapet, vent boxes and two chimneys
import * as THREE from 'three';
import { Parts, BOX } from '../race/landmarks.js';
import { setHouseColours } from './streetkit.js';

const BASE = 10.58, H = 13.7;                       // ground (world y) and roof above it
const FLOORS = [0, 3.5, 6.9, 10.3];
// the curtain wall's line round the corner, from the Baeri side to the Jakobi side (from the LOD2 facets)
const CURVE = [[947.4, 2627.0], [949.3, 2624.0], [951.6, 2621.9], [954.0, 2620.3], [957.0, 2619.3], [960.5, 2618.95], [963.5, 2619.1], [966.85, 2619.65]];
// the rest of the outline, clockwise: the Jakobi wing, the back and the face towards Baeri
const REST = [[973.2, 2621.65], [969.4, 2630.55], [963.15, 2627.85], [959.85, 2629.15], [956.7, 2633.9], [947.9, 2628.1]];
const ANNEX = [[947.05, 2627.5], [947.9, 2628.1], [956.7, 2633.9], [955.1, 2636.35]];
const ANNEX_H = 3.6;
const CENTRE = [960, 2626];
const COL = {
  brick: 0xc9806f, brickDark: 0xb06d61, cope: 0xc2b8c0, frame: 0x3d404c, mullion: 0x353845,
  glass: [0x5f8592, 0x6a909c, 0x56798a, 0x7499a3], shopGlass: 0x8fb5b4, win: 0x6f879a,
  roof: 0x666b7c, vent: 0x8a8e9c, rail: 0x26272d, slab: 0xd9d4dc, sign: 0x2f3240,
};

export function oridentWalls(walls) {
  setHouseColours(walls, '2_5', 480, 2400, [{ base: 1058, x: 958.4, z: 2624.9, wall: COL.brick, hide: true, reach: 20 }]);
}

export function createOrident(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function build() {
    built = true;
    const p = new Parts();
    const y0 = BASE;
    const curve = new THREE.CatmullRomCurve3(CURVE.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const NSEG = 18;
    const G = curve.getSpacedPoints(NSEG).map((v) => [v.x, v.z]);
    const outlineMain = [...G, ...REST];
    const prism = (pts, a, b, hex) => {
      const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: b - a, bevelEnabled: false, curveSegments: 1 });
      g.rotateX(-Math.PI / 2);
      p.add(g, hex, 0, y0 + a, 0);
    };
    prism(outlineMain, -1.2, H, COL.brick);
    prism(ANNEX, -1.2, ANNEX_H, COL.brick);
    // roofs
    const flat = (pts, y, hex) => p.add(new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)))).rotateX(-Math.PI / 2), hex, 0, y0 + y + 0.02, 0);
    flat(outlineMain, H, COL.roof);
    flat(ANNEX, ANNEX_H, COL.roof);

    // a face along a → b; the street is on the left of a → b (outline is clockwise seen from above)
    const face = (a, b) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), d = [dx / len, dz / len], n = [d[1], -d[0]];
      return { len, d, n, yaw: Math.atan2(-d[1], d[0]), at: (s, o) => [a[0] + d[0] * s + n[0] * o, a[1] + d[1] * s + n[1] * o] };
    };
    const slab = (F, s0, s1, a, b, off, th, hex) => { const [x, z] = F.at((s0 + s1) / 2, off + th / 2); p.add(BOX(s1 - s0, b - a, th), hex, x, y0 + (a + b) / 2, z, F.yaw); };
    const win = (F, s0, s1, a, b) => {
      slab(F, s0 - 0.08, s1 + 0.08, a - 0.08, b + 0.08, 0, 0.05, COL.frame);
      slab(F, s0, s1, a, b, 0.03, 0.04, COL.win);
      slab(F, (s0 + s1) / 2 - 0.03, (s0 + s1) / 2 + 0.03, a, b, 0.05, 0.04, COL.frame);
      slab(F, s0 - 0.1, s1 + 0.1, a - 0.14, a - 0.06, 0, 0.12, COL.brickDark);
    };
    const shop = (F, s0, s1, top = 3.0) => {
      slab(F, s0, s1, 0.05, top, 0, 0.06, COL.frame);
      const n = Math.max(1, Math.round((s1 - s0) / 1.6));
      for (let k = 0; k < n; k++) {
        const a = s0 + (s1 - s0) * k / n + 0.06, b = s0 + (s1 - s0) * (k + 1) / n - 0.06;
        slab(F, a, b, 0.15, top - 0.1, 0.04, 0.04, COL.shopGlass);
      }
    };
    const balcony = (F, s0, s1, y) => {
      slab(F, s0, s1, y - 0.05, y + 0.12, 0, 1.2, COL.slab);
      const [ax, az] = F.at(s0 + 0.04, 1.15), [bx, bz] = F.at(s1 - 0.04, 1.15), len = s1 - s0 - 0.08;
      for (const yy of [1.1, 0.55, 0.25]) p.add(BOX(len, 0.04, 0.04), COL.rail, (ax + bx) / 2, y0 + y + yy, (az + bz) / 2, F.yaw);
      for (let s = s0 + 0.05; s < s1; s += 0.6) { const [x, z] = F.at(s, 1.15); p.add(BOX(0.04, 1.0, 0.04), COL.rail, x, y0 + y + 0.6, z, F.yaw); }
      for (const s of [s0 + 0.04, s1 - 0.04]) for (const yy of [1.1, 0.55]) { const [x, z] = F.at(s, 0.6); p.add(BOX(0.04, 0.04, 1.15), COL.rail, x, y0 + y + yy, z, F.yaw); }
      slab(F, s0 + 0.3, s0 + 1.2, y + 0.12, y + 2.4, 0.02, 0.05, COL.frame);
      slab(F, s0 + 0.38, s0 + 1.12, y + 0.2, y + 2.32, 0.05, 0.03, COL.win);
      win(F, s0 + 1.6, s1 - 0.3, y + 0.9, y + 2.4);
    };
    const parapet = (F, hex) => { slab(F, -0.05, F.len + 0.05, H - 0.02, H + 0.55, -0.25, 0.27, hex); slab(F, -0.08, F.len + 0.08, H + 0.55, H + 0.65, -0.29, 0.33, COL.cope); };
    const band = (F, y, hex = COL.brickDark) => slab(F, -0.02, F.len + 0.02, y - 0.12, y + 0.06, 0, 0.06, hex);

    // ---- the curved curtain wall
    {
      for (let k = 0; k < G.length - 1; k++) {
        const F = face(G[k], G[k + 1]);
        for (let f = 0; f < 4; f++) {
          const a = FLOORS[f] + (f ? 0.35 : 0.1), b = f < 3 ? FLOORS[f + 1] - 0.05 : H - 0.65;
          slab(F, 0.04, F.len - 0.04, a, b, 0.02, 0.04, f === 0 ? COL.shopGlass : COL.glass[(k * 3 + f * 5) % 4]);
          if (f) slab(F, -0.02, F.len + 0.02, FLOORS[f] - 0.05, FLOORS[f] + 0.35, 0, 0.12, COL.mullion);   // floor band
          slab(F, 0, F.len, a + (b - a) * 0.5 - 0.02, a + (b - a) * 0.5 + 0.02, 0.05, 0.05, COL.mullion);   // transom
        }
        slab(F, -0.03, F.len + 0.03, H - 0.65, H + 0.65, 0, 0.34, COL.mullion);                          // the heavy cornice
        const [x, z] = F.at(0, 0.1);
        p.add(BOX(0.12, H + 0.4, 0.2), COL.mullion, x, y0 + (H + 0.4) / 2 - 0.05, z, F.yaw);             // mullion
      }
      const [x, z] = G[G.length - 1];
      p.add(BOX(0.4, H + 0.7, 0.4), COL.mullion, x, y0 + (H + 0.7) / 2, z);
      const [x0, z0] = G[0];
      p.add(BOX(0.4, H + 0.7, 0.4), COL.mullion, x0, y0 + (H + 0.7) / 2, z0);
    }

    // ---- the brick faces
    const ring = [...REST, G[0]];
    const faces = [face(G[G.length - 1], REST[0])];
    for (let k = 0; k < ring.length - 1; k++) faces.push(face(ring[k], ring[k + 1]));
    faces.forEach((F, k) => {
      parapet(F, COL.brick);
      for (const y of FLOORS.slice(1)) band(F, y);
      const n = Math.floor((F.len - 0.6) / 2.4);
      if (F.len < 2) return;
      const isJakobi = k === 0, isBaeri = k === 5;
      for (let f = isBaeri ? 1 : 0; f < 4; f++) {
        if (f === 0 && isJakobi) { shop(F, 0.4, F.len - 0.5, 3.1); continue; }
        if (isBaeri && f > 0) {
          balcony(F, 0.8, 3.6, FLOORS[f]); balcony(F, F.len - 3.6, F.len - 0.8, FLOORS[f]);
          win(F, F.len / 2 - 0.65, F.len / 2 + 0.65, FLOORS[f] + 0.9, FLOORS[f] + 2.5);
          continue;
        }
        for (let w = 0; w < n; w++) {
          const s = (F.len - n * 2.4) / 2 + w * 2.4 + 0.55;
          win(F, s, s + 1.3, FLOORS[f] + 0.85, FLOORS[f] + 2.6);
        }
      }
    });

    // ---- the annex along Baeri: glass shop front, sign, parapet
    {
      const A = face(ANNEX[3], ANNEX[0]);
      shop(A, 0.6, A.len - 0.6, 2.8);
      slab(A, 0.4, A.len - 0.4, 2.85, ANNEX_H - 0.05, 0, 0.08, COL.brickDark);
      for (let k = 0; k < ANNEX.length; k++) {
        const F = face(ANNEX[k], ANNEX[(k + 1) % ANNEX.length]);
        if (k === 1) continue;                                  // against the main block
        slab(F, -0.05, F.len + 0.05, ANNEX_H - 0.02, ANNEX_H + 0.35, -0.22, 0.24, COL.brick);
        slab(F, -0.08, F.len + 0.08, ANNEX_H + 0.35, ANNEX_H + 0.43, -0.26, 0.3, COL.cope);
      }
      const S = face(ANNEX[2], ANNEX[3]);
      win(S, 0.6, 1.8, 0.9, 2.5);
    }

    // ---- roof: vent boxes and two chimneys
    for (const [x, z, w, h, d] of [[960, 2624, 2.4, 0.9, 1.6], [965.5, 2625.5, 1.4, 0.7, 1.4], [953, 2627.5, 1.8, 0.8, 1.2]]) p.add(BOX(w, h, d), COL.vent, x, y0 + H + h / 2, z, 0.32);
    for (const [x, z] of [[968.5, 2627.2], [955.3, 2631.2]]) {
      p.add(BOX(0.8, 1.8, 0.8), COL.brick, x, y0 + H + 0.9, z, 0.32);
      p.add(BOX(0.95, 0.12, 0.95), COL.cope, x, y0 + H + 1.85, z, 0.32);
    }

    const mesh = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    if (mesh) { mesh.castShadow = shadows; mesh.receiveShadow = true; group.add(mesh); }
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 450) return;
      if ([CURVE[0], REST[1], REST[4]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
