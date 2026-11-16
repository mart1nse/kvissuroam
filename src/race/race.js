// The Toomemägi race track: a timed lap on real streets around the hill.
//
// The track centre line (src/race/track.json, made by tools/race/build-track.py) starts on the
// start/finish line on Küüni. Crossing it forwards starts a lap; crossing it again with every
// checkpoint passed finishes the lap and starts the next one. Driving more than 300 m off the
// track during a lap (a wrong turn or a shortcut through the city) cancels it; overshooting a
// corner and coming back is fine. Near the track its edges glow faintly so the way is clear.
import * as THREE from 'three';
import TRACK from './track.json';
import { createDecor } from './decor.js';

const OFF_MARGIN = 9;          // metres beyond the kerb before the car counts as off the track
const OFF_LIMIT = 300;         // metres off the track before the lap is cancelled
const NEAR = 45;               // within this of the track the edges and the lap panel show
const CP_RADIUS = 28;          // how close a checkpoint has to be passed
const MIN_LAP = 30;            // seconds; anything faster is a glitch (a reset onto the line)
const LOCAL_KEY = 'kvissuroam.laps';

export function fmtTime(sec) {
  if (sec == null || !isFinite(sec)) return '–:––.––';
  const m = Math.floor(sec / 60), s = sec - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}

export function createTrack() {
  const P = TRACK.pts, HW = TRACK.hw, N = P.length;
  const tan = [], s = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const a = P[(i + N - 1) % N], b = P[(i + 1) % N];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    tan.push([dx / l, dz / l]);
    if (i) s[i] = s[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  }
  // spatial hash of the segments
  const CELL = 40, grid = new Map();
  for (let i = 0; i < N; i++) {
    const a = P[i], b = P[(i + 1) % N];
    const keys = new Set([`${Math.floor(a[0] / CELL)},${Math.floor(a[1] / CELL)}`, `${Math.floor(b[0] / CELL)},${Math.floor(b[1] / CELL)}`]);
    for (const k of keys) { let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(i); }
  }
  const segDist = (i, x, z, out) => {
    const a = P[i], b = P[(i + 1) % N];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    const d = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
    if (out && d < out.d) { out.d = d; out.i = i; out.t = t; }
    return d;
  };
  // nearest point on the track; with a hint, only near the hint (the track crosses itself at Jakobi)
  function nearest(x, z, hint = -1) {
    const out = { d: Infinity, i: -1, t: 0 };
    if (hint >= 0) {
      for (let k = -50; k <= 50; k++) segDist((hint + k + N) % N, x, z, out);
      if (out.d < 30) return out;
      out.d = Infinity;
    }
    const c = Math.floor(x / CELL), r = Math.floor(z / CELL);
    for (let dc = -2; dc <= 2; dc++) for (let dr = -2; dr <= 2; dr++) {
      const l = grid.get(`${c + dc},${r + dr}`);
      if (l) for (const i of l) segDist(i, x, z, out);
    }
    return out;
  }
  const sp = TRACK.spawn;
  return {
    P, HW, N, tan, s, length: TRACK.length, nearest,
    checkpoints: TRACK.checkpoints.map((i) => ({ i, x: P[i][0], z: P[i][1] })),
    spawn: { x: P[sp][0], z: P[sp][1], yaw: Math.atan2(tan[sp][0], -tan[sp][1]) },
  };
}

