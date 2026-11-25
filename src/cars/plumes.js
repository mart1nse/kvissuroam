// The Rocket's jets (src/cars/thrust.js): a blue-white cone of cold gas at each nozzle that is blowing, as long as
// the nozzle is open. Compressed air, so no flame: a tight bright core in a wider mist that thins out to nothing.
// One instanced mesh for every Rocket in sight (ours and other players'), always in the scene, so its shader is
// made with the rest at the start and a first BOOST costs nothing new; with no nozzle open it draws nothing.
import * as THREE from 'three';
import { NOZ, NOZ_DOWN, NOZ_YAW, NOZZLES } from './thrust.js';

const CARS_MAX = 8;                 // Rockets with jets drawn at once (the nearest come first in the lists)
const PER = NOZ * 2;                // a mist and a core for each nozzle
const FAR = 300;                    // metres: no jets drawn further off
// metres at full blow: the four at the tail, the four under the corners (in Tesla's film the jets that roll the
// car and set it down are longer than the car is wide), the two at the nose
const LEN_REAR = 3.4, LEN_DOWN = 3.2, LEN_YAW = 1.3;

export function createPlumes() {
  // a cone along +y from the nozzle (narrow, at 0) to its wide far end (at 1), and five rounds across it, so the
  // jet has a body seen from behind too, where the chase camera looks straight down it. The picture: across,
  // from a round's middle (left) to its rim; up, from the nozzle to the far end, thinning out
  const SEG = 10, ROUNDS = [0.06, 0.2, 0.38, 0.6, 0.85];
  const P = [], UV = [], IX = [];
  const wideAt = (v) => 0.22 + 0.78 * v;
  for (let k = 0; k <= SEG; k++) {
    const a = (k / SEG) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
    P.push(cx * wideAt(0), 0, cz * wideAt(0), cx, 1, cz); UV.push(0.45, 0, 0.45, 1);
    if (k < SEG) IX.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
  }
  for (const v of ROUNDS) {
    const c = P.length / 3;
    P.push(0, v, 0); UV.push(0, v);
    for (let k = 0; k <= SEG; k++) {
      const a = (k / SEG) * Math.PI * 2;
      P.push(Math.cos(a) * wideAt(v), v, Math.sin(a) * wideAt(v)); UV.push(1, v);
      if (k < SEG) IX.push(c, c + 1 + k, c + 2 + k);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  geo.setIndex(IX);
  const c = document.createElement('canvas');
  c.width = 16; c.height = 64;
  const g = c.getContext('2d'), img = g.createImageData(16, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 16; x++) {
    const v = 1 - (y + 0.5) / 64, u = (x + 0.5) / 16, o = (y * 16 + x) * 4;
    const along = v < 0.1 ? 0.5 + 5 * v : Math.pow(1 - (v - 0.1) / 0.9, 1.6);
    img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
    img.data[o + 3] = Math.round(255 * 0.6 * along * (1 - u * u));
  }
  g.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map, color: 0xdcecff, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true });
  const mesh = new THREE.InstancedMesh(geo, mat, CARS_MAX * PER);
  mesh.name = 'rocket jets';
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.renderOrder = 3;
  const body = new THREE.Matrix4(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ');
  const pos = new THREE.Vector3(), sc = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  // each nozzle's turn from the cone's +y to the way its gas goes
  const turns = NOZZLES.map((n) => new THREE.Quaternion().setFromUnitVectors(up, dir.set(n[3], n[4], n[5]).normalize()));
  const swung = new THREE.Quaternion();
  let n = 0, cars = 0, clock = 0;
  // one car: where its body is (the middle of its wheelbase on the road), how hard each nozzle blows (0..1) and
  // how far each of the four corner jets is swung out sideways just then (lean, radians; none: straight down)
  function car(x, y, z, yaw, pitch, roll, noz, lean) {
    if (cars >= CARS_MAX) return;
    let any = false;
    for (let i = 0; i < NOZ; i++) if (noz[i] > 0.02) { any = true; break; }
    if (!any) return;
    const seed = cars++ * 7.3;
    body.compose(pos.set(x, y, z), q.setFromEuler(e.set(pitch, -yaw, -roll)), one);
    for (let i = 0; i < NOZ; i++) {
      const k = noz[i];
      if (k <= 0.02) continue;
      const N = NOZZLES[i], big = i < NOZ_DOWN;
      // (the jet shivers: its length by a tenth, quicker than the eye follows)
      const len = (big ? LEN_REAR : i < NOZ_YAW ? LEN_DOWN : LEN_YAW) * Math.sqrt(k) * (0.92 + 0.08 * Math.sin(clock * 61 + i * 2.1 + seed) + 0.05 * Math.sin(clock * 37 + i));
      const wide = (big ? 0.2 : i < NOZ_YAW ? 0.2 : 0.14) * (0.6 + 0.4 * k);
      pos.set(N[0], N[1], N[2]);
      let turn = turns[i];
      const a = lean && i >= NOZ_DOWN && i < NOZ_YAW ? lean[i - NOZ_DOWN] : 0;
      if (a) turn = swung.setFromUnitVectors(up, dir.set(Math.sin(a), -Math.cos(a), 0));
      m.compose(pos, turn, sc.set(wide, len, wide)).premultiply(body);
      mesh.setMatrixAt(n++, m);
      m.compose(pos, turn, sc.set(wide * 0.4, len * 0.75, wide * 0.4)).premultiply(body);
      mesh.setMatrixAt(n++, m);
    }
  }
  return {
    mesh,
    // ours: the car being driven (or null); list: the other players' cars as multiplayer.js hands them out
    // (remotes(): x, y, z, yaw, pitch, roll, spec, noz and lean for a Rocket); cam: the camera's place
    update(ours, list, cam, dt) {
      n = 0; cars = 0; clock = (clock + dt) % 1000;
      if (ours?.rocket) {
        const s = ours.spec, off = s.wheelbase * s.cgFront - s.wheelbase / 2;
        car(ours.x + Math.sin(ours.yaw) * off, ours.y, ours.z - Math.cos(ours.yaw) * off, ours.yaw, ours.pitch, ours.roll, ours.rocket.noz, ours.rocket.lean);
      }
      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        if (!r.noz || (r.x - cam.x) ** 2 + (r.z - cam.z) ** 2 > FAR * FAR) continue;
        const s = r.spec, off = s.wheelbase * s.cgFront - s.wheelbase / 2;
        car(r.x + Math.sin(r.yaw) * off, r.y, r.z - Math.cos(r.yaw) * off, r.yaw, r.pitch, r.roll, r.noz, r.lean);
      }
      if (mesh.count !== n) mesh.count = n;
      if (n) mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
