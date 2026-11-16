// 1987 Ferrari F40 - mid-engined twin-turbo V8 berlinetta in Rosso Corsa: low pointed nose, cabin far
// forward, long Plexiglas engine cover, full-width rear wing on body-coloured end plates, black mesh tail
// with four round lamps and three centre exhausts.
import * as THREE from 'three';
import { Soup, buildBody, cutArches, decals, probe, rpoly, rect, stroke, grow, box, blob, cyl, fromGeo, buildWheel, canvasTex, drawPlate, plate, assembleCar, frontYaw, tintPaint } from './kit.js';

// real car: 4358 x 1970 x 1124 mm, wheelbase 2450, track 1594 front / 1606 rear, 245/40 ZR17 front, 335/35 ZR17 rear
const DIMS = { length: 4.358, width: 1.97, height: 1.124, wheelbase: 2.45, track: 1.6, wheelRadius: 0.334 };
const ZF = -2.215, ZR = 2.143, HZ = DIMS.wheelbase / 2;

function lampTextures() {
  // one round lamp fills the texture
  const tail = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#140202'; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = w / 2;
    if (!glow) {
      const gr = g.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.05, cx, cy, R * 0.92);
      gr.addColorStop(0, '#ff5a4a'); gr.addColorStop(0.35, '#d0100c'); gr.addColorStop(1, '#5a0303');
      g.fillStyle = gr;
    } else g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(cx, cy, R * 0.9, 0, 7); g.fill();
    // concentric fresnel rings
    g.strokeStyle = glow ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.3)'; g.lineWidth = 3;
    for (let r = R * 0.18; r < R * 0.9; r += R * 0.14) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); }
    if (!glow) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(cx - R * 0.3, cy - R * 0.38, R * 0.22, R * 0.1, -0.5, 0, 7); g.fill(); }
    g.strokeStyle = '#050505'; g.lineWidth = R * 0.12; g.beginPath(); g.arc(cx, cy, R * 0.94, 0, 7); g.stroke();
  };
  const head = (glow) => (g, w, h) => {
    // u: 0 = inboard, 1 = outboard. Clear cover over parking lamp (inboard) and amber indicator (outboard)
    g.fillStyle = glow ? '#000' : '#16191c'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, glow ? '#fff' : '#f2f5f7'); gr.addColorStop(1, glow ? '#ddd' : '#a4acb2');
    g.fillStyle = gr; g.fillRect(w * 0.04, h * 0.14, w * 0.56, h * 0.72);
    if (!glow) {
      g.strokeStyle = 'rgba(40,50,60,0.4)'; g.lineWidth = 2;
      for (let x = w * 0.06; x < w * 0.6; x += 10) { g.beginPath(); g.moveTo(x, h * 0.14); g.lineTo(x, h * 0.86); g.stroke(); }
      g.fillStyle = '#e8800f'; g.fillRect(w * 0.64, h * 0.14, w * 0.32, h * 0.72);
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      for (let y = h * 0.2; y < h * 0.86; y += 9) { g.beginPath(); g.moveTo(w * 0.64, y); g.lineTo(w * 0.96, y); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, w, h * 0.1);
    }
  };
  return { tailMap: canvasTex(128, 128, tail(false)), tailGlow: canvasTex(128, 128, tail(true)), headMap: canvasTex(256, 64, head(false)), headGlow: canvasTex(256, 64, head(true)) };
}

