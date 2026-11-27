// A big glowing hologram of the Anderson's Taproom drop over the Poe / Küüni corner (Martin, 19 Nov): the
// teardrop with its nested A and C in cyan-green neon, ANDERSON'S TAPROOM under it in a geometric bold sans
// (Montserrat, bundled), always turned to face the camera about the upright axis. It hangs over a round
// projector pad with a faint beam and a few rising sparks. Clicking or tapping it opens the taproom's site.
import * as THREE from 'three';

export const FONT = 'LinnaringMontserrat';
let fontReady = null;
export function loadFont() {
  if (fontReady) return fontReady;
  if (typeof FontFace === 'undefined' || !document.fonts) return (fontReady = Promise.resolve(false));
  const url = `${import.meta.env.BASE_URL}fonts/montserrat-latin.woff2`;
  const f = new FontFace(FONT, `url(${url}) format('woff2')`, { weight: '100 900' });
  fontReady = f.load().then((ff) => { document.fonts.add(ff); return true; }, () => false);
  return fontReady;
}

// the picture: black ground (the material adds it onto the scene, so black is see-through)
const CW = 1280, CH = 1600;
const DROP = { cx: 640, tip: 70, cy: 800, R: 320 };               // the drop: tip, bulb centre and radius (px)
const TEXT = { y1: 1300, y2: 1475 };                             // the two lines of lettering (px, centres)
// the parts that answer a click, as uv boxes [u0, v0, u1, v1] (v up)
const HIT = [[(640 - 360) / CW, 1 - 1140 / CH, (640 + 360) / CW, 1 - 40 / CH], [60 / CW, 1 - 1560 / CH, 1220 / CW, 1 - 1200 / CH]];

function dropPath(g, s = 1, cut = false) {
  // the drop scaled by s about the bulb centre; cut: only its upper part, from one tangent point over the tip to the other
  const { cx, cy } = DROP, R = DROP.R * s, ty = cy - (cy - DROP.tip) * s;
  const a = Math.acos(R / (cy - ty));                              // the tangent points sit this far either side of straight up
  const left = [cx - R * Math.sin(a), cy - R * Math.cos(a)], right = [cx + R * Math.sin(a), cy - R * Math.cos(a)];
  g.beginPath();
  if (cut) {
    g.moveTo(left[0], left[1]); g.lineTo(cx, ty); g.lineTo(right[0], right[1]);
  } else {
    g.moveTo(cx, ty); g.lineTo(right[0], right[1]);
    g.arc(cx, cy, R, a - Math.PI / 2, Math.PI * 1.5 - a, false);
    g.closePath();
  }
}

