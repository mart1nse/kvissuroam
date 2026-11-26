// Thumbs up between players (Martin, 2026-11-23: like a Ride On in Zwift or kudos in Strava). The 👍 next to a
// name in the online list sends one; the receiver's car then shows a neon thumbs up with the sender's colour
// dot and name in its back window for five seconds, like an LED sign behind the glass. Cars without a back
// window in view (Carrera GT, F40) show it on the engine cover; on the light Carrera GT it is drawn in deeper
// magenta and plum instead of light (no dark plate behind it, Martin asked for none). The Impreza's wing
// crosses the window, so its thumb is bigger and the name goes under the wing line.
// Everybody near sees the sign on that car, the sender too, as their confirmation.
//
// Collected (Martin, 2026-11-24): after its 5 s the big sign shrinks into a small thumb at the top edge of the
// back window; those received this session line up there in rows and columns (`grid`), the last place shows
// +N once they are full. Everybody near sees a car's collection (the server counts each player's, so one who
// comes later sees it too). Big signs come one at a time per car, at least 5 s apart: the rest wait their turn.
//
// Light by design: one painted 512 px picture per sender (0.6 of that on phones, paintScale), painted in the
// work queue a step a frame and kept for the next time (the last few), one flat piece drawn for five seconds.
import * as THREE from 'three';
import { jobs } from './jobs.js';
import { paintScale } from './world/paintscale.js';

export const KUDOS_S = 5;              // how long the sign shows
export { KUDOS_GAP_S } from './net/kudosrules.js';   // one sender to one receiver: once in this long (the server holds to it too)

// where the sign sits on each car: centre (y up, z back, metres in the car's own frame), size, and its lean
// back from upright (radians). Measured on the game's car models in the car viewer.
const SPOTS = {
  w201: { y: 1.17, z: 1.13, s: 0.5, tilt: 1.0 },
  audi200: { y: 1.2, z: 2.0, s: 0.55, tilt: 1.1 },
  passat: { y: 1.28, z: 2.09, s: 0.44, tilt: 0.54 },
  crv: { y: 1.32, z: 2.19, s: 0.42, tilt: 0.38 },
  enyaq: { y: 1.3, z: 2.23, s: 0.42, tilt: 0.61 },
  rav4: { y: 1.35, z: 2.165, s: 0.4, tilt: 0.4 },
  mazda6: { y: 1.235, z: 2.175, s: 0.42, tilt: 0.98 },
  bz4x: { y: 1.33, z: 2.3, s: 0.42, tilt: 0.54 },
  m3: { y: 1.22, z: 1.5, s: 0.66, tilt: 1.15 },
  impreza: { y: 1.15, z: 1.36, s: 0.6, tilt: 1.08 },
  f40: { y: 1.06, z: 1.15, s: 0.72, tilt: 1.47 },
  cgt: { y: 0.99, z: 1.35, s: 0.72, tilt: 1.45, dark: true },
  rocket: { y: 1.0, z: 1.45, s: 0.7, tilt: 1.38, dark: true },
  bus: { y: 1.95, z: 6.36, s: 1.0, tilt: 0, grid: [6, 3] },
};
// small thumbs in a row across the top of the window, rows downwards: [columns, rows] (default 6 x 2)
for (const k of ['cgt', 'f40', 'rocket']) { SPOTS[k].grid = [3, 1]; SPOTS[k].c = 0.2; SPOTS[k].low = true; }   // (engine cover, no window: a few only, a little bigger, at its back edge: the front one hides behind the roll hoops)
SPOTS.m3.grid = [5, 2]; SPOTS.audi200.grid = [5, 2]; SPOTS.w201.grid = [5, 2]; SPOTS.impreza.grid = [5, 2];
const MORPH_S = 0.7;                    // the big sign shrinking into its place
const NEON = '#ff2bd6';
const CACHE = 4;                        // painted signs kept for a sender who sends again

