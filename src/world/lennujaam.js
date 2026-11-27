// Kaardista "Tartu Airport at Ülenurme" (Martin, 22 Nov), batch 1: the airport, from his Street View shots of
// June 2023 and the Land Board's oblique air photos (May 2023, April 2024).
//  - the runway 08/26 (1800 x 31 m, all of it in the map since the 23 Nov extension): grey asphalt with
//    the white edge lines, the centre line, the threshold bars, the 08 and the 26, the touchdown and aiming marks at both
//    ends, edge lights every 60 m, the green threshold lights, the PAPI boxes, a windsock. The ground under it
//    was already smooth (bumps under 4 cm), so nothing there changes for the car: it is a place for fast runs;
//  - the terminal (Lennu 44): the dark glass hall with LENNUJAAM on its roof, the entrance canopy with the
//    blue airport sign, the grey ribbed office wing with two rows of windows, the blue control tower with its
//    glazed cab, railing and masts, the white and blue annex to the west, TARTU on the airside;
//  - the car park before it: bays, the flags (Estonia, the EU, Tartu), the red and white lattice mast,
//    blue and white bollards, chains on dark posts, the bus shelter with its pink back wall, the TARTUMAA board;
//  - the blue hangars west of it (the big one with its door to the apron, the L-shaped hall, the garage row),
//    the white arched hangar, and the rows of sun panels beyond them.
// No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours, addHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { jobs } from '../jobs.js';

const DEBUG = typeof location !== 'undefined' && /ljdebug/.test(location.search);
const S0 = ['0_17', -800, 10080], S1 = ['1_17', -160, 10080];
const SANS = '700 %px Arial, sans-serif';

// [name, sector, base, at, reach, wall, roof]
const HOUSES = [
  ['term', S1, 2985, [-100, 10698], 56, 0xc9ccd0, 0x55575c],
  ['termw', S1, 3005, [-153, 10707], 9, 0xe6e8ea, 0x5d5f63],
  ['vest', S1, 3305, [-118, 10682], 7, 0x262c33, 0x6b6e73],
  ['vest', S1, 3342, [-133, 10691], 6, 0x262c33, 0x6b6e73],
  ['hangar', S0, 3045, [-255, 10706], 40, 0x3d78c6, 0x50535a],
  ['lhall', S0, 2981, [-233, 10669], 32, 0x3d78c6, 0x6b5e52],
  ['garage', S0, 2994, [-237, 10626], 26, 0x8fa6c2, 0x5d5f63],
];

export function lennujaamWalls(walls) {
  for (const S of [S0, S1]) {
    setHouseColours(walls, S[0], S[1], S[2], HOUSES.filter((H) => H[1] === S).map(([, , base, at, reach, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach })));
  }
  // the two white arched hangars: the map's blocks of them are jagged, built again by hand
  addHouseColours(walls, S0[0], S0[1], S0[2], [{ base: 2605, x: -349, z: 10674, hide: true, reach: 26 }, { base: 3017, x: -402, z: 10624, hide: true, reach: 18 }]);
}

