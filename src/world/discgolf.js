// Disc golf putting practice on the lawn of Sireli 7a: a basket, and a dad (40) with his two sons (8 and 6)
// taking turns to putt, two discs each. The boys stand 8 m out and always hit the chains; the dad stands at
// 12 m and misses now and then (wide, low into the cage, or off the top band). After six putts they walk in,
// pick their discs out of the basket or off the grass, and walk back for the next round.
// Everything is a pure function of the clock, so every player sees the same putt at the same moment.
// Figures use the squatter's frame: facing -z, y up, metres, feet on y = 0.
import * as THREE from 'three';
import { span, bend } from './squatter.js';
import { sireliAt as at, sireliDeckY } from './sireli.js';
import { buildTerraceMum } from './terracemum.js';

const SHIN = 0.455, THIGH = 0.47, TORSO = 0.53, ANKLE = 0.085, UPPER = 0.315, FORE = 0.285, HIP = 0.975;
const lam = (color) => new THREE.MeshLambertMaterial({ color });
const SKIN = 0xe9c2a8;

const BASKET = at(-15.4, -1.9);
const MUM = at(-9.05, 2.75);                      // her armchair on the terrace, turned to the basket
const ROUND = 46, TURN = 2.8, THROW = 1.7, RELEASE = 0.6;       // s: a round, one putting turn, the putting move, release point (share of the move)
const CHAIN_Y = 1.02, TRAY_Y = 0.7;
// who: where they putt from (house frame), height scale, speed of the disc and of the walk, clothes
const PEOPLE = [
  { name: 'boy8', from: at(-23.2, -0.3), scale: 0.725, head: 1.2, disc: 7.6, walk: 1.3, shirt: 0xd8413a, shorts: 0x27304a, hair: 0xb98a45, discs: [0xff7a1a, 0xff4fa3] },
  { name: 'boy6', from: at(-22.9, -4.9), scale: 0.645, head: 1.27, disc: 7.2, walk: 1.15, shirt: 0xf2c81e, shorts: 0x5a5f6b, hair: 0x7a5a36, discs: [0x2f8fe6, 0xa6e22e] },
  { name: 'dad', from: at(-27.2, -4.0), scale: 0.99, head: 1, disc: 9.2, walk: 1.55, shirt: 0x6d7f4e, shorts: 0x2b2e38, hair: 0x4a3a2c, cap: 0x2a2c33, discs: [0xf4f4f0, 0xe23a3a], misses: 0.4 },
];
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const ease = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- a figure that can stand, walk, putt and reach
function buildFigure(P) {
  const g = new THREE.Group();
  const skin = lam(SKIN), shirt = lam(P.shirt), shorts = lam(P.shorts), hairM = lam(P.hair), shoeM = lam(0x30323a), sole = lam(0xe6e6ea);
  const limb = (r0, r1, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 1, 10, 1), mat); g.add(m); return m; };
  const ball = (r, mat, parent = g) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat); parent.add(m); return m; };
  const legs = [-1, 1].map((s) => {
    const foot = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.075, 0.27), shoeM); upper.position.set(0, 0.045, -0.06); foot.add(upper);
    const so = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.025, 0.3), sole); so.position.set(0, 0.012, -0.065); foot.add(so);
    g.add(foot);
    // shorts to the knee, bare shins
    return { s, foot, thigh: limb(0.086, 0.074, shorts), shin: limb(0.056, 0.042, skin), knee: ball(0.058, skin), hipBall: ball(0.09, shorts), ankle: ball(0.044, skin) };
  });
  const torso = new THREE.Group(); g.add(torso);
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.19, 0.2), shorts); pelvis.position.y = 0.03; torso.add(pelvis);
  const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.16, 6, 12), shirt); belly.scale.set(1.1, 1, 0.82); belly.position.y = 0.2; torso.add(belly);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.16, 6, 12), shirt); chest.scale.set(1.12, 1, 0.74); chest.position.y = 0.37; torso.add(chest);
  for (const s of [-1, 1]) { const d = ball(0.06, shirt, torso); d.position.set(s * 0.175, 0.48, 0.01); }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.056, 0.12, 10), skin); neck.position.y = 0.575; torso.add(neck);
  const headG = new THREE.Group(); headG.position.y = 0.62; headG.scale.setScalar(P.head); torso.add(headG);
  const head = ball(0.1, skin, headG); head.scale.set(0.92, 1.1, 1); head.position.y = 0.1;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.036, 6).rotateX(-Math.PI / 2), skin); nose.position.set(0, 0.09, -0.1); headG.add(nose);
  for (const s of [-1, 1]) {
    const e = ball(0.011, lam(0x2a2620), headG); e.position.set(s * 0.034, 0.125, -0.09);
    const ear = ball(0.022, skin, headG); ear.scale.set(0.5, 1, 0.8); ear.position.set(s * 0.09, 0.1, 0.005);
  }
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.106, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), hairM);
  hair.scale.set(1.0, 1.17, 1.1); hair.position.set(0, 0.112, 0.016); hair.rotation.x = 0.45; headG.add(hair);
  if (P.cap !== undefined) {         // baseball cap: a dome and a peak
    const capM = lam(P.cap);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), capM); dome.scale.set(0.97, 0.95, 1.04); dome.position.set(0, 0.135, 0.005); headG.add(dome);
    const peak = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.012, 14, 1, false, -Math.PI / 2, Math.PI), capM); peak.rotation.y = Math.PI / 2; peak.scale.set(1.25, 1, 1); peak.position.set(0, 0.142, -0.085); headG.add(peak);
  }
  const arms = [-1, 1].map((s) => ({ s, upper: limb(0.046, 0.04, skin), sleeve: limb(0.062, 0.057, shirt), fore: limb(0.04, 0.032, skin), elbow: ball(0.04, skin), hand: ball(0.042, skin) }));
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(P.scale);

  const hip = new THREE.Vector3(), Hp = new THREE.Vector3(), Av = new THREE.Vector3(), K = new THREE.Vector3();
  const Sv = new THREE.Vector3(), E = new THREE.Vector3(), M = new THREE.Vector3(), pole = new THREE.Vector3();
  const hands = [new THREE.Vector3(), new THREE.Vector3()];      // left, right (local)
  const tmp = new THREE.Vector3();
  // q: { walk 0..1, phase (rad), putt 0..1 or -1, stance 0..1, reach 0..1, low 0..1 (reach to the ground), cheer 0..1, slump 0..1, breath }
  function pose(q) {
    const k = q.walk, u = q.putt, st = q.stance;
    // the putt: rock back and down (wind), push forward and up (go), hold the follow-through, come back
    const wind = u < 0 ? 0 : ease(u / 0.42) * (1 - ease((u - 0.44) / 0.14));
    const go = u < 0 ? 0 : ease((u - 0.44) / 0.16) * (1 - ease((u - 0.82) / 0.18));
    const down = q.reach * (0.12 + 0.3 * q.low);
    hip.set(0, HIP + (1 - k) * 0.02 + k * 0.025 * Math.cos(2 * q.phase) - 0.05 * wind * st - down, st * (0.07 * wind - 0.1 * go));
    const lean = 0.05 * k + 0.07 * st + 0.1 * wind + 0.2 * go + q.reach * (0.45 + 0.5 * q.low) + 0.12 * q.slump;
    torso.position.copy(hip);
    torso.rotation.set(-lean, 0.07 * k * Math.sin(q.phase), 0);
    headG.rotation.set(lean * 0.55 + Math.sin(q.breath) * 0.02 + 0.35 * q.slump - 0.25 * q.cheer, 0, 0);
    for (const L of legs) {
      const s = L.s, th = q.phase + (s > 0 ? Math.PI : 0), c = Math.cos(th), sn = Math.sin(th), swing = sn < 0;
      // walking stride, or the putting stance: right foot forward, left back (and lifting on the follow-through)
      let fz = -0.3 * c * k, fy = swing ? -sn * 0.09 * k : 0;
      fz += st * (s > 0 ? -0.2 : 0.22 + 0.16 * go);
      if (s < 0) fy += st * 0.2 * go;
      Av.set(s * 0.1, ANKLE + fy, fz);
      Hp.set(s * 0.1, hip.y - 0.02, hip.z);
      pole.set(0, 0.1, -1);
      bend(Av, Hp, SHIN, THIGH, pole, K);
      span(L.shin, Av, K); span(L.thigh, K, Hp);
      L.knee.position.copy(K); L.hipBall.position.copy(Hp); L.ankle.position.copy(Av);
      L.foot.position.set(Av.x, Av.y - ANKLE, Av.z + 0.03);
      L.foot.rotation.set(swing ? 0.35 * -sn * k : (s < 0 ? 0.5 * st * go : 0), 0, 0);
    }
    for (const Ar of arms) {
      const s = Ar.s, th = q.phase + (s > 0 ? 0 : Math.PI), sw = Math.cos(th) * k;
      Sv.set(s * 0.2, TORSO - 0.06, 0.01).applyEuler(torso.rotation).add(hip);
      const H = hands[s > 0 ? 1 : 0];
      // hanging by the side, swinging a little with the walk
      H.set(s * 0.2, Sv.y - 0.55, 0.02 + 0.13 * sw);
      if (s > 0) {
        // the putting hand: disc held in front of the belly, down beside the thigh, pushed out to chest height
        tmp.set(0.14, hip.y + 0.06, -0.3); H.lerp(tmp, st);
        tmp.set(0.17, hip.y - 0.2, -0.1); H.lerp(tmp, wind * st);
        tmp.set(0.1, hip.y + 0.36, -0.7); H.lerp(tmp, go * st);
        tmp.set(0.12, Math.max(0.12, mix(0.78, 0.18, q.low)), -0.48 - 0.1 * q.low); H.lerp(tmp, q.reach);
      } else {
        tmp.set(-0.3, Sv.y - 0.35, 0.22); H.lerp(tmp, go * st * 0.9);       // the other arm goes out behind for balance
      }
      tmp.set(s * 0.32, Sv.y + 0.52, -0.05); H.lerp(tmp, q.cheer);          // both arms up
      tmp.set(s * 0.2, hip.y + 0.02, -0.06); H.lerp(tmp, q.slump);          // hands on hips
      pole.set(s * 0.3, -0.5, 1);
      bend(Sv, H, UPPER, FORE, pole, E);
      span(Ar.upper, Sv, E); span(Ar.fore, E, H);
      M.lerpVectors(Sv, E, 0.42); span(Ar.sleeve, Sv, M);
      Ar.elbow.position.copy(E); Ar.hand.position.copy(H);
    }
  }
  const hand = (right, out) => g.localToWorld(out.copy(hands[right ? 1 : 0]));
  return { group: g, pose, hand };
}

