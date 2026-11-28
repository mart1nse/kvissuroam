import * as THREE from 'three';
import { createRealTrees } from './realtrees.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { jobs } from '../jobs.js';
import { TALLINN } from '../city.js';
import { lapBeside } from './tln/lapnear.js';
import { treeBags } from './tln/treebags.js';

// ---------------------------------------------------------------- buildings
// The bake gives walls, roofs and one base height per building, but no building ids. Triangles that share
// a base height are one building, which is enough to measure it and pick a facade style for it:
//   0 detached house (boards or plaster)   1 apartment block (panels or brick)   2 shop, hall or shed (cladding)
// Real wall colours come from public/data/walls.json (tools/realism/colours.py): per sector a list of
// base, x, z, colour for each building. Two buildings that share a base height by chance are told apart by it.
// buildings Martin pointed out as red brick (a point inside each, game x, z)
const BRICK = [
  [1314, 2187],        // Kroonuaia / Emajõe corner
  [1458, 3075],        // Vallikraavi 4, the red brick house with the statue
];

// Tallinn's Old Town and Toompea (src/world/tln/centre.js sets the test, game x, z): their houses get style 3, the
// medieval town house (plaster in the Old Town's colours, small deep windows with white frames, a limestone plinth,
// clay tile roofs) and their churches, towers and halls (eaves 14 m up or more) style 3.4, limestone
let oldTown = null;
export function setOldTown(test) { oldTown = test; }
// landmarks in their own colours: [{ x, z, style, rgb, roof }] (game x, z inside the building; style as above, 3.6 for
// whitewashed stone; rgb and roof as 0xrrggbb), src/world/tln/centre.js
let looks = [];
export function setTownLooks(list) { looks = list; }
// what a town's houses are built of (src/world/tln/centre.js: grid(sx, sz) -> a square's points, find(grid, x0, x1, z0,
// z1) -> [x, z, kind, rgb] of the house in that box): kind 1 wood (style 0.3), 2 industrial limestone (3.25), 3 red
// brick, 4 glass, 0 only a colour; rgb its wall colour where OpenStreetMap has one (-1 not), used where no photo did
let facades = null;
export function setFacades(grid, find) { facades = { grid, find }; }

// what three.js makes of each of the 256 steps of a colour channel
const LIN = Float64Array.from({ length: 256 }, (_, v) => new THREE.Color().setRGB(v / 255, 0, 0, THREE.SRGBColorSpace).r);
// (in steps: a square of the centre is 60 to 100 thousand corners, 20 ms on a fast processor and 100 on an
// old one. The loops are plain functions over a range: inside a generator the browser runs them at half speed.)
function* buildingGeometrySteps(sector, walls) {
  const { nv, buf, offset } = sector.buildings;
  let o = offset;
  const pq = new Int16Array(buf.slice(o, o + nv * 6)); o += nv * 6;
  const nq = new Int8Array(buf, o, nv * 3); o += nv * 3;
  const cq = new Uint8Array(buf, o, nv * 3); o += nv * 3;
  const kind = new Uint8Array(buf, o, nv); o += nv;
  const base = new Int16Array(buf.slice(o, o + nv * 2));

  const known = new Map();          // base -> [{x, z, rgb, key}]
  const list = walls && walls.sectors[`${sector.sx}_${sector.sz}`];
  const extra = (walls && walls.extra && walls.extra[`${sector.sx}_${sector.sz}`]) || {};     // hand-set houses: roof colour, reach
  if (list) {
    for (let i = 0; i < list.length; i += 4) {
      let a = known.get(list[i]);
      if (!a) known.set(list[i], (a = []));
      a.push({ x: list[i + 1] * 0.1, z: list[i + 2] * 0.1, rgb: list[i + 3], key: list[i] * 64 + a.length + 1, ...extra[i / 4] });
    }
  }

  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
  const aKind = new Float32Array(nv), aBase = new Float32Array(nv), aInfo = new Float32Array(nv * 3);
  const gkey = new Float64Array(nv);
  const c = new THREE.Color();
  const groups = new Map();
  const corners = (t0, t1) => { for (let t = t0; t < t1; t += 3) {
    // one building per triangle: the known building with this base whose centre is nearest
    let e = null;
    const a = known.get(base[t]);
    const shelter = cq[t * 3] === cq[t * 3 + 1] && (cq[t * 3] === 70 || cq[t * 3] === 60);     // carports and their posts
    if (a) {
      const tx = (pq[t * 3] + pq[t * 3 + 3] + pq[t * 3 + 6]) * 0.05 / 3, tz = (pq[t * 3 + 2] + pq[t * 3 + 5] + pq[t * 3 + 8]) * 0.05 / 3;
      let best = 1e18;
      for (const k of a) { if (shelter !== !!k.shelter) continue; const d = (k.x - tx) ** 2 + (k.z - tz) ** 2; if (d < best && !(k.reach && d > k.reach * k.reach)) { best = d; e = k; } }
    }
    const key = e ? e.key : base[t] * 64;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { b: base[t], x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9, top: -1e9, eaves: 1e9, real: e ? 1 : 0, plain: !!(e && e.plain) }));
    // cut: part of a house is modelled by hand (the triangles whose middle the test picks, given their top)
    const cut = !!(e && e.cut && e.cut(sector.x0 + (pq[t * 3] + pq[t * 3 + 3] + pq[t * 3 + 6]) * 0.05 / 3, sector.z0 + (pq[t * 3 + 2] + pq[t * 3 + 5] + pq[t * 3 + 8]) * 0.05 / 3,
      Math.max(pq[t * 3 + 1], pq[t * 3 + 4], pq[t * 3 + 7]) * 0.01));
    for (let i = t; i < t + 3; i++) {
      const x = pq[i * 3] * 0.05, y = pq[i * 3 + 1] * 0.01, z = pq[i * 3 + 2] * 0.05;
      if (!(e && e.hide) && !cut) { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; }       // a hidden house keeps no triangles
      nor[i * 3] = nq[i * 3] / 127; nor[i * 3 + 1] = nq[i * 3 + 1] / 127; nor[i * 3 + 2] = nq[i * 3 + 2] / 127;
      // (colours from a table of the 256 steps: converting each corner's colour was a third of this function)
      if (e && kind[i] === 1 && e.roof !== undefined) { col[i * 3] = LIN[(e.roof >> 16) & 255]; col[i * 3 + 1] = LIN[(e.roof >> 8) & 255]; col[i * 3 + 2] = LIN[e.roof & 255]; }
      else if (e && kind[i] !== 1) { col[i * 3] = LIN[(e.rgb >> 16) & 255]; col[i * 3 + 1] = LIN[(e.rgb >> 8) & 255]; col[i * 3 + 2] = LIN[e.rgb & 255]; }
      else { col[i * 3] = LIN[cq[i * 3]]; col[i * 3 + 1] = LIN[cq[i * 3 + 1]]; col[i * 3 + 2] = LIN[cq[i * 3 + 2]]; }
      aKind[i] = e && e.plain && kind[i] === 2 ? 0 : kind[i]; aBase[i] = base[i] * 0.01; gkey[i] = key;
      if (x < g.x0) g.x0 = x; if (x > g.x1) g.x1 = x;
      if (z < g.z0) g.z0 = z; if (z > g.z1) g.z1 = z;
      if (y > g.top) g.top = y;
      if (kind[i] === 1 && y < g.eaves) g.eaves = y;       // lowest roof point
    }
  } };
  const PART = 6000;
  for (let t = 0; t < nv; t += PART) { corners(t, Math.min(nv, t + PART)); if (jobs.late()) yield; }
  const fgrid = facades && facades.grid(sector.sx, sector.sz);
  for (const g of groups.values()) {
    const b = g.b;
    g.brick = BRICK.some(([x, z]) => x - sector.x0 > g.x0 && x - sector.x0 < g.x1 && z - sector.z0 > g.z0 && z - sector.z0 < g.z1);     // vertices are sector-relative
    const h = g.top - b * 0.01, area = (g.x1 - g.x0) * (g.z1 - g.z0);
    g.eavesH = Math.min(h, g.eaves > 1e8 ? h : g.eaves - b * 0.01);
    g.style = (h >= 10.5 ? 1 : area > 420 ? 2 : 0) + g.real * 4;      // +4: the wall colour is the real one
    if (g.brick) g.style = 5;                                           // red brick with a real colour
    if (g.plain) g.style = 4;                                           // smooth render in its real colour, windows added by hand
    if (oldTown && !g.plain && oldTown(sector.x0 + (g.x0 + g.x1) / 2, sector.z0 + (g.z0 + g.z1) / 2)) g.style = (h >= 24 && g.eavesH >= 12 ? 3.4 : 3) + g.real * 4;     // (24 m: the churches, towers and the town hall, not the tall 19th-century houses)
    if (TALLINN && h >= 45 && !g.plain && !(g.style >= 3 && g.style < 4) && !(g.style >= 7)) {
      g.style = 2.3 + g.real * 4;                                       // (Tallinn's high-rises: glass)
      g.eavesH = h;                                                     // (glass the whole height, not only up to a podium's roof)
    }
    const F = fgrid && !g.plain && !(g.style >= 3 && g.style < 4) && facades.find(fgrid, sector.x0 + g.x0, sector.x0 + g.x1, sector.z0 + g.z0, sector.z0 + g.z1);
    if (F) {
      const [, , k, rgb] = F, area2 = (g.x1 - g.x0) * (g.z1 - g.z0);
      const real = rgb >= 0 && !g.real ? 1 : g.real;
      if (k === 1 && h >= 4 && h <= 14 && area2 < 900) g.style = 0.3 + real * 4;                  // (a tall one is not wood)
      else if (k === 2) g.style = 3.25 + real * 4;
      else if (k === 3) { g.brick = true; g.style = 5; }
      else if (k === 4 && h >= 8) { g.style = 2.3 + real * 4; g.eavesH = h; }
      // (a kind that does not fit the house keeps only the colour)
      if (k !== 3 && rgb >= 0 && !g.real) { g.look = { rgb }; if (g.style < 4) g.style += 4; }
    }
    for (const L of looks) {
      if (L.x - sector.x0 > g.x0 && L.x - sector.x0 < g.x1 && L.z - sector.z0 > g.z0 && L.z - sector.z0 < g.z1) { g.look = L; g.style = L.style + 4; break; }
    }
    g.seed = g.plain ? 0 : Math.round(((Math.abs(Math.sin(b * 12.9898 + g.x0 * 78.233 + g.z0 * 37.719) * 43758.5453)) % 1) * 1023) / 1023;
  }
  const brick = new THREE.Color().setRGB(0.55, 0.25, 0.18, THREE.SRGBColorSpace);
  const styles = (i0, i1) => { for (let i = i0; i < i1; i++) {
    const g = groups.get(gkey[i]);
    if (g.brick && kind[i] !== 1) { col[i * 3] = brick.r; col[i * 3 + 1] = brick.g; col[i * 3 + 2] = brick.b; }
    const L = g.look, hex = L && (kind[i] === 1 ? L.roof : L.rgb);
    if (hex !== undefined && hex !== null && L) { col[i * 3] = LIN[(hex >> 16) & 255]; col[i * 3 + 1] = LIN[(hex >> 8) & 255]; col[i * 3 + 2] = LIN[hex & 255]; }
    aInfo[i * 3] = g.eavesH; aInfo[i * 3 + 1] = g.style; aInfo[i * 3 + 2] = g.seed;
  } };
  if (jobs.late()) yield;
  for (let i = 0; i < nv; i += PART * 2) { styles(i, Math.min(nv, i + PART * 2)); if (jobs.late()) yield; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aKind', new THREE.BufferAttribute(aKind, 1));
  geo.setAttribute('aBase', new THREE.BufferAttribute(aBase, 1));
  geo.setAttribute('aInfo', new THREE.BufferAttribute(aInfo, 3));
  return geo;
}

