// The Raadi rally stage (?raadi=1 while it is being tried out): a copy of SSS16 "Tartu vald" of Rally
// Estonia 2026, 1.77 km of gravel paths in Raadi manor park round the Majoraadi ponds, north of ERM.
// Point to point, one car at a time, from a standing start (Martin, 23 Nov 2026).
//
// Drive up to the start (or use the RAADI button) and the car is put on the start line and held there while
// the start clock counts down: yellow for three seconds, then green (src/race/startkit.js: the
// clock on its stand past the line and the start line camera). The clock runs to the flying finish; the STOP
// board is a little further on.
//
// The stage passes some junctions twice going another way each time, and the stretch on the west side of
// the ponds twice: red and white barriers across the side paths show the way, and slide aside when the
// stage needs that path later. At each corner a straw
// bale stands a metre inside the apex (src/race/bales.js; back in place for the next run), and going more
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
import { createBales } from './bales.js';
import { chevronTex, haloTex } from './decor.js';
import { createStartKit } from './startkit.js';
import { createTape } from './tape.js';
import { SURFACE } from '../world/data.js';

const KEY = 'kvissuroam.raadi';            // this browser's stage times
const NEAR_START = 24;                     // within this of the start line (and not on a run) the car is put on it
const BUILD_R = 600;                       // the stage's things are built within this of it
const GONE_R = 450;                        // further than this from the park's middle the car has left the stage (its far points are 290 m out)
// The start clock (Martin 23 Nov: "a screen showing red, yellow and green/go", by the FIA rules). The WRC's
// Appendix VII has the unit red from 30 s to go, yellow and counting for the last 5 s, green at zero. Here the
// count is short so that a new try does not wait: "shorten the 5 sec countdown to 3 sec and let it be yellow
// from the beginning" (he had read the appendix and kept this screen). Red is still there for a longer count.
const COUNT_S = 0;                         // seconds of red before the counted ones
const LAST_S = 3;                          // the last seconds, yellow, counted one by one
const GREEN_S = 5;                         // how long the green stays on
const OFF_LIMIT = 150;                     // metres off the stage before the run is cancelled
// an apex cut costs time (Martin 23 Nov: a small penalty for a small cut, a large one for a large cut): how far
// inside the path's edge the middle of the car went at the apex, in metres, and the seconds it adds
const APEX_PEN = [[6, 10], [3, 5], [1.2, 2]];
// and so does swinging out wide before a corner to open it up (Martin 23 Nov: "two car widths of room and then
// penalize"): how far outside the path's edge on the way in, from 50 m to 12 m before the apex
const WIDE_PEN = [[7.2, 5], [3.6, 2]];
// Hidden checks, one across the stage at each bale (Martin 23 Nov: "mini-checks on each bale ... to track the
// completion", after he cut from before the last corner straight onto the finish straight and got a time): the car
// has to cross each in turn, going the stage's way, no further than GATE_IN m inside the path's edge (a cut up to
// there costs seconds, see APEX_PEN) or GATE_OUT m outside it. On the stage GATE_MISS points past one it did not
// cross, the run is over.
const GATE_IN = 15, GATE_OUT = 25, GATE_MISS = 15, GATE_FROM = 30;

