// Jakobi and Lai on the lap (Martin, 18 Nov, from his street views of Aug 2024), in pastel colours:
//   - the house colours: the yellow-green timber house opposite Orident, the grey timber houses near the
//     Lai corner, the orange house across the Lai junction, the ochre house at Lai 26 and the long pink
//     house near the end of Lai (Tartu-Tiksoja 41)
//   - the bus stop on Lai: a dark glass shelter on the pavement in front of a pink board wall, the bus
//     stop sign and the yellow zigzag along the kerb in the lane
import * as THREE from 'three';
import { createTrack } from './race.js';
import { Parts, BOX } from './landmarks.js';
import { setHouseColours } from '../world/streetkit.js';
import { drapeGeometry } from '../world/drape.js';
import { breakableShelter } from '../world/shelter.js';

const STOP = { i: 786, zig0: 779, zig1: 795, zigW: 1.7, wall0: 776, wall1: 800, wallOff: 3.7, shelterOff: 1.9 };
const CENTRE = [1205, 2495];
const CYCLE = { i0: 691, i1: 712, w: 1.5 };
const COL = {
  cycle: 0xeaa0a4, wall: 0xf0a6a6, wallDark: 0xd98f92, cap: 0xe9e2e8, yellow: 0xffd768,
  frame: 0x3f4350, roof: 0x4f5462, bench: 0xa98670, pole: 0x9a9eab, glass: 0xbfd3e0,
};

export function jakobiLaiWalls(walls) {
  setHouseColours(walls, '2_5', 480, 2400, [
    { base: 820, x: 992.6, z: 2605.3, wall: 0xcfc893, roof: 0xa3a6b2, reach: 22 },     // yellow-green timber, opposite Orident
    { base: 977, x: 1025.5, z: 2615.7, wall: 0xc4beb6, roof: 0x9a9ca8, reach: 18 },    // grey timber with ivy
    { base: 934, x: 1052.4, z: 2621.3, wall: 0xbab3ab, roof: 0x8f919d, reach: 14 },    // grey timber at the Lai corner
    { base: 857, x: 1054.9, z: 2610.0, wall: 0xbab3ab, roof: 0x8f919d, reach: 14 },
    { base: 831, x: 1089.5, z: 2631.9, wall: 0xf2bd80, roof: 0xa09aa6, reach: 18 },    // the orange house across Lai
  ]);
  setHouseColours(walls, '3_5', 1120, 2400, [
    { base: 372, x: 1197.8, z: 2475.2, wall: 0xdcc287, roof: 0x9a9ca8, reach: 26 },    // ochre, Lai 26
  ]);
  setHouseColours(walls, '3_4', 1120, 1760, [
    { base: 32, x: 1401.3, z: 2372.6, wall: 0xf3cdbf, roof: 0x9a9eab, reach: 30 },     // long pink house, Tartu-Tiksoja 41
  ]);
}

// ---- road tones from Baeri through Jakobi to Lai (Martin's street views): Baeri a cool mid grey, Jakobi
// a little lighter, a warm reddish hue round the corner into Lai with the right-hand lane much darker
// there (newer asphalt), Lai the lightest. [lum, warm] as the road tone texture takes them (183, 136 typical).
const TONES = [
  [596, 150, 128], [626, 150, 128], [636, 160, 131], [668, 160, 131], [680, 168, 146], [692, 170, 150],
  [700, 174, 140], [712, 178, 134], [940, 178, 134],
];
const DARK_LANE = { i0: 668, i1: 694, lum: 108, fade: 5 };
function toneAt(i) {
  for (let k = 0; k < TONES.length - 1; k++) {
    const [a, la, wa] = TONES[k], [b, lb, wb] = TONES[k + 1];
    if (i >= a && i <= b) { const u = (i - a) / (b - a); return [la + (lb - la) * u, wa + (wb - wa) * u]; }
  }
  return null;
}
export function jakobiLaiVectors(vectors) {
  const track = createTrack();
  const out = (vectors.toneOver ||= []);
  const side = (i, lat) => { const [tx, tz] = track.tan[i]; return [track.P[i][0] - tz * lat, track.P[i][1] + tx * lat]; };
  const rgb = (l, w) => `rgb(${Math.round(l)},${Math.round(w)},0)`;
  for (let i = TONES[0][0]; i < TONES[TONES.length - 1][0]; i++) {
    const [l, w] = toneAt(i + 0.5), e0 = track.HW[i] + 2, e1 = track.HW[i + 1] + 2;
    const d = DARK_LANE, k = Math.min(1, Math.max(0, Math.min(i - d.i0, d.i1 - i) / d.fade));
    if (k <= 0) { out.push({ outer: [side(i, -e0), side(i + 1, -e1), side(i + 1, e1), side(i, e0)], tone: rgb(l, w) }); continue; }
    out.push({ outer: [side(i, -e0), side(i + 1, -e1), side(i + 1, 0), side(i, 0)], tone: rgb(l, w) });
    out.push({ outer: [side(i, 0), side(i + 1, 0), side(i + 1, e1), side(i, e0)], tone: rgb(l + (d.lum - l) * k, w - 6 * k) });
  }
}

