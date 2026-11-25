// Driver names that are racist slurs or common swearing (Martin, 25 Nov 2026): Estonian, English and
// Russian, the Russian in Cyrillic or typed in Latin letters. The server keeps such a name from everyone else
// without saying so (see where `badName` is used in index.js): a new name that is one is ignored,
// a hello under one gets a random name, a lap under one is taken but not kept.
//
// A name is folded before it is compared: lower case, accents off (õ ä ö ü š ž), Cyrillic written
// in Latin letters, the usual digit and symbol look-alikes as letters, and the different Latin
// spellings of the same Russian sound made one (tš, tsh, ch, č, ц, ч: c; sh, š, ш: s; zh, ž, ж: z;
// kh, x, х: h; y: i; w: v). A plain ts stays ts (hats, spits), so tsurka and katsap are listed too. The lists below are written folded. A letter typed several times
// ("niiiggga") still matches: in the ANYWHERE words each letter may repeat.
//
// ANYWHERE words are caught inside a name too, with spaces, dots and underscores taken out
// ("xNiggaX", "n.e.e.g.e.r"). WORDS are short ones that are innocent inside other words (spic in
// spicy, coon in raccoon, hac in Hachiko), so they are caught only as a whole word of the name, as
// typed or with an s or -ov after it: split at spaces, symbols and a small letter followed by a capital ("PakiBoy" is Paki and Boy).
// ALLOWED are real words that hold an ANYWHERE word; they are taken out before the search.

const ANYWHERE = [
  // English
  'nigg', 'nignog', 'niglet', 'niger', 'negr', 'jigaboo', 'porcmonkei', 'junglebunni',
  'vetback', 'tovelhead', 'raghead', 'zipperhead', 'cameljockei', 'spearcucker',
  'tarbabi', 'golliwog', 'darkie', 'redskin', 'kaffir', 'cingcong', 'beaner', 'gippo', 'sandnig',
  // Estonian
  'neeg', 'tibla', 'curka', 'tsurka', 'pilusilm', 'juudikas',
  // Russian (чурка, чучмек, черножопый, черномазый, узкоглазый, кацап, чухна, чухонец, жидовка, жидяра)
  'cucmek', 'cernozop', 'cernomaz', 'uzkoglaz', 'kacap', 'katsap', 'cuhna', 'cuhon', 'zidov', 'zidar', 'pindos',
  // Russian swearing (пизда, блядь, ебать, пидор, мудак, гандон, залупа, говно, долбоёб, нахуй, похуй, хуйло, хуесос)
  'pizd', 'bliat', 'bliad', 'blad', 'iebat', 'iebal', 'iobt', 'eblan', 'zaieb', 'pidor', 'pidar', 'pidr', 'mudak', 'mudil',
  'gandon', 'zalupa', 'govno', 'dolbo', 'nahui', 'pohui', 'huilo', 'huies',
  // hatred of a race by its symbols
  'hitler', 'siegheil', 'vhitepover', 'vhitepride', 'kukluks', 'kukluh',
];
const WORDS = [
  'nig', 'kike', 'gook', 'cink', 'cinki', 'spic', 'spick', 'paki', 'coon', 'vog', 'iid', 'heeb', 'himie', 'injun',
  'kafir', 'jap', 'dago', 'vop', 'kkk', 'rissa',
  // Russian: хач, хачик, жид, хохол, хохлы, москаль, нерусь
  'hac', 'hacik', 'zid', 'zidi', 'hohol', 'hohli', 'moskal', 'moskali', 'nerus',
  // Russian swearing: хуй, сука, сучка, ебло
  'hui', 'suka', 'sucka', 'eblo',
];

