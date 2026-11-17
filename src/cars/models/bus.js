// Tartu city bus: Scania Citywide LF CNG (12 m, two axles, low floor) in GoBus white and red, on line 8.
// A tall box with a raked windscreen, a black glass band all round, red lower sides carrying white line
// drawings of the Tartu skyline, red front corners round a white centre panel, three double doors on the
// right, the gas tanks under a white fairing on the roof, rabbit-ear mirrors and twin rear wheels.
import * as THREE from 'three';
import { Soup, decals, rpoly, rect, grow, box, cyl, tube, fromGeo, canvasTex, drawPlate, plate, assembleCar, tintPaint } from './kit.js';
import { part, lathe, tyreAndRim } from './parts.js';

// real bus: 12 000 x 2 550 mm, about 3 300 mm over the gas tanks, wheelbase 5 950,
// overhangs 2 700 front / 3 350 rear, 275/70 R22.5 tyres, twin wheels at the back.
const DIMS = { length: 12.0, width: 2.55, height: 3.3, wheelbase: 5.95, track: 1.86, trackFront: 2.1, wheelRadius: 0.478 };
const HZ = DIMS.wheelbase / 2;
const ZF = -HZ - 2.7, ZR = HZ + 3.35;
const HW = DIMS.width / 2;
const YB = 0.3, YR = 2.95;                   // underside of the skirt, roof
const BEV = 0.17;                            // radius of the body's rounded edges
const AY = 0.478, ARF = 0.6, ARR = 0.62;     // wheel arches
const WIN0 = 1.1, WIN1 = 2.78;               // the black glass band
const PAINT = 0xf2f3f1;                      // white
// doors on the right side (z from, z to)
const DOORS = [[ZF + 0.32, ZF + 1.52], [0.95, 2.15], [HZ + 0.72, HZ + 1.92]];

