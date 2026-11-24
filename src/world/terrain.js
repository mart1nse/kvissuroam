import * as THREE from 'three';
import { sunDirection } from './sky.js';
import { deckTopGeometry } from './decks.js';
import { createRoadPainter } from './roadtex.js';
import { jobs } from '../jobs.js';

const BASE = `${import.meta.env.BASE_URL}data/ortho/`;

const SUN = sunDirection();

// Does this browser turn a picture over when asked to while unpacking it (createImageBitmap with
// imageOrientation 'flipY')? Old Safari takes the option and ignores it, and the ground would lie upside down.
let flipOk = null;
function bitmapsFlip() {
  if (flipOk) return flipOk;
  flipOk = (async () => {
    try {
      if (typeof createImageBitmap !== 'function') return false;
      const cv = document.createElement('canvas'); cv.width = 1; cv.height = 2;
      const c = cv.getContext('2d'); c.fillStyle = '#f00'; c.fillRect(0, 0, 1, 1); c.fillStyle = '#00f'; c.fillRect(0, 1, 1, 1);
      const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
      const bmp = await createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      const out = document.createElement('canvas'); out.width = 1; out.height = 2;
      const o = out.getContext('2d', { willReadFrequently: true }); o.drawImage(bmp, 0, 0);
      const px = o.getImageData(0, 0, 1, 2).data;
      bmp.close && bmp.close();
      return px[2] > 200 && px[0] < 50 && px[4] > 200 && px[6] < 50;      // blue on top now, red below
    } catch { return false; }
  })();
  return flipOk;
}

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

