import * as THREE from 'three';
import { loadWorldData, SURFACE } from './world/data.js';
import { createSky, createEnvironment, createLights, FOG_COLOR } from './world/sky.js';
import { createTerrain } from './world/terrain.js';
import { createBuildings, createTrees, createWater, createEdgeGrid } from './world/scenery.js';
import { CARS, CAR_ORDER } from './cars/specs.js';
import { createCar, stepCar, resetCar, speedKmh } from './cars/physics.js';
import { buildPlaceholder } from './cars/placeholder.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';

const $ = (s) => document.querySelector(s);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
document.body.classList.toggle('touch', isTouch);
const params = new URLSearchParams(location.search);

const quality = isTouch
  ? { pixelRatio: Math.min(devicePixelRatio, 1.5), shadow: 1024, terrainStride: 2, tileRadius: 340, treeDetail: 0, treeShadows: false, skipFarTrees: true, anisotropy: 4, far: 2600 }
  : { pixelRatio: Math.min(devicePixelRatio, 2), shadow: 2048, terrainStride: 1, tileRadius: 520, treeDetail: 1, treeShadows: true, skipFarTrees: false, anisotropy: 8, far: 5200 };
if (params.get('q') === 'low') Object.assign(quality, { pixelRatio: 1, shadow: 0, terrainStride: 2, treeDetail: 0, treeShadows: false, skipFarTrees: true });

const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(quality.pixelRatio);
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = quality.shadow > 0;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(FOG_COLOR, 420, 2800);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.3, quality.far);
const sky = createSky();
sky.scale.setScalar(quality.far * 0.9);
scene.add(sky);
const lights = createLights(scene, quality.shadow);
scene.environment = createEnvironment(renderer);
scene.environmentIntensity = 0.9;

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const input = createInput(document.body);
const audio = createAudio();
let world, terrain, water, edge, hud;
let car = null, model = null, carId = localStorage.getItem('kvissuroam.car') || 'w201';
if (!CARS[carId]) carId = 'w201';
let mode = 'loading';            // loading | menu | drive
let buildCarModel = null;
let startPose;
const history = [];              // recent safe poses for "back to last intact spot"
let histTimer = 0;
let camYaw = 0, menuAngle = 2.5;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let launch = null;               // 0-100 km/h stopwatch

async function boot() {
  const bar = $('#loadbar');
  world = await loadWorldData((p) => { bar.style.width = `${Math.round(p * 80)}%`; });
  $('#attribution').textContent = `Map data: ${world.meta.attribution}`;
  try {
    ({ buildCarModel } = await import('./cars/models/index.js'));
  } catch (err) {
    console.warn('Detailed car models unavailable, using placeholders', err);
  }
  terrain = createTerrain(world, renderer, quality);
  scene.add(terrain.group);
  bar.style.width = '88%';
  await new Promise((r) => setTimeout(r));
  scene.add(createBuildings(world));
  scene.add(createTrees(world, quality));
  water = createWater(world);
  scene.add(water.group);
  edge = createEdgeGrid(world);
  scene.add(edge.group);
  bar.style.width = '96%';

  const s = world.meta.start;
  startPose = { x: s.x, z: s.z, yaw: s.heading, y: world.heightAt(s.x, s.z) };
  hud = createHud(world);
  setCar(carId);
  camYaw = car.yaw;
  buildMenu();
  bar.style.width = '100%';
  terrain.update(new THREE.Vector3(car.x, 0, car.z));
  $('#loading').classList.add('hidden');
  $('#menu').classList.remove('hidden');
  mode = 'menu';
  if (params.has('drive')) startDriving();
}

function setCar(id) {
  carId = id;
  localStorage.setItem('kvissuroam.car', id);
  const spec = CARS[id];
  const pose = car ? { x: car.x, z: car.z, yaw: car.yaw, y: car.y } : startPose;
  car = createCar(spec, pose);
  if (model) scene.remove(model.group);
  try {
    model = buildCarModel ? buildCarModel(id) : buildPlaceholder(spec);
  } catch (err) {
    console.warn('Car model failed, using placeholder', err);
    model = buildPlaceholder(spec);
  }
  model.group.rotation.order = 'YXZ';
  model.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  scene.add(model.group);
  audio.setCar(spec);
  hud.setCar(spec);
  document.querySelectorAll('.card').forEach((c) => c.classList.toggle('sel', c.dataset.id === id));
}

