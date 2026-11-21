// The two office buildings at the Vanemuise / Ülikooli / Uueturu junction, where a lap is started (Martin,
// 18 Nov, from his Google street views of 2023-2024):
//   Playtech (Uueturu 4 / Ülikooli 1): dark grey tiles, the glazed stair column in the entrance corner, the
//   canopy with the name over the door, the podium and its steps, the blue name on top of the tower end,
//   three rows of big windows along Uueturu, the wing along Ülikooli with its pale set-back top floor
//   SEB (Vanemuise 4): dark brick in a square grid of big windows, loggias and an open corner at the junction,
//   the white letters on the roof edge; the white grid building next to it on Ülikooli (LHV, Postimees)
//   the field stone retaining wall up Vanemuise beside SEB
//   street furniture: the poster stand on the plaza, bike racks, the zone 20 and crossing signs, a street
//   light at the plaza kerb (all of it can be knocked over except the poster stand, and all of it stands
//   off the road)
// House fronts are painted pictures standing a hand's breadth in front of the map's own walls, as on
// Vallikraavi. No street names on the ground.
import * as THREE from 'three';
import { createTrack } from './race.js';
import { BOX, rnd } from './landmarks.js';
import { streetKit, wallOf } from '../world/streetkit.js';
import { facade, tone } from './vallistreet.js';

// wall lines from the LOD2 model (game x, z), the street on the right-hand side going a -> b;
// y: the level the picture is measured from (the ground at the junction end), top: the wall's top (world y)
const WALLS = {
  // Playtech
  PN: { a: [1565.8, 3100.2], b: [1560.5, 3105.15], y: 9.05, top: 23.0 },      // end of the wing, towards the old town
  PU: { a: [1560.5, 3105.15], b: [1577.95, 3123.4], y: 9.05, top: 23.0 },     // the wing along Ülikooli
  PC: { a: [1577.95, 3123.4], b: [1585.55, 3118.4], y: 9.0, top: 24.2 },      // the stair column's wall
  PE: { a: [1585.55, 3118.4], b: [1590.75, 3127.25], y: 9.0, top: 24.4 },     // the entrance wall
  PF: { a: [1590.75, 3127.25], b: [1613.55, 3104.05], y: 8.56, top: 20.2 },   // the long front on Uueturu
  // SEB
  SV: { a: [1547.35, 3168.25], b: [1572.65, 3147.95], y: 9.3, top: 30.9 },    // along Vanemuise
  SN: { a: [1572.65, 3147.95], b: [1551.8, 3125.0], y: 9.3, top: 30.9 },      // along Ülikooli
  SW: { a: [1528.85, 3145.2], b: [1547.35, 3168.25], y: 9.3, top: 30.9 },     // the uphill end, over the stone wall
  // the white grid building next door
  LN: { a: [1551.8, 3125.0], b: [1530.15, 3101.3], y: 9.2, top: 31.0 },
};
const TOWER = { s1: 5.73, top: 24.4 };                    // the first metres of the Uueturu front are a storey higher
const BLOCK = { s0: 20.0, top: 24.2 };                    // and so is the end of the Ülikooli wing at the entrance
const PODIUM = { s0: 2.6, s1: 9.1, n1: 6.4, h: 0.6, stair0: 5.4, tread: 0.32, steps: 3 };   // in the frame of wall PC
const STAIR = { s0: 3.6, s1: 7.9 };                       // the glazed stair column on wall PC
const POSTER = [1589.6, 3130.6];                          // the poster stand on the plaza
export const STONE = { a: [1547.4, 3168.3], b: [1452.7, 3246.9], len: 96 };          // the retaining wall up Vanemuise
const CENTRE = [1575, 3138];
const COL = {
  tile: [104, 104, 126], joint: '#4c4c60', frame: '#262731', plinth: '#d6d3dc', pale: '#d9d7e2',
  brick: [74, 69, 84], white: [236, 234, 242], podium: 0x8a899f, kerb: 0xcfcbd8, steel: 0x9a9daa, iron: 0x24232a,
};
const LIGHT = 0, RACK = 5, CROSSING = 17, ZONE20 = 24, NOPARK = 25;

