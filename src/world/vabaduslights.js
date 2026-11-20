// The LED lights on Vabadussild's arch (Martin, 20 Nov, with a night photo): a row of small, very bright
// lights along both sides of the white arch, all fading slowly from one colour to the next (blue, green,
// purple, yellow, red), the change sweeping along the arch; and the few white lamps under its crown that
// light the deck. One Points draw call with a small glow picture, built once the arch itself is.
import * as THREE from 'three';
import { VABADUS_ARCH } from './decks.js';

// blue, green, purple, yellow, red (sRGB, turned linear here: vertex colours are linear, and without this they wash out pale)
const COLOURS = [[0.1, 0.4, 1.0], [0.1, 1.0, 0.35], [0.7, 0.15, 1.0], [1.0, 0.82, 0.1], [1.0, 0.12, 0.1]]
  .map(([r, g, b]) => { const c = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace); return [c.r, c.g, c.b]; });
const STEP = 7;                     // seconds from one colour to the next
const SPACING = 1.15;               // metres between the lights along the arch
const SWEEP = 0.35;                 // how far behind (in colour steps) the far foot lags the near one

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.26, 'rgba(255,255,255,1)');
  r.addColorStop(0.36, 'rgba(255,255,255,0.5)');
  r.addColorStop(0.55, 'rgba(255,255,255,0.12)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createVabadusLights(scene) {
  let leds = null, along = null, col = null;

  function build(P) {
    const { w, h } = VABADUS_ARCH;
    // points along the arch every SPACING metres, then one on each side face
    const cum = [0];
    for (let k = 1; k < P.length; k++) cum.push(cum[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1], P[k][2] - P[k - 1][2]));
    const L = cum[cum.length - 1], ch = [P[P.length - 1][0] - P[0][0], P[P.length - 1][2] - P[0][2]], cl = Math.hypot(ch[0], ch[1]);
    const side = [-ch[1] / cl, ch[0] / cl], off = w / 2 + 0.3;       // the glow stands clear of the face, or the arch cuts it in half
    const pos = [], u = [];
    let k = 1;
    for (let s = 0.8; s < L - 0.8; s += SPACING) {
      while (k < P.length - 1 && cum[k] < s) k++;
      const a = P[k - 1], b = P[k], t = (s - cum[k - 1]) / (cum[k] - cum[k - 1]);
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t + h * 0.18, z = a[2] + (b[2] - a[2]) * t;
      for (const sg of [-1, 1]) { pos.push(x + side[0] * off * sg, y, z + side[1] * off * sg); u.push(s / L); }
    }
    along = new Float32Array(u);
    col = new Float32Array(pos.length);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const tex = glowTexture();
    leds = new THREE.Points(g, new THREE.PointsMaterial({
      // normal blending: added light would wash out to white against the white arch and the bright sky
      size: 1.3, map: tex, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, fog: false,   // bright lights shine through the haze
    }));
    leds.frustumCulled = false;
    scene.add(leds);
    // the white lamps under the crown, shining down on the deck
    const lamps = [];
    for (const f of [0.36, 0.45, 0.55, 0.64]) {
      const s = f * L;
      let j = 1;
      while (j < P.length - 1 && cum[j] < s) j++;
      const a = P[j - 1], b = P[j], t = (s - cum[j - 1]) / (cum[j] - cum[j - 1]);
      lamps.push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - h * 0.6, a[2] + (b[2] - a[2]) * t);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lamps, 3));
    const white = new THREE.Points(lg, new THREE.PointsMaterial({
      size: 2.2, map: tex, color: 0xfff6e8, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false, fog: true,
    }));
    white.frustumCulled = false;
    scene.add(white);
  }

  return {
    update(time) {
      if (!leds) { if (VABADUS_ARCH.pts) build(VABADUS_ARCH.pts); return; }
      const n = COLOURS.length;
      for (let i = 0; i < along.length; i++) {
        let c = time / STEP - along[i] * SWEEP;
        c = ((c % n) + n) % n;
        const a = COLOURS[c | 0], b = COLOURS[((c | 0) + 1) % n];
        let t = c - (c | 0);
        t = t * t * (3 - 2 * t);                                   // hold a little on each colour, then fade
        col[i * 3] = a[0] + (b[0] - a[0]) * t; col[i * 3 + 1] = a[1] + (b[1] - a[1]) * t; col[i * 3 + 2] = a[2] + (b[2] - a[2]) * t;
      }
      leds.geometry.attributes.color.needsUpdate = true;
    },
  };
}