function buildMenu() {
  const cards = $('#cards');
  cards.innerHTML = '';
  for (const id of CAR_ORDER) {
    const s = CARS[id];
    const el = document.createElement('button');
    el.className = `card${id === carId ? ' sel' : ''}`;
    el.dataset.id = id;
    el.innerHTML = `<div class="yr">${s.year}</div><h3>${s.name}</h3><p>${s.blurb}</p>
      <dl><div><dt>POWER</dt><dd>${s.ref.powerKw} kW</dd></div><div><dt>0–100</dt><dd>${s.ref.zeroTo100} s</dd></div><div><dt>TOP</dt><dd>${s.ref.top}</dd></div></dl>`;
    el.addEventListener('click', () => setCar(id));
    cards.appendChild(el);
  }
  $('#drive').addEventListener('click', startDriving);
  addEventListener('keydown', (e) => {
    if (mode !== 'menu') return;
    const i = CAR_ORDER.indexOf(carId);
    if (e.code === 'ArrowRight') setCar(CAR_ORDER[(i + 1) % 3]);
    else if (e.code === 'ArrowLeft') setCar(CAR_ORDER[(i + 2) % 3]);
    else if (e.code === 'Enter' || e.code === 'Space') startDriving();
  });
}

function startDriving() {
  if (mode === 'drive') return;
  mode = 'drive';
  $('#menu').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  if (isTouch) {
    $('#touch').classList.remove('hidden');
    const el = document.documentElement;
    (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? Promise.reject()).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  }
  audio.start();
  input.enable(true);
  camYaw = car.yaw;
}

function openGarage() {
  if (mode !== 'drive') return;
  mode = 'menu';
  input.enable(false);
  $('#menu').classList.remove('hidden');
  $('#hud').classList.add('hidden');
  $('#touch').classList.add('hidden');
  $('#sunk').classList.add('hidden');
  if (car.inWater) goHome();
  car.vx = car.vy = car.yawRate = 0;
}

function place(pose) {
  resetCar(car, { ...pose, y: world.heightAt(pose.x, pose.z) });
  camYaw = car.yaw;
  launch = null;
  $('#sunk').classList.add('hidden');
}

function goHome() {
  history.length = 0;
  place(startPose);
}

function goLastSpot() {
  // newest safe pose that is at least three seconds old, so we do not land on the brink again
  const now = car.time;
  let pick = null;
  while (history.length) {
    const h = history[history.length - 1];
    if (now - h.t >= 3 || history.length === 1) { pick = h; break; }
    history.pop();
  }
  if (!pick) return goHome();
  history.pop();
  place(pick);
  hud.toast('BACK ON DRY LAND');
}

function toggleSound() {
  audio.setMuted(!audio.muted);
  $('#soundbtn').classList.toggle('off', audio.muted);
}

input.on('KeyR', goLastSpot);
input.on('KeyH', goHome);
input.on('Home', goHome);
input.on('KeyG', openGarage);
input.on('Escape', openGarage);
input.on('KeyM', toggleSound);
document.addEventListener('click', (e) => {
  const act = e.target.closest?.('[data-act]')?.dataset.act;
  if (!act) return;
  if (act === 'reset') goLastSpot();
  else if (act === 'home') goHome();
  else if (act === 'garage') openGarage();
  else if (act === 'sound') toggleSound();
});

// ---------------------------------------------------------------- frame loop
const clock = new THREE.Timer();
let slowFrames = 0, tileTimer = 0, hudTimer = 0, elapsed = 0;
const idle = {};

