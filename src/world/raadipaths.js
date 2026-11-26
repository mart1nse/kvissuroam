// Raadi manor park, where the map differs from the place (Martin, 23 Nov 2026; the Land Board's air photo and
// his Street View shots):
//  - the gravel path that cuts across between the road east of the pond and the stem of the east loop is
//    missing from the map (the rally stage takes it);
//  - the lane up from the south to the park road's mouth by Narva mnt (the stage's first straight) is a narrow
//    strip of old patched tarmac with gravel and sand either side, not a street inside Narva mnt's paving: the
//    ground under it becomes gravel, and the tarmac is laid on it in two bands of unlike greys, the paler one
//    broken, with a couple of patches. No zebra, lamp or tree stands on it;
//  - the park road from that corner along the manor wall is gravel from a few metres in (the map has it as
//    gravel too, but inside the same paving, which hid it: it showed as asphalt with a dashed centre line).
//  - the gravel is wider than a path of one width where paths meet, round the outside of some bends and along
//    the park road (`aprons`: 39 outlines, the photo's pale gravel that lies outside the drawn paths within 14 m
//    of the rally stage, tools/race/raadi-gravel.py). Painted at the value a gravel path has at its edge, so no
//    wheel track is laid on them.
//  - the second corner's inside is rounded on the ground as well (Martin 23 Nov 20:15, a blue curve on the air
//    photo: "the second corner is actually more round on the gravel parts as well"): `fillets`, by hand, the 4 m
//    arc the stage's glow takes there (ROUND in src/race/raadi.js).
//  - the track from the stage's last corner past the finish is the same gravel road as the one into that corner
//    (Martin 26 Nov 10:07: "the road from the last corner ... cuts to regular road form the middle of the last
//    corner"): the map has it as a bare earth track 3.6 m wide, which the ground draws darker and narrower. The
//    third entry of `gravel`: 4.6 m of gravel to its far end, 65 m past the stage's last point.
//  - six more insides of bends are round (Martin 26 Nov 10:07, pink lines drawn on six overhead screenshots: "a
//    few squared corner apexes stand out ... will draw the extension of the gravel road to make the parts more
//    smooth"): stage points 126 and 127 (the junction), 228 to 239, 318, 429, 834 to 842 and the last corner's
//    inside, 850 to 867. Each is one more outline in `fillets`, the gravel out to his line (the line put on the
//    ground from the drone camera of the shot), and the seven `aprons` that stood squared beyond a line are cut
//    back to it. Only the ground: the stage's edge and its penalties stay where they were.
// The same list is read by tools/race/build-raadi.py, which routes the stage over these paths.
import PATHS from './raadipaths.json';
import { surfaceStrip, surfaceArea, SURFACE } from './data.js';

for (const r of PATHS.add) surfaceStrip(r.pts, r.w / 2, SURFACE.GRAVEL);
for (const g of PATHS.gravel) surfaceStrip(g.line, g.w / 2, SURFACE.GRAVEL);
// And wider on the pond side of the stretch between the middle pond and the boulder field (Martin 24 Nov 12:06, a
// blue line about 2 m out from the edge: "add width to the road to the blue line. extend it with gravel so if you
// drive over it the current edge it helps a bit to catch you"): stage points 321 to 346, 2.2 m more on the left.
// Only the ground: the stage's edge and its penalties stay where they were.
const WIDEN = [2761.9, 380.6, 2761.6, 383.2, 2760.5, 385.0, 2759.6, 386.4, 2759.0, 387.8, 2758.5, 389.3, 2758.2, 391.2, 2758.0, 393.3, 2757.9, 395.3, 2758.1, 397.2, 2758.4, 399.1, 2758.7, 401.0, 2759.1, 402.9, 2759.6, 404.8, 2760.1, 406.7, 2760.6, 408.6, 2761.1, 410.6, 2761.6, 412.6, 2762.1, 414.5, 2762.7, 416.5, 2763.2, 418.4, 2763.7, 420.4, 2764.2, 422.4, 2764.6, 424.3, 2765.0, 426.2, 2765.2, 428.0, 2765.3, 429.9, 2765.4, 432.0, 2765.8, 432.0, 2765.7, 429.9, 2766.2, 427.9, 2766.7, 426.0, 2767.1, 423.8, 2766.6, 421.8, 2766.1, 419.8, 2765.6, 417.8, 2765.1, 415.8, 2764.6, 413.9, 2764.0, 411.9, 2763.5, 410.0, 2763.0, 408.0, 2762.5, 406.1, 2762.0, 404.2, 2761.6, 402.3, 2761.2, 400.5, 2760.8, 398.6, 2760.6, 396.9, 2760.4, 395.3, 2760.5, 393.5, 2760.6, 391.5, 2760.9, 389.9, 2761.3, 388.6, 2761.8, 387.6, 2761.7, 385.7, 2761.9, 383.3, 2762.3, 380.6];
const APRONS = [...PATHS.aprons, ...(PATHS.fillets || []), WIDEN].map((a) => { const q = []; for (let i = 0; i < a.length; i += 2) q.push([a[i], a[i + 1]]); return q; });
for (const q of APRONS) surfaceArea(q, SURFACE.GRAVEL);
for (const p of PATHS.paved) surfaceStrip(p.pts, p.hw, SURFACE.PAVED);

