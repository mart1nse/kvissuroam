// The names under the minimap and on the big map. The Land Board's road map names a state road through town by its
// route ("Tartu-Tiksoja tee", "Jõhvi-Tartu-Valga tee"), so the label stuck on Tartu-Tiksoja tee from Kreutzwaldi
// through Jakobi, Kroonuaia, Emajõe and Vabaduse (Martin, 24 Nov: a race lap on Lai showed it for half a lap).
// Each such piece in town gets the street's own name in `label`; `name` is left as it is, because the road
// paint and the hand-built places look roads up by it. Done once at load, nothing per frame.
//
// [route name, test on the piece's middle (x east, z south, metres), street]: the first test that passes names it.
// Where the streets meet: Kreutzwaldi/Jakobi at Laulupeo puiestee and Hermanni (670, 2510), Jakobi/Kroonuaia at
// Tähtvere and Baeri (948, 2606), Kroonuaia/Emajõe at (1332, 2184), Emajõe/Vabaduse at the Vabadussild junction
// (1440, 2312), Vabaduse/Riia/Narva at the Riia and Turu junction (1816, 3073). Narva maantee runs from Fortuuna
// to the town's edge ("Narva mnt (Fortuuna tn - linna piir)" in the same map), Riia from that junction to the Riia
// ring by Lõunakeskus. Kreutzwaldi stops where its house numbers stop, past the university's campus.
const RULES = [
  ['Tartu-Tiksoja tee', (x, z) => x < 670 && z > 1000, 'Friedrich Reinhold Kreutzwaldi tänav'],
  ['Tartu-Tiksoja tee', (x, z) => x >= 670 && x < 935 && z > 2400, 'Jakobi tänav'],
  ['Tartu-Tiksoja tee', (x, z) => x >= 935 && x < 1320 && z > 2150, 'Kroonuaia tänav'],
  ['Tartu-Tiksoja tee', (x, z) => x >= 1320 && x < 1445 && z > 2150, 'Emajõe tänav'],
  ['Tartu-Tiksoja tee', (x, z) => x >= 1445 && x < 1830 && z > 2300, 'Vabaduse puiestee'],
  ['Jõhvi-Tartu-Valga tee', (x, z) => x > -810 && z > 3060 && z < 5440, 'Riia tänav'],
  ['Jõhvi-Tartu-Valga tee', (x, z) => x > 400 && x < 2000 && z > 100 && z <= 3060, 'Narva maantee'],
];

export function realStreetNames(vectors) {
  for (const r of vectors.roads) {
    if (!r.name || r.pts.length < 2) continue;
    const a = r.pts[0], b = r.pts[r.pts.length - 1];
    const x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
    for (const [route, test, street] of RULES) if (r.name === route && test(x, z)) { r.label = street; break; }
  }
}
