// Per-sector road textures, painted from the road centre lines and paved-area outlines instead of
// the 1 m surface grid, so that road edges are as straight as the roads are.
//   cover: R hard paving (asphalt, stone), G streets that have a kerb, B gravel and dirt roads
//   tone:  R brightness and G warmth of the road in the aerial photo, B stone paving (setts)
// A gravel road up to RUTTED wide is painted in B as a slope across it, 1 on the centre line, 0.5 at the
// edge, falling on for a little way outside it: the shader reads from it how far from the middle a point is
// and lays wheel tracks there (one pair on a road one car wide, a fainter pair in each lane on a wider one).
// Its width is written in the tone's B (2 x metres, below the values that mean setts).
import * as THREE from 'three';

const KERBED = new Set(['Tänav', 'Põhimaantee', 'Tugimaantee', 'Kõrvalmaantee', 'Ramp või ühenduste']);
const TONE0 = [183, 136];                    // typical Tartu street in the photo: brightness, 128 + (red - blue)
const RUTTED = 8.6;                          // gravel roads up to this wide (ETAK) get wheel tracks (one car wide: up to 4.6)

export function createRoadPainter(world, size) {
  const S = world.meta.sector.size, G0 = world.meta.sector.grid0;
  const bySector = new Map();
  const add = (kind, item, x0, z0, x1, z1) => {
    const m = 12;
    for (let sz = Math.floor((z0 - m - G0) / S); sz <= Math.floor((z1 + m - G0) / S); sz++) {
      for (let sx = Math.floor((x0 - m - G0) / S); sx <= Math.floor((x1 + m - G0) / S); sx++) {
        const k = `${sx}_${sz}`;
        let e = bySector.get(k);
        if (!e) bySector.set(k, (e = { roads: [], areas: [], over: [], tone: [] }));
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
  // hand-made places that set the cover themselves, painted over everything else (src/race/lai.js)
  for (const a of world.vectors.overPaint || []) add('over', a, ...box(a.outer));
  // hand-made road tones, painted over the photo's (src/race/jakobilai.js): { outer, tone: 'rgb(lum, warm, 0)' }
  for (const a of world.vectors.toneOver || []) add('tone', a, ...box(a.outer));
  for (const e of bySector.values()) e.roads.sort((p, q) => p.w - q.w);         // wide roads are painted last

  const toneOf = (c, stone) => {
    if (!c) return `rgb(${TONE0[0]},${TONE0[1]},${stone ? 255 : 0})`;
    const lum = Math.round((c[0] + c[1] + c[2]) / 3), warm = Math.max(0, Math.min(255, 128 + (c[0] - c[2])));
    return `rgb(${lum},${warm},${stone ? 255 : 0})`;
  };
  const line = (ctx, pts) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    // the kinks of the digitised centre line are rounded off, up to 6 m either side of a vertex
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const la = Math.hypot(b[0] - a[0], b[1] - a[1]), lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
      const d = Math.min(la, lc, 12) / 2;
      if (d < 0.2) { ctx.lineTo(b[0], b[1]); continue; }
      ctx.lineTo(b[0] + ((a[0] - b[0]) / la) * d, b[1] + ((a[1] - b[1]) / la) * d);
      ctx.quadraticCurveTo(b[0], b[1], b[0] + ((c[0] - b[0]) / lc) * d, b[1] + ((c[1] - b[1]) / lc) * d);
    }
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
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
  // In steps (see ../jobs.js). The browser only notes what is drawn on a canvas and paints it when the picture
  // is first read: for a square of the centre that was 50 ms in one go. Reading one pixel after every few
  // dozen strokes makes it paint that much, and each `yield` is then a place to stop until the next frame.
  const BATCH = 36;
  function* steps(s) {
    let drawn = 0;
    const due = (ctx, k = 1) => { if ((drawn += k) < BATCH) return false; drawn = 0; ctx.getImageData(0, 0, 1, 1); return true; };
    const e = bySector.get(`${s.sx}_${s.sz}`) || { roads: [], areas: [], over: [], tone: [] };
    const [cv, ctx] = canvas(size, s);
    ctx.fillStyle = '#000';
    ctx.fillRect(s.x0, s.z0, S, S);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#f00';
    for (const a of e.areas) { ring(ctx, a); ctx.fill('evenodd'); if (due(ctx)) yield; }
    for (const r of e.roads) {
      if (r.s === 2 || r.s === 3) continue;
      ctx.strokeStyle = KERBED.has(r.type) && r.w >= 4.5 ? '#ff0' : '#f00';
      ctx.lineWidth = r.w;
      line(ctx, r.pts);
      ctx.stroke();
      if (due(ctx)) yield;
    }
    // gravel and dirt: the larger value where two meet ('lighten' keeps R and G as they are)
    ctx.globalCompositeOperation = 'lighten';
    for (const r of e.roads) {
      if (r.s !== 2 && r.s !== 3) continue;
      line(ctx, r.pts);
      if (r.w > RUTTED) { ctx.strokeStyle = '#00f'; ctx.lineWidth = r.w; ctx.stroke(); if (due(ctx)) yield; continue; }
      // the slope, in bands about 0.35 m apart (narrowest last), each the value at its middle: across the
      // road, and two bands outside it so that the edge (0.5) falls in the right place
      const h = r.w / 2, n = Math.max(2, Math.round(h / 0.35)), step = h / n;
      for (let i = -2; i < n; i++) {
        const d = h - i * step;
        ctx.strokeStyle = `rgb(0,0,${Math.round(255 * Math.max(0, 1 - (d - step / 2) / r.w))})`;
        ctx.lineWidth = 2 * d;
        ctx.stroke();
      }
      if (due(ctx, n + 2)) yield;
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const a of e.over) { ctx.fillStyle = a.cover; ring(ctx, a); ctx.fill('evenodd'); if (due(ctx)) yield; }
    ctx.getImageData(0, 0, 1, 1); drawn = 0;
    yield;
    const n2 = size / 2;
    const [tv, tctx] = canvas(n2, s);
    tctx.fillStyle = toneOf(null, false);
    tctx.fillRect(s.x0, s.z0, S, S);
    for (const r of e.roads) {
      if ((r.s !== 2 && r.s !== 3) || r.w > RUTTED) continue;
      tctx.strokeStyle = `rgb(${TONE0[0]},${TONE0[1]},${Math.round(r.w * 2)})`;
      tctx.lineWidth = r.w + 6;
      line(tctx, r.pts);
      tctx.stroke();
      if (due(tctx)) yield;
    }
    for (const a of e.areas) { tctx.fillStyle = toneOf(a.c, a.t === 2); ring(tctx, a); tctx.fill('evenodd'); if (due(tctx)) yield; }
    for (const r of e.roads) {
      if (r.s === 2 || r.s === 3) continue;
      tctx.strokeStyle = toneOf(r.c, r.s === 1);
      tctx.lineWidth = r.w + 2.5;
      line(tctx, r.pts);
      tctx.stroke();
      if (due(tctx)) yield;
    }
    for (const a of e.tone) { tctx.fillStyle = a.tone; ring(tctx, a); tctx.fill(); if (due(tctx)) yield; }
    tctx.getImageData(0, 0, 1, 1);
    yield;
    const img = ctx.getImageData(0, 0, size, size).data;
    const k = size / S;
    return {
      cover: texture(cv, true), tone: texture(tv, false),
      hard: (i, j) => img[(Math.floor((j + 0.5) * k) * size + Math.floor((i + 0.5) * k)) * 4] > 90,
    };
  }
  const paint = (s) => { const it = steps(s); let r; do r = it.next(); while (!r.done); return r.value; };
  paint.steps = steps;
  return paint;
}
