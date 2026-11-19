// Two saloons for the parked fleet (Martin, 19 Nov): a Tesla Model 3 and a 2010 EU-spec Honda Accord
// (8th generation, CU2). Not drivable, only shells for src/world/parked.js, built like the BMW F31.
import { Soup, buildBody, cutArches, decals, probe, rpoly, rect, stroke, grow, box, blob, cyl, buildWheel, canvasTex, drawPlate, plate, assembleCar, frontYaw, tintPaint, tintGlass } from './kit.js';

const AW = 1024, AH = 512;
const uvr = (x, y, w, h) => [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
const A_PLATE = uvr(0, 0, 832, 181), A_LOGO = uvr(0, 200, 180, 180), A_NAME = uvr(200, 210, 420, 90);

// tail lamp: u 0 = inboard, 1 = round the corner. bars: [y0, y1] light bars across the lamp
function lampTextures({ base = ['#3a0406', '#6a080e', '#300305'], bars, ring = false, head }) {
  const tail = (glow) => (g, w, h) => {
    if (glow) { g.fillStyle = '#200000'; g.fillRect(0, 0, w, h); } else {
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, base[0]); bg.addColorStop(0.5, base[1]); bg.addColorStop(1, base[2]);
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
    }
    g.fillStyle = glow ? '#ffffff' : '#ff3a3a';
    for (const [a, b, u0 = 0.06, u1 = 0.94] of bars) g.fillRect(w * u0, h * a, w * (u1 - u0), h * (b - a));
    if (ring) {
      g.strokeStyle = glow ? '#ffffff' : '#ff4848'; g.lineWidth = h * 0.08;
      g.beginPath(); g.ellipse(w * 0.62, h * 0.5, w * 0.2, h * 0.3, 0, 0, 7); g.stroke();
    }
    if (!glow) { g.strokeStyle = '#0c0000'; g.lineWidth = 5; g.strokeRect(0, 0, w, h); }
  };
  return { tailMap: canvasTex(512, 128, tail(false)), tailGlow: canvasTex(512, 128, tail(true)), headMap: canvasTex(256, 64, head(false)), headGlow: canvasTex(256, 64, head(true)) };
}

// ======================================================================== Tesla Model 3
// real car (2017-2023): 4694 x 1849 x 1443 mm, wheelbase 2875, track 1580, 235/45 R18 behind aero covers.
// No grille, a low rounded nose, glass from the windscreen over the roof to the short boot lid.
const M3D = { length: 4.694, width: 1.849, height: 1.443, wheelbase: 2.875, track: 1.58, wheelRadius: 0.334 };

function teslaAtlas() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    drawPlate(g, 0, 0, 832, 181, '303 TSL');
    // the T: a curved bar over a stem
    g.fillStyle = '#d9dde2';
    g.beginPath(); g.moveTo(10, 228); g.quadraticCurveTo(90, 206, 170, 228); g.lineTo(166, 246); g.quadraticCurveTo(90, 228, 14, 246); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(76, 252); g.lineTo(104, 252); g.lineTo(96, 372); g.lineTo(84, 372); g.closePath(); g.fill();
    g.font = '600 64px "Helvetica Neue", Arial, sans-serif'; g.textBaseline = 'middle'; g.fillStyle = '#e8eaee';
    g.fillText('T E S L A', 214, 256);
  });
}

