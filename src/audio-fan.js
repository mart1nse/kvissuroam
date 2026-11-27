// The Roadster Rocket's suction fans, heard (spec.fanDown): our own car's (audio.js fanSound) and other players'
// (audio.js drive), one set of nodes a car.
//
// Four fans a hair apart in speed beat against each other (the whir), and the air they pull through the floor
// hisses. They idle with the car at rest and run up with the pedal or the speed (FAN_UP s to follow).
//
// Martin 27 Nov: "it gets repetitive and difficult to the ear. it does not have to change for 5 seconds, but then
// some kind of a small variation comes ... sometimes it can change over a long period, perhaps sometimes more
// abruptly or when going over kerbs etc there are some peaks as it loses suction". So, on top of the run-up:
// - a mood every 4 to 9 s: the fans' speeds and the hiss's colour and level move a little, mostly over a second or
//   so, now and then slowly over ten seconds or more, now and then at once (a fan catching another speed), so the
//   beats between them never settle into one rhythm for long;
// - suction lost: a kerb, a bump, a landing, loose ground (gravel, dirt, grass let air in under the skirt, and the
//   fans hold only FAN_LOOSE of their pull there, physics.js) and a flight unload the fans: they spin up and the air
//   rushes in, a peak that settles back as the seal comes back. Off the ground they run high the whole time; on
//   loose ground a little high, with small surges as the floor loses and finds the ground.
// What made it dig into the ear: the four sawtooth fans' upper harmonics beat against each other tens of times a
// second (a rough, grating sound), and the hiss was one 2 s loop of noise heard through one band (a whoosh on
// repeat). Their harmonics are now cut well under 2 kHz, and the hiss is two plays of the noise at rates that never
// line up.
//
// Light: some twenty nodes made once a car, and words to the sound thread only when the run-up changes (as before),
// at a mood (a dozen) and at a surge (four).

export const FAN_TONE = 0.035, FAN_AIR = 0.11, FAN_UP = 0.3;   // (quieter since 26 Nov, Martin: "reduce the default fan sound": 3 dB down run up, 7 dB down idling)
const RATIOS = [1, 1.017, 0.989, 1.5];
// where the whir's harmonics are cut, and how much louder it is made for what that takes away
const TONE_LP = 950, TONE_MAKEUP = 1;                        // the four fans (the last, quieter, a blade note over them)

// the moods: how often (s), and how far they move (cents of the fans' speeds, cents of the hiss's band, dB)
const MOOD_EVERY = [4, 9], MOOD_CENTS = 26, MOOD_SPREAD = 9, MOOD_BAND = 140, MOOD_DB = 1.4;
// suction lost: the most the fans spin up (cents) and the air rises (share of its level) in a peak
const SURGE_CENTS = 150, SURGE_AIR = 0.9;
// where they sit off the ground, and on loose ground (cents, air share), and the small surges a second there at speed
const AIR_UP = [110, 0.25], LOOSE_UP = [30, 0.12], LOOSE_SURGES = 2.2;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const dB = (x) => Math.pow(10, x / 20);

