// Graphics quality that follows the frame rate the player actually gets.
//
// The game measures every frame. When the typical frame (the median of a two second window) stays
// slow, the graphics step one rung down a ladder: sharpness (pixel ratio) first, then the leafy tree
// distance, the shadow map, how far the city streams in, and at the bottom a softer, lower
// resolution picture, and under that an extra low rung for old computers and slow phones (half
// sharpness, a short view into the haze, fewer streets loaded; Martin's ThinkPad T440s of 2013 ran the
// old bottom rung at 18 FPS, 21 Nov 2026). When the frame rate has room to spare for a while, it tries one rung up, and if
// that rung drops it straight back down, the rung is barred for a growing time (twice: for the
// session), so it never flickers between two settings. Where the browser lets us time the graphics
// card, a card close to its limit counts as slow even at a full 60 FPS (frames then queue up and the
// picture lags behind the keys), and a rung is only climbed when the card has room for it.
//
// The levels are plain numbers; createQuality() applies them to the renderer, the sun and the trees. The governor is
// pure logic so tools/quality-test.mjs can drive it with made-up frame times.

// Rungs from the bottom (0) to the top. Every rung is a whole setting; the device caps (phones, a
// 1x screen) are applied on top, and rungs that come out the same are merged.
// (far: how far the camera sees, in metres; only the extra low rung pulls it in, the haze with it)
export const LADDER = [
  { dpr: 0.5,  shadow: 0,    trees: 40,  load: 340, far: 1500 },
  { dpr: 0.6,  shadow: 0,    trees: 45,  load: 420 },
  { dpr: 0.75, shadow: 0,    trees: 50,  load: 480 },
  { dpr: 0.9,  shadow: 0,    trees: 60,  load: 560 },
  { dpr: 1,    shadow: 0,    trees: 70,  load: 640 },
  { dpr: 1,    shadow: 1024, trees: 80,  load: 760 },
  { dpr: 1,    shadow: 2048, trees: 100, load: 880 },
  { dpr: 1.25, shadow: 2048, trees: 120, load: 1000 },
  { dpr: 1.5,  shadow: 2048, trees: 150, load: 1000 },
  { dpr: 2,    shadow: 2048, trees: 150, load: 1000 },
];

// The rungs this device can use: each value capped by what the device starts with, duplicates merged.
export function deviceLadder(caps) {
  const out = [];
  for (const r of LADDER) {
    const l = {
      dpr: Math.min(r.dpr, caps.dpr),
      shadow: Math.min(r.shadow, caps.shadow),
      trees: Math.min(r.trees, caps.trees),
      load: Math.min(r.load, caps.load),
      far: Math.min(r.far ?? Infinity, caps.far ?? Infinity),
    };
    const p = out[out.length - 1];
    if (p && p.dpr === l.dpr && p.shadow === l.shadow && p.trees === l.trees && p.load === l.load && p.far === l.far) continue;
    out.push(l);
  }
  return out;
}

