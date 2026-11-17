// 2008 BMW M3 Coupé (E92) in Alpine white: long bonnet with the power dome, set-back cabin under a bare carbon
// roof, Hofmeister kink, flared arches, L-shaped tail lamps with light rods, a small lip on the boot lid,
// four tailpipes in a black diffuser and 19-inch twin-spoke M wheels.
import * as THREE from 'three';
import { Soup, buildBody, cutArches, decals, probe, rpoly, rect, stroke, grow, box, blob, cyl, tube, fromGeo, keyed, smooth, canvasTex, drawPlate, plate, assembleCar, arcPts, tintPaint } from './kit.js';
import { part, planLine, sideLine, sweep, clip2, foldFlanks, lathe, skinPatch, bulge, spokeFace, tyreAndRim } from './parts.js';

// real car: 4615 x 1804 x 1418 mm, wheelbase 2761, track 1540 front / 1539 rear,
// 245/35 ZR19 on 8.5J front, 265/35 ZR19 on 9.5J rear. Overhangs about 810 front / 1044 rear.
const DIMS = { length: 4.615, width: 1.804, height: 1.418, wheelbase: 2.761, track: 1.539, trackFront: 1.54, wheelRadius: 0.335, wheelRadiusFront: 0.327 };
const HZ = DIMS.wheelbase / 2;
const ZF = -HZ - 0.81, ZR = HZ + 1.044;
const HW = DIMS.width / 2;
const AY = 0.34, AR = 0.366;                 // wheel arches
// the crease through the door handle, rising toward the tail
const WAIST = [[ZF, 0.66], [-1.0, 0.755], [1.0, 0.825], [ZR, 0.86]], FOLD = 0.007;
const PAINT = 0xf2f2ee;                      // Alpine white (solid)

// ---------------------------------------------------------------- wheel
// 19-inch M double-spoke (style 220): five pairs of slim spokes, slightly dished. Axis on X, outer face +X.
function mWheel(R, width, rimR, dish) {
  const s = tyreAndRim(R, width, rimR, { caliper: 'darkalloy', disc: 0.78 });
  const hw = width / 2, rf = rimR - 0.012, x1 = hw * 0.76, x0 = x1 - dish;
  s.add(spokeFace({ n: 5, rf, r1: rf * 0.31, r2: rf * 0.9, big: 0.46, slit: 0.07, slitR1: rf * 0.4, round: 0.012, depth: 0.022, x0, x1, pal: 'alloy' }));
  // hub: cap with the roundel, five bolts
  s.add(lathe([[rf * 0.27, x0 - 0.012], [rf * 0.27, x0 + 0.012], [rf * 0.2, x0 + 0.016], [rf * 0.16, x0 + 0.01]], 'alloy', 28));
  s.add(lathe([[rf * 0.15, x0 + 0.008], [rf * 0.15, x0 + 0.014], [rf * 0.12, x0 + 0.018], [0.001, x0 + 0.019]], 'gloss', 24));
  for (let i = 0; i < 5; i++) {
    const a = (i + 0.5) * Math.PI * 2 / 5 + Math.PI / 2;
    s.add(cyl(0.009, 0.009, 0.012, 8, { p: [x0 + 0.012, Math.sin(a) * rf * 0.215, Math.cos(a) * rf * 0.215], r: [0, 0, Math.PI / 2] }, 'darkalloy'));
  }
  return s;
}

