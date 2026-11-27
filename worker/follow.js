// The lap as the server follows a racer round it (26 Nov 2026: until now a race finish was the racer's own word,
// held only against the clock, so "finished" sent two minutes after the lights won every race).
//
// Racers send their car's place ten times a second (src/net/multiplayer.js), and the lobby passes each one here
// before it goes on to the others. From those places alone the server keeps, per racer:
//   the start   seen standing on the grid behind the line, and not further from that spot after the lights than a
//               car can get from a standstill; only then does crossing the start line begin the lap
//   the lap     the lap's gates (the game's own, src/race/lapgates.js) crossed in order on the way from one place
//               to the next, one missed gate forgiven when the next is passed, as the game's lap timer does
//   the finish  the moment it saw the car cross the line with the gates behind it
// The race desk (worker/race.js) takes a finish only from a car followed round like this.
//
// What an honest racer can run into is forgiven: R puts the car back on its own earlier path (no gate is passed by
// that), and a gap in the positions (a lost connection, the server restarted by a deploy) lets the car be found
// again further along the lap, as far on as the fastest known pace allows for the time the gap took (worker/pace.json).
// A car that is moved in any other way (a jump no car can drive, by the time between two positions) does not get
// its finish taken. Nobody is put out of a race here: the race desk decides when the racer says they finished.
import LAP from '../src/race/track.json';
import PACE from './pace.json';
import { lapGates, throughGate } from '../src/race/lapgates.js';
import { finishLine, overLine } from './lapline.js';

export const LAP_GATES = lapGates(LAP);
const LINE = finishLine(LAP);
export const PASS = [...LAP_GATES, LINE];
const P = LAP.pts, HW = LAP.hw, N = P.length;
// the fastest known time (ms) from the start line until k of the gates are passed; null if the table is of other gates
export const PT = PACE.gates === PASS.length && PACE.at.every((i, k) => i === PASS[k].i) ? PACE.t : null;

// the grid (src/race/racemode.js gridPose): behind a line across the straight that leads to the start, t metres
// along it from A, the cars in rows of five back from GRID_LINE
const A = P[N - 30], GL = Math.hypot(P[0][0] - A[0], P[0][1] - A[1]);
const UX = (P[0][0] - A[0]) / GL, UZ = (P[0][1] - A[1]) / GL;
const GRID_LINE = -34, BOX_BACK = 62, BOX_HALF = 8;
const STILL = 0.4;               // m between two positions: a car standing (or in its first tenth of a second away)
const LAUNCH_A = 14;             // m/s2: no car leaves the grid harder (half of it times the seconds squared)
const LAUNCH_HEAD = 0.5;         // s a page's clock may run ahead of the server's
const LAUNCH_ROOM = 2.5;         // m
const V_MAX = 110, STEP_ROOM = 1; // m/s, m: no car goes faster (the fastest: 95), by the sender's own time between two positions
const LEAD_MAX = 1500;           // ms the sender's clock may get ahead of ours (positions held up on the way come in a bunch)
const HOP = 20;                  // m between two positions that is still driving, where the sender's time is not known or not believed
const HOP_V = 100;               // m/s: there, further than this for the time between two positions is no gap but a jump
const KEEP_MAX = 9000;            // positions of a lap kept (7 minutes at ten a second: 4200)
const RE_GRACE = 100;            // positions after a restart of the server in which R cannot be told from a jump
const BACK_AGE = 20, BACK_R = 8; // R: back within this of a place of its own at least this many positions old
const MAX_HOPS = 20;
export const PACE_K = 0.9;       // a car found again after a gap: not faster than this share of the fastest known time
const GAP_SLACK = 700;           // ms
const GAP_MS = 1500;             // no position for this long: a gap
// (5 gaps since 26 Nov 2026, 3 before: what a gap can gain is held by the time they may cover, not by their number)
export const MAX_SKIPS = 5, MAX_SKIP_MS = 30000;   // gaps a race may have, and the lap time they may cover in all (by the fastest pace)
const NEAR_ROAD = 25;            // m beyond the road: a car found again must be this near the lap

// what is kept in memory of one racer while the race runs (the racer's own record r, in the race desk's stored
// state, carries what must outlive a restart: gt, gs, arm, fs, sk, skm, jp)
export function newFollow(race) {
  // (xs, zs, ys: the lap's places as they came; ss, as: when, by the sender's stamps and by the clock here; back: which of them R put there)
  return { race, n: 0, px: 0, pz: 0, pt: 0, st: null, lead: 0, S: 0, re: false, at: null, xs: [], zs: [], ys: [], ss: [], as: [], back: [], hops: 0, g0: 0, g1: 0 };
}