export function buildModel3() {
  const D = M3D, HZ = D.wheelbase / 2, ZF = -HZ - 0.84, ZR = HZ + 0.98;
  const body = buildBody({
    top: [[ZF, 0.47], [ZF + 0.008, 0.57, 0.04], [ZF + 0.07, 0.655, 0.06], [ZF + 0.3, 0.72, 0.18], [-1.15, 0.86, 0.25], [-1.0, 0.885, 0.06],
      [-0.25, 1.415, 0.35], [0.3, 1.443, 0.7], [1.0, 1.37, 0.45], [1.62, 1.07, 0.12], [2.2, 1.005, 0.12], [2.3, 1.012, 0.01],
      [ZR - 0.03, 0.97, 0.03], [ZR - 0.006, 0.62, 0.03], [ZR, 0.47]],
    bottom: [[ZF, 0.47], [ZF + 0.006, 0.33, 0.04], [ZF + 0.14, 0.17, 0.06], [-1.75, 0.14, 0.1], [1.9, 0.15, 0.1], [2.2, 0.26, 0.05], [ZR - 0.008, 0.36, 0.03], [ZR, 0.47]],
    w: [[ZF, 0.78], [ZF + 0.3, 0.89], [-1.4, 0.92], [0, 0.924], [1.4, 0.924], [2.1, 0.9], [ZR, 0.84]],
    yWaist: 0.7, tuck: 0.07, ySill: 0.17,
    yBelt: [[-1.0, 0.88], [-0.3, 0.92], [1.0, 0.96], [1.7, 0.99], [ZR, 0.99]],
    sh: 0.035, ledge: 0.008, th: 0.5, thc: 0.4,
    rr: [[ZF, 0.1], [-1.0, 0.09], [-0.25, 0.12], [1.62, 0.12], [2.2, 0.08], [ZR, 0.06]],
    rs: 0.07,
    crown: [[ZF, 0.05], [-1.0, 0.05], [-0.25, 0.06], [1.62, 0.05], [2.2, 0.03], [ZR, 0.02]],
    bow: [[ZF, 0.34], [-1.9, 0.2], [-1.4, 0.1], [-1.0, 0.18], [0.0, 0.08], [0.35, 0], [1.2, 0], [1.9, 0.1], [2.2, 0.2], [ZR, 0.3]],
    bowN: [[ZF, 2.4], [-1.4, 2.4], [-1.0, 2.2], [1.2, 2.5], [1.9, 3], [ZR, 3.0]],
  });
  const raw = body.soup, pr = probe(raw);
  const { soup: shell, liner } = cutArches(raw, [{ z: -HZ, y: D.wheelRadius, r: 0.39 }, { z: HZ, y: D.wheelRadius, r: 0.39 }], { halfWidth: 0.93 });
  const dc = decals(shell);
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup(), chmsl = new Soup();
  const fr = { filter: (v) => v[2] > 1.8 }, ff = { filter: (v) => v[2] < -1.7 };

  // --- glass: side windows in black frames, and one sheet from the windscreen over the roof to the boot lid
  const dlo = rpoly([[-0.92, 0.9], [0.3, 0.935], [1.15, 0.965], [1.58, 1.0], [1.35, 1.14], [0.9, 1.3], [0.3, 1.365], [-0.3, 1.355]], 0.03, 3);
  pal.add(dc.side(grow(dlo, 0.018), { offset: 0.003 }).pal('gloss').sym());
  glass.add(dc.side(dlo, { offset: 0.005 }).sym());
  pal.add(dc.side([rect(0.27, 0.92, 0.36, 1.37)], { offset: 0.0065 }).pal('gloss').sym());       // B-pillar
  const roof = rpoly([[-0.66, -0.98], [0.66, -0.98], [0.62, -0.3], [0.6, 0.6], [0.6, 1.3], [0.55, 1.6], [-0.55, 1.6], [-0.6, 1.3], [-0.6, 0.6], [-0.62, -0.3]], 0.06, 3);
  pal.add(dc.top(grow(roof, 0.016), { offset: 0.003, minFacing: 0.25 }).pal('gloss'));
  glass.add(dc.top(roof, { offset: 0.005, minFacing: 0.25 }));

  // --- black lower trim, shut lines, flush door handles
  pal.add(dc.rear(rpoly([[-0.72, 0.2], [0.72, 0.2], [0.66, 0.34], [-0.66, 0.34]], 0.03), { offset: 0.003, minFacing: -0.3, filter: (v) => v[2] > 2.1 && v[1] < 0.4 }).pal('plastic'));
  const lw = 0.007;
  pal.add(dc.side([
    ...stroke([[-0.98, 0.26], [-0.98, 0.88]], lw), ...stroke([[0.32, 0.26], [0.32, 0.93]], lw),
    ...stroke([[1.4, 0.98], [1.3, 0.8], [1.25, 0.6], [1.22, 0.26]], lw), ...stroke([[-0.98, 0.26], [1.22, 0.26]], lw),
    ...stroke([[-0.3, 0.86], [-0.08, 0.86]], 0.02), ...stroke([[0.82, 0.88], [1.02, 0.88]], 0.02),
  ], { offset: 0.0055 }).pal('line').sym());
  pal.add(dc.top(stroke([[0.62, -2.1], [0.7, -1.05]], lw), { offset: 0.0055, minFacing: 0.4 }).pal('line').sym());
  pal.add(dc.top(stroke([[-0.62, 1.68], [0.62, 1.68]], lw), { offset: 0.0055, minFacing: 0.3 }));
  pal.add(dc.rear(stroke([[-0.66, 0.8], [0.66, 0.8]], lw), { offset: 0.0055, ...fr }));

  // --- tail lamps wrapping onto the wings and boot lid, T badge, TESLA lettering, plate
  const ty = dc.yaw(32), to = { minFacing: 0.02, origin: [0, 0, 2.35], ...fr };
  tail.add(ty(rpoly([[0.42, 0.86], [0.7, 0.85], [0.96, 0.84], [1.02, 0.88], [0.98, 0.96], [0.72, 0.965], [0.42, 0.93]], 0.02, 3), { offset: 0.005, ...to }));
  tail.add(tail.mirrored());
  reverse.add(ty(rect(0.46, 0.87, 0.6, 0.885, 0.004), { offset: 0.0065, ...to }).sym());
  atlas.add(dc.rear(rect(-0.04, 0.88, 0.04, 0.96), { offset: 0.007, minFacing: 0.05, ...fr }).uvRect(A_LOGO));
  atlas.add(dc.rear(rect(-0.2, 0.83, 0.2, 0.859), { offset: 0.007, minFacing: 0.05, ...fr }).uvRect(A_NAME));
  const pl = plate([0, 0.66, pr.rearZ(0, 0.66) + 0.008], A_PLATE, { tilt: 0.08 });
  atlas.add(pl.face); pal.add(pl.back);

  // --- front: smooth nose, slim swept headlamps, low black intake, T badge
  pal.add(dc.front([rpoly([[-0.56, 0.2], [0.56, 0.2], [0.5, 0.32], [-0.5, 0.32]], 0.04)], { offset: 0.004, minFacing: -0.3, ...ff }).pal('gloss'));
  atlas.add(dc.front(rect(-0.04, 0.55, 0.04, 0.63), { offset: 0.008, minFacing: 0.05, ...ff }).uvRect(A_LOGO));
  const hy = frontYaw(34, -2.0);
  head.add(dc.any(hy)(rpoly([[-0.9, 0.6], [-0.4, 0.57], [-0.3, 0.6], [-0.42, 0.65], [-0.86, 0.66]], 0.015), { offset: 0.005, minFacing: 0.03, box: [-0.3, 0.57, -0.9, 0.66], ...ff }));
  head.add(head.mirrored());
  const fp = plate([0, 0.37, pr.frontZ(0, 0.37) - 0.01], A_PLATE, { front: true, tilt: 0.04 });
  atlas.add(fp.face); pal.add(fp.back);

  // --- door mirrors in body colour on black stalks
  const mx = pr.sideX(-0.75, 0.98);
  paint.add(blob(0.2, 0.11, 0.09, { p: [mx + 0.1, 1.0, -0.75] }, null, 3.5).sym());
  pal.add(box(0.06, 0.03, 0.05, { p: [mx + 0.01, 0.95, -0.75] }, 'gloss').sym());

  const wheel = { soup: buildWheel({ R: D.wheelRadius, width: 0.235, rimR: 0.229, style: 'aero' }) };
  const car = assembleCar({ id: 'model3', dims: D, parts: { paint, glass, pal, tail, chmsl, reverse, head, atlas },
    tex: { ...lampTextures({ bars: [[0.3, 0.42, 0.1, 0.9]], ring: true, head: (glow) => (g, w, h) => {
      g.fillStyle = glow ? '#000' : '#101317'; g.fillRect(0, 0, w, h);
      g.fillStyle = glow ? '#fff' : '#cfd8e0'; g.fillRect(w * 0.06, h * 0.12, w * 0.88, h * 0.1);
      g.beginPath(); g.arc(w * 0.62, h * 0.55, h * 0.24, 0, 7); g.fill();
    } }), atlas: teslaAtlas() }, wheel });
  return tintPaint(car, 'model3', 0xe8e9e8, { metalness: 0.05, roughness: 0.38 });
}