function buildBasket() {
  const g = new THREE.Group(), steel = lam(0xc3c7cf), yellow = lam(0xf2c81e);
  const add = (geo, mat, y = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; g.add(m); return m; };
  add(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 10), steel, 0.75);
  add(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 16), steel, 0.015);
  // the cage: floor ring with spokes, upright wires, a rim
  add(new THREE.TorusGeometry(0.33, 0.014, 6, 24).rotateX(Math.PI / 2), steel, TRAY_Y + 0.17);
  add(new THREE.TorusGeometry(0.27, 0.012, 6, 24).rotateX(Math.PI / 2), steel, TRAY_Y - 0.03);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const spoke = add(new THREE.CylinderGeometry(0.006, 0.006, 1, 5), steel);
    span(spoke, new THREE.Vector3(c * 0.03, TRAY_Y - 0.06, s * 0.03), new THREE.Vector3(c * 0.27, TRAY_Y - 0.03, s * 0.27));
    const up = add(new THREE.CylinderGeometry(0.006, 0.006, 1, 5), steel);
    span(up, new THREE.Vector3(c * 0.27, TRAY_Y - 0.03, s * 0.27), new THREE.Vector3(c * 0.33, TRAY_Y + 0.17, s * 0.33));
  }
  // the yellow band on top and the chains hanging from it to the pole
  add(new THREE.CylinderGeometry(0.285, 0.285, 0.1, 24, 1, true), new THREE.MeshLambertMaterial({ color: 0xf2c81e, side: THREE.DoubleSide }), 1.4);
  add(new THREE.CylinderGeometry(0.285, 0.285, 0.012, 24), yellow, 1.45);
  const chains = new THREE.Group(); chains.position.y = 1.36; g.add(chains);
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2, r = k % 2 ? 0.26 : 0.17, c = Math.cos(a), s = Math.sin(a);
    const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 1, 5), steel); chains.add(ch);
    span(ch, new THREE.Vector3(c * r, 0, s * r), new THREE.Vector3(c * 0.045, TRAY_Y + 0.1 - 1.36, s * 0.045));
  }
  return { group: g, chains };
}

