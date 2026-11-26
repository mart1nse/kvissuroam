// The arches over a rally stage's start and finish, drawn after the real ones at Rally Estonia (Martin 26 Nov 2026,
// with his photos: "draft some real-life looking banners instead (without logos or texts) ... for the finish one,
// use the black, bigger and more robust. also see that there are flames going out of the finish one", then "as
// the finish line one looks so cool, then add this also the start"). Both are the black gantry: two square black
// towers and a black beam between them with a thin red line along their feet, a box truss along the top with
// flame cannons and lamps on it. Faces are left plain where the real ones carry adverts, and `panels` says where
// each such face lies, for adverts later. `glow` fills the opening with a see-through sheet of light (the stage's
// finish halo: raadi.js sets how strong).
//
// Flames: `flames.fire(s)` sends a column of fire up from each cannon for s seconds, `flames.stop()` lets it die
// down at once (raadi.js says when). One mesh of camera-facing strips drawn by a small shader; it is in the picture
// from the start, collapsed to nothing while the cannons are quiet, so its shader is made ready with the rest
// (src/warm.js) and nothing is made or compiled when it fires.
//
// Each arch is one mesh (the lowest graphics level counts every piece it draws) and both share one material and
// one small picture: the faces' paint, and a white patch that the plain faces take their colour through. Its parts
// never share a face with each other (two faces in one place flicker: the first arches' lines of light did).
// The towers are solid (world.addSolids).
import * as THREE from 'three';
import { paintScale } from '../world/paintscale.js';
import { still } from '../still.js';
import { glowTex } from './decor.js';

const BLACK = 0x111114, BAG = 0x18181b, TRUSS = 0x24252a, TRIM = 0x45474e;

// ---- the picture: the black faces with their red line (towers, beam) and a white patch
const CELL = 128, CELLS = 3;
const R_BLACK = 0, R_BLACKBEAM = 1, R_PLAIN = 2;
let mat = null;
function material() {
  if (mat) return mat;
  const k = paintScale(), s = Math.round(CELL * k);
  const c = document.createElement('canvas');
  c.width = s * CELLS; c.height = s;
  const g = c.getContext('2d');
  const at = (r, f) => { g.save(); g.translate(r * s, 0); g.scale(s / CELL, s / CELL); f(); g.restore(); };
  // (the canvas's top is the face's top) Black printed vinyl on a frame, as it is out in a park: not one black but a
  // dark grey that varies in big soft patches, rain has run down it in faint streaks, road dust has settled on its
  // lower part, the frame's edge catches the light along its top, a thin red line near its foot.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const [r, line] of [[R_BLACK, 0.93], [R_BLACKBEAM, 0.88]]) at(r, () => {
    g.fillStyle = '#17171b'; g.fillRect(0, 0, CELL, CELL);
    for (let i = 0; i < 14; i++) {
      const x = rnd() * CELL, y = rnd() * CELL, rr = 18 + rnd() * 40, f = g.createRadialGradient(x, y, 0, x, y, rr);
      const v = rnd() < 0.5 ? '40,40,46' : '6,6,8';
      f.addColorStop(0, `rgba(${v},0.22)`); f.addColorStop(1, `rgba(${v},0)`);
      g.fillStyle = f; g.fillRect(0, 0, CELL, CELL);
    }
    for (let i = 0; i < 40; i++) {
      const x = rnd() * CELL, w = 0.4 + rnd() * 1.2, l = CELL * (0.2 + rnd() * 0.7);
      g.fillStyle = rnd() < 0.6 ? `rgba(70,72,80,${(0.05 + rnd() * 0.07).toFixed(3)})` : `rgba(0,0,0,${(0.1 + rnd() * 0.1).toFixed(3)})`;
      g.fillRect(x, rnd() * CELL * 0.2, w, l);
    }
    const d = g.createLinearGradient(0, CELL * 0.62, 0, CELL);
    d.addColorStop(0, 'rgba(96,84,70,0)'); d.addColorStop(1, 'rgba(96,84,70,0.4)');
    g.fillStyle = d; g.fillRect(0, CELL * 0.62, CELL, CELL * 0.38);
    g.fillStyle = '#b3121b'; g.fillRect(0, line * CELL, CELL, 0.02 * CELL);
    g.fillStyle = 'rgba(255,120,120,0.25)'; g.fillRect(0, line * CELL, CELL, 0.005 * CELL);
    g.strokeStyle = '#2b2c31'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, CELL - 3, CELL - 3);
    g.fillStyle = 'rgba(150,152,160,0.45)'; g.fillRect(0, 0, CELL, 1.2);
  });
  at(R_PLAIN, () => { g.fillStyle = '#fff'; g.fillRect(0, 0, CELL, CELL); });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // (a standard surface: the sky's picture (scene.environment) lies on it as a faint sheen that grows towards the
  // edges, the sun gives it a soft highlight; a matt black would read as a hole in the picture)
  mat = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.5, metalness: 0.1 });
  return mat;
}

