// The Delta centre of the University of Tartu (Narva mnt 18) across the Emajõgi from the end of Lai,
// beside Vabadussild (Martin, 18 Nov, from his street views of Aug 2024, the orthophoto and a kaldaerofoto),
// built by hand in place of the LOD2 model, in pastel colours:
//   - a five-storey chevron: a long north wing ending in a sharp tip at Narva mnt and a lower south wing
//     along the river, with a separate block in the crook between them
//   - dark facades with bands of windows behind a loose lattice of gold and dark slats, upright and across,
//     unevenly spaced so it shimmers
//   - a tall glass ground floor set back behind white columns, the solar panels on the flat roofs
import * as THREE from 'three';
import { Parts, BOX } from '../race/landmarks.js';
import { setHouseColours } from './streetkit.js';

// the LOD2 outlines (game x, z), clockwise seen from above; base world y and roof height above it
const NORTH = { pts: [[1619.7, 2179.0], [1616.2, 2218.4], [1567.3, 2251.7], [1524.5, 2246.6]], base: -1.89, H: 19.8 };
const SOUTH = { pts: [[1524.5, 2246.6], [1567.3, 2251.7], [1584.7, 2299.3], [1599.5, 2341.8], [1592.7, 2346.5]], base: -1.89, H: 16.2 };
const EAST = { pts: [[1596.1, 2241.6], [1615.0, 2228.7], [1610.0, 2289.9], [1591.5, 2296.5]], base: 0.34, H: 19.4 };
const GROUND = 4.4;                                  // the glass ground floor
const CENTRE = [1575, 2260];
const COL = {
  body: 0x464b5c, band: 0x3b3f4e, win: [0x8ea7c0, 0x99b2c8, 0x86a0ba], groundGlass: [0x8fc6c0, 0x9ed0c8],
  gold: [0xe2c27f, 0xd6b06a, 0xeccf94], slatDark: 0x50556a, column: 0xebe6ec, roof: 0xa3a7b4,
  solar: 0x4d5f8f, solarFrame: 0xc3c7d2, parapet: 0x5b6072,
};

export function deltaWalls(walls) {
  setHouseColours(walls, '3_4', 1120, 1760, [
    // the survey lists the chevron six times over; each entry claims the triangles nearest to it, so all six are
    // hidden (with only one, the map's block showed through and flickered against the hand-built one: Martin, 20 Nov)
    ...[[1572.1, 2262.8], [1543.5, 2250.9], [1557.5, 2270.7], [1578.4, 2225.2], [1567.2, 2276.6], [1605.1, 2202.6]]
      .map(([x, z]) => ({ base: -189, x, z, wall: COL.body, hide: true, reach: 95 })),
    { base: 34, x: 1600.1, z: 2255.4, wall: COL.body, hide: true, reach: 40 },
  ]);
}

