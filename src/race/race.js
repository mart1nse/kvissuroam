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
import { createLandmarks } from './landmarks.js';

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
    P, HW, N, tan, s, length: TRACK.length, nearest, spawnI: sp,
    checkpoints: TRACK.checkpoints.map((i) => ({ i, x: P[i][0], z: P[i][1] })),
    spawn: { x: P[sp][0], z: P[sp][1], yaw: Math.atan2(tan[sp][0], -tan[sp][1]) },
  };
}

// inside kerbs drawn as a curve: [apex index, points either side, side of the turn (1 right, -1 left)]
export const ROUND = [[628, 9, 1], [1035, 8, -1]];

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
  // round the inside kerb of these corners (apex index: points either side) like the real kerb stones
  for (const [apex, W, sgn] of ROUND) {
    const k = sgn > 0 ? 1 : 0, L = kerbs[k];
    const a = L[(apex - W + N) % N], c = L[apex], b = L[(apex + W) % N];
    for (let j = -W + 1; j < W; j++) {
      const t = (j + W) / (2 * W), u = 1 - t;
      L[(apex + j + N) % N] = [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
    }
  }
  // where the lap passes the same junction twice, a kerb band of one pass would run across the road of
  // the other: fade it out there, so the two passes share one outline
  const grid = new Map(), GC = 20;
  for (let i = 0; i < N; i++) {
    const key = `${Math.floor(P[i][0] / GC)},${Math.floor(P[i][1] / GC)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(i);
  }
  const otherRoad = (x, z, own) => {
    let v = 1;
    const cx = Math.floor(x / GC), cz = Math.floor(z / GC);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      for (const j of grid.get(`${cx + dx},${cz + dz}`) || []) {
        const gap = Math.abs(j - own);
        if (Math.min(gap, N - gap) < 60) continue;
        const d = Math.hypot(P[j][0] - x, P[j][1] - z) - (HW[j] - 0.6);
        if (d < 1.5) v = Math.min(v, Math.max(0, d / 1.5));
      }
    }
    return v;
  };
  const colours = [new THREE.Color(0xff2bd6), new THREE.Color(0x2ff3ff)];
  const CH = 40, H = 0.6;
  const chunks = [];
  for (let i0 = 0; i0 < N; i0 += CH) chunks.push({ i0, i1: Math.min(N, i0 + CH), mesh: null, cx: P[i0][0], cz: P[i0][1] });

  // The street centre lines are not always where the street is drawn: on Vallikraavi the line runs
  // close to the houses. Where a kerb would stand in a building or wall, slide the band sideways
  // onto the open paving on the other side (and narrow it if there is none), smoothed along the lap.
  const PAVED = 1;
  function fit(i0, i1) {
    // the shift each point needs, then a smooth envelope over it: never less than needed, with long
    // eased ramps (R points either side) so the glow bends gently round a building instead of zigzagging
    const R = 22, raw = new Map(), out = new Map();
    for (let i = i0 - R; i <= i1 + R; i++) {
      const k = (i + N) % N, [px, pz] = P[k], nx = -tan[k][1], nz = tan[k][0], hw = HW[k];
      const free = (sg) => { let d = 0; while (d < hw + 1 && world.sdfAt(px + nx * sg * d, pz + nz * sg * d) > 0.6) d += 0.25; return d; };
      const paved = (sg) => { let d = 0; while (d < hw + 8 && world.surfaceAt(px + nx * sg * d, pz + nz * sg * d) === PAVED) d += 0.5; return d; };
      const fr = free(1), fl = free(-1);
      let off = 0;
      if (fr < hw) off = -Math.min(hw - fr, Math.max(0, Math.min(paved(-1), fl) - hw));       // room on the left
      else if (fl < hw) off = Math.min(hw - fl, Math.max(0, Math.min(paved(1), fr) - hw));
      raw.set(i, [Math.max(0, off), Math.max(0, -off), Math.max(0, -Math.min(0, fr - (hw + off))), Math.max(0, -Math.min(0, fl - (hw - off)))]);
    }
    const ease = (k) => { const t = 1 - Math.abs(k) / R; return t * t * (3 - 2 * t); };
    for (let i = i0; i <= i1; i++) {
      const e = [0, 0, 0, 0];
      for (let k = -R; k <= R; k++) { const r = raw.get(i + k), g = ease(k); for (let j = 0; j < 4; j++) e[j] = Math.max(e[j], r[j] * g); }
      const off = e[0] - e[1], cutR = -e[2], cutL = -e[3];
      out.set((i + N) % N, [off - cutL, off + cutR]);          // shift of the left and right kerbs along the right-hand normal
    }
    return out;
  }

  // per kerb: a flat band on the road just inside the kerb and a low see-through fence on it
  function build(ch) {
    const n = ch.i1 - ch.i0 + 1;                 // one past, to close the gap to the next piece
    const pos = [], col = [], idx = [];
    const shift = fit(ch.i0, ch.i0 + n - 1);
    // the ground is a 1 m grid with kerb steps: float the band just over the highest ground about it,
    // so that the ground does not poke through it in a zigzag
    const topNear = (x, z, i) => {
      const [tx, tz] = tan[i];
      let y = -1e9;
      for (const [a, b] of [[0, 0], [0.8, 0], [-0.8, 0]]) y = Math.max(y, world.topAt(x + tx * a - tz * b, z + tz * a + tx * b, 0));
      return y + 0.09;
    };
    // heights along a line of points, then smoothed (a max over neighbours, then a mean) so the band
    // runs level instead of following every step of the ground
    const level = (pts) => {
      const raw = pts.map(([x, z, i]) => topNear(x, z, i)), n = raw.length;
      const mx = raw.map((_, j) => { let m = -1e9; for (let q = Math.max(0, j - 2); q <= Math.min(n - 1, j + 2); q++) m = Math.max(m, raw[q]); return m; });
      return mx.map((_, j) => { let a = 0, w = 0; for (let q = Math.max(0, j - 2); q <= Math.min(n - 1, j + 2); q++) { a += mx[q]; w++; } return Math.max(raw[j], Math.min(raw[j] + 0.2, a / w)); });
    };
    const strip = (k, inner, h, a0, a1) => {
      const base = pos.length / 3, c = colours[k];
      const outer = [], inn = [];
      for (let j = 0; j < n; j++) {
        const i = (ch.i0 + j) % N;
        const sh = shift.get(i)[k];
        const x = kerbs[k][i][0] - tan[i][1] * sh, z = kerbs[k][i][1] + tan[i][0] * sh;
        // inner edge: towards the centre line by `inner` metres
        const dx = P[i][0] - kerbs[k][i][0], dz = P[i][1] - kerbs[k][i][1], l = Math.hypot(dx, dz) || 1;
        outer.push([x, z, i]);
        inn.push([x + (dx / l) * inner, z + (dz / l) * inner, i]);
      }
      const yo = level(outer), yi = inner ? level(inn) : null;
      for (let j = 0; j < n; j++) {
        const [x, z, i] = outer[j], [ix, iz] = inn[j];
        const y = yo[j], iy = inner ? yi[j] : y + h;
        pos.push(x, y, z, ix, iy, iz);
        const vis = otherRoad(x, z, i);
        col.push(c.r, c.g, c.b, a0 * vis, c.r, c.g, c.b, a1 * vis);
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
  const landmarks = createLandmarks(world, track);
  scene.add(landmarks.group);
  const laps = loadLocal();                    // this browser's laps, newest last

  const panel = document.createElement('div');
  panel.id = 'lap';
  panel.className = 'hidden';
  panel.innerHTML = `<div class="lt"><span class="lbl">LAP</span><b id="laptime">0:00.00</b></div>
    <div class="lb"><span class="lbl">BEST <span id="lapcar"></span></span><b id="lapbest"></b></div>
    <ol id="laplast"></ol><div id="lapmsg"></div>`;
  // checkpoint split: time at the checkpoint and +/- against this browser's best lap in this car
  const split = document.createElement('div');
  split.id = 'lapsplit';
  split.className = 'hidden';
  document.querySelector('#hud').appendChild(split);
  let splitTimer = 0;
  function showSplit(label, t, ref) {
    const d = ref == null ? null : t - ref;
    split.className = d == null ? '' : d <= 0 ? 'ahead' : 'behind';
    split.innerHTML = `<span>${label}</span><b>${fmtTime(t)}</b>${d == null ? '' : `<i>${d <= 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}</i>`}`;
    st.lastSplit = `${label} · ${fmtTime(t)}${d == null ? '' : ` <i class="${d <= 0 ? 'ahead' : 'behind'}">${d <= 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}</i>`}`;
    clearTimeout(splitTimer);
    splitTimer = setTimeout(() => split.classList.add('hidden'), 3200);
  }
  // this browser's best lap in a car that has checkpoint times
  const bestSplits = (carId) => {
    let b = null;
    for (const l of laps) if (l.car === carId && l.splits && (!b || l.ms < b.ms)) b = l;
    return b;
  };
  document.querySelector('#hud').appendChild(panel);
  const elTime = panel.querySelector('#laptime'), elBest = panel.querySelector('#lapbest'), elCar = panel.querySelector('#lapcar');
  const elLast = panel.querySelector('#laplast'), elMsg = panel.querySelector('#lapmsg');

  const st = {
    running: false, t0: 0, t: 0, off: 0, cps: new Set(), hint: -1, onTrack: false, near: false,
    prev: null, prevTime: 0, splits: [],
  };
  const start = { x: track.P[0][0], z: track.P[0][1], tx: track.tan[0][0], tz: track.tan[0][1], hw: track.HW[0] };

  // after an off-track cancel: a button back to the start, which after a few seconds flies into
  // the START button in the top bar so the player learns where to find it next time
  const back = document.createElement('button');
  back.id = 'lapback';
  back.className = 'hidden';
  back.dataset.act = 'home';
  back.innerHTML = '⌂ RETURN TO LAP START';
  document.querySelector('#hud').appendChild(back);
  let backTimer = 0, backAnim = null;
  function hideBack() {
    clearTimeout(backTimer);
    backAnim?.cancel(); backAnim = null;
    back.classList.add('hidden');
  }
  function offerBack() {
    hideBack();
    back.classList.remove('hidden');
    backTimer = setTimeout(() => {
      const home = document.querySelector('#topbar [data-act="home"]');
      const a = back.getBoundingClientRect(), b = home?.getBoundingClientRect();
      if (!b || !b.width) { hideBack(); return; }
      const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const sc = Math.min(b.width / a.width, b.height / a.height);
      const base = getComputedStyle(back).transform;
      const from = base === 'none' ? '' : base;
      backAnim = back.animate([
        { transform: `${from} translate(0, 0) scale(1)`, opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) ${from} scale(${sc})`, opacity: 0.15 },
      ], { duration: 950, easing: 'cubic-bezier(.55,0,.35,1)', fill: 'forwards' });
      backAnim.onfinish = () => {
        hideBack();
        home.classList.remove('beckon'); void home.offsetWidth;
        home.classList.add('beckon');
        setTimeout(() => home.classList.remove('beckon'), 3200);
      };
    }, 4500);
  }
  back.addEventListener('click', () => setTimeout(hideBack, 0));

  function cancel(why, offer) {
    if (!st.running) return;
    st.running = false;
    elMsg.textContent = why;
    toast(why, offer ? 4500 : 2600);
    if (offer) offerBack();
  }

  // this browser's own best lap in the car being driven (the overall best is the line above)
  let lastCar = null;
  function renderLast(carId = lastCar) {
    lastCar = carId;
    let b = null;
    for (const l of laps) if (l.car === carId && (!b || l.ms < b.ms)) b = l;
    elLast.innerHTML = b ? `<li><em>YOUR BEST</em> <b>${fmtTime(b.ms / 1000)}</b></li>` : '';
  }

  let lastBestKey = '';
  function renderBest(carId, carShort) {
    const b = bestFor(carId);
    const key = `${carId}|${b?.ms}|${b?.name}`;
    if (key === lastBestKey) return;
    lastBestKey = key;
    renderLast(carId);
    elCar.textContent = carShort;
    elBest.innerHTML = b ? `${fmtTime(b.ms / 1000)} <small>${escapeHtml(b.name)}</small>` : '<small>NO LAP YET</small>';
  }

  return {
    track,
    get running() { return st.running; },
    get laps() { return laps; },
    cancel,
    teleported() { st.prev = null; cancel('LAP CANCELLED'); },
    // back to the last spot (R): a short hop, the lap keeps running
    hopped(x, z) { if (st.prev) st.prev = { x, z }; },
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
                  const ref = bestSplits(carId);
                  const lap = { ms: Math.round(lapT * 1000), car: carId, carShort, at: new Date().toISOString(), splits: st.splits.slice() };
                  showSplit('FINISH', lapT, ref ? ref.ms / 1000 : null);
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
              st.running = true; hideBack(); st.t0 = tc; st.cps.clear(); st.splits = []; st.lastSplit = ''; st.off = 0; elMsg.textContent = '';
            }
          }
          if (st.running) {
            track.checkpoints.forEach((cp, k) => {
              if (st.cps.has(cp.i) || Math.hypot(x - cp.x, z - cp.z) >= track.HW[cp.i] + CP_RADIUS) return;
              st.cps.add(cp.i);
              const t = time - st.t0;
              st.splits[k] = Math.round(t * 1000);
              const ref = bestSplits(carId)?.splits?.[k];
              showSplit(`CHECKPOINT ${st.cps.size}/${track.checkpoints.length}`, t, ref == null ? null : ref / 1000);
            });
            if (!onTrack) {
              st.off += moved;
              if (st.off > OFF_LIMIT) cancel('OFF THE TRACK · LAP CANCELLED', true);
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
      landmarks.update(x, z);
      decor.group.visible = show;
      panel.classList.toggle('hidden', !show);
      if (show) {
        elTime.textContent = st.running ? fmtTime(time - st.t0) : '0:00.00';
        panel.classList.toggle('idle', !st.running);
        renderBest(carId, carShort);
        if (!st.running && !elMsg.textContent) elMsg.textContent = 'CROSS THE LINE TO START';
        if (st.running && st.off > 60) elMsg.textContent = `OFF TRACK ${Math.round(st.off)} / ${OFF_LIMIT} M`;
        else if (st.running && st.lastSplit) { if (elMsg.innerHTML !== st.lastSplit) elMsg.innerHTML = st.lastSplit; }
        else if (st.running) elMsg.textContent = `CHECKPOINTS ${st.cps.size}/${track.checkpoints.length}`;
      }
    },
  };
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
