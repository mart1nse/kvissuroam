// Holes and steps in the roads where they cross streams and ditches (and, with --roads, anywhere):
//   node tools/road-dip-test.mjs [x z radius] [--roads] [--all] [--json=file]
//
// The Land Board's terrain model has bridges and culverts taken out, and the map has no water shape for
// most small streams, so a road over one could be left with a hole as deep as the ditch (Kõrveküla-Lähte
// tee over the Vasula peakraav at the Kärkna-Kobratu crossroads, Martin 22 Nov: 1.9 m; the car fell in).
// tools/bake/stream_crossings.py fills such holes or bridges them, and lists every crossing of a drivable
// road with an ETAK stream line in tools/bake/stream_crossings.json.
//
// By default each of those crossings is checked: the road is walked a metre at a time 30 m to each side
// (on along the straightest road at its ends), keeping the height a car would have, bridge decks included.
// It fails on
//   pit   the road sinks more than 0.4 m below the lower of the highest points within 15 m on each side,
//         in a hole no wider than 26 m
//   step  the road jumps more than 0.5 m within one metre
// (shallower, wider dips at a stream are the road's own lie of the land and are left as they are).
// --roads walks every drivable road of the map instead, on its centre line and both sides, and lists
// every pit and hump over 0.5 m within 40 m and every step: many are real (cuttings, ramps, kerbs of
// hand-made places), so it is a list to look through, not a gate. It also looks for spikes in the ground:
// a grid point more than 4 m off all four neighbours. --all lists what is under the limits too (over 0.25 m).
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(root, 'public/data/');
globalThis.fetch = async (name) => {
  let buf;
  try { buf = readFileSync(join(DATA, String(name).replace(/^data\//, ''))); } catch { return { ok: false }; }
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return { ok: true, arrayBuffer: async () => ab, json: async () => JSON.parse(buf.toString('utf8')) };
};
const dir = mkdtempSync(join(tmpdir(), 'lr-'));
writeFileSync(join(dir, 'data.mjs'), readFileSync(join(root, 'src/world/data.js'), 'utf8').replace('import.meta.env.BASE_URL', "''"));
const { loadWorldData } = await import(pathToFileURL(join(dir, 'data.mjs')));
const world = await loadWorldData();

const argv = process.argv.slice(2);
const nums = argv.filter((a) => !a.startsWith('--')).map(Number);
const only = nums.length === 3 ? nums : null;
const ALL = argv.includes('--all'), ROADS = argv.includes('--roads');
const jsonOut = (argv.find((a) => a.startsWith('--json=')) || '').slice(7);
const near = (x, z) => !only || Math.hypot(x - only[0], z - only[1]) < only[2];

const PIT = 0.5, STEP = 0.5, WIN = 40, SPIKE = 4;
const LOW = ALL ? 0.25 : PIT;
const DRIVABLE = (r) => r.type !== 'Rada' && r.type !== 'Kergliiklustee' && r.pts.length > 1;
const roads = world.vectors.roads.filter((r) => DRIVABLE(r) && (r.e || 0) >= 0);

// the road network: which roads end at a point
const ends = new Map();
const ek = (p) => `${Math.round(p[0] * 2)}_${Math.round(p[1] * 2)}`;
roads.forEach((r, i) => { for (const p of [r.pts[0], r.pts[r.pts.length - 1]]) { const k = ek(p); if (!ends.has(k)) ends.set(k, []); ends.get(k).push(i); } });
// up to `len` metres of the straightest road that goes on from the end p (coming in along direction d)
function carryOn(i, p, d, len) {
  let best = null, bc = Math.cos(Math.PI / 5);
  for (const j of ends.get(ek(p)) || []) {
    if (j === i) continue;
    const q = roads[j].pts, rev = ek(q[0]) !== ek(p), pts = rev ? [...q].reverse() : q;
    const a = pts[1], l = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1, c = ((a[0] - p[0]) * d[0] + (a[1] - p[1]) * d[1]) / l;
    if (c > bc) { bc = c; best = pts; }
  }
  if (!best) return [];
  const out = [];
  let run = 0;
  for (let k = 1; k < best.length && run < len; k++) { run += Math.hypot(best[k][0] - best[k - 1][0], best[k][1] - best[k - 1][1]); out.push(best[k]); }
  return out;
}
function resample(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(l / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, (b[0] - a[0]) / (l || 1), (b[1] - a[1]) / (l || 1)]);
  }
  const z = pts[pts.length - 1], y = pts[pts.length - 2], l = Math.hypot(z[0] - y[0], z[1] - y[1]) || 1;
  out.push([z[0], z[1], (z[0] - y[0]) / l, (z[1] - y[1]) / l]);
  return out;
}
const slideMax = (a, w) => a.map((_, i) => { let m = -Infinity; for (let k = Math.max(0, i - w); k <= Math.min(a.length - 1, i + w); k++) if (a[k] > m) m = a[k]; return m; });
const slideMin = (a, w) => a.map((_, i) => { let m = Infinity; for (let k = Math.max(0, i - w); k <= Math.min(a.length - 1, i + w); k++) if (a[k] < m) m = a[k]; return m; });
const closing = (a, w) => slideMin(slideMax(a, w), w);
const opening = (a, w) => slideMax(slideMin(a, w), w);

const SZ = world.meta.sector.size, G0 = world.meta.sector.grid0;
const secOf = (x, z) => `${Math.floor((x - G0) / SZ)}_${Math.floor((z - G0) / SZ)}`;

if (!ROADS) {
  const LIMIT = 0.4, REACH = 30, W = 15;
  const list = JSON.parse(readFileSync(join(root, 'tools/bake/stream_crossings.json'), 'utf8')).filter((c) => near(c[0], c[1]));
  const by = new Map();
  for (const c of list) { const k = secOf(c[0], c[1]); if (!by.has(k)) by.set(k, []); by.get(k).push(c); }
  const bad = [], all = [];
  let checked = 0;
  for (const [sk, cs] of by) {
    const [sx, sz] = sk.split('_').map(Number);
    await world.loadAround(G0 + (sx + 0.5) * SZ, G0 + (sz + 0.5) * SZ, SZ / 2 + 80);
    for (const [x, z, kind, name] of cs) {
      // the road over it: the nearest drivable road line
      let best = 3, ri = -1, seg = 0;
      roads.forEach((r, i) => {
        for (let j = 0; j < r.pts.length - 1; j++) {
          const a = r.pts[j], b = r.pts[j + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
          const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
          const d = Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
          if (d < best) { best = d; ri = i; seg = j; }
        }
      });
      if (ri < 0 || !world.ready(x, z)) continue;
      const r = roads[ri], p = r.pts, n = p.length;
      const d0 = [p[0][0] - p[1][0], p[0][1] - p[1][1]], l0 = Math.hypot(...d0) || 1;
      const d1 = [p[n - 1][0] - p[n - 2][0], p[n - 1][1] - p[n - 2][1]], l1 = Math.hypot(...d1) || 1;
      const line = [...carryOn(ri, p[0], [d0[0] / l0, d0[1] / l0], REACH + 5).reverse(), ...p, ...carryOn(ri, p[n - 1], [d1[0] / l1, d1[1] / l1], REACH + 5)];
      const walk = resample(line, 1);
      let k0 = 0, bd = Infinity;
      walk.forEach((w, k) => { const d = Math.hypot(w[0] - x, w[1] - z); if (d < bd) { bd = d; k0 = k; } });
      let pts = walk.slice(Math.max(0, k0 - REACH), k0 + REACH + 1);
      k0 -= Math.max(0, k0 - REACH);
      // (only as far as the map goes: past its edge the far scenery's coarse ground is no road)
      let lo = k0, hi = k0;
      while (lo > 0 && world.sdfAt(pts[lo - 1][0], pts[lo - 1][1]) > -3.5) lo--;
      while (hi < pts.length - 1 && world.sdfAt(pts[hi + 1][0], pts[hi + 1][1]) > -3.5) hi++;
      pts.splice(hi + 1); pts.splice(0, lo); k0 -= lo;
      let y = world.topAt(pts[0][0], pts[0][1], r.e || 0);
      const h = pts.map(([px, pz]) => (y = world.groundAt(px, pz, y + 0.4)));
      const fill = h.map((v, k) => Math.min(Math.max(...h.slice(Math.max(0, k - W), k + 1)), Math.max(...h.slice(k, k + W + 1))) - v);
      let pit = 0, step = 0, at = k0;
      for (let k = Math.max(0, k0 - 8); k <= Math.min(h.length - 1, k0 + 8); k++) {
        if (fill[k] > pit) { pit = fill[k]; at = k; }
        if (k > 0) step = Math.max(step, Math.abs(h[k] - h[k - 1]));
      }
      // a dip wider than 26 m is the lie of the land (a valley the road goes down into), not a hole
      let a = at, b = at;
      while (a > 0 && fill[a - 1] > 0.04) a--;
      while (b < h.length - 1 && fill[b + 1] > 0.04) b++;
      if (b - a > 26) pit = Math.min(pit, 0.25);
      // nor is a road that ends climbing out of a dip, short of REACH: the hole would need a far rim
      const lm = h.slice(Math.max(0, at - W), at + 1), rm = h.slice(at, at + W + 1);
      const lowSide = Math.max(...lm) < Math.max(...rm) ? 'l' : 'r';
      if ((lowSide === 'l' && at - W <= 0 && lm.indexOf(Math.max(...lm)) === 0 && k0 < REACH) || (lowSide === 'r' && at + W >= h.length - 1 && rm.lastIndexOf(Math.max(...rm)) === rm.length - 1 && h.length - 1 - k0 < REACH)) pit = Math.min(pit, 0.25);
      checked++;
      const rec = { x, z, kind, name, road: r.name || r.type, pit: +pit.toFixed(2), step: +step.toFixed(2), at: [+pts[at][0].toFixed(1), +pts[at][1].toFixed(1)] };
      all.push(rec);
      if (pit > LIMIT || step > STEP) bad.push(rec);
    }
    world.update(1e9, 1e9, 0, 1);
  }
  all.sort((a, b) => b.pit - a.pit);
  for (const f of ALL ? all.filter((f) => f.pit > 0.25 || f.step > 0.25) : bad) console.log(`${f.pit > LIMIT || f.step > STEP ? 'FAIL' : '    '} pit ${f.pit.toFixed(2)} m, step ${f.step.toFixed(2)} m  at ${f.at.join(', ')}  ${f.road} over ${f.kind} ${f.name}`);
  console.log(`\n${checked} road and stream crossings checked: ${bad.length} with a hole deeper than ${LIMIT} m or a step over ${STEP} m (deepest left: ${all[0] ? all[0].pit : 0} m)`);
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify(all, null, 1));
  process.exit(bad.length ? 1 : 0);
}

// sectors a few at a time, so the whole map fits in memory
const bySec = new Map();
roads.forEach((r, i) => { if (!r.pts.some((p) => near(p[0], p[1]))) return; const m = r.pts[Math.floor(r.pts.length / 2)], k = secOf(m[0], m[1]); if (!bySec.has(k)) bySec.set(k, []); bySec.get(k).push(i); });

const found = [];
let walked = 0;
const seen = new Set();
const flag = (kind, x, z, v, r, off) => {
  const k = `${kind}${Math.round(x / 15)}_${Math.round(z / 15)}`;
  if (seen.has(k)) { const f = found.find((o) => o.key === k); if (f && v > f.v) { f.v = v; f.x = Math.round(x * 10) / 10; f.z = Math.round(z * 10) / 10; } return; }
  seen.add(k);
  found.push({ key: k, kind, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, v, road: `${r.name || r.type}`.trim(), w: r.w, e: r.e || 0, off });
};
for (const [sk, list] of bySec) {
  const [sx, sz] = sk.split('_').map(Number);
  await world.loadAround(G0 + (sx + 0.5) * SZ, G0 + (sz + 0.5) * SZ, SZ);
  for (const i of list) {
    const r = roads[i], p = r.pts, n = p.length;
    const d0 = [p[0][0] - p[1][0], p[0][1] - p[1][1]], l0 = Math.hypot(...d0) || 1;
    const d1 = [p[n - 1][0] - p[n - 2][0], p[n - 1][1] - p[n - 2][1]], l1 = Math.hypot(...d1) || 1;
    const pre = carryOn(i, p[0], [d0[0] / l0, d0[1] / l0], WIN).reverse(), post = carryOn(i, p[n - 1], [d1[0] / l1, d1[1] / l1], WIN);
    const line = [...pre, ...p, ...post];
    const walk = resample(line, 1);
    // the part that is this road's own (the rest is only there to see a hole at its ends)
    let a = 0, b = walk.length - 1;
    while (a < walk.length - 1 && Math.hypot(walk[a][0] - p[0][0], walk[a][1] - p[0][1]) > 0.8) a++;
    while (b > 0 && Math.hypot(walk[b][0] - p[n - 1][0], walk[b][1] - p[n - 1][1]) > 0.8) b--;
    if (b <= a) { a = 0; b = walk.length - 1; }
    const hw = Math.max(0, Math.min(r.w / 2 - 1.2, 2.5));
    for (const off of hw > 0.5 ? [0, hw, -hw] : [0]) {
      const xs = [], zs = [], hs = [];
      let y = null;
      for (const [x0, z0, tx, tz] of walk) {
        const x = x0 - tz * off, z = z0 + tx * off;
        if (y === null) y = world.topAt(x, z, r.e || 0);
        y = world.groundAt(x, z, y + 0.4);
        xs.push(x); zs.push(z); hs.push(y);
      }
      walked += b - a;
      const up = closing(hs, WIN / 2), dn = opening(hs, WIN / 2);
      for (let k = a; k <= b; k++) {
        if (!near(xs[k], zs[k]) || world.sdfAt(xs[k], zs[k]) < 0.5) continue;      // (inside a wall or a house: not road)
        if (up[k] - hs[k] > LOW) flag('pit', xs[k], zs[k], +(up[k] - hs[k]).toFixed(2), r, off);
        if (hs[k] - dn[k] > LOW) flag('hump', xs[k], zs[k], +(hs[k] - dn[k]).toFixed(2), r, off);
        if (k > a && Math.abs(hs[k] - hs[k - 1]) > STEP) flag('step', xs[k], zs[k], +Math.abs(hs[k] - hs[k - 1]).toFixed(2), r, off);
      }
    }
  }
  // spikes in the ground of this sector
  for (let x = G0 + sx * SZ + 1; x < G0 + (sx + 1) * SZ - 1; x += 2) {
    for (let z = G0 + sz * SZ + 1; z < G0 + (sz + 1) * SZ - 1; z += 2) {
      if (!near(x, z)) continue;
      const h = world.heightAt(x, z), nb = [world.heightAt(x - 2, z), world.heightAt(x + 2, z), world.heightAt(x, z - 2), world.heightAt(x, z + 2)];
      if (!Number.isFinite(h)) { found.push({ kind: 'nan', x, z, v: 0, road: '' }); continue; }
      if (nb.every((g) => h - g > SPIKE) || nb.every((g) => g - h > SPIKE)) found.push({ kind: 'spike', x, z, v: +(h - nb.reduce((t, g) => t + g, 0) / 4).toFixed(1), road: '' });
    }
  }
  // (let the sectors go again: the next ones load in their place)
  world.update(1e9, 1e9, 0, 1);
}

const big = found.filter((f) => f.kind === 'spike' || f.kind === 'nan' || (f.kind === 'step' ? f.v > STEP : f.v > PIT));
found.sort((p, q) => q.v - p.v);
for (const f of found) console.log(`${f.kind.padEnd(5)} ${String(f.v).padStart(5)} m  at ${f.x}, ${f.z}  ${f.road}${f.e ? ' (bridge)' : ''}`);
console.log(`\n${(walked / 1000).toFixed(0)} km of road lines walked: ${big.filter((f) => f.kind === 'pit').length} pits, ${big.filter((f) => f.kind === 'hump').length} humps, ${big.filter((f) => f.kind === 'step').length} steps, ${big.filter((f) => f.kind === 'spike' || f.kind === 'nan').length} spikes in the ground`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(found.map(({ key, ...f }) => f), null, 1));
process.exit(big.length ? 1 : 0);