// gates behind a car at lap point i
function gatesBy(i) {
  let lo = 0, hi = LAP_GATES.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (LAP_GATES[m].i <= i) lo = m + 1; else hi = m; }
  return lo;
}

// near the lap's road between two of its points
function nearLap(x, z, i0, i1) {
  for (let i = i0; i <= i1; i++) if (Math.hypot(P[i][0] - x, P[i][1] - z) <= HW[i] + NEAR_ROAD) return true;
  return false;
}

// A car whose positions stopped and came again: where on the lap it is now, if the time since its last gate allows
// it to have got there (else it is left where it was). true when it moved on (by at least `min` gates).
function findAgain(r, x, z, now, min = 1) {
  if (!PT || (r.sk || 0) >= MAX_SKIPS) return false;
  const el = now - r.gs + GAP_SLACK;
  let best = r.gt;
  for (let i = r.gt > 0 ? PASS[r.gt - 1].i : 0; i < N; i++) {
    const g = gatesBy(i);
    if (g <= best) continue;
    const need = PT[g] - PT[r.gt];
    if (need * PACE_K > el || need > MAX_SKIP_MS - (r.skm || 0)) break;      // (further on only takes longer)
    if (Math.hypot(P[i][0] - x, P[i][1] - z) <= HW[i] + NEAR_ROAD) best = g;
  }
  if (best < r.gt + min) return false;
  r.sk = (r.sk || 0) + 1; r.skm = (r.skm || 0) + PT[best] - PT[r.gt];
  r.gt = best; r.gs = now;
  return true;
}

// The finish itself fell into a gap (the connection was down as the car crossed the line, and the page says so
// once it is back): believable if the lap's last part fits into the time since the last gate the server saw.
// at: when the page's word came, fin: when it says it crossed the line (both the server's clock). The earliest
// moment the car can have crossed the line, or null.
export function finishInGap(r, f, at, fin) {
  if (!PT || r.gt == null || (r.sk || 0) >= MAX_SKIPS) return null;
  // (its positions were coming at that moment: it was seen not to finish. A gap: none for 1.5 s, still or then)
  if (f && f.n && f.pt > at - GAP_MS && !(fin >= f.g0 - 500 && fin <= f.g1 + 500)) return null;
  const need = PT[PASS.length] - PT[r.gt];
  if (need > MAX_SKIP_MS - (r.skm || 0) || need * PACE_K > at - r.gs + GAP_SLACK) return null;
  return r.gs + need * PACE_K;
}

