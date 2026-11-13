// 2020 Toyota RAV4 (XA50) - angular SUV, dark grey metallic, squared-off black arch cladding.
import { Soup, buildBody, cutArches, decals, probe, rpoly, rect, stroke, grow, box, blob, cyl, buildWheel, canvasTex, drawPlate, plate, assembleCar, frontYaw, rearWiper, tintPaint, roofRail } from './kit.js';

// real car: 4600 x 1855 x 1685 mm, wheelbase 2690, track 1595 front / 1615 rear (18"), 225/60 R18
const DIMS = { length: 4.6, width: 1.855, height: 1.685, wheelbase: 2.69, track: 1.605, wheelRadius: 0.364 };
const ZF = -2.27, ZR = 2.33, HZ = DIMS.wheelbase / 2;

function lampTextures() {
  const tail = (glow) => (g, w, h) => {
    // u: 0 = inboard (tailgate), 1 = outboard (wraps onto the quarter panel); canvas top = lamp top
    g.fillStyle = glow ? '#240000' : '#6e080c'; g.fillRect(0, 0, w, h);
    // clear lower section (indicator / reverse) on the tailgate part and under the outer block
    g.fillStyle = glow ? '#000' : '#2c1416'; g.fillRect(0, h * 0.5, w * 0.5, h * 0.5);
    if (!glow) { g.fillStyle = '#a9a6a2'; g.fillRect(w * 0.03, h * 0.56, w * 0.3, h * 0.2); }
    g.fillStyle = glow ? '#000' : '#3a0406'; g.fillRect(w * 0.5, h * 0.66, w * 0.5, h * 0.34);
    // light signature: bar along the top that widens into an angular block outboard
    g.fillStyle = glow ? '#ffffff' : '#ff2222';
    g.beginPath(); g.moveTo(0, h * 0.2); g.lineTo(w * 0.5, h * 0.14); g.lineTo(w * 0.97, h * 0.1); g.lineTo(w * 0.93, h * 0.58);
    g.lineTo(w * 0.56, h * 0.6); g.lineTo(w * 0.47, h * 0.42); g.lineTo(0, h * 0.44); g.closePath(); g.fill();
    if (!glow) {
      g.strokeStyle = 'rgba(60,0,0,0.55)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, h * 0.32); g.lineTo(w * 0.5, h * 0.28); g.lineTo(w * 0.94, h * 0.34); g.stroke();
      g.strokeStyle = '#150000'; g.lineWidth = 5; g.strokeRect(0, 0, w, h);
    }
  };
  const head = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#15181c'; g.fillRect(0, 0, w, h);
    g.fillStyle = glow ? '#fff' : '#e6eef4';
    g.fillRect(w * 0.03, h * 0.1, w * 0.92, h * 0.16);
    for (let i = 0; i < 3; i++) g.fillRect(w * (0.1 + i * 0.2), h * 0.4, w * 0.15, h * 0.42);
    if (!glow) { g.fillStyle = '#d87a18'; g.fillRect(w * 0.74, h * 0.4, w * 0.2, h * 0.3); }
  };
  return { tailMap: canvasTex(256, 128, tail(false)), tailGlow: canvasTex(256, 128, tail(true)), headMap: canvasTex(256, 64, head(false)), headGlow: canvasTex(256, 64, head(true)) };
}
const AW = 1024, AH = 512;
const uvr = (x, y, w, h) => [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
const A_PLATE = uvr(0, 0, 832, 181), A_LOGO = uvr(0, 200, 200, 140), A_RAV4 = uvr(220, 200, 330, 100), A_HYB = uvr(570, 200, 380, 100), A_AWD = uvr(220, 320, 260, 90);
export function toyotaLogo(g, cx, cy, r, col) {
  g.strokeStyle = col; g.lineWidth = r * 0.13;
  for (const [ox, oy, rx, ry] of [[0, 0, r, r * 0.66], [0, 0, r * 0.3, r * 0.62], [0, -r * 0.3, r * 0.7, r * 0.32]]) {
    g.beginPath(); g.ellipse(cx + ox, cy + oy, rx - g.lineWidth / 2, ry - g.lineWidth / 2, 0, 0, 7); g.stroke();
  }
}
function atlasTex() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    drawPlate(g, 0, 0, 832, 181, '520 RAV');
    toyotaLogo(g, 100, 270, 98, '#e4e6e8');
    g.fillStyle = '#dfe1e3'; g.textBaseline = 'middle'; g.textAlign = 'center';
    g.font = 'bold 92px Arial, Helvetica, sans-serif'; g.fillText('RAV4', 385, 254);
    g.font = 'bold 70px Arial, Helvetica, sans-serif'; g.fillText('HYBRID', 760, 254);
    g.font = 'italic bold 66px Arial, Helvetica, sans-serif'; g.fillText('AWD-i', 350, 368);
  });
}

