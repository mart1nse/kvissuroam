import * as THREE from 'three';
import { loadWorldData, SURFACE } from './world/data.js';
import { createSky, createEnvironment, createLights, FOG_COLOR } from './world/sky.js';
import { createTerrain } from './world/terrain.js';
import { createBuildings, createTrees, updateTrees, fewerTrees, createLowObjects, createWater, createEdgeGrid } from './world/scenery.js';
import { CARS, CAR_ORDER, CAR_GROUPS } from './cars/specs.js';
import { createCar, stepCar, resetCar, speedKmh, shiftGear } from './cars/physics.js';
import { buildPlaceholder } from './cars/placeholder.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createTrackKerbs } from './race/trackkerbs.js';
import { updateShelters } from './world/shelter.js';
import { createHud } from './hud.js';
import { createStreetPhotos } from './world/streetphotos.js';
import { createRoadMarkings } from './world/roads.js';
import { buildDeckBodies } from './world/decks.js';
import { createWalls } from './world/walls.js';
import { createProps } from './world/props.js';
import { createJanese } from './world/janese.js';
import { createParked } from './world/parked.js';
import { createAksi, aksiProps } from './world/aksi.js';
import { createPootsmani, pootsmaniProps, pootsmaniWalls } from './world/pootsmani.js';
import { createAngerja, angerjaWalls } from './world/angerja.js';
import { createRaekoda, raekodaWalls } from './world/raekoda.js';
import { createKuuni, kuuniWalls, kuuniProps, kuuniVectors } from './world/kuuni.js';
import { createKuperjanovi, kuperjanoviWalls } from './world/kuperjanovi.js';
import { createPepleri, pepleriWalls, pepleriProps, pepleriVectors } from './world/pepleri.js';
import { createKaubamaja, kaubamajaWalls } from './world/kaubamaja.js';
import { createKeskus, keskusWalls, keskusProps } from './world/keskus.js';
import { createKeskusTee, keskusTeeVectors } from './world/keskustee.js';
import { createOrident, oridentWalls } from './world/orident.js';
import { createDelta, deltaWalls } from './world/delta.js';
import { createKvissentaliTee, kvissentaliProps, kvissentaliWalls } from './world/kvissentalitee.js';
import { createSireli, sireliWalls } from './world/sireli.js';
import { createCoop, coopWalls, coopProps, coopClear, coopSignSkip } from './world/coop.js';
import { createJaaaeg, jaaaegWalls, jaaaegProps } from './world/jaaaeg.js';
import { createDiscGolf } from './world/discgolf.js';
import { createJaneseMaja, janeseVectors, janeseWalls } from './world/janesemaja.js';
import { createSigns } from './world/signs.js';
import { mandelWalls, mandelProps, mandelSignSkip } from './race/mandel.js';
import { veskiEndWalls, veskiEndProps } from './race/veskiend.js';
import { kroonuaiaWalls, kroonuaiaProps, kroonuaiaClear, kroonuaiaRoads } from './race/kroonuaia.js';
import { jakobiLaiWalls, jakobiLaiVectors } from './race/jakobilai.js';
import { createSkidMarks } from './skidmarks.js';
import { createSmoke } from './smoke.js';
import { createBigMap } from './bigmap.js';
import { createIntro } from './intro.js';
import { createRace, createTrack, snapRoadsToTrack, levelTrackShoulders } from './race/race.js';
import { createMultiplayer } from './net/multiplayer.js';
import { createPeople } from './net/people.js';
import { createBoard } from './race/board.js';
import { createTrackside, clearProps, extraProps } from './race/trackside.js';
import { pavedPatches } from './race/corners.js';
import { veskiRoads } from './race/veski.js';
import { emajoeVectors, levelEmajoeWall } from './race/emajoe.js';
import { laiVectors } from './race/lai.js';
import { uueturuVectors, uueturuWalls } from './race/uueturu.js';
import { playtechWalls } from './race/playtech.js';
import { valliWalls } from './race/valli.js';
import { valliStreetWalls, valliStreetProps } from './race/vallistreet.js';
import { baeriStreetWalls, baeriStreetProps } from './race/baeristreet.js';
import { pickFromHistory, searchDry, dryLevel } from './respawn.js';

const $ = (s) => document.querySelector(s);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
document.body.classList.toggle('touch', isTouch);
const params = new URLSearchParams(location.search);

const quality = isTouch
  ? { pixelRatio: Math.min(devicePixelRatio, 1.5), shadow: 1024, terrainStride: 2, tileRadius: 380, treeDetail: 0, treeShadows: false, thinTrees: true, anisotropy: 4, far: 2600, loadRadius: 520, xTiles: false, roadTex: 512 }
  : { pixelRatio: Math.min(devicePixelRatio, 2), shadow: 2048, terrainStride: 1, tileRadius: 560, treeDetail: 1, treeShadows: true, thinTrees: false, anisotropy: 8, far: 5200, loadRadius: 1000, xTiles: true };
// realistic trees; ?trees=old brings back the simple shapes
quality.realTrees = params.get('trees') !== 'old';
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
let kuperjanovi, kaubamaja, keskus, keskusTee, pepleri, orident, delta, kuuni;
let world, terrain, water, edge, hud, skids, smoke, bigmap, race, mp, board, props, trackside, trackKerbs, people, janese, aksi, angerja, pootsmani, kvissentali, raekoda, sireli, coop, jaaaeg, discgolf, janeseMaja, parked;
let dropping = false;
let car = null, model = null, carId = localStorage.getItem('kvissuroam.car') || 'w201';
if (!CARS[carId]) carId = 'w201';
let mode = 'loading';            // loading | menu | drive
let buildCarModel = null;
let startPose;
const history = [];              // recent safe poses for "back to last intact spot"
let histTimer = 0;
let wetAt = null;                // where and when the car went into the water: { x, z, t }
let camYaw = 0, menuAngle = 2.5;
let camDist = 6.4, camY = 0, camSlope = 0, camSnap = true, camSwoop = 0;   // chase rig, eased; camSnap: jump straight to the car; camSwoop: seconds left of the glide in from the menu view
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let intro = null, introFocus = null;   // drone flyover behind the opening menu
let flyIn = null;                // the one second flight from the drone to the chase camera
// On phones the drone holds one fixed view and pressing DRIVE fades through dark straight to the car
// (the moving drone and the flight down stutter there while the map streams in). ?fixedintro tries it on a desktop.
const fixedIntro = isTouch || params.has('fixedintro');
let fade = null;                 // { phase: 'out' | 'hold' | 'in', t, ... } the fade from the drone shot to the car
const fadeEl = document.createElement('div');
// (on phones the car's name sits small under the GAS and BRAKE buttons, not under the rev counter)
if (isTouch) $('#touch .pad.right').appendChild($('#carname'));
fadeEl.id = 'fade';
document.body.appendChild(fadeEl);
let launch = null;               // 0-100 km/h stopwatch
let tunnel = 0, tunnelShown = -1;  // high speed tunnel vision, 0..1
const tunnelEl = document.createElement('div');
tunnelEl.id = 'tunnel';
document.body.appendChild(tunnelEl);

