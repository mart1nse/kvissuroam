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

function groundMaterial(map, detail, overview) {
  // overview: sample the map by world position inside the scenery rectangle instead of by uv
  const mat = new THREE.MeshLambertMaterial({ map });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = { value: detail };
    shader.uniforms.uRect = { value: overview || new THREE.Vector4() };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWxz;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWxz = position.xz;');
    const sample = overview
      ? `diffuseColor *= texture2D(map, vec2((vWxz.x - uRect.x) / uRect.z, 1.0 - (vWxz.y - uRect.y) / uRect.w));`
      : '#include <map_fragment>';
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;\nuniform vec4 uRect;\nvarying vec2 vWxz;')
      .replace('#include <map_fragment>', `${sample}
        float dA = texture2D(uDetail, vWxz * 0.9).r;
        float dB = texture2D(uDetail, vWxz * 0.11).r;
        float dist = length(vViewPosition);
        float k = 1.0 - smoothstep(25.0, 90.0, dist);
        diffuseColor.rgb *= mix(1.0, (dA * 0.75 + dB * 0.55) * 1.02, k * 0.85);`);
  };
  mat.customProgramCacheKey = () => (overview ? 'ground-overview' : 'ground-tile');
  return mat;
}

export function createTerrain(world, renderer, opts) {
  const { meta } = world;
  const group = new THREE.Group();
  const co = meta.coarse;
  const S = meta.sector.size;
  const res = meta.height.res, hn = meta.height.n;
  const hs = meta.height.scale, hoff = meta.height.offset;
  const stride = opts.terrainStride;            // 1 = full 2 m grid, 2 = 4 m grid
  const aniso = Math.min(opts.anisotropy, renderer.capabilities.getMaxAnisotropy());
  const loader = new THREE.TextureLoader();
  const detail = makeDetailTexture();
  detail.anisotropy = Math.min(4, aniso);

  const overview = loader.load(`${BASE}overview.jpg`);
  overview.colorSpace = THREE.SRGBColorSpace;
  overview.anisotropy = aniso;
  const rect = new THREE.Vector4(co.x0, co.z0, co.x1 - co.x0, co.z1 - co.z0);
  const matLow = groundMaterial(overview, detail, rect);

  // ---- far scenery: one coarse mesh under everything. It does not write depth, so the
  // detailed sectors (drawn afterwards) always win where they exist.
  {
    const nx = co.nx, nz = co.nz, C = world.coarse;
    const pos = new Float32Array(nx * nz * 3);
    for (let r = 0; r < nz; r++) {
      for (let c = 0; c < nx; c++) {
        const k = r * nx + c;
        pos[k * 3] = co.x0 + c * co.res;
        pos[k * 3 + 1] = C[k] * hs + hoff;
        pos[k * 3 + 2] = co.z0 + r * co.res;
      }
    }
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
    let q = 0;
    for (let r = 0; r < nz - 1; r++) {
      for (let c = 0; c < nx - 1; c++) {
        const a = r * nx + c, b = a + 1, c2 = a + nx, d = c2 + 1;
        idx[q++] = a; idx[q++] = c2; idx[q++] = b;
        idx[q++] = b; idx[q++] = c2; idx[q++] = d;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const mat = groundMaterial(overview, detail, rect);
    mat.depthWrite = false;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = -8;
    group.add(mesh);
    // a wide apron so the horizon is never empty
    const apron = new THREE.Mesh(
      new THREE.CircleGeometry(40000, 48),
      new THREE.MeshLambertMaterial({ color: 0x3f5a3a, depthWrite: false }),
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.set((co.x0 + co.x1) / 2, world.coarseHeight(co.x0, co.z0) - 6, (co.z0 + co.z1) / 2);
    apron.renderOrder = -9;
    group.add(apron);
  }

  // ---- detailed sectors, split into one mesh per orthophoto tile
  const chunks = new Set();
  const indexCache = new Map();
  function indexFor(seg) {
    let a = indexCache.get(seg);
    if (!a) {
      const nv = seg + 1;
      const idx = new Uint16Array(seg * seg * 6);
      let q = 0;
      for (let j = 0; j < seg; j++) {
        for (let i = 0; i < seg; i++) {
          const p = j * nv + i, b = p + 1, c2 = p + nv, d = c2 + 1;
          idx[q++] = p; idx[q++] = c2; idx[q++] = b;
          idx[q++] = b; idx[q++] = c2; idx[q++] = d;
        }
      }
      indexCache.set(seg, (a = new THREE.BufferAttribute(idx, 1)));
    }
    return a;
  }

  function addSector(s) {
    const H = s.H;
    const tile = S / s.div;
    const per = Math.round(tile / res);         // grid cells per tile
    const seg = per / stride, nv = seg + 1;
    const hAt = (c, r) => H[r * hn + c] * hs + hoff;
    s.chunks = [];
    for (let ty = 0; ty < s.div; ty++) {
      for (let tx = 0; tx < s.div; tx++) {
        const pos = new Float32Array(nv * nv * 3);
        const nor = new Float32Array(nv * nv * 3);
        const uv = new Float32Array(nv * nv * 2);
        const x0 = s.x0 + tx * tile, z0 = s.z0 + ty * tile;
        for (let j = 0; j < nv; j++) {
          for (let i = 0; i < nv; i++) {
            const c = tx * per + i * stride, r = ty * per + j * stride;
            const k = j * nv + i;
            pos[k * 3] = x0 + i * stride * res;
            pos[k * 3 + 1] = hAt(c, r);
            pos[k * 3 + 2] = z0 + j * stride * res;
            const cl = Math.max(c - 1, 0), cr = Math.min(c + 1, hn - 1);
            const ru = Math.max(r - 1, 0), rd = Math.min(r + 1, hn - 1);
            const dx = (hAt(cr, r) - hAt(cl, r)) / ((cr - cl) * res);
            const dz = (hAt(c, rd) - hAt(c, ru)) / ((rd - ru) * res);
            const l = Math.hypot(dx, 1, dz);
            nor[k * 3] = -dx / l; nor[k * 3 + 1] = 1 / l; nor[k * 3 + 2] = -dz / l;
            uv[k * 2] = i / seg; uv[k * 2 + 1] = 1 - j / seg;
          }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        geo.setIndex(indexFor(seg));
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, matLow);
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        group.add(mesh);
        const ch = { url: `${BASE}${s.sx}_${s.sz}_${tx}_${ty}.jpg`, mesh, matHi: null, state: 'low', cx: x0 + tile / 2, cz: z0 + tile / 2, gone: false };
        s.chunks.push(ch);
        chunks.add(ch);
      }
    }
  }

  function removeSector(s) {
    for (const ch of s.chunks || []) {
      ch.gone = true;
      chunks.delete(ch);
      group.remove(ch.mesh);
      ch.mesh.geometry.dispose();
      if (ch.matHi) { ch.matHi.map.dispose(); ch.matHi.dispose(); }
    }
    s.chunks = null;
  }

  // ---- hi-res tile streaming around the camera
  let loading = 0;
  const rHi = opts.tileRadius;
  function load(ch) {
    ch.state = 'loading';
    loading++;
    loader.load(ch.url, (tex) => {
      loading--;
      if (ch.gone) { tex.dispose(); return; }
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
        ch.mesh.material = matLow;
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
  return { group, update, addSector, removeSector, pending: () => loading };
}
