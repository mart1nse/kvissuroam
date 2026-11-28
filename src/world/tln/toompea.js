// Toompea's landmarks by hand (Martin's landmark list, 28 Nov 2026), from Mapillary photos (Lossi plats 2020, 2022 and
// 2026), OpenStreetMap's outline and the domes' places and heights in the LOD2 model:
//   - Aleksander Nevski katedraal: the LOD2 block (a pink lump) gives way to the cathedral built here in its own frame
//     (the outline's walls run 19.5 degrees off east): the cross-in-square body on its red granite plinth, the higher
//     centre with kokoshnik gables, the north and south porches, the west porch and belfry, the polygonal east apse;
//     terracotta walls under a lot of white (pilasters, cornices, arched window surrounds), dark roofs; the central drum
//     with its eight windows under the big black onion, four smaller drums and onions at the corners, a small one on
//     the belfry, gold Orthodox crosses on all of them.
// Built in steps through the work queue when the car comes within 500 m.
import * as THREE from 'three';
import { Parts } from '../../race/landmarks.js';
import { jobs } from '../../jobs.js';
import { still } from '../../still.js';
import { addHouseColours } from '../streetkit.js';

// the cathedral's frame: C the centre dome, u east along the nave (19.5 degrees north of east), v to the south
const NEV = { x: -6044.5, z: 3113.0, yaw: 0.3405, key: '-9_6', base: 4340, x0: -6560, z0: 3040 };
const COL = { wall: 0xe0a58c, trim: 0xf6f1ea, plinth: 0x8c5f5a, roof: 0x4a4858, dome: 0x27252f, gold: 0xf2cd6e, glass: 0x3a3850, door: 0x5b3a36 };

export function toompeaWalls(walls) {
  addHouseColours(walls, NEV.key, NEV.x0, NEV.z0, [{ base: NEV.base, x: NEV.x, z: NEV.z, wall: COL.wall, roof: COL.roof, reach: 40, hide: true }]);
}

