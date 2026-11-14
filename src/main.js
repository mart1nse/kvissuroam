import * as THREE from 'three';
import { loadWorldData, SURFACE } from './world/data.js';
import { createSky, createEnvironment, createLights, FOG_COLOR } from './world/sky.js';
import { createTerrain } from './world/terrain.js';
import { createBuildings, createTrees, createLowObjects, createWater, createEdgeGrid } from './world/scenery.js';
import { CARS, CAR_ORDER } from './cars/specs.js';
import { createCar, stepCar, resetCar, speedKmh } from './cars/physics.js';
import { buildPlaceholder } from './cars/placeholder.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createStreetPhotos } from './world/streetphotos.js';
import { createRoadMarkings } from './world/roads.js';
import { buildDeckBodies } from './world/decks.js';
import { createProps } from './world/props.js';
import { createSkidMarks } from './skidmarks.js';
import { createBigMap } from './bigmap.js';

const $ = (s) => document.querySelector(s);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
document.body.classList.toggle('touch', isTouch);
const params = new URLSearchParams(location.search);

const quality = isTouch
  ? { pixelRatio: Math.min(devicePixelRatio, 1.5), shadow: 1024, terrainStride: 2, tileRadius: 380, treeDetail: 0, treeShadows: false, thinTrees: true, anisotropy: 4, far: 2600, loadRadius: 520, xTiles: false }
  : { pixelRatio: Math.min(devicePixelRatio, 2), shadow: 2048, terrainStride: 1, tileRadius: 560, treeDetail: 1, treeShadows: true, thinTrees: false, anisotropy: 8, far: 5200, loadRadius: 1000, xTiles: true };
if (params.get('q') === 'low') Object.assign(quality, { pixelRatio: 1, shadow: 0, terrainStride: 2, treeDetail: 0, treeShadows: false, thinTrees: true, loadRadius: 420 });

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
let world, terrain, water, edge, hud, skids, bigmap;
let dropping = false;
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
  $('#attribution').textContent = `Map data: ${world.meta.attribution}. Street furniture: © Mapillary, CC BY-SA`;
  try {
    ({ buildCarModel } = await import('./cars/models/index.js'));
  } catch (err) {
    console.warn('Detailed car models unavailable, using placeholders', err);
  }
  terrain = createTerrain(world, renderer, quality);
  scene.add(terrain.group);
  bar.style.width = '88%';
  await new Promise((r) => setTimeout(r));
  const buildBuildings = createBuildings();
  const buildTrees = createTrees(quality);
  const buildLow = createLowObjects(world, quality);
  const buildMarks = createRoadMarkings(world);
  const attachProps = createProps(world, { shadows: !isTouch });
  world.onSectorLoad((s) => {
    terrain.addSector(s);
    s.bMesh = buildBuildings(s);
    if (s.bMesh) scene.add(s.bMesh);
    s.tree = buildTrees(s);
    if (s.tree) scene.add(s.tree.group);
    s.low = buildLow(s);
    if (s.low) scene.add(s.low);
    s.marks = buildMarks(s);
    if (s.marks) scene.add(s.marks);
    s.decks = buildDeckBodies(world, s);
    if (s.decks) scene.add(s.decks);
    attachProps(s, (g) => { if (s.props) return; s.props = g; scene.add(g); });
  });
  world.onSectorUnload((s) => {
    terrain.removeSector(s);
    if (s.bMesh) { scene.remove(s.bMesh); s.bMesh.geometry.dispose(); s.bMesh = null; }
    if (s.tree) { scene.remove(s.tree.group); s.tree.dispose(); s.tree = null; }
    if (s.low) { scene.remove(s.low); s.low.userData.dispose(); s.low = null; }
    if (s.marks) { scene.remove(s.marks); s.marks.geometry.dispose(); s.marks = null; }
    if (s.decks) { scene.remove(s.decks); s.decks.userData.dispose(); s.decks = null; }
    if (s.props) { scene.remove(s.props); s.props.userData.dispose(); s.props = null; }
  });
  const s0 = world.meta.start;
  await world.loadAround(s0.x, s0.z, 200);
  water = createWater(world);
  scene.add(water.group);
  edge = createEdgeGrid(world);
  scene.add(edge.group);
  bar.style.width = '96%';

  const s = world.meta.start;
  startPose = { x: s.x, z: s.z, yaw: s.heading, y: world.heightAt(s.x, s.z) };
  hud = createHud(world);
  skids = createSkidMarks(world);
  scene.add(skids.mesh);
  bigmap = createBigMap(world, { onPick: dropAt, onClose: closeMap });
  if (params.get('photos') === '1') {     // street photo projection: an experiment, off unless asked for
    photos = createStreetPhotos(renderer, world);
    photos.load();
    scene.traverse((o) => { if (o.isLight) o.layers.enable(1); });
  }
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
  model.group.traverse((o) => { o.layers.enable(1); if (o.isMesh) { o.castShadow = true; } });   // layer 1: drawn again over street photos
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
    if (e.code === 'ArrowRight') setCar(CAR_ORDER[(i + 1) % CAR_ORDER.length]);
    else if (e.code === 'ArrowLeft') setCar(CAR_ORDER[(i + CAR_ORDER.length - 1) % CAR_ORDER.length]);
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
  closeMap();
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
  resetCar(car, { ...pose, y: pose.y ?? world.heightAt(pose.x, pose.z) });
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

