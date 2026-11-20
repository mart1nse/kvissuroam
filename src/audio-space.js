// The space around the car: what turns the pure, close-up engine note into the sound of a car heard from
// a few metres away in a real street. Three parts, all native Web Audio nodes, so cheap on phones:
//
// - Echoes off the real buildings and walls next to the car. Rays from the car are marched through the
//   world's obstacle distance field (world.sdfAt); each hit becomes one delayed, panned tap, delayed by
//   how much longer the path car -> wall -> camera is than the direct one, and as loud as the path length
//   and the angle allow (a wall that reflects the sound towards the camera is heard best). The two side
//   taps feed each other a little: the flutter between the two house fronts of a narrow street.
// - A short outdoor reverb tail (a ConvolverNode with a made-up impulse response), more of it the more of
//   the surroundings are built up.
// - A gentle compressor on the whole car sound, the density of a car recorded at a track.
//
// Other players' cars send into the same reverb (more of it the further off they are), not the echoes.
//
// Seen from the drone above (C), the camera is 35-55 m off: the car is heard from a distance, the way a
// grandstand hears it. setFar(1) then takes the car itself down and thins its low end, brings the echoes
// and the reverb up and opens a second, longer tail (the whole street ringing), for us and other cars.

const C = 343;
// ray directions, degrees from straight ahead, positive to the right
const RAYS = [-90, 90, -40, 40, -140, 140, 0];
const MAXD = 45;           // metres: walls further off than this are not heard as an echo
const REFL = 0.6;          // share of the sound a house front sends back (2 dB under the first cut, Martin 2026-11-19)
const SLEW = 0.03;         // s/s: how fast an echo delay may glide (a 3% pitch bend at most)
// the drone view (setFar(1)): the car itself down by `dir` and its low end down `thin` dB, the echoes up
// by 1 + er, our reverb by 1 + rev, other cars' by 1 + remote, the long tail in at `tail`, and the
// compressor's make-up up by 1 + gain (it presses the denser sound down harder), so the drone view is
// about as loud as the chase camera
const FAR = { dir: 0.4, thin: 5, er: 0.8, rev: 1.5, remote: 1, tail: 0.6, gain: 0.25 };
// the chase camera dropped right back at top speed (setBack(1)): the echoes up by 1 + er and our reverb by
// 1 + rev, the car itself as it was (more room round it, Martin 2026-11-20; the growl that goes with it is
// in the synthesiser, its growl input). Fades out towards the drone view, which has its own.
const BACK = { er: 0.45, rev: 0.7 };
// the engine screaming towards its limiter (setRev(1)): the echoes up by 1 + er and our reverb by 1 + rev,
// growing from half the limiter revs (revRoom); not for the gear changes, which keep their size, and half
// as much (REV_DOWN) once shifted down, until back on the throttle (Martin 2026-11-20: "V2", and "V1" for
// the downshifts)
const REV = { er: 0.5, rev: 1.2 }, REV_DOWN = { er: 0.25, rev: 0.6 };

// how far the engine's revs are into the top half of their range, 0 at half the redline to 1 on it
// (eased in, so most of the room comes over the last third)
export function revRoom(rpm, redline) {
  const s = Math.min(1, Math.max(0, (rpm / redline - 0.5) / 0.5));
  return Math.pow(s, 1.3);
}

// how far the chase camera (src/main.js) has dropped back from where it sits with the car at a standstill
// (6.4 m behind, 2.35 m up, and a car's own cam offsets), as 0..1 over the 7 m it backs off by top speed.
// dist: the camera's distance from the car (m); cam: the car's spec.cam
export function chaseBack(dist, cam = {}) {
  const rest = Math.hypot(6.4 + (cam.dist ?? 0), 2.35 + (cam.up ?? 0));
  return Math.min(1, Math.max(0, (dist - rest) / 7));
}

// Impulse response of an open, built-up place: decorrelated noise in both ears dying away over `len`
// seconds, its top end dying faster than its body (air and soft surfaces take the highs first).
// (hf: how fast the top end dies; seed: another seed gives a tail uncorrelated with the first)
function makeIR(ctx, len = 1.3, rt = 1.05, hf = 2.2, seed = 9001) {
  const sr = ctx.sampleRate, n = Math.round(len * sr), ir = ctx.createBuffer(2, n, sr);
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0, e = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const fc = 9000 * Math.exp(-t * hf) + 900;                  // low-pass corner falling with time
      const a = 1 - Math.exp(-2 * Math.PI * fc / sr);
      lp += (rnd() - lp) * a;
      const env = Math.exp(-6.9 * t / rt) * Math.min(1, t / 0.012) * (1 - Math.max(0, (t - len + 0.1) / 0.1));
      d[i] = lp * env;
      e += d[i] * d[i];
    }
    const k = 1 / Math.sqrt(e || 1);
    for (let i = 0; i < n; i++) d[i] *= k;
  }
  return ir;
}

