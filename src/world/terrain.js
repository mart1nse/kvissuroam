import * as THREE from 'three';
import { sunDirection } from './sky.js';
import { deckTopGeometry } from './decks.js';

const BASE = `${import.meta.env.BASE_URL}data/ortho/`;

const SUN = sunDirection();

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

// mask: per-sector texture (R paved, G openness near walls, B gravel or dirt) with its sector origin
function groundMaterial(map, detail, overview, mask) {
  // overview: sample the map by world position inside the scenery rectangle instead of by uv
  const mat = new THREE.MeshLambertMaterial({ map });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = { value: detail };
    shader.uniforms.uMask = { value: mask ? mask.tex : null };
    shader.uniforms.uSec = { value: mask ? new THREE.Vector3(mask.x0, mask.z0, mask.size) : new THREE.Vector3() };
    shader.uniforms.uSunDir = { value: SUN };
    if (mask) shader.defines = { ...(shader.defines || {}), USE_MASK: '' };
    shader.uniforms.uRect = { value: overview || new THREE.Vector4() };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWxz;\nvarying float vWy;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWxz = position.xz;\nvWy = position.y;');
    const sample = overview
      ? `diffuseColor *= texture2D(map, vec2((vWxz.x - uRect.x) / uRect.z, 1.0 - (vWxz.y - uRect.y) / uRect.w));`
      : '#include <map_fragment>';
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;\nuniform sampler2D uMask;\nuniform vec3 uSec;\nuniform vec3 uSunDir;\nuniform vec4 uRect;\nvarying vec2 vWxz;\nvarying float vWy;\nfloat gWet = 0.0;')
      .replace('#include <map_fragment>', `${sample}
        float dA = texture2D(uDetail, vWxz * 0.9).r;
        float dB = texture2D(uDetail, vWxz * 0.11).r;
        float dist = length(vViewPosition);
        float k = 1.0 - smoothstep(25.0, 90.0, dist);
        diffuseColor.rgb *= mix(1.0, (dA * 0.75 + dB * 0.55) * 1.02, k * 0.85);
        #ifdef USE_MASK
          vec4 mk = texture2D(uMask, (vWxz - uSec.xy) / uSec.z);
          // asphalt: the aerial photo gives the tone and the painted lines, a generated surface gives the grain
          float grain = texture2D(uDetail, vWxz * 2.3).r;
          vec3 asphalt = vec3(0.2, 0.2, 0.225) * (0.55 + 0.6 * grain) * (0.8 + 0.4 * dB);
          float lum = dot(diffuseColor.rgb, vec3(0.33));
          asphalt *= 0.8 + 0.5 * smoothstep(0.45, 0.9, lum);       // keep painted markings and light patches readable
          diffuseColor.rgb = mix(diffuseColor.rgb, asphalt, 0.82 * smoothstep(0.45, 0.6, mk.r));
          // kerb stone where paving meets anything else
          float kerb = smoothstep(0.86, 1.0, mk.r * (1.0 - mk.r) * 4.0) * (1.0 - smoothstep(40.0, 110.0, dist));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.49, 0.5) * (0.8 + 0.3 * grain), kerb * 0.8);
          // gravel and dirt
          vec3 gravel = mix(vec3(0.4, 0.36, 0.31), vec3(0.3, 0.27, 0.24), dB) * (0.6 + 0.7 * grain);
          diffuseColor.rgb = mix(diffuseColor.rgb, gravel, 0.55 * smoothstep(0.45, 0.6, mk.b));
          // grass: blades and clumps on whatever is left
          float soft = (1.0 - smoothstep(0.3, 0.5, mk.r)) * (1.0 - smoothstep(0.3, 0.5, mk.b));
          float blades = texture2D(uDetail, vWxz * vec2(4.3, 1.1)).r * texture2D(uDetail, vWxz.yx * vec2(3.7, 0.9) + 0.37).r;
          float green = smoothstep(0.0, 0.06, diffuseColor.g - max(diffuseColor.r, diffuseColor.b) + 0.03);
          diffuseColor.rgb *= mix(1.0, 0.72 + 1.3 * blades, soft * green * k);
          diffuseColor.rgb *= mix(0.55, 1.0, mk.g);                 // contact shadow along walls
          gWet = mk.r * (0.55 + 0.9 * (dB - 0.5));                  // damp asphalt, patchy
        #endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        #ifdef USE_MASK
          vec3 wV = normalize(cameraPosition - vec3(vWxz.x, vWy, vWxz.y));
          float fres = pow(1.0 - clamp(wV.y, 0.0, 1.0), 5.0);
          vec3 wR = reflect(-wV, vec3(0.0, 1.0, 0.0));
          float sunUp = max(dot(wR, uSunDir), 0.0);
          vec3 skyRef = mix(vec3(0.62, 0.36, 0.78), vec3(1.0, 0.52, 0.45), pow(sunUp, 3.0));
          totalEmissiveRadiance += gWet * (skyRef * fres * 0.32 + vec3(1.0, 0.62, 0.42) * pow(sunUp, 90.0) * 1.1);
        #endif`);
  };
  mat.customProgramCacheKey = () => (overview ? 'ground-overview' : mask ? 'ground-tile-mask' : 'ground-tile');
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
  const xSet = new Set(opts.xTiles ? meta.ortho.x || [] : []);   // tiles that have an extra-sharp version
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
    {
      const sn = meta.surface.n, dn = meta.sdf.n, step = (dn - 1) / sn;
      const dmin = meta.sdf.min, dspan = meta.sdf.max - meta.sdf.min;
      const px = new Uint8Array(sn * sn * 4);
      for (let j = 0; j < sn; j++) {
        for (let i = 0; i < sn; i++) {
          const k = j * sn + i, c = s.S[k];
          const d = dmin + (s.D[Math.round((j + 0.5) * step) * dn + Math.round((i + 0.5) * step)] / 255) * dspan;
          px[k * 4] = c === 1 ? 255 : 0;
          px[k * 4 + 1] = Math.max(0, Math.min(255, Math.round((d / 2.2) * 255)));
          px[k * 4 + 2] = c === 2 || c === 3 ? 255 : 0;
          px[k * 4 + 3] = 255;
        }
      }
      for (const ch of [0, 2]) {            // soften the 1 m steps of the surface grid
        const src = new Uint8Array(sn * sn);
        for (let k = 0; k < sn * sn; k++) src[k] = px[k * 4 + ch];
        for (let j = 1; j < sn - 1; j++) {
          for (let i = 1; i < sn - 1; i++) {
            const k = j * sn + i;
            px[k * 4 + ch] = (src[k] * 4 + (src[k - 1] + src[k + 1] + src[k - sn] + src[k + sn]) * 2
              + src[k - sn - 1] + src[k - sn + 1] + src[k + sn - 1] + src[k + sn + 1]) >> 4;
          }
        }
      }
      const tex = new THREE.DataTexture(px, sn, sn, THREE.RGBAFormat);
      tex.magFilter = tex.minFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      s.mask = { tex, x0: s.x0, z0: s.z0, size: S };
    }
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
        // bridge spans and tunnel lids in this tile share its material
        const dg = deckTopGeometry(world, x0, z0, tile);
        if (dg) {
          const top = new THREE.Mesh(dg, matLow);
          top.receiveShadow = true;
          top.matrixAutoUpdate = false;
          group.add(top);
          mesh.userData.deck = top;
        }
        const id = `${s.sx}_${s.sz}_${tx}_${ty}`;
        const ch = { url: `${BASE}${id}.jpg`, xurl: xSet.has(id) ? `${BASE}x/${id}.jpg` : null, matX: null, xstate: 'none', mesh, mask: s.mask, matHi: null, state: 'low', cx: x0 + tile / 2, cz: z0 + tile / 2, gone: false };
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
      if (ch.mesh.userData.deck) { group.remove(ch.mesh.userData.deck); ch.mesh.userData.deck.geometry.dispose(); }
      if (ch.matHi) { ch.matHi.map.dispose(); ch.matHi.dispose(); }
      if (ch.matX) { ch.matX.map.dispose(); ch.matX.dispose(); }
    }
    s.chunks = null;
    if (s.mask) { s.mask.tex.dispose(); s.mask = null; }
  }

  const setMat = (ch, m) => { ch.mesh.material = m; if (ch.mesh.userData.deck) ch.mesh.userData.deck.material = m; };

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
      ch.matHi = groundMaterial(tex, detail, null, ch.mask);
      setMat(ch, ch.matHi);
      ch.state = 'hi';
    }, undefined, () => { loading--; ch.state = 'failed'; });
  }
  // extra-sharp version of a tile, swapped in only close to the camera
  function loadX(ch) {
    ch.xstate = 'loading';
    loading++;
    loader.load(ch.xurl, (tex) => {
      loading--;
      if (ch.gone || ch.state !== 'hi' || ch.xstate !== 'loading') { tex.dispose(); if (ch.xstate === 'loading') ch.xstate = 'none'; return; }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = aniso;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      ch.matX = groundMaterial(tex, detail, null, ch.mask);
      setMat(ch, ch.matX);
      ch.xstate = 'on';
    }, undefined, () => { loading--; ch.xstate = 'failed'; });
  }
  function dropX(ch) {
    if (ch.matX) { setMat(ch, ch.matHi || matLow); ch.matX.map.dispose(); ch.matX.dispose(); ch.matX = null; }
    if (ch.xstate !== 'failed') ch.xstate = 'none';
  }
  function update(camPos) {
    const want = [];
    for (const ch of chunks) {
      ch.d = Math.hypot(ch.cx - camPos.x, ch.cz - camPos.z);
      if (ch.xurl) {
        if (ch.state === 'hi' && ch.xstate === 'none' && ch.d < 200 && loading < 4) loadX(ch);
        else if (ch.xstate === 'on' && ch.d > 300) dropX(ch);
      }
      if (ch.state === 'low' && ch.d < rHi) want.push(ch);
      else if (ch.state === 'hi' && ch.d > rHi + 260) {
        dropX(ch);
        setMat(ch, matLow);
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
