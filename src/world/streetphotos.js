// Street-level photos (Mapillary, CC BY-SA) projected back onto the world.
//
// Each baked photo comes with the pose and lens of the camera that took it. While the game camera
// is close to one of those poses, the frame is rendered to a texture with depth, and a full-screen
// pass looks up every pixel's world position in the two nearest photos and paints it with what the
// real camera saw there. At a photo's own viewpoint the result is the photo itself, whatever the
// accuracy of the geometry underneath; between viewpoints the game geometry carries the picture.
import * as THREE from 'three';

const STRETCHES = ['tallinna'];
const CAM_HEIGHT = 1.3;     // dashcam above the road, m
const BEHIND = 4;           // prefer the photo taken this far behind the game camera: it covers the road in front of us
const CACHE = 14;

const vert = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const frag = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene, tDepth, tA, tB;
uniform mat4 uInvProj, uCamWorld;
uniform float uExposure, uMix;
uniform vec3 uPosA, uPosB;
uniform mat3 uRotA, uRotB;          // rows: camera right, down, forward
uniform vec4 uLensA, uLensB;        // focal, k1, k2, fisheye
uniform vec3 uShapeA, uShapeB;      // aspect, bonnet line, weight

vec3 aces(vec3 color) {             // same curve as THREE.ACESFilmicToneMapping
  const mat3 inM = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 outM = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  color *= uExposure / 0.6;
  color = inM * color;
  vec3 a = color * (color + 0.0245786) - 0.000090537;
  vec3 b = color * (0.983729 * color + 0.4329510) + 0.238081;
  return clamp(outM * (a / b), 0.0, 1.0);
}

vec4 photo(sampler2D tex, vec3 world, vec3 pos, mat3 rot, vec4 lens, vec3 shape) {
  vec3 p = rot * (world - pos);
  if (p.z < 0.2 || shape.z <= 0.0) return vec4(0.0);
  vec2 n;
  if (lens.w > 0.5) {
    float l = max(length(p.xy), 1e-5), th = atan(l, p.z), t2 = th * th;
    n = p.xy / l * th * (1.0 + t2 * (lens.y + lens.z * t2));
  } else {
    n = p.xy / p.z;
    float r2 = dot(n, n);
    if (r2 > 3.0) return vec4(0.0);
    n *= 1.0 + r2 * (lens.y + lens.z * r2);
  }
  vec2 st = vec2(n.x * lens.x + 0.5, n.y * lens.x * shape.x + 0.5);
  float m = smoothstep(0.0, 0.05, st.x) * smoothstep(1.0, 0.95, st.x)
          * smoothstep(0.0, 0.04, st.y) * smoothstep(shape.y, shape.y - 0.07, st.y);
  if (m <= 0.0) return vec4(0.0);
  return vec4(texture2D(tex, vec2(st.x, 1.0 - st.y)).rgb, m * shape.z);
}