// Returns build(sector) -> mesh of that sector's buildings (or null).
export function createBuildings(walls) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aKind; attribute float aBase; attribute vec3 aInfo;
        varying float vKind; varying float vBase; varying vec3 vInfo; varying vec3 vWP; varying vec3 vWN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vKind = aKind; vBase = aBase; vInfo = aInfo; vWP = position; vWN = normal;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vKind; varying float vBase; varying vec3 vInfo; varying vec3 vWP; varying vec3 vWN;
        float bHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        // 1 inside [a, b], with edges softened by e
        float bBox(float x, float a, float b, float e) { return smoothstep(a - e, a + e, x) * (1.0 - smoothstep(b - e, b + e, x)); }
        // thin dark line every "period", fading out before it turns into noise in the distance
        float bLine(float x, float period, float width) {
          float w = fwidth(x) / period, f = abs(fract(x / period) - 0.5);
          return (1.0 - smoothstep(width, width + w * 1.5 + 0.01, 0.5 - f)) * (1.0 - smoothstep(0.15, 0.45, w));
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float kWin = 0.0; float kLit = 0.0; float kRough = 0.0; float kGlass = 0.0;
        vec3 wn = normalize(vWN);
        float h = vWP.y - vBase;
        float real = step(3.5, vInfo.y);
        float seed = vInfo.z, style = vInfo.y - 4.0 * real, eaves = max(vInfo.x, 2.4);
        float sq = floor(seed * 1023.0 + 0.5);      // exact per building, safe to hash
        if (vKind > 0.5 && vKind < 1.5) {
          // ---- roof: seams or tiles running down the slope, plain felt when flat
          if (wn.y < 0.985) {
            vec2 across = normalize(vec2(-wn.z, wn.x) + vec2(1e-5));
            float old = step(2.9, style) * step(style, 3.2);           // (an Old Town house: clay tiles)
            float tile = max(step(0.5, seed), old);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.13, 0.07) * (0.85 + 0.3 * seed), old * 0.55);
            float seam = bLine(dot(vWP.xz, across), mix(0.48, 0.24, tile), 0.06);
            float rows = bLine(vWP.y / max(1.0 - wn.y * wn.y, 0.05), 0.34, 0.07) * tile;
            diffuseColor.rgb *= 1.0 - 0.28 * max(seam, rows);
            kRough = mix(-0.35, 0.0, tile);
          }
          diffuseColor.rgb *= 0.9 + 0.2 * bHash(floor(vWP.xz * 0.7) + mod(sq, 13.0));
        } else if (abs(wn.y) < 0.35) {
          vec2 tg = normalize(vec2(-wn.z, wn.x) + vec2(1e-5));
          float u = dot(vWP.xz, tg);
          vec3 wall = diffuseColor.rgb;
          // wall material
          if (style > 3.2) {
            // limestone: courses of grey-beige blocks, each a little different, weathered darker low down
            // (rubble laid in rough courses: each course its own height, each stone its own length and shade)
            float row = floor(h / 0.36);
            float rh = 0.75 + 0.5 * bHash(vec2(row, mod(sq, 5.0)));
            float r2 = floor(h / (0.36 * rh));
            float sl = 0.45 + 0.5 * bHash(vec2(r2, 3.0));
            float blk = floor((u + r2 * 0.61) / sl);
            float n = bHash(vec2(blk, r2) + mod(sq, 7.0));
            vec3 stone = mix(vec3(0.55, 0.55, 0.52), vec3(0.66, 0.63, 0.55), n) * (0.9 + 0.12 * bHash(floor(vec2(u, h) * 3.0)));
            float white = step(3.5, style);                         // (3.6: whitewashed, the stones only just showing)
            wall = mix(stone, wall * 1.05, real * mix(0.25, 0.92, white));
            wall *= 1.0 - mix(0.13, 0.04, white) * max(bLine(h, 0.36 * rh, 0.05), bLine(u + r2 * 0.61, sl, 0.04));
            wall *= 0.86 + 0.14 * smoothstep(0.0, 6.0, h);
          } else if (style > 2.5) {
            // plaster in the Old Town's colours (the real one where Mapillary saw it), patchy with age
            float pick = floor(seed * 8.0);
            vec3 pal = pick < 1.0 ? vec3(0.86, 0.72, 0.46) : pick < 2.0 ? vec3(0.9, 0.86, 0.74) : pick < 3.0 ? vec3(0.86, 0.62, 0.52)
              : pick < 4.0 ? vec3(0.72, 0.78, 0.62) : pick < 5.0 ? vec3(0.7, 0.77, 0.82) : pick < 6.0 ? vec3(0.92, 0.9, 0.85)
              : pick < 7.0 ? vec3(0.93, 0.8, 0.46) : vec3(0.78, 0.55, 0.42);
            wall = mix(pal, wall, real * 0.85);
            wall *= 0.93 + 0.1 * bHash(floor(vec2(u, h) * 1.3) + mod(sq, 11.0)) - 0.05 * bHash(floor(vec2(u, h) * 0.4));
          } else if (style > 2.2) {
            // a glass tower (Tallinn's high-rises): dark blue-green glass, tinted by the real colour where it is known
            // (each its own tint: blue, green or bronze)
            vec3 tint = seed < 0.4 ? vec3(0.13, 0.19, 0.26) : seed < 0.7 ? vec3(0.14, 0.22, 0.21) : vec3(0.22, 0.19, 0.16);
            wall = mix(tint, wall, 0.3 * real);
            kRough = -0.35;
          } else if (style < 0.5) {
            // houses: pastel paint over boards, or plaster
            float woodS = step(0.2, style);                   // (0.3: a wooden town house, Kalamaja's and Kadriorg's)
            vec3 tint = 0.5 + 0.5 * cos(6.2831 * (seed * 3.0 + vec3(0.0, 0.33, 0.67)));
            wall = mix(wall, mix(wall, tint, 0.55) * vec3(1.0, 0.94, 0.9), step(0.35, seed) * 0.6 * (1.0 - real) * (1.0 - woodS));
            // (their paints in the street photos: ochre, pale yellow, sage, grey-blue, salmon, cream, ox red, brown)
            float wp = floor(seed * 8.0);
            vec3 wpal = wp < 1.0 ? vec3(0.84, 0.66, 0.36) : wp < 2.0 ? vec3(0.9, 0.82, 0.56) : wp < 3.0 ? vec3(0.64, 0.72, 0.56)
              : wp < 4.0 ? vec3(0.6, 0.68, 0.74) : wp < 5.0 ? vec3(0.84, 0.6, 0.5) : wp < 6.0 ? vec3(0.9, 0.88, 0.8)
              : wp < 7.0 ? vec3(0.86, 0.72, 0.4) : vec3(0.52, 0.36, 0.26);
            wall = mix(wall, wpal, woodS * (1.0 - real * 0.8));
            float boards = woodS > 0.5 ? (seed < 0.75 ? bLine(h, 0.13, 0.08) : bLine(u, 0.14, 0.07))
              : seed > 0.7 ? bLine(u, 0.16, 0.05) : seed > 0.35 ? bLine(h, 0.15, 0.06) : 0.0;
            wall *= 1.0 - mix(0.22, 0.3, woodS) * boards;
            // a band of boards between the storeys, and the tall ones on a ground floor of plastered stone
            wall = mix(wall, vec3(0.92, 0.9, 0.85), woodS * bBox(fract((h - 0.45) / 2.8), 0.93, 0.99, 0.01) * step(1.5, h) * step(h, eaves - 0.5) * 0.8);
            wall = mix(wall, mix(vec3(0.74, 0.71, 0.64), wall, 0.25) * (0.94 + 0.08 * bHash(floor(vec2(u, h) * 2.0))), woodS * step(9.0, eaves) * (1.0 - step(3.1, h)));
          } else if (style < 1.5) {
            // a real colour decides between brick and panels: brick is clearly red-brown
            float bricky = real > 0.5 ? step(0.05, wall.r - wall.b) * step(wall.g, wall.r * 0.8) * step(wall.r, 0.45) : step(0.55, seed);
            if (bricky > 0.5) {
              // brick
              float row = floor(h / 0.085);
              float mortar = max(bLine(h, 0.085, 0.08), bLine(u + mod(row, 2.0) * 0.13, 0.26, 0.04));
              vec3 brick = mix(vec3(0.42, 0.2, 0.15), wall, real);
              wall = mix(wall, brick * (0.85 + 0.3 * bHash(vec2(floor((u + mod(row, 2.0) * 0.13) / 0.26), row))), 0.75);
              wall = mix(wall, vec3(0.62, 0.58, 0.55), mortar * mix(0.6, 0.35, real));
            } else {
              // concrete panels
              wall *= 1.0 - 0.3 * max(bLine(u, 3.0, 0.012), bLine(h, 2.8, 0.012));
              wall *= 0.93 + 0.1 * bHash(vec2(floor(u / 3.0), floor(h / 2.8)) + mod(sq, 29.0));
            }
          } else {
            // halls and shops: ribbed metal cladding with a coloured band under the eaves
            wall *= 1.0 - 0.16 * bLine(u, 0.3, 0.1);
            vec3 band = 0.5 + 0.5 * cos(6.2831 * (seed * 5.0 + vec3(0.1, 0.45, 0.8)));
            wall = mix(wall, band * 0.8, step(eaves - 0.9, h) * step(h, eaves - 0.15) * step(0.4, seed) * 0.8);
            kRough = -0.3;
          }
          // plinth, grime at the ground, shade under the eaves
          float oldT = step(2.5, style);
          wall = mix(wall, mix(vec3(0.3, 0.29, 0.3), vec3(0.58, 0.56, 0.5), oldT), (1.0 - smoothstep(mix(0.42, 0.72, oldT), mix(0.46, 0.76, oldT), h)) * 0.75);
          // a cornice under the eaves of an Old Town house
          wall = mix(wall, vec3(0.9, 0.88, 0.82), oldT * step(style, 3.2) * bBox(h, eaves - 0.55, eaves - 0.2, 0.02) * 0.7);
          wall *= 0.8 + 0.2 * smoothstep(0.0, 1.6, h);
          wall *= 0.86 + 0.14 * (1.0 - smoothstep(eaves - 0.5, eaves - 0.05, h) * step(h, eaves));
          diffuseColor.rgb = wall;

          if (vKind > 1.5) {
            // ---- windows and doors on a grid that follows the storeys
            float old = step(2.5, style), stoneW = step(3.2, style);
            float tower = step(2.2, style) * (1.0 - old);
            kGlass = tower;
            float woodW = step(0.2, style) * step(style, 0.5);
            vec2 size = style > 3.3 ? vec2(4.5, 5.0) : style > 3.2 ? vec2(2.3, 3.2) : style > 2.5 ? vec2(2.2 + 0.5 * seed, 3.1) : style > 2.2 ? vec2(1.5, 3.6) : style < 0.5 ? vec2(2.5, 2.8) : style < 1.5 ? vec2(3.0, 2.8) : vec2(4.2, 3.6);
            vec2 cell = vec2(floor(u / size.x), floor((h - 0.45) / size.y));
            vec2 f = vec2(fract(u / size.x), fract((h - 0.45) / size.y)) * size;      // metres inside the cell
            float rnd = bHash(cell + mod(sq, 61.0));
            vec2 e = vec2(fwidth(u), fwidth(h)) + 0.004;
            vec2 wc = vec2(size.x * 0.5, style > 3.3 ? 2.6 : style > 3.2 ? 1.75 : style > 2.5 ? 1.75 : style > 2.2 ? 1.8 : style < 1.5 ? 1.6 : 1.9);                   // window centre
            vec2 wh = style > 3.3 ? vec2(0.22, 1.1) : style > 3.2 ? vec2(0.46, 0.62) : style > 2.5 ? vec2(0.42, 0.68) : style > 2.2 ? vec2(0.66, 1.3) : style < 0.5 ? mix(vec2(0.55, 0.65), vec2(0.5, 0.78), woodW) : style < 1.5 ? vec2(0.85, 0.7) : vec2(1.75, 0.75);
            float have = style > 3.3 ? step(0.55, rnd) : style > 3.2 ? step(0.05, rnd) : style > 2.5 ? step(0.08, rnd) : style > 2.2 ? 1.0 : style < 0.5 ? step(mix(0.3, 0.1, woodW), rnd) : style < 1.5 ? step(0.06, rnd) : step(0.45, rnd);
            float inWall = step(0.45, h) * step(h + 0.25, floor((eaves - 0.45) / size.y + 0.35) * size.y + 0.45);
            have *= inWall;
            float door = step(cell.y, 0.5) * step(0.5, cell.y + 1.0) * step(0.88, rnd) * inWall;
            // door: taller opening that starts at the plinth
            vec2 dc = vec2(size.x * 0.5, 1.05), dh = vec2(style > 1.5 && style < 2.5 ? 1.1 : 0.5, 1.05);
            door *= 1.0 - stoneW;
            vec2 c0 = mix(wc, dc, door), hs = mix(wh, dh, door);
            float tr = 0.07 + 0.06 * woodW;
            float frame = bBox(f.x, c0.x - hs.x - tr, c0.x + hs.x + tr, e.x) * bBox(f.y, c0.y - hs.y - tr, c0.y + hs.y + tr * 1.8, e.y);
            float glass = bBox(f.x, c0.x - hs.x, c0.x + hs.x, e.x) * bBox(f.y, c0.y - hs.y, c0.y + hs.y, e.y);
            float sill = bBox(f.x, c0.x - hs.x - 0.14, c0.x + hs.x + 0.14, e.x) * bBox(f.y, c0.y - hs.y - 0.13, c0.y - hs.y - 0.06, e.y) * (1.0 - door);
            // glazing bars
            float bars = max(1.0 - smoothstep(0.0, 0.025 + e.x, abs(f.x - c0.x)), (1.0 - smoothstep(0.0, 0.025 + e.y, abs(f.y - c0.y - hs.y * 0.35))) * max(step(style, 0.5), old));
            bars = max(bars, (1.0 - smoothstep(0.0, 0.022 + e.y, abs(f.y - c0.y + hs.y * 0.33))) * old * (1.0 - stoneW));
            frame *= have; glass *= have; sill *= have;
            vec3 frameCol = mix(mix(mix(mix(vec3(0.93, 0.92, 0.9), vec3(0.2, 0.19, 0.2), step(0.6, fract(seed * 7.3))), vec3(0.93, 0.92, 0.88), woodW), vec3(0.5, 0.54, 0.58), tower), mix(vec3(0.94, 0.93, 0.88), vec3(0.45, 0.47, 0.44), stoneW), old);
            vec3 doorCol = mix(0.35 + 0.3 * cos(6.2831 * (seed * 9.0 + vec3(0.0, 0.2, 0.5))), vec3(0.32, 0.2, 0.12) * (0.8 + 0.4 * rnd), old);     // (old doors: oak)
            diffuseColor.rgb = mix(diffuseColor.rgb, frameCol, max(frame, sill));
            float pane = glass * (1.0 - bars * (1.0 - door));
            float solidDoor = door * step(fract(rnd * 31.0), 0.6) * max(step(style, 1.5), old);
            diffuseColor.rgb = mix(diffuseColor.rgb, doorCol, glass * solidDoor);
            kWin = pane * (1.0 - solidDoor);
            // balconies on some columns of apartment blocks
            if (style > 0.5 && style < 1.5) {
              float col2 = bHash(vec2(cell.x, mod(sq, 17.0)));
              float rail = step(0.62, col2) * inWall * step(0.5, cell.y) * bBox(f.y, 0.25, 1.25, e.y) * bBox(f.x, 0.25, size.x - 0.25, e.x);
              vec3 railCol = mix(vec3(0.8, 0.8, 0.82), 0.5 + 0.5 * cos(6.2831 * (seed * 4.0 + vec3(0.0, 0.33, 0.67))), 0.45);
              diffuseColor.rgb = mix(diffuseColor.rgb, railCol * (0.9 - 0.25 * bLine(u, 0.12, 0.12)), rail);
              kWin *= 1.0 - rail;
            }
            float litRnd = bHash(cell * 1.7 + mod(sq, 23.0));
            kLit = step(mix(0.74, 0.82, tower), litRnd) * (1.0 - door);
            vec3 glassCol = mix(mix(vec3(0.04, 0.05, 0.09), vec3(0.10, 0.07, 0.16), f.y / size.y), mix(vec3(0.06, 0.1, 0.14), vec3(0.12, 0.16, 0.22), f.y / size.y), tower);
            // a hint of curtains and rooms in lit windows
            float curtain = step(0.5, bHash(cell + 5.0)) * (1.0 - bBox(f.x, c0.x - hs.x * 0.5, c0.x + hs.x * 0.5, 0.02));
            diffuseColor.rgb = mix(diffuseColor.rgb, glassCol, kWin);
            kLit *= 1.0 - 0.45 * curtain;
            vLitTint = mix(vec3(1.0, 0.62, 0.38), mix(vec3(1.0, 0.82, 0.55), vec3(0.55, 0.7, 1.0), step(0.93, litRnd)), step(0.84, litRnd));
          }
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(clamp(roughnessFactor + kRough, 0.05, 1.0), mix(0.06, 0.2, kGlass), kWin);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, mix(0.85, 0.5, kGlass), kWin * (1.0 - kLit));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += kWin * kLit * vLitTint * 1.5;`);
    sh.fragmentShader = sh.fragmentShader.replace('float bHash(vec2 p)', 'vec3 vLitTint = vec3(1.0, 0.62, 0.38);\n        float bHash(vec2 p)');
  };
  // build.steps(sector): the same as a job's steps (`yield*` it); the sector's own data is only read
  function* steps(sector) {
    if (!sector.buildings.nv) return null;
    const mesh = new THREE.Mesh(yield* buildingGeometrySteps(sector, walls), mat);
    mesh.position.set(sector.x0, 0, sector.z0);      // vertices are sector-relative
    mesh.updateMatrix();
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }
  const build = (sector) => jobs.run(steps(sector));
  build.steps = steps;
  build.material = mat;          // (for walls made elsewhere in the same look: src/world/tln/citywalls.js)
  return build;
}

// ---------------------------------------------------------------- trees
function paint(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo.index ? geo.toNonIndexed() : geo;
}

// Unit trees (height 1, crown diameter 1), one per species. Trees 0-3 are broadleaved, 4-5 conifers.
function treeGeometries(detail) {
  const trunk = (h, r, hex) => paint(new THREE.CylinderGeometry(r * 0.7, r, h, 5, 1, true).translate(0, h / 2, 0), hex);
  const blob = (r, sy, x, y, z, hex) => paint(new THREE.IcosahedronGeometry(r, detail).scale(1, sy, 1).translate(x, y, z), hex);
  const sides = detail ? 8 : 6;
  const cone = (r, h, y, hex) => paint(new THREE.ConeGeometry(r, h, sides, 1, true).translate(0, y, 0), hex);
  const out = [
    // 0 lime or maple: full round crown
    mergeGeometries([trunk(0.45, 0.05, 0x4a3528), blob(0.5, 0.62, 0, 0.67, 0, 0x4f8f3a), blob(0.34, 0.7, 0.12, 0.5, 0.08, 0x3f7a34)]),
    // 1 birch: white stem, light airy crown
    mergeGeometries([trunk(0.62, 0.03, 0xd9d6cf), blob(0.3, 1.05, 0, 0.68, 0, 0x7fae4a), blob(0.22, 0.9, -0.1, 0.5, 0.06, 0x8dba55)]),
    // 2 oak: low and wide, several lobes
    mergeGeometries([trunk(0.36, 0.07, 0x3d2c22), blob(0.36, 0.7, 0.16, 0.6, 0.05, 0x3f7434), blob(0.34, 0.72, -0.15, 0.62, -0.1, 0x47803a),
      blob(0.3, 0.75, 0.0, 0.76, 0.12, 0x4f8b3f)]),
    // 3 poplar: a tall column
    mergeGeometries([trunk(0.3, 0.045, 0x574636), blob(0.24, 1.7, 0, 0.6, 0, 0x4c8640)]),
    // 4 spruce: stacked cones to the ground
    mergeGeometries([trunk(0.3, 0.04, 0x4a3528), cone(0.5, 0.5, 0.43, 0x2c5f3a), cone(0.38, 0.42, 0.67, 0x2f6a3e), cone(0.24, 0.34, 0.83, 0x357444)]),
    // 5 pine: long bare reddish stem, flat crown at the top
    mergeGeometries([trunk(0.72, 0.04, 0x9a5a3c), blob(0.42, 0.45, 0, 0.82, 0, 0x2f6642), blob(0.26, 0.5, 0.14, 0.7, -0.05, 0x37714a)]),
    // 6 a spruce by the road (ROADSIDE): the stem bare below, the cones slimmer
    mergeGeometries([trunk(0.45, 0.04, 0x4a3528), cone(0.36, 0.38, 0.56, 0x2c5f3a), cone(0.3, 0.36, 0.72, 0x2f6a3e), cone(0.2, 0.3, 0.86, 0x357444)]),
  ];
  for (const g of out) g.computeVertexNormals();
  return out;
}

const ROADSIDE = 6;              // the spruce by the lap's road (Tallinn): see build() below and realtrees.js
// species from what the lidar tells us: conifer or not, height, and how slim the crown is
function treeSpecies(type, h, crown, r) {
  // (Tallinn: the conifers round Pirita, Kose and Kloostrimetsa are Scots pines, a spruce here and there: Martin's
  // Street View shots along the lap, 28 Nov 2026)
  if (type === 1) return TALLINN ? (h > 8 && r < 0.85 ? 5 : 4) : h > 13 && r < 0.45 ? 5 : 4;
  const slim = crown / h;
  if (slim < 0.3) return r < 0.4 ? 3 : 1;
  if (slim > 0.62 && h > 9) return 2;
  return r < 0.28 ? 1 : 0;
}

// Realistic trees. Far off, a tree is a flat picture in its sector's mesh. The leafy trees close
// to the camera are drawn from one small pool per species, refilled as the camera moves, so only
// the few hundred trees that can be seen as such cost their full geometry.
let realTrees = null, pools = null;
let nearTrees = 150;            // m: the flat picture gives way to the leafy tree (the shaders switch at exactly this)
// the realistic tree kit for hand-placed greenery (null with ?trees=old or before createTrees)
export function realTreeKit() { return realTrees; }
export function updateTrees(time, cam) {
  if (!realTrees) return;
  realTrees.update(time);
  if (pools && cam) pools.update(cam);
}
// A device that struggles gets fewer leafy trees: returns false once there is nothing left to give.
// The distance where the flat picture gives way to the leafy tree, set by the graphics quality
// (src/quality.js): nearer is cheaper. Before the trees are built it only sets where they start.
let treeDistanceSet = false;
export function setTreeDistance(m) {
  treeDistanceSet = true;
  if (m === nearTrees) return;
  nearTrees = m;
  if (realTrees) realTrees.setLod(nearTrees);
  if (pools) pools.touch();
}

function treePools(real, world, opts) {
  const group = new THREE.Group();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const pool = {};
  const make = (type, cap) => {
    const sp = real[type], old = pool[type];
    if (old) { group.remove(old); old.dispose(); }
    const im = new THREE.InstancedMesh(sp.near, sp.nearMat, cap);
    im.count = 0;
    im.castShadow = opts.treeShadows;
    im.frustumCulled = false;          // the instances move with the camera
    im.matrixAutoUpdate = false;
    im.setColorAt(0, col.setRGB(1, 1, 1));
    group.add(im);
    return (pool[type] = im);
  };
  for (const type in real) if (real[type].near) make(type, 256);
  let lx = Infinity, lz = Infinity, dirty = true;
  const found = {};
  return {
    group,
    touch() { dirty = true; },         // a sector came or went
    update(cam) {
      if (!dirty && Math.hypot(cam.x - lx, cam.z - lz) < 6) return;
      lx = cam.x; lz = cam.z; dirty = false;
      for (const type in pool) (found[type] ||= []).length = 0;
      world.treesNear(cam.x, cam.z, nearTrees + 10, (s, i) => {
        const list = s.treeKind && found[s.treeKind[i]];
        if (list) list.push(s, i);
      });
      for (const type in pool) {
        const list = found[type], n = list.length / 2;
        let im = pool[type];
        if (n > im.instanceMatrix.count) im = make(type, Math.max(n, im.instanceMatrix.count * 2));
        for (let k = 0; k < n; k++) {
          const s = list[k * 2], i = list[k * 2 + 1], rec = s.trees, look = s.treeLook;
          p.set(rec[i * 6], rec[i * 6 + 1] - 0.15, rec[i * 6 + 2]);
          q.setFromAxisAngle(up, look[i * 4]);
          sc.set(rec[i * 6 + 4], rec[i * 6 + 3], rec[i * 6 + 4]);
          im.setMatrixAt(k, m.compose(p, q, sc));
          im.setColorAt(k, col.setRGB(look[i * 4 + 1], look[i * 4 + 2], look[i * 4 + 3]));
        }
        im.count = n;
        im.instanceMatrix.needsUpdate = true;
        im.instanceColor.needsUpdate = true;
        list.length = 0;               // do not hold on to sectors
      }
    },
  };
}

// Returns build(sector) -> { group, setNear(bool) } with that sector's trees.
// build.near is the group with the leafy close trees, if any: add it to the scene.
export function createTrees(opts, renderer, world) {
  if (!treeDistanceSet) nearTrees = opts.treeDetail > 0 ? 150 : 70;          // phones: leafy trees only right around the car
  realTrees = opts.realTrees ? createRealTrees(renderer, { cards: true, lod: nearTrees }) : null;
  const real = realTrees ? realTrees.species : {};
  pools = realTrees ? treePools(real, world, opts) : null;
  const near = treeGeometries(opts.treeDetail);
  const far = treeGeometries(0);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const build = (sector) => {
    const rec = sector.trees;
    const n = rec.length / 6;
    if (!n) return null;
    const group = new THREE.Group();
    const nearMeshes = [], farMeshes = [], alwaysMeshes = [];
    let seed = (sector.sx * 73856093) ^ (sector.sz * 19349663) ^ 99;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    const lists = near.map(() => []);
    // what the close-tree pool needs to draw tree i exactly as its flat picture stands: species, turn, tint
    const kind = pools ? new Uint8Array(n).fill(255) : null, look = pools ? new Float32Array(n * 4) : null;
    const roadTurn = TALLINN ? new Float32Array(n) : null;
    for (let i = 0; i < n; i++) {
      if (opts.thinTrees && rec[i * 6 + 3] < 9 && (i % 3) === 0) continue;
      const pick = Math.abs(Math.sin(rec[i * 6] * 12.9898 + rec[i * 6 + 2] * 78.233) * 43758.5453) % 1;
      let type = treeSpecies(rec[i * 6 + 5] | 0, rec[i * 6 + 3], rec[i * 6 + 4], pick);
      // A spruce whose boughs would reach over the lap's road (Tallinn; Martin 28 Nov 2026: "a few spruces are in the
      // road. for these who go over the road, make the branches start a bit higher up and perhaps more reduced on
      // the side of the road"): the roadside spruce, its cut side turned to the road
      if (roadTurn) {
        roadTurn[i] = NaN;
        const by = type === 4 ? lapBeside(rec[i * 6], rec[i * 6 + 2]) : null;
        if (by && by[0] < rec[i * 6 + 4] / 2 + 0.8) { type = ROADSIDE; roadTurn[i] = Math.atan2(-by[2], by[1]); }
      }
      lists[type].push(i);
      if (kind) kind[i] = type;
    }
    sector.treeKind = kind; sector.treeLook = look;
    if (pools) pools.touch();
    for (let type = 0; type < lists.length; type++) {
      const list = lists[type];
      if (!list.length) continue;
      const sp = real[type];
      const im = sp ? new THREE.InstancedMesh(sp.far, sp.farMat, list.length) : new THREE.InstancedMesh(far[type], mat, list.length);
      list.forEach((i, k) => {
        const h = rec[i * 6 + 3], c = rec[i * 6 + 4];
        p.set(rec[i * 6], rec[i * 6 + 1] - 0.15, rec[i * 6 + 2]);
        let turn = rnd() * 6.283;
        if (type === ROADSIDE && roadTurn[i] === roadTurn[i]) turn = roadTurn[i];
        q.setFromAxisAngle(up, turn);
        s.set(c, h, c);
        m.compose(p, q, s);
        im.setMatrixAt(k, m);
        const v = 0.78 + rnd() * 0.4, warm = type < 4 && rnd() < 0.12 ? 0.25 + rnd() * 0.3 : 0;   // a few already turning
        // (a textured tree carries its own colour: only a light tint on top)
        if (sp) { const t = 0.86 + (v - 0.78) * 0.7; col.setRGB(t * (1 + warm * 0.9), t * (0.97 + rnd() * 0.06), t * (0.94 - warm * 0.8)); }
        else col.setRGB(v * (1 + warm), v * (0.95 + rnd() * 0.1), v * (0.9 - warm * 0.6));
        im.setColorAt(k, col);
        if (look) { look[i * 4] = turn; look[i * 4 + 1] = col.r; look[i * 4 + 2] = col.g; look[i * 4 + 3] = col.b; }
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.matrixAutoUpdate = false;
      group.add(im);
      if (sp) {
        // the flat tree stays on; close to the camera the pool draws the leafy tree in its place
        alwaysMeshes.push(im);
        continue;
      }
      farMeshes.push(im);
      if (near[type] !== far[type] && opts.treeDetail) {
        // same instances, detailed geometry: shown instead of the far mesh when close
        const im2 = new THREE.InstancedMesh(near[type], mat, list.length);
        im2.instanceMatrix = im.instanceMatrix;
        im2.instanceColor = im.instanceColor;
        im2.boundingSphere = im.boundingSphere;
        im2.castShadow = opts.treeShadows;
        im2.matrixAutoUpdate = false;
        im2.visible = false;
        group.add(im2);
        nearMeshes.push(im2);
      }
    }
    // (Tallinn: the trees by the lap stand in straw sacks, as for the races of the 2000s: tln/treebags.js)
    if (TALLINN) {
      const bags = treeBags(rec, n, (i) => !(opts.thinTrees && rec[i * 6 + 3] < 9 && (i % 3) === 0));
      if (bags) { group.add(bags); alwaysMeshes.push(bags); }
    }
    let isNear = false;
    return {
      group,
      setNear(v) {
        if (v === isNear || !nearMeshes.length) return;
        isNear = v;
        for (const x of nearMeshes) x.visible = v;
        for (const x of farMeshes) x.visible = !v;
      },
      dispose() { for (const x of farMeshes) x.dispose(); for (const x of alwaysMeshes) x.dispose(); sector.treeKind = sector.treeLook = null; if (pools) pools.touch(); },
    };
  };
  build.near = pools ? pools.group : null;
  return build;
}

// ---------------------------------------------------------------- hedges, bushes and fences
// Bushes and hedges are leafy: each laser-scan cell is a soft round lump, and the lumps of a hedge overlap
// into one body. A tileable picture of small leaves is laid on them in world space from three sides, so the
// leaves do not stretch over tall lumps, and the foot of every lump is shaded where light does not reach.
function bushLeafTexture() {
  const n = 256, cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const g = cv.getContext('2d');
  g.fillStyle = 'hsl(112,38%,15%)'; g.fillRect(0, 0, n, n);
  let sd = 917;
  const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  // dark depths first, lit leaves last; each leaf drawn again across the edges so the picture tiles
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 520; i++) {
      const x = r() * n, y = r() * n, a = r() * 6.283, L = 5 + r() * 6, W = L * (0.42 + r() * 0.16);
      const light = [19, 28, 38][layer] + r() * 10, hue = 96 + r() * 26, sat = 36 + r() * 18;
      for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) {
        if (x + ox < -12 || x + ox > n + 12 || y + oy < -12 || y + oy > n + 12) continue;
        g.save(); g.translate(x + ox, y + oy); g.rotate(a);
        g.fillStyle = `hsl(${hue},${sat}%,${light}%)`;
        g.beginPath(); g.ellipse(0, 0, L, W, 0, 0, 6.283); g.fill();
        g.strokeStyle = `hsla(${hue + 10},${sat}%,${light + 12}%,0.45)`; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(-L * 0.8, 0); g.lineTo(L * 0.8, 0); g.stroke();
        g.restore();
      }
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function bushMaterial() {
  const mat = new THREE.MeshLambertMaterial({ map: bushLeafTexture() });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;\nvarying vec3 vWn;\nvarying float vFoot;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 bw = vec4(transformed, 1.0);
        vec3 bn = objectNormal;
        #ifdef USE_INSTANCING
          bw = instanceMatrix * bw; bn = mat3(instanceMatrix) * bn;
        #endif
        vWp = (modelMatrix * bw).xyz;
        vWn = normalize(mat3(modelMatrix) * bn);
        vFoot = position.y;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;\nvarying vec3 vWn;\nvarying float vFoot;')
      .replace('#include <map_fragment>', `
        vec3 bwt = pow(abs(vWn), vec3(4.0)); bwt /= bwt.x + bwt.y + bwt.z;
        const float K = 0.55;                              // one picture covers 1.8 m
        vec4 leaf = texture2D(map, vWp.zy * K) * bwt.x + texture2D(map, vWp.xz * K + 0.37) * bwt.y + texture2D(map, vWp.xy * K + 0.71) * bwt.z;
        diffuseColor *= leaf;
        diffuseColor.rgb *= mix(0.45, 1.0, smoothstep(0.0, 0.55, vFoot));      // dark at the foot`);
  };
  mat.customProgramCacheKey = () => 'bush-leaves';
  return mat;
}

