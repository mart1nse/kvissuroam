// Height profile of the roads through a point: node tools/overpass-profile.mjs x z [radius]
// (terrain, the deck over it and what a car follows, every 2 m). For looking closer at what overpass-test.mjs reports.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
globalThis.fetch = async (name) => {
  let buf;
  try { buf = readFileSync(join(root, 'public', String(name))); } catch { return { ok: false }; }
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return { ok: true, arrayBuffer: async () => ab, json: async () => JSON.parse(buf.toString('utf8')) };
};
const dir = mkdtempSync(join(tmpdir(), 'lr-'));
writeFileSync(join(dir, 'data.mjs'), readFileSync(join(root, 'src/world/data.js'), 'utf8').replace('import.meta.env.BASE_URL', "''"));
const { loadWorldData } = await import(pathToFileURL(join(dir, 'data.mjs')));
const world = await loadWorldData();
const [X, Z, R = 4] = process.argv.slice(2).map(Number);
await world.loadAround(X, Z, 500);
for (const r of world.vectors.roads) {
  const pts = [];
  for (let i = 0; i < r.pts.length - 1; i++) {
    const a = r.pts[i], b = r.pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(l / 2));
    for (let k = 0; k <= (i === r.pts.length - 2 ? n : n - 1); k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  const k0 = pts.findIndex((p) => Math.hypot(p[0] - X, p[1] - Z) < R);
  if (k0 < 0) continue;
  console.log(`${r.type} ${r.name} w${r.w} level ${r.e || 0}`);
  let y = null;
  for (let k = Math.max(0, k0 - 25); k < Math.min(pts.length, k0 + 25); k++) {
    const [x, z] = pts[k];
    if (y === null) y = world.topAt(x, z, r.e || 0);
    const g = world.groundAt(x, z, y + 0.4), t = world.heightAt(x, z), top = world.topAt(x, z, 1);
    console.log(`  (${x.toFixed(0)}, ${z.toFixed(0)}) terrain ${t.toFixed(1)}  top ${top.toFixed(1)}  car ${g.toFixed(1)}${Math.abs(g - y) > 0.3 ? '  <<< ' + (g - y).toFixed(2) : ''}`);
    y = g;
  }
}
