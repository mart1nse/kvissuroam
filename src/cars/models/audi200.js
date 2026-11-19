// 1990 Audi 200 Avant quattro 20V (Typ 44) in dark lilac metallic: the long, smooth, flush-glazed C3 body
// with a long nose, a fast sloping tailgate, a full-width band of tail lamps (amber over red) round the
// number plate, body-coloured wrap-round bumpers with a black rubbing strip, bright roof rails and the
// flat-faced 15-inch "Aero" alloys.
import * as THREE from 'three';
import { Soup, buildBody, cutArches, decals, probe, rpoly, rect, stroke, grow, box, blob, cyl, tube, fromGeo, keyed, canvasTex, drawPlate, plate, assembleCar, arcPts, roofRail, tintPaint, tintGlass } from './kit.js';
import { useGlbBody } from './glbbody.js';
import { part, planLine, sideLine, sweep, plateShape, clip2, foldFlanks, lathe } from './parts.js';

// real car: 4807 x 1814 x 1422 mm, wheelbase 2687, track 1514 front / 1511 rear, 215/60 ZR15 on 7.5J x 15.
// Overhangs about 1030 front / 1090 rear.
const DIMS = { length: 4.807, width: 1.814, height: 1.422, wheelbase: 2.687, track: 1.511, trackFront: 1.514, wheelRadius: 0.319 };
const HZ = DIMS.wheelbase / 2;
const ZF = -HZ - 1.03, ZR = HZ + 1.09;        // bumper faces
const ZFB = ZF + 0.058, ZRB = ZR - 0.1;        // body shell ends behind the bumpers (the rear one stands well proud)
const HW = DIMS.width / 2;
const AY = 0.325, AR = 0.365;                // wheel arches
// soft shoulder line through the door handles
const WAIST = [[ZFB, 0.69], [-1.0, 0.735], [1.0, 0.765], [ZRB, 0.78]], FOLD = 0.006;
const R18 = 0.326;                           // 245/40 R18 on the BBS wheels
const PAINT = 0x50294e;                      // dark lilac metallic with a hint of deep cherry red

// ---------------------------------------------------------------- wheel
// 15-inch "Aero" alloy: a smooth, slightly dished silver disc with five small round holes round the hub and
// a ring-badged centre cap. Axis on X, outer face toward +X.
function aeroWheel(R, width, rimR) {
  const s = new Soup(), hw = width / 2, sh = R - rimR;
  s.add(lathe([[rimR - 0.006, -hw * 0.8], [rimR + sh * 0.3, -hw * 0.98], [rimR + sh * 0.7, -hw], [R - 0.016, -hw * 0.92], [R - 0.004, -hw * 0.76], [R, -hw * 0.45],
    [R, hw * 0.45], [R - 0.004, hw * 0.76], [R - 0.016, hw * 0.92], [rimR + sh * 0.7, hw], [rimR + sh * 0.3, hw * 0.98], [rimR - 0.006, hw * 0.8]], 'rubber', 48));
  s.add(lathe([[rimR - 0.012, hw * 0.78], [rimR - 0.012, -hw * 0.7]], 'darkalloy', 36));
  s.add(fromGeo(new THREE.CircleGeometry(rimR - 0.01, 32), { p: [-hw * 0.4, 0, 0], r: [0, Math.PI / 2, 0] }, 'well'));
  s.add(cyl(rimR * 0.7, rimR * 0.7, 0.02, 32, { p: [-hw * 0.05, 0, 0], r: [0, 0, Math.PI / 2] }, 'disc'));
  // rim flange and the lip the face sits in
  s.add(lathe([[rimR - 0.004, hw * 0.74], [rimR + 0.006, hw * 0.84], [rimR + 0.002, hw * 0.9], [rimR - 0.012, hw * 0.88], [rimR - 0.02, hw * 0.74]], 'alloy', 48));
  // the face: a shallow cone from the lip in to the hub, five holes at 36 % radius
  const rf = rimR - 0.018, xf = hw * 0.66;
  const face = new THREE.Shape(); face.absarc(0, 0, rf, 0, Math.PI * 2, false);
  for (let i = 0; i < 5; i++) {
    const a = (i + 0.5) * Math.PI * 2 / 5 + Math.PI / 2, h = new THREE.Path();
    h.absarc(Math.cos(a) * rf * 0.37, Math.sin(a) * rf * 0.37, rf * 0.085, 0, Math.PI * 2, true);
    face.holes.push(h);
  }
  const fg = new THREE.ExtrudeGeometry(face, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 16 });
  fg.rotateY(Math.PI / 2);
  const f = fromGeo(fg, null, 'alloy'), P = f.p;
  // dish: the face falls 14 mm from the lip to the hub, with a soft step at 62 % radius
  for (let i = 0; i < P.length; i += 3) { const q = Math.min(1, Math.hypot(P[i + 1], P[i + 2]) / rf); P[i] += xf - 0.014 * (1 - q) - (q < 0.62 ? 0.004 : 0); }
  s.add(f);
  s.add(lathe([[rf * 0.2, xf - 0.012], [rf * 0.2, xf + 0.004], [rf * 0.17, xf + 0.01], [rf * 0.05, xf + 0.013], [0.001, xf + 0.013]], 'silver', 28));
  s.add(cyl(rf * 0.1, rf * 0.1, 0.003, 16, { p: [xf + 0.0135, 0, 0], r: [0, 0, -Math.PI / 2] }, 'darkalloy'));
  return s;
}

