// The side views on 5 and 6 (src/sidecam.js; Martin 26 Nov: "Add a side view option for the camera on desktop,
// perhaps like 5 and 6 keys? let it show the road at least 10m forna and after. in case of tesla zoom a litlle bit
// out during th ejump with smooth transition and move with the car in case of big drop in level etc.").
// Checks, in a desktop browser:
//  - the keys: 5 the left side, 6 the right, the same key again back to the view that was on, C back without
//    switching chase and drone, nothing with the map open or in the garage;
//  - the framing in three window shapes, a car and the bus: the camera square to the car, the road 10 m ahead of
//    the nose and 10 m behind the tail inside the picture;
//  - two streets of houses on the lap: the camera's line of sight to the car and to both ends of that road clears
//    the roofs, on both sides, standing and driving down the street (between tall houses close by it is as high as
//    it goes instead), and the camera rises and sinks without a jump;
//  - a Rocket's kickflip: the picture opens a little and closes again, never quickly, and the car stays in it;
//  - a fall of 40 m: the camera goes down with the car, which stays in the picture, and is never under the ground;
//  - what one frame of it costs.
// Run with the dev server on 5198: node tools/side-view-test.mjs [folder for pictures]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = 'http://localhost:5198', dir = process.argv[2] || '';
const RAADI = JSON.parse(fs.readFileSync(new URL('../src/race/raadi.json', import.meta.url))).pts;
const openSpot = (i) => ({ x: RAADI[i][0], z: RAADI[i][1], yaw: Math.atan2(RAADI[i + 2][0] - RAADI[i][0], -(RAADI[i + 2][1] - RAADI[i][1])) });
const LAP = JSON.parse(fs.readFileSync(new URL('../src/race/track.json', import.meta.url))).pts;
const TRACK = (i) => ({ x: LAP[i][0], z: LAP[i][1], yaw: Math.atan2(LAP[i + 2][0] - LAP[i][0], -(LAP[i + 2][1] - LAP[i][1])) });
const OPEN = openSpot(100);
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let bad = 0;
const check = (name, ok, note = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  (${note})` : ''}`); if (!ok) bad++; };

const open = async (w, h, car) => {
  const p = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  p.on('pageerror', (e) => check(`no page error: ${e.message}`, false));
  await p.goto(`${base}/?off=100&q=low&trees=old&lite=1&hidden=1`, { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.car, null, { timeout: 180000 });
  await p.evaluate((c) => { __game.setCar(c, true); __game.startDriving(); }, car);
  await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 120000 });
  // (drawing without a graphics card takes seconds a frame: nothing is drawn until a picture is wanted)
  await p.evaluate(() => {
    const g = __game, r = g.renderer; r.realRender = r.render; r.render = () => {};
    const V = g.camera.position.constructor;
    // where a point of the car's own road (d metres ahead of its middle, up over the road) falls in the picture
    window.__ndc = (d, up = 0) => { const c = g.car, v = new V(c.x + Math.sin(c.yaw) * d, c.y + up, c.z - Math.cos(c.yaw) * d).project(g.camera); return [v.x, v.y]; };
    // the camera's line of sight to that point: by how much it clears the roofs and the ground on the way (m, the least)
    window.__clear = (d) => {
      const c = g.car, w = g.world, cam = g.camera.position, tx = c.x + Math.sin(c.yaw) * d, tz = c.z - Math.cos(c.yaw) * d;
      const ty = d ? Math.max(c.y - 3, Math.min(c.y + 3, w.heightAt(tx, tz))) : c.y;
      let least = 99;
      for (let k = 0.1; k < 1; k += 0.02) {
        const x = tx + (cam.x - tx) * k, z = tz + (cam.z - tz) * k, y = ty + (cam.y - ty) * k;
        least = Math.min(least, y - Math.max(w.sdfAt(x, z) < 1 ? w.roofAt(x, z) : -1e9, w.heightAt(x, z)));
      }
      return least;
    };
    window.__view = () => {
      const c = g.car, cam = g.camera, f = [Math.sin(c.yaw), -Math.cos(c.yaw)], rel = [cam.position.x - c.x, cam.position.y - c.y, cam.position.z - c.z];
      const far = c.halfLen + 10;
      return { side: g.sideCam.side, w: g.sideCam.out.w, fov: cam.fov, fwd: rel[0] * f[0] + rel[2] * f[1], right: -rel[0] * f[1] + rel[2] * f[0], up: rel[1],
        ahead: __ndc(far), behind: __ndc(-far), car: __ndc(0, 0.6), clear: __clear(0), ends: Math.min(__clear(far), __clear(-far)), el: g.sideCam.out.el,
        under: cam.position.y - g.world.heightAt(cam.position.x, cam.position.z), y: c.y, air: c.airborne, flight: !!c.rocket?.flight, kmh: c.vx * 3.6, t: performance.now() / 1000 };
    };
    // every frame's view, while asked
    window.__rec = null;
    const tick = () => { if (window.__rec) window.__rec.push(__view()); requestAnimationFrame(tick); };
    tick();
  });
  return p;
};
const key = (p, code, type) => p.evaluate(([c, t]) => { for (const k of t ? [t] : ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(k, { code: c, bubbles: true, cancelable: true })); }, [code, type]);
const view = (p) => p.evaluate(() => __view());
const place = async (p, pose, wait = 4000) => { await p.evaluate((o) => __game.place(o), pose); await p.waitForTimeout(wait); };
const record = async (p, ms, during) => { await p.evaluate(() => { window.__rec = []; }); if (during) await during(); await p.waitForTimeout(ms); return p.evaluate(() => { const r = window.__rec; window.__rec = null; return r; }); };
const shot = async (p, name) => { if (!dir) return; await p.evaluate(() => { const g = __game; g.renderer.realRender(g.scene, g.camera); }); await p.screenshot({ path: `${dir}/${name}.png` }); console.log(`     picture ${name}.png`); };
const f = (v, n = 2) => v.toFixed(n);
// the fastest a figure changed between two frames, per second (frames closer than a 120th are left out: the
// browser's clock is too coarse for them)
const rate = (rec, k) => { let m = 0; for (let i = 1; i < rec.length; i++) { const dt = rec[i].t - rec[i - 1].t; if (dt > 1 / 120) m = Math.max(m, Math.abs(rec[i][k] - rec[i - 1][k]) / dt); } return m; };

