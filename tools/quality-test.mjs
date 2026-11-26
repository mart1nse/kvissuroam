// Drives the graphics governor (src/quality.js) with made-up frame times and checks it settles
// without flicker: node tools/quality-test.mjs
import { createGovernor, createPacer, createQuality, deviceLadder, LADDER, TRIMS } from '../src/quality.js';

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

// 12. the saved levels of a visit are there on every later visit, also the ones kept under the keys of
// before the extra low rung. (They were read from the old key once and never written under the new one:
// from the second visit on a phone had forgotten the level it must stay under after running out of
// memory, and an iPhone 13 reloaded itself drive after drive, 21 Nov 2026.)
{
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const caps = { dpr: 1.5, shadow: 1024, trees: 70, load: 520 }, id = `${caps.dpr}/${caps.shadow}/${caps.trees}/${caps.load}`;
  const hooks = () => ({ renderer: { getPixelRatio: () => 1, setPixelRatio() {}, shadowMap: {} }, sun: { shadow: { mapSize: { x: 0, set() {} }, map: null } }, quality: {}, setTrees() {} });
  const visit = () => { const q = createQuality(hooks(), caps, {}); mem.delete('kvissuroam.alive2'); return q; };     // (closed in the ordinary way: the mark of being on screen goes)
  mem.set('kvissuroam.gfxCap', JSON.stringify({ ladder: id, level: 2 }));
  mem.set('kvissuroam.gfxAuto2', JSON.stringify({ ladder: id, level: 1 }));
  const caps3 = [visit().cap, visit().cap, visit().cap];
  check(caps3.every((c) => c === 3), `a cap saved before the extra low rung holds on every later visit, one level up (${caps3.join(', ')})`);
  check(JSON.parse(mem.get('kvissuroam.gfxAuto3') || '{}').level === 2, `and so does the level the device held steady (${mem.get('kvissuroam.gfxAuto3')})`);
  // a page that died on screen: one level under where it died; again within half an hour: two under
  mem.clear();
  mem.set('kvissuroam.alive2', JSON.stringify({ ladder: id, level: 6 }));
  const a = visit().cap;
  mem.set('kvissuroam.alive2', JSON.stringify({ ladder: id, level: 5 }));
  const b = visit().cap;
  check(a === 5 && b === 3, `a crash caps one level lower, a second one soon after two (${a}, ${b})`);
  // the clues the mark carried come out for the stats (24 Nov 2026), and an old mark without them still works
  mem.set('kvissuroam.alive2', JSON.stringify({ ladder: id, level: 4, s: 700, heap: 520, tex: 260 }));
  const d = visit().death;
  check(d && d.level === 4 && d.s === 700 && d.heap === 520 && d.tex === 260 && d.cap === 2, `a death's clues reach the stats (${JSON.stringify(d)})`);
  mem.set('kvissuroam.gfxCap2', JSON.stringify({ ladder: id, level: 5 }));
  mem.set('kvissuroam.alive2', JSON.stringify({ ladder: id, level: 3 }));
  const d2 = visit().death;
  check(d2 && d2.s === null && d2.heap === null && d2.cap === 2, `an old mark without clues (${JSON.stringify(d2)})`);
  check(visit().death === null, 'no death after a visit that closed in the ordinary way');
  delete globalThis.localStorage;
}

