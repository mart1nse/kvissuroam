// A power rack loaded with plates and a man doing barbell back squats in it (Jänese tänav, next to the
// parked BMW; see janese.js). Local frame: the man faces -z out of the front of the rack, y up, metres.
// He is 175 cm tall, with long dark curly hair, a long beard, a dark tank top and dark, wide trousers.
import * as THREE from 'three';

const lam = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o });
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...o });

// bumper plates: [radius, thickness, colour] (25 red, 20 blue, 15 yellow, 10 green, 5 white, 2.5 black)
const PLATES = { 25: [0.225, 0.067, 0xc8202c], 20: [0.225, 0.054, 0x1f4fb4], 15: [0.225, 0.045, 0xe3b51c], 10: [0.225, 0.036, 0x2a8c46], 5: [0.115, 0.03, 0xe9e9ec], 2.5: [0.095, 0.022, 0x17171a] };
const plateGeo = new Map();
function plateMesh(kg, mats) {
  const [r, t, c] = PLATES[kg];
  if (!plateGeo.has(kg)) plateGeo.set(kg, new THREE.CylinderGeometry(r, r, t, 28).rotateZ(Math.PI / 2));
  if (!mats.has(c)) mats.set(c, std(c, { roughness: 0.75 }));
  return new THREE.Mesh(plateGeo.get(kg), mats.get(c));
}
// plates stacked along +x from x0 (a sleeve), returns the x after the last one
function stack(group, list, x0, y, z, mats, dir = 1) {
  let x = x0;
  for (const kg of list) {
    const m = plateMesh(kg, mats), t = PLATES[kg][1];
    m.position.set(x + dir * t / 2, y, z);
    group.add(m);
    x += dir * (t + 0.003);
  }
  return x;
}

// the loaded bar on his back: 6 x 25 + 20 + 15 + 5 + 2.5 a side, about 365 kg with the bar
const BAR_LOAD = [25, 25, 25, 25, 25, 25, 20, 15, 5, 2.5];

export function buildRack() {
  const g = new THREE.Group();
  const steel = lam(0x2b2440), bright = lam(0xd13a8c), mats = new Map();
  const tube = (w, h, d, x, y, z, m = steel) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  const H = 2.3, X = 0.6, Z = 0.62;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) tube(0.075, H, 0.075, sx * X, H / 2, sz * Z);
  // base, top frame, pull-up bar
  for (const sx of [-1, 1]) { tube(0.08, 0.06, 2 * Z + 0.3, sx * X, 0.03, 0); tube(0.075, 0.075, 2 * Z, sx * X, H - 0.04, 0); }
  for (const sz of [-1, 1]) { tube(2 * X, 0.06, 0.08, 0, 0.03, sz * Z); tube(2 * X, 0.075, 0.075, 0, H - 0.04, sz * Z); }
  const pull = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 2 * X + 0.2, 10).rotateZ(Math.PI / 2), lam(0xb8bcc4));
  pull.position.set(0, H + 0.02, -Z); g.add(pull);
  // pink J-hooks just below the bar's height, and safety arms at the bottom of his squat
  for (const sx of [-1, 1]) {
    tube(0.06, 0.1, 0.11, sx * X, 1.31, -Z - 0.08, bright);
    tube(0.05, 0.05, 2 * Z + 0.3, sx * (X - 0.06), 0.62, 0, bright);
  }
  // hole pattern on the uprights: dark dots up the front faces
  const dot = new THREE.BoxGeometry(0.02, 0.02, 0.005), dark = lam(0x0d0b14);
  const dots = new THREE.InstancedMesh(dot, dark, 2 * 2 * 26);
  let k = 0;
  const mtx = new THREE.Matrix4();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < 26; i++) { mtx.makeTranslation(sx * X, 0.35 + i * 0.065, sz * Z - sz * 0.039); dots.setMatrixAt(k++, mtx); }
  g.add(dots);
  // plate storage horns on the back uprights, loaded
  const steelBar = lam(0xb8bcc4);
  for (const sx of [-1, 1]) for (const [y, list] of [[0.3, [25, 25, 25, 20]], [0.85, [20, 15, 15, 10, 10]]]) {
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 10).rotateZ(Math.PI / 2), steelBar);
    horn.position.set(sx * (X + 0.2), y, Z); g.add(horn);
    stack(g, list, sx * (X + 0.05), y, Z, mats, sx);
  }
  // a plate tree beside the rack, and a few plates leaning against it
  const tree = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.2, 0.07), steel); post.position.y = 0.6; tree.add(post);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.6), steel); foot.position.y = 0.025; tree.add(foot);
  for (const [y, sz, list] of [[0.35, 1, [25, 25, 20]], [0.35, -1, [25, 20, 20]], [0.85, 1, [15, 10, 10, 5]], [0.85, -1, [10, 5, 5, 2.5, 2.5]]]) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 8).rotateX(Math.PI / 2), steelBar);
    pin.position.set(0, y, sz * 0.15); tree.add(pin);
    const s = new THREE.Group(); s.rotation.y = Math.PI / 2; s.position.set(0, y, 0); tree.add(s);
    stack(s, list, -sz * 0.05, 0, 0, mats, -sz);
  }
  tree.position.set(X + 0.95, 0, 0.05);
  g.add(tree);
  for (let i = 0; i < 3; i++) {
    const p = plateMesh(i ? 20 : 25, mats);
    // on edge, leaning back against the tree's foot
    p.position.set(X + 0.95 + 0.42 + i * 0.07, 0.224, -0.5);
    p.rotation.set(0, 0, 0.1);
    g.add(p);
  }
  // a rubber floor mat under it all
  const mat = new THREE.Mesh(new THREE.BoxGeometry(2 * X + 2.0, 0.02, 2 * Z + 0.8), lam(0x141418));
  mat.position.set(0.55, 0.01, 0); mat.receiveShadow = true; g.add(mat);
  g.traverse((o) => { if (o.isMesh && o !== mat) o.castShadow = true; });
  return g;
}

