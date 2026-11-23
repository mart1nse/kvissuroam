// The Raadi rally stage (?raadi=1 while it is being tried out): a copy of SSS16 "Tartu vald" of Rally
// Estonia 2026, 1.77 km of gravel paths in Raadi manor park round the Majoraadi ponds, north of ERM.
// Point to point, one car at a time, from a standing start (Martin, 23 Nov 2026).
//
// Drive up to the start (or use the RAADI button) and the car is put on the start line and held there while
// the start lights count down: five red lights go out one a second, then green. The clock runs to the
// flying finish; the STOP board is a little further on.
//
// The stage passes some junctions twice going another way each time, and the stretch on the west side of
// the ponds twice: red and white barriers across the side paths show the way, and slide aside when the
// stage needs that path later. An arrow under the clock points along the stage. At each corner a cone
// stands a metre inside the apex: knocking it flies it off (it is back for the next run), but going more
// than 3 m inside the edge there, or joining the stage further on from anywhere else, cancels the run.
// Running wide on the outside is fine.
//
// The paths carry the wheel tracks of the cars that drove the stage: two grooves along the racing line,
// darker where they braked, and the grass torn up inside the apexes and on the outside of the exits.
//
// All built from src/race/raadi.json (tools/race/build-raadi.py) when the car comes within 600 m.
import * as THREE from 'three';
import STAGE from './raadi.json';
import { jobs } from '../jobs.js';
import { fmtTime, escapeHtml } from './race.js';

const KEY = 'kvissuroam.raadi';            // this browser's stage times
const NEAR_START = 24;                     // within this of the start line (and not on a run) the car is put on it
const BUILD_R = 600;                       // the stage's things are built within this of it
const COUNT_S = 2;                         // seconds before the first red light
const OFF_LIMIT = 150;                     // metres off the stage before the run is cancelled
const APEX_CUT = 3;                        // metres inside the edge at an apex before the run is cancelled

const P = STAGE.pts, HW = STAGE.hw, N = P.length, START = STAGE.start, FIN = STAGE.finish;
const TAN = P.map((_, i) => {
  const a = P[Math.max(0, i - 1)], b = P[Math.min(N - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
});
const S = new Float64Array(N);
for (let i = 1; i < N; i++) S[i] = S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
// a point beside the centre line: d metres to the right of the direction of travel
const side = (i, d) => [P[i][0] - TAN[i][1] * d, P[i][1] + TAN[i][0] * d];
const yawAt = (i) => Math.atan2(TAN[i][0], -TAN[i][1]);

// nearest point of the stage between indices lo and hi: { i, d, lat } (lat: sideways, + right of travel)
function nearestIn(x, z, lo, hi) {
  let best = { i: -1, d: Infinity, lat: 0 };
  lo = Math.max(0, lo); hi = Math.min(N - 2, hi);
  for (let i = lo; i <= hi; i++) {
    const a = P[i], b = P[i + 1], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    const ex = x - a[0] - dx * t, ez = z - a[1] - dz * t, d = Math.hypot(ex, ez);
    if (d < best.d) best = { i: t > 0.5 ? i + 1 : i, d, lat: -ex * TAN[i][1] + ez * TAN[i][0] };
  }
  return best;
}

// the stage's line for a small picture (start screen, buttons): an SVG path, north up
export function stagePath(size = 1000, pad = 60) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = START; i <= FIN; i++) { const [x, z] = P[i]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const k = (size - pad * 2) / Math.max(x1 - x0, z1 - z0);
  const w = (x1 - x0) * k + pad * 2, h = (z1 - z0) * k + pad * 2;
  let d = '';
  for (let i = START; i <= FIN; i += 2) d += `${i > START ? 'L' : 'M'}${((P[i][0] - x0) * k + pad).toFixed(1)} ${((P[i][1] - z0) * k + pad).toFixed(1)}`;
  const at = (i) => [((P[i][0] - x0) * k + pad).toFixed(1), ((P[i][1] - z0) * k + pad).toFixed(1)];
  return { d, w: w.toFixed(1), h: h.toFixed(1), start: at(START), finish: at(FIN) };
}
export const STAGE_KM = (STAGE.length / 1000).toFixed(1);

// a road of the map that the stage runs along (most of its points within 3 m of the stage's centre line):
// its painted wheel tracks give way to the stage's own (src/world/roadtex.js)
const grid = new Map();
for (let i = 0; i < N; i++) { const k = `${Math.floor(P[i][0] / 8)}_${Math.floor(P[i][1] / 8)}`; (grid.get(k) || grid.set(k, []).get(k)).push(i); }
function nearLine(x, z, r) {
  const gx = Math.floor(x / 8), gz = Math.floor(z / 8);
  for (let a = gx - 1; a <= gx + 1; a++) for (let b = gz - 1; b <= gz + 1; b++) {
    for (const i of grid.get(`${a}_${b}`) || []) if (Math.hypot(P[i][0] - x, P[i][1] - z) < r) return true;
  }
  return false;
}
export function onStage(road) {
  const pts = road.pts;
  if (!pts?.length || !pts.some(([x, z]) => x > 2250 && x < 3050 && z > 200 && z < 850)) return false;
  let n = 0, k = 0;
  for (let j = 0; j < pts.length - 1; j++) {
    const [ax, az] = pts[j], [bx, bz] = pts[j + 1], m = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 3));
    for (let q = 0; q < m; q++) { const t = q / m; n++; if (nearLine(ax + (bx - ax) * t, az + (bz - az) * t, 3)) k++; }
  }
  return k >= n * 0.5;
}

