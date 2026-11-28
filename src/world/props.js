// Street furniture at the places where Mapillary detected it in street photos (CC BY-SA):
// street lights, poles, traffic lights and signs, benches, bins, bike racks, cabinets and zebra crossings.
// Everything in a sector is merged into a handful of meshes. Driving into a prop knocks it loose: it is
// cut out of the merged mesh and flies off as its own rigid body (see knock() below). Knocked props stay
// where they came to rest for the rest of the browser session (sessionStorage) and are back next time.
// Poles and signs lying on the road are driven over with a small thump rather than pushed along, and
// sometimes snap into two or three pieces, on the first impact or when a wheel rolls over them later.
import * as THREE from 'three';
import { stats } from '../stats.js';
import { greyBack } from './signback.js';
import { jobs } from '../jobs.js';
import { DATA } from '../city.js';

const LIGHT = 0, POLE = 1, SIGNAL = 2, BENCH = 3, BIN = 4, RACK = 5, BOX = 6, ZEBRA = 7, BOLLARD = 8, LANTERN = 9, SIGN0 = 10;
const FACES = 24;
// kinds past the sign faces: the white and blue striped post at raised crossings (Veski by Mandel)
const STRIPED = 40;
// Raadi park lamp (the rally stage, Martin's photo of 24 Nov): a slim galvanised pole of 6 m with a short
// arm and a flat head; PARKBIN is the one with the red dog-waste bin on it, by the pond
const PARK = 41, PARKBIN = 42;
// Narva mnt beside the Raadi rally start (Martin 26 Nov, his Street View shots and Mapillary's of May 2024,
// src/world/raadistart.js): the tall galvanised road lamp of 10 m with its long bent arm, the crossing's lamp with
// two short arms (one at the top, one half way up), the short post with a small head that lights a crossing from
// its island, and the blue and white striped post that carries a round blue sign on a traffic island's nose
// (keep right, pass either side)
const ROADLAMP = 43, CROSSLAMP = 44, ISLELAMP = 45, KEEPPOST = 46, EITHERPOST = 47;
// Küüni's park stretch past the first corner (Martin 27 Nov, "make them hittable", src/world/kuuni.js): the street's
// benches, the yellow kvass trailer by the Poe corner, the umbrella over its table and the stools under it
const KUUNIBENCH = 48, KVASS = 49, PARASOL = 50, STOOL = 51;
// The Pirita-Kose lap as raced in the 2000s (Martin 28 Nov 2026, an onboard lap of the 2005 race, src/world/tln/pirita.js):
// a tall yellow board on the outside before each big corner, a black hooked line on it showing which way the road goes
// (up from the foot and over at the top: CHEVL for a left-hander, CHEVR for a right). Plywood on two stubs: knocked flat.
const CHEVL = 52, CHEVR = 53;
const isSign = (kind) => kind >= SIGN0 && kind < SIGN0 + FACES;

function part(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  return { pos: g.attributes.position.array, nor: g.attributes.normal.array, uv: g.attributes.uv?.array, col: [c.r, c.g, c.b] };
}
const box = (w, h, d, x, y, z, hex) => part(new THREE.BoxGeometry(w, h, d).translate(x, y, z), hex);
const cyl = (r, h, x, y, z, hex, sides = 6) => part(new THREE.CylinderGeometry(r * 0.8, r, h, sides, 1, true).translate(x, y, z), hex);
// a square bar t thick from (y0, z0) to (y1, z1) in the plane the lamp's arm lies in
const beam = (y0, z0, y1, z1, t, hex) => part(new THREE.BoxGeometry(t, t, Math.hypot(y1 - y0, z1 - z0) + t * 0.6).rotateX(-Math.atan2(y1 - y0, z1 - z0)).translate(0, (y0 + y1) / 2, (z0 + z1) / 2), hex);
const GALV = 0xa9adb5, HEAD = 0x7c8089;

// local axes: +z is "forward" (towards the road for lights, the facing of a sign)
const SOLID = {
  [LIGHT]: [cyl(0.09, 8.2, 0, 4.1, 0, 0x55525e), box(0.09, 0.09, 1.9, 0, 8.15, 0.9, 0x55525e), box(0.3, 0.12, 0.7, 0, 8.08, 1.75, 0x3a3842)],
  [POLE]: [cyl(0.12, 8.5, 0, 4.25, 0, 0x5a4636)],
  [SIGNAL]: [cyl(0.07, 3.4, 0, 1.7, 0, 0x4a4852), box(0.32, 0.95, 0.28, 0, 3.0, 0.1, 0x16151a)],
  [BENCH]: [box(1.7, 0.08, 0.45, 0, 0.45, 0, 0x7a5230), box(1.7, 0.4, 0.06, 0, 0.75, -0.22, 0x7a5230), box(0.08, 0.45, 0.4, -0.75, 0.22, 0, 0x33323a), box(0.08, 0.45, 0.4, 0.75, 0.22, 0, 0x33323a)],
  [BIN]: [cyl(0.24, 0.85, 0, 0.43, 0, 0x2d4a3c, 8)],
  [RACK]: [box(1.6, 0.05, 0.05, 0, 0.8, 0, 0x8a8a94), box(0.05, 0.8, 0.05, -0.78, 0.4, 0, 0x8a8a94), box(0.05, 0.8, 0.05, 0.78, 0.4, 0, 0x8a8a94), box(0.05, 0.8, 0.05, 0, 0.4, 0, 0x8a8a94)],
  [BOX]: [box(0.8, 1.15, 0.35, 0, 0.58, 0, 0x7d8a84)],
  // short black street bollard with a reflective band
  [BOLLARD]: [cyl(0.075, 0.82, 0, 0.41, 0, 0x16161b, 8), cyl(0.08, 0.07, 0, 0.7, 0, 0xd8dde6, 8), cyl(0.09, 0.05, 0, 0.84, 0, 0x16161b, 8)],
  // white and blue striped square post with a dark cap, 0.93 m (the raised crossing before Mandel)
  [STRIPED]: [...Array.from({ length: 7 }, (_, k) => box(0.13, 0.13, 0.13, 0, 0.065 + k * 0.13, 0, k % 2 ? 0xfaf8ff : 0x2f5fb8)), box(0.15, 0.04, 0.15, 0, 0.93, 0, 0x26252b)],
  // old town lantern on a slim black post (Vallikraavi): light, falls at a touch
  [LANTERN]: [cyl(0.075, 3.3, 0, 1.65, 0, 0x24232a, 8), cyl(0.13, 0.5, 0, 0.25, 0, 0x24232a, 8),
    part(new THREE.CylinderGeometry(0.13, 0.2, 0.36, 4).rotateY(Math.PI / 4).translate(0, 3.47, 0), 0x24232a),
    part(new THREE.ConeGeometry(0.24, 0.2, 4).rotateY(Math.PI / 4).translate(0, 3.81, 0), 0x24232a)],
  sign: [cyl(0.035, 2.9, 0, 1.45, 0, 0x8a8a94, 5)],
  [PARK]: [cyl(0.065, 6, 0, 3, 0, 0x9c9fa8, 6), box(0.05, 0.05, 0.4, 0, 5.97, 0.18, 0x9c9fa8), box(0.17, 0.08, 0.5, 0, 5.98, 0.6, 0x8e9099)],
  BIN: [cyl(0.17, 0.5, 0, 0.72, 0.2, 0xc8261e, 8), cyl(0.18, 0.07, 0, 1.0, 0.2, 0x1b1a1f, 8)],
};
SOLID[PARKBIN] = [...SOLID[PARK], ...SOLID.BIN];
SOLID[ROADLAMP] = [cyl(0.105, 10, 0, 5, 0, GALV, 8), beam(9.95, 0, 10.5, 0.3, 0.08, GALV), beam(10.5, 0.3, 10.74, 0.95, 0.08, GALV), beam(10.74, 0.95, 10.8, 2.3, 0.07, GALV), box(0.26, 0.09, 0.72, 0, 10.79, 2.6, HEAD)];
SOLID[CROSSLAMP] = [cyl(0.105, 10, 0, 5, 0, GALV, 8), beam(9.9, 0, 10.2, 1.25, 0.07, GALV), box(0.24, 0.09, 0.6, 0, 10.22, 1.5, HEAD), beam(5.6, 0, 5.88, 1.1, 0.07, GALV), box(0.24, 0.09, 0.6, 0, 5.9, 1.35, HEAD)];
SOLID[ISLELAMP] = [cyl(0.075, 6, 0, 3, 0, GALV, 8), box(0.2, 0.09, 0.62, 0, 6.03, 0.12, HEAD)];
// (seven bands of 0.17 m and a dark cap: 1.25 m, the round plate sits on top of it)
const stripedPost = [...Array.from({ length: 7 }, (_, k) => box(0.11, 0.17, 0.11, 0, 0.085 + k * 0.17, 0, k % 2 ? 0xf6f5f9 : 0x2a5cc0)), box(0.05, 0.3, 0.05, 0, 1.33, 0, 0x8a8a94)];
SOLID[KEEPPOST] = stripedPost; SOLID[EITHERPOST] = stripedPost;
// (the bench faces +z, its length along x; the trailer's and the umbrella's +z points to the Poe corner)
SOLID[KUUNIBENCH] = [box(2.0, 0.06, 0.45, 0, 0.45, 0.05, 0xa8806e), box(2.0, 0.44, 0.06, 0, 0.7, -0.2, 0xa8806e), box(0.08, 0.44, 0.5, -0.85, 0.22, 0, 0x34313f), box(0.08, 0.44, 0.5, 0.85, 0.22, 0, 0x34313f)];
SOLID[KVASS] = [
  part(new THREE.CylinderGeometry(1.0, 1.0, 3.4, 20, 1, true).rotateX(Math.PI / 2).translate(0, 1.55, 0), 0xf6c048),
  ...[-1.7, 1.7].map((z) => part(new THREE.SphereGeometry(1.0, 16, 10).scale(1, 1, 0.35).translate(0, 1.55, z), 0xf6c048)),
  box(1.6, 0.15, 3.6, 0, 0.525, 0, 0x4a4652),                                       // the chassis
  ...[-0.85, 0.85].map((x) => part(new THREE.CylinderGeometry(0.36, 0.36, 0.18, 14).rotateZ(Math.PI / 2).translate(x, 0.36, 0), 0x2a2830)),
  box(0.12, 0.1, 1.6, 0, 0.5, 2.6, 0x4a4652),                                       // the drawbar
  box(0.12, 0.6, 0.6, 0.95, 1.4, -1.2, 0xd9d4e0),                                   // the tap box
];
SOLID[PARASOL] = [part(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 6, 1, true).translate(0, 1.2, 0), 0xe8e4ee), part(new THREE.ConeGeometry(1.5, 0.55, 8).translate(0, 2.45, 0), 0xe84a4a),
  box(0.7, 0.04, 0.7, 0, 0.74, 0, 0xe8e4ee), box(0.36, 0.04, 0.36, 0, 0.02, 0, 0x4c4858)];
