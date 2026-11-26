// Simple multiplayer: everyone who has the game open drives in the same world.
//
// No accounts. A browser gets a default name from the server (one nobody has finished a lap
// with) and keeps it in localStorage; it can be changed in the garage. Positions go through
// one WebSocket to the lobby on the server (worker/index.js), about ten times a second and only
// while somebody else is online. Other cars are drawn a little in the past and interpolated, with
// their name floating above them, and bump into ours: each browser pushes its own car out of
// the other one, so both sides see the same knock. Except on a hotlap: a car whose lap timer is
// running tells the others so (flag 8), wears a glow and a HOTLAP tag on their screens, and no car
// bumps into it or is bumped by it, on either side, so nobody can spoil a lap in progress. The same for a car
// just put on the start, while it stays in the start lane (flag 64, src/race/startlane.js), without glow or tag.
import * as THREE from 'three';
import { CARS } from '../cars/specs.js';
import { escapeHtml, fmtTime } from '../race/race.js';
import { STEALTH } from './stealth.js';
import { KUDOS_GAP_S } from '../kudos.js';
import { jobs } from '../jobs.js';
import { outside } from '../hitches.js';
import { POSE_DEC, pack, unpack, replayAt } from '../race/replay.js';
import { flightPose, flightNozzles, touchTime, packPlan, unpackPlan, NOZ, NOZ_DOWN } from '../cars/thrust.js';
import { STANDINS } from './standins.js';
import { ADJ, NOUN } from './names.js';
import { badName } from '../../worker/badnames.js';
import { cleanPlate } from './plates.js';
import { setCarPlate, dropPlate } from '../cars/plate.js';

const NAME_KEY = 'kvissuroam.name';
const PLATE_KEY = 'kvissuroam.plate';     // our own number plate, '' for each car's own (src/net/plates.js)
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
const FRESH = 64;                // flag: just put on the start and still in the start lane (src/race/startlane.js)
const THRU = HOT | FRESH;        // either: nobody bumps this car
// A car that just appeared where it is (its first position, R, the map, or a place a script made up) does not push
// ours for this long (26 Nov 2026: a car that does not exist could be thrown at anyone driving freely). The server
// flags such a car as FRESH for the same time (worker/index.js V_MAX), so pages from before this pass through it too.
const NEW_S = 2;
const FANS_OFF = 256;            // flag: a fan car's suction fans are switched off (no dust from it)
const BOOSTING = 128;            // flag: a Rocket's rear nozzles are blowing (src/cars/thrust.js; 64 is the start lane's)
// A see-through car's solid pieces where the picture has edge smoothing (see setFade): not blended, but each pixel's
// samples given to the piece in the share of its strength (alpha to coverage), so many pixels a sample more and so
// many a sample less by a fine pattern on the screen (the 4 by 4 ordered one; COVER_FADE is one sample's share).
// Part of three's own shader text, behind a define that only those pieces set.
THREE.ShaderChunk.alphatest_fragment = `
#ifdef COVER_FADE
  {
    // (a cut-out picture, a badge: cut where it is cut at full strength, not wherever the fade takes it under the limit)
    #ifdef USE_ALPHATEST
      if (diffuseColor.a < alphaTest * opacity) discard;
    #endif
    ivec2 fadeP = ivec2(gl_FragCoord.xy) & 3;
    int fadeX = fadeP.x ^ fadeP.y;
    float fadeN = (float(((fadeX & 1) << 3) | ((fadeP.y & 1) << 2) | (fadeX & 2) | ((fadeP.y & 2) >> 1)) + 0.5) / 16.0;
    diffuseColor.a = clamp(diffuseColor.a + (fadeN - 0.5) * COVER_FADE, 0.0, 1.0);
  }
#else
${THREE.ShaderChunk.alphatest_fragment}
#endif
`;
const STAMP = 21;                // position's slot for when it was taken (see addPose)
const POSE_SC = POSE_DEC.map((d) => 10 ** d);
// Many players online (Martin 2026-11-23: 22 online felt laggy, and the names crowded the road). A car
// past DETAIL metres is a small block in its paint colour, all such blocks one draw call (a whole car is
// 11-12 pieces of 50-75 thousand triangles, a few pixels tall that far away); past FAR it is not drawn at
// all (the map arrows and the list still show it). Names float over the TAGS nearest within TAG_DIST.
const DETAIL = 110, DETAIL_LOW = 75;
const FAR = 900;
const TAG_DIST = 150, TAGS = 6, TAGS_LOW = 4;   // (was every car within 600 m); a name that would cover a nearer one is left out
const SHADOW_DIST = 60;          // only cars this near cast a shadow
// A pack (Martin 2026-11-24, lag in a race of 19 with 60 online): every car within DETAIL was drawn whole, 50 to 75
// thousand triangles and a dozen pieces each, and again for the sun's shadow within SHADOW_DIST: at a race start
// twenty such cars about doubled what the graphics card draws. Now only the WHOLE nearest are whole (the rest that
// far are blocks), and only the SHADOWS nearest cast a shadow.
const WHOLE = 10, WHOLE_LOW = 6, SHADOWS = 4;
// Phones (Martin 2026-11-24, getting ready for 50 and more online): each kind of car another player drives
// is built once on this page (its template, about 16 MB on the graphics card and 19 MB of memory), and 22
// players in 12 kinds of car added some 400 MB on an emulated phone, more than an iPhone has to spare. On
// a phone a car is built only once it comes within LEAN_NEAR metres, and at most LEAN_KINDS kinds; any
// other is a block in the player's map colour.
const LEAN_NEAR = 120, LEAN_KINDS = 3;
// Which 3 (Martin 2026-11-24: "could it be the 3 cars that are the most in the race"): the first kinds to come near
// take the places, but every LEAN_PICK seconds the kinds are counted (in a race we are in: the racers; else the cars
// within LEAN_POOL metres) and a kind with LEAN_MARGIN more cars than the least driven one held takes its place:
// that kind's cars become stand-ins and its template is freed from the page and the graphics card (dropModel).
const LEAN_POOL = 240, LEAN_PICK = 2, LEAN_MARGIN = 2;
// what the server does to a name (worker/index.js cleanName), so the name box shows what the others see
const cleanName = (s) => String(s || '').normalize('NFC')
  .replace(/[\u0000-\u001f\u007f-\u009f<>\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/g, '')
  .replace(/(\p{M}{2})\p{M}+/gu, '$1')
  .replace(/\s+/g, ' ').trim().slice(0, 20).trim();
// a position from another browser: numbers only (the server checks too; a word in here used to stop the picture)
const poseOk = (p) => Array.isArray(p) && p.length >= 9 && p.length <= 24 && p.every((v) => typeof v === 'number' && Number.isFinite(v));


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

// The far stand-in: a low car shape, unit sized (scaled per car to its width, height and length), coloured per
// car. One InstancedMesh for every far car; made with the game, so its shader is compiled at loading and not
// while driving. (Martin 2026-11-24: cars that caught up looked like bricks. On a phone a fourth kind of car
// stays a stand-in however near, see LEAN_KINDS, so it has a bonnet, a boot, dark windows and wheels: 68
// triangles, still one draw call. The windows and wheels are dark by their vertex colour, which the
// car's colour multiplies.)
function farCars(scene, max) {
  const pos = [], col = [];
  const PAINT = [1, 1, 1], GLASS = [0.1, 0.11, 0.14], TYRE = [0.05, 0.05, 0.05];
  const tri = (a, b, c, k) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) col.push(...k); };
  const quad = (a, b, c, d, k) => { tri(a, b, c, k); tri(a, c, d, k); };
  // a side profile (z forward -0.5 to the back 0.5, y up), made solid across x from -w to w; the profile goes
  // round clockwise seen from +x. kind(i) colours the strip from point i to i+1.
  const prism = (pr, w, kind, sideK) => {
    const n = pr.length;
    for (let i = 0; i < n; i++) {
      const [z0, y0] = pr[i], [z1, y1] = pr[(i + 1) % n];
      quad([w, y0, z0], [w, y1, z1], [-w, y1, z1], [-w, y0, z0], kind(i));
    }
    for (let i = 1; i < n - 1; i++) {
      tri([w, pr[0][1], pr[0][0]], [w, pr[i + 1][1], pr[i + 1][0]], [w, pr[i][1], pr[i][0]], sideK);
      tri([-w, pr[0][1], pr[0][0]], [-w, pr[i][1], pr[i][0]], [-w, pr[i + 1][1], pr[i + 1][0]], sideK);
    }
  };
  // body: bumper, bonnet, the deck under the windows, boot lid, tail, underside
  prism([[-0.5, 0.13], [0.5, 0.13], [0.5, 0.47], [0.43, 0.56], [-0.12, 0.58], [-0.46, 0.5], [-0.5, 0.4]], 0.5, () => PAINT, PAINT);
  // cabin: windscreen, roof (painted), rear window; its sides are the side windows
  prism([[-0.15, 0.57], [0.4, 0.57], [0.25, 0.94], [0.0, 0.95]], 0.42, (i) => (i === 2 ? PAINT : GLASS), GLASS);
  // wheels: an octagon on each side, a little outside the body (round on a car of 4.5 by 1.45 m)
  const R = 0.21, RZ = R * 1.45 / 4.4;
  for (const sx of [1, -1]) for (const zc of [-0.32, 0.32]) {
    const x = 0.505 * sx, c = [x, R, zc];
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2;
      const p0 = [x, R + Math.sin(a0) * R, zc + Math.cos(a0) * RZ], p1 = [x, R + Math.sin(a1) * R, zc + Math.cos(a1) * RZ];
      if (sx > 0) tri(c, p1, p0, TYRE); else tri(c, p0, p1, TYRE);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), max);
  mesh.name = 'remote far cars';
  mesh.setColorAt(0, new THREE.Color(0xffffff));
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;            // (spread over the whole map; one draw call either way)
  mesh.visible = false;
  scene.add(mesh);
  // and one for each car in STANDINS: its own shape and colour (one draw call for each kind that has a car
  // drawn so; the same material, so no new shader is ever compiled for them)
  const kinds = new Map(), all = [mesh];
  for (const [id, sd] of Object.entries(STANDINS)) {
    const m = new THREE.InstancedMesh(standinGeo(sd), mesh.material, max);
    m.name = `remote far cars ${id}`;
    m.setColorAt(0, new THREE.Color(0xffffff));
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    m.frustumCulled = false;
    m.visible = false;
    m.userData.paint = new THREE.Color(sd.paint);
    scene.add(m);
    kinds.set(id, m);
    all.push(m);
  }
  for (const m of all) { m.userData.n = 0; m.userData.cols = []; }
  return { mesh, all, of: (id) => kinds.get(id) || null };
}

