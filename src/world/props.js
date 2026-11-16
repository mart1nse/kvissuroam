// Street furniture at the places where Mapillary detected it in street photos (CC BY-SA):
// street lights, poles, traffic lights and signs, benches, bins, bike racks, cabinets and zebra crossings.
// Everything in a sector is merged into a handful of meshes. Driving into a prop knocks it loose: it is
// cut out of the merged mesh and flies off as its own rigid body (see knock() below). Knocked props stay
// where they came to rest for the rest of the browser session (sessionStorage) and are back next time.
import * as THREE from 'three';

const LIGHT = 0, POLE = 1, SIGNAL = 2, BENCH = 3, BIN = 4, RACK = 5, BOX = 6, ZEBRA = 7, BOLLARD = 8, SIGN0 = 10;
const FACES = 13;

function part(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  return { pos: g.attributes.position.array, nor: g.attributes.normal.array, uv: g.attributes.uv?.array, col: [c.r, c.g, c.b] };
}
const box = (w, h, d, x, y, z, hex) => part(new THREE.BoxGeometry(w, h, d).translate(x, y, z), hex);
const cyl = (r, h, x, y, z, hex, sides = 6) => part(new THREE.CylinderGeometry(r * 0.8, r, h, sides, 1, true).translate(x, y, z), hex);

// local axes: +z is "forward" (towards the road for lights, the facing of a sign)
const SOLID = {
  [LIGHT]: [cyl(0.09, 8.2, 0, 4.1, 0, 0x55525e), box(0.09, 0.09, 1.9, 0, 8.15, 0.9, 0x55525e), box(0.3, 0.12, 0.7, 0, 8.08, 1.75, 0x3a3842)],
  [POLE]: [cyl(0.12, 8.5, 0, 4.25, 0, 0x5a4636)],
  [SIGNAL]: [cyl(0.07, 3.4, 0, 1.7, 0, 0x4a4852), box(0.32, 0.95, 0.28, 0, 3.0, 0.1, 0x16151a)],
  [BENCH]: [box(1.7, 0.08, 0.45, 0, 0.45, 0, 0x7a5230), box(1.7, 0.4, 0.06, 0, 0.75, -0.22, 0x7a5230), box(0.08, 0.45, 0.4, -0.75, 0.22, 0, 0x33323a), box(0.08, 0.45, 0.4, 0.75, 0.22, 0, 0x33323a)],
  [BIN]: [cyl(0.24, 0.85, 0, 0.43, 0, 0x2d4a3c, 8)],
  [RACK]: [box(1.6, 0.05, 0.05, 0, 0.8, 0, 0x8a8a94), box(0.05, 0.8, 0.05, -0.78, 0.4, 0, 0x8a8a94), box(0.05, 0.8, 0.05, 0.78, 0.4, 0, 0x8a8a94), box(0.05, 0.8, 0.05, 0, 0.4, 0, 0x8a8a94)],
  [BOX]: [box(0.8, 1.15, 0.35, 0, 0.58, 0, 0x7d8a84)],
  // short black street bollard with a reflective band
  [BOLLARD]: [cyl(0.075, 0.82, 0, 0.41, 0, 0x16161b, 8), cyl(0.08, 0.07, 0, 0.7, 0, 0xd8dde6, 8), cyl(0.09, 0.05, 0, 0.84, 0, 0x16161b, 8)],
  sign: [cyl(0.035, 2.9, 0, 1.45, 0, 0x8a8a94, 5)],
};
const GLOW = {
  [LIGHT]: box(0.24, 0.05, 0.6, 0, 8.0, 1.75, 0xffe2a8),
};
const POOL = part(new THREE.PlaneGeometry(13, 13).rotateX(-Math.PI / 2).translate(0, 0.07, 1.75), 0xffffff);
const PLATE = part(new THREE.PlaneGeometry(0.72, 0.72).translate(0, 2.5, 0.05), 0xffffff);

