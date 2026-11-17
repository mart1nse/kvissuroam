// 1987 Mercedes-Benz 190E 2.6 (W201), pre-facelift European car in black: compact three-box saloon with a
// short, upright glasshouse, thick C-pillars, a high wedge-shaped boot, a waist fold rising to the ribbed
// tail lamps, anthracite bumpers, narrow black rubbing strips, chrome-framed grille and star.
import * as THREE from 'three';
import { Soup, buildBody, cutArches, decals, probe, clipSoup, rpoly, rect, stroke, grow, box, blob, cyl, tube, fromGeo, keyed, canvasTex, drawPlate, plate, assembleCar, arcPts } from './kit.js';
import { part, planLine, sideLine, pushTri, sweep, plateShape, clip2, foldFlanks, lathe } from './parts.js';

// real car (factory data): 4428 x 1678 x 1390 mm, wheelbase 2665, track 1437 front / 1418 rear,
// 185/65 R15 on 6J x 15. Overhangs about 785 front / 978 rear.
const DIMS = { length: 4.428, width: 1.678, height: 1.39, wheelbase: 2.665, track: 1.418, trackFront: 1.437, wheelRadius: 0.303 };
const HZ = DIMS.wheelbase / 2;
const ZF = -HZ - 0.785, ZR = HZ + 0.978;      // bumper faces
const ZFB = ZF + 0.062, ZRB = ZR - 0.054;      // body shell ends behind the bumpers
const HW = DIMS.width / 2;
const AY = 0.31, AR = 0.355;                 // wheel arches
// waist fold: from the top of the headlamps, rising through the door handles to the top of the tail lamps
const WAIST = [[ZFB, 0.762], [-1.0, 0.792], [1.0, 0.815], [ZRB, 0.83]], FOLD = 0.01;

// ---------------------------------------------------------------- local geometry helpers
// Three-pointed star in a ring, in the x-y plane (seen from the front and the back). R = ring radius.
function star3d(R, pal, ring = true) {
  const s = new Soup();
  if (ring) s.add(fromGeo(new THREE.TorusGeometry(R, R * 0.085, 6, 36), null, pal));
  const w = R * 0.17;
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + i * Math.PI * 2 / 3;
    const arm = plateShape([[-w * 0.6, 0], [0, -w], [R * 0.98, 0], [0, w]], null, R * 0.06, R * 0.03, pal);
    arm.xform(new THREE.Matrix4().makeRotationZ(a).multiply(new THREE.Matrix4().makeTranslation(0, 0, -R * 0.03)));
    s.add(arm);
  }
  return s;
}
// 15-hole "Gullideckel" light-alloy wheel with its tyre: flat silver face with a ring of 15 round holes,
// five bolts round a domed centre cap. Axis on X, outer face toward +X.
function gulliWheel(R, width, rimR) {
  const s = new Soup(), hw = width / 2, sh = R - rimR;
  s.add(lathe([[rimR - 0.006, -hw * 0.8], [rimR + sh * 0.3, -hw * 0.98], [rimR + sh * 0.7, -hw], [R - 0.016, -hw * 0.92], [R - 0.004, -hw * 0.76], [R, -hw * 0.45],
    [R, hw * 0.45], [R - 0.004, hw * 0.76], [R - 0.016, hw * 0.92], [rimR + sh * 0.7, hw], [rimR + sh * 0.3, hw * 0.98], [rimR - 0.006, hw * 0.8]], 'rubber', 48));
  // rim barrel, polished flange and the dished outer lip
  s.add(lathe([[rimR - 0.012, hw * 0.78], [rimR - 0.012, -hw * 0.7]], 'darkalloy', 36));
  s.add(lathe([[rimR - 0.004, hw * 0.74], [rimR + 0.006, hw * 0.84], [rimR + 0.002, hw * 0.9], [rimR - 0.012, hw * 0.86], [rimR - 0.02, hw * 0.62], [rimR - 0.026, hw * 0.5]], 'alloy', 48));
  s.add(fromGeo(new THREE.CircleGeometry(rimR - 0.01, 32), { p: [-hw * 0.4, 0, 0], r: [0, Math.PI / 2, 0] }, 'well'));
  s.add(cyl(rimR * 0.72, rimR * 0.72, 0.02, 32, { p: [-hw * 0.05, 0, 0], r: [0, 0, Math.PI / 2] }, 'disc'));
  // face: flat disc with 15 round holes at 72 % radius
  const rf = rimR - 0.022, xf = hw * 0.42;
  const face = new THREE.Shape(); face.absarc(0, 0, rf, 0, Math.PI * 2, false);
  for (let i = 0; i < 15; i++) {
    const a = (i + 0.5) * Math.PI * 2 / 15, h = new THREE.Path();
    h.absarc(Math.cos(a) * rf * 0.74, Math.sin(a) * rf * 0.74, rf * 0.112, 0, Math.PI * 2, true);
    face.holes.push(h);
  }
  const fg = new THREE.ExtrudeGeometry(face, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 10 });
  fg.rotateY(Math.PI / 2); fg.translate(xf, 0, 0);
  s.add(fromGeo(fg, null, 'alloy'));
  // raised inner ring, bolts, centre cap
  s.add(lathe([[rf * 0.56, xf + 0.015], [rf * 0.53, xf + 0.024], [rf * 0.42, xf + 0.027], [rf * 0.4, xf + 0.015]], 'alloy', 32));
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 + Math.PI / 2;
    s.add(cyl(0.0095, 0.0095, 0.014, 6, { p: [xf + 0.026, Math.sin(a) * rf * 0.3, Math.cos(a) * rf * 0.3], r: [0, 0, -Math.PI / 2] }, 'chrome'));
  }
  s.add(lathe([[rf * 0.2, xf + 0.014], [rf * 0.2, xf + 0.028], [rf * 0.16, xf + 0.036], [rf * 0.06, xf + 0.04], [0.001, xf + 0.041]], 'chrome', 28));
  return s;
}