export function createDelta(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function build() {
    built = true;
    const p = new Parts();
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const face = (a, b) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), d = [dx / len, dz / len], n = [d[1], -d[0]];
      return { len, d, n, yaw: Math.atan2(-d[1], d[0]), at: (s, o) => [a[0] + d[0] * s + n[0] * o, a[1] + d[1] * s + n[1] * o] };
    };

    for (const B of [NORTH, SOUTH, EAST]) {
      const y0 = B.base, H = B.H;
      const slab = (F, s0, s1, a, b, off, th, hex) => { const [x, z] = F.at((s0 + s1) / 2, off + th / 2); p.box(s1 - s0, b - a, th, hex, x, y0 + (a + b) / 2, z, F.yaw); };
      const shape = new THREE.Shape(B.pts.map(([x, z]) => new THREE.Vector2(x, -z)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: H + 2.5, bevelEnabled: false, curveSegments: 1 });
      g.rotateX(-Math.PI / 2);
      p.add(g, COL.body, 0, y0 - 2.5, 0);
      p.add(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), COL.roof, 0, y0 + H + 0.02, 0);

      const floors = Math.round((H - GROUND) / 3.85);
      const fh = (H - GROUND - 0.6) / floors;
      for (let k = 0; k < B.pts.length; k++) {
        const a = B.pts[k], b = B.pts[(k + 1) % B.pts.length];
        const F = face(a, b);
        if (F.len < 1.5) continue;
        // the ground floor: tall glass panes, white columns in front
        const np = Math.max(1, Math.round(F.len / 2.4));
        for (let q = 0; q < np; q++) {
          const s0 = F.len * q / np + 0.05, s1 = F.len * (q + 1) / np - 0.05;
          slab(F, s0, s1, 0.1, GROUND - 0.2, 0.01, 0.04, COL.groundGlass[q % 2]);
          slab(F, s1 - 0.01, s1 + 0.1, 0.1, GROUND - 0.2, 0.01, 0.08, COL.band);
        }
        slab(F, 0, F.len, GROUND - 0.25, GROUND + 0.2, 0, 0.9, COL.band);                        // soffit over the glass
        for (let s = 3; s < F.len - 2; s += 7.2) {
          const [x, z] = F.at(s, 0.75);
          p.add(new THREE.CylinderGeometry(0.28, 0.28, GROUND - 0.2, 12), COL.column, x, y0 + (GROUND - 0.2) / 2, z);
        }
        // upper floors: dark spandrel bands and window strips
        for (let f = 0; f < floors; f++) {
          const ya = GROUND + 0.2 + f * fh;
          slab(F, 0, F.len, ya, ya + fh * 0.38, 0, 0.05, COL.band);
          slab(F, 0, F.len, ya + fh * 0.38, ya + fh - 0.05, 0.01, 0.04, COL.win[(k + f) % 3]);
          for (let s = 1.4; s < F.len; s += 1.4) slab(F, s - 0.04, s + 0.04, ya + fh * 0.38, ya + fh, 0.03, 0.04, COL.band);
        }
        slab(F, -0.05, F.len + 0.05, H - 0.4, H + 0.5, 0.0, 0.25, COL.parapet);
        // the lattice, 0.55 m out from the facade: upright slats unevenly spaced, a few dark ones among them
        const LO = 0.55, top = H + 0.45;
        for (let s = 0.2; s < F.len - 0.1; s += 0.35 + rnd() * 0.55) {
          const dark = rnd() < 0.18, c = dark ? COL.slatDark : COL.gold[(rnd() * 3) | 0];
          const lo = GROUND + 0.15 + (rnd() < 0.3 ? rnd() * fh : 0), hi = top - (rnd() < 0.25 ? rnd() * fh * 1.5 : 0);
          slab(F, s - 0.045, s + 0.045, lo, hi, LO, 0.1, c);
        }
        // slats across: at each floor and between, with gaps
        for (let f = 0; f <= floors * 2; f++) {
          const y = GROUND + 0.2 + f * fh / 2 + (f % 2 ? (rnd() - 0.5) * 0.4 : 0);
          if (y > top - 0.1) continue;
          let s = rnd() * 2;
          while (s < F.len - 0.5) {
            const l = Math.min(F.len - s, 3 + rnd() * 9);
            slab(F, s, s + l, y - 0.04, y + 0.04, LO - 0.05, 0.14, rnd() < 0.2 ? COL.slatDark : COL.gold[(rnd() * 3) | 0]);
            s += l + rnd() * 3;
          }
        }
        // brackets holding the lattice at the floor slabs
        for (let s = 2; s < F.len; s += 4.8) for (let f = 1; f <= floors; f++) slab(F, s - 0.03, s + 0.03, GROUND + 0.2 + f * fh - 0.1, GROUND + 0.2 + f * fh, 0, LO, COL.slatDark);
      }

      // solar panels on the roof: rows inside the outline
      const xs = B.pts.map((q) => q[0]), zs = B.pts.map((q) => q[1]);
      const inside = (x, z, m) => {
        let c = false;
        for (let i = 0, j = B.pts.length - 1; i < B.pts.length; j = i++) {
          const a = B.pts[i], b = B.pts[j];
          if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
        }
        if (!c) return false;
        for (let i = 0, j = B.pts.length - 1; i < B.pts.length; j = i++) {           // keep m metres from the edges
          const a = B.pts[i], b = B.pts[j], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
          const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
          if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < m) return false;
        }
        return true;
      };
      const F0 = face(B.pts[0], B.pts[B.pts.length - 1]);          // rows run along the long side
      const [ox, oz] = [Math.min(...xs), Math.min(...zs)], span = Math.hypot(Math.max(...xs) - ox, Math.max(...zs) - oz);
      for (let r = -span; r < span; r += 2.6) {
        for (let s = -span; s < span; s += 1.8) {
          const x = (Math.min(...xs) + Math.max(...xs)) / 2 + F0.d[0] * s + F0.n[0] * r;
          const z = (Math.min(...zs) + Math.max(...zs)) / 2 + F0.d[1] * s + F0.n[1] * r;
          if (!inside(x, z, 1.6)) continue;
          p.add(BOX(1.7, 0.06, 1.15).rotateX(0.22), COL.solar, x, y0 + H + 0.45, z, F0.yaw);
          p.box(1.72, 0.3, 0.06, COL.solarFrame, x - F0.n[0] * 0.5, y0 + H + 0.17, z - F0.n[1] * 0.5, F0.yaw);
        }
      }
    }

    const mesh = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    if (mesh) { mesh.castShadow = shadows; mesh.receiveShadow = true; group.add(mesh); }
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 700) return;
      if ([NORTH.pts[0], NORTH.pts[3], SOUTH.pts[4], EAST.pts[2]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
