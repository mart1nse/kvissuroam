// 2007 Honda CR-V (3rd generation, RE) - compact SUV with the arched side-window line.
import { Soup, buildBody, cutArches, decals, probe, rpoly, rect, stroke, grow, box, blob, cyl, buildWheel, canvasTex, drawPlate, plate, assembleCar, arcPts, frontYaw, rearWiper } from './kit.js';

const DIMS = { length: 4.53, width: 1.82, height: 1.675, wheelbase: 2.62, track: 1.565, wheelRadius: 0.36 };
const ZF = -2.215, ZR = 2.315, HZ = DIMS.wheelbase / 2;

function lampTextures() {
  const tail = (glow) => (g, w, h) => {
    // u: 0 = inboard (glass side), 1 = outboard; v: canvas top = lamp top
    g.fillStyle = glow ? '#fff' : '#a80c10'; g.fillRect(0, 0, w, h);
    if (!glow) {
      const gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(0.4, 'rgba(255,120,120,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
    // clear band with indicator / reverse lenses
    g.fillStyle = glow ? '#000' : '#c9c4c0'; g.fillRect(0, h * 0.56, w, h * 0.2);
    if (!glow) {
      g.fillStyle = '#e8e4de'; g.beginPath(); g.arc(w * 0.5, h * 0.66, w * 0.2, 0, 7); g.fill();
      g.strokeStyle = '#7a7672'; g.lineWidth = 3; g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
      for (let y = 8; y < h; y += 10) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.strokeStyle = '#150000'; g.lineWidth = 5; g.strokeRect(0, 0, w, h);
    }
  };
  const head = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#30343a'; g.fillRect(0, 0, w, h);
    const gr = g.createRadialGradient(w * 0.4, h * 0.5, 2, w * 0.4, h * 0.5, w * 0.45);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, glow ? '#aaa' : '#c8d0d6'); gr.addColorStop(1, glow ? '#000' : '#6c747c');
    g.fillStyle = gr; g.fillRect(4, 4, w * 0.8, h - 8);
    if (!glow) { g.fillStyle = '#d87a18'; g.fillRect(w * 0.82, 6, w * 0.16, h - 12); }
  };
  return { tailMap: canvasTex(64, 256, tail(false)), tailGlow: canvasTex(64, 256, tail(true)), headMap: canvasTex(256, 96, head(false)), headGlow: canvasTex(256, 96, head(true)) };
}
const AW = 1024, AH = 512;
const uvr = (x, y, w, h) => [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
const A_PLATE = uvr(0, 0, 832, 181), A_H = uvr(0, 200, 160, 140), A_CRV = uvr(200, 200, 360, 110);
function atlasTex() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    drawPlate(g, 0, 0, 832, 181, '207 CRV');
    // Honda "H" in a rounded frame
    g.strokeStyle = '#d9dbdd'; g.fillStyle = '#d9dbdd'; g.lineWidth = 12;
    g.beginPath(); g.roundRect(10, 210, 140, 120, 34); g.stroke();
    g.fillRect(46, 232, 16, 76); g.fillRect(98, 232, 16, 76); g.fillRect(46, 262, 68, 15);
    g.textBaseline = 'middle'; g.textAlign = 'center'; g.font = 'italic bold 96px Arial, Helvetica, sans-serif';
    g.fillText('CR-V', 380, 258);
  });
}