const chevron = (side) => [box(0.9, 2.1, 0.05, 0, 1.2, 0, 0xf0b416), box(0.08, 0.16, 0.06, -0.3, 0.08, 0, 0x2a2a2e), box(0.08, 0.16, 0.06, 0.3, 0.08, 0, 0x2a2a2e),
  box(0.085, 1.5, 0.012, 0.19 * side, 1.18, 0.031, 0x141316), box(0.52, 0.085, 0.012, -0.03 * side, 1.9, 0.031, 0x141316)];
SOLID[CHEVL] = chevron(1); SOLID[CHEVR] = chevron(-1);
SOLID[STOOL] = [box(0.42, 0.04, 0.42, 0, 0.46, 0, 0x4c4858), part(new THREE.CylinderGeometry(0.035, 0.035, 0.44, 6, 1, true).translate(0, 0.22, 0), 0x4c4858), box(0.3, 0.03, 0.3, 0, 0.015, 0, 0x4c4858)];
const GLOW = {
  [LIGHT]: box(0.24, 0.05, 0.6, 0, 8.0, 1.75, 0xffe2a8),
  [LANTERN]: box(0.16, 0.16, 0.16, 0, 3.5, 0, 0xffe2a8),
  [PARK]: box(0.13, 0.02, 0.4, 0, 5.93, 0.62, 0xfff0d0),
};
GLOW[PARKBIN] = GLOW[PARK];
GLOW[ROADLAMP] = [box(0.2, 0.03, 0.6, 0, 10.73, 2.6, 0xfff0d0)];
GLOW[CROSSLAMP] = [box(0.18, 0.03, 0.5, 0, 10.16, 1.5, 0xfff0d0), box(0.18, 0.03, 0.5, 0, 5.84, 1.35, 0xfff0d0)];
GLOW[ISLELAMP] = [box(0.15, 0.03, 0.5, 0, 5.97, 0.12, 0xfff0d0)];
const POOL = part(new THREE.PlaneGeometry(13, 13).rotateX(-Math.PI / 2).translate(0, 0.07, 1.75), 0xffffff);
// the pool of light under each kind of lamp that has one (the taller the lamp, the wider)
const POOLS = {
  [LIGHT]: POOL,
  [ROADLAMP]: part(new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2).translate(0, 0.07, 2.6), 0xffffff),
  [CROSSLAMP]: part(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2).translate(0, 0.07, 1.5), 0xffffff),
};
const PLATE = part(new THREE.PlaneGeometry(0.72, 0.72).translate(0, 2.5, 0.05), 0xffffff);
// kinds that are a post of their own with one sign face on it: [atlas column, how far below the usual 2.5 m]
const FACED = { [KEEPPOST]: [13, 0.92], [EITHERPOST]: [22, 0.92] };

// Poles can snap. Each pole-like kind is its shaft (radius at the foot, height, colour, sides) plus the
// parts that sit on top of it and go with the top piece when it breaks.
const SHAFT = {
  [LIGHT]: { r: 0.09, h: 8.2, hex: 0x55525e, sides: 6, top: SOLID[LIGHT].slice(1), glow: [GLOW[LIGHT]] },
  [POLE]: { r: 0.12, h: 8.5, hex: 0x5a4636, sides: 6, top: [] },
  [SIGNAL]: { r: 0.07, h: 3.4, hex: 0x4a4852, sides: 6, top: SOLID[SIGNAL].slice(1) },
  [LANTERN]: { r: 0.075, h: 3.3, hex: 0x24232a, sides: 8, top: SOLID[LANTERN].slice(1), glow: [GLOW[LANTERN]] },
  sign: { r: 0.035, h: 2.9, hex: 0x8a8a94, sides: 5, top: [], plate: true },
  [PARK]: { r: 0.065, h: 6, hex: 0x9c9fa8, sides: 6, top: SOLID[PARK].slice(1), glow: [GLOW[PARK]] },
};
// (low: parts fixed to the foot of the pole, which stay with the bottom piece when it snaps)
SHAFT[PARKBIN] = { ...SHAFT[PARK], low: SOLID.BIN };
for (const [k, r, h] of [[ROADLAMP, 0.105, 10], [CROSSLAMP, 0.105, 10], [ISLELAMP, 0.075, 6]]) SHAFT[k] = { r, h, hex: GALV, sides: 8, top: SOLID[k].slice(1), glow: GLOW[k] };
const shaftOf = (kind) => (isSign(kind) ? SHAFT.sign : SHAFT[kind]);
// the stretch of a shaft between heights y0 and y1 (it tapers to 0.8 of its radius at the top)
function shaftPiece(sh, y0, y1) {
  const r = (y) => sh.r * (1 - 0.2 * y / sh.h);
  return part(new THREE.CylinderGeometry(r(y1), r(y0), y1 - y0, sh.sides, 1, true).translate(0, (y0 + y1) / 2, 0), sh.hex);
}

