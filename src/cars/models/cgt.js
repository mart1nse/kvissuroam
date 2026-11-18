// 2004 Porsche Carrera GT in GT silver metallic: a low, wide mid-engined two-seater. Tall front wings round
// a low bonnet, a short cabin under two carbon roof panels, twin fairings running back from the roll hoops
// over the mesh engine cover, big side intakes, a full-width mesh tail with two large tailpipes, the
// extending rear wing and five-spoke centre-lock wheels (19-inch front, 20-inch rear) over yellow calipers.
import * as THREE from 'three';
import { useGlbBody } from './glbbody.js';
import { Soup, buildBody, cutArches, decals, probe, rpoly, rect, stroke, grow, box, blob, cyl, tube, fromGeo, keyed, smooth, canvasTex, drawPlate, plate, assembleCar, tintPaint } from './kit.js';
import { part, planLine, pushTri, foldFlanks, lathe, skinPatch, spokeFace, tyreAndRim } from './parts.js';

// real car: 4613 x 1921 x 1166 mm, wheelbase 2730, track 1612 front / 1587 rear,
// 265/35 ZR19 front, 335/30 ZR20 rear. Overhangs about 1020 front / 863 rear.
const DIMS = { length: 4.613, width: 1.921, height: 1.166, wheelbase: 2.73, track: 1.587, trackFront: 1.612, wheelRadius: 0.354, wheelRadiusFront: 0.334 };
const HZ = DIMS.wheelbase / 2;
const ZF = -HZ - 1.02, ZR = HZ + 0.863;
const HW = DIMS.width / 2;
const WAIST = [[ZF, 0.42], [-1.0, 0.5], [0.6, 0.56], [ZR, 0.62]], FOLD = 0.006;
const PAINT = 0xb7bcc1;                      // GT silver metallic

// ---------------------------------------------------------------- wheel
// Forged magnesium five-spoke with a centre-lock nut. Axis on X, outer face +X.
function gtWheel(R, width, rimR, dish) {
  const s = tyreAndRim(R, width, rimR, { caliper: 'amber', disc: 0.82 });
  const hw = width / 2, rf = rimR - 0.012, x1 = hw * 0.78, x0 = x1 - dish;
  s.add(spokeFace({ n: 5, rf, r1: rf * 0.3, r2: rf * 0.91, big: 0.47, round: 0.02, depth: 0.024, x0, x1, pal: 'alloy' }));
  s.add(lathe([[rf * 0.26, x0 - 0.012], [rf * 0.26, x0 + 0.014], [rf * 0.2, x0 + 0.02], [rf * 0.15, x0 + 0.02]], 'alloy', 28));
  s.add(lathe([[rf * 0.15, x0 + 0.01], [rf * 0.15, x0 + 0.034], [rf * 0.11, x0 + 0.042], [rf * 0.05, x0 + 0.042], [0.001, x0 + 0.03]], 'darkalloy', 6));
  return s;
}

// A smooth skin over a grid of points (rows of [x, y, z]), with normals from the grid.
function gridSoup(rows) {
  const s = new Soup(), R = rows.length, C = rows[0].length;
  const at = (i, j) => rows[Math.max(0, Math.min(R - 1, i))][Math.max(0, Math.min(C - 1, j))];
  const V = rows.map((row, i) => row.map((p, j) => {
    const a = at(i + 1, j), b = at(i - 1, j), c = at(i, j + 1), d = at(i, j - 1);
    const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], v = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...n) || 1; n = n.map((x) => x / l);
    if (n[1] < 0) n = n.map((x) => -x);
    return { p, n, uv: [0, 0] };
  }));
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < C - 1; j++) { pushTri(s, V[i][j], V[i + 1][j], V[i + 1][j + 1]); pushTri(s, V[i][j], V[i + 1][j + 1], V[i][j + 1]); }
  return s;
}

