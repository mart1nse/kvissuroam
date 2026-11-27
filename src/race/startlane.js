// The start lane (Martin 25 Nov): with many cars put on the start at once, somebody who only wants a quick lap
// has to push through the others first. A car just put on the start (H, the START button, DRIVE) passes through
// the other cars, and they through it, while it is on the lap's road between the two glowing kerbs, from 20 m
// behind the rearmost start spot up to the start/finish line (where the lap timer takes over: a car on a lap
// passes through the others anyway). Over a kerb, or back up the street out of the lane, it can be hit and hits
// again. Back on the lane's road within OUT_S seconds it passes through again (27 Nov, Martin: "in some cases when I
// spawn on the linnaring, my car cannot drive through others on my full way to the start line": one wheel's
// width over a kerb in the crowd, or wide out of the last corner, had ended it for the rest of the way); out for
// longer, or over the line, and it is over until the car is next put on the start.
// A spot in the bays beside the road counts as the lane until the car has pulled out onto the road: the whole row of
// bays does, out to the bollards (it used to end 9 m from the spot, and a car pulling out gently, aiming down the
// road, had gone 9 m along the bays before it was on the road: it hit the others from there on).
// Any other putting of the car onto the lane's road (R, the map, back after the graphics were lost) starts it as
// well: the car appears among the others there just as one put on the start does. (The race's grid is off this road,
// on the straight's line back past the last corner: racers pass through the others there anyway.)
//
// It costs one look-up of the nearest track point a frame, and only while the lane is on.
//
// createStartLane(track, shift, bays): shift(i) gives how far the glowing kerbs at track point i were moved off the
// track's own width ([left, right] along the right-hand normal, src/race/race.js fit), or nothing before that
// stretch of kerb is built; bays: the bays' spots (BAYS in src/race/startslots.js).
// begin(x, z): the car was put on a start spot. placed(x, z): the car was put somewhere (any way): on the lane's
// road that starts the lane, anywhere else it ends it. update(car): does it pass through the others now (call once
// a frame). on: the same, as last worked out.

const BACK = 20;        // metres behind the rearmost start spot
const SPOTS = 70;       // the rearmost spot, metres back up the street from the spawn point (startslots.js)
const PAST = 3;         // track points past the line that still count (the lap timer has started by then)
const OUT_S = 5;        // seconds a car may be off the lane's road and still pass through again once back on it
const BAY_BEFORE = 6;   // metres before the first bay spot that are still the bays
const BAY_AFTER = 30;   // ... and after the last (the paving goes on there to the side street: room to pull out gently)
const BAY_OUT = 8.4;    // metres right of the centre line where the bays end (the bollards stand at 7.9)

export function createStartLane(track, shift = () => null, bays = null) {
  const { P, HW, N, s, spawnI } = track;
  // the first track point of the lane, and how many there are up to PAST over the line
  let i0 = spawnI;
  while (i0 > 0 && s[spawnI] - s[i0] < SPOTS + BACK) i0--;
  const LEN = N - i0 + PAST;
  // on: put on the start and not yet over the line or out for long; through: passing through the others now;
  // road: has been on the lane's road since (a car in the bays pulls out onto it); out: since when it is off it
  const st = { on: false, through: false, road: false, out: -1, hint: -1 };
  // the kerbs at track point i, metres to the right of the centre line
  const left = (i) => -HW[i] + (shift(i)?.[0] || 0), right = (i) => HW[i] + (shift(i)?.[1] || 0);
  // where (x, z) is: 'lane' on the lane's road between the kerbs, 'bay' in the bays beside it, 'past' over the line
  // (further on round the lap), 'out' anywhere else
  function where(x, z) {
    const near = track.nearest(x, z, st.hint, 30);
    if (near.i < 0 || near.d > 30) return 'out';
    st.hint = near.i;
    const i = near.i, j = (i + 1) % N;
    const k = (i - i0 + N) % N;                                      // track points from the back of the lane
    if (k >= LEN) return k < LEN + (N - LEN) / 2 ? 'past' : 'out';    // (over the line and on, or behind the lane)
    const dx = P[j][0] - P[i][0], dz = P[j][1] - P[i][1], l = Math.hypot(dx, dz) || 1;
    const lat = ((x - P[i][0]) * -dz + (z - P[i][1]) * dx) / l;      // metres right of the centre line
    const t = near.t, lo = left(i) + (left(j) - left(i)) * t, hi = right(i) + (right(j) - right(i)) * t;
    if (lat >= lo && lat <= hi) return 'lane';
    if (bays && lat > hi && lat <= BAY_OUT) {
      const along = s[i] + t * l - s[spawnI];
      if (along >= bays.from - BAY_BEFORE && along <= bays.to + BAY_AFTER) return 'bay';
    }
    return 'out';
  }
  const inside = (x, z) => where(x, z) === 'lane';
  function begin() { st.on = true; st.through = true; st.road = false; st.out = -1; st.hint = -1; }
  function end() { st.on = false; st.through = false; }
  return {
    i0,
    // passing through the others now
    get on() { return st.through; },
    begin,
    end,
    placed(x, z) {
      st.hint = -1;
      const w = where(x, z);
      if (w === 'lane') begin();
      else if (!(w === 'bay' && st.on && !st.road)) end();         // (R in the bays before pulling out: still on)
    },
    update(car, now = performance.now()) {
      if (!st.on) return false;
      const w = where(car.x, car.z);
      if (w === 'past') { end(); return false; }
      if (w === 'lane' || (w === 'bay' && !st.road)) {
        if (w === 'lane') st.road = true;
        st.out = -1; st.through = true;
        return true;
      }
      // over a kerb, out of the back of the lane, or back in the bays from the road: the others can hit it
      if (st.out < 0) st.out = now;
      else if (now - st.out > OUT_S * 1000) end();
      st.through = false;
      return false;
    },
    inside,
    where,
  };
}
