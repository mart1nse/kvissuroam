import * as THREE from 'three';

const BASE = `${import.meta.env.BASE_URL}data/ortho/`;

function makeDetailTexture() {
  // tiling grain that hides the blur of the aerial photo up close
  const n = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(n, n);
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const base = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) base[i] = rnd();
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      // two octaves, wrapped
      const a = base[y * n + x];
      const b = (base[(y >> 2) * n + (x >> 2)] + base[(((y >> 2) + 1) % n) * n + (x >> 2)]) / 2;
      const v = Math.round(255 * (0.62 + 0.26 * a + 0.24 * (b - 0.5)));
      const i = (y * n + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.min(255, v);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function groundMaterial(map, detail) {
  const mat = new THREE.MeshLambertMaterial({ map });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = { value: detail };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWxz;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWxz = position.xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;\nvarying vec2 vWxz;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float dA = texture2D(uDetail, vWxz * 0.9).r;
        float dB = texture2D(uDetail, vWxz * 0.11).r;
        float dist = length(vViewPosition);
        float k = 1.0 - smoothstep(25.0, 90.0, dist);
        diffuseColor.rgb *= mix(1.0, (dA * 0.75 + dB * 0.55) * 1.02, k * 0.85);`);
  };
  return mat;
}

export function createTerrain(world, renderer, opts) {
  const { meta } = world;
  const group = new THREE.Group();
  const inner = meta.inner, outer = meta.outer;
  const tile = meta.ortho.tile, nt = meta.ortho.n;
  const res = meta.height.res, hn = meta.height.n;
  const stride = opts.terrainStride;            // 1 = full 2 m grid, 2 = 4 m grid
  const per = Math.round(tile / res);           // grid cells per tile
  const aniso = Math.min(opts.anisotropy, renderer.capabilities.getMaxAnisotropy());
  const loader = new THREE.TextureLoader();
  const detail = makeDetailTexture();
  detail.anisotropy = Math.min(4, aniso);

  const lows = [];
  const overview = loader.load(`${BASE}overview.jpg`, () => { for (const t of lows) t.needsUpdate = true; });
  overview.colorSpace = THREE.SRGBColorSpace;
  overview.anisotropy = aniso;

  const chunks = [];
  for (let ty = 0; ty < nt; ty++) {
    for (let tx = 0; tx < nt; tx++) {
      const seg = per / stride;
      const nv = seg + 1;
      const pos = new Float32Array(nv * nv * 3);
      const nor = new Float32Array(nv * nv * 3);
      const uv = new Float32Array(nv * nv * 2);
      const x0 = -inner + tx * tile, z0 = -inner + ty * tile;
      for (let j = 0; j < nv; j++) {
        for (let i = 0; i < nv; i++) {
          const c = tx * per + i * stride, r = ty * per + j * stride;
          const k = j * nv + i;
          const y = world.nodeHeight(c, r);
          pos[k * 3] = x0 + i * stride * res;
          pos[k * 3 + 1] = y;
          pos[k * 3 + 2] = z0 + j * stride * res;
          const cl = Math.max(c - 1, 0), cr = Math.min(c + 1, hn - 1);
          const ru = Math.max(r - 1, 0), rd = Math.min(r + 1, hn - 1);
          const dx = (world.nodeHeight(cr, r) - world.nodeHeight(cl, r)) / ((cr - cl) * res);
          const dz = (world.nodeHeight(c, rd) - world.nodeHeight(c, ru)) / ((rd - ru) * res);
          const l = Math.hypot(dx, 1, dz);
          nor[k * 3] = -dx / l; nor[k * 3 + 1] = 1 / l; nor[k * 3 + 2] = -dz / l;
          uv[k * 2] = i / seg; uv[k * 2 + 1] = 1 - j / seg;
        }
      }
      const idx = new Uint16Array(seg * seg * 6);
      let q = 0;
      for (let j = 0; j < seg; j++) {
        for (let i = 0; i < seg; i++) {
          const a = j * nv + i, b = a + 1, c2 = a + nv, d = c2 + 1;
          idx[q++] = a; idx[q++] = c2; idx[q++] = b;
          idx[q++] = b; idx[q++] = c2; idx[q++] = d;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeBoundingSphere();
      geo.computeBoundingBox();

      // low-res fallback: a window into the overview image
      const low = overview.clone();
      low.needsUpdate = false;
      lows.push(low);
      low.repeat.set(tile / (2 * outer), tile / (2 * outer));
      low.offset.set((x0 + outer) / (2 * outer), 1 - (z0 + tile + outer) / (2 * outer));
      const matLow = groundMaterial(low, detail);
      const mesh = new THREE.Mesh(geo, matLow);
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      chunks.push({ tx, ty, mesh, matLow, matHi: null, state: 'low', cx: x0 + tile / 2, cz: z0 + tile / 2 });
    }
  }

  // ---- coarse scenery ring around the drivable square
  {
    const on = meta.height.outerN, ores = meta.height.outerRes;
    const pos = new Float32Array(on * on * 3), uv = new Float32Array(on * on * 2);
    for (let r = 0; r < on; r++) {
      for (let c = 0; c < on; c++) {
        const k = r * on + c;
        pos[k * 3] = -outer + c * ores;
        pos[k * 3 + 1] = world.outerNodeHeight(c, r);
        pos[k * 3 + 2] = -outer + r * ores;
        uv[k * 2] = c / (on - 1); uv[k * 2 + 1] = 1 - r / (on - 1);
      }
    }
    const k0 = Math.round((outer - inner) / ores), k1 = on - 1 - k0;
    const idx = [];
    for (let r = 0; r < on - 1; r++) {
      for (let c = 0; c < on - 1; c++) {
        if (r >= k0 && r < k1 && c >= k0 && c < k1) continue;   // hole for the detailed chunks
        const a = r * on + c, b = a + 1, c2 = a + on, d = c2 + 1;
        idx.push(a, c2, b, b, c2, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: overview }));
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    // a wide apron so the horizon is never empty
    const apron = new THREE.Mesh(
      new THREE.RingGeometry(outer * 0.98, outer * 6, 48, 1),
      new THREE.MeshLambertMaterial({ color: 0x3f5a3a }),
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = world.outerNodeHeight(0, 0) - 3;
    group.add(apron);
  }

  // ---- hi-res tile streaming around the camera
  let loading = 0;
  const rHi = opts.tileRadius;
  function load(ch) {
    ch.state = 'loading';
    loading++;
    loader.load(`${BASE}t_${ch.tx}_${ch.ty}.jpg`, (tex) => {
      loading--;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = aniso;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      ch.matHi = groundMaterial(tex, detail);
      ch.mesh.material = ch.matHi;
      ch.state = 'hi';
    }, undefined, () => { loading--; ch.state = 'failed'; });
  }
  function update(camPos) {
    const want = [];
    for (const ch of chunks) {
      ch.d = Math.hypot(ch.cx - camPos.x, ch.cz - camPos.z);
      if (ch.state === 'low' && ch.d < rHi) want.push(ch);
      else if (ch.state === 'hi' && ch.d > rHi + 260) {
        ch.mesh.material = ch.matLow;
        ch.matHi.map.dispose();
        ch.matHi.dispose();
        ch.matHi = null;
        ch.state = 'low';
      }
    }
    // nearest first, a few at a time
    want.sort((p, q) => p.d - q.d);
    for (const ch of want) { if (loading >= 4) break; load(ch); }
  }
  return { group, update, pending: () => loading };
}
