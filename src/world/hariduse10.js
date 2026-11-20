// Hariduse 10, Kõrveküla, and Kubjaringi tänav along the pond beside it (Martin, 20 Nov), from his ten Google
// Street View screenshots (August 2023) and the Land Board's orthophoto.
//  - The house is built by hand instead of the map's block: a long one-and-a-half storey house with its ridge
//    east to west, the gable to Kubjaringi tänav. Dark red-brown brick on the ground floor (piers between big
//    white-framed windows with white boards over them), white boards above, a dark tiled roof whose whole south
//    slope is solar panels, a porch on brick pillars along the south side and one at the north-west corner, a
//    lower wing at the east end. A flagpole with the Estonian pennant in the south garden, a tall clipped thuja
//    hedge over a green mesh fence along Kubjaringi, the fence alone along Hariduse, a playhouse and a swing in
//    the back garden, tall spruces behind.
//  - The pond side of Kubjaringi tänav: the bathing place with its jetty and a pile of cut reeds, the
//    information board, a bench, the green wheelie bin, concrete flower planters along the road edge, field
//    boulders, the street lamp, the portable toilet and the birches by Hariduse tn, the no-parking signs (one on
//    the wooden power pole), the crossing and give-way signs at the mouth of the street, two cars parked by
//    the hedge.
// The east end, the back of the house and the back garden are not in the pictures and are guessed.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { createAtlas, painter } from './houseskin.js';
import { paintScale } from './paintscale.js';
import { frame, areaKit } from './handbuilt.js';
import { door, signPlate } from './arhitekti.js';
import { BOX } from '../race/landmarks.js';

// The house frame: s east along the south front (from the south-west corner), v south (the house is at v < 0)
const H = frame([3913.61, -2133.17], [0.995, 0.1]);
// Kubjaringi tänav's centre line north of its bend: s north along it, v east (the house side)
const R = frame([3903.0, -2142.9], [0.234, -0.972]);
const CENTRE = [3905, -2160];

const D = 15.0, SM = 11.6, SE = 15.8;                  // depth; the main block's and the wing's east ends
const EAVE = 3.5, RIDGE = 10.4, K = (RIDGE - EAVE) / (D / 2), WING = 3.0;
const PS = 3.5, PV = -2.0;                             // the south porch: from s 3.5 to the wing, back wall at v -2

// ---------------------------------------------------------------- what the map's own data needs
export function haridus10Walls(walls) {
  setHouseColours(walls, '7_-3', 3680, -2720, [
    { base: 2504, x: 3922.2, z: -2139.9, hide: true, reach: 12 },              // built by hand below
  ]);
}

// Hand-placed street furniture for props.js: [kind, x, z, bearing (deg, 0 = facing south, 90 = east), lift dm]
const POLE = 1, CROSSING = 17, YIELD = 15, NO_PARKING = 29;
export function haridus10Props() {
  return [
    [CROSSING, 3893.8, -2125.6, 315], [YIELD, 3893.8, -2125.6, 180, 8],      // the west corner of the street's mouth
    [CROSSING, 3903.2, -2124.6, 180],                                         // the east corner, by the fence
    [NO_PARKING, 3896.6, -2136.5, 0],                                         // the pond side, by the birches
    [POLE, 3915.3, -2175.9, 0], [NO_PARKING, 3915.0, -2176.0, 0],             // the power pole by the parked cars
  ];
}

// Parked cars for parked.js: [x, z, yaw, id, paint, lift], forward = (sin yaw, -cos yaw): both face north,
// right wheels on the verge by the hedge (a dark hatchback and a white one in the pictures)
const NORTH = Math.atan2(0.234, 0.972);
export const HARIDUSE10_CARS = [
  [...R.at(37.5, 2.3), NORTH, 'mazda6', 'black', 0.03],
  [...R.at(43.0, 2.3), NORTH, 'ceedsw', 'white', 0.03],
];

// ---------------------------------------------------------------- colours
const COL = {
  boards: [238, 238, 233], brick: [118, 62, 50], frame: '#f6f5f1', glass: '#3e4954', recess: '#3a302c',
  brick3: 0x74402f, roof: 0x3d3b3e, course: 0x2c2b2e, panel: 0x1b2333, soffit: 0xf0efea, gutter: 0x3a3c41,
  white: 0xeeeeea, floor: 0xa9a6a0,
};