const AW = 1024, AH = 1024;
const uvr = (x, y, w, h) => [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
const A_PLATE = uvr(0, 0, 832, 181), A_F40 = uvr(0, 200, 300, 110), A_SHIELD = uvr(320, 200, 100, 140);
const A_MESH = uvr(0, 360, 1024, 300), A_LOUVRE = uvr(0, 680, 512, 340), A_HORSE = uvr(540, 680, 120, 160);

function horse(g, x, y, s, col) {
  // stylised cavallino rampante, drawn in a 100 x 130 box
  g.save(); g.translate(x, y); g.scale(s / 100, s / 100); g.fillStyle = col;
  g.beginPath();
  g.moveTo(48, 6); g.lineTo(58, 2); g.lineTo(62, 10); g.lineTo(72, 16); g.lineTo(70, 24); g.lineTo(60, 22);
  g.lineTo(56, 34); g.lineTo(70, 40); g.lineTo(84, 32); g.lineTo(90, 38); g.lineTo(74, 50); g.lineTo(60, 48);
  g.lineTo(58, 62); g.lineTo(64, 80); g.lineTo(78, 92); g.lineTo(80, 110); g.lineTo(72, 112); g.lineTo(70, 96);
  g.lineTo(56, 88); g.lineTo(46, 96); g.lineTo(52, 120); g.lineTo(44, 122); g.lineTo(36, 98); g.lineTo(38, 84);
  g.lineTo(30, 76); g.lineTo(18, 88); g.lineTo(8, 84); g.lineTo(22, 70); g.lineTo(30, 56); g.lineTo(36, 36);
  g.lineTo(38, 22); g.closePath(); g.fill();
  g.restore();
}
function atlasTex() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    drawPlate(g, 0, 0, 832, 181, '040 FER');
    // chrome "F40" script
    g.save(); g.translate(150, 258); g.transform(1, 0, -0.22, 1, 0, 0);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'italic bold 104px Georgia, "Times New Roman", serif';
    g.lineWidth = 8; g.strokeStyle = '#2a2a2a'; g.strokeText('F40', 0, 0);
    g.fillStyle = '#e6e8ea'; g.fillText('F40', 0, 0); g.restore();
    // yellow shield with tricolore and black horse
    g.save(); g.translate(320, 200);
    g.fillStyle = '#111'; g.beginPath(); g.moveTo(2, 2); g.lineTo(98, 2); g.lineTo(98, 90); g.quadraticCurveTo(98, 122, 50, 138); g.quadraticCurveTo(2, 122, 2, 90); g.closePath(); g.fill();
    g.fillStyle = '#f6cf14'; g.beginPath(); g.moveTo(8, 8); g.lineTo(92, 8); g.lineTo(92, 88); g.quadraticCurveTo(92, 116, 50, 131); g.quadraticCurveTo(8, 116, 8, 88); g.closePath(); g.fill();
    g.fillStyle = '#0b8a3a'; g.fillRect(8, 8, 28, 12); g.fillStyle = '#fff'; g.fillRect(36, 8, 28, 12); g.fillStyle = '#d61a1a'; g.fillRect(64, 8, 28, 12);
    horse(g, 22, 28, 58, '#0a0a0a');
    g.fillStyle = '#0a0a0a'; g.font = 'bold 20px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.fillText('S F', 50, 124);
    g.restore();
    // black diamond mesh for the tail panel
    g.fillStyle = '#060606'; g.fillRect(0, 360, 1024, 300);
    g.strokeStyle = '#3a3c40'; g.lineWidth = 3;
    for (let k = -300; k < 1024 + 300; k += 22) {
      g.beginPath(); g.moveTo(k, 360); g.lineTo(k + 300, 660); g.stroke();
      g.beginPath(); g.moveTo(k + 300, 360); g.lineTo(k, 660); g.stroke();
    }
    g.strokeStyle = '#18191b'; g.lineWidth = 10; g.strokeRect(0, 360, 1024, 300);
    // engine-cover louvres: dark slots in a smoked panel with lit slat lips
    g.fillStyle = '#16181b'; g.fillRect(0, 680, 512, 340);
    const n = 12;
    for (let i = 0; i < n; i++) {
      const y0 = 680 + 14 + i * (312 / n);
      g.fillStyle = '#020202'; g.fillRect(16, y0, 480, 312 / n * 0.62);
      g.fillStyle = '#4b4f55'; g.fillRect(16, y0 + 312 / n * 0.62, 480, 3);
    }
    for (const x of [16, 176, 336, 492]) { g.fillStyle = '#16181b'; g.fillRect(x - 4, 680, 12, 340); }
    // small horse for the tail
    horse(g, 545, 690, 110, '#d8dadc');
  });
}

