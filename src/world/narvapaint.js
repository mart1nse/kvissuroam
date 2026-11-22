// Road paint of Narva mnt (Martin, 22 Nov: the Narva mnt kaardista, the last piece). Compared with his Street
// View shots and the orthophoto (measured only, its pixels are not used):
//  - from the Jaama junction up past Narva 100 to the Peetri junction the two-lane road has a double solid
//    centre line (shot 11.12.34 by Narva 100, and the orthophoto all the way), not the generated dashes;
//  - the rest of the route already matches: the bridge's lanes, the crossings, the four lanes with a solid centre
//    line from Peetri to Maxima.
// No street name is painted on the road (the names in the shots are Google's).
//
// Freeze frames: nothing is built here. The lines go into the map's own road paint (src/world/roads.js,
// `extraLines`), which is made per map square with the rest of the paint.
const NAME = 'Jõhvi-Tartu-Valga tee';
// the centre line from the Jaama junction to the Peetri junction, as the map draws the road
const LINE = [[1666.7, 1975.6], [1692.1, 1899.9], [1702.5, 1868.7], [1725.8, 1799.1], [1734.6, 1773.5]];
const FROM = 13, TO = 7;          // m clear of the crossing at Jaama, and of the junction's middle at Peetri
const OFF = 0.12, STEP = 3;        // the two lines 0.12 m either side of the middle; pieces short enough to follow the slope

const close = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.6;

export function narvaPaintVectors(vectors) {
  for (const r of vectors.roads) {
    if (r.name !== NAME || r.pts.length !== 2) continue;
    for (let i = 0; i < LINE.length - 1; i++) if (close(r.pts[0], LINE[i]) && close(r.pts[1], LINE[i + 1])) r.nomark = true;
  }
  const len = LINE.slice(1).map((q, i) => Math.hypot(q[0] - LINE[i][0], q[1] - LINE[i][1])), total = len.reduce((a, b) => a + b, 0);
  const at = (d, side) => {
    let i = 0;
    while (i < len.length - 1 && d > len[i]) d -= len[i++];
    const a = LINE[i], b = LINE[i + 1], ux = (b[0] - a[0]) / len[i], uz = (b[1] - a[1]) / len[i];
    return [a[0] + ux * d - uz * side, a[1] + uz * d + ux * side];
  };
  const L = (vectors.extraLines ||= []);
  for (const side of [-OFF, OFF]) {
    for (let d = FROM; d < total - TO; d += STEP) {
      const e = Math.min(total - TO, d + STEP), a = at(d, side), b = at(e, side);
      L.push(a[0], a[1], b[0], b[1]);
    }
  }
}
