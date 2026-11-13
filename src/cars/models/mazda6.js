// 2019 Mazda 6 estate (GJ/GL facelift) - long, low wagon in Machine Grey with slim chrome-linked tail lamps.
import { Soup, buildBody, cutArches, decals, probe, rpoly, rect, stroke, grow, box, blob, cyl, buildWheel, canvasTex, drawPlate, plate, assembleCar, frontYaw, rearWiper, tintPaint, roofRail } from './kit.js';

// real car: 4805 x 1840 x 1480 mm, wheelbase 2750 (wagon), track 1595 front / 1585 rear, 225/45 R19
const DIMS = { length: 4.805, width: 1.84, height: 1.48, wheelbase: 2.75, track: 1.59, wheelRadius: 0.343 };
const ZF = -2.335, ZR = 2.47, HZ = DIMS.wheelbase / 2;

function lampTextures() {
  const tail = (glow) => (g, w, h) => {
    // u: 0 = inboard tip on the tailgate, 1 = outboard, round the corner. Smoked deep-red lens
    // with the Mazda signature: a ring outboard and a thin light blade running inboard from it.
    const cx = w * 0.47, cy = h * 0.5, r = h * 0.31;
    if (glow) {
      g.fillStyle = '#240000'; g.fillRect(0, 0, w, h);
    } else {
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#4a0508'); bg.addColorStop(0.5, '#7a0a10'); bg.addColorStop(1, '#3a0406');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      // darker smoked housing around the ring and at the outer end
      g.fillStyle = 'rgba(20,0,2,.55)';
      g.beginPath(); g.arc(cx, cy, r * 1.45, 0, 7); g.fill();
    }
    const lit = glow ? '#ffffff' : '#ff3030';
    g.strokeStyle = lit; g.fillStyle = lit; g.lineCap = 'round';
    g.lineWidth = h * 0.11; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    g.lineWidth = h * 0.085;
    g.beginPath(); g.moveTo(w * 0.05, cy); g.lineTo(cx - r * 1.5, cy); g.stroke();      // blade towards the emblem
    g.beginPath(); g.moveTo(cx + r * 1.5, cy); g.lineTo(w * 0.9, cy); g.stroke();       // blade outboard, round the corner
    if (!glow) {
      g.fillStyle = '#1c0103'; g.beginPath(); g.arc(cx, cy, r * 0.62, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,120,110,.22)'; g.fillRect(0, h * 0.06, w, h * 0.07);       // lens highlight
      g.strokeStyle = '#0c0000'; g.lineWidth = 5; g.strokeRect(0, 0, w, h);
    }
  };
  const head = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#15181c'; g.fillRect(0, 0, w, h);
    g.fillStyle = glow ? '#fff' : '#e6eef4';
    g.fillRect(w * 0.03, h * 0.7, w * 0.9, h * 0.14);
    for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(w * (0.35 + i * 0.3), h * 0.38, h * 0.24, 0, 7); g.fill(); }
  };
  return { tailMap: canvasTex(512, 96, tail(false)), tailGlow: canvasTex(512, 96, tail(true)), headMap: canvasTex(256, 64, head(false)), headGlow: canvasTex(256, 64, head(true)) };
}
const AW = 1024, AH = 512;
const uvr = (x, y, w, h) => [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
const A_PLATE = uvr(0, 0, 832, 181), A_LOGO = uvr(0, 200, 180, 150), A_M6 = uvr(200, 200, 430, 90), A_SKY = uvr(200, 310, 620, 90);
function atlasTex() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    drawPlate(g, 0, 0, 832, 181, '619 MZD');
    // Mazda winged "M" in an oval
    const cx = 90, cy = 275, r = 84, col = '#eef0f2';
    g.strokeStyle = col; g.lineWidth = 17; g.lineJoin = 'round';
    g.beginPath(); g.ellipse(cx, cy, r - 7, r * 0.8 - 7, 0, 0, 7); g.stroke();
    g.lineWidth = 15;
    g.beginPath(); g.moveTo(cx - r * 0.86, cy - r * 0.12); g.quadraticCurveTo(cx - r * 0.3, cy - r * 0.5, cx, cy + r * 0.32);
    g.quadraticCurveTo(cx + r * 0.3, cy - r * 0.5, cx + r * 0.86, cy - r * 0.12); g.stroke();
    g.beginPath(); g.moveTo(cx - r * 0.36, cy - r * 0.68); g.quadraticCurveTo(cx - r * 0.1, cy - r * 0.3, cx, cy + r * 0.32);
    g.quadraticCurveTo(cx + r * 0.1, cy - r * 0.3, cx + r * 0.36, cy - r * 0.68); g.stroke();
    g.fillStyle = '#f2f3f4'; g.textBaseline = 'middle'; g.textAlign = 'center';
    g.font = 'bold 80px Arial, Helvetica, sans-serif'; g.fillText('MAZDA6', 415, 248);
    g.font = 'italic bold 60px Arial, Helvetica, sans-serif'; g.fillText('SKYACTIV-G', 510, 357);
  });
}

