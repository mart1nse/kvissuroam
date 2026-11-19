// Street furniture standing on the carriageway of a street or main road. The surveyed props
// (Mapillary map features, public/data/props.json) are placed from dashcam photos, and their
// triangulated positions often land a few metres out in the road: a bench in the middle of
// Puiestee, a sign post in the lane. Each one whose footprint overlaps the painted road is moved
// out to the pavement just beyond the road edge, or left out when no clear spot is close by.
// Hand-placed props are added after this runs and are never touched, nor are props inside the
// hand-made places that paint their own ground (world.vectors.overPaint).
// Check: node tools/road-props-check.mjs

const ZEBRA = 7, BOLLARD = 8, SIGN0 = 10;
// roads whose painted width is a carriageway (see KERBED in src/world/roadtex.js)
const MAIN = new Set(['Tänav', 'Põhimaantee', 'Tugimaantee', 'Kõrvalmaantee', 'Ramp või ühenduste']);
// footprint radius of each kind (m), as REACH in src/world/props.js
const REACH = { 0: 0.12, 1: 0.15, 2: 0.12, 3: 0.75, 4: 0.25, 5: 0.75, 6: 0.4, 8: 0.09, 9: 0.09 };
const reachOf = (kind) => (kind >= SIGN0 ? 0.08 : REACH[kind] ?? 0.2);
const OVERLAP = 0.15;          // a footprint reaching this far onto the road counts as standing on it
const SET_BACK = 0.45;         // a moved prop's footprint ends this far beyond the road edge
const MAX_SHIFT = 6;           // further than this from where it was surveyed and it is left out
const MEDIAN_W = 14, MEDIAN_HW = 1.5;   // on a road this wide, a lamp row or signal on the centre line is in the median: leave it
const CELL = 32;

// segments of the road centre lines in a coarse grid, for "which roads are near (x, z)"
function roadGrid(roads, test) {
  const grid = new Map();
  for (const r of roads) {
    if (!test(r) || r.pts.length < 2 || r.s === 4) continue;           // decks (wood) are not painted
    for (let i = 1; i < r.pts.length; i++) {
      const [ax, az] = r.pts[i - 1], [bx, bz] = r.pts[i];
      const m = r.w / 2 + 2;
      const seg = { ax, az, bx, bz, hw: r.w / 2, road: r };
      for (let gx = Math.floor((Math.min(ax, bx) - m) / CELL); gx <= Math.floor((Math.max(ax, bx) + m) / CELL); gx++) {
        for (let gz = Math.floor((Math.min(az, bz) - m) / CELL); gz <= Math.floor((Math.max(az, bz) + m) / CELL); gz++) {
          const k = gx * 100003 + gz;
          let list = grid.get(k);
          if (!list) grid.set(k, (list = []));
          list.push(seg);
        }
      }
    }
  }
  return (x, z) => grid.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL)) || [];
}

// distance from (x, z) to a segment, the nearest point on it and the unit normal pointing at (x, z)
function toSeg(s, x, z) {
  const dx = s.bx - s.ax, dz = s.bz - s.az, l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / l2)) : 0;
  const px = s.ax + dx * t, pz = s.az + dz * t;
  let nx = x - px, nz = z - pz;
  const d = Math.hypot(nx, nz);
  if (d > 1e-6) { nx /= d; nz /= d; } else { const l = Math.sqrt(l2) || 1; nx = -dz / l; nz = dx / l; }
  return { d, px, pz, nx, nz };
}

function inside(ring, x, z) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

// fixRoadProps(data, vectors, skip) moves the props it can (editing data.sectors in place) and returns
// { cleared: Set of ids to leave out, moved: [{ id, kind, from, to }], removed: [{ id, kind, at }] }
export function fixRoadProps(data, vectors, skip = new Set()) {
  const near = roadGrid(vectors.roads, (r) => MAIN.has(r.type));
  const anyNear = roadGrid(vectors.roads, () => true);       // a moved prop must not land on a cycle path either
  const hand = (vectors.overPaint || []).map((a) => {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const [x, z] of a.outer) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    return { a, x0, z0, x1, z1 };
  });
  const inHand = (x, z) => hand.some((h) => x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1 && inside(h.a.outer, x, z));
  // how far the footprint (radius rr) at (x, z) reaches onto the nearest road; > 0 is on it
  const onRoad = (lookup, x, z, rr) => {
    let worst = -Infinity, seg = null;
    for (const s of lookup(x, z)) {
      const q = toSeg(s, x, z);
      const over = s.hw + rr - q.d;
      if (over > worst) { worst = over; seg = { s, q }; }
    }
    return { over: worst, seg };
  };
  const cleared = new Set(), moved = [], removed = [];
  for (const [key, a] of Object.entries(data.sectors)) {
    for (let k = 0; k < a.length; k += data.stride) {
      const kind = a[k], x = a[k + 1], z = a[k + 2];
      if (kind === ZEBRA) continue;
      const rr = reachOf(kind);
      const hit = onRoad(near, x, z, rr);
      if (hit.over < OVERLAP) continue;
      if (inHand(x, z)) continue;
      const { s, q } = hit.seg;
      if (s.hw * 2 >= MEDIAN_W && q.d < MEDIAN_HW) continue;
      const id = `${key}:${k / data.stride}`;
      if (skip.has(id)) continue;                 // already left out (the lap, hand-made places)
      // push it straight out of the road it is on, to the nearer edge first, then the far edge
      let spot = null;
      for (const side of [1, -1]) {
        const off = s.hw + rr + SET_BACK;
        const tx = q.px + q.nx * side * off, tz = q.pz + q.nz * side * off;
        if (Math.hypot(tx - x, tz - z) > MAX_SHIFT) continue;
        if (onRoad(anyNear, tx, tz, rr).over > -0.1) continue;          // that is another road (a junction)
        if (inHand(tx, tz)) continue;
        spot = [Math.round(tx * 10) / 10, Math.round(tz * 10) / 10];
        break;
      }
      // a bollard well out in the road, beyond reach of the edge, may close the street: leave it
      if (!spot && kind === BOLLARD) continue;
      if (spot) {
        a[k + 1] = spot[0]; a[k + 2] = spot[1];
        moved.push({ id, kind, from: [x, z], to: spot, road: s.road.name });
      } else {
        cleared.add(id);
        removed.push({ id, kind, at: [x, z], road: s.road.name });
      }
    }
  }
  return { cleared, moved, removed };
}
