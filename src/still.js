// Less work for the browser each frame before anything is drawn.
//
// Drawing a frame starts on the page's own thread: three.js walks every object of the scene, works out
// where each one is, looks up its shader, and only then hands the calls to the graphics card. On an old
// computer or a phone that walk is the biggest single part of a frame (Martin's readouts of 21 Nov 2026: a
// 2019 MacBook Air 15 to 27 ms of "drawing" in frames of 46 to 72 ms, with its graphics chip only 13 to
// 21 ms busy; a Xiaomi phone 6 to 18 ms). Three things in it were wasted:
//
// - A see-through surface with both sides showing (a bus shelter's glass, a sign on a post, the glass of
//   the hand-built houses) is drawn by three.js in two goes, back then front, and each go changes the
//   material and has its shader looked up again. Two dozen such materials in view were a quarter of the
//   whole walk. They are all flat sheets, where one go gives the same picture: `onePass`.
// - Each object's place in the world was worked out again every frame from its position, turn and size,
//   moved or not. A parked car, a kerb, a sign never moves: `still`.
// - A place that is hidden (far from the car) was walked like the rest: `skipHidden`.
import * as THREE from 'three';

const plain = THREE.Object3D.prototype.updateMatrixWorld;

function settle(o, force) {
  if (o.matrixAutoUpdate) { o.updateMatrix(); o.matrixAutoUpdate = false; }      // (updateMatrix marks the world matrix as needing its update)
  if (o.matrixWorldNeedsUpdate || force) {
    if (o.matrixWorldAutoUpdate === true) {
      if (o.parent === null) o.matrixWorld.copy(o.matrix);
      else o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix);
    }
    o.matrixWorldNeedsUpdate = false;
    force = true;
  }
  const kids = o.children;
  for (let i = 0, n = kids.length; i < n; i++) {
    const c = kids[i];
    if (c.updateMatrixWorld === plain) settle(c, force); else c.updateMatrixWorld(force);       // (a camera, a light, a group with its own rule)
  }
}

// A group whose things stand where they were put: each one's place is worked out in the first frame it
// is in the scene and kept. To move one later, set its position and call `stir` on it (the things
// under it follow).
export function still(group) {
  group.updateMatrixWorld = function (force) { settle(this, force); };
  return group;
}
export function stir(o) { o.matrixAutoUpdate = true; }

// The scene's walk leaves out the groups directly under it that are hidden, once they have been walked
// since they were last shown (so what was built in them while hidden is in place when they appear, and
// anything asking a hidden thing where it is gets the place it had).
export function skipHidden(scene) {
  const rested = new Set();
  scene.matrixAutoUpdate = false;
  scene.updateMatrixWorld = function (force) {
    const kids = this.children;
    if (rested.size > 200) rested.clear();          // (groups taken out of the scene while hidden)
    for (let i = 0, n = kids.length; i < n; i++) {
      const c = kids[i];
      if (c.visible) { c.updateMatrixWorld(force); if (rested.size) rested.delete(c); }
      else if (!rested.has(c)) { c.updateMatrixWorld(force); rested.add(c); }
    }
  };
}

// See-through, two-sided surfaces of the scene in one go. Called every frame, it looks at `n` of the groups
// directly under the scene and so gets round them all in a second or two (the whole scene at once was 3 ms
// on a slow processor): what was just built is drawn in two goes until its turn comes, which only costs time.
// Points and lines are left alone (three.js draws them whole in both goes, twice as bright, and the look
// was made with that), and so is a material marked `userData.twoPass` (a closed see-through shape whose
// far side must be drawn before its near side).
let at = 0;
export function onePass(scene, n = 2) {
  const kids = scene.children;
  for (let k = 0; k < n && kids.length; k++) { at = (at + 1) % kids.length; kids[at].traverse(visit); }
}
function visit(o) {
  if (!o.isMesh) return;
  const m = o.material;
  if (Array.isArray(m)) { for (const q of m) one(q); } else if (m) one(m);
}
function one(m) {
  if (m.transparent === true && m.side === THREE.DoubleSide && m.forceSinglePass !== true && !m.userData.twoPass) m.forceSinglePass = true;
}
