// 1987 Mercedes-Benz 190E 2.6 (W201) - boxy three-box saloon.
import * as THREE from 'three';
import { Soup, buildBody, cutArches, decals, probe, rpoly, rect, stroke, grow, box, blob, cyl, fromGeo, buildWheel, canvasTex, drawPlate, plate, assembleCar } from './kit.js';

const DIMS = { length: 4.42, width: 1.678, height: 1.39, wheelbase: 2.665, track: 1.44, wheelRadius: 0.31 };
const ZF = -2.1325, ZR = 2.2875, HZ = DIMS.wheelbase / 2;

function lampTextures() {
  const draw = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#300'; g.fillRect(0, 0, w, h);
    // u: 0 = inboard, 1 = outboard
    const seg = glow
      ? [[0, 0.6, '#ffffff']]
      : [[0, 0.6, '#b40d10'], [0.6, 1, '#d86a08']];
    for (const [a, b, c] of seg) { g.fillStyle = c; g.fillRect(a * w, 0, (b - a) * w, h); }
    // horizontal ribs
    const ribs = 6;
    for (let i = 0; i < ribs; i++) {
      const y0 = i * h / ribs, gr = g.createLinearGradient(0, y0, 0, y0 + h / ribs);
      gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(0.45, 'rgba(0,0,0,0)'); gr.addColorStop(0.8, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0.85)');
      g.fillStyle = gr; g.fillRect(0, y0, w, h / ribs);
    }
    g.strokeStyle = glow ? '#000' : '#111'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
    g.fillStyle = glow ? '#000' : '#111'; g.fillRect(0.6 * w - 2, 0, 4, h);
  };
  const head = (glow) => (g, w, h) => {
    // u: 0 = inboard, 1 = outboard (indicator)
    g.fillStyle = glow ? '#000' : '#222'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, glow ? '#fff' : '#eef2f4'); gr.addColorStop(1, glow ? '#ddd' : '#9aa2a8');
    g.fillStyle = gr; g.fillRect(4, 4, 0.74 * w - 6, h - 8);
    if (!glow) {
      g.strokeStyle = 'rgba(40,50,60,0.35)'; g.lineWidth = 2;
      for (let x = 10; x < 0.74 * w; x += 9) { g.beginPath(); g.moveTo(x, 4); g.lineTo(x, h - 4); g.stroke(); }
      g.fillStyle = '#e07a10'; g.fillRect(0.75 * w, 4, 0.25 * w - 4, h - 8);
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      for (let y = 12; y < h; y += 10) { g.beginPath(); g.moveTo(0.75 * w, y); g.lineTo(w, y); g.stroke(); }
    }
  };
  return { tailMap: canvasTex(256, 128, draw(false)), tailGlow: canvasTex(256, 128, draw(true)), headMap: canvasTex(256, 128, head(false)), headGlow: canvasTex(256, 128, head(true)) };
}

const AW = 1024, AH = 512;
const uvr = (x, y, w, h) => [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
const A_PLATE = uvr(0, 0, 832, 181), A_190 = uvr(0, 200, 400, 110), A_26 = uvr(420, 200, 240, 110);
function atlasTex() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    drawPlate(g, 0, 0, 832, 181, '190 EEE');
    g.fillStyle = '#d8dadc'; g.textBaseline = 'middle'; g.textAlign = 'center';
    g.font = 'bold 100px Arial, Helvetica, sans-serif';
    g.fillText('190 E', 200, 258); g.fillText('2.6', 540, 258);
  });
}

