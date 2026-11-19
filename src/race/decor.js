// Track furniture: glowing chevron boards hovering over each corner (pointing the way to turn)
// and a start/finish gantry with a chequered line across Küüni. Built as the ground loads.
import * as THREE from 'three';

const TURN = 0.5;              // radians of heading change over ~30 m that count as a corner

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// three chevrons pointing right, glowing pink on a faint dark plate
function chevronTex() {
  return canvasTex(512, 192, (g, w, h) => {
    g.fillStyle = 'rgba(18,6,43,0.35)';
    g.fillRect(0, 0, w, h);
    g.lineJoin = 'round'; g.lineCap = 'round';
    for (const [blur, col, lw] of [[28, 'rgba(255,43,214,0.9)', 30], [0, '#ffd6f4', 14]]) {
      g.shadowColor = '#ff2bd6'; g.shadowBlur = blur;
      g.strokeStyle = col; g.lineWidth = lw;
      for (let k = 0; k < 3; k++) {
        const x = 110 + k * 130;
        g.beginPath(); g.moveTo(x, 40); g.lineTo(x + 70, h / 2); g.lineTo(x, h - 40); g.stroke();
      }
    }
  });
}

// the first board the player sees from the spawn: a big START LINE billboard on two posts at the
// first left turn, with left chevrons and the distance to the line
function startBoardTex(dist) {
  return canvasTex(1024, 432, (g, w, h) => {
    g.fillStyle = 'rgba(18,6,43,0.82)';
    g.fillRect(0, 0, w, h);
    // chequered strips top and bottom
    for (let i = 0; i < 32; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? 'rgba(20,9,46,0.95)' : 'rgba(244,240,255,0.9)';
      g.fillRect(i * 32, j * 16, 32, 16);
      g.fillRect(i * 32, h - 32 + j * 16, 32, 16);
    }
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = '#ff2bd6'; g.shadowColor = '#ff2bd6'; g.shadowBlur = 22; g.lineWidth = 8;
    g.strokeRect(10, 42, w - 20, h - 84);
    // three chevrons pointing left
    for (const [blur, col, lw] of [[26, 'rgba(255,43,214,0.95)', 26], [0, '#ffd6f4', 12]]) {
      g.shadowBlur = blur; g.strokeStyle = col; g.lineWidth = lw;
      for (let k = 0; k < 3; k++) {
        const x = 120 + k * 62;
        g.beginPath(); g.moveTo(x, 120); g.lineTo(x - 52, 196); g.lineTo(x, 272); g.stroke();
      }
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'italic 900 128px "Avenir Next", "Futura", "Trebuchet MS", sans-serif';
    g.shadowColor = '#ff2bd6'; g.shadowBlur = 0;
    g.fillStyle = '#ff2bd6'; g.fillText('START LINE', 626, 186);      // hot offset shadow
    g.shadowColor = '#2ff3ff'; g.shadowBlur = 20;
    g.fillStyle = '#2ff3ff'; g.fillText('START LINE', 620, 180);
    g.font = 'italic 800 46px "Avenir Next", "Futura", "Trebuchet MS", sans-serif';
    g.shadowColor = '#ff2bd6'; g.shadowBlur = 14;
    g.fillStyle = '#ffd45e';
    g.fillText(`TURN LEFT · LAP STARTS IN ${dist} M`, w / 2, 318);
  });
}

function checkerTex(nx, ny) {
  return canvasTex(nx * 32, ny * 32, (g) => {
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      g.fillStyle = (i + j) % 2 ? '#14092e' : '#f4f0ff';
      g.fillRect(i * 32, j * 32, 32, 32);
    }
  });
}

function bannerTex() {
  return canvasTex(1024, 128, (g, w, h) => {
    for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) {
      g.fillStyle = (i + j) % 2 ? 'rgba(20,9,46,0.85)' : 'rgba(244,240,255,0.85)';
      if (i < 3 || i > 28) g.fillRect(i * 32, j * 32, 32, 32);
    }
    g.fillStyle = 'rgba(18,6,43,0.75)';
    g.fillRect(96, 0, w - 192, h);
    g.font = 'italic 900 78px "Avenir Next", "Futura", "Trebuchet MS", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ff2bd6'; g.shadowBlur = 24;
    g.fillStyle = '#2ff3ff';
    g.fillText('START · FINISH', w / 2, h / 2 + 4);
  });
}

// The Lai -> Vabaduse -> Emajõe junction is two left turns in a row. Since its outline follows the rebuilt
// kerbs (19 Nov) the second, by the bridge, measures sharper, but the corner board and the corner
// clearing (SPECIAL 920 in trackside.js) belong at the first, the turn off Lai.
const PINNED = [920];

