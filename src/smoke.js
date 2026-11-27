// Tyre smoke: soft puffs that rise from a tyre rubbing hard on paving (a burnout, a donut, a long slide or
// locked rear wheels). The tyres have to warm up first, so a short chirp makes none and a held burnout
// builds a drifting cloud. Kept thin on purpose: every puff is nearly transparent and they only add up.
// A diesel with a failing particulate filter (spec.dpfSmoke) also blows black soot out of its tailpipe
// whenever the throttle goes down: only a wisp at first, building over a couple of seconds into a thick
// cloud that keeps rolling out while the pedal is held. A gear change cuts it and it builds up again,
// and at speed the wind thins it out.
// A car with spec.exhaust.flame also spits a small flame from its tailpipe when a downshift crackles (the
// unburnt fuel of the blip going off in the hot exhaust): a quick lick or two, drawn with the same points.
// And the white cloud a Rocket's thrusters blow up off the ground as it lifts off and sets down (mist), and the
// dust its suction fans pull off loose ground and blow out behind it (fanDust).
// And a car on its roof after a crash (src/cars/crash.js): a cloud of dust as it comes down, then steam from
// its engine for a while (wreck).
import * as THREE from 'three';
import { onRoof } from './cars/crash.js';
import { NOZ_DOWN, NOZZLES } from './cars/thrust.js';

const MAX = 700;           // puffs alive at once
const RUB0 = 2.5;          // m/s of tread sliding before a tyre makes any smoke
const RUB1 = 13;           // ... and where it makes the most
const MIST_RATE = 32;      // puffs per second from one of a Rocket's corner nozzles blowing hard at the ground...
const MIST_UP = 4;         // ...from under this many metres up
const MIST_LAND = 0.7;     // ...and this much more of them from a car coming down (the landing burn)
const MIST_LIFT = 0.5;     // ...or from one lifting off, whose steam also rises more
const BOIL_RATE = 26;      // puffs per second of a Rocket's BOOST blowing under water, boiling up at the surface over its tail
const FAN_DUST = 16;       // puffs per second from a fan car's suction fans at full speed on gravel...
const FAN_GROUND = [0, 0, 1, 0.7];   // ...and each ground's share of that: grass, paving, gravel, dirt (physics.js SURF)
const DUST = -0.85;        // a puff's shade for dust (below 0: towards the dust colour)
const RATE = 24;           // puffs per second from one tyre at full smoke
const WARM = 1.1;          // seconds for a tyre to come up to smoking heat
const COOL = 0.7;
const SOOT_BUILD = 1.8;    // seconds of held throttle for a diesel's soot to come up to full
const SOOT_FADE = 0.2;     // ... and to die away on a lift or a gear change
const FAR = 350;           // metres: other players' cars further off than this make no smoke here
const THIN0 = 8, THIN = 35; // m/s: where the wind starts thinning the soot, and how fast (0.64 at 100 km/h)
const POP0 = 0.18;         // how loud the crackle (car.exhaustPop, set by audio.js) must be before a flame shows
const POP_RATE = 34;       // flame licks per second at the loudest crackle

// One car's soot state (the player's own, or another player's car rebuilt from what it sends).
export const sootState = () => ({ sootOwed: 0, build: 0 });
// Steps the build-up and returns how hard the pipe is smoking, 0..1. The pedal counts as lifted
// during a gear change, so the smoke cuts and has to build up again afterwards.
export function sootStep(st, car, dt) {
  const thr = car.shiftTimer > 0 || car.reversing ? 0 : car.throttle || 0;
  if (thr > st.build) st.build = Math.min(thr, st.build + dt / SOOT_BUILD);
  else st.build = Math.max(thr, st.build - dt / SOOT_FADE);
  // (slow off the mark, then it pours: most of the cloud arrives in the second half of the build-up)
  return thr > 0.02 ? Math.min(1, 0.05 * thr + 0.95 * Math.pow(st.build, 1.6)) : 0;
}

