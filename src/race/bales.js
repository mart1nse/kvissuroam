// The straw bales at the apexes of the Raadi rally stage (Martin, 23 Nov 2026, from his pictures of SSS16):
// round bales standing on end, 1.2 m across and high, in netting, with a white TARTU VALD banner wrapped
// half way round; every few a bale in white wrap.
//
// A bale weighs about 340 kg (a round bale of straw this size, damp from standing out) and drags over the grass
// with a friction of about 0.75. The car and a bale trade momentum where they touch (the car's mass and turning inertia
// against the bale's), so a brush at walking pace only nudges it and friction stops it within a hand's
// width, a clip at speed sends it sliding and spinning and takes a good bite out of the car's speed and
// line, and a square hit lifts its far edge: under about 45 degrees it drops back, over that it goes over
// on its side. Straw gives a little where it was hit (a dent of up to 14 %), more the harder the hit.
// reset() stands them all up in their places again.
//
// And a hit shows (Martin 26 Nov: "some simple deforming visual qualities based on hit. Have some straws fall or
// fly out"): where the car struck, the bale's side is pressed into a hollow, deeper low down where the bumper is, up
// to DENT m for a hit at 70 km/h and more (two such places a bale, the newest and the deepest); the more it has
// been knocked about the lumpier it gets and the more its top sinks; and loose straw bursts out of the place
// (src/race/straw.js), the harder the hit the more, and trails off a bale that is thrown and tumbles. The dents
// are made in the bales' own shader from two numbers a bale: nothing is rebuilt at a hit.
import * as THREE from 'three';
import { paintScale } from '../world/paintscale.js';
import { createStraw } from './straw.js';

const R = 0.6, H = 1.2, MASS = 340, MU = 0.75, REST = 0, G = 9.81;   // (straw does not bounce; its rim digs into the turf as it slides)
// How heavy a bale is to the car depends on how squarely it is met (Martin 23 Nov: "If I hit a bale full on with
// throttle on, it hardly slows my pace, maybe add a bit of weight. Just brushing it and like halfway hits do not
// penalize that much"): square on the nose or tail, within SQUARE of the bumper's half width from its middle, the
// whole bale has to be shoved off and it digs in (HEAVY kg); out by the corners and along the sides it rolls off
// round its own axis and only LIGHT kg of it are in the way; in between, in between.
// (Martin 23 Nov 23:56, more: "a bit more weight ... more of a penalty when hitting them, still edges less hit, middle
// full hit impact": square on 480 to 680 kg, the edges 230 to 260)
// (Martin 26 Nov: "add more weight to the haybales": square on 680 to 950 kg, the edges 260 to 340, and as much
// heavier to turn about its axis)
const HEAVY = 950, LIGHT = 340, SQUARE = 0.3, SQUARE_END = 0.8;
const IY = 0.5 * MASS * R * R;                 // turning about its own axis
const TIP = Math.atan2(R, H / 2);              // lean past which it falls over (45 degrees for this shape)
const CORNER = 0.45;                           // how round the car's corners are taken to be (m)
// The nose and the tail are bowed, not flat (Martin 23 Nov: a bale caught in front rode along on the bumper and
// went the way he steered; it should drop off to the left or right quickly): the push leans outwards by this
// much at the bumper's end, so a bale off the middle slides further off, faster the further out it is.
const BOW = 0.75;
const RUB = 0.12;                              // straw against paint: how much of the push can drag it sideways
const BANNER_U = 0.4;                          // middle of the banner, as a share of the way round
const DENT = 0.22;                             // the deepest a side is pressed in (m, of the 0.6 m radius)
const DENT_V0 = 1.4, DENT_PER = 0.0115;        // closing speed (m/s) from which a hit leaves a dent, and m of dent per m/s over it
const SAME = 0.74;                             // a hit within about 42 degrees of an old dent deepens that one
const UP = new THREE.Vector3(0, 1, 0);

