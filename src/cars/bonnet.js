// The Focus WRC's bonnet (Martin 2026-11-26): "the bonnet should pop up after a hit of 50 km/h or more to something,
// then it will stay up against the windscreen until you go over 100 km/h, after which it flies away". As Märtin's did
// on the 2003 Acropolis, where its pins worked loose over a bump on Elatia-Zeli and he drove the last 20 km with it
// flat against the screen (dirtfish, motorsport.com); his stayed on.
//
// Three states on the car (car.bonnet, made by createCar for a spec with `bonnet`):
//   shut  as built
//   up    after a hit of POP_KMH or more (car.hit, the speed into whatever it met, from every wall, car, prop and bale
//         in the game): it swings up on its hinges at the foot of the windscreen and lies on the glass, and drags
//   gone  once the car goes over OFF_KMH with it up: torn off, it flies up and back over the roof and lands on the
//         road behind; the open engine bay drags a little
// A fresh bonnet: a new car (the garage), or the car put somewhere far away (home, the stage's start: main.js place).
// R, putting it back where it went off the road, keeps the damage.
//
// bonnetStep is the physics' (stepCar calls it, so the tests can drive it without a page); bonnetView moves the model.
// Only our own car: another player's Focus is not told (the car is hidden, ?off=100, and stealth sends nothing).

export const POP_KMH = 50, OFF_KMH = 100;
const POP_V = POP_KMH / 3.6, OFF_V = OFF_KMH / 3.6;
const UP_MIN = 0.4;                               // s: up long enough to be seen on the glass, even when the hit left the car over 100
const UP_DRAG = 0.25, GONE_DRAG = 0.03;          // m2 of cdA added: a panel standing in the wind, then the open bay

export function bonnetStep(car) {
  const b = car.bonnet;
  if (b.state === 'shut' && car.hit >= POP_V) { b.state = 'up'; b.at = car.time; b.drag = UP_DRAG; b.hit = car.hit; }
  else if (b.state === 'up' && car.time - b.at > UP_MIN && Math.hypot(car.vx, car.vy) > OFF_V) { b.state = 'gone'; b.at = car.time; b.drag = GONE_DRAG; }
}

export function fixBonnet(car) {
  if (!car.bonnet) return;
  car.bonnet.state = 'shut'; car.bonnet.drag = 0; car.bonnet.at = car.time;
}

// ---------------------------------------------------------------- the model
const G = 9.81;
const K_SWING = 260, D_SWING = 12;               // the swing up: a stiff, lightly damped spring to the glass (a slam and a bounce)
const AIR = 0.045;                               // 1/m: how quickly the air slows a tumbling panel (a few kilos of carbon and kevlar over a square metre)
const LIFT = 0.006;                              // 1/m: and what it gives back upward while it is fast
const KEEP_S = 45;                               // seconds it lies on the road before it is taken away

// One frame: model the car's model ({ group, bonnet }), car the physics car, scene and world for the flight,
// sound(kind, level) the noises (audio.panel). Call every frame the car is drawn.
export function bonnetView(model, car, dt, scene, world, sound) {
  const m = model.bonnet, b = car.bonnet;
  if (!m || !b) return;
  const v = m.v || (m.v = { a: 0, va: 0, state: 'shut', fly: null, hinge: m.pivot.position.toArray(), t: 0 });
  if (b.state === 'shut' && v.state !== 'shut') putBack(model, v);
  if (b.state !== 'shut' && v.state === 'shut') { v.state = 'up'; v.va = 7; sound?.('pop', Math.min(1.3, (b.hit || POP_V) / 20)); }
  if (v.state === 'up') {
    v.t += dt;
    // the swing up, then held on the glass by the wind, fluttering more the faster the car goes
    const sp = Math.hypot(car.vx, car.vy), shake = Math.min(1, sp / OFF_V) * 0.035;
    const target = m.rest - shake * (0.5 + 0.5 * Math.sin(v.t * 37) * Math.sin(v.t * 11.3));
    for (let k = 0, n = Math.ceil(dt / 0.004); k < n; k++) {
      const h = dt / n;
      v.va += (K_SWING * (target - v.a) - D_SWING * v.va) * h;
      v.a += v.va * h;
      if (v.a > m.rest) { v.a = m.rest; if (v.va > 0) v.va *= -0.3; }   // (the glass stops it)
    }
    m.pivot.rotation.x = v.a;
    if (b.state === 'gone') tearOff(model, car, v, scene, sound);
  }
  if (v.state === 'gone' && v.fly) fly(v, dt, world, scene, sound);
}

