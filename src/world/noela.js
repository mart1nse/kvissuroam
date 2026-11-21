// Nõela village (Martin, 20 Nov: a pink outline on a map), the gravel road north from route 41 up to the Lombi and
// Pihlaka farms, dressed from the Land Board's oblique air photos (2023, 2024) and the 2024 orthophoto. The map's
// own blocks keep their shapes; their walls are painted and their roofs coloured:
//  - by route 41: the blue-grey house with the black roof, the red barn and the white shed;
//  - the old fenced yard on the bend (dark red and grey board houses);
//  - the ochre house with the red roof and its long shed, behind a row of tall conifers;
//  - the yellow house and garage with the pale green roofs inside a clipped hedge;
//  - the long white house with the grey roof and the row of small thujas along its drive;
//  - the new sage-green house with the dark roof;
//  - the dark red farmhouse with the thujas along its curved drive;
//  - Keskküla: the old farm of long grey-roofed buildings with the patched tin roofs and the spruces by the road;
//  - Antoni: the red-roofed two-storey house, the red cross-gabled house and the long barn;
//  - Lombi (east): the pale green house, the grey board barn and the shed;
//  - Pihlaka (west): the red board house with the blue-grey roof, the lime green houses and the barns, inside a
//    dark board fence, and a silver Porsche Carrera GT on the paved yard in front of the red house.
// The village had no trees at all in the game: the trees are planted where the orthophoto shows crowns (dark ones
// as spruces). Window counts, doors and the backs are guessed. No street name is painted on the road.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses, wallPlanes } from './houseskin.js';
import { areaKit, frame } from './handbuilt.js';
import { buildCarModel, buildCarInWorker } from '../cars/models/index.js';
import { warm } from '../warm.js';