// corners gathered into one mesh. put(geo, hex, region): the faces looking along the road (front and back) wear
// the region's paint stretched over the part's own box; the rest take `hex` through the white patch.
function gather() {
  const P = [], N = [], C = [], U = [], col = new THREE.Color(), white = new THREE.Color(0xffffff);
  const plain = [(R_PLAIN + 0.5) / CELLS, 0.5];
  return {
    put(geo, hex, region = -1) {
      if (geo.index) geo = geo.toNonIndexed();
      if (!geo.attributes.normal) geo.computeVertexNormals();
      geo.computeBoundingBox();
      const bb = geo.boundingBox, p = geo.attributes.position.array, n = geo.attributes.normal.array;
      col.setHex(hex);
      for (let t = 0; t < p.length; t += 9) {
        // (the face's own direction, from its corners: a bevel's normals lean)
        const ax = p[t + 3] - p[t], ay = p[t + 4] - p[t + 1], az = p[t + 5] - p[t + 2], bx = p[t + 6] - p[t], by = p[t + 7] - p[t + 1], bz = p[t + 8] - p[t + 2];
        const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, l = Math.hypot(nx, ny, nz) || 1;
        const ax_ = Math.abs(nx / l), az_ = Math.abs(nz / l), face = region >= 0 && (az_ > 0.9 || ax_ > 0.9);
        for (let v = t; v < t + 9; v += 3) {
          P.push(p[v], p[v + 1], p[v + 2]); N.push(n[v], n[v + 1], n[v + 2]);
          const c = face ? white : col;
          C.push(c.r, c.g, c.b);
          if (face) {
            const u = az_ > 0.9 ? (p[v] - bb.min.x) / (bb.max.x - bb.min.x || 1) : (p[v + 2] - bb.min.z) / (bb.max.z - bb.min.z || 1), w = (p[v + 1] - bb.min.y) / (bb.max.y - bb.min.y || 1);
            // (on the back face the picture is turned so it reads the same way; a hair in from the cell's edges)
            const uu = (az_ > 0.9 ? nz : -nx) / l < 0 ? 1 - u : u;
            U.push((region + 0.02 + 0.96 * uu) / CELLS, 0.02 + 0.96 * w);
          } else U.push(plain[0], plain[1]);
        }
      }
      geo.dispose();
    },
    box(w, h, d, hex, x, y, z, rz = 0, region = -1) {
      const g = new THREE.BoxGeometry(w, h, d);
      if (rz) g.rotateZ(rz);
      g.translate(x, y, z);
      this.put(g, hex, region);
    },
    mesh() {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      const m = new THREE.Mesh(geo, material());
      m.castShadow = true;
      return m;
    },
  };
}