void main() {
  float depth = texture2D(tDepth, vUv).x;
  vec3 scene = aces(texture2D(tScene, vUv).rgb);
  vec4 view = uInvProj * vec4(vUv * 2.0 - 1.0, min(depth, 0.99999) * 2.0 - 1.0, 1.0);
  vec3 world = (uCamWorld * vec4(view.xyz / view.w, 1.0)).xyz;
  if (depth > 0.99999) world = uCamWorld[3].xyz + normalize(world - uCamWorld[3].xyz) * 3000.0;   // sky
  vec4 a = photo(tA, world, uPosA, uRotA, uLensA, uShapeA);
  vec4 b = photo(tB, world, uPosB, uRotB, uLensB, uShapeB);
  float w = a.a + b.a;
  vec3 col = scene;
  if (w > 0.0) col = mix(scene, (a.rgb * a.a + b.rgb * b.a) / w, uMix * clamp(max(a.a, b.a) * 2.5, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
  gl_FragDepth = depth;
  #include <colorspace_fragment>
}`;

export function createStreetPhotos(renderer, world) {
  const frames = [];
  const cache = new Map();
  const loader = new THREE.TextureLoader();
  const blank = new THREE.Texture();
  let rt = null, mix = 0, cur = null, credit = [];

  const lens = () => new THREE.Vector4();
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: true, toneMapped: false,
    uniforms: {
      tScene: { value: null }, tDepth: { value: null }, tA: { value: blank }, tB: { value: blank },
      uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
      uExposure: { value: 1 }, uMix: { value: 0 },
      uPosA: { value: new THREE.Vector3() }, uPosB: { value: new THREE.Vector3() },
      uRotA: { value: new THREE.Matrix3() }, uRotB: { value: new THREE.Matrix3() },
      uLensA: { value: lens() }, uLensB: { value: lens() },
      uShapeA: { value: new THREE.Vector3() }, uShapeB: { value: new THREE.Vector3() },
    },
  });
  mat.depthFunc = THREE.AlwaysDepth;
  mat.depthTest = true;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCam = new THREE.Camera();

  // the car's real shadow is under the photo, so it gets a soft stand-in
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 8, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 5.6),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, toneMapped: false }));
  blob.layers.set(1);
  blob.renderOrder = -1;
  let blobAdded = false;

  const label = document.createElement('a');
  label.id = 'photo-credit';
  label.target = '_blank';
  label.rel = 'noopener';
  label.style.cssText = 'position:fixed;left:50%;bottom:6px;transform:translateX(-50%);font:10px/1.2 system-ui,sans-serif;'
    + 'color:#fff;opacity:0;transition:opacity .4s;text-shadow:0 0 3px #000;z-index:5;text-decoration:none;white-space:nowrap';
  document.body.appendChild(label);

  async function load() {
    for (const name of STRETCHES) {
      try {
        const d = await (await fetch(`data/mly/${name}.json`)).json();
        let prev = null;
        for (const f of d.frames) {
          f.fwdX = f.r[6]; f.fwdZ = f.r[8];
          const h = Math.hypot(f.fwdX, f.fwdZ) || 1;
          f.fwdX /= h; f.fwdZ /= h;
          f.prev = prev && prev.seq === f.seq && Math.hypot(prev.x - f.x, prev.z - f.z) < 40 ? prev : null;
          if (f.prev) f.prev.next = f;
          frames.push(f);
          prev = f;
        }
        credit = [...new Set([...credit, ...d.credit])];
      } catch { /* stretch missing: play without it */ }
    }
  }

  function texture(f) {
    let e = cache.get(f.id);
    if (!e) {
      e = { tex: null, fade: 0, used: 0 };
      cache.set(f.id, e);
      loader.load(`data/mly/img/${f.id}.jpg`, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.generateMipmaps = false;
        t.minFilter = THREE.LinearFilter;
        e.tex = t;
      });
    }
    e.used = performance.now();
    return e;
  }

  function trim() {
    if (cache.size <= CACHE) return;
    const old = [...cache.entries()].sort((p, q) => p[1].used - q[1].used).slice(0, cache.size - CACHE);
    for (const [id, e] of old) { e.tex?.dispose(); cache.delete(id); }
  }

  const fwd = new THREE.Vector3();
  function setPhoto(suffix, f, weight, dt) {
    const u = mat.uniforms;
    if (!f) { u['uShape' + suffix].value.z = 0; return; }
    const e = texture(f);
    if (!e.tex) { u['uShape' + suffix].value.z = 0; return; }
    e.fade = Math.min(1, e.fade + dt * 4);
    if (f.y === undefined && world.ready(f.x, f.z)) f.y = world.heightAt(f.x, f.z) + CAM_HEIGHT;
    u['t' + suffix].value = e.tex;
    u['uPos' + suffix].value.set(f.x, f.y ?? 0, f.z);
    u['uRot' + suffix].value.set(...f.r);
    u['uLens' + suffix].value.set(f.f, f.k1, f.k2, f.fish);
    u['uShape' + suffix].value.set(f.a, f.c ?? 0.8, f.y === undefined ? 0 : weight * e.fade);
  }

  // choose the photos for this frame; returns true when the photo pass should run
  function update(camera, dt) {
    if (!frames.length) return false;
    camera.getWorldDirection(fwd);
    const h = Math.hypot(fwd.x, fwd.z) || 1, dx = fwd.x / h, dz = fwd.z / h;
    const qx = camera.position.x - dx * BEHIND, qz = camera.position.z - dz * BEHIND;
    let best = null, bestCost = 1e9;
    for (const f of frames) {
      const ex = f.x - qx, ez = f.z - qz;
      if (ex > 60 || ex < -60 || ez > 60 || ez < -60) continue;
      const along = f.fwdX * dx + f.fwdZ * dz;
      if (along < 0.6) continue;
      let cost = Math.hypot(ex, ez) + (1 - along) * 40;
      if (cur && f.seq === cur.seq) cost -= 4;          // stay with one drive: same light, same weather
      if (cost < bestCost) { bestCost = cost; best = f; }
    }
    let target = 0, other = null, t = 0;
    if (best) {
      // which neighbour do we sit between?
      for (const nb of [best.next, best.prev]) {
        if (!nb) continue;
        const sx = nb.x - best.x, sz = nb.z - best.z, l2 = sx * sx + sz * sz;
        const tt = ((qx - best.x) * sx + (qz - best.z) * sz) / l2;
        if (tt > 0 && tt > t) { t = Math.min(tt, 0.5); other = nb; }
      }
      const px = best.x + (other ? (other.x - best.x) * t : 0), pz = best.z + (other ? (other.z - best.z) * t : 0);
      const off = Math.hypot(qx - px, qz - pz);
      target = 1 - Math.min(1, Math.max(0, (off - 5) / 7));
      cur = best;
      const s = t * t * (3 - 2 * t) * 2;                // 0 at the photo, 0.5 half-way to the next
      setPhoto('A', best, 1 - s * 0.5, dt);
      setPhoto('B', other, s * 0.5, dt);
      for (let f = best.next, i = 0; f && i < 3; f = f.next, i++) texture(f);   // warm up what comes next
      trim();
      if (mat.uniforms.uShapeA.value.z <= 0 && mat.uniforms.uShapeB.value.z <= 0) target = 0;
    }
    mix += (target - mix) * Math.min(1, dt * 3);
    if (mix < 0.004 && target === 0) { mix = 0; cur = null; }
    label.style.opacity = mix > 0.3 ? 0.85 : 0;
    if (cur && mix > 0.3) {
      label.textContent = `Street photos © Mapillary contributors (${credit.join(', ')}), CC BY-SA`;
      label.href = `https://www.mapillary.com/app/?pKey=${cur.id}`;
    }
    return mix > 0;
  }

  const size = new THREE.Vector2();
  function render(scene, camera, carGroup) {
    renderer.getDrawingBufferSize(size);
    if (!rt || rt.width !== size.x || rt.height !== size.y) {
      rt?.dispose();
      rt = new THREE.WebGLRenderTarget(size.x, size.y, {
        type: THREE.HalfFloatType, samples: renderer.getContextAttributes().antialias ? 4 : 0,
        depthTexture: new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType),
      });
    }
    carGroup.visible = false;         // its pixels would be painted with road; it is drawn afterwards instead
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    carGroup.visible = true;
    blob.position.copy(carGroup.position);
    blob.position.y += 0.04;
    blob.rotation.set(-Math.PI / 2, 0, carGroup.rotation.y, 'YXZ');
    blob.material.opacity = 0.55 * mix;

    if (!blobAdded) { scene.add(blob); blobAdded = true; }
    const u = mat.uniforms;
    u.tScene.value = rt.texture;
    u.tDepth.value = rt.depthTexture;
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    u.uCamWorld.value.copy(camera.matrixWorld);
    u.uExposure.value = renderer.toneMappingExposure;
    u.uMix.value = mix;
    renderer.render(quadScene, quadCam);

    // the player's car again, on top of the photo
    const autoClear = renderer.autoClear, shadows = renderer.shadowMap.autoUpdate;
    renderer.autoClear = false;
    renderer.shadowMap.autoUpdate = false;
    camera.layers.set(1);
    renderer.render(scene, camera);
    camera.layers.set(0);
    renderer.autoClear = autoClear;
    renderer.shadowMap.autoUpdate = shadows;
  }

  return { load, update, render, get mix() { return mix; }, frames };
}
