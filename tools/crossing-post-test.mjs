// Drive into the white and blue striped posts at the raised crossing before Mandel (Veski tänav, on the lap)
// and check that they are knocked flying: node tools/crossing-post-test.mjs [out dir] [speed m/s] [side -1|1]
// Needs the vite dev server on :5198 and Playwright. Leaves before/after pictures in the out dir.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out = '.', speed = '11', side = '1'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto('http://127.0.0.1:5198/?drive&nointro');
await p.waitForFunction(() => window.__game?.world && window.__game.car, null, { timeout: 240000 });
await p.waitForTimeout(6000);
// the posts and a start 18 m back along the lap, lined up so the car's front corner takes the post
const at = await p.evaluate(async (side) => {
  const { createTrack } = await import('/src/race/race.js');
  const t = createTrack(), i = 1474, [tx, tz] = t.tan[i], rx = -tz, rz = tx;
  const c = t.P[i], dc = (686.8 - c[0]) * tx + (2625.5 - c[1]) * tz, hw = t.HW[i];
  const post = [c[0] + tx * (dc - 3.4) + rx * side * (hw + 0.35), c[1] + tz * (dc - 3.4) + rz * side * (hw + 0.35)];
  const off = side * (hw + 0.35 - 0.55);
  const start = [c[0] + tx * (dc - 22) + rx * off, c[1] + tz * (dc - 22) + rz * off];
  await __game.world.loadAround(start[0], start[1], 300);
  __game.place({ x: start[0], z: start[1], yaw: Math.atan2(tx, -tz) });
  return { post, start };
}, +side);
await p.waitForTimeout(12000);
const near = () => p.evaluate((q) => __game.props().nearest(q[0], q[1], (k) => k === 40), at.post);
const before = await near();
console.log('post before', before && { id: before.id, d: Math.hypot(before.x - at.post[0], before.z - at.post[1]).toFixed(2) });
await p.screenshot({ path: `${out}/post-before.png` });
const v0 = +speed;
// step the car and the props by hand (the frame loop stopped), 2.2 s at 60 Hz
const minV = await p.evaluate((v) => {
  const g = __game;
  window.requestAnimationFrame = () => 0;
  g.car.vx = v;
  let m = v;
  for (let k = 0; k < 130; k++) { g.sim(1 / 60, { up: 0 }); g.props().update(g.car, 1 / 60); m = Math.min(m, g.car.vx); }
  return m;
}, v0);
const after = await near();
const bodies = before ? await p.evaluate((id) => __game.props().bodies(id), before.id) : [];
console.log('standing post nearest after', after && { id: after.id, d: Math.hypot(after.x - at.post[0], after.z - at.post[1]).toFixed(2) });
console.log('knocked bodies', JSON.stringify(bodies.map((x) => ({ p: x.p.map((v) => +v.toFixed(2)), asleep: x.asleep }))));
console.log(`speed ${v0} -> min ${minV.toFixed(2)} m/s`);
// look at where the post was from back down the road, the car and the post's pieces in view
await p.evaluate(([post, start]) => {
  const g = __game, y = g.world.heightAt(post[0], post[1]);
  const dx = post[0] - start[0], dz = post[1] - start[1], l = Math.hypot(dx, dz);
  g.camera.position.set(post[0] - dx / l * 9 + dz / l * 2.5, y + 2.6, post[1] - dz / l * 9 - dx / l * 2.5);
  g.camera.lookAt(post[0] + dx / l * 3, y + 0.5, post[1] + dz / l * 3);
  g.renderer.render(g.scene, g.camera);
}, [at.post, at.start]);
await p.screenshot({ path: `${out}/post-after.png` });
await b.close();