export function createToompea(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  const Y = NEV.yaw, cu = Math.cos(Y), su = Math.sin(Y);
  // (u, v) -> world x, z: u along (cos Y, -sin Y), v along (sin Y, cos Y)
  const at = (u, v) => [NEV.x + u * cu + v * su, NEV.z - u * su + v * cu];

  function* build() {
    const p = new Parts(), glow = new Parts();
    const h = (x, z) => world.heightAt(x, z);
    const Y0 = h(...at(0, 0)), low = Math.min(...[[-28, -4], [-28, 4], [26, 0], [0, -19], [0, 19], [-24, -12], [21, 13]].map(([u, v]) => h(...at(u, v))));
    // a box from u0..u1, v0..v1, y0..y1 (above the floor at the centre)
    const B = (u0, u1, v0, v1, y0, y1, hex, parts = p) => { const [x, z] = at((u0 + u1) / 2, (v0 + v1) / 2); parts.box(u1 - u0, y1 - y0, v1 - v0, hex, x, Y0 + (y0 + y1) / 2, z, Y); };
    // a flat shape on a face: n = the face's way out: 0 +v, 1 +u, 2 -v, 3 -u
    const yawOf = [Y, Y + Math.PI / 2, Y + Math.PI, Y - Math.PI / 2];
    const S = (geo, hex, u, v, y, n, parts = p) => { const [x, z] = at(u, v); parts.add(geo, hex, x, Y0 + y, z, yawOf[n]); };
    const arch = (w, hh) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(-w / 2, hh - w / 2); s.absarc(0, hh - w / 2, w / 2, Math.PI, 0, true); s.lineTo(w / 2, 0); return new THREE.ShapeGeometry(s, 6); };
    const half = (r) => { const s = new THREE.Shape(); s.moveTo(-r, 0); s.absarc(0, 0, r, Math.PI, 0, true); s.lineTo(-r, 0); return new THREE.ShapeGeometry(s, 8); };
    const WIN = arch(1.5, 4.6), WINF = arch(2.2, 5.1), SMALL = arch(0.9, 2.2), SMALLF = arch(1.4, 2.55), DOOR = arch(3.0, 6.0), DOORF = arch(4.2, 6.8);

    // ---- the masses: body, higher centre, porches, west porch, apse (with the plinth under all)
    const masses = [
      [-24, 21, -12.7, 13.6, 14], [-12.5, 12.5, -12.7, 13.6, 19], [-4.2, 4.5, -19, -12.7, 11.5], [-4.2, 4.5, 13.6, 19.4, 11.5], [-28.3, -24, -3.7, 4.7, 10],
    ];
    for (const [u0, u1, v0, v1, top] of masses) {
      B(u0, u1, v0, v1, low - Y0 - 0.5, 2.2, COL.plinth);
      B(u0, u1, v0, v1, 2.2, top, COL.wall);
      B(u0 - 0.35, u1 + 0.35, v0 - 0.35, v1 + 0.35, top - 0.6, top, COL.trim);                    // cornice
      B(u0 - 0.1, u1 + 0.1, v0 - 0.1, v1 + 0.1, 4.9, 5.3, COL.trim);                               // a band over the plinth storey
      B(u0 + 0.2, u1 - 0.2, v0 + 0.2, v1 - 0.2, top, top + 0.5, COL.roof);
      for (const [u, v] of [[u0, v0], [u0, v1], [u1, v0], [u1, v1]]) B(u - 0.45, u + 0.45, v - 0.45, v + 0.45, 2.2, top - 0.6, COL.trim);   // corner pilasters
    }
    // the apse: half an octagon east of the body
    const AR = 5.9, AH = 11.5;
    { const [x, z] = at(20.6, 0.5), t0 = Y + Math.PI / 8, tl = Math.PI - Math.PI / 4;
      p.add(new THREE.CylinderGeometry(AR, AR, AH - 2.2, 8, 1, false, t0, tl), COL.wall, x, Y0 + 2.2 + (AH - 2.2) / 2, z);
      p.add(new THREE.CylinderGeometry(AR + 0.2, AR + 0.2, 2.2 - (low - Y0 - 0.5), 8, 1, false, t0, tl), COL.plinth, x, Y0 + (2.2 + low - Y0 - 0.5) / 2, z);
      p.add(new THREE.CylinderGeometry(AR + 0.3, AR + 0.3, 0.6, 8, 1, false, t0, tl), COL.trim, x, Y0 + AH - 0.3, z);
      p.add(new THREE.CylinderGeometry(1.5, AR + 0.2, 2.0, 8, 1, false, t0, tl), COL.roof, x, Y0 + AH + 1.0, z); }
    yield;

    // ---- windows, white surrounds and pilasters along every long face
    const row = (fixed, from, to, n, y0, skip = () => false, big = true) => {      // fixed: [axis 'u'|'v', value, way out]
      const [ax, val, out] = fixed, step = (to - from) / n;
      for (let k = 0; k < n; k++) {
        const t = from + step * (k + 0.5);
        if (skip(t)) continue;
        const [u, v] = ax === 'v' ? [t, val] : [val, t], d = 0.06, du = ax === 'u' ? (out === 1 ? d : -d) : 0, dv = ax === 'v' ? (out === 0 ? d : -d) : 0;
        S(big ? WINF : SMALLF, COL.trim, u + du, v + dv, y0 - 0.25, out); S(big ? WIN : SMALL, COL.glass, u + du * 2, v + dv * 2, y0, out);
        if (k > 0) { const tp = t - step / 2; const [pu, pv] = ax === 'v' ? [tp, val] : [val, tp]; B(pu - 0.3, pu + 0.3, pv - 0.3, pv + 0.3, 5.3, 13.4, COL.trim); }
      }
    };
    const porchGap = (t) => t > -5 && t < 5.3;
    row(['v', -12.7, 2], -24, 21, 13, 6.0, porchGap); row(['v', 13.6, 0], -24, 21, 13, 6.0, porchGap);
    row(['u', -24, 3], -12.7, 13.6, 7, 6.0, (t) => t > -4.5 && t < 5.5); row(['u', 21, 1], -12.7, 13.6, 7, 6.0, (t) => t > -7.5 && t < 8.5);
    // the higher centre: small windows in threes and kokoshnik gables on its four faces
    row(['v', -12.7, 2], -12.5, 12.5, 7, 15.2, () => false, false); row(['v', 13.6, 0], -12.5, 12.5, 7, 15.2, () => false, false);
    const K = half(3.6), KI = half(2.9);
    for (const u of [-8, 0, 8]) { S(K, COL.trim, u, -12.75, 19, 2); S(KI, COL.wall, u, -12.8, 19, 2); S(K, COL.trim, u, 13.65, 19, 0); S(KI, COL.wall, u, 13.7, 19, 0); }
    for (const v of [-7, 0.5, 8]) { S(K, COL.trim, 12.55, v, 19, 1); S(KI, COL.wall, 12.6, v, 19, 1); S(K, COL.trim, -12.55, v, 19, 3); S(KI, COL.wall, -12.6, v, 19, 3); }
    // the porches: a big arched door, a gable over it
    S(DOORF, COL.trim, 0.15, -19.06, 2.2, 2); S(DOOR, COL.door, 0.15, -19.12, 2.2, 2);
    S(DOORF, COL.trim, 0.15, 19.46, 2.2, 0); S(DOOR, COL.door, 0.15, 19.52, 2.2, 0);
    S(DOORF, COL.trim, -28.36, 0.5, 2.2, 3); S(DOOR, COL.door, -28.42, 0.5, 2.2, 3);
    const G = half(4.35), GI = half(3.6);
    S(G, COL.trim, 0.15, -19.05, 11.5, 2); S(GI, COL.wall, 0.15, -19.1, 11.5, 2); S(G, COL.trim, 0.15, 19.45, 11.5, 0); S(GI, COL.wall, 0.15, 19.5, 11.5, 0);
    // the apse's windows
    for (const a of [-Math.PI / 4, 0, Math.PI / 4]) { const ap = AR * Math.cos(Math.PI / 8); const [x, z] = at(20.6 + Math.cos(a) * (ap + 0.05), 0.5 + Math.sin(a) * (ap + 0.05)); p.add(WINF, COL.trim, x, Y0 + 5.75, z, Y + Math.PI / 2 - a); const [x2, z2] = at(20.6 + Math.cos(a) * (ap + 0.11), 0.5 + Math.sin(a) * (ap + 0.11)); p.add(WIN, COL.glass, x2, Y0 + 6.0, z2, Y + Math.PI / 2 - a); }
    yield;

    // ---- drums, onions and crosses
    const cross = (x, y, z, s) => {
      glow.box(0.16 * s, 4.4 * s, 0.16 * s, COL.gold, x, y + 2.2 * s, z, Y);
      glow.box(2.0 * s, 0.16 * s, 0.16 * s, COL.gold, x, y + 3.3 * s, z, Y);
      glow.box(1.1 * s, 0.14 * s, 0.14 * s, COL.gold, x, y + 3.9 * s, z, Y);
      glow.add(new THREE.BoxGeometry(1.3 * s, 0.14 * s, 0.14 * s).rotateZ(-0.38), COL.gold, x, y + 1.8 * s, z, Y);
    };
    const ONION = [[5.3, 0], [6.2, 1.6], [6.5, 3.0], [5.9, 4.6], [4.2, 6.4], [2.2, 8.2], [0.7, 9.8], [0.35, 10.6], [0.35, 11.2]];
    const dome = (u, v, r, y0, y1, k) => {             // a drum of radius r from y0 to y1 with k windows, then its onion
      const [x, z] = at(u, v), s = r / 5.2;
      p.add(new THREE.CylinderGeometry(r, r, y1 - y0, 16), COL.trim, x, Y0 + (y0 + y1) / 2, z);
      p.add(new THREE.CylinderGeometry(r + 0.35 * s + 0.1, r + 0.35 * s + 0.1, 0.6 * s + 0.2, 16), COL.trim, x, Y0 + y1 - 0.2, z);
      const wg = arch(1.3 * s + 0.2, 4.2 * s + 0.3);
      for (let j = 0; j < k; j++) { const a = (j / k) * Math.PI * 2; p.add(wg, COL.glass, x + Math.sin(a) * (r + 0.04), Y0 + y0 + (y1 - y0) * 0.28, z + Math.cos(a) * (r + 0.04), a); }
      p.add(new THREE.LatheGeometry(ONION.map(([rr, yy]) => new THREE.Vector2(rr * s, yy * s)), 16), COL.dome, x, Y0 + y1 + 0.1, z);
      cross(x, Y0 + y1 + 0.1 + 11.2 * s, z, Math.max(0.55, s));
    };
    dome(0, 0.4, 5.2, 19, 31, 8);
    for (const [u, v] of [[9, 8.6], [9.5, -9.4], [-8.3, -9.1], [-8.5, 7.9]]) dome(u, v, 2.3, 19, 26.5, 4);
    // the belfry over the west end: a square of open arches, a little onion
    B(-20.3, -13.7, -3.3, 3.7, 14, 22.5, COL.wall);
    B(-20.6, -13.4, -3.6, 4.0, 22.0, 22.6, COL.trim);
    for (const [n, u, v] of [[2, -17, -3.36], [0, -17, 3.76], [3, -20.36, 0.2], [1, -13.64, 0.2]]) { S(WINF, COL.trim, u, v, 16.2, n); S(WIN, COL.glass, u + (n === 1 ? 0.05 : n === 3 ? -0.05 : 0), v + (n === 0 ? 0.05 : n === 2 ? -0.05 : 0), 16.45, n); }
    dome(-17, 0.2, 1.9, 22.6, 24.4, 4);
    yield 'frame';

    const m = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    if (m) { m.castShadow = shadows; m.receiveShadow = true; m.matrixAutoUpdate = false; group.add(m); }
    const gm = glow.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    if (gm) { gm.matrixAutoUpdate = false; group.add(gm); }
    for (const g of [WIN, WINF, SMALL, SMALLF, DOOR, DOORF, K, KI, G, GI]) g.dispose();
  }

  let built = false;
  return {
    info: () => ({ built }),
    update(car) {
      if (built || !car || Math.hypot(car.x - NEV.x, car.z - NEV.z) > 500 || !world.ready(NEV.x, NEV.z) || !world.ready(...at(-28, 0)) || !world.ready(...at(26, 0))) return;
      built = true;
      jobs.add(build, 'toompea');
    },
  };
}