// sign faces in one strip: speed, prohibit, no entry, mandatory, warning, yield, priority, crossing, info, stop,
// speed 40, parking, speed 30, keep right, 20 km/h zone, no parking zone, steep hill (%), children, no stopping,
// no parking, bus stop
function signAtlas() {
  const S = 96, cv = document.createElement('canvas');
  cv.width = S * FACES; cv.height = S;
  const c = cv.getContext('2d');
  const at = (i) => { c.setTransform(1, 0, 0, 1, i * S + S / 2, S / 2); };
  const disc = (r, fill) => { c.beginPath(); c.arc(0, 0, r, 0, 7); c.fillStyle = fill; c.fill(); };
  const poly = (pts, fill) => { c.beginPath(); pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = fill; c.fill(); };
  const red = '#d6263c', blue = '#1f55b5', white = '#f4f2f0', yellow = '#f5c228';
  at(0); disc(44, red); disc(33, white); c.fillStyle = '#18161c'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('50', 0, 2);
  at(1); disc(44, red); disc(33, white); c.rotate(-0.78); c.fillStyle = red; c.fillRect(-36, -5, 72, 10);
  at(2); disc(44, red); c.fillStyle = white; c.fillRect(-30, -8, 60, 16);
  at(3); disc(44, blue); poly([[0, -28], [20, -2], [8, -2], [8, 28], [-8, 28], [-8, -2], [-20, -2]], white);
  at(4); poly([[0, -44], [46, 38], [-46, 38]], red); poly([[0, -24], [28, 28], [-28, 28]], white); c.fillStyle = '#18161c'; c.fillRect(-3, -6, 6, 20); c.fillRect(-3, 18, 6, 6);
  at(5); poly([[-46, -38], [46, -38], [0, 44]], red); poly([[-28, -27], [28, -27], [0, 24]], white);
  at(6); poly([[0, -46], [46, 0], [0, 46], [-46, 0]], white); poly([[0, -32], [32, 0], [0, 32], [-32, 0]], yellow);
  at(7); c.fillStyle = blue; c.fillRect(-42, -42, 84, 84); poly([[0, -30], [32, 28], [-32, 28]], white); c.fillStyle = '#18161c'; c.fillRect(-4, -8, 8, 22); disc(0, '#000'); c.beginPath(); c.arc(0, -14, 5, 0, 7); c.fill();
  at(8); c.fillStyle = blue; c.fillRect(-42, -42, 84, 84); c.fillStyle = white; c.font = 'bold 54px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('i', 0, 4);
  at(9); poly([[-19, -46], [19, -46], [46, -19], [46, 19], [19, 46], [-19, 46], [-46, 19], [-46, -19]], red); c.fillStyle = white; c.font = 'bold 26px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('STOP', 0, 2);
  at(10); disc(44, red); disc(33, white); c.fillStyle = '#18161c'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('40', 0, 2);
  at(11); c.fillStyle = blue; c.fillRect(-40, -44, 80, 88); c.fillStyle = white; c.font = 'bold 62px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('P', 0, 4);
  at(13); disc(44, blue); c.rotate(Math.PI * 0.75); poly([[0, -30], [20, -4], [8, -4], [8, 28], [-8, 28], [-8, -4], [-20, -4]], white); c.setTransform(1, 0, 0, 1, 0, 0);
  for (const k of [14, 15]) {                    // zone signs: a white board, ALA over the roundel
    at(k); c.fillStyle = '#18161c'; c.fillRect(-38, -47, 76, 94); c.fillStyle = white; c.fillRect(-35, -44, 70, 88);
    c.fillStyle = '#18161c'; c.font = 'bold 17px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ALA', 0, -33);
    c.setTransform(1, 0, 0, 1, k * S + S / 2, S / 2 + 9);
    if (k === 14) { disc(30, red); disc(22, white); c.fillStyle = '#18161c'; c.font = 'bold 25px sans-serif'; c.fillText('20', 0, 1); }
    else { disc(30, red); disc(23, blue); c.rotate(0.78); c.fillStyle = red; c.fillRect(-4, -26, 8, 52); c.setTransform(1, 0, 0, 1, 0, 0); }
  }
  // steep climb: the wedge of a hill and the per cent sign
  at(16); poly([[0, -44], [46, 38], [-46, 38]], red); poly([[0, -24], [28, 28], [-28, 28]], white); poly([[-20, 24], [16, 24], [16, 4]], '#18161c'); c.fillStyle = '#18161c'; c.font = 'bold 15px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('12%', -3, 5);
  // children: two running figures
  at(17); poly([[0, -44], [46, 38], [-46, 38]], red); poly([[0, -24], [28, 28], [-28, 28]], white);
  for (const [fx, fh] of [[-7, 1], [8, 0.8]]) { c.fillStyle = '#18161c'; c.beginPath(); c.arc(fx, 2 - 9 * fh, 4 * fh, 0, 7); c.fill(); poly([[fx - 3 * fh, 6 - 4 * fh], [fx + 4 * fh, 6 - 4 * fh], [fx + 5 * fh, 16], [fx + 9 * fh, 25], [fx + 5 * fh, 25], [fx, 17], [fx - 6 * fh, 25], [fx - 9 * fh, 24], [fx - 3 * fh, 14]], '#18161c'); }
  // no stopping (cross) and no parking (one bar)
  at(18); disc(44, red); disc(34, blue); c.fillStyle = red; c.rotate(0.785); c.fillRect(-36, -5, 72, 10); c.rotate(-1.57); c.fillRect(-36, -5, 72, 10);
  at(19); disc(44, red); disc(34, blue); c.fillStyle = red; c.rotate(0.785); c.fillRect(-36, -5, 72, 10);
  // bus stop
  at(20); c.fillStyle = blue; c.fillRect(-40, -44, 80, 88); c.fillStyle = white; c.fillRect(-27, -30, 54, 60); c.fillStyle = '#18161c'; c.fillRect(-20, -18, 40, 30); c.fillStyle = white; c.fillRect(-16, -14, 32, 12); c.fillStyle = '#18161c'; c.beginPath(); c.arc(-11, 15, 5, 0, 7); c.arc(11, 15, 5, 0, 7); c.fill();
  at(12); disc(44, red); disc(33, white); c.fillStyle = '#18161c'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('30', 0, 2);
  // shared path for walkers and cyclists: a walker over a bicycle
  at(21); disc(44, blue); c.fillStyle = white;
  c.beginPath(); c.arc(0, -31, 4.5, 0, 7); c.fill(); poly([[-4, -25], [4, -25], [5, -15], [9, -5], [5, -5], [0, -13], [-5, -5], [-9, -5], [-5, -15]], white);
  c.strokeStyle = white; c.lineWidth = 3.5;
  for (const wx of [-13, 13]) { c.beginPath(); c.arc(wx, 22, 9, 0, 7); c.stroke(); }
  c.beginPath(); c.moveTo(-13, 22); c.lineTo(-4, 9); c.lineTo(8, 9); c.lineTo(13, 22); c.moveTo(-4, 9); c.lineTo(2, 22); c.lineTo(8, 9); c.moveTo(-7, 6); c.lineTo(-1, 6); c.moveTo(8, 9); c.lineTo(10, 5); c.lineTo(15, 5); c.stroke();
  // pass on either side: two arrows slanting down and apart
  at(22); disc(44, blue);
  for (const k of [-1, 1]) { c.setTransform(1, 0, 0, 1, 22 * S + S / 2, S / 2); c.translate(k * 15, 2); c.rotate(Math.PI - k * 0.6); poly([[0, -27], [15, -6], [6, -6], [6, 22], [-6, 22], [-6, -6], [-15, -6]], white); }
  // lanes ahead (Narva mnt before the Raadi crossing): a white board, straight on from one lane, the other joins it
  at(23); c.fillStyle = '#18161c'; c.fillRect(-40, -44, 80, 88); c.fillStyle = white; c.fillRect(-37, -41, 74, 82);
  poly([[-16, -32], [-4, -14], [-12, -14], [-12, 32], [-20, 32], [-20, -14], [-28, -14]], '#18161c');
  poly([[20, 32], [12, 32], [12, 4], [-2, -8], [-2, 0], [-10, -18], [10, -20], [4, -14], [20, 0]], '#18161c');
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function poolTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,214,150,0.55)'); g.addColorStop(0.4, 'rgba(255,170,150,0.2)'); g.addColorStop(1, 'rgba(255,120,200,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class Batch {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.uv = []; }
  add(p, x, y, z, cs, sn, uOff = 0, uScale = 1, tint = null) {
    const { pos, nor, uv } = p, col = tint || p.col;
    for (let i = 0; i < pos.length; i += 3) {
      this.pos.push(x + pos[i] * cs + pos[i + 2] * sn, y + pos[i + 1], z - pos[i] * sn + pos[i + 2] * cs);
      this.nor.push(nor[i] * cs + nor[i + 2] * sn, nor[i + 1], -nor[i] * sn + nor[i + 2] * cs);
      this.col.push(col[0], col[1], col[2]);
    }
    if (uv) for (let i = 0; i < uv.length; i += 2) this.uv.push(uOff + uv[i] * uScale, uv[i + 1]);
  }
  mesh(mat, withUv) {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (withUv) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    const m = new THREE.Mesh(g, mat);
    m.matrixAutoUpdate = false;
    return m;
  }
}

