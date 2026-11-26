// The side views on 5 and 6 (src/sidecam.js; Martin 26 Nov: "Add a side view option for the camera on desktop,
// perhaps like 5 and 6 keys? let it show the road at least 10m forna and after. in case of tesla zoom a litlle bit
// out during th ejump with smooth transition and move with the car in case of big drop in level etc."; then: "reduce
// the gap front and back to just a touch over the front and end of the car and then try to make the lens wider and
// the when i dont know at 2m on the side raise it up indeed").
// Checks, in a desktop browser:
//  - the keys: 5 the left side, 6 the right, the same key again back to the view that was on, C back without
//    switching chase and drone, nothing with the map open or in the garage;
//  - the framing in three window shapes, a car and the bus: the camera square to the car, 2 m out from its flank
//    in the open, the car's corners at the nose and the tail inside the picture with a touch to spare;
//  - two streets of houses on the lap: the camera is never inside a house, its line of sight to the car and to
//    both ends of it clears the walls, on both sides, standing and driving down the street, and it rises and sinks
//    without a jump;
//  - a Rocket's kickflip: the camera backs off a few metres in the air and comes back, never quickly, and the car
//    stays in the picture;
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
        least = Math.min(least, y - Math.max(w.sdfAt(x, z) < 0 ? w.roofAt(x, z) : -1e9, w.heightAt(x, z)));
      }
      return least;
    };
    window.__view = () => {
      const c = g.car, cam = g.camera, f = [Math.sin(c.yaw), -Math.cos(c.yaw)], rel = [cam.position.x - c.x, cam.position.y - c.y, cam.position.z - c.z];
      const far = c.halfLen, sd = Math.sign(-rel[0] * f[1] + rel[2] * f[0]) * c.halfWid;
      // the near flank's corners, at the nose and the tail, half a metre up: where they fall in the picture
      const corner = (d) => { const v = new V(c.x + f[0] * d - f[1] * sd, c.y + 0.5, c.z + f[1] * d + f[0] * sd).project(cam); return [v.x, v.y]; };
      const inHouse = g.world.sdfAt(cam.position.x, cam.position.z) < 0 && cam.position.y < g.world.roofAt(cam.position.x, cam.position.z);
      return { nose: corner(far), tail: corner(-far), inHouse, dist: Math.hypot(rel[0], rel[2]), halfWid: c.halfWid, side: g.sideCam.side, w: g.sideCam.out.w, fov: cam.fov, fwd: rel[0] * f[0] + rel[2] * f[1], right: -rel[0] * f[1] + rel[2] * f[0], up: rel[1],
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
const ends = (v) => Math.max(Math.abs(v.nose[0]), Math.abs(v.tail[0]));
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
check('5: the camera on the car\'s left, square to it, 2 m out from its flank', v.side === -1 && Math.abs(-v.right - v.halfWid - 2) < 0.4 && Math.abs(v.fwd) < 0.5, `${f(-v.right - v.halfWid)} m from the flank, ${f(v.up)} m up, ${f(v.fwd)} m along`);
check('the car drives to the left of the picture there', v.nose[0] < -0.5 && v.tail[0] > 0.5);
check('the whole car in the picture with a touch to spare', ends(v) < 0.97 && ends(v) > 0.6, `its corners ${f(ends(v))} of the way to the side, ${f(v.fov, 0)} degrees`);
await shot(p, 'side-left-open');
await key(p, 'Digit6'); await p.waitForTimeout(2600);
v = await view(p);
check('6 from there: the right side', v.side === 1 && v.right > 2.5 && Math.abs(v.fwd) < 0.5, `${f(v.right - v.halfWid)} m from the flank`);
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
const d0 = (await view(p)).dist;
await key(p, 'ArrowUp', 'keydown');
await p.waitForFunction(() => __game.car.vx > 8, null, { timeout: 20000 });
let rec = await record(p, 9000, async () => { await key(p, 'KeyX', 'keydown'); await p.waitForTimeout(120); await key(p, 'KeyX', 'keyup'); await key(p, 'ArrowUp', 'keyup'); await p.waitForTimeout(1500); await shot(p, 'side-kickflip'); });
{
  const fl = rec.filter((r) => r.flight), top = Math.max(...rec.map((r) => r.y)) - rec[0].y, back = Math.max(...rec.map((r) => r.dist));
  check('it flew', fl.length > 20, `${f(fl.length ? fl[fl.length - 1].t - fl[0].t : 0)} s, ${f(top)} m up`);
  check('the camera backs off a few metres in the air', back > d0 + 3 && back < d0 + 5, `${f(d0, 1)} to ${f(back, 1)} m from the car`);
  check('...and never quickly', rate(rec, 'dist') < 6.5, `${f(rate(rec, 'dist'), 1)} m a second at most`);
  check('...and comes back after the landing', Math.abs(rec[rec.length - 1].dist - d0) < 0.3, `${f(rec[rec.length - 1].dist, 1)} m ${f(rec[rec.length - 1].t - fl[fl.length - 1].t, 1)} s after it`);
  // (what the car meets after the landing, a bale or a bank, is not the camera's business: to half a second after it)
  const till = fl.length ? fl[fl.length - 1].t + 0.5 : 0, flown = rec.filter((r) => r.t < till);
  const hi = Math.max(...rec.map((r) => Math.abs(r.car[1]))), edge = Math.max(...flown.map((r) => Math.max(Math.abs(r.ahead[0]), Math.abs(r.behind[0])))), along = Math.max(...flown.map((r) => Math.abs(r.fwd)));
  check('the car stays well inside the picture, top to bottom', hi < 0.6, `at most ${f(hi)} of the way from the middle to the edge`);
  check('its nose and tail stay in it through the flight', edge < 0.97, `at most ${f(edge)} of the way to the side`);
  check('the camera stays beside the car through it', along < 1.5, `at most ${f(along)} m along`);
}

// ---------------------------------------------------------------- a long fall
console.log('a fall of 40 m');
await place(p, OPEN, 3000);
const before = await view(p), g0 = before.y;
rec = await record(p, 7000, () => p.evaluate((o) => __game.place(o), { ...OPEN, y: g0 + 40 }));
{
  const fall = rec.filter((r) => r.air), drop = Math.max(...rec.map((r) => r.y)) - rec[rec.length - 1].y;
  const hi = Math.max(...rec.map((r) => Math.abs(r.car[1])));
  check('it fell', fall.length > 20 && drop > 35, `${f(drop, 1)} m in ${f(fall.length ? fall[fall.length - 1].t - fall[0].t : 0)} s`);
  check('the car stays in the picture all the way down', hi < 0.8, `at most ${f(hi)} of the way from the middle to the edge`);
  check('the camera is never under the ground', Math.min(...rec.map((r) => r.under)) > 0.5, `${f(Math.min(...rec.map((r) => r.under)))} m over it at the least`);
  check('the car is back where it was in the picture afterwards', Math.abs(rec[rec.length - 1].car[1] - before.car[1]) < 0.08, `${f(rec[rec.length - 1].car[1])}, was ${f(before.car[1])}`);
}
await key(p, 'KeyC');

// ---------------------------------------------------------------- houses in the way
// (two streets of the lap: Vallikraavi's end, houses of two and three floors a few metres from the kerb on both
// sides, Rüütli, 18 m of wall 4 or 5 m from the car's middle on both sides, and a wall 2 m from the car's middle
// on its right in the old town, where the camera has to come in over the pavement or rise)
for (const [street, pose, sides, pic] of [['a street of houses', TRACK(1160), ['left', 'right'], 'side-left-houses'], ['a street of tall houses close by', TRACK(800), ['left', 'right'], 'side-left-tall-houses'],
  ['a wall right beside the car', TRACK(108), ['right'], 'side-right-wall']]) {
  console.log(street);
  for (const name of sides) {
    const code = name === 'left' ? 'Digit5' : 'Digit6';
    await place(p, pose, 5000);
    const near = await p.evaluate((sg) => { const c = __game.car, w = __game.world; for (let l = 2; l < 20; l++) { const x = c.x + Math.cos(c.yaw) * sg * l, z = c.z + Math.sin(c.yaw) * sg * l; if (w.sdfAt(x, z) < 1 && w.roofAt(x, z) > -1e8) return [l, w.roofAt(x, z) - c.y]; } return null; }, name === 'left' ? -1 : 1);
    check(`${name}: a house stands beside the road there`, !!near, near ? `${near[0]} m from the car, ${f(near[1], 0)} m high` : '');
    await key(p, 'Space', 'keydown');
    await key(p, code); await p.waitForTimeout(2500);
    v = await view(p);
    check(`${name}: the camera is not in a house and sees the car`, !v.inHouse && v.clear > 0, `${f(Math.abs(v.right) - v.halfWid)} m out from the flank, ${f(v.up)} m up (${f(v.el * 57.3, 0)} degrees), clear by ${f(Math.min(v.clear, 9))} m`);
    check(`${name}: ...and both its ends`, v.ends > 0, `clear by ${f(Math.min(v.ends, 9))} m`);
    check(`${name}: the car's nose and tail in the picture`, ends(v) < 0.97 && Math.abs(v.fwd) < 0.5, `${f(ends(v))} of the way to the side`);
    if (name === sides[0]) await shot(p, pic);
    await key(p, 'Space', 'keyup');
    // down the street
    // (a Rocket would be at 180 km/h in four seconds: a second and a half of throttle, then it rolls)
    await key(p, 'ArrowUp', 'keydown');
    rec = await record(p, 6000, async () => { await p.waitForTimeout(1500); await key(p, 'ArrowUp', 'keyup'); });
    const seen = rec.filter((r) => r.clear > 0 && !r.inHouse).length / rec.length;
    check(`${name}, driving: the car in sight, the camera never in a house`, seen > 0.95, `${f(seen * 100, 0)} % of ${rec.length} frames, to ${f(Math.max(...rec.map((r) => r.kmh)), 0)} km/h`);
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
    check(`${w} x ${h}, ${car}, ${code === 'Digit5' ? 'left' : 'right'}: the car's nose and tail in, with a touch to spare`, ends(v) < 0.97 && ends(v) > 0.6 && Math.abs(v.fwd) < 0.5 && Math.abs(v.car[1]) < 0.3,
      `${f(ends(v))} of the way to the side, camera ${f(Math.abs(v.right) - v.halfWid, 1)} m from the flank, ${f(v.fov, 0)} degrees`);
  }
  await p.context().close();
}
await browser.close();
console.log(bad ? `${bad} FAILED` : 'all ok');
process.exit(bad ? 1 : 0);
