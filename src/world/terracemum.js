// The mother (40) on the terrace of Sireli 7a: sitting back in a cushioned garden armchair, watching the
// putting on the lawn and now and then taking a sip of her Aperol spritz.
// A pure function of the clock, like the putters, so every player sees the same sip.
// Figure frame as in discgolf.js: facing -z, y up, metres, feet on y = 0.
import * as THREE from 'three';
import { span, bend } from './squatter.js';

const SHIN = 0.44, THIGH = 0.45, TORSO = 0.5, ANKLE = 0.07, UPPER = 0.3, FORE = 0.265;
const SEAT = 0.4, SCALE = 0.95, PERIOD = 26;
const lam = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o });
const hash = (n) => { const s = Math.sin(n * 91.7 + 17.3) * 43758.5453; return s - Math.floor(s); };
const ease = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

function buildChair() {
  const g = new THREE.Group();
  const frame = lam(0x4a4c52), cushion = lam(0xe9e4d8), pillow = lam(0xd9a3a0), wood = lam(0xb98f62);
  const box = (w, h, d, x, y, z, mat, rx = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.x = rx; g.add(m); return m; };
  box(0.86, 0.2, 0.84, 0, 0.17, 0.06, frame);                         // woven base
  for (const s of [-1, 1]) {
    box(0.1, 0.4, 0.84, s * 0.43, 0.42, 0.06, frame);                 // arms
    box(0.13, 0.03, 0.86, s * 0.43, 0.63, 0.06, wood);
    for (const z of [-0.3, 0.42]) box(0.05, 0.08, 0.05, s * 0.38, 0.04, z, frame);
  }
  box(0.86, 0.62, 0.1, 0, 0.56, 0.5, frame, 0.2);                     // back
  box(0.74, 0.13, 0.7, 0, SEAT - 0.07, 0.03, cushion);                // seat cushion
  box(0.74, 0.5, 0.13, 0, 0.66, 0.4, cushion, 0.22);                  // back cushion
  box(0.36, 0.3, 0.1, -0.17, 0.6, 0.31, pillow, 0.3);
  // a small round side table on her right, with a book
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 20), wood); top.position.set(0.78, 0.5, -0.1); g.add(top);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), frame); leg.position.set(0.78, 0.25, -0.1); g.add(leg);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 16), frame); foot.position.set(0.78, 0.01, -0.1); g.add(foot);
  const book = box(0.15, 0.03, 0.21, 0.82, 0.53, -0.06, lam(0x3f7fa6)); book.rotation.y = 0.4;
  return g;
}

// a big stemmed glass: orange drink, ice, a slice of orange and a straw. Origin where the fingers hold the stem.
function buildGlass() {
  const g = new THREE.Group();
  const glass = lam(0xffffff, { transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
  const prof = (pts) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 16);
  const bowl = new THREE.Mesh(prof([[0.004, 0.05], [0.03, 0.062], [0.046, 0.09], [0.05, 0.125], [0.044, 0.17]]), glass);
  const drink = new THREE.Mesh(prof([[0, 0.054], [0.027, 0.064], [0.042, 0.09], [0.046, 0.122], [0, 0.122]]), lam(0xff7a1c, { emissive: 0x5a1c00 }));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.1, 6), lam(0xdfe6ea)); stem.position.y = 0;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.004, 14), lam(0xdfe6ea)); base.position.y = -0.05;
  const slice = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 14), lam(0xffa726)); slice.rotation.set(0, 0, 1.25); slice.position.set(0.02, 0.118, 0.012);
  const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.17, 6), lam(0x2a2c33)); straw.rotation.z = -0.3; straw.position.set(-0.012, 0.13, -0.01);
  g.add(drink, bowl, stem, base, slice, straw);
  return g;
}

