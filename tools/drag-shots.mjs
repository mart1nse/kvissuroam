// Pictures of the drag strip (?drag=1) for a look: the car on the line with the question, the tree running, and the
// strip from beside and from behind the arch.
// Needs the game served with its server: npm run build && npx wrangler dev --port 8787 --persist-to <empty dir>
//   node tools/drag-shots.mjs <out dir> [url]
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || 'drag-shots';
const base = process.argv[3] || 'http://localhost:8787/?drag=1&trees=old';
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 })).newPage();
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto(base);
await p.waitForFunction(() => window.__game?.drag?.(), null, { timeout: 300000 });
await p.evaluate(() => __game.startDriving());
await p.waitForFunction(() => __game.mode === 'drive', null, { timeout: 180000 });
await p.evaluate(() => document.querySelector('[data-act="track-drag"]').click());
await p.waitForFunction(() => __game.drag().phase === 'line' && __game.drag().strip.built && !document.querySelector('#getready.show'), null, { timeout: 300000, polling: 500 });
await p.waitForTimeout(8000);
const shot = async (name) => { await p.screenshot({ path: `${out}/${name}.png`, timeout: 180000 }); console.log(name); };
await shot('1-on-the-line');
// the strip seen from a camera of our own (the HUD hidden): beside the start, and from behind the arch down the strip
const look = (cam) => p.evaluate((c) => {
  const D = __game.drag().strip.frame, w = __game.world;
  const [px, pz] = D.at(c.d, c.w), [lx, lz] = D.at(c.ld, c.lw);
  window.__cam = [px, w.heightAt(px, pz) + c.up, pz, lx, w.heightAt(lx, lz) + c.lup, lz, c.fov];
  document.querySelector('#hud').style.visibility = 'hidden';
}, cam);
await look({ d: -32, w: 26, up: 7, ld: 25, lw: -2, lup: 1, fov: 50 });
await p.waitForTimeout(6000);
await shot('2-start-from-beside');
await look({ d: -40, w: -3, up: 9, ld: 160, lw: 0, lup: 0, fov: 45 });
await p.waitForTimeout(6000);
await shot('3-down-the-strip');
await look({ d: 14, w: -14, up: 2.2, ld: -2, lw: 3, lup: 2, fov: 45 });
await p.waitForTimeout(6000);
await shot('4-the-tree-and-the-arch');
// the tree running (the HUD back, our camera off): a shot once an amber is lit
await p.evaluate(() => { window.__cam = null; document.querySelector('#hud').style.visibility = ''; });
await p.waitForTimeout(3000);
await p.keyboard.down('ArrowUp');
await p.keyboard.press('p');
await p.waitForFunction(() => __game.drag().phase === 'tree', null, { timeout: 30000 });
// (a frame here takes a while: the picture is taken a little before the first amber and shows the tree as it runs)
await p.waitForTimeout(Math.max(0, await p.evaluate(() => __game.drag().go - performance.now()) - 2500));
await shot('5-the-tree-running');
await p.keyboard.up('ArrowUp');
await b.close();
