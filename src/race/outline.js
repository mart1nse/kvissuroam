// The start screen's track map: the real lap centre line as a neon outline (north up, like the
// city map), with a bright dot lapping it. Clicking it opens the lap times board.
import { TRACK } from './circuit.js';

const LAP_S = 7;               // seconds for the dot to go round
const TAIL = 70;               // length of the dot's tail, in thousandths of the lap

export function createOutline({ after, onOpen }) {
  const pts = TRACK.pts;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const pad = 70, w = x1 - x0 + pad * 2, h = z1 - z0 + pad * 2;
  const f = (v) => v.toFixed(1);
  let d = '';
  for (let i = 0; i < pts.length; i += 3) d += `${i ? 'L' : 'M'}${f(pts[i][0] - x0 + pad)} ${f(pts[i][1] - z0 + pad)}`;
  d += 'Z';
  // the start and finish line, across the track
  const [ax, az] = pts[0], [bx, bz] = pts[6];
  const l = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / l * 34, nz = (bx - ax) / l * 34;
  const sx = ax - x0 + pad, sz = az - z0 + pad;

  const btn = document.createElement('button');
  btn.id = 'trackmap';
  btn.title = 'Lap times';
  btn.setAttribute('aria-label', `${TRACK.name} circuit, ${(TRACK.length / 1000).toFixed(1)} km: show the lap times`);
  btn.innerHTML = `<svg viewBox="0 0 ${f(w)} ${f(h)}" aria-hidden="true">
      <defs><path id="tm-line" d="${d}"/></defs>
      <use href="#tm-line" class="under"/>
      <use href="#tm-line" class="halo"/>
      <use href="#tm-line" class="tube"/>
      <use href="#tm-line" class="core"/>
      <line class="sf" x1="${f(sx - nx)}" y1="${f(sz - nz)}" x2="${f(sx + nx)}" y2="${f(sz + nz)}"/>
      <path d="${d}" class="tail" pathLength="1000" stroke-dasharray="${TAIL} ${1000 - TAIL}">
        <animate attributeName="stroke-dashoffset" from="${TAIL}" to="${TAIL - 1000}" dur="${LAP_S}s" repeatCount="indefinite"/>
      </path>
      <g class="dot"><circle r="44" class="glow"/><circle r="19"/>
        <animateMotion dur="${LAP_S}s" repeatCount="indefinite"><mpath href="#tm-line"/></animateMotion>
      </g>
    </svg>
    <span class="cap"><b>${TRACK.name.toUpperCase()}</b> · ${(TRACK.length / 1000).toFixed(1)} KM · <i>LAP TIMES</i></span>`;
  after.after(btn);
  btn.addEventListener('click', () => { btn.blur(); onOpen(); });
  // it takes whatever room is left above the cars; with too little of it, it steps aside
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => btn.classList.toggle('tiny', btn.clientHeight < 80)).observe(btn);
  }
  return btn;
}
