// The game lives at https://www.linnaring.com. The old kvissuroam.parttime.workers.dev address
// and the bare linnaring.com still reach this same Worker; page loads there are sent on to the
// canonical address with the same path and query.
//
// A browser keeps the driver name, queued laps and best laps per origin, so a plain redirect
// would lose them. A browser opening the page therefore gets a tiny page instead, which reads
// those few values and passes them on in the URL fragment (never sent to a server); the game's
// index.html stores them on arrival. Everything else (curl, crawlers) gets a normal 301.
// /api/* is never redirected, so a game still open on the old address keeps working.
export const CANONICAL = 'www.linnaring.com';
const MOVED_HOSTS = new Set(['kvissuroam.parttime.workers.dev', 'linnaring.com']);

const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inScript = (s) => JSON.stringify(s).replace(/</g, '\\u003c');

export function bridgePage(target) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<link rel="canonical" href="${attr(target)}">
<title>LinnaRing</title>
<style>body{background:#1a0b3b;color:#ff9fd0;font:16px system-ui,sans-serif;text-align:center;padding:20vh 16px}a{color:#7df9ff}</style>
<script>
(function () {
  var t = ${inScript(target)}, h = '';
  try {
    var g = function (k) { return localStorage.getItem('kvissuroam.' + k); };
    var J = function (k) { try { var v = JSON.parse(g(k)); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
    var d = { n: g('name'), c: g('car'), v: g('view'), p: J('pendingLaps').slice(-100) };
    // of the laps driven here only the best per car goes along (it carries the split times)
    var best = {};
    J('laps').forEach(function (l) {
      if (!l || !l.car || !(l.ms > 0)) return;
      var k = l.car + '|' + (l.cp || '');
      if (!best[k] || l.ms < best[k].ms) best[k] = l;
    });
    d.l = Object.keys(best).map(function (k) { return best[k]; });
    var keys = {};
    d.l.forEach(function (l) { keys[l.car + '|' + l.ms] = 1; });
    d.s = J('sentLaps').filter(function (k) { return keys[k]; });
    if (d.n || d.c || d.p.length || d.l.length) {
      var e = encodeURIComponent(JSON.stringify(d));
      if (e.length > 12000) { d.l = []; d.s = []; e = encodeURIComponent(JSON.stringify(d)); }
      if (e.length > 12000) { d.p = d.p.slice(-20); e = encodeURIComponent(JSON.stringify(d)); }
      if (e.length <= 12000) h = '#moved=' + e;
    }
  } catch (e) { /* storage blocked: just go */ }
  location.replace(t + h);
})();
</script>
<noscript><meta http-equiv="refresh" content="0;url=${attr(target)}"></noscript>
</head><body><p>LinnaRing has moved to <a href="${attr(target)}">www.linnaring.com</a></p></body></html>`;
}

// A Response when this request should go to the canonical address, otherwise null.
export function moved(req, url) {
  if (!MOVED_HOSTS.has(url.hostname)) return null;
  const target = `https://${CANONICAL}${url.pathname}${url.search}`;
  if (req.method === 'GET' && req.headers.get('sec-fetch-dest') === 'document') {
    return new Response(bridgePage(target), {
      headers: {
        'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
        'referrer-policy': 'origin', vary: 'Sec-Fetch-Dest',
      },
    });
  }
  return new Response(null, { status: 301, headers: { location: target, 'cache-control': 'public, max-age=3600', vary: 'Sec-Fetch-Dest' } });
}
