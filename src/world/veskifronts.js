// Veski from the Oru corner to Kuperjanovi, the second stretch of the lap's house fronts (Martin, 21 Nov: "mainly
// focus on the facades on the racetrack ... with garden parts like fences facing the track", 33 Street View
// shots of Aug 2024 and a map with Veski marked). The road, its kerbs, lines and the race's own walls are left
// as they were, no cars are added, and nothing stands nearer the road than the pavement's far side.
//
// The houses are the map's own blocks with painted walls (skinHouses): each wall that faces the track is painted
// at full detail in the colours and cladding the photos show (boards or render, window rows, doors, the diamond
// gable window, balconies, the garages' doors), the other walls of the same houses plainly. Garden fences along
// the track are long quads with one small repeating picture per kind of fence (a few kB each), merged, with
// brick or concrete pillars where the photos have them, and two clipped hedges.
// Seen in the shots (Tier A): Veski 2, 7, 11, 13, the garages 4a, 10, 25, 31, 20, 37, Näituse 8, the sheds
// at 37/39, 24a, 26, 45, 28, 30, 53, 55, 57, 32, 61, 63, 67, 69 and 42, and the fences in front of 2a, 13,
// 6 (iron and brick gate pillars), 10, 20, 35, 39/43, 26, 47/53, 28, 57/61, 67, 69 and the park at 36/40.
// From the street's look only (Tier B): 2a, 2b, 15, 18, 27, 35, Näituse 5, 43, 47, 34, 34a.
//
// Freeze frames: nothing is built until the car is within 420 m of one half of the street; each half is one
// queued job (src/jobs.js) that hands the walls to skinHouses (itself queued, a wall a step) and lays the
// fences a run at a time with jobs.late() checks; everything is added inside the warmer's scope.
import * as THREE from 'three';
import { setHouseColours } from './streetkit.js';
import { skinHouses, paintTexture } from './houseskin.js';
import { areaKit } from './handbuilt.js';
import { createTrack } from '../race/race.js';
import { jobs } from '../jobs.js';
import { still } from '../still.js';
import { breakableFence } from './breakfence.js';

const DEBUG = typeof location !== 'undefined' && /veskidebug/.test(location.search);
const SEC = { '2_5': [480, 2400], '2_6': [480, 3040] };