// ---------------------------------------------------------------- the painters (W: one wall, x = 0 at its start)
// the terminal is one block of the map: the hall, the wing and the tower share walls, so each column of a
// wall is painted after what stands there
const at = (W, x) => [W.a[0] + W.ux * x, W.a[1] + W.uz * x];
const GL = 27.9;                       // the map block's ground under the terminal; its heights are read from there
function term(P, W) {
  const len = W.len, north = W.nz < -0.7, south = W.nz > 0.7, east = W.nx > 0.7;
  const off = W.yref - GL, L = (y) => y - off;      // L(y): the painter's height of y metres above the block's ground
  const part = (x) => {
    const [wx, wz] = at(W, x), t = W.topAt(x) + off;
    if (wx > -68 && wx < -54 && t > 15) return 'tower';
    if (wx > -129.5 && wx < -103.5 && wz < 10714 && t > 10.3) return 'hall';
    if (wx < -129.5) return 'annex';
    if (wz > 10712.5) return 'canopy';
    return 'wing';
  };
  // the runs of one kind along the wall
  const runs = [];
  for (let x = 0; x < len; x += 0.25) { const k = part(Math.min(len - 0.01, x + 0.12)); if (runs.length && runs[runs.length - 1].k === k) runs[runs.length - 1].x1 = Math.min(len, x + 0.25); else runs.push({ k, x0: x, x1: Math.min(len, x + 0.25) }); }
  const foot = W.foot + off;
  for (const { k, x0, x1 } of runs) {
    const t = Math.max(...[x0 + 0.1, (x0 + x1) / 2, x1 - 0.1].map(W.topAt));
    if (k === 'wing') {
      P.r(x0, P.y0, x1, t, '#c6cace');
      for (let x = x0 + 0.3; x < x1; x += 0.6) P.r(x, P.y0, x + 0.06, t, '#b2b7bd');
      P.r(x0, t - 0.45, x1, t, '#9ea3aa'); P.r(x0, P.y0, x1, L(0.55), '#8d9095');
      if (x1 - x0 > 3) for (const [y0, y1] of [[1.1, 2.6], [4.3, 5.8]]) {
        for (let x = x0 + 1.0; x + 1.7 < x1 - 0.6; x += 3.1) P.win(x, L(y0), x + 1.7, L(y1), { frame: '#eef0f1', glass: '#47566a', fw: 0.08, bars: 1, sill: 0.06, sc: '#9ea3aa' });
      }
    } else if (k === 'tower') {
      if (foot > 17) {                                                 // the cab: glass all round under a white top
        P.r(x0, P.y0, x1, t, '#eef0f1');
        P.grad(x0, L(19.9), x1, t - 1.0, '#6a7f93', '#26303a');
        for (let x = x0 + 0.05; x < x1; x += 1.25) P.r(x, L(19.9), x + 0.09, t - 1.0, '#eef0f1');
        continue;
      }
      P.r(x0, P.y0, x1, t, '#2f63b5');
      for (let y = 3; y < 18.5; y += 3) P.r(x0, L(y), x1, L(y) + 0.05, '#2a579f');
      const xm = (x0 + x1) / 2;
      if (x1 - x0 > 2) for (let y = 10.2; y < 17; y += 3) P.win(xm - 0.6, L(y), xm + 0.6, L(y + 1.3), { frame: '#eef0f1', glass: '#3e4d5e', fw: 0.07, bars: 0, sill: 0.05 });
      P.r(x0, Math.min(t, L(19.7)) - 0.9, x1, Math.min(t, L(19.7)), '#eef0f1');
    } else if (k === 'hall') {
      if (south) {                                                    // the airside: black, TARTU high up
        P.r(x0, P.y0, x1, t, '#1d2025'); P.r(x0, t - 0.5, x1, t, '#3a3f47');
        if (x1 - x0 > 12) P.text('TARTU', (x0 + x1) / 2, t - 2.1, 1.7, '#f2f4f6', '900 italic %px Arial, sans-serif');
      } else if (east) {
        P.r(x0, P.y0, x1, t, '#2f5ea8'); for (let x = x0 + 0.5; x < x1; x += 1.0) P.r(x, P.y0, x + 0.05, t, '#2a5597');
        P.r(x0, t - 0.5, x1, t, '#3a3f47');
      } else {                                                         // the glass front and its west side
        P.grad(x0, P.y0, x1, t, '#4a5866', '#161b21');
        for (let x = x0 + 1.4; x < x1; x += 3.0) P.grad(x, 0.4, x + 1.2, t - 0.6, 'rgba(150,170,190,0.18)', 'rgba(150,170,190,0)');
        for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / Math.max(1, Math.round((x1 - x0) / 3.0))) P.r(x - 0.07, P.y0, x + 0.07, t, '#8f98a2');
        for (const y of [3.6, 6.9, 9.9]) P.r(x0, L(y) - 0.06, x1, L(y) + 0.06, '#8f98a2');
        P.r(x0, t - 0.55, x1, t, '#a9b0b8');
      }
    } else if (k === 'annex') {
      P.r(x0, P.y0, x1, t, '#e6e8ea');
      P.r(x0, P.y0, x1, Math.min(t, L(2.4)), '#3a6db8');
      P.r(x0, t - 0.4, x1, t, '#b9bec4');
      if (x1 - x0 > 3) for (let x = x0 + 0.9; x + 1.4 < x1 - 0.5; x += 2.8) P.win(x, L(3.0), x + 1.4, L(4.3), { frame: '#f4f5f6', glass: '#4b5a6c', fw: 0.07, bars: 1, sill: 0.05 });
      if (north && x1 - x0 > 8) { P.r(x1 - 4, P.y0, x1 - 2.4, L(2.2), '#26303b'); P.r(x1 - 3.9, P.y0, x1 - 2.5, L(2.1), '#5a6b7e'); }
    } else {                                                           // the low box under the airside canopy
      P.r(x0, P.y0, x1, t, '#e8eaec'); P.r(x0, t - 0.6, x1, t, '#c9cdd2');
      if (x1 - x0 > 6) { P.r(x0 + 1, P.y0, x1 - 1, L(2.6), '#2a2f36'); for (let x = x0 + 1; x < x1 - 1; x += 1.5) P.r(x + 0.05, P.y0, x + 1.4, L(2.5), '#56677a'); }
    }
  }
}
function vest(P, W) {
  const len = W.len, top = W.peak;
  P.grad(0, P.y0, len, top, '#56677a', '#1f252c');
  for (let x = 0; x <= len + 0.01; x += len / Math.max(1, Math.round(len / 1.5))) P.r(x - 0.05, P.y0, x + 0.05, top, '#8f98a2');
  P.r(0, top - 0.4, len, top, '#d9dcdf');
  if (len > 4) { const d = len / 2; P.r(d - 1.2, 0, d + 1.2, 2.5, '#2a2f36'); P.r(d - 1.1, 0.05, d - 0.03, 2.45, '#6d8297'); P.r(d + 0.03, 0.05, d + 1.1, 2.45, '#6d8297'); }
}
function hangar(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, top, '#3d78c6');
  for (let x = 0.25; x < len; x += 0.5) P.r(x, P.y0, x + 0.05, top, '#356cb6');
  P.r(0, P.y0, len, 0.5, '#7e8288');
  if (W.nz > 0.7 && len > 25) {                                       // the door to the apron
    const d0 = len * 0.14, d1 = len * 0.86, dh = Math.min(top - 2.2, 10.5);
    P.r(d0 - 0.3, 0, d1 + 0.3, dh + 0.4, '#2c5ea3');
    P.r(d0, 0, d1, dh, '#c8ccd2');
    for (let x = d0 + (d1 - d0) / 6; x < d1 - 0.1; x += (d1 - d0) / 6) P.r(x - 0.06, 0, x + 0.06, dh, '#9aa0a8');
    for (let y = 1.2; y < dh; y += 1.2) P.r(d0, y - 0.03, d1, y + 0.03, '#b2b7be');
    P.r(len * 0.92, 0, len * 0.92 + 1.0, 2.1, '#2b3a52');
  } else if (Math.abs(W.nx) > 0.7 && len > 30) {                      // the long sides: two window strips, a door
    for (const y of [3.4, 7.6]) if (y + 1 < top) for (let x = 1.5; x + 2.5 < len - 1; x += 3.4) P.r(x, y, x + 2.5, y + 0.9, '#28374d');
    P.r(len * 0.3, 0, len * 0.3 + 1.0, 2.1, '#2b3a52');
  }
}
function lhall(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, top, '#3d78c6');
  for (let x = 0.25; x < len; x += 0.5) P.r(x, P.y0, x + 0.05, top, '#356cb6');
  P.r(0, top - 0.4, len, top, '#2f5f9f'); P.r(0, P.y0, len, 0.5, '#7e8288');
  if (len < 6) return;
  for (let x = 2; x + 3.5 < len - 1; x += 9) { P.r(x, 0, x + 3.5, Math.min(4.2, top - 1.5), '#e6e8eb'); for (let y = 0.5; y < Math.min(4.2, top - 1.5); y += 0.5) P.r(x, y, x + 3.5, y + 0.04, '#c4c8ce'); }
  if (top > 6.5) for (let x = 6.5; x + 2 < len - 1; x += 9) P.r(x, top - 2.6, x + 2, top - 1.6, '#28374d');
}
function garage(P, W) {
  const len = W.len, top = W.peak;
  P.r(0, P.y0, len, top, '#93a9c4'); P.r(0, top - 0.35, len, top, '#7f93ad'); P.r(0, P.y0, len, 0.4, '#7e8288');
  if (W.nz > 0.7 && len > 20) for (let k = 0; k < 6; k++) { const x = len * (k + 0.5) / 6 - 1.6; P.r(x, 0, x + 3.2, 3.4, '#284f8f'); for (let y = 0.4; y < 3.4; y += 0.4) P.r(x, y, x + 3.2, y + 0.03, '#234680'); P.r(x + 3.6, 2.2, x + 4.4, 3.0, '#3a4a5e'); }
  else if (len > 6) for (let x = 2; x + 1.2 < len - 1; x += 4) P.r(x, 2.2, x + 1.2, 3.0, '#3a4a5e');
}
const PAINT = { term, termw: term, vest, hangar, lhall, garage };

