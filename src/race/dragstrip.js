// The drag strip at Ülenurme (Martin 24 Nov 2026, behind ?drag=1 while it is tried out; the game's side of it is
// src/race/drag.js): a quarter mile marked out on the runway of Tartu Airport, as the yearly Speedest drag there
// is. The cars run west from the start line a little west of the taxiway from the apron, so the 700 m of runway
// beyond the finish are the shutdown area.
//
// What stands there (his photos in drag-strip-refs/, 26 Nov): the black start arch over both lanes, its faces left
// plain for adverts later (the Majoraadi gantry, src/race/arch.js); the christmas tree on the centre line just
// past the line, on its black tarp pyramid; black rubber laid down at the launch in both lanes; cones along the
// lanes' outer edges; the finish line with its boards and the win lights; on the north side a fence hung with
// banners, feather flags and two tents.
//
// All of it is built in one queued job once the car is near and the runway's ground is in, and it is light: one
// small picture for the banners and boards, one for the rubber, the lamps one instanced mesh.
import * as THREE from 'three';
import { RW } from '../world/lennujaam.js';
import { frame } from '../world/handbuilt.js';
import { Parts } from './landmarks.js';
import { buildArch } from './arch.js';
import { paintScale } from '../world/paintscale.js';
import { still } from '../still.js';
import { jobs } from '../jobs.js';

export const S_LINE = 1110;                 // the start line on the runway (m from its west threshold)
export const QUARTER = 402.336;             // the quarter mile (m)
export const EIGHTH = QUARTER / 2;
export const FT60 = 18.288, FT330 = 100.584, FT1000 = 304.8;
// d: down the strip from the start line, w: across it, + to the right of a car on the line (north)
export const D = frame(RW.at(S_LINE, 0), [-RW.U[0], -RW.U[1]]);
export const STRIP_YAW = Math.atan2(D.U[0], -D.U[1]);       // a car's heading down the strip
export const LANE_W = 5.5;                  // each lane's middle, either side of the runway's centre line
export const LANES = [LANE_W, -LANE_W];     // 0: the right lane (north), 1: the left
export const EDGE_W = 10.4;                 // the lanes' outer edges
const TREE_D = 3.2;                         // the christmas tree, just past the line on the centre line
const ARCH_D = -5;                          // the start arch, just behind the line
const FENCE_W = 24, FENCE_D0 = -45, FENCE_D1 = 215;
export const MID = D.at(QUARTER / 2, 0);    // the strip's middle on the map
const BUILD_R = 900, SHOW_R = 1600;

