// The start lane (Martin 25 Nov): with many cars put on the start at once, somebody who only wants a quick lap
// has to push through the others first. A car just put on the start (H, the START button, DRIVE) passes through
// the other cars, and they through it, for as long as it stays on the lap's road between the two glowing kerbs,
// from 20 m behind the rearmost start spot up to the start/finish line (where the lap timer takes over: a car on
// a lap passes through the others anyway). Off the road past a kerb, or back up the street out of the lane, and
// it can be hit and hits again, until it is next put on the start. A spot in the bays beside the road counts as
// the lane until the car has pulled out onto the road, or has gone BAY metres from the spot without doing so.
//
// It costs one look-up of the nearest track point a frame, and only while the car is in the lane.
//
// createStartLane(track, shift): shift(i) gives how far the glowing kerbs at track point i were moved off the
// track's own width ([left, right] along the right-hand normal, src/race/race.js fit), or nothing before that
// stretch of kerb is built.
// begin(x, z): the car was put on a start spot. update(car): is it still in the lane (call once a frame).

const BACK = 20;        // metres behind the rearmost start spot
const SPOTS = 70;       // the rearmost spot, metres back up the street from the spawn point (startslots.js)
const PAST = 3;         // track points past the line that still count (the lap timer has started by then)
const BAY = 9;          // metres a car may move from its spot beside the road before it has to be on the road

export function createStartLane(track, shift = () => null) {
  const { P, HW, N, s, spawnI } = track;
  // the first track point of the lane
  let i0 = spawnI;
  while (i0 > 0 && s[spawnI] - s[i0] < SPOTS + BACK) i0--;
  const st = { on: false, entered: false, x: 0, z: 0, hint: -1 };
  // the kerbs at track point i, metres to the right of the centre line
  const left = (i) => -HW[i] + (shift(i)?.[0] || 0), right = (i) => HW[i] + (shift(i)?.[1] || 0);
  function inside(x, z) {
    const near = track.nearest(x, z, st.hint, 30);
    if (near.i < 0 || near.d > 30) return false;
    st.hint = near.i;
    const i = near.i, j = (i + 1) % N;
    if ((i < PAST ? i + N : i) < i0) return false;                 // behind the lane, or well over the line
    const dx = P[j][0] - P[i][0], dz = P[j][1] - P[i][1], l = Math.hypot(dx, dz) || 1;
    const lat = ((x - P[i][0]) * -dz + (z - P[i][1]) * dx) / l;      // metres right of the centre line
    const t = near.t;
    return lat >= left(i) + (left(j) - left(i)) * t && lat <= right(i) + (right(j) - right(i)) * t;
  }
  return {
    i0,
    get on() { return st.on; },
    begin(x, z) { st.on = true; st.entered = false; st.x = x; st.z = z; st.hint = -1; },
    end() { st.on = false; },
    update(car) {
      if (!st.on) return false;
      if (inside(car.x, car.z)) st.entered = true;
      else if (st.entered || Math.hypot(car.x - st.x, car.z - st.z) > BAY) st.on = false;
      return st.on;
    },
    inside,
  };
}
