// (first: it watches every canvas the game paints, for the graphics being lost in the background)
import { gfxLoss } from './gfxloss.js';
import * as THREE from 'three';
import { loadWorldData, SURFACE } from './world/data.js';
import { createSky, createEnvironment, createLights, FOG_COLOR } from './world/sky.js';
import { createTerrain } from './world/terrain.js';
import { jobs } from './jobs.js';
import { createHitches, outside } from './hitches.js';
import { skinLog } from './world/houseskin.js';
import { warm as warmer } from './warm.js';
import { createBuildings, createTrees, updateTrees, setTreeDistance, createLowObjects, createWater, createEdgeGrid } from './world/scenery.js';
import { CARS, CAR_ORDER as CAR_ORDER_ALL, CAR_GROUPS as CAR_GROUPS_ALL, HIDDEN_CARS } from './cars/specs.js';
import { STEALTH } from './net/stealth.js';
import { createGarage } from './garage.js';
import { createCar, stepCar, resetCar, speedKmh, shiftGear, setDonutHelp, setTurnIn, setInward, setLaunch } from './cars/physics.js';
import { buildPlaceholder } from './cars/placeholder.js';
import { createInput } from './input.js';
import { createPads, buttonName } from './controls/pads.js';
import { createSetup } from './controls/setup.js';
import { createAudio } from './audio.js';
import { createTrackKerbs } from './race/trackkerbs.js';
import { updateShelters } from './world/shelter.js';
import { updateFences } from './world/breakfence.js';
import { createHud, tyreIcon } from './hud.js';
import { createStreetPhotos } from './world/streetphotos.js';
import { createRoadMarkings } from './world/roads.js';
import { buildDeckBodies } from './world/decks.js';
import { createWalls } from './world/walls.js';
import { createProps } from './world/props.js';
import { fixRoadProps } from './world/roadprops.js';
import { thinProps, handZones } from './world/propspacing.js';
import { createJanese } from './world/janese.js';
import { createParked } from './world/parked.js';
import { createBusStops, busStopProps, busStopClear, STOPS } from './world/busstops.js';
import { adsReady } from './world/adverts.js';
import { createAksi, aksiProps } from './world/aksi.js';
import { createPootsmani, pootsmaniProps, pootsmaniWalls } from './world/pootsmani.js';
import { createPootsmani12, pootsmani12Walls } from './world/pootsmani12.js';
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
import { createVabadusLights } from './world/vabaduslights.js';
import { createKvissentaliTee, kvissentaliProps, kvissentaliWalls } from './world/kvissentalitee.js';
import { createSireli, sireliWalls } from './world/sireli.js';
import { createCoop, coopWalls, coopProps, coopClear, coopSignSkip } from './world/coop.js';
import { createJaaaeg, jaaaegWalls, jaaaegProps } from './world/jaaaeg.js';
import { createDiscGolf } from './world/discgolf.js';
import { createJaneseMaja, janeseVectors, janeseWalls } from './world/janesemaja.js';
import { createArhitekti, arhitektiWalls, arhitektiProps, arhitektiVectors } from './world/arhitekti.js';
import { createElva, elvaWalls, elvaVectors } from './world/elva.js';
import { createVanemuise, vanemuiseWalls } from './world/vanemuise.js';
import { createPepleriVanemuise, pepleriVanemuiseWalls } from './world/peplerivanemuise.js';
import { createKorvekula, korveWalls, korveRoads } from './world/korvekula.js';
import { raadiRoads, raadiClear, raadiClearing } from './world/raadipaths.js';
import { createKorvekula2, korve2Walls } from './world/korvekula2.js';
import { createRiia, riiaWalls, riiaVectors } from './world/riia.js';
import { createTeatripark, teatriparkVectors } from './world/teatripark.js';
import { createKontserdimaja, kontserdimajaWalls, kontserdimajaVectors, levelKontserdimaja } from './world/kontserdimaja.js';
import { createKorvekula3, korve3Walls } from './world/korvekula3.js';
import { createKorvekula4, korve4Walls } from './world/korvekula4.js';
import { createHariduse10, haridus10Walls, haridus10Props } from './world/hariduse10.js';
import { createKatoliku, katolikuWalls, katolikuVectors } from './world/katoliku.js';
import { createKatoliku2, katoliku2Walls } from './world/katoliku2.js';
import { createVeskiFronts, veskiFrontsWalls } from './world/veskifronts.js';
import { createNoela, noelaWalls } from './world/noela.js';
import { createRaadi, raadiWalls } from './world/raadi.js';
import { createRaadi2, raadi2Walls } from './world/raadi2.js';
import { createRaadi3, raadi3Walls } from './world/raadi3.js';
import { createRaadi4, raadi4Walls } from './world/raadi4.js';
import { createLounakeskus, lounakeskusWalls } from './world/lounakeskus.js';
import { createLounakeskus2, lounakeskus2Walls } from './world/lounakeskus2.js';
import { createLounakeskus3, lounakeskus3Walls } from './world/lounakeskus3.js';
import { createLounakeskus4, lounakeskus4Walls } from './world/lounakeskus4.js';
import { createLounakeskus5, lounakeskus5Walls } from './world/lounakeskus5.js';
import { createTuru, turuWalls } from './world/turu.js';
import { createTuru2, turu2Walls } from './world/turu2.js';
import { createTuru3, turu3Walls } from './world/turu3.js';
import { createTuru4, turu4Walls, turu4SignSkip } from './world/turu4.js';
import { createTuru5, turu5Walls } from './world/turu5.js';
import { createUlikooli, ulikooliWalls, ulikooliClear, ulikooliProps, ulikooliSignSkip } from './world/ulikooli.js';
import { createUlikooli2, ulikooli2Walls, ulikooli2Props } from './world/ulikooli2.js';
import { createUlikooli3, ulikooli3Walls, ulikooli3Props } from './world/ulikooli3.js';
import { createUlikooli4, ulikooli4Walls } from './world/ulikooli4.js';
import { createUlikooli5, ulikooli5Walls } from './world/ulikooli5.js';
import { createNarva, narvaWalls, narvaClear } from './world/narva.js';
import { createNarva2, narva2Walls } from './world/narva2.js';
import { createNarva3, narva3Walls } from './world/narva3.js';
import { createNarva4, narva4Walls } from './world/narva4.js';
import { createNarva5, narva5Walls } from './world/narva5.js';
import { createNarva6, narva6Walls } from './world/narva6.js';
import { createNarva7, narva7Walls } from './world/narva7.js';
import { createAovere, aovereWalls } from './world/aovere.js';
import { createAovere2, aovere2Walls } from './world/aovere2.js';
import { createAovere3, aovere3Walls } from './world/aovere3.js';
import { createAoverePaint, aoverePaintVectors, aovereClear } from './world/aoverepaint.js';
import { createRehetare, rehetareWalls } from './world/rehetare.js';
import { createRattasepa, rattasepaWalls } from './world/rattasepa.js';
import { createUlikooliPaint, ulikooliPaintVectors } from './world/ulikoolipaint.js';
import { createUlenurmePaint, ulenurmePaintVectors } from './world/ulenurmepaint.js';
import { createTuru6, turu6Walls } from './world/turu6.js';
import { createAstelpaju, astelpajuWalls } from './world/astelpaju.js';
import { createLaiFronts, laiFrontsWalls } from './world/laifronts.js';
import { createKvissentali2, kvissentali2Walls } from './world/kvissentali2.js';
import { createArukula, arukulaWalls, arukulaSignSkip } from './world/arukula.js';
import { createLennujaam, lennujaamWalls } from './world/lennujaam.js';
import { createErm, ermWalls } from './world/erm.js';
import { createKaupmehe, kaupmeheWalls, kaupmeheSignSkip } from './world/kaupmehe.js';
import { createRaadiManor, raadiManorWalls } from './world/raadimanor.js';
import { createVaksali, vaksaliWalls } from './world/vaksali.js';
import { createLennuakadeemia, lennuakadeemiaWalls } from './world/lennuakadeemia.js';
import { createUlenurme } from './world/ulenurme.js';
import { createUlenurmeKonsum, ulenurmeKonsumWalls } from './world/ulenurmekonsum.js';
import { createRoad3, road3PaintVectors } from './world/road3raadi.js';
import { createKaluri, kaluriProps, kaluriClear, kaluriVectors } from './world/kaluri.js';
import { createRaadiPark, raadiParkTrees, raadiParkProps } from './world/raadipark.js';
import { createRaadiStart, raadiStartProps, raadiStartClear, raadiStartVectors } from './world/raadistart.js';
import { createIsaJaPoeg } from './world/isapoeg.js';
import { createRiia2, riia2Walls } from './world/riia2.js';
import { skipHidden, onePass } from './still.js';
import { createRiia3, riia3Walls, riia3Clear } from './world/riia3.js';
import { createRiia4, riia4Walls } from './world/riia4.js';
import { createRiia5, riia5Walls } from './world/riia5.js';
import { createRiia6, riia6Walls } from './world/riia6.js';
import { createRiia7 } from './world/riia7.js';
import { createKuperjanovi2, kuperjanovi2Walls } from './world/kuperjanovi2.js';
import { createRavila, ravilaWalls, ravilaClear } from './world/ravila.js';
import { createRavila2, ravila2Walls } from './world/ravila2.js';
import { createRavila3, ravila3Walls } from './world/ravila3.js';
import { lounaPaintVectors } from './world/lounapaint.js';
import { turuPaintVectors } from './world/turupaint.js';
import { narvaPaintVectors } from './world/narvapaint.js';
import { createSigns } from './world/signs.js';
import { mandelWalls, mandelProps, mandelSignSkip } from './race/mandel.js';
import { veskiEndWalls, veskiEndProps } from './race/veskiend.js';
import { kroonuaiaWalls, kroonuaiaProps, kroonuaiaClear, kroonuaiaRoads } from './race/kroonuaia.js';
import { jakobiLaiWalls, jakobiLaiVectors } from './race/jakobilai.js';
import { realStreetNames } from './world/streetnames.js';
import { createSkidMarks } from './skidmarks.js';
import { createSmoke } from './smoke.js';
import { createPlumes } from './cars/plumes.js';
import { createRocketUi } from './rocketui.js';
import { refillTank } from './cars/thrust.js';
import { createBigMap } from './bigmap.js';
import { createIntro } from './intro.js';
import { createPhoneTextures } from './world/phonetex.js';
import { slots as startSlots, pick as pickSlot } from './race/startslots.js';
import { createStartLane } from './race/startlane.js';
import { createRace, createTrack, snapRoadsToTrack, levelTrackShoulders, escapeHtml } from './race/race.js';
import { createMultiplayer } from './net/multiplayer.js';
import { setCarPlate } from './cars/plate.js';
import { createPeople, ME_COLOUR } from './net/people.js';
import { createKudos } from './kudos.js';
import { createBoard } from './race/board.js';
import { createTrackside, clearProps, extraProps } from './race/trackside.js';
import { pavedPatches, cornerOverPaint } from './race/corners.js';
import { junctionOverPaint } from './race/junctionkerbs.js';
import { veskiRoads } from './race/veski.js';
import { emajoeVectors, levelEmajoeWall } from './race/emajoe.js';
import { laiVectors } from './race/lai.js';
import { uueturuVectors, uueturuWalls } from './race/uueturu.js';
import { playtechWalls } from './race/playtech.js';
import { valliWalls } from './race/valli.js';
import { valliStreetWalls, valliStreetProps } from './race/vallistreet.js';
import { baeriStreetWalls, baeriStreetProps } from './race/baeristreet.js';
import { pickFromHistory, searchDry, dryLevel } from './respawn.js';
import { createQuality, probeGpu, createGpuTimer, createLag, weakDesktop } from './quality.js';
import { stats } from './stats.js';
import { createRaceMode } from './race/racemode.js';
import { createStage, onStage } from './race/raadi.js';
import { stageGravel } from './race/raadi-edge.js';
import { setUnrutted } from './world/roadtex.js';
import { setPaintScale } from './world/paintscale.js';
import { createSpectate } from './spectate.js';
import { createIdlePark } from './idlepark.js';
import { createRecorder } from './race/replay.js';
import { createLineLog } from './race/linelog.js';
import './kofi.js';                       // the Ko-fi link in the garage (only with ?off=100 for now)

const $ = (s) => document.querySelector(s);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (/[?&]vp=/.test(location.search)) import('./vpcheck.js').then((m) => m.vpCheck());   // rulers to see what a phone cuts off
document.body.classList.toggle('touch', isTouch);
const params = new URLSearchParams(location.search);

const quality = isTouch
  ? { pixelRatio: Math.min(devicePixelRatio, 1.5), shadow: 1024, terrainStride: 2, tileRadius: 380, treeDetail: 0, treeShadows: false, thinTrees: true, anisotropy: 4, far: 2600, loadRadius: 520, xTiles: false, roadTex: 512 }
  : { pixelRatio: Math.min(devicePixelRatio, 2), shadow: 2048, terrainStride: 1, tileRadius: 560, treeDetail: 1, treeShadows: true, thinTrees: false, anisotropy: 8, far: 5200, loadRadius: 1000, xTiles: true };
// realistic trees; ?trees=old brings back the simple shapes
quality.realTrees = params.get('trees') !== 'old';
if (params.get('donut') === '1') { setDonutHelp(true); console.info('donut helper on (?donut=1)'); }
if (params.get('turnin') === 'normal') { setTurnIn('normal'); console.info('old fixed steering into a slide (?turnin=normal)'); }
if (params.get('inward') === '0') { setInward(false); console.info('held steering stops at the grip limit (?inward=0)'); }
// cars with an engine start like manuals (clutch drop); ?launch=0 brings back the torque converter,
// ?launch=<rpm> or ?launch=idle change the start, ?slip=1 keeps the clutch slipping on every car (the F40 always)
if (params.get('launch') === '0') { setLaunch(false); console.info('torque converter starts (?launch=0)'); }
else if (params.has('launch') || params.get('slip') === '1') {
  const l = params.get('launch'), rpm = l === 'idle' ? 0 : +l > 1000 ? +l : null;
  setLaunch(true, rpm, params.get('slip') === '1');
  console.info(`manual starts: ${rpm === 0 ? 'from idle' : `clutch dropped at ${rpm ?? 'a third of the redline'} rpm`}${params.get('slip') === '1' ? ', clutch kept slipping in first (?slip=1)' : ''}`);
}
// the top the graphics quality may climb to on this device (src/quality.js steps down from it when the frame rate drops)
const gfxCaps = { dpr: quality.pixelRatio, shadow: quality.shadow, trees: quality.treeDetail > 0 ? 150 : 70, load: quality.loadRadius, far: quality.far };
const lockedLow = params.get('q') === 'low';
if (lockedLow) Object.assign(quality, { pixelRatio: 1, shadow: 0, terrainStride: 2, treeDetail: 0, treeShadows: false, thinTrees: true, loadRadius: 420 });
// a browser drawing without the graphics card (hardware acceleration off: often the case in Brave
// reports) starts at the bottom of the ladder, without edge smoothing, and says how to fix it
const gpu = probeGpu();
if (gpu.software) console.warn('WebGL is running in software, without the graphics card:', gpu.renderer || '(renderer hidden)');

// Extra low for old computers (Martin's ThinkPad T440s of 2013, 21 Nov 2026: 18 FPS on the lowest level,
// half of each frame the browser preparing the picture and half the graphics chip drawing it). What can
// only be chosen before the game is built: the phones' ground (a 4 m grid instead of 2 m: the ground was
// over half of all triangles), ground squares loaded less far, thinner far trees, smaller road pictures,
// and no edge smoothing. A desktop gets it when the browser says it is weak, when graphics are set to
// LOW, or when auto graphics spent the last visit on the two lowest levels (the mark is taken away once a
// drive holds full sharpness, so a computer that was only busy gets the full game back). ?xlow tries it
// anywhere, ?xlow=0 turns it off. The auto levels still work on top of it.
const XLOW = 'kvissuroam.xlow';
const stored = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const xlow = isTouch || params.get('xlow') === '0' ? '' : params.has('xlow') ? 'asked for with ?xlow'
  : navigator.webdriver ? '' : weakDesktop(gpu) || (stored('kvissuroam.gfx') === 'low' ? 'graphics set low' : stored(XLOW) ? 'slow last time' : '');
if (xlow) {
  Object.assign(quality, { terrainStride: 2, tileRadius: 380, treeShadows: false, thinTrees: true, anisotropy: 4, xTiles: false, roadTex: 512 });
  console.info('Extra low (simple ground, no edge smoothing):', xlow);
}

