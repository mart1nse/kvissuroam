import { speedKmh } from './cars/physics.js';

const $ = (s) => document.querySelector(s);

export function createHud(world) {
  const elSpeed = $('#speed'), elGear = $('#gear'), elRpm = $('#rpm i'), elStreet = $('#street');
  const elName = $('#carname'), elToast = $('#toast');
  const map = $('#minimap');
  const ctx = map.getContext('2d');
  let spec = null, toastTimer = 0, streetTimer = 0, lastStreet = '';

  // spatial hash of named road segments for the street label
  const cell = 60;
  const grid = new Map();
  const roads = world.vectors.roads;
  roads.forEach((r, ri) => {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [x0, z0] = r.pts[i], [x1, z1] = r.pts[i + 1];
      const c0 = Math.floor(Math.min(x0, x1) / cell), c1 = Math.floor(Math.max(x0, x1) / cell);
      const r0 = Math.floor(Math.min(z0, z1) / cell), r1 = Math.floor(Math.max(z0, z1) / cell);
      for (let c = c0; c <= c1; c++) for (let rr = r0; rr <= r1; rr++) {
        const k = `${c},${rr}`;
        let l = grid.get(k);
        if (!l) grid.set(k, (l = []));
        l.push(ri, i);
      }
    }
  });

  function streetAt(x, z) {
    let best = 14, name = '';
    const c = Math.floor(x / cell), r = Math.floor(z / cell);
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      const l = grid.get(`${c + dc},${r + dr}`);
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
    for (const w of world.vectors.water) {
      for (const p of w.polys) {
        ctx.beginPath();
        p.outer.forEach(([x, z], i) => (i ? ctx.lineTo(x, z) : ctx.moveTo(x, z)));
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.lineCap = 'round';
    for (const r of roads) {
      const [ax, az] = r.pts[0];
      if (Math.abs(ax - car.x) > 420 || Math.abs(az - car.z) > 420) continue;
      const path = r.type === 'Rada' || r.type === 'Kergliiklustee';
      ctx.strokeStyle = path ? 'rgba(255,95,162,.45)' : 'rgba(255,225,245,.92)';
      ctx.lineWidth = Math.max(r.w, path ? 2 : 5);
      ctx.beginPath();
      r.pts.forEach(([x, z], i) => (i ? ctx.lineTo(x, z) : ctx.moveTo(x, z)));
      ctx.stroke();
    }
    // map edge
    ctx.strokeStyle = '#2ff3ff'; ctx.lineWidth = 4;
    const e = world.inner - 8;
    ctx.strokeRect(-e, -e, 2 * e, 2 * e);
    ctx.restore();
    // car marker
    ctx.fillStyle = '#ffd45e';
    ctx.beginPath();
    ctx.moveTo(R, R * 1.25 - 13); ctx.lineTo(R + 8, R * 1.25 + 9); ctx.lineTo(R, R * 1.25 + 4); ctx.lineTo(R - 8, R * 1.25 + 9);
    ctx.closePath(); ctx.fill();
  }

  return {
    setCar(s) { spec = s; elName.textContent = s.name.toUpperCase(); },
    toast(text, ms = 3200) {
      elToast.textContent = text;
      elToast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => elToast.classList.remove('show'), ms);
    },
    update(car) {
      elSpeed.textContent = Math.round(speedKmh(car));
      const ev = spec.engine.type === 'ev';
      elGear.textContent = car.reversing ? 'R' : ev ? 'D' : `D${car.gear}`;
      const frac = ev
        ? Math.min(1, Math.abs(car.vx) / (spec.limiter / 3.6)) * (car.throttle ? 1 : 0.4)
        : car.rpm / spec.engine.redline;
      elRpm.style.width = `${Math.round(Math.min(1, frac) * 100)}%`;
      if (--streetTimer <= 0) {
        streetTimer = 5;
        const name = streetAt(car.x, car.z);
        if (name !== lastStreet) { lastStreet = name; elStreet.textContent = name; }
        drawMap(car);
      }
    },
  };
}
