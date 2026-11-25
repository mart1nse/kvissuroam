// A player's own number plate (Martin, 25 Nov 2026): "123 ABC", three digits, a space and three letters, as on
// an Estonian plate, with the Estonian letters Õ Ä Ö Ü Š Ž allowed too. Typed in the garage on a computer
// (phones keep each car's own plate), sent once with the name and shown on that player's car to everyone.
// Shared by the page and the server (worker/index.js), so both read a plate the same way.

const LETTER = 'A-ZÕÄÖÜŠŽ';
const FULL = new RegExp(`^[0-9]{3} [${LETTER}]{3}$`, 'u');
const IS_LETTER = new RegExp(`^[${LETTER}]$`, 'u');

// a whole plate as the others may get it ('' if it is not one)
export function cleanPlate(s) {
  if (typeof s !== 'string') return '';
  const t = s.normalize('NFC').toUpperCase().replace(/\s+/g, ' ').trim();
  return t.length === 7 && FULL.test(t) ? t : '';
}

// what the plate box shows while it is typed: three digits first, then three letters, the space put in by
// itself ("123abc" and "123 a b c" are "123 ABC"; anything else, and letters before the digits, is left out)
export function typedPlate(s) {
  let digits = '', letters = '';
  for (const c of String(s ?? '').normalize('NFC').toUpperCase()) {
    if (c >= '0' && c <= '9') { if (digits.length < 3 && !letters) digits += c; }
    else if (digits.length === 3 && letters.length < 3 && IS_LETTER.test(c)) letters += c;
  }
  return letters ? `${digits} ${letters}` : digits;
}
