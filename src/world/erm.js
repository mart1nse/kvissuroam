// The Estonian National Museum (Eesti Rahva Muuseum, Muuseumi tee 2, Raadi), built by hand (Martin, 22 Nov: "do
// the erm") from the Land Board's oblique air photos (April 2023, April 2024), its height map (nDSM) and the
// orthophoto, in place of the map's rough wedge. There were no street photos of it.
//  - The hall, 358 m long and 78 m wide, lying along the old Raadi airfield's runway: one flat roof sloping from
//    about 15 m over the ground at the west end down to 3 m at the east, where the two wings run on into the
//    runway's concrete with the open court between them;
//  - its walls of pale printed glass in narrow upright panes with darker patches, the roof overhanging the
//    entrance at the west end, three doors under it;
//  - the roof: grey membrane in squares, the dark grey part over the entrance, two sunken courts with glass sides,
//    blue skylights, vents;
//  - the A car park north-west of it: lamp posts and parked cars;
//  - the ruin of the manor's distillery by Raadi lake: the low red brick walls under the glass roof on its steel
//    frame, the brick house beside it and its tall chimney.
// The court between the wings and the ground under the overhang can be driven; the glass walls are solid.
// No street name is painted on the road.
import * as THREE from 'three';
import { addHouseColours } from './streetkit.js';
import { paintTexture } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { still } from '../still.js';
import { jobs } from '../jobs.js';

const SEC = ['5_2', 2400, 480];
// the hall: s along it from its middle (east), v across (+ = south side)
const F = frame([2738.89, 1050.59], [0.9007143, -0.43441195]);
const S0 = -169, S1 = 189, V0 = -38.6, V1 = 39.4;          // the roof's outline
const GW = -163, WV0 = -38.0, WV1 = 38.8;                    // the glass: west wall and the long walls
const SLOT = { s: 124, v0: -11, v1: 13 };                    // the open court between the east wings
const ROOF = (s) => 37.3 - 0.0309 * (s + 165);               // the roof's top, metres above the map's zero
const SLAB = 1.2;
const WELLS = [[-84, -58, -24, -15], [-79, -53, 9, 18]];     // the sunken courts in the roof: s0, s1, v0, v1
const SKY = [[19, -8], [98, -8], [71, 21], [117, 22], [-30, 17], [-96, -6], [-120, 17], [-8, -24], [45, 12], [150, -25], [160, 25], [-60, 30]];
// the dark grey roof over the entrance (s, v)
const DARK = [[S0, V0], [-122, V0], [-120, -23], [-116, 4], [-141, 0], [-135, 23], [-150, V1], [S0, V1]];
// the distillery ruin: the glass roof's strip (s along, v across) and the brick house with the chimney
const RUIN = frame([2569.5, 926.5], [29.5, 26]);
const RUIN_L = 39.3, RUIN_W = 5.6;
const HOUSE = frame([2588.75, 929.5], [12, 9]);
// the A car park: s along its north-east edge from its north-west corner, v across it (south-west)
const LOT = frame([2384, 963], [152, 88]);
const CENTRE = [2700, 1060];

export function ermWalls(walls) {
  addHouseColours(walls, SEC[0], SEC[1], SEC[2], [
    { base: 1493, x: 2740, z: 1050, hide: true, reach: 230 },
    { base: 1920, x: 2584, z: 938, hide: true, reach: 30 },
    { base: 1968, x: 2589, z: 930, hide: true, reach: 14 },
  ]);
}

// cars in the A car park: two rows, nose to the aisle
const lotCar = (s, v, face, id, paint) => {
  const [x, z] = LOT.at(s, v), d = face > 0 ? LOT.V : [-LOT.V[0], -LOT.V[1]];
  return [x, z, Math.atan2(d[0], -d[1]), id, paint, 0];
};
export const ERM_CARS = [
  lotCar(150, 13, -1, 'passat', 'black'), lotCar(147.5, 13, -1, 'rav4', 'white'), lotCar(140, 13, -1, 'mazda6', 'grey'),
  lotCar(135, 13, -1, 'ceedsw', 'white'), lotCar(132.5, 13, -1, 'bz4x', 'white'), lotCar(122.5, 13, -1, 'passat', 'grey'),
  lotCar(151, 27, 1, 'rav4', 'black'), lotCar(143.5, 27, 1, 'passat', 'white'), lotCar(141, 27, 1, 'mazda6', 'red'),
  lotCar(128, 27, 1, 'rav4', 'grey'), lotCar(110, 27, 1, 'ceedsw', 'sage'), lotCar(95, 13, -1, 'passat', 'black'),
];

