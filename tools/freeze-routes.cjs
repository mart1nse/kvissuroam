// Test drives for tools/freeze-profile.cjs and tools/gpu-burst.cjs: lines of [x, z] map points the car is moved along.
// (the lap itself is 'lap': taken from the game's track when the page runs)
const ROUTES = {
  // Turu, Riia/Turu, Kaubamaja, Küüni, Raekoja plats, Delta, Lai, Katoliku, Kuperjanovi, Pepleri and back
  centre: [[2420, 3760], [2300, 3640], [2120, 3380], [1990, 3180], [1900, 3130], [1840, 3080], [1724, 3085], [1600, 3010], [1480, 2915], [1450, 2840], [1470, 2700], [1500, 2500], [1575, 2260], [1300, 2420], [960, 2626], [740, 2630], [800, 2950], [886, 3290], [1150, 3340], [1400, 3200], [1724, 3085]],
  // Riia tänav out to Lõunakeskus, back by Arhitekti
  riia: [[1724, 3085], [1400, 3500], [1201, 3745], [948, 3957], [726, 4143], [427, 4394], [238, 4755], [-180, 4890], [-520, 5650], [-880, 5680], [-1150, 5440], [-1260, 5000], [-968, 4156]],
  // the start, Pootsmani, Coop, Jänese, Raadi, Kõrveküla
  north: [[80, -10], [-283, 115], [80, 60], [527, 481], [1300, 1000], [1990, 1505], [2100, 500], [2200, -420], [2450, -360], [2860, -370], [3200, -900], [3560, -1450], [3620, -2120], [3905, -2160], [4020, -2310]],
  // road 3 at Raadi: Vana-Peetri and Põllu up past Salvest, Coop, Mööbliait and Circle K to the Jõgeva fork, then
  // Kvissentali tee west to the start (the kaardista of 21 Nov)
  raadi: [[700, 1080], [600, 880], [560, 760], [510, 600], [495, 300], [488, 90], [483, -57], [470, -200], [440, -380], [470, -200], [482, -76], [333, -55], [145, -30], [80, -10]],
  // Äksi and the Ice Age Centre
  aksi: [[-1300, -12300], [-1789, -13222], [-1830, -13400], [-2150, -13230], [-1789, -13222]],
  // Nõela village road
  noela: [[-6300, -6500], [-7040, -7130], [-7650, -7600]],
  // the old town by the university: Ülikooli from Vanemuise past the town hall to Munga, round by Jakobi, out by Lossi
  ulikooli: [[1700, 3160], [1591, 3154], [1476, 3030], [1435, 2965], [1384, 2892], [1340, 2843], [1307, 2777], [1294, 2690], [1275, 2650], [1169, 2719], [1190, 2795], [1297, 2780], [1335, 2836], [1250, 2872], [1147, 2915]],
  // Ülenurme: the Konsum on Võru mnt, the interchange, Lennu tn to the airport, along the runway and back (kaardista 22 Nov)
  airport: [[1700, 10040], [1620, 10120], [1545, 10300], [1480, 10420], [1300, 10300], [900, 10480], [400, 10580], [-30, 10535], [-105, 10580], [-110, 10650], [-120, 10760], [-90, 10900], [-84, 11006], [400, 10973], [-84, 11006], [-900, 11063], [-84, 11006], [-120, 10760]],
  // Narva mnt: from Tasku over Võidu sild, past Kivi, Delta and the Jüri church to Peetri kirik and Raadi Maxima
  // (kaardista 22 Nov)
  narva: [[1905, 3060], [1893, 2950], [1897, 2887], [1877, 2764], [1825, 2693], [1716, 2522], [1646, 2376], [1635, 2255], [1640, 2140], [1667, 1975], [1734, 1774], [1831, 1583], [1874, 1504]],
  // the first kilometre of centre (for gpu-burst.cjs, which is slow)
  short: [[2420, 3760], [2300, 3640], [2120, 3380], [1990, 3180], [1900, 3130], [1840, 3080], [1724, 3085], [1600, 3010]],
};
module.exports = ROUTES;
