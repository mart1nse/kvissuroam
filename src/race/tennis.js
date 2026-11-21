// The Tartu Academic Tennis Club on K. E. von Baeri tänav, on the right going up the lap towards Jakobi
// (Martin, 18 Nov, street view Aug 2024 and the Land Board orthophoto): red clay courts behind a dark
// green mesh fence with green windscreens and a gate, in pastel colours. Two courts side by side in the
// north block, one lying east-west in the south block, and the small green pickleball court beside it.
// The Toome Kohvik building south of them and the Toomkirik ruins behind are in the building model.
import * as THREE from 'three';
import { Parts, BOX } from './landmarks.js';

// blocks of clay measured on the orthophoto (game x, z)
const UP = { x0: 875.0, x1: 918.5, z0: 2831.8, z1: 2865.2 };
const LO = { x0: 874.0, x1: 905.8, z0: 2866.8, z1: 2882.0 };
const MINI = { x0: 908.6, x1: 917.6, z0: 2866.8, z1: 2881.5 };
const FENCE = { x0: 873.6, x1: 918.9, z0: 2831.4, z1: 2882.4, mid: 2866.0, midX: 907.2, h: 3.6, screen: 2.5 };
const GATE = { x0: 876.0, x1: 880.2 };                  // double gate in the south fence, by the café
const COL = {
  clay: 0xe7a08a, line: 0xfcf5f0, post: 0x2f5246, screen: 0x5f9a82, net: 0x2c3838, tape: 0xf6f6f6,
  pickle: 0x9fd0b0, pickleIn: 0xdc9a92, pole: 0x8d93a0, lamp: 0xf2f0e6,
};

function meshTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = '#2f5246';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64);
  g.moveTo(-32, 0); g.lineTo(32, 64); g.moveTo(32, 0); g.lineTo(96, 64);
  g.moveTo(32, 0); g.lineTo(-32, 64); g.moveTo(96, 0); g.lineTo(32, 64);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createTennis(world, group) {
  for (const b of [UP, LO, MINI]) world.addClearing({ x0: b.x0 - 0.5, z0: b.z0 - 0.5, x1: b.x1 + 0.5, z1: b.z1 + 0.5 });
  let built = false;

  const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const lineMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const solidMat = new THREE.MeshLambertMaterial({ vertexColors: true });

  // flat coloured shapes on the ground, as lists of [positions, colours]
  const ground = [], lines = [];
  const y = (x, z) => world.heightAt(x, z);
  function quad(list, a, b, c, d, colour, lift) {
    const k = new THREE.Color(colour), P = (p) => [p[0], y(p[0], p[1]) + lift, p[1]];
    // wound so the face points up
    list.push([[...P(a), ...P(c), ...P(b), ...P(b), ...P(c), ...P(d)], Array(6).fill([k.r, k.g, k.b]).flat()]);
  }
  // a rectangle as a grid so it follows the ground
  function rect(list, r, colour, lift, step = 2) {
    const nx = Math.max(1, Math.round((r.x1 - r.x0) / step)), nz = Math.max(1, Math.round((r.z1 - r.z0) / step));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const xa = r.x0 + (r.x1 - r.x0) * i / nx, xb = r.x0 + (r.x1 - r.x0) * (i + 1) / nx;
      const za = r.z0 + (r.z1 - r.z0) * j / nz, zb = r.z0 + (r.z1 - r.z0) * (j + 1) / nz;
      quad(list, [xa, za], [xb, za], [xa, zb], [xb, zb], colour, lift);
    }
  }
  // a painted line from p to q, `w` wide, cut in 2 m pieces so it follows the ground
  function paint(p, q, w, colour) {
    const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(l / 2));
    const ox = -dz / l * w / 2, oz = dx / l * w / 2;
    for (let k = 0; k < n; k++) {
      const a = [p[0] + dx * k / n, p[1] + dz * k / n], b = [p[0] + dx * (k + 1) / n, p[1] + dz * (k + 1) / n];
      quad(lines, [a[0] - ox, a[1] - oz], [b[0] - ox, b[1] - oz], [a[0] + ox, a[1] + oz], [b[0] + ox, b[1] + oz], colour, 0.05);
    }
  }
  function meshOf(list, mat) {
    let n = 0;
    for (const [p] of list) n += p.length;
    if (!n) return null;
    const pos = new Float32Array(n), col = new Float32Array(n), nor = new Float32Array(n);
    let o = 0;
    for (const [p, c] of list) { pos.set(p, o); col.set(c, o); o += p.length; }
    for (let k = 1; k < n; k += 3) nor[k] = 1;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    return m;
  }

  // court markings round a centre, long axis along (ax, az): length L, doubles width W, singles width S
  function court(cx, cz, ax, az, L, W, S, service, p) {
    const bx = -az, bz = ax;
    const at = (u, v) => [cx + ax * u + bx * v, cz + az * u + bz * v];
    const lw = 0.06;
    for (const u of [-L / 2, L / 2]) paint(at(u, -W / 2), at(u, W / 2), lw, COL.line);
    for (const v of [-W / 2, W / 2]) paint(at(-L / 2, v), at(L / 2, v), lw, COL.line);
    if (S) for (const v of [-S / 2, S / 2]) paint(at(-L / 2, v), at(L / 2, v), lw, COL.line);
    if (service) {
      for (const u of [-service, service]) paint(at(u, -(S || W) / 2), at(u, (S || W) / 2), lw, COL.line);
      paint(at(-service, 0), at(service, 0), lw, COL.line);
      for (const u of [-L / 2, L / 2]) paint(at(u, 0), at(u - Math.sign(u) * 0.15, 0), 0.06, COL.line);
    }
    // the net across the middle: posts, a dark net and its white tape
    const half = W / 2 + 0.9, yaw = Math.atan2(-bz, bx);
    const [nx, nz] = at(0, 0), ny = y(nx, nz);
    p.box(half * 2, 0.9, 0.03, COL.net, nx, ny + 0.5, nz, yaw);
    p.box(half * 2, 0.07, 0.05, COL.tape, nx, ny + 0.96, nz, yaw);
    for (const s of [-1, 1]) {
      const [px, pz] = at(0, s * half);
      p.add(new THREE.CylinderGeometry(0.04, 0.04, 1.07, 8), COL.post, px, y(px, pz) + 0.535, pz);
    }
  }

  function build() {
    built = true;
    const p = new Parts(), solids = [];

    // ---- clay and the pickleball court
    rect(ground, UP, COL.clay, 0.03);
    rect(ground, LO, COL.clay, 0.03);
    rect(ground, MINI, COL.pickle, 0.03);
    const mcx = (MINI.x0 + MINI.x1) / 2, mcz = (MINI.z0 + MINI.z1) / 2;
    rect(lines, { x0: mcx - 3.05, x1: mcx + 3.05, z0: mcz - 6.7, z1: mcz + 6.7 }, COL.pickleIn, 0.045, 1.6);
    // two courts in the north block (long axis north-south), one in the south block (east-west)
    const upc = (UP.z0 + UP.z1) / 2, upw = (UP.x1 - UP.x0) / 2;
    court(UP.x0 + upw / 2, upc, 0, 1, 23.77, 10.97, 8.23, 6.4, p);
    court(UP.x0 + upw * 1.5, upc, 0, 1, 23.77, 10.97, 8.23, 6.4, p);
    court((LO.x0 + LO.x1) / 2, (LO.z0 + LO.z1) / 2, 1, 0, 23.77, 10.97, 8.23, 6.4, p);
    court(mcx, mcz, 0, 1, 13.41, 6.1, 0, 0, p);
    paint([mcx - 3.05, mcz - 2.13], [mcx + 3.05, mcz - 2.13], 0.05, COL.line);       // kitchen lines
    paint([mcx - 3.05, mcz + 2.13], [mcx + 3.05, mcz + 2.13], 0.05, COL.line);
    paint([mcx, mcz - 6.7], [mcx, mcz - 2.13], 0.05, COL.line);
    paint([mcx, mcz + 2.13], [mcx, mcz + 6.7], 0.05, COL.line);
    for (const [list, mat] of [[ground, groundMat], [lines, lineMat]]) { const m = meshOf(list, mat); if (m) group.add(m); }

    // ---- the fence: posts every 3 m, a green windscreen low down and mesh above it
    const F = FENCE;
    const runs = [
      [[F.x0, F.z0], [F.x0, F.z1]],                     // along the road
      [[F.x0, F.z1], [GATE.x0, F.z1]], [[GATE.x1, F.z1], [F.x1, F.z1]],   // south, either side of the gate
      [[F.x1, F.z1], [F.x1, F.z0]], [[F.x1, F.z0], [F.x0, F.z0]],
      [[F.x0, F.mid], [F.x1, F.mid]], [[F.midX, F.mid], [F.midX, F.z1]],  // between the blocks
    ];
    const meshList = [], screenList = [], gateList = [];
    for (const [a, b] of runs) {
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), yaw = Math.atan2(-dz, dx);
      const n = Math.max(1, Math.round(l / 3));
      for (let k = 0; k <= n; k++) {
        const x = a[0] + dx * k / n, z = a[1] + dz * k / n;
        p.box(0.07, F.h, 0.07, COL.post, x, y(x, z) + F.h / 2, z);
      }
      for (let k = 0; k < n; k++) {
        const x = a[0] + dx * (k + 0.5) / n, z = a[1] + dz * (k + 0.5) / n, yy = y(x, z);
        p.box(l / n, 0.05, 0.05, COL.post, x, yy + F.h, z, yaw);                   // top rail
        meshList.push([x, yy, z, l / n, yaw]);
        screenList.push([x, yy, z, l / n, yaw]);
      }
      if (a[1] !== F.mid && !(a[0] === F.midX)) {
        solids.push({ x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, yaw, hx: l / 2, hz: 0.1 });
      }
    }
    // the double gate: a frame of tubes with mesh in it, closed
    {
      const gz = F.z1, w = GATE.x1 - GATE.x0, gy = y(GATE.x0 + w / 2, gz);
      for (const x of [GATE.x0, GATE.x1]) p.box(0.1, F.h - 0.6, 0.1, COL.post, x, y(x, gz) + (F.h - 0.6) / 2, gz);
      for (const s of [0, 1]) {
        const x0 = GATE.x0 + s * w / 2 + 0.06, x1 = x0 + w / 2 - 0.12, cx = (x0 + x1) / 2;
        for (const h of [0.08, 1.4, 2.7]) p.box(x1 - x0, 0.05, 0.05, COL.post, cx, gy + h, gz);
        for (const x of [x0, x1]) p.box(0.05, 2.65, 0.05, COL.post, x, gy + 1.38, gz);
        gateList.push([cx, gy, gz, x1 - x0, 0]);
      }
      solids.push({ x: GATE.x0 + w / 2, z: gz, yaw: 0, hx: w / 2, hz: 0.1 });
    }
    // floodlight poles at the corners of the north block
    for (const [x, z] of [[F.x0 + 0.4, F.z0 + 0.4], [F.x1 - 0.4, F.z0 + 0.4], [F.x0 + 0.4, F.mid - 0.4], [F.x1 - 0.4, F.mid - 0.4]]) {
      const yy = y(x, z);
      p.add(new THREE.CylinderGeometry(0.07, 0.1, 8, 8), COL.pole, x, yy + 4, z);
      p.box(0.7, 0.18, 0.4, COL.lamp, x, yy + 8.05, z);
    }

    const m = p.mesh(solidMat);
    if (m) { m.castShadow = m.receiveShadow = true; group.add(m); }

    // mesh panels (see-through) and windscreens (opaque, below the mesh), as merged planes
    const tex = meshTex();
    const panels = (list, from, height, mat, uvScale) => {
      const geos = [];
      for (const [x, yy, z, l, yaw] of list) {
        const h = height, g = new THREE.PlaneGeometry(l, h);
        if (uvScale) {
          const uv = g.attributes.uv;
          for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * l * uvScale, uv.getY(k) * h * uvScale);
        }
        g.rotateY(yaw).translate(x, yy + from + h / 2, z);
        geos.push(g);
      }
      if (!geos.length) return;
      const pos = [], uv = [], nor = [];
      for (const g of geos) {
        const ng = g.toNonIndexed();
        pos.push(...ng.attributes.position.array); uv.push(...ng.attributes.uv.array); nor.push(...ng.attributes.normal.array);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      group.add(mesh);
    };
    panels(gateList, 0.05, 2.7, new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }), 3);
    panels(meshList, F.screen + 0.1, F.h - F.screen - 0.1, new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }), 3);
    panels(screenList, 0.1, F.screen, new THREE.MeshLambertMaterial({ color: COL.screen, side: THREE.DoubleSide }), 0);
    world.addSolids(solids);
  }

  const ref = [(FENCE.x0 + FENCE.x1) / 2, (FENCE.z0 + FENCE.z1) / 2];
  return {
    update(x, z) {
      if (built || Math.hypot(ref[0] - x, ref[1] - z) > 700) return;
      const pts = [[FENCE.x0, FENCE.z0], [FENCE.x1, FENCE.z0], [FENCE.x0, FENCE.z1], [FENCE.x1, FENCE.z1]];
      if (pts.every(([px, pz]) => world.ready(px, pz))) build();
    },
  };
}
