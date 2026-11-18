// Jänese tänav 1 and its street, built by hand from Street View (July 2024) and the orthophoto in place of
// the map's block: the long low house with the blue profiled steel roof, two chimneys and two roof windows,
// cream and peach rendered halves, the hipped end with the air conditioner and the porch on a timber post,
// the tall hedge, the green mesh gate with the bins behind it, the weathered plank fence, the thuja row
// behind a wire fence. Across the street the long yellow two-storey building gets its two rows of windows
// in red-brown frames, and the street its patched asphalt, kerb, concrete slab pavement, verges and poles.
// Everything is measured in the street's frame (as in janese.js): s metres along the centre line heading
// south-east, o metres to the right of it (the house side). Heights are map heights.
import * as THREE from 'three';
import { streetKit, addHouseColours } from './streetkit.js';
import { Parts, BOX } from '../race/landmarks.js';

const DIR = [0.758, 0.652], RIGHT = [-0.652, 0.758], ROAD = [1955.2, 1472.2];
const along = (s, o) => [ROAD[0] + DIR[0] * s + RIGHT[0] * o, ROAD[1] + DIR[1] * s + RIGHT[1] * o];
const frame = (x, z) => [(x - ROAD[0]) * DIR[0] + (z - ROAD[1]) * DIR[1], (x - ROAD[0]) * RIGHT[0] + (z - ROAD[1]) * RIGHT[1]];
const TURN = Math.atan2(-DIR[1], DIR[0]);            // of a group whose x runs along s and z along o
const S0 = -8, S1 = 100;                             // the stretch of street that is dressed

const COL = {
  cream: 0xf0ead2, peach: 0xf3c9a0, plinth: 0xbdb8b0, white: 0xf5f4f0, glass: 0x7f97a8, glassDark: 0x4a5866,
  roofEdge: 0x7d9ac4, fascia: 0xe3e1dc, brick: 0xb9806a, chimney: 0xd6d0c6, metal: 0xc8ccd2, wood: 0xb98552, shed: 0xcbbfa8,
  hedge: [0x4f9a4a, 0x5fae55, 0x438a44], thuja: [0x3d6f45, 0x48804f, 0x35633e], bin: 0x3f9457, binLid: 0x2f7a45, gate: 0x2f8a55,
  yellow: 0xecdca4, yellowLight: 0xf6efcf, yellowDark: 0xd8c88e, redFrame: 0xb5654e, kerb: 0xcac7d0, pole: 0xbab6b2, manhole: 0x56515c,
};

