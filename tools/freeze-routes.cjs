// Test drives for tools/freeze-profile.cjs and tools/gpu-burst.cjs: lines of [x, z] map points the car is moved along.
// (the lap itself is 'lap': taken from the game's track when the page runs)
const ROUTES = {
  // Turu, Riia/Turu, Kaubamaja, Küüni, Raekoja plats, Delta, Lai, Katoliku, Kuperjanovi, Pepleri and back
  centre: [[2420, 3760], [2300, 3640], [2120, 3380], [1990, 3180], [1900, 3130], [1840, 3080], [1724, 3085], [1600, 3010], [1480, 2915], [1450, 2840], [1470, 2700], [1500, 2500], [1575, 2260], [1300, 2420], [960, 2626], [740, 2630], [800, 2950], [886, 3290], [1150, 3340], [1400, 3200], [1724, 3085]],
  // Riia tänav out to Lõunakeskus, back by Arhitekti
  riia: [[1724, 3085], [1400, 3500], [1201, 3745], [948, 3957], [726, 4143], [427, 4394], [238, 4755], [-180, 4890], [-520, 5650], [-880, 5680], [-1150, 5440], [-1260, 5000], [-968, 4156]],
  // the start, Pootsmani, Coop, Jänese, Raadi, Kõrveküla
  north: [[80, -10], [-283, 115], [80, 60], [527, 481], [1300, 1000], [1990, 1505], [2100, 500], [2200, -420], [2450, -360], [2860, -370], [3200, -900], [3560, -1450], [3620, -2120], [3905, -2160], [4020, -2310]],
  // Äksi and the Ice Age Centre
  aksi: [[-1300, -12300], [-1789, -13222], [-1830, -13400], [-2150, -13230], [-1789, -13222]],
  // Nõela village road
  noela: [[-6300, -6500], [-7040, -7130], [-7650, -7600]],
  // the old town by the university: Ülikooli from Vanemuise past the town hall to Munga, round by Jakobi, out by Lossi
  ulikooli: [[1700, 3160], [1591, 3154], [1476, 3030], [1435, 2965], [1384, 2892], [1340, 2843], [1307, 2777], [1294, 2690], [1275, 2650], [1169, 2719], [1190, 2795], [1297, 2780], [1335, 2836], [1250, 2872], [1147, 2915]],
  // the first kilometre of centre (for gpu-burst.cjs, which is slow)
  short: [[2420, 3760], [2300, 3640], [2120, 3380], [1990, 3180], [1900, 3130], [1840, 3080], [1724, 3085], [1600, 3010]],
};
module.exports = ROUTES;
