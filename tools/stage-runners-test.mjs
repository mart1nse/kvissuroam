// Players on a Majoraadi run, far from our car (Martin 26 Nov: "the majoraadi online players list keeps disappearing
// and coming back"). The server sends a car more than 2 km from ours once a second (POSE_VFAR_MS in worker/index.js),
// so the MAJORAADI pill's count and the list under it must hold steady through the gaps between its places, and a
// run that ends must leave them within a few seconds.
// Needs the dev server: npx vite --port 5198, then node tools/stage-runners-test.mjs [port=5198]
// No game server: the page's WebSocket is a fake lobby with six made-up drivers, three of them on a stage run.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const port = (process.argv.find((a) => a.startsWith('port=')) || 'port=5198').slice(5);
let bad = 0;
const check = (n, ok, note = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${note ? `  (${note})` : ''}`); if (!ok) bad++; };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => check(`no page error: ${e.message}`, false));
await p.addInitScript(() => {
  const players = ['Andris', 'Armin', 'HoloMall', 'hez', 'Frank', 'aLeX'].map((name, k) => ({ id: `bot${k}`, name, car: 'w201', w: 'map' }));
  window.__done = new Set();                    // bots whose run has ended (their lap timer flag off)
  class FakeWS {
    constructor() {
      this.readyState = 0;
      setTimeout(() => {
        this.readyState = 1; this.onopen?.();
        this.onmessage?.({ data: JSON.stringify({ t: 'welcome', id: 'me', players }) });
        let tick = 0;
        this.timer = setInterval(() => {
          tick++;
          for (let k = 0; k < 6; k++) {
            const stage = k < 3, run = stage && !window.__done.has(`bot${k}`);
            if (stage && tick % 10 !== k * 3) continue;          // far away on the stage: once a second, out of step
            const x = stage ? 2600 + k * 30 + tick * 0.3 : -200 + k * 10, z = stage ? 450 : 100;
            const pose = [x, z, 40, 0, 0, 0, stage ? 3 : 0, 0, 0, 0, 0, 0, 0.6, 0, 3000, 0, 0, 0, 0, 0, (run ? 8 : 0) | (stage ? 16 : 0)];
            this.onmessage?.({ data: JSON.stringify({ t: 's', id: `bot${k}`, p: pose }) });
          }
        }, 100);
      }, 300);
    }
    send() {}
    close() { clearInterval(this.timer); this.readyState = 3; }
  }
  window.WebSocket = FakeWS;
});
await p.goto(`http://localhost:${port}/?q=low&trees=old&lite=1`, { timeout: 180000 });
await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
await p.evaluate(() => __game.startDriving());
await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 120000 });
// (drawing without a graphics card takes seconds a frame, which holds the fake lobby's timer back: nothing is drawn)
await p.evaluate(() => { __game.renderer.render = () => {}; });
await p.waitForTimeout(3000);
const watch = (ms) => p.evaluate(async (ms) => {
  const out = {};
  for (let t = 0; t < ms; t += 100) {
    await new Promise((r) => setTimeout(r, 100));
    const pill = document.querySelector('#trackpills [data-act="track-raadi"]').textContent.trim();
    const st = document.querySelector('#people .who.st'), main = document.querySelector('#people .who:not(.st)');
    const k = `${pill} | under the pill ${st.classList.contains('hidden') ? 0 : st.children.length} | in the list ${main.classList.contains('hidden') ? 0 : main.children.length}`;
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}, ms);
const a = await watch(8000);
check('three far-away runners: the count and the list hold steady for 8 s', Object.keys(a).length === 1 && Object.keys(a)[0] === 'MAJORAADI (3) | under the pill 3 | in the list 3', JSON.stringify(a));
await p.evaluate(() => window.__done.add('bot0'));
await p.waitForTimeout(3500);
const b = await watch(3000);
check('a run that ends leaves the pill and its list within 3.5 s, back in the online list', Object.keys(b).length === 1 && Object.keys(b)[0] === 'MAJORAADI (2) | under the pill 2 | in the list 4', JSON.stringify(b));
await browser.close();
console.log(bad ? `${bad} FAILED` : 'all ok');