// ---------------------------------------------------------------- the road frame
// s metres along Nõela tee from route 41, v metres across it, + to the west (left going north)
const ROAD = [[-6780.3, -6730.0], [-6816.3, -6765.1], [-6836.0, -6773.7], [-6868.4, -6782.3], [-6876.0, -6792.3], [-6888.8, -6818.5], [-6903.4, -6849.4], [-6950.1, -6946.0], [-7043.5, -7134.7], [-7084.3, -7180.5], [-7114.3, -7214.7], [-7128.2, -7230.6], [-7185.4, -7288.9], [-7234.8, -7341.3], [-7244.7, -7353.5], [-7250.3, -7363.5], [-7255.7, -7379.9], [-7263.6, -7413.8], [-7292.0, -7554.9], [-7349.5, -7824.1]];
const SEG = [];
{
  let acc = 0;
  for (let i = 0; i < ROAD.length - 1; i++) {
    const a = ROAD[i], b = ROAD[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    SEG.push({ a, s0: acc, len, u: [(b[0] - a[0]) / len, (b[1] - a[1]) / len] });
    acc += len;
  }
}
function R(s, v = 0) {
  const g = SEG.find((q) => s < q.s0 + q.len) || SEG[SEG.length - 1], t = s - g.s0;
  return [g.a[0] + g.u[0] * t + g.u[1] * v, g.a[1] + g.u[1] * t - g.u[0] * v];
}
const DEBUG = typeof location !== 'undefined' && /noeladebug/.test(location.search);

// ---------------------------------------------------------------- trees
// crowns found on the 2024 orthophoto within about 70 m of the road: [x, z, height, crown, type]
const TREES = [[-7150.0, -7205.0, 22, 9, 1], [-7136.0, -7194.5, 18, 9, 0], [-7146.0, -7201.5, 22, 9, 1], [-7150.0, -7210.0, 22, 9, 1], [-7140.5, -7197.5, 22, 9, 1], [-7132.0, -7198.0, 18, 9, 0], [-7152.5, -7200.5, 18, 9, 0], [-7155.0, -7205.0, 22, 9, 1], [-7145.5, -7207.5, 22, 9, 1], [-7131.0, -7192.5, 22, 9, 1], [-7174.5, -7215.5, 22, 9, 1], [-7138.5, -7190.0, 18, 9, 0], [-7179.0, -7213.0, 22, 9, 1], [-7152.5, -7215.0, 22, 9, 1], [-7156.0, -7181.5, 22, 9, 1], [-7174.5, -7220.5, 18, 9, 0], [-6765.5, -6803.0, 18, 9, 0], [-7168.0, -7213.0, 22, 9, 1], [-7148.5, -7197.0, 18, 9, 0], [-7141.5, -7185.0, 22, 9, 1], [-7155.0, -7210.0, 22, 9, 1], [-7155.0, -7196.0, 18, 9, 0], [-7159.5, -7222.5, 22, 9, 1], [-7141.0, -7202.5, 22, 9, 1], [-7155.5, -7219.5, 22, 9, 1], [-7131.5, -7203.0, 22, 9, 1], [-7141.5, -7210.5, 18, 9, 0], [-7128.5, -7188.0, 18, 9, 0], [-7180.5, -7192.5, 22, 9, 1], [-6806.5, -6779.0, 18, 9, 0], [-7146.0, -7213.0, 22, 9, 1], [-7157.0, -7189.5, 22, 9, 1], [-7143.0, -7193.0, 17.2, 9, 0], [-6883.5, -6731.0, 22, 9, 1], [-7307.0, -7373.0, 21.8, 8.9, 1], [-7325.0, -7365.0, 16.4, 8.9, 0], [-7160.0, -7203.0, 16.4, 8.9, 0], [-6835.5, -6718.0, 16.4, 8.9, 0], [-6760.0, -6805.5, 21.8, 8.9, 1], [-7127.0, -7198.5, 21.6, 8.8, 1], [-7160.0, -7227.5, 16.2, 8.8, 0], [-6767.5, -6796.5, 21.6, 8.8, 1], [-6779.0, -6787.0, 15.9, 8.6, 0], [-7140.0, -7223.5, 15.9, 8.6, 0], [-6850.5, -6723.0, 21.2, 8.6, 1], [-7160.0, -7208.5, 21.2, 8.6, 1], [-6898.5, -6745.0, 21.2, 8.6, 1], [-7170.0, -7232.0, 15.6, 8.4, 0], [-7133.5, -7188.0, 20.8, 8.4, 1], [-7161.0, -7180.0, 20.8, 8.4, 1], [-7164.5, -7188.5, 19.6, 7.8, 1], [-6868.0, -6736.5, 14.7, 7.8, 0], [-7174.5, -7210.5, 19.6, 7.8, 1], [-6863.5, -6728.0, 19.6, 7.8, 1], [-6812.5, -6775.0, 14.7, 7.8, 0], [-7170.0, -7223.5, 18.8, 7.4, 1], [-7170.5, -7194.0, 14.1, 7.4, 0], [-6785.5, -6775.5, 13.5, 7.0, 0], [-7178.5, -7223.5, 13.5, 7.0, 0], [-6878.0, -6724.0, 13.5, 7.0, 0], [-7183.5, -7210.5, 13.5, 7.0, 0], [-6873.0, -6724.5, 13.5, 7.0, 0], [-7152.0, -7268.0, 18.0, 7.0, 1], [-7247.5, -7371.5, 18.0, 7.0, 1], [-6802.0, -6776.5, 13.5, 7.0, 0], [-6889.0, -6714.0, 17.4, 6.7, 1], [-6877.5, -6746.5, 13.1, 6.7, 0], [-7128.0, -7183.0, 17.4, 6.7, 1], [-7258.0, -7324.5, 12.9, 6.6, 0], [-7168.5, -7374.0, 17.2, 6.6, 1], [-6880.5, -6770.0, 17.2, 6.6, 1], [-7119.0, -7136.0, 17.2, 6.6, 1], [-7176.5, -7195.5, 12.9, 6.6, 0], [-7276.0, -7385.0, 12.6, 6.4, 0], [-7175.5, -7188.0, 16.8, 6.4, 1], [-7127.5, -7206.0, 12.6, 6.4, 0], [-6809.0, -6783.5, 16.8, 6.4, 1], [-7126.0, -7192.5, 16.8, 6.4, 1], [-7157.0, -7176.5, 12.3, 6.2, 0], [-7179.5, -7201.5, 16.4, 6.2, 1], [-7179.0, -7218.0, 16.4, 6.2, 1], [-6858.0, -6727.5, 16.4, 6.2, 1], [-7287.0, -7382.0, 16.4, 6.2, 1], [-6873.5, -6768.0, 12.3, 6.2, 0], [-7146.5, -7183.5, 16.4, 6.2, 1], [-7165.0, -7183.0, 16.4, 6.2, 1], [-7270.5, -7386.5, 11.9, 5.9, 0], [-7321.5, -7369.0, 11.9, 5.9, 0], [-7250.5, -7325.5, 15.8, 5.9, 1], [-6870.0, -6715.0, 15.8, 5.9, 1], [-6972.0, -6862.0, 11.9, 5.9, 0], [-6857.0, -6762.0, 11.4, 5.6, 0], [-6831.5, -6745.0, 15.2, 5.6, 1], [-7096.0, -7263.5, 15.2, 5.6, 1], [-6888.0, -6722.0, 15.2, 5.6, 1], [-6851.5, -6737.5, 11.4, 5.6, 0], [-7186.5, -7194.5, 15.2, 5.6, 1], [-6780.5, -6781.5, 15.0, 5.5, 1], [-6803.5, -6785.5, 15.0, 5.5, 1], [-6885.0, -6767.0, 15.0, 5.5, 1], [-6792.5, -6769.5, 15.0, 5.5, 1], [-7262.5, -7288.0, 15.0, 5.5, 1], [-7177.5, -7308.5, 15.0, 5.5, 1], [-7191.5, -7310.0, 15.0, 5.5, 1], [-7187.0, -7306.0, 15.0, 5.5, 1], [-6878.5, -6711.5, 15.0, 5.5, 1], [-7249.5, -7594.0, 11.2, 5.5, 0], [-6884.5, -6736.0, 15.0, 5.5, 1], [-7174.0, -7379.0, 15.0, 5.5, 1], [-6904.0, -6745.0, 15.0, 5.5, 1], [-6922.5, -6752.5, 15.0, 5.5, 1], [-6873.0, -6749.0, 11.2, 5.5, 0], [-7191.0, -7399.0, 11.2, 5.5, 0], [-6839.5, -6721.5, 15.0, 5.5, 1], [-7145.0, -7226.0, 11.2, 5.5, 0], [-7134.5, -7177.5, 15.0, 5.5, 1], [-7165.0, -7230.5, 15.0, 5.5, 1], [-7138.5, -7214.5, 15.0, 5.5, 1], [-7167.0, -7208.0, 11.2, 5.5, 0], [-7179.0, -7208.0, 11.2, 5.5, 0], [-7170.0, -7218.0, 11.2, 5.5, 0], [-7164.0, -7216.5, 15.0, 5.5, 1], [-7259.5, -7590.0, 10.4, 4.9, 0], [-7312.0, -7611.5, 13.8, 4.9, 1], [-7253.5, -7563.5, 13.8, 4.9, 1], [-7332.5, -7571.5, 10.4, 4.9, 0], [-7133.5, -7248.5, 13.8, 4.9, 1], [-7267.5, -7310.0, 13.8, 4.9, 1], [-6875.5, -6731.0, 13.8, 4.9, 1], [-6869.0, -6741.5, 13.8, 4.9, 1], [-6884.5, -6742.0, 13.8, 4.9, 1], [-6846.0, -6743.0, 13.8, 4.9, 1], [-7282.0, -7382.5, 13.8, 4.9, 1], [-7151.5, -7222.5, 13.8, 4.9, 1], [-6827.5, -6691.0, 10.1, 4.7, 0], [-7238.5, -7590.0, 10.1, 4.7, 0], [-7184.0, -7218.0, 13.4, 4.7, 1], [-7080.5, -7266.0, 13.4, 4.7, 1], [-7134.0, -7209.0, 10.1, 4.7, 0], [-7282.0, -7532.5, 13.4, 4.7, 1], [-6923.5, -6855.0, 13.4, 4.7, 1], [-6895.0, -6716.0, 10.1, 4.7, 0], [-6797.0, -6778.0, 10.1, 4.7, 0], [-6775.5, -6720.5, 13.4, 4.7, 1], [-7217.5, -7384.5, 10.1, 4.7, 0], [-7055.0, -7179.5, 13.4, 4.7, 1], [-6928.0, -6749.5, 13.4, 4.7, 1], [-6910.0, -6747.5, 13.4, 4.7, 1], [-6859.5, -6735.5, 10.1, 4.7, 0], [-7295.0, -7374.0, 13.0, 4.5, 1], [-7303.0, -7376.5, 13.0, 4.5, 1], [-6898.0, -6750.5, 13.0, 4.5, 1], [-7298.0, -7379.0, 9.8, 4.5, 0], [-6862.5, -6757.5, 13.0, 4.5, 1], [-7309.5, -7368.5, 9.8, 4.5, 0], [-6868.5, -6767.5, 13.0, 4.5, 1], [-7190.5, -7406.0, 13.0, 4.5, 1], [-7085.5, -7194.5, 13.0, 4.5, 1], [-7225.5, -7452.5, 9.8, 4.5, 0], [-7376.0, -7615.0, 9.8, 4.5, 0], [-7370.0, -7617.0, 9.6, 4.4, 0], [-7246.5, -7613.5, 9.6, 4.4, 0], [-7173.5, -7305.5, 12.8, 4.4, 1], [-7051.0, -7194.0, 12.8, 4.4, 1], [-7110.0, -7194.5, 12.8, 4.4, 1], [-6897.0, -6810.0, 12.8, 4.4, 1], [-6915.5, -6803.5, 12.8, 4.4, 1], [-6862.5, -6714.0, 12.8, 4.4, 1], [-7277.5, -7509.0, 9.6, 4.4, 0], [-7144.0, -7179.0, 12.8, 4.4, 1], [-7328.5, -7566.5, 12.8, 4.4, 1], [-7165.0, -7177.0, 12.8, 4.4, 1], [-7138.5, -7258.5, 12.8, 4.4, 1], [-7203.0, -7353.5, 12.8, 4.4, 1], [-7127.0, -7217.0, 12.8, 4.4, 1], [-7242.5, -7580.5, 12.8, 4.4, 1], [-6900.0, -6764.5, 12.8, 4.4, 1], [-6843.0, -6750.0, 9.6, 4.4, 0], [-7152.5, -7236.0, 12.8, 4.4, 1], [-7174.5, -7234.5, 9.6, 4.4, 0], [-6839.0, -6734.0, 12.8, 4.4, 1], [-7236.5, -7613.0, 9.6, 4.4, 0], [-7241.5, -7613.5, 9.6, 4.4, 0], [-7251.5, -7614.0, 9.0, 4.0, 0], [-7164.5, -7222.5, 12.0, 4.0, 1], [-6816.5, -6694.5, 9.0, 4.0, 0], [-7240.5, -7574.5, 12.0, 4.0, 1], [-7120.5, -7275.5, 12.0, 4.0, 1], [-7105.5, -7277.5, 12.0, 4.0, 1], [-7173.0, -7205.5, 9.0, 4.0, 0], [-7085.0, -7280.5, 12.0, 4.0, 1], [-7166.5, -7200.5, 12.0, 4.0, 1], [-7220.5, -7535.5, 12.0, 4.0, 1], [-7306.0, -7473.0, 9.0, 4.0, 0], [-7182.5, -7308.5, 12.0, 4.0, 1], [-6766.0, -6808.0, 12.0, 4.0, 1], [-6770.5, -6802.5, 12.0, 4.0, 1], [-6925.5, -6799.0, 12.0, 4.0, 1], [-6761.0, -6800.5, 12.0, 4.0, 1], [-6936.0, -6794.5, 12.0, 4.0, 1], [-7183.5, -7188.5, 9.0, 4.0, 0], [-6838.5, -6714.0, 9.0, 4.0, 0], [-6855.0, -6770.0, 12.0, 4.0, 1], [-7227.5, -7352.5, 12.0, 4.0, 1], [-6881.5, -6716.0, 12.0, 4.0, 1], [-7209.0, -7392.5, 12.0, 4.0, 1], [-7214.0, -7392.5, 9.0, 4.0, 0], [-6796.5, -6766.5, 9.0, 4.0, 0], [-6890.0, -6765.5, 12.0, 4.0, 1], [-6864.5, -6763.5, 12.0, 4.0, 1], [-6802.0, -6759.0, 12.0, 4.0, 1], [-6928.0, -6757.0, 12.0, 4.0, 1], [-7224.0, -7386.5, 12.0, 4.0, 1], [-6770.5, -6721.0, 12.0, 4.0, 1], [-6883.0, -6722.0, 9.0, 4.0, 0], [-6855.5, -6723.0, 9.0, 4.0, 0], [-6874.5, -6742.5, 9.0, 4.0, 0], [-6833.0, -6723.0, 9.0, 4.0, 0], [-6842.0, -6740.0, 9.0, 4.0, 0], [-6922.0, -6735.0, 12.0, 4.0, 1], [-7322.0, -7377.5, 12.0, 4.0, 1], [-6853.0, -6729.0, 9.0, 4.0, 0], [-6887.5, -6727.5, 12.0, 4.0, 1], [-7183.5, -7226.5, 12.0, 4.0, 1], [-6868.0, -6724.5, 11.0, 3.5, 1], [-6903.0, -6738.0, 11.0, 3.5, 1], [-6852.5, -6742.5, 11.0, 3.5, 1], [-7243.0, -7374.0, 11.0, 3.5, 1], [-6834.5, -6749.0, 11.0, 3.5, 1], [-6874.0, -6755.5, 11.0, 3.5, 1], [-6901.0, -6755.0, 8.2, 3.5, 0], [-6857.5, -6715.0, 11.0, 3.5, 1], [-7271.0, -7398.5, 11.0, 3.5, 1], [-7138.5, -7180.5, 8.2, 3.5, 0], [-6867.0, -6797.5, 11.0, 3.5, 1], [-7134.5, -7316.5, 11.0, 3.5, 1], [-7142.0, -7312.5, 8.2, 3.5, 0], [-6805.0, -6705.0, 8.2, 3.5, 0], [-7218.5, -7530.0, 11.0, 3.5, 1], [-7087.0, -7291.0, 11.0, 3.5, 1], [-7243.5, -7549.0, 8.2, 3.5, 0], [-7186.5, -7205.5, 11.0, 3.5, 1], [-7086.5, -7275.0, 11.0, 3.5, 1], [-7325.5, -7570.5, 11.0, 3.5, 1], [-7148.5, -7218.0, 11.0, 3.5, 1], [-7139.0, -7252.0, 11.0, 3.5, 1], [-7134.5, -7225.5, 11.0, 3.5, 1]];
// small columnar thujas lining the drives (the long white house, the dark red farmhouse)
const THUJAS = [];
for (let v = 9; v <= 41; v += 4) for (const d of [-2.6, 2.6]) THUJAS.push([...R(337 + d, v), 3.2, 1.1, 1]);
for (let k = 0; k < 11; k++) { const q = R(560 + k * 1.2 + 2.6, 7 + k * 5); THUJAS.push([q[0], q[1], 3.4, 1.2, 1]); }
// the tall conifer row behind the ochre house, and the spruces by the road at Keskküla
const ROWS = [];
for (let s = 160; s <= 222; s += 2.6) ROWS.push([...R(s, 78), 9 + (s % 3), 3.0, 1]);
for (let s = 612; s <= 676; s += 4.5) ROWS.push([...R(s, -9), 15 + (s % 4), 4.5, 1]);

// ---------------------------------------------------------------- what the map's own data needs
const SOUTH = '-10_-10', NORTH = '-10_-11', WEST = '-11_-11';
const HOUSES = [
  // name, sector, base, centre, reach, wall, roof
  ['a-house', SOUTH, 542, [-6712.3, -6701.1], 11, 0x8d9aa6, 0x2b2d31],
  ['a-barn', SOUTH, 517, [-6739.0, -6691.8], 12, 0x963028, 0x8a8d90],
  ['a-shed', SOUTH, 561, [-6728.1, -6710.5], 8, 0xe8e6e0, 0x7d8085],
  ['b-old', SOUTH, 455, [-6831.6, -6804.8], 9, 0x7a3e32, 0x36383c],
  ['b-grey', SOUTH, 504, [-6838.6, -6817.5], 8, 0xc8c4ba, 0x9a9c9e],
  ['c-house', SOUTH, 631, [-6940.0, -6829.0], 13, 0xd6a03c, 0xa63a35],
  ['c-shed', SOUTH, 657, [-6950.2, -6843.6], 9, 0xd6a03c, 0xa63a35],
  ['d-house', SOUTH, 694, [-6967.6, -6889.5], 13, 0xdebe46, 0x8fb5a0],
  ['d-garage', SOUTH, 712, [-6985.5, -6914.6], 8, 0xdebe46, 0x8fb5a0],
  ['e-house', SOUTH, 799, [-7016.0, -6970.0], 18, 0xecece8, 0x8c8e8c],
  ['f-house', SOUTH, 1041, [-7077.0, -7064.0], 14, 0x96a896, 0x3d4148],
  ['g-house', SOUTH, 1052, [-7150.0, -7145.0], 12, 0x802824, 0x4a4448],
  ['h-house', NORTH, 1039, [-7100.5, -7214.0], 9, 0xaaa69c, 0x5d5f62],
  ['h-shed', NORTH, 1048, [-7114.4, -7224.6], 7, 0x469696, 0xb7bcc0],
  ['h-long', NORTH, 1040, [-7098.0, -7237.0], 13, 0xd2b46e, 0x8e8f8c],
  ['h-store', NORTH, 1041, [-7101.8, -7247.0], 6, 0x8c8478, 0x8e8f8c],
  ['h-barn', NORTH, 1013, [-7113.0, -7261.0], 18, 0x968c80, 0xa9adb0],
  ['i-house', NORTH, 1100, [-7193.4, -7326.1], 9, 0xe8e4dc, 0x6e2a2c],
  ['i-shed', NORTH, 1111, [-7193.0, -7342.1], 7, 0x9a9488, 0x7a7c7f],
  ['i-barn', NORTH, 1104, [-7189.0, -7381.0], 18, 0x963430, 0x8b8d8f],
  ['i-hut', WEST, 1102, [-7215.0, -7330.9], 7, 0x963430, 0x7a7c7f],
  ['i-hut2', WEST, 1130, [-7202.9, -7346.9], 5, 0x9a9488, 0x7a7c7f],
  ['i-red', WEST, 1142, [-7203.0, -7367.0], 12, 0x8c2c2a, 0x5b5052],
  ['j-house', WEST, 968, [-7252.9, -7540.1], 10, 0xbed2aa, 0x8a8c8e],
  ['j-barn', WEST, 966, [-7270.0, -7551.6], 13, 0xa09687, 0x9a9da0],
  ['j-shed', WEST, 910, [-7239.5, -7560.4], 8, 0x8c8478, 0x7d8a9a],
  ['k-red', WEST, 1066, [-7322.0, -7529.0], 11, 0xa02826, 0x7c8796],
  ['k-wing', WEST, 1090, [-7338.5, -7525.0], 7, 0xa02826, 0x7c8796],
  ['k-green', WEST, 1069, [-7352.5, -7528.0], 11, 0x96be3c, 0x3a3c40],
  ['k-barn', WEST, 1076, [-7331.0, -7513.5], 9, 0x962c28, 0x45474b],
  ['k-shed', WEST, 1074, [-7332.5, -7545.0], 10, 0x5a4a40, 0x45474b],
  ['k-green2', WEST, 1053, [-7355.7, -7554.5], 9, 0xa0c84a, 0x8a8c8e],
];
const ORIGIN = { [SOUTH]: [-7200, -7200], [NORTH]: [-7200, -7840], [WEST]: [-7840, -7840] };

export function noelaWalls(walls) {
  for (const sec of [SOUTH, NORTH, WEST]) {
    setHouseColours(walls, sec, ...ORIGIN[sec], HOUSES.filter((h) => h[1] === sec).map(([, , base, at, r, wall, roof]) => ({ base, x: at[0], z: at[1], wall, roof, reach: r })));
  }
}

export const NOELA_CARS = [
  [-6733.0, -6722.0, 0.4, 'rav4', 'white', 0.03],
  [-6955.0, -6895.6, 1.12, 'passat', 'silver', 0.03],
  [-6957.5, -6900.0, 1.12, 'passat', 'grey', 0.03],
  [-7001.7, -6977.1, 1.11, 'mazda6', 'grey', 0.03],
  [-7139.5, -7154.2, 0.85, 'rav4', 'black', 0.03],
];

// ---------------------------------------------------------------- the painted walls
const C = { glass: '#46525f', trim: '#f3f1ec' };
const rgb = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const farmWin = (o = {}) => ({ w: 1.0, pitch: 2.6, T: true, surround: 0.09, sc: C.trim, frame: C.trim, glass: C.glass, ...o });
const newWin = (o = {}) => ({ T: false, bars: 1, rails: 0, surround: 0.05, frame: '#f2f1ec', glass: C.glass, sill: 0.05, w: 1.3, pitch: 2.9, ...o });
const boards = (wall, o = {}) => ({ kind: 'wood', wall, pitch: 0.15, trim: C.trim, weather: 0.4, plinth: { h: 0.5, col: '#7f7a73' }, win: farmWin(), ...o });
const barn = (wall, o = {}) => boards(wall, { upright: true, weather: 0.55, plinth: { h: 0.4, type: 'rubble' }, win: farmWin({ w: 0.8, pitch: 5.5 }), attic: null, ...o });
const SPEC = {
  'a-house': boards(rgb(0x8d9aa6), { win: newWin(), door: '#3b3d42' }),
  'a-barn': barn(rgb(0x963028)),
  'a-shed': barn(rgb(0xe8e6e0), { trim: '#8a8d90' }),
  'b-old': boards(rgb(0x7a3e32), { weather: 0.6, plinth: { h: 0.5, type: 'rubble' } }),
  'b-grey': boards(rgb(0xc8c4ba), { weather: 0.5 }),
  'c-house': boards(rgb(0xd6a03c), { door: '#6b4c3a' }),
  'c-shed': barn(rgb(0xd6a03c)),
  'd-house': boards(rgb(0xdebe46), { win: newWin({ frame: '#f2f1ec' }), door: '#f2f1ec' }),
  'd-garage': barn(rgb(0xdebe46), { weather: 0.3 }),
  'e-house': { kind: 'plaster', wall: rgb(0xecece8), trim: '#f4f3ef', weather: 0.25, plinth: { h: 0.45, col: '#8f8b85' }, win: newWin({ frame: '#ffffff', w: 1.4 }), door: '#4d4b50', attic: { w: 0.9, h: 1.0 } },
  'f-house': boards(rgb(0x96a896), { weather: 0.15, win: newWin({ frame: '#f4f3ef' }), door: '#3b3d42' }),
  'g-house': boards(rgb(0x802824), { door: '#f1eee6' }),
  'h-house': boards(rgb(0xaaa69c), { weather: 0.6 }),
  'h-shed': barn(rgb(0x469696)),
  'h-long': boards(rgb(0xd2b46e), { weather: 0.55, plinth: { h: 0.55, type: 'rubble' } }),
  'h-store': barn(rgb(0x8c8478)),
  'h-barn': barn(rgb(0x968c80), { weather: 0.7 }),
  'i-house': boards(rgb(0xe8e4dc), { door: '#6e2a2c' }),
  'i-shed': barn(rgb(0x9a9488)),
  'i-barn': barn(rgb(0x963430)),
  'i-hut': barn(rgb(0x963430)),
  'i-hut2': barn(rgb(0x9a9488)),
  'i-red': boards(rgb(0x8c2c2a), { door: '#f1eee6' }),
  'j-house': boards(rgb(0xbed2aa), { weather: 0.5 }),
  'j-barn': barn(rgb(0xa09687), { weather: 0.7 }),
  'j-shed': barn(rgb(0x8c8478)),
  'k-red': boards(rgb(0xa02826), { door: '#f1eee6', weather: 0.25 }),
  'k-wing': boards(rgb(0xa02826), { weather: 0.25 }),
  'k-green': boards(rgb(0x96be3c), { weather: 0.25, door: '#f1eee6' }),
  'k-barn': barn(rgb(0x962c28)),
  'k-shed': barn(rgb(0x5a4a40)),
  'k-green2': boards(rgb(0xa0c84a), { weather: 0.3 }),
};

// a door on the wall that faces the road best (the longest of those that do), for houses that have one
function withDoor(world, H) {
  const spec = SPEC[H[0]];
  const out = { name: H[0], sec: H[1], base: H[2], at: H[3], r: H[4], spec, walls: [] };
  if (!spec.door) return out;
  const planes = wallPlanes(world, H[1], H[2], (x, z) => (x - H[3][0]) ** 2 + (z - H[3][1]) ** 2 < H[4] ** 2);
  let best = null, bs = -1;
  for (const W of planes) {
    if (W.len < 3 || W.foot > 1.2) continue;
    let near = null, nd = 1e9;
    for (let s = 0; s <= 1150; s += 5) { const q = R(s), d = Math.hypot(q[0] - W.mid[0], q[1] - W.mid[1]); if (d < nd) { nd = d; near = q; } }
    if (H[0] === 'a-house') near = [-6745, -6735];                      // the house by route 41 faces its own drive
    const tx = near[0] - W.mid[0], tz = near[1] - W.mid[1], f = (tx * W.nx + tz * W.nz) / (Math.hypot(tx, tz) || 1);
    const score = f > 0.2 ? W.len * f : -1;
    if (score > bs) { bs = score; best = W; }
  }
  if (best) out.walls.push({ near: best.mid, within: 0.4, doors: [{ x: best.len * 0.38, w: 1.0, h: 2.1, col: spec.door, steps: 2 }] });
  return out;
}

// ---------------------------------------------------------------- the build
export function createNoela(scene, world, { shadows = true } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  world.addTrees([...TREES, ...THUJAS, ...ROWS]);

  const faces = (W) => {
    let nd = 1e9;
    for (let s = 0; s <= 1150; s += 5) { const q = R(s); nd = Math.min(nd, Math.hypot(q[0] - W.mid[0], q[1] - W.mid[1])); }
    return nd < 60;
  };
  // Two halves, each built (with its own small atlas) only when the car comes within 300 m of it
  const parts = [
    { centre: R(260), ready: [[-6725, -6700], R(80, -35), R(190, 40), R(340, 48)], names: /^[a-g]-/, extra: south },
    { centre: R(830), ready: [R(610, -25), R(760, -30), R(985, -30), R(990, 45)], names: /^[h-k]-/, extra: north },
  ];

  function build(part) {
    part.built = true;
    const A = areaKit(world, group, { shadows });
    skinHouses(world, group, HOUSES.filter((H) => part.names.test(H[0])).map((H) => withDoor(world, H)), { faces, shadows, ppm: 14, far: 6, debug: DEBUG });
    part.extra(A);
    A.finish();
  }

  // by route 41, the bend, the ochre and yellow houses, the white house, the dark red farmhouse
  function south(A) {
    const brown = [92, 74, 58];
    A.hedge([[-6745.5, -6722], [-6744.5, -6700], [-6742, -6680]], 2.2, 1.0);                  // the thujas along the drive by route 41
    const F41 = frame([-6735, -6672], [1, 0]);
    A.greenhouse(F41, 0, 0, 4, 2.6);
    A.trampoline(-6722, -6682, 1.8);
    // the old yard on the bend: a board fence round it
    A.picket([R(55, -14), R(112, -14), R(112, -62), R(55, -62), R(55, -16)], 1.2, brown);
    // the ochre house: a low hedge along the road
    A.hedge([R(160, 7), R(178, 7)], 1.3, 0.8);
    A.hedge([R(185, 7), R(224, 7)], 1.3, 0.8);
    // the yellow house: a clipped hedge round the whole lot, open at the drive
    A.hedge([R(229, 7), R(262, 7)], 1.4, 0.8);
    A.hedge([R(268, 7), R(285, 7)], 1.4, 0.8);
    A.hedge([R(229, 7), R(229, 72), R(285, 72)], 1.4, 0.8);
    // the long white house: a hedge along the road either side of its drive, the play house and the swing
    A.hedge([R(300, 6), R(334, 6)], 1.6, 0.9);
    A.hedge([R(340, 6), R(378, 6)], 1.6, 0.9);
    const FE = frame(R(326, 34), [ROAD[8][0] - ROAD[7][0], ROAD[8][1] - ROAD[7][1]]);
    A.swing(FE, 0, 0, 2.6);
    A.box(FE, 4, 2, 1.6, 1.6, 0.9, 2.2, 0xf1eee6);
    // the dark red farmhouse: a greenhouse by the beds
    const FG = frame(R(590, 66), [1, 0]);
    A.greenhouse(FG, 0, 0, 4, 2.4);
  }
  // Keskküla, Antoni, Lombi and Pihlaka
  function north(A) {
    const dark = [70, 58, 50];
    A.picket([R(724, -12), R(800, -12)], 1.4, dark);                                        // Antoni's dark board fence by the road
    A.trampoline(...R(760, -18), 1.7);
    const FI = frame(R(770, -45), [1, 0]);
    A.greenhouse(FI, 0, 0, 4, 2.4);
    A.hedge([R(960, -6), R(1000, -6)], 1.3, 0.8);                                         // Lombi: a low hedge along the road
    A.picket([R(955, 18), R(1001, 18)], 1.6, dark);                                         // Pihlaka: the dark board fence
    A.picket([R(1007, 18), R(1035, 18), R(1035, 80), R(955, 80), R(955, 18)], 1.6, dark);
    A.trampoline(...R(1015, 40), 1.6);
    // Pihlaka: a silver Carrera GT on the paved yard in front of the red house's gable, the real model with
    // its scanned body (Martin, 20 Nov: in place of the estate car that stood on the lawn)
    const cgt = { x: -7318.6, z: -7513.2, yaw: 1.32 };                    // nose east, along the gable (Martin, 20 Nov)
    const fx = Math.sin(cgt.yaw), fz = -Math.cos(cgt.yaw);
    world.addSolids([{ x: cgt.x, z: cgt.z, yaw: Math.atan2(-fz, fx), hx: 2.3, hz: 0.96 }]);
    // (built off the page where it can be, about 0.2 s of work, and let into the picture warmed)
    const park = (model) => {
      model.setLights?.({ headlights: false });
      model.group.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -cgt.yaw);
      model.group.position.set(cgt.x, world.heightAt(cgt.x, cgt.z) + 0.02, cgt.z);
      model.group.traverse((o) => { if (o.isMesh) { o.castShadow = shadows; o.receiveShadow = true; } });
      warm.scope(() => group.add(model.group));
    };
    buildCarInWorker('cgt').then((model) => park(model || buildCarModel('cgt'))).catch((err) => console.warn(err));
  }

  return {
    update(car) {
      if (!car) return;
      for (const part of parts) {
        if (part.built || Math.hypot(car.x - part.centre[0], car.z - part.centre[1]) > 300) continue;
        if (part.ready.every((q) => world.ready(q[0], q[1]))) build(part);
      }
    },
  };
}