// 18-inch BBS RS style three-piece wheel: a gold cross-spoke mesh centre (30 V-spokes each way, crossing in
// three rows of diamonds), a wide polished step lip with a ring of small bolts, a raised gold hub with five
// lug bolts and a silver cap with a black badge. Axis on X, outer face toward +X.
function bbsWheel(R, width, rimR) {
  // a wide rim in a tyre of the same width: the beads sit near the tyre's edges, the sidewalls stand almost upright
  // and the polished lip comes out flush with the tyre wall
  const s = new Soup(), hw = width / 2, sh = R - rimR, xb = hw * 0.93;
  s.add(lathe([[rimR - 0.006, -xb], [rimR + sh * 0.3, -hw * 0.99], [rimR + sh * 0.7, -hw], [R - 0.014, -hw * 0.92], [R - 0.004, -hw * 0.76], [R, -hw * 0.45],
    [R, hw * 0.45], [R - 0.004, hw * 0.76], [R - 0.014, hw * 0.92], [rimR + sh * 0.7, hw], [rimR + sh * 0.3, hw * 0.99], [rimR - 0.006, xb]], 'rubber', 56));
  s.add(lathe([[rimR - 0.012, xb], [rimR - 0.012, -xb]], 'darkalloy', 40));
  s.add(fromGeo(new THREE.CircleGeometry(rimR - 0.01, 32), { p: [-hw * 0.4, 0, 0], r: [0, Math.PI / 2, 0] }, 'well'));
  s.add(cyl(rimR * 0.72, rimR * 0.72, 0.022, 32, { p: [-hw * 0.12, 0, 0], r: [0, 0, Math.PI / 2] }, 'darkalloy'));
  // polished lip: rolled outer edge, wide flat face, then the step down to the mesh
  const rL = rimR - 0.05, xl = hw * 0.97, xo = xl - 0.03;
  s.add(lathe([[rimR - 0.004, xl - 0.012], [rimR + 0.003, xl - 0.003], [rimR + 0.001, xl + 0.002], [rimR - 0.006, xl + 0.003], [rL + 0.004, xl],
    [rL, xl - 0.004], [rL - 0.001, xo - 0.002], [rL - 0.004, xo - 0.012]], 'polished', 72));
  // the mesh's outer ring, sitting at the foot of the step
  const rM = rL - 0.012;
  s.add(lathe([[rL - 0.001, xo - 0.012], [rL - 0.001, xo], [rM, xo], [rM - 0.003, xo - 0.006]], 'gold', 60));
  // the bolts round the lip
  for (let i = 0; i < 30; i++) {
    const a = i * Math.PI * 2 / 30;
    s.add(cyl(0.0032, 0.0032, 0.004, 6, { p: [xl + 0.001, Math.sin(a) * (rL + 0.006), Math.cos(a) * (rL + 0.006)], r: [0, 0, Math.PI / 2] }, 'darkalloy'));
  }
  // cross spokes: straight bars from the hub to the ring, one family 1.5 mm behind the other
  const N = 30, D = 2 * Math.PI * 2 / N, r0 = 0.07, xh = xo - 0.016, ex = new THREE.Vector3(), ey = new THREE.Vector3(), ez = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0);
  for (const f of [1, -1]) for (let i = 0; i < N; i++) {
    const a0 = i * Math.PI * 2 / N, a1 = a0 + f * D, back = f < 0 ? 0.0015 : 0;
    const p0 = new THREE.Vector3(xh - back, Math.sin(a0) * r0, Math.cos(a0) * r0), p1 = new THREE.Vector3(xo - 0.003 - back, Math.sin(a1) * (rM + 0.002), Math.cos(a1) * (rM + 0.002));
    ey.subVectors(p1, p0); const L = ey.length(); ey.normalize();
    ex.copy(X).addScaledVector(ey, -X.dot(ey)).normalize(); ez.crossVectors(ex, ey);
    const m = new THREE.Matrix4().makeBasis(ex, ey, ez).setPosition(p0.clone().add(p1).multiplyScalar(0.5));
    s.add(box(0.016, L, 0.0062, m, 'gold'));
  }
  // raised gold hub, lug bolts, silver cap with a black badge
  s.add(lathe([[r0 + 0.003, xh - 0.02], [r0 + 0.003, xh + 0.006], [r0 - 0.005, xh + 0.011], [0.044, xh + 0.012], [0.041, xh + 0.012]], 'gold', 40));
  for (let i = 0; i < 5; i++) {
    const a = (i + 0.5) * Math.PI * 2 / 5;
    s.add(cyl(0.0065, 0.0065, 0.012, 6, { p: [xh + 0.014, Math.sin(a) * 0.05, Math.cos(a) * 0.05], r: [0, 0, Math.PI / 2] }, 'steel'));
  }
  s.add(lathe([[0.041, xh + 0.006], [0.041, xh + 0.016], [0.037, xh + 0.024], [0.024, xh + 0.029], [0.001, xh + 0.03]], 'silver', 36));
  s.add(cyl(0.014, 0.014, 0.002, 24, { p: [xh + 0.0295, 0, 0], r: [0, 0, -Math.PI / 2] }, 'darkalloy'));
  return s;
}

