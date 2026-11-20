// Riia tänav, batch 6 of the "riiastrip" kaardista (Martin, 20 Nov): Riia 94 to 128, past Ravila to Raja. The houses
// were already dressed from the air photos (lounakeskus5.js); this adds what the Street View shots show at the front:
//  - Riia 94 on the Sõinaste corner: the clipped hedge behind a dark board fence (shots "94", "97");
//  - Riia 114: the white picket fence before the dark red board house (shot "114"; its colour is in lounakeskus5.js);
//  - Riia 118: the green picket fence before the ochre house (shot "116");
//  - Riia 122 past Raja: the dark board fence and the hedge behind it (shot "122 Riia").
// No street name is painted on the road.
import * as THREE from 'three';
import { areaKit, frame } from './handbuilt.js';

// Riia from the Ravila lights to Raja: s along the street to the south-west, v + = the north-west side
const RF = frame([65.2, 4697.1], [-0.819, 0.574]);
const L = RF.at;

export function createRiia7(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  // the fence lines stay clear of map trees
  const lines = [[-2, 20, -13.4], [298, 324, -13.0], [366, 392, -13.6], [490.5, 501, -17.9]];
  world.addClearing({ test: (x, z) => { const [s, v] = RF.sv(x, z); return lines.some(([a, b, w]) => s > a - 1 && s < b + 1 && Math.abs(v - w) < 1.6); } });
  let built = false;
  const CENTRE = L(240, 0);

  function build() {
    built = true;
    const A = areaKit(world, group, { shadows });
    const run = (s0, s1, v) => [L(s0, v), L(s1, v)];
    // Riia 94: dark boards, the hedge over them, a gap for the gate
    A.picket(run(-2, 3, -13.0), 1.2, [62, 50, 44]);
    A.picket(run(6, 20, -13.0), 1.2, [62, 50, 44]);
    A.hedge([L(-2, -13.85), L(3, -13.85)], 1.9, 0.8);
    A.hedge([L(6, -13.85), L(20, -13.85)], 1.9, 0.8);
    A.gate(L(3.1, -13.0), L(5.9, -13.0), 1.25, 0x3a302a);
    // Riia 114: white pickets
    A.picket(run(298, 309.5, -13.0), 1.1, [236, 236, 232]);
    A.picket(run(312.5, 324, -13.0), 1.1, [236, 236, 232]);
    // Riia 118: green pickets
    A.picket(run(366, 377, -13.6), 1.0, [64, 150, 84]);
    A.picket(run(380, 392, -13.6), 1.0, [64, 150, 84]);
    // Riia 122: dark boards with the hedge behind
    A.picket(run(490.5, 501, -17.5), 1.3, [70, 52, 42]);
    A.hedge([L(490.5, -18.5), L(501, -18.5)], 1.8, 1.0);
    A.finish();
  }

  return {
    update(car) {
      if (built || !car) return;
      if (Math.hypot(car.x - CENTRE[0], car.z - CENTRE[1]) > 420) return;
      if ([L(0, -13), L(310, -13), L(495, -17)].every((q) => world.ready(q[0], q[1]))) build();
    },
  };
}
