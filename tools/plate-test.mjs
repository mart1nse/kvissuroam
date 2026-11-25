// Number plates (src/net/plates.js) and the filter the server puts them through (worker/index.js okPlate).
// node tools/plate-test.mjs (no server needed).
import { cleanPlate, typedPlate } from '../src/net/plates.js';
import { badName } from '../worker/badnames.js';

const okPlate = (s) => { const p = cleanPlate(s); return p && !badName(p) && !badName(p.slice(4)) ? p : ''; };
const typed = [['123abc', '123 ABC'], ['123 a b c', '123 ABC'], ['ab12', '12'], ['1234', '123'], ['123 õäö', '123 ÕÄÖ'], ['123ABCD', '123 ABC'], ['019 tdi', '019 TDI'], ['12a', '12']];
const good = ['123 ABC', '019 TDI', '777 ŽÜÄ', '000 ÕÕÕ', '420 BHR'];
const bad = ['123 SEX', '666 FUK', '000 NIG', '100 KKK', '123 FCK', '12 ABC', '123 AB', '1234 ABC', '123 A1C', 'ABC 123', '', null, 7];
let fail = 0;
for (const [i, o] of typed) if (typedPlate(i) !== o) { fail++; console.log('typed', i, '->', typedPlate(i), 'not', o); }
for (const p of good) if (okPlate(p) !== p) { fail++; console.log('refused', p); }
for (const p of bad) if (okPlate(p)) { fail++; console.log('taken', p); }
console.log(fail ? `${fail} wrong` : 'plates ok');
process.exit(fail ? 1 : 0);
