import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------- buildings
// The bake gives walls, roofs and one base height per building, but no building ids. Triangles that share
// a base height are one building, which is enough to measure it and pick a facade style for it:
//   0 detached house (boards or plaster)   1 apartment block (panels or brick)   2 shop, hall or shed (cladding)
function buildingGeometry(sector) {
  const { nv, buf, offset } = sector.buildings;
  let o = offset;
  const pq = new Int16Array(buf.slice(o, o + nv * 6)); o += nv * 6;
  const nq = new Int8Array(buf, o, nv * 3); o += nv * 3;
  const cq = new Uint8Array(buf, o, nv * 3); o += nv * 3;
  const kind = new Uint8Array(buf, o, nv); o += nv;
  const base = new Int16Array(buf.slice(o, o + nv * 2));

  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
  const aKind = new Float32Array(nv), aBase = new Float32Array(nv), aInfo = new Float32Array(nv * 3);
  const c = new THREE.Color();
  const groups = new Map();
  for (let i = 0; i < nv; i++) {
    const x = pos[i * 3] = pq[i * 3] * 0.05, y = pos[i * 3 + 1] = pq[i * 3 + 1] * 0.01, z = pos[i * 3 + 2] = pq[i * 3 + 2] * 0.05;
    nor[i * 3] = nq[i * 3] / 127; nor[i * 3 + 1] = nq[i * 3 + 1] / 127; nor[i * 3 + 2] = nq[i * 3 + 2] / 127;
    c.setRGB(cq[i * 3] / 255, cq[i * 3 + 1] / 255, cq[i * 3 + 2] / 255, THREE.SRGBColorSpace);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    aKind[i] = kind[i]; aBase[i] = base[i] * 0.01;
    let g = groups.get(base[i]);
    if (!g) groups.set(base[i], (g = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9, top: -1e9, eaves: 1e9 }));
    if (x < g.x0) g.x0 = x; if (x > g.x1) g.x1 = x;
    if (z < g.z0) g.z0 = z; if (z > g.z1) g.z1 = z;
    if (y > g.top) g.top = y;
    if (kind[i] === 1 && y < g.eaves) g.eaves = y;       // lowest roof point
  }
  for (const [b, g] of groups) {
    const h = g.top - b * 0.01, area = (g.x1 - g.x0) * (g.z1 - g.z0);
    g.eavesH = Math.min(h, g.eaves > 1e8 ? h : g.eaves - b * 0.01);
    g.style = h >= 10.5 ? 1 : area > 420 ? 2 : 0;
    g.seed = Math.round(((Math.abs(Math.sin(b * 12.9898 + g.x0 * 78.233 + g.z0 * 37.719) * 43758.5453)) % 1) * 1023) / 1023;
  }
  for (let i = 0; i < nv; i++) {
    const g = groups.get(base[i]);
    aInfo[i * 3] = g.eavesH; aInfo[i * 3 + 1] = g.style; aInfo[i * 3 + 2] = g.seed;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aKind', new THREE.BufferAttribute(aKind, 1));
  geo.setAttribute('aBase', new THREE.BufferAttribute(aBase, 1));
  geo.setAttribute('aInfo', new THREE.BufferAttribute(aInfo, 3));
  return geo;
}

