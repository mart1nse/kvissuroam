// The left corner from Pirita tee onto Rummu tee as it was raced (Martin, 28 Nov 2026, with frames of the 2002 Kalevi
// Suursõit, Street View and the air photo: "there is a kerb all the way ... also the kerb extends into the first corner,
// making cutting more difficult. add the kerb. also there are two sturdier posts in the inside, add them but hitting
// them results them in bending but not really breaking. every additional hit bends a bit more. also on the outside of
// the corner there are tyre stacks ... also the trees seem to be more towards the apex of the corner").
//
//  - A granite kerb, 12 cm, along the inside (left) edge of the inner carriageway from the Kloostrimetsa lights to
//    this corner, round the corner's own curve (the slip road's inner edge, traced on the air photo) and a little way
//    up Rummu tee. Open on the bridge, where a road joins and at the crossing. The cars feel it (world.addBump).
//  - Two concrete lamp posts at that kerb, padded white for the race as in the 2002 frames. Solid; a car that hits one
//    leans it a little further each time, up to about 35 degrees. It never comes down.
//  - A wall of tyre stacks along the outer (right) edge for the last 112 m to the corner, on Martin's pink line. Solid.
//  - Seven more pines on the lawn inside the corner, 3 to 5 m behind the kerb (the map's own begin 13 m back).
//
// Built as the car comes near, in steps through the work queue; the posts and the trees' places are known from the start.
import * as THREE from 'three';
import { jobs } from '../../jobs.js';
import { still } from '../../still.js';
import { createKerb, rounded } from './kerb.js';

const H = 0.12;                                              // the kerb's height
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
// the corner's inner kerb on the air photo, from where it leaves the carriageway's edge to Rummu tee's
const ARC = [[-1092.6, -2.6], [-1093.0, 0.0], [-1092.7, 2.3], [-1091.7, 5.0], [-1090.0, 7.5], [-1087.5, 9.5], [-1084.0, 11.5], [-1080.0, 13.2]];
const I_FROM = 2218, I_ARC = 2561, I_RUMMU = 2587, I_END = 2600;      // lap points: the kerb's start, where the curve takes over, Rummu tee
const ZEBRA = [-763.7, -366.7];                                        // the crossing by the bridge: the kerb is down there
// (the onboard lap of the 2005 race shows the wall from just past the Pirita bridge's end: 150 m, Martin 28 Nov 2026)
const WALL_I = 2566, WALL_LEN = 150;                                   // the tyre wall ends at this lap point
// the pines inside the corner: [x, z, height, crown]
const PINES = [[-1088.4, -4.4, 19, 6.5], [-1088.0, 0.5, 21, 7.5], [-1085.5, -6.5, 18, 6], [-1083.5, -1.5, 20, 7], [-1084.5, 8.2, 19, 6.5], [-1080.0, 9.5, 21, 7], [-1079.0, -4.0, 18, 6]];
// (a conifer here is a pine or, one in seven, a spruce, by its place: scenery.js treeSpecies. These are pines.)
const isPine = (x, z) => Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 < 0.85;

