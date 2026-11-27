// 2028 Tesla Roadster Rocket (Martin 2026-11-25). The body is Martin's Tripo model of 27 Nov (public/models/rocket.glb),
// made with Tripo's smart mesh (clean flat panels, 28 thousand triangles in parts: body, wheels, seats ...) and put
// together with glb-tools/highpoly (splice.py, stage3.py): its wheels, insides and the inner face of its double glass left out, its rear diffuser (an
// empty pocket with loose discs) replaced by the diffuser and four tail nozzles of his first, high-poly scan of the
// same morning, sized to the first scan (5 % narrower and lower than the smart mesh came); paint a very light whitish
// silver, glass dark, black parts evened, the full-width red light bar of Tesla's photo as a strip of its own, gold
// rims on the four tail nozzles, plates. 12 thousand triangles, 1.1 MB.
// What is built here is the light stand-in that shows until the scan has loaded (a low two-seater drawn in the
// kit's way), plus the wheels. The ten cold-gas nozzles are where the scan has them (NOZZLES in src/cars/thrust.js:
// four in a row in the diffuser, one under each sill just behind each wheel, one each side of the nose); the
// stand-in marks them there too.
import * as THREE from 'three';
import { NOZZLES } from '../thrust.js';
import { Soup, buildBody, cutArches, decals, probe, rpoly, rect, stroke, grow, box, blob, cyl, fromGeo, canvasTex, drawPlate, plate, assembleCar, frontYaw, tintPaint } from './kit.js';
import { lathe, tyreAndRim } from './parts.js';
import { useGlbBody } from './glbbody.js';

// (Tesla has published no size: these are the scan's at the 2.65 m wheelbase. Its tyres are about 245/35 R19 in front
// and 325/30 R20 behind, their outer walls where the model's were: flush with the arches)
const DIMS = { length: 4.3, width: 1.96, height: 1.14, wheelbase: 2.65, track: 1.619, trackFront: 1.601, wheelRadius: 0.356, wheelRadiusFront: 0.326 };
const ZF = -2.1, ZR = 2.2, HZ = DIMS.wheelbase / 2;

// (the nozzles are marked where src/cars/plumes.js draws their jets: where the scanned body has them)
const ROCKET_NOZZLES = NOZZLES;

// ---------------------------------------------------------------- wheel
// Tesla's photos: six slim gloss-black spokes standing over a flat silver aero cover, a black rim lip, low tyres
// (19 inch in front, 20 at the back). Axis on X, outer face +X.
function aeroSix(R, width, rimR) {
  const s = tyreAndRim(R, width, rimR, { lip: 'gloss', disc: 0.72 });
  const hw = width / 2, rf = rimR - 0.012, x1 = hw * 0.78, x0 = x1 - 0.026;
  // (the face dishes in from the rim to the hub: x at radius r)
  const dish = (r) => x0 + (x1 - x0) * Math.pow(Math.min(1, r / rf), 1.6);
  const cover = [];
  for (let k = 0; k <= 10; k++) { const r = rf * (1 - k / 10); cover.push([Math.max(r, 0.001), dish(r) - 0.004]); }
  s.add(lathe([[rf + 0.004, x1 - 0.012], ...cover], 'silver', 48));
  // six blades, each a little swept and narrowing to the rim, a few millimetres proud of the cover
  const N = 6, r0 = rf * 0.16, r1 = rf * 0.99, steps = 8, shapes = [];
  for (let i = 0; i < N; i++) {
    const at = (t, e) => {
      const r = r0 + (r1 - r0) * t, a = Math.PI / 2 + i * Math.PI * 2 / N + 0.07 * t * t + e * (0.026 - 0.012 * t) / r;
      return new THREE.Vector2(r * Math.cos(a), r * Math.sin(a));
    };
    const pts = [];
    for (let k = 0; k <= steps; k++) pts.push(at(k / steps, -1));
    for (let k = steps; k >= 0; k--) pts.push(at(k / steps, 1));
    shapes.push(new THREE.Shape(pts));
  }
  const g = new THREE.ExtrudeGeometry(shapes, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 4 });
  g.rotateY(Math.PI / 2);
  const f = fromGeo(g, null, 'gloss'), P = f.p;
  for (let i = 0; i < P.length; i += 3) P[i] += dish(Math.hypot(P[i + 1], P[i + 2])) - 0.006;
  s.add(f);
  // the hub: a black cap with a small silver centre
  s.add(cyl(rf * 0.2, rf * 0.22, 0.016, 24, { p: [dish(0) + 0.004, 0, 0], r: [0, 0, -Math.PI / 2] }, 'gloss'));
  s.add(cyl(rf * 0.07, rf * 0.07, 0.004, 16, { p: [dish(0) + 0.013, 0, 0], r: [0, 0, -Math.PI / 2] }, 'silver'));
  return s;
}

