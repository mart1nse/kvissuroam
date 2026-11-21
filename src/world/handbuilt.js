// Shared pieces for areas dressed from air photos (Kõrveküla, 20 Nov, and later ones): a frame for placing
// things along any line, paving laid as ground layers, thuja hedges, picket and mesh fences with gates,
// guard rails, bollards, raised islands, garden things (trampolines, greenhouses, gazebos, sheds, swings).
// The houses themselves are the map's own blocks with painted walls (skinHouses in houseskin.js).
import * as THREE from 'three';
import { BOX } from '../race/landmarks.js';
import { groundTextures, groundLayer, fenceMesh } from './arhitekti.js';
import { streetKit } from './streetkit.js';
import { createAtlas, painter } from './houseskin.js';
import { paintScale } from './paintscale.js';

// A frame on the map: s metres along U from O, v metres across it (V is U turned a quarter to the left on the
// map, so U = east gives V = south). YAW turns a BOX(s-size, h, v-size) to lie along the frame.
export function frame(O, U) {
  const l = Math.hypot(U[0], U[1]), u = [U[0] / l, U[1] / l], V = [-u[1], u[0]];
  const at = (s, v) => [O[0] + u[0] * s + V[0] * v, O[1] + u[1] * s + V[1] * v];
  const sv = (x, z) => [(x - O[0]) * u[0] + (z - O[1]) * u[1], (x - O[0]) * V[0] + (z - O[1]) * V[1]];
  return { O, U: u, V, at, sv, YAW: Math.atan2(V[0], V[1]) };
}

