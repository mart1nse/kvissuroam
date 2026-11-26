// An advert for winbaum.ee, a maker of modular houses (Martin, 26 Nov: for a possible advertiser): their Winbaum L
// cabin on the Kaubamaja plaza just to the left of the LAP START billboard as one comes from the start, with
// WINBAUM.EE on its roof in a cyan to purple gradient. Only with ?winbaum=1 for now.
//   - after their photo, floor plan and their own render of it in the game, drawn 1.4 times its real size
//     (Martin: "I know the scale is off, but let's try"): 9.0 x 3.3 m, black-stained timber boards all round,
//     a deep frame round the glazed front whose flared reveals are lined with slats, seven tall panes with the
//     sliding door, a flat roof with the stove's chimney, a wooden deck along the front with a step, a lounger
//     and two deck lights, a service box and pipes on the right end, lavender and a gnarled olive tree on a gravel bed
//   - lit like their render: uplights wash the slatted reveals, the warm light from inside spills onto the
//     sill, the deck and the soffit, the deck lights throw pools (all painted light, no lamps for the shader)
//   - inside, seen through the glass: a low upholstered bed under a glowing shelf with bedside lamps, sheer
//     curtains, a round black wood stove with its fire and logs, a boucle lounge chair, a stone coffee table on a
//     rug, a plant, the oak kitchen with a stone top and lit open shelves, the oak dining table with four chairs
//     under a cluster of glass globes, downlights in the slatted ceiling; shaded once when built (a warm light
//     from above), so it reads as lit rooms and not as flat paint
//   - the sign on the roof: a black panel with a gradient frame, the W/M mark and the name, readable from both
//     sides (Martin picked draft 1 with draft 3's sign)
// Light on purpose: seven drawn pieces, three small pictures (the timber boards 256 px, the garden's lavender and
// olive leaves 512 x 256, the sign 1024 x 200: about 2 MB with their mipmaps, the sign less on phones), built in
// steps of the work queue within 900 m of the car, hidden beyond 500 m.
// Nothing on the racing line: the deck's edge is 5 m from the kerb of the start/finish straight and the lavender
// in front of it 4 m, and the Kaubamaja plaza benches, a litter bin at the deck's step and the young lime of the
// straight's row on the lot make room (kaubamaja.js, trackside.js and the props' clear list in main.js ask
// winbaumLot), only while the advert is shown.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Parts } from '../race/landmarks.js';
import { paintScale } from './paintscale.js';
import { loadFont, FONT } from './hologram.js';
import { jobs } from '../jobs.js';
import { still } from '../still.js';

const FLAG = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('winbaum') : null;
export const WINBAUM = !!FLAG && FLAG !== '0';

// the Kaubamaja frame (kaubamaja.js): a along Küüni from the roof's west corner (towards the board, south-east),
// b along the park face (away from the start/finish straight, north-east). The LAP START board stands at
// a = -11, b = -2.7, 12 m wide along a; the straight's kerb runs at about b = -8.
const O = [1659.6, 3088.7], UA = [0.6943, 0.7197], UB = [0.7189, -0.6951];
const at = (a, b) => [O[0] + UA[0] * a + UB[0] * b, O[1] + UA[1] * a + UB[1] * b];
const S = 1.4;                                        // the cabin is drawn 1.4 times its size
const PLACE = { a: -26.0, b: 4.0 };                   // its middle: clear of the board's left end, set back from the kerb
const YAW = Math.atan2(-UB[0], -UB[1]);               // the glazed front looks back down Uueturu, at the start

// the cabin in its own frame, in metres of the real cabin: x along the front (to the right as one looks at it),
// z out of the glazed front, y up from the gravel bed
const X0 = -4.5, X1 = 4.5, ZB = -1.65, ZF = 1.65, ZG = 1.05;     // ends, back, the frame's front edge, the glass
const Y0 = 0.42, YG = 2.62, YT = 3.3;                            // floor, top of the glass, roof top
const GX0 = -4.05, GX1 = 4.05;                                   // the glazing
const OX0 = -4.25, OX1 = 4.25, OY = 2.95;                        // the frame's opening at its front edge (the reveals flare out)
const WY0 = 0.1, WY1 = YT - 0.05;                                // the boards run from the plinth to the roof's flashing
const DECK = 2.3, DECK_R = 0.8, DY = 0.3;                        // the deck: depth, how far it runs past the right end, top
const PANES = 7;
const OLIVE = [X1 + DECK_R + 0.75, ZF + 1.0], OC = [OLIVE[0] + 0.05, 1.8, OLIVE[1] - 0.05], ORX = 0.95, ORY = 0.62;   // the olive: foot, crown
const SPOT = (() => { const [x, z] = at(PLACE.a, PLACE.b); return { x, z, yaw: YAW, c: Math.cos(YAW), s: Math.sin(YAW) }; })();
// a point of the cabin's frame in the world, and back
const toWorld = (lx, lz) => [SPOT.x + S * (SPOT.c * lx + SPOT.s * lz), SPOT.z + S * (-SPOT.s * lx + SPOT.c * lz)];
const toLocal = (x, z) => { const dx = (x - SPOT.x) / S, dz = (z - SPOT.z) / S; return [SPOT.c * dx - SPOT.s * dz, SPOT.s * dx + SPOT.c * dz]; };
const LOT = { x0: X0 - 0.7, x1: X1 + DECK_R + 1.7, z0: ZB - 0.5, z1: ZF + DECK + 0.6 };   // with the plants

// Is (x, z) on the cabin's lot, within `margin` metres of it, or up to `front` metres in front of it? For the
// benches and trees that make room, only while the advert is shown.
export function winbaumLot(x, z, margin = 0, front = 0) {
  if (!WINBAUM) return false;
  const [lx, lz] = toLocal(x, z), m = margin / S;
  return lx > LOT.x0 - m && lx < LOT.x1 + m && lz > LOT.z0 - m && lz < LOT.z1 + front / S + m;
}
// ids ("sx_sz:n") of the map's props on the lot or just in front of the deck (a litter bin stood at its step),
// only while the advert is shown
export function winbaumClear(data) {
  const out = new Set();
  if (!WINBAUM) return out;
  for (const [key, a] of Object.entries(data.sectors)) {
    for (let k = 0; k < a.length; k += data.stride) if (winbaumLot(a[k + 1], a[k + 2], 0.5, 2)) out.add(`${key}:${k / data.stride}`);
  }
  return out;
}

const rng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

