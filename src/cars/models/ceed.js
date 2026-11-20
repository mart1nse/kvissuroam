// Kia Ceed Sportswagon (CD, 2021-2022 facelift) in Experience Green, a muted grey-green (Martin, 20 Nov).
// Not drivable, only a shell for the parked fleet (src/world/parked.js), built like the BMW F31.
// Long low estate: short bonnet, roof sloping gently down to a raked tailgate, chrome strip round the side
// windows, silver roof rails, the slim tiger-nose grille between swept LED headlamps with the four
// "ice cube" daytime lights, a wide black lower intake, the new KIA script on the bonnet and tailgate.
import { Soup, buildBody, cutArches, decals, probe, rpoly, rect, stroke, grow, box, blob, cyl, buildWheel, canvasTex, drawPlate, plate, assembleCar, frontYaw, rearWiper, tintPaint, roofRail } from './kit.js';

// real car: 4600 x 1800 x 1465 mm, wheelbase 2650, overhangs 880 / 1070, track ~1570, 225/45 R17
const DIMS = { length: 4.6, width: 1.8, height: 1.465, wheelbase: 2.65, track: 1.57, wheelRadius: 0.317 };
const HZ = DIMS.wheelbase / 2, ZF = -HZ - 0.88, ZR = HZ + 1.07;
export const CEED_GREEN = 0x58696a;

function lampTextures() {
  // tail: u 0 = inboard end on the tailgate, 1 = round the corner. Dark red with two thin LED lines,
  // the lower one kinking up at the outer end
  const tail = (glow) => (g, w, h) => {
    if (glow) { g.fillStyle = '#200000'; g.fillRect(0, 0, w, h); } else {
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#3a0406'); bg.addColorStop(0.5, '#62070d'); bg.addColorStop(1, '#2c0305');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
    }
    g.strokeStyle = glow ? '#ffffff' : '#ff3a3a'; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = h * 0.09;
    g.beginPath(); g.moveTo(w * 0.06, h * 0.28); g.lineTo(w * 0.92, h * 0.24); g.stroke();
    g.beginPath(); g.moveTo(w * 0.2, h * 0.66); g.lineTo(w * 0.7, h * 0.64); g.lineTo(w * 0.86, h * 0.42); g.stroke();
    if (!glow) {
      g.fillStyle = 'rgba(210,210,220,.35)'; g.fillRect(w * 0.08, h * 0.4, w * 0.2, h * 0.14);   // reverse light
      g.strokeStyle = '#0c0000'; g.lineWidth = 5; g.strokeRect(0, 0, w, h);
    }
  };
  // head: u 0 = outer corner, 1 = by the grille. The four ice cubes in a row below a thin light line
  const head = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#121518'; g.fillRect(0, 0, w, h);
    g.fillStyle = glow ? '#fff' : '#dbe4ec';
    g.fillRect(w * 0.08, h * 0.1, w * 0.84, h * 0.08);
    for (let i = 0; i < 4; i++) {
      const x = w * (0.24 + i * 0.1), y = h * 0.4, s = h * 0.3;
      g.beginPath(); g.moveTo(x, y + s * 0.5); g.lineTo(x + s * 0.45, y); g.lineTo(x + s * 0.9, y + s * 0.5); g.lineTo(x + s * 0.45, y + s); g.closePath(); g.fill();
    }
    if (!glow) { g.fillStyle = '#9aa4ad'; g.beginPath(); g.arc(w * 0.82, h * 0.55, h * 0.2, 0, 7); g.fill(); }
  };
  return { tailMap: canvasTex(512, 128, tail(false)), tailGlow: canvasTex(512, 128, tail(true)), headMap: canvasTex(256, 64, head(false)), headGlow: canvasTex(256, 64, head(true)) };
}
const AW = 1024, AH = 512;
const uvr = (x, y, w, h) => [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
const A_PLATE = uvr(0, 0, 832, 181), A_KIA = uvr(0, 200, 360, 130), A_NAME = uvr(400, 210, 300, 100);
function atlasTex() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    drawPlate(g, 0, 0, 832, 181, '214 CSW');
    // the 2021 KIA script: one unbroken line, K's stem, its arm running up into the I, the A without a bar
    g.strokeStyle = '#e4e7ea'; g.lineWidth = 15; g.lineCap = 'butt'; g.lineJoin = 'miter';
    const X = (u) => 20 + u * 320, Y = (v) => 212 + v * 106;
    g.beginPath(); g.moveTo(X(0.02), Y(0)); g.lineTo(X(0.02), Y(1)); g.stroke();
    g.beginPath(); g.moveTo(X(0.06), Y(0.62)); g.lineTo(X(0.36), Y(0.0)); g.lineTo(X(0.36), Y(1)); g.stroke();
    g.beginPath(); g.moveTo(X(0.16), Y(0.42)); g.lineTo(X(0.3), Y(1)); g.stroke();
    g.beginPath(); g.moveTo(X(0.5), Y(1)); g.lineTo(X(0.75), Y(0.0)); g.lineTo(X(0.98), Y(1)); g.stroke();
    g.fillStyle = '#e4e7ea'; g.font = '500 76px "Helvetica Neue", Arial, sans-serif'; g.textBaseline = 'middle';
    g.fillText('Ceed', 410, 262);
  });
}

