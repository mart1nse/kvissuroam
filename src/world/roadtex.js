// Per-sector road textures, painted from the road centre lines and paved-area outlines instead of
// the 1 m surface grid, so that road edges are as straight as the roads are.
//   cover: R hard paving (asphalt, stone), G streets that have a kerb, B gravel and dirt roads
//   tone:  R brightness and G warmth of the road in the aerial photo, B stone paving (setts)
import * as THREE from 'three';

const KERBED = new Set(['Tänav', 'Põhimaantee', 'Tugimaantee', 'Kõrvalmaantee', 'Ramp või ühenduste']);
const TONE0 = [183, 136];                    // typical Tartu street in the photo: brightness, 128 + (red - blue)

export function createRoadPainter(world, size) {
  const S = world.meta.sector.size, G0 = world.meta.sector.grid0;
  const bySector = new Map();
  const add = (kind, item, x0, z0, x1, z1) => {
    const m = 12;
    for (let sz = Math.floor((z0 - m - G0) / S); sz <= Math.floor((z1 + m - G0) / S); sz++) {
      for (let sx = Math.floor((x0 - m - G0) / S); sx <= Math.floor((x1 + m - G0) / S); sx++) {
        const k = `${sx}_${sz}`;
        let e = bySector.get(k);
        if (!e) bySector.set(k, (e = { roads: [], areas: [] }));
        e[kind].push(item);
      }
    }
  };
  const box = (pts) => {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    return [x0, z0, x1, z1];
  };
  for (const r of world.vectors.roads) if (r.pts.length > 1 && r.s !== 4) add('roads', r, ...box(r.pts));
  for (const a of world.vectors.areas || []) if (a.t !== 4) add('areas', a, ...box(a.outer));
  for (const e of bySector.values()) e.roads.sort((p, q) => p.w - q.w);         // wide roads are painted last

  const toneOf = (c, stone) => {
    if (!c) return `rgb(${TONE0[0]},${TONE0[1]},${stone ? 255 : 0})`;
    const lum = Math.round((c[0] + c[1] + c[2]) / 3), warm = Math.max(0, Math.min(255, 128 + (c[0] - c[2])));
    return `rgb(${lum},${warm},${stone ? 255 : 0})`;
  };
  const line = (ctx, pts) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  };
  const ring = (ctx, a) => {
    ctx.beginPath();
    for (const r of [a.outer, ...(a.holes || [])]) {
      ctx.moveTo(r[0][0], r[0][1]);
      for (let i = 1; i < r.length; i++) ctx.lineTo(r[i][0], r[i][1]);
      ctx.closePath();
    }
  };
  const canvas = (n, s) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = n;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const k = n / S;
    ctx.setTransform(k, 0, 0, k, -s.x0 * k, -s.z0 * k);
    ctx.lineCap = ctx.lineJoin = 'round';
    return [cv, ctx];
  };
  const texture = (cv, mips) => {
    const t = new THREE.CanvasTexture(cv);
    t.flipY = false;
    t.generateMipmaps = mips;
    t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  };

  // paint(sector) -> { cover, tone, hard(i, j) } ; hard: is cell (i, j) of the 1 m surface grid on a painted road
  return (s) => {
    const e = bySector.get(`${s.sx}_${s.sz}`) || { roads: [], areas: [] };
    const [cv, ctx] = canvas(size, s);
    ctx.fillStyle = '#000';
    ctx.fillRect(s.x0, s.z0, S, S);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#f00';
    for (const a of e.areas) { ring(ctx, a); ctx.fill('evenodd'); }
    for (const r of e.roads) {
      const soft = r.s === 2 || r.s === 3;
      ctx.strokeStyle = soft ? '#00f' : KERBED.has(r.type) && r.w >= 4.5 ? '#ff0' : '#f00';
      ctx.lineWidth = r.w;
      line(ctx, r.pts);
      ctx.stroke();
    }
    const n2 = size / 2;
    const [tv, tctx] = canvas(n2, s);
    tctx.fillStyle = toneOf(null, false);
    tctx.fillRect(s.x0, s.z0, S, S);
    for (const a of e.areas) { tctx.fillStyle = toneOf(a.c, a.t === 2); ring(tctx, a); tctx.fill('evenodd'); }
    for (const r of e.roads) {
      if (r.s === 2 || r.s === 3) continue;
      tctx.strokeStyle = toneOf(r.c, r.s === 1);
      tctx.lineWidth = r.w + 2.5;
      line(tctx, r.pts);
      tctx.stroke();
    }
    const img = ctx.getImageData(0, 0, size, size).data;
    const k = size / S;
    return {
      cover: texture(cv, true), tone: texture(tv, false),
      hard: (i, j) => img[(Math.floor((j + 0.5) * k) * size + Math.floor((i + 0.5) * k)) * 4] > 90,
    };
  };
}
