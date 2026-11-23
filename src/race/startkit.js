// The things at a rally stage's start line (Martin 23 Nov 2026, from his pictures of WRC starts):
//  - the start clock on a metal frame beside the road, a little past the line: a black box with a screen
//    (the seconds to go, and the rally time of day in green under them) and a lamp panel beside the screen
//    that is red, then yellow for the last five seconds, then green;
//  - the start line camera on a tripod at the line, its battery box (blue, orange lid) between the legs.
// One mesh of boxes and thin tubes, and one small mesh for the screen whose digits are squares of a shared
// picture of 0 to 9: a new second moves their corners in that picture, nothing is painted again.
import * as THREE from 'three';
import { Parts } from './landmarks.js';
import { paintScale } from '../world/paintscale.js';

const SEG = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];
const COLON = 10, BLANK = 11, SOLID = 12, CELLS = 16;
const LAMP = [0x16161b, 0xff2a1a, 0xffc81e, 0x29ff6a];      // off, red, yellow, green
const TIME_HEX = 0x39ff7a;

// 0 to 9 as seven-segment digits, a colon, an empty square and a full one, white on black, in one row
function glyphs() {
  const k = paintScale(), cw = Math.round(32 * k), ch = Math.round(52 * k);
  const c = document.createElement('canvas');
  c.width = cw * CELLS; c.height = ch;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, ch);
  g.fillStyle = '#fff';
  const mx = cw * 0.14, my = ch * 0.08, t = cw * 0.17, x0 = mx, x1 = cw - mx, y0 = my, y1 = ch - my, ym = ch / 2;
  const seg = {
    a: [x0 + t * 0.6, y0, x1 - x0 - t * 1.2, t], g: [x0 + t * 0.6, ym - t / 2, x1 - x0 - t * 1.2, t], d: [x0 + t * 0.6, y1 - t, x1 - x0 - t * 1.2, t],
    f: [x0, y0 + t * 0.6, t, ym - y0 - t * 0.9], b: [x1 - t, y0 + t * 0.6, t, ym - y0 - t * 0.9],
    e: [x0, ym + t * 0.3, t, y1 - ym - t * 0.9], c: [x1 - t, ym + t * 0.3, t, y1 - ym - t * 0.9],
  };
  for (let n = 0; n < 10; n++) for (const s of SEG[n]) { const r = seg[s]; g.fillRect(n * cw + r[0], r[1], r[2], r[3]); }
  g.fillRect(COLON * cw + cw / 2 - t * 0.6, ch * 0.3, t * 1.2, t * 1.2);
  g.fillRect(COLON * cw + cw / 2 - t * 0.6, ch * 0.7 - t * 1.2, t * 1.2, t * 1.2);
  g.fillRect(SOLID * cw, 0, cw, ch);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// clock, cam: { x, y, z, yaw } on the ground (yaw: the way its face looks, as rotation.y)
