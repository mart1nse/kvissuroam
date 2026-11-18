// Äksi, Angerja tänav: a man jogging slow loops up the street from Järve tänav and round the front
// garden of the house at the bend, and detail taken from the Land Board's 2024 oblique aerial photos
// (kaldaerofotod) and the orthophoto: wooden power poles along the street, cars parked in a drive and
// on Järve tänav, a trampoline, an above-ground pool and a mailbox at the gate.
// Everyone sees the jogger at the same spot: his place on the loop comes from the clock, not the frame count.
import * as THREE from 'three';
import { buildJogger } from './jogger.js';
import { Parts, BOX } from '../race/landmarks.js';

const POLE = 1;

// Angerja tänav centre line, from the Järve tänav junction north to the bend at the house
const ROAD = [[-1775.7, -13172.0], [-1778.1, -13178.7], [-1780.9, -13200.3], [-1783.2, -13213.8], [-1786.3, -13225.2],
  [-1788.3, -13231.1], [-1792.1, -13239.2], [-1800.1, -13256.3], [-1802.9, -13263.6], [-1803.2, -13267.3]];
const HOUSE_YARD = { x: -1794.2, z: -13267, rx: 3.4, rz: 5.0 };   // the lawn between the street and the house
const SPEED = 2.3;                                                  // m/s, an easy 8 km/h
const CENTRE = [-1789, -13222];

// cars seen in the photos: x, z, heading (rad, 0 = north), model, colour. Stood there by parked.js.
export const AKSI_CARS = [
  [-1769.2, -13229.4, Math.atan2(1, 0.38), 'rav4', 'grey'],            // in the drive east of the street
  [-1763.4, -13168.5, -Math.PI / 2, 'passat', 'grey'],             // on Järve tänav by the flats
  [-1756.9, -13168.3, Math.PI / 2, 'crv', 'silver'],
];
const TRAMPOLINE = [-1748.0, -13241.2, 1.83];
const POOL = [-1726.0, -13223.0, 2.3];
const MAILBOX = [-1798.2, -13260.8];

// offset a polyline sideways: + is to the right of the direction of travel
function offset(pts, d) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    return [p[0] - (dz / l) * d, p[1] + (dx / l) * d];
  });
}

// the loop: north on the east side of the street, two laps round the front lawn, south on the west
// side, and across the street at Järve tänav
function loopPoints() {
  const north = offset(ROAD.slice(1, 9), 1.3);
  const south = offset(ROAD.slice(1, 9).reverse(), 1.3);
  const Y = HOUSE_YARD, lawn = [];
  for (let lap = 0; lap < 2; lap++) {
    for (let i = 0; i < 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI * 2;                     // from the street side, round clockwise
      lawn.push([Y.x + Math.cos(a) * Y.rx, Y.z + Math.sin(a) * Y.rz]);
    }
  }
  return [...north, [Y.x - Y.rx - 2.6, Y.z + 3], ...lawn, [Y.x - Y.rx, Y.z], [Y.x - Y.rx - 2.8, Y.z - 2.5], ...south,
    [-1777.8, -13173.4], [-1776.0, -13174.2]];
}

// closed Catmull-Rom curve sampled every ~0.25 m, with the distance along it
function sampleLoop(pts) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const steps = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.25));
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  const s = [0];
  for (let i = 1; i <= out.length; i++) s.push(s[i - 1] + Math.hypot(out[i % out.length][0] - out[i - 1][0], out[i % out.length][1] - out[i - 1][1]));
  return { pts: out, s, length: s[out.length] };
}

