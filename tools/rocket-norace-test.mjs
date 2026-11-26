// A car with thrusters does not race (Martin 26 Nov: "do not allow the tesla to take part in races"). Two browsers
// in the same lobby, A in the Rocket and B in an ordinary car: A is not in the vote's pool, its button says so and
// does nothing, the server takes no join from it however it is sent, and a racer who takes the Rocket before the
// lights is off the list again.
// Needs the game served with its server on :8787, with the hidden cars let in:
//   npm run build && npx wrangler dev --port 8787 --var SHOW_HIDDEN:1
// and Playwright. Usage: node tools/rocket-norace-test.mjs
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const args = ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const open = async (car) => {
  const b = await chromium.launch({ args });
  const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
  p.on('pageerror', (e) => console.log('PAGEERR', car, e.message));
  await p.goto('http://localhost:8787/?q=low&trees=old&hidden=1');
  await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
  await p.evaluate((c) => { __game.setCar(c, true); __game.startDriving(); }, car);
  await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 120000 });
  // (software rendering manages a frame or two a second: draw nothing)
  await p.evaluate(() => { const r = __game.renderer; r.render = () => {}; });
  return [b, p];
};
let bad = 0;
const check = (name, ok, note = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  (${note})` : ''}`); if (!ok) bad++; };
const ui = (p) => p.evaluate(() => ({ btn: document.querySelector('#rbtn')?.textContent || '', sub: document.querySelector('#rsub')?.textContent || '', toast: document.querySelector('#toast')?.textContent || '',
  count: !document.querySelector('#rcount').classList.contains('hidden') }));
const [ba, A] = await open('rocket');
const [bb, B] = await open('w201');
await A.waitForTimeout(4000);
check('A drives the Rocket, B a Mercedes', await A.evaluate(() => __game.car.spec.id === 'rocket') && await B.evaluate(() => __game.car.spec.id === 'w201'));
let a = await ui(A), b = await ui(B);
check('the vote counts one driver, not two', /0 \/ 1\b/.test(b.sub), `B: "${b.btn}" "${b.sub}"`);
check("A's button says its car does not race", /NO RACING/.test(a.btn) && /DOES NOT RACE/.test(a.sub), `A: "${a.btn}" "${a.sub}"`);
// A presses the button, and sends a vote and a join past the page
await A.click('#rbtn'); await A.waitForTimeout(600);
a = await ui(A);
check('...and pressing it only says why', /DOES NOT RACE/.test(a.toast), `"${a.toast}"`);
await A.evaluate(() => __game.mp().raceSend({ t: 'rv', on: 1 })); await A.waitForTimeout(1500);
b = await ui(B);
check("a vote sent past the page is not taken", /0 \/ 1\b/.test(b.sub), `B: "${b.sub}"`);
// B starts a race alone: the countdown
await B.click('#rbtn'); await B.waitForTimeout(2500);
b = await ui(B);
check('B starts a race', /YOU'RE IN|ON THE GRID|ON GRID/.test(b.btn), `B: "${b.btn}" "${b.sub}"`);
await A.evaluate(() => __game.mp().raceSend({ t: 'rj', on: 1 })); await A.waitForTimeout(2000);
a = await ui(A); b = await ui(B);
const racers = (p) => p.evaluate(() => (__game.raceMode().view()?.on ? __game.raceMode().view().racers : []).map((x) => x.car));
check('a join sent past the page is not taken: one racer', (await racers(B))?.length === 1, `${JSON.stringify(await racers(B))} A: "${a.btn}" "${a.sub}"`);
check("A's button still says no racing, with no countdown card", /NO RACING/.test(a.btn) && !a.count, `"${a.btn}" "${a.sub}"`);
// B takes the Rocket before the lights: off the list
await B.evaluate(() => __game.setCar('rocket', true)); await B.waitForTimeout(3000);
check('a racer who takes the Rocket before the lights is off the list', ((await racers(A)) || []).length === 0, JSON.stringify(await racers(A)));
await ba.close(); await bb.close();
console.log(bad ? `${bad} FAILED` : 'all passed');
process.exit(bad ? 1 : 0);
