// Test drives for tools/freeze-profile.cjs and tools/gpu-burst.cjs: lines of [x, z] map points the car is moved along.
// (the lap itself is 'lap': taken from the game's track when the page runs)
const ROUTES = {
  // Turu, Riia/Turu, Kaubamaja, Küüni, Raekoja plats, Delta, Lai, Katoliku, Kuperjanovi, Pepleri and back
  centre: [[2420, 3760], [2300, 3640], [2120, 3380], [1990, 3180], [1900, 3130], [1840, 3080], [1724, 3085], [1600, 3010], [1480, 2915], [1450, 2840], [1470, 2700], [1500, 2500], [1575, 2260], [1300, 2420], [960, 2626], [740, 2630], [800, 2950], [886, 3290], [1150, 3340], [1400, 3200], [1724, 3085]],
  // Riia tänav out to Lõunakeskus, back by Arhitekti
  riia: [[1724, 3085], [1400, 3500], [1201, 3745], [948, 3957], [726, 4143], [427, 4394], [238, 4755], [-180, 4890], [-520, 5650], [-880, 5680], [-1150, 5440], [-1260, 5000], [-968, 4156]],
  // the start, Pootsmani, Coop, Jänese, Raadi, Kõrveküla
  north: [[80, -10], [-283, 115], [80, 60], [527, 481], [1300, 1000], [1990, 1505], [2100, 500], [2200, -420], [2450, -360], [2860, -370], [3200, -900], [3560, -1450], [3620, -2120], [3905, -2160], [4020, -2310]],
  // the Pootsmani loop from the start: down the east arm past no. 12, round the south end and up the west arm (23 Nov)
  pootsmani: [[80, -10], [-60, 10], [-176, 9], [-160, 52], [-147, 95], [-137, 138], [-131, 175], [-127, 225], [-134, 266], [-167, 288], [-207, 275], [-241, 229], [-267, 178], [-283, 117], [-289, 40]],
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
  airport: [[1700, 10040], [1620, 10120], [1545, 10300], [1480, 10420], [1300, 10300], [900, 10480], [400, 10580], [-30, 10535], [-105, 10580], [-110, 10650], [-120, 10760], [-90, 10900], [-84, 11006], [400, 10973], [-84, 11006], [-900, 11063], [-1225, 11082], [-900, 11063], [-84, 11006], [-120, 10760]],
  // Narva mnt: from Tasku over Võidu sild, past Kivi, Delta and the Jüri church to Peetri kirik and Raadi Maxima
  // (kaardista 22 Nov)
  narva: [[1905, 3060], [1893, 2950], [1897, 2887], [1877, 2764], [1825, 2693], [1716, 2522], [1646, 2376], [1635, 2255], [1640, 2140], [1667, 1975], [1734, 1774], [1831, 1583], [1874, 1504]],
  // Ujula: off Narva mnt past the Coop Konsum and along the university sports hall's car park (22 Nov)
  ujula: [[1646, 2376], [1635, 2255], [1600, 2160], [1530, 2110], [1500, 2070], [1460, 2040], [1420, 2000], [1440, 1975], [1480, 1940], [1520, 1900]],
  // from Narva mnt at Raadi out to ERM, round its car park and along the museum to its east end (22 Nov)
  erm: [[1874, 1504], [2100, 1350], [2300, 1160], [2384, 990], [2470, 960], [2600, 975], [2760, 1000], [2930, 1000], [3080, 1060]],
  // Vaksali: from Kuperjanovi past the railway station, the hotel and the water tower and back (22 Nov)
  vaksali: [[900, 3300], [760, 3420], [640, 3520], [570, 3555], [520, 3525], [470, 3490], [560, 3560], [600, 3600], [640, 3660], [700, 3760], [760, 3860]],
  // Aovere / Haava: road 3 from the south to the junction, road 43 north and back, road 44 to Aasa tee and its
  // three houses, back to 44 and out along Kiigi tee (kaardista 23 Nov)
  aovere: [[5861, -4163], [6006, -4356], [6068, -4607], [6090, -4838], [6165, -4890], [6197, -5020], [6290, -5197], [6197, -5020], [6165, -4890], [6176, -4812], [6208, -4745], [6338, -4616], [6536, -4818], [6653, -4966], [6695, -5025], [6653, -4966], [6536, -4818], [6338, -4616], [6704, -4302], [6984, -4489], [7300, -4697], [7420, -4790]],
  // the first kilometre of centre (for gpu-burst.cjs, which is slow)
  short: [[2420, 3760], [2300, 3640], [2120, 3380], [1990, 3180], [1900, 3130], [1840, 3080], [1724, 3085], [1600, 3010]],
  // Raadi manor park along the rally stage's paths: the park's stones set on the ground as the car comes, its
  // planted trees and the widened gravel in the map squares that load (23 Nov)
  raadipark: [[2382, 490], [2398, 468], [2418, 451], [2441, 468], [2464, 484], [2487, 499], [2506, 495], [2522, 472], [2544, 465], [2566, 467], [2568, 444], [2551, 422], [2553, 394], [2568, 370], [2563, 343], [2571, 318], [2596, 313], [2622, 322], [2648, 333], [2673, 345], [2697, 358], [2725, 362], [2751, 373], [2756, 395], [2762, 423], [2763, 450], [2762, 478], [2785, 491], [2809, 507], [2828, 502], [2836, 475], [2856, 464], [2878, 449], [2897, 439], [2910, 416], [2919, 389], [2907, 366], [2881, 367], [2872, 394], [2853, 416], [2826, 415], [2817, 390], [2798, 371], [2769, 375], [2756, 395], [2762, 423], [2763, 450], [2762, 478], [2785, 491], [2809, 507], [2834, 517], [2856, 532], [2867, 556], [2861, 585], [2841, 606], [2827, 630], [2817, 657], [2795, 674], [2769, 680], [2745, 672], [2733, 647], [2715, 633], [2717, 660]],
  // the way in to the Raadi rally stage (route `stage` in freeze-profile.cjs): Narva mnt from 740 m out of the park
  // (beyond the 600 m at which the stage builds itself) down to the stage's own lane, short of its start line
  stageIn: [[2107, 963], [2144, 881], [2176, 804], [2196, 760], [2219, 707], [2237, 667], [2265, 611], [2300, 553], [2327, 514], [2341, 494], [2349, 484], [2362, 490], [2374.7, 500.4]],
  // Soinaste: Rehepapi tee from Meremäe tee south past Rattasepa tee 5, Miridon and the halls to Rehetare tee 1 and
  // the roundabout (kaardista 23 Nov)
  soinaste: [[224, 6885], [296, 7033], [346, 7235], [392, 7462], [469, 7703], [493, 7776], [558, 7927], [564, 7938], [636, 8043]],
};
module.exports = ROUTES;