async function boot() {
  const bar = $('#loadbar');
  world = await loadWorldData((p) => { bar.style.width = `${Math.round(p * 80)}%`; });
  $('#attribution').textContent = `Map data: ${world.meta.attribution}. Street furniture: © Mapillary, CC BY-SA. Shops: © OpenStreetMap contributors, ODbL`;
  try {
    ({ buildCarModel } = await import('./cars/models/index.js'));
  } catch (err) {
    console.warn('Detailed car models unavailable, using placeholders', err);
  }
  world.vectors.areas = [...(world.vectors.areas || []), ...pavedPatches()];      // rounded kerbs on the lap
  snapRoadsToTrack(world.vectors);
  valliWalls(world.vectors);
  emajoeVectors(world.vectors);                 // own lane lines and garden wall on Emajõe
  veskiRoads(world.vectors);                    // Veski paints its own line beside the red lane (after emajoeVectors, which starts the list of such stretches)
  kroonuaiaRoads(world.vectors);               // Kroonuaia and the Jakobi hill paint their own lines
  jakobiLaiVectors(world.vectors);              // road tones from Baeri through Jakobi to Lai
  janeseVectors(world.vectors);                // Jänese tänav has no painted lines
  uueturuVectors(world.vectors);                // no generated centre line through the Uueturu junction
  laiVectors(world.vectors);                    // the rebuilt Lai / Vabaduse junction paints its own ground
  pepleriVectors(world.vectors);                // Vanemuise after the Pepleri turn: cycle lane lines, no centre line
  keskusTeeVectors(world.vectors);              // Küüni by Kaubamaja is a pedestrian street: no lane lines
  kuuniVectors(world.vectors);                  // Küüni beyond the first corner is a pedestrian street: no road lines
  uueturuWalls(world.walls);                    // the office building on Uueturu in its real slate grey
  playtechWalls(world.walls);                   // SEB in dark brick, its neighbour white
  pootsmaniWalls(world.walls);                  // houses on Pootsmani in their own colours
  raekodaWalls(world.walls);                    // Raekoja plats: its houses in their colours, the town hall by hand
  kuuniWalls(world.walls);                      // Küüni from the first corner to Raekoja plats: house colours (fronts painted in kuuni.js)
  kvissentaliWalls(world.walls);                // Kvissentali tee 10 and 12 are built by hand
  sireliWalls(world.walls);                     // so is Sireli 7a in Kõrveküla
  baeriStreetWalls(world.walls);                // upper Vallikraavi and Baeri
  valliStreetWalls(world.walls);                // the houses at the start of Vallikraavi in their colours
  coopWalls(world.walls);                       // and the Coop Konsum on Aruküla tee
  janeseWalls(world.walls);                     // and Jänese 1
  angerjaWalls(world.walls);                    // Äksi, Angerja tänav: the houses round the jogger's loop in their colours
  jaaaegWalls(world.walls);                     // the Ice Age Centre in Äksi is built by hand, its neighbours get their colours
  mandelWalls(world.walls);                     // Mandel kohvik at Veski 7: white render
  veskiEndWalls(world.walls);                   // the white house and the brick block at the end of Veski
  keskusWalls(world.walls);                     // Kvartal, Tasku and the market hall in their colours
  kaubamajaWalls(world.walls);                  // Kaubamaja is built by hand
  kroonuaiaWalls(world.walls);                  // Kroonuaia and the Jakobi hill: every house in its own colours
  jakobiLaiWalls(world.walls);                  // house colours along Jakobi and Lai
  oridentWalls(world.walls);                    // the Orident house on the Baeri/Jakobi corner is built by hand
  deltaWalls(world.walls);                      // the Delta centre across the river from Lai is built by hand
  kuperjanoviWalls(world.walls);                // the white house on the Kuperjanovi corner is built by hand
  pepleriWalls(world.walls);                    // Pepleri: the church is built by hand, the blocks get their colours
  terrain = createTerrain(world, renderer, quality);
  scene.add(terrain.group);
  bar.style.width = '88%';
  await new Promise((r) => setTimeout(r));
  const buildBuildings = createBuildings(world.walls);
  const buildTrees = createTrees(quality, renderer, world);
  if (buildTrees.near) scene.add(buildTrees.near);
  const buildLow = createLowObjects(world, quality);
  const buildMarks = createRoadMarkings(world);
  const buildWalls = createWalls(world);
  trackside = createTrackside(world, scene);       // before any sector loads: it adds a kerb to the ground
  trackKerbs = createTrackKerbs(world, scene);     // the 10 cm kerbs of the pavements along the lap (before any sector loads too)
  const attachProps = props = createProps(world, { shadows: !isTouch, clear: (d) => { const out = clearProps(d); for (const id of coopClear(d)) out.add(id); for (const id of kroonuaiaClear(d)) out.add(id); return out; }, extra: () => [...extraProps(), ...aksiProps(), ...pootsmaniProps(), ...kvissentaliProps(), ...mandelProps(), ...veskiEndProps(), ...coopProps(), ...jaaaegProps(), ...valliStreetProps(), ...keskusProps(), ...kroonuaiaProps(), ...baeriStreetProps(), ...pepleriProps(), ...kuuniProps()] });
  mandelSignSkip(world);                        // Mandel's name is painted on its wall, not a box sign
  coopSignSkip(world);                          // the Coop's letters are built on its walls
  const attachSigns = createSigns(world);
  janese = createJanese(scene, world, { shadows: !isTouch });
  aksi = createAksi(scene, world, { shadows: !isTouch });
  parked = createParked(scene, world, { shadows: !isTouch, touch: isTouch });
  pootsmani = createPootsmani(scene, world, { shadows: !isTouch });
  angerja = createAngerja(scene, world, { shadows: !isTouch });
  raekoda = createRaekoda(scene, world, { shadows: !isTouch });
  kuuni = createKuuni(scene, world, { shadows: !isTouch });
  kuuni.holo.bindClicks(camera, canvas);         // the Anderson's hologram opens the taproom's site
  kuperjanovi = createKuperjanovi(scene, world, { shadows: !isTouch });
  pepleri = createPepleri(scene, world, { shadows: !isTouch });
  kaubamaja = createKaubamaja(scene, world, { shadows: !isTouch });
  keskus = createKeskus(scene, world, { shadows: !isTouch });
  keskusTee = createKeskusTee(scene, world, { shadows: !isTouch });
  orident = createOrident(scene, world, { shadows: !isTouch });
  delta = createDelta(scene, world, { shadows: !isTouch });
  kvissentali = createKvissentaliTee(scene, world, { shadows: !isTouch });
  sireli = createSireli(scene, world, { shadows: !isTouch });
  coop = createCoop(scene, world, { shadows: !isTouch });
  jaaaeg = createJaaaeg(scene, world, { shadows: !isTouch });
  discgolf = createDiscGolf(scene, world, audio, { shadows: !isTouch });
  janeseMaja = createJaneseMaja(scene, world, { shadows: !isTouch });
  levelTrackShoulders(world);                      // before the ground of a sector is built from its heights
  levelEmajoeWall(world);                          // the strip from the kerb to the garden wall, level with the street
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
    s.walls = buildWalls(s);
    if (s.walls) scene.add(s.walls);
    s.decks = buildDeckBodies(world, s);
    if (s.decks) scene.add(s.decks);
    attachProps(s, (g) => { if (s.props) return; s.props = g; scene.add(g); });
    attachSigns(s, (g) => { if (s.signs) return; s.signs = g; scene.add(g); });
  });
  world.onSectorUnload((s) => {
    terrain.removeSector(s);
    if (s.bMesh) { scene.remove(s.bMesh); s.bMesh.geometry.dispose(); s.bMesh = null; }
    if (s.tree) { scene.remove(s.tree.group); s.tree.dispose(); s.tree = null; }
    if (s.low) { scene.remove(s.low); s.low.userData.dispose(); s.low = null; }
    if (s.marks) { scene.remove(s.marks); s.marks.geometry.dispose(); s.marks = null; }
    if (s.walls) { scene.remove(s.walls); s.walls.geometry.dispose(); s.walls = null; }
    if (s.decks) { scene.remove(s.decks); s.decks.userData.dispose(); s.decks = null; }
    if (s.props) { scene.remove(s.props); s.props.userData.dispose(); s.props = null; }
    if (s.signs) { scene.remove(s.signs); s.signs.userData.dispose(); s.signs = null; }
  });
  // the game starts on the race track, just before its last corner (Uueturu at the Ülikooli crossing)
  const sp = createTrack().spawn;
  world.meta.start = { x: sp.x + Math.cos(sp.yaw) * 1.5, z: sp.z + Math.sin(sp.yaw) * 1.5, heading: sp.yaw };
  const s0 = world.meta.start;
  const jobs = [world.loadAround(s0.x, s0.z, 200)];
  if (!params.has('drive') && !params.has('nointro')) {
    intro = createIntro(world, { fixed: fixedIntro, shot: params.has('shot') ? +params.get('shot') : null });
    introFocus = intro.start();
    jobs.push(world.loadAround(introFocus.x, introFocus.z, 450));
  }
  await Promise.all(jobs);
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
  smoke = createSmoke(world);
  scene.add(smoke.points);
  mp = createMultiplayer({
    scene, camera, toast: (t, ms) => hud.toast(t, ms),
    buildModel: (id) => { try { return buildCarModel ? buildCarModel(id) : buildPlaceholder(CARS[id]); } catch { return buildPlaceholder(CARS[id]); } },
    onBoard: () => { race?.refreshBest(); board?.render(); },
    onPeople: (kind, name, old) => {
      if (kind === 'join' || kind === 'leave') audio.chime?.(kind);
      people?.event(kind, name, old);
    },
  });
  people = createPeople({ mp, onFocus: (x, z) => bigmap.focus(x, z) });
  race = createRace({
    world, scene, toast: (t, ms) => hud.toast(t, ms),
    onLap: (lap) => mp.submitLap(lap),
    refFor: (id, cp) => mp.refFor(id, cp),
    bestFor: (id) => {
      const net = mp.bestFor(id);
      let mine = null;
      for (const l of race.laps) if (l.car === id && (!mine || l.ms < mine.ms)) mine = { ms: l.ms, name: mp.name };
      return net && (!mine || net.ms <= mine.ms) ? net : mine;
    },
  });
  board = createBoard({ mp, race, cars: CARS, order: CAR_ORDER });
  const trackPath = (ctx) => {
    ctx.beginPath();
    race.track.P.forEach(([x, z], i) => (i ? ctx.lineTo(x, z) : ctx.moveTo(x, z)));
    ctx.closePath();
  };
  hud.setOverlay((ctx, scale, car) => {
    ctx.strokeStyle = 'rgba(255,43,214,.5)'; ctx.lineWidth = 16;
    trackPath(ctx); ctx.stroke();
    // other players: arrows pointing the way they drive; anyone outside the minimap
    // gets a pointer on its rim showing which way they are from us
    const players = mp.players();
    if (!players.length) return;
    const m = ctx.getTransform(), R = ctx.canvas.width / 2;
    const me = m.transformPoint(new DOMPoint(car.x, car.z));
    ctx.save();
    ctx.resetTransform();
    for (const p of players) {
      const q = m.transformPoint(new DOMPoint(p.x, p.z));
      const ex = q.x - R, ey = q.y - R;
      if (ex * ex + ey * ey < (R - 7) * (R - 7)) {
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(p.yaw - car.yaw);
        playerArrow(ctx, 1, p.colour); ctx.restore();
        continue;
      }
      // where the line from our car towards them crosses a circle just inside the rim
      const dx = q.x - me.x, dy = q.y - me.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      const ox = me.x - R, oy = me.y - R, rr = R - 26;      // (pointers made bigger, Martin 2026-11-17)
      const b = ox * ux + oy * uy, t = -b + Math.sqrt(Math.max(0, b * b - (ox * ox + oy * oy - rr * rr)));
      ctx.save(); ctx.translate(me.x + ux * t, me.y + uy * t); ctx.rotate(Math.atan2(ux, -uy));
      ctx.fillStyle = p.colour; ctx.strokeStyle = '#160735'; ctx.lineWidth = 2.5;
      ctx.shadowColor = p.colour; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(17, 11); ctx.lineTo(-17, 11); ctx.closePath();
      ctx.stroke(); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  });
  bigmap = createBigMap(world, {
    onPick: dropAt, onClose: closeMap,
    drawUnder: (ctx, k) => { ctx.strokeStyle = 'rgba(255,43,214,.6)'; ctx.lineWidth = Math.max(5, 3 / k); trackPath(ctx); ctx.stroke(); },
    drawOver: (ctx, mark) => {
      const st = race.track.P[0], tg = race.track.tan[0];
      mark(st[0], st[1], () => {
        ctx.rotate(Math.atan2(tg[1], tg[0]));
        ctx.fillStyle = '#fff'; ctx.fillRect(-2, -11, 4, 22);
      });
      ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'center';
      for (const p of mp.players()) mark(p.x, p.z, () => {
        ctx.lineWidth = 3; ctx.strokeStyle = '#160735'; ctx.strokeText(p.name, 0, -17); ctx.fillStyle = '#fff'; ctx.fillText(p.name, 0, -17);
        ctx.rotate(p.yaw);
        playerArrow(ctx, 1, p.colour);
      });
    },
  });
  if (params.get('photos') === '1') {     // street photo projection: an experiment, off unless asked for
    photos = createStreetPhotos(renderer, world);
    photos.load();
    scene.traverse((o) => { if (o.isLight) o.layers.enable(1); });
  }
  setCar(carId);
  camYaw = car.yaw; camSnap = true; droneYaw = car.yaw; droneDir.set(Math.sin(car.yaw), -Math.cos(car.yaw));
  buildMenu();
  bar.style.width = '100%';
  terrain.update(new THREE.Vector3(car.x, 0, car.z));
  $('#loading').classList.add('hidden');
  $('#menu').classList.remove('hidden');
  mode = 'menu';
  if (params.has('drive')) startDriving();
}

