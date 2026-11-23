// Thumbs up between players (Martin, 2026-11-23: like a Ride On in Zwift or kudos in Strava). The 👍 next to a
// name in the online list sends one; the receiver's car then shows a neon thumbs up with the sender's colour
// dot and name in its back window for five seconds, like an LED sign behind the glass. Cars without a back
// window in view (Carrera GT, F40) show it on the engine cover; on the light Carrera GT it is drawn in deeper
// magenta and plum instead of light (no dark plate behind it, Martin asked for none). The Impreza's wing
// crosses the window, so its thumb is bigger and the name goes under the wing line.
// Everybody near sees the sign on that car, the sender too, as their confirmation.
//
// Light by design: one painted 512 px picture per sender (0.6 of that on phones, paintScale), painted in the
// work queue a step a frame and kept for the next time (the last few), one flat piece drawn for five seconds.
import * as THREE from 'three';
import { jobs } from './jobs.js';
import { paintScale } from './world/paintscale.js';

export const KUDOS_S = 5;              // how long the sign shows
export const KUDOS_GAP_S = 30;         // one sender to one receiver: once in this long (the server holds to it too)

// where the sign sits on each car: centre (y up, z back, metres in the car's own frame), size, and its lean
// back from upright (radians). Measured on the game's car models in the car viewer.
const SPOTS = {
  w201: { y: 1.17, z: 1.13, s: 0.5, tilt: 1.0 },
  audi200: { y: 1.2, z: 2.0, s: 0.55, tilt: 1.1 },
  passat: { y: 1.28, z: 2.09, s: 0.44, tilt: 0.54 },
  crv: { y: 1.32, z: 2.19, s: 0.42, tilt: 0.38 },
  enyaq: { y: 1.3, z: 2.23, s: 0.42, tilt: 0.61 },
  rav4: { y: 1.35, z: 2.165, s: 0.4, tilt: 0.4 },
  mazda6: { y: 1.235, z: 2.175, s: 0.42, tilt: 0.98 },
  bz4x: { y: 1.33, z: 2.3, s: 0.42, tilt: 0.54 },
  m3: { y: 1.22, z: 1.5, s: 0.66, tilt: 1.15 },
  impreza: { y: 1.15, z: 1.36, s: 0.6, tilt: 1.08 },
  f40: { y: 1.06, z: 1.15, s: 0.72, tilt: 1.47 },
  cgt: { y: 0.99, z: 1.35, s: 0.72, tilt: 1.45, dark: true },
  bus: { y: 1.95, z: 6.36, s: 1.0, tilt: 0 },
};
const NEON = '#ff2bd6';
const CACHE = 4;                        // painted signs kept for a sender who sends again

// the thumbs up, on a 100 x 100 grid: fist and thumb in one line, the cuff, three finger lines
function thumbPath(g, s, ox, oy) {
  const P = (x, y) => [ox + x * s, oy + y * s];
  g.beginPath();
  g.moveTo(...P(30, 46)); g.lineTo(...P(42, 22)); g.quadraticCurveTo(...P(46, 11), ...P(53, 15)); g.quadraticCurveTo(...P(59, 20), ...P(56, 31));
  g.lineTo(...P(53, 42)); g.lineTo(...P(80, 42)); g.quadraticCurveTo(...P(88, 42), ...P(87, 49)); g.quadraticCurveTo(...P(87, 54), ...P(82, 55));
  g.quadraticCurveTo(...P(87, 57), ...P(86, 62)); g.quadraticCurveTo(...P(85, 67), ...P(80, 67)); g.quadraticCurveTo(...P(85, 69), ...P(84, 73));
  g.quadraticCurveTo(...P(83, 78), ...P(78, 78)); g.quadraticCurveTo(...P(82, 80), ...P(81, 84)); g.quadraticCurveTo(...P(80, 88), ...P(74, 88));
  g.lineTo(...P(30, 88)); g.closePath();
  g.moveTo(...P(15, 46)); g.lineTo(...P(25, 46)); g.lineTo(...P(25, 90)); g.lineTo(...P(15, 90)); g.closePath();
  for (const [a, b, y] of [[62, 82, 55], [62, 80, 67], [62, 78, 78]]) { g.moveTo(...P(a, y)); g.lineTo(...P(b, y)); }
}

