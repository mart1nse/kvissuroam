// The trees by the Pirita-Kose lap padded for the race, as in the mid 2000s (Martin, 28 Nov 2026, with an onboard lap of
// the 2005 Pirita race: "the trees have white bags for protection up to 3m of the tree"). In the video every tree within
// a few metres of the road's edge stands in sacks of straw: two (sometimes three) white or pale cream sacks stacked round
// the trunk, each tied round its middle with string, from the ground to 1.7 to 2.6 m. On Rummu tee towards the start a
// few are in yellow sacks. Built with each square's trees (scenery.js), one instanced mesh per square: no extra build.
import * as THREE from 'three';
import { lapBeside } from './lapnear.js';
import LAP from '../../race/pirita.json';

const REACH = 4.5;                    // a tree this near the road's edge (m, from the trunk) gets its sacks
const P = LAP.pts;
// Rummu tee from the corner to Kose tee: the yellow sacks (lap points 2580 to the end and 0 to 75)
const RUMMU = (() => {
  const near = (x, z) => {
    let b = Infinity, bi = 0;
    for (let i = 0; i < P.length; i += 4) { const d = (P[i][0] - x) ** 2 + (P[i][1] - z) ** 2; if (d < b) { b = d; bi = i; } }
    return bi;
  };
  return (x, z) => { const i = near(x, z); return i >= 2580 || i < 75; };
})();

// the lap's box, 30 m out: most squares of the city have no tree in it, and are passed over at once
const BOX = P.reduce((b, [x, z]) => [Math.min(b[0], x - 30), Math.min(b[1], z - 30), Math.max(b[2], x + 30), Math.max(b[3], z + 30)], [Infinity, Infinity, -Infinity, -Infinity]);
const inBox = (x, z) => x > BOX[0] && x < BOX[2] && z > BOX[1] && z < BOX[3];

let geo = null, mat = null;
// a unit stack (radius 1 at the sack's belly, height 1) of two sacks, each pinched at its tie and rounded at its ends
function stackGeometry() {
  const prof = [[0.0, 0.0], [0.86, 0.0], [1.0, 0.07], [1.0, 0.2], [0.9, 0.25], [1.0, 0.3], [0.97, 0.47], [0.84, 0.5],
    [1.0, 0.54], [1.0, 0.7], [0.9, 0.75], [1.0, 0.8], [0.95, 0.96], [0.72, 1.0], [0.45, 1.0]];
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 7);
  g.computeVertexNormals();
  // the strings and the sacks' shading: darker at a tie and where one sack sits on the other
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), r = Math.hypot(pos.getX(i), pos.getZ(i));
    let v = 1;
    if (Math.abs(y - 0.25) < 0.02 || Math.abs(y - 0.75) < 0.02) v = 0.62;          // the tie round each sack's middle
    else if (Math.abs(y - 0.5) < 0.02) v = 0.74;                                    // the seam between the sacks
    else if (r < 0.9) v = 0.88;
    col[i * 3] = v; col[i * 3 + 1] = v * (v < 0.7 ? 0.8 : 1); col[i * 3 + 2] = v * (v < 0.7 ? 0.72 : 1);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// rec: the square's trees [x, y, z, height, crown, kind] * n; keep(i): whether tree i is drawn. Returns a mesh or null.
export function treeBags(rec, n, keep) {
  const list = [];
  for (let i = 0; i < n; i++) {
    if (!inBox(rec[i * 6], rec[i * 6 + 2]) || !keep(i)) continue;
    const by = lapBeside(rec[i * 6], rec[i * 6 + 2]);
    if (by && by[0] < REACH && by[0] > -1) list.push(i);
  }
  if (!list.length) return null;
  if (!geo) { geo = stackGeometry(); mat = new THREE.MeshLambertMaterial({ vertexColors: true }); }
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const c = new THREE.Color();
  list.forEach((i, k) => {
    const x = rec[i * 6], z = rec[i * 6 + 2], crown = rec[i * 6 + 4];
    const h = Math.abs(Math.sin(x * 3.17 + z * 5.71) * 9631.7) % 1, h2 = Math.abs(Math.sin(x * 7.3 + z * 1.9) * 4177.3) % 1;
    // round the stem (a pine's is about 0.3 x its crown / 8 in radius at two metres; realtrees.js) and the straw in it
    const r = Math.min(0.52, Math.max(0.3, 0.3 * crown / 8 + 0.13));
    const tall = h < 0.25 ? 2.5 + h2 * 0.2 : 1.7 + h2 * 0.5;
    p.set(x, rec[i * 6 + 1] - 0.2, z);
    q.setFromAxisAngle(up, h * 6.28);
    s.set(r, tall, r);
    im.setMatrixAt(k, m.compose(p, q, s));
    // white, pale cream or (on Rummu tee, one in three) yellow
    if (h2 < 0.33 && RUMMU(x, z)) c.setRGB(0.95, 0.78, 0.22);
    else if (h2 > 0.7) c.setRGB(0.9, 0.86, 0.74);
    else c.setRGB(0.93, 0.92, 0.9);
    im.setColorAt(k, c);
  });
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.matrixAutoUpdate = false;
  im.castShadow = false;
  return im;
}
