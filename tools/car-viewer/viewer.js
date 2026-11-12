// Dev viewer: /tools/car-viewer/index.html?car=w201&view=rear[&brake=1&head=1&reverse=1&steer=0.3&hud=0]
// Optional free camera: &cam=x,y,z&tgt=x,y,z&fov=40
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildCarModel, CAR_IDS } from '../../src/cars/models/index.js';

const q = new URLSearchParams(location.search);
const id = q.get('car') || CAR_IDS[0];
const view = q.get('view') || 'rear';
const VIEWS = {
  rear: { cam: [0, 2.2, 6.4], tgt: [0, 0.75, 0], fov: 42 },
  rear34: { cam: [3.9, 1.75, 5.2], tgt: [0, 0.65, 0.2], fov: 38 },
  side: { cam: [8.2, 1.1, 0], tgt: [0, 0.7, 0], fov: 34 },
  front34: { cam: [3.7, 1.6, -5.3], tgt: [0, 0.65, -0.2], fov: 38 },
  top: { cam: [0, 9.5, 0.01], tgt: [0, 0, 0], fov: 34 },
  front: { cam: [0, 1.3, -6.5], tgt: [0, 0.7, 0], fov: 38 },
  back: { cam: [0, 1.0, 5.0], tgt: [0, 0.8, 0], fov: 36 },
  low34: { cam: [2.6, 0.9, 4.6], tgt: [0, 0.7, 0.9], fov: 36 },
};
const V = { ...(VIEWS[view] || VIEWS.rear) };
const v3 = (s) => s.split(',').map(Number);
if (q.get('cam')) V.cam = v3(q.get('cam'));
if (q.get('tgt')) V.tgt = v3(q.get('tgt'));
if (q.get('fov')) V.fov = +q.get('fov');

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const sky = document.createElement('canvas'); sky.width = 4; sky.height = 256;
const sg = sky.getContext('2d'), gr = sg.createLinearGradient(0, 0, 0, 256);
gr.addColorStop(0, '#7fa6d6'); gr.addColorStop(0.55, '#cfdcea'); gr.addColorStop(1, '#e9e6de');
sg.fillStyle = gr; sg.fillRect(0, 0, 4, 256);
const skyTex = new THREE.CanvasTexture(sky); skyTex.colorSpace = THREE.SRGBColorSpace;
scene.background = skyTex;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
scene.environmentIntensity = 0.9;

const sun = new THREE.DirectionalLight(0xfff2e0, 2.2);
sun.position.set(4, 8, 5); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 25 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x8a8478, 0.6));

const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x9a9a96, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const t0 = performance.now();
const car = buildCarModel(id);
const buildMs = performance.now() - t0;
scene.add(car.group);
car.setLights({ brake: q.get('brake') === '1', reverse: q.get('reverse') === '1', headlights: q.get('head') === '1' });
if (q.get('steer')) { car.wheels.fl.steer.rotation.y = +q.get('steer'); car.wheels.fr.steer.rotation.y = +q.get('steer'); }
if (q.get('spin')) for (const k in car.wheels) car.wheels[k].spin.rotation.x = +q.get('spin');

const camera = new THREE.PerspectiveCamera(V.fov, innerWidth / innerHeight, 0.1, 200);
camera.position.set(...V.cam);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(...V.tgt); controls.update();

let meshes = 0, lights = 0, noShadow = 0;
car.group.traverse((o) => { if (o.isMesh) { meshes++; if (!o.castShadow) noShadow++; } if (o.isLight) lights++; });
const box = new THREE.Box3().setFromObject(car.group), size = box.getSize(new THREE.Vector3());

function frame() {
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
renderer.render(scene, camera);
window.__stats = {
  id, buildMs: Math.round(buildMs), meshes, lights, noShadow,
  triangles: car.triangles, calls: renderer.info.render.calls, sceneTris: renderer.info.render.triangles,
  bbox: { min: box.min.toArray().map((x) => +x.toFixed(3)), max: box.max.toArray().map((x) => +x.toFixed(3)), size: size.toArray().map((x) => +x.toFixed(3)) },
  spec: { wheelRadius: car.wheelRadius, wheelbase: car.wheelbase, track: car.track, size: car.size },
};
if (q.get('hud') !== '0') document.getElementById('hud').textContent = `${id} · ${view} · ${car.triangles} tris · ${meshes} meshes · built in ${Math.round(buildMs)} ms`;
else document.getElementById('hud').remove();
window.__ready = true;
frame();
