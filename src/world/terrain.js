import * as THREE from 'three';
import { sunDirection } from './sky.js';
import { deckTopGeometry } from './decks.js';
import { createRoadPainter } from './roadtex.js';

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

// mask: per-sector textures with their sector origin: tex (R paved yards and drives found in the aerial photo,
// G openness near walls), and the painted roads of roadtex.js (cover, tone)
function groundMaterial(map, detail, overview, mask) {
  // overview: sample the map by world position inside the scenery rectangle instead of by uv
  const mat = new THREE.MeshLambertMaterial({ map });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = { value: detail };
    shader.uniforms.uMask = { value: mask ? mask.tex : null };
    shader.uniforms.uRoad = { value: mask ? mask.cover : null };
    shader.uniforms.uTone = { value: mask ? mask.tone : null };
    shader.uniforms.uKerb = { value: mask ? mask.kerb : 0.2 };
    shader.uniforms.uSec = { value: mask ? new THREE.Vector3(mask.x0, mask.z0, mask.size) : new THREE.Vector3() };
    shader.uniforms.uSunDir = { value: SUN };
    if (mask) shader.defines = { ...(shader.defines || {}), USE_MASK: '' };
    shader.uniforms.uRect = { value: overview || new THREE.Vector4() };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSec;\nvarying vec2 vWxz;\nvarying vec2 vSuv;\nvarying float vWy;')
      // the place in the sector's road textures, worked out per vertex, so that phones with lower
      // precision in the fragment shader do not lose centimetres off a world position in thousands of metres
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWxz = position.xz;\nvSuv = (position.xz - uSec.xy) / max(uSec.z, 1.0);\nvWy = position.y;');
    const sample = overview
      ? `diffuseColor *= texture2D(map, vec2((vWxz.x - uRect.x) / uRect.z, 1.0 - (vWxz.y - uRect.y) / uRect.w));`
      : '#include <map_fragment>';
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;\nuniform sampler2D uMask;\nuniform sampler2D uRoad;\nuniform sampler2D uTone;\nuniform float uKerb;\nuniform vec3 uSec;\nuniform vec3 uSunDir;\nuniform vec4 uRect;\nvarying vec2 vWxz;\nvarying vec2 vSuv;\nvarying float vWy;\nfloat gWet = 0.0;')
      .replace('#include <map_fragment>', `${sample}
        float dA = texture2D(uDetail, vWxz * 0.9).r;
        float dB = texture2D(uDetail, vWxz * 0.11).r;
        float dist = length(vViewPosition);
        float k = 1.0 - smoothstep(25.0, 90.0, dist);
        diffuseColor.rgb *= mix(1.0, (dA * 0.75 + dB * 0.55) * 1.02, k * 0.85);
        #ifdef USE_MASK
          vec2 suv = vSuv;
          vec4 mk = texture2D(uMask, suv);
          vec4 rd = texture2D(uRoad, suv);
          vec4 tn = texture2D(uTone, suv);
          // The road texture blurred by a texel: up close it is magnified, and an edge drawn along it,
          // anti-aliased texel by texel, wavered from texel to texel. Four bilinear taps half a texel
          // apart make a smooth 3x3 tent filter, so the road edge and kerb line run straight.
          vec2 tx = 0.5 / vec2(textureSize(uRoad, 0));
          vec4 rdS = 0.25 * (texture2D(uRoad, suv + vec2(tx.x, tx.y)) + texture2D(uRoad, suv + vec2(-tx.x, tx.y))
            + texture2D(uRoad, suv + vec2(tx.x, -tx.y)) + texture2D(uRoad, suv - tx));
          float road = smoothstep(0.4, 0.6, rdS.r);
          float paved = max(road, smoothstep(0.45, 0.65, mk.r));
          float loose = smoothstep(0.4, 0.6, rd.b) * (1.0 - road);
          float stone = smoothstep(0.4, 0.6, tn.b) * road;
          // tarmac: the shade and warmth come from what this road looks like in the aerial photo,
          // the grain is generated, and painted lines and light patches of the photo stay readable
          float grain = texture2D(uDetail, vWxz * 2.3).r;
          float shade = clamp(pow(tn.r * 255.0 / 183.0, 1.25), 0.5, 1.3);
          float warm = (tn.g - 0.5) * 0.8;
          vec3 tint = vec3(1.0 + warm, 1.0, 1.0 - warm);
          // (a tone with blue a little above zero marks newer, smoother tarmac laid by hand: finer grain,
          // and the patches of the photo show through less, src/race/emajoe.js)
          float fine = smoothstep(0.12, 0.22, tn.b) * (1.0 - smoothstep(0.34, 0.4, tn.b));
          float rough = mix((0.6 + 0.55 * grain) * (0.85 + 0.3 * dB), (0.82 + 0.18 * grain) * (0.95 + 0.1 * dB), fine);
          vec3 asphalt = vec3(0.235, 0.228, 0.232) * tint * shade * rough;
          float lum = dot(diffuseColor.rgb, vec3(0.33));
          asphalt *= mix(0.85 + 0.4 * smoothstep(0.45, 0.9, lum), 1.0, fine * 0.8);
          // setts: rows of cut stones with dark joints, each stone its own shade
          vec2 cp = vWxz * vec2(4.6, 7.2);
          cp.x += 0.5 * mod(floor(cp.y), 2.0);
          vec2 ci = floor(cp), cf = fract(cp);
          float ch = fract(sin(dot(ci, vec2(127.1, 311.7))) * 43758.5453);
          float joint = smoothstep(0.0, 0.14, cf.x) * smoothstep(1.0, 0.86, cf.x) * smoothstep(0.0, 0.2, cf.y) * smoothstep(1.0, 0.8, cf.y);
          float nearK = 1.0 - smoothstep(14.0, 50.0, dist);
          vec3 setts = mix(vec3(0.27, 0.25, 0.245), vec3(0.43, 0.39, 0.37), ch) * mix(0.42, 1.0, joint) * (0.8 + 0.3 * grain);
          setts = mix(vec3(0.31, 0.285, 0.275) * (0.85 + 0.3 * dB), setts, nearK) * tint * mix(1.0, shade, 0.6);
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(asphalt, setts, stone), mix(mix(0.82, 0.95, fine), 0.92, stone) * paved);
          // kerb stone along streets
          float kerb = smoothstep(0.42 - uKerb * 0.8, 0.42, rdS.g) * (1.0 - smoothstep(0.42, 0.42 + uKerb * 0.8, rdS.g)) * (1.0 - smoothstep(60.0, 160.0, dist));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.49, 0.49) * (0.8 + 0.3 * grain), kerb * 0.85);
          // gravel and dirt roads: crushed stone, lighter where the wheels run dry
          float pebble = texture2D(uDetail, vWxz * 5.1 + 0.31).r;
          vec3 gravel = mix(vec3(0.42, 0.375, 0.315), vec3(0.3, 0.27, 0.235), dB) * (0.5 + 0.5 * grain + 0.45 * pebble * nearK);
          diffuseColor.rgb = mix(diffuseColor.rgb, gravel, 0.8 * loose);
          // grass: blades and clumps on whatever is left
          float soft = (1.0 - smoothstep(0.3, 0.5, max(rd.r, mk.r))) * (1.0 - smoothstep(0.3, 0.5, rd.b));
          float blades = texture2D(uDetail, vWxz * vec2(4.3, 1.1)).r * texture2D(uDetail, vWxz.yx * vec2(3.7, 0.9) + 0.37).r;
          float green = smoothstep(0.0, 0.06, diffuseColor.g - max(diffuseColor.r, diffuseColor.b) + 0.03);
          diffuseColor.rgb *= mix(1.0, 0.72 + 1.3 * blades, soft * green * k);
          diffuseColor.rgb *= mix(0.55, 1.0, mk.g);                 // contact shadow along walls
          gWet = paved * (1.0 - 0.6 * stone) * (1.0 - 0.5 * fine) * (0.55 + 0.9 * (dB - 0.5));   // damp asphalt, patchy
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

  // Ground mask of a sector, built when the first of its tiles comes close and shared by them.
  const paint = createRoadPainter(world, opts.roadTex || 1024);
  function acquireMask(s) {
    if (s.mask) { s.mask.refs++; return s.mask; }
    const road = paint(s);
    const sn = meta.surface.n, dn = meta.sdf.n, step = (dn - 1) / sn;
    const dmin = meta.sdf.min, dspan = meta.sdf.max - meta.sdf.min;
    const px = new Uint8Array(sn * sn * 4);
    // paving the bake found in the aerial photo, beside what the road data has. Thin slivers of it
    // along a road are the wobble of a 1 m grid, not a yard: an opening removes them.
    const a = new Uint8Array(sn * sn), b = new Uint8Array(sn * sn);
    for (let j = 0; j < sn; j++) for (let i = 0; i < sn; i++) a[j * sn + i] = s.S[j * sn + i] === 1 && !road.hard(i, j) ? 1 : 0;
    for (let j = 1; j < sn - 1; j++) {
      for (let i = 1; i < sn - 1; i++) {
        const k = j * sn + i;
        b[k] = a[k] & a[k - 1] & a[k + 1] & a[k - sn] & a[k + sn];
      }
    }
    for (let j = 1; j < sn - 1; j++) {
      for (let i = 1; i < sn - 1; i++) {
        const k = j * sn + i;
        a[k] = b[k] | b[k - 1] | b[k + 1] | b[k - sn] | b[k + sn];
      }
    }
    for (let j = 0; j < sn; j++) {
      for (let i = 0; i < sn; i++) {
        const k = j * sn + i;
        const d = dmin + (s.D[Math.round((j + 0.5) * step) * dn + Math.round((i + 0.5) * step)] / 255) * dspan;
        px[k * 4] = a[k] ? 255 : 0;
        px[k * 4 + 1] = Math.max(0, Math.min(255, Math.round((d / 2.2) * 255)));
        px[k * 4 + 3] = 255;
      }
    }
    {                                       // soften the 1 m steps of the surface grid
      const src = new Uint8Array(sn * sn);
      for (let k = 0; k < sn * sn; k++) src[k] = px[k * 4];
      for (let j = 1; j < sn - 1; j++) {
        for (let i = 1; i < sn - 1; i++) {
          const k = j * sn + i;
          px[k * 4] = (src[k] * 4 + (src[k - 1] + src[k + 1] + src[k - sn] + src[k + sn]) * 2
            + src[k - sn - 1] + src[k - sn + 1] + src[k + sn - 1] + src[k + sn + 1]) >> 4;
        }
      }
    }
    const tex = new THREE.DataTexture(px, sn, sn, THREE.RGBAFormat);
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    const size = opts.roadTex || 1024;
    s.mask = { tex, cover: road.cover, tone: road.tone, kerb: Math.min(0.3, (0.16 * size) / S), x0: s.x0, z0: s.z0, size: S, refs: 1 };
    return s.mask;
  }
  function releaseMask(s) {
    const m = s.mask;
    if (!m || --m.refs > 0) return;
    m.tex.dispose(); m.cover.dispose(); m.tone.dispose();
    s.mask = null;
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
        const ch = { url: `${BASE}${id}.jpg`, xurl: xSet.has(id) ? `${BASE}x/${id}.jpg` : null, matX: null, xstate: 'none', mesh, sector: s, mask: null, matHi: null, state: 'low', cx: x0 + tile / 2, cz: z0 + tile / 2, gone: false };
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
    if (s.mask) { s.mask.refs = 1; releaseMask(s); }
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
      ch.mask = acquireMask(ch.sector);
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
        releaseMask(ch.sector);
        ch.mask = null;
        ch.state = 'low';
      }
    }
    // nearest first, a few at a time
    want.sort((p, q) => p.d - q.d);
    for (const ch of want) { if (loading >= 4) break; load(ch); }
  }
  return { group, update, addSector, removeSector, pending: () => loading };
}