const canvas = $('#view');
// (?aatest: edge smoothing also when drawn in software, for test pictures: tools/ghost-fade-shots.mjs)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: (!isTouch && !gpu.software && !xlow) || params.has('aatest'), powerPreference: 'high-performance' });
// samples of the picture's edge smoothing, 0 without (asked now, with the picture itself still the place drawn to):
// how a see-through ghost car is drawn, see setFade in net/multiplayer.js
const aaSamples = (() => { try { const gl = renderer.getContext(); return gl.getContextAttributes()?.antialias ? gl.getParameter(gl.SAMPLES) | 0 : 0; } catch { return 0; } })();
// pictures of queued work go to the graphics card one by one (on phones as their small copy: see phonetex.js)
const sendTex = (tex) => { shrinker?.texture(tex); renderer.initTexture(tex); };
jobs.setUploader(sendTex);
// Another player's car on its way to the graphics card, before it is first drawn (Martin 2026-11-25, 85 to 95
// online: "some stutters every now and then" on a desktop whose frame times read fine). A kind of car's pictures
// went up one a frame already, but its model did not: the 4 to 13 MB of a car's pieces were all sent in the frame
// that first drew a car of that kind whole, each kind once, whenever such a car first came near. Now a step a
// frame, taken by the frame itself after the queued work (not in a frame where that sent a picture, and the
// warmer then sends none of its own): one picture, or about CARD_MB of the model's buffers, sent by drawing them
// into a picture of one pixel (three.js sends a buffer when it first draws with it, wherever that is).
const CARD_MB = 2;
const cardQueue = [];
let cardRT = null, cardMesh = null, cardCam = null, cardWait = 0;
// One buffer of a model (a piece's corners, its normals, its triangle list ...) to the graphics card: three.js
// keeps a buffer by the attribute it came from, so sent here through a stand-in piece that borrows it, the real
// piece finds it there when it is first drawn. `pos`: the piece's corners (a piece cannot be drawn without).
function sendBuffer(pos, name, attr, index) {
  if (!cardRT) {
    cardRT = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    cardMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ fog: false, toneMapped: false }));
    cardMesh.frustumCulled = false;
    // (one triangle of it is drawn: the whole buffer is sent all the same, and the card has nothing to work out)
    cardMesh.geometry.setDrawRange(0, 3);
    cardCam = new THREE.Camera();
  }
  const g = cardMesh.geometry;
  for (const k of Object.keys(g.attributes)) g.deleteAttribute(k);
  g.setAttribute('position', pos);
  if (name && name !== 'position') g.setAttribute(name, attr);
  g.setIndex(index || null);
  const was = renderer.getRenderTarget(), auto = renderer.shadowMap.autoUpdate;
  renderer.shadowMap.autoUpdate = false;
  try { renderer.setRenderTarget(cardRT); renderer.render(cardMesh, cardCam); }
  finally {
    renderer.setRenderTarget(was); renderer.shadowMap.autoUpdate = auto;
    // (let go of the borrowed buffers: the stand-in is never disposed, which would free them on the card)
    for (const k of Object.keys(g.attributes)) g.deleteAttribute(k);
    g.setIndex(null);
  }
}
function toCard(obj) {
  return new Promise((done) => cardQueue.push((function* () {
    try {
      const texs = new Set(), geos = new Set();
      const shown = (o) => { for (let q = o; q && q !== obj.parent; q = q.parent) if (!q.visible) return false; return true; };
      obj.traverse((o) => {
        if (!o.isMesh || !shown(o)) return;          // (not the modelled body under a scanned one: it is never drawn)
        for (const m of [o.material].flat()) for (const v of Object.values(m || {})) if (v?.isTexture) texs.add(v);
        if (o.geometry?.attributes?.position) geos.add(o.geometry);
      });
      // (a phone that let the kind go meanwhile, dropCarModel, has freed all this: nothing more of it is sent)
      for (const t of texs) { if (obj.userData.dropped) return; renderer.initTexture(t); yield (t.image?.width || 0) * (t.image?.height || 0) || 1; }
      let n = 0;
      const size = (a) => (a?.isInterleavedBufferAttribute ? a.data.array : a?.array)?.byteLength || 0;
      for (const g of geos) {
        const pos = g.attributes.position;
        for (const [k, a] of [...Object.entries(g.attributes), ['', g.index]]) {
          if (!a) continue;
          if (obj.userData.dropped) return;
          // (a buffer that would take the step past CARD_MB starts the next frame's)
          if (n > 0 && n + size(a) > CARD_MB * 1048576) { n = 0; yield 4e5; }
          if (k) sendBuffer(pos, k, a, null); else sendBuffer(pos, '', null, a);
          n += size(a);
        }
      }
    } catch (err) { console.warn(err); } finally { done(); }
  })()));
}
// one step; gives the pixels (or 1) it sent, 0 with nothing waiting
function cardStep() {
  while (cardQueue.length) {
    const r = cardQueue[0].next();
    if (!r.done) return r.value;
    cardQueue.shift();
  }
  return 0;
}
renderer.setPixelRatio(quality.pixelRatio);
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = quality.shadow > 0;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
skipHidden(scene);                // hidden places are not walked every frame (src/still.js)
scene.fog = new THREE.Fog(FOG_COLOR, 420, 2800);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.3, quality.far);
// (what builds itself during a drive is made ready for the graphics card before it is shown: src/warm.js; ?warm=0 for the old way)
warmer.init(renderer, scene, camera, { on: params.get('warm') !== '0', send: sendTex });
const sky = createSky();
sky.scale.setScalar(quality.far * 0.9);
scene.add(sky);
const lights = createLights(scene, quality.shadow);
const gpuTimer = createGpuTimer(renderer.getContext());
const lag = createLag(renderer.getContext());   // how far the picture is behind the game (see createLag)
// short hitches while driving and what each was (src/hitches.js), for the options window and /stats
const hitches = createHitches({ report: (h) => stats.hitch(h) });
let lagSteps = 0, driveT = 0;
const heldPics = { held: 0, count: false };       // for AUTO graphics: pictures held back since the last frame (createPacer in src/quality.js)
// how far the camera sees (the extra low level pulls it in): the haze ends just before it, the sky dome follows
function setFar(m) {
  const far = Math.min(quality.far, m);
  if (camera.far === far) return;
  camera.far = far; camera.updateProjectionMatrix();
  sky.scale.setScalar(far * 0.9);
  scene.fog.far = far < quality.far ? far * 0.95 : 2800;
}
const gfx = createQuality({ renderer, sun: lights.sun, scene, camera, quality, setTrees: setTreeDistance, setFar, firstUse: (o) => warmer.firstUse(o), trimmed: (k) => stats.trim(k) }, gfxCaps, {
  locked: lockedLow, software: gpu.software, even: params.get('even') !== '0',
  headless: navigator.webdriver && params.get('gfx') !== 'auto',   // automated test runs keep the full settings, so their pictures stay comparable
});
// Effects follow the graphics level too: once auto has had to go below full sharpness the tyre and
// soot smoke is thinned out, and on the bottom rungs the engine sound loses its echoes and reverb,
// only the nearest other car is heard and other cars smoke only close by.
function applyFx() {
  const l = gfx.levels[gfx.level];
  if (!l) return;
  const top = gfx.levels[gfx.levels.length - 1].dpr;
  const k = l.dpr >= Math.min(1, top) ? 1 : l.dpr >= 0.9 ? 0.6 : 0.35;
  smoke?.setDetail(k);
  audio.setLite(k < 0.5);
  terrain?.setCoarse(coarseStep());
}
// the far ground's grid: every second line only below full sharpness (see setCoarse in terrain.js)
function coarseStep() { const l = gfx.levels[gfx.level]; return l && l.dpr < 1 ? 2 : 1; }
gfx.onChange(applyFx);
// Weak desktops get the phones' lighter setup as well: pictures kept small and held once, a still picture
// behind the opening menu and fewer, simpler parked cars. A desktop counts as weak when the browser says
// so before anything is drawn (weakDesktop in quality.js), when graphics are set to LOW, or when auto
// graphics settled below full sharpness the last time. One that turns out slow while driving gets the
// small pictures then (see liteLate in the frame loop); the rest from its next visit. ?lite tries it
// on any computer, ?lite=0 turns it off. (Test runs draw without a graphics card: they stay full.)
const lowRung = () => { const l = gfx.levels[gfx.level]; return !!l && l.dpr < Math.min(1, gfx.levels[gfx.levels.length - 1].dpr); };
let liteWhy = isTouch || params.get('lite') === '0' ? '' : params.has('lite') ? 'asked for with ?lite'
  : navigator.webdriver ? '' : weakDesktop(gpu) || (lowRung() ? (gfx.mode === 'auto' ? 'slow last time' : 'graphics set low') : '');
const lite = isTouch || !!liteWhy;
// light mode paints the hand-built house fronts, shop signs and walls with fewer pixels per metre
// (0.6 each way: a third of the memory). ?paint=1 keeps them full; ?paint=0.5 tries another scale.
// The extra low setup paints them at 0.45: its picture is drawn at half sharpness, where the difference is
// not seen, and painting a house front and sending it to the graphics card were among the longest single
// steps on an old computer (0.1 s and more each, Martin's 2019 MacBook Air, 21 Nov 2026).
if (params.has('paint')) setPaintScale(+params.get('paint') || 1);
else if (xlow) setPaintScale(0.45);
else if (lite) setPaintScale(0.6);
if (liteWhy) console.info('Light mode (small pictures, still menu, simpler parked cars):', liteWhy);
// anonymous game stats (src/stats.js): only on www.linnaring.com
stats.start({ isTouch, lite, software: gpu.software, death: gfx.death });
// Graphics lost in the background (Android, another app and back): the page loads again, the car where it
// was (src/gfxloss.js). Nothing of it runs in a frame.
gfxLoss.watch(canvas, {
  lost: (k) => stats.trouble(k === 'webgl' ? 'glLost' : 'canvasLost'),
  state: () => (mode === 'loading' || !car ? null
    : { drive: mode === 'drive', pose: car.inWater || wetAt ? null : { x: car.x, z: car.z, yaw: car.yaw, y: car.y } }),
});
const resume = gfxLoss.resume;   // { drive, pose } when this page was loaded again for that
if (resume) $('#loadmsg').textContent = 'The graphics were reset while you were away: back in a moment…';
scene.environment = createEnvironment(renderer);
scene.environmentIntensity = 0.9;

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const input = createInput(document.body);
// Game controllers (desktop only): gradual throttle, brake and steering from a pad or a wheel. The one
// touched last drives unless the options say KEYBOARD or CONTROLLER (src/controls/pads.js).
const pads = createPads({ enabled: !isTouch, toast: (t, ms) => hud?.toast(t, ms) });
const DRIVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyX']);
addEventListener('keydown', (e) => { if (DRIVE_KEYS.has(e.code) || (e.code === 'KeyA' && input.wasd)) pads.keyUsed(); }, true);
let ctl = input.state;           // what drives the car this frame: the keys, or pads.state
const audio = createAudio();
let kuperjanovi, kaubamaja, keskus, keskusTee, pepleri, pepVan, orident, delta, kuuni, vabadusLights;
let raceMode = null;               // the online race (src/race/racemode.js)
let rocketUi = null, plumes = null;               // the thrusters' tank on screen (src/rocketui.js)
// thumbs up between players: a neon sign in the receiver's back window, then a small thumb in its row there
// (bags: the cars near with thumbs received this session, ours too; colours as each sender's dot in our list)
const kudosBags = [];
const kudosColour = (id) => (id === mp?.id ? ME_COLOUR : mp?.colourOf(id) || '#ffffff');
const kudos = createKudos({ bags: () => {
  kudosBags.length = 0;
  if (!mp) return kudosBags;
  mp.kudosCars(kudosBags);
  const k = mp.myKudos;
  if (k.kn && model) kudosBags.push({ group: model.group, car: carId, n: k.kn, from: k.kf });
  for (const b of kudosBags) if (!b.colours || b.colours.length !== b.from.length) b.colours = b.from.map((k) => kudosColour(k[0]));
  return kudosBags;
} });
let watch = null;                  // spectator mode, desktop only: the camera follows another player's car (src/spectate.js)
let watchSpec = null;              // the car the HUD shows while watching
const mapHits = [];                // the players' arrows on the minimap as last drawn (canvas pixels), to click
const ownCar = () => car;          // (for the minimap's overlay, whose own "car" is the one the map follows)
const spot = { x: 0, y: 0, z: 0, yaw: 0, vx: 0, vy: 0, yawRate: 0, hit: 0, halfLen: 2.2, halfWid: 0.9, spec: null };    // where the places build around while watching (see PLACES)
// the Raadi rally stage (src/race/raadi.js), while it is tried out only with ?raadi=1
const RAADI = params.get('raadi') === '1';
let stage = null;
let droveOnce = false;                  // DRIVE pressed since the page opened: the first puts the car at a circuit,
                                        // so that circuit's tyres go on (the stored choice of a last visit, gravel, had
                                        // started Toomemägi on gravel; Martin 23 Nov: "any other cases ... both circuits")
let trackPicked = false;                // a track was picked on the start screen since the last DRIVE
if (RAADI) setUnrutted(onStage);
const atRaadi = () => Math.hypot(car.x - 2660, car.z - 470) < 600;
const stageBusy = () => !!stage && (stage.phase === 'count' || stage.phase === 'run');
let world, terrain, water, edge, hud, skids, smoke, bigmap, race, mp, board, props, trackside, trackKerbs, people, janese, aksi, angerja, pootsmani, pootsmani12, kvissentali, raekoda, sireli, coop, jaaaeg, discgolf, janeseMaja, arhitekti, elva, vanemuise, korve, korve2, korve3, korve4, haridus10, katoliku, katoliku2, veskiFronts, riia, teatri, kontserdimaja, noela, raadi, raadi2, raadi3, raadi4, louna, louna2, louna3, louna4, louna5, turu, turu2, turu3, turu4, turu5, turu6, laiFronts, riia2, riia3, riia4, riia5, riia6, riia7, ravila, ravila2, ravila3, kaluri, isaJaPoeg, astelpaju, parked, kuperjanovi2, ulikooli, kvissentali2, arukula, ulikooli2, road3, ulikooli3, ulikooli4, ulikooli5, ulikooliPaint, lennujaam, lennuakadeemia, ulenurme, narva, ulenurmeKonsum, ulenurmePaint, erm, kaupmehe, raadiManor, narva2, vaksali, narva3, narva4, narva5, narva6, narva7, raadiPark, raadiStart, aovere, aovere2, aovere3, aoverePaint, rehetare, rattasepa;
let busStops = null;                 // shelters at every bus stop (src/world/busstops.js)
const withStops = params.get('busstops') !== '0';
let roadFix = null;                 // what src/world/roadprops.js moved and left out (for tests)
let propThin = null;                // the crowded lights and poles src/world/propspacing.js left out (for tests)
let dropping = false;
let car = null, model = null, carId = localStorage.getItem('kvissuroam.car') || 'w201';
// (cars not shown to anyone yet, HIDDEN_CARS in specs.js: only in stealth mode, ?off=100)
// (and on a test server on this computer with ?hidden=1: tools/rocket-online-test.mjs)
const showHidden = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get('hidden') === '1';
const carShown = (id) => STEALTH || showHidden || !HIDDEN_CARS.includes(id);
const CAR_ORDER = CAR_ORDER_ALL.filter(carShown), CAR_GROUPS = CAR_GROUPS_ALL.map((g) => ({ ...g, ids: g.ids.filter(carShown) })).filter((g) => g.ids.length);
if (!CARS[carId] || !carShown(carId)) carId = 'w201';
let mode = 'loading';            // loading | menu | drive
let buildCarModel = null, carModels = null;
let startPose;
let startSpots = null;            // where the start puts the car when its spot is busy (src/race/startslots.js)
let lane = null;                  // the start lane: a car just put on the start passes through the others in it (src/race/startlane.js)
// the start's spot, or with other cars on it a free one near it (Martin 24 Nov: with ~70 online everyone was put on
// the one spot and the pushing apart sent cars up the park wall)
function freeStart() {
  if (!mp || !startSpots) return startPose;
  const s = pickSlot(startSpots, mp.carsNear);
  return s === startSpots[0] ? startPose : { x: s.x, z: s.z, yaw: s.yaw };
}
const history = [];              // recent safe poses for "back to last intact spot"
let histTimer = 0;
let wetAt = null;                // where and when the car went into the water: { x, z, t }
let camYaw = 0, menuAngle = 2.5;
let camDist = 6.4, camY = 0, camSlope = 0, camSnap = true, camSwoop = 0;   // chase rig, eased; camSnap: jump straight to the car; camSwoop: seconds left of the glide in from the menu view
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let intro = null, introFocus = null;   // drone flyover behind the opening menu
const dronePos = new THREE.Vector3(), droneLook = new THREE.Vector3();
let flyIn = null;                // the one second flight from the drone to the chase camera
// Phones get no drone: a still picture of it behind the opening menu, nothing drawn in 3D until DRIVE,
// and then straight to the car (the drone, and even a still drone view, stuttered there and ran an
// iPhone out of memory). ?fixedintro holds the desktop drone on one view (shot=0..1 along its loop):
// that is how public/menu-still.jpg is made.
const fixedIntro = params.has('fixedintro');
let still = lite && !params.has('drive');
// phones: pictures go to the graphics card at most a megapixel, and the canvas a picture was painted
// on is let go once the card has it (an iPhone reloaded the page from lack of memory once today's
// hand-built streets were in): see world/phonetex.js. ?smalltex tries it on a desktop, ?smalltex=0 turns
// it off, ?smalltex=keep only makes the pictures smaller.
let shrinker = (lite || params.has('smalltex')) && params.get('smalltex') !== '0'
  ? createPhoneTextures(renderer, { release: params.get('smalltex') !== 'keep', rest: params.get('rest') !== '0' }) : null;   // (?rest=0: pictures of places left behind stay on the card)
