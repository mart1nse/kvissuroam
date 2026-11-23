// Stones the car feels as shapes, not as walls (Martin, 23 Nov 2026, of the Raadi park's boulders: "Lets make
// the stones a bit playful. Check what could be their approach angle and make the car jump up its front tires
// or tire on hitting from the side and it angles the car. If the front tires are in the air then the floor can
// hit it or rear tires ... a larger and hence higher stone following a smaller stone ... make it possible to hit
// the next stone as well if it indeed hits it and then bump it up or tilt. Try to go for real physics").
//
// A stone is a dome on the ground (world.addStones, world.stonesNear): an ellipse in plan, { x, z, a, b (half
// axes), cs, sn (its turn), h, gy (the ground under it) }, rising straight up RIM of h at its edge and domed to
// (RIM + DOME) h in the middle, as the boulders are drawn (src/world/raadipark.js).
//
// What the car has that can meet it:
//  - four wheels. A tyre rolls up whatever is under it: the wheel's height over the stone is that of a disc of
//    its radius on the dome (stoneWheels), and goes into the ground heights the suspension already rides on. On
//    top of that the one wheel that is on a stone pushes its own corner of the body: its spring past the bump
//    stop and its damper as it is thrown up, which hops and tilts the car, and the stone's face pushes the wheel
//    back, which slows the car and turns it towards that side (stoneForces).
//  - the floor, CLEAR above the ground between the axles and rising to the bumpers' lower edges (the approach and
//    departure angles). A stone higher than the floor above it lifts the car there, tilts it about its middle
//    and drags on it; a car can sit on one with its wheels hanging.
//  - the outline of the body: the bumpers at their lower edge, the sills, the tyres' sides. A stone is solid to
//    it only as far as the stone is wide AT THAT HEIGHT (stoneEdges), so a low stone goes under the bumper to the
//    wheels and the floor, a tall one is a wall, and with the nose in the air (a wheel up on a smaller stone,
//    or off a crest) the next, taller one goes under the bumper too and meets the floor or the rear wheels.
// Nothing here runs unless a stone is within a few metres of the car.

const G = 9.81;
const RIM = 0.3, DOME = 0.97;
export const STONE_TOP = RIM + DOME;
const LIP_F = 0.13, LIP_R = 0.18;          // the bumpers' lower edges above the floor, front and rear (m)
const TYRE_CLIMB = 0.75;                   // of its radius: what a tyre's side still rolls up rather than hits
// the floor on a stone: stiffness (m/s2 of the whole car per m) and damping (per s). Not rigid: undertrays, sills
// and bumpers give, and the car sinks 2 cm onto a stone it sits on.
const K_FLOOR = 450, C_FLOOR = 14;
const FLOOR_UP = 1.6;                        // m/s: the fastest a stone lifts the floor
const MU_FLOOR = 0.45, F_MAX = 45;         // steel on granite; the most the floor is pushed (m/s2 of the whole car)
const SIT = 0.75;                          // of the car's weight: the most a stone carries of a car hardly moving
const W_MAX = 35;                          // and the most one wheel passes on to the body
const GIVE = 0.06;                         // a stone no more than this above a bumper's or sill's edge is ridden over, not hit
// how the body rocks on its springs after a knock: pitch and roll, each a frequency (rad/s) and a damping ratio
const WP = 2 * Math.PI * 1.5, ZP = 0.4, WR = 2 * Math.PI * 1.8, ZR = 0.38;
const KICK_P = 0.3, KICK_R = 0.4;          // and the most it rocks (rad)
const AIR_P = 0.8, AIR_R = 1.1;            // the most a stone turns a car that is in the air (rad/s)
// a disc on the dome, sampled along the way it rolls: [distance from the hub in radii, how far the tyre is off
// the ground there in radii]
const DISC = [[0, 0], [0.5, 0.134], [-0.5, 0.134], [0.85, 0.473], [-0.85, 0.473]];

const state = (car) => car.stone || (car.stone = {
  list: [], lift: [0, 0, 0, 0], rate: [0, 0, 0, 0], by: [null, null, null, null],
  kP: 0, kPv: 0, kR: 0, kRv: 0, tqP: 0, tqR: 0, dvx: 0, dvz: 0, floor: false,
});