// ---- the black gantry. a: from the road's middle to the inside of a tower
const GA = { TOWER_W: 1.45, TOWER_D: 1.2, BEAM_H: 1.6, BEAM_D: 0.9, TRUSS: 0.5, BAY: 0.75 };
function gantry(b, a, clear) {
  const { TOWER_W, TOWER_D, BEAM_H, BEAM_D, TRUSS, BAY } = GA;
  const top = clear + BEAM_H, o = a + TOWER_W;
  for (const s of [-1, 1]) {
    b.box(TOWER_W, top + 0.4, TOWER_D, BLACK, s * (a + TOWER_W / 2), (top - 0.4) / 2, 0, 0, R_BLACK);
    b.box(TOWER_W + 0.3, 0.25, TOWER_D + 0.3, BAG, s * (a + TOWER_W / 2), 0.05, 0);       // its foot plate
    // the frame's corners, bare steel catching the light
    for (const cx of [-1, 1]) for (const cz of [-1, 1]) b.box(0.06, top + 0.38, 0.06, TRIM, s * (a + TOWER_W / 2) + cx * TOWER_W / 2, (top - 0.4) / 2, cz * TOWER_D / 2);
  }
  for (const cz of [-1, 1]) for (const yy of [clear, top]) b.box(2 * a, 0.05, 0.05, TRIM, 0, yy, cz * BEAM_D / 2);
  // the beam between the towers (its ends inside them)
  b.box(2 * a + 0.4, BEAM_H, BEAM_D, BLACK, 0, clear + BEAM_H / 2, 0, 0, R_BLACKBEAM);
  // the box truss along the top: four chords, posts and diagonals on its two long sides and across its top
  const y0 = top + 0.06, y1 = y0 + TRUSS, z = 0.28, c = 0.05;
  for (const yy of [y0, y1]) for (const zz of [-z, z]) b.box(2 * o, c, c, TRUSS, 0, yy, zz);
  const n = Math.round(2 * o / BAY), step = 2 * o / n, diag = Math.hypot(step, TRUSS), ang = Math.atan2(TRUSS, step);
  for (let i = 0; i <= n; i++) {
    const x = -o + i * step;
    for (const zz of [-z, z]) b.box(c * 0.8, TRUSS, c * 0.8, TRUSS, x, (y0 + y1) / 2, zz);
    if (i === n) break;
    const xm = x + step / 2, sgn = i % 2 ? 1 : -1;
    for (const zz of [-z, z]) b.box(diag, c * 0.7, c * 0.7, TRUSS, xm, (y0 + y1) / 2, zz, sgn * ang);
    b.box(c * 0.7, c * 0.7, 2 * z, TRUSS, x, y1, 0);
  }
  // flame cannons on top (where the flames come out) and lamps between them
  const jets = [];
  const nj = 5;
  for (let i = 0; i < nj; i++) {
    const x = -o + 0.6 + (2 * o - 1.2) * i / (nj - 1);
    b.box(0.42, 0.34, 0.42, 0x3a3b40, x, y1 + 0.2, 0);
    b.box(0.16, 0.3, 0.16, 0x1c1c1f, x, y1 + 0.5, 0);
    jets.push([x, y1 + 0.62, 0]);
    if (i < nj - 1) {
      const lx = x + (2 * o - 1.2) / (nj - 1) / 2;
      b.box(0.3, 0.3, 0.36, 0x1c1c1f, lx, y1 + 0.18, -0.05);
      b.box(0.24, 0.24, 0.02, 0xfff2d0, lx, y1 + 0.18, -0.24);
    }
  }
  return {
    top: y1,
    jets,
    solids: [-1, 1].map((s) => ({ x: s * (a + TOWER_W / 2), hx: TOWER_W / 2, hz: TOWER_D / 2 })),
    panels: {
      beam: [-a + 0.1, clear + 0.2, a - 0.1, top - 0.15],
      legs: [[-o + 0.1, 0.5, -a - 0.1, top - 0.2], [a + 0.1, 0.5, o - 0.1, top - 0.2]],
    },
    open: { x0: -a + 0.03, x1: a - 0.03, top: clear - 0.03 },
  };
}

