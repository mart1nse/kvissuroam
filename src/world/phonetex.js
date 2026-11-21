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
// Weak desktops get the same (main.js: lite). Where it is switched on in the middle of a drive the
// pictures are already on the card, so perScan makes only a few small copies each scan, not all at once.
const MAX_PX = 1024 * 1024;
const SETTLE = 3000;            // ms a picture must have been on the card, unchanged, before its canvas goes

export function createPhoneTextures(renderer, { maxPx = MAX_PX, release = true, perScan = Infinity } = {}) {
  const state = new WeakMap();         // texture -> { orig, ver, redraws, upAt, done }
  const users = new WeakMap();         // canvas -> Set of textures drawn from it
  const gone = new WeakSet();          // canvases let go (now a small stand-in)
  const seenMat = new WeakSet();
  const watch = new Set();             // textures not finished with yet
  let saved = 0, freed = 0, nFreed = 0, dynamic = 0, copies = 0, drops = 0, maxDrops = Infinity;
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
  const onCard = (t) => t.version > 0 && renderer.properties.has(t) && renderer.properties.get(t).__version === t.version;
  function drop(c) {
    if (gone.has(c)) return;
    gone.add(c);
    if (c.width * c.height <= 64 * 64) return;
    const g = c.getContext('2d');
    if (!g) return;                                  // (not a painted canvas: leave it)
    const w = Math.max(16, Math.round(c.width / 4)), h = Math.max(16, Math.round(c.height / 4));
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    tmp.getContext('2d').drawImage(c, 0, 0, w, h);
    freed += (c.width * c.height - w * h) * 4; nFreed++;
    c.width = w; c.height = h;                       // (this lets the big picture go at once)
    g.drawImage(tmp, 0, 0);
    tmp.width = tmp.height = 0;
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
        t.image = copy(img, w, h);
        t.needsUpdate = true;
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
        if (st.redraws > 3) { t.image = st.orig; st.orig = null; t.needsUpdate = true; dynamic++; return false; }   // keeps changing: its own full picture back
        t.image = copy(st.orig, st.orig.width, st.orig.height); t.needsUpdate = true; use(t.image, t);
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
    drop(t.image); if (st.orig) drop(st.orig);
    st.orig = null;
    return false;
  }

  function material(m) {
    if (seenMat.has(m)) return;
    seenMat.add(m);
    for (const v of Object.values(m)) if (v?.isTexture) watch.add(v);
    if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) watch.add(u.value);
  }

  return {
    // most: how many pictures' canvases may be let go in this scan
    scan(root, most = Infinity) {
      drops = 0; maxDrops = most;
      root.traverse((o) => {
        if (!o.material) return;
        if (Array.isArray(o.material)) o.material.forEach(material); else material(o.material);
      });
      const now = performance.now();
      copies = 0;
      for (const t of watch) if (!step(t, now)) watch.delete(t);
    },
    // one picture, now: it is about to be sent to the graphics card ahead of its first frame (warm.js, jobs.js)
    texture(t) { if (!t || !t.isTexture) return; watch.add(t); copies = 0; if (!step(t, performance.now())) watch.delete(t); },
    // look at this material again (a texture was put on it after it was first seen)
    again(root) { root.traverse((o) => { for (const m of [o.material].flat()) if (m) seenMat.delete(m); }); },
    get stats() { return { shrunkMB: saved / 1e6, freedMB: freed / 1e6, freed: nFreed, watching: watch.size, dynamic }; },
  };
}