// ---- the pictures
// The strip level from side to side (Martin 27 Nov 2026: "is there a small tilt on the track? that would impact the
// start when wheelspin is happening"). The map's runway has a crown: each lane falls 1 to 2 % to its outer edge, which
// pulled a car with spinning wheels and nobody steering out of its lane in a quarter mile. Across the runway the ground
// is raised to the crown's top at that point (never lowered: the map's own ground stays under the runway's surface,
// which is draped on the raised one, lennujaam.js); eased back to the map's over the runway's last few metres and the
// strip's ends. Along the strip it keeps the map's gentle rise and fall (1.2 m up over the first 150 m, down to the
// finish), the same in both lanes. Added before the runway is built (createDragStrip runs at the start), so its
// surface, the strip's paint and the physics all stand on the same ground.
const LV_D0 = -70, LV_D1 = 600, LV_W = 12, LV_EDGE = 15.5, LV_END = 12, LV_STEP = 1;
function levelStrip(world) {
  if (!world.addBump || !world.rawHeightAt) return;
  const n = Math.ceil((LV_D1 - LV_D0) / LV_STEP) + 1, top = new Float32Array(n).fill(NaN);
  // (the crown's top across the runway at one row: read once, when the map's ground there is in)
  const rowTop = (i) => {
    if (top[i] === top[i]) return top[i];
    const d = LV_D0 + i * LV_STEP;
    let t = -Infinity;
    for (let w = -LV_W; w <= LV_W; w += 1) { const [x, z] = D.at(d, w); if (!world.ready(x, z)) return NaN; t = Math.max(t, world.rawHeightAt(x, z)); }
    return (top[i] = t);
  };
  const cs = [D.at(LV_D0, -LV_EDGE), D.at(LV_D0, LV_EDGE), D.at(LV_D1, -LV_EDGE), D.at(LV_D1, LV_EDGE)];
  world.addBump({
    x0: Math.min(...cs.map((c) => c[0])), x1: Math.max(...cs.map((c) => c[0])), z0: Math.min(...cs.map((c) => c[1])), z1: Math.max(...cs.map((c) => c[1])),
    at(x, z) {
      const [d, w] = D.sv(x, z), aw = Math.abs(w);
      if (d <= LV_D0 || d >= LV_D1 || aw >= LV_EDGE) return 0;
      const f = (d - LV_D0) / LV_STEP, i = Math.min(n - 2, Math.floor(f)), a = rowTop(i), b = rowTop(i + 1);
      if (a !== a || b !== b) return 0;
      const up = a + (b - a) * (f - i) - world.rawHeightAt(x, z);
      if (up <= 0) return 0;
      const e = Math.min(1, (LV_EDGE - aw) / (LV_EDGE - LV_W), (d - LV_D0) / LV_END, (LV_D1 - d) / LV_END);
      return up * e * e * (3 - 2 * e);
    },
  });
}

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// the banners on the fence, the boards and the feather flags: one atlas of cells, u/v from 0..1
const ATLAS = 512;
const BANNERS = [
  ['#111114', '#ffd23a', 'DRAG'], ['#f2f2ee', '#16161a', 'LINNARING'], ['#ff2bd6', '#ffffff', '1/4 MILE'], ['#16161a', '#2ff3ff', 'ÜLENURME'],
  ['#ffd23a', '#111114', '402 M'], ['#2a2c33', '#f2f2ee', 'LINNARING DRAG'], ['#f2f2ee', '#ff2bd6', 'SPEED'], ['#111114', '#f2f2ee', 'TARTU'],
];
// [x, y, w, h] in atlas pixels (before the scale)
const CELL = {
  banner: (i) => [(i % 2) * 256, Math.floor(i / 2) * 64, 256, 64],
  finish: [0, 256, 256, 64], eighth: [256, 256, 256, 64], tree: [0, 320, 128, 32],
  flag: (i) => [128 + i * 64, 320, 64, 192],
};
function atlas() {
  const k = paintScale(), c = canvas(Math.round(ATLAS * k), Math.round(ATLAS * k)), g = c.getContext('2d');
  g.scale(k, k);
  const text = (s, x, y, w, h, col, size, italic = true) => {
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
    let f = size;
    g.font = `${italic ? 'italic ' : ''}900 ${f}px Arial, sans-serif`;
    while (g.measureText(s).width > w * 0.86 && f > 8) { f -= 2; g.font = `${italic ? 'italic ' : ''}900 ${f}px Arial, sans-serif`; }
    g.fillText(s, x + w / 2, y + h / 2 + 1);
  };
  BANNERS.forEach(([bg, fg, s], i) => {
    const [x, y, w, h] = CELL.banner(i);
    g.fillStyle = bg; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, y + h - 5, w, 5);
    g.fillStyle = fg; g.fillRect(x + 6, y + 5, 3, h - 10); g.fillRect(x + w - 9, y + 5, 3, h - 10);
    text(s, x, y, w, h, fg, 40);
  });
  { const [x, y, w, h] = CELL.finish; g.fillStyle = '#111114'; g.fillRect(x, y, w, h); for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) { g.fillStyle = '#f2f2ee'; g.fillRect(x + i * 16, y + (j ? h - 10 : 0), 16, 10); } text('FINISH', x, y + 8, w, h - 16, '#f2f2ee', 34); }
  { const [x, y, w, h] = CELL.eighth; g.fillStyle = '#f2f2ee'; g.fillRect(x, y, w, h); g.strokeStyle = '#111114'; g.lineWidth = 4; g.strokeRect(x + 4, y + 4, w - 8, h - 8); text('1/8 MILE', x, y, w, h, '#111114', 34, false); }
  { const [x, y, w, h] = CELL.tree; g.fillStyle = '#111114'; g.fillRect(x, y, w, h); text('PRE STAGE · STAGE', x, y, w, h, '#f2f2ee', 14, false); }
  ['#ffd23a', '#ff2bd6', '#f2f2ee', '#2ff3ff', '#111114', '#ff6a1f'].forEach((bg, i) => {
    const [x, y, w, h] = CELL.flag(i);
    g.fillStyle = bg; g.fillRect(x, y, w, h);
    g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(-Math.PI / 2);
    text(i % 2 ? 'LINNARING' : 'DRAG', -h / 2, -w / 2, h, w, bg === '#111114' || bg === '#ff2bd6' ? '#ffffff' : '#111114', 30);
    g.restore();
  });
  return tex(c);
}
const uvOf = ([x, y, w, h]) => [x / ATLAS, 1 - (y + h) / ATLAS, (x + w) / ATLAS, 1 - y / ATLAS];