const part = { build: 0, draw: 0 };   // ms a frame of queued building work, and of handing the drawing to the graphics card (running averages, for the readout)
let pace = 16.7;                 // the usual frame time in ms, for the building work's share of a frame
let xlowRun = 0, xlowWas = 0; // seconds of driving on the two lowest levels, or above them (the mark for extra low at the next start)
let lowSince = 0;                // since when auto graphics has been below full sharpness (desktops; see liteLate)
const liteLate = !isTouch && params.get('lite') !== '0' && params.get('smalltex') !== '0';
// Behind the still picture the game warms up, unseen: a few frames are drawn from beside the car, each
// reaching further, so the pictures and models of the start go to the graphics card a few at a time
// (not all in the first frame after DRIVE), and their canvases are let go while the menu is still up.
const WARM_FRAMES = 20;
let warm = 0, warmSkip = 0, pickTimer = 0;
// DRIVE pressed before that warm-up is through: the menu picture stays up, saying so, until the graphics
// card has drawn the last warm-up frame (or 40 s have gone). On an old computer the card needs many
// seconds for the first whole picture, and the game used to start at once: an empty picture with the car
// already driving (Martin's 2019 MacBook Air, 21 Nov 2026). Each warm-up frame also waits for the card to
// finish the one before (createLag in quality.js). Test runs start at once, as before (?warmgate tries it).
const warmGate = lag.available && params.get('warmgate') !== '0' && (!navigator.webdriver || params.has('warmgate'));
let readyWait = 0;               // when DRIVE was pressed during the warm-up (0: not waiting)
// After the warm-up frames, every shader of everything in the scene (seen from the start or not: the near
// versions of cars and houses, other players' cars, signs and lights that come on later) is compiled and its
// first use made, behind the menu. On an iPhone each of them was otherwise a wait of a tenth of a second or
// more in the frame that first drew it, several at once a freeze of 1 s and more in the first minutes of a
// drive (24 Nov 2026, /stats: 172 of 235 phone freezes drew new shaders). See firstUse in src/warm.js.
let sceneShaders = null;           // null: not begun; a promise while compiling; true when done
function shadersReady() {
  if (sceneShaders === true) return true;
  if (!sceneShaders) {
    try { sceneShaders = warmer.ready(scene).then(() => { sceneShaders = true; }, () => { sceneShaders = true; }); } catch { sceneShaders = true; }
  }
  return sceneShaders === true;
}
const warmedUp = () => warm >= WARM_FRAMES && lag.behind === 0 && shadersReady();
function showReady() {
  const b = $('#drive b');
  if (!readyWait) { if (b.dataset.was) { b.textContent = b.dataset.was; delete b.dataset.was; } return; }
  b.dataset.was ||= b.textContent;
  b.textContent = `GETTING READY ${Math.round(100 * Math.min(warm, WARM_FRAMES - 1) / WARM_FRAMES)}%`;
}
// GETTING READY while driving: the spot the car was just put on is still coming. Shown at once on a click
// on the city map (reading that part of the map can take a second or more, and with nothing on the screen
// a player clicks again and again: Martin's son, 21 Nov 2026), and after H, R or a map jump for as long as
// the map under the car is not there yet or pictures of the place are on their way back to the graphics
// card (phones: world/phonetex.js). The car can be driven meanwhile.
const readyEl = $('#getready');
let readyOn = 0, readyMost = 0;   // when it came up (0: not shown), and the most pictures that were waiting
function getReady() {
  if (!readyOn) { readyMost = 0; readyEl.textContent = 'GETTING READY'; readyEl.classList.add('show'); }
  readyOn = performance.now();
}
function getReadyStep(now) {
  const left = shrinker?.pending || 0;
  readyMost = Math.max(readyMost, left);
  const busy = dropping || respawning || left > 0 || !world.ready(car.x, car.z);
  if ((!busy && now - readyOn > 600) || now - readyOn > 20000) { readyOn = 0; readyEl.classList.remove('show'); return; }
  const text = readyMost > 3 && !dropping ? `GETTING READY ${Math.round(100 * (1 - left / readyMost))}%` : 'GETTING READY';
  if (readyEl.textContent !== text) readyEl.textContent = text;
}
// (on phones the car's name sits small under the GAS and BRAKE buttons, not under the rev counter)
if (isTouch) $('#touch .pad.right').appendChild($('#carname'));
document.body.classList.toggle('still', still);
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
    carModels = await import('./cars/models/index.js');
    ({ buildCarModel } = carModels);
    // (a car's shaders compiled and its textures sent to the graphics card, one a frame, before it is shown)
    // (and the first use of its shader programs made ahead, a program a frame: see firstUse in src/warm.js)
    // (and its model: see toCard, whose own one-pixel drawing is made ready here, behind the loading screen)
    { const g = new THREE.PlaneGeometry(1, 1); sendBuffer(g.attributes.position, '', null, g.index); g.dispose(); }
    carModels.setCarWarmer(async (obj) => {
      await warmer.ready(obj);
      await toCard(obj);
    });
  } catch (err) {
    console.warn('Detailed car models unavailable, using placeholders', err);
  }
  world.vectors.areas = [...(world.vectors.areas || []), ...pavedPatches()];      // rounded kerbs on the lap
  world.vectors.overPaint = [...(world.vectors.overPaint || []), ...cornerOverPaint(), ...junctionOverPaint()];   // and the kerb line round them
  snapRoadsToTrack(world.vectors);
  valliWalls(world.vectors);
  emajoeVectors(world.vectors);                 // own lane lines and garden wall on Emajõe
  veskiRoads(world.vectors);                    // Veski paints its own line beside the red lane (after emajoeVectors, which starts the list of such stretches)
  kroonuaiaRoads(world.vectors);               // Kroonuaia and the Jakobi hill paint their own lines
  raadiClearing(world); raadiParkTrees(world);
  raadiRoads(world.vectors);                    // Raadi park: the gravel cut-through the map lacks, gravel at the park road's mouth
  korveRoads(world.vectors);                    // road 210's fork and sweep where it meets the highway at Kõrveküla
  jakobiLaiVectors(world.vectors);              // road tones from Baeri through Jakobi to Lai
  realStreetNames(world.vectors);               // street names for the label, not the state road's route name
  janeseVectors(world.vectors);                // Jänese tänav has no painted lines
  arhitektiVectors(world.vectors);             // nor has Arhitekti by 24 to 28
  elvaVectors(world.vectors);                  // nor has Elva by 33 to 37, nor the lane by 35b
  katolikuVectors(world.vectors);              // nor has Veski from the Oru corner past the Catholic school
  uueturuVectors(world.vectors);                // no generated centre line through the Uueturu junction
  laiVectors(world.vectors);                    // the rebuilt Lai / Vabaduse junction paints its own ground
  pepleriVectors(world.vectors);                // Vanemuise after the Pepleri turn: cycle lane lines, no centre line
  keskusTeeVectors(world.vectors);              // Küüni by Kaubamaja is a pedestrian street: no lane lines
  riiaVectors(world.vectors);                   // Riia from Kalevi to Pepleri: a double centre line
  teatriparkVectors(world.vectors);             // the Vanemuine forecourt is paving, not a street
  kontserdimajaVectors(world.vectors);          // the park wall stops at the foot of the concert house's steps
  kuuniVectors(world.vectors);                  // Küüni beyond the first corner is a pedestrian street: no road lines
  turuPaintVectors(world.vectors);              // Turu: the hatched island from Soola to Sadama, no centre lines on Sadama and the car park lanes
  road3PaintVectors(world.vectors);             // road 3 north of Kvissentali tee: two lanes, edge lines, the chevron island
  raadiStartVectors(world.vectors);             // Narva mnt beside the Raadi rally start: its lanes, hatching and turn lane, the path's line
  aoverePaintVectors(world.vectors);            // the Haava junction: the hatched band, gore and wedge on road 3
  ulenurmePaintVectors(world.vectors);          // road 2 at the Lennu interchange: lines by the median rail, the hatched wedge and gore
  narvaPaintVectors(world.vectors);             // Narva mnt from Jaama to Peetri: a double solid centre line
  ulikooliPaintVectors(world.vectors);          // Ülikooli, Jakobi, Rüütli, Küütri, Lossi: the old town has no centre lines
  lounaPaintVectors(world.vectors);             // Lõunakeskus to Sõinaste: no centre lines where the real roads have none, edge lines on the ring road
  kaluriVectors(world.vectors);                 // Kaluri lane and the car park behind McDonald's: bay lines only
  uueturuWalls(world.walls);                    // the office building on Uueturu in its real slate grey
  playtechWalls(world.walls);                   // SEB in dark brick, its neighbour white
  pootsmaniWalls(world.walls);                  // houses on Pootsmani in their own colours
  pootsmani12Walls(world.walls);                // and no. 12 on the east arm, built by hand
  raekodaWalls(world.walls);                    // Raekoja plats: its houses in their colours, the town hall by hand
  kuuniWalls(world.walls);                      // Küüni from the first corner to Raekoja plats: house colours (fronts painted in kuuni.js)
  kvissentaliWalls(world.walls);                // Kvissentali tee 10 and 12 are built by hand
  sireliWalls(world.walls);                     // so is Sireli 7a in Kõrveküla
  baeriStreetWalls(world.walls);                // upper Vallikraavi and Baeri
  valliStreetWalls(world.walls);                // the houses at the start of Vallikraavi in their colours
  coopWalls(world.walls);                       // and the Coop Konsum on Aruküla tee
  janeseWalls(world.walls);                     // and Jänese 1
  arhitektiWalls(world.walls);                  // Arhitekti 24, 26 and 28 are built by hand
  elvaWalls(world.walls);                       // and Elva 35b, 35c and 37
  vanemuiseWalls(world.walls);                  // and Vanemuise from Akadeemia to the theatre
  pepleriVanemuiseWalls(world.walls);           // and the lap's fronts from Tiigi down Pepleri and up Vanemuise to Akadeemia
  kontserdimajaWalls(world.walls);              // the concert house's front block over the terrace is built by hand
  korveWalls(world.walls);                      // and Kõrveküla's south approach (Rähni, road 210, the centre)
  korve2Walls(world.walls);                     // and Kõrveküla's school, Kooli tn and the Hariduse tn corner
  riiaWalls(world.walls);                       // and Riia tänav from Küüni towards Pepleri
  korve3Walls(world.walls);                     // and the Kubjaringi green and Hariduse tn by the pond
  korve4Walls(world.walls);                     // and the old Hariduse tn row east of the pond, Pärna 33
  haridus10Walls(world.walls);                  // and Hariduse 10 by the pond, built by hand
  katolikuWalls(world.walls);                   // and the Catholic school on Oru, with its yard
  katoliku2Walls(world.walls);                  // and the Catholic church opposite it and the villa at Veski 5
  veskiFrontsWalls(world.walls);                // Veski's house fronts along the lap, Oru to Kuperjanovi
  noelaWalls(world.walls);                      // and the farms along the village road in Nõela
  raadiWalls(world.walls);                      // and Foxway and the terraces at the west end of Keskuse tee, Raadi
  raadi2Walls(world.walls);                     // and the east end of Keskuse tee with the Mõisapiiri houses
  raadi3Walls(world.walls);                     // and the west end of Mõisapiiri and the Mõisahärra loop
  raadi4Walls(world.walls);                     // and the shops round the route 95 roundabout at Raadi
  lounakeskusWalls(world.walls);                // Lõunakeskus, Hotel Sophia and Teaduspark
  lounakeskus2Walls(world.walls);               // Bauhof, Circle K, McDonald's, KFC, Lidl and Optika
  lounakeskus3Walls(world.walls);               // Alexela, Decora, Stokker, Spektri, Aardla, Olerex
  lounakeskus4Walls(world.walls);               // K-Rauta, the Riia 140 yard, Selver Teemandi, Tammetõru
  lounakeskus5Walls(world.walls);               // the Riia road houses, Riia 128 to Sõinaste
  turuWalls(world.walls);                       // Turu tänav: Swedbank, Circle K, McDonald's, Turu 3 to 7
  turu2Walls(world.walls);                      // Soola and Kaluri: Kaluri 2, Hotell Tartu, the glass office
  turu3Walls(world.walls);                      // AHHAA, the Turu 8 halls, Tigutorn, Väike-Turu 3
  turu4Walls(world.walls);                      // Aura, Zeppelin, Turu 9 and 11
  ulikooliWalls(world.walls);                   // Ülikooli by the town hall: the von Bock house, Werner, Draakon, Lossi 3
  ulikooli2Walls(world.walls);                  // the university's main building and the houses opposite
  ulikooli3Walls(world.walls);                  // Ülikooli kohvik, the old church, Jakobi 4, Munga
  ulikooli4Walls(world.walls);                  // Rüütli from Gildi to the square, Küütri, the Gildi corners
  ulikooli5Walls(world.walls);                  // Ülikooli from the town hall to Poe, Lossi up to Inglisild
  narvaWalls(world.walls);                      // Narva mnt by Võidu sild: Spark Hub, the Fortuuna tower, Narva 9
  narva7Walls(world.walls);                     // Narva mnt from Peetri kirik to Raadi Maxima
  aovereWalls(world.walls);                     // the three houses on Aasa tee by the Haava junction
  aovere3Walls(world.walls);                    // the farms round the Haava junction: Alrey, Kiigi tee, the end of Aasa tee
  aovere2Walls(world.walls);                    // the Haava junction: Olerex's shop (its canopy is built by hand)
  rehetareWalls(world.walls);                   // Soinaste: Rehetare tee 1 (built by hand) and the halls on Rehepapi tee
  rattasepaWalls(world.walls);                  // Soinaste: Rattasepa tee 5 (built by hand) and the strip at Rehepapi tee 4
  narva6Walls(world.walls);                     // Narva mnt 86 to 149: the boarded and plastered houses up towards Peetri
  narva5Walls(world.walls);                     // Narva mnt 84 to 107: the student house, the Jüri church, the boarded houses
  narva4Walls(world.walls);                     // Ujula: the Coop Konsum block and the university sports hall
  narva3Walls(world.walls);                     // Narva mnt 27 to 69: the dormitory, Lemon Gym, Neste, the salmon house
  narva2Walls(world.walls);                     // Narva mnt at Kivi: Linnamuuseum, Circle K, Coop, the cat dormitory, Selver
  turu5Walls(world.walls);                      // Turu south to the Sõpruse bridge
  turu6Walls(world.walls);                      // Aleksandri 8-12, Dorpat hotel
  astelpajuWalls(world.walls);                  // Mööbliait, Circle K and the corner house by road 3
  laiFrontsWalls(world.walls);                  // Jakobi and Lai fronts along the lap
  kvissentali2Walls(world.walls);               // Kvissentali tee from Lootsi to road 3
  arukulaWalls(world.walls);                    // road 3 at Aruküla tee: Salvest, flats, Olerex
  ulenurmeKonsumWalls(world.walls);             // Ülenurme Konsum and the red house beside it
  lennuakadeemiaWalls(world.walls);             // Lennuakadeemia and Lennu 42
  ermWalls(world.walls);                       // the Estonian National Museum and the distillery ruin
  kaupmeheWalls(world.walls);                  // the Kaupmehe flats and the Coop by road 95
  raadiManorWalls(world.walls);                // the Raadi manor's gatehouse, water tower and white house
  vaksaliWalls(world.walls);                   // Tartu railway station, its platforms and the water tower
  lennujaamWalls(world.walls);                  // Tartu Airport: the terminal, the tower, the hangars
  riia2Walls(world.walls);                      // Riia tänav: Riia Kvartal, Riia 24, Pauluse church
  riia3Walls(world.walls);                      // Riia tänav: Aparaaditehas, Hektor, the railway bridge
  riia4Walls(world.walls);                      // Riia tänav: Lembitu to Väike kaar, Oskar Luts's house
  riia5Walls(world.walls);                      // Riia tänav: Väike kaar to Suur kaar, Selver ABC
  riia6Walls(world.walls);                      // Riia tänav: Suur kaar to the Ravila lights
  ravilaWalls(world.walls);                     // Ravila tänav: Riia to Nooruse
  ravila2Walls(world.walls);                    // Ravila tänav: the campus, Nooruse to Tulika
  ravila3Walls(world.walls);                    // Ravila tänav: Tulika to Viljandi mnt, the Coop
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
  kuperjanovi2Walls(world.walls);               // Kuperjanovi from Veski to Vallikraavi: painted fronts
  kuperjanoviWalls(world.walls);                // the white house on the Kuperjanovi corner is built by hand
  pepleriWalls(world.walls);                    // Pepleri: the church is built by hand, the blocks get their colours
  quality.coarseStep = coarseStep();
  terrain = createTerrain(world, renderer, quality);
  scene.add(terrain.group);
  bar.style.width = '88%';
  await new Promise((r) => setTimeout(r));
  await Promise.race([adsReady, new Promise((r) => setTimeout(r, 3000))]);   // the TOREPOOD poster, before the advert atlas is painted
  const buildBuildings = createBuildings(world.walls);
  const buildTrees = createTrees(quality, renderer, world);
  if (buildTrees.near) scene.add(buildTrees.near);
  const buildLow = createLowObjects(world, quality);
  const buildMarks = createRoadMarkings(world);
  const buildWalls = createWalls(world);
  trackside = createTrackside(world, scene);       // before any sector loads: it adds a kerb to the ground
  trackKerbs = createTrackKerbs(world, scene);     // the 10 cm kerbs of the pavements along the lap (before any sector loads too)
  // the hand-placed props of the hand-made places (worked out once: the clear hook keeps lights and poles round them)
  let handPlaced = null;
  const handExtras = () => (handPlaced ||= [...extraProps(), ...aksiProps(), ...pootsmaniProps(), ...kvissentaliProps(), ...mandelProps(), ...veskiEndProps(), ...coopProps(), ...jaaaegProps(), ...valliStreetProps(), ...keskusProps(), ...kroonuaiaProps(), ...baeriStreetProps(), ...pepleriProps(), ...kuuniProps(), ...arhitektiProps(), ...haridus10Props(), ...kaluriProps(), ...ulikooliProps(), ...ulikooli2Props(), ...ulikooli3Props(), ...raadiParkProps(), ...raadiStartProps()]);
  // where crowded lights and poles are not thinned: round hand-placed props, bus stops and hand-painted ground
  const keepOutCircles = (hand) => [
    ...hand.map(([, x, z]) => ({ x, z, r: 60 })),
    ...STOPS.map((st) => ({ x: st.x, z: st.z, r: 20 })),
    ...(world.vectors.overPaint || []).map((a) => {
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (const [x, z] of a.outer) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, r: Math.hypot(x1 - x0, z1 - z0) / 2 + 40 };
    }),
  ];
  const attachProps = props = createProps(world, { shadows: !isTouch, clear: (d) => { const out = clearProps(d); for (const id of coopClear(d)) out.add(id); for (const id of kroonuaiaClear(d)) out.add(id); for (const id of kaluriClear(d)) out.add(id); for (const id of riia3Clear(d)) out.add(id); for (const id of ravilaClear(d)) out.add(id); for (const id of ulikooliClear(d)) out.add(id); for (const id of narvaClear(d)) out.add(id); for (const id of raadiClear(d)) out.add(id); for (const id of raadiStartClear(d)) out.add(id); for (const id of aovereClear(d)) out.add(id); if (params.get('roadprops') !== 'old') { roadFix = fixRoadProps(d, world.vectors, out); for (const id of roadFix.cleared) out.add(id); } if (params.get('thin') !== 'off') { propThin = thinProps(d, world.vectors, handZones(keepOutCircles(handExtras())), out); for (const id of propThin.cleared) out.add(id); } if (withStops) for (const id of busStopClear(d)) out.add(id); return out; }, extra: () => [...handExtras(), ...(withStops ? busStopProps() : [])] });
  mandelSignSkip(world);                        // Mandel's name is painted on its wall, not a box sign
  coopSignSkip(world);                          // the Coop's letters are built on its walls
  ulikooliSignSkip(world);                      // Werner's name is painted on its own front
  arukulaSignSkip(world);                       // the factory shop's boards are painted on its wall
  kaupmeheSignSkip(world);                      // the Coop's name is painted on its wall
  turu4SignSkip(world);                         // Zeppelin's and Aura's letters are painted on their walls
  const attachSigns = createSigns(world);
  janese = createJanese(scene, world, { shadows: !isTouch });
  aksi = createAksi(scene, world, { shadows: !isTouch });
  parked = createParked(scene, world, { shadows: !isTouch, touch: lite });
  if (withStops) busStops = createBusStops(scene, world, { shadows: !isTouch });
  pootsmani = createPootsmani(scene, world, { shadows: !isTouch });
  pootsmani12 = createPootsmani12(scene, world, { shadows: !isTouch });
  angerja = createAngerja(scene, world, { shadows: !isTouch });
  raekoda = createRaekoda(scene, world, { shadows: !isTouch });
  kuuni = createKuuni(scene, world, { shadows: !isTouch });
  kuuni.holo.bindClicks(camera, canvas);         // the Anderson's hologram opens the taproom's site
  busStops?.bindClicks(camera, canvas, () => (mode === 'drive' ? car : null));   // the TOREPOOD poster opens the shop (after the hologram: its hover clears the hand)
  kuperjanovi = createKuperjanovi(scene, world, { shadows: !isTouch });
  pepleri = createPepleri(scene, world, { shadows: !isTouch });
  kaubamaja = createKaubamaja(scene, world, { shadows: !isTouch });
  keskus = createKeskus(scene, world, { shadows: !isTouch });
  keskusTee = createKeskusTee(scene, world, { shadows: !isTouch });
  orident = createOrident(scene, world, { shadows: !isTouch });
  delta = createDelta(scene, world, { shadows: !isTouch });
  vabadusLights = createVabadusLights(scene);
  kvissentali = createKvissentaliTee(scene, world, { shadows: !isTouch });
  sireli = createSireli(scene, world, { shadows: !isTouch });
  coop = createCoop(scene, world, { shadows: !isTouch });
  jaaaeg = createJaaaeg(scene, world, { shadows: !isTouch });
  discgolf = createDiscGolf(scene, world, audio, { shadows: !isTouch });
  janeseMaja = createJaneseMaja(scene, world, { shadows: !isTouch });
  arhitekti = createArhitekti(scene, world, { shadows: !isTouch });
  elva = createElva(scene, world, { shadows: !isTouch });
  vanemuise = createVanemuise(scene, world, { shadows: !isTouch });
  pepVan = createPepleriVanemuise(scene, world, { shadows: !isTouch });
  korve = createKorvekula(scene, world, { shadows: !isTouch });
  korve2 = createKorvekula2(scene, world, { shadows: !isTouch });
  riia = createRiia(scene, world, { shadows: !isTouch });
  teatri = createTeatripark(scene, world, { shadows: !isTouch });
  kontserdimaja = createKontserdimaja(scene, world, { shadows: !isTouch });
  korve3 = createKorvekula3(scene, world, { shadows: !isTouch });
  korve4 = createKorvekula4(scene, world, { shadows: !isTouch });
  haridus10 = createHariduse10(scene, world, { shadows: !isTouch });
  katoliku = createKatoliku(scene, world, { shadows: !isTouch });
  katoliku2 = createKatoliku2(scene, world, { shadows: !isTouch });
  veskiFronts = createVeskiFronts(scene, world, { shadows: !isTouch });
  noela = createNoela(scene, world, { shadows: !isTouch });
  raadi = createRaadi(scene, world, { shadows: !isTouch });
  raadi2 = createRaadi2(scene, world, { shadows: !isTouch });
  raadi3 = createRaadi3(scene, world, { shadows: !isTouch });
  raadi4 = createRaadi4(scene, world, { shadows: !isTouch });
  louna = createLounakeskus(scene, world, { shadows: !isTouch });
  louna2 = createLounakeskus2(scene, world, { shadows: !isTouch });
  louna3 = createLounakeskus3(scene, world, { shadows: !isTouch });
  louna4 = createLounakeskus4(scene, world, { shadows: !isTouch });
  louna5 = createLounakeskus5(scene, world, { shadows: !isTouch });
  turu = createTuru(scene, world, { shadows: !isTouch });
  turu2 = createTuru2(scene, world, { shadows: !isTouch });
  turu3 = createTuru3(scene, world, { shadows: !isTouch });
  turu4 = createTuru4(scene, world, { shadows: !isTouch });
  turu5 = createTuru5(scene, world, { shadows: !isTouch });
  ulikooli = createUlikooli(scene, world, { shadows: !isTouch });
  ulikooli2 = createUlikooli2(scene, world, { shadows: !isTouch });
  ulikooli3 = createUlikooli3(scene, world, { shadows: !isTouch });
  ulikooli4 = createUlikooli4(scene, world, { shadows: !isTouch });
  ulikooli5 = createUlikooli5(scene, world, { shadows: !isTouch });
  narva = createNarva(scene, world, { shadows: !isTouch });
  narva2 = createNarva2(scene, world, { shadows: !isTouch });
  narva3 = createNarva3(scene, world, { shadows: !isTouch });
  narva4 = createNarva4(scene, world, { shadows: !isTouch });
  narva5 = createNarva5(scene, world, { shadows: !isTouch });
  narva6 = createNarva6(scene, world, { shadows: !isTouch });
  narva7 = createNarva7(scene, world, { shadows: !isTouch });
  aovere = createAovere(scene, world, { shadows: !isTouch });
  aovere2 = createAovere2(scene, world, { shadows: !isTouch });
  aovere3 = createAovere3(scene, world, { shadows: !isTouch });
  ulikooliPaint = createUlikooliPaint(scene, world);
  ulenurmePaint = createUlenurmePaint(scene, world);
  aoverePaint = createAoverePaint(scene, world);
  rehetare = createRehetare(scene, world, { shadows: !isTouch });
  rattasepa = createRattasepa(scene, world, { shadows: !isTouch });
  turu6 = createTuru6(scene, world, { shadows: !isTouch });
  astelpaju = createAstelpaju(scene, world, { shadows: !isTouch });
  laiFronts = createLaiFronts(scene, world, { shadows: !isTouch });
  kvissentali2 = createKvissentali2(scene, world, { shadows: !isTouch });
  arukula = createArukula(scene, world, { shadows: !isTouch });
  lennujaam = createLennujaam(scene, world, { shadows: !isTouch });
  erm = createErm(scene, world, { shadows: !isTouch });
  kaupmehe = createKaupmehe(scene, world, { shadows: !isTouch });
  raadiManor = createRaadiManor(scene, world, { shadows: !isTouch });
  vaksali = createVaksali(scene, world, { shadows: !isTouch });
  lennuakadeemia = createLennuakadeemia(scene, world, { shadows: !isTouch });
  ulenurme = createUlenurme(scene, world, { shadows: !isTouch });
  ulenurmeKonsum = createUlenurmeKonsum(scene, world, { shadows: !isTouch });
  road3 = createRoad3(scene, world);
  kaluri = createKaluri(scene, world, { shadows: !isTouch });
  raadiPark = createRaadiPark(scene, world, { lite: isTouch || !!xlow });   // the park's stones (its young trees: raadiParkTrees)
  raadiStart = createRaadiStart(scene, world, { shadows: !isTouch });   // Narva mnt beside the rally start: islands, guard rail, the Tartu vald board
  isaJaPoeg = createIsaJaPoeg(scene, world, { shadows: !isTouch });   // the Isa ja poeg bronze at the first corner
  riia2 = createRiia2(scene, world, { shadows: !isTouch });
  riia3 = createRiia3(scene, world, { shadows: !isTouch });
  riia4 = createRiia4(scene, world, { shadows: !isTouch });
  riia5 = createRiia5(scene, world, { shadows: !isTouch });
  riia6 = createRiia6(scene, world, { shadows: !isTouch });
  riia7 = createRiia7(scene, world, { shadows: !isTouch });
  kuperjanovi2 = createKuperjanovi2(scene, world, { shadows: !isTouch });
  ravila = createRavila(scene, world, { shadows: !isTouch });
  ravila2 = createRavila2(scene, world, { shadows: !isTouch });
  ravila3 = createRavila3(scene, world, { shadows: !isTouch });
  levelTrackShoulders(world);                      // before the ground of a sector is built from its heights
  levelEmajoeWall(world);                          // the strip from the kerb to the garden wall, level with the street
  levelKontserdimaja(world);                       // and the pavements up Vanemuise to its stone wall and the concert house
  // A square of the map has arrived: its ground, houses, trees, markings, walls, bridges, props and signs.
  // In steps (src/jobs.js): done in one go it was 50 to 140 ms on a fast machine, a pause in the drive each time.
  world.onSectorLoad((s) => {
    const H = s.H, here = () => s.state === 'ready' && s.H === H;       // not unloaded (or loaded afresh) meanwhile
    s.job = jobs.add(function* () {
      yield* terrain.addSectorSteps(s);
      if (!here()) return;
      const houses = yield* buildBuildings.steps(s);
      if (!here()) { houses?.geometry.dispose(); return; }
      s.bMesh = houses;
      if (s.bMesh) scene.add(s.bMesh);
      yield; if (!here()) return;
      s.tree = buildTrees(s);
      if (s.tree) scene.add(s.tree.group);
      yield; if (!here()) return;
      s.low = buildLow(s);
      if (s.low) scene.add(s.low);
      s.marks = buildMarks(s);
      if (s.marks) scene.add(s.marks);
      yield; if (!here()) return;
      s.walls = buildWalls(s);
      if (s.walls) scene.add(s.walls);
      s.decks = buildDeckBodies(world, s);
      if (s.decks) scene.add(s.decks);
      yield; if (!here()) return;
      attachProps(s, (g) => { if (s.props || !here()) { g.userData.dispose?.(); return; } s.props = g; scene.add(g); });
      yield; if (!here()) return;
      attachSigns(s, (g) => { if (s.signs || !here()) { g.userData.dispose?.(); return; } s.signs = g; scene.add(g); });
    }, 'sector');
  });
  world.onSectorUnload((s) => {
    s.job?.cancel(); s.job = null;
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
  const loads = [world.loadAround(s0.x, s0.z, 200)];
  if (resume?.pose) loads.push(world.loadAround(resume.pose.x, resume.pose.z, 200));
  if (!params.has('drive') && !params.has('nointro') && !still && !resume) {
    intro = createIntro(world, { fixed: fixedIntro, shot: params.has('shot') ? +params.get('shot') : null });
    introFocus = intro.start();
    loads.push(world.loadAround(introFocus.x, introFocus.z, 450));
  }
  await Promise.all(loads);
  water = createWater(world);
  scene.add(water.group);
  edge = createEdgeGrid(world);
  scene.add(edge.group);
  bar.style.width = '96%';

  const s = world.meta.start;
  startPose = { x: s.x, z: s.z, yaw: s.heading, y: world.heightAt(s.x, s.z) };
  const startTrack = createTrack();
  startSpots = startSlots(startTrack, startPose);
  lane = createStartLane(startTrack, (i) => race?.edgeShift(i));
  hud = createHud(world);
  rocketUi = createRocketUi({ pad: $('#rocketpad'), dial: $('#rocketdial'), bar: $('#thrust'), fan: $('#fan'), touch: isTouch, keys: () => {
    const a = ctl === pads.state ? pads.active : null;
    return a ? `${buttonName(a.gp, a.prof.btn.boost)} BOOST · ${buttonName(a.gp, a.prof.btn.flip)} FLIP` : 'SHIFT BOOST · X FLIP';
  } });
  skids = createSkidMarks(world);
  skids.setGrass(grassMarks);
  skids.setSun(lights.sunOffset);
  scene.add(skids.mesh);
  smoke = createSmoke(world);
  applyFx();
  scene.add(smoke.points);
  plumes = createPlumes();
  scene.add(plumes.mesh);
  const chimed = {};
  mp = createMultiplayer({
    scene, camera, toast: (t, ms) => hud.toast(t, ms),
    // (other players' cars are copies of one built car of each kind: see instanceCarModel)
    buildModel: (id) => { try { return carModels ? carModels.instanceCarModel(id) : buildPlaceholder(CARS[id]); } catch (e) { console.warn('remote car', id, e); return buildPlaceholder(CARS[id]); } },
    // is the first one of this kind built yet (it is built away from the page: see requestCarModel)?
    // now: needed at once; without a worker build it here, unless that would stutter the drive
    modelReady: (id, now) => !carModels || carModels.requestCarModel(id, now || mode !== 'drive' || document.hidden),
    onBoard: () => { race?.refreshBest(); board?.render(); },
    onPeople: (kind, name, old) => {
      // (with many online, people come and go all the time: one chime of a kind in 8 s, none past 20 online)
      if ((kind === 'join' || kind === 'leave') && mp.count <= 20 && performance.now() - (chimed[kind] || -1e9) > 8000) { chimed[kind] = performance.now(); audio.chime?.(kind); }
      people?.event(kind, name, old);
    },
    // our lap timer is running (or we are in a race): the others see it and their cars pass through ours
    stage: RAADI,
    // (a nearby ghost car's see-through shader, compiled before it is first used)
    warm: (obj) => warmer.ready(obj),
    samples: aaSamples,
    // (on the Raadi stage from the start clock on: everybody starts from the same spot, so two players waiting
    // at the line would sit inside each other and push; Martin 2026-11-24, ready for many on the stage)
    hotlap: () => ((!!race?.running || !!stage?.running || stage?.phase === 'count') && mode === 'drive') || !!raceMode?.ghost,
    // just put on the start and still on the lap's road before the line: the same, without the glow (Martin 25 Nov)
    // (or put somewhere a moment ago, by R, the map or a start: nobody is bumped by a car that appears beside them)
    fresh: () => (!!lane?.on || performance.now() - placedAt < 2000) && mode === 'drive',
    racing: (id) => !!raceMode?.racing(id),
    place: (id) => raceMode?.place(id) || 0,
    winner: (id) => !!raceMode?.winner(id),
    onRace: (r) => raceMode?.message(r),
    onRecord: () => audio.chime?.('record'),
    // a thumbs up (src/kudos.js): the sign on the receiver's car wherever it is in view, ours or another's
    onKudos: (from, to) => {
      const who = from === mp.id ? { name: mp.name, colour: ME_COLOUR } : { name: mp.nameOf(from), colour: mp.colourOf(from) };
      const on = to === mp.id ? (model ? { group: model.group, car: carId } : null) : mp.carOf(to);
      // (ours: the airy chord as the big sign goes up, one at a time, see kudos.show)
      if (on && who.name) kudos.show(on.group, on.car, who, to === mp.id ? () => audio.chime?.('kudos') : null);
      if (to === mp.id && who.name) people?.event('kudos', who.name);
    },
    // phones, old computers and the low graphics levels draw other cars whole only nearer
    low: () => isTouch || !!xlow || lowRung(),
    // phones build other players' cars only near, and only a few kinds (memory)
    lean: () => isTouch,
    dropModel: (id) => carModels?.dropCarModel(id, freeModel),
    onPlate: (p) => { if (model) setCarPlate(model, p); },
  });
  people = createPeople({ mp, onFocus: (x, z) => bigmap.focus(x, z), votes: () => raceMode?.voteMarks(),
    onKudos: () => {},
    // (from the big map's list, a second click on a name: the map closes first, then the camera goes to them)
    onWatch: isTouch ? null : (id) => { if (bigmap?.isOpen) closeMap(); if (id) watch?.start(id); else watch?.stop(); }, watching: () => watch?.id || null });
  if (!isTouch) watch = createSpectate({
    mp, world, toast: (t, ms) => hud.toast(t, ms), racing: (id) => !!raceMode?.racing(id),
    busy: () => mode !== 'drive' || !!overlayOpen(),
    // (not in the middle of your own race, nor while the car is being put somewhere)
    canStart: () => {
      if (mode !== 'drive' || dropping || respawning) return false;
      if (raceMode?.holding || raceMode?.ghost) { hud.toast('NOT DURING YOUR RACE', 1800); return false; }
      return true;
    },
    onStart: (o, first) => {
      if (first) {
        // your own car waits where it is, stopped; a lap or a stage run in progress ends
        car.vx = car.vy = car.yawRate = 0;
        race?.cancel('LAP CANCELLED');
        stage?.rest();
        closeOverlays();
      }
      shrinker?.jump(scene, o.pose[0], o.pose[1]);
    },
    onStop: () => {
      watchSpec = null;
      hud.setCar(car.spec); hud.setTyres(tyres);
      camYaw = car.yaw; camSnap = true; droneYaw = car.yaw; droneDir.set(Math.sin(car.yaw), -Math.cos(car.yaw));
      shrinker?.jump(scene, car.x, car.z);
      if (!world.ready(car.x, car.z)) getReady();
    },
  });
  race = createRace({
    world, scene, toast: (t, ms) => hud.toast(t, ms),
    rec: createRecorder(mp.pose),
    // (the lap's finish and each start of the lap timer are told to the server as they happen: it times the lap itself)
    onLap: (lap, info) => { mp.lapMark('f', lap.ms); mp.submitLap(lap, info?.trace); stats.lap('finish', lap.car); raceMode?.lap(lap, info); },
    onEvent: (k, cps) => {
      if (k === 'start') mp.lapMark('s');
      stats.lap(k, cps); if (k === 'off' || k === 'cut' || k === 'jump') raceMode?.out(k);
      // (a Rocket starts every timed lap of its own with a full tank, so laps compare; in a race the tank is filled at the lights only)
      if (k === 'start' && car.rocket && !raceMode?.ghost) refillTank(car.spec.id);
    },
    refFor: (id, cp) => mp.refFor(id, cp),
    bestFor: (id) => {
      const net = mp.bestFor(id);
      let mine = null;
      for (const l of race.laps) if (l.car === id && (!mine || l.ms < mine.ms)) mine = { ms: l.ms, name: mp.name };
      return net && (!mine || net.ms <= mine.ms) ? net : mine;
    },
  });
  if (RAADI) world.gravelAt = stageGravel;          // (the stage's gravel eases into the grass beside it)
  if (RAADI) stage = createStage({
    world, scene, toast: (t, ms) => hud.toast(t, ms),
    // (on the line for a new run: R goes back only to spots of this run, never to one from before it further along the stage)
    place: (pose) => { history.length = 0; place(pose); }, wood: (kind, level) => audio.wood?.(kind, level),
    beep: (kind) => audio.beep?.(kind),
    // a finished run goes to the server like a lap does (Martin 23 Nov: "the server side of this track, keeping
    // the lap times etc from now on"): the same queue, ticket and board, under the track 'raadi'
    onJump: () => { tyrePending = { k: 'gravel', t: performance.now() }; },
    rec: createRecorder(mp.pose),
    // where each run's wheels went, for the stage's painted line (src/race/linelog.js). Sent from the game's own
    // address only (?linelog=1 anywhere, ?linelog=0 nowhere); a test run does the same work and sends nothing.
    log: params.get('linelog') === '0' ? null : createLineLog({ jobs, track: 'raadi', send: params.get('linelog') === '1' || (location.hostname === 'www.linnaring.com' && !navigator.webdriver) }),
    onRun: (k, run, info) => { if (k === 'finish') { mp.submitLap({ ...run, track: 'raadi' }, info?.trace); if (info?.record) audio.chime?.('record'); } },
    online: () => !!mp.board?.raadi,
    bestFor: (id) => {
      const net = mp.bestFor(id, 'raadi'), own = stage.best(id).car, mine = own && { ms: own.ms, name: mp.name };
      return net && (!mine || net.ms <= mine.ms) ? net : mine;
    },
  });
  if (stage) {
    // short buttons to either circuit's start, straight from the driving screen
    const tp = document.createElement('div');
    tp.id = 'trackpills';
    tp.innerHTML = '<button data-act="track-toome" title="Toomemägi lap start">TOOMEMÄGI</button><button data-act="track-raadi" title="Raadi rally stage start">RAADI</button>';
    $('#hud').appendChild(tp);
  }
  board = createBoard({ mp, race, cars: CARS, order: CAR_ORDER, stage, onTrack: () => { trackPicked = true; layoutMenu(); }, onWatch: watch ? watchReplay : null });
  {
    // the garage's tyre choice, left of the driver's name (the right side has LAP TIMES and CONTROLS)
    const drv = $('#driver'), left = document.createElement('div');
    left.id = 'menuleft';
    drv?.replaceWith(left);
    left.append(tyreBtn);
    if (drv) left.append(drv);
  }
  showTyres();
  raceMode = createRaceMode({
    mp, track: race.track, cars: CARS, isTouch, toast: (t, ms) => hud.toast(t, ms), chime: (k) => audio.chime?.(k),
    // (put on Toomemägi's grid from the Raadi stage: the circuit's road tyres, as the TOOMEMÄGI button would)
    place: (pose) => { const from = atRaadi(); place(pose); if (from && !atRaadi()) tyrePending = { k: 'road', t: performance.now() }; },
    isDriving: () => mode === 'drive',
    halo: (on) => race.finishHalo(on),
    // on a Raadi time attack: not pulled into a race or counted in its vote, only offered a small JOIN
    busy: stageBusy, unbusy: () => { stage?.cancel('STAGE LEFT FOR THE RACE'); mp.setDriving(true); },
    // (desktop: a name in the race list follows that car, like the online list)
    onWatch: isTouch ? null : (id) => watch?.start(id), watching: () => watch?.id || null,
  });
  // (the lap's line is put together once: its 2,400 points were walked again each time the small map was
  // drawn, sixteen times a second)
  let lapLine = null;
  const strokeLap = (ctx) => {
    if (!lapLine) { lapLine = new Path2D(); race.track.P.forEach(([x, z], i) => (i ? lapLine.lineTo(x, z) : lapLine.moveTo(x, z))); lapLine.closePath(); }
    ctx.stroke(lapLine);
  };
  // the Raadi stage's roads from its start to its finish, in neon orange on both maps (Martin 23 Nov: "On the
  // map (any view) highlight the rallye stage roads aswell, make it neon orange")
  let stageLine = null;
  const strokeStage = (ctx, alpha, width) => {
    if (!stage) return;
    if (!stageLine) { const d = stage.data; stageLine = new Path2D(); for (let i = d.start; i <= d.finish; i++) { const [x, z] = d.pts[i]; if (i > d.start) stageLine.lineTo(x, z); else stageLine.moveTo(x, z); } }
    ctx.strokeStyle = `rgba(255,128,20,${alpha})`; ctx.lineWidth = width; ctx.lineJoin = 'round';
    ctx.stroke(stageLine);
  };
  hud.setOverlay((ctx, scale, car) => {
    ctx.strokeStyle = 'rgba(255,43,214,.5)'; ctx.lineWidth = 16;
    strokeLap(ctx);
    strokeStage(ctx, 0.62, 14);
    // other players: arrows pointing the way they drive; anyone outside the minimap
    // gets a pointer on its rim showing which way they are from us
    // (spectating, the map is centred on the watched car, and our own parked car is a yellow arrow too)
    mapHits.length = 0;
    const own = ownCar();
    const players = mp.players().filter((p) => p.id !== watch?.id), rim = new Map();
    if (watch?.view) players.push({ id: null, x: own.x, z: own.z, yaw: own.yaw, colour: '#ffd45e' });
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
        mapHits.push({ x: q.x, y: q.y, id: p.id });
        continue;
      }
      // where the line from our car towards them crosses a circle just inside the rim
      const dx = q.x - me.x, dy = q.y - me.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      const ox = me.x - R, oy = me.y - R, rr = R - 26;      // (pointers made bigger, Martin 2026-11-17)
      const b = ox * ux + oy * uy, t = -b + Math.sqrt(Math.max(0, b * b - (ox * ox + oy * oy - rr * rr)));
      mapHits.push({ x: me.x + ux * t, y: me.y + uy * t, id: p.id });
      // (into one shape per colour, drawn with its glow after the loop: with 55 online each pointer's own blurred
      // glow was 55 blurs twelve times a second; now at most one per colour)
      const cx = me.x + ux * t, cy = me.y + uy * t, rx = -uy, ry = ux;    // (the pointer's own up is (ux, uy))
      const pt = (a, b) => [cx + a * rx + b * ux, cy + a * ry + b * uy];
      const path = rim.get(p.colour) || rim.set(p.colour, new Path2D()).get(p.colour);
      path.moveTo(...pt(0, 22)); path.lineTo(...pt(17, -11)); path.lineTo(...pt(-17, -11)); path.closePath();
    }
    for (const [colour, path] of rim) {
      ctx.fillStyle = colour; ctx.strokeStyle = '#160735'; ctx.lineWidth = 2.5;
      ctx.shadowColor = colour; ctx.shadowBlur = 8;
      ctx.stroke(path); ctx.fill(path);
    }
    rim.clear();
    ctx.restore();
  });
  // desktop: a click on a player's arrow on the minimap (or the pointer on its rim) watches that car; on
  // your own yellow one, back to your car; anywhere else it opens the city map as before
  if (watch) $('#minimap').addEventListener('click', (e) => {
    if (mode !== 'drive' || !mapHits.length) return;
    const c = e.currentTarget, r = c.getBoundingClientRect(), k = c.width / r.width;
    const x = (e.clientX - r.left) * k, y = (e.clientY - r.top) * k;
    let best = null, bd = 34 * 34;
    for (const h of mapHits) { const d = (h.x - x) ** 2 + (h.y - y) ** 2; if (d < bd) { bd = d; best = h; } }
    if (!best) return;
    e.stopPropagation();
    if (best.id) watch.start(best.id); else watch.stop();
  });
  bigmap = createBigMap(world, {
    onPick: dropAt, onClose: closeMap,
    drawUnder: (ctx, k) => { ctx.strokeStyle = 'rgba(255,43,214,.6)'; ctx.lineWidth = Math.max(5, 3 / k); strokeLap(ctx); strokeStage(ctx, 0.72, Math.max(5, 3 / k)); },
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
  if (resume?.pose) place(resume.pose);       // (back where the car was before the graphics were lost)
  camYaw = car.yaw; camSnap = true; droneYaw = car.yaw; droneDir.set(Math.sin(car.yaw), -Math.cos(car.yaw));
  buildMenu();
  bar.style.width = '100%';
  terrain.update(new THREE.Vector3(car.x, 0, car.z));
  shrinker?.scan(scene);
  $('#loading').classList.add('hidden');
  $('#menu').classList.remove('hidden');
  mode = 'menu';
  stats.ready();
  if (params.has('drive')) startDriving();
}

// another player's car on a map: an arrow in their own colour pointing forward (up), drawn around the origin
function playerArrow(ctx, k, colour = '#2ff3ff') {
  ctx.fillStyle = colour; ctx.strokeStyle = '#160735'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -12 * k); ctx.lineTo(8 * k, 9 * k); ctx.lineTo(0, 4.5 * k); ctx.lineTo(-8 * k, 9 * k); ctx.closePath();
  ctx.stroke(); ctx.fill();
}

