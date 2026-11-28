// Toompea castle by hand (Martin's landmark list, 28 Nov 2026), from Mapillary photos of Lossi plats (2018, 2020 and
// September 2026) and Toompuiestee (2018, 2022), the Maa-amet air photo (to measure, not pasted) and the LOD2 model:
//   - the baroque governor's palace (now the Riigikogu) along the square: the LOD2 block keeps its mass, now limestone
//     (the medieval walls, Landskrone, Stür den Kerl) under orange tiles, and its 82 m front gets the pink facade in
//     front of it. Twenty window bays in three storeys: the end risalits of three bays under white pediments, five bays
//     either side with white pilaster strips between them, the centre risalit of four with the arcade of three arches
//     carrying the balcony and its balustrade, tall arched windows over it, the attic with balustrades and urns and the
//     curved gable with the gold coat of arms and a small flag. Ground floor windows with a low arch, plinth, bands,
//     cornice, downpipes.
//   - Pikk Hermann at the south-west corner: the round limestone tower (its LOD2 shaft cut away and drawn again)
//     on its battered foot, a few small openings, the corbel ring and the parapet round the top platform with its
//     little drum, the white flagpole and the blue, black and white flag.
//   - the square in front: the black cast iron posts with chains (props kinds 55 and 56 of props.js, knocked aside
//     when hit) along the lines the air photo shows, and the compass rose set in the paving.
// Built in steps through the work queue when the car comes within 450 m.
import * as THREE from 'three';
import { Parts } from '../../race/landmarks.js';
import { jobs } from '../../jobs.js';
import { still } from '../../still.js';
import { addHouseColours } from '../streetkit.js';

// the front's frame: s from the north end along the wall (82.2 m to the south end), v out over the square
const N0 = [-6119.4, 3088.3], D = [0.1363, 0.9907], O = [0.9907, -0.1363], LEN = 82.2;
const YAW = Math.atan2(O[0], O[1]);
const at = (s, v) => [N0[0] + s * D[0] + v * O[0], N0[1] + s * D[1] + v * O[1]];
const PH = { x: -6180.75, z: 3179.75 };                  // Pikk Hermann's middle
const ROSE = { x: -6096.2, z: 3126.0, yaw: -0.1 };
const KEY = '-9_6', BASE = 3307, X0 = -6560, Z0 = 3040;
const COL = {
  pink: 0xeeb3aa, white: 0xf4efe6, plinth: 0xb8b1a6, glass: 0x3b414c, frame: 0x9aa98f, dark: 0x2a2830, door: 0x6e4b2f,
  pipe: 0x55525a, gold: 0xf0c75e, blue: 0x2f62b8, stone: 0xdcd6ca, stone2: 0xc9c2b4, roof: 0xd2ccc0, flagB: 0x0a72cc, flagK: 0x121216, flagW: 0xf6f6f8,
};

export function castleWalls(walls) {
  // the castle's LOD2 block: no generated windows (the front is drawn here); its Pikk Hermann is drawn here too. The
  // colour survey has points on it already (whichever is nearest takes a triangle): all of them get the same
  const look = { roof: 0xc96a44, reach: 120, plain: true, cut: (x, z) => Math.hypot(x - PH.x, z - PH.z) < 5.4 };
  const a = walls && walls.sectors && walls.sectors[KEY];
  const extra = a && ((walls.extra ||= {})[KEY] ||= {});
  let seen = false;
  if (a) for (let i = 0; i < a.length; i += 4) if (a[i] === BASE) { a[i + 3] = (a[i + 3] & 0x1000000) | 0xd8d0c0; extra[i / 4] = { ...extra[i / 4], ...look }; seen = true; }
  if (!seen) addHouseColours(walls, KEY, X0, Z0, [{ base: BASE, x: -6150, z: 3112, wall: 0xd8d0c0, ...look }]);
}

