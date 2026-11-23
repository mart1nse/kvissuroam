// Tyre squeal modelled on how a real tyre makes it (and, further down, wheelspin on loose ground), run as an
// AudioWorklet (loaded verbatim from
// /tyre-worklet.js, so it must stay self-contained). The other squeal, the plain held note in
// src/audio-tyres.js, stays; V in the game switches between the two (Martin 2026-11-23: "an alternative
// tyre squeal sound which I can A/B ... real life, hyper realistic tyre squeal").
//
// A squealing tyre is a friction instrument, like a bowed string or a creaking door:
//  - Stick-slip. Each tread block grips the road, is dragged along shearing, then lets go and snaps
//    back. The blocks pass through the contact patch at the speed the tread slides over the road, so the
//    snaps come at slip speed / block length, a few hundred to a thousand and more times a second. Each
//    rib of tread (three here) does it at a slightly different rate, so they beat against each other.
//  - Never quite regular. A snap comes a little early or late (more so at light slip, when the tyre is
//    only just letting go), and the rate wanders slowly with load and road. Now and then the tread locks
//    into another way of vibrating and the note jumps (to a fifth or an octave above, or a little below),
//    holds a moment, and falls back: the "scream" breaking in a burnout.
//  - The tyre rings. The snaps excite the belt and tread rubber, which have their own resonances (about
//    1.2, 2.4 and 3.6 kHz). As the pitch slides, its harmonics pass through them and the colour changes,
//    which is much of what makes it sound like rubber and not like a whistle.
//  - Grain and hiss. Every snap also lets out a short burst of broadband noise (the rubber tearing at the
//    road surface), and the whole thing shivers in loudness with the grit of the asphalt.
//  - Two tyres. Our own car has both driven tyres: the second breaks away later, a little off pitch.
// Lows are cut (a high-pass at 300 Hz): the body of a squeal is its upper part. The very top is rolled
// off above 7 kHz (Martin did not want the highs pushed, 2026-11-23).
//
// Inputs are k-rate AudioParams, so the game (and tools/engine-space-demo.mjs) set them like any other
// param: slip (m/s the tread slides over the road), amount (0..1 how far past gripping), side (0..1 a
// sideways slide), speed (m/s), mass (kg), level (output gain). Nothing runs while the tyres grip.

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const TAU = Math.PI * 2;

class Bq {
  constructor() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.z1 = 0; this.z2 = 0; }
  set(type, f, Q, sr) {
    const w = TAU * clamp(f, 10, sr * 0.45) / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * Q);
    let b0, b1, b2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; }        // band-pass, 0 dB at the peak
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

// the pitch of the snaps for a tread sliding at s m/s (a block about 2.5 cm long, flattened at the top: the
// faster the slide, the more blocks slip together), heavier cars a little lower
export function snapRate(s, mass) {
  return 360 * Math.pow(1 + s / 9, 0.65) * clamp(Math.pow(1400 / mass, 0.25), 0.6, 1.15);
}

