// The car seen from its side (Martin 2026-11-26: "Add a side view option for the camera on desktop, perhaps like
// 5 and 6 keys? let it show the road at least 10m forna and after. in case of tesla zoom a litlle bit out during
// th ejump with smooth transition and move with the car in case of big drop in level etc.").
//
// 5 is the view from the car's left, 6 from its right; the same key again goes back to the view that was on (C's
// chase or drone). The camera stands square to the heading the chase camera swings on, far enough out that the
// road shows ROAD metres ahead of the nose and behind the tail whatever the window's shape, and looks at the car.
//
// Like the chase camera it only eases a few rig numbers (the turn round the car, how high it stands, the height it
// looks at) and is then placed exactly from them, so an uneven frame cannot nudge the view along the road.
//
// A house on that side would stand between the camera and the car. Pulling the camera in to the wall would lose
// the road ahead, so it rises instead, on an arc round the car at the same distance, just far enough to see over
// what stands there (the houses' tops and the ground, read ahead along the road by where the car will be in most of
// a second): a level side view in the open, a view down over the eaves in a street of tall houses. It comes up
// quickly and sinks slowly, so a row of houses with gaps does not make it bob.
//
// In the air (a Rocket's kickflip, any car off a drop for more than a moment) the view opens a little, and the
// height it looks at follows the car softly: the car first rises or sinks in the picture, and the further it gets
// from the middle the faster the camera goes after it, so a long fall is followed all the way down.

const BASE_FOV = 46;          // degrees, top to bottom
const MAX_FOV = 80;
const MAX_R = 30;             // m from the car at most (a tall narrow window opens the view instead past this)
const ROAD = 10, EDGE = 1.5;  // m of road shown ahead of the nose and behind the tail, and to spare at the picture's edge
const LOOK = 0.9;             // m over the road it looks at
const EL_MIN = 0.12, EL_MAX = 1.4;    // rad over level: in the open, and at most (tall houses close on that side: 80 degrees, all but straight down)
const OVER = 0.6, BANK = 0.25; // m its line of sight clears a roof by, and the ground beside the road
const UP_W = 4, DOWN_W = 1.2; // how briskly it rises (there in about a second, so it starts before the house is beside the car) and how slowly it sinks (1/s, critically damped)
const AHEAD_S = 1.4, AHEAD_M = 60;   // it reads what stands beside the road this far ahead in time, and no further than this
const TURN_S = 0.8;           // seconds from the chase view round to the side (and as long again to the other side)
const AIR_OPEN = 0.18;        // in the air the picture is this much wider
const AIR_AFTER = 0.35;       // s off the ground before a car that is no Rocket in flight counts as in the air
const STEP = 2.8;             // m between the points it reads (the roofs are kept on a 4 m grid: no square of it falls between them)
const NEAR = 3;               // m to the side of the car's line where the reading starts
const EAVES = 1;              // m from a wall within which a point counts as under that house's roof

const smooth = (t) => t * t * (3 - 2 * t);

