// The pool for a new player's name: one word from each list, "NeonOtter" (the server adds two digits
// when all tries are taken). Shared by the server (worker/index.js freshName) and the page's offline
// fallback. Vaporwave words (Martin, 2026-11-25: more variety). Each word at most 9 letters, so a
// name with its two digits stays inside the 20 a name may have.
export const ADJ = [
  'Neon', 'Chrome', 'Turbo', 'Pastel', 'Laser', 'Sunset', 'Retro', 'Velvet', 'Cosmic', 'Digital',
  'Synth', 'Vapor', 'Electric', 'Midnight', 'Magenta', 'Cyber',
  'Aqua', 'Holo', 'Lofi', 'Pixel', 'Glitch', 'Dream', 'Prism', 'Plasma', 'Hyper', 'Ultra',
  'Mega', 'Astro', 'Lunar', 'Solar', 'Crystal', 'Teal', 'Violet', 'Lilac', 'Coral', 'Peach',
  'Mint', 'Glossy', 'Shiny', 'Hazy', 'Wavy', 'Dusky', 'Liquid', 'Analog', 'Stereo', 'Sonic',
  'Disco', 'Tropic', 'Miami', 'Nova', 'Opal', 'Pearl', 'Silk', 'Static', 'Virtual', 'Vector',
];
export const NOUN = [
  'Otter', 'Falcon', 'Lynx', 'Comet', 'Dolphin', 'Palm', 'Flamingo', 'Tiger', 'Wave', 'Fox',
  'Moose', 'Heron', 'Beaver', 'Hedgehog', 'Stork', 'Badger',
  'Panther', 'Jaguar', 'Cobra', 'Gecko', 'Koi', 'Swan', 'Orca', 'Manta', 'Parrot', 'Seahorse',
  'Pegasus', 'Unicorn', 'Sphinx', 'Statue', 'Marble', 'Column', 'Arcade', 'Cassette', 'Tape', 'Floppy',
  'Mall', 'Lagoon', 'Dusk', 'Horizon', 'Grid', 'Orchid', 'Lotus', 'Cherry', 'Mango', 'Melon',
  'Cruiser', 'Drifter', 'Rider', 'Ghost', 'Dreamer', 'Pilot', 'Skyline', 'Fountain', 'Galaxy', 'Nebula',
];