// building colours: SEB dark brick, its neighbour white (the fronts are painted over them, this is for the rest)
export function playtechWalls(walls) {
  const list = walls && walls.sectors && walls.sectors['3_6'];
  if (!list) return;
  for (let k = 0; k < list.length; k += 4) {
    const x = 1120 + list[k + 1] * 0.1, z = 3040 + list[k + 2] * 0.1;
    if (x < 1500 || x > 1580 || z < 3095 || z > 3175) continue;
    if (list[k] === 889) list[k + 3] = 0x4a4554;
    if (list[k] === 911) list[k + 3] = 0xe6e4ec;
  }
}

const bearing = (dx, dz) => (Math.atan2(dx, -dz) * 180) / Math.PI;
function trackFrame() {
  const track = createTrack();
  return {
    track,
    // a point beside the lap: fractional index, metres to the right of the direction of travel
    T(i, lat) {
      const k = Math.floor(i), f = i - k, a = track.P[k], b = track.P[k + 1], [tx, tz] = track.tan[k];
      return [a[0] + (b[0] - a[0]) * f - tz * lat, a[1] + (b[1] - a[1]) * f + tx * lat];
    },
    hw: (i) => track.HW[Math.round(i)],
  };
}

// Street furniture that can be knocked over: [kind, x, z, bearing]. Nothing stands nearer than a metre to
// the edge of the lap.
export function playtechProps() {
  const { track, T, hw } = trackFrame(), out = [];
  const U = wallOf(WALLS.PU.a, WALLS.PU.b), L = wallOf(WALLS.LN.a, WALLS.LN.b);
  const facing = (w) => bearing(w.nx, w.nz);
  // bike racks in a row on the Ülikooli side of the Playtech entrance, and by the white building across the street
  for (const s of [18.6, 20.6, 22.6]) out.push([RACK, ...U.at(s, 6.4), facing(U)]);
  for (const s of [3.4, 5.6]) out.push([RACK, ...L.at(s, 1.1), facing(L)]);
  // the zone signs at the kerb of Ülikooli: 20 km/h zone, no parking zone, both read from the junction
  out.push([ZONE20, ...U.at(17.0, 8.4), bearing(U.ux, U.uz)], [NOPARK, ...U.at(17.0, 9.2), bearing(U.ux, U.uz)]);
  // crossing signs: at the zebra over Uueturu (plaza side) and the one over Vanemuise (park side), facing the lap
  for (const [i, lat] of [[2313.2, -(hw(2313) + 1.3)], [2302.6, hw(2303) + 1.3]]) {
    const [tx, tz] = track.tan[Math.round(i)];
    out.push([CROSSING, ...T(i, lat), bearing(-tx, -tz)]);
  }
  // the tall street light at the plaza kerb, its arm over the junction
  { const [tx, tz] = track.tan[2310]; out.push([LIGHT, ...T(2310.4, -(hw(2310) + 2.4)), bearing(-tz, tx)]); }
  return out;
}