export function buildRAV4() {
  const body = buildBody({
    top: [[ZF, 0.55], [ZF + 0.006, 0.68, 0.03], [-2.24, 0.82, 0.04], [-2.17, 0.99, 0.05], [-2.0, 1.04, 0.08], [-1.1, 1.145, 0.08], [-0.2, 1.6, 0.22],
      [0.4, 1.665, 0.8], [1.86, 1.6, 0.1], [2.03, 1.575, 0.012], [2.041, 1.545, 0.012], [2.215, 1.17, 0.05], [2.285, 1.0, 0.05], [2.307, 0.76, 0.02], [ZR - 0.006, 0.7, 0.02], [ZR, 0.56]],
    bottom: [[ZF, 0.55], [ZF + 0.006, 0.42, 0.03], [-2.15, 0.28, 0.05], [-1.85, 0.2, 0.1], [1.85, 0.21, 0.1], [2.2, 0.33, 0.05], [ZR - 0.008, 0.43, 0.03], [ZR, 0.56]],
    w: [[ZF, 0.87], [-1.9, 0.905], [-1.345, 0.925], [0, 0.9275], [1.345, 0.926], [1.98, 0.908], [ZR, 0.878]],
    yWaist: 0.78, tuck: 0.065, ySill: 0.21,
    yBelt: [[-1.2, 1.06], [-0.5, 1.08], [1.0, 1.12], [1.9, 1.19], [ZR, 1.19]],
    sh: 0.024, ledge: 0.013, th: 0.4, thc: 0.25,
    rr: [[ZF, 0.05], [-1.1, 0.06], [-0.2, 0.1], [1.86, 0.1], [2.06, 0.08], [2.25, 0.07], [ZR, 0.05]],
    rs: 0.065,
    crown: [[ZF, 0.03], [-1.1, 0.035], [-0.2, 0.05], [1.86, 0.045], [2.06, 0.03], [ZR, 0.02]],
    bow: [[ZF, 0.22], [-1.9, 0.16], [-1.5, 0.1], [-1.1, 0.17], [-0.2, 0.1], [-0.04, 0], [1.15, 0], [1.86, 0.1], [2.04, 0.17], [ZR, 0.2]],
    bowN: [[ZF, 3.0], [-1.5, 2.6], [-1.1, 2.2], [1.15, 2.5], [1.86, 3], [ZR, 3.4]],
  });
  const raw = body.soup, pr = probe(raw);
  const AY = 0.364, AR = 0.445;
  const { soup: shell, liner } = cutArches(raw, [{ z: -HZ, y: AY, r: AR }, { z: HZ, y: AY, r: AR }], { halfWidth: 0.9275 });
  const dc = decals(shell);
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup(), chmsl = new Soup();
  const fr = { filter: (v) => v[2] > 1.6 }, ff = { filter: (v) => v[2] < -1.7 };

  // --- glazing: rising belt with a kick-up, blacked-out D-pillar
  const dlo = rpoly([[-0.84, 1.105], [0.3, 1.125], [1.1, 1.15], [1.5, 1.2], [1.74, 1.33], [1.5, 1.42], [1.1, 1.49], [0.5, 1.52], [-0.06, 1.495]], 0.03, 3);
  pal.add(dc.side(grow(dlo, 0.012), { offset: 0.003 }).pal('gloss').sym());
  glass.add(dc.side(dlo, { offset: 0.005 }).sym());
  pal.add(dc.side([rect(0.2, 1.12, 0.27, 1.525), rect(1.08, 1.15, 1.15, 1.49)], { offset: 0.0065 }).pal('gloss').sym());
  pal.add(dc.side(rpoly([[1.52, 1.2], [1.93, 1.27], [1.99, 1.36], [1.84, 1.5], [1.47, 1.44], [1.76, 1.33]], 0.015, 2), { offset: 0.0045, minFacing: 0.2 }).pal('gloss').sym());
  const ws = rpoly([[-0.79, 1.165], [0.79, 1.165], [0.58, 1.555], [-0.58, 1.555]], 0.05);
  pal.add(dc.front(grow(ws, 0.014), { offset: 0.003 }).pal('gloss'));
  glass.add(dc.front(ws, { offset: 0.005 }));
  const rw = rpoly([[-0.66, 1.2], [0.66, 1.2], [0.56, 1.505], [-0.56, 1.505]], 0.05);
  pal.add(dc.rear(grow(rw, 0.014), { offset: 0.003, ...fr }).pal('gloss'));
  glass.add(dc.rear(rw, { offset: 0.007, ...fr }));

  // --- black lower cladding: bumpers, sills, squared-off arch trims, silver skid plates
  pal.add(dc.rear(rect(-1, 0.3, 1, 0.62), { offset: 0.003, minFacing: -0.3, filter: (v) => v[2] > 2.0 && v[1] < 0.64 }).pal('plastic'));
  pal.add(dc.rear(rpoly([[-0.5, 0.33], [0.5, 0.33], [0.42, 0.44], [-0.42, 0.44]], 0.02), { offset: 0.005, minFacing: -0.3, filter: (v) => v[2] > 2.0 }).pal('silver'));
  pal.add(dc.front(rect(-1, 0.26, 1, 0.5), { offset: 0.003, minFacing: -0.3, filter: (v) => v[2] < -1.9 && v[1] < 0.52 }).pal('plastic'));
  pal.add(dc.front(rpoly([[-0.5, 0.29], [0.5, 0.29], [0.42, 0.38], [-0.42, 0.38]], 0.02), { offset: 0.005, minFacing: -0.3, filter: (v) => v[2] < -1.9 }).pal('silver'));
  const arch = (z) => [[z - 0.53, 0.25], [z + 0.53, 0.25], [z + 0.53, 0.62], [z + 0.33, 0.86], [z - 0.33, 0.86], [z - 0.53, 0.62]];
  pal.add(dc.side([arch(-HZ), arch(HZ), rect(-HZ + 0.3, 0.19, HZ - 0.3, 0.39), rect(HZ + 0.3, 0.3, 2.5, 0.62), rect(-2.5, 0.26, -HZ - 0.3, 0.5)], { offset: 0.003, minFacing: 0.2 }).pal('plastic').sym());
  pal.add(dc.rear([rect(0.56, 0.5, 0.82, 0.54, 0.008)], { offset: 0.005, minFacing: 0.05, ...fr }).pal('reflector').sym());

  // --- shut lines
  const lw = 0.008;
  pal.add(dc.side([
    ...stroke([[-0.84, 0.4], [-0.84, 1.09]], lw), ...stroke([[0.235, 0.4], [0.235, 1.12]], lw),
    ...stroke([[1.15, 1.16], [1.14, 1.03], [1.09, 0.93], [1.01, 0.872], [0.805, 0.625], [0.805, 0.4]], lw),
    ...stroke([[-0.84, 0.4], [0.805, 0.4]], lw),
  ], { offset: 0.0055 }).pal('line').sym());
  pal.add(dc.top(stroke([[0.75, -2.08], [0.81, -1.08]], lw), { offset: 0.0055, minFacing: 0.4 }).pal('line').sym());
  pal.add(dc.rear([...stroke([[0.6, 0.99], [0.66, 0.93], [0.67, 0.65]], lw), ...stroke([[-0.67, 0.65], [0.67, 0.65]], lw)], { offset: 0.0055, ...fr }).pal('line').sym());

  // --- angular tail lamps joined by a gloss garnish, emblem, lettering, plate
  const ty = dc.yaw(30), to = { minFacing: 0.02, origin: [0, 0, 2.16], ...fr };
  const lampPoly = rpoly([[0.3, 1.04], [0.58, 1.03], [0.64, 0.985], [0.93, 0.99], [0.97, 1.08], [0.9, 1.15], [0.58, 1.135], [0.3, 1.115]], 0.012, 3);
  tail.add(ty(lampPoly, { offset: 0.005, ...to }));
  tail.add(tail.mirrored());
  reverse.add(ty(rect(0.31, 1.046, 0.47, 1.072, 0.006), { offset: 0.0065, ...to }).sym());
  pal.add(dc.rear(rect(-0.42, 1.045, 0.42, 1.105, 0.01), { offset: 0.004, ...fr }).pal('gloss'));
  pal.add(dc.rear(rect(-0.4, 1.05, 0.4, 1.06), { offset: 0.0055, ...fr }).pal('chrome'));
  chmsl.add(dc.rear(rect(-0.24, 1.522, 0.24, 1.54, 0.005), { offset: 0.004, minFacing: 0.2, ...fr }));
  atlas.add(dc.rear(rect(-0.075, 1.112, 0.075, 1.19), { offset: 0.007, ...fr }).uvRect(A_LOGO));
  atlas.add(dc.rear(rect(-0.62, 0.72, -0.4, 0.787), { offset: 0.007, ...fr }).uvRect(A_RAV4));
  atlas.add(dc.rear(rect(0.38, 0.755, 0.61, 0.815), { offset: 0.007, ...fr }).uvRect(A_HYB));
  atlas.add(dc.rear(rect(0.45, 0.69, 0.61, 0.745), { offset: 0.007, ...fr }).uvRect(A_AWD));
  const pl = plate([0, 0.9, pr.rearZ(0, 0.9) + 0.008], A_PLATE, { tilt: 0.06 });
  atlas.add(pl.face); pal.add(pl.back);
  pal.add(rearWiper(pr, 0.0, 1.5, 0.33, 1.46));
  // twin exhaust tips
  pal.add(cyl(0.034, 0.034, 0.12, 14, { p: [0.56, 0.365, 2.2], r: [Math.PI / 2, 0, 0] }, 'chrome', true).sym());
  pal.add(cyl(0.029, 0.029, 0.11, 12, { p: [0.56, 0.365, 2.19], r: [Math.PI / 2, 0, 0] }, 'well').sym());

  // --- front: trapezoid grille, slim headlamps
  const gp = rpoly([[-0.3, 0.86], [0.3, 0.86], [0.5, 0.6], [0.44, 0.42], [-0.44, 0.42], [-0.5, 0.6]], 0.03);
  pal.add(dc.front(gp, { offset: 0.004, minFacing: -0.2, ...ff }).pal('gloss'));
  const ribs = []; for (let i = 0; i < 4; i++) ribs.push(rect(-0.42, 0.5 + i * 0.085, 0.42, 0.515 + i * 0.085));
  pal.add(dc.front(ribs, { offset: 0.0055, ...ff }).pal('darkalloy'));
  pal.add(dc.front(rect(-0.52, 0.895, 0.52, 0.935, 0.01), { offset: 0.004, ...ff }).pal('gloss'));
  atlas.add(dc.front(rect(-0.075, 0.875, 0.075, 0.953), { offset: 0.007, minFacing: 0.05, ...ff }).uvRect(A_LOGO));
  const hy = frontYaw(30, -2.12);
  head.add(dc.any(hy)(rpoly([[-0.92, 0.93], [-0.46, 0.885], [-0.46, 0.955], [-0.9, 1.02]], 0.012), { offset: 0.005, minFacing: 0.03, box: [-0.46, 0.885, -0.92, 1.02], ...ff }));
  head.add(head.mirrored());
  const fp = plate([0, 0.62, pr.frontZ(0, 0.62) - 0.01], A_PLATE, { front: true, tilt: 0.06 });
  atlas.add(fp.face); pal.add(fp.back);

  // --- mirrors, handles, roof rails, antenna
  const mx = pr.sideX(-0.78, 1.14);
  paint.add(blob(0.24, 0.14, 0.1, { p: [mx + 0.1, 1.17, -0.78] }, null, 3.5).sym());
  pal.add(box(0.07, 0.03, 0.06, { p: [mx + 0.01, 1.125, -0.78] }, 'plastic').sym());
  for (const z of [0.09, 0.95]) paint.add(blob(0.026, 0.032, 0.17, { p: [pr.sideX(z, 1.03) + 0.005, 1.03, z] }, null, 5, 8).sym());
  pal.add(roofRail(pr, 0.575, -0.05, 1.8, 0.052, 'plastic', 0.014).sym());
  pal.add(blob(0.05, 0.07, 0.17, { p: [0, pr.topY(0, 1.72) + 0.022, 1.72] }, 'gloss', 2.5, 8));

  const wheel = { soup: buildWheel({ R: DIMS.wheelRadius, width: 0.225, rimR: 0.232, style: 'spoke5' }) };
  const car = assembleCar({ id: 'rav4', dims: DIMS, parts: { paint, glass, pal, tail, chmsl, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel });
  return tintPaint(car, 'rav4', 0x5a5f66, { metalness: 0.6, roughness: 0.4 });
}