// the black posts and chains on the square: lines measured on the air photo, a post every 1.8 m
let propsMade = null;
export function castleProps() {
  if (propsMade) return propsMade;
  const LINES = [
    [[-6086.3, 3102.0], [-6084.3, 3116.0]],
    [[-6093.0, 3117.3], [-6085.9, 3116.2]],
    [[-6093.0, 3123.0], [-6088.5, 3122.2]],
    [[-6089.8, 3126.5], [-6087.0, 3133.2], [-6080.5, 3131.8], [-6076.5, 3153.0]],
  ];
  const out = [];
  for (const L of LINES) {
    const seglen = L.slice(1).map((q, i) => Math.hypot(q[0] - L[i][0], q[1] - L[i][1])), total = seglen.reduce((x, y) => x + y, 0);
    const pts = [];
    for (let t = 0; t <= total + 0.3; t += 1.8) {
      let i = 0, r = Math.min(t, total);
      while (i < seglen.length - 1 && r > seglen[i]) r -= seglen[i++];
      const f = r / seglen[i];
      pts.push([L[i][0] + (L[i + 1][0] - L[i][0]) * f, L[i][1] + (L[i + 1][1] - L[i][1]) * f]);
    }
    pts.forEach((p, k) => {
      const q = pts[k + 1];
      if (!q) { out.push([55, p[0], p[1], 0, 0]); return; }
      const ux = q[0] - p[0], uz = q[1] - p[1];          // the chain hangs along the post's +x: (-cos b, -sin b)
      out.push([56, p[0], p[1], (Math.atan2(-uz, -ux) * 180) / Math.PI, 0]);
    });
  }
  return (propsMade = out);
}

