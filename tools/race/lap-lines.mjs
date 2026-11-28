// The fast Toomemägi laps' drives the server keeps (src/race/laplines.js), copied to a file of their own:
//   node tools/race/lap-lines.mjs [count]            how many are kept, per car, the last one's time
//   node tools/race/lap-lines.mjs fetch [dir]        appends the ones not yet there to <dir>/runs.ndjson
//                                                    (default /mnt/project-files/toomemagi-lines), a row a drive:
//                                                    { id, at, lap, car, ms, best, n, z } (z: the drive packed as a
//                                                    replay; src/race/replay.js unpack reads it); the lap's id
//                                                    matches /api/laps.json (name, splits, input)
import fs from 'node:fs';
const base = process.env.BASE || 'https://www.linnaring.com', tln = process.env.CITY === 'tallinn';   // CITY=tallinn: Pirita-Kose's
const [cmd = 'count', dir = tln ? '/mnt/project-files/pirita-lines' : '/mnt/project-files/toomemagi-lines'] = process.argv.slice(2);
const get = async (q) => { const r = await fetch(`${base}/api/lines${q}${tln ? `${q ? '&' : '?'}city=tallinn` : ''}`); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };
const c = await get('');
console.log(JSON.stringify(c));
if (cmd === 'fetch') {
  fs.mkdirSync(dir, { recursive: true });
  const file = `${dir}/runs.ndjson`;
  let after = 0;
  if (fs.existsSync(file)) for (const l of fs.readFileSync(file, 'utf8').split('\n')) if (l) after = Math.max(after, JSON.parse(l).id);
  let got = 0;
  for (;;) {
    const { rows } = await get(`?after=${after}&limit=40`);
    if (!rows.length) break;
    fs.appendFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    after = rows[rows.length - 1].id; got += rows.length;
  }
  console.log(`${got} new, up to id ${after}, in ${file}`);
}