// The car being swapped out is freed from the graphics card (its geometry, materials and pictures).
// Each car change used to keep the old car's model there: a few cars tried in the garage on a phone
// added up. Anything it shared with another car is simply uploaded again when that car is drawn.
function freeModel(group) {
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m) continue;
      for (const k in m) if (m[k]?.isTexture) m[k].dispose();
      m.dispose();
    }
  });
}
function setCar(id, now = false) {
  if (!CARS[id] || !carShown(id)) return;
  carId = id;
  localStorage.setItem('kvissuroam.car', id);
  // (behind the opening drone flight the car isn't on screen, so picking one only marks it: it is built
  // when DRIVE is pressed, and choosing stays instant. In the garage later it is swapped as you see it.)
  clearTimeout(pickTimer);
  if (mode === 'menu' && model && !now) {
    // (behind the phones' still picture it is built a moment after the last pick, so it is ready for DRIVE;
    // in the garage, with the car in view, once its card has slid into place, so the slide stays smooth)
    if (!intro) pickTimer = setTimeout(() => { if (mode === 'menu' && car.spec.id !== carId) setCar(carId, true); }, still ? 700 : 320);
    layoutMenu();
    return;
  }
  const spec = CARS[id];
  const pose = car ? { x: car.x, z: car.z, yaw: car.yaw, y: car.y } : startPose;
  car = createCar(spec, pose);
  car.tyres = tyres;
  car.fanOff = fansOff && !!spec.fanDown;
  if (model) { scene.remove(model.group); freeModel(model.group); }
  try {
    model = buildCarModel ? buildCarModel(id) : buildPlaceholder(spec);
  } catch (err) {
    console.warn('Car model failed, using placeholder', err);
    model = buildPlaceholder(spec);
  }
  model.group.rotation.order = 'YXZ';
  model.group.traverse((o) => { o.layers.enable(1); if (o.isMesh) { o.castShadow = true; } });   // layer 1: drawn again over street photos
  if (mp?.plate) setCarPlate(model, mp.plate);       // our own number plate (typed in the garage, src/race/board.js)
  scene.add(model.group);
  if (shrinker) { const m = model; m.ready?.then(() => { shrinker.again(m.group); shrinker.scan(m.group); }, () => {}); }   // (a scanned body arrives later, with its own pictures)
  audio.setCar(spec);
  hud.setCar(spec);
  hud.setTyres(tyres);
  mp?.setCar(id);
  raceMode?.out('car');                            // after the lights another car means out of the race
  race?.cancel('LAP CANCELLED');
  stage?.cancel('STAGE CANCELLED');
  layoutMenu();
}