// another player's car on a map: an arrow in their own colour pointing forward (up), drawn around the origin
function playerArrow(ctx, k, colour = '#2ff3ff') {
  ctx.fillStyle = colour; ctx.strokeStyle = '#160735'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -12 * k); ctx.lineTo(8 * k, 9 * k); ctx.lineTo(0, 4.5 * k); ctx.lineTo(-8 * k, 9 * k); ctx.closePath();
  ctx.stroke(); ctx.fill();
}

function setCar(id, now = false) {
  carId = id;
  localStorage.setItem('kvissuroam.car', id);
  // (behind the opening drone flight the car isn't on screen, so picking one only marks it: it is built
  // when DRIVE is pressed, and choosing stays instant. In the garage later it is swapped at once, as you see it.)
  if (intro && model && !now) { layoutMenu(); return; }
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
  mp?.setCar(id);
  race?.cancel('LAP CANCELLED');
  layoutMenu();
}

// ---- garage menu: the groups side by side, each a stack of cards. The group's current car is in
// front and the next few peek out below it, each further back and smaller. Sliding a stack (drag
// up or down, the mouse wheel, or the up and down keys) brings the next car forward.
let groups = [];                 // [{ ids, front, el, cards }]
// Cards behind the front one: their size, and how much of each shows below the one in front of it
// (the next car shows about three quarters of itself, then less each step back). Short screens show less.
const STACK = { scale: [1, 0.92, 0.84, 0.76], show: [1, 0.75, 0.55, 0.38] };
const STACK_MID = { scale: [1, 0.92, 0.84], show: [1, 0.72, 0.42] };
const STACK_LOW = { scale: [1, 0.9, 0.8], show: [1, 0.45, 0.32] };
const STACK_PHONE = { scale: [1, 0.92], show: [1, 0.36] };      // a phone on its side: one car peeks out, name only