// before the road markings are built: this street has no painted lines
export function janeseVectors(vectors) {
  const prev = vectors.markSkip;
  vectors.markSkip = (x, z) => {
    const [s, o] = frame(x, z);
    return (s > S0 - 2 && s < S1 + 2 && Math.abs(o) < 4.5) || (prev ? prev(x, z) : false);
  };
}
// the map's block for the house is replaced; the yellow building gets its colour
export function janeseWalls(walls) {
  const [hx, hz] = along(44.8, 18), [yx, yz] = along(47, -20);
  addHouseColours(walls, '4_3', 1760, 1120, [
    { base: 1799, x: hx, z: hz, wall: COL.cream, hide: true, reach: 16.5 },
    { base: 1841, x: yx, z: yz, wall: COL.yellow, roof: 0x9a9ba8, reach: 120 },
  ]);
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function rnd(seed) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
// patterned surfaces: [texture, tile in metres (u, v), options]
function textures() {
  return {
    // profiled steel sheet: ribs every 20 cm running up the slope, a faint lap line every 2 m
    roof: [canvasTex(128, 256, (g, w, h) => {
      for (let k = 0; k < 5; k++) {
        const x = k * w / 5, gr = g.createLinearGradient(x, 0, x + w / 5, 0);
        gr.addColorStop(0, '#6f8dba'); gr.addColorStop(0.25, '#9bb5dc'); gr.addColorStop(0.5, '#86a2cd'); gr.addColorStop(0.8, '#7d99c5'); gr.addColorStop(1, '#6a87b3');
        g.fillStyle = gr; g.fillRect(x, 0, w / 5 + 1, h);
      }
      g.fillStyle = 'rgba(40,60,100,0.25)'; g.fillRect(0, 0, w, 3);
      const r = rnd(4);
      for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.05})`; g.fillRect(r() * w, r() * h, 6 + r() * 20, 30 + r() * 80); }
    }), [1, 2]],
    // weathered pickets with gaps and uneven tops
    planks: [canvasTex(256, 128, (g, w, h) => {
      const r = rnd(7);
      g.clearRect(0, 0, w, h);
      for (let k = 0; k < 16; k++) {
        const v = 150 + r() * 45, top = r() * 14, lean = (r() - 0.5) * 3;
        g.fillStyle = `rgb(${v | 0},${(v * 0.95) | 0},${(v * 0.9) | 0})`;
        g.beginPath(); g.moveTo(k * 16 + 1.5 + lean, top); g.lineTo(k * 16 + 14.5 + lean, top + r() * 4); g.lineTo(k * 16 + 14.5, h); g.lineTo(k * 16 + 1.5, h); g.closePath(); g.fill();
        g.fillStyle = 'rgba(70,60,50,0.25)';
        for (let j = 0; j < 3; j++) g.fillRect(k * 16 + 3 + r() * 9, top + 6 + r() * 90, 1, 10 + r() * 25);
      }
      g.fillStyle = 'rgb(128,118,106)';
      for (const y of [30, 98]) g.fillRect(0, y, w, 7);                 // the two rails show through the gaps
    }), [1.6, 1.3], { alpha: true }],
    // the pavement: three rows of big concrete slabs, grass in the joints, some sunk and mossy
    slabs: [canvasTex(256, 192, (g, w, h) => {
      const r = rnd(11);
      g.fillStyle = '#6f8f58'; g.fillRect(0, 0, w, h);
      for (let row = 0; row < 3; row++) for (let k = 0; k < 4; k++) {
        const v = 176 + r() * 40, lost = r() < 0.1;
        g.fillStyle = lost ? '#7d9a66' : `rgb(${v | 0},${(v * 0.99) | 0},${Math.min(255, v * 1.04) | 0})`;
        g.fillRect(k * 64 + 3 + r() * 2, row * 64 + 3 + r() * 2, 57 - r() * 3, 57 - r() * 3);
        if (r() < 0.35) { g.fillStyle = 'rgba(90,110,80,0.3)'; g.fillRect(k * 64 + 6 + r() * 30, row * 64 + 6 + r() * 30, 14 + r() * 16, 10 + r() * 16); }
      }
    }), [3, 1.8], { ground: -5 }],
    // what years of repairs left on the asphalt: dark trench strips and patches, pale worn fields, cracks (50 m of street)
    asphalt: [canvasTex(2048, 320, (g, w, h) => {
      const r = rnd(23);
      g.clearRect(0, 0, w, h);
      g.fillStyle = 'rgba(120,118,132,0.4)'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 2600; k++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(20,20,30,0.07)'; g.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3); }
      for (let k = 0; k < 6; k++) {                                     // pale patches with a dark sealed edge
        const x = r() * w, y = 20 + r() * (h - 110), pw = 80 + r() * 260, ph = 40 + r() * 90;
        g.fillStyle = 'rgba(215,212,224,0.13)'; g.fillRect(x, y, pw, ph); g.fillRect(x - w, y, pw, ph);
        g.strokeStyle = 'rgba(30,30,42,0.4)'; g.lineWidth = 3; g.strokeRect(x, y, pw, ph); g.strokeRect(x - w, y, pw, ph);
      }
      const strip = (y0, wide, a) => {                                 // a trench repair wandering along the street
        g.strokeStyle = `rgba(34,34,46,${a})`; g.lineWidth = wide; g.lineJoin = 'round'; g.beginPath();
        let y = y0; g.moveTo(-10, y);
        for (let x = 0; x <= w + 40; x += 40) { y += (r() - 0.5) * 9 + (y0 - y) * 0.15; g.lineTo(x, y); }
        g.stroke();
      };
      strip(h * 0.62, 26, 0.42); strip(h * 0.3, 14, 0.3);
      for (let k = 0; k < 6; k++) {                                     // short cross trenches
        const x = r() * w, lean = (r() - 0.5) * 120;
        g.strokeStyle = 'rgba(34,34,46,0.38)'; g.lineWidth = 12 + r() * 14; g.beginPath(); g.moveTo(x, r() * 60); g.lineTo(x + lean, h - r() * 60); g.stroke();
      }
      g.strokeStyle = 'rgba(25,25,35,0.45)'; g.lineWidth = 1.5;
      for (let k = 0; k < 26; k++) {                                    // cracks
        let x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y);
        for (let j = 0; j < 7; j++) { x += 10 + r() * 30; y += (r() - 0.5) * 34; g.lineTo(x, y); }
        g.stroke();
      }
      const gr = g.createLinearGradient(0, 0, 0, h);                    // crumbling, greyer edges
      gr.addColorStop(0, 'rgba(120,120,112,0.5)'); gr.addColorStop(0.08, 'rgba(120,120,112,0)'); gr.addColorStop(0.92, 'rgba(120,120,112,0)'); gr.addColorStop(1, 'rgba(120,120,112,0.5)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }), [50, 7.9], { ground: -3, alpha: true }],
  };
}

export function createJaneseMaja(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function build() {
    built = true;
    const K = streetKit(world, group, { shadows, fenceColour: 0x9fc4ab });
    const F = { at: along };
    const gh = (s, o) => world.heightAt(...along(s, o));
    const local = new THREE.Group();                  // x = s, y = map height, z = o
    local.position.set(ROAD[0], 0, ROAD[1]);
    local.rotation.y = TURN;
    group.add(local);

    const p = new Parts();
    const add = (geo, hex) => p.add(geo, hex, 0, 0, 0, 0);
    const box = (s0, s1, o0, o1, y0, y1, hex) => add(BOX(Math.abs(s1 - s0), Math.abs(y1 - y0), Math.abs(o1 - o0)).translate((s0 + s1) / 2, (y0 + y1) / 2, (o0 + o1) / 2), hex);
    const boxAt = (s, o, w, hgt, d, hex, yaw = 0, y0 = gh(s, o)) => add(BOX(w, hgt, d).rotateY(yaw).translate(s, y0 + hgt / 2, o), hex);
    const bar = (a, b, t, hex) => {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va), len = d.length();
      const g = BOX(t, len, t);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
      g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
      add(g, hex);
    };
    const cyl = (s, o, r, y0, y1, hex, r1 = r) => add(new THREE.CylinderGeometry(r1, r, y1 - y0, 10).translate(s, (y0 + y1) / 2, o), hex);
    // a convex solid from corner points and faces (lists of corner numbers); faces are turned outwards
    const solid = (pts, faces, hex) => {
      const P = pts.map((q) => new THREE.Vector3(...q)), c = P.reduce((a, q) => a.add(q), new THREE.Vector3()).divideScalar(P.length);
      const pos = [], n = new THREE.Vector3(), m = new THREE.Vector3();
      for (const f of faces) for (let k = 1; k < f.length - 1; k++) {
        let t = [P[f[0]], P[f[k]], P[f[k + 1]]];
        n.subVectors(t[1], t[0]).cross(m.subVectors(t[2], t[0]));
        if (n.dot(m.copy(t[0]).sub(c)) < 0) t = [t[0], t[2], t[1]];
        for (const q of t) pos.push(q.x, q.y, q.z);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      add(g, hex);
    };
    const PRISM = [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]];
    // an attic: triangle over o0..o1 with the ridge along s, or over s0..s1 with the ridge along o
    const atticS = (s0, s1, o0, o1, y0, yr, hex) => solid([[s0, y0, o0], [s0, y0, o1], [s0, yr, (o0 + o1) / 2], [s1, y0, o0], [s1, y0, o1], [s1, yr, (o0 + o1) / 2]], PRISM, hex);
    const atticO = (s0, s1, o0, o1, y0, yr, hex) => solid([[s0, y0, o0], [s1, y0, o0], [(s0 + s1) / 2, yr, o0], [s0, y0, o1], [s1, y0, o1], [(s0 + s1) / 2, yr, o1]], PRISM, hex);

    // ---- patterned surfaces
    const TEX = textures(), quads = {};
    for (const k of Object.keys(TEX)) quads[k] = { pos: [], uv: [] };
    // a flat polygon; the pattern's u runs along U (a direction lying in it), v square to that
    const poly = (kind, pts, U) => {
      const Q = quads[kind], [tu, tv] = TEX[kind][1], P = pts.map((q) => new THREE.Vector3(...q));
      const u = new THREE.Vector3(...U).normalize(), n = new THREE.Vector3().subVectors(P[1], P[0]).cross(new THREE.Vector3().subVectors(P[2], P[0])).normalize();
      const v = new THREE.Vector3().crossVectors(n, u), d = new THREE.Vector3();
      if (v.y < 0) v.negate();
      for (let k = 1; k < P.length - 1; k++) for (const q of [P[0], P[k], P[k + 1]]) {
        d.subVectors(q, P[0]);
        Q.pos.push(q.x, q.y, q.z); Q.uv.push((d.dot(u) + P[0].dot(u)) / tu, d.dot(v) / tv);
      }
    };
    // a pattern laid on the ground between s0..s1 and o0..o1
    const strip = (kind, s0, s1, o0, o1, lift, step = 2) => {
      const Q = quads[kind], [tu, tv] = TEX[kind][1], n = Math.ceil((s1 - s0) / step), m = Math.max(1, Math.ceil(Math.abs(o1 - o0) / 2));
      const at = (i, j) => { const s = s0 + (s1 - s0) * i / n, o = o0 + (o1 - o0) * j / m; return [s, gh(s, o) + lift, o, (s - s0) / tu, (o - o0) / tv]; };
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
        const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
        for (const q of [a, b, c, a, c, d]) { Q.pos.push(q[0], q[1], q[2]); Q.uv.push(q[3], q[4]); }
      }
    };
    // a window in a wall that faces -o or +o (sign), or -s or +s
    const winO = (s0, s1, y0, y1, o, sign, { frame = COL.white, glass = COL.glass, mull = 1, fw = 0.07 } = {}) => {
      box(s0 - fw, s1 + fw, o, o + sign * 0.05, y0 - fw, y1 + fw, frame);
      box(s0, s1, o, o + sign * 0.07, y0, y1, glass);
      for (let k = 1; k <= mull; k++) { const s = s0 + (s1 - s0) * k / (mull + 1); box(s - 0.03, s + 0.03, o, o + sign * 0.09, y0, y1, frame); }
    };
    const winS = (o0, o1, y0, y1, s, sign, { frame = COL.white, glass = COL.glass } = {}) => {
      box(s, s + sign * 0.05, o0 - 0.07, o1 + 0.07, y0 - 0.07, y1 + 0.07, frame);
      box(s, s + sign * 0.07, o0, o1, y0, y1, glass);
    };

    // ================= the street =================
    strip('asphalt', S0, S1, -3.95, 3.95, 0.07);
    // north-east side: kerb, slab pavement, grass up to the yellow building
    for (let s = S0; s < S1; s += 1) { const y = gh(s + 0.5, -4.0); box(s, s + 0.97, -4.12, -3.95, y - 0.1, y + 0.13, COL.kerb); }
    strip('slabs', S0, S1, -5.95, -4.12, 0.1, 1.5);
    K.ribbon(F, S0, S1, -5.95, -10.1, 'lawn');
    // house side: grass verge, the strip behind the hedge, the garden behind the fence, a worn path at the gate
    K.ribbon(F, S0, 10, 3.9, 6.7, 'lawn');
    K.ribbon(F, 10, 64, 3.9, 9.9, 'lawn');
    K.ribbon(F, 64, S1, 3.9, 6.8, 'lawn');
    K.ribbon(F, 9, 30.6, 9.9, 24, 'lawn');
    K.ribbon(F, 27.5, 29.0, 3.9, 10.4, 'concrete', true);
    // manhole covers: one in the pavement, one in the verge on the house side
    for (const [s, o] of [[3.2, -5.0], [12.5, 5.4], [58, -5.1]]) add(new THREE.CylinderGeometry(0.36, 0.36, 0.03, 16).translate(s, gh(s, o) + 0.115, o), COL.manhole);
    // poles: a leaning concrete one in the verge, two with street lamps by the pavement, wires between them
    const tops = [];
    for (const [s, o, lean, lamp] of [[-3.5, -7.2, 0.45, false], [30, -6.4, 0, true], [62, -6.4, 0, true], [95, -6.4, 0, true]]) {
      const y = gh(s, o), top = [s + lean, y + 8.6, o + lean * 0.3];
      bar([s, y - 0.2, o], top, 0.26, COL.pole);
      tops.push(top);
      if (lamp) {
        bar([s, y + 8.2, o], [s, y + 8.5, o + 1.8], 0.07, COL.metal);
        box(s - 0.14, s + 0.14, o + 1.6, o + 2.25, y + 8.44, y + 8.56, COL.metal);
        box(s - 0.1, s + 0.1, o + 1.7, o + 2.2, y + 8.4, y + 8.44, 0xfff4c8);
      }
      bar([top[0] - 0.5, top[1] - 0.25, top[2]], [top[0] + 0.5, top[1] - 0.25, top[2]], 0.07, COL.pole);
    }
    for (let k = 0; k < tops.length - 1; k++) for (const d of [-0.45, 0, 0.45]) {
      const a = tops[k], b = tops[k + 1], mid = [(a[0] + b[0]) / 2 + d, (a[1] + b[1]) / 2 - 0.7, (a[2] + b[2]) / 2];
      bar([a[0] + d, a[1] - 0.2, a[2]], mid, 0.025, 0x3a3a44); bar(mid, [b[0] + d, b[1] - 0.2, b[2]], 0.025, 0x3a3a44);
    }

    // ================= the yellow building across the street =================
    {
      const wo = (s) => -10.2 - 0.5 * (s + 10.4) / 114.9;            // its street wall, map block 1841
      const TOP = 26.25, YAW = 0.00435, sA = -10.4, sB = 104.5, mid = (sA + sB) / 2, len = sB - sA;
      const band = (y0, y1, out, hex) => add(BOX(len + 0.1, y1 - y0, 0.06).rotateY(YAW).translate(mid, (y0 + y1) / 2, wo(mid) + out), hex);
      band(15.5, TOP, 0.035, COL.yellow);                             // the rendered wall itself (the map draws big blocks as dark glazed sheds)
      add(BOX(0.06, TOP - 15.5, 21.2).translate(sA - 0.035, (15.5 + TOP) / 2, wo(sA) - 10.55), COL.yellow);       // and the end wall
      band(15.5, 19.55, 0.07, COL.yellowDark);                        // plinth
      band(22.82, 22.96, 0.08, COL.yellowLight);                      // string course between the floors
      band(TOP - 0.3, TOP + 0.02, 0.09, COL.yellowLight);             // eaves board
      const r = rnd(31);
      for (let s = sA + 1.9; s < sB - 1.5; s += 3.05) {
        for (const [y0, y1] of [[20.35, 21.95], [23.7, 25.25]]) {
          const o = wo(s) + 0.065, lit = r();
          winO(s - 0.68, s + 0.68, y0, y1, o, 1, { frame: COL.redFrame, glass: lit < 0.2 ? 0xbfc9cc : lit < 0.6 ? COL.glassDark : 0x60788c, mull: 2, fw: 0.09 });
          box(s - 0.68, s + 0.68, o, o + 0.1, y0 + (y1 - y0) * 0.68, y0 + (y1 - y0) * 0.68 + 0.06, COL.redFrame);
          box(s - 0.82, s + 0.82, o, o + 0.14, y0 - 0.14, y0 - 0.08, COL.redFrame);          // sill
        }
        // patched and peeling render
        if (r() < 0.55) { const pw = 0.5 + r() * 1.3, ph = 0.3 + r() * 0.9, y = 19.7 + r() * 5.6, ps = s + 0.9 + r() * 1.2; box(ps, ps + pw, wo(ps) + 0.06, wo(ps) + 0.085, y, y + ph, r() < 0.7 ? COL.yellowLight : 0xe0d7c4); }
      }
      for (const s of [-9.6, 13.2, 36.4, 59.3, 82.2, 103.8]) cyl(s, wo(s) + 0.17, 0.06, 16.5, TOP - 0.1, COL.metal);       // downpipes
    }

    // ================= Jänese 1: the house =================
    const SA = 33.7, SB = 53.4, OF = 10.0, OB = 19.3, OR = (OF + OB) / 2, SPLIT = 45.3;
    let Y0 = -1e9;
    for (const [s, o] of [[SA, OF], [SB, OF], [SA, OB], [SB, OB], [30.9, OF], [47, 25.9]]) Y0 = Math.max(Y0, gh(s, o));
    Y0 += 0.12;
    const E = Y0 + 2.9, RG = Y0 + 6.5, KS = (RG - E) / (OR - OF), ANG = Math.atan(KS), DOWN = Y0 - 1.5;
    {
      // walls and attic: the right-hand part cream, the left-hand part peach
      box(SA, SPLIT, OF, OB, DOWN, E, COL.cream); box(SPLIT, SB, OF, OB, DOWN, E, COL.peach);
      atticS(SA, SPLIT, OF, OB, E, RG, COL.cream); atticS(SPLIT, SB, OF, OB, E, RG, COL.peach);
      box(SA - 0.03, SB + 0.03, OF - 0.03, OB + 0.03, DOWN, Y0 + 0.3, COL.plinth);
      // the roof: two slopes of blue profiled sheet, ridge cap, barge boards, gutters
      const ov = 0.5, gov = 0.35, ye = E - ov * KS + 0.07, yr = RG + 0.07;
      poly('roof', [[SA - gov, ye, OF - ov], [SB + gov, ye, OF - ov], [SB + gov, yr, OR], [SA - gov, yr, OR]], [1, 0, 0]);
      poly('roof', [[SA - gov, ye, OB + ov], [SB + gov, ye, OB + ov], [SB + gov, yr, OR], [SA - gov, yr, OR]], [1, 0, 0]);
      box(SA - gov, SB + gov, OR - 0.14, OR + 0.14, yr - 0.02, yr + 0.07, COL.roofEdge);
      for (const s of [SA - gov, SB + gov]) for (const oe of [OF - ov, OB + ov]) bar([s, ye - 0.06, oe], [s, yr - 0.06, OR], 0.12, COL.fascia);
      for (const oe of [OF - ov, OB + ov]) box(SA - gov, SB + gov, oe - 0.07, oe + 0.07, ye - 0.14, ye - 0.02, COL.fascia);
      cyl(SA + 0.05, OF - 0.12, 0.05, Y0 - 0.2, E - 0.25, COL.metal); cyl(SB - 0.1, OF - 0.12, 0.05, Y0 - 0.2, E - 0.25, COL.metal);
      // street side windows (most of them behind the hedge), white frames
      for (const [s0, s1, mull] of [[34.6, 36.0, 1], [38.5, 39.5, 0], [41.9, 43.3, 1], [46.4, 47.4, 0], [49.8, 51.3, 1]]) winO(s0, s1, Y0 + 1.0, Y0 + 2.25, OF, -1, { mull });
      for (const [s0, s1] of [[35.0, 36.4], [38.2, 39.4]]) winO(s0, s1, Y0 + 1.0, Y0 + 2.25, OB, 1, {});
      winS(13.9, 15.2, E + 0.5, E + 1.7, SB, 1); winS(13.9, 15.2, E + 0.6, E + 1.7, SA, -1);       // attic windows in the gables
      // roof windows on the street slope
      const onRoof = (s, o, w, d, thick, lift, hex) => add(BOX(w, thick, d).rotateX(-ANG).translate(s, E + (o - OF) * KS + 0.07 + lift, o), hex);
      for (const s of [37.3, 41.4]) { onRoof(s, 12.5, 0.95, 1.3, 0.1, 0.03, 0x8f96a2); onRoof(s, 12.5, 0.78, 1.12, 0.1, 0.06, 0x3c4654); }
      // chimneys: a rendered one on the ridge, a bigger one with a steel cowl just in front of it
      box(44.0, 44.6, OR - 0.3, OR + 0.3, RG - 0.4, RG + 0.85, COL.chimney); box(43.95, 44.65, OR - 0.35, OR + 0.35, RG + 0.85, RG + 0.93, COL.plinth);
      box(37.95, 38.7, 13.3, 13.95, RG - 1.6, RG + 0.55, COL.chimney); box(37.95, 38.7, 13.3, 13.95, RG - 0.25, RG + 0.2, COL.brick);
      cyl(38.32, 13.62, 0.13, RG + 0.55, RG + 1.2, COL.metal); cyl(38.32, 13.62, 0.2, RG + 1.2, RG + 1.3, COL.metal, 0.06);

      // the low hipped end towards the gate, with the air conditioner on its street wall
      const AS = 30.9, AO1 = 18.9, AE = Y0 + 2.55, AT = Y0 + 4.6;
      box(AS, SA, OF, AO1, DOWN, AE, COL.cream);
      box(AS - 0.03, SA, OF - 0.03, AO1 + 0.03, DOWN, Y0 + 0.3, COL.plinth);
      const P1 = [AS - 0.35, AE, OF - 0.4], P2 = [AS - 0.35, AE, AO1 + 0.4], Q1 = [SA, AT, 12.6], Q2 = [SA, AT, 16.5], G1 = [SA, AE, OF - 0.4], G2 = [SA, AE, AO1 + 0.4];
      poly('roof', [P1, P2, Q2, Q1], [0, 0, 1]); poly('roof', [P1, G1, Q1], [1, 0, 0]); poly('roof', [P2, G2, Q2], [1, 0, 0]);
      solid([[AS, AE - 0.05, OF], [AS, AE - 0.05, AO1], [SA, AE - 0.05, OF], [SA, AE - 0.05, AO1], [SA, AT - 0.08, 12.6], [SA, AT - 0.08, 16.5]], [[0, 1, 5, 4], [0, 2, 4], [1, 3, 5], [0, 1, 3, 2], [2, 3, 5, 4]], COL.cream);
      box(31.75, 32.6, OF - 0.3, OF, Y0 + 1.3, Y0 + 1.88, COL.white);                             // air conditioner
      add(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 14).rotateX(Math.PI / 2).translate(32.05, Y0 + 1.59, OF - 0.31), 0x8d939c);
      bar([32.5, Y0 + 1.3, OF - 0.04], [32.5, Y0 + 0.1, OF - 0.04], 0.04, COL.metal);
      box(AS - 0.06, AS, 11.5, 12.4, Y0 + 0.05, Y0 + 2.05, 0x9c6a48);                             // the door under the porch
      winS(14.6, 15.6, Y0 + 1.1, Y0 + 2.1, AS, -1);
      // porch: a little lean-to roof on timber posts
      poly('roof', [[AS, Y0 + 2.42, 10.3], [AS, Y0 + 2.42, 13.4], [29.25, Y0 + 2.08, 13.4], [29.25, Y0 + 2.08, 10.3]], [0, 0, 1]);
      for (const o of [10.45, 13.25]) {
        box(29.33, 29.45, o - 0.06, o + 0.06, gh(29.4, o) - 0.1, Y0 + 2.07, COL.wood);
        bar([29.4, Y0 + 1.5, o], [29.95, Y0 + 2.12, o], 0.08, COL.wood);
      }
      bar([29.39, Y0 + 2.02, 10.4], [29.39, Y0 + 2.02, 13.3], 0.1, COL.wood);
      box(29.3, AS, 11.2, 12.7, gh(29.8, 12) - 0.1, Y0 + 0.04, COL.plinth);                       // the step

      // the shed on the far gable
      box(SB, 57.0, 12.0, 19.2, DOWN, Y0 + 2.35, COL.shed);
      poly('roof', [[SB, Y0 + 3.75, 11.7], [SB, Y0 + 3.75, 19.5], [57.35, Y0 + 2.3, 19.5], [57.35, Y0 + 2.3, 11.7]], [0, 0, 1]);
      solid([[SB, Y0 + 2.35, 12], [SB, Y0 + 2.35, 19.2], [57, Y0 + 2.35, 12], [57, Y0 + 2.35, 19.2], [SB, Y0 + 3.68, 12], [SB, Y0 + 3.68, 19.2]], [[0, 2, 4], [1, 3, 5], [2, 3, 5, 4], [0, 1, 3, 2], [0, 1, 5, 4]], COL.shed);
      box(57.0, 57.05, 14.2, 15.1, Y0 + 0.05, Y0 + 2.0, 0x9c8a70);

      // the wing behind: lower, its ridge square to the street
      const W0 = 41.3, W1 = SB, WO = 25.9, WE = Y0 + 2.6, WR = Y0 + 4.9, WM = (W0 + W1) / 2, kw = (WR - WE) / (WM - W0);
      box(W0, W1, OB, WO, DOWN, WE, COL.cream);
      atticO(W0, W1, OB - 2.6, WO, WE, WR, COL.cream);
      const yw = WE - 0.35 * kw + 0.07;
      poly('roof', [[W0 - 0.35, yw, OB - 0.3], [W0 - 0.35, yw, WO + 0.35], [WM, WR + 0.07, WO + 0.35], [WM, WR + 0.07, OB - 2.8]], [0, 0, 1]);
      poly('roof', [[W1 + 0.35, yw, OB - 0.3], [W1 + 0.35, yw, WO + 0.35], [WM, WR + 0.07, WO + 0.35], [WM, WR + 0.07, OB - 2.8]], [0, 0, 1]);
      winO(45.0, 46.3, Y0 + 1.0, Y0 + 2.2, WO, 1, {}); winO(48.6, 49.9, Y0 + 1.0, Y0 + 2.2, WO, 1, {});
      winS(21.5, 22.8, Y0 + 1.0, Y0 + 2.2, W0, -1);
    }

    // ================= hedge, gate, fences, thujas =================
    {
      const r = rnd(5);
      const blob = (s, o, rad, y, k, squash = 0.9) => add(new THREE.IcosahedronGeometry(rad, 1).scale(1.05, squash, 1).rotateY(s * 1.7).translate(s, y, o), COL.hedge[k % 3]);
      // the tall leafy hedge in front of the house
      for (let s = 30.6, k = 0; s <= 47.3; s += 0.62, k++) {
        const o = 7.75 + (r() - 0.5) * 0.35, g = gh(s, o);
        blob(s, o, 0.95 + r() * 0.2, g + 1.15 + r() * 0.25, k + (r() * 3 | 0));
        blob(s + 0.3, o - 0.25 + r() * 0.5, 0.8 + r() * 0.15, g + 0.6, k + 1, 0.8);
      }
      box(30.3, 47.5, 7.0, 8.5, gh(39, 7.7) - 0.4, gh(39, 7.7) + 1.5, COL.hedge[2]);
      // green mesh gate between green posts, the bins behind it
      const GO = 7.7;
      for (const s of [27.15, 29.35]) box(s - 0.04, s + 0.04, GO - 0.04, GO + 0.04, gh(s, GO) - 0.1, gh(s, GO) + 1.65, COL.gate);
      K.panel(along(27.2, GO), along(29.3, GO), 1.55);
      for (const y of [0.1, 0.85, 1.6]) bar([27.2, gh(27.2, GO) + y, GO], [29.3, gh(29.3, GO) + y, GO], 0.045, COL.gate);
      bar([28.25, gh(28.25, GO) + 0.1, GO], [28.25, gh(28.25, GO) + 1.6, GO], 0.045, COL.gate);
      for (const [s, o] of [[29.75, 9.0], [29.8, 9.75]]) {
        const y = gh(s, o);
        box(s - 0.27, s + 0.27, o - 0.3, o + 0.3, y, y + 0.95, COL.bin); box(s - 0.3, s + 0.3, o - 0.33, o + 0.33, y + 0.95, y + 1.03, COL.binLid);
      }
      // weathered plank fence from the gate back up the street, a big bush leaning over it
      for (let s = 9.4; s < 27.1; s += 1.6) {
        const s1 = Math.min(27.1, s + 1.6), ya = gh(s, GO) + 0.04, yb = gh(s1, GO) + 0.04;
        const Q = quads.planks, u = (s1 - s) / 1.6;
        for (const [qs, qy, uu, vv] of [[s, ya, 0, 0], [s1, yb, u, 0], [s1, yb + 1.3, u, 1], [s, ya, 0, 0], [s1, yb + 1.3, u, 1], [s, ya + 1.3, 0, 1]]) { Q.pos.push(qs, qy, GO); Q.uv.push(uu + s / 1.6, vv); }
        box(s - 0.05, s + 0.05, GO + 0.03, GO + 0.13, ya - 0.1, ya + 1.15, 0x8f8478);
      }
      for (const [s, o, rad] of [[24.4, 10.0, 1.7], [22.3, 10.5, 1.5], [26.0, 9.3, 1.2], [20.3, 9.6, 1.1]]) { blob(s, o, rad, gh(s, o) + rad * 0.85, (s | 0)); blob(s + 0.5, o + 0.6, rad * 0.8, gh(s, o) + rad * 1.5, (s | 0) + 1); }
      // towards the neighbour: wire fence with a row of dark thujas behind it
      K.fence(F, 47.6, 64, 7.2, 1.3, 0x8a9a90);
      for (let s = 48.3, k = 0; s < 64; s += 0.78, k++) {
        const o = 8.25 + (r() - 0.5) * 0.15, y = gh(s, o), hgt = 1.5 + r() * 0.7, rad = 0.36 + r() * 0.08;
        add(new THREE.CylinderGeometry(rad * 0.85, rad, hgt * 0.5, 8).translate(s, y + hgt * 0.25, o), COL.thuja[k % 3]);
        add(new THREE.ConeGeometry(rad * 0.85, hgt * 0.5, 8).translate(s, y + hgt * 0.75, o), COL.thuja[k % 3]);
      }
    }

    // ---- meshes
    for (const k of Object.keys(quads)) {
      const Q = quads[k], opt = TEX[k][2] || {};
      if (!Q.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(Q.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(Q.uv, 2));
      g.computeVertexNormals();
      const f = opt.ground || -1;
      const mat = new THREE.MeshLambertMaterial({ map: TEX[k][0], side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f });
      if (opt.alpha) { if (opt.ground) { mat.transparent = true; mat.depthWrite = false; } else mat.alphaTest = 0.5; }
      const mesh = new THREE.Mesh(g, mat);
      mesh.receiveShadow = true;
      mesh.castShadow = shadows && !opt.ground;
      local.add(mesh);
    }
    const body = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    body.castShadow = shadows; body.receiveShadow = true;
    local.add(body);
    K.finish();

    // ---- what a car cannot drive through (the buildings are solid in the map already)
    const hard = (s0, s1, o0, o1) => { const [x, z] = along((s0 + s1) / 2, (o0 + o1) / 2); return { x, z, yaw: TURN, hx: Math.abs(s1 - s0) / 2, hz: Math.abs(o1 - o0) / 2 }; };
    world.addSolids([
      hard(30.4, 47.4, 7.0, 8.5), hard(9.4, 29.4, 7.6, 7.8), hard(47.6, 64, 7.1, 7.3),
      hard(-3.7, -3.3, -7.4, -7.0), hard(29.8, 30.2, -6.6, -6.2), hard(61.8, 62.2, -6.6, -6.2), hard(94.8, 95.2, -6.6, -6.2),
    ]);
  }

  const [CX, CZ] = along(45, 0);
  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CX, car.z - CZ) > 450) return;
      if ([[S0, 0], [S1, 0], [45, 20], [45, -12]].every((q) => world.ready(...along(q[0], q[1])))) build();
    },
  };
}