// ---------------------------------------------------------------- textures
function lampTextures() {
  // Tail lamp, u 0 = inboard .. 1 = round the corner, v 0 = bottom .. 1 = top (canvas y runs down): a dark red
  // lens over a honeycomb of small round LED cells, each in its own reflector cup
  const tail = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#3a0204'; g.fillRect(0, 0, w, h);
    if (!glow) { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,70,60,0.28)'); gr.addColorStop(0.35, 'rgba(160,10,14,0.15)'); gr.addColorStop(1, 'rgba(10,0,0,0.45)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    const cols = 22, rows = 7, dx = w / cols, dy = h / rows, R = Math.min(dx, dy) * 0.4;
    for (let r = 0; r < rows; r++) for (let c = -1; c <= cols; c++) {
      const x = (c + 0.5 + (r % 2) * 0.5) * dx, y = (r + 0.5) * dy;
      if (glow) {
        const rg = g.createRadialGradient(x, y, 0, x, y, R * 1.1);
        rg.addColorStop(0, '#fff'); rg.addColorStop(0.5, '#d8d8d8'); rg.addColorStop(1, '#000');
        g.fillStyle = rg; g.beginPath(); g.arc(x, y, R * 1.1, 0, 7); g.fill();
      } else {
        // cup: dark rim, red bowl lit from the top left, a pin-point LED in the middle
        g.fillStyle = '#1a0103'; g.beginPath(); g.arc(x, y, R * 1.12, 0, 7); g.fill();
        const rg = g.createRadialGradient(x - R * 0.35, y - R * 0.35, 0.5, x, y, R);
        rg.addColorStop(0, '#ff8a80'); rg.addColorStop(0.35, '#d0141c'); rg.addColorStop(1, '#4c0307');
        g.fillStyle = rg; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill();
        g.fillStyle = '#2a0204'; g.beginPath(); g.arc(x, y, R * 0.28, 0, 7); g.fill();
      }
    }
    if (!glow) {
      // clear outer lens: a soft highlight along the top and a dark edge all round
      g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(0, 0, w, h * 0.12);
      g.strokeStyle = '#120001'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
    }
  };
  // Headlamp seen from above, u across the car, v 0 = front tip .. 1 = rear: clear lens, two projectors
  const head = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#3a4046'; g.fillRect(0, 0, w, h);
    if (!glow) { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#23272b'); gr.addColorStop(0.5, '#565e66'); gr.addColorStop(1, '#2b3035'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    for (const [cy, r] of [[0.36, 0.3], [0.68, 0.34]]) {
      const x = w * 0.5, y = (1 - cy) * h, R = r * w;
      g.fillStyle = glow ? '#666' : '#c9d0d6'; g.beginPath(); g.arc(x, y, R * 1.12, 0, 7); g.fill();
      g.fillStyle = glow ? '#666' : '#15181b'; g.beginPath(); g.arc(x, y, R * 0.98, 0, 7); g.fill();
      const rg = g.createRadialGradient(x - R * 0.2, y - R * 0.2, 1, x, y, R);
      rg.addColorStop(0, glow ? '#fff' : '#f4f8fa'); rg.addColorStop(0.55, glow ? '#eee' : '#8f9aa3'); rg.addColorStop(1, glow ? '#555' : '#2c3238');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, R * 0.9, 0, 7); g.fill();
    }
    if (!glow) { g.fillStyle = '#f0a020'; g.fillRect(w * 0.3, h * 0.03, w * 0.4, h * 0.07); }
  };
  return { tailMap: canvasTex(768, 256, tail(false)), tailGlow: canvasTex(768, 256, tail(true)), headMap: canvasTex(96, 256, head(false)), headGlow: canvasTex(96, 256, head(true)) };
}

