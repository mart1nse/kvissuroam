// A record's drive against where the server saw the car while the lap was driven (26 Nov 2026).
//
// The lap's start and finish are the page's own word (the marks, worker/index.js lapMark), and the server times the
// lap between them. A changed page could still drive a lap in slow motion and send its start mark late, so that
// the server's clock agreed with the lap time. But the car's places come in all along (a page on a lap sends them
// whether anyone else is online or not, and by a request every few seconds when it has no connection), and the
// lobby keeps one every LIVE_MS from the start mark on. A record's drive must pass each of those places at about
// the lap time the server's clock shows for it: a lap driven slower than it is told, or started earlier than its
// mark, is somewhere else on the road.
//
// "About": the lap's own clock may be behind the server's by the 2 s it may lose to slow frames (SLOW_FREE in
// src/race/race.js) and by the marks' and places' way here, and ahead by that way alone: the same leeways as the
// lap clock's (CLOCK_OVER and CLOCK_UNDER in worker/index.js). A few places may miss (LIVE_FREE, LIVE_MISS): this
// is to catch a lap that was not driven when it says, not to refuse one over a moment's doubt.
export const LIVE_MS = 2000;                     // a place of a car on a lap is kept this often
export const LIVE_BACK = 3.5, LIVE_FWD = 1.5;    // s: the drive may be at a seen place this much later / earlier than seen
export const LIVE_R = 30;                        // m from the drive that a seen place may be
export const LIVE_MIN = 3;                       // seen places a lap needs to be judged by them
export const LIVE_FREE = 2, LIVE_MISS = 0.15;    // places that may miss: this many, or this share of them
export const LIVE_MAX = 1800;                    // places kept of one lap (an hour)

// pts: [ds, x, z, ...] the places seen (ds: tenths of a second after the start mark, m), took: ms between the marks;
// xs, zs: the drive's places, `step` s apart from the lap's start. { n: places judged, miss: of them not on the drive }
export function liveCheck(pts, xs, zs, took = Infinity, step = 0.1) {
  let n = 0, miss = 0;
  const last = xs.length - 1;
  for (let i = 0; i + 2 < pts.length; i += 3) {
    const t = pts[i] / 10, x = pts[i + 1], z = pts[i + 2];
    if (!(t >= 0) || t * 1000 > took) continue;
    n++;
    const j0 = Math.max(0, Math.floor((t - LIVE_BACK) / step)), j1 = Math.min(last, Math.ceil((t + LIVE_FWD) / step));
    let ok = false;
    for (let j = j0; j <= j1 && !ok; j++) ok = Math.hypot(xs[j] - x, zs[j] - z) <= LIVE_R;
    if (!ok) miss++;
  }
  return { n, miss };
}
// may so many of them miss?
export const liveOk = ({ n, miss }) => miss <= Math.max(LIVE_FREE, LIVE_MISS * n);
