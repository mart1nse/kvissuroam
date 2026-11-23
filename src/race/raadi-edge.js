// The edge of the Raadi stage's gravel, for the physics (Martin 2026-11-23: "a very short soft transition for
// the stage part"). The map's 1 m surface grid makes the park paths a hard step from gravel to grass, and a
// metre narrower than they are drawn. Along the stage the grip follows the drawn path instead: gravel up to
// 0.4 m inside its edge, then over 0.8 m it eases into whatever is beside it (grass, mostly). Tarmac and water
// are left as they are (the start is on a tarmac lane).
import STAGE from './raadi.json';

const P = STAGE.pts, HW = STAGE.hw, N = P.length;
const SOFT = 0.4;                          // half the width of the soft edge, m
const CELL = 8;
const cells = new Map();
// every segment in each cell it can reach (the widest half-width plus the soft edge)
const reach = Math.max(...HW) + SOFT + 0.5;
for (let i = 0; i < N - 1; i++) {
  const [ax, az] = P[i], [bx, bz] = P[i + 1];
  const x0 = Math.floor((Math.min(ax, bx) - reach) / CELL), x1 = Math.floor((Math.max(ax, bx) + reach) / CELL);
  const z0 = Math.floor((Math.min(az, bz) - reach) / CELL), z1 = Math.floor((Math.max(az, bz) + reach) / CELL);
  for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
    const k = gx * 65536 + gz;
    let l = cells.get(k);
    if (!l) cells.set(k, (l = []));
    l.push(i);
  }
}

// how much of the stage's gravel is under (x, z): 1 on it, 0 off it, eased across the edge
export function stageGravel(x, z) {
  const l = cells.get(Math.floor(x / CELL) * 65536 + Math.floor(z / CELL));
  if (!l) return 0;
  let best = Infinity;
  for (const i of l) {
    const a = P[i], b = P[i + 1], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    // distance past the edge (negative inside), the half-width taken along the segment
    const d = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) - (HW[i] + (HW[i + 1] - HW[i]) * t);
    if (d < best) best = d;
  }
  if (best <= -SOFT) return 1;
  if (best >= SOFT) return 0;
  const u = (SOFT - best) / (2 * SOFT);
  return u * u * (3 - 2 * u);
}