// One position of a racer. r: the racer's record, f: newFollow(), (x, z): the place, now: the server's clock,
// go: when this racer's lights went out; free: a car that is not held to the grid's launch (thrusters);
// st: the sender's own stamp of the position (ms of its clock, mod a minute), if it sent one; y: its height.
// Returns what happened: '' | 'arm' | 'start' | 'gate' | 'finish'.
export function follow(r, f, x, z, now, go, free = false, st = null, y = 0) {
  const first = f.n === 0, px = f.px, pz = f.pz;
  const d = first ? 0 : Math.hypot(x - px, z - pz), da = first ? 0 : now - f.pt;
  // The time between this position and the last. Positions come in bunches after a stall on the way, so the
  // sender's stamps say it better than their arrival does; they are believed while the sender's clock has not run
  // ahead of ours by more than a stall explains.
  let dt = da, sure = false, ds = da;
  if (!first && st != null && f.st != null) {
    ds = (((st - f.st) % 60000) + 60000) % 60000;
    const lead = Math.max(0, f.lead + ds - da);
    if (ds < 10000 && lead <= LEAD_MAX) { f.lead = lead; dt = ds; sure = true; }
    else if (ds >= 10000) ds = da;
  }
  f.S += ds;                                              // (the sender's clock, summed: driven() sets it against ours)
  const keep = () => { if (f.xs.length < KEEP_MAX) { f.xs.push(x); f.zs.push(z); f.ys.push(y); f.ss.push(f.S); f.as.push(now); } };
  if (first || da > GAP_MS) { f.g0 = first ? r.gs || 0 : f.pt; f.g1 = now; }
  if (first && r.gt != null) f.re = true;                 // (the server was restarted mid-lap: the car's path so far is not known)
  f.px = x; f.pz = z; f.pt = now; f.st = st; f.n++;
  if (r.fs != null) return '';
  // further than a car gets in that time: not driving
  const far = !first && d > (sure ? STEP_ROOM + (free ? 2 : 1) * V_MAX * dt / 1000 : Math.max(HOP, HOP_V * (da / 1000 + 0.3)));
  if (r.gt == null) {
    // ---- before the start line
    const t = (x - A[0]) * UX + (z - A[1]) * UZ, lat = -(x - A[0]) * UZ + (z - A[1]) * UX;
    const inBox = Math.abs(lat) < BOX_HALF && t <= GRID_LINE + 1 && t > GRID_LINE - BOX_BACK;
    let ev = '';
    if (inBox && !first && d < STILL) { f.at = t; if (!r.arm) { r.arm = now; ev = 'arm'; } }
    else if (r.arm && now < go - 300 && d >= STILL) { delete r.arm; f.at = null; ev = 'arm'; }        // (moving before the lights)
    if (r.arm && !free && now >= go - 300 && Math.abs(lat) < 40 && t < GL + 5) {
      const s = Math.max(0, now - Math.max(go, r.arm)) / 1000 + LAUNCH_HEAD;
      if (t - (f.at ?? GRID_LINE) > LAUNCH_ROOM + 0.5 * LAUNCH_A * s * s) { delete r.arm; f.at = null; return 'arm'; }   // (a flying start)
    }
    if (!first && !far && r.arm && now >= go) {
      if (overLine(LINE, px, pz, x, z)) { r.gt = 0; r.gs = now; ev = 'start'; }
      else if (da > GAP_MS) {
        // the start itself fell into a gap: found on the lap, as far along it as a car gets from the lights
        r.gt = 0; r.gs = Math.max(go, r.arm);
        if (findAgain(r, x, z, now)) ev = 'start';
        else if (t > GL && nearLap(x, z, 0, PASS[0].i)) { r.gs = now; ev = 'start'; }
        else { r.gt = null; delete r.gs; }
      }
    }
    if (r.gt == null) return ev;
    f.xs.length = f.zs.length = f.ys.length = f.ss.length = f.as.length = f.back.length = 0;
    keep();
    return ev;
  }
  // ---- on the lap
  keep();
  if (far) {
    // R: back on a place of its own (it passes no gate by that). Any other jump is not a car driving: its finish
    // will not be taken (a race has no other way to move a car and stay in it, src/race/race.js)
    let back = false;
    if (f.hops < MAX_HOPS) for (let j = f.xs.length - 1 - BACK_AGE; j >= 0; j--) if (Math.hypot(f.xs[j] - x, f.zs[j] - z) < BACK_R) { back = true; break; }
    if (back) { f.hops++; f.back.push(f.xs.length - 1); }
    else if (!(f.re && f.n < RE_GRACE)) { r.jp = (r.jp || 0) + 1; return 'jump'; }
    return '';
  }
  if (first || da > GAP_MS) return findAgain(r, x, z, now) ? 'gate' : '';
  let ev = '';
  for (;;) {
    const g = r.gt;
    const hit = (k) => k < PASS.length && (PASS[k].line ? overLine(PASS[k], px, pz, x, z) : throughGate(PASS[k], px, pz, x, z));
    if (hit(g)) r.gt = g + 1; else if (hit(g + 1)) r.gt = g + 2; else break;
    r.gs = now; ev = 'gate';
  }
  if (r.gt >= PASS.length) { r.fs = now; return 'finish'; }
  // a long step in a short time (the page stood still for a moment at speed): the straight line between the two
  // places can miss the gates of a bend; two of them behind the car and it is found again as after a gap
  if (!ev && d > HOP && findAgain(r, x, z, now, 2)) ev = 'gate';
  return ev;
}