// Returns build(sector) -> group (or null). Cells come from laser-scan data on a 0.5 m grid.
export function createLowObjects(world, opts) {
  const res = world.meta.lowres || 0.5;
  // a soft lump from the ground up to height 1: a round body on a slightly narrower foot
  const bushGeo = new THREE.IcosahedronGeometry(0.5, 0);
  {
    const q = bushGeo.attributes.position;
    for (let i = 0; i < q.count; i++) {
      const y = q.getY(i) + 0.5;
      q.setXYZ(i, q.getX(i) * (y < 0.2 ? 0.8 : 1), Math.max(0, y), q.getZ(i) * (y < 0.2 ? 0.8 : 1));
    }
    bushGeo.computeVertexNormals();
  }
  const fenceGeo = new THREE.BoxGeometry(res * 1.25, 1, 0.07).translate(0, 0.5, 0);
  const bushMat = bushMaterial();
  const fenceMat = new THREE.MeshLambertMaterial();
  const FENCE = [0x4a3b30, 0x5d5f66, 0x8a7257, 0x2e2f35, 0x9a9690];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  return (sector) => {
    const nb = sector.bushes.length / 3, nf = sector.fences.length / 3;
    if (!nb && !nf) return null;
    const group = new THREE.Group();
    let seed = (sector.sx * 9176 + sector.sz * 31337 + 7) >>> 0;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    if (nb) {
      const B = sector.bushes;
      const step = opts.thinTrees ? 2 : 1;        // phones: every other cell, drawn fatter
      // leafy lumps in the realistic trees' foliage, or the plain green lumps when the simple trees are on
      const leafy = realTrees && realTrees.lump ? realTrees.lump() : null;
      const im = new THREE.InstancedMesh(leafy ? leafy.geometry : bushGeo, leafy ? leafy.material : bushMat, Math.ceil(nb / step));
      let k = 0;
      for (let i = 0; i < nb; i += step) {
        const x = sector.x0 + (B[i * 3] + 0.5) * res, z = sector.z0 + (B[i * 3 + 1] + 0.5) * res;
        const h = (B[i * 3 + 2] & 255) / 10;
        p.set(x + (rnd() - 0.5) * 0.15, world.heightAt(x, z) - 0.1, z + (rnd() - 0.5) * 0.15);
        q.setFromAxisAngle(up, rnd() * 6.283);
        const w = (1.2 + rnd() * 0.45) * (step === 2 ? 1.45 : 1) * (res / 0.5);
        sc.set(w * (0.85 + rnd() * 0.3), h * (0.95 + rnd() * 0.14) + 0.25, w * (0.85 + rnd() * 0.3));
        m.compose(p, q, sc);
        im.setMatrixAt(k, m);
        // one tint per few metres, so a hedge keeps its kind of green, plus a little per lump
        const hsh = Math.abs((Math.floor(x / 6) * 73856093) ^ (Math.floor(z / 6) * 19349663)) % 997 / 997;
        const v = 0.82 + rnd() * 0.3;
        if (leafy) col.setRGB((0.8 + hsh * 0.22) * v * 0.92, (0.9 + hsh * 0.08) * v * 0.92, (0.74 + (1 - hsh) * 0.2) * v * 0.92);
        else col.setRGB((0.78 + hsh * 0.3) * v, (0.95 + hsh * 0.1) * v, (0.7 + (1 - hsh) * 0.25) * v);
        im.setColorAt(k++, col);
      }
      im.count = k;
      im.castShadow = opts.treeShadows;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      im.matrixAutoUpdate = false;
      group.add(im);
    }
    if (nf) {
      const F = sector.fences;
      const im = new THREE.InstancedMesh(fenceGeo, fenceMat, nf);
      for (let i = 0; i < nf; i++) {
        const x = sector.x0 + (F[i * 3] + 0.5) * res, z = sector.z0 + (F[i * 3 + 1] + 0.5) * res;
        const h = (F[i * 3 + 2] & 255) / 10, ang = ((F[i * 3 + 2] >> 8) / 255) * Math.PI;
        p.set(x, world.heightAt(x, z) - 0.05, z);
        q.setFromAxisAngle(up, -ang);
        sc.set(1, h, 1);
        m.compose(p, q, sc);
        im.setMatrixAt(i, m);
        // one colour per plot-sized patch, so a fence keeps its colour along a garden
        const hsh = (Math.floor(x / 28) * 73856093) ^ (Math.floor(z / 28) * 19349663);
        col.setHex(FENCE[Math.abs(hsh) % FENCE.length]);
        im.setColorAt(i, col);
      }
      im.castShadow = opts.treeShadows;
      im.computeBoundingSphere();
      im.matrixAutoUpdate = false;
      group.add(im);
    }
    group.userData.dispose = () => { for (const c of group.children) c.dispose(); };
    return group;
  };
}

