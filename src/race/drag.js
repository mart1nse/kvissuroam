// Drag racing at Ülenurme (Martin 24 Nov 2026; behind ?drag=1 while it is tried out). The strip itself, its tree
// and its lamps: src/race/dragstrip.js. The server's side (the two lanes, pairing two drivers, passing on the
// other car's place 30 times a second): worker/drag.js.
//
// Two glowing boxes behind the start line, one per lane. Drive into one and the car is put on the line in that
// lane (a quick fade, as at Majoraadi's start), held there in neutral: the gearbox is a manual for as long as the
// car is on the strip, A up and Z down (E and Q when WASD drives), R - N - 1 - 2 ... (src/cars/physics.js
// stickShift). On the line the engine revs freely with the throttle. Then:
//  - PRACTICE (P): the tree runs for this lane alone;
//  - or somebody drives into the other box: the server starts the tree for both at the same moment.
// The tree is the sportsman's: pre-stage and stage lit, three ambers half a second apart, then green. A puts the
// car into first, which drops the clutch at the revs the engine has then (too few bog, too many spin the tyres):
// the car out of the stage beam before green is a red light, a false start, and in a race of two that loses. From
// there the gears are the driver's: a shift light on the panel says when.
// The run is timed as a drag strip times it (NHRA): reaction time from green to the car leaving the stage beam,
// elapsed time from there to the quarter mile, the 60 ft, 330 ft, 1/8 mile (with its speed), 1000 ft, and the trap
// speed over the last 66 ft; R/T + ET, green to the finish, under them. A timeslip shows after the finish, with this car's best (kept in this browser), and
// BACK TO THE LINE (R) puts the car back in its lane at once. In a race of two the first over the line wins (each
// car's own reaction and run, not whose message reached the server first); a red light or leaving one's lane loses.
//
// Phones watch only (no A and Z there): the strip, the tree and the others' runs are there, the boxes do not take them.
import * as THREE from 'three';
import { createDragStrip, D, LANES, QUARTER, EIGHTH, FT60, FT330, FT1000, STRIP_YAW, MID } from './dragstrip.js';
import { stickShift, stickAt } from '../cars/physics.js';
import { ringTex, beamTex } from './decor.js';
import { escapeHtml } from './race.js';
import { jobs } from '../jobs.js';

const KEY = 'kvissuroam.drag';              // this browser's best run in each car
// the boxes: where a car is taken onto the line, round its spot there (d along the strip, w across)
const BOX_D0 = -12, BOX_D1 = 1, BOX_HW = 2.7, BOX_H = 1.6, BEAM_H = 180;
const FADE_S = 0.2;
const ROLL = 0.2;                           // m the car's nose moves before it has left the line (the stage beam)
const TRAP = 20.1168;                       // 66 ft: the trap speed is the average over the last of it
const AMBER_S = 0.5;                        // the sportsman's tree: each amber half a second, then green
const PRACTICE_WAIT = [1.4, 2.4];           // s from PRACTICE to the first amber (a random wait, as the tree's own)
const NO_START_S = 8;                       // past green with no clutch drop: the run is off
const ROLLOUT_MS = 10000;                   // after the finish: others still pass through the car this long
// 'at the strip' within this of its middle: H puts the car back on the line from anywhere in it (Martin 27 Nov: "put to
// the drag strip if i am in a 2km circle around it"; at 250 m past the ends a car rolled out after a quick run was out
// of it, and H took it to Toomemägi). The garage's card and LAP TIMES's tab follow the same circle.
const NEAR_M = 2000;
const STUCK_S = 4;                          // the clutch dropped and the car not off the line in this long (its own clock): the run is off
const LANE_OUT = 4.9;                       // m from the lane's middle: out of the lane (over the centre line or the edge)
const RE_WAIT = 30000;                       // ms a rematch question stands (asked, or to answer)
// m away from the strip after a run: its figures on the panel and the race's outcome go (Martin 28 Nov: "let the drag
// results stay for a longer time", it was 260 m, a few seconds' roll-out past the finish), and half a minute at least
const DONE_GONE = 1200, DONE_MS = 30000;
// A race of two's start (Martin 28 Nov: "do not go to the drag line view right away. stall the start for a bit and show
// the same perspective as when waiting, of the two cars. you can rev your engine. and there is some graphic saying that
// you should be prepared for the start procedure, move to the car rear view, allow for one more second of wait and then
// start with the start lights"): the server gives green 7 to 8 s ahead (worker/drag.js LEAD_MS); until this long before
// it the view stays up over both cars with GET READY, A does not go into gear, then the view goes down behind the car
// (about half a second), a second more, and the ambers.
const HOLD_S = 3.2;
const FEED_HZ = 30;                         // our place to the other driver, in a race of two
// Launch revs (tools/drag-launch-test.mjs band): the revs whose quarter mile is within 0.05 s of the car's best
// launch, shown green on the panel's rev bar
const LAUNCH = { w201: [1250, 2750], crv: [3500, 5750], rav4: [3750, 6250], passat: [2100, 4600], mazda6: [1950, 6450], f40: [3250, 7750], cgt: [900, 8400], audi200: [2300, 4800], m3: [800, 8300], impreza: [2850, 6100], focus: [2750, 5500], bus: [1350, 1600] };

const fmt = (s, n = 3) => (s == null || !Number.isFinite(s) ? '–' : s.toFixed(n));
const kmh = (v) => (v == null ? '–' : `${Math.round(v)}`);

function loadBest() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function saveBest(b) { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch { /* private window */ } }
// this browser's last clean runs, newest first, for LAP TIMES' Ülenurme tab: { car, ms (ET), at, inp }
const RUNS_KEY = 'kvissuroam.dragruns', RUNS_KEPT = 10;
function loadRuns() { try { const l = JSON.parse(localStorage.getItem(RUNS_KEY)); return Array.isArray(l) ? l : []; } catch { return []; } }
function saveRuns(l) { try { localStorage.setItem(RUNS_KEY, JSON.stringify(l)); } catch { /* private window */ } }

// where on the strip a car is: d of its nose down the strip, w of its middle across
function stripPos(car) {
  const off = car.a - car.spec.wheelbase / 2, fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw);
  const [d] = D.sv(car.x + fx * (off + car.halfLen), car.z + fz * (off + car.halfLen));
  const [, w] = D.sv(car.x, car.z);
  return [d, w];
}
// the car's spot on the line of a lane: its nose 5 cm short of the line
function linePose(car, lane) {
  const off = car.a - car.spec.wheelbase / 2;
  const [x, z] = D.at(-(off + car.halfLen) - 0.05, LANES[lane]);
  return { x, z, yaw: STRIP_YAW };
}