// sign faces in one strip: speed, prohibit, no entry, mandatory, warning, yield, priority, crossing, info, stop,
// speed 40, parking, speed 30
function signAtlas() {
  const S = 96, cv = document.createElement('canvas');
  cv.width = S * FACES; cv.height = S;
  const c = cv.getContext('2d');
  const at = (i) => { c.setTransform(1, 0, 0, 1, i * S + S / 2, S / 2); };
  const disc = (r, fill) => { c.beginPath(); c.arc(0, 0, r, 0, 7); c.fillStyle = fill; c.fill(); };
  const poly = (pts, fill) => { c.beginPath(); pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = fill; c.fill(); };
  const red = '#d6263c', blue = '#1f55b5', white = '#f4f2f0', yellow = '#f5c228';
  at(0); disc(44, red); disc(33, white); c.fillStyle = '#18161c'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('50', 0, 2);
  at(1); disc(44, red); disc(33, white); c.rotate(-0.78); c.fillStyle = red; c.fillRect(-36, -5, 72, 10);
  at(2); disc(44, red); c.fillStyle = white; c.fillRect(-30, -8, 60, 16);
  at(3); disc(44, blue); poly([[0, -28], [20, -2], [8, -2], [8, 28], [-8, 28], [-8, -2], [-20, -2]], white);
  at(4); poly([[0, -44], [46, 38], [-46, 38]], red); poly([[0, -24], [28, 28], [-28, 28]], white); c.fillStyle = '#18161c'; c.fillRect(-3, -6, 6, 20); c.fillRect(-3, 18, 6, 6);
  at(5); poly([[-46, -38], [46, -38], [0, 44]], red); poly([[-28, -27], [28, -27], [0, 24]], white);
  at(6); poly([[0, -46], [46, 0], [0, 46], [-46, 0]], white); poly([[0, -32], [32, 0], [0, 32], [-32, 0]], yellow);
  at(7); c.fillStyle = blue; c.fillRect(-42, -42, 84, 84); poly([[0, -30], [32, 28], [-32, 28]], white); c.fillStyle = '#18161c'; c.fillRect(-4, -8, 8, 22); disc(0, '#000'); c.beginPath(); c.arc(0, -14, 5, 0, 7); c.fill();
  at(8); c.fillStyle = blue; c.fillRect(-42, -42, 84, 84); c.fillStyle = white; c.font = 'bold 54px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('i', 0, 4);
  at(9); poly([[-19, -46], [19, -46], [46, -19], [46, 19], [19, 46], [-19, 46], [-46, 19], [-46, -19]], red); c.fillStyle = white; c.font = 'bold 26px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('STOP', 0, 2);
  at(10); disc(44, red); disc(33, white); c.fillStyle = '#18161c'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('40', 0, 2);
  at(11); c.fillStyle = blue; c.fillRect(-40, -44, 80, 88); c.fillStyle = white; c.font = 'bold 62px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('P', 0, 4);
  at(12); disc(44, red); disc(33, white); c.fillStyle = '#18161c'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('30', 0, 2);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function poolTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,214,150,0.55)'); g.addColorStop(0.4, 'rgba(255,170,150,0.2)'); g.addColorStop(1, 'rgba(255,120,200,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class Batch {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.uv = []; }
  add(p, x, y, z, cs, sn, uOff = 0, uScale = 1, tint = null) {
    const { pos, nor, uv } = p, col = tint || p.col;
    for (let i = 0; i < pos.length; i += 3) {
      this.pos.push(x + pos[i] * cs + pos[i + 2] * sn, y + pos[i + 1], z - pos[i] * sn + pos[i + 2] * cs);
      this.nor.push(nor[i] * cs + nor[i + 2] * sn, nor[i + 1], -nor[i] * sn + nor[i + 2] * cs);
      this.col.push(col[0], col[1], col[2]);
    }
    if (uv) for (let i = 0; i < uv.length; i += 2) this.uv.push(uOff + uv[i] * uScale, uv[i + 1]);
  }
  mesh(mat, withUv) {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (withUv) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    const m = new THREE.Mesh(g, mat);
    m.matrixAutoUpdate = false;
    return m;
  }
}

// physical guesses per kind: mass (kg) and how far from its centre line the car touches it (m)
const MASS = { [LIGHT]: 140, [POLE]: 250, [SIGNAL]: 90, [BENCH]: 45, [BIN]: 20, [RACK]: 30, [BOX]: 70, [BOLLARD]: 12, sign: 10 };
const REACH = { [LIGHT]: 0.12, [POLE]: 0.15, [SIGNAL]: 0.12, [BENCH]: 0.75, [BIN]: 0.25, [RACK]: 0.75, [BOX]: 0.4, [BOLLARD]: 0.09, sign: 0.08 };
const KNOCK_KEY = 'streetlap.knocked';
const G = 9.81;

function loadKnocked() {
  try { return JSON.parse(sessionStorage.getItem(KNOCK_KEY)) || {}; } catch { return {}; }
}

