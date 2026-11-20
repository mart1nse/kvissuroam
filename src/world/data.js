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
  const tick = (p) => p.then((v) => { onProgress(++done / 4); return v; });
  const [meta, coarseBuf, vectors, walls] = await Promise.all([
    tick(fetchJson('meta.json')), tick(fetchBuf('coarse.bin')), tick(fetchJson('vectors.json')),
    tick(fetchJson('walls.json').catch(() => null)),       // real wall colours, optional
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

  // a bucket grid over a sector's trees, built the first time a car comes near
  const TC = 16;
  function trunkGrid(s) {
    if (s.tgrid) return s.tgrid;
    const rec = s.trees, n = rec.length / 6, nc = Math.ceil(S / TC);
    const heads = new Int32Array(nc * nc).fill(-1), next = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const c = Math.min(nc - 1, Math.max(0, Math.floor((rec[i * 6] - s.x0) / TC)));
      const r = Math.min(nc - 1, Math.max(0, Math.floor((rec[i * 6 + 2] - s.z0) / TC)));
      next[i] = heads[r * nc + c]; heads[r * nc + c] = i;
    }
    return (s.tgrid = { nc, heads, next });
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
      if (treeMoves.length) moveTrees(s);
      if (clearings.length) s.trees = clearTrees(s.trees);
      if (treeAdds.length) addTreesTo(s);               // after the clearings: planted trees stay
      s.bushes = new Uint16Array(buf.slice(o, o + nb * 6)); o += nb * 6;      // ix, iz, height dm
      s.fences = new Uint16Array(buf.slice(o, o + nf * 6));                    // ix, iz, height dm | angle << 8
      for (const b of solids) stamp(s, b);
      s.state = 'ready';
      loading--;
      for (const f of onLoad) f(s);
    }, (err) => { loading--; s.state = 'failed'; console.warn(err); });
    return s.promise;
  }

  // Hand-made places that move map trees ((x, z) => [x, z] or null): applied as a sector loads, the tree
  // set on the ground of its new spot
  const treeMoves = [];
  function moveTrees(s) {
    const rec = s.trees, H = s.H;
    for (let i = 0; i < rec.length; i += 6) {
      for (const f of treeMoves) {
        const to = f(rec[i], rec[i + 2]);
        if (!to) continue;
        let fx = Math.min(Math.max((to[0] - s.x0) / hres, 0), hn - 1.001), fz = Math.min(Math.max((to[1] - s.z0) / hres, 0), hn - 1.001);
        const c = Math.floor(fx), r = Math.floor(fz), k = r * hn + c;
        fx -= c; fz -= r;
        const y = ((H[k] * (1 - fx) + H[k + 1] * fx) * (1 - fz) + (H[k + hn] * (1 - fx) + H[k + hn + 1] * fx) * fz) * hs + hoff;
        rec[i] = to[0]; rec[i + 1] += y - (rec[i + 1]); rec[i + 2] = to[1];
        break;
      }
    }
  }

  // Hand-placed trees (street rows the map has no trees for): [x, z, height, crown, type], set on the ground
  const treeAdds = [];
  function addTreesTo(s) {
    const add = treeAdds.filter(([x, z]) => x >= s.x0 && x < s.x1 && z >= s.z0 && z < s.z1);
    if (!add.length) return;
    const H = s.H, out = new Float32Array(s.trees.length + add.length * 6);
    out.set(s.trees);
    let i = s.trees.length;
    for (const [x, z, height, crown, type = 0] of add) {
      let fx = Math.min(Math.max((x - s.x0) / hres, 0), hn - 1.001), fz = Math.min(Math.max((z - s.z0) / hres, 0), hn - 1.001);
      const c = Math.floor(fx), r = Math.floor(fz), k = r * hn + c;
      fx -= c; fz -= r;
      const y = ((H[k] * (1 - fx) + H[k + 1] * fx) * (1 - fz) + (H[k + hn] * (1 - fx) + H[k + hn + 1] * fx) * fz) * hs + hoff;
      out[i++] = x; out[i++] = y; out[i++] = z; out[i++] = height; out[i++] = crown; out[i++] = type;
    }
    s.trees = out;
  }

  // Rectangles kept free of trees (hand-made places such as the Toome tennis courts): { x0, z0, x1, z1 }
  const clearings = [];
  function clearTrees(rec) {
    const keep = [];
    for (let i = 0; i < rec.length; i += 6) {
      const x = rec[i], z = rec[i + 2];
      if (!clearings.some((c) => (c.test ? c.test(x, z) : x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1))) for (let k = 0; k < 6; k++) keep.push(rec[i + k]);
    }
    return keep.length === rec.length ? rec : new Float32Array(keep);
  }

  // Extra solid boxes added at run time (parked cars, kiosks): written into the obstacle distance field
  // of every sector they touch, now and whenever that sector loads again. b: { x, z, yaw, hx, hz }
  const solids = [];
  function stamp(s, b) {
    const reach = Math.hypot(b.hx, b.hz) + dspan + dmin;
    if (b.x + reach < s.x0 || b.x - reach > s.x1 || b.z + reach < s.z0 || b.z - reach > s.z1) return;
    const c = Math.cos(b.yaw), sn = Math.sin(b.yaw);
    const c0 = Math.max(0, Math.floor((b.x - reach - s.x0) / dres)), c1 = Math.min(dn - 1, Math.ceil((b.x + reach - s.x0) / dres));
    const r0 = Math.max(0, Math.floor((b.z - reach - s.z0) / dres)), r1 = Math.min(dn - 1, Math.ceil((b.z + reach - s.z0) / dres));
    const D = s.D;
    // a box that may be taken away again (the back of a bus shelter a car crashes through) keeps the
    // field as it was under it, per sector
    if (b.removable) {
      const w = c1 - c0 + 1, keep = new Uint8Array(w * (r1 - r0 + 1));
      for (let r = r0; r <= r1; r++) keep.set(D.subarray(r * dn + c0, r * dn + c1 + 1), (r - r0) * w);
      (s.kept ||= new Map()).set(b, { r0, r1, c0, c1, keep });
    }
    for (let r = r0; r <= r1; r++) {
      for (let col = c0; col <= c1; col++) {
        const px = s.x0 + col * dres - b.x, pz = s.z0 + r * dres - b.z;
        const qx = Math.abs(px * c - pz * sn) - b.hx, qz = Math.abs(px * sn + pz * c) - b.hz;
        const d = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
        const v = Math.max(0, Math.min(255, Math.round(((d - dmin) / dspan) * 255)));
        const i = r * dn + col;
        if (v < D[i]) D[i] = v;
      }
    }
  }

  function unload(s) {
    for (const f of onUnload) f(s);
    if (last === s) last = null;
    s.H = s.S = s.D = s.buildings = s.trees = s.bushes = s.fences = s.tgrid = s.kept = null;
    s.state = 'idle';
  }

  // ---- decks: ribbons above the height field (overpass spans, lids over tunnels). See tools/bake/terrain.py
  const decks = (vectors.decks || []).map((d) => {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const p of d.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    const m = (d.ws ? Math.max(...d.ws) : d.hw) + 2;
    // ws: half width at each station where it varies; rs: which sides have a railing at each station (1 left, 2 right)
    return { kind: d.k, hw: d.hw, pts: d.pts, ws: d.ws || null, rs: d.rs || null, wall: d.wall || 0, pr: d.pr || null, rail: d.rail || null, w: d.w || 0, b: d.b || '', name: d.n || '', x0: x0 - m, z0: z0 - m, x1: x1 + m, z1: z1 + m };
  });
  const hit = { y: 0, lat: 0, nx: 0, nz: 0, deck: null, seg: 0, hw: 0 };
  const cand = { y: 0, lat: 0, nx: 0, nz: 0, seg: 0, hw: 0 };
  // Where deck d is over the point: fills "cand" and returns true.
  function onDeck(d, x, z) {
    const P = d.pts, W = d.ws;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
      let t = ((x - a[0]) * dx + (z - a[1]) * dz) / l2;
      if (t < -0.2 || t > 1.2) continue;
      const l = Math.sqrt(l2), nx = -dz / l, nz = dx / l;
      const lat = (x - a[0]) * nx + (z - a[1]) * nz;
      const tc = t < 0 ? 0 : t > 1 ? 1 : t;
      const hw = W ? W[i] + (W[i + 1] - W[i]) * tc : d.hw;           // a deck can change width along its length
      if (lat < -hw || lat > hw) continue;
      if ((t < 0 && i > 0) || (t > 1 && i < P.length - 2)) { if (t < -0.2 || t > 1.2) continue; }     // on the outside of a bend no segment has it squarely
      else if (t < -0.15 || t > 1.15) continue;              // (a hand's breadth past the end: the next deck starts there)
      t = tc;
      // heights run from the left edge to the right edge of the deck
      const m = a.length - 3, f = Math.min(m - 1e-6, ((hw - lat) / (2 * hw)) * m), j = 2 + Math.floor(f), u = f - Math.floor(f);
      const ya = a[j] + (a[j + 1] - a[j]) * u, yb = b[j] + (b[j + 1] - b[j]) * u;
      cand.y = ya + (yb - ya) * t; cand.lat = lat; cand.nx = nx; cand.nz = nz; cand.seg = i; cand.hw = hw;
      return true;
    }
    return false;
  }
  // The deck over the point, if any: fills "hit" and returns true. Decks can be stacked (a viaduct over
  // the lid of a tunnel), so of those over the point it is the highest one that is below yMax; with
  // low set (and the terrain height t), spans with room to drive under do not count.
  function deckAt(x, z, yMax = Infinity, low = false, t = 0) {
    let found = false;
    for (let k = 0; k < decks.length; k++) {
      const d = decks[k];
      if (x < d.x0 || x > d.x1 || z < d.z0 || z > d.z1) continue;
      if (!onDeck(d, x, z) || cand.y >= yMax || (found && cand.y <= hit.y)) continue;
      if (low && d.kind === 1 && cand.y - t > 1.5) continue;
      hit.y = cand.y; hit.lat = cand.lat; hit.nx = cand.nx; hit.nz = cand.nz; hit.seg = cand.seg; hit.hw = cand.hw; hit.deck = d;
      found = true;
    }
    return found;
  }
  const UNDER = 1.1;        // a car lower than this below a deck is on the ground under it (1.5 m with what the physics adds)

  // Piers under the long spans: [x, z, along x, along z, half width across, top]. Only a car below the deck meets them.
  const piers = [];
  for (const d of decks) {
    for (const [px, pz] of d.pr || []) {
      const P = d.pts;
      let k = 0, best = Infinity;
      for (let i = 0; i < P.length; i++) { const q = Math.hypot(P[i][0] - px, P[i][1] - pz); if (q < best) { best = q; k = i; } }
      const a = P[Math.max(k - 1, 0)], b = P[Math.min(k + 1, P.length - 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      piers.push([px, pz, (b[0] - a[0]) / l, (b[1] - a[1]) / l, (d.ws ? d.ws[k] : d.hw) * 0.8, Math.min(P[k][2], P[k][P[k].length - 1])]);
    }
  }
  function pierPush(x, z, y, r, out) {
    for (let k = 0; k < piers.length; k++) {
      const p = piers[k];
      if (Math.abs(x - p[0]) > p[4] + 4 || Math.abs(z - p[1]) > p[4] + 4 || y > p[5] - UNDER) continue;
      const dx = x - p[0], dz = z - p[1];
      const al = dx * p[2] + dz * p[3], ac = -dx * p[3] + dz * p[2];          // along the bridge, across it
      const qa = Math.abs(al) - 0.45, qc = Math.abs(ac) - p[4];
      const dist = Math.hypot(Math.max(qa, 0), Math.max(qc, 0)) + Math.min(Math.max(qa, qc), 0);
      if (dist >= r) continue;
      // out through the nearer face
      let na, nc;
      if (qa > 0 || qc > 0) { na = Math.max(qa, 0) * Math.sign(al); nc = Math.max(qc, 0) * Math.sign(ac); const l = Math.hypot(na, nc) || 1; na /= l; nc /= l; }
      else if (qa > qc) { na = Math.sign(al) || 1; nc = 0; } else { na = 0; nc = Math.sign(ac) || 1; }
      out[0] = na * p[2] - nc * p[3]; out[1] = na * p[3] + nc * p[2]; out[2] = r - dist;
      return true;
    }
    return false;
  }

  const bumps = [];
  function bumpAt(x, z) {
    let h = 0;
    for (let k = 0; k < bumps.length; k++) {
      const b = bumps[k];
      if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) h += b.at(x, z);
    }
    return h;
  }

  const rectDist = (s, x, z) => Math.hypot(Math.max(s.x0 - x, 0, x - s.x1), Math.max(s.z0 - z, 0, z - s.z1));

  const world = {
    meta, vectors, walls, sectors, coarse: C, decks,
    onSectorLoad(f) { onLoad.push(f); },
    onSectorUnload(f) { onUnload.push(f); },
    pending: () => loading,

    // Keep trees out of a rectangle in sectors loaded from now on (call before the sectors load).
    addClearing(r) { clearings.push(r); },          // { x0, z0, x1, z1 }, or { test(x, z) } for any shape
    // Move map trees: f(x, z) returns the new [x, z] or null (call before the sectors load).
    addTreeMove(f) { treeMoves.push(f); },
    // Plant trees: [[x, z, height, crown, type]] (call before the sectors load).
    addTrees(list) { treeAdds.push(...list); },

    // Make boxes solid for the cars ({ x, z, yaw, hx, hz }: centre, rotation of the local x axis, half sizes).
    addSolids(list) {
      solids.push(...list);
      for (const s of sectors.values()) if (s.state === 'ready') for (const b of list) stamp(s, b);
    },
    // Take away boxes added with removable: true: the field under each is put back as it was, and
    // the solids still there that reach into it are written in again.
    removeSolids(list) {
      for (const b of list) { const k = solids.indexOf(b); if (k >= 0) solids.splice(k, 1); }
      for (const s of sectors.values()) {
        if (s.state !== 'ready' || !s.kept) continue;
        let touched = false;
        for (const b of [...list].reverse()) {
          const k = s.kept.get(b);
          if (!k) continue;
          const w = k.c1 - k.c0 + 1;
          for (let r = k.r0; r <= k.r1; r++) s.D.set(k.keep.subarray((r - k.r0) * w, (r - k.r0 + 1) * w), r * dn + k.c0);
          s.kept.delete(b);
          touched = true;
        }
        if (!touched) continue;
        for (const b of solids) {
          const near = list.some((o) => Math.hypot(b.x - o.x, b.z - o.z) < Math.hypot(b.hx, b.hz) + Math.hypot(o.hx, o.hz) + 2 * (dspan + dmin));
          if (near) stamp(s, b);
        }
      }
    },

    // Start loading sectors within rLoad of the point, drop those beyond rKeep
    // (but never those within hold.r of hold, e.g. the parked car while the intro drone flies elsewhere).
    update(x, z, rLoad, rKeep, hold = null) {
      const want = [];
      for (const s of sectors.values()) {
        s.d = rectDist(s, x, z);
        if (s.state === 'idle' && s.d < rLoad) want.push(s);
        else if (s.state === 'ready' && s.d > rKeep && !(hold && rectDist(s, hold.x, hold.z) < hold.r)) unload(s);
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
      const h = ((a * (1 - fx) + b * fx) * (1 - fz) + (d * (1 - fx) + e * fx) * fz) * hs + hoff;
      return bumps.length === 0 ? h : h + bumpAt(x, z);
    },

    // Small raised shapes on top of the height field (kerbs finer than its 2 m grid): each is
    // { x0, z0, x1, z1, at(x, z) -> metres }.
    addBump(b) { bumps.push(b); },
    // How much those raised shapes add at the point: the physics feels a kerb as a step by it.
    kerbAt(x, z) { return bumps.length === 0 ? 0 : bumpAt(x, z); },
    // The raised ground of those shapes that draw it as ground (a bump with top(x0, z0, size, out)
    // pushes triangles [x, y, z, ...] in that square), for the ground tiles to draw with their own look.
    bumpTops(x0, z0, size) {
      const out = [];
      for (const b of bumps) if (b.top && !(b.x1 < x0 || b.x0 > x0 + size || b.z1 < z0 || b.z0 > z0 + size)) b.top(x0, z0, size, out);
      return out.length ? out : null;
    },

    // What a car at height y stands on: a deck when it is level with one, the terrain otherwise.
    groundAt(x, z, y) {
      const t = this.heightAt(x, z);
      if (decks.length === 0 || !deckAt(x, z, y + UNDER)) return t;
      return hit.y > t ? hit.y : t;
    },

    // Topmost surface for something drawn along a road. level: 1 on a bridge, -1 in a tunnel, 0 otherwise.
    topAt(x, z, level = 0) {
      const t = this.heightAt(x, z);
      if (level < 0 || decks.length === 0 || !deckAt(x, z, Infinity, level < 1, t)) return t;     // level 0: the road under a bridge
      return Math.max(t, hit.y);
    },

    // Railing of a bridge span: when a car at height y is against it, writes the push direction and
    // depth to out[0..2] and returns true.
    railPush(x, z, y, halfWidth, out) {
      if (piers.length !== 0 && pierPush(x, z, y, halfWidth + 0.25, out)) return true;
      if (decks.length === 0 || !deckAt(x, z, y + UNDER)) return false;
      const d = hit.deck;
      const sgn = hit.lat > 0 ? -1 : 1;
      if (d.rs !== null) { if (!(d.rs[hit.seg] & d.rs[hit.seg + 1] & (hit.lat > 0 ? 1 : 2))) return false; }
      else if (d.rail === null || hit.seg < d.rail[0] || hit.seg >= d.rail[1]) return false;
      const lim = Math.max(0.2, hit.hw - 0.25 - halfWidth);
      const over = Math.abs(hit.lat) - lim;
      if (over <= 0) return false;
      out[0] = hit.nx * sgn; out[1] = hit.nz * sgn; out[2] = over;
      return true;
    },

    // Surface class under the point. With y (a car's height), a bridge deck it is level with counts as paved.
    surfaceAt(x, z, y) {
      if (y !== undefined && decks.length !== 0 && deckAt(x, z, y + UNDER) && hit.y > this.heightAt(x, z) + 0.3) return SURFACE.PAVED;
      const s = find(x, z);
      if (s === null) return SURFACE.GRASS;
      let c = Math.floor((x - s.x0) / sres), r = Math.floor((z - s.z0) / sres);
      if (c >= sn) c = sn - 1;
      if (r >= sn) r = sn - 1;
      return s.S[r * sn + c];
    },

    // Calls fn(sector, i) for every tree within reach of (x, z); tree i is sector.trees[i * 6 ...].
    treesNear(x, z, reach, fn) {
      const sx0 = Math.floor((x - reach - G0) / S), sx1 = Math.floor((x + reach - G0) / S);
      const sz0 = Math.floor((z - reach - G0) / S), sz1 = Math.floor((z + reach - G0) / S);
      for (let sx = sx0; sx <= sx1; sx++) for (let sz = sz0; sz <= sz1; sz++) {
        const s = sectors.get(key(sx, sz));
        if (s === undefined || s.state !== 'ready' || !s.trees) continue;
        const g = trunkGrid(s), rec = s.trees;
        const c0 = Math.max(0, Math.floor((x - reach - s.x0) / TC)), c1 = Math.min(g.nc - 1, Math.floor((x + reach - s.x0) / TC));
        const r0 = Math.max(0, Math.floor((z - reach - s.z0) / TC)), r1 = Math.min(g.nc - 1, Math.floor((z + reach - s.z0) / TC));
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
          for (let i = g.heads[r * g.nc + c]; i >= 0; i = g.next[i]) {
            const dx = rec[i * 6] - x, dz = rec[i * 6 + 2] - z;
            if (dx * dx + dz * dz <= reach * reach) fn(s, i);
          }
        }
      }
    },

    // Tree trunks within reach of (x, z), written to out as flat [x, z, radius, ...]. The physics
    // collides with them as exact circles: the 0.5 m distance field is too coarse for something
    // as thin as a trunk, and a car that got half way past one could not get free again.
    trunksNear(x, z, reach, out) {
      out.length = 0;
      const sx0 = Math.floor((x - reach - G0) / S), sx1 = Math.floor((x + reach - G0) / S);
      const sz0 = Math.floor((z - reach - G0) / S), sz1 = Math.floor((z + reach - G0) / S);
      for (let sx = sx0; sx <= sx1; sx++) for (let sz = sz0; sz <= sz1; sz++) {
        const s = sectors.get(key(sx, sz));
        if (s === undefined || s.state !== 'ready' || !s.trees) continue;
        const g = trunkGrid(s), rec = s.trees;
        const c0 = Math.max(0, Math.floor((x - reach - s.x0) / TC)), c1 = Math.min(g.nc - 1, Math.floor((x + reach - s.x0) / TC));
        const r0 = Math.max(0, Math.floor((z - reach - s.z0) / TC)), r1 = Math.min(g.nc - 1, Math.floor((z + reach - s.z0) / TC));
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
          for (let i = g.heads[r * g.nc + c]; i >= 0; i = g.next[i]) {
            const tx = rec[i * 6], tz = rec[i * 6 + 2];
            if (Math.abs(tx - x) > reach || Math.abs(tz - z) > reach) continue;
            out.push(tx, tz, Math.min(0.45, Math.max(0.14, 0.035 * rec[i * 6 + 3])));   // as baked (tools/bake/surface.py trunk)
          }
        }
      }
      return out;
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
  // The retaining walls of ramps are solid for everything, above and below (the obstacle field is flat).
  const wallBoxes = [];
  for (const d of decks) {
    if (!d.wall || !d.rs) continue;
    const P = d.pts;
    for (let i = 0; i < P.length - 1; i++) {
      for (const [bit, sg] of [[1, 1], [2, -1]]) {
        if (!(d.rs[i] & d.rs[i + 1] & bit)) continue;
        const a = P[i], b = P[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
        const hw = (d.ws ? (d.ws[i] + d.ws[i + 1]) / 2 : d.hw) * sg;
        wallBoxes.push({ x: (a[0] + b[0]) / 2 - (dz / l) * hw, z: (a[1] + b[1]) / 2 + (dx / l) * hw, yaw: Math.atan2(-dz, dx), hx: l / 2 + 0.15, hz: 0.2 });
      }
    }
  }
  if (wallBoxes.length) world.addSolids(wallBoxes);
  return world;
}