export function findCorners(track) {
  const { P, N } = track;
  const head = (i) => {
    const a = P[(i - 8 + N) % N], b = P[i], c = P[(i + 8) % N];
    let d = Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]);
    return Math.atan2(Math.sin(d), Math.cos(d));
  };
  const turn = Array.from({ length: N }, (_, i) => head(i));
  const out = [];
  for (let i = 0; i < N; i++) {
    const a = turn[i];
    if (Math.abs(a) < TURN) continue;
    let peak = true;
    for (let k = -20; k <= 20 && peak; k++) if (Math.abs(turn[(i + k + N) % N]) > Math.abs(a)) peak = false;
    if (peak) out.push({ i, dir: Math.sign(a) });        // +1: right turn (z is south), -1: left
  }
  // corners placed by hand: they replace whatever the search found within 20 points of them
  for (const p of PINNED) {
    const k = out.findIndex((c) => Math.min(Math.abs(c.i - p), N - Math.abs(c.i - p)) <= 20);
    const c = { i: p, dir: Math.sign(turn[p]) };
    if (k >= 0) out[k] = c; else out.push(c);
  }
  out.sort((a, b) => a.i - b.i);
  return out;
}

const START_LEFT = 7;                  // metres the START LINE billboard sits left of its old spot
const START_BACK = 12;                 // and metres further on, past the corner (Martin, 19 Nov: 10-15 m back)

// where the big START LINE billboard stands: beyond the outside kerb of the first corner after the spawn
// (a left turn), on two posts (Martin, 2026-11-17: moved left towards the road so the trees on the right no longer hide it)
export function startBoardSpot(track, corners = findCorners(track)) {
  const { P, HW, N, tan } = track;
  const sp = track.spawnI ?? 0;
  const c = corners.reduce((b, k) => (((k.i - sp + N) % N) < ((b.i - sp + N) % N) ? k : b), corners[0]);
  if (!c || c.dir >= 0) return null;
  const tin = tan[(c.i - 14 + N) % N], [px, pz] = P[c.i];
  const ox = -tin[1], oz = tin[0];                          // outward side of the left turn
  const o2 = HW[c.i] + 3.2 - START_LEFT, back = HW[c.i] * 0.4 + START_BACK;
  return { corner: c, x: px + tin[0] * back + ox * o2, z: pz + tin[1] * back + oz * o2, yaw: Math.atan2(-tin[0], -tin[1]) };
}

