// How often the adverts in the world are seen, for /ads (Martin 27 Nov 2026: "how many times the logo is seen, on
// average per hour and day, also peaks", for the advertiser).
//
// Only the WINBAUM.EE roof sign by LAP START for now (src/world/winbaum.js), and only while that cabin is shown.
// The sign is seen while the camera is within 60 m of it and its middle is inside the picture. One view: the sign
// on screen for a second in all (a short glimpse is none); a new view needs it off the screen for 5 s first, so a
// car standing beside it, or turning its camera, is one view, and each lap driven past it is one more. The seconds on
// screen are counted too, and a visit's first view once ('u'). What is in the way (a house, a bus) is not looked at:
// round the sign is the open square by Kaubamaja.
//
// Cost: one distance a frame; within 60 m one point put through the camera. Into the stats bundle (src/stats.js
// ad()), which the server keeps per day and per Tartu hour (worker/stats.js).
import * as THREE from 'three';
import { WINBAUM } from './world/winbaum.js';
import { stats } from './stats.js';

// the sign's middle, worked out as winbaum.js places it (its frame, PLACE, S, SY, SZ): kept in step by hand
const O = [1659.6, 3088.7], UA = [0.6943, 0.7197], UB = [0.7189, -0.6951];
const at = (a, b) => [O[0] + UA[0] * a + UB[0] * b, O[1] + UA[1] * a + UB[1] * b];
const S = 1.4, SY = 3.3 + 0.32 + 1.46 / 2, SZ = 0.25;
const SIGN = (() => {
  const [x, z] = at(-26, 4), yaw = Math.atan2(-UB[0], -UB[1]);
  return { x: x + S * Math.sin(yaw) * SZ, z: z + S * Math.cos(yaw) * SZ, up: S * SY };
})();

const REACH = 60, FOR = 1, GAP = 5;

export function createAdViews(world) {
  if (!WINBAUM) return { update() {} };
  const p = new THREE.Vector3();
  let gy = null, onT = 0, offT = GAP, counted = false, seenOnce = false, secs = 0;
  return {
    // each frame while driving (dt in seconds)
    update(camera, dt, driving) {
      if (!driving || !(dt > 0) || dt > 0.5) { offT += dt > 0 ? Math.min(dt, 1) : 0; return; }
      const d = Math.hypot(camera.position.x - SIGN.x, camera.position.z - SIGN.z);
      let on = false;
      if (d < REACH) {
        if (gy === null) gy = world.heightAt(SIGN.x, SIGN.z) || 0;
        p.set(SIGN.x, gy + SIGN.up, SIGN.z).project(camera);
        on = p.z > -1 && p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1;
      }
      if (on) {
        if (offT >= GAP) { onT = 0; counted = false; }
        offT = 0;
        onT += dt;
        secs += dt;
        if (!counted && onT >= FOR) {
          counted = true;
          stats.ad('wb:v');
          if (!seenOnce) { seenOnce = true; stats.ad('wb:u'); }
        }
        if (secs >= 1) { stats.ad('wb:s', secs); secs = 0; }
      } else {
        offT += dt;
        if (secs > 0) { stats.ad('wb:s', secs); secs = 0; }
      }
    },
  };
}
