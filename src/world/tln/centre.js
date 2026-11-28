// Tallinn's centre (Martin 28 Nov 2026, the yellow area: the Old Town, Toompea, the port, Kesklinn to Liivalaia and
// Kadriorg). The map's own data there comes from the bake (tools/bake, CITY=tallinn), the street things from
// OpenStreetMap and Mapillary (tools/mapillary/features.py), the wall colours from Mapillary's photos
// (tools/realism/colours.py) and the shop signs from OpenStreetMap (tools/realism/signs.py).
//
// Here: the road paint. Streets of stone (the Old Town's setts and cobbles, the paved squares) carry no painted
// lines at all. The others carry the lines measured on the orthophoto (tools/tln/lines.py -> lines.json): where
// a street's photo was clear enough to read, its generated lines give way to the measured ones (or to none, when
// the street has none).
import { DATA } from '../../city.js';

// west of Kadriorg (the Pirita-Kose lap and its streets are dressed by src/world/tln/pirita.js)
const IN_CENTRE = (x) => x < -2600;
const CLEAR = 0.45;            // a street whose photo was at least this clear (not shadow nor trees) was read

// the Old Town and Toompea inside their walls, roughly (game x, z): src/world/scenery.js gives their houses the
// medieval town house look and their churches and towers limestone
const OLD = [[-6182, 2696], [-6014, 2415], [-5790, 2190], [-5564, 2110], [-5392, 2297], [-5302, 2686], [-5355, 3021],
  [-5495, 3212], [-5750, 3281], [-6005, 3251], [-6234, 3108], [-6293, 2920]];
export function inOldTown(x, z) {
  let inside = false;
  for (let i = 0, j = OLD.length - 1; i < OLD.length; j = i++) {
    const [xi, zi] = OLD[i], [xj, zj] = OLD[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// landmarks in their own colours (points inside each from OpenStreetMap's outlines; colours from photos of them):
// src/world/scenery.js setTownLooks. Style 3 plaster with windows, 3.4 limestone, 3.6 whitewashed stone.
export const LANDMARKS = [
  { x: -6041, z: 3112, style: 3, rgb: 0xd99a8c, roof: 0x26262b },        // Aleksander Nevski katedraal: pink, black domes
  { x: -6053, z: 2972, style: 3.6, rgb: 0xeae6dc, roof: 0x3a3c3f },      // Toomkirik: white, dark roof
  { x: -6114, z: 3141, style: 3, rgb: 0xe0a3a0, roof: 0x8a3e2c },        // Toompea loss: baroque pink
  { x: -3114, z: 2771, style: 3, rgb: 0xc4705e, roof: 0x9c4a36 },        // Kadrioru loss: red with white
  { x: -5415, z: 3245, style: 3, rgb: 0xe6dcc2, roof: 0x3c3e42 },        // Rahvusooper Estonia: cream
  { x: -5846, z: 3100, style: 3.4, roof: 0x3d4240 },                     // Niguliste kirik
  { x: -5562, z: 2488, style: 3.4, roof: 0x3a4440 },                     // Oleviste kirik
  { x: -5673, z: 2844, style: 3.6, rgb: 0xe8e4d8, roof: 0x3a3a3c },      // Pühavaimu kirik: whitewashed
  { x: -5707, z: 2980, style: 3.4, roof: 0x3a3a3a },                     // Tallinna raekoda
  { x: -5695, z: 3335, style: 3, rgb: 0xe2cf9a, roof: 0x3f4448 },        // Jaani kirik: pale yellow
  { x: -6048, z: 3532, style: 3.4, roof: 0x3d3f41 },                     // Kaarli kirik
  { x: -5871, z: 3194, style: 3.6, rgb: 0xece8de, roof: 0x9a4a32 },      // Rootsi-Mihkli kirik
];

const get = async (f) => { try { return await (await fetch(`${DATA}${f}`)).json(); } catch { return null; } };
// lines.json (tools/tln/lines.py) and marks.json (tools/tln/marks.py: arrows, manhole lids and drains, tram lines)
let marks = null;
export async function centreLines() {
  const [lines, m] = await Promise.all([get('lines.json'), get('marks.json')]);
  marks = m;
  return lines;
}
export const centreMarksData = () => marks;

// OpenStreetMap's hedges and shrubbery as bushes on the map's 0.5 m cells (world.addBushes, drawn with the map's own
// leafy lumps, src/world/scenery.js createLowObjects): a hedge every 0.7 m along its line at its height (1.3 m where
// not tagged), shrubbery a lump on about half the points of a 1.6 m grid, 1.2 to 2.8 m high. The same every visit.
export function centreBushes() {
  const out = [];
  let seed = 4711;
  const R = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  for (const [h, P] of marks?.hedges || []) {
    for (let i = 0; i + 1 < P.length; i++) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1], l = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(l / 0.7));
      for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n, h * (0.92 + R() * 0.16)]);
    }
  }
  for (const ring of marks?.shrubs || []) {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    for (let x = x0 + 0.8; x < x1; x += 1.6) {
      for (let z = z0 + 0.8; z < z1; z += 1.6) {
        const px = x + (R() - 0.5) * 1.2, pz = z + (R() - 0.5) * 1.2, keep = R() < 0.55, hh = 1.2 + R() * 1.6;
        if (!keep) continue;
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, zi] = ring[i], [xj, zj] = ring[j];
          if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
        }
        if (inside) out.push([px, pz, hh]);
      }
    }
  }
  return out;
}

export function centreVectors(vectors, lines = null) {
  const seen = lines?.seen || {};
  // streets OpenStreetMap has as setts, cobbles or pavers that the map had as asphalt (Vabaduse väljak, Rotermann,
  // Laikmaa, Toompea): drawn as stone
  const stone = new Set(marks?.stone || []);
  // (a street is known by both its ends: streets share their first points at a junction)
  const keyOf = (r) => { const a = r.pts[0], b = r.pts[r.pts.length - 1]; return `${a[0].toFixed(1)},${a[1].toFixed(1)},${b[0].toFixed(1)},${b[1].toFixed(1)}`; };
  for (const r of vectors.roads) {
    if (!r.pts.length) continue;
    const key = keyOf(r);
    if (stone.size && !r.s && stone.has(key)) r.s = 1;
    if (r.s === 1 && IN_CENTRE(r.pts[0][0])) { r.nomark = true; continue; }
    const k = seen[key];
    // (all lines found: they replace the made-up ones; some found (-1): the made-up ones stay. None found: believed only on a narrower street seen clearly, as the
    // side streets of Kalamaja and Kesklinn have none; on a wide one the photo more likely hid them, 28 Nov checks)
    if (k && k.clear >= CLEAR && (k.lines > 0 || (k.lines === 0 && k.clear >= 0.7 && r.w < 9))) r.nomark = true;
  }
  const bars = (vectors.extraBars ||= []);
  // the measured lines, and the arrows Mapillary saw, set on their lanes
  for (const src of [lines?.sectors, marks?.bars]) {
    if (src) for (const a of Object.values(src)) for (let i = 0; i + 4 < a.length; i += 5) bars.push(a[i], a[i + 1], a[i + 2], a[i + 3], a[i + 4], 0);
  }
}
