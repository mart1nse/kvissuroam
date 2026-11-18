// The Lai tn / Vabaduse pst junction by the Vabadussild bridge as rebuilt in 2026 (Martin, 18 Nov), taken
// from the city's plan (Tinter-Projekt, "Tartu, Lai tn ja Vabaduse pst ristmiku rekonstrueerimine",
// Asendiplaan TL_4-1, 1:500, L-Est 97) and its video renders. The plan's vector layers were turned into
// game coordinates in lai.json:
//   areas.road   asphalt (the terrain paints it as kerbed street)
//   areas.cycle  the cycle tracks, asphalt with a lilac touch
//   areas.paver  grey concrete-block pavements
//   areas.setts  the cobbled (sett) traffic islands
//   areas.grass  the grass verges and islands
//   red          the red-painted cycle crossings between the dotted lines
//   marks        every white road marking of the plan: lane lines, zebras, stop lines, arrows, the 30 ovals
//   lines        the bike symbols and small arrows on the cycle tracks
// Street names are never painted on the ground (Martin, 18 Nov).
import * as THREE from 'three';
import DATA from './lai.json';
import { paverTex, lawnTex } from '../world/streetkit.js';
import { drapeGeometry } from '../world/drape.js';

const BOX = [1370, 2296, 1515, 2440];
const COL = { cycle: 0xb2a8c8, setts: 0xd9c3cf, red: 0xe9868f, white: 0xfaf8ff };
const ZEBRA = 7;
const MAX_EDGE = 1.5;                       // triangles are split down to this so they follow the ground

const inBox = (x, z) => x > BOX[0] && x < BOX[2] && z > BOX[1] && z < BOX[3];
function inRing(x, z, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i], b = r[j];
    if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
const inShape = (x, z, s) => inRing(x, z, s[0]) && !s.slice(1).some((h) => inRing(x, z, h));
// which surface of the plan is at (x, z), or null outside it
export function laiSurface(x, z) {
  if (!inBox(x, z)) return null;
  for (const k of ['grass', 'cycle', 'setts', 'paver', 'road']) if (DATA.areas[k].some((s) => inShape(x, z, s))) return k;
  return null;
}

// before the terrain and the road markings are built: the plan's road is painted as kerbed asphalt, its
// paving stays hard ground, its grass is no road; no generated lines inside it (it has its own)
export function laiVectors(vectors) {
  const prev = vectors.markSkip;
  vectors.markSkip = (x, z) => laiSurface(x, z) !== null || (prev ? prev(x, z) : false);
  const cover = { road: '#ff0', cycle: '#f00', setts: '#f00', paver: '#f00', grass: '#000' };
  const over = (vectors.overPaint ||= []);
  for (const [k, list] of Object.entries(DATA.areas)) for (const s of list) over.push({ outer: s[0], holes: s.slice(1), cover: cover[k] });
}

// props layer: the map's zebra crossings and anything standing on the new carriageway go
export function laiClear(data, out) {
  for (const [key, a] of Object.entries(data.sectors)) {
    for (let k = 0; k < a.length; k += data.stride) {
      const x = a[k + 1], z = a[k + 2];
      if (!inBox(x, z)) continue;
      const s = laiSurface(x, z);
      if ((a[k] === ZEBRA && s) || s === 'road') out.add(`${key}:${k / data.stride}`);
    }
  }
}

export function createLai(world, group) {
  let built = false;
  const corners = [[BOX[0], BOX[1]], [BOX[2], BOX[1]], [BOX[0], BOX[3]], [BOX[2], BOX[3]]];

  const drape = (shapes, lift, tile) => drapeGeometry(world, shapes, lift, tile, MAX_EDGE);
  const mat = (opts, f) => new THREE.MeshLambertMaterial({ ...opts, polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f, side: THREE.DoubleSide });
  const add = (g, m) => { if (!g) return; const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; group.add(mesh); };
  // thin lines (bike symbols) as 9 cm ribbons
  function ribbons(lines, w) {
    const shapes = [];
    for (const l of lines) {
      for (let k = 0; k < l.length - 1; k++) {
        const [ax, az] = l[k], [bx, bz] = l[k + 1], len = Math.hypot(bx - ax, bz - az);
        if (len < 1e-3) continue;
        const nx = (-(bz - az) / len) * w / 2, nz = ((bx - ax) / len) * w / 2;
        shapes.push([[[ax - nx, az - nz], [bx - nx, bz - nz], [bx + nx, bz + nz], [ax + nx, az + nz]]]);
      }
    }
    return shapes;
  }

  function build() {
    built = true;
    const sett = paverTex([224, 200, 212], 11);
    sett.repeat.set(1, 2);                                   // square 10 cm setts from the 20 x 10 cm bond
    add(drape(DATA.areas.grass, 0.06, 4), mat({ map: lawnTex() }, -3));
    add(drape(DATA.areas.paver, 0.075, 1.6), mat({ map: paverTex([208, 206, 218], 3) }, -4));
    add(drape(DATA.areas.setts, 0.075, 1.6), mat({ map: sett }, -4));
    add(drape(DATA.areas.cycle, 0.07, 1), mat({ color: COL.cycle }, -4));
    add(drape(DATA.red.map((q) => [q]), 0.08, 1), mat({ color: COL.red }, -5));
    add(drape([...DATA.marks, ...ribbons(DATA.lines, 0.09)], 0.09, 1), mat({ color: COL.white }, -6));
  }

  return {
    update(x, z) {
      if (built || Math.hypot(x - 1445, z - 2365) > 700) return;
      if (corners.every(([cx, cz]) => world.ready(cx, cz))) build();
    },
  };
}
