// Where to put the car back after it went into the water (or got stuck): a spot well clear of any
// water, on a bridge deck only when the whole car fits on it, and far enough back that the car does
// not land on the brink again.
const WATER = 4;          // SURFACE.WATER in world/data.js (not imported, so the node checks can load this file)

// The ground a car at pose p would stand on: the deck it is level with, or the terrain.
// p.y is the level the pose was recorded at (undefined: on the terrain).
export function groundLevel(world, x, z, y) {
  return y === undefined || !world.groundAt ? world.heightAt(x, z) : world.groundAt(x, z, y);
}

const onDeck = (world, x, z, g) => g > world.heightAt(x, z) + 0.3;

// Is pose p ({ x, z, yaw, y? }) a safe place to drop a car? Returns the height to put it at, or null.
// - the whole car (and a margin round it) stands on solid ground or one deck, no step under it
// - no water within a few metres on the ground, nor just ahead and behind on a deck
// - not against a building or wall
export function dryLevel(world, p) {
  if (world.ready && !world.ready(p.x, p.z)) return null;
  if (world.sdfAt(p.x, p.z) <= 1.6) return null;
  const y0 = groundLevel(world, p.x, p.z, p.y);
  if (!Number.isFinite(y0)) return null;
  const deck = onDeck(world, p.x, p.z, y0);
  if (world.surfaceAt(p.x, p.z, deck ? y0 : undefined) === WATER) return null;
  const fx = Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = Math.sin(p.yaw);
  // a point on the same level as the car: the same deck, or ground that steps no more than a kerb or a slope would
  const level = (a, s, maxStep) => {
    const x = p.x + fx * a + rx * s, z = p.z + fz * a + rz * s;
    const g = groundLevel(world, x, z, y0);
    if (Math.abs(g - y0) > maxStep) return false;
    return world.surfaceAt(x, z, onDeck(world, x, z, g) ? g : undefined) !== WATER;
  };
  // the car itself: bumpers and sides
  for (const a of [-3, -1.5, 0, 1.5, 3]) for (const s of [-1.3, 0, 1.3]) if (!level(a, s, 1.0)) return null;
  if (deck) {
    // on a bridge: the deck goes on a good bit ahead and behind (no landing on its very end), and is wider than the car
    for (const a of [-9, -6, 6, 9]) if (!level(a, 0, 1.6)) return null;
    for (const a of [-2, 2]) for (const s of [-1.8, 1.8]) if (!level(a, s, 0.6)) return null;
    return y0;
  }
  // on the ground: no water in a ring round the car, and none a few car lengths ahead or behind
  for (const r of [3.5, 5.5]) {
    for (let k = 0; k < 12; k++) {
      const t = (k / 12) * Math.PI * 2, x = p.x + Math.cos(t) * r, z = p.z + Math.sin(t) * r;
      if (world.surfaceAt(x, z) === WATER) return null;
    }
  }
  for (const a of [-10, -7, 7, 10, 14]) {
    const x = p.x + fx * a, z = p.z + fz * a;
    if (world.surfaceAt(x, z) === WATER && !onDeck(world, x, z, groundLevel(world, x, z, y0))) return null;
  }
  return y0;
}

// Is pose p ({ x, z, yaw, y }) a place on a house's roof where a car can be put back (Martin, 26 Nov 2026: "if
// there is a house you cannot get down from, the first R puts you back on the roof")? The roof is under the
// whole car and a margin round it, no step in it and no steeper than a car stands on. Returns the height, or null.
export function roofLevel(world, p) {
  if (!world.roofTop || (world.ready && !world.ready(p.x, p.z))) return null;
  const y0 = world.groundAt(p.x, p.z, p.y + 0.4);
  if (!(y0 > world.heightAt(p.x, p.z) + 1) || Math.abs(y0 - p.y) > 0.6) return null;
  const fx = Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = Math.sin(p.yaw);
  for (const a of [-3, -1.5, 0, 1.5, 3]) for (const s of [-1.3, 0, 1.3]) {
    const x = p.x + fx * a + rx * s, z = p.z + fz * a + rz * s;
    // (as high as the roof may rise or fall that far from the car's middle, and a roof it is: not the ground
    // beside the house, not a wall of a higher part of it)
    const g = world.groundAt(x, z, y0 + 0.4 + Math.hypot(a, s) * 0.5);
    if (Math.abs(g - y0) > 0.25 + Math.hypot(a, s) * 0.5 || !(g > world.heightAt(x, z) + 1)) return null;
    if (world.wallTop(x, z, y0 + 0.4) > g + 0.3) return null;
  }
  return y0;
}

// Pick from the remembered poses (oldest first, newest last; { x, z, yaw, y, t, roof? }) the newest one that is
// at least minAge seconds older than "ref", at least minDist metres from (sx, sz), and dry. Poses that are
// too new or not dry are dropped from the list, so asking again goes further back.
// Returns { x, z, yaw, y, t }, null, or { wait: pose } when the next pose to look at is in a part of the
// map that is not loaded (load it and ask again).
export function pickFromHistory(world, history, { ref, sx, sz, minAge = 3, minDist = 0 }) {
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (world.ready && !world.ready(h.x, h.z)) return { wait: h };
    history.length = i;                 // whatever happens, this pose is used up
    if (ref - h.t < minAge) continue;
    if (Math.hypot(h.x - sx, h.z - sz) < minDist) continue;
    const y = h.roof ? roofLevel(world, h) : dryLevel(world, h);
    if (y !== null) return { x: h.x, z: h.z, yaw: h.yaw, y, t: h.t, roof: !!h.roof };
  }
  return null;
}

// No good remembered pose: look outwards from (sx, sz) for the nearest dry street (nearestRoad from the
// city map, (x, z, maxD) -> { x, z, yaw, w } | null), facing away from (sx, sz), in the right-hand lane.
export function searchDry(world, sx, sz, nearestRoad, { from = 15, to = 320, step = 15 } = {}) {
  let rough = null;                     // the nearest dry spot off the streets, if no street is dry
  for (let r = from; r <= to; r += step) {
    const n = Math.max(12, Math.round((2 * Math.PI * r) / 12));
    let best = null;
    for (let k = 0; k < n; k++) {
      const t = (k / n) * Math.PI * 2;
      const cx = sx + Math.cos(t) * r, cz = sz + Math.sin(t) * r;
      const road = nearestRoad ? nearestRoad(cx, cz, step) : null;
      if (!road && rough) continue;
      let yaw = road ? road.yaw : Math.atan2(cx - sx, -(cz - sz));
      const bx = road ? road.x : cx, bz = road ? road.z : cz;
      if (Math.sin(yaw) * (bx - sx) - Math.cos(yaw) * (bz - sz) < 0) yaw += Math.PI;    // drive on away from the water
      const o = road ? Math.min(road.w / 4, 1.7) : 0;
      const p = { x: bx + Math.cos(yaw) * o, z: bz + Math.sin(yaw) * o, yaw };
      const d = Math.hypot(p.x - sx, p.z - sz);
      if (d < from || (road && best && d >= best.d)) continue;
      const y = dryLevel(world, p);
      if (y === null) continue;
      if (road) best = { x: p.x, z: p.z, yaw, y, d };
      else rough = { x: p.x, z: p.z, yaw, y };
    }
    if (best) return { x: best.x, z: best.z, yaw: best.yaw, y: best.y };
  }
  return rough;
}
