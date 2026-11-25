// 1998 Volkswagen Passat Variant 1.9 TDI (B5, type 3B5) in very light silver: the soft, round-shouldered
// B5 body with a short nose, a long arched roof running back to a near-upright tailgate, big tall tail lamps
// in the rear wings only (clear reverse lamp in the bottom inboard corner), a chrome grab bar over the
// number plate, body-coloured bumpers with black corner strips, black roof rails and 15-inch steel wheels
// with plastic covers. Its DPF is giving up: the tailgate gets a film of soot (setSoot, 0..1).
import * as THREE from 'three';
import { Soup, buildBody, cutArches, decals, probe, rpoly, rect, stroke, grow, box, blob, cyl, tube, fromGeo, keyed, canvasTex, drawPlate, plate, assembleCar, arcPts, roofRail, tintPaint, tintGlass } from './kit.js';
import { useGlbBody, glbHooks } from './glbbody.js';
import { jobs } from '../../jobs.js';
import { part, planLine, sideLine, sweep, clip2, foldFlanks, lathe } from './parts.js';

// real car: 4680 x 1740 x 1500 mm (with rails), wheelbase 2703, track 1498 / 1500, 195/65 R15.
// Overhangs about 930 front / 1047 rear.
const DIMS = { length: 4.68, width: 1.74, height: 1.5, wheelbase: 2.703, track: 1.5, trackFront: 1.498, wheelRadius: 0.317 };
const HZ = DIMS.wheelbase / 2;
const ZF = -HZ - 0.93, ZR = HZ + 1.047;       // bumper faces
const ZFB = ZF + 0.07, ZRB = ZR - 0.07;       // body shell ends behind the bumpers
const HW = DIMS.width / 2;
const AY = 0.32, AR = 0.37;                   // wheel arches
const WAIST = [[ZFB, 0.7], [-1.0, 0.78], [1.0, 0.8], [ZRB, 0.81]], FOLD = 0.004;
const PAINT = 0xbcc1c6;                       // very light silver (Reflexsilber)

// ---------------------------------------------------------------- wheel
// 15-inch steel wheel under a silver plastic cover: a shallow dish with ten slots round the rim and a VW
// badge in the middle. Axis on X, outer face toward +X.
function coverWheel(R, width, rimR) {
  const s = new Soup(), hw = width / 2, sh = R - rimR;
  s.add(lathe([[rimR - 0.006, -hw * 0.8], [rimR + sh * 0.3, -hw * 0.98], [rimR + sh * 0.7, -hw], [R - 0.016, -hw * 0.92], [R - 0.004, -hw * 0.76], [R, -hw * 0.45],
    [R, hw * 0.45], [R - 0.004, hw * 0.76], [R - 0.016, hw * 0.92], [rimR + sh * 0.7, hw], [rimR + sh * 0.3, hw * 0.98], [rimR - 0.006, hw * 0.8]], 'rubber', 48));
  s.add(lathe([[rimR - 0.012, hw * 0.78], [rimR - 0.012, -hw * 0.7]], 'darkalloy', 36));
  s.add(fromGeo(new THREE.CircleGeometry(rimR - 0.01, 32), { p: [-hw * 0.4, 0, 0], r: [0, Math.PI / 2, 0] }, 'well'));
  s.add(lathe([[rimR - 0.004, hw * 0.74], [rimR + 0.004, hw * 0.84], [rimR - 0.002, hw * 0.88], [rimR - 0.016, hw * 0.84]], 'darkalloy', 48));
  const rf = rimR - 0.006, xf = hw * 0.7;
  const face = new THREE.Shape(); face.absarc(0, 0, rf, 0, Math.PI * 2, false);
  for (let i = 0; i < 10; i++) {
    const a0 = i * Math.PI * 2 / 10, h = new THREE.Path();
    const r1 = rf * 0.62, r2 = rf * 0.9, da = 0.13;
    h.moveTo(Math.cos(a0 - da) * r1, Math.sin(a0 - da) * r1);
    h.lineTo(Math.cos(a0 - da * 0.75) * r2, Math.sin(a0 - da * 0.75) * r2);
    h.lineTo(Math.cos(a0 + da * 0.75) * r2, Math.sin(a0 + da * 0.75) * r2);
    h.lineTo(Math.cos(a0 + da) * r1, Math.sin(a0 + da) * r1);
    h.closePath(); face.holes.push(h);
  }
  const fg = new THREE.ExtrudeGeometry(face, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 16 });
  fg.rotateY(Math.PI / 2);
  const f = fromGeo(fg, null, 'alloy'), P = f.p;
  // the cover domes out toward the hub
  for (let i = 0; i < P.length; i += 3) { const q = Math.min(1, Math.hypot(P[i + 1], P[i + 2]) / rf); P[i] += xf + 0.02 * (1 - q * q); }
  s.add(f);
  s.add(lathe([[rf * 0.24, xf + 0.012], [rf * 0.24, xf + 0.026], [rf * 0.2, xf + 0.032], [0.001, xf + 0.034]], 'silver', 28));
  s.add(cyl(rf * 0.15, rf * 0.15, 0.003, 20, { p: [xf + 0.035, 0, 0], r: [0, 0, -Math.PI / 2] }, 'darkalloy'));
  return s;
}

