// Procedural car models. See kit.js for the shared toolkit.
import * as THREE from 'three';
import { applyLights } from './kit.js';
import { deserializeCar } from './serial.js';
import { useGlbBody } from './glbbody.js';
import { outside } from '../../hitches.js';
import { buildW201 } from './w201.js';
import { buildCRV } from './crv.js';
import { buildEnyaq } from './enyaq.js';
import { buildRAV4 } from './rav4.js';
import { buildMazda6 } from './mazda6.js';
import { buildBZ4X } from './bz4x.js';
import { buildF40 } from './f40.js';
import { buildAudi200 } from './audi200.js';
import { buildM3 } from './m3.js';
import { buildImpreza } from './impreza.js';
import { buildCGT } from './cgt.js';
import { buildBus } from './bus.js';
import { buildPassat, setSoot as setPassatSoot } from './passat.js';
import { buildF31 } from './f31.js';
import { buildModel3, buildAccord } from './saloons.js';
import { buildCeedSW } from './ceed.js';

export const CAR_IDS = ['w201', 'audi200', 'passat', 'crv', 'enyaq', 'rav4', 'mazda6', 'bz4x', 'm3', 'impreza', 'f40', 'cgt', 'bus'];
const BUILDERS = { w201: buildW201, crv: buildCRV, enyaq: buildEnyaq, rav4: buildRAV4, mazda6: buildMazda6, bz4x: buildBZ4X, f40: buildF40, audi200: buildAudi200, m3: buildM3, impreza: buildImpreza, cgt: buildCGT, bus: buildBus, passat: buildPassat,
  // not drivable: the parked BMW on Jänese tänav (src/world/janese.js)
  f31: buildF31,
  // not drivable: parked saloons (src/world/parked.js)
  model3: buildModel3, accord: buildAccord,
  // not drivable: parked Kia Ceed Sportswagon in Experience Green
  ceedsw: buildCeedSW };

// Returns a fresh model each call:
// { group, wheels: { fl, fr, rl, rr: { steer, spin } }, wheelRadius, wheelbase, track,
//   size: { length, width, height }, setLights({ brake, reverse, headlights }) }
// opts are for the builder (the Enyaq takes { rack: false } and { paint: hex } for a parked one).
export function buildCarModel(id, opts) {
  const build = BUILDERS[id];
  if (!build) throw new Error(`Unknown car model "${id}"`);
  return build(opts);
}

// ---------------------------------------------------------------- copies of a built car
// Building a car takes a few hundred milliseconds in one piece (the body is cut and the badges are
// projected onto it), long enough to freeze the picture: it did every time another player came online
// or changed cars (Martin, 2026-11-19). Other players' cars are copies of one car of each kind built
// once (the template, never shown): a copy shares the template's geometry, textures and most materials
// and takes about a millisecond. It gets its own wheel pivots, lamp materials (car.lit) and soot (car.soot),
// so each copy's brake lights and soot follow its own car.
const templates = new Map();
// warm(object) -> promise: compiles the shaders of a car before it is first drawn (main.js sets it to the
// renderer's compileAsync), so that the first frame with a new car in it doesn't wait for them
let warm = () => Promise.resolve();
export function setCarWarmer(fn) { warm = fn; }
const warmed = (T, p) => { T.warmed = false; T.warming = Promise.resolve(p).catch(() => {}).then(() => { T.warmed = true; }); };

// The template for this car, built here and now if it hasn't been (the slow part: see requestCarModel).
function template(id) {
  let T = templates.get(id);
  if (T === false) throw new Error(`Car model "${id}" failed to build`);
  if (!T) {
    try { T = buildCarModel(id); } catch (e) { templates.set(id, false); throw e; }
    adopt(id, T);
  }
  return T;
}
function adopt(id, T) {
  T.setLights({ brake: false, reverse: false, headlights: false });
  templates.set(id, T);
  // A scanned body still to come hides the modelled one: the car is made ready once, with the scan on (or after it
  // failed to load), and the copies take it then (see instanceCarModel). Until then another player's car of this
  // kind is its far stand-in. (Before 25 Nov 2026 the modelled body was made ready first and shown meanwhile: its
  // shaders, pictures and model went to the graphics card for the second or two until the scan replaced it.)
  if (T.ready) { T.warmed = false; T.ready = T.warming = T.ready.then(() => { warmed(T, warm(T.group)); return T.warming; }); }
  else warmed(T, warm(T.group));
}

