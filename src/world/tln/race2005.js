// More of the Pirita-Kose lap as it was raced in 2005 (Martin, 28 Nov 2026, from the onboard lap of the 2005 race he
// found, frames in the project's tallinn-plan/video-2005 folder; he picked these out of the list: "implement 1, 2, 4"):
//  1. The start lights: a grey steel gantry over Rummu tee, two beams on two posts with a signal head on each post
//     showing green, and the timing tower beside it on the left (a two-storey scaffold, a cabin below, a platform with
//     a roof above) behind a row of white plastic barriers (video t 153 s). Put 18 m before the game's own glowing
//     start banner, so the two do not stand in one another.
//  2. Red and white crowd barriers round the outside of the turn from Kloostrimetsa onto Merivälja tee (t 111 s): the
//     props kind 54 of props.js, knocked aside when hit, along the corner's outside where no road is.
//  4. A billboard on two legs on the outside of the run down to the Rummu corner (t 127 s), a grey box truck parked on
//     the outside of the corner's exit on Rummu tee (t 131 s), and the low red parapet along the Pirita bridge's
//     outer edge (t 119 s).
// The things' sizes, the billboard's picture and the truck's look are guessed from blurred frames; the places are
// the video's, put on the lap by matching the bike's turning to the lap's bends.
// Each part is built near the car through pirita.js's parts (the work queue), as its rails are.
import * as THREE from 'three';

const GREY = 0x8c8f96, DARK = 0x1c1c21;

// the billboard's picture: an old-style race poster (no real advertiser's name)
let posterTex = null;
function poster() {
  if (posterTex) return posterTex;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#c8202a'; g.fillRect(0, 0, 256, 44);
  g.fillStyle = '#1f3f8f'; g.fillRect(0, 96, 256, 32);
  g.fillStyle = '#ffffff'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('PIRITA–KOSE', 128, 23);
  g.fillStyle = '#c8202a'; g.font = 'bold 34px sans-serif';
  g.fillText('2005', 128, 70);
  g.fillStyle = '#ffffff'; g.font = 'bold 18px sans-serif';
  g.fillText('RINGRADA', 128, 112);
  posterTex = new THREE.CanvasTexture(c);
  posterTex.colorSpace = THREE.SRGBColorSpace;
  posterTex.anisotropy = 4;
  return posterTex;
}

