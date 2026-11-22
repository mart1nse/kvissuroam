// Subaru Impreza 22B STi (GC8, 1998): the wide-body two-door built for Subaru's 40th year and its third
// WRC makes' title. Sonic Blue, gold 17-inch BBS wheels, the tall rear wing.
// The body is Martin's scanned model (public/models/impreza.glb, cleaned with glb-tools/generic/build2.py:
// rear wiper and the pockets under the wing removed, paint evened, glass darkened, side panes fitted).
// What is built here is the light stand-in that shows until the scan has loaded, plus the wheels.
import { Soup, buildBody, cutArches, decals, probe, rpoly, rect, stroke, grow, box, blob, cyl, canvasTex, drawPlate, plate, assembleCar, frontYaw, tintPaint } from './kit.js';
import { useGlbBody } from './glbbody.js';
import { lathe, spokeFace, tyreAndRim } from './parts.js';

// real car: 4365 x 1770 x 1390 mm, wheelbase 2520, track 1480 front / 1500 rear, 235/40 ZR17 on 8.5J BBS.
// (the scan is 4.28 m long at this wheelbase: its overhangs are left as they came)
const DIMS = { length: 4.285, width: 1.77, height: 1.39, wheelbase: 2.52, track: 1.5, trackFront: 1.48, wheelRadius: 0.31 };
const HZ = DIMS.wheelbase / 2, ZF = -HZ - 0.865, ZR = HZ + 0.9;
const PAINT = 0x1658c6;                      // Sonic Blue mica

// ---------------------------------------------------------------- wheel
// forged BBS, gold, fifteen slim spokes in five groups of three, red four-pot calipers. Axis on X, outer face +X.
function bbs22(R, width, rimR) {
  const s = tyreAndRim(R, width, rimR, { lip: 'gold', caliper: 'reflector', disc: 0.76 });
  const hw = width / 2, rf = rimR - 0.012, x1 = hw * 0.8, x0 = x1 - 0.022;
  s.add(spokeFace({ n: 15, rf, r1: rf * 0.36, r2: rf * 0.91, big: 0.125, round: 0.006, depth: 0.018, x0, x1, pal: 'gold' }));
  s.add(lathe([[rf * 0.3, x0 - 0.01], [rf * 0.3, x0 + 0.01], [rf * 0.22, x0 + 0.014], [rf * 0.17, x0 + 0.008]], 'gold', 24));
  s.add(lathe([[rf * 0.16, x0 + 0.006], [rf * 0.16, x0 + 0.012], [rf * 0.12, x0 + 0.016], [0.001, x0 + 0.017]], 'gloss', 20));
  for (let i = 0; i < 5; i++) {
    const a = (i + 0.5) * Math.PI * 2 / 5 + Math.PI / 2;
    s.add(cyl(0.008, 0.008, 0.012, 6, { p: [x0 + 0.01, Math.sin(a) * rf * 0.235, Math.cos(a) * rf * 0.235], r: [0, 0, Math.PI / 2] }, 'darkalloy'));
  }
  return s;
}

// ---------------------------------------------------------------- textures (stand-in body only)
const AW = 1024, AH = 256;
const A_PLATE = [0, 1 - 181 / AH, 832 / AW, 1];
function atlasTex() {
  return canvasTex(AW, AH, (g) => { g.clearRect(0, 0, AW, AH); drawPlate(g, 0, 0, 832, 181, '022 STI'); });
}
function lampTextures() {
  const tail = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#200000' : '#6a080e'; g.fillRect(0, 0, w, h);
    g.fillStyle = glow ? '#ffffff' : '#ff3a3a'; g.fillRect(w * 0.06, h * 0.2, w * 0.6, h * 0.6);
    if (!glow) { g.fillStyle = '#e8e2d8'; g.fillRect(w * 0.7, h * 0.2, w * 0.24, h * 0.6); }
  };
  const head = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#15181c'; g.fillRect(0, 0, w, h);
    g.fillStyle = glow ? '#fff' : '#dfe6ee'; g.fillRect(w * 0.08, h * 0.15, w * 0.62, h * 0.7);
    if (!glow) { g.fillStyle = '#d07000'; g.fillRect(w * 0.76, h * 0.15, w * 0.18, h * 0.7); }
  };
  return { tailMap: canvasTex(256, 64, tail(false)), tailGlow: canvasTex(256, 64, tail(true)), headMap: canvasTex(256, 64, head(false)), headGlow: canvasTex(256, 64, head(true)) };
}