// The governor. feed(ms) once per drawn frame with that frame's length; it returns the new level
// index when it decides to move, else -1. hold(s) pauses judging (after a change, a tab switch).
export function createGovernor({ levels, start = levels - 1, top = levels - 1 }) {
  const WINDOW = 2000;              // ms of frames per verdict
  let level = Math.max(0, Math.min(levels - 1, top, start));
  let ceiling = Math.max(0, Math.min(levels - 1, top));   // highest rung allowed (lowered by rungs that failed, or by a crash)
  let floor = 0;                   // lowest rung allowed (raised when stepping down did not help)
  let buf = [], sum = 0, gbuf = [];
  const ratio = new Array(levels).fill(0);   // how much more a rung costs the graphics card than the one below (seen when stepping down)
  let holdMs = 4000;               // the first seconds compile shaders and stream the city: ignore
  let lowRun = 0, highRun = 0, flat = 0;
  let bestFps = 60;                // the screen's rate as far as we know: 60 Hz, or faster once seen, or the cap found below
  let lastUp = -1e9, clock = 0, before = 0, beforeGpu = 0, judgeAfter = false, preFlat = level, stepFrom = level;
  const fails = new Array(levels).fill(0), barredUntil = new Array(levels).fill(0);
  let fps = 0;
  let capFps = 0;                  // the rate the browser or the system holds the game at, once found (see 'no gain')

  function move(to, why) {
    const from = level;
    level = to;
    buf = []; sum = 0; gbuf = []; lowRun = 0; highRun = 0;
    holdMs = 2500;                 // shader rebuilds and new shadow maps take a moment
    if (to > from) lastUp = clock;
    return { from, to, why };
  }

  // gpu: the graphics card's ms per frame (median of the window), or null where it can't be measured.
  // A card that needs more than the screen's frame time still lets the browser ask for frames at the
  // full rate: the frames queue up and the picture lags behind the keys, at a steady 60 FPS. So a
  // card close to its limit counts as slow too, and a rung is only climbed when the card has room for it.
  function verdict(median, spread, gpu) {
    fps = 1000 / median;
    // the cap has gone (the charger was plugged in, the battery saver switched off): judge freely again
    if (capFps && fps > capFps * 1.25) { capFps = 0; floor = 0; }
    if (fps > bestFps) bestFps = Math.min(240, fps);
    const downAt = Math.min(42, bestFps * 0.72), upAt = Math.min(57, bestFps * 0.93);
    const budget = 1000 / bestFps, load = gpu == null ? null : gpu / budget;
    // was the last step down worth it? A 30 Hz cap or a busy CPU does not speed up with fewer pixels
    if (judgeAfter) {
      judgeAfter = false;
      const gpuGain = gpu != null && beforeGpu > 0 && gpu < beforeGpu * 0.92;
      if (gpu != null && beforeGpu > 0) {
        const steps = stepFrom - level, r = Math.min(3, Math.max(1, beforeGpu / gpu)) ** (1 / Math.max(1, steps));
        for (let k = level + 1; k <= stepFrom; k++) ratio[k] = r;
      }
      if (fps < before * 1.08 && spread < 4 && !gpuGain) {
        if (++flat >= 3) {
          // three steps down bought nothing: the frame rate is capped elsewhere (a 30 Hz battery saver,
          // a busy CPU). Put them back, stop going down, and judge against this rate from now on.
          flat = 0;
          floor = preFlat;
          bestFps = fps;
          capFps = fps;
          return move(preFlat, 'no gain');
        }
      } else { flat = 0; preFlat = level; }
    }
    const gpuBusy = load != null && load > 0.95;
    if (fps < downAt || gpuBusy) {
      highRun = 0;
      lowRun++;
      const bad = fps < downAt * 0.6 || (load != null && load > 1.6);   // very slow: act on one window and skip a rung
      if ((lowRun >= 2 || bad) && level > floor) {
        if (clock - lastUp < 12000) {
          // the rung we just climbed to could not hold: bar it, longer each time, for good after two
          fails[level]++;
          barredUntil[level] = clock + 60000 * 4 ** (fails[level] - 1);
          if (fails[level] >= 2) ceiling = Math.min(ceiling, level - 1);
        }
        before = fps; beforeGpu = gpu ?? 0; stepFrom = level; judgeAfter = true;
        if (flat === 0) preFlat = level;
        return move(Math.max(floor, level - (bad ? 2 : 1)), 'slow');
      }
    } else if (fps >= upAt) {
      lowRun = 0;
      highRun++;
      const next = level + 1;
      // room on the card for the next rung: this rung's time grown by what the step cost last time
      // (or by 1.4 when that is not known yet) must stay under 90% of the frame time
      const cardRoom = load == null || next >= levels || gpu * (ratio[next] || 1.4) < budget * 0.9;
      // the first minute (a fresh start, or AUTO picked again) climbs after 4 s with room, later after 8 s
      if (highRun >= (clock < 60000 ? 2 : 4) && next <= ceiling && clock >= barredUntil[next] && cardRoom) { flat = 0; return move(next, 'room'); }
    } else { lowRun = 0; highRun = 0; }
    return null;
  }

  return {
    get level() { return level; }, get fps() { return fps; }, get ceiling() { return ceiling; }, get floor() { return floor; },
    // the frame rate something outside the game holds it at (a browser's or phone's battery saver gives
    // 30), found when three steps down in detail did not speed it up; 0 when there is no such cap
    get capped() { return capFps; },
    // what holds the frame rate may have changed (the charger went in or out): forget the cap and judge afresh
    recheck() { if (!capFps) return; capFps = 0; floor = 0; bestFps = 60; flat = 0; lowRun = highRun = 0; },
    hold(s) { holdMs = Math.max(holdMs, s * 1000); buf = []; sum = 0; gbuf = []; },
    // ms: the frame's length; gpuMs: the graphics card's time for it if known.
    // Returns { from, to, why } when the level changes.
    feed(ms, gpuMs = null) {
      clock += ms;
      if (!(ms > 0)) return null;
      if (holdMs > 0) { holdMs -= ms; return null; }
      if (ms > 1000) { buf = []; sum = 0; return null; }   // a stall (tab, debugger): not a frame rate
      buf.push(ms); sum += ms;
      if (gpuMs > 0 && gpuMs < 1000) gbuf.push(gpuMs);
      if (sum < WINDOW) return null;
      const s = buf.slice().sort((a, b) => a - b);
      const median = s[s.length >> 1];
      const spread = s[Math.floor(s.length * 0.9)] - s[Math.floor(s.length * 0.1)];
      let gpu = null;
      if (gbuf.length >= buf.length / 4) { gbuf.sort((a, b) => a - b); gpu = gbuf[gbuf.length >> 1]; }
      buf = []; sum = 0; gbuf = [];
      return verdict(median, spread, gpu);
    },
  };
}

