// Street lights and wooden poles standing too close together: what src/world/propspacing.js leaves
// out, by street. Runs road-props first as the game does. The hand-placed props of the hand-made
// places are not known here (the game adds a 60 m circle round each), so the game removes a few less.
// Run: node tools/prop-spacing-check.mjs [--list] [--json out.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { fixRoadProps } from '../src/world/roadprops.js';
import { thinProps, handZones, LIGHT_GAP, POLE_GAP } from '../src/world/propspacing.js';

const data = JSON.parse(readFileSync(new URL('../public/data/props.json', import.meta.url)));
const vectors = JSON.parse(readFileSync(new URL('../public/data/vectors.json', import.meta.url)));
const stops = JSON.parse(readFileSync(new URL('../src/world/busstops.json', import.meta.url))).stops;

const road = fixRoadProps(data, vectors);
const circles = stops.map(([x, z]) => ({ x, z, r: 20 }));
const kept = handZones(circles);
const { removed } = thinProps(data, vectors, kept, road.cleared);
const count = (kind) => {
  let n = 0;
  for (const a of Object.values(data.sectors)) for (let k = 0; k < a.length; k += data.stride) if (a[k] === kind) n++;
  return n;
};
const lamps = removed.filter((r) => r.kind === 0), poles = removed.filter((r) => r.kind === 1);
console.log(`street lights left out: ${lamps.length} of ${count(0)} (closer than ${LIGHT_GAP} m on one side)`);
console.log(`wooden poles left out: ${poles.length} of ${count(1)} (closer than ${POLE_GAP} m, or on a light's spot)`);

// nearest named street of each
const named = vectors.roads.filter((r) => r.name && r.pts.length > 1);
const CELL = 64, grid = new Map();
for (const r of named) for (const [x, z] of r.pts) {
  const k = Math.floor(x / CELL) * 100003 + Math.floor(z / CELL);
  if (!grid.has(k)) grid.set(k, new Set());
  grid.get(k).add(r);
}
const streetOf = ([x, z]) => {
  let best = null, bd = Infinity;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    for (const r of grid.get((Math.floor(x / CELL) + dx) * 100003 + Math.floor(z / CELL) + dz) || []) {
      for (let i = 1; i < r.pts.length; i++) {
        const [ax, az] = r.pts[i - 1], [bx, bz] = r.pts[i], ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2));
        const d = Math.hypot(x - ax - ex * t, z - az - ez * t);
        if (d < bd) { bd = d; best = r.name; }
      }
    }
  }
  return best || '(no street near)';
};
const by = {};
for (const r of removed) { r.street = streetOf(r.at); (by[r.street] ||= []).push(r); }
const top = Object.entries(by).sort((a, b) => b[1].length - a[1].length);
console.log(`streets: ${top.length}; most thinned:`);
for (const [s, l] of top.slice(0, 25)) console.log(`  ${s}: ${l.filter((r) => !r.kind).length} lights, ${l.filter((r) => r.kind).length} poles`);
if (process.argv.includes('--list')) for (const r of removed) console.log(r.kind ? 'pole' : 'light', r.id, r.street, r.at.join(','), 'kept', r.by);
const j = process.argv.indexOf('--json');
if (j > 0) writeFileSync(process.argv[j + 1], JSON.stringify(removed));
// nothing left too close
const again = thinProps(data, vectors, kept, new Set([...road.cleared, ...removed.map((r) => r.id)]));
if (again.removed.length) { console.log(`FAIL: ${again.removed.length} still too close after thinning`); process.exit(1); }
console.log('ok: no light or pole outside the keep-out zones is still too close');
