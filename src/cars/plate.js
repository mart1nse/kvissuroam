// A player's own number plate on their car (Martin, 25 Nov 2026; the plate itself: src/net/plates.js).
// The car's own plates stay as they are and a thin sheet with the player's plate is laid over each, a millimetre
// out: over the plates the procedural body was built with (kit.js plate(): the corners are kept on the car as
// group.userData.plates), or over a scanned body's own plate sheets (its 'ov_plate' quads, glbbody.js).
// One small picture per car (512 x 112 on a computer, about 300 x 66 on a phone: 0.3 MB and 0.1 MB with its
// smaller copies), the same kind of material as the car's badges (no new shader), and nothing at all on a car
// that keeps its own plate. Stand-ins and the far cars carry none.
import * as THREE from 'three';
import { drawPlate } from './drawplate.js';
import { paintScale } from '../world/paintscale.js';

// each car's own plate, for the box's grey hint in the garage
export const OWN_PLATE = {
  w201: '190 EEE', audi200: '200 QTR', passat: '019 TDI', crv: '207 CRV', enyaq: '823 ENQ', rav4: '369 RAV', mazda6: '006 MAZ',
  bz4x: '444 BZX', m3: '333 BMW', impreza: '022 STI', f40: '040 FER', cgt: '001 POR', bus: '408 TNS',
};

const OUT = 0.001;                 // metres out from the plate under it
// A scanned body without plate sheets of its own (the Carrera GT): its plates are in the body's picture, on flat
// parts of the scan (measured from the file: the back at z 2.078, the front at -2.24 to -2.25), where the sheets go:
// [middle x, y, z, width, height]
const SCAN_PLATES = { cgt: [[0, 0.405, 2.080, 0.52, 0.113], [0, 0.375, -2.256, 0.52, 0.113]] };
const scanQuads = new WeakMap();   // a scanned body's plate geometry -> its plate quads (the same for every car of the kind)

// a scanned body's plate quads: the first quads of its 'ov_plate' mesh whose picture is the whole plate (the Impreza's
// carries its tailpipe after them)
function quadsOfScan(mesh) {
  const g = mesh.geometry;
  if (scanQuads.has(g)) return scanQuads.get(g);
  const P = g.attributes.position, U = g.attributes.uv, out = [];
  for (let i = 0; U && i + 3 < P.count; i += 4) {
    let corners = 0;
    for (let k = 0; k < 4; k++) { const u = U.getX(i + k), v = U.getY(i + k); if ((u < 0.01 || u > 0.99) && (v < 0.01 || v > 0.99)) corners++; }
    if (corners < 4) break;
    const q = { p: [], uv: [] };
    for (let k = 0; k < 4; k++) { q.p.push(P.getX(i + k), P.getY(i + k), P.getZ(i + k)); q.uv.push(U.getX(i + k), U.getY(i + k)); }
    out.push(q);
  }
  scanQuads.set(g, out);
  return out;
}

// where this car's plates are, in the car's own space: [{ p: 4 corners, uv: their picture corners (top left 0 0) }]
function spots(car) {
  const g = car.group, out = [];
  let layers = null;
  if (car.glbLoaded) {
    for (const m of g.children) {
      if (!m.isMesh || m.material?.name !== 'ov_plate') continue;
      m.updateMatrix();
      for (const q of quadsOfScan(m)) {
        const v = new THREE.Vector3(), p = [];
        for (let k = 0; k < 4; k++) { v.fromArray(q.p, k * 3).applyMatrix4(m.matrix); p.push(v.x, v.y, v.z); }
        out.push({ p, uv: q.uv });
      }
      layers = m.layers.mask;
    }
    if (out.length || !SCAN_PLATES[g.name]) return { list: out, layers };
  }
  const fixed = car.glbLoaded && SCAN_PLATES[g.name];
  if (fixed) {
    // (corners a b c d from the bottom left as seen from outside, like kit.js plate())
    for (const [x, y, z, w, h] of fixed) {
      const s = Math.sign(z), l = x - (s * w) / 2, r = x + (s * w) / 2;
      out.push({ p: [l, y - h / 2, z, r, y - h / 2, z, r, y + h / 2, z, l, y + h / 2, z], uv: [0, 1, 1, 1, 1, 0, 0, 0] });
    }
  } else for (const p of car.plates || g.userData.plates || []) out.push({ p, uv: [0, 1, 1, 1, 1, 0, 0, 0] });   // (kit.js plate(): a b c d from the bottom left)
  for (const m of g.children) if (m.isMesh && /_atlas$/.test(m.name)) { layers = m.layers.mask; break; }
  return { list: out, layers };
}

function sheet(list) {
  const pos = [], uv = [], nor = [], idx = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), n = new THREE.Vector3();
  for (const q of list) {
    a.fromArray(q.p, 0); b.fromArray(q.p, 3); d.fromArray(q.p, 9);
    n.subVectors(b, a).cross(d.sub(a)).normalize();
    // outward: away from the middle of the car, front or back (the scans' front plates run the other way round)
    const cz = (q.p[2] + q.p[5] + q.p[8] + q.p[11]) / 4;
    const flip = n.z * cz < 0;
    if (flip) n.negate();
    const base = pos.length / 3;
    const o = OUT;
    for (let k = 0; k < 4; k++) {
      pos.push(q.p[k * 3] + n.x * o, q.p[k * 3 + 1] + n.y * o, q.p[k * 3 + 2] + n.z * o);
      nor.push(n.x, n.y, n.z); uv.push(q.uv[k * 2], q.uv[k * 2 + 1]);
    }
    if (flip) idx.push(base, base + 3, base + 2, base, base + 2, base + 1);
    else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

function picture(text) {
  const s = paintScale(), w = Math.round(512 * s), h = Math.round(112 * s);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  drawPlate(c.getContext('2d'), 0, 0, w, h, text);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.flipY = false;
  return t;
}

// The plate off the car: its sheet, material and picture freed.
export function dropPlate(car) {
  const m = car?.plateMesh;
  if (!m) return;
  m.parent?.remove(m);
  m.geometry.dispose(); m.material.map?.dispose(); m.material.dispose();
  car.plateMesh = null;
  if (car.fade?.a === 1) car.fade = null;      // (multiplayer.js: the see-through list is made again with it)
}

// Put this plate on the car ('' or none: the car's own plates). Again once a scanned body has come.
export function setCarPlate(car, text) {
  if (!car?.group) return;
  car.plateText = text || '';
  dropPlate(car);
  if (!text) return;
  if (car.ready && !car.glbLoaded && !car.plateWait) {
    car.plateWait = true;
    car.ready.then(() => { car.plateWait = false; if (car.plateText && car.glbLoaded) setCarPlate(car, car.plateText); }, () => {});
  }
  const { list, layers } = spots(car);
  if (!list.length) return;
  const mat = new THREE.MeshStandardMaterial({ map: picture(text), alphaTest: 0.5, roughness: 0.45, metalness: 0.15, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const mesh = new THREE.Mesh(sheet(list), mat);
  mesh.name = `${car.group.name}_myplate`;
  mesh.castShadow = false; mesh.receiveShadow = false;
  if (layers != null) mesh.layers.mask = layers;
  car.group.add(mesh);
  car.plateMesh = mesh;
  if (car.fade?.a === 1) car.fade = null;
}
