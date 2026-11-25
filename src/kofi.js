// The Ko-fi link in the garage's top left corner (Martin 25 Nov): "Ega token puu otsas kasva" over
// "TOETA LINNARINGI" in the DRIVE button's letters, a tree with coins for its crown, in DRIVE's colours.
// Only in stealth mode (?off=100) while Martin tries it. No coffee cup: he does not mention coffee.
import { STEALTH } from './net/stealth.js';

const TREE = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22.5v-9M12 16.5l-3.2-2.6M12 15l3.2-2.4"/><circle cx="12" cy="6" r="3.6"/><circle cx="6.2" cy="11.2" r="3.1"/><circle cx="17.8" cy="10.6" r="3.1"/></svg>';
const OUT = '<svg class="out" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5h5v5M9.5 2.5l-7 7"/></svg>';

const a = document.querySelector('#kofi');
if (a && STEALTH) {
  a.innerHTML = `${TREE}<span class="tx"><small class="ln">Ega token puu otsas kasva</small><b class="lb">TOETA LINNARINGI</b></span>${OUT}`;
  a.classList.remove('hidden');
}
