// LINNARING server: the static game is served as assets; this Worker answers /api/*.
//
// One Durable Object ("lobby") holds everyone who has the game open. Each browser keeps a
// WebSocket to it and sends its car's position about ten times a second while someone else is
// online; the lobby passes positions on to the others and announces joins, leaves and name
// changes. The sockets use the hibernation API, so an idle lobby costs nothing.
//
// Lap times live in the lobby's SQLite storage (table `laps`). GET /api/laps.csv downloads all
// of them; GET /api/board gives the best lap per car, all time and today (Tartu time). The times of
// the Raadi rally stage are kept in the same table (track 'raadi', Martin 23 Nov 2026) and go out in
// the same board, under `raadi`.
//
// Nobody logs in, so everything a browser sends is treated as hostile: see "Limits" and "Lap
// tickets" below for what keeps one visitor from spoiling the board, freezing the other players'
// games or using up the free plan's daily allowance.
import { DurableObject } from 'cloudflare:workers';
import { moved } from './moved.js';
export { Stats } from './stats.js';
import { CARS, HIDDEN_CARS } from '../src/cars/specs.js';
import { RaceDesk, SEEN_EARLY } from './race.js';
import { DragDesk } from './drag.js';
import LAP from '../src/race/track.json';
import STAGE from '../src/race/raadi.json';
import { throughGate } from '../src/race/lapgates.js';
import { LAP_GATES, MAX_SKIPS } from './follow.js';
import { ADJ, NOUN } from '../src/net/names.js';
import { badName } from './badnames.js';
import { cleanPlate } from '../src/net/plates.js';
import { carLimitsSteps, judgeDrive, OVER_MAX, GAS_OVER } from '../src/race/plausible.js';
import { OLD_PAGES_UNTIL, LIVE_FROM } from './cutover.js';
import { liveCheck, liveOk, LIVE_MS, LIVE_MIN, LIVE_MAX, LIVE_MISS } from './livecheck.js';
import { makeTops, addTop, newDay, topOf, placeOf } from './tops.js';
import { stageCheck } from './stagecheck.js';
import { ROOM_AT, alwaysJudged } from '../src/idlepark.js';
import { CRASH_PEN, crashesIn } from '../src/cars/crash.js';
import { KUDOS_GAP_S, KUDOS_PAIR, KUDOS_KEEP, kudosFrom, kudosFair } from '../src/net/kudosrules.js';