// the stone's surface above its own ground at (px, pz); 0 beside it
function domeAt(st, px, pz) {
  const dx = px - st.x, dz = pz - st.z, u = (dx * st.cs - dz * st.sn) / st.a, v = (dx * st.sn + dz * st.cs) / st.b, q2 = u * u + v * v;
  return q2 >= 1 ? 0 : st.h * (RIM + DOME * Math.sqrt(1 - q2));
}

// The stones near the car and how high each wheel stands on them: returns the car's stone state with lift[4]
// (front left, front right, rear left, rear right) to add to the ground under the wheels, or null with none near.
export function stoneWheels(car, world, spec, fx, fz, rx, rz, W, dt) {
  const S = car.stone;
  if (!world.stoneCount && !S) return null;
  const st = S || state(car);
  world.stonesNear(car.x, car.z, car.halfLen + 2.2, st.list);
  if (!st.list.length) {
    for (let k = 0; k < 4; k++) { st.lift[k] = 0; st.rate[k] = 0; st.by[k] = null; }
    return null;
  }
  const rw = spec.wheelRadius;
  for (let k = 0; k < 4; k++) {
    const px = W[k * 2], pz = W[k * 2 + 1];
    let best = 0, by = null;
    for (let i = 0; i < st.list.length; i++) {
      const s = st.list[i], dx = px - s.x, dz = pz - s.z, R = Math.max(s.a, s.b) + rw;
      if (dx * dx + dz * dz > R * R) continue;
      for (let q = 0; q < DISC.length; q++) {
        const o = DISC[q][0] * rw, y = domeAt(s, px + fx * o, pz + fz * o) - DISC[q][1] * rw;
        if (y > best) { best = y; by = s; }
      }
      // (and the tyre's width, for a car going sideways onto it)
      for (let o = -0.1; o < 0.2; o += 0.2) { const y = domeAt(s, px + rx * o, pz + rz * o); if (y > best) { best = y; by = s; } }
    }
    st.rate[k] = (best - st.lift[k]) / dt;
    st.lift[k] = best; st.by[k] = by;
  }
  return st;
}

// The stones as circles for the body's outline to hit (pushed on to `out` as x, z, radius, like tree trunks): each
// as wide as it is at the height of the body's lower edge where the two would meet.
export function stoneEdges(car, st, spec, fx, fz, rx, rz, hl, hwid, out) {
  const rw = spec.wheelRadius, c0 = spec.clearance ?? 0.5 * rw, a = car.a, b = car.b;
  for (let i = 0; i < st.list.length; i++) {
    const s = st.list[i], dx = s.x - car.x, dz = s.z - car.z, lx = dx * fx + dz * fz, ly = dx * rx + dz * rz, R0 = Math.sqrt(s.a * s.b);
    if (Math.abs(lx) > hl + R0 + 0.1 || Math.abs(ly) > hwid + R0 + 0.1) continue;
    const cx = Math.max(-hl, Math.min(hl, lx)), cy = Math.max(-hwid, Math.min(hwid, ly));
    let e;
    if (cx === lx && cy === ly) {
      // under the car: the floor's affair, unless it stands so far above the floor that it cannot be there
      e = lx > a ? c0 + (lx - a) / (hl - a) * LIP_F : lx < -b ? c0 + (-b - lx) / (hl - b) * LIP_R : c0;
      if (s.gy + s.h * STONE_TOP - (car.hy + lx * car.pitch - ly * car.roll + e) < 0.3) continue;
    } else if (cx !== lx) e = c0 + (lx > 0 ? LIP_F : LIP_R);                             // the nose or the tail
    else e = Math.abs(cx - a) < 0.4 || Math.abs(cx + b) < 0.4 ? TYRE_CLIMB * rw : c0;      // a tyre's side, or the sill
    const t = (car.hy + cx * car.pitch - cy * car.roll + e + GIVE - s.gy) / s.h;
    if (t >= STONE_TOP) continue;
    const R = R0 * (t <= RIM ? 1 : Math.sqrt(1 - ((t - RIM) / DOME) ** 2)) - 0.06;
    if (R > 0.04) out.push(s.x, s.z, R);
  }
}