function loadRuns() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }

// ---------------------------------------------------------------- pictures
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// The FIA control area signs (WRC sporting regulations, the signs of a stage): a yellow clock (time
// control ahead), the red flag of the start, the yellow chequered flag of the finish ahead, the red
// chequered flag of the flying finish, and the red STOP board. One small picture of five squares.
const SIGNS = { tc: 0, start: 1, warn: 2, finish: 3, stop: 4 };
function signAtlas() {
  return canvasTex(640, 128, (g) => {
    const tile = (k, bg, draw) => {
      g.save(); g.translate(k * 128, 0);
      g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = bg; g.fillRect(6, 6, 116, 116);
      draw(); g.restore();
    };
    const YEL = '#f6c400', RED = '#d8121b';
    const clock = () => {
      g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 6;
      g.beginPath(); g.arc(64, 64, 40, 0, Math.PI * 2); g.fill(); g.stroke();
      g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 36); g.moveTo(64, 64); g.lineTo(84, 72); g.stroke();
      for (let a = 0; a < 12; a++) { const r = a * Math.PI / 6; g.fillStyle = '#111'; g.fillRect(64 + Math.sin(r) * 33 - 2, 64 - Math.cos(r) * 33 - 2, 4, 4); }
    };
    const flag = (chq) => {
      g.fillStyle = '#111'; g.fillRect(34, 26, 6, 80);
      const fx = 40, fy = 28, fw = 54, fh = 38;
      if (!chq) { g.fillStyle = '#fff'; g.fillRect(fx, fy, fw, fh); g.strokeStyle = '#111'; g.lineWidth = 3; g.strokeRect(fx, fy, fw, fh); return; }
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#fff' : '#111'; g.fillRect(fx + i * fw / 6, fy + j * fh / 4, fw / 6 + 0.5, fh / 4 + 0.5); }
      g.strokeStyle = '#111'; g.lineWidth = 3; g.strokeRect(fx, fy, fw, fh);
    };
    tile(0, YEL, clock);
    tile(1, RED, () => flag(false));
    tile(2, YEL, () => flag(true));
    tile(3, RED, () => flag(true));
    tile(4, RED, () => {
      g.fillStyle = '#fff'; g.font = '900 44px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('STOP', 64, 66);
    });
  });
}

// grey streaks for the wheel tracks (multiplied over the ground: white is no change)
function streakTex() {
  const W = 32, H = 128, d = new Uint8Array(W * H * 4);
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const cols = Array.from({ length: W }, rnd), rows = Array.from({ length: H }, rnd);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x + 0.5) / W;
    const edge = Math.min(1, Math.min(u, 1 - u) * 5);           // soft sides
    const v = 0.72 + 0.18 * cols[x] + 0.1 * rows[y] * rnd();
    const o = (y * W + x) * 4;
    d[o] = d[o + 1] = d[o + 2] = Math.round(255 * Math.min(1, v) * edge);     // (premultiplied, as the multiply blend needs)
    d[o + 3] = Math.round(255 * edge);
  }
  const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat);
  t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------- the stage