// ---------------------------------------------------------------- city map
function openMap() {
  if (mode !== 'drive' || car.inWater) return;
  bigmap.show(car);
}

function closeMap() {
  bigmap?.hide();
}

function insideBoundary(x, z) {
  const b = world.meta.boundary;
  let inside = false;
  for (let i = 0, j = b.length - 1; i < b.length; j = i++) {
    const [xi, zi] = b[i], [xj, zj] = b[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

const freeGround = (x, z) => world.surfaceAt(x, z) !== SURFACE.WATER && world.sdfAt(x, z) > 1.6;

// Drop the car where the map was tapped: on the street if the tap was on or
// next to one (facing along it, in the right-hand lane), otherwise exactly on
// the spot. If the spot is a building or the river, the nearest street is used.
async function dropAt(x, z) {
  if (dropping || mode !== 'drive') return;
  if (!insideBoundary(x, z)) { hud.toast('OUTSIDE THE MAP', 1600); return; }
  const onRoad = (maxD) => {
    const r = bigmap.nearestRoad(x, z, maxD);
    if (!r) return null;
    const o = Math.min(r.w / 4, 1.7);
    return { x: r.x + Math.cos(r.yaw) * o, z: r.z + Math.sin(r.yaw) * o, yaw: r.yaw, name: r.name };
  };
  dropping = true;
  try {
    await world.loadAround(x, z, 260);
    let pose = onRoad(22);
    if (!pose && freeGround(x, z)) pose = { x, z, yaw: car.yaw };
    if (!pose) pose = onRoad(250);
    if (!pose || !freeGround(pose.x, pose.z)) { hud.toast('NO ROOM FOR THE CAR THERE', 1800); return; }
    closeMap();
    history.length = 0;
    place(pose);
    hud.toast(pose.name ? pose.name.toUpperCase() : 'DROPPED IN', 2200);
  } finally {
    dropping = false;
  }
}

function toggleSound() {
  audio.setMuted(!audio.muted);
  $('#soundbtn').classList.toggle('off', audio.muted);
}

const unlessMap = (fn) => () => { if (!bigmap?.isOpen) fn(); };
input.on('KeyR', unlessMap(goLastSpot));
input.on('KeyH', unlessMap(goHome));
input.on('Home', unlessMap(goHome));
input.on('KeyG', openGarage);
input.on('KeyT', () => (bigmap.isOpen ? closeMap() : openMap()));
input.on('Escape', () => (bigmap.isOpen ? closeMap() : openGarage()));
input.on('KeyM', toggleSound);
document.addEventListener('click', (e) => {
  const act = e.target.closest?.('[data-act]')?.dataset.act;
  if (!act) return;
  if (act === 'reset') goLastSpot();
  else if (act === 'home') goHome();
  else if (act === 'garage') openGarage();
  else if (act === 'map') openMap();
  else if (act === 'sound') toggleSound();
});

// ---------------------------------------------------------------- no page zoom
// iOS Safari ignores user-scalable=no, so a stray second finger could pinch
// the whole page into a zoom there is no way out of. Block the gestures, and
// if the page ever does end up zoomed, snap it back.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
document.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault());
if (window.visualViewport) {
  const vp = document.querySelector('meta[name="viewport"]');
  const content = vp.content;
  let pending = 0;
  visualViewport.addEventListener('resize', () => {
    if (visualViewport.scale <= 1.01 || pending) return;
    pending = setTimeout(() => {
      pending = 0;
      vp.content = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1';
      requestAnimationFrame(() => { vp.content = content; });
    }, 60);
  });
}

// ---------------------------------------------------------------- frame loop
const clock = new THREE.Timer();
let photos = null, treesHidden = false;
let slowFrames = 0, tileTimer = 0, hudTimer = 0, elapsed = 0;
const idle = {};

function frame() {
  requestAnimationFrame(frame);
  clock.update();
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  if (!car) return;

  // hold the car still while the ground under it is still loading (after a jump across the map)
  // (and while the city map is open)
  if (world.ready(car.x, car.z) && !bigmap.isOpen) {
    stepCar(car, mode === 'drive' ? input.state : idle, world, dt);
    skids.update(car);
  }

  if (mode === 'drive') {
    // remember safe ground
    histTimer -= dt;
    if (histTimer <= 0 && !car.inWater && car.surface !== SURFACE.WATER && world.sdfAt(car.x, car.z) > 1.6) {
      histTimer = 0.5;
      history.push({ x: car.x, z: car.z, yaw: car.yaw, y: car.y, t: car.time });
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
    // a street photo is narrower than the game's view, so over photos the camera backs off and zooms in
    const pm = photos?.mix ?? 0;
    const dist = (6.4 + Math.min(speed, 55) * 0.035) * (1 + 0.45 * pm), h = 2.35;
    const cx = Math.sin(camYaw), cz = -Math.cos(camYaw);
    camPos.set(car.x - cx * dist, car.y + h + (car.inWater ? Math.min(3, car.waterTime) : 0), car.z - cz * dist);
    const floor = world.heightAt(camPos.x, camPos.z) + 0.9;
    if (camPos.y < floor) camPos.y = floor;
    camLook.set(car.x + cx * 2, car.y + 1.15, car.z + cz * 2);
    if (camera.position.distanceToSquared(camPos) > 900) camera.position.copy(camPos);   // after a reset
    else camera.position.lerp(camPos, Math.min(1, dt * 10));
    const under = world.heightAt(camera.position.x, camera.position.z) + 0.7;
    if (camera.position.y < under) camera.position.y = under;
    camera.fov += ((58 + Math.min(speed, 60) * 0.22) * (1 - 0.3 * pm) - camera.fov) * Math.min(1, dt * 3);
  } else {
    menuAngle += dt * 0.16;
    const a = car.yaw + Math.PI + Math.sin(menuAngle) * 0.85;   // sweep around the rear three-quarters
    camPos.set(car.x + Math.sin(a) * 7.4, car.y + 1.9, car.z - Math.cos(a) * 7.4);
    camLook.set(car.x, car.y + 0.75, car.z);
    camera.position.copy(camPos);
    camera.fov = isTouch ? 40 : 46;
  }
  if (window.__cam) { camera.position.fromArray(window.__cam, 0); camLook.fromArray(window.__cam, 3); camera.fov = window.__cam[6] ?? 55; }   // test hook
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
  if (tileTimer <= 0) {
    tileTimer = 0.25;
    world.update(car.x, car.z, quality.loadRadius, quality.loadRadius + 500);
    terrain.update(camera.position);
    for (const s of world.sectors.values()) if (s.tree) s.tree.setNear(s.d < 260);
  }
  hudTimer -= dt;
  if (mode === 'drive' && hudTimer <= 0) { hudTimer = 0.06; hud.update(car); }
  audio.update(car, mode === 'drive' && !bigmap.isOpen);

  if (photos?.update(camera, dt)) {
    const hideTrees = photos.mix > 0.5 && params.get('phtrees') !== '1';   // the photo has the real trees in it
    for (const s of world.sectors.values()) if (s.tree) s.tree.group.visible = !hideTrees;
    treesHidden = hideTrees;
    photos.render(scene, camera, model.group);
  } else {
    if (treesHidden) { treesHidden = false; for (const s of world.sectors.values()) if (s.tree) s.tree.group.visible = true; }
    renderer.render(scene, camera);
  }

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
  get car() { return car; }, get world() { return world; }, get mode() { return mode; }, setCar, goHome, place, startDriving, openMap, dropAt, skids: () => skids, bigmap: () => bigmap, renderer, scene, camera, terrain: () => terrain, photos: () => photos };

boot().then(() => requestAnimationFrame(frame)).catch((err) => {
  console.error(err);
  $('#loadmsg').textContent = `Could not load the game: ${err.message}`;
});
