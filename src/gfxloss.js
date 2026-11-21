// The graphics taken away while the game was in the background, and the game brought back whole.
//
// An Android phone that switches to another app and back can throw away everything the browser held on
// the graphics card: the WebGL context (every texture, model and the car paint's reflections) and the
// pictures of painted canvases (Chrome clears a 2D canvas whose context it lost). three.js sends textures
// and models again by itself, but the painted house fronts, ground and car pictures are gone at their
// source: on phones the game lets the big canvases go once the card has them (world/phonetex.js), and
// Chrome blanks the rest. What came back was a city with black houses, ground and cars (Martin's Android,
// 21 Nov 2026, after the lap times screen and another app).
//
// Painting all of that again would mean every hand-built place keeping its painting recipe, and keeping
// the pictures somewhere safe would cost memory or time on every phone every drive. So nothing is done
// while the game runs: when the graphics are lost the page is loaded again once it is back on screen,
// with the car where it was (the menu says BACK WHERE YOU WERE and DRIVE goes on from there). Nothing is
// added to a frame; one listener per canvas, set when its 2D context is first asked for.
//
// This module is imported first in main.js, so it sees every canvas the game paints.
// ?glreload=0 turns the reload off (the old black picture, for comparison).
const RESUME = 'kvissuroam.resume';
const TRIES = 'kvissuroam.glReloads';
const off = new URLSearchParams(location.search).get('glreload') === '0';

let lost = null;                 // what was lost first: 'webgl' | '2d'
let onLost = () => {};
let getState = () => null;
let reloading = false;

// every 2D canvas: tell us when Chrome throws its picture away (Chrome 99 and later; others never do)
const seen = new WeakSet();
const getContext = HTMLCanvasElement.prototype.getContext;
const lost2d = () => note('2d');
HTMLCanvasElement.prototype.getContext = function (type, opts) {
  const ctx = getContext.call(this, type, opts);
  if (ctx && type === '2d' && !seen.has(this)) { seen.add(this); this.addEventListener('contextlost', lost2d); }
  return ctx;
};

function note(kind) {
  if (lost) return;
  lost = kind;
  try { onLost(kind); } catch {}
  later();
}
// once the page is on screen again (now, if it is): give the browser a moment to say all it lost
function later() {
  if (off || reloading) return;
  if (document.visibilityState !== 'visible') return;      // (visibilitychange calls again)
  setTimeout(reload, 400);
}
document.addEventListener('visibilitychange', () => { if (lost) later(); });

function reload() {
  if (reloading || document.visibilityState !== 'visible') return;
  // never round and round: at most three times in three minutes
  let tries = [];
  try { tries = JSON.parse(sessionStorage.getItem(TRIES) || '[]').filter((t) => Date.now() - t < 180e3); } catch {}
  if (tries.length >= 3) { console.warn('Graphics lost again: not reloading a fourth time'); return; }
  reloading = true;
  try {
    tries.push(Date.now());
    sessionStorage.setItem(TRIES, JSON.stringify(tries));
    const st = getState();
    if (st) sessionStorage.setItem(RESUME, JSON.stringify({ ...st, t: Date.now(), why: lost }));
  } catch {}
  location.reload();
}

export const gfxLoss = {
  // canvas: the game's WebGL canvas; state(): what to come back to ({ pose, drive }), or null
  watch(canvas, { lost: cb, state } = {}) {
    if (cb) onLost = cb;
    if (state) getState = state;
    canvas.addEventListener('webglcontextlost', () => note('webgl'));
  },
  // where the last page left off when it was reloaded for lost graphics (read once; null if not)
  resume: (() => {
    try {
      const r = JSON.parse(sessionStorage.getItem(RESUME) || 'null');
      sessionStorage.removeItem(RESUME);
      return r && Date.now() - r.t < 10 * 60e3 ? r : null;
    } catch { return null; }
  })(),
  get lost() { return lost; },
};