// the houses: block base id, centre, reach, nearest track point, the way to the track (f), OSM outline
const HOUSE = {
  v2: { sec: '2_5', base: 2830, at: [686.0, 2667.2], r: 23.0, i: 1493, f: [-0.939, -0.344], poly: [[683.2,2655.2],[684.6,2653.3],[677.2,2647.6],[667.2,2660.6],[667.0,2662.7],[669.6,2664.7],[670.7,2663.2],[674.6,2665.9],[675.0,2665.3],[677.9,2667.3],[676.8,2668.9],[678.5,2670.0],[677.1,2672.1],[678.7,2673.2],[680.3,2673.0],[682.6,2669.7],[685.5,2671.6],[684.2,2673.6],[684.3,2674.7],[685.9,2675.8],[686.8,2675.7],[687.8,2674.3],[693.7,2678.3],[694.3,2677.5],[695.8,2678.6],[696.7,2677.4],[697.8,2678.2],[701.9,2672.3],[701.0,2671.7],[701.8,2670.6],[700.7,2669.8],[701.6,2668.4],[694.9,2663.8],[694.3,2664.7],[689.4,2661.4],[690.6,2659.5],[690.4,2658.1],[689.0,2657.1],[687.6,2657.2],[687.1,2657.9]] },
  v7: { sec: '2_5', base: 2968, at: [637.2, 2656.7], r: 23.0, i: 1495, f: [0.985, 0.172], poly: [[652.6,2671.7],[640.4,2663.0],[640.1,2663.5],[628.7,2654.9],[629.4,2654.1],[621.9,2648.3],[626.1,2643.3],[626.2,2643.2],[636.1,2650.5],[636.7,2650.8],[655.7,2665.5]] },
  v11: { sec: '2_5', base: 3017, at: [648.7, 2687.2], r: 16.9, i: 1506, f: [1.000, -0.019], poly: [[636.6,2694.5],[648.1,2698.8],[649.4,2695.2],[648.0,2694.7],[651.8,2684.6],[654.1,2685.4],[655.6,2681.4],[654.3,2680.9],[656.0,2676.5],[645.0,2672.3]] },
  v2a: { sec: '2_5', base: 2954, at: [684.7, 2693.2], r: 13.3, i: 1509, f: [-0.997, -0.081], poly: [[677.7,2686.4],[694.4,2686.4],[694.4,2693.3],[692.3,2693.3],[692.2,2699.3],[688.3,2699.3],[688.3,2698.0],[680.8,2698.0],[680.9,2695.6],[678.5,2695.6],[678.5,2690.0],[677.7,2690.0]] },
  v2b: { sec: '2_5', base: 2996, at: [681.1, 2712.6], r: 11.0, i: 1519, f: [-0.998, -0.059], poly: [[676.5,2719.7],[676.5,2712.0],[675.4,2712.0],[675.4,2709.8],[682.7,2709.8],[682.7,2706.8],[688.6,2706.8],[688.6,2711.2],[684.6,2711.2],[684.6,2719.7]] },
  v13: { sec: '2_5', base: 2909, at: [632.7, 2758.7], r: 20.9, i: 1542, f: [0.999, -0.038], poly: [[631.1,2745.5],[647.4,2746.2],[646.2,2772.7],[621.4,2771.5],[621.7,2764.5],[630.2,2764.9]] },
  v4a: { sec: '2_5', base: 3127, at: [676.0, 2772.6], r: 12.6, i: 1548, f: [-0.999, -0.041], poly: [[666.6,2769.3],[685.5,2766.8],[686.4,2773.9],[679.5,2774.7],[679.7,2776.3],[667.7,2777.8]] },
  v15: { sec: '2_5', base: 3107, at: [645.6, 2797.5], r: 15.0, i: 1561, f: [0.993, -0.119], poly: [[653.5,2788.4],[646.1,2788.5],[646.1,2791.8],[642.0,2791.9],[642.0,2794.7],[638.3,2794.7],[638.4,2800.7],[641.8,2800.6],[641.8,2805.3],[647.9,2805.2],[647.9,2808.4],[653.6,2808.4]] },
  v10: { sec: '2_5', base: 3136, at: [668.4, 2858.5], r: 12.0, i: 1591, f: [-1.000, -0.019], poly: [[663.4,2849.9],[674.9,2850.3],[674.4,2862.6],[669.9,2862.5],[669.8,2867.1],[663.0,2866.9]] },
  v25: { sec: '2_5', base: 3114, at: [648.4, 2866.8], r: 10.4, i: 1595, f: [0.999, -0.045], poly: [[653.7,2859.7],[653.9,2873.4],[645.4,2873.4],[645.4,2870.6],[643.3,2870.7],[643.2,2859.8]] },
  v25b: { sec: '2_5', base: 3104, at: [628.8, 2876.7], r: 11.5, i: 1600, f: [1.000, -0.010], poly: [[625.0,2880.5],[624.0,2876.2],[625.7,2876.1],[625.5,2872.4],[637.6,2872.0],[638.3,2879.4]] },
  v18: { sec: '2_5', base: 3120, at: [668.9, 2888.9], r: 6.6, i: 1606, f: [-0.999, -0.042], poly: [[666.1,2886.8],[672.7,2886.5],[672.9,2892.1],[666.4,2892.3]] },
  v27: { sec: '2_5', base: 3100, at: [640.2, 2894.6], r: 12.8, i: 1609, f: [0.993, -0.114], poly: [[644.5,2888.5],[645.7,2902.8],[633.8,2903.9],[632.7,2889.4]] },
  v31: { sec: '2_5', base: 3117, at: [654.0, 2914.5], r: 13.2, i: 1617, f: [0.900, -0.437], poly: [[653.7,2905.3],[662.1,2922.9],[656.2,2925.6],[654.2,2921.3],[650.1,2912.8],[647.9,2908.3]] },
  v35: { sec: '2_5', base: 3096, at: [649.9, 2929.0], r: 24.4, i: 1622, f: [0.875, -0.485], poly: [[652.4,2925.5],[652.5,2925.5],[653.4,2925.2],[654.0,2926.7],[654.6,2928.1],[654.0,2928.3],[656.2,2932.8],[657.8,2932.0],[660.5,2937.9],[660.3,2940.2],[662.1,2943.8],[657.7,2945.9],[657.5,2947.7],[655.0,2949.0],[653.4,2948.0],[645.9,2951.5],[641.6,2942.9],[638.6,2944.2],[631.2,2928.5],[639.5,2924.6],[641.6,2929.2],[643.3,2928.3],[644.4,2930.6],[642.8,2931.4],[643.6,2933.3],[649.4,2930.7],[648.4,2928.3],[648.9,2928.0],[648.4,2926.9],[648.2,2926.7],[648.2,2926.6],[648.1,2926.1],[648.1,2926.0],[648.1,2925.9],[648.1,2925.6],[648.1,2925.4],[648.0,2925.2],[648.2,2924.9],[648.3,2924.7],[648.4,2924.6],[648.5,2924.3],[648.7,2924.2],[648.9,2924.0],[649.0,2923.9],[649.2,2923.9],[649.4,2923.7],[649.6,2923.7],[649.9,2923.5],[650.0,2923.5],[650.2,2923.6],[650.6,2923.6],[650.7,2923.7],[650.9,2923.7],[651.2,2923.9],[651.4,2923.9],[651.6,2924.0],[651.7,2924.2],[651.9,2924.4],[652.1,2924.5],[652.1,2924.7],[652.2,2925.1],[652.2,2925.2],[652.2,2925.4]] },
  v20: { sec: '2_5', base: 3102, at: [686.9, 2918.2], r: 17.4, i: 1626, f: [-0.929, 0.369], poly: [[672.2,2914.5],[684.3,2908.8],[686.6,2914.0],[687.1,2913.7],[691.8,2911.7],[693.1,2914.4],[688.4,2916.6],[690.4,2921.1],[691.9,2920.3],[692.8,2922.2],[691.3,2922.8],[693.3,2927.2],[680.9,2932.9]] },
  n5: { sec: '2_5', base: 3077, at: [706.0, 2945.9], r: 13.6, i: 1642, f: [-0.900, 0.435], poly: [[708.2,2935.0],[714.7,2947.1],[716.2,2946.2],[717.7,2949.1],[705.1,2955.9],[702.4,2950.8],[700.0,2952.1],[697.0,2946.9],[699.3,2945.7],[696.9,2941.1]] },
  v37: { sec: '2_5', base: 3061, at: [691.8, 2996.6], r: 17.0, i: 1661, f: [0.863, -0.506], poly: [[701.3,2999.8],[695.8,3002.4],[696.5,3003.7],[688.3,3007.6],[682.4,2995.2],[685.9,2993.6],[682.3,2985.9],[692.4,2981.1]] },
  n8: { sec: '2_5', base: 3052, at: [717.8, 2986.2], r: 25.4, i: 1663, f: [-0.923, 0.384], poly: [[701.7,2977.0],[723.7,2966.3],[727.0,2973.0],[721.6,2975.7],[721.1,2974.6],[710.8,2979.7],[711.8,2981.7],[710.2,2982.5],[711.2,2984.4],[715.1,2982.5],[714.5,2981.2],[723.2,2976.9],[727.6,2985.9],[718.9,2990.1],[725.1,3002.8],[727.4,3007.5],[723.3,3009.5],[722.1,3007.0],[717.5,3009.3]] },
  v37b: { sec: '2_5', base: 3100, at: [695.3, 3014.4], r: 12.2, i: 1670, f: [0.891, -0.453], poly: [[692.7,3018.5],[689.6,3020.1],[687.2,3015.2],[691.5,3013.1],[696.5,3010.8],[697.2,3012.2],[704.1,3008.8],[705.8,3012.3]] },
  v39: { sec: '2_5', base: 3077, at: [700.9, 3018.7], r: 11.7, i: 1673, f: [0.881, -0.474], poly: [[692.7,3018.5],[705.8,3012.3],[707.4,3011.5],[711.1,3019.2],[704.6,3022.4],[703.6,3020.2],[695.5,3024.1],[694.4,3021.7]] },
  v43: { sec: '2_5', base: 3085, at: [695.4, 3036.0], r: 14.9, i: 1680, f: [0.871, -0.491], poly: [[687.7,3030.8],[700.8,3024.6],[708.2,3040.1],[700.2,3043.9],[698.4,3040.0],[694.1,3042.1],[691.0,3035.6],[690.2,3036.0]] },
  v24a: { sec: '2_5', base: 3080, at: [730.1, 3025.6], r: 12.9, i: 1683, f: [-0.953, 0.302], poly: [[722.9,3023.0],[727.4,3020.7],[726.0,3017.9],[732.8,3014.5],[735.6,3020.0],[733.4,3021.1],[736.8,3027.8],[733.7,3029.3],[734.8,3031.4],[730.4,3033.6],[729.3,3031.5],[728.1,3032.1],[727.7,3032.4]] },
  v24b: { sec: '2_5', base: 3074, at: [736.7, 3015.3], r: 6.3, i: 1680, f: [-0.921, 0.389], poly: [[737.5,3012.1],[740.3,3017.6],[735.6,3020.0],[732.8,3014.5]] },
  v45: { sec: '2_6', base: 3011, at: [716.7, 3063.3], r: 15.5, i: 1696, f: [0.872, -0.490], poly: [[722.4,3052.7],[729.7,3068.6],[726.0,3070.3],[719.2,3073.6],[716.6,3067.8],[713.0,3069.5],[711.8,3066.9],[715.4,3065.2],[713.6,3061.3],[711.0,3062.6],[709.5,3059.2],[712.0,3058.1],[711.8,3057.5]] },
  v26: { sec: '2_6', base: 3085, at: [748.4, 3048.4], r: 16.1, i: 1697, f: [-0.940, 0.342], poly: [[734.3,3044.6],[746.3,3038.5],[748.2,3042.1],[751.9,3040.2],[754.7,3045.6],[752.9,3046.5],[755.4,3051.4],[752.4,3052.9],[754.1,3056.0],[753.2,3056.5],[743.0,3061.7]] },
  v47: { sec: '2_6', base: 3094, at: [725.1, 3080.3], r: 15.5, i: 1706, f: [0.851, -0.524], poly: [[726.0,3070.3],[730.8,3080.6],[732.0,3080.1],[733.1,3082.5],[734.6,3085.7],[719.1,3093.0],[716.4,3087.2],[721.5,3084.9],[716.7,3074.6],[719.2,3073.6]] },
  v28: { sec: '2_6', base: 3102, at: [757.7, 3067.7], r: 17.4, i: 1707, f: [-0.922, 0.387], poly: [[743.0,3061.7],[753.2,3056.5],[755.1,3060.4],[758.8,3060.8],[759.6,3058.5],[767.7,3060.1],[765.6,3069.7],[757.4,3068.6],[760.2,3073.9],[762.4,3073.0],[763.6,3075.3],[761.3,3076.4],[761.8,3077.2],[752.8,3081.6]] },
  v53: { sec: '2_6', base: 3105, at: [740.1, 3095.9], r: 9.1, i: 1716, f: [0.888, -0.460], poly: [[747.5,3096.0],[736.0,3101.4],[734.1,3097.6],[736.0,3096.7],[734.8,3094.3],[744.5,3089.7]] },
  v30: { sec: '2_6', base: 3113, at: [766.0, 3092.0], r: 12.3, i: 1720, f: [-0.902, 0.431], poly: [[763.5,3102.5],[757.7,3090.8],[759.9,3089.7],[759.1,3088.1],[763.8,3085.7],[764.4,3086.9],[767.5,3085.4],[769.4,3089.1],[771.2,3088.2],[773.9,3093.6],[771.1,3095.0],[772.6,3098.0]] },
  v55: { sec: '2_6', base: 3102, at: [749.9, 3108.6], r: 15.7, i: 1724, f: [0.802, -0.598], poly: [[741.0,3106.1],[745.8,3103.8],[744.8,3101.7],[750.6,3099.0],[751.6,3101.2],[752.6,3100.8],[756.1,3108.2],[754.3,3109.1],[758.7,3118.3],[757.9,3118.6],[749.0,3122.8],[745.5,3115.4]] },
  v57: { sec: '2_6', base: 3122, at: [753.1, 3126.0], r: 13.4, i: 1732, f: [0.880, -0.475], poly: [[747.3,3123.6],[749.0,3122.8],[757.9,3118.6],[763.8,3131.1],[753.3,3136.1]] },
  v32: { sec: '2_6', base: 3114, at: [790.1, 3118.5], r: 30.1, i: 1737, f: [-0.896, 0.444], poly: [[766.6,3107.2],[798.7,3091.2],[806.3,3106.4],[803.5,3107.8],[805.8,3112.4],[798.2,3116.2],[794.5,3108.7],[784.9,3113.4],[786.6,3116.8],[788.8,3115.6],[791.7,3117.4],[793.2,3120.3],[792.8,3123.3],[790.4,3124.6],[792.1,3128.1],[805.7,3121.4],[811.6,3133.2],[785.9,3146.1],[781.8,3137.9],[783.0,3137.3],[772.4,3116.1],[771.3,3116.6]] },
  v61: { sec: '2_6', base: 3119, at: [762.1, 3145.7], r: 11.9, i: 1743, f: [0.843, -0.537], poly: [[771.6,3147.9],[763.3,3151.9],[762.5,3150.1],[760.1,3151.2],[758.1,3147.1],[757.5,3147.4],[755.3,3143.0],[759.3,3141.0],[758.5,3139.5],[765.8,3136.0]] },
  v63: { sec: '2_6', base: 3063, at: [766.7, 3161.4], r: 15.9, i: 1751, f: [0.860, -0.511], poly: [[766.1,3172.3],[764.1,3168.2],[760.9,3166.9],[758.0,3168.2],[755.9,3164.0],[758.6,3162.9],[759.7,3158.8],[757.8,3154.8],[763.3,3151.9],[771.6,3147.9],[773.6,3152.5],[774.9,3151.9],[779.0,3161.1],[777.4,3161.9],[779.5,3166.0]] },
  v34a: { sec: '2_6', base: 3143, at: [793.6, 3154.8], r: 8.7, i: 1754, f: [-0.955, 0.297], poly: [[789.7,3151.8],[794.4,3149.5],[799.3,3159.2],[794.7,3161.5]] },
  v34: { sec: '2_6', base: 3148, at: [815.5, 3136.8], r: 21.7, i: 1751, f: [-0.909, 0.418], poly: [[807.6,3155.4],[803.6,3147.4],[815.5,3141.5],[814.1,3138.6],[818.2,3136.5],[810.6,3121.1],[819.0,3116.9],[822.3,3123.6],[821.2,3124.1],[831.0,3143.8]] },
  v67: { sec: '2_6', base: 3142, at: [780.9, 3184.1], r: 11.7, i: 1764, f: [0.850, -0.527], poly: [[782.5,3190.4],[782.0,3189.3],[780.3,3190.1],[778.7,3186.7],[780.6,3185.8],[778.2,3180.7],[775.3,3182.0],[773.8,3178.8],[779.6,3176.1],[781.1,3179.3],[786.2,3176.9],[790.8,3186.5]] },
  v69: { sec: '2_6', base: 3115, at: [804.1, 3233.6], r: 18.8, i: 1791, f: [0.861, -0.509], poly: [[799.9,3243.3],[790.0,3224.4],[805.5,3216.4],[814.4,3233.4],[808.9,3236.2],[809.9,3238.0]] },
  v42: { sec: '2_6', base: 3094, at: [852.2, 3231.3], r: 15.9, i: 1800, f: [-0.901, 0.434], poly: [[846.4,3228.4],[861.1,3221.1],[866.6,3232.1],[849.3,3240.7],[846.4,3234.8],[848.9,3233.5]] },
};

