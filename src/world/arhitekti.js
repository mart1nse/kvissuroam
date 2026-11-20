// Arhitekti tänav 24, 26 and 28 in Tartu and their stretch of street, built by hand from Martin's Street View
// screenshots (August 2023, 37 shots), the Land Board's oblique photos (May 2023, April 2024) and the 10 cm
// orthophoto, in place of the map's blocks:
//  - 24 and 26 are the two halves of a stepped 1960s-style terrace with flat roofs: a one-storey front block
//    with roof terraces on it (24: sage green render peeling to grey, a dark door and a red board garage door;
//    26: grey render and a wide weathered plank garage door), the set-back middle storeys (24 beige with the
//    red-framed terrace door, 26 white with the blue-glazed window), the plastered chimney with its brick top
//    between them, 24's tall grey box at the north end, 26's tall white box at the south end with the
//    corrugated canopy over the shed and the raised porch.
//  - 28 is the pale silicate-brick block with concrete lintels, the brick porch annex with its steps and
//    brown door, and the boarded garage door the grass track leads to.
//  - The gardens: 24's tall front hedge on its low rubble edging, the arched brown picket gate with the red
//    mailbox and the dog sign, its dark drive and lawn; the bush row between the drives; 26's clipped street
//    hedge, its weathered wooden gate with the house number, the paver path where the grey Mazda stands,
//    the lawn with three apple trees and the black bin; 28's overgrown lilacs and purple shrubs, the rusty
//    mesh car gate, the slab path and the black mailbox on its post.
//  - The street: the concrete kerb on the house side, the slab pavement in front of 24, gravel and grass
//    verges, the worn sandy edge on the wild west side with its slim lamp posts and a grey cabinet, and the
//    silver saloon parked at the kerb. No street name is painted on the road (the one in Street View is
//    Google's label).
// Everything is in map coordinates: the street runs almost exactly south (+z); its frame R gives t = z and
// lat = metres east of the centre line (the house side). Heights are map heights.
import * as THREE from 'three';
import { greyBack } from './signback.js';
import { roadFrame, streetKit, setHouseColours, lawnTex } from './streetkit.js';
import { createAtlas, painter, tone } from './houseskin.js';
import { BOX, rnd } from '../race/landmarks.js';

const R = roadFrame([[-993.5, 3936.3], [-992.8, 3941.7], [-984.6, 4270.8]], 1);
const Z0 = 4108, Z1 = 4200;                 // the stretch of street that is dressed
const KERB = 2.1, WEST = -2.9;               // the asphalt: 5 m between the kerb (east) and the worn west edge
const CENTRE = [-968, 4156];
const LIGHT = 0;
const latAt = (x, z) => x - R.at(z, 0)[0];   // the street is straight enough here for lat = x - centre x

// ---------------------------------------------------------------- what the map's own data needs
// The map's blocks for the three houses (LOD2 bases in cm, sector -1_7) are replaced by the ones built here.
export function arhitektiWalls(walls) {
  setHouseColours(walls, '-1_7', -1440, 3680, [
    { base: 3318, x: -963.4, z: 4141.3, wall: 0xd3cebd, hide: true, reach: 9.5 },      // 24
    { base: 3319, x: -962.0, z: 4153.5, wall: 0xefeee8, hide: true, reach: 10.5 },     // 26
    { base: 3614, x: -968.6, z: 4156.6, wall: 0xefeee8, hide: true, reach: 5.5 },      // 26's canopy
    { base: 3486, x: -955.2, z: 4149.4, wall: 0xd9d6cc, hide: true, reach: 4.5 },      // 26's back extension
    { base: 3330, x: -965.0, z: 4177.0, wall: 0xe3ddcc, hide: true, reach: 13.5 },     // 28
  ]);
}
// The slim lamp posts on the west verge, arms over the road, and nothing else of the map's in the way.
export function arhitektiProps() {
  return [4121, 4155.5, 4189].map((z) => [LIGHT, ...R.at(z, -3.75), 90]);
}
// Parked cars for src/world/parked.js: [x, z, yaw, id, paint, lift]. The silver saloon at the kerb in front of
// 26 facing north (the Street View car is a Nissan Primera; the Accord is the nearest saloon the game has),
// 26's grey saloon nose-in on the pavers before the plank garage door.
const north = Math.atan2(-R.dir(4155)[0], R.dir(4155)[1]);
export const ARHITEKTI_CARS = [
  [...R.at(4155.2, 1.12), north, 'accord', 'silver', 0.02],
  [-972.7, 4149.55, Math.PI / 2, 'mazda6', 'grey', 0.08],
];

// ---------------------------------------------------------------- colours
const COL = {
  grey24: '#d3cebd', beige24: '#ddd2b6', green: '#d0d9b6', grey26: '#cfcdc4', white: '#efeee8', white2: '#e9e8e1',
  brick: [226, 220, 204], plinth: '#a4a29b', coping: '#80503f', frame: '#f3f3f0', glass: '#56677e', blueGlass: '#4b66ad',
  roof: 0xb8b7be, roofEdge: 0x8d8c94, terrace: 0x6f6b6e, copingHex: 0x80503f, chimney: 0xd9d4c6, chimneyTop: 0xa8553f,
  porch: 0x646b61, porchTop: 0xbab6b0, step: 0xb3afaa, canopy: 0xc4c8cc, wood: 0xc59159, post: 0x8d6a48,
  kerb: 0xc2c0bf, picket: [96, 62, 48], pickedGrey: [158, 151, 140], gateRed: 0x8b3e33, rust: 0x5d4b40,
  mailRed: 0x8a2a2c, mailBlack: 0x26262b, bin: 0x26272b, cabinet: 0xb9bcc0, apple: 0xc2353a, appleGreen: 0x9fba4c,
  tub: 0xb4c83c, stone: [0x9d9a96, 0xb2aea8, 0x8c8986, 0xa8a097],
};

// ---------------------------------------------------------------- painted walls
// A wall is a flat rectangle from a to b (seen from outside, a on the left) from y0 to y1 above the house's
// ground line gy, painted in metres by draw(P) (x along the wall from a, y up from gy) into a shared atlas.
export function facadeKit(group, shadows) {
  const atlas = createAtlas(2048), jobs = [];
  function wall(a, b, gy, y0, y1, base, draw, { ppm = 36, off = 0.025 } = {}) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const q = Math.min(ppm, 1400 / len, 1400 / (y1 - y0));
    const pw = Math.max(4, Math.round(len * q)), ph = Math.max(4, Math.round((y1 - y0) * q));
    const rect = atlas.take(pw, ph), c = atlas.pages[rect.k].c;
    c.save();
    c.beginPath(); c.rect(rect.x - 2, rect.y - 2, pw + 4, ph + 4); c.clip();
    c.fillStyle = base; c.fillRect(rect.x - 2, rect.y - 2, pw + 4, ph + 4);
    const P = painter(c, rect.x, rect.y, len, y0, y1, pw / len);
    draw(P, len);
    c.restore();
    jobs.push({ a, b, gy, y0, y1, len, rect, pw, ph, off });
  }
  function finish() {
    const S = atlas.size;
    atlas.pages.forEach((pg, pk) => {
      const pos = [], nor = [], uv = [];
      for (const j of jobs) {
        if (j.rect.k !== pk) continue;
        const ux = (j.b[0] - j.a[0]) / j.len, uz = (j.b[1] - j.a[1]) / j.len, nx = -uz, nz = ux;
        const P = (s, y) => [j.a[0] + ux * s + nx * j.off, j.gy + y, j.a[1] + uz * s + nz * j.off];
        const U = (s, y) => [(j.rect.x + s / j.len * j.pw) / S, 1 - (j.rect.y + (j.y1 - y) / (j.y1 - j.y0) * j.ph) / S];
        const q = [[0, j.y0], [j.len, j.y0], [j.len, j.y1], [0, j.y1]];
        for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(...P(...q[k])); nor.push(nx, 0, nz); uv.push(...U(...q[k])); }
      }
      if (!pos.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const tex = new THREE.CanvasTexture(pg.cv);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex }));
      m.receiveShadow = shadows;
      group.add(m);
    });
  }
  return { wall, finish };
}