function layoutMenu() {
  const st = innerHeight <= 430 ? STACK_PHONE : innerHeight < 560 ? STACK_LOW : innerHeight < 760 ? STACK_MID : STACK, last = st.scale.length - 1;
  // where each card's top sits, in front-card heights (they shrink towards their top edge)
  const top = [0], bottom = [1];
  for (let k = 1; k <= last; k++) { bottom[k] = bottom[k - 1] + st.show[k] * st.scale[k]; top[k] = bottom[k] - st.scale[k]; }
  let tallest = 0;
  for (const g of groups) {
    const n = g.ids.length;
    const i = g.ids.indexOf(carId);
    if (i >= 0) g.front = i;
    g.el.classList.toggle('sel', i >= 0);
    g.el.querySelector('.gn').textContent = `${g.front + 1}/${n}`;
    g.cards.forEach((c, j) => {
      const k = (j - g.front + n) % n, kk = Math.min(k, last);
      c.style.setProperty('--k', k);
      c.style.transform = k === 0 ? '' : `translateY(${(top[kk] * 100).toFixed(1)}%) scale(${st.scale[kk]})`;
      c.classList.toggle('front', k === 0);
      c.classList.toggle('gone', k > last);
      c.classList.toggle('sel', c.dataset.id === carId);
      c.tabIndex = k === 0 ? 0 : -1;
    });
    tallest = Math.max(tallest, bottom[Math.min(n - 1, last)]);
  }
  stackRoom = tallest - 1;
  padStacks();
}

// The cards overlap in one grid cell, so each stack is given room below for the ones behind, in front-card
// heights. That needs the cards' real height, which is 0 while the menu is still hidden behind the loading
// screen, so it is measured again whenever a card changes size (shown, resized, rotated, fonts loaded).
let stackRoom = 0;
function padStacks() {
  const h = Math.max(0, ...groups.map((g) => g.cards[g.front].offsetHeight));
  if (!h) return;
  for (const g of groups) g.el.querySelector('.stack').style.paddingBottom = `${Math.round(stackRoom * h)}px`;
}
const cardSizes = typeof ResizeObserver === 'function' ? new ResizeObserver(() => padStacks()) : null;

function slideGroup(g, d) {
  const n = g.ids.length;
  setCar(g.ids[(g.front + d + n) % n]);
}

function buildMenu() {
  const cards = $('#cards');
  cards.innerHTML = '';
  // (a car left out of every group still gets a place, at the end of the last one)
  const listed = new Set(CAR_GROUPS.flatMap((g) => g.ids));
  const defs = CAR_GROUPS.map((g, i) => ({ name: g.name, ids: [...g.ids, ...(i === CAR_GROUPS.length - 1 ? CAR_ORDER.filter((id) => !listed.has(id)) : [])] }));
  let swiped = false, drag = null, lastWheel = 0;
  groups = defs.map((def) => {
    const el = document.createElement('div');
    el.className = 'group';
    el.innerHTML = `<h4><span>${def.name}</span><b class="gn"></b></h4><div class="stack"></div>`;
    const stack = el.querySelector('.stack');
    const g = { ids: def.ids, front: 0, el, cards: [] };
    for (const id of def.ids) {
      const s = CARS[id];
      const c = document.createElement('button');
      c.className = 'card';
      c.dataset.id = id;
      c.innerHTML = `<div class="yr">${s.year}</div><h3>${s.name}</h3><p>${s.blurb}</p>
        <dl><div><dt>POWER</dt><dd>${s.ref.powerKw} kW</dd></div><div><dt>${s.ref.zeroTo50 ? '0–50' : '0–100'}</dt><dd>${s.ref.zeroTo50 ?? s.ref.zeroTo100} s</dd></div><div><dt>TOP</dt><dd>${s.ref.top}</dd></div></dl>`;
      // (a tap on the front card picks it, a tap on one peeking out behind brings it forward)
      c.addEventListener('click', () => { if (!swiped) setCar(id); });
      stack.appendChild(c);
      g.cards.push(c);
    }
    // up and down arrows on the right edge of the front card, so it is plain the stack can be slid
    if (def.ids.length > 1) {
      const nav = document.createElement('div');
      nav.className = 'nav';
      stack.classList.add('has-nav');
      nav.innerHTML = '<button class="up" aria-label="Previous car">&#9650;</button><button class="dn" aria-label="Next car">&#9660;</button>';
      nav.querySelector('.up').addEventListener('click', () => slideGroup(g, -1));
      nav.querySelector('.dn').addEventListener('click', () => slideGroup(g, 1));
      nav.addEventListener('pointerdown', (e) => e.stopPropagation());
      stack.appendChild(nav);
    }
    stack.addEventListener('wheel', (e) => {
      e.preventDefault();
      const now = performance.now();
      if (Math.abs(e.deltaY) < 4 || now - lastWheel < 260) return;
      lastWheel = now;
      slideGroup(g, Math.sign(e.deltaY));
    }, { passive: false });
    stack.addEventListener('pointerdown', (e) => { drag = { g, y: e.clientY }; });
    cards.appendChild(el);
    return g;
  });
  // drag the front card up to bring the next car forward, down to go back
  addEventListener('pointerup', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y, g = drag.g;
    drag = null;
    if (Math.abs(dy) < 24) return;
    swiped = true;
    setTimeout(() => { swiped = false; }, 0);
    slideGroup(g, dy < 0 ? 1 : -1);
  });
  addEventListener('pointercancel', () => { drag = null; });
  layoutMenu();
  for (const g of groups) for (const c of g.cards) cardSizes?.observe(c);
  addEventListener('resize', layoutMenu);
  $('#drive').addEventListener('click', startDriving);
  addEventListener('keydown', (e) => {
    if (mode !== 'menu' || board?.open) return;
    const gi = Math.max(0, groups.findIndex((g) => g.ids.includes(carId))), g = groups[gi];
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      const h = groups[(gi + (e.code === 'ArrowRight' ? 1 : groups.length - 1)) % groups.length];
      setCar(h.ids[h.front]);
    } else if (e.code === 'ArrowDown') slideGroup(g, 1);
    else if (e.code === 'ArrowUp') slideGroup(g, -1);
    else if (e.code === 'Enter' || e.code === 'Space') startDriving();
  });
}