function tearOff(model, car, v, scene, sound) {
  const m = model.bonnet, p = m.pivot;
  model.group.updateMatrixWorld(true);
  scene.attach(p);                                // (keeps where it is in the world)
  p.updateMatrixWorld(true);
  // it tumbles about its middle: the pivot goes there and the panel's meshes move back by as much
  const c = p.localToWorld(p.position.clone().set(m.mid[0], m.mid[1], m.mid[2]));
  for (const ch of p.children) ch.position.set(-m.mid[0], -m.mid[1], -m.mid[2]);
  p.position.copy(c);
  const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
  v.fly = {
    vx: car.vx * fx + car.vy * rx, vy: 2.5 + Math.random() * 1.5, vz: car.vx * fz + car.vy * rz,
    wx: -(7 + Math.random() * 5), wy: (Math.random() - 0.5) * 3, wz: (Math.random() - 0.5) * 4,
    down: false, rest: 0, bounces: 0,
  };
  v.obj = p; v.state = 'gone';
  sound?.('tear', 1);
}

function fly(v, dt, world, scene, sound) {
  const f = v.fly, P = v.obj;
  if (!P) return;
  if (!f.down) {
    const sp = Math.hypot(f.vx, f.vy, f.vz);
    f.vx -= AIR * sp * f.vx * dt; f.vz -= AIR * sp * f.vz * dt;
    f.vy += (-G - AIR * sp * f.vy + (f.bounces ? 0 : LIFT * sp * sp)) * dt;
    P.position.x += f.vx * dt; P.position.y += f.vy * dt; P.position.z += f.vz * dt;
    P.rotation.x += f.wx * dt; P.rotation.y += f.wy * dt; P.rotation.z += f.wz * dt;
    const gy = (world.groundAt ? world.groundAt(P.position.x, P.position.z, P.position.y + 0.5) : world.heightAt(P.position.x, P.position.z)) + 0.04;
    if (P.position.y < gy && f.vy < 0) {
      P.position.y = gy;
      f.bounces++;
      sound?.('land', Math.min(1.3, -f.vy / 6));
      if (f.bounces >= 3 || Math.hypot(f.vx, f.vz) < 2) {
        // down: it lies flat, face up or face down as it fell
        f.down = true;
        const up = Math.cos(P.rotation.x) * Math.cos(P.rotation.z) >= 0;
        P.rotation.set(up ? 0 : Math.PI, P.rotation.y, 0);
      } else { f.vy *= -0.3; f.vx *= 0.55; f.vz *= 0.55; f.wx *= -0.5; f.wy *= 0.5; f.wz *= 0.5; }
    }
  } else if ((f.rest += dt) > KEEP_S) { scene.remove(P); v.fly = null; }   // (kept for a fresh bonnet: putBack)
}

// a fresh bonnet back on its hinges (the one on the road, if any, is taken away)
function putBack(model, v) {
  const m = model.bonnet, p = m.pivot;
  if (p.parent !== model.group) { p.parent?.remove(p); model.group.add(p); }
  for (const ch of p.children) ch.position.set(0, 0, 0);
  p.position.set(...v.hinge); p.rotation.set(0, 0, 0);
  v.obj = null; v.fly = null; v.a = v.va = 0; v.t = 0; v.state = 'shut';
}

// the model is being thrown away (another car): a bonnet lying on the road goes with it
export function dropBonnet(model) {
  const p = model?.bonnet?.pivot;
  if (p && p.parent !== model.group) { p.parent?.remove(p); p.traverse((o) => o.geometry?.dispose()); }
}
