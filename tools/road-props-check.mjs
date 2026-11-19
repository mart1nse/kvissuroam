// Street furniture on the carriageway: counts the surveyed props whose footprint overlaps the painted
// road of a street or main road, and what src/world/roadprops.js does with them (moved to the
// pavement or left out). Hand-made places (overPaint) are not known here, so a few props this
// lists are skipped in the game. Run: node tools/road-props-check.mjs [--list]
import { readFileSync } from 'node:fs';
import { fixRoadProps } from '../src/world/roadprops.js';

const data = JSON.parse(readFileSync(new URL('../public/data/props.json', import.meta.url)));
const vectors = JSON.parse(readFileSync(new URL('../public/data/vectors.json', import.meta.url)));
const NAMES = ['lamp', 'pole', 'signal', 'bench', 'bin', 'rack', 'box', 'zebra', 'bollard', 'lantern'];
const name = (k) => (k >= 10 ? 'sign' : NAMES[k]);

const { moved, removed } = fixRoadProps(data, vectors);
const tally = (list) => {
  const t = {};
  for (const m of list) t[name(m.kind)] = (t[name(m.kind)] || 0) + 1;
  return Object.entries(t).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${k}`).join(', ');
};
console.log(`moved to the pavement: ${moved.length} (${tally(moved)})`);
console.log(`left out: ${removed.length} (${tally(removed)})`);
if (process.argv.includes('--list')) {
  for (const m of moved) console.log('moved', m.id, name(m.kind), m.road, m.from.join(','), '->', m.to.join(','));
  for (const m of removed) console.log('removed', m.id, name(m.kind), m.road, m.at.join(','));
}
// a second pass must find nothing left on the road
const again = fixRoadProps(data, vectors);
if (again.moved.length) { console.log(`FAIL: ${again.moved.length} props still on the road after moving`); process.exit(1); }
console.log('ok: nothing moved is still on the road');
