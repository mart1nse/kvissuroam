// The rules of the Raadi rally stage, apart from everything that is drawn (src/race/raadi.js builds and shows the
// stage and runs these as the car drives): where the stage goes, its hidden checks at the bales, what costs seconds
// and how many, what ends a run. Nothing here touches the page, so the server runs the same rules over a recorded
// run before its time goes on the board (worker/stagecheck.js, 26 Nov 2026: until then the board took the page's
// word for the penalty seconds and for the way the stage was driven).
import STAGE from './raadi.json';

const OFF_LIMIT = 150;                     // metres off the stage before the run is cancelled
const BACK_LIMIT = 100;                    // metres driven the wrong way along the stage before the run is cancelled
// R in a run (the car put back on a spot it drove over at least 3 s before: main.js goLastSpot) costs RESET_PEN
// seconds, and the run goes on from that spot as it stood there. (Martin 26 Nov: "add 5s penalty when clicking R.
// just in case somebody crashes hard into something and presses R and gets a timegain". Until then a hop of under
// 40 m was free, a tree or a roof left behind for nothing, and a longer one ended the run.)
const RESET_PEN = 5;
const BACK_WARN = 25;                      // ... and from this far on the panel says WRONG WAY
const FIN_WIDE = 4;                         // metres beside the road that the finish line still counts
// On the right the finish counts only up to its flag, and a tape runs on from the flag across the grass (Martin
// 23 Nov 00:14, a red line beside the right flag: "you will need to cross it from the left side to make sure no
// wide finish"): FIN_TAPE m of it.
const FIN_FLAG = 1.4, FIN_TAPE = 9;
const SHORT_M = 150;                       // metres along a later part of the stage before that is a short cut
// an apex cut costs time (Martin 23 Nov: a small penalty for a small cut, a large one for a large cut): how far
// inside the path's edge the middle of the car went at the apex, in metres, and the seconds it adds
const APEX_PEN = [[6, 10], [3, 5], [1.2, 2]];
// and so does swinging out wide before a corner to open it up (Martin 23 Nov: "two car widths of room and then
// penalize"): how far outside the path's edge on the way in, from 50 m to 12 m before the apex
const WIDE_PEN = [[7.2, 5], [3.6, 2]];
// Hidden checks, one across the stage at each bale (Martin 23 Nov: "mini-checks on each bale ... to track the
// completion", after he cut from before the last corner straight onto the finish straight and got a time): the car
// has to cross each in turn, going the stage's way, no further than GATE_IN m inside the path's edge (a cut up to
// there costs seconds, see APEX_PEN) or GATE_OUT m outside it. A missed one does not end the run at once (Martin
// 23 Nov, after going very wide before the last corner and being cancelled while he was coming back for the bale:
// "check on every bale that the last bale was completed and ... on finish"): the car's place on the stage waits
// GATE_HOLD points past the check, and the run is over when the car crosses the next check (within GATE_NEXT m
// outside the path, so that the stage passing close by a second time is not it) or the finish without it.
const GATE_IN = 15, GATE_OUT = 25, GATE_NEXT = 8, GATE_FROM = 30, GATE_HOLD = 3;