// ---------------------------------------------------------------- water
function ripplesTexture() {
  const n = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(n, n);
  const hgt = (x, y) => {
    let v = 0;
    const k = (Math.PI * 2) / n;
    v += Math.sin(x * k * 3 + y * k * 5) + Math.sin(x * k * 7 - y * k * 4 + 1.3) * 0.6;
    v += Math.sin(x * k * 13 + y * k * 11 + 0.7) * 0.3 + Math.sin(-x * k * 17 + y * k * 9 + 2.1) * 0.25;
    return v;
  };
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = hgt(x + 1, y) - hgt(x - 1, y), dy = hgt(x, y + 1) - hgt(x, y - 1);
      const i = (y * n + x) * 4;
      img.data[i] = 128 + dx * 60; img.data[i + 1] = 128 + dy * 60; img.data[i + 2] = 255; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function createWater(world) {
  const group = new THREE.Group();
  const normalMap = ripplesTexture();
  normalMap.repeat.set(0.06, 0.06);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x24305e, roughness: 0.12, metalness: 0.55, transparent: true, opacity: 0.9,
    normalMap, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.4,
  });
  const ponds = [], cells = new Map();
  for (const w of world.vectors.water) {
    for (const poly of w.polys) {
      if (poly.outer.length < 4) continue;
      const shape = new THREE.Shape(poly.outer.map(([x, z]) => new THREE.Vector2(x, z)));
      for (const hole of poly.holes) shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, z))));
      const geo = new THREE.ShapeGeometry(shape);
      // shape is in (x, z): lay it flat; UVs in metres for the ripple map
      const pos = geo.attributes.position;
      const uv = geo.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getY(i);
        pos.setXYZ(i, x, w.level, z);
        uv.setXY(i, x, z);
      }
      // ShapeGeometry faces +z of the 2D plane, which is now -y: flip the winding
      const idx = geo.index.array;
      for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
      geo.computeVertexNormals();
      // the ponds and streams of one 1.5 km square become one mesh (there are nearly a thousand of them,
      // and each used to be looked at and drawn by itself in every frame); the river stays its own
      geo.computeBoundingSphere();
      const c = geo.boundingSphere.center, key = geo.boundingSphere.radius > 600 ? `own${cells.size}` : `${Math.floor(c.x / 1500)},${Math.floor(c.z / 1500)}`;
      let cell = cells.get(key);
      if (!cell) cells.set(key, cell = { pos: [], nor: [], uv: [], idx: [], n: 0 });
      const gi = geo.index.array, base = cell.n;
      cell.pos.push(geo.attributes.position.array); cell.nor.push(geo.attributes.normal.array); cell.uv.push(geo.attributes.uv.array);
      const shifted = new Uint32Array(gi.length);
      for (let i = 0; i < gi.length; i++) shifted[i] = gi[i] + base;
      cell.idx.push(shifted);
      cell.n += pos.count;
      geo.dispose();
      if (!w.river) {
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const [x, z] of poly.outer) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
        ponds.push({ minX, maxX, minZ, maxZ, level: w.level, ring: poly.outer });
      }
    }
  }
  const join = (parts, n) => { const out = new (parts[0].constructor)(n); let o = 0; for (const q of parts) { out.set(q, o); o += q.length; } return out; };
  for (const cell of cells.values()) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(join(cell.pos, cell.n * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(join(cell.nor, cell.n * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(join(cell.uv, cell.n * 2), 2));
    geo.setIndex(new THREE.BufferAttribute(join(cell.idx, cell.idx.reduce((a, q) => a + q.length, 0)), 1));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = 2;
    group.add(mesh);
  }
  const inside = (ring, x, z) => {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i], [xj, zj] = ring[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
    }
    return hit;
  };
  // water level lookup used by the physics: the pond or stream under the point, else the river
  world.waterLevelAt = (x, z) => {
    let near = null;
    for (const p of ponds) {
      if (x < p.minX - 2 || x > p.maxX + 2 || z < p.minZ - 2 || z > p.maxZ + 2) continue;
      if (inside(p.ring, x, z)) return p.level;
      near = near || p;
    }
    if (near && Math.abs(world.heightAt(x, z) - near.level) < Math.abs(world.heightAt(x, z) - world.meta.riverLevel)) return near.level;
    return world.meta.riverLevel;
  };
  const update = (t) => { normalMap.offset.set(t * 0.004, t * 0.012); };
  return { group, update };
}

