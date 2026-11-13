// 2023 Skoda Enyaq 80x - electric SUV with slim C-shaped LED tail lamps.
import { Soup, buildBody, cutArches, decals, probe, rpoly, rect, stroke, grow, box, blob, buildWheel, canvasTex, drawPlate, plate, assembleCar, arcPts, frontYaw, rearWiper } from './kit.js';

const DIMS = { length: 4.649, width: 1.879, height: 1.616, wheelbase: 2.765, track: 1.59, wheelRadius: 0.37 };
const ZF = -2.2625, ZR = 2.384, HZ = DIMS.wheelbase / 2;

function lampTextures() {
  const tail = (glow) => (g, w, h) => {
    // u: 0 = inboard, 1 = outboard. Dark red lens with a bright "C" (closed outboard, open to the centre).
    g.fillStyle = glow ? '#1a0000' : '#5a060a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = glow ? '#ffffff' : '#ff2a2a'; g.lineWidth = h * 0.17; g.lineJoin = 'miter'; g.lineCap = 'butt';
    for (const [x0, x1] of [[0.03, 0.44], [0.5, 0.93]]) {
      g.beginPath(); g.moveTo(x0 * w, h * 0.2); g.lineTo(x1 * w, h * 0.2); g.lineTo(x1 * w - h * 0.1, h * 0.8); g.lineTo(x0 * w, h * 0.8); g.stroke();
    }
    if (!glow) { g.strokeStyle = '#120000'; g.lineWidth = 4; g.strokeRect(0, 0, w, h); }
  };
  const head = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#15181c'; g.fillRect(0, 0, w, h);
    g.fillStyle = glow ? '#fff' : '#e6eef4';
    g.fillRect(w * 0.04, h * 0.12, w * 0.9, h * 0.2);
    for (let i = 0; i < 4; i++) g.fillRect(w * (0.3 + i * 0.16), h * 0.45, w * 0.11, h * 0.38);
  };
  return { tailMap: canvasTex(512, 64, tail(false)), tailGlow: canvasTex(512, 64, tail(true)), headMap: canvasTex(256, 64, head(false)), headGlow: canvasTex(256, 64, head(true)) };
}
const AW = 1024, AH = 512;
const uvr = (x, y, w, h) => [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
const A_PLATE = uvr(0, 0, 832, 181), A_SKODA = uvr(0, 200, 1000, 110), A_ENYAQ = uvr(0, 330, 330, 80), A_80X = uvr(360, 330, 200, 80), A_LOGO = uvr(600, 320, 120, 120);
function atlasTex() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    drawPlate(g, 0, 0, 832, 181, '023 ENQ');
    g.fillStyle = '#dfe1e3'; g.textBaseline = 'middle'; g.textAlign = 'center';
    g.font = '900 108px Arial Black, Arial, Helvetica, sans-serif';
    const L = ['Š', 'K', 'O', 'D', 'A'];
    L.forEach((c, i) => g.fillText(c, 100 + i * 200, 258));
    g.font = 'bold 62px Arial, Helvetica, sans-serif';
    g.fillText('ENYAQ', 165, 372); g.fillText('80x', 460, 372);
    g.strokeStyle = '#dfe1e3'; g.lineWidth = 9; g.beginPath(); g.arc(660, 380, 50, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(632, 398); g.lineTo(690, 362); g.lineTo(676, 398); g.closePath(); g.fill();
  });
}

