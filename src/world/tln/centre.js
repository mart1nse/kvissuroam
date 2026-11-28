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

const get = async (f) => { try { return await (await fetch(`${DATA}${f}`)).json(); } catch { return null; } };
// lines.json (tools/tln/lines.py) and marks.json (tools/tln/marks.py: arrows, manhole lids and drains, tram lines)
let marks = null;
export async function centreLines() {
  const [lines, m] = await Promise.all([get('lines.json'), get('marks.json')]);
  marks = m;
  return lines;
}
export const centreMarksData = () => marks;

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
