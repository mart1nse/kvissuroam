// The Ko-fi link in the garage's top left corner (Martin 25 Nov): "Ega token puu otsas kasva" over
// "TOETA LINNARINGI" in the DRIVE button's letters, a tree with coins for its crown, in DRIVE's colours.
// Only in stealth mode (?off=100) while Martin tries it. No coffee cup: he does not mention coffee.
import { STEALTH } from './net/stealth.js';

const TREE = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22.5v-9M12 16.5l-3.2-2.6M12 15l3.2-2.4"/><circle cx="12" cy="6" r="3.6"/><circle cx="6.2" cy="11.2" r="3.1"/><circle cx="17.8" cy="10.6" r="3.1"/></svg>';
const OUT = '<svg class="out" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5h5v5M9.5 2.5l-7 7"/></svg>';

// Pressed, the button turns into Ko-fi's own donation panel where it stands (Martin 25 Nov: "expand and use the
// widget in game", then "when clicking it it is just replaced with the kofi thingy"): the panel's head is the
// button itself, and the panel grows out of the button's corner. Down the whole left side on a phone. The panel's page is loaded only on the
// first press. A click with Ctrl / Cmd / the middle button still opens ko-fi.com in a new tab, and so does the
// ↗ in the panel's head (for when the payment wants a whole page). Ko-fi's page cannot be restyled from here,
// so a lilac sheet multiplied over it turns its white lilac (Martin 25 Nov); it lets taps through.
// Apple Pay does not show inside the frame (it would need linnaring.com registered with Ko-fi's payment
// account), so on Apple's browsers a line under the panel opens Ko-fi's own page, where it does (Martin 25 Nov).
const APPLE = typeof window.ApplePaySession === 'function';
const PANEL_URL = 'https://ko-fi.com/linnaring/?hidefeed=true&widget=true&embed=true&preview=true';

const a = document.querySelector('#kofi');
if (a && STEALTH) {
  a.innerHTML = `${TREE}<span class="tx"><small class="ln">Ega token puu otsas kasva</small><b class="lb">TOETA LINNARINGI</b></span>${OUT}`;
  a.classList.remove('hidden');

  let panel = null;
  const isOpen = () => panel && !panel.classList.contains('hidden');
  function open() {
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'kofipanel';
      panel.innerHTML = `<div class="head"><button type="button" class="shut" aria-label="Close">${TREE}<span class="tx"><small class="ln">Ega token puu otsas kasva</small><b class="lb">TOETA LINNARINGI</b></span></button><a href="https://ko-fi.com/linnaring" target="_blank" rel="noopener" title="Open Ko-fi in a new tab" aria-label="Open Ko-fi in a new tab">${OUT}</a><button type="button" class="x" aria-label="Close">×</button></div>
        <div class="frame"><i class="wait">…</i><iframe src="${PANEL_URL}" title="Support LinnaRing on Ko-fi" allow="payment" loading="eager"></iframe><i class="tint"></i></div>${APPLE ? `<a class="apple" href="https://ko-fi.com/linnaring" target="_blank" rel="noopener">Apple Pay? Open on ko-fi.com ${OUT}</a>` : ''}`;
      panel.querySelector('.x').addEventListener('click', close);
      panel.querySelector('.shut').addEventListener('click', close);
      panel.querySelector('iframe').addEventListener('load', () => panel.classList.add('ready'));
      // (the menu's own taps and drags must not see what happens in the panel)
      for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'touchstart', 'touchmove']) panel.addEventListener(ev, (e) => e.stopPropagation());
      a.after(panel);
    }
    // (it grows out of the button: the clip it starts from is the button's size)
    const r = a.getBoundingClientRect();
    panel.style.setProperty('--bw', `${r.width}px`);
    panel.style.setProperty('--bh', `${r.height}px`);
    panel.classList.remove('hidden');
    panel.style.animation = 'none'; void panel.offsetWidth; panel.style.animation = '';
    a.classList.add('open');
  }
  function close() {
    if (!panel) return;
    panel.classList.add('hidden');
    a.classList.remove('open');
  }
  a.addEventListener('click', (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;   // a new tab, as asked
    e.preventDefault();
    if (isOpen()) close(); else open();
  });
  // while it is open, keys belong to it: Escape closes it, nothing reaches the garage (no car switch, no DRIVE)
  addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.code === 'Escape') { e.preventDefault(); close(); }
    e.stopImmediatePropagation();
  }, true);
  // a tap anywhere else in the garage closes it
  addEventListener('pointerdown', (e) => { if (isOpen() && !panel.contains(e.target) && !a.contains(e.target)) close(); }, true);
  // leaving the garage closes it
  new MutationObserver(() => { if (document.querySelector('#menu')?.classList.contains('hidden')) close(); })
    .observe(document.querySelector('#menu'), { attributes: true, attributeFilter: ['class'] });
}
