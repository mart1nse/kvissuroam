// Listening clips of the Roadster Rocket's motor sounds (src/audio-motor.js), one clip a sound.
//
// The real physics drives the car on a flat road: away gently to 60 km/h, a cruise, the pedal let go, braked
// to a stop; then floored to 200 km/h, the pedal let go for 3.5 s, floored again, let go and braked hard to a
// stop. The sound is made by the game's own code in Chromium's OfflineAudioContext, stepped at 60 Hz as the game
// steps it, at the game's levels, with the Rocket's fans and the wind as audio.js plays them (copied below), so a
// clip is what the driver hears. --solo leaves fans and wind out.
//
// Run: NODE_PATH=$(npm root -g) node tools/motor-sound-demo.mjs <outdir> [kinds] [--solo] [--gain=<dB>]
//   kinds: old,gear,turbine,inverter,pulse (default all). Writes <outdir>/<kind>.wav and prints, for each part
//   of the drive, the level and where the sound's weight lies. --gain: make-up for listening (default 13 dB,
//   the same for every clip, so they compare as they would in the game).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar } from '../src/cars/physics.js';
import { refillTank } from '../src/cars/thrust.js';
import { MOTOR_KINDS, motorRegen } from '../src/audio-motor.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flag = (k) => process.argv.find((a) => a.startsWith(`--${k}`));
const val = (k) => flag(`${k}=`)?.slice(k.length + 3);
const out = pos[0] || 'motor-demo';
const kinds = pos[1] ? pos[1].split(',') : ['old', ...MOTOR_KINDS];
const SOLO = !!flag('solo'), GAIN = 10 ** (Number(val('gain') ?? 13) / 20);
const SR = 48000, FPS = 60, ID = val('car') || 'rocket';
mkdirSync(out, { recursive: true });

