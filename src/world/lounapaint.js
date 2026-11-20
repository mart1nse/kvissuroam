// Road markings round Lõunakeskus, the Ringtee/Riia junction, K-Rauta and the Riia road to Sõinaste, made to match
// the real roads. Every painted road in the area was checked against the Land Board's 10 cm air photo and Martin's
// Street View shots (Circle K, McDonald's, KFC, Teaduspargi, the hotel, the parking deck, Riia road at Decora):
//  - no centre line where the real road has none: the rings of every roundabout (also the two rings of the
//    Ringtee/Riia junction), the service roads round Bauhof, Circle K, McDonald's and KFC, Teaduspargi tänav, the
//    car park aisles and yards, the stubs into the roundabouts with their splitter islands;
//  - solid white edge lines along the ring road (Lääneringtee), its ramps and the divided Riia road (E264) from the
//    junction to the Aardla roundabout, broken where another road joins. The four-lane town stretch of Riia
//    towards Sõinaste has kerbs and no edge lines, so it keeps only its centre and lane lines.
// No street names or road numbers are painted (the "E264" in Street View is Google's label, not paint).
// Nothing here is a texture or a new mesh: the lines are drawn by roads.js with the rest of the map's lines.

// a point near the middle of each road that loses its centre line, and the road's width (to tell it from a
// crossing road)
const NO_LINE = [
  [-693.6, 5285.4, 10.6], [-318.5, 4990.5, 6.6], [-744.8, 5363.1, 8.6], [-911.0, 5555.0, 10.6], [-1172.5, 5561.9, 7.6],
  [-1011.3, 5607.1, 8.6], [-388.4, 5793.6, 7.6], [-395.2, 5780.9, 7.6], [-456.0, 5783.6, 7.6], [-383.3, 5736.6, 8.6],
  [-709.5, 5271.6, 10.6], [-586.2, 5233.1, 6.6], [-1261.4, 5173.1, 6.6], [-1135.2, 5710.6, 6.6], [-1165.2, 5260.6, 8.6],
  [-966.8, 5630.7, 8.6], [-908.0, 5456.5, 8.6], [-781.9, 5264.5, 6.6], [-1034.4, 5285.0, 8.6], [-1225.3, 4781.0, 9.6],
  [-1144.9, 5078.6, 7.6], [-1099.3, 5179.6, 6.6], [-1131.3, 5176.7, 6.6], [-1181.5, 5155.6, 7.6], [-1126.6, 5025.7, 8.6],
  [-1321.7, 5084.9, 9.6], [-1116.2, 5778.6, 7.6], [-1234.0, 5713.3, 7.6], [-901.6, 5515.6, 8.6], [-944.6, 5402.2, 8.6],
  [-926.5, 5464.4, 6.6], [-1288.2, 4969.3, 8.6], [-1180.3, 5028.5, 8.6], [-1158.2, 5014.7, 8.6], [-1145.2, 5033.2, 8.6],
  [-1153.9, 5047.0, 8.6], [-1168.8, 5048.3, 8.6], [-1321.4, 5469.1, 8.6], [-1104.0, 5138.6, 8.6], [-1114.0, 5182.1, 6.6],
  [-1237.0, 5133.2, 7.6], [-713.3, 5300.6, 6.6], [-388.9, 5675.9, 11.6], [-1238.8, 4969.8, 8.6], [-1211.7, 5655.0, 7.6],
  [-422.6, 5921.4, 12.6], [-1234.7, 5063.7, 6.6], [-1364.5, 5192.1, 7.6], [-1234.3, 5171.0, 7.6], [-1202.8, 5092.4, 8.6],
  [-1257.3, 4984.4, 6.6], [-1350.8, 5203.0, 7.6], [-1194.3, 4994.0, 8.6], [-1347.6, 5190.9, 7.6], [-797.0, 5326.7, 6.6],
  [-551.4, 5906.8, 8.6], [-516.4, 5942.8, 8.6], [-605.8, 5909.5, 8.6], [-387.9, 5667.0, 11.6], [-382.8, 5650.6, 8.6],
  [-1189.8, 5598.7, 7.6], [-380.5, 5792.8, 7.6], [-1359.7, 5211.6, 12.6], [-1181.3, 5514.0, 8.6], [-1026.8, 4865.2, 11.6],
  [-1285.3, 4949.3, 6.6], [-1179.1, 5045.2, 8.6], [-1043.4, 4866.8, 8.6], [-1259.2, 4941.5, 6.6], [-1272.2, 4960.5, 6.6],
  [-1174.4, 5013.2, 8.6], [-1255.6, 5211.4, 7.6], [-1223.9, 5138.1, 7.6], [-943.8, 5599.9, 7.6], [-941.7, 5604.8, 7.6],
  [-937.1, 5577.1, 8.6], [-950.5, 5586.7, 6.6], [-900.9, 5501.1, 8.6], [-930.0, 5597.9, 7.6], [-926.5, 5585.9, 7.6],
  [-1070.1, 5567.5, 10.6], [-954.8, 5581.4, 7.6], [-861.0, 5631.9, 9.6], [-743.2, 5673.3, 7.6], [-694.3, 5709.1, 6.6],
  [-1273.6, 4928.4, 8.6], [-1276.2, 4842.1, 7.6], [-1280.2, 4934.7, 6.6], [-1366.5, 4780.7, 7.6], [-1324.7, 4839.6, 7.6],
  [-1270.8, 4809.5, 8.6], [-1182.4, 4998.3, 6.6], [-1371.1, 4868.3, 7.6], [-1020.5, 5852.9, 7.6], [-1054.4, 5827.6, 7.6],
  [-1073.5, 5851.2, 7.6], [-1072.6, 5827.5, 13.6], [-392.8, 5861.1, 6.6], [-391.4, 5844.0, 6.6], [-411.9, 5864.4, 6.6],
  [-414.2, 5840.4, 6.6], [-636.5, 5736.2, 6.6], [-653.2, 5757.2, 6.6], [-423.4, 5857.5, 11.6], [-514.2, 5693.4, 6.6],
  [-506.7, 5709.6, 6.6], [-535.0, 5713.1, 6.6], [-625.5, 5756.5, 6.6], [-527.2, 5686.6, 8.6], [-502.6, 5700.2, 8.6],
  [-669.7, 5548.0, 6.6], [-501.3, 5725.6, 7.6], [-520.9, 5720.8, 6.6], [-506.6, 5720.2, 7.6], [-474.0, 5715.4, 7.6],
  [-495.4, 5724.1, 7.6], [-533.5, 5697.7, 6.6], [-626.5, 5743.9, 6.6], [-850.8, 5463.5, 7.6], [-804.3, 5492.9, 7.6],
  [-828.0, 5504.3, 7.6], [-855.1, 5482.5, 7.6], [-823.5, 5451.5, 7.6], [-839.9, 5453.7, 7.6], [-812.7, 5501.1, 7.6],
  [-800.1, 5477.2, 7.6], [-383.2, 5850.4, 8.6], [-401.2, 5871.4, 7.6], [-764.6, 5321.4, 6.6], [-1023.3, 5875.1, 8.6],
  [-730.4, 5321.4, 6.6], [-1288.1, 4939.6, 7.6], [-1041.7, 5874.4, 7.6], [-728.3, 5610.8, 6.6], [-659.1, 5707.0, 8.6],
  [-500.9, 5965.9, 8.6],
];

