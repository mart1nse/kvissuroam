// The KEYBOARD section of the options (desktop): every key the game answers to and what it does (Martin 27 Nov: "add
// an explainer of all keyboard buttons usable to options submenu"). Written from the code that listens to them:
// src/input.js (driving), the input.on(...) list and the garage's own keys in src/main.js, src/race/racemode.js (1, Esc
// on the race call), src/spectate.js (watching a player), src/race/drag.js (the drag strip). A key added there gets a
// line here. What only some cars or ?drag=1 have is listed only then.
//   o: { wasd: WASD drives (the options' KEYS), drag: the drag strip is on, boost: the car has thrusters (BOOST and
//        the kickflip), fans: the car has suction fans, full: the browser can go full screen }
const k = (s) => s.split(' ').map((x) => `<kbd>${x}</kbd>`).join('');

export function keyListHtml(o) {
  const groups = [];
  const drive = o.wasd
    ? [['W ↑', 'gas'], ['S ↓', 'brake; held at a stop, reverse'], ['A D ← →', 'steer'], ['Space', 'handbrake'],
      ['B', 'look back while held'], ['Y', 'road or gravel tyres']]
    : [['↑', 'gas'], ['↓', 'brake; held at a stop, reverse'], ['← →', 'steer'], ['Space', 'handbrake'],
      ['A Z', 'one gear up / down by hand'], ['B', 'look back while held'], ['Y', 'road or gravel tyres']];
  groups.push(['DRIVING', drive, o.wasd ? 'WASD drives with an automatic gearbox (CONTROLS, KEYS).' : '']);
  if (o.boost || o.fans) {
    const c = [];
    if (o.boost) c.push(['Shift Q', 'BOOST while held'], ['X', 'kickflip']);
    if (o.fans) c.push(['U', 'suction fans off / on']);
    groups.push(['THIS CAR', c]);
  }
  groups.push(['CAMERA', [
    ['C', 'chase camera or drone view; from a side view, back to the view you had'],
    ['5 6', 'side view from the left / the right; the same key again goes back'],
  ]]);
  groups.push(['MOVING THE CAR', [
    ['R', 'back to the last spot (+5 s on a Majoraadi run)'],
    ['H', 'back to the start; at Majoraadi, the stage start'],
    ['Home', 'back to the start by the race track'],
  ]]);
  groups.push(['SCREENS', [
    ['M T', 'city map'], ['L', 'lap times'], ['O', 'options'], ['G', 'garage'],
    ['Esc', 'closes the open screen; on the road, the garage'], ['N', 'sound on / off'],
    ...(o.full ? [['F', 'full screen']] : []),
  ]]);
  groups.push(['RACE', [
    ['1', 'the race button: vote for a race, join it or leave it'],
    ['Esc', 'not interested, while a race calls you to its start'],
  ]]);
  if (o.drag) {
    groups.push(['DRAG STRIP', [
      [o.wasd ? 'E Q' : 'A Z', 'gear up / down'], ['P', 'practice run'], ['Backspace', 'leave the line'],
      ['R', 'back onto the line after a run'],
    ]]);
  }
  groups.push(['IN THE GARAGE', [
    ['← →', 'the next group of cars'], ['↑ ↓', 'the next car in the group'], ['Enter Space', 'DRIVE'],
    ['L', 'lap times'], ['G Esc', 'back to the car'],
  ]]);
  groups.push(['WATCHING A PLAYER', [['← →', 'the next player'], ['Esc', 'back to your car']]]);
  return `<div class="keylist">${groups.map(([name, rows, note]) => `<h5>${name}</h5><dl>${rows.map(([keys, what]) => `<dt>${k(keys)}</dt><dd>${what}</dd>`).join('')}</dl>${note ? `<p>${note}</p>` : ''}`).join('')}</div>`;
}
