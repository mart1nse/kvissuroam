// Short cuts on the lap: drives made-up paths through the lap timer (race.js) and checks which laps
// count. A full lap and a lap with an overshoot at the Jakobi crossing must count; skipping the Emajõe
// loop up Jakobi (Martin, 21 Nov) or cutting through the city must cancel with SHORT CUT, and the
// cancel must come before the next checkpoint.
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
const lap = (...parts) => [...along(N - 30, 0), ...parts.flat(), ...along(0, 40)];

const cases = [
  { name: 'full lap', path: lap(along(0, N)), expect: 'lap' },
  { name: 'overshoot at the Jakobi crossing and back', path: lap(along(0, 628), straight(P[628], P[1350]), straight(P[1350], P[628]), along(628, N)), expect: 'lap' },
  { name: 'overshoot 40 m along the other pass and back', path: lap(along(0, 628), straight(P[628], P[1345]), along(1345, 1365), straight(P[1365], P[628]), along(628, N)), expect: 'lap' },
  { name: 'Emajõe loop skipped up Jakobi', path: lap(along(0, 628), straight(P[628], P[1345]), along(1345, N)), expect: 'cut', before: 1612 },
  { name: 'Emajõe loop skipped, other line', path: lap(along(0, 615), straight(P[615], P[1360]), along(1360, N)), expect: 'cut', before: 1612 },
  { name: 'through the city past Lai', path: lap(along(0, 900), straight(P[900], P[1000]), along(1000, N)), expect: 'cut', before: 1036 },
  { name: 'small corner cut', path: lap(along(0, 500), straight(P[500], P[540]), along(540, N)), expect: 'lap' },
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
  const ok = got === c.expect && (c.before == null || res.cutAt < c.before);
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${c.name}: ${got}${res.cutAt >= 0 ? ` at track point ${res.cutAt}` : ''}${c.before ? ` (next checkpoint ${c.before})` : ''} · ${res.msg}`);
}
await browser.close();
process.exit(bad ? 1 : 0);
