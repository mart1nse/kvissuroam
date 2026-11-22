// Vehicle dynamics: a planar single-track ("bicycle") model with load transfer,
// a sprung body that can leave the ground, friction circles, a simple automatic gearbox and SDF collisions. Pure logic,
// no rendering, so it also runs in Node for the performance calibration test.
//
// Frames: world x = east, z = south, y = up. Heading `yaw` is clockwise from
// north. Body frame: vx forward, vy to the right, yawRate clockwise positive.

const G = 9.81;
const LAT_KEEP = 0.4;            // sideways grip a spinning tyre always keeps (share of peak)
const SHAFT_DECAY = 0.8;         // turbine spin-down after a lift (1/s)
const CATCH = 0.55;               // how much of the opposite lock eases off as a caught slide swings back
const CATCH_T = 0.3;             // ...looking this far ahead (s)
const CATCH_FLICK_KMH = 45;      // ...but not below about this speed on spinning rear wheels under throttle (a figure eight)
const TC_FLOOR_KMH = 40;          // traction control lets the floored tyres spin below this speed (fully back 10 km/h higher)
const RECOVER = 0.8;             // how much of the automatic opposite lock goes once a slide starts coming back
const CASTER = 0.45;             // how far a released wheel follows the slide
const HB_REV_UP = 9000;         // rpm/s: how fast a free engine (clutch out on the handbrake) revs up at full throttle
const HB_HOLD_T = 0.9;          // s: how long the revs are kept up on the handbrake with the throttle closed
const HB_DUMP = 0.6;            // share of the engine-over-wheels speed that turns into wheelspin when that clutch drops
const HB_DUMP_MAX = 6;          // m/s: ...and the most of it
const HOLD_FOLLOW = 0.15;        // ...and how far it still does while the driver keeps steering into the turn
// Turn-in give-way (Martin 2026-11-22, the default since he tried it as ?turnin=high; ?turnin=normal for the old fixed
// HOLD_FOLLOW): held into the turn as the tail steps out, the wheels start where a
// released wheel would be (CASTER) and give way to the driver over TURNIN_HOLD_T, ending at TURNIN_END, so a short
// hold still lets the car catch itself and a stubborn one gets nearly full lock into the turn; switched into the
// slide from opposite lock or from a released wheel they wind in over TURNIN_SWAP_T.
const TURNIN_HOLD_T = 1.0, TURNIN_SWAP_T = 0.5, TURNIN_END = 0.05;
let turnInHigh = true;
// ?inward=1 (Martin 2026-11-22, on trial): a key (or a stick pushed fully over) held into the turn (not against a slide) for longer than INWARD_WAIT
// turns the wheels past the speed's grip lock, up to full lock over INWARD_T, so a stubborn hold in understeer
// scrubs the nose round instead of stopping at the limit. A steering wheel is not affected.
const INWARD_WAIT = 0.6, INWARD_T = 1.2;
// ...up to no more than this lock at this speed (km/h, deg): full lock to 60 km/h, then easing down to a degree and a
// half at 170, drawn by Martin over the bZ4X plot (2026-11-22), halfway between full lock and the grip lock
const INWARD_CAP = [[0, 34.4], [60, 34.4], [70, 33.3], [80, 30.5], [90, 28], [100, 25], [110, 21], [120, 16], [130, 10.5], [140, 7.5], [150, 4.5], [160, 3], [170, 1.5], [400, 0.5]];
const inwardCap = (kmh) => { for (let i = 1; i < INWARD_CAP.length; i++) { const [v1, a1] = INWARD_CAP[i]; if (kmh <= v1) { const [v0, a0] = INWARD_CAP[i - 1]; return (a0 + (a1 - a0) * (kmh - v0) / (v1 - v0)) * Math.PI / 180; } } return 0; };
let inwardOn = false;
export function setInward(on) { inwardOn = !!on; }
// Manual starts (Martin 2026-11-22, the default since he tried them as ?launch=1; ?launch=0 brings back the
// torque converter): every car with an engine pulls away like a manual
// instead of through the torque converter: no converter holding the engine at a stall speed and no torque
// multiplication; once the clutch is in the engine turns with the wheels.
// Floored from a standstill the clutch is dropped at LAUNCH_SHARE of the way from idle to the redline (about
// 3250 rpm on the F40; ?launch=<rpm> sets the revs): the flywheel's revs kick the rears into wheelspin at once
// (as the handbrake clutch does, HB_DUMP), and the clutch slips at those revs for CLUTCH_SLIP_T while it
// bites, so the turbos keep spooling, then over CLUTCH_FADE_T the engine is pulled down to the wheels.
// ?launch=idle is the gentler first try: as if creeping in first at idle with the clutch already in.
const LAUNCH_SHARE = 1 / 3, CLUTCH_SLIP_T = 0.6, CLUTCH_FADE_T = 0.8;
// engine.clutchSlip (the F40; ?slip=1 for every car) (Martin 2026-11-22: a donut whose revs had sagged bogged and wound up slowly, as the launch
// did): floored in first the driver keeps slipping the clutch, so the engine never falls below the drop revs
// (for a turbo engine at least where its boost is full)
// while the wheels turn slower than that. Like the converter's stall speed, but with no torque multiplication.
let launchManual = true, launchRpm = null;    // launchRpm: null = a third of the way up, 0 = from idle
let clutchSlip = false;
export function setLaunch(on, rpm = null, slip = false) { launchManual = !!on; launchRpm = rpm; clutchSlip = !!slip; }
export function setTurnIn(mode) { turnInHigh = mode === 'high'; }
const LON_SHARE = 0.7;           // how much cornering eats into traction (1 = full friction circle)
const SPIN_YAW = 0.04;          // left/right traction imbalance while the wheels spin
const DONUT = 0.4;              // how firmly a held donut is kept going (share of m*g*L as yaw moment)
const DONUT_LO = 0.6, DONUT_HI = 1.1;    // ...the slide angle band it keeps the car in (rad)
const DONUT_WAIT = 0.3;          // ...and only starts pushing a car round this long after it is floored (s)
const DONUT_SWAY = 0.5;          // ...how much the hold wanders in between
const DONUT_LEAD = 0.3;          // ...judged this far ahead (s)
const DONUT_SPIN = 2.4;          // ...and pushes only while the car turns slower than this (rad/s; a held donut turns 90-120 deg/s)
const DONUT_PUSH_KMH = 6, DONUT_PUSH_RAMP = 12;   // ...and starts the tail round only above this speed, fully this much faster (km/h)...
const DONUT_TURNING = 0.6;       // ...unless the car already turns faster than this (rad/s): a donut that has slowed is kept going
const DONUT_START = 0.5, DONUT_RISE = 1;   // ...until a donut is under way, its push is this much gentler and rises at most this much a second
const DONUT_BOG_KMH = 5, DONUT_BOG_PUSH = 0.5, DONUT_BOG_RISE = 0.8, DONUT_BOG_T = 1.4;   // ...one that bogs below this pace restarts this gently, for this long after (s)...
const DONUT_BOG_YAW = 0.8;        // ...or turning slower than this (rad/s)
const DONUT_LIFT_T = 2;          // ...and after a lift mid donut it comes back softly, for this long (s)...
const LIFT_OVER = 0.2;           // ...pushed no faster than this above the rate it turned at before (rad/s)...
const LIFT_KICK = 0.6;           // ...and its whip limit (KICK_A) this much lower
const DONUT_BOG_FROM = 18;       // ...when the donut was begun from a run at more than this (km/h)
const DONUT_SETTLE = 0.15;       // ...a donut being under way once the tail has been out in its band this long, the same way round (s)
const KICK_A = 2.2, KICK_BAND = 1.0, KICK_TAU = 0.04;   // ...and it eases off while the car already swings its way faster than KICK_A, gone at KICK_A + KICK_BAND (rad/s2)
const DONUT_EASE = 4;            // ...its moment changing at most this much a second (share of DONUT)
const EV_SLIDE_REAR = 0.7;
// The donut helper (the yaw push that holds a donut in its band, with its ease-in, softening and wander, and the
// twin-motor EVs' rear shift in a slide) is off for every car since Martin drove them without it (2026-11-22: the
// manual cars light their tyres up, so the driver modulates a donut himself, and it felt more natural). ?donut=1
// brings it back for comparison.
let donutHelp = false;
export function setDonutHelp(on) { donutHelp = !!on; }
// Burnouts (brake and throttle together in a rear-driven car under 30 km/h, Martin 2026-11-21)
const BURN_REAR = 0.4;           // how much less the rear brakes are held than in a stop...
const BURN_FEEL = 0.25;          // ...once the driver has felt for it this long (s)
const BURN_BITE = 0.3, BURN_BITE_T = 0.8;   // the brake's first squeeze, and how long it takes to hold fully (s)
const BURN_MELT = 0.45;          // how much grip the hot, smoking rear tread loses
const BURN_PRESS = 0.6;          // ...brake pedal from which it heats fully
const BURN_HEAT_T = 0.6, BURN_COOL_T = 0.4;   // ...how fast it heats and cools (s)
const BURN_SLIDE_V = 0.05;       // locked front tyres stick below this speed (m/s)
const BURN_SLIDE_KMH = 5, BURN_SLIDE_T = 9;   // ...and how much longer it takes sliding sideways at 5 km/h or more (s)
const BURN_STRAIGHT_KMH = 2, BURN_STRAIGHT_T = 0.4;   // ...the slow squeeze ending this soon after the car slides sideways slower than 1 + this km/h
const BURN_SETTLE_V = 1.2, BURN_SETTLE_T = 3;   // ...and the last of the slide fading out below this sideways speed (m/s), for this long after (s)
const SPIN_CARRY = 0.9;          // share of the walking-pace sideways damper taken off while the rear wheels spin under throttle
const BURN_SETTLE_DRAG = 0.9;    // ...where the walking-pace sideways damping is eased by this share
const BURN_SLIDE_HOLD = 1.0;     // the donut keeper lets go of a slide only as the brake reaches this (Martin 2026-11-21: slide on twice as long)
const REV_WAIT = 0.35;           // s the brake alone holds a rear-driven car at a standstill before reverse goes in
const GEAR_SPIN_LAG = 1.5;       // how much more slowly spinning wheels build up per gear above first
const LOW_YAW_DAMP = 1.5;       // yaw damping at walking pace (1/s)
const ABS_HZ = 8;                // anti-lock pressure cycling (spec.abs: 0..1, how much of the lock-up it prevents)      // rear share a two-motor EV moves to while powersliding under 100 km/h
const RHO = 1.2;

// Body heave on the suspension, per kg of car: a 1.5 Hz spring with half-critical
// damping that can push the car up but never pull it down. STATIC is how far
// the springs are squeezed at rest, which is also how far the wheels can drop
// before they leave the road.
const SPRING = (2 * Math.PI * 1.5) ** 2;
const DAMP = 2 * 0.5 * Math.sqrt(SPRING);
const STATIC = G / SPRING;
const BUMP = STATIC + 0.09;      // travel where the bump stops start
const FLOOR = 0.13;              // the body never sits lower than this below its ride height
// Raised kerbs (world.kerbAt): a wheel whose kerb height jumps by more than KERB_STEP in one step has met
// a kerb face. Climbing it takes up to KERB_KNOCK m/s of the wheel's speed into the kerb (per 15 cm above
// 5 cm) and jolts the body; met at less than KERB_GLANCE rad (per 15 cm) the tyre rubs along the face
// and is turned back off it instead.
const KERB_STEP = 0.07;
const KERB_KNOCK = 1.1;
const KERB_GLANCE = 0.1;

// grip, rolling resistance, tyre stiffness and bumpiness per surface class
// kp / tail describe traction under wheelspin: grip peaks at slip ratio kp and
// settles at `tail` of the peak when the wheel spins freely. Tarmac loses a
// good part of its bite, loose ground hardly any (the tyre digs in).
const SURF = [
  { mu: 0.62, crr: 0.075, b: 5.5, bump: 1.0, kp: 0.25, tail: 0.95 },   // grass
  { mu: 1.0, crr: 0.013, b: 10.0, bump: 0.0, kp: 0.12, tail: 0.87 },   // paved
  { mu: 0.72, crr: 0.03, b: 7.0, bump: 0.35, kp: 0.3, tail: 0.97 },    // gravel
  { mu: 0.62, crr: 0.045, b: 6.0, bump: 0.6, kp: 0.3, tail: 0.95 },    // dirt
  { mu: 0.4, crr: 0.3, b: 4.0, bump: 0.0, kp: 0.3, tail: 0.9 },        // water (shallows)
];
const WATER = 4;

