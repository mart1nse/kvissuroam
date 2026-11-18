// Kvissentali tee west of the Klaose / Lootsi junction, and the pair of white flat-roofed houses at
// nos. 10 and 12, from Street View (July 2024) and the Land Board's 2024 oblique photos: the blue
// crossing signs at the zebras, the cobbled corner island, mown verges,
// lamp posts, and the two houses built by hand in place of the map's blocks: window bands with dark panels,
// slim side windows, dark flat roofs (sun panels on the east one), terraces, the carports with their slatted
// stores, the shared paved drive with its double gate, mesh fences, rows of young thujas and cabinets.
// Road frame: t = map x along Kvissentali tee (west to east), lat = metres sideways, + north, - south.
import * as THREE from 'three';
import { roadFrame, wallOf, streetKit, addHouseColours, KIT } from './streetkit.js';
import { BOX } from '../race/landmarks.js';
import { buildCarModel } from '../cars/models/index.js';

const ROAD = [[-176.9, 9.4], [145.4, -30.6], [333.6, -54.6]];
const R = roadFrame(ROAD, 0);
const KLAOSE = roadFrame([[145.4, -30.6], [146.2, -19.5], [148.9, 16.5]], 1);
const DRIVE = roadFrame([[69.9, -24], [68.4, 16]], 1);      // the shared drive, square to the road; lat + east
const EDGE = 3.8, PATH = [-6.2, -8.8];                     // road half width; the foot and cycle path south of it
const FRONT = -15.4;                                       // the plots' front fence line, 2 m nearer the houses than the map has it (Martin, 18 Nov)
const CENTRE = [80, -10];
const LIGHT = 0, SIGN_CROSSING = 17;

// the two houses: north face from its east corner to its west corner (LOD2), depth, side of the carport
const HOUSES = [
  { ne: [59.25, 0.5], nw: [49.7, 1.65], depth: 13.9, carport: 'E', wall: 0xf5f4f1, lod: { base: -24, x: 58, z: 8 } },
  { ne: [90.15, -3.35], nw: [80.6, -2.15], depth: 13.9, carport: 'W', wall: 0xf1ede4, solar: true, lod: { base: 73, x: 84.5, z: 4.5 } },
];
const HGT = 7.4, CARPORT = { f0: 4.1, f1: 13.2, w: 6.8, h: 2.8, store: [2.7, 3.3] };
const COL = {
  panel: 0x6a6770, glass: 0x8fb0bd, frame: 0x3f4049, roof: 0x5a5c68, plinth: 0x61626e, slat: 0x5b5860, slatLine: 0x6e6a70,
  terrace: 0xd9d6de, solar: 0x3b4a78, solarLine: 0x8f9bc0, cabinet: 0xc9c9c4, fence: 0x5d6270,
  kerb: 0xcfccd6, cobble: 0xa9a4b4,
};

export function kvissentaliWalls(walls) {
  addHouseColours(walls, '1_1', -160, -160, HOUSES.map((h) => ({ ...h.lod, wall: h.wall, hide: true, reach: 14 })));
}
export function kvissentaliProps() {
  const out = [], across = (t, s) => { const [dx, dz] = R.dir(t); return (Math.atan2(-dz * s, -dx * s) * 180) / Math.PI; };   // bearing square to the road
  for (const t of [-18, 20, 56, 92, 128, 166]) out.push([LIGHT, ...R.at(t, 5.2), across(t, 1)]);
  const along = (Math.atan2(R.dir(150)[0], -R.dir(150)[1]) * 180) / Math.PI;
  out.push([SIGN_CROSSING, ...R.at(161.2, 4.7), along], [SIGN_CROSSING, ...R.at(156.2, -4.7), along + 180]);
  out.push([SIGN_CROSSING, ...KLAOSE.at(-16.6, 5.0), 180], [SIGN_CROSSING, ...KLAOSE.at(-21.6, -5.0), 0]);
  return out;
}