export function createStage({ world, scene, toast, place, onRun }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const runs = loadRuns();
  let built = false;

  // ---- HUD: the clock (the lap timer's look), the start lights, the arrow, BACK TO STAGE START
  const hudEl = document.querySelector('#hud');
  const panel = document.createElement('div');
  panel.id = 'stage';
  panel.className = 'hidden';
  panel.innerHTML = `<div class="lt"><span class="lbl">STAGE</span><b>0:00.00</b></div>
    <div class="lb"><span class="lbl">BEST <span class="car"></span></span><b class="best"></b></div><div class="msg"></div>`;
  hudEl.appendChild(panel);
  const elTime = panel.querySelector('.lt b'), elBest = panel.querySelector('.best'), elCar = panel.querySelector('.car'), elMsg = panel.querySelector('.msg');
  const lights = document.createElement('div');
  lights.id = 'rallylights';
  lights.className = 'hidden';
  lights.innerHTML = `<div class="lamps">${'<i></i>'.repeat(5)}<i class="g"></i></div><div class="cap"></div>`;
  hudEl.appendChild(lights);
  const lamps = [...lights.querySelectorAll('i')], lCap = lights.querySelector('.cap');
  const arrow = document.createElement('div');
  arrow.id = 'stagearrow';
  arrow.className = 'hidden';
  arrow.innerHTML = '<svg viewBox="-50 -50 100 100"><path d="M0 -40 L30 0 L12 0 L12 38 L-12 38 L-12 0 L-30 0 Z"/></svg>';
  hudEl.appendChild(arrow);
  const again = document.createElement('button');
  again.id = 'stageagain';
  again.className = 'hidden';
  again.innerHTML = '↺ BACK TO STAGE START';
  hudEl.appendChild(again);
  again.addEventListener('click', () => { again.blur(); goStart(); });

  const st = {
    phase: 'idle',          // idle, count (on the start line, lights), run, done
    t0: 0, clk: 0, wall: null, carT: null, prog: START, off: 0, prev: null, cool: false, againUntil: 0,
    pin: null, countAt: 0, cut: '',
  };

  // ---- the stage's things (built near)
  const atlas = signAtlas();
  const signMat = new THREE.MeshLambertMaterial({ map: atlas, side: THREE.DoubleSide });
  const postMat = new THREE.MeshLambertMaterial({ color: 0x8a8d92 });
  const cones = [], barriers = [];
  let coneMesh = null, barMesh = null, startLamps = null;
  const lampOff = new THREE.MeshBasicMaterial({ color: 0x2a0d10 });
  const lampRed = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  const lampGreen = new THREE.MeshBasicMaterial({ color: 0x29ff6a });
  const lampGreenOff = new THREE.MeshBasicMaterial({ color: 0x0b2a14 });
  const groundY = (x, z) => world.heightAt(x, z);

  function sign(kind, i, d, h = 1.7) {
    const [x, z] = side(i, d), y = groundY(x, z);
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, h, 6), postMat);
    post.position.y = h / 2; g.add(post);
    const geo = new THREE.PlaneGeometry(0.8, 0.8);
    const k = SIGNS[kind], uv = geo.attributes.uv;
    for (let j = 0; j < uv.count; j++) uv.setX(j, (k + uv.getX(j)) / 5);
    const board = new THREE.Mesh(geo, signMat);
    board.position.y = h + 0.3; board.position.z = 0.05;
    g.add(board);
    g.position.set(x, y, z);
    g.rotation.y = Math.atan2(-TAN[i][0], -TAN[i][1]);       // facing the cars coming up to it
    g.traverse((o) => { o.castShadow = true; });
    group.add(g);
  }

  // the start clock beside the line: five red lamps over a green one, facing the driver
  function startTower(i, d) {
    const [x, z] = side(i, d), y = groundY(x, z);
    const g = new THREE.Group();
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), postMat);
    leg.position.y = 0.6; g.add(leg);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.5, 0.22), new THREE.MeshLambertMaterial({ color: 0x15151a }));
    box.position.y = 1.95; g.add(box);
    const disc = new THREE.CircleGeometry(0.085, 16);
    startLamps = [];
    for (let k = 0; k < 6; k++) {
      const m = new THREE.Mesh(disc, k < 5 ? lampOff : lampGreenOff);
      m.position.set(0, 2.55 - k * 0.22, 0.115);
      g.add(m); startLamps.push(m);
    }
    g.position.set(x, y, z);
    g.rotation.y = Math.atan2(-TAN[i][0], -TAN[i][1]) + (d > 0 ? -0.5 : 0.5);   // turned towards the car on the line
    group.add(g);
  }

  // a white line across the path
  function line(i, w = 0.3) {
    const hw = HW[i] + 0.3, [ax, az] = side(i, -hw), [bx, bz] = side(i, hw), tx = TAN[i][0] * w / 2, tz = TAN[i][1] * w / 2;
    const pos = [];
    const n = 6;
    for (let k = 0; k <= n; k++) {
      const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
      pos.push(x - tx, groundY(x - tx, z - tz) + 0.04, z - tz, x + tx, groundY(x + tx, z + tz) + 0.04, z + tz);
    }
    const idx = [];
    for (let k = 0; k < n; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xe8e6dc, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    group.add(m);
  }

  // cones: an orange cone with a white band on a dark square foot, all in one mesh
  function coneGeometry() {
    const parts = [];
    const paint = (geo, hex) => {
      const c = new THREE.Color(hex), n = geo.attributes.position.count, col = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return geo.index ? geo.toNonIndexed() : geo;
    };
    parts.push(paint(new THREE.BoxGeometry(0.38, 0.04, 0.38).translate(0, 0.02, 0), 0x202022));
    parts.push(paint(new THREE.CylinderGeometry(0.035, 0.155, 0.2, 12, 1, true).translate(0, 0.14, 0), 0xff5a0a));
    parts.push(paint(new THREE.CylinderGeometry(0.0, 0.035, 0.05, 12, 1, true).translate(0, 0.265, 0), 0xff5a0a));
    parts.push(paint(new THREE.CylinderGeometry(0.155, 0.17, 0.1, 12, 1, true).translate(0, 0.09, 0), 0xff5a0a));
    // (the white band: a ring just over the cone's middle)
    parts.push(paint(new THREE.CylinderGeometry(0.075, 0.105, 0.07, 12, 1, true).translate(0, 0.17, 0).scale(1.04, 1, 1.04), 0xf2f2f2));
    const pos = [], col = [], nor = [];
    for (const g of parts) {
      g.computeVertexNormals();
      pos.push(...g.attributes.position.array); col.push(...g.attributes.color.array); nor.push(...g.attributes.normal.array);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    // twice the size of a road cone: a stage's apex marker (a hay bale or tyre stack would be the real thing)
    geo.scale(1.6, 1.8, 1.6);
    return geo;
  }

  // a red and white barrier plank on two legs, 1 m wide (scaled to the path's width)
  function barrierGeometry() {
    const pos = [], col = [], nor = [];
    const add = (geo, hex) => {
      geo = geo.toNonIndexed(); geo.computeVertexNormals();
      const c = new THREE.Color(hex);
      pos.push(...geo.attributes.position.array); nor.push(...geo.attributes.normal.array);
      for (let k = 0; k < geo.attributes.position.count; k++) col.push(c.r, c.g, c.b);
    };
    const n = 6;
    for (let k = 0; k < n; k++) add(new THREE.BoxGeometry(1 / n, 0.22, 0.04).translate(-0.5 + (k + 0.5) / n, 0.85, 0), k % 2 ? 0xf4f4f4 : 0xd8121b);
    for (const sx of [-0.5, 0.5]) {
      add(new THREE.BoxGeometry(0.04, 0.95, 0.04).translate(sx, 0.47, 0.12).rotateX(0), 0xd8d8d8);
      add(new THREE.BoxGeometry(0.04, 0.95, 0.04).translate(sx, 0.47, -0.12), 0xd8d8d8);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return geo;
  }

  // ---- the wheel tracks and scuffs, one mesh multiplied over the ground
  function* buildTracks() {
    const pos = [], col = [], uv = [], idx = [];
    const LIFT = 0.035;
    // a ribbon along the stage: per point i in [i0, i1], centre offset off(i), half width w(i), strength a(i) and colour c
    const ribbon = function* (i0, i1, off, w, a, c) {
      const base = pos.length / 3;
      let v = 0, n = 0;
      for (let i = i0; i <= i1; i++) {
        const o = off(i), hw = w(i), al = Math.max(0, Math.min(1, a(i)));
        const [lx, lz] = side(i, o - hw), [rx, rz] = side(i, o + hw);
        pos.push(lx, groundY(lx, lz) + LIFT, lz, rx, groundY(rx, rz) + LIFT, rz);
        col.push(c[0] * al, c[1] * al, c[2] * al, al, c[0] * al, c[1] * al, c[2] * al, al);
        uv.push(0, v / 3, 1, v / 3);
        if (i < i1) v += S[i + 1] - S[i];
        if (n) { const q = base + (n - 1) * 2; idx.push(q, q + 1, q + 2, q + 2, q + 1, q + 3); }
        n++;
        if (n % 64 === 0 && jobs.late()) yield;
      }
    };
    const L = STAGE.line;
    // how hard the cars worked the gravel at each point: braking before each corner, turning through it
    const work = new Float32Array(N);
    for (const [k] of STAGE.apex) {
      for (let i = Math.max(0, k - 18); i <= Math.min(N - 1, k + 6); i++) {
        const t = i < k - 3 ? (i - (k - 18)) / 15 : 1 - Math.max(0, i - k) / 6;
        work[i] = Math.max(work[i], Math.max(0, Math.min(1, t)));
      }
    }
    const i0 = Math.max(0, START - 3), i1 = N - 1;
    const GRAV = [0.62, 0.55, 0.47];
    for (const wo of [-0.78, 0.78]) {
      yield* ribbon(i0, i1, (i) => L[i] + wo, (i) => 0.24 + 0.08 * work[i], (i) => 0.42 + 0.4 * work[i], GRAV);
      yield;
    }
    // loose gravel swept to the edges, heavier on the outside of the corners
    for (const sg of [-1, 1]) {
      yield* ribbon(i0, i1, (i) => sg * (HW[i] - 0.35), () => 0.35, (i) => 0.12 + 0.25 * work[i], [0.7, 0.63, 0.55]);
      yield;
    }
    // grass torn up: inside each apex (cut over the edge) and on the outside of its exit (run wide)
    const SOIL = [0.5, 0.4, 0.29];
    for (const [k, sd] of STAGE.apex) {
      const a0 = Math.max(0, k - 7), a1 = Math.min(N - 1, k + 7);
      yield* ribbon(a0, a1, (i) => sd * (HW[i] + 0.55), () => 0.75, (i) => 0.75 * Math.exp(-(((i - k) / 4) ** 2)), SOIL);
      const b0 = Math.min(N - 1, k + 3), b1 = Math.min(N - 1, k + 14);
      yield* ribbon(b0, b1, (i) => -sd * (HW[i] + 0.45), () => 0.6, (i) => 0.5 * Math.sin(Math.PI * (i - b0) / Math.max(1, b1 - b0)), SOIL);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({
      map: streakTex(), vertexColors: true, transparent: true, depthWrite: false, fog: false, toneMapped: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
    });
    // (drawn where it lies but depth-tested a little nearer the camera, so the ground's 1 m grid never pokes through)
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        mvPosition.xyz *= max(0.05, 1.0 - 0.15 / max(length(mvPosition.xyz), 0.6));
        gl_Position = projectionMatrix * mvPosition;`);
    };
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 1;
    m.frustumCulled = false;
    group.add(m);
  }

  function* build() {
    yield* buildTracks();
    yield;
    // signs: yellow time control and the red start flag; the start clock; the line
    sign('tc', 1, HW[1] + 1.4);
    sign('start', START, HW[START] + 1.4);
    startTower(START + 1, -(HW[START + 1] + 1.3));
    line(START);
    const warnAt = (() => { let i = FIN; while (i > 0 && S[FIN] - S[i] < 100) i--; return i; })();
    sign('warn', warnAt, HW[warnAt] + 1.4);
    sign('finish', FIN, HW[FIN] + 1.4);
    sign('finish', FIN, -(HW[FIN] + 1.4));
    line(FIN, 0.2);
    sign('stop', N - 1, HW[N - 1] + 1.4);
    yield;
    // cones
    const cg = coneGeometry();
    coneMesh = new THREE.InstancedMesh(cg, new THREE.MeshLambertMaterial({ vertexColors: true }), STAGE.apex.length);
    coneMesh.castShadow = true;
    coneMesh.frustumCulled = false;
    for (const [k, sd, x, z] of STAGE.apex) cones.push({ k, sd, home: [x, z], p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), flying: false, out: false });
    resetCones();
    group.add(coneMesh);
    // barriers: one at each side path the stage passes
    for (const j of STAGE.junctions) for (const b of j.b) barriers.push({ ...b, t: 1, want: 1 });
    barMesh = new THREE.InstancedMesh(barrierGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), barriers.length);
    barMesh.castShadow = true;
    barMesh.frustumCulled = false;
    group.add(barMesh);
    setBarriers(st.phase === 'run' ? st.prog : START, true);
  }

  const m4 = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1), qy = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  function resetCones() {
    if (!coneMesh) return;
    cones.forEach((c, n) => {
      c.p.set(c.home[0], groundY(c.home[0], c.home[1]), c.home[1]);
      c.v.set(0, 0, 0); c.w.set(0, 0, 0); c.q.identity(); c.flying = false; c.out = false;
      coneMesh.setMatrixAt(n, m4.compose(c.p, c.q, one));
    });
    coneMesh.instanceMatrix.needsUpdate = true;
  }
  // which side paths are shut when the car is at index `prog`; t: 1 shut across the path, 0 slid aside
  function setBarriers(prog, snap = false) {
    for (const b of barriers) b.want = b.always || b.shut.some(([a, c]) => prog >= a && prog <= c) ? 1 : 0;
    if (snap) for (const b of barriers) b.t = b.want;
    drawBarriers();
  }
  function drawBarriers() {
    if (!barMesh) return;
    barriers.forEach((b, n) => {
      // across the path, b.w + 0.6 wide; aside: slid off to the right of the path by its width and turned along it
      const ux = Math.sin(b.yaw), uz = -Math.cos(b.yaw), rx = -uz, rz = ux;       // along the side path, across it
      const e = 1 - b.t, off = e * (b.w + 1.4);
      const x = b.x + rx * off, z = b.z + rz * off;
      qy.setFromAxisAngle(up, -b.yaw + e * Math.PI / 2);
      m4.compose(new THREE.Vector3(x, groundY(x, z), z), qy, new THREE.Vector3(b.w + 0.6, 1, 1));
      barMesh.setMatrixAt(n, m4);
    });
    barMesh.instanceMatrix.needsUpdate = true;
  }

  // ---- the cones against the car
  const prevPos = { x: 0, z: 0, ok: false };
  const tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3();
  function updateCones(car, dt) {
    if (!coneMesh || dt <= 0) return;
    const vx = prevPos.ok ? (car.x - prevPos.x) / dt : 0, vz = prevPos.ok ? (car.z - prevPos.z) / dt : 0;
    prevPos.x = car.x; prevPos.z = car.z; prevPos.ok = true;
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), off = (car.a ?? car.spec.wheelbase / 2) - car.spec.wheelbase / 2;
    const cx = car.x + fx * off, cz = car.z + fz * off;
    const hl = car.spec.wheelbase / 2 + 1.0, hw = (car.spec.track || 1.5) / 2 + 0.35;
    let moved = false;
    cones.forEach((c, n) => {
      if (!c.flying && !c.out) {
        const dx = c.p.x - cx, dz = c.p.z - cz;
        if (dx * dx + dz * dz > 36) return;
        const f = dx * fx + dz * fz, l = -dx * fz + dz * fx;
        if (Math.abs(f) > hl + 0.25 || Math.abs(l) > hw + 0.25) return;
        const sp = Math.hypot(vx, vz);
        if (sp < 0.8) return;
        // off it goes: with the car's speed and a bit more, away from the car's side it was hit by, and up
        const sgn = Math.sign(l) || 1;
        c.v.set(vx * 1.15 + (-fz) * sgn * sp * 0.25, 2 + sp * 0.16, vz * 1.15 + fx * sgn * sp * 0.25);
        c.w.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 18);
        c.flying = true;
      }
      if (!c.flying) return;
      c.v.y -= 9.8 * dt;
      c.p.addScaledVector(c.v, dt);
      tmpV.copy(c.w).multiplyScalar(dt);
      const ang = tmpV.length();
      if (ang > 0) { tmpQ.setFromAxisAngle(tmpV.normalize(), ang); c.q.premultiply(tmpQ); }
      const gy = groundY(c.p.x, c.p.z);
      if (c.p.y < gy) {
        c.p.y = gy;
        c.v.y = -c.v.y * 0.3; c.v.x *= 0.55; c.v.z *= 0.55; c.w.multiplyScalar(0.55);
        if (Math.hypot(c.v.x, c.v.y, c.v.z) < 0.6) { c.flying = false; c.out = true; }
      }
      coneMesh.setMatrixAt(n, m4.compose(c.p, c.q, one));
      moved = true;
    });
    if (moved) coneMesh.instanceMatrix.needsUpdate = true;
  }

  // ---- runs
  function best(carId) {
    let b = null, any = null;
    for (const r of runs) { if (!any || r.ms < any.ms) any = r; if (r.car === carId && (!b || r.ms < b.ms)) b = r; }
    return { car: b, any };
  }
  function renderBest(carId, carShort) {
    const { car: b } = best(carId);
    elCar.textContent = carShort;
    elBest.innerHTML = b ? fmtTime(b.ms / 1000) : '<small>NO TIME YET</small>';
  }

  function setLamps(n, green) {
    lamps.forEach((l, k) => l.classList.toggle('on', k < 5 ? k < n : green));
    if (startLamps) startLamps.forEach((m, k) => { m.material = k < 5 ? (k < n ? lampRed : lampOff) : green ? lampGreen : lampGreenOff; });
  }

  function startPose() { return { x: P[START][0] - TAN[START][0] * 1.6, z: P[START][1] - TAN[START][1] * 1.6, yaw: yawAt(START) }; }
  function goStart() {
    st.cool = false;
    st.phase = 'idle';
    hideAgain();
    const pose = startPose();
    place(pose);
    setup(pose);
  }
  function setup(pose) {
    st.phase = 'count';
    st.pin = pose;
    st.countAt = st.placedAt = performance.now();
    st.prog = START; st.off = 0; st.cut = '';
    resetCones();
    setBarriers(START, true);
    setLamps(0, false);
    elMsg.textContent = '';
    st.prev = null;
  }
  function cancel(why) {
    if (st.phase !== 'run' && st.phase !== 'count') return;
    st.phase = 'done'; st.pin = null; st.cool = true;
    elMsg.textContent = why;
    toast(why, 3200);
    showAgain();
    onRun?.('cancel');
  }
  function showAgain() { st.againUntil = performance.now() + 15000; again.classList.remove('hidden'); }
  function hideAgain() { st.againUntil = 0; again.classList.add('hidden'); }

  return {
    group,
    get pin() { return st.pin; },
    get running() { return st.phase === 'run'; },
    get phase() { return st.phase; },
    get runs() { return runs; },
    get lit() { return st.phase === 'count' && performance.now() - st.countAt > COUNT_S * 1000; },
    data: STAGE,
    best,
    goStart,
    // the car was moved by the player (map, H, R, garage): a run in progress ends
    teleported() { st.prev = null; if (st.phase === 'run' || st.phase === 'count') cancel('STAGE CANCELLED'); st.phase = st.phase === 'done' ? 'done' : 'idle'; },
    cancel,
    update(car, carId, carShort, dt) {
      const x = car.x, z = car.z;
      const dStart = Math.hypot(x - P[START][0], z - P[START][1]);
      const dMid = Math.hypot(x - 2660, z - 470);
      const near = dMid < BUILD_R;
      if (near && !built && world.ready(P[START][0], P[START][1]) && world.ready(...P[FIN]) && world.ready(2840, 450)) {
        built = true;
        jobs.add(build, 'raadi stage');
      }
      group.visible = near;
      // the stage clock: the car's own clock, but a stop (garage, map, another tab) counts at the wall clock's pace
      const wall = performance.now() / 1000;
      if (st.wall != null) {
        const ds = car.time - (st.carT ?? car.time), dw = wall - st.wall;
        st.clk += dw > 1 ? Math.max(dw, ds) : Math.max(0, ds);
      }
      st.wall = wall; st.carT = car.time;
      const time = st.clk;

      // a jump (map, H, R): the run ends
      if (st.prev && Math.hypot(x - st.prev.x, z - st.prev.z) > 40 && (st.phase === 'run' || st.phase === 'count')) cancel('STAGE CANCELLED');
      if (st.cool && dStart > 60) st.cool = false;

      if (st.phase === 'idle' || st.phase === 'done') {
        // up to the start: onto the line
        const kmh = Math.abs(car.vx) * 3.6;
        if (!st.cool && dStart < NEAR_START && kmh < 70) {
          hideAgain();
          const pose = startPose();
          place(pose);
          setup(pose);
        }
      }
      if (st.phase === 'count') {
        // (the lights wait while the ground and the stage's things are still loading after the jump here)
        if (!world.ready(x, z) || (!coneMesh && performance.now() - st.placedAt < 6000)) st.countAt = performance.now();
        const e = (performance.now() - st.countAt) / 1000;
        // (lights from COUNT_S on: all five red, one goes out a second, green when the last one does)
        const n = e < COUNT_S ? 0 : Math.max(0, 5 - Math.floor(e - COUNT_S));
        const green = e >= COUNT_S + 5;
        setLamps(e < COUNT_S ? 0 : n, green);
        lCap.textContent = e < COUNT_S ? `SS16 RAADI · ${STAGE_KM} KM` : green ? 'GO!' : `${n}`;
        lights.classList.remove('hidden'); lights.classList.toggle('go', green);
        if (green) {
          st.phase = 'run'; st.pin = null; st.t0 = time; st.prog = START; st.off = 0;
          onRun?.('start');
          setTimeout(() => { if (st.phase !== 'count') lights.classList.add('hidden'); }, 1200);
        }
      } else if (st.phase !== 'run') lights.classList.add('hidden');

      if (st.phase === 'run') {
        // progress along the stage: only forwards from where the car is, in a short window
        const w = nearestIn(x, z, st.prog - 6, st.prog + 40);
        const onIt = w.d < HW[w.i] + 6;
        if (onIt) st.prog = Math.max(st.prog, w.i);
        else if (st.prev) st.off += Math.hypot(x - st.prev.x, z - st.prev.z);
        // joined further on from somewhere else: on the stage, but far from where the run is
        if (!onIt) {
          const g = nearestIn(x, z, st.prog + 40, FIN);
          if (g.d < HW[g.i] + 1.5) cancel('SHORT CUT · STAGE CANCELLED');
        }
        if (st.off > OFF_LIMIT) cancel('OFF THE STAGE · CANCELLED');
        // apexes: no more than APEX_CUT inside the edge
        for (const [k, sd] of STAGE.apex) {
          if (Math.abs(st.prog - k) > 6 || st.phase !== 'run') continue;
          const a = nearestIn(x, z, k - 6, k + 6);
          if (a.lat * sd > HW[a.i] + APEX_CUT) cancel('APEX CUT · STAGE CANCELLED');
        }
        setBarriers(st.prog);
        // the flying finish
        if (st.phase === 'run' && st.prog >= FIN - 12 && st.prev) {
          const [fx, fz] = P[FIN], [tx, tz] = TAN[FIN];
          const a = (st.prev.x - fx) * tx + (st.prev.z - fz) * tz, b = (x - fx) * tx + (z - fz) * tz;
          if (a < 0 && b >= 0) {
            const f = a / (a - b), tc = st.prevTime + (time - st.prevTime) * f, t = tc - st.t0;
            const { car: pb } = best(carId);
            const run = { ms: Math.round(t * 1000), car: carId, carShort, at: new Date().toISOString() };
            runs.push(run);
            if (runs.length > 200) runs.splice(0, runs.length - 200);
            try { localStorage.setItem(KEY, JSON.stringify(runs)); } catch { /* private mode */ }
            const rec = !pb || run.ms < pb.ms;
            st.phase = 'done'; st.cool = true; st.doneT = t;
            elMsg.innerHTML = rec ? `FINISH · <i class="ahead">${pb ? `−${((pb.ms - run.ms) / 1000).toFixed(2)} · ` : ''}YOUR BEST</i>` : `FINISH · <i class="behind">+${((run.ms - pb.ms) / 1000).toFixed(2)}</i>`;
            toast(`STAGE TIME · ${fmtTime(t)}${rec ? ' · YOUR BEST' : ''}`, 4500);
            showAgain();
            onRun?.('finish', run);
          }
        }
      }
      // barriers slide
      if (barMesh) {
        let moving = false;
        for (const b of barriers) if (b.t !== b.want) { b.t += Math.sign(b.want - b.t) * Math.min(Math.abs(b.want - b.t), dt * 1.2); moving = true; }
        if (moving) drawBarriers();
      }
      updateCones(car, dt);
      st.prev = { x, z }; st.prevTime = time;

      // HUD
      const show = st.phase !== 'idle' || dStart < 120;
      panel.classList.toggle('hidden', !show);
      if (show) {
        elTime.textContent = fmtTime(st.phase === 'run' ? time - st.t0 : st.phase === 'done' && st.doneT != null ? st.doneT : 0);
        panel.classList.toggle('idle', st.phase !== 'run' && st.phase !== 'done');
        renderBest(carId, carShort);
        if (st.phase === 'idle' && !elMsg.textContent) elMsg.textContent = 'DRIVE TO THE START LINE';
        if (st.phase === 'run') elMsg.textContent = st.off > 40 ? `OFF THE STAGE ${Math.round(st.off)} / ${OFF_LIMIT} M` : '';
      }
      if (st.phase === 'done' && st.againUntil && performance.now() > st.againUntil) hideAgain();
      // the arrow: where the stage goes, 25 m on from here, against where the car points
      if (st.phase === 'run') {
        let j = st.prog;
        while (j < N - 1 && S[j] - S[st.prog] < 25) j++;
        const bx = P[j][0] - x, bz = P[j][1] - z;
        const ang = Math.atan2(bx, -bz) - car.yaw;
        const a = Math.atan2(Math.sin(ang), Math.cos(ang));
        arrow.classList.remove('hidden');
        arrow.style.setProperty('--rot', `${(a * 180 / Math.PI).toFixed(1)}deg`);
        arrow.style.opacity = Math.min(1, 0.25 + Math.abs(a) * 1.5).toFixed(2);
      } else arrow.classList.add('hidden');
    },
    // the start screen's and the HUD's names
    name: 'RAADI',
    escape: escapeHtml,
  };
}
