// Corner cuts on the Pirita-Kose lap that cost time, shared by the page (race.js) and the server (worker/index.js).
//
// Raiduri (Martin, 28 Nov 2026, a yellow line on the air photo of the left bend on Kloostrimetsa tee before the
// Raiduri tee crossing: "there is some room for outside going wide ... 5 sec cutting penalty for the yellow line
// crossing"). The outside of that bend's way out is a grass strip, a pavement and the mouth of the clinic's drive;
// a car whose middle goes beyond the yellow line there (2.5 m past the kerb along the strip, then slanting up to the
// far corner of the drive's mouth) has CUT_PEN seconds on its lap, once a lap. The seconds go the way a hard crash's
// do (race.js st.pen, the lap's `pen`), and the server counts the cut again from the replay.
export const CUT_PEN = 5;

// Kloostrimetsa tee's north kerb there on the air photo (z at x)
export const raiduriEdge = (x) => -623.3 - 0.1267 * (x + 334);
// the yellow line, west to east: the penalty is north of it (smaller z), up to DEEP metres
export const RAIDURI_LINE = [[-346, raiduriEdge(-346) - 2.5], [-316, raiduriEdge(-316) - 2.5], [-300.5, -632.8]];
const DEEP = 14;
const LINES = [RAIDURI_LINE];

// which cut the point (x, z) is in (0, 1, ...), or -1; margin: metres past the line before it counts
export function cutAt(x, z, margin = 0) {
  for (let k = 0; k < LINES.length; k++) {
    const l = LINES[k];
    if (x < l[0][0] || x > l[l.length - 1][0]) continue;
    for (let j = 0; j + 1 < l.length; j++) {
      const a = l[j], b = l[j + 1];
      if (x < a[0] || x > b[0]) continue;
      const d = a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]) - z;
      if (d > margin && d < DEEP) return k;
    }
  }
  return -1;
}

// how many cuts a drive has (its places xs, zs): each corner's once
export function cutsIn(xs, zs, margin = 0) {
  let seen = 0, n = 0;
  for (let i = 0; i < xs.length; i++) {
    const k = cutAt(xs[i], zs[i], margin);
    if (k >= 0 && !(seen & (1 << k))) { seen |= 1 << k; n++; }
  }
  return n;
}
