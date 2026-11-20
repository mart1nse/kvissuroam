// Engine sound synthesiser, run as an AudioWorklet (loaded verbatim from /engine-worklet.js, so it
// must stay self-contained). It is also imported by tools/engine-sound-test.mjs to render WAVs.
//
// The sound is built the way a real engine makes it: the crank turns through its 720 degree cycle, every
// cylinder fires at its own crank angle in firing order, and each firing sends a pressure pulse down its
// bank's exhaust. The pulses ring through the pipes (feedback combs) and the silencers (resonators), with
// intake roar, valvetrain / injector ticks, turbo hiss and overrun crackle on top. A loud pulse steepens
// as it runs down the pipe, so it arrives with a sharp front (edge), and the hard, buzzy harmonics that
// gives (the rasp that cuts through on a race track) are added by an exciter on the upper band. A turbo
// whistles: the compressor's tone (two slightly apart, so it shimmers rather than beeps, and an overtone),
// the rush of air through it, the scream of air through the blades, and a flutter from the exhaust pulses
// that drive the turbine. It is heard from the moment the turbine starts to spin (state.shaft) and sweeps
// up as it spools; on full boost the wastegate makes it waver, and after a lift it winds down. On the rev limiter
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
    this.in = { rpm: 800, throttle: 0, boost: 0, shaft: -1, on: 0, redline: 6500, idle: 800, cut: 0, shift: 0, blip: 0, crackle: 0, over: 0, bark: 0, yank: 0, yankId: 0, yankTight: 0, growl: 0 };
    this.rpm = 800; this.load = 0; this.ld = 0; this.blip = 0; this.crk = 0; this.ovr = 0; this.hp0 = 0; this.brk = 0; this.grw = 0;
    this.rpmE = 800; this.yId = 0; this.yA = 0; this.yT = 9; this.yk = 0; this.boost = 0; this.shaft = 0; this.on = 0; this.theta = 0;
    this.wp0 = 0; this.wp1 = 0; this.wp2 = 0; this.wjit = 0; this.wgPh = 0; this.wgRate = 4.5; this.wspin = 0;
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
    // smoothTop, for the loud open engines: the roar is cut off above its band, the ticks are band-limited
    // and fade with revs, and the turbo hiss sits lower. Otherwise their noise is heard as a sharp hiss
    // rather than a roar; the quieter engines keep their full, brighter top end.
    this.smooth = !!c.smoothTop;
    this.intakeLp = new Biquad().set('lp', c.intakeF * 2, 0.6, sr);
    this.tickF = this.smooth ? new Biquad().set('bp', c.tickF || 3500, 1.1, sr) : new Biquad().set('hp', c.tickF || 3500, 0.8, sr);
    this.hissBp = this.smooth ? new Biquad().set('bp', 1900, 1.2, sr) : new Biquad().set('bp', 2600, 0.9, sr);
    // rasp: the upper band of the exhaust note driven into an uneven soft clip (a pressure wave steepens on
    // its high side only), which adds harmonics of the firing note, then band-limited so it buzzes and does
    // not hiss
    this.rasp = c.rasp || 0; this.edge = c.edge || 0;
    this.exHp1 = new Biquad().set('hp', c.raspF || 1100, 0.7, sr); this.exHp2 = new Biquad().set('hp', c.raspF || 1100, 0.7, sr);
    this.exLp = new Biquad().set('lp', c.raspTop || 7000, 0.6, sr); this.exDc = new Biquad().set('hp', 400, 0.7, sr);
    // turbo whistle: level (0 = none) and pitch scale (a small turbo spins faster and sings higher)
    this.wh = c.turbo ? c.whistle ?? 1 : 0; this.whF = c.whistleF ?? 1;
    this.airBp = new Biquad().set('bp', 1500, 1.6, sr); this.bladeBp = new Biquad().set('bp', 3000, 7, sr);
    this.pulses.length = 0;
  }

  set(o) { Object.assign(this.in, o); }

  fire(ev) {
    const c = this.cfg, rpm = this.rpmE, n = this.noise, ld = this.ld, ov = this.ovr;
    const overrun = ld < 0.05 && rpm > this.in.idle + 500;
    // (dragged past the redline the valves float: every firing comes out different)
    let amp = (c.base + (1 - c.base) * ld) * this.bias[ev.cyl - 1] * (1 + (n() * 2 - 1) * c.rough * (1 + 5 * ov));
    let nz = c.noise * (0.6 + 0.8 * ld), tauDeg = c.pulseDeg * (0.85 + 0.3 * ld);
    // an upshift biting: the first firings in the new gear bark, harder and sharper (src/audio-shift.js)
    const bk = this.brk;
    if (bk > 0.02) { amp *= 1 + 1.6 * bk; tauDeg *= 1 - 0.25 * bk; }
    // (and through the yank the combustion is loaded hard while the gear drags the revs down, eased as
    // they spring back: the firings swell and thin with the swing)
    if (this.yk) { amp *= 1 + 0.45 * this.yk; nz *= 1 + 0.5 * Math.abs(this.yk); }
    if (this.in.cut || this.in.shift) {
      // ignition cut on the rev limiter (or for an upshift): the cylinder only pumps air, and on a hot,
      // loud engine some of the unburnt charge goes off in the exhaust (a shift crackles more)
      this.cutN++;
      amp *= c.cutAmp ?? 0.35; nz *= 0.7;
      if (c.pops && n() < c.pops * (this.in.shift ? 3 : 0.8)) { amp = 1.3 + n() * 1.2; nz = 0.7; tauDeg = c.pulseDeg * 0.6; }
    } else if (this.cutN) {
      // the first firings after the cut light what collected meanwhile: the bark of an engine on its limiter
      amp *= 1 + (c.limBark ?? 0.5) * Math.min(1, this.cutN / 3); this.cutN = Math.max(0, this.cutN - 3);
    }
    if (overrun) {
      amp *= c.overrun ?? 0.8;
      // fuel cut on the overrun: unburnt mixture now and then lights in the hot exhaust, much more just
      // after a downshift's blip (crackle) and when the engine is dragged past its redline (over)
      const pp = c.pops || 0, cr = this.crk;
      const pop = (pp * (1 + 5 * cr) + (c.crackle ?? 0.06) * cr + (pp ? 0.12 : 0.04) * ov) * clamp((rpm - 2500) / 3000, 0, 1);
      if (pop > 0 && n() < pop) { amp = 1.6 + n() * 1.4; nz = 0.7; tauDeg = c.pulseDeg * 0.6; }
    } else if (ov > 0.05 && n() < 0.08 * ov) amp *= 0.3;          // (a misfire)
    const tau = clamp(tauDeg / (rpm * 6) * this.sr, this.sr * 0.00022, this.sr * 0.004);
    // no two combustions are alike: the pulse also lands a fraction of a degree early or late
    const late = Math.max(0, (n() * 2 - 1) * c.jitter * (1 + 3 * ov) / (rpm * 6) * this.sr);
    // (edge: the pulse rises in a fraction of its blowdown time, the front of a near-shock wave; louder and
    // more so under load)
    const rise = tau * (1 - this.edge * (0.55 + 0.3 * ld));
    if (this.pulses.length < 24) this.pulses.push({ bank: ev.bank, amp, nz, tau, rise, t: -late });
    // valvetrain / injector tick for this cylinder. With smoothTop it is heard at idle and low revs, then
    // lost under the engine (kept up on a loud engine, the ticks run together into a sharp hiss)
    const quiet = clamp(1 - (rpm - this.in.idle) / (0.3 * this.in.redline), 0, 1);
    this.clicks = Math.round(this.sr * 0.00035);
    this.clickAmp = c.tick * (this.smooth ? 0.12 + 0.88 * quiet : 0.4 + 0.6 * rpm / this.in.redline);
  }

  process(out) {
    const c = this.cfg; if (!c) { out.fill(0); return; }
    const sr = this.sr, I = this.in, n = this.noise, len = out.length;
    // per-block smoothing and filter updates
    const kr = 1 - Math.exp(-len / (sr * 0.025)), kl = 1 - Math.exp(-len / (sr * 0.06));
    // a touch of idle lope: real engines never hold their idle exactly
    const lope = I.rpm < I.idle + 150 ? Math.sin(this.n / sr * 2.3) * c.lope + Math.sin(this.n / sr * 0.7) * c.lope * 0.6 : 0;
    // an upshift's gear going in with the revs still above its speed (src/audio-shift.js): the revs are
    // wrenched down at once, past the new gear's, and swing back about 8 times a second, dying out in a
    // couple of swings as the driveline winds up and springs back
    if (I.yankId !== this.yId) {
      this.yId = I.yankId; this.yA = I.yank || 0; this.yT = 0; this.yTi = I.yankTight || 0;
      if (this.yA > 0) this.rpm = Math.max(300, I.rpm);
    }
    this.rpm += (Math.max(300, I.rpm + lope) - this.rpm) * kr;
    let yOff = 0; this.yk = 0;
    if (this.yA > 0 && this.yT < 0.45) {
      // (per car: yank, the size of the swing, and yankHz, how fast it swings; a slower one dies slower.
      // yankTight (1st to 2nd): the gear snaps in, the swing 60 % faster and over in half the time, and
      // per car yankFirst times the size)
      const c = this.cfg, ti = this.yTi || 0, hz0 = c.yankHz ?? 8.2, hz = hz0 * (1 + 0.6 * ti);
      const a = this.yA * (c.yank ?? 0.55) * (ti ? c.yankFirst ?? 1 : 1);
      const env = Math.exp(-this.yT / (0.08 * 8.2 / hz0 / (1 + ti))), sw = Math.cos(6.2832 * hz * this.yT);
      yOff = a * env * sw;
      this.yk = Math.min(1, a / I.redline * 5) * env * sw;
      this.yT += len / sr;
    }
    this.rpmE = Math.max(300, this.rpm + yOff);
    this.load += (I.throttle - this.load) * kl;
    // a downshift's blip opens the throttle faster than the pedal smoothing would let it (src/audio-shift.js)
    this.blip += ((I.blip || 0) - this.blip) * (1 - Math.exp(-len / (sr * 0.012)));
    this.crk += ((I.crackle || 0) - this.crk) * kr;
    this.ovr += ((I.over || 0) - this.ovr) * (1 - Math.exp(-len / (sr * 0.04)));
    this.brk += ((I.bark || 0) - this.brk) * (1 - Math.exp(-len / (sr * 0.01)));
    // growl: the chase camera dropped back at speed hears a grittier engine (src/audio.js, Martin 2026-11-20)
    this.grw += ((I.growl || 0) - this.grw) * (1 - Math.exp(-len / (sr * 0.3)));
    this.ld = Math.max(this.load, this.blip);
    this.boost += (I.boost - this.boost) * kl;
    this.shaft += ((I.shaft >= 0 ? I.shaft : I.boost) - this.shaft) * kl;
    this.on += ((I.on ? 1 : 0) - this.on) * (1 - Math.exp(-len / (sr * 0.05)));
    const rpm = this.rpmE, load = this.ld, rr = rpm / I.redline, ov = this.ovr, bl = this.blip;
    const bright = c.lp0 + c.lpRpm * rpm / 1000 + c.lpLoad * load - (c.turbo ? c.turboMuffle * (1 - this.boost * 0.5) : 0);
    this.lp1.set('lp', bright, 0.6, sr); this.lp2.set('lp', bright * 1.6, 0.5, sr);
    const gain = c.gain * this.on * (c.idleVol + (1 - c.idleVol) * (0.45 * rr + 0.55 * load * (0.5 + 0.5 * rr))) * (1 + 0.45 * this.brk);
    // (a downshift's blip drives the engine harder into its saturation: a heavier growl; so, a little, does
    // the camera dropping back)
    const drive = c.drive * (0.6 + 0.4 * load) * (1 + 0.5 * bl + 0.25 * this.grw), dn = Math.tanh(drive);
    const dTheta = rpm * 6 / sr;
    const ev = this.events, banks = this.banks, res = this.res, pulses = this.pulses;
    const intake = c.intake * load * (0.15 + rr) * (1 + 1.5 * bl), hiss = c.turbo ? c.hiss * this.boost * this.boost : 0;
    // (more growl in a downshift's blip, and more still in an upshift's bark; and with the camera back)
    const rasp = this.rasp * (0.3 + 0.7 * load) * (0.25 + 0.75 * clamp(rr, 0, 1)) * (1 + ov + bl + 1.2 * this.brk + 0.7 * this.grw), rk = c.raspDrive || 6;
    // over-rev: the straight-cut gears howl as the wheels drag the engine past its limit
    // (its pitch wanders a little with the shaft's wind-up, so it is not a pure test tone)
    if (ov > 0.001) this.hjit = (this.hjit || 0) * 0.85 + (n() * 2 - 1) * 0.004;
    const hl = 0.05 * ov * this.on * (c.howl ?? 1), hf = rpm / 60 * (c.howlTeeth ?? 19) * (1 + (this.hjit || 0)) / sr;
    // the turbine: heard as soon as it starts to spin, sweeping up as it spools (the build-up), on a lift
    // it runs on and spins down (shaft), the whine falling under the blow-off
    let wl = 0, wf = 0, wd = 0, wfd = 0, wsp = 0;
    if (this.wh > 0) {
      const lifted = I.throttle <= 0, b = this.boost, sh = this.shaft;
      const want = lifted ? Math.max(b, sh * 0.8) : Math.max(b, sh);
      // the heavy turbine wheel takes its time to come up to speed: the whistle sweeps up behind the boost
      this.wspin += (want - this.wspin) * (1 - Math.exp(-len / (sr * (want > this.wspin ? 0.45 : 0.12))));
      const spin = this.wspin;
      const lv = lifted ? 0.3 * sh * sh : 0.15 * spin + 0.3 * spin * spin * spin + 0.55 * b * b;
      // on full boost the wastegate holds the pressure, cracking open and shut: the whistle wavers
      this.wgRate += (3.5 + n() * 3 - this.wgRate) * 0.02;
      this.wgPh += len / sr * this.wgRate; if (this.wgPh > 1) this.wgPh -= 1;
      const gate = clamp((b - 0.85) / 0.15, 0, 1);
      wl = 0.055 * this.wh * this.on * lv * (1 + gate * 0.13 * Math.sin(6.2832 * this.wgPh));
      this.wjit = this.wjit * 0.9 + (n() * 2 - 1) * 0.0015;         // turbulence: the pitch is never quite steady
      wf = (850 + 2900 * Math.pow(spin, 1.5) + rpm * 0.08) * this.whF * (1 + this.wjit + gate * 0.004 * Math.sin(6.2832 * this.wgPh)) / sr;
      this.airBp.set('bp', wf * sr * 0.6, 1.6, sr);
      this.bladeBp.set('bp', Math.min(wf * sr * 1.51, sr * 0.4), 7, sr);
      wd = ev.length / 720;                                          // exhaust pulses per crank degree
      wfd = 0.08 + 0.3 * (1 - spin);                                 // the exhaust kicks a slow turbine hard
      wsp = spin;
    }

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
        const x = P.t < P.rise ? P.t / P.rise : 1 + (P.t - P.rise) / P.tau;
        const e = x * Math.exp(1 - x);
        const v = P.amp * e * (1 - P.nz + P.nz * (n() * 2 - 1) * 1.7);
        if (P.bank === 0) b0 += v; else b1 += v;
        env += e * P.amp;
        if (++P.t > P.rise + P.tau * 8) pulses.splice(p, 1);
      }
      let y = banks.length > 1 ? banks[0].run(b0) + banks[1].run(b1) : banks[0].run(b0 + b1);
      // silencers / body resonances
      let r = y * c.dry;
      for (let k = 0; k < res.length; k++) r += res[k].f.run(y) * res[k].g;
      y = this.lp2.run(this.lp1.run(r));
      if (rasp > 0) {
        const u = this.exHp2.run(this.exHp1.run(y)) * rk;
        const w = u > 0 ? u / (1 + u) : u / (1 - 0.35 * u);        // uneven soft clip
        y += this.exDc.run(this.exLp.run(w)) * rasp;
      }
      // induction roar follows the intake pulses
      const roar = this.intakeBp.run(n() * 2 - 1);
      y += (this.smooth ? this.intakeLp.run(roar) : roar) * env * intake;
      // ticks
      if (this.clicks > 0) { this.clicks--; y += this.tickF.run((n() * 2 - 1) * this.clickAmp); }
      else { const ring = this.tickF.run(0); if (this.smooth) y += ring; }
      if (hiss > 0) y += this.hissBp.run(n() * 2 - 1) * hiss;
      y = this.hp.run(y);
      let o = Math.tanh(drive * y) / dn * gain;
      if (hl > 1e-4) {
        this.hp0 += hf; if (this.hp0 > 1) this.hp0 -= 1;
        o += (Math.sin(6.2832 * this.hp0) + 0.35 * Math.sin(12.566 * this.hp0)) * hl * (0.75 + 0.25 * Math.sin(6.2832 * this.theta / 720 * ev.length));
      }
      if (wl > 1e-5) {
        this.wp0 += wf; this.wp1 += wf * 1.0071; this.wp2 += wf * 2;
        if (this.wp0 > 1) this.wp0 -= 1; if (this.wp1 > 1) this.wp1 -= 1; if (this.wp2 > 1) this.wp2 -= 1;
        const tone = Math.sin(6.2832 * this.wp0) + 0.55 * Math.sin(6.2832 * this.wp1) + 0.14 * Math.sin(6.2832 * this.wp2);
        const fp = this.theta * wd, am = 1 - wfd * 0.5 * (1 + Math.cos(6.2832 * (fp - Math.floor(fp))));
        o += (tone * 0.6 * am + this.airBp.run(n() * 2 - 1) * 2.2 + this.bladeBp.run(n() * 2 - 1) * 2 * wsp * am) * wl;
      }
      out[s] = o;
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
