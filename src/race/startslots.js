// Where H, the START button and DRIVE put the car when the start on Vanemuise is busy (Martin 24 Nov, ~70
// online: everyone was put on the one spot, the cars pushed each other apart and his went up the park wall).
// The spot of old stays first; the others go back up Vanemuise in two rows on the lap road, and to the side
// into the taxi and parking bays along the theatre park (between the lap road and the bollards, so a car
// pulls straight out onto the lap and the line is still ~200 m ahead). Nearest to the old spot first.
//
// slots(track, start): the spots, start first. pick(slots, near): the first spot no other car stands on
// (near(x, z, r): the other cars within r metres, as [x, z]); if every one is taken, the roomiest.

const LONG = 4.8, WIDE = 2.6;   // metres: a car whose middle is this near a spot's, along it and across, stands on it
const STEP = 7;              // metres between spots one behind the other
// the bays' spots: metres along the lap from its spawn point, the first and the last, and metres to the right of its
// centre line (src/race/startlane.js counts the bays as the start lane for a car put there, until it is on the road)
export const BAYS = { from: -STEP, to: 3 * STEP, right: 5.9 };
// along the lap from its spawn point: [metres along (minus is back up the street), metres to the right]
function layout() {
  const out = [];
  // the bays by the theatre park: their middle is 5.9 m right of the lap's centre line (the bollards stand at
  // 7.9, the lap's edge at 3.8), flat from 10 m back up the street to 25 m on (further back the ground there
  // humps where the kerb bends in to the Vanemuine steps, and further on it bends in to the corner)
  for (let a = BAYS.from; a <= BAYS.to; a += STEP) out.push([a, BAYS.right]);
  // the lap road back up the street, two side by side (the wall of the park above is 4 m left of the line)
  for (let a = -STEP; a >= -70; a -= STEP) out.push([a, -1.7], [a, 1.7]);
  return out;
}

export function slots(track, start) {
  const { P, tan, N, spawnI } = track;
  const list = [{ ...start, d: 0 }];
  for (const [a, side] of layout()) {
    // (track points are ~2 m apart: walk to the one at that distance along)
    let i = spawnI, left = Math.abs(a);
    const dir = a < 0 ? -1 : 1;
    while (left > 0) {
      const j = (i + dir + N) % N;
      const l = Math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]);
      if (l > left) break;
      left -= l; i = j;
    }
    const [tx, tz] = tan[i], yaw = Math.atan2(tx, -tz);
    const x = P[i][0] + tx * left * dir + Math.cos(yaw) * side, z = P[i][1] + tz * left * dir + Math.sin(yaw) * side;
    list.push({ x, z, yaw, d: Math.hypot(x - start.x, z - start.z) });
  }
  return list.sort((p, q) => p.d - q.d);
}

export function pick(list, near) {
  let best = list[0], room = -1;
  for (const s of list) {
    const fx = Math.sin(s.yaw), fz = -Math.cos(s.yaw);
    let taken = false, g = Infinity;
    for (const [x, z] of near(s.x, s.z, 8)) {
      const dx = x - s.x, dz = z - s.z, along = dx * fx + dz * fz, across = dx * fz - dz * fx;
      if (Math.abs(along) < LONG && Math.abs(across) < WIDE) taken = true;
      g = Math.min(g, Math.hypot(dx, dz));
    }
    if (!taken) return s;
    if (g > room) { room = g; best = s; }
  }
  return best;
}