// One small tile of gravel shared by every gravel and dirt road (Martin, 20 Nov: "a bit beige'ish, small rocks
// and stones, very little"), 2.4 m a side, built once as data: no canvas, about 350 KB on the graphics card
// with its mipmaps, on phones too. R fine grain, G a few stones lying everywhere, B more stones, for the loose
// strips (the middle and edges of a one-car road, away from the wheel tracks). 128 is neither lighter nor darker.
export const GRAVEL_TILE = 2.4;
let gravelTex = null;
function gravelTexture() {
  if (gravelTex) return gravelTex;
  const n = 256;
  const px = new Uint8Array(n * n * 4);
  let seed = 7654321;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  // fine grain: white noise over two softer octaves, all wrapping
  const oct = (c) => {
    const m = n / c, v = new Float32Array(c * c);
    for (let i = 0; i < c * c; i++) v[i] = rnd();
    return (x, y) => {
      const fx = x / m, fy = y / m, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const g = (i, j) => v[((j + c) % c) * c + ((i + c) % c)];
      const a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * tx, b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * tx;
      return a + (b - a) * ty;
    };
  };
  const o1 = oct(64), o2 = oct(16);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      px[i] = Math.max(0, Math.min(255, Math.round(255 * (0.5 + 0.28 * (rnd() - 0.5) + 0.3 * (o1(x, y) - 0.5) + 0.25 * (o2(x, y) - 0.5)))));
      px[i + 1] = px[i + 2] = 128;
      px[i + 3] = 255;
    }
  }
  // stones, 1 to 3.5 cm across: mostly pale limestone, some darker; lit from the top left with a shadow below right
  const stones = (ch, count) => {
    for (let k = 0; k < count; k++) {
      const cx = rnd() * n, cy = rnd() * n, r = 0.9 + Math.pow(rnd(), 2.2) * 2.6, ang = rnd() * Math.PI;
      const el = 0.65 + rnd() * 0.35, ca = Math.cos(ang), sa = Math.sin(ang);
      const tone = rnd() < 0.75 ? 175 + rnd() * 70 : 70 + rnd() * 40;
      const R = Math.ceil(r + 2);
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const x = (Math.floor(cx) + dx + n) % n, y = (Math.floor(cy) + dy + n) % n;
          const ux = Math.floor(cx) + dx + 0.5 - cx, uy = Math.floor(cy) + dy + 0.5 - cy;
          const p = (ux * ca + uy * sa) / r, q = (-ux * sa + uy * ca) / (r * el);
          const d = Math.hypot(p, q);
          const i = (y * n + x) * 4 + ch;
          if (d < 1) {
            const lit = 1 + 0.25 * (-ux - uy) / (r * 1.4);          // rounded: lighter towards the light
            px[i] = Math.max(0, Math.min(255, Math.round(tone * lit * (1 - 0.15 * d * d))));
          } else {
            // shadow, offset down and right
            const sx = ux - 0.9, sy = uy - 0.9;
            const ds = Math.hypot((sx * ca + sy * sa) / r, (-sx * sa + sy * ca) / (r * el));
            if (ds < 1.05 && px[i] === 128) px[i] = 92;
          }
        }
      }
    }
  };
  stones(1, 140);
  stones(2, 420);
  const t = new THREE.DataTexture(px, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return (gravelTex = t);
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
    shader.uniforms.uGravel = { value: mask ? gravelTexture() : null };
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
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;\nuniform sampler2D uMask;\nuniform sampler2D uRoad;\nuniform sampler2D uTone;\nuniform sampler2D uGravel;\nuniform float uKerb;\nuniform vec3 uSec;\nuniform vec3 uSunDir;\nuniform vec4 uRect;\nvarying vec2 vWxz;\nvarying vec2 vSuv;\nvarying float vWy;\nfloat gWet = 0.0;')
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
          // (further away the texture's smaller copies blur a narrow road into the grass: a lower threshold keeps it whole)
          float lfar = smoothstep(40.0, 160.0, length(vViewPosition));
          float loose = smoothstep(0.44 - 0.2 * lfar, 0.56 - 0.18 * lfar, rd.b) * (1.0 - road);
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
          // gravel and dirt roads: beige crushed stone with a few small stones lying on it, and wheel tracks
          // (the road's width is in the tone, roadtex.js): darker, packed smooth, hardly a stone on them; looser
          // stone between them and along the edges. One pair on a road one car wide, a fainter pair in each
          // lane of a wider one.
          float gb = tn.b * 255.0, gw = gb / 2.0;
          float rutted = smoothstep(2.5, 4.0, gb) * (1.0 - smoothstep(19.0, 21.0, gb));
          float lanes = smoothstep(5.0, 5.4, gw);
          float fromMid = (1.0 - rd.b) * gw + 0.06 * (dB - 0.5);
          float fromRut = mix(abs(fromMid - 0.8), abs(abs(fromMid - gw * 0.25) - 0.8), lanes);
          float rut = 0.55 * rutted * mix(1.0, 0.6, lanes) * (1.0 - smoothstep(0.17, 0.36, fromRut)) * (1.0 - smoothstep(60.0, 140.0, dist));
          // (0.55: the tracks on gravel and earth half as strong as they were, Martin 23 Nov 20:15 "reduce the effect
          // of tyre marks on gravel")
          vec4 gA = texture2D(uGravel, vWxz / ${GRAVEL_TILE.toFixed(2)});
          vec4 gB = texture2D(uGravel, mat2(0.8, 0.6, -0.6, 0.8) * vWxz / 3.13 + 0.37);
          float gGrain = mix(gA.r, gB.r, 0.45);
          float gStone = (1.0 - rut) * nearK;
          float gLit = mix(1.0, gA.g / 0.5, gStone * 0.9) * mix(1.0, gB.b / 0.5, gStone * (1.0 - rut) * 0.75);
          vec3 gravel = vec3(0.37, 0.32, 0.155) * mix(0.86, 1.1, dB) * (0.72 + 0.56 * mix(gGrain, 0.5, rut * 0.6));
          gravel *= mix(1.0, gLit, k);
          gravel = mix(gravel, vec3(0.27, 0.235, 0.13) * (0.9 + 0.2 * gGrain), rut * 0.7);
          // bare earth roads (roadtex.js marks them in the tone's red): darker brown soil, hardly a stone, the
          // wheel tracks darker still (very little blue: the violet sky light adds plenty)
          float dirt = 1.0 - smoothstep(0.06, 0.12, tn.r);
          vec3 earth = vec3(0.2, 0.135, 0.03) * mix(0.86, 1.1, dB) * (0.76 + 0.48 * gGrain) * mix(1.0, gLit, k * 0.25);
          earth = mix(earth, vec3(0.12, 0.08, 0.018) * (0.9 + 0.2 * gGrain), rut * 0.75);
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(gravel, earth, dirt), 0.88 * loose);
          // grass: blades and clumps on whatever is left
          float soft = (1.0 - smoothstep(0.3, 0.5, max(rd.r, mk.r))) * (1.0 - smoothstep(0.38, 0.5, rd.b));
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

  // ---- far scenery: a coarse mesh under everything. It does not write depth, so the
  // detailed sectors (drawn afterwards) always win where they exist.
  // (In tiles of 2 km, so that what is behind the camera is not drawn; at the lower graphics levels every
  // second grid line only: as one mesh it was over a million triangles in every frame, most of the
  // graphics chip's work on a laptop with built-in graphics, Martin 20 Nov. setCoarse picks the grid.)
  const coarseMat = groundMaterial(overview, detail, rect);
  coarseMat.depthWrite = false;
  const coarseSets = new Map();                  // grid step (1 or 2) -> its tiles
  let coarseNrm = null;
  function coarseTiles(step) {
    const nx = co.nx, nz = co.nz, C = world.coarse;
    if (!coarseNrm) {
      // the normals of the whole grid, worked out the way the single mesh had them, so tiles meet without seams
      const pos = new Float32Array(nx * nz * 3);
      for (let r = 0; r < nz; r++) for (let c = 0; c < nx; c++) {
        const k = r * nx + c;
        pos[k * 3] = co.x0 + c * co.res; pos[k * 3 + 1] = C[k] * hs + hoff; pos[k * 3 + 2] = co.z0 + r * co.res;
      }
      const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
      let q = 0;
      for (let r = 0; r < nz - 1; r++) for (let c = 0; c < nx - 1; c++) {
        const a = r * nx + c, b = a + 1, c2 = a + nx, d = c2 + 1;
        idx[q++] = a; idx[q++] = c2; idx[q++] = b;
        idx[q++] = b; idx[q++] = c2; idx[q++] = d;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.computeVertexNormals();
      coarseNrm = g.attributes.normal.array;
    }
    const T = 64, tiles = [];                    // grid cells per tile side (64 x 32 m = 2 km)
    for (let r0 = 0; r0 < nz - 1; r0 += T) for (let c0 = 0; c0 < nx - 1; c0 += T) {
      const cs = [], rs = [];
      const c1 = Math.min(nx - 1, c0 + T), r1 = Math.min(nz - 1, r0 + T);
      for (let c = c0; c < c1; c += step) cs.push(c);
      cs.push(c1);
      for (let r = r0; r < r1; r += step) rs.push(r);
      rs.push(r1);
      const w = cs.length, h = rs.length;
      const pos = new Float32Array(w * h * 3), nrm = new Float32Array(w * h * 3);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const k = rs[j] * nx + cs[i], o = (j * w + i) * 3;
        pos[o] = co.x0 + cs[i] * co.res; pos[o + 1] = C[k] * hs + hoff; pos[o + 2] = co.z0 + rs[j] * co.res;
        nrm[o] = coarseNrm[k * 3]; nrm[o + 1] = coarseNrm[k * 3 + 1]; nrm[o + 2] = coarseNrm[k * 3 + 2];
      }
      const idx = new Uint16Array((w - 1) * (h - 1) * 6);
      let q = 0;
      for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
        const a = j * w + i, b = a + 1, c2 = a + w, d = c2 + 1;
        idx[q++] = a; idx[q++] = c2; idx[q++] = b;
        idx[q++] = b; idx[q++] = c2; idx[q++] = d;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, coarseMat);
      mesh.matrixAutoUpdate = false;
      mesh.renderOrder = -8;
      mesh.visible = false;
      group.add(mesh);
      tiles.push(mesh);
    }
    return tiles;
  }
  let coarseStep = 0;
  function setCoarse(step) {
    if (step === coarseStep) return;
    if (!coarseSets.has(step)) coarseSets.set(step, coarseTiles(step));
    for (const [k, tiles] of coarseSets) for (const m of tiles) m.visible = k === step;
    coarseStep = step;
  }
  setCoarse(opts.coarseStep || 1);
  {
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
      // (a whole sector as one tile at full detail is 321 x 321 points, more than a 16-bit index can
      // count: the numbers wrapped round, one row of ground went missing and a sheet of long thin
      // triangles hung across the tile, Martin 22 Nov at the Vasula crossroads)
      const idx = nv * nv > 65535 ? new Uint32Array(seg * seg * 6) : new Uint16Array(seg * seg * 6);
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
  // The same tile drawn coarser far off (Martin 2026-11-24: lag at the end of Emajõe in a race. Looking back across
  // the river the view held the most ground of the lap, squares of 51 thousand triangles each drawn whole out to
  // 1.5 km). A block of B by B cells is two triangles; along the tile's edges a block takes every point of the edge
  // (a fan round its middle), so it meets a neighbour drawn at any detail without a crack.
  const lodCache = new Map();
  function lodIndex(seg, B) {
    if (B === 1 || seg % B) return indexFor(seg);
    const key = `${seg}/${B}`;
    let a = lodCache.get(key);
    if (a) return a;
    const nv = seg + 1, v = (i, j) => j * nv + i, out = [];
    for (let j0 = 0; j0 < seg; j0 += B) for (let i0 = 0; i0 < seg; i0 += B) {
      const i1 = i0 + B, j1 = j0 + B;
      const top = j0 === 0, bot = j1 === seg, left = i0 === 0, right = i1 === seg;
      if (!top && !bot && !left && !right) { out.push(v(i0, j0), v(i0, j1), v(i1, j0), v(i1, j0), v(i0, j1), v(i1, j1)); continue; }
      // round the block: down its left side, along its bottom, up its right side, back along its top
      const ring = [];
      for (let j = j0; j < j1; j += left ? 1 : B) ring.push(v(i0, j));
      for (let i = i0; i < i1; i += bot ? 1 : B) ring.push(v(i, j1));
      for (let j = j1; j > j0; j -= right ? 1 : B) ring.push(v(i1, j));
      for (let i = i1; i > i0; i -= top ? 1 : B) ring.push(v(i, j0));
      const m = v(i0 + B / 2, j0 + B / 2);
      for (let k = 0; k < ring.length; k++) out.push(m, ring[k], ring[(k + 1) % ring.length]);
    }
    a = new THREE.BufferAttribute(nv * nv > 65535 ? new Uint32Array(out) : new Uint16Array(out), 1);
    lodCache.set(key, a);
    return a;
  }
  const LOD2 = 600, LOD4 = 1100;          // metres from a tile's middle (its near edge some 230 m nearer): blocks of 2, then of 4 (a little either way: no flicker)

  // Ground mask of a sector, built when the first of its tiles comes close and shared by them.
  const paint = createRoadPainter(world, opts.roadTex || 1024);
  // (the loops over the grid are plain functions: inside a generator the browser runs such loops at half speed)
  // paving the bake found in the aerial photo, beside what the road data has. Thin slivers of it
  // along a road are the wobble of a 1 m grid, not a yard: an opening removes them.
  // (each pass takes the rows j0 to j1, so that maskSteps can stop between bands of rows)
  const BAND = 64;
  function pavingRows(s, road, sn, a, j0, j1) {
    for (let j = j0; j < j1; j++) for (let i = 0; i < sn; i++) a[j * sn + i] = s.S[j * sn + i] === 1 && !road.hard(i, j) ? 1 : 0;
  }
  function erodeRows(sn, a, b, j0, j1) {
    for (let j = Math.max(1, j0); j < Math.min(sn - 1, j1); j++) {
      for (let i = 1; i < sn - 1; i++) {
        const k = j * sn + i;
        b[k] = a[k] & a[k - 1] & a[k + 1] & a[k - sn] & a[k + sn];
      }
    }
  }
  function dilateRows(sn, a, b, j0, j1) {
    for (let j = Math.max(1, j0); j < Math.min(sn - 1, j1); j++) {
      for (let i = 1; i < sn - 1; i++) {
        const k = j * sn + i;
        a[k] = b[k] | b[k - 1] | b[k + 1] | b[k - sn] | b[k + sn];
      }
    }
  }
  function pixelRows(s, a, sn, px, j0, j1) {
    const dn = meta.sdf.n, step = (dn - 1) / sn;
    const dmin = meta.sdf.min, dspan = meta.sdf.max - meta.sdf.min;
    for (let j = j0; j < j1; j++) {
      for (let i = 0; i < sn; i++) {
        const k = j * sn + i;
        const d = dmin + (s.D[Math.round((j + 0.5) * step) * dn + Math.round((i + 0.5) * step)] / 255) * dspan;
        px[k * 4] = a[k] ? 255 : 0;
        px[k * 4 + 1] = Math.max(0, Math.min(255, Math.round((d / 2.2) * 255)));
        px[k * 4 + 3] = 255;
      }
    }
  }
  // soften the 1 m steps of the surface grid
  function softenRows(sn, px, src, j0, j1) {
    for (let j = Math.max(1, j0); j < Math.min(sn - 1, j1); j++) {
      for (let i = 1; i < sn - 1; i++) {
        const k = j * sn + i;
        px[k * 4] = (src[k] * 4 + (src[k - 1] + src[k + 1] + src[k - sn] + src[k + sn]) * 2
          + src[k - sn - 1] + src[k - sn + 1] + src[k + sn - 1] + src[k + sn + 1]) >> 4;
      }
    }
  }
  // (in steps: painting the roads and the passes over the grid are 40 ms a sector together. `gone` says the
  // tile that asked has been unloaded: then nothing is kept and null comes back)
  function* maskSteps(s, gone = () => false) {
    if (s.mask) { s.mask.refs++; return s.mask; }
    const road = yield* paint.steps(s);
    yield;
    if (gone()) { road.cover.dispose(); road.tone.dispose(); return null; }
    if (s.mask) { road.cover.dispose(); road.tone.dispose(); s.mask.refs++; return s.mask; }
    const sn = meta.surface.n;
    // (the passes over the grid a band of rows at a time, stopping between bands when the step has grown long:
    // as two steps they were 100 to 150 ms each on an old computer, see jobs.late)
    const a = new Uint8Array(sn * sn), b = new Uint8Array(sn * sn), px = new Uint8Array(sn * sn * 4);
    const lost = () => { if (!gone()) return false; road.cover.dispose(); road.tone.dispose(); return true; };
    for (let j = 0; j < sn; j += BAND) { pavingRows(s, road, sn, a, j, Math.min(sn, j + BAND)); if (jobs.late()) { yield; if (lost()) return null; } }
    for (let j = 0; j < sn; j += BAND) { erodeRows(sn, a, b, j, j + BAND); if (jobs.late()) { yield; if (lost()) return null; } }
    for (let j = 0; j < sn; j += BAND) { dilateRows(sn, a, b, j, j + BAND); if (jobs.late()) { yield; if (lost()) return null; } }
    yield;
    if (lost()) return null;
    if (s.mask) { road.cover.dispose(); road.tone.dispose(); s.mask.refs++; return s.mask; }
    for (let j = 0; j < sn; j += BAND) { pixelRows(s, a, sn, px, j, Math.min(sn, j + BAND)); if (jobs.late()) { yield; if (lost()) return null; } }
    const src = new Uint8Array(sn * sn);
    for (let k = 0; k < sn * sn; k++) src[k] = px[k * 4];
    for (let j = 0; j < sn; j += BAND) { softenRows(sn, px, src, j, j + BAND); if (jobs.late()) { yield; if (lost()) return null; } }
    if (s.mask) { road.cover.dispose(); road.tone.dispose(); s.mask.refs++; return s.mask; }
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

  // the ground of a sector, a tile at a time (each `yield` is a place to stop until the next frame: see jobs.js)
  function* addSectorSteps(s) {
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
            const l = Math.sqrt(dx * dx + 1 + dz * dz);
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
        // raised pavements on top of the ground (world.addBump with a top): the same look, 10 cm up
        const kt = world.bumpTops ? world.bumpTops(x0, z0, tile) : null;
        if (kt) {
          const kuv = new Float32Array((kt.length / 3) * 2);
          for (let k = 0, q = 0; k < kt.length; k += 3, q += 2) { kuv[q] = (kt[k] - x0) / tile; kuv[q + 1] = 1 - (kt[k + 2] - z0) / tile; }
          const kg = new THREE.BufferGeometry();
          kg.setAttribute('position', new THREE.Float32BufferAttribute(kt, 3));
          kg.setAttribute('uv', new THREE.BufferAttribute(kuv, 2));
          kg.computeVertexNormals();
          const km = new THREE.Mesh(kg, matLow);
          km.receiveShadow = true;
          km.matrixAutoUpdate = false;
          group.add(km);
          mesh.userData.kerb = km;
        }
        const id = `${s.sx}_${s.sz}_${tx}_${ty}`;
        const ch = { seg, B: 1, url: `${BASE}${id}.jpg`, xurl: xSet.has(id) ? `${BASE}x/${id}.jpg` : null, matX: null, xstate: 'none', mesh, sector: s, mask: null, matHi: null, state: 'low', cx: x0 + tile / 2, cz: z0 + tile / 2, gone: false };
        s.chunks.push(ch);
        chunks.add(ch);
        yield;
        if (s.chunks === null || s.H !== H) return;        // unloaded meanwhile
      }
    }
  }
  function addSector(s) { jobs.run(addSectorSteps(s)); }

  function removeSector(s) {
    for (const ch of s.chunks || []) {
      ch.gone = true;
      chunks.delete(ch);
      group.remove(ch.mesh);
      ch.mesh.geometry.dispose();
      if (ch.mesh.userData.deck) { group.remove(ch.mesh.userData.deck); ch.mesh.userData.deck.geometry.dispose(); }
      if (ch.mesh.userData.kerb) { group.remove(ch.mesh.userData.kerb); ch.mesh.userData.kerb.geometry.dispose(); }
      if (ch.matHi) { ch.matHi.map.dispose(); ch.matHi.dispose(); }
      if (ch.matX) { ch.matX.map.dispose(); ch.matX.dispose(); }
    }
    s.chunks = null;
    if (s.mask) { s.mask.refs = 1; releaseMask(s); }
  }

  const setMat = (ch, m) => { ch.mesh.material = m; if (ch.mesh.userData.deck) ch.mesh.userData.deck.material = m; if (ch.mesh.userData.kerb) ch.mesh.userData.kerb.material = m; };

  // ---- hi-res tile streaming around the camera
  // A photo tile for the ground. Where the browser can, the picture is unpacked away from the game's own
  // thread (createImageBitmap) and arrives ready for the graphics card; a plain image is unpacked in the
  // frame that first draws it, 10 to 30 ms a tile, and tiles come several at a time when driving fast.
  function loadPhoto(url, done, fail) {
    const dress = (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = aniso;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      return tex;
    };
    const plain = () => loader.load(url, (tex) => done(dress(tex)), undefined, fail);
    bitmapsFlip().then((ok) => {
      // (nobody driving, or frames too slow to matter: the plain way, which takes fewer turns of the page)
      if (!ok || !jobs.live) { plain(); return; }
      fetch(url).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then((blob) => createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }))
        .then((bmp) => {
          const tex = new THREE.Texture(bmp);
          tex.flipY = false;                         // turned over while unpacking: an image bitmap cannot be turned later
          tex.needsUpdate = true;
          tex.addEventListener('dispose', () => bmp.close && bmp.close());
          done(dress(tex));
        }, () => plain());
    });
  }
  let loading = 0;
  const rHi = opts.tileRadius;
  function load(ch) {
    ch.state = 'loading';
    loading++;
    loadPhoto(ch.url, (tex) => {
      loading--;
      jobs.add(function* () {
        if (ch.gone) { tex.dispose(); return; }
        const mask = yield* maskSteps(ch.sector, () => ch.gone);
        if (!mask || ch.gone) { tex.dispose(); return; }
        ch.mask = mask;
        // (each picture goes to the graphics card in a frame of its own)
        for (const t of [tex, mask.tex, mask.cover, mask.tone]) {
          jobs.upload(t);
          yield;
          if (ch.gone) { tex.dispose(); return; }
        }
        ch.matHi = groundMaterial(tex, detail, null, ch.mask);
        setMat(ch, ch.matHi);
        ch.state = 'hi';
      }, 'ground tile');
    }, () => { loading--; ch.state = 'failed'; });
  }
  // extra-sharp version of a tile, swapped in only close to the camera
  function loadX(ch) {
    ch.xstate = 'loading';
    loading++;
    loadPhoto(ch.xurl, (tex) => {
      loading--;
      jobs.add(() => {
        if (ch.gone || ch.state !== 'hi' || ch.xstate !== 'loading') { tex.dispose(); if (ch.xstate === 'loading') ch.xstate = 'none'; return; }
        jobs.upload(tex);
        ch.matX = groundMaterial(tex, detail, null, ch.mask);
        setMat(ch, ch.matX);
        ch.xstate = 'on';
      }, 'sharp tile');
    }, () => { loading--; ch.xstate = 'failed'; });
  }
  function dropX(ch) {
    if (ch.matX) { setMat(ch, ch.matHi || matLow); ch.matX.map.dispose(); ch.matX.dispose(); ch.matX = null; }
    if (ch.xstate !== 'failed') ch.xstate = 'none';
  }
  function update(camPos) {
    const want = [];
    for (const ch of chunks) {
      ch.d = Math.hypot(ch.cx - camPos.x, ch.cz - camPos.z);
      const k = ch.B === 1 ? (ch.d > LOD2 + 30 ? 2 : 1) : ch.B === 2 ? (ch.d < LOD2 - 30 ? 1 : ch.d > LOD4 + 30 ? 4 : 2) : ch.d < LOD4 - 30 ? 2 : 4;
      if (k !== ch.B) { ch.B = k; ch.mesh.geometry.setIndex(lodIndex(ch.seg, k)); }
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
  return { group, update, addSector, addSectorSteps, removeSector, setCoarse, pending: () => loading };
}
