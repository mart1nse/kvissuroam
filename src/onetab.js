// One game tab online at a time (Martin 26 Nov 2026: "you are online in another tab, continue here?"). The game open
// in two tabs or windows of one browser was two drivers online: twice in everyone's list and at the cap of 100, two
// race votes, and two copies drawing on one graphics card.
//
// The tab that plays holds a lock that every tab of this site in this browser shares (Web Locks, LOCK). A tab that
// opens while another holds it does not load or go online: it asks first (main.js standAside). CONTINUE HERE takes the
// lock over (steal), and the tab that had it hears so, since its own hold on the lock fails, and stands aside: to the
// garage, offline, drawing nothing, with the same question on its screen. A tab standing aside that is in view and
// in front takes the lock by itself once nobody holds it (the other tab was closed).
//
// Not with `on` false (?off=100, Martin's hidden test tab beside a driving one; ?onetab=0), nor in a browser without
// Web Locks (an http address on the local network, a browser from before 2022): there every tab plays, as before.
const LOCK = 'linnaring-online';

export function createOneTab({ on = true, onLost } = {}) {
  let locks = on ? globalThis.navigator?.locks : null;
  let mine = !locks;
  let held = 0, asks = 0;          // which of our requests holds the lock now (0: none)
  let letGo = null;                // ends that hold
  // (a lock that cannot be had at all, a page in a sandboxed frame say, is no other tab: the rule is off, the game plays)
  const broken = () => { locks = null; held = 0; mine = true; letGo = null; };

  // a request for the lock: true once this tab has it, false when another tab has it (ifAvailable)
  function ask(opts) {
    if (!locks) return Promise.resolve(true);
    const id = ++asks;
    return new Promise((resolve) => {
      let got = false;
      try {
        locks.request(LOCK, opts, (lock) => {
          if (!lock) { resolve(false); return undefined; }
          got = true; held = id; mine = true;
          resolve(true);
          return new Promise((r) => { letGo = r; });
        }).catch(() => {
          if (!got) { broken(); resolve(true); return; }
          // taken over by another tab (CONTINUE HERE there): only the hold we have now counts
          if (held !== id) return;
          held = 0; mine = false; letGo = null;
          onLost?.();
        });
      } catch { broken(); resolve(true); }
    });
  }

  // (a page kept by the browser for its back button lets go meanwhile, and on its way back stands aside if
  // another tab has taken the game up)
  addEventListener('pagehide', (e) => { if (e.persisted && mine && locks) { held = 0; mine = false; letGo?.(); letGo = null; } });
  addEventListener('pageshow', (e) => { if (e.persisted && locks && !mine) ask({ ifAvailable: true }).then((ok) => { if (!ok) onLost?.(); }); });

  return {
    // does this tab play (hold the lock)?
    get mine() { return mine; },
    // is the rule on in this tab at all?
    get on() { return !!locks; },
    // at the start: true when no other tab plays
    first: ask({ ifAvailable: true }),
    // CONTINUE HERE: taken from whichever tab has it
    take: () => (mine ? Promise.resolve(true) : ask({ steal: true })),
    // only if nobody has it
    free: () => (mine ? Promise.resolve(true) : ask({ ifAvailable: true })),
  };
}
