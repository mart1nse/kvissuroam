// 2012 BMW 320d Touring (F31) in Mineral Grey: the parked car on Jänese tänav. Not drivable, only a shell
// (see src/world/janese.js). Short front overhang, long bonnet, Hofmeister kink, L-shaped tail lamps.
import { Soup, buildBody, cutArches, decals, probe, rpoly, rect, stroke, grow, box, blob, cyl, buildWheel, canvasTex, drawPlate, plate, assembleCar, frontYaw, rearWiper, tintPaint, roofRail } from './kit.js';

// real car: 4624 x 1811 x 1459 mm, wheelbase 2810, track 1543 front / 1583 rear, 225/50 R17
const DIMS = { length: 4.624, width: 1.811, height: 1.459, wheelbase: 2.81, track: 1.56, wheelRadius: 0.328 };
const HZ = DIMS.wheelbase / 2, ZF = -HZ - 0.78, ZR = HZ + 1.034;

function lampTextures() {
  // u: 0 = inboard end on the tailgate, 1 = outboard round the corner. Dark red lens with the two
  // L-shaped LED light bars of the F30/F31.
  const tail = (glow) => (g, w, h) => {
    if (glow) { g.fillStyle = '#200000'; g.fillRect(0, 0, w, h); } else {
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#3a0406'); bg.addColorStop(0.5, '#6a080e'); bg.addColorStop(1, '#300305');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
    }
    const lit = glow ? '#ffffff' : '#ff3a3a';
    g.strokeStyle = lit; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = h * 0.1;
    for (const y of [0.3, 0.68]) {
      g.beginPath(); g.moveTo(w * 0.08, h * y); g.lineTo(w * 0.78, h * y); g.lineTo(w * 0.9, h * (y + 0.16)); g.stroke();
    }
    if (!glow) {
      g.fillStyle = 'rgba(200,200,210,.35)'; g.fillRect(w * 0.12, h * 0.44, w * 0.3, h * 0.12);   // clear reverse strip
      g.strokeStyle = '#0c0000'; g.lineWidth = 5; g.strokeRect(0, 0, w, h);
    }
  };
  const head = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#14171b'; g.fillRect(0, 0, w, h);
    // twin corona rings, the outer one cut flat along the top
    g.strokeStyle = glow ? '#fff' : '#dfe8f0'; g.lineWidth = h * 0.08;
    for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(w * (0.3 + i * 0.38), h * 0.52, h * 0.3, 0, 7); g.stroke(); }
    g.fillStyle = glow ? '#fff' : '#c8d2da'; g.fillRect(w * 0.1, h * 0.08, w * 0.85, h * 0.07);
  };
  return { tailMap: canvasTex(512, 128, tail(false)), tailGlow: canvasTex(512, 128, tail(true)), headMap: canvasTex(256, 64, head(false)), headGlow: canvasTex(256, 64, head(true)) };
}
const AW = 1024, AH = 512;
const uvr = (x, y, w, h) => [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
const A_PLATE = uvr(0, 0, 832, 181), A_LOGO = uvr(0, 200, 180, 180), A_320 = uvr(200, 210, 260, 90);
function atlasTex() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    drawPlate(g, 0, 0, 832, 181, '320 JNS');
    // roundel: black ring with white letters, blue and white quarters
    const cx = 90, cy = 290, r = 86;
    g.fillStyle = '#c8ccd2'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(cx, cy, r - 6, 0, 7); g.fill();
    for (let q = 0; q < 4; q++) {
      g.fillStyle = q % 2 ? '#f4f6f8' : '#1c6fc4';
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r * 0.58, -Math.PI / 2 + q * Math.PI / 2, q * Math.PI / 2); g.closePath(); g.fill();
    }
    g.fillStyle = '#f4f6f8'; g.font = 'bold 30px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    [['B', -0.7], ['M', 0], ['W', 0.7]].forEach(([c, a]) => {
      g.save(); g.translate(cx + Math.sin(a) * r * 0.78, cy - Math.cos(a) * r * 0.78); g.rotate(a); g.fillText(c, 0, 0); g.restore();
    });
    g.fillStyle = '#e8eaee'; g.font = 'bold 72px Arial, Helvetica, sans-serif'; g.textAlign = 'left';
    g.fillText('320d', 210, 258);
  });
}

