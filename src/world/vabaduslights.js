// The LED lights on Vabadussild's arch (Martin, 20 Nov, with a night photo): a row of small, very bright
// lights along both sides of the arch, all changing together and fading smoothly from one colour to the next
// (blue, green, purple, yellow, red, 4 s each), each with a soft glow and short rays round it; and the few
// white lamps under the crown that light the deck. Two Points draw calls over one geometry (the dot, then
// its glow added on top), built once the arch itself is.
import * as THREE from 'three';
import { VABADUS_ARCH } from './decks.js';

// blue, green, purple, yellow, red (sRGB, turned linear here, or they wash out pale)
const COLOURS = [[0.1, 0.4, 1.0], [0.1, 1.0, 0.35], [0.7, 0.15, 1.0], [1.0, 0.82, 0.1], [1.0, 0.12, 0.1]]
  .map(([r, g, b]) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace));
const STEP = 4;                     // seconds from one colour to the next (Martin: "4s")
const SPACING = 1.15;               // metres between the lights along the arch

function canvasTexture(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// the LED itself: a solid round core with a short soft edge
const dotTexture = () => canvasTexture((g) => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(255,255,255,1)');
  r.addColorStop(0.75, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
});
// its glow: a soft halo and thin rays, four long and four short
const rayTexture = () => canvasTexture((g) => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(0.12, 'rgba(255,255,255,0.45)');
  r.addColorStop(0.35, 'rgba(255,255,255,0.1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  g.translate(32, 32);
  for (let k = 0; k < 8; k++) {
    const len = k % 2 ? 17 : 31, wd = k % 2 ? 1.2 : 1.8;
    const ray = g.createLinearGradient(0, 0, len, 0);
    ray.addColorStop(0, 'rgba(255,255,255,0.85)'); ray.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = ray;
    g.beginPath(); g.moveTo(0, -wd); g.lineTo(len, 0); g.lineTo(0, wd); g.closePath(); g.fill();
    g.rotate(Math.PI / 4);
  }
});

export function createVabadusLights(scene) {
  let dots = null, glow = null;

  function build(P) {
    const { w, h } = VABADUS_ARCH;
    // points along the arch every SPACING metres, then one on each side face
    const cum = [0];
    for (let k = 1; k < P.length; k++) cum.push(cum[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1], P[k][2] - P[k - 1][2]));
    const L = cum[cum.length - 1], ch = [P[P.length - 1][0] - P[0][0], P[P.length - 1][2] - P[0][2]], cl = Math.hypot(ch[0], ch[1]);
    const side = [-ch[1] / cl, ch[0] / cl], off = w / 2 + 0.3;       // the glow stands clear of the face, or the arch cuts it in half
    const pos = [];
    let k = 1;
    for (let s = 0.8; s < L - 0.8; s += SPACING) {
      while (k < P.length - 1 && cum[k] < s) k++;
      const a = P[k - 1], b = P[k], t = (s - cum[k - 1]) / (cum[k] - cum[k - 1]);
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t + h * 0.18, z = a[2] + (b[2] - a[2]) * t;
      for (const sg of [-1, 1]) pos.push(x + side[0] * off * sg, y, z + side[1] * off * sg);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    // the dot drawn over the arch as it is (light added on a pale arch would only turn white), then its glow
    // and rays added on top, so the colour spills round it; neither is fogged: bright lights cut the haze
    dots = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.55, map: dotTexture(), transparent: true, depthWrite: false, toneMapped: false, fog: false }));
    glow = new THREE.Points(g, new THREE.PointsMaterial({
      size: 3.2, map: rayTexture(), transparent: true, opacity: 0.85, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
    }));
    for (const m of [dots, glow]) { m.frustumCulled = false; scene.add(m); }
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
      size: 2.6, map: glow.material.map, color: 0xfff6e8, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false, fog: true,
    }));
    white.frustumCulled = false;
    scene.add(white);
  }

  return {
    update(time) {
      if (!dots) { if (VABADUS_ARCH.pts) build(VABADUS_ARCH.pts); return; }
      // every light the same colour, fading smoothly from one to the next
      const n = COLOURS.length, c = ((time / STEP) % n + n) % n, i = c | 0;
      let t = c - i;
      t = t * t * (3 - 2 * t);
      dots.material.color.lerpColors(COLOURS[i], COLOURS[(i + 1) % n], t);
      glow.material.color.copy(dots.material.color);
    },
  };
}
