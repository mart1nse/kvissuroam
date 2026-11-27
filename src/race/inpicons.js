// Small marks for what drove a lap (the lap's `inp`: whichever drove most of it, src/race/race.js and raadi.js), on the
// LAP TIMES board (src/race/board.js) and beside the name of a lap record's replay (src/spectate.js). Laps from before
// this was kept (20 Nov 2026) count as keyboard on the board. A Steam Controller drives as a gamepad and is one.
export const INP = {
  kb: ['KEYBOARD', '<rect x="1.5" y="5" width="21" height="11" rx="1.5"/><path d="M5 8.5h1M8.5 8.5h1M12 8.5h1M15.5 8.5h1M19 8.5h0M7 12.5h10"/>'],
  pad: ['GAMEPAD', '<path d="M7 5h10c3 0 5 3 5.5 7s-1 6-3 6-3-3-5-3h-5c-2 0-3 3-5 3s-3.5-2-3-6S4 5 7 5z"/><path d="M7 9v4M5 11h4M16 10h0M18 12h0"/>'],
  wheel: ['WHEEL', '<circle cx="12" cy="10.5" r="8.5"/><circle cx="12" cy="10.5" r="2"/><path d="M3.6 9.5l6.4 1M20.4 9.5l-6.4 1M12 12.5V19"/>'],
  touch: ['TOUCH SCREEN', '<rect x="6.5" y="1.5" width="11" height="17" rx="2"/><path d="M10.5 15.5h3"/>'],
};
// label: the words the mark is named by (its tooltip), the kind's name by default
export const inpIcon = (k, label = null) => {
  const [name, d] = INP[k] || INP.kb, t = label ? label(name) : name;
  return `<svg class="inp" viewBox="0 0 24 20" role="img" aria-label="${t}"><title>${t}</title>${d}</svg>`;
};
