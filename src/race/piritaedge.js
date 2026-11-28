// The inside of the left turn from Kloostrimetsa tee onto Merivälja tee on the Pirita-Kose lap (Martin, 28 Nov 2026,
// a yellow line on a picture of the game: "make the apex nice and round and also move the white line near to it.
// sidewalk after the kerb. and halo also to go with a nice smooth round corner following the kerb"). The lap's own
// line turns there in a few metres, so its inner edge was a sharp corner 9 m out from the real one. The inside is
// now one smooth curve from the edge of Kloostrimetsa tee to the edge of Merivälja tee, tangent to both: the kerb
// stands on it (src/world/tln/piritakeskus.js), the white edge line runs along it (src/world/tln/pirita.js) and the
// lap's glowing edge follows it (race.js).
export const MERI_IN = {
  i0: 2184, i1: 2214,                                   // the lap points where the curve leaves and rejoins the lap's left edge
  A: [-681.83, -568.5], V: [-701.27, -565.97], B: [-708.14, -535.55],
};
// the curve at t (0..1), `off` metres out into the road from it: [x, z, tx, tz]
export function meriIn(t, off = 0) {
  const { A, V, B } = MERI_IN, u = 1 - t;
  const x = u * u * A[0] + 2 * u * t * V[0] + t * t * B[0], z = u * u * A[1] + 2 * u * t * V[1] + t * t * B[1];
  let tx = u * (V[0] - A[0]) + t * (B[0] - V[0]), tz = u * (V[1] - A[1]) + t * (B[1] - V[1]);
  const l = Math.hypot(tx, tz) || 1;
  tx /= l; tz /= l;
  return [x - tz * off, z + tx * off, tx, tz];
}