// ctx: { at(s, o), SS, LEN, N, L (pirita.js lay()), world }. Returns pirita.js parts: { i, make(A, sub) }.
export function race2005Parts({ at, SS, LEN, N, L, world }) {
  const iOf = (s) => at(s)[4];
  const half = (s) => L.W[iOf(s)] / 2;
  const yawAlong = (q) => Math.atan2(-q[3], q[2]);          // a box's length along the lap there
  const parts = [];

  // ---- 1. the start lights and the timing tower
  const sG = LEN - 18;
  parts.push({
    i: iOf(sG), make: (A, sub) => {
      const c = at(sG), hw = half(sG), y0 = world.heightAt(c[0], c[1]);
      const H = 6.6, solids = [];
      // posts at both edges, two beams across with ties between them
      for (const side of [-1, 1]) {
        const p = at(sG, side * (hw + 1.1));
        A.p.box(0.24, H, 0.24, GREY, p[0], world.heightAt(p[0], p[1]) + H / 2, p[1], yawAlong(c));
        solids.push({ x: p[0], z: p[1], yaw: 0, hx: 0.2, hz: 0.2 });
        // the signal head, facing the coming cars: red and amber dark, green lit
        const q = at(sG - 0.3, side * (hw + 1.1)), gy = world.heightAt(q[0], q[1]);
        A.p.box(0.26, 1.05, 0.38, DARK, q[0], gy + 3.6, q[1], yawAlong(c));
        for (const [k, col] of [[0, 0x3a1416], [1, 0x3a2a12], [2, 0x3cff7a]]) {
          const r = at(sG - 0.45, side * (hw + 1.1));
          A.p.box(0.04, 0.22, 0.22, col, r[0], gy + 3.95 - k * 0.32, r[1], yawAlong(c));
        }
      }
      const a = at(sG, -(hw + 1.1)), b = at(sG, hw + 1.1);
      for (const y of [5.7, 6.4]) A.bar([a[0], a[1]], [b[0], b[1]], 0.16, y - 0.08, y + 0.08, GREY, y0);
      const n = Math.round((2 * hw + 2.2) / 1.1);
      for (let k = 0; k < n; k++) {
        const u = at(sG, -(hw + 1.1) + (k + 0.5) * (2 * hw + 2.2) / n);
        A.p.box(0.06, 0.7, 0.06, GREY, u[0], y0 + 6.05, u[1], 0);
      }
      // the timing tower on the left: a grey cabin, a platform on four posts above it with a rail, a flat roof
      const T = at(sG + 4, -(hw + 5.2)), ty = world.heightAt(T[0], T[1]), ya = yawAlong(T);
      A.p.box(5.0, 2.6, 2.8, 0xb9bcc2, T[0], ty + 1.3, T[1], ya);
      const w1 = at(sG + 4, -(hw + 3.78));
      A.p.box(4.2, 0.7, 0.04, 0x2a3240, w1[0], ty + 1.7, w1[1], ya);                // the window strip to the road
      A.p.box(5.2, 0.12, 3.0, GREY, T[0], ty + 2.66, T[1], ya);
      for (const ds of [-2.4, 2.4]) for (const dv of [-1.35, 1.35]) {
        const u = at(sG + 4 + ds, -(hw + 5.2) + dv);
        A.p.box(0.1, 2.6, 0.1, GREY, u[0], ty + 4.0, u[1], 0);
      }
      const rr = at(sG + 4, -(hw + 3.85));
      A.p.box(4.9, 0.05, 0.05, 0xe4e3e0, rr[0], ty + 3.7, rr[1], ya);
      A.p.box(5.4, 0.14, 3.2, 0x6f727a, T[0], ty + 5.35, T[1], ya);
      solids.push({ x: T[0], z: T[1], yaw: ya, hx: 2.5, hz: 1.4 });
      // the white plastic barriers between the road and the tower, end to end
      for (let d = -6; d < 14; d += 1.85) {
        const u = at(sG + d + 0.9, -(hw + 2.4)), gy = world.heightAt(u[0], u[1]);
        A.p.box(1.8, 0.62, 0.42, 0xeeeeea, u[0], gy + 0.31, u[1], yawAlong(u));
        A.p.box(1.8, 0.2, 0.62, 0xe2e2de, u[0], gy + 0.1, u[1], yawAlong(u));
      }
      { const u = at(sG + 4, -(hw + 2.4)); solids.push({ x: u[0], z: u[1], yaw: yawAlong(u), hx: 10, hz: 0.5 }); }
      world.addSolids(solids);
    },
  });

  // ---- 4. the billboard down to the Rummu corner, the truck past it, the bridge's red parapet
  const firstClear = (s, side, from, to) => {
    for (let o = from; o <= to; o += 0.5) { const p = at(s, side * (half(s) + o)); if (!L.onRoad(p[0], p[1], 1.2) && !L.onPath(p[0], p[1], 0.6)) return p; }
    return null;
  };
  const sB = SS[2532];
  parts.push({
    i: 2532, make: (A, sub) => {
      const p = firstClear(sB, 1, 4, 14);
      if (!p) return;
      const gy = world.heightAt(p[0], p[1]);
      // legs and frame, the face to the road and turned a little towards the coming cars
      const tx = p[2], tz = p[3], nx = Math.cos(0.35) * tz - Math.sin(0.35) * tx, nz = -Math.cos(0.35) * tx - Math.sin(0.35) * tz;
      const face = Math.atan2(nx, nz), fx = Math.cos(face), fz = -Math.sin(face);
      for (const d of [-2.2, 2.2]) A.p.box(0.16, 4.6, 0.16, GREY, p[0] + fx * d, gy + 2.3, p[1] + fz * d, face);
      A.p.box(6.2, 3.2, 0.12, 0x2b2b30, p[0], gy + 4.6, p[1], face);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 3.0), new THREE.MeshLambertMaterial({ map: poster() }));
      m.rotation.y = face;
      m.position.set(p[0] + nx * 0.07, gy + 4.6, p[1] + nz * 0.07);
      m.updateMatrix();
      sub.add(m);
      world.addSolids([-2.2, 2.2].map((d) => ({ x: p[0] + fx * d, z: p[1] + fz * d, yaw: 0, hx: 0.12, hz: 0.12 })));
    },
  });
  const sT = SS[2604];
  parts.push({
    i: 2604, make: (A) => {
      const p = firstClear(sT, 1, 3.2, 9);
      if (!p) return;
      const gy = world.heightAt(p[0], p[1]), ya = yawAlong(p), ux = p[2], uz = p[3];
      const At = (d, y, w, h, dd, c) => A.p.box(w, h, dd, c, p[0] + ux * d, gy + y, p[1] + uz * d, ya);
      At(0, 2.25, 8.0, 2.7, 2.45, 0x9a9da4);                       // the box
      At(0, 1.55, 8.02, 0.5, 2.47, 0xb3262e);                      // its red band
      At(5.0, 1.55, 1.9, 2.1, 2.3, 0x8a8d94);                       // the cab, facing along Rummu tee
      At(5.97, 1.95, 0.04, 0.8, 2.0, 0x23293a);                     // the windscreen
      At(0.4, 0.62, 10.4, 0.3, 2.2, 0x2a2a2e);                      // the chassis
      for (const d of [-2.8, -1.6, 4.9]) for (const side of [-1, 1]) {
        const w = [p[0] + ux * d - uz * side * 1.0, p[1] + uz * d + ux * side * 1.0];
        A.p.box(0.95, 0.95, 0.3, 0x141417, w[0], gy + 0.48, w[1], ya);
      }
      world.addSolids([{ x: p[0] + ux * 0.6, z: p[1] + uz * 0.6, yaw: ya, hx: 5.3, hz: 1.25 }]);
    },
  });
  // the parapet: over the bridge's own deck, along the lap's left (outer) edge
  let b0 = -1, b1 = -1;
  for (let i = 2250; i < 2560; i++) if (L.LV[i] === 1) { if (b0 < 0) b0 = i; b1 = i; }
  if (b0 >= 0) {
    parts.push({
      i: (b0 + b1) >> 1, make: (A) => {
        const pts = [];
        for (let s = SS[b0] + 2; s <= SS[b1] - 2; s += 3) pts.push(at(s, -(half(s) + 0.45)));
        for (let k = 0; k + 1 < pts.length; k++) {
          const a = pts[k], b = pts[k + 1];
          const ga = world.topAt(a[0], a[1], 1), gb = world.topAt(b[0], b[1], 1);
          A.bar([a[0], a[1]], [b[0], b[1]], 0.32, 0, 0.85, 0x9c3a30, (ga + gb) / 2);
          A.bar([a[0], a[1]], [b[0], b[1]], 0.4, 0.85, 0.95, 0xa8483c, (ga + gb) / 2);
        }
      },
    });
  }
  return parts;
}

