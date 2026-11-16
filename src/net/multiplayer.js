// Simple multiplayer: everyone who has the game open drives in the same world.
//
// No accounts. A browser gets a default name from the server (one nobody has finished a lap
// with) and keeps it in localStorage; it can be changed in the garage. Positions go through
// one WebSocket to the lobby on the server (worker/index.js), about ten times a second and only
// while somebody else is online. Other cars are drawn a little in the past and interpolated, with
// their name floating above them, and bump into ours: each browser pushes its own car out of
// the other one, so both sides see the same knock.
import * as THREE from 'three';
import { CARS } from '../cars/specs.js';
import { escapeHtml } from '../race/race.js';

const NAME_KEY = 'kvissuroam.name';
const PENDING_KEY = 'kvissuroam.pendingLaps';
const SEND_HZ = 10;
const DELAY = 0.15;              // seconds other cars are drawn behind real time
const RESTITUTION = 0.35;

const ADJ = ['Neon', 'Chrome', 'Turbo', 'Pastel', 'Laser', 'Sunset', 'Retro', 'Velvet', 'Cosmic', 'Digital'];
const NOUN = ['Otter', 'Falcon', 'Lynx', 'Comet', 'Dolphin', 'Palm', 'Flamingo', 'Tiger', 'Wave', 'Fox'];

function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }

