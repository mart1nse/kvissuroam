// Parked cars and standing buses (Martin, 18 Nov): every parked car in the city is one of the game's own
// car models, and all of them can be shoved. Drive into one and it slides away as a flat rigid body with
// its handbrake on, scrubbing to a stop; it knocks on into its neighbours, stops against walls and trees,
// and stays where it ended up for the browser session (like the BMW on Jänese tänav, janese.js).
//
// To keep a car park of fifty from costing fifty full models, each model is built once and shared:
//  - near the camera a parked car is drawn with the model's own geometry and materials (one merged mesh),
//  - further away with a simplified copy of it (a few thousand triangles, one material, one draw call)
//    whose paint colour is a uniform, so every colour shares the same geometry.
import * as THREE from 'three';
import { buildCarModel, buildParkedInWorker, buildCarInWorker, unpackPicture, thinInWorker } from '../cars/models/index.js';
import { takeParts, takePartsSteps, mergeNear, bakeLodFront, bakeLodBack, thin, lowLod, unpackParked, simplifierReady } from './parkedbake.js';
import { jobs } from '../jobs.js';
import { warm } from '../warm.js';
import { CEED_GREEN } from '../cars/models/ceed.js';
import { CARS } from '../cars/specs.js';
import { createTrack } from '../race/race.js';
import { PARKING, rnd } from '../race/landmarks.js';
import { uueturuParked } from '../race/uueturu.js';
import { AKSI_CARS } from './aksi.js';
import { SIRELI_CARS } from './sireli.js';
import { POOTSMANI12_CARS } from './pootsmani12.js';
import { COOP_CARS } from './coop.js';
import { PEPLERI_CARS } from './pepleri.js';
import { JAAAEG_CARS } from './jaaaeg.js';
import { ARHITEKTI_CARS } from './arhitekti.js';
import { ELVA_CARS } from './elva.js';
import { VANEMUISE_CARS } from './vanemuise.js';
import { KORVE_CARS } from './korvekula.js';
import { KORVE2_CARS } from './korvekula2.js';
import { RIIA_CARS } from './riia.js';
import { TEATRI_CARS } from './teatripark.js';
import { KORVE3_CARS } from './korvekula3.js';
import { KORVE4_CARS } from './korvekula4.js';
import { HARIDUSE10_CARS } from './hariduse10.js';
import { NOELA_CARS } from './noela.js';
import { RAADI_CARS } from './raadi.js';
import { RAADI2_CARS } from './raadi2.js';
import { LOUNA_CARS } from './lounakeskus.js';
import { TURU_CARS } from './turu.js';
import { TURU2_CARS } from './turu2.js';
import { TURU4_CARS } from './turu4.js';
import { RIIA2_CARS } from './riia2.js';
import { ULIKOOLI_CARS } from './ulikooli.js';
import { KALURI_CARS } from './kaluri.js';
import { LENNUJAAM_CARS } from './lennujaam.js';
import { ERM_CARS } from './erm.js';
import { AOVERE_CARS } from './aovere.js';
import { AOVERE2_CARS } from './aovere2.js';
import { AOVERE3_CARS } from './aovere3.js';
import { REHETARE_CARS } from './rehetare.js';
import { RATTASEPA_CARS } from './rattasepa.js';
import { VAKSALI_CARS } from './vaksali.js';
import { LENNUAKADEEMIA_CARS } from './lennuakadeemia.js';
import { ULENURME_KONSUM_CARS } from './ulenurmekonsum.js';
import { still, stir } from '../still.js';

// ---------------------------------------------------------------- what stands where
// paint: colour, and solid (not metallic) for the plain whites
const PAINT = {
  white: [0xe8e9e8, true], black: [0x0b0b0d], silver: [0xb3b7bc], grey: [0x3a3d42], bronze: [0x86704f],
  blue: [0x1d3c6e], red: [0x5a0f15], cyan: [0x1fa9cf], lilac: [0x50294e],
  bmwred: [0xa60f18], beige: [0xcbb88f, true],  // the bright BMW red and the old Mercedes taxi beige (the Kaluri car park)
  sage: [CEED_GREEN],                          // Kia's Experience Green, a muted grey-green
};
// the mix Martin asked for: mostly Passat, Mazda and RAV4, a few bZ4X and BMW, and (19 Nov) Tesla Model 3 and
// 2010 Honda Accord saloons
const MODELS = [['passat', 22], ['mazda6', 21], ['rav4', 21], ['bz4x', 7], ['f31', 7], ['model3', 9], ['accord', 9]];
// ordinary colours first, a few bronze and blue, fewer dark red
const COLOURS = [['white', 20], ['black', 16], ['silver', 20], ['grey', 18], ['bronze', 6], ['blue', 6], ['red', 3]];
// models that come only in some colours (taken in turn)
const ONLY = { f31: ['cyan', 'white', 'black'], model3: ['white', 'black', 'blue'], accord: ['white', 'silver', 'black', 'blue'] };
// the two or three Audis: which car of the list (in order) becomes one, and its colour
const AUDIS = [[9, 'lilac'], [37, 'silver'], [61, 'black']];
// Kia Ceed Sportswagons in Experience Green (Martin, 20 Nov), one in each of several car parks: by the columns
// at Kaubamaja, the cross street north of the spawn, two in the river car park, Vallikraavi. (More stand
// outside Elva 35b and at the Coop in Kvissentali, see elva.js and coop.js.)
const KIAS = [14, 46, 70, 104, 117];
const OPTS = { passat: { scan: false }, audi200: { scan: false }, enyaq: { rack: false } };
// models with a scanned body (a GLB): a parked one wears it on a desktop and the lighter drawn body on a phone;
// TINT: the scan's paint is plain white in its picture, so it can be given any colour
const SCANNED = { m3: true, cgt: true }, TINT = { m3: true };
const MASS = { f31: 1580, model3: 1850, accord: 1530, ceedsw: 1390 };
// buses at stops (bus stop places from OpenStreetMap, moved to the kerb seen in the orthophoto):
// x, z, heading. Ten in the centre and one at Klaose in Kvissentali.
const BUS_STOPS = [
  [1681.4, 3189.8, -2.357], [1736.2, 3132.3, -2.338], [1698.9, 3205.7, 0.784], [1761.7, 3149.8, 0.795],   // Kesklinn VI, V, I, II
  [1712.0, 2951.9, -0.761], [1621.6, 2880.0, 2.406],                                                       // Vabaduse puiestee, Raeplats
  [1875.7, 3149.8, 2.387], [1979.1, 3044.7, -2.32], [2002.7, 3033.1, 0.821],                               // Soola I, Tartu bussijaam (2)
  [1418.2, 3549.0, -2.303],                                                                                // Riiamäe
  [167.9, -35.7, -1.698],                                                                                  // Klaose
];