function buildDisc(color) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.106, 0.016, 20), lam(color)); g.add(top);
  const stamp = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.018, 10), lam(0x26272c)); stamp.position.set(0.04, 0, 0); g.add(stamp);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------------------------------------------------------------- the round: who does what, when
// Built once per round number (the dad's misses come from it); everything else reads it by time.
function planRound(n, ground) {
  const B = BASKET, plan = { n, people: [], events: [] };
  const throwsOf = PEOPLE.map(() => []);
  for (let i = 0; i < 6; i++) {
    const pi = i % 3, P = PEOPLE[pi], k = Math.floor(i / 3), t0 = 1 + i * TURN, rel = t0 + THROW * RELEASE;
    const dx = B[0] - P.from[0], dz = B[1] - P.from[1], d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d, fl = (d - 0.7) / P.disc;
    const r1 = hash(n * 17 + i * 3.1), r2 = hash(n * 29 + i * 7.7), r3 = hash(n * 41 + i * 1.3);
    const kind = P.misses && r1 < P.misses ? (r2 < 0.45 ? 'wide' : r2 < 0.75 ? 'low' : 'high') : 'hit';
    const T = { i, pi, k, t0, rel, fl, ux, uz, kind, arc: 0.03 * d + 0.12 };
    const side = r3 < 0.5 ? -1 : 1;
    if (kind === 'hit') {
      const a = r3 * 6.283, rr = 0.1 + 0.1 * r2;
      T.aim = [B[0], CHAIN_Y, B[1]]; T.t1 = rel + fl; T.t2 = T.t1 + 0.32;
      T.rest = [B[0] + Math.cos(a) * rr, TRAY_Y + 0.02 + 0.02 * (i % 3) + 0.017 * k, B[1] + Math.sin(a) * rr]; T.tilt = [(r2 - 0.5) * 0.5, (r1 - 0.5) * 0.5];
      plan.events.push({ t: T.t1, kind: 'chains' });
    } else if (kind === 'wide') {
      const off = 0.42 + 0.3 * r3, far = 2.2 + 2.2 * r2;
      T.aim = [B[0] - uz * side * off, CHAIN_Y - 0.1, B[1] + ux * side * off]; T.t1 = rel + fl; T.t2 = T.t1 + 0.22 * far;
      T.rest = [T.aim[0] + ux * far, 0.02, T.aim[2] + uz * far];
      plan.events.push({ t: T.t2, kind: 'thud' });
    } else if (kind === 'low') {
      T.aim = [B[0] - ux * 0.34, TRAY_Y + 0.05, B[1] - uz * 0.34]; T.t1 = rel + fl; T.t2 = T.t1 + 0.4;
      T.rest = [B[0] - ux * (0.75 + 0.4 * r3) - uz * side * 0.3, 0.02, B[1] - uz * (0.75 + 0.4 * r3) + ux * side * 0.3];
      plan.events.push({ t: T.t1, kind: 'clang' }, { t: T.t2, kind: 'thud' });
    } else {
      T.aim = [B[0] - ux * 0.28, 1.43, B[1] - uz * 0.28]; T.t1 = rel + fl; T.t2 = T.t1 + 0.75;
      T.rest = [B[0] + ux * (1.3 + r3) - uz * side * 0.5, 0.02, B[1] + uz * (1.3 + r3) + ux * side * 0.5];
      plan.events.push({ t: T.t1, kind: 'clang' }, { t: T.t2, kind: 'thud' });
    }
    if (T.rest[1] < 0.1) T.rest[1] = ground(T.rest[0], T.rest[2]) - ground(B[0], B[1]) + 0.02;      // heights are relative to the basket's foot
    throwsOf[pi].push(T);
  }
  // after the sixth putt: walk in, collect (grass first, then the basket), walk back, turn round
  PEOPLE.forEach((P, pi) => {
    const segs = [], yawTo = (a, b) => Math.atan2(b[0] - a[0], -(b[1] - a[1])), home = yawTo(P.from, B);
    let pos = P.from, yaw = home, t = 1 + 6 * TURN + 0.9 + pi * 0.35;
    const stops = [];
    for (const T of throwsOf[pi]) if (T.kind !== 'hit') stops.push({ to: [T.rest[0], T.rest[2]], low: 1, gap: 0.5, throws: [T] });
    const made = throwsOf[pi].filter((T) => T.kind === 'hit');
    if (made.length) stops.push({ to: B, low: 0, gap: 0.82, throws: made });
    for (const s of stops) {
      const d = Math.hypot(s.to[0] - pos[0], s.to[1] - pos[1]), k = Math.max(0, d - s.gap) / (d || 1);
      const to = [pos[0] + (s.to[0] - pos[0]) * k, pos[1] + (s.to[1] - pos[1]) * k], y1 = d > 0.2 ? yawTo(pos, s.to) : yaw, dur = (d * k) / P.walk;
      segs.push({ t0: t, t1: t + dur, from: pos, to, yaw0: yaw, yaw1: y1, walk: 1 });
      t += dur;
      segs.push({ t0: t, t1: t + 1.5, from: to, to, yaw0: y1, yaw1: y1, reach: 1, low: s.low });
      for (const T of s.throws) T.picked = t + 0.75;
      t += 1.5; pos = to; yaw = y1;
    }
    const d = Math.hypot(P.from[0] - pos[0], P.from[1] - pos[1]), yb = yawTo(pos, P.from);
    segs.push({ t0: t, t1: t + d / P.walk, from: pos, to: P.from, yaw0: yaw, yaw1: yb, walk: 1 });
    t += d / P.walk;
    segs.push({ t0: t, t1: t + 0.9, from: P.from, to: P.from, yaw0: yb, yaw1: home, turn: 1 });
    plan.people.push({ throws: throwsOf[pi], segs, home, dist: 0 });
  });
  plan.events.sort((a, b) => a.t - b.t);
  return plan;
}