// the area Martin outlined, a little generous
const AREA = [[-1456, 4806], [-1263, 4763], [-1077, 4749], [-999, 4770], [-1006, 5070], [-949, 5170], [-849, 5227],
  [-756, 5270], [-677, 5227], [-591, 5156], [-477, 5084], [-334, 4999], [-191, 4913], [-49, 4813], [51, 4713],
  [144, 4720], [151, 4741], [23, 4827], [-106, 4941], [-249, 5027], [-363, 5113], [-477, 5241], [-549, 5370],
  [-563, 5456], [-491, 5541], [-391, 5627], [-356, 5741], [-356, 5913], [-449, 5977], [-520, 5970], [-591, 5913],
  [-649, 5813], [-734, 5670], [-777, 5627], [-820, 5641], [-891, 5713], [-949, 5813], [-1006, 5920], [-1077, 5934],
  [-1120, 5856], [-1206, 5770], [-1349, 5684], [-1463, 5627], [-1484, 5541], [-1477, 5427], [-1420, 5341],
  [-1406, 5256], [-1356, 5170], [-1334, 5070], [-1349, 4956], [-1434, 4884]];
function inArea(x, z) {
  let c = false;
  for (let i = 0, j = AREA.length - 1; i < AREA.length; j = i++) {
    const [x1, z1] = AREA[i], [x2, z2] = AREA[j];
    if ((z1 > z) !== (z2 > z) && x < x1 + (z - z1) * (x2 - x1) / (z2 - z1)) c = !c;
  }
  return c;
}

function nearLine(pts, x, z, d) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
    if (Math.hypot(ax + dx * t - x, az + dz * t - z) < d) return true;
  }
  return false;
}

function middle(pts) {
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  let d = total / 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    if (d <= l) { const t = l ? d / l : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]; }
    d -= l;
  }
  return pts[pts.length - 1];
}

export function lounaPaintVectors(vectors) {
  const near = vectors.roads.filter((r) => r.pts.length > 1 && r.pts.some(([x, z]) => x > -1500 && x < 160 && z > 4700 && z < 6000));
  for (const [x, z, w] of NO_LINE) {
    for (const r of near) {
      if (Math.abs(r.w - w) < 0.05 && (r.type === 'Tänav' || r.type === 'Põhimaantee') && nearLine(r.pts, x, z, 0.6)) r.nomark = true;
    }
  }
  for (const r of near) {
    const ramp = r.type === 'Ramp või ühenduste', ring = r.name === 'Tallinna-Tartu-Võru-Luhamaa tee';
    const riia = r.name === 'Jõhvi-Tartu-Valga tee' && r.w < 13;          // the divided stretch, not the town one
    if ((r.type === 'Põhimaantee' && (ring || riia)) || ramp) {
      const [mx, mz] = middle(r.pts);
      if (inArea(mx, mz)) r.edges = true;
    }
  }
}
