// Simple multiplayer: everyone who has the game open drives in the same world.
//
// No accounts. A browser gets a default name from the server (one nobody has finished a lap
// with) and keeps it in localStorage; it can be changed in the garage. Positions go through
// one WebSocket to the lobby on the server (worker/index.js), about ten times a second and only
// while somebody else is online. Other cars are drawn a little in the past and interpolated, with
// their name floating above them, and bump into ours: each browser pushes its own car out of
// the other one, so both sides see the same knock. Except on a hotlap: a car whose lap timer is
// running tells the others so (flag 8), wears a glow and a HOTLAP tag on their screens, and no car
// bumps into it or is bumped by it, on either side, so nobody can spoil a lap in progress.
import * as THREE from 'three';
import { CARS } from '../cars/specs.js';
import { escapeHtml, fmtTime } from '../race/race.js';
import { STEALTH } from './stealth.js';
import { KUDOS_GAP_S } from '../kudos.js';

const NAME_KEY = 'kvissuroam.name';
const PENDING_KEY = 'kvissuroam.pendingLaps';
const SENT_KEY = 'kvissuroam.sentLaps';      // laps the server has confirmed, as car|ms
const SEND_HZ = 10;
// With nobody within LONELY metres of our car, our position goes out SEND_HZ_FAR times a second: to the
// others we are then at most a block on the horizon or an arrow on the map. Each message a player sends
// counts against the server's free daily allowance (Cloudflare counts 20 incoming messages as one request,
// 100 000 a day), and the server passes every one on to everybody else.
const SEND_HZ_FAR = 3, LONELY = 600;
// and SEND_HZ only with another car within CLOSE metres (near enough to bump, or to be seen whole), else
// SEND_HZ_MID: half the messages for players spread round the map (the server's limit is about 1,000 a
// second in all, 100 players at ten each; Martin 2026-11-24)
const SEND_HZ_MID = 5, CLOSE = 150;
const DELAY = 0.15;              // seconds other cars are drawn behind real time
// (in bundles, a position waits up to one bundle, 0.1 s, at the server before it is passed on, so the
// cars are drawn a little further back: then there is nearly always a newer position to glide towards)
const DELAY_BUNDLED = 0.21;
const RESTITUTION = 0.35;
const MAX_OTHERS = 150;
const AWAY_S = 30;              // a driver who steps into the garage, the menu or another tab still counts this long (Martin, 2026-11-22)
const HOT = 8;                   // flag: this car's lap timer is running
const STAMP = 21;                // position's slot for when it was taken (see addPose)
// Many players online (Martin 2026-11-23: 22 online felt laggy, and the names crowded the road). A car
// past DETAIL metres is a small block in its paint colour, all such blocks one draw call (a whole car is
// 11-12 pieces of 50-75 thousand triangles, a few pixels tall that far away); past FAR it is not drawn at
// all (the map arrows and the list still show it). Names float over the TAGS nearest within TAG_DIST.
const DETAIL = 110, DETAIL_LOW = 75;
const FAR = 900;
const TAG_DIST = 150, TAGS = 6, TAGS_LOW = 4;   // (was every car within 600 m); a name that would cover a nearer one is left out
const SHADOW_DIST = 60;          // only cars this near cast a shadow
// Phones (Martin 2026-11-24, getting ready for 50 and more online): each kind of car another player drives
// is built once on this page (its template, about 16 MB on the graphics card and 19 MB of memory), and 22
// players in 12 kinds of car added some 400 MB on an emulated phone, more than an iPhone has to spare. On
// a phone a car is built only once it comes within LEAN_NEAR metres, and at most LEAN_KINDS kinds; any
// other is a block in the player's map colour.
const LEAN_NEAR = 120, LEAN_KINDS = 3;
// what the server does to a name (worker/index.js cleanName), so the name box shows what the others see
const cleanName = (s) => String(s || '').normalize('NFC')
  .replace(/[\u0000-\u001f\u007f-\u009f<>\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/g, '')
  .replace(/(\p{M}{2})\p{M}+/gu, '$1')
  .replace(/\s+/g, ' ').trim().slice(0, 20).trim();
// a position from another browser: numbers only (the server checks too; a word in here used to stop the picture)
const poseOk = (p) => Array.isArray(p) && p.length >= 9 && p.length <= 24 && p.every((v) => typeof v === 'number' && Number.isFinite(v));

const ADJ = ['Neon', 'Chrome', 'Turbo', 'Pastel', 'Laser', 'Sunset', 'Retro', 'Velvet', 'Cosmic', 'Digital'];
const NOUN = ['Otter', 'Falcon', 'Lynx', 'Comet', 'Dolphin', 'Palm', 'Flamingo', 'Tiger', 'Wave', 'Fox'];

const KUDOS_KEY = 'kvissuroam.kudos';
function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }

// The glow under a car on a hotlap: one soft rounded outline, drawn once and shared by every such car.
let haloParts = null;
function haloMesh() {
  if (!haloParts) {
    const W = 128, H = 256, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const box = (inset, r) => { g.beginPath(); g.roundRect(inset, inset, W - inset * 2, H - inset * 2, r); };
    g.shadowColor = '#ff2bd6'; g.shadowBlur = 22;
    g.strokeStyle = 'rgba(255, 43, 214, .9)'; g.lineWidth = 10; box(26, 34); g.stroke();
    g.shadowBlur = 6; g.shadowColor = '#ffffff';
    g.strokeStyle = 'rgba(255, 214, 248, .95)'; g.lineWidth = 3; box(26, 34); g.stroke();
    g.shadowBlur = 0;
    const fill = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, H / 2);
    fill.addColorStop(0, 'rgba(138, 63, 252, .30)'); fill.addColorStop(1, 'rgba(255, 43, 214, .12)');
    g.fillStyle = fill; box(30, 30); g.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      fog: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    haloParts = { geo, mat };
  }
  const m = new THREE.Mesh(haloParts.geo, haloParts.mat);
  m.renderOrder = 2;
  m.frustumCulled = false;
  return m;
}

// The far stand-in: a car body and a cabin, unit sized (scaled per car to its length, width and height),
// coloured per car. One InstancedMesh for every far car; made with the game, so its shader is compiled at
// loading and not while driving.
function farCars(scene, max) {
  const body = new THREE.BoxGeometry(1, 0.5, 1); body.translate(0, 0.3, 0);
  const cab = new THREE.BoxGeometry(0.84, 0.42, 0.5); cab.translate(0, 0.76, 0.06);
  const pos = [...body.attributes.position.array, ...cab.attributes.position.array];
  const nor = [...body.attributes.normal.array, ...cab.attributes.normal.array];
  const idx = [...body.index.array, ...cab.index.array.map((i) => i + body.attributes.position.count)];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  body.dispose(); cab.dispose();
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), max);
  mesh.name = 'remote far cars';
  mesh.setColorAt(0, new THREE.Color(0xffffff));
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;            // (spread over the whole map; one draw call either way)
  scene.add(mesh);
  return mesh;
}
// a car's paint colour, for its far stand-in (the body's paint piece, else a quiet grey)
function paintOf(model) {
  let c = null;
  model.group.traverse((m) => { if (!c && m.isMesh && /_paint$|paint/i.test(m.name) && m.material?.color) c = m.material.color; });
  return c ? c.clone() : new THREE.Color(0x9a94a8);
}

