// Ford Focus RS WRC 03 (Martin 2026-11-26): the white works car of 2003. A stand-in body drawn in the kit's way until
// Martin's scanned model arrives: the first Focus's "New Edge" five-door shape (a long bonnet sloping up into a steep
// screen, a tall roof, the tall tail lamps up the rear pillars), on the WRC's flared arches, with the 03's big wing at
// the top of the hatch, the roof scoop and the vents in the bonnet.
//
// The bonnet is a part of its own (model.bonnet): its own mesh on a hinge at the foot of the windscreen, cut out of the
// body's skin, over a dark engine bay. src/cars/bonnet.js throws it up against the windscreen after a hard hit and
// tears it off at speed.
import * as THREE from 'three';
import { Soup, buildBody, cutArches, clipSoup, decals, probe, rpoly, rect, stroke, grow, box, blob, canvasTex, drawPlate, plate, assembleCar, frontYaw, tintPaint } from './kit.js';
import { lathe, spokeFace, tyreAndRim } from './parts.js';

// real car: 4152 x 1770 x 1380-1420 mm, wheelbase 2615, track 1550 front and rear, 225/630 R18 on 8 x 18 (sources in specs.js)
const DIMS = { length: 4.16, width: 1.77, height: 1.4, wheelbase: 2.615, track: 1.55, wheelRadius: 0.315 };
const HZ = DIMS.wheelbase / 2, ZF = -2.19, ZR = 1.97;
const PAINT = 0xf3f4f1;                      // white
// the bonnet: from just behind the nose to the foot of the windscreen, hinged there
const BON = { z0: -2.04, z1: -1.03, w0: 0.6, w1: 0.7 };

// ---------------------------------------------------------------- wheel
// white OZ rally wheel, ten slim spokes, big discs behind it with red eight-pot calipers. Axis on X, outer face +X.
function ozWheel(R, width, rimR) {
  const s = tyreAndRim(R, width, rimR, { lip: 'alloy', caliper: 'reflector', disc: 0.8 });
  const hw = width / 2, rf = rimR - 0.012, x1 = hw * 0.8, x0 = x1 - 0.022;
  s.add(spokeFace({ n: 10, rf, r1: rf * 0.3, r2: rf * 0.92, big: 0.2, round: 0.008, depth: 0.018, x0, x1, pal: 'alloy' }));
  s.add(lathe([[rf * 0.26, x0 - 0.01], [rf * 0.26, x0 + 0.012], [rf * 0.15, x0 + 0.018], [0.001, x0 + 0.02]], 'darkalloy', 20));
  return s;
}

// ---------------------------------------------------------------- textures (stand-in body only)
const AW = 1024, AH = 256;
const A_PLATE = [0, 1 - 181 / AH, 832 / AW, 1];
function atlasTex() {
  return canvasTex(AW, AH, (g) => { g.clearRect(0, 0, AW, AH); drawPlate(g, 0, 0, 832, 181, '003 WRC'); });
}
function lampTextures() {
  const tail = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#200000' : '#6a080e'; g.fillRect(0, 0, w, h);
    g.fillStyle = glow ? '#ffffff' : '#ff3a3a'; g.fillRect(w * 0.1, h * 0.06, w * 0.8, h * 0.52);
    if (!glow) { g.fillStyle = '#e8e2d8'; g.fillRect(w * 0.1, h * 0.64, w * 0.8, h * 0.14); g.fillStyle = '#d07000'; g.fillRect(w * 0.1, h * 0.8, w * 0.8, h * 0.14); }
  };
  const head = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#15181c'; g.fillRect(0, 0, w, h);
    g.fillStyle = glow ? '#fff' : '#dfe6ee'; g.fillRect(w * 0.06, h * 0.12, w * 0.6, h * 0.76);
    if (!glow) { g.fillStyle = '#d07000'; g.fillRect(w * 0.72, h * 0.3, w * 0.22, h * 0.5); }
  };
  return { tailMap: canvasTex(64, 128, tail(false)), tailGlow: canvasTex(64, 128, tail(true)), headMap: canvasTex(256, 64, head(false)), headGlow: canvasTex(256, 64, head(true)) };
}

// the bonnet's outline on the body seen from above: 0 and over inside
const inBonnet = (v) => {
  const u = Math.max(0, Math.min(1, (v[2] - BON.z0) / (BON.z1 - BON.z0))), hw = BON.w0 + (BON.w1 - BON.w0) * u;
  return Math.min(hw - Math.abs(v[0]), v[2] - BON.z0, BON.z1 - v[2], v[1] - 0.62);
};

