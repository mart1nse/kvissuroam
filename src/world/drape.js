// Flat ground meshes from polygons: shapes are [outer, ...holes] rings of [x, z] map points. The triangles are
// split down to `maxEdge` metres so they follow the terrain, draped `lift` metres above it, wound to face
// up, with world-space UVs of `tile` metres.
import * as THREE from 'three';
import { jobs } from '../jobs.js';

// drapeSteps: the same as a job's steps (`yield*` it inside a queued build): it stops between the shape's first
// triangles when the step has grown long (jobs.late). Lai's island and the Emajõe bank were 25 to 35 ms in
// one go on a fast processor, 120 to 170 on an old one.
export function drapeGeometry(world, shapes, lift, tile = 1, maxEdge = 1.5) { return jobs.run(drapeSteps(world, shapes, lift, tile, maxEdge)); }
export function* drapeSteps(world, shapes, lift, tile = 1, maxEdge = 1.5) {
  const pos = [], uv = [];
  // (a corner belongs to six triangles or so: its ground height is looked up once. Near the track's kerbs a
  // height costs a search along the track, and Lai's island and the Emajõe bank took 0.1 s each to lay)
  const seen = new Map();
  const ground = (x, z) => {
    let row = seen.get(x);
    if (!row) seen.set(x, (row = new Map()));
    let h = row.get(z);
    if (h === undefined) row.set(z, (h = world.heightAt(x, z)));
    return h;
  };
  const v = (p) => { pos.push(p[0], ground(p[0], p[1]) + lift, p[1]); uv.push(p[0] / tile, p[1] / tile); };
  const tri = (a, b, c) => {
    const ab = Math.hypot(a[0] - b[0], a[1] - b[1]), bc = Math.hypot(b[0] - c[0], b[1] - c[1]), ca = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const m = Math.max(ab, bc, ca);
    if (m <= maxEdge) {
      // wound to face up: a double-sided material lights the back of a face as if it looked down
      if ((b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) >= 0) { v(a); v(b); v(c); } else { v(a); v(c); v(b); }
      return;
    }
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (m === ab) { const d = mid(a, b); tri(a, d, c); tri(d, b, c); }
    else if (m === bc) { const d = mid(b, c); tri(a, b, d); tri(a, d, c); }
    else { const d = mid(c, a); tri(a, b, d); tri(d, b, c); }
  };
  const open = (r) => (r.length > 3 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.slice(0, -1) : r);
  for (const s of shapes) {
    const rings = s.map(open).filter((r) => r.length >= 3);
    if (!rings.length) continue;
    const V2 = (r) => r.map(([x, z]) => new THREE.Vector2(x, z));
    const outer = V2(rings[0]), holes = rings.slice(1).map(V2);
    const all = [rings[0], ...rings.slice(1)].flat();
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(outer, holes)) { tri(all[a], all[b], all[c]); if (jobs.late()) yield; }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const nor = new Float32Array(pos.length);
  for (let k = 1; k < nor.length; k += 3) nor[k] = 1;            // lit from above whichever way it winds
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}