// the thumbs up, on a 100 x 100 grid: fist and thumb in one line, the cuff, three finger lines
function thumbPath(g, s, ox, oy) {
  const P = (x, y) => [ox + x * s, oy + y * s];
  g.beginPath();
  g.moveTo(...P(30, 46)); g.lineTo(...P(42, 22)); g.quadraticCurveTo(...P(46, 11), ...P(53, 15)); g.quadraticCurveTo(...P(59, 20), ...P(56, 31));
  g.lineTo(...P(53, 42)); g.lineTo(...P(80, 42)); g.quadraticCurveTo(...P(88, 42), ...P(87, 49)); g.quadraticCurveTo(...P(87, 54), ...P(82, 55));
  g.quadraticCurveTo(...P(87, 57), ...P(86, 62)); g.quadraticCurveTo(...P(85, 67), ...P(80, 67)); g.quadraticCurveTo(...P(85, 69), ...P(84, 73));
  g.quadraticCurveTo(...P(83, 78), ...P(78, 78)); g.quadraticCurveTo(...P(82, 80), ...P(81, 84)); g.quadraticCurveTo(...P(80, 88), ...P(74, 88));
  g.lineTo(...P(30, 88)); g.closePath();
  g.moveTo(...P(15, 46)); g.lineTo(...P(25, 46)); g.lineTo(...P(25, 90)); g.lineTo(...P(15, 90)); g.closePath();
  for (const [a, b, y] of [[62, 82, 55], [62, 80, 67], [62, 78, 78]]) { g.moveTo(...P(a, y)); g.lineTo(...P(b, y)); }
}

// one sign: glowing tube thumb, then the sender's dot and name under it. `dark`: for light paint
function paintSign(g, W, name, colour, dark, big) {
  const k = W / 512;
  g.clearRect(0, 0, W, W);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const s = (big ? 3.7 : 3.25) * k, ox = W / 2 - 51 * s, oy = (big ? -30 : -22) * k;
  const layers = dark ? [[22, 0.45, '#7a0a64', 26], [12, 1, '#a3108a', 10], [4, 1, '#e02cc0', 2]] : [[22, 0.35, NEON, 30], [12, 0.9, NEON, 14], [4, 1, '#fff', 4]];
  for (const [w, a, c, blur] of layers) {
    g.globalAlpha = a; g.strokeStyle = c; g.lineWidth = w * k; g.shadowColor = dark ? '#7a0a64' : NEON; g.shadowBlur = blur * k;
    thumbPath(g, s, ox, oy); g.stroke();
  }
  g.globalAlpha = 1;
  let fs = 100;
  g.font = `400 ${fs * k}px "Russo One", sans-serif`;
  const r = 26 * k, gap = 20 * k, room = W - 40 * k;
  let tw = g.measureText(name).width;
  if (tw + 2 * r + gap > room) { fs = Math.max(40, fs * (room - 2 * r - gap) / tw); g.font = `400 ${fs * k}px "Russo One", sans-serif`; tw = g.measureText(name).width; }
  g.textBaseline = 'middle';
  const x0 = W / 2 - (tw + 2 * r + gap) / 2, y = (big ? 425 : 400) * k;
  g.shadowColor = colour; g.shadowBlur = 24 * k; g.fillStyle = colour;
  g.beginPath(); g.arc(x0 + r, y, r, 0, Math.PI * 2); g.fill();
  g.shadowColor = dark ? '#7a0a64' : NEON; g.shadowBlur = (dark ? 8 : 16) * k; g.fillStyle = dark ? '#5a0a50' : '#fff';
  g.fillText(name, x0 + 2 * r + gap, y + 3 * k);
  g.shadowBlur = 0;
}

