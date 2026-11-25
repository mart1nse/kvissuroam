// The Ko-fi link in the garage's top left corner, "Ega token puu otsas kasva" (Martin 25 Nov).
// Only in stealth mode (?off=100) while Martin tries it; ?kofi=1..6 picks one of the looks
// (style in src/style.css, #kofi.v1 .. .v6). No coffee cup: he does not mention coffee.
import { STEALTH } from './net/stealth.js';

const GRAD = '<linearGradient id="kofig" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2ff3ff"/><stop offset="1" stop-color="#ff2bd6"/></linearGradient>';
// a token: a coin with an inner ring and a four point glint
const TOKEN = `<svg class="ic token" viewBox="0 0 24 24" aria-hidden="true"><defs>${GRAD}</defs><circle class="ln1" cx="12" cy="12" r="9.2"/><circle class="ln2" cx="12" cy="12" r="6.2"/><path class="glint" d="M12 8.3l.9 2.8 2.8.9-2.8.9-.9 2.8-.9-2.8-2.8-.9 2.8-.9z"/></svg>`;
// the saying drawn: a tree with three coins for its crown
const TREE = `<svg class="ic tree" viewBox="0 0 24 24" aria-hidden="true"><defs>${GRAD}</defs><path class="ln1" d="M12 22.5v-9M12 16.5l-3.2-2.6M12 15l3.2-2.4"/><circle class="ln1" cx="12" cy="6" r="3.6"/><circle class="ln1" cx="6.2" cy="11.2" r="3.1"/><circle class="ln1" cx="17.8" cy="10.6" r="3.1"/></svg>`;
// the Ko-fi page's avatar: a sunset sun cut by stripes on a dark disc
const SUN = `<svg class="sun" viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="kofisun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd45e"/><stop offset=".55" stop-color="#ff8a5c"/><stop offset="1" stop-color="#ff2bd6"/></linearGradient>
  <clipPath id="koficlip"><rect x="0" y="0" width="40" height="22"/><rect x="0" y="24" width="40" height="2.4"/><rect x="0" y="28.4" width="40" height="1.8"/></clipPath></defs>
  <circle cx="20" cy="20" r="20" fill="#1c0a3a"/><circle cx="20" cy="20" r="12" fill="url(#kofisun)" clip-path="url(#koficlip)"/></svg>`;
const OUT = '<svg class="out" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5h5v5M9.5 2.5l-7 7"/></svg>';
const LINE = 'Ega token puu otsas kasva';
const LOOKS = {
  1: `${TOKEN}<span class="tx"><b class="ln">${LINE}</b></span>${OUT}`,
  2: `${TREE}<span class="tx"><small class="lb">TOETA LINNARINGI</small><b class="ln">${LINE}</b></span>${OUT}`,
  3: `${TREE}<span class="tx"><b class="ln">${LINE}</b></span>${OUT}`,
  4: `<span class="tx"><b class="ln">${LINE}</b></span><span class="kend">${TOKEN}KO-FI</span>`,
  5: `${SUN}<span class="tx"><b class="ln">${LINE}</b><small class="sub">Aita hoida tuled põlemas · Ko-fi</small></span>${OUT}`,
  6: `${TOKEN}<span class="tx"><b class="ln">${LINE}</b></span><small class="kend">KO-FI ${OUT}</small>`,
};

const a = document.querySelector('#kofi');
if (a && STEALTH) {
  const want = new URLSearchParams(location.search).get('kofi');
  const v = LOOKS[want] ? want : '2';
  a.className = `v${v}`;
  a.innerHTML = LOOKS[v];
}