// lap: { at(s, o), SS, iOf } of pirita.js; L: its lay() (road widths, bridge levels, joins)
export function createRummuKurv(scene, world, lap, L) {
  const { at, SS } = lap;
  const half = (i) => L.W[i] / 2;

  // ---- the kerb's runs: polylines in the lap's direction, the lawn on their left
  const runs = [];
  {
    let run = null;
    const flush = () => { if (run && run.length > 2) runs.push(run); run = null; };
    for (let s = SS[I_FROM]; s <= SS[I_ARC]; s += 2) {
      const q = at(s), i = q[4], h = half(i), p = at(s, -h);
      if (L.LV[i] === 1 || L.joins(s, -(h + 0.6), 1.5) || Math.hypot(p[0] - ZEBRA[0], p[1] - ZEBRA[1]) < 6) { flush(); continue; }
      (run ||= []).push([p[0], p[1]]);
    }
    // round the corner: the traced curve between the carriageway's edge and Rummu tee's, its bends rounded twice
    const bend = [...(run || []).splice(-2), ...ARC];
    for (let s = SS[I_RUMMU]; s <= SS[I_END]; s += 2) { const p = at(s, -half(at(s)[4])); bend.push([p[0], p[1]]); }
    run = [...(run || []), ...rounded(bend, 2)];
    flush();
  }

  // ---- the trees and the solid things, known before the map squares come
  world.addTrees(PINES.map(([x, z, h, c]) => { while (!isPine(x, z)) x += 0.1; return [x, z, h, c, 1]; }));
  // the posts: 1.6 m behind the kerb, where the curve begins and two thirds of the way round
  const bendRun = runs[runs.length - 1];
  const onKerb = (x, z, back) => {
    let bj = 0, bd = Infinity;
    for (let j = 0; j < bendRun.length - 1; j++) { const d = Math.hypot(bendRun[j][0] - x, bendRun[j][1] - z); if (d < bd) { bd = d; bj = j; } }
    const a = bendRun[bj], b = bendRun[bj + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [a[0] + ((b[1] - a[1]) / l) * back, a[1] - ((b[0] - a[0]) / l) * back];
  };
  const posts = [onKerb(-1092.4, -3.4, 1.6), onKerb(-1090.4, 7.0, 1.6)].map(([x, z]) => ({ x, z, tx: 0, tz: 0, hitT: -9, obj: null }));
  world.addSolids(posts.map((p) => ({ x: p.x, z: p.z, yaw: 0, hx: 0.17, hz: 0.17 })));
  // the tyre wall's line: 0.5 m outside the road's right edge, its last metres bent a metre in towards the corner
  const wall = [];
  for (let s = SS[WALL_I] - WALL_LEN; s <= SS[WALL_I]; s += 0.66) {
    const i = at(s)[4], left = SS[WALL_I] - s, p = at(s, half(i) + 0.5 - smooth(1 - left / 5) * 1.0);
    wall.push([p[0], p[1], Math.atan2(p[3], p[2])]);
  }
  {
    const solids = [];
    for (let k = 0; k + 1 < wall.length; k += 5) {
      const a = wall[k], b = wall[Math.min(wall.length - 1, k + 5)], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      // (half a metre thick, its face at the tyres' and the rest behind them: the cars' field of solid things is in
      // half-metre cells, and a wall as thin as the tyres let a car through at 50 km/h)
      const ux = (b[0] - a[0]) / (len || 1), uz = (b[1] - a[1]) / (len || 1);
      solids.push({ x: (a[0] + b[0]) / 2 - uz * 0.2, z: (a[1] + b[1]) / 2 + ux * 0.2, yaw: Math.atan2(-uz, ux), hx: len / 2 + 0.3, hz: 0.52 });
    }
    world.addSolids(solids);
  }

  // ---- what is drawn
  const group = still(new THREE.Group());
  scene.add(group);
  const moving = new THREE.Group();          // the posts: they lean
  scene.add(moving);
  const kerb = createKerb(world, group, runs, { H, name: 'rummu kerb' }), pieces = kerb.pieces;


  // a stack of five tyres, a metre high: one shape, drawn once per stack
  function tyreStack() {
    const pos = [], col = [], idx = [];
    const SIDES = 10, R = 0.31, HOLE = 0.17, T = 0.2;
    const ring = (y, r, c) => { const o = pos.length / 3; for (let k = 0; k < SIDES; k++) { const a = (k / SIDES) * Math.PI * 2; pos.push(Math.cos(a) * r, y, Math.sin(a) * r); col.push(c, c, c * 1.06); } return o; };
    const band = (a, b) => { for (let k = 0; k < SIDES; k++) { const k2 = (k + 1) % SIDES; idx.push(a + k, a + k2, b + k, b + k, a + k2, b + k2); } };
    for (let t = 0; t < 5; t++) {
      const y = t * T, tread = 0.055 + (t % 2) * 0.012;
      // the shoulder, the tread, the shoulder: a tyre's side seen from the road
      const a = ring(y + 0.01, R - 0.05, 0.03), b = ring(y + 0.05, R, tread), c = ring(y + T - 0.05, R, tread), d = ring(y + T - 0.01, R - 0.05, 0.03);
      band(a, b); band(b, c); band(c, d);
      if (t === 4) { const e = ring(y + T - 0.01, HOLE, 0.02), f = ring(y + T - 0.12, HOLE, 0.008); band(d, e); band(e, f); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  function* buildWall() {
    const im = new THREE.InstancedMesh(tyreStack(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), wall.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    wall.forEach(([x, z], k) => {
      const jx = (rnd() - 0.5) * 0.06, jz = (rnd() - 0.5) * 0.06;
      p.set(x + jx, world.heightAt(x, z) - 0.02, z + jz);
      q.setFromAxisAngle(up, rnd() * 6.283);
      s.set(1, rnd() < 0.12 ? 0.8 : 1, 1);                    // a stack of four here and there
      im.setMatrixAt(k, m.compose(p, q, s));
    });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = true;
    im.matrixAutoUpdate = false;
    yield;
    group.add(im);
  }
  function buildPosts() {
    const concrete = new THREE.MeshLambertMaterial({ color: 0x9c9a94 }), pad = new THREE.MeshLambertMaterial({ color: 0xe8e6de }), strap = new THREE.MeshLambertMaterial({ color: 0x2a2b30 });
    const gPole = new THREE.CylinderGeometry(0.085, 0.13, 8, 8).translate(0, 4, 0);
    const gPad = new THREE.CylinderGeometry(0.3, 0.32, 1.5, 10).translate(0, 0.85, 0);
    const gStrap = new THREE.CylinderGeometry(0.325, 0.325, 0.05, 10);
    const gArm = new THREE.BoxGeometry(1.6, 0.07, 0.07).translate(0.8, 7.9, 0), gHead = new THREE.BoxGeometry(0.5, 0.09, 0.22).translate(1.75, 7.86, 0);
    for (const post of posts) {
      const o = new THREE.Group();
      o.add(new THREE.Mesh(gPole, concrete), new THREE.Mesh(gPad, pad), new THREE.Mesh(gArm, concrete), new THREE.Mesh(gHead, concrete));
      for (const y of [0.45, 1.25]) { const b = new THREE.Mesh(gStrap, strap); b.position.y = y; o.add(b); }
      o.position.set(post.x, world.heightAt(post.x, post.z) - 0.05, post.z);
      // (the lamp's arm out over the road: away from the lawn)
      const q = onKerb(post.x, post.z, 0);
      post.yaw = Math.atan2(-(q[1] - post.z), q[0] - post.x);
      o.rotation.set(0, post.yaw, 0);
      o.children[0].castShadow = true;
      post.obj = o;
      moving.add(o);
    }
  }
  // a post leans: tx, tz the lean as a vector along the ground (radians, towards where it was pushed)
  const qY = new THREE.Quaternion(), qT = new THREE.Quaternion(), axis = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function lean(post) {
    const a = Math.hypot(post.tx, post.tz);
    qY.setFromAxisAngle(UP, post.yaw);
    if (a > 1e-4) { axis.set(post.tz / a, 0, -post.tx / a); qT.setFromAxisAngle(axis, a); post.obj.quaternion.copy(qT).multiply(qY); } else post.obj.quaternion.copy(qY);
  }
  const MAX_LEAN = 0.62;

  const C = ARC[3];
  let cornerBuilt = false, clock = 0, last = 0;
  return {
    info: () => ({ runs: runs.length, kerb: pieces.filter((p) => p.built).length, of: pieces.length, corner: cornerBuilt, lean: posts.map((p) => +Math.hypot(p.tx, p.tz).toFixed(2)), wall: wall.length }),
    posts,
    update(car) {
      if (!car) return;
      const now = performance.now(), dt = Math.min(0.1, (now - (last || now)) / 1000);
      last = now; clock += dt;
      kerb.update(car);
      const dC = Math.hypot(C[0] - car.x, C[1] - car.z);
      if (!cornerBuilt && dC < 340 && world.ready(C[0], C[1]) && world.ready(wall[0][0], wall[0][1])) {
        cornerBuilt = true;
        jobs.add(function* rummuCorner() { buildPosts(); yield; yield* buildWall(); }, 'rummu corner');
      }
      // a car into a post (the post is solid: the car's own knock against it, car.hit, says it was hit): it leans a
      // little further away from the car, more for a harder hit
      if (dC < 40 && car.hit > 0.8) {
        const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
        for (const post of posts) {
          if (!post.obj || clock - post.hitT < 0.7) continue;
          const dx = post.x - car.x, dz = post.z - car.z, d = Math.hypot(dx, dz) || 1;
          if (Math.abs(dx * fx + dz * fz) > (car.halfLen || 2.2) + 1.0 || Math.abs(dx * rx + dz * rz) > (car.halfWid || 0.9) + 0.75) continue;
          post.hitT = clock;
          const add = 0.03 + Math.min(0.07, car.hit / 180);
          post.tx += (dx / d) * add; post.tz += (dz / d) * add;
          const a = Math.hypot(post.tx, post.tz);
          if (a > MAX_LEAN) { post.tx *= MAX_LEAN / a; post.tz *= MAX_LEAN / a; }
          lean(post);
        }
      }
    },
  };
}
