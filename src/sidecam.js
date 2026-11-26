// The car seen from its side (Martin 2026-11-26: "Add a side view option for the camera on desktop, perhaps like
// 5 and 6 keys? let it show the road at least 10m forna and after. in case of tesla zoom a litlle bit out during
// th ejump with smooth transition and move with the car in case of big drop in level etc.").
//
// Then, the same day: "I think you can first reduce the gap front and back to just a touch over the front and end of
// the car and then try to make the lens wider and the when i dont know at 2m on the side raise it up indeed".
//
// 5 is the view from the car's left, 6 from its right; the same key again goes back to the view that was on (C's
// chase or drone). The camera stands square to the heading the chase camera swings on, GAP metres out from the
// car's flank, and looks at the car through a lens as wide as it takes for the picture to hold the car and a
// touch more (TOUCH) past the nose and the tail, whatever the window's shape (past MAX_FOV it steps back instead).
//
// Like the chase camera it only eases a few rig numbers (the turn round the car, how high it stands, the height it
// looks at, how far out it is) and is then placed exactly from them, so an uneven frame cannot nudge the view.
//
// A house closer to the car than the camera would stand would have the camera inside it. Then the camera rises,
// on an arc round the car at the same distance: just far enough that it is clear of the wall (it comes in over the
// pavement, still beside the car, looking down on it), or that it looks over the house when that is the lower way.
// Banks and kerbs beside the road it looks over. It reads ahead along the road by where the car will be in a second
// and more, comes up quickly and sinks slowly, so a row of houses with gaps does not make it bob.
//
// In the air (a Rocket's kickflip, any car off a drop for more than a moment) the camera backs off from the car a
// few metres, and the height it looks at follows the car softly: the car first rises or sinks in the picture, and
// the further it gets from the middle the faster the camera goes after it, so a long fall is followed all the way.

const GAP = 2;                // m from the car's flank to the camera
const TOUCH = 0.5;            // m past the nose and the tail the picture holds
const MIN_FOV = 50, MAX_FOV = 80;     // degrees, top to bottom: the lens's range
const LOOK = 0.9;             // m over the road it looks at
const EL_MIN = 0.15, EL_MAX = 1.4;    // rad over level: in the open (the camera at about 1.3 m), and at most (80 degrees)
const OVER = 0.6, BANK = 0.25; // m its line of sight clears a roof by, and the ground beside the road
const CLEAR = 0.4;            // m the camera keeps from a wall
const UP_W = 4, DOWN_W = 1.2; // how briskly it rises (there in about a second, so it starts before the house is beside the car) and how slowly it sinks (1/s, critically damped)
const AHEAD_S = 1.2, AHEAD_M = 30;   // it reads what stands beside the road this far ahead in time, and no further than this
const TURN_S = 0.8;           // seconds from the chase view round to the side (and as long again to the other side)
const AIR_BACK = 4;           // m further out in the air
const AIR_AFTER = 0.35;       // s off the ground before a car that is no Rocket in flight counts as in the air
const COL = 1.5;              // m between the columns it reads along the road
const ROWS = 8;               // points read in each column, from the car's flank out to the camera

const smooth = (t) => t * t * (3 - 2 * t);