function lampTextures() {
  const tail = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#160000' : '#3a0406'; g.fillRect(0, 0, w, h);
    g.fillStyle = glow ? '#ffffff' : '#e21818'; g.fillRect(0, h * 0.25, w, h * 0.5);
  };
  const head = (glow) => (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#0c0e11'; g.fillRect(0, 0, w, h);
    g.fillStyle = glow ? '#fff' : '#eaf2f8'; g.fillRect(w * 0.06, h * 0.3, w * 0.88, h * 0.28);
  };
  return { tailMap: canvasTex(128, 32, tail(false)), tailGlow: canvasTex(128, 32, tail(true)), headMap: canvasTex(128, 32, head(false)), headGlow: canvasTex(128, 32, head(true)) };
}
const AW = 512, AH = 256;
const uvr = (x, y, w, h) => [x / AW, 1 - (y + h) / AH, (x + w) / AW, 1 - y / AH];
const A_PLATE = uvr(0, 0, 416, 90), A_NAME = uvr(0, 110, 400, 60);
function atlasTex() {
  return canvasTex(AW, AH, (g) => {
    g.clearRect(0, 0, AW, AH);
    drawPlate(g, 0, 0, 416, 90, '001 RKT');
    g.fillStyle = '#d6d8da'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.font = 'bold 44px Arial, Helvetica, sans-serif';
    'TESLA'.split('').forEach((c, i) => g.fillText(c, 40 + i * 80, 140));
  });
}