// ---------------------------------------------------------------- textures
// Tail lamp: u 0..U_LID is the slim inner unit on the boot lid, U_LID..1 the taller unit on the wing that
// runs to a point round the corner. Red throughout, with two horizontal light rods in each unit.
const U_LID = 0.4;
function lampTextures() {
  const tail = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#7c0508'; g.fillRect(0, 0, w, h);
    if (!glow) {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(255,90,80,0.35)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(30,0,0,0.45)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      // fine vertical fluting
      for (let x = 0; x < w; x += 6) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, 0, 2, h); }
    }
    // the light rods (v runs bottom to top in the model, top to bottom here)
    const rod = (x0, x1, y, t) => {
      g.fillStyle = glow ? '#fff' : '#ff3a32'; g.fillRect(x0 * w, y * h - t * h / 2, (x1 - x0) * w, t * h);
      if (!glow) { g.fillStyle = 'rgba(255,200,190,0.55)'; g.fillRect(x0 * w, y * h - t * h / 6, (x1 - x0) * w, t * h / 3); }
    };
    rod(0.03, U_LID - 0.02, 0.52, 0.07); rod(0.03, U_LID - 0.02, 0.78, 0.07);
    rod(U_LID + 0.02, 0.9, 0.3, 0.075); rod(U_LID + 0.02, 0.84, 0.62, 0.075);
    if (!glow) {
      // clear indicator strip along the top of the outer unit
      g.fillStyle = 'rgba(255,225,215,0.5)'; g.fillRect((U_LID + 0.03) * w, h * 0.06, 0.4 * w, h * 0.11);
      g.strokeStyle = '#1c0203'; g.lineWidth = 5; g.strokeRect(0, 0, w, h);
    }
  };
  // Headlamp, u 0 = inboard .. 1 = outboard: dark housing, two projectors with bright rings
  const head = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#15181b'; g.fillRect(0, 0, w, h);
    if (!glow) {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#1d2125'); gr.addColorStop(0.22, '#59616a'); gr.addColorStop(0.6, '#8f989f'); gr.addColorStop(1, '#5b636b');
      g.fillStyle = gr; g.fillRect(4, 4, w - 8, h - 8);
      g.fillStyle = '#c7ccd1'; g.fillRect(w * 0.8, h * 0.3, w * 0.17, h * 0.4);     // corner reflector
    }
    for (const [cx, r] of [[0.3, 0.34], [0.6, 0.3]]) {
      const x = cx * w, y = h * 0.52, R = r * h;
      g.fillStyle = glow ? '#555' : '#0b0c0e'; g.beginPath(); g.arc(x, y, R * 1.12, 0, 7); g.fill();
      g.strokeStyle = glow ? '#fff' : '#eef3f6'; g.lineWidth = R * 0.2; g.beginPath(); g.arc(x, y, R, 0, 7); g.stroke();
      const rg = g.createRadialGradient(x - R * 0.2, y - R * 0.2, 1, x, y, R * 0.75);
      rg.addColorStop(0, glow ? '#fff' : '#dfe8ee'); rg.addColorStop(0.5, glow ? '#ddd' : '#59636b'); rg.addColorStop(1, glow ? '#333' : '#15181b');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, R * 0.72, 0, 7); g.fill();
    }
  };
  return { tailMap: canvasTex(512, 128, tail(false)), tailGlow: canvasTex(512, 128, tail(true)), headMap: canvasTex(256, 96, head(false)), headGlow: canvasTex(256, 96, head(true)) };
}