// stage: true where the Raadi rally stage is on (?raadi=1): only then are its records announced
export function createMultiplayer({ scene, camera, buildModel, modelReady = () => true, toast, onBoard, onPeople, onRace, onRecord, onKudos, hotlap = () => false, racing = () => false, stage = false, low = () => false, lean = () => false, warm = null }) {
  const others = new Map();      // id -> remote player
  // every id this page has had: after a reconnect the server may still hold our old connection for a
  // while, and must not show up as another driver (or later as "left", with the chime)
  const mine = new Set();
  let bundled = false;           // this connection's server sends positions in bundles
  let myWn = 0;                  // spectators watching our car (the server's count)
  let holdId = null;             // the car we spectate: drawn parked where it was last heard of when it goes quiet
  let ws = null, myId = null, ticket = null, retry = 1, sendTimer = 0, shiftHold = 0, cutHold = 0, board = null, online = false;
  let name = lsGet(NAME_KEY) || '';
  // the server's clock (the online race: src/race/racemode.js): offset from Date.now(), from the
  // quickest of the recent round trips
  let clockOff = 0, clockRtt = Infinity, clockTimer = 0, driving = false, drvOff = 0;
  let where = '';                // map | garage | away (another tab) | watch: shown to the others (Martin, 2026-11-23)
  let whereOn = '';              // with 'watch': the id of the player we follow as a spectator
  // until the race state has come on this connection, each clock question also asks for it (r: 1):
  // a browser that missed it on joining otherwise had no race button until somebody voted
  let raceSeen = false;
  const kudosAt = new Map();     // id -> when we last sent them a thumbs up (seconds)
  // thumbs up we got today (each other player's: o.kn, o.kf, from the server). Kept in this browser until
  // midnight (Martin, 2026-11-24: a reload or a lost connection kept nothing) and told to the server in every
  // hello, so after a reconnect the others see the same count we do.
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const myKudos = (() => { try { const v = JSON.parse(lsGet(KUDOS_KEY)); if (v?.day === today() && Number.isInteger(v.kn)) return { kn: v.kn, kf: Array.isArray(v.kf) ? v.kf.filter((x) => typeof x === 'string').slice(-24) : [] }; } catch { /* none */ } return { kn: 0, kf: [] }; })();
  const saveKudos = () => lsSet(KUDOS_KEY, JSON.stringify({ day: today(), kn: myKudos.kn, kf: myKudos.kf }));
  const clockAsk = () => send(raceSeen ? { t: 'clock', c: Date.now() } : { t: 'clock', c: Date.now(), r: 1 });
  let carId = 'w201';
  const far = farCars(scene, MAX_OTHERS);
  const fm = new THREE.Matrix4(), fq = new THREE.Quaternion(), fe = new THREE.Euler(0, 0, 0, 'YXZ'), fp = new THREE.Vector3(), fs = new THREE.Vector3();
  const tagList = [], boxes = [];
  const labels = document.createElement('div');
  labels.id = 'names';
  document.body.appendChild(labels);
  const nameReady = name ? Promise.resolve(name) : fetch('/api/name', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((j) => j.name)
    .catch(() => `${ADJ[Math.floor(Math.random() * ADJ.length)]}${NOUN[Math.floor(Math.random() * NOUN.length)]}${Math.floor(Math.random() * 90 + 10)}`)
    .then((n) => { if (!name) { name = n; lsSet(NAME_KEY, n); } return name; });

  fetch('/api/board', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((b) => { if (b && !board) setBoard(b); }).catch(() => {});

  // the lap ticket the page asked for as it opened (index.html); without one the first hello gets one
  const ticketReady = Promise.resolve(window.__lapTicket).then((k) => { if (typeof k === 'string' && !ticket) ticket = k; }).catch(() => {});

  // lap records set while we are online (Martin 2026-11-21): name -> { car, t }; the name carries an
  // "M3 LAP RECORD" tag in the online list and over the car for REC_MS, while the record stands
  const REC_MS = 15 * 60000;
  const recs = new Map();
  const lastLaps = new Map();       // name -> { ms, car, t }: each player's newest lap on the board, for a spectator's view
  function setBoard(b) {
    board = b;
    for (const [n, r] of recs) { const best = b.allTime?.find((x) => x.car === r.car); if (!best || best.name !== n) recs.delete(n); }
    onBoard?.(b);
  }
  // with the lap's time after it (Martin 2026-11-23): "22B STI LAP RECORD 1:23.45"
  function recOf(n) {
    const r = recs.get(n);
    if (!r) return null;
    if (Date.now() - r.t > REC_MS) { recs.delete(n); return null; }
    return r;
  }
  function recordOf(n) {
    const r = recOf(n);
    if (!r) return '';
    return `${Object.hasOwn(CARS, r.car) ? CARS[r.car].short.toUpperCase() : ''} LAP RECORD${Number.isFinite(r.ms) ? ` ${fmtTime(r.ms / 1000)}` : ''}`;
  }
  // the record's time alone ('' for none), for the phone's narrow list
  function recordTime(n) {
    const r = recOf(n);
    return r && Number.isFinite(r.ms) ? fmtTime(r.ms / 1000) : '';
  }

  function send(m) { if (ws && ws.readyState === 1) ws.send(typeof m === 'string' ? m : JSON.stringify(m)); }

  async function connect() {
    await nameReady;
    await ticketReady;
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws`;
    let sock;
    try { sock = new WebSocket(url); } catch { return schedule(); }
    ws = sock;
    let ping = 0;
    sock.onopen = () => {
      retry = 1; online = true; raceSeen = false; bundled = false;
      // b: 1, everyone's positions in one message ten times a second (see TICK in worker/index.js)
      send({ t: 'hello', b: 1, name, car: carId, k: ticket || undefined, ghost: STEALTH ? 1 : undefined, w: where || undefined, on: whereOn || undefined, kn: myKudos.kn || undefined, kf: myKudos.kn ? myKudos.kf : undefined });
      ping = setInterval(() => send('ping'), 25000);
      clockRtt = Infinity;
      clockAsk(); setTimeout(clockAsk, 1500); setTimeout(clockAsk, 4000);
      clearInterval(clockTimer); clockTimer = setInterval(() => { clockRtt *= 1.5; clockAsk(); }, 20000);
      if (driving && !STEALTH) send({ t: 'drv', on: 1 });
      flushLaps();
    };
    sock.onmessage = (e) => {
      if (e.data === 'pong') return;
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      onMessage(m);
    };
    sock.onclose = (e) => {
      clearInterval(ping); clearInterval(clockTimer);
      online = false;
      if (ws === sock) ws = null;
      for (const id of [...others.keys()]) drop(id);
      // the server was full and we sat in the garage, the menu or another tab for over 2 minutes: our place
      // went to someone waiting, and we join again the moment we are back on the map (see setWhere)
      released = e?.code === 4002 && where !== 'map' && where !== 'watch';
      onPeople?.('count');
      if (released) clearTimeout(wsRetry); else schedule();
    };
    sock.onerror = () => {};
  }
  // back again soon after a lost connection (a deploy cuts everyone off for a few seconds): waits of 2,
  // 4, 8 and then 15 s, and at once when the network or the tab comes back (Martin, 2026-11-23: offline
  // for up to a minute after a deploy, while the game looked as if nothing was wrong)
  let wsRetry = 0;
  // The server full (100 online, Martin 2026-11-24): drive offline and ask again every 20 to 40 s (spread,
  // so a freed place is not fought over by everyone waiting at the same moment).
  let full = false;
  let released = false;
  function schedule() {
    retry = Math.min(retry * 2, 15);
    clearTimeout(wsRetry);
    wsRetry = setTimeout(() => { wsRetry = 0; connect(); }, full ? 20000 + Math.random() * 20000 : retry * 1000);
  }
  const soon = () => { if (wsRetry && !document.hidden) { clearTimeout(wsRetry); wsRetry = 0; connect(); } };
  addEventListener('online', soon);
  document.addEventListener('visibilitychange', soon);

  // each player's own map arrow colour: the first one nobody online has, kept while they stay
  // (no yellow: our own car; no pink: the race track; no blue: water; no white: the north needle)
  const COLOURS = ['#2ff3ff', '#7dff5a', '#ff9a3c', '#c08bff', '#ff5a6e', '#3cffb4'];
  const freeColour = () => {
    const used = new Set([...others.values()].map((o) => o.colour));
    return COLOURS.find((c) => !used.has(c)) || COLOURS[others.size % COLOURS.length];
  };
  function add(p) {
    if (others.has(p.id) || p.id === myId || mine.has(p.id)) return others.get(p.id);
    if (typeof p.id !== 'string' || typeof p.name !== 'string' || others.size >= MAX_OTHERS) return null;
    const el = document.createElement('div');
    el.className = 'pname';
    el.textContent = p.name;
    el.style.display = 'none';
    labels.appendChild(el);
    const o = { id: p.id, name: p.name, colour: freeColour(), car: null, model: null, modelCar: null, el, tagOn: false, buf: [], pose: null, wheel: 0, w: typeof p.w === 'string' ? p.w : '', wn: Number.isInteger(p.wn) ? p.wn : 0,
      kn: Number.isInteger(p.kn) ? p.kn : 0, kf: Array.isArray(p.kf) ? p.kf.filter((x) => typeof x === 'string').slice(-24) : [] };
    others.set(p.id, o);
    setRemoteCar(o, p.car);
    return o;
  }
  // Which car they drive. The first car of a kind is slow to build, so it is built away from the page
  // as soon as they pick it (see requestCarModel in cars/models/index.js), and their copy of it is made
  // only once they drive it (see update): someone who has just come online sits in the menu for a while
  // and may look through several cars in the garage.
  function setRemoteCar(o, id) {
    if (typeof id !== 'string' || !Object.hasOwn(CARS, id)) id = 'w201';
    if (o.car === id) return;
    o.car = id;
    const s = CARS[id];
    o.spec = s;
    o.off = s.wheelbase * s.cgFront - s.wheelbase / 2;
    o.halfLen = s.halfLen ?? s.wheelbase / 2 + 0.85; o.halfWid = s.halfWid ?? s.track / 2 + 0.13;
    o.plain = null;
    if (!lean()) modelReady(id, false);               // (a phone waits until the car comes near: see LEAN_NEAR)
  }
  // may this page build (or has it built) this kind of car? Always, except on a phone over LEAN_KINDS
  const kinds = new Set();
  function kindOk(id) {
    if (!lean() || kinds.has(id)) return true;
    if (kinds.size >= LEAN_KINDS) return false;
    kinds.add(id);
    return true;
  }
  // a car's see-through copies, when it is taken away
  function dropFade(o) {
    for (const e of o.model?.fade?.list || []) if (!e.mine) e.copy?.dispose();
    o.halo?.material.dispose();
  }
  function showModel(o) {
    if (o.model) { scene.remove(o.model.group); dropFade(o); }
    o.modelCar = o.car;
    o.halo = null;
    o.model = buildModel(o.car);
    o.model.group.rotation.order = 'YXZ';
    o.model.group.userData.remoteCar = true;
    o.model.group.traverse((c) => { if (c.isMesh) c.castShadow = true; });
    o.shadow = true;
    o.model.group.visible = false;
    o.paint = paintOf(o.model);
    o.near = false;                       // in the scene, drawn whole (else the far stand-in, or nothing)
  }
  // a whole car in or out of the scene (out, its pieces cost nothing a frame, not even their places)
  function setNear(o, on) {
    if (o.near === on) return;
    o.near = on;
    if (on) scene.add(o.model.group); else scene.remove(o.model.group);
  }
  // a label's place and size, written only when it changes
  function showTag(o, on, tf) {
    if (o.tagOn !== on) { o.tagOn = on; o.el.style.display = on ? '' : 'none'; }
    if (on && tf !== o.tf) { o.tf = tf; o.el.style.transform = tf; }
  }
  // somebody is watching our car as a spectator (src/spectate.js)
  // (the server tells everyone each player's spectator count, never who watches whom)
  function watchedNow() { return myWn > 0; }
  function drop(id) {
    const o = others.get(id);
    if (!o) return;
    if (o.model) { scene.remove(o.model.group); dropFade(o); }
    o.el.remove();
    o.dropped = true;
    others.delete(id);
  }

  // A position into a car's list, never before the last one. Where it belongs in time (Martin 2026-11-24: cars very
  // near wobbled now and then): timed by when it reached the server, a position that left a phone or Wi-Fi 30 ms
  // late looked like the car braking and catching up, about a metre at racing speed, plain to see 20 m away. A page
  // that sends p[STAMP] (the moment it took the position by its own clock, ms within the minute) is placed by that:
  // how much later than its quickest one this position came is how late it is, and it goes that much back in time.
  // The quickest way is remembered per car (base: our clock minus theirs plus the quickest trip), creeping up 2 ms a
  // second so a clock that drifts is followed. No synced clock is needed: two clocks apart only make base bigger.
  // Without a stamp (an older page): by the server's arrival (age ms before now), as before.
  function addPose(o, p, age) {
    const b = o.buf, last = b[b.length - 1], now = performance.now() / 1000;
    let t = now - age / 1000;
    if (p.length > STAMP) {
      const raw = (((Date.now() - p[STAMP]) % 60000) + 60000) % 60000;
      let late = o.base === undefined ? 0 : ((raw - o.base + 90000) % 60000) - 30000;
      if (o.base === undefined || late < 0 || late > 1500) { o.base = raw; late = 0; }   // quicker than ever (or a restart)
      else o.base = (o.base + Math.min(late, 2 * (now - (o.baseAt || now)))) % 60000;
      o.baseAt = now;
      t = now - late / 1000;
    }
    if (last && t <= last.t) t = last.t + 0.001;
    b.push({ t, p });
    if (b.length > 30) b.shift();
  }
  function onMessage(m) {
    switch (m.t) {
      case 's': {
        const o = others.get(m.id);
        if (o && poseOk(m.p)) addPose(o, m.p, 0);
        break;
      }
      case 'S': {          // a bundle: [id, position, how many ms ago the server got it] for each car with news
        if (!Array.isArray(m.b)) break;
        bundled = true;
        for (const e of m.b) {
          if (!Array.isArray(e)) continue;
          const o = others.get(e[0]);
          if (o && poseOk(e[1])) addPose(o, e[1], Number.isFinite(e[2]) ? Math.max(0, Math.min(1000, e[2])) : 0);
        }
        break;
      }
      case 'full':
        if (!full) toast(`SERVER FULL (${Number(m.max) || 100} ONLINE) · DRIVING OFFLINE, JOINING WHEN A PLACE FREES`, 5000);
        full = true; online = false;
        onPeople?.('count');
        break;
      case 'welcome':
        if (full) toast('A PLACE FREED UP · ONLINE AGAIN', 3000);
        full = false;
        myId = m.id;
        myWn = Number.isInteger(m.wn) ? m.wn : 0;
        if (typeof m.id === 'string') mine.add(m.id);
        // the lap ticket: proof of when this browser came online, sent along with every lap (see
        // "Lap tickets" in worker/index.js); kept across reconnects
        if (typeof m.key === 'string') ticket = m.key;
        for (const p of Array.isArray(m.players) ? m.players : []) add(p);
        onPeople?.('count');
        if (m.board) setBoard(m.board);
        break;
      case 'join':
        if (!add(m)) break;
        if (onPeople) onPeople('join', m.name); else toast(`${m.name.toUpperCase()} JOINED`, 2600);
        break;
      case 'leave': {
        if (mine.has(m.id)) break;                 // our own old connection, closed by the server
        const o = others.get(m.id);
        if (o) { if (onPeople) onPeople('leave', o.name); else toast(`${o.name.toUpperCase()} LEFT`, 1800); }
        drop(m.id);
        break;
      }
      case 'name': {
        const o = others.get(m.id);
        if (o && typeof m.name === 'string') { onPeople?.('rename', m.name, o.name); o.name = m.name; o.el.textContent = m.name; }
        break;
      }
      case 'car': {
        const o = others.get(m.id);
        if (o) setRemoteCar(o, m.car);
        break;
      }
      case 'ku': {          // a thumbs up, from id to `to` (either may be us): see src/kudos.js
        if (typeof m.id !== 'string' || typeof m.to !== 'string') break;
        const o = m.to === myId ? myKudos : others.get(m.to);
        if (o) { o.kn = (o.kn || 0) + 1; o.kf = [...(o.kf || []), m.id].slice(-24); if (o === myKudos) saveKudos(); }
        onKudos?.(m.id, m.to);
        break;
      }
      case 'at': {          // where they are: map, garage or away
        const o = others.get(m.id);
        if (o) o.w = typeof m.w === 'string' ? m.w : '';
        break;
      }
      case 'wn': {          // how many spectators watch a player (us too)
        const n = Number.isInteger(m.n) && m.n >= 0 ? Math.min(m.n, 999) : 0;
        if (m.id === myId) myWn = n;
        else { const o = others.get(m.id); if (o) o.wn = n; }
        break;
      }
      case 'clock': {
        const t = Date.now(), rtt = t - Number(m.c);
        if (rtt >= 0 && rtt < 5000 && Number.isFinite(m.s) && rtt <= clockRtt) { clockRtt = rtt; clockOff = m.s + rtt / 2 - t; }
        break;
      }
      case 'race':
        if (m.r && typeof m.r === 'object') { raceSeen = true; onRace?.(m.r); }
        break;
      case 'board':
        if (!m.board) break;
        setBoard(m.board);
        if (m.lap && typeof m.lap.name === 'string') {
          const best = m.board.allTime?.find((b) => b.car === m.lap.car);
          const short = Object.hasOwn(CARS, m.lap.car) ? CARS[m.lap.car].short.toUpperCase() : '';
          if (Number.isFinite(m.lap.ms)) lastLaps.set(m.lap.name, { ms: m.lap.ms, car: m.lap.car, t: Date.now() });
          if (best && best.ms === m.lap.ms && best.name === m.lap.name) {
            recs.set(m.lap.name, { car: m.lap.car, ms: m.lap.ms, t: Date.now() });
            if (m.lap.name !== name) { toast(`${m.lap.name.toUpperCase()} SET A ${short} LAP RECORD`, 3500); onRecord?.(m.lap.name, m.lap.car); }
          }
        }
        // a time of the Raadi stage that is now the car's best there
        if (stage && m.run && typeof m.run.name === 'string' && m.run.name !== name) {
          const best = m.board[m.run.track]?.allTime?.find((b) => b.car === m.run.car);
          const short = Object.hasOwn(CARS, m.run.car) ? CARS[m.run.car].short.toUpperCase() : '';
          if (best && best.ms === m.run.ms && best.name === m.run.name) { toast(`${m.run.name.toUpperCase()} SET A ${short} RAADI STAGE RECORD`, 3500); onRecord?.(m.run.name, m.run.car); }
        }
        break;
      default:
    }
  }

  // ---- lap times
  // Laps wait in a queue (kept in memory, and in localStorage when it works) until the server
  // confirms them, so a lap lost to a dropped connection or a closed tab still reaches the board
  // the next time the game is opened: the server ignores ones it already has. Each lap carries
  // the lap ticket this browser held when it was driven; the server stores no lap without one.
  const lapKey = (l) => `${l.track ? `${l.track}|` : ''}${l.car}|${l.ms}`;
  function readJson(k) { try { const v = JSON.parse(lsGet(k)); return Array.isArray(v) ? v : []; } catch { return []; } }
  const sent = new Set(readJson(SENT_KEY));
  const queue = [];
  function enqueue(l) {
    if (!l?.car || !(l.ms > 0) || sent.has(lapKey(l)) || queue.some((q) => lapKey(q) === lapKey(l))) return;
    // (track: 'raadi' on a time of the Raadi stage, none on a lap of Toomemägi; pen: its penalty seconds)
    queue.push({ name: l.name || name, car: l.car, ms: l.ms, at: l.at, splits: l.splits, cp: l.cp, k: l.k, inp: l.inp, ty: l.ty, track: l.track, pen: l.pen });
  }
  function saveQueue() { lsSet(PENDING_KEY, JSON.stringify(queue.slice(-200))); }
  function markSent(list) {
    for (const l of list) sent.add(lapKey(l));
    lsSet(SENT_KEY, JSON.stringify([...sent].slice(-400)));
  }
  readJson(PENDING_KEY).forEach(enqueue);
  let flushing = false, retryTimer = 0;
  async function flushLaps() {
    // (in stealth not even laps from earlier sessions: a record would show the others a toast now)
    if (flushing || STEALTH) return;
    await nameReady;
    if (!queue.length) return;
    flushing = true;
    let failed = false;
    while (queue.length && !failed) {
      // (ago: how long since the lap ended by this browser's clock, which is what the server goes by)
      const batch = queue.slice(0, 50).map((l) => ({ ...l, name: l.name || name, ago: Math.max(0, Date.now() - Date.parse(l.at)) || 0 }));
      try {
        const r = await fetch('/api/lap', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ laps: batch }) });
        if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429)) {
          // stored, already there, or refused as invalid: either way not worth sending again
          markSent(batch);
          queue.splice(0, batch.length);
          if (r.ok) { const j = await r.json().catch(() => null); if (j?.board) setBoard(j.board); }
        } else failed = true;
      } catch { failed = true; }
    }
    saveQueue();
    flushing = false;
    if (queue.length) { clearTimeout(retryTimer); retryTimer = setTimeout(flushLaps, 30000); }
  }
  nameReady.then(() => flushLaps());
  addEventListener('online', () => flushLaps());

  // remote pose at render time, interpolated between the two updates around it
  function sample(o, now) {
    const b = o.buf;
    if (!b.length) return null;
    const t = now - (bundled ? DELAY_BUNDLED : DELAY);
    let i = b.length - 1;
    while (i > 0 && b[i - 1].t > t) i--;
    const B = b[i], A = b[i - 1];
    let p;
    if (A && t <= B.t) {
      const span = B.t - A.t || 1, f = Math.max(0, Math.min(1, (t - A.t) / span));
      p = A.p.map((v, k) => {
        if (k === 3 || k === 4 || k === 5 || k === 8) {            // angles
          let d = B.p[k] - v; d = Math.atan2(Math.sin(d), Math.cos(d));
          return v + d * f;
        }
        if (B.p[k] === undefined) return v;                         // (a browser still on an older version)
        if (k >= 20) return B.p[k];                                 // flags, the time stamp
        return v + (B.p[k] - v) * f;
      });
      // the way between two positions follows the car's speed at both ends (a cubic Hermite curve), not a
      // straight line: round a bend an arc, and no change of pace at each position (Martin 2026-11-24)
      if (span < 0.5) {
        const f2 = f * f, f3 = f2 * f, h10 = f3 - 2 * f2 + f, h11 = f3 - f2, h01 = 3 * f2 - 2 * f3, h00 = 1 - h01;
        for (const [k, vk] of [[0, 6], [1, 7]]) p[k] = h00 * A.p[k] + h10 * span * A.p[vk] + h01 * B.p[k] + h11 * span * B.p[vk];
      }
    } else {
      // past the newest update: carry on along its velocity for a moment
      const ahead = Math.min(0.35, t - B.t);
      p = B.p.slice();
      p[0] += p[6] * ahead; p[1] += p[7] * ahead;
    }
    if (now - B.t > 5) { o.live = false; return null; }          // gone quiet
    o.live = now - B.t < 0.6;                                    // still sending: its sound and smoke are current
    return p;
  }

  function parkedPose(o) {
    const last = o.buf[o.buf.length - 1];
    if (o.parked?.from !== last) {
      const p = last.p.slice();
      p[6] = p[7] = 0;                                            // standing
      for (let k = 9; k < p.length; k++) p[k] = 0;                // no lamps, pedals, revs, slides or flags
      o.parked = { from: last, p };
    }
    return o.parked.p;
  }

  // push our car out of anyone it overlaps; boxes as oriented rectangles (separating axis test)
  function collide(car) {
    if (hotlap()) return;                                        // on a lap of our own: nobody can touch us
    if (STEALTH) return;                                         // they cannot see us, so nobody bumps
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
    for (const o of others.values()) {
      const p = o.pose;
      if (!p || (p[20] & HOT)) continue;                         // they are on a lap: we pass through them
      if (racing(o.id)) continue;                                // in the race from the grid on, even before their flag arrives
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
        const j = Math.min(30, -(1 + RESTITUTION) * vrel * 0.5);   // equal masses, our half of the exchange (capped: a made-up speed must not throw us off the map)
        const nvx = wvx + j * nx, nvz = wvz + j * nz;
        car.vx = nvx * fx + nvz * fz; car.vy = nvx * rx + nvz * rz;
        // a glancing knock off the car's centre line turns it a little
        const lever = (nx * rx + nz * rz) * (dx * fx + dz * fz);
        car.yawRate += Math.max(-1.5, Math.min(1.5, -lever * j * 0.08));
        car.hit = Math.max(car.hit, j);
      }
    }
  }

  // Another player's car as the sound, smoke and tyre mark code wants it: the same fields as our own car
  // after its physics step, rebuilt from what that browser sends.
  const fxList = [];
  function effects(o, p, fx, fz) {
    const s = o.spec, r = o.fx || (o.fx = {});
    const sx = -fz, sz = fx, flags = p[20] || 0, has = p[14] !== undefined;
    r.id = o.id; r.spec = s;
    r.x = p[0]; r.z = p[1]; r.y = p[2]; r.yaw = p[3]; r.steer = p[8];
    r.a = s.wheelbase * s.cgFront; r.b = s.wheelbase * (1 - s.cgFront);
    r.vx = p[6] * fx + p[7] * fz; r.vy = p[6] * sx + p[7] * sz;
    r.reversing = !!p[10];
    r.soot = !!s.dpfSmoke && p[12] !== undefined;
    r.throttle = p[12] || 0; r.boost = p[13] || 0;
    r.tyres = has;                                                // false for a browser still on an older version
    r.rpm = has ? p[14] : 0;
    r.slipV = r.slipVF = r.slipVR = has ? p[15] : 0;
    r.skidF = has ? p[16] : 0; r.skidR = has ? p[17] : 0; r.rubF = has ? p[18] : 0; r.rubR = has ? p[19] : 0;
    r.revCut = flags & 1; r.inWater = !!(flags & 2); r.paved = !!(flags & 4);
    // (the ground under it, for the sound of its wheels spinning on loose ground: 1 paved, 2 gravel, 3 dirt, 0 grass)
    r.ground = r.paved ? 1 : flags & 16 ? 2 : flags & 32 ? 3 : r.inWater ? 4 : 0;
    return r;
  }

  const v3 = new THREE.Vector3();
  let nearest = 0;                 // metres from our car to the nearest other one, last frame
  // Ghost cars fade near ours (Martin 2026-11-24): when we pass through each other (a hotlap, the online race,
  // the Raadi stage, where everybody starts from one spot), a car on our spot is drawn at FADE_MIN and comes
  // back gradually, solid once FADE_AHEAD metres ahead or behind or FADE_SIDE to the side. Its name, HOTLAP tag
  // and glow fade too, but only a touch (to TAG_MIN). Free driving, where cars bump, is as it was.
  // A car's pieces share their materials with every other copy of that car (cars/models/index.js), so a fading
  // car gets see-through copies of its own, made the first time it comes close and kept; its lamp and soot
  // materials are its own already and are changed in place. See-through is another shader, compiled ahead
  // (`warm`, once per kind of car) and only then used: until it is ready the car stays solid.
  const FADE_MIN = 0.1, FADE_AHEAD = 10, FADE_SIDE = 5, TAG_MIN = 0.6;
  const fadeWarm = new Map();        // car id -> 'busy' | true
  function fadeParts(o) {
    const m = o.model;
    if (m.fade && m.fade.first === m.group.children[0]) return m.fade;
    const own = new Set([...Object.values(m.lit || {}), m.soot?.mesh?.material, m.soot?.shell?.material].filter(Boolean));
    const list = [];
    m.group.traverse((c) => {
      if (!c.isMesh || c === o.halo || Array.isArray(c.material)) return;
      const base = c.material, mine = own.has(base);
      list.push({ c, base, mine, op: base.opacity, tr: base.transparent, copy: mine ? base : null });
    });
    return (m.fade = { first: m.group.children[0], list, a: 1 });
  }
  function warmFade(o) {
    if (!warm) { fadeWarm.set(o.car, true); return; }
    fadeWarm.set(o.car, 'busy');
    const id = o.car, tmp = new THREE.Group();
    for (const e of fadeParts(o).list) {
      const t = e.base.clone(); t.transparent = true; t.opacity = 0.5;
      const q = new THREE.Mesh(e.c.geometry, t); q.receiveShadow = e.c.receiveShadow; q.castShadow = e.c.castShadow;
      tmp.add(q);
    }
    Promise.resolve(warm(tmp)).catch(() => {}).then(() => {
      fadeWarm.set(id, true);
      tmp.traverse((q) => q.isMesh && q.material.dispose());
    });
  }
  function setFade(o, a) {
    const f = fadeParts(o);
    if (Math.abs(a - f.a) < 0.01 && a !== 1) return;
    if (a === f.a) return;
    const solid = a >= 1;
    for (const e of f.list) {
      if (!e.mine && !e.copy) e.copy = e.base.clone();
      const m = e.copy;
      const tr = solid ? e.tr : true;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = e.op * a;
      if (!e.mine) e.c.material = solid ? e.base : m;
    }
    f.a = a;
  }
  function update(car, dt, active) {
    const now = performance.now() / 1000;
    // send our position while anyone else is online
    sendTimer -= dt;
    shiftHold = car && car.shiftTimer > 0 ? 0.3 : shiftHold - dt;
    cutHold = car && car.revCut > 0 ? 0.15 : cutHold - dt;
    if (active && !STEALTH && others.size && sendTimer <= 0 && ws && ws.readyState === 1) {
      // (a spectator follows our car: full rate for them, wherever the others are)
      sendTimer = 1 / (nearest < CLOSE || racing(myId) || watchedNow() ? SEND_HZ : nearest < LONELY ? SEND_HZ_MID : SEND_HZ_FAR);
      const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
      const r2 = (v) => Math.round(v * 100) / 100;
      const r3 = (v) => Math.round(v * 1000) / 1000;
      const r1 = (v) => Math.round((v || 0) * 10) / 10;
      send({ t: 's', p: [r2(car.x), r2(car.z), r2(car.y), r3(car.yaw), r3(car.pitch), r3(car.roll),
        r2(car.vx * fx + car.vy * rx), r2(car.vx * fz + car.vy * rz), r3(car.steer), car.brake > 0 ? 1 : 0, car.reversing ? 1 : 0,
        // (for a sooty diesel: how black its tail is, and the pedal and boost that make its smoke; the pedal
        // is sent as lifted during a gear change and for long enough after it to be seen at this send rate,
        // which cuts the smoke on the other side too)
        r2(0.95 * (1 - Math.exp(-(car.sootKm || 0) / 2.2))), r2(shiftHold > 0 ? 0 : car.throttle || 0), r2(car.boost || 0),
        // what the others need to hear this car and see its tyres smoke and mark the road: engine revs,
        // wheelspin, how hard each axle is sliding and rubbing, and flags (1 on the rev limiter, 2 in water,
        // 4 on paving, 8 on a hotlap: the lap timer is running, 16 on gravel, 32 on dirt; none of 4/16/32 out of
        // the water is grass)
        Math.round(car.rpm || 0), r1(car.slipV), r1(car.skidF), r1(car.skidR), r1(car.rubF), r1(car.rubR),
        (cutHold > 0 ? 1 : 0) | (car.inWater ? 2 : 0) | (car.surface === 1 ? 4 : 0) | (hotlap() ? HOT : 0) | (car.surface === 2 ? 16 : car.surface === 3 ? 32 : 0),
        // when this position was taken, by our own clock (ms within the minute; see addPose)
        Date.now() % 60000] });
    }
    const W = innerWidth, H = innerHeight;
    fxList.length = 0;
    tagList.length = 0;
    const pulse = 0.7 + 0.3 * Math.sin(now * 4.5);
    const ghostMe = hotlap(), me = active && car;
    const cam = camera.position, detail = low() ? DETAIL_LOW : DETAIL, farMax = Math.min(FAR, camera.far);
    let nf = 0, recolour = false, near2 = Infinity, copied = false;
    for (const o of others.values()) {
      o.pose = sample(o, now);
      // (the car we spectate, gone quiet (another tab, lost signal): parked where it was last heard of, engine
      // off, so the camera is not left on an empty road; spectate.js moves on after a while)
      o.held = !o.pose && o.id === holdId && o.buf.length > 0;
      if (o.held) o.pose = parkedPose(o);
      if (o.pose && o.live) o.seen = now;                            // (its last news, not the coasting after it)
      const p = o.pose;
      const d = p ? Math.hypot(p[0] - cam.x, p[1] - cam.z, p[2] - cam.y) : Infinity;
      // (one car copied a frame: when the first car of a kind is ready, everybody driving one is waiting for it)
      if (p && o.live && o.modelCar !== o.car && !copied && (!lean() || (d < LEAN_NEAR && kindOk(o.car))) && modelReady(o.car, true)) { showModel(o); copied = true; }
      if (p && car) near2 = Math.min(near2, (p[0] - car.x) ** 2 + (p[1] - car.z) ** 2);
      // (heard, and smoking, even while their car is still being built; past 400 m neither is heard or seen)
      if (p && o.live && d < 400) fxList.push(effects(o, p, Math.sin(p[3]), -Math.cos(p[3])));
      const g = o.model?.group;
      if (!p) { if (g) setNear(o, false); showTag(o, false); continue; }
      const fx = Math.sin(p[3]), fz = -Math.cos(p[3]);
      // whole car near, a block further out (a little either way before it changes: no flicker at the edge);
      // a block too while its car is not built (yet, or on a phone not at all: see LEAN_NEAR)
      const whole = !!g && o.model.warmed !== false;
      const near = whole && d < (o.near ? detail * 1.15 : detail);
      if (g) setNear(o, near);
      if (!near) {
        if (d < farMax) {
          const sz = whole ? o.model.size : null, paint = whole ? o.paint : o.plain || (o.plain = new THREE.Color(o.colour));
          fp.set(p[0] + fx * o.off, p[2], p[1] + fz * o.off);
          fq.setFromEuler(fe.set(p[4], -p[3], -p[5]));
          fs.set(sz?.width ?? o.halfWid * 2, sz?.height ?? 1.45, sz?.length ?? o.halfLen * 2);
          far.setMatrixAt(nf, fm.compose(fp, fq, fs));
          if (far.userData[nf] !== paint) { far.userData[nf] = paint; far.setColorAt(nf, paint); recolour = true; }
          nf++;
        }
      } else {
        // on a hotlap: the glow under their car and the tag over their name
        const hot = o.live && !!(p[20] & HOT);
        if (hot && !o.halo) {
          o.halo = haloMesh();
          o.halo.material = o.halo.material.clone();      // (its own, to fade with the car; same shader)
          const sz = o.model.size;
          o.halo.scale.set((sz?.width ?? o.halfWid * 2) + 1.5, 1, (sz?.length ?? o.halfLen * 2) + 1.7);
          o.halo.position.y = 0.06;
          g.add(o.halo);
        }
        if (o.halo) o.halo.visible = hot;
        // passing through each other and close: see-through (FADE_MIN on our spot, solid FADE_AHEAD / FADE_SIDE away)
        let a = 1;
        if (me && (ghostMe || (p[20] & HOT) || racing(o.id))) {
          const dx = p[0] - me.x, dz = p[1] - me.z, sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
          const k = Math.max(Math.abs(dx * sy - dz * cy) / FADE_AHEAD, Math.abs(dx * cy + dz * sy) / FADE_SIDE);
          if (k < 1) {
            const w = fadeWarm.get(o.car);
            if (w === true) a = FADE_MIN + (1 - FADE_MIN) * k;
            else if (!w) warmFade(o);
          }
        }
        // (eased, so a lap starting or ending with a car beside us does not snap)
        // (a car just changed for one whose see-through shader is not ready: solid at once)
        const fa = fadeWarm.get(o.car) === true ? o.fa ?? 1 : 1;
        o.fa = a >= 1 && fa > 0.995 ? 1 : fa + (a - fa) * Math.min(1, dt * 8);
        if (o.fa !== 1 || o.model.fade) setFade(o, o.fa);
        o.tagA = 1 - (1 - TAG_MIN) * (1 - o.fa) / (1 - FADE_MIN);
        if (o.halo && hot) o.halo.material.opacity = pulse * o.tagA;
        // a shadow only close by, where it can be seen
        const sh = d < SHADOW_DIST;
        if (sh !== o.shadow) { o.shadow = sh; g.traverse((c) => { if (c.isMesh && c !== o.halo) c.castShadow = sh; }); }
        g.visible = true;
        g.position.set(p[0] + fx * o.off, p[2], p[1] + fz * o.off);
        g.rotation.set(p[4], -p[3], -p[5]);
        const w = o.model.wheels;
        const speed = p[6] * fx + p[7] * fz;
        o.wheel = (o.wheel + (speed / (o.spec.wheelRadius || 0.32)) * dt) % (Math.PI * 2);
        if (w) {
          w.fl.steer.rotation.y = w.fr.steer.rotation.y = -p[8];
          w.fl.spin.rotation.x = w.fr.spin.rotation.x = w.rl.spin.rotation.x = w.rr.spin.rotation.x = -o.wheel;
        }
        const brake = !!p[9], rev = !!p[10];
        if (brake !== o.brake || rev !== o.rev) { o.brake = brake; o.rev = rev; o.model.setLights?.({ brake, reverse: rev, headlights: true }); }
        if (o.model.setSoot && p[11] !== undefined && p[11] !== o.sootK) { o.sootK = p[11]; o.model.setSoot(p[11]); }
      }
      if (d > TAG_DIST) { showTag(o, false); continue; }
      tagList.push(o);
      o.d = d;
    }
    nearest = Math.sqrt(near2);
    far.count = nf;
    if (nf) far.instanceMatrix.needsUpdate = true;
    if (recolour) far.instanceColor.needsUpdate = true;
    // floating names over the nearest few only: held well above the roof (and lifted a little more on screen,
    // past the record line that hangs under it), so a player ahead does not hide the racing line (Martin 2026-11-23)
    const most = low() ? TAGS_LOW : TAGS;
    tagList.sort((a, b) => a.d - b.d);
    let shown = 0;
    for (const o of tagList) {
      if (shown >= most) { showTag(o, false); continue; }
      const p = o.pose;
      const hot = o.live && !!(p[20] & HOT);
      if (hot !== !!o.hot) { o.hot = hot; o.el.classList.toggle('hot', hot); }
      const ta = o.near ? Math.round((o.tagA ?? 1) * 50) / 50 : 1;
      if (ta !== (o.ta ?? 1)) { o.ta = ta; o.el.style.opacity = ta === 1 ? '' : ta; }
      const rec = recs.size ? recordOf(o.name) : '';
      if (rec !== (o.rec || '')) { o.rec = rec; if (rec) o.el.dataset.rec = rec; else delete o.el.dataset.rec; }
      v3.set(p[0], p[2] + 3.0, p[1]);
      v3.project(camera);
      if (v3.z > 1 || Math.abs(v3.x) > 1.1 || Math.abs(v3.y) > 1.1) { showTag(o, false); continue; }
      const sc = Math.max(0.55, Math.min(1.2, 28 / o.d));
      // its box on screen (from the name's length: measuring the page each frame would cost more than it saves)
      const x = ((v3.x + 1) / 2) * W, y = ((1 - v3.y) / 2) * H - 34 * sc, hw = (o.name.length * 5.5 + 12) * sc, hh = 11 * sc;
      let covered = false;
      for (let i = 0; i < shown; i++) { const q = boxes[i]; if (Math.abs(q.x - x) < q.hw + hw && Math.abs(q.y - y) < q.hh + hh) { covered = true; break; } }
      if (covered) { showTag(o, false); continue; }
      const q = boxes[shown] || (boxes[shown] = {});
      q.x = x; q.y = y; q.hw = hw; q.hh = hh;
      shown++;
      showTag(o, true, `translate(${(((v3.x + 1) / 2) * W).toFixed(1)}px, ${(((1 - v3.y) / 2) * H).toFixed(1)}px) translate(-50%, calc(-100% - ${(24 * sc).toFixed(1)}px)) scale(${sc.toFixed(2)})`);
    }
  }

  connect();

  return {
    update,
    collide,
    get name() { return name; },
    get online() { return online; },
    // the server was full: driving offline until a place frees (see schedule)
    get full() { return full; },
    stealth: STEALTH,
    get count() { return others.size; },
    nameReady,
    // everyone else online, including those who have not sent a position yet
    roster() { return [...others.entries()].map(([id, o]) => ({ id, w: o.w, wn: o.wn, name: o.name, colour: o.colour, car: o.car, x: o.pose?.[0], z: o.pose?.[1] })); },
    // other players' cars that are sending right now, for sound, smoke and tyre marks (see effects())
    remotes() { return fxList; },
    // everyone counted as online, as the server counts them for a race vote: on the map, or off it
    // (garage, menu, another tab) for less than AWAY_S
    drivers() { return [...others.entries()].filter(([, o]) => o.pose || (o.seen && performance.now() / 1000 - o.seen < AWAY_S - 1)).map(([id, o]) => ({ id, w: o.w, wn: o.wn, name: o.name, colour: o.colour, car: o.car })); },
    players() { return [...others.values()].filter((o) => o.pose).map((o) => ({ id: o.id, name: o.name, colour: o.colour, x: o.pose[0], z: o.pose[1], yaw: o.pose[3], hot: !!o.hot })); },
    setName(n) {
      n = cleanName(n);
      if (!n || n === name) return name;
      name = n; lsSet(NAME_KEY, n);
      send({ t: 'name', name: n });
      return name;
    },
    get car() { return carId; },
    // where we are (map, garage, away), told to the others when it changes
    // (watch: following another player's car as a spectator, on: their id)
    setWhere(w, on = '') {
      if (w !== 'watch') on = '';
      if (w === where && on === whereOn) return;
      where = w; whereOn = on;
      if (released && (w === 'map' || w === 'watch')) { released = false; retry = 1; connect(); return; }
      if (!STEALTH) send({ t: 'at', w, ...(on ? { on } : {}) });
    },
    // another player as this page holds them (pose, car, colour, name tag), for the spectator camera
    remote(id) { return others.get(id) || null; },
    // the car we spectate (null: none): kept drawn, parked, while it is quiet
    hold(id) { holdId = id || null; },
    // somebody is watching our car as a spectator
    get watched() { return watchedNow(); },
    watchers() { return myWn; },
    lastLap(n) { const l = lastLaps.get(n); return l && Date.now() - l.t < 10 * 60000 ? l : null; },
    setCar(id) { if (id === carId) return; carId = id; send({ t: 'car', car: id }); },
    // the online race
    get id() { return myId; },
    serverNow: () => Date.now() + clockOff,
    raceSend(m) { if (!STEALTH) send(m); },
    // driving on the map (counts for the race votes), or in the garage / another tab
    // (leaving the map is told only after AWAY_S: a quick car change in the garage keeps your vote and place)
    // (now: told at once, as on a Raadi stage run, where a player is not counted for the race votes)
    setDriving(on, now = false) {
      if (on) { clearTimeout(drvOff); drvOff = 0; if (!driving) { driving = true; if (!STEALTH) send({ t: 'drv', on: 1 }); } return; }
      if (!driving) return;
      if (now) { clearTimeout(drvOff); drvOff = 0; driving = false; if (!STEALTH) send({ t: 'drv', on: 0 }); return; }
      if (drvOff) return;
      drvOff = setTimeout(() => { drvOff = 0; driving = false; if (!STEALTH) send({ t: 'drv', on: 0 }); }, AWAY_S * 1000);
    },
    // counted for the race votes now (on the map, or away for less than AWAY_S)
    get counted() { return driving && !STEALTH; },
    poseOf(id) { const o = others.get(id); return o?.pose || null; },
    nameOf(id) { return others.get(id)?.name; },
    colourOf(id) { return others.get(id)?.colour; },
    // another player's car as drawn now (null when far: then nobody sees a sign on it), and its kind
    carOf(id) { const o = others.get(id); return o?.model && o.near ? { group: o.model.group, car: o.modelCar } : null; },
    // a thumbs up for another player (src/kudos.js): false while the last one to them is under KUDOS_GAP_S old
    // (the server holds to the same), or in stealth
    kudos(id) {
      if (STEALTH || !online || !others.has(id)) return false;
      const t = performance.now() / 1000;
      if (t - (kudosAt.get(id) ?? -1e9) < KUDOS_GAP_S) return false;
      kudosAt.set(id, t);
      send({ t: 'ku', to: id });
      return true;
    },
    // seconds until another thumbs up may go to this player (0: now)
    // thumbs up received this session: ours, and those of each other car drawn whole now
    get myKudos() { return myKudos; },
    kudosCars(out) {
      for (const o of others.values()) if (o.kn && o.model && o.near) out.push({ group: o.model.group, car: o.modelCar, n: o.kn, from: o.kf });
      return out;
    },
    kudosWait(id) { return Math.max(0, KUDOS_GAP_S - (performance.now() / 1000 - (kudosAt.get(id) ?? -1e9))); },
    // "M3 LAP RECORD 1:23.45" for a driver who set a record lately (and still holds it), else ''
    recordOf,
    recordTime,
    submitLap(lap) {
      if (STEALTH) return;                                       // kept in this browser only (race.js)
      enqueue({ name, car: lap.car, ms: lap.ms, at: lap.at, splits: lap.splits, cp: lap.cp, k: ticket || undefined, inp: lap.inp, ty: lap.ty, track: lap.track, pen: lap.pen });
      saveQueue();
      flushLaps();
    },
    refreshBoard() {
      fetch('/api/board', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((b) => { if (b) setBoard(b); }).catch(() => {});
    },
    get board() { return board; },
    // the record in this car: of Toomemägi's lap, or of a stage (track 'raadi')
    bestFor(id, track) {
      const b = (track ? board?.[track] : board)?.allTime?.find((r) => r.car === id);
      return b ? { ms: b.ms, name: b.name } : null;
    },
    // the fastest lap anyone drove in this car with split times for these checkpoints
    refFor(id, cp) {
      const r = board?.refs?.find((x) => x.car === id && x.cp === cp && Array.isArray(x.splits));
      return r ? { ms: r.ms, name: r.name, splits: r.splits } : null;
    },
    labelHtml: escapeHtml,
  };
}