// the Pirita Keskus corner's own things (src/world/tln/piritakeskus.js, the other thread's build of 28 Nov): its sign
// gantry's two poles and the big tree on the plaza's island, [x, z, keep this far]
const KEEP_CLEAR = [[-681.6, -579.7, 2.5], [-679.8, -566.8, 2.5], [-654.8, -583.6, 3],
  [-676.0, -583.6, 1.5], [-677.7, -581.6, 1.5], [-679.4, -579.9, 1.5], [-672.3, -583.4, 1.5]];      // and three planters and the advert stand by the road
// 2. the crowd barriers round the outside of the turn onto Merivälja tee: props [kind, x, z, bearing, 0]
export function merivaljaBarriers({ at, SS, L }, bearing, clear) {
  const out = [], CROWD = 54;
  let last = null;
  for (let s = SS[2172]; s <= SS[2228]; s += 0.5) {
    const i = at(s)[4], p = clear(s, L.W[i] / 2 + 3.0, 0.4);
    if (!p || KEEP_CLEAR.some(([x, z, r]) => Math.hypot(p[0] - x, p[1] - z) < r) || (p[0] > -658 && p[0] < -651.5 && p[1] < -574 && p[1] > -592)) continue;
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 2.15) continue;
    // a panel stands across its own line: its length along the road there
    out.push([CROWD, p[0], p[1], bearing(p[2], p[3]) + 90, 0]);
    last = p;
  }
  return out;
}