// ======================================================================== Honda Accord, 2010 EU saloon
// real car (CU2, 2008-2015): 4726 x 1840 x 1440 mm, wheelbase 2705, track 1590, 225/50 R17.
// Classic three-box shape, chrome grille bar between the headlamps, tail lamps split between wing and boot lid.
const ACD = { length: 4.726, width: 1.84, height: 1.44, wheelbase: 2.705, track: 1.585, wheelRadius: 0.328 };

function hondaAtlas() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    drawPlate(g, 0, 0, 832, 181, '208 ACC');
    // the H: chrome on black, in a rounded square widening to the top
    g.fillStyle = '#d4d8dc';
    g.beginPath(); g.moveTo(14, 212); g.lineTo(166, 212); g.lineTo(152, 368); g.lineTo(28, 368); g.closePath(); g.fill();
    g.fillStyle = '#111';
    g.beginPath(); g.moveTo(26, 222); g.lineTo(154, 222); g.lineTo(142, 358); g.lineTo(38, 358); g.closePath(); g.fill();
    g.fillStyle = '#e4e7ea';
    g.fillRect(46, 236, 22, 110); g.fillRect(112, 236, 22, 110); g.fillRect(60, 282, 60, 18);
    g.font = 'italic 600 70px "Helvetica Neue", Arial, sans-serif'; g.textBaseline = 'middle'; g.fillStyle = '#e8eaee';
    g.fillText('ACCORD', 214, 256);
  });
}

