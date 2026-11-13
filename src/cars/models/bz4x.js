// 2026 Toyota bZ4X Touring - long-roof electric estate/SUV, solid white with heavy black arch cladding
// and a full-width rear light bar.
import { Soup, buildBody, cutArches, decals, probe, rpoly, rect, stroke, grow, box, blob, buildWheel, canvasTex, drawPlate, plate, assembleCar, frontYaw, rearWiper, tintPaint, roofRail } from './kit.js';
import { toyotaLogo } from './rav4.js';

// real car: 4830 x 1895 x 1675 mm (with roof rails), wheelbase 2850, track 1600 front / 1610 rear, 235/50 R20
const DIMS = { length: 4.83, width: 1.895, height: 1.675, wheelbase: 2.85, track: 1.605, wheelRadius: 0.37 };
const ZF = -2.34, ZR = 2.49, HZ = DIMS.wheelbase / 2;
const BAR_UV = [0.2, 0.93];

function lampTextures() {
  const tail = (glow) => (g, w, h) => {
    // u: 0 = inboard, 1 = outboard; canvas top = lamp top. Light bar along the top, dropping down the outer edge.
    g.fillStyle = glow ? '#160000' : '#4a0508'; g.fillRect(0, 0, w, h);
    g.fillStyle = glow ? '#ffffff' : '#e21818';
    g.fillRect(0, 0, w, h * 0.17);
    g.beginPath(); g.moveTo(w * 0.74, 0); g.lineTo(w, 0); g.lineTo(w, h); g.lineTo(w * 0.84, h); g.lineTo(w * 0.78, h * 0.4); g.closePath(); g.fill();
    if (!glow) { g.fillStyle = '#b9b6b2'; g.fillRect(w * 0.04, h * 0.34, w * 0.5, h * 0.16); }
  };
  const head = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#101316'; g.fillRect(0, 0, w, h);
    g.strokeStyle = glow ? '#fff' : '#eaf2f8'; g.lineWidth = h * 0.2; g.lineJoin = 'miter';
    // C-shaped daytime running light, open to the centre
    g.beginPath(); g.moveTo(w * 0.04, h * 0.2); g.lineTo(w * 0.9, h * 0.2); g.lineTo(w * 0.86, h * 0.78); g.lineTo(w * 0.45, h * 0.78); g.stroke();
  };
  return { tailMap: canvasTex(256, 128, tail(false)), tailGlow: canvasTex(256, 128, tail(true)), headMap: canvasTex(256, 64, head(false)), headGlow: canvasTex(256, 64, head(true)) };
}
const AW = 1024, AH = 512;
const uvr = (x, y, w, h) => [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
const A_PLATE = uvr(0, 0, 832, 181), A_LOGO = uvr(0, 200, 200, 140), A_BZ = uvr(220, 200, 330, 100), A_AWD = uvr(570, 200, 240, 100), A_TOY = uvr(0, 360, 620, 100);
function atlasTex() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    drawPlate(g, 0, 0, 832, 181, '426 BZX');
    toyotaLogo(g, 100, 270, 98, '#c9ccd0');
    g.fillStyle = '#15171a'; g.textBaseline = 'middle'; g.textAlign = 'center';
    g.font = 'bold 92px Arial, Helvetica, sans-serif'; g.fillText('bZ4X', 385, 254);
    g.font = 'bold 76px Arial, Helvetica, sans-serif'; g.fillText('AWD', 690, 254);
    g.fillStyle = '#d6d8da'; g.font = 'bold 84px Arial, Helvetica, sans-serif';
    'TOYOTA'.split('').forEach((c, i) => g.fillText(c, 55 + i * 102, 412));
  });
}
const flat = (s, [u, v]) => { s.uv.length = 0; for (let i = 0; i < s.p.length / 3; i++) s.uv.push(u, v); return s; };

