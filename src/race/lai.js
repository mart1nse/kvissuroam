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
import { paverTex, grassTex } from '../world/streetkit.js';
import { drapeGeometry } from '../world/drape.js';

const BOX = [1370, 2296, 1515, 2440];
const COL = { cycle: 0xb2a8c8, setts: 0xd9c3cf, red: 0xe9868f, white: 0xfaf8ff };
const ZEBRA = 7;
const ISLE = { h: 0.1, edge: 0.06, face: 0xa9a5b5 };
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

  // ---- the traffic islands (the holes in the plan's road) stand on a 10 cm kerb (Martin, 19 Nov). The
  // raised top reaches a few centimetres past the island's edge, rounded, so the setts and grass draped on
  // the ground stay flat right to the edge, and the kerb stones are drawn round them in build().
  const islands = DATA.areas.road[0].slice(1).map((r) => {
    const xs = r.map((p) => p[0]), zs = r.map((p) => p[1]);
    return { r, x0: Math.min(...xs) - ISLE.edge, x1: Math.max(...xs) + ISLE.edge, z0: Math.min(...zs) - ISLE.edge, z1: Math.max(...zs) + ISLE.edge };
  });
  const segDist = (x, z, a, b) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
    const u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
    return Math.hypot(x - a[0] - dx * u, z - a[1] - dz * u);
  };
  for (const I of islands) {
    world.addBump({
      x0: I.x0, z0: I.z0, x1: I.x1, z1: I.z1,
      at(x, z) {
        if (x < I.x0 || x > I.x1 || z < I.z0 || z > I.z1) return 0;
        if (inRing(x, z, I.r)) return ISLE.h;
        let d = Infinity;
        for (let k = 0, j = I.r.length - 1; k < I.r.length; j = k++) d = Math.min(d, segDist(x, z, I.r[j], I.r[k]));
        if (d >= ISLE.edge) return 0;
        const u = 1 - d / ISLE.edge;
        return ISLE.h * u * u * (3 - 2 * u);
      },
    });
  }

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
    add(drape(DATA.areas.grass, 0.06, 10), mat({ map: grassTex() }, -3));    // the verges: the shared grass (grassTex in streetkit.js) began here
    add(drape(DATA.areas.paver, 0.075, 1.6), mat({ map: paverTex([208, 206, 218], 3) }, -4));
    add(drape(DATA.areas.setts, 0.075, 1.6), mat({ map: sett }, -4));
    add(drape(DATA.areas.cycle, 0.07, 1), mat({ color: COL.cycle }, -4));
    add(drape(DATA.red.map((q) => [q]), 0.08, 1), mat({ color: COL.red }, -5));
    add(drape([...DATA.marks, ...ribbons(DATA.lines, 0.09)], 0.09, 1), mat({ color: COL.white }, -6));
    // the kerb stones round the islands: from the road up to the setts, just outside the rounded edge
    const pos = [];
    for (const { r } of islands) {
      const n = r.length;
      for (let k = 0; k < n; k++) {
        const a = r[k], b = r[(k + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
        if (l < 0.02) continue;
        const cw = inRing((a[0] + b[0]) / 2 - dz / l * 0.05, (a[1] + b[1]) / 2 + dx / l * 0.05, r) ? -1 : 1;
        const o = ISLE.edge + 0.01, nx = (-dz / l) * cw * o, nz = (dx / l) * cw * o;     // out from the island
        const foot = (p) => [p[0] + nx, p[1] + nz], top = (p) => [p[0] + nx * 0.2, p[1] + nz * 0.2];
        const A = foot(a), B = foot(b), C = top(a), D = top(b);
        const yA = world.heightAt(A[0], A[1]) - 0.03, yB = world.heightAt(B[0], B[1]) - 0.03;
        const yC = world.heightAt(C[0], C[1]) + 0.07, yD = world.heightAt(D[0], D[1]) + 0.07;
        pos.push(A[0], yA, A[1], B[0], yB, B[1], C[0], yC, C[1], C[0], yC, C[1], B[0], yB, B[1], D[0], yD, D[1]);
      }
    }
    if (pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      add(g, mat({ color: ISLE.face }, -2));
    }
  }

  return {
    update(x, z) {
      if (built || Math.hypot(x - 1445, z - 2365) > 700) return;
      if (corners.every(([cx, cz]) => world.ready(cx, cz))) build();
    },
  };
}