const AW = 1024, AH = 512;
const uvr = (x, y, w, h) => [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
const A_PLATE = uvr(0, 0, 832, 181), A_KIDNEY = uvr(0, 200, 300, 140), A_ROUNDEL = uvr(320, 200, 140, 140), A_M3 = uvr(480, 200, 260, 110);
const A_GILL = uvr(0, 360, 360, 100), A_MESH = uvr(400, 360, 256, 128);
const flipU = (r) => [r[2], r[1], r[0], r[3]];
function atlasTex() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    drawPlate(g, 0, 0, 832, 181, '420 BMW');
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    const chromeGrad = (y0, y1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#cfd2d6'); gr.addColorStop(0.55, '#868b91'); gr.addColorStop(1, '#eceef0'); return gr; };
    // kidney: chrome surround, black vertical slats (u 0 = centre of the car)
    g.fillStyle = chromeGrad(200, 340); rr(2, 202, 296, 136, 40); g.fill();
    g.fillStyle = '#060606'; rr(16, 216, 268, 108, 30); g.fill();
    g.save(); rr(16, 216, 268, 108, 30); g.clip();
    for (let x = 30; x < 284; x += 21) { g.fillStyle = '#2a2c2f'; g.fillRect(x, 216, 7, 108); g.fillStyle = '#4b4e52'; g.fillRect(x, 216, 2, 108); }
    g.restore();
    // roundel
    {
      const cx = 390, cy = 270, R = 66;
      g.fillStyle = '#d9dcdf'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
      g.fillStyle = '#0a0a0b'; g.beginPath(); g.arc(cx, cy, R - 5, 0, 7); g.fill();
      for (let q = 0; q < 4; q++) { g.fillStyle = q % 2 ? '#f4f6f8' : '#1c78c8'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R * 0.58, q * Math.PI / 2, (q + 1) * Math.PI / 2); g.closePath(); g.fill(); }
      g.strokeStyle = '#d9dcdf'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R * 0.58, 0, 7); g.stroke();
    }
    // M3 badge: three stripes and the chrome characters
    {
      const x = 486, y = 212;
      for (const [i, c] of [[0, '#4aa3e0'], [1, '#1b2f7a'], [2, '#e0202a']]) { g.fillStyle = c; g.beginPath(); g.moveTo(x + 22 + i * 22, y + 8); g.lineTo(x + 42 + i * 22, y + 8); g.lineTo(x + 20 + i * 22, y + 84); g.lineTo(x + i * 22, y + 84); g.closePath(); g.fill(); }
      g.save(); g.translate(x + 168, y + 48); g.transform(1, 0, -0.22, 1, 0, 0); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 92px "Helvetica Neue", Helvetica, Arial, sans-serif';
      g.lineWidth = 7; g.strokeStyle = '#17181a'; g.strokeText('M3', 0, 0); g.fillStyle = chromeGrad(-40, 40); g.fillText('M3', 0, 0); g.restore();
    }
    // side gill: black slot, chrome bar with the indicator, small M3
    g.fillStyle = '#08090a'; rr(2, 362, 356, 96, 26); g.fill();
    g.fillStyle = chromeGrad(380, 420); rr(40, 388, 300, 34, 14); g.fill();
    g.fillStyle = '#f1ede4'; rr(48, 394, 120, 22, 8); g.fill();
    g.font = 'italic bold 30px Helvetica, Arial, sans-serif'; g.fillStyle = '#111'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('M3', 270, 406);
    // honeycomb mesh for the intakes
    g.fillStyle = '#050505'; g.fillRect(400, 360, 256, 128);
    g.strokeStyle = '#26282b'; g.lineWidth = 3;
    for (let y = 0; y < 9; y++) for (let x = 0; x < 13; x++) { const cx = 410 + x * 21 + (y % 2) * 10.5, cy = 368 + y * 15; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; g.lineTo(cx + Math.cos(a) * 10, cy + Math.sin(a) * 8.5); } g.closePath(); g.stroke(); }
  });
}

