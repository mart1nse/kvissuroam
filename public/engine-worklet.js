// Engine sound synthesiser, run as an AudioWorklet (loaded verbatim from /engine-worklet.js, so it
// must stay self-contained). It is also imported by tools/engine-sound-test.mjs to render WAVs.
//
// The sound is built the way a real engine makes it: the crank turns through its 720 degree cycle, every
// cylinder fires at its own crank angle in firing order, and each firing sends a pressure pulse down its
// bank's exhaust. The pulses ring through the pipes (feedback combs) and the silencers (resonators), with
// intake roar, valvetrain / injector ticks, turbo hiss and overrun crackle on top. On the rev limiter
// the ignition is cut: the cylinders only pump air until it returns with a bark. Firing order, bank
// layout, pipe lengths and the silencer tune come from the car's config (src/engine-sounds.js).

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

class Biquad {
  constructor() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.z1 = 0; this.z2 = 0; }
  set(type, f, Q, sr) {
    const w = 2 * Math.PI * clamp(f, 10, sr * 0.45) / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * Q);
    let b0, b1, b2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; } // band-pass, 0 dB peak
    const a0 = 1 + al;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = -2 * c / a0; this.a2 = (1 - al) / a0;
    return this;
  }
  run(x) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}

// An exhaust pipe as a damped feedback comb: the pulse runs to the open end and back.
class Pipe {
  constructor(sr, len, fb, damp) {
    this.N = 4096; this.buf = new Float32Array(this.N); this.i = 0; this.lp = 0;
    this.D = clamp(Math.round(2 * len / 343 * sr), 2, this.N - 1);
    this.fb = fb; this.damp = damp;
  }
  run(x) {
    const d = this.buf[(this.i - this.D + this.N) % this.N];
    this.lp += (d - this.lp) * this.damp;
    const y = x + this.fb * this.lp;
    this.buf[this.i] = y; this.i = (this.i + 1) % this.N;
    return y;
  }
}