// Templates are built in a worker (worker.js) where the browser can: the car comes back as data and is
// put together here in a few milliseconds. Without a worker (or if it fails) they are built here.
let worker = null, workerOk = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof window !== 'undefined';
const pending = new Map();                          // id -> when it was asked for
const unwanted = new Set();                         // dropped while the worker was still building it
function startWorker() {
  if (!workerOk) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  } catch (e) { console.warn('car worker unavailable', e); workerOk = false; return null; }
  worker.onmessage = (e) => {
    const t0 = performance.now();
    try { carMessage(e); } finally { outside.note('car', t0); }      // (time outside the game's frame: src/hitches.js)
  };
  const carMessage = (e) => {
    const { id, key, data, error } = e.data;
    if (key != null) {                                 // an answer for the parked cars
      const done = asked.get(key);
      asked.delete(key);
      if (error) console.warn('car worker', id, error);
      done?.(error ? null : data);
      return;
    }
    pending.delete(id);
    if (unwanted.delete(id)) return;
    if (templates.has(id)) return;
    if (error) { console.warn('car worker', id, error); workerOk = false; return; }
    try {
      const T = deserializeCar(data);
      T.setLights = (o = {}) => applyLights(T, o);
      if (T.soot) { T.sootFor = SOOT[id]; T.setSoot = (k) => T.sootFor(T, k); }
      if (T.glbArgs) useGlbBody(T, T.glbArgs.file, T.glbArgs.opts);
      adopt(id, T);
    } catch (err) { console.warn('car from worker', id, err); workerOk = false; }
  };
  worker.onerror = (e) => { console.warn('car worker failed', e.message); workerOk = false; pending.clear(); for (const done of asked.values()) done(null); asked.clear(); };
  return worker;
}
const SOOT = { passat: setPassatSoot };

// Other work for the worker than a player's car. Each resolves with null where there is no worker or it
// failed: then the page does the work itself.
const asked = new Map();
let askKey = 0;
function ask(msg) {
  return new Promise((resolve) => {
    if (!BUILDERS[msg.id] || !startWorker()) { resolve(null); return; }
    const key = ++askKey;
    // (no answer in 20 s: done on the page after all)
    const timer = setTimeout(() => { if (asked.delete(key)) resolve(null); }, 20000);
    asked.set(key, (data) => { clearTimeout(timer); resolve(data); });
    worker.postMessage({ ...msg, key });
  });
}
// a parked car's model, near and far versions and all, as data (src/world/parkedbake.js)
export const buildParkedInWorker = (id, opts, parked) => ask({ id, opts, parked });
// a triangle list thinned in the worker (src/world/parkedbake.js: thin); null where the page has to do it
export const thinInWorker = (id, index, vp, target) => ask({ id, thin: { index, vp, target } });

// The pixels of a picture that the worker sent as a file (serial.js: userData.packed), as a Uint8Array.
// In a small worker of its own where the browser can, else here on the page.
let unpacker = null, unpackerOk = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof window !== 'undefined';
const unpacking = new Map();
let unpackKey = 0;
async function unpackHere(blob) {
  const bm = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = bm.width; c.height = bm.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bm, 0, 0);
  bm.close?.();
  const d = g.getImageData(0, 0, c.width, c.height).data;
  c.width = c.height = 0;
  return new Uint8Array(d.buffer);
}
export function unpackPicture(blob) {
  if (unpackerOk && !unpacker) {
    try {
      unpacker = new Worker(new URL('./unpack-worker.js', import.meta.url), { type: 'module' });
      unpacker.onmessage = (e) => { const done = unpacking.get(e.data.key); unpacking.delete(e.data.key); done?.(e.data.error ? null : e.data.data); };
      unpacker.onerror = () => { unpackerOk = false; for (const done of unpacking.values()) done(null); unpacking.clear(); };
    } catch { unpackerOk = false; }
  }
  if (!unpackerOk) return unpackHere(blob);
  return new Promise((resolve) => {
    const key = ++unpackKey;
    const timer = setTimeout(() => { if (unpacking.delete(key)) resolve(null); }, 10000);
    unpacking.set(key, (data) => { clearTimeout(timer); resolve(data); });
    unpacker.postMessage({ key, blob });
  }).then((data) => data || unpackHere(blob));
}
// a car built with the builder's options (a parked one with a scanned body: the body is put on here)
export function buildCarInWorker(id, opts) {
  return ask({ id, opts }).then((data) => {
    if (!data) return null;
    try {
      const T = deserializeCar(data);
      T.setLights = (o = {}) => applyLights(T, o);
      if (T.soot) { T.sootFor = SOOT[id]; T.setSoot = (k) => T.sootFor(T, k); }
      if (T.glbArgs) useGlbBody(T, T.glbArgs.file, T.glbArgs.opts);
      return T;
    } catch (err) { console.warn('car from worker', id, err); return null; }
  });
}