// What the stones do to the car this step: the wheels on them, and the floor. H: the ground under the four wheels
// with the stones in it. K: the suspension's own figures { SPRING, DAMP, STATIC, BUMP }. Changes car.vyUp and
// car.yawRate, leaves the change of the car's world velocity in st.dvx, st.dvz, and the turning of the body in
// st.tqP, st.tqR for stoneKick.
export function stoneForces(car, st, spec, dt, fx, fz, rx, rz, hl, hwid, H, K, wvx, wvz) {
  const a = car.a, b = car.b, hw = spec.track / 2, rw = spec.wheelRadius, c0 = spec.clearance ?? 0.5 * rw;
  const KP2 = (0.42 * spec.wheelbase) ** 2, KR2 = (0.37 * spec.track) ** 2;       // how hard the body is to tip (m2)
  const mIz = spec.mass / car.iz, pitch = car.pitch, roll = car.roll;
  let tqP = 0, tqR = 0, ax = 0, az = 0, yawAcc = 0, up = 0, hard = 0;
  st.floor = false;
  // ---- the wheels
  for (let k = 0; k < 4; k++) {
    if (st.lift[k] < 0.02) continue;
    const lx = k < 2 ? a : -b, ly = k % 2 ? hw : -hw;
    const comp = H[k] + K.STATIC - (car.hy + lx * pitch - ly * roll);         // this wheel's spring travel in use
    if (comp <= 0) continue;                                                  // hanging clear of it
    const stop = comp > K.BUMP ? 6 * K.SPRING * (comp - K.BUMP) / 4 : 0;
    const damp = K.DAMP / 4 * Math.min(6, Math.max(0, st.rate[k]));
    // (with all four in the air the car's own springs are not counted at all: this one's is, here)
    const own = car.airborne ? K.SPRING * comp / 4 + damp : 0;
    const F = Math.min(W_MAX, stop + damp + own);
    up += Math.min(W_MAX, stop + own);
    tqP += F * lx / KP2; tqR -= F * ly / KR2;
    // the stone's face against the tyre: back along the line from the stone's middle, by how steeply it is climbing
    const ox = fx * lx + rx * ly, oz = fz * lx + rz * ly, pvx = wvx - car.yawRate * oz, pvz = wvz + car.yawRate * ox, sp = Math.hypot(pvx, pvz);
    const s = st.by[k];
    let ex = car.x + ox - s.x, ez = car.z + oz - s.z;
    const el = Math.hypot(ex, ez);
    if (el > 1e-3 && st.rate[k] > 0) {
      ex /= el; ez /= el;
      if (pvx * ex + pvz * ez < 0) {
        const Fh = F * Math.min(1.8, st.rate[k] / Math.max(2, sp));
        ax += ex * Fh; az += ez * Fh; yawAcc += (ox * ez - oz * ex) * Fh * mIz;
      }
    }
    hard = Math.max(hard, F / 40);
  }
  // ---- the floor
  const pr = car.pitchRate || 0, rr = car.rollRate || 0;
  for (let i = 0; i < st.list.length; i++) {
    const s = st.list[i], dx = s.x - car.x, dz = s.z - car.z, R = Math.max(s.a, s.b);
    if (Math.abs(dx * fx + dz * fz) > hl + R || Math.abs(dx * rx + dz * rz) > hwid + R) continue;
    let pen = 0, px = 0, py = 0, ox = 0, oz = 0, gx = 0, gz = 0;
    for (let q = 0; q < 5; q++) {
      // its top and four points half way down its sides
      const u = q === 1 ? 0.55 * s.a : q === 2 ? -0.55 * s.a : 0, v = q === 3 ? 0.55 * s.b : q === 4 ? -0.55 * s.b : 0;
      const sx = u * s.cs + v * s.sn, sz = -u * s.sn + v * s.cs;
      const wx = dx + sx, wz = dz + sz, lx = wx * fx + wz * fz, ly = wx * rx + wz * rz;
      if (Math.abs(lx) > hl || Math.abs(ly) > hwid) continue;
      const clr = lx > a ? c0 + (lx - a) / (hl - a) * LIP_F : lx < -b ? c0 + (-b - lx) / (hl - b) * LIP_R : c0;
      const p = s.gy + s.h * (RIM + DOME * (q ? 0.835 : 1)) - (car.hy + lx * pitch - ly * roll + clr);
      if (p > pen) { pen = p; px = lx; py = ly; ox = wx; oz = wz; gx = sx; gz = sz; }
    }
    if (pen <= 0) continue;
    st.floor = true;
    const pvx = wvx - car.yawRate * oz, pvz = wvz + car.yawRate * ox, sp = Math.hypot(pvx, pvz);
    // (at a crawl the stone takes no more than SIT of the car's weight and hardly drags: a car hung up on one
    // keeps a quarter of its weight on its tyres and works itself off in a couple of seconds, not a minute)
    const F = Math.min(SIT * G + (F_MAX - SIT * G) * Math.min(1, Math.max(0, sp - 1) / 3), K_FLOOR * pen + C_FLOOR * Math.max(0, -(car.vyUp + px * pr - py * rr)));
    up += F;
    tqP += F * px / KP2; tqR -= F * py / KR2;
    // it drags on the floor, and where the floor is on the stone's side the stone pushes it away as well
    if (sp > 0.05) {
      const f = Math.min(MU_FLOOR * F * Math.min(1, sp / 1.5), 0.5 * sp / dt);
      ax -= pvx / sp * f; az -= pvz / sp * f; yawAcc += (oz * pvx - ox * pvz) / sp * f * mIz;
    }
    const gl = Math.hypot(gx, gz);
    if (gl > 1e-3) {
      const Fh = F * 0.6, ex = gx / gl, ez = gz / gl;
      ax += ex * Fh; az += ez * Fh; yawAcc += (ox * ez - oz * ex) * Fh * mIz;
    }
    hard = Math.max(hard, F / 50);
  }
  car.vyUp += up * dt;
  // (a floor ridden up a stone's dome rises with it, but the stone does not throw it higher than the dome would
  // lift it at a run: up to FLOOR_UP m/s; the rest of the hit goes into the scrape)
  if (st.floor && car.vyUp > FLOOR_UP) car.vyUp = FLOOR_UP;
  car.yawRate += Math.max(-6, Math.min(6, yawAcc)) * dt;
  st.dvx = ax * dt; st.dvz = az * dt;
  st.tqP = tqP; st.tqR = tqR;
  if (car.airborne) {
    // in the air (or sat on a stone with the wheels hanging) the body turns freely under the push
    // (as far as AIR_P, AIR_R rad/s: a car thrown by a stone noses over or leans, it does not tumble)
    car.pitchRate = Math.max(-AIR_P, Math.min(AIR_P, (car.pitchRate || 0) + tqP * dt)); car.rollRate = Math.max(-AIR_R, Math.min(AIR_R, (car.rollRate || 0) + tqR * dt));
    if (st.floor) { const k = Math.exp(-dt * 5); car.pitchRate *= k; car.rollRate *= k; }
  }
  if (hard > 0.08) {
    car.jolt = Math.max(car.jolt || 0, Math.min(1, hard));
    car.kerbHit = Math.max(car.kerbHit || 0, Math.min(1.2, hard * 0.8));
  }
}

// The body rocking on its springs after a knock from a stone: its extra pitch and roll (st.kP, st.kR), which the
// attitude adds to what the ground gives. Run every step while the car has met a stone.
export function stoneKick(car, dt) {
  const st = car.stone;
  if (!st) return;
  const tp = car.airborne ? 0 : st.tqP, tr = car.airborne ? 0 : st.tqR;
  st.tqP = st.tqR = 0;
  st.kPv += (tp - WP * WP * st.kP - 2 * ZP * WP * st.kPv) * dt; st.kP += st.kPv * dt;
  st.kRv += (tr - WR * WR * st.kR - 2 * ZR * WR * st.kRv) * dt; st.kR += st.kRv * dt;
  if (Math.abs(st.kP) > KICK_P) { st.kP = Math.sign(st.kP) * KICK_P; st.kPv = 0; }
  if (Math.abs(st.kR) > KICK_R) { st.kR = Math.sign(st.kR) * KICK_R; st.kRv = 0; }
}
