// How often the adverts in the world are seen and tapped, for /ads and /winbaum (Martin 27 Nov 2026: "how many times
// the logo is seen, on average per hour and day, also peaks", for the advertisers).
//
// Three adverts, each by a short id the server keeps (worker/stats.js):
//   wb  the WINBAUM.EE roof sign on the Winbaum cabin by LAP START (src/world/winbaum.js), only while it is shown
//   an  the Anderson's hologram over the taproom on Küüni (src/world/kuuni.js, hologram.js)
//   tp  the TOREPOOD banner on Tasku over the Narva mnt junction (src/world/keskus.js, a posterPlane)
// An advert is seen while the camera is within its reach (100 m: each is a few metres across and big on screen from there) and its middle is inside the picture (for the one-sided Tasku banner, from its front). One view: on screen
// for half a second in all (a shorter glimpse is none); a new view needs it off the screen for 5 s first, so a car standing
// by it is one view, and each lap driven past is one more. The seconds on screen are counted too, and a visit's first
// view of each ('u'). What is in the way (a house, a bus) is not looked at.
// Taps ('c'): every advert opens its site with window.open, so a tap is counted there, by the site it opens (the
// TOREPOOD posters in the bus shelters and on Kaubamaja open the same shop: their taps count with Tasku's).
//
// Cost: a distance or two a frame; within reach one point put through the camera. Into the stats bundle (src/stats.js
// ad()), which the server keeps per day and per Tartu hour.
import * as THREE from 'three';
import { stats } from './stats.js';

const FOR = 0.5, GAP = 5;   // (1 s and 55-80 m until 27 Nov: a car on a flying lap at 150 km/h and more had the Winbaum
                            // sign on screen under a second, from 60 m until it slid out at the side, and was never counted)
const SITES = [['wb', /(^|\.)winbaum\.ee$/], ['an', /(^|\.)andersonbeer\.com$/], ['tp', /(^|\.)yaga\.ee$/]];

// is it in the scene and shown (its parents too)?
const shown = (o) => { for (; o; o = o.parent) { if (!o.visible) return false; if (o.isScene) return true; } return false; };

export function createAdViews({ winbaum, holo, posters }) {
  const p = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Vector3();
  // each: where its middle is now (into p; false while it is not there), the reach in metres, a front (into n) or none
  const ads = [
    { id: 'wb', reach: 100, at: () => { const g = winbaum?.group; if (!g || !shown(g)) return false; p.set(0, 4.35, 0.25); g.localToWorld(p); return true; } },
    // (the hologram turns to the camera; its board is 13 x 16.25 m, from 1.6 m over the ground)
    { id: 'an', reach: 100, at: () => { const g = holo?.group; if (!g || !shown(g)) return false; p.copy(g.position); p.y += 9.7; return true; } },
    { id: 'tp', reach: 100, front: true, at: () => {
      const m = posters?.find((x) => x.mesh?.userData.tasku)?.mesh;
      if (!m || !shown(m)) return false;
      m.getWorldPosition(p); n.set(0, 0, 1).transformDirection(m.matrixWorld); return true;
    } },
  ].map((a) => ({ ...a, onT: 0, offT: GAP, counted: false, seenOnce: false, secs: 0 }));

  // taps: whatever opens an advert's site (left as it was for anything else)
  const open = window.open.bind(window);
  window.open = (url, ...rest) => {
    try { const h = new URL(url, location.href).hostname; const s = SITES.find(([, re]) => re.test(h)); if (s) stats.ad(`${s[0]}:c`); } catch { /* never in the way */ }
    return open(url, ...rest);
  };

  return {
    // each frame while driving (dt in seconds)
    update(camera, dt, driving) {
      const ok = driving && dt > 0 && dt <= 0.5;
      for (const a of ads) {
        let on = false;
        if (ok && a.at()) {
          const d = Math.hypot(camera.position.x - p.x, camera.position.z - p.z);
          if (d < a.reach && (!a.front || q.copy(camera.position).sub(p).dot(n) > 0)) {
            q.copy(p).project(camera);
            on = q.z > -1 && q.z < 1 && Math.abs(q.x) < 1 && Math.abs(q.y) < 1;
          }
        }
        if (on) {
          if (a.offT >= GAP) { a.onT = 0; a.counted = false; }
          a.offT = 0;
          a.onT += dt;
          a.secs += dt;
          if (!a.counted && a.onT >= FOR) {
            a.counted = true;
            stats.ad(`${a.id}:v`);
            if (!a.seenOnce) { a.seenOnce = true; stats.ad(`${a.id}:u`); }
          }
          if (a.secs >= 1) { stats.ad(`${a.id}:s`, a.secs); a.secs = 0; }
        } else {
          a.offT += dt > 0 ? Math.min(dt, 1) : 0;
          if (a.secs > 0) { stats.ad(`${a.id}:s`, a.secs); a.secs = 0; }
        }
      }
    },
  };
}