// out: where the sound goes; noiseBuf: a buffer of white noise (audio.js's 2 s); rand: 0..1 (Math.random)
export function createFan(ctx, out, noiseBuf, rand = Math.random) {
  const live = [];
  const soft = ctx.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 1900; soft.Q.value = 0.5;
  soft.connect(out);
  // the air through the floor
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.9;
  const half = ctx.createGain(); half.gain.value = 0.71;
  for (const rate of [0.937, 1.071]) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = rate;
    s.connect(half); s.start(0, rand() * noiseBuf.duration); live.push(s);
  }
  const air = ctx.createGain(); air.gain.value = 0;
  const airMood = ctx.createGain(); airMood.gain.value = 1;
  half.connect(f).connect(air).connect(airMood).connect(soft);
  // the fans' whir
  // (two low-passes: the sawtooths' upper harmonics, where the four fans beat tens of times a second, gone)
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = TONE_LP; lp.Q.value = 0.5;
  const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = TONE_LP; lp2.Q.value = 0.5;
  const tone = ctx.createGain(); tone.gain.value = 0;
  const toneMood = ctx.createGain(); toneMood.gain.value = 1;
  const blade = ctx.createGain(); blade.gain.value = 1;
  const osc = RATIOS.map((k, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; g.gain.value = i < 3 ? 1 : 0.35;
    o.connect(g).connect(i < 3 ? lp : blade); o.start(); live.push(o);
    return [o, k];
  });
  blade.connect(lp);
  lp.connect(lp2).connect(tone).connect(toneMood).connect(soft);
  // what suction lost does, as two signals: the fans' speed in cents (all four, the hiss's band half again as far)
  // and the rise of the air (the whir a third of it)
  let pitch = null, lift = null;
  if (ctx.createConstantSource) {
    pitch = ctx.createConstantSource(); pitch.offset.value = 0; pitch.start(); live.push(pitch);
    for (const [o] of osc) pitch.connect(o.detune);
    const pf = ctx.createGain(); pf.gain.value = 1.5; pitch.connect(pf).connect(f.detune);
    lift = ctx.createConstantSource(); lift.offset.value = 0; lift.start(); live.push(lift);
    lift.connect(airMood.gain);
    const lt = ctx.createGain(); lt.gain.value = 0.35; lift.connect(lt).connect(toneMood.gain);
  }

  let k = 0, last = -1, nextMood = 0, rest = 'ground', surgeAt = -1, surgeJ = 0;
  const spread = [0, 0, 0, 0];

  // a mood: where the fans and the hiss go next, and how fast
  function mood(t) {
    const r = rand();
    let tc, size, hold;
    if (r < 0.2) { tc = 0.04 + 0.1 * rand(); size = 0.8; hold = 1; }        // at once
    else if (r < 0.4) { tc = 4 + 6 * rand(); size = 1.5; hold = 2.2; }      // slowly, over ten seconds and more
    else { tc = 0.6 + 1.2 * rand(); size = 0.7; hold = 1; }                 // a small change
    nextMood = t + hold * (MOOD_EVERY[0] + (MOOD_EVERY[1] - MOOD_EVERY[0]) * rand());
    const common = (rand() * 2 - 1) * MOOD_CENTS * size;
    for (let i = 0; i < osc.length; i++) {
      // (at once: one or two of the fans step, the others stay)
      if (r < 0.2 && rand() < 0.55) continue;
      spread[i] = clamp(spread[i] + (rand() * 2 - 1) * MOOD_SPREAD * size * (r < 0.2 ? 2 : 1), -16, 16);
      osc[i][0].detune.setTargetAtTime(common + spread[i], t, tc);
    }
    f.detune.setTargetAtTime((rand() * 2 - 1) * MOOD_BAND * size, t, tc);
    airMood.gain.setTargetAtTime(dB((rand() * 2 - 1) * MOOD_DB * size), t, tc);
    toneMood.gain.setTargetAtTime(dB((rand() * 2 - 1) * MOOD_DB * size), t, tc);
    blade.gain.setTargetAtTime(0.55 + 0.6 * rand(), t, tc * 1.5);
  }
  const restOf = (w) => (w === 'air' ? AIR_UP : w === 'loose' ? LOOSE_UP : [0, 0]);
  // suction lost a moment (j 0..1): up at once, back as the seal comes back
  function surge(t, j, dip) {
    const [p0, l0] = restOf(rest);
    pitch.offset.cancelScheduledValues(t); lift.offset.cancelScheduledValues(t);
    pitch.offset.setTargetAtTime(dip ? p0 - 30 - 50 * j : p0 + SURGE_CENTS * (0.3 + 0.7 * j), t, 0.025);
    lift.offset.setTargetAtTime(l0 + SURGE_AIR * (0.35 + 0.65 * j), t, 0.03);
    const back = t + 0.06 + 0.16 * j;
    pitch.offset.setTargetAtTime(p0, back, 0.16 + 0.3 * j);
    lift.offset.setTargetAtTime(l0, back, 0.2 + 0.3 * j);
    surgeAt = t; surgeJ = j;
  }

  return {
    // want: 0 (off) or 0.5..1, the run-up; tc: how fast to follow it; loose: on gravel, dirt or grass; aloft: off the
    // ground; jolt: 0..1, a knock this step (kerb, bump, landing); v: speed, m/s
    step(t, want, tc, loose, aloft, jolt, v) {
      const dt = last < 0 ? 0 : Math.min(0.1, t - last); last = t;
      if (Math.abs(want - k) >= 0.01 || (want === 0 && k !== 0)) {
        const on = want > 0, kk = on ? want : k;
        k = want;
        for (const [o, r] of osc) o.frequency.setTargetAtTime((120 + 260 * kk) * r, t, tc);
        f.frequency.setTargetAtTime(450 + 700 * kk, t, tc);
        tone.gain.setTargetAtTime(on ? FAN_TONE * TONE_MAKEUP * kk * kk : 0, t, tc);
        air.gain.setTargetAtTime(on ? FAN_AIR * kk * kk : 0, t, tc);
        if (!on && pitch) { pitch.offset.setTargetAtTime(0, t, 0.3); lift.offset.setTargetAtTime(0, t, 0.3); rest = 'ground'; }
      }
      if (k === 0) return;
      if (t >= nextMood) mood(t);
      if (!pitch) return;
      const w = aloft ? 'air' : loose ? 'loose' : 'ground';
      if (w !== rest) {
        const from = rest; rest = w;
        if (w === 'air') surge(t, 0.6, false);                                // (off the ground: the seal goes at once)
        else if (from === 'air') surge(t, Math.max(0.4, jolt), true);         // (down again: a moment's bog as they bite)
        else {
          const [p, l] = restOf(w);
          pitch.offset.setTargetAtTime(p, t, 0.35); lift.offset.setTargetAtTime(l, t, 0.35);
        }
        return;
      }
      if (aloft) return;
      // (a bigger knock than the last peak has left, and not two in one moment)
      const left = surgeJ * Math.exp(-(t - surgeAt) / 0.3);
      if (jolt > 0.05 && jolt > left + 0.1 && t - surgeAt > 0.08) { surge(t, jolt, false); return; }
      if (loose && dt > 0 && rand() < LOOSE_SURGES * clamp((v - 2) / 13, 0, 1) * dt && t - surgeAt > 0.25) surge(t, 0.08 + 0.3 * rand(), false);
    },
    stop() {
      for (const n of live) { try { n.stop(); } catch { /* not started */ } }
      soft.disconnect();
    },
  };
}