export class SquealCore {
  constructor(sr, tyres = 2, seed = 1) {
    this.sr = sr;
    this.seed = (seed * 2654435761) >>> 0 || 1;
    // ribs: [rate ratio, gain, tyre]
    const ribs = [[1, 1, 0], [1.0068, 0.65, 0], [0.9915, 0.45, 0]];
    if (tyres > 1) ribs.push([1.041, 0.75, 1], [1.0335, 0.45, 1]);
    this.ribs = ribs.map(([r, g, t]) => ({ r, g, t, ph: this.rnd(), per: 1, jit: 0 }));
    this.res = [new Bq().set('bp', 1180, 7, sr), new Bq().set('bp', 2380, 6, sr), new Bq().set('bp', 3550, 5, sr)];
    this.resG = [1.1, 0.55, 0.3];
    this.body = new Bq().set('lp', 2600, 0.7, sr);
    this.hissBp = new Bq().set('bp', 2600, 0.8, sr);
    this.hp1 = new Bq().set('hp', 300, 0.6, sr);
    this.hp2 = new Bq().set('hp', 300, 0.6, sr);
    this.top = new Bq().set('lp', 7000, 0.7, sr);
    // slow and faster wander of the rate, grain of the loudness (one-pole low-passed noise)
    this.wSlow = 0; this.wFast = 0; this.grain = 0;
    this.kSlow = 1 - Math.exp(-TAU * 3 / sr); this.kFast = 1 - Math.exp(-TAU * 11 / sr); this.kGrain = 1 - Math.exp(-TAU * 90 / sr);
    this.burst = 0; this.kBurst = Math.exp(-1 / (0.0007 * sr));
    this.mode = 1; this.modeTo = 1; this.modeLeft = 0; this.kMode = 1 - Math.exp(-1 / (0.05 * sr));
    this.env = 0; this.env2 = 0; this.s = 0;
    this.kAtt = 1 - Math.exp(-1 / (0.06 * sr)); this.kRel = 1 - Math.exp(-1 / (0.12 * sr)); this.kS = 1 - Math.exp(-1 / (0.12 * sr));
    this.p = { slip: 0, amount: 0, side: 0, speed: 0, mass: 1400, level: 1 };
  }
  rnd() { let x = this.seed; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.seed = x >>> 0; return this.seed / 4294967296; }
  gauss() { return (this.rnd() + this.rnd() + this.rnd() - 1.5) * 2; }
  set(p) { Object.assign(this.p, p); }
  process(out) {
    const n = out.length, p = this.p, sr = this.sr;
    const side = Math.max(0, p.side - 0.3) / 0.7;
    const a = Math.max(p.amount, side * 0.55);
    const sTo = Math.max(p.amount > 0.02 ? p.slip : 0, side * Math.min(p.speed, 30) * 0.45);
    const target = a < 0.04 ? 0 : Math.pow(a, 0.75) * (0.75 + 0.25 * Math.min(1, sTo / 25)) * p.level;
    const target2 = target * clamp((a - 0.3) / 0.3, 0, 1);
    if (target === 0 && this.env < 1e-5) { out.fill(0); this.env = this.env2 = 0; return; }
    // the note jumping into another way of vibrating, now and then (more often the harder the spin)
    this.modeLeft -= n / sr;
    if (this.modeLeft <= 0) {
      if (this.modeTo !== 1) { this.modeTo = 1; this.modeLeft = 0.6 + 3.2 * this.rnd(); }
      else if (this.rnd() < 0.25 + 0.35 * a) {
        const r = this.rnd();
        this.modeTo = r < 0.4 ? 1.5 : r < 0.7 ? 2 : r < 0.85 ? 1.25 : 0.8;
        this.modeLeft = 0.12 + 0.55 * this.rnd();
      } else this.modeLeft = 0.5 + 2.5 * this.rnd();
    }
    // how ragged the snaps are: very at light slip, steadier when the tyre is fully away
    const jit = 0.012 + 0.05 * (1 - Math.min(1, a * 1.3));
    const massK = p.mass;
    for (let i = 0; i < n; i++) {
      this.s += (sTo - this.s) * this.kS;
      this.env += (target - this.env) * (target > this.env ? this.kAtt : this.kRel);
      this.env2 += (target2 - this.env2) * (target2 > this.env2 ? this.kAtt : this.kRel);
      this.mode += (this.modeTo - this.mode) * this.kMode;
      const w = this.rnd() * 2 - 1;
      this.wSlow += (w - this.wSlow) * this.kSlow;
      this.wFast += (this.rnd() * 2 - 1 - this.wFast) * this.kFast;
      this.grain += (this.rnd() * 2 - 1 - this.grain) * this.kGrain;
      // (the wander: about 25 cents slow and 8 fast, as the low-passes leave the noise)
      const f0 = snapRate(this.s, massK) * this.mode * Math.pow(2, (this.wSlow * 31 + this.wFast * 5) / 12);
      let x = 0;
      for (const rb of this.ribs) {
        const g = rb.t ? this.env2 : this.env;
        if (g <= 1e-6) continue;
        const dt = f0 * rb.r / sr;
        rb.ph += dt / rb.per;
        if (rb.ph >= 1) {
          rb.ph -= 1;
          rb.per = 1 + jit * this.gauss();
          if (rb.t === 0 || this.rnd() < 0.5) this.burst = 1;
        }
        // a sawtooth (slow shear, sudden release) with the release smoothed over one sample (polyBLEP)
        const t = rb.ph, d = dt / rb.per;
        let v = 2 * t - 1;
        if (t < d) { const u = t / d; v -= u + u - u * u - 1; }
        else if (t > 1 - d) { const u = (t - 1) / d; v -= u * u + u + u + 1; }
        x += v * rb.g * g;
      }
      this.burst *= this.kBurst;
      const grit = Math.max(0, 1 + this.grain * 7);
      x *= grit;
      // the tyre ringing at its own resonances, and a little of the snaps themselves
      let y = this.body.run(x) * 0.35;
      for (let k = 0; k < 3; k++) y += this.res[k].run(x) * this.resG[k];
      // the tear: broadband noise let out at every snap
      const hiss = this.hissBp.run(this.rnd() * 2 - 1) * (0.25 + 1.6 * this.burst) * (this.env + this.env2 * 0.5) * grit;
      out[i] = this.top.run(this.hp2.run(this.hp1.run(y + hiss * 0.5))) * 0.5;
    }
  }
}