// Extruded profile in (z, y), thickness along x, centred on x0.
function finSoup(pts, x0, th) {
  const sh = new THREE.Shape();
  pts.forEach((p, k) => (k ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -th / 2);
  g.rotateY(-Math.PI / 2); // shape x -> world z, extrude -> world x
  g.translate(x0, 0, 0);
  return fromGeo(g);
}

export function buildF40() {
  const body = buildBody({
    top: [[ZF, 0.37], [ZF + 0.004, 0.44, 0.02], [-2.17, 0.5, 0.04], [-1.95, 0.57, 0.12], [-1.4, 0.68, 0.2], [-0.95, 0.76, 0.08], [-0.84, 0.78, 0.03],
      [-0.12, 1.1, 0.14], [0.2, 1.124, 0.3], [0.42, 1.105, 0.04], [0.54, 0.985, 0.03], [0.9, 0.97, 0.15], [1.8, 0.94, 0.1], [2.07, 0.942, 0.012],
      [2.1, 0.955, 0.008], [2.125, 0.925, 0.012], [ZR - 0.004, 0.62, 0.02], [ZR, 0.42]],
    bottom: [[ZF, 0.37], [ZF + 0.006, 0.27, 0.03], [-2.13, 0.16, 0.05], [-1.9, 0.125, 0.1], [1.8, 0.125, 0.1], [2.02, 0.23, 0.05], [ZR - 0.006, 0.3, 0.03], [ZR, 0.42]],
    w: [[ZF, 0.7], [-2.0, 0.89], [-1.6, 0.945], [-1.225, 0.958], [-0.7, 0.945], [-0.2, 0.93], [0.3, 0.945], [0.85, 0.978], [1.4, 0.985], [1.9, 0.978], [ZR, 0.955]],
    yWaist: 0.48, tuck: 0.045, ySill: 0.14,
    yBelt: [[ZF, 0.95], [-1.1, 0.9], [-0.85, 0.8], [0.35, 0.84], [0.6, 0.93], [ZR, 0.93]],
    sh: 0.025, ledge: 0.008, ledgeH: 0.03,
    th: [[-0.9, 0.85], [0.4, 0.85], [0.65, 0.5], [ZR, 0.5]], thc: [[-0.9, 0.6], [0.4, 0.6], [0.65, 0.2]],
    rr: [[ZF, 0.05], [-1.0, 0.07], [-0.4, 0.1], [0.45, 0.1], [0.7, 0.07], [2.0, 0.06], [ZR, 0.05]],
    rs: 0.055,
    crown: [[ZF, -0.01], [-1.9, -0.035], [-1.3, -0.05], [-0.95, -0.035], [-0.75, 0.02], [-0.2, 0.03], [0.45, 0.03], [0.7, 0.0], [ZR, 0.0]],
    bow: [[ZF, 0.28], [-1.9, 0.17], [-1.5, 0.05], [-1.1, 0.06], [-0.84, 0.11], [-0.3, 0.06], [-0.1, 0], [0.42, 0], [0.5, 0.05], [0.7, 0.02], [1.8, 0.0], [2.0, 0.05], [ZR, 0.09]],
    bowN: [[ZF, 2.2], [-1.6, 2.4], [-0.84, 2.2], [0.6, 2.2], [1.8, 3], [ZR, 3.2]],
  });
  const raw = body.soup, pr = probe(raw);
  const AY = 0.334, AR = 0.374;
  const { soup: shell, liner } = cutArches(raw, [{ z: -HZ, y: AY, r: AR }, { z: HZ, y: AY, r: AR }], { halfWidth: 0.985, depth: 0.35 });
  const dc = decals(shell);
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup();
  const fr = { filter: (v) => v[2] > 1.95 }, ff = { filter: (v) => v[2] < -1.9 };

  // --- glazing: steeply raked screen, small side glass, small vertical rear window; black frames
  const ws = rpoly([[-0.74, 0.8], [0.74, 0.8], [0.56, 1.095], [-0.56, 1.095]], 0.05);
  pal.add(dc.front(grow(ws, 0.018), { offset: 0.003 }).pal('plastic'));
  glass.add(dc.front(ws, { offset: 0.005 }));
  const dlo = rpoly([[-0.8, 0.83], [0.4, 0.86], [0.4, 1.02], [0.25, 1.075], [-0.14, 1.08]], 0.03, 3);
  pal.add(dc.side(grow(dlo, 0.016), { offset: 0.003 }).pal('plastic').sym());
  glass.add(dc.side(dlo, { offset: 0.005 }).sym());
  pal.add(dc.side(stroke([[0.02, 0.85], [0.0, 1.075]], 0.014), { offset: 0.0065 }).pal('plastic').sym());
  const rw = rpoly([[-0.44, 0.995], [0.44, 0.995], [0.42, 1.085], [-0.42, 1.085]], 0.03);
  const rwf = { filter: (v) => v[2] > 0.3 && v[2] < 0.8 };
  pal.add(dc.rear(grow(rw, 0.016), { offset: 0.003, ...rwf }).pal('plastic'));
  glass.add(dc.rear(rw, { offset: 0.005, ...rwf }));

  // --- Plexiglas engine cover: smoked window ahead, slatted louvres behind
  const deck = { offset: 0.004, minFacing: 0.5, filter: (v) => v[2] > 0.6 };
  pal.add(dc.top(rpoly([[-0.5, 0.64], [0.5, 0.64], [0.56, 1.92], [-0.56, 1.92]], 0.04), deck).pal('line'));
  glass.add(dc.top(rpoly([[-0.46, 0.67], [0.46, 0.67], [0.48, 1.12], [-0.48, 1.12]], 0.03), { ...deck, offset: 0.006 }));
  atlas.add(dc.top(rpoly([[-0.5, 1.15], [0.5, 1.15], [0.53, 1.89], [-0.53, 1.89]], 0.03), { ...deck, offset: 0.006, box: [-0.53, 1.89, 0.53, 1.15] }).uvRect(A_LOUVRE));
  // side louvres on the rear haunches
  const hl = [];
  for (let i = 0; i < 6; i++) hl.push(rect(0.66, 1.3 + i * 0.075, 0.82, 1.3 + i * 0.075 + 0.04, 0.01));
  pal.add(dc.top(hl, { offset: 0.004, minFacing: 0.4 }).pal('line').sym());

  // --- side: door NACA duct, big intake ahead of the rear wheel, NACA on the rear flank top
  const sideO = { offset: 0.004, minFacing: 0.15 };
  const naca = (z0, z1, y, w0, w1) => [[z0, y - w0 / 2], [z1, y - w1 / 2], [z1, y + w1 / 2], [z0, y + w0 / 2]];
  pal.add(dc.side(rpoly(naca(-0.25, 0.3, 0.66, 0.02, 0.1), 0.015, 3), sideO).pal('well').sym());
  const intake = rpoly([[0.47, 0.3], [0.8, 0.3], [0.82, 0.62], [0.66, 0.72], [0.47, 0.66]], 0.03, 3);
  pal.add(dc.side(grow(intake, 0.012), { ...sideO, offset: 0.003 }).pal('plastic').sym());
  pal.add(dc.side(intake, sideO).pal('well').sym());
  pal.add(dc.any({ u: [0, 0, 1], v: [1, 0, 0], out: [0.5, 0.866, 0] })(rpoly([[0.55, 0.86], [1.05, 0.855], [1.05, 0.91], [0.55, 0.87]], 0.012, 3), { offset: 0.004, minFacing: 0.2, filter: (v) => v[0] > 0.6 }).pal('well').sym());

  // --- shut lines
  const lw = 0.0065;
  pal.add(dc.side([
    ...stroke([[-0.86, 0.22], [-0.86, 0.79]], lw), ...stroke([[0.44, 0.22], [0.44, 0.87]], lw), ...stroke([[-0.86, 0.22], [0.44, 0.22]], lw),
  ], { offset: 0.0055 }).pal('line').sym());
  pal.add(dc.top([...stroke([[-0.62, -0.84], [0.62, -0.84]], lw), ...stroke([[-0.55, 0.62], [0.55, 0.62]], lw)], { offset: 0.0055, minFacing: 0.3 }).pal('line'));
  // retracted pop-up headlamp covers
  const pop = rpoly([[0.42, -1.93], [0.8, -1.86], [0.82, -1.55], [0.42, -1.58]], 0.02, 3);
  pal.add(dc.top(stroke([...pop, pop[0]], lw), { offset: 0.0055, minFacing: 0.3 }).pal('line').sym());
  // bonnet NACA ducts and the front-lid vent
  pal.add(dc.top([rpoly([[0.1, -1.55], [0.14, -1.55], [0.22, -1.15], [0.06, -1.15]], 0.012, 3)], { offset: 0.004, minFacing: 0.3 }).pal('well').sym());
  const bv = [];
  for (let i = 0; i < 5; i++) bv.push(rect(-0.28, -2.06 + i * 0.045, 0.28, -2.06 + i * 0.045 + 0.022, 0.006));
  pal.add(dc.top(bv, { offset: 0.004, minFacing: 0.3 }).pal('well'));

  // --- tail: full-width black mesh, four round lamps, plate, three exhausts
  atlas.add(dc.rear(rect(-0.97, 0.43, 0.97, 0.89), { offset: 0.004, minFacing: 0.2, ...fr }).uvRect(A_MESH));
  pal.add(dc.rear(rect(-0.97, 0.43, 0.97, 0.89), { offset: 0.0025, minFacing: 0.2, ...fr }).pal('plastic'));
  pal.add(dc.rear(rect(-0.86, 0.0, 0.86, 0.3), { offset: 0.003, minFacing: -0.6, filter: (v) => v[2] > 1.75 && v[1] < 0.31 }).pal('plastic'));
  pal.add(dc.rear(rpoly([[-0.2, 0.22], [0.2, 0.22], [0.2, 0.39], [-0.2, 0.39]], 0.03), { offset: 0.005, minFacing: -0.3, ...fr }).pal('well'));
  const circ = (cx, cy, r, n = 24) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(i / n * Math.PI * 2), cy + r * Math.sin(i / n * Math.PI * 2)]);
  const LR = 0.07, LY = 0.71;
  for (const cx of [0.56, 0.78]) {
    pal.add(dc.rear(circ(cx, LY, LR + 0.014), { offset: 0.006, minFacing: 0.2, ...fr }).pal('gloss').sym());
    tail.add(dc.rear(circ(cx, LY, LR), { offset: 0.008, minFacing: 0.2, ...fr }));
  }
  tail.add(tail.mirrored());
  reverse.add(dc.rear(rect(0.3, 0.33, 0.44, 0.38, 0.008), { offset: 0.006, minFacing: 0.2, ...fr }).sym());
  const pl = plate([0, 0.58, pr.rearZ(0, 0.58) + 0.01], A_PLATE, { tilt: 0.02 });
  atlas.add(pl.face); pal.add(pl.back);
  atlas.add(dc.rear(rect(0.6, 0.47, 0.8, 0.54), { offset: 0.008, minFacing: 0.2, ...fr }).uvRect(A_F40));
  atlas.add(dc.rear(rect(-0.035, 0.825, 0.035, 0.875), { offset: 0.008, minFacing: 0.2, ...fr }).uvRect(A_HORSE));
  const ez = pr.rearZ(0, 0.32);
  for (const [x, r] of [[-0.1, 0.042], [0, 0.038], [0.1, 0.042]]) {
    pal.add(cyl(r, r, 0.2, 18, { p: [x, 0.305, ez - 0.075], r: [Math.PI / 2, 0, 0] }, 'chrome', true));
    pal.add(cyl(r * 0.84, r * 0.84, 0.19, 14, { p: [x, 0.305, ez - 0.08], r: [Math.PI / 2, 0, 0] }, 'well'));
  }

  // --- rear wing on body-coloured end plates
  const wingZ0 = 1.83, wingZ1 = 2.14, wingY = 1.06;
  const xs = pr.sideX(1.95, 0.9);
  const plateX = xs - 0.045;
  const ep = [[1.5, 0.9], [1.68, 0.97], [1.9, 1.075], [2.0, 1.1], [2.15, 1.105], [2.16, 1.04], [2.13, 0.86]];
  paint.add(finSoup(ep, plateX, 0.05).sym());
  // flying buttresses carrying the roof line back over the engine cover
  const sail = [[0.3, 1.0], [0.3, 1.115], [0.5, 1.085], [0.8, 1.03], [1.1, 0.995], [1.2, 0.97], [1.2, 0.95], [0.3, 0.95]];
  paint.add(finSoup(sail, 0.53, 0.09).sym());
  // wing: thin cambered aerofoil with an upturned trailing lip
  const foil = [[wingZ0, wingY], [wingZ0 + 0.02, wingY + 0.018], [wingZ0 + 0.12, wingY + 0.026], [wingZ1 - 0.03, wingY + 0.04], [wingZ1, wingY + 0.06],
    [wingZ1 + 0.005, wingY + 0.04], [wingZ1 - 0.04, wingY + 0.012], [wingZ0 + 0.1, wingY - 0.008], [wingZ0 + 0.02, wingY - 0.006]];
  const wsh = new THREE.Shape();
  foil.forEach((p, k) => (k ? wsh.lineTo(p[0], p[1]) : wsh.moveTo(p[0], p[1])));
  const span = plateX * 2;
  const wg = new THREE.ExtrudeGeometry(wsh, { depth: span, bevelEnabled: false, curveSegments: 4 });
  wg.translate(0, 0, -span / 2); wg.rotateY(-Math.PI / 2);
  paint.add(fromGeo(wg));

  // --- front: low nose, black lower intake, clear-covered lamps in the corners, shield
  pal.add(dc.front(rpoly([[-0.62, 0.17], [0.62, 0.17], [0.66, 0.34], [-0.66, 0.34]], 0.04), { offset: 0.004, minFacing: -0.2, ...ff }).pal('well'));
  pal.add(dc.front(rect(-0.92, 0.12, 0.92, 0.17), { offset: 0.003, minFacing: -0.6, filter: (v) => v[2] < -1.8 && v[1] < 0.18 }).pal('plastic'));
  const bars = [];
  for (let i = 1; i < 4; i++) bars.push(rect(-0.62, 0.17 + i * 0.042 - 0.005, 0.62, 0.17 + i * 0.042 + 0.005));
  pal.add(dc.front(bars, { offset: 0.006, minFacing: -0.2, ...ff }).pal('plastic'));
  const hy = frontYaw(28, -2.0);
  const lampPoly = rpoly([[-0.9, 0.38], [-0.42, 0.37], [-0.42, 0.45], [-0.88, 0.47]], 0.015);
  pal.add(dc.any(hy)(grow(lampPoly, 0.012), { offset: 0.004, minFacing: 0.03, ...ff }).pal('plastic').sym());
  head.add(dc.any(hy)(lampPoly, { offset: 0.006, minFacing: 0.03, box: [-0.42, 0.37, -0.9, 0.47], ...ff }));
  head.add(head.mirrored());
  atlas.add(dc.top(rect(-0.035, -2.12, 0.035, -2.03), { offset: 0.006, minFacing: 0.3, box: [-0.035, -2.03, 0.035, -2.12] }).uvRect(A_SHIELD));
  const fp = plate([0, 0.26, pr.frontZ(0, 0.26) - 0.012], A_PLATE, { front: true, tilt: 0.1 });
  atlas.add(fp.face); pal.add(fp.back);

  // --- black door mirrors on stalks, wiper
  const mz = -0.55, my = 0.95, mx = pr.sideX(mz, 0.86);
  pal.add(blob(0.15, 0.085, 0.08, { p: [mx + 0.13, my, mz] }, 'plastic', 3.5).sym());
  pal.add(cyl(0.012, 0.014, 0.16, 8, { p: [mx + 0.06, 0.9, mz + 0.01], r: [0, 0, -1.0] }, 'plastic').sym());
  pal.add(box(0.03, 0.04, 0.06, { p: [mx + 0.005, 0.87, mz + 0.01] }, 'plastic').sym());
  const wz = (x) => pr.frontZ(x, 0.82);
  pal.add(cyl(0.007, 0.007, 0.7, 6, { p: [0.08, 0.83, wz(0.08) + 0.02], r: [0, 0.15, Math.PI / 2 - 0.12] }, 'plastic'));

  const wheel = { soup: buildWheel({ R: DIMS.wheelRadius, width: 0.29, rimR: 0.216, style: 'spoke5' }) };
  const car = assembleCar({ id: 'f40', dims: DIMS, parts: { paint, glass, pal, tail, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel });
  return tintPaint(car, 'f40', 0xc4100f, { metalness: 0.0, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.06, envMapIntensity: 0.6 });
}