const P = STAGE.pts, HW = STAGE.hw, N = P.length, START = STAGE.start, FIN = STAGE.finish;
const TAN = P.map((_, i) => {
  const a = P[Math.max(0, i - 1)], b = P[Math.min(N - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
});
const S = new Float64Array(N);
for (let i = 1; i < N; i++) S[i] = S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
// a point beside the centre line: d metres to the right of the direction of travel
const side = (i, d) => [P[i][0] - TAN[i][1] * d, P[i][1] + TAN[i][0] * d];
// Which corners have which lines, as Martin drew them on nine pictures of 23 Nov ("Add penalty borders (I have
// manually drawn red stripes) and remove penalty borders (circles in green)"), by the apex's point:
//  - NO_WIDE: no line on the outside of the way in (his green circles)
//  - NO_APEX: nothing for the inside either (the hidden check at the bale stays)
//  - WIDE_AT: a way in with its own length or steps. The start stretch: "move it more closer on the left side so
//    you can't take a very wide angle", so half a metre off the lane there and on to the corner itself. Before the
//    left-hander past the boulders the line begins at the corner before it (his red stripe on the right).
const NO_WIDE = [205, 429, 550, 854], NO_APEX = [550, 583];
const WIDE_AT = { 33: { from: START + 2, to: 30, pen: [[4, 5], [0.5, 2]] }, 402: { from: 371 } };
// the way in to each corner: [first index, last index, side of the turn, steps], clear of the corner before it
const ENTRY = STAGE.apex.map(([k, sd], n) => {
  const own = WIDE_AT[k] || {};
  return [own.from ?? Math.max(START + 2, k - 25, n ? STAGE.apex[n - 1][0] + 8 : 0), own.to ?? k - 6, sd, own.pen || WIDE_PEN, k];
}).filter(([a, b, , , k]) => b - a >= 4 && !NO_WIDE.includes(k));
// The inside of two bends that have no bale is out of bounds as well (Martin 23 Nov: "needs outside banned areas",
// with the lines he drove over the grass drawn on two pictures; every bend had it for an hour, then "there are a
// lot more red lines around the track. Just add the ones I added on the two pics"). BENDS: [first point, last
// point, side the stage turns to (1 right, -1 left)]; BEND[i] is that side at point i, 0 elsewhere. Stage covered
// while the middle of the car is more than CUT_IN m inside the path's edge there adds seconds: CUT_PEN is [metres
// covered, seconds], counted for each trip off the path, so a spin that goes nowhere is free.
const CUT_IN = 1.2, CUT_PEN = [[50, 10], [25, 5], [10, 2]];
// (north of the boulder field; after the bale east of the middle pond; and, from his pictures of 15:29, the
// right-hand bend of the loop by the wood)
const BENDS = [[277, 292, -1], [436, 449, -1], [737, 753, 1]];
const BEND = (() => {
  const b = new Int8Array(N);
  for (const [i0, i1, sd] of BENDS) b.fill(sd, i0, i1 + 1);
  return b;
})();
const yawAt = (i) => Math.atan2(TAN[i][0], -TAN[i][1]);
// How much wider than the path the gravel is inside each corner, m. The bale stands a metre off all the gravel
// there (tools/race/build-raadi.py: off the corner's other arm, and off the wide gravel where paths meet), so
// where it stands further in than a metre off this path's edge, the inside is judged from that much further in.
// At the last corner the inside costs seconds only behind the bale (Martin 23 Nov 17:58, a green line drawn round
// the far side of the bale: "Lax the last corner penalty area like on the green line"): WRAP is how far behind the
// bale's middle the middle of the car may go there, and the tape goes round the bale that far out.
const WRAP = { 854: 1.3 };
const ROOM = new Map(STAGE.apex.map(([k, sd, bx, bz]) => [k, Math.max(0, ((bx - P[k][0]) * -TAN[k][1] + (bz - P[k][1]) * TAN[k][0]) * sd - 1 - HW[k]) + (WRAP[k] ? WRAP[k] - 0.2 : 0)]));
// Where each penalty begins, as lines beside the stage: [first point, last point, (i) => metres to the right of
// travel]. The red and white tape stands along them (src/race/tape.js), TAPE_OUT further out: the penalties are
// judged by the middle of the car, so its side is at the tape as they begin.
const TAPE_OUT = 0.85;
const LINES = [
  ...STAGE.apex.filter(([k]) => !NO_APEX.includes(k) && !WRAP[k]).map(([k, sd]) => [k, Math.min(N - 1, k + 5), (i) => sd * (HW[i] + ROOM.get(k) + APEX_PEN.at(-1)[0] + TAPE_OUT)]),
  ...ENTRY.map(([e0, e1, sd, pen]) => [e0, e1, (i) => -sd * (HW[i] + pen.at(-1)[0] + TAPE_OUT)]),
  ...BENDS.map(([i0, i1, sd]) => [i0, i1, (i) => sd * (HW[i] + CUT_IN + TAPE_OUT)]),
];
// (and round the far side of the bale where WRAP says so: an arc of 200 degrees, a stick every 1.9 m)
const ARCS = STAGE.apex.filter(([k]) => WRAP[k]).map(([k, , bx, bz]) => {
  const r = WRAP[k] + TAPE_OUT, a0 = Math.atan2(bz - P[k][1], bx - P[k][0]), pts = [];
  for (let a = -100; a <= 100; a += 20) pts.push([bx + Math.cos(a0 + a * Math.PI / 180) * r, bz + Math.sin(a0 + a * Math.PI / 180) * r]);
  pts.step = 1.9;
  return pts;
});
// one text for every one of them (Martin 23 Nov: "a general one for all crossings", "for leaving the track")
const penText = (s) => `+${s} S FOR LEAVING THE TRACK`;

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
// control ahead), the red flag of the start, the red chequered flag of the flying finish, and the red
// STOP board. One small picture of five squares (the third, the yellow chequered flag of the finish ahead,
// is not put up).
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
// bestFor(carId): the best time in that car { ms, name } (anyone's, from the server's board, or this browser's
// own) or null; online(): the server's board is known, so a time under that best is the stage record
export function createStage({ world, scene, toast, place, onRun, wood, bestFor, online }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const runs = loadRuns();
  let built = false, asked = false;

  // ---- HUD: the clock (the lap timer's look), the start lights, BACK TO STAGE START
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
  lights.innerHTML = '<div class="lamps"><i class="y"></i><i class="g"></i></div><div class="cap"></div>';   // (two bulbs: the count is yellow from its start)
  hudEl.appendChild(lights);
  const lamps = [...lights.querySelectorAll('i')], lCap = lights.querySelector('.cap');
  const again = document.createElement('button');
  again.id = 'stageagain';
  again.className = 'hidden';
  again.innerHTML = '↺ BACK TO STAGE START';
  hudEl.appendChild(again);
  again.addEventListener('click', () => { again.blur(); goStart(); });

  const st = {
    phase: 'idle',          // idle, count (on the start line, lights), run, done
    t0: 0, clk: 0, wall: null, carT: null, prog: START, off: 0, prev: null, cool: false, againUntil: 0,
    pin: null, countAt: 0, clockOff: 0, goAt: 0, gate: 0, cutM: 0, cutPen: 0, cutI: null, cut: '', pen: 0, apexPen: new Map(), widePen: new Map(),
  };

  // ---- the stage's things (built near)
  const atlas = signAtlas();
  const signMat = new THREE.MeshLambertMaterial({ map: atlas, side: THREE.DoubleSide });
  const postMat = new THREE.MeshLambertMaterial({ color: 0x8a8d92 });
  const barriers = [];
  let barMesh = null, kit = null, halo = null;
  // a bale 1.1 m inside the path's edge at each apex, its banner towards the cars coming
  const bales = createBales({ world, group, spots: STAGE.apex.map(([k, , x, z]) => ({ x, z, tx: TAN[k][0], tz: TAN[k][1] })) });
  // the red and white tape on sticks where the penalties begin
  const tape = createTape({ world, group, wood });
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

  // the start clock on its stand on the right, 8 m past the line and turned to the car waiting on it, and the
  // start line camera on the left, 40 cm past the line (where the rules put the jump start photocell)
  function startKit() {
    const pose = startPose();
    const [cx, cz] = side(START + 4, HW[START + 4] + 0.9);
    const [mx, mz] = side(START, -(HW[START] + 1.1)), ax = mx + TAN[START][0] * 0.4, az = mz + TAN[START][1] * 0.4;
    kit = createStartKit({
      group,
      clock: { x: cx, y: groundY(cx, cz), z: cz, yaw: Math.atan2(pose.x - cx, pose.z - cz) },
      cam: { x: ax, y: groundY(ax, az), z: az, yaw: Math.atan2(-TAN[START][1], TAN[START][0]) },
    });
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

  // a barrier that shows the way (Martin 23 Nov: "use some arrow barriers"): a white board on two pairs of legs
  // with red chevrons on both faces pointing to its +x, 1 m wide (scaled to the path's width; mirrored where
  // the stage goes the other way). 'piece' is a fifth of the board with its one chevron and 'legs' one pair of
  // legs, both about their own middles: what flies when a car breaks it.
  function barrierGeometry(part = 'whole') {
    const pos = [], col = [], nor = [];
    const add = (geo, hex) => {
      geo = geo.toNonIndexed(); geo.computeVertexNormals();
      const c = new THREE.Color(hex);
      pos.push(...geo.attributes.position.array); nor.push(...geo.attributes.normal.array);
      for (let k = 0; k < geo.attributes.position.count; k++) col.push(c.r, c.g, c.b);
    };
    const red = new THREE.Color(0xd8121b), T = 0.085, D = 0.06;
    // (a chevron: two slanted bars meeting at the point)
    const chevron = (x, ym) => {
      const y0 = ym - 0.19, y1 = ym + 0.19;
      const quads = [[[x, y0], [x + T, y0], [x + T + D, ym], [x + D, ym]], [[x + D, ym], [x + T + D, ym], [x + T, y1], [x, y1]]];
      for (const z of [0.024, -0.024]) for (const q of quads) for (const i of [0, 1, 2, 0, 2, 3]) {
        pos.push(q[i][0], q[i][1], z); nor.push(0, 0, Math.sign(z)); col.push(red.r, red.g, red.b);
      }
    };
    if (part === 'whole') {
      add(new THREE.BoxGeometry(1, 0.46, 0.04).translate(0, 0.8, 0), 0xf4f4f4);
      for (let k = 0; k < 5; k++) chevron(-0.5 + 0.05 + k * 0.19, 0.8);
      for (const sx of [-0.5, 0.5]) for (const lz of [0.12, -0.12]) add(new THREE.BoxGeometry(0.04, 0.95, 0.04).translate(sx, 0.47, lz), 0xd8d8d8);
    } else if (part === 'piece') {
      add(new THREE.BoxGeometry(0.2, 0.46, 0.04), 0xf4f4f4);
      chevron(-0.07, 0);
    } else for (const lz of [0.12, -0.12]) add(new THREE.BoxGeometry(0.04, 0.95, 0.04).translate(0, 0, lz), 0xd8d8d8);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return geo;
  }

  // ---- the stage's edges glow faintly like the lap's (Martin 23 Nov; src/race/race.js): magenta on the left,
  // cyan on the right, a band lying on the gravel just inside each edge and a low see-through fence on it. One
  // mesh. Left out where the edge would run across the stage's own road on another pass (the junctions it
  // takes twice).
  function* buildGlow() {
    const pos = [], col = [], idx = [];
    const C = [new THREE.Color(0xff2bd6), new THREE.Color(0x2ff3ff)];
    const i0 = Math.max(0, START - 3), n = N - i0;
    for (let k = 0; k < 2; k++) {
      const sg = k ? 1 : -1, c = C[k];
      const edge = [], vis = [];
      for (let i = i0; i < N; i++) {
        const [x, z] = side(i, sg * HW[i]);
        let v = 1;
        for (let j = i0; j < N && v; j += 2) if (Math.abs(j - i) > 25 && Math.hypot(P[j][0] - x, P[j][1] - z) < HW[j] - 0.4) v = 0;
        edge.push([x, groundY(x, z) + 0.07, z]); vis.push(v);
        if ((i & 31) === 0 && jobs.late()) yield;
      }
      for (const [inner, h, a0] of [[1.0, 0, 0.4], [0, 0.5, 0.48]]) {
        const base = pos.length / 3;
        for (let q = 0; q < n; q++) {
          const i = i0 + q, [x, y, z] = edge[q];
          const [ix, iz] = inner ? side(i, sg * (HW[i] - inner)) : [x, z];
          pos.push(x, y, z, ix, inner ? groundY(ix, iz) + 0.07 : y + h, iz);
          col.push(c.r, c.g, c.b, a0 * vis[q], c.r, c.g, c.b, 0);
          if (q) { const a = base + (q - 1) * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
        }
        yield;
      }
    }
    // (where the penalties begin was a red line on the grass here until 23 Nov: now tape on sticks, tape.js)
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true });
    // (drawn half a metre nearer in depth, so the ground's grid does not bite notches out of the band)
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        mvPosition.xyz *= max(0.05, 1.0 - 0.5 / max(length(mvPosition.xyz), 0.6));
        gl_Position = projectionMatrix * mvPosition;`);
    };
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    m.renderOrder = 3;
    group.add(m);
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
    const i0 = Math.max(START - 3, STAGE.gravelFrom || 0), i1 = N - 1;       // (the first straight is tarmac)
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
    startKit();
    line(START);
    // (no yellow flag 100 m before the finish: before the last corner it read as the finish itself, Martin 23 Nov)
    sign('finish', FIN, HW[FIN] + 1.4);
    sign('finish', FIN, -(HW[FIN] + 1.4));
    line(FIN, 0.2);
    // the finish halo, like the lap's (Martin 23 Nov: "finish line rectangle halo"): a glowing frame across the
    // flying finish, pulsing while a run is on
    {
      const w = HW[FIN] * 2 + 1.2, hh = 3.6, [fx, fz] = P[FIN];
      halo = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), new THREE.MeshBasicMaterial({ map: haloTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true }));
      halo.rotation.y = Math.atan2(TAN[FIN][0], TAN[FIN][1]);
      halo.position.set(fx, groundY(fx, fz) + hh / 2 + 0.05, fz);
      halo.renderOrder = 4;
      group.add(halo);
    }
    sign('stop', N - 1, HW[N - 1] + 1.4);
    yield;
    // the straw bales at the apexes (src/race/bales.js)
    bales.build();
    yield;
    // barriers: one at each side path the stage passes
    for (const j of STAGE.junctions) for (const b of j.b) barriers.push({ ...b, t: 1, want: 1 });
    const barMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    barMesh = new THREE.InstancedMesh(barrierGeometry(), barMat, barriers.length);
    barMesh.castShadow = true;
    barMesh.frustumCulled = false;
    group.add(barMesh);
    // (and what each breaks into, away until a car drives through one: five pieces of board and two pairs of legs)
    for (const [key, per] of [['piece', 5], ['legs', 2]]) {
      const m = new THREE.InstancedMesh(barrierGeometry(key), barMat, barriers.length * per);
      m.frustumCulled = false;
      for (let n = 0; n < m.count; n++) { m.setMatrixAt(n, m4.makeScale(0, 0, 0)); bits.push({ m, n, of: Math.floor(n / per), k: n % per, legs: key === 'legs', live: false, rest: true, p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), ax: new THREE.Vector3(), spin: 0, sx: 1 }); }
      bitMesh.push(m);
      group.add(m);
    }
    setBarriers(st.phase === 'run' ? st.prog : START, true);
    yield;
    yield* buildGlow();
    yield;
    // the tape: not across the stage's own road (this pass or another) and not in a pond
    {
      // (inside a tight corner the line beside the road folds back on itself: only the points that go on the
      // stage's way are kept, and what is left of a line shorter than 5 m is a straight 6 m piece behind the bale)
      const lines = LINES.map(([i0, i1, lat]) => {
        const l = [];
        let len = 0;
        for (let i = i0; i <= i1; i++) {
          const q = side(i, lat(i)), o = l.at(-1);
          if (o && (q[0] - o[0]) * TAN[i][0] + (q[1] - o[1]) * TAN[i][1] < 0.3) continue;
          if (o) len += Math.hypot(q[0] - o[0], q[1] - o[1]);
          l.push(q);
        }
        if (len >= 5) return l;
        const dx = TAN[i0][0] + TAN[i1][0], dz = TAN[i0][1] + TAN[i1][1], dl = Math.hypot(dx, dz) || 1;
        return [0, 2, 4, 6].map((m) => [l[0][0] + dx / dl * m, l[0][1] + dz / dl * m]);
      }).concat(ARCS);
      const clear = (x, z) => {
        if (world.surfaceAt(x, z) === SURFACE.WATER) return false;
        for (let j = 0; j < N; j++) if ((P[j][0] - x) ** 2 + (P[j][1] - z) ** 2 < (HW[j] + 0.3) ** 2) return false;
        return true;
      };
      tape.build(lines, clear);
    }
    yield;
    // glowing chevron boards over the corners like the lap's (src/race/decor.js; Martin 23 Nov: "like the ones
    // in the city circuit", in place of the yellow arrows): over the outside of each corner, facing the car
    // coming up, pointing the way it turns. Shown for the corners coming up on this pass only, since the stage
    // goes through some junctions twice, another way each time.
    // They hang over the way out of the corner, 12 m past the apex (Martin 23 Nov: "more into the corner"), so the
    // board itself sits where the road goes.
    const same = (a, b2) => TAN[a][0] * TAN[b2][0] + TAN[a][1] * TAN[b2][1] > 0.9;
    const clip = (i) => Math.max(0, Math.min(N - 1, i));
    for (const [k, sd] of STAGE.apex) {
      const tin = TAN[Math.max(0, k - 12)], e = clip(k + 6);
      const x = P[e][0], z = P[e][1];
      // (and the same corner taken again on the stretch the stage drives twice: only where that pass turns the
      // same way too, not where it comes up the same road and goes straight on)
      const at = [k];
      for (let j = START; j < FIN; j++) if (Math.abs(j - k) > 30 && Math.hypot(P[j][0] - P[k][0], P[j][1] - P[k][1]) < 2 && same(j, k) && same(clip(j + 8), clip(k + 8)) && same(clip(j - 8), clip(k - 8)) && !at.some((q) => Math.abs(q - j) < 30)) at.push(j);
      boards.push({ at, x, z, y: groundY(x, z) + 3.4, q: new THREE.Quaternion().setFromAxisAngle(up, Math.atan2(-tin[0], -tin[1])), sd, n: 0, on: -1 });
    }
    const chev = chevronTex();
    const chevL = chev.clone(); chevL.repeat.x = -1; chevL.offset.x = 1; chevL.wrapS = THREE.RepeatWrapping; chevL.needsUpdate = true;
    const geo = new THREE.PlaneGeometry(4.2, 1.6);
    for (const [sd, map] of [[1, chev], [-1, chevL]]) {
      const list = boards.filter((b) => b.sd === sd);
      list.forEach((b, n) => { b.n = n; });
      const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }), Math.max(1, list.length));
      m.frustumCulled = false;
      m.renderOrder = 3;
      boardMesh[sd] = m;
      group.add(m);
    }
    drawBoards(st.phase === 'run' ? st.prog : START, 0, true);
  }
  // the boards of the corners coming up (within 130 m along the stage) show, bobbing a little; the rest are away
  const boards = [], boardMesh = {}, av = new THREE.Vector3(), as = new THREE.Vector3();
  function drawBoards(prog, t, all = false) {
    if (!boardMesh[1]) return;
    let ch = false;
    for (const b of boards) {
      const on = b.at.some((k) => prog >= k - 65 && prog <= k + 2) ? 1 : 0;
      if (!on && !b.on && !all) continue;
      m4.compose(av.set(b.x, b.y + 0.12 * Math.sin(t * 2.2 + b.at[0]), b.z), b.q, as.set(on, on, on));
      boardMesh[b.sd].setMatrixAt(b.n, m4);
      b.on = on; ch = true;
    }
    if (ch) { boardMesh[1].instanceMatrix.needsUpdate = true; boardMesh[-1].instanceMatrix.needsUpdate = true; }
  }

  const m4 = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1), qy = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
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
      const e = 1 - b.t, off = e * (b.side || 1) * (b.away || b.w + 1.4);
      const x = b.x + rx * off, z = b.z + rz * off;
      b.px = x; b.pz = z; b.rot = -b.yaw + e * Math.PI / 2; b.sx = (b.w + 0.6) * (b.point || 1);
      qy.setFromAxisAngle(up, b.rot);
      m4.compose(av.set(x, groundY(x, z), z), qy, b.broken ? as.set(0, 0, 0) : as.set(b.sx, 1, 1));
      barMesh.setMatrixAt(n, m4);
    });
    barMesh.instanceMatrix.needsUpdate = true;
  }

  // ---- a car drives through a barrier (Martin 23 Nov: "make the white/red barriers break, with sound"): the board
  // snaps into its five pieces and the legs go flying, the way the car goes and harder near where it hit; they
  // tumble, land and lie there until the next run stands every barrier up again. Light boards: the car hardly
  // feels it. Costs nothing unless the car is at a barrier or pieces are in the air.
  const bits = [], bitMesh = [], bq = new THREE.Quaternion(), bv = new THREE.Vector3();
  let flying = 0, snapT = -1, landT = -1, bitT = 0;
  function breakBarriers(car, dt) {
    if (!barMesh) return;
    bitT += dt;
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
    const wvx = car.vx * fx + car.vy * rx, wvz = car.vx * fz + car.vy * rz, speed = Math.hypot(wvx, wvz);
    const hl = (car.halfLen || 2.2) + 0.1, hw = (car.halfWid || 0.9) + 0.1;
    let knocked = 0, landed = 0;
    if (speed > 1) barriers.forEach((b, n) => {
      if (b.broken || b.px == null) return;
      const half = Math.abs(b.sx) / 2, dx = b.px - car.x, dz = b.pz - car.z;
      if (dx * dx + dz * dz > (half + hl + 1) ** 2) return;
      const ax = Math.cos(b.rot), az = -Math.sin(b.rot);                    // along the board
      let hit = null;
      for (let k = -4; k <= 4 && hit == null; k++) {
        const ex = dx + ax * half * k / 4, ez = dz + az * half * k / 4;
        if (Math.abs(ex * fx + ez * fz) < hl && Math.abs(ex * rx + ez * rz) < hw) hit = k / 4;
      }
      if (hit == null) return;
      b.broken = true; knocked++;
      const y = groundY(b.px, b.pz);
      for (const f of bits) {
        if (f.of !== n) continue;
        const u = f.legs ? (f.k ? 0.5 : -0.5) : -0.4 + 0.2 * f.k;          // where along the board it was
        const near = Math.max(0.15, 1 - Math.abs(u - hit * 0.5) * Math.abs(b.sx) / 3.5);
        f.live = true; f.rest = false; f.sx = f.legs ? 1 : b.sx; flying++;
        f.p.set(b.px + ax * u * Math.abs(b.sx), y + (f.legs ? 0.48 : 0.8), b.pz + az * u * Math.abs(b.sx));
        f.q.setFromAxisAngle(up, b.rot);
        const push = (0.45 + Math.random() * 0.4) * near;
        f.v.set(wvx * push + (Math.random() - 0.5) * 2, 1 + Math.min(speed, 22) * 0.16 * near + Math.random() * 1.5, wvz * push + (Math.random() - 0.5) * 2);
        f.ax.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.6, Math.random() - 0.5).normalize();
        f.spin = (3 + Math.random() * 7) * near + 1;
      }
      car.hit = Math.max(car.hit || 0, Math.min(2, speed * 0.06));
      car.vx *= 0.98;
      drawBarriers();
    });
    if (flying) {
      for (const f of bits) {
        if (!f.live || f.rest) continue;
        f.v.y -= 9.81 * dt;
        f.p.addScaledVector(f.v, dt);
        f.q.premultiply(bq.setFromAxisAngle(f.ax, f.spin * dt));
        const g = groundY(f.p.x, f.p.z) + 0.04;
        if (f.p.y < g) {
          if (f.v.y < -2) landed = Math.max(landed, -f.v.y);
          f.p.y = g; f.v.y *= -0.25; f.v.x *= 0.55; f.v.z *= 0.55; f.spin *= 0.5;
          if (Math.abs(f.v.y) < 0.6 && Math.hypot(f.v.x, f.v.z) < 0.4) {
            // lying flat where it stopped, turned as it came down
            f.rest = true; flying--;
            const turn = Math.atan2(2 * (f.q.w * f.q.y + f.q.x * f.q.z), 1 - 2 * (f.q.y * f.q.y + f.q.x * f.q.x));
            f.q.setFromAxisAngle(up, turn).multiply(bq.setFromAxisAngle(f.legs ? bv.set(0, 0, 1) : bv.set(1, 0, 0), Math.PI / 2));
          }
        }
        f.m.setMatrixAt(f.n, m4.compose(f.p, f.q, as.set(f.sx, 1, 1)));
        f.m.instanceMatrix.needsUpdate = true;
      }
    }
    if (knocked && bitT - snapT > 0.07) { snapT = bitT; wood?.('snap', Math.min(1.3, 0.45 + speed / 20)); }
    if (landed && bitT - landT > 0.05) { landT = bitT; wood?.('land', Math.min(1, landed / 6)); }
  }
  function standBarriers() {
    let any = false;
    for (const b of barriers) if (b.broken) { b.broken = false; any = true; }
    if (!any) return;
    for (const f of bits) if (f.live) { f.live = false; f.rest = true; f.m.setMatrixAt(f.n, m4.makeScale(0, 0, 0)); f.m.instanceMatrix.needsUpdate = true; }
    flying = 0;
  }

  // ---- runs
  // This browser's best: in the car, and in any. Only runs the server was sent count (they carry `inp`, since
  // 23 Nov 2026 when it began to keep stage times): the ones from before were driven while the penalties were
  // still being shaped and are on nobody's board, so they stay in the list of last runs and are no best.
  function best(carId) {
    let b = null, any = null;
    for (const r of runs) { if (!r.inp) continue; if (!any || r.ms < any.ms) any = r; if (r.car === carId && (!b || r.ms < b.ms)) b = r; }
    return { car: b, any };
  }
  const top = (carId) => (bestFor ? bestFor(carId) : best(carId).car);
  let bestKey = '';
  function renderBest(carId, carShort) {
    const b = top(carId), key = `${carShort}|${b?.ms}|${b?.name}`;
    if (key === bestKey) return;
    bestKey = key;
    elCar.textContent = carShort;
    elBest.innerHTML = b ? `${fmtTime(b.ms / 1000)}${b.name ? ` <small>${escapeHtml(b.name)}</small>` : ''}` : '<small>NO TIME YET</small>';
  }

  // the lamps on the screen and on the clock at the line: 0 off, 1 red, 2 yellow, 3 green; n: the seconds to go
  function setLamps(lamp, n = null) {
    lamps.forEach((l, k) => l.classList.toggle('on', k + 2 === lamp));
    if (!kit) return;
    // (the rally time of day: a car starts on the full minute, so the clock is set to reach one at green)
    const d = new Date(Date.now() + st.clockOff), two = (v) => String(v).padStart(2, '0');
    kit.show(lamp, n, `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`);
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
    st.prog = START; st.off = 0; st.gate = 0; st.cutM = 0; st.cutPen = 0; st.cutI = null; st.cut = ''; st.pen = 0; st.apexPen.clear(); st.widePen.clear(); st.doneT = null; st.inpT = {};
    bales.reset();
    tape.reset();
    standBarriers();
    setBarriers(START, true);
    setLamps(0);
    elMsg.textContent = '';
    st.prev = null;
  }
  function cancel(why) {
    if (st.phase !== 'run' && st.phase !== 'count') return;
    st.phase = 'done'; st.pin = null; st.cool = true; st.doneT = null;
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
    get gate() { return st.gate; },
    get pen() { return st.pen; },
    get barriers() { return barriers; },
    get lit() { return st.phase === 'count' && performance.now() - st.countAt > COUNT_S * 1000; },
    // the seconds to green (the test drive holds the clock with it to take its pictures)
    set countLeft(v) { st.countAt = performance.now() - (COUNT_S + LAST_S - v) * 1000; },
    data: STAGE,
    get bales() { return bales; },
    get tape() { return tape; },
    lines: LINES, side,
    best,
    goStart,
    // the car was moved by the player (map, H, R, garage): a run in progress ends
    teleported() { st.prev = null; if (st.phase === 'run' || st.phase === 'count') cancel('STAGE CANCELLED'); st.phase = st.phase === 'done' ? 'done' : 'idle'; },
    cancel,
    // inp: what is driving the car (keyboard, gamepad, wheel, touch): a run is marked with the one used most
    update(car, carId, carShort, dt, inp = 'kb') {
      const x = car.x, z = car.z;
      const dStart = Math.hypot(x - P[START][0], z - P[START][1]);
      const dMid = Math.hypot(x - 2660, z - 470);
      const near = dMid < BUILD_R;
      // (the whole stage's ground is fetched first: it is 560 m across, and the weakest setups only keep 420 m
      // of ground round the car, so from the start line the east loop would have no heights to stand things on)
      if (near && !built) {
        if (!asked) { asked = true; world.loadAround(2650, 490, 360); }
        let ok = true;
        for (let i = 0; i < N && ok; i += 60) ok = world.ready(P[i][0], P[i][1]);
        if (ok && world.ready(...P[N - 1])) {
          built = true;
          jobs.add(build, 'raadi stage');
        }
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
      // gone from the park after a run (the garage's or the button's Toomemägi, the map, or driven off): the
      // stage's time comes down. (Martin 23 Nov: "finished raadi, then from the garage chose toomemäe, and the
      // raadi number stayed up", over the lap's clock.)
      if (st.phase === 'done' && dMid > GONE_R) { st.phase = 'idle'; st.doneT = null; elMsg.textContent = ''; hideAgain(); }

      if (st.phase === 'idle' || st.phase === 'done') {
        // up to the start: onto the line
        const kmh = Math.abs(car.vx) * 3.6;
        // (on the stage's own lane: Narva mnt and its cycle path run close by)
        if (!st.cool && dStart < NEAR_START && kmh < 70 && nearestIn(x, z, 0, START + 14).d < HW[START] + 1.5) {
          hideAgain();
          const pose = startPose();
          place(pose);
          setup(pose);
        }
      }
      if (st.phase === 'count') {
        // (the lights wait while the ground and the stage's things are still loading after the jump here)
        if (!world.ready(x, z) || (!bales.built && performance.now() - st.placedAt < 6000)) st.countAt = performance.now();
        const e = (performance.now() - st.countAt) / 1000, left = COUNT_S + LAST_S - e, green = left <= 0;
        const n = Math.max(0, Math.ceil(left));
        if (st.goFor !== st.countAt) { st.goFor = st.countAt; const go = Date.now() + left * 1000; st.clockOff = Math.ceil(go / 60000) * 60000 - go; }
        st.goAt = green ? performance.now() : 0;
        setLamps(green ? 3 : left <= LAST_S ? 2 : 1, green ? null : n);
        lCap.textContent = green ? 'GO!' : left <= LAST_S ? `${n}` : `SS16 RAADI · ${STAGE_KM} KM`;
        lights.classList.remove('hidden'); lights.classList.toggle('go', green);
        if (green) {
          st.phase = 'run'; st.pin = null; st.t0 = time; st.prog = START; st.off = 0;
          onRun?.('start');
          setTimeout(() => { if (st.phase !== 'count') lights.classList.add('hidden'); }, 1200);
        }
      } else {
        if (st.phase !== 'run') lights.classList.add('hidden');
        // (the clock at the line: green for a few seconds after the start, then dark; the time runs on)
        if (kit && near && dStart < 200) setLamps(st.phase === 'run' && st.goAt && performance.now() - st.goAt < GREEN_S * 1000 ? 3 : 0);
      }

      if (st.phase === 'run') {
        st.inpT[inp] = (st.inpT[inp] || 0) + (dt || 0);
        // progress along the stage: only forwards from where the car is, in a short window
        const w = nearestIn(x, z, st.prog - 6, st.prog + 40);
        const onIt = w.d < HW[w.i] + 6;
        if (onIt) st.prog = Math.max(st.prog, w.i);
        else if (st.prev) st.off += Math.hypot(x - st.prev.x, z - st.prev.z);
        st.offNow = !onIt;
        // joined further on from somewhere else: on the stage, but far from where the run is. (Not when the car
        // is only behind where it got to, after a spin or a few metres back: on the stretch the stage drives
        // twice that same road is also a later part of the stage, and the run was ended there for nothing.)
        if (!onIt) {
          const back = nearestIn(x, z, st.prog - 80, st.prog + 40);
          const g = back.d < HW[back.i] + 8 ? null : nearestIn(x, z, st.prog + 40, FIN);
          if (g && g.d < HW[g.i] + 1.5) cancel('SHORT CUT · STAGE CANCELLED');
        }
        if (st.off > OFF_LIMIT) cancel('OFF THE STAGE · CANCELLED');
        // apexes: cutting inside the edge adds seconds, more for a deeper cut (once per apex: the deepest counts)
        const apexCut = (k, deep) => {
          if (NO_APEX.includes(k)) return;
          const pen = APEX_PEN.find(([m]) => deep > m)?.[1] || 0, had = st.apexPen.get(k) || 0;
          if (pen <= had) return;
          st.apexPen.set(k, pen); st.pen += pen - had;
          toast(penText(pen), 2600);
        };
        // the hidden check at each bale, in turn: where the car crosses the line across the stage at the apex
        while (st.gate < STAGE.apex.length && st.prev && st.phase === 'run') {
          const [k, sd] = STAGE.apex[st.gate], [gx, gz] = P[k], [tx, tz] = TAN[k];
          if (st.prog < k - GATE_FROM) break;
          const a0 = (st.prev.x - gx) * tx + (st.prev.z - gz) * tz, a1 = (x - gx) * tx + (z - gz) * tz;
          if (!(a0 < 0 && a1 >= 0)) break;
          const f = a0 / (a0 - a1), cx = st.prev.x + (x - st.prev.x) * f - gx, cz = st.prev.z + (z - st.prev.z) * f - gz;
          const deep = (-cx * tz + cz * tx) * sd - HW[k] - ROOM.get(k);       // inside the gravel's edge (+), outside it (-)
          if (deep > GATE_IN || deep < -2 * HW[k] - GATE_OUT) break;
          apexCut(k, deep);
          st.gate++;
        }
        if (st.phase === 'run' && onIt && st.gate < STAGE.apex.length && w.i > STAGE.apex[st.gate][0] + GATE_MISS) cancel('MISSED A CORNER · STAGE CANCELLED');
        // And for the 10 m after the apex (Martin 23 Nov: only at the apex or after it; a spin to the inside before
        // the corner costs nothing when the car is back on the path by the bale and drives the corner).
        for (const [k, sd] of STAGE.apex) {
          if (st.prog < k - 25 || st.prog > k + 8 || st.phase !== 'run') continue;
          const a = nearestIn(x, z, k - 8, k + 5);
          if (a.i < k || a.d * a.d - a.lat * a.lat > 2.25) continue;       // before the apex, or past the end of it
          apexCut(k, a.lat * sd - HW[a.i] - ROOM.get(k));
        }
        // and too wide on the way in
        for (const [e0, e1, sd, steps] of ENTRY) {
          if (st.prog < e0 || st.prog > e1 || st.phase !== 'run') continue;
          const a = nearestIn(x, z, st.prog - 4, st.prog + 4), out = -a.lat * sd - HW[a.i];
          const pen = steps.find(([m]) => out > m)?.[1] || 0, had = st.widePen.get(e1) || 0;
          if (pen > had) {
            st.widePen.set(e1, pen); st.pen += pen - had;
            toast(penText(pen), 2600);
          }
        }
        // and the inside of the bends of BENDS
        {
          const i = w.i, sd = BEND[i], deep = sd ? w.lat * sd - HW[i] : 0;
          if (Math.abs(w.lat) < HW[i]) { st.cutM = 0; st.cutPen = 0; st.cutI = null; }       // back on the path
          else if (deep > CUT_IN) {
            if (st.cutI != null && i > st.cutI) st.cutM += S[i] - S[st.cutI];
            st.cutI = Math.max(st.cutI ?? i, i);
            const pen = CUT_PEN.find(([m]) => st.cutM > m)?.[1] || 0;
            if (pen > st.cutPen && st.phase === 'run') { st.pen += pen - st.cutPen; st.cutPen = pen; toast(penText(pen), 2600); }
          } else st.cutI = Math.max(st.cutI ?? i, i);
        }
        setBarriers(st.prog);
        // the flying finish
        if (st.phase === 'run' && st.prog >= FIN - 12 && st.prev) {
          const [fx, fz] = P[FIN], [tx, tz] = TAN[FIN];
          const a = (st.prev.x - fx) * tx + (st.prev.z - fz) * tz, b = (x - fx) * tx + (z - fz) * tz;
          if (a < 0 && b >= 0 && st.gate < STAGE.apex.length) cancel('MISSED A CORNER · STAGE CANCELLED');
          else if (a < 0 && b >= 0) {
            const f = a / (a - b), tc = st.prevTime + (time - st.prevTime) * f, t = tc - st.t0 + st.pen;
            // (the bests before this run: this browser's own in the car, and anyone's)
            const { car: pb } = best(carId), all = top(carId);
            const used = Object.entries(st.inpT).sort((p, q) => q[1] - p[1])[0]?.[0] || inp;
            const run = { ms: Math.round(t * 1000), car: carId, carShort, at: new Date().toISOString(), ty: car.tyres === 'gravel' ? 'gravel' : 'road', inp: used };
            if (st.pen) run.pen = st.pen;
            runs.push(run);
            if (runs.length > 200) runs.splice(0, runs.length - 200);
            try { localStorage.setItem(KEY, JSON.stringify(runs)); } catch { /* private mode */ }
            const rec = !pb || run.ms < pb.ms;
            // the car's stage record: under everyone's best there, when the server's board is at hand
            const word = online?.() && (!all || run.ms < all.ms) ? 'STAGE RECORD' : 'YOUR BEST';
            st.phase = 'done'; st.cool = true; st.doneT = t;
            elMsg.innerHTML = rec ? `FINISH · <i class="ahead">${pb ? `−${((pb.ms - run.ms) / 1000).toFixed(2)} · ` : ''}${word}</i>` : `FINISH · <i class="behind">+${((run.ms - pb.ms) / 1000).toFixed(2)}</i>`;
            toast(`STAGE TIME · ${fmtTime(t)}${st.pen ? ` · INCL. +${st.pen} S` : ''}${rec ? ` · ${word}` : ''}`, 4500);
            showAgain();
            onRun?.('finish', run, { rec, record: word === 'STAGE RECORD' });
          }
        }
      }
      // barriers slide
      if (barMesh) {
        let moving = false;
        for (const b of barriers) if (b.t !== b.want) { b.t += Math.sign(b.want - b.t) * Math.min(Math.abs(b.want - b.t), dt * 1.2); moving = true; }
        if (moving) drawBarriers();
      }
      bales.update(car, dt);
      tape.update(car, dt);
      if (halo && near) halo.material.opacity = st.phase === 'run' ? 0.75 + 0.25 * Math.sin(time * 5) : 0.6;
      breakBarriers(car, Math.min(dt || 0.016, 0.05));
      drawBoards(st.phase === 'run' || st.phase === 'count' ? st.prog : START, time);
      st.prev = { x, z }; st.prevTime = time;

      // HUD
      const show = st.phase !== 'idle' || dStart < 120;
      panel.classList.toggle('hidden', !show);
      if (show) {
        elTime.textContent = fmtTime(st.phase === 'run' ? time - st.t0 + st.pen : st.phase === 'done' && st.doneT != null ? st.doneT : 0);
        panel.classList.toggle('idle', st.phase !== 'run' && st.phase !== 'done');
        renderBest(carId, carShort);
        if (st.phase === 'idle' && !elMsg.textContent) elMsg.textContent = 'DRIVE TO THE START LINE';
        if (st.phase === 'run') elMsg.textContent = st.offNow && st.off > 40 ? `OFF THE STAGE ${Math.round(st.off)} / ${OFF_LIMIT} M` : st.pen ? `PENALTY +${st.pen} S` : '';
      }
      if (st.phase === 'done' && st.againUntil && performance.now() > st.againUntil) hideAgain();
    },
    // the start screen's and the HUD's names
    name: 'RAADI',
    escape: escapeHtml,
  };
}