// ---------------------------------------------------------------- textures
const AW = 2048, AH = 1024;
const uvr = (x, y, w, h) => [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
const flipU = (r) => [r[2], r[1], r[0], r[3]];
const A_SIDE = uvr(0, 0, 2048, 160), A_FRONT = uvr(0, 180, 1024, 323), A_REAR = uvr(1040, 180, 1000, 316);
const A_DEST = uvr(0, 520, 1024, 112), A_PLATE = uvr(0, 650, 832, 181), A_RDEST = uvr(1040, 520, 400, 150);
const A_GREEN = uvr(1460, 520, 560, 150), A_SCANIA = uvr(1040, 700, 500, 90), A_NUM = uvr(1560, 700, 220, 90), A_CNG = uvr(1800, 700, 90, 90);
const A_GOBUS = uvr(860, 850, 520, 150), A_LOUVRE = uvr(1400, 850, 300, 150);
const RED = '#d81c2a';

function atlasTex() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    const W = '#fbfbf8';
    // --- side band: red, with the Tartu skyline in thin white lines along it
    {
      const x0 = 0, y0 = 0, w = 2048, h = 160, base = y0 + 132;
      g.fillStyle = RED; g.fillRect(x0, y0, w, h);
      g.strokeStyle = W; g.fillStyle = W; g.lineWidth = 2.4; g.lineJoin = 'round';
      const line = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
      // gabled wooden houses of Supilinn
      const house = (x, wd, ht, roof) => {
        line([[x, base], [x, base - ht], [x + wd / 2, base - ht - roof], [x + wd, base - ht], [x + wd, base]]);
        for (let i = 0; i < 2; i++) g.strokeRect(x + wd * (0.2 + i * 0.4), base - ht * 0.75, wd * 0.2, ht * 0.32);
      };
      // the town hall with its tower and the kissing-students fountain
      const townHall = (x) => {
        g.strokeRect(x, base - 60, 150, 60);
        for (let i = 0; i < 7; i++) g.strokeRect(x + 10 + i * 20, base - 50, 9, 16);
        for (let i = 0; i < 7; i++) g.strokeRect(x + 10 + i * 20, base - 26, 9, 16);
        line([[x - 4, base - 60], [x + 75, base - 78], [x + 154, base - 60]]);
        g.strokeRect(x + 63, base - 108, 24, 30);
        line([[x + 63, base - 108], [x + 75, base - 128], [x + 87, base - 108]]);
        g.beginPath(); g.arc(x + 75, base - 95, 6, 0, 7); g.stroke();
      };
      // the arched bridge over the Emajõgi
      const bridge = (x, wd) => {
        g.beginPath(); g.moveTo(x, base - 18); g.quadraticCurveTo(x + wd / 2, base - 70, x + wd, base - 18); g.stroke();
        line([[x - 10, base - 18], [x + wd + 10, base - 18]]);
        for (let i = 1; i < 10; i++) { const t = i / 10, xx = x + wd * t, yy = base - 18 - 52 * 4 * t * (1 - t) * 0.92; line([[xx, base - 18], [xx, yy]]); }
        for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(x - 30 + i * (wd + 60) / 6, base - 4); g.quadraticCurveTo(x - 15 + i * (wd + 60) / 6, base - 9, x + i * (wd + 60) / 6, base - 4); g.stroke(); }
      };
      // St John's church, the cathedral ruins on Toome hill, the observatory dome
      const church = (x) => {
        g.strokeRect(x, base - 50, 90, 50); line([[x, base - 50], [x + 45, base - 70], [x + 90, base - 50]]);
        g.strokeRect(x + 90, base - 100, 30, 100); line([[x + 90, base - 100], [x + 105, base - 124], [x + 120, base - 100]]);
        for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x + 18 + i * 27, base - 26, 8, Math.PI, 0); g.lineTo(x + 26 + i * 27, base - 10); g.lineTo(x + 10 + i * 27, base - 10); g.closePath(); g.stroke(); }
      };
      const ruins = (x) => {
        g.strokeRect(x, base - 96, 34, 96); g.strokeRect(x + 40, base - 96, 34, 96);
        line([[x + 74, base - 70], [x + 180, base - 70], [x + 180, base]]);
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x + 84 + i * 24, base); g.lineTo(x + 84 + i * 24, base - 44); g.arc(x + 94 + i * 24, base - 44, 10, Math.PI, 0); g.lineTo(x + 104 + i * 24, base); g.stroke(); }
        for (const xx of [x + 8, x + 48]) { g.beginPath(); g.arc(xx + 9, base - 72, 9, Math.PI, 0); g.lineTo(xx + 18, base - 52); g.lineTo(xx, base - 52); g.closePath(); g.stroke(); }
      };
      const observatory = (x) => {
        g.strokeRect(x, base - 46, 110, 46); g.beginPath(); g.arc(x + 55, base - 46, 26, Math.PI, 0); g.stroke();
        line([[x + 55, base - 72], [x + 55, base - 80]]);
        for (let i = 0; i < 4; i++) g.strokeRect(x + 10 + i * 26, base - 34, 12, 20);
      };
      const tree = (x, r) => { line([[x, base], [x, base - r * 1.4]]); g.beginPath(); g.arc(x, base - r * 1.8, r, 0, 7); g.stroke(); };
      // the scene, laid out along the band (it is seen running from the front of the bus to the back)
      house(40, 70, 40, 26); house(122, 60, 36, 22); tree(205, 16); townHall(240); tree(410, 14);
      bridge(450, 230); tree(712, 18); church(745); house(890, 66, 40, 24); house(968, 74, 44, 28); tree(1060, 15);
      ruins(1090); tree(1300, 20); observatory(1335); house(1470, 70, 42, 26); bridge(1560, 200); house(1790, 64, 38, 24); tree(1870, 14); house(1900, 70, 44, 26);
      line([[0, base], [w, base]]);
    }
    // --- front lower panel (x from +1.3 at the left of the picture to -1.3 at the right, y 0.28..1.1):
    // red corners curving round a white centre panel, a white strip along the bottom, the logo and SCANIA
    {
      const x0 = 0, y0 = 180, w = 1024, h = 323, X = (m) => x0 + (m + 1.3) / 2.6 * w, Y = (m) => y0 + (1.1 - m) / 0.82 * h;
      g.fillStyle = RED; g.fillRect(x0, y0, w, h);
      g.fillStyle = W;
      g.beginPath();
      g.moveTo(X(-0.66), Y(1.1)); g.lineTo(X(0.66), Y(1.1));
      g.bezierCurveTo(X(0.75), Y(0.8), X(0.62), Y(0.56), X(0.82), Y(0.42));
      g.lineTo(X(1.3), Y(0.36)); g.lineTo(X(1.3), Y(0.28)); g.lineTo(X(-1.3), Y(0.28)); g.lineTo(X(-1.3), Y(0.36)); g.lineTo(X(-0.82), Y(0.42));
      g.bezierCurveTo(X(-0.62), Y(0.56), X(-0.75), Y(0.8), X(-0.66), Y(1.1));
      g.closePath(); g.fill();
      // GoBus script, upper left of the panel (grey), and the SCANIA lettering in the middle
      g.save(); g.translate(X(-0.33), Y(0.98)); g.transform(1, 0, -0.18, 1, 0, 0);
      g.fillStyle = '#9a9ea3'; g.font = 'italic 600 46px "Brush Script MT", "Segoe Script", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('GoBus', 0, 0); g.restore();
      g.fillStyle = '#5c6066'; g.font = 'bold 40px "Helvetica Neue", Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.save(); g.translate(X(0), Y(0.8)); g.scale(1.35, 1); g.fillText('SCANIA', 0, 0); g.restore();
    }
    // --- rear panel (x -1.3..1.3, y 0.3..1.12): red, with the green gas sticker and a white message strip
    {
      const x0 = 1040, y0 = 180, w = 1000, h = 316, X = (m) => x0 + (m + 1.3) / 2.6 * w, Y = (m) => y0 + (1.12 - m) / 0.82 * h;
      g.fillStyle = RED; g.fillRect(x0, y0, w, h);
      // green sticker
      g.fillStyle = '#5bb432'; g.beginPath(); g.roundRect(X(-0.62), Y(1.04), X(0.62) - X(-0.62), Y(0.86) - Y(1.04), 30); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 34px "Helvetica Neue", Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('Eestimaine', X(-0.08), Y(1.0)); g.fillText('rohegaas', X(-0.08), Y(0.91));
      g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.arc(X(0.45), Y(0.95), 22, 0, 7); g.stroke();
      // white message strip
      g.fillStyle = '#f7f7f5'; g.fillRect(X(-0.85), Y(0.82), X(0.85) - X(-0.85), Y(0.74) - Y(0.82));
      g.fillStyle = '#c4161f'; g.font = 'bold 20px "Helvetica Neue", Helvetica, Arial, sans-serif';
      g.fillText('JÄTA PAREM AUTO KOJU', X(-0.42), Y(0.78)); g.fillText('SÕIDA BUSSIGA', X(0.47), Y(0.78));
      // darker red bumper strip at the bottom
      g.fillStyle = '#a5121d'; g.fillRect(x0, Y(0.42), w, Y(0.3) - Y(0.42));
    }
    // --- front destination display: amber LEDs on black
    {
      const x0 = 0, y0 = 520, w = 1024, h = 112;
      g.fillStyle = '#060606'; g.fillRect(x0, y0, w, h);
      g.fillStyle = '#ff9a1a'; g.textBaseline = 'middle';
      g.font = 'bold 84px "DIN Alternate", "Arial Narrow", Arial, sans-serif'; g.textAlign = 'center'; g.fillText('8', x0 + 90, y0 + h / 2 + 4);
      g.font = 'bold 54px "DIN Alternate", "Arial Narrow", Arial, sans-serif'; g.fillText('Kesklinn', x0 + 560, y0 + h / 2 + 3);
      // LED dot screen
      g.fillStyle = 'rgba(0,0,0,0.45)';
      for (let y = y0; y < y0 + h; y += 6) g.fillRect(x0, y, w, 2);
      for (let x = x0; x < x0 + w; x += 6) g.fillRect(x, y0, 2, h);
    }
    drawPlate(g, 0, 650, 832, 181, '408 TNS');
    // --- rear route number display
    {
      const x0 = 1040, y0 = 520, w = 400, h = 150;
      g.fillStyle = '#060606'; g.fillRect(x0, y0, w, h);
      g.fillStyle = '#ff9a1a'; g.font = 'bold 120px "DIN Alternate", "Arial Narrow", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('8', x0 + w / 2, y0 + h / 2 + 6);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      for (let y = y0; y < y0 + h; y += 7) g.fillRect(x0, y, w, 2);
      for (let x = x0; x < x0 + w; x += 7) g.fillRect(x, y0, 2, h);
    }
    // --- green gas sticker for the roof fairing
    {
      const x0 = 1460, y0 = 520, w = 560, h = 150;
      g.fillStyle = '#5bb432'; g.beginPath(); g.roundRect(x0 + 4, y0 + 4, w - 8, h - 8, 34); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 50px "Helvetica Neue", Helvetica, Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText('Eestimaine', x0 + 34, y0 + 52); g.fillText('rohegaas', x0 + 34, y0 + 106);
      g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(x0 + 470, y0 + 62, 30, 0, 7); g.stroke();
      g.font = 'bold 26px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.fillText('BioCNG', x0 + 470, y0 + 116);
    }
    // --- SCANIA in chrome for the rear, fleet number, CNG diamond
    {
      const gr = g.createLinearGradient(0, 710, 0, 780); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#a9adb2'); gr.addColorStop(1, '#eceef0');
      g.fillStyle = gr; g.strokeStyle = '#222'; g.lineWidth = 3; g.font = 'bold 66px "Helvetica Neue", Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.save(); g.translate(1290, 745); g.scale(1.3, 1); g.strokeText('SCANIA', 0, 0); g.fillText('SCANIA', 0, 0); g.restore();
      g.fillStyle = '#fff'; g.fillRect(1560, 700, 220, 90);
      g.fillStyle = '#111'; g.font = 'bold 70px "Arial Narrow", Arial, sans-serif'; g.fillText('408', 1670, 748);
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(1845, 702); g.lineTo(1888, 745); g.lineTo(1845, 788); g.lineTo(1802, 745); g.closePath(); g.fill();
      g.fillStyle = '#1f8a3a'; g.beginPath(); g.moveTo(1845, 710); g.lineTo(1880, 745); g.lineTo(1845, 780); g.lineTo(1810, 745); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 22px Arial, sans-serif'; g.fillText('CNG', 1845, 746);
    }
    // --- GoBus logo for the sides by the front door (white on the black band)
    {
      g.save(); g.translate(1120, 925); g.transform(1, 0, -0.18, 1, 0, 0);
      g.fillStyle = '#f2f2f2'; g.font = 'italic 600 92px "Brush Script MT", "Segoe Script", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('GoBus', 0, 0); g.restore();
    }
    // --- engine louvres (dark slats) for the rear corner
    {
      g.fillStyle = '#1a1b1d'; g.fillRect(1400, 850, 300, 150);
      for (let i = 0; i < 9; i++) { g.fillStyle = '#050505'; g.fillRect(1408, 858 + i * 16, 284, 9); }
    }
  });
}

