// Before/after clips of the engine sound with the space around the car (src/audio-space.js).
//
// Each car does the run of tools/engine-sound-test.mjs (idle, a blip, full throttle from standstill,
// lift off, cruise), driven by the real physics, and the distance it covers is laid along the race track
// from the start/finish line on Küüni, so the echoes come off the real old town buildings (read from the
// baked obstacle distance field in public/data/sec). The camera sits where the chase camera would.
// The engine itself is rendered here in node by the worklet code; the space is rendered by the real
// audio-space.js in Chromium's OfflineAudioContext, stepped at 60 Hz like the game.
//
// Run: NODE_PATH=$(npm root -g) node tools/engine-space-demo.mjs <outdir> [carIds] [--worklet=<old worklet>] [--dry]
//   writes <outdir>/<id>.wav (stereo). --dry leaves the space out (with --worklet: the "before" clip).
//   --turbo: a run with lifts on boost (a long one, quick ones, a coast) and the turbo sounds as audio.js
//   plays them: blow-off and upshift chirps from src/audio-turbo.js, the whistle in the synth.
//   --turbo=old: the turbo sounds before that (a sine whistle and a single pssh), for the "before" clip
//   (with --worklet= the synth from before the whistle moved into it).
//   --shift: floored to 200 km/h, braked hard to 60 (the automatic coming down), pulled up again, then Z
//   three times in a quick row off the throttle (the last one past the redline) and coasting on the engine,
//   with the downshift sounds as audio.js plays them (src/audio-shift.js); --shift=old without them (for
//   the "before" clip, with the old physics.js and --worklet= in place).
//   --drone: the camera where the drone view (C) puts it, 35-55 m up and back, and the space told how far
//   off it is (setFar), as audio.js does.
//   --donut: full lock and full throttle, the engine bouncing off its limiter, a lift, and again.
//   The room the revs add near the limiter (setRev) follows the shift sounds as audio.js does; --room=<er>,<rev>
//   sets how much, after downshifts too (--room=0,0: none, the "before" clip).
//   --back=<er>,<rev>: the room the chase camera dropping back at speed adds (setBack; 0,0: none).
//   --burnout: brake and throttle together at a standstill (a standing burnout), a lift, then a donut.
//   --tyres[=<spin level>]: the tyre sounds as audio.js plays them (scrub and wheelspin howl, into the car
//   bus); the level is the wheelspin gain at full spin (default the game's SPIN_LEVEL, 0.05 before 21 Nov).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar, shiftGear } from '../src/cars/physics.js';
import { ENGINE_SOUNDS } from '../src/engine-sounds.js';
const { chaseBack } = await import('../src/audio-space.js');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flag = (k) => process.argv.find((a) => a.startsWith(`--${k}`));
const val = (k) => flag(`${k}=`)?.slice(k.length + 3);
const out = pos[0] || 'space-demo';
const ids = pos[1] ? pos[1].split(',') : ['cgt', 'f40', 'm3', 'w201'];
const wl = resolve(val('worklet') || resolve(root, 'public/engine-worklet.js'));
const dry = !!flag('dry');
// --mix=er,tail: scale the echoes and the tail (both 1 in the game), to hear them on their own
const MIX = val('mix') ? (([er, tail]) => ({ er, tail }))(val('mix').split(',').map(Number)) : {};
if (val('room')) MIX.room = MIX.roomDown = (([er, rev]) => ({ er, rev }))(val('room').split(',').map(Number));
if (val('back')) MIX.back = (([er, rev]) => ({ er, rev }))(val('back').split(',').map(Number));
const DONUT = !!flag('donut');
const BURNOUT = !!flag('burnout');
const { SPIN_LEVEL, spinAmount } = await import('../src/audio.js').catch(() => ({}));
const TYRES = flag('tyres') ? Number(val('tyres') || SPIN_LEVEL || 0.05) : 0;
const TURBO = flag('turbo') ? val('turbo') || 'new' : flag('shift') ? 'new' : null;
const DRONE = !!flag('drone');
const SHIFT = flag('shift') ? val('shift') || 'new' : null;
const { createShiftSound } = SHIFT === 'new' || DONUT || BURNOUT ? await import('../src/audio-shift.js') : {};
const { revRoom } = await import('../src/audio-space.js');
const { EngineCore, reviveConfig } = await import(pathToFileURL(wl).href);
mkdirSync(out, { recursive: true });
const SR = 48000, BLOCK = 128, FPS = 60, T = flag('shift') ? 27 : 22;
const flat = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: () => 100, sdfGrad: (x, z, o) => o };

