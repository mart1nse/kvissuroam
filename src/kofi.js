// The Ko-fi button (Martin 25 Nov): SUPPORT LINNARING over "Ega token puu otsas kasva", a tree with coins for its
// crown, in the row under the cars to the right of LAP TIMES and CONTROLS (src/style.css says how it looks).
// Only in stealth mode (?off=100) while Martin tries it. No coffee cup: he does not mention coffee.
import { STEALTH } from './net/stealth.js';

const TREE = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22.5v-9M12 16.5l-3.2-2.6M12 15l3.2-2.4"/><circle cx="12" cy="6" r="3.6"/><circle cx="6.2" cy="11.2" r="3.1"/><circle cx="17.8" cy="10.6" r="3.1"/></svg>';
const OUT = '<svg class="out" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5h5v5M9.5 2.5l-7 7"/></svg>';
const TX = '<span class="tx"><b class="lb"><span>SUPPORT</span><span class="nm">LINNARING</span></b><small class="ln">Ega token puu otsas kasva</small></span>';

// Pressed, the button turns into Ko-fi's own donation panel where it stands (Martin 25 Nov: "expand and use the
// widget in game", then "when clicking it it is just replaced with the kofi thingy"): the panel's foot is the
// button itself, and the panel grows up out of it. The panel's page is loaded only on the first press. A click
// with Ctrl / Cmd / the middle button still opens ko-fi.com in a new tab, and so does the ↗ in the panel's foot
// (for when the payment wants a whole page). Ko-fi's page cannot be restyled from here, so a lilac sheet
// multiplied over it turns its white lilac (Martin 25 Nov); it lets taps through.
const PANEL_URL = 'https://ko-fi.com/linnaring/?hidefeed=true&widget=true&embed=true&preview=true';

const a = document.querySelector('#kofi');
const menu = document.querySelector('#menu');
if (a && menu && STEALTH) {
  a.innerHTML = `${TREE}${TX}`;
  // Into the row under the cars once it is built (src/race/board.js, then the tyres in main.js): LAP TIMES over
  // CONTROLS, the button beside them. On phones LAP TIMES on two lines (CSS shows them stacked there).
  let row = null, left = null, side = null, drive = null;
  const seat = () => {
    row = document.querySelector('#menurow'); left = document.querySelector('#menuleft'); side = document.querySelector('#menuside');
    drive = document.querySelector('#drive');
    const lt = side?.querySelector('#boardbtn');
    if (!row || !left || !lt || !drive) return false;
    const pair = document.createElement('div');
    pair.className = 'pair';
    side.prepend(pair);
    pair.append(lt);
    const ct = side.querySelector('#ctlbtn');
    if (ct) pair.append(ct);
    const sp = lt.querySelector('span');
    if (sp && sp.textContent === 'LAP TIMES') sp.innerHTML = '<span>LAP</span> <span>TIMES</span>';
    side.append(a);
    row.classList.add('kofirow');
    a.classList.remove('hidden');
    return true;
  };
  // DRIVE in the middle under the cards, the same free space between all the row's parts and both sides as wide
  // as the wider one, the whole row no wider than the car columns (on a phone both sides fill that room). Where
  // the left side does not fit, TYRES shows only its icon.
  const fit = () => {
    if (!row || menu.classList.contains('hidden')) return;
    const gs = [...document.querySelectorAll('#cards .group')].map((g) => g.getBoundingClientRect()).filter((r) => r.width);
    if (!gs.length) return;
    const pad = Math.max(14, Math.min(38, gs[0].left));
    const span = Math.min(gs[gs.length - 1].right - gs[0].left, innerWidth - 2 * pad);
    row.style.removeProperty('--sw');
    row.classList.remove('tight');
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    const room = Math.floor((span - drive.getBoundingClientRect().width - 2 * gap) / 2);
    let lw = left.getBoundingClientRect().width;
    if (lw > room) { row.classList.add('tight'); lw = left.getBoundingClientRect().width; }
    const rw = side.getBoundingClientRect().width;
    const touch = document.body.classList.contains('touch');
    row.style.setProperty('--sw', `${touch ? room : Math.min(room, Math.ceil(Math.max(lw, rw)))}px`);
  };
  const start = () => {
    if (!seat()) return false;
    fit();
    if (typeof ResizeObserver === 'function') { const ro = new ResizeObserver(fit); ro.observe(menu); ro.observe(drive); }
    new MutationObserver(fit).observe(menu, { attributes: true, attributeFilter: ['class'] });
    document.fonts?.ready.then(fit);
    return true;
  };
  if (!start()) {
    const mo = new MutationObserver(() => { if (start()) mo.disconnect(); });
    mo.observe(menu, { childList: true, subtree: true });
  }

  let panel = null;
  const isOpen = () => panel && !panel.classList.contains('hidden');
  function open() {
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'kofipanel';
      panel.innerHTML = `<div class="head"><button type="button" class="shut" aria-label="Close">${TREE}${TX}</button><a href="https://ko-fi.com/linnaring" target="_blank" rel="noopener" title="Open Ko-fi in a new tab" aria-label="Open Ko-fi in a new tab">${OUT}</a><button type="button" class="x" aria-label="Close">×</button></div>
        <div class="frame"><i class="wait">…</i><iframe src="${PANEL_URL}" title="Support LinnaRing on Ko-fi" allow="payment" loading="eager"></iframe><i class="tint"></i></div>`;
      panel.querySelector('.x').addEventListener('click', close);
      panel.querySelector('.shut').addEventListener('click', close);
      panel.querySelector('iframe').addEventListener('load', () => panel.classList.add('ready'));
      // (the menu's own taps and drags must not see what happens in the panel)
      for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'touchstart', 'touchmove']) panel.addEventListener(ev, (e) => e.stopPropagation());
      menu.append(panel);
    }
    // (over the button, its right edge and foot where the button's are, as tall as the room above allows; it
    // grows out of the button: the clip it starts from is the button's place and size)
    const r = a.getBoundingClientRect();
    const box = menu.getBoundingClientRect();
    const phone = innerHeight <= 430;
    const pw = Math.min(Math.max(r.width, phone ? Math.min(440, innerWidth * .64) : 420), box.width - 20);
    const pl = Math.max(10, Math.min(r.right - box.left - pw, box.width - 10 - pw));
    const foot = r.bottom - box.top;
    const ph = phone ? foot - 8 : Math.min(730, foot - 12);
    const bx = r.left - box.left - pl;
    for (const [k, v] of [['--pl', pl], ['--pt', foot - ph], ['--pw', pw], ['--ph', ph], ['--bh', r.height], ['--ct', ph - r.height], ['--cl', bx], ['--cr', pw - bx - r.width]]) panel.style.setProperty(k, `${Math.round(v)}px`);
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
