// A car going slowly over an edge (Martin, 26 Nov 2026: "when driving down slowly from a roof or any sharp
// cliff/drop the front of the car starts slowly falling down while the rear wheels still drive off the roof and
// over the edge. If you go fast then the car is just flying straight").
//
// The body in physics.js rides on the mean of the ground under its four wheels, so the moment one axle was past
// an edge the whole car fell, level, and at walking pace its tail sank through the roof it was still over (an
// 8 m drop at 20 km/h: 1.06 m down before the rear wheels reached the edge). Here the wheels still on top carry
// the car: the end that hangs falls about them as gravity turns it (G / wheelbase, about 4 rad/s2), the belly
// comes to rest on the edge, and once the car's weight is past the edge it tips over it and the wheels behind
// lift. When the last of it is past the edge the car is let go into the air with the turning it has, lands on
// its nose and drops back onto its wheels. The same for the tail of a car reversing off, and for a side.
//
// Fast, the time from one axle to the other is short (50 km/h: 0.19 s, 4 degrees), and the pull is faded too, from
// all of it below V_FULL to LEAST of it from V_NONE on, never none (Martin, 27 Nov 2026: "let it act also on higher
// speeds as well, just a very very small nose dive until the end"): off an 8 m edge the nose dips about 4 degrees
// in the air at 60 km/h, 2 at 100, 1.5 at 160, and the car comes down on its wheels as from any jump (physics.js
// TIP_SMALL). Nothing here runs unless the ground under the four wheels differs by more than HANG, which no road,
// kerb or bank does, nor anywhere on the Toomemägi lap's or the Raadi stage's line at 40 to 130 km/h.

const G = 9.81;
export const HANG = 0.55;                    // m a wheel's ground lies below the others' for it to hang
const V_FULL = 30 / 3.6, V_NONE = 55 / 3.6;  // full below, down to the least by V_NONE (m/s)
const LEAST = 0.2;                           // and that much of it at any speed above
export const CLEAR = 0.16;                          // m from the ground to the car's belly
const LET_GO = 0.08;                         // m of car still over the edge when it is let go
const D_MAX = 1.3, W_MAX = 3.5;              // most it tips before the air has it (rad), fastest (rad/s)
export const TIPPED = 0.3;                   // car.tipped as it is let go (physics.js: and the pace it starts to fall back at)
const STEEP = 1.0;                           // the top's steepest slope along the car (a 45 degree roof)

const at = (world, x, z, y) => (world.groundAt ? world.groundAt(x, z, y) : world.heightAt(x, z));
export function edgeFade(car) {
  const v = Math.hypot(car.vx, car.vy);
  return v <= V_FULL ? 1 : v >= V_NONE ? LEAST : LEAST + ((1 - LEAST) * (V_NONE - v)) / (V_NONE - V_FULL);
}

// the wheels that carry and the wheels that hang, as places in h = [FL, FR, RL, RR]: pitch with the front
// hanging, with the rear hanging, roll with the right side hanging, with the left
const CARRY = [[2, 3], [0, 1], [0, 2], [1, 3]], HUNG = [[0, 1], [2, 3], [1, 3], [0, 2]];
const which = (t) => (t.ax === 0 ? (t.sg > 0 ? 0 : 1) : t.sg > 0 ? 2 : 3);

