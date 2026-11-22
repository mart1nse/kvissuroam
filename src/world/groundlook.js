// What the hand-laid ground looks like underfoot, for the tyre marks (22 Nov 2026, Martin: "check that they are
// drawn also on ... paved or cobbled sidewalks", and marks on grass and gravel that suit the ground).
//
// The map's 1 m surface grid knows grass, paving, gravel and dirt, but not what a hand-built place laid on top of
// it: a block-paved pavement over a cell the map called grass, a lawn over a cell it called paving. The places'
// ground layers (streetKit ribbons, groundLayer strips, draped shapes) write their kind here as they are built, on
// a 1 m grid of its own, kept only where something was laid (32 m squares of 1 KB each: the whole centre is a few
// hundred KB). Where two layers overlap, the one laid higher (the one that is drawn) wins.
//
// The marking runs as a job in the work queue, a few thousand triangles a step, so it adds nothing to a frame.
import { jobs } from '../jobs.js';

export const LOOK = { PAVED: 1, SETTS: 2, GRASS: 3, GRAVEL: 4, DIRT: 5 };

const C = 32;                       // metres per square
const squares = new Map();
const key = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);

function setCell(x, z, v) {
  const cx = Math.floor(x / C), cz = Math.floor(z / C);
  const k = key(cx, cz);
  let a = squares.get(k);
  if (a === undefined) squares.set(k, (a = new Uint8Array(C * C)));
  const i = (z - cz * C) * C + (x - cx * C);
  if ((a[i] >> 3) <= (v >> 3)) a[i] = v;
}

// the cells (1 m, by their centres) inside each triangle of a flat [x, y, z, ...] list, from triangle t0 to t1
function markRange(pos, t0, t1, v) {
  for (let t = t0; t < t1; t++) {
    const o = t * 9;
    const ax = pos[o], az = pos[o + 2], bx = pos[o + 3], bz = pos[o + 5], cx = pos[o + 6], cz = pos[o + 8];
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(d) < 1e-6) continue;
    const x0 = Math.ceil(Math.min(ax, bx, cx) - 0.5), x1 = Math.floor(Math.max(ax, bx, cx) - 0.5);
    const z0 = Math.ceil(Math.min(az, bz, cz) - 0.5), z1 = Math.floor(Math.max(az, bz, cz) - 0.5);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, pz = z + 0.5;
      const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d;
      const l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d;
      if (l1 >= -1e-4 && l2 >= -1e-4 && l1 + l2 <= 1.0001) setCell(x, z, v);
    }
  }
}

// A ground layer of `look` laid `lift` metres over the terrain: pos is its triangles, [x, y, z, ...] (an array,
// a typed array or a BufferGeometry, non-indexed).
export function markGround(pos, look, lift = 0.07) {
  if (!look || !pos) return;
  if (pos.isBufferGeometry) {
    if (pos.index) return;
    pos = pos.attributes.position.array;
  }
  const n = Math.floor(pos.length / 9);
  if (!n) return;
  const v = (Math.min(31, Math.max(0, Math.round(lift * 100))) << 3) | look;
  jobs.add(function* () {
    for (let t = 0; t < n; t += 1500) {
      markRange(pos, t, Math.min(n, t + 1500), v);
      if (jobs.late()) yield;
    }
  }, 'ground look');
}

// The hand-laid look at the point, 0 where nothing was laid.
export function groundLook(x, z) {
  if (squares.size === 0) return 0;
  const cx = Math.floor(x / C), cz = Math.floor(z / C);
  const a = squares.get(key(cx, cz));
  if (a === undefined) return 0;
  return a[(Math.floor(z) - cz * C) * C + (Math.floor(x) - cx * C)] & 7;
}

export const groundLookStats = () => ({ squares: squares.size, kb: squares.size * C * C / 1024 });