// painted walls of any outline on one small shared atlas: outline [[x, y]] in metres along a -> b (the outside
// on the right going from a to b) and up from gy
function faceKit(group, shadows) {
  const atlas = createAtlas(1024), jobs = [];
  function face(a, b, gy, outline, base, draw, ppm = 30) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ys = outline.map((p) => p[1]);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const q = Math.min(ppm * paintScale(), 1000 / len, 1000 / (y1 - y0));
    const pw = Math.max(4, Math.round(len * q)), ph = Math.max(4, Math.round((y1 - y0) * q));
    const rect = atlas.take(pw, ph), c = atlas.pages[rect.k].c;
    c.save();
    c.beginPath(); c.rect(rect.x - 2, rect.y - 2, pw + 4, ph + 4); c.clip();
    c.fillStyle = base; c.fillRect(rect.x - 2, rect.y - 2, pw + 4, ph + 4);
    draw(painter(c, rect.x, rect.y, len, y0, y1, pw / len), len);
    c.restore();
    jobs.push({ a, b, gy, y0, y1, len, rect, pw, ph, outline });
  }
  function finish() {
    const S = atlas.size;
    atlas.pages.forEach((pg, pk) => {
      const pos = [], nor = [], uv = [];
      for (const j of jobs) {
        if (j.rect.k !== pk) continue;
        const ux = (j.b[0] - j.a[0]) / j.len, uz = (j.b[1] - j.a[1]) / j.len, nx = -uz, nz = ux;
        const P = ([s, y]) => [j.a[0] + ux * s + nx * 0.02, j.gy + y, j.a[1] + uz * s + nz * 0.02];
        const T = ([s, y]) => [(j.rect.x + s / j.len * j.pw) / S, 1 - (j.rect.y + (j.y1 - y) / (j.y1 - j.y0) * j.ph) / S];
        const tris = THREE.ShapeUtils.triangulateShape(j.outline.map(([x, y]) => new THREE.Vector2(x, y)), []);
        for (let [i0, i1, i2] of tris) {
          const p0 = j.outline[i0], p1 = j.outline[i1], p2 = j.outline[i2];
          if ((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]) < 0) [i1, i2] = [i2, i1];
          for (const i of [i0, i1, i2]) { pos.push(...P(j.outline[i])); nor.push(nx, 0, nz); uv.push(...T(j.outline[i])); }
        }
      }
      if (!pos.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const tex = new THREE.CanvasTexture(pg.cv);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex }));
      m.receiveShadow = shadows;
      group.add(m);
    });
  }
  return { face, finish };
}

// ---------------------------------------------------------------- the wall painting
const boards = (P, x0, y0, x1, y1) => { P.boards(x0, y0, x1, y1, COL.boards, 0.16, false); P.weather(x0, y0, x1, y1, 0.18, 7); };
const brick = (P, x0, y0, x1, y1, seed = 3) => { P.brick(x0, y0, x1, y1, COL.brick, seed); P.r(x0, y0 - 0.6, x1, Math.min(y1, 0.12), '#4f4b48'); };
const pane = (P, x0, y0, x1, y1, bars = 1) => P.win(x0, y0, x1, y1, { frame: COL.frame, glass: COL.glass, fw: 0.08, bars, rails: 0, T: false, surround: 0, sill: 0.04, sc: COL.frame });
// a ground floor window between brick piers: white boards over it up to the top of the brick
function bay(P, x, w, top = 2.9, bars = 1, sill = 0.45, head = 2.25) {
  P.boards(x - w / 2 - 0.1, head, x + w / 2 + 0.1, top, COL.boards, 0.16, false);
  pane(P, x - w / 2, sill, x + w / 2, head, bars);
}
// a porch painted as a shaded recess, with its door
function recess(P, x0, x1, top, doorAt) {
  P.grad(x0, 0, x1, top, '#2c2523', COL.recess);
  door(P, doorAt - 0.45, doorAt + 0.45, 0.05, 2.1, '#3b3d42', { frame: '#d9d7d2', glass: '#27303a' });
  P.r(x0, top, x1, top + 0.18, '#f2f1ed');
}

