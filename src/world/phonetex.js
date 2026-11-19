// Phones: smaller copies of the biggest pictures before they go to the graphics card.
//
// An iPhone kills the page when it runs out of memory, and most of the game's graphics memory is a
// few large pictures: the far ground photo (3024 x 4292, about 70 MB once on the card) and the painted
// house fronts and street surfaces of the hand-built streets (2048 x 2048, 1024 x 4000 ...). On a phone
// screen a quarter of the pixels looks the same. shrink(root) swaps every picture over MAX_PX for a
// copy of at most MAX_PX; it can be called again and again (new things get added as the city loads).
// A picture whose code paints it again later (its texture's version goes up) gets a fresh copy, and
// one that keeps changing gets its own full-size picture back.
const MAX_PX = 1024 * 1024;

export function createTextureShrinker(maxPx = MAX_PX) {
  const done = new WeakMap();          // texture -> { orig, ver, redraws }
  const seen = new WeakSet();          // materials already looked through, with nothing to do
  let saved = 0;

  function copy(img, w, h) {
    const k = Math.sqrt(maxPx / (w * h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  // returns whether to keep an eye on this texture (not loaded yet, or a copy that may need redoing)
  function texture(t) {
    const d = done.get(t);
    if (d) {
      if (d.ver === Infinity) return false;
      if (t.version === d.ver) return true;
      // painted again by its own code: copy the new picture, or give up on one that keeps changing
      if (++d.redraws > 3) { t.image = d.orig; t.needsUpdate = true; d.ver = Infinity; return false; }
      t.image = copy(d.orig, d.orig.width, d.orig.height); t.needsUpdate = true; d.ver = t.version;
      return true;
    }
    const img = t.image;
    if (!img || t.isDataTexture || t.isCompressedTexture || t.isVideoTexture || t.isRenderTargetTexture || t.isCubeTexture) return false;
    const isCanvas = typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement;
    const isImg = typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement;
    const isBitmap = typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap;
    if (!isCanvas && !isImg && !isBitmap) return false;
    if (isImg && !(img.complete && img.naturalWidth)) return true;   // not loaded yet: look again later
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!w || !h || w * h <= maxPx) return false;
    t.image = copy(img, w, h);
    t.needsUpdate = true;
    saved += (w * h - t.image.width * t.image.height) * 4 * 1.33;
    // (a photo is never painted again, so it is let go; a canvas is watched for its code painting it)
    if (!isCanvas) { done.set(t, { ver: Infinity }); return false; }
    done.set(t, { orig: img, ver: t.version, redraws: 0 });
    return true;
  }

  function material(m) {
    if (seen.has(m)) return;
    let again = false;
    for (const v of Object.values(m)) if (v?.isTexture) again = texture(v) || again;
    if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) again = texture(u.value) || again;
    if (!again) seen.add(m);
  }

  return {
    shrink(root) {
      root.traverse((o) => {
        if (!o.material) return;
        if (Array.isArray(o.material)) o.material.forEach(material); else material(o.material);
      });
    },
    get savedMB() { return saved / 1e6; },
  };
}
