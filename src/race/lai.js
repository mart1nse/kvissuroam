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
import { paverTex } from '../world/streetkit.js';
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

// the verges' grass (Martin, 19 Nov): darker than the street lawns, with soft clumps of darker and
// sun-yellowed grass, short blades and a few clover and daisy dots; 512 px tile = 10 m, seamless
function vergeTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d'), w = 512;
  let seed = 23;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#6ea85a'; g.fillRect(0, 0, w, w);
  const blob = (x, y, rad, col) => {
    for (const ox of [-w, 0, w]) for (const oy of [-w, 0, w]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    }
  };
  const clumps = ['rgba(78,138,66,0.55)', 'rgba(92,152,74,0.5)', 'rgba(140,186,96,0.45)', 'rgba(168,184,98,0.35)', 'rgba(70,124,72,0.5)'];
  for (let k = 0; k < 70; k++) blob(r() * w, r() * w, 20 + r() * 70, clumps[(r() * clumps.length) | 0]);
  const blades = ['rgba(64,118,58,0.7)', 'rgba(98,158,80,0.6)', 'rgba(132,182,100,0.55)', 'rgba(84,140,70,0.65)', 'rgba(158,188,108,0.45)'];
  for (let k = 0; k < 14000; k++) {
    const x = r() * w, y = r() * w, l = 2 + r() * 5, a = -Math.PI / 2 + (r() - 0.5) * 1.2;
    g.strokeStyle = blades[(r() * blades.length) | 0]; g.lineWidth = 1 + r() * 0.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let k = 0; k < 160; k++) {                       // clover patches: darker round leaves
    const x = r() * w, y = r() * w;
    g.fillStyle = 'rgba(60,112,62,0.6)';
    for (let q = 0; q < 6; q++) { g.beginPath(); g.arc(x + (r() - 0.5) * 8, y + (r() - 0.5) * 8, 1.6 + r(), 0, Math.PI * 2); g.fill(); }
  }
  const flowers = ['rgba(255,255,250,0.9)', 'rgba(255,236,150,0.9)', 'rgba(222,196,240,0.85)'];
  for (let k = 0; k < 110; k++) { g.fillStyle = flowers[(r() * 3) | 0]; g.beginPath(); g.arc(r() * w, r() * w, 0.9 + r() * 0.9, 0, Math.PI * 2); g.fill(); }
  // muted toward the olive-brown of the orthophoto grass around it, so the edge does not jump out
  const img = g.getImageData(0, 0, w, w), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.3 * d[i] + 0.55 * d[i + 1] + 0.15 * d[i + 2];
    d[i] = l + (d[i] - l) * 0.5 + 8; d[i + 1] = l + (d[i + 1] - l) * 0.5 - 4; d[i + 2] = l + (d[i + 2] - l) * 0.5 - 6;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
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
    add(drape(DATA.areas.grass, 0.06, 10), mat({ map: vergeTex() }, -3));
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