// A car's stand-in shape from its STANDINS entry, in metres: the body up to the windows (or its whole outline
// where it has none), the cabin over the windows (dark sides, dark windscreen and rear window where the roof
// line is steep, painted roof), a roof band over the windows where glassTop is given (the bus), and wheels.
// Some 160 triangles.
function standinGeo(sd) {
  const pos = [], col = [];
  const PAINT = [1, 1, 1], GLASS = [0.1, 0.11, 0.14], TYRE = [0.05, 0.05, 0.05];
  // a triangle facing out along (ox, oy, oz)
  const tri = (a, b, c, k, ox, oy, oz) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * ox + ny * oy + nz * oz < 0) pos.push(...a, ...c, ...b); else pos.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) col.push(...k);
  };
  const quad = (a, b, c, d, k, ox, oy, oz) => { tri(a, b, c, k, ox, oy, oz); tri(a, c, d, k, ox, oy, oz); };
  const N = sd.top.length, z0 = sd.z[0], z1 = sd.z[1], dz = (z1 - z0) / N;
  // a solid between two lines over the steps i0..i1 (a step's line is at its middle; the ends run to the
  // car's front and back), w wide either side; topK(i) colours the top from step i to i+1
  const column = (i0, i1, lo, hi, w, sideK, topK, endK) => {
    const zs = [], los = [], his = [];
    for (let i = i0; i <= i1; i++) { zs.push(z0 + (i + 0.5) * dz); los.push(lo(i)); his.push(hi(i)); }
    zs[0] = i0 === 0 ? z0 : z0 + i0 * dz;
    zs[zs.length - 1] = i1 === N - 1 ? z1 : z0 + (i1 + 1) * dz;
    for (let j = 0; j < zs.length - 1; j++) {
      const za = zs[j], zb = zs[j + 1];
      for (const sx of [1, -1]) quad([sx * w, los[j], za], [sx * w, los[j + 1], zb], [sx * w, his[j + 1], zb], [sx * w, his[j], za], sideK, sx, 0, 0);
      quad([w, his[j], za], [w, his[j + 1], zb], [-w, his[j + 1], zb], [-w, his[j], za], topK(j + i0, (his[j + 1] - his[j]) / (zb - za)), 0, 1, 0);
      quad([w, los[j], za], [w, los[j + 1], zb], [-w, los[j + 1], zb], [-w, los[j], za], sideK, 0, -1, 0);
    }
    const e = zs.length - 1;
    quad([w, los[0], zs[0]], [w, his[0], zs[0]], [-w, his[0], zs[0]], [-w, los[0], zs[0]], endK, 0, 0, -1);
    quad([w, los[e], zs[e]], [w, his[e], zs[e]], [-w, his[e], zs[e]], [-w, los[e], zs[e]], endK, 0, 0, 1);
  };
  const [g0, g1] = sd.glass, clear = sd.wr * 0.55, cw = sd.w * (sd.cabin ?? 0.86);
  const glassy = (i) => i >= g0 && i <= g1;
  // body: under the windows where there are windows, else the whole outline
  column(0, N - 1, () => clear, (i) => (glassy(i) ? Math.min(sd.belt, sd.top[i]) : sd.top[i]), sd.w, PAINT, () => PAINT, PAINT);
  // cabin: windscreen and rear window (steep) dark, roof painted
  const roof = (i) => (sd.glassTop ? Math.min(sd.glassTop, sd.top[i]) : sd.top[i]);
  column(g0, g1, () => sd.belt, roof, cw, GLASS, (i, slope) => (!sd.glassTop && Math.abs(slope) > 0.45 ? GLASS : PAINT), GLASS);
  if (sd.glassTop) column(g0, g1, () => sd.glassTop, (i) => sd.top[i], cw, PAINT, () => PAINT, PAINT);
  // a rear wing: a plate on two posts
  if (sd.wing) {
    const [wa, wbk, wy] = sd.wing, ww = sd.w * 0.92, t = 0.05;
    const box = (x0, x1, y0, y1, za, zb) => {
      quad([x1, y0, za], [x1, y0, zb], [x1, y1, zb], [x1, y1, za], PAINT, 1, 0, 0);
      quad([x0, y0, za], [x0, y0, zb], [x0, y1, zb], [x0, y1, za], PAINT, -1, 0, 0);
      quad([x0, y1, za], [x1, y1, za], [x1, y1, zb], [x0, y1, zb], PAINT, 0, 1, 0);
      quad([x0, y0, za], [x1, y0, za], [x1, y0, zb], [x0, y0, zb], PAINT, 0, -1, 0);
      quad([x0, y0, za], [x1, y0, za], [x1, y1, za], [x0, y1, za], PAINT, 0, 0, -1);
      quad([x0, y0, zb], [x1, y0, zb], [x1, y1, zb], [x0, y1, zb], PAINT, 0, 0, 1);
    };
    box(-ww, ww, wy - t, wy, wa, wbk);
    const zm = (wa + wbk) / 2, base = sd.top[N - 3] - 0.05;
    for (const sx of [1, -1]) box(sx * ww * 0.7 - 0.03, sx * ww * 0.7 + 0.03, base, wy - t, zm - 0.04, zm + 0.04);
  }
  // wheels: an octagon on each side at each axle
  const R = sd.wr, x = sd.w + 0.01;
  for (const sx of [1, -1]) for (const zc of [-sd.wb / 2, sd.wb / 2]) {
    const c = [sx * x, R, zc];
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2;
      tri(c, [sx * x, R + Math.sin(a0) * R, zc + Math.cos(a0) * R], [sx * x, R + Math.sin(a1) * R, zc + Math.cos(a1) * R], TYRE, sx, 0, 0);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}