// n items in the proportions of list ([name, weight] pairs), shuffled the same way every time
function deck(list, n, seed) {
  const total = list.reduce((s, e) => s + e[1], 0), out = [];
  list.forEach(([name, w]) => { for (let i = Math.round(n * w / total); i > 0; i--) out.push(name); });
  while (out.length < n) out.push(list[out.length % list.length][0]);
  const r = rnd(seed);
  for (let i = out.length - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [out[i], out[k]] = [out[k], out[i]]; }
  return out;
}

// every place something stands: { key, x, z, yaw (forward = sin yaw, -cos yaw), id, paint, lift, row }
function allSpots() {
  const out = [];
  for (const row of PARKING) {
    const dx = row.b[0] - row.a[0], dz = row.b[1] - row.a[1];
    const along = Math.atan2(-dz, dx);
    const r = rnd(row.seed);
    for (let i = 0; i < row.n; i++) {
      if (r() < (row.perp ? 0.22 : 0.15)) continue;              // an empty bay
      const t = (i + 0.5) / row.n, x = row.a[0] + dx * t, z = row.a[1] + dz * t;
      const cy = row.head ? Math.atan2(-row.head[1], row.head[0]) + (r() - 0.5) * 0.06
        : along + (row.perp ? Math.PI / 2 : 0) + (r() < 0.5 ? Math.PI : 0) + (r() - 0.5) * 0.08;
      out.push({ key: `r${row.seed}.${i}`, x, z, yaw: Math.PI / 2 - cy, row: true, drop: row.drop?.includes(i) });
    }
  }
  const ids = deck(MODELS, out.length, 5), paints = deck(COLOURS, out.length, 9);
  const turn = {};
  out.forEach((s, i) => {
    s.id = ids[i];
    const only = ONLY[s.id];
    s.paint = only ? only[(turn[s.id] = (turn[s.id] ?? -1) + 1) % only.length] : paints[i];
  });
  for (const [k, paint] of AUDIS) if (out[k]) Object.assign(out[k], { id: 'audi200', paint });
  for (const k of KIAS) if (out[k]) Object.assign(out[k], { id: 'ceedsw', paint: 'sage' });
  for (let i = out.length - 1; i >= 0; i--) if (out[i].drop) out.splice(i, 1);   // after the decks: nothing else changes
  uueturuParked().forEach((c, i) => out.push({ key: `u${i}`, ...c }));
  AKSI_CARS.forEach(([x, z, yaw, id, paint], i) => out.push({ key: `a${i}`, x, z, yaw, id, paint }));
  SIRELI_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `s${i}`, x, z, yaw, id, paint, lift }));
  COOP_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `c${i}`, x, z, yaw, id, paint, lift }));
  PEPLERI_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `p${i}`, x, z, yaw, id, paint, lift }));
  JAAAEG_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `j${i}`, x, z, yaw, id, paint, lift }));
  ARHITEKTI_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `ar${i}`, x, z, yaw, id, paint, lift }));
  ELVA_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `el${i}`, x, z, yaw, id, paint, lift }));
  VANEMUISE_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `vm${i}`, x, z, yaw, id, paint, lift }));
  KORVE_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `kv${i}`, x, z, yaw, id, paint, lift }));
  KORVE2_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `kw${i}`, x, z, yaw, id, paint, lift }));
  RIIA_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `ri${i}`, x, z, yaw, id, paint, lift }));
  TEATRI_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `tp${i}`, x, z, yaw, id, paint, lift }));
  KORVE3_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `kx${i}`, x, z, yaw, id, paint, lift }));
  KORVE4_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `ky${i}`, x, z, yaw, id, paint, lift }));
  HARIDUSE10_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `kz${i}`, x, z, yaw, id, paint, lift }));
  NOELA_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `no${i}`, x, z, yaw, id, paint, lift }));
  RAADI_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `rd${i}`, x, z, yaw, id, paint, lift }));
  RAADI2_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `re${i}`, x, z, yaw, id, paint, lift }));
  LOUNA_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `lk${i}`, x, z, yaw, id, paint, lift }));
  TURU_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `tu${i}`, x, z, yaw, id, paint, lift }));
  TURU2_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `tv${i}`, x, z, yaw, id, paint, lift }));
  TURU4_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `tz${i}`, x, z, yaw, id, paint, lift }));
  ULIKOOLI_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `uk${i}`, x, z, yaw, id, paint, lift }));
  RIIA2_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `r2${i}`, x, z, yaw, id, paint, lift }));
  KALURI_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `ka${i}`, x, z, yaw, id, paint, lift }));
  LENNUJAAM_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `lj${i}`, x, z, yaw, id, paint, lift }));
  ERM_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `em${i}`, x, z, yaw, id, paint, lift }));
  AOVERE_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `ao${i}`, x, z, yaw, id, paint, lift }));
  AOVERE3_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `ak${i}`, x, z, yaw, id, paint, lift }));
  AOVERE2_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `aj${i}`, x, z, yaw, id, paint, lift }));
  REHETARE_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `rt${i}`, x, z, yaw, id, paint, lift }));
  RATTASEPA_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `rs${i}`, x, z, yaw, id, paint, lift }));
  VAKSALI_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `vk${i}`, x, z, yaw, id, paint, lift }));
  LENNUAKADEEMIA_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `la${i}`, x, z, yaw, id, paint, lift }));
  ULENURME_KONSUM_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `uk${i}`, x, z, yaw, id, paint, lift }));
  POOTSMANI12_CARS.forEach(([x, z, yaw, id, paint, lift], i) => out.push({ key: `pt${i}`, x, z, yaw, id, paint, lift }));
  BUS_STOPS.forEach(([x, z, yaw], i) => out.push({ key: `b${i}`, x, z, yaw, id: 'bus', paint: null, bus: true }));
  return out;
}