// ---------------------------------------------------------------- textures
// Tail lamp, u 0 = inboard edge .. 1 = round the body corner, v 0 = bottom: red with fine fluting, the
// clear reverse lamp in the bottom inboard corner.
const REV_U = 0.2, REV_V = 0.25;
function lampTextures() {
  const tail = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#0d0202'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, glow ? '#ddd' : '#b0141a'); gr.addColorStop(0.5, glow ? '#fff' : '#c41a1e'); gr.addColorStop(1, glow ? '#ccc' : '#8e0c10');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (!glow) {
      for (let x = 0; x < w; x += 10) { g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(x + 7, 0, 3, h); }
      for (let y = 0; y < h; y += 14) { g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, y, w, 3); }
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, h * 0.04, w, h * 0.05);
    }
    // clear reverse lamp (its own mesh sits over it) and the dark frame
    g.fillStyle = glow ? '#000' : '#2a1d1c'; g.fillRect(0, h * (1 - REV_V), w * REV_U, h * REV_V);
    g.strokeStyle = '#140303'; g.lineWidth = 8; g.strokeRect(0, 0, w, h);
    g.fillStyle = '#140303'; g.fillRect(w * REV_U - 3, h * (1 - REV_V), 6, h * REV_V); g.fillRect(0, h * (1 - REV_V) - 3, w * REV_U, 6);
  };
  // Headlamp, u 0 = inboard (by the grille) .. 1 = outboard: one big clear lens over a twin reflector and
  // an amber indicator in the outer corner
  const head = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#1a1d20'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, glow ? '#fff' : '#f2f5f7'); gr.addColorStop(0.6, glow ? '#fff' : '#c8d0d6'); gr.addColorStop(1, glow ? '#ddd' : '#8e989f');
    g.fillStyle = gr; g.fillRect(4, 4, w - 8, h - 8);
    if (!glow) {
      for (const [cx, r] of [[0.28, 0.6], [0.62, 0.55]]) {
        const rg = g.createRadialGradient(cx * w, h * 0.5, 3, cx * w, h * 0.5, h * r);
        rg.addColorStop(0, 'rgba(255,255,255,0.9)'); rg.addColorStop(0.35, 'rgba(140,150,160,0.45)'); rg.addColorStop(1, 'rgba(50,60,70,0)');
        g.fillStyle = rg; g.fillRect(4, 4, w - 8, h - 8);
      }
      g.fillStyle = '#e88b12'; g.fillRect(w * 0.84, 6, w * 0.15, h - 12);
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(0, 0, w, h * 0.08);
    } else { g.fillStyle = '#000'; g.fillRect(w * 0.84, 0, w * 0.16, h); }
  };
  return { tailMap: canvasTex(256, 256, tail(false)), tailGlow: canvasTex(256, 256, tail(true)), headMap: canvasTex(256, 96, head(false)), headGlow: canvasTex(256, 96, head(true)) };
}