// ---- the drive
const spec = CARS[ID];
const world = { meta: { riverLevel: -100 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: () => 100, sdfGrad: (x, z, o) => o };
refillTank(ID);
const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
const kmh = () => Math.hypot(car.vx, car.vy) * 3.6;
// (each step: what the driver does, and when it is over)
const steps = [
  ['rest', () => ({}), (t) => t > 0.6],
  ['away gently to 60', () => ({ up: 0.3 }), () => kmh() >= 60],
  ['cruise at 60', () => ({ up: kmh() < 60 ? 0.12 : 0.02 }), (t) => t > 1.6],
  ['pedal let go', () => ({}), (t) => t > 1.8],
  ['braked to a stop', () => ({ down: kmh() > 2 ? 0.3 : 0 }), (t) => kmh() < 0.5 || t > 6],
  ['rest', () => ({}), (t) => t > 0.9],
  ['floored to 200', () => ({ up: 1 }), () => kmh() >= 200],
  ['pedal let go at 200', () => ({}), (t) => t > 3.5],
  ['floored again', () => ({ up: 1 }), (t) => t > 1.6],
  ['pedal let go', () => ({}), (t) => t > 0.6],
  ['braked hard to a stop', () => ({ down: kmh() > 3 ? 1 : 0 }), (t) => kmh() < 0.5 || t > 8],
  ['rest', () => ({}), (t) => t > 0.8],
];
const F = [], marks = [];   // per 1/60 s: wheel speed, road speed, pedal, held back
{
  const dt = 1 / 120;
  let t = 0, n = 0;
  for (const [name, drive, done] of steps) {
    const t0 = t;
    marks.push({ name, t0 });
    do {
      const d = drive(t - t0);
      stepCar(car, { up: d.up || 0, down: d.down || 0, steer: 0 }, world, dt); t += dt;
      if (n++ % 2 === 0) { const v = Math.hypot(car.vx, car.vy); F.push(v + (car.slipV || 0), v, car.throttle, motorRegen(car, v)); }
    } while (!done(t - t0));
    marks.at(-1).t1 = t; marks.at(-1).kmh = kmh();
  }
}
const T = F.length / 4 / FPS;
writeFileSync(`${out}/marks.json`, JSON.stringify(marks));
console.log(`drive: ${T.toFixed(1)} s`);
for (const m of marks) console.log(`  ${m.t0.toFixed(1).padStart(5)} s  ${m.name}  (${m.kmh.toFixed(0)} km/h at its end)`);

// ---- the sound
const files = new Map();
const srv = await new Promise((ok) => {
  const s = createServer((req, res) => {
    if (req.method === 'POST') { const parts = []; req.on('data', (d) => parts.push(d)); req.on('end', () => { files.set(req.url, Buffer.concat(parts)); res.end('ok'); }); return; }
    if (req.url === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><title>motor</title>'); return; }
    try { const b = readFileSync(resolve(root, '.' + req.url.split('?')[0])); res.setHeader('content-type', 'text/javascript'); res.end(b); } catch { res.statusCode = 404; res.end(); }
  }).listen(0, '127.0.0.1', () => ok(s));
});
const browser = await createRequire(import.meta.url)('playwright').chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => console.log('  [page]', m.text()));
page.on('pageerror', (e) => console.log('  [page error]', e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/`);

for (const kind of kinds) {
  await page.evaluate(async ({ kind, F, SR, FPS, T, SOLO, spec }) => {
    const { createMotor } = await import('/src/audio-motor.js');
    const ctx = new OfflineAudioContext(1, Math.ceil(T * SR), SR);
    const master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);   // (audio.js: master 0.5; an electric car's bus goes to it dry)
    const nb = ctx.createBuffer(1, 2 * SR, SR), d = nb.getChannelData(0);
    let sd = 77; for (let i = 0; i < d.length; i++) { sd = (sd * 1664525 + 1013904223) >>> 0; d[i] = sd / 2147483648 - 1; }
    const noise = ctx.createBufferSource(); noise.buffer = nb; noise.loop = true; noise.start(0);
    const n = F.length / 4;
    // the motors
    if (kind === 'none') { /* fans and wind alone */ } else if (kind === 'old') {
      const o = ctx.createOscillator(), g = ctx.createGain(); g.gain.value = 0; o.connect(g).connect(master); o.start(0);
      for (let i = 0; i < n; i++) {
        const t = i / FPS, vw = F[i * 4], thr = F[i * 4 + 2];
        o.frequency.setTargetAtTime(180 + vw * 38, t, 0.05);
        g.gain.setTargetAtTime(Math.min(0.05, 0.004 + vw * 0.0012) * (0.5 + thr * 0.5), t, 0.08);
      }
    } else {
      const m = createMotor(ctx, master, noise, spec, kind);
      for (let i = 0; i < n; i++) m.step(i / FPS, F[i * 4], F[i * 4 + 2], F[i * 4 + 3], false);
    }
    if (!SOLO) {
      // the fans (audio.js makeFan, fanSound) ...
      const FAN_TONE = 0.035, FAN_AIR = 0.11, FAN_UP = 0.3;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.9;
      const air = ctx.createGain(); air.gain.value = 0;
      noise.connect(f).connect(air).connect(master);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300; lp.Q.value = 0.5;
      const tone = ctx.createGain(); tone.gain.value = 0;
      const osc = [1, 1.017, 0.989, 1.5].map((k, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; g.gain.value = i < 3 ? 1 : 0.35; o.connect(g).connect(lp); o.start(0); return [o, k]; });
      lp.connect(tone).connect(master);
      // ... and the wind (audio.js update)
      const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 600; wf.Q.value = 0.5;
      const wl = ctx.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 1800; wl.Q.value = -3;
      const wg = ctx.createGain(); wg.gain.value = 0;
      noise.connect(wf).connect(wl).connect(wg).connect(ctx.destination);
      let fanS = 0;
      for (let i = 0; i < n; i++) {
        const t = i / FPS, v = F[i * 4 + 1], thr = F[i * 4 + 2];
        const want = 0.5 + 0.5 * Math.max(thr, Math.min(1, v / 14));
        if (Math.abs(want - fanS) >= 0.01) {
          fanS = want;
          for (const [o, r] of osc) o.frequency.setTargetAtTime((120 + 260 * want) * r, t, FAN_UP);
          f.frequency.setTargetAtTime(450 + 700 * want, t, FAN_UP);
          tone.gain.setTargetAtTime(FAN_TONE * want * want, t, FAN_UP);
          air.gain.setTargetAtTime(FAN_AIR * want * want, t, FAN_UP);
        }
        wf.frequency.setTargetAtTime(650 + Math.min(v, 50) * 9, t, 0.1);
        wg.gain.setTargetAtTime(Math.min(0.115, v * 0.0025) * 0.5, t, 0.1);   // (the wind goes to the master, 0.5)
      }
    }
    const buf = await ctx.startRendering();
    await fetch(`/__out/${kind}`, { method: 'POST', body: buf.getChannelData(0) });
  }, { kind, F, SR, FPS, T, SOLO, spec: { gears: spec.gears, wheelRadius: spec.wheelRadius } });
  const b = files.get(`/__out/${kind}`), x = new Float32Array(b.buffer, b.byteOffset, b.length / 4);
  // how loud each part is, and its peak
  const db = (v) => (20 * Math.log10(Math.max(v, 1e-9))).toFixed(1);
  let peak = 0; for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  const rows = marks.filter((m) => !m.name.startsWith('rest')).map((m) => {
    let s = 0; const a = Math.floor(m.t0 * SR), e = Math.min(x.length, Math.floor(m.t1 * SR));
    for (let i = a; i < e; i++) s += x[i] * x[i];
    return `${m.name} ${db(Math.sqrt(s / (e - a)))}`;
  });
  console.log(`${kind}: peak ${db(peak)} dB;  ${rows.join(' | ')}`);
  writeWav(`${out}/${kind}.wav`, x);
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