const TRACK = 'toomemagi';
const TOP_N = 10;                 // a lap among its car's ten best waits for its drive to be judged (wouldLead)
// The shortest time believed on each circuit (driving time, penalty seconds left out). Until 25 Nov 2026 these were
// 60 s and 45 s, and a lap of 61 s posted by hand would have topped the board (security review: the record was
// 2:40.25). Toomemägi, 4.9 km: 2:00 is 147 km/h on average through the town. Raadi's stage, 1.73 km of gravel:
// 70 s is 89 km/h (the best so far is 3:16).
const LAP_MIN = 120000;
const MARK_MIN = 30000;      // a lap or stage run timed by the server's clock is at least this long (each track's own least time is asked of the lap itself)
// the other circuits whose times are kept, with that shortest time
const STAGES = { raadi: 70000 };
// New laps from one address in an hour, and laps under one name in a Tartu day (a ticket saved up for hours could
// post its laps all at once, 50 a request: thousands a minute from one script). A lap takes over 2 minutes, so one
// player drives under 30 an hour; this leaves room for a household or a classroom behind one address.
const LAPS_IP_HOUR = 120, LAPS_NAME_DAY = 300;
// A lap as the server's own clock timed it, from the page's marks at its start and finish (see lapMark), against
// the lap time the page gives: the server's may be this much shorter (a mark slow on its way) or longer (the same,
// and the 2 s of freezes a lap is forgiven: SLOW_FREE in src/race/race.js). Past that the lap was not driven in
// real time (slow motion: the game slows down under 20 frames a second, and the lap clock once slowed with it).
// How far the server's clock may be from a lap's time. More than the lap time is what slow motion looks like: 2 s
// the page's own clock may lose to slow frames (SLOW_FREE in src/race/race.js) and 1.5 s for the finish mark's way
// here. Less than the lap time is a start mark held up on its way: 1.5 s (5 s for an hour on 26 Nov 2026; Martin:
// "this back to 1.5s actually instead of 5").
const CLOCK_UNDER = 1500, CLOCK_OVER = 3500;
const cleanTrack = (s) => (typeof s === 'string' && Object.hasOwn(STAGES, s) ? s : TRACK);

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
const tartuDay = (d = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Tallinn' }).format(d);   // YYYY-MM-DD
// A driver name: no control characters or angle brackets, none of the invisible characters that
// reverse or hide text, at most two stacked accents on a letter, 20 characters.
const cleanName = (s) => String(s ?? '').normalize('NFC')
  .replace(/[\u0000-\u001f\u007f-\u009f<>­؜᠎​-‏‪-‮⁠-⁯﻿￹-￻]/g, '')
  .replace(/(\p{M}{2})\p{M}+/gu, '$1')
  .replace(/\s+/g, ' ').trim().slice(0, 20).trim();
// only cars the game has (anything else, such as "constructor", broke the other browsers)
// (a car not shown to anyone yet is no car here: not driven online, no laps of it on the board; SHOW_HIDDEN=1
// in a local test server's variables lets them in, for tools/rocket-online-test.mjs)
let showHidden = false;
const cleanCar = (s) => (typeof s === 'string' && Object.hasOwn(CARS, s) && (showHidden || !HIDDEN_CARS.includes(s)) ? s : '');
const cleanWhere = (w) => (w === 'map' || w === 'garage' || w === 'away' || w === 'watch' ? w : '');
// whom a spectator watches (Martin, 2026-11-23): another player's id, short letters and digits only
// one received thumbs up: [sender id, their name then, when (ms)]; a bare id from pages before 24 Nov
const cleanKudo = (v) => {
  if (typeof v === 'string') { const id = cleanOn(v); return id ? [id, '', 0] : null; }
  if (!Array.isArray(v)) return null;
  const id = cleanOn(v[0]);
  return id ? [id, okName(v[1]), Number.isFinite(v[2]) ? Math.max(0, Math.floor(v[2])) : 0] : null;
};
// a name others may see: clean, and not a racist slur ('' if it is one, see badnames.js)
const okName = (s) => { const n = cleanName(s); return n && !badName(n) ? n : ''; };
// a number plate others may see: "123 ABC" (src/net/plates.js), and no swearing or slur in it, read as a name
// is, the letters alone too ('' if it is one: the player's car then keeps its own plate, and nobody is told)
const okPlate = (s) => { const p = cleanPlate(s); return p && !badName(p) && !badName(p.slice(4)) ? p : ''; };
const cleanOn = (v) => (typeof v === 'string' && /^[\w-]{1,16}$/.test(v) ? v : '');

// ---- Limits
const MAX_SOCKETS = 100;          // everyone with the game open (150 until 2026-11-24: Martin capped online play at 100, about the most
                                  // one lobby carries smoothly); the next one is told FULL and drives offline until a place frees
const IDLE_MS = 30000;            // in the garage, the menu or another tab this long: gives up the place when the server is full (seats; 2 min until Martin 25 Nov)
// (25 Nov, ready for a surge of thousands at once, a Reddit post: far back in the queue a page asks only every 60 to
// 90 s, so 10,000 waiting are about 130 questions a second; the front asks every 4 to 6 s)
const QUEUE_FRESH = 150000;       // a waiting page that asked again within this long holds its place in the queue
const WAIT_GONE = 180000;          // quiet this long (no new question), a refused page gave up waiting
const WAIT_MAX = 50000;            // pages remembered as waiting
const MAX_SOCKETS_IP = 30;        // from one address (a household, a LAN party, a school or office behind one address: 12 until 2026-11-24)
// ... while there is room. Once the server is IP_TIGHT_AT full a new connection is let in only up to IP_TIGHT from its
// address (26 Nov 2026: one script could sit on 30 of the 100 places, four addresses on all of them). Those already
// in stay: a classroom that came early keeps its places.
const IP_TIGHT_AT = 0.8, IP_TIGHT = 8;
const MSG_WINDOW = 2000, MSG_MAX = 60;   // messages a socket may send in two seconds (the game sends 20)
// Messages other than positions and clock asks change something the others hear about or that is stored
// (car, name, where, driving, race votes and joins, thumbs up): each goes to everyone online, and a race one is
// written to storage too. The game sends a few a minute (a car pick waits till the browsing stops), so more than
// this in 15 s is a script, and the socket is shut (25 Nov: one socket could make 100 others hear 30 a second).
const LOUD_WINDOW = 15000, LOUD_MAX = 30;
const DAY = 86400000;
// Positions in bundles (Martin 2026-11-23, 22 online and more coming): a page that says so in its hello
// (b: 1) gets every other car's newest position in ONE message ten times a second, instead of one
// message per car per update. 22 players: 210 messages a second into each browser and 4,600 out of here
// become 10 and 220. Cars far from the receiving one go less often (they are a block on its horizon or an
// arrow on its map). Each entry carries how long ago its position came in, so the page puts it at its
// true moment and the car glides as smoothly as before. Pages from before this get single messages at once.
const TICK = 100;                                     // ms between bundles
const POSE_FAR = 600, POSE_FAR_MS = 300;              // further than this from the receiver: about 3 a second
const POSE_VFAR = 2000, POSE_VFAR_MS = 1000;          // and once a second this far
const POSE_KEEP = 5000;                               // a car that has not sent for this long is left out
// Positions that hang together (26 Nov 2026: a script could put a car that does not exist onto any free-roaming
// player at 540 km/h, and each page pushes its own car out of another's and takes a knock by the speed that car
// claims). A page moves its own car and the server cannot know where it really is, but it can hold each position
// against the one before:
//   a jump    further than V_MAX allows for the time between the two: the car just appeared there (R, the map, the
//             start, a made-up place), as it does with its first position and after a silence of GAP_MS. For
//             FRESH_MS it goes on to the others flagged as a car just put on the start is (64): every page passes
//             through such a car. A car may make JUMPS_MAX jumps at once and one more every JUMP_LEAK ms; past
//             that its positions are not passed on until it calms down.
//   its speed the speed a position claims is cut to what the car is seen to move at (from where it was half a
//             second ago to where it is, and a little more): a car standing beside another cannot claim to hit it
//             at 300.
// The time between two positions is the sender's own (each carries when it was taken: positions reach the server in
// bunches after a hiccup on the way, a tenth of a second apart in truth), as long as the sender's clock does not run
// ahead of the server's: how far ahead it has ever been is kept (top), and a stamp past that is not believed.
// V_MAX is for any car; one seen going over V_ASK has its own top speed looked up (carLimit: the game's physics,
// once per kind of car) and is held to TOP_K of that from then on.
const V_MAX = 116, STEP_ROOM = 1;                     // m/s (418 km/h; 110 until the Roadster Rocket, shown to nobody yet, was given its 405), and metres
const V_ASK = 45, V_TOP_K = 1.15, V_TOP_ROOM = 3;
const GAP_MS = 1500, FRESH_MS = 2000, FLAG_FRESH = 64;
const JMP_NEAR = 60;                                  // m from its last position a Rocket's kickflip may start ('jmp')
const JUMPS_MAX = 12, JUMP_LEAK = 5000;
const SPEED_K = 1.3, SPEED_ROOM = 4;                  // claimed speed: at most this share of the speed seen, plus m/s
const STAMP = 21;                                     // a position's slot for when it was taken (ms within the minute, the sender's clock)
// A car standing on the map with nobody at the controls, on a page from before the game sent such a car to the
// garage itself (src/idlepark.js, 25 Nov; those pages say i=1 as they connect and are not judged here). The pages
// left open for hours with a bus across the race road are exactly the ones that never reload (Martin's picture
// three hours after that rule). Its position says nobody is there: no throttle, no brake, wheels straight.
// After MAP_IDLE_MS of that the page's connection is closed as for an idle garage (4002) and it is kept out for
// MAP_OUT_MS, twice as long each time up to MAP_OUT_MAX. Back in, it has MAP_PROBE_MS to touch a pedal or the
// wheel: then it is as anyone again, otherwise out again. (MAP_IDLE_S and MAP_OUT_S on the Worker change the first two.)
// (26 Nov, Martin: with room on the server a car may stand on the map for as long as it likes, so more players are
// seen online. Such a page's car is judged only while the server is "tight", over ROOM_AT of its places taken, see
// room(); a bus always, tight or not. With room after LOOSE_MS: Martin 26 Nov, tabs left open for days hold an old
// version of the game while the server has changed.)
// The same LOOSE_MS for a page from before the game went offline by itself with nobody there (pages that do say
// r=1 as they connect): in the garage or another tab that long it gives up its place with room too (restOld).
const MAP_IDLE_MS = 180000, MAP_PROBE_MS = 20000, MAP_OUT_MS = 60000, MAP_OUT_MAX = 15 * 60000;
const LOOSE_MS = 20 * 60000;
// a thumbs up (src/net/kudosrules.js): one sender to one receiver once in 30 s and KUDOS_PAIR a day, at most 8 a
// minute from one sender, and from one internet address to one receiver KUDOS_ADDR an hour (several tabs or
// private windows, each a new player)
const KUDOS_GAP = KUDOS_GAP_S * 1000, KUDOS_MAX = 8, KUDOS_ADDR = KUDOS_PAIR * 2;
const BOARD_V = 4;                // raise when the stored lap board gets a new shape, so it is worked out afresh
// what drove a lap: keyboard, gamepad, steering wheel, touch screen. Laps from before this was kept
// have none and count as keyboard.
const INPUTS = ['kb', 'pad', 'wheel', 'touch'];
const cleanInp = (s) => (INPUTS.includes(s) ? s : null);

// A car's position as the other browsers get it: numbers only, within sane bounds. One word where
// a number belongs stopped every nearby player's picture, and a huge speed threw their cars away.
function cleanPose(p) {
  if (!Array.isArray(p) || p.length < 9 || p.length > 24) return null;
  const out = new Array(p.length);
  for (let i = 0; i < p.length; i++) {
    const v = p[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    const lim = i === 6 || i === 7 ? 150 : i === 14 ? 20000 : 100000;   // speed m/s, engine rpm, the rest
    out[i] = Math.max(-lim, Math.min(lim, v));
  }
  return out;
}

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sameText = (a, b) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

// Lap tickets made in the Worker, signed like the lobby's own (Lobby.newTicket), the secret fetched once per isolate
let tkKey = null;
const tkRate = new Map();
async function edgeTicket(env, ip) {
  const now = Date.now();
  let e = tkRate.get(ip);
  if (!e || now - e.t > 600000) { if (tkRate.size > 20000) tkRate.clear(); e = { t: now, n: 0 }; tkRate.set(ip, e); }
  if (++e.n > 30) return json({ error: 'too many requests' }, 429);
  if (!tkKey) {
    const secret = await env.LOBBY.get(env.LOBBY.idFromName('lobby')).ticketSecret();
    tkKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  }
  const body = `${now.toString(36)}.${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const sig = b64(await crypto.subtle.sign('HMAC', tkKey, new TextEncoder().encode(body))).slice(0, 27);
  return json({ key: `${body}.${sig}` });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) {
      // the page itself never gets here (a static asset; index.html moves the old addresses on), but
      // other paths on the old address go to www.linnaring.com (worker/moved.js)
      return moved(req, url) || (env.ASSETS ? env.ASSETS.fetch(req) : new Response('Not found', { status: 404 }));
    }
    // The old kvissuroam.parttime.workers.dev address does not pass Cloudflare's rate-limit rule for
    // linnaring.com, so the game's server answers only there (25 Nov). Its page loads still move on to www.
    if (url.hostname.endsWith('.workers.dev')) return json({ error: 'moved to www.linnaring.com' }, 410);
    // Requests from one address are counted before they reach the lobby or the stats object, so a flood of
    // them costs only the Worker (the rate-limit binding in wrangler.jsonc; the lobby keeps its own finer limits)
    const ip = req.headers.get('cf-connecting-ip') || 'local';
    if (env.API_LIMIT) {
      try { if (!(await env.API_LIMIT.limit({ key: ip })).success) return json({ error: 'too many requests' }, 429); } catch { /* a limiter hiccup lets it through */ }
    }
    // the game only ever calls its own address: another website may not use a visitor's browser to
    // post laps or open sockets here
    const origin = req.headers.get('origin');
    if (origin) {
      let host = '';
      try { host = new URL(origin).host; } catch { /* not a URL */ }
      if (host !== url.host) return json({ error: 'forbidden' }, 403);
    }
    if (url.pathname === '/api/stats') {
      // anonymous game stats (worker/stats.js): their own object, so they never slow the lobby down.
      // The country Cloudflare sees the visitor in goes along; the address does not.
      const fwd = new Request(req);
      fwd.headers.set('x-country', String(req.cf?.country || ''));
      return env.STATS.get(env.STATS.idFromName('stats')).fetch(fwd);
    }
    if (url.pathname === '/api/ticket') {
      try { return await edgeTicket(env, ip); } catch { tkKey = null; /* the lobby makes it then */ }
    }
    const stub = env.LOBBY.get(env.LOBBY.idFromName('lobby'));
    // The lap board and the online list are the same for everyone: kept a few seconds in Cloudflare's cache at
    // each data centre, so thousands of pages opening at once (a surge, 25 Nov) ask the one lobby only now and
    // then. (The full list behind /stats' "more" too.)
    const shared = req.method === 'GET' && (url.pathname === '/api/board' || url.pathname === '/api/online') && !url.search.replace(/^\?all=1$/, '');
    if (shared && typeof caches !== 'undefined') {
      const key = new Request(`${url.origin}${url.pathname}${url.search}`);
      try { const hit = await caches.default.match(key); if (hit) return hit; } catch { /* no cache here */ }
      const res = await stub.fetch(req);
      if (res.ok) {
        const body = await res.arrayBuffer(), headers = new Headers(res.headers);
        headers.set('cache-control', `public, max-age=${url.pathname === '/api/board' ? 5 : 10}`);
        const out = new Response(body, { status: res.status, headers });
        try { await caches.default.put(key, out.clone()); } catch { /* no cache here */ }
        return out;
      }
      return res;
    }
    return stub.fetch(req);
  },
};

// ---- Replays: unpacking and checking (the packing is in src/race/replay.js)
async function gunzip(bytes, max) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const parts = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > max) { reader.cancel(); throw new Error('too big'); }
    parts.push(value);
  }
  const all = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { all.set(p, o); o += p.length; }
  return new TextDecoder().decode(all);
}
// the places a replay has to pass, in order, and how near: Toomemägi's checkpoints and hidden gates (the game's
// own, src/race/lapgates.js) and its start/finish line (the lap is flying: it starts and ends there); the Raadi
// stage's start, a point every 80 along it, its finish
const near = (i, P, r) => ({ x: P[i][0], z: P[i][1], r });
const GATES = {
  toomemagi: { first: near(0, LAP.pts, 30), pass: [...LAP_GATES, near(0, LAP.pts, 30)] },
  raadi: { first: near(STAGE.start, STAGE.pts, 30),
    pass: [...Array.from({ length: Math.floor((STAGE.finish - STAGE.start - 80) / 80) }, (_, k) => near(STAGE.start + 80 * (k + 1), STAGE.pts, STAGE.hw[STAGE.start + 80 * (k + 1)] + 45)), near(STAGE.finish, STAGE.pts, 30)] },
};
// the move from (ax, az) to (bx, bz) through a gate: across the line of a lap gate, or within a circle
function thru(q, ax, az, bx, bz) {
  if (q.ax != null) return throughGate(q, ax, az, bx, bz);
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((q.x - ax) * dx + (q.z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(ax + dx * t - q.x, az + dz * t - q.z) < q.r;
}
// what is wrong with a replay's samples ('' for nothing): driving ms is the time without penalty seconds
// (drive: given the samples' places, xs, zs and heights ys, for the judging of the car itself: src/race/plausible.js)
function checkTrace(text, track, driving, drive = {}) {
  const a = text.split(',').map(Number);
  const [v, f, ms, n] = a;
  if (v !== 1 || f !== 21 || !Number.isInteger(n) || a.length !== 4 + n * f || !a.every(Number.isInteger)) return 'shape';
  if (Math.abs(ms - driving) > 2) return 'time';
  if (Math.abs(n - (Math.ceil(ms / 100) + 1)) > 1) return 'samples';
  const g = GATES[track];
  let x = 0, z = 0, y = 0, px = 0, pz = 0, gate = 0, hops = 0, fl = 0;
  const xs = drive.xs = new Float64Array(n), zs = drive.zs = new Float64Array(n), ys = drive.ys = new Float64Array(n);
  // (and how far the car is rolled over, rad: a car with thrusters that turns over in the air has flown a kickflip)
  const rolls = drive.roll = new Float64Array(n);
  let roll = 0;
  // (hard crashes into a wall, src/cars/crash.js: each is CRASH_PEN seconds in the lap's time)
  const flags = new Int32Array(n);
  for (let i = 0; i < n; i++) flags[i] = fl += a[4 + i * f + 20];
  drive.crashes = crashesIn(flags);
  for (let i = 0; i < n; i++) {
    x += a[4 + i * f] / 100; z += a[4 + i * f + 1] / 100; y += a[4 + i * f + 2] / 100; roll += a[4 + i * f + 5] / 1000;
    xs[i] = x; zs[i] = z; ys[i] = y; rolls[i] = roll;
    if (i === 0 && Math.hypot(x - g.first.x, z - g.first.z) > g.first.r) return 'start';
    if (i && Math.hypot(x - px, z - pz) > 12) {
      // R puts the car back on a spot it drove through at least 3 s before and the lap goes on (main.js
      // goLastSpot, race.js hopped): a jump back onto the trace's own earlier path is that, and passes no gate
      // (until 25 Nov such a lap's replay was refused as too fast, and its record could not be watched)
      let back = false;
      for (let j = 0; j < i - 20 && !back; j++) back = Math.hypot(xs[j] - x, zs[j] - z) < 8;
      if (!back || ++hops > 20) return 'speed';
      px = x; pz = z;
      continue;
    }
    // (on the line between two samples, as the game judges a frame: at 10 a second a fast car moves 8 m)
    // (one gate missed is forgiven when the next is passed, as in the game: running wide onto the grass)
    for (;;) {
      const last = (k) => k < g.pass.length - 1 || i > n - 4;
      if (i && g.pass[gate] && thru(g.pass[gate], px, pz, x, z) && last(gate)) gate++;
      else if (i && g.pass[gate + 1] && thru(g.pass[gate + 1], px, pz, x, z) && last(gate + 1)) gate += 2;
      else break;
    }
    if (i === 0 && Math.hypot(x - g.pass[0].x, z - g.pass[0].z) < g.pass[0].r) gate++;
    px = x; pz = z;
  }
  return gate < g.pass.length ? 'route' : '';
}

export class Lobby extends DurableObject {
  constructor(ctx, env) {
    if (env?.SHOW_HIDDEN === '1') showHidden = true;
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS laps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track TEXT NOT NULL, name TEXT NOT NULL, car TEXT NOT NULL, ms INTEGER NOT NULL,
      at TEXT NOT NULL, day TEXT NOT NULL)`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS laps_car ON laps (track, car, ms)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS laps_name ON laps (name COLLATE NOCASE)');
    // checkpoint split times (JSON list of ms) and which checkpoints they belong to (the client's
    // CP_KEY), so a driver without a lap of their own can race the record's splits
    const cols = this.sql.exec('PRAGMA table_info(laps)').toArray().map((c) => c.name);
    if (!cols.includes('splits')) this.sql.exec('ALTER TABLE laps ADD COLUMN splits TEXT');
    if (!cols.includes('cp')) this.sql.exec('ALTER TABLE laps ADD COLUMN cp TEXT');
    // which lap ticket the lap came in on (see "Lap tickets"); laps from before tickets have none
    if (!cols.includes('sid')) this.sql.exec('ALTER TABLE laps ADD COLUMN sid TEXT');
    this.sql.exec('CREATE INDEX IF NOT EXISTS laps_sid ON laps (sid)');
    // what the lap was driven with (INPUTS); null on laps from before it was kept (keyboard)
    if (!cols.includes('inp')) this.sql.exec('ALTER TABLE laps ADD COLUMN inp TEXT');
    // the tyres the lap was driven on: 'gravel', or null for road tyres (and every lap from before 23 Nov 2026)
    if (!cols.includes('ty')) this.sql.exec('ALTER TABLE laps ADD COLUMN ty TEXT');
    // penalty seconds that are part of a stage time (Raadi: apex cut, wide entry, off the path); null without
    if (!cols.includes('pen')) this.sql.exec('ALTER TABLE laps ADD COLUMN pen INTEGER');
    // 1: a lap that would be its car's best (of all time or of today) waits here, off the board, until its replay has
    // come and held up (see "Replays"); null: on the board. (25 Nov 2026: before, the board believed any time.)
    // 2: taken off the board for good (a lap found to be driven in a tuned car): no replay brings it back.
    if (!cols.includes('hold')) this.sql.exec('ALTER TABLE laps ADD COLUMN hold INTEGER');
    // small values kept between wake-ups: the signing secret and the finished lap board
    this.sql.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    // the record lap of each car on each circuit as movement, to be watched (see "Replays"); one row a car and circuit
    this.sql.exec('CREATE TABLE IF NOT EXISTS replay_refused (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, track TEXT NOT NULL, car TEXT NOT NULL, ms INTEGER NOT NULL, name TEXT NOT NULL, why TEXT NOT NULL, bytes INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS replays (track TEXT NOT NULL, car TEXT NOT NULL, ms INTEGER NOT NULL, name TEXT NOT NULL, at TEXT NOT NULL, data BLOB NOT NULL, PRIMARY KEY (track, car))');
    // laps as the server's clock timed them (see lapMark): the start of the lap a page is on, by its ticket, and the
    // laps it finished with what the server measured
    this.sql.exec('CREATE TABLE IF NOT EXISTS lapmarks (sid TEXT PRIMARY KEY, t0 INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS lapseen (sid TEXT NOT NULL, ms INTEGER NOT NULL, took INTEGER NOT NULL, at INTEGER NOT NULL)');
    // how near play comes to each of the server's limits (margin(), GET /api/margins)
    this.sql.exec('CREATE TABLE IF NOT EXISTS margins (k TEXT NOT NULL, v REAL NOT NULL, at INTEGER NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS lapseen_sid ON lapseen (sid, ms)');
    // (trail: where the car was seen during that lap, [tenths of a second after its start mark, x, z, ...]: livecheck.js)
    if (!this.sql.exec('PRAGMA table_info(lapseen)').toArray().some((c) => c.name === 'trail')) this.sql.exec('ALTER TABLE lapseen ADD COLUMN trail TEXT');
    // (fl: kickflips the car told of while the lap was on, see lapFlight)
    if (!this.sql.exec('PRAGMA table_info(lapseen)').toArray().some((c) => c.name === 'fl')) this.sql.exec('ALTER TABLE lapseen ADD COLUMN fl INTEGER');
    // the laps being driven now: sid -> { t0: the start mark, id: whose connection, last, pts } (lapPlace)
    this.trails = new Map(); this.trailAsked = new Set();
    this.seenClean = 0;
    // The stage's painted line was made from where the cars drove (26 Nov 2026, the runs kept in table `lines` from
    // the page's src/race/linelog.js). Martin at the launch, the same day: the logging goes, the line stays as it is.
    // Every run it held is in the project's raadi-lines/runs.ndjson (tools/race/raadi-lines.py reads it).
    this.sql.exec('DROP TABLE IF EXISTS lines');
    this.rpIndex = null;          // track -> { car: ms } of the replays kept (with the board)
    this.tops = null;             // the five best drivers per car, made when first asked for (worker/tops.js, topsNow)
    this.limits = new Map();      // car -> what it can do (a promise: see carLimit)
    this.limitNow = new Map();    // ... and the same once worked out (the race desk judges a finish without waiting)
    // One-off (Martin, 24 Nov 2026, there being no ADMIN_KEY): the 42 Toomemägi laps driven up Kroonuaia and back
    // (checkpoint 2 about 10 s early, the audi200 record's replay shows the route) and the replay of that record.
    // The new gates (src/race/lapgates.js) stop such laps; the lap board is made again from what is left.
    if (!this.meta('cleanup-2026-11-24')) {
      const CHEATS = [60, 138, 152, 363, 410, 413, 434, 437, 444, 504, 515, 519, 550, 602, 608, 617, 625, 635, 665, 681, 808, 819, 832, 846, 876, 892, 911, 942, 945, 949, 960, 964, 979, 998, 1001, 1002, 1018, 1025, 1028, 1054, 1069, 1120];
      for (const id of CHEATS) this.sql.exec("DELETE FROM laps WHERE id = ? AND track = 'toomemagi'", id);
      this.sql.exec("DELETE FROM replays WHERE track = 'toomemagi' AND car = 'audi200' AND ms = 168444");
      this.sql.exec("DELETE FROM meta WHERE k = 'board'");
      this.setMeta('cleanup-2026-11-24', '1');
    }
    // One-off (26 Nov 2026, a player's report to Martin: "look at the 200's best lap, somehow tuned"): two Audi 200
    // laps driven in a car with changed figures. 3351 (2:45.29, the record: its replay shows twice the car's pull at
    // every speed and 2.3 g in bends and under braking) and 3280 (2:47.96, the record before it: two parts of the lap
    // faster than any F40 has driven them, 5 s under the best of 635 laps in that car). Off the board, kept in the
    // table (hold 2); the record's replay goes. Drives are judged against the car from now on (src/race/plausible.js).
    if (!this.meta('cleanup-2026-11-26')) {
      this.sql.exec("UPDATE laps SET hold = 2 WHERE track = 'toomemagi' AND car = 'audi200' AND ((id = 3351 AND ms = 165288) OR (id = 3280 AND ms = 167961))");
      this.sql.exec("DELETE FROM replays WHERE track = 'toomemagi' AND car = 'audi200' AND ms = 165288");
      this.sql.exec("DELETE FROM meta WHERE k = 'board'");
      this.setMeta('cleanup-2026-11-26', '1');
    }
    // One-off (Martin, 26 Nov 2026, as the Majoraadi stage opened to everyone: "Delete all raadi lap times"): every
    // stage time kept so far was a test run while the stage was tried out behind ?raadi=1 (14 runs, a copy is in the
    // project's raadi-launch folder and in the nightly backup), and so are the stage records' replays. Only the
    // stage's: Toomemägi's laps and replays stay as they are. The board is made again from what is left.
    if (!this.meta('cleanup-raadi-launch')) {
      this.sql.exec("DELETE FROM laps WHERE track = 'raadi'");
      this.sql.exec("DELETE FROM replays WHERE track = 'raadi'");
      this.sql.exec("DELETE FROM meta WHERE k = 'board'");
      this.setMeta('cleanup-raadi-launch', '1');
    }
    // One-off (Martin, 27 Nov 2026, "Remove both Impreza runs"): Savage's two Majoraadi Impreza runs (1:35.15 and
    // 1:38.17) were driven with about 1.6 times the car's grip on gravel, which the car check let through until #842.
    // Off the board for good (hold 2, reversible), the record's drive dropped, the board made again.
    if (!this.meta('cleanup-2026-11-27')) {
      this.sql.exec("UPDATE laps SET hold = 2 WHERE track = 'raadi' AND car = 'impreza' AND ((id = 5628 AND ms = 98173) OR (id = 5629 AND ms = 95152))");
      this.sql.exec("DELETE FROM replays WHERE track = 'raadi' AND car = 'impreza' AND ms = 95152");
      this.sql.exec("DELETE FROM meta WHERE k = 'board'");
      this.setMeta('cleanup-2026-11-27', '1');
    }
    // keep-alive pings are answered without waking the object
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    this.rl = new Map();          // rate limit counters (in memory: they only matter while it is busy)
    this.rate = new WeakMap();    // messages per socket
    this.cache = null;            // the lap board
    this.hmac = null;
    this.race = new RaceDesk(this);   // the online race (worker/race.js)
    this.drag = new DragDesk(this);   // the drag strip's two lanes (worker/drag.js)
    this.initPoses();
    this.initLoad();
  }

  // ---- Demand (Martin 2026-11-24: how many would play online if the cap let them): once a minute the lobby
  // tells the stats object how many are online and driving, how many pages are waiting outside (SERVER FULL,
  // still asking every 20 to 40 s), how many were turned away and how many got in after waiting. Kept in
  // memory only and sent from what already runs (the position bundles, sockets opening, messages), so it
  // never keeps the object awake on its own.
  initLoad() {
    this.waiting = new Map();     // page id (?w= on the socket address, else the address) -> { first, last } asked while full
    this.loadMin = 0;             // the minute last sent
    this.load = { ref: 0, away: 0, joined: 0, waitMs: 0 };
    this.ghostNew = new Set();    // stealth (?off=100) pages that said hello since the last minute sent, by id
    this.ghc = 0;                 // and their connections
  }
  // Stealth mode is open to anyone who reads the page's code (security review 25 Nov 2026). Martin: leave it, but
  // count how much it is used: connections, distinct pages (by player id) and minutes online, on /stats.
  ghostHello(id) {
    this.ghc++;
    if (this.ghostNew.size < 200) this.ghostNew.add(id);
  }
  waitKey(url, ip) {
    const w = url.searchParams.get('w');
    return typeof w === 'string' && /^[a-z0-9]{6,16}$/.test(w) ? `w|${w}` : `i|${ip}`;
  }
  // a page refused with SERVER FULL: a new waiting player unless it already asked within WAIT_GONE
  refused(key, now) {
    this.load.ref++;
    const e = this.waiting.get(key);
    if (e && now - e.last < WAIT_GONE) { e.last = now; return; }
    // (the Map keeps the order of first asking, which is the queue's order: one that gave up and came back is new)
    if (e) this.waiting.delete(key);
    if (this.waiting.size >= WAIT_MAX && now - (this.cleanAt || 0) > 10000) { this.cleanAt = now; this.waitClean(now); }
    if (this.waiting.size >= WAIT_MAX) return;
    this.waiting.set(key, { first: now, last: now });
    if (this.qc) this.qc.added++;            // (behind everyone in the queue worked out last)
    this.load.away++;
  }
  // a page that waited outside got its place
  admitted(key, now) {
    const e = this.waiting.get(key);
    if (!e) return;
    this.waiting.delete(key);
    this.qc = null;
    if (now - e.last < WAIT_GONE) { this.load.joined++; this.load.waitMs += now - e.first; }
  }
  waitClean(now) { for (const [k, e] of this.waiting) if (now - e.last >= WAIT_GONE) this.waiting.delete(k); }
  // The queue (Martin 25 Nov: "show in queue"): pages waiting outside, first come first, that asked again lately.
  // A freed place is kept for the front of it: a page that just opened waits its turn behind them.
  // Worked out at most once a second (and after someone got in): with thousands waiting each question would
  // otherwise walk the whole list. A page new to the queue is put at its end.
  queue(now) {
    if (this.qc && now - this.qc.at < 1000) return this.qc;
    const list = [];
    for (const [k, e] of this.waiting) if (now - e.last < QUEUE_FRESH) list.push(k);
    return (this.qc = { at: now, list, idx: new Map(list.map((k, i) => [k, i])), added: 0 });
  }
  loadTick(now = Date.now()) {
    const min = Math.floor(now / 60000);
    if (min === this.loadMin) return;
    this.loadMin = min;
    try { this.restOld(now); } catch (err) { console.error('restOld', err); }
    const st = this.env?.STATS;
    if (!st) return;
    this.waitClean(now);
    let on = 0, drv = 0;
    const seen = new Set(), ghosts = new Set(this.ghostNew);
    // the names driving on the map this minute, a Raadi stage run too, for the top drivers on /stats (Martin
    // 2026-11-26: "top 10 driving hours by player"; worker/stats.js addDrivers gives each name the minute)
    const drivers = [];
    let gh = 0;
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!a?.id || seen.has(a.id) || !this.race.live(ws, a, now)) continue;
      seen.add(a.id);
      if (a.ghost) { gh++; if (ghosts.size < 200) ghosts.add(a.id); continue; }
      on++;
      if (a.drv) drv++;
      if (a.name && (a.drv || a.w === 'map') && drivers.length < 150) drivers.push(a.name);
    }
    const max = Math.max(1, Math.min(MAX_SOCKETS, Number(this.env?.MAX_ONLINE) || MAX_SOCKETS));
    const s = { v: 1, t: now, on, drv, wait: this.waiting.size, cap: max, ...this.load, gh, ghc: this.ghc, ghIds: [...ghosts], drivers };
    this.load = { ref: 0, away: 0, joined: 0, waitMs: 0 };
    this.ghostNew = new Set(); this.ghc = 0;
    const p = st.get(st.idFromName('stats')).addLoad(s).catch(() => {});
    this.ctx.waitUntil?.(p);
  }

  // pages from before the game went offline by itself (no r=1): in the garage or another tab over LOOSE_MS, the
  // place is given up as an idle garage's is when the server is nearly full (4002: such a page joins again as
  // soon as it is back on the map). Once a minute, with the load figures.
  // (LOOSE_S on the Worker changes LOOSE_MS without a deploy)
  looseMs() { return (Number(this.env?.LOOSE_S) || LOOSE_MS / 1000) * 1000; }
  restOld(now) {
    const loose = this.looseMs();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!a?.id || a.x || a.r || a.ghost || (a.w !== 'garage' && a.w !== 'away') || this.race.racing(a.id)) continue;
      if (now - (a.wt || a.at || now) > loose) this.release(ws, a, 4002, 'idle');
    }
  }

  // ---- Positions (see TICK): kept in memory only, they are stale a moment later anyway
  initPoses() {
    this.poses = new Map();       // player id -> { p, j: p as JSON, t: when it came in, n: how many so far, ws }
    this.bund = new WeakMap();    // socket -> takes bundles (from its hello; read from the attachment after a wake-up)
    this.sentTo = new WeakMap();  // socket -> Map(player id -> { n, t }): what that page has had of each car
    this.timer = 0;
    this.parked = new Map();      // page (as waitKey) -> { n: times put off the map, until: kept out till then, back: let in again at }
    this.idleAt = 0;              // when idleCars last looked
  }
  takesBundles(ws) {
    let b = this.bund.get(ws);
    if (b === undefined) { b = !!ws.deserializeAttachment()?.b; this.bund.set(ws, b); }
    return b;
  }
  // a car's new position: to older pages at once, to the others with the next bundle
  pose(ws, id, p) {
    const now = Date.now();
    // (a racer's lap is followed from these, as they came: worker/follow.js)
    try { this.race.seen(id, p, now); } catch (err) { console.error('follow', err); }
    let e = this.poses.get(id);
    // (act: when somebody was last at its controls, t0: on the map since; for idleCars)
    const act = p[12] > 0.02 || p[9] > 0 || Math.abs(p[8]) > 0.02;
    // does it hang together with the one before (see V_MAX)? fr: flagged until, st: the sender's time so far (s),
    // lead / top: how far its clock is ahead of ours and has ever been, ring: where it was lately [x, z, st, ...],
    // vo: the speed it is seen to move at (-1: not known yet)
    let jump = !e, fast = false, att;
    if (!e) this.poses.set(id, e = { p, j: '', t: now, n: 0, ws, t0: now, act: 0, fr: 0, jn: 0, jt: now, st: 0, lead: 0, top: 0, ring: [], vo: -1, car: (att = ws.deserializeAttachment())?.car, sid: att?.sid, vm: 0 });
    else {
      const dtA = Math.max(0, now - e.t) / 1000;
      let dt = dtA;
      if (dtA * 1000 > GAP_MS) jump = true;
      else if (p.length > STAMP && e.p.length > STAMP) {
        let ds = (((p[STAMP] - e.p[STAMP]) % 60000) + 60000) % 60000;
        if (ds > 30000) ds -= 60000;
        ds /= 1000;
        const lead = e.lead + ds - dtA;
        e.top -= 0.002 * dtA;                                    // (a clock that drifts is followed)
        // (in its first moments, flagged anyway, the clock is still being found: a first position that came late)
        if (ds >= 0 && (now < e.fr || lead <= e.top + 0.05)) { dt = ds; e.lead = lead; if (lead > e.top) e.top = lead; } else e.lead = e.top;
      }
      if (!jump) {
        // (over its own top speed but not over any car's: flagged, yet not counted as jumping about: a bus sent
        // flying by a knock is still a bus on its way)
        const d = Math.hypot(p[0] - e.p[0], p[1] - e.p[1]);
        jump = d > V_MAX * dt + STEP_ROOM;
        fast = !jump && e.vm > 0 && d > e.vm * dt + STEP_ROOM;
      }
      e.st += dt;
    }
    // (on a lap: where the car is, kept now and then for the judging of a record's drive: livecheck.js)
    if (e.sid) this.lapPlace(e.sid, p[0], p[1], now, id);
    if (jump) {
      e.jn = Math.max(0, e.jn - (now - e.jt) / JUMP_LEAK); e.jt = now;
      if (e.jn >= JUMPS_MAX) return;
      e.jn++;
      e.fr = now + FRESH_MS; e.ring.length = 0; e.vo = -1; e.lead = e.top = 0;
    } else if (fast) e.fr = now + FRESH_MS;
    if (now < e.fr && p.length > 20) p[20] = (p[20] | 0) | FLAG_FRESH;
    const r = e.ring;
    r.push(p[0], p[1], e.st);
    while (r.length > 6 && (r[5] <= e.st - 0.5 || r.length > 90)) r.splice(0, 3);
    if (e.st - r[2] >= 0.4) e.vo = Math.max(Math.hypot(p[0] - r[0], p[1] - r[1]) / (e.st - r[2]), e.vo * 0.85);
    if (e.vo > V_ASK && !e.vm) {
      // (fast: what can this car do? vm: -1 while it is worked out, then its limit)
      e.vm = -1;
      this.carLimit(e.car).then((lim) => { e.vm = lim ? Math.min(V_MAX, lim.top * V_TOP_K + V_TOP_ROOM) : 2 * V_MAX; }, () => { e.vm = V_MAX; });
    }
    if (e.vo >= 0) {
      const cap = e.vo * SPEED_K + SPEED_ROOM, v = Math.hypot(p[6], p[7]);
      if (v > cap) { p[6] = Math.round((p[6] * cap * 100) / v) / 100; p[7] = Math.round((p[7] * cap * 100) / v) / 100; }
    }
    const j = JSON.stringify(p);
    e.p = p; e.j = j; e.t = now; e.n++; e.ws = ws; if (act) e.act = now;
    let one = null;
    for (const o of this.ctx.getWebSockets()) {
      if (o === ws || this.takesBundles(o)) continue;
      one ??= `{"t":"s","id":"${id}","p":${j}}`;
      try { o.send(one); } catch { /* closing */ }
    }
    if (!this.timer) this.timer = setInterval(() => { try { this.bundle(); } catch (err) { console.error('bundle', err); } }, TICK);
  }
  // a finish the race desk did not take (the car was not followed round the lap): kept with the refused replays,
  // so a racer who asks why can be told (GET /api/replay?refused=1)
  raceRefused(r, ms, why) {
    this.sql.exec('INSERT INTO replay_refused (at, track, car, ms, name, why, bytes) VALUES (?, ?, ?, ?, ?, ?, 0)', new Date().toISOString(), TRACK, r.car || '?', ms || 0, r.name || '', `race: ${why}`);
    this.sql.exec('DELETE FROM replay_refused WHERE id <= (SELECT MAX(id) FROM replay_refused) - 50');
  }
  // cars left standing on the map by pages that do not park them themselves (see MAP_IDLE_MS): every 5 s
  idleCars(now) {
    const idleMs = (Number(this.env?.MAP_IDLE_S) || MAP_IDLE_MS / 1000) * 1000, outMs = (Number(this.env?.MAP_OUT_S) || MAP_OUT_MS / 1000) * 1000;
    for (const [key, k] of this.parked) if (now > k.until + 3600000) this.parked.delete(key);
    // (also every 5 s while anyone drives: is the server tight? A socket gone silent changes that with no event)
    const tight = this.room();
    for (const [id, e] of this.poses) {
      const a = e.ws.deserializeAttachment();
      if (!a?.id || a.x || a.i || a.ghost) continue;
      if (this.race.racing(id)) { e.t0 = now; continue; }          // (from the count to the flag: as if just arrived)
      const wait = tight || alwaysJudged(a.car) ? idleMs : Math.max(idleMs, this.looseMs());   // (room on the server: longer)
      const key = a.pw ? `w|${a.pw}` : `i|${a.ip}`;
      let k = this.parked.get(key);
      if (k?.back && e.act > k.back) { this.parked.delete(key); k = null; }
      if (now - Math.max(e.act, e.t0, k?.back || 0) < (k?.back ? Math.min(MAP_PROBE_MS, wait) : wait)) continue;
      const n = (k?.n || 0) + 1;
      if (this.parked.size < 2000) this.parked.set(key, { n, until: now + Math.min(outMs * 2 ** (n - 1), MAP_OUT_MAX), back: 0 });
      this.release(e.ws, a, 4002, 'idle');
    }
  }
  dropPose(ws, id) {
    const e = id && this.poses.get(id);
    if (e && e.ws === ws) this.poses.delete(id);
  }
  bundle() {
    const now = Date.now();
    if (now - this.loadMin * 60000 >= 60000) this.loadTick(now);
    for (const [id, e] of this.poses) if (now - e.t > POSE_KEEP) this.poses.delete(id);
    if (!this.poses.size) { clearInterval(this.timer); this.timer = 0; return; }   // (nobody driving: the object may sleep)
    if (now - this.idleAt >= 5000) { this.idleAt = now; this.idleCars(now); }
    const own = new Map();
    for (const e of this.poses.values()) own.set(e.ws, e);
    const frag = new Map();
    for (const ws of this.ctx.getWebSockets()) {
      if (!this.takesBundles(ws)) continue;
      let sent = this.sentTo.get(ws);
      if (!sent) this.sentTo.set(ws, sent = new Map());
      // where this page's own car is (none: in the menu, the garage or watching someone: it gets everything)
      const me = own.get(ws), here = me && now - me.t < 2000 ? me.p : null;
      let out = '';
      for (const [id, e] of this.poses) {
        if (e.ws === ws) continue;
        const s = sent.get(id);
        if (s && s.n === e.n) continue;                 // nothing new from that car
        if (s && here) {
          const d = Math.hypot(e.p[0] - here[0], e.p[1] - here[1]);
          if (now - s.t < (d > POSE_VFAR ? POSE_VFAR_MS : d > POSE_FAR ? POSE_FAR_MS : 0)) continue;
        }
        if (s) { s.n = e.n; s.t = now; } else sent.set(id, { n: e.n, t: now });
        let f = frag.get(id);
        if (f === undefined) frag.set(id, f = `["${id}",${e.j},${now - e.t}]`);
        out += out ? `,${f}` : f;
      }
      if (sent.size > this.poses.size + 32) for (const id of sent.keys()) if (!this.poses.has(id)) sent.delete(id);
      if (out) try { ws.send(`{"t":"S","b":[${out}]}`); } catch { /* closing */ }
    }
  }

  async alarm() { this.race.alarm(); }

  // a race that closed (or start votes that lapsed) for the stats page: a call to the stats object,
  // not waited for, so a slow or failing stats object never holds the race up
  raceStat(r) {
    const st = this.env?.STATS;
    if (!st) return;
    const p = st.get(st.idFromName('stats')).addRace(r).catch(() => {});
    this.ctx.waitUntil?.(p);
  }

  meta(k) { return this.sql.exec('SELECT v FROM meta WHERE k = ?', k).toArray()[0]?.v ?? null; }
  setMeta(k, v) { this.sql.exec('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v', k, v); }

  // true when `key` has been used more than `max` times within `ms`
  over(key, max, ms) {
    const now = Date.now();
    let e = this.rl.get(key);
    if (!e || now - e.t > ms) {
      if (this.rl.size > 4000) for (const [k, v] of this.rl) if (now - v.t > 600000) this.rl.delete(k);
      if (this.rl.size > 8000) this.rl.clear();
      e = { t: now, n: 0 }; this.rl.set(key, e);
    }
    return ++e.n > max;
  }

  // ---- Lap tickets
  // A lap time is only as honest as the browser that reports it, and there are no accounts. What
  // the server can know is when a browser first showed up: as the page opens it gets a signed
  // ticket holding that moment (/api/ticket, or with its first hello), and sends the ticket along
  // with every lap. A lap is stored only
  // if it began after its ticket was issued and after the ticket's previous lap ended, so a
  // ticket cannot report more lap time than has really passed. A forger now has to connect and
  // wait out each lap instead of posting any number of them in one request.
  async sign(text) {
    if (!this.hmac) {
      let secret = this.meta('secret');
      if (!secret) { secret = b64(crypto.getRandomValues(new Uint8Array(32))); this.setMeta('secret', secret); }
      this.hmac = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    }
    return b64(await crypto.subtle.sign('HMAC', this.hmac, new TextEncoder().encode(text))).slice(0, 27);
  }
  // the signing secret, for the Worker in front (Durable Object RPC, no browser can call it): it hands out the
  // lap tickets itself, so a surge of pages opening does not each ask the lobby (25 Nov)
  async ticketSecret() {
    await this.sign('');
    return this.meta('secret');
  }
  async newTicket() {
    const body = `${Date.now().toString(36)}.${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    return `${body}.${await this.sign(body)}`;
  }
  // { t0: when it was issued, sid } for a ticket of ours, else null
  async readTicket(k) {
    if (typeof k !== 'string' || k.length > 80) return null;
    const m = /^([0-9a-z]{6,12})\.([0-9a-f]{16})\.([\w-]{27})$/.exec(k);
    if (!m || !sameText(m[3], await this.sign(`${m[1]}.${m[2]}`))) return null;
    const t0 = parseInt(m[1], 36);
    return t0 > 0 && t0 <= Date.now() ? { t0, sid: m[2] } : null;
  }

  // (wn: how many spectators watch that player, told to everyone; whom a spectator watches is never told:
  // Martin 2026-11-23, spectating stays anonymous)
  players() {
    const out = [], wn = this.watchCounts();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (a?.id && !a.ghost) out.push({ id: a.id, name: a.name, car: a.car, ...(a.pl ? { pl: a.pl } : {}), ...(a.w ? { w: a.w } : {}), ...(wn.get(a.id) ? { wn: wn.get(a.id) } : {}), ...(a.kn ? { kn: a.kn, kf: a.kf } : {}) });
    }
    return out;
  }

  // spectators per watched player id (except: a socket that is closing)
  watchCounts(except) {
    const n = new Map();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const a = ws.deserializeAttachment();
      if (a?.id && !a.ghost && a.w === 'watch' && a.on) n.set(a.on, (n.get(a.on) || 0) + 1);
    }
    return n;
  }
  // tell everyone the new spectator count of these players
  watchTold(ids, except) {
    const n = this.watchCounts(except);
    for (const id of new Set(ids)) if (id) this.broadcast({ t: 'wn', id, n: n.get(id) || 0 });
  }

  // Drop sockets that have gone silent: every browser pings each 25 s, so one that has neither
  // pinged nor said hello for 80 s is a dead connection (a phone that went to sleep, a lost
  // network) that would otherwise stay in everyone's player list.
  prune(except) {
    const now = Date.now(), gone = new Set();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const a = ws.deserializeAttachment();
      if (a?.x) continue;
      const ping = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() || 0;
      if (Math.max(ping, a?.at || 0) > now - 80000) continue;
      this.release(ws, a, 1001, 'stale');
      gone.add(ws);
    }
    return gone;
  }

  // a socket closed by the server (gone silent, or idle in the garage while the server is full), told to the others
  release(ws, a, code, why) {
    try { ws.close(code, why); } catch { /* already closed */ }
    this.dropPose(ws, a?.id);
    this.shut(ws, a);
    if (a?.id && !a.ghost) { this.broadcast({ t: 'leave', id: a.id }, ws); this.race.gone(a, ws); this.drag.gone(a); if (a.on) this.watchTold([a.on], ws); }
  }
  // A socket the server has closed can stay in getWebSockets until the other end answers the close (never,
  // for a phone that lost its network). Marked x and stripped of its id, so it holds no place, is not
  // released twice (a second place given for one freed, 25 Nov) and its late close is no second "left".
  shut(ws, a) {
    try { ws.serializeAttachment({ at: a?.at || 0, ip: a?.ip, x: 1 }); } catch { /* gone */ }
  }

  // The places taken toward the cap (Martin 2026-11-24: SERVER FULL with about 60 drivers on the map). Not
  // counted: sockets gone silent (a phone asleep, a closed laptop: they were only dropped when somebody said
  // hello, so a newcomer was counted against them first) and ghosts. If that is still the cap, the player who
  // has sat longest in the garage, the menu or another tab (over IDLE_MS) gives up the place: their page
  // knows why (code 4002) and joins again as soon as it is back on the map.
  // pw: the page asking (its ?w=). Its own older socket is not counted against it once (Martin 25 Nov: a
  // phone whose network dropped came back to SERVER FULL, kept out by its own dead connection for 80 s,
  // and lost its race); the hello then closes that old one.
  seats(max, pw) {
    const gone = this.prune();
    const now = Date.now(), idleMs = (Number(this.env?.IDLE_S) || IDLE_MS / 1000) * 1000;   // (IDLE_S on the Worker changes it without a deploy)
    let n = 0, idle = null, idleAt = Infinity, own = false;
    this.ownSeat = false;
    for (const ws of this.ctx.getWebSockets()) {
      if (gone.has(ws)) continue;
      const a = ws.deserializeAttachment();
      if (a?.ghost || a?.x) continue;
      if (pw && a?.pw === pw && !own) { own = this.ownSeat = true; continue; }
      n++;
      if (!a?.id || (a.w !== 'garage' && a.w !== 'away') || this.race.racing(a.id)) continue;
      const since = a.wt || a.at || now;
      if (since < now - idleMs && since < idleAt) { idle = { ws, a }; idleAt = since; }
    }
    // (from 90 % of the cap, 90 of 100, not only when full: Martin 25 Nov, so a place is ready before anyone is
    // turned away; one released for each page that comes in, none while nobody new arrives)
    if (n >= Math.max(1, Math.ceil(max * 0.9)) && idle) { this.release(idle.ws, idle.a, 4002, 'idle'); n--; }
    return n;
  }

  // Is the server tight: more than ROOM_AT of its places taken (over 90 of 100, by MAX_ONLINE)? With room, a car
  // standing on the map with nobody at its controls is left there (Martin 26 Nov: more players seen online, no harm
  // in it); tight, the idle rule is on for everyone (src/idlepark.js on the page, idleCars here for the old pages).
  // Every page hears it with its welcome and whenever it changes ({ t: 'room', tight }). Counted as seats counts
  // (no ghosts, no closed sockets, none gone silent), without letting anyone go. `this.tight` is forgotten when the
  // object sleeps: the first look after that tells everyone once more.
  // except: a socket that is closing
  room(except) {
    const max = Math.max(1, Math.min(MAX_SOCKETS, Number(this.env?.MAX_ONLINE) || MAX_SOCKETS)), now = Date.now();
    let n = 0;
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const a = ws.deserializeAttachment();
      if (a?.ghost || a?.x) continue;
      const ping = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() || 0;
      if (Math.max(ping, a?.at || 0) > now - 80000) n++;
    }
    const tight = n > max * ROOM_AT;
    if (tight !== this.tight) { this.tight = tight; this.broadcast({ t: 'room', tight: tight ? 1 : 0 }, except); }
    return tight;
  }

  broadcast(msg, except) {
    const s = typeof msg === 'string' ? msg : JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try { ws.send(s); } catch { /* closing */ }
    }
  }

  // (on: the names online, lower case; worked out once for all the tries of a fresh name, 25 Nov: each try read
  // every socket, a surge of new visitors asks for thousands)
  nameTaken(name, on) {
    if (this.sql.exec('SELECT 1 FROM laps WHERE name = ? COLLATE NOCASE LIMIT 1', name).toArray().length) return true;
    on ??= new Set(this.players().map((p) => p.name.toLowerCase()));
    return on.has(name.toLowerCase());
  }

  freshName() {
    const on = new Set();
    for (const ws of this.ctx.getWebSockets()) { const a = ws.deserializeAttachment(); if (a?.id && !a.ghost && a.name) on.add(a.name.toLowerCase()); }
    for (let k = 0; k < 200; k++) {
      const n = `${ADJ[Math.floor(Math.random() * ADJ.length)]}${NOUN[Math.floor(Math.random() * NOUN.length)]}${k < 100 ? '' : Math.floor(Math.random() * 90 + 10)}`;
      if (!this.nameTaken(n, on)) return n;
    }
    return `Driver${Math.floor(Math.random() * 900000 + 100000)}`;
  }

  // ---- The lap board
  // Worked out from the whole table once (and again after laps are deleted), then kept: each new
  // lap only updates it. It used to be worked out from every lap on every page load, which read
  // the table four times over and would have run into the daily allowance as the laps piled up.
  // one circuit's part of the board: the best per car of all time and of today, how many were driven, the
  // latest by anyone (newest first: the desktop board lists them) and every kind of control any was driven
  // with (the board only marks laps once there is more than one)
  boardOf(track, day) {
    const best = (where, ...args) => this.sql.exec(
      `SELECT car, name, MIN(ms) AS ms, at, inp, ty, pen FROM laps WHERE track = ? AND hold IS NULL ${where} GROUP BY car`, track, ...args).toArray();
    const count = this.sql.exec('SELECT COUNT(*) AS n FROM laps WHERE track = ? AND hold IS NULL', track).one().n;
    const recent = this.sql.exec('SELECT name, car, ms, at, inp, ty, pen FROM laps WHERE track = ? AND hold IS NULL ORDER BY at DESC, id DESC LIMIT 20', track).toArray();
    const inputs = this.sql.exec("SELECT DISTINCT COALESCE(inp, 'kb') AS k FROM laps WHERE track = ? AND hold IS NULL", track).toArray().map((r) => r.k);
    return { allTime: best(''), today: best('AND day = ?', day), laps: count, recent, inputs };
  }
  // Toomemägi's part is the board itself, as it always was (a page opened before a deploy still reads it);
  // each stage's part hangs under its name.
  rebuildBoard() {
    this.tops = null;              // (made again from the table when next asked for)
    const day = tartuDay();
    // the fastest lap with split times per car and checkpoint layout: what a driver with no lap of
    // their own in that car compares their checkpoint times with
    const refs = this.sql.exec(
      `SELECT car, cp, name, MIN(ms) AS ms, splits FROM laps WHERE track = ? AND hold IS NULL AND splits IS NOT NULL AND cp IS NOT NULL GROUP BY car, cp`, TRACK)
      .toArray().map((r) => ({ ...r, splits: JSON.parse(r.splits) }));
    const b = { v: BOARD_V, track: TRACK, day, ...this.boardOf(TRACK, day), refs };
    for (const t of Object.keys(STAGES)) b[t] = this.boardOf(t, day);
    return b;
  }
  saveBoard() { this.setMeta('board', JSON.stringify(this.cache)); }
  board() {
    if (!this.cache) {
      try { this.cache = JSON.parse(this.meta('board')); } catch { this.cache = null; }
      if (this.cache?.v !== BOARD_V || this.cache.track !== TRACK) { this.cache = this.rebuildBoard(); this.saveBoard(); }
    }
    const day = tartuDay();
    if (this.cache.day !== day) {                                 // past midnight in Tartu
      this.cache.day = day; this.cache.today = [];
      for (const t of Object.keys(STAGES)) this.cache[t].today = [];
      this.saveBoard();
    }
    // which records can be watched: { toomemagi: { car: ms }, raadi: {...} } (a replay whose ms is no longer the
    // car's best is of an older record, and the board does not offer it)
    if (!this.rpIndex) {
      this.rpIndex = {};
      for (const r of this.sql.exec('SELECT track, car, ms FROM replays').toArray()) (this.rpIndex[r.track] ||= {})[r.car] = r.ms;
    }
    this.cache.rp = this.rpIndex;
    return this.cache;
  }
  // true when lap l would be its car's best on its circuit, of all time or of its day: such a lap goes on the
  // board only once its replay has held up (a car nobody has a time in yet counts too)
  wouldLead(l) {
    const b = this.board(), part = l.track === TRACK ? b : b[l.track];
    const beats = (list) => { const r = list.find((x) => x.car === l.car); return !r || l.ms < r.ms; };
    return beats(part.allTime) || (l.day === b.day && beats(part.today)) || this.inTopTen(l);
  }
  // ... or one of its car's ten best on that track (Martin 26 Nov: "start checking just in case top ten times per
  // car", for a board that may one day show ten a car): fewer than TOP_N laps on the board are faster, or it is
  // the driver's own best in that car and fewer than TOP_N other drivers have a faster one
  inTopTen(l) {
    const faster = this.sql.exec('SELECT COUNT(*) AS n FROM (SELECT 1 FROM laps WHERE track = ? AND car = ? AND hold IS NULL AND ms < ? LIMIT ?)', l.track, l.car, l.ms, TOP_N).one().n;
    if (faster < TOP_N) return true;
    const own = this.sql.exec('SELECT MIN(ms) AS m FROM laps WHERE track = ? AND car = ? AND hold IS NULL AND name = ? COLLATE NOCASE', l.track, l.car, l.name).one().m;
    if (own != null && own <= l.ms) return false;
    const others = this.sql.exec('SELECT COUNT(DISTINCT name COLLATE NOCASE) AS n FROM laps WHERE track = ? AND car = ? AND hold IS NULL AND ms < ? AND name <> ? COLLATE NOCASE', l.track, l.car, l.ms, l.name).one().n;
    return others < TOP_N;
  }
  // a lap that has just been stored
  addToBoard(l) {
    const day = this.board().day, b = l.track === TRACK ? this.cache : this.cache[l.track];
    const faster = (list, same) => {
      const i = list.findIndex(same);
      if (i < 0) list.push(null);
      else if (list[i].ms <= l.ms) return null;
      return i < 0 ? list.length - 1 : i;
    };
    b.laps++;
    const row = { car: l.car, name: l.name, ms: l.ms, at: l.at, inp: l.inp, ty: l.ty, ...(l.pen ? { pen: l.pen } : {}) };
    b.recent.push(row);
    const k = l.inp || 'kb';
    if (!b.inputs.includes(k)) b.inputs.push(k);
    b.recent.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
    b.recent.length = Math.min(b.recent.length, 20);
    let i = faster(b.allTime, (r) => r.car === l.car);
    if (i !== null) b.allTime[i] = row;
    if (l.day === day) { i = faster(b.today, (r) => r.car === l.car); if (i !== null) b.today[i] = row; }
    if (l.track === TRACK && l.splits && l.cp) {
      i = faster(b.refs, (r) => r.car === l.car && r.cp === l.cp);
      if (i !== null) b.refs[i] = { car: l.car, cp: l.cp, name: l.name, ms: l.ms, splits: l.splits };
    }
    if (this.tops) { newDay(this.tops, day); addTop(this.tops, l); }
  }

  // The five best drivers per car on each circuit, of all time and of today (Martin 26 Nov 2026; worker/tops.js):
  // made from the laps on the board once, then each new one is added (addToBoard). The board's own lists stay one
  // lap a car, as every page is sent them on every new lap; these are asked for when LAP TIMES is open.
  topsNow() {
    const day = this.board().day;              // (moves the board on past midnight first)
    if (!this.tops) this.tops = makeTops(this.sql.exec('SELECT track, car, name, ms, at, day, inp, ty, pen FROM laps WHERE hold IS NULL').toArray(), day);
    newDay(this.tops, day);
    return this.tops;
  }

  // ---- Replays (Martin 2026-11-24): the record lap of each car, as movement (src/race/replay.js). A browser sends
  // one only for a lap of its own that the board has as the car's record: the lap must be stored under the same
  // ticket, car and time, still be the car's best, and its samples must hold up: as many as the time takes, the
  // car never faster than 430 km/h between two, from the start line through every checkpoint in order to the
  // finish. A forger now has to make up a whole drive, not one number; and a record can be watched.
  // Since 25 Nov 2026 (security review: a lap of 61 s posted by hand would have topped the board) a lap that would be
  // its car's best of all time or of today is held off the board until this replay of it has held up; the lap answer
  // lists such laps under `hold`, and the page sends their replays at once.
  // Since 26 Nov 2026 (two Audi 200 records driven with the car's figures changed in the browser) the drive is also
  // held against the car: no more pull, grip or braking than the game's own physics gives it (src/race/plausible.js).

  // ---- Laps timed by the server (26 Nov 2026). The lap time is the page's own, by the game's clock, and the game
  // runs slower than real time when frames take over 50 ms: a page held under 20 frames a second drove its laps in
  // slow motion. So the page says, as it happens, when its lap timer starts and when a lap is finished (over its
  // connection, 'lm'; by POST /api/mark when it has none), and the server keeps how long that took by its own
  // clock. A lap that would be a car's best counts only if the two agree (lapClock). A drive that was not driven
  // but made up or copied has to be played out in real time for this, too.
  // (id: the connection the mark came over, none for a request)
  lapMark(sid, e, ms, now = Date.now(), id = null) {
    if (!sid) return;
    if (e === 's') {
      this.sql.exec('INSERT INTO lapmarks (sid, t0) VALUES (?, ?) ON CONFLICT (sid) DO UPDATE SET t0 = excluded.t0', sid, now);
      this.trails.set(sid, { t0: now, id, last: 0, pts: [] });
      const pe = id && this.poses.get(id);
      if (pe) pe.sid = sid;
      return;
    }
    if (e !== 'f') return;
    const tr = this.trails.get(sid);
    this.trails.delete(sid);
    const t0 = this.sql.exec('SELECT t0 FROM lapmarks WHERE sid = ?', sid).toArray()[0]?.t0;
    if (!t0) return;
    this.sql.exec('DELETE FROM lapmarks WHERE sid = ?', sid);
    ms = Math.round(Number(ms));
    if (!(ms >= MARK_MIN && ms <= 3600000)) return;
    this.sql.exec('INSERT INTO lapseen (sid, ms, took, at, trail, fl) VALUES (?, ?, ?, ?, ?, ?)', sid, ms, now - t0, now, tr?.t0 === t0 && tr.pts.length ? JSON.stringify(tr.pts) : null, tr?.t0 === t0 && tr.fl ? tr.fl : null);
    if (now - this.seenClean > 3600000) {
      this.seenClean = now;
      this.sql.exec('DELETE FROM lapseen WHERE at < ?', now - 3 * DAY); this.sql.exec('DELETE FROM lapmarks WHERE t0 < ?', now - DAY); this.sql.exec('DELETE FROM margins WHERE at < ?', now - 3 * DAY);
      for (const [k, v] of this.trails) if (v.t0 < now - 3600000) this.trails.delete(k);
      this.trailAsked.clear();
    }
  }
  // A Rocket told the others of a kickflip (the 'jmp' message) while its lap or stage run was on. The game allows
  // none then (src/main.js flipOff: "no flip when hotlap has started", Martin 26 Nov 2026), so the page is a changed
  // one: the lap is marked, and cannot become a record (lapClock). A flight begun before the start line is told
  // before the lap's start mark and is not counted; the game starts no lap while the car is in the air.
  lapFlight(sid, id) {
    const tr = sid && this.trails.get(sid);
    if (tr && (!tr.id || !id || tr.id === id)) tr.fl = (tr.fl || 0) + 1;
  }
  // Where a car on a lap is, as its positions come in (pose) or by a request from a page with no connection: one
  // place every LIVE_MS is kept from the lap's start mark to its finish, and goes into lapseen with the lap. After a
  // restart of the server the lap's start is found again in lapmarks, and the places go on from there.
  lapPlace(sid, x, z, now = Date.now(), id = null) {
    let tr = this.trails.get(sid);
    if (!tr) {
      if (this.trailAsked.has(sid)) return;
      this.trailAsked.add(sid);
      const t0 = this.sql.exec('SELECT t0 FROM lapmarks WHERE sid = ?', sid).toArray()[0]?.t0;
      if (!t0) return;
      this.trails.set(sid, tr = { t0, id, last: 0, pts: [] });
    }
    // (a second window of the same browser has the same ticket: only the connection the lap was started over counts)
    if (tr.id && id && tr.id !== id) return;
    if (now - tr.last < LIVE_MS || tr.pts.length >= 3 * LIVE_MAX || !Number.isFinite(x) || !Number.isFinite(z)) return;
    tr.last = now;
    tr.pts.push(Math.round((now - tr.t0) / 100), Math.round(x), Math.round(z));
  }
  // what is wrong with a lap's time by the server's clock ('' for nothing)
  // (drive: the lap's replay { xs, zs }, held against where the car was seen while it was driven: livecheck.js. A
  // lap the car was not seen on at all is from a page that does not send its places when alone, until those are
  // gone: cutover.js)
  lapClock(sid, ms, drive = null) {
    const rows = this.sql.exec('SELECT took, trail, fl FROM lapseen WHERE sid = ? AND ms = ?', sid, ms).toArray();
    const fit = rows.filter((r) => r.took >= ms - CLOCK_UNDER && r.took <= ms + CLOCK_OVER);
    if (fit.length && fit.every((r) => r.fl)) return `flight: ${fit[0].fl} kickflip${fit[0].fl > 1 ? 's' : ''} told of during the lap`;
    if (!fit.length) {
      if (rows.length) return `clock: took ${rows[0].took} ms by the server's clock`;
      // (no marks: a page from before they were sent, until those are gone: cutover.js)
      return Date.now() < OLD_PAGES_UNTIL ? '' : 'clock: no marks';
    }
    if (!drive) return '';
    let why = '';
    for (const r of fit) {
      let pts = [];
      try { pts = JSON.parse(r.trail || '[]'); } catch { /* none */ }
      const c = liveCheck(pts, drive.xs, drive.zs, r.took);
      if (c.n < LIVE_MIN) { if (Date.now() < LIVE_FROM) return ''; why ||= 'live: the car was not seen driving the lap'; continue; }
      this.margin('live', c.miss / c.n);
      if (liveOk(c)) return '';
      why = `live: ${c.miss} of the ${c.n} places the car was seen at during the lap are not on its drive`;
    }
    return why;
  }

  // How near play comes to each of the server's limits (Martin 26 Nov 2026: "check other such places as well to make
  // sure nothing is dropped on the other side too heavily"): one figure for each thing judged, kept three days.
  // k: 'fin' the ms a racer's own finish time was before the server saw the car over the line (leeway SEEN_EARLY),
  // 'gaps' the gaps in a racer's positions that the lap was found again after (MAX_SKIPS), 'rcar' / 'car' the most
  // seconds a race lap / a record's drive was over one of its car's limits (OVER_MAX), 'gas' the share of a tank a
  // drive in a car with thrusters used over what the tank held (GAS_OVER), 'live' the share of the
  // places a car was seen at during a lap that were not on its drive (LIVE_MISS). The lap clock's own figures
  // are in lapseen already. Read by GET /api/margins and the nightly look at the boards (tools/board-audit.mjs).
  margin(k, v, now = Date.now()) {
    if (Number.isFinite(v)) this.sql.exec('INSERT INTO margins (k, v, at) VALUES (?, ?, ?)', k, v, now);
  }
  margins(now = Date.now()) {
    if (this.marginsOut && now - this.marginsOut.at < 60000) return this.marginsOut;
    const since = now - 3 * DAY;
    // n, the least and the most, the middle and the 1st and 99th of a hundred, and how many lie outside lo..hi
    const sum = (vs, lo, hi) => {
      vs.sort((a, b) => a - b);
      const n = vs.length, q = (f) => (n ? Math.round(vs[Math.min(n - 1, Math.floor(f * n))] * 100) / 100 : null);
      return { n, min: q(0), p1: q(0.01), p50: q(0.5), p99: q(0.99), max: n ? Math.round(vs[n - 1] * 100) / 100 : null, lo, hi, out: vs.filter((v) => v < lo || v > hi).length };
    };
    const kinds = { clock: sum(this.sql.exec('SELECT took - ms AS v FROM lapseen WHERE at >= ?', since).toArray().map((r) => r.v), -CLOCK_UNDER, CLOCK_OVER) };
    const by = {};
    for (const r of this.sql.exec('SELECT k, v FROM margins WHERE at >= ?', since).toArray()) (by[r.k] ||= []).push(r.v);
    const LIM = { fin: [-1e9, SEEN_EARLY], gaps: [0, MAX_SKIPS], rcar: [0, OVER_MAX], car: [0, OVER_MAX], live: [0, LIVE_MISS], gas: [0, GAS_OVER] };
    for (const k of Object.keys(LIM)) kinds[k] = sum(by[k] || [], ...LIM[k]);
    return (this.marginsOut = { at: now, since, kinds });
  }

  // What a car can do, measured on the game's physics the first time a replay of it comes (kept while this object
  // is awake). In slices of 150 steps with the event loop let in between: all at once it is 0.1 to 0.3 s in which
  // nobody's positions would go out.
  carLimit(car) {
    let p = this.limits.get(car);
    if (!p) {
      p = (async () => {
        const it = carLimitsSteps(CARS[car], 150);
        for (;;) {
          const r = it.next();
          if (r.done) return r.value;
          await new Promise((go) => setTimeout(go, 0));
        }
      })();
      p.then((lim) => this.limitNow.set(car, lim), () => this.limits.delete(car));
      this.limits.set(car, p);
    }
    return p;
  }

  async takeReplay(req, ip) {
    if (this.over(`r|${ip}`, 6, 60000)) return json({ error: 'too many requests' }, 429);
    const text = await req.text();
    if (text.length > 400000) return json({ error: 'too big' }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400); }
    const car = cleanCar(body?.car), track = cleanTrack(body?.track), ms = Math.round(Number(body?.ms));
    const tk = await this.readTicket(body?.k);
    // a refusal is kept (the last 50) so a record without a replay can be told why: GET /api/replay?refused=1
    // (told: what the page hears, when the list should say more than the sender is told)
    const refuse = (why, name = '', n = 0, told = why) => {
      this.sql.exec('INSERT INTO replay_refused (at, track, car, ms, name, why, bytes) VALUES (?, ?, ?, ?, ?, ?, ?)', new Date().toISOString(), track, car || '?', ms || 0, name, why, n);
      this.sql.exec('DELETE FROM replay_refused WHERE id <= (SELECT MAX(id) FROM replay_refused) - 50');
      return json({ error: told === 'invalid' || told === 'no such lap' || told === 'not the record' ? told : `replay refused: ${told}` }, 400);
    };
    if (!car || !tk || !(ms > 0) || typeof body?.z !== 'string') return refuse('invalid');
    const lap = this.sql.exec('SELECT id, name, at, day, pen, hold, splits, cp, inp, ty FROM laps WHERE sid = ? AND car = ? AND ms = ? AND track = ? LIMIT 1', tk.sid, car, ms, track).toArray()[0];
    if (!lap) return refuse('no such lap');
    if (lap.hold === 2) return refuse('not the record', lap.name);     // (taken off the board for good)
    // the best of the laps on the board (a held lap is not on it yet)
    const bestNow = () => this.sql.exec('SELECT MIN(ms) AS m FROM laps WHERE track = ? AND car = ? AND hold IS NULL', track, car).one().m;
    const hadNow = () => this.sql.exec('SELECT ms FROM replays WHERE track = ? AND car = ?', track, car).toArray()[0];
    let best = bestNow(), had = hadNow();
    if (!lap.hold && best !== ms) return refuse('not the record', lap.name);
    if (!lap.hold && had && had.ms <= ms) return json({ ok: true });  // (that record's replay came already)
    let bytes, why, told, launch;
    try {
      bytes = Uint8Array.from(atob(body.z), (c) => c.charCodeAt(0));
      const drive = {};
      why = checkTrace(await gunzip(bytes, 2000000), track, ms - (lap.pen || 0) * 1000, drive);
      // the seconds for its hard crashes into walls must be in its time (the page adds them; one that left them out)
      const crashPen = (drive.crashes || 0) * CRASH_PEN;
      if (!why && crashPen > (lap.pen || 0)) { why = `crash: the drive has ${drive.crashes} of them, its time ${lap.pen || 0} s of penalty`; told = 'crash'; }
      if (!why) {
        // the car itself: seconds of the drive over what this car can do (the list of refusals gets the figures,
        // the sender only that it was the car)
        // (if the limits cannot be worked out the drive is not judged: an honest record must not wait on a fault here)
        let lim = null;
        try { lim = await this.carLimit(car); } catch (err) { console.error('car limits', car, err); }
        // (a stage run: which of its places were on the gravel, from the stage's own rules; one the rules refuse
        // is refused for that below, and its car is judged as if all of it were tarmac)
        const where = {};
        if (track === 'raadi') stageCheck(drive.xs, drive.zs, (lap.pen || 0) - crashPen, lim?.gas?.launch, where);
        const j = judgeDrive(drive.xs, drive.zs, drive.ys, lim, { roll: drive.roll, loose: where.loose });
        if (lim) this.margin('car', Math.max(j.pull, j.grip, j.stop, j.top));
        // (a car with thrusters: the gas its drive used over what its tank held, as a share of a full tank, and
        // the seconds it was turning over in the air, which is a kickflip inside the lap)
        if (lim?.gas) this.margin('gas', j.gas);
        if (j.why) { why = `car: ${j.why} (s over: pull ${j.pull}, grip ${j.grip}, stop ${j.stop}, top ${j.top}${lim?.gas ? `; gas over ${j.gas} of a tank, ${j.spent} tanks used; ${j.air} s of a kickflip` : ''})`; told = 'car'; }
        launch = lim?.gas?.launch;
      }
      // a stage run by the stage's own rules: its start, its way, its penalty seconds (worker/stagecheck.js)
      if (!why && track === 'raadi') { const st = stageCheck(drive.xs, drive.zs, (lap.pen || 0) - crashPen, launch); if (st) { why = `stage: ${st}`; told = 'stage'; } }
      // the lap by the server's own clock (a stage run: from its green light, without its penalty seconds)
      if (!why) { const c = this.lapClock(tk.sid, ms - (lap.pen || 0) * 1000, drive); if (c) { why = c; told = c.split(':')[0]; } }
    } catch { why = 'unreadable'; }
    if (why) return refuse(why, lap.name, bytes?.length || 0, told);
    // (the lap as it is now: this waited for the unpacking and perhaps the car's limits, and the same replay sent
    // twice at once must not put the lap on the board twice)
    lap.hold = this.sql.exec('SELECT hold FROM laps WHERE id = ?', lap.id).toArray()[0]?.hold;
    if (lap.hold === undefined || lap.hold === 2) return refuse('no such lap', lap.name);
    best = bestNow(); had = hadNow();
    const record = best == null || ms <= best;
    let ann = {};
    if (lap.hold) {
      // the held lap has its drive: it goes on the board now, and is told to everyone as a new lap would be
      this.sql.exec('UPDATE laps SET hold = NULL WHERE id = ?', lap.id);
      let splits = null;
      try { splits = lap.splits ? JSON.parse(lap.splits) : null; } catch { /* none */ }
      this.addToBoard({ track, name: lap.name, car, ms, at: lap.at, day: lap.day, splits, cp: lap.cp, inp: lap.inp, ty: lap.ty, pen: lap.pen });
      this.saveBoard();
      ann = track === TRACK ? { lap: { name: lap.name, car, ms } } : { run: { name: lap.name, car, ms, track } };
    }
    // (kept as the car's record replay only when it is the record: a held lap may have been the best of its day only)
    if (record && !(had && had.ms <= ms)) {
      this.sql.exec('INSERT OR REPLACE INTO replays (track, car, ms, name, at, data) VALUES (?, ?, ?, ?, ?, ?)', track, car, ms, lap.name, lap.at, bytes);
      this.rpIndex = null;
    }
    this.broadcast({ t: 'board', board: this.board(), ...ann });
    return json({ ok: true });
  }

  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const ip = req.headers.get('cf-connecting-ip') || 'local';
    const busy = () => json({ error: 'too many requests' }, 429);
    if (this.over(`a|${ip}`, 300, 60000)) return busy();

    if (path === '/api/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
      if (this.over(`c|${ip}`, 60, 300000)) return busy();
      // (a MAX_ONLINE variable on the Worker, set in the Cloudflare dashboard, overrides the cap without a deploy)
      const max = Math.max(1, Math.min(MAX_SOCKETS, Number(this.env?.MAX_ONLINE) || MAX_SOCKETS));
      const wk = this.waitKey(url, ip), now = Date.now();
      const pw = wk.startsWith('w|') ? wk.slice(2) : '';
      let q = this.queue(now);
      if (!q.idx.has(wk) && this.waiting.has(wk)) { this.qc = null; q = this.queue(now); }   // (joined it since)
      // a page whose idle car was put off the map (idleCars): kept out for a while, told as when the server is full
      // (no place in the queue: it asks again in a minute or so). A reload brings the game's own rule: let in.
      const pk = this.parked.get(wk), self = url.searchParams.get('i') === '1', rests = url.searchParams.get('r') === '1';
      if (pk && self) this.parked.delete(wk);
      else if (pk && now < pk.until) {
        const pair = new WebSocketPair();
        pair[1].accept();
        pair[1].send(JSON.stringify({ t: 'full', max, q: 0, qn: 0 }));
        pair[1].close(4001, 'full');
        return new Response(null, { status: 101, webSocket: pair[0] });
      } else if (pk) pk.back = now;
      const n = this.seats(max, pw), qi = q.idx.get(wk) ?? -1, free = max - n;
      // (its own connection coming back skips the queue: it had the place a moment ago)
      if (n >= max || (!this.ownSeat && (qi >= 0 ? qi >= free : q.list.length + q.added >= free))) {
        this.refused(wk, now);
        this.loadTick(now);
        this.room();                      // (seats may have dropped silent sockets)
        // full: a socket of its own (not one of the lobby's) that says so and closes, since a browser cannot
        // read why an upgrade was refused; the game then drives offline and asks again now and then
        const pair = new WebSocketPair();
        pair[1].accept();
        pair[1].send(JSON.stringify({ t: 'full', max, q: qi >= 0 ? qi + 1 : q.list.length + q.added, qn: q.list.length + q.added }));
        pair[1].close(4001, 'full');
        return new Response(null, { status: 101, webSocket: pair[0] });
      }
      let mine = 0;
      for (const ws of this.ctx.getWebSockets()) { const a = ws.deserializeAttachment(); if (a?.ip === ip && !a.x) mine++; }
      if (mine >= (n >= max * IP_TIGHT_AT ? IP_TIGHT : MAX_SOCKETS_IP)) return busy();
      this.admitted(wk, now);
      this.loadTick(now);
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({ at: Date.now(), ip, ...(pw ? { pw } : {}), ...(self ? { i: 1 } : {}), ...(rests ? { r: 1 } : {}) });
      this.room();                        // (one more place taken: tight now?)
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (path === '/api/name') {
      // a default name nobody has finished a lap with (and nobody online is using)
      return json({ name: this.freshName() });
    }

    if (path === '/api/board') return json(this.board());
    if (path === '/api/top' && req.method === 'GET') {
      // LAP TIMES with a car opened: its five best drivers of all time and of today, on each circuit, and the place
      // the page's own best in each car would have among that car's drivers: ?me=<name>&toomemagi=car.ms,car.ms
      // &raadi=... (the page's own laps; me's own times on the board do not count against them). Only read.
      if (this.over(`T|${ip}`, 40, 60000)) return busy();
      const t = this.topsNow(), me = cleanName(url.searchParams.get('me'));
      const out = { day: t.day };
      for (const track of [TRACK, ...Object.keys(STAGES)]) {
        const cars = t.tracks[track] || {}, top = {}, place = {};
        for (const [car, c] of Object.entries(cars)) {
          if (!cleanCar(car)) continue;                    // (a car not shown to anyone yet)
          top[car] = { all: topOf(c.all), today: topOf(c.today), n: c.all.size };
        }
        for (const p of String(url.searchParams.get(track) || '').split(',').slice(0, 40)) {
          const [c0, m0] = p.split('.'), car = cleanCar(c0), ms = Number(m0);
          if (car && top[car] && Number.isInteger(ms) && ms > 0 && ms <= 3600000) place[car] = [placeOf(cars[car].all, me, ms), ms];
        }
        out[track] = { top, place };
      }
      return json(out);
    }

    if (path === '/api/online') {
      // who is online now, for the stats page (Martin 2026-11-22: "sometimes check out of curiosity"):
      // the names, cars and race places everyone in the game already sees, no ids or addresses.
      // Ghosts (stealth) and sockets silent for 80 s are left out, like in the game's own list.
      const now = Date.now(), race = this.race, seen = new Set(), players = [], at = {};
      // (?all=1: everyone, for /stats' "and 24 more" tapped open, Martin 25 Nov; the cap keeps it at about 100)
      const lim = url.searchParams.get('all') ? 200 : 60;
      const on = race.s.phase === 'on';
      for (const ws of this.ctx.getWebSockets()) {
        const a = ws.deserializeAttachment();
        if (!a?.id || a.ghost || seen.has(a.id) || !race.live(ws, a, now)) continue;
        seen.add(a.id);
        const r = on && race.s.racers.find((x) => x.id === a.id);
        const k = a.drv ? 'drv' : a.w === 'map' ? 'stage' : a.w === 'garage' || a.w === 'away' || a.w === 'watch' ? a.w : 'start';
        players.push({ name: a.name, car: a.car, drv: !!a.drv, at: k, since: a.at || now, race: r ? (r.ms != null ? 'fin' : r.out ? 'out' : 'in') : null });
        // where the ones not driving are (Martin 25 Nov: 96 in the game, 54 driving: who are the rest?). On the
        // map and not driving: a Raadi stage run (not counted as driving for the race votes)
        at[k] = (at[k] || 0) + 1;
      }
      // (those on a Majoraadi run first, then the drivers, then the rest; Martin 26 Nov: "on stats page bring majoraadi
      // to the top", and the list is cut at 60, so the order is set here)
      const rank = (p) => (p.at === 'stage' ? 0 : p.drv ? 1 : 2);
      players.sort((x, y) => (rank(x) - rank(y)) || (x.since - y.since));
      const ph = race.phase(now);
      // (total and drv count everyone: the list shows the first 60, and the page once counted only those, 24 Nov)
      // pages waiting outside after SERVER FULL (asked again within WAIT_GONE), and the cap
      this.waitClean(now);
      const cap = Math.max(1, Math.min(MAX_SOCKETS, Number(this.env?.MAX_ONLINE) || MAX_SOCKETS));
      return json({ now, total: players.length, drv: players.filter((p) => p.drv).length, at, waiting: this.waiting.size, queue: ((q) => q.list.length + q.added)(this.queue(now)), cap, players: players.slice(0, lim), more: Math.max(0, players.length - lim),
        race: on ? { phase: ph, racers: race.s.racers.length, racing: race.active().filter((r) => r.ms == null).length, finished: race.finished().length, green: race.s.tGreen } : null });
    }

    if (path === '/api/ticket') {
      // the page asks for its lap ticket as soon as it opens, well before anyone can drive
      if (this.over(`t|${ip}`, 30, 600000)) return busy();
      return json({ key: await this.newTicket() });
    }

    if (path === '/api/lap' && req.method === 'POST') {
      // one lap {name, car, ms, k, ago, splits?, cp?, inp?, ty?, track?, pen?}, or a batch {laps: [...]} of laps a
      // browser kept and resends. track: 'raadi' for a time of the Raadi stage (none: a lap of Toomemägi), pen: the
      // penalty seconds in that time. k is the browser's lap ticket and ago how many ms ago the lap ended, by the
      // browser's own clock (so a wrong clock does not matter). A lap already stored (same ticket,
      // car and time) is not stored twice, so a browser can safely send again everything it has no
      // confirmation for.
      if (this.over(`l|${ip}`, 30, 60000)) return busy();
      let body;
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
      const list = Array.isArray(body?.laps) ? body.laps.slice(0, 50) : [body];
      const now = Date.now();
      const added = [], ok = [], held = [], tickets = new Map();
      const heldOut = (car, ms, track) => held.push({ car, ms, ...(track !== TRACK ? { track } : {}) });
      for (const l of list) {
        const name = cleanName(l?.name), car = cleanCar(l?.car), ms = Math.round(Number(l?.ms)), track = cleanTrack(l?.track);
        // (penalty seconds: whole, and the driving itself must still be a believable time)
        // (a stage's own, and on any track CRASH_PEN for each hard crash into a wall: the replay is asked again)
        const pen = Number.isInteger(l?.pen) && l.pen > 0 && l.pen <= 600 ? l.pen : 0;
        if (!name || !car || !(ms - pen * 1000 >= (STAGES[track] || LAP_MIN) && ms <= 3600000)) continue;
        // a time under a racist slur: answered as saved, so the browser stops sending it, and not kept
        if (badName(name)) { ok.push(ms); continue; }
        if (!tickets.has(l.k)) tickets.set(l.k, await this.readTicket(l.k));
        const tk = tickets.get(l.k);
        if (!tk) continue;
        const dup = this.sql.exec('SELECT hold FROM laps WHERE sid = ? AND car = ? AND ms = ? AND track = ? LIMIT 1', tk.sid, car, ms, track).toArray()[0];
        if (dup) { ok.push(ms); if (dup.hold) heldOut(car, ms, track); continue; }
        // when it was driven: it has to fit between the ticket being issued (or the ticket's last
        // lap ending) and now. 5 s of slack for the trip here. (Penalty seconds were not driven.)
        const ago = Number(l?.ago);
        const end = now - (ago > 0 ? ago : 0), start = end - (ms - pen * 1000);
        const last = this.sql.exec('SELECT at FROM laps WHERE sid = ? ORDER BY id DESC LIMIT 1', tk.sid).toArray()[0];
        if (!(ago <= 30 * DAY || !(ago > 0)) || start < tk.t0 - 5000 || (last && start < Date.parse(last.at) - 5000)) continue;
        // (enough new laps from this address this hour, or under this name today: not kept, and not sent again)
        if (this.over(`L|${ip}`, LAPS_IP_HOUR, 3600000)) { ok.push(ms); continue; }
        const at = new Date(end), day = tartuDay(at);
        if (this.sql.exec('SELECT COUNT(*) AS n FROM laps WHERE name = ? COLLATE NOCASE AND day = ?', name, day).one().n >= LAPS_NAME_DAY) { ok.push(ms); continue; }
        ok.push(ms);
        // split times: rising whole milliseconds inside the lap, with the checkpoint list they are for
        const sp = Array.isArray(l?.splits) && l.splits.length && l.splits.length <= 12 ? l.splits.map((v) => Math.round(Number(v))) : null;
        const cp = typeof l?.cp === 'string' && /^[0-9,]{1,80}$/.test(l.cp) ? l.cp : null;
        const good = track === TRACK && sp && cp && sp.length === cp.split(',').length && sp.every((v, k) => v > (k ? sp[k - 1] : 0) && v < ms);
        const row = { track, name, car, ms, at: at.toISOString(), day, splits: good ? sp : null, cp: good ? cp : null, inp: cleanInp(l?.inp), ty: l?.ty === 'gravel' ? 'gravel' : null, pen: pen || null };
        // a time that would be the car's best of all time or of today, or one of its ten best, waits for its replay (see "Replays")
        const hold = this.wouldLead(row) ? 1 : null;
        this.sql.exec('INSERT INTO laps (track, name, car, ms, at, day, splits, cp, sid, inp, ty, pen, hold) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          track, name, car, ms, row.at, row.day, good ? JSON.stringify(sp) : null, row.cp, tk.sid, row.inp, row.ty, row.pen, hold);
        if (hold) { heldOut(car, ms, track); continue; }
        this.addToBoard(row);
        added.push({ name, car, ms, track });
      }
      if (!ok.length) return json({ error: 'invalid lap' }, 400);
      const board = this.board();
      if (added.length) {
        this.saveBoard();
        // (a stage time goes out as `run`, not `lap`: a page opened before stage times were kept would
        // announce it as a lap record of Toomemägi)
        const lap = added.findLast((a) => a.track === TRACK), run = added.findLast((a) => a.track !== TRACK);
        this.broadcast({ t: 'board', board, ...(lap ? { lap: { name: lap.name, car: lap.car, ms: lap.ms } } : {}), ...(run ? { run } : {}) });
      }
      // (hold: the laps of this batch that wait for their replay; the page sends it, see sendReplays in multiplayer.js)
      return json({ ok: true, saved: ok, board, ...(held.length ? { hold: held } : {}) });
    }

    if (path === '/api/mark' && req.method === 'POST') {
      // a lap's start or finish from a page that has no connection to the lobby (the server full, or the
      // connection down for a moment): {k: its lap ticket, e: 's' | 'f', ms: the lap time at the finish}
      if (this.over(`m|${ip}`, 45, 60000)) return busy();
      let body;
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
      const tk = await this.readTicket(body?.k);
      if (!tk) return json({ error: 'invalid' }, 400);
      // (e 'p': where its car is, every few seconds of a lap: lapPlace)
      if (body.e === 'p') this.lapPlace(tk.sid, Number(body.x), Number(body.z));
      else this.lapMark(tk.sid, body.e, body.ms);
      return json({ ok: true });
    }

    // (a page opened before the logging was taken out still sends its runs: 410 tells it to stop writing them down)
    if (path === '/api/line' && req.method === 'POST') return json({ error: 'gone' }, 410);
    if (path === '/api/replay' && req.method === 'POST') return this.takeReplay(req, ip);
    if (path === '/api/margins') { if (this.over(`M|${ip}`, 20, 60000)) return busy(); return json(this.margins()); }
    if (path === '/api/replay' && url.searchParams.get('refused')) {
      // (anyone may read the list, so a drive refused for the car says only that: with the seconds over each limit a
      // tuner could turn the figures down until they pass. The whole reason is shown to the ADMIN_KEY, sent as
      // "Authorization: Bearer <key>", and stays in the table.)
      const key = this.env.ADMIN_KEY, all = !!key && sameText(req.headers.get('authorization') || '', `Bearer ${key}`);
      const rows = this.sql.exec('SELECT at, track, car, ms, name, why, bytes FROM replay_refused ORDER BY id DESC').toArray();
      return json(all ? rows : rows.map((r) => (r.why.startsWith('car') ? { ...r, why: 'car' } : r.why.startsWith('race: car') ? { ...r, why: 'race: car' } : r)));
    }
    if (path === '/api/replay') {
      // a record's replay: the gzipped samples as they came, with whose lap it is and its time in headers
      const track = cleanTrack(url.searchParams.get('track')), car = cleanCar(url.searchParams.get('car'));
      const r = car && this.sql.exec('SELECT ms, name, data FROM replays WHERE track = ? AND car = ?', track, car).toArray()[0];
      if (!r) return json({ error: 'no replay' }, 404);
      return new Response(r.data, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store', 'x-ms': String(r.ms), 'x-name': encodeURIComponent(r.name) } });
    }

    if (path === '/api/laps.csv' || path === '/api/laps.json') {
      if (this.over(`d|${ip}`, 6, 60000)) return busy();
      // the .json is the complete record (the nightly backup saves it, see .github/workflows/backup-laps.yml)
      // (hold 1: a lap still waiting for its replay, or whose replay did not hold up: not on the board; 2: taken off it)
      if (path.endsWith('.json')) return json(this.sql.exec('SELECT id, track, name, car, ms, at, day, splits, cp, inp, ty, pen, hold FROM laps ORDER BY id').toArray());
      const rows = this.sql.exec("SELECT id, track, name, car, ms, at, COALESCE(inp, 'kb') AS input, COALESCE(ty, 'road') AS tyres, COALESCE(pen, 0) AS pen, COALESCE(hold, 0) AS held FROM laps ORDER BY id").toArray();
      // (a name that starts like a formula gets an apostrophe, so a spreadsheet shows it as text
      // instead of running it)
      const q = (v) => `"${String(v).replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`;
      const csv = ['track,driver,car,lap_ms,lap_time,date_utc,id,input,tyres,penalty_s,held']
        .concat(rows.map((r) => [r.track, q(r.name), r.car, r.ms, `${Math.floor(r.ms / 60000)}:${((r.ms % 60000) / 1000).toFixed(2).padStart(5, '0')}`, r.at, r.id, r.input, r.tyres, r.pen, r.held].join(',')))
        .join('\n');
      return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'inline; filename="linnaring-laps.csv"', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
    }

    if (path === '/api/admin/delete-laps' && req.method === 'POST') {
      // Remove laps: {ids: [...]} (the id column of laps.csv) or {name: "..."} for all laps under a
      // name. Works only once the Worker has a secret called ADMIN_KEY, sent as
      // "Authorization: Bearer <key>"; without the secret this address does not exist.
      const key = this.env.ADMIN_KEY;
      if (!key) return json({ error: 'not found' }, 404);
      if (this.over(`x|${ip}`, 5, 600000)) return busy();
      if (!sameText(req.headers.get('authorization') || '', `Bearer ${key}`)) return json({ error: 'forbidden' }, 403);
      let body;
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
      const before = this.sql.exec('SELECT COUNT(*) AS n FROM laps').one().n;
      if (Array.isArray(body?.ids)) for (const id of body.ids.slice(0, 500)) { if (Number.isInteger(id)) this.sql.exec('DELETE FROM laps WHERE id = ?', id); }
      else if (typeof body?.name === 'string' && body.name) this.sql.exec('DELETE FROM laps WHERE name = ? COLLATE NOCASE', body.name);
      else return json({ error: 'ids or name' }, 400);
      const deleted = before - this.sql.exec('SELECT COUNT(*) AS n FROM laps').one().n;
      this.cache = this.rebuildBoard(); this.saveBoard();
      if (deleted) this.broadcast({ t: 'board', board: this.cache });
      return json({ ok: true, deleted, board: this.cache });
    }

    return json({ error: 'not found' }, 404);
  }

  // a socket that sends far more than the game does: shut, once, and the others hear it left
  flood(ws, r) {
    r.shut = true;
    const a = ws.deserializeAttachment();
    try { ws.close(1008, 'too many messages'); } catch { /* already closed */ }
    if (a?.id) { this.dropPose(ws, a.id); if (!a.ghost) { this.broadcast({ t: 'leave', id: a.id }, ws); this.race.gone(a, ws); this.drag.gone(a); } this.shut(ws, a); }
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 2000) return;
    // (a drag racer's place, 30 times a second to the other driver: its own allowance, worker/drag.js)
    if (raw.startsWith('{"t":"dp"')) { this.drag.feed(ws, raw); return; }
    // a socket that talks far faster than the game does is shut
    const now = Date.now();
    let r = this.rate.get(ws);
    if (!r) { r = { t: now, n: 0, lt: now, ln: 0 }; this.rate.set(ws, r); }
    if (r.shut) return;
    if (now - r.t > MSG_WINDOW) { r.t = now; r.n = 0; }
    if (++r.n > MSG_MAX) { this.flood(ws, r); return; }
    if (now - this.loadMin * 60000 >= 60000) this.loadTick(now);
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t !== 's' && m.t !== 'clock') {
      if (now - r.lt > LOUD_WINDOW) { r.lt = now; r.ln = 0; }
      if (++r.ln > LOUD_MAX) { this.flood(ws, r); return; }
    }
    let me = ws.deserializeAttachment();

    // A ghost (the game's stealth mode, ?off=100) hears everything but is never heard: it is left out
    // of the player list, its join and leave are not announced and nothing it sends is passed on.
    if (m.t === 's' && me?.id) {
      if (me.ghost) return;
      // position: checked, then passed on
      const p = cleanPose(m.p);
      if (p) this.pose(ws, me.id, p);
      return;
    }
    if (m.t === 'hello') {
      this.prune(ws);
      // the lap ticket: the one this browser already has (it reconnected), else a new one
      const ip = me?.ip || 'local';
      let key = (await this.readTicket(m.k)) ? m.k : null;
      if (!key && !this.over(`t|${ip}`, 30, 600000)) key = await this.newTicket();
      me = ws.deserializeAttachment();
      // A page keeps its id for as long as it is open, through lost connections and server restarts (a
      // deploy): the id comes from its lap ticket. Martin 2026-11-22: a reconnect in the middle of a race
      // gave him a new id, so his finish was not his and the race ran on to 7:00 with "1 RACING".
      const tk = key ? await this.readTicket(key) : null;
      let id = me?.id;
      if (!id && tk) id = (await this.sign(`id.${tk.sid}`)).slice(0, 8);
      if (!id) id = crypto.randomUUID().slice(0, 8);
      if (!me?.id) {
        // the same page's old connection, not closed yet: it is this one now. Same id: a lost connection
        // (quietly taken over). Same page id but another id: the tab was reloaded and its old socket lingers,
        // so the others hear it left (25 Nov: a reload showed the driver twice and held two places).
        for (const old of this.ctx.getWebSockets()) {
          if (old === ws) continue;
          const oa = old.deserializeAttachment();
          if (!oa || oa.x || !((oa.id && oa.id === id) || (me?.pw && oa.pw === me.pw))) continue;
          if (oa.id === id) { this.dropPose(old, id); this.shut(old, oa); try { old.close(1000, 'reconnected'); } catch { /* already closed */ } }
          else this.release(old, oa, 1000, 'reconnected');
        }
      }
      // (a slur as a name: the others see the name this socket had, or a random one; the page is not told)
      const name = okName(m.name) || me?.name || this.freshName();
      // (once a ghost, always a ghost on this socket: a later hello cannot announce it)
      const ghost = !!m.ghost || !!me?.ghost;
      const w = cleanWhere(m.w) || me?.w;
      const on = w === 'watch' ? cleanOn(m.on) || me?.on || '' : '';
      const b = m.b === 1 || !!me?.b;              // takes positions in bundles (see TICK)
      this.bund.set(ws, b);
      // thumbs up received today: the page's own count (kept in its browser till midnight, so a reload or a
      // lost connection keeps it), or what this socket had
      // (at most KUDOS_PAIR from any one player: a day saved before that rule, or by an old page, loses the rest)
      const { kn, kf } = (() => {
        const n = Math.max(me?.kn || 0, Number.isInteger(m.kn) ? Math.min(999, Math.max(0, m.kn)) : 0);
        return kudosFair(n, ((me?.kn || 0) >= n ? me?.kf : Array.isArray(m.kf) ? m.kf.map(cleanKudo).filter(Boolean).slice(-KUDOS_KEEP) : []) || []);
      })();
      // (the plate: the one sent, or the one this socket had; a page that sends none keeps its cars' own)
      const pl = 'pl' in m ? okPlate(m.pl) : me?.pl || '';
      const a = { id, name, car: cleanCar(m.car) || 'w201', at: Date.now(), ip, ...(pl ? { pl } : {}), ...(tk ? { sid: tk.sid } : {}), ...(me?.pw ? { pw: me.pw } : {}), ...(me?.i ? { i: 1 } : {}), ...(me?.r ? { r: 1 } : {}), ...(kn ? { kn, kf: kf || [] } : {}), ...(b ? { b: 1 } : {}), ...(ghost ? { ghost: true } : {}), ...(me?.drv ? { drv: true } : {}), ...(w ? { w, wt: w === me?.w && me?.wt ? me.wt : Date.now() } : {}), ...(on ? { on } : {}) };
      ws.serializeAttachment(a);
      // (tight: the server over 90 % full, so a car left standing goes to the garage, see room())
      ws.send(JSON.stringify({ t: 'welcome', id, key, players: this.players().filter((p) => p.id !== id), wn: this.watchCounts().get(id) || 0, ...(this.room() ? { tight: 1 } : {}), board: this.board() }));
      if (!me?.id && ghost) this.ghostHello(id);
      if (!me?.id && !ghost) { this.broadcast({ t: 'join', id, name, car: a.car, ...(pl ? { pl } : {}), ...(w ? { w } : {}), ...(kn ? { kn, kf: a.kf } : {}) }, ws); this.race.back(a); }
      // (a spectator back on: the count of whom they watch)
      if (!ghost && (me?.on || '') !== on) this.watchTold([me?.on, on]);
      this.race.sendTo(ws);
      this.drag.back(id, ws);
      this.drag.sendTo(ws);
      return;
    }
    if (!me?.id) return;
    if (this.race.message(ws, me, m)) return;
    if (this.drag.message(ws, me, m)) return;
    // a lap's start or finish, as it happens (see lapMark)
    if (m.t === 'lm') { this.lapMark(me.sid, m.e, m.ms, now, me.id); return; }
    if (m.t === 'name') {
      const name = okName(m.name);                                         // (a slur: silently not taken)
      if (!name || name === me.name || now - (me.nt || 0) < 1500) return;   // (and not a stream of renames)
      me.name = name; me.nt = now; ws.serializeAttachment(me);
      if (!me.ghost) { this.broadcast({ t: 'name', id: me.id, name }, ws); this.race.changed(me); }
    } else if (m.t === 'plate') {
      // a new number plate ('' for the car's own); a bad one is silently not taken, as a name is
      const pl = m.pl === '' ? '' : okPlate(m.pl);
      if ((!pl && m.pl !== '') || pl === (me.pl || '') || now - (me.pt || 0) < 1500) return;
      if (pl) me.pl = pl; else delete me.pl;
      me.pt = now; ws.serializeAttachment(me);
      if (!me.ghost) this.broadcast({ t: 'plate', id: me.id, pl }, ws);
    } else if (m.t === 'car') {
      const car = cleanCar(m.car);
      if (!car || car === me.car) return;
      me.car = car; ws.serializeAttachment(me);
      { const e = this.poses.get(me.id); if (e) { e.car = car; e.vm = 0; } }        // (another car's top speed: pose)
      if (!me.ghost) { this.broadcast({ t: 'car', id: me.id, car }, ws); this.race.changed(me); }
    } else if (m.t === 'at') {
      // where a player is (map, garage, away in another tab), for the others' lists (Martin, 2026-11-23);
      // 'watch' with on: following another player's car as a spectator
      const w = cleanWhere(m.w), on = w === 'watch' ? cleanOn(m.on) : '';
      if (!w || (w === me.w && on === (me.on || ''))) return;
      const was = me.on, wasW = me.w;
      if (w !== me.w) me.wt = now;
      me.w = w; me.on = on || undefined; ws.serializeAttachment(me);
      if (!me.ghost) this.race.moved(me, wasW);
      // (everyone hears "watching", and the watched players' new counts, never who watches whom)
      if (!me.ghost) { this.broadcast({ t: 'at', id: me.id, w }, ws); if (was !== me.on) this.watchTold([was, me.on]); }
    } else if (m.t === 'ku') {
      // a thumbs up for another player (Martin, 2026-11-23): told to everyone, sender too, since all who are
      // near see it as a sign in the receiver's back window (src/kudos.js). Not from or to a ghost or oneself.
      // One player to the same player at most KUDOS_PAIR a day (Martin 2026-11-26: one filled another's bus window
      // with about 30), counted in the receiver's collection, which their page keeps through the day.
      const to = cleanOn(m.to);
      const rc = me.ghost || !to || to === me.id ? null : this.players().find((p) => p.id === to);
      if (!rc || kudosFrom(rc.kf, me.id, me.name) >= KUDOS_PAIR) return;
      if (this.over(`k|${me.id}`, KUDOS_MAX, 60000) || this.over(`k|${me.id}|${to}`, 1, KUDOS_GAP)) return;
      if (this.over(`ki|${me.ip}|${to}`, KUDOS_ADDR, 3600000)) return;
      // the receiver's count for this session and the last senders, for those who come later (src/kudos.js:
      // the small thumbs on that car's back window)
      for (const w of this.ctx.getWebSockets()) {
        const a = w.deserializeAttachment();
        if (a?.id !== to || a.ghost) continue;
        a.kn = (a.kn || 0) + 1; a.kf = [...(a.kf || []), [me.id, me.name, now]].slice(-KUDOS_KEEP);
        w.serializeAttachment(a);
      }
      this.broadcast({ t: 'ku', id: me.id, to });
    } else if (m.t === 'jmp') {
      // a Rocket's kickflip: the flight's plan (src/cars/thrust.js: 19 numbers) and the sender's clock at the
      // press, told to the others so that each flies that car along the same curve. A tank holds two.
      // (x: that flight ended early, against something in its way)
      if (me.ghost || me.car !== 'rocket') return;
      if (m.x === 1) { if (!this.over(`jx|${me.id}`, 4, 20000)) this.broadcast({ t: 'jmp', id: me.id, x: 1 }, ws); return; }
      if (!Array.isArray(m.p) || m.p.length !== 19) return;
      if (!m.p.every((v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 100000)) return;
      if (!Number.isInteger(m.c) || m.c < 0 || m.c >= 60000) return;
      if (this.over(`j|${me.id}`, 4, 20000)) return;
      // (the flight starts where the car is and no faster than a car goes: a made-up plan would show the others a
      // car in the air anywhere on the map for up to 9 s. JMP_NEAR: what a car covers between two positions, twice over)
      const at = this.poses.get(me.id);
      if (!at || Math.hypot(m.p[0] - at.p[0], m.p[1] - at.p[1]) > JMP_NEAR || Math.hypot(m.p[3], m.p[4]) > V_MAX) return;
      this.lapFlight(me.sid, me.id);
      this.broadcast({ t: 'jmp', id: me.id, p: m.p, c: m.c }, ws);
    }
  }

  async webSocketClose(ws) {
    const me = ws.deserializeAttachment();
    try { ws.close(); } catch { /* already closed */ }
    this.dropPose(ws, me?.id);
    if (me?.id && !me.ghost) { this.broadcast({ t: 'leave', id: me.id }, ws); this.race.gone(me, ws); this.drag.gone(me); if (me.on) this.watchTold([me.on], ws); }
    this.room(ws);                        // (a place freed: room again?)
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }
}