export function createDiscGolf(scene, world, audio, opts = {}) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  let mum = null, figures = null, basket = null, discs = null, plan = null, lastT = -1, lastRound = -1, chainHit = -10, solid = false;
  const V = new THREE.Vector3();
  const ground = (x, z) => world.heightAt(x, z);

  function build() {
    basket = buildBasket();
    basket.group.position.set(BASKET[0], ground(BASKET[0], BASKET[1]), BASKET[1]);
    group.add(basket.group);
    figures = PEOPLE.map((P) => { const f = buildFigure(P); group.add(f.group); return f; });
    mum = buildTerraceMum(opts.shadows);
    mum.group.position.set(MUM[0], sireliDeckY(world), MUM[1]);
    mum.group.rotation.y = -Math.atan2(BASKET[0] - 2 - MUM[0], -(BASKET[1] - MUM[1]));
    group.add(mum.group);
    discs = PEOPLE.map((P) => P.discs.map((c) => { const d = buildDisc(c); group.add(d); return d; }));
    if (!opts.shadows) group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    if (!solid) { world.addSolids([{ x: BASKET[0], z: BASKET[1], yaw: 0, hx: 0.25, hz: 0.25 }]); solid = true; }
  }

  const lerpYaw = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
  function person(pi, t) {
    const P = PEOPLE[pi], S = plan.people[pi], f = figures[pi];
    const q = { walk: 0, phase: 0, putt: -1, stance: 0, reach: 0, low: 0, cheer: 0, slump: 0, breath: t * 2 + pi };
    let x = P.from[0], z = P.from[1], yaw = S.home;
    for (const T of S.throws) {
      const u = (t - T.t0) / THROW;
      q.stance = Math.max(q.stance, ease((t - T.t0 + 0.7) / 0.6) * (1 - ease((t - T.t0 - THROW) / 0.5)));
      if (u >= 0 && u <= 1) q.putt = u;
      // the boys throw their arms up when the chains ring; the dad puts his hands on his hips after a miss
      const after = t - T.t1;
      if (T.kind === 'hit' && pi < 2) q.cheer = Math.max(q.cheer, ease(after / 0.25) * (1 - ease((after - 1.0) / 0.4)));
      if (T.kind !== 'hit') q.slump = Math.max(q.slump, ease((after - 0.3) / 0.4) * (1 - ease((after - 1.9) / 0.5)));
    }
    for (const s of S.segs) {
      if (t < s.t0) break;
      const k = Math.min(1, (t - s.t0) / Math.max(1e-3, s.t1 - s.t0));
      x = mix(s.from[0], s.to[0], k); z = mix(s.from[1], s.to[1], k);
      yaw = lerpYaw(s.yaw0, s.yaw1, s.turn ? ease(k) : ease((t - s.t0) / 0.45));
      const on = t < s.t1;
      q.walk = on && s.walk ? Math.min(1, (t - s.t0) / 0.3, (s.t1 - t) / 0.3) : 0;
      if (on && s.walk) q.phase = (Math.hypot(x - s.from[0], z - s.from[1]) / (0.95 * P.scale + 0.25)) * Math.PI * 2;
      if (on && s.reach) { q.reach = Math.sin(k * Math.PI) ** 0.8; q.low = s.low; }
    }
    f.group.position.set(x, ground(x, z), z);
    f.group.rotation.y = -yaw;
    f.pose(q);
    f.group.updateMatrixWorld(true);
    // his two discs: in the hands, in the air, lying in the cage or on the grass, then back in the left hand
    S.throws.forEach((T, k) => {
      const d = discs[pi][k], by = basket.group.position.y;
      d.rotation.set(0, 0, 0);
      if (t < T.rel) {
        const right = k === 0 || t > S.throws[0].t0 + THROW;      // the second waits in the left hand
        f.hand(right, V); d.position.copy(V); d.position.y -= 0.03 * P.scale;
        d.rotation.y = -yaw;
        if (right && q.putt >= 0) d.rotation.x = 0.25;
      } else if (t < T.t1) {
        const s = (t - T.rel) / T.fl, sx = P.from[0] + T.ux * 0.7, sz = P.from[1] + T.uz * 0.7, sy = ground(P.from[0], P.from[1]) + 1.3 * P.scale;
        d.position.set(mix(sx, T.aim[0], s), mix(sy, by + T.aim[1], s) + T.arc * 4 * s * (1 - s), mix(sz, T.aim[2], s));
        d.rotation.set(0.12, t * 40, 0.06);
      } else if (t < T.t2) {
        const s = (t - T.t1) / (T.t2 - T.t1), hop = T.kind === 'high' ? 0.35 : T.kind === 'wide' ? 0.0 : 0.05;
        d.position.set(mix(T.aim[0], T.rest[0], s), by + mix(T.aim[1], T.rest[1], s * s) + hop * 4 * s * (1 - s), mix(T.aim[2], T.rest[2], s));
        d.rotation.set(s * 2.5 * (T.kind === 'hit' ? 0.2 : 1), t * 25, 0.3);
      } else if (t < T.picked) {
        d.position.set(T.rest[0], by + T.rest[1], T.rest[2]);
        if (T.tilt) d.rotation.set(T.tilt[0], 0, T.tilt[1]);
      } else {
        f.hand(false, V); d.position.copy(V); d.position.y -= (0.03 + 0.02 * k) * P.scale;
        d.rotation.y = -yaw;
      }
    });
  }

  function update(car, dt) {
    if (!car) return;
    const dx = car.x - BASKET[0], dz = car.z - BASKET[1], d2 = dx * dx + dz * dz;
    if (d2 > 300 * 300 || !world.ready(BASKET[0], BASKET[1])) { group.visible = false; return; }
    if (!basket) build();
    group.visible = true;
    const now = window.__puttT ?? Date.now() / 1000;                // __puttT: test hook (seconds)
    const n = Math.floor(now / ROUND), t = now - n * ROUND;
    if (!plan || plan.n !== n) plan = planRound(n, ground);
    for (let pi = 0; pi < PEOPLE.length; pi++) person(pi, t);
    mum.update(now);
    // sounds, quieter with distance; the chains swing for a moment after a hit
    if (n === lastRound && t > lastT && t - lastT < 1) {
      for (const e of plan.events) {
        if (e.t > lastT && e.t <= t) {
          if (e.kind === 'chains') chainHit = now;
          const gain = Math.max(0, 1 - Math.sqrt(d2) / 70) ** 2;
          if (gain > 0.004 && audio && audio.putt) audio.putt(e.kind, gain);
        }
      }
    }
    lastT = t; lastRound = n;
    const w = now - chainHit;
    basket.chains.rotation.set(w < 1.6 ? Math.sin(w * 26) * 0.07 * Math.exp(-w * 3) : 0, 0, w < 1.6 ? Math.cos(w * 21) * 0.05 * Math.exp(-w * 3) : 0);
  }

  return { update, group, get plan() { return plan; } };
}