// ---------------------------------------------------------------- textures
// Tail lamp band, u 0 = inboard end (by the number plate) .. 1 = round the body corner; top half amber
// (indicators), bottom half red (tail / brake); the clear reverse lamp sits in the top half at U_REV0..U_REV1
// (its own mesh), and the tailgate / wing split is at U_SPLIT.
const U_REV0 = 0.4, U_REV1 = 0.58, U_SPLIT = 0.66;
function lampTextures() {
  const tail = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#0d0202'; g.fillRect(0, 0, w, h);
    g.fillStyle = glow ? '#000' : '#e58a09'; g.fillRect(0, 0, w, h * 0.5);
    g.fillStyle = glow ? '#e8e8e8' : '#a80a0c'; g.fillRect(0, h * 0.5, w, h * 0.5);
    g.fillStyle = glow ? '#000' : '#16100c'; g.fillRect(U_REV0 * w, 0, (U_REV1 - U_REV0) * w, h * 0.5);
    // fine horizontal fluting, the darker reflector strip along the bottom, cell dividers
    for (let y = 0; y < h; y += 8) { g.fillStyle = glow ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.2)'; g.fillRect(0, y + 6, w, 2); if (!glow) { g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, y, w, 2); } }
    if (!glow) { g.fillStyle = 'rgba(60,0,0,0.35)'; g.fillRect(0, h * 0.86, w, h * 0.14); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, h * 0.04, w, h * 0.07); }
    g.fillStyle = '#080303';
    g.fillRect(0, h * 0.5 - 2, w, 4);
    for (const u of [U_REV0, U_REV1, U_SPLIT]) g.fillRect(u * w - (u === U_SPLIT ? 5 : 2), 0, u === U_SPLIT ? 10 : 4, h);
    g.strokeStyle = '#050101'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
  };
  // Headlamp, u 0 = inboard (by the grille) .. 1 = outboard: one wide flush lens over twin reflectors
  const head = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#1a1d20'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, glow ? '#fff' : '#eef2f4'); gr.addColorStop(0.6, glow ? '#fff' : '#c5cdd3'); gr.addColorStop(1, glow ? '#ddd' : '#8b959c');
    g.fillStyle = gr; g.fillRect(5, 5, w - 10, h - 10);
    if (!glow) {
      for (const [cx, r] of [[0.3, 0.62], [0.72, 0.5]]) {
        const rg = g.createRadialGradient(cx * w, h * 0.5, 3, cx * w, h * 0.5, h * r);
        rg.addColorStop(0, 'rgba(255,255,255,0.8)'); rg.addColorStop(0.4, 'rgba(150,160,170,0.3)'); rg.addColorStop(1, 'rgba(50,60,70,0)');
        g.fillStyle = rg; g.fillRect(5, 5, w - 10, h - 10);
      }
      g.strokeStyle = 'rgba(40,50,60,0.25)'; g.lineWidth = 2;
      for (let x = 12; x < w - 6; x += 9) { g.beginPath(); g.moveTo(x, 5); g.lineTo(x, h - 5); g.stroke(); }
      g.fillStyle = 'rgba(30,40,50,0.5)'; g.fillRect(w * 0.515, 5, 4, h - 10);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 0, w, h * 0.08);
    }
  };
  return { tailMap: canvasTex(512, 128, tail(false)), tailGlow: canvasTex(512, 128, tail(true)), headMap: canvasTex(256, 80, head(false)), headGlow: canvasTex(256, 80, head(true)) };
}