const P = STAGE.pts, HW = STAGE.hw, N = P.length, START = STAGE.start, FIN = STAGE.finish;
const TAN = P.map((_, i) => {
  const a = P[Math.max(0, i - 1)], b = P[Math.min(N - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
});
const S = new Float64Array(N);
for (let i = 1; i < N; i++) S[i] = S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
// a point beside the centre line: d metres to the right of the direction of travel
const side = (i, d) => [P[i][0] - TAN[i][1] * d, P[i][1] + TAN[i][0] * d];
// Corners Martin added a bale to after the stage was built: [point, side]. The east loop's second bend, where it
// turns down its west side (24 Nov 12:24, a red circle inside the bend: "just add a bale to the red circle to make
// sure the bale cutting corner skip comes to effect"): the loop's inside had no check after the hairpin's bale, and
// straight across the grass to the fork was about 2 s quicker and free. Its bale stands like the others, a metre
// off the gravel; its check, its penalties and its tape are every corner's.
const ADD_APEX = [[523, -1]];
for (const [k, sd] of ADD_APEX) {
  const [bx, bz] = side(k, sd * (HW[k] + 1));
  STAGE.apex.push([k, sd, +bx.toFixed(2), +bz.toFixed(2), 90, k]);
}
STAGE.apex.sort((p, q) => p[0] - q[0]);
// The first corner's bale a little further in (Martin 23 Nov 19:26, an arrow from the bale away from the road:
// "move the haybale a bit inward ... but just slightly"), metres.
// And the bale at the corner by the pond a touch the other way, towards the road (Martin 23 Nov 00:10, a green
// arrow from the bale to the road: "move the bale a touch more to the inside and extend the tape to the bale").
// And the bale at the east loop's fork onto the corner's tip (24 Nov 11:12, an arrow from the bale to the apex).
// Then 0.7 m back from that tip, away from the road towards its tape's end (24 Nov 12:52: "one small bale position
// change, like 0.7m", with the map at 14:23), and 0.5 m more the same way (14:42: "0,5m the arrow way"); its inside is
// judged from where it now stands, as everywhere.
const BALE_IN = { 33: 0.5, 370: -0.4, 464: -0.3 };
for (const a of STAGE.apex) if (BALE_IN[a[0]]) { a[2] += -TAN[a[0]][1] * a[1] * BALE_IN[a[0]]; a[3] += TAN[a[0]][0] * a[1] * BALE_IN[a[0]]; }
// The bale in the east loop's left hairpin a little further on, towards the turn (Martin 23 Nov 20:19, an arrow
// from the bale along the inside: "move the haybale according to the arrow"), metres along the stage: it keeps its
// distance off the edge, and the corner's line across the stage (its hidden check, its penalties, its tape) goes
// with it.
const BALE_ON = { 498: 3 };
for (const a of STAGE.apex) {
  const m = BALE_ON[a[0]];
  if (!m) continue;
  const k = a[0], lat = (a[2] - P[k][0]) * -TAN[k][1] + (a[3] - P[k][1]) * TAN[k][0];
  const k2 = k + Math.round(m / 2);
  a[0] = k2; a[2] = P[k2][0] - TAN[k2][1] * lat; a[3] = P[k2][1] + TAN[k2][0] * lat;
}
// And the junction bale by the middle pond a little up the road, towards the turn (Martin 24 Nov, an arrow from
// the bale: "move this bale further up the road"), metres along the stage at the same distance off it. The corner
// keeps its point (its spur tape and its check go through the bale, so they move with it).
const BALE_UP = { 402: 2.5 };
for (const a of STAGE.apex) {
  const m = BALE_UP[a[0]];
  if (!m) continue;
  const k = a[0], lat = (a[2] - P[k][0]) * -TAN[k][1] + (a[3] - P[k][1]) * TAN[k][0];
  const f = k + m / 2, i = Math.floor(f), t = f - i, px = P[i][0] + (P[i + 1][0] - P[i][0]) * t, pz = P[i][1] + (P[i + 1][1] - P[i][1]) * t;
  const tx = TAN[i][0] + (TAN[i + 1][0] - TAN[i][0]) * t, tz = TAN[i][1] + (TAN[i + 1][1] - TAN[i][1]) * t, l = Math.hypot(tx, tz);
  a[2] = px - tz / l * lat; a[3] = pz + tx / l * lat;
}
// Bales that are not at a corner, set where Martin asked for them: [x, z, the point whose way the banner faces]
// (24 Nov "haybale here": right of the road at the side road's mouth before the east loop's fork; at 11:12 a little up
// the road and in towards it, "move 2 haybales"; and "ad 1": on the outside of the fork's left turn, under its board)
// and (12:10) one in front of the birch on the outside of the east loop's left hairpin, "to soften potential impac
// to tree and proect it"
const MORE_BALES = [[2874.7, 454.1, 451], [2901.1, 436.3, 470], [2905.7, 360.9, 512]];
// The glow along the inside of the tight corners is rounded (Martin 23 Nov 19:26, blue curves inside five apexes:
// "Round a bit the halos in the apexes"): the path's inside edge folds into a sharp point there. ROUND[k] is the
// arc that takes its place: { a, b, cx, cz, r, t0, t1 }, points a..b on a circle of radius r round (cx, cz) from
// angle t0 to t1. The largest of ROUND_R that leaves the bale wholly beyond it (the edge's penalties are judged
// from the bale, so nothing else changes); not at the last corner with its own fence.
const TRACK_ROUND = new Map([[82, 16]]), TRACK_W = 12;
const ROUND_R = [8, 6.5, 5, 4, 3, 2.5, 2], ROUND_W = 6, NO_ROUND = [854];
const ROUND = new Map();
for (const [k, sd, bx, bz] of STAGE.apex) {
  if (NO_ROUND.includes(k) || k - 2 * ROUND_W < 0 || k + 2 * ROUND_W >= N) continue;
  const d1 = TAN[k - ROUND_W], d2 = TAN[k + ROUND_W], e1 = side(k - ROUND_W, sd * HW[k - ROUND_W]), e2 = side(k + ROUND_W, sd * HW[k + ROUND_W]);
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(den) < 0.05) continue;
  // (where the two arms' edges meet, and the turn between them)
  const s0 = ((e2[0] - e1[0]) * d2[1] - (e2[1] - e1[1]) * d2[0]) / den, tx = e1[0] + d1[0] * s0, tz = e1[1] + d1[1] * s0;
  let ux = d2[0] - d1[0], uz = d2[1] - d1[1];
  const ul = Math.hypot(ux, uz); ux /= ul; uz /= ul;
  const phi = Math.acos(Math.max(-1, Math.min(1, d1[0] * d2[0] + d1[1] * d2[1])));
  for (const r of ROUND_R) {
    const cd = r / Math.cos(phi / 2), cx = tx + ux * cd, cz = tz + uz * cd, hit = new Map();
    for (let i = k - 2 * ROUND_W; i <= k + 2 * ROUND_W; i++) {
      // (along the inside normal from the centre line, the arc's near side between the two arms)
      const nx = -TAN[i][1] * sd, nz = TAN[i][0] * sd, ox = P[i][0] - cx, oz = P[i][1] - cz;
      const b = ox * nx + oz * nz, disc = b * b - (ox * ox + oz * oz - r * r);
      if (disc < 0) continue;
      const t = -b - Math.sqrt(disc), hx = P[i][0] + nx * t - cx, hz = P[i][1] + nz * t - cz;
      if (t > HW[i] && (hx * (tx - cx) + hz * (tz - cz)) / (r * cd) >= Math.cos(phi / 2) - 1e-6) hit.set(i, t - HW[i]);
    }
    if (!hit.size || r - Math.hypot(bx - cx, bz - cz) < 0.85) continue;      // (the bale, 0.6 m round, stays beyond it)
    const a = Math.min(...hit.keys()), b = Math.max(...hit.keys());
    if (b - a < 2) break;
    const ang = (i) => { const [x, z] = side(i, sd * (HW[i] + hit.get(i))); return Math.atan2(z - cz, x - cx); };
    let t0 = ang(a), t1 = ang(b);
    if (t1 - t0 > Math.PI) t1 -= 2 * Math.PI; else if (t0 - t1 > Math.PI) t1 += 2 * Math.PI;
    ROUND.set(k, { a, b, cx, cz, r, t0, t1, tx, tz, cd, half: phi / 2 });
    break;
  }
}
// The red and white tape (src/race/tape.js) stands TAPE_OUT beyond where a penalty begins: the penalties are judged
// by the middle of the car, so its side is at the tape as they begin.
const TAPE_OUT = 0.85;
// Which corners have which lines, as Martin drew them on nine pictures of 23 Nov ("Add penalty borders (I have
// manually drawn red stripes) and remove penalty borders (circles in green)"), by the apex's point:
//  - NO_WIDE: no line on the outside of the way in (his green circles)
//  - NO_APEX: nothing for the inside either (the hidden check at the bale stays)
//  - WIDE_AT: a way in with its own length or steps. The start stretch: "move it more closer on the left side so
//    you can't take a very wide angle", so half a metre off the lane there and on to the corner itself. Before the
//    left-hander past the boulders the line begins at the corner before it (his red stripe on the right).
// (Martin 24 Nov 12:24: "add penalty to each haybale (irregardless of the color i highlighted it)": NO_APEX is
// empty again, the S bend north of the pond is judged at both its bales; the loop's added bend has no way-in line.)
const NO_WIDE = [205, 429, 523, 550, 854], NO_APEX = [];
//    Then, with the tape standing there (16:24): "In the start, allow to break the tape, penalize only 2 m to the
//    left from the tape": the tape stays 1.35 m off the lane (`tape`) and the seconds begin 2 m beyond it.
//    Then (25 Nov 09:09): "half of the car can be over the tape, but more than that and +2 starts": the +2 s
//    begins with the car's middle at the tape, the +5 s 4 m further out.
// And the way in to the wood loop's right-hander, past the new boulder (Martin 24 Nov 14:45: "cutting the tape here ...
// should result already with the 5s penalty when cutting it even slightly. i can pass the new boulder on the left
// with only 2s penalty"): the left-hand bend before it is its way in, so the tape there starts at 758 and crossing it
// costs +5 s at once, +10 s deeper.
const WIDE_AT = { 33: { from: START + 2, to: 30, pen: [[5.35, 5], [1.35, 2]], tape: 1.35 }, 402: { from: 371 }, 794: { from: 758, pen: [[7.2, 10], [3.6, 5]] } };
// the way in to each corner: [first index, last index, side of the turn, steps], clear of the corner before it
const ENTRY = STAGE.apex.map(([k, sd], n) => {
  const own = WIDE_AT[k] || {};
  const pen = own.pen || WIDE_PEN;
  return [own.from ?? Math.max(START + 2, k - 25, n ? STAGE.apex[n - 1][0] + 8 : 0), own.to ?? k - 6, sd, pen, k, own.tape ?? pen.at(-1)[0] + TAPE_OUT];
}).filter(([a, b, , , k]) => b - a >= 4 && !NO_WIDE.includes(k));
// The inside of two bends that have no bale is out of bounds as well (Martin 23 Nov: "needs outside banned areas",
// with the lines he drove over the grass drawn on two pictures; every bend had it for an hour, then "there are a
// lot more red lines around the track. Just add the ones I added on the two pics"). BENDS: [first point, last
// point, side the stage turns to (1 right, -1 left)]; BEND[i] is that side at point i, 0 elsewhere. The tape stands
// where the side of the car meets it with its middle CUT_IN m inside the path's edge. Crossing it costs time at once,
// by how deep, once per bend (the deepest counts), after a metre's leeway to brush the tape and break it (Martin 24
// Nov 12:43: "penalty as soon as you cross the tape, but give 1m of leeway ... if you go deeper than 1m, start the
// penalties with the +2 +5 etc"): BEND_PEN is [metres the middle of the car is inside the edge, seconds]. (Until then
// it counted stage covered beyond the tape, from zero again at each return to the gravel: dabbing back every 8 m
// made a whole bend's cut free.)
const CUT_IN = 1.2, BEND_PEN = [[CUT_IN + 6, 10], [CUT_IN + 3, 5], [CUT_IN + 1, 2]];
// (north of the boulder field; after the bale east of the middle pond; and, from his pictures of 15:29, the
// right-hand bend of the loop by the wood)
const BENDS = [[277, 292, -1], [436, 449, -1], [737, 753, 1]];
const BEND = (() => {
  const b = new Int8Array(N);
  for (const [i0, i1, sd] of BENDS) b.fill(sd, i0, i1 + 1);
  return b;
})();
const BEND_OF = new Int8Array(N).fill(-1);
BENDS.forEach(([i0, i1], n) => BEND_OF.fill(n, i0, i1 + 1));
const yawAt = (i) => Math.atan2(TAN[i][0], -TAN[i][1]);
// How much wider than the path the gravel is inside each corner, m. The bale stands a metre off all the gravel
// there (tools/race/build-raadi.py: off the corner's other arm, and off the wide gravel where paths meet), so
// where it stands further in than a metre off this path's edge, the inside is judged from that much further in.
// At the last corner the inside costs seconds only behind the bale (Martin 23 Nov 17:58, a green line drawn round
// the far side of the bale: "Lax the last corner penalty area like on the green line"): WRAP is how far behind the
// bale's middle the middle of the car may go there. (The tape went round the bale that far out; now it is the
// straight fence of SPUR below.)
const WRAP = { 854: 1.3 };
// At the corner by the pond the inside is free a little further past the bale (Martin 23 Nov 20:21, a green line
// across its tape just beyond the bale: "Shorten the tape a bit so a bit more can be cut in this corner without
// penalty"): FREE[k] metres more before the seconds begin, and the spur's tape starts that much further in.
// (Since 00:10 the tape there runs to the bale again and is the border, as everywhere: none free now.)
const FREE = {};
const ROOM = new Map(STAGE.apex.map(([k, sd, bx, bz]) => [k, Math.max(0, ((bx - P[k][0]) * -TAN[k][1] + (bz - P[k][1]) * TAN[k][0]) * sd - 1 - HW[k]) + (WRAP[k] ? WRAP[k] - 0.2 : 0) + (FREE[k] || 0)]));
// Two corners close together whose insides are one (Martin 23 Nov 16:24, a blue line from the one bale past the next
// and on along the bend: "Add smooth transition of the two taped parts"): JOIN[k] is the apex the inside of apex k
// runs on to, and between the two the room goes over evenly from the one's to the other's.
const JOIN = { 127: 134 };
const roomAt = (k, i) => {
  const k2 = JOIN[k];
  return k2 ? ROOM.get(k) + (ROOM.get(k2) - ROOM.get(k)) * Math.max(0, Math.min(1, (i - k) / (k2 - k))) : ROOM.get(k);
};
const afterOf = (k) => (JOIN[k] ? JOIN[k] - k : 5);            // points after the apex where its inside is judged
// And two where the tape is a spur from the bale into the corner (his green lines at 16:24), along the line across
// the stage at the apex turned SPUR[k] degrees towards the way out. What costs seconds there is as it was.
// The last corner's is a straight fence from the bale down the grass between its two arms, alongside the way out
// (Martin 23 Nov 19:19, a green line from the bale: "Last corner, put a straight fence, like on the pic"): turned
// the other way, away from the corner's tip.
const SPUR = { 370: 0, 402: 22, 854: -38 };
// (how far the spur runs from the bale, m; 6.5 unless said: the junction's 1.5 m shorter, Martin 24 Nov)
const SPUR_LEN = { 402: 5 };
// (each spur's way into the corner from its bale, unit: the line across the stage at the apex turned SPUR degrees)
const SPUR_DIR = new Map(STAGE.apex.filter(([k]) => SPUR[k] != null).map(([k, sd]) => {
  const turn = SPUR[k] * Math.PI / 180 * -sd, ix = TAN[k][1] * -sd, iz = -TAN[k][0] * -sd;
  return [k, [ix * Math.cos(turn) - iz * Math.sin(turn), ix * Math.sin(turn) + iz * Math.cos(turn)]];
}));
// The stretch along the middle pond's south shore is driven twice, and the second time through its corners had no
// check (Martin 24 Nov: "I can cut pretty heavily in the left corner before the trash bin currently without getting
// penalty ... also in the next corner to the left"). TWIN[j] = k: point j of the second pass is the very place of
// corner k of the first (the left turn by the pond, the same way both times; the junction after it, which the
// second pass goes straight through), judged at the same bale by the same line and tape: no second bale, board or
// tape. CHECKS is every hidden check in the order the stage meets them.
const TWIN = { 664: 370, 696: 402 };
// (and its ways in: the same tape, judged on the second pass too)
const ENTRY_ALL = ENTRY.concat(Object.entries(TWIN).flatMap(([j, k]) => ENTRY.filter((e) => e[4] === k).map(([e0, e1, sd, pen, , tape]) => [e0 + (j - k), e1 + (j - k), sd, pen, +j, tape])));
const CHECKS = STAGE.apex.concat(Object.entries(TWIN).map(([j, k]) => [+j, ...STAGE.apex.find((a) => a[0] === k).slice(1, 4)])).sort((p, q) => p[0] - q[0]);
for (const [j, k] of Object.entries(TWIN)) { ROOM.set(+j, ROOM.get(k)); SPUR[j] = SPUR[k]; if (SPUR_DIR.has(k)) SPUR_DIR.set(+j, SPUR_DIR.get(k)); }
// The tape along the way into a corner carried on to the bale of the corner before it, where the two are on the same
// side (Martin 23 Nov 23:58, a green line from the end of the tape after the second corner to its bale: "lengthen
// this tape up to the bale"): [the corner whose way in it is, the corner whose bale]. Only the tape: crossing
// there is the earlier corner's inside, judged at its bale as before.
const LINK = [[108, 82]];
// (by the earlier corner: the segment from its bale, { bx, bz, ux, uz, d, nx, nz }, n the side away from the road)
const LINK_AT = new Map(LINK.map(([k, k2]) => {
  const [e0, , sd, , , tape] = ENTRY.find((e) => e[4] === k), [sx, sz] = side(e0, -sd * (HW[e0] + tape));
  const [, , bx, bz] = STAGE.apex.find((a) => a[0] === k2), d = Math.hypot(sx - bx, sz - bz), ux = (sx - bx) / d, uz = (sz - bz) / d;
  const [px, pz] = P[e0], o = (px - bx) * -uz + (pz - bz) * ux;          // (which side of it the stage is)
  return [k2, { bx, bz, ux, uz, d, nx: o > 0 ? uz : -uz, nz: o > 0 ? -ux : ux }];
}));
// Where each penalty begins, as lines beside the stage: [first point, last point, (i) => metres to the right of
// travel], with the tape along them.
const LINES = [
  ...STAGE.apex.filter(([k]) => !NO_APEX.includes(k) && !WRAP[k] && SPUR[k] == null && !Object.values(JOIN).includes(k) && !LINK_AT.has(k)).map(([k, sd]) => {
    // (a joined pair is one line: the first's, on through the second's)
    const k2 = JOIN[k], last = Math.min(N - 1, (k2 || k) + 5);
    return [k, last, (i) => sd * (HW[i] + (k2 && i > k2 ? ROOM.get(k2) : roomAt(k, i)) + APEX_PEN.at(-1)[0] + TAPE_OUT)];
  }),
  ...ENTRY.map(([e0, e1, sd, , , tape]) => [e0, e1, (i) => -sd * (HW[i] + tape)]),
  ...BENDS.map(([i0, i1, sd]) => [i0, i1, (i) => sd * (HW[i] + CUT_IN + TAPE_OUT)]),
];
// (and round the far side of the bale where WRAP says so and there is no spur: an arc of 200 degrees, a stick
// every 1.9 m)
const ARCS = STAGE.apex.filter(([k]) => WRAP[k] && SPUR[k] == null).map(([k, , bx, bz]) => {
  const r = WRAP[k] + TAPE_OUT, a0 = Math.atan2(bz - P[k][1], bx - P[k][0]), pts = [];
  for (let a = -100; a <= 100; a += 20) pts.push([bx + Math.cos(a0 + a * Math.PI / 180) * r, bz + Math.sin(a0 + a * Math.PI / 180) * r]);
  pts.step = 1.9;
  return pts;
}).concat(STAGE.apex.filter(([k]) => SPUR[k] != null).map(([k, , bx, bz]) => {
  // (from just clear of the bale, or FREE further, 6.5 m into the corner)
  const [dx, dz] = SPUR_DIR.get(k);
  const f = FREE[k] || 0, end = SPUR_LEN[k] || 6.5, pts = [0.9 + f, (0.9 + f + end) / 2, end].map((m) => [bx + dx * m, bz + dz * m]);
  pts.step = 2.8;
  return pts;
})).concat([(() => {
  // (the finish's: from beside its right flag straight out across the grass)
  const pts = [HW[FIN] + FIN_FLAG + 0.3, HW[FIN] + FIN_FLAG + 0.3 + FIN_TAPE / 2, HW[FIN] + FIN_FLAG + 0.3 + FIN_TAPE].map((d) => side(FIN, d));
  pts.step = 2.8;
  return pts;
})()]).concat(LINK.map(([k, k2]) => {
  // (from where the way in's tape starts, straight to just clear of the bale)
  const { bx, bz, ux, uz, d } = LINK_AT.get(k2), pts = [0.9, (0.9 + d) / 2, d].map((m) => [bx + ux * m, bz + uz * m]);
  pts.step = 2.8;
  return pts;
}));
// one text for every one of them (Martin 23 Nov: "a general one for all crossings", "for leaving the track")
const penText = (s) => `+${s} S FOR LEAVING THE TRACK`;
const resetText = `+${RESET_PEN} S FOR THE RESET`;

// nearest point of the stage between indices lo and hi: { i, d, lat } (lat: sideways, + right of travel)
function nearestIn(x, z, lo, hi) {
  let best = { i: -1, d: Infinity, lat: 0 };
  lo = Math.max(0, lo); hi = Math.min(N - 2, hi);
  for (let i = lo; i <= hi; i++) {
    const a = P[i], b = P[i + 1], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    const ex = x - a[0] - dx * t, ez = z - a[1] - dz * t, d = Math.hypot(ex, ez);
    if (d < best.d) best = { i: t > 0.5 ? i + 1 : i, d, lat: -ex * TAN[i][1] + ez * TAN[i][0] };
  }
  return best;
}

// ---- a run, as the rules see it

// A run about to start: where it is along the stage (prog), the next hidden check (gate), what was counted.
// `ease`: metres every measure of a cut is taken in the car's favour (0 on the page; the server judges a run from
// ten places a second, whose straight lines between them cut each bend a little more than the car did).
export function newRun(ease = 0) {
  return { prog: START, off: 0, back: 0, gate: 0, later: null, laterM: 0, missed: false, offNow: false, pen: 0, resets: 0, marks: [],
    apexPen: new Map(), widePen: new Map(), bendPen: new Map(), prev: null, ease };
}

// One step of a run: the car is at (x, z), st.prev is where it was (the caller sets it after the step, as the page
// does once everything else has seen both places). Counts the penalties into st (on.pen(seconds) for each new one).
// Returns null, { cancel: why } when the run is over, or { fin: f } when the car crossed the finish line at the
// share f of the way from st.prev to here.
export function judgeStep(st, x, z, on = {}) {
  let over = '', done = null;
  const cancel = (why) => { over ||= why; };
  const ease = st.ease || 0;

  // progress along the stage: only forwards from where the car is, in a short window
  // (and not past a check the car has not crossed: beside a hairpin its way out is as near as its way in)
  const hold = st.gate < CHECKS.length ? CHECKS[st.gate][0] + GATE_HOLD : N;
  const w = nearestIn(x, z, st.prog - 6, Math.min(st.prog + 40, hold));
  const onIt = w.d < HW[w.i] + 6;
  if (onIt) st.prog = Math.max(st.prog, w.i);
  const dOff = !onIt && st.prev ? Math.hypot(x - st.prev.x, z - st.prev.z) : 0;
  st.off += dOff;
  st.offNow = !onIt;
  // on the stage beyond a check it has not crossed: the stage says so, and it is not metres off the stage
  const past = !onIt && hold < N ? nearestIn(x, z, hold, hold + 40) : null;
  const gk = hold < N ? CHECKS[st.gate][0] : 0;
  st.missed = !!past && past.i > hold + 2 && past.d < HW[past.i] + 6 && (x - P[gk][0]) * TAN[gk][0] + (z - P[gk][1]) * TAN[gk][1] > 0;
  if (st.missed) st.off -= dOff;
  // joined further on from somewhere else: on the stage, but far from where the run is. (Not when the car
  // is only behind where it got to, after a spin or a few metres back: on the stretch the stage drives
  // twice that same road is also a later part of the stage, and the run was ended there for nothing.)
  // Not at once (Martin 23 Nov 16:30, the junction south of the middle pond where the stage first turns left
  // and later comes straight through: "If I miss the braking point on the first go-through of this point
  // and slide over to the part of the track to which I would need to go later on. Allow to make this
  // mistake ... penalize for cutting only after I don't know 150 m"): only once the car has gone on SHORT_M
  // along that later part.
  if (!onIt) {
    const back = nearestIn(x, z, st.prog - 80, st.prog + 40);
    const g = back.d < HW[back.i] + 8 ? null : nearestIn(x, z, st.prog + 40, FIN);
    if (g && g.d < HW[g.i] + 1.5) {
      st.later ??= g.i;
      st.off -= dOff;                                 // (its own count there, not the one for being off the stage)
      st.laterM = Math.max(0, S[g.i] - S[st.later]);
      if (st.laterM > SHORT_M) cancel('SHORT CUT · STAGE CANCELLED');
    }
  } else { st.later = null; st.laterM = 0; }
  if (st.off > OFF_LIMIT) cancel('OFF THE STAGE · CANCELLED');
  // the wrong way (Martin 25 Nov: the stage backwards, or its loop the other way round): metres moved against
  // the stage's direction on its gravel, where it is now or on any other part of it; forwards pays them back,
  // so a spin or reversing to a missed bale stays well inside the limit
  if (st.prev && !over) {
    const r = onIt ? w : nearestIn(x, z, START, FIN);
    // (not between a check still to cross and the next one: going back round a missed bale is what it asks)
    const nextK = st.gate + 1 < CHECKS.length ? CHECKS[st.gate + 1][0] : FIN;
    if (r.i >= 0 && r.d < HW[r.i] + 6 && !(hold < N && r.i > hold - GATE_HOLD && r.i < nextK)) {
      const ds = (x - st.prev.x) * TAN[r.i][0] + (z - st.prev.z) * TAN[r.i][1];
      st.back = Math.max(0, (st.back || 0) - ds);
      if (st.back > BACK_LIMIT) cancel('WRONG WAY · STAGE CANCELLED');
    }
  }
  // apexes: cutting inside the edge adds seconds, more for a deeper cut (once per apex: the deepest counts)
  const apexCut = (k, deep) => {
    if (NO_APEX.includes(k)) return;
    const pen = APEX_PEN.find(([m]) => deep - ease > m)?.[1] || 0, had = st.apexPen.get(k) || 0;
    if (pen <= had) return;
    st.apexPen.set(k, pen); st.pen += pen - had;
    on.pen?.(pen);
  };
  // the hidden check at each bale, in turn: where the car crosses the line across the stage at the apex
  // (crossed(n, out): how far inside the gravel's edge (+) or outside it (-) the car crossed check n's line
  // this step, going the stage's way and no further than `out` m beyond the road's far edge; null if it did not)
  const crossed = (n, out) => {
    const [k, sd, bx, bz] = CHECKS[n], sp = SPUR_DIR.get(k);
    // (where the tape is a spur from the bale, its line is the check: through the bale along the spur, so
    // what costs seconds begins where the tape does; elsewhere the line across the stage at the apex)
    let gx = P[k][0], gz = P[k][1], tx = TAN[k][0], tz = TAN[k][1];
    if (sp) { gx = bx; gz = bz; tx = -sp[1] * sd; tz = sp[0] * sd; if (tx * TAN[k][0] + tz * TAN[k][1] < 0) { tx = -tx; tz = -tz; } }
    const a0 = (st.prev.x - gx) * tx + (st.prev.z - gz) * tz, a1 = (x - gx) * tx + (z - gz) * tz;
    if (!(a0 < 0 && a1 >= 0)) return null;
    const f = a0 / (a0 - a1), cx = st.prev.x + (x - st.prev.x) * f - gx, cz = st.prev.z + (z - st.prev.z) * f - gz;
    const deep = sp ? cx * sp[0] + cz * sp[1] + 1 - (WRAP[k] ? WRAP[k] - 0.2 : 0) - (FREE[k] || 0)
      : (-cx * tz + cz * tx) * sd - HW[k] - ROOM.get(k);
    return deep - ease > GATE_IN || deep + ease < -2 * HW[k] - out ? null : deep;
  };
  while (st.gate < CHECKS.length && st.prev && !over) {
    const k = CHECKS[st.gate][0];
    if (st.prog < k - GATE_FROM) break;
    const deep = crossed(st.gate, GATE_OUT);
    if (deep == null) break;
    // (every bale, also the second corner's, whose tape runs on to the next corner: Martin 24 Nov 12:24, its cut
    // inside the bale had been free since that tape was lengthened)
    apexCut(k, deep);
    st.gate++;
  }
  // A check not crossed ends the run only when the car comes through the NEXT one (or the finish) without it
  // (Martin 23 Nov 16:36, off wide before the last corner and cancelled as he came back to take it: "allow
  // to still get the apex. Check on every bale that the last bale was completed and ... on finish"). Until
  // then the run stands where it is: the stage goes on from this check (see the progress above).
  if (!over && st.prev && st.gate + 1 < CHECKS.length && crossed(st.gate + 1, GATE_NEXT) != null) cancel('MISSED A CORNER · STAGE CANCELLED');
  // And for the 10 m after the apex (Martin 23 Nov: only at the apex or after it; a spin to the inside before
  // the corner costs nothing when the car is back on the path by the bale and drives the corner).
  for (const [k, sd] of CHECKS) {
    const n = afterOf(k), L = LINK_AT.get(k);
    if (st.prog < k - 25 || st.prog > k + n + 3 || over || SPUR[k] != null) continue;
    if (L) {
      // (where the tape runs from the bale to the next corner's, beyond it, as far as it goes; the car's middle
      // TAPE_OUT short of it is where the seconds begin, as at every other tape). Only from the apex on: on the
      // way in the road itself lies beyond the line the tape is on, drawn on back past the bale
      if (st.prog < k) continue;
      const ox = x - L.bx, oz = z - L.bz, along = ox * L.ux + oz * L.uz;
      if (along > 0 && along < L.d) apexCut(k, APEX_PEN.at(-1)[0] + TAPE_OUT + ox * L.nx + oz * L.nz);
      continue;
    }
    const a = nearestIn(x, z, k - 8, k + n);
    if (a.i < k || a.d * a.d - a.lat * a.lat > 2.25) continue;       // before the apex, or past the end of it
    apexCut(k, a.lat * sd - HW[a.i] - roomAt(k, a.i));
  }
  // and too wide on the way in
  for (const [e0, e1, sd, steps] of ENTRY_ALL) {
    if (st.prog < e0 || st.prog > e1 || over) continue;
    const a = nearestIn(x, z, st.prog - 4, st.prog + 4), out = -a.lat * sd - HW[a.i];
    const pen = steps.find(([m]) => out - ease > m)?.[1] || 0, had = st.widePen.get(e1) || 0;
    if (pen > had) {
      st.widePen.set(e1, pen); st.pen += pen - had;
      on.pen?.(pen);
    }
  }
  // and the inside of the bends of BENDS
  {
    const i = w.i, sd = BEND[i], deep = sd ? w.lat * sd - HW[i] : 0;
    const pen = sd ? BEND_PEN.find(([m]) => deep - ease > m)?.[1] || 0 : 0, had = st.bendPen.get(BEND_OF[i]) || 0;
    if (pen > had && !over) { st.bendPen.set(BEND_OF[i], pen); st.pen += pen - had; on.pen?.(pen); }
  }
  // the flying finish
  // (also with the last check still open: the car's place on the stage waits there, and the finish is what
  // judges it)
  if (!over && st.prev && (st.prog >= FIN - 12 || (st.gate === CHECKS.length - 1 && st.prog >= CHECKS[st.gate][0] - GATE_FROM))) {
    const [fx, fz] = P[FIN], [tx, tz] = TAN[FIN];
    const a = (st.prev.x - fx) * tx + (st.prev.z - fz) * tz, b = (x - fx) * tx + (z - fz) * tz;
    // (the line counts across the road and FIN_WIDE m to each side, not on across the park)
    const f0 = a < 0 && b >= 0 ? a / (a - b) : 0, wide = Math.abs(-(st.prev.x + (x - st.prev.x) * f0 - fx) * tz + (st.prev.z + (z - st.prev.z) * f0 - fz) * tx);
    const right = -(st.prev.x + (x - st.prev.x) * f0 - fx) * tz + (st.prev.z + (z - st.prev.z) * f0 - fz) * tx;
    if (wide > HW[FIN] + FIN_WIDE || right > HW[FIN] + FIN_FLAG) { /* not through the finish */ }
    else if (a < 0 && b >= 0 && st.gate < CHECKS.length) cancel('MISSED A CORNER · STAGE CANCELLED');
    else if (a < 0 && b >= 0) done = a / (a - b);
  }
  return over ? { cancel: over } : done != null ? { fin: done } : null;
}

// Where the run stands now, kept a few times a second and at every check crossed (t: the car's clock): R takes the
// run back to where it stood on the spot the car is put on.
export function markRun(st, t) {
  const m = st.marks.at(-1);
  if (!m || m.gate !== st.gate || t - m.t >= 0.25) st.marks.push({ t, prog: st.prog, gate: st.gate });
}
// R in a run: the car is back on a spot it was on at the car's clock t. RESET_PEN seconds, and the run is where it
// was then: its place along the stage and the checks crossed (a bale passed after that spot is to be passed again).
// What was counted stays: the seconds, the metres off the stage. The hop itself is no driving: no line is crossed by
// it and it is no metres the wrong way.
export function resetRun(st, t) {
  let m = null;
  for (let k = st.marks.length - 1; k >= 0 && !m; k--) if (st.marks[k].t <= t) { m = st.marks[k]; st.marks.length = k + 1; }
  // (a spot from before the green light: the line itself)
  st.prog = Math.min(st.prog, m ? m.prog : START); st.gate = Math.min(st.gate, m ? m.gate : 0);
  st.prev = null; st.later = null; st.laterM = 0; st.missed = false;
  st.pen += RESET_PEN; st.resets++;
}

export { STAGE, OFF_LIMIT, BACK_LIMIT, RESET_PEN, BACK_WARN, FIN_WIDE, FIN_FLAG, FIN_TAPE, SHORT_M, APEX_PEN, WIDE_PEN, GATE_IN, GATE_OUT, GATE_NEXT, GATE_FROM, GATE_HOLD, P, HW, N, START, FIN, TAN, S, side, ADD_APEX, BALE_IN, BALE_ON, BALE_UP, MORE_BALES, TRACK_ROUND, TRACK_W, ROUND_R, ROUND_W, NO_ROUND, ROUND, TAPE_OUT, NO_WIDE, NO_APEX, WIDE_AT, ENTRY, CUT_IN, BEND_PEN, BENDS, BEND, BEND_OF, yawAt, WRAP, FREE, ROOM, JOIN, roomAt, afterOf, SPUR, SPUR_LEN, SPUR_DIR, TWIN, ENTRY_ALL, CHECKS, LINK, LINK_AT, LINES, ARCS, penText, resetText, nearestIn };