// inp(): what drives the car now ('kb', 'pad', 'wheel'), kept with a time on the board
// beep(kind): the start lights' sound ('pip', 'go': src/audio.js, as at Majoraadi's start)
export function createDrag({ world, scene, place, toast, mp = null, canDrive = true, free = () => true, ready = () => true, wasd = () => false, carName = (id) => id, shadows = true, inp = () => null, beep = () => {} }) {
  const strip = createDragStrip({ world, scene, shadows });
  const best = loadBest(), runs = loadRuns();
  const st = {
    phase: 'off',           // off, line (on the line, waiting), tree (the lights are running), run, done
    lane: 0, pin: null, go: 0, run: '', duel: null, cool: false, jump: false,
    said: false,            // the server told that we hold the lane (once the place around the line is ready)
    tA: 0, carA: 0, red: false, leave: null, prev: null, t: {}, v: {}, foul: false, dnf: false, res: null, lanes: [null, null],
    feedT: 0, lastD: 0, lastV: 0, stagedD: 0,
  };
  // (a race of two: { id, lane, name, res } of the other driver; feed: their place as last heard, see dragPose)
  const feed = new Map();
  // the others' runs seen on the tree (anyone's: practice or a race), by lane: { go, red, done, win }
  const shown = [null, null];

  // ---- the HUD: the panel (top middle), the tree beside it, the question on the line, the timeslip
  const hudEl = document.querySelector('#hud');
  const panel = document.createElement('div');
  panel.id = 'drag';
  panel.className = 'hidden';
  panel.innerHTML = `<div class="lt"><span class="lbl">DRAG · <span class="ln"></span></span><b>0.000</b><span class="rt"></span></div>
    <div class="shift"><i></i><i></i><i></i><i></i><i></i></div>
    <div class="bars"><div class="me"><i></i></div><div class="op hidden"><i></i><span></span></div></div>
    <div class="lb"><span class="lbl">BEST <span class="car"></span></span><b class="best"></b></div><div class="msg"></div>`;
  hudEl.appendChild(panel);
  // (the reaction time beside the clock once the car is out of the stage beam, Martin 27 Nov: "show the reaction time
  // you got already during the run too")
  const elRt = panel.querySelector('.lt .rt');
  const showRt = (rt) => { elRt.textContent = rt == null ? '' : `R/T ${rt < 0 ? '−' : ''}${Math.abs(rt).toFixed(3)}`; elRt.classList.toggle('red', rt != null && rt < 0); };
  const elTime = panel.querySelector('.lt b'), elLane = panel.querySelector('.ln'), elBest = panel.querySelector('.best'), elCar = panel.querySelector('.car'), elMsg = panel.querySelector('.msg');
  const leds = [...panel.querySelectorAll('.shift i')], barMe = panel.querySelector('.bars .me i'), barOp = panel.querySelector('.bars .op'), barOpI = barOp.querySelector('i'), barOpN = barOp.querySelector('span');
  const treeEl = document.createElement('div');
  treeEl.id = 'dragtree';
  treeEl.className = 'hidden';
  // (two columns, the right lane's on the right as on the real tree; ours marked)
  const col = (l) => `<div class="col l${l}"><b class="pre"></b><b class="stg"></b><i class="a"></i><i class="a"></i><i class="a"></i><i class="g"></i><i class="r"></i></div>`;
  treeEl.innerHTML = `<div class="tree">${col(1)}${col(0)}</div><div class="rev"><div class="band"></div><div class="needle"></div><span>LAUNCH REVS</span></div><div class="gear">N</div>`;
  hudEl.appendChild(treeEl);
  const treeCols = [0, 1].map((l) => treeEl.querySelector(`.col.l${l}`));
  const revEl = treeEl.querySelector('.rev'), bandEl = treeEl.querySelector('.band'), needleEl = treeEl.querySelector('.needle'), gearEl = treeEl.querySelector('.gear');
  const ask = document.createElement('div');
  ask.id = 'dragask';
  ask.className = 'hidden';
  ask.innerHTML = `<h3>READY FOR A DRAG RACE?</h3><div class="btns"><button data-drag="practice">PRACTICE <kbd>P</kbd></button><button data-drag="leave">LEAVE <kbd>⌫</kbd></button></div>
    <p class="other"></p><p class="how"></p>`;
  hudEl.appendChild(ask);
  const elOther = ask.querySelector('.other'), elHow = ask.querySelector('.how');
  // after a run, while the car is at the strip and the slip is folded: one button back onto the start line (Martin 27
  // Nov: "if you have finished a run on the drag strip, then leave a nice clean button on the page to go back to
  // startline"); R does the same just after the run, H from anywhere within 2 km
  const backBtn = document.createElement('button');
  backBtn.id = 'dragback';
  backBtn.className = 'hidden';
  hudEl.appendChild(backBtn);
  let backKey = '', ranHere = false;
  backBtn.addEventListener('click', () => { backBtn.blur(); if (!again()) goLine(); });
  const slip = document.createElement('div');
  slip.id = 'dragslip';
  slip.className = 'hidden';
  hudEl.appendChild(slip);
  // The timeslip stays up until it is closed (Martin 27 Nov: "let the results stay up until someone closes them, clicks
  // somewhere else for instance, also always allow to reopen the slip, sort of fold it down when near drag"): a click
  // anywhere else folds it into a tab on the screen's right edge (not shown during a tree or a run), which opens it again.
  // Since Martin's word later that day ("keep the timeslip up. if i click anywhere else it minimizes it to the side, add
  // an x button on the side minimized view. i can only get rid of the drag slip by clicking the x. it needs to survive
  // moving between worlds"): only a ✕, on the slip or on its tab, puts it away; the tab goes wherever the car goes (H,
  // the track buttons, another circuit); and the start of a Majoraadi stage run, of a timed Toomemägi lap or of a race
  // puts it away too (closeSlip, from main.js).
  const slipTab = document.createElement('div');
  slipTab.id = 'dragsliptab';
  slipTab.className = 'hidden';
  slipTab.innerHTML = '<button class="x" data-tab="close" aria-label="Close the timeslip" title="Close the timeslip">✕</button><button class="open" data-tab="open" title="The last timeslip"><span>TIMESLIP</span></button>';
  hudEl.appendChild(slipTab);
  // The race of two's outcome, big in the middle of the screen once both runs are in, and a REMATCH button (Martin 28
  // Nov: "when finished a drag race, show in big if you won or lost and by how much and then have a button to restart
  // with the same opponent"). REMATCH puts us back on our line and asks the other driver (worker/drag.js passes it on
  // to them only, and only from their last opponent); they get the question here in its place, ACCEPT puts them on
  // their line and the race of two starts as any does, NO tells the asker.
  const won = document.createElement('div');
  won.id = 'dragwin';
  won.className = 'hidden';
  hudEl.appendChild(won);
  let wonKey = '';
  won.addEventListener('click', (e) => {
    const b = e.target.closest('[data-re]');
    if (!b) return;
    b.blur();
    if (b.dataset.re === 'ask') rematch();
    else if (b.dataset.re === 'yes') acceptRematch();
    else if (b.dataset.re === 'no') declineRematch();
  });
  let lastSlip = '';
  slipTab.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    b.blur();
    if (b.dataset.tab === 'open') openSlip(); else closeSlip();
  });
  addEventListener('pointerdown', (e) => { if (!slip.classList.contains('hidden') && !slip.contains(e.target) && !slipTab.contains(e.target)) foldSlip(); }, true);
  for (const el of [ask, slip]) el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-drag]');
    if (!b) return;
    b.blur();
    if (b.dataset.drag === 'practice') practice();
    else if (b.dataset.drag === 'leave') leave();
    else if (b.dataset.drag === 'again') again();
    else if (b.dataset.drag === 'fold') foldSlip();          // (the open slip's ✕ folds it, Martin 28 Nov: only the tab's ✕ puts it away)
  });
  const fader = document.createElement('div');
  fader.style.cssText = `position:fixed;inset:0;background:#0b0420;opacity:0;pointer-events:none;z-index:9000;transition:opacity ${FADE_S}s ease`;
  document.body.appendChild(fader);

  // ---- the boxes: a glowing frame round each lane's spot behind the line, and a column of light over it seen from afar
  const boxes = [];
  let boxQueued = false;
  function makeBoxes() {
    boxQueued = true;
    jobs.add(function* () {
      for (let l = 0; l < 2; l++) {
        const dm = (BOX_D0 + BOX_D1) / 2, len = BOX_D1 - BOX_D0, [x, z] = D.at(dm, LANES[l]), y = world.heightAt(x, z);
        // (a four-sided open tube, turned square to the strip)
        const tube = (hgt, map, op) => {
          const g = new THREE.CylinderGeometry(Math.SQRT1_2, Math.SQRT1_2, hgt, 4, 1, true).rotateY(Math.PI / 4).scale(len, 1, BOX_HW * 2);
          const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, fog: false }));
          m.position.set(x, y + hgt / 2 - 0.05, z);
          m.rotation.y = D.YAW;
          m.renderOrder = 5;
          return m;
        };
        const ring = tube(BOX_H, ringTex(), 0.9), beam = tube(BEAM_H, beamTex(), 0.5);
        scene.add(ring, beam);
        boxes[l] = { ring, beam };
        yield;
      }
    }, 'drag boxes');
  }
  const ease = (m, to, dt) => {
    const d = to - m.material.opacity;
    if (d) m.material.opacity += Math.sign(d) * Math.min(Math.abs(d), Math.min(dt || 0.016, 0.05) * 3);
    m.visible = m.material.opacity > 0.004;
  };

  // ---- the lamps, on the strip's tree and on the panel's
  function lampsFor(lane, now) {
    const o = { pre: false, stage: false, amber: [false, false, false], green: false, red: false };
    const mine = lane === st.lane && st.phase !== 'off';
    const sh = shown[lane];
    const go = mine && (st.phase === 'tree' || st.phase === 'run' || st.phase === 'done') ? st.go : sh?.go;
    const held = mine ? st.phase === 'line' || st.phase === 'tree' : !!st.lanes[lane];
    o.pre = o.stage = held || (!!go && now < go + 1500);
    if (go) {
      const t = (now - go) / 1000;
      for (let k = 0; k < 3; k++) o.amber[k] = t >= -AMBER_S * (3 - k) && t < -AMBER_S * (2 - k);
      const red = mine ? st.red : !!sh?.red;
      o.red = red && t < 6;
      o.green = !red && t >= 0 && t < 6;
    }
    o.win = mine ? !!st.win && st.phase === 'done' : !!sh?.win;
    return o;
  }
  const lastTree = ['', ''];
  function showLamps(now) {
    for (let l = 0; l < 2; l++) {
      const o = lampsFor(l, now);
      strip.tree(l, o);
      const key = `${+o.pre}${+o.stage}${o.amber.map(Number).join('')}${+o.green}${+o.red}`;
      if (key === lastTree[l]) continue;
      lastTree[l] = key;
      const c = treeCols[l];
      c.querySelector('.pre').classList.toggle('on', o.pre);
      c.querySelector('.stg').classList.toggle('on', o.stage);
      c.querySelectorAll('.a').forEach((e, k) => e.classList.toggle('on', o.amber[k]));
      c.querySelector('.g').classList.toggle('on', o.green);
      c.querySelector('.r').classList.toggle('on', o.red);
    }
  }

  // ---- onto the line, off it
  function jumpTo(lane) {
    st.jump = true;
    fader.style.opacity = '1';
    setTimeout(() => {
      st.jump = false;
      requestAnimationFrame(() => { fader.style.opacity = '0'; });
      const c = st.car;
      if (!c || !free() || (st.phase !== 'off' && st.phase !== 'done') || (st.lanes[lane] && st.lanes[lane].id !== mp?.id)) return;
      st.phase = 'off';
      toLine(lane);
    }, FADE_S * 1000 + 20);
  }
  function toLine(lane) {
    const c = st.car, pose = linePose(c, lane);
    st.placing = true;
    place(pose);
    st.placing = false;
    st.phase = 'line'; st.lane = lane; st.pin = pose; st.cool = false;
    st.go = 0; st.run = ''; st.duel = null; st.red = false; st.leave = null; st.prev = null; st.t = {}; st.v = {}; st.foul = false; st.dnf = false; st.res = null; st.win = false; st.tA = 0;
    c.stick = true; c.neutral = true; c.stickRev = false; c.free = c.rpm;
    st.stagedD = stripPos(c)[0];
    foldSlip();
    showAsk();
    elMsg.textContent = '';
    showRt(null);
    // (the lane is taken on the server in update(), once the strip and the ground round it are ready: after a jump
    // from across the map the place loads first, so a race of two does not start while one of us cannot see it)
    st.said = false;
  }
  // off the strip's gearbox: the automatic again, in whatever gear the car is in (in neutral: first)
  function unstick() {
    const c = st.car;
    if (!c) return;
    if (c.neutral) c.gear = 1;
    c.stick = false; c.neutral = false; c.stickRev = false; c.reversing = false; c.dropRpm = undefined;
  }
  function leave() {
    if (st.phase !== 'line' && st.phase !== 'tree') return;
    if (st.phase === 'tree' && st.duel) { finishRun(true); return; }
    st.phase = 'off'; st.pin = null; st.cool = true;
    unstick();
    hideAsk();
    mp?.dragSend({ t: 'drag', op: 'out' });
  }
  function practice() {
    if (st.phase !== 'line') return;
    if (!st.said) { toast('GETTING READY', 1500); return; }
    const wait = PRACTICE_WAIT[0] + Math.random() * (PRACTICE_WAIT[1] - PRACTICE_WAIT[0]);
    startTree(performance.now() + (wait + 3 * AMBER_S) * 1000, null, `p${Date.now() % 1e8}`);
    // (the others see the tree run for this lane)
    if (mp) mp.dragSend({ t: 'drag', op: 'solo', go: Math.round(mp.serverNow() + (st.go - performance.now())) });
  }
  function startTree(go, duel, run) {
    st.phase = 'tree'; st.go = go; st.duel = duel; st.run = run;
    st.beepK = -1; showRt(null);
    foldSlip();                // (the tree where the slip was)
    st.red = false; st.tA = 0; st.rt = null; st.leave = null; st.prev = null; st.t = {}; st.v = {}; st.foul = false; st.dnf = false; st.res = null; st.win = false;
    hideAsk();
    elMsg.textContent = duel ? `VS ${duel.name || 'THE OTHER LANE'}` : 'PRACTICE';
  }
  // A on the line: into first, the clutch dropped (before green: a red light). Returns true when it was taken.
  function shift(dir) {
    const c = st.car;
    if (!c?.stick) return false;
    if (st.phase === 'line') {
      // (nothing runs yet: the car stays in neutral, revving)
      toast(`P FOR PRACTICE · OR WAIT FOR A CAR IN THE OTHER LANE`, 2200);
      return true;
    }
    if (st.phase === 'tree') {
      if (dir < 0 || !c.neutral) return true;
      if (holding()) { toast('GET READY · WAIT FOR THE LIGHTS', 1600); return true; }
      const now = performance.now();
      stickShift(c, 1);
      // (the red light, if any, comes as the car leaves the stage beam: see the run in update())
      st.tA = now; st.carA = c.time;
      st.phase = 'run'; st.pin = null;
      return true;
    }
    stickShift(c, dir);
    return true;
  }

  // ---- the run's end, the timeslip
  function finishRun(dnf = false) {
    if (st.phase === 'done') return;
    st.dnf = dnf || !st.t.q;
    st.phase = 'done'; st.pin = null; st.doneAt = performance.now();
    st.cool = true;          // (a run over in its box, a no-start: out of the box and back in to go again, the timeslip stays)
    ranHere = true;
    unstick();
    const t = st.t, v = st.v;
    const rt = st.leave ? st.rt : null;
    const res = { rt, t60: t.f60, t330: t.f330, t8: t.e8, v8: v.e8, t1000: t.f1000, et: t.q, vq: v.q, red: st.red, foul: st.foul, dnf: st.dnf,
      // (for the race: from green to the finish line, the reaction and the run, R/T + ET)
      tot: !st.dnf && st.leave ? rt + t.q : null };
    st.res = res;
    // this car's best: a clean run (no red light, in its lane)
    const id = st.car.spec.id;
    let pb = false;
    if (!res.dnf && !res.red && !res.foul && (!best[id] || res.et < best[id].et)) {
      best[id] = { et: +res.et.toFixed(3), vq: Math.round(res.vq), rt: +rt.toFixed(3), at: new Date().toISOString() };
      saveBest(best);
      pb = true;
    }
    st.pb = pb;
    if (!res.dnf && !res.red && !res.foul) { runs.unshift({ car: id, ms: Math.round(res.et * 1000), at: new Date().toISOString(), inp: inp() }); runs.length = Math.min(runs.length, RUNS_KEPT); saveRuns(runs); }
    // (every run's figures to the server: a race of two's to the other page, a clean one onto the board, worker/drag.js)
    if (st.run) mp?.dragSend({ t: 'drag', op: 'end', run: st.run, r: pack(res), inp: inp() });
    mp?.dragSend({ t: 'drag', op: 'out' });
    judge();
    showSlip();
  }
  const pack = (r) => {
    const o = { red: r.red ? 1 : 0, foul: r.foul ? 1 : 0, dnf: r.dnf ? 1 : 0 };
    for (const k of ['rt', 'et', 't60', 't330', 't8', 't1000', 'tot']) o[k] = r[k] == null ? null : +r[k].toFixed(3);
    for (const k of ['v8', 'vq']) o[k] = r[k] == null ? null : Math.round(r[k]);
    return o;
  };
  // the race of two, once both runs are in: a red light loses (both red: the earlier one), then leaving the lane,
  // then not finishing; else the first over the line
  function judge() {
    const me = st.res, op = st.duel?.res;
    st.why = '';
    if (!st.duel) { st.win = !me.dnf && !me.red; st.verdict = me.dnf ? 'NO TIME' : me.red ? 'RED LIGHT' : st.pb ? 'NEW BEST' : 'PRACTICE'; return; }
    if (!op) { st.verdict = me.red ? 'RED LIGHT' : 'WAITING FOR THE OTHER LANE'; st.win = false; return; }
    const bad = (r) => (r.red ? 3 : 0) + (r.foul ? 2 : 0) + (r.dnf ? 1 : 0);
    let win;
    if (me.red && op.red) win = me.rt > op.rt;
    else if (bad(me) !== bad(op)) win = bad(me) < bad(op);
    else if (me.tot != null && op.tot != null) win = me.tot <= op.tot;
    else win = false;
    st.win = win;
    st.verdict = win ? 'WIN' : me.red ? 'RED LIGHT' : 'LOSS';
    // (decided by a red light, a car out of its lane or one not finishing, rather than by the clock)
    const lost = win ? op : me;
    st.why = bad(me) === bad(op) ? '' : `${win ? 'THEIR ' : ''}${lost.red ? 'RED LIGHT' : lost.foul ? 'OUT OF LANE' : 'NO FINISH'}`;
    st.margin = me.tot != null && op.tot != null ? Math.abs(me.tot - op.tot) : null;
  }
  // The slip's columns are the lanes, the left lane's on the left (Martin 28 Nov: "always show left columns as LEFT LANE
  // and right column as RIGHT LANE (and highlight which is you)"); a run alone has its own lane's column only.
  // (lane 1 is the left lane, as the panel says)
  function slipRow(lbl, a, b) {
    const me = `<td class="me">${a}</td>`, other = st.duel ? `<td>${b}</td>` : '';
    return `<tr><th>${lbl}</th>${st.lane === 1 ? me + other : other + me}</tr>`;
  }
  function showSlip() {
    const r = st.res, o = st.duel?.res || {}, id = st.car.spec.id, b = best[id];
    const name = st.duel ? escapeHtml(st.duel.name || 'OTHER') : '';
    const rt = (x) => (x.rt == null ? '–' : `${x.rt < 0 ? '−' : ''}${Math.abs(x.rt).toFixed(3)}`);
    // (the 1/4 mile's ET runs from the car leaving the line, as on a real slip; with the reaction: green to the finish,
    // what decides a race of two)
    const sum = (x) => (x.tot == null || x.dnf ? '–' : x.tot.toFixed(3));
    slip.innerHTML = lastSlip = `<button class="x" data-drag="fold" aria-label="Fold the timeslip to the side" title="Fold to the right edge (its ✕ there puts it away)">✕</button><h3 class="${st.win ? 'win' : st.verdict === 'RED LIGHT' ? 'red' : ''}">${st.verdict}${st.margin != null ? ` <small>by ${st.margin.toFixed(3)} s</small>` : ''}</h3>
      <table><thead>${slipRow('', `${laneName(st.lane)}<small>YOU</small>`, `${laneName(1 - st.lane)}<small>${name}</small>`).replace(/<(\/?)td/g, '<$1th')}</thead><tbody>
      ${slipRow('R/T', rt(r), rt(o))}
      ${slipRow('60 FT', fmt(r.t60), fmt(o.t60))}
      ${slipRow('330 FT', fmt(r.t330), fmt(o.t330))}
      ${slipRow('1/8 MILE', fmt(r.t8), fmt(o.t8))}
      ${slipRow('KM/H', kmh(r.v8), kmh(o.v8))}
      ${slipRow('1000 FT', fmt(r.t1000), fmt(o.t1000))}
      ${slipRow('1/4 MILE', `<b>${r.dnf ? 'DNF' : fmt(r.et)}</b>`, `<b>${o.dnf ? 'DNF' : fmt(o.et)}</b>`)}
      ${slipRow('TRAP KM/H', `<b>${kmh(r.vq)}</b>`, `<b>${kmh(o.vq)}</b>`)}
      </tbody><tbody class="sum">${slipRow('R/T + ET', sum(r), sum(o))}</tbody></table>
      <p class="pb">${st.car.spec.short.toUpperCase()} BEST · ${b ? `${b.et.toFixed(3)} @ ${b.vq} KM/H` : 'NO CLEAN RUN YET'}${r.foul ? ' · OUT OF LANE' : ''}</p>
      <button data-drag="again">↺ BACK TO THE LINE <kbd>R</kbd></button>`;
    slip.classList.remove('hidden');
  }
  function foldSlip() { slip.classList.add('hidden'); }
  const laneName = (l) => (l === 1 ? 'LEFT LANE' : 'RIGHT LANE');
  // a race of two about to start, still in its hold (see HOLD_S)
  const holding = () => st.phase === 'tree' && !!st.duel && performance.now() < st.go - HOLD_S * 1000;
  // put away for good: no tab either, until the next run's slip
  function closeSlip() { if (!lastSlip) return; lastSlip = ''; slip.classList.add('hidden'); slipTab.classList.add('hidden'); }
  // the last slip again (its BACK TO THE LINE only while that run is the one just over)
  function openSlip() {
    if (!lastSlip) return;
    slip.innerHTML = lastSlip;
    if (st.phase !== 'done') slip.querySelector('[data-drag="again"]')?.remove();
    slip.classList.remove('hidden');
  }
  // ---- the rematch
  // REMATCH: back on our line, and the question to the one we just raced
  function rematch() {
    const o = st.duel;
    if (!o || (st.phase !== 'done' && st.phase !== 'off') || !free()) return;
    const was = { id: o.id, name: o.name };
    if (!(st.phase === 'done' ? again() : goLine())) return;
    if (st.phase !== 'line') return;
    st.reAsked = { ...was, at: performance.now() };
    st.reFrom = null;
    mp?.dragSend({ t: 'drag', op: 're', id: was.id });
    otherText();
  }
  // their question answered: ACCEPT onto our line (the same lane as before when it is free), NO back to them
  function acceptRematch() {
    const r = st.reFrom;
    st.reFrom = null;
    if (!r || !free()) return;
    if (!again()) goLine();
  }
  function declineRematch() {
    const r = st.reFrom;
    st.reFrom = null;
    if (r) mp?.dragSend({ t: 'drag', op: 'reno', id: r.id });
  }
  // the banner: the race just over (YOU WON / YOU LOST, by how much, REMATCH), or the other driver's question
  function showWon(now) {
    if (st.reFrom && now - st.reFrom.at > RE_WAIT) st.reFrom = null;
    if (st.reAsked && now - st.reAsked.at > RE_WAIT) st.reAsked = null;
    const at = st.car && Math.hypot(st.car.x - MID[0], st.car.z - MID[1]) < NEAR_M;
    const asked = st.reFrom && canDrive && at && (st.phase === 'done' || st.phase === 'off') && !st.jump;
    const over = !asked && st.phase === 'done' && st.duel?.res && !st.jump;
    const ready = holding();
    let key = '';
    if (ready) key = `r${st.run}`;
    else if (asked) key = `q${st.reFrom.id}`;
    else if (over) key = `w${st.run}${st.win}`;
    if (key === wonKey) return;
    wonKey = key;
    won.classList.toggle('hidden', !key);
    if (!key) return;
    if (ready) {
      won.className = 'ready';
      won.innerHTML = `<h2>GET READY</h2><p class="by">START PROCEDURE</p>
        <p class="vs">VS <b>${escapeHtml(st.duel.name || 'THE OTHER LANE')}</b> · REV IT UP IN NEUTRAL</p>`;
      return;
    }
    if (asked) {
      won.className = 'ask';
      won.innerHTML = `<p class="vs"><b>${escapeHtml(st.reFrom.name || 'THE OTHER DRIVER')}</b> WANTS A REMATCH</p>
        <div class="btns"><button data-re="yes">ACCEPT</button><button data-re="no" class="no">NO</button></div>`;
      return;
    }
    won.className = st.win ? 'win' : 'loss';
    const by = st.why || (st.margin != null ? `BY ${st.margin.toFixed(3)} S` : '');
    won.innerHTML = `<h2>${st.win ? 'YOU WON' : 'YOU LOST'}</h2>${by ? `<p class="by">${by}</p>` : ''}
      <p class="vs">VS <b>${escapeHtml(st.duel.name || 'THE OTHER LANE')}</b></p>
      <div class="btns"><button data-re="ask">↺ REMATCH</button></div>`;
  }
  function showAsk() {
    ask.classList.remove('hidden');
    const up = wasd() ? 'E' : 'A';
    elHow.innerHTML = `REV IT IN NEUTRAL WITH THE THROTTLE · <b>${up}</b> PUTS IT IN GEAR: ON GREEN, NOT BEFORE · THEN <b>${up}</b> UP, <b>${wasd() ? 'Q' : 'Z'}</b> DOWN`;
    otherText();
  }
  function hideAsk() { ask.classList.add('hidden'); }
  function otherText() {
    const o = st.lanes[1 - st.lane], r = st.reAsked;
    if (!o && r) { elOther.innerHTML = `REMATCH ASKED · WAITING FOR <b>${escapeHtml(r.name || 'THE OTHER DRIVER')}</b>`; return; }
    elOther.innerHTML = o ? `<b>${escapeHtml(o.name || 'SOMEBODY')}</b> IS IN THE OTHER LANE` : 'THE OTHER LANE IS FREE · ANYONE WHO PULLS IN THERE RACES YOU';
  }
  // the DRAG STRIP button, H, DRIVE with ÜLENURME picked, BACK TO THE LINE away from the line: onto the line of a free lane
  function goLine(car = st.car) {
    if (car) st.car = car;          // (DRIVE with ÜLENURME picked: before the first frame of driving)
    if (!canDrive || !st.car || !free()) return false;
    const ours = (l) => !st.lanes[l] || st.lanes[l].id === mp?.id;
    const lane = st.phase !== 'off' && ours(st.lane) ? st.lane : ours(0) ? 0 : ours(1) ? 1 : -1;
    if (lane < 0) { toast('BOTH LANES ARE TAKEN', 2000); return true; }
    if (st.phase === 'run' || st.phase === 'tree') cancel();
    st.phase = 'off';
    toLine(lane);
    return true;
  }
  // R after a run: straight back onto the line in the same lane (or the other, if that one is taken now)
  function again() {
    if (st.phase !== 'done' || !free()) return false;
    let lane = st.lane;
    if (st.lanes[lane] && st.lanes[lane].id !== mp?.id) lane = 1 - lane;
    if (st.lanes[lane] && st.lanes[lane].id !== mp?.id) { toast('BOTH LANES ARE TAKEN', 2000); return true; }
    st.phase = 'off';
    toLine(lane);
    return true;
  }
  function cancel(why) {
    if (st.phase === 'off') return;
    const was = st.phase;
    if (was === 'run' || (was === 'tree' && st.duel)) { finishRun(true); return; }
    st.pin = null;
    if (was !== 'done') { unstick(); mp?.dragSend({ t: 'drag', op: 'out' }); }
    st.phase = 'off';
    hideAsk();                 // (the timeslip stays as it is: it goes with the car)
    if (why && was !== 'done') toast(why, 2200);
  }

  // ---- the server's word (worker/drag.js)
  function message(m) {
    const now = performance.now();
    const local = (t) => now + (t - (mp ? mp.serverNow() : Date.now()));
    if (m.op === 'welcome') {
      // (online again, or the server restarted: it hears the lanes from the pages again; who holds one comes next)
      st.lanes = [null, null];
      if (st.phase === 'line' && st.said) mp?.dragSend({ t: 'drag', op: 'in', l: st.lane });
    } else if (m.op === 'lanes' && Array.isArray(m.l)) {
      st.lanes = [0, 1].map((k) => (m.l[k] && typeof m.l[k].id === 'string' ? { id: m.l[k].id, name: String(m.l[k].name || ''), run: m.l[k].run || '' } : null));
      if (st.phase === 'line') otherText();
    } else if (m.op === 'no') {
      // (the lane was taken by somebody else a moment before us)
      if (st.phase === 'line' && m.l === st.lane) { cancel(); toast('THAT LANE IS TAKEN', 2000); }
    } else if (m.op === 'go' && Array.isArray(m.l) && Number.isFinite(m.go)) {
      const go = local(m.go);
      const mine = m.l.indexOf(mp?.id);
      for (let k = 0; k < 2; k++) if (m.l[k] && m.l[k] !== mp?.id) shown[k] = { go, id: m.l[k], run: m.run, red: false, win: false };
      // (our practice as the server started it: its name for the run, which our figures go back under)
      if (mine >= 0 && !m.l[1 - mine] && (st.phase === 'tree' || st.phase === 'run') && !st.duel && mine === st.lane) st.run = m.run;
      // a race of two that we are in: the tree runs for both of us
      if (mine >= 0 && m.l[1 - mine] && (st.phase === 'line' || (st.phase === 'tree' && !st.duel && !st.tA)) && mine === st.lane) {
        const id = m.l[1 - mine];
        st.reAsked = null; st.reFrom = null;
        startTree(go, { id, lane: 1 - mine, name: mp?.nameOf(id) || st.lanes[1 - mine]?.name || '', res: null }, m.run);
        toast(`DRAG RACE · ${(st.duel.name || 'THE OTHER LANE').toUpperCase()}`, 2200);
      }
    } else if (m.op === 're' && typeof m.id === 'string') {
      // (the one we last raced asks for a rematch; already on the line: nothing to answer, the race starts by itself)
      if (st.phase === 'line' || st.phase === 'tree' || st.phase === 'run') return;
      st.reFrom = { id: m.id, name: String(m.name || mp?.nameOf(m.id) || ''), at: now };
    } else if (m.op === 'reno' && typeof m.id === 'string') {
      if (st.reAsked?.id === m.id) { st.reAsked = null; toast(`${String(m.name || 'THE OTHER DRIVER').toUpperCase()} SAID NO TO A REMATCH`, 2400); if (st.phase === 'line') otherText(); }
    } else if (m.op === 'res' && m.r && typeof m.r === 'object') {
      const k = shown.findIndex((s) => s && s.id === m.id && s.run === m.run);
      if (k >= 0) { shown[k].red = !!m.r.red; shown[k].res = m.r; }
      if (st.duel && m.id === st.duel.id && m.run === st.run) {
        st.duel.res = m.r;
        if (st.phase === 'done') { judge(); showSlip(); }
      }
      // (a race of two seen from outside: the winner's light, once both are in)
      const pair = shown.filter((s) => s && s.run === m.run && s.res);
      if (pair.length === 2) {
        const [a, b] = pair, bad = (r) => (r.red ? 3 : 0) + (r.foul ? 2 : 0) + (r.dnf ? 1 : 0);
        const aw = bad(a.res) !== bad(b.res) ? bad(a.res) < bad(b.res) : (a.res.tot ?? 1e9) <= (b.res.tot ?? 1e9);
        a.win = aw; b.win = !aw;
      }
    }
  }
  // their place 30 times a second, in a race of two (or anyone's we hear): [d, w, speed, acceleration, server ms]
  function heard(id, a) {
    if (!Array.isArray(a) || a.length < 5 || !a.every(Number.isFinite)) return;
    feed.set(id, { d: a[0], w: a[1], v: a[2], acc: a[3], at: a[4], red: !!a[5], seen: performance.now() });
    if (a[5]) for (const s of shown) if (s && s.id === id) s.red = true;
    if (st.duel?.id === id && a[5] && !st.duel.red) st.duel.red = true;
  }
  // the other driver's car drawn where it is now on the strip, from the last feed and its speed (multiplayer.js)
  function dragPose(id, p) {
    const f = feed.get(id);
    if (!f || performance.now() - f.seen > 600 || !mp) return false;
    const age = Math.min(0.35, Math.max(0, (mp.serverNow() - f.at) / 1000));
    const d = f.d + f.v * age + 0.5 * f.acc * age * age;
    const [x, z] = D.at(d, f.w);
    p[0] = x; p[1] = z; p[3] = STRIP_YAW;
    return true;
  }
  function oppD() {
    const f = st.duel && feed.get(st.duel.id);
    if (!f || !mp) return null;
    const age = Math.min(0.35, Math.max(0, (mp.serverNow() - f.at) / 1000));
    return f.d + f.v * age + 0.5 * f.acc * age * age;
  }

  let lastShift = -1;
  const wv = { x: 0, z: 0, ox: 0, oz: 0, yaw: 0 };
  return {
    strip,
    get phase() { return st.phase; },
    get go() { return st.go; },
    get duel() { return st.duel; },
    get pin() { return st.pin; },
    // the strip's gearbox is in: A and Z go to shift(), not the automatic's hand shifts
    get stick() { return !!st.car?.stick && st.phase !== 'off'; },
    // on the line or on a run: the others' cars pass through ours (and ours through theirs)
    // (and after the run while the car is still rolling out down the strip: the other lane's car may stop beside it)
    get busy() { return st.phase === 'line' || st.phase === 'tree' || st.phase === 'run' || (st.phase === 'done' && performance.now() - st.doneAt < ROLLOUT_MS); },
    // at the strip: on it in any way, or within 2 km of it (H puts the car back on the line from here, as at Majoraadi's start)
    get here() { const c = st.car; return !!c && (st.phase !== 'off' || Math.hypot(c.x - MID[0], c.z - MID[1]) < NEAR_M); },
    get lanes() { return st.lanes; },
    // waiting on the line, before a tree (the camera rises and looks round meanwhile, src/main.js): our car's spot and
    // the other lane's [ox, oz], beside it across the strip, and the way the strip runs; null otherwise
    get waitView() {
      if (!(st.phase === 'line' || (st.phase === 'tree' && holding())) || !st.pin) return null;
      const [ax, az] = D.at(0, LANES[st.lane]), [bx, bz] = D.at(0, LANES[1 - st.lane]);
      wv.x = st.pin.x; wv.z = st.pin.z; wv.ox = st.pin.x + bx - ax; wv.oz = st.pin.z + bz - az; wv.yaw = STRIP_YAW;
      return wv;
    },
    get result() { return st.res; },
    get best() { return best; },
    get runs() { return runs; },
    shift, practice, leave, again, cancel, message, heard, dragPose, closeSlip,
    // the DRAG STRIP button: straight onto the line of a free lane
    goLine,
    // the car was put somewhere (place() in main.js): unless it was onto our line, the run is off
    placed() { if (!st.placing && st.phase !== 'off') cancel(st.phase === 'done' ? '' : 'DRAG RUN CANCELLED'); },
    update(car, dt, look = null) {
      st.car = car;
      const now = performance.now();
      strip.update(car, look);
      const c = look || car;
      const dm = Math.hypot(c.x - MID[0], c.z - MID[1]);
      // the boxes (desktop only: phones watch)
      if (canDrive) {
        if (!boxQueued && dm < 2500) makeBoxes();
        for (let l = 0; l < 2; l++) {
          const b = boxes[l];
          if (!b) continue;
          const taken = !!st.lanes[l] && st.lanes[l].id !== mp?.id;
          const mine = st.phase !== 'off' && st.lane === l;
          // (after a run too: driving back into a box is one way to go again, Martin 27 Nov, R the other)
          const open = st.phase === 'off' || st.phase === 'done';
          ease(b.beam, dm < 2500 && open && !taken ? 0.5 : 0, dt);
          ease(b.ring, dm < 700 && !taken && (open || (mine && st.phase === 'line')) ? 0.9 : 0, dt);
        }
      }
      // ---- into a box
      const [d, w] = stripPos(car);
      if ((st.phase === 'off' || st.phase === 'done') && canDrive && !st.jump && strip.built && free()) {
        const inBox = (l) => d > BOX_D0 && d < BOX_D1 + 3 && Math.abs(w - LANES[l]) < BOX_HW;
        const along = Math.cos(car.yaw - STRIP_YAW) > 0.5, slow = Math.abs(car.vx) < 22;
        let l = inBox(0) ? 0 : inBox(1) ? 1 : -1;
        if (st.cool && l < 0) st.cool = false;
        if (l >= 0 && !st.cool && along && slow) {
          if (st.lanes[l] && st.lanes[l].id !== mp?.id) { st.cool = true; toast(`THIS LANE IS TAKEN · ${(st.lanes[l].name || '').toUpperCase()}`, 2000); }
          else jumpTo(l);
        }
      }
      // ---- on the line: the lane ours on the server once all round is ready
      if (st.phase === 'line' && !st.said && strip.built && ready() && world.ready(car.x, car.z)) {
        st.said = true;
        mp?.dragSend({ t: 'drag', op: 'in', l: st.lane });
      }
      // ---- the tree's beeps (Martin 27 Nov: "start light beeps too"): a pip as each amber lights and the long high one
      // of Majoraadi's start at green (none at green after a red light); once each, the latest only after a slow frame
      if ((st.phase === 'tree' || st.phase === 'run') && st.go) {
        const t = (now - st.go) / 1000, k = t >= 0 ? 3 : t >= -AMBER_S ? 2 : t >= -2 * AMBER_S ? 1 : t >= -3 * AMBER_S ? 0 : -1;
        if (k > st.beepK) { st.beepK = k; if (t < 0.5 && !(k === 3 && st.red)) beep(k === 3 ? 'go' : 'pip'); }
      }
      // ---- the tree
      if (st.phase === 'tree') {
        const t = (now - st.go) / 1000;
        elTime.textContent = t < 0 ? '0.000' : fmt(t);
        if (t > NO_START_S) {
          if (st.duel) finishRun(true);
          else { toast('NO START · P FOR ANOTHER GO', 2400); st.phase = 'line'; st.go = 0; elTime.textContent = '0.000'; elMsg.textContent = ''; showAsk(); mp?.dragSend({ t: 'drag', op: 'in', l: st.lane }); }
        }
      }
      // ---- the run, timed on the car's own clock
      if (st.phase === 'run') {
        const ct = car.time;
        if (st.prev && !st.leave && d - st.stagedD >= ROLL) {
          const f = (st.stagedD + ROLL - st.prev.d) / Math.max(1e-6, d - st.prev.d);
          st.leave = { t: st.prev.t + (ct - st.prev.t) * Math.max(0, Math.min(1, f)) };
          // the reaction time as on a real timeslip (Martin 27 Nov: "research first how it is usually done"): from green
          // to the car leaving the stage beam, its roll-out from the clutch drop in it, so R/T + ET is green to the finish.
          // Out of the beam before green: a red light (A a moment before green is no foul if the car is not out yet).
          st.rt = (st.tA - st.go) / 1000 + (st.leave.t - st.carA);
          if (st.rt < 0) { st.red = true; toast('RED LIGHT · FALSE START', 2600); }
          showRt(st.rt);
        }
        if (st.leave && st.prev) {
          // a line's moment: the time between this frame and the last at which the nose crossed it
          const cross = (at) => { if (d >= at && st.prev.d < at) { const f = (at - st.prev.d) / Math.max(1e-6, d - st.prev.d); return st.prev.t + (ct - st.prev.t) * f - st.leave.t; } return null; };
          const marks = [['f60', FT60], ['f330', FT330], ['e8a', EIGHTH - TRAP], ['e8', EIGHTH], ['f1000', FT1000], ['qa', QUARTER - TRAP], ['q', QUARTER]];
          for (const [k, at] of marks) if (st.t[k] == null) { const x = cross(at); if (x != null) st.t[k] = x; }
          if (st.t.e8 != null && st.v.e8 == null && st.t.e8a != null) st.v.e8 = (TRAP / Math.max(1e-3, st.t.e8 - st.t.e8a)) * 3.6;
          if (st.t.q != null && st.v.q == null && st.t.qa != null) st.v.q = (TRAP / Math.max(1e-3, st.t.q - st.t.qa)) * 3.6;
          elTime.textContent = fmt(st.t.q ?? (ct - st.leave.t));
        } else elTime.textContent = '0.000';
        if (Math.abs(w - LANES[st.lane]) > LANE_OUT && d > 0 && !st.foul) { st.foul = true; toast('OUT OF YOUR LANE', 2000); }
        st.prev = { d, t: ct };
        if (st.t.q != null) finishRun(false);
        // (stopped, turned back or gone off the strip before the line: no time)
        else if ((st.leave && Math.abs(car.vx) < 0.5 && ct - st.leave.t > 4) || Math.abs(w) > 40 || d < -30 || (!st.leave && ct - st.carA > STUCK_S)) finishRun(true);
      }
      // ---- after the run
      if (st.phase === 'done') {
        elTime.textContent = st.res?.dnf ? 'DNF' : fmt(st.res?.et);
        // (the other driver's figures never came: they left, or their page lost its connection)
        if (st.duel && !st.duel.res && now - st.doneAt > 20000) { st.duel.res = { dnf: 1, red: 0, foul: 0, rt: null, tot: null }; judge(); showSlip(); }
        // (and not before half a minute: a car let roll after the finish is far down the runway in a few seconds)
        const far = Math.hypot(car.x - MID[0], car.z - MID[1]);
        if ((far > QUARTER / 2 + DONE_GONE && now - st.doneAt > DONE_MS) || far > NEAR_M) st.phase = 'off';      // (the slip stays up till closed)
      }
      // the folded slip's tab: wherever the car is, but not in a lane (the tree has that edge of the screen then)
      const tabOn = !!lastSlip && canDrive && slip.classList.contains('hidden') && st.phase !== 'line' && st.phase !== 'tree' && st.phase !== 'run';
      if (tabOn === slipTab.classList.contains('hidden')) slipTab.classList.toggle('hidden', !tabOn);
      // the BACK TO THE LINE button: after a run here, not in a lane, the slip folded (it has its own then)
      const near = Math.hypot(car.x - MID[0], car.z - MID[1]) < NEAR_M;
      if (!near) ranHere = false;
      const backOn = ranHere && canDrive && near && (st.phase === 'done' || st.phase === 'off') && slip.classList.contains('hidden') && !st.jump && !look;
      if (backOn === backBtn.classList.contains('hidden')) backBtn.classList.toggle('hidden', !backOn);
      const key = st.phase === 'done' ? 'R' : 'H';
      if (backOn && key !== backKey) { backKey = key; backBtn.innerHTML = `↺ BACK TO THE LINE <kbd>${key}</kbd>`; }
      showWon(now);
      // ---- our place to the other driver, 30 times a second
      if (st.duel && (st.phase === 'tree' || st.phase === 'run' || (st.phase === 'done' && now - st.doneAt < 2500)) && mp) {
        st.feedT -= dt;
        if (st.feedT <= 0) {
          st.feedT = 1 / FEED_HZ;
          const v = car.vx, acc = dt > 0 ? (v - st.lastV) / dt : 0;
          mp.dragFeed([+d.toFixed(2), +w.toFixed(2), +v.toFixed(2), +Math.max(-15, Math.min(15, acc)).toFixed(1), Math.round(mp.serverNow()), st.red ? 1 : 0]);
        }
      }
      st.lastV = car.vx;
      // ---- the lamps and the panel
      const on = st.phase !== 'off';
      if (strip.built && dm < 1200) showLamps(now);
      panel.classList.toggle('hidden', !on);
      treeEl.classList.toggle('hidden', !(st.phase === 'line' || st.phase === 'tree' || (st.phase === 'run' && now - st.go < 2500)));
      if (on) {
        elLane.textContent = st.lane === 0 ? 'RIGHT LANE' : 'LEFT LANE';
        const id = car.spec.id, b = best[id];
        elCar.textContent = car.spec.short.toUpperCase();
        elBest.innerHTML = b ? `${b.et.toFixed(3)} <small>@ ${b.vq} KM/H</small>` : '<small>NO TIME YET</small>';
        // the shift light: five lamps filling up to the shift point, all flashing at it
        const e = car.spec.engine, ev = e.type === 'ev';
        const r = ev || !car.stick || car.neutral || car.stickRev ? 0 : car.rpm / e.shiftRpm;
        const n = r < 0.75 ? 0 : Math.min(5, Math.floor((r - 0.75) / 0.05) + 1);
        const flash = r >= 0.97 && (now / 90 | 0) % 2 === 0;
        const key = r >= 0.97 ? (flash ? 6 : 7) : n;
        if (key !== lastShift) { lastShift = key; leds.forEach((l, k) => { l.className = r >= 0.97 ? (flash ? 'on max' : '') : k < n ? `on k${k}` : ''; }); }
        barMe.style.width = `${Math.max(0, Math.min(100, (d / QUARTER) * 100)).toFixed(1)}%`;
        const od = oppD();
        barOp.classList.toggle('hidden', !st.duel);
        if (st.duel) { barOpI.style.width = `${Math.max(0, Math.min(100, ((od ?? 0) / QUARTER) * 100)).toFixed(1)}%`; barOpN.textContent = st.duel.name || ''; }
        // the rev bar on the line: where the revs are and the launch's good band
        if (!treeEl.classList.contains('hidden')) {
          const L = LAUNCH[id], red = e.redline || 1;
          revEl.classList.toggle('hidden', ev || !car.neutral);
          if (L) { bandEl.style.left = `${(L[0] / red) * 100}%`; bandEl.style.width = `${((L[1] - L[0]) / red) * 100}%`; }
          needleEl.style.left = `${Math.min(100, (car.rpm / red) * 100).toFixed(1)}%`;
          gearEl.textContent = stickAt(car);
        }
      }
    },
  };
}