// full lock and full throttle from a standstill: round and round on the limiter, a lift, and again
function donutScript(t) {
  if (t < 0.8) return { up: 0 };
  if (t < 9) return { up: 1, steer: 1 };
  if (t < 10.5) return { up: 0, steer: 1 };
  if (t < 16) return { up: 1, steer: 1 };
  return { up: 0, steer: 1 };
}
function burnoutScript(t) {
  if (t < 0.8) return { up: 0 };
  if (t < 6) return { up: 1, down: 1 };
  if (t < 7) return { up: 0 };
  if (t < 15) return { up: 1, steer: 1 };
  return { up: 0, steer: 1 };
}
function script(t) {
  if (t < 2) return { up: 0 };
  if (t < 2.5) return { up: 1, hold: true };
  if (t < 3.5) return { up: 0, hold: true };
  if (t < 15.5) return { up: 1 };
  if (t < 18.5) return { up: 0 };
  return { up: 0.3 };
}
// floored from standstill, a long lift on full boost, a quick lift, a lift-blip-lift, a coast, and again
function turboScript(t) {
  const on = [[0.8, 6], [7.3, 10], [10.35, 12.6], [13.05, 13.4], [16, 19.5]];
  return { up: on.some(([a, b]) => t >= a && t < b) ? 1 : 0 };
}

// floored to 200 km/h (or 11 s), braked to 60, floored again into third, then off the throttle and Z, Z, Z
// 0.15 s apart, coasting on the engine, and floored to the end (a state machine: the phases end on speed)
function shiftDriver() {
  let ph = 0, t0 = 0, zs = 0, g3 = 0;
  return (t, car) => {
    const kmh = Math.hypot(car.vx, car.vy) * 3.6;
    if (ph === 0) { if (t >= 0.8) { ph = 1; t0 = t; } return { up: 0 }; }
    if (ph === 1) { if (kmh >= 200 || t - t0 > 11) { ph = 2; t0 = t; } return { up: 1 }; }
    if (ph === 2) { if (kmh <= 60) { ph = 3; t0 = t; g3 = 0; } return { down: 1 }; }
    if (ph === 3) {
      if (car.gear >= 3 && !g3) g3 = t;
      if ((g3 && t - g3 > 1.2) || t - t0 > 8) { ph = 4; t0 = t; }
      return { up: t - t0 > 0.4 ? 1 : 0 };
    }
    if (ph === 4) {
      // off the throttle, then the three Zs
      const want = t - t0 > 0.25 ? Math.min(3, 1 + Math.floor((t - t0 - 0.25) / 0.15)) : 0;
      let z = 0;
      if (zs < want) { zs++; z = 1; }
      if (t - t0 > 2.2) { ph = 5; t0 = t; }
      return { up: 0, z };
    }
    return { up: 1 };
  };
}