// translucent glowing bands along both kerbs, built piece by piece as the ground under them loads
function createEdges(track, world) {
  const group = new THREE.Group();
  group.visible = false;
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const { P, HW, N, tan } = track;
  // offset each kerb, holding the inner side of a tight corner instead of letting it fold back
  const side = (sgn) => {
    const out = [];
    let prev = null;
    for (let i = 0; i < N; i++) {
      const nx = -tan[i][1] * sgn, nz = tan[i][0] * sgn;          // sgn 1: right of the direction of travel
      let p = [P[i][0] + nx * HW[i], P[i][1] + nz * HW[i]];
      if (prev && (p[0] - prev[0]) * tan[i][0] + (p[1] - prev[1]) * tan[i][1] < 0.05) p = prev;
      out.push(p); prev = p;
    }
    return out;
  };
  const kerbs = [side(-1), side(1)];
  const colours = [new THREE.Color(0xff2bd6), new THREE.Color(0x2ff3ff)];
  const CH = 40, H = 0.6;
  const chunks = [];
  for (let i0 = 0; i0 < N; i0 += CH) chunks.push({ i0, i1: Math.min(N, i0 + CH), mesh: null, cx: P[i0][0], cz: P[i0][1] });

  // per kerb: a flat band on the road just inside the kerb and a low see-through fence on it
  function build(ch) {
    const n = ch.i1 - ch.i0 + 1;                 // one past, to close the gap to the next piece
    const pos = [], col = [], idx = [];
    const strip = (k, inner, h, a0, a1) => {
      const base = pos.length / 3, c = colours[k];
      for (let j = 0; j < n; j++) {
        const i = (ch.i0 + j) % N;
        const [x, z] = kerbs[k][i];
        const y = world.topAt(x, z, 0) + 0.07;
        // inner edge: towards the centre line by `inner` metres
        const dx = P[i][0] - x, dz = P[i][1] - z, l = Math.hypot(dx, dz) || 1;
        const ix = x + (dx / l) * inner, iz = z + (dz / l) * inner;
        const iy = inner ? world.topAt(ix, iz, 0) + 0.07 : y + h;
        pos.push(x, y, z, ix, iy, iz);
        col.push(c.r, c.g, c.b, a0, c.r, c.g, c.b, a1);
        if (j) { const a = base + (j - 1) * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
      }
    };
    for (let k = 0; k < 2; k++) { strip(k, 1.1, 0, 0.42, 0.0); strip(k, 0, H, 0.5, 0); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    geo.setIndex(idx);
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 2;
    ch.mesh = m;
    group.add(m);
  }

  return {
    group,
    update(x, z) {
      for (const ch of chunks) {
        if (ch.mesh || Math.hypot(ch.cx - x, ch.cz - z) > 700) continue;
        let ok = true;
        for (let i = ch.i0; i <= ch.i1 && ok; i += 4) ok = world.ready(P[i % N][0], P[i % N][1]) && world.ready(...kerbs[0][i % N]) && world.ready(...kerbs[1][i % N]);
        if (ok) build(ch);
      }
    },
  };
}

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; } catch { return []; }
}