// Swearing in English and Estonian (Martin, 25 Nov: the frequent ones). These are matched on a
// plainer fold that keeps sh, ch, y and w as they are (shit would be sit in the fold above).
const SWEAR_ANYWHERE = [
  // English
  'fuck', 'fuk', 'fck', 'fakk', 'cunt', 'shit', 'bitch', 'whore', 'motherf', 'dickhead', 'asshole', 'cocksuck', 'wank',
  'twat', 'pussy', 'slut', 'faggot', 'retard', 'bastard', 'dildo', 'jizz', 'piss', 'penis', 'vagina', 'blowjob',
  // Estonian (perse, sitapea, nussima, pederast, debiilik, mongoloid, munnipea, türapea, "on homo")
  'perse', 'sitapea', 'sitane', 'nussi', 'pederast', 'debiil', 'mongoloid', 'munnipea', 'turapea', 'onhomo', 'putsi',
];
const SWEAR_WORDS = [
  'fag', 'dick', 'cock', 'arse', 'tits', 'cum', 'rape', 'sex', 'wtf', 'stfu',
  'cyka', 'sitt', 'puts', 'tura', 'munn', 'munni', 'pede', 'lits', 'hoor', 'vitt', 'raisk', 'rsk', 'homo', 'homod',
];
const SWEAR_ALLOWED = ['scunth', 'pussycat', 'sperse', 'yperse', 'uperse', 'perseus', 'persev', 'perseph', 'persec', 'shitake',
  'twater', 'twatch', 'pissar', 'fuku', 'nonhomo', 'kapuuts', 'penistone'];
const ALLOWED = ['montenegr', 'stonegr', 'inegr', 'egregi', 'vhittl', 'negroni', 'nigeri', 'niggl', 'niggard', 'zidk', 'docurk', 'antibla', 'ltibla', 'eieba', 'muudak', 'piebal', 'lapidar', 'muddil', 'oblad', 'bladd', 'blade'];
const RAW = ['1488'];                                   // (digits that are not letters here)

const CYR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'z', з: 'z', и: 'i', і: 'i', ї: 'i', й: 'i',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c',
  ч: 'c', ш: 's', щ: 's', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'u', я: 'a', є: 'e', ґ: 'g',
};
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g', '@': 'a', $: 's', '!': 'i', '|': 'i', '€': 'e' };

// one word or name, folded; `digits` false drops digits instead of reading them as letters
function fold(s, digits = true) {
  let t = s.toLowerCase().replace(/tš|tsch|tsh|č|cz|ch/g, 'c').replace(/š|sch|sh/g, 's').replace(/ž|zh/g, 'z');
  t = t.normalize('NFKD').replace(/\p{M}/gu, '');
  t = t.replace(/[а-яёіїєґ]/g, (c) => CYR[c] ?? c);
  t = t.replace(/[0-9@$!|€]/g, (c) => (digits ? LEET[c] ?? '' : ''));
  return t.replace(/[^a-z]/g, '').replace(/kh|x/g, 'h').replace(/y/g, 'i').replace(/w/g, 'v').replace(/q/g, 'k');
}

// the plainer fold for the swear words: accents off and look-alikes as letters, nothing else changed
function plain(s, digits = true) {
  return s.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/[0-9@$!|€]/g, (c) => (digits ? LEET[c] ?? '' : '')).replace(/[^a-z]/g, '');
}

// each letter may repeat: 'neeg' matches "neeeeggg" but not "neg"
const loose = (w) => w.replace(/(.)\1*/g, (run, c) => `${c}{${run.length},}`);
const ANY_RE = new RegExp(ANYWHERE.map(loose).join('|'));
const WORD_RE = new RegExp(`^(?:${WORDS.join('|')})(?:s|ov)?$`);
const ALLOW_RE = new RegExp(ALLOWED.map(loose).join('|'), 'g');
const SWEAR_RE = new RegExp(SWEAR_ANYWHERE.map(loose).join('|'));
const SWEAR_WORD_RE = new RegExp(`^(?:${SWEAR_WORDS.join('|')})s?$`);
const SWEAR_ALLOW_RE = new RegExp(SWEAR_ALLOWED.map(loose).join('|'), 'g');

export function badName(name) {
  const s = String(name ?? '');
  if (!s) return false;
  if (RAW.some((r) => s.replace(/\D/g, '').includes(r))) return true;
  for (const digits of [true, false]) {
    if (ANY_RE.test(fold(s, digits).replace(ALLOW_RE, '-'))) return true;
    if (SWEAR_RE.test(plain(s, digits).replace(SWEAR_ALLOW_RE, '-'))) return true;
    const words = s.replace(/([\p{Ll}])(\p{Lu})/gu, '$1 $2').split(/[\s_.,:;'"`*+\-\/\\()[\]{}~^#%&=?<>]+/);
    for (const w of words) {
      const f = fold(w, digits), g = plain(w, digits);
      if ((f && WORD_RE.test(f)) || (g && SWEAR_WORD_RE.test(g))) return true;
    }
  }
  return false;
}