function startDriving() {
  if (mode === 'drive') return;
  if (car.spec.id !== carId) setCar(carId, true);   // a car picked during the drone flight
  mode = 'drive';
  if (intro && fixedIntro) {
    // fade to dark on the drone's view, cut to behind the car while dark, then fade in
    fade = { phase: 'out', t: 0, frames: 0, from: camera.position.clone(), q: camera.quaternion.clone(), fov: camera.fov };
    intro = null;
    terrain.update(new THREE.Vector3(car.x, 0, car.z));
  } else if (intro) {
    // fly from wherever the drone is to the chase position behind the car
    flyIn = { t: 0, from: camera.position.clone(), q0: camera.quaternion.clone(), fov: camera.fov };
    intro = null;
    terrain.update(new THREE.Vector3(car.x, 0, car.z));   // start the sharp ground tiles around the car loading now
  } else camSwoop = 0.9;
  $('#menu').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  if (isTouch) {
    $('#touch').classList.remove('hidden');
    wantFull = true;
    goFull();
  }
  audio.start();
  input.enable(true);
  camYaw = car.yaw; camSnap = true; droneYaw = car.yaw; droneDir.set(Math.sin(car.yaw), -Math.cos(car.yaw));
}

// Full screen on phones. The browser drops it when you switch to another app and only lets a page ask
// again from a tap, so after the first DRIVE any tap while not in full screen asks for it again.
let wantFull = false, fullAsked = false;
function goFull() {
  const el = document.documentElement;
  if (document.fullscreenElement || fullAsked || !el.requestFullscreen) return;
  fullAsked = true;
  el.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape')).catch(() => {})
    .finally(() => { fullAsked = false; });
}
for (const ev of ['pointerup', 'touchend']) addEventListener(ev, () => { if (wantFull && !document.hidden) goFull(); }, { passive: true, capture: true });

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
  wetAt = null;
  camYaw = car.yaw; camSnap = true; droneYaw = car.yaw; droneDir.set(Math.sin(car.yaw), -Math.cos(car.yaw));
  launch = null;
  $('#sunk').classList.add('hidden');
}

function goHome() {
  history.length = 0;
  wetAt = null;
  place(startPose);
}

// R: back to the newest remembered spot that is dry. After a plunge into the water that is a spot at
// least three seconds before the car went in and 15 m from where it did, with no water round it (on a
// bridge: the whole car on the deck); if no such spot is remembered, the nearest dry street.
let respawning = false;
async function goLastSpot() {
  if (respawning) return;
  respawning = true;
  try {
    const sx = wetAt ? wetAt.x : car.x, sz = wetAt ? wetAt.z : car.z;
    const opts = wetAt ? { ref: wetAt.t, sx, sz, minAge: 3, minDist: 15 } : { ref: car.time, sx, sz, minAge: 3, minDist: 0 };
    let pick = pickFromHistory(world, history, opts);
    for (let k = 0; pick?.wait && k < 20; k++) {
      // (a spot far back along the route may be in a part of the map that is not loaded any more)
      await world.loadAround(pick.wait.x, pick.wait.z, 80);
      if (!world.ready(pick.wait.x, pick.wait.z)) history.pop();
      pick = pickFromHistory(world, history, opts);
    }
    if (pick?.wait) pick = null;
    if (!pick) pick = searchDry(world, sx, sz, bigmap.nearestRoad);
    if (!pick) return goHome();
    place(pick);
    race?.hopped(pick.x, pick.z);
  } finally {
    respawning = false;
  }
}

// ---------------------------------------------------------------- city map
function openMap() {
  if (mode !== 'drive' || car.inWater) return;
  bigmap.show(car, mp.players());
  people.showRoster(car);
}

