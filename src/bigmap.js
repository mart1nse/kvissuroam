// Full-screen city map. Drag to pan, pinch or scroll to zoom, tap or click a
// spot to drop the car there. North is up.

const PATH = new Set(['Rada', 'Kergliiklustee']);

export function createBigMap(world, { onPick, onClose }) {
  const root = document.querySelector('#bigmap');
  const cv = root.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const roads = world.vectors.roads;
  const bounds = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const [x, z] of world.meta.boundary) {
    bounds.x0 = Math.min(bounds.x0, x); bounds.x1 = Math.max(bounds.x1, x);
    bounds.z0 = Math.min(bounds.z0, z); bounds.z1 = Math.max(bounds.z1, z);
  }
  const boxes = roads.map((r) => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of r.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    return [x0, x1, z0, z1];
  });

  // view: world point (cx, cz) at the centre of the canvas, k pixels per metre
  let cx = 0, cz = 0, k = 0.1, kMin = 0.05, W = 1, H = 1, dpr = 1;
  let open = false, car = null, dirty = false;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = root.clientWidth; H = root.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    kMin = Math.min(W / (bounds.x1 - bounds.x0), H / (bounds.z1 - bounds.z0)) * 0.9;
  }
  function clamp() {
    k = Math.max(kMin, Math.min(4, k));
    cx = Math.max(bounds.x0, Math.min(bounds.x1, cx));
    cz = Math.max(bounds.z0, Math.min(bounds.z1, cz));
  }
  const toWorld = (px, py) => [cx + (px - W / 2) / k, cz + (py - H / 2) / k];
  const redraw = () => { if (!dirty) { dirty = true; requestAnimationFrame(draw); } };

  function draw() {
    dirty = false;
    if (!open) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#160735';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-cx, -cz);
    const [vx0, vz0] = toWorld(0, 0), [vx1, vz1] = toWorld(W, H);

    // drivable area
    ctx.beginPath();
    world.meta.boundary.forEach(([x, z], i) => (i ? ctx.lineTo(x, z) : ctx.moveTo(x, z)));
    ctx.closePath();
    ctx.fillStyle = '#2a0f5c'; ctx.fill();
    ctx.strokeStyle = '#2ff3ff'; ctx.lineWidth = 2.5 / k; ctx.stroke();

    ctx.fillStyle = 'rgba(47,160,255,.85)';
    for (const w of world.vectors.water) for (const p of w.polys) {
      ctx.beginPath();
      p.outer.forEach(([x, z], i) => (i ? ctx.lineTo(x, z) : ctx.moveTo(x, z)));
      ctx.closePath(); ctx.fill();
    }

    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const pass of [0, 1]) {            // paths under streets
      if (pass === 0 && k < 0.35) continue;
      ctx.beginPath();
      roads.forEach((r, i) => {
        if (PATH.has(r.type) !== (pass === 0)) return;
        const b = boxes[i];
        if (b[0] > vx1 || b[1] < vx0 || b[2] > vz1 || b[3] < vz0) return;
        if (pass === 1 && k < 0.12 && r.type === 'Tänav' && r.w < 6) return;   // thin out when zoomed far out
        r.pts.forEach(([x, z], j) => (j ? ctx.lineTo(x, z) : ctx.moveTo(x, z)));
      });
      ctx.strokeStyle = pass ? 'rgba(255,225,245,.9)' : 'rgba(255,95,162,.5)';
      ctx.lineWidth = pass ? Math.max(6, 1.4 / k) : Math.max(2, 1 / k);
      ctx.stroke();
    }
    ctx.restore();

    // street names when zoomed in
    if (k > 0.55) {
      ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd45e'; ctx.strokeStyle = '#160735'; ctx.lineWidth = 3;
      const used = new Set(), taken = [];
      roads.forEach((r, i) => {
        if (!r.name || PATH.has(r.type) || used.has(r.name) || r.name.includes('juurdepääsutee')) return;
        const b = boxes[i];
        if (b[0] > vx1 || b[1] < vx0 || b[2] > vz1 || b[3] < vz0) return;
        const m = r.pts[r.pts.length >> 1];
        const px = (m[0] - cx) * k + W / 2, py = (m[1] - cz) * k + H / 2;
        if (px < 30 || px > W - 30 || py < 50 || py > H - 12) return;
        const hw = ctx.measureText(r.name).width / 2 + 6;
        if (taken.some((t) => Math.abs(t[0] - px) < t[2] + hw && Math.abs(t[1] - py) < 16)) return;
        taken.push([px, py, hw]);
        used.add(r.name);
        ctx.strokeText(r.name, px, py); ctx.fillText(r.name, px, py);
      });
    }

    // home and car markers
    const mark = (x, z, fn) => { ctx.save(); ctx.translate((x - cx) * k + W / 2, (z - cz) * k + H / 2); fn(); ctx.restore(); };
    const s = world.meta.start;
    mark(s.x, s.z, () => {
      ctx.fillStyle = '#ff2bd6'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(9, 0); ctx.lineTo(6, 0); ctx.lineTo(6, 8); ctx.lineTo(-6, 8); ctx.lineTo(-6, 0); ctx.lineTo(-9, 0); ctx.closePath();
      ctx.fill(); ctx.stroke();
    });
    if (car) mark(car.x, car.z, () => {
      ctx.rotate(car.yaw);
      ctx.fillStyle = '#ffd45e'; ctx.strokeStyle = '#160735'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath();
      ctx.stroke(); ctx.fill();
    });
  }

  // ---- pointer handling: one finger pans, two fingers zoom, a short still press picks
  const pts = new Map();
  let moved = 0, downAt = 0, pinch = 0, multi = false;
  const zoomAt = (px, py, f) => {
    const [wx, wz] = toWorld(px, py);
    k = Math.max(kMin, Math.min(4, k * f));
    cx = wx - (px - W / 2) / k; cz = wz - (py - H / 2) / k;
    clamp(); redraw();
  };
  const local = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    cv.setPointerCapture?.(e.pointerId);
    pts.set(e.pointerId, local(e));
    if (pts.size === 1) { moved = 0; downAt = performance.now(); multi = false; }
    else { multi = true; pinch = 0; }
  });
  cv.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const q = local(e);
    if (pts.size === 1) {
      moved += Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (moved > 6) { cx -= (q[0] - p[0]) / k; cz -= (q[1] - p[1]) / k; clamp(); redraw(); }
      pts.set(e.pointerId, q);
    } else {
      pts.set(e.pointerId, q);
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch > 0 && d > 0) zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinch);
      pinch = d;
    }
  });
  const up = (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    pts.delete(e.pointerId);
    pinch = 0;
    if (e.type === 'pointerup' && !multi && pts.size === 0 && moved <= 6 && performance.now() - downAt < 700) {
      const [x, z] = toWorld(p[0], p[1]);
      onPick(x, z);
    }
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = local(e); zoomAt(x, y, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  root.querySelector('[data-map="close"]').addEventListener('click', () => onClose());
  root.querySelector('[data-map="in"]').addEventListener('click', () => zoomAt(W / 2, H / 2, 1.6));
  root.querySelector('[data-map="out"]').addEventListener('click', () => zoomAt(W / 2, H / 2, 1 / 1.6));
  addEventListener('resize', () => { if (open) { resize(); clamp(); redraw(); } });

  // Nearest drivable street to a world point: { x, z, yaw, d } or null.
  function nearestRoad(x, z, maxD = 80) {
    let best = maxD, hit = null;
    roads.forEach((r, i) => {
      if (PATH.has(r.type)) return;
      const b = boxes[i];
      if (x < b[0] - best || x > b[1] + best || z < b[2] - best || z > b[3] + best) return;
      for (let j = 0; j < r.pts.length - 1; j++) {
        const [x0, z0] = r.pts[j], [x1, z1] = r.pts[j + 1];
        const dx = x1 - x0, dz = z1 - z0;
        const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz || 1)));
        const d = Math.hypot(x - x0 - dx * t, z - z0 - dz * t);
        if (d < best) { best = d; hit = { x: x0 + dx * t, z: z0 + dz * t, yaw: Math.atan2(dx, -dz), d, w: r.w, name: r.name }; }
      }
    });
    return hit;
  }

  return {
    nearestRoad,
    get isOpen() { return open; },
    show(c) {
      car = c; open = true;
      root.classList.remove('hidden');
      resize();
      cx = c.x; cz = c.z; k = Math.max(kMin, Math.min(W, H) / 2400);   // about 2.4 km across the short side
      clamp(); pts.clear(); redraw();
    },
    hide() { open = false; pts.clear(); root.classList.add('hidden'); },
  };
}