// Lamps: tail = stacked round lamps (red over red over amber look comes from the palette discs; the map
// is a red lens), head = wide lens with two projectors and an LED brow.
function lampTextures() {
  const tail = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#8c0710'; g.fillRect(0, 0, w, h);
    const rg = g.createRadialGradient(w * 0.4, h * 0.4, 2, w / 2, h / 2, w * 0.55);
    if (glow) { rg.addColorStop(0, '#fff'); rg.addColorStop(0.7, '#ccc'); rg.addColorStop(1, '#222'); }
    else { rg.addColorStop(0, '#ff6a5c'); rg.addColorStop(0.5, '#cf1420'); rg.addColorStop(1, '#4a0307'); }
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    if (!glow) { g.strokeStyle = 'rgba(40,0,0,0.5)'; g.lineWidth = 2; for (let i = 6; i < w; i += 8) { g.beginPath(); g.arc(w / 2, h / 2, i / 2, 0, 7); g.stroke(); } }
  };
  const head = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#15181b'; g.fillRect(0, 0, w, h);
    if (!glow) { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3d444b'); gr.addColorStop(1, '#14171a'); g.fillStyle = gr; g.fillRect(3, 3, w - 6, h - 6); }
    for (const cx of [0.3, 0.62]) {
      const x = cx * w, y = h * 0.55, R = h * 0.3;
      g.fillStyle = glow ? '#888' : '#d5dbe0'; g.beginPath(); g.arc(x, y, R * 1.15, 0, 7); g.fill();
      const rg = g.createRadialGradient(x - R * 0.2, y - R * 0.2, 1, x, y, R);
      rg.addColorStop(0, '#fff'); rg.addColorStop(0.5, glow ? '#eee' : '#9aa4ac'); rg.addColorStop(1, glow ? '#666' : '#1c2024');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill();
    }
    // LED daytime brow along the top
    g.fillStyle = glow ? '#fff' : '#e9eef2'; g.fillRect(w * 0.08, h * 0.1, w * 0.84, h * 0.08);
  };
  return { tailMap: canvasTex(64, 64, tail(false)), tailGlow: canvasTex(64, 64, tail(true)), headMap: canvasTex(256, 96, head(false)), headGlow: canvasTex(256, 96, head(true)) };
}

