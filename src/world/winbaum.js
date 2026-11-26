// An advert for winbaum.ee, a maker of modular houses (Martin, 26 Nov: a draft for a possible advertiser): their
// Winbaum L cabin standing on the Kaubamaja plaza just to the left of the LAP START billboard, as seen from the
// start, with WINBAUM.EE on its roof in a cyan to purple gradient. Only with ?winbaum=N (N picks a draft).
//   - the cabin after their photo and floor plan: 9.0 x 3.3 m, black vertical boards, a deep black frame round
//     the glazed front (five tall panes, the sliding door on the right), a flat roof with the stove's chimney,
//     a wooden deck along the front, a step, lavender and a small olive tree on a gravel bed
//   - inside, seen through the glass, lit warm: two beds under a glowing shelf on the left, the wood stove in
//     the middle, the kitchen at the back right and the dining table at the front right
//   - the sign on the roof: a lit panel like their own render (draft 1), bare letters on a rail (draft 2), a
//     panel readable from both sides with the cabin turned towards the corner (draft 3)
// Light on purpose: two merged meshes (the outside lit by the sun, the inside self-lit), one sheet of glass, one
// small canvas for the sign (about 0.8 MB at full size, less on phones: paintScale), built in steps of the work
// queue when the car comes within 900 m, hidden beyond 500 m. Nothing on the racing line: the deck's edge is
// over 6 m beyond the kerb of the start/finish straight; the Kaubamaja benches and the one young lime of the
// straight's row that stood on the lot make room (kaubamaja.js, trackside.js ask winbaumLot).
import * as THREE from 'three';
import { Parts } from '../race/landmarks.js';
import { paintScale } from './paintscale.js';
import { loadFont, FONT } from './hologram.js';
import { jobs } from '../jobs.js';
import { still } from '../still.js';

// which draft is shown (0: none)
const DRAFT = typeof location !== 'undefined' ? Math.max(0, Math.min(3, +(new URLSearchParams(location.search).get('winbaum')) || 0)) : 0;
export const WINBAUM = DRAFT > 0;

// the Kaubamaja frame (kaubamaja.js): a along Küüni from the roof's west corner (towards the board, south-east),
// b along the park face (away from the start/finish straight, north-east). The LAP START board stands at
// a = -11, b = -2.7, 12 m wide along a; the straight's kerb runs at b = -8.
const O = [1659.6, 3088.7], UA = [0.6943, 0.7197], UB = [0.7189, -0.6951];
const at = (a, b) => [O[0] + UA[0] * a + UB[0] * b, O[1] + UA[1] * a + UB[1] * b];
const BASE_YAW = Math.atan2(-UB[0], -UB[1]);          // the glazed front looks back down Uueturu, at the start

// each draft: where the cabin's middle stands (a, b), how far it is turned from square (towards the corner),
// the sign, how bright the inside is, and the stove's fire
const DRAFTS = {
  1: { a: -23.0, b: 3.0, turn: 0, sign: 'panel', glow: 1.1, fire: 0.9 },
  2: { a: -25.5, b: 5.0, turn: 0, sign: 'letters', glow: 0.8, fire: 1.15 },
  3: { a: -31.0, b: 4.4, turn: 0.35, sign: 'twin', glow: 1.0, fire: 1.0 },
};
const D = DRAFTS[DRAFT] || DRAFTS[1];

// the cabin in its own frame: x along the front (to the right as one looks at it), z out of the glazed front,
// y up from the gravel bed
const X0 = -4.5, X1 = 4.5, ZB = -1.65, ZF = 1.65, ZG = 1.15;      // ends, back, front of the frame, the glass
const Y0 = 0.42, YG = 2.72, YT = 3.3;                             // floor, top of the glass, roof top
const GX0 = X0 + 0.9, GX1 = X1 - 0.28;                            // the glazed width (a solid strip of boards on the left)
const DECK = 2.3, DECK_R = 0.8;                                   // the deck's depth and how far it runs on past the right end
const SPOT = (() => {
  const [x, z] = at(D.a, D.b), yaw = BASE_YAW + D.turn;
  return { x, z, yaw, c: Math.cos(yaw), s: Math.sin(yaw) };
})();
// a point of the cabin's frame in the world, and back
const toWorld = (lx, lz) => [SPOT.x + SPOT.c * lx + SPOT.s * lz, SPOT.z - SPOT.s * lx + SPOT.c * lz];
const toLocal = (x, z) => { const dx = x - SPOT.x, dz = z - SPOT.z; return [SPOT.c * dx - SPOT.s * dz, SPOT.s * dx + SPOT.c * dz]; };

