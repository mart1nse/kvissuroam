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

export async function centreLines() {
  try { return await (await fetch(`${DATA}lines.json`)).json(); } catch { return null; }
}

export function centreVectors(vectors, lines = null) {
  const seen = lines?.seen || {};
  for (const r of vectors.roads) {
    if (!r.pts.length || !IN_CENTRE(r.pts[0][0])) continue;
    if (r.s === 1) { r.nomark = true; continue; }
    const k = seen[`${r.pts[0][0].toFixed(1)},${r.pts[0][1].toFixed(1)}`];
    if (k && k.clear >= CLEAR) r.nomark = true;
  }
  if (!lines) return;
  const bars = (vectors.extraBars ||= []);
  for (const a of Object.values(lines.sectors)) for (let i = 0; i + 4 < a.length; i += 5) bars.push(a[i], a[i + 1], a[i + 2], a[i + 3], a[i + 4], 0);
}
