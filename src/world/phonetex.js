// Phones: the game's pictures kept small, and only once.
//
// An iPhone kills the page when it runs out of memory, and most of the game's memory is pictures: the
// far ground photo (3024 x 4292, about 70 MB once on the graphics card) and the painted house fronts and
// street surfaces of the hand-built streets (2048 x 2048, 1024 x 4000 ...). Every painted picture is
// also held twice: the canvas it was painted on, and the copy on the graphics card.
//
// scan(root), called again and again (new things are added as the city loads), does two things:
//  - a picture over MAX_PX goes to the card as a copy of at most MAX_PX (on a phone screen it looks
//    the same). A canvas whose code paints it again before it is let go gets a fresh copy;
//  - once a painted picture has been on the card unchanged for a few seconds its canvas is let go:
//    made a quarter the size each way, a sixteenth of the memory. From then on the texture ignores
//    needsUpdate: the card's copy is the full one. (The small picture stays so that a texture made
//    from the same canvas later, a clone with another wrap mode say, still gets a picture, if a soft
//    one.) A picture that is still being painted now and then (its version keeps going up) is left alone.
//
// A texture marked userData.keepImage (the scanned car bodies, freed from the card at a car change and
// sent again later) is only made smaller, never let go: its stand-in would be all the card got back.
//
// Pictures of places left behind (21 Nov 2026). What a hand-built place paints stays on the card for good,
// so a phone held 553 MB at DRIVE, about 1050 MB after 2 km through the centre, and still 830 MB after
// leaving it: the longer the drive, the nearer the crash. So when a canvas is let go, a packed copy of the
// full picture is kept (a WebP file in memory, a twentieth of the size, made in phonetex-worker.js; JPEG
// or PNG on Safari), and:
//  - once everything that wears the picture is over REST_AT metres from the car, the card's copy is freed
//    and the small stand-in goes up in its place (at that distance it looks the same);
//  - when the car comes back within WAKE_AT, the packed copy is unpacked (off the page's thread) and sent
//    to the card again, one picture at a time (`wake`, called every frame).
// The distances come from the same walk over the scene that finds the pictures, every three seconds.
// A picture nothing in the scene wears is left as it is: it may be about to be shown close up.
//
// Weak desktops get the same (main.js: lite). Where it is switched on in the middle of a drive the
// pictures are already on the card, so perScan makes only a few small copies each scan, not all at once.
const MAX_PX = 1024 * 1024;
const SETTLE = 3000;            // ms a picture must have been on the card, unchanged, before its canvas goes
const REST_AT = 650, WAKE_AT = 420;   // m from the car to the nearest thing wearing the picture
const REST_MIN_PX = 256 * 256;        // smaller pictures are not worth it
const WAKE_GAP = 120;                 // ms between two pictures sent to the card again
const PACK_MAX = 60e6;                // bytes of packed copies kept at most (PNGs on Safari are big): past it, pictures stay as before