// ---------------------------------------------------------------- how each house looks
const win = (o = {}) => ({ w: 1.05, pitch: 2.5, T: true, bars: 1, surround: 0.1, sc: '#f2efe8', frame: '#f6f4ef', glass: '#56667c', ...o });
const wood = (wall, o = {}) => ({ kind: 'wood', wall, trim: '#f1ede4', pitch: 0.16, storey: 3.0, maxFloors: 2, weather: 0.3,
  plinth: { h: 0.6, type: 'plaster', col: '#8c8884' }, ...o, win: win(o.win) });
const render = (wall, o = {}) => ({ kind: 'plaster', wall, trim: '#f2eee6', storey: 3.1, maxFloors: 3, weather: 0.3,
  plinth: { h: 0.7, type: 'plaster', col: '#8e8a86' }, ...o, win: win(o.win) });

// a diamond window high in the gable (Veski 37 at the Näituse corner)
function diamond(P, W) {
  if (W.peak - W.eaves < 1.8) return;
  let pk = 0; for (let k = 0; k < W.top.length; k++) if (W.top[k] > W.top[pk]) pk = k;
  const x = (pk + 0.5) * W.len / W.top.length, y = W.eaves + (W.peak - W.eaves) * 0.45, s = 0.6;
  P.poly([[x, y - s - 0.1], [x + s + 0.1, y], [x, y + s + 0.1], [x - s - 0.1, y]], '#f2ede2');
  P.poly([[x, y - s], [x + s, y], [x, y + s], [x - s, y]], '#4e5e72');
  P.r(x - s, y - 0.03, x + s, y + 0.03, '#f2ede2'); P.r(x - 0.03, y - s, x + 0.03, y + s, '#f2ede2');
}
// balconies with white balusters in front of the upper windows (Veski 63)
function balconies(P, W) {
  if (!W.front || W.len < 8) return;
  for (const f of [0.22, 0.78]) {
    const x = W.len * f;
    for (const y of [3.4, 6.5]) {
      if (y + 1.2 > W.eaves) continue;
      P.r(x - 1.5, y - 0.2, x + 1.5, y, '#d8d4c8');
      P.r(x - 1.5, y + 0.85, x + 1.5, y + 0.95, '#f4f2ec');
      for (let b = x - 1.4; b < x + 1.45; b += 0.16) P.r(b, y, b + 0.07, y + 0.85, '#f4f2ec');
    }
  }
}
// garages: a row of up-and-over doors in brown, red and yellow; graffiti on the end toward the street
function garages(P, W) {
  const top = P.y1;
  P.r(0, P.y0, W.len, top, '#a7a39c');
  P.weather(0, P.y0, W.len, top, 0.5, 3);
  if (W.front) {
    const cols = ['#3d74b8', '#e24a8a', '#f2c230', '#5cbf6a', '#7a4ab8', '#f07a2a'];
    for (let k = 0; k < 14; k++) { const x = (k * 0.37) % 1 * W.len, y = 0.3 + ((k * 0.61) % 1) * (Math.min(top, 2.4) - 0.6); P.arc(x, y, 0.35 + (k % 3) * 0.25, cols[k % cols.length]); }
    P.text('WRS', W.len / 2, 1.3, 1.0, '#26262c', '800 italic %px Arial, sans-serif');
    return;
  }
  if (W.len < 5) return;
  const n = Math.max(1, Math.floor(W.len / 3.1)), cols = ['#6e3a2c', '#8a4030', '#5a3a2e', '#c89a30', '#7a3a32'];
  for (let k = 0; k < n; k++) {
    const x0 = (k + 0.5) * W.len / n - 1.2;
    P.r(x0, 0.05, x0 + 2.4, 2.15, cols[k % cols.length]);
    for (let y = 0.25; y < 2.1; y += 0.22) P.r(x0, y, x0 + 2.4, y + 0.03, 'rgba(0,0,0,0.18)');
  }
  P.r(0, Math.min(top, 2.35) - 0.12, W.len, Math.min(top, 2.35), '#5e5c58');
}
// the tall glazed stair strip of Veski 42
function stair(P, W) {
  if (!W.front) return;
  const x = W.len * 0.38;
  P.r(x - 0.8, 0.4, x + 0.8, Math.min(W.eaves - 0.3, 7.5), '#eae6de');
  P.grad(x - 0.65, 0.5, x + 0.65, Math.min(W.eaves - 0.4, 7.4), '#647892', '#3a4658');
  for (let y = 1.4; y < 7.3; y += 1.0) P.r(x - 0.65, y, x + 0.65, y + 0.05, '#eae6de');
}
// pale pink panels between the windows (Veski 69)
function panels(P, W) {
  if (!W.front) return;
  for (let x = 1.25; x < W.len - 1.2; x += 2.5) P.r(x - 0.45, 3.5, x + 0.45, 5.6, '#e6cfcc');
}