export function buildMazda6() {
  const body = buildBody({
    top: [[ZF, 0.46], [ZF + 0.006, 0.57, 0.03], [-2.305, 0.67, 0.04], [-2.2, 0.76, 0.08], [-1.85, 0.865, 0.2], [-0.9, 0.995, 0.08], [-0.02, 1.4, 0.25],
      [0.5, 1.462, 0.8], [1.9, 1.375, 0.1], [2.05, 1.345, 0.012], [2.061, 1.318, 0.012], [2.335, 1.045, 0.03], [2.412, 1.0, 0.03], [2.448, 0.66, 0.02], [ZR - 0.006, 0.6, 0.02], [ZR, 0.47]],
    bottom: [[ZF, 0.46], [ZF + 0.006, 0.35, 0.03], [-2.2, 0.22, 0.05], [-1.9, 0.165, 0.1], [1.9, 0.175, 0.1], [2.3, 0.27, 0.05], [ZR - 0.008, 0.36, 0.03], [ZR, 0.47]],
    w: [[ZF, 0.83], [-1.9, 0.895], [-1.375, 0.918], [0, 0.92], [1.375, 0.919], [2.1, 0.895], [ZR, 0.85]],
    yWaist: 0.7, tuck: 0.065, ySill: 0.18,
    yBelt: [[-1.0, 0.935], [-0.3, 0.955], [1.0, 0.99], [2.1, 1.04], [ZR, 1.04]],
    sh: 0.03, ledge: 0.012, th: 0.42, thc: 0.3,
    rr: [[ZF, 0.06], [-0.9, 0.07], [-0.02, 0.1], [1.9, 0.1], [2.1, 0.08], [2.4, 0.07], [ZR, 0.05]],
    rs: 0.06,
    crown: [[ZF, 0.035], [-0.9, 0.04], [-0.02, 0.05], [1.9, 0.045], [2.1, 0.03], [ZR, 0.02]],
    bow: [[ZF, 0.34], [-2.0, 0.2], [-1.4, 0.1], [-0.9, 0.2], [-0.02, 0.11], [0.12, 0], [1.2, 0], [1.9, 0.1], [2.1, 0.19], [ZR, 0.26]],
    bowN: [[ZF, 2.6], [-1.4, 2.4], [-0.9, 2.2], [1.2, 2.5], [1.9, 3], [ZR, 3.0]],
  });
  const raw = body.soup, pr = probe(raw);
  const AY = 0.343, AR = 0.4;
  const { soup: shell, liner } = cutArches(raw, [{ z: -HZ, y: AY, r: AR }, { z: HZ, y: AY, r: AR }], { halfWidth: 0.92 });
  const dc = decals(shell);
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup(), chmsl = new Soup();
  const fr = { filter: (v) => v[2] > 1.7 }, ff = { filter: (v) => v[2] < -1.7 };

  // --- glazing: long tapering DLO with a chrome surround
  const dlo = rpoly([[-0.7, 0.985], [0.3, 1.005], [1.3, 1.035], [1.95, 1.085], [2.1, 1.14], [1.8, 1.255], [1.2, 1.325], [0.5, 1.352], [0.06, 1.33]], 0.025, 3);
  pal.add(dc.side(grow(dlo, 0.012), { offset: 0.003 }).pal('chrome').sym());
  glass.add(dc.side(dlo, { offset: 0.005 }).sym());
  pal.add(dc.side([rect(0.25, 1.0, 0.32, 1.36), rect(1.2, 1.03, 1.265, 1.33), rect(1.72, 1.06, 1.76, 1.27)], { offset: 0.0065 }).pal('gloss').sym());
  const ws = rpoly([[-0.77, 1.012], [0.77, 1.012], [0.56, 1.355], [-0.56, 1.355]], 0.05);
  pal.add(dc.front(grow(ws, 0.014), { offset: 0.003 }).pal('gloss'));
  glass.add(dc.front(ws, { offset: 0.005 }));
  const rw = rpoly([[-0.67, 1.06], [0.67, 1.06], [0.55, 1.285], [-0.55, 1.285]], 0.045);
  pal.add(dc.rear(grow(rw, 0.014), { offset: 0.003, minFacing: 0.08, ...fr }).pal('gloss'));
  glass.add(dc.rear(rw, { offset: 0.007, minFacing: 0.08, ...fr }));

  // --- black lower trim: rear diffuser, front intake, thin sills
  pal.add(dc.rear(rpoly([[-0.78, 0.2], [0.78, 0.2], [0.7, 0.4], [-0.7, 0.4]], 0.03), { offset: 0.003, minFacing: -0.3, filter: (v) => v[2] > 2.1 && v[1] < 0.45 }).pal('plastic'));
  pal.add(dc.side([rect(-HZ + 0.35, 0.15, HZ - 0.35, 0.25)], { offset: 0.003, minFacing: 0.1 }).pal('plastic').sym());
  pal.add(dc.rear([rect(0.6, 0.44, 0.84, 0.475, 0.008)], { offset: 0.005, minFacing: 0.05, ...fr }).pal('reflector').sym());

  // --- shut lines
  const lw = 0.008;
  pal.add(dc.side([
    ...stroke([[-0.9, 0.27], [-0.9, 0.97]], lw), ...stroke([[0.285, 0.27], [0.285, 1.0]], lw),
    ...stroke([[1.25, 1.035], [1.22, 0.92], [1.12, 0.82], [0.98, 0.77], [0.94, 0.55], [0.94, 0.27]], lw),
    ...stroke([[-0.9, 0.27], [0.94, 0.27]], lw),
  ], { offset: 0.0055 }).pal('line').sym());
  pal.add(dc.top(stroke([[0.7, -2.1], [0.8, -0.9]], lw), { offset: 0.0055, minFacing: 0.4 }).pal('line').sym());
  pal.add(dc.rear([...stroke([[0.62, 0.87], [0.66, 0.8], [0.66, 0.6]], lw), ...stroke([[-0.66, 0.6], [0.66, 0.6]], lw)], { offset: 0.0055, ...fr }).pal('line').sym());

  // --- slim tail lamps joined by a chrome blade, emblem, lettering, plate
  const ty = dc.yaw(32), to = { minFacing: 0.02, origin: [0, 0, 2.31], ...fr };
  const lampPoly = rpoly([[0.25, 0.912], [0.6, 0.892], [0.9, 0.87], [0.99, 0.895], [1.0, 0.965], [0.94, 1.004], [0.6, 0.992], [0.25, 0.95]], 0.014, 3);
  tail.add(ty(lampPoly, { offset: 0.005, ...to }));
  tail.add(tail.mirrored());
  reverse.add(ty(rect(0.3, 0.916, 0.42, 0.93, 0.004), { offset: 0.0065, ...to }).sym());
  pal.add(dc.rear(rect(-0.3, 0.916, 0.3, 0.936, 0.005), { offset: 0.006, ...fr }).pal('chrome'));       // chrome wing between the lamps
  chmsl.add(dc.rear(rect(-0.26, 1.298, 0.26, 1.314, 0.005), { offset: 0.004, minFacing: 0.1, ...fr }));
  atlas.add(dc.rear(rect(-0.062, 0.948, 0.062, 1.05), { offset: 0.007, minFacing: 0.05, ...fr }).uvRect(A_LOGO));
  atlas.add(dc.rear(rect(-0.64, 0.7, -0.36, 0.759), { offset: 0.007, ...fr }).uvRect(A_M6));
  atlas.add(dc.rear(rect(0.34, 0.705, 0.64, 0.749), { offset: 0.007, ...fr }).uvRect(A_SKY));
  const pl = plate([0, 0.8, pr.rearZ(0, 0.8) + 0.008], A_PLATE, { tilt: 0.1 });
  atlas.add(pl.face); pal.add(pl.back);
  pal.add(rearWiper(pr, 0.0, 1.075, 0.34, 1.11));
  // twin round exhausts
  pal.add(cyl(0.042, 0.042, 0.12, 16, { p: [0.52, 0.3, 2.34], r: [Math.PI / 2, 0, 0] }, 'chrome', true).sym());
  pal.add(cyl(0.036, 0.036, 0.11, 12, { p: [0.52, 0.3, 2.33], r: [Math.PI / 2, 0, 0] }, 'well').sym());

  // --- front: shield grille with chrome wing, slim headlamps
  const gp = rpoly([[-0.4, 0.74], [0.4, 0.74], [0.33, 0.52], [0.2, 0.44], [-0.2, 0.44], [-0.33, 0.52]], 0.03);
  pal.add(dc.front(grow(gp, 0.014), { offset: 0.004, minFacing: -0.1, ...ff }).pal('chrome'));
  pal.add(dc.front(gp, { offset: 0.0055, minFacing: -0.1, ...ff }).pal('gloss'));
  pal.add(dc.front([rect(-0.6, 0.27, -0.42, 0.36, 0.02), rect(0.42, 0.27, 0.6, 0.36, 0.02), rect(-0.36, 0.26, 0.36, 0.36, 0.02)], { offset: 0.004, minFacing: -0.3, ...ff }).pal('line'));
  atlas.add(dc.front(rect(-0.065, 0.6, 0.065, 0.705), { offset: 0.008, minFacing: 0.05, ...ff }).uvRect(A_LOGO));
  const hy = frontYaw(32, -2.15);
  head.add(dc.any(hy)(rpoly([[-0.9, 0.7], [-0.4, 0.68], [-0.4, 0.74], [-0.88, 0.78]], 0.012), { offset: 0.005, minFacing: 0.03, box: [-0.4, 0.68, -0.9, 0.78], ...ff }));
  head.add(head.mirrored());
  const fp = plate([0, 0.4, pr.frontZ(0, 0.4) - 0.01], A_PLATE, { front: true, tilt: 0.04 });
  atlas.add(fp.face); pal.add(fp.back);

  // --- mirrors, handles, roof rails, antenna
  const mx = pr.sideX(-0.62, 1.03);
  paint.add(blob(0.22, 0.12, 0.09, { p: [mx + 0.1, 1.06, -0.62] }, null, 3.5).sym());
  pal.add(box(0.07, 0.03, 0.06, { p: [mx + 0.01, 1.02, -0.62] }, 'gloss').sym());
  for (const z of [0.14, 1.07]) paint.add(blob(0.026, 0.03, 0.17, { p: [pr.sideX(z, 0.9) + 0.005, 0.9, z] }, null, 5, 8).sym());
  pal.add(roofRail(pr, 0.555, 0.15, 1.9, 0.036, 'silver', 0.011).sym());
  paint.add(blob(0.05, 0.065, 0.17, { p: [0, pr.topY(0, 1.75) + 0.02, 1.75] }, null, 2.5, 8));

  const wheel = { soup: buildWheel({ R: DIMS.wheelRadius, width: 0.225, rimR: 0.245, style: 'spoke5' }) };
  const car = assembleCar({ id: 'mazda6', dims: DIMS, parts: { paint, glass, pal, tail, chmsl, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel });
  return tintPaint(car, 'mazda6', 0x44474d, { metalness: 0.7, roughness: 0.36 });
}