export function createRace({ world, scene, toast, onLap, bestFor }) {
  const track = createTrack();
  const edges = createEdges(track, world);
  scene.add(edges.group);
  const decor = createDecor(track, world);
  scene.add(decor.group, decor.fixed);
  const laps = loadLocal();                    // this browser's laps, newest last

  const panel = document.createElement('div');
  panel.id = 'lap';
  panel.className = 'hidden';
  panel.innerHTML = `<div class="lt"><span class="lbl">LAP</span><b id="laptime">0:00.00</b></div>
    <div class="lb"><span class="lbl">BEST <span id="lapcar"></span></span><b id="lapbest"></b></div>
    <ol id="laplast"></ol><div id="lapmsg"></div>`;
  document.querySelector('#hud').appendChild(panel);
  const elTime = panel.querySelector('#laptime'), elBest = panel.querySelector('#lapbest'), elCar = panel.querySelector('#lapcar');
  const elLast = panel.querySelector('#laplast'), elMsg = panel.querySelector('#lapmsg');

  const st = {
    running: false, t0: 0, t: 0, off: 0, cps: new Set(), hint: -1, onTrack: false, near: false,
    prev: null, prevTime: 0,
  };
  const start = { x: track.P[0][0], z: track.P[0][1], tx: track.tan[0][0], tz: track.tan[0][1], hw: track.HW[0] };

  function cancel(why) {
    if (!st.running) return;
    st.running = false;
    elMsg.textContent = why;
    toast(why, 2600);
  }

  function renderLast(carShort) {
    elLast.innerHTML = laps.slice(-5).reverse()
      .map((l) => `<li><b>${fmtTime(l.ms / 1000)}</b> <span>${l.carShort || ''}</span></li>`).join('');
  }
  renderLast();

  let lastBestKey = '';
  function renderBest(carId, carShort) {
    const b = bestFor(carId);
    const key = `${carId}|${b?.ms}|${b?.name}`;
    if (key === lastBestKey) return;
    lastBestKey = key;
    elCar.textContent = carShort;
    elBest.innerHTML = b ? `${fmtTime(b.ms / 1000)} <small>${escapeHtml(b.name)}</small>` : '<small>NO LAP YET</small>';
  }

  return {
    track,
    get running() { return st.running; },
    get laps() { return laps; },
    cancel,
    teleported() { st.prev = null; cancel('LAP CANCELLED'); },
    refreshBest() { lastBestKey = ''; },
    // car: physics state; carId / carShort: which car is driving
    update(car, carId, carShort) {
      const x = car.x, z = car.z, time = car.time;
      const near = track.nearest(x, z, st.hint);
      st.hint = near.d < 30 ? near.i : -1;
      const hw = track.HW[near.i] ?? 6;
      const onTrack = near.d < hw + OFF_MARGIN;
      st.near = near.d < hw + NEAR;

      if (st.prev) {
        const moved = Math.hypot(x - st.prev.x, z - st.prev.z);
        if (moved > 40) { st.prev = null; cancel('LAP CANCELLED'); }   // reset, map drop or garage
        else {
          // the start/finish line
          const a = (st.prev.x - start.x) * start.tx + (st.prev.z - start.z) * start.tz;
          const b = (x - start.x) * start.tx + (z - start.z) * start.tz;
          if (a < 0 && b >= 0) {
            const f = a / (a - b);
            const cx = st.prev.x + (x - st.prev.x) * f, cz = st.prev.z + (z - st.prev.z) * f;
            const lat = Math.abs(-(cx - start.x) * start.tz + (cz - start.z) * start.tx);
            if (lat < start.hw + 6) {
              const tc = st.prevTime + (time - st.prevTime) * f;
              if (st.running) {
                const lapT = tc - st.t0;
                const missed = track.checkpoints.length - st.cps.size;
                if (missed === 0 && lapT > MIN_LAP) {
                  const lap = { ms: Math.round(lapT * 1000), car: carId, carShort, at: new Date().toISOString() };
                  laps.push(lap);
                  if (laps.length > 200) laps.splice(0, laps.length - 200);
                  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(laps)); } catch { /* private mode */ }
                  renderLast();
                  const b = bestFor(carId);
                  const pb = !b || lap.ms < b.ms;
                  toast(`${pb ? 'NEW RECORD · ' : 'LAP · '}${fmtTime(lapT)}`, 4000);
                  onLap?.(lap);
                } else if (missed) toast('CHECKPOINT MISSED · LAP NOT COUNTED', 2600);
              } else toast('GO!', 1200);
              st.running = true; st.t0 = tc; st.cps.clear(); st.off = 0; elMsg.textContent = '';
            }
          }
          if (st.running) {
            for (const cp of track.checkpoints) if (!st.cps.has(cp.i) && Math.hypot(x - cp.x, z - cp.z) < track.HW[cp.i] + CP_RADIUS) st.cps.add(cp.i);
            if (!onTrack) {
              st.off += moved;
              if (st.off > OFF_LIMIT) cancel('OFF THE TRACK · LAP CANCELLED');
            }
          }
        }
      }
      st.prev = { x, z };
      st.prevTime = time;
      st.onTrack = onTrack;

      const show = st.running || st.near;
      edges.update(x, z);
      edges.group.visible = show;
      decor.update(x, z, performance.now() / 1000);
      decor.group.visible = show;
      panel.classList.toggle('hidden', !show);
      if (show) {
        elTime.textContent = st.running ? fmtTime(time - st.t0) : '0:00.00';
        panel.classList.toggle('idle', !st.running);
        renderBest(carId, carShort);
        if (!st.running && !elMsg.textContent) elMsg.textContent = 'CROSS THE LINE TO START';
        if (st.running && st.off > 60) elMsg.textContent = `OFF TRACK ${Math.round(st.off)} / ${OFF_LIMIT} M`;
        else if (st.running) elMsg.textContent = `CHECKPOINTS ${st.cps.size}/${track.checkpoints.length}`;
      }
    },
  };
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