// Does an edge run under the car? h: the ground under the wheels [FL, FR, RL, RR] (one wheel alone over an edge
// is given the height the other three stand at, so the car stays on three); sets car.tip when an axle or a side
// hangs. (fx, fz) forward, (rx, rz) to the right, gy the height the ground is asked at.
// landing: a car in the air that has come down to the highest of that ground (on the edge of a roof with one end
// or one side: those wheels have landed, the mean of the four has not).
export function edgeStart(car, world, h, fx, fz, rx, rz, gy, landing = false) {
  if (car.inWater || edgeFade(car) <= 0 || (!landing && (car.airborne || car.load < 0.3))) return;
  const s = car.spec, L = s.wheelbase, hw = s.track / 2;
  const mx = car.x + fx * (car.a - L / 2), mz = car.z + fz * (car.a - L / 2);       // the middle of the four wheels
  const hC = at(world, mx, mz, gy);
  // a pair hangs when both its wheels lie HANG below the plane of the other pair and the middle (a wheel is the
  // mirror of the one across the middle), and that other pair is truly on top: the middle of its line stands
  // where its wheels do, and the car's middle is no steeper off than a roof
  for (let k = 0; k < 4; k++) {
    const [c1, c2] = CARRY[k], [g1, g2] = HUNG[k];
    if (2 * hC - h[3 - g1] - h[g1] <= HANG || 2 * hC - h[3 - g2] - h[g2] <= HANG) continue;
    const pitchAx = k < 2, sg = k % 2 === 0 ? 1 : -1, m = pitchAx ? L / 2 : hw;
    const ux = (pitchAx ? fx : rx) * sg, uz = (pitchAx ? fz : rz) * sg;
    const hS = (h[c1] + h[c2]) / 2, hL = at(world, mx - ux * m, mz - uz * m, gy);
    if (Math.abs(hL - hS) > HANG / 2 || Math.abs(hC - hL) > m * STEEP + 0.1) continue;
    // (the top's slope along the car, nose up or left side high as the body's angles are; d: how far the hanging
    // end is down already, the body's own lean as it comes to the edge)
    const ref = pitchAx ? Math.atan2(sg * (hC - hL), m) : Math.atan2(sg * (hL - hC), m);
    const d = pitchAx ? sg * (ref - car.pitch) : sg * (car.roll - ref);
    // (a body that lies quite otherwise than the top does, on the facets of a roof: no edge it is driving off)
    if (d < -0.15 || d > 0.4) continue;
    car.tip = { ax: pitchAx ? 0 : 1, sg, ref, d: Math.max(-0.1, Math.min(0.3, d)), w: 0, hS, h1: h[c1], h2: h[c2], dm: 0, last: car.time };
    return;
  }
  // one wheel alone: the lowest, HANG below the plane of the other three, which the middle lies in too
  let i = 0;
  for (let k = 1; k < 4; k++) if (h[k] < h[i]) i = k;
  const a1 = i ^ 1, a2 = i ^ 2, e = h[a1] + h[a2] - h[3 - i];
  if (e - h[i] > HANG && Math.abs(hC - (h[a1] + h[a2]) / 2) < 0.15) h[i] = e;
}

const out = { ax: 0, y: 0, gp: 0, gr: 0, ang: 0, rate: 0 };
// The car is let go into the air, turning as it was.
// below: the ground under its hanging wheels. Where that is nearer under the car than its nose (or its side) will
// reach as it lies now (a step from one roof down to the next, a low terrace), it has no room to fly on turning
// and come down on that end: it is let go with its turning stopped, and is simply on the ground below.
function letGo(car, t, below) {
  car.tip = null; car.lastGround = null;
  const reach = (t.ax === 0 ? car.halfLen : car.halfWid) * Math.sin(Math.min(D_MAX, Math.max(0, t.d)));
  if (car.hy - below < reach) { if (t.ax === 0) car.pitchRate = 0; else car.rollRate = 0; return null; }
  const w = Math.min(W_MAX, Math.max(0, t.w));
  if (t.ax === 0) car.pitchRate = -t.sg * w; else car.rollRate = t.sg * w;
  car.tipped = TIPPED;
  return null;
}

