// Tyre marks: a ring buffer of flat quads laid on the ground behind each wheel while its axle is sliding.
// A mark fades in as the slide builds and trails off when the tyre grips again, is darker the harder the
// tread rubs, and is as wide as the tyre is across its path: a tyre's width when it spins or locks in a
// straight line, broader when it is dragged sideways. The oldest marks are overwritten by the newest.
import * as THREE from 'three';

const MAX = 3000;          // quads kept (about 750 m of marks)
const STEP = 0.25;         // metres between ribbon points
const TYRE = 0.2;          // tyre width, unless the car's spec gives its own (spec.tyreWidth: [front, rear])
const PATCH = 0.15;        // length of the contact patch: the width of a mark laid fully sideways
const LIFT = 0.035;        // above the ground, with polygon offset on top
const TILE = 1.4;          // metres of mark per repeat of the texture

// Rubber laid by a tyre: soft edges, heavier under the shoulders, faint tread lines, streaky along its length.
function markTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d'), img = g.createImageData(64, 256), d = img.data;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const rows = new Float32Array(256), cols = new Float32Array(64);
  for (let y = 0; y < 256; y++) rows[y] = rnd();
  for (let x = 0; x < 64; x++) cols[x] = rnd();
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < 256; y++) {
    // slow variation along the mark (wraps, so the tile repeats without a seam)
    const along = 0.84 + 0.1 * Math.sin(y / 256 * Math.PI * 2) + 0.06 * Math.sin(y / 256 * Math.PI * 6 + 1.3) + 0.05 * (rows[y] - 0.5);
    for (let x = 0; x < 64; x++) {
      const u = (x + 0.5) / 64;
      const edge = ss(0, 0.16, u) * ss(0, 0.16, 1 - u);
      const shoulder = 0.78 + 0.22 * Math.max(Math.exp(-(((u - 0.17) / 0.09) ** 2)), Math.exp(-(((u - 0.83) / 0.09) ** 2)));
      const groove = 1 - 0.16 * Math.max(Math.exp(-(((u - 0.37) / 0.022) ** 2)), Math.exp(-(((u - 0.5) / 0.022) ** 2)), Math.exp(-(((u - 0.63) / 0.022) ** 2)));
      const streak = 0.9 + 0.1 * cols[x];
      const a = edge * shoulder * groove * streak * along * (0.94 + 0.06 * rnd());
      const o = (y * 64 + x) * 4;
      d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = Math.round(255 * Math.min(1, a));
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

export function createSkidMarks(world) {
  const pos = new Float32Array(MAX * 4 * 3);
  const col = new Float32Array(MAX * 4 * 4);
  const uv = new Float32Array(MAX * 4 * 2);
  const idx = new Uint16Array(MAX * 6);
  for (let q = 0; q < MAX; q++) idx.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4 + 2, q * 4 + 1, q * 4 + 3], q * 6);
  const geo = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3), aCol = new THREE.BufferAttribute(col, 4), aUv = new THREE.BufferAttribute(uv, 2);
  aPos.setUsage(THREE.DynamicDrawUsage); aCol.setUsage(THREE.DynamicDrawUsage); aUv.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPos);
  geo.setAttribute('color', aCol);
  geo.setAttribute('uv', aUv);
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mat = new THREE.MeshBasicMaterial({
    map: markTexture(), vertexColors: true, transparent: true, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;

  let next = 0;
  // per wheel: the last ribbon point (centre, its two edges, strength, distance along the mark, heading)
  const wheels = [0, 1, 2, 3].map(() => ({ on: false, x: 0, z: 0, lx: 0, ly: 0, lz: 0, rx: 0, ry: 0, rz: 0, a: 0, v: 0, tx: 0, tz: 0, hw: TYRE / 2, paved: true }));

  // one quad from the wheel's last point to a new one
  function quad(w, lx, ly, lz, rx, ry, rz, a, v, paved) {
    const o = next * 12, c = next * 16, t = next * 8;
    pos[o] = w.lx; pos[o + 1] = w.ly; pos[o + 2] = w.lz;
    pos[o + 3] = w.rx; pos[o + 4] = w.ry; pos[o + 5] = w.rz;
    pos[o + 6] = lx; pos[o + 7] = ly; pos[o + 8] = lz;
    pos[o + 9] = rx; pos[o + 10] = ry; pos[o + 11] = rz;
    // black rubber on paving, a darker rut in grass and gravel
    const r = paved ? 0.03 : 0.1, g = paved ? 0.03 : 0.075, b = paved ? 0.04 : 0.05;
    for (let k = 0; k < 4; k++) {
      col[c + k * 4] = r; col[c + k * 4 + 1] = g; col[c + k * 4 + 2] = b;
      col[c + k * 4 + 3] = k < 2 ? w.a : a;
    }
    uv[t] = 0; uv[t + 1] = w.v; uv[t + 2] = 1; uv[t + 3] = w.v; uv[t + 4] = 0; uv[t + 5] = v; uv[t + 6] = 1; uv[t + 7] = v;
    next = (next + 1) % MAX;
    aPos.needsUpdate = true; aCol.needsUpdate = true; aUv.needsUpdate = true;
  }

  // the tyre grips again: the mark thins out over a short tail instead of stopping dead
  function close(w) {
    if (w.on && w.a > 0.01 && (w.tx || w.tz)) {
      const L = STEP * 2.2, x = w.x + w.tx * L, z = w.z + w.tz * L, hw = w.hw * 0.8;
      const y = world.groundAt(x, z, w.ly + 0.4) + LIFT;
      quad(w, x + w.tz * hw, y, z - w.tx * hw, x - w.tz * hw, y, z + w.tx * hw, 0, w.v + L / TILE, w.paved);
    }
    w.on = false;
  }

  function update(car) {
    const live = !car.inWater;
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw);
    const sx = Math.cos(car.yaw), sz = Math.sin(car.yaw);
    const ht = car.spec.track / 2;
    for (let i = 0; i < 4; i++) {
      const w = wheels[i];
      const front = i < 2;
      const k = live ? (front ? car.skidF : car.skidR) || 0 : 0;
      if (k < 0.08) { close(w); continue; }
      const along = front ? car.a : -car.b, side = i % 2 ? ht : -ht;
      const x = car.x + fx * along + sx * side, z = car.z + fz * along + sz * side;
      const dx = x - w.x, dz = z - w.z, d = Math.hypot(dx, dz);
      if (w.on && d > 3) w.on = false;              // the car was moved: not one mark
      if (w.on && d < STEP) continue;
      const surf = world.surfaceAt(x, z);
      if (surf === 4) { w.on = false; continue; }
      const paved = surf === 1;
      const y = world.groundAt(x, z, car.y + 0.4) + LIFT;
      const tyre = car.spec.tyreWidth ? car.spec.tyreWidth[front ? 0 : 1] : TYRE;
      if (!w.on) {
        // a new mark starts from nothing and builds over the next points
        const hw = tyre / 2;
        Object.assign(w, { on: true, x, z, a: 0, v: Math.random(), tx: 0, tz: 0, hw, paved,
          lx: x - sx * hw, ly: y, lz: z - sz * hw, rx: x + sx * hw, ry: y, rz: z + sz * hw });
        continue;
      }
      // strength: how far over the limit the tyre is, and how fast the tread is rubbing
      const rub = (front ? car.rubF : car.rubR) ?? 6;
      const k1 = Math.min(1, (k - 0.08) / 0.55);
      const want = (paved ? 0.74 : 0.3) * k1 * k1 * (3 - 2 * k1) * (0.5 + 0.5 * Math.min(1, rub / 7));
      const a = w.a + (want - w.a) * (want > w.a ? 0.3 : 0.45);
      // width: the tyre seen across its path
      const tx = dx / d, tz = dz / d;
      const yawW = car.yaw + (front ? car.steer || 0 : 0);
      const cb = Math.abs(tx * Math.sin(yawW) - tz * Math.cos(yawW)), sb = Math.sqrt(Math.max(0, 1 - cb * cb));
      const hw = (w.hw + (Math.max(0.1, tyre * cb + PATCH * sb) / 2 - w.hw) * 0.5);
      const px = -tz, pz = tx;
      const lx = x - px * hw, lz = z - pz * hw, rx = x + px * hw, rz = z + pz * hw;
      const v = w.v + d / TILE;
      if (!w.tx && !w.tz) {
        // the first point was laid across the car: turn it across the path now that there is one
        const h0 = w.hw; w.lx = w.x - px * h0; w.lz = w.z - pz * h0; w.rx = w.x + px * h0; w.rz = w.z + pz * h0;
      }
      quad(w, lx, y, lz, rx, y, rz, a, v, paved);
      w.x = x; w.z = z; w.a = a; w.v = v; w.tx = tx; w.tz = tz; w.hw = hw; w.paved = paved;
      w.lx = lx; w.ly = y; w.lz = lz; w.rx = rx; w.ry = y; w.rz = rz;
    }
  }

  return { mesh, update, get count() { return next; } };
}