// render with faint mottling and rain streaks
export function render(P, len, y0, y1, col, seed, weather = 0.7) {
  const r = rnd(seed);
  P.r(0, y0, len, y1, col);
  for (let k = 0; k < len * (y1 - y0) * 0.6; k++) {
    const x = r() * len, y = y0 + r() * (y1 - y0);
    P.r(x, y, x + 0.3 + r() * 1.4, y + 0.2 + r() * 0.7, `rgba(${r() < 0.5 ? '255,252,244' : '80,76,70'},${0.03 + r() * 0.04})`);
  }
  if (weather) P.weather(0, y0, len, y1, weather, seed + 1);
}
// render that has come away in places, showing grey base coat with a darker rim
function peel(P, x, y, w, h, seed, under = '#a9a8a2') {
  const r = rnd(seed);
  for (let k = 0; k < 5; k++) {
    const cx = x + r() * w, cy = y + r() * h, rx = (0.15 + r() * 0.35) * Math.max(w, 0.5), ry = (0.1 + r() * 0.25) * Math.max(h, 0.5);
    const ks = Array.from({ length: 12 }, () => 0.75 + r() * 0.4);
    for (const [grow, col] of [[1.12, 'rgba(110,104,96,0.35)'], [1, under]]) {
      P.poly(ks.map((k2, a) => { const t = a / 12 * Math.PI * 2; return [cx + Math.cos(t) * rx * k2 * grow, cy + Math.sin(t) * ry * k2 * grow]; }), col);
    }
  }
}
// a white PVC window of two (or more) casements, with a sill
export const win = (P, x0, ya, x1, yb, { glass = COL.glass, bars = 1, frame = COL.frame, sill = 0.05 } = {}) =>
  P.win(x0, ya, x1, yb, { frame, glass, fw: 0.07, bars, T: false, surround: 0, sill, sc: '#d8d6d0' });