function drawLogo(c) {
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, CW, CH);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const glow = 'rgba(60,255,206,0.9)', core = '#eafff8', mid = '#7dffe0';
  // every stroke twice: a wide soft glow, then the bright tube
  const neon = (path, w) => {
    for (const [lw, col, blur] of [[w * 2.6, 'rgba(40,240,190,0.22)', 60], [w * 1.5, glow, 34], [w * 0.8, mid, 12], [w * 0.38, core, 0]]) {
      g.save(); g.shadowColor = 'rgba(40,255,200,1)'; g.shadowBlur = blur; g.strokeStyle = col; g.lineWidth = lw; path(); g.stroke(); g.restore();
    }
  };
  // the drop's own faint glass body
  g.save(); dropPath(g, 1); g.fillStyle = 'rgba(30,140,120,0.22)'; g.fill(); g.restore();
  neon(() => dropPath(g, 1), 30);
  // the A: two nested peaks under the tip and the cross bar between their legs
  neon(() => dropPath(g, 0.8, true), 22);
  neon(() => dropPath(g, 0.6, true), 22);
  const yb = DROP.cy - DROP.R * 0.72;
  const legAt = (s, y) => {                                        // x of the left leg of the peak scaled by s at height y
    const R = DROP.R * s, ty = DROP.cy - (DROP.cy - DROP.tip) * s, a = Math.acos(R / (DROP.cy - ty));
    const lx = DROP.cx - R * Math.sin(a), ly = DROP.cy - R * Math.cos(a);
    return DROP.cx - (DROP.cx - lx) * (y - ty) / (ly - ty);
  };
  const xb = legAt(0.6, yb);
  neon(() => { g.beginPath(); g.moveTo(xb, yb); g.lineTo(2 * DROP.cx - xb, yb); }, 22);
  // the C: three rings open to the right in the bulb
  for (const k of [0.66, 0.5, 0.34]) {
    neon(() => { g.beginPath(); g.arc(DROP.cx, DROP.cy + DROP.R * 0.12, DROP.R * k, 0.75, Math.PI * 2 - 0.75, false); }, 20);
  }
  // the lettering
  const word = (txt, y, size, weight, spacing, fill) => {
    g.save();
    g.font = `${weight} ${size}px ${FONT}, "Montserrat", "Avenir Next", "Futura", "Century Gothic", Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`;
    for (const [col, blur, lw] of [['rgba(40,240,190,0.5)', 50, 10], [glow, 22, 5]]) { g.shadowColor = 'rgba(40,255,200,1)'; g.shadowBlur = blur; g.strokeStyle = col; g.lineWidth = lw; g.strokeText(txt, CW / 2, y); }
    g.shadowBlur = 16; g.fillStyle = fill; g.fillText(txt, CW / 2, y);
    g.restore();
  };
  word("ANDERSON'S", TEXT.y1, 150, 800, 6, '#bffff0');
  word('TAPROOM', TEXT.y2, 128, 600, 14, '#f2fffb');
}

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */`
  uniform sampler2D map; uniform float uTime; uniform float uFade;
  varying vec2 vUv;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    vec2 uv = vUv;
    // now and then a band of the picture slips sideways, as holograms do
    float slot = floor(uTime * 1.7);
    float glitch = step(0.86, hash(slot)) * step(abs(uv.y - hash(slot + 3.1)), 0.05);
    uv.x += glitch * (hash(slot + 7.7) - 0.5) * 0.06;
    vec3 c = texture2D(map, uv).rgb;
    float scan = 0.86 + 0.14 * sin(uv.y * 900.0 - uTime * 9.0);
    float sweep = smoothstep(0.0, 0.04, 0.04 - abs(fract(uTime * 0.18) - uv.y)) * 0.6;
    float flick = 0.92 + 0.08 * sin(uTime * 23.0) * sin(uTime * 3.1);
    // drawn over the scene rather than added to it: where the tubes are bright they cover what is behind
    // (trees, sky) so the cyan-green holds; the soft glow only dims the background a little
    float lum = max(c.r, max(c.g, c.b));
    float k = (scan + sweep) * flick * uFade;
    float a = clamp(lum * 1.6, 0.0, 0.94) * scan * uFade;      // the scan lines thin the picture rather than darken it
    gl_FragColor = vec4(min(c * vec3(0.9, 1.0, 1.12) * 1.35, vec3(1.0)) * k, a);
  }`;