// [name, wall (for the map block), roof, spec, extra drawing, door on the front { at: 0..1 along, col, canopy }]
const LOOK = {
  v2: [0xeeece8, 0xa8503c, render([238, 236, 232], { plinth: { h: 0.9, type: 'plaster', col: '#7f8a96' }, maxFloors: 2 }), null, { at: 0.5, col: '#d8c9a2' }],
  v7: [0xa85840, 0x6e6a68, { kind: 'brick', wall: [164, 82, 60], trim: '#e8e2d6', maxFloors: 2, plinth: { h: 0.5, type: 'plaster', col: '#7c746e' }, win: win({ sc: '#e8e2d6' }) }],
  v11: [0xecd8bc, 0x6a6a70, render([236, 216, 188], { maxFloors: 2, belts: [3.6] }), null, { at: 0.5, w: 1.5, h: 2.6, col: '#a6b6a2', canopy: '#2e2e32' }],
  v2a: [0xd6c4a0, 0x6a4a3a, render([214, 196, 160], { maxFloors: 2 })],
  v2b: [0xd6c4a0, 0x6a4a3a, render([214, 196, 160], { maxFloors: 2 })],
  v13: [0xb6c2ce, 0xb0503a, wood([182, 194, 206])],
  v4a: [0xa7a39c, 0x5e5c58, { kind: 'plaster', wall: [167, 163, 156] }, garages],
  v15: [0xdcd4c2, 0x6a6a6e, render([222, 214, 196])],
  v10: [0xd4c096, 0x8c9096, wood([212, 192, 150])],
  v25: [0xb85a3c, 0x5a5a5e, { kind: 'brick', wall: [184, 92, 62], trim: '#ece6da', maxFloors: 2, belts: [3.3], plinth: { h: 0.6, type: 'plaster', col: '#8a7e76' }, win: win({ sc: '#ece6da' }) }],
  v25b: [0xb85a3c, 0x5a5a5e, { kind: 'brick', wall: [184, 92, 62], trim: '#ece6da', maxFloors: 2, belts: [3.3], plinth: { h: 0.6, type: 'plaster', col: '#8a7e76' }, win: win({ sc: '#ece6da' }) }],
  v18: [0x8c867c, 0x6a6e72, wood([140, 134, 124])],
  v27: [0xdee0de, 0x6a6e72, render([222, 224, 222])],
  v31: [0xa8c4d6, 0xa84a3a, wood([168, 196, 214], { shutters: '#f2f2ee' })],
  v35: [0xe2d6aa, 0x6a6e72, render([226, 214, 170])],
  v20: [0xb4c8ac, 0x7a7e84, wood([180, 200, 172], { trim: '#f4f4ee' })],
  n5: [0xdecea8, 0x7a7e84, wood([222, 206, 170])],
  v37: [0xdab26e, 0x8a8e94, wood([218, 178, 110], { trim: '#f2ece0' }), diamond],
  n8: [0x96946f, 0x7a7e84, wood([150, 148, 112], { trim: '#f0ece2' })],
  v37b: [0x80705f, 0x6e6c6a, wood([128, 112, 96], { weather: 0.6, plinth: { h: 0.3, type: 'plaster', col: '#6e6a66' } })],
  v39: [0x80705f, 0x6e6c6a, wood([128, 112, 96], { weather: 0.6, plinth: { h: 0.3, type: 'plaster', col: '#6e6a66' } })],
  v43: [0xdccc96, 0x7a7e84, wood([220, 204, 150])],
  v24a: [0xd0a842, 0x6a6e72, render([208, 168, 66], { maxFloors: 2 })],
  v24b: [0xd0a842, 0x6a6e72, render([208, 168, 66], { maxFloors: 1 })],
  v45: [0xe8e2c8, 0x7a7e84, wood([232, 226, 200], { trim: '#c88a3a', plinth: { h: 1.4, type: 'rubble' } }), null, { at: 0.55, col: '#7a3a2a' }],
  v26: [0x92987e, 0x7a7e84, wood([146, 152, 126], { trim: '#ece8dc' })],
  v47: [0xd6aa60, 0x8a8e94, wood([214, 170, 96], { trim: '#f0e8d4' })],
  v28: [0x7c5a3e, 0x6e6c6a, wood([124, 90, 62], { trim: '#d8a040', win: { frame: '#e0b050', sc: '#d8a040' } })],
  v53: [0xe0b460, 0x8a8e94, wood([224, 180, 96], { trim: '#c8902e' })],
  v30: [0xb8986c, 0x7a7e84, wood([184, 152, 108])],
  v55: [0xe2b664, 0x8a8e94, wood([226, 182, 100], { trim: '#c8902e' }), null, { at: 0.5, w: 1.4, col: '#d89a30' }],
  v57: [0xc0c6b4, 0x7a7e84, wood([192, 198, 180], { trim: '#f2f2ec' }), null, { at: 0.5, w: 1.3, col: '#b83a32', canopy: '#a83a32' }],
  v32: [0xb45842, 0x6a6e72, { kind: 'brick', wall: [180, 88, 66], trim: '#ecdcc0', maxFloors: 3, storey: 3.6, plinth: { h: 4.0, type: 'plaster', col: '#dcc29a', band: '#ecdcc0', bandH: 0.25 }, win: win({ sc: '#ecdcc0', w: 1.2 }) }],
  v61: [0x848262, 0x7a7e84, wood([132, 130, 98], { trim: '#ece8dc' })],
  v63: [0xeeeada, 0x6a6e72, render([238, 234, 218], { plinth: { h: 0.8, type: 'brick', col: [170, 90, 70] } }), balconies, { at: 0.5, w: 1.5, h: 2.7, col: '#ece8dc' }],
  v34a: [0xc8be9e, 0x7a7e84, wood([200, 190, 160])],
  v34: [0xe8e8e4, 0x6a6e72, render([232, 232, 228])],
  v67: [0xe8dec4, 0x6a6e72, render([232, 222, 196], { maxFloors: 2 })],
  v69: [0xf0eeea, 0x2e3034, render([240, 238, 234], { plinth: { h: 0.9, type: 'plaster', col: '#d8c8c6' }, win: { pitch: 2.5, w: 1.2, bars: 2 } }), panels],
  v42: [0xb0a696, 0x6a6e72, render([176, 166, 150], { maxFloors: 2 }), stair],
};
const NORTH = ['v2', 'v7', 'v11', 'v2a', 'v2b', 'v13', 'v4a', 'v15', 'v10', 'v25', 'v25b', 'v18', 'v27', 'v31', 'v35', 'v20', 'n5'];
const SOUTH = Object.keys(LOOK).filter((k) => !NORTH.includes(k));