export function buildCeedSW() {
  const body = buildBody({
    top: [[ZF, 0.47], [ZF + 0.006, 0.6, 0.03], [ZF + 0.04, 0.685, 0.04], [ZF + 0.18, 0.77, 0.08], [-1.45, 0.88, 0.25], [-0.95, 0.955, 0.08], [-0.15, 1.4, 0.25],
      [0.45, 1.465, 0.8], [1.65, 1.405, 0.1], [1.93, 1.37, 0.012], [1.942, 1.345, 0.012], [2.22, 1.08, 0.03], [2.33, 1.01, 0.03], [2.37, 0.68, 0.02], [ZR - 0.006, 0.6, 0.02], [ZR, 0.47]],
    bottom: [[ZF, 0.47], [ZF + 0.006, 0.34, 0.03], [ZF + 0.12, 0.19, 0.05], [-1.7, 0.16, 0.1], [1.8, 0.17, 0.1], [2.2, 0.27, 0.05], [ZR - 0.008, 0.36, 0.03], [ZR, 0.47]],
    w: [[ZF, 0.78], [ZF + 0.3, 0.875], [-1.4, 0.895], [0, 0.9], [1.4, 0.9], [2.1, 0.875], [ZR, 0.83]],
    yWaist: 0.72, tuck: 0.06, ySill: 0.18,
    yBelt: [[-0.95, 0.95], [-0.3, 0.965], [1.0, 1.0], [2.0, 1.06], [ZR, 1.06]],
    sh: 0.03, ledge: 0.012, th: 0.42, thc: 0.3,
    rr: [[ZF, 0.08], [-0.95, 0.08], [-0.15, 0.1], [1.93, 0.1], [2.1, 0.08], [2.35, 0.07], [ZR, 0.05]],
    rs: 0.065,
    crown: [[ZF, 0.04], [-0.95, 0.045], [-0.15, 0.05], [1.93, 0.045], [2.1, 0.03], [ZR, 0.02]],
    bow: [[ZF, 0.32], [-1.9, 0.19], [-1.4, 0.1], [-0.95, 0.2], [0.0, 0.08], [0.35, 0], [1.2, 0], [1.93, 0.1], [2.1, 0.19], [ZR, 0.26]],
    bowN: [[ZF, 2.6], [-1.4, 2.4], [-0.95, 2.2], [1.2, 2.5], [1.93, 3], [ZR, 3.0]],
  });
  const raw = body.soup, pr = probe(raw);
  const AY = DIMS.wheelRadius, AR = 0.385;
  const { soup: shell, liner } = cutArches(raw, [{ z: -HZ, y: AY, r: AR }, { z: HZ, y: AY, r: AR }], { halfWidth: 0.9 });
  const dc = decals(shell);
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup(), chmsl = new Soup();
  const fr = { filter: (v) => v[2] > 1.7 }, ff = { filter: (v) => v[2] < -1.6 };

  // --- glazing: three side windows (the last one pointed at the back) in black frames, a thin chrome strip
  // all the way round them
  const dlo = rpoly([[-0.76, 0.975], [0.3, 0.99], [1.3, 1.02], [1.9, 1.058], [1.95, 1.1], [1.75, 1.26], [1.1, 1.335], [0.45, 1.36], [-0.08, 1.335]], 0.025, 3);
  pal.add(dc.side(grow(dlo, 0.03), { offset: 0.0025 }).pal('chrome').sym());
  pal.add(dc.side(grow(dlo, 0.017), { offset: 0.003 }).pal('gloss').sym());
  glass.add(dc.side(dlo, { offset: 0.005 }).sym());
  pal.add(dc.side([rect(0.27, 0.98, 0.34, 1.37), rect(1.3, 1.01, 1.35, 1.33)], { offset: 0.0065 }).pal('gloss').sym());
  const ws = rpoly([[-0.76, 0.99], [0.76, 0.99], [0.58, 1.34], [-0.58, 1.34]], 0.05);
  pal.add(dc.front(grow(ws, 0.014), { offset: 0.003 }).pal('gloss'));
  glass.add(dc.front(ws, { offset: 0.005 }));
  const rw = rpoly([[-0.62, 1.09], [0.62, 1.09], [0.52, 1.31], [-0.52, 1.31]], 0.045);
  pal.add(dc.rear(grow(rw, 0.016), { offset: 0.003, minFacing: 0.08, ...fr }).pal('gloss'));
  glass.add(dc.rear(rw, { offset: 0.007, minFacing: 0.08, ...fr }));

  // --- black lower bumpers, sills, the silver skid insert at the back
  pal.add(dc.rear(rpoly([[-0.78, 0.2], [0.78, 0.2], [0.7, 0.38], [-0.7, 0.38]], 0.03), { offset: 0.003, minFacing: -0.3, filter: (v) => v[2] > 2.1 && v[1] < 0.42 }).pal('plastic'));
  pal.add(dc.rear(rect(-0.42, 0.25, 0.42, 0.29, 0.01), { offset: 0.005, minFacing: -0.3, filter: (v) => v[2] > 2.1 && v[1] < 0.42 }).pal('silver'));
  pal.add(dc.side([rect(-HZ + 0.34, 0.15, HZ - 0.34, 0.23)], { offset: 0.003, minFacing: 0.1 }).pal('plastic').sym());
  pal.add(dc.rear([rect(0.6, 0.42, 0.78, 0.45, 0.008)], { offset: 0.005, minFacing: 0.05, ...fr }).pal('reflector').sym());

  // --- shut lines, the shoulder crease
  const lw = 0.008;
  pal.add(dc.side([
    ...stroke([[-0.9, 0.27], [-0.9, 0.96]], lw), ...stroke([[0.3, 0.27], [0.3, 0.99]], lw),
    ...stroke([[1.33, 1.02], [1.28, 0.9], [1.12, 0.78], [0.98, 0.72], [0.95, 0.55], [0.95, 0.27]], lw),
    ...stroke([[-0.9, 0.27], [0.95, 0.27]], lw),
  ], { offset: 0.0055 }).pal('line').sym());
  pal.add(dc.side(stroke([[-1.9, 0.84], [0, 0.88], [2.2, 0.92]], 0.004), { offset: 0.005 }).pal('line').sym());
  pal.add(dc.top(stroke([[0.7, -2.0], [0.78, -0.95]], lw), { offset: 0.0055, minFacing: 0.4 }).pal('line').sym());
  pal.add(dc.rear([...stroke([[0.6, 1.04], [0.62, 0.95], [0.62, 0.6]], lw), ...stroke([[-0.62, 0.6], [0.62, 0.6]], lw)], { offset: 0.0055, ...fr }).pal('line').sym());

  // --- tail lamps on the corners reaching into the tailgate, KIA script, Ceed badge, plate, wiper
  const ty = dc.yaw(30), to = { minFacing: 0.02, origin: [0, 0, 2.28], ...fr };
  const lampPoly = rpoly([[0.36, 0.9], [0.68, 0.88], [0.94, 0.87], [1.0, 0.9], [0.98, 1.0], [0.86, 1.02], [0.6, 1.0], [0.36, 0.96]], 0.014, 3);
  tail.add(ty(lampPoly, { offset: 0.005, ...to }));
  tail.add(tail.mirrored());
  reverse.add(ty(rect(0.4, 0.92, 0.52, 0.935, 0.004), { offset: 0.0065, ...to }).sym());
  chmsl.add(dc.rear(rect(-0.24, 1.325, 0.24, 1.34, 0.005), { offset: 0.004, minFacing: 0.1, ...fr }));
  atlas.add(dc.rear(rect(-0.17, 0.9, 0.17, 0.96), { offset: 0.007, minFacing: 0.05, ...fr }).uvRect(A_KIA));
  atlas.add(dc.rear(rect(-0.58, 0.68, -0.4, 0.74), { offset: 0.007, ...fr }).uvRect(A_NAME));
  const pl = plate([0, 0.76, pr.rearZ(0, 0.76) + 0.008], A_PLATE, { tilt: 0.1 });
  atlas.add(pl.face); pal.add(pl.back);
  pal.add(rearWiper(pr, 0.0, 1.1, 0.32, 1.13));

  // --- front: the slim tiger-nose grille in a chrome surround between the headlamps, the KIA script
  // above it, the wide black lower intake with its mesh and the black corner fins
  const grille = rpoly([[-0.44, 0.6], [0.44, 0.6], [0.5, 0.7], [0.12, 0.69], [0, 0.66], [-0.12, 0.69], [-0.5, 0.7]], 0.02, 3);
  pal.add(dc.front(grow(grille, 0.014), { offset: 0.004, minFacing: -0.1, ...ff }).pal('chrome'));
  pal.add(dc.front(grille, { offset: 0.0055, minFacing: -0.1, ...ff }).pal('gloss'));
  pal.add(dc.front(rpoly([[-0.66, 0.24], [0.66, 0.24], [0.6, 0.44], [-0.6, 0.44]], 0.04), { offset: 0.004, minFacing: -0.3, ...ff }).pal('gloss'));
  pal.add(dc.front([...stroke([[-0.58, 0.3], [0.58, 0.3]], 0.008), ...stroke([[-0.6, 0.36], [0.6, 0.36]], 0.008)], { offset: 0.0055, minFacing: -0.3, ...ff }).pal('plastic'));
  pal.add(dc.front([rpoly([[-0.86, 0.3], [-0.68, 0.3], [-0.62, 0.42], [-0.8, 0.44]], 0.015), rpoly([[0.68, 0.3], [0.86, 0.3], [0.8, 0.44], [0.62, 0.42]], 0.015)], { offset: 0.0045, minFacing: -0.6, ...ff }).pal('gloss'));
  atlas.add(dc.front(rect(-0.17, 0.72, 0.17, 0.78), { offset: 0.008, minFacing: 0.05, ...ff }).uvRect(A_KIA));
  const hy = frontYaw(32, -2.05);
  head.add(dc.any(hy)(rpoly([[-0.88, 0.66], [-0.5, 0.64], [-0.48, 0.7], [-0.6, 0.745], [-0.84, 0.77]], 0.012), { offset: 0.005, minFacing: 0.03, box: [-0.48, 0.64, -0.88, 0.77], ...ff }));
  head.add(head.mirrored());
  const fp = plate([0, 0.48, pr.frontZ(0, 0.48) - 0.01], A_PLATE, { front: true, tilt: 0.04 });
  atlas.add(fp.face); pal.add(fp.back);

  // --- mirrors in body colour on black bases, handles, silver roof rails, shark fin
  const mx = pr.sideX(-0.6, 1.02);
  paint.add(blob(0.22, 0.12, 0.09, { p: [mx + 0.1, 1.05, -0.6] }, null, 3.5).sym());
  pal.add(box(0.07, 0.03, 0.06, { p: [mx + 0.01, 1.01, -0.6] }, 'gloss').sym());
  for (const z of [0.12, 1.12]) paint.add(blob(0.026, 0.03, 0.17, { p: [pr.sideX(z, 0.9) + 0.005, 0.9, z] }, null, 5, 8).sym());
  pal.add(roofRail(pr, 0.56, -0.05, 1.85, 0.04, 'silver', 0.012).sym());
  paint.add(blob(0.05, 0.065, 0.17, { p: [0, pr.topY(0, 1.72) + 0.02, 1.72] }, null, 2.5, 8));
  // one exhaust, tucked under the bumper on the left
  pal.add(cyl(0.03, 0.03, 0.08, 12, { p: [-0.5, 0.26, 2.33], r: [Math.PI / 2, 0, 0] }, 'darkalloy', true));

  const wheel = { soup: buildWheel({ R: DIMS.wheelRadius, width: 0.225, rimR: 0.216, style: 'spoke5' }) };
  const car = assembleCar({ id: 'ceedsw', dims: DIMS, parts: { paint, glass, pal, tail, chmsl, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel });
  return tintPaint(car, 'ceedsw', CEED_GREEN, { metalness: 0.6, roughness: 0.34 });
}
