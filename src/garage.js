// The garage: the car groups side by side, each one a reel. Every car is a card of the same size.
// The group's current car sits in the middle slot, the car before it shows as a slim tab above and
// the next one as a tab below; the reel goes round. Sliding it (drag up or down, a tap on a tab, the
// mouse wheel, the up and down keys) moves every card one slot, and the cards follow the finger while
// it drags.
const CHEVRON = '<svg viewBox="0 0 20 12" aria-hidden="true"><path d="M2 10 10 2l8 8"/></svg>';
const SLIDE_MS = 300;
const mod = (i, n) => ((i % n) + n) % n;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function createGarage({ root, cars, groups: defs, picked, onPick }) {
  // the bars under a car's figures: how it compares with the strongest, quickest and fastest car here
  const all = defs.flatMap((d) => d.ids).map((id) => cars[id].ref);
  const secs = (r) => r.zeroTo100 ?? r.zeroTo50 * 2.4;         // (the bus only has a 0-50 time)
  const maxKw = Math.max(...all.map((r) => r.powerKw)), maxTop = Math.max(...all.map((r) => r.top)), minSecs = Math.min(...all.map(secs));
  const pct = (v) => `${Math.round(Math.max(0.06, Math.min(1, v)) * 100)}%`;

  function face(id) {
    const s = cars[id], r = s.ref;
    return `<span class="tab"><b>${s.name}</b><i>${r.powerKw} kW</i></span>
      <span class="full" data-yr="${s.year}">
        <span class="yr">${s.year}</span><h3>${s.name}</h3><p>${s.blurb}</p>
        <dl>
          <div><dt>POWER</dt><dd>${r.powerKw}<small>kW</small></dd><u><i style="width:${pct(r.powerKw / maxKw)}"></i></u></div>
          <div><dt>${r.zeroTo50 ? '0–50' : '0–100'}</dt><dd>${r.zeroTo50 ?? r.zeroTo100}<small>s</small></dd><u><i style="width:${pct(minSecs / secs(r))}"></i></u></div>
          <div><dt>TOP</dt><dd>${r.top}<small>km/h</small></dd><u><i style="width:${pct(r.top / maxTop)}"></i></u></div>
        </dl>
      </span>`;
  }

  let current = picked;          // the car that DRIVE will start
  let drag = null, swiped = false, lastWheel = 0, raf = 0;
  root.innerHTML = '';
  const groups = defs.map((def) => {
    const n = def.ids.length;
    const el = document.createElement('div');
    el.className = 'group';
    el.innerHTML = `<h4><span>${def.name}</span><i class="pips">${'<b></b>'.repeat(n)}</i></h4><div class="reel"></div>`;
    const reel = el.querySelector('.reel');
    // pos: which card is in the middle slot, counted on without wrapping; it glides to `to`
    const g = { ids: def.ids, n, el, reel, pos: 0, to: 0, from: 0, t0: 0, items: new Map(), pips: [...el.querySelectorAll('.pips b')] };
    if (n > 1) {
      // the tabs above and below are the buttons that slide the reel, each with an arrow
      for (const [cls, d, label] of [['up', -1, 'Previous car'], ['dn', 1, 'Next car']]) {
        const b = document.createElement('button');
        b.className = `step ${cls}`;
        b.setAttribute('aria-label', label);
        b.innerHTML = CHEVRON;
        b.addEventListener('click', () => { if (!swiped) slide(g, d); });
        reel.appendChild(b);
      }
    }
    reel.addEventListener('wheel', (e) => {
      e.preventDefault();
      const now = performance.now();
      if (Math.abs(e.deltaY) < 4 || now - lastWheel < 260 || n < 2) return;
      lastWheel = now;
      slide(g, Math.sign(e.deltaY));
    }, { passive: false });
    reel.addEventListener('pointerdown', (e) => { if (e.button === 0 || e.pointerType !== 'mouse') drag = { g, y: e.clientY, pos: g.to, moved: false }; });
    root.appendChild(el);
    return g;
  });

  // ---- sizes, read from the style sheet: the card, the tab and the gap between them
  let H = 0, T = 0, G = 0;
  function measure() {
    const reel = groups[0].reel;
    G = parseFloat(getComputedStyle(reel).rowGap) || 0;
    T = root.querySelector('.step')?.offsetHeight || 0;
    H = reel.clientHeight - 2 * (T + G);
    return H > 0;
  }

  // where a card sits, `o` slots away from the middle: 0 is the full card, -1 and 1 are the tabs
  function place(c, o) {
    const a = Math.abs(o), f = clamp01(1 - a);
    const top = o <= 0 ? (T + G) * (o + 1) : o <= 1 ? T + G + (H + G) * o : T + G + (H + G) * (o - 1) + T + (H - T) * (2 - o) + G;
    c.style.transform = `translate3d(0,${top.toFixed(1)}px,0)`;
    c.style.height = `${(T + (H - T) * f).toFixed(1)}px`;
    c.style.opacity = clamp01((1.55 - a) / 0.55).toFixed(3);
    // (the tab's name fades out before the card's own text fades in, so the two never show at once)
    c.style.setProperty('--full', clamp01((f - 0.45) / 0.45).toFixed(3));
    c.style.setProperty('--tab', clamp01((0.4 - f) / 0.4).toFixed(3));
    c.classList.toggle('front', a < 0.5);
    c.tabIndex = a < 0.5 ? 0 : -1;
  }

  function render(g) {
    if (!H) return;
    const lo = g.n > 1 ? Math.floor(g.pos) - 2 : 0, hi = g.n > 1 ? Math.ceil(g.pos) + 2 : 0;
    for (const [i, c] of g.items) if (i < lo || i > hi) { c.remove(); g.items.delete(i); }
    for (let i = lo; i <= hi; i++) {
      let c = g.items.get(i);
      if (!c) {
        const id = g.ids[mod(i, g.n)];
        c = document.createElement('button');
        c.className = 'card';
        c.dataset.id = id;
        c.innerHTML = face(id);
        // (a tap on the card in the middle picks that car)
        c.addEventListener('click', () => { if (!swiped && Math.abs(i - g.to) < 0.5) pick(id); });
        g.reel.appendChild(c);
        g.items.set(i, c);
      }
      place(c, i - g.pos);
      c.classList.toggle('sel', c.dataset.id === current && Math.abs(i - g.to) < 0.5);
    }
  }

  function mark() {
    for (const g of groups) {
      const sel = g.ids.includes(current), at = mod(g.to, g.n);
      g.el.classList.toggle('sel', sel);
      g.pips.forEach((p, i) => p.classList.toggle('on', i === at));
    }
  }

  function frame(now) {
    raf = 0;
    let busy = false;
    for (const g of groups) {
      if (drag?.moved && drag.g === g) continue;
      if (g.pos === g.to) continue;
      const k = clamp01((now - g.t0) / SLIDE_MS);
      g.pos = k >= 1 ? g.to : g.from + (g.to - g.from) * (1 - (1 - k) ** 3);
      if (g.pos !== g.to) busy = true;
      render(g);
    }
    if (busy) raf = requestAnimationFrame(frame);
  }
  function glide(g, to) {
    g.to = to; g.from = g.pos; g.t0 = performance.now();
    if (!H || document.hidden) { g.pos = to; render(g); }
    else if (!raf) raf = requestAnimationFrame(frame);
  }

  function pick(id) {
    if (id === current) return;
    current = id;
    mark();
    for (const g of groups) render(g);
    onPick(id);
  }
  function slide(g, d) {
    if (g.n < 2) return pick(g.ids[0]);
    glide(g, g.to + d);
    pick(g.ids[mod(g.to, g.n)]);
    mark();
    render(g);
  }

  // drag: the cards follow the finger, and let go they settle on the nearest car (a short flick still moves one)
  addEventListener('pointermove', (e) => {
    if (!drag || drag.g.n < 2 || !H) return;
    if (e.pointerType === 'mouse' && !e.buttons) return drop(e);   // (the button was let go outside the window)
    const dy = e.clientY - drag.y, g = drag.g;
    if (!drag.moved && Math.abs(dy) < 8) return;
    drag.moved = true;
    g.to = g.pos = drag.pos - Math.max(-1.6, Math.min(1.6, dy / (H + G)));
    render(g);
  });
  function drop(e) {
    if (!drag) return;
    const { g, moved, pos } = drag, dy = e.type === 'pointerup' ? e.clientY - drag.y : 0;
    drag = null;
    if (!moved) return;
    swiped = true;
    setTimeout(() => { swiped = false; }, 0);
    const to = Math.abs(dy) < 24 ? pos : dy < 0 ? Math.max(pos + 1, Math.round(g.pos)) : Math.min(pos - 1, Math.round(g.pos));
    glide(g, to);
    pick(g.ids[mod(to, g.n)]);
    mark();
    render(g);
  }
  addEventListener('pointerup', drop);
  addEventListener('pointercancel', drop);

  // the car changed (or the menu was shown or resized): bring its card to the middle, the short way round
  function sync(id = current) {
    current = id;
    const sized = measure();
    for (const g of groups) {
      const i = g.ids.indexOf(id);
      if (i >= 0 && mod(g.to, g.n) !== i && !(drag?.moved && drag.g === g)) {
        let d = mod(i - g.to, g.n);
        if (d > g.n / 2) d -= g.n;
        glide(g, g.to + d);
      }
      if (sized) render(g);
    }
    mark();
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => sync()).observe(groups[0].reel);
  addEventListener('resize', () => sync());
  sync();

  return {
    sync,
    // the up and down keys slide the picked car's group, left and right step to the next group's car
    slide(d) { const g = groups.find((h) => h.ids.includes(current)) || groups[0]; slide(g, d); },
    step(d) {
      const gi = Math.max(0, groups.findIndex((g) => g.ids.includes(current)));
      const h = groups[mod(gi + d, groups.length)];
      pick(h.ids[mod(h.to, h.n)]);
    },
  };
}