// The dents, the lumps and the sunken top, in the bale's own space before its instance is placed. aDentA: the
// first dent's way out from the axis (x, z, unit), its depth (m), and how knocked about the bale is (0..1).
// aDentB: the second dent, and a number of the bale's own for its lumps.
function dentShader(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aDentA;
        attribute vec4 aDentB;
        varying float vDent;
        void baleDent(inout vec3 p, inout vec3 n, vec2 dir, float depth, float y) {
          float r = length(p.xz);
          if (depth < 0.002 || r < 0.05) return;
          // a hollow about 60 degrees to either side of the place, deepest in its middle; the bumper is low, so
          // it is pressed in most below the bale's middle and less than half as much at the top
          vec2 rad = p.xz / r;
          float c = dot(rad, dir), w = smoothstep(0.42, 1.0, c);
          if (w <= 0.0) return;
          float d = depth * w * mix(1.0, 0.42, smoothstep(-0.25, 0.6, y)) * min(1.0, r / 0.5);
          p.xz -= rad * d;
          // (its flanks face the middle of the hollow)
          vec2 mid = dir - rad * c;
          n = normalize(n + vec3(mid.x, 0.0, mid.y) * (depth / 0.6) * 8.0 * w * (1.0 - w));
          vDent = max(vDent, w * depth / ${DENT.toFixed(2)});
        }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vec3 balePos = position;
        vDent = 0.0;
        baleDent(balePos, objectNormal, aDentA.xy, aDentA.z, position.y);
        baleDent(balePos, objectNormal, aDentB.xy, aDentB.z, position.y);
        {
          float an = atan(position.x, position.z);
          float lump = sin(an * 5.0 + position.y * 6.0 + aDentB.w) * sin(an * 3.0 - position.y * 9.0 + aDentB.w * 1.7);
          balePos.xz *= 1.0 + aDentA.w * 0.075 * lump;
          balePos.y -= aDentA.w * 0.07 * (0.6 + 0.4 * lump) * smoothstep(0.1, 0.6, position.y);
        }`)
      .replace('#include <begin_vertex>', 'vec3 transformed = balePos;');
    // (pressed straw is darker)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vDent;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 1.0 - 0.2 * vDent;');
  };
  return mat;
}

function baleTexture() {
  const k = paintScale(), W = Math.round(512 * k), Hh = Math.round(160 * k);
  const c = document.createElement('canvas');
  c.width = W; c.height = Hh;
  const g = c.getContext('2d');
  // straw: warm ochre with fine lengthwise strands (the stalks lie round the bale), from one noise sheet
  const img = g.createImageData(W, Hh), d = img.data;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const row = Array.from({ length: Hh }, rnd);
  for (let y = 0; y < Hh; y++) {
    let run = rnd();
    for (let x = 0; x < W; x++) {
      if (rnd() < 0.08) run = rnd();
      const v = 0.78 + 0.16 * row[y] + 0.14 * run - 0.08 * rnd();
      const o = (y * W + x) * 4;
      d[o] = Math.min(255, 196 * v); d[o + 1] = Math.min(255, 164 * v); d[o + 2] = Math.min(255, 96 * v); d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // the netting: thin pale lines round it, and the two twines
  g.strokeStyle = 'rgba(245, 236, 205, .35)'; g.lineWidth = Math.max(1, k);
  for (let y = 4 * k; y < Hh; y += 7 * k) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 2 * k); g.stroke(); }
  g.strokeStyle = 'rgba(90, 70, 30, .5)'; g.lineWidth = 2 * k;
  for (const y of [0.3, 0.72]) { g.beginPath(); g.moveTo(0, Hh * y); g.lineTo(W, Hh * y); g.stroke(); }
  // the banner: white sheet from a fifth to three fifths of the way round, the crest and TARTU VALD in blue
  const bx = W * (BANNER_U - 0.21), bw = W * 0.42, by = Hh * 0.2, bh = Hh * 0.62;
  g.fillStyle = '#f3f5f7'; g.fillRect(bx, by, bw, bh);
  g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(bx, by + bh - 3 * k, bw, 3 * k);
  const BLUE = '#1f5fc4';
  const cx = bx + bw * 0.2, cy = by + bh * 0.5, s = bh * 0.34;
  // (a shield with a cornflower over waves: the municipality's mark, drawn simply)
  g.strokeStyle = BLUE; g.lineWidth = 2 * k; g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(cx - s, cy - s); g.lineTo(cx + s, cy - s); g.lineTo(cx + s, cy + s * 0.3); g.quadraticCurveTo(cx + s, cy + s * 1.1, cx, cy + s * 1.25); g.quadraticCurveTo(cx - s, cy + s * 1.1, cx - s, cy + s * 0.3); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = BLUE;
  for (let a = 0; a < 8; a++) { const t = a * Math.PI / 4; g.beginPath(); g.ellipse(cx + Math.cos(t) * s * 0.36, cy - s * 0.2 + Math.sin(t) * s * 0.36, s * 0.26, s * 0.11, t, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.arc(cx, cy - s * 0.2, s * 0.12, 0, Math.PI * 2); g.fill();
  g.lineWidth = 1.5 * k;
  for (const wy of [0.55, 0.8]) { g.beginPath(); g.moveTo(cx - s * 0.7, cy + s * wy); g.quadraticCurveTo(cx - s * 0.35, cy + s * (wy - 0.2), cx, cy + s * wy); g.quadraticCurveTo(cx + s * 0.35, cy + s * (wy + 0.2), cx + s * 0.7, cy + s * wy); g.stroke(); }
  g.font = `900 ${Math.round(bh * 0.3)}px "Arial Black", Arial, sans-serif`;
  g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillText('TARTU VALD', bx + bw * 0.38, cy + 1, bw * 0.58);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// A round bale is rounded off at its rims, more at the top than where it sits (Martin 23 Nov 23:54: "round the
// hay bales a touch from the top, and a little from the bottom"): turned from a profile, bottom middle out round
// the lower rim, up the side, round the upper rim and in to the top middle. The side keeps the picture (the banner
// on its straight part, plain straw going over the rims); the ends a patch of plain straw from the far side of it.
const RIM_TOP = 0.13, RIM_BOT = 0.05;
function baleGeometry() {
  const seg = 20, pts = [], h = H / 2, side = H - RIM_TOP - RIM_BOT;
  const rim = (cx, cy, r, a0, a1, n) => {
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r)); }
  };
  pts.push(new THREE.Vector2(0, -h));
  rim(R - RIM_BOT, -h + RIM_BOT, RIM_BOT, -Math.PI / 2, 0, 2);
  // (two more rings up the side, so a dent can be deeper low down than at the top)
  pts.push(new THREE.Vector2(R, -0.2), new THREE.Vector2(R, 0.15));
  rim(R - RIM_TOP, h - RIM_TOP, RIM_TOP, 0, Math.PI / 2, 4);
  pts.push(new THREE.Vector2(0, h));
  const geo = new THREE.LatheGeometry(pts, seg);
  // (picture height: the straight side 0..1, the rims past its ends, where the picture's edge rows are plain straw)
  const uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), r = Math.hypot(x, z);
    if (Math.abs(y) > h - 1e-4 || (r < R - RIM_TOP - 1e-4 && Math.abs(y) > h - RIM_TOP)) {
      uv.setXY(i, 0.82 + (0.5 + 0.5 * x / R) * 0.14, 0.04 + (0.5 + 0.5 * z / R) * 0.1);       // an end
    } else {
      uv.setY(i, (y + h - RIM_BOT) / side);
    }
  }
  return geo;
}

// spots: [{ x, z, tx, tz }] where a bale stands and the direction the cars come from (the banner faces them)
export function createBales({ world, group, spots }) {
  const bales = spots.map((s, n) => ({
    home: s, white: n % 5 === 3,
    x: s.x, z: s.z, vx: 0, vz: 0,
    ry: 0, wy: 0,                      // turn about its axis (three.js angle) and its rate (car convention: + is clockwise from above)
    tilt: 0, tv: 0, tdx: 1, tdz: 0,    // lean, its rate, and the way it leans (unit)
    down: false,                       // gone over on its side
    sq: 0, sqa: 0,                     // dent (share of the radius) and where round the bale it is
    dent: [0, 0, 0, 0, 0, 0],          // the two places pressed in: way out from the axis (x, z, in the bale's own space) and depth, twice
    ruf: 0, shed: 0,                   // how knocked about it is (0..1); straw owed to the air as it tumbles
    awake: false,
  }));
  let meshes = null;
  // loose straw: fewer wisps on phones and weak computers (those paint small)
  const LIGHT_DEVICE = paintScale() < 1;
  const straw = createStraw({ world, group, max: LIGHT_DEVICE ? 130 : 320, wide: LIGHT_DEVICE });
  const ground = (x, z) => world.heightAt(x, z);
  // The ground under a bale's foot. The park's ground is only held round the car: away on the other side of town
  // it is let go, and what the map then gives is its rough far heights, over a metre out in places. A start from
  // there put every bale back on those, and ten of 23 stood sunk to their tops or in the air for the whole run
  // (Martin 26 Nov: "some haybales have sunken"). So a bale's own place keeps the height it had when the ground
  // was there, and a bale put down without the ground is put down again the moment it has loaded.
  let waiting = false;
  const there = (x, z) => !world.ready || world.ready(x, z);
  function groundOf(b) {
    const s = b.home, home = b.x === s.x && b.z === s.z;
    if (there(b.x, b.z)) { b.wait = false; b.gy = ground(b.x, b.z); if (home) s.y = b.gy; return b.gy; }
    if (home && s.y !== undefined) { b.wait = false; return s.y; }
    b.wait = waiting = true;
    return b.gy ?? ground(b.x, b.z);
  }
  const M = new THREE.Matrix4(), A = new THREE.Matrix4(), q = new THREE.Quaternion(), axis = new THREE.Vector3(), v3 = new THREE.Vector3(), sc = new THREE.Vector3();

  function draw(b) {
    if (!meshes) return;
    // from the inside out: the dent (squeezed along the hit, bulging a little across it), the turn about its
    // axis, the lean about a level axis square to the way it leans, then up so its lowest point is on the ground
    const t = b.tilt;
    M.makeRotationY(b.sqa); A.makeScale(1 + b.sq * 0.35, 1 - b.sq * 0.12, 1 - b.sq); M.multiply(A); A.makeRotationY(-b.sqa); M.multiply(A);
    A.makeRotationY(b.ry); M.premultiply(A);
    axis.set(b.tdz, 0, -b.tdx);
    A.makeRotationAxis(axis, t); M.premultiply(A);
    const y = groundOf(b) + (H / 2) * Math.cos(t) + R * Math.sin(t);
    // (leaning, it pivots on its lower rim: the middle moves that way too)
    const off = (H / 2) * Math.sin(t) + R * (1 - Math.cos(t));
    M.setPosition(b.x + b.tdx * off, y, b.z + b.tdz * off);
    const [mesh, i] = b.slot;
    mesh.setMatrixAt(i, M);
    mesh.instanceMatrix.needsUpdate = true;
  }

  // its dents and lumps to its shader
  function drawDents(b) {
    if (!meshes) return;
    const [mesh, i] = b.slot, A = mesh.geometry.attributes.aDentA, B = mesh.geometry.attributes.aDentB, d = b.dent;
    A.setXYZW(i, d[0], d[1], d[2], b.ruf);
    B.setXYZW(i, d[3], d[4], d[5], B.getW(i));
    A.needsUpdate = B.needsUpdate = true;
  }

  // A hit at the closing speed vn from the car's side (the push on the bale goes along nx, nz): the place is
  // pressed in, and straw flies from it with the car's speed (wvx, wvz).
  function strike(b, nx, nz, vn, rad, wvx, wvz) {
    // towards the car, in the bale's own space (it has turned, and may be lying)
    v3.set(-nx, 0, -nz);
    if (b.tilt) v3.applyAxisAngle(axis.set(b.tdz, 0, -b.tdx), -b.tilt);
    v3.applyAxisAngle(UP, -b.ry);
    const l = Math.hypot(v3.x, v3.z), add = Math.min(DENT, (vn - DENT_V0) * DENT_PER) * Math.min(1, l * 1.2);
    // (on an end of a bale lying down: no dent in its side)
    if (add > 0.004 && l > 0.35) {
      const lx = v3.x / l, lz = v3.z / l, d = b.dent;
      const same = (k) => d[k + 2] > 0 && d[k] * lx + d[k + 1] * lz > SAME;
      let k = same(0) ? 0 : same(3) ? 3 : -1;
      if (k >= 0) {
        // the same place again: deeper, a little, and the place moves towards the new hit
        const w = add / (add + d[k + 2]), mx = d[k] + (lx - d[k]) * w, mz = d[k + 1] + (lz - d[k + 1]) * w, ml = Math.hypot(mx, mz) || 1;
        d[k] = mx / ml; d[k + 1] = mz / ml;
        d[k + 2] = Math.min(DENT, Math.max(d[k + 2], add) + 0.3 * Math.min(d[k + 2], add));
      } else {
        // a new place: instead of the shallower of the two, if it is deeper than half of that
        k = d[2] <= d[5] ? 0 : 3;
        if (add > d[k + 2] * 0.5) { d[k] = lx; d[k + 1] = lz; d[k + 2] = add; }
      }
    }
    b.ruf = Math.min(1, b.ruf + Math.max(0, vn - DENT_V0) * 0.035);
    drawDents(b);
    // straw out of the place: from none at a nudge to a cloud of it at 60 km/h
    const n = Math.min(LIGHT_DEVICE ? 20 : 44, Math.floor((vn - 1) * (LIGHT_DEVICE ? 1.3 : 2.8)));
    if (n > 0) {
      const cx = b.x - nx * rad * 0.8, cz = b.z - nz * rad * 0.8;
      straw.burst(cx, ground(cx, cz) + 0.55, cz, wvx * 0.8, wvz * 0.8, 1.2 + vn * 0.22, n, b.white);
    }
  }

  function reset() {
    for (const b of bales) {
      const s = b.home;
      b.x = s.x; b.z = s.z; b.vx = b.vz = 0; b.wy = 0; b.tilt = 0; b.tv = 0; b.down = false; b.sq = 0; b.awake = false;
      b.gy = undefined;
      b.dent.fill(0); b.ruf = 0; b.shed = 0;
      drawDents(b);
      // the banner's middle towards the cars coming: the side at u is at the angle u * 2 pi from +z, towards +x
      b.ry = Math.atan2(-s.tx, -s.tz) - BANNER_U * Math.PI * 2;
      draw(b);
    }
    straw.clear();
  }

  function build() {
    const geo = baleGeometry();
    // (the two kinds share the shape; each has its own list of its bales' dents)
    const own = (n) => {
      const g = new THREE.BufferGeometry();
      g.setIndex(geo.index);
      for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]);
      const A = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4), B = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
      for (let i = 0; i < n; i++) B.setW(i, i * 2.4 + 1);
      g.setAttribute('aDentA', A); g.setAttribute('aDentB', B);
      return g;
    };
    const ns0 = bales.filter((b) => !b.white).length || 1, nw0 = bales.filter((b) => b.white).length || 1;
    const netted = new THREE.InstancedMesh(own(ns0), dentShader(new THREE.MeshLambertMaterial({ map: baleTexture() })), ns0);
    const wrap = new THREE.InstancedMesh(own(nw0), dentShader(new THREE.MeshLambertMaterial({ color: 0xeef0f2 })), nw0);
    let ns = 0, nw = 0;
    for (const b of bales) b.slot = b.white ? [wrap, nw++] : [netted, ns++];
    for (const m of [netted, wrap]) { m.castShadow = true; m.frustumCulled = false; group.add(m); }
    meshes = [netted, wrap];
    straw.build();
    reset();
  }

  // the car against each bale, then each moving bale against the ground
  function update(car, dt) {
    if (!meshes || dt <= 0) return;
    // (bales put down before their ground had loaded: onto it as it comes)
    if (waiting) {
      waiting = false;
      for (const b of bales) if (b.wait) { if (there(b.x, b.z)) draw(b); else waiting = true; }
    }
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
    const hl = car.halfLen, hw = car.halfWid, Mc = car.spec.mass, Iz = car.iz || Mc * 2;
    for (const b of bales) {
      // (lying on its side, its middle is where it fell to: half its height and its radius on from its foot)
      const lie = b.down ? H / 2 + R : 0;
      const dx = b.x + b.tdx * lie - car.x, dz = b.z + b.tdz * lie - car.z;
      if (dx * dx + dz * dz < 25) {
        const rad = b.down ? 0.72 : R * (1 - b.sq * 0.5);
        // the point of the car's outline nearest the bale's middle
        const lf = dx * fx + dz * fz, ll = dx * rx + dz * rz;
        // (the outline has round corners, CORNER m: a bale caught by a corner of the bumper is pushed aside, not carried along)
        let cf = Math.max(-(hl - CORNER), Math.min(hl - CORNER, lf)), cl = Math.max(-(hw - CORNER), Math.min(hw - CORNER, ll));
        let ox = dx - (fx * cf + rx * cl), oz = dz - (fz * cf + rz * cl), d = Math.hypot(ox, oz), nx, nz, pen;
        if (d < 1e-4) {
          // its middle is inside the outline (a very fast hit): out through the nearest side
          const pf = hl - Math.abs(lf), pl = hw - Math.abs(ll);
          if (pf < pl) { nx = fx * Math.sign(lf || 1); nz = fz * Math.sign(lf || 1); pen = pf + rad; }
          else { nx = rx * Math.sign(ll || 1); nz = rz * Math.sign(ll || 1); pen = pl + rad; }
        } else {
          nx = ox / d; nz = oz / d; pen = rad + CORNER - d;
          if (Math.abs(lf) > hl - CORNER && Math.abs(ll) < hw - CORNER) {
            const k = BOW * ll / hw, l = Math.hypot(1, k);
            nx = (nx + rx * k) / l; nz = (nz + rz * k) / l;
          }
        }
        if (pen > 0) {
          const onEnd = Math.abs(lf) > hl - CORNER;
          const sq = onEnd ? Math.max(0, Math.min(1, 1 - (Math.abs(ll) / hw - SQUARE) / (SQUARE_END - SQUARE))) : 0;
          const Mb = LIGHT + (HEAVY - LIGHT) * sq * sq * (3 - 2 * sq);
          // where they touch, from the car's middle and from the bale's
          const ax = dx - nx * rad, az = dz - nz * rad, bx = -nx * rad, bz = -nz * rad;
          const wvx = car.vx * fx + car.vy * rx, wvz = car.vx * fz + car.vy * rz;
          const cvx = wvx - car.yawRate * az, cvz = wvz + car.yawRate * ax;
          const bvx = b.vx - b.wy * bz, bvz = b.vz + b.wy * bx;
          const vn = (cvx - bvx) * nx + (cvz - bvz) * nz;           // closing speed along the push
          const ca = ax * nz - az * nx, cb = bx * nz - bz * nx;
          if (vn > 0) {
            const J = (1 + REST) * vn / (1 / Mc + 1 / Mb + (ca * ca) / Iz + (cb * cb) / IY);
            // the bale: off it goes, turning if it was caught off its middle; straw rubs along the bodywork too
            const tx = -nz, tz = nx, vt = (cvx - bvx) * tx + (cvz - bvz) * tz;
            const Jt = Math.max(-RUB * J, Math.min(RUB * J, vt * Mb * 0.5));
            b.vx += (J * nx + Jt * tx) / Mb; b.vz += (J * nz + Jt * tz) / Mb;
            b.wy += (cb * J + (bx * tz - bz * tx) * Jt) / IY;
            // caught by a corner of the car, off the car's middle: its near side is carried along and it spins round
            b.wy += Math.max(-1, Math.min(1, ll / hw)) * J * 0.3 * R / IY;
            // the bumper is below the bale's middle and the ground holds its foot: a hard knock lifts the near
            // edge and it leans away from the car
            const kick = J / Mb;
            if (!b.down && kick > 1.2) { b.tdx = nx; b.tdz = nz; b.tv = Math.max(b.tv, Math.min(4.5, (kick - 1.2) * 0.42)); }
            // the dent
            if (kick > 1.5) { const add = Math.min(0.14 - b.sq, (kick - 1.5) * 0.012); if (add > 0) { b.sq += add; b.sqa = Math.atan2(-nx, -nz) - b.ry; } }
            // (and the place pressed in, and straw out of it)
            if (vn > 1) strike(b, nx, nz, vn, rad, wvx, wvz);
            // the car: the same push back, at the point of contact
            const nvx = wvx - (J * nx + Jt * tx) / Mc, nvz = wvz - (J * nz + Jt * tz) / Mc;
            car.vx = nvx * fx + nvz * fz; car.vy = nvx * rx + nvz * rz;
            car.yawRate += Math.max(-1.2, Math.min(1.2, -(ca * J + (ax * tz - az * tx) * Jt) / Iz));
            car.hit = Math.max(car.hit || 0, vn * 0.5);
            b.awake = true;
          }
          // apart again, each by the other's share of the weight (a bale standing still holds its ground against a gentle lean)
          const still = !b.awake || Math.hypot(b.vx, b.vz) < 0.05;
          const share = still && vn <= 0.3 ? 0 : Mc / (Mc + Mb);
          b.x += nx * pen * share; b.z += nz * pen * share;
          car.x -= nx * pen * (1 - share); car.z -= nz * pen * (1 - share);
          if (share) b.awake = true;
          draw(b);
        }
      }
      if (!b.awake) continue;
      // sliding on the grass: friction against the way it goes, and against its spin
      // (thrown fast it tumbles and sheds straw rather than sliding like a puck: a drag that grows with its speed,
      // and more grip once it is over on its side)
      const sp = Math.hypot(b.vx, b.vz), mu = b.down ? 1.2 : MU;
      if (sp > 0) { const drop = Math.min(sp, (mu * G + 0.9 * sp) * dt); b.vx -= b.vx / sp * drop; b.vz -= b.vz / sp * drop; }
      const wdrop = (4 / 3) * mu * G / R * dt;
      b.wy = Math.abs(b.wy) <= wdrop ? 0 : b.wy - Math.sign(b.wy) * wdrop;
      b.x += b.vx * dt; b.z += b.vz * dt;
      b.ry -= b.wy * dt;
      // the lean: its weight pulls it back down until it is past the tipping point, then over it goes
      if (!b.down && (b.tilt > 0 || b.tv > 0)) {
        b.tv += (b.tilt < TIP ? -9 * Math.cos(b.tilt) : 7) * dt;
        b.tilt += b.tv * dt;
        if (b.tilt <= 0) { b.tilt = 0; b.tv = 0; }
        else if (b.tilt >= Math.PI / 2) {
          b.tilt = Math.PI / 2; b.tv = 0; b.down = true;
          // (it lands on its side: a puff of straw off it, and it is the worse for it)
          const lx = b.x + b.tdx * (H / 2 + R), lz = b.z + b.tdz * (H / 2 + R);
          straw.burst(lx, ground(lx, lz) + 0.5, lz, b.vx, b.vz, 1.6, LIGHT_DEVICE ? 4 : 9, b.white);
          b.ruf = Math.min(1, b.ruf + 0.25); drawDents(b);
        }
      }
      // thrown fast, it leaves straw behind it
      if (sp > 3.5) {
        b.shed += (sp - 3.5) * (LIGHT_DEVICE ? 1.2 : 2.5) * dt;
        if (b.shed >= 1) { const n = Math.floor(b.shed); b.shed -= n; straw.burst(b.x, ground(b.x, b.z) + 0.7, b.z, b.vx * 0.5, b.vz * 0.5, 1, n, b.white); }
      }
      draw(b);
      if (sp < 0.02 && b.wy === 0 && (b.tilt === 0 || b.down)) { b.vx = b.vz = 0; b.awake = false; }
    }
    straw.update(car, dt);
  }

  return { build, reset, update, bales, straw, get built() { return !!meshes; } };
}