export function buildW201() {
  const body = buildBody({
    top: [[ZF, 0.46], [ZF + 0.005, 0.572, 0.02], [-2.075, 0.585, 0.008], [-2.062, 0.62, 0.01], [-2.04, 0.868, 0.025], [-1.98, 0.9, 0.05],
      [-0.93, 0.985, 0.06], [-0.3, 1.365, 0.14], [0.25, 1.39, 0.5], [0.95, 1.36, 0.14], [1.5, 0.995, 0.07], [2.185, 0.975, 0.03],
      [2.212, 0.955, 0.014], [2.23, 0.6, 0.01], [2.268, 0.59, 0.012], [ZR - 0.004, 0.565, 0.02], [ZR, 0.46]],
    bottom: [[ZF, 0.46], [ZF + 0.005, 0.37, 0.03], [-2.07, 0.24, 0.04], [-1.8, 0.2, 0.1], [1.75, 0.2, 0.1], [2.18, 0.3, 0.05], [ZR - 0.006, 0.37, 0.03], [ZR, 0.46]],
    w: [[ZF, 0.8], [-1.9, 0.817], [-1.33, 0.835], [-0.5, 0.839], [0.8, 0.839], [1.33, 0.835], [2.0, 0.815], [ZR, 0.795]],
    yWaist: 0.63, tuck: 0.05, ySill: 0.2, yBelt: 0.935, sh: 0.018, ledge: 0.014, ledgeH: 0.025,
    th: 0.4, thc: 0.08,
    rr: [[ZF, 0.03], [-1.0, 0.04], [-0.3, 0.07], [0.95, 0.07], [1.5, 0.04], [ZR, 0.03]],
    rs: 0.05,
    crown: [[ZF, 0.02], [-1.0, 0.03], [-0.3, 0.04], [0.9, 0.04], [1.5, 0.02], [ZR, 0.012]],
    bow: [[ZF, 0.11], [-1.95, 0.09], [-1.6, 0.03], [-0.93, 0.08], [-0.3, 0.06], [-0.05, 0], [0.5, 0], [0.95, 0.05], [1.5, 0.06], [1.95, 0.03], [2.2, 0.09], [ZR, 0.1]],
    bowN: [[ZF, 3.5], [-1.6, 3], [-0.93, 2.2], [1.5, 2.2], [2.0, 3], [ZR, 3.5]],
  });
  const raw = body.soup, pr = probe(raw);
  const { soup: shell, liner } = cutArches(raw, [{ z: -HZ, y: 0.31, r: 0.375 }, { z: HZ, y: 0.31, r: 0.375 }], { halfWidth: 0.839 });
  const dc = decals(shell);
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup();

  // --- glazing
  const dlo = rpoly([[-0.73, 0.962], [1.03, 0.965], [0.8, 1.272], [-0.17, 1.272]], 0.035);
  pal.add(dc.side(grow(dlo, 0.014), { offset: 0.003 }).pal('chrome').sym());
  pal.add(dc.side(dlo, { offset: 0.0045 }).pal('plastic').sym());
  const g1 = rpoly([[-0.7, 0.977], [0.105, 0.977], [0.105, 1.257], [-0.185, 1.257]], 0.025);
  const g2 = rpoly([[0.185, 0.977], [0.985, 0.98], [0.78, 1.257], [0.185, 1.257]], 0.025);
  glass.add(dc.side([g1, g2], { offset: 0.006 }).sym());
  const ws = rpoly([[-0.715, 0.99], [0.715, 0.99], [0.585, 1.318], [-0.585, 1.318]], 0.04);
  pal.add(dc.front(grow(ws, 0.012), { offset: 0.003 }).pal('chrome'));
  glass.add(dc.front(ws, { offset: 0.006 }));
  const rw = rpoly([[-0.7, 1.012], [0.7, 1.012], [0.575, 1.318], [-0.575, 1.318]], 0.04);
  pal.add(dc.rear(grow(rw, 0.012), { offset: 0.003 }).pal('chrome'));
  glass.add(dc.rear(rw, { offset: 0.006 }));

  // --- bumpers, rub strips (grey plastic) and chrome strips
  const bumpR = rect(-0.9, 0.34, 0.9, 0.592), bumpF = rect(-0.9, 0.3, 0.9, 0.578);
  pal.add(dc.rear(bumpR, { offset: 0.003, minFacing: -0.2, filter: (v) => v[2] > 2.0 && v[1] < 0.6 }).pal('bumper'));
  pal.add(dc.front(bumpF, { offset: 0.003, minFacing: -0.2, filter: (v) => v[2] < -1.9 && v[1] < 0.6 }).pal('bumper'));
  pal.add(dc.side([rect(1.74, 0.38, 2.3, 0.588), rect(-2.2, 0.38, -1.74, 0.572), rect(-0.94, 0.455, 0.94, 0.535, 0.01)], { offset: 0.003, minFacing: 0.3 }).pal('bumper').sym());
  pal.add(dc.rear(rect(-0.9, 0.545, 0.9, 0.572), { offset: 0.005, minFacing: 0.3, filter: (v) => v[2] > 2.1 }).pal('chrome'));
  pal.add(dc.front(rect(-0.9, 0.53, 0.9, 0.557), { offset: 0.005, minFacing: 0.3, filter: (v) => v[2] < -2.0 }).pal('chrome'));
  pal.add(dc.side([rect(1.74, 0.548, 2.3, 0.572), rect(-2.2, 0.532, -1.74, 0.556), rect(-0.94, 0.505, 0.94, 0.52)], { offset: 0.005, minFacing: 0.3 }).pal('chrome').sym());

  // --- shut lines
  const lw = 0.007;
  pal.add(dc.side([
    ...stroke([[-0.79, 0.25], [-0.79, 0.955]], lw), ...stroke([[0.145, 0.25], [0.145, 0.975]], lw),
    ...stroke([[0.99, 0.955], [0.975, 0.75], [0.93, 0.62], [0.82, 0.5], [0.79, 0.4], [0.79, 0.25]], lw),
    ...stroke([[-0.79, 0.25], [0.79, 0.25]], lw),
  ], { offset: 0.0055 }).pal('line').sym());
  pal.add(dc.top([...stroke([[0.7, -2.0], [0.72, -0.93]], lw), ...stroke([[0.69, 1.47], [0.7, 2.2]], lw)], { offset: 0.0055, minFacing: 0.5 }).pal('line').sym());
  pal.add(dc.rear([...stroke([[0.285, 0.6], [0.285, 0.85], [0.7, 0.85], [0.7, 0.96]], lw)], { offset: 0.0055, filter: (v) => v[2] > 2.0 }).pal('line').sym());

  // --- tail lamps (ribbed), reverse lamps, plate, badges
  const tl = rect(0.3, 0.655, 0.83, 0.835, 0.012);
  const fr = { filter: (v) => v[2] > 1.9 };
  tail.add(dc.yaw(14)(rect(0.41, 0.655, 0.86, 0.835, 0.008), { offset: 0.006, minFacing: 0.03, origin: [0, 0, 2.2], ...fr }));
  const tailL = tail.mirrored(); tail.add(tailL);
  reverse.add(dc.rear(rect(0.3, 0.655, 0.405, 0.835, 0.008), { offset: 0.006, ...fr }).sym());
  void tl;
  const zp = pr.rearZ(0, 0.745);
  const pl = plate([0, 0.745, zp + 0.008], A_PLATE, { tilt: 0.04 });
  atlas.add(pl.face); pal.add(pl.back);
  atlas.add(dc.rear(rect(-0.62, 0.875, -0.4, 0.935), { offset: 0.007, ...fr }).uvRect(A_190));
  atlas.add(dc.rear(rect(0.44, 0.875, 0.58, 0.935), { offset: 0.007, ...fr }).uvRect(A_26));
  // star badge on the boot lid
  const zs = pr.rearZ(0, 0.895) + 0.008;
  const star = (cx, cy, cz, R, pa, rx) => {
    const s = new Soup();
    s.add(fromGeo(new THREE.TorusGeometry(R, R * 0.09, 6, 28), { p: [cx, cy, cz], r: [rx, 0, 0] }, pa));
    for (let i = 0; i < 3; i++) s.add(box(R * 0.13, R, R * 0.1, new THREE.Matrix4().makeTranslation(cx, cy, cz).multiply(new THREE.Matrix4().makeRotationX(rx)).multiply(new THREE.Matrix4().makeRotationZ(i * Math.PI * 2 / 3)).multiply(new THREE.Matrix4().makeTranslation(0, R / 2, 0)), pa));
    return s;
  };
  pal.add(star(0, 0.895, zs, 0.042, 'chrome', 0));

  // --- front: grille, headlamps, plate, bonnet star
  const ff = { filter: (v) => v[2] < -1.9 };
  pal.add(dc.front(rect(-0.26, 0.6, 0.26, 0.878, 0.02), { offset: 0.004, ...ff }).pal('chrome'));
  pal.add(dc.front(rect(-0.235, 0.625, 0.235, 0.853, 0.012), { offset: 0.0055, ...ff }).pal('line'));
  const bars = [rect(-0.012, 0.625, 0.012, 0.853)];
  for (let i = 1; i < 8; i++) bars.push(rect(-0.235, 0.625 + i * 0.0285 - 0.004, 0.235, 0.625 + i * 0.0285 + 0.004));
  pal.add(dc.front(bars, { offset: 0.007, ...ff }).pal('chrome'));
  head.add(dc.any({ u: [-Math.cos(0.2), 0, -Math.sin(0.2)], v: [0, 1, 0], out: [Math.sin(0.2), 0, -Math.cos(0.2)] })(rect(-0.86, 0.655, -0.29, 0.86, 0.012), { offset: 0.006, minFacing: 0.03, box: [-0.29, 0.655, -0.86, 0.86], ...ff }));
  head.add(head.mirrored());
  const zfp = pr.frontZ(0, 0.47);
  const fp = plate([0, 0.47, zfp - 0.008], A_PLATE, { front: true });
  atlas.add(fp.face); pal.add(fp.back);
  pal.add(cyl(0.006, 0.008, 0.03, 8, { p: [0, pr.topY(0, -2.0) + 0.012, -2.0] }, 'chrome'));
  pal.add(star(0, pr.topY(0, -2.0) + 0.07, -2.0, 0.045, 'chrome', 0));

  // --- mirrors, handles, exhaust, wipers
  const mx = pr.sideX(-0.62, 1.0);
  paint.add(blob(0.2, 0.115, 0.085, { p: [mx + 0.085, 1.005, -0.62] }, null, 4).sym());
  pal.add(box(0.06, 0.03, 0.05, { p: [mx + 0.01, 0.975, -0.62] }, 'plastic').sym());
  for (const z of [0.03, 0.88]) {
    const hx = pr.sideX(z, 0.865);
    pal.add(blob(0.022, 0.03, 0.13, { p: [hx + 0.006, 0.865, z] }, 'chrome', 5, 8).sym());
    pal.add(box(0.012, 0.04, 0.17, { p: [hx + 0.001, 0.865, z] }, 'plastic').sym());
  }
  for (const x of [-0.5, -0.425]) {
    pal.add(cyl(0.027, 0.027, 0.16, 14, { p: [x, 0.275, 2.2], r: [Math.PI / 2, 0, 0] }, 'chrome', true));
    pal.add(cyl(0.022, 0.022, 0.15, 12, { p: [x, 0.275, 2.19], r: [Math.PI / 2, 0, 0] }, 'well'));
  }

  const wheel = { soup: buildWheel({ R: DIMS.wheelRadius, width: 0.195, rimR: 0.196, style: 'gulli' }) };
  return assembleCar({ id: 'w201', dims: DIMS, parts: { paint, glass, pal, tail, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel });
}
