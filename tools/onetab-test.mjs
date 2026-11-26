// One game tab online at a time (src/onetab.js, Martin 26 Nov 2026). Two tabs of one browser (one Playwright context)
// against the real server, with a bare connection C as another player who races and is watched:
//  1. A drives and races C. B opens: it asks YOU'RE PLAYING IN ANOTHER TAB, loads nothing and does not connect.
//  2. CONTINUE HERE in B: A goes to the garage, offline, its screen covered, and is out of the race (QUIT: the race
//     goes on for C and ends the moment C quits, not held for A), and B loads and comes online.
//  3. B watches C; CONTINUE HERE in A: B stops watching (C is told nobody watches), goes aside, and A is back online.
//  4. A reloads with B aside behind another window: A plays at once, B stays aside.
//  5. A is closed: B, in front, takes the game up by itself.
//   npm run build, npx wrangler dev --port 8787, then node tools/onetab-test.mjs [picture dir]   (about 4 minutes)
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const dir = process.argv[2] || '';
const base = process.env.BASE || 'http://localhost:8787';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (cond, what) => { console.log(cond ? 'PASS' : 'FAIL', what); if (!cond) process.exitCode = 1; };
const until = async (fn, ms = 20000) => { for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(200)) { if (await fn()) return true; } return !!(await fn()); };

