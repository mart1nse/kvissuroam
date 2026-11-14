// Street furniture at the places where Mapillary detected it in street photos (CC BY-SA):
// street lights, poles, traffic lights and signs, benches, bins, bike racks, cabinets and zebra crossings.
// Everything in a sector is merged into a handful of meshes. Props are scenery only: the car drives through them.
import * as THREE from 'three';

const LIGHT = 0, POLE = 1, SIGNAL = 2, BENCH = 3, BIN = 4, RACK = 5, BOX = 6, ZEBRA = 7, SIGN0 = 10;
const FACES = 10;

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
  sign: [cyl(0.035, 2.9, 0, 1.45, 0, 0x8a8a94, 5)],
};
const GLOW = {
  [LIGHT]: box(0.24, 0.05, 0.6, 0, 8.0, 1.75, 0xffe2a8),
};
const POOL = part(new THREE.PlaneGeometry(13, 13).rotateX(-Math.PI / 2).translate(0, 0.07, 1.75), 0xffffff);
const PLATE = part(new THREE.PlaneGeometry(0.72, 0.72).translate(0, 2.5, 0.05), 0xffffff);

// sign faces in one strip: speed, prohibit, no entry, mandatory, warning, yield, priority, crossing, info, stop
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

export function createProps(world, opts = {}) {
  let data = null;
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
    const S = world.meta.sector.size;
    const hAt = (x, z) => world.topAt(Math.min(Math.max(x, sector.x0 + 0.01), sector.x0 + S - 0.01), Math.min(Math.max(z, sector.z0 + 0.01), sector.z0 + S - 0.01));
    for (let i = 0; i < a.length; i += data.stride) {
      const kind = a[i], x = a[i + 1], z = a[i + 2], yaw = a[i + 3] * Math.PI / 180, extra = a[i + 4];
      // local +z points along the compass bearing "yaw" (0 = north = -z in the world)
      const cs = -Math.cos(yaw), sn = Math.sin(yaw);
      const y = hAt(x, z);
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
    group.userData.dispose = () => { for (const m of meshes) m?.geometry.dispose(); };
    return group.children.length ? group : null;
  }

  fetch(`${import.meta.env.BASE_URL}data/props.json`).then((r) => r.json()).then((d) => {
    data = d;
    for (const f of waiting.splice(0)) f();
  }).catch(() => { /* no props baked: play without them */ });

  // attach(sector, add) calls add(group) once the sector's props exist (now, or when the data arrives)
  return (sector, add) => {
    const run = () => { if (sector.state === 'ready') { const g = build(sector); if (g) add(g); } };
    if (data) run(); else waiting.push(run);
  };
}