// ---------------------------------------------------------------- map edge
export function createEdgeGrid(world) {
  const ring = world.meta.boundary;
  const h = 40;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `attribute float aAlong; varying vec3 vP; varying float vAlong; void main() { vP = position; vAlong = aAlong; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec3 vP; varying float vAlong; uniform vec3 uCam; uniform float uTime;
      void main() {
        vec2 g = vec2(vAlong, vP.y - uTime * 1.5) / 4.0;
        vec2 f = abs(fract(g) - 0.5);
        float line = smoothstep(0.47, 0.5, max(f.x, f.y));
        float d = distance(vP.xz, uCam.xz);
        float a = (1.0 - smoothstep(25.0, 130.0, d)) * (line * 0.9 + 0.06) * (1.0 - smoothstep(0.0, 40.0, vP.y - uCam.y + 12.0));
        vec3 col = mix(vec3(0.1, 0.95, 1.0), vec3(1.0, 0.2, 0.8), smoothstep(-5.0, 25.0, vP.y - uCam.y));
        gl_FragColor = vec4(col, a);
      }`,
  });
  // one tall quad per boundary segment, following the terrain
  const n = ring.length - 1;
  const pos = new Float32Array(n * 12), along = new Float32Array(n * 4), idx = new Uint32Array(n * 6);
  let d = 0;
  for (let i = 0; i < n; i++) {
    const [x0, z0] = ring[i], [x1, z1] = ring[i + 1];
    const y0 = world.coarseHeight(x0, z0) - 12, y1 = world.coarseHeight(x1, z1) - 12;
    const len = Math.hypot(x1 - x0, z1 - z0);
    pos.set([x0, y0, z0, x1, y1, z1, x0, y0 + h, z0, x1, y1 + h, z1], i * 12);
    along.set([d, d + len, d, d + len], i * 4);
    d += len;
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.matrixAutoUpdate = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return { group: mesh, mat };
}
