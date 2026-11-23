// Street lights and wooden poles standing implausibly close together. The surveyed props
// (Mapillary map features, public/data/props.json) are triangulated from dashcam photos, and one real
// post seen from several photos often comes out as two, three or four posts a few metres apart: four
// street lights within 10 m, a wooden pole beside every lamp. Real streets light at 25 to 40 m on a side.
// This keeps the most central post of each such cluster and leaves the rest out, so that lamps on one
// side of a road stand at least LIGHT_GAP apart and wooden poles at least POLE_GAP. Posts on opposite
// sides of a road or cycle path may stand closer (ACROSS_GAP): real streets light both sides. A wooden
// pole within SAME_POST of a street light is the same post seen twice: the light stays.
// Nothing is touched near the lap or in the places built by hand (keep-out zones, see handZones below).
// Runs after src/world/roadprops.js in the props clear hook (src/main.js). `?thin=off` turns it off.
// Check: node tools/prop-spacing-check.mjs [--list]

const LIGHT = 0, POLE = 1;
export const LIGHT_GAP = 10, POLE_GAP = 14, ACROSS_GAP = 6, SAME_POST = 2.5;
// roads whose two sides each get their own row of lights
const CARRY = new Set(['Tänav', 'Põhimaantee', 'Tugimaantee', 'Kõrvalmaantee', 'Ramp või ühenduste', 'Muu tee', 'Kergliiklustee']);
const CELL = 32;

// The city centre round the lap (Toomemägi, Kaubamaja, Keskus, Küüni, Pepleri, Vanemuise, Kroonuaia,
// Jakobi, Baeri, Veski, Emajõe, Playtech, Delta, Orident) is all hand-built or raced through: left alone
// whole. The places built by hand further out each get a circle. Add a new hand-built place here.
export const CENTRE_BOX = { x0: 400, x1: 1950, z0: 1950, z1: 3700 };
export const HAND_PLACES = [
  { name: 'Kvissentali tee and the start', x: 80, z: -10, r: 300 },
  { name: 'Pootsmani', x: -283, z: 115, r: 250 },
  { name: 'Coop Konsum, Aruküla tee', x: 527, z: 481, r: 200 },
  { name: 'Sireli 7a, Kõrveküla', x: 4020, z: -2310, r: 200 },
  { name: 'Jänese 1', x: 1990, z: 1505, r: 200 },
  { name: 'Arhitekti 24-28', x: -968, z: 4156, r: 200 },
  { name: 'Elva 35b', x: 238, z: 4755, r: 200 },
  { name: 'Äksi, Ice Age Centre, Angerja', x: -1830, z: -13230, r: 350 },
  { name: 'Nõela village road', x: -7040, z: -7130, r: 620 },
  { name: 'Raadi, Keskuse tee and the route 95 roundabout', x: 2450, z: -360, r: 520 },
  { name: 'Lõunakeskus, Hotel Sophia, Teaduspark', x: -1150, z: 5440, r: 300 },
  { name: 'Valguse and Optika strip', x: -1260, z: 5000, r: 300 },
  { name: 'Ringtee and Riia junction', x: -880, z: 5680, r: 330 },
  { name: 'K-Rauta, Riia 140, Selver Teemandi', x: -520, z: 5650, r: 360 },
  { name: 'Riia road houses, Riia 128 to Sõinaste', x: -180, z: 4890, r: 330 },
  { name: 'Turu tänav, the Soola corner', x: 1960, z: 3200, r: 200 },
  { name: 'Turu tänav, AHHAA and Tigutorn', x: 2150, z: 3220, r: 110 },
  { name: 'Riia tänav, Riia Kvartal to Pauluse church', x: 1201.6, z: 3745.6, r: 230 },
  { name: 'Riia tänav, Kastani to the railway bridge', x: 948.8, z: 3957.5, r: 175 },
  { name: 'Riia tänav, Lembitu to Väike kaar', x: 726.7, z: 4143.7, r: 160 },
  { name: 'Riia tänav, Väike kaar to Suur kaar', x: 427.9, z: 4394.1, r: 250 },
  { name: 'Riia tänav, Suur kaar to the Ravila lights', x: 167.5, z: 4612.3, r: 140 },
  { name: 'Ravila tänav, Riia to Nooruse', x: -6, z: 4577, r: 150 },
  { name: 'Ravila tänav, Tulika to Viljandi mnt', x: -333, z: 4130, r: 130 },
  { name: 'Astelpaju: Mööbliait, Circle K, Magaziin', x: 535, z: -60, r: 120 },
  { name: 'Kvissentali tee, Lootsi to road 3', x: 330, z: -45, r: 150 },
  { name: 'ERM, its car park and the distillery ruin', x: 2690, z: 1040, r: 260 },
  { name: 'Tartu Airport: terminal, car park, hangars', x: -170, z: 10680, r: 230 },
  { name: 'Lennuakadeemia and Lennu 42', x: 20, z: 10600, r: 150 },
  { name: 'Ülenurme Konsum, Võru mnt 2', x: 1690, z: 10085, r: 90 },
  { name: 'Aovere: the three houses on Aasa tee', x: 6605, z: -5005, r: 110 },
  { name: 'Aovere: Alrey farm on road 43', x: 6195, z: -5220, r: 60 },
  { name: 'Aovere: the farm on Kiigi tee', x: 6935, z: -4645, r: 70 },
  { name: 'Aovere: the farm at the end of Aasa tee', x: 6850, z: -5095, r: 70 },
  { name: 'Aovere: Tõumesila bee farm, Kiigi tee', x: 7290, z: -4765, r: 75 },
];

