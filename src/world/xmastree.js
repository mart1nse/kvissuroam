// A town square's Christmas tree (Tartu's Raekoja plats, 27 Nov 2026; Tallinn's, 28 Nov): a spruce of open cones
// in tiers with warm bulbs over their lower halves, red baubles if asked, a gold star and a low white fence round the
// foot. Into two Parts: p (lit by the sun) and glow (bulbs and the star, drawn unlit). About 1.5k triangles, no pictures.
// Returns the fence's radius, for the solid the caller adds.
import * as THREE from 'three';

const BULB = new THREE.OctahedronGeometry(0.09, 0);
const BAUBLE = new THREE.IcosahedronGeometry(0.16, 0);

function rnd(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// opts: top (m to the tip), R0 (the lowest tier's reach), seed, baubles (a colour, or none), fence (colour)
export function xmasTree(p, glow, x, y, z, { top = 17.2, R0 = 4.3, seed = 27, baubles = null, fence = 0xfdfaf8, lamp = 0xfff0c4 } = {}) {
  p.add(new THREE.CylinderGeometry(0.28, 0.42, 3.0, 8), 0x6e5560, x, y + 1.5, z);              // trunk
  // seven tiers of drooping branches, each a wide open cone, narrowing up to the tip
  const TIERS = 7, base = 1.4;
  const r = rnd(seed);
  for (let k = 0; k < TIERS; k++) {
    const t = k / TIERS, y0 = base + (top - base) * t * 0.93, rr = R0 * (1 - t) ** 0.92 + 0.35, hh = (top - base) / TIERS * 1.75;
    p.add(new THREE.ConeGeometry(rr, hh, 14, 1, true), k % 2 ? 0x3f7d62 : 0x387259, x, y + y0 + hh / 2, z, k * 0.7);
    // warm bulbs over the tier's lower half, where its branches reach out
    const n = Math.round(rr * 7);
    for (let j = 0; j < n; j++) {
      const a = r() * Math.PI * 2, f = 0.05 + r() * 0.5, br = rr * (1 - f) + 0.08, by = y + y0 + hh * f;
      glow.add(BULB, r() < 0.18 ? 0xffd9a0 : lamp, x + Math.cos(a) * br, by, z + Math.sin(a) * br);
    }
    if (baubles !== null) {
      const m = Math.round(rr * 2.2);
      for (let j = 0; j < m; j++) {
        const a = r() * Math.PI * 2, f = 0.08 + r() * 0.4, br = rr * (1 - f) + 0.1;
        p.add(BAUBLE, baubles, x + Math.cos(a) * br, y + y0 + hh * f - 0.1, z + Math.sin(a) * br);
      }
    }
  }
  // a gold star on the tip, two crossed faces so it reads from every side
  const star = new THREE.Shape();
  for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? 0.38 : 0.9; k ? star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  const sg = new THREE.ShapeGeometry(star);
  for (const yaw of [0, Math.PI / 2]) glow.add(sg, 0xffe08a, x, y + top + 0.75, z, yaw);
  sg.dispose();
  // a low white fence round the foot, as far out as the lowest branches
  const R = 3.4 * (R0 / 4.3);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, a1 = ((k + 1) / 16) * Math.PI * 2;
    const mx = x + Math.cos((a + a1) / 2) * R, mz = z + Math.sin((a + a1) / 2) * R;
    p.box(2 * R * Math.sin(Math.PI / 16), 0.55, 0.08, fence, mx, y + 0.45, mz, -(a + a1) / 2 + Math.PI / 2);
    p.box(0.12, 0.8, 0.12, fence, x + Math.cos(a) * R, y + 0.4, z + Math.sin(a) * R);
  }
  return R;
}