// ---------------------------------------------------------------- helpers
// a side profile (world z, y), extruded across the car to width `wid` with rounded edges of radius `bev`
function extrudeSide(path, wid, bev, seg = 5) {
  const sh = new THREE.Shape();
  // (the shape's x is -z, so turning it about Y puts the extrusion across the car the right way round)
  path(sh, (z, y) => [-z, y]);
  const g = new THREE.ExtrudeGeometry(sh, { depth: wid - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: seg, curveSegments: 10 });
  g.rotateY(Math.PI / 2);
  g.translate(-(wid - 2 * bev) / 2, 0, 0);
  return fromGeo(g, null);
}

// Wheels: steel discs, ten studs. Axis on X, outer face +X.
function busWheel(R, width, rimR, twin) {
  const one = (face) => {
    const s = tyreAndRim(R, width, rimR, { lip: 'silver', disc: 0.6 });
    if (!face) return s;
    const hw = width / 2, x = hw * 0.72;
    s.add(lathe([[rimR - 0.012, x - 0.04], [rimR - 0.02, x], [rimR * 0.62, x + 0.004], [rimR * 0.45, x + 0.03], [rimR * 0.3, x + 0.035]], 'silver', 40));
    s.add(cyl(rimR * 0.3, rimR * 0.3, 0.012, 28, { p: [x + 0.04, 0, 0], r: [0, 0, Math.PI / 2] }, 'steel'));
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5;
      s.add(cyl(0.017, 0.017, 0.03, 8, { p: [x + 0.045, Math.sin(a) * rimR * 0.4, Math.cos(a) * rimR * 0.4], r: [0, 0, Math.PI / 2] }, 'chrome'));
      // the hand holes in the disc
      const b = a + Math.PI / 10;
      s.add(cyl(0.028, 0.028, 0.01, 10, { p: [x + 0.012, Math.sin(b) * rimR * 0.68, Math.cos(b) * rimR * 0.68], r: [0, 0, Math.PI / 2] }, 'well'));
    }
    s.add(cyl(rimR * 0.18, rimR * 0.2, 0.05, 20, { p: [x + 0.06, 0, 0], r: [0, 0, Math.PI / 2] }, 'darkalloy'));
    return s;
  };
  if (!twin) return one(true);
  // twin rear tyres: the outer one shows its dished disc, the inner one sits behind it
  const s = new Soup();
  s.add(one(true).xform(new THREE.Matrix4().makeTranslation(width * 0.53, 0, 0)));
  s.add(one(false).xform(new THREE.Matrix4().makeTranslation(-width * 0.53, 0, 0)));
  return s;
}

