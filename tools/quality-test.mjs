// Drives the graphics governor (src/quality.js) with made-up frame times and checks it settles
// without flicker: node tools/quality-test.mjs
import { createGovernor, deviceLadder, LADDER } from '../src/quality.js';

let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };

// cost(level) -> frame ms; runs seconds of frames, returns the level history
function run(levels, start, cost, seconds, jitter = 0.5, gpuCost = null) {
  const g = createGovernor({ levels, start });
  const moves = [];
  let t = 0, seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  while (t < seconds * 1000) {
    const ms = Math.max(1, cost(g.level, t) + (rnd() - 0.5) * 2 * jitter);
    t += ms;
    const ch = g.feed(ms, gpuCost ? gpuCost(g.level, t) : null);
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
  check(g.level <= 3, `software rendering reaches the bottom rungs (${g.level}) in 2 min`);   // (3: the same rung as 2 was before the extra low rung went in under it)
}

// 4. battery saver: 30 Hz whatever we do; must not stay low
{
  const { g, moves } = run(N, N - 1, () => vsync(30, 5), 600, 0.2);
  check(g.level >= N - 2, `30 Hz cap ends near the top (rung ${g.level}, ${moves.length} moves: ${moves.map((m) => `${m.t}s ${m.from}->${m.to} ${m.why}`).join(', ')})`);
}
// 4b. the battery saver is told to the player; when the charger goes in (recheck) a machine too slow for the
// top rung is free to step down again
{
  const work = (l) => 14 * 1.3 ** (l - 6);         // rung 6 and below hold 60 Hz
  const g = createGovernor({ levels: N, start: N - 1 });
  const moves = [];
  let t = 0;
  for (; t < 60000; t += 1000 / 30) g.feed(1000 / 30);
  check(g.capped > 28 && g.capped < 32 && g.level === N - 1, `30 Hz cap is reported, back on the top rung (${g.capped.toFixed(1)} fps, rung ${g.level})`);
  g.recheck();
  while (t < 300000) { const ms = vsync(60, work(g.level)); t += ms; const ch = g.feed(ms); if (ch) moves.push(`${Math.round(t / 1000)}s ${ch.from}->${ch.to} ${ch.why}`); }
  check(g.capped === 0 && g.level <= 6 && g.level >= 5, `cap gone with the charger in: settles on rung ${g.level} (${moves.join(', ')})`);
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

// 9. the graphics card nearly full but keeping up (Martin's Chrome, 13.8 of 16.7 ms): stays on top
{ const { moves } = run(N, N - 1, () => 16.67, 300, 0.3, () => 13.8); check(moves.length === 0, 'card at 83% stays on top'); }

// 10. the card falls behind while the browser still asks for 60 frames (after a tab switch):
// steps down until the card keeps up, then climbs back once the warm-up is over, and stays
{
  const card = (l, t) => 13.8 * 1.25 ** (l - (N - 1)) * (t < 20000 ? 1.5 : 1);
  const { g, moves } = run(N, N - 1, () => 16.67, 300, 0.3, card);
  const down = moves.filter((m) => m.to < m.from).length;
  check(down >= 1 && moves[0].t < 10, `steps down within seconds when the card falls behind (${moves.map((m) => `${m.t}s ${m.from}->${m.to} ${m.why}`).join(', ')})`);
  check(g.level === N - 1, `back on top after the warm-up (rung ${g.level})`);
}

// 11. a card that can't hold the top rung at all: settles one down, does not keep retrying
{
  const { g, moves } = run(N, N - 1, () => 16.67, 900, 0.3, (l) => 18 * 1.25 ** (l - (N - 1)));
  check(g.level === N - 2 && moves.length <= 3, `card too slow for the top settles one down (rung ${g.level}, ${moves.length} moves)`);
}

process.exit(failed ? 1 : 0);
