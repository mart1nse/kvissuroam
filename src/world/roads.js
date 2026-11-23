// Painted road markings, generated from the road centrelines: a dashed centre line on wider streets,
// and on four-lane roads a solid centre line with dashed lane lines either side; edge lines where an area asks for them.
import * as THREE from 'three';

const DASH = 3, GAP = 6, WIDTH = 0.13;
const MAIN = new Set(['Põhimaantee', 'Tugimaantee', 'Kõrvalmaantee']);

export function createRoadMarkings(world) {
  const S = world.meta.sector.size, G0 = world.meta.sector.grid0;
  const bySector = new Map();           // "sx_sz" -> [x1, z1, x2, z2, ...]
  const skip = world.vectors.markSkip;   // stretches that paint their own lines (src/race/emajoe.js)
  let keep = null;                      // a road's own filter while its lines are walked (noCentre)
  const put = (x1, z1, x2, z2) => {
    if (skip && skip((x1 + x2) / 2, (z1 + z2) / 2)) return;
    if (keep && !keep((x1 + x2) / 2, (z1 + z2) / 2)) return;
    const k = `${Math.floor(((x1 + x2) / 2 - G0) / S)}_${Math.floor(((z1 + z2) / 2 - G0) / S)}`;
    let a = bySector.get(k);
    if (!a) bySector.set(k, (a = []));
    a.push(x1, z1, x2, z2, level);
  };
  let level = 0;                        // of the road being walked: 1 on a bridge, -1 in a tunnel

  // walk a polyline and emit strokes [from, to] (metres along it), shifted sideways by "side"
  function strokes(pts, side, on, off, skip) {
    let total = 0;
    const len = [];
    for (let i = 0; i < pts.length - 1; i++) { len.push(Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])); total += len[i]; }
    if (total < skip * 2 + on) return;
    const at = (d, out) => {
      let i = 0;
      while (i < len.length - 1 && d > len[i]) d -= len[i++];
      const t = len[i] ? d / len[i] : 0, a = pts[i], b = pts[i + 1];
      const dx = (b[0] - a[0]) / (len[i] || 1), dz = (b[1] - a[1]) / (len[i] || 1);
      out[0] = a[0] + (b[0] - a[0]) * t - dz * side;
      out[1] = a[1] + (b[1] - a[1]) * t + dx * side;
    };
    const p = [0, 0], q = [0, 0];
    for (let d = skip; d + on <= total - skip; d += on + off) {
      at(d, p); at(d + on, q);
      put(p[0], p[1], q[0], q[1]);
    }
  }

  // solid edge lines on roads that a hand-made area flags with "edges" (src/world/lounapaint.js), left out where
  // another road's carriageway joins or crosses
  const edged = world.vectors.roads.filter((r) => r.edges && r.pts.length > 1);
  if (edged.length) {
    const DRIVE = new Set([...MAIN, 'Tänav', 'Ramp või ühenduste', 'Muu tee']), CELL = 25, grid = new Map();
    for (const q of world.vectors.roads) {
      if (!DRIVE.has(q.type)) continue;
      for (let i = 0; i < q.pts.length - 1; i++) {
        const [ax, az] = q.pts[i], [bx, bz] = q.pts[i + 1], pad = q.w / 2 + 1;
        for (let cx = Math.floor((Math.min(ax, bx) - pad) / CELL); cx <= Math.floor((Math.max(ax, bx) + pad) / CELL); cx++) {
          for (let cz = Math.floor((Math.min(az, bz) - pad) / CELL); cz <= Math.floor((Math.max(az, bz) + pad) / CELL); cz++) {
            const k = cx * 100003 + cz;
            let a = grid.get(k);
            if (!a) grid.set(k, (a = []));
            a.push(q, i);
          }
        }
      }
    }
    // is (x, z) on another road's carriageway? Pieces of the same road running the same way do not count.
    const onOther = (r, x, z, ux, uz) => {
      const a = grid.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL));
      if (!a) return false;
      for (let k = 0; k < a.length; k += 2) {
        const q = a[k], i = a[k + 1];
        if (q === r) continue;
        const [ax, az] = q.pts[i], [bx, bz] = q.pts[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
        if (!l2) continue;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
        if (Math.hypot(ax + dx * t - x, az + dz * t - z) >= q.w / 2 + 0.2) continue;
        if (q.name === r.name && Math.abs(q.w - r.w) < 0.05 && Math.abs((dx * ux + dz * uz) / Math.sqrt(l2)) > 0.9) continue;
        return true;
      }
      return false;
    };
    for (const r of edged) {
      level = r.e || 0;
      const off = r.w / 2 - 0.45;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1], l = Math.hypot(bx - ax, bz - az);
        if (l < 0.05) continue;
        const ux = (bx - ax) / l, uz = (bz - az) / l, n = Math.max(1, Math.round(l / 4));
        for (let j = 0; j < n; j++) {
          const t0 = l * j / n, t1 = l * (j + 1) / n, tm = (t0 + t1) / 2;
          for (const side of [off, -off]) {
            const mx = ax + ux * tm - uz * side, mz = az + uz * tm + ux * side;
            if (onOther(r, mx, mz, ux, uz)) continue;
            put(ax + ux * t0 - uz * side, az + uz * t0 + ux * side, ax + ux * t1 - uz * side, az + uz * t1 + ux * side);
          }
        }
      }
    }
  }

  for (const r of world.vectors.roads) {
    const main = MAIN.has(r.type);
    if (!main && r.type !== 'Tänav') continue;
    if (r.nomark) continue;                               // the real road has no lines here (src/world/lounapaint.js)
    if (r.s === 2 || r.s === 3) continue;                 // gravel and dirt carry no paint
    if (r.w < (main ? 5.5 : 6.4) || r.pts.length < 2) continue;
    level = r.e || 0;
    if (r.w >= 11.5) {
      if (r.noCentre) keep = (x, z) => !r.noCentre(x, z);  // a painted island instead (src/world/turupaint.js)
      strokes(r.pts, 0, 4.5, 0, 10);                       // solid centre
      keep = null;
      strokes(r.pts, r.w / 4, DASH, GAP, 12);
      strokes(r.pts, -r.w / 4, DASH, GAP, 12);
    } else {
      strokes(r.pts, r.mark || 0, DASH, GAP, 9);          // mark: a lane line moved off the centre
    }
  }

  // lines an area draws itself, such as hatched islands: [x1, z1, x2, z2, ...] on the ground
  const extra = world.vectors.extraLines;
  if (extra) { level = 0; for (let i = 0; i + 3 < extra.length; i += 4) put(extra[i], extra[i + 1], extra[i + 2], extra[i + 3]); }

  const mat = new THREE.MeshLambertMaterial({ color: 0xdedbe6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

  // build(sector) -> mesh or null
  return (sector) => {
    const a = bySector.get(`${sector.sx}_${sector.sz}`);
    if (!a) return null;
    const n = a.length / 5;
    const pos = new Float32Array(n * 12), nor = new Float32Array(n * 12), idx = new Uint32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const x1 = a[i * 5], z1 = a[i * 5 + 1], x2 = a[i * 5 + 2], z2 = a[i * 5 + 3], lv = a[i * 5 + 4];
      const l = Math.hypot(x2 - x1, z2 - z1) || 1, nx = -(z2 - z1) / l * WIDTH / 2, nz = (x2 - x1) / l * WIDTH / 2;
      const cl = (v, lo) => Math.min(Math.max(v, lo + 0.01), lo + S - 0.01);     // stay on this sector's height grid
      const y1 = world.topAt(cl(x1, sector.x0), cl(z1, sector.z0), lv) + 0.06, y2 = world.topAt(cl(x2, sector.x0), cl(z2, sector.z0), lv) + 0.06;
      pos.set([x1 - nx, y1, z1 - nz, x1 + nx, y1, z1 + nz, x2 - nx, y2, z2 - nz, x2 + nx, y2, z2 + nz], i * 12);
      for (let k = 0; k < 4; k++) nor[i * 12 + k * 3 + 1] = 1;
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    return mesh;
  };
}