// ---------------------------------------------------------------- the car
export function buildM3() {
  const ZC = -0.72, ZH = 0.0;                 // cowl and windscreen header
  const ZG0 = 1.1, ZG1 = 1.8;                 // rear glass: roof edge and bottom edge (the boot lid is 0.6 m long)
  const body = buildBody({
    top: [[ZF, 0.42], [ZF + 0.004, 0.56, 0.03], [ZF + 0.03, 0.665, 0.03], [ZF + 0.1, 0.73, 0.05], [-1.5, 0.87, 0.5],
      [ZC - 0.1, 0.955, 0.2], [ZC, 0.965, 0.05], [ZH, 1.375, 0.25], [0.42, 1.418, 0.9], [ZG0, 1.362, 0.4],
      [ZG1, 1.04, 0.08], [ZR - 0.12, 1.046, 0.03], [ZR - 0.066, 1.06, 0.008], [ZR - 0.05, 1.034, 0.008], [ZR - 0.034, 0.8, 0.06], [ZR - 0.004, 0.6, 0.04], [ZR, 0.45]],
    bottom: [[ZF, 0.42], [ZF + 0.004, 0.3, 0.03], [ZF + 0.09, 0.2, 0.04], [-1.8, 0.17, 0.1], [1.85, 0.18, 0.1], [ZR - 0.22, 0.235, 0.05], [ZR - 0.004, 0.285, 0.03], [ZR, 0.45]],
    w: [[ZF, 0.8], [-1.95, 0.872], [-1.6, 0.893], [-HZ, HW - FOLD], [-0.7, 0.884], [0.5, 0.884], [1.0, 0.89], [HZ, HW - FOLD], [1.95, 0.885], [ZR, 0.835]],
    yWaist: WAIST, tuck: 0.06, ySill: 0.19,
    yBelt: [[ZF, 0.73], [ZC, 0.93], [1.0, 0.975], [ZG1, 1.0], [ZR, 1.0]],
    sh: 0.026, ledge: 0.005, ledgeH: 0.02, th: [[ZF, 0.3], [ZC, 0.44], [1.3, 0.5], [ZR, 0.32]], thc: 0.32,
    rr: [[ZF, 0.04], [-1.5, 0.07], [ZC, 0.07], [-0.1, 0.09], [ZG0, 0.09], [ZG1, 0.075], [ZR, 0.045]],
    rs: 0.05,
    crown: [[ZF, 0.012], [-1.5, 0.035], [ZC, 0.035], [ZH, 0.045], [ZG0, 0.045], [ZG1, 0.03], [ZR, 0.014]],
    bow: [[ZF, 0.27], [-1.95, 0.13], [-1.6, 0.02], [-1.05, 0], [ZC, 0.1], [ZH - 0.05, 0.06], [ZH + 0.1, 0], [ZG0 - 0.1, 0], [ZG0 + 0.1, 0.05], [ZG1, 0.09], [ZR, 0.2]],
    bowN: [[ZF, 2.5], [-1.6, 2.6], [ZC, 2.4], [ZG0, 2.6], [ZR, 3.0]],
  });
  const raw = body.soup;
  // power dome: a long raised centre section of the bonnet
  bulge(raw, 0.7, (x, z) => 0.021 * smooth((0.34 - Math.abs(x)) / 0.13) * smooth((z + 2.02) / 0.3) * smooth((ZC - 0.07 - z) / 0.14));
  const yFold = keyed(WAIST);
  foldFlanks(raw, yFold, FOLD, 0.07, 0.2, ZF + 0.3, ZR - 0.25);
  const rearP = part(raw, (x, y, z) => z > 1.3 && y > 0.16 && y < 1.2);
  const frontP = part(raw, (x, y, z) => z < -1.2 && y > 0.16 && y < 1.0);
  const sideP = part(raw, (x, y, z) => x > 0.45 && y > 0.25 && y < 1.05);
  const cabP = part(raw, (x, y, z) => y > 0.85 && z > -1.1);
  const prR = probe(rearP), prF = probe(frontP), prC = probe(cabP), prS = probe(sideP);

  const arches = cutArches(raw, [{ z: -HZ, y: AY, r: AR }, { z: HZ, y: AY, r: AR }], { halfWidth: HW });
  const shell = arches.soup;
  const dcS = decals(part(shell, (x) => x > 0.35)), dcR = decals(part(shell, (x, y, z) => z > 1.4));
  const dcF = decals(part(shell, (x, y, z) => z < -1.2)), dcT = decals(part(shell, (x, y) => y > 0.7));
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(arches.liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup(), chmsl = new Soup();
  const fr = { filter: (v) => v[2] > 2.0 }, ff = { filter: (v) => v[2] < -1.7 };
  const rz = (x, y) => prR.rearZ(x, y), fz = (x, y) => prF.frontZ(x, y);
  const lw = 0.006, lo = { offset: 0.0045 };

  // --- glazing: frameless door glass and the quarter light with the Hofmeister kink
  const dloPts = [[-0.66, 0.948], [1.33, 0.996], [1.305, 1.075], [0.9, 1.31], [-0.03, 1.34]];
  pal.add(dcS.side(grow(rpoly(dloPts, 0.035, 4), 0.014), { offset: 0.003 }).pal('gloss').sym());
  {
    const inner = grow(dloPts, -0.004);
    const gD = clip2(inner, -1, 0, 0.415), gQ = clip2(inner, 1, 0, -0.455);
    glass.add(dcS.side([rpoly(gD, 0.03, 4), rpoly(gQ, 0.025, 4)], { offset: 0.0052 }).sym());
  }
  const topO = (z0, z1, y = 0.92) => ({ minFacing: 0.3, filter: (v) => v[2] > z0 && v[2] < z1 && v[1] > y });
  const ws = rpoly([[-0.7, ZC + 0.115], [-0.35, ZC + 0.05], [0, ZC + 0.035], [0.35, ZC + 0.05], [0.7, ZC + 0.115], [0.56, ZH - 0.035], [-0.56, ZH - 0.035]], 0.04, 4);
  pal.add(dcT.top(grow(ws, 0.014), { offset: 0.003, ...topO(ZC - 0.02, ZH + 0.02) }).pal('rubber'));
  glass.add(dcT.top(ws, { offset: 0.0052, ...topO(ZC - 0.02, ZH + 0.02) }));
  const rw = rpoly([[-0.5, ZG0 + 0.07], [0.5, ZG0 + 0.07], [0.6, ZG1 - 0.1], [0.3, ZG1 - 0.055], [-0.3, ZG1 - 0.055], [-0.6, ZG1 - 0.1]], 0.04, 4);
  pal.add(dcT.top(grow(rw, 0.016), { offset: 0.003, ...topO(ZG0 - 0.02, ZG1 + 0.02, 1.0) }).pal('rubber'));
  glass.add(dcT.top(rw, { offset: 0.0052, ...topO(ZG0, ZG1, 1.0) }));
  chmsl.add(dcT.top(rect(-0.17, ZG0 + 0.085, 0.17, ZG0 + 0.103, 0.004), { offset: 0.0068, ...topO(ZG0, ZG1, 1.0) }));
  // bare carbon roof panel between the screens, shark-fin aerial at the back
  pal.add(dcT.top(rpoly([[-0.535, ZH + 0.005], [0.535, ZH + 0.005], [0.5, ZG0 + 0.03], [-0.5, ZG0 + 0.03]], 0.03, 4), { offset: 0.0032, minFacing: 0.5, filter: (v) => v[1] > 1.2 }).pal('gloss'));
  paint.add(blob(0.05, 0.055, 0.16, { p: [0, prC.topY(0, ZG0 - 0.1) + 0.02, ZG0 - 0.1], r: [-0.2, 0, 0] }, null, 2.6, 8));

  // --- shut lines: door, bonnet, boot lid, bumpers, filler flap
  const archR = AR + 0.03;
  pal.add(dcS.side([
    ...stroke([[-0.86, 0.25], [-0.86, 0.9], [-0.7, 0.945]], lw), ...stroke([[0.435, 0.25], [0.435, 0.975]], lw), ...stroke([[-0.86, 0.25], [0.435, 0.25]], lw),
    // bumper joints running to the arches
    ...stroke([[HZ + archR - 0.02, 0.69], [ZR, 0.772]], lw), ...stroke([[-HZ - archR + 0.02, 0.6], [ZF, 0.655]], lw),
  ], { ...lo, minFacing: 0.25 }).pal('line').sym());
  const hood = [[0.6, ZF + 0.2], [0.73, -1.9], [0.775, -1.2], [0.75, ZC + 0.03]];
  for (const m of [false, true]) { const s = dcT.top(stroke(hood, lw), { ...lo, minFacing: 0.35, filter: (v) => v[2] < ZC + 0.2 }).pal('line'); pal.add(m ? s.mirrored() : s); }
  const lid = [[0.5, ZG1 - 0.04], [0.66, ZG1 + 0.02], [0.67, ZR - 0.06]];
  for (const m of [false, true]) { const s = dcT.top(stroke(lid, lw), { ...lo, minFacing: 0.3, filter: (v) => v[2] > ZG1 - 0.1 }).pal('line'); pal.add(m ? s.mirrored() : s); }
  pal.add(dcR.rear([...stroke([[-0.86, 0.775], [0.86, 0.775]], lw), ...stroke([[0.672, 1.03], [0.66, 0.775]], lw), ...stroke([[-0.672, 1.03], [-0.66, 0.775]], lw)], { ...lo, minFacing: 0.2, ...fr }).pal('line'));
  const flap = rpoly([[1.72, 0.84], [1.88, 0.845], [1.88, 0.96], [1.72, 0.955]], 0.025, 3);
  pal.add(dcS.side(stroke([...flap, flap[0]], 0.005), { ...lo, minFacing: 0.3 }).pal('line'));

  // --- tail: L-shaped lamps (slim on the lid, taller on the wing, pointed round the corner)
  {
    const yL = 0.9, ln = planLine(rearP, yL, 1.5, 1, 0, 84, 150);
    const sIn = ln.where((p) => p.x - 0.3), sLid = ln.where((p) => p.x - 0.66), sOut = ln.where((p) => p.nx - 0.93);
    const VH = [0.81, 0.98], remap = (s, a, b) => { for (let i = 0; i < s.uv.length; i += 2) s.uv[i] = a + (b - a) * s.uv[i]; return s; };
    // lower and upper edges of the two units (u along each unit), m = margin for the dark surround
    const in0 = (m) => (u) => 0.85 + 0.012 * (1 - u) * (1 - u) - m, in1 = (m) => (u) => 0.95 - 0.02 * (1 - u) * (1 - u) + m;
    const out0 = (m) => (u) => 0.818 + 0.066 * smooth((u - 0.45) / 0.55) - m, out1 = (m) => (u) => 0.972 - 0.054 * smooth((u - 0.4) / 0.6) + m;
    const inner = skinPatch(rearP, ln, { s0: sIn, s1: sLid - 0.006, nu: 14, nv: 4, offset: 0.006, vH: VH, y0: in0(0), y1: in1(0) });
    const outer = skinPatch(rearP, ln, { s0: sLid + 0.006, s1: sOut, nu: 26, nv: 6, offset: 0.006, vH: VH, y0: out0(0), y1: out1(0) });
    tail.add(remap(inner, 0, U_LID)).add(remap(outer, U_LID, 1));
    reverse.add(skinPatch(rearP, ln, { s0: sIn + 0.08, s1: sLid - 0.05, nu: 8, nv: 2, offset: 0.0075, y0: () => 0.858, y1: () => 0.88 }));
    tail.add(tail.mirrored()); reverse.add(reverse.mirrored());
    // dark surround behind the lenses
    pal.add(skinPatch(rearP, ln, { s0: sIn - 0.007, s1: sLid, nu: 14, nv: 4, offset: 0.003, y0: in0(0.007), y1: in1(0.007) }).pal('gloss').sym());
    pal.add(skinPatch(rearP, ln, { s0: sLid, s1: sOut + 0.008, nu: 26, nv: 6, offset: 0.003, y0: out0(0.007), y1: out1(0.007) }).pal('gloss').sym());
    // number plate on the lid, roundel above it, M3 badge on the right
    const pl = plate([0, 0.845, rz(0, 0.845) + 0.008], A_PLATE, { tilt: -0.06 });
    atlas.add(pl.face); pal.add(pl.back);
    for (const x of [-0.12, 0.12]) pal.add(box(0.05, 0.008, 0.014, { p: [x, 0.915, rz(x, 0.915) + 0.006] }, 'lens'));
    atlas.add(dcR.rear(rect(-0.037, 0.94, 0.037, 1.014), { offset: 0.005, minFacing: 0.1, ...fr }).uvRect(A_ROUNDEL));
    atlas.add(dcR.rear(rect(0.41, 0.957, 0.55, 1.016), { offset: 0.005, minFacing: 0.1, ...fr }).uvRect(A_M3));
    // slim reflectors in the bumper
    pal.add(dcR.rear(rect(0.5, 0.5, 0.76, 0.527, 0.008), { offset: 0.0045, minFacing: 0.1, ...fr }).pal('reflector').sym());
    // diffuser with four tailpipes
    pal.add(dcR.rear(rpoly([[-0.62, 0.19], [0.62, 0.19], [0.55, 0.4], [-0.55, 0.4]], 0.03, 4), { offset: 0.004, minFacing: 0.02, filter: (v) => v[2] > 1.9 }).pal('plastic'));
    for (const x of [0.255, 0.36]) {
      const m = new THREE.Matrix4().makeTranslation(x, 0.3, ZR - 0.062).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2 + 0.03));
      pal.add(cyl(0.043, 0.043, 0.13, 20, m, 'chrome', true).sym());
      pal.add(cyl(0.035, 0.035, 0.12, 14, m, 'well').sym());
    }
    for (const x of [-0.17, 0, 0.17]) pal.add(box(0.012, 0.09, 0.05, { p: [x, 0.305, (rz(x, 0.32) || ZR - 0.05) - 0.012] }, 'plastic'));
  }

  // --- front: kidneys, swept headlamps, three big intakes, number plate
  {
    for (const sx of [1, -1]) atlas.add(dcF.front(rpoly(sx > 0 ? [[-0.33, 0.568], [-0.022, 0.568], [-0.022, 0.708], [-0.33, 0.716]] : [[0.022, 0.568], [0.33, 0.568], [0.33, 0.716], [0.022, 0.708]], 0.01, 2),
      { offset: 0.0045, minFacing: 0.03, ...ff }).uvRect(sx > 0 ? flipU(A_KIDNEY) : A_KIDNEY));
    const hl = rpoly([[-0.87, 0.675], [-0.62, 0.628], [-0.375, 0.62], [-0.36, 0.7], [-0.6, 0.745], [-0.86, 0.765]], 0.014, 3);
    pal.add(dcF.front(grow(hl, 0.008), { offset: 0.0028, minFacing: 0.02, ...ff }).pal('gloss').sym());
    head.add(dcF.front(hl, { offset: 0.0048, minFacing: 0.02, box: [-0.36, 0.62, -0.87, 0.765], ...ff }));
    head.add(head.mirrored());
    // intakes
    const mesh = (poly, bx) => atlas.add(dcF.front(poly, { offset: 0.0045, minFacing: 0.02, box: bx, ...ff }).uvRect(A_MESH));
    mesh(rpoly([[-0.4, 0.245], [0.4, 0.245], [0.44, 0.42], [-0.44, 0.42]], 0.03, 3), [-0.44, 0.245, 0.44, 0.42]);
    const sidePoly = rpoly([[-0.82, 0.3], [-0.5, 0.26], [-0.5, 0.42], [-0.84, 0.45]], 0.03, 3);
    mesh(sidePoly, [-0.84, 0.26, -0.5, 0.45]);
    mesh(sidePoly.map((p) => [-p[0], p[1]]).reverse(), [0.5, 0.26, 0.84, 0.45]);
    const fp = plate([0, 0.5, fz(0, 0.5) - 0.007], A_PLATE, { front: true, tilt: 0.04 });
    atlas.add(fp.face); pal.add(fp.back);
    atlas.add(dcT.top(rect(-0.036, ZF + 0.105, 0.036, ZF + 0.177), { offset: 0.005, minFacing: 0.3, filter: (v) => v[2] < -1.8 }).uvRect(A_ROUNDEL));
    // side gills behind the front arches
    const gz0 = -HZ + archR + 0.06;
    atlas.add(dcS.side(rect(gz0, 0.672, gz0 + 0.2, 0.728), { offset: 0.0045 }).uvRect(flipU(A_GILL)));
    atlas.add(dcS.side(rect(gz0, 0.672, gz0 + 0.2, 0.728), { offset: 0.0045 }).uvRect(flipU(A_GILL)).mirrored());
  }

  // --- M side sills: a blade under the doors that kicks out ahead of the rear arch
  {
    const l = sideLine(sideP, 0.3, -HZ + archR + 0.03, HZ - archR - 0.03, 24);
    paint.add(sweep(l, 0.19, [[-0.02, -0.012], [0.02, -0.012], [0.03, 0.0], [0.03, 0.045], [0.02, 0.075], [0.0, 0.1], [-0.02, 0.105]], { n: 24, taper: (t) => Math.min(1, t / 0.06, (1 - t) / 0.04) * (0.75 + 0.25 * t) }).sym());
  }
  // --- bonnet: a slim vent each side of the power dome
  for (const m of [false, true]) {
    const v = dcT.top(rpoly([[0.4, -1.84], [0.45, -1.83], [0.485, -1.6], [0.435, -1.62]], 0.012, 3), { offset: 0.004, minFacing: 0.4, filter: (q) => q[2] < ZC }).pal('well');
    pal.add(m ? v.mirrored() : v);
  }

  // --- wipers, mirrors, door handles
  for (const [x0, x1] of [[0.06, 0.6], [-0.5, 0.02]]) {
    const pts = [];
    for (let i = 0; i <= 6; i++) { const x = x0 + (x1 - x0) * i / 6, z = ZC + 0.085 + 0.03 * Math.abs(x) + 0.02 * i / 6; pts.push([x, prC.topY(x, z) + 0.016, z]); }
    pal.add(tube(pts, 0.006, null, 'plastic', 5));
    pal.add(tube(pts.slice(1), 0.0085, null, 'rubber', 5));
  }
  {
    const mz = -0.58, my = 1.005, mx = prC.sideX(mz + 0.05, 0.97) || 0.85;
    paint.add(blob(0.2, 0.115, 0.1, { p: [mx + 0.125, my + 0.01, mz], r: [0, -0.14, 0] }, null, 3.2).sym());
    pal.add(box(0.1, 0.018, 0.035, { p: [mx + 0.035, my - 0.03, mz - 0.012], r: [0, -0.15, 0] }, 'plastic').sym());
    pal.add(box(0.1, 0.018, 0.035, { p: [mx + 0.035, my - 0.03, mz + 0.035], r: [0, -0.15, 0] }, 'plastic').sym());
    const hz = 0.27, hy = yFold(hz) + 0.022, hx = prS.sideX(hz, hy) || 0.88;
    pal.add(box(0.008, 0.05, 0.2, { p: [hx - 0.001, hy, hz] }, 'plastic').sym());
    paint.add(blob(0.018, 0.03, 0.17, { p: [hx + 0.004, hy + 0.004, hz] }, null, 5, 8).sym());
  }

  const wheel = { soup: mWheel(0.335, 0.265, 0.2413 + 0.012, 0.03) };
  const wheelFront = { soup: mWheel(0.327, 0.245, 0.2413 + 0.012, 0.014) };
  const car = assembleCar({ id: 'm3', dims: DIMS, parts: { paint, glass, pal, tail, chmsl, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel, wheelFront });
  return tintPaint(car, 'm3', PAINT, { metalness: 0, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 });
}