export function createCastle(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  // the arcade under the balcony is solid
  world.addSolids([{ x: at(41.1, 2.45)[0], z: at(41.1, 2.45)[1], yaw: YAW, hx: 6.5, hz: 1.5 }]);

  function* build() {
    const p = new Parts(), glow = new Parts();
    const h = (x, z) => world.heightAt(x, z);
    const GR = Math.min(h(...at(0, 1)), h(...at(LEN, 1))) - 0.4;
    const PL = 44.9, EAVES = 57.95;
    const B = (s0, s1, v0, v1, y0, y1, hex, parts = p) => { const [x, z] = at((s0 + s1) / 2, (v0 + v1) / 2); parts.box(s1 - s0, y1 - y0, v1 - v0, hex, x, (y0 + y1) / 2, z, YAW); };
    // a flat shape on the front (n 0), or on a side looking north (n -1, s falling) or south (n 1)
    const F = (geo, hex, s, v, y, n = 0) => { const [x, z] = at(s, v); p.add(geo, hex, x, y, z, YAW - n * Math.PI / 2); };
    const arch = (w, hh) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(-w / 2, hh - w / 2); s.absarc(0, hh - w / 2, w / 2, Math.PI, 0, true); s.lineTo(w / 2, 0); return new THREE.ShapeGeometry(s, 6); };
    const seg = (w, hh, rise) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(-w / 2, hh - rise); s.quadraticCurveTo(0, hh + rise, w / 2, hh - rise); s.lineTo(w / 2, 0); return new THREE.ShapeGeometry(s, 5); };
    const geos = [];
    const keep = (g) => (geos.push(g), g);

    // ---- the front: [s0, s1, front v, window bays]
    const SECT = [
      [0, 11, 0.55, [2.4, 5.5, 8.6]],
      [11, 33.1, 0.15, [13.3, 17.7, 22.05, 26.4, 30.8]],
      [33.1, 49.1, 0.95, [36.3, 39.5, 42.7, 45.9]],
      [49.1, 71.2, 0.15, [51.4, 55.8, 60.15, 64.5, 68.9]],
      [71.2, LEN, 0.55, [73.6, 76.7, 79.8]],
    ];
    const W1 = keep(seg(1.3, 2.7, 0.18)), W1F = keep(seg(1.62, 2.86, 0.2));
    const W2C = keep(arch(1.5, 4.0)), W2CF = keep(arch(2.0, 4.3)), SHELL = keep(new THREE.CircleGeometry(0.45, 8, 0, Math.PI));
    // a window: white surround, dark panes, a cross of pale green-grey bars, a sill
    const win = (s, f, y0, y1, w) => {
      const hh = y1 - y0, ym = (y0 + y1) / 2;
      B(s - w / 2 - 0.16, s + w / 2 + 0.16, f, f + 0.06, y0 - 0.15, y1 + 0.15, COL.white);
      B(s - w / 2, s + w / 2, f + 0.06, f + 0.1, y0, y1, COL.glass);
      B(s - 0.03, s + 0.03, f + 0.1, f + 0.13, y0, y1, COL.frame);
      B(s - w / 2, s + w / 2, f + 0.1, f + 0.13, y0 + hh * 0.68 - 0.03, y0 + hh * 0.68 + 0.03, COL.frame);
      B(s - w / 2 - 0.25, s + w / 2 + 0.25, f, f + 0.2, y0 - 0.25, y0 - 0.13, COL.white);
      return ym;
    };
    for (const [s0, s1, f, bays] of SECT) {
      const centre = s0 === 33.1, end = f === 0.55;
      B(s0, s1, -0.3, f, GR, EAVES - 0.4, COL.pink);
      B(s0, s1, f - 0.05, f + 0.08, GR, PL, COL.plinth);
      B(s0, s1, f, f + 0.12, 49.0, 49.4, COL.white);                                    // the band under the first floor
      B(s0, s1, f, f + 0.1, 56.6, 57.6, COL.white);                                     // the frieze
      B(s0 - (end || centre ? 0.25 : 0), s1 + (end || centre ? 0.25 : 0), f - 0.3, f + 0.5, 57.55, EAVES, COL.white);   // the cornice
      // pilaster strips: wide ones at a section's edges, narrow between its bays
      const edges = [s0 + (end || centre ? 0.5 : 0.35), s1 - (end || centre ? 0.5 : 0.35)];
      for (const s of edges) B(s - (end || centre ? 0.5 : 0.35), s + (end || centre ? 0.5 : 0.35), f, f + 0.12, PL, 56.6, COL.white);
      for (let k = 0; k + 1 < bays.length; k++) { const s = (bays[k] + bays[k + 1]) / 2; B(s - 0.3, s + 0.3, f, f + 0.08, PL, 56.6, COL.white); }
      for (const s of bays) {
        if (!centre) {
          F(W1F, COL.white, s, f + 0.05, 45.25);
          F(W1, COL.glass, s, f + 0.08, 45.4);
          B(s - 0.03, s + 0.03, f + 0.08, f + 0.11, 45.4, 48.0, COL.frame);
          B(s - 0.65, s + 0.65, f + 0.08, f + 0.11, 47.2, 47.26, COL.frame);
          B(s - 0.9, s + 0.9, f, f + 0.2, 45.15, 45.27, COL.white);
          win(s, f, 50.1, 52.7, 1.3);
        } else {
          F(W2CF, COL.white, s, f + 0.05, 49.85);                                     // the tall arched windows behind the balcony
          F(W2C, COL.glass, s, f + 0.08, 50.0);
          B(s - 0.03, s + 0.03, f + 0.08, f + 0.11, 50.0, 54.0, COL.frame);
          B(s - 0.75, s + 0.75, f + 0.08, f + 0.11, 52.4, 52.46, COL.frame);
          F(SHELL, COL.white, s, f + 0.06, 54.2);
        }
        win(s, f, centre ? 54.7 : 54.2, centre ? 56.0 : 55.9, centre ? 1.15 : 1.3);
      }
      if (jobs.late()) yield;
    }
    // downpipes beside the risalits
    for (const s of [11.25, 32.85, 49.35, 70.95]) B(s - 0.07, s + 0.07, 0.18, 0.32, GR, EAVES - 0.4, COL.pipe);
    yield;

    // ---- the end risalits' pediments: a white triangle, the pink field inside it, a white cartouche
    const tri = (w, hh) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(0, hh); s.lineTo(w / 2, 0); s.lineTo(-w / 2, 0); return s; };
    const PED = keep(new THREE.ExtrudeGeometry(tri(11.5, 2.8), { depth: 0.55, bevelEnabled: false })), PEDI = keep(new THREE.ShapeGeometry(tri(9.4, 2.05)));
    const CART = keep(new THREE.CircleGeometry(0.85, 10, 0, Math.PI));
    for (const s of [5.5, LEN - 5.5]) {
      F(PED, COL.white, s, 0.5 - 0.55, EAVES - 0.02);
      F(PEDI, COL.pink, s, 0.52, EAVES + 0.32);
      F(CART, COL.white, s, 0.54, EAVES + 0.45);
    }

    // ---- the arcade under the balcony: three arches in front, one in each side
    const S0 = 34.6, S1 = 47.6, VF = 3.95, C = 41.1;
    const yA = h(...at(C, VF)) - 0.05;
    B(S0, S1, 0.95, VF, GR, 48.8, COL.pink);
    for (const s of [S0 + 0.45, 38.95, 43.25, S1 - 0.45]) B(s - 0.45, s + 0.45, VF, VF + 0.1, GR, 48.8, COL.white);
    B(S0, S1, VF, VF + 0.12, GR, yA + 0.35, COL.plinth);
    const AC = keep(arch(3.4, 4.3)), ACF = keep(arch(3.95, 4.6)), AS = keep(arch(2.2, 3.6)), ASF = keep(arch(2.65, 3.85));
    F(ACF, COL.white, C, VF + 0.11, yA); F(AC, COL.dark, C, VF + 0.13, yA);
    for (let k = -1.35; k <= 1.36; k += 0.27) B(C + k - 0.02, C + k + 0.02, VF + 0.14, VF + 0.16, yA, yA + (Math.abs(k) < 1.7 ? 2.6 + Math.sqrt(Math.max(0, 1.7 * 1.7 - k * k)) * 0.9 : 2.6), 0x1b1a1f);   // the iron gate
    for (const s of [37.0, 45.2]) { F(ASF, COL.white, s, VF + 0.11, yA); F(AS, COL.dark, s, VF + 0.13, yA); B(s - 0.7, s + 0.7, VF + 0.12, VF + 0.15, yA, yA + 2.7, COL.door); }
    for (const [s, n] of [[S0, -1], [S1, 1]]) { F(ASF, COL.white, s + n * 0.02, 2.45, yA, n); F(AS, COL.dark, s + n * 0.04, 2.45, yA, n); }
    // the balcony: slab, balustrade with pedestals, two lamps
    B(S0 - 0.2, S1 + 0.2, 0.95, VF + 0.2, 48.8, 49.15, COL.white);
    B(S0 - 0.1, S1 + 0.1, VF - 0.05, VF + 0.12, 49.15, 49.3, COL.white);
    B(S0 - 0.1, S1 + 0.1, VF - 0.05, VF + 0.14, 50.05, 50.2, COL.white);
    for (const s of [S0, S1]) { B(s - 0.08, s + 0.08, 0.95, VF + 0.1, 49.15, 49.3, COL.white); B(s - 0.09, s + 0.09, 0.95, VF + 0.1, 50.05, 50.2, COL.white); }
    for (let s = S0 + 0.35; s < S1 - 0.2; s += 0.32) if (![38.95, 43.25].some((q) => Math.abs(q - s) < 0.25)) B(s - 0.06, s + 0.06, VF - 0.02, VF + 0.1, 49.3, 50.05, COL.white);
    for (const s of [S0, S1]) for (let v = 1.25; v < VF - 0.2; v += 0.32) B(s - 0.06, s + 0.06, v - 0.06, v + 0.06, 49.3, 50.05, COL.white);
    for (const s of [S0 + 0.05, 38.95, 43.25, S1 - 0.05]) B(s - 0.2, s + 0.2, VF - 0.12, VF + 0.18, 49.15, 50.3, COL.white);
    for (const s of [S0 + 0.05, S1 - 0.05]) {
      B(s - 0.03, s + 0.03, VF - 0.0, VF + 0.06, 50.3, 51.3, COL.dark);
      const [x, z] = at(s, VF + 0.03);
      glow.box(0.22, 0.3, 0.22, 0xfff0c8, x, 51.45, z, YAW);
      B(s - 0.15, s + 0.15, VF - 0.12, VF + 0.18, 51.6, 51.68, COL.dark);
    }
    yield;

    // ---- the attic over the centre: balustrades with urns either side of the curved gable
    const AF = 0.7;
    B(33.1, 49.1, AF - 0.25, AF + 0.2, EAVES, 58.45, COL.white);
    const URN = keep(new THREE.LatheGeometry([[0, 0], [0.16, 0], [0.12, 0.08], [0.2, 0.3], [0.17, 0.5], [0.08, 0.58], [0.1, 0.66], [0, 0.72]].map(([a, b]) => new THREE.Vector2(a, b)), 8));
    for (const [a, b] of [[33.3, 37.4], [44.8, 48.9]]) {
      B(a, b, AF - 0.05, AF + 0.1, 58.45, 58.6, COL.white);
      B(a, b, AF - 0.05, AF + 0.12, 59.2, 59.35, COL.white);
      for (let s = a + 0.4; s < b - 0.3; s += 0.3) B(s - 0.055, s + 0.055, AF - 0.02, AF + 0.08, 58.6, 59.2, COL.white);
      for (const s of [a, b]) { B(s - 0.22, s + 0.22, AF - 0.2, AF + 0.2, 58.45, 59.5, COL.white); const [x, z] = at(s, AF); p.add(URN, COL.white, x, 59.5, z); }
    }
    {
      const g = new THREE.Shape();
      g.moveTo(-3.7, 0); g.lineTo(-3.7, 1.4); g.quadraticCurveTo(-3.7, 2.45, -2.6, 2.5); g.quadraticCurveTo(-1.35, 2.6, -1.1, 3.35); g.quadraticCurveTo(-0.75, 4.25, 0, 4.3);
      g.quadraticCurveTo(0.75, 4.25, 1.1, 3.35); g.quadraticCurveTo(1.35, 2.6, 2.6, 2.5); g.quadraticCurveTo(3.7, 2.45, 3.7, 1.4); g.lineTo(3.7, 0); g.lineTo(-3.7, 0);
      const GAB = keep(new THREE.ExtrudeGeometry(g, { depth: 0.45, bevelEnabled: false, curveSegments: 5 }));
      const inner = new THREE.Shape(g.getPoints(5).map((q) => new THREE.Vector2(q.x * 0.84, q.y * 0.8)));
      const GABI = keep(new THREE.ShapeGeometry(inner));
      F(GAB, COL.white, C, AF - 0.25, EAVES + 0.45);
      F(GABI, COL.pink, C, AF + 0.22, EAVES + 0.6);
      // the coat of arms: a gold shield with the three blue lions, white leaves either side
      const sh = new THREE.Shape(); sh.moveTo(-0.62, 0.75); sh.lineTo(0.62, 0.75); sh.lineTo(0.62, 0); sh.quadraticCurveTo(0.55, -0.6, 0, -0.8); sh.quadraticCurveTo(-0.55, -0.6, -0.62, 0); sh.lineTo(-0.62, 0.75);
      const SH = keep(new THREE.ShapeGeometry(sh, 5));
      F(SH, COL.gold, C, AF + 0.25, EAVES + 2.05);
      for (const dy of [0.45, 0.05, -0.32]) B(C - (dy < -0.2 ? 0.28 : 0.38), C + (dy < -0.2 ? 0.28 : 0.38), AF + 0.25, AF + 0.29, EAVES + 2.05 + dy - 0.07, EAVES + 2.05 + dy + 0.07, COL.blue);
      const LEAF = keep(new THREE.CircleGeometry(0.5, 8).scale(1.6, 0.55, 1));
      for (const d of [-1, 1]) { const [x, z] = at(C + d * 1.35, AF + 0.25); p.add(LEAF, COL.white, x, EAVES + 1.75, z, YAW + d * 0.0); }
      const [x, z] = at(C, AF);
      p.add(URN, COL.white, x, EAVES + 4.75, z);
      // the small flag on the gable
      p.add(keep(new THREE.CylinderGeometry(0.035, 0.05, 4.2, 6)), COL.white, x, EAVES + 7.3, z);
      for (const [k, hex] of [[0, COL.flagB], [1, COL.flagK], [2, COL.flagW]]) p.box(1.3, 0.27, 0.02, hex, x + 0.7, EAVES + 9.05 - k * 0.27, z, 0);
    }
    yield 'frame';

    // ---- Pikk Hermann
    {
      const xs = [[0, 6], [1.57, 6], [3.14, 6], [-1.57, 6]].map(([a, r]) => h(PH.x + Math.sin(a) * r, PH.z + Math.cos(a) * r));
      const FOOT = Math.min(...xs) - 0.6, T0 = 41.0, T1 = 81.2;
      const rAt = (y) => 5.3 + (5.05 - 5.3) * Math.max(0, Math.min(1, (y - T0) / (T1 - T0)));
      p.add(keep(new THREE.CylinderGeometry(5.3, 5.95, T0 - FOOT, 28)), COL.stone2, PH.x, (FOOT + T0) / 2, PH.z);
      p.add(keep(new THREE.CylinderGeometry(5.05, 5.3, T1 - T0, 28, 1, true)), COL.stone, PH.x, (T0 + T1) / 2, PH.z);
      p.add(keep(new THREE.CylinderGeometry(5.28, 5.05, 0.45, 28, 1, true)), COL.stone2, PH.x, T1 + 0.22, PH.z);     // the corbel ring
      const TOP = 83.7, WALK = 82.6;
      p.add(keep(new THREE.CylinderGeometry(5.28, 5.28, TOP - T1 - 0.45, 28, 1, true)), COL.stone, PH.x, (T1 + 0.45 + TOP) / 2, PH.z);
      p.add(keep(new THREE.CylinderGeometry(4.6, 4.6, TOP - WALK, 28, 1, true)), COL.stone2, PH.x, (WALK + TOP) / 2, PH.z);
      p.add(keep(new THREE.RingGeometry(4.6, 5.28, 28).rotateX(-Math.PI / 2)), COL.stone2, PH.x, TOP, PH.z);
      p.add(keep(new THREE.CircleGeometry(4.6, 28).rotateX(-Math.PI / 2)), COL.roof, PH.x, WALK, PH.z);
      p.add(keep(new THREE.CylinderGeometry(2.9, 2.9, 1.1, 18)), COL.stone2, PH.x, WALK + 0.55, PH.z);
      p.box(0.8, 0.12, 0.8, COL.dark, PH.x + 0.6, WALK + 1.15, PH.z - 0.4, 0.3);
      // small openings: slits up the shaft, a ring of little windows under the top
      for (const [a, y, w, hh] of [[-1.9, 50, 0.35, 1.3], [-0.6, 55, 0.35, 1.3], [0.7, 52, 0.35, 1.3], [2.4, 57, 0.35, 1.3], [-1.3, 64, 0.5, 1.4], [0.2, 67, 0.5, 1.4], [-2.6, 70, 0.5, 1.4], [-0.5, 74, 0.5, 1.4], [1.3, 72, 0.5, 1.4]]) {
        const r = rAt(y) - 0.03; p.box(w, hh, 0.1, COL.dark, PH.x + Math.sin(a) * r, y, PH.z + Math.cos(a) * r, a);
      }
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4 + 0.3, r = 5.25; p.box(0.55, 0.75, 0.1, COL.dark, PH.x + Math.sin(a) * r, 82.2, PH.z + Math.cos(a) * r, a); }
      // the flagpole on the north side of the platform and the flag flying east
      const fx = PH.x + 0.3, fz = PH.z - 3.4, POLE = 10.6;
      p.add(keep(new THREE.CylinderGeometry(0.06, 0.1, POLE, 8)), 0xeeeef2, fx, WALK + POLE / 2, fz);
      glow.add(keep(new THREE.SphereGeometry(0.13, 8, 6)), 0xf0d38a, fx, WALK + POLE + 0.1, fz);
      const FL = 3.0, FH = 0.62;
      for (const [k, hex] of [[0, COL.flagB], [1, COL.flagK], [2, COL.flagW]]) {
        const g = keep(new THREE.PlaneGeometry(FL, FH, 8, 1));
        const ps = g.attributes.position;
        for (let i = 0; i < ps.count; i++) { const u = ps.getX(i) + FL / 2; ps.setZ(i, Math.sin(u * 2.1) * 0.18 * (u / FL)); ps.setY(i, ps.getY(i) - u * 0.06); }
        g.computeVertexNormals();
        p.add(g, hex, fx + FL / 2 + 0.08, WALK + POLE - 0.45 - k * FH, fz, 0);
      }
    }
    yield;

    // ---- the compass rose in the square's paving
    {
      const y = h(ROSE.x, ROSE.z) + 0.035;
      const star = (R, r, n, rot) => { const s = new THREE.Shape(); for (let k = 0; k < n * 2; k++) { const a = rot + (k * Math.PI) / n, q = k % 2 ? r : R; if (k) s.lineTo(Math.sin(a) * q, Math.cos(a) * q); else s.moveTo(Math.sin(a) * q, Math.cos(a) * q); } return s; };
      p.add(keep(new THREE.ShapeGeometry(star(1.75, 0.3, 4, Math.PI / 4)).rotateX(-Math.PI / 2)), 0x6b6a70, ROSE.x, y, ROSE.z, ROSE.yaw);
      p.add(keep(new THREE.ShapeGeometry(star(2.7, 0.38, 4, 0)).rotateX(-Math.PI / 2)), 0x3e3d45, ROSE.x, y + 0.005, ROSE.z, ROSE.yaw);
      const c = Math.cos(ROSE.yaw), s = Math.sin(ROSE.yaw);
      for (const [dx, dz, w, d] of [[0, -3.2, 6.5, 0.14], [0, 3.2, 6.5, 0.14], [-3.2, 0, 0.14, 6.5], [3.2, 0, 0.14, 6.5]]) p.box(w, 0.04, d, 0x4a4950, ROSE.x + c * dx + s * dz, y - 0.01, ROSE.z + c * dz - s * dx, ROSE.yaw);
    }
    yield 'frame';

    const m = p.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    if (m) { m.castShadow = shadows; m.receiveShadow = true; m.matrixAutoUpdate = false; group.add(m); }
    const gm = glow.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    if (gm) { gm.matrixAutoUpdate = false; group.add(gm); }
    for (const g of geos) g.dispose();
  }

  let built = false;
  const C = at(41, 0);
  return {
    info: () => ({ built }),
    update(car) {
      if (built || !car || Math.hypot(car.x - C[0], car.z - C[1]) > 450 || !world.ready(...C) || !world.ready(PH.x, PH.z) || !world.ready(...at(0, 2)) || !world.ready(...at(LEN, 2))) return;
      built = true;
      jobs.add(build, 'toompea castle');
    },
  };
}