export function buildBZ4X() {
  const body = buildBody({
    top: [[ZF, 0.55], [ZF + 0.006, 0.68, 0.03], [-2.31, 0.8, 0.04], [-2.22, 0.9, 0.06], [-2.0, 0.975, 0.1], [-1.25, 1.085, 0.08], [-0.22, 1.575, 0.25],
      [0.45, 1.638, 0.8], [1.95, 1.58, 0.1], [2.12, 1.553, 0.012], [2.131, 1.523, 0.012], [2.36, 1.14, 0.05], [2.445, 1.0, 0.05], [2.468, 0.76, 0.02], [ZR - 0.006, 0.7, 0.02], [ZR, 0.56]],
    bottom: [[ZF, 0.55], [ZF + 0.006, 0.42, 0.03], [-2.22, 0.29, 0.05], [-1.9, 0.21, 0.1], [1.95, 0.22, 0.1], [2.35, 0.34, 0.05], [ZR - 0.008, 0.44, 0.03], [ZR, 0.56]],
    w: [[ZF, 0.88], [-1.95, 0.92], [-1.425, 0.945], [0, 0.9475], [1.425, 0.946], [2.1, 0.925], [ZR, 0.89]],
    yWaist: 0.8, tuck: 0.07, ySill: 0.22,
    yBelt: [[-1.3, 1.05], [-0.5, 1.07], [1.0, 1.11], [2.1, 1.17], [ZR, 1.17]],
    sh: 0.028, ledge: 0.013, th: 0.42, thc: 0.28,
    rr: [[ZF, 0.05], [-1.25, 0.07], [-0.22, 0.11], [1.95, 0.1], [2.15, 0.08], [2.4, 0.07], [ZR, 0.05]],
    rs: 0.07,
    crown: [[ZF, 0.03], [-1.25, 0.035], [-0.22, 0.05], [1.95, 0.045], [2.15, 0.03], [ZR, 0.02]],
    bow: [[ZF, 0.24], [-1.95, 0.17], [-1.6, 0.1], [-1.25, 0.2], [-0.22, 0.11], [-0.06, 0], [1.25, 0], [1.95, 0.1], [2.14, 0.17], [ZR, 0.21]],
    bowN: [[ZF, 3.0], [-1.6, 2.5], [-1.25, 2.2], [1.25, 2.5], [1.95, 3], [ZR, 3.4]],
  });
  const raw = body.soup, pr = probe(raw);
  const AY = 0.37, AR = 0.455;
  const { soup: shell, liner } = cutArches(raw, [{ z: -HZ, y: AY, r: AR }, { z: HZ, y: AY, r: AR }], { halfWidth: 0.9475 });
  const dc = decals(shell);
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup(), chmsl = new Soup();
  const fr = { filter: (v) => v[2] > 1.75 }, ff = { filter: (v) => v[2] < -1.7 };

  // --- glazing: long side glass running into the D-pillar, black roof
  const dlo = rpoly([[-0.95, 1.105], [0.3, 1.125], [1.3, 1.155], [1.95, 1.2], [2.12, 1.29], [1.9, 1.41], [1.2, 1.485], [0.5, 1.51], [-0.08, 1.48]], 0.03, 3);
  pal.add(dc.side(grow(dlo, 0.012), { offset: 0.003 }).pal('gloss').sym());
  glass.add(dc.side(dlo, { offset: 0.005 }).sym());
  pal.add(dc.side([rect(0.22, 1.12, 0.29, 1.515), rect(1.28, 1.15, 1.345, 1.48)], { offset: 0.0065 }).pal('gloss').sym());
  const ws = rpoly([[-0.8, 1.11], [0.8, 1.11], [0.58, 1.53], [-0.58, 1.53]], 0.05);
  pal.add(dc.front(grow(ws, 0.014), { offset: 0.003 }).pal('gloss'));
  glass.add(dc.front(ws, { offset: 0.005 }));
  const rw = rpoly([[-0.68, 1.175], [0.68, 1.175], [0.57, 1.485], [-0.57, 1.485]], 0.05);
  pal.add(dc.rear(grow(rw, 0.014), { offset: 0.003, ...fr }).pal('gloss'));
  glass.add(dc.rear(rw, { offset: 0.007, ...fr }));
  pal.add(dc.top(rpoly([[-0.5, -0.12], [0.5, -0.12], [0.5, 1.2], [-0.5, 1.2]], 0.06), { offset: 0.004, minFacing: 0.5 }).pal('darkglass'));

  // --- black cladding: deep bumpers, sills, chunky squared-off arches
  pal.add(dc.rear(rect(-1, 0.3, 1, 0.69), { offset: 0.003, minFacing: -0.3, filter: (v) => v[2] > 2.1 && v[1] < 0.71 }).pal('plastic'));
  pal.add(dc.rear(rpoly([[-0.55, 0.35], [0.55, 0.35], [0.47, 0.45], [-0.47, 0.45]], 0.02), { offset: 0.005, minFacing: -0.3, filter: (v) => v[2] > 2.1 }).pal('darkalloy'));
  pal.add(dc.front(rect(-1, 0.26, 1, 0.56), { offset: 0.003, minFacing: -0.3, filter: (v) => v[2] < -1.95 && v[1] < 0.58 }).pal('plastic'));
  const archR = [[HZ - 0.56, 0.25], [HZ + 0.56, 0.25], [HZ + 0.56, 0.66], [HZ + 0.36, 0.91], [HZ - 0.36, 0.91], [HZ - 0.56, 0.66]];
  // front arch cladding sweeps forward into the lamp corner
  const archF = [[-HZ - 0.95, 0.25], [-HZ + 0.56, 0.25], [-HZ + 0.56, 0.66], [-HZ + 0.36, 0.91], [-HZ - 0.4, 0.91], [-HZ - 0.95, 0.8]];
  pal.add(dc.side([archF, archR, rect(-HZ + 0.3, 0.2, HZ - 0.3, 0.42), rect(HZ + 0.3, 0.3, 2.6, 0.69)], { offset: 0.003, minFacing: 0.12 }).pal('plastic').sym());
  pal.add(dc.rear([rect(0.6, 0.52, 0.84, 0.555, 0.008)], { offset: 0.005, minFacing: 0.05, ...fr }).pal('reflector').sym());

  // --- shut lines
  const lw = 0.008;
  pal.add(dc.side([
    ...stroke([[-0.86, 0.43], [-0.86, 1.09]], lw), ...stroke([[0.255, 0.43], [0.255, 1.12]], lw),
    ...stroke([[1.31, 1.16], [1.3, 1.05], [1.22, 0.96], [1.06, 0.925], [0.855, 0.665], [0.855, 0.43]], lw),
    ...stroke([[-0.86, 0.43], [0.855, 0.43]], lw),
  ], { offset: 0.0055 }).pal('line').sym());
  pal.add(dc.top(stroke([[0.76, -2.12], [0.83, -1.22]], lw), { offset: 0.0055, minFacing: 0.4 }).pal('line').sym());
  pal.add(dc.rear([...stroke([[0.7, 0.99], [0.72, 0.9], [0.72, 0.7]], lw), ...stroke([[-0.72, 0.7], [0.72, 0.7]], lw)], { offset: 0.0055, ...fr }).pal('line').sym());

  // --- full-width light bar with corner lamps dropping down the body edge
  const ty = dc.yaw(30), to = { minFacing: 0.02, origin: [0, 0, 2.31], ...fr };
  const lampPoly = [[0.5, 1.045], [0.81, 1.04], [0.855, 0.95], [0.9, 0.95], [0.93, 1.1], [0.5, 1.1]];
  tail.add(ty(lampPoly, { offset: 0.005, ...to }));
  tail.add(tail.mirrored());
  tail.add(flat(dc.rear(rect(-0.66, 1.074, 0.66, 1.1), { offset: 0.0045, ...fr }), BAR_UV));
  reverse.add(ty(rect(0.52, 1.04, 0.72, 1.06, 0.005), { offset: 0.0065, ...to }).sym());
  pal.add(dc.rear(rect(-0.62, 1.005, 0.62, 1.074, 0.008), { offset: 0.004, ...fr }).pal('gloss'));
  chmsl.add(dc.rear(rect(-0.3, 1.5, 0.3, 1.518, 0.005), { offset: 0.004, minFacing: 0.2, ...fr }));
  atlas.add(dc.rear(rect(-0.21, 1.02, 0.21, 1.058), { offset: 0.0065, ...fr }).uvRect(A_TOY));
  atlas.add(dc.rear(rect(-0.66, 0.8, -0.44, 0.867), { offset: 0.007, ...fr }).uvRect(A_BZ));
  atlas.add(dc.rear(rect(0.5, 0.805, 0.66, 0.862), { offset: 0.007, ...fr }).uvRect(A_AWD));
  const pl = plate([0, 0.87, pr.rearZ(0, 0.87) + 0.008], A_PLATE, { tilt: 0.05 });
  atlas.add(pl.face); pal.add(pl.back);
  pal.add(rearWiper(pr, 0.0, 1.47, 0.34, 1.43));

  // --- front: closed "hammerhead" nose, slim C-shaped lamps, black lower intake
  pal.add(dc.front(rect(-0.6, 0.86, 0.6, 0.885, 0.01), { offset: 0.004, ...ff }).pal('gloss'));
  pal.add(dc.front(rect(-0.5, 0.33, 0.5, 0.47, 0.03), { offset: 0.0045, minFacing: -0.3, ...ff }).pal('line'));
  atlas.add(dc.front(rect(-0.07, 0.905, 0.07, 0.975), { offset: 0.007, minFacing: 0.05, ...ff }).uvRect(A_LOGO));
  const hy = frontYaw(30, -2.2);
  head.add(dc.any(hy)(rpoly([[-0.93, 0.85], [-0.45, 0.83], [-0.45, 0.9], [-0.91, 0.94]], 0.012), { offset: 0.005, minFacing: 0.03, box: [-0.45, 0.83, -0.93, 0.94], ...ff }));
  head.add(head.mirrored());
  const fp = plate([0, 0.64, pr.frontZ(0, 0.64) - 0.01], A_PLATE, { front: true, tilt: 0.06 });
  atlas.add(fp.face); pal.add(fp.back);

  // --- mirrors, handles, roof rails, antenna
  const mx = pr.sideX(-0.88, 1.13);
  pal.add(blob(0.24, 0.13, 0.1, { p: [mx + 0.1, 1.16, -0.88] }, 'gloss', 3.5).sym());
  pal.add(box(0.07, 0.03, 0.06, { p: [mx + 0.01, 1.115, -0.88] }, 'gloss').sym());
  for (const z of [0.11, 1.14]) paint.add(blob(0.026, 0.032, 0.17, { p: [pr.sideX(z, 1.02) + 0.005, 1.02, z] }, null, 5, 8).sym());
  pal.add(roofRail(pr, 0.58, -0.1, 1.95, 0.055, 'plastic', 0.015).sym());
  pal.add(blob(0.05, 0.07, 0.17, { p: [0, pr.topY(0, 1.8) + 0.022, 1.8] }, 'gloss', 2.5, 8));

  const wheel = { soup: buildWheel({ R: DIMS.wheelRadius, width: 0.235, rimR: 0.256, style: 'aero' }) };
  const car = assembleCar({ id: 'bz4x', dims: DIMS, parts: { paint, glass, pal, tail, chmsl, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel });
  return tintPaint(car, 'bz4x', 0xeceeef, { metalness: 0.0, roughness: 0.38, clearcoatRoughness: 0.06 });
}
