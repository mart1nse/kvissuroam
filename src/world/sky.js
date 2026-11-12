import * as THREE from 'three';

// Midsummer "white night" sunset in the north-north-west, vaporwave style.
export const SUN_AZIMUTH = THREE.MathUtils.degToRad(338);
export const SUN_ELEVATION = THREE.MathUtils.degToRad(5.5);

export function sunDirection(elevation = SUN_ELEVATION) {
  return new THREE.Vector3(
    Math.sin(SUN_AZIMUTH) * Math.cos(elevation),
    Math.sin(elevation),
    -Math.cos(SUN_AZIMUTH) * Math.cos(elevation),
  );
}

export const FOG_COLOR = new THREE.Color(0xd77fb4);

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 0.0);
  gl_Position = projectionMatrix * vec4(p.xyz, 1.0);
  gl_Position.z = gl_Position.w;
}`;

const skyFrag = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uSun;
uniform float uTime;
uniform float uEnv;   // 1 when rendering the reflection probe (no stripes / stars)

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c0 = vec3(1.00, 0.72, 0.36);   // horizon glow
  vec3 c1 = vec3(1.00, 0.36, 0.62);   // hot pink
  vec3 c2 = vec3(0.54, 0.25, 0.92);   // violet
  vec3 c3 = vec3(0.13, 0.09, 0.42);   // indigo
  vec3 c4 = vec3(0.03, 0.02, 0.16);   // zenith
  vec3 col = mix(c0, c1, smoothstep(0.0, 0.10, h));
  col = mix(col, c2, smoothstep(0.07, 0.30, h));
  col = mix(col, c3, smoothstep(0.25, 0.60, h));
  col = mix(col, c4, smoothstep(0.55, 1.0, h));
  // the glow is stronger towards the sun
  float toSun = max(dot(normalize(d.xz), normalize(uSun.xz)), 0.0);
  col += vec3(0.35, 0.16, 0.05) * pow(toSun, 6.0) * (1.0 - smoothstep(0.0, 0.25, h));
  col = mix(col, vec3(0.42, 0.20, 0.48), (1.0 - toSun) * 0.35 * (1.0 - smoothstep(0.0, 0.2, h)));

  // retro sun: big disc with horizontal slits in the lower half
  float ang = acos(clamp(dot(d, uSun), -1.0, 1.0));
  float R = 0.135;
  if (ang < R * 1.6) {
    float y = (d.y - uSun.y) / R;                // -1 .. 1 across the disc
    vec3 sunCol = mix(vec3(1.0, 0.25, 0.55), vec3(1.0, 0.92, 0.35), smoothstep(-0.9, 0.7, y));
    float disc = 1.0 - smoothstep(R * 0.985, R, ang);
    float slit = 1.0;
    if (uEnv < 0.5 && y < 0.15) {
      float t = (0.15 - y) / 1.15;               // 0 at the first slit, 1 at the bottom
      float band = fract(t * 6.0 - 0.15);
      slit = step(0.18 + 0.38 * t, band);
    }
    col = mix(col, sunCol * 1.25, disc * slit);
    col += vec3(1.0, 0.45, 0.6) * 0.35 * (1.0 - smoothstep(R, R * 1.6, ang));
  }

  // stars
  if (uEnv < 0.5 && h > 0.18) {
    vec2 uv = vec2(atan(d.z, d.x), asin(h)) * 60.0;
    vec2 cell = floor(uv);
    float r = hash(cell);
    vec2 o = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
    float s = smoothstep(0.09, 0.0, length(fract(uv) - 0.5 - o * 0.6));
    float tw = 0.7 + 0.3 * sin(uTime * 2.0 + r * 40.0);
    col += vec3(0.9, 0.85, 1.0) * s * step(0.93, r) * smoothstep(0.18, 0.5, h) * tw;
  }

  // below the horizon: dark haze so the edge of the world never shows
  col = mix(col, vec3(0.30, 0.13, 0.36), smoothstep(0.0, -0.08, h));
  gl_FragColor = vec4(col, 1.0);
}`;

export function createSky() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: skyVert,
    fragmentShader: skyFrag,
    uniforms: { uSun: { value: sunDirection() }, uTime: { value: 0 }, uEnv: { value: 0 } },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

// Reflection environment for the car paint and windows, rendered from the sky.
export function createEnvironment(renderer) {
  const scene = new THREE.Scene();
  const sky = createSky();
  sky.material.uniforms.uEnv.value = 1;
  sky.scale.setScalar(50);
  sky.material.vertexShader = sky.material.vertexShader.replace('gl_Position.z = gl_Position.w;', '');
  scene.add(sky);
  // a dark floor so the underside of the paint is not lit by "sky"
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(60, 24),
    new THREE.MeshBasicMaterial({ color: 0x1a1024 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.5;
  scene.add(floor);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02, 0.1, 100);
  pmrem.dispose();
  sky.geometry.dispose();
  sky.material.dispose();
  return rt.texture;
}

export function createLights(scene, shadowSize) {
  const hemi = new THREE.HemisphereLight(0xb9a4ff, 0x6b3a6e, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffc7a1, 2.3);
  sun.position.copy(sunDirection(THREE.MathUtils.degToRad(17))).multiplyScalar(300);
  if (shadowSize) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    const c = sun.shadow.camera;
    c.left = -70; c.right = 70; c.top = 70; c.bottom = -70; c.near = 50; c.far = 700;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.06;
  }
  scene.add(sun, sun.target);
  return { hemi, sun, sunOffset: sun.position.clone() };
}