// ---- the track and the obstacle field round it
const track = JSON.parse(readFileSync(resolve(root, 'src/race/track.json'), 'utf8'));
const P = track.pts, cum = [0];
for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
function along(s) {
  s = ((s % cum.at(-1)) + cum.at(-1)) % cum.at(-1);
  let i = 0; while (cum[i + 1] < s) i++;
  const k = (s - cum[i]) / (cum[i + 1] - cum[i]), a = P[i], b = P[i + 1];
  // heading from a few metres either side, so the car follows the bends smoothly
  const j0 = Math.max(0, i - 3), j1 = Math.min(P.length - 1, i + 4);
  const tx = P[j1][0] - P[j0][0], tz = P[j1][1] - P[j0][1];
  return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, yaw: Math.atan2(tx, -tz) };
}
const meta = JSON.parse(readFileSync(resolve(root, 'public/data/meta.json'), 'utf8'));
const S = meta.sector.size, G0 = meta.sector.grid0, dn = meta.sdf.n, dres = meta.sdf.res;
const hn = meta.height.n, sn = meta.surface.n;
const sectors = new Map();
function sector(x, z) {
  const sx = Math.floor((x - G0) / S), sz = Math.floor((z - G0) / S), k = `${sx}_${sz}`;
  if (!sectors.has(k)) {
    let D = null;
    try {
      let buf = readFileSync(resolve(root, `public/data/sec/${k}.kvs`));
      if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
      const o = 32 + hn * hn * 2 + sn * sn;
      D = new Uint8Array(buf.buffer, buf.byteOffset + o, dn * dn);
    } catch {}
    sectors.set(k, { x0: G0 + sx * S, z0: G0 + sz * S, D });
  }
  return sectors.get(k);
}
function sdfAt(x, z) {
  const s = sector(x, z);
  if (!s.D) return 12;
  let fx = (x - s.x0) / dres, fz = (z - s.z0) / dres, c = Math.min(dn - 2, Math.floor(fx)), r = Math.min(dn - 2, Math.floor(fz));
  fx -= c; fz -= r;
  const D = s.D, i = r * dn + c;
  return meta.sdf.min + ((D[i] * (1 - fx) + D[i + 1] * fx) * (1 - fz) + (D[i + dn] * (1 - fx) + D[i + dn + 1] * fx) * fz) / 255 * (meta.sdf.max - meta.sdf.min);
}

