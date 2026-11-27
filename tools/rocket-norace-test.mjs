// A car with thrusters does not race (Martin 26 Nov: "do not allow the tesla to take part in races"), but whoever
// drives one may vote and join (Martin 27 Nov, "vote, then swap car"): they race in the last car they drove before
// it, swapped into on the grid. Two browsers in the same lobby, A in the Rocket (an Impreza before it) and B in an
// ordinary car: A counts in the vote's pool, its button says which car it races in, its vote goes in, the race
// lists it in the Impreza and its page swaps into the Impreza on the grid. A vote or join sent from the Rocket
// without a car to race in (a changed or old page) is not taken, and a racer who takes the Rocket before the
// lights without one is off the list again.
// Needs the game served with its server on :8787:
//   npm run build && npx wrangler dev --port 8787
// and Playwright. Usage: node tools/rocket-norace-test.mjs
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const args = ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const open = async (cars) => {
  const b = await chromium.launch({ args });
  const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
  p.on('pageerror', (e) => console.log('PAGEERR', cars, e.message));
  await p.goto('http://localhost:8787/?q=low&trees=old&hidden=1');
  await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
  await p.evaluate((c) => { for (const id of c) __game.setCar(id, true); __game.startDriving(); }, cars);
  await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 120000 });
  // (software rendering manages a frame or two a second: draw nothing)
  await p.evaluate(() => { const r = __game.renderer; r.render = () => {}; });
  return [b, p];
};
let bad = 0;
const check = (name, ok, note = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  (${note})` : ''}`); if (!ok) bad++; };
const ui = (p) => p.evaluate(() => ({ btn: document.querySelector('#rbtn')?.textContent || '', sub: document.querySelector('#rsub')?.textContent || '', toast: document.querySelector('#toast')?.textContent || '',
  count: !document.querySelector('#rcount').classList.contains('hidden') }));
const view = (p) => p.evaluate(() => __game.raceMode().view());
const racers = async (p) => { const v = await view(p); return v?.on ? v.racers.map((x) => x.car) : []; };
const [ba, A] = await open(['impreza', 'rocket']);
const [bb, B] = await open(['w201']);
await A.waitForTimeout(4000);
check('A drives the Rocket (an Impreza before), B a Mercedes', await A.evaluate(() => __game.car.spec.id === 'rocket') && await B.evaluate(() => __game.car.spec.id === 'w201'));
let a = await ui(A), v = await view(B);
check('the vote counts both drivers', v?.vote?.of === 2, `of ${v?.vote?.of}`);
check("A's button is the race button, and says A races in the Impreza", !/NO RACING/.test(a.btn) && /IN THE 22B/i.test(a.sub), `A: "${a.btn}" "${a.sub}"`);
// a vote from the Rocket sent past the page, without a car to race in: not taken
await A.evaluate(() => __game.mp().raceSend({ t: 'rv', on: 1 })); await A.waitForTimeout(1500);
v = await view(B);
check('a vote from the Rocket without a car to race in is not taken', !v.vote.ids.length, JSON.stringify(v.vote.ids));
// A presses the button: its vote goes in
await A.click('#rbtn'); await A.waitForTimeout(1500);
a = await ui(A); v = await view(B);
check("A's vote goes in, and A is told the car", v.vote.ids.length === 1 && /RACE IN THE 22B/i.test(a.toast), `${v.vote.ids.length} votes, "${a.toast}"`);
// B votes too: the race is on, A on the list in the Impreza
await B.click('#rbtn'); await B.waitForTimeout(2000);
const list = await racers(B);
check('the race lists A in the Impreza, B in the Mercedes', list.length === 2 && list.includes('impreza') && list.includes('w201'), JSON.stringify(list));
// B takes the Rocket before the lights (a car change names no car to race in): off the list
await B.evaluate(() => __game.setCar('rocket', true)); await B.waitForTimeout(1500);
check('a racer who takes the Rocket before the lights is off the list', JSON.stringify(await racers(A)) === '["impreza"]', JSON.stringify(await racers(A)));
// a third page in the Rocket joins past its page without a car: not taken
const [bc, C] = await open(['rocket']);
await C.evaluate(() => __game.mp().raceSend({ t: 'rj', on: 1 })); await C.waitForTimeout(1500);
check('a join from the Rocket without a car to race in is not taken', (await racers(A)).length === 1, JSON.stringify(await racers(A)));
await bc.close();
// on the grid A's page swaps into the Impreza
await A.waitForFunction(() => __game.car.spec.id === 'impreza', null, { timeout: 20000 }).catch(() => {});
a = await ui(A);
check("on the grid A's page is in the Impreza", await A.evaluate(() => __game.car.spec.id === 'impreza'), `"${a.toast}"`);
await ba.close(); await bb.close();
console.log(bad ? `${bad} FAILED` : 'all passed');
process.exit(bad ? 1 : 0);