// ---- the lifter
const SHIN = 0.43, THIGH = 0.44, TORSO = 0.5, ANKLE = 0.08, UPPER = 0.3, FORE = 0.27;
const SKIN = 0xe2b49a, HAIR = 0x1c130e, TOP = 0x1d1c24, PANTS = 0x24232b, SHOE = 0x111114;

// an object whose local +y runs from point a to point b (unit length along y, scaled)
const yUp = new THREE.Vector3(0, 1, 0), tv = new THREE.Vector3();
function span(o, a, b) {
  tv.subVectors(b, a);
  const L = tv.length();
  o.position.copy(a).addScaledVector(tv, 0.5);
  o.quaternion.setFromUnitVectors(yUp, tv.divideScalar(L || 1));
  o.scale.y = L;
}
// two-bone IK: elbow/knee position for root a, target c, lengths l1, l2, bending towards pole
function bend(a, c, l1, l2, pole, out) {
  const d = new THREE.Vector3().subVectors(c, a);
  let L = d.length();
  L = Math.min(L, l1 + l2 - 1e-4);
  d.normalize();
  const x = (l1 * l1 - l2 * l2 + L * L) / (2 * L);
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const p = pole.clone().addScaledVector(d, -pole.dot(d)).normalize();
  return out.copy(a).addScaledVector(d, x).addScaledVector(p, h);
}