// A page's stamp is taken a few ms after the moment its position is of (27 Nov 2026: the car check refused 142 of 958
// race finishes in three days, 15 in 100, whole races at once, where the record drives of the same cars read nothing).
// The stamp is the page's clock when it sends, later in the frame than the physics step, by however long the work in
// between took; on a busy page that wanders by 5 ms and more (a quarter of the pages online on 27 Nov), which is 5 to
// 10 % of a tenth of a second. Read as times, the places then seem to speed up and slow down by that much from one to
// the next, and a car at 40 m/s seems to gain and lose more in half a second than its engine gives in two: a weak car
// read 4 to 8 s over its pull at 3 to 5 ms of wander (tools/follow-test.mjs 14). The car's own path says when it was
// where: over a second of it, time against the distance driven is a smooth curve (its speed changes only so fast), so
// each stamp is set onto that curve, fitted through the stamps around it. At most JITTER_MAX away from its own stamp;
// not where the car crawls (time against distance is steep there), not across a gap in the positions or an R.
const EVEN_K = 8;                // stamps either side that the curve is fitted through
const EVEN_GAP = 400;            // ms between two positions: the curve does not reach across more
const EVEN_V = 4;                // m/s at the least over the span
const JITTER_MAX = 30;           // ms a stamp may be moved
export function evenStamps(T, xs, zs, back = []) {
  const n = T.length, out = Float64Array.from(T), s = new Float64Array(n), cut = new Uint8Array(n);
  for (let i = 1; i < n; i++) {
    const d = Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]);
    s[i] = s[i - 1] + d;
    if (T[i] - T[i - 1] > EVEN_GAP || d > HOP) cut[i] = 1;            // (the curve stops before position i)
  }
  for (const i of back) if (i >= 0 && i < n) { cut[i] = 1; if (i + 1 < n) cut[i + 1] = 1; }
  for (let i = 0; i < n; i++) {
    let a = i, b = i;
    while (a > 0 && i - a < EVEN_K && !cut[a]) a--;
    while (b < n - 1 && b - i < EVEN_K && !cut[b + 1]) b++;
    if (b - a < 2 * EVEN_K || i - a < 2 || b - i < 2) continue;
    if (s[b] - s[a] < EVEN_V * (T[b] - T[a]) / 1000) continue;
    // least squares of T = c0 + c1 u + c2 u^2, u = distance from position i over half the span's (within -1 to 1)
    const w = (s[b] - s[a]) / 2;
    let S0 = 0, S1 = 0, S2 = 0, S3 = 0, S4 = 0, Y0 = 0, Y1 = 0, Y2 = 0;
    for (let j = a; j <= b; j++) {
      const u = (s[j] - s[i]) / w, u2 = u * u, y = T[j] - T[i];
      S0++; S1 += u; S2 += u2; S3 += u2 * u; S4 += u2 * u2; Y0 += y; Y1 += y * u; Y2 += y * u2;
    }
    // (Cramer's rule on the 3 x 3 normal equations)
    const det = S0 * (S2 * S4 - S3 * S3) - S1 * (S1 * S4 - S3 * S2) + S2 * (S1 * S3 - S2 * S2);
    if (!(Math.abs(det) > 1e-9)) continue;
    const c0 = (Y0 * (S2 * S4 - S3 * S3) - S1 * (Y1 * S4 - S3 * Y2) + S2 * (Y1 * S3 - S2 * Y2)) / det;
    out[i] = T[i] + Math.max(-JITTER_MAX, Math.min(JITTER_MAX, c0));
  }
  for (let i = 1; i < n; i++) if (out[i] < out[i - 1]) out[i] = out[i - 1];
  return out;
}

// The lap as it was followed, for the judging of the car itself (src/race/plausible.js judgeDrive): its places
// `step` s apart, { xs, zs, ys, hop } (hop: the samples round an R, which are not driving), or null when too little
// of it is known (the server restarted near the end). Each position's time is the sender's own stamp, carried over
// to the clock here by the quickest way any of them came: so positions that arrive in a bunch are spread out as
// they were driven, and nothing can be claimed to have taken longer than it did by more than LEAD_MAX.
export function driven(f, step = 0.1) {
  const n = f.xs.length;
  if (n < 50) return null;
  let off = Infinity;
  for (let i = 0; i < n; i++) off = Math.min(off, f.as[i] - f.ss[i]);
  const T0 = new Float64Array(n);
  for (let i = 0; i < n; i++) { T0[i] = Math.min(f.as[i], Math.max(f.ss[i] + off, f.as[i] - LEAD_MAX)); if (i && T0[i] < T0[i - 1]) T0[i] = T0[i - 1]; }
  const T = evenStamps(T0, f.xs, f.zs, f.back);
  const ms = step * 1000, m = Math.floor((T[n - 1] - T[0]) / ms) + 1;
  if (m < 50) return null;
  const xs = new Float64Array(m), zs = new Float64Array(m), ys = new Float64Array(m), hop = new Uint8Array(m);
  for (let k = 0, j = 0; k < m; k++) {
    const t = T[0] + k * ms;
    while (j < n - 2 && T[j + 1] <= t) j++;
    const span = T[j + 1] - T[j], u = span > 0 ? Math.min(1, Math.max(0, (t - T[j]) / span)) : 1;
    xs[k] = f.xs[j] + (f.xs[j + 1] - f.xs[j]) * u; zs[k] = f.zs[j] + (f.zs[j + 1] - f.zs[j]) * u; ys[k] = f.ys[j] + (f.ys[j + 1] - f.ys[j]) * u;
  }
  for (const i of f.back) { const k0 = Math.round((T[i] - T[0]) / ms); for (let k = Math.max(0, k0 - 14); k < Math.min(m, k0 + 14); k++) hop[k] = 1; }
  return { xs, zs, ys, hop };
}
