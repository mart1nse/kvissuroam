// Short cuts on the lap: drives made-up paths through the lap timer (race.js) and checks which laps
// count. A full lap, a lap with an overshoot at the Jakobi crossing and a short reverse must count; skipping
// the Emajõe loop up Jakobi (Martin, 21 Nov), up Kroonuaia and back, the loop backwards, Lai from the park
// (24 Nov) must cancel with SHORT CUT at the first hidden gate past the crossing (src/race/lapgates.js),
// and more than 100 m the wrong way with WRONG WAY.
// Needs the dev server (npx vite --port 5198) and Playwright. Usage: node tools/shortcut-test.mjs
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const T = JSON.parse(fs.readFileSync(new URL('../src/race/track.json', import.meta.url)));
const P = T.pts, N = P.length;
const url = process.argv[2] || 'http://localhost:5198/?q=low&trees=old';

// a path of points 3 m apart: along the lap from index a to b, or straight to a point
function along(a, b, side = 1.5) {
  const out = [];
  for (let k = 0, n = ((b - a) % N + N) % N || N; k < n; k++) {
    const i = (a + k) % N, p = P[i], q = P[(i + 1) % N];
    const tx = q[0] - p[0], tz = q[1] - p[1], l = Math.hypot(tx, tz) || 1;
    for (let d = 0; d < l; d += 3) out.push([p[0] + tx * d / l - tz / l * side, p[1] + tz * d / l + tx / l * side]);
  }
  return out;
}
function straight(from, to) {
  const out = [], l = Math.hypot(to[0] - from[0], to[1] - from[1]);
  for (let d = 0; d < l; d += 3) out.push([from[0] + (to[0] - from[0]) * d / l, from[1] + (to[1] - from[1]) * d / l]);
  return out;
}
// a spot m metres beside lap point i (right of the direction of travel for m > 0)
function off(i, m) {
  const p = P[i], q = P[(i + 1) % N], tx = q[0] - p[0], tz = q[1] - p[1], l = Math.hypot(tx, tz) || 1;
  return [p[0] - tz / l * m, p[1] + tx / l * m];
}
// along the lap the wrong way, from index a down to b
const back = (a, b) => along(b, a, -1.5).reverse();
const lap = (...parts) => [...along(N - 30, 0), ...parts.flat(), ...along(0, 40)];

const cases = [
  { name: 'full lap', path: lap(along(0, N)), expect: 'lap' },
  { name: 'overshoot at the Jakobi crossing and back', path: lap(along(0, 628), straight(P[628], P[1350]), straight(P[1350], P[628]), along(628, N)), expect: 'lap' },
  { name: 'overshoot 40 m along the other pass and back', path: lap(along(0, 628), straight(P[628], P[1345]), along(1345, 1365), straight(P[1365], P[628]), along(628, N)), expect: 'lap' },
  { name: 'overshoot 50 m straight on up Kroonuaia and back', path: lap(along(0, 628), back(1328, 1305), along(1305, 1328), along(628, N)), expect: 'lap' },
  { name: 'Emajõe loop skipped up Jakobi', path: lap(along(0, 628), straight(P[628], P[1345]), along(1345, N)), expect: 'cut', at: 1375 },
  { name: 'Emajõe loop skipped, other line', path: lap(along(0, 615), straight(P[615], P[1360]), along(1360, N)), expect: 'cut', at: 1375 },
  { name: 'up Kroonuaia to the river and back (24 Nov)', path: lap(along(0, 628), straight(P[628], P[1328]), back(1328, 1036), along(1036, N)), expect: 'cut', at: 1275 },
  { name: 'river loop backwards (24 Nov)', path: lap(along(0, 628), straight(P[628], P[1328]), back(1328, 700), back(700, 628), straight(P[628], P[1328]), along(1328, N)), expect: 'cut', at: 1275 },
  { name: 'Baeri to Lai through the park (24 Nov)', path: lap(along(0, 520), straight(P[520], P[705]), along(705, N)), expect: 'cut', at: 700 },
  { name: 'through the city past Lai', path: lap(along(0, 900), straight(P[900], P[1000]), along(1000, N)), expect: 'cut', at: 975 },
  { name: 'small corner cut', path: lap(along(0, 500), straight(P[500], P[540]), along(540, N)), expect: 'lap' },
  { name: 'wide onto the grass, 40 m off at a gate (24 Nov)', path: lap(along(0, 790), straight(P[790], off(800, 40)), straight(off(800, 40), P[810]), along(810, N)), expect: 'lap' },
  { name: 'wide past the river checkpoint, 25 m off', path: lap(along(0, 1030), straight(P[1030], off(1036, -25)), straight(off(1036, -25), P[1042]), along(1042, N)), expect: 'lap' },
  { name: 'wide 70 m off for one gate', path: lap(along(0, 785), straight(P[785], off(800, 70)), straight(off(800, 70), P[815]), along(815, N)), expect: 'lap' },
  { name: '60 m back the wrong way and on', path: lap(along(0, 800), back(800, 770), along(770, N)), expect: 'lap' },
  { name: '120 m the wrong way', path: lap(along(0, 800), back(800, 740), along(740, N)), expect: 'cut', at: 750 },
];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
await page.goto(url);
await page.waitForFunction(() => window.__game?.race?.(), null, { timeout: 240000 });
await page.evaluate(() => {
  const r = __game.race();
  window.__lapUpdate = r.update;
  r.update = () => {};            // the game's own frames leave the lap timer alone
});
let bad = 0;
for (const c of cases) {
  const res = await page.evaluate(({ path, P }) => {
    const r = __game.race();
    const n0 = r.laps.length;
    let time = 1000, cutAt = -1;
    r.cancel('', false);          // a lap left running by the case before
    for (let k = 0; k < path.length; k++) {
      const [x, z] = path[k];
      time += 0.1;
      __lapUpdate.call(r, { x, z, time, vx: 30 }, 'f40', 'F40');
      if (cutAt < 0 && document.querySelector('#lapsplit')?.className === 'cut') {
        cutAt = k;
        // nearest lap index of the spot where it was called
        let bi = 0, bd = Infinity;
        P.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; bi = i; } });
        cutAt = bi;
        document.querySelector('#lapsplit').className = 'hidden';
      }
    }
    return { laps: r.laps.length - n0, cutAt, msg: document.querySelector('#lapmsg')?.textContent };
  }, { path: c.path, P });
  const got = res.laps > 0 ? 'lap' : res.cutAt >= 0 ? 'cut' : 'nothing';
  const ok = got === c.expect && (c.at == null || Math.abs(res.cutAt - c.at) < 30);
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${c.name}: ${got}${res.cutAt >= 0 ? ` at track point ${res.cutAt}` : ''}${c.at ? ` (checkpoint at ${c.at})` : ''} · ${res.msg}`);
}
await browser.close();
process.exit(bad ? 1 : 0);