// mix: { er, tail } multipliers on the echoes and the tail (1, 1 in the game; tools/engine-space-demo.mjs)
export function createSpace(ctx, out, mix = {}) {
  const erMix = mix.er ?? 1, tailMix = mix.tail ?? 1;
  const input = ctx.createGain();          // our own car
  const remoteIn = ctx.createGain();       // other cars, already placed by distance: reverb only
  // dry path through the compressor (or round it when switched off)
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.16;
  const makeup = ctx.createGain(); makeup.gain.value = 0.6;   // (the compressor adds its own make-up gain)
  const viaComp = ctx.createGain(), bypass = ctx.createGain();
  comp.connect(makeup).connect(viaComp).connect(out);
  bypass.connect(out);
  // the car itself, which the drone view takes down and thins (a car far off has less body)
  const dirShelf = ctx.createBiquadFilter(); dirShelf.type = 'lowshelf'; dirShelf.frequency.value = 260; dirShelf.gain.value = 0;
  const dir = ctx.createGain();
  input.connect(dirShelf).connect(dir).connect(comp); input.connect(bypass);

  // echoes: one shared band filter (walls send back little deep bass towards a listener this close, and
  // the brick and glass soften the very top), then a delay, level and pan per ray
  const erSend = ctx.createGain();
  // (and the room the revs add, setRev: a gain of its own, so it can let go at once for a gear change)
  const roomEr = ctx.createGain(), roomRev = ctx.createGain();
  const erHp = ctx.createBiquadFilter(); erHp.type = 'highpass'; erHp.frequency.value = 120; erHp.Q.value = 0.6;
  const erLp = ctx.createBiquadFilter(); erLp.type = 'lowpass'; erLp.frequency.value = 6500; erLp.Q.value = 0.5;
  input.connect(erSend).connect(roomEr).connect(erHp).connect(erLp);
  const taps = RAYS.map((deg) => {
    const delay = ctx.createDelay(0.4), gain = ctx.createGain();
    gain.gain.value = 0; delay.delayTime.value = 0.02;
    erLp.connect(delay).connect(gain);
    let node = gain;
    if (ctx.createStereoPanner) { const pan = ctx.createStereoPanner(); gain.connect(pan); node = pan; }
    node.connect(comp); node.connect(bypass);
    return { deg, delay, gain, pan: node === gain ? null : node, cur: 0.02, want: 0.02, g: 0, hold: 0, d: -1 };
  });
  // flutter: each side wall's echo goes on to the other side
  const flutter = [ctx.createGain(), ctx.createGain()];
  flutter[0].gain.value = flutter[1].gain.value = 0;
  taps[0].gain.connect(flutter[0]).connect(taps[1].delay);
  taps[1].gain.connect(flutter[1]).connect(taps[0].delay);

  // tail
  const revSend = ctx.createGain(); revSend.gain.value = 0;
  const remoteSend = ctx.createGain(); remoteSend.gain.value = 0;
  const revHp = ctx.createBiquadFilter(); revHp.type = 'highpass'; revHp.frequency.value = 180; revHp.Q.value = 0.6;
  const pre = ctx.createDelay(0.2); pre.delayTime.value = 0.03;
  const conv = ctx.createConvolver(); conv.normalize = false; conv.buffer = makeIR(ctx);
  const revOut = ctx.createGain(); revOut.gain.value = 0.6;
  input.connect(revSend).connect(roomRev).connect(revHp);
  // short loud bursts (the turbo blow-off) go round the compressor, so they punch through the engine
  // instead of pressing it down, but into the echoes and the reverb all the same
  const burst = ctx.createGain(), burstDir = ctx.createGain();
  burst.connect(burstDir).connect(out); burst.connect(erSend); burst.connect(revSend);
  remoteIn.connect(remoteSend).connect(revHp);
  revHp.connect(pre).connect(conv).connect(revOut);
  revOut.connect(comp); revOut.connect(bypass);
  // the drone view's long tail: brighter and slower to die than the street's own, after a longer gap
  // (silent, and so idle, in the chase view)
  const farSend = ctx.createGain(); farSend.gain.value = 0;
  const farPre = ctx.createDelay(0.2); farPre.delayTime.value = 0.06;
  const farConv = ctx.createConvolver(); farConv.normalize = false; farConv.buffer = makeIR(ctx, 2.4, 2.1, 1.1, 4711);
  const farOut = ctx.createGain(); farOut.gain.value = 0.6;
  revHp.connect(farSend).connect(farPre).connect(farConv).connect(farOut);
  farOut.connect(comp); farOut.connect(bypass);

  // v: the echoes, reverb and compression on our own car (off: its plain, close-up sound, as before any of
  // this; the electric cars, and the lite sound); remote: other players' cars into the reverb
  let on = true, remoteOn = true, far = 0, back = 0;
  const erGain = () => erMix * (1 + FAR.er * far + BACK.er * back * (1 - far));
  function setOn(v, remote = v) {
    on = v; remoteOn = remote;
    const t = ctx.currentTime;
    viaComp.gain.setTargetAtTime(on ? 1 : 0, t, 0.03);
    bypass.gain.setTargetAtTime(on ? 0 : 1, t, 0.03);
    erSend.gain.setTargetAtTime(on ? erGain() : 0, t, 0.03);
    remoteSend.gain.setTargetAtTime(remote ? tailMix * (1 + FAR.remote * far) : 0, t, 0.05);
    if (!on) revSend.gain.setTargetAtTime(0, t, 0.05);
    setFar(far, true);
  }

  // k: 0 for the chase camera close behind the car, 1 for the drone view far above it (eased by the caller)
  function setFar(k, force) {
    k = Math.max(0, Math.min(1, k));
    if (!force && Math.abs(k - far) < 0.01 && k !== 0 && k !== 1) return;
    if (!force && k === far) return;
    far = k;
    const t = ctx.currentTime;
    dir.gain.setTargetAtTime(1 - FAR.dir * far, t, 0.1);
    makeup.gain.setTargetAtTime(0.6 * (1 + FAR.gain * far), t, 0.1);
    burstDir.gain.setTargetAtTime(1 - FAR.dir * far, t, 0.1);
    dirShelf.gain.setTargetAtTime(-FAR.thin * far, t, 0.1);
    if (on) erSend.gain.setTargetAtTime(erGain(), t, 0.1);
    if (remoteOn) remoteSend.gain.setTargetAtTime(tailMix * (1 + FAR.remote * far), t, 0.1);
    // (exactly 0 once faded, so the long tail's convolver goes idle)
    farSend.gain.cancelScheduledValues(t);
    farSend.gain.setTargetAtTime(remoteOn ? tailMix * FAR.tail * far : 0, t, 0.1);
    if (far === 0 || !remoteOn) farSend.gain.setValueAtTime(0, t + 1);
  }
  setOn(true);

  // k: revRoom (0..1) of our engine's revs; gear: a gear change is being heard (src/audio-shift.js), which
  // keeps the size it always had: the room lets go of it in 30 ms and comes back over a quarter second;
  // down: shifted down and not yet back on the throttle (the smaller room)
  const room = mix.room || REV, roomDown = mix.roomDown || REV_DOWN;
  let rev = 0, soft = 0;
  function setRev(k, gear, down = 0) {
    const want = gear || !on ? 0 : Math.max(0, Math.min(1, k)), sd = down ? 1 : 0;
    if (Math.abs(want - rev) < 0.01 && want !== 0 && sd === soft) return;
    if (want === rev && sd === soft) return;
    const t = ctx.currentTime, tc = want < rev ? 0.03 : 0.25, r = sd ? roomDown : room;
    rev = want; soft = sd;
    roomEr.gain.setTargetAtTime(1 + r.er * rev, t, tc);
    roomRev.gain.setTargetAtTime(1 + r.rev * rev, t, tc);
  }

  // k: 0 with the chase camera where it sits at a standstill, 1 dropped right back at top speed (chaseBack)
  function setBack(k) {
    k = Math.max(0, Math.min(1, k));
    if (Math.abs(k - back) < 0.02 && k !== 0 && k !== 1) return;
    if (k === back) return;
    back = k;
    if (on) erSend.gain.setTargetAtTime(erGain(), ctx.currentTime, 0.15);
  }

  // ---- probing the surroundings
  const grad = [0, 0];
  function cast(world, x, z, dx, dz) {
    let t = 1.2;
    while (t < MAXD) {
      const s = world.sdfAt(x + dx * t, z + dz * t);
      if (s < 0.6) return t;
      t += Math.max(0.5, s * 0.9);
    }
    return -1;
  }

  // world: sdfAt / sdfGrad; car: x, z, yaw (and y); cam: the camera (THREE), where the ears are; dt: s
  // since the last call. Returns the share of the rays that found a wall (for tests).
  function update(world, car, cam, dt) {
    const t = ctx.currentTime;
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = -fz, rz = fx;
    const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z, cyc = (car.y ?? cy) + 0.4;
    const m = cam.matrixWorld.elements;
    const direct = Math.max(1.5, Math.hypot(car.x - cx, cyc - cy, car.z - cz));
    let walls = 0, wsum = 0, near = 0;
    for (const tp of taps) {
      const a = tp.deg * Math.PI / 180, dx = fx * Math.cos(a) + rx * Math.sin(a), dz = fz * Math.cos(a) + rz * Math.sin(a);
      const d = on ? cast(world, car.x, car.z, dx, dz) : -1;
      let g = 0;
      if (d > 0) {
        const hx = car.x + dx * d, hz = car.z + dz * d;
        const back = Math.hypot(hx - cx, cyc - cy, hz - cz), path = d + back;
        world.sdfGrad(hx, hz, grad);
        // the way a mirror-flat wall would send this ray on, against the way to the camera
        const dn = dx * grad[0] + dz * grad[1];
        const ox = dx - 2 * dn * grad[0], oz = dz - 2 * dn * grad[1];
        const spec = Math.max(0, (ox * (cx - hx) + oz * (cz - hz)) / Math.max(0.1, back));
        g = REFL * Math.min(1, direct / path) * (0.3 + 0.7 * spec * spec) * Math.min(1, (MAXD - d) / 10);
        tp.want = Math.min(0.35, (path - direct) / C + 0.002);
        if (tp.pan) {
          const side = ((hx - cx) * m[0] + (cyc - cy) * m[1] + (hz - cz) * m[2]) / Math.max(0.5, back);
          tp.pan.pan.setTargetAtTime(Math.max(-0.9, Math.min(0.9, side * 0.9)), t, 0.08);
        }
        walls += Math.min(1, (MAXD - d) / 25); wsum += d; near++;
      }
      // a small change glides (the true pitch bend of a wall coming closer); a jump (a gap between houses,
      // a new wall) fades out, moves the delay and fades back in
      if (g > 0 && tp.g > 0.001 && Math.abs(tp.want - tp.cur) > 0.008) {
        if (t >= tp.hold) {
          tp.gain.gain.setTargetAtTime(0, t, 0.015);
          tp.hold = t + 0.06; tp.cur = tp.want;
          tp.delay.delayTime.setValueAtTime(tp.cur, t + 0.055);
          tp.gain.gain.setTargetAtTime(g, t + 0.06, 0.04);
        }
      } else if (t >= tp.hold) {
        if (tp.g <= 0.001 && g > 0) { tp.cur = tp.want; tp.delay.delayTime.setValueAtTime(tp.cur, t); }
        else {
          const step = SLEW * Math.max(dt, 1 / 120);
          tp.cur += Math.max(-step, Math.min(step, tp.want - tp.cur));
          tp.delay.delayTime.setTargetAtTime(tp.cur, t, 0.03);
        }
        tp.gain.gain.setTargetAtTime(g, t, g > tp.g ? 0.08 : 0.05);
      }
      tp.g = g; tp.d = d;
    }
    // flutter only between two facing walls, and less the wider the street
    const L = taps[0].d, R = taps[1].d;
    const fl = L > 0 && R > 0 ? 0.3 * Math.min(1, 14 / (L + R)) : 0;
    flutter[0].gain.setTargetAtTime(fl, t, 0.1); flutter[1].gain.setTargetAtTime(fl, t, 0.1);
    // the tail: a little everywhere (trees, the ground, far houses), much more between buildings
    const built = walls / taps.length;
    if (on) revSend.gain.setTargetAtTime((0.126 + 0.294 * built) * tailMix * (1 + FAR.rev * far + BACK.rev * back * (1 - far)), t, 0.3);   // (3 dB under the first cut, Martin 2026-11-19)
    if (near) pre.delayTime.setTargetAtTime(Math.min(0.08, 0.012 + 2 * (wsum / near) / C), t, 0.3);
    return built;
  }

  return {
    input, remoteIn, burst, update, setOn, setFar, setBack, setRev,
    get on() { return on; },
    get far() { return far; },
    get back() { return back; },
    get rev() { return rev; },
    // (for tests)
    get taps() { return taps.map((x) => ({ deg: x.deg, d: x.d, g: x.g, delay: x.cur })); },
    get tail() { return revSend.gain.value; },
  };
}