export function createPhoneTextures(renderer, { maxPx = MAX_PX, release = true, perScan = Infinity, rest = true } = {}) {
  const state = new WeakMap();         // texture -> { orig, ver, redraws, upAt, done }
  const users = new WeakMap();         // canvas -> Set of textures drawn from it
  const gone = new WeakSet();          // canvases let go (now a small stand-in)
  const seenMat = new WeakSet();
  const watch = new Set();             // textures not finished with yet
  let saved = 0, freed = 0, nFreed = 0, dynamic = 0, copies = 0, drops = 0, maxDrops = Infinity, lastFar = 0;
  const freeze = (t) => Object.defineProperty(t, 'needsUpdate', { set() {}, configurable: true });

  const isCanvas = (i) => typeof HTMLCanvasElement !== 'undefined' && i instanceof HTMLCanvasElement;
  const isImg = (i) => typeof HTMLImageElement !== 'undefined' && i instanceof HTMLImageElement;
  const isBitmap = (i) => typeof ImageBitmap !== 'undefined' && i instanceof ImageBitmap;

  function copy(img, w, h) {
    const k = Math.sqrt(maxPx / (w * h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  const use = (c, t) => { let s = users.get(c); if (!s) users.set(c, (s = new Set())); s.add(t); };
  // A texture's new picture of another size. A picture already on the graphics card has to be freed there
  // first: the card keeps the size it was first sent at, and three.js only writes the new picture over its
  // top left corner, so the rest stays the old picture and the mipmaps are made from the mix. Where light
  // mode came on in the middle of a drive ('slow in this drive'), every big picture already shown went that
  // way: the scanned car bodies turned into a patchwork of other parts of the scan (Martin's Impreza 22B
  // and Audi 200, 21 and 22 Nov 2026). Every texture made from the same picture (clones share it) is freed
  // too; the next frame that shows one sends the new picture whole, which also frees the big one on the card.
  const bySource = new WeakMap();      // texture source -> the textures seen wearing it
  const seen = (t) => { let s = bySource.get(t.source); if (!s) bySource.set(t.source, (s = new Set())); s.add(t); };
  const size = (i) => [i?.naturalWidth || i?.width || 0, i?.naturalHeight || i?.height || 0];
  function swap(t, img) {
    const [w0, h0] = size(t.image), [w1, h1] = size(img);
    if (w0 !== w1 || h0 !== h1) {
      mine = true;
      for (const o of bySource.get(t.source) || [t]) if (renderer.properties.has(o)) o.dispose();
      mine = false;
    }
    t.image = img;
    t.needsUpdate = true;
  }
  const onCard = (t) => t.version > 0 && renderer.properties.has(t) && renderer.properties.get(t).__version === t.version;
  function shrink(c) {
    const g = c.getContext('2d');
    if (!g) return false;                            // (not a painted canvas: leave it)
    const w = Math.max(16, Math.round(c.width / 4)), h = Math.max(16, Math.round(c.height / 4));
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    tmp.getContext('2d').drawImage(c, 0, 0, w, h);
    c.width = w; c.height = h;                       // (this lets the big picture go at once)
    g.drawImage(tmp, 0, 0);
    tmp.width = tmp.height = 0;
    return true;
  }
  function drop(c) {
    if (gone.has(c)) return;
    gone.add(c);
    if (c.width * c.height <= 64 * 64) return;
    const px = c.width * c.height;
    if (shrink(c)) { freed += (px - c.width * c.height) * 4; nFreed++; }
  }

  // ---- pictures of places left behind
  const recs = new Set();              // { c, w, h, blob, state: 'full' | 'small' | 'loading', near, users, bm }
  const recOf = new WeakMap();         // canvas -> its record
  const texOf = new WeakMap();         // material -> its textures (for the distance walk)
  const ready = [];                    // unpacked, waiting for their turn to go to the card
  let want = [];                       // resting pictures the car has come near again, nearest first
  const packing = new Map();
  let worker = null, packId = 0, lastWake = 0, loading = 0, hurryUntil = 0, restedPx = 0, nRested = 0, nWoken = 0, packedBytes = 0, mine = false;
  let canRest = rest && release && typeof createImageBitmap === 'function' && typeof Worker !== 'undefined';
  const plain = typeof location !== 'undefined' && /[?&]pack=plain/.test(location.search);
  function packer() {
    if (worker) return worker;
    worker = new Worker(new URL('./phonetex-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const rec = packing.get(e.data.id);
      packing.delete(e.data.id);
      if (!e.data.blob) canRest = false;             // (this browser cannot pack in a worker: no more tries)
      if (!rec || !e.data.blob || rec.dead) return;
      rec.blob = e.data.blob; packedBytes += rec.blob.size;
      recs.add(rec);
    };
    worker.onerror = () => { packing.clear(); canRest = false; };
    return worker;
  }
  // a texture thrown away by its owner (an old car model, a place taken down): its record goes with the last one
  function onGone(e) {
    if (mine) return;
    const t = e.target, rec = recOf.get(t.image);
    if (!rec) return;
    rec.users.delete(t);
    if (!rec.users.size) { rec.dead = true; recs.delete(rec); if (rec.blob) packedBytes -= rec.blob.size; rec.blob = null; rec.bm?.close?.(); }
  }
  // the canvas is let go, and a packed copy of the full picture is kept if it is worth it
  function letGo(c) {
    if (gone.has(c)) return;
    if (!canRest || packedBytes > PACK_MAX || c.width * c.height < REST_MIN_PX || !c.getContext('2d')) { drop(c); return; }
    const rec = { c, w: c.width, h: c.height, blob: null, state: 'full', near: Infinity, users: new Set(users.get(c) || []), bm: null, dead: false, failed: false };
    recOf.set(c, rec);
    for (const t of rec.users) t.addEventListener('dispose', onGone);
    let p;
    try { p = createImageBitmap(c); } catch { drop(c); return; }
    gone.add(c);                                     // (nothing else lets it go meanwhile)
    const small = () => { gone.delete(c); drop(c); };
    p.then((bm) => {
      small();
      try { const id = ++packId; packing.set(id, rec); packer().postMessage({ id, bitmap: bm, plain }, [bm]); } catch { canRest = false; bm.close?.(); }
    }, small);
  }
  function freeCard(rec) { mine = true; for (const t of rec.users) t.dispose(); mine = false; }
  function toRest(rec) {
    rec.state = 'small';
    freeCard(rec);                                   // (the next frame that shows it sends the small stand-in)
    restedPx += rec.w * rec.h - rec.c.width * rec.c.height; nRested++;
  }
  function toWake(rec) {
    rec.state = 'loading'; loading++;
    createImageBitmap(rec.blob).then((bm) => {
      loading--;
      if (rec.dead || rec.state !== 'loading') { bm.close?.(); pump(); return; }
      rec.bm = bm; ready.push(rec);
    }, () => { loading--; rec.state = 'small'; rec.failed = true; pump(); });
  }
  // the full picture back on the card: one a call, and not two close together (each is a picture's worth of sending)
  function wake(now = performance.now()) {
    const hurry = now < hurryUntil;
    if (!ready.length || (!hurry && now - lastWake < WAKE_GAP)) return;
    lastWake = now;
    wakeOne();
    if (hurry && ready.length) wakeOne();            // (after a jump: two a frame, the place is right in front of the player)
  }
  function wakeOne() {
    let k = 0;
    for (let i = 1; i < ready.length; i++) if (ready[i].near < ready[k].near) k = i;
    const rec = ready.splice(k, 1)[0], c = rec.c;
    if (rec.dead) { rec.bm?.close?.(); rec.bm = null; pump(); return; }
    c.width = rec.w; c.height = rec.h;
    c.getContext('2d').drawImage(rec.bm, 0, 0, rec.w, rec.h);
    rec.bm.close?.(); rec.bm = null;
    freeCard(rec);
    for (const t of rec.users) renderer.initTexture(t);
    shrink(c);
    restedPx -= rec.w * rec.h - c.width * c.height; nWoken++;
    rec.state = 'full';
    pump();
  }
  // how near the car is to each picture, and who rests or wakes
  let cx = 0, cz = 0;
  function measure(o) {
    const ms = o.material;
    if (!ms) return;
    let d = -1;
    for (const m of Array.isArray(ms) ? ms : [ms]) {
      const ts = texOf.get(m);
      if (!ts) continue;
      for (const t of ts) {
        const rec = recOf.get(t.image);
        if (!rec) continue;
        if (d < 0) {
          // (no bounds yet, or a thing that is never culled: counted as right here)
          const many = o.isInstancedMesh || o.isBatchedMesh || o.isSkinnedMesh;
          const sp = many ? o.boundingSphere : o.geometry?.boundingSphere;
          if (!sp || o.frustumCulled === false) d = 0;
          else {
            const e = o.matrixWorld.elements, p = sp.center;
            const x = e[0] * p.x + e[4] * p.y + e[8] * p.z + e[12], z = e[2] * p.x + e[6] * p.y + e[10] * p.z + e[14];
            const sc = Math.max(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10]));
            d = Math.max(0, Math.hypot(x - cx, z - cz) - sp.radius * sc);
          }
        }
        if (d < rec.near) rec.near = d;
      }
    }
  }
  function sort() {
    let n = 0;
    const back = [];
    for (const rec of recs) {
      if (rec.state === 'full' && rec.near > REST_AT && rec.near < Infinity && n < 8) { toRest(rec); n++; }
      else if (rec.state === 'small' && rec.near < WAKE_AT && !rec.failed) back.push(rec);
    }
    // (the nearest first, and only a few being unpacked at a time: each is a full picture in memory until it is sent)
    want = back.sort((a, b) => a.near - b.near);
    pump();
  }
  function pump() {
    while (want.length && loading + ready.length < (performance.now() < hurryUntil ? 10 : 4)) { const rec = want.shift(); if (rec.state === 'small' && !rec.dead) toWake(rec); }
  }

  // false: nothing (more) to do for this texture
  function step(t, now) {
    let st = state.get(t);
    if (!st) {
      const img = t.image;
      if (!img || t.isDataTexture || t.isCompressedTexture || t.isVideoTexture || t.isRenderTargetTexture || t.isCubeTexture) return false;
      if (!isCanvas(img) && !isImg(img) && !isBitmap(img)) return false;
      if (isImg(img) && !(img.complete && img.naturalWidth)) return true;   // not loaded yet: look again later
      if (isCanvas(img) && gone.has(img)) return false;   // (a later texture from a canvas already let go)
      const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (!w || !h) return false;
      if (w * h > maxPx && copies >= perScan) return true;   // enough for this scan: next time
      st = { orig: null, ver: t.version, redraws: 0, upAt: 0 };
      if (w * h > maxPx) {
        copies++;
        swap(t, copy(img, w, h));
        st.ver = t.version;
        saved += (w * h - t.image.width * t.image.height) * 4 * 1.33;
        if (isCanvas(img)) st.orig = img;            // (watched for its code painting it again)
        else if (isBitmap(img)) img.close?.();       // (a decoded photo from a model file: not needed again)
      }
      if (!isCanvas(t.image)) return false;          // a photo the browser holds: nothing to let go
      state.set(t, st);
      use(t.image, t); if (st.orig) use(st.orig, t);
    }
    if (t.version !== st.ver) {
      // painted again by its own code
      st.redraws++; st.upAt = 0;
      if (st.orig) {
        if (st.redraws > 3) { swap(t, st.orig); st.orig = null; dynamic++; return false; }   // keeps changing: its own full picture back
        swap(t, copy(st.orig, st.orig.width, st.orig.height)); use(t.image, t);
      } else if (st.redraws > 3) { dynamic++; return false; }
      st.ver = t.version;
      return true;
    }
    // (a picture that is freed from the card and sent again later, a scanned car body: its image is kept)
    if (t.userData.keepImage) return false;
    if (!release) return !!st.orig;
    if (!onCard(t)) { st.upAt = 0; return true; }
    if (!st.upAt) { st.upAt = now; return true; }
    if (now - st.upAt < SETTLE) return true;
    // on the card and settled: let the canvases go, unless another texture still needs one of them
    for (const c of [t.image, st.orig]) {
      if (!c) continue;
      for (const o of users.get(c) || []) if (o !== t && !onCard(o)) return true;
    }
    // (a few a scan while somebody drives: letting a big canvas go is 3 to 20 ms on a slow processor, and a
    // street's worth in one scan was a 0.1 s stop there)
    if (drops >= maxDrops) return true;
    drops += st.orig ? 2 : 1;
    for (const c of [t.image, st.orig]) if (c) for (const o of users.get(c) || []) freeze(o);
    letGo(t.image); if (st.orig) drop(st.orig);
    st.orig = null;
    return false;
  }

  function material(m) {
    if (seenMat.has(m)) return;
    seenMat.add(m);
    const ts = [];
    for (const v of Object.values(m)) if (v?.isTexture) { watch.add(v); ts.push(v); seen(v); }
    if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) { watch.add(u.value); ts.push(u.value); seen(u.value); }
    if (ts.length) texOf.set(m, ts); else texOf.delete(m);
  }

  return {
    // most: how many pictures' canvases may be let go in this scan. x, z: where the car is (every third
    // scan that has them also works out which pictures are far enough to rest and which must come back)
    scan(root, most = Infinity, x, z) {
      drops = 0; maxDrops = most;
      // (every three seconds, or at once when the car is suddenly somewhere else)
      const t = performance.now();
      const far = recs.size > 0 && x !== undefined && (t - lastFar > 3000 || Math.hypot(x - cx, z - cz) > 150);
      if (far) { lastFar = t; cx = x; cz = z; for (const rec of recs) rec.near = Infinity; }
      root.traverse((o) => {
        if (!o.material) return;
        if (Array.isArray(o.material)) o.material.forEach(material); else material(o.material);
        if (far) measure(o);
      });
      if (far) sort();
      const now = performance.now();
      copies = 0;
      for (const t of watch) if (!step(t, now)) watch.delete(t);
    },
    // one picture, now: it is about to be sent to the graphics card ahead of its first frame (warm.js, jobs.js)
    texture(t) { if (!t || !t.isTexture) return; watch.add(t); seen(t); copies = 0; if (!step(t, performance.now())) watch.delete(t); },
    // look at this material again (a texture was put on it after it was first seen)
    again(root) { root.traverse((o) => { for (const m of [o.material].flat()) if (m) seenMat.delete(m); }); },
    wake,
    get pending() { return want.length + loading + ready.length; },
    // (for tests) every packed picture: [state, metres to the nearest thing wearing it, pixels]
    list() { return [...recs].map((r) => [r.state, Math.round(r.near), r.w * r.h, r.users.size]); },
    // the car was put somewhere else (a respawn at the start, R, a jump on the map): the pictures round the
    // new spot are asked for at once, not at the next scan, and come back faster for a few seconds
    jump(root, x, z) {
      if (!recs.size || Math.hypot(x - cx, z - cz) < 60) return;   // (a few metres: the last look still holds)
      hurryUntil = lastFar = performance.now();
      hurryUntil += 4000;
      cx = x; cz = z;
      for (const rec of recs) rec.near = Infinity;
      root.traverse(measure);
      sort();
    },
    get stats() { return { shrunkMB: saved / 1e6, freedMB: freed / 1e6, freed: nFreed, watching: watch.size, dynamic, packed: recs.size, packedMB: packedBytes / 1e6, restingMB: restedPx * 4 * 1.33 / 1e6, rested: nRested, woken: nWoken, waking: ready.length }; },
  };
}