export function buildEnyaq() {
  const body = buildBody({
    top: [[ZF, 0.52], [ZF + 0.006, 0.66, 0.03], [-2.235, 0.8, 0.04], [-2.15, 0.95, 0.06], [-2.0, 1.0, 0.1], [-1.12, 1.1, 0.08], [-0.15, 1.565, 0.25],
      [0.4, 1.616, 0.8], [1.85, 1.515, 0.1], [1.99, 1.488, 0.012], [2.001, 1.458, 0.012], [2.275, 1.12, 0.05], [2.345, 0.98, 0.04], [2.362, 0.74, 0.02], [ZR - 0.006, 0.69, 0.02], [ZR, 0.55]],
    bottom: [[ZF, 0.52], [ZF + 0.006, 0.4, 0.03], [-2.15, 0.26, 0.05], [-1.85, 0.21, 0.1], [1.85, 0.22, 0.1], [2.25, 0.32, 0.05], [ZR - 0.008, 0.42, 0.03], [ZR, 0.55]],
    w: [[ZF, 0.88], [-1.9, 0.915], [-1.38, 0.937], [0, 0.9395], [1.38, 0.937], [2.0, 0.92], [ZR, 0.89]],
    yWaist: 0.78, tuck: 0.07, ySill: 0.22,
    yBelt: [[-1.2, 1.02], [-0.5, 1.04], [1.0, 1.08], [2.0, 1.13], [ZR, 1.13]],
    sh: 0.025, ledge: 0.012, th: 0.42, thc: 0.25,
    rr: [[ZF, 0.06], [-1.12, 0.07], [-0.15, 0.11], [1.85, 0.11], [2.05, 0.08], [ZR, 0.06]],
    rs: 0.07,
    crown: [[ZF, 0.03], [-1.12, 0.035], [-0.15, 0.05], [1.85, 0.045], [2.05, 0.03], [ZR, 0.02]],
    bow: [[ZF, 0.26], [-1.9, 0.18], [-1.5, 0.11], [-1.12, 0.18], [-0.15, 0.11], [-0.02, 0], [1.1, 0], [1.85, 0.11], [2.0, 0.19], [ZR, 0.22]],
    bowN: [[ZF, 2.8], [-1.5, 2.5], [-1.12, 2.2], [1.1, 2.5], [1.85, 3], [ZR, 3.2]],
  });
  const raw = body.soup, pr = probe(raw);
  const AY = 0.37, AR = 0.45;
  const { soup: shell, liner } = cutArches(raw, [{ z: -HZ, y: AY, r: AR }, { z: HZ, y: AY, r: AR }], { halfWidth: 0.9395 });
  const dc = decals(shell);
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup(), chmsl = new Soup();
  const fr = { filter: (v) => v[2] > 1.6 }, ff = { filter: (v) => v[2] < -1.7 };

  // --- glazing
  const dlo = rpoly([[-0.86, 1.065], [0.3, 1.085], [1.2, 1.115], [1.72, 1.16], [1.9, 1.25], [1.6, 1.36], [1.1, 1.445], [0.5, 1.475], [-0.03, 1.455]], 0.03, 3);
  pal.add(dc.side(grow(dlo, 0.012), { offset: 0.003 }).pal('chrome').sym());
  glass.add(dc.side(dlo, { offset: 0.005 }).sym());
  pal.add(dc.side([rect(0.2, 1.08, 0.27, 1.48), rect(1.13, 1.11, 1.195, 1.44)], { offset: 0.0065 }).pal('gloss').sym());
  const ws = rpoly([[-0.8, 1.125], [0.8, 1.125], [0.58, 1.52], [-0.58, 1.52]], 0.05);
  pal.add(dc.front(grow(ws, 0.014), { offset: 0.003 }).pal('gloss'));
  glass.add(dc.front(ws, { offset: 0.005 }));
  const rw = rpoly([[-0.68, 1.14], [0.68, 1.14], [0.56, 1.44], [-0.56, 1.44]], 0.05);
  pal.add(dc.rear(grow(rw, 0.014), { offset: 0.003, ...fr }).pal('gloss'));
  glass.add(dc.rear(rw, { offset: 0.007, ...fr }));
  // black panoramic roof panel
  pal.add(dc.top(rpoly([[-0.5, -0.1], [0.5, -0.1], [0.5, 1.75], [-0.5, 1.75]], 0.06), { offset: 0.004, minFacing: 0.5 }).pal('darkglass'));

  // --- black lower cladding: bumpers, sills, arch trims
  pal.add(dc.rear(rect(-1, 0.3, 1, 0.6), { offset: 0.003, minFacing: -0.3, filter: (v) => v[2] > 2.0 && v[1] < 0.62 }).pal('plastic'));
  pal.add(dc.rear(rect(-0.55, 0.36, 0.55, 0.43, 0.02), { offset: 0.005, minFacing: -0.3, filter: (v) => v[2] > 2.0 }).pal('darkalloy'));
  pal.add(dc.front(rect(-1, 0.26, 1, 0.5), { offset: 0.003, minFacing: -0.3, filter: (v) => v[2] < -1.9 && v[1] < 0.52 }).pal('plastic'));
  const flare = (z) => stroke(arcPts(z, AY, AR + 0.022, -8, 188, 16), 0.05);
  pal.add(dc.side([...flare(-HZ), ...flare(HZ), rect(-HZ + 0.3, 0.2, HZ - 0.3, 0.37), rect(HZ + 0.3, 0.3, 2.5, 0.6), rect(-2.5, 0.26, -HZ - 0.3, 0.5)], { offset: 0.003, minFacing: 0.25 }).pal('plastic').sym());
  pal.add(dc.rear([rect(0.52, 0.5, 0.8, 0.535, 0.008)], { offset: 0.005, minFacing: 0.05, ...fr }).pal('reflector').sym());

  // --- shut lines
  const lw = 0.008;
  pal.add(dc.side([
    ...stroke([[-0.9, 0.39], [-0.9, 1.05]], lw), ...stroke([[0.235, 0.39], [0.235, 1.09]], lw),
    ...stroke([[1.2, 1.12], [1.18, 0.98], [1.08, 0.88], [0.94, 0.83], [0.9, 0.6], [0.9, 0.39]], lw),
    ...stroke([[-0.9, 0.39], [0.9, 0.39]], lw),
  ], { offset: 0.0055 }).pal('line').sym());
  pal.add(dc.top(stroke([[0.76, -2.05], [0.82, -1.1]], lw), { offset: 0.0055, minFacing: 0.4 }).pal('line').sym());
  pal.add(dc.rear([...stroke([[0.7, 0.98], [0.72, 0.9], [0.72, 0.66]], lw), ...stroke([[-0.72, 0.66], [0.72, 0.66]], lw)], { offset: 0.0055, ...fr }).pal('line').sym());

  // --- slim C-shaped tail lamps, lettering, plate
  const ty = dc.yaw(30);
  const lampPoly = rpoly([[0.33, 1.025], [0.6, 1.008], [0.93, 0.975], [0.94, 1.105], [0.6, 1.098], [0.33, 1.088]], 0.012, 3);
  tail.add(ty(lampPoly, { offset: 0.005, minFacing: 0.02, origin: [0, 0, 2.2], ...fr }));
  tail.add(tail.mirrored());
  reverse.add(ty(rect(0.335, 1.035, 0.4, 1.08, 0.008), { offset: 0.0065, minFacing: 0.02, origin: [0, 0, 2.2], ...fr }).sym());
  chmsl.add(dc.rear(rect(-0.3, 1.463, 0.3, 1.483, 0.005), { offset: 0.004, minFacing: 0.3, ...fr }));
  atlas.add(dc.rear(rect(-0.34, 1.02, 0.34, 1.092), { offset: 0.007, ...fr }).uvRect(A_SKODA));
  atlas.add(dc.rear(rect(-0.66, 0.875, -0.46, 0.925), { offset: 0.007, ...fr }).uvRect(A_ENYAQ));
  atlas.add(dc.rear(rect(0.5, 0.875, 0.62, 0.925), { offset: 0.007, ...fr }).uvRect(A_80X));
  const pl = plate([0, 0.82, pr.rearZ(0, 0.82) + 0.008], A_PLATE, { tilt: 0.05 });
  atlas.add(pl.face); pal.add(pl.back);
  pal.add(rearWiper(pr, 0.0, 1.415, 0.3, 1.38));

  // --- front: black grille panel, slim headlamps
  const gp = rpoly([[-0.36, 0.7], [0.36, 0.7], [0.46, 0.8], [0.42, 0.915], [-0.42, 0.915], [-0.46, 0.8]], 0.03);
  pal.add(dc.front(gp, { offset: 0.004, ...ff }).pal('gloss'));
  const ribs = []; for (let i = -9; i <= 9; i++) ribs.push(rect(i * 0.042 - 0.004, 0.72, i * 0.042 + 0.004, 0.895));
  pal.add(dc.front(ribs, { offset: 0.0055, ...ff }).pal('darkalloy'));
  pal.add(dc.front(rect(-0.55, 0.4, 0.55, 0.56, 0.04), { offset: 0.0045, ...ff }).pal('line'));
  atlas.add(dc.front(rect(-0.05, 0.935, 0.05, 1.0), { offset: 0.007, minFacing: 0.05, ...ff }).uvRect(A_LOGO));
  const hy = frontYaw(30, -2.15);
  head.add(dc.any(hy)(rpoly([[-0.9, 0.91], [-0.45, 0.87], [-0.45, 0.94], [-0.9, 0.99]], 0.012), { offset: 0.005, minFacing: 0.03, box: [-0.45, 0.87, -0.9, 0.99], ...ff }));
  head.add(head.mirrored());
  const fp = plate([0, 0.62, pr.frontZ(0, 0.62) - 0.008], A_PLATE, { front: true, tilt: 0.08 });
  atlas.add(fp.face); pal.add(fp.back);

  // --- mirrors, handles, underbody
  const mx = pr.sideX(-0.8, 1.1);
  paint.add(blob(0.24, 0.13, 0.1, { p: [mx + 0.1, 1.13, -0.8] }, null, 3.5).sym());
  pal.add(box(0.07, 0.03, 0.06, { p: [mx + 0.01, 1.085, -0.8] }, 'gloss').sym());
  for (const z of [0.1, 1.03]) paint.add(blob(0.026, 0.032, 0.17, { p: [pr.sideX(z, 0.99) + 0.005, 0.99, z] }, null, 5, 8).sym());

  const wheel = { soup: buildWheel({ R: DIMS.wheelRadius, width: 0.235, rimR: 0.256, style: 'aero' }) };
  return assembleCar({ id: 'enyaq', dims: DIMS, parts: { paint, glass, pal, tail, chmsl, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel });
}