export function buildCRV() {
  const body = buildBody({
    top: [[ZF, 0.52], [ZF + 0.006, 0.62, 0.03], [-2.19, 0.72, 0.03], [-2.13, 0.94, 0.05], [-2.0, 1.0, 0.08], [-1.05, 1.13, 0.08], [-0.18, 1.6, 0.22],
      [0.4, 1.675, 0.8], [1.93, 1.6, 0.1], [2.06, 1.572, 0.012], [2.071, 1.538, 0.012], [2.24, 1.09, 0.06], [2.28, 0.93, 0.05], [2.292, 0.72, 0.02], [ZR - 0.005, 0.66, 0.02], [ZR, 0.52]],
    bottom: [[ZF, 0.52], [ZF + 0.006, 0.42, 0.03], [-2.12, 0.3, 0.05], [-1.8, 0.26, 0.1], [1.8, 0.27, 0.1], [2.2, 0.34, 0.05], [ZR - 0.008, 0.42, 0.03], [ZR, 0.52]],
    w: [[ZF, 0.86], [-1.9, 0.89], [-1.31, 0.908], [0, 0.91], [1.31, 0.908], [1.95, 0.895], [ZR, 0.87]],
    yWaist: 0.75, tuck: 0.06, ySill: 0.26,
    yBelt: [[-1.2, 1.04], [-0.5, 1.06], [1.0, 1.1], [2.0, 1.15], [ZR, 1.15]],
    sh: 0.02, ledge: 0.012, th: 0.38, thc: 0.25,
    rr: [[ZF, 0.05], [-1.05, 0.06], [-0.18, 0.1], [1.9, 0.1], [2.1, 0.08], [2.25, 0.07], [ZR, 0.05]],
    rs: 0.06,
    crown: [[ZF, 0.03], [-1.05, 0.035], [-0.18, 0.05], [1.9, 0.045], [2.1, 0.03], [ZR, 0.02]],
    bow: [[ZF, 0.22], [-1.9, 0.16], [-1.5, 0.1], [-1.05, 0.16], [-0.18, 0.1], [-0.02, 0], [1.2, 0], [1.9, 0.1], [2.08, 0.17], [ZR, 0.19]],
    bowN: [[ZF, 2.8], [-1.5, 2.5], [-1.05, 2.2], [1.2, 2.5], [1.9, 3], [ZR, 3.2]],
  });
  const raw = body.soup, pr = probe(raw);
  const AY = 0.36, AR = 0.435;
  const { soup: shell, liner } = cutArches(raw, [{ z: -HZ, y: AY, r: AR }, { z: HZ, y: AY, r: AR }], { halfWidth: 0.91 });
  const dc = decals(shell);
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup(), chmsl = new Soup();
  const fr = { filter: (v) => v[2] > 1.7 }, ff = { filter: (v) => v[2] < -1.7 };

  // --- glazing: arched DLO
  const dlo = rpoly([[-0.8, 1.085], [0.2, 1.1], [0.95, 1.125], [1.4, 1.16], [1.8, 1.33], [1.55, 1.41], [1.2, 1.475], [0.8, 1.51], [0.4, 1.52], [-0.04, 1.495]], 0.03, 3);
  pal.add(dc.side(grow(dlo, 0.013), { offset: 0.003 }).pal('chrome').sym());
  glass.add(dc.side(dlo, { offset: 0.005 }).sym());
  pal.add(dc.side([rect(0.165, 1.09, 0.235, 1.525), rect(1.03, 1.12, 1.095, 1.495)], { offset: 0.0065 }).pal('gloss').sym());
  const ws = rpoly([[-0.78, 1.152], [0.78, 1.152], [0.57, 1.56], [-0.57, 1.56]], 0.05);
  pal.add(dc.front(grow(ws, 0.014), { offset: 0.003 }).pal('plastic'));
  glass.add(dc.front(ws, { offset: 0.005 }));
  const rw = rpoly([[-0.62, 1.125], [0.62, 1.125], [0.535, 1.515], [-0.535, 1.515]], 0.05);
  pal.add(dc.rear(grow(rw, 0.014), { offset: 0.003, ...fr }).pal('plastic'));
  glass.add(dc.rear(rw, { offset: 0.007, ...fr }));

  // --- grey lower cladding: bumpers, sills, arch flares
  pal.add(dc.rear(rect(-1, 0.3, 1, 0.6), { offset: 0.003, minFacing: -0.3, filter: (v) => v[2] > 2.0 && v[1] < 0.62 }).pal('clad'));
  pal.add(dc.front(rect(-1, 0.28, 1, 0.5), { offset: 0.003, minFacing: -0.3, filter: (v) => v[2] < -1.9 && v[1] < 0.52 }).pal('clad'));
  const flare = (z) => stroke(arcPts(z, AY, AR + 0.028, -8, 188, 16), 0.062);
  pal.add(dc.side([...flare(-HZ), ...flare(HZ), rect(-HZ + 0.3, 0.26, HZ - 0.3, 0.41), rect(HZ + 0.3, 0.3, 2.4, 0.6), rect(-2.4, 0.3, -HZ - 0.3, 0.5)], { offset: 0.003, minFacing: 0.25 }).pal('clad').sym());
  pal.add(dc.rear([rect(0.5, 0.47, 0.76, 0.515, 0.01)], { offset: 0.005, ...fr }).pal('reflector').sym());

  // --- shut lines
  const lw = 0.008;
  pal.add(dc.side([
    ...stroke([[-0.86, 0.42], [-0.86, 1.07]], lw), ...stroke([[0.2, 0.42], [0.2, 1.1]], lw),
    ...stroke([[1.07, 1.13], [1.06, 0.98], [0.98, 0.86], [0.86, 0.8], [0.83, 0.6], [0.83, 0.42]], lw),
    ...stroke([[-0.86, 0.42], [0.83, 0.42]], lw),
  ], { offset: 0.0055 }).pal('line').sym());
  pal.add(dc.top(stroke([[0.74, -2.05], [0.8, -1.02]], lw), { offset: 0.0055, minFacing: 0.4 }).pal('line').sym());
  pal.add(dc.rear([...stroke([[0.6, 1.02], [0.66, 0.95], [0.66, 0.64]], lw), ...stroke([[-0.66, 0.64], [0.66, 0.64]], lw)], { offset: 0.0055, ...fr }).pal('line').sym());

  // --- tall tail lamps on the D-pillars
  const ty = dc.yaw(40);
  const lampPoly = rpoly([[0.43, 1.0], [0.76, 1.0], [0.79, 1.18], [0.69, 1.555], [0.44, 1.555]], 0.025);
  tail.add(ty(lampPoly, { offset: 0.005, minFacing: 0.02, origin: [0, 0, 2.1], ...fr }));
  tail.add(tail.mirrored());
  reverse.add(ty(rect(0.52, 1.15, 0.7, 1.225, 0.02), { offset: 0.0065, minFacing: 0.02, origin: [0, 0, 2.1], ...fr }).sym());
  chmsl.add(dc.rear(rect(-0.22, 1.544, 0.22, 1.565, 0.006), { offset: 0.004, minFacing: 0.3, ...fr }));

  // --- tailgate: garnish, badges, plate, wiper, exhaust
  pal.add(dc.rear(rect(-0.36, 0.972, 0.36, 1.0, 0.01), { offset: 0.006, ...fr }).pal('chrome'));
  atlas.add(dc.rear(rect(-0.062, 1.022, 0.062, 1.092), { offset: 0.007, ...fr }).uvRect(A_H));
  atlas.add(dc.rear(rect(0.36, 0.74, 0.6, 0.8), { offset: 0.007, ...fr }).uvRect(A_CRV));
  const pl = plate([0, 0.875, pr.rearZ(0, 0.875) + 0.008], A_PLATE, { tilt: 0.05 });
  atlas.add(pl.face); pal.add(pl.back);
  pal.add(rearWiper(pr, 0.0, 1.1, 0.36, 1.15));
  pal.add(cyl(0.032, 0.032, 0.18, 14, { p: [0.52, 0.31, 2.2], r: [Math.PI / 2, 0, 0] }, 'chrome', true));
  pal.add(cyl(0.027, 0.027, 0.17, 12, { p: [0.52, 0.31, 2.19], r: [Math.PI / 2, 0, 0] }, 'well'));

  // --- front
  pal.add(dc.front(rect(-0.43, 0.8, 0.43, 0.905, 0.03), { offset: 0.004, ...ff }).pal('gloss'));
  pal.add(dc.front([rect(-0.4, 0.846, 0.4, 0.862)], { offset: 0.006, ...ff }).pal('chrome'));
  pal.add(dc.front(rect(-0.5, 0.56, 0.5, 0.72, 0.04), { offset: 0.004, ...ff }).pal('line'));
  atlas.add(dc.front(rect(-0.06, 0.915, 0.06, 0.985), { offset: 0.007, ...ff }).uvRect(A_H));
  const hy = frontYaw(32, -2.1);
  head.add(dc.any(hy)(rpoly([[-0.88, 0.9], [-0.42, 0.85], [-0.42, 0.95], [-0.86, 1.02]], 0.02), { offset: 0.005, minFacing: 0.03, box: [-0.42, 0.85, -0.88, 1.02], ...ff }));
  head.add(head.mirrored());
  const fp = plate([0, 0.64, pr.frontZ(0, 0.64) - 0.008], A_PLATE, { front: true, tilt: 0.1 });
  atlas.add(fp.face); pal.add(fp.back);

  // --- mirrors, handles, roof rails, underbody
  const mx = pr.sideX(-0.74, 1.13);
  paint.add(blob(0.24, 0.15, 0.1, { p: [mx + 0.1, 1.15, -0.74] }, null, 3.5).sym());
  pal.add(box(0.07, 0.03, 0.06, { p: [mx + 0.01, 1.11, -0.74] }, 'plastic').sym());
  for (const z of [0.06, 0.93]) paint.add(blob(0.028, 0.035, 0.16, { p: [pr.sideX(z, 1.02) + 0.006, 1.02, z] }, null, 5, 8).sym());

  const wheel = { soup: buildWheel({ R: DIMS.wheelRadius, width: 0.225, rimR: 0.218, style: 'spoke5' }) };
  return assembleCar({ id: 'crv', dims: DIMS, parts: { paint, glass, pal, tail, chmsl, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel });
}