// ---- pictures
// Black-stained timber boards: eight 9 cm boards across 0.72 m with dark gaps, each board its own tone, the grain
// running along it and wandering a little (made pixel by pixel, tiles both ways).
const BOARD_M = 0.72;
function boardsTex() {
  const W = 256, N = 8, P = W / N, d = new Uint8Array(W * W * 4), r = rng(11);
  const tone = Array.from({ length: N }, () => 0.84 + r() * 0.34);
  const phase = Array.from({ length: N }, () => r() * 6.283);
  const streak = Float32Array.from({ length: W }, () => (r() - 0.5) * 0.3 + (r() < 0.07 ? -0.22 : 0));
  const knot = Array.from({ length: N }, () => (r() < 0.5 ? [r() * W, 4 + r() * 6] : null));
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const k = (x / P) | 0, u = x - k * P;
    let v;
    if (u < 3) v = 0.22;                         // the gap between boards
    else if (u < 5) v = 0.62;                    // the board's edge in its shade
    else if (u > P - 3) v = 1.14;                // its other edge catching the light
    else {
      const w = Math.sin((y / W) * 6.283 * 2 + phase[k]) * 1.8;
      v = 1 + streak[(k * P + Math.min(P - 4, Math.max(5, Math.round(u + w)))) % W] + (r() - 0.5) * 0.07;
      const kn = knot[k];
      if (kn) { const dy = Math.min(Math.abs(y - kn[0]), W - Math.abs(y - kn[0])), dd = Math.hypot((u - P / 2) * 1.4, dy) / kn[1]; if (dd < 1) v *= 0.7 + 0.3 * dd; }
    }
    v *= tone[k];
    const i = (y * W + x) * 4;
    d[i] = Math.min(255, 60 * v); d[i + 1] = Math.min(255, 55 * v); d[i + 2] = Math.min(255, 51 * v); d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, W, W, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}
// The garden's picture, one atlas for both plants (512 x 256). Left: a lavender bush on a see-through card,
// silver-green blades at the foot, a dome of thin stems, each with a spike of little violet flowers tapering to its
// tip. Right: an olive spray, thin grey twigs from the middle outwards with pairs of narrow pointed leaves, dull
// grey-green above and silver beneath, so the crown reads airy and silvery like the tree in their render.
function gardenTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d'), r = rng(5);
  g.lineCap = 'round';
  g.save(); g.beginPath(); g.rect(3, 3, 250, 253); g.clip();
  for (let i = 0; i < 96; i++) {
    const a = (r() - 0.5) * 2.4, L = 36 + r() * 48, x0 = 128 + (r() - 0.5) * 50, y0 = 254;
    const x1 = x0 + Math.sin(a) * L, y1 = y0 - Math.cos(a) * L * 0.8;
    g.strokeStyle = `hsl(${92 + r() * 30},${12 + r() * 12}%,${36 + r() * 24}%)`; g.lineWidth = 1.8 + r() * 1.6;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * 10, (y0 + y1) / 2, x1, y1); g.stroke();
  }
  for (let i = 0; i < 132; i++) {
    const a = (r() - 0.5) * 1.95, L = (140 + r() * 90) * (0.78 + 0.22 * Math.cos(a)), x0 = 128 + (r() - 0.5) * 40, y0 = 250;
    const x1 = x0 + Math.sin(a) * L, y1 = Math.max(6, y0 - Math.cos(a) * L), cx = (x0 + x1) / 2 + Math.sin(a) * 14, cy = (y0 + y1) / 2 + 8;
    g.strokeStyle = `hsl(${78 + r() * 22},${16 + r() * 10}%,${38 + r() * 14}%)`; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke();
    const n = 9 + ((r() * 6) | 0);
    for (let j = 0; j < n; j++) {
      const t = 0.7 + (0.3 * j) / n, u = 1 - t;
      const px = u * u * x0 + 2 * u * t * cx + t * t * x1, py = u * u * y0 + 2 * u * t * cy + t * t * y1;
      const s = 3.3 * (1 - (0.45 * j) / n), side = (j % 2 ? 1 : -1) * 1.2;
      g.fillStyle = `hsl(${258 + r() * 22},${34 + r() * 26}%,${36 + r() * 26 + (j / n) * 8}%)`;
      g.beginPath(); g.ellipse(px + side, py, s * 0.72, s, a, 0, 6.283); g.fill();
    }
  }
  g.restore();
  // the olive spray
  g.save(); g.beginPath(); g.rect(260, 4, 248, 248); g.clip();
  const leaf = (x, y, ang, L, w, top) => {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = top ? `hsl(${84 + r() * 16},${20 + r() * 12}%,${27 + r() * 12}%)` : `hsl(${76 + r() * 18},${12 + r() * 9}%,${60 + r() * 14}%)`;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * 0.45, w, L, 0); g.quadraticCurveTo(L * 0.45, -w, 0, 0); g.fill();
    g.restore();
  };
  for (let i = 0; i < 22; i++) {
    const a = i * 2.39996 + r() * 0.6, L = 66 + r() * 52, x0 = 384 + (r() - 0.5) * 34, y0 = 128 + (r() - 0.5) * 34, bend = (r() - 0.5) * 34;
    const x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L;
    const cx = (x0 + x1) / 2 - Math.sin(a) * bend, cy = (y0 + y1) / 2 + Math.cos(a) * bend;
    g.strokeStyle = `hsl(30,7%,${28 + r() * 12}%)`; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke();
    const n = Math.floor(L / 8.5);
    for (let j = 1; j <= n; j++) {
      const t = j / n, u = 1 - t;
      const px = u * u * x0 + 2 * u * t * cx + t * t * x1, py = u * u * y0 + 2 * u * t * cy + t * t * y1;
      const da = Math.atan2(2 * u * (cy - y0) + 2 * t * (y1 - cy), 2 * u * (cx - x0) + 2 * t * (x1 - cx));
      for (const side of [1, -1]) leaf(px, py, da + side * (0.45 + r() * 0.4), 16 + r() * 10, 2.5 + r() * 1.3, r() < 0.6);
    }
    leaf(x1, y1, a + (r() - 0.5) * 0.3, 15, 2.4, r() < 0.5);
  }
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// the sign: a black panel like the cabin's boards, a thin gradient frame, the W over M mark in a white rounded
// square (drawn after their render), the name in a cyan to purple gradient over a gradient bar
const CYAN = '#2ff3ff', MID = '#7d8bff', PURPLE = '#b44dff';
function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function signTex(sw, sh) {
  const U = 1024, UH = Math.round((U * sh) / sw), k = Math.max(0.5, paintScale());
  const c = document.createElement('canvas');
  c.width = Math.round(U * k); c.height = Math.round(UH * k);
  const g = c.getContext('2d');
  g.scale(k, k);
  const font = (w, px) => `${w} ${px}px ${FONT}, "Montserrat", "Avenir Next", "Futura", Arial, sans-serif`;
  g.fillStyle = '#121217'; roundRect(g, 2, 2, U - 4, UH - 4, 10); g.fill();
  const fr = g.createLinearGradient(0, 0, U, 0);
  fr.addColorStop(0, CYAN); fr.addColorStop(1, PURPLE);
  g.strokeStyle = fr; g.lineWidth = 5; g.shadowColor = PURPLE; g.shadowBlur = 12;
  roundRect(g, 14, 14, U - 28, UH - 28, 8); g.stroke();
  g.shadowBlur = 0;
  // the mark
  const ms = UH - 64, mx = 32, my = 32;
  g.save();
  g.shadowColor = 'rgba(255,43,214,0.8)'; g.shadowBlur = 16;
  g.fillStyle = '#fbf8ff'; roundRect(g, mx, my, ms, ms, ms * 0.16); g.fill();
  g.shadowBlur = 0; g.fillStyle = '#121217'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = font(900, ms * 0.42);
  g.fillText('W', mx + ms / 2, my + ms * 0.3); g.fillText('M', mx + ms / 2, my + ms * 0.71);
  g.restore();
  // the name, fitted between the mark and the frame
  const x0 = mx + ms + 26, x1 = U - 36, cy = UH / 2 - 4;
  let size = UH * 0.58;
  g.font = font(800, size);
  const w0 = g.measureText('WINBAUM.EE').width;
  if (w0 > x1 - x0) { size *= (x1 - x0) / w0; g.font = font(800, size); }
  const tw = g.measureText('WINBAUM.EE').width, tx = (x0 + x1) / 2 - tw / 2;
  const gr = g.createLinearGradient(tx, 0, tx + tw, 0);
  gr.addColorStop(0, CYAN); gr.addColorStop(0.5, MID); gr.addColorStop(1, PURPLE);
  g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = gr;
  g.shadowColor = PURPLE; g.shadowBlur = 14; g.fillText('WINBAUM.EE', tx, cy);
  g.shadowBlur = 0; g.fillText('WINBAUM.EE', tx, cy);
  g.fillStyle = fr; g.fillRect(x0 + 4, UH - 40, x1 - x0 - 4, 5);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---- flat faces with their own corners: positions, normals, picture coordinates, colours
class Faces {
  constructor() { this.P = []; this.N = []; this.U = []; this.C = []; }
  // four corners round the face; `want` is the side it faces (the corners' order is fixed to suit);
  // uv: the picture coordinates of each corner; col: one colour [r, g, b] or one per corner
  quad(pts, want, uv = null, col = [1, 1, 1]) {
    const [a, b, c] = pts;
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    let order = [0, 1, 2, 0, 2, 3];
    if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) { order = [0, 2, 1, 0, 3, 2]; n = n.map((v) => -v); }
    const l = Math.hypot(...n) || 1;
    n = n.map((v) => v / l);
    const cols = Array.isArray(col[0]) ? col : [col, col, col, col];
    for (const i of order) {
      this.P.push(...pts[i]); this.N.push(...n); this.C.push(...cols[i]);
      if (uv) this.U.push(...uv[i]);
    }
  }
  // a soft round pool of light on a level surface (brightest in the middle)
  pool(x, y, z, rx, rz, col, segs = 18) {
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * 6.283, a1 = ((i + 1) / segs) * 6.283;
      this.P.push(x, y, z, x + Math.cos(a1) * rx, y, z + Math.sin(a1) * rz, x + Math.cos(a0) * rx, y, z + Math.sin(a0) * rz);
      this.N.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      this.C.push(...col, 0, 0, 0, 0, 0, 0);
    }
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    if (this.U.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    return new THREE.Mesh(g, mat);
  }
}