// ---- C: a bare connection, a driver on the map who sends positions
const C = { id: null, msgs: [], race: null, wn: 0, ws: null };
await new Promise((res, rej) => {
  const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/api/ws?w=barec0001&i=1&r=1`);
  C.ws = ws;
  ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', b: 1, name: 'CEE', car: 'w201', w: 'map' })); ws.send(JSON.stringify({ t: 'drv', on: 1 })); };
  ws.onmessage = (e) => {
    if (e.data === 'pong') return;
    const m = JSON.parse(e.data);
    C.msgs.push(m);
    if (m.t === 'welcome') { C.id = m.id; res(); }
    if (m.t === 'race') C.race = m.r ?? m;
    if (m.t === 'wn' && m.id === C.id) C.wn = m.n;
  };
  ws.onerror = rej;
});
let cx = 0;
const pose = setInterval(() => {
  cx += 1;
  const p = [-200 + cx * 0.5, 100, 40, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0.3, 0, 2200, 0, 0, 0, 0, 0, 0, Date.now() % 60000];
  if (C.ws.readyState === 1) C.ws.send(JSON.stringify({ t: 's', p }));
}, 100);
const ping = setInterval(() => { if (C.ws.readyState === 1) C.ws.send('ping'); }, 20000);
const cSaw = (t, id) => C.msgs.some((m) => m.t === t && m.id === id);
console.log('C is', C.id);

const args = ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const b = await chromium.launch({ args });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { localStorage.setItem('kvissuroam.name', 'TABBY'); });
const errors = [];
const open = async (tag) => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { errors.push(`${tag}: ${e.message}`); console.log('PAGEERR', tag, e.message); });
  await p.goto(`${base}/?q=low&trees=old`);
  return p;
};
const loaded = (p) => p.waitForFunction(() => window.__game?.car && __game.mode === 'menu', null, { timeout: 240000 });
const drive = async (p) => {
  await p.evaluate(() => __game.startDriving());
  await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 120000 });
  await p.evaluate(() => { const r = __game.renderer; r.realRender = r.render; r.render = () => {}; });
};
const shot = async (p, f) => {
  if (!dir) return;
  await p.evaluate(() => { const r = window.__game?.renderer; if (r?.realRender) r.render = r.realRender; });
  await sleep(1500);
  await p.screenshot({ path: `${dir}/${f}` });
  await p.evaluate(() => { const r = window.__game?.renderer; if (r?.realRender) r.render = () => {}; });
};
const st = (p) => p.evaluate(() => ({
  aside: !document.querySelector('#othertab').classList.contains('hidden'),
  loaded: !!window.__game?.car, mode: window.__game?.mode, online: !!window.__game?.mp?.()?.online, id: window.__game?.mp?.()?.id,
  watching: window.__game?.watch?.()?.id || null, lap: !!window.__game?.race?.()?.running,
}));

// ---- 1. A drives and races C
const A = await open('A');
await loaded(A);
await drive(A);
ok(await until(async () => (await st(A)).online), 'A is online');
const aId = (await st(A)).id;
ok(await until(() => cSaw('join', aId) || C.msgs.some((m) => m.t === 'welcome' && m.players?.some((q) => q.id === aId)), 5000), 'C sees A');
C.ws.send(JSON.stringify({ t: 'rv', on: 1 }));
await A.evaluate(() => __game.mp().raceSend({ t: 'rv', on: 1 }));
ok(await until(() => C.race?.on && C.race.racers?.some((r) => r.id === aId), 10000), 'a race is on with A in it');
// (past the lights: a racer who goes now is LEFT, not just taken off the grid)
await until(() => C.race?.tGreen && Date.now() > C.race.tGreen + 2000, 30000);

const B = await open('B');
ok(await until(async () => (await st(B)).aside, 15000), 'B, opened while A plays, asks first');
await sleep(4000);
let sb = await st(B), sa = await st(A);
ok(!sb.loaded && !sb.online, `B loads nothing and does not go online meanwhile (${JSON.stringify(sb)})`);
ok(sa.online && sa.mode === 'drive' && !sa.aside, `A plays on meanwhile (${JSON.stringify(sa)})`);
ok(!C.msgs.some((m) => m.t === 'join' && m.id !== aId && m.name === 'TABBY'), 'nobody else joined');
await shot(B, 'onetab-ask.png');

// ---- 2. CONTINUE HERE in B
await B.click('#tabhere');
ok(await until(async () => { const s = await st(A); return s.aside && !s.online && s.mode === 'menu'; }, 8000), 'A: to the garage, offline, covered');
ok(await until(() => cSaw('leave', aId), 8000), 'the others hear A left');
ok(await until(() => C.race?.racers?.find((r) => r.id === aId)?.out === 'quit', 8000), `A is out of the race (${JSON.stringify(C.race?.racers?.find((r) => r.id === aId))})`);
await loaded(B);
ok(await until(async () => (await st(B)).online, 15000), 'B loads and comes online');
const bId = (await st(B)).id;
ok(bId && bId !== aId && (await until(() => cSaw('join', bId), 5000)), 'the others see B join');
// the race is not held open by A: C quits and it ends
C.ws.send(JSON.stringify({ t: 'rj', on: 0 }));
ok(await until(() => C.race && !C.race.on, 10000), `the race ends when C, the last one in, quits (${JSON.stringify({ on: C.race?.on, racers: C.race?.racers?.map((r) => [r.id, r.out]) })})`);
await shot(A, 'onetab-aside.png');
// (keys do nothing in a tab that is aside: Esc would drive off from the garage)
await A.keyboard.press('Escape');
await sleep(500);
ok((await st(A)).mode === 'menu', 'Esc in the tab aside does not drive');

// ---- 3. B watches C, then CONTINUE HERE in A
await drive(B);
await B.evaluate((id) => __game.watch().start(id), C.id);
ok(await until(async () => (await st(B)).watching === C.id && C.wn === 1, 10000), `B watches C (C told ${C.wn})`);
await A.click('#tabhere');
ok(await until(async () => { const s = await st(B); return s.aside && !s.online && s.mode === 'menu' && !s.watching; }, 8000), 'B: stops watching, to the garage, offline');
ok(await until(() => C.wn === 0, 8000), 'C is told nobody watches now');
ok(await until(async () => { const s = await st(A); return !s.aside && s.online && s.mode === 'menu'; }, 15000), 'A is back online, in the garage');
ok((await st(A)).id === aId, 'with its own id');

// ---- 4. A reloads, B aside behind another window
await B.evaluate(() => { document.hasFocus = () => false; });
await A.reload();
ok(await until(async () => (await st(A)).loaded, 240000), 'A loads again');
sa = await st(A); sb = await st(B);
ok(!sa.aside && sb.aside, `after a reload A plays at once, B stays aside (A ${JSON.stringify(sa)}, B ${JSON.stringify(sb)})`);
ok(await until(async () => (await st(A)).online, 15000), 'A online again after the reload');

// ---- 5. A closed: B in front takes the game up
await B.evaluate(() => { delete document.hasFocus; });
await A.close();
ok(await until(async () => { const s = await st(B); return !s.aside && s.online; }, 10000), 'with A closed, B in front comes back by itself');
await B.evaluate(() => __game.startDriving());
ok(await until(async () => (await st(B)).mode === 'drive', 60000), 'and drives');

ok(errors.length === 0, `no page errors (${errors.join(' | ')})`);
clearInterval(pose); clearInterval(ping);
C.ws.close();
await b.close();