export function veskiFrontsWalls(walls) {
  for (const sec of Object.keys(SEC)) {
    setHouseColours(walls, sec, SEC[sec][0], SEC[sec][1], Object.entries(HOUSE).filter(([, H]) => H.sec === sec)
      .map(([k, H]) => ({ base: H.base, x: H.at[0], z: H.at[1], wall: LOOK[k][0], roof: LOOK[k][1], reach: Math.min(H.r, 16) })));
  }
}

// ---------------------------------------------------------------- the fences
// one small repeating picture per kind: [height, tile width, draw(P, w, h)]
const KINDS = {
  // white pickets on a grey concrete base (Veski 2a's garden, "7 Veski")
  whiteBase: [1.4, 1.0, (P) => { P.r(0, 0, 1, 0.45, '#9a9894'); P.r(0, 0.45, 1, 0.5, '#7e7c78'); for (let x = 0.03; x < 1; x += 0.125) P.r(x, 0.5, x + 0.075, 1.36, '#f2f2ee'); P.r(0, 1.18, 1, 1.24, '#e6e6e2'); P.r(0, 0.62, 1, 0.68, '#e6e6e2'); }],
  // white slats between rails on a low concrete base (Veski 13, "13 Veski")
  whiteRail: [1.25, 1.0, (P) => { P.r(0, 0, 1, 0.4, '#a2a09c'); for (let x = 0.02; x < 1; x += 0.11) P.r(x, 0.4, x + 0.06, 1.15, '#f0f0ec'); P.r(0, 1.12, 1, 1.25, '#f4f4f0'); P.r(0, 0.46, 1, 0.52, '#e8e8e4'); }],
  // grey-green cast iron with a band of rings, on a granite base (in front of Veski 4 and 6)
  iron: [1.65, 1.2, (P) => { P.r(0, 0, 1.2, 0.35, '#a09894'); for (let x = 0.03; x < 1.2; x += 0.1) P.r(x, 0.35, x + 0.025, 1.6, '#7e8a82'); P.r(0, 1.25, 1.2, 1.29, '#7e8a82'); P.r(0, 0.5, 1.2, 0.54, '#7e8a82'); for (let x = 0.15; x < 1.2; x += 0.3) { P.arc(x, 1.08, 0.11, '#7e8a82'); P.c.save(); P.c.globalCompositeOperation = 'destination-out'; P.arc(x, 1.08, 0.08, '#000'); P.c.restore(); } for (let x = 0.03; x < 1.2; x += 0.1) P.poly([[x - 0.02, 1.6], [x + 0.045, 1.6], [x + 0.0125, 1.65]], '#7e8a82'); }],
  // cream pointed pickets (Veski 10, "23 Veski")
  cream: [1.3, 1.0, (P) => { for (let x = 0.02; x < 1; x += 0.125) P.poly([[x, 0], [x + 0.08, 0], [x + 0.08, 1.24], [x + 0.04, 1.3], [x, 1.24]], '#ece6d0'); P.r(0, 0.25, 1, 0.31, '#ddd6bc'); P.r(0, 1.0, 1, 1.06, '#ddd6bc'); }],
  // pale green-white pickets ("20 Veski")
  green: [1.15, 1.0, (P) => { for (let x = 0.02; x < 1; x += 0.12) P.poly([[x, 0.1], [x + 0.07, 0.1], [x + 0.07, 1.1], [x + 0.035, 1.15], [x, 1.1]], '#e4ecdc'); P.r(0, 0, 1, 0.12, '#8e9a8c'); P.r(0, 0.3, 1, 0.36, '#cfdac8'); P.r(0, 0.9, 1, 0.96, '#cfdac8'); }],
  // dark iron bars (Veski 35 at the Näituse corner)
  dark: [1.3, 1.0, (P) => { for (let x = 0.03; x < 1; x += 0.12) P.r(x, 0, x + 0.03, 1.3, '#3c2e2a'); P.r(0, 1.2, 1, 1.25, '#3c2e2a'); P.r(0, 0.15, 1, 0.2, '#3c2e2a'); }],
  // close natural boards, the tops in waves (Veski 39 and 43, "37 Veski", "43 Veski")
  wave: [1.7, 2.4, (P) => { for (let x = 0; x < 2.4; x += 0.15) { const t = 1.45 + 0.22 * Math.cos((x + 0.07) / 2.4 * Math.PI * 2); P.poly([[x + 0.01, 0], [x + 0.14, 0], [x + 0.14, t], [x + 0.075, t + 0.04], [x + 0.01, t]], ['#d2c08a', '#c8b47c', '#d8c896'][Math.round(x / 0.15) % 3]); } }],
  // green boards (Veski 26, "24 Veski")
  greenBoard: [1.4, 1.0, (P) => { for (let x = 0; x < 1; x += 0.14) P.r(x + 0.01, 0, x + 0.13, 1.4, ['#8a9a7a', '#7e8e70'][Math.round(x / 0.14) % 2]); P.r(0, 1.3, 1, 1.36, '#6e7e62'); }],
  // ochre boards with round holes (Veski 47 and 53, "49 Veski")
  holes: [1.3, 1.2, (P) => { for (let x = 0; x < 1.2; x += 0.15) P.r(x + 0.01, 0, x + 0.14, 1.3, ['#d0a04a', '#c49444'][Math.round(x / 0.15) % 2]); P.r(0, 1.2, 1.2, 1.3, '#b08038'); P.c.save(); P.c.globalCompositeOperation = 'destination-out'; P.arc(0.3, 0.95, 0.1, '#000'); P.arc(0.9, 0.95, 0.1, '#000'); P.c.restore(); }],
  // plain natural boards (Veski 28 and 30, "28 Veski")
  board: [1.5, 1.0, (P) => { for (let x = 0; x < 1; x += 0.14) P.r(x + 0.012, 0, x + 0.128, 1.5, ['#c6a878', '#b89c6e', '#ccb084'][Math.round(x / 0.14) % 3]); }],
  // pale grey-green pickets (Veski 57 and 61, "57 Veski")
  grey: [1.25, 1.0, (P) => { for (let x = 0.02; x < 1; x += 0.13) P.poly([[x, 0], [x + 0.08, 0], [x + 0.08, 1.2], [x + 0.04, 1.25], [x, 1.2]], '#c8ccc0'); P.r(0, 0.25, 1, 0.31, '#b0b6a8'); P.r(0, 0.95, 1, 1.01, '#b0b6a8'); }],
  // a tall solid cream board fence (Veski 67, "36 Veski")
  solid: [1.85, 1.0, (P) => { P.r(0, 0, 1, 1.85, '#e4dac0'); for (let x = 0; x < 1; x += 0.25) P.r(x, 0, x + 0.012, 1.85, '#cfc4a8'); P.r(0, 1.78, 1, 1.85, '#d4c9ac'); }],
  // black bars between white pillars (Veski 69, "69 Veski", "40 Veski")
  black: [1.25, 1.0, (P) => { P.r(0, 0, 1, 0.4, '#e2dcd6'); for (let x = 0.03; x < 1; x += 0.11) P.r(x, 0.4, x + 0.03, 1.25, '#26262a'); P.r(0, 1.12, 1, 1.16, '#26262a'); P.r(0, 0.5, 1, 0.54, '#26262a'); for (let x = 0.055; x < 1; x += 0.22) P.arc(x, 0.95, 0.05, '#26262a'); }],
  // a low black rail round the park ("36 Veski", "40 Veski")
  rail: [0.95, 1.0, (P) => { for (let x = 0.03; x < 1; x += 0.14) P.r(x, 0, x + 0.025, 0.9, '#2a2a2e'); P.r(0, 0.85, 1, 0.92, '#2a2a2e'); P.r(0, 0.15, 1, 0.2, '#2a2a2e'); }],
};
// the kinds a car can knock down panel by panel (src/world/breakfence.js; Martin, 22 Nov: the white pickets
// in front of Veski 20, with a light sound of snapping wood): one panel between two posts, `panel` metres wide
const BREAKS = {
  green: (P, panel, hh) => {
    for (let x = 0.07; x < panel - 0.08; x += 0.12) P.poly([[x, 0.1], [x + 0.07, 0.1], [x + 0.07, hh - 0.05], [x + 0.035, hh], [x, hh - 0.05]], '#e4ecdc');
    P.r(0, 0, panel, 0.12, '#8e9a8c'); P.r(0, 0.3, panel, 0.36, '#cfdac8'); P.r(0, 0.9, panel, 0.96, '#cfdac8');
    P.r(0, 0.05, 0.06, hh - 0.02, '#c4ceba');
  },
};
// [side (1 right, -1 left in the lap's direction), from, to (track points), metres beyond the road edge, kind, pillars { every, w, h, c }]
const PILLAR = { brick: { w: 0.55, h: 2.0, c: 0x9a5a44, cap: 0x8a8a86 }, white: { w: 0.45, h: 1.45, c: 0xece8e2, cap: 0xe0dcd6 }, stone: { w: 0.45, h: 1.5, c: 0x8e8a86, cap: 0x7a7672 } };
const FENCES = {
  north: [
    [-1, 1500, 1527, 1.9, 'whiteBase'],
    [1, 1529, 1553, 1.9, 'whiteRail', { at: [1529, 1541, 1553], ...PILLAR.stone }],
    [-1, 1562, 1580, 1.9, 'iron', { at: [1562, 1569.5, 1572.5, 1580], ...PILLAR.brick }],
    [-1, 1581, 1601, 1.8, 'cream'],
    [-1, 1612, 1638, 1.9, 'green'],
    [1, 1626, 1638, 1.9, 'dark'],
  ],
  south: [
    [1, 1666, 1692, 1.7, 'wave'],
    [-1, 1689, 1702, 1.7, 'greenBoard'],
    [1, 1699, 1713, 1.7, 'holes'],
    [-1, 1709, 1719, 1.7, 'board'],
    [1, 1731, 1749, 2.4, 'grey'],
    [1, 1759, 1771, 2.4, 'solid'],
    [1, 1777, 1794, 2.4, 'black', { every: 3.2, ...PILLAR.white }],
    [-1, 1752, 1770, 3.4, 'rail', { every: 6, w: 0.22, h: 1.0, c: 0xe8e6e0, cap: 0xd8d6d0 }],
  ],
};
// clipped hedges: [side, from, to, off, height, width]
const HEDGES = { north: [[1, 1575, 1592, 2.1, 1.3, 0.9]], south: [[1, 1759, 1771, 3.2, 2.0, 1.0]] };