// a plain door leaf in a frame, from the ground line y up
export function door(P, x0, x1, y, h, col, { frame = '#3c3a38', glass = null, boards = 0, handle = '#c9c9c9' } = {}) {
  P.r(x0 - 0.06, y, x1 + 0.06, y + h + 0.06, frame);
  P.r(x0, y, x1, y + h, col);
  if (boards) for (let x = x0 + boards; x < x1 - 0.01; x += boards) P.r(x - 0.012, y, x + 0.012, y + h, tone(hex(col), 0.72));
  if (glass) P.r(x0 + 0.12, y + h * 0.55, x1 - 0.12, y + h - 0.12, glass);
  P.r(x1 - 0.14, y + h * 0.47, x1 - 0.09, y + h * 0.5, handle);
}
export const hex = (css) => { const n = parseInt(css.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
// weathered vertical planks
export function planks(P, x0, y0, x1, y1, rgb, seed, pitch = 0.11) {
  const r = rnd(seed);
  for (let x = x0; x < x1; x += pitch) {
    const v = 0.8 + r() * 0.35;
    P.r(x, y0, Math.min(x1, x + pitch - 0.012), y1, tone(rgb, v));
    for (let k = 0; k < 3; k++) { const y = y0 + r() * (y1 - y0); P.r(x + 0.02, y, x + 0.03, y + 0.2 + r() * 0.4, tone(rgb, 0.6)); }
  }
}
// a black lantern on the wall
export function lantern(P, x, y) {
  P.r(x - 0.03, y - 0.05, x + 0.03, y + 0.15, '#2a2a2e');
  P.poly([[x - 0.09, y + 0.05], [x + 0.09, y + 0.05], [x + 0.07, y - 0.2], [x - 0.07, y - 0.2]], '#2c2c31');
  P.r(x - 0.05, y - 0.16, x + 0.05, y + 0.02, '#d9d2b8');
}

// The street has no painted lines along the dressed stretch: the map's centre dashes and edge lines go.
export function arhitektiVectors(vectors) {
  const prev = vectors.markSkip;
  vectors.markSkip = (x, z) => {
    if (z > Z0 - 8 && z < Z1 + 10) { const [cx] = R.at(z, 0); if (Math.abs(x - cx) < 4.5) return true; }
    return prev ? prev(x, z) : false;
  };
}

// ---------------------------------------------------------------- the build
export function createArhitekti(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  // keep the map's trees out of the three front gardens; the real ones are planted here instead
  world.addClearing({ x0: -985, z0: 4127.5, x1: -957, z1: 4190 });
  const TREES = [
    // apple trees in 26's lawn, the big ones nearest the house
    [-977.4, 4157.4, 5.6, 5.4, 0], [-972.4, 4156.0, 5.2, 4.6, 0], [-980.5, 4161.2, 4.3, 3.4, 0],
    // 24's lawn behind its hedge: a young fruit tree
    [-976.0, 4133.5, 4.2, 3.4, 0],
    // 28: an apple tree before the house (red apples at the top window), a tall maple at the south corner, a birch
    [-972.6, 4180.6, 6.2, 5.2, 0], [-979.2, 4186.8, 9.5, 6.5, 0], [-975.0, 4169.0, 7.5, 3.6, 1],
  ];
  world.addTrees(TREES);

  function build() {
    built = true;
    const K = streetKit(world, group, { shadows, fenceColour: 0x4f4c4a });
    const { p } = K;
    const h = (x, z) => world.heightAt(x, z);
    const F = facadeKit(group, shadows);
    // a box by its extents; y0, y1 are heights above gy
    const block = (x0, x1, z0, z1, gy, y0, y1, c) => p.add(BOX(x1 - x0, y1 - y0, z1 - z0), c, (x0 + x1) / 2, gy + (y0 + y1) / 2, (z0 + z1) / 2);
    const bar = (a, b, t, c) => {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va), len = d.length();
      const g = BOX(t, len, t);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
      g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
      p.add(g, c, 0, 0, 0);
    };
    // a flat roof with its edge flashing
    const flatRoof = (x0, x1, z0, z1, gy, y, c = COL.roof) => {
      block(x0 + 0.05, x1 - 0.05, z0 + 0.05, z1 - 0.05, gy, y, y + 0.06, c);
      block(x0 - 0.04, x1 + 0.04, z0 - 0.04, z0 + 0.06, gy, y - 0.12, y + 0.1, COL.roofEdge);
      block(x0 - 0.04, x1 + 0.04, z1 - 0.06, z1 + 0.04, gy, y - 0.12, y + 0.1, COL.roofEdge);
      block(x0 - 0.04, x0 + 0.06, z0, z1, gy, y - 0.12, y + 0.1, COL.roofEdge);
      block(x1 - 0.06, x1 + 0.04, z0, z1, gy, y - 0.12, y + 0.1, COL.roofEdge);
    };
    // the four sides of a box as painted walls: draws = { w, n, e, s } (null: plain render of colour col)
    const walls4 = (x0, x1, z0, z1, gy, y0, y1, col, seed, draws = {}) => {
      const sides = {
        w: [[x0, z0], [x0, z1]], s: [[x0, z1], [x1, z1]], e: [[x1, z1], [x1, z0]], n: [[x1, z0], [x0, z0]],
      };
      for (const [k, [a, b]] of Object.entries(sides)) {
        if (draws[k] === false) continue;
        F.wall(a, b, gy, y0, y1, col, (P, len) => {
          render(P, len, y0, y1, col, seed + k.charCodeAt(0));
          if (draws[k]) draws[k](P, len);
        });
      }
    };

    // ================= 24 and 26: the stepped terrace =================
    const G = h(-963, 4150) - 0.02;                       // the terrace's ground line
    const T = 2.9;                                         // the front block's roof terrace
    // ---- 24's tall north box
    block(-966.9, -957.8, 4135.4, 4142.2, G, -0.6, 7.6, 0xd3cebd);
    flatRoof(-966.9, -957.8, 4135.4, 4142.2, G, 7.6);
    walls4(-966.9, -957.8, 4135.4, 4142.2, G, -0.3, 7.6, COL.grey24, 11, {
      w: (P) => { P.r(0, -0.3, 6.8, 0.35, COL.plinth); win(P, 3.5, 1.0, 4.95, 2.3); win(P, 3.5, 4.45, 4.95, 5.75); },
      n: (P) => { P.r(0, -0.3, 9.1, 0.35, COL.plinth); win(P, 2.6, 4.45, 3.8, 5.6); win(P, 6.2, 1.1, 7.2, 2.2); },
      e: (P) => { P.r(0, -0.3, 6.8, 0.35, COL.plinth); win(P, 1.4, 1.0, 2.8, 2.3); win(P, 1.4, 4.4, 2.8, 5.7); win(P, 4.2, 4.4, 5.4, 5.7); },
      s: (P) => { P.r(0, -0.3, 9.1, 0.35, COL.plinth); win(P, 6.6, T + 0.9, 7.8, T + 2.2); P.r(5.8, T - 0.05, 9.1, T + 0.03, '#9b958c'); },
    });
    // ---- the front block: 24's sage green half and 26's grey half, roof terraces on top
    block(-969.1, -963.6, 4142.2, 4147.3, G, -0.6, T, 0xd0d9b6);
    block(-969.05, -963.5, 4147.3, 4153.25, G, -0.6, T, 0xcfcdc4);
    F.wall([-969.1, 4142.2], [-969.1, 4147.3], G, -0.3, T + 0.02, COL.green, (P, len) => {
      render(P, len, -0.3, T + 0.02, COL.green, 21, 0.9);
      peel(P, 0.5, 1.5, 1.1, 0.8, 3); peel(P, 1.6, 2.0, 0.6, 0.5, 5); peel(P, 3.1, 1.9, 0.8, 0.6, 7); peel(P, 2.6, 0.2, 0.5, 0.4, 9);
      door(P, 2.15, 2.98, 0, 1.95, '#35302e', { frame: '#2b2827' });
      P.r(2.3, -0.3, 3.0, 0.02, '#a7a49f');                                                  // the door step
      door(P, 3.9, 4.85, 0, 1.92, '#8d4136', { frame: '#6f342c', boards: 0.12, handle: '#58302a' });
      P.r(1.72, 2.02, 1.84, 2.12, '#a9a9ad');                                                // a meter box
      P.r(0, T - 0.07, len, T + 0.02, COL.coping);
    });
    F.wall([-969.05, 4147.3], [-969.05, 4153.25], G, -0.3, T + 0.02, COL.grey26, (P, len) => {
      render(P, len, -0.3, T + 0.02, COL.grey26, 23, 0.9);
      peel(P, 4.1, 1.9, 1.2, 0.7, 13); peel(P, 0.9, 2.2, 2.4, 0.35, 15);
      planks(P, 0.9, 0, 3.4, 2.0, [112, 86, 58], 4, 0.13);                                 // the wide plank garage door
      P.r(0.85, 1.98, 3.45, 2.06, '#5e4632');
      P.r(0.7, 2.06, 3.6, 2.3, '#b3afa6');                                                 // its lintel, render broken off
      lantern(P, 4.5, 2.35);
      P.r(0, T - 0.07, len, T + 0.02, '#8f8a82');
    });
    // its north end beside 24's tall box, and the little sage green box at the foot of it
    F.wall([-966.9, 4142.2], [-969.1, 4142.2], G, -0.3, T + 0.02, COL.green, (P, len) => { render(P, len, -0.3, T + 0.02, COL.green, 25, 0.8); P.r(0, T - 0.07, len, T + 0.02, COL.coping); });
    block(-969.75, -969.1, 4142.3, 4143.75, G, -0.4, 1.12, 0xd0d9b6);
    F.wall([-969.75, 4142.3], [-969.75, 4143.75], G, -0.3, 1.12, COL.green, (P, len) => { render(P, len, -0.3, 1.12, COL.green, 27, 0.6); P.r(0, 1.04, len, 1.12, COL.coping); });
    F.wall([-969.1, 4142.3], [-969.75, 4142.3], G, -0.3, 1.12, COL.green, (P, len) => { render(P, len, -0.3, 1.12, COL.green, 29, 0.6); P.r(0, 1.04, len, 1.12, COL.coping); });
    block(-969.8, -969.05, 4142.25, 4143.8, G, 1.1, 1.16, COL.copingHex);
    // the terraces: dark floors, a brown coping on the edge, the dividing wall with its sloping top
    block(-969.0, -963.6, 4142.25, 4153.2, G, T, T + 0.03, COL.terrace);
    for (const [z0, z1, c] of [[4142.2, 4147.3, COL.copingHex], [4147.3, 4153.25, 0x9a958d]]) block(-969.15, -968.9, z0, z1, G, T - 0.02, T + 0.12, c);
    block(-969.15, -966.9, 4142.15, 4142.4, G, T - 0.02, T + 0.12, COL.copingHex);
    { // the divider: 1.3 m high by the house, 0.5 m at the front edge
      const g = new THREE.BufferGeometry(), x0 = -968.9, x1 = -963.6, za = 4147.18, zb = 4147.42, ya = G + T + 0.5, yb = G + T + 1.3, yl = G + T;
      const q = [[x0, yl, za], [x1, yl, za], [x1, yb, za], [x0, ya, za], [x0, yl, zb], [x1, yl, zb], [x1, yb, zb], [x0, ya, zb]];
      const f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [3, 7, 6], [3, 6, 2], [0, 4, 7], [0, 7, 3]];
      const pos = []; for (const t of f) for (const i of t) pos.push(...q[i]);
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      p.add(g, 0xd8d3c6, 0, 0, 0);
    }
    // ---- the set-back middle storeys: 24 beige, 26 white
    block(-963.6, -957.8, 4142.2, 4147.3, G, -0.6, 6.15, 0xddd2b6);
    flatRoof(-963.6, -957.8, 4142.2, 4147.3, G, 6.15);
    F.wall([-963.6, 4142.2], [-963.6, 4147.3], G, T, 6.15, COL.beige24, (P, len) => {
      render(P, len, T, 6.15, COL.beige24, 31, 0.8);
      door(P, 0.5, 1.35, T + 0.03, 2.0, '#7a2a25', { frame: '#6a2420', glass: '#9fa7ad' });      // the red-framed terrace door
      lantern(P, 1.78, T + 2.25);
      win(P, 2.55, T + 0.95, 3.95, T + 2.05);
    });
    F.wall([-957.8, 4147.3], [-957.8, 4142.2], G, -0.3, 6.15, COL.beige24, (P, len) => { render(P, len, -0.3, 6.15, COL.beige24, 33); win(P, 1.6, 1.0, 3.4, 2.3); win(P, 1.6, 3.9, 3.4, 5.2); });
    block(-963.5, -957.7, 4147.3, 4152.8, G, -0.6, 6.9, 0xe9e8e1);
    flatRoof(-963.5, -957.7, 4147.3, 4152.8, G, 6.9);
    F.wall([-963.5, 4147.3], [-963.5, 4152.8], G, T, 6.9, COL.white2, (P, len) => {
      render(P, len, T, 6.9, COL.white2, 35, 0.6);
      win(P, 1.15, T + 0.65, 2.45, T + 1.8, { glass: COL.blueGlass });
      win(P, 4.3, 5.45, 4.65, 6.05, { bars: 0, glass: '#3d4552' });
      P.r(4.85, 4.95, 5.0, 5.12, '#e9d27a');                                                // the small yellow wall light
    });
    F.wall([-957.7, 4152.8], [-957.7, 4147.3], G, -0.3, 6.9, COL.white2, (P, len) => { render(P, len, -0.3, 6.9, COL.white2, 37); win(P, 1.4, 3.9, 3.0, 5.3); });
    // the plastered chimney with its brick top between the two halves, a vent stack on 26's middle roof
    block(-964.25, -963.55, 4146.95, 4147.65, G, T, 7.2, COL.chimney);
    block(-964.3, -963.5, 4146.9, 4147.7, G, 7.2, 7.75, COL.chimneyTop);
    block(-964.35, -963.45, 4146.85, 4147.75, G, 7.75, 7.83, 0x8b8a90);
    block(-962.9, -962.1, 4151.95, 4152.78, G, 6.9, 7.75, 0xe6e5de);
    // ---- 26's tall south box, its raised porch and the canopy over porch and shed
    block(-966.1, -957.1, 4152.8, 4159.8, G, -0.6, 7.7, 0xefeee8);
    flatRoof(-966.1, -957.1, 4152.8, 4159.8, G, 7.7);
    walls4(-966.1, -957.1, 4152.8, 4159.8, G, -0.3, 7.7, COL.white, 41, {
      w: (P) => { win(P, 1.6, 4.6, 3.1, 5.95); win(P, 1.7, 2.05, 3.0, 3.25); door(P, 5.0, 5.95, 1.22, 2.05, '#4d3b31', { frame: '#3a2d26', glass: '#55606c' }); },
      s: (P) => { P.r(0, -0.3, 9, 0.3, COL.plinth); win(P, 2.0, 4.6, 3.3, 5.9); win(P, 5.5, 4.6, 6.8, 5.9); win(P, 3.0, 1.0, 4.4, 2.3); },
      e: (P) => { P.r(0, -0.3, 7, 0.3, COL.plinth); win(P, 2.0, 1.0, 4.6, 2.4, { bars: 2 }); win(P, 2.4, 4.5, 4.2, 5.9); },
      n: false,
    });
    F.wall([-957.1, 4152.8], [-963.5, 4152.8], G, 6.9, 7.7, COL.white, (P, len) => render(P, len, 6.9, 7.7, COL.white, 43));
    F.wall([-963.5, 4152.8], [-966.1, 4152.8], G, 4.35, 7.7, COL.white, (P, len) => render(P, len, 4.35, 7.7, COL.white, 45));
    // porch: a raised floor 1.2 m up behind a low charcoal wall, four steps up from the path at its north end
    const PF = 1.2;
    block(-969.0, -966.1, 4153.25, 4159.75, G, -0.3, PF, COL.porch);
    block(-969.05, -966.1, 4153.2, 4159.8, G, PF, PF + 0.05, COL.porchTop);
    for (let k = 0; k < 4; k++) block(-970.3 + k * 0.3, -969.0, 4153.3, 4154.5, G, -0.2, (k + 1) * 0.3, COL.step);
    // the shed on 26's terrace: render at its north end, honey boards with a small window
    block(-967.6, -963.5, 4150.7, 4153.2, G, T, 4.35, 0xd8d6cf);
    F.wall([-967.6, 4150.7], [-967.6, 4153.2], G, T, 4.35, '#d8d6cf', (P, len) => {
      render(P, len, T, 4.35, '#d8d6cf', 47, 0.4);
      P.r(0.12, T, 0.78, T + 1.25, '#3a3b40');
      P.boards(0.9, T, len, 4.35, [200, 148, 92], 0.13, true);
      P.r(1.5, T + 0.6, 1.85, T + 1.2, '#2c2f36');
    });
    F.wall([-963.5, 4150.7], [-967.6, 4150.7], G, T, 4.35, '#d8d6cf', (P, len) => { render(P, len, T, 4.35, '#d8d6cf', 49, 0.4); P.boards(0, T, 1.6, 4.35, [200, 148, 92], 0.13, true); });
    // the corrugated sheet canopy, falling a little to the front, on timber posts
    const corrugated = new THREE.MeshLambertMaterial({ map: corrugatedTex(), side: THREE.DoubleSide });
    const sheet = (x0, x1, z0, z1, ya, yb) => {             // ya at x1 (the house), yb at x0 (the front)
      const g = new THREE.BufferGeometry(), q = [[x0, yb, z0], [x1, ya, z0], [x1, ya, z1], [x0, yb, z1]];
      const pos = [], uv = [];
      for (const k of [0, 2, 1, 0, 3, 2]) { pos.push(q[k][0], G + q[k][1], q[k][2]); uv.push(q[k][2] / 1.2, q[k][0] / 1.2); }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, corrugated); m.castShadow = shadows; m.receiveShadow = true; group.add(m);
      block(x0 - 0.05, x0 + 0.03, z0, z1, G, yb - 0.16, yb + 0.02, 0x8f6b4b);                // the fascia board
    };
    sheet(-969.35, -963.5, 4150.5, 4153.25, 4.5, 4.28);
    sheet(-969.35, -966.1, 4153.25, 4159.95, 4.42, 4.28);
    for (const [z, y0] of [[4150.6, T], [4153.35, PF], [4156.6, PF], [4159.85, PF]]) block(-969.33, -969.21, z - 0.06, z + 0.06, G, y0, 4.2, COL.post);
    // ---- 26's back extension
    block(-957.8, -952.6, 4147.15, 4151.6, G, -0.4, 2.75, 0xd9d6cc);
    flatRoof(-957.8, -952.6, 4147.15, 4151.6, G, 2.75);
    walls4(-957.8, -952.6, 4147.15, 4151.6, G, -0.3, 2.75, '#d9d6cc', 51, { w: false, e: (P) => win(P, 1.2, 0.9, 2.6, 2.0) });

    // ================= 28: the silicate brick block =================
    const G8 = h(-962, 4176) - 0.02, H8 = 9.6;
    const brick = (P, len, y0, y1, seed) => { P.brick(0, y0, len, y1, COL.brick, seed); P.weather(0, y0, len, y1, 0.5, seed + 3); };
    // a window with the concrete lintel over it that runs a little wider
    const win8 = (P, x0, ya, x1, yb) => { P.r(x0 - 0.18, yb + 0.02, x1 + 0.18, yb + 0.24, '#c9c6bf'); P.r(x0 - 0.05, ya - 0.08, x1 + 0.05, ya, '#bdbab3'); win(P, x0, ya, x1, yb, { sill: 0 }); };
    const storeys = [0.95, 3.95, 6.95];
    block(-968.0, -956.9, 4170.1, 4181.7, G8, -0.6, H8, 0xe3ddcc);
    flatRoof(-968.0, -956.9, 4170.1, 4181.7, G8, H8, 0xa9a8ae);
    block(-962.5, -959.4, 4181.6, 4184.0, G8, -0.6, H8 - 0.35, 0xe3ddcc);
    flatRoof(-962.5, -959.4, 4181.6, 4184.0, G8, H8 - 0.35, 0xa9a8ae);
    const wall8 = (a, b, y1, seed, draw) => F.wall(a, b, G8, -0.4, y1, '#e2dccb', (P, len) => {
      brick(P, len, -0.4, y1, seed);
      P.r(0, -0.4, len, 0.45, '#a9a7a0');                                                  // the concrete plinth
      P.r(0, y1 - 0.12, len, y1, '#9c9a9f');
      draw(P, len);
    });
    wall8([-968.0, 4170.1], [-968.0, 4181.7], H8, 61, (P) => {
      for (const y of storeys.slice(1)) { win8(P, 1.8, y, 3.2, y + 1.4); win8(P, 8.3, y, 9.7, y + 1.4); }
      win8(P, 8.5, storeys[0], 9.7, storeys[0] + 1.3);
      P.r(0.62, 0, 3.18, 2.32, '#3d3b3a');                                                 // the boarded garage door
      planks(P, 0.7, 0, 3.1, 2.25, [78, 76, 76], 6, 0.15);
    });
    wall8([-956.9, 4170.1], [-968.0, 4170.1], H8, 63, (P) => {
      win8(P, 5.8, 3.2, 6.4, 6.3);                                                         // the tall stair window
      for (const y of storeys) win8(P, 2.0, y, 3.3, y + 1.4);
      win8(P, 8.5, storeys[2], 9.7, storeys[2] + 1.4);
    });
    wall8([-968.0, 4181.7], [-962.5, 4181.7], H8, 65, (P) => { for (const y of storeys) win8(P, 1.6, y, 3.0, y + 1.4); });
    wall8([-959.4, 4181.7], [-956.9, 4181.7], H8, 66, () => {});
    wall8([-956.9, 4181.7], [-956.9, 4170.1], H8, 67, (P) => { for (const y of storeys) { win8(P, 1.6, y, 3.2, y + 1.4); win8(P, 7.0, y, 8.6, y + 1.4); } });
    wall8([-962.5, 4181.6], [-962.5, 4184.0], H8 - 0.35, 68, () => {});
    wall8([-962.5, 4184.0], [-959.4, 4184.0], H8 - 0.35, 69, (P) => win8(P, 1.0, 4.3, 2.0, 6.6));
    wall8([-959.4, 4184.0], [-959.4, 4181.6], H8 - 0.35, 70, () => {});
    // the porch annex with the brown door and its steps
    const A8 = 3.6;
    block(-975.9, -968.0, 4173.6, 4177.3, G8, -0.5, A8, 0xe3ddcc);
    flatRoof(-975.9, -968.0, 4173.6, 4177.3, G8, A8, 0x9e9da4);
    wall8([-975.9, 4173.6], [-975.9, 4177.3], A8, 71, (P) => { door(P, 1.35, 2.35, 0.45, 2.1, '#6b4130', { frame: '#4b3026', boards: 0.1 }); win8(P, 2.75, 1.3, 3.3, 2.0); });
    wall8([-968.0, 4173.6], [-975.9, 4173.6], A8, 72, (P) => { win8(P, 2.0, 1.0, 3.2, 2.2); win8(P, 5.0, 1.0, 6.2, 2.2); });
    wall8([-975.9, 4177.3], [-968.0, 4177.3], A8, 73, (P) => { win8(P, 2.4, 1.0, 3.6, 2.2); });
    for (let k = 0; k < 3; k++) block(-977.4 + k * 0.5, -975.9, 4174.5, 4176.2, G8, -0.3, 0.15 * (k + 1), COL.step);

    // ================= the street =================
    const TX = groundTextures(), lay = groundLayer(world, group);
    const yR = (z, lat) => h(...R.at(z, lat));
    // the kerb on the house side, lower at the gates and the drive
    const low = (z) => (z > 4141.1 && z < 4149.4) || (z > 4166.2 && z < 4169.7);
    for (let z = Z0; z < Z1; z += 1) {
      const a = R.at(z, KERB + 0.07), b = R.at(z + 1, KERB + 0.07), y = yR(z + 0.5, KERB);
      const top = low(z + 0.5) ? 0.05 : 0.12;
      p.add(BOX(0.15, top + 0.12, 0.98), COL.kerb, (a[0] + b[0]) / 2, y + (top - 0.12) / 2, (a[1] + b[1]) / 2, -Math.atan2(b[0] - a[0], b[1] - a[1]));
    }
    // west side: the worn sandy edge, then grass under the trees
    lay(TX.sand, R, Z0, Z1, WEST - 0.85, WEST - 0.05, 0.05);
    K.ribbon(R, Z0, Z1, WEST - 0.6, -7.5, 'lawn', true);
    // house side, north to south
    lay(TX.gravel, R, Z0, 4141.1, KERB + 0.15, KERB + 0.95, 0.07);
    K.ribbon(R, Z0, 4128.3, KERB + 0.9, 4.4, 'lawn', true);
    K.ribbon(R, 4128.3, 4141.1, KERB + 0.9, 4.05, 'lawn', true);
    lay(TX.slabs, R, 4141.1, 4147.5, KERB + 0.15, 4.2, 0.085);                                 // the slab pavement in front of 24
    lay(TX.pavers, R, 4147.5, 4150.35, KERB + 0.15, 18.6, 0.085);                              // 26's paver path, from the kerb to the house
    lay(TX.gravel, R, 4150.35, 4163.3, KERB + 0.15, KERB + 0.85, 0.07);
    K.ribbon(R, 4150.35, 4163.3, KERB + 0.8, 4.5, 'lawn', true);
    K.ribbon(R, 4163.3, Z1, KERB + 0.15, 4.6, 'lawn', true);
    lay(TX.soil, R, 4166.3, 4169.6, KERB + 0.15, 18.5, 0.075);                                 // 28's grass track to the garage door
    lay(TX.slabs, R, 4174.85, 4175.85, 4.4, 10.95, 0.085);                                     // 28's slab path to the porch steps
    // 24: the dark drive, the lawn behind the hedge; 26: the pad before the garage, the lawn; 28: the wild lawn
    lay(TX.tarmac, R, 4141.25, 4146.65, 4.25, 18.45, 0.08);
    K.ribbon(R, 4128.6, 4141.25, 6.0, 20.6, 'lawn', true);
    lay(TX.pavers, R, 4150.35, 4153.25, 14.4, 18.5, 0.085);
    K.ribbon(R, 4150.35, 4153.3, 5.6, 14.4, 'lawn', true);
    K.ribbon(R, 4153.3, 4163.3, 5.6, 18.45, 'lawn', true);
    K.ribbon(R, 4163.3, 4166.3, 7.0, 19.5, 'lawn', true);
    K.ribbon(R, 4169.6, 4190, 7.0, 11.7, 'lawn', true);
    K.ribbon(R, 4169.6, 4173.5, 11.7, 19.5, 'lawn', true);
    K.ribbon(R, 4177.4, 4190, 11.7, 19.5, 'lawn', true);
    // a manhole in 24's slabs, a drain grid at the kerb
    for (const [z, lat] of [[4143.4, 3.1]]) { const [x, zz] = R.at(z, lat); p.add(new THREE.CylinderGeometry(0.33, 0.33, 0.03, 16), 0x5c5862, x, h(x, zz) + 0.1, zz); }
    { const [x, z] = R.at(4160.2, KERB - 0.3); p.add(BOX(0.4, 0.03, 0.6), 0x3e3c44, x, h(x, z) + 0.035, z); }

    // ---- 24's front: the low rubble edging, the tall hedge, the brown picket gate and its grey leaf
    const stones = rnd(5);
    for (let z = 4128.6; z < 4141.0; z += 0.3 + stones() * 0.12) {
      const [x, zz] = R.at(z, 4.15), w = 0.26 + stones() * 0.16, hh = 0.16 + stones() * 0.14;
      p.add(new THREE.DodecahedronGeometry(0.5, 0).scale(0.36, hh * 2, w * 1.4), COL.stone[Math.floor(stones() * 4)], x, h(x, zz) + hh * 0.55, zz, stones() * 3);
    }
    const L = K.leafy;
    // a hedge along the street: close-set leafy bushes kept near their own proportions
    // (stretched ones look like weeping willows), in two tiers when it is tall
    const hedge = (z0, z1, lat0, lat1, height, step, tint, wild = 0.2, seed = 1) => {
      const r = rnd(seed), d = lat1 - lat0, mid = (lat0 + lat1) / 2;
      const tiers = height > 2.2 ? [[0, Math.min(1.7, height * 0.62)], [height * 0.45, height * 0.55]] : [[0, height]];
      for (const [lift, th] of tiers) {
        const w = Math.min(Math.max(th * 1.15, d * 1.25, 1.5), 3.0);
        for (let z = z0 + w * 0.3; z < z1 - w * 0.2; z += w * 0.42 * (0.85 + r() * 0.3)) {
          const [x, zz] = R.at(z, mid + (r() - 0.5) * wild * d);
          const k = 1 + (r() - 0.5) * wild, t = tint.map((v) => v * (0.92 + r() * 0.14));
          if (L.ok) L.bush(x, h(x, zz) - 0.06 + lift, zz, w * k, th * k, r() * 6, t, Math.max(d * 1.15, 1.2) * k);
          else p.add(BOX(d, th, w * 0.42), 0x4f8a4a, x, h(x, zz) + lift + th / 2, zz);
        }
      }
    };
    hedge(4128.6, 4141.0, 4.4, 6.1, 2.7, 1.25, [0.78, 0.98, 0.74], 0.5, 3);
    for (let x = -982.4, k = 0; x < -962; x += 0.95, k++) { if (L.ok) L.bush(x, h(x, 4127.8) - 0.06, 4127.8, 2.3, 1.9 + (k % 3) * 0.12, x * 1.7, [0.8, 0.96, 0.76], 1.5); }      // between 22 and 24
    // the bush row between 24's drive and 26's path, taller near the house
    for (let x = -982.6; x < -969.6; x += 0.9) {
      const k = (x + 982.6) / 13, ht = 1.6 + k * 1.1;
      if (L.ok) L.bush(x, h(x, 4147.0) - 0.06, 4147.0, ht * 1.25, ht, x * 2, [0.86, 1.0, 0.8], 1.4 + k * 0.5);
    }
    // 26's clipped street hedge (bare stems at the foot, a flat top 1.75 m up)
    hedge(4150.45, 4163.2, 4.35, 5.45, 1.75, 0.9, [0.95, 1.06, 0.82], 0.05, 7);
    for (let z = 4150.6; z < 4163; z += 0.45) { const [x, zz] = R.at(z, 4.6 + (Math.round(z * 7) % 3) * 0.2); bar([x, h(x, zz), zz], [x, h(x, zz) + 0.45, zz], 0.04, 0x5a4a3a); }
    // 28's overgrown front: lilacs and a purple-leaved shrub, a gap for the car gate and the path
    const thicket = [[4163.4, 4166.2], [4169.8, 4174.6], [4176.1, 4190.0]];
    thicket.forEach(([a, b], i) => hedge(a, b, 5.0, 7.4, 2.7, 1.6, [0.74, 0.92, 0.72], 0.6, 11 + i));
    for (const [z, lat, s] of [[4171.5, 6.4, 3.0], [4186.5, 6.0, 3.4], [4181.2, 5.6, 2.6]]) { const [x, zz] = R.at(z, lat); if (L.ok) L.bush(x, h(x, zz) - 0.05, zz, s, s * 1.05, z, [0.62, 0.42, 0.6], s * 0.9); }
    for (const [x, z, s] of [[-971.0, 4172.3, 2.4], [-969.6, 4184.5, 3.0], [-977.5, 4182.5, 2.2], [-970.0, 4164.0, 2.0]]) if (L.ok) L.bush(x, h(x, z) - 0.05, z, s, s, x, [0.78, 0.94, 0.74], s);
    // 26's lawn: a low shrub by the steps, the green tub, the black bin by the gate
    for (const [x, z, s] of [[-970.2, 4155.4, 1.2], [-981.5, 4151.6, 0.9]]) if (L.ok) L.bush(x, h(x, z) - 0.05, z, s * 1.3, s, x, [0.85, 1, 0.8], s);
    p.add(new THREE.CylinderGeometry(0.52, 0.42, 0.32, 18).scale(1.4, 1, 1), COL.tub, -970.8, h(-970.8, 4153.9) + 0.16, 4153.9);
    { const x = -981.3, z = 4150.95, y = h(x, z);
      p.add(BOX(0.58, 0.98, 0.72), COL.bin, x, y + 0.49, z); p.add(BOX(0.62, 0.06, 0.8), 0x1d1e21, x, y + 1.0, z + 0.02);
      for (const dz of [-0.24, 0.24]) p.add(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 10).rotateX(Math.PI / 2), 0x111114, x + 0.24, y + 0.1, z + dz); }

    // ---- the gates and fences
    const pickets = (a, b, y0, top, rgb, seed, opts) => fenceMesh(group, a, b, y0, top, rgb, seed, opts, shadows);
    const at = (z, lat = 4.2) => R.at(z, lat);
    const gy = (z, lat = 4.2) => yR(z, lat) + 0.08;
    // 24: the brown double gate, its tops dipping a little to the middle, the grey leaf beside it
    pickets(at(4141.25), at(4143.45), gy(4142), (u) => 1.28 - 0.07 * Math.sin(Math.PI * u), COL.picket, 3);
    pickets(at(4143.45), at(4145.65), gy(4144.5), (u) => 1.28 - 0.07 * Math.sin(Math.PI * u), COL.picket, 5);
    pickets(at(4145.7), at(4147.35), gy(4146.5), (u) => 1.22 + 0.05 * Math.sin(Math.PI * u), COL.pickedGrey, 7, { rails: '#7d776e' });
    for (const z of [4141.15, 4143.45, 4145.68, 4147.4]) { const [x, zz] = at(z); p.add(BOX(0.1, 1.42, 0.1), z === 4145.68 ? 0x6f5c4b : 0x4f3328, x, gy(z) + 0.66, zz); }
    { const [x, z] = at(4142.75, 4.13); p.add(BOX(0.14, 0.32, 0.36), COL.mailRed, x, gy(4142.75) + 1.02, z); p.add(BOX(0.16, 0.04, 0.4), 0x6e2022, x, gy(4142.75) + 1.19, z); }
    { const [x, z] = at(4142.0, 4.12); signPlate(group, x, gy(4142) + 0.95, z, Math.PI / 2, 0.34, 0.2, (g, w, hh) => {
      g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, hh); g.fillStyle = '#c0282d'; g.fillRect(0, 0, w, hh * 0.34);
      g.fillStyle = '#ffffff'; g.font = `700 ${hh * 0.26 | 0}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('WARNING', w / 2, hh * 0.18);
      g.fillStyle = '#222'; g.font = `700 ${hh * 0.2 | 0}px Arial`; g.fillText('BADASS DOG', w / 2, hh * 0.55); g.fillText('ON DUTY', w / 2, hh * 0.8);
    }); }
    // 26: the weathered wooden gate with its arched top, the red post and the number plate
    pickets(at(4149.4, 4.3), at(4150.32, 4.3), gy(4149.9, 4.3), (u) => 1.42 + 0.14 * Math.sin(Math.PI * u), COL.pickedGrey, 9, { gap: 0.012, width: 0.1, rails: '#857d72' });
    { const [x, z] = at(4149.3, 4.3); p.add(BOX(0.1, 1.62, 0.1), COL.gateRed, x, gy(4149.3) + 0.75, z); }
    { const [x, z] = at(4150.4, 4.3); p.add(BOX(0.1, 1.5, 0.1), 0x7b7266, x, gy(4150.4) + 0.7, z); }
    { const [x, z] = at(4149.85, 4.24); signPlate(group, x, gy(4149.9) + 1.18, z, Math.PI / 2, 0.22, 0.12, (g, w, hh) => {
      g.fillStyle = '#9fa2a6'; g.fillRect(0, 0, w, hh); g.fillStyle = '#2a2c30'; g.font = `700 ${hh * 0.7 | 0}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('26', w / 2, hh * 0.54);
    }); }
    // 28: the rusty mesh car gate (two leaves), the black mailbox on its post by the path
    for (const [a, b] of [[4166.35, 4167.95], [4167.98, 4169.55]]) {
      const A = at(a, 4.15), B = at(b, 4.15), ya = gy(a, 4.15) + 0.05;
      K.panel(A, B, 1.2);
      for (const y of [0.05, 1.22]) bar([A[0], ya + y, A[1]], [B[0], ya + y, B[1]], 0.045, COL.rust);
      for (const q of [A, B]) bar([q[0], ya, q[1]], [q[0], ya + 1.25, q[1]], 0.05, COL.rust);
      const m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]; bar([m[0], ya, m[1]], [m[0], ya + 1.22, m[1]], 0.03, COL.rust);
    }
    for (const z of [4166.25, 4169.65]) { const [x, zz] = at(z, 4.15); p.add(BOX(0.08, 1.45, 0.08), COL.rust, x, gy(z, 4.15) + 0.68, zz); }
    { const [x, z] = at(4174.45, 4.55), y = gy(4174.45, 4.55); bar([x, y - 0.1, z], [x, y + 1.0, z], 0.06, 0x3a3a3e); p.add(BOX(0.36, 0.44, 0.24), COL.mailBlack, x, y + 1.18, z); }

    // ---- the west verge: a grey cabinet by the lamp across from 26
    { const [x, z] = R.at(4157.0, -4.45), y = h(x, z); p.add(BOX(0.32, 0.95, 0.42), COL.cabinet, x, y + 0.47, z); p.add(BOX(0.36, 0.05, 0.46), 0x9ea2a8, x, y + 0.97, z); }

    // ---- apples in the apple trees
    const apples = [];
    const ap = rnd(17);
    for (const [x, z, ht, cr] of [TREES[0], TREES[1], TREES[2], TREES[4]]) {
      const cy = h(x, z) + ht * 0.62, rx = cr * 0.42, ry = ht * 0.3;
      for (let k = 0; k < 70; k++) {
        const a = ap() * Math.PI * 2, e = (ap() - 0.65) * 1.6, rr = 0.78 + ap() * 0.22;
        apples.push([x + Math.cos(a) * Math.cos(e) * rx * rr, cy + Math.sin(e) * ry * rr, z + Math.sin(a) * Math.cos(e) * rx * rr, ap() < 0.75]);
      }
    }
    {
      const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.075, 1), new THREE.MeshLambertMaterial(), apples.length);
      const m = new THREE.Matrix4(), c = new THREE.Color();
      apples.forEach(([x, y, z, red], k) => { im.setMatrixAt(k, m.makeTranslation(x, y, z)); im.setColorAt(k, c.setHex(red ? COL.apple : COL.appleGreen)); });
      group.add(im);
    }

    F.finish();
    lay.finish();
    K.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 450) return;
      if ([[-987, 4110], [-987, 4200], [-960, 4140], [-960, 4180]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}

// ---------------------------------------------------------------- pieces
export function canvasTex(w, hh, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = hh;
  draw(c.getContext('2d'), w, hh);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
// grey corrugated sheet: ridges every 7.5 cm, weathered; one tile is 1.2 m
function corrugatedTex() {
  return canvasTex(256, 256, (g, w) => {
    for (let k = 0; k < 16; k++) {
      const x = k * w / 16, gr = g.createLinearGradient(x, 0, x + w / 16, 0);
      gr.addColorStop(0, '#9fa3a8'); gr.addColorStop(0.35, '#d5d8dc'); gr.addColorStop(0.6, '#bfc3c8'); gr.addColorStop(1, '#989ca2');
      g.fillStyle = gr; g.fillRect(x, 0, w / 16 + 1, w);
    }
    const r = rnd(3);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '90,80,60' : '255,255,255'},${0.04 + r() * 0.06})`; g.fillRect(r() * w, r() * w, 4 + r() * 30, 10 + r() * 60); }
  });
}
// ground textures: [texture, tile metres]
export function groundTextures() {
  const speck = (base, n, spread, seed, dots = 1.6) => (g, w) => {
    const r = rnd(seed);
    g.fillStyle = `rgb(${base.join(',')})`; g.fillRect(0, 0, w, w);
    for (let k = 0; k < n; k++) {
      const v = 1 + (r() - 0.5) * spread;
      g.fillStyle = `rgb(${base.map((c) => Math.min(255, c * v) | 0).join(',')})`;
      g.fillRect(r() * w, r() * w, dots + r() * dots, dots + r() * dots);
    }
  };
  return {
    gravel: { map: canvasTex(256, 256, speck([196, 186, 168], 9000, 0.45, 2, 2.2)), tile: 2 },
    sand: { map: canvasTex(256, 256, (g, w) => {
      speck([190, 176, 152], 7000, 0.35, 4)(g, w);
      const r = rnd(8);
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(110,138,86,${0.25 + r() * 0.3})`; g.beginPath(); g.ellipse(r() * w, r() * w, 6 + r() * 22, 3 + r() * 10, r() * 3, 0, 7); g.fill(); }
    }), tile: 3 },
    soil: { map: canvasTex(256, 256, (g, w) => {
      speck([150, 138, 112], 6000, 0.4, 6)(g, w);
      const r = rnd(9);
      for (let k = 0; k < 70; k++) { g.fillStyle = `rgba(112,140,86,${0.3 + r() * 0.4})`; g.beginPath(); g.ellipse(r() * w, r() * w, 8 + r() * 26, 4 + r() * 14, r() * 3, 0, 7); g.fill(); }
    }), tile: 3 },
    tarmac: { map: canvasTex(256, 256, speck([112, 110, 118], 9000, 0.35, 10)), tile: 3 },
    // big square concrete slabs, 1 m, joints and a few cracked or sunk ones
    slabs: { map: canvasTex(256, 256, (g, w) => {
      const r = rnd(12);
      g.fillStyle = '#8f8c8c'; g.fillRect(0, 0, w, w);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const v = 0.92 + r() * 0.14;
        g.fillStyle = `rgb(${200 * v | 0},${197 * v | 0},${196 * v | 0})`; g.fillRect(i * 128 + 2, j * 128 + 2, 124, 124);
        for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '70,70,70'},0.08)`; g.fillRect(i * 128 + r() * 124, j * 128 + r() * 124, 2, 2); }
      }
      g.strokeStyle = 'rgba(80,78,78,0.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(40, 20); g.lineTo(70, 60); g.lineTo(66, 110); g.stroke();
    }), tile: 2 },
    // grey concrete block pavers in a running bond, 20 x 10 cm, worn
    pavers: { map: canvasTex(256, 256, (g, w) => {
      const r = rnd(14);
      g.fillStyle = '#8c8a8e'; g.fillRect(0, 0, w, w);
      for (let row = 0; row < 16; row++) for (let k = -1; k < 8; k++) {
        const v = 0.9 + r() * 0.16;
        g.fillStyle = `rgb(${190 * v | 0},${188 * v | 0},${190 * v | 0})`;
        g.fillRect(k * 32 + (row % 2) * 16 + 1, row * 16 + 1, 30, 14);
      }
      for (let k = 0; k < 12; k++) { g.fillStyle = 'rgba(96,128,80,0.5)'; g.fillRect(r() * w, (r() * 16 | 0) * 16, 8 + r() * 20, 2); }
    }), tile: 1.6 },
  };
}
// textured ground strips laid in a road frame (like streetKit's ribbon, but with these textures)
export function groundLayer(world, group) {
  const lists = new Map();
  const h = (x, z) => world.heightAt(x, z);
  function lay(T, F, t0, t1, lat0, lat1, lift) {
    let L = lists.get(T);
    if (!L) lists.set(T, (L = { pos: [], uv: [], lift }));
    const n = Math.max(1, Math.round(Math.abs(t1 - t0))), m = Math.max(1, Math.round(Math.abs(lat1 - lat0) / 1.25));
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const ta = t0 + (t1 - t0) * i / n, tb = t0 + (t1 - t0) * (i + 1) / n, la = lat0 + (lat1 - lat0) * j / m, lb = lat0 + (lat1 - lat0) * (j + 1) / m;
      const q = [F.at(ta, la), F.at(ta, lb), F.at(tb, la), F.at(tb, lb)];
      const up = (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]) - (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) > 0;
      for (const k of up ? [0, 1, 2, 2, 1, 3] : [0, 2, 1, 1, 2, 3]) { L.pos.push(q[k][0], h(q[k][0], q[k][1]) + lift, q[k][1]); L.uv.push(q[k][0] / T.tile, q[k][1] / T.tile); }
    }
  }
  lay.finish = () => {
    let f = -4;
    for (const [T, L] of lists) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(L.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(L.uv, 2));
      const nor = new Float32Array(L.pos.length); for (let k = 1; k < nor.length; k += 3) nor[k] = 1;
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: T.map, polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f, side: THREE.DoubleSide }));
      m.receiveShadow = true;
      group.add(m);
      f -= 0.5;
    }
  };
  return lay;
}
// a picket fence or gate leaf from a to b, its feet at y0, its top top(u) (u 0..1 along it): one textured
// quad with the pickets cut out of it
export function fenceMesh(group, a, b, y0, top, rgb, seed, { gap = 0.035, width = 0.085, rails = null } = {}, shadows = true) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), hmax = Math.max(...[0, 0.25, 0.5, 0.75, 1].map(top)) + 0.02, ppm = 120;
  const tex = canvasTex(Math.round(len * ppm), Math.round(hmax * ppm), (g, w, hh) => {
    const r = rnd(seed);
    g.clearRect(0, 0, w, hh);
    if (rails) { g.fillStyle = rails; for (const y of [0.25, hmax - 0.42]) g.fillRect(0, hh - y * ppm - 0.07 * ppm, w, 0.07 * ppm); }
    for (let x = 0.01; x < len - width * 0.5; x += width + gap) {
      const v = 0.82 + r() * 0.3, t = top((x + width / 2) / len) - r() * 0.02;
      g.fillStyle = tone(rgb, v);
      g.beginPath(); g.moveTo(x * ppm, hh); g.lineTo(x * ppm, hh - (t - 0.03) * ppm); g.lineTo((x + width / 2) * ppm, hh - t * ppm); g.lineTo((x + width) * ppm, hh - (t - 0.03) * ppm); g.lineTo((x + width) * ppm, hh); g.closePath(); g.fill();
      g.fillStyle = tone(rgb, v * 0.75);
      for (let k = 0; k < 3; k++) g.fillRect((x + 0.015 + r() * (width - 0.03)) * ppm, hh - (0.1 + r() * (t - 0.3)) * ppm, 1, (0.1 + r() * 0.3) * ppm);
    }
  }, false);
  const g = new THREE.BufferGeometry();
  const q = [[a[0], y0, a[1], 0, 0], [b[0], y0, b[1], 1, 0], [b[0], y0 + hmax, b[1], 1, 1], [a[0], y0 + hmax, a[1], 0, 1]];
  const pos = [], uv = [];
  for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(q[k][0], q[k][1], q[k][2]); uv.push(q[k][3], q[k][4]); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
  m.castShadow = shadows; m.receiveShadow = true;
  group.add(m);
}
// a small sign or plate facing yaw (0: +z), w x h metres, its picture drawn on a canvas; plain grey behind
export function signPlate(group, x, y, z, yaw, w, hh, draw) {
  const tex = canvasTex(Math.round(w * 400), Math.round(hh * 400), draw, false);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), greyBack(new THREE.MeshLambertMaterial({ map: tex })));
  m.position.set(x, y, z); m.rotation.y = yaw;
  group.add(m);
}