// Shade a self-lit mesh once: a warm light from above and in front, darker low down and on faces turned away.
function shadeOnce(geo) {
  const n = geo.attributes.normal.array, p = geo.attributes.position.array, c = geo.attributes.color.array;
  const L = [0.2, 0.86, 0.47];
  for (let i = 0; i < c.length; i += 3) {
    const d = Math.max(0, n[i] * L[0] + n[i + 1] * L[1] + n[i + 2] * L[2]);
    const low = Math.min(1, Math.max(0, (p[i + 1] - Y0) / 1.3));
    const k = (0.5 + 0.5 * d + 0.06 * Math.max(0, n[i + 1])) * (0.8 + 0.2 * low);
    c[i] *= k; c[i + 1] *= k; c[i + 2] *= k;
  }
}

export function createWinbaum(scene, world, { shadows = true } = {}) {
  if (!WINBAUM) return { update() {} };
  const group = still(new THREE.Group());
  group.name = 'winbaum';
  let built = false;
  const font = loadFont();

  function* build() {
    // ================= the shell, the deck, the garden (lit by the sun)
    const p = new Parts();
    const FLASH = 0x222227, DARK = 0x0d0d10;
    const rbox = (w, h, d, r, hex, x, y, z, yaw = 0) => p.add(new RoundedBoxGeometry(w, h, d, 2, r), hex, x, y, z, yaw);
    p.box(LOT.x1 - LOT.x0, 0.35, LOT.z1 - LOT.z0, 0xb9b1bb, (LOT.x0 + LOT.x1) / 2, -0.15, (LOT.z0 + LOT.z1) / 2);   // the gravel bed
    p.box(X1 - X0 - 0.2, WY0 + 0.25, ZF - ZB - 0.2, 0x121214, 0, (WY0 - 0.25) / 2, 0);                            // the plinth
    p.box(X1 - X0 + 0.04, 0.3, ZF - ZB + 0.04, FLASH, 0, YT - 0.15, 0);                                              // the roof
    p.box(X1 - X0 + 0.08, 0.06, ZF - ZB + 0.08, 0x34343b, 0, YT + 0.02, 0);                                          // its flashing
    // the frame's front edge: a dark flashing round the opening
    p.box(X1 - X0 + 0.04, YT - OY, 0.05, FLASH, 0, (OY + YT) / 2, ZF);
    for (const [xa, xb] of [[X0 - 0.02, OX0], [OX1, X1 + 0.02]]) p.box(xb - xa, OY - WY0, 0.05, FLASH, (xa + xb) / 2, (WY0 + OY) / 2, ZF);
    p.box(OX1 - OX0, Y0 - DY + 0.02, ZF - ZG + 0.02, FLASH, 0, (DY + Y0) / 2 - 0.01, (ZF + ZG) / 2);              // the sill
    // the glazing's frames: seven panes, the sliding door's second frame on the fifth
    const pw = (GX1 - GX0) / PANES;
    for (let k = 0; k <= PANES; k++) p.box(0.055, YG - Y0, 0.09, DARK, GX0 + k * pw, (Y0 + YG) / 2, ZG);
    p.box(GX1 - GX0, 0.06, 0.09, DARK, 0, YG - 0.03, ZG);
    p.box(GX1 - GX0, 0.05, 0.09, DARK, 0, Y0 + 0.025, ZG);
    p.box(0.055, YG - Y0, 0.07, DARK, GX0 + 4 * pw + 0.06, (Y0 + YG) / 2, ZG + 0.08);
    p.box(0.02, 0.32, 0.03, 0x9a9aa2, GX0 + 4 * pw + 0.14, Y0 + 1.05, ZG + 0.13);                                // its handle
    // the chimney
    p.add(new THREE.CylinderGeometry(0.12, 0.12, 1.0, 10), 0x151518, -0.35, YT + 0.5, -0.45);
    p.add(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 10), 0x2a2a30, -0.35, YT + 1.02, -0.45);
    // the service box and its pipes on the right end
    p.box(0.16, 0.72, 0.52, 0x9da0a8, X1 + 0.1, 1.75, 0.35);
    p.box(0.02, 0.6, 0.42, 0xb4b7be, X1 + 0.19, 1.75, 0.35);
    p.box(0.14, 0.42, 0.34, 0x8f9299, X1 + 0.09, 1.0, -0.6);
    for (const [z, y0, y1] of [[0.0, 0.05, 1.4], [0.7, 1.4, YT - 0.1], [-0.6, 0.05, 0.8], [-0.82, 1.2, YT - 0.1]]) p.add(new THREE.CylinderGeometry(0.035, 0.035, y1 - y0, 8), 0x2b2c31, X1 + 0.08, (y0 + y1) / 2, z);
    // the deck: boards along the front, its edge, a step at the left
    const shades = [0xb67d4b, 0xa8723f, 0xc08a57, 0xae7845, 0xb98250];
    for (let k = 0, n = Math.round(DECK / 0.153); k < n; k++) p.box(X1 - X0 + DECK_R, DY, 0.145, shades[k % 5], (X0 + X1 + DECK_R) / 2, DY / 2, ZF + 0.08 + k * 0.153);
    p.box(X1 - X0 + DECK_R, DY - 0.02, 0.05, 0x8a5a33, (X0 + X1 + DECK_R) / 2, DY / 2 - 0.01, ZF + DECK + 0.02);
    p.box(1.0, 0.15, 0.42, 0x6a4a32, X0 + 1.0, 0.07, ZF + DECK + 0.25);
    // a white upholstered lounger on thin black legs
    rbox(1.55, 0.13, 0.66, 0.05, 0xf1eee8, 3.45, DY + 0.33, ZF + 1.2);
    p.add(new RoundedBoxGeometry(0.6, 0.09, 0.64, 2, 0.04).rotateZ(0.95), 0xf1eee8, 4.12, DY + 0.6, ZF + 1.2);   // the back, raised at the head
    for (const [x, z] of [[2.8, 0.95], [2.8, 1.45], [4.1, 0.95], [4.1, 1.45]]) p.box(0.025, 0.3, 0.025, 0x1a1a1e, x, DY + 0.15, ZF + z);
    // the deck lights' posts (their glass is lit, below)
    for (const x of [X0 + 0.25, X1 + DECK_R - 0.25]) p.add(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 10), 0x1a1a1e, x, DY + 0.07, ZF + DECK - 0.2);
    // the olive's trunk: two stems twisting round each other from a swollen foot, parting into three crooked limbs
    // that end inside the crown (its leaves are on cards with the lavender, below)
    {
      const up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3(), q = new THREE.Quaternion();
      const limb = (pts, hex) => {
        for (let i = 0; i + 1 < pts.length; i++) {
          const [ax, ay, az, ar] = pts[i], [bx, by, bz, br] = pts[i + 1];
          d.set(bx - ax, by - ay, bz - az);
          const L = d.length();
          const g = new THREE.CylinderGeometry(br, ar, L, 7, 1, true).applyQuaternion(q.setFromUnitVectors(up, d.normalize()));
          p.add(g, hex, OLIVE[0] + (ax + bx) / 2, (ay + by) / 2, OLIVE[1] + (az + bz) / 2);
          if (i) p.add(new THREE.IcosahedronGeometry(ar, 0), hex, OLIVE[0] + ax, ay, OLIVE[1] + az);
        }
      };
      p.add(new THREE.CylinderGeometry(0.15, 0.22, 0.22, 8), 0x4a453f, OLIVE[0], 0.11, OLIVE[1]);
      limb([[0, 0, 0, 0.13], [0.09, 0.45, -0.04, 0.1], [-0.02, 0.85, 0.05, 0.09], [0.04, 1.1, 0.0, 0.08]], 0x5a544c);
      limb([[0.07, 0.02, 0.07, 0.08], [-0.08, 0.4, 0.09, 0.065], [0.03, 0.8, -0.06, 0.06], [-0.05, 1.05, -0.02, 0.05]], 0x4d4842);
      limb([[0.04, 1.08, 0, 0.07], [0.3, 1.4, 0.12, 0.05], [0.55, 1.75, 0.22, 0.035], [0.62, 2.0, 0.3, 0.02]], 0x58524a);
      limb([[0.02, 1.08, 0, 0.065], [-0.28, 1.45, -0.06, 0.05], [-0.52, 1.72, -0.16, 0.034], [-0.6, 1.98, -0.22, 0.02]], 0x534d46);
      limb([[0.03, 1.1, 0, 0.06], [0.0, 1.5, -0.25, 0.045], [0.08, 1.85, -0.4, 0.03], [0.1, 2.15, -0.42, 0.02]], 0x5c564e);
    }
    // the sign's back board and posts (the sign itself comes with its picture)
    const SW = 7.4, SH = 1.46, SY = YT + 0.32 + SH / 2, SZ = 0.25;
    p.box(SW + 0.14, SH + 0.14, 0.12, 0x15101f, 0, SY, SZ);
    for (const x of [-SW * 0.33, SW * 0.33]) p.box(0.12, 0.34, 0.12, 0x101014, x, YT + 0.17, SZ);
    const outside = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    outside.castShadow = shadows; outside.receiveShadow = true;
    group.add(outside);
    yield;

    // ================= the timber boards: the ends, the back and the slatted reveals round the glass
    const b = new Faces(), m = BOARD_M;
    const wall = (pts, want, uAxis, tint = [1, 1, 1]) => b.quad(pts, want, pts.map((q) => [q[uAxis] / m, q[1] / m]), tint);
    wall([[X0, WY0, ZB], [X0, WY0, ZF], [X0, WY1, ZF], [X0, WY1, ZB]], [-1, 0, 0], 2);
    wall([[X1, WY0, ZB], [X1, WY0, ZF], [X1, WY1, ZF], [X1, WY1, ZB]], [1, 0, 0], 2);
    wall([[X0, WY0, ZB], [X1, WY0, ZB], [X1, WY1, ZB], [X0, WY1, ZB]], [0, 0, -1], 0);
    // the reveals: the jambs with upright slats, the soffit with slats running back to the glass
    const lining = [1.12, 1.06, 1.0];
    wall([[OX0, Y0, ZF], [GX0, Y0, ZG], [GX0, YG, ZG], [OX0, OY, ZF]], [1, 0, 0.3], 2, lining);
    wall([[OX1, Y0, ZF], [GX1, Y0, ZG], [GX1, YG, ZG], [OX1, OY, ZF]], [-1, 0, 0.3], 2, lining);
    b.quad([[OX0, OY, ZF], [OX1, OY, ZF], [GX1, YG, ZG], [GX0, YG, ZG]], [0, -1, 0.4],
      [[OX0 / m, ZF / m], [OX1 / m, ZF / m], [GX1 / m, ZG / m], [GX0 / m, ZG / m]], lining);
    const boards = b.mesh(new THREE.MeshLambertMaterial({ map: boardsTex(), vertexColors: true }));
    boards.castShadow = shadows; boards.receiveShadow = true;
    group.add(boards);
    yield;

    // ================= the inside: shaded once, then the lights on top unshaded
    const q = new Parts(), e = new Parts();
    const rb = (w, h, d, r, hex, x, y, z, yaw = 0) => q.add(new RoundedBoxGeometry(w, h, d, 2, r), hex, x, y, z, yaw);
    const IZ0 = ZB + 0.17, IZ1 = ZG - 0.05, ID = IZ1 - IZ0, IW = GX1 - GX0, IH = YG - 0.05 - Y0, CEIL = YG - 0.05;
    q.box(IW, 0.02, ID, 0x8c6240, 0, Y0 + 0.01, IZ0 + ID / 2);                                  // oak floor
    q.box(IW, IH, 0.02, 0xb07a4a, 0, Y0 + IH / 2, IZ0 + 0.01);                                  // the oak-lined back wall
    for (const x of [GX0 + 0.04, GX1 - 0.04]) q.box(0.02, IH, ID, 0xa06c40, x, Y0 + IH / 2, IZ0 + ID / 2);
    q.box(IW, 0.02, ID, 0x9a6a42, 0, CEIL, IZ0 + ID / 2);                                       // the slatted ceiling
    for (let x = GX0 + 0.12; x < GX1; x += 0.12) q.box(0.02, 0.012, ID, 0x6e4a2c, x, CEIL - 0.012, IZ0 + ID / 2);
    for (let x = GX0 + 0.3; x < GX1 - 0.1; x += 0.6) q.box(0.012, IH - 0.02, 0.01, 0x8a5a34, x, Y0 + IH / 2, IZ0 + 0.025);   // joints in the wall
    // -- the bedroom: a low upholstered bed against the back wall, bedside tables and lamps, the glowing shelf
    const bedX = -2.55;
    rb(1.72, 0.22, 2.04, 0.04, 0x6b625a, bedX, Y0 + 0.13, IZ0 + 1.06);                         // the base
    rb(1.62, 0.24, 1.96, 0.07, 0xf5f2ec, bedX, Y0 + 0.36, IZ0 + 1.06);                         // the mattress
    rb(1.68, 0.08, 1.4, 0.04, 0xece7de, bedX, Y0 + 0.5, IZ0 + 1.34);                           // the duvet
    rb(1.72, 0.06, 0.55, 0.03, 0x8e8a76, bedX, Y0 + 0.56, IZ0 + 1.62);                         // the folded throw
    rb(1.76, 0.85, 0.12, 0.05, 0xcfc4b4, bedX, Y0 + 0.62, IZ0 + 0.08);                         // the headboard
    for (const dx of [-0.42, 0.42]) { rb(0.62, 0.16, 0.36, 0.07, 0xfbfaf6, bedX + dx, Y0 + 0.58, IZ0 + 0.32); rb(0.52, 0.14, 0.3, 0.06, 0xd9d2c4, bedX + dx, Y0 + 0.6, IZ0 + 0.5); }
    for (const dx of [-1.18, 1.18]) {
      rb(0.42, 0.42, 0.38, 0.03, 0x7a5434, bedX + dx, Y0 + 0.21, IZ0 + 0.22);                  // bedside tables
      q.add(new THREE.CylinderGeometry(0.012, 0.05, 0.3, 8), 0x26221e, bedX + dx, Y0 + 0.57, IZ0 + 0.2);
      e.add(new THREE.CylinderGeometry(0.09, 0.12, 0.16, 14, 1, true), 0xffe2b0, bedX + dx, Y0 + 0.78, IZ0 + 0.2);
    }
    q.box(2.9, 0.04, 0.2, 0x7a5634, bedX, Y0 + 1.32, IZ0 + 0.11);                              // the shelf
    e.box(2.9, 0.025, 0.02, 0xfff3cc, bedX, Y0 + 1.36, IZ0 + 0.03);                            // its light strip
    e.box(2.9, 0.34, 0.01, 0xffb257, bedX, Y0 + 1.55, IZ0 + 0.025);                            // and the wall it lights
    e.box(2.9, 0.4, 0.01, 0xd98a48, bedX, Y0 + 1.92, IZ0 + 0.025);
    for (const dx of [-0.9, -0.55, 0.6]) q.add(new THREE.CylinderGeometry(0.05, 0.06, 0.14, 10), dx < 0 ? 0xcfc8bc : 0x3a3430, bedX + dx, Y0 + 1.41, IZ0 + 0.12);
    // -- sheer curtains gathered at both ends of the glazing
    for (const [x0, dir] of [[GX0 + 0.06, 1], [GX1 - 0.06, -1]]) {
      const folds = 6, fw = 0.09;
      for (let k = 0; k < folds; k++) {
        const xa = x0 + dir * k * fw, xb = x0 + dir * (k + 1) * fw, za = IZ1 - 0.08 - (k % 2) * 0.07, zb = IZ1 - 0.08 - ((k + 1) % 2) * 0.07;
        const seg = new THREE.BoxGeometry(Math.hypot(xb - xa, zb - za), IH - 0.08, 0.012);
        q.add(seg, 0xefe9de, (xa + xb) / 2, Y0 + IH / 2, (za + zb) / 2, Math.atan2(-(zb - za), xb - xa));
      }
    }
    // -- the living room: a round black stove on its plinth with the fire, logs beside it, a rug, a stone table,
    // a boucle lounge chair, a plant
    const stX = -0.42, stZ = IZ0 + 0.55;
    q.add(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 24), 0x55524f, stX, Y0 + 0.04, stZ);
    q.add(new THREE.CylinderGeometry(0.27, 0.27, 0.62, 20), 0x18181a, stX, Y0 + 0.44, stZ);
    q.add(new THREE.CylinderGeometry(0.29, 0.29, 0.04, 20), 0x232326, stX, Y0 + 0.77, stZ);
    q.add(new THREE.CylinderGeometry(0.075, 0.075, CEIL - Y0 - 0.79, 12), 0x18181a, stX, (Y0 + 0.79 + CEIL) / 2, stZ);
    const fire = new THREE.Color(0xff7a1a);
    e.box(0.26, 0.22, 0.02, fire.getHex(), stX, Y0 + 0.47, stZ + 0.27);
    e.box(0.16, 0.08, 0.025, 0xffd27a, stX, Y0 + 0.41, stZ + 0.275);
    for (let k = 0; k < 9; k++) q.add(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8).rotateZ(Math.PI / 2), k % 3 ? 0x6d4f36 : 0x8a6a4c, stX + 0.62, Y0 + 0.07 + Math.floor(k / 3) * 0.11, stZ - 0.12 + (k % 3) * 0.12);
    rb(2.1, 0.015, 1.5, 0.006, 0xd7cdbd, 0.55, Y0 + 0.012, IZ0 + 1.55);                       // the rug
    q.add(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 28), 0xe6dccb, 0.25, Y0 + 0.36, IZ0 + 1.62);   // travertine table
    q.add(new THREE.CylinderGeometry(0.2, 0.24, 0.33, 24), 0xd9cfbe, 0.25, Y0 + 0.165, IZ0 + 1.62);
    q.add(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 12), 0x3b3632, 0.25, Y0 + 0.46, IZ0 + 1.6);    // a vase
    // the lounge chair: a deep rounded seat in boucle with a curved back and arms
    const chX = 1.05, chZ = IZ0 + 1.55;
    rb(0.95, 0.36, 0.82, 0.16, 0xf0e8da, chX, Y0 + 0.2, chZ);
    rb(0.95, 0.46, 0.24, 0.12, 0xece3d3, chX + 0.02, Y0 + 0.52, chZ - 0.34, 0.12);
    for (const dx of [-0.42, 0.42]) rb(0.2, 0.3, 0.74, 0.09, 0xece3d3, chX + dx, Y0 + 0.42, chZ + 0.02);
    rb(0.5, 0.1, 0.42, 0.05, 0xf4eee4, chX, Y0 + 0.42, chZ + 0.08);
    q.add(new THREE.CylinderGeometry(0.17, 0.13, 0.42, 16), 0xcdbfae, 1.85, Y0 + 0.21, IZ0 + 1.65);     // the plant in its pot
    for (const [dx, dy, dz, r] of [[0, 0.75, 0, 0.3], [0.14, 0.95, 0.06, 0.22], [-0.12, 1.05, -0.04, 0.2], [0.02, 1.25, 0.02, 0.16]]) q.add(new THREE.IcosahedronGeometry(r, 1).scale(1, 1.15, 1), 0x3f6a3a, 1.85 + dx, Y0 + dy, IZ0 + 1.65 + dz);
    // -- the kitchen at the back right: handleless oak fronts, a light stone top with the sink, open shelves with
    // their lights, a tall unit with the oven
    const kx0 = 1.35, kx1 = 3.55, kw = kx1 - kx0, kxm = (kx0 + kx1) / 2;
    q.box(kw, 0.8, 0.6, 0xb98a58, kxm, Y0 + 0.48, IZ0 + 0.3);
    q.box(kw, 0.08, 0.56, 0x2a2622, kxm, Y0 + 0.04, IZ0 + 0.28);                                 // the kick
    for (let x = kx0 + 0.55; x < kx1 - 0.1; x += 0.55) q.box(0.008, 0.78, 0.01, 0x7d5a38, x, Y0 + 0.48, IZ0 + 0.605);
    q.box(kw + 0.02, 0.04, 0.64, 0xece8e1, kxm, Y0 + 0.9, IZ0 + 0.32);                            // the stone top
    q.box(0.5, 0.012, 0.36, 0x9a9690, kxm - 0.3, Y0 + 0.92, IZ0 + 0.32);                          // the sink
    q.box(0.02, 0.3, 0.02, 0x1c1c1e, kxm - 0.3, Y0 + 1.07, IZ0 + 0.1);
    q.box(0.02, 0.02, 0.18, 0x1c1c1e, kxm - 0.3, Y0 + 1.21, IZ0 + 0.18);
    e.box(kw, 0.55, 0.01, 0xf0a050, kxm, Y0 + 1.2, IZ0 + 0.025);                                 // the lit splashback
    for (const y of [1.55, 1.95]) {
      q.box(kw, 0.035, 0.26, 0x8a6038, kxm, Y0 + y, IZ0 + 0.14);
      e.box(kw, 0.012, 0.03, 0xfff0c8, kxm, Y0 + y - 0.025, IZ0 + 0.24);
    }
    for (const [x, y, h, r, hex] of [[1.55, 1.57, 0.12, 0.07, 0xe9e3d9], [1.75, 1.57, 0.2, 0.05, 0x3b3632], [2.6, 1.57, 0.08, 0.11, 0xd8cfc2], [3.2, 1.57, 0.16, 0.06, 0xe9e3d9], [1.9, 1.97, 0.18, 0.05, 0xcbbfa9], [2.9, 1.97, 0.1, 0.09, 0x3b3632]]) q.add(new THREE.CylinderGeometry(r, r * 0.9, h, 12), hex, x, Y0 + y + h / 2, IZ0 + 0.15);
    q.box(0.48, IH - 0.02, 0.6, 0xb48552, 3.81, Y0 + IH / 2, IZ0 + 0.3);                         // the tall unit
    q.box(0.4, 0.42, 0.01, 0x141416, 3.81, Y0 + 1.15, IZ0 + 0.605);                              // its oven
    // -- the dining table under the globes: a solid oak top on two slab legs, four chairs with curved backs
    const tX = 2.75, tZ = IZ0 + 1.72;
    rb(1.6, 0.05, 0.86, 0.02, 0xb5864f, tX, Y0 + 0.74, tZ);
    for (const dx of [-0.6, 0.6]) q.box(0.07, 0.71, 0.66, 0x9a6e40, tX + dx, Y0 + 0.355, tZ);
    for (const [dx, dz, turn] of [[-0.38, -0.62, 0], [0.38, -0.62, 0], [-0.38, 0.62, Math.PI], [0.38, 0.62, Math.PI]]) {
      const cx = tX + dx, cz = tZ + dz, fz = Math.cos(turn), bz = -fz;
      rb(0.44, 0.05, 0.42, 0.02, 0x2b2622, cx, Y0 + 0.45, cz);                                 // the woven seat
      for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) q.box(0.03, 0.44, 0.03, 0xa57a4c, cx + lx, Y0 + 0.22, cz + lz);
      q.add(new THREE.TorusGeometry(0.22, 0.022, 6, 16, Math.PI), 0xa57a4c, cx, Y0 + 0.62, cz + bz * 0.18);    // the curved back rail
      q.box(0.03, 0.2, 0.03, 0xa57a4c, cx, Y0 + 0.55, cz + bz * 0.2);
    }
    // -- lights: glass globes over the table and the chair, downlights in the ceiling
    for (const [x, y, z, r] of [[tX - 0.35, 1.72, tZ - 0.1, 0.13], [tX + 0.05, 1.6, tZ + 0.08, 0.15], [tX + 0.4, 1.78, tZ - 0.05, 0.12], [chX, 1.75, chZ - 0.1, 0.13], [chX - 0.3, 1.88, chZ + 0.05, 0.1]]) {
      q.box(0.008, CEIL - Y0 - y - r, 0.008, 0x2a2420, x, (Y0 + y + r + CEIL) / 2, z);
      e.add(new THREE.IcosahedronGeometry(r, 2), 0xfff1cf, x, Y0 + y, z);
    }
    for (let k = 0; k < 7; k++) e.add(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 12), 0xfff4dc, GX0 + 0.6 + k * 1.15, CEIL - 0.015, IZ0 + 0.85);
    // -- outside, unshaded too: the uplights at the foot of the reveals and the deck lights' glass
    for (const x of [OX0 + 0.12, OX1 - 0.12]) e.box(0.1, 0.03, 0.06, 0xfff0d0, x, DY + 0.015, ZF + 0.12);
    for (const x of [X0 + 0.25, X1 + DECK_R - 0.25]) e.add(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 10), 0xffe8c0, x, DY + 0.2, ZF + DECK - 0.2);
    const qm = q.mesh(null), em = e.mesh(null);
    shadeOnce(qm.geometry);
    const insideGeo = mergeGeometries([qm.geometry, em.geometry]);
    qm.geometry.dispose(); em.geometry.dispose();
    // (not tone mapped: the warm light reads as light, as in their photo, not as brown paint)
    const inside = new THREE.Mesh(insideGeo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, toneMapped: false }));
    group.add(inside);
    yield;

    // ================= the glass, faintly mirroring the evening sky at the top
    const gl = new Faces(), sky = [0.33, 0.27, 0.5], low = [0.05, 0.045, 0.08];
    gl.quad([[GX0, Y0, ZG - 0.004], [GX1, Y0, ZG - 0.004], [GX1, YG, ZG - 0.004], [GX0, YG, ZG - 0.004]], [0, 0, 1], null, [low, low, sky, sky]);
    const glass = gl.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.17, depthWrite: false, fog: true }));
    glass.renderOrder = 2;
    group.add(glass);

    // ================= painted light (added on top): the uplights up the reveals, the warm light from inside on
    // the sill, the deck and the soffit, the deck lights' pools
    const w = new Faces(), warm = (k) => [1.0 * k, 0.6 * k, 0.28 * k], none = [0, 0, 0];
    for (const [ox, gx, dir] of [[OX0, GX0, 1], [OX1, GX1, -1]]) {
      const off = 0.012 * dir, yTop = Y0 + 2.0;
      w.quad([[ox + off, DY, ZF], [gx + off, DY, ZG], [gx + off, yTop, ZG], [ox + off, yTop, ZF]], [dir, 0, 0.3], null, [warm(0.55), warm(0.55), none, none]);
      w.quad([[ox + off * 2, DY, ZF], [gx + off * 2, DY, ZG], [gx + off * 2, Y0 + 0.9, ZG], [ox + off * 2, Y0 + 0.9, ZF]], [dir, 0, 0.3], null, [warm(0.35), warm(0.35), none, none]);
    }
    w.quad([[GX0, Y0 + 0.003, ZG], [GX1, Y0 + 0.003, ZG], [OX1, Y0 + 0.003, ZF], [OX0, Y0 + 0.003, ZF]], [0, 1, 0], null, [warm(0.45), warm(0.45), warm(0.3), warm(0.3)]);
    w.quad([[OX0, DY + 0.004, ZF + 0.02], [OX1, DY + 0.004, ZF + 0.02], [OX1, DY + 0.004, ZF + 1.9], [OX0, DY + 0.004, ZF + 1.9]], [0, 1, 0], null, [warm(0.3), warm(0.3), none, none]);
    w.quad([[GX0, YG - 0.005, ZG], [GX1, YG - 0.005, ZG], [OX1, OY - 0.005, ZF], [OX0, OY - 0.005, ZF]], [0, -1, 0], null, [warm(0.28), warm(0.28), none, none]);
    for (const x of [X0 + 0.25, X1 + DECK_R - 0.25]) w.pool(x, DY + 0.005, ZF + DECK - 0.2, 0.75, 0.6, warm(0.4));
    const glow = w.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true, toneMapped: false }));
    glow.renderOrder = 4;
    group.add(glow);
    yield 'frame';

    // ================= the garden on one picture: lavender bushes on crossed see-through cards, the olive's crown of
    // leaf-spray cards round its trunk (built with the outside)
    const lav = new Faces(), lavTex = gardenTex();
    const BUSHES = [[X0 - 0.35, ZF + 0.55, 0.9], [X0 - 0.42, ZF + 1.45, 1.0], [X0 - 0.25, ZF + 2.45, 0.85], [X0 - 0.3, ZB + 0.6, 0.8],
      [X1 + DECK_R + 0.45, ZF + 2.55, 0.95], [X1 + DECK_R + 1.25, ZF + 2.2, 0.85], [X1 + 0.45, ZF - 0.2, 0.8]];
    for (const [k, [x, z, s]] of BUSHES.entries()) {
      const wd = 0.86 * s, ht = 0.72 * s;
      for (let j = 0; j < 4; j++) {
        const a = (j * Math.PI) / 4 + k * 0.7, dx = (Math.cos(a) * wd) / 2, dz = (Math.sin(a) * wd) / 2;
        lav.quad([[x - dx, 0.02, z - dz], [x + dx, 0.02, z + dz], [x + dx, 0.02 + ht, z + dz], [x - dx, 0.02 + ht, z - dz]], [Math.sin(a), 0, -Math.cos(a)], [[0, 0], [0.5, 0], [0.5, 1], [0, 1]]);
      }
    }
    for (let i = 0; i < lav.N.length; i += 3) { lav.N[i] *= 0.3; lav.N[i + 1] = 1; lav.N[i + 2] *= 0.3; }   // lit like grass, not like a wall
    {
      // a card of the olive's crown: facing out at azimuth az, lying back by `lie`, turned in its plane by `roll`;
      // lit by the crown's round shape (as the realistic trees are), darker inside and low down
      const r = rng(31);
      const card = (cx, cy, cz, az, lie, roll, w, shade) => {
        const ox = Math.cos(az), oz = Math.sin(az), sl = Math.sin(lie), cl = Math.cos(lie);
        const t1 = [-oz, 0, ox], t2 = [-ox * sl, cl, -oz * sl], cr = Math.cos(roll), sr = Math.sin(roll);
        const a1 = t1.map((v, i) => v * cr + t2[i] * sr), a2 = t2.map((v, i) => v * cr - t1[i] * sr), h = w / 2;
        const P = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([u, v]) => [cx + a1[0] * u + a2[0] * v, cy + a1[1] * u + a2[1] * v, cz + a1[2] * u + a2[2] * v]);
        const UV = [[0.5, 0], [1, 0], [1, 1], [0.5, 1]];
        for (const i of [0, 1, 2, 0, 2, 3]) {
          const [x, y, z] = P[i], nx = x - OC[0], ny = (y - OC[1]) * 0.8 + 0.35, nz = z - OC[2], l = Math.hypot(nx, ny, nz) || 1;
          const k = shade * (0.6 + 0.4 * Math.min(1, Math.max(0, (y - OC[1] + ORY) / (2 * ORY))));
          lav.P.push(x, y, z); lav.N.push(nx / l, ny / l, nz / l); lav.U.push(...UV[i]); lav.C.push(k, k, k);
        }
      };
      // the shell, spread round the crown by the golden angle, from a little below its middle over the top
      for (let i = 0, n = 38; i < n; i++) {
        const el = -0.55 + ((i + 0.5) / n) * 1.95, az = i * 2.39996 + r() * 0.4, ce = Math.cos(el) * (1 + 0.12 * Math.sin(az * 3 + i));
        card(OC[0] + Math.cos(az) * ce * ORX * 0.85, OC[1] + Math.sin(el) * ORY * 0.85, OC[2] + Math.sin(az) * ce * ORX * 0.85,
          az, Math.max(0, el) * 0.8 + (r() - 0.5) * 0.5, r() * 6.283, 0.85 + r() * 0.35, 1);
      }
      for (let i = 0; i < 9; i++) {
        const az = r() * 6.283, d = r() * 0.45;
        card(OC[0] + Math.cos(az) * d, OC[1] - 0.2 + r() * 0.5, OC[2] + Math.sin(az) * d, az, (r() - 0.5) * 0.8, r() * 6.283, 0.8, 0.78);
      }
    }
    const garden = lav.mesh(new THREE.MeshLambertMaterial({ map: lavTex, alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true }));
    garden.castShadow = shadows;
    group.add(garden);
    jobs.upload(lavTex);
    yield;

    // ================= the sign on the roof, after the bundled font has loaded so the name is drawn in it
    yield* waitFor(font);
    yield 'frame';
    const tex = signTex(SW, SH);
    // the same picture on both faces, one piece
    const faceA = new THREE.PlaneGeometry(SW, SH).translate(0, SY, SZ + 0.07);
    const faceB = new THREE.PlaneGeometry(SW, SH).rotateY(Math.PI).translate(0, SY, SZ - 0.07);
    // (not tone mapped: the cyan and purple stay as bright as painted, like the LAP START board's neon)
    const sign = new THREE.Mesh(mergeGeometries([faceA, faceB]), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true, toneMapped: false }));
    faceA.dispose(); faceB.dispose();
    sign.renderOrder = 3;
    group.add(sign);
    jobs.upload(tex);
  }
  // (a promise in a generator: wait a frame at a time until it settles)
  function* waitFor(pr) {
    let done = false;
    pr.then(() => { done = true; }, () => { done = true; });
    const t0 = performance.now();
    while (!done && performance.now() - t0 < 3000) yield 'frame';
  }

  return {
    group,
    spot: SPOT,
    update(car) {
      if (!car) return;
      const d = Math.hypot(car.x - SPOT.x, car.z - SPOT.z);
      if (built) { group.visible = d < 500; return; }
      if (d > 900) return;
      const [ax, az] = toWorld(LOT.x0, LOT.z0), [bx, bz] = toWorld(LOT.x1, LOT.z1);
      if (!world.ready(ax, az) || !world.ready(bx, bz)) return;
      built = true;
      // (placed before it joins the scene: a still group works out where it is once)
      let gy = Infinity;          // the gravel bed sits at the lowest ground under the lot, so nothing floats
      for (const [lx, lz] of [[LOT.x0, LOT.z0], [LOT.x1, LOT.z0], [LOT.x0, LOT.z1], [LOT.x1, LOT.z1], [0, 0]]) {
        const [x, z] = toWorld(lx, lz); gy = Math.min(gy, world.heightAt(x, z));
      }
      group.position.set(SPOT.x, gy, SPOT.z);
      group.rotation.y = SPOT.yaw;
      group.scale.setScalar(S);
      scene.add(group);
      // the cabin and its deck stop the cars
      const [cx, cz] = toWorld((X0 + X1 + DECK_R) / 2, (ZB + ZF + DECK) / 2);
      world.addSolids([{ x: cx, z: cz, yaw: SPOT.yaw, hx: (S * (X1 - X0 + DECK_R)) / 2, hz: (S * (ZF - ZB + DECK)) / 2 }]);
      jobs.add(build, 'winbaum');
    },
  };
}