// the outline of a band w wide along a line
function band(pts, w) {
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / l * w / 2, nz = (b[0] - a[0]) / l * w / 2;
    L.push([pts[i][0] + nx, pts[i][1] + nz]); R.push([pts[i][0] - nx, pts[i][1] - nz]);
  }
  return [...L, ...R.reverse()];
}
function distTo(pts, x, z) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1];
    const k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    d = Math.min(d, Math.hypot(x - a[0] - dx * k, z - a[1] - dz * k));
  }
  return d;
}

const LAST_CORNER = [[[2732.5, 645.1], [2725.7, 632.8], [2723.4, 631.3], [2715.2, 631.1], [2712.6, 631.0]], [[2715.1, 628.6], [2715.2, 631.1], [2717.2, 658.2]]];
export function raadiRoads(vectors) {
  const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.5;
  const over = [], tone = [];
  for (const g of PATHS.gravel) {
    const [a, b] = g.pts;
    const r = vectors.roads.find((q) => q.pts.length === g.n && ((near(q.pts[0], a) && near(q.pts.at(-1), b)) || (near(q.pts[0], b) && near(q.pts.at(-1), a))));
    if (r) { r.s = 2; r.w = g.w; r.type = 'Muu tee'; delete r.c; }
    over.push({ cover: '#00f', outer: band(g.line, g.w) });
  }
  for (const p of PATHS.paint) {
    const outer = band(p.pts, p.w), [cr, cg, cb] = p.c;
    over.push({ cover: '#f00', outer });
    tone.push({ outer, tone: `rgb(${Math.round((cr + cg + cb) / 3)},${128 + cr - cb},0)` });
  }
  for (const outer of APRONS) over.push({ cover: 'rgb(0,0,138)', outer });
  // (the earth path that comes down to the last corner from the north is toned as bare earth for 3 m either side
  // of itself, squarely to its end, which lay across the stage's gravel there as a dark block: the usual tone again)
  for (const pts of LAST_CORNER) tone.push({ outer: band(pts, 5.6), tone: 'rgb(183,136,0)' });
  vectors.overPaint = [...(vectors.overPaint || []), ...over];
  vectors.toneOver = [...(vectors.toneOver || []), ...tone];
  for (const r of PATHS.add) vectors.roads.push({ ...r });
}

// street furniture and zebras the map put on the lane, and the trees on it and at the corner
const LANE = PATHS.gravel[0].line;
export function raadiClear(data) {
  const out = [];
  for (const [key, a] of Object.entries(data.sectors)) {
    for (let k = 0; k < a.length; k += data.stride) {
      const x = a[k + 1], z = a[k + 2];
      if (x > 2350 && x < 2440 && z > 430 && z < 530 && distTo(LANE, x, z) < 3.6) out.push(`${key}:${k / data.stride}`);
    }
  }
  return out;
}
export function raadiClearing(world) {
  world.addClearing({ test: (x, z) => x > 2350 && x < 2450 && z > 430 && z < 530 && distTo(LANE, x, z) < 5.5 });
}
