// Raadi stage, the wrong way (Martin 25 Nov: the stage backwards, or its east loop the other way round): drives
// made-up paths through the stage's judge (raadi.js) and checks which runs finish. A clean run, a 40 m reverse
// and on, and going back round a missed bale must finish; 120 m backwards and the east loop driven the other
// way must end with WRONG WAY.
// Needs the dev server (npx vite --port 5198) and Playwright. Usage: node tools/raadi-wrongway-test.mjs
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const D = JSON.parse(fs.readFileSync(new URL('../src/race/raadi.json', import.meta.url)));
const P = D.pts, S0 = D.start, F = D.finish;
const url = process.argv[2] || 'http://localhost:5198/?raadi=1&q=low&trees=old';

// points 2 m apart along the stage from index a to b (either way)
function along(a, b) {
  const out = [], st = a <= b ? 1 : -1;
  for (let i = a; i !== b; i += st) {
    const p = P[i], q = P[i + st], l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    for (let d = 0; d < l; d += 2) out.push([p[0] + (q[0] - p[0]) * d / l, p[1] + (q[1] - p[1]) * d / l]);
  }
  return out;
}
const run = (...parts) => [...parts.flat(), ...along(F, Math.min(F + 12, P.length - 1))];
const cases = [
  { name: 'clean run', path: run(along(S0, F)), expect: 'finish' },
  { name: '40 m back and on', path: run(along(S0, 250), along(250, 230), along(230, F)), expect: 'finish' },
  { name: '120 m backwards', path: run(along(S0, 250), along(250, 190), along(190, F)), expect: 'WRONG WAY' },
  { name: 'east loop the other way round', path: run(along(S0, 318), along(610, 402), along(402, 318), along(318, F)), expect: 'WRONG WAY' },
];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
await page.goto(url);
await page.waitForFunction(() => window.__game?.stage?.(), null, { timeout: 240000 });
await page.evaluate(() => __game.startDriving());
await page.waitForFunction(() => __game.mode === 'drive', null, { timeout: 120000 });
let bad = 0;
for (const c of cases) {
  // onto the line, the lights to green, then the stage's own frames leave the judge alone
  await page.evaluate(() => { const s = __game.stage(); if (window.__stUpdate) s.update = window.__stUpdate; s.goStart(); });
  await page.waitForFunction(() => { const s = __game.stage(); s.countLeft = 0; return s.phase === 'run'; }, null, { timeout: 180000, polling: 200 });
  const res = await page.evaluate(({ path }) => {
    const s = __game.stage();
    window.__stUpdate ||= s.update;
    s.update = () => {};
    let time = 100, msg = '';
    const car = __game.car;          // (the real car, moved step by step inside this one call: no frame runs between)
    time = car.time;
    for (let k = 0; k < path.length && s.phase === 'run'; k++) {
      car.x = path[k][0]; car.z = path[k][1]; car.time = time += 0.1;
      window.__stUpdate.call(s, car, 'impreza', 'IMPREZA', 0.1, 'kb');
      if (s.phase !== 'run') msg = document.querySelector('#stage .msg')?.textContent || '';
    }
    return { phase: s.phase, msg, runs: s.runs.length };
  }, { path: c.path });
  const got = /WRONG WAY/.test(res.msg) ? 'WRONG WAY' : res.phase === 'done' && !/CANCEL/.test(res.msg) ? 'finish' : `${res.phase} ${res.msg}`;
  const ok = got === c.expect;
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${c.name}: ${got} · ${res.msg}`);
}
await browser.close();
process.exit(bad ? 1 : 0);