// far material: vertex colours, with the paint colour and its finish as uniforms
const lodMats = new Map();
function lodMaterial(name, own = null) {
  let m = lodMats.get(name);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ vertexColors: true });
  const uPaint = { value: new THREE.Color() }, uFinish = { value: new THREE.Vector2(0.34, 0.55) };
  if (own) { uPaint.value.copy(own.color); uFinish.value.set(own.roughness, own.metalness); }   // the model's own paint (bus livery)
  else { uPaint.value.set(PAINT[name][0]); if (PAINT[name][1]) uFinish.value.set(0.38, 0.05); }
  m.onBeforeCompile = (s) => {
    s.uniforms.uPaint = uPaint; s.uniforms.uFinish = uFinish;
    s.vertexShader = `attribute vec3 aMat;\nuniform vec3 uPaint;\nuniform vec2 uFinish;\nvarying vec2 vFinish;\n${s.vertexShader}`
      .replace('#include <color_vertex>', '#include <color_vertex>\nvColor.rgb = mix( vColor.rgb, uPaint, aMat.x );\nvFinish = mix( aMat.yz, uFinish, aMat.x );');
    s.fragmentShader = `varying vec2 vFinish;\n${s.fragmentShader}`
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vFinish.x;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vFinish.y;');
  };
  m.customProgramCacheKey = () => 'parked-lod';
  lodMats.set(name, m);
  return m;
}