// ---- garage menu: the groups side by side, each a reel of cards (see garage.js)
let garage = null;
function layoutMenu() {
  garage?.sync(carId);
  const d = $('#drivecar');
  if (d) d.textContent = stage ? `${CARS[carId].short} · ${board?.track === 'raadi' ? 'RAADI' : 'TOOMEMÄGI'}` : CARS[carId].short;
}

function buildMenu() {
  // (a car left out of every group still gets a place, at the end of the last one)
  const listed = new Set(CAR_GROUPS.flatMap((g) => g.ids));
  const defs = CAR_GROUPS.map((g, i) => ({ name: g.name, ids: [...g.ids, ...(i === CAR_GROUPS.length - 1 ? CAR_ORDER.filter((id) => !listed.has(id)) : [])] }));
  garage = createGarage({ root: $('#cards'), cars: CARS, groups: defs, picked: carId, onPick: (id) => setCar(id) });
  layoutMenu();
  $('#drive').addEventListener('click', startDriving);
  // (a key typed into the name or the plate never gets here: those boxes keep their keys to themselves)
  addEventListener('keydown', (e) => {
    if (mode !== 'menu') return;
    // the garage's own letter keys (Martin 26 Nov): L opens and closes the lap times as on the road, and G goes
    // back to the car as Esc does, once there has been a drive to go back to (not the same G press that opened
    // the garage: the driving keys mark theirs as used)
    if (!e.repeat && !e.defaultPrevented && !e.ctrlKey && !e.metaKey && !e.altKey && !setup.isOpen) {
      if (e.code === 'KeyL') { e.preventDefault(); if (board?.open) board.hide(); else board?.show(); return; }
      if (e.code === 'KeyG' && drivenOnce && !board?.open) { e.preventDefault(); startDriving(); return; }
    }
    if (board?.open) return;
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') garage.step(e.code === 'ArrowRight' ? 1 : -1);
    else if (e.code === 'ArrowDown') garage.slide(1);
    else if (e.code === 'ArrowUp') garage.slide(-1);
    else if (e.code === 'Enter' || e.code === 'Space') startDriving();
  });
}

let softwareTold = false;
function startDriving() {
  if (mode === 'drive') return;
  if (still && warmGate && !warmedUp() && !(readyWait && performance.now() - readyWait > 40000)) {
    if (!readyWait) { readyWait = performance.now(); showReady(); }
    return;
  }
  if (readyWait) { readyWait = 0; showReady(); }
  $('#idlenote').classList.add('hidden');
  shadersReady();                                    // (where nothing waited for them: made ready from here on)
  if (car.spec.id !== carId) setCar(carId, true);   // a car picked during the drone flight
  mode = 'drive';
  stats.drive();
  driveT = performance.now();
  // the track picked on the start screen (?raadi=1): DRIVE starts there. With Raadi picked always, unless the
  // car is at Raadi already (the line under DRIVE says RAADI; Martin 23 Nov: H, then the menu, then DRIVE stayed
  // at Toomemägi). With Toomemägi picked the car is only fetched from Raadi, and only after a pick.
  if (stage) {
    // (a circuit picked here is an explicit pick too: its tyres go on once the car is down, as with the
    // in-game buttons; Martin 23 Nov: a fresh game, RAADI picked, dropped there on road tyres)
    const toRaadi = board.track === 'raadi' && !atRaadi();
    if (toRaadi) stage.goStart();
    else if (board.track === 'toome' && trackPicked && atRaadi()) goHome();
    if (board.track === 'raadi' && (toRaadi || trackPicked)) tyrePending = { k: 'gravel', t: performance.now() };
    else if (board.track === 'toome' && (trackPicked || !droveOnce)) tyrePending = { k: 'road', t: performance.now() };
    trackPicked = false;
    droveOnce = true;
  }
  // (the car waits on the start's spot behind the menu: if somebody is standing there now, a free spot near it)
  if (!atRaadi() && Math.hypot(car.x - startPose.x, car.z - startPose.z) < 1) { const f = freeStart(); if (f !== startPose) place(f); lane?.begin(f.x, f.z); }
  parked.hold(8);                                   // phones: no parked car models built while the drive starts
  if (still) {
    // phones: from the still picture straight to behind the car
    still = false;
    document.body.classList.remove('still');
  } else if (intro) {
    // fly from wherever the drone is to the chase position behind the car
    flyIn = { t: 0, from: camera.position.clone(), q0: camera.quaternion.clone(), fov: camera.fov };
    intro = null;
    terrain.update(new THREE.Vector3(car.x, 0, car.z));   // start the sharp ground tiles around the car loading now
  } else camSwoop = 0.9;
  $('#menu').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  if (gpu.software && !softwareTold) { softwareTold = true; setTimeout(() => hud.toast(isTouch ? 'GRAPHICS CARD NOT IN USE · GAME WILL BE SLOW' : 'GRAPHICS CARD NOT IN USE · SEE OPTIONS (O)', 6000), 2500); }
  if (isTouch) {
    $('#touch').classList.remove('hidden');
    wantFull = true;
    goFull();
  }
  audio.start();
  input.enable(true);
  if (resume?.pose && !resume.told) { resume.told = true; setTimeout(() => hud.toast('BACK WHERE YOU WERE', 2500), 700); }
  camYaw = car.yaw; camSnap = true; droneYaw = car.yaw; droneDir.set(Math.sin(car.yaw), -Math.cos(car.yaw));
  // what DRIVE itself put in the scene (the race lights, markers, the car's own bits): its shaders built off the
  // page where the browser can (compileAsync), then first used a couple a frame by the work queue (see shadersReady).
  // Not all at once in the click: /stats of 25 Nov had 105 desktop freezes of 1-3 s inside the DRIVE button,
  // the menu's not yet finished shaders and DRIVE's own all waited for in one go.
  warmer.ready(scene).catch((err) => console.warn(err));
}

// Full screen on phones. The browser drops it when you switch to another app and only lets a page ask
// again from a tap, so any tap while not in full screen asks for it again. That starts with the first
// tap in the opening menu, where the browser's own bars leave the garage little room.
// The FULL button in the top bar turns that off and on (and full screen on a computer). An iPhone has no
// full screen for pages, so it gets no button (Martin 23 Nov); nor does the game started from a Home Screen.
let wantFull = isTouch, fullAsked = false;
const fullOn = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function goFull() {
  const el = document.documentElement;
  const ask = el.requestFullscreen ? () => el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen && (() => el.webkitRequestFullscreen());
  if (fullOn() || fullAsked || !ask) return;
  fullAsked = true;
  Promise.resolve().then(ask).then(() => screen.orientation?.lock?.('landscape')).catch(() => {})
    .finally(() => { fullAsked = false; });
}
for (const ev of ['pointerup', 'touchend']) addEventListener(ev, () => { if (wantFull && !document.hidden) goFull(); }, { passive: true, capture: true });
const canFull = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const installed = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;
const fullBtn = $('#fullbtn');
if (!installed && canFull) {
  fullBtn.classList.remove('hidden');
  document.body.classList.add('fullbtn');
  const mark = () => fullBtn.classList.toggle('on', fullOn());
  document.addEventListener('fullscreenchange', mark);
  document.addEventListener('webkitfullscreenchange', mark);
}
function toggleFull() {
  if (fullOn()) {
    wantFull = false;                       // a phone stops asking again on every tap until FULL is pressed again
    (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
  } else {
    wantFull = isTouch;
    goFull();
  }
}

let drivenOnce = false;
// (in the garage Esc goes back to the car, once there is a drive to go back to; the lap times board
// catches its own Esc first)
addEventListener('keydown', (e) => { if (e.code === 'Escape' && mode === 'menu' && drivenOnce && !board?.open) { e.preventDefault(); e.stopImmediatePropagation(); startDriving(); } }, true);
function openGarage() {
  if (mode !== 'drive') return;
  drivenOnce = true;
  stats.count('garage');
  stats.phase('menu');
  board?.hide(); optEl.classList.add('hidden');
  closeMap();
  watch?.stop();
  mode = 'menu';
  input.enable(false);
  $('#menu').classList.remove('hidden');
  $('#hud').classList.add('hidden');
  $('#touch').classList.add('hidden');
  $('#sunk').classList.add('hidden');
  if (car.inWater) { if (stage && atRaadi()) stage.goStart(); else goHome(); }    // (a Raadi pond: its stage start)
  car.vx = car.vy = car.yawRate = 0;
}

// A car left standing on the map with nobody at the controls goes to the garage, off the map for everyone
// (src/idlepark.js; ?idle=<seconds> for trying it out, ?idle=0 never). The garage says why until the next DRIVE.
// (an automated test run is never judged unless it asks: many of them leave a car standing for minutes)
const idleS = params.has('idle') ? +params.get('idle') || Infinity : navigator.webdriver ? Infinity : undefined;
const idlePark = createIdlePark({
  idle: idleS, warn: idleS < 30 ? 5 : undefined,
  show: (n) => hud.toast(`IDLE · BACK TO GARAGE IN ${n}`, 1600),
  hide: () => hud.untoast('IDLE · '),
  park() {
    stats.count('idle');
    closeOverlays();
    openGarage();
    $('#idlenote').classList.remove('hidden');
  },
});

// A lap record's replay (src/race/replay.js), from a time on the LAP TIMES board (desktop): fetched, then watched
// like another player's car once we are on the map (from the garage: DRIVE first). A Raadi stage replay takes our
// car to the stage's start first, so the stage's bales and tape are there around it.
let replayAsk = 0;
async function watchReplay(track, carOf) {
  if (raceMode?.holding || raceMode?.ghost) { hud.toast('NOT DURING YOUR RACE', 1800); return; }
  const ask = ++replayAsk;
  let rp = null;
  try { rp = await mp.loadReplay(track, carOf); } catch { /* none */ }
  if (ask !== replayAsk) return;
  if (!rp) { hud.toast('REPLAY NOT AVAILABLE', 2200); return; }
  board.hide();
  closeOverlays();
  if (mode !== 'drive') startDriving();
  let moved = false;
  const t0 = performance.now();
  const go = () => {
    if (ask !== replayAsk) return;
    if (mode !== 'drive' || dropping || respawning || bigmap.isOpen) { if (performance.now() - t0 < 60000) requestAnimationFrame(go); return; }
    if (track === 'raadi' && stage && !atRaadi() && !moved) { moved = true; stage.goStart(); requestAnimationFrame(go); return; }
    watch.start(mp.playReplay(rp));
    if (!watch.active) mp.stopReplay();
  };
  go();
}

let placedAt = -1e9;               // when the car was last put somewhere (ms)
function place(pose) {
  watch?.stop();                                   // (put somewhere: back in your own car)
  placedAt = performance.now();
  resetCar(car, { ...pose, y: pose.y ?? world.heightAt(pose.x, pose.z) });
  shrinker?.jump(scene, pose.x, pose.z);          // pictures of this spot that were resting come back now (phonetex.js)
  if (mode === 'drive' && ((shrinker?.pending || 0) > 0 || !world.ready(pose.x, pose.z))) getReady();
  wetAt = null;
  camYaw = car.yaw; camSnap = true; droneYaw = car.yaw; droneDir.set(Math.sin(car.yaw), -Math.cos(car.yaw));
  launch = null;
  $('#sunk').classList.add('hidden');
}

// H and the home button: back to the start of the circuit the car is at (Raadi's stage start when out at
// Raadi, Martin 23 Nov; the TOOMEMÄGI button still goes to Küüni from there)
function homeHere() {
  if (stage && mode === 'drive' && atRaadi()) { raceMode?.out('map'); stage.goStart(); } else goHome();
}
let pillAt = null;
function trackPills() {
  const at = atRaadi();
  if (at === pillAt) return;
  pillAt = at;
  const b = document.querySelector('#trackpills [data-act="track-raadi"]');
  if (b) { b.textContent = at ? '↺ RAADI START' : 'RAADI'; b.classList.toggle('here', at); b.title = at ? 'Back to the stage start (H)' : 'Raadi rally stage start'; }
}

function goHome() {
  raceMode?.out('start');
  stage?.teleported();
  history.length = 0;
  wetAt = null;
  const f = freeStart();
  place(f);
  lane?.begin(f.x, f.z);
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
      getReady();
      await world.loadAround(pick.wait.x, pick.wait.z, 80);
      if (!world.ready(pick.wait.x, pick.wait.z)) history.pop();
      pick = pickFromHistory(world, history, opts);
    }
    if (pick?.wait) pick = null;
    // (a Raadi run with no spot of its own left to go back to: the stage's start, not the nearest dry street,
    // which may be further along the stage)
    if (!pick && stage?.running) return stage.goStart();
    if (!pick) pick = searchDry(world, sx, sz, bigmap.nearestRoad);
    if (!pick) return stage && atRaadi() ? stage.goStart() : goHome();
    place(pick);
    race?.hopped(pick.x, pick.z);
    stage?.reset(pick.t);                    // (a Raadi run goes on from that spot, 5 s dearer: raadi.js)
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
  raceMode?.out('map');
  stage?.teleported();
  stats.count('mapjump');
  getReady();                                      // (at once: the click is answered before the map is read)
  parked.hold(8);
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
  showSound();
}
// sound on / off sits in the options panel (Martin 23 Nov: no top button needed for it)
const optSound = $('#opt-sound');
function showSound() { for (const b of optSound.children) b.classList.toggle('on', (b.dataset.sound === 'off') === audio.muted); }
showSound();
optSound.addEventListener('click', (e) => { const b = e.target.closest('[data-sound]'); if (b && (b.dataset.sound === 'off') !== audio.muted) toggleSound(); });
// notification sounds (Martin 2026-11-23): the chimes for someone joining or leaving, a lap record and a race
// call can be switched off on their own; the toasts still show. Remembered per browser.
const optNotify = $('#opt-notify');
audio.setNotify(stored('kvissuroam.notify') !== '0');
function showNotify() { for (const b of optNotify.children) b.classList.toggle('on', (b.dataset.notify === 'on') === audio.notify); }
showNotify();
optNotify.addEventListener('click', (e) => {
  const b = e.target.closest('[data-notify]');
  if (!b) return;
  b.blur();
  audio.setNotify(b.dataset.notify === 'on');
  try { localStorage.setItem('kvissuroam.notify', audio.notify ? '1' : '0'); } catch {}
  showNotify();
});

