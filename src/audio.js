// Synthesised engine / wind sound. Starts on the first user gesture.
// Everything the car itself makes (engine, turbo, tyres, knocks) goes into one bus that runs through the
// space around it (src/audio-space.js: echoes off the buildings nearby, an outdoor reverb, compression);
// the wind is at the ears and stays out of it. The electric cars stay out of it too (Martin 2026-11-19: they
// do not need it): their motor whine and tyres sound as they did before it.
// Combustion engines run through the engine synthesiser worklet (public/engine-worklet.js, tuned per car
// in src/engine-sounds.js); the old two-oscillator buzz stays as the fallback where worklets are missing.
import { ENGINE_SOUNDS } from './engine-sounds.js';
import { createSpace, chaseBack, revRoom } from './audio-space.js';
import { blowOff, shiftBlowOff } from './audio-turbo.js';
import { createShiftSound, clunk, chirp } from './audio-shift.js';
import { createSqueal, createGravel, loadTyreWorklet, setSquealKind, squealKind, EV_SQUEAL_TRIM } from './audio-tyres.js';

const ENGINE_LEVEL = 0.4;
// Other players' cars: the nearest few get a voice each (engine, motor whine, turbo, tyres), placed by
// distance and direction from the camera.
const VOICES = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 2 : 3;
// setLite(true), from the graphics auto mode on a machine that can't keep up: no echoes or reverb
// (the plain engine sound) and only the nearest other car is heard
let lite = false;
const HEAR = 240;          // metres: further off than this a car is silent
const REF = 7;             // metres: at this distance another car is as loud as our own
const SOUND = 343;         // m/s: the sound arrives late by distance / SOUND, which is also what bends its pitch
// wheelspin howl: its gain at full spin (tools/engine-space-demo.mjs --tyres renders it in a burnout and donuts)
export const SPIN_LEVEL = 0.55;
// how hard the tyres spin, 0..1: only the spin beyond the creep of a gripping tyre counts (the callers
// leave out loose ground, the air and a dead engine)
export function spinAmount(c) {
  const over = (c.slipV || 0) - 0.2 * Math.max(Math.abs(c.vx), 3) - 1.5;
  return Math.max(0, Math.min(1, over / 9));
}