// physical guesses per kind: mass (kg) and how far from its centre line the car touches it (m)
const MASS = { [ROADLAMP]: 190, [CROSSLAMP]: 195, [ISLELAMP]: 70, [KEEPPOST]: 16, [EITHERPOST]: 16, [LIGHT]: 140, [POLE]: 250, [SIGNAL]: 90, [BENCH]: 45, [BIN]: 20, [RACK]: 30, [BOX]: 70, [BOLLARD]: 12, [LANTERN]: 9, [STRIPED]: 14, [PARK]: 60, [PARKBIN]: 65, [KUUNIBENCH]: 45, [KVASS]: 600, [PARASOL]: 20, [STOOL]: 6, [CHEVL]: 22, [CHEVR]: 22, sign: 10 };
const REACH = { [ROADLAMP]: 0.13, [CROSSLAMP]: 0.13, [ISLELAMP]: 0.1, [KEEPPOST]: 0.1, [EITHERPOST]: 0.1, [LIGHT]: 0.12, [POLE]: 0.15, [SIGNAL]: 0.12, [BENCH]: 0.75, [BIN]: 0.25, [RACK]: 0.75, [BOX]: 0.4, [BOLLARD]: 0.09, [LANTERN]: 0.09, [STRIPED]: 0.1, [PARK]: 0.08, [PARKBIN]: 0.1, [PARASOL]: 0.35, [STOOL]: 0.21, [CHEVL]: 0.12, [CHEVR]: 0.12, sign: 0.08 };
// long things the car meets along their length, not only at their middle: points in the prop's own frame
// [x, z, reach] (a 4 m trailer would otherwise be touched as a square)
const SPAN = {
  [KUUNIBENCH]: [[-0.6, 0, 0.4], [0.6, 0, 0.4]],
  [KVASS]: [[0, -1.3, 1.0], [0, 0, 1.0], [0, 1.3, 1.0], [0, 2.9, 0.2]],
  [CHEVL]: [[-0.32, 0, 0.12], [0.32, 0, 0.12]], [CHEVR]: [[-0.32, 0, 0.12], [0.32, 0, 0.12]],
};
// heavy and low on its wheels: a knock low down turns it over less than it would a bench (1 = as a bench)
const TUMBLE = { [KVASS]: 0.35 };
// a point of a span, in the world, for a prop standing at (x, z) turned by (cs, sn)
const spanX = (x, cs, sn, q) => x + q[0] * cs + q[1] * sn, spanZ = (z, cs, sn, q) => z - q[0] * sn + q[1] * cs;
// thin poles that snap on most hits (the Raadi park lamps, Martin 24 Nov: "should then break. Not very thick posts")
const THIN = { [PARK]: 1, [PARKBIN]: 1 };
const KNOCK_KEY = 'streetlap.knocked';
const G = 9.81;

function loadKnocked() {
  try { return JSON.parse(sessionStorage.getItem(KNOCK_KEY)) || {}; } catch { return {}; }
}

