// Road markings on Turu tänav made to match Martin's Street View shots (Aug 2024, Jun/Jul 2023):
//  - from the Soola junction to the Sadama turn the middle of Turu is a hatched island (two solid lines with
//    slanting bars, tapering at both ends) instead of a plain solid centre line; the lane lines stay;
//  - no centre line on Sadama tänav, the lane between Turu 8 and AHHAA, the aisle through Zeppelin's car park,
//    and the access road to Turu 11-19: none of them has one.
// No street names are painted (the "Turu tn" on the road in Street View is Google's label).
import { TURU } from './turu.js';

const HATCH = [10, 100], HALF = 1.5, TAPER = 18;
// a point on each road that loses its centre line, and the road's width
const NO_LINE = [
  [2008, 3240, 7.6], [2062, 3188, 7.6], [2091, 3163, 7.6], [2147, 3106, 7.6],   // Sadama tänav
  [2116, 3242, 9.6], [2062, 3188, 9.6],          // between Turu 8 and AHHAA
  [2138, 3402, 9.6], [2223, 3370, 9.6],          // Zeppelin's car park aisle
];

function nearLine(pts, x, z, d) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
    if (Math.hypot(ax + dx * t - x, az + dz * t - z) < d) return true;
  }
  return false;
}

export function turuPaintVectors(vectors) {
  const near = vectors.roads.filter((r) => r.pts.length > 1 && r.pts.some(([x, z]) => x > 1880 && x < 2300 && z > 3080 && z < 3500));
  for (const r of near) {
    if (r.type !== 'Tänav') continue;
    if (/juurdepääsutee/.test(r.name) && /^Turu tänav/.test(r.name)) { r.nomark = true; continue; }
    if (NO_LINE.some(([x, z, w]) => Math.abs(r.w - w) < 0.05 && nearLine(r.pts, x, z, 1.0))) r.nomark = true;
    if (r.name === 'Turu tänav' && r.w >= 11.5) {
      r.noCentre = (x, z) => { const [s, v] = TURU.sv(x, z); return s > HATCH[0] && s < HATCH[1] && Math.abs(v) < 3; };
    }
  }
  // the hatched island: its two edges and slanting bars every 3 m
  const half = (s) => HALF * Math.max(0, Math.min(1, (s - HATCH[0]) / TAPER, (HATCH[1] - s) / TAPER));
  const L = (vectors.extraLines ||= []);
  const seg = (s0, v0, s1, v1) => { const a = TURU.at(s0, v0), b = TURU.at(s1, v1); L.push(a[0], a[1], b[0], b[1]); };
  for (let s = HATCH[0]; s < HATCH[1]; s += 2) { const t = Math.min(HATCH[1], s + 2); seg(s, half(s), t, half(t)); seg(s, -half(s), t, -half(t)); }
  for (let s = HATCH[0] + 3; s + 2 < HATCH[1]; s += 3) {
    const a = half(s), b = half(s + 2);
    if (Math.min(a, b) > 0.35) seg(s, -a, s + 2, b);
  }
}