export function createDecor(track, world) {
  const { P, HW, N, tan } = track;
  const group = new THREE.Group();          // corner boards: shown with the kerb glow
  const fixed = new THREE.Group();          // the start/finish gantry: always shown
  const glow = (map, opacity = 1) => new THREE.MeshBasicMaterial({
    map, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, fog: true,
  });
  const chev = chevronTex();
  const matR = glow(chev);
  const chevL = chev.clone(); chevL.repeat.x = -1; chevL.offset.x = 1; chevL.wrapS = THREE.RepeatWrapping; chevL.needsUpdate = true;
  const matL = glow(chevL);
  const boardGeo = new THREE.PlaneGeometry(4.2, 1.6);

  const items = [];
  // the first corner after the spawn gets the START · FINISH board
  const corners = findCorners(track);
  const sp = track.spawnI ?? 0;
  const first = corners.reduce((b, c) => (((c.i - sp + N) % N) < ((b.i - sp + N) % N) ? c : b), corners[0]);
  const toLine = Math.round((track.length - track.s[first.i]) / 10) * 10;
  const startTex = startBoardTex(toLine);
  // the billboard is not additive: it has to read as a solid sign in daylight
  const matStart = new THREE.MeshBasicMaterial({ map: startTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true });
  for (const c of corners) {
    // the board stands at the corner, over the outside kerb, facing the cars coming in
    const iin = (c.i - 14 + N) % N;
    const tin = tan[iin];
    const [px, pz] = P[c.i];
    const ox = tin[1] * c.dir, oz = -tin[0] * c.dir;        // outward side of the turn (left of travel for a right turn)
    const off = HW[c.i] * 0.55;
    if (c === first && c.dir < 0) {
      const { x, z, yaw } = startBoardSpot(track, corners);
      items.push({ x, z, yaw, big: true, mesh: null, phase: 0 });
      continue;
    }
    items.push({
      x: px + tin[0] * HW[c.i] * 0.6 + ox * off, z: pz + tin[1] * HW[c.i] * 0.6 + oz * off,
      yaw: Math.atan2(-tin[0], -tin[1]),     // plane normal (+z local) points back along the approach
      mat: c.dir > 0 ? matR : matL, geo: boardGeo, mesh: null, phase: c.i * 0.37,
    });
  }

  const BW = 12, BH = BW * 432 / 1024, LIFT = 4.6;      // billboard size and clearance (m)
  const postMat = new THREE.MeshBasicMaterial({ color: 0x2a1450, fog: true });
  const postGlow = new THREE.MeshBasicMaterial({ color: 0xff2bd6, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
  function buildBig(it) {
    const g = new THREE.Group();
    const y0 = world.topAt(it.x, it.z, 0);
    g.position.set(it.x, y0, it.z);
    g.rotation.y = it.yaw;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), matStart);
    sign.position.y = LIFT + BH / 2;
    sign.renderOrder = 3;
    g.add(sign);
    const back = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.3, BH + 0.3, 0.12), postMat);
    back.position.set(0, LIFT + BH / 2, -0.1);
    g.add(back);
    for (const sx of [-1, 1]) {
      const H = LIFT + BH;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, H, 0.32), postMat);
      post.position.set(sx * BW * 0.36, H / 2 - 0.4, -0.2);
      g.add(post);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, LIFT, 0.34), postGlow);
      strip.position.set(sx * BW * 0.36, LIFT / 2 - 0.2, -0.2);
      g.add(strip);
    }
    it.mesh = g;
    fixed.add(g);                // always shown, like the start gantry
  }

  function buildBoard(it) {
    if (it.big) return buildBig(it);
    const m = new THREE.Mesh(it.geo, it.mat);
    it.y = world.topAt(it.x, it.z, 0) + 3.4;
    m.position.set(it.x, it.y, it.z);
    m.rotation.y = it.yaw;
    m.renderOrder = 3;
    it.mesh = m;
    group.add(m);
  }

  // start/finish: chequered band across the road and a glowing gantry over it
  const st = { x: P[0][0], z: P[0][1], t: tan[0], hw: HW[0], built: false };
  function buildStart() {
    st.built = true;
    const yaw = Math.atan2(st.t[0], st.t[1]);               // local +z along the direction of travel
    const width = st.hw * 2 + 1;
    const nx = Math.round(width / 1.2);
    const y0 = world.topAt(st.x, st.z, 0);
    const band = new THREE.Mesh(new THREE.PlaneGeometry(width, 2.4), new THREE.MeshBasicMaterial({
      map: checkerTex(nx, 2), transparent: true, opacity: 0.85, depthWrite: false, fog: true,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    }));
    band.rotation.order = 'YXZ'; band.rotation.set(-Math.PI / 2, yaw, 0);
    band.position.set(st.x, y0 + 0.08, st.z);
    band.renderOrder = 3;
    fixed.add(band);
    // posts at both kerbs
    const postMat = new THREE.MeshBasicMaterial({ color: 0xff2bd6, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
    const H = 6.2;
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);           // across the road
    for (const s of [-1, 1]) {
      const px = st.x + rx * (width / 2 + 0.3) * s, pz = st.z + rz * (width / 2 + 0.3) * s;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, H, 0.35), postMat);
      post.position.set(px, world.topAt(px, pz, 0) + H / 2, pz);
      fixed.add(post);
    }
    const bt = bannerTex();
    for (const back of [0, 1]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(width + 0.6, (width + 0.6) / 8), new THREE.MeshBasicMaterial({ map: bt, transparent: true, depthWrite: false, fog: true }));
      b.rotation.y = yaw + (back ? 0 : Math.PI);
      b.position.set(st.x - st.t[0] * (back ? -0.05 : 0.05), y0 + H - 0.6, st.z - st.t[1] * (back ? -0.05 : 0.05));
      b.renderOrder = 3;
      fixed.add(b);
    }
  }

  return {
    group, fixed,
    update(x, z, time) {
      if (!st.built && Math.hypot(st.x - x, st.z - z) < 800 && world.ready(st.x, st.z)) buildStart();
      for (const it of items) {
        if (!it.mesh) {
          if (Math.hypot(it.x - x, it.z - z) < 700 && world.ready(it.x, it.z)) buildBoard(it);
          continue;
        }
        if (!it.big) it.mesh.position.y = it.y + Math.sin(time * 1.6 + it.phase) * 0.18;
      }
      const pulse = 0.75 + 0.25 * Math.sin(time * 3);
      matR.opacity = matL.opacity = pulse;
    },
  };
}
