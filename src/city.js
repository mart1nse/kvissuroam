// Which city's world this page plays in (Martin, 28 Nov 2026: Tallinn, "build the new room (tln=1) with all of its
// logic"). Behind ?tln=1 for now: the start screen then offers the two cities, and picking Tallinn loads the page
// again as Tallinn (its own map in public/data/tln/, its own server room with its own lap times and races, and its
// own circuit: Pirita-Kose-Kloostrimetsa). Without the flag every page is Tartu, as before.
//
// The city a page is in comes from ?city=tallinn, or else from the last city picked in this browser (only with the
// flag). Everything that differs between the cities asks here: the map files (DATA), the server room (api, wsCity),
// and whether Tartu's hand-built places, the Majoraadi stage and the drag strip are made at all (TARTU).
const q = new URLSearchParams(location.search);
const KEY = 'kvissuroam.city';
const stored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

export const TLN_FLAG = q.get('tln') === '1';
export const CITY = TLN_FLAG && (q.get('city') || stored()) === 'tallinn' ? 'tallinn' : 'tartu';
export const TARTU = CITY === 'tartu';
export const TALLINN = CITY === 'tallinn';
export const CITY_NAME = TALLINN ? 'TALLINN' : 'TARTU';

// the folder of this city's baked map (tools/bake: CITY=tallinn writes public/data/tln/)
export const DATA = `${import.meta.env.BASE_URL}data/${TALLINN ? 'tln/' : ''}`;

// an address of the game's server, in this city's room (worker/index.js: ?city=tallinn goes to the Tallinn lobby)
export function api(path) {
  return TALLINN ? `${path}${path.includes('?') ? '&' : '?'}city=tallinn` : path;
}

// remembered for the next visit with ?tln=1; the page then loads again as that city (its world is another map)
export function goCity(city) {
  try { localStorage.setItem(KEY, city); } catch { /* private mode: the address carries it */ }
  const u = new URL(location.href);
  u.searchParams.set('tln', '1');
  u.searchParams.set('city', city);           // (the city picked: the start screen opens on its tracks, src/race/trackpick.js)
  u.searchParams.delete('track');
  location.href = u.toString();
}