// ---------------------------------------------------------------- the keys
console.log('the keys');
let p = await open(1440, 810, 'rocket');
await place(p, OPEN);
let v = await view(p);
check('the chase view to begin with', v.side === 0 && v.fwd < -4 && Math.abs(v.right) < 0.5, `camera ${f(-v.fwd)} m behind`);
await key(p, 'Digit5'); await p.waitForTimeout(1800);
v = await view(p);
check('5: the camera on the car\'s left, square to it', v.side === -1 && v.right < -10 && Math.abs(v.fwd) < 0.5, `${f(-v.right)} m to the left, ${f(v.up)} m up, ${f(v.fwd)} m along`);
check('the car drives to the left of the picture there', v.ahead[0] < -0.5 && v.behind[0] > 0.5);
await shot(p, 'side-left-open');
await key(p, 'Digit6'); await p.waitForTimeout(2600);
v = await view(p);
check('6 from there: the right side', v.side === 1 && v.right > 10 && Math.abs(v.fwd) < 0.5, `${f(v.right)} m to the right`);
await key(p, 'Digit6'); await p.waitForTimeout(1800);
v = await view(p);
check('6 again: back to the chase view', v.side === 0 && v.w === 0 && v.fwd < -4 && Math.abs(v.right) < 0.5);
await key(p, 'Numpad5'); await p.waitForTimeout(1800);
const was = await p.evaluate(() => localStorage.getItem('kvissuroam.view'));
await key(p, 'KeyC'); await p.waitForTimeout(1800);
v = await view(p);
check('C from a side view: back to the chase view, the drone not switched on', v.side === 0 && v.fwd < -4 && v.up < 6 && (await p.evaluate(() => localStorage.getItem('kvissuroam.view'))) === was);
await key(p, 'KeyC'); await p.waitForTimeout(1500);
await key(p, 'Digit5'); await p.waitForTimeout(1800);
await key(p, 'Digit5'); await p.waitForTimeout(1800);
v = await view(p);
check('from the drone view and back to it', v.side === 0 && v.up > 15, `${f(v.up)} m up`);
await key(p, 'KeyC'); await p.waitForTimeout(1200);
await key(p, 'KeyM'); await p.waitForTimeout(600);
await key(p, 'Digit5'); await p.waitForTimeout(300);
check('nothing with the map open', (await view(p)).side === 0);
await key(p, 'KeyM'); await p.waitForTimeout(600);
await key(p, 'KeyG'); await p.waitForFunction(() => __game.mode === 'menu', null, { timeout: 20000 });
await key(p, 'Digit6'); await p.waitForTimeout(300);
check('nothing in the garage', (await view(p)).side === 0);
await key(p, 'KeyG'); await p.waitForFunction(() => __game.mode === 'drive' && !__game.flying, null, { timeout: 60000 });