// power poles: every ~38 m along the east verge of the street (the line in the photos), plus a
// bearing (round poles, so 0). Returned in the props.js extra format: [kind, x, z, bearing degrees].
export function aksiProps() {
  const east = offset(ROAD, 4.1), out = [];
  let acc = 26;
  for (let i = 1; i < east.length; i++) {
    const a = east[i - 1], b = east[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (acc <= l) {
      const t = acc / l;
      out.push([POLE, +(a[0] + (b[0] - a[0]) * t).toFixed(1), +(a[1] + (b[1] - a[1]) * t).toFixed(1), 0]);
      acc += 38;
    }
    acc -= l;
  }
  return out;
}

export function createAksi(scene, world, opts = {}) {
  const loop = sampleLoop(loopPoints());
  const man = buildJogger();
  man.group.visible = false;
  scene.add(man.group);
  const decor = new THREE.Group();
  decor.visible = false;
  scene.add(decor);
  let built = false;

  function build() {
    built = true;
    const g = (x, z) => world.heightAt(x, z);
    const solids = [];
    const p = new Parts();
    // trampoline: black mat on a blue padded ring, legs and a net on poles
    {
      const [x, z, r] = TRAMPOLINE, y = g(x, z);
      p.add(new THREE.CylinderGeometry(r - 0.1, r - 0.1, 0.03, 28), 0x16161a, x, y + 0.9, z);
      p.add(new THREE.TorusGeometry(r, 0.13, 6, 28).rotateX(Math.PI / 2), 0x2a63c4, x, y + 0.92, z);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        p.add(BOX(0.06, 0.9, 0.06), 0x5a5d66, px, y + 0.45, pz);
        p.add(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 6), 0x2a63c4, px, y + 1.8, pz);
      }
      p.add(new THREE.TorusGeometry(r, 0.03, 4, 28).rotateX(Math.PI / 2), 0x2a63c4, x, y + 2.7, z);
    }
    // above-ground pool: grey-blue wall, light water inside, a small ladder
    {
      const [x, z, r] = POOL, y = g(x, z);
      p.add(new THREE.CylinderGeometry(r, r, 1.1, 32, 1, true), 0x9fb2c6, x, y + 0.55, z);
      p.add(new THREE.TorusGeometry(r, 0.05, 4, 32).rotateX(Math.PI / 2), 0xe8edf2, x, y + 1.1, z);
      p.add(new THREE.CylinderGeometry(r - 0.03, r - 0.03, 0.02, 32), 0x58c7e6, x, y + 0.95, z);
      p.add(BOX(0.5, 1.3, 0.08), 0xc8ccd2, x - r - 0.25, y + 0.65, z);
    }
    // mailbox on a post at the gate of the house in the bend
    {
      const [x, z] = MAILBOX, y = g(x, z);
      p.add(BOX(0.08, 1.05, 0.08), 0x6b5440, x, y + 0.52, z);
      p.add(BOX(0.42, 0.3, 0.24), 0x2b5f8a, x, y + 1.17, z, Math.PI / 2 + 0.4);
      p.add(new THREE.CylinderGeometry(0.12, 0.12, 0.42, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), 0x2b5f8a, x, y + 1.32, z, Math.PI / 2 + 0.4);
    }
    const m = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    if (m) { m.castShadow = !!opts.shadows; m.receiveShadow = true; decor.add(m); }
    decor.traverse((o) => { if (o.isMesh) { o.castShadow = !!opts.shadows; o.receiveShadow = true; } });
    solids.push({ x: TRAMPOLINE[0], z: TRAMPOLINE[1], yaw: 0, hx: 1.6, hz: 1.6 }, { x: POOL[0], z: POOL[1], yaw: 0, hx: 2.0, hz: 2.0 });
    world.addSolids(solids);
    decor.visible = true;
  }

  // where on the loop at distance s: point and heading
  function at(s) {
    s = ((s % loop.length) + loop.length) % loop.length;
    let lo = 0, hi = loop.pts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (loop.s[mid] <= s) lo = mid; else hi = mid - 1; }
    const a = loop.pts[lo], b = loop.pts[(lo + 1) % loop.pts.length], t = (s - loop.s[lo]) / ((loop.s[lo + 1] - loop.s[lo]) || 1);
    return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, yaw: Math.atan2(b[0] - a[0], -(b[1] - a[1])) };
  }

  // stepping aside: he keeps an eye on cars coming at him and moves off their line
  const side = { x: 0, z: 0 }, trunks = [], grad = [0, 0];
  let yawShown = null;
  function dodge(car, x, z, dt) {
    let tx = 0, tz = 0;
    const sp = Math.hypot(car.vx, car.vy);
    if (sp > 2) {
      const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), dx = x - car.x, dz = z - car.z;
      const ahead = dx * fx + dz * fz, across = -dx * fz + dz * fx;      // along the car, and to its right
      if (ahead > -2 && ahead < sp * 2 + 4 && Math.abs(across) < 3.2) {
        const s = across >= 0 ? 1 : -1, push = 3.4 - Math.abs(across);
        tx = -fz * s * push; tz = fx * s * push;
      }
    }
    // a car standing on his line: round it
    const cx = x - car.x, cz = z - car.z, cd = Math.hypot(cx, cz);
    if (cd < 3.2 && cd > 1e-3) { tx += (cx / cd) * (3.2 - cd); tz += (cz / cd) * (3.2 - cd); }
    // and round tree trunks, solid street furniture and parked cars on his line
    world.trunksNear(x, z, 2, trunks);
    for (let i = 0; i < trunks.length; i += 3) {
      const ex = x - trunks[i], ez = z - trunks[i + 1], d = Math.hypot(ex, ez), clear = trunks[i + 2] + 0.75;
      if (d < clear && d > 1e-3) { tx += (ex / d) * (clear - d) * 1.1; tz += (ez / d) * (clear - d) * 1.1; }
    }
    const sd = world.sdfAt(x, z);
    if (sd < 0.8) { world.sdfGrad(x, z, grad); tx += grad[0] * (0.8 - sd) * 1.1; tz += grad[1] * (0.8 - sd) * 1.1; }
    const k = Math.min(1, dt * 3);
    side.x += (tx - side.x) * k; side.z += (tz - side.z) * k;
  }

  function update(car, dt) {
    if (!car) return;
    const dx = car.x - CENTRE[0], dz = car.z - CENTRE[1], near = dx * dx + dz * dz < 420 * 420;
    if (!near || !world.ready(CENTRE[0], CENTRE[1]) || !world.ready(ROAD[9][0], ROAD[9][1])) { man.group.visible = false; return; }
    if (!built) build();
    const dist = window.__joggerS ?? (Date.now() / 1000) * SPEED;       // __joggerS: test hook
    const P = at(dist);
    dodge(car, P.x, P.z, dt);
    const x = P.x + side.x, z = P.z + side.z;
    man.group.position.set(x, world.heightAt(x, z), z);
    // turn smoothly (the loop's corners are tight)
    if (yawShown === null) yawShown = P.yaw;
    let d = P.yaw - yawShown;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    yawShown += d * Math.min(1, dt * 6);
    man.group.rotation.y = -yawShown;
    man.group.visible = true;
    man.update(dt, SPEED, dist % 1720);
  }

  return { update, man, loop, at, decor };
}
