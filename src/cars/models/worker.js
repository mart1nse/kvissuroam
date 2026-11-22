// Builds car models away from the page, so that building one (a few hundred milliseconds of cutting
// and projecting) never stops the picture. The page asks for a car id and gets the finished car back as
// data (serial.js); index.js turns it into the template for other players' cars.
// (Canvas textures are drawn on OffscreenCanvas; the scanned GLB bodies are put on in the page.)
// It also makes the parked cars' models, near and far versions and all (src/world/parkedbake.js).
// (read back once, into the car's data: a canvas kept in memory, not on the graphics card, reads back fast)
self.document = {
  createElement: () => {
    const c = new OffscreenCanvas(1, 1), get = c.getContext.bind(c);
    c.getContext = (type, opts) => get(type, type === '2d' ? { willReadFrequently: true, ...opts } : opts);
    return c;
  },
};

const ready = import('./index.js').then(async (m) => ({ build: m.buildCarModel, ...(await import('./serial.js')) }));
// (the parked cars' share: loaded only when one is asked for)
let bake = null;

self.onmessage = async (e) => {
  const { id, key, opts, parked, thin } = e.data;
  try {
    if (thin) {
      // a triangle list to thin for the page: a scanned body's far version (bakeLodSteps in src/world/parkedbake.js)
      bake ||= import('../../world/parkedbake.js');
      const B = await bake;
      await B.simplifierReady();
      const idx = B.thin(thin.index, thin.vp, thin.target);
      self.postMessage({ id, key, data: idx }, idx.buffer === thin.index.buffer ? [] : [idx.buffer]);
      return;
    }
    const { build, serializeCar } = await ready;
    if (parked) {
      // a parked car: its near and far versions, finished (src/world/parkedbake.js)
      bake ||= import('../../world/parkedbake.js');
      const B = await bake;
      await B.simplifierReady();
      const { data, transfer, packs } = B.packParked(id, build(id, opts), parked);
      // The bigger pictures go as PNG files (a few dozen kB where the pixels are 2 MB): the page unpacks one
      // when a car of the model is first seen close up (keepPacked in src/world/parked.js). The copy is
      // taken here and now, before anything else can paint on the canvas.
      await Promise.all(packs.map(([i, c]) => c.convertToBlob().then((blob) => { data.near.texs[i].blob = blob; }, () => {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        data.near.texs[i].data = new Uint8Array(d.buffer); transfer.push(d.buffer);
      })));
      self.postMessage({ id, key, data }, transfer);
      return;
    }
    const car = build(id, opts);
    const { data, transfer } = serializeCar(car);
    self.postMessage({ id, key, data }, transfer);
  } catch (err) {
    self.postMessage({ id, key, error: String(err?.stack || err) });
  }
};
