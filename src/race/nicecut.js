// NICE CUT! (Martin, 27 Nov 2026): on the lawn inside the bend where Vallikraavi turns into Baeri, by the graffiti
// outbuilding, two trees stand far enough apart for a car to go between them and cut the corner. It stays legal (no
// gate, no penalty: he crashed into a tree the first two times, so the risk is its own price), and a car on a
// hotlap or in a race that makes it gets a see-through thumbs up and NICE CUT! in the lap record's letters, for 3 s
// and then fading out. Own car only: race.update runs for the car being driven.
// Judged on the frame's movement line against the line between the two trunks, in the lap's direction (east to
// west): a few multiplications a frame, and the sign is made the first time it shows.

// the two trunks (map trees, as world.trunksNear has them): the near one by the road, the far one up the lawn
const A = [1015.61, 3024.96], B = [1008.75, 3030.5];
const SHOW_MS = 3800;                           // 3 s on, then 0.8 s fading out (the animation in style.css)
const THUMB = 'M30 46L42 22Q46 11 53 15Q59 20 56 31L53 42L80 42Q88 42 87 49Q87 54 82 55Q87 57 86 62Q85 67 80 67Q85 69 84 73Q83 78 78 78Q82 80 81 84Q80 88 74 88L30 88ZM15 46L25 46L25 90L15 90Z';

// which side of the line between the trees a point is on: < 0 the side the lap comes from
const side = (x, z) => (B[0] - A[0]) * (z - A[1]) - (B[1] - A[1]) * (x - A[0]);

// did the move from (px, pz) to (x, z) go between the trees, the lap's way round?
export function throughCut(px, pz, x, z) {
  const s0 = side(px, pz), s1 = side(x, z);
  if (!(s0 < 0 && s1 >= 0)) return false;
  // where the move crosses the line through the trunks, as a share of the way from A to B (the trunks' own
  // half metre at either end is the tree, not the gap)
  const f = s0 / (s0 - s1), cx = px + (x - px) * f, cz = pz + (z - pz) * f;
  const ux = B[0] - A[0], uz = B[1] - A[1], l2 = ux * ux + uz * uz;
  const t = ((cx - A[0]) * ux + (cz - A[1]) * uz) / l2;
  const pad = 0.45 / Math.sqrt(l2);
  return t > pad && t < 1 - pad;
}

export function createNiceCut() {
  let el = null, timer = 0;
  return {
    check(px, pz, x, z) {
      // (far from the trees nothing more than this one test)
      if (Math.abs(x - 1012) > 40 || Math.abs(z - 3028) > 40) return false;
      if (!throughCut(px, pz, x, z)) return false;
      this.show();
      return true;
    },
    show() {
      if (!el) {
        el = document.createElement('div');
        el.id = 'nicecut'; el.className = 'hidden';
        el.innerHTML = `<svg viewBox="8 8 86 86" aria-hidden="true"><path d="${THUMB}"/></svg><div class="k">NICE CUT!</div>`;
        document.querySelector('#hud')?.appendChild(el);
      }
      el.classList.remove('hidden', 'go');
      void el.offsetWidth; el.classList.add('go');
      clearTimeout(timer); timer = setTimeout(() => el.classList.add('hidden'), SHOW_MS);
    },
  };
}