function closeMap() {
  bigmap?.hide();
  people?.hideRoster();
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

// Drop the car where the map was tapped: on the street if the tap was on or
// next to one (facing along it, in the right-hand lane, on the deck of a bridge),
// otherwise exactly on the spot. If the spot is a building, the river or right
// beside the water, the nearest dry street is used.
async function dropAt(x, z) {
  if (dropping || mode !== 'drive') return;
  if (!insideBoundary(x, z)) { hud.toast('OUTSIDE THE MAP', 1600); return; }
  // a pose that is safe to drop on (see respawn.js), with the height to drop at; on a bridge, the deck
  const ok = (p) => {
    if (!p) return null;
    const y = dryLevel(world, p);
    return y === null ? null : { ...p, y };
  };
  const onRoad = (maxD) => {
    const r = bigmap.nearestRoad(x, z, maxD);
    if (!r) return null;
    const o = Math.min(r.w / 4, 1.7);
    const px = r.x + Math.cos(r.yaw) * o, pz = r.z + Math.sin(r.yaw) * o;
    return { x: px, z: pz, yaw: r.yaw, name: r.name, y: r.e === 1 ? world.topAt(px, pz, 1) : undefined };
  };
  dropping = true;
  try {
    await world.loadAround(x, z, 260);
    // on or next to the race track: on its centre line, facing the way the lap goes
    const tn = race.track.nearest(x, z);
    let pose = null;
    if (tn.i >= 0 && tn.d < race.track.HW[tn.i] + 15) {
      const T = race.track, i = tn.i, t = T.tan[i];
      const tx = T.P[i][0] + (T.P[(i + 1) % T.N][0] - T.P[i][0]) * tn.t, tz = T.P[i][1] + (T.P[(i + 1) % T.N][1] - T.P[i][1]) * tn.t;
      const r = bigmap.nearestRoad(tx, tz, 20);
      pose = ok({ x: tx, z: tz, yaw: Math.atan2(t[0], -t[1]), name: r?.name, y: r?.e === 1 ? world.topAt(tx, tz, 1) : undefined });
    }
    if (!pose) pose = ok(onRoad(22));
    if (!pose) pose = ok({ x, z, yaw: car.yaw });
    if (!pose) pose = ok(onRoad(250));
    if (!pose) {
      // the river, a pond or a wall all round: the nearest dry street
      pose = searchDry(world, x, z, bigmap.nearestRoad, { from: 0, to: 250 });
      if (pose) pose.name = bigmap.nearestRoad(pose.x, pose.z, 20)?.name;
    }
    if (!pose) { hud.toast('NO ROOM FOR THE CAR THERE', 1800); return; }
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
const toggleMap = () => (bigmap.isOpen ? closeMap() : openMap());
input.on('KeyM', toggleMap);
input.on('KeyT', toggleMap);
input.on('Escape', () => (!optEl.classList.contains('hidden') ? optEl.classList.add('hidden') : bigmap.isOpen ? closeMap() : openGarage()));
input.on('KeyN', toggleSound);
// L: the lap times board over the drive (Esc or L again closes it)
input.on('KeyL', unlessMap(() => (board.open ? board.hide() : board.show())));
// A / Z: one gear up / down by hand; the automatic takes over again at the shift point
const shiftBy = (dir) => unlessMap(() => { if (mode === 'drive' && !board.open && !input.wasd) shiftGear(car, dir); });
// Options (O): WASD driving, which turns the A / Z gear keys off. Off by default; remembered per browser.
const optEl = $('#options'), optWasd = $('#opt-wasd');
let wasdSaved = false;
try { wasdSaved = localStorage.getItem('kvissuroam.wasd') === '1'; } catch {}
input.setWasd(wasdSaved);
optWasd.checked = wasdSaved;
optWasd.addEventListener('change', () => {
  input.setWasd(optWasd.checked);
  try { localStorage.setItem('kvissuroam.wasd', optWasd.checked ? '1' : '0'); } catch {}
  optWasd.blur();                // (so Space and the arrows drive again instead of flipping the box)
  hud.toast(optWasd.checked ? 'WASD DRIVING ON · A / Z SHIFTS OFF' : 'ARROWS DRIVE · A / Z SHIFT GEARS', 2200);
});
const toggleOptions = () => optEl.classList.toggle('hidden');
input.on('KeyO', unlessMap(toggleOptions));
input.on('KeyA', shiftBy(1));
input.on('KeyZ', shiftBy(-1));
// C: the chase camera or a drone following the car from above
let droneYaw = 0;
const droneDir = new THREE.Vector2(0, -1);   // the car's travel direction, averaged (x, z)
let camView = localStorage.getItem('kvissuroam.view') === 'drone' ? 'drone' : 'chase';
input.on('KeyC', unlessMap(() => {
  camView = camView === 'chase' ? 'drone' : 'chase';
  droneYaw = camYaw; droneDir.set(Math.sin(camYaw), -Math.cos(camYaw));
  try { localStorage.setItem('kvissuroam.view', camView); } catch {}
  camSwoop = 0.7;
}));
document.addEventListener('click', (e) => {
  const act = e.target.closest?.('[data-act]')?.dataset.act;
  if (!act) return;
  if (act === 'reset') goLastSpot();
  else if (act === 'home') goHome();
  else if (act === 'garage') openGarage();
  else if (act === 'map') openMap();
  else if (act === 'sound') toggleSound();
  else if (act === 'options') toggleOptions();
  else if (act === 'options-close') optEl.classList.add('hidden');
});

// ---------------------------------------------------------------- no page zoom
// iOS Safari ignores user-scalable=no, so a stray second finger could pinch
// the whole page into a zoom there is no way out of. Block the gestures, and
// if the page ever does end up zoomed, snap it back.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
// (one finger dragging the row of cars or the lap times board is a scroll, and must be left alone)
document.addEventListener('touchmove', (e) => {
  if (e.touches.length === 1 && e.target.closest?.('#cards, #board')) return;
  if (e.cancelable) e.preventDefault();
}, { passive: false });
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
const FLY_IN = 1;                 // seconds from the drone to behind the car
const FADE_OUT = 0.35, FADE_IN = 0.55;   // phones: seconds to dark on the drone shot, and back up behind the car
const smooth = (t) => t * t * (3 - 2 * t);
const flyQ = new THREE.Quaternion();
const clock = new THREE.Timer();
let photos = null, treesHidden = false;
let lastDraw = -1e9, slowFrames = 0, tileTimer = 0, hudTimer = 0, elapsed = 0, mapTimer = 0;
const s0Short = () => CARS[carId].short.toUpperCase();
const idle = {};

// Coming back from another tab: the first frames arrive late and unevenly while the browser warms
// up again. Don't count them as a struggling device, and ease the step size back in instead of
// letting the physics and camera jump between long and short steps.
clock.connect?.(document);
let settle = 0, dtSmooth = 1 / 60;
// Keep the screen on while the game is open (phones otherwise dim and lock it after a minute or so
// without a touch). The browser drops the lock whenever the page is hidden, so it is taken again on
// return; Safari only grants it after a tap, so the first touch or key asks too.
let wakeLock = null;
async function keepAwake() {
  if (wakeLock || document.hidden || !navigator.wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { wakeLock = null; }
}
keepAwake();
for (const ev of ['pointerdown', 'touchend', 'keydown']) addEventListener(ev, keepAwake, { passive: true });
document.addEventListener('visibilitychange', () => {
  audio.setBackground?.(document.hidden);           // no engine noise from a tab or app in the background
  if (document.hidden) return;
  keepAwake();
  clock.reset?.();
  settle = 1.5; slowFrames = 0;
});

function frame(ts) {
  requestAnimationFrame(frame);
  clock.update(ts);
  let dt = Math.min(clock.getDelta(), 0.05);
  if (settle > 0) {
    settle -= dt;
    dtSmooth += (Math.min(dt, 1 / 30) - dtSmooth) * 0.15;
    dt = dtSmooth;
  } else dtSmooth = dt;
  elapsed += dt;
  if (!car) return;

  // hold the car still while the ground under it is still loading (after a jump across the map)
  // (and while the city map is open)
  if (world.ready(car.x, car.z) && !bigmap.isOpen) {
    if (mode === 'drive') stepCar(car, board?.open ? idle : input.state, world, dt);
    else {
      // choosing a car: let it settle on its springs but not roll or creep away
      const x = car.x, z = car.z, yaw = car.yaw;
      stepCar(car, idle, world, dt);
      car.x = x; car.z = z; car.yaw = yaw; car.vx = car.vy = car.yawRate = 0;
    }
    mp.collide(car);
    trackside.collide(car);
    props.update(car, dt);
    updateShelters(car, dt, audio);           // bus shelters: shattered glass, bent frames
    janese.update(car, dt);
    parked.update(car, dt, camera.position);
    aksi.update(car, dt);
    pootsmani.update(car);
    angerja.update(car);
    raekoda.update(car);
    kuuni.update(car);
    kuperjanovi.update(car);
    pepleri.update(car);
    kaubamaja.update(car);
    keskus.update(car);
    keskusTee.update(car);
    orident.update(car);
    delta.update(car);
    kvissentali.update(car);
    sireli.update(car);
    coop.update(car);
    jaaaeg.update(car);
    discgolf.update(car, dt);
    janeseMaja.update(car);
    skids.update(car);
    skids.updateOthers(mp.remotes(), car);
    smoke.update(car, dt, mode === 'drive', mp.remotes());
  } else smoke.update(null, dt, false, mp.remotes());
  mp.update(car, dt, mode === 'drive');
  people.update();
  if (bigmap.isOpen && mp.count && (mapTimer -= dt) <= 0) { mapTimer = 0.5; bigmap.redraw(); }

  if (mode === 'drive') {
    // remember safe ground
    histTimer -= dt;
    if (car.inWater && !wetAt) wetAt = { x: car.x, z: car.z, t: car.time - car.waterTime };
    else if (!car.inWater) wetAt = null;
    if (histTimer <= 0 && !car.inWater && !car.airborne && car.surface !== SURFACE.WATER && world.sdfAt(car.x, car.z) > 1.6) {
      histTimer = 0.5;
      // (standing still adds nothing: the list then reaches further back along the route)
      const last = history[history.length - 1];
      if (!last || Math.hypot(car.x - last.x, car.z - last.z) > 3) {
        history.push({ x: car.x, z: car.z, yaw: car.yaw, y: car.y, t: car.time });
        if (history.length > 120) history.shift();
      }
    }
    $('#sunk').classList.toggle('hidden', !car.sunk);   // gone again if the car drifts out onto land
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
    race.update(car, carId, s0Short());
  }

  // ---- car visuals
  const s = car.spec;
  const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw);
  const off = car.a - s.wheelbase / 2;
  model.group.position.set(car.x + fx * off, car.y, car.z + fz * off);
  model.group.rotation.set(car.pitch, -car.yaw, -car.roll);
  const w = model.wheels;
  w.fl.steer.rotation.y = w.fr.steer.rotation.y = -car.steer;
  w.fl.spin.rotation.x = w.fr.spin.rotation.x = -car.wheelSpinF;
  w.rl.spin.rotation.x = w.rr.spin.rotation.x = -car.wheelSpinR;
  model.setLights({ brake: car.brake > 0, reverse: car.reversing, headlights: true });
  // a diesel with a failing DPF sooting up its tail: clean at the start, bad by 5 km, clean again on a respawn
  if (s.dpfSmoke && model.setSoot) {
    if (mode === 'drive') car.sootKm = (car.sootKm || 0) + Math.abs(car.vx) * dt / 1000;
    model.setSoot(0.95 * (1 - Math.exp(-(car.sootKm || 0) / 2.2)));
  }

  // ---- camera
  const speed = Math.hypot(car.vx, car.vy);
  if (mode === 'drive') {
    // Everything here eases a few rig numbers (heading, distance, height, slope) and then places the
    // camera exactly from them. Easing the camera's position instead leaves it trailing the car by a
    // length that depends on the frame time, so at speed every uneven frame nudged the view back or forth.
    const ease = (rate) => 1 - Math.exp(-rate * dt);
    let d = car.yaw - camYaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    camYaw += d * ease(3 + speed * 0.08);
    const cx = Math.sin(camYaw), cz = -Math.cos(camYaw);
    // a street photo is narrower than the game's view, so over photos the camera backs off and zooms in
    const pm = photos?.mix ?? 0;
    // (a bus sets its own rig: further back and higher, so its 12 metres fit the view)
    const cs = s.cam || {};
    const wantDist = (6.4 + (cs.dist ?? 0) + Math.min(speed, 55) * 0.035 + Math.min(speed, 70) * 0.075) * (1 + 0.45 * pm);
    const top = car.y + (car.inWater ? Math.min(3, car.waterTime) : 0);
    // how steeply the ground falls away ahead (positive downhill), read off the ground itself
    if (!car.airborne && !car.inWater) {
      const gy = car.y + 0.4;
      const fall = (world.groundAt(car.x - cx * 4, car.z - cz * 4, gy) - world.groundAt(car.x + cx * 4, car.z + cz * 4, gy)) / 8;
      camSlope += (Math.max(-0.3, Math.min(0.3, fall)) - camSlope) * ease(2.5);
    }
    if (camSnap) { camSnap = false; camDist = wantDist; camY = top; camSlope = 0; }
    else {
      camDist += (wantDist - camDist) * ease(5);
      camY += (top - camY) * ease(10);
      if (Math.abs(top - camY) > 6) camY = top;
    }
    // downhill the rig tips forward with the slope and a little past it, so the car does not hide the road
    const down = Math.max(0, camSlope);
    camPos.set(car.x - cx * camDist, camY + 2.35 + (cs.up ?? 0) + camDist * down * 1.35, car.z - cz * camDist);
    const floor = world.heightAt(camPos.x, camPos.z) + 0.9;
    if (camPos.y < floor) camPos.y = floor;
    camLook.set(car.x + cx * 2, camY + 1.15 + (cs.look ?? 0) - down * 3, car.z + cz * 2);
    // above 150 km/h the view stretches a touch more and the edges close in a little
    const fast = Math.min(1, Math.max(0, (speed - 41.7) / 33));
    let warp = fast * fast * (3 - 2 * fast);
    let wantFov = (58 + Math.min(speed, 60) * 0.22 + warp * 4) * (1 - 0.3 * pm);
    const fx = Math.sin(car.yaw), fz = -Math.cos(car.yaw);
    if (input.state.look && !board?.open) {
      // B held: look back from just in front of the car's nose, over the roof down the road behind
      const half = car.halfLen;
      camPos.set(car.x + fx * (half + 6.5), car.y + 2.7 + (cs.up ?? 0) * 0.5, car.z + fz * (half + 6.5));
      camPos.y = Math.max(camPos.y, world.heightAt(camPos.x, camPos.z) + 0.9);
      camLook.set(car.x - fx * 18, car.y + 0.9, car.z - fz * 18);
      wantFov = 62; warp = 0; camSwoop = 0;
    } else if (camView === 'drone') {
      // A drone following the car from above, set back so the road coming up shows. It turns with the
      // direction the car is travelling, averaged over a few seconds: a donut or a quick swerve averages
      // out to almost nothing and barely moves it, and once the car settles on a new heading it swings
      // round smoothly.
      if (speed > 1) {
        // (backing up, the way the car faces counts, so reversing out of a spot does not turn the view round)
        const sg = car.vx < -0.5 ? -1 : 1;
        const tx = sg * (Math.sin(car.yaw) * car.vx + Math.cos(car.yaw) * car.vy), tz = sg * (-Math.cos(car.yaw) * car.vx + Math.sin(car.yaw) * car.vy);
        const k = 1 - Math.exp(-dt / 2.2);
        droneDir.x += (tx / speed * Math.min(1, speed / 4) - droneDir.x) * k;
        droneDir.y += (tz / speed * Math.min(1, speed / 4) - droneDir.y) * k;
      }
      const sure = Math.min(1, Math.hypot(droneDir.x, droneDir.y));
      if (sure > 0.05) {
        let dd = Math.atan2(droneDir.x, -droneDir.y) - droneYaw;
        dd = Math.atan2(Math.sin(dd), Math.cos(dd));
        droneYaw += dd * (1 - Math.exp(-dt * 1.4 * sure * sure));
      }
      const dx = Math.sin(droneYaw), dz = -Math.cos(droneYaw);
      const h = 30 + Math.min(speed, 60) * 0.3, ahead = 12 + Math.min(speed, 60) * 0.5;
      camPos.set(car.x - dx * h * 0.55, camY + h, car.z - dz * h * 0.55);
      camLook.set(car.x + dx * ahead, camY, car.z + dz * ahead);
      wantFov = 55; warp = 0;
    }
    tunnel += (warp - tunnel) * Math.min(1, dt * 2);
    if (flyIn) {
      flyIn.t = Math.min(1, flyIn.t + dt / FLY_IN);
      const k = smooth(flyIn.t), ky = smooth(Math.max(0, (flyIn.t - 0.12) / 0.88));   // stay up a moment, then drop in
      camera.position.set(
        flyIn.from.x + (camPos.x - flyIn.from.x) * k,
        flyIn.from.y + (camPos.y - flyIn.from.y) * ky,
        flyIn.from.z + (camPos.z - flyIn.from.z) * k);
      camera.fov = flyIn.fov + (wantFov - flyIn.fov) * k;
    } else if (camSwoop > 0) { camSwoop -= dt; camera.position.lerp(camPos, ease(8)); }
    else camera.position.copy(camPos);
    if (!flyIn) camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 3);
  } else if (intro) {
    introFocus = intro.step(dt, camPos, camLook);
    camera.position.copy(camPos);
    camera.fov = isTouch ? 52 : 55;
  } else {
    menuAngle += dt * 0.16;
    const a = car.yaw + Math.PI + Math.sin(menuAngle) * 0.85;   // sweep around the rear three-quarters
    const cs = s.cam || {}, r = 7.4 + (cs.menu ?? 0);
    camPos.set(car.x + Math.sin(a) * r, car.y + 1.9 + (cs.menuUp ?? 0), car.z - Math.cos(a) * r);
    camLook.set(car.x, car.y + 0.75 + (cs.menuLook ?? 0), car.z);
    camera.position.copy(camPos);
    camera.fov = isTouch ? 40 : 46;
  }
  const tv = mode === 'drive' ? tunnel : 0;
  if (Math.abs(tv - tunnelShown) > 0.004) { tunnelShown = tv; tunnelEl.style.opacity = tv.toFixed(3); }
  if (window.__cam) { camera.position.fromArray(window.__cam, 0); camLook.fromArray(window.__cam, 3); camera.fov = window.__cam[6] ?? 55; }   // test hook
  if (fade?.phase === 'out') { camera.position.copy(fade.from); camera.fov = fade.fov; }   // the drone's view stays put while it darkens
  camera.updateProjectionMatrix();
  camera.lookAt(camLook);
  if (fade) {
    if (fade.phase === 'out') {
      camera.quaternion.copy(fade.q);
      fade.t = Math.min(1, fade.t + dt / FADE_OUT);
      if (fade.t >= 1) { fade.phase = 'hold'; fade.t = 0; camSnap = true; }
    } else if (fade.phase === 'hold') {
      // stay dark a few frames behind the car while the ground and models around it go up to the GPU
      fade.t += dt; fade.frames++;
      if (fade.frames >= 4 && (world.ready(car.x, car.z) || fade.t > 2)) { fade.phase = 'in'; fade.t = 1; }
    } else {
      fade.t = Math.max(0, fade.t - dt / FADE_IN);
      if (fade.t <= 0) fade = null;
    }
    const o = fade ? (fade.phase === 'hold' ? 1 : smooth(fade.t)) : 0;
    fadeEl.style.opacity = o.toFixed(3);
    fadeEl.style.visibility = o > 0 ? 'visible' : 'hidden';
  }
  if (flyIn) {
    // turn from the drone's view to the chase view a little ahead of the move, so the car is in frame on arrival
    camera.quaternion.slerpQuaternions(flyIn.q0, flyQ.copy(camera.quaternion), smooth(Math.min(1, flyIn.t / 0.8)));
    if (flyIn.t >= 1) flyIn = null;
  }

  // ---- world updates
  sky.position.copy(camera.position);
  sky.material.uniforms.uTime.value = elapsed;
  if (intro) lights.sun.target.position.copy(camLook);
  else lights.sun.target.position.set(car.x, car.y, car.z);
  lights.sun.position.copy(lights.sun.target.position).add(lights.sunOffset);
  water.update(elapsed);
  edge.mat.uniforms.uCam.value.copy(camera.position);
  edge.mat.uniforms.uTime.value = elapsed;
  updateTrees(elapsed, camera.position);
  kuuni?.frame(dt, camera);                       // the Anderson's hologram turns to the camera
  tileTimer -= dt;
  if (tileTimer <= 0) {
    tileTimer = 0.25;
    trackside.update(car.x, car.z);
    trackKerbs.update(car.x, car.z);
    if (intro) world.update(introFocus.x, introFocus.z, quality.loadRadius, quality.loadRadius + 500, { x: car.x, z: car.z, r: 300 });
    else world.update(car.x, car.z, quality.loadRadius, quality.loadRadius + 500, flyIn && { x: flyIn.from.x, z: flyIn.from.z, r: 700 });
    terrain.update(camera.position);
    for (const s of world.sectors.values()) if (s.tree) s.tree.setNear(s.d < 260);
  }
  hudTimer -= dt;
  if (mode === 'drive' && hudTimer <= 0) { hudTimer = 0.06; hud.update(car); }
  if (mode === 'drive') hud.needle(car, dt);
  audio.update(car, mode === 'drive' && !bigmap.isOpen);
  audio.updateRemotes(mp.remotes(), camera, mode === 'drive' && !bigmap.isOpen);

  if (photos?.update(camera, dt)) {
    const hideTrees = photos.mix > 0.5 && params.get('phtrees') !== '1';   // the photo has the real trees in it
    for (const s of world.sectors.values()) if (s.tree) s.tree.group.visible = !hideTrees;
    treesHidden = hideTrees;
    photos.render(scene, camera, model.group);
  } else if (!(intro?.fixed && ts - lastDraw < 30)) {
    // (the still drone shot behind the menu on a phone is drawn at about 30 frames a second, which
    // looks the same and leaves the phone cooler for the drive)
    lastDraw = ts;
    if (treesHidden) { treesHidden = false; for (const s of world.sectors.values()) if (s.tree) s.tree.group.visible = true; }
    renderer.render(scene, camera);
  }

  // ---- adaptive quality: drop resolution, then shadows, if the device struggles
  if (settle > 0) slowFrames = 0;
  else if (dt > 0.036) slowFrames++; else slowFrames = Math.max(0, slowFrames - 2);
  if (slowFrames > 120) {
    slowFrames = 0;
    if (renderer.getPixelRatio() > 1) renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - 0.5));
    else if (fewerTrees()) { /* leafy trees only closer to the car */ }
    else if (renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; lights.sun.castShadow = false; }
  }
}

// debug / test hook
window.__game = {
  // advance the physics without rendering (used by automated tests)
  sim(seconds, inp = {}) { for (let t = 0; t < seconds; t += 1 / 60) stepCar(car, inp, world, 1 / 60); },
  get car() { return car; }, get world() { return world; }, get mode() { return mode; }, get flying() { return !!flyIn || !!fade; }, setCar, goHome, place, startDriving, openMap, dropAt, skids: () => skids, smoke: () => smoke, bigmap: () => bigmap, renderer, scene, camera, terrain: () => terrain, photos: () => photos,
  race: () => race, mp: () => mp, audio, props: () => props, janese: () => janese, parked: () => parked, aksi: () => aksi, discgolf: () => discgolf };

boot().then(() => requestAnimationFrame(frame)).catch((err) => {
  console.error(err);
  $('#loadmsg').textContent = `Could not load the game: ${err.message}`;
});