// Is this car's template ready for instanceCarModel? If not, it is built in the worker (true once it
// is back). now: the car is needed straight away and may be built here if there is no worker.
export function requestCarModel(id, now = false) {
  if (!BUILDERS[id]) return true;                     // (instanceCarModel throws: a placeholder is used)
  unwanted.delete(id);
  if (templates.has(id)) return true;
  // (a worker that hasn't answered in 15 s is given up on)
  if (now && pending.has(id) && performance.now() - pending.get(id) > 15000) { console.warn('car worker too slow', id); workerOk = false; }
  if (startWorker()) {
    if (!pending.has(id)) { pending.set(id, performance.now()); worker.postMessage({ id }); }
    return false;
  }
  if (!now) return false;
  try { template(id); } catch { /* instanceCarModel throws again: a placeholder is used */ }
  return true;
}

// A phone lets go of a kind of car no other player near it drives any more (multiplayer.js, LEAN_KINDS), once
// every copy of it is gone: free(group) frees its geometry, materials and pictures (freeModel in main.js).
export function dropCarModel(id, free) {
  if (pending.has(id)) unwanted.add(id);
  const T = templates.get(id);
  if (!T) return;
  templates.delete(id);
  free(T.group);
}

export function instanceCarModel(id) {
  const T = template(id);
  const car = {
    group: new THREE.Group(),
    wheelRadius: T.wheelRadius, wheelbase: T.wheelbase, track: T.track, size: T.size,
    lights: { brake: false, reverse: false, headlights: false },
  };
  car.group.name = T.group.name;
  car.setLights = (o = {}) => { if (car.lit) applyLights(car, o); else Object.assign(car.lights, o); };
  if (T.sootFor) car.setSoot = (k) => { if (car.soot) T.sootFor(car, k); };
  fill(car, T);
  // a scanned body still loading: copy the car again once it is on the template
  if (T.ready && !T.glbLoaded) T.ready.then(() => { if (T.glbLoaded) fill(car, T); });
  // false while the template is being made ready (shaders compiled, pictures and model on the graphics card), or
  // this copy is not yet of the template as it now is (its scanned body just came): multiplayer.js waits with
  // showing the car
  Object.defineProperty(car, 'warmed', { get: () => T.warmed !== false && car.glbLoaded === !!T.glbLoaded });
  return car;
}

function fill(car, T) {
  const g = car.group;
  for (const c of [...g.children]) g.remove(c);
  const objs = new Map(), mats = new Map();
  const own = (m) => {
    if (!mats.has(m)) {
      const c = m.clone();
      // (onBeforeCompile is not copied by clone(); those used here read their uniforms from this.userData)
      if (Object.hasOwn(m, 'onBeforeCompile')) c.onBeforeCompile = m.onBeforeCompile;
      if (Object.hasOwn(m, 'customProgramCacheKey')) c.customProgramCacheKey = m.customProgramCacheKey;
      mats.set(m, c);
    }
    return mats.get(m);
  };
  for (const src of T.group.children) {
    const dst = src.clone(true);
    const a = [], b = [];
    src.traverse((o) => a.push(o)); dst.traverse((o) => b.push(o));
    a.forEach((o, i) => objs.set(o, b[i]));
    g.add(dst);
  }
  // lamp and soot materials are the copy's own; every other material stays shared with the template
  const swap = (m) => { const c = own(m); for (const [o, d] of objs) if (o.material === m) d.material = c; return c; };
  car.lit = T.lit ? Object.fromEntries(Object.entries(T.lit).map(([k, m]) => [k, m && swap(m)])) : null;
  car.glbGlow = T.glbGlow;
  car.glbLoaded = !!T.glbLoaded;
  car.triangles = T.triangles;
  car.wheels = T.wheels && Object.fromEntries(Object.entries(T.wheels).map(([k, w]) => [k, { steer: objs.get(w.steer), spin: objs.get(w.spin) }]));
  if (T.soot) {
    const s = T.soot, mesh = objs.get(s.mesh), shell = s.shell && objs.get(s.shell);
    if (mesh) mesh.material = swap(s.mesh.material);
    if (shell) shell.material = swap(s.shell.material);
    car.soot = { k: car.soot?.k ?? 0, mesh, shell };
    car.setSoot(car.soot.k);
  }
  applyLights(car, {});
}