export function createKudos({ bags = () => [], onBig } = {}) {
  const plane = new THREE.PlaneGeometry(1, 1);
  const signs = new Map();             // key -> { tex, used, busy }
  const live = [];                     // big signs up now: { mesh, t, key, sign, board, from }
  const waiting = new Map();           // group -> [{ carId, from, cb }] big signs waiting their turn
  const boards = new Map();            // group -> a car's board (big sign and collection), see boardOf
  let fontReady = false;
  try { document.fonts?.load('400 100px "Russo One"').then(() => { fontReady = true; }, () => { fontReady = true; }); } catch { fontReady = true; }

  // ---- shared small pictures, painted once: a neon thumb (light and dark) and a soft white dot
  const small = {};
  function smallTex(kind) {
    if (small[kind]) return small[kind];
    const W = kind === 'dot' ? 32 : 128, cv = document.createElement('canvas'); cv.width = cv.height = W;
    const g = cv.getContext('2d');
    if (kind === 'dot') { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, '#fff'); gr.addColorStop(0.75, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, W); }
    else {
      const dark = kind === 'dark', k = W / 100, sc = 0.82 * k;
      g.lineJoin = 'round'; g.lineCap = 'round';
      const layers = dark ? [[9, 0.5, '#7a0a64', 6], [5, 1, '#a3108a', 3], [2, 1, '#e02cc0', 1]] : [[9, 0.4, NEON, 8], [5, 0.95, NEON, 4], [1.8, 1, '#fff', 1]];
      for (const [w, a, c, blur] of layers) { g.globalAlpha = a; g.strokeStyle = c; g.lineWidth = w * k; g.shadowColor = dark ? '#7a0a64' : NEON; g.shadowBlur = blur * k; thumbPath(g, sc, W / 2 - 51 * sc, W / 2 - 50 * sc); g.stroke(); }
    }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.userData.keepImage = true;
    return (small[kind] = tex);
  }
  const mats = {};
  const matOf = (kind, dark) => mats[kind + dark] || (mats[kind + dark] = new THREE.MeshBasicMaterial({ map: smallTex(kind === 'thumb' ? (dark ? 'dark' : 'light') : 'dot'), transparent: true, depthWrite: false, toneMapped: false,
    blending: dark ? THREE.NormalBlending : THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  // "+N" in the last place: a small picture of its own, made anew when N changes (never repainted)
  function plusTex(n, dark) {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
    const g = cv.getContext('2d');
    g.font = `400 ${n > 99 ? 44 : 58}px "Russo One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = dark ? '#7a0a64' : NEON; g.shadowBlur = 10; g.fillStyle = dark ? '#5a0a50' : '#fff';
    g.fillText(`+${n}`, 64, 68);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.userData.keepImage = true;
    return tex;
  }

  // a car's board: lies on its back window (or engine cover), x across, y up the glass
  function boardOf(group, carId) {
    let b = boards.get(group);
    if (b && b.carId === carId) return b;
    if (b) dropBoard(group);
    const spot = SPOTS[carId];
    if (!spot) return null;
    const root = new THREE.Group();
    root.name = 'thumbs up board';
    root.position.set(0, spot.y, spot.z); root.rotation.x = -spot.tilt;
    group.add(root);
    const [cols, rows] = spot.grid || [6, 2], c = spot.c || Math.max(0.105, spot.s * 0.27), pitch = c * 1.12;   // (a touch bigger, Martin 2026-11-24)
    const slots = [];
    for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) slots.push([(i - (cols - 1) / 2) * pitch, spot.low ? -spot.s * 0.3 + r * pitch : spot.s * 0.5 - c * 0.5 - r * pitch]);
    b = { group, carId, spot, root, slots, c, key: '', thumbs: null, dots: null, plus: null, plusN: 0 };
    boards.set(group, b);
    return b;
  }
  function dropBoard(group) {
    const b = boards.get(group);
    if (!b) return;
    b.root.parent?.remove(b.root);
    b.plus?.material.map.dispose(); b.plus?.material.dispose();
    b.thumbs?.dispose(); b.dots?.dispose();
    boards.delete(group);
  }
  // how many of a car's thumbs are not shown small yet (big now, or waiting)
  const pending = (group) => (waiting.get(group)?.length || 0) + live.filter((l) => l.group === group).length;

  // the small thumbs on a board: n received, colours of their senders (oldest first)
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color();
  function layout(b, n, colours, from = []) {
    const key = `${n}|${colours.slice(-b.slots.length).join(',')}`;
    if (key === b.key) return;
    b.key = key;
    const cap = b.slots.length, dark = !!b.spot.dark;
    if (!b.thumbs) {
      b.thumbs = new THREE.InstancedMesh(plane, matOf('thumb', dark), cap);
      b.dots = new THREE.InstancedMesh(plane, matOf('dot', dark), cap);
      for (const m of [b.thumbs, b.dots]) { m.renderOrder = 2; m.frustumCulled = false; m.layers.enable(1); b.root.add(m); }
      b.thumbs.name = 'thumbs up small'; b.dots.name = 'thumbs up dots';
    }
    const full = n > cap, shown = full ? cap - 1 : n;
    const cols = colours.slice(-shown);            // (full: the newest ones)
    // who gave which (for a click on one, see pick): the newest `shown` in their places, the older ones under +N
    b.who = from.slice(-shown); b.older = from.slice(0, Math.max(0, from.length - shown)).reverse(); b.olderN = full ? n - shown : 0;
    for (let i = 0; i < shown; i++) {
      const [x, y] = b.slots[i];
      b.thumbs.setMatrixAt(i, M.compose(V.set(x, y, 0), Q, S.set(b.c, b.c, 1)));
      b.dots.setMatrixAt(i, M.compose(V.set(x + b.c * 0.34, y - b.c * 0.36, 0.001), Q, S.set(b.c * 0.4, b.c * 0.4, 1)));
      b.dots.setColorAt(i, C.set(cols[i] || '#ffffff'));
    }
    b.thumbs.count = b.dots.count = shown;
    b.thumbs.instanceMatrix.needsUpdate = b.dots.instanceMatrix.needsUpdate = true;
    if (b.dots.instanceColor) b.dots.instanceColor.needsUpdate = true;
    const more = full ? n - shown : 0;
    if (more !== b.plusN) {
      b.plusN = more;
      if (b.plus) { b.root.remove(b.plus); b.plus.material.map.dispose(); b.plus.material.dispose(); b.plus = null; }
      if (more) {
        const mat = new THREE.MeshBasicMaterial({ map: plusTex(more, dark), transparent: true, depthWrite: false, toneMapped: false,
          blending: dark ? THREE.NormalBlending : THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
        b.plus = new THREE.Mesh(plane, mat);
        const [x, y] = b.slots[cap - 1];
        b.plus.position.set(x, y, 0); b.plus.scale.set(b.c * 1.1, b.c * 1.1, 1);
        b.plus.renderOrder = 2; b.plus.layers.enable(1);
        b.root.add(b.plus);
      }
    }
  }

  function evict() {
    while (signs.size > CACHE) {
      let old = null;
      for (const [k, v] of signs) if (!v.busy && (!old || v.used < signs.get(old).used)) old = k;
      if (!old) return;
      signs.get(old).tex.dispose(); signs.delete(old);
    }
  }

  // a big sign for a car (its model group and car id); from: { name, colour }; cb() when it goes up
  // (one at a time on each car: the others wait their turn, so all are seen)
  function show(group, carId, from, cb) {
    if (!group || !SPOTS[carId] || !from?.name) return;
    let q = waiting.get(group);
    if (!q) waiting.set(group, (q = []));
    q.push({ carId, from, cb });
  }
  function start(group, { carId, from, cb }) {
    const spot = SPOTS[carId];
    const key = `${from.name}|${from.colour}|${spot.dark ? 1 : 0}|${carId === 'impreza' ? 1 : 0}`;
    const l = { mesh: null, t: 0, key, sign: null, group, carId, from };
    live.push(l);                                  // (counted as up already, while it is painted)
    jobs.add(function* kudosSign() {
      let sign = signs.get(key);
      if (!sign) {
        for (let i = 0; i < 30 && !fontReady; i++) yield;            // (Russo One, half a second at most)
        yield 'frame';
        const W = Math.round(512 * Math.min(1, Math.max(0.5, paintScale())));
        const cv = document.createElement('canvas'); cv.width = W; cv.height = W;
        paintSign(cv.getContext('2d'), W, from.name, from.colour || '#2ff3ff', !!spot.dark, carId === 'impreza');
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
        tex.userData.keepImage = true;   // (phones: kept as it is, at most CACHE small canvases; freed here in evict, see phonetex.js)
        sign = { tex, used: 0 };
        signs.set(key, sign);
        yield 'frame';
        jobs.upload(tex);
        yield;
      }
      sign.used = performance.now(); sign.busy = true;
      evict();
      const b = boardOf(group, carId);
      if (!b || !live.includes(l)) return;
      const mat = new THREE.MeshBasicMaterial({ map: sign.tex, transparent: true, depthWrite: false, toneMapped: false, opacity: 0,
        blending: spot.dark ? THREE.NormalBlending : THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
      const mesh = new THREE.Mesh(plane, mat);
      mesh.name = 'thumbs up';
      mesh.scale.set(spot.s, spot.s, 1);
      mesh.position.z = 0.002;
      mesh.renderOrder = 3;
      mesh.layers.enable(1);
      b.root.add(mesh);
      l.mesh = mesh; l.sign = sign; l.board = b; l.t = 0;
      cb?.();
    }, 'thumbs up');
  }
  const ease = (x) => x * x * (3 - 2 * x);

  // each frame: the next waiting sign goes up, the one up flickers on like a neon tube, shows five seconds,
  // then shrinks into its place on the window; the collections follow the counts
  function update(dt) {
    for (const [group, q] of waiting) {
      if (!q.length) { waiting.delete(group); continue; }
      if (!group.parent) { waiting.delete(group); continue; }            // (the car is gone: a car change)
      if (!live.some((l) => l.group === group)) start(group, q.shift());
    }
    for (let i = live.length - 1; i >= 0; i--) {
      const l = live[i];
      if (!l.mesh) { if (!l.group.parent) live.splice(i, 1); continue; }   // (still being painted)
      l.t += dt;
      const t = l.t, m = l.mesh.material, b = l.board;
      m.opacity = t < 0.45 ? [1, 0.25, 1, 0.4, 1][Math.floor(t / 0.09)] ?? 1 : 1;
      if (t > KUDOS_S) {
        // shrink to the place this thumb takes (the last one when the window is full): the thumb in the big
        // picture sits 0.23 of its height above the middle and fills half of it, a small one 0.8 of its own
        const k = ease(Math.min(1, (t - KUDOS_S) / MORPH_S)), shown = b.thumbs?.count ?? 0;
        const [x, y] = b.slots[Math.min(shown, b.slots.length - 1)], sc = b.c * 1.6;
        const s = b.spot.s + (sc - b.spot.s) * k;
        l.mesh.scale.set(s, s, 1);
        l.mesh.position.set(x * k, (y - 0.23 * sc) * k, 0.002);
      }
      if (t >= KUDOS_S + MORPH_S || !l.group.parent) {
        l.mesh.parent?.remove(l.mesh);
        m.dispose();
        live.splice(i, 1);
        l.sign.busy = live.some((o) => o.sign === l.sign);
      }
    }
    // the collections: each car near with thumbs received (bags: [{ group, car, n, colours }])
    const seen = new Set();
    for (const bag of bags()) {
      if (!bag.n || !bag.group?.parent) continue;
      const b = boardOf(bag.group, bag.car);
      if (!b) continue;
      seen.add(bag.group);
      layout(b, Math.max(0, bag.n - pending(bag.group)), bag.colours, bag.from);
    }
    for (const g of boards.keys()) if (!seen.has(g) && !live.some((l) => l.group === g) && !waiting.has(g)) dropBoard(g);
  }

  // A click or tap at (x, y) px on the screen: the small thumb nearest to it within `reach` px, on any car's
  // window ({ who: [id, name, ms] } or, on the +N place, { older: [...], more }), else null. Only the places of
  // the thumbs shown are projected, and only on a click: nothing a frame (Martin, 2026-11-24).
  const P = new THREE.Vector3();
  function pick(camera, x, y, W, H, reach = 26) {
    let best = null, bd = reach * reach;
    for (const b of boards.values()) {
      const shown = b.thumbs?.count || 0;
      if (!shown && !b.plus) continue;
      b.root.updateWorldMatrix(true, false);
      const n = shown + (b.plus ? 1 : 0);                        // (the +N place is the one after the thumbs)
      for (let i = 0; i < n; i++) {
        const [sx, sy] = b.slots[Math.min(i, b.slots.length - 1)];
        P.set(sx, sy, 0).applyMatrix4(b.root.matrixWorld).project(camera);
        if (P.z > 1) continue;                                   // (behind the camera)
        const px = (P.x + 1) / 2 * W, py = (1 - P.y) / 2 * H, d = (px - x) ** 2 + (py - y) ** 2;
        if (d < bd) { bd = d; best = i >= shown ? { older: b.older, more: b.olderN, x: px, y: py } : { who: b.who[i], x: px, y: py }; }
      }
    }
    return best;
  }

  return { show, update, pick, get showing() { return live.length + waiting.size; } };
}