export function createAudio() {
  let ctx = null, master, engGain, osc1, osc2, filt, windGain, windFilt, windLp, whine, whineGain, skidGain, skidFilt, spinGain, spinFilt;
  let jetGain, jetLow, jetS = 0, jetR = 0, wasFlight = false;   // a Rocket's nozzles (src/cars/thrust.js)
  let fan = null, fanS = 0;   // a fan car's suction fans (spec.fanDown): made when such a car is first driven
  let skid = 0, spinS = 0, lastLanded = 0, lastKerb = 0, noiseBuf = null, lastBoost = 0, lastPsh = 0, boostSince = -1, airArmed = false, wasShift = false;
  let muted = false, ev = false, turbo = false, background = false;
  let notify = true;   // the chimes (someone joins or leaves, a lap record, a race call): OPTIONS > SOUND > NOTIFICATIONS
  let bus = null, space = null;
  let synth = null, synthGain = null, synthCfg = null, carId = null, punch = null, growl = 0, room = 0, roomGear = 0, roomDown = 0;
  let noiseSrc = null, workletReady = false, squeal = null, gravel = null, looseS = 0;
  const voices = [];
  const shiftSound = createShiftSound();

  function start() {
    if (ctx) { ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    space = createSpace(ctx, master);
    applySpace();
    bus = space.input;

    filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 500; filt.Q.value = 1.2;
    engGain = ctx.createGain(); engGain.gain.value = 0;
    osc1 = ctx.createOscillator(); osc1.type = 'sawtooth';
    osc2 = ctx.createOscillator(); osc2.type = 'square';
    const g2 = ctx.createGain(); g2.gain.value = 0.45;
    osc1.connect(filt); osc2.connect(g2).connect(filt); filt.connect(engGain).connect(bus);
    osc1.start(); osc2.start();
    loadSynth();

    whine = ctx.createOscillator(); whine.type = 'sine';
    whineGain = ctx.createGain(); whineGain.gain.value = 0;
    whine.connect(whineGain).connect(bus); whine.start();

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
    noise.connect(skidFilt).connect(skidGain).connect(bus);
    // wheelspin: the thin howl of a tyre spinning on paving, kept well under the engine
    spinFilt = ctx.createBiquadFilter(); spinFilt.type = 'bandpass'; spinFilt.frequency.value = 800; spinFilt.Q.value = 6;
    spinGain = ctx.createGain(); spinGain.gain.value = 0;
    noise.connect(spinFilt).connect(spinGain).connect(bus);
    // a Rocket's nozzles: the hiss of cold gas, and under it the rush of the four big ones at the tail
    const jetF = ctx.createBiquadFilter(); jetF.type = 'bandpass'; jetF.frequency.value = 3200; jetF.Q.value = 0.35;
    jetGain = ctx.createGain(); jetGain.gain.value = 0;
    noise.connect(jetF).connect(jetGain).connect(bus);
    // (the rush is what BOOST sounds like for as long as it is held: a wide roar from 150 Hz up to the hiss, loud
    // enough to stay over the wind and the motors' whine at any speed, measured at the loudspeaker, and never
    // quite steady, as a jet of gas tearing at still air is not)
    const jetL = ctx.createBiquadFilter(); jetL.type = 'bandpass'; jetL.frequency.value = 420; jetL.Q.value = 0.35;
    const jetM = ctx.createBiquadFilter(); jetM.type = 'bandpass'; jetM.frequency.value = 1300; jetM.Q.value = 0.5;
    const jetMg = ctx.createGain(); jetMg.gain.value = 0.55;
    jetLow = ctx.createGain(); jetLow.gain.value = 0;
    const jetFl = ctx.createGain(); jetFl.gain.value = 1;
    for (const [hz, depth] of [[6.3, 0.1], [10.9, 0.07], [17.2, 0.05]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = hz; g.gain.value = depth;
      o.connect(g).connect(jetFl.gain); o.start();
    }
    noise.connect(jetL).connect(jetLow); noise.connect(jetM).connect(jetMg).connect(jetLow);
    jetLow.connect(jetFl).connect(bus);
    // and over it the tyres sing: one long squeal that follows the wheel spin (src/audio-tyres.js; V switches
    // between the held note and the modelled squeal of public/tyre-worklet.js)
    loadTyreWorklet(ctx, `${import.meta.env.BASE_URL}tyre-worklet.js`);
    squeal = createSqueal(ctx, noise, bus);
    // and on loose ground, stones in the arches and the tread digging in (src/audio-tyres.js createGravel)
    gravel = createGravel(ctx, bus);
    noise.start();
    noiseSrc = noise;
  }

  function loadSynth() {
    if (!ctx.audioWorklet || typeof AudioWorkletNode !== 'function') return;
    ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}engine-worklet.js`).then(() => {
      workletReady = true;
      synth = new AudioWorkletNode(ctx, 'engine-sound', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
      synthGain = ctx.createGain(); synthGain.gain.value = ENGINE_LEVEL;
      synth.connect(synthGain).connect(bus);
      // (a gear change's blip and bark also go round the compressor, so they hit: src/audio-shift.js)
      punch = ctx.createGain(); punch.gain.value = 0;
      synthGain.connect(punch).connect(space.burst);
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
    o.connect(g).connect(bus);
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
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + 0.16);
    if (!noiseBuf) return;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    src.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.2;
    gn.gain.setValueAtTime(Math.min(0.06, 0.045 * strength), t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    src.connect(f).connect(gn).connect(bus);
    src.start(t, Math.random()); src.stop(t + 0.08);
  }

  // a car into a bus shelter: the clang of the bent frame, and with `panes` broken the burst of glass and
  // the tinkle of the pieces landing (level 0..1.5 from how hard the hit was)
  function smash(panes, level = 1) {
    if (!ctx || ctx.state !== 'running' || !noiseBuf) return;
    const t = ctx.currentTime + 0.005, L = Math.max(0.2, Math.min(1.5, level));
    {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(170, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.25);
      g.gain.setValueAtTime(0.28 * L, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g).connect(bus);
      o.start(t); o.stop(t + 0.32);
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
      src.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 5;
      gn.gain.setValueAtTime(0.5 * L, t);
      gn.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      src.connect(f).connect(gn).connect(bus);
      src.start(t, Math.random()); src.stop(t + 0.5);
    }
    if (!panes) return;
    const G = Math.min(1, 0.6 + 0.2 * panes) * L;
    {
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
      src.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 2600;
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(0.45 * G, t + 0.008);
      gn.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      src.connect(f).connect(gn).connect(bus);
      src.start(t, Math.random()); src.stop(t + 0.4);
    }
    const n = 10 + 8 * panes;
    for (let k = 0; k < n; k++) {
      const at = t + 0.03 + Math.random() ** 1.6 * 0.9, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 2800 + Math.random() * 4200;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.05 * G * (0.4 + Math.random()), at + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05 + Math.random() * 0.07);
      o.connect(g).connect(bus);
      o.start(at); o.stop(at + 0.14);
    }
  }

  // a wooden picket fence knocked down (src/world/breakfence.js; Martin 2026-11-22: a slight breaking sound):
  // 'snap' the dry crack of the panel tearing off its posts, a few splinters and the hollow knock of the
  // boards; 'land' the soft clack of a panel hitting the pavement. level 0..1.3 from the speed.
  function wood(kind, level = 1) {
    if (!ctx || ctx.state !== 'running' || !noiseBuf) return;
    const t = ctx.currentTime + 0.005, L = Math.max(0.15, Math.min(1.3, level));
    const burst = (at, dur, type, freq, q, gain) => {
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(gain, at + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      src.connect(f).connect(g).connect(bus);
      src.start(at, Math.random()); src.stop(at + dur + 0.02);
    };
    const knockAt = (at, f0, f1, dur, gain) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f0, at);
      o.frequency.exponentialRampToValueAtTime(f1, at + dur);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(gain, at + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(bus);
      o.start(at); o.stop(at + dur + 0.02);
    };
    if (kind === 'snap') {
      burst(t, 0.07, 'bandpass', 2100 + Math.random() * 500, 1.3, 0.2 * L);          // the crack
      knockAt(t, 260 + Math.random() * 60, 150, 0.09, 0.09 * L);                      // the boards
      const n = 3 + Math.round(2 * L);
      for (let k = 0; k < n; k++) burst(t + 0.015 + Math.random() ** 1.5 * 0.16, 0.012 + Math.random() * 0.012, 'bandpass', 2800 + Math.random() * 2600, 3, (0.04 + Math.random() * 0.05) * L);
    } else {
      burst(t, 0.04, 'bandpass', 900 + Math.random() * 300, 2, 0.06 * L);
      knockAt(t, 330 + Math.random() * 80, 210, 0.06, 0.04 * L);
    }
  }

  // how hard a Rocket's nozzles blow, as two levels: all of them (1 = the four big ones wide open, or the four
  // under the floor) and the big four alone
  const jetOut = [0, 0];
  const JET_RUSH = 0.5, JET_HISS = 0.03;   // the big four wide open: their roar, and what they add to the hiss
  function jetLevels(noz) {
    let rear = 0, rest = 0;
    if (noz) for (let i = 0; i < noz.length; i++) { if (i < 4) rear += noz[i]; else rest += noz[i]; }
    jetOut[0] = Math.min(1.3, rear / 4 + rest / 4); jetOut[1] = rear / 4;
    return jetOut;
  }
  // Suction fans under the floor (spec.fanDown): they turn all the time, so the car is never silent. Four fans a
  // hair apart in speed beat against each other (the whir), and the air they pull through the floor hisses. They
  // idle with the car at rest and run up with the pedal or the speed (FAN_UP s to follow).
  const FAN_TONE = 0.035, FAN_AIR = 0.11, FAN_UP = 0.3;   // (quieter since 26 Nov, Martin: "reduce the default fan sound": 3 dB down run up, 7 dB down idling)
  function makeFan() {
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.9;
    const air = ctx.createGain(); air.gain.value = 0;
    noiseSrc.connect(f).connect(air).connect(bus);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300; lp.Q.value = 0.5;
    const tone = ctx.createGain(); tone.gain.value = 0;
    const osc = [1, 1.017, 0.989, 1.5].map((k, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; g.gain.value = i < 3 ? 1 : 0.35;
      o.connect(g).connect(lp); o.start();
      return [o, k];
    });
    lp.connect(tone).connect(bus);
    return { f, air, tone, osc };
  }
  function fanSound(car, dead, v) {
    const want = dead || !car.spec.fanDown || car.fanOff ? 0 : 0.5 + 0.5 * Math.max(car.throttle, Math.min(1, v / 14));
    if (Math.abs(want - fanS) < 0.01 && (want > 0 || fanS === 0)) return;
    if (!fan) { if (!noiseSrc) return; fan = makeFan(); }
    // (switched off by the driver they run down, heard; a car left or wrecked is cut)
    const t = ctx.currentTime, on = want > 0, k = on ? want : fanS, tc = on ? FAN_UP : car.fanOff && !dead ? 0.45 : 0.08;
    fanS = want;
    for (const [o, r] of fan.osc) o.frequency.setTargetAtTime((120 + 260 * k) * r, t, tc);
    fan.f.frequency.setTargetAtTime(450 + 700 * k, t, tc);
    fan.tone.gain.setTargetAtTime(on ? FAN_TONE * Math.pow(k, 2) : 0, t, tc);
    fan.air.gain.setTargetAtTime(on ? FAN_AIR * Math.pow(k, 2) : 0, t, tc);
  }
  // the valves snapping open for a kickflip's lift-off: a short hard burst
  function jetPop(out, level) {
    const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 0.5;
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(2800, t + 0.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3 * level, t + 0.015);
    g.gain.setTargetAtTime(0.0001, t + 0.12, 0.08);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random()); src.stop(t + 0.6);
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
    src.connect(f).connect(g).connect(bus);
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
      // turbos whistle as they spool, rising in pitch with boost and revs (inside the engine synthesiser;
      // the oscillator is only for browsers without it), and vent their boost when the throttle shuts
      const b = car.boost || 0;
      if (turbo) {
        const tb = car.spec.engine.turbo;
        whine.frequency.setTargetAtTime(1400 + car.rpm * 0.35 * (0.4 + 0.6 * b), t, 0.08);
        whineGain.gain.setTargetAtTime(dead || (synth && synthCfg) ? 0 : 0.016 * b * b * (tb.whistle ?? 1), t, 0.08);
        // (lastBoost: the boost built while the throttle was open, vented once it closes)
        // (boostSince: when it last came on boost, so an upshift knows how long it pulled)
        if (b > 0.6) { if (boostSince < 0) boostSince = t; } else boostSince = -1;
        if (car.throttle > 0) {
          lastBoost = Math.max(lastBoost * 0.99, b);
          // (an upshift: the driver lifts for the change and the valve vents, in the gap before the gear bites)
          if (car.shiftCut && !wasShift && !dead && shiftBlowOff(ctx, noiseBuf, space.burst, b, tb.bov,
            { held: boostSince < 0 ? 0 : t - boostSince, rev: car.rpm / car.spec.engine.redline })) lastPsh = t;
        } else {
          if (!dead && lastBoost > 0.3 && t - lastPsh > 0.4) { blowOff(ctx, noiseBuf, space.burst, lastBoost, tb.bov); lastPsh = t; }
          lastBoost = 0;
        }
        wasShift = !!car.shiftCut;
      } else whineGain.gain.setTargetAtTime(0, t, 0.05);
      const e = car.spec.engine;
      // a downshift blips, crackles and clunks, an upshift barks as it bites; too far down by hand, the
      // engine is dragged over its limit
      const sh = shiftSound.step(car, t);
      // (seen as well as heard: smoke.js lights a flame at the tailpipe of a car with spec.exhaust.flame)
      car.exhaustPop = dead ? 0 : sh.crackle * Math.max(0, Math.min(1, (sh.rpm - 2500) / 3000));
      // (the room the revs add round the engine near its limiter, but not round a gear change: updateSpace)
      room = dead ? 0 : revRoom(sh.rpm, e.redline); roomGear = sh.gear; roomDown = sh.down;
      if (sh.clunk && !dead) clunk(ctx, noiseBuf, sh.clunk.up ? space.burst : bus, sh.clunk.k, t + 0.005 + sh.clunk.after, sh.clunk.up);
      if (sh.chirp && !dead) chirp(ctx, noiseBuf, bus, sh.chirp, t + 0.005);
      if (punch) punch.gain.setTargetAtTime(dead ? 0 : sh.punch, t, 0.01);
      if (synth && synthCfg) {
        synth.port.postMessage({ state: { rpm: sh.rpm, throttle: sh.throttle, boost: b, shaft: car.shaft || 0, on: dead ? 0 : 1, redline: e.redline, idle: e.idle, cut: car.revCut > 0 ? 1 : 0, shift: sh.shift ? 1 : 0, blip: sh.blip, crackle: sh.crackle, over: sh.over, bark: sh.bark, yank: sh.yank, yankId: sh.yankId, yankTight: sh.yankTight, growl } });
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
    fanSound(car, dead, v);
    // a Rocket's nozzles (told only while they change), the burst of a lift-off and the tyres meeting the road again
    const jl = jetLevels(dead ? null : car.rocket?.noz);
    if (jl[0] !== jetS || jl[1] !== jetR) {
      jetS = jl[0]; jetR = jl[1];
      jetGain.gain.setTargetAtTime(Math.pow(jetS, 0.7) * 0.13 + jetR * JET_HISS, t, 0.03);
      jetLow.gain.setTargetAtTime(jetR * JET_RUSH, t, 0.04);
    }
    const inFlight = !!car.rocket?.flight;
    if (inFlight !== wasFlight) { wasFlight = inFlight; if (!dead && noiseBuf) { if (inFlight) jetPop(bus, 1); else thump(2.2); } }
    // only on paving, and only audible once the slide is well under way
    const k = dead || car.surface !== 1 ? 0 : Math.max(car.skidF || 0, car.skidR || 0);
    skid += (k - skid) * 0.2;
    skidFilt.frequency.setTargetAtTime(1050 + Math.min(v, 35) * 16, t, 0.08);
    skidGain.gain.setTargetAtTime(Math.max(0, skid - 0.15) * 0.07, t, 0.07);
    // (only on paving)
    spinS += ((dead || flying || car.surface !== 1 ? 0 : spinAmount(car)) - spinS) * 0.15;
    spinFilt.frequency.setTargetAtTime(680 + 420 * spinS, t, 0.1);
    spinGain.gain.setTargetAtTime(spinS * SPIN_LEVEL, t, 0.08);
    // the squeal, at the speed the tread slides over the road (wheel speed less ground speed)
    squeal.setTrim(ev ? EV_SQUEAL_TRIM : 1);
    squeal.step(t, spinS, car.slipV || 0, skid, v, car.spec.mass);
    // wheelspin on gravel, dirt and grass: the same spin, on loose ground and with the wheels down
    looseS += ((dead || flying || car.surface === 1 || car.surface === 4 ? 0 : spinAmount(car)) - looseS) * 0.15;
    gravel.step(t, looseS, car.slipV || 0, dead || flying ? 0 : v, car.surface);
  }

  // ---- other players' cars
  // Each voice is the same set of sources as our own car (engine synthesiser, whine, tyre noise) mixed
  // into one chain: a low-pass that dulls it with distance, a delay of the time the sound takes to
  // arrive, a gain that falls with distance and a pan towards where the car is. The delay changing as
  // the car closes or pulls away is the Doppler shift: higher coming at you, dropping as it goes past.
  function makeVoice() {
    const v = { id: null, carId: null, synth: null, cfg: null, skid: 0, spin: 0, lastBoost: 0, lastPsh: 0, d: 0, at: -1 };
    v.mix = ctx.createGain();
    v.lp = ctx.createBiquadFilter(); v.lp.type = 'lowpass'; v.lp.frequency.value = 8000; v.lp.Q.value = 0.5;
    v.delay = ctx.createDelay(1);
    v.out = ctx.createGain(); v.out.gain.value = 0;
    v.mix.connect(v.lp).connect(v.delay).connect(v.out);
    if (ctx.createStereoPanner) { v.pan = ctx.createStereoPanner(); v.out.connect(v.pan).connect(master); } else v.out.connect(master);
    // (and into the reverb, which falls off slower than the car itself: a car far off sounds roomier)
    v.rev = ctx.createGain(); v.rev.gain.value = 0;
    v.out.connect(v.rev).connect(space.remoteIn);
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
    v.squeal = createSqueal(ctx, noiseSrc, v.mix, { voices: 1 });
    v.gravel = createGravel(ctx, v.mix); v.loose = 0;
    v.jet = 0; v.jetGain = null;                                 // (a Rocket's nozzles: made when one is first heard)
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
    if (v.jetGain) { v.jetGain.gain.setTargetAtTime(0, t, 0.03); v.jet = 0; }
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
    v.rev.gain.setTargetAtTime(v.ev ? 0 : 0.245 * Math.min(3, Math.pow(Math.max(1, d / REF), 0.45)), t, 0.2);
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
        v.whineGain.gain.setTargetAtTime(v.synth && v.cfg ? 0 : 0.016 * b * b * wh, t, 0.08);
        if (r.throttle > 0.02) v.lastBoost = Math.max(v.lastBoost * 0.99, b);
        else {
          if (v.lastBoost > 0.3 && t - v.lastPsh > 0.4) { blowOff(ctx, noiseBuf, v.mix, v.lastBoost, e.turbo.bov); v.lastPsh = t; }
          v.lastBoost = 0;
        }
      } else v.whineGain.gain.setTargetAtTime(0, t, 0.05);
      if (v.synth && v.cfg) v.synth.port.postMessage({ state: { rpm: Math.max(r.rpm, e.idle * 0.8), throttle: r.throttle, boost: b, on: 1, redline: e.redline, idle: e.idle, cut: r.revCut ? 1 : 0, shift: 0 } });
    }
    // a Rocket's nozzles: the hiss, and the burst when it lifts off
    const jet = r.noz ? jetLevels(r.noz)[0] : 0;
    if (jet !== v.jet) {
      if (!v.jetGain) {
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.3;
        v.jetGain = ctx.createGain(); v.jetGain.gain.value = 0;
        noiseSrc.connect(f).connect(v.jetGain).connect(v.mix);
      }
      if (jet > 0.6 && v.jet < 0.2 && r.noz[4] > 0.5 && noiseBuf) jetPop(v.mix, 1);
      v.jet = jet;
      v.jetGain.gain.setTargetAtTime(Math.pow(jet, 0.7) * 0.22, t, 0.04);
    }
    const k = r.paved ? Math.max(r.skidF, r.skidR) : 0;
    v.skid += (k - v.skid) * 0.36;                              // (as 0.2 a frame at 60, now called 30 times a second)
    v.tyreFilt.frequency.setTargetAtTime(1050 + Math.min(speed, 35) * 16, t, 0.08);
    v.tyreGain.gain.setTargetAtTime(Math.max(0, v.skid - 0.15) * 0.07, t, 0.07);
    v.spin += ((r.paved ? spinAmount(r) : 0) - v.spin) * 0.28;
    v.spinFilt.frequency.setTargetAtTime(680 + 420 * v.spin, t, 0.1);
    v.spinGain.gain.setTargetAtTime(v.spin * SPIN_LEVEL, t, 0.08);
    v.squeal.setTrim(v.ev ? EV_SQUEAL_TRIM : 1);
    v.squeal.step(t, v.spin, r.slipV || 0, v.skid, speed, s.mass);
    v.loose += ((r.paved || r.ground == null ? 0 : spinAmount(r)) - v.loose) * 0.28;
    v.gravel.step(t, v.loose, r.slipV || 0, speed, r.ground ?? 1);
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
    if (near.length > (lite ? 1 : VOICES)) near.length = lite ? 1 : VOICES;
    for (const v of voices) if (v.id !== null && !near.some((n) => n.r.id === v.id)) release(v);
    const m = cam.matrixWorld.elements;                            // (its first column is the camera's right)
    for (const { r, d } of near) {
      let v = voices.find((x) => x.id === r.id);
      if (v && v.carId !== r.spec.id) { release(v); v = null; }
      if (!v) {
        v = voices.find((x) => x.id === null) || (voices.length < VOICES ? makeVoice() : null);
        if (!v) continue;
        bind(v, r, d);
        v.at = -1;
      }
      // (thirty times a second is plenty for a car going by, its changes all glide: each change to a sound is a
      // word to the sound thread, some fifteen a car, and with many online they came in bunches that hitched)
      if (ctx.currentTime - v.at < 0.03) continue;
      v.at = ctx.currentTime;
      const dd = Math.max(d, 0.5);
      const side = ((r.x - c.x) * m[0] + (r.y + 0.5 - c.y) * m[1] + (r.z - c.z) * m[2]) / dd;
      drive(v, r, dd, Math.max(-0.85, Math.min(0.85, side * 0.85 * Math.min(1, d / 4))));
    }
  }

  // a thumbs up for us (src/kudos.js, Martin 2026-11-24: "a very airy 7 chord synth sound"): Dmaj9 spread
  // wide, D4 A4 C#5 F#5 E6, each a soft sine pair a few cents apart (slow beating, the air), notes coming in
  // one after another, a slow swell and a two-second tail, softened by a low-pass. 10 oscillators, 2.8 s.
  function airy() {
    const t0 = ctx.currentTime + 0.02, out = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.3;
    out.gain.value = 0.9; lp.connect(out); out.connect(master);
    [293.66, 440, 554.37, 739.99, 1318.51].forEach((f, i) => {
      const t = t0 + i * 0.045, g = ctx.createGain(), level = i === 4 ? 0.026 : 0.045;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level, t + 0.28);
      g.gain.exponentialRampToValueAtTime(0.0004, t + 2.7);
      for (const d of [-4, 4]) {
        const o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = f; o.detune.value = d;
        o.connect(g); o.start(t); o.stop(t + 2.8);
      }
      g.connect(lp);
    });
  }

  // short two-note chime for someone joining (rising) or leaving (falling, softer and lower)
  function chime(kind) {
    if (!notify || !ctx || ctx.state !== 'running') return;
    if (kind === 'kudos') { airy(); return; }
    const join = kind === 'join' || kind === 'record';
    // join: E5 -> B5, leave: G5 -> C5, record (someone set a lap record): C6 E6 G6 C7
    const notes = kind === 'record' ? [1046.5, 1318.5, 1568, 2093] : join ? [659.25, 987.77] : [783.99, 523.25];
    const t0 = ctx.currentTime + 0.01, level = join ? 0.16 : 0.12;
    notes.forEach((f, i) => {
      const t = t0 + i * (kind === 'record' ? 0.08 : 0.11);
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain();
      o.type = join ? 'sine' : 'triangle'; o.frequency.value = f;
      o2.type = 'sine'; o2.frequency.value = f * 2.005;           // a little shimmer an octave up
      g2.gain.value = join ? 0.25 : 0.12;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0008, t + (i === notes.length - 1 ? 0.42 : 0.2));
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
      o.start(t); o2.start(t); o.stop(t + 0.45); o2.stop(t + 0.45);
    });
  }

  // the start lights' beeps (Martin 24 Nov: "perhaps beeps would be good" at the Raadi start): a short pip for
  // each counted second and a longer, higher one at green, like a rally start clock. Game sound, so it follows
  // the sound switch (through master), not the notifications one.
  function beep(kind) {
    if (!ctx || ctx.state !== 'running') return;
    const go = kind === 'go', t = ctx.currentTime + 0.005, len = go ? 0.5 : 0.13;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = go ? 1320 : 880;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07, t + 0.006);
    g.gain.setValueAtTime(0.07, t + len - 0.03);
    g.gain.linearRampToValueAtTime(0, t + len);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + len + 0.02);
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

  // echoes, reverb and compression on our own car unless it is electric; none at all in the lite sound
  function applySpace() { space?.setOn(!lite && !ev, !lite); }
  // the space round our own car: called every frame after the camera has moved (world: its obstacle field)
  function updateSpace(world, car, cam, dt, active) {
    if (!space || ctx.state !== 'running') return;
    // how far off the camera is: the chase camera (6-14 m) hears the car close up, the drone view (C, 35 m
    // and more) from a distance, with much more of the street ringing round it (Martin 2026-11-19); an
    // electric car of ours stays dry either way, other cars' reverb follows the view
    const p = cam.position, dist = Math.hypot(p.x - car.x, p.y - (car.y ?? p.y), p.z - car.z);
    const far = Math.min(1, Math.max(0, (dist - 16) / 16)), back = ev || !active ? 0 : chaseBack(dist, car.spec?.cam);
    // and as the chase camera drops back with speed, a grittier engine (the synthesiser's growl, sent with
    // the next update) and a little more room round it (Martin 2026-11-20; the drone view has its own)
    growl = back * (1 - far);
    if (!active || lite) return;
    space.setFar(far);
    space.setBack(back);
    // and the engine screaming towards its limiter rings round the street more (Martin 2026-11-20)
    space.setRev(ev ? 0 : room, roomGear, roomDown);
    if (!ev) space.update(world, car, cam, dt);
  }

  return {
    start, update, updateRemotes, updateSpace, chime, beep, putt, smash, wood,
    setLite(v) { if (v === lite) return; lite = v; applySpace(); },
    get space() { return space; },
    setCar(spec) {
      ev = spec.engine.type === 'ev'; turbo = !!spec.engine.turbo; lastBoost = 0; shiftSound.reset();
      applySpace();
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
    setNotify(on) { notify = !!on; }, get notify() { return notify; },
    // the tyre squeal: 'note' (the held note) or 'real' (modelled, public/tyre-worklet.js)
    setSquealKind, get squealKind() { return squealKind(); },
    // (for tests: which other cars have a voice, how far off they are and how loud)
    get remoteVoices() { return voices.filter((v) => v.id !== null).map((v) => ({ id: v.id, car: v.carId, d: v.d, gain: v.out.gain.value, delay: v.delay.delayTime.value, pan: v.pan?.pan.value, synth: !!v.synth, node: v.out })); },
  };
}