// ---------------------------------------------------------------- the bus
export function buildBus() {
  // --- body: side profile with the raked windscreen, a rounded roof edge and the wheel arches
  const prof = (s, P) => {
    const m = (z, y) => s.moveTo(...P(z, y)), l = (z, y) => s.lineTo(...P(z, y)), q = (cz, cy, z, y) => s.quadraticCurveTo(...P(cz, cy), ...P(z, y));
    const zf = ZF + BEV, zr = ZR - BEV, yb = YB + BEV, yr = YR - BEV;
    m(zf + 0.12, yb);
    // front arch
    // (the shape's x is -z, so in shape space each arch runs from angle 0 over the top to angle pi;
    // the bevel grows the outline outward and so closes each arch by BEV, hence the larger radius)
    l(-HZ - ARF - BEV, yb);
    s.absarc(...P(-HZ, AY), ARF + BEV, 0, Math.PI, false);
    l(HZ - ARR - BEV, yb);
    s.absarc(...P(HZ, AY), ARR + BEV, 0, Math.PI, false);
    l(zr - 0.1, yb);
    // rear: a short undercut, then the flat tail
    q(zr, yb, zr, yb + 0.12);
    l(zr, yr - 0.22);
    q(zr, yr, zr - 0.28, yr);
    // roof
    l(zf + 0.5, yr);
    // windscreen header, then the screen raked back from the bumper
    q(zf + 0.16, yr, zf + 0.14, yr - 0.2);
    l(zf + 0.02, 1.1);
    l(zf, 0.62);
    q(zf, yb, zf + 0.12, yb);
  };
  const shell = extrudeSide(prof, DIMS.width, BEV);
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup();
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup(), chmsl = new Soup();
  // wheel houses: dark boxes inside the arches so the eye stops there
  for (const [z, r] of [[-HZ, ARF], [HZ, ARR]]) pal.add(box(1.8, r + 0.25, r * 2 - 0.05, { p: [0, YB + (r + 0.25) / 2 - 0.02, z] }, 'well'));

  const dcS = decals(part(shell, (x) => x > 0.9)), dcF = decals(part(shell, (x, y, z) => z < ZF + 0.5)), dcR = decals(part(shell, (x, y, z) => z > ZR - 0.5));
  const sideL = (poly, o = {}) => dcS.side(poly, { offset: 0.004, minFacing: 0.3, ...o });

  // --- the glass band, all round the sides (doors on the right break into it from below)
  {
    const z0 = ZF + 0.16, z1 = ZR - 0.17;
    pal.add(sideL(rect(z0, WIN0, z1, WIN1, 0.05), { offset: 0.003 }).pal('gloss').sym());
    // windows: the driver's side light, then the passenger windows between thin pillars
    const pillars = [ZF + 1.6, -2.15, -0.6, 0.85, 2.3, 3.6, 5.0];
    const panes = [];
    for (let i = 0; i < pillars.length - 1; i++) panes.push(rpoly([[pillars[i] + 0.05, WIN0 + 0.08], [pillars[i + 1] - 0.05, WIN0 + 0.08], [pillars[i + 1] - 0.05, WIN1 - 0.12], [pillars[i] + 0.05, WIN1 - 0.12]], 0.06, 3));
    panes.push(rpoly([[5.05, WIN0 + 0.08], [z1 - 0.12, WIN0 + 0.08], [z1 - 0.12, WIN1 - 0.12], [5.05, WIN1 - 0.12]], 0.06, 3));
    const front = rpoly([[z0 + 0.14, WIN0 + 0.08], [ZF + 1.55, WIN0 + 0.08], [ZF + 1.55, WIN1 - 0.12], [z0 + 0.2, WIN1 - 0.12]], 0.08, 3);
    glass.add(sideL([front, ...panes], { offset: 0.0055 }).sym());
    // narrow top lights over each pane (the hopper vents)
    pal.add(sideL(panes.map((p) => { const zs = p.map((q) => q[0]); return rect(Math.min(...zs), WIN1 - 0.42, Math.max(...zs), WIN1 - 0.4); }), { offset: 0.0065 }).pal('plastic').sym());
  }
  // --- red lower band with the skyline, continuous along each side (the doors are glass over it)
  {
    const bx = { box: [ZF - 0.05, YB, ZR, WIN0 - 0.02] };
    const segs = [];
    let z = ZF - 0.05;   // (round the front corner, to meet the red of the nose)
    for (const [a, b] of DOORS) { segs.push([z, a - 0.04]); z = b + 0.04; }
    segs.push([z, ZR - 0.1]);
    const right = segs.map(([a, b]) => rect(a, YB + 0.01, b, WIN0 - 0.02, 0.02));
    atlas.add(sideL(right, { ...bx, minFacing: 0.2 }).uvRect(flipU(A_SIDE)));
    atlas.add(sideL([rect(ZF - 0.05, YB + 0.01, ZR - 0.1, WIN0 - 0.02, 0.02)], { ...bx, minFacing: 0.2 }).uvRect(A_SIDE).mirrored());
  }
  // --- doors (right side): two glass leaves each in black frames, a rubber seal down the middle
  for (const [a, b] of DOORS) {
    const y0 = YB + 0.04, y1 = WIN1 - 0.18, mid = (a + b) / 2;
    pal.add(sideL(rect(a - 0.03, y0, b + 0.03, y1 + 0.03, 0.03), { offset: 0.0075 }).pal('gloss'));
    const leaf = (p, q) => rpoly([[p + 0.06, y0 + 0.08], [q - 0.06, y0 + 0.08], [q - 0.06, y1 - 0.08], [p + 0.06, y1 - 0.08]], 0.05, 3);
    glass.add(sideL([leaf(a, mid), leaf(mid, b)], { offset: 0.009 }));
    pal.add(sideL([rect(mid - 0.012, y0, mid + 0.012, y1, 0.004), rect(a + 0.02, y0 + 0.42, b - 0.02, y0 + 0.47, 0.01)], { offset: 0.01 }).pal('rubber'));
    // door step light strip and the push button
    pal.add(sideL(rect(a + 0.1, y0 + 0.02, b - 0.1, y0 + 0.04), { offset: 0.01 }).pal('lens'));
    pal.add(sideL(rect(b + 0.06, 1.1, b + 0.13, 1.2, 0.02), { offset: 0.009 }).pal('amber'));
  }
  // fleet number, CNG diamond and GoBus logo by the front door, on both sides
  atlas.add(sideL(rect(ZF + 1.62, 0.92, ZF + 1.92, 1.04), { offset: 0.008 }).uvRect(flipU(A_NUM)));
  atlas.add(sideL(rect(ZF + 1.62, 0.92, ZF + 1.92, 1.04), { offset: 0.008 }).uvRect(A_NUM).mirrored());
  atlas.add(sideL(rect(ZF + 2.0, 0.92, ZF + 2.12, 1.04), { offset: 0.008 }).uvRect(flipU(A_CNG)));
  atlas.add(sideL(rect(-1.0, WIN1 - 0.05, 0.2, WIN1 - 0.07 + 0.32), { offset: 0.0075, minFacing: 0.1 }).uvRect(flipU(A_GOBUS)));
  atlas.add(sideL(rect(-1.0, WIN1 - 0.05, 0.2, WIN1 - 0.07 + 0.32), { offset: 0.0075, minFacing: 0.1 }).uvRect(A_GOBUS).mirrored());
  // engine louvres at the back of the left side, behind the last window
  atlas.add(sideL(rect(ZR - 1.2, YB + 0.18, ZR - 0.3, YB + 0.62, 0.03), { offset: 0.008 }).uvRect(A_LOUVRE).mirrored());
  // side marker lights along the skirt
  for (const z of [ZF + 2.2, -0.3, HZ + 2.3]) pal.add(sideL(rect(z, YB + 0.08, z + 0.07, YB + 0.12, 0.015), { offset: 0.008 }).pal('amber').sym());

  // --- front: big raked screen, destination display above it, the painted lower panel, lamps in the red corners
  {
    const fo = { minFacing: 0.05 };
    pal.add(dcF.front(rpoly([[-1.2, WIN0], [1.2, WIN0], [1.17, 2.62], [-1.17, 2.62]], 0.08, 3), { offset: 0.003, ...fo }).pal('gloss'));
    glass.add(dcF.front(rpoly([[-1.13, WIN0 + 0.05], [1.13, WIN0 + 0.05], [1.1, 2.6], [-1.1, 2.6]], 0.07, 3), { offset: 0.0055, ...fo }));
    // the slim black pillar splitting the screen and the destination display under the black header
    pal.add(dcF.front(rpoly([[-1.17, 2.62], [1.17, 2.62], [1.12, 2.93], [-1.12, 2.93]], 0.06, 3), { offset: 0.003, ...fo }).pal('gloss'));
    atlas.add(dcF.front(rect(-1.04, 2.66, 1.04, 2.88), { offset: 0.0055, ...fo }).uvRect(A_DEST));
    atlas.add(dcF.front(rect(-1.32, YB - 0.02, 1.32, WIN0), { offset: 0.004, minFacing: 0.02, box: [-1.3, 0.28, 1.3, 1.1] }).uvRect(A_FRONT));
    // headlamps set into the red corners
    const hl = rpoly([[-1.16, 0.76], [-0.83, 0.74], [-0.8, 0.86], [-1.14, 0.9]], 0.03, 3);
    pal.add(dcF.front(grow(hl, 0.01), { offset: 0.005, ...fo }).pal('gloss').sym());
    head.add(dcF.front(hl, { offset: 0.0065, box: [-0.8, 0.74, -1.16, 0.9], ...fo }));
    head.add(head.mirrored());
    pal.add(dcF.front(rect(-1.18, 0.66, -0.96, 0.7, 0.01), { offset: 0.006, ...fo }).pal('amber').sym());
    const fp = plate([0, 0.4, ZF - 0.006], A_PLATE, { front: true });
    atlas.add(fp.face); pal.add(fp.back);
    // wipers parked along the bottom of the screen
    for (const x0 of [-0.95, 0.12]) pal.add(tube([[x0, WIN0 + 0.12, ZF + 0.0], [x0 + 0.8, WIN0 + 0.14, ZF + 0.005]], 0.012, null, 'plastic', 5));
    // rabbit-ear mirrors on arms from the top corners
    for (const sx of [1, -1]) {
      const arm = [[sx * 1.16, 2.55, ZF + 0.25], [sx * 1.32, 2.6, ZF + 0.1], [sx * 1.38, 2.5, ZF - 0.18], [sx * 1.35, 2.25, ZF - 0.32]];
      pal.add(tube(arm, 0.025, null, 'gloss', 8));
      pal.add(box(0.2, 0.42, 0.08, { p: [sx * 1.33, 2.0, ZF - 0.36], r: [0, sx * -0.25, 0] }, 'gloss'));
      glass.add(box(0.17, 0.38, 0.01, { p: [sx * 1.33, 2.0, ZF - 0.31], r: [0, sx * -0.25, 0] }));
    }
  }
  // --- rear: black window with the route number, SCANIA, red panel, round lamps up the corners
  {
    const ro = { minFacing: 0.05 };
    pal.add(dcR.rear(rpoly([[-1.05, 1.16], [1.05, 1.16], [1.05, 2.78], [-1.05, 2.78]], 0.1, 3), { offset: 0.003, ...ro }).pal('gloss'));
    glass.add(dcR.rear(rpoly([[-0.95, 1.5], [0.95, 1.5], [0.95, 2.45], [-0.95, 2.45]], 0.08, 3), { offset: 0.0055, ...ro }));
    atlas.add(dcR.rear(rect(-0.32, 2.5, 0.32, 2.74), { offset: 0.0055, ...ro }).uvRect(A_RDEST));
    atlas.add(dcR.rear(rect(-0.3, 1.25, 0.3, 1.36), { offset: 0.0055, ...ro }).uvRect(A_SCANIA));
    atlas.add(dcR.rear(rect(-1.32, YB - 0.02, 1.32, 1.14), { offset: 0.004, minFacing: 0.02, box: [-1.3, 0.3, 1.3, 1.12] }).uvRect(A_REAR));
    chmsl.add(dcR.rear(rect(-0.4, 2.8, 0.4, 2.84), { offset: 0.006, ...ro }));
    const pl = plate([0, 0.52, ZR + 0.006], A_PLATE, {});
    atlas.add(pl.face); pal.add(pl.back);
    // lamp stacks: black pods with round lamps, tail / brake on top, indicator, reversing at the bottom
    for (const sx of [1, -1]) {
      const x = sx * 1.12;
      pal.add(dcR.rear(rpoly([[x - 0.08, 0.42], [x + 0.08, 0.42], [x + 0.08, 1.1], [x - 0.08, 1.1]], 0.06, 3), { offset: 0.005, ...ro }).pal('gloss'));
      const disc = (y, r) => fromGeo(new THREE.CircleGeometry(r, 24), { p: [x, y, ZR + 0.009] });
      tail.add(disc(1.0, 0.055)).add(disc(0.86, 0.055));
      pal.add(disc(0.72, 0.05).pal('amber'));
      reverse.add(disc(0.58, 0.045));
      pal.add(disc(0.47, 0.035).pal('reflector'));
    }
    // a little ladder of lights along the roof edge
    for (const sx of [1, -1]) pal.add(box(0.06, 0.04, 0.02, { p: [sx * 1.0, 2.88, ZR + 0.004] }, 'amber'));
  }

  // --- roof: the white fairing over the gas tanks and the air conditioning unit
  {
    const fprof = (s, P) => {
      const m = (z, y) => s.moveTo(...P(z, y)), l = (z, y) => s.lineTo(...P(z, y)), q = (cz, cy, z, y) => s.quadraticCurveTo(...P(cz, cy), ...P(z, y));
      const y0 = YR - 0.06;
      m(ZF + 0.85, y0);
      q(ZF + 1.1, y0 + 0.3, ZF + 1.5, y0 + 0.33);
      l(-0.9, y0 + 0.33); q(-0.75, y0 + 0.33, -0.7, y0 + 0.28); l(-0.6, y0 + 0.26);
      l(2.0, y0 + 0.26); q(2.15, y0 + 0.26, 2.2, y0 + 0.22);
      l(ZR - 0.6, y0 + 0.2); q(ZR - 0.3, y0 + 0.19, ZR - 0.25, y0);
      l(ZF + 0.85, y0);
    };
    const fair = extrudeSide(fprof, 2.2, 0.11, 4);
    paint.add(fair);
    const dcFa = decals(part(fair, (x) => x > 0.6));
    atlas.add(dcFa.side(rect(-4.2, YR + 0.03, -2.6, YR + 0.25), { offset: 0.005, minFacing: 0.3 }).uvRect(flipU(A_GREEN)));
    atlas.add(dcFa.side(rect(-4.2, YR + 0.03, -2.6, YR + 0.25), { offset: 0.005, minFacing: 0.3 }).uvRect(A_GREEN).mirrored());
    // shut lines of the fairing panels
    for (const z of [-3.0, -0.65, 2.1, 4.2]) pal.add(dcFa.side(rect(z, YR - 0.03, z + 0.012, YR + 0.3), { offset: 0.004, minFacing: 0.2 }).pal('line').sym());
    // the black band above the windows, up to the roof edge under the fairing
    pal.add(sideL(rect(ZF + 0.16, WIN1 - 0.02, ZR - 0.45, YR - 0.02, 0.02), { offset: 0.003 }).pal('gloss').sym());
  }

  const wheelFront = { soup: busWheel(0.478, 0.275, 0.2858, false) };
  const wheel = { soup: busWheel(0.478, 0.27, 0.2858, true) };
  const car = assembleCar({ id: 'bus', dims: DIMS, parts: { paint, glass, pal, tail, chmsl, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel, wheelFront });
  return tintPaint(car, 'bus', PAINT, { metalness: 0.05, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.12 });
}