// A step of a car that has an end over an edge. Returns null when that is over (the hanging wheels have met
// ground, or the car has gone into the air), else what the physics is to go by: y, the ground's height under the
// car's middle as the body lies; gp and gr, the slope the tyres feel; ax, ang and rate, the body's angle about
// the axis it tips on (0 pitch, 1 roll) and its turning.
export function edgeStep(car, world, h, fx, fz, rx, rz, dt) {
  const t = car.tip, s = car.spec, L = s.wheelbase, hw = s.track / 2;
  // (a kickflip, a crash or a put-back in between: what was is no more)
  if (car.time - t.last > 0.1 || car.airborne || car.inWater) { car.tip = null; return null; }
  t.last = car.time;
  const k = which(t), [c1, c2] = CARRY[k], [g1, g2] = HUNG[k], pitchAx = t.ax === 0;
  const f = edgeFade(car), below = Math.max(h[g1], h[g2]);
  // a carrying wheel has gone over as well (the car turned, or the last of it has passed)
  if (f <= 0 || h[c1] < t.h1 - HANG || h[c2] < t.h2 - HANG) return letGo(car, t, below);
  const hS = (h[c1] + h[c2]) / 2;
  t.h1 = h[c1]; t.h2 = h[c2]; t.hS = hS;
  const span = pitchAx ? L : 2 * hw, m = span / 2;
  const arm = pitchAx ? (t.sg > 0 ? car.b : car.a) : hw;                 // from the carrying wheels to the car's weight
  const k2 = pitchAx ? car.a * car.b : 0.3 + (s.cgHeight ?? 0.5) ** 2;   // how unwilling the body is to turn (m2)
  const ux = (pitchAx ? fx : rx) * t.sg, uz = (pitchAx ? fz : rz) * t.sg;
  const mx = car.x + fx * (car.a - L / 2), mz = car.z + fz * (car.a - L / 2);
  const sx = mx - ux * m, sz = mz - uz * m;
  // where the edge is, from the carrying wheels towards the hanging ones
  const beta = pitchAx ? t.sg * t.ref : -t.sg * t.ref, tb = Math.tan(beta), gy = hS + 0.4;
  const onTop = (d) => at(world, sx + ux * d, sz + uz * d, gy) > hS + d * tb - HANG / 2;
  if (!onTop(0)) return letGo(car, t, below);
  let se = span;
  if (!onTop(span)) {
    let lo = 0, hi = span;
    for (let i = 0; i < 6; i++) { const mid = (lo + hi) / 2; if (onTop(mid)) lo = mid; else hi = mid; }
    se = (lo + hi) / 2;
  }
  if (se < LET_GO) return letGo(car, t, below);
  // gravity turns the hanging end down: about the carrying wheels, until the belly lies on the edge; about the
  // edge once the car's weight is past it
  const dm = Math.asin(Math.min(1, CLEAR / se));
  const lever = t.d >= dm - 1e-3 && se < arm ? arm - se : arm;
  t.w += ((f * G * lever * Math.cos(beta - t.d)) / (k2 + lever * lever)) * dt;
  t.d += t.w * dt;
  if (se >= arm && t.d > dm) { t.d = dm; t.w = Math.min(t.w, Math.max(0, (dm - t.dm) / dt)); }
  if (t.d > D_MAX) { t.d = D_MAX; t.w = 0; }
  t.w = Math.min(t.w, W_MAX); t.dm = dm;
  // the ground line under the body: through the carrying wheels, or lifted to lie on the edge by the belly
  let ang = beta - t.d, sin = Math.sin(ang);
  let y = Math.max(hS + m * sin, hS + se * tb - CLEAR + (m - se) * sin);
  // the end of the body that hangs has come down on what is below (a lower roof a step down): it rests there
  const far = span + (pitchAx ? car.halfLen - (t.sg > 0 ? car.a : car.b) : car.halfWid - hw), reach = far * Math.cos(ang);
  const under = at(world, sx + ux * reach, sz + uz * reach, gy), end = y + (far - m) * sin;
  if (end < under) {
    t.d = Math.max(-0.1, t.d - Math.min(0.2, (under - end) / far)); t.w = 0;
    ang = beta - t.d; sin = Math.sin(ang);
    y = Math.max(hS + m * sin, hS + se * tb - CLEAR + (m - se) * sin);
  }
  // the hanging wheels have come down on something
  if (Math.max(h[g1], h[g2]) >= y + m * sin - 0.03) { car.tip = null; return null; }
  const past = se < arm ? (arm - se) / arm : 0;      // how much of the car's weight is over the edge: it slides on
  out.ax = t.ax; out.y = y;
  if (pitchAx) {
    out.ang = t.ref - t.sg * t.d; out.rate = -t.sg * t.w;
    out.gp = t.ref - t.sg * t.d * past; out.gr = Math.atan2(h[c1] - h[c2], 2 * hw);
  } else {
    out.ang = t.ref + t.sg * t.d; out.rate = t.sg * t.w;
    out.gr = t.ref + t.sg * t.d * past; out.gp = Math.atan2(h[c1] - h[c2], L);
  }
  return out;
}
