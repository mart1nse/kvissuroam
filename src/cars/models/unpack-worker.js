// Unpacks a car picture that was kept as a file (unpackPicture in index.js) back into pixels, away from the
// page and apart from the worker that builds cars, which can be busy for a second or two on a phone.
self.onmessage = async (e) => {
  const { key, blob } = e.data;
  try {
    const bm = await createImageBitmap(blob);
    const c = new OffscreenCanvas(bm.width, bm.height), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(bm, 0, 0);
    bm.close();
    const d = g.getImageData(0, 0, c.width, c.height).data;
    self.postMessage({ key, data: new Uint8Array(d.buffer) }, [d.buffer]);
  } catch (err) {
    self.postMessage({ key, error: String(err?.stack || err) });
  }
};