export function createProps(world, opts = {}) {
  let data = null, cleared = new Set();
  const knocked = loadKnocked();              // id -> rest pose [x, y, z, qx, qy, qz, qw] (or 1 while flying)
  const live = new Map();                     // sector key -> { entries, meshes, group }
  const moving = new Set();                   // loose bodies still in motion
  let saveTimer = 0;
  const waiting = [];
  const solidMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  // sign plates face one way: from behind they are grey metal, but for the bus stop sign (atlas column 20),
  // which stands across the pavement with its face on both sides
  const signMat = greyBack(new THREE.MeshLambertMaterial({ map: signAtlas(), alphaTest: 0.5 }), { twoSidedU: [20 / FACES, 21 / FACES] });
  const paintMat = new THREE.MeshLambertMaterial({ color: 0xdedbe6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const red = [1, 0.16, 0.2], green = [0.2, 1, 0.55], amber = [1, 0.7, 0.2];
  const lamp = box(0.2, 0.2, 0.06, 0, 0, 0, 0xffffff);

  // (in steps: a square of the centre has a few hundred posts, lamps and signs, 20 ms of this on a fast
  // processor and 100 on an old one. Null when the square was unloaded meanwhile.)
  function* buildSteps(sector) {
    const a = data.sectors[`${sector.sx}_${sector.sz}`];
    if (!a) return null;
    const H = sector.H;
    const solid = new Batch(), glow = new Batch(), pool = new Batch(), sign = new Batch(), paint = new Batch();
    const entries = [], rest = [];
    const mark = () => [solid.pos.length / 3, glow.pos.length / 3, pool.pos.length / 3, sign.pos.length / 3];
    const S = world.meta.sector.size;
    const hAt = (x, z) => world.topAt(Math.min(Math.max(x, sector.x0 + 0.01), sector.x0 + S - 0.01), Math.min(Math.max(z, sector.z0 + 0.01), sector.z0 + S - 0.01));
    for (let i = 0; i < a.length; i += data.stride) {
      if (i % (data.stride * 16) === 0 && i && jobs.late()) { yield; if (sector.state !== 'ready' || sector.H !== H) return null; }
      const kind = a[i], x = a[i + 1], z = a[i + 2], yaw = a[i + 3] * Math.PI / 180, extra = a[i + 4];
      // local +z points along the compass bearing "yaw" (0 = north = -z in the world)
      const cs = -Math.cos(yaw), sn = Math.sin(yaw);
      const y = hAt(x, z);
      const id = `${sector.sx}_${sector.sz}:${i / data.stride}`;
      if (kind !== ZEBRA) {
        if (cleared.has(id)) continue;
        if (knocked[id]) { rest.push({ id, kind, x, y, z, cs, sn, lift: isSign(kind) ? (extra || 0) * 0.1 : 0 }); continue; }
      }
      const m0 = kind === ZEBRA ? null : mark();
      if (kind === ZEBRA) {
        if (cleared.has(id)) continue;            // a hand-made place paints its own crossings (src/race/lai.js)
        const w = extra || 7, fx = Math.sin(yaw), fz = -Math.cos(yaw);       // along the road
        for (let s = -w / 2 + 0.5; s <= w / 2 - 0.5; s += 1.0) {
          const cx = x - fz * s, cz = z + fx * s;
          const q = [[-2, -0.25], [2, -0.25], [-2, 0.25], [2, 0.25]].map(([l, t]) => {
            const px = cx + fx * l - fz * t, pz = cz + fz * l + fx * t;
            return [px, hAt(px, pz) + 0.055, pz];
          });
          for (const k of [0, 2, 1, 1, 2, 3]) { paint.pos.push(...q[k]); paint.nor.push(0, 1, 0); paint.col.push(1, 1, 1); }
        }
        continue;
      }
      if (isSign(kind)) {
        for (const p of SOLID.sign) solid.add(p, x, y, z, cs, sn);
        sign.add(PLATE, x, y + (extra || 0) * 0.1, z, cs, sn, (kind - SIGN0) / FACES, 1 / FACES);      // extra: the plate sits that many dm higher (signs sharing a post)
        entries.push({ id, kind, x, y, z, cs, sn, lift: (extra || 0) * 0.1, r0: m0, r1: mark(), gone: false });
        continue;
      }
      for (const p of SOLID[kind] || []) solid.add(p, x, y, z, cs, sn);
      if (FACED[kind]) sign.add(PLATE, x, y - FACED[kind][1], z, cs, sn, FACED[kind][0] / FACES, 1 / FACES);
      if (POOLS[kind]) {
        for (const g of [GLOW[kind]].flat()) glow.add(g, x, y, z, cs, sn);
        if (opts.pools !== false) pool.add(POOLS[kind], x, y, z, cs, sn);
      } else if (kind === LANTERN || kind === PARK || kind === PARKBIN || kind === ISLELAMP) {
        for (const g of [GLOW[kind]].flat()) glow.add(g, x, y, z, cs, sn);
      } else if (kind === SIGNAL) {
        const r = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
        const on = r < 0.45 ? 0 : r < 0.9 ? 2 : 1;
        [red, amber, green].forEach((c, k) => {
          const dim = k === on ? 1.6 : 0.12;
          const lx = 0, ly = 3.3 - k * 0.3, lz = 0.25;
          glow.add(lamp, x + lx * cs + lz * sn, y + ly, z - lx * sn + lz * cs, cs, sn, 0, 1, [c[0] * dim, c[1] * dim, c[2] * dim]);
        });
      }
      entries.push({ id, kind, x, y, z, cs, sn, r0: m0, r1: mark(), gone: false });
    }
    if (jobs.late(3)) { yield; if (sector.state !== 'ready' || sector.H !== H) return null; }
    const group = new THREE.Group();
    const meshes = [solid.mesh(solidMat), glow.mesh(glowMat), pool.mesh(poolMat, true), sign.mesh(signMat, true), paint.mesh(paintMat)];
    meshes.forEach((m, k) => {
      if (!m) return;
      if (k === 0) m.castShadow = !!opts.shadows;
      if (k === 4) m.receiveShadow = true;
      if (k === 2) m.renderOrder = 2;
      group.add(m);
    });
    const key = `${sector.sx}_${sector.sz}`;
    const rec = { entries, meshes, group, loose: [] };
    live.set(key, rec);
    // props knocked earlier this session lie where they came to rest
    const lay = (b, pose) => {
      if (Array.isArray(pose)) { b.obj.position.fromArray(pose, 0); b.obj.quaternion.fromArray(pose, 3); }
      else b.obj.visible = false;
      b.asleep = true;
    };
    for (const e of rest) {
      const k = knocked[e.id];
      if (k && k.cuts) {
        const ys = [0, ...k.cuts, shaftOf(e.kind).h];
        for (let i = 0; i + 1 < ys.length; i++) lay(makeBody(e, rec, { y0: ys[i], y1: ys[i + 1], idx: i }), k.p[i]);
      } else lay(makeBody(e, rec), k);
    }
    group.userData.dispose = () => {
      for (const m of meshes) m?.geometry.dispose();
      for (const b of rec.loose) { b.geos.forEach((g) => g.dispose()); moving.delete(b); }
      if (live.get(key) === rec) live.delete(key);
    };
    return group;
  }

  // ---- knocked props
  // a loose copy of one prop (or, with piece = { y0, y1, idx }, of the stretch of a snapped pole between
  // those heights), centred on its centre of mass, in its own group inside the sector's group
  function makeBody(e, rec, piece) {
    const solid = new Batch(), glow = new Batch(), sign = new Batch();
    const { kind, cs, sn } = e;
    const sh = shaftOf(kind);
    const y0 = piece ? piece.y0 : 0, y1 = piece ? piece.y1 : sh?.h;
    if (sh) {
      solid.add(shaftPiece(sh, y0, y1), 0, 0, 0, cs, sn);
      if (y0 === 0) for (const p of sh.low || []) solid.add(p, 0, 0, 0, cs, sn);
      if (y1 >= sh.h) {
        for (const p of sh.top) solid.add(p, 0, 0, 0, cs, sn);
        for (const p of sh.glow || []) glow.add(p, 0, 0, 0, cs, sn);
        if (sh.plate) sign.add(PLATE, 0, e.lift || 0, 0, cs, sn, (kind - SIGN0) / FACES, 1 / FACES);
      }
    } else {
      for (const p of SOLID[kind] || []) solid.add(p, 0, 0, 0, cs, sn);
      if (FACED[kind]) sign.add(PLATE, 0, -FACED[kind][1], 0, cs, sn, FACED[kind][0] / FACES, 1 / FACES);
    }
    const obj = new THREE.Group();
    const geos = [];
    const box = new THREE.Box3();
    for (const [b, mat, uv] of [[solid, solidMat, false], [glow, glowMat, false], [sign, signMat, true]]) {
      const m = b.mesh(mat, uv);
      if (!m) continue;
      m.geometry.computeBoundingBox();
      box.union(m.geometry.boundingBox);
      geos.push(m.geometry);
      m.matrixAutoUpdate = true;
      m.castShadow = k0(mat);
      obj.add(m);
    }
    const c = box.getCenter(new THREE.Vector3());
    for (const m of obj.children) m.position.sub(c);
    const corners = [];
    for (const X of [box.min.x, box.max.x]) for (const Y of [box.min.y, box.max.y]) for (const Z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(X - c.x, Y - c.y, Z - c.z));
    obj.position.set(e.x + c.x, e.y + c.y, e.z + c.z);
    rec.group.add(obj);
    const size = box.getSize(new THREE.Vector3());
    const whole = isSign(kind) ? MASS.sign : MASS[kind] || 30;
    const mass = sh && piece ? Math.max(2, whole * ((y1 - y0) / sh.h + (y1 >= sh.h && kind === LIGHT ? 0.15 : 0))) : whole;
    const L = Math.max(size.x, size.y, size.z);
    const body = {
      id: e.id, kind, e, rec, c, obj, geos, corners, mass, inertia: mass * (L * L) / 10 + 0.5,
      v: new THREE.Vector3(), w: new THREE.Vector3(), asleep: false, still: 0, reach: (isSign(kind) ? REACH.sign : REACH[kind] || 0.3) + Math.min(size.x, size.z) * 0.5,
      // a long thing's span points about its centre, at bumper height (see SPAN)
      span: SPAN[kind] && !piece ? SPAN[kind].map((q) => [new THREE.Vector3(spanX(0, cs, sn, q) - c.x, 0.5 - c.y, spanZ(0, cs, sn, q) - c.z), q[2]]) : null,
      // the shaft's centre line, for driving over it when it lies on the ground
      seg: sh ? [new THREE.Vector3(0, y0, 0).sub(c), new THREE.Vector3(0, y1, 0).sub(c)] : null, r: sh ? sh.r : 0,
      idx: piece ? piece.idx : -1, under: 0, lastPass: -9,
    };
    rec.loose.push(body);
    return body;
  }
  const k0 = (mat) => mat === solidMat && !!opts.shadows;

  // cut a prop out of its sector's merged meshes
  function hide(rec, e) {
    e.gone = true;
    for (let k = 0; k < 4; k++) {
      const m = rec.meshes[k];
      const a = e.r0[k], b = e.r1[k];
      if (!m || b <= a) continue;
      const pos = m.geometry.attributes.position;
      for (let v = a; v < b; v++) pos.setXYZ(v, e.x, e.y - 50, e.z);
      pos.needsUpdate = true;
    }
  }

  const tmpV = new THREE.Vector3(), tmpR = new THREE.Vector3(), tmpN = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpT = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  // an impulse of size j along unit direction d at offset r from the body's centre
  function impulse(b, d, j, r) {
    b.v.addScaledVector(d, j / b.mass);
    tmpT.crossVectors(r, d);
    b.w.addScaledVector(tmpT, j / b.inertia);
  }
  // the car (world velocity cvx, cvz, mass M) hits body b; returns the impulse taken from the car
  // side: which side of the car's path it is on (-1 / +1), so it glances off that way instead of being
  // carried along ahead of the bumper
  function hit(b, cvx, cvz, M, side = 0) {
    const sp = Math.hypot(cvx - b.v.x, cvz - b.v.z);
    if (sp < 0.3) return 0;
    tmpN.set((cvx - b.v.x) / sp, 0, (cvz - b.v.z) / sp);
    if (side) {
      const turn = side * (0.35 + Math.random() * 0.15);        // 20 to 29 degrees off the car's path
      const c = Math.cos(turn), s = Math.sin(turn);
      tmpN.set(tmpN.x * c - tmpN.z * s, 0, tmpN.x * s + tmpN.z * c);
    }
    // the bumper meets it about half a metre above the ground
    const p = b.obj.position;
    const gy = world.heightAt(p.x, p.z);
    tmpR.set(0, Math.min(0.55 + gy - p.y, 0) * (TUMBLE[b.kind] ?? 1), 0);
    tmpT.crossVectors(tmpR, tmpN);
    const k = 1 / b.mass + tmpT.lengthSq() / b.inertia + 1 / M;
    const j = (1.25 * sp) / k;
    impulse(b, tmpN, j, tmpR);
    b.v.y += Math.min(0.06 * sp + 0.3, 2.5);
    b.w.x += (Math.random() - 0.5) * 0.6; b.w.z += (Math.random() - 0.5) * 0.6;
    b.asleep = false; b.still = 0; b.age = 0; b.hitT = now();
    moving.add(b);
    return j;
  }
  let clock = 0;
  const now = () => clock;
  // something already knocked loose that the car catches up with: flick it out of the way to the side
  // it is on and let it go, taking only a little speed from the car, so nothing rides along on the bumper
  function shove(b, car, fx, fz, rx, rz, side) {
    const fwd = b.v.x * fx + b.v.z * fz, lat = b.v.x * rx + b.v.z * rz;
    const speed = Math.hypot(car.vx, car.vy);
    const want = side * (2.5 + 0.12 * speed);
    const newLat = side * Math.max(side * lat, side * want);
    const newFwd = Math.max(fwd, Math.min(speed * 0.9, fwd + 3));
    const dLat = newLat - lat, dFwd = newFwd - fwd;
    b.v.x += rx * dLat + fx * dFwd; b.v.z += rz * dLat + fz * dFwd;
    if (b.v.y < 1) b.v.y = 1 + 0.03 * speed;
    b.asleep = false; b.still = 0; b.age = 0;
    moving.add(b);
    return b.mass * Math.hypot(dLat, dFwd) * 0.3;
  }

  function step(b, dt) {
    const o = b.obj;
    b.v.y -= G * dt;
    o.position.addScaledVector(b.v, dt);
    const wl = b.w.length();
    if (wl > 1e-6) { tmpQ.setFromAxisAngle(tmpV.copy(b.w).divideScalar(wl), wl * dt); o.quaternion.premultiply(tmpQ); }
    // ground contact at the deepest corner
    let deepest = 0, ci = -1;
    for (let i = 0; i < b.corners.length; i++) {
      tmpC.copy(b.corners[i]).applyQuaternion(o.quaternion).add(o.position);
      const pen = world.heightAt(tmpC.x, tmpC.z) - tmpC.y;
      if (pen > deepest) { deepest = pen; ci = i; }
    }
    let touching = false;
    if (ci >= 0) {
      touching = true;
      o.position.y += deepest;
      tmpR.copy(b.corners[ci]).applyQuaternion(o.quaternion);
      tmpN.set(0, 1, 0);
      tmpV.crossVectors(b.w, tmpR).add(b.v);                       // velocity of the contact point
      const vn = tmpV.y;
      if (vn < 0) {
        tmpT.crossVectors(tmpR, tmpN);
        const k = 1 / b.mass + tmpT.lengthSq() / b.inertia;
        const j = (-(1 + 0.25) * vn) / k;
        impulse(b, tmpN, j, tmpR);
        // friction against the slide
        tmpV.crossVectors(b.w, tmpR).add(b.v);
        const vt = Math.hypot(tmpV.x, tmpV.z);
        if (vt > 1e-4) {
          const t = tmpN.set(-tmpV.x / vt, 0, -tmpV.z / vt);
          tmpT.crossVectors(tmpR, t);
          const kt = 1 / b.mass + tmpT.lengthSq() / b.inertia;
          impulse(b, t, Math.min(vt / kt, 0.6 * j), tmpR);
        }
      }
      b.w.multiplyScalar(Math.exp(-dt * 1.5));
      b.v.x *= Math.exp(-dt * 0.8); b.v.z *= Math.exp(-dt * 0.8);
    }
    b.age += dt;
    if (touching && b.v.lengthSq() < 0.09 && b.w.lengthSq() < 0.16) b.still += dt; else b.still = 0;
    if (b.still > 0.5 || (touching && b.age > 8) || b.age > 30) {
      b.asleep = true; b.v.set(0, 0, 0); b.w.set(0, 0, 0);
      moving.delete(b);
      const pose = [...o.position.toArray().map((v) => Math.round(v * 100) / 100), ...o.quaternion.toArray().map((v) => Math.round(v * 1e4) / 1e4)];
      if (b.idx >= 0) { if (knocked[b.id]?.p) knocked[b.id].p[b.idx] = pose; } else knocked[b.id] = pose;
      saveTimer = 0.5;
    }
  }

  // ---- snapping poles
  // break a whole pole body into pieces at the heights in cuts; the pieces carry on with its motion
  function split(b, cuts) {
    const { e, rec, obj } = b;
    const sh = shaftOf(e.kind);
    const ys = [0, ...cuts, sh.h];
    rec.group.remove(obj);
    b.geos.forEach((g) => g.dispose());
    rec.loose.splice(rec.loose.indexOf(b), 1);
    moving.delete(b);
    knocked[e.id] = { cuts: cuts.map((y) => Math.round(y * 100) / 100), p: ys.slice(1).map(() => 1) };
    const out = [];
    for (let i = 0; i + 1 < ys.length; i++) {
      const pc = makeBody(e, rec, { y0: ys[i], y1: ys[i + 1], idx: i });
      const off = tmpC.copy(pc.c).sub(b.c).applyQuaternion(obj.quaternion);
      pc.obj.quaternion.copy(obj.quaternion);
      pc.obj.position.copy(obj.position).add(off);
      pc.v.crossVectors(b.w, off).add(b.v);
      pc.w.copy(b.w);
      // a little kick apart at the break, and a tumble of its own
      pc.v.addScaledVector(off.normalize(), 0.6 + Math.random() * 0.6);
      pc.w.x += (Math.random() - 0.5) * 2; pc.w.z += (Math.random() - 0.5) * 2;
      pc.age = 0; pc.still = 0; pc.lastPass = b.lastPass; pc.under = 0; pc.hitT = b.hitT;
      moving.add(pc);
      out.push(pc);
    }
    return out;
  }
  const canBreak = (b) => b.seg && b.idx < 0;
  // where a pole snaps on the first impact: low down near the bumper, sometimes again higher up
  function impactCuts(kind) {
    const h = shaftOf(kind).h;
    const lo = Math.min(h * 0.4, 0.45 + Math.random() * 0.6);
    return Math.random() < 0.35 ? [lo, lo + (h - lo) * (0.35 + Math.random() * 0.3)] : [lo];
  }
  // where a lying pole snaps under a wheel: at the wheel (t along the shaft), sometimes also elsewhere
  function wheelCuts(kind, t) {
    const h = shaftOf(kind).h;
    const at = h * Math.min(0.85, Math.max(0.15, t));
    if (Math.random() < 0.3) {
      const other = h * (at > h / 2 ? 0.15 + Math.random() * 0.2 : 0.65 + Math.random() * 0.2);
      if (Math.abs(other - at) > 0.6) return [Math.min(at, other), Math.max(at, other)];
    }
    return [at];
  }

  // A pole lying on the road is driven over, not pushed: each wheel that rolls onto it gives the car a
  // small knock upwards and rolls the pole a little, and a pass over it may snap it.
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpS = new THREE.Vector3();
  function lying(b) {
    return b.seg && Math.abs(tmpV.set(0, 1, 0).applyQuaternion(b.obj.quaternion).y) < 0.8;
  }
  function driveOver(b, car, wheels, fx, fz, speed) {
    const o = b.obj;
    tmpA.copy(b.seg[0]).applyQuaternion(o.quaternion).add(o.position);
    tmpB.copy(b.seg[1]).applyQuaternion(o.quaternion).add(o.position);
    const ux = tmpB.x - tmpA.x, uz = tmpB.z - tmpA.z, uu = ux * ux + uz * uz || 1;
    let under = 0, fresh = 0, tHit = 0.5;
    for (let i = 0; i < 4; i++) {
      const [wx, wz] = wheels[i];
      const t = Math.min(1, Math.max(0, ((wx - tmpA.x) * ux + (wz - tmpA.z) * uz) / uu));
      const dx = wx - tmpA.x - ux * t, dz = wz - tmpA.z - uz * t;
      if (dx * dx + dz * dz > (0.14 + b.r) ** 2) continue;
      // the shaft must be down at road level there, not up on a kerb or wall
      if (tmpA.y + (tmpB.y - tmpA.y) * t - world.heightAt(wx, wz) > 0.5) continue;
      under |= 1 << i;
      if (!(b.under & (1 << i))) { fresh++; tHit = t; }
    }
    b.under = under;
    if (!fresh) return;
    // the car: a thump through the springs and a whisker of speed
    const k = Math.min(1, speed / 15);
    car.vyUp = Math.max(car.vyUp, 0) + fresh * (0.12 + 0.22 * k) * Math.min(1, b.r / 0.09 + 0.3);
    car.vx *= 1 - 0.004 * fresh;
    car.hit = Math.max(car.hit, 0.15 + 0.25 * k);
    // the pole: rolled a little the way the car goes, never carried along
    const kick = Math.min(0.8, 0.1 + speed * 0.025);
    b.v.x += fx * kick; b.v.z += fz * kick; b.v.y += 0.2 + 0.3 * k;
    tmpT.set(ux, 0, uz).normalize();
    // spin about its own axis, rolling it forwards
    const roll = (fx * tmpT.z - fz * tmpT.x) * kick / Math.max(0.05, b.r) * 0.15;
    b.w.addScaledVector(tmpT, roll);
    b.w.y += (Math.random() - 0.5) * 0.3 * k;
    b.asleep = false; b.still = 0; b.age = 0;
    moving.add(b);
    // a new pass over it (not the second wheel of the same one) may snap it
    const now = car.time ?? performance.now() / 1000;
    if (canBreak(b) && now - b.lastPass > 0.25 && Math.random() < 0.45 + 0.2 * k) {
      // pieces start clear of the wheel so they are not driven over twice in one go
      for (const pc of split(b, wheelCuts(b.kind, tHit))) pc.under = 15;
    }
    b.lastPass = now;
    saveTimer = 0.5;
  }

  // check the car against the props around it, knock what it touches, move what is flying
  function update(car, dt) {
    if (!data) return;
    clock += dt;
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
    const speed = Math.hypot(car.vx, car.vy);
    const S = world.meta.sector.size, G0 = world.meta.sector.grid0;
    if (speed > 0.3) {
      const M = car.spec.mass;
      let cvx = car.vx * fx + car.vy * rx, cvz = car.vx * fz + car.vy * rz, took = 0;
      const sx = Math.floor((car.x - G0) / S), sz = Math.floor((car.z - G0) / S);
      const hw = car.halfWid - 0.25;
      const wheels = [[car.a, -hw], [car.a, hw], [-car.b, -hw], [-car.b, hw]].map(([l, t]) => [car.x + fx * l + rx * t, car.z + fz * l + rz * t]);
      // the side of the car's centre line a point is on; dead centre picks one at random
      const sideOf = (px, pz) => { const l = (px - car.x) * rx + (pz - car.z) * rz; return Math.abs(l) > 0.05 ? Math.sign(l) : Math.random() < 0.5 ? -1 : 1; };
      const touches = (px, pz, reach) => {
        const dx = px - car.x, dz = pz - car.z;
        if (dx * dx + dz * dz > 49) return false;
        return Math.abs(dx * fx + dz * fz) < car.halfLen + reach && Math.abs(dx * rx + dz * rz) < car.halfWid + reach;
      };
      // a standing prop: its middle, or any point of its span
      const touchesProp = (e, reach) => {
        const sp = SPAN[e.kind];
        if (!sp) return touches(e.x, e.z, reach);
        for (let k = 0; k < sp.length; k++) if (touches(spanX(e.x, e.cs, e.sn, sp[k]), spanZ(e.z, e.cs, e.sn, sp[k]), sp[k][2])) return true;
        return false;
      };
      // a loose one, wherever it lies and however it is turned
      const touchesBody = (b) => {
        if (!b.span) return touches(b.obj.position.x, b.obj.position.z, b.reach);
        for (let k = 0; k < b.span.length; k++) {
          tmpS.copy(b.span[k][0]).applyQuaternion(b.obj.quaternion).add(b.obj.position);
          if (touches(tmpS.x, tmpS.z, b.span[k][1])) return true;
        }
        return false;
      };
      for (let ax = sx - 1; ax <= sx + 1; ax++) for (let az = sz - 1; az <= sz + 1; az++) {
        const rec = live.get(`${ax}_${az}`);
        if (!rec) continue;
        const x0 = G0 + ax * S, z0 = G0 + az * S;
        if (car.x < x0 - 8 || car.x > x0 + S + 8 || car.z < z0 - 8 || car.z > z0 + S + 8) continue;
        for (const e of rec.entries) {
          if (e.gone) continue;
          const reach = isSign(e.kind) ? REACH.sign : REACH[e.kind] || 0.3;
          if (Math.abs(e.y - car.y) > 3 || !touchesProp(e, reach)) continue;
          hide(rec, e);
          const b = makeBody(e, rec);
          knocked[e.id] = 1;
          stats.smash('prop');
          const j = hit(b, cvx, cvz, M, sideOf(e.x, e.z));
          took += j;
          // sometimes it snaps straight away, more often the faster the car; else maybe later, under a wheel
          if (canBreak(b) && Math.random() < (THIN[b.kind] ? Math.min(0.95, Math.max(0.6, (speed - 4) / 20)) : Math.min(0.5, Math.max(0.08, (speed - 6) / 40)))) split(b, impactCuts(b.kind));
          cvx -= tmpN.x * j / M; cvz -= tmpN.z * j / M;
          saveTimer = 0.5;
        }
        for (const b of [...rec.loose]) {
          const p = b.obj.position;
          if (!b.obj.visible || Math.abs(p.y - car.y) > 2.5) continue;
          if (lying(b)) {
            const dx = p.x - car.x, dz = p.z - car.z;
            if (dx * dx + dz * dz < 64 + 25) driveOver(b, car, wheels, fx, fz, speed);
            continue;
          }
          if (!touchesBody(b)) continue;
          const side = sideOf(p.x, p.z);
          if (clock - (b.hitT ?? -9) < 1.5) {
            const j = shove(b, car, fx, fz, rx, rz, side);
            const k = Math.min(j / M, 0.3);
            cvx -= fx * k; cvz -= fz * k;
            took += 1e-6;
            continue;
          }
          const j = hit(b, cvx, cvz, M, side);
          if (j) { took += j; cvx -= tmpN.x * j / M; cvz -= tmpN.z * j / M; }
        }
      }
      if (took > 0) {
        car.vx = cvx * fx + cvz * fz; car.vy = cvx * rx + cvz * rz;
        car.hit = Math.max(car.hit, Math.min(3, took / M * 6));
      }
    }
    const sub = dt > 1 / 60 ? 2 : 1;
    for (const b of [...moving]) for (let k = 0; k < sub; k++) if (!b.asleep) step(b, dt / sub);
    if (saveTimer > 0 && (saveTimer -= dt) <= 0) {
      try { sessionStorage.setItem(KNOCK_KEY, JSON.stringify(knocked)); } catch { /* private mode */ }
    }
  }

  fetch(`${DATA}props.json`).then((r) => r.json()).then((d) => {
    data = d;
    if (opts.clear) cleared = opts.clear(d);
    // hand-placed extras ([kind, x, z, bearing in degrees]) go at the end of their sector's list,
    // so the ids of the surveyed props (and what was knocked this session) stay the same
    if (opts.extra) {
      const S = world.meta.sector.size, G0 = world.meta.sector.grid0;
      for (const [kind, x, z, yaw, extra = 0] of opts.extra()) {
        const key = `${Math.floor((x - G0) / S)}_${Math.floor((z - G0) / S)}`;
        (d.sectors[key] ||= []).push(kind, x, z, yaw, extra);
      }
    }
    for (const f of waiting.splice(0)) f();
  }).catch(() => { /* no props baked: play without them */ });

  // attach(sector, add) calls add(group) once the sector's props exist (now, or when the data arrives)
  const attach = (sector, add) => {
    const run = () => { if (sector.state === 'ready') jobs.add(function* () { const g = yield* buildSteps(sector); if (g) add(g); }, 'props'); };
    if (data) run(); else waiting.push(run);
  };
  attach.update = update;
  attach.knockedCount = () => Object.keys(knocked).length;
  attach.moving = () => moving.size;
  // nearest standing prop (for tests)
  attach.nearest = (x, z, kindTest = () => true) => {
    let best = null, bd = Infinity;
    for (const rec of live.values()) for (const e of rec.entries) {
      if (e.gone || !kindTest(e.kind)) continue;
      const d = Math.hypot(e.x - x, e.z - z);
      if (d < bd) { bd = d; best = e; }
    }
    return best && { id: best.id, kind: best.kind, x: best.x, y: best.y, z: best.z };
  };
  // every surveyed and hand-placed prop with its id (for tests: node tools/road-props-check.mjs)
  attach.all = () => (data ? Object.entries(data.sectors).flatMap(([key, a]) => { const r = []; for (let k = 0; k < a.length; k += data.stride) r.push({ id: `${key}:${k / data.stride}`, kind: a[k], x: a[k + 1], z: a[k + 2], cleared: cleared.has(`${key}:${k / data.stride}`) }); return r; }) : []);
  attach.loose = (id) => { for (const rec of live.values()) for (const b of rec.loose) if (b.id === id) return { p: b.obj.position.toArray(), q: b.obj.quaternion.toArray(), asleep: b.asleep, v: b.v.toArray(), w: b.w.toArray(), still: b.still }; return null; };
  attach._raw = (id) => { const r = []; for (const rec of live.values()) for (const b of rec.loose) if (b.id === id) r.push(b); r.wake = (b) => { b.asleep = false; b.age = 0; b.still = 0; moving.add(b); }; return r; };
  attach.bodies = (id) => { const r = []; for (const rec of live.values()) for (const b of rec.loose) if (b.id === id) r.push({ idx: b.idx, p: b.obj.position.toArray(), lying: !!lying(b), asleep: b.asleep, ax: b.seg && new THREE.Vector3(0, 1, 0).applyQuaternion(b.obj.quaternion).toArray() }); return r; };
  return attach;
}