// The kit for one area's build. Everything is collected and merged in finish().
export function areaKit(world, group, { shadows = true, fenceColour = 0x6b6d72 } = {}) {
  const K = streetKit(world, group, { shadows, fenceColour });
  const { p } = K;
  const h = (x, z) => world.heightAt(x, z);
  const T = groundTextures();
  const lay = groundLayer(world, group);

  // ground: a rectangle s0..s1, v0..v1 of a frame in one of the ground textures (gravel, sand, soil, tarmac,
  // slabs, pavers) or a streetKit kind (lawn, paver, red, dark, concrete, asphalt)
  const SK = ['lawn', 'paver', 'red', 'dark', 'concrete', 'white', 'asphalt', 'kerb', 'verge', 'turf'];
  function pave(F, s0, s1, v0, v1, kind = 'pavers', lift = 0.08) {
    if (SK.includes(kind)) K.ribbon(F, s0, s1, v0, v1, kind, kind !== 'lawn');
    else lay(typeof kind === 'object' ? kind : T[kind], F, s0, s1, v0, v1, lift);
  }
  // a box in a frame: centre (s, v), size ls along s, lv across, from y0 to y1 above the ground there
  function box(F, s, v, ls, lv, y0, y1, c, gy = null) {
    const [x, z] = F.at(s, v), g = gy ?? h(x, z);
    p.box(ls, y1 - y0, lv, c, x, g + (y0 + y1) / 2, z, F.YAW);
  }
  // a box between two map points (a wall, a rail, a kerb): thickness t, from y0 to y1 above the ground
  function bar(a, b, t, y0, y1, c, gy = null) {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
    const x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2, g = gy ?? (h(a[0], a[1]) + h(b[0], b[1])) / 2;
    p.box(len, y1 - y0, t, c, x, g + (y0 + y1) / 2, z, Math.atan2(-dz, dx));
  }
  // points every `step` metres along a polyline, with the direction there
  function walk(pts, step, fn) {
    let carry = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
      for (let d = carry; d <= len; d += step) fn([a[0] + ux * d, a[1] + uz * d], [ux, uz]);
      carry = step - ((len - carry) % step);
      if (carry >= step) carry = 0;
    }
  }
  // a clipped thuja hedge along a polyline, `height` high and `width` thick; tall ones in two tiers
  function hedge(pts, height = 1.6, width = 0.9, tint = [0.5, 0.74, 0.56]) {
    if (!K.leafy.ok) { for (let i = 0; i < pts.length - 1; i++) bar(pts[i], pts[i + 1], width, 0, height, 0x3f7d55); return; }
    const w = Math.max(width * 1.25, 0.9);
    walk(pts, w * 0.42, ([x, z], [ux, uz]) => {
      const yaw = Math.atan2(-uz, ux), y = h(x, z) - 0.05, tw = tint.map((t, k) => t * (0.94 + ((x * 7 + z * 3 + k) % 1) * 0.1));
      if (height <= 1.8) K.leafy.bush(x, y, z, w, height, yaw, tw, width);
      else { K.leafy.bush(x, y, z, w, 1.7, yaw, tw, width); K.leafy.bush(x, y + height * 0.45, z, w * 0.92, height * 0.55, yaw + 1.3, tw, width * 0.9); }
    });
  }
  // bushes in a row or a clump: [[x, z, width, height, tint?]]
  function bushes(list) {
    for (const [x, z, w, hh, tint] of list) {
      if (K.leafy.ok) K.leafy.bush(x, h(x, z) - 0.05, z, w, hh, x * 3 + z, tint || [0.78, 0.92, 0.74]);
      else p.add(new THREE.IcosahedronGeometry(w / 2, 1).scale(1, hh / w, 1), 0x5fa565, x, h(x, z) + hh / 2, z);
    }
  }
  // a picket or board fence along a polyline (rgb [r, g, b]), with posts
  function picket(pts, height = 1.2, rgb = [96, 84, 72], opts = {}) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const y0 = Math.min(h(a[0], a[1]), h(b[0], b[1])) - 0.02;
      fenceMesh(group, a, b, y0, () => height, rgb, 7 + i, opts, shadows);
      for (const q of [a, b]) p.box(0.09, height + 0.08, 0.09, 0x4b4a4c, q[0], h(q[0], q[1]) + (height + 0.08) / 2 - 0.02, q[1]);
    }
  }
  // a welded mesh fence along a polyline, posts every 2.5 m
  function mesh(pts, height = 1.2, post = 0x5d6066) {
    for (let i = 0; i < pts.length - 1; i++) {
      const len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      K.fence({ at: (t) => lerp(pts[i], pts[i + 1], t / len) }, 0, len, 0, height, post);
    }
  }
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  // a metal gate leaf of vertical bars from a to b, `height` high (sliding gates, garden gates)
  function gate(a, b, height = 1.3, c = 0x3d3f45) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), g = Math.min(h(a[0], a[1]), h(b[0], b[1]));
    bar(a, b, 0.05, 0.1, 0.16, c, g); bar(a, b, 0.05, height - 0.06, height, c, g);
    for (let k = 0; k <= Math.round(len / 0.13); k++) { const q = lerp(a, b, k / Math.round(len / 0.13)); p.box(0.025, height - 0.1, 0.025, c, q[0], g + 0.05 + (height - 0.1) / 2, q[1]); }
    for (const q of [a, b]) p.box(0.1, height + 0.15, 0.1, c, q[0], g + (height + 0.15) / 2, q[1]);
  }
  // a W-beam steel guard rail along a polyline: posts every 2 m, the beam at 0.45 to 0.75 m
  function guardrail(pts) {
    walk(pts, 2, ([x, z]) => p.box(0.12, 0.8, 0.1, 0x8d9096, x, h(x, z) + 0.4, z));
    for (let i = 0; i < pts.length - 1; i++) {
      bar(pts[i], pts[i + 1], 0.06, 0.45, 0.6, 0xc4c8ce);
      bar(pts[i], pts[i + 1], 0.07, 0.6, 0.75, 0xb4b8be);
    }
  }
  function bollard(x, z, c = 0x26272b, hh = 0.75) {
    p.add(new THREE.CylinderGeometry(0.1, 0.11, hh, 10), c, x, h(x, z) + hh / 2, z);
    p.add(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10), 0xe9e8e2, x, h(x, z) + hh - 0.12, z);
  }
  // a raised island along a centre line: kerb stones round it, paving (kind) on top
  function island(pts, halfWidth, kind = 'red', kerbH = 0.14) {
    for (let i = 0; i < pts.length - 1; i++) {
      const F = frame(pts[i], [pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]]), len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      box(F, len / 2, 0, len, halfWidth * 2, -0.2, kerbH, 0xc9c6cc);
      box(F, len / 2, 0, len + 0.1, halfWidth * 2 - 0.3, kerbH, kerbH + 0.02, kind === 'red' ? 0x9e6a5f : 0xb7b5bb);
    }
    const [a, b] = [pts[0], pts[pts.length - 1]];
    for (const q of [a, b]) p.add(new THREE.CylinderGeometry(halfWidth, halfWidth, kerbH + 0.2, 14), 0xc9c6cc, q[0], h(q[0], q[1]) + kerbH / 2 - 0.1, q[1]);
  }
  // a round trampoline with its net
  function trampoline(x, z, r = 1.8) {
    const y = h(x, z);
    p.add(new THREE.CylinderGeometry(r, r, 0.05, 24), 0x1c1d21, x, y + 0.85, z);
    p.add(new THREE.TorusGeometry(r, 0.07, 6, 24).rotateX(Math.PI / 2), 0x2f6f4a, x, y + 0.88, z);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; p.box(0.05, 2.6, 0.05, 0x2a2b2f, x + Math.cos(a) * r, y + 1.3, z + Math.sin(a) * r); }
    p.add(new THREE.TorusGeometry(r, 0.03, 4, 24).rotateX(Math.PI / 2), 0x2a2b2f, x, y + 2.55, z);
  }
  // a small greenhouse (glazed box with a ridge) in a frame
  function greenhouse(F, s, v, ls, lv, hh = 2.2) {
    const [x, z] = F.at(s, v), y = h(x, z);
    box(F, s, v, ls, lv, 0, hh - 0.5, 0xd5e2e4, y);
    const roof = new THREE.CylinderGeometry(lv / 2, lv / 2, ls, 3, 1).rotateZ(Math.PI / 2).rotateX(Math.PI / 2).scale(1, 0.5, 1);
    p.add(roof, 0xe1ecee, x, y + hh - 0.5 + lv * 0.12, z, F.YAW + Math.PI / 2);
    for (const k of [-0.5, 0, 0.5]) box(F, s + k * ls, v, 0.06, lv + 0.02, 0, hh - 0.45, 0xf2f2f0, y);
  }
  // a garden pavilion: eight sided, open, with a pointed roof
  function gazebo(x, z, r = 1.6, c = 0xece9e2, roof = 0x6b4b3e) {
    const y = h(x, z);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; p.box(0.12, 2.2, 0.12, c, x + Math.cos(a) * r, y + 1.1, z + Math.sin(a) * r); }
    p.add(new THREE.CylinderGeometry(r, r, 0.5, 8, 1, true), c, x, y + 0.25, z);
    p.add(new THREE.ConeGeometry(r * 1.2, 1.3, 8), roof, x, y + 2.85, z);
  }
  // an A-frame swing
  function swing(F, s, v, len = 2.6) {
    const [x, z] = F.at(s, v), y = h(x, z);
    for (const e of [-len / 2, len / 2]) for (const d of [-0.55, 0.55]) box(F, s + e, v + d * 0.5, 0.09, 0.09, 0, 2.2, 0x8a6b4e, y);
    box(F, s, v, len + 0.3, 0.12, 2.15, 2.27, 0x8a6b4e, y);
    for (const e of [-0.4, 0.4]) { box(F, s + e, v, 0.02, 0.02, 0.45, 2.15, 0x555555, y); box(F, s + e, v, 0.45, 0.2, 0.42, 0.47, 0x2d5b8a, y); }
  }
  // a shed or garage with a gable roof along s (walls c, roof r)
  function shed(F, s, v, ls, lv, wallH, ridge, c, r) {
    const [x, z] = F.at(s, v), y = h(x, z);
    box(F, s, v, ls, lv, -0.3, wallH, c, y);
    const g = new THREE.CylinderGeometry(lv / 2 + 0.2, lv / 2 + 0.2, ls + 0.4, 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).scale(1, (ridge - wallH) / ((lv / 2 + 0.2) * 0.5), 1);
    p.add(g, r, x, y + wallH + (ridge - wallH) * 0.33, z, F.YAW);
  }
  // a lamp post of the plain kind: mast and a flat head reaching over `reach` towards (dx, dz)
  function lamp(x, z, dir, hh = 8, reach = 1.2) {
    const y = h(x, z);
    p.add(new THREE.CylinderGeometry(0.06, 0.1, hh, 8), 0x8d9096, x, y + hh / 2, z);
    p.box(reach, 0.08, 0.08, 0x8d9096, x + dir[0] * reach / 2, y + hh, z + dir[1] * reach / 2, Math.atan2(-dir[1], dir[0]));
    p.box(0.6, 0.12, 0.28, 0x6d7076, x + dir[0] * reach, y + hh - 0.04, z + dir[1] * reach, Math.atan2(-dir[1], dir[0]));
  }

  function finish() { lay.finish(); K.finish(); }
  return { K, p, h, pave, box, bar, walk, hedge, bushes, picket, mesh, gate, guardrail, bollard, island, trampoline, greenhouse, gazebo, swing, shed, lamp, finish };
}