const AW = 1024, AH = 512;
const uvr = (x, y, w, h) => [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
const A_PLATE = uvr(0, 0, 832, 181), A_NAME = uvr(0, 200, 520, 70), A_CREST = uvr(540, 200, 90, 110), A_SCRIPT = uvr(650, 200, 360, 80), A_MESH = uvr(0, 300, 512, 200);
function atlasTex() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    drawPlate(g, 0, 0, 832, 181, '001 POR');
    // PORSCHE in wide spaced capitals
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 58px "Helvetica Neue", Helvetica, Arial, sans-serif';
    const txt = 'PORSCHE';
    for (let i = 0; i < txt.length; i++) { const x = 44 + i * 72; g.lineWidth = 5; g.strokeStyle = '#0c0c0d'; g.strokeText(txt[i], x, 236); g.fillStyle = '#1a1b1d'; g.fillText(txt[i], x, 236); }
    // crest: gold shield, red and black bars
    {
      const x = 585, y = 255;
      g.fillStyle = '#c9a23a'; g.beginPath(); g.moveTo(x - 40, y - 50); g.lineTo(x + 40, y - 50); g.lineTo(x + 40, y + 10); g.quadraticCurveTo(x + 36, y + 44, x, y + 54); g.quadraticCurveTo(x - 36, y + 44, x - 40, y + 10); g.closePath(); g.fill();
      g.fillStyle = '#a3161a'; g.fillRect(x - 32, y - 26, 26, 12); g.fillRect(x + 6, y + 4, 26, 12);
      g.fillStyle = '#141414'; g.fillRect(x + 6, y - 26, 26, 12); g.fillRect(x - 32, y + 4, 26, 12); g.fillRect(x - 30, y - 44, 60, 9);
      g.fillStyle = '#e4c66a'; g.fillRect(x - 9, y - 14, 18, 26);
    }
    // "Carrera GT" script
    g.save(); g.translate(830, 240); g.transform(1, 0, -0.25, 1, 0, 0);
    g.font = 'italic bold 50px Georgia, "Times New Roman", serif'; g.lineWidth = 5; g.strokeStyle = '#17181a'; g.strokeText('Carrera GT', 0, 0);
    const gr = g.createLinearGradient(0, -25, 0, 25); gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, '#a9adb2'); gr.addColorStop(1, '#eceef0');
    g.fillStyle = gr; g.fillText('Carrera GT', 0, 0); g.restore();
    // woven mesh for the engine cover, the tail and the intakes
    g.fillStyle = '#040404'; g.fillRect(0, 300, 512, 200);
    g.strokeStyle = '#2b2d30'; g.lineWidth = 2.2;
    g.save(); g.beginPath(); g.rect(0, 300, 512, 200); g.clip();
    for (let k = -30; k < 60; k++) { g.beginPath(); g.moveTo(k * 13, 300); g.lineTo(k * 13 + 200, 500); g.stroke(); g.beginPath(); g.moveTo(k * 13, 300); g.lineTo(k * 13 - 200, 500); g.stroke(); }
    g.restore();
  });
}