export function buildF31() {
  const body = buildBody({
    top: [[ZF, 0.45], [ZF + 0.006, 0.58, 0.03], [ZF + 0.04, 0.67, 0.04], [ZF + 0.16, 0.755, 0.08], [-1.5, 0.86, 0.25], [-0.85, 0.975, 0.08], [-0.1, 1.385, 0.25],
      [0.55, 1.445, 0.8], [1.95, 1.39, 0.1], [2.08, 1.365, 0.012], [2.091, 1.34, 0.012], [2.33, 1.06, 0.03], [2.395, 1.01, 0.03], [2.43, 0.66, 0.02], [ZR - 0.006, 0.6, 0.02], [ZR, 0.47]],
    bottom: [[ZF, 0.45], [ZF + 0.006, 0.34, 0.03], [ZF + 0.12, 0.2, 0.05], [-1.75, 0.16, 0.1], [1.9, 0.17, 0.1], [2.25, 0.27, 0.05], [ZR - 0.008, 0.36, 0.03], [ZR, 0.47]],
    w: [[ZF, 0.8], [ZF + 0.3, 0.88], [-1.4, 0.9], [0, 0.905], [1.4, 0.905], [2.1, 0.885], [ZR, 0.84]],
    yWaist: 0.72, tuck: 0.06, ySill: 0.18,
    yBelt: [[-0.95, 0.94], [-0.3, 0.955], [1.0, 0.985], [2.1, 1.03], [ZR, 1.03]],
    sh: 0.03, ledge: 0.012, th: 0.42, thc: 0.3,
    rr: [[ZF, 0.07], [-0.85, 0.07], [-0.1, 0.1], [1.95, 0.1], [2.1, 0.08], [2.4, 0.07], [ZR, 0.05]],
    rs: 0.06,
    crown: [[ZF, 0.035], [-0.85, 0.045], [-0.1, 0.05], [1.95, 0.045], [2.1, 0.03], [ZR, 0.02]],
    bow: [[ZF, 0.3], [-1.9, 0.18], [-1.4, 0.1], [-0.85, 0.2], [0.0, 0.08], [0.35, 0], [1.2, 0], [1.95, 0.1], [2.1, 0.19], [ZR, 0.26]],
    bowN: [[ZF, 2.6], [-1.4, 2.4], [-0.85, 2.2], [1.2, 2.5], [1.95, 3], [ZR, 3.0]],
  });
  const raw = body.soup, pr = probe(raw);
  const AY = DIMS.wheelRadius, AR = 0.39;
  const { soup: shell, liner } = cutArches(raw, [{ z: -HZ, y: AY, r: AR }, { z: HZ, y: AY, r: AR }], { halfWidth: 0.91 });
  const dc = decals(shell);
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup(), chmsl = new Soup();
  const fr = { filter: (v) => v[2] > 1.7 }, ff = { filter: (v) => v[2] < -1.6 };

  // --- glazing: three side windows, the last one ending in the Hofmeister kink, black window frames
  const dlo = rpoly([[-0.68, 0.965], [0.3, 0.985], [1.3, 1.015], [2.0, 1.06], [2.06, 1.13], [1.85, 1.25], [1.2, 1.32], [0.5, 1.345], [0.02, 1.32]], 0.025, 3);
  pal.add(dc.side(grow(dlo, 0.016), { offset: 0.003 }).pal('gloss').sym());
  glass.add(dc.side(dlo, { offset: 0.005 }).sym());
  pal.add(dc.side([rect(0.26, 0.98, 0.32, 1.35), rect(1.16, 1.0, 1.22, 1.33), rect(1.5, 1.03, 1.52, 1.29)], { offset: 0.0065 }).pal('gloss').sym());
  const ws = rpoly([[-0.76, 0.99], [0.76, 0.99], [0.56, 1.35], [-0.56, 1.35]], 0.05);
  pal.add(dc.front(grow(ws, 0.014), { offset: 0.003 }).pal('gloss'));
  glass.add(dc.front(ws, { offset: 0.005 }));
  const rw = rpoly([[-0.64, 1.07], [0.64, 1.07], [0.54, 1.3], [-0.54, 1.3]], 0.045);
  pal.add(dc.rear(grow(rw, 0.014), { offset: 0.003, minFacing: 0.08, ...fr }).pal('gloss'));
  glass.add(dc.rear(rw, { offset: 0.007, minFacing: 0.08, ...fr }));

  // --- black lower trim and sills
  pal.add(dc.rear(rpoly([[-0.76, 0.2], [0.76, 0.2], [0.68, 0.36], [-0.68, 0.36]], 0.03), { offset: 0.003, minFacing: -0.3, filter: (v) => v[2] > 2.1 && v[1] < 0.42 }).pal('plastic'));
  pal.add(dc.side([rect(-HZ + 0.35, 0.15, HZ - 0.35, 0.24)], { offset: 0.003, minFacing: 0.1 }).pal('plastic').sym());
  pal.add(dc.rear([rect(0.58, 0.4, 0.8, 0.43, 0.008)], { offset: 0.005, minFacing: 0.05, ...fr }).pal('reflector').sym());

  // --- shut lines and the sharp swage line along the door handles
  const lw = 0.008;
  pal.add(dc.side([
    ...stroke([[-0.88, 0.27], [-0.88, 0.95]], lw), ...stroke([[0.3, 0.27], [0.3, 0.98]], lw),
    ...stroke([[1.18, 1.0], [1.15, 0.9], [1.05, 0.8], [0.95, 0.75], [0.93, 0.55], [0.93, 0.27]], lw),
    ...stroke([[-0.88, 0.27], [0.93, 0.27]], lw),
  ], { offset: 0.0055 }).pal('line').sym());
  pal.add(dc.side(stroke([[-1.8, 0.86], [0, 0.88], [2.2, 0.9]], 0.004), { offset: 0.005 }).pal('line').sym());
  pal.add(dc.top(stroke([[0.68, -1.95], [0.78, -0.85]], lw), { offset: 0.0055, minFacing: 0.4 }).pal('line').sym());
  pal.add(dc.rear([...stroke([[0.6, 1.0], [0.62, 0.92], [0.62, 0.62]], lw), ...stroke([[-0.62, 0.62], [0.62, 0.62]], lw)], { offset: 0.0055, ...fr }).pal('line').sym());

  // --- L-shaped tail lamps reaching into the tailgate, roundel, 320d badge, plate
  const ty = dc.yaw(30), to = { minFacing: 0.02, origin: [0, 0, 2.3], ...fr };
  const lampPoly = rpoly([[0.3, 0.86], [0.66, 0.84], [0.93, 0.83], [1.0, 0.86], [1.0, 0.97], [0.9, 1.0], [0.62, 1.0], [0.3, 0.94]], 0.014, 3);
  tail.add(ty(lampPoly, { offset: 0.005, ...to }));
  tail.add(tail.mirrored());
  reverse.add(ty(rect(0.34, 0.893, 0.5, 0.905, 0.004), { offset: 0.0065, ...to }).sym());
  chmsl.add(dc.rear(rect(-0.24, 1.31, 0.24, 1.325, 0.005), { offset: 0.004, minFacing: 0.1, ...fr }));
  atlas.add(dc.rear(rect(-0.06, 0.94, 0.06, 1.06), { offset: 0.007, minFacing: 0.05, ...fr }).uvRect(A_LOGO));
  atlas.add(dc.rear(rect(0.38, 0.7, 0.55, 0.758), { offset: 0.007, ...fr }).uvRect(A_320));
  const pl = plate([0, 0.77, pr.rearZ(0, 0.77) + 0.008], A_PLATE, { tilt: 0.1 });
  atlas.add(pl.face); pal.add(pl.back);
  pal.add(rearWiper(pr, 0.0, 1.085, 0.32, 1.12));
  // 320d: one twin-tip exhaust on the left
  for (const x of [-0.5, -0.43]) pal.add(cyl(0.032, 0.032, 0.1, 14, { p: [x, 0.27, 2.36], r: [Math.PI / 2, 0, 0] }, 'chrome', true));

  // --- front: twin kidneys reaching the headlamps, low air intake
  for (const s of [-1, 1]) {
    const k = rpoly([[s * 0.025, 0.56], [s * 0.2, 0.56], [s * 0.215, 0.68], [s * 0.04, 0.69]], 0.03);
    pal.add(dc.front(grow(k, 0.012), { offset: 0.004, minFacing: -0.1, ...ff }).pal('chrome'));
    pal.add(dc.front(k, { offset: 0.0055, minFacing: -0.1, ...ff }).pal('gloss'));
  }
  pal.add(dc.front([rect(-0.62, 0.24, -0.42, 0.34, 0.02), rect(0.42, 0.24, 0.62, 0.34, 0.02), rect(-0.38, 0.23, 0.38, 0.36, 0.02)], { offset: 0.004, minFacing: -0.3, ...ff }).pal('line'));
  atlas.add(dc.front(rect(-0.05, 0.71, 0.05, 0.81), { offset: 0.008, minFacing: 0.05, ...ff }).uvRect(A_LOGO));
  const hy = frontYaw(30, -2.05);
  head.add(dc.any(hy)(rpoly([[-0.86, 0.62], [-0.24, 0.6], [-0.24, 0.7], [-0.82, 0.74]], 0.012), { offset: 0.005, minFacing: 0.03, box: [-0.24, 0.6, -0.86, 0.74], ...ff }));
  head.add(head.mirrored());
  const fp = plate([0, 0.38, pr.frontZ(0, 0.38) - 0.01], A_PLATE, { front: true, tilt: 0.04 });
  atlas.add(fp.face); pal.add(fp.back);

  // --- mirrors, handles, black roof rails, shark fin
  const mx = pr.sideX(-0.6, 1.02);
  paint.add(blob(0.22, 0.12, 0.09, { p: [mx + 0.1, 1.05, -0.6] }, null, 3.5).sym());
  pal.add(box(0.07, 0.03, 0.06, { p: [mx + 0.01, 1.01, -0.6] }, 'gloss').sym());
  for (const z of [0.12, 1.06]) paint.add(blob(0.026, 0.03, 0.17, { p: [pr.sideX(z, 0.88) + 0.005, 0.88, z] }, null, 5, 8).sym());
  pal.add(roofRail(pr, 0.55, 0.12, 1.92, 0.034, 'gloss', 0.011).sym());
  paint.add(blob(0.05, 0.065, 0.17, { p: [0, pr.topY(0, 1.78) + 0.02, 1.78] }, null, 2.5, 8));

  const wheel = { soup: buildWheel({ R: DIMS.wheelRadius, width: 0.225, rimR: 0.215, style: 'spoke5' }) };
  const car = assembleCar({ id: 'f31', dims: DIMS, parts: { paint, glass, pal, tail, chmsl, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel });
  return tintPaint(car, 'f31', 0x4b4e53, { metalness: 0.7, roughness: 0.34 });
}