export function createSmoke(world) {
  const pos = new Float32Array(MAX * 3), size = new Float32Array(MAX), alpha = new Float32Array(MAX);
  const vel = new Float32Array(MAX * 3), age = new Float32Array(MAX), life = new Float32Array(MAX).fill(-1);
  const s0 = new Float32Array(MAX), s1 = new Float32Array(MAX), a0 = new Float32Array(MAX), gy = new Float32Array(MAX);
  const shade = new Float32Array(MAX), rise = new Float32Array(MAX);
  const geo = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3), aSize = new THREE.BufferAttribute(size, 1), aAlpha = new THREE.BufferAttribute(alpha, 1);
  const aShade = new THREE.BufferAttribute(shade, 1);
  for (const a of [aPos, aSize, aAlpha, aShade]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPos); geo.setAttribute('aSize', aSize); geo.setAttribute('aAlpha', aAlpha); geo.setAttribute('aShade', aShade);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uHalfH: { value: 400 }, uColor: { value: new THREE.Color(0xdcd9e6) }, uSoot: { value: new THREE.Color(0x1b1a19) }, uDust: { value: new THREE.Color(0xe9dfcd) },
      uFire: { value: new THREE.Color(0xff5a12) }, uCore: { value: new THREE.Color(0xfff0b8) } },
    vertexShader: `
      attribute float aSize; attribute float aAlpha; attribute float aShade;
      uniform float uHalfH; varying float vAlpha; varying float vShade;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uHalfH * projectionMatrix[1][1] / max(0.1, -mv.z);
        // (a puff right against the camera would fill the screen: let it thin out instead)
        vAlpha = aAlpha * smoothstep(0.6, 2.5, -mv.z);
        vShade = aShade;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform vec3 uSoot; uniform vec3 uDust; uniform vec3 uFire; uniform vec3 uCore; varying float vAlpha; varying float vShade;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(p, p);
        if (r2 > 1.0) discard;
        // soft ball, a little denser low down so it reads as a rolling cloud rather than a disc
        float a = (1.0 - r2) * (1.0 - r2) * (0.85 + 0.15 * p.y) * vAlpha;
        // (shade 0..1 is smoke to soot, below 0 dust)
        gl_FragColor = vec4(mix(uColor, vShade < 0.0 ? uDust : uSoot, min(abs(vShade), 1.0)) * (0.92 - 0.1 * p.y), a);
        // (shade 2..3 is a flame, 3 the hottest: a pale core in an orange ball, with a harder edge than smoke)
        if (vShade > 1.5) {
          float core = (1.0 - r2) * (1.0 - r2);
          gl_FragColor = vec4(mix(uFire, uCore, clamp(core * (0.35 + 0.9 * (vShade - 2.0)), 0.0, 1.0)), sqrt(1.0 - r2) * vAlpha);
        }
        #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 3;
  points.onBeforeRender = (renderer) => { mat.uniforms.uHalfH.value = renderer.getDrawingBufferSize(_v).y / 2; };
  const _v = new THREE.Vector2();

  let next = 0, alive = 0, fresh = false;
  // how much smoke is made, 1 = all of it: the graphics auto mode thins it out on a machine that
  // can't keep up (fewer puffs, and other cars' smoke only from close by), see setDetail
  let thinK = 1, far = FAR;
  // one car's tyres: how hot each axle is, and the puffs each wheel still owes
  const tyreState = () => ({ heat: [0, 0], owed: [0, 0, 0, 0] });
  const myTyres = tyreState();

  function puff(x, y, z, vx, vy, vz, strength, dark = 0) {
    const i = next; next = (next + 1) % MAX; fresh = true;
    shade[i] = dark; rise[i] = dark > 0 ? 0.3 : dark < 0 ? 0.2 : 0.55;   // (soot and dust are heavier than smoke)
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    age[i] = 0; life[i] = 1.7 + Math.random() * 1.5;
    s0[i] = 0.4 + Math.random() * 0.25; s1[i] = 1.6 + Math.random() * 1.3 + strength * 0.8;
    a0[i] = (0.1 + 0.2 * strength) * (0.7 + 0.6 * Math.random());
    gy[i] = y;
    if (dark > 0) {
      // soot: starts as a tight jet, swells into a heavy, dark cloud that hangs about
      s0[i] = 0.12 + Math.random() * 0.1; s1[i] = 1.3 + Math.random() * 1.2 + strength * 1.2;
      a0[i] = (0.3 + 0.45 * strength) * (0.75 + 0.5 * Math.random());
      life[i] = 2.2 + Math.random() * 1.8;
    }
  }
  // black smoke from a tired diesel's tailpipe; st keeps one car's puffing state (the player's own, or
  // another player's car rebuilt from what it sends)
  const mine = sootState();
  const theirs = new Map();
  function exhaust(car, dt, st = mine) {
    let { sootOwed } = st;
    const strength = sootStep(st, car, dt);
    exhaustStep();
    st.sootOwed = sootOwed;
    function exhaustStep() {
    const s = car.spec, ex = s.exhaust;
    // at speed the airstream tears the cloud apart: the same soot, spread thinner
    const thin = 1 / (1 + Math.max(0, Math.abs(car.vx) - THIN0) / THIN);
    if (strength < 0.04 || car.reversing) { sootOwed = 0; return; }
    sootOwed += (16 + 44 * strength) * thinK * dt;
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), sx = Math.cos(car.yaw), sz = Math.sin(car.yaw);
    const along = -(car.b + ex.back);
    const x = car.x + fx * along + sx * ex.x, z = car.z + fz * along + sz * ex.x;
    const gyy = world.groundAt(x, z, car.y + 0.4), y = gyy + ex.y;
    const wvx = fx * car.vx + sx * car.vy, wvz = fz * car.vx + sz * car.vy;
    while (sootOwed >= 1) {
      sootOwed -= 1;
      const r = () => Math.random() - 0.5, k = 1.2 + 1.6 * strength;
      // blown back and down out of the pipe, carried a little with the car
      puff(x + r() * 0.08, y, z + r() * 0.08, wvx * 0.55 - fx * k + r() * 0.6, 0.05 + Math.random() * 0.3, wvz * 0.55 - fz * k + r() * 0.6, strength, 1);
      gy[(next + MAX - 1) % MAX] = gyy; a0[(next + MAX - 1) % MAX] *= thin;
    }
    }
  }

  // a downshift's crackle seen: licks of flame at the tailpipe, more of them the louder it crackles, and one
  // bigger burp as it starts. Each lick is a few small hot balls blown back out of the pipe that shrink and
  // cool within a tenth of a second. Only the player's own car (the crackle is not sent to other players).
  // A rally car's anti-lag bangs on a lift (engine-worklet.js, cfg.antilag) are seen too: each big bang the engine
  // tells of (car.exhaustBangs, a count) blows a ball of flame out, as big as the burp. spec.exhaust.flameSize
  // scales every flame (the Focus WRC's a touch bigger than the 22B's, Martin 2026-11-27).
  let popOwed = 0, popWas = 0, bangWas = 0, bangOwed = 0;
  function flames(car, dt) {
    const ex = car.spec.exhaust, pop = car.exhaustPop || 0, bangs = car.exhaustBangs || 0;
    const start = pop >= POP0 && popWas < POP0;
    popWas = pop;
    // (at most two at once: a frame that came late, or a new car, does not empty a backlog)
    if (bangs > bangWas && !car.reversing) bangOwed = Math.min(2, bangOwed + bangs - bangWas);
    bangWas = bangs;
    if (pop < POP0 || car.reversing) popOwed = 0;
    else popOwed += POP_RATE * (pop - POP0) / (1 - POP0) * Math.max(0.5, thinK) * dt + (start ? 1 : 0);
    if (popOwed < 1 && bangOwed < 1) return;
    const fs = ex.flameSize || 1;
    // the pipe's end in the world: the model stands on the middle of the wheelbase, pitched with the body
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), sx = Math.cos(car.yaw), sz = Math.sin(car.yaw);
    const cp = Math.cos(car.pitch || 0), sp = Math.sin(car.pitch || 0), lz = car.spec.wheelbase / 2 + ex.back;
    const along = car.a - car.spec.wheelbase / 2 - (ex.y * sp + lz * cp);
    const x = car.x + fx * along + sx * ex.x, z = car.z + fz * along + sz * ex.x, y = car.y + ex.y * cp - lz * sp;
    const wvx = fx * car.vx + sx * car.vy, wvz = fz * car.vx + sz * car.vy;
    while (popOwed >= 1 || bangOwed >= 1) {
      // (a bang: the size of the burp, give or take, and blown out harder)
      const bang = popOwed < 1;
      if (bang) bangOwed -= 1; else popOwed -= 1;
      const burp = start || bang;
      const big = fs * (bang ? 1.25 + 0.45 * Math.random() : start ? 1.5 : 0.75 + 0.5 * Math.random()), n = burp ? 4 : 2;
      const jet = (bang ? 2.5 : 1.5) + 1.5 * Math.random();
      for (let k = 0; k < n; k++) {
        const i = next; next = (next + 1) % MAX; fresh = true;
        const r = () => (Math.random() - 0.5) * 0.02, back = 0.02 + k * 0.03 * big;
        shade[i] = 3 - 0.3 * k; rise[i] = 0; gy[i] = -1e9;
        pos[i * 3] = x - fx * back + r(); pos[i * 3 + 1] = y + r(); pos[i * 3 + 2] = z - fz * back + r();
        // (it has to keep up with the car: the car's own speed, and blown back out of the pipe)
        vel[i * 3] = wvx - fx * jet; vel[i * 3 + 1] = 0.25; vel[i * 3 + 2] = wvz - fz * jet;
        // (update() below moves it a step in this same frame: start it the car's own step back, or at
        // speed its first frame is drawn half a metre ahead of the pipe, inside the car)
        pos[i * 3] -= wvx * dt; pos[i * 3 + 2] -= wvz * dt;
        age[i] = 0; life[i] = (0.05 + 0.04 * Math.random()) * (burp ? 1.3 : 1) * Math.sqrt(fs);
        s0[i] = (0.13 - 0.022 * k) * big; s1[i] = s0[i] * 0.45; a0[i] = 0.92 - 0.12 * k;
      }
    }
  }

  // tyre smoke from one car (ours, or another player's rebuilt from what it sends)
  function tyres(car, dt, st) {
    const { heat, owed } = st;
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), sx = Math.cos(car.yaw), sz = Math.sin(car.yaw);
    const ht = car.spec.track / 2;
    // the car's velocity in the world (vx along the car, vy across it, as in the physics)
    const wvx = fx * car.vx + sx * car.vy, wvz = fz * car.vx + sz * car.vy;
    for (let ax = 0; ax < 2; ax++) {
      const front = ax === 0;
      const rub = (front ? car.rubF : car.rubR) || 0;
      const on = Math.max(0, Math.min(1, (rub - RUB0) / (RUB1 - RUB0)));
      heat[ax] += ((on > 0 ? 1 : 0) - heat[ax]) * Math.min(1, dt / (on > 0 ? WARM : COOL));
      const strength = heat[ax] * heat[ax] * Math.sqrt(on);
      if (strength < 0.03) { owed[ax * 2] = owed[ax * 2 + 1] = 0; continue; }
      const spin = Math.min(6, (front ? car.slipVF : car.slipVR) || 0);
      for (let sd = 0; sd < 2; sd++) {
        const w = ax * 2 + sd, along = front ? car.a : -car.b, side = sd ? ht : -ht;
        const x = car.x + fx * along + sx * side, z = car.z + fz * along + sz * side;
        owed[w] += RATE * thinK * strength * dt;
        if (owed[w] < 1) continue;
        if (world.surfaceAt(x, z) !== 1) { owed[w] = 0; continue; }
        const y = world.groundAt(x, z, car.y + 0.4);
        while (owed[w] >= 1) {
          owed[w] -= 1;
          // thrown back off the tread, carried along with the car for a moment, then left hanging
          const r = () => Math.random() - 0.5;
          puff(x + r() * 0.2, y + 0.12, z + r() * 0.2,
            wvx * 0.28 - fx * spin * 0.3 + r() * 1.1, 0.5 + Math.random() * 0.7, wvz * 0.28 - fz * spin * 0.3 + r() * 1.1, strength);
        }
      }
    }
  }

  // A Rocket's corner nozzles blowing at the ground (src/cars/thrust.js: the lift-off push, the landing burn):
  // the cold gas has nowhere to go but out over the road, as a white cloud rolling away from under the car (in
  // Tesla's film the car leaves one where it took off and sets down in another). noz: how hard each of the
  // car's nozzles blows; owed: the puffs each corner still owes.
  function mist(car, noz, owed, dt) {
    let any = false;
    for (let i = NOZ_DOWN; i < NOZ_DOWN + 4; i++) if (noz[i] > 0.25) any = true;
    if (!any) return;
    const gyc = world.groundAt(car.x, car.z, car.y + 0.4), up = car.y - gyc;
    if (up > MIST_UP) return;
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), sx = Math.cos(car.yaw), sz = Math.sin(car.yaw);
    const mid = car.a - car.spec.wheelbase / 2, wvx = fx * car.vx + sx * car.vy, wvz = fz * car.vx + sz * car.vy;
    // (the nearer the ground, the more of the jet is turned aside into the cloud)
    const near = 1 - 0.7 * Math.max(0, up) / MIST_UP;
    // (coming down, the landing burn pushes out more of it and further than the lift-off did: Martin 25 Nov, from
    // Tesla's film. The car is coming down when it is lower than it was at the last look.)
    const land = owed.up !== undefined && up < owed.up - 1e-3 ? 1 : 0;
    // (and the lift-off push stands in its own steam: more of it, and rising. Martin 26 Nov: "a bit more steamy")
    const off = !land && up < 2.5 ? 1 : 0;
    owed.up = up;
    for (let i = 0; i < 4; i++) {
      const k = noz[NOZ_DOWN + i];
      if (k <= 0.25) { owed[i] = 0; continue; }
      owed[i] += MIST_RATE * (1 + MIST_LAND * land + MIST_LIFT * off) * Math.max(0.4, thinK) * k * near * dt;
      if (owed[i] < 1) continue;
      const N = NOZZLES[NOZ_DOWN + i], along = mid - N[2];
      const x = car.x + fx * along + sx * N[0], z = car.z + fz * along + sz * N[0];
      while (owed[i] >= 1) {
        owed[i] -= 1;
        // out along the ground, away from the middle of the car, any way round
        const a = Math.atan2(sz * N[0] - fz * N[2], sx * N[0] - fx * N[2]) + (Math.random() - 0.5) * 2.6, v = (3 + 6 * Math.random()) * (1 + 0.35 * land);
        puff(x, gyc + 0.15, z, wvx * 0.35 + Math.cos(a) * v, 0.4 + Math.random() * (1.2 + 1.6 * off), wvz * 0.35 + Math.sin(a) * v, 0.6 + 0.6 * k + 0.25 * land + 0.2 * off);
      }
    }
  }
  const myMist = [0, 0, 0, 0];

  // A Rocket's BOOST under water (src/cars/swim.js): the gas comes up as a boil of white water over and behind its
  // tail, which is also where a car on the river bed is seen to be. st: { owed }.
  function boil(car, noz, st, dt) {
    const k = (noz[0] + noz[1] + noz[2] + noz[3]) / 4;
    if (k < 0.05) { st.owed = 0; return; }
    st.owed += BOIL_RATE * k * Math.max(0.4, thinK) * dt;
    if (st.owed < 1) return;
    const wl = car.waterLevel ?? (world.waterLevelAt ? world.waterLevelAt(car.x, car.z) : world.meta.riverLevel);
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), sx = Math.cos(car.yaw), sz = Math.sin(car.yaw);
    const r = () => Math.random() - 0.5;
    while (st.owed >= 1) {
      st.owed -= 1;
      // (over the back half of the car and just behind it, where it reaches the top; the deeper the car, the wider it
      // has spread by then, and the camera behind looks across it at the car)
      const deep = Math.min(4, Math.max(0, wl - car.y)), b = car.b ?? car.spec.wheelbase / 2;
      const along = -b - 1 + Math.random() * (b + 1.5), across = r() * (1.8 + 0.5 * deep);
      puff(car.x + fx * along + sx * across, wl + 0.05, car.z + fz * along + sz * across, r() * 1.5, 0.3 + Math.random() * 0.5, r() * 1.5, 0.9 + 0.5 * k);
    }
  }
  const myBoil = { owed: 0 };

  // A fan car's suction fans (spec.fanDown) on loose ground (Martin 25 Nov: "on fine looser ground like gravel
  // should a bit throw up sand too"): they pull the air from under the floor, and the dust with it, and blow it
  // out behind the car. They never stop, so a haze hangs about a standing car too; run up by the pedal or by
  // speed they leave a thin trail. Light on purpose: a few of the same puffs as the smoke, sand coloured.
  // kind: the ground under the car (physics.js SURF); st: the puffs it still owes.
  function fanDust(car, kind, st, dt) {
    const share = car.fanOff ? 0 : FAN_GROUND[kind] || 0;
    if (!share) { st.owed = 0; return; }
    const fan = 0.5 + 0.5 * Math.max(car.throttle || 0, Math.min(1, Math.abs(car.vx) / 14));
    st.owed += FAN_DUST * share * fan * fan * thinK * dt;
    if (st.owed < 1) return;
    const gyc = world.groundAt(car.x, car.z, car.y + 0.4);
    if (car.y - gyc > 0.3) { st.owed = 0; return; }                 // (in the air: nothing under the floor to pull at)
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), sx = Math.cos(car.yaw), sz = Math.sin(car.yaw);
    const wvx = fx * car.vx + sx * car.vy, wvz = fz * car.vx + sz * car.vy, ht = car.spec.track / 2;
    while (st.owed >= 1) {
      st.owed -= 1;
      const r = () => Math.random() - 0.5;
      // most of it out from under the tail, some from under a sill
      const side = Math.random() < 0.3 ? Math.sign(r()) : 0;
      const along = side ? r() * car.spec.wheelbase * 0.8 + (car.a - car.b) / 2 : -(car.b + 0.4 + Math.random() * 0.6), across = side ? side * ht : r() * ht * 1.6;
      const out = (1.5 + 2.5 * Math.random()) * fan, bx = side ? sx * side : -fx, bz = side ? sz * side : -fz;
      puff(car.x + fx * along + sx * across, gyc + 0.12, car.z + fz * along + sz * across,
        wvx * 0.3 + bx * out + r() * 1.2, 0.3 + Math.random() * 0.6, wvz * 0.3 + bz * out + r() * 1.2, 0.5 + 0.6 * fan * share, DUST);
    }
  }
  const myFan = { owed: 0 };

  // A car lying on its roof (crash.js; ours or another player's, known by how its body is turned): dust thrown
  // up as the roof comes down, then steam rising from the engine, thinning out over half a minute.
  // st: { t: how long it has lain there, owed }. A dozen puffs, then at most 4 a second.
  function wreck(car, dt, st) {
    if (!onRoof(car)) { st.t = 0; st.owed = 0; return; }
    const r = () => Math.random() - 0.5;
    const gyc = world.groundAt(car.x, car.z, car.y + 0.4);
    if (!st.t) {
      for (let k = Math.round(12 * thinK); k > 0; k--) {
        const a = Math.random() * 6.283, d = 0.6 + Math.random() * 1.4;
        puff(car.x + Math.cos(a) * d, gyc + 0.15, car.z + Math.sin(a) * d, Math.cos(a) * (1.5 + 2 * Math.random()), 0.4 + Math.random() * 0.8, Math.sin(a) * (1.5 + 2 * Math.random()), 0.9, DUST);
      }
    }
    st.t += dt;
    if (st.t > 30) return;
    st.owed += 4 * Math.exp(-st.t / 9) * thinK * dt;
    while (st.owed >= 1) {
      st.owed -= 1;
      puff(car.x + r() * 1.4, gyc + 0.5, car.z + r() * 1.4, r() * 0.5, 0.7 + Math.random() * 0.6, r() * 0.5, 0.55);
    }
  }
  const myWreck = { t: 0, owed: 0 };

  // car: the player's car after its physics step; active: false while the game is not being driven
  // others: other players' cars, [car-like] (multiplayer.js remotes()); only the ones near enough to see
  function update(car, dt, active, others = []) {
    if (active && car && !car.inWater && car.spec.dpfSmoke) exhaust(car, dt);
    if (active && car && !car.inWater && car.spec.exhaust?.flame) flames(car, dt);
    for (const o of others) {
      if (car && (o.x - car.x) ** 2 + (o.z - car.z) ** 2 > far * far) continue;
      let st = theirs.get(o.id);
      if (!st) theirs.set(o.id, st = { soot: sootState(), tyres: tyreState() });
      if (o.inWater) { if (o.noz) boil(o, o.noz, st.boil || (st.boil = { owed: 0 }), dt); continue; }
      if (o.soot) exhaust(o, dt, st.soot);
      if (o.tyres) tyres(o, dt, st.tyres);
      if (o.noz) mist(o, o.noz, st.mist || (st.mist = [0, 0, 0, 0]), dt);
      if (o.spec.fanDown) fanDust(o, o.ground, st.fan || (st.fan = { owed: 0 }), dt);
      wreck(o, dt, st.wreck || (st.wreck = { t: 0, owed: 0 }));
    }
    if (theirs.size > others.length) for (const id of [...theirs.keys()]) if (!others.some((o) => o.id === id)) theirs.delete(id);
    if (active && car && !car.inWater) tyres(car, dt, myTyres);
    else myTyres.heat[0] = myTyres.heat[1] = 0;
    if (active && car && car.rocket && !car.inWater) mist(car, car.rocket.noz, myMist, dt);
    if (active && car && car.rocket && car.inWater) boil(car, car.rocket.noz, myBoil, dt);
    if (active && car && car.spec.fanDown && !car.inWater) fanDust(car, car.surface, myFan, dt);
    if (active && car) wreck(car, dt, myWreck);

    if (!alive && !fresh) return;
    alive = 0; fresh = false;
    const drag = Math.exp(-dt * 1.7);
    for (let i = 0; i < MAX; i++) {
      if (life[i] < 0) continue;
      const t = (age[i] += dt) / life[i];
      if (t >= 1) { life[i] = -1; size[i] = 0; alpha[i] = 0; continue; }
      alive++;
      if (shade[i] > 1.5) {
        // a flame: carried straight on, shrinking and cooling from pale yellow to orange as it goes out
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        size[i] = s0[i] + (s1[i] - s0[i]) * t; alpha[i] = a0[i] * (1 - t * t * t); shade[i] = Math.max(2, shade[i] - dt * 9);
        continue;
      }
      vel[i * 3] = vel[i * 3] * drag + 0.25 * dt; vel[i * 3 + 2] *= drag;
      vel[i * 3 + 1] += (rise[i] - vel[i * 3 + 1]) * Math.min(1, dt * 1.2);
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const s = s0[i] + (s1[i] - s0[i]) * (1 - Math.exp(-age[i] * 1.5));
      // (kept clear of the ground, or the road would cut the puff in half)
      if (pos[i * 3 + 1] < gy[i] + s * 0.36) pos[i * 3 + 1] = gy[i] + s * 0.36;
      size[i] = s;
      alpha[i] = a0[i] * Math.min(1, age[i] / 0.14) * Math.pow(1 - t, 1.4);
    }
    aPos.needsUpdate = aSize.needsUpdate = aAlpha.needsUpdate = aShade.needsUpdate = true;
    points.visible = alive > 0;
  }

  return { points, update, get count() { return alive; }, setDetail(k) { thinK = k; far = k < 0.5 ? 90 : k < 1 ? 180 : FAR; } };
}
