// Loads the baked map data and answers "what is under this point" queries.

const BASE = `${import.meta.env.BASE_URL}data/`;

async function fetchBuf(name) {
  const r = await fetch(BASE + name);
  if (!r.ok) throw new Error(`Failed to load ${name}`);
  return r.arrayBuffer();
}

async function fetchJson(name) {
  const r = await fetch(BASE + name);
  if (!r.ok) throw new Error(`Failed to load ${name}`);
  return r.json();
}

// Decode a greyscale PNG to one byte per pixel.
async function fetchGrey(name, n) {
  const r = await fetch(BASE + name);
  if (!r.ok) throw new Error(`Failed to load ${name}`);
  const blob = await r.blob();
  let bmp;
  try {
    bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  } catch {
    bmp = await createImageBitmap(blob);
  }
  const out = new Uint8Array(n * n);
  // draw in strips to keep the temporary RGBA buffer small on phones
  const strip = 400;
  const cv = document.createElement('canvas');
  cv.width = n;
  cv.height = strip;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  for (let y0 = 0; y0 < n; y0 += strip) {
    const h = Math.min(strip, n - y0);
    ctx.clearRect(0, 0, n, strip);
    ctx.drawImage(bmp, 0, y0, n, h, 0, 0, n, h);
    const px = ctx.getImageData(0, 0, n, h).data;
    for (let i = 0, o = y0 * n; i < n * h; i++, o++) out[o] = px[i * 4];
  }
  bmp.close?.();
  return out;
}

export const SURFACE = { GRASS: 0, PAVED: 1, GRAVEL: 2, DIRT: 3, WATER: 4 };

export async function loadWorldData(onProgress = () => {}) {
  let done = 0;
  const total = 8;
  const tick = (p) => p.then((v) => { onProgress(++done / total); return v; });

  const meta = await tick(fetchJson('meta.json'));
  const [hBuf, hoBuf, surface, sdf, vectors, treesBuf, buildingsBuf] = await Promise.all([
    tick(fetchBuf('height.bin')),
    tick(fetchBuf('height_outer.bin')),
    tick(fetchGrey('surface.png', meta.surface.n)),
    tick(fetchGrey('sdf.png', meta.sdf.n)),
    tick(fetchJson('vectors.json')),
    tick(fetchBuf('trees.bin')),
    tick(fetchBuf('buildings.bin')),
  ]);

  const H = new Uint16Array(hBuf);
  const HO = new Uint16Array(hoBuf);
  const { inner, outer } = meta;
  const hn = meta.height.n, hres = meta.height.res;
  const on = meta.height.outerN, ores = meta.height.outerRes;
  const hs = meta.height.scale, hoff = meta.height.offset;
  const sn = meta.surface.n, sres = meta.surface.res;
  const dn = meta.sdf.n, dres = meta.sdf.res;
  const dmin = meta.sdf.min, dspan = meta.sdf.max - meta.sdf.min;

  const world = {
    meta, vectors, treesBuf, buildingsBuf, inner, outer,
    heightRaw: H, heightOuterRaw: HO,

    // Height of grid node (col,row) of the inner grid, metres.
    nodeHeight(c, r) { return H[r * hn + c] * hs + hoff; },
    outerNodeHeight(c, r) { return HO[r * on + c] * hs + hoff; },

    // Terrain height (river bed included) at world x,z.
    heightAt(x, z) {
      if (Math.abs(x) <= inner && Math.abs(z) <= inner) {
        let fx = (x + inner) / hres, fz = (z + inner) / hres;
        let c = Math.floor(fx), r = Math.floor(fz);
        if (c >= hn - 1) c = hn - 2;
        if (r >= hn - 1) r = hn - 2;
        fx -= c; fz -= r;
        const i = r * hn + c;
        const a = H[i], b = H[i + 1], d = H[i + hn], e = H[i + hn + 1];
        return ((a * (1 - fx) + b * fx) * (1 - fz) + (d * (1 - fx) + e * fx) * fz) * hs + hoff;
      }
      let fx = (Math.max(-outer, Math.min(outer, x)) + outer) / ores;
      let fz = (Math.max(-outer, Math.min(outer, z)) + outer) / ores;
      let c = Math.floor(fx), r = Math.floor(fz);
      if (c >= on - 1) c = on - 2;
      if (r >= on - 1) r = on - 2;
      fx -= c; fz -= r;
      const i = r * on + c;
      const a = HO[i], b = HO[i + 1], d = HO[i + on], e = HO[i + on + 1];
      return ((a * (1 - fx) + b * fx) * (1 - fz) + (d * (1 - fx) + e * fx) * fz) * hs + hoff;
    },

    surfaceAt(x, z) {
      const c = Math.floor((x + inner) / sres), r = Math.floor((z + inner) / sres);
      if (c < 0 || r < 0 || c >= sn || r >= sn) return SURFACE.GRASS;
      return surface[r * sn + c];
    },

    // Signed distance (m) to the nearest solid obstacle, including the map edge.
    sdfAt(x, z) {
      const edge = inner - 8 - Math.max(Math.abs(x), Math.abs(z));
      let fx = (x + inner) / dres - 0.5, fz = (z + inner) / dres - 0.5;
      if (fx < 0) fx = 0; else if (fx > dn - 1.001) fx = dn - 1.001;
      if (fz < 0) fz = 0; else if (fz > dn - 1.001) fz = dn - 1.001;
      const c = Math.floor(fx), r = Math.floor(fz);
      fx -= c; fz -= r;
      const i = r * dn + c;
      const v = (sdf[i] * (1 - fx) + sdf[i + 1] * fx) * (1 - fz) + (sdf[i + dn] * (1 - fx) + sdf[i + dn + 1] * fx) * fz;
      const d = dmin + (v / 255) * dspan;
      return d < edge ? d : edge;
    },

    // Outward direction from the nearest obstacle (unit vector written to out[0..1]).
    sdfGrad(x, z, out) {
      const e = 0.35;
      let gx = this.sdfAt(x + e, z) - this.sdfAt(x - e, z);
      let gz = this.sdfAt(x, z + e) - this.sdfAt(x, z - e);
      const l = Math.hypot(gx, gz);
      if (l < 1e-6) { out[0] = 0; out[1] = 0; return out; }
      out[0] = gx / l; out[1] = gz / l;
      return out;
    },
  };
  return world;
}
