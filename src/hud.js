import { speedKmh } from './cars/physics.js';

const $ = (s) => document.querySelector(s);

// The tyre icons (Martin 2026-11-23): the tread seen from the front. Road: a wide tyre with straight
// grooves. Gravel: a narrower one with chunky staggered blocks.
export function tyreIcon(kind) {
  if (kind === 'gravel') {
    let b = '';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 2; c++) b += `<rect x="${(r % 2 ? 8.6 : 7.6) + c * 4.2}" y="${3.3 + r * 3.6}" width="2.8" height="2.4" rx=".5"/>`;
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="t" x="6.2" y="1.6" width="11.6" height="20.8" rx="3.2"/><g class="b">${b}</g></svg>`;
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="t" x="4.6" y="1.6" width="14.8" height="20.8" rx="3"/><path class="g" d="M9.6 3.2v17.6M14.4 3.2v17.6"/></svg>`;
}

export function createHud(world) {
  const elSpeed = $('#speed'), elGear = $('#gear'), elStreet = $('#street');
  const elName = $('#carname'), elToast = $('#toast'), elTyre = $('#tyre');
  const map = $('#minimap');
  const ctx = map.getContext('2d');
  let spec = null, toastTimer = 0, streetTimer = 0, lastStreet = '';
  let overlay = null;
  const face = $('#dial .face'), needle = $('#dial .needle');
  let dialMax = 8000, dialRed = 7000, needleShown = -999, needleV = 0, needleDrawn = -999, needleHot = false;

  // The round rev counter: 270 degrees from bottom left round to bottom right, numbers in thousands,
  // red from the rev limiter on (an EV: the motor's top speed).
  const SWEEP = 270, A0 = -135;
  const ang = (rpm) => A0 + SWEEP * Math.min(1, Math.max(0, rpm / dialMax));
  function buildDial(e) {
    const red = e.type === 'ev' ? e.maxRpm || 16000 : e.redline;
    const step = red > 10000 ? 2000 : 1000;
    dialRed = red;
    dialMax = Math.ceil((red + 1) / step) * step;
    if (dialMax - red < step * 0.6) dialMax += step;     // always a clear stretch of red past the limiter
    const pt = (a, r) => { const t = (a * Math.PI) / 180; return [(Math.sin(t) * r).toFixed(2), (-Math.cos(t) * r).toFixed(2)]; };
    const arc = (a0, a1, r) => { const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r); return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`; };
    let svg = `<path class="ring" d="${arc(A0, A0 + SWEEP, 92)}"/><path class="red" d="${arc(ang(red), A0 + SWEEP, 87.5)}"/>`;
    const minor = step / 4;
    for (let v = 0; v <= dialMax + 1; v += minor) {
      const major = v % step === 0, mid = !major && v % (step / 2) === 0;
      const [x0, y0] = pt(ang(v), 92), [x1, y1] = pt(ang(v), major ? 78 : mid ? 84 : 87);
      svg += `<line class="tick" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke-width="${major ? 3.2 : mid ? 2 : 1.3}"/>`;
      if (major) {
        const [tx, ty] = pt(ang(v), 66);
        svg += `<text x="${tx}" y="${ty}"${v >= red ? ' class="hot"' : ''}>${v / 1000}</text>`;
      }
    }
    svg += `<text class="x1000" x="0" y="45">×1000 RPM</text>`;
    face.innerHTML = svg;
    needleShown = -999;
  }            // extra drawing in world coordinates (race track, other players)

  // spatial hash of named road segments for the street label
  // (cells are found by a number, and the map below is drawn with plain loops: 225 text keys and a small
  // function call per road point, sixteen times a second, were 100 MB of garbage a lap, 22 Nov 2026)
  const cell = 60, cellKey = (c, r) => (c + 4096) * 8192 + r + 4096;
  const grid = new Map();
  const roads = world.vectors.roads;
  roads.forEach((r, ri) => {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [x0, z0] = r.pts[i], [x1, z1] = r.pts[i + 1];
      const c0 = Math.floor(Math.min(x0, x1) / cell), c1 = Math.floor(Math.max(x0, x1) / cell);
      const r0 = Math.floor(Math.min(z0, z1) / cell), r1 = Math.floor(Math.max(z0, z1) / cell);
      for (let c = c0; c <= c1; c++) for (let rr = r0; rr <= r1; rr++) {
        const k = cellKey(c, rr);
        let l = grid.get(k);
        if (!l) grid.set(k, (l = []));
        l.push(ri, i);
      }
    }
  });

  const seen = new Set();
  const waterPolys = [];
  for (const w of world.vectors.water) {
    for (const p of w.polys) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z] of p.outer) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
      waterPolys.push({ outer: p.outer, minX, maxX, minZ, maxZ });
    }
  }

  function streetAt(x, z) {
    let best = 14, name = '';
    const c = Math.floor(x / cell), r = Math.floor(z / cell);
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      const l = grid.get(cellKey(c + dc, r + dr));
      if (!l) continue;
      for (let k = 0; k < l.length; k += 2) {
        const road = roads[l[k]];
        if (!road.name) continue;
        const [x0, z0] = road.pts[l[k + 1]], [x1, z1] = road.pts[l[k + 1] + 1];
        const dx = x1 - x0, dz = z1 - z0;
        const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz || 1)));
        const d = Math.hypot(x - x0 - dx * t, z - z0 - dz * t) - road.w / 2;
        if (d < best) { best = d; name = road.name; }
      }
    }
    return name;
  }

  const trace = (pts) => { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
  function drawMap(car) {
    const n = map.width, R = n / 2, scale = R / 170;    // 170 m radius, heading up
    ctx.clearRect(0, 0, n, n);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R, 0, 7); ctx.clip();
    ctx.fillStyle = 'rgba(24,8,56,.78)';
    ctx.fillRect(0, 0, n, n);
    ctx.translate(R, R * 1.25);
    ctx.rotate(-car.yaw);
    ctx.scale(scale, scale);
    ctx.translate(-car.x, -car.z);
    ctx.fillStyle = 'rgba(47,160,255,.85)';
    for (const p of waterPolys) {
      if (p.minX > car.x + 420 || p.maxX < car.x - 420 || p.minZ > car.z + 420 || p.maxZ < car.z - 420) continue;
      ctx.beginPath();
      trace(p.outer);
      ctx.closePath();
      ctx.fill();
    }
    ctx.lineCap = 'round';
    seen.clear();
    const c0 = Math.floor(car.x / cell), r0 = Math.floor(car.z / cell);
    for (let dc = -7; dc <= 7; dc++) for (let dr = -7; dr <= 7; dr++) {
      const l = grid.get(cellKey(c0 + dc, r0 + dr));
      if (l) for (let k = 0; k < l.length; k += 2) seen.add(l[k]);
    }
    for (const ri of seen) {
      const r = roads[ri];
      const path = r.type === 'Rada' || r.type === 'Kergliiklustee';
      ctx.strokeStyle = path ? 'rgba(255,95,162,.45)' : 'rgba(255,225,245,.92)';
      ctx.lineWidth = Math.max(r.w, path ? 2 : 5);
      ctx.beginPath();
      trace(r.pts);
      ctx.stroke();
    }
    // map edge
    ctx.strokeStyle = '#2ff3ff'; ctx.lineWidth = 4;
    ctx.beginPath();
    trace(world.meta.boundary);
    ctx.stroke();
    overlay?.(ctx, scale, car);
    ctx.restore();
    // car marker
    ctx.fillStyle = '#ffd45e';
    ctx.beginPath();
    ctx.moveTo(R, R * 1.25 - 13); ctx.lineTo(R + 8, R * 1.25 + 9); ctx.lineTo(R, R * 1.25 + 4); ctx.lineTo(R - 8, R * 1.25 + 9);
    ctx.closePath(); ctx.fill();
    // north: the map turns with the car, so an N with a thin white needle rides round the rim
    const na = -car.yaw, nx = Math.sin(na), ny = -Math.cos(na);
    ctx.save();
    ctx.translate(R + nx * (R - 40), R + ny * (R - 40));
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#160735'; ctx.lineWidth = 7; ctx.lineJoin = 'round';
    ctx.font = '900 40px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeText('N', 0, 2); ctx.fillText('N', 0, 2);
    ctx.rotate(na);
    ctx.fillStyle = '#fff'; ctx.lineWidth = 3;      // a very narrow white needle, unlike the players' arrows
    ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(3.5, -21); ctx.lineTo(-3.5, -21); ctx.closePath();
    ctx.stroke(); ctx.fill();
    ctx.restore();
  }

  return {
    setOverlay(fn) { overlay = fn; },
    setTyres(kind) {
      if (!elTyre) return;
      elTyre.innerHTML = tyreIcon(kind);
      elTyre.className = kind === 'gravel' ? 'gravel' : 'road';
      elTyre.setAttribute('aria-label', kind === 'gravel' ? 'Gravel tyres: change to road tyres' : 'Road tyres: change to gravel tyres');
    },
    setCar(s) { spec = s; elName.textContent = s.name.toUpperCase(); buildDial(s.engine); },
    toast(text, ms = 3200) {
      elToast.textContent = text;
      elToast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => elToast.classList.remove('show'), ms);
    },
    // The needle moves every frame (the numbers only a few times a second), eased like a real needle
    // with a little mass, so the limiter bounce and the shifts sweep instead of jumping.
    needle(car, dt) {
      const want = ang(car.rpm || 0);
      if (needleShown < -900) { needleShown = want; needleV = 0; }
      // (a critically damped spring, about 50 ms to settle)
      const w = 38, n = Math.ceil(Math.min(dt, 0.1) * 240), h = Math.min(dt, 0.1) / n;
      for (let i = 0; i < n; i++) {
        needleV += (-w * w * (needleShown - want) - 2 * w * needleV) * h;
        needleShown += needleV * h;
      }
      if (Math.abs(needleShown - needleDrawn) > 0.05) {
        needleDrawn = needleShown;
        needle.setAttribute('transform', `rotate(${needleShown.toFixed(2)})`);
      }
      const hot = (car.rpm || 0) >= dialRed - 50;
      if (hot !== needleHot) { needleHot = hot; needle.classList.toggle('hot', hot); }
    },
    update(car) {
      elSpeed.textContent = Math.round(speedKmh(car));
      const ev = spec.engine.type === 'ev';
      // (M: a gear picked by hand with A / Z, held until the shift point)
      elGear.textContent = car.reversing ? 'R' : ev ? 'D' : `${car.manual ? 'M' : 'D'}${car.gear}`;
      if (--streetTimer <= 0) {
        streetTimer = 5;
        const name = streetAt(car.x, car.z);
        if (name !== lastStreet) { lastStreet = name; elStreet.textContent = name; }
        drawMap(car);
      }
    },
  };
}
