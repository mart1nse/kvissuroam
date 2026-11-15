// Walls from the map data (stone walls, retaining and noise walls). Unlike fences, which the game
// neither shows nor makes solid, these are in the obstacle field, so they are drawn.
import * as THREE from 'three';

const H = 1.7, T = 0.3;
const mat = new THREE.MeshLambertMaterial({ color: 0x8a8490, side: THREE.DoubleSide });

export function createWalls(world) {
  const S = world.meta.sector.size, G0 = world.meta.sector.grid0;
  const bySector = new Map();
  for (const w of world.vectors.walls || []) {
    for (let i = 0; i < w.length - 1; i++) {
      const a = w[i], b = w[i + 1];
      const k = `${Math.floor(((a[0] + b[0]) / 2 - G0) / S)}_${Math.floor(((a[1] + b[1]) / 2 - G0) / S)}`;
      let e = bySector.get(k);
      if (!e) bySector.set(k, (e = []));
      e.push(a[0], a[1], b[0], b[1]);
    }
  }
  // build(sector) -> mesh or null
  return (s) => {
    const e = bySector.get(`${s.sx}_${s.sz}`);
    if (!e) return null;
    const pos = [];
    const quad = (p, q, r, t) => pos.push(...p, ...q, ...r, ...r, ...q, ...t);
    const cl = (v, lo) => Math.min(Math.max(v, lo + 0.01), lo + S - 0.01);
    for (let i = 0; i < e.length; i += 4) {
      const x1 = e[i], z1 = e[i + 1], x2 = e[i + 2], z2 = e[i + 3];
      const l = Math.hypot(x2 - x1, z2 - z1) || 1, nx = (-(z2 - z1) / l) * T, nz = ((x2 - x1) / l) * T;
      const y1 = world.heightAt(cl(x1, s.x0), cl(z1, s.z0)), y2 = world.heightAt(cl(x2, s.x0), cl(z2, s.z0));
      const c = (x, z, y, k, up) => [x + nx * k, y + (up ? H : -0.4), z + nz * k];
      quad(c(x1, z1, y1, 1, 0), c(x2, z2, y2, 1, 0), c(x1, z1, y1, 1, 1), c(x2, z2, y2, 1, 1));
      quad(c(x1, z1, y1, -1, 0), c(x2, z2, y2, -1, 0), c(x1, z1, y1, -1, 1), c(x2, z2, y2, -1, 1));
      quad(c(x1, z1, y1, -1, 1), c(x2, z2, y2, -1, 1), c(x1, z1, y1, 1, 1), c(x2, z2, y2, 1, 1));
      quad(c(x1, z1, y1, -1, 0), c(x1, z1, y1, 1, 0), c(x1, z1, y1, -1, 1), c(x1, z1, y1, 1, 1));
      quad(c(x2, z2, y2, -1, 0), c(x2, z2, y2, 1, 0), c(x2, z2, y2, -1, 1), c(x2, z2, y2, 1, 1));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    return mesh;
  };
}