export function createMultiplayer({ scene, camera, buildModel, toast, onBoard, onPeople }) {
  const others = new Map();      // id -> remote player
  let ws = null, myId = null, retry = 1, sendTimer = 0, board = null, online = false;
  let name = lsGet(NAME_KEY) || '';
  let carId = 'w201';
  const labels = document.createElement('div');
  labels.id = 'names';
  document.body.appendChild(labels);
  const nameReady = name ? Promise.resolve(name) : fetch('/api/name', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((j) => j.name)
    .catch(() => `${ADJ[Math.floor(Math.random() * ADJ.length)]}${NOUN[Math.floor(Math.random() * NOUN.length)]}${Math.floor(Math.random() * 90 + 10)}`)
    .then((n) => { if (!name) { name = n; lsSet(NAME_KEY, n); } return name; });

  fetch('/api/board', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((b) => { if (b && !board) setBoard(b); }).catch(() => {});

  function setBoard(b) { board = b; onBoard?.(b); }

  function send(m) { if (ws && ws.readyState === 1) ws.send(typeof m === 'string' ? m : JSON.stringify(m)); }

  async function connect() {
    await nameReady;
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws`;
    let sock;
    try { sock = new WebSocket(url); } catch { return schedule(); }
    ws = sock;
    let ping = 0;
    sock.onopen = () => {
      retry = 1; online = true;
      send({ t: 'hello', name, car: carId });
      ping = setInterval(() => send('ping'), 25000);
      flushLaps();
    };
    sock.onmessage = (e) => {
      if (e.data === 'pong') return;
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      onMessage(m);
    };
    sock.onclose = () => {
      clearInterval(ping);
      online = false;
      if (ws === sock) ws = null;
      for (const id of [...others.keys()]) drop(id);
      onPeople?.('count');
      schedule();
    };
    sock.onerror = () => {};
  }
  function schedule() {
    retry = Math.min(retry * 2, 60);
    setTimeout(connect, retry * 1000);
  }

  function add(p) {
    if (others.has(p.id) || p.id === myId) return others.get(p.id);
    const el = document.createElement('div');
    el.className = 'pname';
    el.textContent = p.name;
    labels.appendChild(el);
    const o = { id: p.id, name: p.name, car: null, model: null, el, buf: [], pose: null, wheel: 0 };
    others.set(p.id, o);
    setRemoteCar(o, p.car);
    return o;
  }
  function setRemoteCar(o, id) {
    if (!CARS[id]) id = 'w201';
    if (o.car === id) return;
    o.car = id;
    if (o.model) scene.remove(o.model.group);
    o.model = buildModel(id);
    o.model.group.rotation.order = 'YXZ';
    o.model.group.traverse((c) => { if (c.isMesh) c.castShadow = true; });
    o.model.group.visible = false;
    scene.add(o.model.group);
    const s = CARS[id];
    o.spec = s;
    o.off = s.wheelbase * s.cgFront - s.wheelbase / 2;
    o.halfLen = s.wheelbase / 2 + 0.85; o.halfWid = s.track / 2 + 0.13;
  }
  function drop(id) {
    const o = others.get(id);
    if (!o) return;
    if (o.model) scene.remove(o.model.group);
    o.el.remove();
    others.delete(id);
  }

  function onMessage(m) {
    switch (m.t) {
      case 's': {
        const o = others.get(m.id);
        if (o && Array.isArray(m.p)) {
          o.buf.push({ t: performance.now() / 1000, p: m.p });
          if (o.buf.length > 30) o.buf.shift();
        }
        break;
      }
      case 'welcome':
        myId = m.id;
        for (const p of m.players) add(p);
        onPeople?.('count');
        if (m.board) setBoard(m.board);
        break;
      case 'join':
        add(m);
        if (onPeople) onPeople('join', m.name); else toast(`${m.name.toUpperCase()} JOINED`, 2600);
        break;
      case 'leave': {
        const o = others.get(m.id);
        if (o) { if (onPeople) onPeople('leave', o.name); else toast(`${o.name.toUpperCase()} LEFT`, 1800); }
        drop(m.id);
        break;
      }
      case 'name': {
        const o = others.get(m.id);
        if (o) { onPeople?.('rename', m.name, o.name); o.name = m.name; o.el.textContent = m.name; }
        break;
      }
      case 'car': {
        const o = others.get(m.id);
        if (o) setRemoteCar(o, m.car);
        break;
      }
      case 'board':
        setBoard(m.board);
        if (m.lap && m.lap.name !== name) {
          const best = m.board.allTime.find((b) => b.car === m.lap.car);
          if (best && best.ms === m.lap.ms && best.name === m.lap.name) toast(`${m.lap.name.toUpperCase()} SET A ${CARS[m.lap.car]?.short.toUpperCase() ?? ''} RECORD`, 3000);
        }
        break;
      default:
    }
  }

  // ---- lap times
  function pending() { try { return JSON.parse(lsGet(PENDING_KEY)) || []; } catch { return []; } }
  let flushing = false;
  async function flushLaps() {
    if (flushing) return;
    const list = pending();
    if (!list.length) return;
    flushing = true;
    lsSet(PENDING_KEY, '[]');
    const keep = [];
    for (const lap of list) {
      try {
        const r = await fetch('/api/lap', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(lap) });
        if (r.ok) { const j = await r.json(); if (j.board) setBoard(j.board); }
        else if (r.status >= 500) keep.push(lap);
      } catch { keep.push(lap); }
    }
    lsSet(PENDING_KEY, JSON.stringify(keep.concat(pending())));
    flushing = false;
    if (keep.length) setTimeout(flushLaps, 30000);
  }

  // remote pose at render time, interpolated between the two updates around it
  function sample(o, now) {
    const b = o.buf;
    if (!b.length) return null;
    const t = now - DELAY;
    let i = b.length - 1;
    while (i > 0 && b[i - 1].t > t) i--;
    const B = b[i], A = b[i - 1];
    let p;
    if (A && t <= B.t) {
      const f = Math.max(0, Math.min(1, (t - A.t) / (B.t - A.t || 1)));
      p = A.p.map((v, k) => {
        if (k === 3 || k === 4 || k === 5 || k === 8) {            // angles
          let d = B.p[k] - v; d = Math.atan2(Math.sin(d), Math.cos(d));
          return v + d * f;
        }
        return v + (B.p[k] - v) * f;
      });
    } else {
      // past the newest update: carry on along its velocity for a moment
      const ahead = Math.min(0.35, t - B.t);
      p = B.p.slice();
      p[0] += p[6] * ahead; p[1] += p[7] * ahead;
    }
    if (now - B.t > 5) return null;                              // gone quiet
    return p;
  }

  // push our car out of anyone it overlaps; boxes as oriented rectangles (separating axis test)
  function collide(car) {
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
    for (const o of others.values()) {
      const p = o.pose;
      if (!p) continue;
      const dx = car.x - p[0], dz = car.z - p[1];
      if (dx * dx + dz * dz > 64 || Math.abs(car.y - p[2]) > 2.5) continue;
      const gx = Math.sin(p[3]), gz = -Math.cos(p[3]), sx = Math.cos(p[3]), sz = Math.sin(p[3]);
      const axes = [[fx, fz], [rx, rz], [gx, gz], [sx, sz]];
      let best = Infinity, nx = 0, nz = 0;
      for (const [ax, az] of axes) {
        const ra = car.halfLen * Math.abs(fx * ax + fz * az) + car.halfWid * Math.abs(rx * ax + rz * az);
        const rb = o.halfLen * Math.abs(gx * ax + gz * az) + o.halfWid * Math.abs(sx * ax + sz * az);
        const dist = dx * ax + dz * az;
        const pen = ra + rb - Math.abs(dist);
        if (pen <= 0) { best = -1; break; }
        if (pen < best) { best = pen; const sg = dist >= 0 ? 1 : -1; nx = ax * sg; nz = az * sg; }
      }
      if (best <= 0) continue;
      // half the overlap each (the other browser moves the other car)
      const push = Math.min(best, 1.5) * 0.5 + 0.01;
      car.x += nx * push; car.z += nz * push;
      const wvx = car.vx * fx + car.vy * rx, wvz = car.vx * fz + car.vy * rz;
      const vrel = (wvx - p[6]) * nx + (wvz - p[7]) * nz;
      if (vrel < 0) {
        const j = -(1 + RESTITUTION) * vrel * 0.5;                // equal masses, our half of the exchange
        const nvx = wvx + j * nx, nvz = wvz + j * nz;
        car.vx = nvx * fx + nvz * fz; car.vy = nvx * rx + nvz * rz;
        // a glancing knock off the car's centre line turns it a little
        const lever = (nx * rx + nz * rz) * (dx * fx + dz * fz);
        car.yawRate += Math.max(-1.5, Math.min(1.5, -lever * j * 0.08));
        car.hit = Math.max(car.hit, j);
      }
    }
  }

  const v3 = new THREE.Vector3();
  function update(car, dt, active) {
    const now = performance.now() / 1000;
    // send our position while anyone else is online
    sendTimer -= dt;
    if (active && others.size && sendTimer <= 0 && ws && ws.readyState === 1) {
      sendTimer = 1 / SEND_HZ;
      const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
      const r2 = (v) => Math.round(v * 100) / 100;
      const r3 = (v) => Math.round(v * 1000) / 1000;
      send({ t: 's', p: [r2(car.x), r2(car.z), r2(car.y), r3(car.yaw), r3(car.pitch), r3(car.roll),
        r2(car.vx * fx + car.vy * rx), r2(car.vx * fz + car.vy * rz), r3(car.steer), car.brake > 0 ? 1 : 0, car.reversing ? 1 : 0] });
    }
    const W = innerWidth, H = innerHeight;
    for (const o of others.values()) {
      o.pose = sample(o, now);
      const g = o.model?.group;
      if (!g) continue;
      if (!o.pose) { g.visible = false; o.el.style.display = 'none'; continue; }
      const p = o.pose;
      const fx = Math.sin(p[3]), fz = -Math.cos(p[3]);
      g.visible = true;
      g.position.set(p[0] + fx * o.off, p[2], p[1] + fz * o.off);
      g.rotation.set(p[4], -p[3], -p[5]);
      const w = o.model.wheels;
      const speed = p[6] * fx + p[7] * fz;
      o.wheel += (speed / (o.spec.wheelRadius || 0.32)) * dt;
      if (w) {
        w.fl.steer.rotation.y = w.fr.steer.rotation.y = -p[8];
        w.fl.spin.rotation.x = w.fr.spin.rotation.x = w.rl.spin.rotation.x = w.rr.spin.rotation.x = -o.wheel;
      }
      o.model.setLights?.({ brake: !!p[9], reverse: !!p[10], headlights: true });
      // floating name
      v3.set(p[0], p[2] + 2.2, p[1]);
      const dist = v3.distanceTo(camera.position);
      v3.project(camera);
      if (v3.z > 1 || dist > 600 || Math.abs(v3.x) > 1.1 || Math.abs(v3.y) > 1.1) { o.el.style.display = 'none'; continue; }
      o.el.style.display = '';
      const sc = Math.max(0.55, Math.min(1.2, 28 / dist));
      o.el.style.transform = `translate(${((v3.x + 1) / 2) * W}px, ${((1 - v3.y) / 2) * H}px) translate(-50%, -100%) scale(${sc.toFixed(2)})`;
    }
  }

  connect();

  return {
    update,
    collide,
    get name() { return name; },
    get online() { return online; },
    get count() { return others.size; },
    nameReady,
    // everyone else online, including those who have not sent a position yet
    roster() { return [...others.values()].map((o) => ({ name: o.name, car: o.car, x: o.pose?.[0], z: o.pose?.[1] })); },
    players() { return [...others.values()].filter((o) => o.pose).map((o) => ({ name: o.name, x: o.pose[0], z: o.pose[1], yaw: o.pose[3] })); },
    setName(n) {
      n = String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
      if (!n || n === name) return name;
      name = n; lsSet(NAME_KEY, n);
      send({ t: 'name', name: n });
      return name;
    },
    setCar(id) { if (id === carId) return; carId = id; send({ t: 'car', car: id }); },
    submitLap(lap) {
      const list = pending();
      list.push({ name, car: lap.car, ms: lap.ms, at: lap.at });
      lsSet(PENDING_KEY, JSON.stringify(list.slice(-50)));
      flushLaps();
    },
    get board() { return board; },
    bestFor(id) {
      const b = board?.allTime?.find((r) => r.car === id);
      return b ? { ms: b.ms, name: b.name } : null;
    },
    labelHtml: escapeHtml,
  };
}
