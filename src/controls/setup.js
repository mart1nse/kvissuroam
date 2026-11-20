// The CONTROLS screen (desktop): set up a gamepad or a steering wheel in three steps.
// 1 DEVICE: pick the controller (and whether it is a pad or a wheel). 2 CALIBRATE: turn left, turn
// right, press the throttle, press the brake, which finds the axes and their travel whatever the
// model. 3 TUNE: live bars, dead zone, sensitivity, response curve, steering style and the buttons.
// Opened from the garage (CONTROLS next to DRIVE) and from the options while driving.
import { ACTIONS, buttonName, shortName, steerRaw, shapeSteer, pedal } from './pads.js';

const CAL = [
  { id: 'centre', pad: 'Let go of the stick and the triggers.', wheel: 'Let go of the wheel and the pedals.', hint: 'Then press NEXT.' },
  { id: 'left', pad: 'Push the stick fully LEFT, then let go.', wheel: 'Turn the wheel fully LEFT, then back to the centre.' },
  { id: 'right', pad: 'Push the stick fully RIGHT, then let go.', wheel: 'Turn the wheel fully RIGHT, then back to the centre.' },
  { id: 'thr', pad: 'Squeeze the THROTTLE trigger fully, then let go.', wheel: 'Press the THROTTLE pedal to the floor, then let go.' },
  { id: 'brk', pad: 'Squeeze the BRAKE trigger fully, then let go.', wheel: 'Press the BRAKE pedal fully, then let go.' },
];