export function buildRocket({ scan = true } = {}) {
  const body = buildBody({
    top: [[ZF, 0.4], [ZF + 0.006, 0.47, 0.03], [ZF + 0.12, 0.56, 0.08], [-1.6, 0.67, 0.4], [-0.9, 0.79, 0.2], [-0.76, 0.82, 0.05],
      [0.02, 1.105, 0.2], [0.4, 1.135, 0.6], [1.2, 1.04, 0.5], [1.92, 0.9, 0.2], [ZR - 0.1, 0.87, 0.03], [ZR - 0.03, 0.82, 0.02], [ZR - 0.012, 0.56, 0.05], [ZR, 0.43]],
    bottom: [[ZF, 0.4], [ZF + 0.006, 0.27, 0.03], [ZF + 0.12, 0.16, 0.04], [-1.7, 0.13, 0.1], [1.75, 0.14, 0.1], [ZR - 0.15, 0.25, 0.06], [ZR - 0.006, 0.33, 0.03], [ZR, 0.43]],
    w: [[ZF, 0.8], [-1.9, 0.93], [-HZ, 0.975], [0, 0.955], [HZ, 0.98], [1.95, 0.95], [ZR, 0.88]],
    yWaist: 0.62, tuck: 0.07, ySill: 0.15,
    yBelt: [[ZF, 0.7], [-1.3, 0.76], [0, 0.82], [1.2, 0.88], [ZR, 0.86]],
    sh: 0.03, ledge: 0.008, ledgeH: 0.02,
    th: [[ZF, 0.3], [-0.76, 0.7], [1.2, 0.75], [1.9, 0.4], [ZR, 0.3]], thc: [[ZF, 0.2], [-0.76, 0.6], [1.2, 0.6], [1.9, 0.2], [ZR, 0.2]],
    rr: [[ZF, 0.05], [-HZ, 0.1], [-0.76, 0.08], [0.4, 0.08], [1.2, 0.1], [HZ, 0.11], [ZR, 0.06]],
    rs: 0.05,
    crown: [[ZF, 0.02], [-HZ, 0.03], [-0.76, 0.03], [0.4, 0.04], [1.9, 0.03], [ZR, 0.02]],
    bow: [[ZF, 0.26], [-1.9, 0.15], [-1.55, 0.05], [-1.0, 0], [1.6, 0], [1.95, 0.08], [ZR, 0.2]],
    bowN: [[ZF, 2.6], [-1.5, 2.4], [1.5, 2.6], [ZR, 3.2]],
  });
  const raw = body.soup, pr = probe(raw);
  const { soup: shell, liner } = cutArches(raw, [{ z: -HZ, y: 0.34, r: 0.385 }, { z: HZ, y: 0.34, r: 0.4 }], { halfWidth: 0.98 });
  const dc = decals(shell);
  const paint = new Soup().add(shell), glass = new Soup(), pal = new Soup().add(liner);
  const tail = new Soup(), reverse = new Soup(), head = new Soup(), atlas = new Soup(), chmsl = new Soup();
  const fr = { filter: (v) => v[2] > 1.6 }, ff = { filter: (v) => v[2] < -1.5 };

  // --- glazing: windscreen running up into a glass roof, a slim side window, the fastback's rear glass
  const dlo = rpoly([[-0.6, 0.86], [0.55, 0.9], [1.05, 0.95], [0.75, 1.02], [0.2, 1.07], [-0.1, 1.04]], 0.03, 3);
  pal.add(dc.side(grow(dlo, 0.012), { offset: 0.003 }).pal('gloss').sym());
  glass.add(dc.side(dlo, { offset: 0.005 }).sym());
  const ws = rpoly([[-0.74, 0.85], [0.74, 0.85], [0.56, 1.1], [-0.56, 1.1]], 0.05);
  pal.add(dc.front(grow(ws, 0.014), { offset: 0.003 }).pal('gloss'));
  glass.add(dc.front(ws, { offset: 0.005 }));
  pal.add(dc.top(rpoly([[-0.5, 0.0], [0.5, 0.0], [0.46, 1.75], [-0.46, 1.75]], 0.06), { offset: 0.004, minFacing: 0.4 }).pal('darkglass'));

  // --- sills, splitter and diffuser in black; shut lines
  pal.add(dc.side([rect(-HZ + 0.36, 0.13, HZ - 0.36, 0.25)], { offset: 0.003, minFacing: 0.1 }).pal('plastic').sym());
  pal.add(dc.front(rect(-0.8, 0.16, 0.8, 0.3, 0.03), { offset: 0.004, minFacing: -0.3, ...ff }).pal('line'));
  pal.add(dc.rear(rect(-0.86, 0.22, 0.86, 0.48), { offset: 0.003, minFacing: -0.3, filter: (v) => v[2] > 1.9 && v[1] < 0.51 }).pal('plastic'));
  const lw = 0.007;
  pal.add(dc.side([...stroke([[-0.72, 0.28], [-0.72, 0.84]], lw), ...stroke([[0.62, 0.28], [0.62, 0.9]], lw), ...stroke([[-0.72, 0.28], [0.62, 0.28]], lw)], { offset: 0.0055 }).pal('line').sym());

  // --- full-width tail light bar, the lettering under it, the plate under that, over the nozzles in the diffuser
  tail.add(dc.rear(rect(-0.86, 0.745, 0.86, 0.785, 0.01), { offset: 0.005, ...fr }));
  chmsl.add(dc.rear(rect(-0.2, 0.8, 0.2, 0.812, 0.004), { offset: 0.005, minFacing: 0.1, ...fr }));
  reverse.add(dc.rear(rect(0.6, 0.71, 0.8, 0.73, 0.005), { offset: 0.006, ...fr }).sym());
  atlas.add(dc.rear(rect(-0.22, 0.66, 0.22, 0.715), { offset: 0.0065, ...fr }).uvRect(A_NAME));
  const pl = plate([0, 0.575, pr.rearZ(0, 0.575) + 0.01], A_PLATE, { tilt: 0.05 });
  atlas.add(pl.face); pal.add(pl.back);

  // --- front: slim lamps, the plate low in the splitter
  const hy = frontYaw(28, -1.95);
  head.add(dc.any(hy)(rpoly([[-0.9, 0.555], [-0.5, 0.535], [-0.5, 0.57], [-0.88, 0.6]], 0.008), { offset: 0.005, minFacing: 0.03, box: [-0.5, 0.535, -0.9, 0.6], ...ff }));
  head.add(head.mirrored());
  const fp = plate([0, 0.36, pr.frontZ(0, 0.36) - 0.01], A_PLATE, { front: true, tilt: 0.06 });
  atlas.add(fp.face); pal.add(fp.back);

  // --- mirrors
  const mx = pr.sideX(-0.62, 0.9);
  pal.add(blob(0.2, 0.09, 0.09, { p: [mx + 0.09, 0.93, -0.62] }, 'gloss', 3.5).sym());

  // --- the nozzles: a dark bell for each, set into the tail, the floor and the sills (on this body's own skin: the
  // scan's tail is longer and its sills higher)
  for (const [x, y0, z0, dx, dy] of ROCKET_NOZZLES) {
    const y = dy ? Math.min(y0, 0.15) : y0, z = !dx && !dy ? pr.rearZ(x, y) - 0.03 : z0;
    const r = dy ? [0, 0, 0] : dx ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
    const big = !dx && !dy;
    pal.add(cyl(big ? 0.075 : 0.05, big ? 0.05 : 0.035, 0.06, 14, { p: [x - dx * 0.01, y - dy * 0.01, z - (big ? 0.01 : 0)], r }, 'darkalloy', true));
    pal.add(cyl(big ? 0.048 : 0.033, big ? 0.048 : 0.033, 0.01, 12, { p: [x - dx * 0.035, y - dy * 0.035, z - (big ? 0.035 : 0)], r }, 'well'));
  }
  // (the shroud the four tail nozzles sit in)
  pal.add(box(0.94, 0.17, 0.05, { p: [0, 0.36, pr.rearZ(0, 0.36) - 0.02] }, 'gloss'));

  const wheel = { soup: aeroSix(DIMS.wheelRadius, 0.325, 0.254) }, wheelFront = { soup: aeroSix(DIMS.wheelRadiusFront, 0.245, 0.2413) };
  const car = assembleCar({ id: 'rocket', dims: DIMS, parts: { paint, glass, pal, tail, chmsl, reverse, head, atlas }, tex: { ...lampTextures(), atlas: atlasTex() }, wheel, wheelFront });
  tintPaint(car, 'rocket', 0xdadde0, { metalness: 0.6, roughness: 0.26, clearcoatRoughness: 0.04 });
  if (!scan) return car;
  // the scan's wells are open on the inside where its tyres were fused to the floor: the arch liners close them.
  // The red light bar glows a little with the lights on (Tesla's photo), brightly on the brakes.
  return useGlbBody(car, 'rocket.glb', { liner: { r: 0.5, len: 0.4, inset: 0.1, gap: 0.02 }, tail: 0.45, brake: 2.2 });
}
