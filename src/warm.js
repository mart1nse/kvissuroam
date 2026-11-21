// New things on their way into the picture while somebody is driving.
//
// A place that builds itself as the car comes near (a street, a map square's houses and trees, a car park)
// used to show up whole in the next frame: every new kind of surface had its shader compiled then and there,
// every picture and every model went to the graphics card in that one frame. Nothing of that is game code,
// so the game's own time stayed low, and the frame still took 0.2 to 1 s on a phone (Martin, 20 Nov: "the
// game freezing at one frame, moving on smoothly and then freezing again").
//
// Here such things are held back for a moment, unseen: their shaders are compiled in the background (where
// the browser can: KHR_parallel_shader_compile), their pictures sent a few a frame, and then they are let
// into the picture a few megabytes of model a frame. From 400 m away that half second is not seen.
//
// Only what is added to the scene inside a `warm.scope` is held: the places' own update, the work queue
// (jobs.js). Smoke, skid marks, broken glass and whatever else must be there at once are not touched.
import * as THREE from 'three';
import { jobs } from './jobs.js';

let renderer = null, scene = null, camera = null, depth = 0, off = false, send = null;
const held = new Map();        // object -> the layers it is drawn in (0 while held)
const fresh = [];              // held objects in the order they came
let stage = null;              // the batch being made ready: { list, mats, tex, k, t0, shown }
const now = () => performance.now();
const DRAWN = (o) => o.isMesh || o.isPoints || o.isLine || o.isSprite;
const attached = (o) => { for (let p = o; p; p = p.parent) if (p === scene) return true; return false; };
const seen = (o) => { for (let p = o; p && p !== scene; p = p.parent) if (!p.visible) return false; return true; };

function hold(root) {
  root.traverse((o) => {
    if (!DRAWN(o) || held.has(o) || o.layers.mask === 0) return;
    held.set(o, o.layers.mask);
    o.layers.mask = 0;
    fresh.push(o);
  });
}
function show(o) {
  const mask = held.get(o);
  if (mask === undefined) return;
  held.delete(o);
  o.layers.mask |= mask;
}
// megabytes of model an object sends to the graphics card when first drawn (0 when its geometry is there already)
const sent = new WeakSet();
function weight(o) {
  const g = o.geometry;
  if (!g || sent.has(g)) return 0;
  sent.add(g);
  let n = g.index ? g.index.array.byteLength : 0;
  for (const k in g.attributes) n += g.attributes[k].array?.byteLength || 0;
  return n / 1048576;
}
function texturesOf(list) {
  const out = new Set();
  for (const o of list) {
    if (!seen(o)) continue;           // (a hidden far or near version: its pictures go when it is first shown)
    for (const m of [o.material].flat()) {
      if (!m) continue;
      for (const k in m) {
        const t = m[k];
        if (!t || !t.isTexture || t.isRenderTargetTexture || t.isVideoTexture) continue;
        const im = t.image;
        if (!im || im.complete === false || !(im.width > 0)) continue;
        const p = renderer.properties.get(t);
        if (p.__webglTexture !== undefined && p.__version === t.version) continue;
        out.add(t);
      }
    }
  }
  return [...out];
}

export const warm = {
  // send(texture): puts a picture on the graphics card
  init(r, s, c, { on = true, send: f = null } = {}) {
    renderer = r; scene = s; camera = c; off = !on; send = f || ((t) => renderer.initTexture(t));
    if (off) return;
    const add = THREE.Object3D.prototype.add;
    THREE.Object3D.prototype.add = function (...objs) {
      add.apply(this, objs);
      if (depth > 0 && jobs.live && attached(this)) for (const o of objs) if (o && o.isObject3D) hold(o);
      return this;
    };
  },
  // what `fn` adds to the scene is held back until it is ready to be drawn
  scope(fn) { depth++; try { return fn(); } finally { depth--; } },
  get waiting() { return held.size; },
  get state() { return { held: held.size, fresh: fresh.length, stage: stage && { n: stage.list.length, mats: stage.mats.length, tex: stage.tex ? stage.tex.length : -1, k: stage.k, shown: stage.shown, ms: Math.round(now() - stage.t0) } }; },
  // is this object still held back?
  holding(o) { return held.has(o); },
  // everything into the picture at once (nobody is watching the road: the menu, a jump across the map)
  flush() {
    if (!held.size) return;
    for (const o of [...held.keys()]) show(o);
    fresh.length = 0; stage = null;
  },
  // each frame while driving
  tick() {
    if (off) return;
    if (!jobs.live) { this.flush(); return; }
    if (!stage) {
      if (!fresh.length) return;
      const list = fresh.splice(0, 40).filter((o) => { if (attached(o)) return true; show(o); return false; });
      if (!list.length) return;
      let mats = [];
      try { mats = [...renderer.compile({ traverseVisible() {}, traverse: (f) => { for (const o of list) f(o); } }, camera, scene)]; } catch (err) { console.warn(err); }
      stage = { list, mats, tex: null, k: 0, t0: now(), shown: 0 };
      return;
    }
    const S = stage;
    if (S.mats.length) {                                   // shaders still compiling: wait (4 s at most)
      S.mats = S.mats.filter((m) => { const p = renderer.properties.get(m).currentProgram; return p && p.isReady && !p.isReady(); });
      if (S.mats.length && now() - S.t0 < 4000) return;
      S.mats = [];
    }
    if (!S.tex) S.tex = texturesOf(S.list);
    if (S.k < S.tex.length) {                              // pictures: about 1.5 megapixels a frame
      for (let px = 0; S.k < S.tex.length && px < 1.5e6; S.k++) {
        const t = S.tex[S.k];
        px += (t.image.width || 0) * (t.image.height || 0);
        try { send(t); } catch (err) { console.warn(err); }
      }
      return;
    }
    for (let mb = 0; S.shown < S.list.length && mb < 3; S.shown++) {      // into the picture: about 3 MB of model a frame
      const o = S.list[S.shown];
      mb += weight(o);
      show(o);
    }
    if (S.shown >= S.list.length) stage = null;
  },
};
