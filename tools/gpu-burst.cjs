// What is sent to the graphics card frame by frame during a drive: pictures, shaders, model buffers.
//   node tools/gpu-burst.cjs [route=short] [step=5] [touch] [port=5198] [max=420] [q=?warm=0]
//
// Needs the dev server. Unlike tools/freeze-profile.cjs this draws for real, which without a graphics card
// is about one frame a second, so the times mean nothing: read the counts. A frame that sends many
// megapixels of pictures, megabytes of buffers or new shaders is a pause on a phone (20 Nov: a car park's
// parked cars were 21 pictures, 5 shaders and 18 MB in one frame). max: seconds before it stops.
const { chromium, devices } = require('playwright');
const ROUTES = require('./freeze-routes.cjs');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(k + '=')); return a ? a.slice(k.length + 1) : d; };
const ROUTE = ROUTES[arg('route', 'short')];
(async () => {
  const step = +arg('step', 5), touch = process.argv.includes('touch'), port = arg('port', 5198);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext(touch ? { ...devices['Pixel 7'], viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 } : { viewport: { width: 320, height: 180 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
  await p.addInitScript(() => { localStorage.setItem('kvissuroam.car', 'm3'); });
  await p.addInitScript(require('./freeze-fly.cjs'));
  await p.addInitScript(() => {
    const cur = (window.__cur = { tex: 0, px: 0, link: 0, comp: 0, buf: 0, ms: 0, prog: 0, what: [], names: [] });
    const P = WebGL2RenderingContext.prototype;
    const wrap = (name, fn) => { const o = P[name]; P[name] = function (...a) { const t0 = performance.now(); const r = o.apply(this, a); const dt = performance.now() - t0; cur.ms += dt; fn(a, dt); return r; }; };
    const size = (a, k) => { const s = a[a.length - 1]; if (a.length >= 9 && typeof a[k] === 'number' && typeof a[k + 1] === 'number') return a[k] * a[k + 1]; return s && s.width ? (s.videoWidth || s.width) * (s.videoHeight || s.height) : 0; };
    wrap('texImage2D', (a) => { cur.tex++; const n = a.length >= 9 ? a[3] * a[4] : size(a, 0); cur.px += n; if (n > 60000) cur.what.push('i' + Math.round(Math.sqrt(n))); });
    wrap('texSubImage2D', (a) => { cur.tex++; const n = a.length >= 9 ? a[4] * a[5] : size(a, 0); cur.px += n; if (n > 60000 && a[1] === 0) cur.what.push('s' + Math.round(Math.sqrt(n))); });
    wrap('generateMipmap', () => { cur.mip = (cur.mip || 0) + 1; });
    wrap('linkProgram', function (a) { cur.link++; try { const g = this; const sh = WebGL2RenderingContext.prototype.getAttachedShaders.call(document.querySelector('#view').getContext('webgl2'), a[0]) || []; for (const x of sh) { const src = document.querySelector('#view').getContext('webgl2').getShaderSource(x) || ''; const m = src.match(/#define SHADER_NAME (\S+)/); if (m && src.includes('gl_FragColor') || (m && src.includes('pc_fragColor'))) { cur.names.push(m[1]); break; } } } catch (e) {} });
    for (const n of ['getProgramParameter', 'getUniformLocation', 'getActiveUniform', 'getActiveAttrib', 'getAttribLocation', 'getProgramInfoLog', 'getShaderParameter', 'useProgram']) wrap(n, (a, dt) => { if (!(n === 'getProgramParameter' && a[1] === 0x91B1)) cur.prog += dt; });
    wrap('compileShader', () => { cur.comp++; });
    wrap('bufferData', (a) => { cur.buf += (a[1] && a[1].byteLength) || 0; });
    const raf = window.requestAnimationFrame.bind(window);
    window.__fr = [];
    window.requestAnimationFrame = (f) => raf((ts) => { const t0 = performance.now(); f(ts); if (window.__rec && f.name === 'frame' && (cur.tex || cur.link || cur.buf > 200000)) __fr.push([Math.round(t0), __game.car?.x | 0, __game.car?.z | 0, cur.tex, Math.round(cur.px / 1e4) / 100, cur.link, cur.comp, Math.round(cur.buf / 1e4) / 100, Math.round(cur.ms), cur.what.join(' '), cur.mip || 0, Math.round(cur.prog), cur.names.join(' ')]); cur.tex = cur.px = cur.link = cur.comp = cur.buf = cur.ms = cur.prog = 0; cur.mip = 0; cur.what = []; cur.names = []; window.__frames = (window.__frames || 0) + 1; });
  });
  await p.goto(`http://localhost:${port}/${arg('q', '')}`, { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.car && __game.world?.ready(__game.car.x, __game.car.z), null, { timeout: 180000 });
  console.log('parallel shader compile: ' + await p.evaluate(() => !!__game.renderer.getContext().getExtension('KHR_parallel_shader_compile')));
  await p.waitForTimeout(2000);
  await p.evaluate(async (r) => { __game.startDriving(); await __game.world.loadAround(r[0][0], r[0][1], 260); __game.place({ x: r[0][0], z: r[0][1], yaw: 0 }); }, ROUTE);
  await p.waitForTimeout(touch ? 16000 : 8000);
  await p.evaluate(({ r, step }) => { window.__rec = true; window.__frames = 0; __fly(r, step); }, { r: ROUTE, step });
  const tEnd = Date.now() + +arg('max', 420) * 1000;
  for (;;) {
    await p.waitForTimeout(20000);
    const st = await p.evaluate(() => [__flyStat.done, Math.round(__flyStat.dist), __frames]);
    process.stderr.write(`  ${st[1]} m\r`);
    if (st[0] || Date.now() > tEnd) break;
  }
  const { fr, stat, frames } = await p.evaluate(() => ({ fr: __fr, stat: __flyStat, frames: __frames }));
  await b.close();
  console.log(`${touch ? 'phone' : 'desktop'} drove ${(stat.dist / 1000).toFixed(2)} km in ${frames} frames, errors ${errs.length} ${errs.slice(0, 3)}`);
  const big = fr.filter((f) => f[4] > 1.2 || f[5] > 0).sort((a, c) => c[4] + c[5] * 3 - a[4] - a[5] * 3);
  console.log(`frames that sent something: ${fr.length}; over 1.2 megapixels of pictures or a new shader: ${big.length}; over 4 MP: ${fr.filter((f) => f[4] > 4).length}; over 8 MP: ${fr.filter((f) => f[4] > 8).length}; with new shaders: ${fr.filter((f) => f[5] > 0).length} (${fr.reduce((a, f) => a + f[5], 0)} programs)`);
  console.log('total megapixels sent: ' + fr.reduce((a, f) => a + f[4], 0).toFixed(0));
  console.log(`ms waiting on shaders in all frames: ${fr.reduce((a, f) => a + f[11], 0)}, worst frame ${Math.max(...fr.map((f) => f[11]))}; worst frame megapixels ${Math.max(...fr.slice(1).map((f) => f[4]))}, buffers ${Math.max(...fr.slice(1).map((f) => f[7]))} MB (first frame left out)`);
  console.log('the heaviest frames [x, z, pictures, megapixels, shaders, buffers MB, ms here, sizes]:');
  for (const f of big.slice(0, 30)) console.log(`  (${f[1]}, ${f[2]})  ${f[3]} pictures ${f[4]} MP, ${f[5]} shaders, ${f[7]} MB buffers, ${f[8]} ms, shader wait ${f[11]} ms ${f[12]}  ${f[9]}`);
})();
