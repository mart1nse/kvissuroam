import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------- buildings
function buildingGeometry(sector) {
  const { nv, buf, offset } = sector.buildings;
  let o = offset;
  const pq = new Int16Array(buf.slice(o, o + nv * 6)); o += nv * 6;
  const nq = new Int8Array(buf, o, nv * 3); o += nv * 3;
  const cq = new Uint8Array(buf, o, nv * 3); o += nv * 3;
  const kind = new Uint8Array(buf, o, nv); o += nv;
  const base = new Int16Array(buf.slice(o, o + nv * 2));

  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
  const aKind = new Float32Array(nv), aBase = new Float32Array(nv);
  const c = new THREE.Color();
  for (let i = 0; i < nv; i++) {
    pos[i * 3] = pq[i * 3] * 0.05; pos[i * 3 + 1] = pq[i * 3 + 1] * 0.01; pos[i * 3 + 2] = pq[i * 3 + 2] * 0.05;
    nor[i * 3] = nq[i * 3] / 127; nor[i * 3 + 1] = nq[i * 3 + 1] / 127; nor[i * 3 + 2] = nq[i * 3 + 2] / 127;
    c.setRGB(cq[i * 3] / 255, cq[i * 3 + 1] / 255, cq[i * 3 + 2] / 255, THREE.SRGBColorSpace);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    aKind[i] = kind[i]; aBase[i] = base[i] * 0.01;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aKind', new THREE.BufferAttribute(aKind, 1));
  geo.setAttribute('aBase', new THREE.BufferAttribute(aBase, 1));
  return geo;
}

// Returns build(sector) -> mesh of that sector's buildings (or null).
export function createBuildings() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aKind; attribute float aBase;
        varying float vKind; varying float vBase; varying vec3 vWP; varying vec3 vWN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vKind = aKind; vBase = aBase; vWP = position; vWN = normal;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vKind; varying float vBase; varying vec3 vWP; varying vec3 vWN;
        float bHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float kWin = 0.0; float kLit = 0.0;
        if (vKind > 1.5) {
          vec3 wn = normalize(vWN);
          vec2 tg = normalize(vec2(-wn.z, wn.x) + vec2(1e-5));
          float u = dot(vWP.xz, tg);
          float h = vWP.y - vBase;
          vec2 cell = vec2(floor(u / 2.6), floor(h / 2.9));
          vec2 f = vec2(fract(u / 2.6), fract(h / 2.9));
          float rnd = bHash(cell + floor(vBase * 7.0));
          kWin = step(0.2, f.x) * step(f.x, 0.8) * step(0.3, f.y) * step(f.y, 0.78)
               * step(0.42, rnd) * step(abs(wn.y), 0.3) * step(0.3, h);
          // mullion
          kWin *= 1.0 - step(abs(f.x - 0.5), 0.02) * step(0.6, rnd);
          kLit = step(0.86, rnd);
          vec3 glass = mix(vec3(0.04, 0.05, 0.09), vec3(0.10, 0.07, 0.16), f.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, glass, kWin);
        } else if (vKind < 0.5) {
          // slight weathering towards the ground
          diffuseColor.rgb *= 0.88 + 0.12 * smoothstep(0.0, 1.2, vWP.y - vBase);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.06, kWin);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.85, kWin);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += kWin * kLit * vec3(1.0, 0.62, 0.38) * 1.6;`);
  };
  return (sector) => {
    if (!sector.buildings.nv) return null;
    const mesh = new THREE.Mesh(buildingGeometry(sector), mat);
    mesh.position.set(sector.x0, 0, sector.z0);      // vertices are sector-relative
    mesh.updateMatrix();
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    return mesh;
  };
}

// ---------------------------------------------------------------- trees
function paint(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo.index ? geo.toNonIndexed() : geo;
}

function treeGeometries(detail) {
  // unit trees: height 1, crown diameter 1
  const trunk = (h) => paint(new THREE.CylinderGeometry(0.035, 0.05, h, 5, 1, true).translate(0, h / 2, 0), 0x4a3528);
  const crownA = new THREE.IcosahedronGeometry(0.5, detail).scale(1, 0.62, 1).translate(0, 0.67, 0);
  const crownB = new THREE.IcosahedronGeometry(0.34, detail).scale(1, 0.7, 1).translate(0.12, 0.5, 0.08);
  const dec = mergeGeometries([trunk(0.45), paint(crownA, 0x4f8f3a), paint(crownB, 0x3f7a34)]);
  const sides = detail ? 8 : 6;
  const c1 = new THREE.ConeGeometry(0.5, 0.5, sides, 1, true).translate(0, 0.43, 0);
  const c2 = new THREE.ConeGeometry(0.38, 0.42, sides, 1, true).translate(0, 0.67, 0);
  const c3 = new THREE.ConeGeometry(0.24, 0.34, sides, 1, true).translate(0, 0.83, 0);
  const con = mergeGeometries([trunk(0.3), paint(c1, 0x2c5f3a), paint(c2, 0x2f6a3e), paint(c3, 0x357444)]);
  dec.computeVertexNormals();
  con.computeVertexNormals();
  return [dec, con];
}

// Returns build(sector) -> { group, setNear(bool) } with that sector's trees.
export function createTrees(opts) {
  const near = treeGeometries(opts.treeDetail);
  const far = treeGeometries(0);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  return (sector) => {
    const rec = sector.trees;
    const n = rec.length / 6;
    if (!n) return null;
    const group = new THREE.Group();
    const nearMeshes = [], farMeshes = [];
    let seed = (sector.sx * 73856093) ^ (sector.sz * 19349663) ^ 99;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    for (let type = 0; type < 2; type++) {
      const list = [];
      for (let i = 0; i < n; i++) {
        if ((rec[i * 6 + 5] | 0) !== type) continue;
        if (opts.thinTrees && rec[i * 6 + 3] < 9 && (i % 3) === 0) continue;
        list.push(i);
      }
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(far[type], mat, list.length);
      list.forEach((i, k) => {
        const h = rec[i * 6 + 3], c = rec[i * 6 + 4];
        p.set(rec[i * 6], rec[i * 6 + 1] - 0.15, rec[i * 6 + 2]);
        q.setFromAxisAngle(up, rnd() * 6.283);
        s.set(c, h, c);
        m.compose(p, q, s);
        im.setMatrixAt(k, m);
        const v = 0.78 + rnd() * 0.4;
        col.setRGB(v, v * (0.95 + rnd() * 0.1), v * 0.9);
        im.setColorAt(k, col);
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.matrixAutoUpdate = false;
      group.add(im);
      farMeshes.push(im);
      if (near[type] !== far[type] && opts.treeDetail) {
        // same instances, detailed geometry: shown instead of the far mesh when close
        const im2 = new THREE.InstancedMesh(near[type], mat, list.length);
        im2.instanceMatrix = im.instanceMatrix;
        im2.instanceColor = im.instanceColor;
        im2.boundingSphere = im.boundingSphere;
        im2.castShadow = opts.treeShadows;
        im2.matrixAutoUpdate = false;
        im2.visible = false;
        group.add(im2);
        nearMeshes.push(im2);
      }
    }
    let isNear = false;
    return {
      group,
      setNear(v) {
        if (v === isNear || !nearMeshes.length) return;
        isNear = v;
        for (const x of nearMeshes) x.visible = v;
        for (const x of farMeshes) x.visible = !v;
      },
      dispose() { for (const x of farMeshes) x.dispose(); },
    };
  };
}

// ---------------------------------------------------------------- water
function ripplesTexture() {
  const n = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(n, n);
  const hgt = (x, y) => {
    let v = 0;
    const k = (Math.PI * 2) / n;
    v += Math.sin(x * k * 3 + y * k * 5) + Math.sin(x * k * 7 - y * k * 4 + 1.3) * 0.6;
    v += Math.sin(x * k * 13 + y * k * 11 + 0.7) * 0.3 + Math.sin(-x * k * 17 + y * k * 9 + 2.1) * 0.25;
    return v;
  };
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = hgt(x + 1, y) - hgt(x - 1, y), dy = hgt(x, y + 1) - hgt(x, y - 1);
      const i = (y * n + x) * 4;
      img.data[i] = 128 + dx * 60; img.data[i + 1] = 128 + dy * 60; img.data[i + 2] = 255; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function createWater(world) {
  const group = new THREE.Group();
  const normalMap = ripplesTexture();
  normalMap.repeat.set(0.06, 0.06);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x24305e, roughness: 0.12, metalness: 0.55, transparent: true, opacity: 0.9,
    normalMap, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.4,
  });
  const ponds = [];
  for (const w of world.vectors.water) {
    for (const poly of w.polys) {
      if (poly.outer.length < 4) continue;
      const shape = new THREE.Shape(poly.outer.map(([x, z]) => new THREE.Vector2(x, z)));
      for (const hole of poly.holes) shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, z))));
      const geo = new THREE.ShapeGeometry(shape);
      // shape is in (x, z): lay it flat; UVs in metres for the ripple map
      const pos = geo.attributes.position;
      const uv = geo.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getY(i);
        pos.setXYZ(i, x, w.level, z);
        uv.setXY(i, x, z);
      }
      // ShapeGeometry faces +z of the 2D plane, which is now -y: flip the winding
      const idx = geo.index.array;
      for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.matrixAutoUpdate = false;
      mesh.renderOrder = 2;
      group.add(mesh);
      if (!w.river) {
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const [x, z] of poly.outer) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
        ponds.push({ minX, maxX, minZ, maxZ, level: w.level, ring: poly.outer });
      }
    }
  }
  const inside = (ring, x, z) => {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i], [xj, zj] = ring[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
    }
    return hit;
  };
  // water level lookup used by the physics: the pond or stream under the point, else the river
  world.waterLevelAt = (x, z) => {
    let near = null;
    for (const p of ponds) {
      if (x < p.minX - 2 || x > p.maxX + 2 || z < p.minZ - 2 || z > p.maxZ + 2) continue;
      if (inside(p.ring, x, z)) return p.level;
      near = near || p;
    }
    if (near && Math.abs(world.heightAt(x, z) - near.level) < Math.abs(world.heightAt(x, z) - world.meta.riverLevel)) return near.level;
    return world.meta.riverLevel;
  };
  const update = (t) => { normalMap.offset.set(t * 0.004, t * 0.012); };
  return { group, update };
}

// ---------------------------------------------------------------- map edge
export function createEdgeGrid(world) {
  const ring = world.meta.boundary;
  const h = 40;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `attribute float aAlong; varying vec3 vP; varying float vAlong; void main() { vP = position; vAlong = aAlong; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec3 vP; varying float vAlong; uniform vec3 uCam; uniform float uTime;
      void main() {
        vec2 g = vec2(vAlong, vP.y - uTime * 1.5) / 4.0;
        vec2 f = abs(fract(g) - 0.5);
        float line = smoothstep(0.47, 0.5, max(f.x, f.y));
        float d = distance(vP.xz, uCam.xz);
        float a = (1.0 - smoothstep(25.0, 130.0, d)) * (line * 0.9 + 0.06) * (1.0 - smoothstep(0.0, 40.0, vP.y - uCam.y + 12.0));
        vec3 col = mix(vec3(0.1, 0.95, 1.0), vec3(1.0, 0.2, 0.8), smoothstep(-5.0, 25.0, vP.y - uCam.y));
        gl_FragColor = vec4(col, a);
      }`,
  });
  // one tall quad per boundary segment, following the terrain
  const n = ring.length - 1;
  const pos = new Float32Array(n * 12), along = new Float32Array(n * 4), idx = new Uint32Array(n * 6);
  let d = 0;
  for (let i = 0; i < n; i++) {
    const [x0, z0] = ring[i], [x1, z1] = ring[i + 1];
    const y0 = world.coarseHeight(x0, z0) - 12, y1 = world.coarseHeight(x1, z1) - 12;
    const len = Math.hypot(x1 - x0, z1 - z0);
    pos.set([x0, y0, z0, x1, y1, z1, x0, y0 + h, z0, x1, y1 + h, z1], i * 12);
    along.set([d, d + len, d, d + len], i * 4);
    d += len;
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.matrixAutoUpdate = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return { group: mesh, mat };
}
