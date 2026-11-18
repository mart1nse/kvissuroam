// The Vanemuise / Ülikooli / Uueturu junction and Uueturu up to the Küüni plaza (Martin, 18 Nov, street
// view Aug 2024), in pastel colours: the zebra crossings round the junction, the street names painted on
// the road, and the diamond paving of Uueturu (dark slate squares between pale bands), which runs across
// the whole street from the building fronts to the green (extent checked on the 2024 kaldaerofoto).
import * as THREE from 'three';
import { createTrack } from './race.js';

const ZEBRAS = [
  { i: 2303.5, w: 4.0 },                                    // across Vanemuise, before the junction
  { i: 2314.5, w: 3.6 },                                    // across Uueturu, leaving the junction
];
// the two crossings over Ülikooli either side of the junction: centre (game x, z), along Ülikooli, length
const SIDE_ZEBRAS = [
  { c: [1591.5, 3156.0], half: 5.2 },
  { c: [1576.0, 3141.5], half: 5.0 },
];
const ULIKOOLI = [0.70, 0.71];                              // direction of Ülikooli (x, z), from the orthophoto
const NAMES = [{ text: 'Ülikooli tn', i: 2305.5, lat: 2.2 }, { text: 'Uueturu tn', i: 2318, lat: 1.6 }];
const DIAMOND = { i0: 2316, i1: 2346, left: -9.5, right: 7.5, period: 2.6, band: 0.3 };
const COL = { white: 0xfaf8ff, slate: 0xb4afd4, band: 0xece7f5 };

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// one tile of the lattice, in axes turned 45 degrees to the street: a dark square inside a pale band
function diamondTex() {
  const t = canvasTex(256, 256, (g, w, h) => {
    const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
    g.fillStyle = hex(COL.band); g.fillRect(0, 0, w, h);
    const b = (DIAMOND.band / DIAMOND.period) * w / 2;
    g.fillStyle = hex(COL.slate);
    g.fillRect(b, b, w - 2 * b, h - 2 * b);
    // faint joints between the small pavers inside the squares
    g.strokeStyle = 'rgba(70, 62, 110, 0.10)'; g.lineWidth = 1;
    for (let k = b + 16; k < w - b; k += 16) {
      g.beginPath(); g.moveTo(k, b); g.lineTo(k, h - b); g.stroke();
      g.beginPath(); g.moveTo(b, k); g.lineTo(w - b, k); g.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function nameTex(text) {
  return canvasTex(1024, 256, (g, w, h) => {
    g.font = 'bold 200px "Arial Narrow", Arial, sans-serif';
    g.textBaseline = 'middle'; g.textAlign = 'center';
    g.lineWidth = 14; g.strokeStyle = 'rgba(70, 60, 95, 0.35)';
    g.strokeText(text, w / 2, h / 2 + 10);
    g.fillStyle = '#ffffff';
    g.fillText(text, w / 2, h / 2 + 10);
  });
}

// before the road markings are built: no generated centre line through the junction and on Uueturu
export function uueturuVectors(vectors) {
  const track = createTrack(), prev = vectors.markSkip;
  vectors.markSkip = (x, z) => {
    if (prev && prev(x, z)) return true;
    const n = track.nearest(x, z, 2320);
    return n.i >= 2300 && n.i <= 2350 && n.d < track.HW[n.i] + 1;
  };
}

export function createUueturu(world, group) {
  const track = createTrack();
  const lerpP = (fi) => {
    const i = Math.floor(fi), t = fi - i, a = track.P[i], b = track.P[i + 1];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  const tanAt = (fi) => track.tan[Math.round(fi)];
  const markMat = new THREE.MeshLambertMaterial({ color: COL.white, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, side: THREE.DoubleSide });
  let built = false;

  // a flat quad on the ground: centre, unit axis u (length 2*hu) and v (2*hv), split so it follows the ground
  function quad(pos, cx, cz, ux, uz, hu, hv, lift) {
    const vx = -uz, vz = ux, n = Math.max(1, Math.ceil(hu)), m = Math.max(1, Math.ceil(hv));
    const P = (a, b) => { const x = cx + ux * a + vx * b, z = cz + uz * a + vz * b; return [x, world.heightAt(x, z) + lift, z]; };
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const a0 = -hu + 2 * hu * i / n, a1 = -hu + 2 * hu * (i + 1) / n, b0 = -hv + 2 * hv * j / m, b1 = -hv + 2 * hv * (j + 1) / m;
      pos.push(...P(a0, b0), ...P(a0, b1), ...P(a1, b0), ...P(a1, b0), ...P(a0, b1), ...P(a1, b1));
    }
  }
  function meshFrom(pos, mat, uv) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const nor = new Float32Array(pos.length);
    for (let k = 1; k < nor.length; k += 3) nor[k] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    group.add(m);
    return m;
  }

  // a zebra: stripes 0.5 m wide every 1.0 m across the road, each `len` long in the direction of travel
  function zebra(pos, cx, cz, ux, uz, half, len) {
    const rx = -uz, rz = ux;
    for (let o = -half + 0.25; o <= half - 0.25; o += 1.0) quad(pos, cx + rx * o, cz + rz * o, ux, uz, len / 2, 0.25, 0.075);
  }

  function build() {
    built = true;
    // ---- the diamond paving: a grid over the street, clipped at buildings, uv in the street's own axes
    {
      const pos = [], uv = [];
      const D = DIAMOND, [ox, oz] = track.P[D.i0], [ax, az] = tanAt((D.i0 + D.i1) / 2);
      for (let i = D.i0; i < D.i1; i++) {
        const fade0 = Math.min(1, (i - D.i0 + 1) / 2), fade1 = Math.min(1, (D.i1 - i) / 3);
        const side = (k, lat) => {
          const [tx, tz] = track.tan[k];
          return [track.P[k][0] - tz * lat, track.P[k][1] + tx * lat];
        };
        for (let lat = D.left; lat < D.right; lat += 1) {
          if (fade0 * fade1 < 1 && Math.abs(lat + 0.5) > track.HW[i] + 0.5) continue;
          const c = side(i, lat + 0.5);
          if (world.sdfAt(c[0], c[1]) < 0.3) continue;
          const p = [side(i, lat), side(i, lat + 1), side(i + 1, lat), side(i + 1, lat + 1)];
          const V = (q) => {
            const dx = q[0] - ox, dz = q[1] - oz;
            pos.push(q[0], world.heightAt(q[0], q[1]) + 0.07, q[1]);
            const a = dx * ax + dz * az, b = dx * -az + dz * ax;          // along and across the street
            uv.push((a + b) / Math.SQRT2 / D.period, (a - b) / Math.SQRT2 / D.period);
          };
          V(p[0]); V(p[1]); V(p[2]); V(p[2]); V(p[1]); V(p[3]);
        }
      }
      meshFrom(pos, new THREE.MeshLambertMaterial({ map: diamondTex(), polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide }), uv);
    }
    // ---- zebras on the lap and over Ülikooli
    const pos = [];
    for (const z of ZEBRAS) {
      const [cx, cz] = lerpP(z.i), [ux, uz] = tanAt(z.i);
      zebra(pos, cx, cz, ux, uz, track.HW[Math.round(z.i)] - 0.2, z.w);
    }
    for (const z of SIDE_ZEBRAS) zebra(pos, z.c[0], z.c[1], ULIKOOLI[0], ULIKOOLI[1], z.half, 3.4);
    meshFrom(pos, markMat);
    // ---- street names along the lane, read from behind, letter tops to the left
    for (const n of NAMES) {
      const [px, pz] = lerpP(n.i), [tx, tz] = tanAt(n.i);
      const x = px - tz * n.lat, z = pz + tx * n.lat;
      const g = new THREE.PlaneGeometry(5.0, 1.3, 6, 1);
      g.rotateX(-Math.PI / 2);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const lx = p.getX(k), lz = p.getZ(k), wx = x + tx * lx - tz * lz, wz = z + tz * lx + tx * lz;
        p.setXYZ(k, wx, world.heightAt(wx, wz) + 0.085, wz);
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: nameTex(n.text), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7 }));
      m.receiveShadow = true;
      group.add(m);
    }
  }

  const ref = track.P[2318];
  return {
    update(x, z) {
      if (built || Math.hypot(ref[0] - x, ref[1] - z) > 700) return;
      if ([2296, 2318, 2346].every((i) => world.ready(...track.P[i])) && SIDE_ZEBRAS.every((s) => world.ready(...s.c))) build();
    },
  };
}
