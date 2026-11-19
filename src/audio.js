// Synthesised engine / wind sound. Starts on the first user gesture.
// Combustion engines run through the engine synthesiser worklet (public/engine-worklet.js, tuned per car
// in src/engine-sounds.js); the old two-oscillator buzz stays as the fallback where worklets are missing.
import { ENGINE_SOUNDS } from './engine-sounds.js';

const ENGINE_LEVEL = 0.4;
// Other players' cars: the nearest few get a voice each (engine, motor whine, turbo, tyres), placed by
// distance and direction from the camera.
const VOICES = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 2 : 3;
const HEAR = 240;          // metres: further off than this a car is silent
const REF = 7;             // metres: at this distance another car is as loud as our own
const SOUND = 343;         // m/s: the sound arrives late by distance / SOUND, which is also what bends its pitch

export function createAudio() {
  let ctx = null, master, engGain, osc1, osc2, filt, windGain, windFilt, windLp, whine, whineGain, skidGain, skidFilt, spinGain, spinFilt;
  let skid = 0, spinS = 0, lastLanded = 0, lastKerb = 0, noiseBuf = null, lastBoost = 0, lastPsh = 0, airArmed = false;
  let muted = false, ev = false, turbo = false, background = false;
  let synth = null, synthGain = null, synthCfg = null, carId = null;
  let noiseSrc = null, workletReady = false;
  const voices = [];

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
    // wheelspin: the thin howl of a tyre spinning on paving, kept well under the engine
    spinFilt = ctx.createBiquadFilter(); spinFilt.type = 'bandpass'; spinFilt.frequency.value = 800; spinFilt.Q.value = 6;
    spinGain = ctx.createGain(); spinGain.gain.value = 0;
    noise.connect(spinFilt).connect(spinGain).connect(master);
    noise.start();
    noiseSrc = noise;
  }

  function loadSynth() {
    if (!ctx.audioWorklet || typeof AudioWorkletNode !== 'function') return;
    ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}engine-worklet.js`).then(() => {
      workletReady = true;
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

  // a wheel rolling up a kerb: a short thud through the suspension and the slap of the tyre on stone
  function knock(strength) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.09);
    g.gain.setValueAtTime(Math.min(0.18, 0.13 * strength), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.16);
    if (!noiseBuf) return;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    src.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.2;
    gn.gain.setValueAtTime(Math.min(0.06, 0.045 * strength), t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    src.connect(f).connect(gn).connect(master);
    src.start(t, Math.random()); src.stop(t + 0.08);
  }

  // turbo blow-off valve venting when the throttle snaps shut on boost
  function psh(strength, dest = master) {
    const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(1100, t + 0.35);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.min(0.12, 0.13 * strength), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random()); src.stop(t + 0.45);
  }

  // air brakes: the long, low hiss of the valves venting once a bus has braked to a stop
  function airPsh() {
    const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 0.7;
    f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(1500, t + 0.9);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.03);
    g.gain.setTargetAtTime(0.0001, t + 0.25, 0.22);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random()); src.stop(t + 1.3);
  }

  function update(car, active) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const landed = car.landed || 0;
    if (active && !car.inWater && landed > 1 && landed > lastLanded + 0.5) thump(landed);
    lastLanded = landed;
    const kerb = car.kerbHit || 0;
    if (active && !car.inWater && kerb > 0.08 && kerb > lastKerb + 0.06) knock(kerb);
    lastKerb = kerb;
    const v = Math.hypot(car.vx, car.vy);
    const dead = !active || car.inWater;
    const flying = car.airborne && car.airTime > 0.1;
    if (car.spec.airBrakes) {
      if (car.brake > 0 && v > 2) airArmed = true;
      else if (airArmed && v < 0.3) { airArmed = false; if (!dead) airPsh(); }
      else if (car.throttle > 0) airArmed = false;
    }
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
        whineGain.gain.setTargetAtTime(dead ? 0 : 0.016 * b * b * (car.spec.engine.turbo.whistle ?? 1), t, 0.08);
        // (lastBoost: the boost built while the throttle was open, vented once it closes)
        if (car.throttle > 0) lastBoost = Math.max(lastBoost * 0.99, b);
        else {
          if (!dead && lastBoost > 0.5 && t - lastPsh > 0.6) { psh(lastBoost * (car.spec.engine.turbo.whistle ?? 1)); lastPsh = t; }
          lastBoost = 0;
        }
      } else whineGain.gain.setTargetAtTime(0, t, 0.05);
      const e = car.spec.engine;
      if (synth && synthCfg) {
        synth.port.postMessage({ state: { rpm: car.rpm, throttle: car.throttle, boost: b, on: dead ? 0 : 1, redline: e.redline, idle: e.idle, cut: car.revCut > 0 ? 1 : 0, shift: car.shiftCut ? 1 : 0 } });
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
    // (only the spin beyond the creep of a gripping tyre counts, and only on paving)
    const over = dead || flying || car.surface !== 1 ? 0 : (car.slipV || 0) - 0.2 * Math.max(Math.abs(car.vx), 3) - 1.5;
    spinS += (Math.max(0, Math.min(1, over / 9)) - spinS) * 0.15;
    spinFilt.frequency.setTargetAtTime(680 + 420 * spinS, t, 0.1);
    spinGain.gain.setTargetAtTime(spinS * 0.05, t, 0.08);
  }

  // ---- other players' cars
  // Each voice is the same set of sources as our own car (engine synthesiser, whine, tyre noise) mixed
  // into one chain: a low-pass that dulls it with distance, a delay of the time the sound takes to
  // arrive, a gain that falls with distance and a pan towards where the car is. The delay changing as
  // the car closes or pulls away is the Doppler shift: higher coming at you, dropping as it goes past.
  function makeVoice() {
    const v = { id: null, carId: null, synth: null, cfg: null, skid: 0, spin: 0, lastBoost: 0, lastPsh: 0, d: 0 };
    v.mix = ctx.createGain();
    v.lp = ctx.createBiquadFilter(); v.lp.type = 'lowpass'; v.lp.frequency.value = 8000; v.lp.Q.value = 0.5;
    v.delay = ctx.createDelay(1);
    v.out = ctx.createGain(); v.out.gain.value = 0;
    v.mix.connect(v.lp).connect(v.delay).connect(v.out);
    if (ctx.createStereoPanner) { v.pan = ctx.createStereoPanner(); v.out.connect(v.pan).connect(master); } else v.out.connect(master);
    v.engGain = ctx.createGain(); v.engGain.gain.value = ENGINE_LEVEL; v.engGain.connect(v.mix);
    v.whine = ctx.createOscillator(); v.whine.type = 'sine';
    v.whineGain = ctx.createGain(); v.whineGain.gain.value = 0;
    v.whine.connect(v.whineGain).connect(v.mix); v.whine.start();
    v.tyreFilt = ctx.createBiquadFilter(); v.tyreFilt.type = 'bandpass'; v.tyreFilt.frequency.value = 1300; v.tyreFilt.Q.value = 5;
    v.tyreGain = ctx.createGain(); v.tyreGain.gain.value = 0;
    noiseSrc.connect(v.tyreFilt).connect(v.tyreGain).connect(v.mix);
    v.spinFilt = ctx.createBiquadFilter(); v.spinFilt.type = 'bandpass'; v.spinFilt.frequency.value = 800; v.spinFilt.Q.value = 6;
    v.spinGain = ctx.createGain(); v.spinGain.gain.value = 0;
    noiseSrc.connect(v.spinFilt).connect(v.spinGain).connect(v.mix);
    voices.push(v);
    return v;
  }
  function release(v) {
    const t = ctx.currentTime;
    v.id = null;
    v.out.gain.setTargetAtTime(0, t, 0.08);
    if (v.synth) v.synth.port.postMessage({ state: { on: 0 } });
  }
  function bind(v, r, d) {
    const t = ctx.currentTime;
    v.id = r.id; v.carId = r.spec.id; v.skid = v.spin = v.lastBoost = 0;
    v.ev = r.spec.engine.type === 'ev';
    v.cfg = v.ev ? null : ENGINE_SOUNDS[r.spec.id] || null;
    if (v.cfg && workletReady && !v.synth) {
      try {
        v.synth = new AudioWorkletNode(ctx, 'engine-sound', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
        v.synth.connect(v.engGain);
      } catch { v.synth = null; }
    }
    if (v.synth) v.synth.port.postMessage(v.cfg ? { config: v.cfg, state: { on: 0 } } : { state: { on: 0 } });
    // start silent and already at the right delay, so a car coming into earshot does not sweep in
    v.out.gain.cancelScheduledValues(t); v.out.gain.setValueAtTime(0, t);
    v.delay.delayTime.cancelScheduledValues(t); v.delay.delayTime.setValueAtTime(Math.min(0.95, d / SOUND), t);
    v.d = d;
  }
  function drive(v, r, d, pan) {
    const t = ctx.currentTime, s = r.spec, e = s.engine;
    // a jump across the map is not a car passing by: no pitch sweep for it
    if (Math.abs(d - v.d) > 25) { v.delay.delayTime.cancelScheduledValues(t); v.delay.delayTime.setValueAtTime(Math.min(0.95, d / SOUND), t); }
    else v.delay.delayTime.setTargetAtTime(Math.min(0.95, d / SOUND), t, 0.07);
    v.d = d;
    const fade = Math.max(0, Math.min(1, (HEAR - d) / 70));
    v.out.gain.setTargetAtTime(Math.pow(Math.min(1, REF / d), 0.8) * fade, t, 0.06);
    v.lp.frequency.setTargetAtTime(700 + 11000 * Math.min(1, 14 / d), t, 0.1);
    if (v.pan) v.pan.pan.setTargetAtTime(pan, t, 0.06);
    const speed = Math.hypot(r.vx, r.vy), vw = speed + r.slipV, b = r.boost;
    if (v.ev) {
      v.whine.frequency.setTargetAtTime(180 + vw * 38, t, 0.05);
      v.whineGain.gain.setTargetAtTime(Math.min(0.05, 0.004 + vw * 0.0012) * (0.5 + r.throttle * 0.5), t, 0.08);
    } else {
      if (e.turbo) {
        const wh = e.turbo.whistle ?? 1;
        v.whine.frequency.setTargetAtTime(1400 + r.rpm * 0.35 * (0.4 + 0.6 * b), t, 0.08);
        v.whineGain.gain.setTargetAtTime(0.016 * b * b * wh, t, 0.08);
        if (r.throttle > 0.02) v.lastBoost = Math.max(v.lastBoost * 0.99, b);
        else {
          if (v.lastBoost > 0.5 && t - v.lastPsh > 0.6) { psh(v.lastBoost * wh, v.mix); v.lastPsh = t; }
          v.lastBoost = 0;
        }
      } else v.whineGain.gain.setTargetAtTime(0, t, 0.05);
      if (v.synth && v.cfg) v.synth.port.postMessage({ state: { rpm: Math.max(r.rpm, e.idle * 0.8), throttle: r.throttle, boost: b, on: 1, redline: e.redline, idle: e.idle, cut: r.revCut ? 1 : 0, shift: 0 } });
    }
    const k = r.paved ? Math.max(r.skidF, r.skidR) : 0;
    v.skid += (k - v.skid) * 0.2;
    v.tyreFilt.frequency.setTargetAtTime(1050 + Math.min(speed, 35) * 16, t, 0.08);
    v.tyreGain.gain.setTargetAtTime(Math.max(0, v.skid - 0.15) * 0.07, t, 0.07);
    const over = r.paved ? r.slipV - 0.2 * Math.max(Math.abs(r.vx), 3) - 1.5 : 0;
    v.spin += (Math.max(0, Math.min(1, over / 9)) - v.spin) * 0.15;
    v.spinFilt.frequency.setTargetAtTime(680 + 420 * v.spin, t, 0.1);
    v.spinGain.gain.setTargetAtTime(v.spin * 0.05, t, 0.08);
  }
  // list: other players' cars (multiplayer.js remotes()); cam: the camera, which is where the ears are
  const near = [];
  function updateRemotes(list, cam, active) {
    if (!ctx || !noiseSrc) return;
    near.length = 0;
    const c = cam.position;
    if (active && ctx.state === 'running') for (const r of list) {
      if (!r.tyres || r.inWater) continue;
      const d = Math.hypot(r.x - c.x, r.y + 0.5 - c.y, r.z - c.z);
      if (d < HEAR) near.push({ r, d });
    }
    near.sort((a, b) => a.d - b.d);
    if (near.length > VOICES) near.length = VOICES;
    for (const v of voices) if (v.id !== null && !near.some((n) => n.r.id === v.id)) release(v);
    const m = cam.matrixWorld.elements;                            // (its first column is the camera's right)
    for (const { r, d } of near) {
      let v = voices.find((x) => x.id === r.id);
      if (v && v.carId !== r.spec.id) { release(v); v = null; }
      if (!v) {
        v = voices.find((x) => x.id === null) || (voices.length < VOICES ? makeVoice() : null);
        if (!v) continue;
        bind(v, r, d);
      }
      const dd = Math.max(d, 0.5);
      const side = ((r.x - c.x) * m[0] + (r.y + 0.5 - c.y) * m[1] + (r.z - c.z) * m[2]) / dd;
      drive(v, r, dd, Math.max(-0.85, Math.min(0.85, side * 0.85 * Math.min(1, d / 4))));
    }
  }

  // short two-note chime for someone joining (rising) or leaving (falling, softer and lower)
  function chime(kind) {
    if (!ctx || ctx.state !== 'running') return;
    const join = kind === 'join';
    const notes = join ? [659.25, 987.77] : [783.99, 523.25];     // E5 -> B5, G5 -> C5
    const t0 = ctx.currentTime + 0.01, level = join ? 0.16 : 0.12;
    notes.forEach((f, i) => {
      const t = t0 + i * 0.11;
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain();
      o.type = join ? 'sine' : 'triangle'; o.frequency.value = f;
      o2.type = 'sine'; o2.frequency.value = f * 2.005;           // a little shimmer an octave up
      g2.gain.value = join ? 0.25 : 0.12;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0008, t + (i ? 0.42 : 0.2));
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
      o.start(t); o2.start(t); o.stop(t + 0.45); o2.stop(t + 0.45);
    });
  }

  // disc golf putts on the Sireli lawn: 'chains' (the disc rattles into the chains and drops into the cage),
  // 'clang' (it glances off the cage or the top band), 'thud' (it lands on the grass). level 0..1 by distance.
  function putt(kind, level = 1) {
    if (!ctx || ctx.state !== 'running' || !noiseBuf) return;
    const t0 = ctx.currentTime + 0.01, out = ctx.createGain();
    out.gain.value = Math.min(1, level) * 0.9;
    out.connect(master);
    const burst = (t, dur, type, freq, q, gain) => {
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf; src.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
      src.connect(f); f.connect(g); g.connect(out);
      src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.02);
    };
    const ring = (t, freq, dur, gain, type = 'sine') => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + dur + 0.02);
    };
    if (kind === 'chains') {
      // many small links struck one after another: short bright rings over a hiss, then the disc dropping into the cage
      burst(t0, 0.32, 'bandpass', 5200, 0.9, 0.5);
      for (let k = 0; k < 14; k++) ring(t0 + Math.random() * 0.14 + (k > 9 ? 0.12 : 0), 2100 + Math.random() * 5200, 0.12 + Math.random() * 0.34, 0.05 + Math.random() * 0.05);
      burst(t0 + 0.3, 0.09, 'lowpass', 420, 0.7, 0.45);
      for (const f of [640, 1010]) ring(t0 + 0.3, f * (0.97 + Math.random() * 0.06), 0.16, 0.05);
    } else if (kind === 'clang') {
      burst(t0, 0.05, 'bandpass', 2600, 0.8, 0.5);
      for (const [f, d, g] of [[410, 0.55, 0.16], [873, 0.5, 0.13], [1492, 0.4, 0.1], [2377, 0.3, 0.07], [3310, 0.2, 0.05]]) ring(t0, f * (0.96 + Math.random() * 0.08), d, g);
    } else {
      burst(t0, 0.13, 'lowpass', 240, 0.7, 0.7);
      burst(t0 + 0.02, 0.22, 'highpass', 3200, 0.5, 0.06);
    }
  }

  return {
    start, update, updateRemotes, chime, putt,
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
    // (for tests: which other cars have a voice, how far off they are and how loud)
    get remoteVoices() { return voices.filter((v) => v.id !== null).map((v) => ({ id: v.id, car: v.carId, d: v.d, gain: v.out.gain.value, delay: v.delay.delayTime.value, pan: v.pan?.pan.value, synth: !!v.synth, node: v.out })); },
  };
}