// ---- screens over the drive: the city map, the lap times and the options. Only one is open at a time.
// Their keys work from any of them: M / L / O jump straight to that screen (the same key again closes it),
// Esc goes back to the car, and from the car Esc opens the garage. R, H and G close whatever is open first.
// The driving keys (C, A / Z) wait until the car is back on screen.
const overlayOpen = () => (bigmap?.isOpen ? 'map' : board?.open ? 'laps' : !optEl.classList.contains('hidden') ? 'options' : setup.isOpen ? 'controls' : null);
function closeOverlays() { closeMap(); board?.hide(); optEl.classList.add('hidden'); setup.close(); }
function showOverlay(name) {
  const was = overlayOpen();
  closeOverlays();
  if (was === name || mode !== 'drive') return;
  if (name === 'map') openMap();
  else if (name === 'laps') board.show();
  else if (name === 'options') { optEl.classList.remove('hidden'); showGfx(true); showInput(); }
  else if (name === 'controls') setup.open();
}
const unlessMap = (fn) => () => { if (!overlayOpen()) fn(); };
const closingFirst = (fn) => () => { closeOverlays(); fn(); };
input.on('KeyR', closingFirst(goLastSpot));
input.on('KeyH', closingFirst(homeHere));
input.on('Home', closingFirst(goHome));
input.on('KeyG', closingFirst(openGarage));
const toggleMap = () => showOverlay('map');
input.on('KeyM', toggleMap);
input.on('KeyT', toggleMap);
input.on('Escape', () => (overlayOpen() ? closeOverlays() : openGarage()));
input.on('KeyN', toggleSound);
input.on('KeyF', () => { if (canFull) toggleFull(); });
input.on('KeyL', () => showOverlay('laps'));
// A / Z: one gear up / down by hand; the automatic takes over again at the shift point
const shiftBy = (dir) => unlessMap(() => { if (mode === 'drive' && !board.open && !input.wasd) shiftGear(car, dir); });
// Options (O): WASD driving, which turns the A / Z gear keys off. Off by default; remembered per browser.
const optEl = $('#options'), optKeys = $('#opt-keys');
let wasdSaved = false;
try { wasdSaved = localStorage.getItem('kvissuroam.wasd') === '1'; } catch {}
input.setWasd(wasdSaved);
const showKeys = () => { for (const b of optKeys.children) b.classList.toggle('on', (b.dataset.keys === 'wasd') === input.wasd); };
showKeys();
optKeys.addEventListener('click', (e) => {
  const b = e.target.closest('[data-keys]');
  if (!b) return;
  b.blur();                      // (so Space and the arrows drive again instead of pressing the button)
  const on = b.dataset.keys === 'wasd';
  if (on === input.wasd) return;
  input.setWasd(on);
  try { localStorage.setItem('kvissuroam.wasd', on ? '1' : '0'); } catch {}
  showKeys();
  hud.toast(on ? 'WASD DRIVING · AUTOMATIC GEARBOX' : 'ARROWS DRIVE · A / Z SHIFT GEARS', 2200);
});
// Tyre squeal: the modelled squeal of public/tyre-worklet.js (B) is the only one since Martin 2026-11-23 took the
// A/B choice out of the options; ?squeal=note still brings the held note of src/audio-tyres.js back for comparing.
audio.setSquealKind(params.get('squeal') === 'note' ? 'note' : 'real');
// Tyre marks on grass: A, the torn soil ruts of #513, is the only look since Martin 2026-11-23 took the A/B/C
// choice out of the options; ?grassmarks=b or c still shows the other two (tools/skid-shots.mjs, SKID_QUERY).
const grassMarks = ['b', 'c'].includes(params.get('grassmarks')) ? params.get('grassmarks') : 'a';
// Tyres (Martin 2026-11-23): road or gravel on every car, picked in the garage, by the tyre icon beside the
// gear on the dial, or Y. Switched on the fly, even on the start lights or mid time attack. Starting the Raadi
// stage fits gravel tyres and a Toomemägi race road tyres; whatever is on stays on after a lap, race or stage.
// Remembered per browser; ?tyres=gravel or ?tyres=road sets it.
let tyres = stored('kvissuroam.tyres') === 'gravel' ? 'gravel' : 'road';
if (params.get('tyres') === 'gravel' || params.get('tyres') === 'road') tyres = params.get('tyres');
const tyreBtn = document.createElement('button');
tyreBtn.id = 'tyrebtn';
tyreBtn.dataset.act = 'tyres';
tyreBtn.title = 'Road or gravel tyres, for every car (Y while driving)';
const showTyres = () => {
  tyreBtn.innerHTML = `${tyreIcon(tyres)}<span><small>TYRES</small>${tyres === 'gravel' ? 'GRAVEL' : 'ROAD'}</span>`;
  tyreBtn.className = tyres;
  hud?.setTyres(tyres);
};
// every change shows a small, clean, borderless note (Martin 2026-11-23), over the drive and the garage alike
const tyreToast = document.createElement('div');
tyreToast.id = 'tyretoast';
document.body.appendChild(tyreToast);
let tyreToastT = 0;
function setTyres(k) {
  k = k === 'gravel' ? 'gravel' : 'road';
  const changed = k !== tyres;
  tyres = k;
  if (car) car.tyres = tyres;
  try { localStorage.setItem('kvissuroam.tyres', tyres); } catch {}
  showTyres();
  // (not in the garage: its TYRES button already says it, and the note sat over DRIVE; Martin 23 Nov)
  if (!changed || mode !== 'drive') return;
  tyreToast.innerHTML = `${tyreIcon(tyres)}<span>Tyres changed to: <b>${tyres}</b></span>`;
  tyreToast.className = `show ${tyres}`;
  clearTimeout(tyreToastT);
  tyreToastT = setTimeout(() => tyreToast.classList.remove('show'), 1600);
}
input.on('KeyY', () => { if (mode === 'drive') setTyres(tyres === 'gravel' ? 'road' : 'gravel'); });
// A fan car's suction fans (spec.fanDown) can be switched off (Martin 25 Nov: "make the fan icon clickable and you
// can toggle fan off and on. When off then use those dynamics in car handling as well"): the fan in the rev
// counter is the switch, U the key. Off, the tyres carry the car's weight alone (physics.js), the whir runs down
// and no dust is raised. Not remembered: every visit starts with them on.
let fansOff = false;
function setFans(off) {
  if (!car?.spec.fanDown) return;
  fansOff = !!off;
  car.fanOff = fansOff;
  if (mode !== 'drive') return;
  tyreToast.innerHTML = `<span>Suction fans: <b>${fansOff ? 'off' : 'on'}</b></span>`;
  tyreToast.className = `show ${fansOff ? 'gravel' : 'road'}`;
  clearTimeout(tyreToastT);
  tyreToastT = setTimeout(() => tyreToast.classList.remove('show'), 1600);
}
input.on('KeyU', () => { if (mode === 'drive') setFans(!fansOff); });
// Driving anywhere, onto a circuit too, keeps whatever is on. Only an explicit jump with the in-game
// TOOMEMÄGI / RAADI buttons fits that circuit's tyres (road / gravel), once the car is down there and
// GETTING READY is gone (Martin 2026-11-23).
let tyrePending = null;
function tyreDefaults() {
  if (!tyrePending || mode !== 'drive' || readyOn || performance.now() - tyrePending.t < 250) return;
  setTyres(tyrePending.k);
  tyrePending = null;
}
// Graphics: AUTO follows the frame rate; HIGH / MEDIUM / LOW fix a level. Remembered per browser.
const gfxNames = (i) => (i < 0 ? '?q=low' : `${i + 1} of ${gfx.levels.length}`);
let gfxShown = 0;
function showGfx(force) {
  const now = performance.now();
  if (!force && now - gfxShown < 500) return;
  gfxShown = now;
  for (const b of $('#opt-gfx').children) b.classList.toggle('on', b.dataset.gfx === gfx.mode);
  const l = gfx.levels[gfx.level];
  const m = gfx.meter;
  const fps = `${Math.round(1000 / m.frame)} FPS (game code ${m.js.toFixed(1)} [drawing ${part.draw.toFixed(1)}, building ${part.build.toFixed(1)}]${gpuTimer.ms != null ? `, graphics card ${gpuTimer.ms.toFixed(1)}` : ''} of ${m.frame.toFixed(1)} ms; late frames ${m.late}/2 s, longest ${Math.round(m.worst)} ms${lag.ms > m.frame * 2.5 ? `; picture ${Math.round(lag.ms)} ms behind` : ''})${hitches.line ? ` · ${hitches.line}` : ''}`;
  $('#opt-gfxnow').textContent = gfx.mode === 'locked' ? `Fixed low by ?q=low · ${fps}`
    : `Now: level ${gfxNames(gfx.level)} · ${fps}${l ? ` · ${Math.round(gfx.sharpness * 100)}% sharpness${gfx.sharpness < l.dpr ? ' (trimmed for even pictures)' : ''}, ${l.shadow ? 'shadows' : 'no shadows'}` : ''}${gfx.trimOff ? ' · less sharpness did not even the pictures out' : ''}${gfx.mode === 'auto' && !gfx.auto ? ' · auto off in test runs' : ''}${gfx.cap != null && gfx.mode === 'auto' ? ` · kept at ${gfx.cap + 1} or lower after the game closed itself` : ''}${liteWhy ? ` · light mode (${liteWhy})` : ''}${xlow ? ` · simple ground, no edge smoothing (${xlow})` : ''}${gfx.capped ? ` · held at ${Math.round(gfx.capped)} FPS by the browser or the system (battery saver?): less detail would not make it faster` : ''}`;
}
document.getElementById('opt-gfx').addEventListener('click', (e) => {
  const b = e.target.closest('[data-gfx]');
  if (!b) return;
  gfx.setMode(b.dataset.gfx);
  b.blur();
  showGfx(true);
  hud.toast(`GRAPHICS ${b.dataset.gfx.toUpperCase()}`, 1600);
});
if (gpu.software) {
  const el = $('#opt-gpu');
  el.textContent = gpu.brave
    ? 'Your browser is drawing the game without the graphics card, so it runs slowly. In Brave: Settings → System → turn on "Use graphics acceleration when available", then restart Brave.'
    : 'Your browser is drawing the game without the graphics card, so it runs slowly. Turn on hardware (graphics) acceleration in the browser settings and restart it.';
  el.classList.remove('hidden');
}
const toggleOptions = () => showOverlay('options');
// A tap or click anywhere outside the open OPTIONS panel closes it, like CLOSE (Martin 2026-11-23). That tap
// does nothing else: it is stopped here, before the pedals, the HUD buttons or the map see it, and the click
// that follows it is eaten too. The OPTIONS button itself still toggles the panel shut as before.
let eatClickUntil = 0;
window.addEventListener('pointerdown', (e) => {
  eatClickUntil = 0; // a new tap is never eaten for the one before
  if (optEl.classList.contains('hidden') || optEl.contains(e.target) || e.target.closest?.('[data-act="options"]')) return;
  optEl.classList.add('hidden');
  eatClickUntil = performance.now() + 700;
  e.preventDefault();
  e.stopPropagation();
}, { capture: true });
for (const ev of ['click', 'touchstart']) {
  window.addEventListener(ev, (e) => {
    if (performance.now() > eatClickUntil) return;
    if (ev === 'click') eatClickUntil = 0;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  }, { capture: true, passive: false });
}
input.on('KeyO', toggleOptions);
input.on('Digit1', () => raceMode?.act());
input.on('Numpad1', () => raceMode?.act());
input.on('KeyA', shiftBy(1));
input.on('KeyZ', shiftBy(-1));

// ---- controllers: the buttons do what the keys do (gears work in WASD mode too: a pad has no A key
// to clash with), the garage can be driven with the d-pad or the stick, and the options pick the input
const padDrive = (fn) => () => { if (mode === 'drive' && !setup.isOpen) fn(); };
pads.on('gearUp', padDrive(unlessMap(() => { if (!board.open) shiftGear(car, 1); })));
pads.on('gearDown', padDrive(unlessMap(() => { if (!board.open) shiftGear(car, -1); })));
pads.on('view', padDrive(() => input.press('KeyC')));
pads.on('reset', padDrive(() => input.press('KeyR')));
pads.on('home', padDrive(() => input.press('KeyH')));
pads.on('map', padDrive(() => input.press('KeyM')));
pads.on('laps', padDrive(() => input.press('KeyL')));
pads.on('options', padDrive(() => input.press('KeyO')));
pads.on('garage', padDrive(() => input.press('KeyG')));
// in the garage: d-pad left / right picks the car, up / down the group, A (or Menu) drives; B or View
// opens the lap times. With the lap times open, B closes them.
pads.on('button', (gp, i) => {
  if (setup.isOpen || gp.mapping !== 'standard') return;
  if (mode === 'drive' && board?.open && i === 1) { board.hide(); return; }
  if (mode !== 'menu') return;
  if (board?.open) { if (i === 1 || i === 0) board.hide(); return; }
  if (i === 15) garage.step(1);
  else if (i === 14) garage.step(-1);
  else if (i === 13) garage.slide(1);
  else if (i === 12) garage.slide(-1);
  else if (i === 0 || i === 9) startDriving();
  else if (i === 8) board.show();
});
let stickNav = 0;                // the stick's last direction in the garage (one step per push)
function padMenu() {
  const a = pads.active;
  if (!a || mode !== 'menu' || board?.open || setup.isOpen) { stickNav = 0; return; }
  const x = a.gp.axes[0] || 0, y = a.gp.axes[1] || 0;
  const d = Math.abs(x) > 0.6 ? (x > 0 ? 1 : 2) : a.gp.mapping === 'standard' && Math.abs(y) > 0.6 ? (y > 0 ? 3 : 4) : 0;
  if (d && d !== stickNav) { if (d < 3) garage.step(d === 1 ? 1 : -1); else garage.slide(d === 3 ? 1 : -1); }
  stickNav = d;
}
const setup = createSetup({ pads, toast: (t, ms) => hud?.toast(t, ms), onClose: () => { showInput(); showHints(); } });
const optInput = $('#opt-input');
function showInput() {
  if (!optInput) return;
  for (const b of optInput.children) b.classList.toggle('on', b.dataset.input === pads.mode);
  const n = pads.connected;
  $('#opt-inputnow').textContent = n ? `${n} controller${n > 1 ? 's' : ''} connected${pads.active ? ' · driving with it now' : ''}` : 'No controller connected. Plug one in and press a button on it.';
}
optInput?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-input]');
  if (!b) return;
  b.blur();
  pads.setMode(b.dataset.input);
  showInput();
  hud.toast(pads.mode === 'kb' ? 'KEYBOARD DRIVES' : pads.mode === 'pad' ? 'CONTROLLER DRIVES' : 'AUTO · WHATEVER YOU TOUCHED LAST DRIVES', 2000);
});
$('#opt-setup')?.addEventListener('click', (e) => { e.currentTarget.blur(); showOverlay('controls'); });
// the hint line in the garage names the controller's buttons while a controller is in use
const keysHint = $('#menu .keys');
const keysText = keysHint?.textContent || '';
function showHints() {
  if (!keysHint) return;
  const a = pads.active;
  if (!a) { keysHint.textContent = keysText; return; }
  const { gp, prof } = a, n = (k) => buttonName(gp, prof.btn[k]);
  const src = (p) => (!p ? 'not set' : p.src.t === 'b' ? buttonName(gp, p.src.i) : `axis ${p.src.i + 1}`);
  keysHint.textContent = `${prof.kind === 'wheel' ? 'Wheel steers' : 'Left stick steers'} · ${src(prof.thr)} throttle · ${src(prof.brk)} brake · ${n('handbrake')} handbrake · ${n('gearUp')} / ${n('gearDown')} gear up / down · ${n('look')} look back · ${n('view')} drone view · ${n('reset')} last spot · ${n('map')} map · ${n('options')} options${gp.mapping === 'standard' ? ' · d-pad picks the car' : ''}`;
}
pads.onChange(() => { showHints(); showInput(); });
// pedal bars by the rev counter (a controller whose profile has them on: wheels by default)
let pedalsEl = null;
function showPedals() {
  const a = ctl === pads.state && mode === 'drive' ? pads.active : null;
  const on = !!a?.prof.bars;
  if (!pedalsEl) {
    if (!on) return;
    pedalsEl = document.createElement('div');
    pedalsEl.id = 'pedals';
    pedalsEl.innerHTML = '<div class="brk"><i></i></div><div class="thr"><i></i></div>';
    $('#tach').appendChild(pedalsEl);
  }
  pedalsEl.classList.toggle('hidden', !on);
  if (!on) return;
  pedalsEl.children[0].firstChild.style.height = `${pads.state.down * 100}%`;
  pedalsEl.children[1].firstChild.style.height = `${pads.state.up * 100}%`;
}
// C: the chase camera or a drone following the car from above
let droneYaw = 0;
const droneDir = new THREE.Vector2(0, -1);   // the car's travel direction, averaged (x, z)
let camView = localStorage.getItem('kvissuroam.view') === 'drone' ? 'drone' : 'chase';
input.on('KeyC', unlessMap(() => {
  camView = camView === 'chase' ? 'drone' : 'chase';
  droneYaw = camYaw; droneDir.set(Math.sin(camYaw), -Math.cos(camYaw));
  try { localStorage.setItem('kvissuroam.view', camView); } catch {}
}));
// 0 = chase, 1 = drone; slides between them in VIEW_BLEND seconds when C is pressed. Both rigs are worked
// out around the car every frame and the camera is placed between them, so it never trails the car.
const VIEW_BLEND = 0.8;
let droneMix = camView === 'drone' ? 1 : 0;
// a click or tap on a small thumbs up on a back window (src/kudos.js, Martin 2026-11-24): who gave it, and when,
// in a small label there for a few seconds; on the +N place the older ones. Only work at the click itself.
let kudoPop = null, kudoPopT = 0;
function showKudoWho(r) {
  if (!kudoPop) { kudoPop = document.createElement('div'); kudoPop.id = 'kudopop'; $('#hud').appendChild(kudoPop); }
  const at = (ms) => (ms ? new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '');
  const nm = (k) => escapeHtml((k[1] || mp?.nameOf(k[0]) || (k[0] === mp?.id ? mp.name : '') || 'A DRIVER').toUpperCase());
  const row = (k) => `<div><i style="--c:${kudosColour(k[0])}"></i>${nm(k)}${k[2] ? ` <small>${at(k[2])}</small>` : ''}</div>`;
  if (r.who) kudoPop.innerHTML = row(r.who);
  else {
    const list = r.older.slice(0, 4);
    kudoPop.innerHTML = list.map(row).join('') + (r.more > list.length ? `<div class="more">+${r.more - list.length} MORE</div>` : '');
  }
  kudoPop.style.transform = `translate(${Math.round(r.x)}px, ${Math.round(r.y)}px) translate(-50%, calc(-100% - 14px))`;
  kudoPop.classList.remove('out');
  clearTimeout(kudoPopT);
  kudoPopT = setTimeout(() => kudoPop.classList.add('out'), 3500);
}
renderer.domElement.addEventListener('click', (e) => {
  if (mode !== 'drive' || !kudos.pick) return;
  const rc = renderer.domElement.getBoundingClientRect();
  const r = kudos.pick(camera, e.clientX - rc.left, e.clientY - rc.top, rc.width, rc.height, isTouch ? 34 : 24);
  if (r && (r.who || r.older?.length)) { r.x += rc.left; r.y += rc.top; showKudoWho(r); }
  else kudoPop?.classList.add('out');
});
document.addEventListener('click', (e) => {
  const act = e.target.closest?.('[data-act]')?.dataset.act;
  if (!act) return;
  if (act === 'reset') goLastSpot();
  else if (act === 'home') homeHere();
  else if (act === 'track-toome') { goHome(); if (mode === 'drive') tyrePending = { k: 'road', t: performance.now() }; }
  else if (act === 'track-raadi') { if (mode === 'drive' && stage) { raceMode?.out('map'); stage.goStart(); tyrePending = { k: 'gravel', t: performance.now() }; } }
  else if (act === 'garage') openGarage();
  else if (act === 'map') { if (!bigmap.isOpen) showOverlay('map'); }
  else if (act === 'options') toggleOptions();
  else if (act === 'full') toggleFull();
  else if (act === 'tyres') { e.target.closest('[data-act]').blur?.(); setTyres(tyres === 'gravel' ? 'road' : 'gravel'); }
  else if (act === 'fans') { e.target.closest('[data-act]').blur?.(); setFans(!fansOff); }
  else if (act === 'options-close') optEl.classList.add('hidden');
  else if (act === 'controls') { if (mode === 'drive') showOverlay('controls'); else setup.open(); }
});

