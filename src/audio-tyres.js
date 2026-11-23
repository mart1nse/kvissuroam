// The tyre squeal on paving, over the steady hiss of the howl in audio.js.
//
// The squeal (kummivilin; Martin 2026-11-23: "something more longer and consistent, maybe not so much
//    squeaks anymore but actual kummivilin ... pitch and volume depend on wheel spin speed based on gear and
//    ground speed"). One long note for as long as the tyres slip. Its pitch is the speed the tread slides
//    over the road at: the wheel's own speed (engine revs through the gear) less the ground speed. So it
//    climbs as the revs build in a burnout, sits higher in second gear than in first, and sinks as the car
//    gathers speed and the tyres catch up. Louder with more slip, and it only starts once the tyre is well
//    past the creep of a gripping tyre. The lightly loaded tyre breaks away first and sings alone; the other
//    joins a little off pitch when the spin is harder, so the two beat slowly. A slow noise keeps the note
//    from standing dead still. Heavier cars sing lower. A sideways slide squeals too, quieter, by its speed.
// The little squeaks that came before it (#517) were taken out at Martin's ask (2026-11-23: "remove the
// little squeaks as a whole").
//
// No nodes are made while driving: each voice is one oscillator that stays, and the sound is only
// automation laid on it (a few numbers a frame on the page, nothing when the tyres grip).

export const SQUEAL_LEVEL = 0.028;

// the squeal's pitch in Hz for a tread sliding at s m/s (tools: engine-space-demo.mjs prints it)
export function squealPitch(s, mass = 1400) {
  return 340 * Math.pow(1 + s / 10, 0.7) * Math.max(0.6, Math.min(1.15, Math.pow(1400 / mass, 0.25)));
}

// noise: a looping white noise source that is already running; out: where the car's sounds go.
// voices: 2 for our own car (the two driven tyres), 1 for another player's.
export function createSquealer(ctx, noise, out, { voices = 2 } = {}) {
  // the note with its partials let out up to about 6 kHz, so it is bright and open rather than a dull
  // whistle (Martin 2026-11-23: "bring the filter out")
  const n = 11, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) im[k] = Math.pow(k, -1.05) * (k === 2 ? 1.15 : 1);
  const wave = ctx.createPeriodicWave(re, im);
  const V = [];
  for (let i = 0; i < voices; i++) {
    const osc = ctx.createOscillator(); osc.setPeriodicWave(wave); osc.frequency.value = 500;
    // the note wavers a little all the time, each tyre in its own way
    const jl = ctx.createBiquadFilter(); jl.type = 'lowpass'; jl.frequency.value = 9 + 6 * i; jl.Q.value = 0.5;
    const jg = ctx.createGain(); jg.gain.value = 2200;
    if (osc.detune) noise.connect(jl).connect(jg).connect(osc.detune);
    // and its loudness shivers with a faster noise: rubber on a rough road, not a flute
    const al = ctx.createBiquadFilter(); al.type = 'lowpass'; al.frequency.value = 32 + 9 * i; al.Q.value = 0.5;
    const ag = ctx.createGain(); ag.gain.value = 13;
    const am = ctx.createGain(); am.gain.value = 1;
    noise.connect(al).connect(ag).connect(am.gain);
    // and a slight cut to the lows and lower mids (Martin 2026-11-23): a gentle high-pass under the note
    // and a dip round the bottom of its range, so the body of it thins and the singing top carries it
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 320; hp.Q.value = 0.6;
    const dip = ctx.createBiquadFilter(); dip.type = 'peaking'; dip.frequency.value = 480; dip.Q.value = 0.9; dip.gain.value = -4;
    const g = ctx.createGain(); g.gain.value = 0;
    osc.connect(am).connect(hp).connect(dip).connect(g).connect(out); osc.start();
    V.push({ osc, g, on: false });
  }
  let sm = 0, lv = 0, hz = 0;
  // every frame. t: the audio clock; spin 0..1 (how far past gripping, smoothed); slip: the tread's speed over
  // the road in m/s; slide 0..1 (sideways scrub); speed in m/s; all 0 off paving
  function step(t, spin, slip, slide, speed, mass = 1400) {
    const side = Math.max(0, slide - 0.3) / 0.7;
    const a = Math.max(spin, side * 0.55);
    // (a sideways slide: the tread crosses the road at a share of the car's speed)
    const s = Math.max(spin > 0.02 ? slip : 0, side * Math.min(speed, 30) * 0.45);
    sm += (s - sm) * 0.12;
    const level = a < 0.04 ? 0 : SQUEAL_LEVEL * Math.pow(a, 0.7) * (0.7 + 0.3 * Math.min(1, sm / 25));
    lv = level;
    const f = hz = squealPitch(sm, mass);
    for (let i = 0; i < V.length; i++) {
      const v = V[i];
      // the second tyre breaks away later and sits a touch higher
      const l = i === 0 ? level : level * 0.7 * Math.max(0, Math.min(1, (a - 0.3) / 0.3));
      if (l <= 0 && !v.on) continue;
      v.on = l > 0;
      v.osc.frequency.setTargetAtTime(i === 0 ? f : f * 1.043, t, 0.09);
      v.g.gain.setTargetAtTime(l, t, l > 0 ? 0.12 : 0.07);
    }
  }
  return { step, pitch: () => hz, level: () => lv };
}