// ---------------------------------------------------------------- the runway
// s along the runway from the west threshold to the east, v across it (+ = south)
export const RW = frame([-1231.9, 11083.2], [558.3 + 1231.9, 10962.2 - 11083.2]);
export const RL = 1794.3, RH = 15.5;
const S_IN = 0;                       // (196 while the map's edge crossed the runway, before 23 Nov)
// draped strips: quads s0..s1 x v0..v1 cut every ds and dv metres, onto the ground
function strip(out, s0, s1, v0, v1, ds, dv, lift, h, uv = null) {
  const V0 = typeof v0 === 'function' ? v0 : () => v0, V1 = typeof v1 === 'function' ? v1 : () => v1;      // (either side may follow s)
  const n = Math.max(1, Math.ceil((s1 - s0) / ds)), m = Math.max(1, Math.ceil(Math.max(Math.abs(V1(s0) - V0(s0)), Math.abs(V1(s1) - V0(s1))) / dv));
  const pt = (s, v) => { const [x, z] = RW.at(s, v); return [x, h(x, z) + lift, z]; };
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const sa = s0 + (s1 - s0) * i / n, sb = s0 + (s1 - s0) * (i + 1) / n;
    const v = (S, f) => V0(S) + (V1(S) - V0(S)) * f;
    const q = [[sa, v(sa, j / m)], [sb, v(sb, j / m)], [sa, v(sa, (j + 1) / m)], [sb, v(sb, (j + 1) / m)]];
    for (const k of [0, 2, 1, 1, 2, 3]) { out.pos.push(...pt(q[k][0], q[k][1])); if (uv) out.uv.push(...uv(q[k][0], q[k][1])); }
  }
}
function mesh(out, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  if (out.uv.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  const nor = new Float32Array(out.pos.length); for (let k = 1; k < nor.length; k += 3) nor[k] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true;
  return m;
}
// the two figures of a runway end, 9 m tall, each squeezed into its own half (a bold Arial figure is as wide
// as it is tall here, and two of them did not fit the 9.2 m: the outer sides were cut off)
function runwayFigures(P, str) {
  const c = P.c, k = P.ppm;
  c.fillStyle = '#e9e9e4'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `700 ${Math.round(12.2 * k)}px "Arial Narrow", Arial, sans-serif`;
  for (let i = 0; i < 2; i++) {
    const w = c.measureText(str[i]).width, sx = Math.min(1, (3.9 * k) / w);
    c.save(); c.translate((i ? 6.9 : 2.3) * k, 4.75 * k); c.scale(sx, 1); c.fillText(str[i], 0, 0); c.restore();
  }
}
let RTEX = null;
function runwayTex() {
  if (RTEX) return RTEX;
  // a 16 m square of runway asphalt, tiled: light grey, fine grain, a few long seams and darker patches
  const t = paintTexture(16, 0, 16, 16, (P) => {
    P.r(0, 0, 16, 16, '#7d7c80');
    const c = P.c, W = c.canvas.width;
    let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < W * W * 0.12; k++) { const v = 0.86 + r() * 0.28; c.fillStyle = `rgb(${125 * v | 0},${124 * v | 0},${128 * v | 0})`; c.fillRect(r() * W, r() * W, 1 + r(), 1 + r()); }
    for (let k = 0; k < 6; k++) { c.fillStyle = `rgba(60,60,64,${0.06 + r() * 0.06})`; c.fillRect(r() * W, 0, 1 + r() * W * 0.08, W); }
    c.fillStyle = 'rgba(70,70,74,0.25)'; c.fillRect(W * 0.5 - 1, 0, 2, W);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (RTEX = t);
}

// ---------------------------------------------------------------- the frames on the ground
const CENTRE = [-160, 10700];
// the car park before the terminal
const LOT = frame([-165, 10630], [1, 0]);             // s east, v south

export const LENNUJAAM_CARS = [
  [-117.6, 10651.5, Math.PI / 2, 'rav4', 'white'], [-117.6, 10654.1, Math.PI / 2, 'passat', 'white'], [-117.6, 10659.3, Math.PI / 2, 'mazda6', 'red'],
  [-117.6, 10661.9, Math.PI / 2, 'passat', 'black'], [-142.8, 10653.0, -Math.PI / 2, 'ceedsw', 'grey'], [-136.9, 10645.2, Math.PI / 2, 'rav4', 'black'],
  [-159.8, 10645.8, -Math.PI / 2, 'passat', 'grey'], [-159.8, 10651.0, -Math.PI / 2, 'rav4', 'black'], [-159.8, 10658.8, -Math.PI / 2, 'bz4x', 'white'],
  [-140.6, 10612.0, Math.PI / 2, 'passat', 'black'], [-140.6, 10625.0, Math.PI / 2, 'mazda6', 'white'], [-160.5, 10618.0, -Math.PI / 2, 'ceedsw', 'sage'],
].map(([x, z, yaw, id, paint]) => [x, z, yaw, id, paint, 0]);

export function createLennujaam(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  const h = (x, z) => world.heightAt(x, z);
  // the windsock's pole and the runway lights' masts are not to be driven through
  { const [x, z] = RW.at(RL - 350, -75); world.addSolids([{ x, z, yaw: 0, hx: 0.15, hz: 0.15 }]); }
  const done = { term: false, east: false, west: false };

  // ---- the runway, in two halves, each when its ground is in
  function* runway(sa, sb, tag) {
    const surf = { pos: [], uv: [] }, white = { pos: [], uv: [] }, nums = { pos: [], uv: [] }, nums08 = { pos: [], uv: [] };
    // (the 4 m cut along it follows the 2 m ground closely enough: the ground there bends by 2 cm at most)
    for (let s = sa; s < sb; s += 100) { strip(surf, s, Math.min(sb, s + 100), -RH, RH, 4, RH / 3, 0.05, h, (S, V) => [V / 16, S / 16]); if (jobs.late()) yield; }
    if (sb >= RL) {                                                    // the turning bay on the north side of the east end, and the end strip
      strip(surf, RL - 85, RL + 8, -38, -RH, 4, 4.5, 0.05, h, (S, V) => [V / 16, S / 16]);
      strip(surf, RL - 110, RL - 85, (S) => -RH - (S - RL + 110) / 25 * 22.5, -RH, 2.5, 4.5, 0.05, h, (S, V) => [V / 16, S / 16]);
      strip(surf, RL, RL + 8, -RH, RH, 4, RH / 3, 0.05, h, (S, V) => [V / 16, S / 16]);
    }
    const W = (s0, s1, v0, v1) => { const a = Math.max(s0, sa), b = Math.min(s1, sb); if (b > a) strip(white, a, b, v0, v1, 6, 50, 0.07, h); };
    // the edge lines
    W(sa, sb, -RH, -RH + 0.9); W(sa, sb, RH - 0.9, RH);
    // the centre line: 30 m stripes, 20 m gaps, from past the numbers at one end to the numbers at the other
    for (let s = 62; s + 30 < RL - 62; s += 50) W(s, s + 30, -0.45, 0.45);
    // both ends: the threshold bars, aiming points and touchdown marks
    for (const [dir, s0] of [[1, 0], [-1, RL]]) {
      const S = (d0, d1) => (dir > 0 ? [s0 + d0, s0 + d1] : [s0 - d1, s0 - d0]);
      for (const v of [2.7, 6.3, 9.9, 13.5]) for (const k of [-1, 1]) W(...S(1.5, 31.5), k * v - 0.9, k * v + 0.9);
      for (const k of [-1, 1]) W(...S(300, 345), k > 0 ? 5.5 : -10.5, k > 0 ? 10.5 : -5.5);
      for (const [d, w] of [[150, 3.6], [450, 3.6], [600, 1.8]]) for (const k of [-1, 1]) W(...S(d, d + 25), k > 0 ? 6 : -6 - w, k > 0 ? 6 + w : -6);
    }
    if (jobs.late()) yield;
    // the 26 at the east end, the foot of the figures to the threshold
    if (sb > RL - 60) {
      const s1 = RL - 36.5, s0 = RL - 46.5;
      const corners = [[s0, -4.6, 0, 1], [s1, -4.6, 0, 0], [s0, 4.6, 1, 1], [s1, 4.6, 1, 0]];
      const pt = ([s, v]) => { const [x, z] = RW.at(s, v); return [x, h(x, z) + 0.075, z]; };
      for (const k of [0, 2, 1, 1, 2, 3]) { nums.pos.push(...pt(corners[k])); nums.uv.push(1 - corners[k][2], corners[k][3]); }
    }
    // the 08 at the west end, read by a plane landing eastward: its foot to the west threshold
    if (sa < 60) {
      const s0 = 36.5, s1 = 46.5;
      const corners = [[s0, -4.6, 0, 1], [s1, -4.6, 0, 0], [s0, 4.6, 1, 1], [s1, 4.6, 1, 0]];
      const pt = ([s, v]) => { const [x, z] = RW.at(s, v); return [x, h(x, z) + 0.075, z]; };
      for (const k of [0, 2, 1, 1, 2, 3]) { nums08.pos.push(...pt(corners[k])); nums08.uv.push(corners[k][2], corners[k][3]); }
    }
    const asphalt = new THREE.MeshLambertMaterial({ map: runwayTex(), polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    group.add(mesh(surf, asphalt));
    yield;
    group.add(mesh(white, new THREE.MeshLambertMaterial({ color: 0xe9e9e4, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })));
    if (nums.pos.length) {
      const tex = paintTexture(9.2, 0, 9.5, 14, (P) => runwayFigures(P, '26'), { alpha: true });
      group.add(mesh(nums, new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })));
    }
    if (nums08.pos.length) {
      const tex = paintTexture(9.2, 0, 9.5, 14, (P) => runwayFigures(P, '08'), { alpha: true });
      group.add(mesh(nums08, new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })));
    }
    yield;
    // lights: white edge lights every 60 m, green ones across the east threshold, the PAPI at both aiming points
    const A = areaKit(world, group, { shadows });
    const { p } = A;
    const mast = new THREE.CylinderGeometry(0.05, 0.07, 0.32, 6), cap = new THREE.CylinderGeometry(0.09, 0.09, 0.12, 6);
    const light = (s, v, c) => { const [x, z] = RW.at(s, v), y = h(x, z); p.add(mast, 0xd9d9d4, x, y + 0.16, z); p.add(cap, c, x, y + 0.38, z); };
    for (let s = RL; s > sa; s -= 60) if (s < sb) for (const v of [-RH - 0.8, RH + 0.8]) light(s, v, 0xfff2c2);
    if (sb >= RL) for (let v = -RH + 0.5; v <= RH; v += 3) light(RL + 0.8, v, 0x37c25a);
    const papi = (x, z) => { const y = h(x, z); p.box(0.9, 0.45, 0.6, 0x3a3c40, x, y + 0.45, z, RW.YAW); p.box(0.92, 0.2, 0.62, 0xf2f2ee, x, y + 0.55, z, RW.YAW); p.box(0.2, 0.3, 0.2, 0xc8c8c4, x, y + 0.15, z); };
    if (tag === 'east') for (const z of [11011, 11020, 11030, 11039]) papi(280, z);
    else for (const z of [11002, 11011, 11020, 11028]) papi(-884, z);
    if (tag === 'east') {                                              // the windsock north of the runway
      const [x, z] = RW.at(RL - 350, -75), y = h(x, z);
      p.add(new THREE.CylinderGeometry(0.06, 0.09, 6, 8), 0xe9e9e4, x, y + 3, z);
      for (let k = 0; k < 5; k++) p.add(new THREE.CylinderGeometry(0.42 - k * 0.05, 0.37 - k * 0.05, 0.75, 10, 1, true).rotateZ(Math.PI / 2 - 0.12), k % 2 ? 0xf3f3f0 : 0xff6a1f, x + 0.45 + k * 0.74, y + 5.85 - k * 0.09, z);
    }
    A.finish();
    if (DEBUG) console.log('runway', tag, surf.pos.length / 9, 'tris');
  }

  // ---- the terminal, the car park, the hangars
  function* terminal() {
    const houses = HOUSES.map(([name, S, base, at0, r]) => ({ name, sec: S[0], base, at: at0, r, spec: { wall: [200, 200, 200], floors: [], attic: null, eaves: false }, walls: [{ near: [0, 0], within: 1e9, only: (P, W) => PAINT[name](P, W) }] }));
    skinHouses(world, group, houses, { shadows, ppm: 12, far: 5, faces: (W) => W.len > 6 && W.ylo - W.yref < 2, debug: DEBUG, label: 'lennujaam fronts' });
    yield;
    const A = areaKit(world, group, { shadows });
    const { p } = A;
    const g0 = h(-116, 10684);
    const white = 0xeef0f1;

    // LENNUJAAM on the hall's roof, silver letters standing at its front edge
    { const tex = paintTexture(21, 0, 2.4, 22, (P) => { P.text('LENNUJAAM', 10.5, 1.2, 2.9, '#5d646c', '700 %px Arial, sans-serif'); P.text('LENNUJAAM', 10.45, 1.25, 2.9, '#dfe3e7', '700 %px Arial, sans-serif'); }, { alpha: true });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(21, 2.4), new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
      m.position.set(-116, GL + 12.05 + 1.2, 10687.6); m.rotation.y = Math.PI; group.add(m);
      for (const x of [-124, -116, -108]) p.box(0.08, 0.6, 0.08, 0x8f98a2, x, GL + 12.2, 10687.7); }
    // the entrance canopy before the glass, its slanted struts at the east end, the blue sign on its fascia
    p.box(14.0, 0.55, 8.6, white, -118.2, g0 + 3.65, 10681.6);
    p.box(5.8, 3.3, 7.6, 0x2a3440, -118.35, g0 + 1.65, 10681.0);                               // the glass porch
    for (const x of [-121.2, -118.35, -115.5]) p.box(0.1, 3.3, 0.1, 0x9aa3ad, x, g0 + 1.65, 10677.15);
    p.box(2.2, 2.3, 0.05, 0x6d8297, -118.35, g0 + 1.15, 10677.15);
    p.box(13.6, 0.05, 8.2, 0xb9bec4, -118.2, g0 + 3.36, 10681.6);
    for (const z of [10678.2, 10684.6]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.1, 0.22), new THREE.MeshLambertMaterial({ color: white })); m.position.set(-110.6, g0 + 1.8, z); m.rotation.z = 0.32; m.castShadow = shadows; group.add(m); }
    { const tex = paintTexture(1.2, 0, 1.2, 60, (P) => { P.arc(0.6, 0.6, 0.6, '#ffffff'); P.arc(0.6, 0.6, 0.55, '#2b8be0'); P.poly([[0.6, 1.0], [0.67, 0.68], [0.95, 0.52], [0.95, 0.46], [0.66, 0.54], [0.64, 0.3], [0.74, 0.22], [0.74, 0.18], [0.6, 0.22], [0.46, 0.18], [0.46, 0.22], [0.56, 0.3], [0.54, 0.54], [0.25, 0.46], [0.25, 0.52], [0.53, 0.68]], '#ffffff'); }, { alpha: true });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5 }));
      m.position.set(-115.5, g0 + 3.7, 10677.25); m.rotation.y = Math.PI; group.add(m); }
    yield;
    // the tower: the balcony rail round the cab, the white roof edge, masts and dishes on top
    { const ty = GL, y = ty + 19.75;
      for (const [a, b] of [[[-67.6, 10692.5], [-54.6, 10692.5]], [[-54.6, 10692.5], [-54.6, 10705.6]], [[-54.6, 10705.6], [-67.6, 10705.6]], [[-67.6, 10705.6], [-67.6, 10692.5]]]) {
        A.bar(a, b, 0.05, 19.75 + 0.95, 19.75 + 1.0, white, ty); A.bar(a, b, 0.05, 19.75 + 0.45, 19.75 + 0.5, white, ty);
        A.walk([a, b], 1.3, ([x, z]) => p.box(0.05, 1.0, 0.05, white, x, y + 0.5, z));
      }
      for (const [x, z, hh] of [[-63, 10701, 5], [-59, 10697, 3.5], [-61, 10703, 2.5]]) p.add(new THREE.CylinderGeometry(0.05, 0.07, hh, 6), 0xd9dde2, x, ty + 25.2 + hh / 2, z);
      p.add(new THREE.SphereGeometry(0.45, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2), 0xf2f2f0, -57.6, ty + 25.6, 10701);
      p.add(new THREE.CylinderGeometry(0.35, 0.35, 0.3, 10), 0xd92d2d, -61, ty + 25.35, 10699); }
    yield;

    // ---- the car park: bays, the island, bollards and chains, flags, the lattice mast, the bus shelter, the board
    const line = (x0, z0, x1, z1) => A.bar([x0, z0], [x1, z1], 0.12, 0.03, 0.045, 0xeeeeea);
    for (let z = 10649.6; z < 10668; z += 2.6) line(-122, z, -116.2, z);                   // east of the island
    for (let z = 10638.5; z < 10668; z += 2.6) line(-145.5, z, -140.2, z);                 // west of the dashed line
    for (let z = 10641.5; z < 10656; z += 2.6) line(-139.6, z, -134.2, z);
    for (let z = 10641.0; z < 10666; z += 2.6) line(-162.6, z, -157.2, z);                 // by the west lawn
    for (let z = 10603.5; z < 10632; z += 2.6) { line(-163.2, z, -157.8, z); line(-143.0, z, -137.6, z); }   // the north lot
    A.bar([-122.3, 10638], [-122.3, 10668], 0.25, 0, 0.15, 0xc9c6cc);                      // the island with its posts and chains
    A.walk([[-122.3, 10638], [-122.3, 10668]], 3, ([x, z]) => { p.box(0.12, 0.8, 0.12, 0x3a3c42, x, h(x, z) + 0.4, z); p.box(0.13, 0.08, 0.13, 0xd92d2d, x, h(x, z) + 0.76, z); });
    A.bar([-122.3, 10638], [-122.3, 10668], 0.025, 0.55, 0.58, 0x2b2c30);
    // the accessible bays before the canopy, blue
    A.pave(LOT, 34.0, 39.5, 41.5, 47.0, { map: paintTexture(1, 0, 1, 16, (P) => { P.r(0, 0, 1, 1, '#2f7fd2'); P.r(0.42, 0, 0.5, 1, '#e8eef4'); }), tile: 5.5 }, 0.06);
    // blue and white bollards on their feet along the path by the annex, and two at the canopy
    for (const [x, z] of [[-133.5, 10671.5], [-129.5, 10671.5], [-110.0, 10676.5], [-106.0, 10676.5]]) {
      const y = h(x, z);
      p.add(new THREE.CylinderGeometry(0.32, 0.38, 0.22, 10), 0xb8b8b4, x, y + 0.11, z);
      for (let k = 0; k < 4; k++) p.add(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 8), k % 2 ? 0xf2f2f0 : 0x2f5fb8, x, y + 0.32 + k * 0.2, z);
    }
    // the three flags at the west end of the car park: Estonia, the EU, Tartu
    const pole = new THREE.CylinderGeometry(0.05, 0.08, 10, 6);
    [[-150.0, 10669.5, ['#0072ce', '#000000', '#ffffff']], [-146.5, 10669.5, ['eu']], [-143.0, 10669.5, ['#ffffff', '#d52b1e']]].forEach(([x, z, cols], k) => {
      const y = h(x, z);
      p.add(pole, 0xeceeef, x, y + 5, z);
      const tex = paintTexture(1.5, 0, 1.0, 40, (P) => {
        if (cols[0] === 'eu') { P.r(0, 0, 1.5, 1, '#003399'); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; P.text('★', 0.75 + Math.cos(a) * 0.33, 0.5 + Math.sin(a) * 0.33, 0.12, '#ffcc00'); } }
        else cols.forEach((c, i) => P.r(0, 1 - (i + 1) / cols.length, 1.5, 1 - i / cols.length, c));
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
      m.position.set(x, y + 9.2, z + 0.8); m.rotation.set(0, Math.PI / 2 + 0.25 * (k - 1), 0.04); group.add(m);
    });
    // the red and white lattice mast behind them
    { const x = -153.5, z = 10716.0, y = h(x, z);
      for (let k = 0; k < 6; k++) {
        const c = k % 2 ? 0xf2f2f0 : 0xd8322d, w = 0.75 - k * 0.07, yy = y + k * 3;
        for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) p.box(0.06, 3, 0.06, c, x + dx * w / 2, yy + 1.5, z + dz * w / 2);
        for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) {
          const mx = x + (a[0] + b[0]) * w / 4, mz = z + (a[1] + b[1]) * w / 4, yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
          const m = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(w, 3), 0.04, 0.04), new THREE.MeshLambertMaterial({ color: c }));
          m.position.set(mx, yy + 1.5, mz); m.rotation.set(0, yaw, Math.atan2(3, w), 'YZX'); group.add(m);
        }
      }
      p.add(new THREE.CylinderGeometry(0.04, 0.04, 3, 6), 0xd8322d, x, y + 19.5, z); }
    yield;
    // the bus shelter at the car park's east edge: blue frame and roof, the pink back wall, a bench
    { const sx = -92.2, sz = 10638.0, y = h(sx, sz), F = frame([sx, sz], [0, 1]);
      A.box(F, 0, 0, 5.6, 2.0, 2.45, 2.6, 0x2f6fc8, y);
      for (const [ds, dv] of [[-2.75, -0.95], [2.75, -0.95], [-2.75, 0.95], [2.75, 0.95]]) A.box(F, ds, dv, 0.1, 0.1, 0, 2.45, 0x2f6fc8, y);
      A.box(F, 0, 0.92, 5.4, 0.06, 0.1, 2.3, 0xe4877e, y);
      A.box(F, 0, 0.55, 2.8, 0.4, 0.42, 0.48, 0x7a5230, y);
      p.add(new THREE.CylinderGeometry(0.22, 0.2, 0.8, 10), 0x2d5a3c, sx - 1.2, y + 0.4, sz - 3.6); }
    // the TARTUMAA board among the spruces, on two posts
    { const x = -100.5, z = 10646.5, y = h(x, z);
      const tex = paintTexture(2.4, 0, 1.6, 40, (P) => {
        P.r(0, 0, 2.4, 1.6, '#f2f1ec'); P.r(0, 1.35, 2.4, 1.6, '#2f6fc8'); P.text('TARTUMAA', 0.5, 1.47, 0.16, '#ffffff', SANS);
        for (const [x0, y0, x1, y1, c] of [[0.1, 0.1, 1.3, 1.25, '#cfe2b6'], [1.4, 0.75, 2.3, 1.25, '#b9c6d6'], [1.4, 0.1, 2.3, 0.65, '#e5c9a7']]) P.r(x0, y0, x1, y1, c);
        P.line(0.15, 0.4, 1.2, 1.0, '#d9a23c', 0.03); P.line(0.4, 0.15, 0.9, 1.2, '#7aa0c6', 0.04);
      });
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 0.08), [0, 0, 0, 0, 1, 0].map((k) => (k ? new THREE.MeshLambertMaterial({ map: tex }) : new THREE.MeshLambertMaterial({ color: 0xd9d9d6 }))));
      m.position.set(x, y + 1.0 + 0.8, z); m.rotation.y = -Math.PI / 2 + 0.3; group.add(m);
      for (const d of [-1, 1]) p.box(0.08, 1.9, 0.08, 0x9a9da4, x + Math.cos(0.3) * d * 1.0, y + 0.95, z - Math.sin(0.3) * d * 1.0); }
    // tall lamp posts in the car park
    for (const [x, z, d] of [[-122.3, 10641, [1, 0]], [-122.3, 10662, [1, 0]], [-149, 10640, [1, 0]], [-149, 10662, [1, 0]], [-150, 10618, [1, 0]]]) A.lamp(x, z, d, 9.5, 0.8);
    yield;

    // ---- the two white arched hangars (ribbed shells, light blue ends, a dark door to the apron side)
    { const rib = paintTexture(4, 0, 4, 16, (P) => { P.r(0, 0, 4, 4, '#e9ecef'); for (let x = 0; x < 4; x += 1.0) { P.r(x, 0, x + 0.18, 4, '#c3c9d0'); P.r(x + 0.18, 0, x + 0.3, 4, '#f7f8f9'); } });
      rib.wrapS = rib.wrapT = THREE.RepeatWrapping;
      const shell = new THREE.MeshLambertMaterial({ map: rib, side: THREE.DoubleSide }), end = new THREE.MeshLambertMaterial({ color: 0xa9c0df, side: THREE.DoubleSide });
      for (const [cx, cz, len, span, tall, yaw, door] of [[-344.5, 10673.5, 35, 25, 11.5, 0, 1], [-402.5, 10623, 30, 13.5, 7.2, Math.PI / 2, -1]]) {
        const y = Math.min(h(cx - 10, cz), h(cx + 10, cz), h(cx, cz - 8), h(cx, cz + 8)) - 0.2, r = span / 2;
        const g = new THREE.CylinderGeometry(r, r, len, 18, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, tall / r, 1);
        const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * r / 4, uv.getY(i) * len / 4);
        const m = new THREE.Mesh(g, shell); m.position.set(cx, y, cz); m.rotation.y = yaw; m.castShadow = shadows; m.receiveShadow = true; group.add(m);
        for (const e of [-1, 1]) {
          const c = new THREE.Mesh(new THREE.CircleGeometry(r, 18, 0, Math.PI).scale(1, tall / r, 1).rotateY(Math.PI / 2), end);
          const ex = Math.cos(yaw) * e * len / 2, ez = -Math.sin(yaw) * e * len / 2;
          c.position.set(cx + ex, y, cz + ez); c.rotation.y = yaw; group.add(c);
          if (e === door) { const d = new THREE.Mesh(new THREE.PlaneGeometry(span * 0.4, tall * 0.62), new THREE.MeshLambertMaterial({ color: 0x2b3036 })); d.position.set(cx + ex * 1.003, y + tall * 0.31, cz + ez * 1.003); d.rotation.y = yaw + e * Math.PI / 2; group.add(d); }
        }
      }
    }
    // the rows of sun panels west and north-west of the hangars, on their legs
    { const panel = new THREE.MeshLambertMaterial({ color: 0x232a48 });
      for (const [x0, x1, zs] of [[-485, -430, [10615, 10631, 10647, 10663, 10678]], [-383, -300, [10592, 10606, 10620, 10634]]]) for (const z0 of zs) {
        const y = h((x0 + x1) / 2, z0);
        const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.06, 3.8), panel);
        m.position.set((x0 + x1) / 2, y + 1.55, z0); m.rotation.x = 0.55; m.castShadow = shadows; m.receiveShadow = true; group.add(m);
        for (let x = x0 + 1.5; x < x1; x += 6) { p.box(0.08, 1.9, 0.08, 0x9a9da4, x, y + 0.95, z0 + 1.2); p.box(0.08, 1.0, 0.08, 0x9a9da4, x, y + 0.5, z0 - 1.2); }
      }
    }
    A.finish();
  }

  return {
    update(car) {
      if (!car) return;
      const [s, v] = RW.sv(car.x, car.z);
      const dRun = Math.hypot(Math.max(0, S_IN - s, s - RL), Math.max(0, Math.abs(v) - RH));
      if (!done.term && Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) < 650 && [[-100, 10698], [-255, 10706], [-349, 10674], [-460, 10640]].every((q) => world.ready(q[0], q[1]))) { done.term = true; jobs.add(terminal, 'lennujaam'); }
      if (dRun > 900) return;
      const pts = (a, b) => [a, (a + b) / 2, b].map((q) => RW.at(q, 0));
      if (!done.east && pts(1000, RL).every((q) => world.ready(q[0], q[1]))) { done.east = true; jobs.add(function* () { yield* runway(1000, RL, 'east'); }, 'runway east'); }
      if (!done.west && pts(S_IN, 1000).every((q) => world.ready(q[0], q[1]))) { done.west = true; jobs.add(function* () { yield* runway(S_IN, 1000, 'west'); }, 'runway west'); }
    },
  };
}