// Footprints from the pad to a door (Martin, 27 Nov: kuuni.js passes the way, steps): drawn by the halo's shader,
// in the halo's one draw. Each print is a quad laid on the ground with its own number along the way (aStep, from 1;
// the halo's own vertices have none, 0); the shader draws the foot, and the prints light up one after another
// from the hologram to the door, the trail fading behind.
const FOOT_W = 0.2, FOOT_L = 0.4, FOOT = 1.25, PACE = 0.44;          // (the foot drawn 1.25 times life size: it reads from a car)
const HALO_VERT = /* glsl */`
  attribute float aStep;
  varying vec2 vUv; varying float vStep;
  void main() { vUv = uv; vStep = aStep; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const HALO_FRAG = /* glsl */`
  uniform float uTime; uniform float uSteps;
  varying vec2 vUv; varying float vStep;
  float ell(vec2 p, vec2 c, vec2 r) { return (length((p - c) / r) - 1.0) * min(r.x, r.y); }
  float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
  void main() {
    if (vStep < 0.5) {
      // the halo round the pad (added onto the scene: no alpha)
      float r = length(vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.4, r) * (0.18 + 0.05 * sin(uTime * 2.0));
      gl_FragColor = vec4(vec3(0.2, 1.0, 0.8) * a, 0.0);
      return;
    }
    // a right foot seen from above, toes up, the big toe on the left (a left foot comes with its u turned round), in metres
    vec2 p = vec2((vUv.x - 0.5) * ${FOOT_W.toFixed(2)}, vUv.y * ${FOOT_L.toFixed(2)} - 0.02);   // (the quad is FOOT times this)
    float d = smin(ell(p, vec2(0.0, 0.075), vec2(0.042, 0.058)), ell(p, vec2(0.01, 0.205), vec2(0.054, 0.098)), 0.035);
    d = min(d, ell(p, vec2(-0.03, 0.335), vec2(0.021, 0.026)));
    d = min(d, length(p - vec2(0.003, 0.34)) - 0.0145);
    d = min(d, length(p - vec2(0.027, 0.331)) - 0.0125);
    d = min(d, length(p - vec2(0.047, 0.316)) - 0.011);
    d = min(d, length(p - vec2(0.063, 0.296)) - 0.0095);
    float aa = fwidth(d) + 1e-4;
    float fill = 1.0 - smoothstep(-aa, aa, d);
    float rim = 1.0 - smoothstep(0.0, 0.009 + aa, abs(d + 0.007));
    float edge = min(min(vUv.x, 1.0 - vUv.x) * ${FOOT_W.toFixed(2)}, min(vUv.y, 1.0 - vUv.y) * ${FOOT_L.toFixed(2)});
    float glow = exp(-max(d, 0.0) / 0.018) * smoothstep(0.0, 0.03, edge) * 0.5;
    // walking: the prints light up in turn, at a walker's pace, and fade behind
    float ph = mod(uTime * 2.2, uSteps + 8.0) - (vStep - 1.0);
    float walk = ph >= 0.0 ? exp(-ph * 0.3) : 0.0;
    float k = (0.7 + 0.8 * walk) * (0.86 + 0.14 * sin(vUv.y * 70.0 - uTime * 9.0)) * (0.92 + 0.08 * sin(uTime * 23.0) * sin(uTime * 3.1));
    vec3 col = mix(vec3(0.24, 1.0, 0.82), vec3(0.85, 1.0, 0.97), rim * 0.8);
    // the print covers the ground (so the cyan holds on pale paving), its glow is only added
    gl_FragColor = vec4(col * k * max(fill * 0.75 + rim * 0.5, glow), clamp((fill * 0.6 + rim * 0.3) * k, 0.0, 0.92));
  }`;

// the prints' quads along the way through pts ([[x, z]...]), in the halo's own frame (origin: its world position)
function footprints(world, pts, origin) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const L = curve.getLength(), pos = [], uv = [], step = [], index = [];
  const at = new THREE.Vector3(), dir = new THREE.Vector3();
  let n = 0;
  const print = (d, side, num) => {
    curve.getPointAt(Math.min(1, d / L), at); curve.getTangentAt(Math.min(1, d / L), dir);
    const fx = dir.x, fz = dir.z, rx = -fz, rz = fx;          // the walker's way, and their right hand
    const cx = at.x + rx * side, cz = at.z + rz * side, flip = side < 0;
    const base = pos.length / 3;
    const hw = FOOT_W * FOOT / 2, hl = FOOT_L * FOOT / 2;
    for (const [lx, ly, u, v] of [[-hw, -hl, 0, 0], [hw, -hl, 1, 0], [hw, hl, 1, 1], [-hw, hl, 0, 1]]) {
      const wx = cx + rx * lx + fx * ly, wz = cz + rz * lx + fz * ly;
      pos.push(wx - origin.x, world.heightAt(wx, wz) + 0.12 - origin.y, wz - origin.z);
      uv.push(flip ? 1 - u : u, v); step.push(num);
    }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  // walking from the pad, a print each pace, left and right; both feet side by side at the door
  for (let d = PACE * 0.5; d < L - 0.65; d += PACE) print(d, (n % 2 ? 0.12 : -0.12), ++n);
  n++;
  print(L - FOOT_L * FOOT / 2, -0.13, n); print(L - FOOT_L * FOOT / 2, 0.13, n);
  return { pos, uv, step, index, n };
}

export function createHologram(scene, world, { x, z, url, width = 13, lift = 1.6, steps = null }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const height = width * CH / CW;
  const cv = document.createElement('canvas');
  cv.width = CW; cv.height = CH;
  drawLogo(cv);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  loadFont().then((ok) => { if (ok) { drawLogo(cv); tex.needsUpdate = true; } });
  const uniforms = { map: { value: tex }, uTime: { value: 0 }, uFade: { value: 1 } };
  const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false };
  // premultiplied 'over': colour + background * (1 - alpha)
  const over = { ...add, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor };
  const board = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, ...over }));
  board.position.y = lift + height / 2;
  board.renderOrder = 10;
  const turn = new THREE.Group();
  turn.add(board);
  group.add(turn);

  // the projector: a dark pad with a glowing ring, the beam rising out of it, sparks drifting up
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.22, 32), new THREE.MeshLambertMaterial({ color: 0x2e3440 }));
  pad.position.y = 0.11;
  group.add(pad);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x46ffd2, ...add });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.35, 40).rotateX(-Math.PI / 2), ringMat);
  ring.position.y = 0.235;
  group.add(ring);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9effea, ...add }));
  lens.position.y = 0.24;
  group.add(lens);
  // (premultiplied 'over' since the footprints, 27 Nov: the halo writes no alpha, so it is still only added)
  const halo = new THREE.Mesh(new THREE.RingGeometry(1.7, 4.2, 48).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uSteps: { value: 1 } }, ...over,
    vertexShader: HALO_VERT, fragmentShader: HALO_FRAG,
  }));
  halo.position.y = 0.05;
  group.add(halo);
  const beamH = lift + height * 0.62;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.34, 0.8, beamH, 32, 1, true), new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime }, ...add,
    vertexShader: VERT,
    fragmentShader: `uniform float uTime; varying vec2 vUv; void main() { float a = (1.0 - vUv.y) * 0.13 + 0.03; a *= 0.75 + 0.25 * sin(vUv.x * 40.0 + uTime * 1.5); gl_FragColor = vec4(vec3(0.15, 1.0, 0.78) * a, 1.0); }`,
  }));
  beam.position.y = beamH / 2 + 0.2;
  group.add(beam);
  const NP = 60, seeds = new Float32Array(NP * 3), pos = new Float32Array(NP * 3);
  for (let i = 0; i < NP; i++) { seeds[i * 3] = Math.random() * Math.PI * 2; seeds[i * 3 + 1] = Math.random(); seeds[i * 3 + 2] = 0.4 + Math.random() * 2.6; }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0x8cffe6, size: 0.16, ...add }));
  sparks.frustumCulled = false;
  group.add(sparks);

  let built = false, t = 0;
  const camPos = new THREE.Vector3();
  function build() {
    built = true;
    group.position.set(x, world.heightAt(x, z), z);
    if (steps) {
      // the footprints join the halo's ring in one geometry
      const f = footprints(world, steps, { x, y: group.position.y + halo.position.y, z });
      const ring = halo.geometry, rn = ring.attributes.position.count;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([...ring.attributes.position.array, ...f.pos], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([...ring.attributes.uv.array, ...f.uv], 2));
      g.setAttribute('aStep', new THREE.Float32BufferAttribute([...new Array(rn).fill(0), ...f.step], 1));
      g.setIndex([...ring.index.array, ...f.index.map((i) => i + rn)]);
      halo.geometry = g;
      ring.dispose();
      halo.material.uniforms.uSteps.value = f.n;
    }
    group.visible = true;
  }

  // click / tap: a short press that does not move, on the drop or the lettering
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const hit = (camera, el, cx, cy) => {
    if (!built || !group.visible) return false;
    camera.getWorldPosition(camPos);
    if (camPos.distanceTo(group.position) > 600) return false;
    const r = el.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObject(board, false)[0];
    if (!h || !h.uv) return false;
    return HIT.some(([u0, v0, u1, v1]) => h.uv.x > u0 && h.uv.x < u1 && h.uv.y > v0 && h.uv.y < v1);
  };
  function bindClicks(camera, el) {
    let down = null, hoverT = 0;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; }, { passive: true });
    el.addEventListener('click', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12 || performance.now() - down.t > 800) return;
      if (hit(camera, el, e.clientX, e.clientY)) window.open(url, '_blank', 'noopener');
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const now = performance.now();
      if (now - hoverT < 120) return;
      hoverT = now;
      el.style.cursor = hit(camera, el, e.clientX, e.clientY) ? 'pointer' : '';
    }, { passive: true });
  }

  return {
    group, bindClicks,
    update(dt, camera) {
      if (!built) {
        if (world.ready(x, z) && (!steps || steps.every(([sx, sz]) => world.ready(sx, sz)))) build();
        else return;
      }
      t += dt;
      uniforms.uTime.value = t;
      camera.getWorldPosition(camPos);
      // turn to the camera about the upright axis
      turn.rotation.y = Math.atan2(camPos.x - x, camPos.z - z);
      ringMat.opacity = 0.75 + 0.25 * Math.sin(t * 3);
      for (let i = 0; i < NP; i++) {
        const a = seeds[i * 3] + t * 0.2, k = (seeds[i * 3 + 1] + t * 0.07 * seeds[i * 3 + 2] * 0.5) % 1, r = 0.6 + k * width * 0.28;
        pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 0.3 + k * beamH; pos[i * 3 + 2] = Math.sin(a) * r;
      }
      sparkGeo.attributes.position.needsUpdate = true;
    },
  };
}