// ---- Wheelspin on loose ground (Martin 2026-11-23: "When going full beans on gravel with extreme wheelspin
// etc, add some realistic sounds to it. A few smaller stones hitting the wheel wells, the tyre in the sand
// sound etc."). Four layers, all from the same inputs (how hard the tyres spin, the tread's speed over the
// ground, the car's speed, and the ground: 2 gravel, 3 dirt or sand, 0 grass):
//  - Stones in the wheel arches. A spinning tyre flings stones up into the arch: each one a short knock,
//    most against the plastic liner (a dull tok, 0.9 to 2.4 kHz, gone in 5 to 12 ms), some on bare metal
//    (a ping, 2 to 5 kHz, ringing 20 to 50 ms). Their sizes are mostly small with the odd big one, and they
//    often come in a little spray of two or three. How many: up to about 45 a second at full spin on
//    gravel, a few on dirt, hardly any on grass; a fast car on gravel throws the odd one without spinning.
//  - The dig. The tread tearing through the loose top: a dense crackle of thousands of tiny grain
//    collisions, brighter on gravel, duller and softer in sand, scrabbling in bursts.
//  - The spray. The cloud of grit and sand thrown back: a rushing hiss, lower and rounder in sand ("the tyre
//    in the sand"), with a slow churn in it.
//  - The fine shower. Grit rattling on the underbody and the arches like hail, a quieter bed under the
//    stones.

// a two-pole resonator ringing at f with time constant tau (s)
function ring(f, tau, sr) {
  const r = Math.exp(-1 / (tau * sr)), w = TAU * f / sr;
  return { c1: 2 * r * Math.cos(w), c2: -r * r, y1: 0, y2: 0, g: Math.sin(w) };
}

const GROUND = {
  // stones a second at full spin, how big they come, crackle grains a second, crackle colour, spray band and
  // loudness (sand roars more), the fine shower
  2: { stones: 45, size: 1, grains: 2600, dig: 1900, digQ: 0.8, dull: 5200, spray: 900, sprayQ: 0.55, sprayG: 1, churn: 0.35, fine: 1 },
  3: { stones: 8, size: 0.6, grains: 1500, dig: 1100, digQ: 0.6, dull: 2400, spray: 420, sprayQ: 0.5, sprayG: 1.8, churn: 0.6, fine: 0.4 },
  0: { stones: 1.5, size: 0.4, grains: 700, dig: 900, digQ: 0.6, dull: 2000, spray: 650, sprayQ: 0.6, sprayG: 0.8, churn: 0.4, fine: 0.1 },
};