// a car's paint colour, for its far stand-in (the body's paint piece, else a quiet grey)
function paintOf(model) {
  let c = null;
  model.group.traverse((m) => { if (!c && m.isMesh && /_paint$|paint/i.test(m.name) && m.material?.color) c = m.material.color; });
  return c ? c.clone() : new THREE.Color(0x9a94a8);
}

// stage: true where the Raadi rally stage is on (?raadi=1): only then are its records announced
export function createMultiplayer({ scene, camera, buildModel, modelReady = () => true, toast, onBoard, onPeople, onRace, onRecord, onKudos, hotlap = () => false, fresh = () => false, racing = () => false, place = () => 0, winner = () => false, stage = false, low = () => false, lean = () => false, warm = null, samples = 0, dropModel = () => {}, onPlate = null }) {
  const others = new Map();      // id -> remote player
  // every id this page has had: after a reconnect the server may still hold our old connection for a
  // while, and must not show up as another driver (or later as "left", with the chime)
  const mine = new Set();
  let bundled = false;           // this connection's server sends positions in bundles
  let myWn = 0;                  // spectators watching our car (the server's count)
  let holdId = null;             // the car we spectate: drawn parked where it was last heard of when it goes quiet
  let ws = null, myId = null, ticket = null, retry = 1, sendTimer = 0, placeTimer = 0, shiftHold = 0, cutHold = 0, board = null, online = false;
  // (a racist slur kept from before the server refused them: the browser gets a fresh random name)
  let name = lsGet(NAME_KEY) || '';
  if (badName(name)) name = '';
  let plate = cleanPlate(lsGet(PLATE_KEY) || '');
  if (plate && (badName(plate) || badName(plate.slice(4)))) plate = '';
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
  // (each received one: [sender id, their name then, when in ms]; a bare id from before 24 Nov)
  const kudoList = (a) => (Array.isArray(a) ? a.map((x) => (typeof x === 'string' ? [x, '', 0] : Array.isArray(x) && typeof x[0] === 'string' ? [x[0], typeof x[1] === 'string' ? x[1] : '', Number(x[2]) || 0] : null)).filter(Boolean).slice(-24) : []);
  const myKudos = (() => { try { const v = JSON.parse(lsGet(KUDOS_KEY)); if (v?.day === today() && Number.isInteger(v.kn)) return { kn: v.kn, kf: kudoList(v.kf) }; } catch { /* none */ } return { kn: 0, kf: [] }; })();
  const saveKudos = () => lsSet(KUDOS_KEY, JSON.stringify({ day: today(), kn: myKudos.kn, kf: myKudos.kf }));
  const clockAsk = () => send(raceSeen ? { t: 'clock', c: Date.now() } : { t: 'clock', c: Date.now(), r: 1 });
  let carId = 'w201';
  const far = farCars(scene, MAX_OTHERS);
  const fm = new THREE.Matrix4(), fq = new THREE.Quaternion(), fe = new THREE.Euler(0, 0, 0, 'YXZ'), fp = new THREE.Vector3(), fs = new THREE.Vector3();
  const tagList = [], boxes = [], hudBoxes = [];
  let hudAt = -9;
  const HUD_KEEP = '#people, #people > *, #minimap, #topbar, #lap, #racebox, #rlist';
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

  // (kept through a reload of this tab: the page id is left in the tab's sessionStorage as the page goes and
  // taken back as it opens, so the server knows the new page is the old one and neither counts it twice at
  // SERVER FULL nor shows it twice. Taken, not just read: a duplicated tab copies sessionStorage, and two tabs
  // with one id would close each other's connection.)
  const PAGE_W = (() => {
    let w = '';
    try { w = sessionStorage.getItem('kvissuroam.pw') || ''; sessionStorage.removeItem('kvissuroam.pw'); } catch { /* none */ }
    return /^[a-z0-9]{8,12}$/.test(w) ? w : Math.random().toString(36).slice(2, 12).padEnd(8, '0');
  })();
  addEventListener('pagehide', () => { try { sessionStorage.setItem('kvissuroam.pw', PAGE_W); } catch { /* none */ } });
  // (and taken again when the page comes back from the browser's back-forward cache)
  addEventListener('pageshow', () => { try { sessionStorage.removeItem('kvissuroam.pw'); } catch { /* none */ } });
  function send(m) { if (ws && ws.readyState === 1) ws.send(typeof m === 'string' ? m : JSON.stringify(m)); }

  async function connect() {
    await nameReady;
    await ticketReady;
    // w: this page's own random id, so the server counts a page refused with SERVER FULL once however often it asks again
    // i: this page sends its own idle car to the garage (src/idlepark.js), so the server does not judge it
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws?w=${PAGE_W}&i=1`;
    let sock;
    try { sock = new WebSocket(url); } catch { return schedule(); }
    ws = sock;
    let ping = 0;
    sock.onopen = () => {
      retry = 1; online = true; raceSeen = false; bundled = false;
      // b: 1, everyone's positions in one message ten times a second (see TICK in worker/index.js)
      send({ t: 'hello', b: 1, name, pl: plate, car: carId, k: ticket || undefined, ghost: STEALTH ? 1 : undefined, w: where || undefined, on: whereOn || undefined, kn: myKudos.kn || undefined, kf: myKudos.kn ? myKudos.kf : undefined });
      ping = setInterval(() => send('ping'), 25000);
      clockRtt = Infinity;
      clockAsk(); setTimeout(clockAsk, 1500); setTimeout(clockAsk, 4000);
      clearInterval(clockTimer); clockTimer = setInterval(() => { clockRtt *= 1.5; clockAsk(); }, 20000);
      if (driving && !STEALTH) send({ t: 'drv', on: 1 });
      flushLaps();
    };
    sock.onmessage = (e) => {
      if (e.data === 'pong') return;
      const t0 = performance.now();
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      onMessage(m);
      outside.note('net', t0);          // (time on the page outside the game's frame: src/hitches.js)
    };
    sock.onclose = (e) => {
      clearInterval(ping); clearInterval(clockTimer);
      online = false;
      if (ws === sock) ws = null;
      for (const id of [...others.keys()]) drop(id);
      // the server was full and we sat in the garage, the menu or another tab for over 30 s: our place
      // went to someone waiting, and we join again the moment we are back on the map (see setWhere)
      released = e?.code === 4002 && where !== 'map' && where !== 'watch';
      // (Martin 25 Nov: said so once back on the map and still kept out; the garage hides messages)
      if (e?.code === 4002) { full = true; kickNote = true; }
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
  // the server is over 90 % full (it says so with the welcome and whenever that changes, see room() in
  // worker/index.js): only then is a car left standing sent to the garage (src/idlepark.js)
  let tight = false;
  let kickNote = false;
  let qPos = 0;                  // our place in the queue while the server is full (1: next in)
  const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'TH' : ['TH', 'ST', 'ND', 'RD'][n % 10] || 'TH'}`;
  const kicked = () => { kickNote = false; toast('KICKED FOR INACTIVITY · ROAM OFFLINE, BACK ONLINE SOON', 6000); };
  function schedule() {
    // (2, 4, 8, 16, 32 s, then about a minute, spread: a server swamped by a surge is not asked by everyone at once
    // every 15 s, 25 Nov; a deploy is over within the first few)
    retry = Math.min(retry * 2, 64);
    clearTimeout(wsRetry);
    // (near the front of the queue it asks sooner: a place is kept for the front, Martin 25 Nov)
    // (far back, once a minute or so: 10,000 waiting after a surge must not swamp the one server, 25 Nov)
    const r = Math.random(), q = qPos || 999;
    const wait = !full ? retry * (retry > 8 ? 750 + r * 500 : 1000) : q <= 3 ? 4000 + r * 2000 : q <= 10 ? 8000 + r * 4000 : q <= 30 ? 20000 + r * 10000 : 60000 + r * 30000;
    wsRetry = setTimeout(() => { wsRetry = 0; connect(); }, wait);
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
      kn: Number.isInteger(p.kn) ? p.kn : 0, kf: kudoList(p.kf), plate: cleanPlate(p.pl) };
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
  const kinds = new Set(), kindCount = new Map();
  let kindAt = 0;
  // a car's whole model taken away (it is drawn as the stand-in until it gets one again)
  function unModel(o) {
    if (!o.model) return;
    setNear(o, false);
    dropFade(o);
    o.model = null; o.modelCar = null; o.halo = null;
  }
  // the most driven kinds take the places (see LEAN_PICK); kindCount was filled by this frame's update
  function pickKinds(now) {
    if (now - kindAt < LEAN_PICK) return;
    kindAt = now;
    if (kinds.size < LEAN_KINDS) return;
    let best = null, bn = 0, worst = null, wn = Infinity;
    for (const [id, n] of kindCount) if (!kinds.has(id) && n > bn) { best = id; bn = n; }
    // (not the kind we drive: its scanned body's pictures are our car's too, and would be sent to the card again)
    for (const id of kinds) { const n = kindCount.get(id) || 0; if (id !== carId && n < wn) { worst = id; wn = n; } }
    if (!best || !worst || bn < wn + LEAN_MARGIN) return;
    for (const o of others.values()) if (o.modelCar === worst) unModel(o);
    if (replay?.modelCar === worst) unModel(replay);
    unFade(worst);
    kinds.delete(worst);
    dropModel(worst);
    kinds.add(best);
  }
  function kindOk(id) {
    if (!lean() || kinds.has(id)) return true;
    if (kinds.size >= LEAN_KINDS) return false;
    kinds.add(id);
    return true;
  }
  // a car's see-through copies, when it is taken away
  function dropFade(o) {
    dropPlate(o.model);
    for (const e of o.model?.fade?.list || []) if (!e.mine) e.copy?.dispose();
    o.halo?.material.dispose();
  }
  function showModel(o) {
    if (o.model) { scene.remove(o.model.group); dropFade(o); }
    o.modelCar = o.car;
    o.halo = null;
    o.model = buildModel(o.car);
    if (o.plate) setCarPlate(o.model, o.plate);
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
    // (it just appeared there: its first position, or further from its last than a car goes in that time)
    if (!last || Math.hypot(p[0] - last.p[0], p[1] - last.p[1]) > Math.max(40, 110 * (t - last.t) + 15)) o.newAt = now;
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
        // (q: our place in the queue for the next free place, 0 from an older server)
        qPos = Number.isInteger(m.q) && m.q > 0 ? m.q : 0;
        if (kickNote) kicked();
        else if (!full) toast(`SERVER FULL (${Number(m.max) || 100}) · ${qPos ? `${ordinal(qPos)} IN QUEUE` : 'DRIVING OFFLINE TILL A PLACE FREES'}`, 5000);
        full = true; online = false; tight = true;
        onPeople?.('count');
        break;
      case 'welcome':
        if (full) toast('A PLACE FREED UP · ONLINE AGAIN', 3000);
        qPos = 0;
        kickNote = false;
        full = false;
        myId = m.id;
        tight = m.tight === 1;
        myWn = Number.isInteger(m.wn) ? m.wn : 0;
        if (typeof m.id === 'string') mine.add(m.id);
        // the lap ticket: proof of when this browser came online, sent along with every lap (see
        // "Lap tickets" in worker/index.js); kept across reconnects
        if (typeof m.key === 'string') ticket = m.key;
        for (const p of Array.isArray(m.players) ? m.players : []) add(p);
        onPeople?.('count');
        if (m.board) setBoard(m.board);
        break;
      case 'room':
        tight = m.tight === 1;
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
      case 'plate': {      // their own number plate, or '' for their car's own
        const o = others.get(m.id);
        if (o && typeof m.pl === 'string') { o.plate = cleanPlate(m.pl); if (o.model) setCarPlate(o.model, o.plate); }
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
        if (o) { o.kn = (o.kn || 0) + 1; o.kf = [...(o.kf || []), [m.id, m.id === myId ? name : others.get(m.id)?.name || '', Date.now()]].slice(-24); if (o === myKudos) saveKudos(); }
        onKudos?.(m.id, m.to);
        break;
      }
      case 'jmp': {         // a Rocket's kickflip (src/cars/thrust.js): its flight plan, and their clock at the press
        const o = others.get(m.id);
        // (x: the flight ended early, against a house, a tree or a bank: from here it is where its positions say)
        if (o && m.x) { o.flip = null; break; }
        const plan = unpackPlan(m.p);
        if (!o || !plan || !o.spec.thrusters || !Number.isInteger(m.c)) break;
        // (when it began, on the same clock as their positions: see addPose)
        const raw = (((Date.now() - m.c) % 60000) + 60000) % 60000, now = performance.now() / 1000;
        const late = o.base === undefined ? 0 : Math.max(0, Math.min(1500, ((raw - o.base + 90000) % 60000) - 30000));
        o.flip = { plan, t0: now - late / 1000 };
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
          if (r.ok) {
            const j = await r.json().catch(() => null);
            if (j?.board) setBoard(j.board);
            if (Array.isArray(j?.hold)) for (const h of j.hold) held.add(lapKey(h));
          }
        } else failed = true;
      } catch { failed = true; }
    }
    saveQueue();
    flushing = false;
    if (traces.length) sendReplays();
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

  // A Rocket (src/cars/thrust.js): during a kickflip its place and angles come from the flight plan it sent at the
  // press (the 'jmp' message), not from its positions: ten a second make corners of an arc and of a whole turn
  // about its long axis. And how hard each of its nozzles blows (o.noz), for the jets (src/cars/plumes.js) and
  // the hiss: from the plan in a flight, the four at the tail while it sends the BOOST flag.
  const flown = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, vy: 0 };
  function jets(o, now, dt) {
    const n = o.noz || (o.noz = new Float32Array(NOZ)), p = o.pose;
    if (!o.lean) o.lean = new Float32Array(4);                  // (how far its corner jets are swung out)
    const f = o.flip, t = f ? now - (bundled ? DELAY_BUNDLED : DELAY) - f.t0 : -1;
    // (to its wheels' first touch, where its driver has the car again: thrust.js, touchTime)
    const end = f ? touchTime(f.plan, o.spec) : 0;
    if (f && (t > end || !p || !o.live)) o.flip = null;
    if (f && p && o.live && t >= 0 && t <= end) {
      flightPose(f.plan, t, flown);
      p[0] = flown.x; p[1] = flown.z; p[2] = flown.y; p[3] = flown.yaw; p[4] = flown.pitch; p[5] = flown.roll;
      p[6] = f.plan.vx; p[7] = f.plan.vz;
      for (let k = 15; k < 20; k++) p[k] = 0;                    // (in the air: no tyre slides or marks)
      flightNozzles(f.plan, t, n, o.spec, o.lean);
      return;
    }
    const rear = p && o.live && (p[20] & BOOSTING) ? 1 : 0, k = Math.min(1, dt / 0.05);
    for (let i = 0; i < NOZ; i++) n[i] += ((i < NOZ_DOWN ? rear : 0) - n[i]) * k;
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
  // A pair that passed through each other (o.thru) does not start bumping while the two still overlap: a car
  // leaving the start lane, or ending its lap, inside another one would be thrown out of it sideways. They bump
  // again once they have come apart.
  function collide(car) {
    if (STEALTH) return;                                         // they cannot see us, so nobody bumps
    // on a lap of our own, or just put on the start and in its lane: nobody can touch us
    const mine = hotlap() || fresh(), nowS = performance.now() / 1000;
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
    for (const o of others.values()) {
      const p = o.pose;
      if (!p) continue;
      if (o.flip) continue;                                      // a Rocket in the air on a kickflip: over us
      const dx = car.x - p[0], dz = car.z - p[1];
      if (dx * dx + dz * dz > 64 || Math.abs(car.y - p[2]) > 2.5) { o.thru = false; continue; }
      // they are on a lap or in the start lane: we pass through them (and in the race from the grid on, even
      // before their flag arrives)
      if (mine || (p[20] & THRU) || racing(o.id) || nowS - (o.newAt || 0) < NEW_S) { o.thru = true; continue; }
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
      if (best <= 0) { o.thru = false; continue; }
      if (o.thru) continue;
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

  // the other cars within r metres of (x, z) that ours would bump (not those on a lap or in the race), as [x, z]:
  // for a free spot at the start (src/race/startslots.js)
  function carsNear(x, z, r) {
    const out = [];
    for (const o of others.values()) {
      const p = o.pose;
      if (!p || (p[20] & HOT) || racing(o.id)) continue;
      if ((p[0] - x) ** 2 + (p[1] - z) ** 2 < r * r) out.push([p[0], p[1]]);
    }
    return out;
  }

  // Another player's car as the sound, smoke and tyre mark code wants it: the same fields as our own car
  // after its physics step, rebuilt from what that browser sends.
  const fxList = [];
  function effects(o, p, fx, fz) {
    const s = o.spec, r = o.fx || (o.fx = {});
    const sx = -fz, sz = fx, flags = p[20] || 0, has = p[14] !== undefined;
    r.id = o.id; r.spec = s;
    r.x = p[0]; r.z = p[1]; r.y = p[2]; r.yaw = p[3]; r.steer = p[8];
    r.pitch = p[4]; r.roll = p[5]; r.noz = s.thrusters ? o.noz : null; r.lean = o.lean;   // (a Rocket's nozzles: see jets)
    r.a = s.wheelbase * s.cgFront; r.b = s.wheelbase * (1 - s.cgFront);
    r.vx = p[6] * fx + p[7] * fz; r.vy = p[6] * sx + p[7] * sz;
    r.reversing = !!p[10];
    r.soot = !!s.dpfSmoke && p[12] !== undefined;
    r.throttle = p[12] || 0; r.boost = p[13] || 0;
    r.tyres = has;                                                // false for a browser still on an older version
    r.rpm = has ? p[14] : 0;
    r.slipV = r.slipVF = r.slipVR = has ? p[15] : 0;
    r.skidF = has ? p[16] : 0; r.skidR = has ? p[17] : 0; r.rubF = has ? p[18] : 0; r.rubR = has ? p[19] : 0;
    r.revCut = flags & 1; r.inWater = !!(flags & 2); r.paved = !!(flags & 4); r.fanOff = !!(flags & FANS_OFF);
    // (the ground under it, for the sound of its wheels spinning on loose ground: 1 paved, 2 gravel, 3 dirt, 0 grass)
    r.ground = r.paved ? 1 : flags & 16 ? 2 : flags & 32 ? 3 : r.inWater ? 4 : 0;
    return r;
  }

  const v3 = new THREE.Vector3();
  let nearest = 0;                 // metres from our car to the nearest other one, last frame
  // Ghost cars fade near ours (Martin 2026-11-24): when we pass through each other (a hotlap, the online race,
  // the Raadi stage, where everybody starts from one spot, the start lane of a car just put on the start), a car
  // on our spot is drawn at FADE_MIN and comes back gradually, solid once FADE_AHEAD metres ahead or behind or
  // FADE_SIDE to the side. Its name, HOTLAP tag and glow fade too, but only a touch (to TAG_MIN). Free driving,
  // where cars bump, is as it was.
  // A car's pieces share their materials with every other copy of that car (cars/models/index.js), so a fading
  // car gets see-through copies of its own, made the first time it comes close and kept; its lamp and soot
  // materials are its own already and are changed in place. See-through is another shader, compiled ahead
  // (`warm`, once per kind of car) and only then used: until it is ready the car stays solid.
  // (Martin 2026-11-25: "ghosts look a bit patchy now". A faded car was blended over the picture piece by piece, and
  // a scanned body is one piece that shows both its sides, its triangles in no order: where the far side or the
  // inside came first it showed through the near side, where it came later it did not. With edge smoothing, a
  // desktop with a graphics card, the solid pieces of a faded car are no longer blended: they are drawn with the
  // solid things, each filling its strength's share of every pixel's samples (COVER_FADE above), all pieces the
  // same samples, so the nearest surface is all that shows. No more work than blending: no sorting, nothing drawn
  // twice, the same number of shaders. Without edge smoothing, phones and the weakest computers, that would be a
  // screen door of whole pixels, plain to see as dots at their coarse picture, so there the pieces are blended as
  // before, patches and all (one side of each piece only was tried: the scans' triangles face either way, and it
  // looked worse). Glass and soot, see-through as they are, are blended as before everywhere.)
  const cover = samples > 1;
  // a solid piece's material see-through, or solid again
  const see = (m, on) => {
    if (cover) {
      if (on) m.defines = { ...m.defines, COVER_FADE: (1 / samples).toFixed(4) }; else delete m.defines.COVER_FADE;
      m.alphaToCoverage = on;
    } else m.transparent = on;
    m.needsUpdate = true;
  };
  const FADE_MIN = 0.1, FADE_AHEAD = 10, FADE_SIDE = 5, TAG_MIN = 0.6;
  const fadeWarm = new Map();        // car id -> 'busy' | true
  const fadeKeep = new Map();        // car id -> the see-through clones that keep its programs (see warmFade)
  const unFade = (id) => { fadeWarm.delete(id); for (const t of fadeKeep.get(id) || []) t.dispose(); fadeKeep.delete(id); };
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
  // (Martin 2026-11-24, a race of almost 30: making a kind of car's see-through shaders ready took 13 to 30 ms in one
  // go, once for each kind of car, and in a race many kinds come close at the start. Now one piece of the car a frame,
  // through the work queue, and begun when such a car is FADE_EARLY metres off, so it is mostly ready when it is close.)
  const FADE_EARLY = 80;
  function warmFade(o) {
    if (!warm) { fadeWarm.set(o.car, true); return; }
    fadeWarm.set(o.car, 'busy');
    // (what is see-through already is drawn faded by the shader it has)
    const id = o.car, list = fadeParts(o).list.filter((e) => !e.tr).map((e) => ({ geo: e.c.geometry, mat: e.base, rs: e.c.receiveShadow, cs: e.c.castShadow }));
    jobs.add(function* fadeShaders() {
      const waits = [], made = [];
      for (const e of list) {
        yield 'frame';
        const t = e.mat.clone(); see(t, true); t.opacity = 0.5;
        const q = new THREE.Mesh(e.geo, t); q.receiveShadow = e.rs; q.castShadow = e.cs;
        const g = new THREE.Group(); g.add(q);
        made.push(t);
        waits.push(Promise.resolve(warm(g)).catch(() => {}));
      }
      // (the clones are kept while this kind is about: a disposed material lets its program go when no other
      // uses it, and the real see-through copies then built theirs anew in the frame that drew them)
      Promise.all(waits).then(() => { if (fadeWarm.get(id) === 'busy') { fadeWarm.set(id, true); fadeKeep.set(id, made); } else for (const t of made) t.dispose(); });
    }, 'see-through car');
  }
  function setFade(o, a) {
    const f = fadeParts(o);
    if (Math.abs(a - f.a) < 0.01 && a !== 1) return;
    if (a === f.a) return;
    const solid = a >= 1;
    for (const e of f.list) {
      if (!e.mine && !e.copy) { e.copy = e.base.clone(); if (!e.tr) see(e.copy, true); }
      const m = e.copy;
      if (e.mine && !e.tr && solid === !!e.on) see(m, (e.on = !solid));
      m.opacity = e.op * a;
      if (!e.mine) e.c.material = solid ? e.base : m;
    }
    f.a = a;
  }
  let wholeCut = Infinity, shadowCut = Infinity;
  const dsBuf = [];
  // ---- Lap record replays (src/race/replay.js): one car at a time, drawn like another player's (not in the online
  // list, the map or the race; nobody bumps it), its pose read from the recorded lap instead of the network.
  const REPLAY_ID = '~replay';           // (not a server id: those are letters and digits, see cleanOn in worker/index.js)
  let replay = null;
  // seconds into the lap: they run once the camera is on it and the car is built (spectate.js sets rp.run)
  function replayPose(o, dt) {
    const r = o.rp, dur = r.ms / 1000;
    if (r.run && o.model && o.modelCar === o.car && o.model.warmed !== false && !r.ended) {
      r.t += Math.min(dt, 0.25);
      if (r.t >= dur) { r.t = dur; r.ended = performance.now() / 1000; }
    }
    o.live = !r.ended;
    replayAt(r, r.t, r.out);
    if (r.ended) { r.out[6] = r.out[7] = 0; for (let k = 9; k < STAMP; k++) r.out[k] = 0; }    // (stopped past the line, engine off)
    return r.out;
  }
  function stopReplay() {
    if (!replay) return;
    const o = replay;
    replay = null;
    if (o.model) { scene.remove(o.model.group); dropFade(o); }
    o.el.remove();
    o.dropped = true;
  }
  // a replay to watch: { track, car, ms, name, frames } (loadReplay); its car is mp.remote(REPLAY_ID)
  function playReplay(rp) {
    stopReplay();
    const el = document.createElement('div');
    el.className = 'pname';
    el.textContent = rp.name;
    el.style.display = 'none';
    labels.appendChild(el);
    const o = { id: REPLAY_ID, name: rp.name, colour: '#ff9a3c', car: null, model: null, modelCar: null, el, tagOn: false, buf: [], pose: null, wheel: 0, w: '', wn: 0, kn: 0, kf: [],
      rp: { ...rp, t: 0, run: false, ended: 0, out: new Array(STAMP).fill(0), tag: `REPLAY · ${fmtTime((rp.lapMs || rp.ms) / 1000)}` } };
    setRemoteCar(o, rp.car);
    o.pose = replayAt(o.rp, 0, o.rp.out);
    replay = o;
    return REPLAY_ID;
  }
  // the record lap of a car on a circuit, from the server (null: none kept)
  async function loadReplay(track, car) {
    const r = await fetch(`/api/replay?track=${encodeURIComponent(track)}&car=${encodeURIComponent(car)}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const name = decodeURIComponent(r.headers.get('x-name') || ''), ms = Number(r.headers.get('x-ms'));
    const rp = await unpack(new Uint8Array(await r.arrayBuffer()));
    return { ...rp, track, car, name, lapMs: ms };
  }

  // Our record laps' replays: a lap's samples wait here (in memory only, they are big) until the server has the
  // lap, then go there only if the lap is the car's record on the board. One request a record; none otherwise.
  const traces = [];
  // laps the server holds off the board until their replay has come (worker/index.js: a car's best of all time or of
  // today needs its drive since 25 Nov 2026), by lapKey
  const held = new Set();
  // The lap timer started (e 's') or a lap of ms was finished (e 'f'), told to the server at that moment: it times
  // the lap by its own clock, and a lap that would be a record counts only if that agrees with the lap time
  // (worker/index.js lapMark). Over the connection, or by a request when there is none (the server full).
  let marksDone = Promise.resolve();
  function lapMark(e, ms) {
    if (STEALTH) return;
    if (ws && ws.readyState === 1 && myId) { send(e === 'f' ? { t: 'lm', e, ms } : { t: 'lm', e }); return; }
    if (!ticket) return;
    const p = fetch('/api/mark', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ k: ticket, e, ms }) }).catch(() => {});
    marksDone = marksDone.then(() => p);
  }
  async function sendReplays() {
    await marksDone;                                               // (the lap's marks are there before its drive is)
    for (let i = traces.length - 1; i >= 0; i--) {
      const { lap, trace } = traces[i];
      if (!sent.has(lapKey(lap))) continue;                       // (not answered yet)
      traces.splice(i, 1);
      const best = (lap.track ? board?.[lap.track] : board)?.allTime?.find((r) => r.car === lap.car);
      if (!held.delete(lapKey(lap)) && (!best || best.ms !== lap.ms || best.name !== name)) continue;
      try {
        const z = await pack(trace, jobs);
        await fetch('/api/replay', { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ k: lap.k, car: lap.car, ms: lap.ms, track: lap.track || undefined, z }) });
        refreshBoard();
      } catch { /* the lap stands without a replay */ }
    }
  }
  function refreshBoard() {
    fetch('/api/board', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((b) => { if (b) setBoard(b); }).catch(() => {});
  }

  // Our car as a position for the others (and for a lap's replay, src/race/replay.js): the first STAMP values of
  // what goes out, unrounded (the sender rounds them to POSE_DEC decimals). hot: flag 8, the lap timer is running.
  const sendPose = new Float64Array(STAMP);
  function poseNow(car, out, hot = false, lane = false) {
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), rx = Math.cos(car.yaw), rz = Math.sin(car.yaw);
    out[0] = car.x; out[1] = car.z; out[2] = car.y; out[3] = car.yaw; out[4] = car.pitch; out[5] = car.roll;
    out[6] = car.vx * fx + car.vy * rx; out[7] = car.vx * fz + car.vy * rz; out[8] = car.steer; out[9] = car.brake > 0 ? 1 : 0; out[10] = car.reversing ? 1 : 0;
    // (for a sooty diesel: how black its tail is, and the pedal and boost that make its smoke; the pedal
    // is sent as lifted during a gear change and for long enough after it to be seen at this send rate,
    // which cuts the smoke on the other side too)
    out[11] = 0.95 * (1 - Math.exp(-(car.sootKm || 0) / 2.2)); out[12] = shiftHold > 0 ? 0 : car.throttle || 0; out[13] = car.boost || 0;
    // what the others need to hear this car and see its tyres smoke and mark the road: engine revs,
    // wheelspin, how hard each axle is sliding and rubbing, and flags (1 on the rev limiter, 2 in water,
    // 4 on paving, 8 on a hotlap: the lap timer is running, 16 on gravel, 32 on dirt; none of 4/16/32 out of
    // the water is grass; 64 just put on the start and in the start lane; 128 a Rocket's BOOST; 256 its fans switched off)
    out[14] = car.rpm || 0; out[15] = car.slipV || 0; out[16] = car.skidF || 0; out[17] = car.skidR || 0; out[18] = car.rubF || 0; out[19] = car.rubR || 0;
    out[20] = (cutHold > 0 ? 1 : 0) | (car.inWater ? 2 : 0) | (car.surface === 1 ? 4 : 0) | (hot ? HOT : 0) | (lane ? FRESH : 0) | (car.surface === 2 ? 16 : car.surface === 3 ? 32 : 0) | (car.thrustN > 0 ? BOOSTING : 0) | (car.fanOff ? FANS_OFF : 0);
    return out;
  }
  function update(car, dt, active) {
    const now = performance.now() / 1000;
    // send our position while anyone else is online
    sendTimer -= dt;
    shiftHold = car && car.shiftTimer > 0 ? 0.3 : shiftHold - dt;
    cutHold = car && car.revCut > 0 ? 0.15 : cutHold - dt;
    // (in a race also with nobody else online: the server follows each racer's lap from these, worker/follow.js)
    // (and on a lap: the server holds a record's drive against where it saw the car meanwhile, worker/livecheck.js)
    if (active && !STEALTH && (others.size || racing(myId) || hotlap()) && sendTimer <= 0 && ws && ws.readyState === 1) {
      // (a spectator follows our car: full rate for them, wherever the others are)
      sendTimer = 1 / (nearest < CLOSE || racing(myId) || watchedNow() ? SEND_HZ : nearest < LONELY ? SEND_HZ_MID : SEND_HZ_FAR);
      const p = poseNow(car, sendPose, hotlap(), fresh());
      const out = new Array(STAMP + 1);
      for (let k = 0; k < STAMP; k++) out[k] = Math.round(p[k] * POSE_SC[k]) / POSE_SC[k];
      // when this position was taken, by our own clock (ms within the minute; see addPose)
      out[STAMP] = Date.now() % 60000;
      send({ t: 's', p: out });
    }
    // (on a lap with no connection, the server full or the line down for a moment: where the car is goes to the
    // server every 3 s by a request, as the lap's marks do)
    if (active && !STEALTH && ticket && hotlap() && !(ws && ws.readyState === 1 && myId)) {
      placeTimer -= dt;
      if (placeTimer <= 0) {
        placeTimer = 3;
        fetch('/api/mark', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ k: ticket, e: 'p', x: Math.round(car.x), z: Math.round(car.z) }) }).catch(() => {});
      }
    } else placeTimer = 0;
    const W = innerWidth, H = innerHeight;
    fxList.length = 0;
    tagList.length = 0;
    const pulse = 0.7 + 0.3 * Math.sin(now * 4.5);
    const ghostMe = hotlap() || fresh(), me = active && car, racingMe = !!myId && racing(myId);
    const cam = camera.position, detail = low() ? DETAIL_LOW : DETAIL, farMax = Math.min(FAR, camera.far);
    let near2 = Infinity, copied = false;
    const ds = dsBuf;
    for (const o of replay ? [...others.values(), replay] : others.values()) {
      o.pose = o.rp ? replayPose(o, dt) : sample(o, now);
      if (o.spec.thrusters && !o.rp) jets(o, now, dt);
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
      if (p && lean() && o.live && (racingMe ? racing(o.id) : d < LEAN_POOL)) kindCount.set(o.car, (kindCount.get(o.car) || 0) + 1);
      // (a phone: someone changed to a kind it does not build: the stand-in, not their old car)
      if (o.model && o.modelCar !== o.car && lean() && !kinds.has(o.car)) unModel(o);
      const g = o.model?.group;
      if (!p) { if (g) setNear(o, false); showTag(o, false); continue; }
      const fx = Math.sin(p[3]), fz = -Math.cos(p[3]);
      // whole car near, a block further out (a little either way before it changes: no flicker at the edge);
      // a block too while its car is not built (yet, or on a phone not at all: see LEAN_NEAR)
      const whole = !!g && o.model.warmed !== false;
      if (whole && d < detail * 1.15) ds.push(d);
      const near = whole && d < (o.near ? Math.min(detail * 1.15, wholeCut * 1.08) : Math.min(detail, wholeCut));
      if (g) setNear(o, near);
      if (!near) {
        if (d < farMax) {
          // its own shape and colour (STANDINS), else the general one scaled to its size
          const fk = far.of(o.car), fmesh = fk || far.mesh;
          fp.set(p[0] + fx * o.off, p[2], p[1] + fz * o.off);
          fq.setFromEuler(fe.set(p[4], -p[3], -p[5]));
          let paint;
          if (fk) { fs.set(1, 1, 1); paint = fk.userData.paint; } else {
            const sz = whole ? o.model.size : null;
            paint = whole ? o.paint : o.plain || (o.plain = new THREE.Color(o.colour));
            fs.set(sz?.width ?? o.halfWid * 2, sz?.height ?? 1.45, sz?.length ?? o.halfLen * 2);
          }
          const u = fmesh.userData, n = u.n++;
          fmesh.setMatrixAt(n, fm.compose(fp, fq, fs));
          if (u.cols[n] !== paint) { u.cols[n] = paint; fmesh.setColorAt(n, paint); u.rc = true; }
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
        // (made ready ahead, while the car is still a little way off)
        if (me && d < FADE_EARLY && !fadeWarm.has(o.car) && (ghostMe || (p[20] & THRU) || racing(o.id))) warmFade(o);
        if (me && (ghostMe || (p[20] & THRU) || racing(o.id))) {
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
        const sh = d < (o.shadow ? Math.min(SHADOW_DIST, shadowCut * 1.08) : Math.min(SHADOW_DIST, shadowCut));
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
    if (lean()) { pickKinds(now); kindCount.clear(); }
    // the nearest WHOLE (and SHADOWS) cars only, by last frame's distances (see WHOLE)
    ds.sort((a, b) => a - b);
    const wholeMax = low() ? WHOLE_LOW : WHOLE;
    wholeCut = ds.length > wholeMax ? ds[wholeMax - 1] + 0.01 : Infinity;
    shadowCut = ds.length > SHADOWS ? ds[SHADOWS - 1] + 0.01 : Infinity;
    ds.length = 0;
    for (const m of far.all) {
      const u = m.userData;
      if (m.count !== u.n) { m.count = u.n; m.visible = u.n > 0; }
      if (u.n) m.instanceMatrix.needsUpdate = true;
      if (u.rc) { m.instanceColor.needsUpdate = true; u.rc = false; }
      u.n = 0;
    }
    // floating names over the nearest few only: held well above the roof (and lifted a little more on screen,
    // past the record line that hangs under it), so a player ahead does not hide the racing line (Martin 2026-11-23)
    const most = low() ? TAGS_LOW : TAGS;
    tagList.sort((a, b) => a.d - b.d);
    let shown = 0;
    // the HUD's own corners (online list, minimap, buttons, lap clock, race list) are kept free of names: on a
    // phone a near car's name and HOTLAP badge covered the online list (Martin 2026-11-24). Measured once a second.
    if (tagList.length && now - hudAt > 1) {
      hudAt = now;
      hudBoxes.length = 0;
      for (const el of document.querySelectorAll(HUD_KEEP)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) hudBoxes.push({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2, hw: r.width / 2, hh: r.height / 2 });
      }
    }
    for (const o of tagList) {
      if (shown >= most) { showTag(o, false); continue; }
      const p = o.pose;
      const hot = o.live && !!(p[20] & HOT);
      if (hot !== !!o.hot) { o.hot = hot; o.el.classList.toggle('hot', hot); }
      // in a race with us: their place instead of HOTLAP (Martin 2026-11-24), written only when it changes
      const pl = place(o.id);
      if (pl !== (o.pl || 0)) { o.pl = pl; if (pl) o.el.dataset.pos = `P${pl}`; else delete o.el.dataset.pos; }
      // won the last race (or is first over the line in this one): WINNER over their name instead of HOTLAP
      const won = !pl && winner(o.id);
      if (won !== !!o.won) { o.won = won; o.el.classList.toggle('won', won); }
      const ta = o.near ? Math.round((o.tagA ?? 1) * 50) / 50 : 1;
      if (ta !== (o.ta ?? 1)) { o.ta = ta; o.el.style.opacity = ta === 1 ? '' : ta; }
      const rec = o.rp ? o.rp.tag : recs.size ? recordOf(o.name) : '';
      if (rec !== (o.rec || '')) { o.rec = rec; if (rec) o.el.dataset.rec = rec; else delete o.el.dataset.rec; }
      v3.set(p[0], p[2] + 3.0, p[1]);
      v3.project(camera);
      if (v3.z > 1 || Math.abs(v3.x) > 1.1 || Math.abs(v3.y) > 1.1) { showTag(o, false); continue; }
      const sc = Math.max(0.55, Math.min(1.2, 28 / o.d));
      // its box on screen (from the name's length: measuring the page each frame would cost more than it saves)
      // (a badge over the name, HOTLAP or WINNER or P3 or a record line, makes it about twice as tall)
      const tall = hot || pl || won || rec ? 13 * sc : 0;
      const x = ((v3.x + 1) / 2) * W, y = ((1 - v3.y) / 2) * H - 34 * sc - tall, hw = (o.name.length * 5.5 + 12) * sc, hh = 11 * sc + tall;
      let covered = false;
      for (const q of hudBoxes) if (Math.abs(q.x - x) < q.hw + hw && Math.abs(q.y - y) < q.hh + hh) { covered = true; break; }
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
    carsNear,
    get name() { return name; },
    get online() { return online; },
    // the server was full: driving offline until a place frees (see schedule)
    get full() { return full; },
    // the server is over 90 % full: a car left standing is sent to the garage (src/idlepark.js)
    get tight() { return tight; },
    // our place in the queue while full (0: not known)
    get queuePos() { return qPos; },
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
      if (badName(n)) return null;           // a racist slur: not taken, the box flashes (race/board.js)
      if (!n || n === name) return name;
      name = n; lsSet(NAME_KEY, n);
      send({ t: 'name', name: n });
      return name;
    },
    // our own number plate ('' for each car's own): a bad one is not taken, and the box flashes (race/board.js)
    get plate() { return plate; },
    setPlate(p) {
      p = cleanPlate(p);
      if (p && (badName(p) || badName(p.slice(4)))) return null;
      if (p === plate) return plate;
      plate = p; lsSet(PLATE_KEY, p);
      send({ t: 'plate', pl: p });
      onPlate?.(p);
      return plate;
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
    remote(id) { return id === REPLAY_ID ? replay : others.get(id) || null; },
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
    // our Rocket has left the ground on a kickflip: the plan of the whole flight, for the others to fly it by
    sendFlip(plan) {
      if (STEALTH || !others.size) return;
      if (!plan) { send({ t: 'jmp', x: 1 }); return; }
      send({ t: 'jmp', p: packPlan(plan), c: (((Date.now() - Math.round(plan.t * 1000)) % 60000) + 60000) % 60000 });
    },
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
    lapMark,
    // trace: the lap's samples (src/race/replay.js), sent on if the lap is the car's record
    submitLap(lap, trace) {
      if (STEALTH) return;                                       // kept in this browser only (race.js)
      const l = { name, car: lap.car, ms: lap.ms, at: lap.at, splits: lap.splits, cp: lap.cp, k: ticket || undefined, inp: lap.inp, ty: lap.ty, track: lap.track, pen: lap.pen };
      if (trace && l.k) { traces.push({ lap: l, trace }); if (traces.length > 3) traces.shift(); }
      enqueue(l);
      saveQueue();
      flushLaps();
    },
    refreshBoard,
    // our car's position values now (a lap's replay is made of these: src/race/replay.js)
    pose: (car, out) => poseNow(car, out),
    loadReplay,
    playReplay,
    stopReplay,
    get replay() { return replay; },
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
