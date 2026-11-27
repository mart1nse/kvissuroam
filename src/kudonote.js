// "THUMBS UP FROM <name>": a short, faint line on the right of the screen when somebody gives us a thumbs up
// (Martin 2026-11-27). The sign in our back window (src/kudos.js) says who too, but the chase camera often hides
// the name, and phones show no notes in the online list. One line only: a thumbs up that comes while it shows
// takes its place, and how many more came meanwhile is a "+N" after the name, so several at once are not a pile.
// Light: one small element made at the first thumbs up, text and a class changed, the fading done by CSS.
import { badName } from '../worker/badnames.js';

const SHOW_MS = 2600;                    // in view this long after the last thumbs up, then fades (.5 s, style.css)

export function createKudoNote(parent) {
  let el = null, nameEl = null, moreEl = null, dot = null, timer = 0, more = 0, on = false;
  return {
    show(name, colour) {
      // (names are already refused at the server and in the garage; a stale one from an old page is not shown)
      const n = String(name || '').trim();
      const nm = n && !badName(n) ? n.toUpperCase() : 'A DRIVER';
      if (!el) {
        el = document.createElement('div');
        el.id = 'kudonote';
        el.innerHTML = '<span>THUMBS UP FROM </span><i></i><b></b><small></small>';
        dot = el.querySelector('i'); nameEl = el.querySelector('b'); moreEl = el.querySelector('small');
        parent.appendChild(el);
      }
      more = on ? more + 1 : 0;
      nameEl.textContent = nm;
      moreEl.textContent = more ? ` +${more}` : '';
      dot.style.setProperty('--c', colour || '#ffffff');
      // (the class a frame later, so the fade in runs without making the page lay itself out at once)
      if (!on) { on = true; requestAnimationFrame(() => on && el.classList.add('on')); }
      clearTimeout(timer);
      timer = setTimeout(() => { el.classList.remove('on'); on = false; more = 0; }, SHOW_MS);
    },
  };
}
