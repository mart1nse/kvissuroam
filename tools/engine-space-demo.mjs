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
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar } from '../src/cars/physics.js';
import { ENGINE_SOUNDS } from '../src/engine-sounds.js';

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
const { EngineCore, reviveConfig } = await import(pathToFileURL(wl).href);
mkdirSync(out, { recursive: true });
const SR = 48000, BLOCK = 128, FPS = 60, T = 22;
const flat = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: () => 100, sdfGrad: (x, z, o) => o };

function script(t) {
  if (t < 2) return { up: 0 };
  if (t < 2.5) return { up: 1, hold: true };
  if (t < 3.5) return { up: 0, hold: true };
  if (t < 15.5) return { up: 1 };
  if (t < 18.5) return { up: 0 };
  return { up: 0.3 };
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
  let dist = 0, camDist = 6.4, camYaw = null, nextPose = 0;
  for (let i = 0; i < total; i += BLOCK) {
    const t = i / SR, s = script(t);
    if (!s.hold) stepCar(car, { up: s.up }, flat, BLOCK / SR);
    let rpm = car.rpm, thr = car.throttle;
    if (s.hold) { rpm = s.up ? Math.min(spec.engine.idle + (t - 2) * 7000, 4200) : Math.max(spec.engine.idle, 4200 - (t - 2.5) * 4000); thr = s.up; }
    core.set({ rpm, throttle: thr, boost: car.boost || 0, on: 1, redline: spec.engine.redline, idle: spec.engine.idle, cut: car.revCut > 0 ? 1 : 0, shift: car.shiftCut ? 1 : 0 });
    core.process(buf);
    mono.set(buf.subarray(0, Math.min(BLOCK, total - i)), i);
    const v = Math.hypot(car.vx, car.vy);
    dist += v * BLOCK / SR;
    if (t >= nextPose) {
      nextPose += 1 / FPS;
      const p = along(dist + 2);
      if (camYaw === null) camYaw = p.yaw;
      let d = p.yaw - camYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      camYaw += d * (1 - Math.exp(-(3 + v * 0.08) / FPS));
      camDist += (6.4 + Math.min(v, 55) * 0.035 + Math.min(v, 70) * 0.075 - camDist) * (1 - Math.exp(-5 / FPS));
      const cx = Math.sin(camYaw), cz = -Math.cos(camYaw);
      poses.push(p.x, p.z, p.yaw, p.x - cx * camDist, 2.35, p.z - cz * camDist, Math.cos(camYaw), Math.sin(camYaw));
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
  server.files.set('/__in/mono', Buffer.from(mono.buffer));
  server.files.set('/__in/poses', Buffer.from(new Float32Array(poses).buffer));
  server.files.set('/__in/grid', Buffer.from(grid.buffer));
  const page = await browser.newPage();
  page.on('console', (m) => console.log('  [page]', m.text()));
  await page.goto(`http://127.0.0.1:${server.port}/`);
  const stats = await page.evaluate(async ({ SR, T, FPS, x0, z0, nx, nz, MIX }) => {
    const { createSpace } = await import('/src/audio-space.js');
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
    const n = poses.length / 8, log = [];
    const car = { x: 0, z: 0, yaw: 0, y: 0 }, cam = { position: { x: 0, y: 0, z: 0 }, matrixWorld: { elements: new Float32Array(16) } };
    const step = (k) => {
      const o = k * 8;
      car.x = poses[o]; car.z = poses[o + 1]; car.yaw = poses[o + 2];
      cam.position.x = poses[o + 3]; cam.position.y = poses[o + 4]; cam.position.z = poses[o + 5];
      cam.matrixWorld.elements[0] = poses[o + 6]; cam.matrixWorld.elements[1] = 0; cam.matrixWorld.elements[2] = poses[o + 7];
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
  }, { SR, T, FPS, x0, z0, nx, nz, MIX });
  await page.close();
  const ob = server.files.get('/__out'), all = new Float32Array(ob.buffer, ob.byteOffset, ob.length / 4);
  const L = all.subarray(0, all.length / 2), R = all.subarray(all.length / 2);
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