// segments of the road centre lines in a coarse grid
function segGrid(roads) {
  const grid = new Map();
  for (const r of roads) {
    if (!CARRY.has(r.type) || r.pts.length < 2) continue;
    for (let i = 1; i < r.pts.length; i++) {
      const [ax, az] = r.pts[i - 1], [bx, bz] = r.pts[i];
      const seg = [ax, az, bx, bz];
      for (let gx = Math.floor(Math.min(ax, bx) / CELL); gx <= Math.floor(Math.max(ax, bx) / CELL); gx++) {
        for (let gz = Math.floor(Math.min(az, bz) / CELL); gz <= Math.floor(Math.max(az, bz) / CELL); gz++) {
          const k = gx * 100003 + gz;
          let list = grid.get(k);
          if (!list) grid.set(k, (list = []));
          list.push(seg);
        }
      }
    }
  }
  return grid;
}

const cross = (ax, az, bx, bz, cx, cz) => (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
function intersects(p, q, s) {
  const d1 = cross(s[0], s[1], s[2], s[3], p[0], p[1]), d2 = cross(s[0], s[1], s[2], s[3], q[0], q[1]);
  const d3 = cross(p[0], p[1], q[0], q[1], s[0], s[1]), d4 = cross(p[0], p[1], q[0], q[1], s[2], s[3]);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

// keep-out test from the zones: the centre box, the hand places, and circles { x, z, r } (the lap,
// hand-placed props, bus stops, hand-painted ground)
export function handZones(circles = []) {
  const grid = new Map(), G = 100;
  for (const c of [...HAND_PLACES, ...circles]) {
    for (let gx = Math.floor((c.x - c.r) / G); gx <= Math.floor((c.x + c.r) / G); gx++) {
      for (let gz = Math.floor((c.z - c.r) / G); gz <= Math.floor((c.z + c.r) / G); gz++) {
        const k = gx * 100003 + gz;
        let l = grid.get(k);
        if (!l) grid.set(k, (l = []));
        l.push(c);
      }
    }
  }
  const B = CENTRE_BOX;
  return (x, z) => {
    if (x > B.x0 && x < B.x1 && z > B.z0 && z < B.z1) return true;
    for (const c of grid.get(Math.floor(x / G) * 100003 + Math.floor(z / G)) || []) if ((x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return true;
    return false;
  };
}

// thinProps(data, vectors, kept, skip) returns { cleared: Set of ids, removed: [{ id, kind, at, by, road }] }
// kept(x, z) is true where nothing may be removed; skip holds ids already left out.
export function thinProps(data, vectors, kept, skip = new Set()) {
  const roads = segGrid(vectors.roads);
  const across = (p, q) => {
    const seen = new Set();
    for (let gx = Math.floor(Math.min(p[0], q[0]) / CELL); gx <= Math.floor(Math.max(p[0], q[0]) / CELL); gx++) {
      for (let gz = Math.floor(Math.min(p[1], q[1]) / CELL); gz <= Math.floor(Math.max(p[1], q[1]) / CELL); gz++) {
        for (const s of roads.get(gx * 100003 + gz) || []) {
          if (seen.has(s)) continue;
          seen.add(s);
          if (intersects(p, q, s)) return true;
        }
      }
    }
    return false;
  };
  // the posts that take part: lights and wooden poles outside the keep-out zones, not already left out
  const posts = [];
  for (const [key, a] of Object.entries(data.sectors)) {
    for (let k = 0; k < a.length; k += data.stride) {
      const kind = a[k];
      if (kind !== LIGHT && kind !== POLE) continue;
      const id = `${key}:${k / data.stride}`;
      if (skip.has(id)) continue;
      posts.push({ id, kind, x: a[k + 1], z: a[k + 2], fixed: kept(a[k + 1], a[k + 2]), out: false });
    }
  }
  const G = 16, grid = new Map();
  for (const p of posts) {
    const k = Math.floor(p.x / G) * 100003 + Math.floor(p.z / G);
    let l = grid.get(k);
    if (!l) grid.set(k, (l = []));
    l.push(p);
  }
  const near = (p, r) => {
    const out = [];
    for (let gx = Math.floor((p.x - r) / G); gx <= Math.floor((p.x + r) / G); gx++) {
      for (let gz = Math.floor((p.z - r) / G); gz <= Math.floor((p.z + r) / G); gz++) {
        for (const q of grid.get(gx * 100003 + gz) || []) if (q !== p && (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < r * r) out.push(q);
      }
    }
    return out;
  };
  const removed = [], cleared = new Set();
  const drop = (p, by) => { p.out = true; cleared.add(p.id); removed.push({ id: p.id, kind: p.kind, at: [p.x, p.z], by: by.id }); };
  // 1. a wooden pole on the spot of a street light is the same post
  for (const p of posts) {
    if (p.kind !== POLE || p.fixed) continue;
    const lamp = near(p, SAME_POST).find((q) => q.kind === LIGHT);
    if (lamp) drop(p, lamp);
  }
  // 2. per kind, the most central post of a cluster stays and its too-close neighbours on the same side go
  for (const [kind, gap] of [[LIGHT, LIGHT_GAP], [POLE, POLE_GAP]]) {
    const live = posts.filter((p) => p.kind === kind && !p.out);
    const close = new Map();
    for (const p of live) {
      close.set(p, near(p, gap).filter((q) => q.kind === kind && !q.out
        && ((q.x - p.x) ** 2 + (q.z - p.z) ** 2 < ACROSS_GAP * ACROSS_GAP || !across([p.x, p.z], [q.x, q.z]))));
    }
    // posts in the keep-out zones are always kept; then the ones with most close neighbours first
    live.sort((a, b) => (b.fixed - a.fixed) || (close.get(b).length - close.get(a).length) || (a.id < b.id ? -1 : 1));
    for (const p of live) {
      if (p.out) continue;
      for (const q of close.get(p)) if (!q.out && !q.fixed) drop(q, p);
    }
  }
  return { cleared, removed };
}