// Painted walls built from cells: a cell is one picture (a bay of a facade: its stretch of plinth, render and
// windows, say) painted once on a small shared atlas and shown on as many wall pieces as use it. A long
// facade of equal bays costs one bay's pixels, so the bays can be painted finely and still stay small.
//   cell(key, w, y0, y1, base, draw, ppm): paint the cell once (w metres wide, y0..y1 metres up); draw(P, w)
//   put(a, b, gy, key, outline): a wall piece from map point a to b (outside on the right going a -> b), the
//     cell's y0..y1 above gy, the cell stretched along it; outline [[s, y]] (s in the cell's metres) cuts it
//     to any shape (gables)
export function cellKit(group, { shadows = true, size = 1024 } = {}) {
  const atlas = createAtlas(size), cells = new Map(), pieces = [];
  function cell(key, w, y0, y1, base, draw, ppm = 30) {
    if (cells.has(key)) return cells.get(key);
    const q = Math.min(ppm * paintScale(), (size / 2 - 8) / w, (size / 2 - 8) / (y1 - y0));
    const pw = Math.max(4, Math.round(w * q)), ph = Math.max(4, Math.round((y1 - y0) * q));
    const rect = atlas.take(pw, ph), c = atlas.pages[rect.k].c;
    c.save();
    c.beginPath(); c.rect(rect.x - 2, rect.y - 2, pw + 4, ph + 4); c.clip();
    c.fillStyle = base; c.fillRect(rect.x - 2, rect.y - 2, pw + 4, ph + 4);
    draw(painter(c, rect.x, rect.y, w, y0, y1, pw / w), w);
    c.restore();
    const out = { rect, pw, ph, w, y0, y1 };
    cells.set(key, out);
    return out;
  }
  function put(a, b, gy, key, outline = null) {
    const C = cells.get(key);
    if (!C) throw new Error('no cell ' + key);
    pieces.push({ a, b, gy, C, outline: outline || [[0, C.y0], [C.w, C.y0], [C.w, C.y1], [0, C.y1]] });
  }
  function finish() {
    const S = atlas.size;
    atlas.pages.forEach((pg, pk) => {
      const pos = [], nor = [], uv = [];
      for (const j of pieces) {
        const C = j.C;
        if (C.rect.k !== pk) continue;
        const len = Math.hypot(j.b[0] - j.a[0], j.b[1] - j.a[1]), ux = (j.b[0] - j.a[0]) / len, uz = (j.b[1] - j.a[1]) / len, nx = -uz, nz = ux;
        const P = ([s, y]) => [j.a[0] + ux * s * len / C.w + nx * 0.02, j.gy + y, j.a[1] + uz * s * len / C.w + nz * 0.02];
        const T = ([s, y]) => [(C.rect.x + s / C.w * C.pw) / S, 1 - (C.rect.y + (C.y1 - y) / (C.y1 - C.y0) * C.ph) / S];
        const tris = THREE.ShapeUtils.triangulateShape(j.outline.map(([x, y]) => new THREE.Vector2(x, y)), []);
        for (let [i0, i1, i2] of tris) {
          const p0 = j.outline[i0], p1 = j.outline[i1], p2 = j.outline[i2];
          if ((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]) < 0) [i1, i2] = [i2, i1];
          for (const i of [i0, i1, i2]) { pos.push(...P(j.outline[i])); nor.push(nx, 0, nz); uv.push(...T(j.outline[i])); }
        }
      }
      if (!pos.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const tex = new THREE.CanvasTexture(pg.cv);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex }));
      m.receiveShadow = shadows;
      group.add(m);
    });
  }
  return { cell, put, finish, atlas };
}