// Returns build(sector) -> mesh of that sector's buildings (or null).
export function createBuildings() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aKind; attribute float aBase; attribute vec3 aInfo;
        varying float vKind; varying float vBase; varying vec3 vInfo; varying vec3 vWP; varying vec3 vWN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vKind = aKind; vBase = aBase; vInfo = aInfo; vWP = position; vWN = normal;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vKind; varying float vBase; varying vec3 vInfo; varying vec3 vWP; varying vec3 vWN;
        float bHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        // 1 inside [a, b], with edges softened by e
        float bBox(float x, float a, float b, float e) { return smoothstep(a - e, a + e, x) * (1.0 - smoothstep(b - e, b + e, x)); }
        // thin dark line every "period", fading out before it turns into noise in the distance
        float bLine(float x, float period, float width) {
          float w = fwidth(x) / period, f = abs(fract(x / period) - 0.5);
          return (1.0 - smoothstep(width, width + w * 1.5 + 0.01, 0.5 - f)) * (1.0 - smoothstep(0.15, 0.45, w));
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float kWin = 0.0; float kLit = 0.0; float kRough = 0.0;
        vec3 wn = normalize(vWN);
        float h = vWP.y - vBase;
        float seed = vInfo.z, style = vInfo.y, eaves = max(vInfo.x, 2.4);
        float sq = floor(seed * 1023.0 + 0.5);      // exact per building, safe to hash
        if (vKind > 0.5 && vKind < 1.5) {
          // ---- roof: seams or tiles running down the slope, plain felt when flat
          if (wn.y < 0.985) {
            vec2 across = normalize(vec2(-wn.z, wn.x) + vec2(1e-5));
            float tile = step(0.5, seed);
            float seam = bLine(dot(vWP.xz, across), mix(0.48, 0.24, tile), 0.06);
            float rows = bLine(vWP.y / max(1.0 - wn.y * wn.y, 0.05), 0.34, 0.07) * tile;
            diffuseColor.rgb *= 1.0 - 0.28 * max(seam, rows);
            kRough = mix(-0.35, 0.0, tile);
          }
          diffuseColor.rgb *= 0.9 + 0.2 * bHash(floor(vWP.xz * 0.7) + mod(sq, 13.0));
        } else if (abs(wn.y) < 0.35) {
          vec2 tg = normalize(vec2(-wn.z, wn.x) + vec2(1e-5));
          float u = dot(vWP.xz, tg);
          vec3 wall = diffuseColor.rgb;
          // wall material
          if (style < 0.5) {
            // houses: pastel paint over boards, or plaster
            vec3 tint = 0.5 + 0.5 * cos(6.2831 * (seed * 3.0 + vec3(0.0, 0.33, 0.67)));
            wall = mix(wall, mix(wall, tint, 0.55) * vec3(1.0, 0.94, 0.9), step(0.35, seed) * 0.6);
            float boards = seed > 0.7 ? bLine(u, 0.16, 0.05) : seed > 0.35 ? bLine(h, 0.15, 0.06) : 0.0;
            wall *= 1.0 - 0.22 * boards;
          } else if (style < 1.5) {
            if (seed > 0.55) {
              // brick
              float row = floor(h / 0.085);
              float mortar = max(bLine(h, 0.085, 0.08), bLine(u + mod(row, 2.0) * 0.13, 0.26, 0.04));
              wall = mix(wall, vec3(0.42, 0.2, 0.15) * (0.85 + 0.3 * bHash(vec2(floor((u + mod(row, 2.0) * 0.13) / 0.26), row))), 0.75);
              wall = mix(wall, vec3(0.62, 0.58, 0.55), mortar * 0.6);
            } else {
              // concrete panels
              wall *= 1.0 - 0.3 * max(bLine(u, 3.0, 0.012), bLine(h, 2.8, 0.012));
              wall *= 0.93 + 0.1 * bHash(vec2(floor(u / 3.0), floor(h / 2.8)) + mod(sq, 29.0));
            }
          } else {
            // halls and shops: ribbed metal cladding with a coloured band under the eaves
            wall *= 1.0 - 0.16 * bLine(u, 0.3, 0.1);
            vec3 band = 0.5 + 0.5 * cos(6.2831 * (seed * 5.0 + vec3(0.1, 0.45, 0.8)));
            wall = mix(wall, band * 0.8, step(eaves - 0.9, h) * step(h, eaves - 0.15) * step(0.4, seed) * 0.8);
            kRough = -0.3;
          }
          // plinth, grime at the ground, shade under the eaves
          wall = mix(wall, vec3(0.3, 0.29, 0.3), (1.0 - smoothstep(0.42, 0.46, h)) * 0.75);
          wall *= 0.8 + 0.2 * smoothstep(0.0, 1.6, h);
          wall *= 0.86 + 0.14 * (1.0 - smoothstep(eaves - 0.5, eaves - 0.05, h) * step(h, eaves));
          diffuseColor.rgb = wall;

          if (vKind > 1.5) {
            // ---- windows and doors on a grid that follows the storeys
            vec2 size = style < 0.5 ? vec2(2.5, 2.8) : style < 1.5 ? vec2(3.0, 2.8) : vec2(4.2, 3.6);
            vec2 cell = vec2(floor(u / size.x), floor((h - 0.45) / size.y));
            vec2 f = vec2(fract(u / size.x), fract((h - 0.45) / size.y)) * size;      // metres inside the cell
            float rnd = bHash(cell + mod(sq, 61.0));
            vec2 e = vec2(fwidth(u), fwidth(h)) + 0.004;
            vec2 wc = vec2(size.x * 0.5, style < 1.5 ? 1.6 : 1.9);                   // window centre
            vec2 wh = style < 0.5 ? vec2(0.55, 0.65) : style < 1.5 ? vec2(0.85, 0.7) : vec2(1.75, 0.75);
            float have = style < 0.5 ? step(0.3, rnd) : style < 1.5 ? step(0.06, rnd) : step(0.45, rnd);
            float inWall = step(0.45, h) * step(h + 0.25, floor((eaves - 0.45) / size.y + 0.35) * size.y + 0.45);
            have *= inWall;
            float door = step(cell.y, 0.5) * step(0.5, cell.y + 1.0) * step(0.88, rnd) * inWall;
            // door: taller opening that starts at the plinth
            vec2 dc = vec2(size.x * 0.5, 1.05), dh = vec2(style > 1.5 ? 1.1 : 0.5, 1.05);
            vec2 c0 = mix(wc, dc, door), hs = mix(wh, dh, door);
            float frame = bBox(f.x, c0.x - hs.x - 0.07, c0.x + hs.x + 0.07, e.x) * bBox(f.y, c0.y - hs.y - 0.07, c0.y + hs.y + 0.07, e.y);
            float glass = bBox(f.x, c0.x - hs.x, c0.x + hs.x, e.x) * bBox(f.y, c0.y - hs.y, c0.y + hs.y, e.y);
            float sill = bBox(f.x, c0.x - hs.x - 0.14, c0.x + hs.x + 0.14, e.x) * bBox(f.y, c0.y - hs.y - 0.13, c0.y - hs.y - 0.06, e.y) * (1.0 - door);
            // glazing bars
            float bars = max(1.0 - smoothstep(0.0, 0.025 + e.x, abs(f.x - c0.x)), (1.0 - smoothstep(0.0, 0.025 + e.y, abs(f.y - c0.y - hs.y * 0.35))) * step(style, 0.5));
            frame *= have; glass *= have; sill *= have;
            vec3 frameCol = mix(vec3(0.93, 0.92, 0.9), vec3(0.2, 0.19, 0.2), step(0.6, fract(seed * 7.3)));
            vec3 doorCol = 0.35 + 0.3 * cos(6.2831 * (seed * 9.0 + vec3(0.0, 0.2, 0.5)));
            diffuseColor.rgb = mix(diffuseColor.rgb, frameCol, max(frame, sill));
            float pane = glass * (1.0 - bars * (1.0 - door));
            float solidDoor = door * step(fract(rnd * 31.0), 0.6) * step(style, 1.5);
            diffuseColor.rgb = mix(diffuseColor.rgb, doorCol, glass * solidDoor);
            kWin = pane * (1.0 - solidDoor);
            // balconies on some columns of apartment blocks
            if (style > 0.5 && style < 1.5) {
              float col2 = bHash(vec2(cell.x, mod(sq, 17.0)));
              float rail = step(0.62, col2) * inWall * step(0.5, cell.y) * bBox(f.y, 0.25, 1.25, e.y) * bBox(f.x, 0.25, size.x - 0.25, e.x);
              vec3 railCol = mix(vec3(0.8, 0.8, 0.82), 0.5 + 0.5 * cos(6.2831 * (seed * 4.0 + vec3(0.0, 0.33, 0.67))), 0.45);
              diffuseColor.rgb = mix(diffuseColor.rgb, railCol * (0.9 - 0.25 * bLine(u, 0.12, 0.12)), rail);
              kWin *= 1.0 - rail;
            }
            float litRnd = bHash(cell * 1.7 + mod(sq, 23.0));
            kLit = step(0.74, litRnd) * (1.0 - door);
            vec3 glassCol = mix(vec3(0.04, 0.05, 0.09), vec3(0.10, 0.07, 0.16), f.y / size.y);
            // a hint of curtains and rooms in lit windows
            float curtain = step(0.5, bHash(cell + 5.0)) * (1.0 - bBox(f.x, c0.x - hs.x * 0.5, c0.x + hs.x * 0.5, 0.02));
            diffuseColor.rgb = mix(diffuseColor.rgb, glassCol, kWin);
            kLit *= 1.0 - 0.45 * curtain;
            vLitTint = mix(vec3(1.0, 0.62, 0.38), mix(vec3(1.0, 0.82, 0.55), vec3(0.55, 0.7, 1.0), step(0.93, litRnd)), step(0.84, litRnd));
          }
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(clamp(roughnessFactor + kRough, 0.05, 1.0), 0.06, kWin);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.85, kWin * (1.0 - kLit));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += kWin * kLit * vLitTint * 1.5;`);
    sh.fragmentShader = sh.fragmentShader.replace('float bHash(vec2 p)', 'vec3 vLitTint = vec3(1.0, 0.62, 0.38);\n        float bHash(vec2 p)');
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

// Unit trees (height 1, crown diameter 1), one per species. Trees 0-3 are broadleaved, 4-5 conifers.
function treeGeometries(detail) {
  const trunk = (h, r, hex) => paint(new THREE.CylinderGeometry(r * 0.7, r, h, 5, 1, true).translate(0, h / 2, 0), hex);
  const blob = (r, sy, x, y, z, hex) => paint(new THREE.IcosahedronGeometry(r, detail).scale(1, sy, 1).translate(x, y, z), hex);
  const sides = detail ? 8 : 6;
  const cone = (r, h, y, hex) => paint(new THREE.ConeGeometry(r, h, sides, 1, true).translate(0, y, 0), hex);
  const out = [
    // 0 lime or maple: full round crown
    mergeGeometries([trunk(0.45, 0.05, 0x4a3528), blob(0.5, 0.62, 0, 0.67, 0, 0x4f8f3a), blob(0.34, 0.7, 0.12, 0.5, 0.08, 0x3f7a34)]),
    // 1 birch: white stem, light airy crown
    mergeGeometries([trunk(0.62, 0.03, 0xd9d6cf), blob(0.3, 1.05, 0, 0.68, 0, 0x7fae4a), blob(0.22, 0.9, -0.1, 0.5, 0.06, 0x8dba55)]),
    // 2 oak: low and wide, several lobes
    mergeGeometries([trunk(0.36, 0.07, 0x3d2c22), blob(0.36, 0.7, 0.16, 0.6, 0.05, 0x3f7434), blob(0.34, 0.72, -0.15, 0.62, -0.1, 0x47803a),
      blob(0.3, 0.75, 0.0, 0.76, 0.12, 0x4f8b3f)]),
    // 3 poplar: a tall column
    mergeGeometries([trunk(0.3, 0.045, 0x574636), blob(0.24, 1.7, 0, 0.6, 0, 0x4c8640)]),
    // 4 spruce: stacked cones to the ground
    mergeGeometries([trunk(0.3, 0.04, 0x4a3528), cone(0.5, 0.5, 0.43, 0x2c5f3a), cone(0.38, 0.42, 0.67, 0x2f6a3e), cone(0.24, 0.34, 0.83, 0x357444)]),
    // 5 pine: long bare reddish stem, flat crown at the top
    mergeGeometries([trunk(0.72, 0.04, 0x9a5a3c), blob(0.42, 0.45, 0, 0.82, 0, 0x2f6642), blob(0.26, 0.5, 0.14, 0.7, -0.05, 0x37714a)]),
  ];
  for (const g of out) g.computeVertexNormals();
  return out;
}

// species from what the lidar tells us: conifer or not, height, and how slim the crown is
function treeSpecies(type, h, crown, r) {
  if (type === 1) return h > 13 && r < 0.45 ? 5 : 4;
  const slim = crown / h;
  if (slim < 0.3) return r < 0.4 ? 3 : 1;
  if (slim > 0.62 && h > 9) return 2;
  return r < 0.28 ? 1 : 0;
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
    const lists = near.map(() => []);
    for (let i = 0; i < n; i++) {
      if (opts.thinTrees && rec[i * 6 + 3] < 9 && (i % 3) === 0) continue;
      const pick = Math.abs(Math.sin(rec[i * 6] * 12.9898 + rec[i * 6 + 2] * 78.233) * 43758.5453) % 1;
      lists[treeSpecies(rec[i * 6 + 5] | 0, rec[i * 6 + 3], rec[i * 6 + 4], pick)].push(i);
    }
    for (let type = 0; type < lists.length; type++) {
      const list = lists[type];
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(far[type], mat, list.length);
      list.forEach((i, k) => {
        const h = rec[i * 6 + 3], c = rec[i * 6 + 4];
        p.set(rec[i * 6], rec[i * 6 + 1] - 0.15, rec[i * 6 + 2]);
        q.setFromAxisAngle(up, rnd() * 6.283);
        s.set(c, h, c);
        m.compose(p, q, s);
        im.setMatrixAt(k, m);
        const v = 0.78 + rnd() * 0.4, warm = type < 4 && rnd() < 0.12 ? 0.25 + rnd() * 0.3 : 0;   // a few already turning
        col.setRGB(v * (1 + warm), v * (0.95 + rnd() * 0.1), v * (0.9 - warm * 0.6));
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

// ---------------------------------------------------------------- hedges, bushes and fences
// Returns build(sector) -> group (or null). Cells come from laser-scan data on a 0.5 m grid.
export function createLowObjects(world, opts) {
  const res = world.meta.lowres || 0.5;
  const bushGeo = new THREE.CylinderGeometry(0.34, 0.42, 1, 5, 1).translate(0, 0.5, 0);
  const fenceGeo = new THREE.BoxGeometry(res * 1.25, 1, 0.07).translate(0, 0.5, 0);
  const bushMat = new THREE.MeshLambertMaterial({ flatShading: true });
  const fenceMat = new THREE.MeshLambertMaterial();
  const FENCE = [0x4a3b30, 0x5d5f66, 0x8a7257, 0x2e2f35, 0x9a9690];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  return (sector) => {
    const nb = sector.bushes.length / 3, nf = sector.fences.length / 3;
    if (!nb && !nf) return null;
    const group = new THREE.Group();
    let seed = (sector.sx * 9176 + sector.sz * 31337 + 7) >>> 0;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    if (nb) {
      const B = sector.bushes;
      const step = opts.thinTrees ? 2 : 1;        // phones: every other cell, drawn fatter
      const im = new THREE.InstancedMesh(bushGeo, bushMat, Math.ceil(nb / step));
      let k = 0;
      for (let i = 0; i < nb; i += step) {
        const x = sector.x0 + (B[i * 3] + 0.5) * res, z = sector.z0 + (B[i * 3 + 1] + 0.5) * res;
        const h = (B[i * 3 + 2] & 255) / 10;
        p.set(x + (rnd() - 0.5) * 0.15, world.heightAt(x, z) - 0.1, z + (rnd() - 0.5) * 0.15);
        q.setFromAxisAngle(up, rnd() * 6.283);
        const w = (1.25 + rnd() * 0.35) * (step === 2 ? 1.5 : 1) * (res / 0.5);
        sc.set(w, h * (0.92 + rnd() * 0.16) + 0.1, w);
        m.compose(p, q, sc);
        im.setMatrixAt(k, m);
        const v = 0.75 + rnd() * 0.35;
        col.setRGB(0.045 * v, 0.17 * v, 0.055 * v + rnd() * 0.015);
        im.setColorAt(k++, col);
      }
      im.count = k;
      im.castShadow = opts.treeShadows;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      im.matrixAutoUpdate = false;
      group.add(im);
    }
    if (nf) {
      const F = sector.fences;
      const im = new THREE.InstancedMesh(fenceGeo, fenceMat, nf);
      for (let i = 0; i < nf; i++) {
        const x = sector.x0 + (F[i * 3] + 0.5) * res, z = sector.z0 + (F[i * 3 + 1] + 0.5) * res;
        const h = (F[i * 3 + 2] & 255) / 10, ang = ((F[i * 3 + 2] >> 8) / 255) * Math.PI;
        p.set(x, world.heightAt(x, z) - 0.05, z);
        q.setFromAxisAngle(up, -ang);
        sc.set(1, h, 1);
        m.compose(p, q, sc);
        im.setMatrixAt(i, m);
        // one colour per plot-sized patch, so a fence keeps its colour along a garden
        const hsh = (Math.floor(x / 28) * 73856093) ^ (Math.floor(z / 28) * 19349663);
        col.setHex(FENCE[Math.abs(hsh) % FENCE.length]);
        im.setColorAt(i, col);
      }
      im.castShadow = opts.treeShadows;
      im.computeBoundingSphere();
      im.matrixAutoUpdate = false;
      group.add(im);
    }
    group.userData.dispose = () => { for (const c of group.children) c.dispose(); };
    return group;
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