const templates = new Map();
// scan: wear the scanned body where the model has one (then the answer is a promise: the body has to load)
function buildTemplate(id, scan = false) {
  const scanned = !!SCANNED[id] && scan;
  const model = buildCarModel(id, SCANNED[id] ? { ...OPTS[id], scan: scanned } : OPTS[id]);
  model.setLights?.({ headlights: false });
  model.setSoot?.(0);
  return scanned && model.ready ? model.ready.then(() => takeTemplate(id, model)) : takeTemplate(id, model);
}
// A scanned body's pictures are 2048 px, and sending one to the graphics card as the first parked car of
// its kind came near took 50 to 150 ms in one go (the last stop over 0.1 s on the test drive, 21 Nov 2026).
// A parked car wears a half-size copy: a quarter of the pixels, a few ms to send, 16 MB less on the card.
// Not when the picture is on the card already (the player drives that car: sharing it costs nothing).
// Making a copy takes about 20 ms on the page, so these are steps for the work queue, one picture each;
// gives a promise that the parts wear the copies.
const halves = new WeakMap();   // a big picture -> a promise of its half-size twin
function halfOf(t) {
  let p = halves.get(t);
  if (!p) {
    const im = t.image;
    p = createImageBitmap(im, { resizeWidth: im.width >> 1, resizeHeight: im.height >> 1, resizeQuality: 'medium', premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
      .then((small) => { const c = t.clone(); c.source = new THREE.Source(small); c.needsUpdate = true; return c; });
    halves.set(t, p);
  }
  return p;
}
const MAPS = ['map', 'normalMap', 'metalnessMap', 'roughnessMap', 'emissiveMap'];
function* lighterScan(parts) {
  const mats = new Map(), waits = [];
  if (typeof createImageBitmap !== 'function') return Promise.resolve();
  for (const p of parts) {
    const m = p.mat;
    if (!m || mats.has(m)) continue;
    const big = MAPS.filter((k) => { const t = m[k], im = t?.image; return im && im.width * im.height > 1.1e6 && !im.data && !im.getContext && !warm.onCard(t); });
    if (!big.length) continue;
    const c = m.clone();
    mats.set(m, c);
    for (const k of big) {
      const fresh = !halves.has(m[k]);
      try { waits.push(halfOf(m[k]).then((t) => { c[k] = t; }, () => {})); } catch { /* the full picture stays */ }
      if (fresh) yield;
    }
  }
  for (const p of parts) if (mats.has(p.mat)) p.mat = mats.get(p.mat);
  return Promise.all(waits);
}
function takeTemplate(id, model, parts = takeParts(id, model, !!TINT[id])) {
  const paintPart = parts.find((p) => p.paint || p.tint);
  const T = {
    id, lod: null, parts, near: null, nearMats: null, paints: new Map(),
    hl: model.size.length / 2, hw: model.size.width / 2, wb: model.wheelbase, tr: model.track,
    mass: MASS[id] || CARS[id]?.mass || 1500,
    ownPaint: parts.find((p) => p.paint)?.mat || { color: new THREE.Color(0xffffff), roughness: 0.4, metalness: 0.3 },
    paintMat: paintPart?.mat, tinted: !!paintPart?.tint,
  };
  // the near version is put together the first time a car of this model is close enough to need it
  T.needNear = () => {
    if (T.near) return;
    const { near, mats } = mergeNear(T.parts);
    T.near = near;
    T.nearMats = mats;
    T.paintAt = mats.indexOf(T.paintMat);
    T.parts = null;
  };
  return withMaterials(T);
}
function letArrayGo() { this.array = null; }
// A model that came from the worker (src/world/parkedbake.js): everything is made already
function workerTemplate(id, d) {
  const u = unpackParked(d);
  const T = {
    id, lod: u.lod, low: u.low, parts: null, near: u.near, nearMats: u.nearMats, paintAt: u.paintAt, paints: new Map(),
    hl: u.size.length / 2, hw: u.size.width / 2, wb: u.wheelbase, tr: u.track,
    mass: MASS[id] || CARS[id]?.mass || 1500,
    ownPaint: u.own ? { color: new THREE.Color().fromArray(u.own.color), roughness: u.own.roughness, metalness: u.own.metalness } : { color: new THREE.Color(0xffffff), roughness: 0.4, metalness: 0.3 },
    paintMat: u.paintAt >= 0 ? u.nearMats[u.paintAt] : undefined, tinted: u.tinted,
  };
  T.needNear = () => {};
  // (the models' arrays are let go once the graphics card has them: nothing reads them after that)
  for (const g of new Set([u.near, u.lod, u.low])) for (const a of [...Object.values(g.attributes), g.index]) a?.onUpload(letArrayGo);
  keepPacked(T);
  return withMaterials(T);
}
// A model from the worker brings its bigger pictures packed, as PNG files of a few dozen kB. Sent as pixels
// they are 2 to 3 MB a model (the bus 8), and every model's pixels stayed in memory for good, on the card
// or not: 50 MB after 2 km through the centre, where a phone shows three cars close up at a time (21 Nov
// 2026). Now the pixels are unpacked when a car of the model is first wanted close up (the plain version
// stays for those few frames) and let go again once the graphics card has them.
function keepPacked(T) {
  const texs = new Set();
  for (const m of T.nearMats) for (const v of Object.values(m)) if (v?.isTexture && v.userData.packed) texs.add(v);
  let busy = false, retry = 0;
  const fill = (t) => unpackPicture(t.userData.packed).then((px) => {
    if (!px || px.length !== t.image.width * t.image.height * 4) throw new Error('picture did not unpack');
    t.image.data = px;
    t.needsUpdate = true;
  });
  const lacks = (t) => !t.userData.sent && !t.image.data;
  for (const t of texs) {
    // (sent to the card: the pixels can go. Sent without its pixels, it is not there and is unpacked again)
    t.onUpdate = () => { t.userData.sent = !!t.image.data; t.image.data = null; };
    // (taken off the card by somebody: the pixels are needed again)
    t.addEventListener('dispose', () => { t.userData.sent = false; if (T.showing && !t.image.data) fill(t).catch((e) => console.warn('parked picture', T.id, e)); });
  }
  // The car drove on before the pictures were sent (they go to the card when a car wearing them is first
  // drawn): nothing will send them now, so the pixels go again. showNear calls this as the last car of the
  // model stops being shown close up.
  T.letGo = () => { if (!T.showing && !busy) for (const t of texs) if (!t.userData.sent) t.image.data = null; };
  // are the pictures ready to be shown? If not they are on their way (asked again a few times a second)
  T.awake = () => {
    const need = [...texs].filter(lacks);
    if (need.length && !busy && performance.now() >= retry) {
      busy = true;
      Promise.all(need.map(fill)).then(() => { busy = false; setTimeout(T.letGo, 15000); },
        (e) => { console.warn('parked pictures', T.id, e); busy = false; retry = performance.now() + 5000; });
    }
    return !need.length;
  };
}
function withMaterials(T) {
  // the model's materials, with the body in this colour
  T.materials = (name) => {
    if (!name || T.paintAt < 0) return T.nearMats;
    let l = T.paints.get(name);
    if (!l) {
      const [hex, solid] = PAINT[name];
      let m = T.nearMats[T.paintAt];
      if (!T.tinted) {
        m = m.clone();
        m.color.set(hex);
        if (solid) Object.assign(m, { metalness: 0.05, roughness: 0.38 });
      } else if (name !== 'white') {
        // a scanned body: its picture holds the paint as white, which is multiplied by the colour (the
        // glass, lamps, grilles and trim in the same picture are dark or coloured and stay as they are)
        m = m.clone();
        const uPaint = { value: new THREE.Color(hex) };
        m.onBeforeCompile = (s) => {
          s.uniforms.uPaint = uPaint;
          s.fragmentShader = `uniform vec3 uPaint;\n${s.fragmentShader}`.replace('#include <map_fragment>',
            '#include <map_fragment>\n{ float pm = smoothstep( 0.22, 0.5, min( diffuseColor.r, min( diffuseColor.g, diffuseColor.b ) ) );\ndiffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * uPaint, pm ); }');
        };
        m.customProgramCacheKey = () => 'parked-scan-tint';
      }
      l = T.nearMats.slice(); l[T.paintAt] = m;
      T.paints.set(name, l);
    }
    return l;
  };
  return T;
}

// ---------------------------------------------------------------- boxes that bump
const axes = (yaw) => [Math.sin(yaw), -Math.cos(yaw), Math.cos(yaw), Math.sin(yaw)];
// separating-axis test of two boxes {x, z, yaw, hl, hw}: overlap and the normal pushing a out of b
function overlap(a, b) {
  const [fx, fz, rx, rz] = axes(a.yaw), [gx, gz, sx, sz] = axes(b.yaw);
  const dx = a.x - b.x, dz = a.z - b.z;
  let best = Infinity, nx = 0, nz = 0;
  for (const [ax, az] of [[fx, fz], [rx, rz], [gx, gz], [sx, sz]]) {
    const ra = a.hl * Math.abs(fx * ax + fz * az) + a.hw * Math.abs(rx * ax + rz * az);
    const rb = b.hl * Math.abs(gx * ax + gz * az) + b.hw * Math.abs(sx * ax + sz * az);
    const d = dx * ax + dz * az, pen = ra + rb - Math.abs(d);
    if (pen <= 0) return null;
    if (pen < best) { best = pen; const sg = d >= 0 ? 1 : -1; nx = ax * sg; nz = az * sg; }
  }
  return { pen: best, nx, nz };
}
// roughly where two overlapping boxes touch: the average of the corners of each inside the other
function contact(a, b) {
  let cx = 0, cz = 0, n = 0;
  const inside = (p, o) => {
    const [fx, fz, rx, rz] = axes(o.yaw), dx = p[0] - o.x, dz = p[1] - o.z;
    return Math.abs(dx * fx + dz * fz) <= o.hl && Math.abs(dx * rx + dz * rz) <= o.hw;
  };
  for (const [o, other] of [[a, b], [b, a]]) {
    const [fx, fz, rx, rz] = axes(o.yaw);
    for (const [l, t] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const p = [o.x + fx * o.hl * l + rx * o.hw * t, o.z + fz * o.hl * l + rz * o.hw * t];
      if (inside(p, other)) { cx += p[0]; cz += p[1]; n++; }
    }
  }
  return n ? [cx / n, cz / n] : [(a.x + b.x) / 2, (a.z + b.z) / 2];
}

const KEY = 'streetlap.parked';
const MU_G = 4.2;                 // handbrake on, in gear: scrubs to a stop at about 0.43 g
const SPIN_DECEL = 3.0;           // rad/s^2 of scrub when it is twisted round
const E = 0.15;                   // bounce

export function createParked(scene, world, opts = {}) {
  const track = createTrack();
  const touch = !!opts.touch;
  const VIEW = touch ? 240 : 520;                      // drawn within this distance of the camera
  const tris = touch ? 3200 : 6000;                    // triangles of the far version
  const tune = { near: touch ? 26 : 45, nearMax: touch ? 3 : 10 };   // full models: how close, and how many at once
  const LOW = touch ? 55 : 110, lowTris = touch ? 450 : 700;        // beyond this the very far version, of so many triangles
  const spots = allSpots(), bodies = [];
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch { /* none */ }
  const group = new THREE.Group();
  group.name = 'parked';
  still(group);                     // a parked car stands until it is hit: setPose says when one has moved (src/still.js)
  scene.add(group);

  // models are built one at a time, with a pause between, so that no frame waits long (on a phone a
  // longer pause, so the memory each build churns through is given back before the next one)
  // On a phone no model is built before DRIVE nor in the seconds after it or after a map jump (hold): a
  // build throws away 100-250 MB, and builds running into DRIVE and its first frames behind the car are
  // what made an iPhone 13 reload the page 1-2 s after DRIVE (20 Nov). The cars stand there from then on.
  const queue = [];
  let building = false, holdUntil = touch ? Infinity : 0;
  const gap = touch ? 1200 : 150;
  function want(id) {
    if (templates.has(id)) return templates.get(id);
    templates.set(id, null);
    queue.push(id);
    pump();
    return null;
  }
  function pump() {
    if (building || !queue.length) return;
    building = true;
    const run = () => {
      const wait = holdUntil - performance.now();
      if (wait > 0) { setTimeout(run, Math.min(wait, 500)); return; }
      const id = queue.shift();
      const next = () => { building = false; pump(); };
      const fail = (e) => { console.warn('parked', id, e); templates.set(id, false); next(); };
      // the far versions, a step a frame (src/jobs.js)
      const bake = (T) => setTimeout(() => jobs.add(function* () {
        let st;
        try { st = yield* bakeLodFront(T.parts, id, tris); } catch (e) { fail(e); return; }
        const finish = (idx) => jobs.add(function* () {
          try {
            if (!idx) { yield 'frame'; idx = thin(st.index, st.vp, st.target); yield; }
            T.lod = bakeLodBack(st, idx); yield; T.low = lowLod(T.lod, lowTris); templates.set(id, T);
          } catch (e) { fail(e); return; }
          next();
        }, 'parked');
        // (a long triangle list, a scanned body's, is thinned in the car worker while somebody drives: on the
        // page it was one step of 30 to 70 ms, the longest pause at the start of a first lap, 22 Nov 2026)
        if (st.vp && st.index.length > 30000 && jobs.live) thinInWorker(id, st.index, st.vp, st.target).then(finish, () => finish(null));
        else finish(null);
      }, 'parked'), touch ? 300 : 120);
      // all of it on the page, where there is no worker
      const here = () => {
        try {
          const T = buildTemplate(id, !touch);
          if (T.then) T.then(bake, fail); else bake(T);
        } catch (e) { fail(e); }
      };
      const scanned = !!SCANNED[id] && !touch;
      if (scanned) {
        // a scanned body is put on here on the page: the car under it comes from the worker
        buildCarInWorker(id, { ...OPTS[id], scan: true }).then((model) => {
          if (!model) { here(); return; }
          model.setLights?.({ headlights: false });
          model.setSoot?.(0);
          Promise.resolve(model.ready).then(() => jobs.add(function* () {
            try {
              const parts = yield* takePartsSteps(id, model, !!TINT[id]);
              yield;
              const small = yield* lighterScan(parts);
              small.then(() => jobs.add(() => { try { bake(takeTemplate(id, model, parts)); } catch (e) { fail(e); } }, 'parked'), fail);
            } catch (e) { fail(e); }
          }, 'parked'), fail);
        });
        return;
      }
      // everything else is built in the worker and arrives finished (src/world/parkedbake.js)
      buildParkedInWorker(id, SCANNED[id] ? { ...OPTS[id], scan: false } : OPTS[id], { tint: false, tris, lowTris, pack: true }).then((d) => {
        if (!d) { here(); return; }
        try { templates.set(id, workerTemplate(id, d)); } catch (e) { console.warn('parked from worker', id, e); here(); return; }
        next();
      });
    };
    simplifierReady().then(() => setTimeout(run, gap));
  }

  const up = new THREE.Vector3(0, 1, 0), nrm = new THREE.Vector3(), v1 = new THREE.Vector3(), qYaw = new THREE.Quaternion(), qTilt = new THREE.Quaternion();
  // sit it on the ground under its four wheels
  function setPose(b) {
    const [fx, fz, rx, rz] = axes(b.yaw);
    const h = (l, t) => world.heightAt(b.x + fx * l + rx * t, b.z + fz * l + rz * t);
    const fl = h(b.wb / 2, -b.tr / 2), fr = h(b.wb / 2, b.tr / 2), rl = h(-b.wb / 2, -b.tr / 2), rr = h(-b.wb / 2, b.tr / 2);
    if (![fl, fr, rl, rr].every(Number.isFinite)) return;
    nrm.set(0, 1, 0)
      .addScaledVector(v1.set(fx, 0, fz), -(fl + fr - rl - rr) / 2 / b.wb)
      .addScaledVector(v1.set(rx, 0, rz), -(fr + rr - fl - rl) / 2 / b.tr).normalize();
    qYaw.setFromAxisAngle(up, -b.yaw);
    qTilt.setFromUnitVectors(up, nrm);
    b.g.quaternion.copy(qTilt).multiply(qYaw);
    b.y = (fl + fr + rl + rr) / 4;
    b.g.position.set(b.x, b.y + b.lift, b.z);
    stir(b.g);
  }

  function spawn(s, T) {
    s.done = true;
    if (s.row) {
      // never on the race line or inside a building
      const n = track.nearest(s.x, s.z, -1);
      if (n.d < (track.HW[n.i] ?? 6) + 2 || world.sdfAt(s.x, s.z) < 1.6) return;
    } else if (s.bus && world.sdfAt(s.x, s.z) < 0.6) return;
    const b = {
      s, T, x: s.x, z: s.z, yaw: s.yaw, hl: T.hl, hw: T.hw, wb: T.wb, tr: T.tr, mass: T.mass,
      inertia: T.mass * ((2 * T.hl) ** 2 + (2 * T.hw) ** 2) / 12,
      vx: 0, vz: 0, w: 0, moving: false, y: 0, lift: s.lift || 0, moved: false,
      g: new THREE.Group(), far: null, near: null, isNear: false, isLow: false,
    };
    const at = saved[s.key];
    if (at && Number.isFinite(at[0])) { b.x = at[0]; b.z = at[1]; b.yaw = at[2]; b.moved = true; }
    b.far = new THREE.Mesh(T.lod, s.paint ? lodMaterial(s.paint) : lodMaterial(`own.${T.id}`, T.ownPaint));
    b.far.castShadow = !!opts.shadows; b.far.receiveShadow = true;
    b.g.add(b.far);
    setPose(b);
    group.add(b.g);
    bodies.push(b);
  }
  function showNear(b, on) {
    if (b.isNear === on) return;
    if (on && b.T.awake && !b.T.awake()) return;     // (its pictures are being unpacked: the plain version stays)
    b.isNear = on;
    b.T.showing = (b.T.showing || 0) + (on ? 1 : -1);
    if (!on && !b.T.showing) b.T.letGo?.();
    if (on && !b.near) {
      b.T.needNear();
      b.near = new THREE.Mesh(b.T.near, b.T.materials(b.s.paint));
      b.near.castShadow = !!opts.shadows; b.near.receiveShadow = true;
      b.g.add(b.near);
    }
    if (b.near) b.near.visible = on;
    // (a detailed body just made is still on its way to the graphics card, unseen (warm.js): the plain one stays till then)
    if (on && warm.holding(b.near)) { b.far.visible = true; if (!swapping.includes(b)) swapping.push(b); } else b.far.visible = !on;
  }
  const swapping = [];
  function swaps() {
    for (let k = swapping.length - 1; k >= 0; k--) {
      const b = swapping[k];
      if (b.near && warm.holding(b.near)) continue;
      b.far.visible = !b.isNear;
      swapping.splice(k, 1);
    }
  }

  // ---- the player's car (as a box) against a parked one: share the overlap by mass and swap momentum
  function hitByCar(car, cb, b) {
    const o = overlap(cb, b);
    if (!o) return;
    const M = car.spec.mass || 1500, m = b.mass;
    const [fx, fz, rx, rz] = axes(car.yaw);
    car.x += o.nx * o.pen * m / (M + m); car.z += o.nz * o.pen * m / (M + m);
    b.x -= o.nx * o.pen * M / (M + m); b.z -= o.nz * o.pen * M / (M + m);
    cb.x = car.x; cb.z = car.z;
    const [px, pz] = contact(cb, b);
    const rbx = px - b.x, rbz = pz - b.z;
    const cvx = car.vx * fx + car.vy * rx, cvz = car.vx * fz + car.vy * rz;
    const bvx = b.vx - b.w * rbz, bvz = b.vz + b.w * rbx;             // its velocity at the contact
    const vrel = (cvx - bvx) * o.nx + (cvz - bvz) * o.nz;
    b.moving = true; b.moved = true;
    if (vrel >= 0) return;
    const lever = -rbz * o.nx + rbx * o.nz;                           // perp(r) . n
    const j = -(1 + E) * vrel / (1 / M + 1 / m + lever * lever / b.inertia);
    const nvx = cvx + j * o.nx / M, nvz = cvz + j * o.nz / M;
    car.vx = nvx * fx + nvz * fz; car.vy = nvx * rx + nvz * rz;
    b.vx -= j * o.nx / m; b.vz -= j * o.nz / m;
    b.w -= lever * j / b.inertia;
    // a glancing knock turns the player's car a little, as against another player
    const dx = car.x - b.x, dz = car.z - b.z;
    car.yawRate += Math.max(-1.2, Math.min(1.2, -(o.nx * rx + o.nz * rz) * (dx * fx + dz * fz) * j / M * 0.25));
    car.hit = Math.max(car.hit, j / M);
  }
  // ---- a sliding parked car against another one
  function knock(a, b) {
    const o = overlap(a, b);
    if (!o) return;
    const s = a.mass + b.mass;
    a.x += o.nx * o.pen * b.mass / s; a.z += o.nz * o.pen * b.mass / s;
    b.x -= o.nx * o.pen * a.mass / s; b.z -= o.nz * o.pen * a.mass / s;
    const [px, pz] = contact(a, b);
    const rax = px - a.x, raz = pz - a.z, rbx = px - b.x, rbz = pz - b.z;
    const vrel = (a.vx - a.w * raz - b.vx + b.w * rbz) * o.nx + (a.vz + a.w * rax - b.vz - b.w * rbx) * o.nz;
    if (!b.moving) { b.moving = true; b.moved = true; b.vx = b.vz = b.w = 0; }
    if (vrel >= 0) return;
    const la = rax * o.nz - raz * o.nx, lb = rbx * o.nz - rbz * o.nx;
    const j = -(1 + E) * vrel / (1 / a.mass + 1 / b.mass + la * la / a.inertia + lb * lb / b.inertia);
    a.vx += j * o.nx / a.mass; a.vz += j * o.nz / a.mass; a.w += la * j / a.inertia;
    b.vx -= j * o.nx / b.mass; b.vz -= j * o.nz / b.mass; b.w -= lb * j / b.inertia;
  }
  const grad = [0, 0], trunks = [];
  let saveIn = 0;
  function step(b, dt) {
    b.x += b.vx * dt; b.z += b.vz * dt; b.yaw += b.w * dt;
    // tyres scrubbing: a steady friction deceleration of the slide and of the spin
    const sp = Math.hypot(b.vx, b.vz);
    const k = sp > 1e-6 ? Math.max(0, sp - MU_G * dt) / sp : 0;
    b.vx *= k; b.vz *= k;
    b.w = Math.sign(b.w) * Math.max(0, Math.abs(b.w) - SPIN_DECEL * dt);
    // buildings, walls and the map edge: keep its edges out, stop the motion into them
    const [fx, fz, rx, rz] = axes(b.yaw);
    const n = Math.max(1, Math.ceil(b.hl / 1.5));
    for (let i = -n; i <= n; i++) for (const t of [1, -1]) {
      const px = b.x + fx * b.hl * i / n + rx * b.hw * t, pz = b.z + fz * b.hl * i / n + rz * b.hw * t;
      const d = world.sdfAt(px, pz);
      if (!(d < 0)) continue;
      world.sdfGrad(px, pz, grad);
      b.x -= grad[0] * d; b.z -= grad[1] * d;
      const vn = b.vx * grad[0] + b.vz * grad[1];
      if (vn < 0) { b.vx -= 1.2 * vn * grad[0]; b.vz -= 1.2 * vn * grad[1]; b.w *= 0.5; }
    }
    // tree trunks: round posts against the box
    world.trunksNear(b.x, b.z, b.hl + 1.5, trunks);
    for (let i = 0; i < trunks.length; i += 3) {
      const dx = trunks[i] - b.x, dz = trunks[i + 1] - b.z, r = trunks[i + 2];
      const l = dx * fx + dz * fz, t = dx * rx + dz * rz;
      const ql = Math.max(-b.hl, Math.min(b.hl, l)), qt = Math.max(-b.hw, Math.min(b.hw, t));
      let ex = l - ql, ez = t - qt, d = Math.hypot(ex, ez);
      if (d >= r) continue;
      if (d < 1e-4) {                                                 // trunk centre inside the box: out through the nearest side
        if (b.hl - Math.abs(l) < b.hw - Math.abs(t)) { ex = Math.sign(l) || 1; ez = 0; d = -(b.hl - Math.abs(l)); }
        else { ex = 0; ez = Math.sign(t) || 1; d = -(b.hw - Math.abs(t)); }
      } else { ex /= d; ez /= d; }
      const nx = -(ex * fx + ez * rx), nz = -(ex * fz + ez * rz), pen = r - d;   // pushes the box off the trunk
      b.x += nx * pen; b.z += nz * pen;
      const vn = b.vx * nx + b.vz * nz;
      if (vn < 0) { b.vx -= 1.2 * vn * nx; b.vz -= 1.2 * vn * nz; b.w *= 0.5; }
    }
    for (const o of bodies) {
      if (o === b) continue;
      const reach = b.hl + o.hl + 1;
      if (Math.abs(o.x - b.x) < reach && Math.abs(o.z - b.z) < reach && Math.abs(o.y - b.y) < 2.5) knock(b, o);
    }
    if (Math.hypot(b.vx, b.vz) < 0.02 && Math.abs(b.w) < 0.02) {
      b.vx = b.vz = b.w = 0; b.moving = false;
      saveIn = 0.3;
    }
  }
  function save() {
    for (const b of bodies) if (b.moved) saved[b.s.key] = [+b.x.toFixed(2), +b.z.toFixed(2), +b.yaw.toFixed(4)];
    try { sessionStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* private mode */ }
  }

  let scanIn = 0, lodIn = 0;
  const order = [];
  // car: the player's car; eye: the camera position (the drone intro looks at places far from the car)
  function update(car, dt, eye = car) {
    const ex = eye.x, ez = eye.z;
    // ---- stand cars where the ground has loaded, nearest models first
    if ((scanIn -= dt) <= 0) {
      scanIn = 0.4;
      for (const s of spots) {
        if (s.done) continue;
        const d = Math.min(Math.hypot(s.x - ex, s.z - ez), Math.hypot(s.x - car.x, s.z - car.z));
        if (d > VIEW + 60 || !world.ready(s.x, s.z)) continue;
        const T = want(s.id);
        if (T) spawn(s, T); else if (T === false) s.done = true;
      }
    }
    // ---- bumps
    const cb = { x: car.x, z: car.z, yaw: car.yaw, hl: car.halfLen, hw: car.halfWid };
    for (const b of bodies) {
      const reach = b.hl + cb.hl + 1;
      if (Math.abs(b.x - car.x) < reach && Math.abs(b.z - car.z) < reach && Math.abs(car.y - b.y) < 2.5) hitByCar(car, cb, b);
    }
    for (const b of bodies) {
      if (!b.moving) continue;
      for (let i = 0; i < 2; i++) if (b.moving) step(b, dt / 2);
      setPose(b);
    }
    if (saveIn > 0 && (saveIn -= dt) <= 0) save();
    // ---- which are drawn, and which of them in full
    if (swapping.length) swaps();
    if ((lodIn -= dt) <= 0) {
      lodIn = 0.2;
      order.length = 0;
      for (const b of bodies) {
        const d = Math.hypot(b.x - ex, b.z - ez);
        b.g.visible = d < VIEW;
        b.d = d;
        const low = d > LOW * (b.isLow ? 0.9 : 1);
        if (low !== b.isLow) { b.isLow = low; b.far.geometry = low ? b.T.low : b.T.lod; }
        if (d < tune.near * (b.isNear ? 1.15 : 1) * (b.s.bus ? 1.6 : 1)) order.push(b); else showNear(b, false);
      }
      order.sort((a, b) => a.d - b.d);
      order.forEach((b, i) => showNear(b, i < tune.nearMax));
    }
  }
  // no new models for s seconds from now (phones only; the first call, at DRIVE, lets them start)
  const hold = (s) => {
    const t = performance.now() + s * 1000;
    if (touch) holdUntil = holdUntil === Infinity ? t : Math.max(holdUntil, t);
  };
  return { update, bodies, spots, group, templates, tune, hold };
}
