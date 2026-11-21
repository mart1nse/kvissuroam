// Packs a painted picture (src/world/phonetex.js) so that a phone can keep it without holding its pixels:
// the picture comes as an ImageBitmap and goes back as a compressed file in memory. Off the page's own
// thread, so a drive does not feel it.
//
// WebP where the browser can write it (Chrome, Android: about a twentieth of the pixels' size, see-through
// parts kept). Safari cannot and hands back a PNG, several times bigger: there a picture with no
// see-through pixel goes as a JPEG instead, and only the ones that need it stay PNG. `plain` asks for
// that path anywhere (?pack=plain, to try it without an iPhone).
self.onmessage = async (e) => {
  const { id, bitmap, plain } = e.data;
  let blob = null;
  try {
    const w = bitmap.width, h = bitmap.height;
    const c = new OffscreenCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(bitmap, 0, 0);
    if (!plain) blob = await c.convertToBlob({ type: 'image/webp', quality: 0.92 });
    if (!blob || blob.type !== 'image/webp') {
      const d = g.getImageData(0, 0, w, h).data;
      let solid = true;
      for (let i = 3; i < d.length; i += 4) if (d[i] !== 255) { solid = false; break; }
      blob = await c.convertToBlob(solid ? { type: 'image/jpeg', quality: 0.88 } : { type: 'image/png' });
    }
  } catch { blob = null; /* no OffscreenCanvas here: the picture simply stays on the card as before */ }
  try { bitmap.close(); } catch {}
  self.postMessage({ id, blob });
};