// ---------------------------------------------------------------- a kickflip from the side
console.log('a Rocket\'s kickflip');
await place(p, OPEN);
await key(p, 'Digit5'); await p.waitForTimeout(1800);
const fov0 = (await view(p)).fov;
await key(p, 'ArrowUp', 'keydown');
await p.waitForFunction(() => __game.car.vx > 8, null, { timeout: 20000 });
let rec = await record(p, 9000, async () => { await key(p, 'KeyX', 'keydown'); await p.waitForTimeout(120); await key(p, 'KeyX', 'keyup'); await key(p, 'ArrowUp', 'keyup'); await p.waitForTimeout(1500); await shot(p, 'side-kickflip'); });
{
  const fl = rec.filter((r) => r.flight), top = Math.max(...rec.map((r) => r.y)) - rec[0].y, wide = Math.max(...rec.map((r) => r.fov));
  check('it flew', fl.length > 20, `${f(fl.length ? fl[fl.length - 1].t - fl[0].t : 0)} s, ${f(top)} m up`);
  check('the picture opens a little in the air', wide > fov0 + 4 && wide < fov0 + 12, `${f(fov0, 1)} to ${f(wide, 1)} degrees`);
  check('...and never quickly', rate(rec, 'fov') < 12, `${f(rate(rec, 'fov'), 1)} degrees a second at most`);
  check('...and closes again after the landing', Math.abs(rec[rec.length - 1].fov - fov0) < 1, `${f(rec[rec.length - 1].fov, 1)} degrees ${f(rec[rec.length - 1].t - fl[fl.length - 1].t, 1)} s after it`);
  // (what the car meets after the landing, a bale or a bank, is not the camera's business: to half a second after it)
  const till = fl.length ? fl[fl.length - 1].t + 0.5 : 0, flown = rec.filter((r) => r.t < till);
  const hi = Math.max(...rec.map((r) => Math.abs(r.car[1]))), edge = Math.max(...flown.map((r) => Math.max(Math.abs(r.ahead[0]), Math.abs(r.behind[0])))), along = Math.max(...flown.map((r) => Math.abs(r.fwd)));
  check('the car stays well inside the picture, top to bottom', hi < 0.6, `at most ${f(hi)} of the way from the middle to the edge`);
  check('the road 10 m ahead and behind stays in it through the flight', edge < 0.97, `at most ${f(edge)} of the way to the side`);
  check('the camera stays beside the car through it', along < 1.5, `at most ${f(along)} m along`);
}

// ---------------------------------------------------------------- a long fall
console.log('a fall of 40 m');
await place(p, OPEN, 3000);
const g0 = (await view(p)).y;
rec = await record(p, 7000, () => p.evaluate((o) => __game.place(o), { ...OPEN, y: g0 + 40 }));
{
  const fall = rec.filter((r) => r.air), drop = Math.max(...rec.map((r) => r.y)) - rec[rec.length - 1].y;
  const hi = Math.max(...rec.map((r) => Math.abs(r.car[1])));
  check('it fell', fall.length > 20 && drop > 35, `${f(drop, 1)} m in ${f(fall.length ? fall[fall.length - 1].t - fall[0].t : 0)} s`);
  check('the car stays in the picture all the way down', hi < 0.8, `at most ${f(hi)} of the way from the middle to the edge`);
  check('the camera is never under the ground', Math.min(...rec.map((r) => r.under)) > 0.5, `${f(Math.min(...rec.map((r) => r.under)))} m over it at the least`);
  check('the car is back in the middle afterwards', Math.abs(rec[rec.length - 1].car[1]) < 0.1, f(rec[rec.length - 1].car[1]));
}
await key(p, 'KeyC');

