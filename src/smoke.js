// Tyre smoke: soft puffs that rise from a tyre rubbing hard on paving (a burnout, a donut, a long slide or
// locked rear wheels). The tyres have to warm up first, so a short chirp makes none and a held burnout
// builds a drifting cloud. Kept thin on purpose: every puff is nearly transparent and they only add up.
import * as THREE from 'three';

const MAX = 420;           // puffs alive at once
const RUB0 = 2.5;          // m/s of tread sliding before a tyre makes any smoke
const RUB1 = 13;           // ... and where it makes the most
const RATE = 24;           // puffs per second from one tyre at full smoke
const WARM = 1.1;          // seconds for a tyre to come up to smoking heat
const COOL = 0.7;

export function createSmoke(world) {
  const pos = new Float32Array(MAX * 3), size = new Float32Array(MAX), alpha = new Float32Array(MAX);
  const vel = new Float32Array(MAX * 3), age = new Float32Array(MAX), life = new Float32Array(MAX).fill(-1);
  const s0 = new Float32Array(MAX), s1 = new Float32Array(MAX), a0 = new Float32Array(MAX), gy = new Float32Array(MAX);
  const geo = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3), aSize = new THREE.BufferAttribute(size, 1), aAlpha = new THREE.BufferAttribute(alpha, 1);
  for (const a of [aPos, aSize, aAlpha]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPos); geo.setAttribute('aSize', aSize); geo.setAttribute('aAlpha', aAlpha);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uHalfH: { value: 400 }, uColor: { value: new THREE.Color(0xdcd9e6) } },
    vertexShader: `
      attribute float aSize; attribute float aAlpha;
      uniform float uHalfH; varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uHalfH * projectionMatrix[1][1] / max(0.1, -mv.z);
        // (a puff right against the camera would fill the screen: let it thin out instead)
        vAlpha = aAlpha * smoothstep(0.6, 2.5, -mv.z);
      }`,
    fragmentShader: `
      uniform vec3 uColor; varying float vAlpha;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(p, p);
        if (r2 > 1.0) discard;
        // soft ball, a little denser low down so it reads as a rolling cloud rather than a disc
        float a = (1.0 - r2) * (1.0 - r2) * (0.85 + 0.15 * p.y) * vAlpha;
        gl_FragColor = vec4(uColor * (0.92 - 0.1 * p.y), a);
        #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 3;
  points.onBeforeRender = (renderer) => { mat.uniforms.uHalfH.value = renderer.getDrawingBufferSize(_v).y / 2; };
  const _v = new THREE.Vector2();

  let next = 0, alive = 0, fresh = false;
  const heat = [0, 0], owed = [0, 0, 0, 0];

  function puff(x, y, z, vx, vy, vz, strength) {
    const i = next; next = (next + 1) % MAX; fresh = true;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    age[i] = 0; life[i] = 1.7 + Math.random() * 1.5;
    s0[i] = 0.4 + Math.random() * 0.25; s1[i] = 1.6 + Math.random() * 1.3 + strength * 0.8;
    a0[i] = (0.1 + 0.2 * strength) * (0.7 + 0.6 * Math.random());
    gy[i] = y;
  }

  // car: the player's car after its physics step; active: false while the game is not being driven
  function update(car, dt, active) {
    if (active && car && !car.inWater) {
      const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw), sx = Math.cos(car.yaw), sz = Math.sin(car.yaw);
      const ht = car.spec.track / 2;
      // the car's velocity in the world (vx along the car, vy across it, as in the physics)
      const wvx = fx * car.vx + sx * car.vy, wvz = fz * car.vx + sz * car.vy;
      for (let ax = 0; ax < 2; ax++) {
        const front = ax === 0;
        const rub = (front ? car.rubF : car.rubR) || 0;
        const on = Math.max(0, Math.min(1, (rub - RUB0) / (RUB1 - RUB0)));
        heat[ax] += ((on > 0 ? 1 : 0) - heat[ax]) * Math.min(1, dt / (on > 0 ? WARM : COOL));
        const strength = heat[ax] * heat[ax] * Math.sqrt(on);
        if (strength < 0.03) { owed[ax * 2] = owed[ax * 2 + 1] = 0; continue; }
        const spin = Math.min(6, (front ? car.slipVF : car.slipVR) || 0);
        for (let sd = 0; sd < 2; sd++) {
          const w = ax * 2 + sd, along = front ? car.a : -car.b, side = sd ? ht : -ht;
          const x = car.x + fx * along + sx * side, z = car.z + fz * along + sz * side;
          owed[w] += RATE * strength * dt;
          if (owed[w] < 1) continue;
          if (world.surfaceAt(x, z) !== 1) { owed[w] = 0; continue; }
          const y = world.groundAt(x, z, car.y + 0.4);
          while (owed[w] >= 1) {
            owed[w] -= 1;
            // thrown back off the tread, carried along with the car for a moment, then left hanging
            const r = () => Math.random() - 0.5;
            puff(x + r() * 0.2, y + 0.12, z + r() * 0.2,
              wvx * 0.28 - fx * spin * 0.3 + r() * 1.1, 0.5 + Math.random() * 0.7, wvz * 0.28 - fz * spin * 0.3 + r() * 1.1, strength);
          }
        }
      }
    } else heat[0] = heat[1] = 0;

    if (!alive && !fresh) return;
    alive = 0; fresh = false;
    const drag = Math.exp(-dt * 1.7);
    for (let i = 0; i < MAX; i++) {
      if (life[i] < 0) continue;
      const t = (age[i] += dt) / life[i];
      if (t >= 1) { life[i] = -1; size[i] = 0; alpha[i] = 0; continue; }
      alive++;
      vel[i * 3] = vel[i * 3] * drag + 0.25 * dt; vel[i * 3 + 2] *= drag;
      vel[i * 3 + 1] += (0.55 - vel[i * 3 + 1]) * Math.min(1, dt * 1.2);
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const s = s0[i] + (s1[i] - s0[i]) * (1 - Math.exp(-age[i] * 1.5));
      // (kept clear of the ground, or the road would cut the puff in half)
      if (pos[i * 3 + 1] < gy[i] + s * 0.36) pos[i * 3 + 1] = gy[i] + s * 0.36;
      size[i] = s;
      alpha[i] = a0[i] * Math.min(1, age[i] / 0.14) * Math.pow(1 - t, 1.4);
    }
    aPos.needsUpdate = aSize.needsUpdate = aAlpha.needsUpdate = true;
    points.visible = alive > 0;
  }

  return { points, update, get count() { return alive; } };
}
