// Listening clips of the Roadster Rocket's suction fans (src/audio-fan.js), before and after the moods and the
// peaks of suction lost (Martin 27 Nov: "it gets repetitive and difficult to the ear").
//
// The real physics drives the Rocket: away to 80 km/h, a long cruise on paving, two kerbs and a bump, a stretch of
// gravel, paving again, a jump (1.2 s off the ground, as a kickflip or a crest; put on the car, the flat road has
// none), a cruise, braked to a stop and a long rest. The sound is made in Chromium's OfflineAudioContext at 60 Hz
// as the game steps it, at the game's levels, with the motors (audio-motor.js) and the wind as audio.js plays
// them, so a clip is what the driver hears. --solo: the fans alone.
//
// Run: NODE_PATH=$(npm root -g) node tools/fan-sound-demo.mjs <outdir> [old,new] [--solo] [--gain=<dB>] [--seed=<n>]
// Writes <outdir>/<kind>.wav and prints the level of each part and the share of the fans' sound over 2 kHz.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar } from '../src/cars/physics.js';
import { refillTank } from '../src/cars/thrust.js';
import { motorRegen } from '../src/audio-motor.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flag = (k) => process.argv.find((a) => a.startsWith(`--${k}`));
const val = (k) => flag(`${k}=`)?.slice(k.length + 3);
const out = pos[0] || 'fan-demo';
const kinds = pos[1] ? pos[1].split(',') : ['old', 'new'];
const SOLO = !!flag('solo'), GAIN = 10 ** (Number(val('gain') ?? 13) / 20), SEED = Number(val('seed') ?? 7);
const SR = 48000, FPS = 60;
mkdirSync(out, { recursive: true });

// ---- the drive (gravel between 330 and 460 m along the road)
const spec = CARS.rocket;
const GRAVEL = [330, 460];
const world = { meta: { riverLevel: -100 }, heightAt: () => 0, sdfAt: () => 100, sdfGrad: (x, z, o) => o,
  surfaceAt: (x, z) => { const d = Math.hypot(x, z); return d > GRAVEL[0] && d < GRAVEL[1] ? 2 : 1; } };
refillTank('rocket');
const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
const kmh = () => Math.hypot(car.vx, car.vy) * 3.6, dist = () => Math.hypot(car.x, car.z);
const hold = (k) => ({ up: kmh() < k ? Math.min(1, 0.1 + (k - kmh()) * 0.05) : 0.02 });
// (each step: what the driver does, when it is over, and what happens to the car on its way: put on the car's
// state after the physics, as the flat road has no kerbs or crests)
const steps = [
  ['rest', () => ({}), (t) => t > 1.2],
  ['away to 80', () => ({ up: 0.45 }), () => kmh() >= 80],
  ['cruise at 80 on paving', () => hold(80), (t) => t > 11],
  ['two kerbs and a bump', () => hold(80), (t) => t > 3.5, (t) => (Math.abs(t - 0.5) < 0.01 ? { kerb: 0.55 } : Math.abs(t - 1.7) < 0.01 ? { kerb: 0.3 } : t > 2.6 && t < 2.75 ? { vy: Math.sin((t - 2.6) / 0.15 * Math.PI) * 1.8 } : null)],
  ['on to the gravel', () => hold(80), () => dist() > GRAVEL[1]],
  ['paving again', () => hold(80), (t) => t > 3],
  ['a jump', () => hold(80), (t) => t > 3.4, (t) => (t > 0.3 && t < 1.5 ? { air: true } : Math.abs(t - 1.5) < 0.01 ? { landed: 3.2 } : null)],
  ['cruise', () => hold(80), (t) => t > 6],
  ['braked to a stop', () => ({ down: kmh() > 2 ? 0.45 : 0 }), (t) => kmh() < 0.5 || t > 8],
  ['rest', () => ({}), (t) => t > 9],
];
const F = [], marks = [];   // per 1/60 s: wheel speed, speed, pedal, held back, loose, air, kerb, landed, vyUp
const W = 9;
{
  const dt = 1 / 120;
  let t = 0, n = 0;
  for (const [name, drive, done, ev] of steps) {
    const t0 = t;
    marks.push({ name, t0 });
    do {
      const d = drive(t - t0);
      stepCar(car, { up: d.up || 0, down: d.down || 0, steer: 0 }, world, dt); t += dt;
      if (n++ % 2 === 0) {
        const e = (ev && ev(t - t0)) || {}, v = Math.hypot(car.vx, car.vy);
        F.push(v + (car.slipV || 0), v, car.throttle, motorRegen(car, v), car.surface !== 1 ? 1 : 0, e.air ? 1 : 0, e.kerb || 0, e.landed || 0, e.vy ?? (car.vyUp || 0));
      }
    } while (!done(t - t0));
    marks.at(-1).t1 = t; marks.at(-1).kmh = kmh();
  }
}
const T = F.length / W / FPS;
writeFileSync(`${out}/marks.json`, JSON.stringify(marks));
console.log(`drive: ${T.toFixed(1)} s`);
for (const m of marks) console.log(`  ${m.t0.toFixed(1).padStart(5)} s  ${m.name}  (${m.kmh.toFixed(0)} km/h at its end)`);