// one sign: glowing tube thumb, then the sender's dot and name under it. `dark`: for light paint
function paintSign(g, W, name, colour, dark, big) {
  const k = W / 512;
  g.clearRect(0, 0, W, W);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const s = (big ? 3.7 : 3.25) * k, ox = W / 2 - 51 * s, oy = (big ? -30 : -22) * k;
  const layers = dark ? [[22, 0.45, '#7a0a64', 26], [12, 1, '#a3108a', 10], [4, 1, '#e02cc0', 2]] : [[22, 0.35, NEON, 30], [12, 0.9, NEON, 14], [4, 1, '#fff', 4]];
  for (const [w, a, c, blur] of layers) {
    g.globalAlpha = a; g.strokeStyle = c; g.lineWidth = w * k; g.shadowColor = dark ? '#7a0a64' : NEON; g.shadowBlur = blur * k;
    thumbPath(g, s, ox, oy); g.stroke();
  }
  g.globalAlpha = 1;
  let fs = 100;
  g.font = `400 ${fs * k}px "Russo One", sans-serif`;
  const r = 26 * k, gap = 20 * k, room = W - 40 * k;
  let tw = g.measureText(name).width;
  if (tw + 2 * r + gap > room) { fs = Math.max(40, fs * (room - 2 * r - gap) / tw); g.font = `400 ${fs * k}px "Russo One", sans-serif`; tw = g.measureText(name).width; }
  g.textBaseline = 'middle';
  const x0 = W / 2 - (tw + 2 * r + gap) / 2, y = (big ? 425 : 400) * k;
  g.shadowColor = colour; g.shadowBlur = 24 * k; g.fillStyle = colour;
  g.beginPath(); g.arc(x0 + r, y, r, 0, Math.PI * 2); g.fill();
  g.shadowColor = dark ? '#7a0a64' : NEON; g.shadowBlur = (dark ? 8 : 16) * k; g.fillStyle = dark ? '#5a0a50' : '#fff';
  g.fillText(name, x0 + 2 * r + gap, y + 3 * k);
  g.shadowBlur = 0;
}

export function createKudos() {
  const plane = new THREE.PlaneGeometry(1, 1);
  const signs = new Map();             // key -> { tex, used }
  const live = [];                     // { mesh, t, parent }
  let fontReady = false;
  try { document.fonts?.load('400 100px "Russo One"').then(() => { fontReady = true; }, () => { fontReady = true; }); } catch { fontReady = true; }

  function evict() {
    while (signs.size > CACHE) {
      let old = null;
      for (const [k, v] of signs) if (!v.busy && (!old || v.used < signs.get(old).used)) old = k;
      if (!old) return;
      signs.get(old).tex.dispose(); signs.delete(old);
    }
  }

  // put a sign on a car (its model group and car id); from: { name, colour }
  function show(group, carId, from) {
    const spot = SPOTS[carId];
    if (!group || !spot || !from?.name) return;
    const key = `${from.name}|${from.colour}|${spot.dark ? 1 : 0}|${carId === 'impreza' ? 1 : 0}`;
    // the same sign on this car already: it starts again
    for (const l of live) if (l.mesh.parent === group && l.key === key) { l.t = 0.45; return; }
    jobs.add(function* kudosSign() {
      let sign = signs.get(key);
      if (!sign) {
        for (let i = 0; i < 30 && !fontReady; i++) yield;            // (Russo One, half a second at most)
        yield 'frame';
        const W = Math.round(512 * Math.min(1, Math.max(0.5, paintScale())));
        const cv = document.createElement('canvas'); cv.width = W; cv.height = W;
        paintSign(cv.getContext('2d'), W, from.name, from.colour || '#2ff3ff', !!spot.dark, carId === 'impreza');
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
        tex.userData.keepImage = true;   // (phones: kept as it is, at most CACHE small canvases; freed here in evict, see phonetex.js)
        sign = { tex, used: 0 };
        signs.set(key, sign);
        yield 'frame';
        jobs.upload(tex);
        yield;
      }
      sign.used = performance.now(); sign.busy = true;
      evict();
      for (const l of live) if (l.mesh.parent === group) l.t = Math.max(l.t, KUDOS_S - 0.25);   // (another sender's on this car: it gives way)
      const mat = new THREE.MeshBasicMaterial({ map: sign.tex, transparent: true, depthWrite: false, toneMapped: false, opacity: 0,
        blending: spot.dark ? THREE.NormalBlending : THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      const mesh = new THREE.Mesh(plane, mat);
      mesh.name = 'thumbs up';
      mesh.position.set(0, spot.y, spot.z);
      mesh.rotation.x = -spot.tilt;
      mesh.scale.set(spot.s, spot.s, 1);
      mesh.renderOrder = 2;
      mesh.layers.enable(1);
      group.add(mesh);
      live.push({ mesh, t: 0, key, sign });
    }, 'thumbs up');
  }

  // each frame: a neon tube flickering on, five seconds lit, then fading
  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const l = live[i];
      l.t += dt;
      const t = l.t, m = l.mesh.material;
      let a = t < 0.45 ? [1, 0.25, 1, 0.4, 1][Math.floor(t / 0.09)] ?? 1 : 1;
      if (t > KUDOS_S - 0.6) a *= Math.max(0, (KUDOS_S - t) / 0.6);
      m.opacity = a;
      if (t >= KUDOS_S || !l.mesh.parent) {
        l.mesh.parent?.remove(l.mesh);
        m.dispose();
        l.sign.busy = live.some((o, j) => j !== i && o.sign === l.sign);
        live.splice(i, 1);
      }
    }
  }

  return { show, update, get showing() { return live.length; } };
}