// getWorld: gives the map (heightAt, roofAt) once it is loaded
export function createSideCam(getWorld) {
  let want = 0, turn = 0;       // -1 the left side, 0 off, 1 the right
  let el = EL_MIN, elV = 0;     // how high on its arc, and how fast that is changing
  let y = 0, base = 0;          // the height the rig stands on (follows the car softly); the ground the car last stood on
  let air = 0;                  // 0 to 1: opened for a flight
  let fresh = true;             // the rig is not on a car yet: the next frame puts it there
  const needs = [0, 0]; let half = 0;   // what each half of the columns last asked for, and whose turn it is
  const out = { w: 0, fov: MIN_FOV, el: EL_MIN, r: 0, x: 0, y: 0, z: 0 };

  // How high on its arc the camera has to stand (rad over level) so that nothing stands between it and the car and
  // the road beside it. It reads the ground between the car's flank and the camera, in the wedge its view of the car
  // passes through, and that wedge again all the way to where the car will be in AHEAD_S: column by column along the
  // road (o metres ahead of the car), each out toward the camera (s metres to the side). What stands at a point is
  // held against the road's own height beside it, so a street that climbs or falls is not taken for a bank.
  // A house there leaves two ways: the camera in front of its wall (on the arc's way up it comes in toward the car),
  // or high enough to look over its roof; the lower of the two is taken. A bank only leaves the second.
  // Every other column a frame (half: 0 or 1), so a frame reads half of them and two frames all.
  function rise(world, tg, cx, cz, sx, sz, R, W, half) {
    let need = 0;
    const lead = Math.max(-AHEAD_M, Math.min(AHEAD_M, (tg.vx || 0) * AHEAD_S)), l0 = Math.min(0, lead), l1 = Math.max(0, lead);
    const len = 2 * W + l1 - l0, n = Math.ceil(len / COL), s0 = tg.halfWid + 0.2;
    for (let i = half; i <= n; i += 2) {
      const o = l0 - W + (len * i) / n;
      const far = R * (1 - (o < l0 ? l0 - o : o > l1 ? o - l1 : 0) / W);    // the wedge closes toward the camera
      if (far < s0) continue;
      const ox = tg.x + cx * o, oz = tg.z + cz * o;
      // (ahead in a bend the straight line runs into the houses on the corner, where the car will never be)
      if ((o > W || o < -W) && world.sdfAt(ox, oz) < tg.halfWid) continue;
      const g = Math.max(base - 3, Math.min(base + 3, world.heightAt(ox, oz)));
      const lift = (g - base - LOOK) / R;
      const step = Math.max(0.3, (far + CLEAR - s0) / ROWS);
      for (let s = s0; s <= far + CLEAR + 1e-6; s += step) {
        const px = ox + sx * s, pz = oz + sz * s;
        // the ground itself, a bank or a rise beside the road, is looked over by a hand's breadth
        let el = Math.atan((world.heightAt(px, pz) + BANK - g) / s + lift);
        // a house: its wall (the distance field) with its roof over it (the roofs are kept on a coarse grid that
        // reaches a few metres past each house, so only where the wall is near)
        if (world.sdfAt(px, pz) < CLEAR) {
          const r = world.roofAt(px, pz);
          if (r > -1e8) {
            const front = s - CLEAR >= far ? 0 : Math.acos(Math.max(0, (s - CLEAR) / far));
            el = Math.max(el, Math.min(front, Math.atan((r + OVER - g) / s + lift)));
          }
        }
        if (el > need) need = el;
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
      // the car and a touch past both ends fit the picture GAP out from its flank, the lens as wide as that takes
      // (past MAX_FOV the camera steps back instead: a bus, a narrow window); in the air it backs off AIR_BACK more
      const W = tg.halfLen + TOUCH;
      const flying = !!tg.rocket?.flight || (tg.airborne && tg.airTime > AIR_AFTER);
      // (the fit is taken at the near flank, the nearest the car comes to the camera, so its corners are in too)
      const R0 = tg.halfWid + Math.max(GAP, W / (Math.tan((MAX_FOV * Math.PI) / 360) * aspect));
      const fov0 = Math.max(MIN_FOV, (Math.atan(W / ((R0 - tg.halfWid) * aspect)) * 360) / Math.PI);
      if (!tg.airborne || fresh) base = tg.y;
      if (fresh) { air = flying ? 1 : 0; }
      else air += ((flying ? 1 : 0) - air) * (1 - Math.exp(-(flying ? 1.4 : 1) * dt));
      const R = R0 + AIR_BACK * smooth(air);
      if (fresh) needs[1 - half] = rise(world, tg, cx, cz, sx, sz, R, W, 1 - half);
      needs[half] = rise(world, tg, cx, cz, sx, sz, R, W, half); half = 1 - half;
      const need = Math.max(EL_MIN, Math.min(EL_MAX, Math.max(needs[0], needs[1])));
      if (fresh) { fresh = false; y = tg.y; el = need; elV = 0; }
      else {
        // (the height: the further the car is from the middle of the picture, the faster the rig goes after it)
        const e = tg.y - y;
        if (Math.abs(e) > 40) y = tg.y; else y += e * (1 - Math.exp(-(2 + (8 * Math.abs(e)) / R) * dt));
        // (the arc: a critically damped spring, taken in one exact step so a long frame cannot overshoot it)
        const om = need > el ? UP_W : DOWN_W, x0 = el - need, k = (elV + om * x0) * dt, ex = Math.exp(-om * dt);
        elV = (elV - om * k) * ex; el = need + (x0 + k) * ex;
      }
      out.fov = fov0;
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