export function createPlaytech(world, group, { shadows = true } = {}) {
  let built = false;

  function build() {
    built = true;
    const K = streetKit(world, group, { shadows });
    const { p } = K;
    const h = (x, z) => world.heightAt(x, z);
    const solids = [], extra = [], lit = rnd(57);
    const on = (chance = 0.14) => lit() < chance;
    const W = {};
    for (const [k, v] of Object.entries(WALLS)) { W[k] = wallOf(v.a, v.b, v.top); W[k].y = v.y; }

    // a painted front on wall w from s0 to s1, from under the ground line to its top
    const skin = (w, draw, { s0 = 0, s1 = w.len, y0 = -1.2, y1 = w.top - w.y, ppm = 30, off = 0.1, basic = false, clear = false } = {}) => {
      const tex = facade(s1 - s0, y0, y1, ppm, draw);
      const [x, z] = w.at((s0 + s1) / 2, off);
      const g = new THREE.PlaneGeometry(s1 - s0 + (clear ? 0 : 0.06), y1 - y0).rotateY(Math.atan2(w.nx, w.nz)).translate(x, w.y + (y0 + y1) / 2, z);
      const opts = clear ? { map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide } : { map: tex };
      extra.push([g, basic ? new THREE.MeshBasicMaterial(opts) : new THREE.MeshLambertMaterial(opts)]);
    };
    const put = (w, geo, hex, s, y, n, yaw = w.yaw) => { const [x, z] = w.at(s, n); p.add(geo, hex, x, w.y + y, z, yaw); };
    const gnd = (w, s, n) => { const [x, z] = w.at(s, n); return h(x, z) - w.y; };

    // ---------------------------------------------------------------- painters
    // large stone tiles, 120 x 60 cm, in a running bond
    const tiles = (P, x0, ya, x1, yb, seed) => {
      const r = rnd(seed);
      P.r(x0, ya, x1, yb, COL.joint);
      for (let y = Math.floor(ya / 0.6) * 0.6, row = Math.round(y / 0.6); y < yb; y += 0.6, row++) {
        for (let x = x0 - (Math.abs(row) % 2) * 0.6; x < x1; x += 1.2) {
          const xa = Math.max(x0, x + 0.012), xb = Math.min(x1, x + 1.188), y_a = Math.max(ya, y + 0.012), y_b = Math.min(yb, y + 0.588);
          if (xb > xa && y_b > y_a) P.r(xa, y_a, xb, y_b, tone(COL.tile, 0.95 + r() * 0.1));
        }
      }
    };
    // glass that mirrors the evening sky; now and then the light is on inside
    const pane = (P, x0, ya, x1, yb, { top = [150, 170, 222], bottom = [92, 106, 160], light = 0 } = {}) => {
      if (light) { P.grad(x0, ya, x1, yb, '#fff0c4', '#f3cf90'); return; }
      const k = 0.92 + lit() * 0.16;
      P.grad(x0, ya, x1, yb, tone(top, k), tone(bottom, k));
      if (lit() < 0.35) { P.c.fillStyle = `rgba(240,160,210,${0.1 + lit() * 0.16})`; P.c.fillRect(...px(P, x0, ya, x1, yb)); }
    };
    const px = (P, x0, ya, x1, yb) => { const k = P.c.canvas.width / P.w; return [x0 * k, (P.y1 - yb) * k, (x1 - x0) * k, (yb - ya) * k]; };
    // a window set in the tiles: dark frame, metal sill, glass with `bars` uprights
    const tileWin = (P, x0, ya, x1, yb, bars = 0, light = on()) => {
      P.r(x0 - 0.1, ya - 0.1, x1 + 0.1, yb + 0.1, COL.frame);
      P.r(x0 - 0.14, ya - 0.16, x1 + 0.14, ya - 0.08, '#b4b7c6');
      const n = bars + 1;
      for (let k = 0; k < n; k++) pane(P, x0 + (x1 - x0) * k / n + (k ? 0.035 : 0), ya, x0 + (x1 - x0) * (k + 1) / n - (k < n - 1 ? 0.035 : 0), yb, { light });
    };

    // ================================================================ Playtech
    // ---- the long front on Uueturu: the plain tower end with the name on top, three rows of six windows
    const F = W.PF, towerTop = TOWER.top - F.y;
    const plinth = (P, w, s0, hgt = 0.8) => { for (let x = 0; x < P.w; x += 0.5) P.r(x, P.y0, x + 0.5, gnd(w, s0 + x + 0.25, 0.8) + hgt, COL.plinth); };
    skin(F, (P) => { tiles(P, 0, P.y0, P.w, P.y1, 3); plinth(P, F, 0); }, { s0: 0, s1: TOWER.s1, y0: -1.5, y1: towerTop });
    skin(F, (P) => {
      tiles(P, 0, P.y0, P.w, P.y1, 4);
      plinth(P, F, TOWER.s1);
      for (const [ya, yb] of [[1.05, 3.35], [4.75, 6.6], [8.25, 10.1]]) {
        for (let k = 0; k < 6; k++) { const x = 1.3 + k * 4.15; tileWin(P, x, ya, x + 3.2, yb, k === 0 || ya < 2 ? 1 : 0); }
      }
      P.r(22.6, 0.1, 23.6, 1.0, '#8c8e9c'); P.r(24.0, 0.1, 25.0, 1.0, '#8c8e9c');       // vent grilles low down
      P.r(0, P.y1 - 0.12, P.w, P.y1, '#3d3e4c');
    }, { s0: TOWER.s1, y0: -3.2 });
    // the name: blue letters standing on the roof edge of the tower end
    {
      const wm = 5.4, hm = 1.5;
      const tex = facade(wm, 0, hm, 150, (P) => {
        const c = P.c, k = c.canvas.width / wm, blue = '#3f7df0';
        c.strokeStyle = blue; c.lineWidth = 0.1 * k;                              // the swirl
        for (const [rx, ry, dy] of [[0.62, 0.3, 0.02], [0.4, 0.19, -0.08], [0.19, 0.09, -0.16]]) { c.beginPath(); c.ellipse(0.75 * k, (hm - 0.72 + dy) * k, rx * k, ry * k, -0.28, 0, 7); c.stroke(); }
        P.text('playtech', 3.35, 0.7, 1.12, blue, 'italic 800 %px Georgia, "Times New Roman", serif');
      });
      const [x, z] = F.at(TOWER.s1 / 2, 0.22);
      const g = new THREE.PlaneGeometry(wm, hm).rotateY(Math.atan2(F.nx, F.nz)).translate(x, TOWER.top + 0.05, z);
      extra.push([g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide })]);
      put(F, BOX(5.2, 0.08, 0.1), COL.iron, TOWER.s1 / 2, TOWER.top - F.y - 0.62, 0.16);             // the rail they stand on
    }

    // ---- the entrance wall: the door under the canopy, a roller door, three balcony doors above each other
    const E = W.PE, D0 = PODIUM.h;
    skin(E, (P) => {
      tiles(P, 0, P.y0, P.w, P.y1, 5);
      P.r(0.2, D0, 4.5, 3.3, '#23242d');
      P.grad(0.8, D0, 2.8, 3.05, '#ffefc6', '#f0cf96');                           // the glass doors, lit
      for (const x of [0.8, 1.76, 2.72]) P.r(x, D0, x + 0.08, 3.05, COL.frame);
      P.r(0.8, 2.45, 2.8, 2.53, COL.frame);
      P.text('playtech', 3.65, 2.0, 0.34, '#5f9bff', 'italic 800 %px Georgia, serif');
      P.r(5.0, D0, 6.15, 2.95, '#b9bcc8');                                        // the roller door
      for (let y = D0 + 0.12; y < 2.9; y += 0.14) P.r(5.0, y, 6.15, y + 0.02, '#9c9fad');
      [[4.5, 7.0, 1], [7.95, 10.45, 0], [11.4, 13.9, 0]].forEach(([ya, yb, light]) => tileWin(P, 1.7, ya, 3.3, yb, 1, light));
    }, { ppm: 34 });
    for (const y of [4.5, 7.95, 11.4]) {                                          // the balcony rails
      put(E, BOX(1.9, 0.05, 0.05), COL.steel, 2.5, y + 1.05, 0.28);
      put(E, BOX(1.9, 0.04, 0.04), COL.steel, 2.5, y + 0.12, 0.28);
      for (let s = 1.6; s <= 3.41; s += 0.15) put(E, BOX(0.02, 0.93, 0.02), COL.steel, s, y + 0.58, 0.28);
      for (const s of [1.57, 3.43]) put(E, BOX(0.04, 0.05, 0.2), COL.steel, s, y + 1.05, 0.2);
    }
    // the canopy with the name on its edge
    put(E, BOX(4.7, 0.5, 1.7), 0x3a3b48, 2.3, 3.6, 0.85);
    {
      const tex = facade(4.7, 0, 0.5, 110, (P) => { P.r(0, 0, 4.7, 0.5, '#3a3b48'); P.text('playtech', 2.35, 0.27, 0.42, '#d6dae6', 'italic 800 %px Georgia, serif'); });
      const [x, z] = E.at(2.3, 1.72);
      extra.push([new THREE.PlaneGeometry(4.7, 0.5).rotateY(Math.atan2(E.nx, E.nz)).translate(x, E.y + 3.6, z), new THREE.MeshLambertMaterial({ map: tex })]);
    }

    // ---- the stair column's wall: tiles, and the glazed column standing a little proud of them
    const C = W.PC, colTop = C.top - C.y - 0.7;
    skin(C, (P) => { tiles(P, 0, P.y0, P.w, P.y1, 6); P.r(0, P.y1 - 0.12, P.w, P.y1, '#3d3e4c'); });
    skin(C, (P) => {
      P.r(0, P.y0, P.w, P.y1, COL.frame);
      const cw = P.w / 3;
      for (let f = 0, y = D0; y < P.y1 - 0.5; f++, y += 3.5) {
        const yb = Math.min(P.y1 - 0.08, y + 2.6);
        for (let k = 0; k < 3; k++) pane(P, k * cw + 0.06, y + 0.06, (k + 1) * cw - 0.06, yb, { top: [124, 142, 196], bottom: [62, 72, 112], light: f > 0 && k === 1 && f % 2 === 1 });
        if (yb < P.y1 - 0.2) P.r(0.06, yb + 0.06, P.w - 0.06, Math.min(P.y1 - 0.08, y + 3.44), '#b7bac8');     // pale panel between floors
      }
      P.r(cw - 0.02, D0, 2 * cw + 0.02, D0 + 2.3, COL.frame);                     // the double door at the foot
      P.grad(cw + 0.08, D0, P.w / 2 - 0.03, D0 + 2.22, '#ffefc6', '#f0cf96'); P.grad(P.w / 2 + 0.03, D0, 2 * cw - 0.08, D0 + 2.22, '#ffefc6', '#f0cf96');
    }, { s0: STAIR.s0, s1: STAIR.s1, y0: D0, y1: colTop, off: 0.3, ppm: 40 });
    for (const s of [STAIR.s0, STAIR.s1]) put(C, BOX(0.1, colTop - D0, 0.3), 0x262731, s, (colTop + D0) / 2, 0.15);
    put(C, BOX(STAIR.s1 - STAIR.s0 + 0.1, 0.1, 0.3), 0x262731, (STAIR.s0 + STAIR.s1) / 2, colTop, 0.15);

    // ---- the wing along Ülikooli: pairs of narrow windows, white shop windows, the pale set-back top floor
    const U = W.PU, eaves = 10.75;
    skin(U, (P) => {
      tiles(P, 0, P.y0, P.w, eaves, 7);
      P.r(0, eaves, P.w, P.y1, COL.pale);                                         // the top floor
      P.r(0, eaves, P.w, eaves + 0.14, '#3d3e4c'); P.r(0, P.y1 - 0.25, P.w, P.y1, '#f2f0f6');
      for (let x = 1.1; x + 2.6 < P.w; x += 3.3) P.win(x, eaves + 0.95, x + 2.4, eaves + 2.45, { frame: '#f4f2f8', glass: '#7f93c4', bars: 1, lit: on(), sill: 0 });
      for (let k = 0; k < 4; k++) {
        const x = 1.3 + k * 4.75;
        P.win(x, 0.95, x + 2.5, 3.05, { frame: '#f1eff4', glass: '#8498c8', bars: 1, fw: 0.1, lit: on(0.3), sill: 0.08, sc: '#b4b7c6' });
        for (const ya of [4.55, 7.85]) { tileWin(P, x + 0.1, ya, x + 0.95, ya + 1.7); tileWin(P, x + 1.5, ya, x + 2.35, ya + 1.7); }
      }
    }, { s1: BLOCK.s0 });
    skin(U, (P) => {
      tiles(P, 0, P.y0, P.w, P.y1, 8);
      for (const x of [0.9, 3.2]) { for (const ya of [4.55, 7.85, 11.3]) tileWin(P, x, ya, x + 0.95, ya + 1.7); tileWin(P, x - 0.1, 0.95, x + 1.05, 3.05); }
      P.r(0, P.y1 - 0.12, P.w, P.y1, '#3d3e4c');
    }, { s0: BLOCK.s0, y1: BLOCK.top - U.y });
    skin(W.PN, (P) => { tiles(P, 0, P.y0, P.w, P.y1, 9); for (const ya of [4.55, 7.85]) tileWin(P, 2.8, ya, 4.4, ya + 1.7, 1); });

    // ---- the podium in the entrance corner and its steps down to the plaza
    {
      const Q = PODIUM, top = Q.h, sm = (Q.s0 + Q.s1) / 2;
      put(C, BOX(Q.s1 - Q.s0, 1.6, Q.n1), COL.podium, sm, top - 0.8, Q.n1 / 2);
      put(C, BOX(Q.stair0 - Q.s0, 0.1, 0.3), COL.kerb, (Q.s0 + Q.stair0) / 2, top - 0.04, Q.n1 - 0.15);
      put(C, BOX(0.3, 0.1, Q.n1), COL.kerb, Q.s0 + 0.15, top - 0.04, Q.n1 / 2);
      for (let k = 1; k <= Q.steps; k++) {
        const y = top - (top / (Q.steps + 1)) * k;
        put(C, BOX(Q.s1 - Q.stair0, 1.6, Q.tread), k % 2 ? 0x9c9bb0 : COL.podium, (Q.stair0 + Q.s1) / 2, y - 0.8, Q.n1 + Q.tread * (k - 0.5));
      }
      // a steel handrail down the middle of the steps
      const sr = (Q.stair0 + Q.s1) / 2, n0 = Q.n1 - 0.3, n1 = Q.n1 + Q.tread * Q.steps + 0.1;
      for (const [n, y] of [[n0, top], [n1, 0.12]]) put(C, BOX(0.05, 0.9, 0.05), COL.steel, sr, y + 0.45, n);
      const rail = BOX(0.05, 0.05, Math.hypot(n1 - n0, top - 0.12)).rotateX(Math.atan2(top - 0.12, n1 - n0));
      put(C, rail, COL.steel, sr, (top + 0.12) / 2 + 0.9, (n0 + n1) / 2);
      const d = Q.n1 + Q.tread * Q.steps, [x, z] = C.at(sm, d / 2);
      solids.push({ x, z, yaw: C.yaw, hx: (Q.s1 - Q.s0) / 2, hz: d / 2 });
    }

    // ---- the poster stand on the plaza: a lit poster on both sides
    {
      const [x, z] = POSTER, y = h(x, z), ux = 0.69, uz = 0.72, yaw = Math.atan2(-uz, ux);
      p.box(0.5, 0.5, 0.3, 0x2a2b33, x, y + 0.25, z, yaw);
      p.box(1.4, 2.05, 0.2, 0x2a2b33, x, y + 1.5, z, yaw);
      const tex = facade(1.2, 0, 1.8, 120, (P) => {
        P.grad(0, 0, 1.2, 1.8, '#ff5fb0', '#7a2fd0');
        P.arc(0.6, 0.78, 0.5, '#ffd27a'); P.r(0, 0, 1.2, 0.62, '#2a1650');
        for (let k = 0; k < 5; k++) P.r(0, 0.62 - k * 0.11, 1.2, 0.66 - k * 0.11 - k * 0.012, '#ff7ac8');
        P.text('LINNARING', 0.6, 1.5, 0.19, '#fff6fb', 'italic 800 %px Arial, sans-serif');
        P.text('linnaring.com', 0.6, 0.12, 0.085, '#f4e9ff', '600 %px Arial, sans-serif');
      });
      for (const d of [-1, 1]) {
        const g = new THREE.PlaneGeometry(1.2, 1.8).rotateY(Math.atan2(-uz * d, ux * d)).translate(x - uz * d * 0.105, y + 1.52, z + ux * d * 0.105);
        extra.push([g, new THREE.MeshBasicMaterial({ map: tex })]);
      }
      solids.push({ x, z, yaw, hx: 0.7, hz: 0.12 });
    }

    // ================================================================ SEB
    // Dark brick in a square grid: the ground floor, a floor of loggias near the junction corner, four more
    // floors of big windows. `cols` are window widths along the wall, `corner` is the end at the junction (0 or 1).
    const FLOOR = 3.6;
    const seb = (w, seed, { pitch, wide, corner, ground = 'brick', arcade = 3 }) => (P) => {
      const up = W.SV.y - w.y;                                                   // floor lines are level round the building
      P.brick(0, P.y0, P.w, P.y1, COL.brick, seed);
      const n = Math.floor((P.w - 0.5) / pitch), x0 = (P.w - n * pitch) / 2;
      for (let k = 0; k < n; k++) {
        const ww = Array.isArray(wide) ? wide[k % wide.length] : wide, xa = x0 + k * pitch + (pitch - ww) / 2, xb = xa + ww;
        const fromCorner = corner === 0 ? k : corner === 1 ? n - 1 - k : 99;
        for (let f = 1; f <= 5; f++) {
          const ya = up + f * FLOOR + 0.55, yb = up + f * FLOOR + 3.0;
          P.r(xa - 0.16, ya - 0.1, xb + 0.16, yb + 0.22, '#16151c');             // the deep reveal
          if (f === 1 && fromCorner < arcade) {                                  // a loggia: dark, a glass rail
            P.grad(xa, ya, xb, yb, '#24232e', '#3a3948');
            P.r(xa, ya, xb, ya + 1.0, 'rgba(150,170,214,0.35)'); P.r(xa, ya + 0.98, xb, ya + 1.04, '#8f93a4');
          } else if (f === 5 && fromCorner < 1) {                                // the roof terrace at the corner
            P.grad(xa, ya, xb, yb, '#8f7fb4', '#5a5078');
            P.r(xa, ya, xb, ya + 1.05, 'rgba(170,190,230,0.5)'); P.r(xa, ya + 1.03, xb, ya + 1.09, '#aab0c4');
          } else {
            pane(P, xa, ya, xb, yb, { light: on(0.12) });
            if (ww > 2.4) P.r(xa + ww * 0.66, ya, xa + ww * 0.66 + 0.05, yb, '#16151c');
          }
        }
        // the ground floor
        const ya = Math.max(up + 0.05, gnd(w, (xa + xb) / 2, 0.6) + 0.05), yb = up + FLOOR - 0.3;
        if (yb - ya < 1.2) continue;
        if (fromCorner < arcade) {                                               // the open corner: glass set back, lights on
          P.r(xa - 0.3, ya, xb + 0.3, yb + 0.25, '#17161d');
          P.grad(xa - 0.1, ya, xb + 0.1, yb - 0.5, '#ffe9bb', '#d9b27c');
          for (let x = xa - 0.1; x < xb; x += 0.9) P.r(x, ya, x + 0.05, yb - 0.5, '#2a2933');
        } else if (ground === 'shops') {
          P.r(xa - 0.2, ya, xb + 0.2, yb + 0.1, '#16151c');
          pane(P, xa - 0.1, ya + 0.3, xb + 0.1, yb - 0.5, { top: [120, 136, 180], bottom: [70, 80, 116], light: on(0.45) });
          P.r((xa + xb) / 2 - 0.03, ya + 0.3, (xa + xb) / 2 + 0.03, yb - 0.5, '#16151c');
        } else if (k % 2 === 0 && yb - ya > 2.2) {
          P.r(xa - 0.1, ya + 1.0, xb + 0.1, yb + 0.1, '#16151c'); pane(P, xa, ya + 1.1, xb, yb, { top: [120, 136, 180], bottom: [70, 80, 116] });
        }
      }
      P.r(0, P.y1 - 0.18, P.w, P.y1, '#2c2a36');
    };
    const sebSkin = (w, seed, o) => skin(w, seb(w, seed, o), { ppm: 44, y0: -1.2 });
    sebSkin(W.SN, 11, { pitch: 3.44, wide: 2.6, corner: 0, ground: 'shops' });
    sebSkin(W.SV, 12, { pitch: 3.6, wide: [2.8, 2.0], corner: 1 });
    skin(W.SW, seb(W.SW, 13, { pitch: 3.6, wide: [2.0, 2.8], corner: 2 }), { ppm: 40, y0: 2.4 });
    // the name: white letters on the roof edge either side of the junction corner, small ones over the entrance
    const letters = (w, s, y, size, off = 0.2) => {
      const wm = size * 2.5, hm = size * 1.15;
      const tex = facade(wm, 0, hm, 140 / size, (P) => P.text('SEB', wm / 2, hm * 0.48, size * 1.1, '#ffffff', '800 %px Arial, Helvetica, sans-serif'));
      const [x, z] = w.at(s, off);
      extra.push([new THREE.PlaneGeometry(wm, hm).rotateY(Math.atan2(w.nx, w.nz)).translate(x, w.y + y, z), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide })]);
    };
    const roof = W.SN.top - W.SN.y;
    letters(W.SN, 3.3, roof + 0.55, 1.5); letters(W.SV, W.SV.len - 3.3, roof + 0.55, 1.5);
    letters(W.SN, 5.2, FLOOR + 0.12, 0.42, 0.16); letters(W.SV, W.SV.len - 5.4, FLOOR + 0.12, 0.42, 0.16);

    // ---- the white grid building next door on Ülikooli
    skin(W.LN, (P) => {
      P.r(0, P.y0, P.w, P.y1, tone(COL.white, 1));
      const pitch = 3.5, n = Math.floor(P.w / pitch), x0 = (P.w - n * pitch) / 2;
      for (let f = 0; f < 6; f++) {
        const ya = f * FLOOR + (f ? 0.5 : 0.1), yb = f * FLOOR + 3.05;
        for (let k = 0; k < n; k++) {
          const xa = x0 + k * pitch + 0.35, xb = xa + pitch - 0.7;
          P.r(xa - 0.06, ya - 0.06, xb + 0.06, yb + 0.06, '#c9c7d2');
          pane(P, xa, ya, xb, yb, { top: f ? [150, 168, 214] : [120, 136, 180], bottom: f ? [96, 110, 160] : [70, 80, 116], light: on(f ? 0.14 : 0.4) });
          P.r(xa + (xb - xa) * 0.5 - 0.03, ya, xa + (xb - xa) * 0.5 + 0.03, yb, '#e6e4ec');
        }
      }
      P.r(0, P.y1 - 0.3, P.w, P.y1, '#f4f2f8');
      P.r(0.6, 17.55, 9.4, 18.5, tone(COL.white, 1));
      P.text('LHV', 2.2, 18.02, 0.8, '#1c1c22', '800 %px Arial, sans-serif');
      P.text('Postimees', 6.3, 18.0, 0.62, '#2a66c8', '700 %px Georgia, serif');
    }, { ppm: 30 });

    // ================================================================ the stone wall up Vanemuise
    // The map has it as a low grey wall; here it gets its field stone face and its real height: it holds the
    // hillside, so it is as tall as the ground behind it, stepping down as the street climbs.
    {
      const tex = facade(8, 0, 2.4, 48, (P) => P.rubble(0, 0, 8, 2.4, 77));
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      const S = STONE, dx = S.b[0] - S.a[0], dz = S.b[1] - S.a[1], l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
      const nx = uz, nz = -ux;                                                    // towards the street
      const pos = [], uv = [], STEP = 4;
      const quad = (A, B, y0a, y0b, y1, u0, u1) => {
        const q = [[A, y0a, u0], [B, y0b, u1], [B, y1, u1], [A, y1, u0]];
        for (const j of [0, 2, 1, 0, 3, 2]) { const [pt, y, u] = q[j]; pos.push(pt[0], y, pt[1]); uv.push(u / 8, y / 2.4); }
      };
      let prevTop = null;
      for (let s = 0; s < S.len; s += STEP) {
        const s1 = Math.min(S.len, s + STEP), m = (s + s1) / 2;
        const at = (d, n) => [S.a[0] + ux * d + nx * n, S.a[1] + uz * d + nz * n];
        const A = at(s, 0.36), B = at(s1, 0.36), ya = h(...at(s, 1.2)), yb = h(...at(s1, 1.2));
        const behind = Math.max(h(...at(s, -5.5)), h(...at(s1, -5.5)), h(...at(m, -5.5)));     // past the strip kontserdimaja.js levels behind it
        const top = Math.max(Math.max(ya, yb) + 1.75, Math.min(behind + 0.5, Math.max(ya, yb) + 4.2));
        quad(A, B, ya - 0.5, yb - 0.5, top, s, s1);
        if (prevTop !== null && Math.abs(prevTop - top) > 0.02) {                 // the end of a step
          const A2 = at(s, -0.36);
          quad(prevTop > top ? A2 : A, prevTop > top ? A : A2, Math.min(prevTop, top), Math.min(prevTop, top), Math.max(prevTop, top), 0, 0.72);
        }
        const [cx, cz] = at(m, 0);
        p.box(s1 - s + 0.06, 0.12, 0.84, 0x9a9288, cx, top + 0.05, cz, Math.atan2(-uz, ux));
        p.box(s1 - s, 1.0, 0.7, 0x7d766f, cx, top - 0.5, cz, Math.atan2(-uz, ux));
        // the hillside from the back of the wall's top down to the ground 5.5 m behind it (the strip just behind
        // the wall is levelled with the street so that the pavement meets the wall square)
        {
          const P0 = at(s, -0.36), P1 = at(s1, -0.36), Q0 = at(s, -5.5), Q1 = at(s1, -5.5), g0 = h(...Q0), g1 = h(...Q1);
          const cap = new THREE.BufferGeometry();
          cap.setAttribute('position', new THREE.Float32BufferAttribute([P0[0], top, P0[1], Q0[0], g0, Q0[1], Q1[0], g1, Q1[1], P0[0], top, P0[1], Q1[0], g1, Q1[1], P1[0], top, P1[1]], 3));
          cap.computeVertexNormals();
          p.add(cap, 0x5b6447, 0, 0, 0);
        }
        prevTop = top;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      extra.push([g, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })]);
    }

    K.finish();
    for (const [g, m] of extra) { const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; group.add(mesh); }
    world.addSolids(solids);
  }

  return {
    update(x, z) {
      if (built || Math.hypot(x - CENTRE[0], z - CENTRE[1]) > 700) return;
      if ([[1575, 3138], [1600, 3110], [1545, 3150], [1500, 3205], [1470, 3232]].every(([cx, cz]) => world.ready(cx, cz))) build();
    },
  };
}
