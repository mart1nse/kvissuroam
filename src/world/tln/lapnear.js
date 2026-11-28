// How near a spot is to the Pirita-Kose lap's road (Tallinn): for the trees that stand right by it.
import LAP from '../../race/pirita.json';

const P = LAP.pts, HW = LAP.hw, CELL = 24;
let cells = null;
function grid() {
  cells = new Map();
  for (let i = 0; i < P.length; i++) {
    const k = Math.floor(P[i][0] / CELL) * 100003 + Math.floor(P[i][1] / CELL);
    let l = cells.get(k);
    if (!l) cells.set(k, (l = []));
    l.push(i);
  }
}
// the lap's road beside (x, z): [metres from the road's edge, unit x, unit z towards the road], or null when the lap
// is over 24 m away
export function lapBeside(x, z) {
  if (!cells) grid();
  let best = Infinity, bi = -1;
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const l = cells.get((cx + a) * 100003 + cz + b);
    if (l) for (const i of l) { const d = (P[i][0] - x) ** 2 + (P[i][1] - z) ** 2; if (d < best) { best = d; bi = i; } }
  }
  if (bi < 0 || best > CELL * CELL) return null;
  const d = Math.sqrt(best) || 1;
  return [d - HW[bi], (P[bi][0] - x) / d, (P[bi][1] - z) / d];
}
