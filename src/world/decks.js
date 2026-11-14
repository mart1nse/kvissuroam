// Bridge spans and tunnel lids: the "decks" that lie above the height field (see tools/bake/terrain.py).
// The top is drawn with the ground material of the tile it is in, because the aerial photo shows the
// topmost surface. The slab under it, the portal beams and the railings are plain concrete.
import * as THREE from 'three';

const LIFT = 0.03, SLAB = 0.7, RAIL = 1.05;
const concrete = new THREE.MeshLambertMaterial({ color: 0x6f6a78, side: THREE.DoubleSide });
const railMat = new THREE.MeshLambertMaterial({ color: 0x8d8799, side: THREE.DoubleSide });

// left and right edge of station i: [xl, zl, xr, zr]
function edges(d, i, out, inset = 0) {
  const P = d.pts, a = P[Math.max(i - 1, 0)], b = P[Math.min(i + 1, P.length - 1)];
  const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
  const nx = -dz / l * (d.hw - inset), nz = dx / l * (d.hw - inset);
  out[0] = P[i][0] + nx; out[1] = P[i][1] + nz; out[2] = P[i][0] - nx; out[3] = P[i][1] - nz;
  return out;
}

const inRect = (d, i, x0, z0, size) => {
  const P = d.pts, mx = (P[i][0] + P[i + 1][0]) / 2, mz = (P[i][1] + P[i + 1][1]) / 2;
  return mx >= x0 && mx < x0 + size && mz >= z0 && mz < z0 + size;
};

// Top surfaces of the deck segments inside one ground tile, with the tile's texture coordinates.
export function deckTopGeometry(world, x0, z0, size) {
  const pos = [], uv = [], e0 = [0, 0, 0, 0], e1 = [0, 0, 0, 0];
  for (const d of world.decks) {
    if (d.x1 < x0 || d.x0 > x0 + size || d.z1 < z0 || d.z0 > z0 + size) continue;
    const P = d.pts;
    for (let i = 0; i < P.length - 1; i++) {
      if (!inRect(d, i, x0, z0, size)) continue;
      edges(d, i, e0); edges(d, i + 1, e1);
      const a = P[i], b = P[i + 1], m = a.length - 3;
      for (let j = 0; j < m; j++) {                      // strips from the left edge to the right edge
        const u0 = j / m, u1 = (j + 1) / m;
        const at = (e, p, u, k) => [e[0] + (e[2] - e[0]) * u, p[2 + k], e[1] + (e[3] - e[1]) * u];
        const v = [at(e0, a, u0, j), at(e0, a, u1, j + 1), at(e1, b, u0, j), at(e1, b, u1, j + 1)];
        for (const k of [0, 2, 1, 1, 2, 3]) {
          pos.push(v[k][0], v[k][1] + LIFT, v[k][2]);
          uv.push((v[k][0] - x0) / size, 1 - (v[k][2] - z0) / size);
        }
      }
    }
  }
  if (pos.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  geo.computeVertexNormals();
  return geo;
}

// Slab, portal beams and railings of the decks inside one sector: a group, or null.
export function buildDeckBodies(world, s) {
  const S = world.meta.sector.size;
  const body = [], rail = [], e0 = [0, 0, 0, 0], e1 = [0, 0, 0, 0];
  const quad = (out, p, q, r, t) => out.push(...p, ...q, ...r, ...r, ...q, ...t);
  for (const d of world.decks) {
    if (d.x1 < s.x0 || d.x0 > s.x0 + S || d.z1 < s.z0 || d.z0 > s.z0 + S) continue;
    const P = d.pts, last = P.length - 1;
    const beam = (i) => {                                // across the end of a deck
      edges(d, i, e0);
      const q = P[i], r = q.length - 1;
      quad(body, [e0[0], q[2], e0[1]], [e0[2], q[r], e0[3]], [e0[0], q[2] - SLAB, e0[1]], [e0[2], q[r] - SLAB, e0[3]]);
    };
    for (let i = 0; i < last; i++) {
      if (!inRect(d, i, s.x0, s.z0, S)) continue;
      edges(d, i, e0); edges(d, i + 1, e1);
      const a = P[i], b = P[i + 1], r = a.length - 1;
      const la = [e0[0], a[2], e0[1]], ra = [e0[2], a[r], e0[3]], lb = [e1[0], b[2], e1[1]], rb = [e1[2], b[r], e1[3]];
      const dn = (p) => [p[0], p[1] - SLAB, p[2]];
      quad(body, dn(la), dn(ra), dn(lb), dn(rb));                         // underside
      quad(body, la, lb, dn(la), dn(lb));                                 // sides
      quad(body, ra, rb, dn(ra), dn(rb));
      if (i === 0) beam(0);
      if (i === last - 1) beam(last);
      if (d.rail && i >= d.rail[0] && i < d.rail[1]) {
        edges(d, i, e0, 0.15); edges(d, i + 1, e1, 0.15);
        const up = (x, z, y) => [x, y + RAIL, z];
        quad(rail, [e0[0], a[2], e0[1]], [e1[0], b[2], e1[1]], up(e0[0], e0[1], a[2]), up(e1[0], e1[1], b[2]));
        quad(rail, [e0[2], a[r], e0[3]], [e1[2], b[r], e1[3]], up(e0[2], e0[3], a[r]), up(e1[2], e1[3], b[r]));
      }
    }
  }
  if (body.length === 0) return null;
  const group = new THREE.Group();
  for (const [arr, mat] of [[body, concrete], [rail, railMat]]) {
    if (arr.length === 0) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  group.userData.dispose = () => { for (const m of group.children) m.geometry.dispose(); };
  return group;
}