// the rubber laid down at the launch: across a lane (u) and down it from 16 m behind the line to 110 m past (v)
// (painted a few rows at a time in the work queue, each streak only over the pixels it darkens: done in one go it
// held the page for 160 ms, tools/freeze-profile.cjs route=airport q=drag=1, 27 Nov)
const RUB_D0 = -16, RUB_D1 = 110, RUB_W = 2.6;
function* rubber() {
  const k = paintScale(), W = Math.round(128 * k), H = Math.round(512 * k), c = canvas(W, H), g = c.getContext('2d');
  const img = g.createImageData(W, H), a = img.data;
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // a few dozen streaks, each a gaussian across with its own darkness and wander, the darkest on the wheels' lines
  const streaks = [];
  for (let i = 0; i < 46; i++) {
    const wheel = i < 20, side = i % 2 ? 1 : -1;
    const u0 = wheel ? 0.5 + side * (0.3 + (rnd() - 0.5) * 0.08) : 0.5 + (rnd() - 0.5) * 0.9;
    streaks.push({ u0, wid: wheel ? 0.035 + rnd() * 0.05 : 0.01 + rnd() * 0.03, dark: wheel ? 0.5 + rnd() * 0.4 : 0.15 + rnd() * 0.3, len: wheel ? 0.25 + rnd() * 0.75 : 0.15 + rnd() * 0.6, wav: (rnd() - 0.5) * 0.06, ph: rnd() * 6 });
  }
  const line = (RUB_D0 * -1) / (RUB_D1 - RUB_D0);      // the start line's place along the picture
  const burnAcross = new Float32Array(W), row = new Float32Array(W);
  for (let x = 0; x < W; x++) burnAcross[x] = Math.exp(-((((x + 0.5) / W - 0.5) / 0.32) ** 6));
  for (let y = 0; y < H; y++) {
    const t = 1 - y / H;                                // 0 behind the line ... 1 at the far end
    // the burnouts behind the line are black all over; past it the rubber thins out down the lane
    const burn = t < line ? 0.55 + 0.35 * (t / line) : 0;
    const fade = t < line ? 1 : Math.max(0, 1 - (t - line) / (1 - line)) ** 1.4;
    for (let x = 0; x < W; x++) row[x] = burn * burnAcross[x];
    for (const st of streaks) {
      if (t > line + st.len * (1 - line) || fade <= 0) continue;
      const mid = st.u0 + st.wav * Math.sin(t * 9 + st.ph), x0 = Math.max(0, Math.floor((mid - 3 * st.wid) * W)), x1 = Math.min(W - 1, Math.ceil((mid + 3 * st.wid) * W));
      for (let x = x0; x <= x1; x++) { const du = (x + 0.5) / W - mid; row[x] += st.dark * Math.exp(-((du / st.wid) ** 2)) * fade; }
    }
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      a[o] = 18; a[o + 1] = 16; a[o + 2] = 19; a[o + 3] = Math.min(235, row[x] * 255 * (0.85 + 0.15 * Math.sin(y * 1.4 + x * 0.3)));
    }
    if (jobs.late()) yield;
  }
  g.putImageData(img, 0, 0);
  return tex(c);
}
function checker() {
  const c = canvas(64, 8), g = c.getContext('2d');
  for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#111114' : '#ecece6'; g.fillRect(i * 4, j * 4, 4, 4); }
  const t = tex(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}

// ---- the lamps of the christmas tree and the finish's win lights: one instanced mesh, a colour each
// (per lane: two pre-stage bulbs, two stage bulbs, three ambers, green, red; then the two win lights)
const LAMP = { pre: [0, 1], stage: [2, 3], amber: [4, 5, 6], green: [7], red: [8] };
const PER_LANE = 9, WIN0 = PER_LANE * 2;
const ON = { pre: 0xfff3c4, stage: 0xfff3c4, amber: 0xffa51f, green: 0x3dff6a, red: 0xff2a2a, win: 0xffe14a };
const OFF = { pre: 0x3a372c, stage: 0x3a372c, amber: 0x3d2a10, green: 0x123a1c, red: 0x3a1212, win: 0x3a3418 };

export function createDragStrip({ world, scene, shadows = true }) {
  levelStrip(world);
  const group = still(new THREE.Group());
  group.visible = false;
  scene.add(group);
  const h = (x, z) => world.heightAt(x, z);
  let built = false, lamps = null;
  const lampState = new Array(WIN0 + 2).fill(false);
  const lampKind = [];
  for (let l = 0; l < 2; l++) for (const [k, ids] of Object.entries(LAMP)) for (const i of ids) lampKind[l * PER_LANE + i] = k;
  lampKind[WIN0] = lampKind[WIN0 + 1] = 'win';
  const col = new THREE.Color();

  // draped quads on the runway: d0..d1 down the strip, w0..w1 across, cut every `step` metres
  function drape(out, d0, d1, w0, w1, lift, step = 6, uv = null) {
    const n = Math.max(1, Math.ceil((d1 - d0) / step));
    const pt = (d, w) => { const [x, z] = D.at(d, w); return [x, h(x, z) + lift, z]; };
    for (let i = 0; i < n; i++) {
      const da = d0 + (d1 - d0) * i / n, db = d0 + (d1 - d0) * (i + 1) / n;
      const q = [[da, w0], [db, w0], [da, w1], [db, w1]];
      // (wound top up: d runs west, w north)
      for (const k of [0, 1, 2, 2, 1, 3]) { out.pos.push(...pt(q[k][0], q[k][1])); if (uv) out.uv.push(...uv(q[k][0], q[k][1])); }
    }
  }
  function flat(out, mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
    if (out.uv.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
    const nor = new Float32Array(out.pos.length); for (let k = 1; k < nor.length; k += 3) nor[k] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true;
    return m;
  }
  const decal = (o) => ({ polygonOffset: true, polygonOffsetFactor: o, polygonOffsetUnits: o });
  // an upright picture: centre (d, w), y0..y1 above the ground there, wide `len` across, facing the cars coming
  // (-d) or turned to face +w (side); cell: the atlas cell
  function board(out, d, w, len, y0, y1, cell, side = false) {
    const [u0, v0, u1, v1] = uvOf(cell);
    const [x, z] = D.at(d, w), g = h(x, z);
    const half = len / 2;
    // the board's own across: for a board facing the cars it runs along w (from the cars' left to right), for one
    // facing the lanes from the north side it runs along d
    // (u0 on the viewer's left: a car's right is +w, and from the lanes looking north the left is +d)
    const A = side ? (t) => D.at(d - t, w) : (t) => D.at(d, w + t);
    const [ax, az] = A(-half), [bx, bz] = A(half);
    const c = [[ax, g + y0, az, u0, v0], [bx, g + y0, bz, u1, v0], [ax, g + y1, az, u0, v1], [bx, g + y1, bz, u1, v1]];
    for (const k of [0, 1, 2, 2, 1, 3]) { out.pos.push(c[k][0], c[k][1], c[k][2]); out.uv.push(c[k][3], c[k][4]); }
  }

  function* build() {
    const ground = { pos: [], uv: [] }, white = { pos: [], uv: [] }, chk = { pos: [], uv: [] }, rub = { pos: [], uv: [] };
    // ---- on the runway: the rubber, the lines
    for (const lw of LANES) drape(rub, RUB_D0, RUB_D1, lw - RUB_W, lw + RUB_W, 0.075, 4, (d, w) => [(w - lw + RUB_W) / (2 * RUB_W), (d - RUB_D0) / (RUB_D1 - RUB_D0)]);
    for (const s of [-1, 1]) drape(white, -30, QUARTER + 40, s * EDGE_W - 0.15, s * EDGE_W + 0.15, 0.085, 10);
    for (const lw of LANES) {
      drape(white, -0.12, 0.12, lw - 4.4, lw + 4.4, 0.085, 1);                          // the start line
      for (const at of [FT60, FT330, EIGHTH, FT1000]) for (const s of [-1, 1]) drape(white, at - 0.1, at + 0.1, lw + s * 4.9 - 0.5, lw + s * 4.9 + 0.5, 0.085, 1);
    }
    drape(chk, QUARTER - 0.75, QUARTER + 0.75, -EDGE_W, EDGE_W, 0.085, 2, (d, w) => [(w + EDGE_W) / 1.5, (d - QUARTER + 0.75) / 1.5]);
    if (jobs.late()) yield;
    const rubTex = yield* rubber();
    const rubMat = new THREE.MeshLambertMaterial({ map: rubTex, transparent: true, depthWrite: false, ...decal(-5) });
    jobs.upload(rubTex);
    yield 'frame';
    const rm = flat(rub, rubMat); rm.renderOrder = 1; group.add(rm);
    group.add(flat(white, new THREE.MeshLambertMaterial({ color: 0xeaeae4, ...decal(-7) })));
    const ct = checker(); ct.wrapS = ct.wrapT = THREE.RepeatWrapping; ct.repeat.set(1, 1);
    group.add(flat(chk, new THREE.MeshLambertMaterial({ map: ct, ...decal(-8) })));
    yield;

    // ---- the solid things, merged: the tree's stand, the fence, the posts, the tents
    const p = new Parts(), boards = { pos: [], uv: [] };
    const at = (d, w) => { const [x, z] = D.at(d, w); return [x, h(x, z), z]; };
    const box = (d, w, ld, lw, y0, y1, c) => { const [x, g, z] = at(d, w); p.box(ld, y1 - y0, lw, c, x, g + (y0 + y1) / 2, z, D.YAW); };
    const solids = [];
    const solid = (d, w, hd, hw) => { const [x, z] = D.at(d, w); solids.push({ x, z, yaw: D.YAW, hx: hd, hz: hw }); };
    // the christmas tree: a black tarp pyramid, a post, the lamp housing (its lamps below)
    {
      const [x, g, z] = at(TREE_D, 0);
      p.add(new THREE.ConeGeometry(0.95, 1.25, 4, 1).rotateY(Math.PI / 4), 0x141417, x, g + 0.62, z, D.YAW);
      box(TREE_D, 0, 0.12, 0.12, 1.2, 1.5, 0x1b1c20);
      box(TREE_D, 0, 0.22, 0.66, 1.45, 3.35, 0x121215);
      box(TREE_D - 0.12, 0, 0.02, 0.6, 1.5, 3.3, 0x1e1f24);
      solid(TREE_D, 0, 0.6, 0.6);
      board(boards, TREE_D - 0.14, 0, 0.62, 3.36, 3.52, CELL.tree);
    }
    // the fence on the north side: panels on feet, a banner along each
    for (let d = FENCE_D0; d < FENCE_D1; d += 3.5) {
      const dm = d + 1.75;
      box(dm, FENCE_W, 3.45, 0.04, 1.95, 2.0, 0x9a9da3);
      box(dm, FENCE_W, 3.45, 0.04, 0.12, 0.17, 0x9a9da3);
      box(d + 0.04, FENCE_W, 0.05, 0.05, 0.1, 2.0, 0x9a9da3);
      box(d + 0.04, FENCE_W, 0.7, 0.24, 0, 0.12, 0x6b6e74);
      board(boards, dm, FENCE_W - 0.04, 3.4, 0.25, 1.15, CELL.banner(Math.floor((d - FENCE_D0) / 3.5) * 5 % BANNERS.length), true);
    }
    for (let d = FENCE_D0; d < FENCE_D1; d += 52) solid(Math.min(d + 26, (d + FENCE_D1) / 2), FENCE_W, Math.min(26, (FENCE_D1 - d) / 2), 0.15);
    if (jobs.late()) yield;
    // feather flags behind the fence, a tent or two by the start
    const flags = { pos: [], uv: [] };
    let fi = 0;
    for (let d = -38; d < 200; d += 23, fi++) {
      const w = FENCE_W + 2.5, [x, g, z] = at(d, w);
      p.add(new THREE.CylinderGeometry(0.025, 0.035, 4.6, 6), 0x2a2b30, x, g + 2.3, z);
      // the flag: a tall sheet from the pole's top down, bent a little in the wind
      const [u0, v0, u1, v1] = uvOf(CELL.flag(fi % 6));
      const P = (dd, y, u, v) => { const [px, pz] = D.at(d + dd, w + 0.12 * Math.sin(dd * 2.4)); return [px, g + y, pz, u, v]; };
      const c = [P(0, 1.2, u1, v0), P(0.85, 1.6, u0, v0), P(0, 4.5, u1, v1), P(0.85, 4.25, u0, v1)];
      for (const k of [0, 1, 2, 2, 1, 3]) { flags.pos.push(c[k][0], c[k][1], c[k][2]); flags.uv.push(c[k][3], c[k][4]); }
    }
    for (const [d, w, c] of [[-28, 34, 0xf2f2ee], [-14, 35, 0x2a2c33], [6, 34, 0xf2f2ee]]) {
      const [x, g, z] = at(d, w);
      for (const [a, b] of [[-1.45, -1.45], [1.45, -1.45], [-1.45, 1.45], [1.45, 1.45]]) box(d + a, w + b, 0.06, 0.06, 0, 2.2, 0x8d9096);
      p.add(new THREE.ConeGeometry(2.15, 1.1, 4, 1, true).rotateY(Math.PI / 4), c, x, g + 2.75, z, D.YAW);
      box(d, w + 1.48, 2.9, 0.03, 1.5, 2.2, c);
      solid(d, w, 1.5, 1.5);
    }
    // the finish: a post either side with its board, the win light on top; the eighth mile's boards
    for (const s of [-1, 1]) {
      const w = s * 12.2;
      box(QUARTER, w, 0.14, 0.14, 0, 4.2, 0x1b1c20);
      board(boards, QUARTER - 0.08, w, 2.6, 3.0, 3.65, CELL.finish);
      box(QUARTER + 0.05, w, 0.12, 0.5, 3.75, 4.25, 0x141417);
      solid(QUARTER, w, 0.15, 0.15);
      box(EIGHTH, w, 0.1, 0.1, 0, 2.2, 0x6b6e74);
      board(boards, EIGHTH - 0.06, w, 1.7, 1.6, 2.02, CELL.eighth);
      solid(EIGHTH, w, 0.1, 0.1);
    }
    const parts = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    if (parts) { parts.castShadow = shadows; parts.receiveShadow = true; group.add(parts); }
    world.addSolids(solids);
    yield 'frame';
    const atl = atlas();
    const bm = new THREE.MeshLambertMaterial({ map: atl, side: THREE.DoubleSide });
    const bmesh = new THREE.Mesh(new THREE.BufferGeometry(), bm);
    bmesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(boards.pos.concat(flags.pos), 3));
    bmesh.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(boards.uv.concat(flags.uv), 2));
    bmesh.geometry.computeVertexNormals();
    group.add(bmesh);
    jobs.upload(atl);
    yield;

    // ---- the cones along the lanes' outer edges: two instanced meshes, the orange and the white band
    const cones = [];
    for (let d = -24; d <= QUARTER + 30; d += d < 120 ? 15 : 40) for (const s of [-1, 1]) cones.push([d, s * (EDGE_W + 0.6)]);
    for (const lw of LANES) for (const s of [-1, 1]) cones.push([0.6, lw + s * 4.6]);
    const coneO = new THREE.InstancedMesh(new THREE.ConeGeometry(0.15, 0.52, 10, 1), new THREE.MeshLambertMaterial({ color: 0xff5a14 }), cones.length);
    const coneW = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.093, 0.12, 0.11, 10, 1, true), new THREE.MeshLambertMaterial({ color: 0xf4f4f0 }), cones.length);
    const m4 = new THREE.Matrix4();
    cones.forEach(([d, w], i) => {
      const [x, g, z] = at(d, w);
      coneO.setMatrixAt(i, m4.makeTranslation(x, g + 0.26, z));
      coneW.setMatrixAt(i, m4.makeTranslation(x, g + 0.3, z));
    });
    group.add(coneO, coneW);

    // ---- the lamps: the tree's, facing the cars on the line, and the finish's win lights
    const lampGeo = new THREE.CircleGeometry(1, 14);
    lamps = new THREE.InstancedMesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), WIN0 + 2);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(D.U[0], D.U[1]));
    const sc = new THREE.Vector3(), pos = new THREE.Vector3();
    const put = (i, d, w, y, r) => { const [x, g, z] = at(d, w); pos.set(x, g + y, z); sc.set(r, r, r); lamps.setMatrixAt(i, m4.compose(pos, q, sc)); };
    for (let l = 0; l < 2; l++) {
      // (each lane's lamps on its own side of the tree, as the drivers see it: the right lane's on the right)
      const w = LANES[l] > 0 ? 0.16 : -0.16, d = TREE_D - 0.135, o = l * PER_LANE;
      put(o + 0, d, w - 0.07, 3.22, 0.045); put(o + 1, d, w + 0.07, 3.22, 0.045);
      put(o + 2, d, w - 0.07, 3.08, 0.045); put(o + 3, d, w + 0.07, 3.08, 0.045);
      put(o + 4, d, w, 2.83, 0.085); put(o + 5, d, w, 2.6, 0.085); put(o + 6, d, w, 2.37, 0.085);
      put(o + 7, d, w, 2.08, 0.1); put(o + 8, d, w, 1.78, 0.085);
      put(WIN0 + l, QUARTER - 0.05, LANES[l] > 0 ? 12.2 : -12.2, 4.0, 0.2);
    }
    for (let i = 0; i < WIN0 + 2; i++) lamps.setColorAt(i, col.setHex(OFF[lampKind[i]]));
    group.add(lamps);
    yield 'frame';

    // ---- the start arch over both lanes, plain black
    const [ax, az] = D.at(ARCH_D, 0);
    buildArch({ group, world, x: ax, z: az, tx: D.U[0], tz: D.U[1], half: 12.4, clear: 5.6 });
    built = true;
  }

  let wanted = false;
  return {
    group, frame: D,
    get built() { return built; },
    // the lamps of a lane: {pre, stage, amber: [3], green, red}, and the win light (null leaves a lamp as it is)
    tree(lane, st) {
      if (!lamps) return;
      const o = lane * PER_LANE;
      const set = (i, on) => { if (on == null || lampState[i] === on) return; lampState[i] = on; lamps.setColorAt(i, col.setHex((on ? ON : OFF)[lampKind[i]])); lamps.instanceColor.needsUpdate = true; };
      set(o + 0, st.pre); set(o + 1, st.pre); set(o + 2, st.stage); set(o + 3, st.stage);
      if (st.amber) for (let k = 0; k < 3; k++) set(o + 4 + k, st.amber[k]);
      set(o + 7, st.green); set(o + 8, st.red);
      if ('win' in st) set(WIN0 + lane, st.win);
    },
    update(car, look = null) {
      if (!car) return;
      const c = look || car;
      const dm = Math.hypot(c.x - MID[0], c.z - MID[1]);
      group.visible = built && dm < SHOW_R;
      if (built || wanted || dm > BUILD_R) return;
      // (the runway's ground under the whole strip first)
      for (const d of [-40, 0, 100, 200, 300, QUARTER + 30]) { const [x, z] = D.at(d, 0); if (!world.ready(x, z)) return; }
      wanted = true;
      jobs.add(build, 'drag strip');
    },
  };
}