// getWorld: gives the map (heightAt, roofAt) once it is loaded
export function createSideCam(getWorld) {
  let want = 0, turn = 0;       // -1 the left side, 0 off, 1 the right
  let el = EL_MIN, elV = 0;     // how high on its arc, and how fast that is changing
  let y = 0, base = 0;          // the height the rig stands on (follows the car softly); the ground the car last stood on
  let air = 0;                  // 0 to 1: opened for a flight
  let fresh = true;             // the rig is not on a car yet: the next frame puts it there
  const needs = [0, 0]; let half = 0;   // what each half of the columns last asked for, and whose turn it is
  const out = { w: 0, fov: BASE_FOV, el: EL_MIN, r: 0, x: 0, y: 0, z: 0 };

  // How steeply the camera has to look down (as a tangent) to see the road past what stands on that side. It reads
  // the ground between the car's line and the camera, in the wedge its view of the road passes through, and that
  // wedge again all the way to where the car will be in AHEAD_S: column by column along the road (o metres ahead
  // of the car), each out toward the camera (s metres to the side). What stands at a point is held against the
  // road's own height beside it, so a street that climbs or falls is not taken for a bank in the way.
  // Every other column a frame (half: 0 or 1), so a frame reads half of them and two frames all.
  function steep(world, tg, cx, cz, sx, sz, R, W, half) {
    let need = 0;
    const lead = Math.max(-AHEAD_M, Math.min(AHEAD_M, (tg.vx || 0) * AHEAD_S)), l0 = Math.min(0, lead), l1 = Math.max(0, lead);
    const len = 2 * W + l1 - l0, n = Math.ceil(len / STEP);
    for (let i = half; i <= n; i += 2) {
      const o = l0 - W + (len * i) / n;
      const far = R * (1 - (o < l0 ? l0 - o : o > l1 ? o - l1 : 0) / W);    // the wedge closes toward the camera
      if (far < NEAR) continue;
      const ox = tg.x + cx * o, oz = tg.z + cz * o;
      const g = Math.max(base - 3, Math.min(base + 3, world.heightAt(ox, oz)));
      const lift = (g - base - LOOK) / R;
      let was = -1e9;                                                       // the roof at the point before, nearer the road
      for (let s = NEAR; s <= far; s += STEP) {
        const px = ox + sx * s, pz = oz + sz * s;
        // the ground itself, a bank or a rise beside the road, is cleared by a hand's breadth
        let t = (world.heightAt(px, pz) + BANK - g) / s;
        // ...and a roof by OVER. (The roofs are kept on a coarse grid that reaches a few metres past each house:
        // where the distance field says no wall is near, there is no house over the point.)
        let r = world.roofAt(px, pz);
        if (r > -1e8 && world.sdfAt(px, pz) >= EAVES) r = -1e9;
        if (r > was + 0.5) {
          // a house starts between the last point and this one: its wall is what the line of sight has to clear,
          // and how near the road that stands decides how steep the look is, so it is found to a third of a metre
          let lo = Math.max(1.5, s - STEP), hi = s;
          for (let k = 0; k < 3; k++) {
            const m = (lo + hi) / 2, mx = ox + sx * m, mz = oz + sz * m;
            if (world.roofAt(mx, mz) > r - 0.5 && world.sdfAt(mx, mz) < EAVES) hi = m; else lo = m;
          }
          t = Math.max(t, (r + OVER - g) / hi);
        } else if (r > -1e8) t = Math.max(t, (r + OVER - g) / s);
        was = r;
        if (t + lift > need) need = t + lift;
      }
    }
    return need;
  }

  return {
    get side() { return want; },
    get out() { return out; },   // (the last frame's figures, for tools/side-view-test.mjs)
    // 5 or 6: that side, or back to the view that was on when it is the side already shown
    press(s) { want = want === s ? 0 : s; },
    off() { want = 0; },
    // the car was put somewhere else: the rig goes straight to it
    snap() { fresh = true; },
    // One frame. tg: the car it follows; yaw: the heading the rig swings on; aspect: the window's width over its
    // height; pos, look: the view so far (chase or drone), moved toward the side view by out.w. Returns out: w (0 to
    // 1, how much of the picture is the side view) and fov (degrees, what the side view asks for). show false: the
    // rig keeps up with the car but leaves the view alone (B held looks back).
    update(tg, yaw, dt, aspect, pos, look, show = true) {
      if (turn !== want) turn = want > turn ? Math.min(want, turn + dt / TURN_S) : Math.max(want, turn - dt / TURN_S);
      if (turn === 0) { fresh = true; out.w = 0; return out; }
      const world = getWorld();
      const sg = turn < 0 ? -1 : 1, w = smooth(Math.abs(turn)), a = sg * w * Math.PI / 2;
      const cx = Math.sin(yaw), cz = -Math.cos(yaw);          // the heading
      const sx = Math.cos(yaw) * sg, sz = Math.sin(yaw) * sg; // out to the side the camera stands on
      // the road ahead and behind fits whatever the window's shape: the distance follows it, and past MAX_R the view opens
      const W = tg.halfLen + ROAD + EDGE;
      const tanV = Math.tan((BASE_FOV * Math.PI) / 360);
      const R = Math.min(MAX_R, W / (tanV * aspect));
      const flying = !!tg.rocket?.flight || (tg.airborne && tg.airTime > AIR_AFTER);
      if (!tg.airborne || fresh) base = tg.y;
      if (fresh) needs[1 - half] = steep(world, tg, cx, cz, sx, sz, R, W, 1 - half);
      needs[half] = steep(world, tg, cx, cz, sx, sz, R, W, half); half = 1 - half;
      const need = Math.max(EL_MIN, Math.min(EL_MAX, Math.atan(Math.max(needs[0], needs[1]))));
      if (fresh) { fresh = false; y = tg.y; el = need; elV = 0; air = flying ? 1 : 0; }
      else {
        // (the height: the further the car is from the middle of the picture, the faster the rig goes after it)
        const e = tg.y - y;
        if (Math.abs(e) > 40) y = tg.y; else y += e * (1 - Math.exp(-(2 + Math.abs(e)) * dt));
        air += ((flying ? 1 : 0) - air) * (1 - Math.exp(-(flying ? 3 : 1.3) * dt));
        // (the arc: a critically damped spring, taken in one exact step so a long frame cannot overshoot it)
        const om = need > el ? UP_W : DOWN_W, x0 = el - need, k = (elV + om * x0) * dt, ex = Math.exp(-om * dt);
        elV = (elV - om * k) * ex; el = need + (x0 + k) * ex;
      }
      out.fov = Math.min(MAX_FOV, (Math.atan((W * (1 + AIR_OPEN * smooth(air))) / (R * aspect)) * 360) / Math.PI);
      // round the car from behind it (a = 0) to its side
      const ux = -cx * Math.cos(a) + sx * Math.sin(Math.abs(a)), uz = -cz * Math.cos(a) + sz * Math.sin(Math.abs(a));
      const h = R * Math.cos(el);
      let px = tg.x + ux * h, py = y + LOOK + R * Math.sin(el), pz = tg.z + uz * h;
      const floor = world.heightAt(px, pz) + 0.9;
      if (py < floor) py = floor;
      out.el = el; out.r = R; out.x = px; out.y = py; out.z = pz;
      if (!show) { out.w = 0; return out; }
      pos.x += (px - pos.x) * w; pos.y += (py - pos.y) * w; pos.z += (pz - pos.z) * w;
      look.x += (tg.x - look.x) * w; look.y += (y + LOOK - look.y) * w; look.z += (tg.z - look.z) * w;
      out.w = w;
      return out;
    },
  };
}