export class GravelCore {
  constructor(sr, seed = 1) {
    this.sr = sr;
    this.seed = (seed * 2246822519) >>> 0 || 7;
    this.hits = [];                        // ringing stones: up to 8 at once, 3 modes each
    for (let i = 0; i < 8; i++) this.hits.push({ m: [ring(1000, 0.01, sr), ring(1000, 0.01, sr), ring(1000, 0.01, sr)], a: [0, 0, 0], left: 0, x: 0 });
    this.next = 0;
    this.queue = [];                       // followers of a spray: [samples to wait, size, metal]
    this.dig = new Bq(); this.dull = new Bq(); this.spray = new Bq(); this.sprayLp = new Bq();
    this.fine = ring(780, 0.004, sr); this.fine2 = ring(1350, 0.003, sr);
    this.hp = new Bq().set('hp', 90, 0.6, sr); this.top = new Bq().set('lp', 9000, 0.7, sr);
    this.churn = 0; this.kChurn = 1 - Math.exp(-TAU * 7 / sr);
    this.scrab = 0; this.kScrab = 1 - Math.exp(-TAU * 18 / sr);
    this.env = 0; this.kAtt = 1 - Math.exp(-1 / (0.05 * sr)); this.kRel = 1 - Math.exp(-1 / (0.15 * sr));
    this.ground = -1;
    this.p = { amount: 0, slip: 0, speed: 0, ground: 2, level: 1 };
    // the layers' share: stones, dig, spray, fine shower (tools solo them to set the balance)
    this.mix = [0.43, 3.1, 1.2, 0.14];
  }
  rnd() { let x = this.seed; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.seed = x >>> 0; return this.seed / 4294967296; }
  set(p) { Object.assign(this.p, p); }
  strike(size, metal) {
    let h = this.hits[0];
    for (const c of this.hits) if (c.left < h.left) h = c;
    const sr = this.sr, R = () => this.rnd();
    const f = metal ? 2000 + 3000 * R() : 900 + 1500 * R(), tau = metal ? 0.02 + 0.03 * R() : 0.005 + 0.007 * R();
    const ratios = [1, 1.5 + 0.35 * R(), 2.3 + 0.6 * R()];
    for (let k = 0; k < 3; k++) {
      const m = ring(Math.min(sr * 0.42, f * ratios[k]), tau / (1 + 0.6 * k), sr);
      h.m[k].c1 = m.c1; h.m[k].c2 = m.c2; h.m[k].g = m.g; h.m[k].y1 = 0; h.m[k].y2 = 0;
      h.a[k] = size * (k === 0 ? 1 : k === 1 ? 0.55 * R() + 0.2 : 0.35 * R() + 0.1) * (metal ? 0.7 : 1);
    }
    h.left = Math.round(tau * sr * 7);
    h.x = Math.round(0.0003 * sr) + 1;     // the knock itself: a burst of a third of a millisecond
  }
  process(out) {
    const n = out.length, p = this.p, sr = this.sr;
    const G = GROUND[p.ground];
    const amount = G ? p.amount : 0;
    // how hard the ground is being worked: the spin, more with the tread's speed over it
    const work = amount * (0.45 + Math.min(1, p.slip / 18) * 0.55);
    const target = G ? Math.min(1, work + (p.ground === 2 ? Math.min(1, p.speed / 30) * 0.12 : 0)) : 0;
    if (target === 0 && this.env < 1e-5 && !this.hits.some((h) => h.left > 0)) { out.fill(0); this.env = 0; return; }
    if (G && p.ground !== this.ground) {
      this.ground = p.ground;
      this.dig.set('bp', G.dig, G.digQ, sr); this.dull.set('lp', G.dull, 0.7, sr);
      this.spray.set('bp', G.spray, G.sprayQ, sr); this.sprayLp.set('lp', G.spray * 3, 0.7, sr);
    }
    const g = G || GROUND[2];
    // stones a second: the spin throws them, and a fast car on gravel the odd one
    const rate = g.stones * Math.pow(amount, 1.2) * (0.35 + Math.min(1.3, p.slip / 15)) + (p.ground === 2 ? Math.min(1, p.speed / 25) * 3 : 0);
    const grains = g.grains * (0.3 + 0.7 * work), pGrain = grains / sr;
    for (let i = 0; i < n; i++) {
      this.env += (target - this.env) * (target > this.env ? this.kAtt : this.kRel);
      // stones
      if (G && rate > 0) {
        this.next -= 1;
        if (this.next <= 0) {
          this.next = -Math.log(1 - this.rnd() * 0.999) / rate * sr;
          const r = this.rnd(), size = g.size * (0.15 + 0.85 * r * r * r) * Math.min(1, 0.4 + amount);
          this.strike(size, this.rnd() < 0.3);
          if (this.rnd() < 0.3) for (let k = 1 + (this.rnd() < 0.4 ? 1 : 0); k > 0; k--) this.queue.push([Math.round((0.005 + 0.035 * this.rnd()) * sr), size * (0.3 + 0.5 * this.rnd()), this.rnd() < 0.3]);
        }
        for (let q = this.queue.length - 1; q >= 0; q--) if (--this.queue[q][0] <= 0) { const [, sz, mt] = this.queue[q]; this.queue.splice(q, 1); this.strike(sz, mt); }
      }
      let st = 0;
      for (const h of this.hits) {
        if (h.left <= 0) continue;
        h.left--;
        const x = h.x > 0 ? (h.x--, this.rnd() * 2 - 1) : 0;
        for (let k = 0; k < 3; k++) {
          const m = h.m[k], y = m.c1 * m.y1 + m.c2 * m.y2 + x * m.g;
          m.y2 = m.y1; m.y1 = y; st += y * h.a[k];
        }
      }
      // the dig: sparse random grains, scrabbling in bursts
      this.scrab += (this.rnd() * 2 - 1 - this.scrab) * this.kScrab;
      const burst = Math.max(0, 0.6 + this.scrab * 14);
      const grain = this.rnd() < pGrain * burst ? (this.rnd() * 2 - 1) * (0.3 + 0.7 * this.rnd()) : 0;
      const dig = this.dull.run(this.dig.run(grain)) * 3.2;
      // the spray: rushing noise with a slow churn, and the fine shower ringing faintly off the floor
      this.churn += (this.rnd() * 2 - 1 - this.churn) * this.kChurn;
      const sp = this.sprayLp.run(this.spray.run(this.rnd() * 2 - 1)) * Math.max(0, 1 + this.churn * 20 * g.churn);
      const fg = this.rnd() < pGrain * 0.35 ? this.rnd() * 2 - 1 : 0;
      const f1 = this.fine, f2 = this.fine2;
      const y1 = f1.c1 * f1.y1 + f1.c2 * f1.y2 + fg * f1.g; f1.y2 = f1.y1; f1.y1 = y1;
      const y2 = f2.c1 * f2.y1 + f2.c2 * f2.y2 + fg * f2.g; f2.y2 = f2.y1; f2.y1 = y2;
      const fine = (y1 + y2 * 0.7) * g.fine;
      const e = this.env;
      const M = this.mix;
      out[i] = this.top.run(this.hp.run(st * M[0] * Math.min(1, 0.3 + e * 1.5) + (dig * M[1] + sp * M[2] * g.sprayG + fine * M[3]) * e)) * 0.5 * p.level;
    }
  }
}


