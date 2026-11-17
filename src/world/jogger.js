// A man out for a slow jog: 185 cm, long dark hair in a ponytail, blue t-shirt, long black running
// trousers, dark trainers. Local frame like the squatter (squatter.js): he faces -z, y up, metres, feet
// on y = 0. update(dt, speed) runs the gait at the given ground speed (m/s); 0 lets him stand and breathe.
import * as THREE from 'three';
import { span, bend } from './squatter.js';

const SHIN = 0.455, THIGH = 0.47, TORSO = 0.53, ANKLE = 0.085, UPPER = 0.315, FORE = 0.285;
const HIP = 0.955;                                   // hip height in the stride, knees a little bent
const SKIN = 0xe9c2a8, HAIR = 0x22170f, SHIRT = 0x2f6fd0, PANTS = 0x111115, SHOE = 0x2a2b30, SOLE = 0xe6e6ea;

const lam = (color) => new THREE.MeshLambertMaterial({ color });

export function buildJogger() {
  const g = new THREE.Group();
  const skin = lam(SKIN), hairM = lam(HAIR), shirt = lam(SHIRT), pants = lam(PANTS), shoeM = lam(SHOE), sole = lam(SOLE);
  const limb = (r0, r1, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 1, 10, 1), mat); g.add(m); return m; };
  const ball = (r, mat, parent = g) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat); parent.add(m); return m; };

  // legs: slim black running trousers down to the ankle, trainers with a white sole
  const legs = [-1, 1].map((s) => {
    const foot = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.075, 0.27), shoeM); upper.position.set(0, 0.045, -0.06); foot.add(upper);
    const toe = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.03, 4, 8).rotateZ(Math.PI / 2), shoeM); toe.position.set(0, 0.04, -0.19); foot.add(toe);
    const so = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.025, 0.3), sole); so.position.set(0, 0.012, -0.065); foot.add(so);
    g.add(foot);
    return { s, foot, thigh: limb(0.082, 0.068, pants), shin: limb(0.068, 0.05, pants), knee: ball(0.07, pants), hipBall: ball(0.088, pants), ankle: ball(0.05, pants) };
  });

  // torso: hips in the trousers, the t-shirt over the belly and chest, leaning a little into the run
  const torso = new THREE.Group(); g.add(torso);
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.19, 0.2), pants); pelvis.position.y = 0.03; torso.add(pelvis);
  const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.16, 6, 12), shirt); belly.scale.set(1.1, 1, 0.8); belly.position.y = 0.2; torso.add(belly);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.16, 6, 12), shirt); chest.scale.set(1.12, 1, 0.74); chest.position.y = 0.37; torso.add(chest);
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.16, 0.05, 14), shirt); hem.scale.z = 0.8; hem.position.y = 0.09; torso.add(hem);
  for (const s of [-1, 1]) { const d = ball(0.06, shirt, torso); d.position.set(s * 0.175, 0.48, 0.01); }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.056, 0.12, 10), skin); neck.position.y = 0.575; torso.add(neck);

  // head with long dark hair pulled back into a ponytail
  const headG = new THREE.Group(); headG.position.y = 0.62; torso.add(headG);
  const head = ball(0.1, skin, headG); head.scale.set(0.9, 1.12, 1); head.position.y = 0.1;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.04, 6).rotateX(-Math.PI / 2), skin); nose.position.set(0, 0.095, -0.1); headG.add(nose);
  for (const s of [-1, 1]) {
    const e = ball(0.011, lam(0x2a2620), headG); e.position.set(s * 0.034, 0.13, -0.09);
    const ear = ball(0.022, skin, headG); ear.scale.set(0.5, 1, 0.8); ear.position.set(s * 0.09, 0.1, 0.005);
  }
  // hair: a cap over the crown and back of the head, flat at the forehead, and a tie at the back
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.106, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), hairM);
  cap.scale.set(0.95, 1.12, 1.05); cap.position.set(0, 0.11, 0.012); cap.rotation.x = 0.62; headG.add(cap);
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), hairM); back.scale.set(0.92, 0.9, 0.6); back.position.set(0, 0.11, 0.045); headG.add(back);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.008, 6, 12), lam(0x0b0b0d)); tie.position.set(0, 0.105, 0.115); headG.add(tie);
  // the ponytail: a chain of tapering segments that hangs and swings with the stride
  const tail = new THREE.Group(); tail.position.set(0, 0.105, 0.115); headG.add(tail);
  const tailSegs = [];
  let parent = tail;
  for (let i = 0; i < 5; i++) {
    const L = 0.085, r = 0.034 - i * 0.004;
    const seg = new THREE.Group(); seg.position.y = i ? -L : 0; parent.add(seg);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, L - r, 4, 8), hairM); m.position.y = -L / 2; m.scale.z = 0.8; seg.add(m);
    tailSegs.push(seg); parent = seg;
  }

  // arms: short blue sleeves, bare forearms
  const arms = [-1, 1].map((s) => ({ s, upper: limb(0.046, 0.04, skin), sleeve: limb(0.062, 0.057, shirt), fore: limb(0.04, 0.032, skin), elbow: ball(0.04, skin), hand: ball(0.042, skin) }));
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // ---- pose
  const hip = new THREE.Vector3(), Hp = new THREE.Vector3(), A = new THREE.Vector3(), K = new THREE.Vector3();
  const S = new THREE.Vector3(), E = new THREE.Vector3(), Hd = new THREE.Vector3(), M = new THREE.Vector3(), pole = new THREE.Vector3();
  let phase = 0, breath = 0, run = 0;
  function pose() {
    // run blends from standing (0) to the full stride (1)
    const k = run, lean = 0.13 * k;
    hip.set(0, HIP + (1 - k) * 0.05 + k * 0.035 * Math.cos(2 * phase), 0);
    torso.position.copy(hip);
    torso.rotation.set(-lean, 0.09 * k * Math.sin(phase), 0);
    headG.rotation.set(lean * 0.8 + Math.sin(breath) * 0.02, -0.05 * k * Math.sin(phase), 0);
    for (const L of legs) {
      const s = L.s, th = phase + (s > 0 ? Math.PI : 0);
      const c = Math.cos(th), sn = Math.sin(th);
      // stance (th 0..pi): the foot slides back under the hip on the ground; swing: heel up and forward
      const swing = sn < 0;
      const fz = -0.43 * c * k, fy = swing ? -sn * (0.13 + 0.1 * Math.max(0, c)) * k : 0;
      A.set(s * 0.1, ANKLE + fy, fz + (swing ? 0.05 * -sn * k : 0));
      Hp.set(s * 0.1, hip.y - 0.02, hip.z);
      pole.set(0, 0.1, -1);
      bend(A, Hp, SHIN, THIGH, pole, K);
      span(L.shin, A, K); span(L.thigh, K, Hp);
      L.knee.position.copy(K); L.hipBall.position.copy(Hp); L.ankle.position.copy(A);
      L.foot.position.set(A.x, A.y - ANKLE, A.z + 0.03);
      L.foot.rotation.set(swing ? 0.5 * -sn * k * (c < 0 ? 1 : 0.4) : 0.12 * k * (c - 0.3) * (c > 0.3 ? 1 : 0), 0, 0);
    }
    for (const Ar of arms) {
      const s = Ar.s, th = phase + (s > 0 ? 0 : Math.PI);          // each arm swings with the opposite leg
      S.set(s * 0.2, TORSO - 0.06, 0.01).applyEuler(torso.rotation).add(hip);
      const sw = Math.cos(th) * k;
      // elbows bent near 90 degrees, hands swinging from the hip to the chest
      Hd.set(s * (0.16 - 0.03 * Math.max(0, -sw)), S.y - 0.42 + k * (0.17 + 0.06 * Math.max(0, -sw)) - (1 - k) * 0.12, -0.02 + 0.16 * sw - 0.06 * k);
      pole.set(s * 0.25, -0.6, 1);
      bend(S, Hd, UPPER, FORE, pole, E);
      span(Ar.upper, S, E); span(Ar.fore, E, Hd);
      M.lerpVectors(S, E, 0.42); span(Ar.sleeve, S, M);
      Ar.elbow.position.copy(E); Ar.hand.position.copy(Hd);
    }
    // ponytail: hangs back from the tie, swings side to side and bounces with each step
    const bob = Math.sin(2 * phase) * k;
    tailSegs.forEach((sg, i) => {
      // negative x tips the hanging tail back, away from the neck; it then curves down the upper back
      sg.rotation.x = i ? 0.06 + bob * 0.05 : -(0.3 + lean * 0.5 + 0.15 * k) - bob * 0.08;
      sg.rotation.z = Math.sin(phase - i * 0.5) * (i ? 0.12 : 0.25) * k;
    });
  }
    // dist (m run so far) drives the stride when given, so the feet stay planted: 1.72 m a stride
  function update(dt, speed, dist) {
    const want = Math.min(1, speed / 2.2);
    run += (want - run) * Math.min(1, dt * 4);
    if (dist !== undefined) phase = (dist / 1.72) * 2 * Math.PI;
    else phase += dt * (run > 0.05 ? 2 * Math.PI * 1.33 : 0);
    breath += dt * 2.2;
    pose();
  }
  pose();
  return { group: g, update };
}
