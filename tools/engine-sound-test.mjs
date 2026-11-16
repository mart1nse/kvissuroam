// Renders each combustion car's engine sound to a WAV, driven by the real physics:
// 2 s idle, a blip, full throttle from standstill for 12 s, lift off for 3 s, then a steady cruise.
// Run: node tools/engine-sound-test.mjs [outdir] [carIds]
// Also prints the strongest spectral peaks at a few rpm points so the firing frequency can be checked.
import { writeFileSync, mkdirSync } from 'node:fs';
import { CARS } from '../src/cars/specs.js';
import { createCar, stepCar } from '../src/cars/physics.js';
import { ENGINE_SOUNDS } from '../src/engine-sounds.js';
import { EngineCore, reviveConfig } from '../public/engine-worklet.js';

const out = process.argv[2] || 'engine-sounds';
const ids = process.argv[3] ? process.argv[3].split(',') : Object.keys(ENGINE_SOUNDS);
mkdirSync(out, { recursive: true });
const flat = { meta: { riverLevel: -10 }, heightAt: () => 0, surfaceAt: () => 1, sdfAt: () => 100, sdfGrad: (x, z, o) => o };
const SR = 44100, BLOCK = 128;

function script(t) {
  if (t < 2) return { up: 0 };
  if (t < 2.5) return { up: 1, hold: true }; // standing blip
  if (t < 3.5) return { up: 0, hold: true };
  if (t < 15.5) return { up: 1 };
  if (t < 18.5) return { up: 0 };
  return { up: 0.3 };
}

function wav(path, data) {
  const n = data.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i])) * 32000), 44 + i * 2);
  writeFileSync(path, b);
}

function peaks(x, from, len) {
  // magnitude spectrum by direct DFT on a coarse grid (20..2000 Hz, 5 Hz steps)
  const res = [];
  for (let f = 20; f <= 2000; f += 5) {
    let re = 0, im = 0;
    for (let i = 0; i < len; i++) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / len), a = 2 * Math.PI * f * i / SR; re += x[from + i] * w * Math.cos(a); im -= x[from + i] * w * Math.sin(a); }
    res.push([f, Math.hypot(re, im)]);
  }
  const loc = res.filter((p, i) => i > 0 && i < res.length - 1 && p[1] > res[i - 1][1] && p[1] >= res[i + 1][1]);
  return loc.sort((a, b) => b[1] - a[1]).slice(0, 4).map((p) => p[0]);
}

for (const id of ids) {
  const spec = CARS[id], cfg = ENGINE_SOUNDS[id];
  const car = createCar(spec, { x: 0, z: 0, yaw: 0 });
  const core = new EngineCore(SR);
  core.setConfig(reviveConfig({ ...cfg, banks: cfg.banks }));
  const T = 22, total = T * SR, data = new Float32Array(total), buf = new Float32Array(BLOCK);
  const marks = [];
  let t = 0, i = 0, nextMark = 0;
  while (i < total) {
    const s = script(t);
    if (!s.hold) stepCar(car, { up: s.up }, flat, BLOCK / SR);
    // standing blip in neutral: the physics has no neutral, so rev the engine directly
    let rpm = car.rpm, thr = car.throttle;
    if (s.hold) { rpm = s.up ? Math.min(spec.engine.idle + (t - 2) * 7000, 4200) : Math.max(spec.engine.idle, 4200 - (t - 2.5) * 4000); thr = s.up; }
    core.set({ rpm, throttle: thr, boost: car.boost || 0, on: 1, redline: spec.engine.redline, idle: spec.engine.idle });
    core.process(buf);
    data.set(buf.subarray(0, Math.min(BLOCK, total - i)), i);
    if (t >= nextMark && t > 4) { marks.push([t, rpm, i]); nextMark = t + 2; }
    i += BLOCK; t = i / SR;
  }
  let peak = 0; for (const v of data) peak = Math.max(peak, Math.abs(v));
  wav(`${out}/${id}.wav`, data);
  const firing = (r) => (r / 60) * cfg.order.length / 2;
  console.log(`${id}: peak ${peak.toFixed(2)}`);
  for (const [tt, rpm, at] of marks) console.log(`  t ${tt.toFixed(1)} s  ${Math.round(rpm)} rpm  firing ${firing(rpm).toFixed(0)} Hz  peaks ${peaks(data, at, 4096).join(', ')}`);
}