// ---------------------------------------------------------------- houses in the way
// (two streets of the lap: Vallikraavi's end, houses of two and three floors a few metres from the kerb on both
// sides, and Rüütli, 18 m of wall 4 m from the car on both sides, where no camera can stand beside the car)
for (const [street, pose, tall] of [['a street of houses', TRACK(1160), false], ['a street of tall houses close by', TRACK(800), true]]) {
  console.log(street);
  for (const [code, name] of [['Digit5', 'left'], ['Digit6', 'right']]) {
    await place(p, pose, 5000);
    const near = await p.evaluate((sg) => { const c = __game.car, w = __game.world; for (let l = 2; l < 20; l++) { const x = c.x + Math.cos(c.yaw) * sg * l, z = c.z + Math.sin(c.yaw) * sg * l; if (w.sdfAt(x, z) < 1 && w.roofAt(x, z) > -1e8) return [l, w.roofAt(x, z) - c.y]; } return null; }, name === 'left' ? -1 : 1);
    check(`${name}: a house stands beside the road there`, !!near, near ? `${near[0]} m from the car, ${f(near[1], 0)} m high` : '');
    await key(p, 'Space', 'keydown');
    await key(p, code); await p.waitForTimeout(2500);
    v = await view(p);
    if (tall) check(`${name}: the camera looks down from as high as it goes`, v.el > 1.3 && v.clear > -1.5, `${f(v.el * 57.3, 0)} degrees up, the line of sight to the car ${f(v.clear)} m over the eaves`);
    else {
      check(`${name}: the camera sees the car over the roofs`, v.clear > 0.2, `clear by ${f(v.clear)} m, ${f(Math.abs(v.right))} m out and ${f(v.up)} m up`);
      check(`${name}: ...and both ends of the road`, v.ends > 0, `clear by ${f(v.ends)} m`);
    }
    check(`${name}: the road 10 m ahead and behind is in the picture`, Math.max(Math.abs(v.ahead[0]), Math.abs(v.behind[0])) < 0.97 && Math.abs(v.fwd) < 0.5);
    if (name === 'left') await shot(p, tall ? 'side-left-tall-houses' : 'side-left-houses');
    await key(p, 'Space', 'keyup');
    // down the street
    // (a Rocket would be at 180 km/h in four seconds: a second and a half of throttle, then it rolls)
    await key(p, 'ArrowUp', 'keydown');
    rec = await record(p, 6000, async () => { await p.waitForTimeout(1500); await key(p, 'ArrowUp', 'keyup'); });
    const seen = rec.filter((r) => r.clear > 0 || r.el > 1.3).length / rec.length;
    check(`${name}, driving: the car is in sight, or the camera as high as it goes`, seen > 0.9, `${f(seen * 100, 0)} % of ${rec.length} frames, to ${f(Math.max(...rec.map((r) => r.kmh)), 0)} km/h`);
    check(`${name}, driving: the camera rises and sinks without a jump`, rate(rec, 'el') < 2, `${f(rate(rec, 'el') * 57.3, 0)} degrees a second at most, between ${f(Math.min(...rec.map((r) => r.el)) * 57.3, 0)} and ${f(Math.max(...rec.map((r) => r.el)) * 57.3, 0)} degrees up`);
    await key(p, 'KeyC');
  }
}
// what a frame of it costs
await key(p, 'Digit5'); await p.waitForTimeout(1500);
const cost = await p.evaluate(() => {
  const g = __game, V = g.camera.position.constructor, a = new V(), b = new V(), t0 = performance.now();
  for (let i = 0; i < 4000; i++) g.sideCam.update(g.car, g.car.yaw, 0, 1.78, a, b);
  return (performance.now() - t0) / 4000;
});
check('a frame of it costs next to nothing', cost < 0.25, `${f(cost * 1000, 0)} millionths of a second`);
await p.context().close();

// ---------------------------------------------------------------- the framing, in other window shapes
console.log('the framing');
for (const [w, h, car] of [[1000, 1000, 'w201'], [2560, 1080, 'bus'], [1440, 810, 'bus']]) {
  p = await open(w, h, car);
  await place(p, OPEN);
  for (const code of ['Digit5', 'Digit6']) {
    await key(p, code); await p.waitForTimeout(code === 'Digit5' ? 1800 : 2600);
    v = await view(p);
    const edge = Math.max(Math.abs(v.ahead[0]), Math.abs(v.behind[0]));
    check(`${w} x ${h}, ${car}, ${code === 'Digit5' ? 'left' : 'right'}: 10 m of road ahead of the nose and behind the tail`, edge < 0.97 && edge > 0.7 && Math.abs(v.fwd) < 0.5 && Math.abs(v.car[1]) < 0.2,
      `${f(edge)} of the way to the side, camera ${f(Math.hypot(v.right, v.up), 1)} m away, ${f(v.fov, 0)} degrees`);
  }
  await p.context().close();
}
await browser.close();
console.log(bad ? `${bad} FAILED` : 'all ok');
process.exit(bad ? 1 : 0);
