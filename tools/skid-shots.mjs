// Pictures of tyre marks on different ground (src/skidmarks.js, Martin 22 Nov 2026: marks on hand-laid paving,
// grass and gravel). Lays marks with a made-up sliding car along a line, then looks at them.
//   node tools/skid-shots.mjs <out dir> <name:x,z,heading-deg,length[,mode]> ...
// mode: slide (default, the rear sliding, the front a little), roll (no slide: only a muddy tyre leaves prints),
// mud (slides over the first third, rolls after). Needs the vite dev server on :5173 and Playwright.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out, ...spots] = process.argv.slice(2);
const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const b = await chromium.launch({ args });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.type(), m.text().slice(0, 200)); });
await p.goto('http://127.0.0.1:5173/?drive&nointro');
await p.waitForFunction(() => window.__game?.world && window.__game.car && window.__game.skids, null, { timeout: 240000 });
await p.waitForTimeout(6000);
for (const spot of spots) {
  const [name, rest] = spot.split(':');
  const [x, z, hd, len, mode = 'slide'] = rest.split(',');
  const yaw = +hd * Math.PI / 180;
  // the car itself out of the way, the place loaded and built
  await p.evaluate(async ([x, z, yaw]) => {
    await __game.world.loadAround(x, z, 300);
    __game.place({ x: x - Math.sin(yaw) * 40, z: z + Math.cos(yaw) * 40, yaw });
  }, [+x, +z, yaw]);
  await p.waitForTimeout(14000);
  const looks = await p.evaluate(([x, z, yaw, len, mode]) => {
    const g = __game, sk = g.skids(), fx = Math.sin(yaw), fz = -Math.cos(yaw);
    const car = { x, z, y: g.world.heightAt(x, z), yaw, steer: 0, a: 1.3, b: 1.4, spec: { track: 1.55 }, skidF: 0, skidR: 0, rubF: 0, rubR: 0 };
    const seen = [];
    for (let d = 0; d <= len; d += 0.08) {
      const wig = Math.sin(d / 5) * 0.25;              // a slow wiggle: the tail out one way and the other
      car.yaw = yaw + wig;
      car.x = x + fx * d + Math.cos(yaw) * Math.sin(d / 5) * 1.2; car.z = z + fz * d + Math.sin(yaw) * Math.sin(d / 5) * 1.2;
      car.y = g.world.heightAt(car.x, car.z);
      const slide = mode === 'slide' || (mode === 'mud' && d < len / 3);
      car.skidR = slide ? 0.75 : 0; car.rubR = slide ? 8 : 0; car.skidF = slide ? 0.3 : 0; car.rubF = slide ? 4 : 0;
      sk.update(car);
      if (Math.abs(d % 2) < 0.08) seen.push(sk.lookAt ? sk.lookAt(car.x, car.z) : '?');
    }
    for (let k = 0; k < 4; k++) { car.skidR = car.skidF = 0; car.x += fx * 0.3; car.z += fz * 0.3; sk.update(car); }
    return seen.join('');
  }, [+x, +z, yaw, +len, mode]);
  // looking along the marks from behind and above, then down on them
  for (const [view, back, up, ahead] of [['along', 6, 1.8, 0.5], ['high', 3, 4.5, 0.35], ['close', -2, 1.6, 0.25]]) {
    await p.evaluate(([x, z, yaw, len, back, up, ahead]) => {
      const g = __game, fx = Math.sin(yaw), fz = -Math.cos(yaw);
      const ex = x - fx * back, ez = z - fz * back, tx = x + fx * len * ahead, tz = z + fz * len * ahead;
      const y0 = g.world.heightAt(ex, ez), y1 = g.world.heightAt(tx, tz);
      window.__cam = [ex, y0 + up, ez, tx, y1, tz, 55];
    }, [+x, +z, yaw, +len, back, up, ahead]);
    await p.waitForTimeout(5000);
    const file = `${out}/${name}-${view}.png`;
    await p.screenshot({ path: file, timeout: 180000 });
    console.log(file, 'looks every 2 m:', looks, '(1 tarmac, 2 setts/blocks, 3 grass, 4 gravel, 5 dirt, 0 water)');
  }
  await p.evaluate(() => { window.__cam = null; });
}
await b.close();