// ---- the sound
const files = new Map();
const srv = await new Promise((ok) => {
  const s = createServer((req, res) => {
    if (req.method === 'POST') { const parts = []; req.on('data', (d) => parts.push(d)); req.on('end', () => { files.set(req.url, Buffer.concat(parts)); res.end('ok'); }); return; }
    if (req.url === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><title>fans</title>'); return; }
    try { const b = readFileSync(resolve(root, '.' + req.url.split('?')[0])); res.setHeader('content-type', 'text/javascript'); res.end(b); } catch { res.statusCode = 404; res.end(); }
  }).listen(0, '127.0.0.1', () => ok(s));
});
const browser = await createRequire(import.meta.url)('playwright').chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => console.log('  [page]', m.text()));
page.on('pageerror', (e) => console.log('  [page error]', e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`);

for (const kind of kinds) {
  for (const part of SOLO ? ['fans'] : ['all', 'fans']) {
    await page.evaluate(async ({ kind, part, F, W, SR, FPS, T, SEED, spec }) => {
      const { createMotor } = await import('/src/audio-motor.js');
      const { createFan, FAN_UP } = await import('/src/audio-fan.js');
      let sd = SEED >>> 0;
      const rand = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
      const ctx = new OfflineAudioContext(1, Math.ceil(T * SR), SR);
      const master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);   // (audio.js: master 0.5; an electric car's bus goes to it dry)
      const nb = ctx.createBuffer(1, 2 * SR, SR), d = nb.getChannelData(0);           // (audio.js: 2 s of noise, looped)
      for (let i = 0; i < d.length; i++) d[i] = rand() * 2 - 1;
      const noise = ctx.createBufferSource(); noise.buffer = nb; noise.loop = true; noise.start(0);
      const n = F.length / W;
      if (part === 'all') {
        const m = createMotor(ctx, master, noise, spec, 'gear');
        for (let i = 0; i < n; i++) m.step(i / FPS, F[i * W], F[i * W + 2], F[i * W + 3], false);
        // the wind (audio.js update)
        const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 600; wf.Q.value = 0.5;
        const wl = ctx.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 1800; wl.Q.value = -3;
        const wg = ctx.createGain(); wg.gain.value = 0;
        noise.connect(wf).connect(wl).connect(wg).connect(ctx.destination);
        for (let i = 0; i < n; i++) {
          const t = i / FPS, v = F[i * W + 1], vw = F[i * W], rumble = F[i * W + 4] && !F[i * W + 5];
          wf.frequency.setTargetAtTime(rumble ? 320 : 650 + Math.min(v, 50) * 9, t, 0.1);
          wg.gain.setTargetAtTime((rumble ? Math.min(0.22, vw * 0.0081) : Math.min(0.115, v * 0.0025) * (F[i * W + 5] ? 0.7 : 1)) * 0.5, t, 0.1);
        }
      }
      const want = (i) => 0.5 + 0.5 * Math.max(F[i * W + 2], Math.min(1, F[i * W + 1] / 14));
      if (kind === 'old') {
        // the fans as they were up to 27 Nov (audio.js makeFan, fanSound)
        const FAN_TONE = 0.035, FAN_AIR = 0.11;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.9;
        const air = ctx.createGain(); air.gain.value = 0;
        noise.connect(f).connect(air).connect(master);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300; lp.Q.value = 0.5;
        const tone = ctx.createGain(); tone.gain.value = 0;
        const osc = [1, 1.017, 0.989, 1.5].map((k, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; g.gain.value = i < 3 ? 1 : 0.35; o.connect(g).connect(lp); o.start(0); return [o, k]; });
        lp.connect(tone).connect(master);
        let fanS = 0;
        for (let i = 0; i < n; i++) {
          const t = i / FPS, w = want(i);
          if (Math.abs(w - fanS) < 0.01) continue;
          fanS = w;
          for (const [o, r] of osc) o.frequency.setTargetAtTime((120 + 260 * w) * r, t, FAN_UP);
          f.frequency.setTargetAtTime(450 + 700 * w, t, FAN_UP);
          tone.gain.setTargetAtTime(FAN_TONE * w * w, t, FAN_UP);
          air.gain.setTargetAtTime(FAN_AIR * w * w, t, FAN_UP);
        }
      } else {
        // the fans as audio.js fanSound plays them now
        const fan = createFan(ctx, master, nb, rand);
        let fvy = 0, lastL = 0, lastK = 0;
        for (let i = 0; i < n; i++) {
          const t = i / FPS, o = i * W, L = F[o + 7], K = F[o + 6];
          let knock = 0;
          if (L > 1 && L > lastL + 0.5) knock = Math.min(1, L / 5);
          if (K > 0.08 && K > lastK + 0.06) knock = Math.max(knock, Math.min(1, K * 1.3));
          lastL = L; lastK = K;
          const dv = Math.abs(F[o + 8] - fvy); fvy = F[o + 8];
          knock = Math.max(knock, Math.min(1, Math.max(0, (dv - 0.5) / 2.5)));
          // (the offline context runs the sound thread only between these: as many words as the game sends)
          fan.step(t, want(i), FAN_UP, !!F[o + 4], !!F[o + 5], knock, F[o + 1]);
        }
      }
      const buf = await ctx.startRendering();
      await fetch(`/__out/${kind}-${part}`, { method: 'POST', body: buf.getChannelData(0) });
    }, { kind, part, F, W, SR, FPS, T, SEED, spec: { id: spec.id, gears: spec.gears, wheelRadius: spec.wheelRadius } });
    const b = files.get(`/__out/${kind}-${part}`), x = new Float32Array(b.buffer, b.byteOffset, b.length / 4);
    const db = (v) => (20 * Math.log10(Math.max(v, 1e-9))).toFixed(1);
    let peak = 0; for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
    const rows = marks.filter((m) => !m.name.startsWith('rest') || part === 'fans').map((m) => {
      let s = 0; const a = Math.floor(m.t0 * SR), e = Math.min(x.length, Math.floor(m.t1 * SR));
      for (let i = a; i < e; i++) s += x[i] * x[i];
      return `${m.name} ${db(Math.sqrt(s / (e - a)))}`;
    });
    console.log(`${kind} ${part}: peak ${db(peak)} dB;  ${rows.join(' | ')}`);
    writeWav(`${out}/${kind}-${part}.wav`, x);
  }
}
await browser.close(); srv.close();

function writeWav(path, x) {
  const n = x.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i] * GAIN)) * 32767), 44 + i * 2);
  writeFileSync(path, b);
}
