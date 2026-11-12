// Small synthesised engine / wind sound. Starts on the first user gesture.

export function createAudio() {
  let ctx = null, master, engGain, osc1, osc2, filt, windGain, windFilt, whine, whineGain;
  let muted = false, ev = false;

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

    whine = ctx.createOscillator(); whine.type = 'sine';
    whineGain = ctx.createGain(); whineGain.gain.value = 0;
    whine.connect(whineGain).connect(master); whine.start();

    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    windFilt = ctx.createBiquadFilter(); windFilt.type = 'bandpass'; windFilt.frequency.value = 600; windFilt.Q.value = 0.5;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    noise.connect(windFilt).connect(windGain).connect(master); noise.start();
  }

  function update(car, active) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const v = Math.hypot(car.vx, car.vy);
    const dead = !active || car.inWater;
    if (ev) {
      engGain.gain.setTargetAtTime(0, t, 0.05);
      whine.frequency.setTargetAtTime(180 + v * 38, t, 0.05);
      whineGain.gain.setTargetAtTime(dead ? 0 : Math.min(0.05, 0.004 + v * 0.0012) * (0.5 + car.throttle * 0.5), t, 0.08);
    } else {
      whineGain.gain.setTargetAtTime(0, t, 0.05);
      const cyl = car.spec.engine.torque && car.spec.id === 'w201' ? 3 : 2;   // firing order pulses per rev
      const f = (car.rpm / 60) * cyl;
      osc1.frequency.setTargetAtTime(f, t, 0.03);
      osc2.frequency.setTargetAtTime(f / 2, t, 0.03);
      filt.frequency.setTargetAtTime(350 + car.rpm * 0.28 + car.throttle * 900, t, 0.05);
      engGain.gain.setTargetAtTime(dead ? 0 : 0.05 + car.throttle * 0.11, t, 0.06);
    }
    const loose = car.surface !== 1 ? 1.8 : 1;
    windFilt.frequency.setTargetAtTime(car.surface !== 1 ? 320 : 700 + v * 12, t, 0.1);
    windGain.gain.setTargetAtTime(dead ? 0 : Math.min(0.22, v * 0.0045 * loose), t, 0.1);
  }

  return {
    start, update,
    setCar(spec) { ev = spec.engine.type === 'ev'; },
    setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.05); },
    get muted() { return muted; },
  };
}