// What the browser's WebGL really runs on. A browser drawing without the graphics card (hardware
// acceleration off, or the GPU on a blocklist) answers no to failIfMajorPerformanceCaveat; that is
// not a fingerprinting signal, so it holds in Brave too, where the renderer name is a generic string.
export function probeGpu() {
  const out = { software: false, renderer: '', brave: !!navigator.brave, webgl: true };
  const lose = (gl) => { try { gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch {} };
  try {
    const fast = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    const any = fast || document.createElement('canvas').getContext('webgl2');
    if (!any) { out.webgl = false; return out; }
    out.software = !fast;
    const info = any.getExtension('WEBGL_debug_renderer_info');
    out.renderer = String(any.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : any.RENDERER) || '');
    if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(out.renderer)) out.software = true;
    lose(fast); if (any !== fast) lose(any);
  } catch {}
  return out;
}

// Why this desktop should start with the phones' lighter setup (small pictures, a still picture behind
// the opening menu, fewer and simpler parked cars), or '' for a computer that can take the full game.
// Only what the browser tells before anything is drawn: no graphics card in use, little memory
// (deviceMemory: Chrome and Edge only, in steps up to 8 GB), or one or two processor cores.
export function weakDesktop(gpu, nav = navigator) {
  if (gpu.software) return 'graphics card not in use';
  if (nav.deviceMemory > 0 && nav.deviceMemory <= 4) return `${nav.deviceMemory} GB of memory`;
  if (nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 2) return `${nav.hardwareConcurrency} processor cores`;
  return '';
}

// How long the graphics card takes to draw a frame, where the browser allows measuring it
// (EXT_disjoint_timer_query_webgl2: desktop Chrome and Edge; Safari and Firefox usually hide it).
// begin() / end() around renderer.render; ms is a running average, or null when not measurable.
export function createGpuTimer(gl) {
  const ext = gl && gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const out = { ms: null, available: !!ext, begin() {}, end() {} };
  if (!ext) return out;
  const free = [], pending = [];
  let open = null;
  out.begin = () => {
    if (open || pending.length > 4) return;          // results come a few frames late; don't pile up
    open = free.pop() || gl.createQuery();
    gl.beginQuery(ext.TIME_ELAPSED_EXT, open);
  };
  out.end = () => {
    if (open) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(open); open = null; }
    while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = pending.shift();
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
      free.push(q);
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) continue;   // the clock jumped: result is junk
      const ms = ns / 1e6;
      out.ms = out.ms == null ? ms : out.ms + (ms - out.ms) * 0.1;
    }
  };
  return out;
}