export function createStartKit({ group, clock, cam }) {
  const p = new Parts();
  const STEEL = 0x9a9ea4, BLACK = 0x121216;

  // ---- the clock's frame: four legs, a rail low down and one under the box, and the box on top
  const W = 1.2, H = 0.62, D = 0.18, TOP = 1.5;            // the box, and the height of its underside
  {
    const { x, y, z, yaw } = clock, c = Math.cos(yaw), s = Math.sin(yaw);
    const at = (lx, lz) => [x + c * lx + s * lz, z - s * lx + c * lz];
    const fw = 0.42, fd = 0.26;
    for (const lx of [-fw, fw]) for (const lz of [-fd, fd]) { const [ax, az] = at(lx, lz); p.box(0.035, TOP, 0.035, STEEL, ax, y + TOP / 2, az, yaw); }
    for (const hy of [0.22, TOP - 0.02]) {
      for (const lz of [-fd, fd]) { const [ax, az] = at(0, lz); p.box(fw * 2, 0.03, 0.03, STEEL, ax, y + hy, az, yaw); }
      for (const lx of [-fw, fw]) { const [ax, az] = at(lx, 0); p.box(0.03, 0.03, fd * 2, STEEL, ax, y + hy, az, yaw); }
    }
    p.box(W, H, D, BLACK, x, y + TOP + H / 2, z, yaw);
    const [hx, hz] = at(0, 0.04);
    p.box(W + 0.06, 0.03, D + 0.16, BLACK, hx, y + TOP + H + 0.015, hz, yaw);   // a peak over the screen
  }

  // ---- the camera on its tripod, looking across the line
  {
    const { x, y, z, yaw } = cam, HEAD = 1.12;
    for (let k = 0; k < 3; k++) {
      const a = yaw + k * Math.PI * 2 / 3 + 0.5, spread = 0.42, len = Math.hypot(HEAD, spread);
      const leg = new THREE.CylinderGeometry(0.014, 0.016, len, 5);
      leg.rotateX(-Math.atan2(spread, HEAD)).rotateY(a);    // its foot out along +z turned by a
      p.add(leg, 0x2a2a2e, x + Math.sin(a) * spread / 2, y + HEAD / 2, z + Math.cos(a) * spread / 2);
      leg.dispose();
    }
    p.box(0.04, 0.22, 0.04, 0x2a2a2e, x, y + HEAD + 0.08, z, yaw);
    p.box(0.3, 0.2, 0.2, BLACK, x, y + HEAD + 0.28, z, yaw);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    p.box(0.13, 0.13, 0.1, 0x3a3d44, x + s * 0.14, y + HEAD + 0.28, z + c * 0.14, yaw);    // the lens hood
    p.box(0.34, 0.02, 0.26, BLACK, x + s * 0.02, y + HEAD + 0.39, z + c * 0.02, yaw);      // a rain cover
    p.box(0.3, 0.26, 0.22, 0x1f5fd0, x, y + 0.15, z, yaw + 0.4);                           // the battery box
    p.box(0.3, 0.05, 0.22, 0xf07a18, x, y + 0.305, z, yaw + 0.4);
  }
  const body = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  body.castShadow = true;
  group.add(body);

  // ---- the screen: two big digits (seconds to go), HH:MM:SS under them, the lamp panel on the right
  const quads = [];                                         // [x0, y0, x1, y1]
  for (let k = 0; k < 2; k++) quads.push([-0.37 + k * 0.2, 0.0, -0.37 + k * 0.2 + 0.18, 0.26]);
  for (let k = 0; k < 8; k++) quads.push([-0.53 + k * 0.088, -0.25, -0.53 + k * 0.088 + 0.08, -0.1]);
  quads.push([0.26, -0.25, 0.54, 0.25]);
  const nq = quads.length, pos = new Float32Array(nq * 12), uv = new Float32Array(nq * 8), col = new Float32Array(nq * 12), idx = [];
  quads.forEach(([x0, y0, x1, y1], q) => {
    pos.set([x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0], q * 12);
    idx.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  const screen = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: glyphs(), vertexColors: true }));
  screen.position.set(clock.x + Math.sin(clock.yaw) * (D / 2 + 0.006), clock.y + TOP + H / 2, clock.z + Math.cos(clock.yaw) * (D / 2 + 0.006));
  screen.rotation.y = clock.yaw;
  group.add(screen);

  const tint = new THREE.Color();
  const put = (q, cell, hex) => {
    const u0 = (cell + 0.04) / CELLS, u1 = (cell + 0.96) / CELLS;
    uv.set([u0, 0, u1, 0, u1, 1, u0, 1], q * 8);
    tint.setHex(hex);
    for (let v = 0; v < 4; v++) { col[q * 12 + v * 3] = tint.r; col[q * 12 + v * 3 + 1] = tint.g; col[q * 12 + v * 3 + 2] = tint.b; }
  };
  let shown = '';
  // lamp: 0 off, 1 red, 2 yellow, 3 green; count: the seconds to go (null: none); time: 'HH:MM:SS'
  function show(lamp, count, time) {
    const key = `${lamp} ${count} ${time}`;
    if (key === shown) return;
    shown = key;
    const hex = LAMP[lamp] === LAMP[0] ? 0xffffff : LAMP[lamp];
    put(0, count != null && count > 9 ? Math.floor(count / 10) % 10 : BLANK, hex);
    put(1, count != null ? count % 10 : BLANK, hex);
    for (let k = 0; k < 8; k++) { const ch = time[k]; put(2 + k, ch === ':' ? COLON : ch >= '0' && ch <= '9' ? +ch : BLANK, TIME_HEX); }
    put(10, SOLID, LAMP[lamp]);
    geo.attributes.uv.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }
  show(0, null, '00:00:00');
  return { show };
}
