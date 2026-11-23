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
// The same list is read by tools/race/build-raadi.py, which routes the stage over these paths.
import PATHS from './raadipaths.json';
import { surfaceStrip, SURFACE } from './data.js';

for (const r of PATHS.add) surfaceStrip(r.pts, r.w / 2, SURFACE.GRAVEL);
for (const g of PATHS.gravel) surfaceStrip(g.line, g.w / 2, SURFACE.GRAVEL);
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
