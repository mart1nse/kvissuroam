// Synthesised engine / wind sound. Starts on the first user gesture.
// Combustion engines run through the engine synthesiser worklet (public/engine-worklet.js, tuned per car
// in src/engine-sounds.js); the old two-oscillator buzz stays as the fallback where worklets are missing.
import { ENGINE_SOUNDS } from './engine-sounds.js';

const ENGINE_LEVEL = 0.4;

export function createAudio() {
  let ctx = null, master, engGain, osc1, osc2, filt, windGain, windFilt, windLp, whine, whineGain, skidGain, skidFilt;
  let skid = 0, lastLanded = 0, noiseBuf = null, lastBoost = 0, lastPsh = 0;
  let muted = false, ev = false, turbo = false, background = false;
  let synth = null, synthGain = null, synthCfg = null, carId = null;

  function start() {
    if (ctx) { ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);

    filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 500; filt.Q.value = 1.2;
    engGain = ctx.createGain(); engGain.gain.value = 0;
    osc1 = ctx.createOscillator(); osc1.type = 'sawtooth';
    osc2 = ctx.createOscillator(); osc2.type = 'square';
    const g2 = ctx.createGain(); g2.gain.value = 0.45;
    osc1.connect(filt); osc2.connect(g2).connect(filt); filt.connect(engGain).connect(master);
    osc1.start(); osc2.start();
    loadSynth();

    whine = ctx.createOscillator(); whine.type = 'sine';
    whineGain = ctx.createGain(); whineGain.gain.value = 0;
    whine.connect(whineGain).connect(master); whine.start();

    const len = ctx.sampleRate * 2;
    const buf = noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    windFilt = ctx.createBiquadFilter(); windFilt.type = 'bandpass'; windFilt.frequency.value = 600; windFilt.Q.value = 0.5;
    // (a low-pass takes the sharp top off the noise: a rush of air, not a hiss)
    windLp = ctx.createBiquadFilter(); windLp.type = 'lowpass'; windLp.frequency.value = 1800; windLp.Q.value = -3;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    noise.connect(windFilt).connect(windLp).connect(windGain).connect(master);
    // tyre scrub: the same noise through a narrow band, kept very quiet
    skidFilt = ctx.createBiquadFilter(); skidFilt.type = 'bandpass'; skidFilt.frequency.value = 1300; skidFilt.Q.value = 5;
    skidGain = ctx.createGain(); skidGain.gain.value = 0;
    noise.connect(skidFilt).connect(skidGain).connect(master);
    noise.start();
  }

  function loadSynth() {
    if (!ctx.audioWorklet || typeof AudioWorkletNode !== 'function') return;
    ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}engine-worklet.js`).then(() => {
      synth = new AudioWorkletNode(ctx, 'engine-sound', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
      synthGain = ctx.createGain(); synthGain.gain.value = ENGINE_LEVEL;
      synth.connect(synthGain).connect(master);
      sendConfig();
    }).catch(() => { synth = null; });
  }
  function sendConfig() {
    synthCfg = ENGINE_SOUNDS[carId] || null;
    if (synth && synthCfg) synth.port.postMessage({ config: synthCfg });
  }

  // dull thud of the suspension taking a landing; strength is the sink rate in m/s
  function thump(strength) {
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
    g.gain.setValueAtTime(Math.min(0.9, 0.12 * strength), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.25);
  }

  // turbo blow-off valve venting when the throttle snaps shut on boost
  function psh(strength) {
    const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(1100, t + 0.35);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.min(0.12, 0.13 * strength), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random()); src.stop(t + 0.45);
  }

  function update(car, active) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const landed = car.landed || 0;
    if (active && !car.inWater && landed > 1 && landed > lastLanded + 0.5) thump(landed);
    lastLanded = landed;
    const v = Math.hypot(car.vx, car.vy);
    const dead = !active || car.inWater;
    const flying = car.airborne && car.airTime > 0.1;
    // the driven wheels (and the motor with them) can run ahead of the road
    const vw = v + (car.slipV || 0);
    if (ev) {
      engGain.gain.setTargetAtTime(0, t, 0.05);
      if (synth) synth.port.postMessage({ state: { on: 0 } });
      whine.frequency.setTargetAtTime(180 + vw * 38, t, 0.05);
      whineGain.gain.setTargetAtTime(dead ? 0 : Math.min(0.05, 0.004 + vw * 0.0012) * (0.5 + car.throttle * 0.5), t, 0.08);
    } else {
      // turbos whistle as they spool, rising in pitch with boost and revs
      const b = car.boost || 0;
      if (turbo) {
        whine.frequency.setTargetAtTime(1400 + car.rpm * 0.35 * (0.4 + 0.6 * b), t, 0.08);
        whineGain.gain.setTargetAtTime(dead ? 0 : 0.016 * b * b, t, 0.08);
        // (lastBoost: the boost built while the throttle was open, vented once it closes)
        if (car.throttle > 0) lastBoost = Math.max(lastBoost * 0.99, b);
        else {
          if (!dead && lastBoost > 0.5 && t - lastPsh > 0.6) { psh(lastBoost); lastPsh = t; }
          lastBoost = 0;
        }
      } else whineGain.gain.setTargetAtTime(0, t, 0.05);
      const e = car.spec.engine;
      if (synth && synthCfg) {
        synth.port.postMessage({ state: { rpm: car.rpm, throttle: car.throttle, boost: b, on: dead ? 0 : 1, redline: e.redline, idle: e.idle, cut: car.revCut > 0 ? 1 : 0 } });
        engGain.gain.setTargetAtTime(0, t, 0.03);
      } else {
      const cyl = e.pulses ?? (car.spec.id === 'w201' ? 3 : 2);   // firing pulses per rev
      const f = (car.rpm / 60) * cyl;
      osc1.frequency.setTargetAtTime(f, t, 0.03);
      osc2.frequency.setTargetAtTime(f / 2, t, 0.03);
      filt.frequency.setTargetAtTime(350 + car.rpm * 0.28 + car.throttle * 900, t, 0.05);
      engGain.gain.setTargetAtTime(dead ? 0 : 0.05 + car.throttle * 0.11, t, 0.06);
      }
    }
    // The same noise is gravel rumble on loose ground and wind on paving. The wind is kept
    // noticeable as speed builds but not loud.
    const rumble = car.surface !== 1 && !flying;
    windFilt.frequency.setTargetAtTime(rumble ? 320 : 650 + Math.min(v, 50) * 9, t, 0.1);
    const windLevel = rumble ? Math.min(0.22, vw * 0.0081) : Math.min(0.115, v * 0.0025) * (flying ? 0.7 : 1);
    windGain.gain.setTargetAtTime(dead ? 0 : windLevel, t, flying ? 0.03 : 0.1);
    // only on paving, and only audible once the slide is well under way
    const k = dead || car.surface !== 1 ? 0 : Math.max(car.skidF || 0, car.skidR || 0);
    skid += (k - skid) * 0.2;
    skidFilt.frequency.setTargetAtTime(1050 + Math.min(v, 35) * 16, t, 0.08);
    skidGain.gain.setTargetAtTime(Math.max(0, skid - 0.15) * 0.07, t, 0.07);
  }

  return {
    start, update,
    setCar(spec) {
      ev = spec.engine.type === 'ev'; turbo = !!spec.engine.turbo; lastBoost = 0;
      carId = ev ? null : spec.id;
      if (ctx) sendConfig();
    },
    setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m || background ? 0 : 0.5, ctx.currentTime, 0.05); },
    setBackground(b) {
      background = b;
      if (!ctx) return;
      if (b) ctx.suspend?.().catch(() => {});
      else ctx.resume?.().catch(() => {});
      if (master) master.gain.setTargetAtTime(muted || b ? 0 : 0.5, ctx.currentTime, 0.05);
    },
    get muted() { return muted; },
  };
}