export function createSetup({ pads, toast = () => {}, onClose = () => {} }) {
  const el = document.createElement('div');
  el.id = 'ctlsetup';
  el.className = 'screen hidden';
  document.body.appendChild(el);
  let step = 0, pick = -1;        // pick: the gamepad index being set up
  let cal = null;                 // calibration in progress
  let capturing = null;           // action id waiting for a button

  const gpNow = () => pads.list().find((g) => g.index === pick) || null;
  const steps = ['DEVICE', 'CALIBRATE', 'TUNE & BUTTONS'];

  function frame(body, foot) {
    el.innerHTML = `<button class="bclose" data-s="close" aria-label="Close">✕</button>
      <h2>CONTROLS · GAMEPAD &amp; WHEEL</h2>
      <ol class="steps">${steps.map((s, i) => `<li class="${i === step ? 'on' : i < step ? 'done' : ''}" data-s="go" data-i="${i}"><b>${i + 1}</b>${s}</li>`).join('')}</ol>
      <div class="sbody">${body}</div>
      <div class="row">${foot}</div>`;
  }

  // ---- 1 DEVICE
  function renderDevice() {
    const list = pads.list();
    if (!list.some((g) => g.index === pick)) pick = list[0]?.index ?? -1;
    const mode = pads.mode;
    const devs = list.map((g) => {
      const p = pads.profileOf(g);
      return `<button class="dev${g.index === pick ? ' on' : ''}" data-s="pick" data-i="${g.index}"><b>${escape(shortName(g.id))}</b><small>${p.kind === 'wheel' ? 'WHEEL' : 'GAMEPAD'}${g.mapping === 'standard' ? ' · STANDARD LAYOUT' : ''}${p.thr && p.brk ? ' · READY' : ' · PEDALS NOT SET UP'}</small></button>`;
    }).join('');
    const gp = gpNow(), prof = gp && pads.profileOf(gp);
    frame(`${devs ? `<div class="devs">${devs}</div>` : `<p class="none">No controller found. Plug in a gamepad or a steering wheel (USB or Bluetooth) and press any button on it: the browser only shows a controller once a button has been pressed.</p>`}
      ${prof ? `<div class="srow"><span><b>THIS IS A</b><small>A wheel turns the car by its own angle; a pad's stick asks for a share of the grip.</small></span><div class="seg" data-s="kind"><button data-v="pad" class="${prof.kind === 'pad' ? 'on' : ''}">GAMEPAD</button><button data-v="wheel" class="${prof.kind === 'wheel' ? 'on' : ''}">WHEEL</button></div></div>` : ''}
      <div class="srow"><span><b>DRIVE WITH</b><small>AUTO switches to whatever you touched last.</small></span><div class="seg" data-s="mode"><button data-v="auto" class="${mode === 'auto' ? 'on' : ''}">AUTO</button><button data-v="kb" class="${mode === 'kb' ? 'on' : ''}">KEYBOARD</button><button data-v="pad" class="${mode === 'pad' ? 'on' : ''}">CONTROLLER</button></div></div>
      <p class="small">Xbox and PlayStation pads work as soon as they are plugged in. Wheels need step 2 once, for their pedals. Settings are kept per controller in this browser.</p>`,
    `<button class="neon" data-s="close">DONE</button>${gp ? '<button class="neon hot" data-s="next">CALIBRATE ›</button>' : ''}`);
  }

  // ---- 2 CALIBRATE
  const snapshot = (gp) => ({ a: [...gp.axes], b: gp.buttons.map((b) => b.value) });
  // the axis or button that has moved furthest from where it rested (except those in `skip`)
  function furthest(gp, rest, skip) {
    let best = null;
    const look = (t, vals, base) => vals.forEach((v, i) => {
      if (skip.some((s) => s && s.t === t && s.i === i)) return;
      const d = Math.abs(v - (base[i] ?? 0));
      if (!best || d > best.d) best = { t, i, d, v };
    });
    look('a', gp.axes, rest.a);
    look('b', gp.buttons.map((b) => b.value), rest.b);
    return best;
  }
  function renderCal() {
    const gp = gpNow();
    if (!gp) { step = 0; renderDevice(); return; }
    const prof = pads.profileOf(gp);
    if (!cal) cal = { k: 0, rest: null, src: null, ext: 0, from: 0, rel: 0, got: {} };
    const c = CAL[cal.k];
    const doneAll = cal.k >= CAL.length;
    frame(`${doneAll ? '<p class="big ok">CALIBRATED ✓</p><p class="small">Steering, throttle and brake are set. Next: try them out and pick the buttons.</p>'
      : `<p class="big">${c[prof.kind === 'wheel' ? 'wheel' : 'pad']}</p>${c.hint ? `<p class="small">${c.hint}</p>` : ''}<div class="meter"><i id="calbar"></i></div><p class="small" id="calsrc">&nbsp;</p>`}
      <ol class="calsteps">${CAL.map((s, i) => `<li class="${i < cal.k ? 'done' : i === cal.k ? 'on' : ''}">${['CENTRE', 'LEFT', 'RIGHT', 'THROTTLE', 'BRAKE'][i]}</li>`).join('')}</ol>`,
    `<button class="neon" data-s="back">‹ BACK</button>${doneAll ? '' : cal.k === 0 ? '<button class="neon hot" data-s="calnext">NEXT</button>' : '<button class="neon" data-s="calskip">SKIP</button>'}<button class="neon" data-s="calredo">START AGAIN</button>${doneAll ? '<button class="neon hot" data-s="next">TUNE ›</button>' : ''}`);
  }
  function updateCal() {
    const gp = gpNow();
    if (!gp || !cal || cal.k >= CAL.length || cal.k === 0) return;
    const prof = pads.profileOf(gp);
    const id = CAL[cal.k].id;
    const bar = el.querySelector('#calbar'), src = el.querySelector('#calsrc');
    const read = (s) => (s.t === 'a' ? gp.axes[s.i] : gp.buttons[s.i]?.value) ?? 0;
    if (!cal.src) {
      // waiting for something to move
      // (right is looked for on the axis found turning left; the pedals anywhere but the steering axis)
      const s0 = cal.got.steer;
      const f = id === 'right' && s0 ? { ...s0, d: Math.abs(read(s0) - cal.rest.a[s0.i]) } : furthest(gp, cal.rest, id === 'left' ? [] : [s0]);
      if (f && f.d > 0.45) { cal.src = { t: f.t, i: f.i }; cal.from = f.t === 'a' ? cal.rest.a[f.i] : cal.rest.b[f.i]; cal.ext = read(cal.src); cal.rel = 0; }
      if (bar) bar.style.width = `${Math.min(100, (f?.d || 0) * 100)}%`;
      return;
    }
    const v = read(cal.src);
    if (Math.abs(v - cal.from) > Math.abs(cal.ext - cal.from)) cal.ext = v;
    const travel = Math.abs(cal.ext - cal.from);
    if (bar) bar.style.width = `${Math.min(100, (Math.abs(v - cal.from) / Math.max(travel, 0.01)) * 100)}%`;
    if (src) src.textContent = `${cal.src.t === 'a' ? `AXIS ${cal.src.i + 1}` : buttonName(gp, cal.src.i)} · ${v.toFixed(2)}`;
    // let go: back by three quarters of the travel; the resting value is read a moment later
    if (!cal.rel && Math.abs(v - cal.ext) > 0.75 * travel) cal.rel = performance.now();
    if (!cal.rel || performance.now() - cal.rel < 300) return;
    const rest = v;
    if (id === 'left') cal.got.steer = { ...cal.src }, cal.got.l = cal.ext, cal.got.c = cal.from;
    else if (id === 'right') { if (!cal.got.steer) cal.got.steer = { ...cal.src }, cal.got.c = cal.from; cal.got.r = cal.ext; }
    else if (id === 'thr') cal.got.thr = { src: { ...cal.src }, rest, full: cal.ext };
    else if (id === 'brk') {
      // the same axis as the throttle only for combined pedals (opposite directions)
      const t = cal.got.thr;
      if (t && t.src.t === cal.src.t && t.src.i === cal.src.i && Math.sign(t.full - t.rest) === Math.sign(cal.ext - rest)) { cal.src = null; cal.rel = 0; return; }
      cal.got.brk = { src: { ...cal.src }, rest, full: cal.ext };
    }
    cal.src = null; cal.rel = 0;
    nextCal(gp, prof);
  }
  function nextCal(gp, prof) {
    cal.k++;
    if (cal.k >= CAL.length) {
      const g = cal.got;
      if (g.steer && (g.l != null || g.r != null)) {
        const l = g.l ?? 2 * g.c - g.r, r = g.r ?? 2 * g.c - g.l;
        prof.steer = { src: g.steer, l, c: g.c, r };
      }
      if (g.thr) prof.thr = g.thr;
      if (g.brk) prof.brk = g.brk;
      prof.calibrated = true;
      pads.save();
      toast('CONTROLLER CALIBRATED', 1800);
    }
    renderCal();
  }

  // ---- 3 TUNE & BUTTONS
  const slider = (key, label, min, max, st, note) => `<label class="slide"><span><b>${label}</b><small>${note}</small></span><input type="range" data-k="${key}" min="${min}" max="${max}" step="${st}"><output data-o="${key}"></output></label>`;
  function renderTune() {
    const gp = gpNow();
    if (!gp) { step = 0; renderDevice(); return; }
    const p = pads.profileOf(gp);
    frame(`<div class="tune">
      <div class="live">
        <div class="lbar steer"><span>STEERING</span><div><i id="lsteer"></i></div></div>
        <div class="lbar"><span>THROTTLE</span><div><i id="lthr"></i></div></div>
        <div class="lbar"><span>BRAKE</span><div><i id="lbrk"></i></div></div>
        ${slider('sens', 'SENSITIVITY', 0.5, 2, 0.05, 'How far the stick or wheel goes for full steering')}
        ${slider('dead', 'DEAD ZONE', 0, 0.3, 0.01, 'Steering ignored around the centre')}
        ${slider('curve', 'RESPONSE CURVE', 1, 3, 0.05, '1 is straight; higher is finer round the centre')}
        ${slider('pedalDead', 'PEDAL DEAD ZONE', 0, 0.2, 0.01, 'Throttle and brake ignored at the start of the travel')}
        <div class="srow"><span><b>STEERING</b><small>BY GRIP: full steering is the most the tyres hold at that speed (pads). BY ANGLE: the wheels follow the wheel (wheels).</small></span><div class="seg" data-s="direct"><button data-v="0" class="${p.direct ? '' : 'on'}">BY GRIP</button><button data-v="1" class="${p.direct ? 'on' : ''}">BY ANGLE</button></div></div>
        <div class="srow"><span><b>PEDAL BARS</b><small>Throttle and brake bars by the rev counter while driving.</small></span><div class="seg" data-s="bars"><button data-v="0" class="${p.bars ? '' : 'on'}">OFF</button><button data-v="1" class="${p.bars ? 'on' : ''}">ON</button></div></div>
      </div>
      <div class="btns"><span class="lbl">BUTTONS · click one, then press the button on the controller</span>
        ${ACTIONS.map((a) => `<button class="map${capturing === a.id ? ' wait' : ''}" data-s="map" data-a="${a.id}"><span>${a.label}</span><b>${capturing === a.id ? 'PRESS A BUTTON…' : buttonName(gp, p.btn[a.id])}</b></button>`).join('')}
        <p class="small">Steering, throttle and brake: ${p.thr && p.brk ? 'set' : '<em>pedals not set, see step 2</em>'}.</p>
      </div></div>`,
    `<button class="neon" data-s="back">‹ BACK</button><button class="neon" data-s="defaults">DEFAULTS</button><button class="neon hot" data-s="close">DONE</button>`);
    for (const inp of el.querySelectorAll('input[type=range]')) inp.value = p[inp.dataset.k];
    showOutputs(p);
  }
  function showOutputs(p) {
    for (const o of el.querySelectorAll('output')) {
      const k = o.dataset.o, v = p[k];
      o.textContent = k === 'sens' || k === 'curve' ? v.toFixed(2) : `${Math.round(v * 100)}%`;
    }
  }
  function updateTune() {
    const gp = gpNow();
    if (!gp) return;
    const p = pads.profileOf(gp);
    const s = shapeSteer(steerRaw(gp, p.steer), p);
    const st = el.querySelector('#lsteer');
    if (!st) return;
    st.style.left = `${50 + Math.min(0, s) * 50}%`;
    st.style.width = `${Math.abs(s) * 50}%`;
    el.querySelector('#lthr').style.width = `${pedal(gp, p.thr, p.pedalDead) * 100}%`;
    el.querySelector('#lbrk').style.width = `${pedal(gp, p.brk, p.pedalDead) * 100}%`;
  }

  function render() {
    if (step === 0) renderDevice();
    else if (step === 1) renderCal();
    else renderTune();
  }
  function go(i) {
    if (i > 0 && !gpNow()) i = 0;
    pads.cancelCapture(); capturing = null;
    if (i === 1) {
      cal = null;
      const gp = gpNow();
      if (gp) { cal = { k: 0, rest: snapshot(gp), src: null, ext: 0, from: 0, rel: 0, got: {} }; }
    }
    step = i;
    render();
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-s]');
    if (!b) return;
    const s = b.dataset.s;
    b.blur?.();
    const gp = gpNow(), prof = gp && pads.profileOf(gp);
    if (s === 'close') close();
    else if (s === 'go') go(+b.dataset.i);
    else if (s === 'next') go(step + 1);
    else if (s === 'back') go(step - 1);
    else if (s === 'pick') { pick = +b.dataset.i; renderDevice(); }
    else if (s === 'kind' || s === 'mode' || s === 'direct' || s === 'bars') {
      const v = e.target.closest('[data-v]')?.dataset.v;
      if (v == null) return;
      if (s === 'mode') { pads.setMode(v); render(); return; }
      if (!prof) return;
      if (s === 'kind') { if (prof.kind !== v) pads.reset(gp, v); }
      else { prof[s] = v === '1'; pads.save(); }
      render();
    } else if (s === 'calnext' && gp) { cal.rest = snapshot(gp); nextCal(gp, prof); }
    else if (s === 'calskip' && gp) { cal.src = null; cal.rel = 0; nextCal(gp, prof); }
    else if (s === 'calredo') go(1);
    else if (s === 'defaults' && gp) { pads.reset(gp, prof.kind); render(); toast('DEFAULTS', 1200); }
    else if (s === 'map' && gp) {
      const a = b.dataset.a;
      if (capturing === a) { capturing = null; pads.cancelCapture(); render(); return; }
      capturing = a;
      pads.capture(function got(g, i) {
        if (g.index !== pick) { pads.capture(got); return; }
        const p = pads.profileOf(g);
        for (const k in p.btn) if (p.btn[k] === i) p.btn[k] = -1;      // one button, one job
        p.btn[a] = i;
        pads.save();
        capturing = null;
        render();
      });
      render();
    }
  });
  el.addEventListener('input', (e) => {
    const k = e.target.dataset?.k;
    const gp = gpNow();
    if (!k || !gp) return;
    const p = pads.profileOf(gp);
    p[k] = +e.target.value;
    pads.save();
    showOutputs(p);
  });
  // Esc closes (before the game's own Esc), or cancels a button being picked
  addEventListener('keydown', (e) => {
    if (el.classList.contains('hidden')) return;
    if (e.code === 'Escape') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (capturing) { capturing = null; pads.cancelCapture(); render(); } else close();
    }
  }, true);
  pads.onChange(() => { if (!el.classList.contains('hidden') && step === 0) renderDevice(); });

  function open() {
    el.classList.remove('hidden');
    pads.quiet = true;
    const a = pads.active;
    if (a) pick = a.gp.index;
    step = 0;
    render();
  }
  function close() {
    if (el.classList.contains('hidden')) return;
    el.classList.add('hidden');
    pads.quiet = false;
    pads.cancelCapture(); capturing = null; cal = null;
    onClose();
  }
  return {
    open, close,
    get isOpen() { return !el.classList.contains('hidden'); },
    update() {
      if (el.classList.contains('hidden')) return;
      if (step === 1) updateCal();
      else if (step === 2) updateTune();
    },
  };
}

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