const AW = 1024, AH = 512;
const uvr = (x, y, w, h) => [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
const A_PLATE = uvr(0, 0, 832, 181), A_AUDI = uvr(0, 200, 360, 80), A_QUATTRO = uvr(380, 200, 440, 80), A_RINGS = uvr(0, 300, 330, 110);
const A_GRILLE = uvr(350, 300, 400, 110), A_IND = uvr(770, 300, 200, 60);
function atlasTex() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    drawPlate(g, 0, 0, 832, 181, '200 QTR');
    const chrome = (draw) => {
      const gr = g.createLinearGradient(0, -30, 0, 30);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#cfd2d6'); gr.addColorStop(0.55, '#858a90'); gr.addColorStop(1, '#eceef0');
      g.lineWidth = 6; g.strokeStyle = '#1b1c1e'; g.fillStyle = gr; draw();
    };
    // wide, flat Audi lettering of the time
    const word = (txt, cx, cy, size, sx, font = 'bold') => {
      g.save(); g.translate(cx, cy); g.scale(sx, 1); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `${font} ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      chrome(() => { g.strokeText(txt, 0, 0); g.fillText(txt, 0, 0); }); g.restore();
    };
    word('Audi 200', 180, 241, 58, 1.35);
    word('quattro 20V', 600, 241, 56, 1.3, 'italic bold');
    // four rings (chrome on clear)
    const rings = (cx, cy, r, lw) => {
      for (let i = 0; i < 4; i++) {
        const x = cx + (i - 1.5) * r * 1.42;
        g.lineWidth = lw + 5; g.strokeStyle = '#17181a'; g.beginPath(); g.arc(x, cy, r, 0, 7); g.stroke();
        const gr = g.createLinearGradient(0, cy - r, 0, cy + r);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#b9bdc2'); gr.addColorStop(1, '#eceef0');
        g.lineWidth = lw; g.strokeStyle = gr; g.beginPath(); g.arc(x, cy, r, 0, 7); g.stroke();
      }
    };
    rings(165, 355, 44, 9);
    // grille: black horizontal slats in a chrome frame, rings in the middle
    g.fillStyle = '#d9dcdf'; g.fillRect(350, 300, 400, 110);
    g.fillStyle = '#050505'; g.fillRect(358, 308, 384, 94);
    for (let i = 0; i < 6; i++) { g.fillStyle = '#26282b'; g.fillRect(358, 313 + i * 15.5, 384, 6); }
    rings(550, 355, 23, 6);
    // bumper lamp: clear indicator (inboard) and fog lamp
    g.fillStyle = '#101214'; g.fillRect(770, 300, 200, 60);
    g.fillStyle = '#e9e2cf'; g.fillRect(776, 306, 104, 48);
    g.fillStyle = '#f0f3f5'; g.fillRect(886, 306, 78, 48);
    g.strokeStyle = 'rgba(40,50,60,0.3)'; g.lineWidth = 2;
    for (let x = 782; x < 964; x += 8) { g.beginPath(); g.moveTo(x, 306); g.lineTo(x, 354); g.stroke(); }
  });
}

// ---------------------------------------------------------------- the car
// scan: false keeps the modelled body (parked cars in other colours)
export function buildAudi200({ scan = true } = {}) {
  const ZG0 = 1.6, ZG1 = ZRB - 0.105;         // tailgate glass: roof edge and bottom edge
  const body = buildBody({
    top: [[ZFB, 0.5], [ZFB + 0.001, 0.6, 0.01], [ZFB + 0.008, 0.705, 0.02], [ZFB + 0.06, 0.735, 0.04], [-1.6, 0.845, 0.5],
      [-0.98, 0.92, 0.25], [-0.82, 0.935, 0.05], [-0.06, 1.385, 0.2], [0.4, 1.422, 0.8], [ZG0, 1.388, 0.2],
      [ZG1, 0.99, 0.03], [ZRB - 0.04, 0.985, 0.012], [ZRB - 0.014, 0.955, 0.015], [ZRB - 0.003, 0.82, 0.04], [ZRB, 0.5]],
    bottom: [[ZFB, 0.5], [ZFB + 0.002, 0.36, 0.03], [ZFB + 0.14, 0.235, 0.06], [-1.8, 0.2, 0.1], [1.8, 0.2, 0.1], [ZRB - 0.22, 0.27, 0.06], [ZRB - 0.002, 0.4, 0.03], [ZRB, 0.5]],
    w: [[ZFB, 0.795], [-2.1, 0.845], [-1.75, 0.882], [-1.2, 0.897], [-0.4, HW - FOLD], [1.1, HW - FOLD], [1.75, 0.893], [2.15, 0.868], [ZRB, 0.84]],
    yWaist: WAIST, tuck: 0.05, ySill: 0.2,
    yBelt: [[ZFB, 0.77], [-0.82, 0.9], [1.0, 0.925], [ZRB, 0.935]],
    sh: 0.02, ledge: 0.004, ledgeH: 0.02, th: [[ZFB, 0.3], [-0.8, 0.36], [1.4, 0.36], [ZRB, 0.3]], thc: 0.14,
    rr: [[ZFB, 0.035], [-1.5, 0.06], [-0.95, 0.06], [-0.4, 0.085], [ZG0, 0.085], [2.0, 0.07], [ZRB, 0.04]],
    rs: 0.055,
    crown: [[ZFB, 0.014], [-1.5, 0.03], [-0.82, 0.03], [-0.1, 0.05], [ZG0, 0.05], [ZG1, 0.03], [ZRB, 0.012]],
    bow: [[ZFB, 0.15], [-2.05, 0.07], [-1.8, 0], [-1.1, 0], [-0.82, 0.06], [-0.1, 0.035], [0.1, 0], [ZG0 - 0.1, 0], [ZG0 + 0.1, 0.03], [ZG1, 0.05], [ZRB, 0.1]],
    bowN: [[ZFB, 2.8], [-1.8, 3], [-1.1, 2.6], [-0.1, 2.6], [ZG0, 2.8], [ZRB, 3.6]],
  });
  const raw = body.soup;
  const yFold = keyed(WAIST);
  foldFlanks(raw, yFold, FOLD, 0.09, 0.22, ZFB, ZRB);
  const rearP = part(raw, (x, y, z) => z > 1.3 && y > 0.18 && y < 1.15);
  const frontP = part(raw, (x, y, z) => z < -1.3 && y > 0.18 && y < 1.0);
  const sideP = part(raw, (x, y, z) => x > 0.45 && y > 0.25 && y < 1.0);
  const cabP = part(raw, (x, y, z) => y > 0.85 && z > -1.1 && z < ZRB);
  const prR = probe(rearP), prF = probe(frontP), prC = probe(cabP), prS = probe(sideP);

  const arches = cutArches(raw, [{ z: -HZ, y: AY, r: AR }, { z: HZ, y: AY, r: AR }], { halfWidth: HW });
  const shell = arches.soup;
  const dcS = decals(part(shell, (x) => x > 0.35)), dcR = decals(part(shell, (x, y, z) => z > 1.4));
  const dcF = decals(part(shell, (x, y, z) => z < -1.2)), dcT = decals(part(shell, (x, y) => y > 0.7));
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(arches.liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup();
  const fr = { filter: (v) => v[2] > 2.0 }, ff = { filter: (v) => v[2] < -1.9 };
  const rz = (x, y) => prR.rearZ(x, y);
  const lw = 0.0065, lo = { offset: 0.0045 };

  // --- glazing: flush side glass in slim black frames, big raked screen, long sloping tailgate glass
  const dloPts = [[-0.79, 0.912], [2.11, 0.957], [1.63, 1.33], [-0.1, 1.342]];      // slim D-pillar, parallel to the tailgate
  pal.add(dcS.side(grow(rpoly(dloPts, 0.035, 4), 0.012), { offset: 0.003 }).pal('plastic').sym());
  {
    const inner = grow(dloPts, -0.006);
    const gF = clip2(inner, -1, 0, 0.105), gR = clip2(clip2(inner, 1, 0, -0.165), -1, 0, 1.0), gQ = clip2(inner, 1, 0, -1.055);
    glass.add(dcS.side([rpoly(gF, 0.03, 4), rpoly(gR, 0.02, 4), rpoly(gQ, 0.02, 3)], { offset: 0.0052 }).sym());
  }
  const topO = (z0, z1) => ({ minFacing: 0.3, filter: (v) => v[2] > z0 && v[2] < z1 && v[1] > 0.9 });
  const ws = rpoly([[-0.715, -0.775], [0.715, -0.775], [0.6, -0.1], [-0.6, -0.1]], 0.05, 5);
  pal.add(dcT.top(grow(ws, 0.014), { offset: 0.003, ...topO(-0.86, -0.02) }).pal('rubber'));
  glass.add(dcT.top(ws, { offset: 0.0052, ...topO(-0.86, -0.02) }));
  const rw = rpoly([[-0.63, ZG0 + 0.08], [0.63, ZG0 + 0.08], [0.72, ZG1 - 0.03], [-0.72, ZG1 - 0.03]], 0.05, 5);
  pal.add(dcT.top(grow(rw, 0.028), { offset: 0.003, ...topO(ZG0 - 0.02, ZG1 + 0.03) }).pal('gloss'));
  glass.add(dcT.top(rw, { offset: 0.0052, ...topO(ZG0, ZG1) }));
  // black lip under the glass, across the tail
  pal.add(dcT.top(rect(-0.74, ZG1 - 0.005, 0.74, ZRB - 0.015, 0.01), { offset: 0.0035, minFacing: 0.25, filter: (v) => v[2] > ZG1 - 0.02 && v[1] > 0.93 }).pal('plastic'));

  // --- shut lines: doors, bonnet, tailgate, filler flap
  const archR = AR + 0.03;
  const doorRear = [[1.03, 0.945], [1.03, 0.66], ...arcPts(HZ, AY, archR, 125, 180, 8).filter((p) => p[1] < 0.66), [HZ - archR, 0.245]];
  pal.add(dcS.side([
    ...stroke([[-0.855, 0.245], [-0.855, 0.905]], lw), ...stroke([[0.135, 0.245], [0.135, 0.92]], lw),
    ...stroke(doorRear, lw), ...stroke([[-0.855, 0.245], [HZ - archR, 0.245]], lw),
  ], { ...lo, minFacing: 0.3 }).pal('line').sym());
  const hood = [[0.76, -2.2], [0.775, -0.93]];
  pal.add(dcT.top([...stroke(hood, lw), ...stroke([[-0.775, -0.93], [0.775, -0.93]], lw)], { ...lo, minFacing: 0.4, filter: (v) => v[2] < -0.8 }).pal('line'));
  pal.add(dcT.top(stroke(hood, lw), { ...lo, minFacing: 0.4, filter: (v) => v[2] < -0.8 }).pal('line').mirrored());
  // tailgate: across the roof, down beside the glass, then down the tail between the lamp units
  const gate = [[0.7, ZG0 - 0.03], [0.775, ZG1 + 0.02], [0.78, ZRB - 0.01]];
  pal.add(dcT.top([...stroke(gate, lw), ...stroke([[-0.7, ZG0 - 0.03], [0.7, ZG0 - 0.03]], lw)], { ...lo, minFacing: 0.3, filter: (v) => v[2] > ZG0 - 0.1 }).pal('line'));
  pal.add(dcT.top(stroke(gate, lw), { ...lo, minFacing: 0.3, filter: (v) => v[2] > ZG0 - 0.1 }).pal('line').mirrored());
  const flap = rpoly([[1.78, 0.79], [1.92, 0.79], [1.92, 0.9], [1.78, 0.9]], 0.02, 3);
  pal.add(dcS.side(stroke([...flap, flap[0]], 0.005), { ...lo, minFacing: 0.3 }).pal('line'));

  // --- tail: full-width lamp band round the number plate, badge panel above it
  const LY0 = 0.68, LH = 0.195, LIN = 0.29;
  const ln = planLine(rearP, LY0 + LH / 2, 1.5, 1, 0, 80);
  const sIn = ln.where((p) => p.x - LIN), sOut = ln.where((p) => p.nx - 0.93);
  {
    const xo = ln.at(sOut).x + 0.012, zo = ln.at(sOut).z - 0.01;
    // black backing for the whole band, and the plate panel between the lamps
    pal.add(dcR.rear(rpoly([[-xo, LY0 - 0.01], [xo, LY0 - 0.01], [xo, LY0 + LH + 0.01], [-xo, LY0 + LH + 0.01]], 0.01), { offset: 0.002, minFacing: 0.04, filter: (v) => v[2] > zo }).pal('gloss'));
    // the band carries on behind the plate: amber over red, as on the lamps
    const mid = (y0, y1, c) => pal.add(dcR.rear(rect(-LIN + 0.004, y0, LIN - 0.004, y1), { offset: 0.0035, minFacing: 0.04, filter: (v) => v[2] > zo }).pal(c));
    mid(LY0 + LH / 2 + 0.002, LY0 + LH - 0.004, 'amber'); mid(LY0 + 0.004, LY0 + LH / 2 - 0.002, 'reflector');
    const lens = [[0.003, 0.003], [0.009, 0.007], [0.0105, LH / 2], [0.009, LH - 0.007], [0.003, LH - 0.003]];
    const sAt = (u) => sIn + (sOut - sIn) * u;
    const us = new Set(); for (let i = 0; i <= 24; i++) us.add(i / 24);
    for (const u of [U_REV0, U_REV1, U_SPLIT]) us.add(u);
    const ul = [...us].sort((a, b) => a - b);
    const run = (prf, u0, u1, vH) => sweep(ln, LY0, prf, { s0: sIn, s1: sOut, steps: ul.filter((u) => u >= u0 - 1e-9 && u <= u1 + 1e-9).map(sAt), uS: [sIn, sOut], vH, taper: (t) => Math.min(1, t / 0.02, (1 - t) / 0.02) });
    tail.add(run(lens, 0, 1, [0, LH]));
    reverse.add(run([[0.0115, LH * 0.53], [0.0125, LH * 0.6], [0.0125, LH - 0.012], [0.0115, LH - 0.008]], U_REV0 + 0.004, U_REV1 - 0.004, [0, LH]));
    tail.add(tail.mirrored()); reverse.add(reverse.mirrored());
    const pl = plate([0, LY0 + LH / 2 + 0.002, rz(0, LY0 + LH / 2) + 0.008], A_PLATE, {});
    atlas.add(pl.face); pal.add(pl.back);
    // plate lamps under the badge panel
    for (const x of [-0.13, 0.13]) pal.add(box(0.05, 0.008, 0.014, { p: [x, LY0 + LH + 0.004, rz(x, LY0 + LH) + 0.008] }, 'lens'));
  }
  const by = LY0 + LH + 0.04;
  atlas.add(dcR.rear(rect(-0.66, by - 0.022, -0.44, by + 0.022), { offset: 0.0045, ...fr }).uvRect(A_AUDI));
  atlas.add(dcR.rear(rect(0.38, by - 0.022, 0.66, by + 0.022), { offset: 0.0045, ...fr }).uvRect(A_QUATTRO));
  atlas.add(dcR.rear(rect(-0.1, by - 0.03, 0.1, by + 0.03), { offset: 0.0045, ...fr }).uvRect(A_RINGS));
  // tailgate lock and the black grab handle in the panel under the lamps
  pal.add(cyl(0.014, 0.014, 0.012, 14, { p: [0, LY0 - 0.042, rz(0, LY0 - 0.042) + 0.004], r: [Math.PI / 2, 0, 0] }, 'chrome'));
  pal.add(box(0.17, 0.016, 0.012, { p: [0, LY0 - 0.088, rz(0, LY0 - 0.088) + 0.003] }, 'plastic'));
  // black spoiler standing off the tailgate glass, about a fifth of the way up from its bottom edge
  {
    const z0 = ZG1 - 0.1, gy = (z) => prC.topY(0, z);
    const sh = new THREE.Shape();
    sh.moveTo(-(z0 - 0.07), gy(z0 - 0.07) + 0.006);
    sh.bezierCurveTo(-(z0 - 0.02), gy(z0 - 0.07) + 0.03, -(z0 + 0.04), gy(z0) + 0.034, -(z0 + 0.075), gy(z0) + 0.04);
    sh.lineTo(-(z0 + 0.078), gy(z0) + 0.006);
    sh.bezierCurveTo(-(z0 + 0.03), gy(z0) + 0.0, -(z0 - 0.02), gy(z0 - 0.04) + 0.0, -(z0 - 0.06), gy(z0 - 0.06) + 0.002);
    sh.closePath();
    const wd = 1.3, g = new THREE.ExtrudeGeometry(sh, { depth: wd, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.004, bevelSegments: 2, curveSegments: 8 });
    g.rotateY(Math.PI / 2); g.translate(-wd / 2, 0, 0);
    pal.add(fromGeo(g, null, 'plastic'));
  }
  // rear wiper parked across the bottom of the glass
  {
    const pts = [];
    for (let i = 0; i <= 6; i++) { const x = 0.02 + 0.5 * i / 6, z = ZG1 - 0.075 - 0.02 * i / 6; pts.push([x, prC.topY(x, z) + 0.018, z]); }
    pal.add(tube(pts, 0.006, null, 'plastic', 5));
    pal.add(tube(pts.slice(1), 0.009, null, 'rubber', 5));
    pal.add(cyl(0.02, 0.024, 0.03, 12, { p: [0.02, prC.topY(0.02, ZG1 - 0.07) + 0.01, ZG1 - 0.07] }, 'plastic'));
  }

  // --- bumpers (European): slim body-coloured mouldings that stand proud across the nose and tail, come in
  // flush with the wings round the corners, and carry a bright bead along the top edge to the wheel arches
  // Black rubbing band along the top of each bumper (and along the doors), body colour below it.
  const YT = 0.555;                            // top edge of the front bumper and of the door strips
  const bumper = (lnB, yB, sEnd, skin, yBand) => {
    const sC = lnB.where((p) => p.nx - 0.72), top = Math.max(...skin.map((p) => p[1])), out = Math.max(...skin.map((p) => p[0]));
    // full depth across the car, 18 % of it along the flanks, nothing where it meets the arch
    const m = (t) => { const s = t * sEnd, k = Math.max(0, Math.min(1, (s - (sC - 0.16)) / 0.36)); return (1 - 0.82 * k * k * (3 - 2 * k)) * Math.max(0, Math.min(1, (1 - t) / 0.04)) ** 0.5; };
    const b = yBand - yB, i = skin.findIndex((p) => p[1] >= b), q = skin[i - 1], r = skin[i];
    const cut = [q[0] + (r[0] - q[0]) * (b - q[1]) / (r[1] - q[1]), b];
    paint.add(sweep(lnB, yB, [...skin.slice(0, i), cut], { s1: sEnd, n: 56, taper: m }).sym());
    pal.add(sweep(lnB, yB, [cut, ...skin.slice(i)], { s1: sEnd, n: 56, taper: m }).pal('bumper').sym());
    pal.add(sweep(lnB, yB, [[out - 0.004, top - 0.022], [out, top - 0.019], [out, top - 0.006], [out - 0.004, top - 0.003]], { s1: sEnd, n: 56, taper: m, add: 0.004 }).pal('chrome').sym());
    return (x) => out * m(lnB.where((p) => p.x - Math.abs(x)) / sEnd);     // how far the face stands off the shell at x
  };
  {
    const yB = 0.45, YR = 0.585, lnB = planLine(rearP, yB, 1.5, 1, 0, 80, 160);
    const sEnd = lnB.where((p) => (HZ + archR + 0.012) - p.z);
    bumper(lnB, yB, sEnd, [[-0.03, -0.165], [0.0, -0.163], [0.05, -0.15], [0.08, -0.12], [0.097, -0.08], [0.105, -0.03], [0.108, 0.04], [0.11, YR - yB - 0.022],
      [0.107, YR - yB - 0.007], [0.098, YR - yB], [-0.03, YR - yB]], 0.45);
    // dark lip under the body-coloured valance
    pal.add(box(1.16, 0.03, 0.03, { p: [0, 0.29, ZRB - 0.07] }, 'plastic'));
  }
  {
    const yB = 0.44, lnB = planLine(frontP, yB, -1.5, -1, 0, 80, 160);
    const sEnd = lnB.where((p) => p.z - (-HZ - archR - 0.012));
    const off = bumper(lnB, yB, sEnd, [[-0.03, -0.205], [0.0, -0.203], [0.02, -0.19], [0.03, -0.165], [0.034, -0.13], [0.04, -0.1], [0.046, -0.05], [0.05, 0.0], [0.052, 0.05], [0.052, YT - yB - 0.022],
      [0.049, YT - yB - 0.007], [0.041, YT - yB], [-0.03, YT - yB]], 0.46);
    const zb = (x) => lnB.at(lnB.where((p) => p.x - Math.abs(x))).z - off(x);
    // centre intake under the number plate, and a slim slot each side of it
    pal.add(box(0.5, 0.062, 0.012, { p: [0, 0.335, zb(0.15) + 0.004] }, 'well'));
    for (let i = 0; i < 3; i++) pal.add(box(0.5, 0.005, 0.016, { p: [0, 0.317 + i * 0.018, zb(0.15) + 0.001] }, 'plastic'));
    // fog lamp and indicator in one long unit each side, set into the face
    for (const sx of [1, -1]) {
      const x = sx * 0.57, yaw = sx * -0.2;
      pal.add(box(0.25, 0.076, 0.012, { p: [x, 0.41, zb(0.57) + 0.003], r: [0, yaw, 0] }, 'plastic'));
      atlas.add(fromGeo(new THREE.PlaneGeometry(0.235, 0.064), { p: [x, 0.41, zb(0.57) - 0.0035], r: [0, Math.PI + yaw, 0] }).uvRect(sx > 0 ? A_IND : [A_IND[2], A_IND[1], A_IND[0], A_IND[3]]));
    }
    const fp = plate([0, 0.455, zb(0.1) - 0.006], A_PLATE, { front: true });
    atlas.add(fp.face); pal.add(fp.back);
    // chin spoiler lip
    pal.add(sweep(lnB, 0.235, [[-0.02, -0.03], [0.012, -0.03], [0.02, -0.018], [0.022, 0.006], [-0.02, 0.006]], { s1: lnB.where((p) => p.nx - 0.6), n: 30, taper: (t) => Math.min(1, (1 - t) / 0.12) }).pal('plastic').sym());
  }
  // --- side rubbing strips carrying the bumper line along the doors
  {
    const yS = YT - 0.047;
    const blk = [[-0.004, -0.044], [0.006, -0.043], [0.011, -0.036], [0.013, 0], [0.012, 0.03], [0.008, 0.038], [-0.004, 0.039]];
    const chr = [[0.0075, 0.036], [0.0105, 0.038], [0.0105, 0.046], [0.0075, 0.048]];
    for (const [z0, z1] of [[-HZ + archR + 0.02, -0.865], [-0.845, 0.127], [0.143, HZ - archR - 0.06]]) {
      const l = sideLine(sideP, yS, z0, z1, 16), k = 30 * (z1 - z0), tp = (t) => Math.min(1, 0.25 + k * t, 0.25 + k * (1 - t));
      pal.add(sweep(l, yS, blk, { n: 16, taper: tp }).pal('bumper').sym());
      pal.add(sweep(l, yS, chr, { n: 16, taper: tp }).pal('chrome').sym());
    }
  }

  // --- exhaust: twin tailpipes on the left under the bumper
  for (const x of [-0.5, -0.42]) {
    const m = new THREE.Matrix4().makeTranslation(x, 0.25, ZR - 0.12).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2 + 0.08));
    pal.add(cyl(0.03, 0.03, 0.12, 16, m, 'steel', true));
    pal.add(cyl(0.025, 0.025, 0.11, 12, m, 'well'));
  }

  // --- front: slim grille with the rings between wide flush headlamps
  {
    const gx = 0.3, gy0 = 0.6, gy1 = 0.7;
    atlas.add(dcF.front(rect(-gx, gy0, gx, gy1), { offset: 0.004, minFacing: 0.05, ...ff }).uvRect(A_GRILLE));
    const hl = rpoly([[-0.86, 0.595], [-gx - 0.02, 0.595], [-gx - 0.02, 0.705], [-0.86, 0.712]], 0.012, 3);
    pal.add(dcF.front(grow(hl, 0.01), { offset: 0.0025, minFacing: 0.02, ...ff }).pal('gloss').sym());
    head.add(dcF.front(hl, { offset: 0.0045, minFacing: 0.02, box: [-gx - 0.02, 0.595, -0.86, 0.712], ...ff }));
    head.add(head.mirrored());
    // clear side repeaters behind the front arches
    pal.add(dcS.side(rect(-HZ + archR + 0.07, 0.6, -HZ + archR + 0.13, 0.63, 0.006), { offset: 0.004 }).pal('amber').sym());
  }

  // --- wipers, mirrors, flush door handles, roof rails, aerial
  for (const [x0, x1] of [[0.08, 0.6], [-0.48, 0.04]]) {
    const pts = [];
    for (let i = 0; i <= 6; i++) { const x = x0 + (x1 - x0) * i / 6, z = -0.8 + 0.035 * i / 6; pts.push([x, prC.topY(x, z) + 0.016, z]); }
    pal.add(tube(pts, 0.006, null, 'plastic', 5));
    pal.add(tube(pts.slice(1), 0.0085, null, 'rubber', 5));
  }
  {
    const mz = -0.7, my = 0.99, mx = prC.sideX(mz + 0.05, 0.96);
    paint.add(blob(0.2, 0.125, 0.09, { p: [mx + 0.12, my, mz], r: [0, -0.12, 0] }, null, 3.4).sym());
    pal.add(box(0.07, 0.04, 0.1, { p: [mx + 0.02, my - 0.03, mz + 0.01], r: [0, -0.15, 0] }, 'plastic').sym());
    for (const z of [-0.06, 0.84]) {
      const hy = yFold(z) + 0.06, hx = prS.sideX(z, hy) || 0.9;
      pal.add(box(0.008, 0.05, 0.19, { p: [hx - 0.001, hy, z] }, 'plastic').sym());
      paint.add(blob(0.016, 0.03, 0.15, { p: [hx + 0.003, hy + 0.004, z] }, null, 5, 8).sym());
    }
    const rail = roofRail(prC, 0.63, 0.02, ZG0 - 0.08, 0.05, 'silver', 0.012);
    pal.add(rail.sym());
    for (const z of [0.1, 0.78, ZG0 - 0.16]) pal.add(box(0.03, 0.05, 0.07, { p: [0.63, prC.topY(0.63, z) + 0.02, z] }, 'plastic').sym());
    const ax = 0.3, az = ZG0 - 0.12, ay = prC.topY(ax, az);
    pal.add(cyl(0.012, 0.016, 0.02, 10, { p: [ax, ay + 0.008, az] }, 'plastic'));
    pal.add(cyl(0.002, 0.0035, 0.5, 6, { p: [ax, ay + 0.24, az + 0.09], r: [0.38, 0, 0] }, 'plastic'));
  }

  // the player's car runs 18-inch BBS wheels on low, wide 245/40 R18 tyres (the extra width goes inward) and sits
  // 2 cm lower; parked ones keep the 15-inch Aeros
  const dims = scan ? { ...DIMS, wheelRadius: R18 } : DIMS;
  const wheel = { soup: scan ? bbsWheel(R18, 0.245, 0.2286 + 0.012) : aeroWheel(0.319, 0.215, 0.1905 + 0.012) };
  const car = assembleCar({ id: 'audi200', dims, parts: { paint, glass, pal, tail, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel });
  tintGlass(car, 'audi200', { color: 0x34404a, metalness: 0.7, roughness: 0.05 });   // light factory tint
  tintPaint(car, 'audi200', PAINT, { metalness: 0.62, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.05 });
  if (!scan) return car;
  return useGlbBody(car, 'audi200.glb', { wheelOut: { front: 0.03, rear: 0.03 }, lower: 0.02 });
}
