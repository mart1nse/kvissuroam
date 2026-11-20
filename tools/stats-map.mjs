// Writes public/stats-map.json: a light outline of the map for the heat map on /stats
// (public/stats.html): the map's edge, the streets and the river, simplified to a few metres, and the
// Toomemägi lap. Run again when the map grows: node tools/stats-map.mjs
import fs from 'node:fs';

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../${p}`, import.meta.url)));
const meta = read('public/data/meta.json');
const vec = read('public/data/vectors.json');
const track = read('src/race/track.json');

// Douglas-Peucker (a closed ring is done in two halves, or it would fold to its first point)
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const n = pts.length - 1;
  if (n > 3 && Math.hypot(pts[0][0] - pts[n][0], pts[0][1] - pts[n][1]) < 1e-6) {
    const h = n >> 1;
    return simplify(pts.slice(0, h + 1), tol).concat(simplify(pts.slice(h), tol).slice(1));
  }
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, az] = pts[a], [bx, bz] = pts[b];
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1;
    let worst = -1, wi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dz - (pts[i][1] - az) * dx) / L;
      if (d > worst) { worst = d; wi = i; }
    }
    if (worst > tol) { keep[wi] = 1; stack.push([a, wi], [wi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const r = (pts) => pts.map(([x, z]) => [Math.round(x), Math.round(z)]);
const area = (p) => Math.abs(p.reduce((s, [x, z], i) => { const [x2, z2] = p[(i + 1) % p.length]; return s + x * z2 - x2 * z; }, 0)) / 2;

const PATH = new Set(['Rada', 'Kergliiklustee']);
const MAJOR = new Set(['Põhimaantee', 'Tugimaantee', 'Kõrvalmaantee', 'Ramp või ühenduste']);
const roads = vec.roads.filter((x) => !PATH.has(x.type)).map((x) => ({ m: MAJOR.has(x.type) ? 1 : 0, p: r(simplify(x.pts, 4)) })).filter((x) => x.p.length > 1);
const water = vec.water.flatMap((w) => w.polys.map((p) => p.outer)).filter((p) => area(p) > 3000).map((p) => r(simplify(p, 5)));
const out = {
  boundary: r(simplify(meta.boundary, 5)),
  start: [meta.start.x, meta.start.z],
  roads: roads.map((x) => (x.m ? [1, ...x.p.flat()] : [0, ...x.p.flat()])),
  water: water.map((p) => p.flat()),
  track: r(simplify(track.pts, 3)).flat(),
};
fs.writeFileSync(new URL('../public/stats-map.json', import.meta.url), JSON.stringify(out));
console.log('stats-map.json', (JSON.stringify(out).length / 1024).toFixed(0), 'KB,', roads.length, 'roads,', water.length, 'water');