if (typeof AudioWorkletProcessor === 'function') {
  class TyreProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      return [
        { name: 'slip', defaultValue: 0, minValue: 0, maxValue: 200, automationRate: 'k-rate' },
        { name: 'amount', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
        { name: 'side', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
        { name: 'speed', defaultValue: 0, minValue: 0, maxValue: 200, automationRate: 'k-rate' },
        { name: 'mass', defaultValue: 1400, minValue: 300, maxValue: 30000, automationRate: 'k-rate' },
        { name: 'level', defaultValue: 1, minValue: 0, maxValue: 10, automationRate: 'k-rate' },
      ];
    }
    constructor(opts) {
      super();
      const po = (opts && opts.processorOptions) || {};
      this.core = new SquealCore(sampleRate, po.tyres || 2, po.seed || ((Math.random() * 1e9) | 0));
      this.q = {};
    }
    process(_in, outputs, P) {
      const o = outputs[0], q = this.q;
      q.slip = P.slip[0]; q.amount = P.amount[0]; q.side = P.side[0]; q.speed = P.speed[0]; q.mass = P.mass[0]; q.level = P.level[0];
      this.core.set(q);
      this.core.process(o[0]);
      for (let ch = 1; ch < o.length; ch++) o[ch].set(o[0]);
      return true;
    }
  }
  registerProcessor('tyre-squeal', TyreProcessor);

  class GravelProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      return [
        { name: 'amount', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
        { name: 'slip', defaultValue: 0, minValue: 0, maxValue: 200, automationRate: 'k-rate' },
        { name: 'speed', defaultValue: 0, minValue: 0, maxValue: 200, automationRate: 'k-rate' },
        { name: 'ground', defaultValue: 1, minValue: 0, maxValue: 9, automationRate: 'k-rate' },
        { name: 'level', defaultValue: 1, minValue: 0, maxValue: 10, automationRate: 'k-rate' },
      ];
    }
    constructor(opts) {
      super();
      const po = (opts && opts.processorOptions) || {};
      this.core = new GravelCore(sampleRate, po.seed || ((Math.random() * 1e9) | 0));
      this.q = {};
    }
    process(_in, outputs, P) {
      const o = outputs[0], q = this.q;
      q.amount = P.amount[0]; q.slip = P.slip[0]; q.speed = P.speed[0]; q.ground = Math.round(P.ground[0]); q.level = P.level[0];
      this.core.set(q);
      this.core.process(o[0]);
      for (let ch = 1; ch < o.length; ch++) o[ch].set(o[0]);
      return true;
    }
  }
  registerProcessor('gravel-spin', GravelProcessor);
}