// ---------------------------------------------------------------- no page zoom
// iOS Safari ignores user-scalable=no, so a stray second finger could pinch
// the whole page into a zoom there is no way out of. Block the gestures, and
// if the page ever does end up zoomed, snap it back.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
// (one finger dragging the row of cars, the lap times board, the options panel, the race standings or the map's list of players is a scroll, and must be left alone)
document.addEventListener('touchmove', (e) => {
  if (e.touches.length === 1 && e.target.closest?.('#cards, #board, #options, #rlist .tb, #roster')) return;
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
// Chrome on an iPhone sometimes lays the page out wider than it shows it, so the side at the notch is cut off
// and the page can be dragged sideways (Martin's and his son's iPhones, 22 to 25 Nov; ?vp=1 shows the sizes).
// In landscape it shows the page between the notch and the other edge, narrower than the screen (750 of 844).
// Two faults: the page laid out as wide as the whole screen, or laid out right but drawn larger (zoomed by
// 844/750, so the right side runs off: the garage on opening, 25 Nov). Either way the viewport is set to a
// different value and back, which makes the browser lay the page out and scale it anew, and the page is put
// back at its left edge whenever it has been dragged.
if (/iPhone|iPod/.test(navigator.userAgent)) {
  const vp = document.querySelector('meta[name="viewport"]');
  const content = vp.content;
  const notched = Math.max(screen.width, screen.height) / Math.min(screen.width, screen.height) > 2;
  const long = Math.max(screen.width, screen.height);
  let told = false, redo = 0, busy = false, total = 0;
  const off = () => {
    const vv = window.visualViewport;
    if (vv && (vv.scale > 1.01 || vv.width < innerWidth - 2)) return 'zoom';
    if (!content.includes('cover') && notched && innerWidth > innerHeight && innerWidth >= long - 1) return 'wide';
    return '';
  };
  const fit = () => {
    if (scrollX || scrollY) scrollTo(0, 0);
    if (busy || redo > 5 || total > 30 || !off()) return;   // (a browser it does not help is left alone)
    redo++; total++; busy = true;
    if (!told) { told = true; stats.trouble('vpWide'); }
    vp.content = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1';
    requestAnimationFrame(() => requestAnimationFrame(() => { vp.content = content; scrollTo(0, 0); busy = false; }));
  };
  const soon = () => { redo = 0; for (const ms of [50, 300, 800, 1600, 3000]) setTimeout(fit, ms); };
  for (const ev of ['resize', 'orientationchange', 'pageshow', 'load']) addEventListener(ev, soon);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) soon(); });
  addEventListener('scroll', () => { if (scrollX || scrollY) scrollTo(0, 0); }, { passive: true });
  window.visualViewport?.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('scroll', () => { if (visualViewport.scale <= 1.01 && (visualViewport.offsetLeft || scrollX)) scrollTo(0, 0); });
  soon();
  setInterval(() => { redo = Math.min(redo, 3); fit(); }, 2000);
}

// ---------------------------------------------------------------- frame loop
const FLY_IN = 1;                 // seconds from the drone to behind the car
const smooth = (t) => t * t * (3 - 2 * t);
const flyQ = new THREE.Quaternion();
const clock = new THREE.Timer();
let photos = null, treesHidden = false;
let shrinkTick = 0, tileTimer = 0, hudTimer = 0, elapsed = 0, mapTimer = 0;
const s0Short = () => CARS[carId].short.toUpperCase();
const idle = {};
const aloft = {};                  // our car as the things on the ground see it while it flies a kickflip
let rocketOff = false, flipOff = false;   // the thrusters' buttons do nothing just now (waiting for a start); no kickflip (a race, a timed lap)

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
  if (document.hidden) { mp?.setDriving(!!raceMode?.holding); mp?.setWhere('away'); return; }   // (no frames run in a hidden tab to tell the server)
  keepAwake();
  clock.reset?.();
  settle = 1.5;
  // The first seconds back can be slow on the graphics card while it warms up again: after a short
  // settle that counts like any other slow spell (stepping down helps there, and the rung comes back
  // once the card has room again)
  gfx.hold(3);
  back = { at: performance.now(), n: 0, f: 0, js: 0, worst: 0, next: 2000 };
});

// what is driving the car: keyboard, gamepad, steering wheel or touch screen
const inpNow = () => (isTouch ? 'touch' : ctl === pads.state ? (pads.active?.prof.kind === 'wheel' ? 'wheel' : 'pad') : 'kb');
let capTold = false;             // the "held at 30 FPS" message has been shown
// (the charger going in or out changes what a battery saver allows: auto graphics judges afresh)
navigator.getBattery?.().then((bat) => bat.addEventListener('chargingchange', () => gfx.recheck())).catch(() => {});
let back = null;                 // the half minute after coming back to the tab: frame times logged, to see where a slow start goes
// Screens faster than 90 Hz (120, 144, 165 Hz laptops): only every 2nd (or 3rd) refresh is drawn, except
// on HIGH. Otherwise the graphics chip of such a laptop runs flat out even on LOW (Martin, 20 Nov: built-in
// Intel graphics near 100% on LOW). 120 Hz gives 60 frames a second, 144 Hz 72, 165 Hz 82, 240 Hz 80.
// (A computer that cannot keep up misses refreshes, the measured interval grows and nothing is skipped.)
let rafLast = 0, rafMs = 1000 / 60, rafTick = 0;
let crawl = 4;                              // frames in a row that took over 0.2 s (a crawl until the first quick frame: the start's own work is done at once)
let PLACES = null, placeAt = 0;             // the places that build on approach, and which one is asked first
// For the freeze count in the stats (src/stats.js): when the game was last somewhere a long frame is not a
// freeze a player feels while driving (garage, GETTING READY, a jump or reset, the city map or options open,
// another window in front, the tab hidden). A long frame counts only if the whole of it came after that.
let quietAt = 0, frameTs = 0;
// what the last frame did, for the stats' account of a freeze (src/stats.js freeze()): the game's own code, its
// building and drawing parts (ms), new shader programs and new pictures on the graphics card, script memory
// (kpc: the browser builds shader programs on its own thread and says when they are done, see src/warm.js)
// (net: the other players' part; car: a step of another player's car went to the graphics card, see toCard)
const lastFrame = { js: 0, build: 0, draw: 0, net: 0, car: 0, progs: 0, tex: 0, heap: 0, kpc: !!renderer.extensions.has('KHR_parallel_shader_compile') };

