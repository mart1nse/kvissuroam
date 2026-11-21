// ?off=100: stealth mode, for Martin's own testing (2026-11-21). The other players get no trace of
// this browser: it is not in their online list or count, no join or leave note, no car, position,
// sound, smoke or tyre marks (no position is ever sent), and laps driven in it stay in this browser
// (YOUR LAST LAPS) and never reach the lap board. It still sees everyone else as usual, and their
// cars pass through it (they cannot see it to bump back). The anonymous game stats are not sent
// either, so test drives do not show up on /stats. The server keeps such a socket out of the player
// list too (`ghost` in worker/index.js).
export const STEALTH = (() => {
  try { return new URLSearchParams(location.search).get('off') === '100'; } catch { return false; }
})();