export function buildImpreza({ scan = true } = {}) {
  const D = DIMS;
  const body = buildBody({
    top: [[ZF, 0.48], [ZF + 0.006, 0.58, 0.03], [ZF + 0.05, 0.66, 0.04], [ZF + 0.2, 0.72, 0.12], [-1.3, 0.85, 0.25], [-1.01, 0.89, 0.06],
      [-0.18, 1.33, 0.26], [0.4, 1.385, 0.6], [1.0, 1.33, 0.25], [1.62, 0.99, 0.08], [1.98, 1.02, 0.12], [ZR - 0.03, 0.98, 0.02],
      [ZR - 0.006, 0.62, 0.03], [ZR, 0.48]],
    bottom: [[ZF, 0.48], [ZF + 0.006, 0.3, 0.03], [ZF + 0.1, 0.17, 0.05], [-1.5, 0.16, 0.1], [1.6, 0.17, 0.1], [2.0, 0.27, 0.05], [ZR - 0.008, 0.36, 0.03], [ZR, 0.48]],
    w: [[ZF, 0.76], [ZF + 0.25, 0.86], [-1.26, 0.885], [0, 0.865], [1.26, 0.885], [1.9, 0.86], [ZR, 0.8]],
    yWaist: 0.7, tuck: 0.05, ySill: 0.17,
    yBelt: [[-1.0, 0.89], [-0.3, 0.9], [1.0, 0.94], [1.6, 0.99], [ZR, 0.99]],
    sh: 0.03, ledge: 0.012, th: 0.5, thc: 0.3,
    rr: [[ZF, 0.06], [-1.0, 0.06], [-0.18, 0.09], [1.62, 0.09], [1.9, 0.06], [ZR, 0.05]],
    rs: 0.06,
    crown: [[ZF, 0.03], [-1.0, 0.04], [-0.18, 0.045], [1.62, 0.04], [1.9, 0.02], [ZR, 0.02]],
    bow: [[ZF, 0.26], [-1.8, 0.16], [-1.3, 0.09], [-1.0, 0.18], [0.0, 0.07], [0.35, 0], [1.2, 0], [1.8, 0.1], [2.0, 0.15], [ZR, 0.22]],
    bowN: [[ZF, 2.6], [-1.3, 2.4], [-1.0, 2.2], [1.2, 2.5], [1.8, 3], [ZR, 3.0]],
  });
  const raw = body.soup, pr = probe(raw);
  const { soup: shell, liner } = cutArches(raw, [{ z: -HZ, y: D.wheelRadius, r: 0.36 }, { z: HZ, y: D.wheelRadius, r: 0.36 }], { halfWidth: 0.89 });
  const dc = decals(shell);
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup(), chmsl = new Soup();
  const fr = { filter: (v) => v[2] > 1.7 }, ff = { filter: (v) => v[2] < -1.7 };

  // glazing: one frameless door window and a rear quarter window each side, windscreen, rear window
  const dlo = rpoly([[-0.95, 0.91], [0.3, 0.92], [1.1, 0.95], [1.5, 0.99], [1.2, 1.12], [0.85, 1.24], [0.3, 1.27], [-0.2, 1.25]], 0.025, 3);
  pal.add(dc.side(grow(dlo, 0.014), { offset: 0.003 }).pal('gloss').sym());
  glass.add(dc.side(dlo, { offset: 0.005 }).sym());
  pal.add(dc.side([rect(0.5, 0.92, 0.56, 1.27)], { offset: 0.0065 }).pal('gloss').sym());
  const ws = rpoly([[-0.68, -0.98], [0.68, -0.98], [0.58, -0.22], [-0.58, -0.22]], 0.05);
  pal.add(dc.top(grow(ws, 0.014), { offset: 0.003, minFacing: 0.25 }).pal('gloss'));
  glass.add(dc.top(ws, { offset: 0.005, minFacing: 0.25 }));
  const rw = rpoly([[-0.58, 1.02], [0.58, 1.02], [0.64, 1.56], [-0.64, 1.56]], 0.05);
  pal.add(dc.top(grow(rw, 0.014), { offset: 0.003, minFacing: 0.25 }).pal('gloss'));
  glass.add(dc.top(rw, { offset: 0.005, minFacing: 0.25 }));

  // shut lines
  const lw = 0.008;
  pal.add(dc.side([...stroke([[-0.98, 0.26], [-0.98, 0.9]], lw), ...stroke([[0.52, 0.26], [0.52, 0.93]], lw), ...stroke([[-0.98, 0.26], [0.52, 0.26]], lw)], { offset: 0.0055 }).pal('line').sym());

  // the tall wing: two uprights at the boot's edges and a blade between them
  paint.add(box(0.03, 0.2, 0.2, { p: [0.62, 1.11, 1.92] }, null).sym());
  paint.add(box(1.36, 0.035, 0.24, { p: [0, 1.225, 1.94], r: [-0.08, 0, 0] }, null));

  // tail lamps, plate between them on the boot lid
  const ty = dc.yaw(24), to = { minFacing: 0.02, origin: [0, 0, 2.05], ...fr };
  tail.add(ty(rpoly([[0.42, 0.76], [0.86, 0.76], [0.9, 0.8], [0.88, 0.92], [0.42, 0.92]], 0.02, 3), { offset: 0.005, ...to }));
  tail.add(tail.mirrored());
  chmsl.add(dc.rear(rect(-0.16, 0.985, 0.16, 1.0), { offset: 0.006, minFacing: 0.05, ...fr }));
  const pl = plate([0, 0.84, pr.rearZ(0, 0.84) + 0.008], A_PLATE, { tilt: 0.06 });
  atlas.add(pl.face); pal.add(pl.back);

  // front: slim grille, the big bumper openings, round fog lamp covers, bonnet scoop
  pal.add(dc.front(rpoly([[-0.36, 0.63], [0.36, 0.63], [0.4, 0.7], [-0.4, 0.7]], 0.02), { offset: 0.005, minFacing: -0.1, ...ff }).pal('gloss'));
  pal.add(dc.front([rpoly([[-0.36, 0.24], [0.36, 0.24], [0.32, 0.4], [-0.32, 0.4]], 0.03)], { offset: 0.004, minFacing: -0.3, ...ff }).pal('line'));
  pal.add(dc.front([rect(-0.74, 0.28, -0.46, 0.46, 0.06), rect(0.46, 0.28, 0.74, 0.46, 0.06)], { offset: 0.005, minFacing: -0.3, ...ff }).pal('lens'));
  paint.add(blob(0.34, 0.06, 0.3, { p: [0, pr.topY(0, -1.45) + 0.015, -1.45] }, null, 3, 8));
  const hy = frontYaw(26, -1.95);
  head.add(dc.any(hy)(rpoly([[-0.86, 0.6], [-0.44, 0.6], [-0.42, 0.72], [-0.84, 0.74]], 0.02), { offset: 0.005, minFacing: 0.03, box: [-0.42, 0.6, -0.86, 0.74], ...ff }));
  head.add(head.mirrored());
  const fp = plate([0, 0.44, pr.frontZ(0, 0.44) - 0.01], A_PLATE, { front: true, tilt: 0.02 });
  atlas.add(fp.face); pal.add(fp.back);

  // mirrors
  const mx = pr.sideX(-0.78, 0.96);
  paint.add(blob(0.2, 0.11, 0.09, { p: [mx + 0.09, 0.99, -0.78] }, null, 3.5).sym());

  const wheel = { soup: bbs22(D.wheelRadius, 0.235, 0.2159 + 0.012) };
  const car = assembleCar({ id: 'impreza', dims: D, parts: { paint, glass, pal, tail, chmsl, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel });
  tintPaint(car, 'impreza', PAINT, { metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 });
  if (!scan) return car;
  // the scan has its own closed, dark wheel wells: no liners needed
  return useGlbBody(car, 'impreza.glb', { liner: false, wheelOut: { front: 0.02, rear: 0.012 } });
}
