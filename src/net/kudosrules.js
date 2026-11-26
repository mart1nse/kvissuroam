// How many thumbs up one player may give another (src/kudos.js), shared by the page and the server
// (worker/index.js), so that the button goes faint where the server would refuse.
//
// Martin 2026-11-26: one player ("bus") filled another's bus window with about 30 thumbs up, one every 30 s.
// A thumbs up is for a moment worth it, so one player to the same player: at most KUDOS_PAIR a day (their
// collection holds the day's, see src/net/multiplayer.js), still no closer than KUDOS_GAP_S apart.

export const KUDOS_GAP_S = 30;         // one sender to one receiver: once in this long
export const KUDOS_PAIR = 3;           // one sender to one receiver: at most this many in their day's collection
export const KUDOS_KEEP = 24;          // received ones remembered with who gave them (the newest)

// is this received one [id, name, ms] from that sender? By id, or by name when there is one (a sender who
// comes back in a private window has a new id; a name typed again is still theirs)
const isFrom = (k, id, name) => k[0] === id || (!!name && k[1] === name);

// how many of a received list [[id, name, ms], ...] came from this sender
export function kudosFrom(kf, id, name) {
  let n = 0;
  if (Array.isArray(kf)) for (const k of kf) if (Array.isArray(k) && isFrom(k, id, name)) n++;
  return n;
}

// a received count and list with at most KUDOS_PAIR from any one sender (their newest kept), for one saved
// before this rule or by an old page: { kn, kf }
export function kudosFair(kn, kf) {
  if (!Array.isArray(kf) || !kf.length) return { kn, kf: kf || [] };
  const keep = [];
  for (let i = kf.length - 1; i >= 0; i--) if (kudosFrom(keep, kf[i][0], kf[i][1]) < KUDOS_PAIR) keep.push(kf[i]);
  keep.reverse();
  const dropped = kf.length - keep.length;
  return dropped ? { kn: Math.max(keep.length, kn - dropped), kf: keep } : { kn, kf };
}
