// Drives the graphics governor (src/quality.js) with made-up frame times and checks it settles
// without flicker: node tools/quality-test.mjs
import { createGovernor, deviceLadder, LADDER } from '../src/quality.js';

let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };

// cost(level) -> frame ms; runs seconds of frames, returns the level history
function run(levels, start, cost, seconds, jitter = 0.5) {
  const g = createGovernor({ levels, start });
  const moves = [];
  let t = 0, seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  while (t < seconds * 1000) {
    const ms = Math.max(1, cost(g.level, t) + (rnd() - 0.5) * 2 * jitter);
    t += ms;
    const ch = g.feed(ms);
    if (ch) moves.push({ t: Math.round(t / 1000), ...ch });
  }
  return { g, moves };
}
// a screen at hz with vsync: the frame takes the next whole refresh after the work
const vsync = (hz, work) => { const r = 1000 / hz; return Math.ceil(work / r - 1e-6) * r; };

const N = deviceLadder({ dpr: 2, shadow: 2048, trees: 150, load: 1000 }).length;
check(N === LADDER.length, `desktop 2x ladder has every rung (${N})`);
check(deviceLadder({ dpr: 1, shadow: 1024, trees: 70, load: 520 }).length < N, 'phone ladder merges rungs it cannot use');

// 1. fast machine at 60 Hz: never moves
{ const { moves } = run(N, N - 1, () => vsync(60, 9), 120); check(moves.length === 0, `fast machine stays on top (${moves.length} moves)`); }

// 2. slow GPU: work falls 30% per rung down; must come down to a rung that holds 60 and stay
{
  const work = (l) => 14 * 1.3 ** (l - 3);         // rung 3 and below hold 60 Hz
  const { g, moves } = run(N, N - 1, (l) => vsync(60, work(l)), 600);
  const last = moves.length ? moves[moves.length - 1].t : 0;
  check(g.level >= 2 && g.level <= 3, `slow GPU settles on rung ${g.level} (moves: ${moves.map((m) => `${m.t}s ${m.from}->${m.to}`).join(', ')})`);
  check(last < 200, `and stops moving (last move at ${last}s)`);
}

// 3. very slow (software rendering, 8 fps on top): drops fast, two rungs at a time
{
  const { g, moves } = run(N, N - 1, (l) => 125 * 0.75 ** (N - 1 - l), 120);
  check(moves[0]?.to === N - 3, 'very slow frames skip a rung');
  check(g.level <= 2, `software rendering reaches the bottom rungs (${g.level}) in 2 min`);
}

// 4. battery saver: 30 Hz whatever we do; must not stay low
{
  const { g, moves } = run(N, N - 1, () => vsync(30, 5), 600, 0.2);
  check(g.level >= N - 2, `30 Hz cap ends near the top (rung ${g.level}, ${moves.length} moves: ${moves.map((m) => `${m.t}s ${m.from}->${m.to} ${m.why}`).join(', ')})`);
}

// 5. borderline: one rung up is just too slow; must not keep flickering
{
  const { moves } = run(N, 4, (l) => (l >= 5 ? 26 : 16.67), 900);
  const ups = moves.filter((m) => m.to > m.from).length;
  check(ups <= 2, `borderline rung tried at most twice in 15 min (${ups} tries)`);
}

// 6. 120 Hz screen, heavy top rung at 70 fps: fine, stays
{ const { moves } = run(N, N - 1, () => vsync(120, 13), 120); check(moves.length === 0, '70 fps on 120 Hz stays on top'); }

// 7. machine gets busy then free again (another app): goes down, comes back up later
{
  const { g, moves } = run(N, N - 1, (l, t) => (t > 30000 && t < 90000 ? vsync(60, 22 * 1.3 ** (l - (N - 1))) : vsync(60, 9)), 400);
  check(moves.some((m) => m.to < m.from) && g.level === N - 1, `recovers after a busy minute (rung ${g.level}, ${moves.length} moves)`);
}

// 8. hitches (streaming, GC) on a fast machine: no step down
{ const { moves } = run(N, N - 1, (l, t) => (Math.floor(t / 16.67) % 40 === 0 ? 120 : 16.67), 120); check(moves.length === 0, 'occasional long frames do not count'); }

process.exit(failed ? 1 : 0);