// ---------------------------------------------------------------- the car
export function buildCGT() {
  const ZC = -0.6, ZH = 0.03, ZB = 0.64;      // cowl, windscreen header, back of the roof (roll hoops)
  const body = buildBody({
    top: [[ZF, 0.34], [ZF + 0.004, 0.405, 0.03], [ZF + 0.1, 0.5, 0.08], [ZF + 0.4, 0.58, 0.3], [-1.5, 0.67, 0.6], [ZC - 0.15, 0.79, 0.2], [ZC, 0.815, 0.05],
      [ZH, 1.135, 0.18], [0.32, 1.166, 0.5], [ZB, 1.13, 0.12], [ZB + 0.15, 0.975, 0.06], [1.6, 0.95, 0.5],
      [ZR - 0.12, 0.925, 0.03], [ZR - 0.045, 0.9, 0.02], [ZR - 0.022, 0.6, 0.06], [ZR - 0.003, 0.45, 0.03], [ZR, 0.36]],
    bottom: [[ZF, 0.34], [ZF + 0.005, 0.22, 0.03], [ZF + 0.1, 0.13, 0.04], [-1.8, 0.095, 0.1], [1.7, 0.1, 0.1], [ZR - 0.16, 0.2, 0.06], [ZR - 0.003, 0.27, 0.03], [ZR, 0.36]],
    w: [[ZF, 0.76], [-2.05, 0.9], [-HZ, 0.948], [-0.75, 0.905], [0.2, 0.9], [0.9, 0.93], [HZ, HW - FOLD], [1.8, 0.948], [2.05, 0.925], [ZR, 0.875]],
    yWaist: WAIST, tuck: 0.075, ySill: 0.14,
    yBelt: [[ZF, 0.76], [-HZ, 0.78], [ZC, 0.785], [0.3, 0.83], [ZB + 0.15, 0.86], [ZR, 0.84]],
    sh: 0.035, ledge: 0.006, ledgeH: 0.02, th: [[ZF, 0.3], [ZC, 0.75], [ZB, 0.8], [ZB + 0.2, 0.5], [ZR, 0.3]], thc: [[ZF, 0.2], [ZC, 0.7], [ZB, 0.7], [ZB + 0.2, 0.2], [ZR, 0.2]],
    rr: [[ZF, 0.05], [-HZ, 0.11], [ZC, 0.08], [0.3, 0.07], [ZB, 0.07], [1.0, 0.1], [HZ, 0.12], [ZR, 0.06]],
    rs: 0.045,
    // (negative crown: the wings stand above the bonnet and the engine cover)
    crown: [[ZF, 0.0], [-2.1, -0.04], [-HZ, -0.085], [ZC - 0.15, -0.06], [ZC + 0.05, 0.02], [ZH, 0.03], [ZB, 0.03], [ZB + 0.18, -0.01], [1.1, -0.035], [HZ, -0.05], [ZR - 0.1, -0.02], [ZR, 0.0]],
    bow: [[ZF, 0.25], [-2.05, 0.14], [-1.7, 0.03], [-1.1, 0], [ZC, 0.14], [ZH - 0.05, 0.07], [ZH + 0.1, 0], [1.6, 0], [1.9, 0.03], [2.08, 0.09], [ZR, 0.19]],
    bowN: [[ZF, 2.4], [-1.7, 2.6], [ZC, 2.3], [ZB, 2.6], [ZR, 3.0]],
  });
  const raw = body.soup;
  const yFold = keyed(WAIST);
  foldFlanks(raw, yFold, FOLD, 0.06, 0.16, ZF + 0.3, ZR - 0.25);
  const rearP = part(raw, (x, y, z) => z > 1.3 && y > 0.1 && y < 1.1);
  const frontP = part(raw, (x, y, z) => z < -1.2 && y > 0.1 && y < 0.95);
  const sideP = part(raw, (x, y, z) => x > 0.45 && y > 0.18 && y < 1.0);
  const cabP = part(raw, (x, y, z) => y > 0.6 && z > -1.2);
  const prR = probe(rearP), prF = probe(frontP), prC = probe(cabP), prS = probe(sideP);

  const arches = cutArches(raw, [{ z: -HZ, y: 0.335, r: 0.363 }, { z: HZ, y: 0.355, r: 0.386 }], { halfWidth: HW });
  const shell = arches.soup;
  const dcS = decals(part(shell, (x) => x > 0.35)), dcR = decals(part(shell, (x, y, z) => z > 0.5));
  const dcF = decals(part(shell, (x, y, z) => z < -1.2)), dcT = decals(part(shell, (x, y) => y > 0.45));
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(arches.liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup(), chmsl = new Soup();
  const fr = { filter: (v) => v[2] > 1.9 }, ff = { filter: (v) => v[2] < -1.9 };
  const rz = (x, y) => prR.rearZ(x, y), fz = (x, y) => prF.frontZ(x, y);
  const lw = 0.006, lo = { offset: 0.0045 };

  // --- fairings behind the roll hoops, tapering down onto the engine cover
  {
    const deck = (z) => prC.topY(0.34, z) || 0.95;
    for (const sx of [1, -1]) {
      const rows = [], n = 18, m = 12, z0 = ZB - 0.07, z1 = 1.86;
      for (let i = 0; i <= n; i++) {
        const t = i / n, z = z0 + (z1 - z0) * t, base = Math.min(deck(Math.max(z, ZB + 0.16)), 0.975) - 0.03;
        const top = base + 0.03 + (1.118 - 0.975) * Math.pow(1 - smooth(t), 1.25) * (1 - 0.25 * t), W = 0.205 - 0.075 * t, row = [];
        for (let j = 0; j <= m; j++) { const a = Math.PI * j / m; row.push([sx * (0.335 + W * Math.cos(a) * (1 - 0.1 * Math.sin(a))), base + (top - base) * Math.pow(Math.sin(a), 0.75), z]); }
        rows.push(row);
      }
      paint.add(gridSoup(rows));
    }
  }

  // --- glazing: steep screen, small side glass, the window between the roll hoops, carbon roof panels
  const dloPts = [[-0.53, 0.805], [0.55, 0.855], [0.6, 0.985], [0.4, 1.09], [0.0, 1.1]];
  pal.add(dcS.side(grow(rpoly(dloPts, 0.03, 4), 0.012), { offset: 0.003, minFacing: 0.05 }).pal('gloss').sym());
  glass.add(dcS.side(rpoly(grow(dloPts, -0.004), 0.028, 4), { offset: 0.0052, minFacing: 0.05 }).sym());
  const topO = (z0, z1, y) => ({ minFacing: 0.25, filter: (v) => v[2] > z0 && v[2] < z1 && v[1] > y });
  const ws = rpoly([[-0.73, ZC + 0.155], [-0.38, ZC + 0.07], [0, ZC + 0.045], [0.38, ZC + 0.07], [0.73, ZC + 0.155], [0.52, ZH - 0.03], [-0.52, ZH - 0.03]], 0.04, 4);
  pal.add(dcT.top(grow(ws, 0.014), { offset: 0.003, ...topO(ZC - 0.02, ZH + 0.02, 0.8) }).pal('rubber'));
  glass.add(dcT.top(ws, { offset: 0.0052, ...topO(ZC - 0.02, ZH + 0.02, 0.8) }));
  // the two lift-out roof shells are painted like the body: only their joints show
  {
    const rp = [[-0.5, ZH + 0.012], [0.5, ZH + 0.012], [0.47, ZB - 0.06], [-0.47, ZB - 0.06]];
    pal.add(dcT.top([...stroke([...rp, rp[0]], 0.006), ...stroke([[0, ZH + 0.012], [0, ZB - 0.06]], 0.006)], { offset: 0.0045, minFacing: 0.4, filter: (v) => v[1] > 1.0 }).pal('line'));
  }
  glass.add(dcR.rear(rpoly([[-0.13, 0.985], [0.13, 0.985], [0.13, 1.09], [-0.13, 1.09]], 0.02, 3), { offset: 0.005, minFacing: 0.2, filter: (v) => v[2] > ZB - 0.05 && v[2] < ZB + 0.2 }));
  chmsl.add(dcR.rear(rect(-0.1, 1.098, 0.1, 1.11, 0.003), { offset: 0.006, minFacing: 0.1, filter: (v) => v[2] > ZB - 0.05 && v[2] < ZB + 0.2 }));

  // --- mesh engine cover between and beside the fairings
  const cover = (poly, bx) => atlas.add(dcT.top(poly, { offset: 0.004, minFacing: 0.5, box: bx, filter: (v) => v[2] > ZB + 0.12 && v[1] > 0.8 }).uvRect(A_MESH));
  cover(rpoly([[-0.13, ZB + 0.2], [0.13, ZB + 0.2], [0.2, 1.85], [-0.2, 1.85]], 0.03, 3), [-0.4, ZB + 0.2, 0.4, 1.85]);
  cover(rpoly([[0.55, 0.98], [0.7, 1.0], [0.62, 1.82], [0.48, 1.82]], 0.03, 3), [0.3, 0.98, 1.1, 1.82]);
  cover(rpoly([[-0.7, 1.0], [-0.55, 0.98], [-0.48, 1.82], [-0.62, 1.82]], 0.03, 3), [-1.1, 0.98, -0.3, 1.82]);

  // --- shut lines: doors, bonnet, engine cover
  pal.add(dcS.side([
    ...stroke([[-0.72, 0.19], [-0.72, 0.7], [-0.57, 0.8]], lw), ...stroke([[0.36, 0.19], [0.4, 0.5], [0.6, 0.85]], lw), ...stroke([[-0.72, 0.19], [0.36, 0.19]], lw),
  ], { ...lo, minFacing: 0.2 }).pal('line').sym());
  const hood = [[0.42, ZF + 0.16], [0.5, -1.7], [0.52, ZC - 0.06]];
  for (const m of [false, true]) { const s = dcT.top([...stroke(hood, lw), ...stroke([[0, ZF + 0.16], [0.42, ZF + 0.16]], lw)], { ...lo, minFacing: 0.3, filter: (v) => v[2] < ZC + 0.1 }).pal('line'); pal.add(m ? s.mirrored() : s); }
  const lid = [[0.74, ZB + 0.16], [0.74, 1.9]];
  for (const m of [false, true]) { const s = dcT.top([...stroke(lid, lw), ...stroke([[0, 1.9], [0.74, 1.9]], lw)], { ...lo, minFacing: 0.4, filter: (v) => v[2] > ZB + 0.1 }).pal('line'); pal.add(m ? s.mirrored() : s); }

  // --- side intakes: the deep scoop behind each door, and the sill intake below it
  for (const m of [false, true]) {
    const a = dcS.side(rpoly([[0.3, 0.56], [0.52, 0.47], [0.9, 0.5], [0.93, 0.76], [0.62, 0.8]], 0.03, 3), { offset: 0.0045, minFacing: 0.05, box: [0.3, 0.3, 0.95, 0.9] }).uvRect(A_MESH);
    const b = dcS.side(rpoly([[0.45, 0.22], [0.9, 0.25], [0.9, 0.36], [0.5, 0.34]], 0.02, 3), { offset: 0.0045, minFacing: 0.05, box: [0.3, 0.1, 0.95, 0.7] }).uvRect(A_MESH);
    atlas.add(m ? a.mirrored() : a).add(m ? b.mirrored() : b);
  }

  // --- air outlet behind each front wheel, ahead of the door
  pal.add(dcS.side(rpoly([[-HZ + 0.43, 0.27], [-0.775, 0.25], [-0.775, 0.6], [-HZ + 0.47, 0.64]], 0.03, 3), { offset: 0.004, minFacing: 0.05 }).pal('well').sym());

  // --- tail: honeycomb LED lamps tucked under the deck lip and wrapping round the corners, a chrome-edged
  // outlet grille between them, the script below, and a black recess low down with the plate, two round
  // tailpipes and a round fog / reversing lamp at each end
  {
    const yL = 0.8, ln = planLine(rearP, yL, 1.3, 1, 0, 86, 150);
    const sIn = ln.where((p) => p.x - 0.47), sOut = ln.where((p) => p.nx - 0.93);
    // straight top under the lip; the bottom edge sweeps up toward the corner so the lamp runs out to a point,
    // and the inboard end is rounded
    const TOP = 0.888, BOT = 0.665;
    const round = (u, ya, yb, m) => { const k = Math.min(1, u / 0.07, (1 - u) / 0.16), q = Math.sqrt(1 - (1 - k) * (1 - k)), mid = (ya + yb) / 2; return [mid + (ya - mid) * (0.45 + 0.55 * q), mid + (yb - mid) * (0.45 + 0.55 * q)]; };
    const lo = (m) => (u) => round(u, BOT + 0.075 * Math.pow(smooth((u - 0.35) / 0.65), 1.4), TOP - 0.014 * smooth((u - 0.55) / 0.45), m)[0] - m;
    const hi = (m) => (u) => round(u, BOT + 0.075 * Math.pow(smooth((u - 0.35) / 0.65), 1.4), TOP - 0.014 * smooth((u - 0.55) / 0.45), m)[1] + m;
    tail.add(skinPatch(rearP, ln, { s0: sIn, s1: sOut, nu: 36, nv: 8, offset: 0.007, vH: [BOT, TOP], y0: lo(0), y1: hi(0) }));
    tail.add(tail.mirrored());
    // body-colour bezel standing just proud round each lens, dark cup behind it
    pal.add(skinPatch(rearP, ln, { s0: sIn - 0.012, s1: sOut + 0.01, nu: 36, nv: 8, offset: 0.0035, y0: lo(0.012), y1: hi(0.012) }).pal('gloss').sym());
    // outlet grille under the wing: a chrome-edged slot with mesh behind
    const slot = rpoly([[-0.38, 0.73], [0.38, 0.73], [0.38, 0.79], [-0.38, 0.79]], 0.03, 4);
    pal.add(dcR.rear(grow(slot, 0.012), { offset: 0.0035, minFacing: 0.05, ...fr }).pal('chrome'));
    atlas.add(dcR.rear(slot, { offset: 0.0048, minFacing: 0.05, box: [-0.4, 0.69, 0.4, 0.83], ...fr }).uvRect(A_MESH));
    atlas.add(dcR.rear(rect(-0.17, 0.6, 0.17, 0.65), { offset: 0.005, minFacing: 0.03, ...fr }).uvRect(A_SCRIPT));
    // low recess, carbon lip under it
    pal.add(dcR.rear(rpoly([[-0.69, 0.285], [0.69, 0.285], [0.66, 0.475], [-0.66, 0.475]], 0.06, 5), { offset: 0.003, minFacing: 0.02, filter: (v) => v[2] > 1.9 }).pal('gloss'));
    pal.add(dcR.rear(rpoly([[-0.74, 0.13], [0.74, 0.13], [0.7, 0.27], [-0.7, 0.27]], 0.03, 4), { offset: 0.004, minFacing: 0.02, filter: (v) => v[2] > 1.85 }).pal('plastic'));
    const pl = plate([0, 0.38, (rz(0, 0.38) || ZR) + 0.008], A_PLATE, {});
    atlas.add(pl.face); pal.add(pl.back);
    for (const sx of [1, -1]) {
      const zp = (rz(sx * 0.39, 0.38) || ZR - 0.01);
      const m = new THREE.Matrix4().makeTranslation(sx * 0.39, 0.38, zp - 0.05).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      pal.add(cyl(0.055, 0.055, 0.12, 24, m, 'chrome', true));
      pal.add(cyl(0.044, 0.044, 0.11, 18, m, 'well'));
      pal.add(fromGeo(new THREE.RingGeometry(0.043, 0.062, 32), { p: [sx * 0.39, 0.38, zp + 0.012] }, 'chrome'));
      pal.add(fromGeo(new THREE.RingGeometry(0.036, 0.043, 32), { p: [sx * 0.39, 0.38, zp + 0.004] }, 'steel'));
      // round fog / reversing lamp: red ring round a clear centre
      const zl = (rz(sx * 0.6, 0.38) || ZR - 0.03);
      const ml = new THREE.Matrix4().makeTranslation(sx * 0.6, 0.38, zl - 0.004).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      pal.add(cyl(0.046, 0.046, 0.016, 24, ml, 'reflector'));
      reverse.add(cyl(0.03, 0.03, 0.02, 20, ml));
    }
    for (const x of [-0.24, 0.24]) pal.add(box(0.014, 0.1, 0.05, { p: [x, 0.19, (rz(x, 0.2) || ZR - 0.05) - 0.012] }, 'plastic'));
    // rear wing, raised on its two struts
    const wy = 1.0, wz = ZR - 0.17;
    paint.add(blob(1.42, 0.026, 0.26, { p: [0, wy, wz], r: [-0.07, 0, 0] }, null, 3.5, 14));
    for (const x of [0.5, -0.5]) pal.add(box(0.03, 0.09, 0.12, { p: [x, wy - 0.05, wz + 0.01] }, 'plastic'));
    // third brake light: a row of LEDs along the trailing edge of the wing
    chmsl.add(box(0.46, 0.012, 0.012, { p: [0, wy - 0.004, wz + 0.128], r: [-0.07, 0, 0] }));
  }

  // --- front: headlamps laid back along the wings, three intakes, crest
  {
    const hl = rpoly([[0.5, ZF + 0.33], [0.64, ZF + 0.27], [0.77, ZF + 0.38], [0.79, ZF + 0.66], [0.7, ZF + 0.88], [0.55, ZF + 0.76]], 0.05, 5);
    const ho = { minFacing: 0.2, filter: (v) => v[2] < -1.2 && v[1] > 0.5 };
    pal.add(dcT.top(grow(hl, 0.01), { offset: 0.0028, ...ho }).pal('gloss').sym());
    head.add(dcT.top(hl, { offset: 0.0048, box: [0.5, ZF + 0.27, 0.79, ZF + 0.88], ...ho }));
    head.add(head.mirrored());
    const mesh = (poly, bx) => atlas.add(dcF.front(poly, { offset: 0.0045, minFacing: 0.02, box: bx, ...ff }).uvRect(A_MESH));
    mesh(rpoly([[-0.3, 0.17], [0.3, 0.17], [0.36, 0.33], [-0.36, 0.33]], 0.03, 3), [-0.9, 0.05, 0.9, 0.75]);
    const sidePoly = rpoly([[-0.84, 0.21], [-0.46, 0.17], [-0.44, 0.34], [-0.86, 0.4]], 0.035, 3);
    mesh(sidePoly, [-0.9, 0.05, 0.9, 0.75]);
    mesh(sidePoly.map((p) => [-p[0], p[1]]).reverse(), [-0.9, 0.05, 0.9, 0.75]);
    pal.add(dcF.front(rect(-0.82, 0.415, -0.5, 0.432, 0.006), { offset: 0.0045, minFacing: 0.02, ...ff }).pal('amber').sym());
    const fp = plate([0, 0.25, fz(0, 0.25) - 0.012], A_PLATE, { front: true, w: 0.44, h: 0.096 });
    atlas.add(fp.face); pal.add(fp.back);
    atlas.add(dcT.top(rect(-0.036, ZF + 0.2, 0.036, ZF + 0.288), { offset: 0.005, minFacing: 0.3, filter: (v) => v[2] < -1.8 }).uvRect(A_CREST));
  }

  // --- wiper, mirrors on stalks, door handles
  {
    const pts = [];
    for (let i = 0; i <= 6; i++) { const x = -0.45 + 0.75 * i / 6, z = ZC + 0.1 + 0.05 * Math.abs(x) + 0.015 * i / 6; pts.push([x, prC.topY(x, z) + 0.016, z]); }
    pal.add(tube(pts, 0.006, null, 'plastic', 5));
    pal.add(tube(pts.slice(1), 0.0085, null, 'rubber', 5));
    const mz = -0.36, my = 0.93, mx = prS.sideX(mz, 0.82) || 0.86;
    paint.add(blob(0.17, 0.095, 0.1, { p: [mx + 0.1, my, mz], r: [0, -0.14, 0] }, null, 3).sym());
    pal.add(tube([[mx - 0.02, 0.83, mz + 0.01], [mx + 0.04, 0.9, mz + 0.01], [mx + 0.08, 0.925, mz + 0.005]], 0.012, null, 'gloss', 6).sym());
    const hz = 0.2, hy = 0.74, hx = prS.sideX(hz, hy) || 0.88;
    pal.add(box(0.006, 0.03, 0.13, { p: [hx + 0.001, hy, hz] }, 'darkalloy').sym());
  }

  const wheel = { soup: gtWheel(0.354, 0.335, 0.254 + 0.012, 0.045) };
  const wheelFront = { soup: gtWheel(0.334, 0.265, 0.2413 + 0.012, 0.02) };
  const car = assembleCar({ id: 'cgt', dims: DIMS, parts: { paint, glass, pal, tail, chmsl, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel, wheelFront });
  // the procedural body shows until the scanned body (public/models/cgt.glb) has loaded
  return useGlbBody(tintPaint(car, 'cgt', PAINT, { metalness: 0.82, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }), 'cgt.glb', { liner: { r: 0.44, len: 0.28, inset: 0.12 }, wheelOut: { front: 0.05, rear: 0.11 } });
}