let textures = null;            // shared by both halves, made once
function fenceTextures() {
  if (textures) return textures;
  textures = {};
  for (const [k, [hh, tw, draw]] of Object.entries(KINDS)) {
    if (BREAKS[k]) continue;                 // (its own panel picture: src/world/breakfence.js)
    const t = paintTexture(tw, 0, hh, 96, (P) => draw(P, tw, hh), { repeat: true, alpha: true });
    textures[k] = new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide });
  }
  return textures;
}

const inside = (poly, x, z) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < a[0] + (z - a[1]) * (b[0] - a[0]) / (b[1] - a[1])) c = !c; } return c; };
const segD = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
const polyD = (poly, x, z) => { if (inside(poly, x, z)) return 0; let d = 1e9; for (let i = 0; i < poly.length; i++) d = Math.min(d, segD(x, z, poly[i], poly[(i + 1) % poly.length])); return d; };
const POLYS = Object.values(HOUSE).map((H) => H.poly);
const clear = (x, z) => POLYS.every((p) => polyD(p, x, z) > 0.6);

export function createVeskiFronts(scene, world, { shadows = true } = {}) {
  const group = still(new THREE.Group());
  scene.add(group);
  const track = createTrack();
  const hw = (t) => { const k = Math.floor(t); return track.HW[k] + (track.HW[k + 1] - track.HW[k]) * (t - k); };
  const at = (t, lat) => {                                   // lat > 0: right of the lap's direction
    const k = Math.floor(t), f = t - k, a = track.P[k], b = track.P[k + 1], [tx, tz] = track.tan[k];
    return [a[0] + (b[0] - a[0]) * f - tz * lat, a[1] + (b[1] - a[1]) * f + tx * lat];
  };
  const edge = (side, t, off) => at(t, side * (hw(t) + off));
  const h = (x, z) => world.heightAt(x, z);

  // the points of a run every 1.5 m, split where a house stands in the way
  function runs(side, i0, i1, off) {
    const out = []; let cur = [];
    for (let t = i0; t <= i1 + 1e-6; t += 0.75) {
      const q = edge(side, t, off);
      if (clear(q[0], q[1])) cur.push(q); else { if (cur.length > 1) out.push(cur); cur = []; }
    }
    if (cur.length > 1) out.push(cur);
    return out;
  }

  // a wall that looks at the lap (toward the nearest point of the track, within 35 m): painted in full
  const facesTrack = (W) => {
    const n = track.nearest(W.mid[0], W.mid[1], -1, 35);
    if (!n || !(n.d < 35)) return false;
    const q = track.P[n.i], dx = q[0] - W.mid[0], dz = q[1] - W.mid[1], l = Math.hypot(dx, dz) || 1;
    return (W.nx * dx + W.nz * dz) / l > 0.35;
  };

  function* half(key) {
    const houses = (key === 'north' ? NORTH : SOUTH).map((k) => {
      const H = HOUSE[k], [, , spec, draw, door] = LOOK[k];
      const front = facesTrack;
      const extra = (P, W) => {
        if (door && front(W) && W.foot < 1.0) {
          const d = { w: 1.1, h: 2.3, ...door }, x = W.len * d.at;
          P.door(x - d.w / 2, x + d.w / 2, d.h, d.col, { frame: '#f2eee6', light: 0.4, panels: 2 });
          if (d.canopy) P.poly([[x - d.w / 2 - 0.4, d.h + 0.3], [x + d.w / 2 + 0.4, d.h + 0.3], [x + d.w / 2 + 0.25, d.h + 0.55], [x - d.w / 2 - 0.25, d.h + 0.55]], d.canopy);
        }
        if (draw) draw(P, W);
      };
      const walls = [draw === garages ? { near: H.at, within: 1e9, only: (P, W) => garages(P, W) } : { near: H.at, within: 1e9, draw: extra }];
      // (the map's blocks and the OSM outlines differ by a metre or two here and there)
      return { name: k, sec: H.sec, base: H.base, at: H.at, r: H.r, spec, walls, pick: (x, z) => polyD(H.poly, x, z) < 2.5 };
    });
    const fronts = new Set();
    // (skinHouses is a queued job of its own: a wall a step, a page sent to the card a step)
    skinHouses(world, group, houses, { label: 'veskifronts fronts', shadows, ppm: 18, far: 6, debug: DEBUG,
      faces: facesTrack });
    yield;
    const mats = fenceTextures();
    yield;
    const A = areaKit(world, group, { shadows });
    const buckets = {};
    for (const [side, i0, i1, off, kind, pil] of FENCES[key]) {
      const [hh, tw] = KINDS[kind], B = (buckets[kind] ||= { pos: [], uv: [] });
      for (const pts of runs(side, i0, i1, off)) {
        if (BREAKS[kind]) { breakableFence(world, group, pts, { h: hh, draw: BREAKS[kind], label: 'veski fence ' + kind }); continue; }
        let u = 0;
        for (let k = 0; k < pts.length - 1; k++) {
          const a = pts[k], b = pts[k + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const ya = h(a[0], a[1]) - 0.03, yb = h(b[0], b[1]) - 0.03, u1 = u + len / tw;
          const q = [[a[0], ya, a[1], u, 0], [b[0], yb, b[1], u1, 0], [b[0], yb + hh, b[1], u1, 1], [a[0], ya + hh, a[1], u, 1]];
          for (const n of [0, 1, 2, 0, 2, 3]) { B.pos.push(q[n][0], q[n][1], q[n][2]); B.uv.push(q[n][3], q[n][4]); }
          u = u1;
        }
        if (pil && pil.every) {
          let carry = 0;
          for (let k = 0; k < pts.length - 1; k++) {
            const a = pts[k], b = pts[k + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
            for (; carry <= len; carry += pil.every) { const x = a[0] + (b[0] - a[0]) * carry / len, z = a[1] + (b[1] - a[1]) * carry / len; A.p.box(pil.w, pil.h, pil.w, pil.c, x, h(x, z) + pil.h / 2 - 0.05, z); A.p.box(pil.w + 0.08, 0.08, pil.w + 0.08, pil.cap, x, h(x, z) + pil.h - 0.01, z); }
            carry -= len;
          }
        }
      }
      if (pil && pil.at) for (const t of pil.at) {
        const [x, z] = edge(side, t, off);
        if (!clear(x, z)) continue;
        A.p.box(pil.w, pil.h, pil.w, pil.c, x, h(x, z) + pil.h / 2 - 0.05, z);
        A.p.box(pil.w + 0.1, 0.12, pil.w + 0.1, pil.cap, x, h(x, z) + pil.h + 0.01, z);
        A.p.box(pil.w * 0.7, 0.14, pil.w * 0.7, pil.cap, x, h(x, z) + pil.h + 0.13, z);
      }
      if (jobs.late()) yield;
    }
    for (const [side, i0, i1, off, hh, w] of HEDGES[key]) for (const pts of runs(side, i0, i1, off)) A.hedge(pts, hh, w);
    yield;
    for (const [kind, B] of Object.entries(buckets)) {
      if (!B.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mats[kind]);
      m.castShadow = shadows; m.receiveShadow = true;
      group.add(m);
    }
    yield;
    A.finish();
  }

  const CENTRES = { north: [662, 2760], south: [745, 3110] };
  const built = { north: false, south: false };
  return {
    update(car) {
      if (!car) return;
      for (const key of ['north', 'south']) {
        if (built[key]) continue;
        const c = CENTRES[key];
        if (Math.hypot(car.x - c[0], car.z - c[1]) > 420) continue;
        const pts = key === 'north' ? [[686, 2667], [645, 2797], [687, 2918]] : [[692, 2996], [750, 3108], [804, 3233]];
        if (!pts.every((q) => world.ready(q[0], q[1]))) continue;
        built[key] = true;                       // (before jobs.add: see src/jobs.js)
        jobs.add(function* () { yield* half(key); }, 'veski fronts ' + key);
      }
    },
  };
}