for (const [t, ev] of [[window, 'blur'], [window, 'focus'], [document, 'visibilitychange']]) t.addEventListener(ev, () => { quietAt = performance.now(); });
function frame(ts) {
  requestAnimationFrame(frame);
  const gap = ts - rafLast;
  rafLast = ts;
  if (gap > 2 && gap < 50) rafMs += (gap - rafMs) * 0.05;
  const every = gfx.mode === 'high' ? 1 : Math.max(1, Math.ceil((1000 / rafMs - 5) / 90));
  // (asked at every refresh of the screen, also those the game leaves out on a 120 Hz screen: when the picture was
  // finished is then known to a refresh)
  lag.poll(rafMs * 0.6);
  if (++rafTick % every) return;
  const t0 = performance.now();
  if (readyOn) getReadyStep(t0);
  clock.update(ts);
  const rawDt = clock.getDelta();
  const gapFrom = frameTs;
  frameTs = ts;
  let dt = Math.min(rawDt, 0.05);
  if (settle > 0) {
    settle -= dt;
    dtSmooth += (Math.min(dt, 1 / 30) - dtSmooth) * 0.15;
    dt = dtSmooth;
  } else dtSmooth = dt;
  elapsed += dt;
  // controllers: read every frame; one that was touched last (or chosen in the options) drives
  ctl = pads.poll(mode === 'drive' && !setup.isOpen) ? pads.state : input.state;
  setup.update();
  padMenu();
  if (!car) return;
  // (a frame that ends a quiet spell, or starts one, is not a felt freeze either)
  if (mode !== 'drive' || readyOn || dropping || respawning || overlayOpen() || document.hidden || !document.hasFocus() || !world.ready(car.x, car.z)) quietAt = performance.now();
  // building work is spread over frames only while somebody drives and watches the road (src/jobs.js).
  // Not at a crawl either (under 5 frames a second for a while: drawing without a graphics card, a test taking
  // pictures): there a frame is too long to hide anything in, and the queue would take minutes.
  crawl = rawDt > 0.2 ? Math.min(crawl + 1, 8) : 0;
  // (a freeze stands out from smooth driving: on a device crawling along at under 5 frames a second
  // every frame is slow, which the frame rate in the stats already shows)
  const felt = gapFrom > quietAt && crawl < 4;
  // spectating (desktop, src/spectate.js): WV the watched car once the camera is on it, WF where the world
  // streams in (the watched car, even before that); our own car waits, stopped
  const WV = watch?.view || null, WF = watch?.focus || car;
  jobs.setLive(mode === 'drive' && !dropping && !document.hidden && crawl < 4 && world.ready(WF.x, WF.z));

  // hold the car still while the ground under it is still loading (after a jump across the map)
  // (and while the city map is open)
  if (world.ready(car.x, car.z) && !bigmap.isOpen) {
    // (on the race grid a four-wheel-drive car waits with the clutch in, revving: src/cars/physics.js)
    car.gridHold = !!(raceMode?.pin || stage?.pin);
    // (a car with thrusters, Martin 2026-11-25: in a race, on a timed lap and on the Raadi stage BOOST works,
    // to be spent where it pays, and FLIP does not; neither does while the car waits for its start, where
    // the tank is filled so that everybody sets off with the same)
    if (car.rocket) {
      ctl.rocketOff = rocketOff = !!(raceMode?.holding || raceMode?.pin || stage?.phase === 'count' || stage?.pin);
      ctl.flipOff = flipOff = !!(raceMode?.ghost || race?.running || stage?.running || rocketOff);
      // (offline, ?off=100: an empty tank is full again in 2 s, for trying things out; Martin 2026-11-25)
      ctl.quickRefill = STEALTH;
      if (raceMode?.pin || stage?.pin) refillTank(car.spec.id);
    }
    if (mode === 'drive' && !watch?.active) stepCar(car, board?.open || setup.isOpen ? idle : ctl, world, dt);
    else {
      // choosing a car: let it settle on its springs but not roll or creep away
      const x = car.x, z = car.z, yaw = car.yaw;
      stepCar(car, idle, world, dt);
      car.x = x; car.z = z; car.yaw = yaw; car.vx = car.vy = car.yawRate = 0;
    }
    // on the race grid: held on the spot until the lights go out (the wheels may spin)
    const pin = raceMode?.pin || stage?.pin;
    if (pin) { car.x = pin.x; car.z = pin.z; car.yaw = pin.yaw; car.vx = car.vy = car.yawRate = 0; }
    lane?.update(car);
    // (a kickflip in flight, src/cars/thrust.js: the car is over the things it would knock into, which only
    // know where it is on the map, so for them it is far overhead; the others get the flight's plan once)
    // (low over the ground, at lift-off and coming down, it still knocks over what stands there)
    const hitCar = car.rocket?.flight && car.rocket.up > 1.5 ? Object.assign(aloft, car, { y: car.y + 100 }) : car;
    if (car.rocket?.launched) { mp.sendFlip(car.rocket.launched); car.rocket.launched = null; }
    // (a flight that met a house, a tree or a bank: the others stop flying its plan and see it fall)
    if (car.rocket?.crashed) { mp.sendFlip(null); car.rocket.crashed = false; }
    // (what our car knocks over and bumps into: not while it waits for a spectator)
    if (!watch?.active) {
      // (behind the menu and in the garage the others do not see our car, so nobody pushes it: it stays on the
      // start's spot until DRIVE finds it a free one)
      if (mode === 'drive') mp.collide(hitCar);
      trackside.collide(hitCar);
      props.update(hitCar, dt);
      updateShelters(hitCar, dt, audio);           // bus shelters: shattered glass, bent frames
      janese.update(hitCar, dt);
      aksi.update(hitCar, dt);
      if (orident.info()) orident.update(hitCar, dt, audio);          // (built: its glass corner breaks, every frame)
      discgolf.update(hitCar, dt);
      updateFences(hitCar, dt, audio);                             // breakable picket fences (Jakobi to Lai turn, Veski 20): src/world/breakfence.js
    }
    warmer.scope(() => parked.update(car, dt, camera.position));
    busStops?.update(WV || car);
    vabadusLights.update(performance.now() / 1000);          // clock time: the lights fade at their own pace
    // The hand-made places build themselves when the car comes near. One at a time while driving: after one
    // has built (a long step), the others wait for later frames, and so does the queued work (src/jobs.js).
    // Three streets coming due in one frame used to be one freeze of their sum.
    // (the places build around the watched car while spectating: a copy, so nothing they do moves it)
    const placeCar = watch?.active ? Object.assign(spot, WF, { y: WV?.y ?? car.y }) : car;
    if (!jobs.resting) {
      PLACES ||= [pootsmani, pootsmani12, angerja, raekoda, kuuni, kuperjanovi, pepleri, kaubamaja, keskus, keskusTee, { update: (c) => { if (!orident.info()) orident.update(c); } }, delta, kvissentali, sireli, coop, jaaaeg, janeseMaja, arhitekti, elva, vanemuise, pepVan, korve, korve2, riia, teatri, kontserdimaja, korve3, korve4, haridus10, katoliku, katoliku2, veskiFronts, noela, raadi, raadi2, raadi3, raadi4, louna, louna2, louna3, louna4, louna5, turu, turu2, turu3, turu4, turu5, turu6, laiFronts, kaluri, riia2, riia3, riia4, riia5, riia6, riia7, ravila, ravila2, ravila3, isaJaPoeg, kuperjanovi2, astelpaju, ulikooli, kvissentali2, arukula, ulikooli2, road3, ulikooli3, ulikooli4, ulikooli5, ulikooliPaint, lennujaam, lennuakadeemia, ulenurme, narva, ulenurmeKonsum, ulenurmePaint, erm, kaupmehe, raadiManor, narva2, vaksali, narva3, narva4, narva5, narva6, narva7, raadiPark, raadiStart, aovere, aovere2, aovere3, aoverePaint, rehetare, rattasepa];
      for (let k = 0; k < PLACES.length; k++) {
        const b0 = performance.now();
        const P = PLACES[(placeAt + k) % PLACES.length];
        warmer.scope(() => P.update(placeCar));
        if (jobs.live && performance.now() - b0 > 6) { placeAt = (placeAt + k + 1) % PLACES.length; jobs.rest(); break; }
      }
    }
    skids.update(car);
    skids.updateOthers(mp.remotes(), WV || car);
    smoke.update(car, dt, mode === 'drive', mp.remotes());
  } else smoke.update(null, dt, false, mp.remotes());
  plumes.update(mode === 'drive' && !watch?.active ? car : null, mp.remotes(), camera.position, dt);
  // (a spectator sends no position: the others do not see the parked car meanwhile)
  const n0 = performance.now();
  mp.update(car, dt, mode === 'drive' && !watch?.active);
  warmer.scope(() => kudos.update(dt));   // (held unseen while a new small picture and its drawing are made ready)
  watch?.frame(dt);
  // counted for race votes by the same rule as the online list: on the map, page in view (off the map
  // for 30 s still counts, see AWAY_S; a racer before the lights counts from the garage too)
  mp.setDriving(((mode === 'drive' && !document.hidden && !watch?.active) || !!raceMode?.holding) && !stageBusy(), stageBusy());
  mp.setWhere(document.hidden ? 'away' : watch?.active ? 'watch' : mode === 'drive' ? 'map' : 'garage', watch?.id || '');   // (the menu is the garage)
  // a car left standing with nobody at the controls: a countdown, then the garage (src/idlepark.js)
  idlePark.update(mode === 'drive' && !watch?.active && !readyOn && !dropping && !respawning, ctl, pads.acted(), !!(raceMode?.holding || raceMode?.pin || stage?.pin || stage?.phase === 'count'));
  raceMode?.update(car, dt);
  tyreDefaults();
  people.update();
  const netMs = performance.now() - n0;       // (the other players' part of the frame, for the hitch account)
  if (bigmap.isOpen && mp.count && (mapTimer -= dt) <= 0) { mapTimer = 0.5; bigmap.redraw(); }

  if (mode === 'drive') {
    // remember safe ground
    histTimer -= dt;
    if (car.inWater && !wetAt) { wetAt = { x: car.x, z: car.z, t: car.time - car.waterTime }; stats.count('water'); }
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
    race.update(car, carId, s0Short(), inpNow());
    stage?.update(car, carId, s0Short(), dt, inpNow());
    if (stage) trackPills();
  }
  stats.frame({ mode, dt, raw: rawDt, felt, car: carId, x: car.x, z: car.z, kmh: Math.abs(speedKmh(car)), inp: inpNow(), view: camView, gfx: gfx.level, others: mp.count, lapCp: race?.passed ?? -1,
    from: gapFrom, fz: lastFrame, doing: raceMode?.ghost ? 'race' : stage?.running || stage?.phase === 'count' ? 'stage' : race?.running ? 'hotlap' : 'free' });
  // short hitches (src/hitches.js): was the frame before late, and what was it busy with; and pictures that
  // reached the screen later than the one before though the frames were on time
  hitches.frame(rawDt * 1000, felt, lastFrame, { others: mp.count, since: driveT ? (t0 - driveT) / 1000 : 0 });
  const heldNow = lag.steps - lagSteps;
  if (heldNow) { if (felt && rawDt < 0.05 && heldNow < 3) hitches.pictureLate({ others: mp.count }); lagSteps = lag.steps; }
  // (AUTO trims the sharpness when pictures keep being held back: counted in plain driving only, not in the first
  // 45 s after DRIVE while the town loads, and not where the frame before sent something new to the card or built
  // a lot, which fewer pixels would not help)
  heldPics.held = heldNow < 3 ? heldNow : 0;
  heldPics.count = felt && rawDt < 0.05 && driveT > 0 && t0 - driveT > 45000 && !lastFrame.progs && !lastFrame.tex && !lastFrame.car && !(lastFrame.build > 2);
  lastFrame.net = netMs; lastFrame.car = 0;

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

  // ---- camera (tg: the car it follows, ours or, spectating, the watched one)
  const tg = WV || car;
  if (WV && watch.takeSnap()) { camYaw = tg.yaw; camSnap = true; droneYaw = tg.yaw; droneDir.set(Math.sin(tg.yaw), -Math.cos(tg.yaw)); camSwoop = 0; }
  const speed = Math.hypot(tg.vx, tg.vy);
  if (mode === 'drive') {
    // Everything here eases a few rig numbers (heading, distance, height, slope) and then places the
    // camera exactly from them. Easing the camera's position instead leaves it trailing the car by a
    // length that depends on the frame time, so at speed every uneven frame nudged the view back or forth.
    const ease = (rate) => 1 - Math.exp(-rate * dt);
    let d = tg.yaw - camYaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    camYaw += d * ease(3 + speed * 0.08);
    const cx = Math.sin(camYaw), cz = -Math.cos(camYaw);
    // a street photo is narrower than the game's view, so over photos the camera backs off and zooms in
    const pm = photos?.mix ?? 0;
    // (a bus sets its own rig: further back and higher, so its 12 metres fit the view)
    const cs = tg.spec.cam || {};
    const wantDist = (6.4 + (cs.dist ?? 0) + Math.min(speed, 55) * 0.035 + Math.min(speed, 70) * 0.075) * (1 + 0.45 * pm);
    const top = tg.y + (tg.inWater ? Math.min(3, tg.waterTime) : 0);
    // how steeply the ground falls away ahead (positive downhill), read off the ground itself
    if (!tg.airborne && !tg.inWater) {
      const gy = tg.y + 0.4;
      const fall = (world.groundAt(tg.x - cx * 4, tg.z - cz * 4, gy) - world.groundAt(tg.x + cx * 4, tg.z + cz * 4, gy)) / 8;
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
    camPos.set(tg.x - cx * camDist, camY + 2.35 + (cs.up ?? 0) + camDist * down * 1.35, tg.z - cz * camDist);
    const floor = world.heightAt(camPos.x, camPos.z) + 0.9;
    if (camPos.y < floor) camPos.y = floor;
    camLook.set(tg.x + cx * 2, camY + 1.15 + (cs.look ?? 0) - down * 3, tg.z + cz * 2);
    // above 150 km/h the view stretches a touch more and the edges close in a little
    const fast = Math.min(1, Math.max(0, (speed - 41.7) / 33));
    let warp = fast * fast * (3 - 2 * fast);
    let wantFov = (58 + Math.min(speed, 60) * 0.22 + warp * 4) * (1 - 0.3 * pm);
    const fx = Math.sin(tg.yaw), fz = -Math.cos(tg.yaw);
    if (ctl.look && !board?.open) {
      // B held: look back from just in front of the car's nose, over the roof down the road behind. The rig
      // swings on the chase camera's eased heading (camYaw), so in a turn it drags behind the car a little
      // instead of being bolted to it.
      const half = tg.halfLen;
      camPos.set(tg.x + cx * (half + 6.5), tg.y + 2.7 + (cs.up ?? 0) * 0.5, tg.z + cz * (half + 6.5));
      camPos.y = Math.max(camPos.y, world.heightAt(camPos.x, camPos.z) + 0.9);
      camLook.set(tg.x - cx * 18, tg.y + 0.9, tg.z - cz * 18);
      wantFov = 62; warp = 0; camSwoop = 0;
    } else {
      droneMix = Math.max(0, Math.min(1, droneMix + (camView === 'drone' ? dt : -dt) / VIEW_BLEND));
    }
    const dw = ctl.look && !board?.open ? 0 : smooth(droneMix);
    if (dw > 0) {
      // A drone following the car from above, set back so the road coming up shows. It turns with the
      // direction the car is travelling, averaged over a few seconds: a donut or a quick swerve averages
      // out to almost nothing and barely moves it, and once the car settles on a new heading it swings
      // round smoothly.
      if (speed > 1) {
        // (backing up, the way the car faces counts, so reversing out of a spot does not turn the view round)
        const sg = tg.vx < -0.5 ? -1 : 1;
        const tx = sg * (Math.sin(tg.yaw) * tg.vx + Math.cos(tg.yaw) * tg.vy), tz = sg * (-Math.cos(tg.yaw) * tg.vx + Math.sin(tg.yaw) * tg.vy);
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
      camPos.lerp(dronePos.set(tg.x - dx * h * 0.55, camY + h, tg.z - dz * h * 0.55), dw);
      camLook.lerp(droneLook.set(tg.x + dx * ahead, camY, tg.z + dz * ahead), dw);
      wantFov += (55 - wantFov) * dw; warp *= 1 - dw;
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
  camera.updateProjectionMatrix();
  camera.lookAt(camLook);
  if (flyIn) {
    // turn from the drone's view to the chase view a little ahead of the move, so the car is in frame on arrival
    camera.quaternion.slerpQuaternions(flyIn.q0, flyQ.copy(camera.quaternion), smooth(Math.min(1, flyIn.t / 0.8)));
    if (flyIn.t >= 1) flyIn = null;
  }

  // ---- world updates
  sky.position.copy(camera.position);
  sky.material.uniforms.uTime.value = elapsed;
  if (intro) lights.sun.target.position.copy(camLook);
  else lights.sun.target.position.set(tg.x, tg.y, tg.z);
  lights.sun.position.copy(lights.sun.target.position).add(lights.sunOffset);
  water.update(elapsed);
  edge.mat.uniforms.uCam.value.copy(camera.position);
  edge.mat.uniforms.uTime.value = elapsed;
  updateTrees(elapsed, camera.position);
  kuuni?.frame(dt, camera);                       // the Anderson's hologram turns to the camera
  tileTimer -= dt;
  if (tileTimer <= 0) {
    tileTimer = 0.25;
    if (++shrinkTick % 4 === 0) {
      // (once a second: what the city streamed in since)
      if (shrinker) shrinker.scan(scene, jobs.live ? 3 : Infinity, WF.x, WF.z);
      else if (liteLate && mode === 'drive' && gfx.auto && lowRung()) {
        // a desktop that auto graphics has kept below full sharpness for 20 s: small pictures from now on
        lowSince ||= performance.now();
        if (performance.now() - lowSince > 20000) { shrinker = createPhoneTextures(renderer, { perScan: 3 }); liteWhy = 'slow in this drive'; console.info('Light mode: small pictures from now on (slow in this drive)'); }
      } else lowSince = 0;
      // (and the mark for the next start: extra low after 20 s of a drive on the two lowest levels, the
      // full game again after a minute at full sharpness; see xlow at the top)
      if (!isTouch && gfx.auto && mode === 'drive' && !navigator.webdriver) {
        const lv = gfx.levels[gfx.level], now = gfx.level <= 1 ? 1 : lv && lv.dpr >= 1 ? -1 : 0;
        xlowRun = now === xlowWas ? xlowRun + 1 : 0; xlowWas = now;
        try {
          if (now === 1 && xlowRun === 20 && !stored(XLOW)) localStorage.setItem(XLOW, '1');
          if (now === -1 && xlowRun === 60 && stored(XLOW)) localStorage.removeItem(XLOW);
        } catch {}
      }
    }
    if (!jobs.resting) {
      const b0 = performance.now();
      warmer.scope(() => { trackside.update(WF.x, WF.z); trackKerbs.update(WF.x, WF.z); });
      if (jobs.live && performance.now() - b0 > 6) jobs.rest();
    }
    if (intro) world.update(introFocus.x, introFocus.z, quality.loadRadius, quality.loadRadius + 500, { x: car.x, z: car.z, r: 300 });
    // (spectating: around the watched car, and a little around our own, which is where we come back to)
    else if (watch?.active) world.update(WF.x, WF.z, quality.loadRadius, quality.loadRadius + 500, { x: car.x, z: car.z, r: 300 });
    else world.update(car.x, car.z, quality.loadRadius, quality.loadRadius + 500, flyIn && { x: flyIn.from.x, z: flyIn.from.z, r: 700 });
    terrain.update(camera.position);
    for (const s of world.sectors.values()) if (s.tree) s.tree.setNear(s.d < 260);
  }
  // queued building work (map squares, painted fronts, ground tiles): a few milliseconds of it every frame
  // (the queue gets about a third of a frame: 5 ms at 60 a second, more where frames are longer, so that the
  // work gets done as fast by the clock on a slow machine)
  // Work that has waited over 4 s (an old computer, or a very fast drive into the centre) is hurried: up
  // to half a frame of it, no rests, and bigger steps into the picture. An empty street is worse than a
  // slower frame. What counts as a long step is a share of the frame time too (12 ms at 60 a second).
  const q0 = performance.now();
  // (frameMs: the usual frame time, not the last frame's. It follows a longer frame by a quarter at most, so
  // one late frame does not make the next one's share bigger and later still: in the check of 21 Nov two
  // 2048 px pictures went to the card in the frame after a long one, 150 ms.)
  pace = Math.max(4, pace + (Math.min(200, rawDt * 1000, pace * 1.25) - pace) * 0.05);
  const frameMs = pace, hurry = jobs.live && (jobs.waited > 4000 || warmer.waited > 4000);
  warmer.scope(() => jobs.tick(hurry ? Math.max(5, Math.min(50, frameMs * 0.5)) : Math.max(2.5, Math.min(14, frameMs * 0.3)), Math.max(12, frameMs * 0.25), hurry));
  // what all that added to the scene: made ready unseen, then let in (src/warm.js). Not in a frame where the
  // queue's step was a long one, and after a long step of its own the queue rests: one long thing a frame.
  // (another player's car, a step of it: see toCard. Not on top of a picture the queue sent or a long step of
  // it, but not kept waiting for more than a third of a second either)
  if (cardQueue.length && ((!jobs.sentPx && performance.now() - q0 < 6) || ++cardWait > 20)) { cardWait = 0; const px = cardStep(); if (px) { jobs.tell(px); lastFrame.car = 1; } }
  const q1 = performance.now();
  if (!jobs.live || hurry || q1 - q0 < Math.max(8, frameMs * 0.15)) {
    warmer.tick((frameMs / 16.7) * (hurry ? 4 : 1));
    if (jobs.live && !hurry && performance.now() - q1 > Math.max(8, frameMs * 0.15)) jobs.rest();
  }
  lastFrame.build = performance.now() - q0;
  lastFrame.draw = lastFrame.progs = lastFrame.tex = 0;
  part.build += (lastFrame.build - part.build) * 0.05;
  hudTimer -= dt;
  // (spectating: the watched car's speed, revs, street and minimap)
  const hc = watch?.view || car;
  if (hc !== car && hc.spec !== watchSpec) { watchSpec = hc.spec; hud.setCar(hc.spec); }
  if (mode === 'drive' && hudTimer <= 0) { hudTimer = 0.06; hud.update(hc); }
  if (mode === 'drive') hud.needle(hc, dt);
  showPedals();
  rocketUi.update(mode === 'drive' && !watch?.active ? car : null, rocketOff, flipOff);
  audio.update(car, mode === 'drive' && !bigmap.isOpen && !watch?.active);
  audio.updateRemotes(mp.remotes(), camera, mode === 'drive' && !bigmap.isOpen);
  audio.updateSpace(world, car, camera, dt, mode === 'drive' && !bigmap.isOpen && !watch?.active);

  if (photos?.update(camera, dt)) {
    const hideTrees = photos.mix > 0.5 && params.get('phtrees') !== '1';   // the photo has the real trees in it
    for (const s of world.sectors.values()) if (s.tree) s.tree.group.visible = !hideTrees;
    treesHidden = hideTrees;
    photos.render(scene, camera, model.group);
  } else if (!still || (warm < WARM_FRAMES && world.ready(car.x, car.z) && (!warmGate || lag.behind === 0) && (readyWait || ++warmSkip % 4 === 0))) {
    // (behind the phones' still menu picture nothing is drawn, but for the warm-up frames: see WARM_FRAMES)
    const far = camera.far;
    if (still) { warm++; camera.far = 25 + (far - 25) * (warm / WARM_FRAMES) ** 2; camera.updateProjectionMatrix(); }
    if (treesHidden) { treesHidden = false; for (const s of world.sectors.values()) if (s.tree) s.tree.group.visible = true; }
    const d0 = performance.now(), progs0 = renderer.info.programs?.length || 0, tex0 = renderer.info.memory.textures;
    shrinker?.wake();                              // a picture of a place the car is coming back to (phonetex.js)
    onePass(scene);                                // see-through sheets in one go (src/still.js)
    gpuTimer.begin();
    renderer.render(scene, camera);
    gpuTimer.end();
    lag.mark();
    lastFrame.draw = performance.now() - d0;
    lastFrame.progs = (renderer.info.programs?.length || 0) - progs0;
    lastFrame.tex = renderer.info.memory.textures - tex0;
    part.draw += (lastFrame.draw - part.draw) * 0.05;
    if (still) camera.far = far;
    if (still && warm >= WARM_FRAMES && mode === 'menu') shadersReady();
  }
  if (readyWait) { showReady(); if (warmedUp() || performance.now() - readyWait > 40000) startDriving(); }

  // ---- graphics quality follows the measured frame rate (src/quality.js)
  // (not judged: a tab coming back, the city loading after a jump, the phones' menu shot drawn at half rate)
  if (settle > 0 || intro?.fixed || still || !world.ready(car.x, car.z)) gfx.hold(1);   // (nothing is drawn behind the still menu picture)
  const jsMs = performance.now() - t0;
  lastFrame.js = jsMs;
  if (stats.on) lastFrame.heap = performance.memory?.usedJSHeapSize || 0;
  const ch = gfx.frame(rawDt * 1000, jsMs, gpuTimer.ms, heldPics);
  if (back) {
    back.n++; back.f += rawDt * 1000; back.js += jsMs; back.worst = Math.max(back.worst, rawDt * 1000);
    const since = performance.now() - back.at;
    if (since >= back.next) {
      console.info(`back in the tab +${Math.round(since / 1000)} s: ${(1000 * back.n / back.f).toFixed(0)} fps, game code ${(back.js / back.n).toFixed(1)} ms${gpuTimer.ms != null ? `, graphics card ${gpuTimer.ms.toFixed(1)} ms` : ''} of ${(back.f / back.n).toFixed(1)} ms a frame, worst ${back.worst.toFixed(0)} ms`);
      Object.assign(back, { n: 0, f: 0, js: 0, worst: 0, next: back.next + 2000 });
      if (since > 30000) back = null;
    }
  }
  if (ch) console.info(`graphics: rung ${ch.from} -> ${ch.to} (${ch.why}, ${gfx.fps.toFixed(0)} fps)`);
  // Less detail did not make it faster: something outside the game holds the frame rate, most often a
  // battery saver (Chrome's Energy Saver and the phones' low power modes give 30). Say so once: a player
  // sees only that the game is not smooth (Martin's MacBook on a low battery, 20 Nov).
  if (ch?.why === 'no gain' && gfx.capped && gfx.capped < 50 && !capTold) {
    capTold = true;
    stats.trouble('cap');
    if (mode === 'drive') hud.toast(isTouch ? `YOUR PHONE HOLDS THE GAME AT ${Math.round(gfx.capped)} FPS · LOW POWER MODE?` : `YOUR BROWSER HOLDS THE GAME AT ${Math.round(gfx.capped)} FPS · BATTERY SAVER? PLUG IN THE CHARGER`, 7000);
  }
  if (!optEl.classList.contains('hidden')) showGfx();
}

// debug / test hook: the whole of it only for the automated tests and on a developer's own machine. On the live
// site the console gets the hitch account alone (26 Nov 2026: with the car in reach, `__game.car.spec` was one
// line to a car with twice the pull and grip, and two Audi 200 lap records were driven that way. The server now
// judges a record's drive against the car, src/race/plausible.js: this only takes the easy way in away.)
const devHook = navigator.webdriver || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
window.__game = !devHook ? { hitches } : {
  hitches,
  // advance the physics without rendering (used by automated tests)
  sim(seconds, inp = {}) { for (let t = 0; t < seconds; t += 1 / 60) stepCar(car, inp, world, 1 / 60); },
  get car() { return car; }, get world() { return world; }, jobs, warmer, tex: () => shrinker?.stats, texList: () => shrinker?.list(), get lite() { return liteWhy; }, xlow, lag, get still() { return still; }, get warm() { return warm; }, get mode() { return mode; }, get flying() { return !!flyIn; }, setCar, goHome, place, startDriving, openMap, dropAt, skids: () => skids, smoke: () => smoke, bigmap: () => bigmap, renderer, scene, camera, gfx, gpu, terrain: () => terrain, photos: () => photos,
  skins: () => skinLog, race: () => race, raceMode: () => raceMode, mp: () => mp, lane: () => lane, watch: () => watch, audio, props: () => props, janese: () => janese, parked: () => parked, busStops: () => busStops, orident: () => orident, aksi: () => aksi, discgolf: () => discgolf, roadFix: () => roadFix, propThin: () => propThin, pads, setup, get ctl() { return ctl; }, board: () => board, stage: () => stage, kudos: () => kudos };

boot().then(() => requestAnimationFrame(frame)).catch((err) => {
  console.error(err);
  $('#loadmsg').textContent = `Could not load the game: ${err.message}`;
});