const AW = 1024, AH = 512;
const uvr = (x, y, w, h) => [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
const A_PLATE = uvr(0, 0, 832, 181), A_NAME = uvr(0, 200, 380, 80), A_TDI = uvr(400, 200, 220, 80), A_VW = uvr(640, 190, 120, 120);
const A_GRILLE = uvr(0, 300, 560, 110);
function atlasTex() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    drawPlate(g, 0, 0, 832, 181, '019 TDI');
    const chrome = () => {
      const gr = g.createLinearGradient(0, -30, 0, 30);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#d4d7da'); gr.addColorStop(0.55, '#8a8f94'); gr.addColorStop(1, '#eef0f2');
      return gr;
    };
    const word = (txt, cx, cy, size, sx, parts) => {
      g.save(); g.translate(cx, cy); g.scale(sx, 1); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `bold ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      g.lineWidth = 5; g.strokeStyle = '#26282a'; g.strokeText(txt, 0, 0);
      g.fillStyle = chrome(); g.fillText(txt, 0, 0);
      // (the I of TDI is red on the 110 PS engine)
      if (parts) { const w = g.measureText(txt).width; g.fillStyle = '#d0141a'; g.fillText('I', w / 2 - g.measureText('I').width / 2, 0); }
      g.restore();
    };
    word('PASSAT', 190, 241, 56, 1.25);
    word('TDI', 510, 241, 60, 1.2, true);
    // VW roundel
    const cx = 700, cy = 250, r = 52;
    g.lineWidth = 9; g.strokeStyle = chrome(); g.fillStyle = '#c9ccd0';
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = '#2b2e33'; g.fill(); g.stroke();
    g.lineWidth = 8; g.lineJoin = 'round'; g.strokeStyle = '#e6e8ea';
    g.beginPath(); g.moveTo(cx - 28, cy - 36); g.lineTo(cx, cy + 4); g.lineTo(cx + 28, cy - 36); g.stroke();
    g.beginPath(); g.moveTo(cx - 44, cy - 8); g.lineTo(cx - 22, cy + 40); g.lineTo(cx, cy + 10); g.lineTo(cx + 22, cy + 40); g.lineTo(cx + 44, cy - 8); g.stroke();
    // grille: a chrome surround round black horizontal slats
    g.fillStyle = '#d9dcdf'; g.fillRect(0, 300, 560, 110);
    g.fillStyle = '#060606'; g.fillRect(10, 310, 540, 90);
    for (let i = 0; i < 4; i++) { g.fillStyle = '#3a3d40'; g.fillRect(10, 318 + i * 22, 540, 8); }
  });
}
// Soot on the tail: thickest low down and round the tailpipe (left), thinning toward the roof, with runs
// where the rain has dragged it down. Alpha carries the pattern; the material's opacity sets how bad it is.
function sootTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const lin = g.createLinearGradient(0, 0, 0, h);
    lin.addColorStop(0, 'rgba(14,12,10,0.38)'); lin.addColorStop(0.45, 'rgba(14,12,10,0.55)'); lin.addColorStop(0.8, 'rgba(12,10,8,0.82)'); lin.addColorStop(1, 'rgba(10,8,6,0.95)');
    g.fillStyle = lin; g.fillRect(0, 0, w, h);
    // heavier round the tailpipe (bottom left as seen from behind: u 0.27)
    const rg = g.createRadialGradient(w * 0.27, h * 1.02, 4, w * 0.27, h * 1.02, h * 0.75);
    rg.addColorStop(0, 'rgba(6,5,4,0.95)'); rg.addColorStop(1, 'rgba(6,5,4,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    g.filter = 'blur(1.6px)';
    for (let i = 0; i < 90; i++) {
      const x = rnd() * w, y0 = rnd() * h * 0.75, len = 14 + rnd() * 70, a = 0.08 + rnd() * 0.22;
      const st = g.createLinearGradient(0, y0, 0, y0 + len);
      st.addColorStop(0, 'rgba(8,7,6,0)'); st.addColorStop(0.3, `rgba(8,7,6,${a})`); st.addColorStop(1, 'rgba(8,7,6,0)');
      g.fillStyle = st; g.fillRect(x, y0, 1.5 + rnd() * 3, len);
    }
    g.filter = 'none';
    // a little cleaner at the very edges, where the air flowing round the car keeps it off
    const ed = g.createLinearGradient(0, 0, w, 0);
    ed.addColorStop(0, 'rgba(0,0,0,1)'); ed.addColorStop(0.1, 'rgba(0,0,0,0)'); ed.addColorStop(0.9, 'rgba(0,0,0,0)'); ed.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = ed; g.fillRect(0, 0, w, h);
  });
}

// The same for the scanned body: a thin shell over everything that faces rearward, coloured by a map of where
// the soot ends up (G: how thick, heaviest on the bumper and round the tailpipe) and how soon it gets there
// (R: 0 at the tailpipe, 1 at the far top corner). The film spreads out from the pipe as k rises.
const SOOT_X = 0.92, SOOT_Y0 = 0.16, SOOT_H = 1.28;
let _sootMap = null;
function sootMap(pipeX, pipeY) {
  if (_sootMap) return _sootMap;
  const N = 256, d = new Uint8Array(N * N * 4);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const G = 10, grid = Array.from({ length: G * G * 2 }, rnd);
  const noise = (u, v, o) => {
    const x = u * (G - 1), y = v * (G - 1), i = Math.min(G - 2, x | 0), j = Math.min(G - 2, y | 0);
    let fx = x - i, fy = y - j; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = grid[o + j * G + i], b = grid[o + j * G + i + 1], c = grid[o + (j + 1) * G + i], e = grid[o + (j + 1) * G + i + 1];
    return a + (b - a) * fx + (c - a + (a - b - c + e) * fx) * fy;
  };
  // runs where the rain has dragged it down
  const run = new Float32Array(N * N);
  for (let i = 0; i < 110; i++) {
    const x = (rnd() * (N - 4)) | 0, top = (N * (0.25 + rnd() * 0.75)) | 0, len = 14 + rnd() * 70, a = 0.06 + rnd() * 0.2, wd = 1 + ((rnd() * 3) | 0);
    for (let j = 0; j < len; j++) { const y = top - j; if (y < 0) break; const f = Math.sin(Math.PI * j / len) * a; for (let k = 0; k < wd; k++) run[y * N + x + k] += f; }
  }
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const pu = (pipeX + SOOT_X) / (2 * SOOT_X), pv = (pipeY - SOOT_Y0) / SOOT_H;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N, v = (j + 0.5) / N;                       // v = 0 at the bottom of the bumper
    const dx = (u - pu) * 2 * SOOT_X, dy = (v - pv) * SOOT_H, dist = Math.hypot(dx, dy * 0.85);
    const when = Math.min(1, Math.max(0, dist / 1.5 + (noise(u, v, 0) - 0.5) * 0.24));
    let thick = 0.4 + 0.5 * (1 - ss(0.3, 0.72, v)) + 0.3 * Math.exp(-dist * dist / 0.2);
    thick = thick * (0.78 + 0.44 * noise(u, v, G * G)) + run[j * N + i];
    thick *= ss(0, 0.09, u) * ss(0, 0.09, 1 - u);                     // the air round the corners keeps the edges cleaner
    const o = (j * N + i) * 4;
    d[o] = Math.round(when * 255); d[o + 1] = Math.round(Math.min(0.97, thick) * 255); d[o + 3] = 255;
  }
  _sootMap = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  _sootMap.magFilter = _sootMap.minFilter = THREE.LinearFilter; _sootMap.needsUpdate = true;
  return _sootMap;
}
// The scanned body's own soot: a shell over the back of the scan (glbHooks.passatSoot, called once it is on)
// (a generator: the shell is cut from every triangle of the scan, 20 to 55 ms in one piece, so it stops on the
// way when it runs as queued work while somebody drives; see useGlbBody)
function* sootOnScan(meshes, car) {
  const mat = new THREE.MeshStandardMaterial({ map: sootMap(-0.42, 0.27),   // the tailpipe (spec.exhaust)
     transparent: true, vertexColors: true, depthWrite: false, roughness: 0.95, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  mat.userData.uK = { value: car.soot.k };
  // (called on the material, so a copy of it uses its own uK)
  mat.onBeforeCompile = function (sh) {
    sh.uniforms.uK = this.userData.uK;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uK;')
      .replace('#include <map_fragment>', `vec4 sm = texture2D( map, clamp( vMapUv, 0.0, 1.0 ) );
        diffuseColor = vec4( 0.022, 0.019, 0.017, sm.g * smoothstep( 0.8 * sm.r - 0.1, 0.8 * sm.r + 0.3, uK ) );`);
  };
  const sh = car.soot.shell = new THREE.Mesh(yield* sootShell(meshes), mat);
  sh.name = 'passat_soot_scan'; sh.renderOrder = 2; sh.visible = car.soot.k > 0.01;
  car.group.add(sh);
}
glbHooks.passatSoot = sootOnScan;

// how sooty the tailgate is: k 0 = clean .. 1 = black (on the procedural decal, or the scanned body's shell)
export function setSoot(car, k) {
  const s = car.soot;
  s.k = k = Math.min(1, k);
  s.mesh.material.opacity = k;
  s.mesh.visible = k > 0.01 && !car.glbLoaded;
  if (s.shell) { s.shell.material.userData.uK.value = k; s.shell.visible = k > 0.01; }
}
function* sootShell(meshes) {
  const pos = [], nor = [], uv = [], col = [];
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const put = (x, y, z, nx, ny, nz, w) => { pos.push(x, y, z); nor.push(nx, ny, nz); uv.push((x + SOOT_X) / (2 * SOOT_X), (y - SOOT_Y0) / SOOT_H); col.push(1, 1, 1, w); };
  for (const m of meshes) {
    const P = m.geometry.attributes.position, Q = m.geometry.attributes.normal, I = m.geometry.index;
    const decal = m.material.name?.startsWith('ov_');
    if (decal && m.material.alphaTest > 0) {
      // a cut-out badge: its quad is mostly see-through, so its soot is a disc the size of the roundel
      for (let q = 0; q + 3 < P.count; q += 4) {
        const v = [0, 1, 2, 3].map((k) => new THREE.Vector3().fromBufferAttribute(P, q + k));
        if (v[0].z < 1.7) continue;
        const n = new THREE.Vector3().fromBufferAttribute(Q, q), c = v[0].clone().add(v[2]).multiplyScalar(0.5).addScaledVector(n, 0.004);
        const ax = v[1].clone().sub(v[0]).multiplyScalar(0.5), ay = v[3].clone().sub(v[0]).multiplyScalar(0.5);
        for (let k = 0; k < 24; k++) {
          const a0 = k / 24 * Math.PI * 2, a1 = (k + 1) / 24 * Math.PI * 2;
          put(c.x, c.y, c.z, n.x, n.y, n.z, 1);
          for (const a of [a0, a1]) put(c.x + ax.x * Math.cos(a) + ay.x * Math.sin(a), c.y + ax.y * Math.cos(a) + ay.y * Math.sin(a), c.z + ax.z * Math.cos(a) + ay.z * Math.sin(a), n.x, n.y, n.z, 1);
        }
      }
      continue;
    }
    const off = decal ? 0.004 : 0.003;   // a plate sits proud of the body and hides the body's soot: it gets its own on top
    // (a plain function for the loop, a few thousand triangles a go: a loop in a generator's own body runs at half speed)
    const some = (t0, t1) => {
      for (let t = t0; t < t1; t += 3) {
        const a = I.getX(t), b = I.getX(t + 1), c = I.getX(t + 2);
        // everything behind the rear wheels except what faces forward (inside faces of the scan)
        if (P.getZ(a) + P.getZ(b) + P.getZ(c) < 5.1 || Q.getZ(a) + Q.getZ(b) + Q.getZ(c) < -0.6) continue;
        for (const i of [a, b, c]) {
          const nx = Q.getX(i), ny = Q.getY(i), nz = Q.getZ(i), y = P.getY(i);
          // none on the flanks or the roof: it thins out as the panel turns away from the airflow behind the car
          const w = (1 - ss(0.5, 0.92, Math.abs(nx))) * (1 - ss(0.4, 0.8, ny) * ss(1.0, 1.2, y)) * ss(-0.2, 0.05, nz + 0.4 * Math.abs(ny));
          put(P.getX(i) + nx * off, y + ny * off, P.getZ(i) + nz * off, nx, ny, nz, w);
        }
      }
    };
    for (let t = 0; t < I.count; t += 6000) { some(t, Math.min(I.count, t + 6000)); if (jobs.late(4)) yield; }
  }
  yield;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  return g;
}

// ---------------------------------------------------------------- the car
// scan: false keeps the modelled body (parked cars in other colours: the scanned body is silver only)
export function buildPassat({ scan = true } = {}) {
  const ZG0 = 2.02, ZG1 = ZRB - 0.1;          // tailgate glass: top and bottom edges (z)
  const YG0 = 1.36, YG1 = 0.95;               // ... and their heights
  const body = buildBody({
    top: [[ZFB, 0.48], [ZFB + 0.002, 0.58, 0.01], [ZFB + 0.025, 0.69, 0.03], [ZFB + 0.13, 0.745, 0.08], [-1.5, 0.82, 0.45],
      [-1.06, 0.868, 0.25], [-0.92, 0.895, 0.05], [-0.1, 1.42, 0.25], [0.5, 1.455, 0.8], [1.5, 1.44, 0.6], [1.92, 1.41, 0.12],
      [ZG0, YG0, 0.04], [ZG1, YG1, 0.04], [ZRB - 0.03, 0.915, 0.05], [ZRB - 0.004, 0.72, 0.06], [ZRB, 0.48]],
    bottom: [[ZFB, 0.48], [ZFB + 0.002, 0.33, 0.03], [ZFB + 0.14, 0.22, 0.06], [-1.8, 0.19, 0.1], [1.8, 0.19, 0.1], [ZRB - 0.2, 0.26, 0.06], [ZRB - 0.002, 0.4, 0.03], [ZRB, 0.48]],
    w: [[ZFB, 0.72], [-2.05, 0.8], [-1.75, 0.848], [-1.2, 0.862], [-0.4, HW - FOLD], [1.1, HW - FOLD], [1.8, 0.858], [2.15, 0.838], [ZRB, 0.8]],
    yWaist: WAIST, tuck: 0.06, ySill: 0.2,
    yBelt: [[ZFB, 0.76], [-0.92, 0.9], [1.0, 0.935], [ZRB, 0.945]],
    sh: 0.02, ledge: 0.004, ledgeH: 0.02, th: [[ZFB, 0.28], [-0.9, 0.32], [1.4, 0.32], [ZRB, 0.3]], thc: 0.12,
    rr: [[ZFB, 0.05], [-1.5, 0.08], [-0.95, 0.08], [-0.4, 0.11], [1.6, 0.11], [ZG0, 0.1], [ZRB, 0.06]],
    rs: 0.07,
    crown: [[ZFB, 0.02], [-1.5, 0.04], [-0.92, 0.04], [-0.1, 0.06], [1.6, 0.06], [ZG1, 0.045], [ZRB, 0.02]],
    bow: [[ZFB, 0.2], [-2.0, 0.1], [-1.75, 0], [-1.15, 0], [-0.92, 0.07], [-0.15, 0.04], [0.1, 0], [1.7, 0], [ZG0, 0.05], [ZG1, 0.1], [ZRB, 0.14]],
    bowN: [[ZFB, 2.6], [-1.8, 3], [-1.1, 2.6], [-0.1, 2.6], [ZG0, 2.6], [ZRB, 3.2]],
  });
  const raw = body.soup;
  const yFold = keyed(WAIST);
  foldFlanks(raw, yFold, FOLD, 0.09, 0.22, ZFB, ZRB);
  const rearP = part(raw, (x, y, z) => z > 1.3 && y > 0.18 && y < 1.2);
  const frontP = part(raw, (x, y, z) => z < -1.3 && y > 0.18 && y < 1.0);
  const sideP = part(raw, (x, y, z) => x > 0.45 && y > 0.25 && y < 1.0);
  const cabP = part(raw, (x, y, z) => y > 0.85 && z > -1.2 && z < ZRB);
  const prR = probe(rearP), prC = probe(cabP), prS = probe(sideP);

  const arches = cutArches(raw, [{ z: -HZ, y: AY, r: AR }, { z: HZ, y: AY, r: AR }], { halfWidth: HW });
  const shell = arches.soup;
  const dcS = decals(part(shell, (x) => x > 0.35)), dcR = decals(part(shell, (x, y, z) => z > 1.5));
  const dcF = decals(part(shell, (x, y, z) => z < -1.2)), dcT = decals(part(shell, (x, y) => y > 0.7));
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(arches.liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup();
  const fr = { filter: (v) => v[2] > 1.9 }, ff = { filter: (v) => v[2] < -1.9 };
  const rz = (x, y) => prR.rearZ(x, y);
  const lw = 0.0065, lo = { offset: 0.0045 };

  // --- glazing: side glass in black frames with a long quarter window, raked screen, upright tailgate glass
  const dloPts = [[-0.89, 0.91], [2.07, 0.955], [1.86, 1.345], [-0.1, 1.37]];
  pal.add(dcS.side(grow(rpoly(dloPts, 0.06, 5), 0.012), { offset: 0.003 }).pal('plastic').sym());
  {
    const inner = grow(dloPts, -0.006);
    const gF = clip2(inner, -1, 0, 0.09), gR = clip2(clip2(inner, 1, 0, -0.15), -1, 0, 1.04), gQ = clip2(inner, 1, 0, -1.1);
    glass.add(dcS.side([rpoly(gF, 0.03, 4), rpoly(gR, 0.02, 4), rpoly(gQ, 0.05, 5)], { offset: 0.0052 }).sym());
  }
  const topO = (z0, z1) => ({ minFacing: 0.3, filter: (v) => v[2] > z0 && v[2] < z1 && v[1] > 0.9 });
  const ws = rpoly([[-0.7, -0.9], [0.7, -0.9], [0.58, -0.14], [-0.58, -0.14]], 0.06, 5);
  pal.add(dcT.top(grow(ws, 0.016), { offset: 0.003, ...topO(-0.98, -0.05) }).pal('rubber'));
  glass.add(dcT.top(ws, { offset: 0.0052, ...topO(-0.98, -0.05) }));
  // big tailgate glass with well-rounded top corners in a slim black frame (seen from behind)
  const rgo = { minFacing: 0.3, filter: (v) => v[2] > 1.9 && v[1] > YG1 - 0.04 };
  const rw = rpoly([[-0.645, YG1 + 0.02], [0.645, YG1 + 0.02], [0.545, YG0 - 0.035], [-0.545, YG0 - 0.035]], 0.09, 6);
  pal.add(dcR.rear(grow(rw, 0.022), { offset: 0.003, ...rgo }).pal('gloss'));
  glass.add(dcR.rear(rw, { offset: 0.0052, ...rgo }));

  // --- shut lines: doors, bonnet, tailgate, filler flap
  const archR = AR + 0.03;
  const doorRear = [[1.06, 0.95], [1.06, 0.66], ...arcPts(HZ, AY, archR, 125, 180, 8).filter((p) => p[1] < 0.66), [HZ - archR, 0.245]];
  pal.add(dcS.side([
    ...stroke([[-0.93, 0.245], [-0.93, 0.9]], lw), ...stroke([[0.12, 0.245], [0.12, 0.925]], lw),
    ...stroke(doorRear, lw), ...stroke([[-0.93, 0.245], [HZ - archR, 0.245]], lw),
  ], { ...lo, minFacing: 0.3 }).pal('line').sym());
  const hood = [[0.74, -2.15], [0.77, -1.03]];
  pal.add(dcT.top([...stroke(hood, lw), ...stroke([[-0.77, -1.03], [0.77, -1.03]], lw)], { ...lo, minFacing: 0.4, filter: (v) => v[2] < -0.93 }).pal('line'));
  pal.add(dcT.top(stroke(hood, lw), { ...lo, minFacing: 0.4, filter: (v) => v[2] < -0.93 }).pal('line').mirrored());
  // tailgate: across the roof behind the rails, down each D-pillar close to the corner where the tail turns
  // into the side, in along the top of the lamp and down its inner edge
  const LX = 0.545;                            // tailgate edge / inner edge of the lamps
  const YT = 0.56;                             // top of the rear bumper (the load lip)
  const LY0 = YT + 0.014, LH = 0.33;           // tail lamps: bottom and height
  const YS = LY0 + LH + 0.008;
  pal.add(dcT.top(stroke([[-0.66, 1.93], [0.66, 1.93]], lw), { ...lo, minFacing: 0.3, filter: (v) => v[2] > 1.8 }).pal('line'));
  const gateSide = [[0.6, 1.4], [0.615, 1.3], [0.665, 1.2], [0.7, 1.1], [0.73, 1.0], [0.75, 0.95], [0.758, YS + 0.012], [0.748, YS],
    [LX + 0.004, YS], [LX - 0.008, YS - 0.012], [LX - 0.008, YT + 0.004]];
  pal.add(dcR.rear(stroke(gateSide, lw), { ...lo, minFacing: 0.3, ...fr }).pal('line').sym());
  const flap = rpoly([[1.78, 0.78], [1.93, 0.78], [1.93, 0.9], [1.78, 0.9]], 0.03, 3);
  pal.add(dcS.side(stroke([...flap, flap[0]], 0.005), { ...lo, minFacing: 0.3 }).pal('line'));

  // --- tail lamps: tall units in the rear wings, flush with the body and wrapping round the corner. Laid on
  // the shell as a decal, so they follow its curves exactly.
  const rearO = { minFacing: 0.5, filter: (v) => v[2] > 1.9 };
  {
    // projected from behind and 35 degrees to the side, so one decal covers the tail and the wrap round
    const A = 35 * Math.PI / 180, c = Math.cos(A), sn = Math.sin(A);
    const dcY = decals(part(shell, (x, y, z) => z > 1.9 && x > 0.3)).yaw(35);
    const uAt = (x, z) => x * c - z * sn;
    const ym = LY0 + LH / 2, zTip = ZRB - 0.12;
    const uIn = uAt(LX, rz(LX, ym)), uTip = uAt(prS.sideX(zTip, ym) || 0.86, zTip);
    const lamp = rpoly([[uIn, LY0], [uTip - 0.012, LY0 + 0.03], [uTip, LY0 + 0.07], [uTip, LY0 + LH - 0.05], [uTip - 0.01, LY0 + LH - 0.02], [uIn, LY0 + LH - 0.004]], 0.01, 3);
    const yo = { minFacing: 0.3, filter: (v) => v[2] > 1.9 && v[0] > 0.3 };
    pal.add(dcY(grow(lamp, 0.006), { offset: 0.003, ...yo }).pal('gloss').sym());
    tail.add(dcY(lamp, { offset: 0.0048, box: [uIn, LY0, uTip, LY0 + LH], ...yo }).sym());
  }
  {
    const XO = LX + 0.42;
    // the clear reverse lamp in the bottom inboard corner
    const rw0 = LX + 0.014, rw1 = LX + REV_U * (XO - LX) - 0.01;
    reverse.add(dcR.rear(rpoly([[rw0, LY0 + 0.014], [rw1, LY0 + 0.014], [rw1, LY0 + LH * REV_V - 0.01], [rw0, LY0 + LH * REV_V - 0.01]], 0.006, 2), { offset: 0.0062, ...rearO }).sym());
  }
  // number plate on the tailgate under the chrome grab bar, the roundel above it, PASSAT and TDI badges
  const PY = YT + 0.135;
  const pl = plate([0, PY, rz(0, PY) + 0.004], A_PLATE, {});
  atlas.add(pl.face); pal.add(pl.back);
  {
    const hy = PY + 0.088, pts = [];
    for (let i = 0; i <= 12; i++) { const x = -0.33 + 0.66 * i / 12; pts.push([x, hy + 0.008 * (1 - (x / 0.33) ** 2), rz(x, hy) + 0.01]); }
    pal.add(tube(pts, 0.019, null, 'chrome', 8));
  }
  atlas.add(dcR.rear(rect(-0.47, PY + 0.1, -0.25, PY + 0.14), { offset: 0.0045, ...fr }).uvRect(A_NAME));
  atlas.add(dcR.rear(rect(0.3, PY + 0.03, 0.42, PY + 0.07), { offset: 0.0045, ...fr }).uvRect(A_TDI));
  atlas.add(dcR.rear(rect(-0.052, PY + 0.115, 0.052, PY + 0.219), { offset: 0.0045, ...fr }).uvRect(A_VW));
  // rear wiper parked across the bottom of the glass, pivot at the middle
  {
    const pts = [];
    for (let i = 0; i <= 6; i++) { const x = -0.02 + 0.45 * i / 6, y = YG1 + 0.06 + 0.12 * i / 6; pts.push([x, y, rz(x, y) + 0.02]); }
    pal.add(tube(pts, 0.006, null, 'plastic', 5));
    pal.add(tube(pts.slice(1), 0.009, null, 'rubber', 5));
    pal.add(cyl(0.02, 0.024, 0.03, 12, { p: [-0.02, YG1 + 0.06, rz(-0.02, YG1 + 0.06) + 0.012], r: [Math.PI / 2, 0, 0] }, 'plastic'));
  }

  // --- bumpers: body-coloured, wrapping round to the arches, black strips on the corners; the rear one has a
  // black textured apron along its bottom (yBlack: below this it is black)
  const bumper = (lnB, yB, sEnd, skin, yBlack) => {
    const sC = lnB.where((p) => p.nx - 0.72), out = Math.max(...skin.map((p) => p[0]));
    const m = (t) => { const s = t * sEnd, k = Math.max(0, Math.min(1, (s - (sC - 0.16)) / 0.36)); return (1 - 0.8 * k * k * (3 - 2 * k)) * Math.max(0, Math.min(1, (1 - t) / 0.04)) ** 0.5; };
    if (yBlack === undefined) paint.add(sweep(lnB, yB, skin, { s1: sEnd, n: 56, taper: m }).sym());
    else {
      const b = yBlack - yB, i = skin.findIndex((p) => p[1] >= b), q = skin[i - 1], r = skin[i];
      const cut = [q[0] + (r[0] - q[0]) * (b - q[1]) / (r[1] - q[1]), b];
      pal.add(sweep(lnB, yB, [...skin.slice(0, i), cut], { s1: sEnd, n: 56, taper: m }).pal('bumper').sym());
      paint.add(sweep(lnB, yB, [cut, ...skin.slice(i)], { s1: sEnd, n: 56, taper: m }).sym());
    }
    return { m, out, sC };
  };
  {
    const yB = 0.42, lnB = planLine(rearP, yB, 1.5, 1, 0, 80, 160);
    const sEnd = lnB.where((p) => (HZ + archR + 0.012) - p.z);
    const b = bumper(lnB, yB, sEnd, [[-0.03, -0.205], [0.0, -0.203], [0.028, -0.19], [0.046, -0.15], [0.058, -0.09], [0.064, -0.02], [0.065, 0.06], [0.064, YT - yB - 0.03],
      [0.058, YT - yB - 0.01], [0.04, YT - yB], [-0.03, YT - yB]], 0.335);
    // black strips round the corners, lying on the bumper face, from under the lamps round to the arches
    const s0 = lnB.where((p) => p.x - 0.5), s1 = sEnd - 0.02;
    const sm = (t) => b.m((s0 + (s1 - s0) * t) / sEnd);
    pal.add(sweep(lnB, yB, [[0.064, -0.005], [0.065, 0.0], [0.065, 0.05], [0.064, 0.055]], { s0, s1, n: 24, add: 0.009, taper: (t) => sm(t) * Math.min(1, t / 0.02 + 0.6, (1 - t) / 0.02 + 0.6) }).pal('bumper').sym());
  }
  {
    const yB = 0.42, lnB = planLine(frontP, yB, -1.5, -1, 0, 80, 160);
    const sEnd = lnB.where((p) => p.z - (-HZ - archR - 0.012));
    const b = bumper(lnB, yB, sEnd, [[-0.03, -0.2], [0.0, -0.198], [0.025, -0.18], [0.04, -0.14], [0.05, -0.08], [0.055, 0.0], [0.056, YT - yB - 0.03],
      [0.05, YT - yB - 0.01], [0.035, YT - yB], [-0.03, YT - yB]]);
    const zb = (x) => lnB.at(lnB.where((p) => p.x - Math.abs(x))).z - b.out * b.m(lnB.where((p) => p.x - Math.abs(x)) / sEnd);
    // wide black intake across the bottom, with the fog lamps at its ends
    pal.add(box(0.95, 0.09, 0.012, { p: [0, 0.3, zb(0.3) + 0.004] }, 'well'));
    for (let i = 0; i < 3; i++) pal.add(box(0.95, 0.008, 0.016, { p: [0, 0.27 + i * 0.03, zb(0.3)] }, 'plastic'));
    for (const sx of [1, -1]) pal.add(cyl(0.045, 0.045, 0.02, 18, { p: [sx * 0.6, 0.31, zb(0.6) + 0.004], r: [Math.PI / 2, 0, 0] }, 'lens'));
    pal.add(sweep(lnB, yB, [[0.054, 0.04], [0.064, 0.044], [0.067, 0.065], [0.064, 0.086], [0.054, 0.09]], { s0: b.sC - 0.3, s1: sEnd - 0.03, n: 20, taper: (t) => Math.min(1, t / 0.08, (1 - t) / 0.08) }).pal('bumper').sym());
    const fp = plate([0, 0.44, zb(0.1) - 0.006], A_PLATE, { front: true });
    atlas.add(fp.face); pal.add(fp.back);
  }
  // --- slim black protective strips low on the doors
  {
    const yS = 0.47;
    const blk = [[-0.004, -0.018], [0.004, -0.017], [0.008, -0.012], [0.009, 0], [0.008, 0.012], [0.004, 0.017], [-0.004, 0.018]];
    for (const [z0, z1] of [[-0.92, 0.11], [0.13, HZ - archR - 0.05]]) {
      const l = sideLine(sideP, yS, z0, z1, 16), k = 30 * (z1 - z0), tp = (t) => Math.min(1, 0.25 + k * t, 0.25 + k * (1 - t));
      pal.add(sweep(l, yS, blk, { n: 16, taper: tp }).pal('bumper').sym());
    }
  }
  // --- exhaust: one tailpipe on the left, turned down under the bumper
  {
    const m = new THREE.Matrix4().makeTranslation(-0.42, 0.25, ZR - 0.1).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2 + 0.2));
    pal.add(cyl(0.028, 0.028, 0.14, 14, m, 'steel', true));
    pal.add(cyl(0.022, 0.022, 0.13, 10, m, 'well'));
  }

  // --- front: big clear headlamps either side of a chrome-framed grille with the roundel
  {
    const gx = 0.27, gy0 = 0.56, gy1 = 0.68;
    atlas.add(dcF.front(rect(-gx, gy0, gx, gy1), { offset: 0.004, minFacing: 0.05, ...ff }).uvRect(A_GRILLE));
    atlas.add(dcF.front(rect(-0.06, gy0 + 0.005, 0.06, gy1 + 0.005), { offset: 0.006, minFacing: 0.05, ...ff }).uvRect(A_VW));
    const hl = rpoly([[-0.8, 0.565], [-gx - 0.025, 0.56], [-gx - 0.025, 0.69], [-0.72, 0.715], [-0.81, 0.66]], 0.03, 4);
    pal.add(dcF.front(grow(hl, 0.008), { offset: 0.0025, minFacing: 0.02, ...ff }).pal('gloss').sym());
    head.add(dcF.front(hl, { offset: 0.0045, minFacing: 0.02, box: [-gx - 0.025, 0.56, -0.81, 0.715], ...ff }));
    head.add(head.mirrored());
    pal.add(dcS.side(rect(-HZ + archR + 0.08, 0.66, -HZ + archR + 0.14, 0.685, 0.008), { offset: 0.004 }).pal('amber').sym());
  }

  // --- wipers, mirrors, pull handles, roof rails, aerial
  for (const [x0, x1] of [[0.06, 0.6], [-0.5, 0.02]]) {
    const pts = [];
    for (let i = 0; i <= 6; i++) { const x = x0 + (x1 - x0) * i / 6, z = -0.92 + 0.035 * i / 6; pts.push([x, prC.topY(x, z) + 0.016, z]); }
    pal.add(tube(pts, 0.006, null, 'plastic', 5));
    pal.add(tube(pts.slice(1), 0.0085, null, 'rubber', 5));
  }
  {
    const mz = -0.8, my = 0.985, mx = prC.sideX(mz + 0.05, 0.96);
    paint.add(blob(0.2, 0.13, 0.095, { p: [mx + 0.12, my, mz], r: [0, -0.12, 0] }, null, 3.2).sym());
    pal.add(box(0.07, 0.04, 0.1, { p: [mx + 0.02, my - 0.03, mz + 0.01], r: [0, -0.15, 0] }, 'plastic').sym());
    for (const z of [-0.07, 0.95]) {
      const hy = 0.83, hx = prS.sideX(z, hy) || 0.86;
      pal.add(box(0.008, 0.045, 0.16, { p: [hx - 0.001, hy, z] }, 'plastic').sym());
      paint.add(blob(0.018, 0.034, 0.15, { p: [hx + 0.004, hy + 0.003, z] }, null, 5, 8).sym());
    }
    const rail = roofRail(prC, 0.6, 0.0, 1.88, 0.05, 'plastic', 0.014);
    pal.add(rail.sym());
    for (const z of [0.02, 1.8]) pal.add(box(0.035, 0.05, 0.1, { p: [0.6, prC.topY(0.6, z) + 0.02, z] }, 'plastic').sym());
    const ax = 0.0, az = 1.75, ay = prC.topY(ax, az);
    pal.add(cyl(0.012, 0.018, 0.03, 10, { p: [ax, ay + 0.012, az] }, 'plastic'));
    pal.add(cyl(0.003, 0.004, 0.4, 6, { p: [ax, ay + 0.19, az + 0.07], r: [0.38, 0, 0] }, 'plastic'));
  }

  // --- soot film over the whole tail (glass, gate, lamps and bumper), invisible on a clean car
  const soot = new Soup();
  {
    const dcB = decals(part(paint, (x, y, z) => z > 1.6));
    soot.add(dcB.rear(rect(-0.92, 0.16, 0.92, 1.44), { offset: 0.014, minFacing: 0.4, filter: (v) => v[2] > 1.7 }));
  }

  const wheel = { soup: coverWheel(0.317, 0.195, 0.1905 + 0.012) };
  const car = assembleCar({ id: 'passat', dims: DIMS, parts: { paint, glass, pal, tail, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel });
  const sootMat = new THREE.MeshStandardMaterial({ map: sootTex(), transparent: true, opacity: 0, depthWrite: false, roughness: 0.95, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const sootMesh = new THREE.Mesh(soot.toGeometry(), sootMat);
  sootMesh.name = 'passat_soot'; sootMesh.visible = false; sootMesh.renderOrder = 2;
  car.group.add(sootMesh);
  // k: 0 = clean .. 1 = black with soot
  // the soot decal above is shaped to the procedural tail; the scanned body gets its own shell once it is in.
  // (The state lives on the car and its materials, not in this closure, so that the copies instanceCarModel
  // makes of this car each have their own: car.soot is remapped onto the copy, see index.js.)
  car.soot = { k: 0, mesh: sootMesh, shell: null };
  car.sootFor = setSoot;
  car.setSoot = (k) => setSoot(car, k);
  tintGlass(car, 'passat', { color: 0x2c363e, metalness: 0.78, roughness: 0.05 });
  // the procedural body shows until the scanned body (public/models/passat.glb) has loaded
  tintPaint(car, 'passat', PAINT, { metalness: 0.7, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 });
  if (!scan) return car;
  return useGlbBody(car, 'passat.glb', { wheelOut: { front: 0.06, rear: 0.06 }, onLoad: 'passatSoot' });
}