// (gfxAuto3, gfxCap2, alive2: level numbers count from the extra low rung added 21 Nov 2026; what the keys
// before it hold is read once, one level up)
// How far the picture is behind the game. The browser hands the drawing calls of a frame to the graphics
// card and goes on; a card (or a processor feeding it) that cannot keep up works through a growing queue,
// and what is on the screen is then older than what the game is doing: at the worst, after DRIVE on an old
// computer, an empty picture for many seconds while the game already drives (Martin's 2019 MacBook Air,
// 21 Nov 2026). A marker goes in after each frame's calls; `behind` is how long the oldest marker the card
// has not reached yet has been waiting (0 when it keeps up), `ms` how long the last one took.
export function createLag(gl) {
  // steps: how many pictures took at least `by` ms longer to be finished than the one before (poll(by): asked
  // every screen refresh with 0.6 of a refresh). A picture that is finished a refresh later than the last one
  // is shown a refresh later: an uneven step, though the game's own frames were on time (src/hitches.js).
  const out = { ms: 0, behind: 0, steps: 0, available: !!(gl && gl.fenceSync), mark() {}, poll() {} };
  if (!out.available) return out;
  const open = [];
  out.mark = () => {
    if (open.length >= 12) return;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) return;
    open.push({ sync, t: performance.now() });
    gl.flush();
  };
  // (a marker's state only changes between frames, so this is asked once a frame)
  out.poll = (by = 0) => {
    const t = performance.now();
    while (open.length && gl.getSyncParameter(open[0].sync, gl.SYNC_STATUS) === gl.SIGNALED) {
      const o = open.shift();
      gl.deleteSync(o.sync);
      if (by > 0 && out.ms > 0 && t - o.t - out.ms > by) out.steps++;
      out.ms = t - o.t;
    }
    out.behind = open.length ? t - open[0].t : 0;
  };
  return out;
}

const KEY = 'kvissuroam.gfx', AUTOKEY = 'kvissuroam.gfxAuto3', OLD = { 'kvissuroam.gfxAuto3': 'kvissuroam.gfxAuto2', 'kvissuroam.gfxCap2': 'kvissuroam.gfxCap', 'kvissuroam.alive2': 'kvissuroam.alive' };
export const MODES = ['auto', 'high', 'medium', 'low'];