export function createKvissentaliTee(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  let built = false;

  function house(K, H) {
    const y = Math.min(K.h(...H.ne), K.h(...H.nw)) - 0.05;
    const N = wallOf(H.ne, H.nw), sw = N.at(N.len, -H.depth), se = N.at(0, -H.depth);
    const W = wallOf(H.nw, sw), S = wallOf(sw, se), E = wallOf(se, H.ne);
    for (const w of [N, W, S, E]) w.y = y;
    const [cx, cz] = N.at(N.len / 2, -H.depth / 2);
    K.p.add(BOX(N.len, HGT + 1, H.depth), H.wall, cx, y + (HGT - 1) / 2, cz, N.yaw);
    K.p.add(BOX(N.len - 0.5, 0.08, H.depth - 0.5), COL.roof, cx, y + HGT + 0.03, cz, N.yaw);
    for (const w of [N, W, S, E]) K.slab(w, -0.03, w.len + 0.03, -0.6, 0.28, 0, 0.03, COL.plinth);
    if (H.solar) for (let r = 0; r < 5; r++) {
      const [px, pz] = N.at(N.len / 2 + 0.3, -3.2 - r * 2.0);
      K.p.add(BOX(6.2, 0.1, 1.6), COL.solar, px, y + HGT + 0.14, pz, N.yaw);
      for (let k = 1; k < 6; k++) { const [lx, lz] = N.at(N.len / 2 + 0.3 - 3.1 + k * 6.2 / 6, -3.2 - r * 2.0); K.p.add(BOX(0.04, 0.11, 1.6), COL.solarLine, lx, y + HGT + 0.14, lz, N.yaw); }
    }
    // a window band: dark panel from s0 to s1 with windows let into it
    const band = (w, s0, s1, y0, y1, wins, flip = false, bars = 1) => {
      const f = (s) => (flip ? w.len - s : s), lo = Math.min(f(s0), f(s1)), hi = Math.max(f(s0), f(s1));
      K.slab(w, lo, hi, y0, y1, 0.0, 0.035, COL.panel);
      for (const [a, b] of wins) { const A = Math.min(f(a), f(b)), B = Math.max(f(a), f(b)); K.win(w, A, B, y0 + 0.06, y1 - 0.06, { bars, frame: COL.frame, glass: COL.glass, fw: 0.05, off: 0.02 }); }
    };
    const dot = (w, s, yy) => K.slab(w, s - 0.09, s + 0.09, yy - 0.09, yy + 0.09, 0, 0.03, COL.frame);
    // street front: two tall windows with a panel between, a slim strip under them
    band(N, 1.5, 8.1, 4.15, 5.7, [[1.5, 3.35], [6.25, 8.1]]);
    band(N, 1.5, 8.1, 1.95, 2.5, [[1.5, 3.35], [6.25, 8.1]], false, 0);
    for (const [s, yy] of [[0.8, 3.3], [0.8, 0.95], [8.8, 3.3]]) dot(N, s, yy);
    // garden end: the same band upstairs, wide terrace doors below
    band(S, 1.5, 8.1, 4.15, 5.7, [[1.5, 3.35], [6.25, 8.1]]);
    K.win(S, 2.0, 7.6, 0.35, 2.6, { bars: 2, frame: COL.frame, glass: COL.glass, fw: 0.06, off: 0 });
    // the long outer side: three windows in each band; the carport side: slim windows upstairs
    const outer = H.carport === 'E' ? W : E, inner = H.carport === 'E' ? E : W, flipO = H.carport !== 'E', flipI = H.carport === 'E';
    const three = [[2.4, 4.2], [6.0, 7.8], [9.6, 11.4]];
    band(outer, 2.4, 11.4, 4.15, 5.7, three, flipO); band(outer, 2.4, 11.4, 1.1, 2.6, three, flipO);
    dot(outer, flipO ? outer.len - 1.4 : 1.4, 3.3);
    const fi = (f) => (flipI ? inner.len - f : f);                       // distance back from the street front -> s on the inner wall
    for (const f of [5.4, 6.5, 7.6, 8.7]) K.win(inner, fi(f) - 0.2, fi(f) + 0.2, 4.0, 5.65, { frame: COL.frame, glass: COL.glass, fw: 0.04, off: 0 });
    // terrace at the garden end, wrapping the outer corner
    { const [tx, tz] = S.at(S.len / 2 + (H.carport === 'E' ? -0.9 : 0.9), 1.9); K.p.add(BOX(S.len + 1.8, 0.5, 3.8), COL.terrace, tx, y - 0.07, tz, S.yaw); }

    // ---- the carport on the inner side: flat roof with a dark fascia, slatted store by the house, white end and back walls
    const C = CARPORT, at = (f, n) => inner.at(fi(f), n);
    const piece = (f0, f1, n0, n1, y0, y1, hex) => { const [px, pz] = at((f0 + f1) / 2, (n0 + n1) / 2); K.p.add(BOX(f1 - f0, y1 - y0, n1 - n0), hex, px, y + (y0 + y1) / 2, pz, inner.yaw); };
    piece(C.f0 - 0.25, C.f1 + 0.1, 0, C.w + 0.15, C.h, C.h + 0.32, COL.frame);
    piece(C.f0, C.f1, C.w - 0.22, C.w, -0.5, C.h, H.wall);
    piece(C.f1 - 0.2, C.f1, 0, C.w, -0.5, C.h, H.wall);
    // (the slatted stores at the front of the carports are gone: Martin, 18 Nov)
    K.ribbon({ at: (t, lat) => at(t, lat) }, C.f0 - 1, C.f1 - 0.2, 0.05, C.w - 0.25, 'dark', true);
    // the east carport: the black Mercedes under the roof, nose in, its rear to the street; the navy Porsche
    // 356 in front of the west house's carport, facing the street (Martin, 18 Nov)
    const [ax, az] = at(0, C.w / 2), [bx, bz] = at(1, C.w / 2);
    if (H.carport === 'W') {
      const [carX, carZ] = at((C.f0 + C.f1) / 2 + 0.4, C.w / 2 - 0.1);
      parked.push({ id: 'w201', x: carX, z: carZ, yaw: Math.atan2(bx - ax, -(bz - az)), hl: 2.25, hw: 0.86, wb: 2.665 });
    } else {
      const [px, pz] = at(C.f0 - 2.6, C.w / 2 - 0.1);
      porsche = { x: px, z: pz, f: [ax - bx, az - bz] };
    }
  }
  const parked = [];
  let porsche = null;

  // a Porsche 356 coupé from primitives, local +x forward, standing on the ground at y
  function porsche356(p, x, y, z, fwd, paint) {
    const yaw = Math.atan2(-fwd[1], fwd[0]), rx = -fwd[1], rz = fwd[0];
    const put = (geo, hex, l, h, t) => p.add(geo, hex, x + fwd[0] * l + rx * t, y + h, z + fwd[1] * l + rz * t, yaw);
    const chrome = 0xdcdce6, glass = 0x2c3040;
    put(new THREE.CapsuleGeometry(0.8, 2.35, 8, 20).rotateZ(Math.PI / 2).scale(1, 0.47, 1.04), paint, 0, 0.62, 0);       // the round tub
    for (const l of [1.05, -1.05]) for (const t of [-0.6, 0.6]) {
      put(new THREE.SphereGeometry(0.46, 16, 10).scale(1.45, 0.78, 0.66), paint, l * (l > 0 ? 1.02 : 1), 0.7, t);     // wing over the wheel
      put(new THREE.CylinderGeometry(0.32, 0.32, 0.17, 18).rotateX(Math.PI / 2), 0x16161b, l, 0.32, t * 1.13);       // tyre
      put(new THREE.CylinderGeometry(0.17, 0.17, 0.19, 14).rotateX(Math.PI / 2), chrome, l, 0.32, t * 1.13);          // hubcap
    }
    put(new THREE.SphereGeometry(1, 20, 12).scale(1.02, 0.37, 0.7), glass, -0.28, 0.97, 0);                            // glasshouse
    put(new THREE.SphereGeometry(1, 20, 12).scale(0.86, 0.36, 0.64), paint, -0.34, 1.03, 0);                           // roof over it
    for (const t of [-0.5, 0.5]) {
      put(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 14).rotateZ(Math.PI / 2), chrome, 1.74, 0.76, t);              // headlamp ring
      put(new THREE.CylinderGeometry(0.09, 0.09, 0.09, 14).rotateZ(Math.PI / 2), 0xfff4d6, 1.76, 0.76, t);
      put(BOX(0.05, 0.07, 0.12), 0xd8434f, -1.95, 0.66, t * 0.9);                                                     // tail lamp
    }
    put(BOX(0.07, 0.07, 1.42), chrome, 1.98, 0.42, 0); put(BOX(0.07, 0.07, 1.42), chrome, -1.98, 0.42, 0);              // bumpers
    put(BOX(0.04, 0.16, 0.42), chrome, -1.93, 0.86, 0);                                                                 // engine lid grille
  }
  // a round trampoline with its safety net
  function trampoline(K, x, z, r = 1.8) {
    const y = K.h(x, z), mat = 0.92;
    K.p.add(new THREE.CylinderGeometry(r - 0.2, r - 0.2, 0.03, 28), 0x2c2c34, x, y + mat, z);                         // the jumping mat
    K.p.add(new THREE.TorusGeometry(r - 0.1, 0.12, 6, 32).rotateX(Math.PI / 2).scale(1, 0.6, 1), 0x4f8fd0, x, y + mat, z);   // padding
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      K.p.add(new THREE.CylinderGeometry(0.03, 0.03, mat + 1.85, 6), 0x8f94a3, px, y + (mat + 1.85) / 2, pz);           // leg and net post
    }
    K.p.add(new THREE.TorusGeometry(r, 0.03, 4, 32).rotateX(Math.PI / 2), 0x8f94a3, x, y + mat + 1.8, z);
    const net = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.02, r - 0.02, 1.78, 32, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x24242c, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
    net.position.set(x, y + mat + 0.9, z);
    group.add(net);
  }

  function build() {
    built = true;
    const K = streetKit(world, group, { shadows, fenceColour: COL.fence });

    // ---- verges: mown grass between road and path and on the north side, wilder strip to the fences
    for (const [a, b] of [[-20, 66.9], [71.9, 128]]) K.ribbon(R, a, b, -EDGE - 0.1, PATH[0] + 0.05, 'lawn');
    K.ribbon(R, -20, 138, EDGE + 0.1, 8.4, 'lawn');
    K.ribbon(R, 160, 215, EDGE + 0.1, 7.5, 'lawn');
    // the cobbled island on the corner
    { const [x, z] = [152.6, -25.6], y = K.h(x, z);
      K.p.add(new THREE.CylinderGeometry(1, 1, 0.3, 20).scale(2.6, 1, 1.35), COL.kerb, x, y, z, 0.35);
      K.p.add(new THREE.CylinderGeometry(1, 1, 0.3, 20).scale(2.4, 1, 1.15), COL.cobble, x, y + 0.03, z, 0.35); }

    // ---- the drive: concrete from the road across the path, dark pavers to the gate and the forecourt
    K.ribbon(DRIVE, -18.6, -15.7, -2.6, 2.6, 'concrete');
    K.ribbon(DRIVE, -12.9, -5.5, -2.6, 2.6, 'dark');
    K.ribbon(DRIVE, -9.0, -5.5, -3.6, 3.6, 'dark');
    K.ribbon(DRIVE, -5.5, 5.2, -9.4, 11.2, 'dark');
    K.ribbon(DRIVE, 5.2, 14.5, -1.4, 1.2, 'dark');
    // ---- the plots: lawns, mesh fence along the front with the double gate, rows of young thujas
    K.ribbon(R, 44, 96, FRONT - 0.2, FRONT - 42, 'lawn');
    K.fence(R, 44, 66.3, FRONT, 1.25, COL.fence); K.fence(R, 72.6, 96, FRONT, 1.25, COL.fence);
    K.fence({ at: (t, lat) => [lat, t] }, R.at(44, FRONT)[1], 30, 44, 1.25, COL.fence);
    K.fence({ at: (t, lat) => [lat, t] }, R.at(96, FRONT)[1], 30, 96, 1.25, COL.fence);
    { const a = R.at(66.3, FRONT), b = R.at(72.6, FRONT), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      K.panel(a, m, 1.3); K.panel(m, b, 1.3);
      for (const q of [a, m, b]) K.box(q[0], q[1], 0.1, 1.45, 0.1, COL.fence); }
    for (let t = 73.6; t < 95.5; t += 1.05) { const q = R.at(t, FRONT - 0.9); K.thuja(q[0], q[1], 1.15 + ((Math.round(t * 3) % 4) * 0.08), 0.33, Math.round(t)); }
    for (let z = -8; z < 30; z += 1.2) K.thuja(95.1, z, 1.2, 0.33, Math.round(z));
    for (let z = 6; z < 32; z += 1.1) { const q = DRIVE.at(z, 0); K.thuja(q[0], q[1], 1.5 + ((Math.round(z * 3) % 3) * 0.1), 0.4, Math.round(z)); }
    for (let z = -6; z < 30; z += 1.2) K.thuja(45, z, 1.1, 0.3, Math.round(z));
    for (const [x, z, r, c] of [[50, -5.5, 0.45, 1], [54.5, -6, 0.4, 0], [60, -5.2, 0.5, 2], [77.5, -4.2, 0.45, 1]]) K.shrub(x, z, r, KIT.shrub[c]);
    // cabinets by the path: at the drive, west of the plots, east of them
    for (const [t, lat, w, hh] of [[73.3, PATH[1] - 1.5, 0.9, 1.2], [40.5, PATH[1] - 1.3, 1.1, 1.15], [97.5, PATH[1] - 1.2, 0.6, 0.9]]) {
      const q = R.at(t, lat), yaw = Math.atan2(-R.dir(t)[1], R.dir(t)[0]);
      K.box(q[0], q[1], w, hh, 0.38, COL.cabinet, yaw); K.box(q[0], q[1], w + 0.06, 0.06, 0.44, 0xa9a9a6, yaw, hh);
    }
    for (const H of HOUSES) house(K, H);
    // the dark navy Porsche 356 in front of the west house's carport, facing the street (Martin, 18 Nov)
    {
      const { x, z, f } = porsche;
      porsche356(K.p, x, K.h(x, z) + 0.02, z, f, 0x27325e);
      world.addSolids([{ x, z, yaw: Math.atan2(-f[1], f[0]), hx: 2.0, hz: 0.84 }]);
    }
    // trampolines in the two back gardens (Martin, 18 Nov)
    trampoline(K, 52.5, 19.0); trampoline(K, 88.0, 17.5);
    K.finish();
    // the Mercedes: the real model, standing still
    const up = new THREE.Vector3(0, 1, 0);
    for (const c of parked) {
      const fx = Math.sin(c.yaw), fz = -Math.cos(c.yaw);
      world.addSolids([{ x: c.x, z: c.z, yaw: Math.atan2(-fz, fx), hx: c.hl, hz: c.hw }]);
      setTimeout(() => {
        const model = buildCarModel(c.id);
        model.setLights({ headlights: false });
        model.group.quaternion.setFromAxisAngle(up, -c.yaw);
        model.group.position.set(c.x, world.heightAt(c.x, c.z) + 0.02, c.z);
        model.group.traverse((o) => { if (o.isMesh) { o.castShadow = shadows; o.receiveShadow = true; } });
        group.add(model.group);
      }, 300);
    }
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 500) return;
      if ([[0, -15], [70, 0], [150, -30], [200, -35], [70, 35]].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