function buildWoman() {
  const g = new THREE.Group();
  const skin = lam(0xeac4ab), dress = lam(0x3f8f86), hairM = lam(0x8a5a33), sandal = lam(0xc9a274);
  const limb = (r0, r1, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 1, 10, 1), mat); g.add(m); return m; };
  const ball = (r, mat, parent = g) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat); parent.add(m); return m; };
  const legs = [-1, 1].map((s) => {
    const foot = new THREE.Group();
    const so = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.022, 0.24), sandal); so.position.set(0, 0.011, -0.05); foot.add(so);
    const toes = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.04, 0.2), skin); toes.position.set(0, 0.04, -0.05); foot.add(toes);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.03), sandal); strap.position.set(0, 0.04, -0.1); foot.add(strap);
    g.add(foot);
    return { s, foot, thigh: limb(0.082, 0.066, dress), shin: limb(0.05, 0.036, skin), knee: ball(0.052, skin), hipBall: ball(0.09, dress), ankle: ball(0.038, skin) };
  });
  const torso = new THREE.Group(); g.add(torso);
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.19, 0.21), dress); pelvis.position.y = 0.03; torso.add(pelvis);
  const waist = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.16, 6, 12), dress); waist.scale.set(1.08, 1, 0.8); waist.position.y = 0.2; torso.add(waist);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.13, 6, 12), dress); chest.scale.set(1.12, 1, 0.82); chest.position.set(0, 0.36, -0.01); torso.add(chest);
  const top = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.16, 6, 10).rotateZ(Math.PI / 2), skin); top.scale.set(1, 0.8, 0.75); top.position.y = 0.47; torso.add(top);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.12, 10), skin); neck.position.y = 0.555; torso.add(neck);
  const headG = new THREE.Group(); headG.position.y = 0.6; torso.add(headG);
  const head = ball(0.097, skin, headG); head.scale.set(0.9, 1.1, 1); head.position.y = 0.1;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.032, 6).rotateX(-Math.PI / 2), skin); nose.position.set(0, 0.088, -0.097); headG.add(nose);
  const lips = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.01, 0.01), lam(0xc0545a)); lips.position.set(0, 0.05, -0.09); headG.add(lips);
  // sunglasses
  const shade = lam(0x1d1e22);
  for (const s of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.008, 12).rotateX(Math.PI / 2), shade); l.position.set(s * 0.036, 0.122, -0.092); headG.add(l);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.006, 0.1), shade); arm.position.set(s * 0.086, 0.124, -0.04); headG.add(arm);
    const ear = ball(0.02, skin, headG); ear.scale.set(0.5, 1, 0.8); ear.position.set(s * 0.088, 0.1, 0.005);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.005), shade); bridge.position.set(0, 0.126, -0.096); headG.add(bridge);
  // shoulder-length hair: a cap and a fall behind the neck
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.104, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), hairM);
  cap.scale.set(1.0, 1.16, 1.1); cap.position.set(0, 0.112, 0.014); cap.rotation.x = 0.5; headG.add(cap);
  const fall = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.16, 6, 12), hairM); fall.scale.set(1.12, 1, 0.6); fall.position.set(0, 0.03, 0.062); headG.add(fall);
  const arms = [-1, 1].map((s) => ({ s, upper: limb(0.04, 0.034, skin), fore: limb(0.034, 0.026, skin), elbow: ball(0.034, skin), hand: ball(0.036, skin) }));
  const glass = buildGlass(); g.add(glass);
  g.scale.setScalar(SCALE);

  const hipY = (SEAT + 0.085) / SCALE;
  const hip = new THREE.Vector3(0, hipY, 0.05), Hp = new THREE.Vector3(), Av = new THREE.Vector3(), K = new THREE.Vector3();
  const Sv = new THREE.Vector3(), E = new THREE.Vector3(), H = new THREE.Vector3(), pole = new THREE.Vector3(), tmp = new THREE.Vector3();
  // sip 0..1: the glass at her lips; look: head turn (rad); breath: slow phase
  function pose(sip, look, breath) {
    const back = 0.24 - 0.1 * sip + Math.sin(breath) * 0.008;
    torso.position.copy(hip);
    torso.rotation.set(back, 0, 0);
    headG.rotation.set(-back * 0.8 + 0.12 * sip, look * (1 - sip), 0);
    for (const L of legs) {
      const s = L.s;
      // right leg bent, left stretched out and resting on its heel
      if (s > 0) Av.set(0.1, ANKLE, -0.56); else Av.set(-0.11, ANKLE + 0.02, -0.8);
      Hp.set(s * 0.09, hip.y - 0.02, hip.z);
      pole.set(0, 1, -0.2);
      bend(Av, Hp, SHIN, THIGH, pole, K);
      span(L.shin, Av, K); span(L.thigh, K, Hp);
      L.knee.position.copy(K); L.hipBall.position.copy(Hp); L.ankle.position.copy(Av);
      L.foot.position.set(Av.x, Av.y - ANKLE, Av.z + 0.02);
      L.foot.rotation.set(s > 0 ? 0 : 0.5, s * -0.12, 0);
    }
    for (const Ar of arms) {
      const s = Ar.s;
      Sv.set(s * 0.19, TORSO - 0.05, 0).applyEuler(torso.rotation).add(hip);
      if (s < 0) H.set(-0.36, 0.69 / SCALE, -0.2);                    // left hand on the arm of the chair
      else {
        H.set(0.34, 0.75 / SCALE, -0.3);                              // the glass held over the right arm of the chair
        tmp.set(0.035, 0.575, -0.19).applyEuler(torso.rotation).add(hip);   // just under her lips
        H.lerp(tmp, sip);
      }
      pole.set(s * 0.6, -0.6, 0.6);
      bend(Sv, H, UPPER, FORE, pole, E);
      span(Ar.upper, Sv, E); span(Ar.fore, E, H);
      Ar.elbow.position.copy(E); Ar.hand.position.copy(H);
      if (s > 0) { glass.position.copy(H); glass.rotation.set(0.75 * sip * sip, 0, -0.1 * (1 - sip)); }
    }
  }
  return { group: g, pose };
}

// now: seconds. A sip every 26 s or so: lift, drink, put the hand back down; sometimes a second, shorter one.
export function sipAt(now) {
  const n = Math.floor(now / PERIOD), t = now - n * PERIOD;
  const one = (t0, hold) => ease((t - t0) / 1.1) * (1 - ease((t - t0 - 1.1 - hold) / 1.2));
  const t0 = 3 + hash(n) * 9;
  let s = one(t0, 1.3 + hash(n + 0.5));
  if (hash(n + 0.25) > 0.55) s = Math.max(s, one(t0 + 7.5, 0.9));
  return s;
}

export function buildTerraceMum(shadows) {
  const group = new THREE.Group();
  const woman = buildWoman();
  group.add(buildChair(), woman.group);
  group.traverse((o) => { if (o.isMesh) { o.castShadow = !!shadows && !o.material.transparent; o.receiveShadow = true; } });
  return {
    group,
    update(now) { woman.pose(sipAt(now), Math.sin(now * 0.23) * 0.3 + Math.sin(now * 0.071) * 0.15, now * 1.6); },
  };
}