// Is (x, z) on the cabin's lot (the cabin and its deck, and `front` metres more in front of the deck), or within
// `margin` of it? For the benches and trees that make room, only while the advert is shown.
export function winbaumLot(x, z, margin = 0, front = 0) {
  if (!WINBAUM) return false;
  const [lx, lz] = toLocal(x, z);
  return lx > X0 - margin && lx < X1 + DECK_R + margin && lz > ZB - margin && lz < ZF + DECK + front + margin;
}

// ---- the sign
const CYAN = '#2ff3ff', MID = '#7d8bff', PURPLE = '#b44dff', PINK = '#ff2bd6';
function gradientText(g, text, x0, x1, cy, maxH, { glow = 18, outline = 0 } = {}) {
  let size = maxH;
  g.font = `800 ${size}px ${FONT}, "Montserrat", "Avenir Next", "Futura", Arial, sans-serif`;
  const w = g.measureText(text).width;
  if (w > x1 - x0) { size *= (x1 - x0) / w; g.font = `800 ${size}px ${FONT}, "Montserrat", "Avenir Next", "Futura", Arial, sans-serif`; }
  const tw = g.measureText(text).width, tx = (x0 + x1) / 2 - tw / 2;
  const gr = g.createLinearGradient(tx, 0, tx + tw, 0);
  gr.addColorStop(0, CYAN); gr.addColorStop(0.5, MID); gr.addColorStop(1, PURPLE);
  g.textAlign = 'left'; g.textBaseline = 'middle';
  if (outline) { g.lineJoin = 'round'; g.strokeStyle = 'rgba(14,4,30,0.85)'; g.lineWidth = outline; g.strokeText(text, tx, cy); }
  g.fillStyle = gr;
  if (glow) { g.shadowColor = PURPLE; g.shadowBlur = glow; g.fillText(text, tx, cy); }
  g.shadowBlur = 0; g.fillText(text, tx, cy);
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
// the W over M mark in a white rounded square, as on their render
function mark(g, x, y, s, ink = '#3a1466') {
  g.save();
  g.shadowColor = 'rgba(255,43,214,0.8)'; g.shadowBlur = 16;
  g.fillStyle = '#fbf8ff'; roundRect(g, x, y, s, s, s * 0.16); g.fill();
  g.shadowBlur = 0; g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${s * 0.42}px ${FONT}, "Montserrat", Arial, sans-serif`;
  g.fillText('W', x + s / 2, y + s * 0.3); g.fillText('M', x + s / 2, y + s * 0.71);
  g.restore();
}
// the sign's picture: painted at 1024 units across, `sw` x `sh` metres
function signTex(kind, sw, sh) {
  const U = 1024, UH = Math.round(U * sh / sw), k = Math.max(0.5, paintScale());
  const c = document.createElement('canvas');
  c.width = Math.round(U * k); c.height = Math.round(UH * k);
  const g = c.getContext('2d');
  g.scale(k, k);
  if (kind === 'letters') {
    gradientText(g, 'WINBAUM.EE', 16, U - 16, UH / 2 + 4, UH * 0.86, { glow: 22, outline: 7 });
  } else if (kind === 'panel') {
    // a dark panel in a hot pink neon frame with a row of little bulbs, the mark, the name (their render)
    g.fillStyle = 'rgba(22,8,48,0.95)'; roundRect(g, 2, 2, U - 4, UH - 4, 14); g.fill();
    g.fillStyle = '#ffd6f4';
    for (let x = 22; x < U - 16; x += 15) { g.fillRect(x, 10, 4, 4); g.fillRect(x, UH - 14, 4, 4); }
    for (let y = 25; y < UH - 18; y += 15) { g.fillRect(10, y, 4, 4); g.fillRect(U - 14, y, 4, 4); }
    g.strokeStyle = PINK; g.lineWidth = 6; g.shadowColor = PINK; g.shadowBlur = 18;
    roundRect(g, 22, 22, U - 44, UH - 44, 10); g.stroke();
    g.shadowBlur = 0;
    const ms = UH - 76;
    mark(g, 40, 38, ms);
    gradientText(g, 'WINBAUM.EE', 40 + ms + 26, U - 40, UH / 2 + 3, UH * 0.62, { glow: 16 });
  } else {
    // twin: a black panel like the cabin's boards, a thin gradient frame and a gradient bar under the name
    g.fillStyle = '#121217'; roundRect(g, 2, 2, U - 4, UH - 4, 10); g.fill();
    const fr = g.createLinearGradient(0, 0, U, 0);
    fr.addColorStop(0, CYAN); fr.addColorStop(1, PURPLE);
    g.strokeStyle = fr; g.lineWidth = 5; g.shadowColor = PURPLE; g.shadowBlur = 12;
    roundRect(g, 14, 14, U - 28, UH - 28, 8); g.stroke();
    g.shadowBlur = 0;
    const ms = UH - 64;
    mark(g, 32, 32, ms, '#121217');
    gradientText(g, 'WINBAUM.EE', 32 + ms + 26, U - 36, UH / 2 - 4, UH * 0.58, { glow: 14 });
    g.fillStyle = fr; g.fillRect(32 + ms + 30, UH - 40, U - 36 - (32 + ms + 30), 5);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function createWinbaum(scene, world, { shadows = true } = {}) {
  if (!WINBAUM) return { update() {} };
  const group = still(new THREE.Group());
  group.name = 'winbaum';
  let built = false;
  const font = loadFont();

  function* build() {
    // ---- the outside (lit by the sun)
    const p = new Parts();
    const BLACK = 0x1d1d22, BOARD = 0x2a2a31, FRAME = 0x17171b;
    const H = YT - Y0, MY = (Y0 + YT) / 2;
    p.box(X1 - X0 + 1.6 + DECK_R, 0.35, ZF - ZB + DECK + 1.6, 0xbdb5bf, (X0 + X1 + DECK_R) / 2 + 0.4, -0.15, (ZB + ZF + DECK) / 2);   // gravel bed
    p.box(X1 - X0 - 0.2, Y0 + 0.3, ZF - ZB - 0.3, 0x141417, 0, (Y0 - 0.3) / 2, -0.15);              // plinth
    p.box(X1 - X0, H, 0.16, BLACK, 0, MY, ZB + 0.08);                                                // back wall
    p.box(GX0 - X0, H, ZF - ZB, BLACK, (X0 + GX0) / 2, MY, 0);                                       // the boarded left end
    p.box(X1 - GX1, H, ZF - ZB, BLACK, (GX1 + X1) / 2, MY, 0);                                       // the right end
    p.box(X1 - X0, YT - YG, ZF - ZB, FRAME, 0, (YG + YT) / 2, 0);                                    // roof and the frame's head
    p.box(X1 - X0 + 0.06, 0.05, ZF - ZB + 0.06, 0x34343b, 0, YT + 0.02, 0);                          // the roof's edge
    p.box(GX1 - GX0, 0.06, ZF - ZG, FRAME, (GX0 + GX1) / 2, Y0 + 0.03, (ZF + ZG) / 2);               // the frame's sill
    // vertical boards: on the left end's face and both sides
    for (let x = X0 + 0.1; x < GX0 - 0.05; x += 0.16) p.box(0.035, H - 0.08, 0.03, BOARD, x, MY, ZF + 0.012);
    for (let z = ZB + 0.12; z < ZF - 0.05; z += 0.2) for (const sx of [X0 - 0.012, X1 + 0.012]) p.box(0.03, H - 0.08, 0.035, BOARD, sx, MY, z);
    for (let x = X0 + 0.15; x < X1 - 0.1; x += 0.25) p.box(0.035, H - 0.08, 0.03, BOARD, x, MY, ZB - 0.012);
    // the glazing's frames: five tall panes, the sliding door's second frame on the fourth
    const pw = (GX1 - GX0) / 5;
    for (let k = 0; k <= 5; k++) p.box(0.07, YG - Y0, 0.1, 0x0d0d10, GX0 + k * pw, (Y0 + YG) / 2, ZG);
    p.box(GX1 - GX0, 0.07, 0.1, 0x0d0d10, (GX0 + GX1) / 2, YG - 0.035, ZG);
    p.box(0.07, YG - Y0, 0.08, 0x0d0d10, GX0 + 3.5 * pw, (Y0 + YG) / 2, ZG + 0.09);
    // the chimney
    p.add(new THREE.CylinderGeometry(0.12, 0.12, 1.0, 8), 0x151518, -0.35, YT + 0.5, -0.45);
    p.add(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 8), 0x2a2a30, -0.35, YT + 1.02, -0.45);
    // the deck: boards along the front, its edge, a step at the left
    const shades = [0xb67d4b, 0xa8723f, 0xc08a57, 0xae7845];
    for (let k = 0, n = Math.round(DECK / 0.153); k < n; k++) p.box(X1 - X0 + DECK_R, 0.3, 0.145, shades[k % 4], (X0 + X1 + DECK_R) / 2, 0.15, ZF + 0.08 + k * 0.153);
    p.box(X1 - X0 + DECK_R, 0.28, 0.05, 0x8a5a33, (X0 + X1 + DECK_R) / 2, 0.14, ZF + DECK + 0.02);
    p.box(1.0, 0.15, 0.42, 0x5c3f2c, X0 + 1.0, 0.07, ZF + DECK + 0.25);
    // a white lounger on the deck, two little deck lights
    p.box(1.5, 0.14, 0.62, 0xf2efe8, 3.5, 0.56, ZF + 1.15);
    const back = new THREE.BoxGeometry(0.62, 0.12, 0.62).rotateZ(-0.7);
    p.add(back, 0xf2efe8, 4.35, 0.78, ZF + 1.15);
    for (const x of [-0.6, 2.8]) p.box(0.06, 0.32, 0.36, 0x63514a, x + 0.6, 0.38, ZF + 1.15);
    for (const x of [X0 + 0.25, X1 + DECK_R - 0.25]) p.box(0.09, 0.26, 0.09, 0xc9c9d0, x, 0.43, ZF + DECK - 0.2);
    // lavender at the corners (a green tuft with purple spikes), a small olive tree past the deck's end
    const tuft = new THREE.IcosahedronGeometry(0.3, 0).scale(1, 0.55, 1), spike = new THREE.ConeGeometry(0.06, 0.5, 4);
    for (const [k, [x, z]] of [[X0 - 0.45, ZF + 0.6], [X0 - 0.5, ZF + 1.5], [X0 - 0.3, ZF + 2.55], [X1 + DECK_R + 0.55, ZF + 2.4], [X1 + DECK_R + 0.75, ZF + 0.3], [X1 + 0.6, ZB - 0.3]].entries()) {
      p.add(tuft, 0x5f7d55, x, 0.14, z);
      for (let j = 0; j < 7; j++) { const a = j * 2.4 + k, r = 0.08 + (j % 3) * 0.08; p.add(spike, j % 2 ? 0x9c84d8 : 0x8670c4, x + Math.cos(a) * r, 0.42 + (j % 2) * 0.06, z + Math.sin(a) * r); }
    }
    const ox = X1 + DECK_R + 0.9, oz = ZF + 1.35;
    p.add(new THREE.CylinderGeometry(0.06, 0.1, 1.3, 6), 0x6b5a4a, ox, 0.65, oz);
    const crown = new THREE.IcosahedronGeometry(0.4, 1).scale(1, 0.7, 1);
    for (const [dx, dy, dz] of [[0, 1.6, 0], [0.42, 1.45, 0.2], [-0.38, 1.5, -0.15], [0.1, 1.95, -0.1], [-0.15, 1.4, 0.35]]) p.add(crown, dy > 1.5 ? 0x93a874 : 0x7f9663, ox + dx, dy, oz + dz);
    const outside = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    outside.castShadow = shadows; outside.receiveShadow = true;
    group.add(outside);
    yield;

    // ---- the inside, seen through the glass: self-lit in warm light
    const q = new Parts();
    const IZ0 = ZB + 0.17, ID = ZG - 0.06 - IZ0, IW = GX1 - GX0, IX = (GX0 + GX1) / 2, IH = YG - Y0;
    q.box(IW, 0.02, ID, 0x8a5e3a, IX, Y0 + 0.01, IZ0 + ID / 2);                       // the floor
    q.box(IW, IH, 0.02, 0xa86f40, IX, Y0 + IH / 2, IZ0 + 0.01);                        // the back wall
    q.box(0.02, IH, ID, 0x9c6638, GX0 + 0.05, Y0 + IH / 2, IZ0 + ID / 2);              // the ends
    q.box(0.02, IH, ID, 0x9c6638, GX1 - 0.05, Y0 + IH / 2, IZ0 + ID / 2);
    q.box(IW, 0.02, ID, 0x9a6a40, IX, YG - 0.08, IZ0 + ID / 2);                        // the ceiling
    // the bedroom: the glowing shelf over two beds
    const bx0 = GX0 + 0.15, bx1 = -0.75, bw = bx1 - bx0, bxm = (bx0 + bx1) / 2;
    q.box(bw, 0.05, 0.22, 0x7a5634, bxm, Y0 + 1.15, IZ0 + 0.12);
    q.box(bw, 0.05, 0.02, 0xfff2c8, bxm, Y0 + 1.2, IZ0 + 0.03);
    q.box(bw, 0.3, 0.01, 0xffb257, bxm, Y0 + 1.37, IZ0 + 0.025);
    q.box(bw, 0.4, 0.01, 0xd98a48, bxm, Y0 + 1.72, IZ0 + 0.025);
    q.box(bw, 0.35, 0.01, 0xe09650, bxm, Y0 + 0.95, IZ0 + 0.025);
    for (const dx of [-0.5, 0.5]) {
      q.box(0.98, 0.42, 1.95, 0xf4efe4, bxm + dx * 1.0, Y0 + 0.21, IZ0 + 1.0);
      q.box(0.6, 0.14, 0.32, 0xfffdf6, bxm + dx * 1.0, Y0 + 0.49, IZ0 + 0.25);
    }
    q.box(1.98, 0.05, 0.75, 0x9a9478, bxm, Y0 + 0.44, IZ0 + 1.55);
    // the wood stove with its fire, the pipe up through the ceiling
    const fire = new THREE.Color(0xff7a1a).multiplyScalar(D.fire / D.glow);
    q.box(0.55, 0.8, 0.5, 0x1a1a1c, -0.35, Y0 + 0.55, IZ0 + 0.55);
    q.box(0.3, 0.26, 0.02, fire.getHex(), -0.35, Y0 + 0.6, IZ0 + 0.81);
    q.box(0.14, YG - Y0 - 0.95, 0.14, 0x1a1a1c, -0.35, (Y0 + 0.95 + YG) / 2, IZ0 + 0.55);
    q.box(0.82, 0.45, 0.82, 0xf0e6d4, 0.75, Y0 + 0.23, IZ0 + 1.6);                      // an armchair
    // the kitchen at the back right: counter, cupboards over it with a light strip under them
    q.box(2.1, 0.9, 0.6, 0x8a8279, 2.65, Y0 + 0.45, IZ0 + 0.3);
    q.box(2.1, 0.65, 0.34, 0xb88a5a, 2.65, Y0 + 1.85, IZ0 + 0.17);
    q.box(2.1, 0.03, 0.05, 0xfff0c8, 2.65, Y0 + 1.51, IZ0 + 0.3);
    q.box(2.1, 0.58, 0.01, 0xf0a050, 2.65, Y0 + 1.2, IZ0 + 0.025);                     // the lit splashback
    // the dining table at the front right with four chairs, and lamps hanging over it
    q.box(1.5, 0.05, 0.8, 0xb5864f, 3.05, Y0 + 0.74, IZ0 + 1.85);
    for (const [dx, dz] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) q.box(0.05, 0.72, 0.05, 0x5d4430, 3.05 + dx, Y0 + 0.36, IZ0 + 1.85 + dz);
    for (const [dx, dz] of [[-0.35, -0.6], [0.35, -0.6], [-0.35, 0.6], [0.35, 0.6]]) {
      q.box(0.42, 0.05, 0.42, 0x6e5038, 3.05 + dx, Y0 + 0.45, IZ0 + 1.85 + dz);
      q.box(0.42, 0.45, 0.04, 0x6e5038, 3.05 + dx, Y0 + 0.7, IZ0 + 1.85 + dz + (dz > 0 ? 0.2 : -0.2));
    }
    for (const [x, z] of [[2.75, IZ0 + 1.85], [3.35, IZ0 + 1.85], [0.75, IZ0 + 1.5]]) {
      q.box(0.012, 0.55, 0.012, 0x2a2420, x, YG - 0.36, z);
      q.add(new THREE.IcosahedronGeometry(0.11, 1), 0xfff1cf, x, YG - 0.7, z);
    }
    for (let k = 0; k < 6; k++) q.box(0.12, 0.012, 0.12, 0xfff4dc, GX0 + 0.8 + k * 1.35, YG - 0.095, IZ0 + 0.9);
    // (not tone mapped: the warm light reads as light, as in their photo, not as brown paint)
    const inside = q.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, toneMapped: false }));
    { const col = inside.geometry.attributes.color.array; for (let i = 0; i < col.length; i++) col[i] *= D.glow; }
    group.add(inside);

    // the glass: one sheet over the front, faintly mirroring the evening sky at the top
    const glassGeo = new THREE.PlaneGeometry(GX1 - GX0, YG - Y0);
    const sky = new THREE.Color(0x7c6aa8), low = new THREE.Color(0x141220), cols = [];
    for (let i = 0; i < 4; i++) { const c = i < 2 ? sky : low; cols.push(c.r, c.g, c.b); }
    glassGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const glass = new THREE.Mesh(glassGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.16, depthWrite: false, fog: true }));
    glass.position.set((GX0 + GX1) / 2, (Y0 + YG) / 2, ZG - 0.005);
    glass.renderOrder = 2;
    group.add(glass);
    yield;

    // ---- the sign on the roof (after the bundled font has loaded, so the name is drawn in it)
    yield* waitFor(font);
    yield 'frame';
    const twin = D.sign === 'twin', letters = D.sign === 'letters';
    const SW = letters ? 8.2 : 7.4, SH = letters ? 1.15 : 1.46;
    const tex = signTex(D.sign, SW, SH);
    // (not tone mapped: the cyan and purple stay as bright as painted, like the LAP START board's neon)
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true, side: THREE.FrontSide, toneMapped: false });
    const sy = YT + (letters ? 0.2 : 0.32) + SH / 2, sz = letters ? ZF - 0.25 : 0.25;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), mat);
    front.position.set(0, sy, sz + 0.07);
    front.renderOrder = 3;
    group.add(front);
    if (twin) {
      const rear = new THREE.Mesh(front.geometry, mat);
      rear.position.set(0, sy, sz - 0.07); rear.rotation.y = Math.PI; rear.renderOrder = 3;
      group.add(rear);
    }
    // what holds it: a dark back board and two posts (the panels), a thin rail and brackets (the letters)
    const s = new Parts();
    if (letters) {
      s.box(SW - 0.3, 0.07, 0.07, 0x101014, 0, YT + 0.18, sz - 0.04);
      for (const x of [-3.2, -1.1, 1.1, 3.2]) s.box(0.05, 0.2, 0.05, 0x101014, x, YT + 0.1, sz - 0.04);
    } else {
      s.box(SW + 0.14, SH + 0.14, 0.12, 0x15101f, 0, sy, sz);
      for (const x of [-SW * 0.33, SW * 0.33]) s.box(0.12, 0.34, 0.12, 0x101014, x, YT + 0.17, sz);
    }
    const holder = s.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    holder.castShadow = shadows;
    group.add(holder);
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
      const [ax, az] = toWorld(X0 - 1, ZB - 1), [bx, bz] = toWorld(X1 + 2, ZF + DECK + 1);
      if (!world.ready(ax, az) || !world.ready(bx, bz)) return;
      built = true;
      // (placed before it joins the scene: a still group works out where it is once)
      let gy = Infinity;          // the gravel bed sits at the lowest ground under the lot, so nothing floats
      for (const [lx, lz] of [[X0 - 0.8, ZB - 0.8], [X1 + 1.6, ZB - 0.8], [X0 - 0.8, ZF + DECK + 0.8], [X1 + 1.6, ZF + DECK + 0.8], [0, 0]]) {
        const [x, z] = toWorld(lx, lz); gy = Math.min(gy, world.heightAt(x, z));
      }
      group.position.set(SPOT.x, gy, SPOT.z);
      group.rotation.y = SPOT.yaw;
      scene.add(group);
      // the cabin and its deck stop the cars
      const [cx, cz] = toWorld((X0 + X1 + DECK_R) / 2, (ZB + ZF + DECK) / 2);
      world.addSolids([{ x: cx, z: cz, yaw: SPOT.yaw, hx: (X1 - X0 + DECK_R) / 2, hz: (ZF - ZB + DECK) / 2 }]);
      jobs.add(build, 'winbaum');
    },
  };
}
