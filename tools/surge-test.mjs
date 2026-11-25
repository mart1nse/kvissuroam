// A surge while the server is full (Martin 2026-11-25: a Reddit share, thousands opening the game at once): the
// real lobby under `wrangler dev` with a cap of 3, and thousands of simulated pages that do what a page does:
// ask for a lap ticket, a name (first visit), the lap board, a stats bundle after 20 s, and then ask for a
// place on the game's own retry schedule (from its place in the queue), while the 3 inside come and go.
//   node tools/surge-test.mjs [pages=3000] [ramp=60] [secs=180] [old]  (old: everyone retries every 20-40 s, as
//   before 25 Nov)   ·   node tools/surge-test.mjs probe   (how many refusals a second the lobby manages here)
// Prints requests a second to the lobby and to the stats object, answer times, and a cost per hour at
// Cloudflare's Workers Paid prices.
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`${k}=`)); return a ? a.slice(k.length + 1) : d; };
const PORT = +arg('port', 8789), PAGES = +arg('pages', 3000), RAMP = +arg('ramp', 60) * 1000, SECS = +arg('secs', 180) * 1000;
const OLD = process.argv.includes('old'), PROBE = process.argv.includes('probe');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ipOf = (i) => `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`;

// ---- what gets measured
const t0 = Date.now();
const stat = {};
function note(kind, ms, ok = true) {
  const s = (stat[kind] ||= { n: 0, bad: 0, ms: [], perSec: new Map() });
  s.n++; if (!ok) s.bad++;
  if (ms != null) s.ms.push(ms);
  const sec = Math.floor((Date.now() - t0) / 1000);
  s.perSec.set(sec, (s.perSec.get(sec) || 0) + 1);
}
const pct = (a, p) => { if (!a.length) return 0; const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * p))]; };

// ---- one request for a place: the first message tells full (with the queue place) or welcome
function ask(w, ip, hello) {
  return new Promise((resolve) => {
    const t = Date.now(), s = net.connect(PORT, '127.0.0.1');
    let buf = Buffer.alloc(0), open = false, done = false;
    const end = (r) => { if (done) return; done = true; clearTimeout(to); resolve({ ...r, ms: Date.now() - t, sock: s }); if (!r.keep) s.destroy(); };
    const to = setTimeout(() => end({ err: 'timeout' }), 15000);
    s.on('error', () => end({ err: 'error' }));
    s.on('connect', () => s.write(`GET /api/ws?w=${w} HTTP/1.1\r\nHost: 127.0.0.1:${PORT}\r\ncf-connecting-ip: ${ip}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
    s.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      if (!open) {
        const i = buf.indexOf('\r\n\r\n'); if (i < 0) return;
        const head = buf.subarray(0, i).toString(); buf = buf.subarray(i + 4);
        if (!/^HTTP\/1\.1 101/.test(head)) return end({ err: head.split('\r\n')[0] });
        open = true;
        if (hello) frame(s, Buffer.from(JSON.stringify({ t: 'hello', b: 1, name: 'Surge', car: 'w201', w: 'map' })));
      }
      while (buf.length >= 2) {
        let n = buf[1] & 127, o = 2;
        if (n === 126) { if (buf.length < 4) return; n = buf.readUInt16BE(2); o = 4; } else if (n === 127) { if (buf.length < 10) return; n = Number(buf.readBigUInt64BE(2)); o = 10; }
        if (buf.length < o + n) return;
        const op = buf[0] & 15, p = buf.subarray(o, o + n); buf = buf.subarray(o + n);
        if (op === 8) return end({ err: 'closed' });
        if (op !== 1) continue;
        let m; try { m = JSON.parse(p.toString()); } catch { continue; }
        if (m.t === 'full') return end({ full: true, q: m.q || 0 });
        if (m.t === 'welcome') return end({ full: false, keep: true });
      }
    });
    if (!hello) s.on('connect', () => {});
  });
}
function frame(s, p) {
  const mask = crypto.randomBytes(4), n = p.length;
  const head = n < 126 ? Buffer.from([0x81, 0x80 | n]) : Buffer.from([0x81, 0x80 | 126, n >> 8, n & 255]);
  s.write(Buffer.concat([head, mask, Buffer.from(p.map((b, i) => b ^ mask[i % 4]))]));
}
// the game's own retry schedule (src/net/multiplayer.js schedule())
const nextWait = (q) => {
  const r = Math.random();
  if (OLD) return 20000 + r * 20000;
  q = q || 999;
  return q <= 3 ? 4000 + r * 2000 : q <= 10 ? 8000 + r * 4000 : q <= 30 ? 20000 + r * 10000 : 60000 + r * 30000;
};
async function http(kind, path, ip, init = {}) {
  const t = Date.now();
  try { const r = await fetch(`http://127.0.0.1:${PORT}${path}`, { ...init, headers: { 'cf-connecting-ip': ip, ...(init.headers || {}) } }); await r.arrayBuffer(); note(kind, Date.now() - t, r.ok); return r.ok; } catch { note(kind, Date.now() - t, false); return false; }
}

// ---- the server
const dev = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--var', 'MAX_ONLINE:3', '--var', 'IDLE_S:600', '--persist-to', `/tmp/surge-${process.pid}`],
  { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-dev.pid); } catch { /* gone */ } };
process.on('exit', stop);
for (let t = Date.now(); ; await sleep(500)) {
  try { if ((await fetch(`http://127.0.0.1:${PORT}/api/online`)).ok) break; } catch { /* not yet */ }
  if (Date.now() - t > 180000) throw new Error('wrangler dev did not start');
}

if (PROBE) {
  // fill it, then as many refusals as it will give for 15 s, 64 at a time
  for (let i = 0; i < 3; i++) await ask(`hold${i}xx`, ipOf(i + 1), true);
  const tEnd = Date.now() + 15000; let n = 0; const ms = [];
  await Promise.all(Array.from({ length: 64 }, async (_, k) => {
    for (let j = 0; Date.now() < tEnd; j++) { const r = await ask(`p${k}x${j}`.padEnd(8, '0'), ipOf(1000 + k * 997 + j), false); if (r.full) { n++; ms.push(r.ms); } }
  }));
  console.log(`refusals: ${(n / 15).toFixed(0)} a second, p50 ${pct(ms, 0.5)} ms, p95 ${pct(ms, 0.95)} ms`);
  stop(); process.exit(0);
}

// three inside, each leaving after 15 to 45 s and coming back as a new page (so places keep freeing)
let inside = 0;
const holders = [];
async function holderLoop(k) {
  for (let j = 0; Date.now() - t0 < SECS; j++) {
    const r = await ask(`h${k}y${j}`.padEnd(8, '0'), ipOf(500 + k), true);
    if (r.full) { await sleep(3000); continue; }
    inside++; holders.push(r.sock);
    await sleep(15000 + Math.random() * 30000);
    r.sock.destroy(); inside--;
  }
}
for (let k = 0; k < 3; k++) holderLoop(k);
await sleep(1000);

// the surge
const got = { in: 0, waits: [] };
async function pageLoop(i) {
  await sleep(Math.random() * RAMP);
  const ip = ipOf(10000 + i), w = crypto.randomBytes(5).toString('hex');
  http('ticket', '/api/ticket', ip);
  if (i % 3 === 0) http('name', '/api/name', ip);
  http('board', '/api/board', ip);
  setTimeout(() => http('stats', '/api/stats', ip, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ v: 1, first: { dev: 'phone', os: 'ios', br: 'safari', lang: 'en' }, menu: 20, drive: 0, km: 0, laps: {}, smash: {}, misc: {}, death: {}, frz: {}, err: [], car: {}, inp: {}, view: {}, gfx: {}, fps: {}, heat: {}, dev: 'phone' }) }), 20000);
  const tw = Date.now();
  let retry = 1;
  while (Date.now() - t0 < SECS) {
    const r = await ask(w, ip, true);
    note('ws', r.ms, !r.err);
    // (no answer: the game's back-off, 2, 4, 8, 16, 32, 64 s, spread past 8)
    if (r.err) { retry = Math.min(retry * 2, OLD ? 15 : 64); await sleep(retry * (!OLD && retry > 8 ? 750 + Math.random() * 500 : 1000)); continue; }
    if (!r.full) { got.in++; got.waits.push(Date.now() - tw); r.sock.destroy(); return; }
    await sleep(nextWait(r.q));
  }
}
const all = Array.from({ length: PAGES }, (_, i) => pageLoop(i));
// a line every 15 s
const ticker = setInterval(() => {
  const sec = Math.floor((Date.now() - t0) / 1000);
  let ws = 0; for (let k = sec - 15; k < sec; k++) ws += stat.ws?.perSec.get(k) || 0;
  console.log(`${String(sec).padStart(4)} s  places asked ${(ws / 15).toFixed(0)}/s  got in so far ${got.in}`);
}, 15000);
await Promise.race([Promise.all(all), sleep(SECS + 5000)]);
clearInterval(ticker);

