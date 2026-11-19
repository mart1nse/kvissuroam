// Builds car models away from the page, so that building one (a few hundred milliseconds of cutting
// and projecting) never stops the picture. The page asks for a car id and gets the finished car back as
// data (serial.js); index.js turns it into the template for other players' cars.
// (Canvas textures are drawn on OffscreenCanvas; the scanned GLB bodies are put on in the page.)
// (read back once, into the car's data: a canvas kept in memory, not on the graphics card, reads back fast)
self.document = {
  createElement: () => {
    const c = new OffscreenCanvas(1, 1), get = c.getContext.bind(c);
    c.getContext = (type, opts) => get(type, type === '2d' ? { willReadFrequently: true, ...opts } : opts);
    return c;
  },
};

const ready = import('./index.js').then(async (m) => ({ build: m.buildCarModel, ...(await import('./serial.js')) }));

self.onmessage = async (e) => {
  const { id } = e.data;
  try {
    const { build, serializeCar } = await ready;
    const car = build(id);
    const { data, transfer } = serializeCar(car);
    self.postMessage({ id, data }, transfer);
  } catch (err) {
    self.postMessage({ id, error: String(err?.stack || err) });
  }
};