// ---- fire from the cannons
// the fire's width for a fire FIRE_SHAPE m high (a lower fire is narrower in step, so that it keeps its shape), its
// usual height (Martin: "less power or thrust so that they sit a bit lower") and its share of the strip (smoke above)
const FIRE_W = 3.4, FIRE_SHAPE = 16, FIRE_H = 10, FIRE_TOP = 0.74;
function flameMesh(jets) {
  const pos = [], corner = [], idx = [];
  jets.forEach(([x, y, z], j) => {
    for (const [cx, cy] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) { pos.push(x, y, z); corner.push(cx, cy, j); }
    idx.push(j * 4, j * 4 + 1, j * 4 + 2, j * 4, j * 4 + 2, j * 4 + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('corner', new THREE.Float32BufferAttribute(corner, 3));
  geo.setIndex(idx);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, jets[0][1] + FIRE_H / 2, 0), 24);
  const uniforms = { uT: { value: 0 }, uOn: { value: 0 }, uEnd: { value: 5 }, uH: { value: FIRE_H } };
  const m = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    // (premultiplied: the fire adds its light to what is behind it, the smoke over its top covers it)
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: `
      attribute vec3 corner;
      uniform float uT, uOn, uEnd, uH;
      varying vec2 vUv; varying float vSeed, vLife;
      void main() {
        if (uOn < 0.5) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
        vec4 c = modelViewMatrix * vec4(position, 1.0);
        // standing upright, turned to the camera about the upright
        vec3 up = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        vec3 side = normalize(cross(up, normalize(-c.xyz)));
        float j = corner.z, t = uT - j * 0.06;
        float grow = smoothstep(0.0, 0.6, t), puff = 0.9 + 0.1 * sin(t * 11.0 + j * 2.1) * sin(t * 4.3 + j);
        // (the strip is taller than the fire: its top part is the smoke)
        float h = uH * (0.15 + 0.85 * grow) * puff / ${FIRE_TOP.toFixed(2)};
        vLife = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(uEnd - 0.5, uEnd, t));
        vUv = vec2(corner.x * 0.5 + 0.5, corner.y);
        vSeed = j * 7.31;
        // (wider far off, so that from the first corner, 360 m away, a column is still a few pixels across)
        float far = max(1.0, -c.z / 140.0);
        c.xyz += side * corner.x * ${(FIRE_W / 2 / FIRE_SHAPE).toFixed(4)} * uH * far * (0.6 + corner.y * 1.3) + up * corner.y * h;
        gl_Position = projectionMatrix * c;
      }`,
    fragmentShader: `
      uniform float uT;
      varying vec2 vUv; varying float vSeed, vLife;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      vec2 hash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float s = 0.0, a = 0.5;
        for (int i = 0; i < 3; i++) { s += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
        return s / 0.875;
      }
      // round puffs of burning gas: x how high the domes of the nearby puffs stand (1 in a puff's middle, low between them),
      // y how far it stands over the next one (0 in the creases between puffs), z that puff's own number
      vec3 puffs(vec2 q, float t) {
        vec2 i = floor(q), f = fract(q);
        float a = 0.0, b = 0.0, id = 0.0, sum = 0.0;
        for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++) {
          vec2 o = vec2(float(j), float(k)), h = hash2(i + o);
          vec2 d = (f - o - 0.25 - 0.5 * h) / ((0.78 + 0.45 * h.y) * (0.86 + 0.14 * sin(t * 3.0 + h.x * 6.28)));
          float dome = max(0.0, 1.0 - dot(d, d));
          sum += dome * dome;
          if (dome > a) { b = a; a = dome; id = h.x; } else b = max(b, dome);
        }
        // (heights summed, so neighbouring puffs flow into each other instead of meeting at a seam)
        return vec3(min(1.0, sqrt(sum) * 0.85), a - b, id);
      }
      void main() {
        float y = vUv.y, x = (vUv.x - 0.5) * 2.0, t = uT;
        float fy = y / ${FIRE_TOP.toFixed(2)};
        // the column sways a little as a whole
        vec2 p = vec2(x * 1.2 + vSeed, y * 2.6 - t * 1.4);
        vec2 w = vec2(fbm(p), fbm(p + vec2(5.2, 1.3)));
        float xs = x + (w.x - 0.5) * 0.45 * fy;
        // puffs rising out of the jet, big ones with smaller ones on them
        vec2 q = vec2(xs * 1.45 + vSeed, y * 10.5 - t * 4.5 + vSeed);
        vec3 P = puffs(q, t), S = puffs(q * 2.3 + vec2(3.7, 1.1) - vec2(0.0, t * 3.0), t * 1.3);
        float lump = smoothstep(0.08, 0.45, fy);
        // the outline: a thin jet low down that opens into a ball of fire, its edge bulging round each puff
        float jet = 0.14 + 0.16 * fy;
        float ball = 0.92 * sqrt(max(0.0, 1.0 - pow((fy - 0.7) / 0.36, 2.0)));
        float r = max(jet, ball);
        float edge = abs(xs) - r - (P.x * 0.7 + S.x * 0.3 - 0.45) * 0.42 * lump - (w.y - 0.5) * 0.12;
        float shape = smoothstep(0.035, -0.035, edge) * smoothstep(1.12, 1.0, fy + (S.x - 0.5) * 0.12);
        // heat: hottest in the jet and deep inside the ball, each puff a little hotter in its middle than at its
        // rim, darker in the creases, and each its own shade
        float inner = clamp(-edge / max(r, 0.15), 0.0, 1.0);
        float H = mix(0.95 - abs(xs) / jet * 0.25, 0.24 + 0.44 * inner, lump);
        H += lump * ((P.x - 0.5) * 0.32 + (S.x - 0.5) * 0.08 - (1.0 - smoothstep(0.0, 0.15, P.y)) * 0.06 + (P.z - 0.5) * 0.16);
        H -= smoothstep(0.75, 1.1, fy) * 0.12;
        // grain in the gas, and the shades in steps rather than one smooth ramp
        H += (noise(q * 4.0 + vec2(0.0, t * 2.0)) - 0.5) * 0.1 + (noise(q * 11.0 - vec2(0.0, t * 3.0)) - 0.5) * 0.1;
        H = mix(H, floor(H * 8.0 + 0.5) / 8.0, 0.25);
        vec3 c = vec3(0.45, 0.07, 0.01);
        c = mix(c, vec3(0.86, 0.26, 0.03), smoothstep(0.1, 0.3, H));
        c = mix(c, vec3(1.0, 0.47, 0.06), smoothstep(0.3, 0.5, H));
        c = mix(c, vec3(1.0, 0.68, 0.16), smoothstep(0.5, 0.68, H));
        c = mix(c, vec3(1.0, 0.86, 0.4), smoothstep(0.68, 0.86, H));
        c = mix(c, vec3(1.0, 0.97, 0.84), smoothstep(0.86, 1.05, H));
        vec3 light = c * shape * (0.95 + 0.5 * smoothstep(0.5, 1.0, H));
        // the hot air glowing round it
        light += vec3(1.0, 0.4, 0.08) * exp(-max(edge, 0.0) * 9.0) * 0.18 * (1.0 - shape) * smoothstep(1.1, 0.2, fy);
        // ---- grey-brown smoke curling off its top and sides, in puffs too
        vec3 D = puffs(vec2(x * 1.6 + vSeed + 2.0, y * 10.0 - t * 2.5), t * 0.7);
        float sr = mix(0.3, 1.0, smoothstep(0.3, 1.0, y));
        float smoke = smoothstep(0.1, -0.1, abs(x + (w.y - 0.5) * 0.8) - sr - (D.x - 0.5) * 0.5);
        smoke *= smoothstep(${(FIRE_TOP * 0.35).toFixed(2)}, ${(FIRE_TOP * 0.9).toFixed(2)}, y) * smoothstep(1.0, 0.8, y) * (0.25 + 0.4 * D.x);
        vec3 soot = mix(vec3(0.2, 0.19, 0.19), vec3(0.42, 0.36, 0.32), D.x) * mix(0.6, 1.0, D.z);
        soot = mix(soot, vec3(0.5, 0.2, 0.06), smoothstep(${(FIRE_TOP + 0.1).toFixed(2)}, ${(FIRE_TOP * 0.8).toFixed(2)}, y) * 0.5);
        float fa = shape * mix(0.55, 0.9, lump), sa = smoke * (1.0 - fa);
        vec3 rgb = light + soot * sa;
        float a = fa + sa;
        if (a < 0.004 && dot(rgb, rgb) < 0.0001) discard;
        gl_FragColor = vec4(rgb * vLife, a * vLife);
      }`,
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.renderOrder = 6;
  mesh.frustumCulled = false;
  return {
    mesh,
    get on() { return uniforms.uOn.value > 0; },
    // s seconds of fire h m high (it rises in a third of a second and dies down over the last half second)
    fire(s, h = FIRE_H) { uniforms.uT.value = 0; uniforms.uEnd.value = Math.max(0.6, s); uniforms.uH.value = h; uniforms.uOn.value = 1; },
    // die down now
    stop() { if (uniforms.uOn.value) uniforms.uEnd.value = Math.min(uniforms.uEnd.value, uniforms.uT.value + 0.5); },
    update(dt) {
      if (!uniforms.uOn.value) return;
      uniforms.uT.value += Math.min(dt || 0.016, 0.1);
      if (uniforms.uT.value > uniforms.uEnd.value + 0.4) uniforms.uOn.value = 0;
    },
  };
}

// x, z: the middle of the road under the arch; tx, tz: the way the stage runs there; half: from the road's middle
// to the inside of each tower; clear: the height under the beam; glow: a sheet of light in the opening. Returns
// the group, `panels` (the free faces, [x0, y0, x1, y1] in the arch's own metres: x across the road from its middle, y up from its foot, on both faces), `glow` (that
// sheet's mesh, or null) and `flames` (its fire).
export function buildArch({ group, world, x, z, tx, tz, half, clear = 4.3, glow = false }) {
  const yaw = Math.atan2(tx, tz), a = half, rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const b = gather();
  const it = gantry(b, a, clear);
  // (it stands on the highest ground under its feet and its middle; the feet reach down into a slope)
  const feet = it.solids.map((s) => world.heightAt(x + rx * s.x, z + rz * s.x));
  const y = Math.max(world.heightAt(x, z), ...feet);
  const g = still(new THREE.Group());
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  g.add(b.mesh());
  // the towers reach down to the ground under them
  for (const [k, s] of it.solids.entries()) {
    const drop = y - feet[k];
    if (drop > 0.05) {
      const f = gather();
      f.box(s.hx * 2 - 0.02, drop + 0.3, s.hz * 2 - 0.02, BLACK, s.x, -drop / 2 + 0.1, 0);
      g.add(f.mesh());
    }
  }

  let sheet = null;
  if (glow && it.open) {
    let low = Infinity;
    for (let k = -4; k <= 4; k++) low = Math.min(low, world.heightAt(x + rx * a * k / 4, z + rz * a * k / 4));
    const y0 = low - y - 0.05, { x0, x1, top } = it.open;
    const sg = new THREE.PlaneGeometry(x1 - x0, top - y0);
    sg.translate((x0 + x1) / 2, (top + y0) / 2, 0);
    sheet = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, fog: true }));
    sheet.renderOrder = 4;
    g.add(sheet);
  }
  const flames = flameMesh(it.jets);
  g.add(flames.mesh);

  group.add(g);
  world.addSolids(it.solids.map((s) => ({ x: x + rx * s.x, z: z + rz * s.x, yaw, hx: s.hx, hz: s.hz })));
  return { group: g, glow: sheet, flames, panels: it.panels, top: y + it.top };
}