// ---- report
const secs = (Date.now() - t0) / 1000;
let lobby = 0, stats = 0, peak = 0;
const perSecAll = new Map();
for (const [k, s] of Object.entries(stat)) {
  if (k === 'stats') stats += s.n; else lobby += s.n;
  if (k !== 'stats') for (const [sec, n] of s.perSec) perSecAll.set(sec, (perSecAll.get(sec) || 0) + n);
}
for (const n of perSecAll.values()) peak = Math.max(peak, n);
// settled: the last minute, when everyone has opened and asks on the queue's schedule
let last = 0; const end = Math.floor(secs); for (let k = end - 60; k < end; k++) last += stat.ws?.perSec.get(k) || 0;
console.log(`\n${PAGES} pages over ${RAMP / 1000} s, ${secs.toFixed(0)} s run${OLD ? ' (old retry: every 20-40 s)' : ''}`);
for (const [k, s] of Object.entries(stat)) console.log(`  ${k.padEnd(7)} ${String(s.n).padStart(6)} requests, ${s.bad} failed, p50 ${pct(s.ms, 0.5)} ms, p95 ${pct(s.ms, 0.95)} ms, p99 ${pct(s.ms, 0.99)} ms`);
const avg = lobby / secs, settled = last / 60;
console.log(`  to the lobby: ${avg.toFixed(0)}/s on average, peak ${peak}/s; place questions in the last minute ${settled.toFixed(0)}/s (${(settled / PAGES * 10000).toFixed(0)}/s per 10,000 waiting)`);
console.log(`  stats object: ${(stats / secs).toFixed(1)}/s`);
// Workers Paid: $0.30 per million Worker requests, $0.15 per million Durable Object requests (every one here goes
// through both); duration is billed for the lobby anyway (it holds the sockets)
const per10k = settled / PAGES * 10000 * 3600;
console.log(`  cost while 10,000 wait: ${(per10k / 1e6).toFixed(2)} M requests an hour, about $${(per10k / 1e6 * 0.45).toFixed(2)} an hour`);
console.log(`  got in: ${got.in}, waited p50 ${(pct(got.waits, 0.5) / 1000).toFixed(0)} s`);
stop();
process.exit(0);
