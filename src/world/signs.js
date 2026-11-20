// Shop signs on the buildings where the shops really are (OpenStreetMap, ODbL), placed by
// tools/realism/signs.py: a lit box sign on the street side of the building, and a pylon at fuel stations.
// Signs are drawn per sector: one texture with all the sector's sign faces, one mesh for the faces and one
// for the boxes and poles. They are scenery only.
import * as THREE from 'three';
import { paintScale } from './paintscale.js';

// [background, text, glow]: rough brand colours, a neon look for everything else
const STYLES = [
  ['#1a0f2e', '#fff0fb', '#ff4fd8'],   // 0 any other shop
  ['#ffffff', '#e30613'],              // 1 Selver
  ['#0057a8', '#ffffff'],              // 2 Coop, Konsum, Maksimarket
  ['#ffffff', '#00594f'],              // 3 Prisma
  ['#e3001b', '#ffffff'],              // 4 Rimi
  ['#ffffff', '#e2231a'],              // 5 Maxima
  ['#0050aa', '#fff000'],              // 6 Lidl
  ['#ffffff', '#ee2e24'],              // 7 Circle K
  ['#ffffff', '#0b3f91'],              // 8 Neste
  ['#ffd400', '#1a1a1a'],              // 9 Olerex
  ['#c8102e', '#ffffff'],              // 10 Alexela
  ['#1a1a1a', '#ffcc00'],              // 11 Terminal
  ['#ffffff', '#00843d'],              // 12 pharmacies
  ['#ffffff', '#d0021b'],              // 13 Hesburger
  ['#da291c', '#ffc72c'],              // 14 McDonald's
  ['#ffffff', '#ee7023'],              // 15 Swedbank
  ['#ffffff', '#41a62a'],              // 16 SEB
  ['#143c8c', '#ffffff'],              // 17 JYSK
  ['#ffffff', '#d4001a'],              // 18 hardware stores
  ['#ffffff', '#e50010'],              // 19 H&M
];
const MAX_ROWS = 50;
let ROW = 80, ATLAS_W = 1024;           // (smaller on phones: see paintscale.js)

// draws one sign face into the rectangle (x, y, w, h) of the canvas
function drawFace(c, x, y, w, h, text, style) {
  const [bg, fg, glow] = STYLES[style] || STYLES[0];
  c.fillStyle = bg;
  c.fillRect(x, y, w, h);
  c.strokeStyle = glow || 'rgba(0,0,0,0.25)';
  c.lineWidth = Math.max(2, h * 0.05);
  c.strokeRect(x + c.lineWidth / 2, y + c.lineWidth / 2, w - c.lineWidth, h - c.lineWidth);
  let size = h * 0.74;
  c.font = `700 ${size}px system-ui, "Helvetica Neue", Arial, sans-serif`;
  const tw = c.measureText(text).width;
  if (tw > w * 0.88) { size *= (w * 0.88) / tw; c.font = `700 ${size}px system-ui, "Helvetica Neue", Arial, sans-serif`; }
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = fg;
  if (glow) { c.shadowColor = glow; c.shadowBlur = h * 0.18; }
  c.fillText(text, x + w / 2, y + h / 2 + h * 0.03);
  c.shadowBlur = 0;
}