// Applies levels to the running game. hooks: { renderer, sun, scene, camera, quality, setTrees(m) }.
// caps: the device's top settings. opts: { software, locked (fixed by ?q=low), headless (no auto) }.
export function createQuality(hooks, caps, opts = {}) {
  const levels = deviceLadder(caps);
  const top = levels.length - 1;
  const fixed = { high: top, medium: Math.min(top, Math.max(0, levels.findIndex((l) => l.shadow > 0 && l.shadow < 2048))) , low: 0 };
  if (fixed.medium <= 0) fixed.medium = Math.round(top / 2);
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  // a saved { ladder, level }: from its key, or once from the key of before the extra low rung (one level up).
  // `keep`: what came from the old key is written under the new one there and then. Without that the old
  // one was taken away and nothing put in its place, so the second visit after the extra low rung arrived
  // (21 Nov 2026) had forgotten both the level a device runs well at and the level a phone must stay under
  // after running out of memory: an iPhone 13 went back to the top level and reloaded itself drive after
  // drive, one level lower each time.
  const readLevel = (k, keep = false) => {
    try {
      const now = JSON.parse(read(k) || 'null');
      if (now) return now;
      const old = JSON.parse(read(OLD[k]) || 'null');
      if (!old) return null;
      localStorage.removeItem(OLD[k]);
      if (!(old.level >= 0)) return null;
      const moved = { ...old, level: old.level + 1 };
      if (keep) store(k, JSON.stringify(moved));
      return moved;
    } catch { return null; }
  };
  const ladderId = `${caps.dpr}/${caps.shadow}/${caps.trees}/${caps.load}`;

  let mode = MODES.includes(read(KEY)) ? read(KEY) : 'auto';
  if (opts.locked) mode = 'locked';
  // Start where this browser held steady last time, so a slow machine is not slow again for the first
  // minute. What is saved is the highest level that held 30 s without stepping down, not the last
  // one: a slow spell (a tab or app switch, a heavy corner) must not make the next visit start low.
  // Only a level kept lower for two minutes running replaces it.
  let start = top;
  try {
    const saved = readLevel(AUTOKEY, true);
    if (saved && saved.ladder === ladderId && saved.level >= 0) start = Math.min(top, saved.level);
  } catch {}
  if (opts.software) start = Math.min(start, 2);
  const auto = !opts.headless;

  // Crash guard. A phone that runs out of memory kills the page and reloads it, with no warning the
  // page can catch. So while the game is on screen it keeps a mark saying so (with its level), and
  // takes it away when it is hidden or closed. A mark still there at the next start means the page
  // died on screen: auto then keeps at least one level below that one (fewer streamed streets, smaller
  // shadow map), lower again after another crash. After 10 minutes on screen at that cap without a
  // crash, the next visit may go one level higher again.
  const ALIVE = 'kvissuroam.alive2', CAPKEY = 'kvissuroam.gfxCap2';
  let cap = top, crashed = false, death = null;
  try {
    const c = readLevel(CAPKEY, true);
    if (c && c.ladder === ladderId && c.level >= 0) cap = Math.min(top, c.level);
    const alive = readLevel(ALIVE);
    if (alive && alive.ladder === ladderId && alive.level >= 0 && !opts.headless) {
      crashed = true;
      // (two levels down when the last one was under half an hour ago: a phone far above what its memory
      // holds otherwise needs a crash for every level on the way down)
      const again = c && Date.now() - (c.t || 0) < 30 * 60e3;
      cap = Math.max(0, Math.min(cap, alive.level - (again ? 2 : 1)));
      // what the mark said about the moment it was last written, for the stats (Martin 2026-11-24: does a
      // strong phone that lands at the bottom really run out of memory, or is the page killed for
      // something else? Only logged for now; the cap above is the same either way.)
      death = { level: alive.level, cap, s: alive.s ?? null, heap: alive.heap ?? null, tex: alive.tex ?? null };
      store(CAPKEY, JSON.stringify({ ladder: ladderId, level: cap, t: Date.now() }));
      console.warn(`The last visit ended on screen at level ${alive.level + 1} (out of memory?): auto graphics stay at ${cap + 1} or lower`);
    }
  } catch {}
  start = Math.min(start, cap);
  // The mark also carries clues to why a page might die on screen, written again every 10 s on screen:
  // seconds on screen this visit, the script memory in MB (Chrome only, and rough: Chrome rounds it and
  // renews it only now and then) and how many pictures the game holds on the graphics card.
  let onScreenMs = 0, clueMs = 0;
  const clue = () => {
    const m = typeof performance !== 'undefined' && performance.memory;
    const heap = m && m.usedJSHeapSize > 0 ? Math.round(m.usedJSHeapSize / 1e6) : null;
    const tex = hooks.renderer?.info?.memory?.textures ?? null;
    return { s: Math.round(onScreenMs / 1000), heap, tex };
  };
  const markAlive = () => { if (!opts.headless && current >= 0) store(ALIVE, JSON.stringify({ ladder: ladderId, level: current, ...clue() })); };
  const markGone = () => { try { localStorage.removeItem(ALIVE); } catch {} };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => (document.hidden ? markGone() : markAlive()));
    addEventListener('pagehide', markGone);
    addEventListener('pageshow', markAlive);
  }
  let capMs = 0;                   // time on screen at the cap this visit (lifts it by one for the next)

  let gov = createGovernor({ levels: levels.length, start, top: cap });
  // the readout: averages, plus the frames that came more than half again later than the screen's
  // rate in the last two seconds (stutter the average hides) and the longest of them
  const meter = { frame: 16.7, js: 0, late: 0, worst: 0 };
  let win = [], winMs = 0;
  let current = -1, stableMs = 0, savedLevel = start, heldBest = -1, listeners = [];
  let warmFor = null, booted = false;              // the shadow setting being prepared in the background, if any

  // Turning the sun's shadow on or off changes the shader of nearly every material, and building them
  // all at once stalls the game for a moment (half a second on a phone). So the shaders for the new
  // setting are compiled first, in the background where the browser can (KHR_parallel_shader_compile),
  // and the switch is made once they are ready.
  const flip = (want) => { const { renderer, sun } = hooks; renderer.shadowMap.enabled = want; sun.castShadow = want; renderer.shadowMap.needsUpdate = true; };
  function setShadows(want) {
    const { renderer, sun, scene, camera } = hooks;
    if (!scene || !camera || !booted || !renderer.compileAsync) { flip(want); return; }
    if (warmFor === want) return;
    warmFor = want;
    const was = renderer.shadowMap.enabled;
    let ready;
    try { renderer.shadowMap.enabled = want; sun.castShadow = want; ready = renderer.compileAsync(scene, camera); }
    catch { ready = Promise.resolve(); }
    finally { renderer.shadowMap.enabled = was; sun.castShadow = was; }
    // (then the new programs' first use, a program a frame, before the switch: on an iPhone compiling only
    // asks for them, and the wait for all of them came in the first frame with the new setting; see firstUse
    // in src/warm.js)
    ready.catch(() => {}).then(() => (warmFor === want && hooks.firstUse ? hooks.firstUse(scene) : null)).catch(() => {}).then(() => {
      if (warmFor !== want) return;
      warmFor = null;
      if ((levels[current].shadow > 0) === want && renderer.shadowMap.enabled !== want) flip(want);
    });
  }

  function apply(i) {
    const l = levels[i], { renderer, sun, quality } = hooks;
    if (i === current) return;
    current = i;
    if (typeof document === 'undefined' || !document.hidden) markAlive();
    if (renderer.getPixelRatio() !== l.dpr) renderer.setPixelRatio(l.dpr);
    const want = l.shadow > 0;
    if (want && sun.shadow.mapSize.x !== l.shadow) {
      sun.shadow.mapSize.set(l.shadow, l.shadow);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    if (renderer.shadowMap.enabled !== want) setShadows(want);
    hooks.setTrees(l.trees);
    hooks.setFar?.(l.far);
    quality.loadRadius = l.load;
    for (const f of listeners) f();
  }

  const levelFor = (m) => (m === 'auto' ? gov.level : m === 'locked' ? -1 : fixed[m]);
  if (mode !== 'locked') apply(mode === 'auto' && auto ? gov.level : mode === 'auto' ? top : fixed[mode]);
  booted = true;

  return {
    levels, get level() { return current; }, get mode() { return mode; }, get fps() { return gov.fps; }, meter,
    get auto() { return mode === 'auto' && auto; }, get cap() { return cap < top ? cap : null; }, crashed, death,
    get capped() { return mode === 'auto' && auto ? gov.capped : 0; },
    onChange(f) { listeners.push(f); },
    // pause judging for s seconds (coming back to the tab, a jump across the map)
    hold(s) { gov.hold(s); },
    recheck() { gov.recheck(); },
    // ms: the frame's length; jsMs: how much of it the game's own code took (the rest is the
    // browser and the graphics card), kept as a running average for the readout
    frame(ms, jsMs = 0, gpuMs = null) {
      if (ms > 0 && ms < 1000) {
        meter.frame += (ms - meter.frame) * 0.05; meter.js += (jsMs - meter.js) * 0.05;
        onScreenMs += ms;
        if ((clueMs += ms) >= 10000 && (typeof document === 'undefined' || !document.hidden)) { clueMs = 0; markAlive(); }
        win.push(ms); winMs += ms;
        if (winMs >= 2000) {
          const s = win.slice().sort((a, b) => a - b), base = s[s.length >> 2];
          meter.late = win.filter((x) => x > base * 1.5).length;
          meter.worst = s[s.length - 1];
          win = []; winMs = 0;
        }
      }
      if (mode !== 'auto' || !auto) { if (mode !== 'locked') gov.feed(ms, gpuMs); return null; }   // (still measures, for the readout)
      const ch = gov.feed(ms, gpuMs);
      if (ch) { apply(ch.to); stableMs = 0; return ch; }
      stableMs += ms;
      if (cap < top && current === cap && ms < 1000 && (capMs += ms) > 600000) {
        capMs = -Infinity;           // once per visit
        store(CAPKEY, JSON.stringify({ ladder: ladderId, level: cap + 1 }));
      }
      if (stableMs > 30000 && current > heldBest) heldBest = current;
      const keep = stableMs > 120000 && current < savedLevel ? current : heldBest > savedLevel ? heldBest : -1;
      if (keep >= 0 && keep !== savedLevel) { savedLevel = keep; store(AUTOKEY, JSON.stringify({ ladder: ladderId, level: keep })); }
      return null;
    },
    setMode(m) {
      if (!MODES.includes(m) || mode === 'locked') return;
      mode = m;
      store(KEY, m);
      if (m === 'auto') gov = createGovernor({ levels: levels.length, start: Math.max(heldBest, savedLevel), top: cap });
      apply(m === 'auto' ? (auto ? gov.level : top) : levelFor(m));
    },
  };
}
