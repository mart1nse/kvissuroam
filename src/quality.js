// Graphics quality that follows the frame rate the player actually gets.
//
// The game measures every frame. When the typical frame (the median of a two second window) stays
// slow, the graphics step one rung down a ladder: sharpness (pixel ratio) first, then the leafy tree
// distance, the shadow map, how far the city streams in, and at the bottom a softer, lower
// resolution picture. When the frame rate has room to spare for a while, it tries one rung up, and if
// that rung drops it straight back down, the rung is barred for a growing time (twice: for the
// session), so it never flickers between two settings.
//
// The levels are plain numbers; createQuality() applies them to the renderer, the sun and the trees. The governor is
// pure logic so tools/quality-test.mjs can drive it with made-up frame times.

// Rungs from the bottom (0) to the top. Every rung is a whole setting; the device caps (phones, a
// 1x screen) are applied on top, and rungs that come out the same are merged.
export const LADDER = [
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
    };
    const p = out[out.length - 1];
    if (p && p.dpr === l.dpr && p.shadow === l.shadow && p.trees === l.trees && p.load === l.load) continue;
    out.push(l);
  }
  return out;
}

// The governor. feed(ms) once per drawn frame with that frame's length; it returns the new level
// index when it decides to move, else -1. hold(s) pauses judging (after a change, a tab switch).
export function createGovernor({ levels, start = levels - 1 }) {
  const WINDOW = 2000;              // ms of frames per verdict
  let level = Math.max(0, Math.min(levels - 1, start));
  let ceiling = levels - 1;        // highest rung allowed (lowered by rungs that failed)
  let floor = 0;                   // lowest rung allowed (raised when stepping down did not help)
  let buf = [], sum = 0;
  let holdMs = 4000;               // the first seconds compile shaders and stream the city: ignore
  let lowRun = 0, highRun = 0, flat = 0;
  let bestFps = 60;                // the screen's rate as far as we know: 60 Hz, or faster once seen, or the cap found below
  let lastUp = -1e9, clock = 0, before = 0, judgeAfter = false, preFlat = level;
  const fails = new Array(levels).fill(0), barredUntil = new Array(levels).fill(0);
  let fps = 0;

  function move(to, why) {
    const from = level;
    level = to;
    buf = []; sum = 0; lowRun = 0; highRun = 0;
    holdMs = 2500;                 // shader rebuilds and new shadow maps take a moment
    if (to > from) lastUp = clock;
    return { from, to, why };
  }

  function verdict(median, spread) {
    fps = 1000 / median;
    if (fps > bestFps) bestFps = Math.min(240, fps);
    const downAt = Math.min(42, bestFps * 0.72), upAt = Math.min(57, bestFps * 0.93);
    // was the last step down worth it? A 30 Hz cap or a busy CPU does not speed up with fewer pixels
    if (judgeAfter) {
      judgeAfter = false;
      if (fps < before * 1.08 && spread < 4) {
        if (++flat >= 3) {
          // three steps down bought nothing: the frame rate is capped elsewhere (a 30 Hz battery saver,
          // a busy CPU). Put them back, stop going down, and judge against this rate from now on.
          flat = 0;
          floor = preFlat;
          bestFps = fps;
          return move(preFlat, 'no gain');
        }
      } else { flat = 0; preFlat = level; }
    }
    if (fps < downAt) {
      highRun = 0;
      lowRun++;
      const bad = fps < downAt * 0.6;           // very slow: act on one window and skip a rung
      if ((lowRun >= 2 || bad) && level > floor) {
        if (clock - lastUp < 12000) {
          // the rung we just climbed to could not hold: bar it, longer each time, for good after two
          fails[level]++;
          barredUntil[level] = clock + 60000 * 4 ** (fails[level] - 1);
          if (fails[level] >= 2) ceiling = Math.min(ceiling, level - 1);
        }
        before = fps; judgeAfter = true;
        if (flat === 0) preFlat = level;
        return move(Math.max(floor, level - (bad ? 2 : 1)), 'slow');
      }
    } else if (fps >= upAt) {
      lowRun = 0;
      highRun++;
      const next = level + 1;
      if (highRun >= 5 && next <= ceiling && clock >= barredUntil[next]) { flat = 0; return move(next, 'room'); }
    } else { lowRun = 0; highRun = 0; }
    return null;
  }

  return {
    get level() { return level; }, get fps() { return fps; }, get ceiling() { return ceiling; }, get floor() { return floor; },
    hold(s) { holdMs = Math.max(holdMs, s * 1000); buf = []; sum = 0; },
    // ms: the frame's length; returns { from, to, why } when the level changes
    feed(ms) {
      clock += ms;
      if (!(ms > 0)) return null;
      if (holdMs > 0) { holdMs -= ms; return null; }
      if (ms > 1000) { buf = []; sum = 0; return null; }   // a stall (tab, debugger): not a frame rate
      buf.push(ms); sum += ms;
      if (sum < WINDOW) return null;
      const s = buf.slice().sort((a, b) => a - b);
      const median = s[s.length >> 1];
      const spread = s[Math.floor(s.length * 0.9)] - s[Math.floor(s.length * 0.1)];
      buf = []; sum = 0;
      return verdict(median, spread);
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

const KEY = 'kvissuroam.gfx', AUTOKEY = 'kvissuroam.gfxAuto';
export const MODES = ['auto', 'high', 'medium', 'low'];

// Applies levels to the running game. hooks: { renderer, sun, quality, setTrees(m) }.
// caps: the device's top settings. opts: { software, locked (fixed by ?q=low), headless (no auto) }.
export function createQuality(hooks, caps, opts = {}) {
  const levels = deviceLadder(caps);
  const top = levels.length - 1;
  const fixed = { high: top, medium: Math.min(top, Math.max(0, levels.findIndex((l) => l.shadow > 0 && l.shadow < 2048))) , low: 0 };
  if (fixed.medium <= 0) fixed.medium = Math.round(top / 2);
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const ladderId = `${caps.dpr}/${caps.shadow}/${caps.trees}/${caps.load}`;

  let mode = MODES.includes(read(KEY)) ? read(KEY) : 'auto';
  if (opts.locked) mode = 'locked';
  // start where this browser settled last time, so a slow machine is not slow again for the first minute
  let start = top;
  try {
    const saved = JSON.parse(read(AUTOKEY) || 'null');
    if (saved && saved.ladder === ladderId && saved.level >= 0) start = Math.min(top, saved.level);
  } catch {}
  if (opts.software) start = Math.min(start, 1);
  const auto = !opts.headless;
  let gov = createGovernor({ levels: levels.length, start });
  let current = -1, stableMs = 0, savedLevel = start, listeners = [];

  function apply(i) {
    const l = levels[i], { renderer, sun, quality } = hooks;
    if (i === current) return;
    current = i;
    if (renderer.getPixelRatio() !== l.dpr) renderer.setPixelRatio(l.dpr);
    const want = l.shadow > 0;
    if (want && sun.shadow.mapSize.x !== l.shadow) {
      sun.shadow.mapSize.set(l.shadow, l.shadow);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    if (renderer.shadowMap.enabled !== want) { renderer.shadowMap.enabled = want; sun.castShadow = want; renderer.shadowMap.needsUpdate = true; }
    hooks.setTrees(l.trees);
    quality.loadRadius = l.load;
    for (const f of listeners) f();
  }

  const levelFor = (m) => (m === 'auto' ? gov.level : m === 'locked' ? -1 : fixed[m]);
  if (mode !== 'locked') apply(mode === 'auto' && auto ? gov.level : mode === 'auto' ? top : fixed[mode]);

  return {
    levels, get level() { return current; }, get mode() { return mode; }, get fps() { return gov.fps; },
    get auto() { return mode === 'auto' && auto; },
    onChange(f) { listeners.push(f); },
    // pause judging for s seconds (coming back to the tab, a jump across the map)
    hold(s) { gov.hold(s); },
    frame(ms) {
      if (mode !== 'auto' || !auto) { if (mode !== 'locked') gov.feed(ms); return null; }   // (still measures, for the readout)
      const ch = gov.feed(ms);
      if (ch) { apply(ch.to); stableMs = 0; return ch; }
      stableMs += ms;
      if (stableMs > 20000 && savedLevel !== current) { savedLevel = current; store(AUTOKEY, JSON.stringify({ ladder: ladderId, level: current })); }
      return null;
    },
    setMode(m) {
      if (!MODES.includes(m) || mode === 'locked') return;
      mode = m;
      store(KEY, m);
      if (m === 'auto') { gov = createGovernor({ levels: levels.length, start: current }); }
      apply(m === 'auto' ? (auto ? gov.level : top) : levelFor(m));
    },
  };
}