export function createSigns(world) {
  ROW = Math.round(80 * paintScale()); ATLAS_W = Math.round(1024 * paintScale());
  let data = null;
  const waiting = [];
  const boxMat = new THREE.MeshLambertMaterial({ color: 0x2a2730 });
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x8a8890 });

  // a quad facing "normal" (nx, nz) with centre (x, y, z): positions and uvs pushed onto arrays
  function quad(P, U, x, y, z, nx, nz, w, h, u0, v0, u1, v1) {
    const rx = nz * w / 2, rz = -nx * w / 2, hy = h / 2;
    const a = [x - rx, y - hy, z - rz], b = [x + rx, y - hy, z + rz], c = [x + rx, y + hy, z + rz], d = [x - rx, y + hy, z - rz];
    P.push(...a, ...b, ...c, ...a, ...c, ...d);
    U.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
  }

  function boxGeo(list, w, h, d, x, y, z, yaw) {
    list.push(new THREE.BoxGeometry(w, h, d).rotateY(yaw).translate(x, y, z).toNonIndexed());
  }

  function merge(geos) {
    if (!geos.length) return null;
    let n = 0;
    for (const g of geos) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    let o = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      o += g.attributes.position.count;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    return geo;
  }

  function build(sector) {
    const a = data.sectors[`${sector.sx}_${sector.sz}`];
    if (!a) return null;
    const st = data.stride;
    const group = new THREE.Group();
    const owned = [];
    // faces: a wall sign has one, a pylon two (front and back)
    const faces = [];
    const frames = [], poles = [];
    for (let i = 0; i < a.length; i += st) {
      const kind = a[i], x = a[i + 1], y = a[i + 2], z = a[i + 3], yaw = a[i + 4] * Math.PI / 180;
      if (world.signSkip && world.signSkip(x, z)) continue;          // drawn by hand instead (e.g. a name painted on the wall)
      const w = a[i + 5], h = a[i + 6], text = data.texts[a[i + 7]], style = a[i + 8];
      const nx = Math.sin(yaw), nz = Math.cos(yaw);
      if (kind === 0) {
        boxGeo(frames, w + 0.12, h + 0.12, 0.14, x - nx * 0.02, y, z - nz * 0.02, yaw);
        faces.push({ x: x + nx * 0.055, y, z: z + nz * 0.055, nx, nz, w, h, text, style });
      } else {
        const top = y + 5.2;
        boxGeo(poles, 0.22, 5.2 - h / 2, 0.22, x, y + (5.2 - h / 2) / 2, z, yaw);
        boxGeo(frames, w + 0.2, h + 0.2, 0.32, x, top, z, yaw);
        faces.push({ x: x + nx * 0.165, y: top, z: z + nz * 0.165, nx, nz, w, h, text, style });
        faces.push({ x: x - nx * 0.165, y: top, z: z - nz * 0.165, nx: -nx, nz: -nz, w, h, text, style });
      }
    }
    // shelf-pack the faces into textures of ROW px high rows
    let k = 0;
    while (k < faces.length) {
      const rows = [];
      let cx = ATLAS_W;
      const start = k;
      for (; k < faces.length; k++) {
        const f = faces[k];
        const pw = Math.min(ATLAS_W, Math.max(ROW, Math.round(ROW * f.w / f.h)));
        if (cx + pw > ATLAS_W) {
          if (rows.length >= MAX_ROWS) break;
          rows.push([]); cx = 0;
        }
        f.px = cx; f.pw = pw; f.row = rows.length - 1;
        rows[rows.length - 1].push(f);
        cx += pw + 2;
      }
      const cv = document.createElement('canvas');
      cv.width = ATLAS_W; cv.height = rows.length * ROW;
      const c = cv.getContext('2d');
      const P = [], U = [];
      for (let j = start; j < k; j++) {
        const f = faces[j];
        drawFace(c, f.px, f.row * ROW, f.pw, ROW, f.text, f.style);
        const u0 = (f.px + 0.5) / ATLAS_W, u1 = (f.px + f.pw - 0.5) / ATLAS_W;
        const v1 = 1 - (f.row * ROW + 0.5) / cv.height, v0 = 1 - ((f.row + 1) * ROW - 0.5) / cv.height;
        quad(P, U, f.x, f.y, f.z, f.nx, f.nz, f.w, f.h, u0, v0, u1, v1);
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      const mat = new THREE.MeshBasicMaterial({ map: tex });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      owned.push(geo, mat, tex);
    }
    for (const [list, mat] of [[frames, boxMat], [poles, poleMat]]) {
      const geo = merge(list);
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      owned.push(geo);
    }
    group.userData.dispose = () => { for (const o of owned) o.dispose(); };
    return group.children.length ? group : null;
  }

  fetch(`${import.meta.env.BASE_URL}data/signs.json`).then((r) => r.json()).then((d) => {
    data = d;
    for (const f of waiting.splice(0)) f();
  }).catch(() => { /* no signs baked: play without them */ });

  // attach(sector, add) calls add(group) once the sector's signs exist (now, or when the data arrives)
  return (sector, add) => {
    const run = () => { if (sector.state === 'ready') { const g = build(sector); if (g) add(g); } };
    if (data) run(); else waiting.push(run);
  };
}