function frame() {
  requestAnimationFrame(frame);
  clock.update();
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  if (!car) return;

  stepCar(car, mode === 'drive' ? input.state : idle, world, dt);

  if (mode === 'drive') {
    // remember safe ground
    histTimer -= dt;
    if (histTimer <= 0 && !car.inWater && car.surface !== SURFACE.WATER && world.sdfAt(car.x, car.z) > 1.6) {
      histTimer = 0.5;
      history.push({ x: car.x, z: car.z, yaw: car.yaw, t: car.time });
      if (history.length > 80) history.shift();
    }
    if (car.sunk) $('#sunk').classList.remove('hidden');
    // 0-100 stopwatch
    const kmh = speedKmh(car);
    if (kmh < 1 && !launch) launch = { t: null, done: false };
    if (launch && !launch.done) {
      if (launch.t === null) { if (kmh > 1.5 && car.throttle > 0 && !car.reversing) launch.t = 0; }
      else {
        launch.t += dt;
        if (car.throttle < 1 || car.inWater) launch = null;
        else if (kmh >= 100) { launch.done = true; hud.toast(`0–100 KM/H · ${launch.t.toFixed(1)} S`); }
      }
    }
    if (launch?.done && kmh < 1) launch = null;
  }

  // ---- car visuals
  const s = car.spec;
  const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw);
  const off = car.a - s.wheelbase / 2;
  model.group.position.set(car.x + fx * off, car.y, car.z + fz * off);
  model.group.rotation.set(car.pitch, -car.yaw, -car.roll);
  const w = model.wheels;
  w.fl.steer.rotation.y = w.fr.steer.rotation.y = -car.steer;
  w.fl.spin.rotation.x = w.fr.spin.rotation.x = w.rl.spin.rotation.x = w.rr.spin.rotation.x = -car.wheelSpin;
  model.setLights({ brake: car.brake > 0, reverse: car.reversing, headlights: true });

  // ---- camera
  const speed = Math.hypot(car.vx, car.vy);
  if (mode === 'drive') {
    let d = car.yaw - camYaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    camYaw += d * Math.min(1, dt * (3 + speed * 0.08));
    const dist = 6.4 + Math.min(speed, 55) * 0.035, h = 2.35;
    const cx = Math.sin(camYaw), cz = -Math.cos(camYaw);
    camPos.set(car.x - cx * dist, car.y + h + (car.inWater ? Math.min(3, car.waterTime) : 0), car.z - cz * dist);
    const floor = world.heightAt(camPos.x, camPos.z) + 0.9;
    if (camPos.y < floor) camPos.y = floor;
    camLook.set(car.x + cx * 2, car.y + 1.15, car.z + cz * 2);
    if (camera.position.distanceToSquared(camPos) > 900) camera.position.copy(camPos);   // after a reset
    else camera.position.lerp(camPos, Math.min(1, dt * 10));
    const under = world.heightAt(camera.position.x, camera.position.z) + 0.7;
    if (camera.position.y < under) camera.position.y = under;
    camera.fov += (58 + Math.min(speed, 60) * 0.22 - camera.fov) * Math.min(1, dt * 3);
  } else {
    menuAngle += dt * 0.16;
    const a = car.yaw + Math.PI + Math.sin(menuAngle) * 0.85;   // sweep around the rear three-quarters
    camPos.set(car.x + Math.sin(a) * 7.4, car.y + 1.9, car.z - Math.cos(a) * 7.4);
    camLook.set(car.x, car.y + 0.75, car.z);
    camera.position.copy(camPos);
    camera.fov = isTouch ? 40 : 46;
  }
  camera.updateProjectionMatrix();
  camera.lookAt(camLook);

  // ---- world updates
  sky.position.copy(camera.position);
  sky.material.uniforms.uTime.value = elapsed;
  lights.sun.target.position.set(car.x, car.y, car.z);
  lights.sun.position.copy(lights.sun.target.position).add(lights.sunOffset);
  water.update(elapsed);
  edge.mat.uniforms.uCam.value.copy(camera.position);
  edge.mat.uniforms.uTime.value = elapsed;
  tileTimer -= dt;
  if (tileTimer <= 0) { tileTimer = 0.25; terrain.update(camera.position); }
  hudTimer -= dt;
  if (mode === 'drive' && hudTimer <= 0) { hudTimer = 0.06; hud.update(car); }
  audio.update(car, mode === 'drive');

  renderer.render(scene, camera);

  // ---- adaptive quality: drop resolution, then shadows, if the device struggles
  if (dt > 0.036) slowFrames++; else slowFrames = Math.max(0, slowFrames - 2);
  if (slowFrames > 120) {
    slowFrames = 0;
    if (renderer.getPixelRatio() > 1) renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - 0.5));
    else if (renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; lights.sun.castShadow = false; }
  }
}

// debug / test hook
window.__game = {
  // advance the physics without rendering (used by automated tests)
  sim(seconds, inp = {}) { for (let t = 0; t < seconds; t += 1 / 60) stepCar(car, inp, world, 1 / 60); },
  get car() { return car; }, get world() { return world; }, get mode() { return mode; }, setCar, goHome, startDriving, renderer, scene, camera, terrain: () => terrain };

boot().then(() => requestAnimationFrame(frame)).catch((err) => {
  console.error(err);
  $('#loadmsg').textContent = `Could not load the game: ${err.message}`;
});