export function buildLifter() {
  const g = new THREE.Group(), mats = new Map();
  const skin = lam(SKIN), hairM = lam(HAIR), top = lam(TOP), pants = lam(PANTS), shoe = lam(SHOE), bar = std(0xc4c8cf, { metalness: 0.8, roughness: 0.35 });
  const limb = (r0, r1, mat) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 1, 10, 1).translate(0, 0, 0), mat);
    g.add(m); return m;
  };
  const ball = (r, mat, parent = g) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat); parent.add(m); return m; };
  // legs: wide trouser legs (wider at the hem), shoes
  const legs = [-1, 1].map((s) => ({
    s, thigh: limb(0.095, 0.085, pants), shin: limb(0.085, 0.1, pants), knee: ball(0.09, pants), hipBall: ball(0.1, pants),
    foot: (() => { const f = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.27), shoe); f.position.set(s * 0.2, 0.04, -0.07); f.rotation.y = -s * 0.25; g.add(f); return f; })(),
  }));
  // torso: pelvis + chest in a group that leans about the hips
  const torso = new THREE.Group(); g.add(torso);
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.22), pants); pelvis.position.y = 0.04; torso.add(pelvis);
  const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.16, 6, 12), top); belly.scale.set(1.1, 1, 0.82); belly.position.y = 0.2; torso.add(belly);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.14, 6, 12), top); chest.scale.set(1.12, 1, 0.75); chest.position.y = 0.35; torso.add(chest);
  // bare shoulders and traps (tank top), neck, head
  for (const s of [-1, 1]) { const d = ball(0.075, skin, torso); d.position.set(s * 0.2, 0.47, 0.01); }
  const traps = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.2, 4, 8).rotateZ(Math.PI / 2), skin); traps.position.set(0, 0.5, 0.03); torso.add(traps);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.12, 10), skin); neck.position.y = 0.56; torso.add(neck);
  const headG = new THREE.Group(); headG.position.y = 0.6; torso.add(headG);
  const head = ball(0.105, skin, headG); head.scale.set(0.92, 1.12, 1); head.position.y = 0.1;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.04, 6).rotateX(-Math.PI / 2), skin); nose.position.set(0, 0.1, -0.105); headG.add(nose);
  for (const s of [-1, 1]) { const e = ball(0.012, lam(0x111111), headG); e.position.set(s * 0.035, 0.135, -0.093); }
  // long dark curly hair: clumps over the crown and falling past the shoulders at the back and sides
  const curl = new THREE.IcosahedronGeometry(1, 0);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const hair = new THREE.InstancedMesh(curl, hairM, 150);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  let n = 0;
  for (; n < 150; n++) {
    let x, y, z;
    if (n < 55) {                         // crown and top
      const a = rnd() * Math.PI * 2, b = rnd() * 1.2;
      x = Math.sin(b) * Math.cos(a) * 0.112; z = Math.sin(b) * Math.sin(a) * 0.12 + 0.012; y = 0.11 + Math.cos(b) * 0.125;
      if (z < -0.06 && y < 0.2) z = -0.06;
    } else {                              // falling locks: behind and beside the head down to the upper back
      const a = (rnd() - 0.5) * Math.PI * 1.25, t = rnd();
      x = Math.sin(a) * (0.12 + t * 0.05); z = Math.cos(a) * (0.1 + t * 0.03) + 0.02; y = 0.12 - t * 0.33;
    }
    const s = 0.035 + rnd() * 0.025;
    m4.compose(pv.set(x, y, z), q.setFromEuler(e.set(rnd() * 3, rnd() * 3, rnd() * 3)), sc.set(s, s * 1.2, s));
    hair.setMatrixAt(n, m4);
  }
  headG.add(hair);
  // long beard down onto the chest, curly at the edges
  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.3, 10).rotateX(Math.PI), hairM); beard.scale.z = 0.7; beard.position.set(0, -0.06, -0.06); beard.rotation.x = -0.25; headG.add(beard);
  const beardC = new THREE.InstancedMesh(curl, hairM, 30);
  for (let i = 0; i < 30; i++) {
    const t = rnd(), a = (rnd() - 0.5) * Math.PI * 1.1;
    const s = 0.028 + rnd() * 0.02;
    m4.compose(pv.set(Math.sin(a) * 0.075 * (1 - t * 0.6), 0.06 - t * 0.27, -0.08 - Math.cos(a) * 0.04 + t * 0.05), q.setFromEuler(e.set(rnd() * 3, rnd() * 3, rnd() * 3)), sc.set(s, s, s));
    beardC.setMatrixAt(i, m4);
  }
  headG.add(beardC);
  const moust = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.06, 3, 6).rotateZ(Math.PI / 2), hairM); moust.position.set(0, 0.06, -0.1); headG.add(moust);
  // arms
  const arms = [-1, 1].map((s) => ({ s, upper: limb(0.05, 0.045, skin), fore: limb(0.045, 0.04, skin), elbow: ball(0.045, skin), hand: ball(0.045, skin) }));
  // the bar and its plates, rotated with the shoulders so it stays level
  const barG = new THREE.Group(); g.add(barG);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.2, 10).rotateZ(Math.PI / 2), bar); barG.add(shaft);
  for (const s of [-1, 1]) {
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 12).rotateZ(Math.PI / 2), bar); sleeve.position.x = s * 0.88; barG.add(sleeve);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12).rotateZ(Math.PI / 2), bar); collar.position.x = s * 0.66; barG.add(collar);
    const end = stack(barG, BAR_LOAD, s * 0.68, 0, 0, mats, s);
    const clip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 10).rotateZ(Math.PI / 2), lam(0xd13a8c)); clip.position.x = end + s * 0.02; barG.add(clip);
  }
  g.traverse((o) => { if (o.isMesh || o.isInstancedMesh) o.castShadow = true; });

  // ---- pose: depth p from 0 (standing) to 1 (hip crease below the knee); the bar stays over mid-foot
  const A = [new THREE.Vector3(), new THREE.Vector3()], K = new THREE.Vector3(), Hp = new THREE.Vector3(), S = new THREE.Vector3(), Hd = new THREE.Vector3(), E = new THREE.Vector3();
  const pole = new THREE.Vector3();
  const hip = new THREE.Vector3(), barP = new THREE.Vector3();
  function pose(p) {
    // knee travel: the shin leans forward, the thigh swings back past parallel
    const a = p * 0.6, b = 0.08 + p * 1.62;
    const kz = -SHIN * Math.sin(a), ky = ANKLE + SHIN * Math.cos(a);
    hip.set(0, ky + THIGH * Math.cos(b), kz + THIGH * Math.sin(b));
    // torso lean so that the bar (a little behind the top of the shoulders) sits over mid-foot (z = -0.06)
    const off = 0.06;
    let t = 0;
    for (let i = 0; i < 4; i++) t = Math.asin(Math.max(-1, Math.min(1, (hip.z - off * Math.cos(t) + 0.06) / (TORSO + 0.03))));
    torso.position.copy(hip);
    torso.rotation.set(-t, 0, 0);
    headG.rotation.x = t * 0.55;                 // eyes forward-down, not to the floor
    barP.set(0, TORSO + 0.03, off).applyEuler(torso.rotation).add(hip);
    barG.position.copy(barP);
    for (const L of legs) {
      const s = L.s;
      const ank = A[s < 0 ? 0 : 1].set(s * 0.2, ANKLE, 0);
      Hp.set(s * 0.12, hip.y, hip.z);
      // knees out over the toes
      pole.set(s * 0.45, 0.2, -1);
      bend(ank, Hp, SHIN, THIGH, pole, K);
      span(L.shin, ank, K); span(L.thigh, K, Hp);
      L.knee.position.copy(K); L.hipBall.position.copy(Hp);
      L.shin.scale.x = L.shin.scale.z = 1; L.thigh.scale.x = L.thigh.scale.z = 1;
    }
    for (const Ar of arms) {
      const s = Ar.s;
      S.set(s * 0.21, TORSO - 0.04, 0.02).applyEuler(torso.rotation).add(hip);
      Hd.set(s * 0.5, barP.y, barP.z);
      pole.set(s * 0.3, -1, 0.6);
      bend(S, Hd, UPPER, FORE, pole, E);
      span(Ar.upper, S, E); span(Ar.fore, E, Hd);
      Ar.elbow.position.copy(E); Ar.hand.position.copy(Hd);
    }
  }
  // one rep every ~4.6 s: down 1.7 s, a beat at the bottom, drive up 1.2 s, breathe at the top
  const ease = (x) => x * x * (3 - 2 * x);
  let time = 0;
  function update(dt) {
    time += dt;
    const c = time % 4.6;
    const p = c < 1.7 ? ease(c / 1.7) : c < 1.9 ? 1 : c < 3.1 ? 1 - ease((c - 1.9) / 1.2) : 0;
    pose(p);
  }
  pose(0);
  return { group: g, update, pose };
}
