// Raadi, batch 3 of Martin's outline (20 Nov): the west end of Mõisapiiri tänav (2, 4, 6, 8, 9), the
// Mõisahärra loop (1, 2, 3, 4, 6, 7, 8, 10) and the tongue down Aadliku tänav (1, 2, 3, 4, 5, 7),
// dressed from the Land Board's oblique air photos (2024) and the orthophoto.
// The map's own blocks keep their shapes; their walls are painted and their roofs coloured. The door goes on
// the wall that looks most at the nearest street. Window counts and the backs are guessed from the air.
// No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses, wallPlanes } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';

const SEC = '4_0', ORIGIN = [1760, -800];
const DEBUG = typeof location !== 'undefined' && /raadidebug/.test(location.search);

// name, base, centre, reach, wall colour, roof colour, wall rgb for the painter
const HOUSES = [
  ['mp2', 1709, [2120.0, -332.0], 14, 0xe8d898, 0x5c5e62, [236, 222, 152]],
  ['mp4', 1750, [2157.0, -324.0], 14, 0xf0eee8, 0x3e3a38, [240, 238, 232]],
  ['mp6', 1809, [2199.0, -314.0], 14, 0xf0eee8, 0x6c7680, [240, 238, 232]],
  ['mp8', 1825, [2232.0, -312.0], 13, 0xeeeae2, 0x3c3e42, [238, 234, 226]],
  ['mp9', 1703, [2048.0, -325.5], 16, 0xf0eee8, 0x3c3e42, [240, 238, 232]],
  ['mh1', 1759, [2104.5, -294.0], 15, 0xeee6d0, 0x3c3e42, [238, 232, 214]],
  ['mh1g', 1722, [2089.5, -316.0], 8, 0xeee6d0, 0x47494d, [238, 232, 214]],
  ['mh2', 1762, [2061.0, -267.0], 14, 0xf0eee8, 0x3c3e42, [240, 238, 232]],
  ['mh3', 1757, [2142.5, -280.5], 14, 0xf0eee8, 0x34363a, [240, 238, 232]],
  ['mh4', 1712, [2094.5, -256.5], 16, 0xece2c6, 0x3c3e42, [236, 226, 198]],
  ['mh6', 1751, [2125.0, -242.5], 15, 0xf0eee8, 0x34363a, [240, 238, 232]],
  ['mh7', 1837, [2217.0, -253.0], 14, 0xf0eee8, 0x3c3e42, [240, 238, 232]],
  ['mh8', 1785, [2160.5, -232.0], 14, 0xe4d8c0, 0x34363a, [228, 216, 192]],
  ['mh10', 1825, [2199.4, -221.3], 13, 0xf0eee8, 0x3c3e42, [240, 238, 232]],
  ['ad1', 1720, [2036.0, -215.5], 15, 0xf2f0ea, 0x2e3034, [242, 240, 234]],
  ['ad2', 1689, [2000.5, -185.0], 15, 0xe8dcb8, 0x55585c, [232, 220, 184]],
  ['ad3', 1732, [2072.5, -201.0], 14, 0xf0eee8, 0x3a3c40, [240, 238, 232]],
  ['ad4', 1674, [2034.0, -178.0], 14, 0xf0eee8, 0x44464a, [240, 238, 232]],
  ['ad5', 1752, [2108.5, -187.5], 14, 0xf0eee8, 0x5a5e64, [240, 238, 232]],
  ['ad7', 1784, [2143.0, -178.0], 14, 0xf0eee8, 0x3c3e42, [240, 238, 232]],
];
export function raadi3Walls(walls) {
  setHouseColours(walls, SEC, ...ORIGIN, HOUSES.map(([, base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
}

// tall thuja rows between the plots (dark lines on the orthophoto, tall hedges on the oblique photos)
const HEDGES = [
  [[2137.5, -341.0], [2128.5, -308.0], [2121.0, -281.0]],      // between Mõisapiiri 2 and 4, on to Mõisahärra 1
  [[2176.0, -333.0], [2168.5, -305.0], [2165.0, -297.0]],      // between Mõisapiiri 4 and 6
];
const TRAMPOLINES = [[2144.8, -298.2], [2081.0, -308.0], [2084.0, -247.0], [2152.0, -215.0]];

const modern = (o = {}) => ({ T: false, bars: 1, rails: 0, surround: 0, frame: '#2f3136', glass: '#3f4b58', sill: 0.05, w: 1.5, pitch: 3.2, ...o });
const facing = (W, p) => { const tx = p[0] - W.mid[0], tz = p[1] - W.mid[1]; return (tx * W.nx + tz * W.nz) / (Math.hypot(tx, tz) || 1); };

// the nearest point on a street (not a cycle path) to a point
// (the streets within 500 m of the area are picked out once: going through every road of the map for each
// of the houses was 90 ms of standstill on the way in)
let streets = null;
function nearestStreet(world, q) {
  if (!streets) {
    streets = [];
    for (const r of world.vectors?.roads || []) {
      if (r.type === 'Kergliiklustee' || !r.pts || r.pts.length < 2) continue;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const a = r.pts[i], b = r.pts[i + 1];
        if (Math.min(Math.abs(a[0] - 2130), Math.abs(b[0] - 2130)) < 500 && Math.min(Math.abs(a[1] + 295), Math.abs(b[1] + 295)) < 500) streets.push(a[0], a[1], b[0], b[1]);
      }
    }
  }
  let best = null, bd = 1e9;
  for (let i = 0; i < streets.length; i += 4) {
    const ax = streets[i], az = streets[i + 1], dx = streets[i + 2] - ax, dz = streets[i + 3] - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((q[0] - ax) * dx + (q[1] - az) * dz) / l2)), px = ax + dx * t, pz = az + dz * t;
    const d = Math.hypot(px - q[0], pz - q[1]);
    if (d < bd) { bd = d; best = [px, pz]; }
  }
  return best;
}

function house(world, H) {
  const [name, base, at, r, , , rgb] = H;
  const small = name.endsWith('g');
  const spec = { kind: 'plaster', wall: rgb, trim: '#f4f2ee', weather: 0.1, plinth: { h: 0.45, col: '#7a7876' }, win: modern(), storey: 3.0, maxFloors: small ? 1 : 2, attic: null, door: '#3a3c40' };
  const out = { name, sec: SEC, base, at, r, spec, walls: [] };
  if (small) return out;
  const street = nearestStreet(world, at);
  if (!street) return out;
  let best = null, bs = -1;
  for (const W of wallPlanes(world, SEC, base, (x, z) => (x - at[0]) ** 2 + (z - at[1]) ** 2 < r * r)) {
    if (W.len < 3 || W.foot > 1.2) continue;
    const f = facing(W, street), score = f > 0.3 ? Math.min(W.len, 9) * f : -1;
    if (score > bs) { bs = score; best = W; }
  }
  if (best) out.walls.push({ near: best.mid, within: 0.4, doors: [{ x: best.len * 0.5, w: 1.1, h: 2.2, col: spec.door, steps: 2, canopy: '#3a3c40' }] });
  return out;
}

export function createRaadi3(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;
  const CENTRE = [2130, -295];

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    skinHouses(world, group, HOUSES.map((H) => house(world, H)), { shadows, ppm: 14, far: 7, debug: DEBUG });
    for (const pts of HEDGES) A.hedge(pts, 3.2, 1.2, [0.42, 0.66, 0.5]);
    for (const [x, z] of TRAMPOLINES) A.trampoline(x, z, 1.8);
    // the glass-roofed pool on the street side of Mõisahärra 1
    const F = frame([2104.5, -307.0], [0.95, 0.31]);
    A.box(F, 0, 0, 10.4, 4.6, -0.05, 0.15, 0xe8e8e6);
    A.box(F, 0, 0, 9.8, 4.0, 0.15, 1.2, 0x9fc6d8);
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 300) return;
      if ([[2048, -325], [2232, -312], [2094, -256], [2000, -185], [2143, -178]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