// 13. even pictures (26 Nov 2026, a MacBook Pro at a steady 60 FPS with 566 pictures held back in 2 minutes): AUTO
// trims the sharpness a step at a time while pictures keep being finished a refresh late, and not otherwise.
// rateAt(step, t) -> the share of frames whose picture is held back at that trim step
{
  const pace = (rateAt, seconds, counts = () => true) => {
    const p = createPacer(), moves = [];
    let t = 0, seed = 7, acc = 0;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    while (t < seconds * 1000) {
      t += 16.67;
      if (!counts(t)) continue;
      const held = rnd() < rateAt(p.step, t) ? 1 : 0;
      const k = p.feed(16.67, held);
      if (k >= 0) moves.push(`${Math.round(t / 1000)}s ${p.off ? 'off' : k}`);
    }
    return { p, moves };
  };
  check(TRIMS[0] === 1 && TRIMS.every((x, i) => i === 0 || x < TRIMS[i - 1]), `trim steps go down from full sharpness (${TRIMS.join(', ')})`);
  // an ordinary desktop (the live average, 25 Nov: about 0.7 in 100 frames): never trimmed
  { const { moves } = pace(() => 0.007, 900); check(moves.length === 0, `an even picture is left alone (${moves.length} moves)`); }
  // the MacBook Pro: 8 in 100 at full sharpness, 1.5 one step down: trims once, early, and stays
  { const { p, moves } = pace((k) => [0.08, 0.015, 0.01, 0.005][k], 1800); check(p.step === 1 && moves.length === 1 && parseInt(moves[0]) < 15, `uneven pictures trim the sharpness one step and stay there (${moves.join(', ')})`); }
  // a card further over: goes on down until it is even
  { const { p, moves } = pace((k) => [0.2, 0.12, 0.06, 0.02][k], 900); check(p.step === 3 && moves.length === 3, `a card further over is trimmed all the way (${moves.join(', ')})`); }
  // quite even one step down: after a minute a try back up, which does not hold; the next tries come twice as far apart
  { const { p, moves } = pace((k) => [0.08, 0.002, 0, 0][k], 3600); const ups = moves.filter((m) => m.endsWith(' 0')).map((m) => parseInt(m)); check(p.step === 1 && ups.length >= 3 && ups.length <= 6 && ups[ups.length - 1] - ups[ups.length - 2] > (ups[1] - ups[0]) * 1.5, `tries back to full sharpness come further and further apart (${moves.join(', ')})`); }
  // what made it uneven goes away (a heavy part of town left behind): back to full and staying there
  { const { p, moves } = pace((k, t) => (t < 120000 ? [0.08, 0.002, 0, 0][k] : 0.002), 1800); check(p.step === 0 && !p.off && moves.length <= 4, `full sharpness comes back when the pictures stay even (${moves.join(', ')})`); }
  // pictures held back by something the sharpness does not change: the whole trim is tried once, then put back for good
  { const { p, moves } = pace(() => 0.08, 1800); check(p.step === 0 && p.off && moves.length === 4 && parseInt(moves[3]) < 60, `a trim that changes nothing is put back and left alone (${moves.join(', ')})`); }
  // the town loading, the garage, a jump: frames that do not count never trim
  { const { moves } = pace(() => 0.3, 600, () => false); check(moves.length === 0, 'frames that do not count never trim'); }
  // and through createQuality: the pixel ratio follows, a rung is not climbed while trimmed, a level picked by hand is whole again
  {
    const mem = new Map();
    globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
    const caps = { dpr: 1, shadow: 2048, trees: 150, load: 1000 };
    let ratio = 1; const told = [];
    const q = createQuality({ renderer: { getPixelRatio: () => ratio, setPixelRatio(x) { ratio = x; }, shadowMap: {} }, sun: { shadow: { mapSize: { x: 0, set() {} }, map: null } }, quality: {}, setTrees() {}, trimmed: (k) => told.push(k) }, caps, {});
    for (let i = 0; i < 60 * 60; i++) q.frame(16.67, 4, 9.6, { held: q.trim === 1 && i % 12 === 0 ? 1 : 0, count: true });
    check(q.trim < 1 && Math.abs(ratio - q.levels[q.level].dpr * q.trim) < 1e-9 && ratio === q.sharpness && told[0] === 1, `the picture's pixel ratio follows the trim (${ratio.toFixed(2)}, told ${told.join(', ')})`);
    q.setMode('high');
    check(q.trim === 1 && ratio === q.levels[q.level].dpr, `a level picked by hand has its whole sharpness (${ratio})`);
    const off = createQuality({ renderer: { getPixelRatio: () => 1, setPixelRatio() {}, shadowMap: {} }, sun: { shadow: { mapSize: { x: 0, set() {} }, map: null } }, quality: {}, setTrees() {} }, caps, { even: false });
    off.setMode('auto');
    for (let i = 0; i < 60 * 60; i++) off.frame(16.67, 4, 9.6, { held: i % 12 === 0 ? 1 : 0, count: true });
    check(off.trim === 1, '?even=0 leaves the sharpness alone');
    delete globalThis.localStorage;
  }
  // the governor does not climb while the sharpness is trimmed
  {
    const g = createGovernor({ levels: N, start: N - 3 });
    let ups = 0;
    for (let t = 0; t < 120000; t += 16.67) { const ch = g.feed(16.67, 5, true); if (ch && ch.to > ch.from) ups++; }
    const g2 = createGovernor({ levels: N, start: N - 3 });
    let ups2 = 0;
    for (let t = 0; t < 120000; t += 16.67) { const ch = g2.feed(16.67, 5, false); if (ch && ch.to > ch.from) ups2++; }
    check(ups === 0 && ups2 > 0, `no rung is climbed while the sharpness is trimmed (${ups} against ${ups2})`);
  }
}

process.exit(failed ? 1 : 0);
