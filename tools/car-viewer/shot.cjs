// Screenshots of the car viewer. Needs a Vite dev server (NO_HMR=1 npx vite --port $PORT).
// usage: PORT=5173 node tools/car-viewer/shot.cjs outdir car1,car2 view1,view2 [width height "&brake=1"]
const { chromium } = require('playwright');
(async () => {
  const [out, cars, views, w = 1000, h = 620, extra = ''] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  for (const c of cars.split(',')) for (const v of views.split(',')) {
    await p.goto(`http://localhost:${process.env.PORT || 5173}/tools/car-viewer/index.html?car=${c}&view=${v}&hud=0${extra}`);
    await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
    await p.waitForTimeout(+process.env.WAIT || 300);
    await p.screenshot({ path: `${out}/${c}-${v}.png`, timeout: 60000 });
    if (v === views.split(',')[0]) console.log(c, JSON.stringify(await p.evaluate(() => window.__stats)));
  }
  await b.close();
})();
