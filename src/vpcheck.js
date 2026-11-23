// ?vp=1 (or ?vp=cover / ?vp=plain, which also pick the viewport, see index.html): rulers along the edges and the
// sizes the browser reports, to see on a phone which part of the page is on screen. A red frame is the page's own
// edge, a green one the safe area (env(safe-area-inset-*)), and the numbers along the top and bottom are CSS pixels
// from the page's left edge: the first number that shows on the left is how much of the page is cut off there.
export function vpCheck() {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;z-index:99;pointer-events:none;font:10px/1 monospace;color:#fff';
  const frame = '<div style="position:absolute;inset:0;border:2px solid #f33"></div>' +
    '<div style="position:absolute;top:env(safe-area-inset-top);right:env(safe-area-inset-right);bottom:env(safe-area-inset-bottom);left:env(safe-area-inset-left);border:2px dashed #3f6"></div>' +
    '<div id="vpsafe" style="position:absolute;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)"></div>';
  let ticks = '';
  for (let x = 0; x <= 1400; x += 25) {
    const big = x % 50 === 0;
    for (const end of ['top', 'bottom']) {
      ticks += `<div style="position:absolute;${end}:0;left:${x}px;width:1px;height:${big ? 14 : 7}px;background:#ff0"></div>`;
      if (big) ticks += `<div style="position:absolute;${end}:15px;left:${x + 2}px;background:#000a;padding:1px">${x}</div>`;
    }
  }
  const info = document.createElement('pre');
  info.style.cssText = 'position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);margin:0;padding:6px 8px;background:#000c;font:11px/1.3 monospace;white-space:pre';
  box.innerHTML = frame + ticks;
  box.append(info);
  document.body.append(box);
  const show = () => {
    const vv = window.visualViewport, cs = getComputedStyle(document.getElementById('vpsafe'));
    const r = (n) => Math.round(n * 10) / 10;
    info.textContent = [
      `inner ${innerWidth} x ${innerHeight}   outer ${outerWidth} x ${outerHeight}`,
      `client ${document.documentElement.clientWidth} x ${document.documentElement.clientHeight}   screen ${screen.width} x ${screen.height}`,
      vv ? `visual ${r(vv.width)} x ${r(vv.height)} at ${r(vv.offsetLeft)},${r(vv.offsetTop)} page ${r(vv.pageLeft)},${r(vv.pageTop)} x${r(vv.scale)}` : 'no visualViewport',
      `scroll ${scrollX},${scrollY}   dpr ${devicePixelRatio}   angle ${screen.orientation?.angle ?? window.orientation}`,
      `safe t ${cs.paddingTop} r ${cs.paddingRight} b ${cs.paddingBottom} l ${cs.paddingLeft}`,
      `viewport: ${document.querySelector('meta[name="viewport"]').content.includes('cover') ? 'cover' : 'plain'}   standalone ${matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true}`,
      navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 90),
    ].join('\n');
  };
  show();
  for (const ev of ['resize', 'orientationchange', 'scroll']) addEventListener(ev, () => setTimeout(show, 50));
  window.visualViewport?.addEventListener('resize', show);
  window.visualViewport?.addEventListener('scroll', show);
  setInterval(show, 1000);
}