export function createProps(world, opts = {}) {
  let data = null, cleared = new Set();
  const knocked = loadKnocked();              // id -> rest pose [x, y, z, qx, qy, qz, qw] (or 1 while flying)
  const live = new Map();                     // sector key -> { entries, meshes, group }
  const moving = new Set();                   // loose bodies still in motion
  let saveTimer = 0;
  const waiting = [];
  const solidMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const signMat = new THREE.MeshLambertMaterial({ map: signAtlas(), alphaTest: 0.5, side: THREE.DoubleSide });
  const paintMat = new THREE.MeshLambertMaterial({ color: 0xdedbe6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const red = [1, 0.16, 0.2], green = [0.2, 1, 0.55], amber = [1, 0.7, 0.2];
  const lamp = box(0.2, 0.2, 0.06, 0, 0, 0, 0xffffff);

  function build(sector) {
    const a = data.sectors[`${sector.sx}_${sector.sz}`];
    if (!a) return null;
    const solid = new Batch(), glow = new Batch(), pool = new Batch(), sign = new Batch(), paint = new Batch();
    const entries = [], rest = [];
    const mark = () => [solid.pos.length / 3, glow.pos.length / 3, pool.pos.length / 3, sign.pos.length / 3];
    const S = world.meta.sector.size;
    const hAt = (x, z) => world.topAt(Math.min(Math.max(x, sector.x0 + 0.01), sector.x0 + S - 0.01), Math.min(Math.max(z, sector.z0 + 0.01), sector.z0 + S - 0.01));
    for (let i = 0; i < a.length; i += data.stride) {
      const kind = a[i], x = a[i + 1], z = a[i + 2], yaw = a[i + 3] * Math.PI / 180, extra = a[i + 4];
      // local +z points along the compass bearing "yaw" (0 = north = -z in the world)
      const cs = -Math.cos(yaw), sn = Math.sin(yaw);
      const y = hAt(x, z);
      const id = `${sector.sx}_${sector.sz}:${i / data.stride}`;
      if (kind !== ZEBRA) {
        if (cleared.has(id)) continue;
        if (knocked[id]) { rest.push({ id, kind, x, y, z, cs, sn }); continue; }
      }
      const m0 = kind === ZEBRA ? null : mark();
      if (kind === ZEBRA) {
        const w = extra || 7, fx = Math.sin(yaw), fz = -Math.cos(yaw);       // along the road
        for (let s = -w / 2 + 0.5; s <= w / 2 - 0.5; s += 1.0) {
          const cx = x - fz * s, cz = z + fx * s;
          const q = [[-2, -0.25], [2, -0.25], [-2, 0.25], [2, 0.25]].map(([l, t]) => {
            const px = cx + fx * l - fz * t, pz = cz + fz * l + fx * t;
            return [px, hAt(px, pz) + 0.055, pz];
          });
          for (const k of [0, 2, 1, 1, 2, 3]) { paint.pos.push(...q[k]); paint.nor.push(0, 1, 0); paint.col.push(1, 1, 1); }
        }
        continue;
      }
      if (kind >= SIGN0) {
        for (const p of SOLID.sign) solid.add(p, x, y, z, cs, sn);
        sign.add(PLATE, x, y, z, cs, sn, (kind - SIGN0) / FACES, 1 / FACES);
        entries.push({ id, kind, x, y, z, cs, sn, r0: m0, r1: mark(), gone: false });
        continue;
      }
      for (const p of SOLID[kind] || []) solid.add(p, x, y, z, cs, sn);
      if (kind === LIGHT) {
        glow.add(GLOW[LIGHT], x, y, z, cs, sn);
        if (opts.pools !== false) pool.add(POOL, x, y, z, cs, sn);
      } else if (kind === SIGNAL) {
        const r = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
        const on = r < 0.45 ? 0 : r < 0.9 ? 2 : 1;
        [red, amber, green].forEach((c, k) => {
          const dim = k === on ? 1.6 : 0.12;
          const lx = 0, ly = 3.3 - k * 0.3, lz = 0.25;
          glow.add(lamp, x + lx * cs + lz * sn, y + ly, z - lx * sn + lz * cs, cs, sn, 0, 1, [c[0] * dim, c[1] * dim, c[2] * dim]);
        });
      }
      entries.push({ id, kind, x, y, z, cs, sn, r0: m0, r1: mark(), gone: false });
    }
    const group = new THREE.Group();
    const meshes = [solid.mesh(solidMat), glow.mesh(glowMat), pool.mesh(poolMat, true), sign.mesh(signMat, true), paint.mesh(paintMat)];
    meshes.forEach((m, k) => {
      if (!m) return;
      if (k === 0) m.castShadow = !!opts.shadows;
      if (k === 4) m.receiveShadow = true;
      if (k === 2) m.renderOrder = 2;
      group.add(m);
    });
    const key = `${sector.sx}_${sector.sz}`;
    const rec = { entries, meshes, group, loose: [] };
    live.set(key, rec);
    // props knocked earlier this session lie where they came to rest
    for (const e of rest) {
      const pose = knocked[e.id];
      const b = makeBody(e, rec);
      if (Array.isArray(pose)) { b.obj.position.fromArray(pose, 0); b.obj.quaternion.fromArray(pose, 3); b.asleep = true; }
      else { b.obj.visible = false; b.asleep = true; }
    }
    group.userData.dispose = () => {
      for (const m of meshes) m?.geometry.dispose();
      for (const b of rec.loose) { b.geos.forEach((g) => g.dispose()); moving.delete(b); }
      if (live.get(key) === rec) live.delete(key);
    };
    return group;
  }

  // ---- knocked props
  // a loose copy of one prop, centred on its centre of mass, in its own group inside the sector's group
  function makeBody(e, rec) {
    const solid = new Batch(), glow = new Batch(), sign = new Batch();
    const { kind, cs, sn } = e;
    if (kind >= SIGN0) {
      for (const p of SOLID.sign) solid.add(p, 0, 0, 0, cs, sn);
      sign.add(PLATE, 0, 0, 0, cs, sn, (kind - SIGN0) / FACES, 1 / FACES);
    } else {
      for (const p of SOLID[kind] || []) solid.add(p, 0, 0, 0, cs, sn);
      if (kind === LIGHT) glow.add(GLOW[LIGHT], 0, 0, 0, cs, sn);
    }
    const obj = new THREE.Group();
    const geos = [];
    const box = new THREE.Box3();
    for (const [b, mat, uv] of [[solid, solidMat, false], [glow, glowMat, false], [sign, signMat, true]]) {
      const m = b.mesh(mat, uv);
      if (!m) continue;
      m.geometry.computeBoundingBox();
      box.union(m.geometry.boundingBox);
      geos.push(m.geometry);
      m.matrixAutoUpdate = true;
      m.castShadow = k0(mat);
      obj.add(m);
    }
    const c = box.getCenter(new THREE.Vector3());
    for (const m of obj.children) m.position.sub(c);
    const corners = [];
    for (const X of [box.min.x, box.max.x]) for (const Y of [box.min.y, box.max.y]) for (const Z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(X - c.x, Y - c.y, Z - c.z));
    obj.position.set(e.x + c.x, e.y + c.y, e.z + c.z);
    rec.group.add(obj);
    const size = box.getSize(new THREE.Vector3());
    const mass = kind >= SIGN0 ? MASS.sign : MASS[kind] || 30;
    const L = Math.max(size.x, size.y, size.z);
    const body = {
      id: e.id, kind, obj, geos, corners, mass, inertia: mass * (L * L) / 10 + 0.5,
      v: new THREE.Vector3(), w: new THREE.Vector3(), asleep: false, still: 0, reach: (kind >= SIGN0 ? REACH.sign : REACH[kind] || 0.3) + Math.min(size.x, size.z) * 0.5,
    };
    rec.loose.push(body);
    return body;
  }
  const k0 = (mat) => mat === solidMat && !!opts.shadows;

  // cut a prop out of its sector's merged meshes
  function hide(rec, e) {
    e.gone = true;
    for (let k = 0; k < 4; k++) {
      const m = rec.meshes[k];
      const a = e.r0[k], b = e.r1[k];
      if (!m || b <= a) continue;
      const pos = m.geometry.attributes.position;
      for (let v = a; v < b; v++) pos.setXYZ(v, e.x, e.y - 50, e.z);
      pos.needsUpdate = true;
    }
  }

  const tmpV = new THREE.Vector3(), tmpR = new THREE.Vector3(), tmpN = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpT = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  // an impulse of size j along unit direction d at offset r from the body's centre
  function impulse(b, d, j, r) {
    b.v.addScaledVector(d, j / b.mass);
    tmpT.crossVectors(r, d);
    b.w.addScaledVector(tmpT, j / b.inertia);
  }
  // the car (world velocity cvx, cvz, mass M) hits body b; returns the impulse taken from the car
  function hit(b, cvx, cvz, M) {
    const sp = Math.hypot(cvx - b.v.x, cvz - b.v.z);
    if (sp < 0.3) return 0;
    tmpN.set((cvx - b.v.x) / sp, 0, (cvz - b.v.z) / sp);
    // the bumper meets it about half a metre above the ground
    const p = b.obj.position;
    const gy = world.heightAt(p.x, p.z);
    tmpR.set(0, Math.min(0.55 + gy - p.y, 0), 0);
    tmpT.crossVectors(tmpR, tmpN);
    const k = 1 / b.mass + tmpT.lengthSq() / b.inertia + 1 / M;
    const j = (1.25 * sp) / k;
    impulse(b, tmpN, j, tmpR);
    b.v.y += 0.12 * sp + 0.3;
    b.w.x += (Math.random() - 0.5) * 0.6; b.w.z += (Math.random() - 0.5) * 0.6;
    b.asleep = false; b.still = 0; b.age = 0;
    moving.add(b);
    return j;
  }

  function step(b, dt) {
    const o = b.obj;
    b.v.y -= G * dt;
    o.position.addScaledVector(b.v, dt);
    const wl = b.w.length();
    if (wl > 1e-6) { tmpQ.setFromAxisAngle(tmpV.copy(b.w).divideScalar(wl), wl * dt); o.quaternion.premultiply(tmpQ); }
    // ground contact at the deepest corner
    let deepest = 0, ci = -1;
    for (let i = 0; i < b.corners.length; i++) {
      tmpC.copy(b.corners[i]).applyQuaternion(o.quaternion).add(o.position);
      const pen = world.heightAt(tmpC.x, tmpC.z) - tmpC.y;
      if (pen > deepest) { deepest = pen; ci = i; }
    }
    let touching = false;
    if (ci >= 0) {
      touching = true;
      o.position.y += deepest;
      tmpR.copy(b.corners[ci]).applyQuaternion(o.quaternion);
      tmpN.set(0, 1, 0);
      tmpV.crossVectors(b.w, tmpR).add(b.v);                       // velocity of the contact point
      const vn = tmpV.y;
      if (vn < 0) {
        tmpT.crossVectors(tmpR, tmpN);
        const k = 1 / b.mass + tmpT.lengthSq() / b.inertia;
        const j = (-(1 + 0.25) * vn) / k;
        impulse(b, tmpN, j, tmpR);
        // friction against the slide
        tmpV.crossVectors(b.w, tmpR).add(b.v);
        const vt = Math.hypot(tmpV.x, tmpV.z);
        if (vt > 1e-4) {
          const t = tmpN.set(-tmpV.x / vt, 0, -tmpV.z / vt);
          tmpT.crossVectors(tmpR, t);
          const kt = 1 / b.mass + tmpT.lengthSq() / b.inertia;
          impulse(b, t, Math.min(vt / kt, 0.6 * j), tmpR);
        }
      }
      b.w.multiplyScalar(Math.exp(-dt * 1.5));
      b.v.x *= Math.exp(-dt * 0.8); b.v.z *= Math.exp(-dt * 0.8);
    }
    b.age += dt;
    if (touching && b.v.lengthSq() < 0.09 && b.w.lengthSq() < 0.16) b.still += dt; else b.still = 0;
    if (b.still > 0.5 || (touching && b.age > 8) || b.age > 30) {
      b.asleep = true; b.v.set(0, 0, 0); b.w.set(0, 0, 0);
      moving.delete(b);
      knocked[b.id] = [...o.position.toArray().map((v) => Math.round(v * 100) / 100), ...o.quaternion.toArray().map((v) => Math.round(v * 1e4) / 1e4)];
      saveTimer = 0.5;
    }
  }

  // check the car against the props around it, knock what it touches, move what is flying
  function update(car, dt) {
    if (!data) return;
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
    const speed = Math.hypot(car.vx, car.vy);
    const S = world.meta.sector.size, G0 = world.meta.sector.grid0;
    if (speed > 0.3) {
      const M = car.spec.mass;
      let cvx = car.vx * fx + car.vy * rx, cvz = car.vx * fz + car.vy * rz, took = 0;
      const sx = Math.floor((car.x - G0) / S), sz = Math.floor((car.z - G0) / S);
      const touches = (px, pz, reach) => {
        const dx = px - car.x, dz = pz - car.z;
        if (dx * dx + dz * dz > 49) return false;
        return Math.abs(dx * fx + dz * fz) < car.halfLen + reach && Math.abs(dx * rx + dz * rz) < car.halfWid + reach;
      };
      for (let ax = sx - 1; ax <= sx + 1; ax++) for (let az = sz - 1; az <= sz + 1; az++) {
        const rec = live.get(`${ax}_${az}`);
        if (!rec) continue;
        const x0 = G0 + ax * S, z0 = G0 + az * S;
        if (car.x < x0 - 8 || car.x > x0 + S + 8 || car.z < z0 - 8 || car.z > z0 + S + 8) continue;
        for (const e of rec.entries) {
          if (e.gone) continue;
          const reach = e.kind >= SIGN0 ? REACH.sign : REACH[e.kind] || 0.3;
          if (Math.abs(e.y - car.y) > 3 || !touches(e.x, e.z, reach)) continue;
          hide(rec, e);
          const b = makeBody(e, rec);
          knocked[e.id] = 1;
          const j = hit(b, cvx, cvz, M);
          took += j;
          cvx -= tmpN.x * j / M; cvz -= tmpN.z * j / M;
          saveTimer = 0.5;
        }
        for (const b of rec.loose) {
          const p = b.obj.position;
          if (!b.obj.visible || Math.abs(p.y - car.y) > 2.5 || !touches(p.x, p.z, b.reach)) continue;
          const j = hit(b, cvx, cvz, M);
          if (j) { took += j; cvx -= tmpN.x * j / M; cvz -= tmpN.z * j / M; }
        }
      }
      if (took > 0) {
        car.vx = cvx * fx + cvz * fz; car.vy = cvx * rx + cvz * rz;
        car.hit = Math.max(car.hit, Math.min(3, took / M * 6));
      }
    }
    const sub = dt > 1 / 60 ? 2 : 1;
    for (const b of [...moving]) for (let k = 0; k < sub; k++) if (!b.asleep) step(b, dt / sub);
    if (saveTimer > 0 && (saveTimer -= dt) <= 0) {
      try { sessionStorage.setItem(KNOCK_KEY, JSON.stringify(knocked)); } catch { /* private mode */ }
    }
  }

  fetch(`${import.meta.env.BASE_URL}data/props.json`).then((r) => r.json()).then((d) => {
    data = d;
    if (opts.clear) cleared = opts.clear(d);
    // hand-placed extras ([kind, x, z, bearing in degrees]) go at the end of their sector's list,
    // so the ids of the surveyed props (and what was knocked this session) stay the same
    if (opts.extra) {
      const S = world.meta.sector.size, G0 = world.meta.sector.grid0;
      for (const [kind, x, z, yaw, extra = 0] of opts.extra()) {
        const key = `${Math.floor((x - G0) / S)}_${Math.floor((z - G0) / S)}`;
        (d.sectors[key] ||= []).push(kind, x, z, yaw, extra);
      }
    }
    for (const f of waiting.splice(0)) f();
  }).catch(() => { /* no props baked: play without them */ });

  // attach(sector, add) calls add(group) once the sector's props exist (now, or when the data arrives)
  const attach = (sector, add) => {
    const run = () => { if (sector.state === 'ready') { const g = build(sector); if (g) add(g); } };
    if (data) run(); else waiting.push(run);
  };
  attach.update = update;
  attach.knockedCount = () => Object.keys(knocked).length;
  attach.moving = () => moving.size;
  // nearest standing prop (for tests)
  attach.nearest = (x, z, kindTest = () => true) => {
    let best = null, bd = Infinity;
    for (const rec of live.values()) for (const e of rec.entries) {
      if (e.gone || !kindTest(e.kind)) continue;
      const d = Math.hypot(e.x - x, e.z - z);
      if (d < bd) { bd = d; best = e; }
    }
    return best && { id: best.id, kind: best.kind, x: best.x, y: best.y, z: best.z };
  };
  attach.loose = (id) => { for (const rec of live.values()) for (const b of rec.loose) if (b.id === id) return { p: b.obj.position.toArray(), q: b.obj.quaternion.toArray(), asleep: b.asleep, v: b.v.toArray(), w: b.w.toArray(), still: b.still }; return null; };
  return attach;
}