const server = dry ? null : await new Promise((ok) => {
  const files = new Map();
  const srv = createServer((req, res) => {
    if (req.method === 'POST') {
      const parts = []; req.on('data', (d) => parts.push(d)); req.on('end', () => { files.set(req.url, Buffer.concat(parts)); res.end('ok'); });
      return;
    }
    if (files.has(req.url)) { res.setHeader('content-type', 'application/octet-stream'); res.end(files.get(req.url)); return; }
    if (req.url === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><title>space</title>'); return; }
    try { const b = readFileSync(resolve(root, '.' + req.url)); res.setHeader('content-type', req.url.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'); res.end(b); }
    catch { res.statusCode = 404; res.end(); }
  }).listen(0, '127.0.0.1', () => ok({ srv, files, port: srv.address().port }));
});
const browser = dry ? null : await createRequire(import.meta.url)('playwright').chromium.launch();

for (const id of ids) {
  const spec = CARS[id], cfg = ENGINE_SOUNDS[id];
  const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
  const core = new EngineCore(SR);
  core.setConfig(reviveConfig({ ...cfg }));
  const total = T * SR, mono = new Float32Array(total), buf = new Float32Array(BLOCK);
  const poses = [];               // per 1/60 s: car x, z, yaw, camera x, y, z, right x, z
  let dist = 0, camDist = 6.4, camYaw = null, nextPose = 0, droneYaw = null;
  // the turbo as audio.js hears it, at the game's 60 Hz: the whistle (for the old oscillator) and events
  const tb = spec.engine.turbo, tWh = [], tEv = [];
  let lastBoost = 0, lastPsh = -9, wasShift = false;
  // the tyres as audio.js hears them, at 60 Hz: time, scrub band, scrub gain, spin band, spin gain
  const TY = [];
  let skid = 0, spinS = 0;
  // the downshift sounds as audio.js has them, at the game's 60 Hz
  const drv = SHIFT ? shiftDriver() : null, shs = SHIFT === 'new' || DONUT || BURNOUT ? createShiftSound() : null, sEv = [], gLog = [], sPunch = [], RM = [];
  let sh = { blip: 0, crackle: 0, over: 0, bark: 0, rpm: 0 }, nextSh = 0, lastG = 1;
  for (let i = 0; i < total; i += BLOCK) {
    const t = i / SR, s = drv ? drv(t, car) : DONUT ? donutScript(t) : BURNOUT ? burnoutScript(t) : TURBO ? turboScript(t) : script(t);
    if (s.z) shiftGear(car, -1);
    if (!s.hold) stepCar(car, { up: s.up, down: s.down || 0, steer: s.steer || 0 }, flat, BLOCK / SR);
    if (car.gear !== lastG) { gLog.push(`${lastG}>${car.gear} ${t.toFixed(2)} s ${(Math.hypot(car.vx, car.vy) * 3.6).toFixed(0)} km/h`); lastG = car.gear; }
    let rpm = car.rpm, thr = car.throttle;
    if (s.hold) { rpm = s.up ? Math.min(spec.engine.idle + (t - 2) * 7000, 4200) : Math.max(spec.engine.idle, 4200 - (t - 2.5) * 4000); thr = s.up; }
    if (shs && t >= nextSh) {
      nextSh += 1 / FPS;
      sh = shs.step(car, t);
      if (sh.clunk) sEv.push({ t: t + 0.005 + sh.clunk.after, k: sh.clunk.k, up: !!sh.clunk.up });
      if (sh.chirp) sEv.push({ t: t + 0.005, k: sh.chirp, chirp: true });
      if (sh.punch !== undefined) sPunch.push(t, sh.punch);
      RM.push(revRoom(sh.rpm, spec.engine.redline), sh.gear || 0, sh.down || 0);
    }
    let cutS = car.shiftCut ? 1 : 0;
    if (shs) { rpm = sh.rpm; if (sh.throttle !== undefined) { thr = sh.throttle; cutS = sh.shift ? 1 : 0; } }
    core.set({ rpm, throttle: thr, boost: car.boost || 0, shaft: car.shaft || 0, on: 1, redline: spec.engine.redline, idle: spec.engine.idle, cut: car.revCut > 0 ? 1 : 0, shift: cutS, blip: sh.blip, crackle: sh.crackle, over: sh.over, bark: sh.bark, yank: sh.yank || 0, yankId: sh.yankId || 0, yankTight: sh.yankTight || 0,
      growl: DRONE || !chaseBack ? 0 : chaseBack(Math.hypot(camDist, 2.35)) });
    core.process(buf);
    mono.set(buf.subarray(0, Math.min(BLOCK, total - i)), i);
    const v = Math.hypot(car.vx, car.vy);
    dist += v * BLOCK / SR;
    if (t >= nextPose) {
      nextPose += 1 / FPS;
      if (TURBO && tb) {
        const b = car.boost || 0;
        tWh.push(t, 1400 + car.rpm * 0.35 * (0.4 + 0.6 * b), 0.016 * b * b * (tb.whistle ?? 1));
        if (car.throttle > 0) {
          lastBoost = Math.max(lastBoost * 0.99, b);
          if (TURBO !== 'old' && car.shiftCut && !wasShift && b > 0.5) tEv.push({ t, k: 'chirp', P: b });
        } else {
          if (TURBO === 'old' && lastBoost > 0.5 && t - lastPsh > 0.6) { tEv.push({ t, k: 'psh', P: lastBoost * (tb.whistle ?? 1) }); lastPsh = t; }
          if (TURBO !== 'old' && lastBoost > 0.3 && t - lastPsh > 0.4) { tEv.push({ t, k: 'bov', P: lastBoost }); lastPsh = t; }
          lastBoost = 0;
        }
        wasShift = !!car.shiftCut;
      }
      if (TYRES) {
        const k = Math.max(car.skidF || 0, car.skidR || 0);
        skid += (k - skid) * 0.2;
        spinS += (spinAmount(car) - spinS) * 0.15;
        TY.push(t, 1050 + Math.min(v, 35) * 16, Math.max(0, skid - 0.15) * 0.07, 680 + 420 * spinS, spinS * TYRES);
      }
      const p = along(dist + 2);
      if (camYaw === null) camYaw = p.yaw;
      let d = p.yaw - camYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      camYaw += d * (1 - Math.exp(-(3 + v * 0.08) / FPS));
      camDist += (6.4 + Math.min(v, 55) * 0.035 + Math.min(v, 70) * 0.075 - camDist) * (1 - Math.exp(-5 / FPS));
      const cx = Math.sin(camYaw), cz = -Math.cos(camYaw);
      if (DRONE) {
        // (main.js: the drone turns with the travel direction, slowly, and rises and drops back with speed)
        if (droneYaw === null) droneYaw = p.yaw;
        let dd = p.yaw - droneYaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd));
        droneYaw += dd * (1 - Math.exp(-1.4 / FPS));
        const dx = Math.sin(droneYaw), dz = -Math.cos(droneYaw), h = 30 + Math.min(v, 60) * 0.3;
        poses.push(p.x, p.z, p.yaw, p.x - dx * h * 0.55, h, p.z - dz * h * 0.55, Math.cos(droneYaw), Math.sin(droneYaw));
      } else poses.push(p.x, p.z, p.yaw, p.x - cx * camDist, 2.35, p.z - cz * camDist, Math.cos(camYaw), Math.sin(camYaw));
    }
  }
  if (dry) {
    writeWav(`${out}/${id}.wav`, [mono, mono]);
    console.log(`${id}: dry, rms ${rms(mono).toFixed(3)}`);
    continue;
  }
  // the obstacle field round the route, as a raster for the browser
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let k = 0; k < poses.length; k += 8) { x0 = Math.min(x0, poses[k]); x1 = Math.max(x1, poses[k]); z0 = Math.min(z0, poses[k + 1]); z1 = Math.max(z1, poses[k + 1]); }
  x0 -= 60; z0 -= 60; x1 += 60; z1 += 60;
  const nx = Math.ceil((x1 - x0) / 0.5) + 1, nz = Math.ceil((z1 - z0) / 0.5) + 1, grid = new Float32Array(nx * nz);
  for (let r = 0; r < nz; r++) for (let c = 0; c < nx; c++) grid[r * nx + c] = sdfAt(x0 + c * 0.5, z0 + r * 0.5);
  if (flag('no-engine')) mono.fill(0);          // (--no-engine: only the blow-off, to check its level)
  server.files.set('/__in/mono', Buffer.from(mono.buffer));
  server.files.set('/__in/poses', Buffer.from(new Float32Array(poses).buffer));
  server.files.set('/__in/grid', Buffer.from(grid.buffer));
  const page = await browser.newPage();
  page.on('console', (m) => console.log('  [page]', m.text()));
  await page.goto(`http://127.0.0.1:${server.port}/`);
  if (gLog.length) console.log(`  gears: ${gLog.join(', ')}`);
  if (TY.length) {
    let pk = 0, on = 0;
    for (let k = 0; k < TY.length; k += 5) { pk = Math.max(pk, TY[k + 4]); if (TY[k + 4] > TYRES * 0.5) on++; }
    console.log(`  wheelspin: peak gain ${pk.toFixed(3)}, over half for ${(on / FPS).toFixed(1)} s`);
  }
  const stats = await page.evaluate(async ({ SR, T, FPS, x0, z0, nx, nz, MIX, TB, SEV, SP, RM, TY }) => {
    const { createSpace, chaseBack } = await import('/src/audio-space.js');
    const get = async (u) => new Float32Array(await (await fetch(u)).arrayBuffer());
    const mono = await get('/__in/mono'), poses = await get('/__in/poses'), grid = await get('/__in/grid');
    const at = (x, z) => {
      let fx = (x - x0) / 0.5, fz = (z - z0) / 0.5;
      if (fx < 0 || fz < 0 || fx >= nx - 1 || fz >= nz - 1) return 12;
      const c = Math.floor(fx), r = Math.floor(fz); fx -= c; fz -= r;
      const i = r * nx + c;
      return (grid[i] * (1 - fx) + grid[i + 1] * fx) * (1 - fz) + (grid[i + nx] * (1 - fx) + grid[i + nx + 1] * fx) * fz;
    };
    const world = {
      sdfAt: at,
      sdfGrad(x, z, o) { const e = 0.35, gx = at(x + e, z) - at(x - e, z), gz = at(x, z + e) - at(x, z - e), l = Math.hypot(gx, gz); o[0] = l > 1e-6 ? gx / l : 0; o[1] = l > 1e-6 ? gz / l : 0; return o; },
    };
    const ctx = new OfflineAudioContext(2, T * SR, SR);
    const b = ctx.createBuffer(1, mono.length, SR); b.copyToChannel(mono, 0);
    const src = ctx.createBufferSource(); src.buffer = b;
    // the game's master level and the engine's place in it (audio.js: master 0.5, ENGINE_LEVEL inside the synth gain)
    // (the synth's level in the game, ENGINE_LEVEL in audio.js, then back up so the clip compares with the dry one)
    const lvl = ctx.createGain(), back = ctx.createGain(); lvl.gain.value = 0.4; back.gain.value = 1 / 0.4;
    back.connect(ctx.destination);
    const space = createSpace(ctx, back, MIX);
    src.connect(lvl).connect(space.input); src.start(0);
    if (SP.length) {
      // a gear change's blip and bark round the compressor as well, as audio.js does
      const pg = ctx.createGain(); pg.gain.value = 0; lvl.connect(pg).connect(space.burst);
      for (let k = 0; k < SP.length; k += 2) pg.gain.setTargetAtTime(SP[k + 1], SP[k], 0.01);
    }
    const n = poses.length / 8, log = [];
    if (TY.length) {
      // the tyre scrub and the wheelspin howl: one looped noise through two narrow bands into the car bus
      const nb = ctx.createBuffer(1, 2 * SR, SR), d = nb.getChannelData(0);
      let sd = 77; for (let i = 0; i < d.length; i++) { sd = (sd * 1664525 + 1013904223) >>> 0; d[i] = sd / 2147483648 - 1; }
      const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true; ns.start(0);
      const band = (f, q) => { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; return b; };
      const sf = band(1300, 5), sg = ctx.createGain(), pf = band(800, 6), pg = ctx.createGain();
      sg.gain.value = pg.gain.value = 0;
      ns.connect(sf).connect(sg).connect(space.input); ns.connect(pf).connect(pg).connect(space.input);
      for (let k = 0; k < TY.length; k += 5) {
        sf.frequency.setTargetAtTime(TY[k + 1], TY[k], 0.08); sg.gain.setTargetAtTime(TY[k + 2], TY[k], 0.07);
        pf.frequency.setTargetAtTime(TY[k + 3], TY[k], 0.1); pg.gain.setTargetAtTime(TY[k + 4], TY[k], 0.08);
      }
    }
    if (TB) {
      // the turbo sounds straight into the car bus, as in audio.js
      let seed = 4242;
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const noise = ctx.createBuffer(1, 2 * SR, SR), nd = noise.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = rnd() * 2 - 1;
      const bus = TB.old ? space.input : space.burst;
      if (TB.old) {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; g.gain.value = 0;
        o.connect(g).connect(bus); o.start(0);
        for (let k = 0; k < TB.wh.length; k += 3) { o.frequency.setTargetAtTime(TB.wh[k + 1], TB.wh[k], 0.08); g.gain.setTargetAtTime(TB.wh[k + 2], TB.wh[k], 0.08); }
        // the blow-off as it was: one band-passed burst of noise falling in pitch
        for (const e of TB.ev) {
          const t = e.t, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g2 = ctx.createGain();
          src.buffer = noise; f.type = 'bandpass'; f.Q.value = 0.8;
          f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(1100, t + 0.35);
          g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(Math.min(0.12, 0.13 * e.P), t + 0.02); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
          src.connect(f).connect(g2).connect(bus); src.start(t, rnd()); src.stop(t + 0.45);
        }
      } else {
        const { blowOff, shiftChirp } = await import('/src/audio-turbo.js');
        for (const e of TB.ev) (e.k === 'bov' ? blowOff : shiftChirp)(ctx, noise, bus, e.P, TB.bov, rnd, e.t + 0.005);
      }
      log.push(`turbo events: ${TB.ev.map((e) => `${e.k} ${e.t.toFixed(2)} s P ${e.P.toFixed(2)}`).join(', ')}`);
    }
    if (SEV.length) {
      // the downshift clunks, into the car bus as in audio.js
      const { clunk, chirp } = await import('/src/audio-shift.js');
      const nb = ctx.createBuffer(1, 2 * SR, SR), d = nb.getChannelData(0);
      let sd = 99; for (let i = 0; i < d.length; i++) { sd = (sd * 1664525 + 1013904223) >>> 0; d[i] = sd / 2147483648 - 1; }
      for (const e of SEV) {
        if (e.chirp) chirp?.(ctx, nb, space.input, e.k, e.t);
        else clunk(ctx, nb, e.up ? space.burst : space.input, e.k, e.t, e.up);
      }
      log.push(`clunks: ${SEV.map((e) => `${e.t.toFixed(2)} s ${e.chirp ? 'chirp' : e.up ? 'up' : 'down'} ${e.k.toFixed(2)}`).join(', ')}`);
    }
    const car = { x: 0, z: 0, yaw: 0, y: 0 }, cam = { position: { x: 0, y: 0, z: 0 }, matrixWorld: { elements: new Float32Array(16) } };
    const step = (k) => {
      const o = k * 8;
      car.x = poses[o]; car.z = poses[o + 1]; car.yaw = poses[o + 2];
      cam.position.x = poses[o + 3]; cam.position.y = poses[o + 4]; cam.position.z = poses[o + 5];
      cam.matrixWorld.elements[0] = poses[o + 6]; cam.matrixWorld.elements[1] = 0; cam.matrixWorld.elements[2] = poses[o + 7];
      const cd = Math.hypot(cam.position.x - car.x, cam.position.y - car.y, cam.position.z - car.z);
      space.setFar?.(Math.min(1, Math.max(0, (cd - 16) / 16)));
      // (and the chase camera dropping back with speed, as audio.js does)
      if (chaseBack) space.setBack?.(chaseBack(cd));
      // (and the room the revs add near the limiter, as audio.js does)
      if (RM.length > 3 * k + 2) space.setRev?.(RM[3 * k], RM[3 * k + 1], RM[3 * k + 2]);
      const built = space.update(world, car, cam, 1 / FPS);
      if (k % 60 === 0) log.push(`${(k / FPS).toFixed(0)} s built ${built.toFixed(2)} tail ${space.tail.toFixed(2)} walls ${space.taps.map((t) => (t.d > 0 ? t.d.toFixed(0) : '-')).join(' ')}`);
    };
    step(0);
    for (let k = 1; k < n; k++) {
      const tt = Math.round(k / FPS * SR / 128) * 128 / SR;
      if (tt >= T) break;
      ctx.suspend(tt).then(() => { step(k); ctx.resume(); });
    }
    const t0 = performance.now();
    const res = await ctx.startRendering();
    const ms = performance.now() - t0;
    const L = res.getChannelData(0), R = res.getChannelData(1);
    const outb = new Float32Array(L.length * 2); outb.set(L, 0); outb.set(R, L.length);
    await fetch('/__out', { method: 'POST', body: outb });
    return { ms, log };
  }, { SR, T, FPS, x0, z0, nx, nz, MIX, TY, TB: TURBO && tb ? { old: TURBO === 'old', wh: tWh, ev: tEv, bov: tb.bov } : null, SEV: sEv, SP: sPunch, RM });
  await page.close();
  const ob = server.files.get('/__out'), all = new Float32Array(ob.buffer, ob.byteOffset, ob.length / 4);
  const L = all.subarray(0, all.length / 2), R = all.subarray(all.length / 2);
  // (--gain=<x>: scale the clip, to keep loud lifts from clipping the WAV)
  const og = Number(val('gain') || 1);
  if (og !== 1) for (const c of [L, R]) for (let i = 0; i < c.length; i++) c[i] *= og;
  writeWav(`${out}/${id}.wav`, [L, R]);
  console.log(`${id}: dry rms ${rms(mono).toFixed(3)}, with space rms ${rms(L).toFixed(3)} / ${rms(R).toFixed(3)}, offline render ${(stats.ms / 1000).toFixed(2)} s for ${T} s`);
  for (const l of stats.log) console.log('   ', l);
}
if (browser) await browser.close();
if (server) server.srv.close();

function rms(x) { let e = 0; for (const v of x) e += v * v; return Math.sqrt(e / x.length); }
function writeWav(path, ch) {
  const n = ch[0].length, nc = ch.length, b = Buffer.alloc(44 + n * 2 * nc);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2 * nc, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(nc, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2 * nc, 28);
  b.writeUInt16LE(2 * nc, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2 * nc, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, ch[c][i])) * 32000), 44 + (i * nc + c) * 2);
  writeFileSync(path, b);
}