// ---------------------------------------------------------------- textures
// Ribbed tail lens, u 0 = inboard (plate side) .. 1 = outboard, v 0 = bottom .. 1 = top. One row, from the
// plate outward: red (tail / fog), the clear reverse lamp over a red strip, red (tail / brake), then the
// amber indicator that wraps round the body corner.
const U_REV0 = 0.2, U_REV1 = 0.36, U_AMBER = 0.7, RIBS = 6, REV_BANDS = 4;
function lampTextures() {
  const vRev = 1 - REV_BANDS / RIBS;
  const cells = [
    [0, U_REV0, 0, 1, '#8f0509', true],
    [U_REV0, U_REV1, 0, vRev, '#8f0509', true],
    [U_REV0, U_REV1, vRev, 1, '#e4e7ea', false],
    [U_REV1, U_AMBER, 0, 1, '#8f0509', true],
    [U_AMBER, 1, 0, 1, '#e06f02', false],
  ];
  const tail = (glow) => (g, w, h) => {
    g.fillStyle = '#0d0202'; g.fillRect(0, 0, w, h);
    for (const [u0, u1, v0, v1, c, lit] of cells) {
      g.fillStyle = glow ? (lit ? '#dcdcdc' : '#000000') : c;
      g.fillRect(u0 * w, (1 - v1) * h, (u1 - u0) * w, (v1 - v0) * h);
    }
    const p = h / RIBS;
    for (let i = 0; i < RIBS; i++) {
      const y0 = i * p, gr = g.createLinearGradient(0, y0, 0, y0 + p);
      if (glow) { gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.75, 'rgba(0,0,0,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.45)'); }
      else { gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.25, 'rgba(0,0,0,0)'); gr.addColorStop(0.75, 'rgba(0,0,0,0.1)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)'); }
      g.fillStyle = gr; g.fillRect(0, y0, w, p);
    }
    // cell dividers and the dark rim of the housing
    g.fillStyle = '#080101';
    for (const u of [U_REV0, U_REV1, U_AMBER]) g.fillRect(u * w - 2, 0, 4, h);
    g.strokeStyle = '#050101'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
  };
  const head = (glow) => (g, w, h) => {
    // u 0 = inboard .. 1 = outboard: flat-glass headlamp with the amber indicator at the outer end
    g.fillStyle = glow ? '#000' : '#1a1d20'; g.fillRect(0, 0, w, h);
    const split = 0.76;
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, glow ? '#fff' : '#f1f4f6'); gr.addColorStop(0.55, glow ? '#fff' : '#c8d0d5'); gr.addColorStop(1, glow ? '#ddd' : '#8e989f');
    g.fillStyle = gr; g.fillRect(6, 6, split * w - 10, h - 12);
    if (!glow) {
      // reflector bowl and lens prisms
      const rg = g.createRadialGradient(split * w * 0.5, h * 0.5, 4, split * w * 0.5, h * 0.5, h * 0.75);
      rg.addColorStop(0, 'rgba(255,255,255,0.7)'); rg.addColorStop(0.35, 'rgba(160,170,180,0.25)'); rg.addColorStop(1, 'rgba(60,70,80,0.0)');
      g.fillStyle = rg; g.fillRect(6, 6, split * w - 10, h - 12);
      g.strokeStyle = 'rgba(40,50,60,0.28)'; g.lineWidth = 2;
      for (let x = 12; x < split * w - 6; x += 9) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x, h - 6); g.stroke(); }
      g.strokeStyle = 'rgba(40,50,60,0.14)'; for (let y = 20; y < h - 6; y += 26) { g.beginPath(); g.moveTo(6, y); g.lineTo(split * w - 6, y); g.stroke(); }
      g.fillStyle = '#e4800f'; g.fillRect(split * w + 4, 6, (1 - split) * w - 10, h - 12);
      g.strokeStyle = 'rgba(0,0,0,0.28)';
      for (let y = 10; y < h - 6; y += 8) { g.beginPath(); g.moveTo(split * w + 4, y); g.lineTo(w - 6, y); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 0, w, h * 0.08);
    }
  };
  return { tailMap: canvasTex(512, 128, tail(false)), tailGlow: canvasTex(512, 128, tail(true)), headMap: canvasTex(256, 96, head(false)), headGlow: canvasTex(256, 96, head(true)) };
}