function lerpTable(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1], [x1, y1] = table[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

export function createCar(spec, pose) {
  const L = spec.wheelbase;
  return {
    spec,
    x: pose.x, z: pose.z, y: pose.y ?? 0, yaw: pose.yaw ?? 0,
    vx: 0, vy: 0, yawRate: 0, vyBody: 0,
    // vertical motion: hy is the body height the dynamics use (y is what gets drawn),
    // load is the weight on the tyres as a share of the car's own weight
    hy: pose.y ?? 0, vyUp: 0, lastGround: null, load: 1,
    airborne: false, airTime: 0, landed: 0,
    pitchRate: 0, rollRate: 0,
    pitch: 0, roll: 0, groundPitch: 0, groundRoll: 0,
    steer: 0, wheelSpin: 0, wheelSpinF: 0, wheelSpinR: 0,
    slipV: 0, slipVF: 0, slipVR: 0, spin: 0, useF: 0, useR: 0,   // driven-wheel slip speed (m/s), 0..1 wheelspin, lateral grip in use
    gear: 1, shiftTimer: 0, rpm: spec.engine.idle ?? 0, reversing: false, boost: 0, shaft: 0, carry: 0, revCut: 0, csHold: 0, csDir: 0,
    throttle: 0, brake: 0,
    ax: 0, ay: 0,
    surface: 1,
    inWater: false, waterTime: 0, sunk: false, waterLevel: 0,
    hit: 0,                      // strength of the last impact (m/s), decays
    a: L * spec.cgFront, b: L * (1 - spec.cgFront),
    iz: spec.mass * (0.5 * L) ** 2 * 1.15,
    halfLen: spec.halfLen ?? L / 2 + 0.85, halfWid: spec.halfWid ?? spec.track / 2 + 0.13,
    time: 0,
  };
}

export function speedKmh(car) {
  return Math.hypot(car.vx, car.vy) * 3.6;
}

// A gear picked by hand (keys A and Z): +1 up, -1 down. Returns false when the shift cannot be made.
// An upshift (short shifting a powerful car for traction) is held, without the automatic shifting back
// down, until that gear reaches the shift point; the automatic then carries on upwards. A downshift may
// go past the redline, at most two gears below the lowest one that fits, and then brakes the car on the
// engine with the revs pinned at the limiter; it is held until the car is driven back up to the shift point.
export function shiftGear(car, dir) {
  const s = car.spec, e = s.engine;
  if (e.type === 'ev' || car.reversing) return false;
  const g = car.gear + dir;
  if (g < 1 || g > s.gears.length) return false;
  const rpmIn = (k) => (Math.abs(car.vx) / s.wheelRadius) * s.gears[k - 1] * s.finalDrive * (60 / (2 * Math.PI));
  if (dir < 0) {
    let fit = car.gear;
    while (fit > 1 && rpmIn(fit - 1) <= e.redline) fit--;
    if (g < fit - 2) return false;
  }
  car.shiftUp = dir > 0;
  if (dir > 0) { car.locked = true; car.carry = 0; }
  car.gear = g; car.shiftTimer = Math.min(s.shiftTime, SHIFT_TIME); car.shiftLen = car.shiftTimer;
  car.manual = dir > 0 ? 1 : -1;
  return true;
}

// rev limiter: the shortest ignition cut (s) and how far the revs must fall before it returns (rpm);
// an engine can set its own with revCut and revCutDrop
const SHIFT_TIME = 0.25;         // a quick manual change: clutch, lever, clutch (s)
const REV_CUT_TIME = 0.03, REV_CUT_DROP = 120;
// braking, the automatic shifts down once the lower gear lands under this share of the shift point (an
// engine's brakeDown, for the sports cars that keep their revs up)
const BRAKE_DOWN = 0.8;
const BRAKE_LIFT = 500;         // rpm (on a 7000 rpm engine, in proportion on others) more on top of that (Martin 2026-11-19)
const UP_HOLD = 1;              // s an automatic upshift on the throttle is kept before it may kick back down
// a repeatable 0..1 'random' number, so every car runs the same on every screen
const hash = (x) => { const h = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return h - Math.floor(h); };

function engineForce(car, throttle, dt, hb = 0) {
  // Returns the drive force at the wheels (N, signed along vx) and updates rpm / gear.
  // The engine turns with the driven wheels, so under wheelspin the revs follow
  // the wheel speed (wAbs), not the road speed (vAbs). The gearbox shifts on
  // road speed, so it holds its gear while the wheels spin.
  const s = car.spec, e = s.engine;
  const v = car.vx;
  const dir = car.reversing ? -1 : 1;
  const vAbs = Math.abs(v);
  const wAbs = Math.abs(v + dir * car.slipV);
  if (e.type === 'ev') {
    const ratio = s.gears[0];
    car.rpm = (wAbs / s.wheelRadius) * ratio * (60 / (2 * Math.PI));
    car.gear = 1;
    let f = Math.min(e.maxWheelForce, (e.maxPowerKw * 1000 * s.efficiency) / Math.max(wAbs, 0.5));
    const wLim = (s.limiter || 180) / 3.6 * 1.15;      // motor speed limit
    if (wAbs > wLim - 2) f *= Math.max(0, (wLim - wAbs) / 2);
    const lim = car.reversing ? 30 : s.limiter;
    if (lim && vAbs * 3.6 > lim - 2) f *= Math.max(0, (lim - vAbs * 3.6) / 2);
    // (held on the race grid: a four-wheel-drive EV has no clutch to slip, so it waits with its power held
    // back, launch mode, and goes at the lights)
    if (car.gridHold && s.drive === 'awd') return 0;
    // one-pedal style regeneration when lifting off
    if (throttle <= 0) return vAbs > 0.5 ? -Math.sign(v) * Math.min(1800, 0.09 * s.mass * G * 0.35) : 0;
    return dir * f * throttle;
  }
  const ratioOf = (g) => (car.reversing ? s.reverse : s.gears[g - 1]) * s.finalDrive;
  const rpmAt = (g) => (vAbs / s.wheelRadius) * ratioOf(g) * (60 / (2 * Math.PI));
  // A gear picked by hand is held until the road speed (not the wheelspin) brings that gear up to the
  // shift point, so second or third can be picked mid burnout or donut and kept while the tyres spin.
  // A downshift on the engine brake waits for the throttle. The gear is given up a second after the car
  // has come to a stop off the throttle.
  if (car.manual) {
    const road = rpmAt(car.gear);
    // (stopped off the throttle for a second, the gearbox goes back to automatic)
    car.manualStop = throttle <= 0 && vAbs < 1.5 ? (car.manualStop || 0) + dt : 0;
    // The road speed always trails the tread a little (the tyres creep even when they grip), so with the
    // engine on its limiter the road revs top out short of the shift point. The hold therefore ends at
    // 90 % of the shift point, or at 80 % once the engine has been bouncing off its limiter for half a second.
    const onLimiter = throttle > 0.3 && road * wAbs >= (e.redline - 80) * vAbs;
    car.manualLim = onLimiter ? (car.manualLim || 0) + dt : 0;
    const due = road >= e.shiftRpm * 0.9 || (car.manualLim > 0.5 && road >= e.shiftRpm * 0.8);
    // (a downshift is for braking into a corner: flooring it again hands the choice back to the automatic)
    if (car.reversing || car.manualStop > 1 || (car.manual < 0 && throttle >= 0.9) ||
        (due && road <= e.redline && (car.manual > 0 || throttle > 0.3))) car.manual = 0;
  }
  if (car.reversing) car.gear = 1;
  else if (car.shiftTimer <= 0 && !car.manual) {
    // kick-down automatic: lowest gear that stays below the shift point
    let g = car.gear;
    // (it also shifts a little early rather than run into the rev limiter when the tyres are only just slipping)
    // (a car that keeps its clutch slipping, engine.clutchSlip, spins its tyres long enough to bounce off the limiter
    // with the car slewed a little off line, so its forward speed reads low: it counts from 80 % of the shift point
    // and from just below the redline, or the F40 sat on the limiter in first for 1.4 s at 88 km/h; Martin
    // 2026-11-22. Other cars keep 88 %: at 80 % the Mazda and the 190E changed back down on grass and gravel.)
    const slipper = launchManual && e.type === 'ice' && (clutchSlip || e.clutchSlip);
    const early = rpmAt(g) > e.shiftRpm * (slipper ? 0.8 : 0.88) && rpmAt(g) * wAbs >= (slipper ? e.redline - Math.max(REV_CUT_DROP, e.revCutDrop ?? REV_CUT_DROP) : e.redline) * vAbs;
    // Coming down: on the throttle it kicks down while the lower gear stays under 90 % of the shift point,
    // coasting it waits until the lower gear lands at 55 %, and braking (into a corner) it comes down early,
    // landing high in the revs, ready to pull out of the corner (Martin 2026-11-19: it came down late and low);
    // first gear is still left until the car is nearly down to a crawl (taken early, the next stab of the
    // throttle would have it bouncing between first and second on spinning tyres)
    const braking = g > 2 ? Math.min(1, (car.brake || 0) / 0.5) : 0;
    // (off the throttle each downshift comes at a different point, downJit, half as far off coasting as
    // under braking, so a long stop doesn't land on the same revs every time, Martin 2026-11-19/20)
    const brakeAt = Math.min(0.95, (e.brakeDown ?? BRAKE_DOWN) + BRAKE_LIFT * (e.redline / 7000) / e.shiftRpm);
    const downAt = throttle > 0.5 ? 0.9 : Math.min(0.97, 0.55 + (brakeAt - 0.55) * braking + (car.downJit || 0) * (0.5 + 0.5 * braking));
    // On the throttle the gearbox does not kick down while the driven wheels spin with the engine well up
    // in its revs (a lower gear would only spin them harder), nor for UP_HOLD after an upshift: on spinning
    // tyres, loose ground most of all, the early 1>2 above landed under the kick-down point, so it went
    // straight back to first and up again, heard as two upshifts in a row (Martin 2026-11-20). (The road
    // speed it shifts on is the forward one, which in a slide reads low, so it also kicked down mid slide.)
    const spinRevs = (wAbs / s.wheelRadius) * ratioOf(g) * (60 / (2 * Math.PI));
    const held = throttle > 0.5 && (car.upHold > 0 || (wAbs > vAbs * 1.1 + 0.3 && spinRevs > e.shiftRpm * 0.6));
    if ((rpmAt(g) > e.shiftRpm || early) && g < s.gears.length) g++;
    else if (g > 1 && !held && rpmAt(g - 1) < e.shiftRpm * downAt) g--;
    if (g !== car.gear) {
      // Shifted like a quick manual: an upshift under power cuts the ignition while the clutch is
      // out (the revs drop to the next gear's), then it bites again; a downshift blips the throttle.
      car.shiftUp = g > car.gear && throttle > 0.3;
      if (g > car.gear) { car.locked = true; car.carry = 0; }
      car.upHold = car.shiftUp ? UP_HOLD : 0;
      car.gear = g; car.shiftTimer = Math.min(s.shiftTime, SHIFT_TIME); car.shiftLen = car.shiftTimer;
      // Where the next downshift comes, drawn afresh at each change (from the time, so a test drives the
      // same way every run): anywhere within 5 % of the shift point either way, and one time in three it
      // waits for the revs to drop about 500 rpm further (in proportion on other engines), so on a long
      // stop some changes come close together and then there is a longer gap (Martin 2026-11-20).
      const u = hash(car.time * 1.37 + g * 3.1), w = hash(car.time * 2.71 + g * 5.3 + 0.5);
      car.downJit = 0.05 * (2 * u - 1) - (w < 0.33 ? BRAKE_LIFT * (e.redline / 7000) / e.shiftRpm : 0);
    }
  }
  if (car.upHold > 0) car.upHold -= dt;
  if (car.shiftTimer > 0) {
    car.shiftTimer -= dt;
    // an upshift under power biting: the drive comes back all at once (the sound's bark and the body's
    // kick follow `bite`; it takes nothing from the pace)
    if (car.shiftTimer <= 0 && car.shiftUp && throttle > 0.3) { car.bite = throttle; car.biteAt = car.time; }
  }
  const wheelRpm = (wAbs / s.wheelRadius) * ratioOf(car.gear) * (60 / (2 * Math.PI));
  // torque converter: engine speed never drops below stall while the throttle is open
  // (rollStallRpm: once rolling, a flat-out stab lets the engine flare higher before the converter takes
  // hold, like dropping the clutch in a manual; a standing start keeps the gentler stallRpm)
  if (throttle < 0.5) car.stabV = vAbs;     // (the road speed when the pedal went down)
  const stallMax = e.rollStallRpm ? e.stallRpm + (e.rollStallRpm - e.stallRpm) * Math.min(1, (car.stabV ?? 0) / 3) ** 2 : e.stallRpm;
  // Once it has shifted up the gearbox drives like a manual with the clutch in: the engine turns with the
  // wheels, so an upshift drops the revs straight to the next gear's, with no converter slip holding them
  // up. The converter only takes over again for a start in first, or when the revs sag towards idle.
  if (car.locked && (car.gear === 1 || car.reversing || wheelRpm < (e.idle ?? 750) * 1.3)) car.locked = false;
  const manual = launchManual && e.type === 'ice';
  let stall = car.locked || manual ? e.idle : e.idle + (stallMax - e.idle) * throttle;
  // (the clutch drop: floored in first at a standstill, see LAUNCH_SHARE)
  if (manual && launchRpm !== 0) {
    // (the clutch is dropped at a third of the way up; the slipping clutch below holds a turbo engine where its
    // boost is full, or it bogs off boost: the F40 at 4300 rpm, Martin 2026-11-22)
    const third = e.idle + (e.redline - e.idle) * LAUNCH_SHARE;
    const L = launchRpm ?? third, Lslip = launchRpm ?? Math.max(third, e.turbo?.fullRpm ?? 0);
    // (held on the race grid the driver keeps the clutch slipping at those revs, wheels spinning as they did
    // with the converter, and drops it at the lights; four-wheel-drive cars wait clutch in, car.free below)
    if (car.gridHold) { car.launchT = undefined; if (throttle > 0.5) stall = Math.max(stall, Lslip); }
    else if (throttle < 0.5 || car.reversing || car.gear !== 1) car.launchT = undefined;
    else if (car.launchT === undefined && (car.stabV ?? 0) < 2) {
      car.launchT = 0;
      if (L > wheelRpm) car.dump = Math.min(HB_DUMP_MAX, HB_DUMP * throttle * (L - wheelRpm) / ratioOf(car.gear) * (2 * Math.PI / 60) * s.wheelRadius);
    }
    if (car.launchT !== undefined && car.launchT < CLUTCH_SLIP_T + CLUTCH_FADE_T) {
      stall = Math.max(stall, L - (L - e.idle) * Math.max(0, (car.launchT - CLUTCH_SLIP_T) / CLUTCH_FADE_T));
      car.launchT += dt;
    }
    // (engine.clutchSlip, ?slip=1: the clutch kept slipping whenever it is floored in first,
    // and in a higher gear once the wheels have dragged the engine down near idle: the driver dips the clutch)
    if ((clutchSlip || e.clutchSlip) && (car.gear === 1 || wheelRpm < e.idle * 1.3) && !car.reversing && throttle > 0.5) stall = Math.max(stall, e.idle + (Lslip - e.idle) * Math.min(1, (throttle - 0.5) / 0.4));
  }
  // The handbrake with the clutch (engine.hbRevs, a rally car's handbrake turn): pulling the handbrake
  // takes the drive off, as the driver's left foot would, so the engine no longer falls with the road
  // speed. Off the throttle it is kept on the boil at hbRevs; on the throttle it climbs towards the
  // shift point. Letting the handbrake go drops the clutch back in: the revs stored in the flywheel
  // (car.carry, below) come back as a kick, which is what lights the tyres on the way out
  // (Martin 2026-11-22: after a flick the 22B's revs had sagged and the tyres would not always light).
  // (Off the throttle the revs are only kept, never raised, and only for HB_HOLD_T, the length of a
  // flick: a car stopped or parked on its handbrake lets its engine fall to idle.)
  // (Every four-wheel-drive car with an engine has it: specs.js fills in hbRevs at the power peak when a
  // car gives none, Martin 2026-11-22.)
  // Launch control on the race grid (Martin 2026-11-22): a four-wheel-drive car with an engine waits on the
  // line with the clutch in, the throttle revving it against the limiter with the wheels still, and when
  // the lights go out (main.js lets go of car.gridHold) the clutch drops: the same kick as letting the
  // handbrake go, below. Rear- and front-driven cars keep their burnouts on the grid.
  const launch = car.gridHold && s.drive === 'awd' && !car.reversing;
  const free = launch || (e.hbRevs && hb > 0.5 && !car.reversing && !car.airborne);
  if (launch) {
    // (towards a little past the redline, so the limiter cuts it and it bounces; falling while cut)
    const from = car.free ?? car.rpm, idle = e.idle ?? 750;
    const to = car.revCut > 0 ? idle : idle + (e.redline + 300 - idle) * throttle;
    car.freeT = 0;
    car.free = from < to ? Math.min(to, from + HB_REV_UP * throttle * dt) : Math.max(to, from - (e.revDrop ?? 3200) * dt);
  } else if (free) {
    const from = car.free ?? car.rpm;
    car.freeT = throttle > 0 || car.free === undefined ? 0 : car.freeT + dt;
    const to = throttle > 0 ? e.hbRevs + (e.shiftRpm - e.hbRevs) * throttle : vAbs > 2 && car.freeT < HB_HOLD_T ? Math.min(from, e.hbRevs) : e.idle;
    car.free = from < to ? Math.min(to, from + HB_REV_UP * throttle * dt) : Math.max(to, from - (e.revDrop ?? 3200) * dt);
  } else {
    // The clutch dropped with the engine turning faster than the wheels: the flywheel drags the tyres up
    // to its own speed before they can pull it down, so part of the difference becomes wheelspin at once
    // (car.dump, m/s of tread speed, shared out between the axles in stepCar).
    if (car.free !== undefined && throttle > 0.3 && car.free > wheelRpm) {
      car.dump = Math.min(HB_DUMP_MAX, HB_DUMP * throttle * (car.free - wheelRpm) / ratioOf(car.gear) * (2 * Math.PI / 60) * s.wheelRadius);
    }
    car.free = undefined;
  }
  const rpm = free ? car.free : Math.max(wheelRpm, stall);
  const sr = Math.min(1, wheelRpm / rpm);
  // Turbocharged engines: boost only builds once the exhaust flows enough to
  // spin the turbines, and it takes time to get there (turbo lag). It drops
  // almost at once when the throttle closes.
  const tb = e.turbo;
  // Lifting dumps the boost pressure at once, but the turbine wheels keep
  // spinning down for a second or two, so a quick lift and re-press builds
  // boost again almost straight away; only a long lift brings the lag back.
  if (tb) {
    const rEff = Math.max(rpm, car.carry);
    const u = Math.max(0, Math.min(1, (rEff - tb.onRpm) / (tb.fullRpm - tb.onRpm)));
    const want = throttle * u * u * (3 - 2 * u);
    const sk = want > car.shaft ? tb.spool * (0.25 + 0.75 * Math.min(1, rEff / e.redline)) : SHAFT_DECAY;
    car.shaft += (want - car.shaft) * Math.min(1, dt * sk);
    // pressure follows the turbine speed quickly, and dumps at once on a lift
    const up = Math.min(want, car.shaft);
    car.boost += (up - car.boost) * Math.min(1, dt * (up > car.boost ? 25 : tb.dump));
  }
  const gain = manual ? 1 : 1 + (e.converterGain - 1) * (1 - sr) ** 2;
  // Engine inertia: after a lift the engine spins down at the rate its
  // flywheel and friction allow (revDrop rpm/s), not at once. Pressing again
  // before it has dropped picks up from those revs, and the torque converter
  // passes some of the stored flywheel energy on to the wheels as it pulls
  // the engine back down.
  const drop = e.revDrop ?? 3200;
  if (throttle <= 0) car.carry = car.lifted ? Math.max(0, car.carry - drop * dt) : Math.min(car.rpm, e.redline);
  else car.carry = Math.max(0, car.carry - drop * 1.2 * dt);
  car.lifted = throttle <= 0;
  if (free) car.carry = car.free;
  // Hard rev limiter, only reached with spinning wheels (shifts come earlier). At the redline the
  // ignition is cut for a moment and stays off until the revs have fallen back, so an engine held flat
  // out on spinning wheels (a donut, a burnout) bounces off the limiter instead of sitting on it.
  // revCut > 0 is the cut in progress; the sound follows it.
  if (throttle <= 0) car.revCut = 0;
  else if (car.revCut > 0) {
    car.revCut -= dt;
    if (car.revCut <= 0) car.revCut = (launch ? car.free : wheelRpm) > e.redline - car.cutDrop ? 1e-4 : 0;
  } else if ((launch ? car.free : wheelRpm) >= e.redline) {
    // No two bounces are alike: each cut lasts a little longer or shorter and lets the revs fall a
    // different way before the engine fires again, so the limiter stutters rather than buzzes.
    const r1 = hash(car.time * 7.31 + car.x * 0.13), r2 = hash(car.time * 3.17 + car.z * 0.11 + 5.2);
    car.revCut = (e.revCut ?? REV_CUT_TIME) * (0.7 + 0.9 * r1);
    car.cutDrop = Math.max(REV_CUT_DROP, e.revCutDrop ?? REV_CUT_DROP) * (0.5 + 2.2 * r2 * r2);
  }
  // (when the tyres let go the engine is suddenly unloaded and flares up ahead of the wheels a little)
  const rpmTo = Math.min(Math.max(rpm, car.carry, throttle > 0.5 ? stall + 1600 * (car.spin || 0) * throttle : 0), e.redline);
  // (the needle and the engine note follow the bounce closely)
  car.rpm += (rpmTo - car.rpm) * Math.min(1, dt * (wheelRpm > e.redline - 600 || car.shiftTimer > 0 ? 40 : 12));
  car.shiftCut = car.shiftTimer > 0 && car.shiftUp && throttle > 0;
  // Shifted down by hand past the redline: the engine is held on its limiter and the gearbox drags the
  // car down to the speed the redline allows in that gear, harder the further over it is.
  const overRev = !car.reversing && wheelRpm > e.redline + 30 ? (wheelRpm - e.redline) / e.redline : 0;
  car.overRev = overRev;           // (the sound: an engine dragged past its redline howls and misfires)
  if (overRev > 0) {
    car.revCut = 0;
    return -Math.sign(v) * Math.min(0.5, 0.12 + overRev * 2) * s.mass * G;
  }
  if (free) return 0;
  if (throttle <= 0) {
    // engine braking through the converter
    // (engine.brakeTorque [Nm, Nm per rpm]: the engine's own drag with the throttle shut, friction and
    // pumping, sent through the gear it is in like the drive is. In the low gears it is several times the
    // gentle figure below: a lift slows the car as a real one does, moves weight onto the nose and takes
    // grip from the driven wheels, so lifting mid corner eases the tail out; Martin 2026-11-22)
    if (e.brakeTorque) return vAbs > 0.3 ? -Math.sign(v) * (e.brakeTorque[0] + e.brakeTorque[1] * wheelRpm) * ratioOf(car.gear) / s.wheelRadius : 0;
    return vAbs > 0.3 ? -Math.sign(v) * (180 + 0.045 * wheelRpm) * (ratioOf(car.gear) / 8) : 0;
  }
  if (car.revCut > 0 || (car.reversing && vAbs > 11)) return 0;
  // (no drive while the clutch is out, then it bites back in over the last part of the shift)
  const cut = car.shiftTimer > 0 ? (car.shiftUp ? Math.max(0, 1 - car.shiftTimer / (0.45 * car.shiftLen)) * 0.6 : 0.4) : 1;
  const rq = Math.max(rpm, car.carry);
  const full = lerpTable(e.torque, rq);
  const base = tb ? lerpTable(tb.torqueOff, rq) : full;
  const kick = 1 + 0.5 * Math.min(1, Math.max(0, (car.carry - rpm) / rpm));
  let tq = (base + (full - base) * (tb ? car.boost : 1)) * gain * throttle * cut * kick;
  // electronic speed limiter
  if (s.limiter && !car.reversing && vAbs * 3.6 > s.limiter - 2) tq *= Math.max(0, (s.limiter - vAbs * 3.6) / 2);
  return (dir * tq * ratioOf(car.gear) * s.efficiency) / s.wheelRadius;
}

const tmpG = [0, 0];
const tmpA = [0, 0];
const tmpR = [0, 0, 0];
const tmpT = [];
// is (x, z) close enough to a trunk that the distance field there is the trunk's?
function nearTrunk(t, x, z) {
  for (let i = 0; i < t.length; i += 3) {
    const r = t[i + 2] + 0.75, dx = t[i] - x, dz = t[i + 1] - z;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

const tmpB = [];
// signed distance from (x, z) to a solid box { x, z, yaw, hx, hz } (local x = (cos yaw, -sin yaw))
function boxDist(b, x, z) {
  const c = Math.cos(b.yaw), sn = Math.sin(b.yaw), px = x - b.x, pz = z - b.z;
  const qx = Math.abs(px * c - pz * sn) - b.hx, qz = Math.abs(px * sn + pz * c) - b.hz;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
}
// is (x, z) close enough to a thin box that the distance field there is the box's?
function nearBox(list, x, z) {
  for (let i = 0; i < list.length; i++) if (boxDist(list[i], x, z) < 0.5) return true;
  return false;
}
// does another box of the list carry on from the end of b at (ex, ez)?
function joined(list, b, ex, ez) {
  for (let i = 0; i < list.length; i++) if (list[i] !== b && boxDist(list[i], ex, ez) < 0.05) return true;
  return false;
}
// one thin box against the car's body rectangle (half sizes hl, hw; forward f, right r): pushes the car out
// of it with contact() when they overlap
function boxContact(car, b, list, fx, fz, rx, rz, hl, hw, contact) {
  const bc = Math.cos(b.yaw), bs = Math.sin(b.yaw);
  const ux = bc, uz = -bs, vx = bs, vz = bc;                     // the box's own x and z axes
  const dx = car.x - b.x, dz = car.z - b.z;
  if (Math.abs(dx) > hl + hw + b.hx + b.hz || Math.abs(dz) > hl + hw + b.hx + b.hz) return;
  // the four axes: the box's thin side, its ends, the car's sides, the car's bumpers
  let best = Infinity, nx = 0, nz = 0, kind = 0;
  for (let a = 0; a < 4; a++) {
    const ax = a === 0 ? vx : a === 1 ? ux : a === 2 ? rx : fx, az = a === 0 ? vz : a === 1 ? uz : a === 2 ? rz : fz;
    const rc = hl * Math.abs(fx * ax + fz * az) + hw * Math.abs(rx * ax + rz * az);
    const rb = b.hx * Math.abs(ux * ax + uz * az) + b.hz * Math.abs(vx * ax + vz * az);
    const d = dx * ax + dz * az, pen = rc + rb - Math.abs(d);
    if (pen <= 0) return;                                          // apart along this axis: no contact
    // (a box's end only when nothing carries on from it; the car's own axes a little less readily than the
    // box's, so a car flat against a long barrier is pushed straight off it)
    const sg = d >= 0 ? 1 : -1;
    if (a === 1 && joined(list, b, b.x + ux * b.hx * sg, b.z + uz * b.hx * sg)) continue;
    const score = a >= 2 ? pen * 1.05 + 0.005 : pen;
    if (score < best) { best = score; nx = ax * sg; nz = az * sg; kind = a; }
  }
  if (best === Infinity) return;
  // how far along n to push, and where the contact is (the middle of the deepest points)
  let pen, px = 0, pz = 0;
  if (kind < 2) {
    // a box face: the car corners furthest into it
    const bf = b.hx * Math.abs(ux * nx + uz * nz) + b.hz * Math.abs(vx * nx + vz * nz);
    let lo = Infinity, cnt = 0;
    for (let q = 0; q < 4; q++) {
      const ox = fx * (q < 2 ? hl : -hl) + rx * (q % 2 ? hw : -hw), oz = fz * (q < 2 ? hl : -hl) + rz * (q % 2 ? hw : -hw);
      const s = (dx + ox) * nx + (dz + oz) * nz;
      if (s < lo - 0.02) { lo = s; px = ox; pz = oz; cnt = 1; }
      else if (s < lo + 0.02) { px += ox; pz += oz; cnt++; if (s < lo) lo = s; }
    }
    px /= cnt; pz /= cnt;
    pen = bf - lo;
  } else {
    // a car face: the box corners furthest into the car
    const cf = hl * Math.abs(fx * nx + fz * nz) + hw * Math.abs(rx * nx + rz * nz);
    let hi = -Infinity, cnt = 0;
    for (let q = 0; q < 4; q++) {
      const ox = ux * (q < 2 ? b.hx : -b.hx) + vx * (q % 2 ? b.hz : -b.hz), oz = uz * (q < 2 ? b.hx : -b.hx) + vz * (q % 2 ? b.hz : -b.hz);
      // (along n from the car's middle; the box is on the -n side, the car's face there at -cf)
      const s = (b.x + ox - car.x) * nx + (b.z + oz - car.z) * nz;
      if (s > hi + 0.02) { hi = s; px = b.x + ox - car.x; pz = b.z + oz - car.z; cnt = 1; }
      else if (s > hi - 0.02) { px += b.x + ox - car.x; pz += b.z + oz - car.z; cnt++; if (s > hi) hi = s; }
    }
    px /= cnt; pz /= cnt;
    pen = hi + cf;
    // (the contact on the car's face, not inside the car)
    const along = px * nx + pz * nz;
    px -= nx * (along + cf); pz -= nz * (along + cf);
  }
  if (pen > 0) contact(nx, nz, px, pz, pen);
}

// input: { up, down, left, right, handbrake } booleans or 0..1 values, steer optional (-1..1);
// steerDirect: steer is a steering wheel's angle (full lock at +-1) instead of a share of the grip
export function stepCar(car, input, world, dtFrame) {
  const n = Math.max(1, Math.ceil(dtFrame / (1 / 240)));
  const dt = dtFrame / n;
  for (let i = 0; i < n; i++) substep(car, input, world, dt);
  car.time += dtFrame;
  car.hit *= Math.exp(-dtFrame * 4);
  car.landed *= Math.exp(-dtFrame * 6);
  if (car.kerbHit) car.kerbHit *= Math.exp(-dtFrame * 8);
  if (car.jolt) car.jolt *= Math.exp(-dtFrame * 10);
  if (car.bite) car.bite = car.bite > 0.01 ? car.bite * Math.exp(-dtFrame * 7) : 0;
}

function substep(car, input, world, dt) {
  car.skidF = car.skidR = car.rubF = car.rubR = 0;
  const s = car.spec;
  const m = s.mass, L = s.wheelbase;
  const up = +input.up || 0, down = +input.down || 0;
  const sinY = Math.sin(car.yaw), cosY = Math.cos(car.yaw);
  const fx = sinY, fz = -cosY;      // forward
  const rx = cosY, rz = sinY;       // right
  const speed = Math.hypot(car.vx, car.vy);

  // ---- arrow-key semantics: up drives forward, down brakes then reverses
  let throttle = 0, brake = 0;
  // Both pedals at once in a rear-driven car under about 30 km/h: a burnout. The brake holds (at a standstill
  // too, where on its own the pedal would select reverse), so a car strong enough to overcome its rear
  // brakes spins its rear tyres while the fronts keep it in place; easing the brake lets it go, pressing
  // again reins it back in. Above 30 km/h both pedals are just braking with the throttle open.
  // (a bus has a sixth of a car's power per tonne: it just strains against its brakes)
  const kmh = Math.abs(car.vx) * 3.6;
  // (a car swung round in a slide can be moving backwards for a moment, and that is still the same burnout:
  // only a car already in reverse, backing up, treats both pedals as reverse and brake; Martin 2026-11-21)
  const burn = s.drive === 'rwd' && up > 0 && down > 0 && (car.vx > -0.6 || !car.reversing) && kmh < 30;
  if (burn && car.reversing) car.reversing = false;
  // (after a burnout the brake held on its own keeps holding until it is let go: reverse goes in only on a
  // fresh press, so lifting off the throttle, or a key that drops out for a moment, never selects R)
  if (burn) car.burnHold = true; else if (!(down > 0)) car.burnHold = false;
  car.burn = burn && (s.ref?.powerKw ?? 100) / s.mass >= 0.03 ? Math.min(1, (30 - kmh) / 10) : 0;
  car.burnT = burn ? (car.burnT || 0) + dt : 0;
  // (from a standstill the brake pedal alone holds the car for REV_WAIT before reverse goes in, as an
  // automatic takes a moment to select R; so brake first, then throttle, is a burnout too, not a reverse)
  car.revWait = !car.reversing && down > 0 && up === 0 && car.vx <= 0.6 ? (car.revWait || 0) + dt : 0;
  if (!car.reversing) {
    throttle = up;
    if (down > 0) {
      // (both pedals in a car swung round and sliding backwards faster than a burnout, as a bare donut can, is
      // braking too: it used to be throttle alone for a moment, the F40 at 33 km/h backwards, 2026-11-22)
      if (car.vx > 0.6 || burn || (up > 0 && car.vx < -0.6)) brake = down;
      else if (up === 0) { if (!car.burnHold && (car.revWait > REV_WAIT || s.drive !== 'rwd')) car.reversing = true; else brake = down; }
    }
  }
  if (car.reversing) {
    throttle = down;
    if (up > 0) {
      if (car.vx < -0.6) brake = up;
      else if (down === 0) { car.reversing = false; throttle = 0; }
    }
  }
  if (car.reversing && down === 0 && up === 0 && Math.abs(car.vx) < 0.2) car.reversing = false;
  // (a burnout's brake is squeezed on rather than stamped: pressed together with the throttle the car jumps
  // forward a little before the fronts take hold, and on the move it comes to a halt gradually, rears
  // smoking; a brake already held when the throttle goes down holds at once)
  // Sliding sideways (out of a donut, say) the squeeze is gentler and slower still, so the car first slides
  // on with the momentum it has, then straightens and comes to a stop (Martin 2026-11-21; at his ask the slide
  // now lasts twice as long, about 4 to 5 s from donut to standstill, a little more or less on a leaning road).
  // (the slow squeeze lasts only while the car still slides: once it has straightened, the rest of the
  // brake comes on at the ordinary pace, so it rolls on a little and stops rather than driving off with
  // the fronts dragging; Martin 2026-11-21)
  const side = Math.min(1, Math.abs(car.vy) * 3.6 / BURN_SLIDE_KMH);
  if (!(down > 0)) car.pedalT = 0;
  else if (!car.pedalT) { car.pedalT = dt; car.pedalV = side; car.pedalB0 = BURN_BITE * (1 - 0.6 * side); car.pedalB = car.pedalB0; }
  else {
    car.pedalT += dt;
    car.pedalV = Math.max(Math.min(1, Math.max(0, Math.abs(car.vy) * 3.6 - 1) / BURN_STRAIGHT_KMH), car.pedalV - dt / BURN_STRAIGHT_T);
    car.pedalB = Math.min(1, car.pedalB + (1 - car.pedalB0) * dt / (BURN_BITE_T + BURN_SLIDE_T * car.pedalV));
  }
  if (car.burn > 0 && down > 0) brake *= car.pedalB;
  // (the last of a slide dies away gradually: while a burnout that began sliding still slides, and for
  // BURN_SETTLE_T after, the tyres hold the car sideways ever more softly the slower it slides sideways, so
  // the sideways drift and the turning fade out over a second or two instead of stopping dead, and on a
  // leaning road the tail can carry on drifting downhill for a long while; the walking-pace damping of
  // sideways motion, which made the end snap straight in a quarter second, is mostly off then too;
  // Martin 2026-11-21)
  if (!(down > 0) || !(car.burn > 0)) car.slideMem = 0;
  else if (car.pedalT === dt) car.slideMem = side;
  else if (!(car.pedalV > 0) || car.pedalB >= 1) car.slideMem = Math.max(0, car.slideMem - dt / BURN_SETTLE_T);
  car.throttle = throttle; car.brake = brake;

  // ---- ground under the wheels
  const hw = s.track / 2;
  const pFLx = car.x + fx * car.a - rx * hw, pFLz = car.z + fz * car.a - rz * hw;
  const pFRx = car.x + fx * car.a + rx * hw, pFRz = car.z + fz * car.a + rz * hw;
  const pRLx = car.x - fx * car.b - rx * hw, pRLz = car.z - fz * car.b - rz * hw;
  const pRRx = car.x - fx * car.b + rx * hw, pRRz = car.z - fz * car.b + rz * hw;
  // (groundAt knows about bridge decks; a plain test world only needs heightAt)
  const gy = car.hy + 0.4;
  const hFL = world.groundAt ? world.groundAt(pFLx, pFLz, gy) : world.heightAt(pFLx, pFLz);
  const hFR = world.groundAt ? world.groundAt(pFRx, pFRz, gy) : world.heightAt(pFRx, pFRz);
  const hRL = world.groundAt ? world.groundAt(pRLx, pRLz, gy) : world.heightAt(pRLx, pRLz);
  const hRR = world.groundAt ? world.groundAt(pRRx, pRRz, gy) : world.heightAt(pRRx, pRRz);
  const groundY = (hFL + hFR + hRL + hRR) / 4;
  car.groundPitch = Math.atan2((hFL + hFR - hRL - hRR) / 2, L);       // nose-up positive
  car.groundRoll = Math.atan2((hFL + hRL - hFR - hRR) / 2, s.track);   // left side high -> rolls right
  const surfF = world.surfaceAt(car.x + fx * car.a, car.z + fz * car.a, gy);
  const surfR = world.surfaceAt(car.x - fx * car.b, car.z - fz * car.b, gy);
  const sf = SURF[surfF] || SURF[0], sr = SURF[surfR] || SURF[0];
  car.surface = world.surfaceAt(car.x, car.z, gy);

  // ---- water
  const wl = world.waterLevelAt ? world.waterLevelAt(car.x, car.z) : world.meta.riverLevel;
  const depth = car.surface === WATER ? wl - groundY : 0;
  if (!car.inWater && depth > 0.55 && car.hy < wl + 0.4) { car.inWater = true; car.waterTime = 0; car.waterLevel = wl; }
  if (car.inWater && (car.surface === WATER ? wl - groundY : wl - groundY + 0.25) < 0.35) {
    // washed or jumped out onto land: drive on from here
    car.inWater = false; car.sunk = false; car.waterTime = 0;
    car.hy = car.y = Math.max(car.y, groundY); car.vyUp = 0; car.lastGround = null;
  }
  if (car.inWater) {
    car.waterTime += dt;
    const k = Math.exp(-dt * 1.6);
    car.vx *= k; car.vy *= k; car.yawRate *= Math.exp(-dt * 2.5);
    // weak push from the last of the wheelspin, river current
    const still = Math.max(0, 1 - car.waterTime / 2.5);
    car.vx += (up - down) * 1.2 * still * dt;
    const wxv = car.vx * fx + car.vy * rx + 0.08 * dt * 60 * 0.02, wzv = car.vx * fz + car.vy * rz + 0.3 * dt * 60 * 0.02;
    car.x += wxv * dt; car.z += wzv * dt;
    car.yaw += car.yawRate * dt;
    // float for a moment, then go down nose first
    const floatY = car.waterLevel - 0.45;
    const bedY = world.heightAt(car.x, car.z) + 0.05;
    const sinkStart = 1.8;
    let targetY = floatY;
    if (car.waterTime > sinkStart) targetY = Math.max(bedY, floatY - (car.waterTime - sinkStart) * 0.55);
    car.y += (targetY - car.y) * Math.min(1, dt * 4);
    const going = car.waterTime > sinkStart && car.y > bedY + 0.15;
    const tp = going ? -0.32 : (car.y <= bedY + 0.2 ? car.groundPitch : -0.05);
    car.pitch += (tp - car.pitch) * Math.min(1, dt * 1.5);
    car.roll += (Math.sin(car.waterTime * 1.7) * 0.05 * (going ? 1 : 0.4) - car.roll) * Math.min(1, dt * 2);
    car.rpm *= Math.exp(-dt * 3);
    car.wheelSpin += (car.vx / s.wheelRadius) * dt;
    car.wheelSpinF = car.wheelSpinR = car.wheelSpin; car.slipV = car.slipVF = car.slipVR = 0; car.spin = 0;
    car.steer *= Math.exp(-dt * 3);
    if (!car.sunk && car.y <= Math.max(bedY + 0.2, car.waterLevel - 1.3) + 0.01 && car.waterTime > sinkStart + 0.8) car.sunk = true;
    if (!car.sunk && car.waterTime > 9) car.sunk = true;
    car.ax = 0; car.ay = 0;
    car.hy = car.y; car.vyUp = 0; car.lastGround = null; car.load = 1; car.airborne = false; car.airTime = 0;
    return;
  }

  // ---- heave: the body rides the ground on its springs and flies when the ground drops away
  // faster than it can fall
  const vGround = car.lastGround === null ? 0 : (groundY - car.lastGround) / dt;
  car.lastGround = groundY;
  const comp = groundY + STATIC - car.hy;     // spring travel in use; below zero the wheels hang clear
  let lift = 0;                               // upward acceleration from the suspension
  if (comp > 0) {
    // (a kerb or the lip of a deck is a step in the ground: the damper only sees so much of it)
    lift = SPRING * comp + DAMP * Math.max(-4, Math.min(4, vGround - car.vyUp));
    if (comp > BUMP) lift += 6 * SPRING * (comp - BUMP);
    if (lift < 0) lift = 0;
    if (car.airborne) {
      if (car.airTime > 0.12) car.landed = Math.max(car.landed, Math.min(vGround, 0) - car.vyUp);
      car.airborne = false; car.airTime = 0;
    }
  } else {
    car.airborne = true; car.airTime += dt;
  }
  car.vyUp += (lift - G) * dt;
  car.hy += car.vyUp * dt;
  if (car.hy < groundY - FLOOR) { car.hy = groundY - FLOOR; if (car.vyUp < 0) car.vyUp = 0; }
  // weight on the tyres: light over a crest, heavy in a dip, none in the air
  if (car.airborne) car.load = 0;
  else car.load += (Math.min(2.5, lift / G) - car.load) * Math.min(1, dt * 40);
  const load = car.load;

  // ---- steering: fast at parking speeds, limited near the grip limit when quick
  const steerIn = input.steer !== undefined ? input.steer : (+input.right || 0) - (+input.left || 0);
  const maxLock = 0.6;
  const vS = Math.max(Math.abs(car.vx), 1);
  const gripLock = Math.atan((1.25 * G * L) / (vS * vS));
  const lock = Math.min(maxLock, gripLock);
  // In a slide the front wheels need the slide angle on top of the usual lock
  // to point where the car is going, so the limit is centred on that angle;
  // and like a real steering wheel let go of, a released wheel casters most
  // of the way towards it.
  const sliding = Math.max(0, Math.min(1, (Math.abs(car.slipR || 0) - 0.1) / 0.1));
  const align = sliding > 0 && car.vx > 2 ? sliding * Math.atan2(car.vy + car.a * car.yawRate, car.vx) : 0;
  // Steering against the slide gets the full angle, so opposite lock reaches
  // far enough to catch it. Holding the wheel into the turn is the driver
  // asking for the slide, so the wheels mostly stay where they are put.
  // (a controller's stick or wheel moves off centre gradually, so the caster fades out over the first
  // quarter of its travel instead of switching off; keys are 0 or 1 and see no change)
  const held = Math.min(1, Math.abs(steerIn) / 0.25);
  let holdFollow = HOLD_FOLLOW;
  if (turnInHigh) {
    // (how long the wheel has been held into the slide, and how quickly it is to give way: slowly if the slide
    // began under a wheel already held in, quicker if the driver has just switched into it)
    const into = steerIn * align < 0;
    if (!into) { car.giveT = 0; car.giveDur = sliding > 0 ? TURNIN_SWAP_T : TURNIN_HOLD_T; }
    else car.giveT = (car.giveT || 0) + dt;
    holdFollow = CASTER + (TURNIN_END - CASTER) * Math.min(1, (car.giveT || 0) / (car.giveDur || TURNIN_HOLD_T));
  }
  const follow = CASTER + ((steerIn * align < 0 ? holdFollow : 1) - CASTER) * held;
  let lockIn = lock;
  if (inwardOn && !input.steerDirect) {
    // (held the same way and not countersteering: after INWARD_WAIT the lock grows from the grip limit to full)
    const dirIn = Math.sign(steerIn);
    // (a moment of the tail stepping the other way only eases it back, rather than starting the wait again)
    if (Math.abs(steerIn) < 0.9 || dirIn !== car.inDir) car.inT = 0;
    // (steering against the way the car rotates is catching a slide: that eases it back. Judged by the rotation, not
    // the slide angle: in a tight floored turn at full lock the front axle's path points into the turn as well,
    // which read as countersteering and halved the lock at 40 km/h, Martin's bZ4X plot 2026-11-22)
    else car.inT = Math.max(0, (car.inT || 0) + (steerIn * car.yawRate < -0.1 ? -2 * dt : dt));
    car.inDir = dirIn;
    lockIn = lock + Math.max(0, Math.min(maxLock, inwardCap(Math.abs(car.vx) * 3.6)) - lock) * Math.min(1, Math.max(0, (car.inT - INWARD_WAIT) / INWARD_T));
  }
  // Catching a slide: held opposite lock points the wheels past the direction
  // of travel, and once the tail swings back that extra lock keeps rotating
  // the car, flinging it into a slide the other way (a tank-slapper). A driver
  // unwinds the wheel as the tail comes back. Here the opposite lock eases off
  // when the rear slip angle is on course to pass zero within CATCH_T, and
  // stays eased for a moment afterwards while the same key is still held.
  const sR = car.slipR || 0, dsR = (sR - (car.slipRPrev ?? sR)) / dt;
  car.slipRPrev = sR;
  let over = 0;
  if (steerIn !== 0 && steerIn * align > 0 && Math.abs(sR) > 0.03) {
    const pred = sR + dsR * CATCH_T;
    if (pred * sR < 0) over = Math.min(1, -pred / sR);
    car.csDir = Math.sign(steerIn);
  }
  if (steerIn === 0 || Math.sign(steerIn) !== car.csDir) car.csHold = 0;
  else car.csHold = Math.max(over, car.csHold - dt * 1.5);
  // (but not while the driver is flicking the car from one side to the other on spinning rear wheels at
  // low speed: in a figure eight the swing through the middle is wanted, and unwinding the wheel there cut
  // the slide for a moment before it carried on, Martin 2026-11-21. Above about 45 km/h, or off the
  // throttle, the help is as before.)
  const flick = (throttle > 0.5 ? Math.min(1, Math.max(0, (car.slipVR - 2) / 3)) : 0) * Math.min(1, Math.max(0, (CATCH_FLICK_KMH + 5 - speed * 3.6) / 10));
  const catchK = car.csHold * (1 - flick);
  const ease = 1 - CATCH * catchK;
  // As soon as the slide shows signs of coming back (the rear slip angle shrinking), the steering's
  // own share of the opposite lock backs off, so a recovering car is not flung the other way: the
  // driver catches the exit by winding the wheel back and adding throttle.
  const back = sR * dsR < 0 && Math.abs(sR) > 0.04 ? Math.min(1, (-dsR * Math.sign(sR) - 0.1) / 0.5) : 0;
  car.recov = back > (car.recov || 0) ? car.recov + (back - car.recov) * Math.min(1, dt * 25) : Math.max(0, (car.recov || 0) - dt * 2.5);
  const auto = 1 - RECOVER * car.recov;
  let target = Math.max(-maxLock, Math.min(maxLock, (steerIn * lockIn + align * follow * auto) * ease));
  // (unwinding is quick: in a slide the wheel spins back through your hands)
  let rate = ((2.6 - 0.9 * held) * Math.max(lock, 0.08) + 0.25) * (1 + 2 * catchK);
  // (?inward=1: the wheels wound in past the grip lock come back as quickly as from a normal full lock: the
  // unwinding speed is that of full lock at a crawl, not the slower one of the speed's grip lock, Martin 2026-11-22)
  if (inwardOn && Math.abs(target) < Math.abs(car.steer)) rate = Math.max(rate, ((2.6 - 0.9 * held) * maxLock + 0.25) * (1 + 2 * catchK));
  if (input.steerDirect) {
    // A steering wheel: the front wheels follow its angle (about 13:1 over a wheel calibrated stop to
    // stop), with a little of the slide's caster since the wheel cannot push back, and kept within a
    // little past the grip limit around the slide so a quick turn at speed cannot tip the car over.
    const want = steerIn * maxLock + align * CASTER * 0.5 * (1 - held);
    target = Math.max(-maxLock, Math.min(maxLock, Math.max(align - lock * 1.15, Math.min(align + lock * 1.15, want))));
    rate = 7;
  }
  const ds = target - car.steer;
  car.steer += Math.sign(ds) * Math.min(Math.abs(ds), rate * dt);
  const sd = Math.sin(car.steer), cd = Math.cos(car.steer);

  // ---- vertical loads with longitudinal transfer
  const transfer = (m * car.ax * s.cgHeight) / L;
  // (in the air a trace of load is kept so nothing below divides by zero)
  const tl = Math.max(load, 1e-4);
  const fzF = Math.max(0.1 * m * G, (m * G * car.b) / L - transfer) * tl;
  const fzR = Math.max(0.1 * m * G, (m * G * car.a) / L + transfer) * tl;

  // ---- slip angles
  const v0 = 2.0;
  const vLatF = -car.vx * sd + (car.vy + car.a * car.yawRate) * cd;
  const vLonF = car.vx * cd + (car.vy + car.a * car.yawRate) * sd;
  const vLatR = car.vy - car.b * car.yawRate;
  const slipF = Math.atan2(vLatF, Math.max(Math.abs(vLonF), v0));
  const slipR = Math.atan2(vLatR, Math.max(Math.abs(car.vx), v0));
  car.slipR = slipR;

  // ---- longitudinal forces
  const dir = car.reversing ? -1 : 1;
  const hb = +input.handbrake || 0;
  const drivenF = s.drive !== 'rwd', drivenR = s.drive !== 'fwd';
  // (wide performance tyres: spec.grip scales every surface)
  const tyre = s.grip ?? 1;
  // No surface grips the same everywhere: dust, damp, ruts and worn patches a few metres across
  // (more on loose ground than on paving), so a slide or a donut never repeats itself exactly.
  const patch = (x, z, k) => 1 + k * (0.55 * Math.sin(x * 0.83 + Math.sin(z * 0.31) * 2.1) * Math.sin(z * 0.71 + 1.3) + 0.45 * Math.sin((x + z) * 0.37 + Math.sin(x * 0.19) * 1.7));
  const pF = patch(car.x + fx * car.a, car.z + fz * car.a, surfF === 1 ? 0.05 : 0.13);
  const pR = patch(car.x - fx * car.b, car.z - fz * car.b, surfR === 1 ? 0.05 : 0.13);
  const capF = sf.mu * tyre * fzF * pF, capR = sr.mu * tyre * fzR * pR;
  // traction left on each driven axle once cornering has taken its share
  const lonF = drivenF ? capF * Math.sqrt(1 - LON_SHARE * car.useF * car.useF) : 0;
  const lonR = drivenR ? capR * Math.sqrt(1 - LON_SHARE * car.useR * car.useR) : 0;
  const drive = engineForce(car, throttle, dt, hb);
  const vSign = Math.abs(car.vx) > 0.05 ? Math.sign(car.vx) : 0;
  // (held on the brakes at a standstill, as in a burnout, the pads grip like static friction: whatever
  // pushes the car is met up to the brakes' and tyres' limit, so it creeps at most a few cm a second)
  const bSign = Math.max(-1, Math.min(1, car.vx / 0.05));
  const brakeTotal = brake * (s.brakeG ?? 1.05) * m * G * Math.min(1, load * 4);
  // (in a burnout the brake is held just hard enough to pin the front wheels rather than stamped on, so the
  // rear brakes fight the engine a little less: the 190E only just manages it, revs struggling; the front
  // brakes grip like static friction at a standstill, see bSign)
  const brakeF = brakeTotal * 0.66, brakeR = brakeTotal * 0.34 * (1 - BURN_REAR * car.burn * Math.min(1, car.burnT / BURN_FEEL));
  // Share of the drive sent to the rear axle. Two-motor EVs have a fixed
  // split set by their motors; an on-demand coupling sends more to the rear
  // only once the front wheels start to spin. Nothing moves torque towards
  // the axle with grip to spare, so a rear-biased car that floors it on a
  // loaded rear axle can break the tail loose while the front still grips.
  const base = s.drive === 'rwd' ? 1 : s.drive === 'fwd' ? 0 : s.rearShare ?? 0.5;
  let shareR = s.rearShareMax ? base + (s.rearShareMax - base) * Math.min(1, car.slipVF / 2) : base;
  // A two-motor EV sets its split in software. Floored in a slide at modest
  // speed it lets the rear motor do more of the work, so the front wheels stop
  // dragging the car straight and the slide can be held on the throttle
  // (as the drift modes of powerful twin-motor cars do).
  const bodySlip = Math.abs(Math.atan2(car.vy, Math.max(car.vx, 1)));
  if (donutHelp && s.drive === 'awd' && s.engine.type === 'ev' && throttle > 0.5 && !car.reversing) {
    const kSlide = Math.min(1, Math.max(0, (bodySlip - 0.08) / 0.15)) * Math.min(1, Math.max(0, (110 - speed * 3.6) / 30));
    car.evSlide = (car.evSlide || 0) + (kSlide * throttle - (car.evSlide || 0)) * Math.min(1, dt * 4);
  } else car.evSlide = (car.evSlide || 0) * Math.exp(-dt * 4);
  if (car.evSlide > 0) shareR += (Math.max(shareR, EV_SLIDE_REAR) - shareR) * car.evSlide;
  const shareF = 1 - shareR;
  // inertia of motor/engine, driveline and wheels as felt at each axle's tread
  const e = s.engine;
  const ratio = e.type === 'ev' ? s.gears[0] : (car.reversing ? s.reverse : s.gears[car.gear - 1]) * s.finalDrive;
  const motorI = (e.type === 'ev' ? 0.05 : 0.13) * ratio * ratio;
  let fxF, fxR, askF, askR;       // ask = demand over grip, for the skid marks only
  let fySpinF = null, fySpinR = null;
  // Wheelspin. When the engine asks for more than an axle's tyres can pass
  // on, the surplus spins those wheels (and the engine with them) up instead
  // of being trimmed away. slipVF/slipVR are how much faster the tread runs
  // than the road. A spinning tyre pushes against the direction its contact
  // patch slides in, with `tail` of its peak grip: the faster it spins, the
  // more of that goes into driving the car on and the less is left to hold
  // the car sideways. That is what lets the throttle hold or tighten a slide,
  // and lifting end it.
  const ts = drivenR ? (drivenF ? (sf.tail < sr.tail ? sf : sr) : sr) : sf;
  let spinMax = 0, drive_cut = false;
  const absOn = [0, 0];
  // (the electronics stay out of a burnout: brake and throttle together is the driver asking for one)
  // (and floored at low speed it stays out of the way, as in a manual: the tyres light up from a standstill,
  // and a flick where the wheel passes the centre or the car swings round backwards keeps its wheelspin
  // instead of the tyres being pulled back to grip mid swing; Martin 2026-11-21)
  const tcLow = throttle >= 0.9 ? Math.min(1, Math.max(0, (Math.hypot(car.vx, car.vy) * 3.6 - TC_FLOOR_KMH) / 10)) : 1;
  const tcWant = s.tc && Math.abs(steerIn) < 0.1 && !hb && !car.burn ? s.tc * tcLow : 0;
  const tcNow = car.tcK ?? tcWant;
  car.tcK = Math.max(0, Math.min(1, tcNow + Math.max(-dt * 8, Math.min(dt * 4, tcWant - tcNow))));
  const evFront = e.type === 'ev' && s.drive !== 'rwd';
  const axle = (front, share, surf, cap, lon, alpha, brakeK) => {
    let slipV = front ? car.slipVF : car.slipVR;
    const kappa = slipV / Math.max(Math.abs(car.vx), 3);
    let demand = drive * dir * share - brakeK;
    // A front e-motor's own torque control keeps its wheels near peak grip,
    // as on the real cars (otherwise no AWD EV reaches its factory 0-100).
    // The rear motor gets no such help, so power oversteer stays possible.
    if (front && evFront && demand > lon) { demand = lon; if (share > 0) drive_cut = true; }
    // Traction control (spec.tc): with the wheel held straight the electronics trim the drive to what the
    // tyres can pass on. It lets go as soon as the driver steers or pulls the handbrake.
    let trimmed = false;
    if (car.tcK > 0 && share > 0 && throttle > 0) {
      // (once the tyres are past their peak it backs off further, to pull them down again)
      // (tcSlip > 1: when the pedal is stabbed on the move, a sport setting lets the tyres spin up past
      // their peak a little before it steps in; a standing start stays clean)
      const k = (car.stabV ?? 0) > 2 ? s.tcSlip ?? 1 : 1;
      const allow = lon * k * Math.max(0, 1 - 2 * Math.max(0, kappa / (surf.kp * k) - 1));
      if (demand > allow) { demand = allow + (demand - allow) * (1 - car.tcK); trimmed = true; }
    }
    // A tyre already sliding sideways has no grip to spare for drive, so any
    // drive torque spins it up (and the revs with it) rather than the wheel
    // rolling with the road while the car slides.
    const sideSlide = Math.abs(Math.tan(alpha)) * surf.b / 2.3 > 1;
    const spinning = share > 0 && throttle > 0 && !(hb && !front) && (demand > lon || kappa > surf.kp || (sideSlide && demand > 0));
    let fx, fy = null, ask;
    if (spinning) {
      const sx = kappa / surf.kp, sy = Math.abs(Math.tan(alpha)) * surf.b / 2.3;
      const sig = Math.hypot(sx, sy) + 1e-6;
      // (a burnout's tread scrubbing on one spot heats and melts the rubber, which then grips far less)
      const melt = 1 - BURN_MELT * (front ? car.heatF || 0 : car.heatR || 0);
      const g = (sig < 1 ? sig * (2 - sig) : surf.tail + (1 - surf.tail) * Math.exp(-(sig - 1) / 3)) * melt;
      const f = cap * g;
      const sent = (f * sx) / sig;
      fx = dir * sent;
      // (a little sideways bite always remains, so slides stay catchable)
      fy = -Math.sign(alpha) * Math.max((f * sy) / sig, LAT_KEEP * melt * cap * Math.min(1, sy));
      // (Above first gear the spin builds more slowly, GEAR_SPIN_LAG per gear up: a tyre spinning faster
      // and faster heats, smears and scrubs more rubber, so a shift up mid donut or burnout drops the
      // revs and lets them climb back gradually instead of flaring straight to the limiter.)
      const mEq = (motorI * share + 2.5) / (s.wheelRadius * s.wheelRadius) * (e.type === 'ev' || car.reversing ? 1 : 1 + GEAR_SPIN_LAG * (car.gear - 1));
      slipV = Math.max(0, slipV + ((demand - sent) / mEq - car.ax * dir) * dt);
      const spin = Math.max(0, Math.min(1, (kappa - surf.kp) / 0.6));
      spinMax = Math.max(spinMax, spin);
      ask = 1.3 + 0.4 * spin;
    } else {
      // gripping: the tread creeps just enough to carry the force
      const d = throttle > 0 && share > 0 && lon > 0 ? Math.max(0, Math.min(1, demand / lon)) : 0;
      const slipEq = (1 - Math.sqrt(1 - d)) * surf.kp * Math.max(Math.abs(car.vx), 3);
      slipV += (slipEq - slipV) * Math.min(1, dt * 25);
      fx = ((drive_cut && front) || trimmed ? demand * dir : drive * share - bSign * brakeK);
      if (hb && !front) fx = -vSign * surf.mu * fzR * 0.95;
      ask = hb && !front ? 2 : Math.abs(fx) / cap;
      // Anti-lock brakes (spec.abs): instead of locking, each axle is held just short of its peak, and short
      // of what the tyres need for cornering, so the car keeps steering under a full stop. The pressure
      // cycles a few times a second, as an early three-channel system does.
      if (s.abs && brakeK > 0 && vSign !== 0 && !(hb && !front) && Math.abs(car.vx) > 1.5) {
        const use = front ? car.useF : car.useR;
        const pulse = 0.5 + 0.5 * Math.sin(car.time * ABS_HZ * 2 * Math.PI + (front ? 0 : 1.7));
        const room = cap * Math.max(0.3, Math.sqrt(Math.max(0, 1 - use * use))) * (0.97 - 0.05 * pulse);
        if (Math.abs(fx) > room) {
          const k = s.abs;
          fx = Math.sign(fx) * (room * k + Math.min(Math.abs(fx), cap) * (1 - k));
          ask = Math.min(ask, 1 + (ask - 1) * (1 - k));
          absOn[front ? 0 : 1] = k;
        }
      }
      fx = Math.max(-cap, Math.min(cap, fx));
    }

    if (front) { car.slipVF = slipV; fxF = fx; fySpinF = fy; askF = ask; }
    else { car.slipVR = slipV; fxR = fx; fySpinR = fy; askR = ask; }
    // Tyre heat in a burnout: builds over BURN_HEAT_T while the tread spins well ahead of the road with both
    // pedals down, and cools quickly once the brake is off. The first moment of a burnout, on cool tyres,
    // the rears push the car forward a little before the heat lets the front brakes hold it.
    // (the harder the car is held, the longer the tread scrubs the same spot: easing the brake cools it)
    const hot = spinning ? car.burn * Math.min(1, brake / BURN_PRESS) * Math.min(1, Math.max(0, (slipV - 0.5) / 3)) : 0;
    const h0 = (front ? car.heatF : car.heatR) || 0;
    const h1 = h0 + (hot - h0) * Math.min(1, dt / (hot > h0 ? BURN_HEAT_T : BURN_COOL_T));
    if (front) car.heatF = h1; else car.heatR = h1;
  };
  // (the clutch dropped after a handbrake turn, see engineForce: more of the sudden spin goes to the axle
  // with more of the drive)
  if (car.dump > 0) { car.slipVF += car.dump * 2 * shareF; car.slipVR += car.dump * 2 * shareR; }
  car.dump = 0;
  axle(true, shareF, sf, capF, lonF, slipF, brakeF);
  axle(false, shareR, sr, capR, lonR, slipR, brakeR);
  car.spin = spinMax;
  // the engine (or the motor on the faster axle) turns with its spinning wheels
  car.slipV = shareF === 0 ? car.slipVR : shareR === 0 ? car.slipVF : Math.max(car.slipVF, car.slipVR);
  let latCapF = Math.sqrt(Math.max(capF * capF - fxF * fxF, (0.55 * capF) ** 2));
  let latCapR = Math.sqrt(Math.max(capR * capR - fxR * fxR, (0.55 * capR) ** 2));
  // (a rolling tyre held off its lock keeps most of its sideways bite)
  if (absOn[0]) latCapF = Math.max(latCapF, (0.55 + 0.3 * absOn[0]) * capF);
  if (absOn[1]) latCapR = Math.max(latCapR, (0.55 + 0.3 * absOn[1]) * capR);
  car.abs = Math.max(absOn[0], absOn[1]);
  // Hard braking unloads the rear axle, so the front tyres would out-grip the
  // rears and any small disturbance would swing the tail round. While the
  // wheel is held straight the front lateral grip is trimmed to what the rear
  // axle can balance; steering into a corner hands it back, so braking into a
  // turn still rotates the car as before.
  if (brake > 0 && !hb) {
    // (anti-lock brakes keep the rear tyres rolling, so the tail stays put even with the wheel turned)
    const straight = Math.max(0, 1 - Math.abs(car.steer) / (0.5 * lock), 0.85 * car.abs);
    const balanced = (latCapR * car.b) / car.a;
    if (balanced < latCapF) latCapF += (balanced - latCapF) * straight * brake;
  }
  if (hb) latCapR *= 0.45;

  // ---- lateral tyre forces
  // How hard each axle is sliding, 0..1. Read by the skid marks and the tyre
  // sound; nothing in the dynamics depends on it.
  if ((speed > 2.5 || car.slipV > 2) && load > 0.15) {
    const lon = (x) => Math.max(0, Math.min(1, (x - 1.3) / 0.4));
    car.skidF = Math.max(lon(askF), Math.min(1, Math.max(0, (Math.abs(slipF) - 0.12) / 0.1)));
    car.skidR = Math.max(lon(askR), Math.min(1, Math.max(0, (Math.abs(slipR) - 0.12) / 0.1)));
    // Speed of the tread sliding over the road at each axle (m/s), for the tyre smoke and the marks:
    // wheelspin beyond the creep of a gripping tyre, sideways sliding, or the whole road speed when locked.
    const rub = (skid, slipV, vLat, locked) => skid * Math.hypot(locked ? car.vx : Math.max(0, slipV - 0.2 * Math.max(Math.abs(car.vx), 3)), vLat);
    car.rubF = rub(car.skidF, car.slipVF, vLatF, false); car.rubR = rub(car.skidR, car.slipVR, vLatR, hb);
  } else car.skidF = car.skidR = car.rubF = car.rubR = 0;
  let fyF = fySpinF !== null ? fySpinF : -latCapF * Math.sin(1.35 * Math.atan(sf.b * slipF));
  const settle = car.slideMem > 0 ? (v) => 1 - car.slideMem * (1 - Math.min(1, Math.abs(v) / BURN_SETTLE_V)) : null;
  const fyR = fySpinR !== null ? fySpinR * (settle ? settle(vLatR) : 1) : -latCapR * Math.sin(1.35 * Math.atan(sr.b * slipR));
  // A burnout's front wheels, braked past their grip, are locked: they no longer steer, they just slide,
  // pushing back against whichever way the nose is moving. So the brake going on mid donut stops the nose
  // while the car carries on sliding and swinging round it, and the spin dies away over a second or two
  // instead of the locked wheels, still pointing into the turn, snapping it straight (Martin 2026-11-21).
  // (locked once the brake and the cornering together ask more than the tyres have, and only as far as the
  // brake itself has squeezed on: braked at a donut's quickest moment, the wheels' cornering load alone locked
  // them at the first touch, the nose stopped dead and the slide died in a second instead of fading)
  const lockF = !drivenF && car.burn > 0 && fySpinF === null ? car.burn * Math.min(1, Math.max(0, (Math.hypot(brakeF, fyF) / capF - 0.9) / 0.2)) * Math.min(1, Math.abs(brakeF) / capF) : 0;
  if (lockF > 0) {
    const ux = car.vx, uy = car.vy + car.a * car.yawRate, un = Math.max(Math.hypot(ux, uy), BURN_SLIDE_V);
    const bx = -capF * ux / un, by = -capF * uy / un;
    fxF += (bx * cd + by * sd - fxF) * lockF;
    fyF += ((by * cd - bx * sd) * (settle ? settle(uy * cd - ux * sd) : 1) - fyF) * lockF;
  }

  // ---- resistances and slope
  const drag = 0.5 * RHO * s.cdA * car.vx * Math.abs(car.vx);
  const crr = (sf.crr * fzF + sr.crr * fzR);
  const roll = Math.abs(car.vx) > 0.1 ? Math.sign(car.vx) * crr : 0;
  const slopeX = -m * G * Math.sin(car.groundPitch) * load;     // the slope pushes through the tyres
  const slopeY = m * G * Math.sin(car.groundRoll) * load;

  const FX = fxF * cd - fyF * sd + fxR - drag - roll + slopeX;
  const FY = fyF * cd + fxF * sd + fyR + slopeY - 0.5 * RHO * s.cdA * 1.6 * car.vy * Math.abs(car.vy);
  let MZ = car.a * (fyF * cd + fxF * sd) - car.b * fyR;
  // Spinning wheels never bite evenly left and right, so a hard launch tugs
  // the car a touch off line, more so on rough ground.
  if (car.spin > 0) {
    const wob = Math.sin(car.time * 1.7 + 1.3) + 0.5 * Math.sin(car.time * 4.3 + car.x * 0.3);
    MZ += hw * (fxF + fxR) * SPIN_YAW * car.spin * wob * (1 + ts.bump);
  }
  // Donuts. Held at full lock and full throttle on spinning wheels, the model
  // car would rotate past 90 degrees, scrub off its speed, then snap straight
  // as the wheels found grip and drive it forward, a few seconds per cycle.
  // A driver feathers the throttle and wheel to stop that; here a gentle yaw
  // moment does it, keeping the slide angle inside DONUT_LO..DONUT_HI while
  // the wheel is held into the rotation, the pedal down and the wheels spin.
  // (a quick lift and re-press mid-donut picks up where it left off; only a
  // longer break makes the next one wait for the revs again)
  // (the hold does not push the tail round while the car has hardly any speed and is not yet turning: from
  // a near standstill or out of a burnout on full lock the tail comes out as the car gathers pace, not in a
  // flick; Martin 2026-11-21: the tail still stepped out fast with no speed or momentum to swing it. A donut
  // that has slowed but still turns is kept going, and a bus is left alone: it can only just swing its tail
  // on loose ground as it is.)
  const weakCar = (s.ref?.powerKw ?? 100) / s.mass < 0.03;
  const pushGate = weakCar || (car.slideMem > 0 && brake > 0) ? 1 : Math.min(1, Math.max(0, (speed * 3.6 - DONUT_PUSH_KMH) / DONUT_PUSH_RAMP));
  let want = 0, rise = DONUT_EASE;
  // (a donut let go of on the throttle alone, the wheel still held, comes back gently once the pedal goes down again)
  if (!(throttle > 0.5) && car.inDonut) car.liftSoft = 1;
  if (!(Math.abs(steerIn) > 0.5)) { car.liftSoft = 0; car.donutYaw = undefined; }
  if (!(throttle > 0.5 && !car.reversing && Math.abs(steerIn) > 0.5 && load > 0.3)) { car.donutAng = undefined; car.inDonut = false; car.bandT = 0; car.donutVmax = 0; car.donutT = Math.max(0, Math.min(DONUT_WAIT + 1.2, car.donutT || 0) - dt * 1.5); }
  else {
    car.donutT = (car.donutT || 0) + dt;
    const turn = Math.sign(steerIn);
    const ang = -turn * Math.atan2(car.vy, car.vx);          // slide angle, tail out positive
    // (looking a moment ahead, so a fast swing is met before it overshoots)
    const dAng = car.donutAng === undefined ? 0 : Math.max(-6, Math.min(6, (ang - car.donutAng) / dt));
    car.donutAng = ang;
    // (nearly stopped, the direction of travel and so the slide angle swing wildly from one moment to the
    // next: the hold is faded out under a walking pace rather than flung from one side to the other)
    const sure = Math.min(1, Math.max(0, (speed - 0.3) / 1.2));
    const angP = ang + DONUT_LEAD * dAng * sure * sure;
    const spinW = Math.min(1, car.slipVR / 4);      // (the rear wheels: a front driver washes wide)
    const slow = Math.min(1, Math.max(0, (70 - speed * 3.6) / 30));
    const w = throttle * Math.min(1, (Math.abs(steerIn) - 0.5) / 0.4) * spinW * slow;
    // No two laps of a real donut are alike. On the very powerful cars the
    // hold drifts now and then (more so on a tilted patch of road), so the
    // car swings round too far, bogs down for a moment and then gets going again.
    const kw = (s.engine.maxPowerKw ?? s.ref?.powerKw ?? 0) / m;      // kW per kg
    const pw = 0.6 + 0.4 * Math.min(1, Math.max(0, (kw - 0.08) / 0.17));
    let lo = DONUT_LO, hi = DONUT_HI, tuck = 0, sway = 0;
    {
      // two slow, unrelated swells (and the lie of the ground) decide when the car swings too far
      // round and bogs, and when the tail tucks in so it runs on a few metres before coming round again
      const tm = car.time;
      const n = 0.6 * Math.sin(tm * 0.83 + 1.7) + 0.4 * Math.sin(tm * 0.31 + car.x * 0.05);
      const q = 0.55 * Math.sin(tm * 0.57 + 0.4 + car.z * 0.04) + 0.45 * Math.sin(tm * 0.23 + 2.9);
      const tilt = Math.min(0.15, Math.hypot(car.groundPitch, car.groundRoll));
      const slack = Math.min(1, pw * (Math.max(0, n - 0.4) * 3 + tilt * 6));
      tuck = Math.min(1, pw * Math.max(0, q - 0.45) * 3.5);
      lo += 0.75 * slack - 0.5 * tuck; hi += 0.55 * slack - 0.3 * tuck;
      // ...and in between the hold itself breathes, as a driver's hands and feet never stay still
      sway = Math.max(-1, Math.min(1, 0.6 * n * pw - 1.2 * tuck + 0.4 * slack));
    }
    // (a donut is under way once the tail has been out in its band; it ends when the wheel or the throttle is
    // let go, or when a burnout has brought the car to a stop. Until then the push that starts the tail out is
    // gentler, DONUT_START, and builds up more slowly, DONUT_RISE, so the step-out begins softly (Martin
    // 2026-11-21: the beginning of the flick was abrupt); once under way a donut that bogs down is pushed on
    // as before, whatever its speed)
    // (a figure eight turns the wheel the other way: the donut that way starts afresh, gently, rather than
    // being pushed at full strength from the first moment; and after a lift the tail must be out in its band
    // for DONUT_SETTLE again, so a slide that collapses as the car crawls is not flung back out at full
    // strength either. Martin 2026-11-21: both flicked out abruptly and unnaturally.)
    if (car.donutTurn !== turn) { car.donutTurn = turn; car.inDonut = false; car.bandT = 0; car.liftSoft = 0; car.donutYaw = undefined; }
    if (ang > lo && (car.bandT = (car.bandT || 0) + dt) > DONUT_SETTLE) car.inDonut = true;
    if (car.burn > 0 && brake > 0 && speed < 1) car.inDonut = false;
    if (!car.inDonut && !weakCar) rise = DONUT_RISE;
    // (a donut begun from a run that has bogged down to a crawl or all but stopped turning, as the first flick's sideways
    // run has just died away, gets going again softly: its push is gentler and builds up slowly, and stays
    // so for a moment after the car picks up, so it is not flicked round again. Martin 2026-11-21: a brief
    // stop after the first flick, then a quicker flick)
    car.donutVmax = Math.max(car.donutVmax || 0, speed * 3.6);
    const bog = car.bog = car.inDonut && !weakCar && car.donutVmax > DONUT_BOG_FROM ? Math.max(Math.min(1, Math.max(0, (DONUT_BOG_KMH - speed * 3.6) / 3, (DONUT_BOG_YAW - car.yawRate * turn) / 0.3)), (car.bog || 0) - dt / DONUT_BOG_T) : 0;
    // (after a quick lift mid donut the same: the push comes back at half strength and builds up slowly over
    // DONUT_LIFT_T, rather than flinging the tail round as soon as the tail is back in its band. Martin
    // 2026-11-21: the 200 Avant flicked round heavily after a quick lift; on four driven wheels the slide
    // angle does not build, so the push all went into spinning the car faster)
    const liftK = car.liftSoft = !weakCar ? Math.max(0, (car.liftSoft || 0) - dt / DONUT_LIFT_T) : 0;
    const soft = Math.max(bog, liftK);
    // (the rate the donut was turning at, so that after a lift it is brought back to that, not past it)
    if (car.inDonut && !(liftK > 0)) car.donutYaw = (car.donutYaw ?? car.yawRate * turn) + (car.yawRate * turn - (car.donutYaw ?? car.yawRate * turn)) * Math.min(1, dt / 0.8);
    const liftCap = liftK > 0 && car.donutYaw !== undefined ? 1 - Math.min(1, 2 * liftK) * (1 - Math.min(1, Math.max(0, (car.donutYaw + LIFT_OVER - car.yawRate * turn) / 0.4))) : 1;
    car.kickSoft = liftK;
    if (soft > 0 && car.inDonut) rise = DONUT_EASE + (DONUT_BOG_RISE - DONUT_EASE) * soft;
    if (w > 0) {
      let err = 0;
      // (only a true donut, near full lock at low speed, is pushed round; a
      // floored corner is just kept from over-rotating)
      // From a standstill the push waits for the revs and the wheelspin to
      // build first, so the tail comes round with the engine, not ahead of it.
      if (angP < lo && ang > -0.3 && Math.abs(steerIn) > 0.85 && speed < 10) {
        // (loose ground lets go more easily, so there it waits a touch longer)
        const wait = DONUT_WAIT + (surfR === 1 ? 0 : 0.2);
        const build = Math.min(1, Math.max(0, (car.donutT - wait) / 1.0));
        err = Math.min(1, (lo - angP) / 0.5) * build * (1 - 0.7 * tuck) * (car.inDonut || weakCar ? 1 - (1 - DONUT_BOG_PUSH) * soft : DONUT_START);
      }
      else if (angP > hi) err = -Math.min(1, (angP - hi) / 0.35);
      // The wander belongs to a donut, so it fades out above donut pace (27..36 km/h). And the hold never
      // pushes against the rotation until the tail is well out (17..34 deg): floored at full lock on
      // spinning rear wheels, picking up speed out of a donut or a slide, the car must come round into the
      // lock, not run wide (Martin 2026-11-20: a few seconds of strong understeer at about 30 km/h, when
      // the tucking wander or a fast-swinging tail had the hold straightening the car).
      let k = err + DONUT_SWAY * sway * (angP > lo - 0.5 ? 1 : 0) * Math.min(1, Math.max(0, (10 - speed) / 2.5));
      // (and holding it back only ever slows the rotation: it never swings the car back against the lock,
      // which had it skating sideways in a straight line for a second)
      if (k < 0) k *= Math.min(1, Math.max(0, (ang - 0.3) / 0.3)) * Math.min(1, Math.max(0, car.yawRate * turn / 0.3));
      // (and pushing, whether to start the rotation or as the hold's wander, stops once the car turns as fast
      // as a held donut does, leaving the tyres to carry on. At walking pace there is no momentum to swing the
      // tail hard: pushing on had the car whipping round at nearly twice a donut's rate and then hanging past
      // 80 deg, Martin 2026-11-21.)
      else k *= liftCap * Math.min(1, Math.max(0, (DONUT_SPIN - car.yawRate * turn) / 0.6)) * (car.inDonut ? 1 : Math.max(pushGate, Math.min(1, Math.max(0, (car.yawRate * turn - DONUT_TURNING) / 0.5))));
      // (rotating against the wheel already: leave the driver to sort it out)
      // (with the brake on as well the donut is over: no holding it in its band, the car slides on as it will)
      if (car.yawRate * turn > -0.2) want = turn * k * w * (1 - Math.min(1, car.burn * brake / BURN_SLIDE_HOLD));
    }
  }
  if (!donutHelp) want = 0;      // (helper off, the default: the tyres alone)
  // (and whatever it is doing, the hold eases off while the car already swings its way quickly, so it never adds
  // its own whip on top of the tyres': in figure eights and after a lift it had the tail out at 300-400 deg/s2)
  { const ya = car.yawPrev === undefined ? 0 : (car.yawRate - car.yawPrev) / dt; car.yawPrev = car.yawRate;
    car.yawAcc = (car.yawAcc || 0) + (ya - (car.yawAcc || 0)) * Math.min(1, dt / KICK_TAU); }
  if (want) { const kA = KICK_A * (1 - LIFT_KICK * (car.kickSoft || 0)); want *= Math.min(1, Math.max(0, (kA + KICK_BAND - car.yawAcc * Math.sign(want)) / KICK_BAND)); }
  // (the hold's moment moves at most DONUT_EASE per second, so it never jumps from a full push to a hold)
  { const m0 = car.donutM || 0, dm = want - m0, r = dm * m0 >= 0 && Math.abs(want) > Math.abs(m0) ? rise : DONUT_EASE;
    car.donutM = m0 + Math.max(-r * dt, Math.min(r * dt, dm)); }
  if (car.donutM) MZ += car.donutM * DONUT * m * G * L * load;
  // At walking pace a real car cannot whip its tail round: the tyres scrub, the body has to roll and
  // the driveline winds up first. The slip-angle model overstates the bite there (and the donut hold
  // adds its own push), so below about 30 km/h the swing is damped, more so for the cars not driven
  // only at the rear, whose driven front wheels pull the nose straight.
  {
    const lowV = Math.min(1, Math.max(0, (30 - speed * 3.6) / 20));
    if (lowV > 0) {
      // (rear-driven cars get less of it; none for the twin-motor EVs, built to hold a donut, or for a
      // bus, which can only just swing its tail on loose ground as it is)
      const weak = (s.ref?.powerKw ?? 100) / s.mass < 0.03;
      const k = LOW_YAW_DAMP * (weak || s.engine.type === 'ev' ? 0 : s.drive === 'rwd' ? 0.25 : 1) * lowV;
      MZ -= k * car.iz * car.yawRate;
    }
  }
  const uF = Math.min(1, Math.abs(fyF) / capF), uR = Math.min(1, Math.abs(fyR) / capR);
  car.useF += (uF - car.useF) * Math.min(1, dt * 15);
  car.useR += (uR - car.useR) * Math.min(1, dt * 15);

  const ax = FX / m, ay = FY / m;
  car.ax += (ax - car.ax) * Math.min(1, dt * 20);
  car.ay += (ay - car.ay) * Math.min(1, dt * 20);
  car.vx += (ax + car.vy * car.yawRate) * dt;
  car.vy += (ay - car.vx * car.yawRate) * dt;
  car.yawRate += (MZ / car.iz) * dt;

  // ---- come to a clean stop instead of creeping on rounding noise
  if (load > 0.2 && throttle === 0 && Math.abs(car.vx) < 0.25 && Math.abs(car.vy) < 0.25 && Math.abs(slopeX) < crr + brakeTotal + 0.02 * m * G) {
    car.vx *= Math.exp(-dt * 8); car.vy *= Math.exp(-dt * 12); car.yawRate *= Math.exp(-dt * 12);
    if (Math.abs(car.vx) < 0.02) { car.vx = 0; car.vy = 0; car.yawRate = 0; }
  }
  if (speed < 1.5 && load > 0.2) {
    // (not while the rear wheels spin under throttle: a slide that has swung the car round carries on
    // sideways at a crawl with a little momentum and runs into the drive, rather than stopping dead for a
    // moment first, Martin 2026-11-21)
    const carry = throttle > 0.5 && !(brake > 0) ? Math.min(1, Math.max(0, (car.slipVR - 2) / 3)) * SPIN_CARRY : 0;
    car.vy *= Math.exp(-dt * 6 * (1 - Math.max((car.slideMem || 0) * BURN_SETTLE_DRAG, carry)));
  }

  // ---- integrate pose
  let wvx = car.vx * fx + car.vy * rx, wvz = car.vx * fz + car.vy * rz;
  car.x += wvx * dt; car.z += wvz * dt;
  car.yaw += car.yawRate * dt;

  // ---- collisions
  const hl = car.halfLen, hwid = car.halfWid;
  // push the body out along n (world, pointing away from the obstacle) by pen and bounce the
  // contact point at (ox, oz) from the car centre off it
  const contact = (nx, nz, ox, oz, pen) => {
    car.x += nx * pen; car.z += nz * pen;
    // velocity of the contact point (yaw is clockwise: v + w x r in the x/z plane)
    const pvx = wvx - car.yawRate * oz, pvz = wvz + car.yawRate * ox;
    const vn = pvx * nx + pvz * nz;
    if (vn >= 0) return;
    const rn = ox * nz - oz * nx;
    const j = (-(1 + 0.15) * vn) / (1 / m + (rn * rn) / car.iz);
    // friction along the obstacle
    const tx = -nz, tz = nx;
    const vt = pvx * tx + pvz * tz;
    const rt = ox * tz - oz * tx;
    let jt = -vt / (1 / m + (rt * rt) / car.iz);
    const jtMax = 0.35 * j;
    jt = Math.max(-jtMax, Math.min(jtMax, jt));
    wvx += (j * nx + jt * tx) / m; wvz += (j * nz + jt * tz) / m;
    car.yawRate += (rn * j + rt * jt) / car.iz;
    car.vx = wvx * fx + wvz * fz; car.vy = wvx * rx + wvz * rz;
    car.hit = Math.max(car.hit, -vn);
  };

  // ---- kerbs: each wheel remembers the kerb height where it last ran level and where that was; when it
  // has risen KERB_STEP above it, the wheel has met a kerb face between there and here
  if (world.kerbAt) {
    const KS = car.kerbS || (car.kerbS = Array.from({ length: 4 }, () => ({ h: null, base: 0, bx: 0, bz: 0, armed: false })));
    const sY = Math.sin(car.yaw), cY = Math.cos(car.yaw);
    for (let k = 0; k < 4; k++) {
      const W = KS[k];
      const lx = k < 2 ? car.a : -car.b, ly = k % 2 ? hw : -hw;
      const ox = sY * lx + cY * ly, oz = -cY * lx + sY * ly;
      const wx = car.x + ox, wz = car.z + oz;
      const kb = world.kerbAt(wx, wz);
      // (level: the kerb field flat under the wheel, checked across it only where it is changing)
      let level = W.h === null || car.airborne || Math.abs(kb - W.h) < 1e-4;
      if (!level) level = Math.hypot(world.kerbAt(wx + 0.03, wz) - kb, world.kerbAt(wx, wz + 0.03) - kb) < 0.0045;
      if (level) { W.base = kb; W.bx = wx; W.bz = wz; W.armed = true; }
      W.h = kb;
      if (!W.armed || kb - W.base < KERB_STEP) continue;
      W.armed = false;
      // where on the way it rose, which way the kerb faces there, and how high it is (its top a little behind the face)
      const dx = wx - W.bx, dz = wz - W.bz;
      let t0 = 0, t1 = 1;
      for (let q = 0; q < 7; q++) {
        const tm = (t0 + t1) / 2;
        if (world.kerbAt(W.bx + dx * tm, W.bz + dz * tm) - W.base > (kb - W.base) / 2) t1 = tm; else t0 = tm;
      }
      const ex = W.bx + dx * t1, ez = W.bz + dz * t1, e = 0.03;
      let nx = world.kerbAt(ex - e, ez) - world.kerbAt(ex + e, ez), nz = world.kerbAt(ex, ez - e) - world.kerbAt(ex, ez + e);
      const nl = Math.hypot(nx, nz);
      if (nl < 1e-6) continue;
      nx /= nl; nz /= nl;
      const rise = Math.max(kb, world.kerbAt(ex - nx * 0.15, ez - nz * 0.15)) - W.base;
      const pvx = wvx - car.yawRate * oz, pvz = wvz + car.yawRate * ox;
      const into = -(pvx * nx + pvz * nz), along = Math.abs(pvz * nx - pvx * nz);
      if (into <= 0) continue;
      const sev = Math.min(1.5, Math.max(0.1, (rise - 0.05) / 0.15));
      // a rounded edge (gentle slope across the face) takes less of a knock than a sharp one (Martin, 19 Nov):
      // slope at the face against the 2.5 of a 15 cm kerb with a 9 cm edge, down to about half
      const soft = Math.min(1, Math.max(0.5, nl / (2 * e) / 2.5));
      const rn = ox * nz - oz * nx;
      let dv, turn = 1;
      if (Math.atan2(into, along) < KERB_GLANCE * sev * soft && into < 2.5) {
        // glancing: back off the kerb with the wheel's speed into it gone (and a little bounce)
        const pen = Math.max(0, (wx - ex) * -nx + (wz - ez) * -nz) + 0.02;
        car.x += nx * pen; car.z += nz * pen;
        W.h = W.base; W.armed = true;
        dv = into * 1.15;
        turn = 0.35;           // (a tyre wall sliding along the kerb face hardly twists the car)
        car.kerbHit = Math.max(car.kerbHit || 0, 0.3 * sev * Math.min(1, into / 1.5));
      } else {
        dv = Math.min(into, KERB_KNOCK * sev * soft);
        car.kerbHit = Math.max(car.kerbHit || 0, sev * (0.5 + 0.5 * soft) * Math.min(1, (into + 0.15 * along) / 4));
        car.jolt = Math.max(car.jolt || 0, 0.5 + 0.5 * soft);
      }
      const j = dv / (1 / m + (turn * rn * rn) / car.iz);
      wvx += (j * nx) / m; wvz += (j * nz) / m;
      car.yawRate += (turn * rn * j) / car.iz;
      car.vx = wvx * fx + wvz * fz; car.vy = wvx * rx + wvz * rz;
    }
  }

  // tree trunks: exact circles against the body rectangle
  const trunks = world.trunksNear ? world.trunksNear(car.x, car.z, Math.hypot(hl, hwid) + 1.2, tmpT) : null;
  if (trunks && trunks.length) {
    for (let pass = 0; pass < 2; pass++) {
      for (let t = 0; t < trunks.length; t += 3) {
        const dx = trunks[t] - car.x, dz = trunks[t + 1] - car.z, R = trunks[t + 2] + 0.06;
        const lx = dx * fx + dz * fz, ly = dx * rx + dz * rz;      // trunk in car coordinates
        if (Math.abs(lx) >= hl + R || Math.abs(ly) >= hwid + R) continue;
        const cx = Math.max(-hl, Math.min(hl, lx)), cy = Math.max(-hwid, Math.min(hwid, ly));
        let nlx, nly, pen, px = cx, py = cy;
        if (cx !== lx || cy !== ly) {
          // trunk outside the outline, touching it
          const ex = cx - lx, ey = cy - ly, d = Math.hypot(ex, ey);
          if (d >= R) continue;
          nlx = ex / d; nly = ey / d; pen = R - d;
        } else {
          // trunk got inside the outline (a fast hit): send it back out through the side it came
          // in by, found by tracing back along the car's motion, or the nearest side when slow
          const vl = Math.hypot(car.vx, car.vy);
          let face;
          if (vl > 0.5) {
            const tX = car.vx > 0 ? (hl - lx) / car.vx : car.vx < 0 ? (-hl - lx) / car.vx : Infinity;
            const tY = car.vy > 0 ? (hwid - ly) / car.vy : car.vy < 0 ? (-hwid - ly) / car.vy : Infinity;
            face = tX < tY ? (car.vx > 0 ? 0 : 1) : (car.vy > 0 ? 2 : 3);
          } else {
            const ds = [hl - lx, lx + hl, hwid - ly, ly + hwid];
            face = ds.indexOf(Math.min(...ds));
          }
          if (face === 0) { nlx = -1; nly = 0; pen = hl - lx + R; px = hl; }
          else if (face === 1) { nlx = 1; nly = 0; pen = lx + hl + R; px = -hl; }
          else if (face === 2) { nlx = 0; nly = -1; pen = hwid - ly + R; py = hwid; }
          else { nlx = 0; nly = 1; pen = ly + hwid + R; py = -hwid; }
        }
        contact(fx * nlx + rx * nly, fz * nlx + rz * nly, fx * px + rx * py, fz * px + rz * py, pen);
      }
    }
  }

  // thin solid boxes (guard rails, lane dividers, the walls between carriageways, the map's walls): exact
  // boxes against the body rectangle, by separating axes. The way out is along the axis it overlaps least
  // on, towards the side the car's middle is on, so a car part way into a thin barrier always goes back
  // out the way it came in; the end of a box that another box carries on from (a wall in pieces) is no way
  // out, so a car scraping along one does not catch on the joins.
  const boxes = world.solidsNear ? world.solidsNear(car.x, car.z, Math.hypot(hl, hwid) + 0.5, tmpB) : null;
  if (boxes && boxes.length) {
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k < boxes.length; k++) boxContact(car, boxes[k], boxes, fx, fz, rx, rz, hl, hwid, contact);
    }
  }

  // everything else: the obstacle distance field (buildings, walls, the map edge). Samples next
  // to a trunk or a thin box are left out, those were handled above.
  let worst = 0.12, wpx = 0, wpz = 0, found = false;
  for (let k = 0; k < 10; k++) {
    // corners, side midpoints, bumper centres, quarter points
    const lx = k < 4 ? (k < 2 ? hl : -hl) : k < 6 ? 0 : k < 8 ? (k === 6 ? hl : -hl) : (k === 8 ? hl * 0.5 : -hl * 0.5);
    const ly = k < 4 ? (k % 2 ? hwid : -hwid) : k < 6 ? (k === 4 ? hwid : -hwid) : k < 8 ? 0 : (k === 8 ? hwid : -hwid);
    const ox = fx * lx + rx * ly, oz = fz * lx + rz * ly;
    if (trunks && nearTrunk(trunks, car.x + ox, car.z + oz)) continue;
    if (boxes && boxes.length && nearBox(boxes, car.x + ox, car.z + oz)) continue;
    const d = world.sdfAt(car.x + ox, car.z + oz);
    if (d < worst) { worst = d; wpx = ox; wpz = oz; found = true; }
  }
  if (found) {
    world.sdfGrad(car.x + wpx, car.z + wpz, tmpG);
    const nx = tmpG[0], nz = tmpG[1];
    if (nx !== 0 || nz !== 0) contact(nx, nz, wpx, wpz, 0.12 - worst);
  }

  // ---- bridge railings
  if (world.railPush && world.railPush(car.x, car.z, car.y + 0.4, hwid, tmpR)) {
    const nx = tmpR[0], nz = tmpR[1];
    car.x += nx * tmpR[2]; car.z += nz * tmpR[2];
    const vn = wvx * nx + wvz * nz;
    if (vn < 0) {
      wvx -= 1.1 * vn * nx; wvz -= 1.1 * vn * nz;
      car.vx = wvx * fx + wvz * fz; car.vy = wvx * rx + wvz * rz;
      car.hit = Math.max(car.hit, -vn);
    }
  }

  // ---- walls that only stop a car below their top (the Vanemuine terrace's retaining wall): felt at the nose,
  // the middle and the tail
  if (world.ledgePush) {
    let depth = 0, lnx = 0, lnz = 0;
    for (const k of [0.6, 0, -0.6]) {
      if (world.ledgePush(car.x + fx * hl * k, car.z + fz * hl * k, car.y + 0.4, hwid + 0.25, tmpR) && tmpR[2] > depth) { depth = tmpR[2]; lnx = tmpR[0]; lnz = tmpR[1]; }
    }
    if (depth > 0) {
      car.x += lnx * depth; car.z += lnz * depth;
      const vn = wvx * lnx + wvz * lnz;
      if (vn < 0) {
        wvx -= 1.1 * vn * lnx; wvz -= 1.1 * vn * lnz;
        car.vx = wvx * fx + wvz * fz; car.vy = wvx * rx + wvz * rz;
        car.hit = Math.max(car.hit, -vn);
      }
    }
  }

  // ---- body attitude
  car.y = Math.max(car.hy, groundY - 0.06);     // the drawn wheels may sink a little, not through the road
  const bump = ((sf.bump + sr.bump) / 2) * Math.min(1, speed / 12);
  // (an upshift biting snaps the body back on its springs a little harder than the pull alone, and it
  // shudders as the driveline winds up and springs back: bite)
  const shud = car.bite ? 0.6 + 0.4 * Math.cos((car.time - (car.biteAt ?? car.time)) * 53) : 0;
  const tPitch = car.groundPitch + car.ax * 0.0075 + bump * 0.012 * Math.sin(car.time * 31 + car.x) + (car.bite || 0) * 0.026 * shud;
  const tRoll = car.groundRoll - car.ay * 0.011 + bump * 0.014 * Math.sin(car.time * 27 + car.z * 1.3);
  if (car.airborne) {
    // nothing to turn the body in flight: it keeps the rotation it left the ground with
    car.pitch += car.pitchRate * dt;
    car.roll += car.rollRate * dt;
  } else {
    const p0 = car.pitch, r0 = car.roll;
    // (just after a wheel has rolled up a kerb the body follows the ground at once: the knock)
    const follow = Math.min(1, dt * (9 + 16 * Math.max(car.jolt || 0, car.bite || 0)));
    car.pitch += (tPitch - car.pitch) * follow;
    car.roll += (tRoll - car.roll) * follow;
    const k = Math.min(1, dt * 12);
    car.pitchRate += (Math.max(-0.7, Math.min(0.7, (car.pitch - p0) / dt)) - car.pitchRate) * k;
    car.rollRate += (Math.max(-0.5, Math.min(0.5, (car.roll - r0) / dt)) - car.rollRate) * k;
  }
  const roll1 = (car.vx / s.wheelRadius) * dt, k1 = ((car.reversing ? -1 : 1) / s.wheelRadius) * dt;
  car.wheelSpin += roll1;
  car.wheelSpinF += roll1 + car.slipVF * k1;
  car.wheelSpinR += roll1 + car.slipVR * k1;
}

export function resetCar(car, pose) {
  car.x = pose.x; car.z = pose.z; car.yaw = pose.yaw; car.y = pose.y ?? car.y;
  car.hy = car.y; car.vyUp = 0; car.lastGround = null; car.load = 1;
  car.airborne = false; car.airTime = 0; car.landed = 0; car.pitchRate = car.rollRate = 0;
  car.vx = car.vy = car.yawRate = 0;
  car.steer = 0; car.slipV = car.slipVF = car.slipVR = 0; car.spin = 0; car.useF = car.useR = 0; car.gear = 1; car.shiftTimer = 0; car.manual = 0; car.locked = false; car.reversing = false; car.burnHold = false; car.yawPrev = undefined; car.yawAcc = 0; car.bandT = 0; car.inDonut = false; car.bog = 0; car.donutVmax = 0; car.liftSoft = 0; car.donutYaw = undefined; car.kickSoft = 0; car.boost = 0; car.shaft = 0; car.carry = 0; car.revCut = 0; car.csHold = 0; car.slipRPrev = 0; car.evSlide = 0; car.tcK = undefined; car.stabV = 0; car.sootKm = 0; car.free = undefined; car.dump = 0; car.giveT = 0; car.giveDur = undefined; car.inT = 0; car.inDir = 0;
  car.inWater = false; car.sunk = false; car.waterTime = 0;
  car.pitch = car.roll = 0; car.ax = car.ay = 0; car.hit = 0; car.kerbHit = 0; car.jolt = 0; car.bite = 0; car.kerbS = null;
  car.rpm = car.spec.engine.idle ?? 0;
}
