// Loads the baked map data and answers "what is under this point" queries.
// The map is cut into square sectors that are streamed in around the car.

const BASE = `${import.meta.env.BASE_URL}data/`;

async function fetchBuf(name) {
  const r = await fetch(BASE + name);
  if (!r.ok) throw new Error(`Failed to load ${name}`);
  const buf = await r.arrayBuffer();
  const u8 = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
  if (u8[0] === 0x1f && u8[1] === 0x8b) {       // gzip that the server did not unpack for us
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer();
  }
  return buf;
}

async function fetchJson(name) {
  const r = await fetch(BASE + name);
  if (!r.ok) throw new Error(`Failed to load ${name}`);
  return r.json();
}

export const SURFACE = { GRASS: 0, PAVED: 1, GRAVEL: 2, DIRT: 3, WATER: 4 };

export async function loadWorldData(onProgress = () => {}) {
  let done = 0;
  const tick = (p) => p.then((v) => { onProgress(++done / 3); return v; });
  const [meta, coarseBuf, vectors] = await Promise.all([
    tick(fetchJson('meta.json')), tick(fetchBuf('coarse.bin')), tick(fetchJson('vectors.json')),
  ]);

  const C = new Uint16Array(coarseBuf);
  const co = meta.coarse;
  const S = meta.sector.size, G0 = meta.sector.grid0;
  const hn = meta.height.n, hres = meta.height.res;
  const hs = meta.height.scale, hoff = meta.height.offset;
  const sn = meta.surface.n, sres = meta.surface.res;
  const dn = meta.sdf.n, dres = meta.sdf.res;
  const dmin = meta.sdf.min, dspan = meta.sdf.max - meta.sdf.min;

  const key = (sx, sz) => (sx + 512) * 4096 + (sz + 512);
  const sectors = new Map();
  for (const [sx, sz, div] of meta.sector.list) {
    const x0 = G0 + sx * S, z0 = G0 + sz * S;
    sectors.set(key(sx, sz), { sx, sz, div, x0, z0, x1: x0 + S, z1: z0 + S, state: 'idle', d: 0 });
  }
  const onLoad = [], onUnload = [];
  let last = null, loading = 0;

  function find(x, z) {
    if (last !== null && x >= last.x0 && x < last.x1 && z >= last.z0 && z < last.z1) return last;
    const s = sectors.get(key(Math.floor((x - G0) / S), Math.floor((z - G0) / S)));
    if (s !== undefined && s.state === 'ready') { last = s; return s; }
    return null;
  }

  function load(s) {
    s.state = 'loading';
    loading++;
    s.promise = fetchBuf(`sec/${s.sx}_${s.sz}.kvs`).then((buf) => {
      const head = new Uint32Array(buf, 0, 8);
      const nv = head[4], nt = head[5], nb = head[6], nf = head[7];
      let o = 32;
      s.H = new Uint16Array(buf.slice(o, o + hn * hn * 2)); o += hn * hn * 2;
      s.S = new Uint8Array(buf, o, sn * sn); o += sn * sn;
      s.D = new Uint8Array(buf, o, dn * dn); o += dn * dn;
      s.buildings = { nv, buf, offset: o }; o += nv * 15;
      s.trees = new Float32Array(buf.slice(o, o + nt * 24)); o += nt * 24;
      s.bushes = new Uint16Array(buf.slice(o, o + nb * 6)); o += nb * 6;      // ix, iz, height dm
      s.fences = new Uint16Array(buf.slice(o, o + nf * 6));                    // ix, iz, height dm | angle << 8
      s.state = 'ready';
      loading--;
      for (const f of onLoad) f(s);
    }, (err) => { loading--; s.state = 'failed'; console.warn(err); });
    return s.promise;
  }

  function unload(s) {
    for (const f of onUnload) f(s);
    if (last === s) last = null;
    s.H = s.S = s.D = s.buildings = s.trees = s.bushes = s.fences = null;
    s.state = 'idle';
  }

  // ---- decks: ribbons above the height field (overpass spans, lids over tunnels). See tools/bake/terrain.py
  const decks = (vectors.decks || []).map((d) => {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const p of d.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    const m = d.hw + 2;
    return { kind: d.k, hw: d.hw, pts: d.pts, rail: d.rail || null, x0: x0 - m, z0: z0 - m, x1: x1 + m, z1: z1 + m };
  });
  const hit = { y: 0, lat: 0, nx: 0, nz: 0, deck: null, seg: 0 };
  // Deck over the point, if any: fills "hit" and returns true.
  function deckAt(x, z) {
    for (let k = 0; k < decks.length; k++) {
      const d = decks[k];
      if (x < d.x0 || x > d.x1 || z < d.z0 || z > d.z1) continue;
      const P = d.pts;
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[i], b = P[i + 1];
        const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
        let t = ((x - a[0]) * dx + (z - a[1]) * dz) / l2;
        if (t < -0.2 || t > 1.2) continue;
        const l = Math.sqrt(l2), nx = -dz / l, nz = dx / l;
        const lat = (x - a[0]) * nx + (z - a[1]) * nz;
        if (lat < -d.hw || lat > d.hw) continue;
        if ((t < 0 && i > 0) || (t > 1 && i < P.length - 2)) { if (t < -0.02 || t > 1.02) continue; }   // the next segment has it
        else if (t < 0 || t > 1) continue;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        // heights run from the left edge to the right edge of the deck
        const m = a.length - 3, f = Math.min(m - 1e-6, ((d.hw - lat) / (2 * d.hw)) * m), j = 2 + Math.floor(f), u = f - Math.floor(f);
        const ya = a[j] + (a[j + 1] - a[j]) * u, yb = b[j] + (b[j + 1] - b[j]) * u;
        hit.y = ya + (yb - ya) * t; hit.lat = lat; hit.nx = nx; hit.nz = nz; hit.deck = d; hit.seg = i;
        return true;
      }
    }
    return false;
  }
  const UNDER = 1.6;        // a car lower than this below a deck is on the ground under it

  const rectDist = (s, x, z) => Math.hypot(Math.max(s.x0 - x, 0, x - s.x1), Math.max(s.z0 - z, 0, z - s.z1));

  const world = {
    meta, vectors, sectors, coarse: C, decks,
    onSectorLoad(f) { onLoad.push(f); },
    onSectorUnload(f) { onUnload.push(f); },
    pending: () => loading,

    // Start loading sectors within rLoad of the point, drop those beyond rKeep.
    update(x, z, rLoad, rKeep) {
      const want = [];
      for (const s of sectors.values()) {
        s.d = rectDist(s, x, z);
        if (s.state === 'idle' && s.d < rLoad) want.push(s);
        else if (s.state === 'ready' && s.d > rKeep) unload(s);
      }
      want.sort((a, b) => a.d - b.d);
      for (const s of want) { if (loading >= 3) break; load(s); }
    },

    // Load everything within r of the point and wait for it.
    loadAround(x, z, r) {
      const jobs = [];
      for (const s of sectors.values()) {
        if (rectDist(s, x, z) >= r) continue;
        if (s.state === 'idle' || s.state === 'failed') jobs.push(load(s));
        else if (s.state === 'loading') jobs.push(s.promise);
      }
      return Promise.all(jobs);
    },

    // True when the ground under the point is available in full detail (or never will be).
    ready(x, z) {
      if (find(x, z) !== null) return true;
      const s = sectors.get(key(Math.floor((x - G0) / S), Math.floor((z - G0) / S)));
      return s === undefined || s.state === 'failed';
    },

    coarseHeight(x, z) {
      let fx = (Math.max(co.x0, Math.min(co.x1, x)) - co.x0) / co.res;
      let fz = (Math.max(co.z0, Math.min(co.z1, z)) - co.z0) / co.res;
      let c = Math.floor(fx), r = Math.floor(fz);
      if (c >= co.nx - 1) c = co.nx - 2;
      if (r >= co.nz - 1) r = co.nz - 2;
      fx -= c; fz -= r;
      const i = r * co.nx + c;
      const a = C[i], b = C[i + 1], d = C[i + co.nx], e = C[i + co.nx + 1];
      return ((a * (1 - fx) + b * fx) * (1 - fz) + (d * (1 - fx) + e * fx) * fz) * hs + hoff;
    },

    // Terrain height (river bed included) at world x,z.
    heightAt(x, z) {
      const s = find(x, z);
      if (s === null) return this.coarseHeight(x, z);
      let fx = (x - s.x0) / hres, fz = (z - s.z0) / hres;
      let c = Math.floor(fx), r = Math.floor(fz);
      if (c >= hn - 1) c = hn - 2;
      if (r >= hn - 1) r = hn - 2;
      fx -= c; fz -= r;
      const H = s.H, i = r * hn + c;
      const a = H[i], b = H[i + 1], d = H[i + hn], e = H[i + hn + 1];
      return ((a * (1 - fx) + b * fx) * (1 - fz) + (d * (1 - fx) + e * fx) * fz) * hs + hoff;
    },

    // What a car at height y stands on: a deck when it is level with one, the terrain otherwise.
    groundAt(x, z, y) {
      const t = this.heightAt(x, z);
      if (decks.length === 0 || !deckAt(x, z)) return t;
      return hit.y > t && y > hit.y - UNDER ? hit.y : t;
    },

    // Topmost surface for something drawn along a road. level: 1 on a bridge, -1 in a tunnel, 0 otherwise.
    topAt(x, z, level = 0) {
      const t = this.heightAt(x, z);
      if (level < 0 || decks.length === 0 || !deckAt(x, z)) return t;
      if (hit.deck.kind === 1 && level < 1 && hit.y - t > 1.5) return t;     // the road under a bridge
      return Math.max(t, hit.y);
    },

    // Railing of a bridge span: when a car at height y is against it, writes the push direction and
    // depth to out[0..2] and returns true.
    railPush(x, z, y, halfWidth, out) {
      if (decks.length === 0 || !deckAt(x, z)) return false;
      const d = hit.deck;
      if (d.rail === null || hit.seg < d.rail[0] || hit.seg >= d.rail[1] || y < hit.y - UNDER) return false;
      const lim = Math.max(0.2, d.hw - 0.25 - halfWidth);
      const over = Math.abs(hit.lat) - lim;
      if (over <= 0) return false;
      const sgn = hit.lat > 0 ? -1 : 1;
      out[0] = hit.nx * sgn; out[1] = hit.nz * sgn; out[2] = over;
      return true;
    },

    surfaceAt(x, z) {
      const s = find(x, z);
      if (s === null) return SURFACE.GRASS;
      let c = Math.floor((x - s.x0) / sres), r = Math.floor((z - s.z0) / sres);
      if (c >= sn) c = sn - 1;
      if (r >= sn) r = sn - 1;
      return s.S[r * sn + c];
    },

    // Signed distance (m) to the nearest solid obstacle, including the map edge.
    sdfAt(x, z) {
      const s = find(x, z);
      if (s === null) return 12;
      let fx = (x - s.x0) / dres, fz = (z - s.z0) / dres;
      let c = Math.floor(fx), r = Math.floor(fz);
      if (c >= dn - 1) c = dn - 2;
      if (r >= dn - 1) r = dn - 2;
      fx -= c; fz -= r;
      const D = s.D, i = r * dn + c;
      const v = (D[i] * (1 - fx) + D[i + 1] * fx) * (1 - fz) + (D[i + dn] * (1 - fx) + D[i + dn + 1] * fx) * fz;
      return dmin + (v / 255) * dspan;
    },

    // Outward direction from the nearest obstacle (unit vector written to out[0..1]).
    sdfGrad(x, z, out) {
      const e = 0.35;
      const gx = this.sdfAt(x + e, z) - this.sdfAt(x - e, z);
      const gz = this.sdfAt(x, z + e) - this.sdfAt(x, z - e);
      const l = Math.hypot(gx, gz);
      if (l < 1e-6) { out[0] = 0; out[1] = 0; return out; }
      out[0] = gx / l; out[1] = gz / l;
      return out;
    },
  };
  return world;
}