export function buildAccord() {
  const D = ACD, HZ = D.wheelbase / 2, ZF = -HZ - 0.95, ZR = HZ + 1.07;
  const body = buildBody({
    top: [[ZF, 0.5], [ZF + 0.006, 0.62, 0.03], [ZF + 0.05, 0.71, 0.04], [ZF + 0.22, 0.78, 0.12], [-1.3, 0.89, 0.25], [-0.98, 0.935, 0.06],
      [-0.22, 1.41, 0.28], [0.4, 1.44, 0.65], [0.98, 1.39, 0.25], [1.62, 1.06, 0.08], [2.2, 1.035, 0.15], [ZR - 0.03, 1.02, 0.02],
      [ZR - 0.006, 0.66, 0.03], [ZR, 0.5]],
    bottom: [[ZF, 0.5], [ZF + 0.006, 0.36, 0.03], [ZF + 0.12, 0.2, 0.05], [-1.6, 0.17, 0.1], [1.8, 0.18, 0.1], [2.2, 0.29, 0.05], [ZR - 0.008, 0.4, 0.03], [ZR, 0.5]],
    w: [[ZF, 0.8], [ZF + 0.3, 0.89], [-1.4, 0.915], [0, 0.92], [1.4, 0.92], [2.1, 0.9], [ZR, 0.86]],
    yWaist: 0.74, tuck: 0.06, ySill: 0.18,
    yBelt: [[-1.0, 0.93], [-0.3, 0.945], [1.0, 0.98], [1.7, 1.02], [ZR, 1.02]],
    sh: 0.03, ledge: 0.012, th: 0.45, thc: 0.3,
    rr: [[ZF, 0.07], [-1.0, 0.07], [-0.22, 0.1], [1.62, 0.1], [2.1, 0.07], [ZR, 0.05]],
    rs: 0.06,
    crown: [[ZF, 0.035], [-1.0, 0.045], [-0.22, 0.05], [1.62, 0.045], [2.1, 0.025], [ZR, 0.02]],
    bow: [[ZF, 0.3], [-1.9, 0.18], [-1.4, 0.1], [-0.98, 0.2], [0.0, 0.08], [0.35, 0], [1.2, 0], [1.9, 0.1], [2.2, 0.17], [ZR, 0.24]],
    bowN: [[ZF, 2.6], [-1.4, 2.4], [-0.98, 2.2], [1.2, 2.5], [1.9, 3], [ZR, 3.0]],
  });
  const raw = body.soup, pr = probe(raw);
  const { soup: shell, liner } = cutArches(raw, [{ z: -HZ, y: D.wheelRadius, r: 0.385 }, { z: HZ, y: D.wheelRadius, r: 0.385 }], { halfWidth: 0.925 });
  const dc = decals(shell);
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup(), chmsl = new Soup();
  const fr = { filter: (v) => v[2] > 1.8 }, ff = { filter: (v) => v[2] < -1.75 };

  // --- glazing: front and rear door windows with a small quarter light, windscreen and rear window
  const dlo = rpoly([[-0.92, 0.95], [0.28, 0.97], [1.15, 1.0], [1.52, 1.04], [1.32, 1.16], [0.9, 1.34], [0.3, 1.385], [-0.25, 1.37]], 0.025, 3);
  pal.add(dc.side(grow(dlo, 0.016), { offset: 0.003 }).pal('gloss').sym());
  glass.add(dc.side(dlo, { offset: 0.005 }).sym());
  pal.add(dc.side([rect(0.26, 0.96, 0.33, 1.39), rect(1.2, 1.0, 1.24, 1.3)], { offset: 0.0065 }).pal('gloss').sym());
  pal.add(dc.side(stroke([[-0.9, 0.955], [1.5, 1.035]], 0.012), { offset: 0.0068 }).pal('chrome').sym());   // chrome belt strip
  const ws = rpoly([[-0.7, -0.96], [0.7, -0.96], [0.6, -0.26], [-0.6, -0.26]], 0.05);
  pal.add(dc.top(grow(ws, 0.016), { offset: 0.003, minFacing: 0.25 }).pal('gloss'));
  glass.add(dc.top(ws, { offset: 0.005, minFacing: 0.25 }));
  const rw = rpoly([[-0.6, 1.0], [0.6, 1.0], [0.66, 1.56], [-0.66, 1.56]], 0.05);
  pal.add(dc.top(grow(rw, 0.016), { offset: 0.003, minFacing: 0.25 }).pal('gloss'));
  glass.add(dc.top(rw, { offset: 0.005, minFacing: 0.25 }));

  // --- lower trim, shut lines, handles
  pal.add(dc.rear(rpoly([[-0.74, 0.22], [0.74, 0.22], [0.68, 0.36], [-0.68, 0.36]], 0.03), { offset: 0.003, minFacing: -0.3, filter: (v) => v[2] > 2.2 && v[1] < 0.42 }).pal('plastic'));
  const lw = 0.008;
  pal.add(dc.side([
    ...stroke([[-0.98, 0.28], [-0.98, 0.93]], lw), ...stroke([[0.3, 0.28], [0.3, 0.97]], lw),
    ...stroke([[1.32, 1.0], [1.28, 0.85], [1.2, 0.72], [1.16, 0.5], [1.16, 0.28]], lw), ...stroke([[-0.98, 0.28], [1.16, 0.28]], lw),
  ], { offset: 0.0055 }).pal('line').sym());
  pal.add(dc.side(stroke([[-2.0, 0.8], [0, 0.82], [2.3, 0.86]], 0.004), { offset: 0.005 }).pal('line').sym());
  for (const z of [-0.12, 1.0]) paint.add(blob(0.026, 0.03, 0.17, { p: [pr.sideX(z, 0.86) + 0.005, 0.86, z] }, null, 5, 8).sym());
  pal.add(dc.top(stroke([[0.66, -2.15], [0.74, -1.0]], lw), { offset: 0.0055, minFacing: 0.4 }).pal('line').sym());
  pal.add(dc.top(stroke([[0.68, 1.62], [0.66, 2.4]], lw), { offset: 0.0055, minFacing: 0.4 }).pal('line').sym());
  pal.add(dc.rear([...stroke([[0.72, 1.0], [0.72, 0.64]], lw), ...stroke([[-0.72, 0.64], [0.72, 0.64]], lw)], { offset: 0.0055, ...fr }).pal('line').sym());

  // --- tail lamps split at the boot shut line, chrome strip over the plate, H badge, Accord script, plate
  const ty = dc.yaw(30), to = { minFacing: 0.02, origin: [0, 0, 2.35], ...fr };
  tail.add(ty(rpoly([[0.42, 0.8], [0.7, 0.79], [0.95, 0.8], [1.02, 0.86], [0.98, 0.98], [0.7, 0.99], [0.42, 0.95]], 0.02, 3), { offset: 0.005, ...to }));
  tail.add(tail.mirrored());
  reverse.add(ty(rect(0.46, 0.83, 0.62, 0.86, 0.006), { offset: 0.0065, ...to }).sym());
  pal.add(dc.rear(rect(-0.4, 0.86, 0.4, 0.885, 0.008), { offset: 0.006, minFacing: 0.05, ...fr }).pal('chrome'));
  chmsl.add(dc.top(rect(-0.18, 1.6, 0.18, 1.62), { offset: 0.006, minFacing: 0.25 }));
  atlas.add(dc.rear(rect(-0.05, 0.9, 0.05, 1.0), { offset: 0.007, minFacing: 0.05, ...fr }).uvRect(A_LOGO));
  atlas.add(dc.rear(rect(-0.66, 0.68, -0.44, 0.712), { offset: 0.007, ...fr }).uvRect(A_NAME));
  const pl = plate([0, 0.735, pr.rearZ(0, 0.735) + 0.008], A_PLATE, { tilt: 0.08 });
  atlas.add(pl.face); pal.add(pl.back);
  for (const x of [-0.52]) pal.add(cyl(0.035, 0.035, 0.1, 14, { p: [x, 0.3, ZR - 0.06], r: [Math.PI / 2, 0, 0] }, 'chrome', true));

  // --- front: chrome wing bar across the grille into the headlamps, black mesh grille, lower intake, fogs
  const grille = rpoly([[-0.42, 0.56], [0.42, 0.56], [0.46, 0.67], [-0.46, 0.67]], 0.03);
  pal.add(dc.front(grow(grille, 0.012), { offset: 0.004, minFacing: -0.1, ...ff }).pal('chrome'));
  pal.add(dc.front(grille, { offset: 0.0055, minFacing: -0.1, ...ff }).pal('gloss'));
  pal.add(dc.front(rect(-0.47, 0.645, 0.47, 0.672, 0.01), { offset: 0.0065, minFacing: -0.1, ...ff }).pal('chrome'));
  pal.add(dc.front([rpoly([[-0.5, 0.24], [0.5, 0.24], [0.44, 0.37], [-0.44, 0.37]], 0.03)], { offset: 0.004, minFacing: -0.3, ...ff }).pal('line'));
  pal.add(dc.front([rect(-0.74, 0.27, -0.6, 0.33, 0.02), rect(0.6, 0.27, 0.74, 0.33, 0.02)], { offset: 0.005, minFacing: -0.3, ...ff }).pal('lens'));
  atlas.add(dc.front(rect(-0.055, 0.565, 0.055, 0.665), { offset: 0.008, minFacing: 0.05, ...ff }).uvRect(A_LOGO));
  const hy = frontYaw(32, -2.08);
  head.add(dc.any(hy)(rpoly([[-0.9, 0.6], [-0.44, 0.59], [-0.4, 0.63], [-0.46, 0.73], [-0.86, 0.77]], 0.02), { offset: 0.005, minFacing: 0.03, box: [-0.4, 0.59, -0.9, 0.77], ...ff }));
  head.add(head.mirrored());
  const fp = plate([0, 0.42, pr.frontZ(0, 0.42) - 0.01], A_PLATE, { front: true, tilt: 0.04 });
  atlas.add(fp.face); pal.add(fp.back);

  // --- mirrors with indicator lenses, shark fin aerial
  const mx = pr.sideX(-0.72, 1.0);
  paint.add(blob(0.21, 0.12, 0.09, { p: [mx + 0.1, 1.03, -0.72] }, null, 3.5).sym());
  pal.add(box(0.07, 0.03, 0.06, { p: [mx + 0.01, 0.99, -0.72] }, 'gloss').sym());
  paint.add(blob(0.04, 0.05, 0.13, { p: [0, pr.topY(0, 0.95) + 0.015, 0.95] }, null, 2.5, 8));

  const wheel = { soup: buildWheel({ R: D.wheelRadius, width: 0.225, rimR: 0.216, style: 'spoke5' }) };
  const car = assembleCar({ id: 'accord', dims: D, parts: { paint, glass, pal, tail, chmsl, reverse, head, atlas },
    tex: { ...lampTextures({ bars: [[0.18, 0.3, 0.06, 0.94], [0.62, 0.72, 0.5, 0.94]], head: (glow) => (g, w, h) => {
      g.fillStyle = glow ? '#000' : '#15181c'; g.fillRect(0, 0, w, h);
      g.fillStyle = glow ? '#fff' : '#dfe6ee';
      g.beginPath(); g.arc(w * 0.3, h * 0.55, h * 0.3, 0, 7); g.fill();
      g.beginPath(); g.arc(w * 0.66, h * 0.55, h * 0.26, 0, 7); g.fill();
      if (!glow) { g.fillStyle = '#d07000'; g.fillRect(w * 0.84, h * 0.3, w * 0.1, h * 0.5); }
    } }), atlas: hondaAtlas() }, wheel });
  tintGlass(car, 'accord', { color: 0x1c242a, metalness: 0.85, roughness: 0.04 });
  return tintPaint(car, 'accord', 0xb3b7bc, { metalness: 0.7, roughness: 0.32 });
}