// a soup turned inside out and pushed in along -y by d (the bonnet's underside)
function underside(s, d) {
  const o = new Soup(), P = s.p, N = s.n;
  for (let t = 0; t < P.length; t += 9) for (const k of [0, 2, 1]) {
    const i = t + k * 3;
    o.p.push(P[i], P[i + 1] - d, P[i + 2]); o.n.push(-N[i], -N[i + 1], -N[i + 2]);
  }
  return o;
}

export function buildFocus() {
  const D = DIMS;
  const body = buildBody({
    top: [[ZF, 0.5], [ZF + 0.006, 0.6, 0.03], [ZF + 0.06, 0.69, 0.04], [ZF + 0.24, 0.75, 0.12], [-1.5, 0.84, 0.3], [-1.03, 0.92, 0.06],
      [-0.2, 1.35, 0.28], [0.5, 1.4, 0.6], [1.3, 1.36, 0.25], [1.72, 1.16, 0.1], [ZR - 0.02, 1.0, 0.04],
      [ZR - 0.006, 0.62, 0.03], [ZR, 0.48]],
    bottom: [[ZF, 0.5], [ZF + 0.006, 0.28, 0.03], [ZF + 0.1, 0.15, 0.05], [-1.6, 0.14, 0.1], [1.5, 0.15, 0.1], [1.78, 0.25, 0.05], [ZR - 0.008, 0.34, 0.03], [ZR, 0.48]],
    w: [[ZF, 0.74], [ZF + 0.25, 0.85], [-HZ, 0.885], [0, 0.865], [HZ, 0.885], [1.75, 0.865], [ZR, 0.8]],
    yWaist: 0.72, tuck: 0.05, ySill: 0.16,
    yBelt: [[-1.03, 0.92], [-0.3, 0.95], [0.8, 1.0], [1.4, 1.06], [ZR, 1.06]],
    sh: 0.03, ledge: 0.012, th: 0.5, thc: 0.3,
    rr: [[ZF, 0.06], [-1.03, 0.06], [-0.2, 0.09], [1.3, 0.09], [1.7, 0.06], [ZR, 0.05]],
    rs: 0.06,
    crown: [[ZF, 0.03], [-1.03, 0.04], [-0.2, 0.045], [1.3, 0.04], [1.7, 0.02], [ZR, 0.02]],
    bow: [[ZF, 0.26], [-1.8, 0.16], [-1.3, 0.09], [-1.03, 0.18], [0.0, 0.07], [0.35, 0], [1.2, 0], [1.7, 0.1], [1.9, 0.15], [ZR, 0.22]],
    bowN: [[ZF, 2.6], [-1.3, 2.4], [-1.03, 2.2], [1.2, 2.5], [1.7, 3], [ZR, 3.0]],
  });
  const raw = body.soup, pr = probe(raw);
  const { soup: cut, liner } = cutArches(raw, [{ z: -HZ, y: D.wheelRadius, r: 0.37 }, { z: HZ, y: D.wheelRadius, r: 0.37 }], { halfWidth: 0.885 });
  // the bonnet out of the skin
  const shell = clipSoup(cut, (v) => -inBonnet(v)), lid = clipSoup(cut, inBonnet);
  const dc = decals(shell), dl = decals(lid);
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup(), chmsl = new Soup();
  const fr = { filter: (v) => v[2] > 1.6 }, ff = { filter: (v) => v[2] < -1.7 };

  // the engine bay under the bonnet: a dark tray a few centimetres down, seen once the bonnet is up or gone
  const bay = new Soup();
  for (let i = 0; i < 6; i++) {
    const za = BON.z0 + (BON.z1 - BON.z0) * i / 6, zb = BON.z0 + (BON.z1 - BON.z0) * (i + 1) / 6;
    const ya = pr.topY(0, za) - 0.09, yb = pr.topY(0, zb) - 0.09;
    const ha = BON.w0 + (BON.w1 - BON.w0) * i / 6, hb = BON.w0 + (BON.w1 - BON.w0) * (i + 1) / 6;
    bay.p.push(-ha, ya, za, ha, ya, za, hb, yb, zb, -ha, ya, za, hb, yb, zb, -hb, yb, zb);
    for (let k = 0; k < 6; k++) bay.n.push(0, 1, 0);
  }
  pal.add(bay.pal('well'));
  // (the engine itself, a block and the intercooler laid ahead of it)
  pal.add(box(0.62, 0.16, 0.34, { p: [0, pr.topY(0, -1.45) - 0.17, -1.45] }, 'darkalloy'));
  pal.add(box(0.9, 0.05, 0.3, { p: [0, pr.topY(0, -1.85) - 0.12, -1.85] }, 'alloy'));

  // glazing: front and rear door windows, a small quarter light, windscreen, the hatch's glass
  const dlo = rpoly([[-0.98, 0.94], [0.2, 0.96], [1.25, 1.05], [1.5, 1.08], [1.3, 1.22], [0.9, 1.29], [0.2, 1.31], [-0.25, 1.29]], 0.025, 3);
  pal.add(dc.side(grow(dlo, 0.014), { offset: 0.003 }).pal('gloss').sym());
  glass.add(dc.side(dlo, { offset: 0.005 }).sym());
  pal.add(dc.side([rect(0.17, 0.96, 0.23, 1.31), rect(1.08, 1.03, 1.13, 1.27)], { offset: 0.0065 }).pal('gloss').sym());
  const ws = rpoly([[-0.68, -1.0], [0.68, -1.0], [0.6, -0.24], [-0.6, -0.24]], 0.05);
  pal.add(dc.top(grow(ws, 0.014), { offset: 0.003, minFacing: 0.25 }).pal('gloss'));
  glass.add(dc.top(ws, { offset: 0.005, minFacing: 0.25 }));
  const rw = rpoly([[-0.56, 1.36], [0.56, 1.36], [0.6, 1.78], [-0.6, 1.78]], 0.05);
  pal.add(dc.top(grow(rw, 0.014), { offset: 0.003, minFacing: 0.2 }).pal('gloss'));
  glass.add(dc.top(rw, { offset: 0.005, minFacing: 0.2 }));

  // shut lines: two doors a side
  const lw = 0.008;
  pal.add(dc.side([...stroke([[-1.0, 0.24], [-1.0, 0.93]], lw), ...stroke([[0.2, 0.22], [0.2, 0.97]], lw), ...stroke([[1.12, 0.3], [1.12, 1.04]], lw), ...stroke([[-1.0, 0.24], [1.12, 0.24]], lw)], { offset: 0.0055 }).pal('line').sym());

  // the 03's wing at the top of the hatch: a wide blade between two end plates, and the roof scoop
  const wy = pr.topY(0, 1.55);
  paint.add(box(1.5, 0.03, 0.3, { p: [0, wy + 0.1, 1.62], r: [-0.1, 0, 0] }, null));
  paint.add(box(0.02, 0.16, 0.36, { p: [0.75, wy + 0.06, 1.62] }, null).sym());
  paint.add(box(0.04, 0.1, 0.12, { p: [0.4, wy + 0.04, 1.6] }, null).sym());
  paint.add(blob(0.3, 0.06, 0.3, { p: [0, pr.topY(0, -0.05) + 0.01, -0.05] }, null, 3, 8));
  pal.add(dc.top([rect(-0.11, -0.2, 0.11, -0.16)], { offset: 0.04, minFacing: 0.1 }).pal('line'));
  // mud flaps behind the wheels
  pal.add(box(0.26, 0.2, 0.012, { p: [0.62, 0.17, -HZ + 0.42] }, 'rubber').sym());
  pal.add(box(0.24, 0.18, 0.012, { p: [0.62, 0.22, HZ + 0.4] }, 'rubber').sym());

  // tail lamps up the rear pillars, plate between them on the hatch
  const ty = { minFacing: 0.02, origin: [0, 0, 1.95], ...fr };
  tail.add(dc.rear(rpoly([[0.62, 0.82], [0.8, 0.82], [0.8, 1.14], [0.66, 1.12]], 0.02, 3), { offset: 0.005, ...ty }));
  tail.add(tail.mirrored());
  chmsl.add(dc.rear(rect(-0.18, 1.395, 0.18, 1.41), { offset: 0.006, minFacing: 0.02, filter: (v) => v[2] > 1.4 }));
  const pl = plate([0, 0.82, pr.rearZ(0, 0.82) + 0.008], A_PLATE, { tilt: 0.04 });
  atlas.add(pl.face); pal.add(pl.back);

  // front: the small upper grille with the blue oval, the WRC's big lower mouth, fog lamps, swept-back headlamps
  pal.add(dc.front(rpoly([[-0.34, 0.6], [0.34, 0.6], [0.3, 0.68], [-0.3, 0.68]], 0.02), { offset: 0.005, minFacing: -0.1, ...ff }).pal('gloss'));
  pal.add(dc.front([rpoly([[-0.55, 0.2], [0.55, 0.2], [0.5, 0.44], [-0.5, 0.44]], 0.04)], { offset: 0.004, minFacing: -0.3, ...ff }).pal('line'));
  pal.add(dc.front([rect(-0.78, 0.28, -0.6, 0.4, 0.05), rect(0.6, 0.28, 0.78, 0.4, 0.05)], { offset: 0.005, minFacing: -0.3, ...ff }).pal('lens'));
  pal.add(dc.front([rect(-0.07, 0.62, 0.07, 0.66, 0.02)], { offset: 0.007, minFacing: -0.1, ...ff }).pal('plastic'));
  const hy = frontYaw(30, -1.98);
  head.add(dc.any(hy)(rpoly([[-0.86, 0.6], [-0.38, 0.62], [-0.4, 0.71], [-0.78, 0.76]], 0.02), { offset: 0.005, minFacing: 0.03, box: [-0.38, 0.6, -0.86, 0.76], ...ff }));
  head.add(head.mirrored());
  const fp = plate([0, 0.48, pr.frontZ(0, 0.48) - 0.01], A_PLATE, { front: true, tilt: 0.02 });
  atlas.add(fp.face); pal.add(fp.back);

  // mirrors
  const mx = pr.sideX(-0.8, 0.98);
  paint.add(blob(0.2, 0.11, 0.09, { p: [mx + 0.09, 1.01, -0.8] }, null, 3.5).sym());

  // ---- the bonnet: its skin, two vents and the pins on top, the underside beneath, all about its hinge
  const hinge = [0, pr.topY(0, BON.z1) + 0.004, BON.z1 + 0.005];
  const lidPal = new Soup();
  lidPal.add(dl.top([rpoly([[-0.42, -1.52], [-0.14, -1.52], [-0.16, -1.2], [-0.4, -1.2]], 0.03), rpoly([[0.14, -1.52], [0.42, -1.52], [0.4, -1.2], [0.16, -1.2]], 0.03)], { offset: 0.004, minFacing: 0.3 }).pal('line'));
  lidPal.add(dl.top([rect(-0.5, -1.96, -0.46, -1.92, 0.02), rect(0.46, -1.96, 0.5, -1.92, 0.02)], { offset: 0.006, minFacing: 0.3 }).pal('darkalloy'));
  lidPal.add(underside(lid, 0.012).pal('plastic'));
  const toHinge = new THREE.Matrix4().makeTranslation(-hinge[0], -hinge[1], -hinge[2]);
  lid.xform(toHinge); lidPal.xform(toHinge);

  const wheel = { soup: ozWheel(D.wheelRadius, 0.225, 0.2286 + 0.012) };
  const car = assembleCar({ id: 'focus', dims: D, parts: { paint, glass, pal, tail, chmsl, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel });
  tintPaint(car, 'focus', PAINT, { metalness: 0.1, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.05 });
  const body3 = car.group.getObjectByName('focus_paint'), pal3 = car.group.getObjectByName('focus_pal');
  const pivot = new THREE.Group(); pivot.name = 'focus_bonnet'; pivot.position.set(...hinge);
  const skin = new THREE.Mesh(lid.toGeometry(), body3.material); skin.name = 'focus_bonnet_skin'; skin.castShadow = true;
  const under = new THREE.Mesh(lidPal.toGeometry(), pal3.material); under.name = 'focus_bonnet_pal'; under.castShadow = true;
  pivot.add(skin, under);
  car.group.add(pivot);
  car.triangles += lid.tris + lidPal.tris;
  // the windscreen from the hinge: the angle the bonnet turns through to lie on it (bonnet.js), the bonnet's own slope
  // from its hinge to its front edge, and its middle (where it flies from)
  const zt = -0.3, wsA = Math.atan2(pr.topY(0, zt) - hinge[1], zt - hinge[2]);
  const lidA = Math.atan2(pr.topY(0, BON.z0) - hinge[1], BON.z0 - hinge[2]);
  // (it stops a little short of the glass, its front edge standing off the screen by some 14 cm, as the wind and the
  // buckled panel hold it, so that from behind its edge shows over the roof)
  // (turning the hinge by a takes a direction at angle t in the y-z plane to t - a)
  const turn = ((lidA - wsA) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  car.bonnet = { pivot, rest: turn - 0.14, len: BON.z1 - BON.z0, mid: [0, (pr.topY(0, BON.z0) + hinge[1]) / 2 - hinge[1], (BON.z0 + BON.z1) / 2 - hinge[2]] };
  return car;
}