// ---------------------------------------------------------------- textured surfaces
function surf() { return { pos: [], uv: [], nor: [] }; }
// a quad a b c d (each [x, y, z], going round), its normal n, uvs [[u, v] x4]
function quad(o, a, b, c, d, n, uv) {
  for (const k of [0, 1, 2, 0, 2, 3]) { o.pos.push(...[a, b, c, d][k]); o.uv.push(...uv[k]); o.nor.push(...n); }
}
function toMesh(o, mat, shadows) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(o.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2));
  const m = new THREE.Mesh(g, mat); m.castShadow = shadows; m.receiveShadow = true;
  return m;
}

let TEX = null;
function textures() {
  if (TEX) return TEX;
  // the long walls: pale printed glass in panes 1.35 m wide, a transom every 4.05 m, darker patches of the print
  const glass = paintTexture(21.6, 0, 16.2, 20, (P) => {
    let seed = 11; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let y = 0; y < 16.2; y += 4.05) P.grad(0, y, 21.6, y + 4.05, '#e4ecee', '#c6d1d6');
    for (let k = 0; k < 9; k++) {                                     // the denser print, in blocks of panes
      const x0 = Math.floor(r() * 16) * 1.35, w = (1 + Math.floor(r() * 3)) * 1.35, y0 = Math.floor(r() * 4) * 4.05 + 0.6, hh = 1.2 + r() * 2.0;
      for (let x = x0; x < x0 + w; x += 0.18) P.r(x, y0, x + 0.09, y0 + hh, 'rgba(120,130,136,0.55)');
    }
    for (let x = 0; x < 21.6; x += 1.35) P.r(x, 0, x + 0.07, 16.2, '#f7f9f9');
    for (let y = 0; y < 16.2; y += 4.05) P.r(0, y, 21.6, y + 0.12, '#b4bcbf');
  });
  glass.wrapS = glass.wrapT = THREE.RepeatWrapping;
  // the roof: grey membrane in 6.5 m squares
  const tile = (base, seam, dots) => {
    const t = paintTexture(13, 0, 13, 16, (P) => {
      P.r(0, 0, 13, 13, base);
      let seed = 5; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let k = 0; k < 160; k++) { const x = r() * 13, y = r() * 13; P.r(x, y, x + 0.3 + r() * 0.8, y + 0.2 + r() * 0.5, dots); }
      for (const q of [0, 6.5]) { P.r(q, 0, q + 0.1, 13, seam); P.r(0, q, 13, q + 0.1, seam); }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
  return (TEX = { glass, roof: tile('#d2d5d6', '#b9bdbf', 'rgba(170,174,178,0.35)'), dark: tile('#5c6166', '#4c5156', 'rgba(80,84,90,0.4)') });
}

export function createErm(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  const h = (x, z) => world.heightAt(x, z);

  // the map's footprint is freed and the glass walls made solid instead: the overhang and the court are open
  const seg = (a, b, t = 0.35) => { const [ax, az] = F.at(...a), [bx, bz] = F.at(...b); return { x: (ax + bx) / 2, z: (az + bz) / 2, yaw: Math.atan2(-(bz - az), bx - ax), hx: Math.hypot(bx - ax, bz - az) / 2 + t, hz: t }; };
  // each wall: from a to b (s, v) and its outward direction [dv, ds]
  const WALLS = [
    [[GW, WV0], [S1 - 0.4, WV0], [-1, 0]], [[GW, WV1], [S1 - 0.4, WV1], [1, 0]], [[GW, WV0], [GW, WV1], [0, -1]],
    [[S1 - 0.4, WV0], [S1 - 0.4, SLOT.v0 - 0.6], [0, 1]], [[S1 - 0.4, SLOT.v1 + 0.6], [S1 - 0.4, WV1], [0, 1]],
    [[SLOT.s + 0.6, SLOT.v0 - 0.6], [S1 - 0.4, SLOT.v0 - 0.6], [1, 0]], [[SLOT.s + 0.6, SLOT.v1 + 0.6], [S1 - 0.4, SLOT.v1 + 0.6], [-1, 0]],
    [[SLOT.s + 0.6, SLOT.v0 - 0.6], [SLOT.s + 0.6, SLOT.v1 + 0.6], [0, 1]],
  ];
  { const [x, z] = F.at((S0 + S1) / 2, (V0 + V1) / 2);
    world.addFree([{ x, z, yaw: F.YAW, hx: (S1 - S0) / 2 + 1.5, hz: (V1 - V0) / 2 + 1.5 }]); }
  world.addSolids(WALLS.map(([a, b]) => seg(a, b)));
  // the distillery's house and chimney, the posts of the glass roof
  world.addSolids([{ x: HOUSE.at(0, 0)[0], z: HOUSE.at(0, 0)[1], yaw: HOUSE.YAW, hx: 7.6, hz: 3.9 }]);

  let built = false;

  function* hall() {
    const T = textures();
    const roofTop = surf(), darkTop = surf(), slab = surf(), glass = surf();
    const P3 = (s, v, y) => { const [x, z] = F.at(s, v); return [x, y, z]; };
    const up = [0, 1, 0], down = [0, -1, 0];
    // ---- the roof: the main part and the two wings, top and underside
    const rects = [[S0, SLOT.s, V0, V1], [SLOT.s, S1, V0, SLOT.v0], [SLOT.s, S1, SLOT.v1, V1]];
    const inDark = (s, v) => { let c = false; for (let i = 0, j = DARK.length - 1; i < DARK.length; j = i++) { const [si, vi] = DARK[i], [sj, vj] = DARK[j]; if ((vi > v) !== (vj > v) && s < (sj - si) * (v - vi) / (vj - vi) + si) c = !c; } return c; };
    for (const [s0, s1, v0, v1] of rects) {
      // in cells of 6.5 m so the dark part over the entrance can be told apart
      for (let s = s0; s < s1 - 0.01; s += 6.5) for (let v = v0; v < v1 - 0.01; v += 6.5) {
        const sa = s, sb = Math.min(s1, s + 6.5), va = v, vb = Math.min(v1, v + 6.5);
        const o = inDark((sa + sb) / 2, (va + vb) / 2) ? darkTop : roofTop;
        quad(o, P3(sa, va, ROOF(sa)), P3(sa, vb, ROOF(sa)), P3(sb, vb, ROOF(sb)), P3(sb, va, ROOF(sb)), up, [[sa / 13, va / 13], [sa / 13, vb / 13], [sb / 13, vb / 13], [sb / 13, va / 13]]);
      }
      quad(slab, P3(s0, v0, ROOF(s0) - SLAB), P3(s1, v0, ROOF(s1) - SLAB), P3(s1, v1, ROOF(s1) - SLAB), P3(s0, v1, ROOF(s0) - SLAB), down, [[0, 0], [0, 0], [0, 0], [0, 0]]);
    }
    // the slab's edges all round (the roof's faces wind counter-clockwise seen from their side: s then v turns
    // clockwise on the map seen from above)
    const edge = (a, b, n) => quad(slab, P3(a[0], a[1], ROOF(a[0]) - SLAB), P3(b[0], b[1], ROOF(b[0]) - SLAB), P3(b[0], b[1], ROOF(b[0]) + 0.05), P3(a[0], a[1], ROOF(a[0]) + 0.05), n, [[0, 0], [0, 0], [0, 0], [0, 0]]);
    const nOut = (dv, ds) => [F.U[0] * ds + F.V[0] * dv, 0, F.U[1] * ds + F.V[1] * dv];
    edge([S0, V0], [S1, V0], nOut(-1, 0)); edge([S0, V1], [S1, V1], nOut(1, 0)); edge([S0, V0], [S0, V1], nOut(0, -1));
    edge([S1, V0], [S1, SLOT.v0], nOut(0, 1)); edge([S1, SLOT.v1], [S1, V1], nOut(0, 1));
    edge([SLOT.s, SLOT.v0], [S1, SLOT.v0], nOut(1, 0)); edge([SLOT.s, SLOT.v1], [S1, SLOT.v1], nOut(-1, 0)); edge([SLOT.s, SLOT.v0], [SLOT.s, SLOT.v1], nOut(0, 1));
    yield;
    // ---- the glass walls: from below the ground to the slab, in pieces of 4 m that follow the ground
    const wall = (a, b, n) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(len / 4));
      const pt = (f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      const foot = (f) => { const [s, v] = pt(f); const [x, z] = F.at(s, v); return Math.min(h(x, z), h(x + n[0] * 1.5, z + n[2] * 1.5)) - 0.6; };
      for (let i = 0; i < k; i++) {
        const fa = i / k, fb = (i + 1) / k, [sa, va] = pt(fa), [sb, vb] = pt(fb);
        const ya = foot(fa), yb = foot(fb), ta = ROOF(sa) - SLAB, tb = ROOF(sb) - SLAB, ua = fa * len / 21.6, ub = fb * len / 21.6;
        quad(glass, P3(sa, va, ya), P3(sb, vb, yb), P3(sb, vb, tb), P3(sa, va, ta), n, [[ua, (ya - 18) / 16.2], [ub, (yb - 18) / 16.2], [ub, (tb - 18) / 16.2], [ua, (ta - 18) / 16.2]]);
      }
    };
    for (const [a, b, [dv, ds]] of WALLS) wall(a, b, nOut(dv, ds));
    yield;
    const mGlass = new THREE.MeshLambertMaterial({ map: T.glass, side: THREE.DoubleSide });
    group.add(toMesh(glass, mGlass, shadows));
    group.add(toMesh(roofTop, new THREE.MeshLambertMaterial({ map: T.roof }), shadows));
    group.add(toMesh(darkTop, new THREE.MeshLambertMaterial({ map: T.dark }), false));
    group.add(toMesh(slab, new THREE.MeshLambertMaterial({ color: 0xd6dadb, side: THREE.DoubleSide }), shadows));
    yield;

    // ---- on the roof: the sunken courts, skylights, vents
    const A = areaKit(world, group, { shadows });
    const { p } = A;
    const onRoof = (s, v, ls, lv, y0, y1, c) => { const [x, z] = F.at(s, v); p.box(ls, y1 - y0, lv, c, x, ROOF(s) + (y0 + y1) / 2, z, F.YAW); };
    for (const [s0, s1, v0, v1] of WELLS) {
      const sm = (s0 + s1) / 2, vm = (v0 + v1) / 2, ls = s1 - s0, lv = v1 - v0;
      onRoof(sm, vm, ls, lv, 0.02, 0.06, 0x1b2024);                                  // the court's dark depth
      onRoof(sm, vm, ls - 1.6, lv - 1.6, 0.06, 0.1, 0x2c3a40);                      // its glass sides seen from above
      for (const [ds, dv, a, b] of [[0, -lv / 2, ls, 0.5], [0, lv / 2, ls, 0.5], [-ls / 2, 0, 0.5, lv], [ls / 2, 0, 0.5, lv]]) onRoof(sm + ds, vm + dv, a, b, 0, 0.45, 0xeef0ef);
    }
    for (const [s, v] of SKY) { onRoof(s, v, 6.4, 4.0, 0, 0.3, 0xe9ecec); onRoof(s, v, 5.8, 3.4, 0.3, 0.42, 0x41617d); }
    let seed = 3; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 40; k++) {
      const s = S0 + 8 + r() * (S1 - S0 - 16), v = V0 + 4 + r() * (V1 - V0 - 8);
      if (s > SLOT.s - 2 && v > SLOT.v0 - 2 && v < SLOT.v1 + 2) continue;
      onRoof(s, v, 0.8, 0.5, 0, 0.3, k % 3 ? 0xe4e6e6 : 0x2a2c30);
    }
    if (jobs.late()) yield;
    // ---- the entrance under the overhang: three dark glass doors with their frames, the paving
    for (const v of [-9, 0, 9]) {
      const [x, z] = F.at(GW - 0.15, v), y = h(x, z);
      p.box(0.25, 3.3, 4.4, 0xc9cfd1, x, y + 1.6, z, F.YAW);
      const [x2, z2] = F.at(GW - 0.3, v);
      p.box(0.1, 2.8, 3.6, 0x2a3238, x2, y + 1.4, z2, F.YAW);
    }
    A.pave(F, S0 - 2, GW, -30, 30, 'concrete');
    yield;

    // ---- the A car park: lamp posts down its middle
    for (let s = 20; s < 160; s += 28) { const [x, z] = LOT.at(s, 20); A.lamp(x, z, LOT.V, 8, 0.6); A.lamp(x, z, [-LOT.V[0], -LOT.V[1]], 8, 0.6); }
    A.finish();
  }

  function* ruin() {
    const A = areaKit(world, group, { shadows });
    const { p } = A;
    const brick = 0x94503c, dark = 0x7c3f2f;
    const g0 = Math.min(...[[0, 0], [RUIN_L, 0], [0, RUIN_W], [RUIN_L, -RUIN_W]].map(([s, v]) => { const [x, z] = RUIN.at(s, v); return h(x, z); }));
    // the broken brick walls round the strip: lower in places, with gaps for the doors
    let seed = 9; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const v of [-RUIN_W, RUIN_W]) for (let s = 0; s < RUIN_L; s += 2.4) {
      if (r() < 0.18) continue;
      A.box(RUIN, s + 1.2, v, 2.4, 0.6, -0.5, 0.8 + r() * 2.2, r() < 0.5 ? brick : dark, g0);
    }
    for (const s of [0, RUIN_L]) for (let v = -RUIN_W; v < RUIN_W; v += 2.2) A.box(RUIN, s, v + 1.1, 0.6, 2.2, -0.5, 1.2 + r() * 1.8, brick, g0);
    for (const [s, v] of [[6, -RUIN_W], [15, RUIN_W], [24, -RUIN_W]]) A.box(RUIN, s, v, 1.0, 0.9, -0.5, 3.4, brick, g0);    // pillars left standing
    // the steel frame of the glass roof: posts and a grid of beams at 4.6 m, the glass laid on it
    const top = 4.6;
    for (let s = 0; s <= RUIN_L + 0.01; s += RUIN_L / 6) for (const v of [-RUIN_W - 0.3, RUIN_W + 0.3]) A.box(RUIN, s, v, 0.18, 0.18, -0.3, top, 0xb8bcbf, g0);
    for (let s = 0; s <= RUIN_L + 0.01; s += RUIN_L / 12) A.box(RUIN, s, 0, 0.12, RUIN_W * 2 + 0.6, top - 0.25, top, 0xc6cacc, g0);
    for (let v = -RUIN_W - 0.3; v <= RUIN_W + 0.31; v += (RUIN_W * 2 + 0.6) / 4) A.box(RUIN, RUIN_L / 2, v, RUIN_L, 0.12, top - 0.25, top, 0xc6cacc, g0);
    { const [x, z] = RUIN.at(RUIN_L / 2, 0);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(RUIN_L + 0.4, RUIN_W * 2 + 1.0).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xcfe0e6, transparent: true, opacity: 0.35, depthWrite: false }));
      m.position.set(x, g0 + top + 0.02, z); m.rotation.y = RUIN.YAW + Math.PI / 2; group.add(m); }
    // the brick house beside it (15 x 7.8 m, roofless walls) and its chimney with the white top
    const gh = (() => { const [x, z] = HOUSE.at(0, 0); return h(x, z); })();
    for (const [s, v, ls, lv] of [[0, -3.9, 15, 0.6], [0, 3.9, 15, 0.6], [-7.5, 0, 0.6, 7.8], [7.5, 0, 0.6, 7.8]]) A.box(HOUSE, s, v, ls, lv, -0.5, 4.6, brick, gh);
    for (const s of [-4, 0, 4]) A.box(HOUSE, s, 0, 0.5, 7.8, -0.5, 5.6, dark, gh);
    A.box(HOUSE, 0, 0, 14.4, 7.2, 3.9, 4.1, 0x6e6a66, gh);
    A.box(HOUSE, 5.6, -2.0, 1.7, 1.7, -0.5, 16.5, dark, gh);
    A.box(HOUSE, 5.6, -2.0, 1.9, 1.9, 16.5, 17.2, 0xeeeeea, gh);
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 700) return;
      const pts = [F.at(S0, 0), F.at(0, V0), F.at(0, V1), F.at(S1, 0), RUIN.at(RUIN_L / 2, 0), LOT.at(140, 20)];
      if (pts.every(([x, z]) => world.ready(x, z))) { built = true; jobs.add(function* () { yield* hall(); yield; yield* ruin(); }, 'erm'); }
    },
  };
}
