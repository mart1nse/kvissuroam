// The racist-slur name filter (worker/badnames.js): names it must catch and innocent ones it must not.
// node tools/badname-test.mjs (no server needed). Add a name here when a player finds a way around it.
import { badName } from '../worker/badnames.js';

const bad = ['nigger', 'NiGgA', 'n1gg3r', 'n i g g e r', 'xXniggaXx', 'Neeger', 'neegrid', 'NEEEGER', 'ниггер', 'негр',
  'Negr', 'Tšurka', 'tsurka', 'tshurka', 'чурка', 'churka', 'хач', 'Khach', 'Xach_Boy', 'жид', 'Zhidovka', 'chernozhopiy',
  'черножопый', 'uzkoglazy', 'katsap', 'кацап', 'chukhna', 'чухонец', 'tibla', 'TIBLA666', 'Pilusilm', 'juudikas',
  'PakiBoy', 'spic', 'Spics', 'chink', 'Chinky', 'gook', 'kike', 'kyke', 'coon', 'wetback', 'towelhead', 'raghead',
  'sandnigger', 'jiggaboo', 'porch monkey', 'Hitler', 'Sieg Heil', 'WhitePower', 'KKK', '1488', 'ryssä', 'hohol',
  'Хохлы', 'moskal', 'pindos', 'nіgger', 'ｎｉｇｇｅｒ', 'Jap', 'yid',
  // swearing (25 Nov)
  'FuckYou', 'fakk', 'ShitLord', 'b1tch', 'cunt', 'Motherfucker', 'Dick', 'perse', 'Sitapea', 'Põrka veel rsk', 'Raisk',
  'türapea', 'Debiilik', 'mongoloid', 'Vuntsonhomo', 'pederast', 'блядь', 'Blyat', 'cyka', 'suka', 'хуй', 'nahui', 'pizdec',
  'пидор', 'mudak', 'gandon', 'долбоёб', 'govno'];
const good = ['Montenegro', 'Montenegrin', 'Negroni', 'Nigeria', 'Niggle', 'niggardly', 'spicy', 'Raccoon', 'Tycoon',
  'Cocoon', 'Hachiko', 'Hachi', 'Khachapuri', 'Clarissa', 'Japan', 'Japp', 'Moskalenko', 'Gogol', 'mustikas', 'Zhidkiy',
  'дочурка', 'Kuklus', 'Snickers', 'Wogan', 'Dagobert', 'Heebie', 'hats', 'spits', 'antiblack', 'multiblade', 'whittler',
  'winegrower', 'egregious', 'Vinegar', 'stoneground', 'Kolja', 'Vasja', 'VaporHeron', 'V4TYPE-R', '420BHR', 'M1ndFr3ak',
  'Blade', 'обладает', 'слуха', 'Perseus', 'superset', 'hypersonic', 'disperse', 'raiskamine', 'muudaks', 'kapuutsiga', 'kung-fu',
  'põrn', 'äss', 'Kurat', 'su ema', 'Scunthorpe', 'Peacock', 'Dickens', 'Cocktail', 'homogeneous', 'lapidary', 'piebald',
  'eyeball', 'outwatch', 'Sussex', 'Pissarro', 'Penistone', 'fakir', 'Fukuoka', 'Assassin', 'Classic'];

const missed = bad.filter((n) => !badName(n)), wrong = good.filter(badName);
console.log(`caught ${bad.length - missed.length}/${bad.length}, innocent wrongly caught ${wrong.length}/${good.length}`);
if (missed.length) console.log('MISSED:', missed.join(', '));
if (wrong.length) console.log('WRONGLY CAUGHT:', wrong.join(', '));
process.exit(missed.length || wrong.length ? 1 : 0);
