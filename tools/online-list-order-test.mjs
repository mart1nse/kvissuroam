// The online list's order (Martin 27 Nov: "move the players in the garage to the top of the list so if it is cut
// they are in the cut part"): the drivers A to Z, those in the garage or watching (greyed) A to Z at the far end
// from your line, the end that is cut off. Desktop: greyed at the top, the list resting at its bottom end next to
// YOU, "+N MORE" over the names counting those above; the wheel scrolls up to them. Phones: greyed at the bottom,
// before "+N MORE".
// Needs the dev server: npx vite --port 5198, then node tools/online-list-order-test.mjs [port=5198] [out=dir] [drivers=30]
// No game server: the page's WebSocket is a fake lobby with made-up drivers, some in the garage and one watching.
import { createRequire } from 'module';
import fs from 'fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`${k}=`)); return a ? a.slice(k.length + 1) : d; };
const port = arg('port', '5198'), out = arg('out', ''), ND = +arg('drivers', 30);
if (out) fs.mkdirSync(out, { recursive: true });
let bad = 0;
const check = (n, ok, note = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${note ? `  (${note})` : ''}`); if (!ok) bad++; };

const DRIVE = ['ItaaliaMakaron', 'LaserLagoon', 'Lelzzu', 'Luua Riho', 'marokas', 'MintSwan', 'miXXer', 'möku', 'NovaGalaxy', 'OpalArcade', 'OpalMoose', 'OpalTiger', 'PastelGecko', 'PeachJaguar', 'PrismBeaver', 'RetroCherry', 'SILVOVOZNE', 'tarmo', 'TurboGhost', 'VaporFountain', 'VirtualPanther', 'aivar', 'Andres', 'BlueOtter', 'Car2', 'Car10', 'DuskRunner', 'EchoFox', 'Frank', 'haige', 'Kamz', 'zeta', 'Uku', 'Wolt'].slice(0, ND);
const GREY = [['CrystalKoi', 'garage'], ['Garage 69', 'garage'], ['TealFalcon', 'garage'], ['AquaMoth', 'garage'], ['Zorro', 'watch']];
const CARS = ['impreza', 'f40', 'm3', 'cgt', 'audi200', 'enyaq', 'passat', 'rav4', 'bz4x'];
const players = [...DRIVE.map((name, k) => ({ id: `d${k}`, name, car: CARS[k % CARS.length], w: 'map' })), ...GREY.map(([name, w], k) => ({ id: `g${k}`, name, car: CARS[k % CARS.length], w }))];
const ABC = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
const az = (list) => [...list].sort((a, b) => ABC.compare(a, b));
const wantDrive = az(DRIVE), wantGrey = az(GREY.map(([n]) => n));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function open(ctx) {
  const p = await (await browser.newContext(ctx)).newPage();
  p.on('pageerror', (e) => check(`no page error: ${e.message}`, false));
  await p.addInitScript((players) => {
    try { localStorage.setItem('kvissuroam.name', 'ElvaJonn'); } catch {}
    class FakeWS {
      constructor() {
        this.readyState = 0;
        setTimeout(() => {
          this.readyState = 1; this.onopen?.();
          this.onmessage?.({ data: JSON.stringify({ t: 'welcome', id: 'me', players }) });
          let tick = 0;
          this.timer = setInterval(() => {
            tick++;
            players.forEach((pl, k) => {
              if (pl.w !== 'map') return;
              const pose = [-200 + k * 12 + tick * 0.2, 100 + (k % 5) * 9, 40, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0.6, 0, 3000, 0, 0, 0, 0, 0, 0];
              this.onmessage?.({ data: JSON.stringify({ t: 's', id: pl.id, p: pose }) });
            });
          }, 150);
        }, 300);
      }
      send() {}
      close() { clearInterval(this.timer); this.readyState = 3; }
    }
    window.WebSocket = FakeWS;
  }, players);
  await p.goto(`http://localhost:${port}/?q=low&trees=old&lite=1`, { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
  await p.evaluate(() => __game.startDriving());
  await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 180000 });
  // (drawing without a graphics card takes seconds a frame and holds the page back: drawn again only for the pictures)
  await p.evaluate(() => { window.__draw = __game.renderer.render; __game.renderer.render = () => {}; });
  await p.waitForTimeout(3000);
  return p;
}
// the rows as they stand on the screen, top down, and which of them are in view
const rows = (p) => p.evaluate((names) => {
  const ul = document.querySelector('#people .who:not(.st)'), r = ul.getBoundingClientRect();
  const me = document.querySelector('#people .me').getBoundingClientRect(), up = document.querySelector('#people .up');
  const ur = up.getBoundingClientRect();
  const list = [...ul.children].map((li) => { const b = li.getBoundingClientRect(); return { name: names[li.dataset.id] || li.textContent, grey: li.classList.contains('gar'), more: li.classList.contains('more'), top: b.top, inView: b.top >= r.top - 1 && b.bottom <= r.bottom + 1 }; }).sort((a, b) => a.top - b.top);
  return { list, listTop: r.top, listBottom: r.bottom, meTop: me.top, meBottom: me.bottom, up: up.classList.contains('hidden') ? '' : up.textContent, upBottom: ur.bottom, scrollTop: ul.scrollTop };
}, Object.fromEntries(players.map((pl) => [pl.id, pl.name])));
const shot = async (p, name) => {
  if (!out) return;
  await p.evaluate(() => { __game.renderer.render = window.__draw; });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/${name}.png` });
  await p.evaluate(() => { __game.renderer.render = () => {}; });
};

// ---- desktop
for (const [w, h] of [[1280, 720], [1440, 900]]) {
  const p = await open({ viewport: { width: w, height: h }, deviceScaleFactor: out ? 2 : 1 });
  const s = await rows(p);
  const order = s.list.map((r) => r.name);
  check(`desktop ${w}x${h}: greyed A to Z on top, then the drivers A to Z`, JSON.stringify(order) === JSON.stringify([...wantGrey, ...wantDrive]), order.join(', '));
  const seen = s.list.filter((r) => r.inView);
  const cut = seen.length < s.list.length;
  check(`desktop ${w}x${h}: not all fit (the test needs a cut list)`, cut, `${seen.length} of ${s.list.length} in view`);
  check(`desktop ${w}x${h}: at rest the list ends with the last driver just over YOU`, seen.at(-1)?.name === wantDrive.at(-1) && s.listBottom <= s.meTop + 1 && s.meTop - s.listBottom < 8, `${seen.at(-1)?.name}, gap ${(s.meTop - s.listBottom).toFixed(1)}px`);
  check(`desktop ${w}x${h}: at rest no greyed name in view`, !seen.some((r) => r.grey), seen.filter((r) => r.grey).map((r) => r.name).join(', '));
  check(`desktop ${w}x${h}: "+N MORE" over the names counts those above`, s.up === `+${s.list.length - seen.length} MORE` && s.upBottom <= s.listTop + 1, `${s.up}, ${s.list.length - seen.length} above`);
  await shot(p, `desktop-${w}x${h}-rest`);
  // the wheel up to the top: the greyed ones come into view, "+N MORE" goes
  const box = await p.evaluate(() => { const b = document.querySelector('#people .who:not(.st)').getBoundingClientRect(); return { x: b.left + 30, y: b.top + b.height / 2 }; });
  await p.mouse.move(box.x, box.y);
  for (let k = 0; k < 8; k++) { await p.mouse.wheel(0, -300); await p.waitForTimeout(80); }
  await p.waitForTimeout(800);
  const t = await rows(p);
  const seenT = t.list.filter((r) => r.inView);
  check(`desktop ${w}x${h}: wheel up to the top shows the greyed ones first`, seenT[0]?.name === wantGrey[0] && wantGrey.every((n) => seenT.some((r) => r.name === n)), seenT.slice(0, 6).map((r) => r.name).join(', '));
  check(`desktop ${w}x${h}: at the top "+N MORE" is gone`, t.up === '', t.up);
  await shot(p, `desktop-${w}x${h}-scrolled-up`);
  await p.context().close();
}

// ---- phones (landscape)
for (const [w, h] of [[844, 390], [800, 304]]) {
  const p = await open({ ...devices['Pixel 7'], viewport: { width: w, height: h }, deviceScaleFactor: out ? 2 : undefined });
  const s = await rows(p);
  const names = s.list.filter((r) => !r.more).map((r) => r.name), more = s.list.find((r) => r.more);
  const full = [...wantDrive, ...wantGrey];
  check(`phone ${w}x${h}: the drivers A to Z down from YOU, greyed after them`, JSON.stringify(names) === JSON.stringify(full.slice(0, names.length)), names.join(', '));
  check(`phone ${w}x${h}: cut at the bottom, "+N MORE" counts the rest`, !!more && more.name === `+${full.length - names.length} MORE` && s.list.at(-1).more, more?.name);
  check(`phone ${w}x${h}: no greyed name shown while drivers are cut`, !s.list.some((r) => r.grey));
  await shot(p, `phone-${w}x${h}`);
  await p.context().close();
}

// ---- a short list that fits: everybody in view, the greyed ones on top on desktop, no "+N MORE"
{
  const p = await open({ viewport: { width: 1440, height: 900 } });
  await p.evaluate(() => { const mp = __game.mp(); const d = mp.drivers, r = mp.roster; mp.drivers = () => d().slice(0, 4); mp.roster = () => r().filter((q) => q.w !== 'map').concat(d().slice(0, 4)); });
  await p.waitForTimeout(1500);
  const s = await rows(p);
  check('desktop, few online: all in view, greyed on top', s.list.every((r) => r.inView) && s.list.slice(0, wantGrey.length).every((r) => r.grey) && s.up === '', `${s.list.map((r) => r.name).join(', ')} | ${s.up}`);
  await p.context().close();
}
await browser.close();
console.log(bad ? `${bad} FAILED` : 'all ok');
process.exit(bad ? 1 : 0);