// small deterministic RNG so every car always gets the same cylinder-to-cylinder character
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export class EngineCore {
  constructor(sr) {
    this.sr = sr;
    this.in = { rpm: 800, throttle: 0, boost: 0, on: 0, redline: 6500, idle: 800, cut: 0 };
    this.rpm = 800; this.load = 0; this.boost = 0; this.on = 0; this.theta = 0;
    this.pulses = []; this.clicks = 0; this.clickAmp = 0; this.noise = rng(12345);
    this.n = 0; this.cfg = null; this.cutN = 0;
  }

  setConfig(c) {
    const sr = this.sr, r = rng(c.seed || 7);
    this.cfg = c;
    // firing events: [crank angle, cylinder index, bank]
    // (fireAt gives uneven firing intervals; stagger shifts each cylinder's pulse by up to that many
    // degrees, as unequal manifold runners do)
    const step = 720 / c.order.length;
    this.bias = c.order.map(() => 1 + (r() * 2 - 1) * c.bias);
    this.events = c.order.map((cyl, k) => {
      const a = (c.fireAt ? c.fireAt[k] : k * step) + (c.stagger ? (r() * 2 - 1) * c.stagger : 0);
      return { a: ((a % 720) + 720) % 720, cyl, bank: c.bankOf(cyl) };
    });
    this.banks = c.pipes.map((p) => new Pipe(sr, p.len, p.fb, p.damp ?? 0.5));
    this.res = c.res.map(([f, q, g]) => ({ f: new Biquad().set('bp', f, q, sr), g }));
    this.lp1 = new Biquad(); this.lp2 = new Biquad();
    this.hp = new Biquad().set('hp', c.hp || 28, 0.7, sr);
    this.intakeBp = new Biquad().set('bp', c.intakeF, c.intakeQ || 1.2, sr);
    // the roar is cut off above its band, or the noise skirt is heard as a hiss rather than a roar
    this.intakeLp = new Biquad().set('lp', c.intakeF * 2, 0.6, sr);
    this.tickBp = new Biquad().set('bp', c.tickF || 3500, 1.1, sr);
    this.hissBp = new Biquad().set('bp', 1900, 1.2, sr);
    this.pulses.length = 0;
  }

  set(o) { Object.assign(this.in, o); }

  fire(ev) {
    const c = this.cfg, rpm = this.rpm, n = this.noise;
    const overrun = this.load < 0.05 && rpm > this.in.idle + 500;
    let amp = (c.base + (1 - c.base) * this.load) * this.bias[ev.cyl - 1] * (1 + (n() * 2 - 1) * c.rough);
    let nz = c.noise * (0.6 + 0.8 * this.load), tauDeg = c.pulseDeg * (0.85 + 0.3 * this.load);
    if (this.in.cut) {
      // ignition cut on the rev limiter: the cylinder only pumps air, and on a hot, loud engine some of
      // the unburnt charge goes off in the exhaust
      this.cutN++;
      amp *= c.cutAmp ?? 0.08; nz *= 0.5;
      if (c.pops && n() < c.pops * 0.8) { amp = 1.3 + n() * 1.2; nz = 0.7; tauDeg = c.pulseDeg * 0.6; }
    } else if (this.cutN) {
      // the first firings after the cut light what collected meanwhile: the bark of an engine on its limiter
      amp *= 1 + (c.limBark ?? 0.5) * Math.min(1, this.cutN / 3); this.cutN = Math.max(0, this.cutN - 3);
    }
    if (overrun) {
      amp *= c.overrun ?? 0.8;
      // fuel cut on the overrun: unburnt mixture now and then lights in the hot exhaust
      if (c.pops && n() < c.pops * clamp((rpm - 2500) / 3000, 0, 1)) { amp = 1.6 + n() * 1.4; nz = 0.7; tauDeg = c.pulseDeg * 0.6; }
    }
    const tau = clamp(tauDeg / (rpm * 6) * this.sr, this.sr * 0.00022, this.sr * 0.004);
    // no two combustions are alike: the pulse also lands a fraction of a degree early or late
    const late = Math.max(0, (n() * 2 - 1) * c.jitter / (rpm * 6) * this.sr);
    if (this.pulses.length < 24) this.pulses.push({ bank: ev.bank, amp, nz, tau, t: -late });
    // valvetrain / injector tick for this cylinder: heard at idle and low revs, then lost under the engine
    // (kept up, the ticks run together into a sharp hiss)
    const quiet = clamp(1 - (rpm - this.in.idle) / (0.3 * this.in.redline), 0, 1);
    this.clicks = Math.round(this.sr * 0.00035); this.clickAmp = c.tick * (0.12 + 0.88 * quiet);
  }

  process(out) {
    const c = this.cfg; if (!c) { out.fill(0); return; }
    const sr = this.sr, I = this.in, n = this.noise, len = out.length;
    // per-block smoothing and filter updates
    const kr = 1 - Math.exp(-len / (sr * 0.025)), kl = 1 - Math.exp(-len / (sr * 0.06));
    // a touch of idle lope: real engines never hold their idle exactly
    const lope = I.rpm < I.idle + 150 ? Math.sin(this.n / sr * 2.3) * c.lope + Math.sin(this.n / sr * 0.7) * c.lope * 0.6 : 0;
    this.rpm += (Math.max(300, I.rpm + lope) - this.rpm) * kr;
    this.load += (I.throttle - this.load) * kl;
    this.boost += (I.boost - this.boost) * kl;
    this.on += ((I.on ? 1 : 0) - this.on) * (1 - Math.exp(-len / (sr * 0.05)));
    const rpm = this.rpm, load = this.load, rr = rpm / I.redline;
    const bright = c.lp0 + c.lpRpm * rpm / 1000 + c.lpLoad * load - (c.turbo ? c.turboMuffle * (1 - this.boost * 0.5) : 0);
    this.lp1.set('lp', bright, 0.6, sr); this.lp2.set('lp', bright * 1.6, 0.5, sr);
    const gain = c.gain * this.on * (c.idleVol + (1 - c.idleVol) * (0.45 * rr + 0.55 * load * (0.5 + 0.5 * rr)));
    const drive = c.drive * (0.6 + 0.4 * load), dn = Math.tanh(drive);
    const dTheta = rpm * 6 / sr;
    const ev = this.events, banks = this.banks, res = this.res, pulses = this.pulses;
    const intake = c.intake * load * (0.15 + rr), hiss = c.turbo ? c.hiss * this.boost * this.boost : 0;

    for (let s = 0; s < len; s++) {
      const th0 = this.theta; let th1 = th0 + dTheta;
      for (let k = 0; k < ev.length; k++) {
        const a = ev[k].a;
        if ((th0 < a && th1 >= a) || (th1 >= 720 && a < th1 - 720)) this.fire(ev[k]);
      }
      if (th1 >= 720) th1 -= 720;
      this.theta = th1;

      // combustion pulses into their banks
      let b0 = 0, b1 = 0, env = 0;
      for (let p = pulses.length - 1; p >= 0; p--) {
        const P = pulses[p];
        if (P.t < 0) { P.t++; continue; }
        const x = P.t / P.tau;
        const e = x * Math.exp(1 - x);
        const v = P.amp * e * (1 - P.nz + P.nz * (n() * 2 - 1) * 1.7);
        if (P.bank === 0) b0 += v; else b1 += v;
        env += e * P.amp;
        if (++P.t > P.tau * 9) pulses.splice(p, 1);
      }
      let y = banks.length > 1 ? banks[0].run(b0) + banks[1].run(b1) : banks[0].run(b0 + b1);
      // silencers / body resonances
      let r = y * c.dry;
      for (let k = 0; k < res.length; k++) r += res[k].f.run(y) * res[k].g;
      y = this.lp2.run(this.lp1.run(r));
      // induction roar follows the intake pulses
      y += this.intakeLp.run(this.intakeBp.run(n() * 2 - 1)) * env * intake;
      // ticks
      if (this.clicks > 0) { this.clicks--; y += this.tickBp.run((n() * 2 - 1) * this.clickAmp); } else y += this.tickBp.run(0);
      if (hiss > 0) y += this.hissBp.run(n() * 2 - 1) * hiss;
      y = this.hp.run(y);
      out[s] = Math.tanh(drive * y) / dn * gain;
      this.n++;
    }
  }
}

if (typeof AudioWorkletProcessor === 'function') {
  class EngineProcessor extends AudioWorkletProcessor {
    constructor(opts) {
      super();
      this.core = new EngineCore(sampleRate);
      const po = opts && opts.processorOptions;
      if (po && po.config) this.core.setConfig(reviveConfig(po.config));
      if (po && po.state) this.core.set(po.state);
      this.port.onmessage = (e) => {
        const d = e.data;
        if (d.config) this.core.setConfig(reviveConfig(d.config));
        if (d.state) this.core.set(d.state);
      };
    }
    process(_in, outputs) {
      const o = outputs[0];
      this.core.process(o[0]);
      for (let ch = 1; ch < o.length; ch++) o[ch].set(o[0]);
      return true;
    }
  }
  registerProcessor('engine-sound', EngineProcessor);
}

// configs travel through postMessage, so bank layout is sent as a plain array
export function reviveConfig(c) {
  const banks = c.banks;
  return { ...c, bankOf: (cyl) => banks[cyl - 1] };
}