// ---------------------------------------------------------------- the build
export function createHariduse10(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  // no trees stand here in the game: the spruces behind the house, the birches by the corner and round the
  // pond (0 broadleaf, 1 conifer)
  const trees = [];
  for (let z = -2124; z > -2158; z -= 4.6) trees.push([3935.4 + ((z * 7) % 1.2), z, 16 + ((-z * 3) % 4), 4.6, 1]);
  trees.push([3928.5, -2161.5, 18, 5, 1], [3933.5, -2163, 17, 4.8, 1], [3923.5, -2166, 16, 4.6, 1]);
  trees.push([3916.0, -2152.5, 13, 4.2, 0]);                                                  // the birch in the back garden
  trees.push([3891.0, -2129.5, 14, 5.2, 0], [3893.6, -2134.6, 13, 4.6, 0], [3888.4, -2134.2, 12, 4.6, 0]);   // by the corner
  trees.push([3884.0, -2141.0, 12, 5.5, 0], [3879.0, -2147.0, 11, 5, 0], [3889.5, -2145.0, 10, 4.5, 0]);
  trees.push([3906.0, -2203.0, 15, 6, 0], [3911.0, -2208.5, 14, 4.6, 1], [3902.0, -2209.0, 12, 5, 0]);        // north of the beach
  world.addTrees(trees);

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows, fenceColour: 0x3d5a45 });
    const { p, h, box } = A;
    const FK = faceKit(group, shadows);
    const at = H.at;
    let G = 1e9;
    for (const [s, v] of [[0, 0], [SE, 0], [SE, -D], [0, -D], [SM / 2, -D / 2]]) G = Math.min(G, h(...at(s, v)));
    G -= 0.02;
    const blk = (s0, s1, v0, v1, y0, y1, c) => box(H, (s0 + s1) / 2, (v0 + v1) / 2, s1 - s0, v1 - v0, y0, y1, c, G);
    const face = (a, b, outline, draw, ppm) => FK.face(at(...a), at(...b), G, outline, '#eeeeea', draw, ppm);
    const rect = (w, y1) => [[0, -0.5], [w, -0.5], [w, y1], [0, y1]];

    // ---- the body
    blk(0, PS, -D, 0, -0.6, EAVE, COL.white);
    blk(PS, SM, -D, PV, -0.6, EAVE, COL.white);
    blk(SM, SE, -D, 0, -0.6, WING, COL.white);

    // ---- the walls
    // the gable to the street: the north-west porch, two big windows below, a triple and a double above
    face([0, -D], [0, 0], [[0, -0.5], [D, -0.5], [D, EAVE], [D / 2, RIDGE], [0, EAVE]], (P) => {
      boards(P, 0, -0.5, D, RIDGE);
      brick(P, 0, -0.5, D, 2.9, 11);
      recess(P, 0, 2.4, 2.75, 1.3);
      bay(P, 5.0, 2.6); bay(P, 10.4, 1.9);
      pane(P, 3.8, 3.1, 6.2, 5.3, 2); pane(P, 9.6, 3.1, 11.2, 5.3, 1);
    });
    // the south front west of the porch, the porch's back wall and ends, the wing's front
    face([0, 0], [PS, 0], rect(PS, EAVE), (P) => { boards(P, 0, -0.5, PS, EAVE); brick(P, 0, -0.5, PS, 2.9, 12); bay(P, 1.8, 1.3); });
    face([PS, 0], [PS, PV], rect(-PV, 3.0), (P) => brick(P, 0, -0.5, -PV, 3.0, 13));
    face([PS, PV], [SM, PV], rect(SM - PS, 3.0), (P) => {
      brick(P, 0, -0.5, SM - PS, 3.0, 14);
      P.r(1.05, 0, 2.35, 2.4, COL.frame); P.grad(1.15, 0.05, 2.25, 2.3, '#4a5560', '#2e363e'); P.r(1.67, 0.05, 1.73, 2.3, COL.frame);   // the glazed door
      bay(P, 4.1, 1.9, 3.0); bay(P, 6.6, 1.6, 3.0);
    });
    face([SM, PV], [SM, 0], rect(-PV, 3.0), (P) => brick(P, 0, -0.5, -PV, 3.0, 15));
    face([SM, 0], [SE, 0], rect(SE - SM, WING), (P) => { boards(P, 0, -0.5, SE - SM, WING); brick(P, 0, -0.5, SE - SM, 2.6, 16); bay(P, 2.1, 1.4, 2.6); });
    // the east end (not in the pictures): the wing's wall and the main gable over its roof
    face([SE, 0], [SE, -D], rect(D, WING), (P) => { boards(P, 0, -0.5, D, WING); brick(P, 0, -0.5, D, 2.6, 17); for (const x of [3, 7.5, 12]) bay(P, x, 1.3, 2.6); }, 16);
    face([SM, 0], [SM, -D], [[0, 2.9], [D, 2.9], [D, EAVE], [D / 2, RIDGE], [0, EAVE]], (P) => { boards(P, 0, 2.9, D, RIDGE); pane(P, 6.9, 5.0, 8.1, 6.4, 1); }, 14);
    // the back: the wing, then the main block with the north-west porch at its west end
    face([SE, -D], [SM, -D], rect(SE - SM, WING), (P) => { boards(P, 0, -0.5, SE - SM, WING); brick(P, 0, -0.5, SE - SM, 2.6, 18); bay(P, 2.1, 1.2, 2.6); }, 16);
    face([SM, -D], [0, -D], rect(SM, EAVE), (P) => {
      boards(P, 0, -0.5, SM, EAVE); brick(P, 0, -0.5, SM, 2.9, 19);
      bay(P, 1.6, 1.2); bay(P, 4.4, 1.2); bay(P, 7.0, 0.8);
      recess(P, 9.2, SM, 2.75, 10.2);
    }, 20);

    // ---- the roof: dark tiles, ridge east to west, eaves 0.55 m out; white soffits; gutters
    const yR = (v) => G + RIDGE - K * Math.abs(v + D / 2);
    const tris = (list, c) => {
      const pos = [];
      for (const t of list) {
        const q = t.map(([s, v, y]) => { const [x, z] = at(s, v); return [x, y, z]; });
        pos.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[1]);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      p.add(g, c, 0, 0, 0);
    };
    // a quad of the roof plane over s0..s1, v0..v1 (one side of the ridge), dropped by `drop`
    const plane = (s0, s1, v0, v1, c, drop = 0) => {
      const a = [s0, v0, yR(v0) - drop], b = [s1, v0, yR(v0) - drop], cc = [s1, v1, yR(v1) - drop], d = [s0, v1, yR(v1) - drop];
      tris([[a, b, cc], [a, cc, d]], c);
    };
    const S0 = -0.45, S1 = SM + 0.3, VN = -D - 0.55, VS = 0.55, VR = -D / 2;
    plane(S0, S1, VR, VS, COL.roof); plane(S0, S1, VN, VR, COL.roof);
    // the white undersides of the overhangs
    plane(S0, S1, 0, VS, COL.soffit, 0.07); plane(S0, S1, VN, -D, COL.soffit, 0.07);
    plane(S0, 0, VR, 0, COL.soffit, 0.07); plane(S0, 0, -D, VR, COL.soffit, 0.07);
    // tile courses
    for (let v = VR + 0.38; v < VS; v += 0.38) blk(S0, S1, v - 0.02, v + 0.02, yR(v) - G + 0.005, yR(v) - G + 0.035, COL.course);
    for (let v = VR - 0.38; v > VN; v -= 0.38) blk(S0, S1, v - 0.02, v + 0.02, yR(v) - G + 0.005, yR(v) - G + 0.035, COL.course);
    blk(S0, S1, VR - 0.14, VR + 0.14, RIDGE - 0.08, RIDGE + 0.1, COL.course);                       // the ridge tiles
    for (const v of [VS, VN]) blk(S0, S1, v - 0.07, v + 0.07, yR(v) - G - 0.16, yR(v) - G - 0.02, COL.gutter);
    // the wing's low hipped roof, its ridge north to south
    {
      const ov = 0.4, half = (SE - SM) / 2 + ov, yr = 4.5, k = (yr - WING) / (half - ov), ye = G + WING - ov * k, Ry = G + yr;
      const s0 = SM - 0.05, s1 = SE + ov, v0 = -D - ov, v1 = ov, sm = (SM + SE) / 2;
      const a = [s0, v0, ye], b = [s1, v0, ye], cc = [s1, v1, ye], d = [s0, v1, ye], r1 = [sm, v0 + half, Ry], r2 = [sm, v1 - half, Ry];
      tris([[d, a, r1], [d, r1, r2], [a, b, r1], [b, cc, r2], [b, r2, r1], [cc, d, r2]], COL.roof);
      blk(SM, s1, v0, v1, WING - ov * k - 0.06, WING - ov * k - 0.02, COL.soffit);
    }
    // the solar panels: the whole south slope, five rows of ten
    const tilt = Math.atan(K), step = 1.72 / Math.sqrt(1 + K * K);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++) {
      const s = 0.55 + c * 1.04 + 0.5, v = -6.9 + (r + 0.5) * step, [x, z] = at(s, v);
      p.add(BOX(1.0, 0.04, 1.68).rotateX(tilt), COL.panel, x, yR(v) + 0.09, z, H.YAW);
    }

    // ---- the porches: brick pillars, a white beam, the ceiling and the floor
    for (const s of [4.0, 6.6, 9.1, 11.3]) blk(s - 0.25, s + 0.25, -0.5, 0, -0.3, 2.78, COL.brick3);
    blk(PS, SM, -0.45, 0.05, 2.75, 3.02, COL.white);
    blk(PS, SM, PV, VS - 0.05, 2.97, 3.0, COL.soffit);
    blk(PS, SM, PV, 0, -0.3, 0.1, COL.floor);
    blk(-0.3, 0.3, -D - 0.3, -D + 0.3, -0.3, 2.9, COL.brick3);                                  // the north-west porch's pillar
    // downpipes, the hanging flower baskets
    for (const [s, v] of [[0.25, 0.1], [3.3, 0.1], [0.7, -D - 0.1], [10.9, -D - 0.1]]) blk(s - 0.045, s + 0.045, v - 0.045, v + 0.045, 0.1, EAVE - 0.35, COL.gutter);
    for (const [s, v] of [[5.3, 0.1], [7.9, 0.1], [0.9, -D - 0.25]]) {
      const [x, z] = at(s, v);
      p.add(new THREE.IcosahedronGeometry(0.26, 1), 0xb24a96, x, G + 2.25, z);
      p.add(new THREE.IcosahedronGeometry(0.2, 0), 0x3f6b3a, x, G + 2.1, z);
    }
    blk(-0.6, PS + 0.4, 0.15, 1.6, -0.3, 0.06, COL.floor);                                      // the paved strip by the front

    // ---- the flagpole with the Estonian pennant, hanging
    {
      const [x, z] = at(3.6, 3.8), y = h(x, z);
      p.add(new THREE.CylinderGeometry(0.045, 0.07, 10.5, 8), 0xf2f2f0, x, y + 5.25, z);
      p.add(new THREE.SphereGeometry(0.09, 8, 6), 0xd8d8d2, x, y + 10.55, z);
      [0x0072ce, 0x111111, 0xf4f4f2].forEach((c, k) => p.add(BOX(0.11, 3.2, 0.02), c, x + 0.1 + k * 0.11, y + 8.7, z + 0.02, H.YAW));
    }

    // ---- the hedge over the mesh fence along Kubjaringi; the fence alone along Hariduse
    const HEDGE = [[3905.0, -2125.8], [3907.5, -2138.9], [3910.5, -2149.3], [3914.6, -2168.0], [3915.5, -2172.5]];
    A.hedge(HEDGE, 2.0, 1.1);
    A.mesh(HEDGE.map(([x, z]) => [x - 0.62, z - 0.12]), 1.5, 0x2f4a38);
    A.mesh([[3904.4, -2125.9], [3913.3, -2124.4], [3923.6, -2122.7]], 1.5, 0x2f4a38);

    // ---- the back garden: the playhouse and the swing
    A.shed(H, 0.5, -24, 2.2, 2.0, 1.6, 1.95, COL.white, 0x3a3b40);           // (shed() makes the roof about three times ridge - wall high)
    A.swing(H, 6.0, -25, 2.6);

    // ---- the pond side of Kubjaringi tänav
    const rv = (q) => R.sv(q[0], q[1]);
    // concrete flower planters along the road edge, each with its flowers
    const flowers = [0xd04a8a, 0xf0f0f2, 0x9b5bc4, 0xe86a7a];
    for (const t of [11, 20, 29, 38, 47]) {
      const gy = h(...R.at(t, -4.0));
      box(R, t, -4.0, 1.1, 0.7, 0, 0.45, 0xb5b2aa, gy);
      box(R, t, -4.0, 0.95, 0.55, 0.45, 0.6, 0x4d6b3d, gy);
      for (let k = 0; k < 6; k++) {
        const [x, z] = R.at(t - 0.35 + (k % 3) * 0.35, -4.15 + Math.floor(k / 3) * 0.3);
        p.add(new THREE.IcosahedronGeometry(0.12, 0), flowers[(k + t) % 4], x, gy + 0.68, z);
      }
    }
    // the street lamp and the big boulder at its foot, the field boulders
    A.lamp(...R.at(25.7, -5.0), [0.972, 0.234], 7.5, 1.6);
    const boulders = [[3901.0, -2168.9, 0.6], [3899.2, -2178.2, 0.55], [3897.8, -2195.5, 0.32], [3899.2, -2198.0, 0.3], [3900.6, -2200.6, 0.34],
      [3902.0, -2203.1, 0.28], [3903.4, -2205.7, 0.32]];
    for (let x = 3858; x < 3880; x += 3.1) boulders.push([x, -2137.4 + ((x * 3) % 1) * 0.6, 0.25 + ((x * 7) % 1) * 0.12]);     // along Hariduse
    for (const [x, z, r] of boulders) {
      const geo = new THREE.IcosahedronGeometry(r, 0).scale(1.15, 0.7, 1).rotateY(x * 1.7);
      p.add(geo, 0x8d8a83, x, h(x, z) + r * 0.35, z);
    }
    // the green wheelie bin and the information board on two posts with its little roof, facing the road
    box(R, 34.2, -5.6, 0.6, 0.72, 0, 1.0, 0x2f6b3a);
    box(R, 34.2, -5.6, 0.66, 0.78, 1.0, 1.06, 0x2a5f34);
    {
      const s = 38.6, v = -6.4, gy = h(...R.at(s, v));
      for (const e of [-0.65, 0.65]) box(R, s + e, v, 0.1, 0.1, 0, 2.3, 0x5a4232, gy);
      box(R, s, v, 1.25, 0.08, 1.0, 2.0, 0x5a4232, gy);
      box(R, s, v, 1.6, 0.6, 2.3, 2.38, 0x4a3628, gy);
      const [x, z] = R.at(s, v + 0.07);
      signPlate(group, x, gy + 1.5, z, Math.atan2(0.972, 0.234), 1.1, 0.85, (c, w, hh) => {
        c.fillStyle = '#e9e4d6'; c.fillRect(0, 0, w, hh);
        c.fillStyle = '#7fae6a'; c.fillRect(w * 0.06, hh * 0.08, w * 0.58, hh * 0.84);
        c.fillStyle = '#4f86b8'; c.beginPath(); c.ellipse(w * 0.3, hh * 0.45, w * 0.17, hh * 0.3, 0.3, 0, 7); c.fill();
        c.fillStyle = '#5a5552'; for (let k = 0; k < 7; k++) c.fillRect(w * 0.7, hh * (0.12 + k * 0.11), w * (0.2 - (k % 3) * 0.04), hh * 0.035);
      });
    }
    // the bench looking over the pond
    {
      const s = 41.5, v = -9.5, gy = h(...R.at(s, v));
      box(R, s, v, 1.7, 0.45, 0.42, 0.48, 0x7a5a42, gy);
      box(R, s, v - 0.2, 1.7, 0.06, 0.5, 0.9, 0x7a5a42, gy);
      for (const e of [-0.7, 0.7]) box(R, s + e, v, 0.08, 0.4, 0, 0.45, 0x3a3a3e, gy);
    }
    // the jetty from the beach into the pond, a short rail at its end; the pile of cut reeds beside it
    {
      const a = [3890.2, -2190.9], b = [3882.0, -2192.4], F = frame(a, [b[0] - a[0], b[1] - a[1]]), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const wl = world.waterLevelAt ? world.waterLevelAt(...b) : h(...b) - 0.3, deck = Math.max(wl + 0.35, h(...a) + 0.05);
      box(F, len / 2, 0, len, 2.3, deck - 0.1 - h(...F.at(len / 2, 0)), deck - h(...F.at(len / 2, 0)), 0xb3a68f);
      for (let s = 0.4; s < len; s += 1.0) box(F, s, 0, 0.04, 2.3, deck + 0.001 - h(...F.at(s, 0)), deck + 0.004 - h(...F.at(s, 0)), 0x8f8471);
      for (const s of [0.3, len / 2, len - 0.3]) for (const v of [-1.05, 1.05]) box(F, s, v, 0.14, 0.14, deck - 1.4 - h(...F.at(s, v)), deck - 0.1 - h(...F.at(s, v)), 0x4a4038);
      for (const v of [-1.05, 1.05]) box(F, len - 0.15, v, 0.07, 0.07, deck - h(...F.at(len, v)), deck + 0.9 - h(...F.at(len, v)), 0x9a9da2);
      box(F, len - 0.15, 0, 0.06, 2.2, deck + 0.85 - h(...F.at(len, 0)), deck + 0.92 - h(...F.at(len, 0)), 0x9a9da2);
      const reed = new THREE.IcosahedronGeometry(1, 1).scale(1.8, 0.45, 1.1).rotateY(0.6);
      p.add(reed, 0xa59873, 3888.4, h(3888.4, -2196.6) + 0.12, -2196.6);
    }
    // the portable toilet by the corner and its round bushes by the water
    box(R, rv([3894.2, -2130.0])[0], rv([3894.2, -2130.0])[1], 1.15, 1.15, 0, 2.2, 0x2c5e43);
    box(R, rv([3894.2, -2130.0])[0], rv([3894.2, -2130.0])[1], 1.25, 1.25, 2.2, 2.32, 0xd5d5ce);
    A.bushes([[3872.0, -2150.5, 3.4, 2.4], [3866.5, -2153.0, 3.0, 2.2], [3876.5, -2148.0, 2.6, 1.9]]);
    // the plates under the no-parking signs: the arrows up and down (the sign applies both ways)
    for (const [x, z] of [[3896.6, -2136.5], [3915.0, -2176.0]]) {
      signPlate(group, x, h(x, z) + 1.93, z + 0.05, 0, 0.3, 0.22, (c, w, hh) => {
        c.fillStyle = '#f4f2f0'; c.fillRect(0, 0, w, hh); c.strokeStyle = '#18161c'; c.lineWidth = w * 0.04; c.strokeRect(w * 0.04, w * 0.04, w * 0.92, hh - w * 0.08);
        c.fillStyle = '#18161c'; c.fillRect(w * 0.47, hh * 0.25, w * 0.06, hh * 0.5);
        c.beginPath(); c.moveTo(w * 0.5, hh * 0.12); c.lineTo(w * 0.62, hh * 0.32); c.lineTo(w * 0.38, hh * 0.32); c.fill();
        c.beginPath(); c.moveTo(w * 0.5, hh * 0.88); c.lineTo(w * 0.62, hh * 0.68); c.lineTo(w * 0.38, hh * 0.68); c.fill();
      });
    }

    // the zebra across the mouth of Kubjaringi tänav, on the footway line along Hariduse (half-metre stripes
    // lying along the street they cross)
    const Z = frame([3897.67, -2125.6], [0.294, -0.956]);
    for (let v = -3.25; v + 0.5 <= 3.3; v += 1.0) A.pave(Z, -1.25, 1.25, v, v + 0.5, 'white');

    FK.finish();
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 450) return;
      if ([[3922, -2140], [3905, -2165], [3888, -2192], [3894, -2130]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
