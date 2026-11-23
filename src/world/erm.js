// The Estonian National Museum (Eesti Rahva Muuseum, Muuseumi tee 2, Raadi), built by hand (Martin, 22 Nov: "do
// the erm") from the Land Board's oblique air photos (April 2023, April 2024), its height map (nDSM) and the
// orthophoto, in place of the map's rough wedge; the entrance and the east end again from his Street View shots
// (23 Nov: "you should drive under the entrance ... it should be possible to drive up the ERM building from the
// back and all across it and you can drive off of it from any edge").
//  - The hall, 358 m long and 78 m wide, lying along the old Raadi airfield's runway: one flat roof sloping from
//    about 15 m over the ground at the west end down to 3.5 m at the east, where the two wings run on as three
//    grey roof plates each, stepping down into the runway's concrete with the open court between them;
//  - its walls of pale printed glass in narrow upright panes with darker patches;
//  - the entrance: the roof runs out over a covered forecourt the width of the hall, 23 m deep, its dark steel
//    grid ceiling sloping down from the roof's edge to the low glass front with the doors;
//  - the roof: grey membrane in squares, the dark grey part over the entrance, two sunken courts with glass sides,
//    blue skylights, vents;
//  - the A car park north-west of it: lamp posts and parked cars;
//  - the ruin of the manor's distillery by Raadi lake: the low red brick walls under the glass roof on its steel
//    frame, the brick house beside it and its tall chimney.
// Drivable: the forecourt under the canopy, the court between the wings, and the whole roof (world.addSlab), up
// the plates from the runway; the walls stop only cars below their top (world.addLedges), so a car drives off
// any edge. The depth of the forecourt and the plates' lengths are read from the photos (no plan of it).
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
// Martin's Street View shots (23 Nov) and the air photos: the roof runs out over the entrance as a canopy; under
// it the covered forecourt between the two long glass walls, its dark ceiling sloping down from the roof's edge to
// the low glass front with the doors. At the east end the two wings run on past the main roof as a row of grey
// roof plates stepping down to the runway, the court between them open to it: up those plates a car drives onto
// the roof, and off any edge.
const S0 = -169, SM = 170, SE = 250, V0 = -38.6, V1 = 39.4;   // roof: west edge, end of the main roof, the plates' foot
const WV0 = -38.0, WV1 = 38.8;                               // the long glass walls
const SF = -146;                                             // the glass front with the doors, under the canopy
const PLATES = [SM, 195, 212, SE];                           // the plates at the east end (s where each starts)
const SLOT = { s: 124, v0: -11, v1: 13 };                    // the open court between the east wings
const ROOF = (s) => 37.3 - 0.0309 * (s + 165);               // the roof's top, metres above the map's zero
const SLAB = 1.2, EDGE = 1.4;                                 // the roof's thickness, the canopy's front edge
const WELLS = [[-84, -58, -24, -15], [-79, -53, 9, 18]];     // the sunken courts in the roof: s0, s1, v0, v1
const SKY = [[19, -8], [98, -8], [71, 21], [117, 22], [-30, 17], [-96, -6], [-120, 17], [-8, -24], [45, 12], [150, -25], [160, 25], [-60, 30]];
// the dark grey roof over the entrance (s, v)
const DARK = [[S0, V0], [-122, V0], [-120, -23], [-116, 4], [-141, 0], [-135, 23], [-150, V1], [S0, V1]];
// the distillery ruin: the glass roof's strip (s along, v across) and the brick house with the chimney
const RUIN = frame([2569.5, 926.5], [29.5, 26]);
const RUIN_L = 39.3, RUIN_W = 5.6;
const HOUSE = frame([2588.75, 929.5], [12, 9]);
// the A car park: s along its north-east edge from its north-west corner, v across it (south-west)
// the low blocks across the runway in front of the plates (v)
const BLOCKS = [-37, -14, 16, 38];
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
  // a square of roof (13 m): a base colour, seams every 6.5 m, flecks
  const tile = (base, seam, dots, n = 160, step = 6.5) => {
    const t = paintTexture(13, 0, 13, 16, (P) => {
      P.r(0, 0, 13, 13, base);
      let seed = 5; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let k = 0; k < n; k++) { const x = r() * 13, y = r() * 13; P.r(x, y, x + 0.3 + r() * 0.8, y + 0.2 + r() * 0.5, dots); }
      for (let q = 0; q < 13; q += step) { P.r(q, 0, q + 0.1, 13, seam); P.r(0, q, 13, q + 0.1, seam); }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
  // the canopy's ceiling (his photos from under it): dark steel grid of 0.8 m panels on beams every 6.4 m, a few
  // lamps and the odd glass panel to the sky
  const ceiling = paintTexture(12.8, 0, 12.8, 16, (P) => {
    P.r(0, 0, 12.8, 12.8, '#6a615a');
    for (let q = 0; q < 12.8; q += 0.8) { P.r(q, 0, q + 0.04, 12.8, '#4a433e'); P.r(0, q, 12.8, q + 0.04, '#4a433e'); }
    for (let q = 0; q < 12.8; q += 6.4) { P.r(q, 0, q + 0.18, 12.8, '#857b72'); P.r(0, q, 12.8, q + 0.18, '#857b72'); }
    for (const [x, y] of [[2.0, 3.2], [8.4, 3.2], [5.2, 9.6], [11.6, 9.6]]) P.r(x, y, x + 0.5, y + 0.22, '#fff1d0');
    P.r(3.2, 6.4, 4.8, 8.0, '#a9b8c4');
  });
  ceiling.wrapS = ceiling.wrapT = THREE.RepeatWrapping;
  return (TEX = {
    glass, ceiling,
    roof: tile('#d2d5d6', '#b9bdbf', 'rgba(170,174,178,0.35)'),
    dark: tile('#5c6166', '#4c5156', 'rgba(80,84,90,0.4)'),
    plate: tile('#c4c7c8', '#a4a8aa', 'rgba(150,154,158,0.35)'),
    gravel: tile('#a3a5a6', '#909395', 'rgba(96,98,102,0.3)', 2600, 13),
    concrete: tile('#cfcfc9', '#b4b4ae', 'rgba(150,150,144,0.3)', 120, 3.25),
  });
}

export function createErm(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  const h = (x, z) => world.heightAt(x, z);
  const gAt = (s, v) => { const [x, z] = F.at(s, v); return h(x, z); };

  // the map's footprint (and the plates' strip) is freed; the walls come back as walls that stop only a car below
  // their top (world.addLedges), so a car on the roof drives off over them
  { const [x, z] = F.at((S0 + SE) / 2, (V0 + V1) / 2);
    world.addFree([{ x, z, yaw: F.YAW, hx: (SE - S0) / 2 + 1.5, hz: (V1 - V0) / 2 + 1.5 }]); }
  // the distillery's house and chimney, the posts of the glass roof
  world.addSolids([{ x: HOUSE.at(0, 0)[0], z: HOUSE.at(0, 0)[1], yaw: HOUSE.YAW, hx: 7.6, hz: 3.9 }]);

  // ground levels, read once the map is there: under the plates' foot (each wing) and in front of the doors
  const G = { foot0: 0, foot1: 0, front: 0 };
  const ceil = (s) => { const a = ROOF(S0) - EDGE; return a + (G.front + 5.2 - a) * (s - S0) / (SF - S0); };
  const plateTop = (s, v) => ROOF(SM) + ((v < 0 ? G.foot0 : G.foot1) + 0.03 - ROOF(SM)) * (s - SM) / (SE - SM);
  // the roof's top at (s, v): -Infinity off the roof
  const topAt = (s, v) => {
    if (s < S0 || s > SE || v < V0 || v > V1) return -Infinity;
    if (s > SLOT.s && v > SLOT.v0 && v < SLOT.v1) return -Infinity;
    return s <= SM ? ROOF(s) : plateTop(s, v);
  };
  const nOut = (dv, ds) => [F.U[0] * ds + F.V[0] * dv, 0, F.U[1] * ds + F.V[1] * dv];

  function drivable() {
    G.foot0 = gAt(SE, (V0 + SLOT.v0) / 2); G.foot1 = gAt(SE, (SLOT.v1 + V1) / 2); G.front = gAt(SF - 4, 0);
    // the roof as ground for the cars, a skylight a step up on it
    const cs = [[S0, V0], [S0, V1], [SE, V0], [SE, V1]].map(([s, v]) => F.at(s, v));
    world.addSlab({
      x0: Math.min(...cs.map((c) => c[0])), x1: Math.max(...cs.map((c) => c[0])), z0: Math.min(...cs.map((c) => c[1])), z1: Math.max(...cs.map((c) => c[1])),
      at(x, z) {
        const [s, v] = F.sv(x, z), y = topAt(s, v);
        if (y === -Infinity) return y;
        for (let k = 0; k < SKY.length; k++) if (Math.abs(s - SKY[k][0]) < 3.2 && Math.abs(v - SKY[k][1]) < 2.0) return y + 0.38;
        return y;
      },
    });
    // the walls: from a to b (s, v), facing out along (dv, ds), stopping a car below top(s)
    const L = [];
    const wall = (a, b, [dv, ds], top) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(len / 6)), n = nOut(dv, ds);
      for (let i = 0; i < k; i++) {
        const sa = a[0] + (b[0] - a[0]) * i / k, va = a[1] + (b[1] - a[1]) * i / k, sb = a[0] + (b[0] - a[0]) * (i + 1) / k, vb = a[1] + (b[1] - a[1]) * (i + 1) / k;
        const [x, z] = F.at((sa + sb) / 2, (va + vb) / 2);
        L.push({ x: x - n[0] * 0.3, z: z - n[2] * 0.3, yaw: Math.atan2(-n[0], -n[2]), hx: len / k / 2, hz: 0.3, top: Math.min(top(sa), top(sb)) });
      }
    };
    const under = (s) => ROOF(s) - SLAB, low = (v) => (s) => topAt(s, v) - 0.05;
    wall([S0 + 0.6, WV0], [SM, WV0], [-1, 0], under); wall([S0 + 0.6, WV1], [SM, WV1], [1, 0], under);       // the long walls
    wall([S0 + 0.6, WV0 + 0.6], [SF, WV0 + 0.6], [1, 0], under); wall([S0 + 0.6, WV1 - 0.6], [SF, WV1 - 0.6], [-1, 0], under);   // their faces to the forecourt
    wall([SF, WV0], [SF, WV1], [0, -1], () => ceil(SF));                                                    // the glass front
    wall([SM, V0], [SE, V0], [-1, 0], low(V0 + 0.5)); wall([SM, V1], [SE, V1], [1, 0], low(V1 - 0.5));     // the plates' sides
    wall([SLOT.s, SLOT.v0], [SE, SLOT.v0], [1, 0], low(SLOT.v0 - 0.5)); wall([SLOT.s, SLOT.v1], [SE, SLOT.v1], [-1, 0], low(SLOT.v1 + 0.5));   // the court
    wall([SLOT.s, SLOT.v0], [SLOT.s, SLOT.v1], [0, 1], () => ROOF(SLOT.s) - 0.05);
    world.addLedges(L.filter((b) => b.top > -Infinity));
    // the low blocks across the runway in front of the plates
    world.addSolids(BLOCKS.map((v) => { const [x, z] = F.at(SE + 7, v); return { x, z, yaw: F.YAW, hx: 0.85, hz: 0.3 }; }));
  }

  let built = false;

  function* hall() {
    drivable();
    const T = textures();
    const roofTop = surf(), darkTop = surf(), plates = surf(), gravel = surf(), slab = surf(), glass = surf(), ceiling = surf(), conc = surf();
    const P3 = (s, v, y) => { const [x, z] = F.at(s, v); return [x, y, z]; };
    const up = [0, 1, 0], down = [0, -1, 0];
    const uvs = (sa, sb, va, vb, k = 13) => [[sa / k, va / k], [sa / k, vb / k], [sb / k, vb / k], [sb / k, va / k]];
    // ---- the roof: the main part and the two wings, in cells of 6.5 m so the dark part over the entrance shows
    const inDark = (s, v) => { let c = false; for (let i = 0, j = DARK.length - 1; i < DARK.length; j = i++) { const [si, vi] = DARK[i], [sj, vj] = DARK[j]; if ((vi > v) !== (vj > v) && s < (sj - si) * (v - vi) / (vj - vi) + si) c = !c; } return c; };
    for (const [s0, s1, v0, v1] of [[S0, SLOT.s, V0, V1], [SLOT.s, SM, V0, SLOT.v0], [SLOT.s, SM, SLOT.v1, V1]]) {
      for (let s = s0; s < s1 - 0.01; s += 6.5) for (let v = v0; v < v1 - 0.01; v += 6.5) {
        const sa = s, sb = Math.min(s1, s + 6.5), va = v, vb = Math.min(v1, v + 6.5);
        quad(inDark((sa + sb) / 2, (va + vb) / 2) ? darkTop : roofTop, P3(sa, va, ROOF(sa)), P3(sa, vb, ROOF(sa)), P3(sb, vb, ROOF(sb)), P3(sb, va, ROOF(sb)), up, uvs(sa, sb, va, vb));
      }
      // its underside, where there is no canopy ceiling
      const sa = Math.max(s0, SF);
      quad(slab, P3(sa, v0, ROOF(sa) - SLAB), P3(s1, v0, ROOF(s1) - SLAB), P3(s1, v1, ROOF(s1) - SLAB), P3(sa, v1, ROOF(sa) - SLAB), down, uvs(0, 0, 0, 0));
    }
    // the plates stepping down to the runway: three on each wing, the lowest gravelled
    for (const [v0, v1] of [[V0, SLOT.v0], [SLOT.v1, V1]]) {
      for (let k = 0; k < 3; k++) {
        const sa = PLATES[k], sb = PLATES[k + 1], o = k === 2 ? gravel : plates;
        for (let s = sa; s < sb - 0.01; s += 6.5) {
          const a = s, b = Math.min(sb, s + 6.5);
          quad(o, P3(a, v0, plateTop(a, v0) + 0.02), P3(a, v1, plateTop(a, v1) + 0.02), P3(b, v1, plateTop(b, v1) + 0.02), P3(b, v0, plateTop(b, v0) + 0.02), up, uvs(a, b, v0, v1));
        }
      }
    }
    // the slab's edges along the main roof, and the canopy's front edge
    const edge = (a, b, n, y0 = (s) => ROOF(s) - SLAB) => quad(slab, P3(a[0], a[1], y0(a[0])), P3(b[0], b[1], y0(b[0])), P3(b[0], b[1], ROOF(b[0]) + 0.05), P3(a[0], a[1], ROOF(a[0]) + 0.05), n, uvs(0, 0, 0, 0));
    edge([S0, V0], [SM, V0], nOut(-1, 0)); edge([S0, V1], [SM, V1], nOut(1, 0));
    edge([S0, V0], [S0, V1], nOut(0, -1), () => ceil(S0));
    yield;
    // ---- concrete: the plates' sides down to the ground, the court's walls, in pieces of 4 m that follow the ground
    const side = (o, a, b, n, top, foot = -0.6, k0 = 21.6) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(len / 4));
      const pt = (f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      const fy = (f) => { const [s, v] = pt(f); const [x, z] = F.at(s, v); return Math.min(h(x, z), h(x + n[0] * 1.5, z + n[2] * 1.5)) + foot; };
      for (let i = 0; i < k; i++) {
        const fa = i / k, fb = (i + 1) / k, [sa, va] = pt(fa), [sb, vb] = pt(fb);
        const ya = fy(fa), yb = fy(fb), ta = top(sa, va), tb = top(sb, vb), ua = fa * len / k0, ub = fb * len / k0;
        quad(o, P3(sa, va, ya), P3(sb, vb, yb), P3(sb, vb, tb), P3(sa, va, ta), n, [[ua, (ya - 18) / 16.2], [ub, (yb - 18) / 16.2], [ub, (tb - 18) / 16.2], [ua, (ta - 18) / 16.2]]);
      }
    };
    const plateEdge = (s, v) => plateTop(s, v) + 0.02;
    side(conc, [SM, V0], [SE, V0], nOut(-1, 0), plateEdge, -0.3, 6.5); side(conc, [SM, V1], [SE, V1], nOut(1, 0), plateEdge, -0.3, 6.5);
    side(conc, [SLOT.s, SLOT.v0], [SE, SLOT.v0], nOut(1, 0), (s, v) => topAt(s, v - 0.5) + 0.02, -0.3, 6.5);
    side(conc, [SLOT.s, SLOT.v1], [SE, SLOT.v1], nOut(-1, 0), (s, v) => topAt(s, v + 0.5) + 0.02, -0.3, 6.5);
    side(conc, [SLOT.s, SLOT.v0], [SLOT.s, SLOT.v1], nOut(0, 1), () => ROOF(SLOT.s) + 0.02, 3.6, 6.5);         // over the court's glass doors
    // ---- glass: the long walls up to the slab, the low front under the canopy, the court's doors
    side(glass, [S0 + 0.6, WV0], [SM, WV0], nOut(-1, 0), (s) => ROOF(s) - SLAB);
    side(glass, [S0 + 0.6, WV1], [SM, WV1], nOut(1, 0), (s) => ROOF(s) - SLAB);
    side(glass, [SF, WV0], [SF, WV1], nOut(0, -1), () => ceil(SF));
    side(glass, [SLOT.s, SLOT.v0], [SLOT.s, SLOT.v1], nOut(0, 1), (s) => gAt(s, 0) + 3.6);
    yield;
    // ---- the canopy's ceiling: from the roof's edge down to the top of the glass front
    for (let s = S0; s < SF - 0.01; s += 6.4) for (let v = WV0; v < WV1 - 0.01; v += 6.4) {
      const sa = s, sb = Math.min(SF, s + 6.4), va = v, vb = Math.min(WV1, v + 6.4);
      quad(ceiling, P3(sa, va, ceil(sa)), P3(sb, va, ceil(sb)), P3(sb, vb, ceil(sb)), P3(sa, vb, ceil(sa)), down, uvs(sa, sb, va, vb, 12.8));
    }
    // its strips outside the walls, at the slab's underside
    for (const [v0, v1] of [[V0, WV0], [WV1, V1]]) quad(slab, P3(S0, v0, ROOF(S0) - SLAB), P3(SF, v0, ROOF(SF) - SLAB), P3(SF, v1, ROOF(SF) - SLAB), P3(S0, v1, ROOF(S0) - SLAB), down, uvs(0, 0, 0, 0));
    const mat = (o) => new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, ...o });
    group.add(toMesh(glass, mat({ map: T.glass }), shadows));
    group.add(toMesh(roofTop, mat({ map: T.roof }), shadows));
    group.add(toMesh(darkTop, mat({ map: T.dark }), false));
    group.add(toMesh(plates, mat({ map: T.plate }), shadows));
    group.add(toMesh(gravel, mat({ map: T.gravel }), false));
    group.add(toMesh(conc, mat({ map: T.concrete }), shadows));
    group.add(toMesh(ceiling, mat({ map: T.ceiling }), false));
    group.add(toMesh(slab, mat({ color: 0xd6dadb }), shadows));
    yield;

    // ---- on the roof: the sunken courts, skylights, vents; the seams between the plates
    const A = areaKit(world, group, { shadows });
    const { p } = A;
    const onRoof = (s, v, ls, lv, y0, y1, c) => { const [x, z] = F.at(s, v); p.box(ls, y1 - y0, lv, c, x, ROOF(s) + (y0 + y1) / 2, z, F.YAW); };
    for (const [s0, s1, v0, v1] of WELLS) {
      const sm = (s0 + s1) / 2, vm = (v0 + v1) / 2, ls = s1 - s0, lv = v1 - v0;
      onRoof(sm, vm, ls, lv, 0.02, 0.06, 0x1b2024);                                  // the court's dark depth
      onRoof(sm, vm, ls - 1.6, lv - 1.6, 0.06, 0.1, 0x2c3a40);                      // its glass sides seen from above
      for (const [ds, dv, a, b] of [[0, -lv / 2, ls, 0.5], [0, lv / 2, ls, 0.5], [-ls / 2, 0, 0.5, lv], [ls / 2, 0, 0.5, lv]]) onRoof(sm + ds, vm + dv, a, b, 0, 0.12, 0xeef0ef);
    }
    for (const [s, v] of SKY) { onRoof(s, v, 6.4, 4.0, 0, 0.3, 0xe9ecec); onRoof(s, v, 5.8, 3.4, 0.3, 0.42, 0x41617d); }
    let seed = 3; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 40; k++) {
      const s = S0 + 8 + r() * (SM - S0 - 16), v = V0 + 4 + r() * (V1 - V0 - 8);
      if (s > SLOT.s - 2 && v > SLOT.v0 - 2 && v < SLOT.v1 + 2) continue;
      onRoof(s, v, 0.8, 0.5, 0, 0.3, k % 3 ? 0xe4e6e6 : 0x2a2c30);
    }
    for (const s of PLATES.slice(1, 3)) for (const [v0, v1] of [[V0, SLOT.v0], [SLOT.v1, V1]]) {
      const [x, z] = F.at(s, (v0 + v1) / 2);
      p.box(0.3, 0.06, v1 - v0, 0x8c9092, x, plateTop(s, v0) + 0.04, z, F.YAW);
    }
    if (jobs.late()) yield;
    // ---- the entrance under the canopy: the doors with their frames, the ERM sign of panes, the paving
    for (const v of [-9, 0, 9]) {
      const [x, z] = F.at(SF - 0.15, v), y = h(x, z);
      p.box(0.25, 3.3, 4.4, 0xc9cfd1, x, y + 1.6, z, F.YAW);
      const [x2, z2] = F.at(SF - 0.3, v);
      p.box(0.1, 2.8, 3.6, 0x8a6a3a, x2, y + 1.4, z2, F.YAW);
    }
    { const [x, z] = F.at(SF - 0.3, -16), y = h(x, z);                 // the dark diamond on the glass by the doors
      p.add(new THREE.BoxGeometry(0.06, 1.3, 1.3).rotateX(Math.PI / 4), 0x3a3f44, x, y + 2.4, z, F.YAW); }
    A.pave(F, S0 - 10, SF, WV0 + 0.3, WV1 - 0.3, 'concrete');
    A.pave(F, SLOT.s, SE + 14, SLOT.v0, SLOT.v1, 'concrete');
    // the low blocks across the runway, and lamps by the court
    for (const v of BLOCKS) { const [x, z] = F.at(SE + 7, v); p.box(1.7, 0.45, 0.6, 0x7c5a4c, x, h(x, z) + 0.2, z, F.YAW); }
    for (const s of [150, 190, 230]) for (const v of [SLOT.v0 + 1.2, SLOT.v1 - 1.2]) { const [x, z] = F.at(s, v); A.lamp(x, z, v < 0 ? F.V : [-F.V[0], -F.V[1]], 6, 0.5); }
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
      const pts = [F.at(S0, 0), F.at(0, V0), F.at(0, V1), F.at(SE, 0), RUIN.at(RUIN_L / 2, 0), LOT.at(140, 20)];
      if (pts.every(([x, z]) => world.ready(x, z))) { built = true; jobs.add(function* () { yield* hall(); yield; yield* ruin(); }, 'erm'); }
    },
  };
}