const AW = 1024, AH = 512;
const uvr = (x, y, w, h) => [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
const A_PLATE = uvr(0, 0, 832, 181), A_190 = uvr(0, 200, 440, 110), A_26 = uvr(460, 200, 220, 110);
function atlasTex() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    drawPlate(g, 0, 0, 832, 181, '190 EEE');
    // chrome model lettering: "190 E" (left of the lid) and "2.6" (right)
    const chromeText = (txt, cx, cy, size, sx) => {
      g.save(); g.translate(cx, cy); g.scale(sx, 1);
      g.font = `bold ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 7; g.strokeStyle = '#1c1d1f'; g.strokeText(txt, 0, 0);
      const gr = g.createLinearGradient(0, -size * 0.45, 0, size * 0.45);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#c9ccd0'); gr.addColorStop(0.55, '#7d8288'); gr.addColorStop(1, '#e8eaec');
      g.fillStyle = gr; g.fillText(txt, 0, 0); g.restore();
    };
    chromeText('190 E', 220, 257, 104, 0.95);
    chromeText('2.6', 570, 257, 104, 0.95);
  });
}

// ---------------------------------------------------------------- the car
export function buildW201() {
  const body = buildBody({
    top: [[ZFB, 0.44], [ZFB + 0.001, 0.55, 0.01], [ZFB + 0.006, 0.765, 0.015], [ZFB + 0.035, 0.787, 0.03], [-1.6, 0.852, 0.4],
      [-1.0, 0.922, 0.25], [-0.78, 0.94, 0.04], [-0.17, 1.362, 0.16], [0.28, 1.39, 0.6], [0.84, 1.35, 0.16],
      [1.34, 0.985, 0.07], [1.8, 0.995, 0.4], [ZRB - 0.042, 1.0, 0.012], [ZRB - 0.026, 0.976, 0.015], [ZRB - 0.002, 0.83, 0.03], [ZRB, 0.44]],
    bottom: [[ZFB, 0.44], [ZFB + 0.002, 0.33, 0.03], [ZFB + 0.12, 0.235, 0.06], [-1.7, 0.215, 0.1], [1.7, 0.215, 0.1], [ZRB - 0.2, 0.27, 0.06], [ZRB - 0.002, 0.37, 0.03], [ZRB, 0.44]],
    w: [[ZFB, 0.78], [-1.95, 0.804], [-1.6, 0.822], [-1.0, 0.83], [0, HW - FOLD], [1.0, HW - FOLD], [1.7, 0.828], [2.1, 0.821], [ZRB, 0.814]],
    yWaist: WAIST, tuck: 0.045, ySill: 0.215,
    yBelt: [[ZFB, 0.86], [-0.78, 0.925], [0.9, 0.955], [ZRB, 0.965]],
    sh: 0.024, ledge: 0.01, ledgeH: 0.025, th: 0.42, thc: 0.1,
    rr: [[ZFB, 0.03], [-1.5, 0.05], [-0.95, 0.05], [-0.5, 0.07], [0.84, 0.07], [1.34, 0.05], [2.0, 0.045], [ZRB, 0.03]],
    rs: 0.05,
    crown: [[ZFB, 0.012], [-1.5, 0.03], [-0.78, 0.03], [-0.2, 0.045], [0.84, 0.045], [1.34, 0.022], [2.0, 0.018], [ZRB, 0.01]],
    bow: [[ZFB, 0.1], [-1.9, 0.05], [-1.7, 0], [-1.08, 0], [-0.78, 0.055], [-0.2, 0.035], [0.0, 0], [0.6, 0], [0.9, 0.035], [1.3, 0.05], [1.55, 0], [2.0, 0], [2.2, 0.04], [ZRB, 0.075]],
    bowN: [[ZFB, 3.2], [-1.7, 3], [-1.08, 2.6], [-0.2, 2.6], [0.9, 2.6], [1.55, 3], [ZRB, 4]],
  });
  const raw = body.soup;
  const yFold = keyed(WAIST);
  foldFlanks(raw, yFold, FOLD, 0.075, 0.2, ZFB, ZRB);
  const rearP = part(raw, (x, y, z) => z > 1.25 && y > 0.18 && y < 1.15);
  const frontP = part(raw, (x, y, z) => z < -1.25 && y > 0.18 && y < 1.0);
  const sideP = part(raw, (x, y, z) => x > 0.45 && y > 0.25 && y < 1.0);
  const cabP = part(raw, (x, y, z) => y > 0.85 && z > -1.1 && z < 1.4);
  const prR = probe(rearP), prF = probe(frontP), prC = probe(cabP);

  const arches = cutArches(raw, [{ z: -HZ, y: AY, r: AR }, { z: HZ, y: AY, r: AR }], { halfWidth: HW });
  // recessed number plate in the boot lid between the lamps
  const LY0 = 0.612, LH = 0.15, LIN = 0.322;   // tail lamps: bottom, height, inner edge
  const RX = 0.3, RY0 = LY0, RY1 = LY0 + LH + 0.004, RD = 0.014;
  let shell = clipSoup(arches.soup, (v) => Math.max(Math.abs(v[0]) - RX, RY0 - v[1], v[1] - RY1, 1.9 - v[2]));
  // decal frames bound to the parts of the shell they can land on (much faster than the whole shell)
  const dcS = decals(part(shell, (x) => x > 0.35)), dcR = decals(part(shell, (x, y, z) => z > 0.4));
  const dcF = decals(part(shell, (x, y, z) => z < -0.1)), dcT = decals(part(shell, (x, y) => y > 0.7));
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(arches.liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup();
  const fr = { filter: (v) => v[2] > 1.9 }, ff = { filter: (v) => v[2] < -1.85 };
  const rz = (x, y) => prR.rearZ(x, y);

  {
    const s = new Soup(), nx = 10, ny = 4;
    const P = (x, y, d) => [x, y, rz(x, y) - d];
    const q = (a, b, c, d, n) => { const v = (p) => ({ p, n, uv: [0, 0] }); pushTri(s, v(a), v(b), v(c)); pushTri(s, v(a), v(c), v(d)); };
    for (let i = 0; i < nx; i++) {
      const x0 = -RX + 2 * RX * i / nx, x1 = -RX + 2 * RX * (i + 1) / nx;
      for (let j = 0; j < ny; j++) {
        const y0 = RY0 + (RY1 - RY0) * j / ny, y1 = RY0 + (RY1 - RY0) * (j + 1) / ny;
        q(P(x0, y0, RD), P(x1, y0, RD), P(x1, y1, RD), P(x0, y1, RD), [0, 0, 1]);
      }
      q(P(x0, RY1, -0.001), P(x1, RY1, -0.001), P(x1, RY1, RD), P(x0, RY1, RD), [0, -1, 0]);
      q(P(x0, RY0, -0.001), P(x1, RY0, -0.001), P(x1, RY0, RD), P(x0, RY0, RD), [0, 1, 0]);
    }
    for (let j = 0; j < ny; j++) {
      const y0 = RY0 + (RY1 - RY0) * j / ny, y1 = RY0 + (RY1 - RY0) * (j + 1) / ny;
      q(P(RX, y0, -0.001), P(RX, y1, -0.001), P(RX, y1, RD), P(RX, y0, RD), [-1, 0, 0]);
      q(P(-RX, y0, -0.001), P(-RX, y1, -0.001), P(-RX, y1, RD), P(-RX, y0, RD), [1, 0, 0]);
    }
    paint.add(s);
    const zp = rz(0, 0.687) - RD;
    const pl = plate([0, 0.687, zp + 0.007], A_PLATE, { tilt: 0 });
    atlas.add(pl.face); pal.add(pl.back);
    // plate lamps in the top of the recess
    for (const x of [-0.15, 0.15]) pal.add(box(0.05, 0.005, 0.016, { p: [x, RY1 - 0.003, rz(x, RY1) - 0.012] }, 'lens'));
  }

  // --- glazing: short upright glasshouse, chrome surrounds, black (anodised) door frames
  const dlo = rpoly([[-0.715, 0.928], [0.94, 0.957], [0.635, 1.3], [-0.165, 1.305]], 0.035, 4);
  pal.add(dcS.side(grow(dlo, 0.02), { offset: 0.003 }).pal('chrome').sym());
  pal.add(dcS.side(grow(dlo, 0.009), { offset: 0.0042 }).pal('plastic').sym());
  {
    const inner = grow([[-0.715, 0.928], [0.94, 0.957], [0.635, 1.3], [-0.165, 1.305]], -0.008);
    const gF = clip2(inner, -1, 0, 0.098), gR = clip2(clip2(inner, 1, 0, -0.172), -1, 0, 0.652), gQ = clip2(inner, 1, 0, -0.678);
    glass.add(dcS.side([rpoly(gF, 0.028, 4), rpoly(gR, 0.02, 4), rpoly(gQ, 0.015, 3)], { offset: 0.0058 }).sym());
  }
  const ws = rpoly([[-0.69, 0.962], [0.69, 0.962], [0.575, 1.338], [-0.575, 1.338]], 0.06, 5);
  pal.add(dcF.front(grow(ws, 0.02), { offset: 0.003, filter: (v) => v[2] > -1.0 }).pal('chrome'));
  pal.add(dcF.front(grow(ws, 0.009), { offset: 0.0042, filter: (v) => v[2] > -1.0 }).pal('rubber'));
  glass.add(dcF.front(ws, { offset: 0.0058, filter: (v) => v[2] > -1.0 }));
  const rw = rpoly([[-0.615, 1.004], [0.615, 1.004], [0.515, 1.342], [-0.515, 1.342]], 0.06, 5);
  const rwf = { filter: (v) => v[2] > 0.5 && v[2] < 1.4 };
  pal.add(dcR.rear(grow(rw, 0.014), { offset: 0.0042, ...rwf }).pal('rubber'));
  glass.add(dcR.rear(rw, { offset: 0.0058, ...rwf }));

  // --- shut lines
  const lw = 0.0065, lo = { offset: 0.0045 };
  const archR = AR + 0.035;
  const doorRear = [[0.985, 0.957], [0.985, 0.62], ...arcPts(HZ, AY, archR, 125, 180, 8).filter((p) => p[1] < 0.62), [HZ - archR, 0.255]];
  pal.add(dcS.side([
    ...stroke([[-0.825, 0.255], [-0.825, 0.93]], lw), ...stroke([[0.135, 0.255], [0.135, 0.945]], lw),
    ...stroke(doorRear, lw), ...stroke([[-0.825, 0.255], [HZ - archR, 0.255]], lw),
  ], { ...lo, minFacing: 0.3 }).pal('line').sym());
  pal.add(dcT.top([...stroke([[0.705, -2.02], [0.715, -0.9]], lw), ...stroke([[-0.715, -0.9], [0.715, -0.9]], lw)], { ...lo, minFacing: 0.4 }).pal('line'));
  pal.add(dcT.top(stroke([[0.705, -2.02], [0.715, -0.9]], lw), { ...lo, minFacing: 0.4 }).pal('line').mirrored());
  // boot lid: deck sides, front edge behind the rear window, then down the tail and round the lamps
  const lid = [[0.705, 1.38], [0.72, 2.22]];
  pal.add(dcT.top([...stroke(lid, lw), ...stroke([[-0.705, 1.38], [0.705, 1.38]], lw)], { ...lo, minFacing: 0.4, filter: (v) => v[2] > 1.0 }).pal('line'));
  pal.add(dcT.top(stroke(lid, lw), { ...lo, minFacing: 0.4, filter: (v) => v[2] > 1.0 }).pal('line').mirrored());
  pal.add(dcR.rear(stroke([[0.72, 1.0], [0.72, LY0 + LH + 0.016], [LIN - 0.014, LY0 + LH + 0.016]], lw), { ...lo, ...fr }).pal('line').sym());
  // fuel filler flap on the right rear wing
  const flap = rpoly([[1.56, 0.775], [1.68, 0.775], [1.68, 0.885], [1.56, 0.885]], 0.02, 3);
  pal.add(dcS.side(stroke([...flap, flap[0]], 0.005), { ...lo, minFacing: 0.3 }).pal('line'));

  // --- rear lamps: one row of ribbed lenses on a black housing, from the plate panel round the corner
  const ln = planLine(rearP, 0.69, 1.3, 1, 0, 78);
  const sIn = ln.where((p) => p.x - LIN), sOut = ln.where((p) => p.nx - 0.9);
  const zOut = ln.at(sOut).z - 0.008;
  pal.add(dcR.rear(rpoly([[LIN - 0.01, LY0 - 0.008], [ln.at(sOut).x + 0.01, LY0 - 0.008], [ln.at(sOut).x + 0.01, LY0 + LH + 0.008], [LIN - 0.01, LY0 + LH + 0.008]], 0.008), { offset: 0.0018, minFacing: 0.05, filter: (v) => v[2] > zOut }).pal('gloss').sym());
  {
    const p = LH / RIBS, dB = 0.0025, dep = 0.0095;
    const prof = [[dB, 0]];
    for (let k = 0; k < RIBS; k++) prof.push([dB + dep, k * p + 0.14 * p], [dB + dep * 0.72, (k + 0.97) * p], [dB, (k + 1) * p]);
    const cut = (RIBS - REV_BANDS) * 3, lower = prof.slice(0, cut + 1), upper = prof.slice(cut);
    const sAt = (u) => sIn + (sOut - sIn) * u;
    const us = new Set(); for (let i = 0; i <= 20; i++) us.add(i / 20);
    for (const u of [U_REV0, U_REV1, U_AMBER]) us.add(u);
    const ul = [...us].sort((a, b) => a - b);
    const run = (prf, u0, u1) => {
      const steps = ul.filter((u) => u >= u0 - 1e-9 && u <= u1 + 1e-9).map(sAt);
      return sweep(ln, LY0, prf, { s0: sIn, s1: sOut, steps, uS: [sIn, sOut], vH: [0, LH], hard: true, taper: (t) => Math.min(1, t / 0.03, (1 - t) / 0.03) });
    };
    tail.add(run(prof, 0, U_REV0), run(lower, U_REV0, U_REV1), run(prof, U_REV1, 1));
    reverse.add(run(upper, U_REV0, U_REV1));
    tail.add(tail.mirrored()); reverse.add(reverse.mirrored());
  }

  // --- rear badges, the star with the lock under it, and the grip strip over the plate
  atlas.add(dcR.rear(rect(-0.635, 0.795, -0.415, 0.835), { offset: 0.0045, ...fr }).uvRect(A_190));
  atlas.add(dcR.rear(rect(0.47, 0.795, 0.575, 0.835), { offset: 0.0045, ...fr }).uvRect(A_26));
  pal.add(star3d(0.05, 'chrome').xform(new THREE.Matrix4().makeTranslation(0, 0.915, rz(0, 0.915) + 0.005)));
  pal.add(cyl(0.011, 0.011, 0.008, 14, { p: [0, 0.845, rz(0, 0.845) + 0.003], r: [Math.PI / 2, 0, 0] }, 'chrome'));
  for (let i = 0; i < 8; i++) {
    const x0 = -0.36 + 0.72 * i / 8, x1 = x0 + 0.09, xm = (x0 + x1) / 2, y = RY1 + 0.012;
    pal.add(box(Math.hypot(x1 - x0, rz(x1, y) - rz(x0, y)) + 0.002, 0.02, 0.022, { p: [xm, y, rz(xm, y) + 0.004], r: [0, Math.atan2(rz(x0, y) - rz(x1, y), x1 - x0), 0] }, 'plastic'));
  }

  // --- bumpers: anthracite plastic with a black top strip, wrapping round to the wheel arches
  const bumper = (lnB, yB, sEnd, profBlack, profChrome) => {
    const tp = (t) => Math.min(1, (1 - t) / 0.06) ** 0.5;
    pal.add(sweep(lnB, yB, profBlack, { s1: sEnd, n: 40, taper: tp }).pal('bumper').sym());
    pal.add(sweep(lnB, yB, profChrome, { s1: sEnd, n: 40, taper: tp }).pal('plastic').sym());
  };
  {
    const yB = 0.47, lnB = planLine(rearP, yB, 1.3, 1, 0, 80, 160);
    const sEnd = lnB.where((p) => (HZ + archR + 0.012) - p.z);
    // square-shouldered: flat top ledge, upright face with a raised rubbing band, tucked-under valance
    const black = [[-0.03, -0.118], [0.02, -0.12], [0.04, -0.108], [0.052, -0.085], [0.056, -0.05], [0.056, 0.012], [0.063, 0.02], [0.063, 0.064], [0.056, 0.072], [0.056, 0.1]];
    const chrome = [[0.056, 0.1], [0.055, 0.112], [0.048, 0.12], [0.03, 0.123], [-0.03, 0.123]];
    bumper(lnB, yB, sEnd, black, chrome);
  }
  {
    const yB = 0.42, lnB = planLine(frontP, yB, -1.3, -1, 0, 80, 160);
    const sEnd = lnB.where((p) => p.z - (-HZ - archR - 0.012));
    const black = [[-0.03, -0.112], [0.015, -0.116], [0.036, -0.108], [0.05, -0.085], [0.058, -0.045], [0.061, 0.0], [0.061, 0.05], [0.059, 0.088]];
    const chrome = [[0.059, 0.088], [0.0605, 0.099], [0.057, 0.112], [0.046, 0.122], [0.03, 0.126], [-0.03, 0.126]];
    bumper(lnB, yB, sEnd, black, chrome);
  }
  // --- narrow black side rubbing strips (front wing, both doors)
  {
    const yS = 0.462;
    const blk = [[-0.004, -0.021], [0.006, -0.02], [0.011, -0.013], [0.013, 0], [0.011, 0.013], [0.006, 0.02], [-0.004, 0.021]];
    const chr = [[0.0115, -0.0055], [0.0145, -0.0045], [0.0158, 0], [0.0145, 0.0045], [0.0115, 0.0055]];
    for (const [z0, z1] of [[-0.95, -0.835], [-0.815, 0.127], [0.143, 0.945]]) {
      const l = sideLine(sideP, yS, z0, z1, 16), k = 30 * (z1 - z0), tp = (t) => Math.min(1, 0.25 + k * t, 0.25 + k * (1 - t));
      pal.add(sweep(l, yS, blk, { n: 16, taper: tp }).pal('bumper').sym());
      pal.add(sweep(l, yS, chr, { n: 16, taper: tp }).pal('plastic').sym());
    }
  }

  // --- exhaust: twin small tailpipes left of centre, just showing under the bumper
  for (const x of [-0.43, -0.375]) {
    const m = new THREE.Matrix4().makeTranslation(x, 0.285, ZR - 0.115).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2 + 0.12));
    pal.add(cyl(0.02, 0.02, 0.1, 14, m, 'steel', true));
    pal.add(cyl(0.016, 0.016, 0.095, 10, m, 'well'));
  }

  // --- front: chrome-framed upright grille with vertical slats, stand-up star, flat-glass headlamps
  {
    const zG = prF.frontZ(0, 0.68), gw = 0.212, gy0 = 0.56, gy1 = 0.8;
    const outer = rpoly([[-gw, gy0], [gw, gy0], [gw + 0.006, gy1], [-gw - 0.006, gy1]], 0.03, 4);
    const inner = grow(outer, -0.024);
    pal.add(plateShape(outer, [inner], 0.04, 0.004, 'chrome').xform(new THREE.Matrix4().makeTranslation(0, 0, zG - 0.03)));
    pal.add(plateShape(inner, null, 0.01, 0, 'well').xform(new THREE.Matrix4().makeTranslation(0, 0, zG - 0.004)));
    const nS = 11, iw = gw - 0.024;
    for (let i = 0; i < nS; i++) {
      const x = -iw + 0.012 + (2 * iw - 0.024) * i / (nS - 1);
      pal.add(box(0.0065, gy1 - gy0 - 0.044, 0.026, { p: [x, (gy0 + gy1) / 2, zG - 0.014] }, 'steel'));
    }
        // stand-up star on the grille shell
    const yT = gy1 + 0.006, zT = zG - 0.012;
    pal.add(cyl(0.017, 0.021, 0.012, 16, { p: [0, yT + 0.006, zT] }, 'chrome'));
    pal.add(cyl(0.004, 0.005, 0.03, 8, { p: [0, yT + 0.026, zT] }, 'chrome'));
    pal.add(star3d(0.032, 'chrome').xform(new THREE.Matrix4().makeTranslation(0, yT + 0.072, zT)));
  }
  {
    const hl = rect(-0.758, 0.586, -0.262, 0.752, 0.01);
    pal.add(dcF.front(grow(hl, 0.011), { offset: 0.0025, minFacing: 0.05, ...ff }).pal('gloss').sym());
    head.add(dcF.front(hl, { offset: 0.0045, minFacing: 0.05, box: [-0.262, 0.586, -0.758, 0.752], ...ff }));
    head.add(head.mirrored());
    // bonnet front edge above the lamps
    pal.add(dcF.front(stroke([[-0.228, 0.77], [-0.8, 0.77]], lw), { ...lo, ...ff }).pal('line').sym());
    // black air dam under the bumper with an intake slot
    pal.add(dcF.front(rect(-0.78, 0.2, 0.78, 0.312), { offset: 0.003, minFacing: -0.6, filter: (v) => v[2] < -1.7 && v[1] < 0.32 }).pal('plastic'));
    const fp = plate([0, 0.41, ZF - 0.001], A_PLATE, { front: true });
    atlas.add(fp.face); pal.add(fp.back);
  }

  // --- single centre wiper parked along the screen base, bonnet nozzles
  {
    const pts = [];
    for (let i = 0; i <= 8; i++) { const x = 0.09 - 0.72 * i / 8, y = 0.982 + 0.012 * i / 8; pts.push([x, y, prC.frontZ(x, y) - 0.014]); }
    pal.add(tube(pts, 0.0065, null, 'plastic', 5));
    pal.add(tube(pts.slice(2).map((p) => [p[0], p[1] - 0.006, p[2] + 0.004]), 0.009, null, 'rubber', 5));
    pal.add(cyl(0.02, 0.024, 0.03, 12, { p: [0.09, 0.975, prC.frontZ(0.09, 0.975) - 0.01], r: [Math.PI / 2 - 0.6, 0, 0] }, 'plastic'));
  }

  // --- door mirrors (black), handles, aerial
  {
    const mz = -0.63, my = 0.985, mx = prC.sideX(mz, 0.97);
    pal.add(blob(0.165, 0.105, 0.075, { p: [mx + 0.105, my, mz + 0.01] }, 'plastic', 3.2).sym());
    pal.add(box(0.07, 0.035, 0.09, { p: [mx + 0.02, my - 0.03, mz + 0.005], r: [0, -0.15, 0] }, 'plastic').sym());
    for (const z of [-0.07, 0.8]) {
      const hy = yFold(z) - 0.014, hx = probe(sideP).sideX(z, hy) || 0.83;
      pal.add(box(0.006, 0.034, 0.165, { p: [hx + 0.0005, hy, z] }, 'plastic').sym());
      pal.add(blob(0.018, 0.024, 0.15, { p: [hx + 0.005, hy, z] }, 'chrome', 5, 8).sym());
    }
    const ax = 0.73, az = 1.98, ay = prR.topY(ax, az);
    pal.add(cyl(0.011, 0.013, 0.02, 10, { p: [ax, ay + 0.006, az] }, 'chrome'));
    pal.add(cyl(0.002, 0.0035, 0.34, 6, { p: [ax, ay + 0.18, az] }, 'chrome'));
  }

  const wheel = { soup: gulliWheel(0.311, 0.19, 0.1905) };
  return assembleCar({ id: 'w201', dims: DIMS, parts: { paint, glass, pal, tail, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel });
}
