// The arches over a rally stage's start and finish (Martin 26 Nov 2026: "Add rally start and finish arcs. Start
// one ideally should be shown somewhat also in the lights out view initially. Both of them would need a bit of
// room too as I would potentially like to add some ads to them"). A black arch with cut corners, as wide as the
// road and the grass beside it, with nothing on its faces: the beam (BEAM m high, the whole span) and the two legs
// (LEG m wide) are the room for adverts, on both sides, and `panels` below says where each lies. Its word stands
// on a small board on top of the beam, so that the beam stays free. A line of light runs round the opening and
// round the outside.
// Each arch is one mesh of a few hundred triangles (the body, the lines of light and the word together: the
// lowest graphics level counts every piece it draws), and both share one material and one small picture, the
// two words and a white patch that everything else takes its plain colour through. The legs are solid
// (world.addSolids).
import * as THREE from 'three';
import { paintScale } from '../world/paintscale.js';
import { still } from '../still.js';

const LEG = 1.1, DEEP = 0.9, CLEAR = 4.9, BEAM = 1.5;      // a leg's width, the arch's depth along the road, the height under the beam, the beam
const CUT = 0.9, CUT_IN = 0.5;                              // the cut corners outside and in the opening
const FOOT = 1.5;                                           // the legs go this far into the ground (a slope under them)
const LINE = 0.09;                                          // the lines of light
const BOARD_W = 4.4, BOARD_H = 0.7;                         // the word's board on top
const BLACK = 0x0b0b10, CYAN = 0x38d6ff, PINK = 0xff3fd0;
const WORDS = ['START', 'FINISH'];

// the picture: the words one under the other, and under them a white patch (PLAIN) for the faces of one colour
const ROW = 80, GAP = 16, TALL = ROW * WORDS.length + GAP * 2;
const PLAIN = [0.5, GAP / 2 / TALL];
let mat = null;
function material() {
  if (mat) return mat;
  const k = paintScale(), w = Math.round(512 * k), h = Math.round(TALL * k);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#0d0d13'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff'; g.fillRect(0, h - Math.round(GAP * k), w, Math.round(GAP * k));
  g.font = `italic 900 ${Math.round(62 * k)}px "Avenir Next", "Futura", "Trebuchet MS", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  try { g.letterSpacing = `${Math.round(10 * k)}px`; } catch { /* an old browser: the letters closer */ }
  g.shadowColor = '#38d6ff'; g.shadowBlur = 10 * k;
  g.fillStyle = '#f2fbff';
  WORDS.forEach((t, i) => g.fillText(t, w / 2, (ROW * (i + 0.5) + 3) * k));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  mat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true });
  return mat;
}

// the arch's outline seen along the road: x across, y up from the ground at its middle; `a` is half the opening
function outline(a, grow) {
  // (grow > 0: the same outline that much further out, for the lines of light; 0.414 = tan 22.5°, a cut corner's share)
  const o = a + LEG + grow, top = CLEAR + BEAM + grow, c = CUT + grow * 0.414;
  return [[-o, -FOOT], [-o, top - c], [-o + c, top], [o - c, top], [o, top - c], [o, -FOOT]];
}
function opening(a, grow) {
  const i = a - grow, top = CLEAR - grow, c = CUT_IN - grow * 0.414;
  return [[i, -FOOT], [i, top - c], [i - c, top], [-i + c, top], [-i, top - c], [-i, -FOOT]];
}
function slab(pts, depth) {
  const sh = new THREE.Shape();
  pts.forEach(([x, y], k) => (k ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return g.toNonIndexed();
}

// x, z: the middle of the road under the arch; tx, tz: the way the stage runs there; half: from the road's middle
// to the inside of each leg; word: 0 START, 1 FINISH. Returns the meshes' group and `panels`, the free faces.
export function buildArch({ group, world, x, z, tx, tz, half, word }) {
  const yaw = Math.atan2(tx, tz), a = half;
  // (the ground at the legs and the middle: the arch stands on the highest of them, its feet reach down)
  const mid = half + LEG / 2, rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const y = Math.max(world.heightAt(x, z), world.heightAt(x + rx * mid, z + rz * mid), world.heightAt(x - rx * mid, z - rz * mid));
  const g = still(new THREE.Group());
  g.position.set(x, y, z);
  g.rotation.y = yaw;

  // corners gathered into one mesh: [positions, colour, uv or null for the white patch]
  const P = [], C = [], U = [], col = new THREE.Color();
  const put = (geo, hex, uv) => {
    const pos = geo.attributes.position.array;
    col.setHex(hex);
    for (let i = 0; i < pos.length; i += 3) { P.push(pos[i], pos[i + 1], pos[i + 2]); C.push(col.r, col.g, col.b); }
    if (uv) U.push(...uv); else for (let i = 0; i < pos.length; i += 3) U.push(PLAIN[0], PLAIN[1]);
    geo.dispose();
  };
  // the body: one flat arch, and the word's board on top
  const by = CLEAR + BEAM + BOARD_H / 2;
  put(slab([...outline(a, 0), ...opening(a, 0)], DEEP), BLACK);
  put(new THREE.BoxGeometry(BOARD_W + 0.16, BOARD_H + 0.08, 0.2).translate(0, by, 0).toNonIndexed(), BLACK);
  // the lines of light: round the opening and round the outside, a hair proud of both faces
  put(slab([...opening(a, 0), ...opening(a, -LINE).reverse()], DEEP + 0.03), CYAN);
  put(slab([...outline(a, 0), ...outline(a, -LINE).reverse()], DEEP + 0.03), PINK);
  // the word, on both faces of its board (the first is the face the cars come up to)
  const v1 = 1 - word * ROW / TALL, v0 = 1 - (word + 1) * ROW / TALL, hw = BOARD_W / 2, hh = BOARD_H / 2, d = 0.115;
  const quad = (x0, x1, z) => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([x0, by - hh, z, x1, by - hh, z, x1, by + hh, z, x0, by - hh, z, x1, by + hh, z, x0, by + hh, z], 3));
  const wuv = [0, v0, 1, v0, 1, v1, 0, v0, 1, v1, 0, v1];
  put(quad(hw, -hw, -d), 0xffffff, wuv);
  put(quad(-hw, hw, d), 0xffffff, wuv);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  const mesh = new THREE.Mesh(geo, material());
  mesh.castShadow = true;
  g.add(mesh);

  group.add(g);
  // the legs stop a car
  world.addSolids([-1, 1].map((s) => ({ x: x + rx * mid * s, z: z + rz * mid * s, yaw, hx: LEG / 2, hz: DEEP / 2 })));
  return {
    group: g,
    // the faces left free for adverts, on both sides of the arch: [x0, y0, x1, y1] in the arch's own metres
    // (x across the road from its middle, y up from its foot)
    panels: {
      beam: [-(a - CUT_IN), CLEAR + LINE, a - CUT_IN, CLEAR + BEAM - LINE],
      legs: [[-(a + LEG) + LINE, 0, -a - LINE, CLEAR - CUT_IN], [a + LINE, 0, a + LEG - LINE, CLEAR - CUT_IN]],
    },
  };
}