export function createJakobiLai(world, group) {
  const track = createTrack();
  let built = false;
  const right = (i) => { const k = Math.floor(i), [tx, tz] = track.tan[k]; return [-tz, tx]; };
  const T = (i, lat) => {
    const k = Math.floor(i), f = i - k, a = track.P[k], b = track.P[k + 1], [rx, rz] = right(i);
    return [a[0] + (b[0] - a[0]) * f + rx * lat, a[1] + (b[1] - a[1]) * f + rz * lat];
  };
  const hw = (i) => track.HW[Math.round(i)];
  // no trees in the shelter (the map's row of street trees runs through it)
  {
    const [x, z] = T(STOP.i, hw(STOP.i) + STOP.shelterOff + 0.7);
    world.addClearing({ x0: x - 3.2, z0: z - 3.2, x1: x + 3.2, z1: z + 3.2 });
  }

  function build() {
    built = true;
    const p = new Parts(), solids = [];
    const h = (x, z) => world.heightAt(x, z);

    // ---- the yellow zigzag in the lane along the kerb, a short bar across at each end
    {
      const shapes = [], w = 0.12, legs = 8;
      const leg = (a, b) => {
        const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), nx = -dz / l * w / 2, nz = dx / l * w / 2;
        shapes.push([[[a[0] - nx, a[1] - nz], [b[0] - nx, b[1] - nz], [b[0] + nx, b[1] + nz], [a[0] + nx, a[1] + nz]]]);
      };
      const pts = [];
      for (let k = 0; k <= legs; k++) {
        const i = STOP.zig0 + (STOP.zig1 - STOP.zig0) * k / legs;
        pts.push(T(i, hw(i) - (k % 2 ? STOP.zigW : 0.25)));
      }
      for (let k = 0; k < legs; k++) leg(pts[k], pts[k + 1]);
      for (const i of [STOP.zig0, STOP.zig1]) leg(T(i, hw(i) - 0.2), T(i, hw(i) - STOP.zigW - 0.05));
      const g = drapeGeometry(world, shapes, 0.07, 1, 1.5);
      if (g) {
        const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: COL.yellow, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, side: THREE.DoubleSide }));
        m.receiveShadow = true;
        group.add(m);
      }
    }

    // ---- the red cycle lane along the left kerb at the start of Lai, by the corner crossing
    {
      const shapes = [], C = CYCLE;
      for (let i = C.i0; i < C.i1; i++) {
        const f0 = Math.min(1, (i - C.i0) / 2, (C.i1 - i) / 2), f1 = Math.min(1, (i + 1 - C.i0) / 2, (C.i1 - i - 1) / 2);
        const a0 = -hw(i) + 0.25, a1 = -hw(i + 1) + 0.25;
        shapes.push([[T(i, a0), T(i + 1, a1), T(i + 1, a1 + C.w * Math.max(0.15, f1)), T(i, a0 + C.w * Math.max(0.15, f0))]]);
      }
      const g = drapeGeometry(world, shapes, 0.06, 1, 1.5);
      if (g) {
        const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: COL.cycle, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5, side: THREE.DoubleSide }));
        m.receiveShadow = true;
        group.add(m);
      }
    }

    // ---- the pink board wall behind the pavement: boards, a light cap, posts
    {
      const H = 2.2;
      for (let i = STOP.wall0; i < STOP.wall1; i++) {
        const a = T(i, hw(i) + STOP.wallOff), b = T(i + 1, hw(i + 1) + STOP.wallOff);
        const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), yaw = Math.atan2(-dz, dx);
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, y = Math.min(h(a[0], a[1]), h(b[0], b[1]));
        p.add(BOX(l + 0.02, H, 0.06), COL.wall, mx, y + H / 2 - 0.1, mz, yaw);
        for (let s = 0.1; s < l; s += 0.15) {
          const x = a[0] + dx / l * s, z = a[1] + dz / l * s;
          p.add(BOX(0.025, H - 0.1, 0.02), COL.wallDark, x - dz / l * 0.04, y + H / 2 - 0.1, z + dx / l * 0.04, yaw);
        }
        p.add(BOX(l + 0.04, 0.08, 0.16), COL.cap, mx, y + H - 0.08, mz, yaw);
        if (i % 2 === 0) p.add(BOX(0.12, H + 0.05, 0.12), COL.wallDark, a[0], y + H / 2 - 0.08, a[1], yaw);
        solids.push({ x: mx, z: mz, yaw, hx: l / 2, hz: 0.08 });
      }
    }

    // ---- the shelter: dark frame, glass back and ends, roof, bench; the bus stop sign before it
    // (it can be smashed: the glass bursts, the frame bends, src/world/shelter.js)
    {
      const i = STOP.i, [tx, tz] = track.tan[i], [rx, rz] = right(i);
      const L = 4.2, D = 1.45, Hs = 2.45;
      const [cx, cz] = T(i, hw(i) + STOP.shelterOff + D / 2);
      const y = h(cx, cz) + 0.02, yaw = Math.atan2(-tz, tx);
      const W = (lu, lr) => [cx + tx * lu + rx * lr, cz + tz * lu + rz * lr];
      const sp = new Parts();
      const add = (geo, colour, lu, yy, lr) => { const [x, z] = W(lu, lr); sp.add(geo, colour, x, y + yy, z, yaw); };
      for (const lu of [-L / 2, -L / 6, L / 6, L / 2]) add(BOX(0.07, Hs, 0.07), COL.frame, lu, Hs / 2, D / 2);
      for (const lu of [-L / 2, L / 2]) add(BOX(0.07, Hs, 0.07), COL.frame, lu, Hs / 2, -D / 2);
      add(BOX(L + 0.35, 0.1, D + 0.3), COL.roof, 0, Hs + 0.05, 0);
      add(BOX(L + 0.35, 0.2, 0.06), COL.frame, 0, Hs - 0.04, -D / 2 - 0.15);
      add(BOX(L, 0.06, 0.06), COL.frame, 0, 0.12, D / 2);
      add(BOX(L * 0.6, 0.05, 0.4), COL.bench, 0, 0.46, D / 2 - 0.3);
      add(BOX(L * 0.6, 0.3, 0.04), COL.bench, 0, 0.7, D / 2 - 0.1);
      for (const lu of [-L * 0.25, L * 0.25]) add(BOX(0.05, 0.46, 0.36), COL.frame, lu, 0.23, D / 2 - 0.3);
      const y0 = y + 0.2, y1 = y + Hs - 0.1;
      const panes = [
        { a: W(-L / 2, D / 2), b: W(L / 2, D / 2), y0, y1 },
        { a: W(-L / 2, -D / 2), b: W(-L / 2, D / 2), y0, y1 },
        { a: W(L / 2, -D / 2), b: W(L / 2, D / 2), y0, y1 },
      ];
      const frame = sp.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
      if (frame) { frame.castShadow = frame.receiveShadow = true; group.add(frame); }
      const box = { x: cx, z: cz, yaw, hx: L / 2 + 0.1, hz: D / 2 + 0.1 };
      breakableShelter(world, group, { box, y, H: Hs, frame, panes, glass: COL.glass, opacity: 0.32 });
      solids.push(box);
      // the sign on a pole at the kerb, a few metres before the shelter
      const [sx, sz] = T(i - 4, hw(i) + 0.6), sy = h(sx, sz);
      p.add(new THREE.CylinderGeometry(0.04, 0.04, 2.9, 8), COL.pole, sx, sy + 1.45, sz);
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#6f9fe0'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#ffffff'; g.fillRect(6, 6, 116, 116);
      g.fillStyle = '#6f9fe0'; g.fillRect(12, 12, 104, 104);
      g.fillStyle = '#ffffff'; g.fillRect(28, 40, 72, 40);
      g.fillStyle = '#6f9fe0'; for (let k = 0; k < 3; k++) g.fillRect(34 + k * 22, 46, 16, 14);
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(44, 84, 8, 0, Math.PI * 2); g.arc(86, 84, 8, 0, Math.PI * 2); g.fill();
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
      sign.position.set(sx, sy + 2.5, sz);
      sign.rotation.y = yaw + Math.PI / 2;
      group.add(sign);
    }

    const m = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    if (m) { m.castShadow = true; m.receiveShadow = true; group.add(m); }
    world.addSolids(solids);
  }

  return {
    update(x, z) {
      if (built || Math.hypot(x - CENTRE[0], z - CENTRE[1]) > 600) return;
      if ([CYCLE.i0, STOP.wall0, STOP.i, STOP.wall1].every((i) => world.ready(...track.P[i]))) build();
    },
  };
}
