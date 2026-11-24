# LINNARING perf history

Nightly results of `node tools/perf-budget.cjs` on `main` (iPhone 13 emulation + desktop, headless). Figures in MB unless marked ms; budgets from `tools/perf-budget.json`. One JSON per run in `runs/`.

Reference before this log: baseline after PR #294 (20 Nov 2026) was phone canvases 198, card 220, heap 333, total 751 MB at DRIVE; jump card peak 247; desktop 12.9 ms.

## 2026-11-21 (main 8911e22, run 01:19 UTC)

| Check | Figure | Budget | |
|---|---|---|---|
| Phone canvases at DRIVE | 108 | 230 | OK |
| Phone graphics card at DRIVE | 184 | 250 | OK |
| Phone JS heap at DRIVE | 339 | 420 | OK |
| Phone total at DRIVE | 631 | 820 | OK |
| Phone peak in 5 s after DRIVE (garbage incl.) | 642 | 740 | OK |
| Phone graphics card peak in a map jump | 212 | 280 | OK |
| Phone card growth over 3 car changes | 1 | 20 | OK |
| Desktop game code per frame (ms) | 10.6 | 18 | OK |

All within budget. First run in this log; against the 20 Nov baseline the phone total at DRIVE fell 751 -> 631 MB (canvases 198 -> 108), heap rose 333 -> 339.

Commits merged to main in the 24 h before the run:

- 8911e22 Riia strip road paint: drop the zebras the Street View shots don't show (#371)
- 85e5e4b Riia railway underpass: ribbed concrete soffit and wall vents from the "43 Riia" shot (#370)
- 56594a0 Riia strip batch 9: Ravila from Tulika to Viljandi mnt, the Maarjamõisa Coop (#369)
- 261394d Riia strip batch 8: Ravila campus, the Nooruse corner institute, Chemicum and Biomedicum (#368)
- 937455e Riia strip batch 7: Ravila from Riia to Nooruse, houses 3-15 and 4-14 (#367)
- 40a532f Speed room halfway back: echoes +1.6 dB, reverb +2.3 dB at top speed (was +3.2/+4.6) (#366)
- 4206d21 Riia strip batch 6: Riia 94-122 fronts from the Street View shots (#365)
- b4cc339 Orident glass corner breaks: shattering panes, roller blinds, dented frame, corner cut 5 cm less (#364)
- 799008d Riia strip batch 5: Suur kaar to the Ravila lights, Riia 78-95 (#363)
- 9c2e6a5 Say when the browser holds the game at 30 FPS (battery saver), and judge afresh when the charger changes (#362)
- 067bd21 Vanemuise / Ülikooli: round pavement corner by the theatre park (#361)
- 1723aa0 More room as the revs near the limiter, V1 after downshifts (#360)
- 944c11f Riia strip batch 4: Väike kaar to Suur kaar, Riia 50-77 and Selver ABC (#359)
- c51c776 Vanemuise: no grey cover beside the lane, flush granite line, steps clear of the ground on the 4 m grid (#358)
- b9ba57c Vanemuine steps start from level ground (#357)
- 0711503 Riia strip batch 3: Lembitu to Väike kaar, Riia 30-59 and the Coop pylon (#356)
- bad7ce9 Turu tänav road paint: hatched island Soola to Sadama, no centre lines on side lanes (#355)
- 7c60298 Kaluri lane and the car park behind Circle K and McDonald's, with rows of BMWs (#354)
- f34a362 Turu tänav batch 6: Aleksandri 8a/8b, 10, 12 and the Dorpat hotel (#353)
- 5864070 Riia strip batch 2: Aparaaditehas, Hektor, Riia 29a-43, the railway bridge and the radio mast (#352)
- 6b32b09 Vanemuine concert house front: drivable steps and terrace, bays up to the steps, square wall foot, no white arc (#351)
- 76aa704 Katoliku: drivable red mound, school collision matches its walls (#350)
- 09abc0a Turu tänav batch 5: south stretch to the Sõpruse bridge (#349)
- 3adc0da Turu tänav batch 4: Aura, Zeppelin and its car park, Turu 9 and 11 (#348)
- 841a533 Merge pull request #347 from mart1nse/claude/project-thread-qwim8i
- b9e8227 Fix understeer push on spinning rear wheels at full lock, and the double 1>2 upshift
- 4d7a8cd Riia strip batch 1: Riia Kvartal, Riia 24, university side, Pauluse church from Street View (#346)
- 3843a8c Traffic signs show a plain grey back instead of their mirrored face (#345)
- 9e68ea7 Kaubamaja median moves onto the line of the median up Riia (#344)
- cf796e0 Turu tänav batch 3: AHHAA and its rocket plaza, the Turu 8 halls, Tigutorn (#343)
- d1c964e Bus shelters: crash through only at 30 km/h or more (#342)
- 6f7693f Vabadussild LEDs: glow and rays, all change together, 4 s fades, arch a touch darker (#341)
- f1bd914 Delta stops flickering from Lai; colour-fading LED lights on Vabadussild's arch (#340)
- bfd66ab One row of bollards along the Vanemuise taxi bays, bending to the roadside at the end (#339)
- 0088d88 Merge pull request #338 from mart1nse/claude/project-thread-i9uo7r
- de8df4d 1st to 2nd: the swing 30 % smaller again
- ec7f84c Turu tänav batch 2: Soola and Kaluri (Kaluri 2, hotel, glass office, Tasku's Soola side) (#337)
- d5985a9 Turu tänav batch 1: the Soola corner from Street View (Swedbank, Circle K, McDonald's, Turu 3-7) (#336)
- f05e68c Nõela, Pihlaka: Carrera GT turned 90 degrees to the right (#335)
- 08d2548 Merge pull request #334 from mart1nse/claude/project-thread-xoz52t
- bdbc275 Merge remote-tracking branch 'origin/main' into claude/project-thread-xoz52t
- e3f272b Gravel roads: beige crushed stone, a few small stones, wheel tracks
- eced9ff Bus shelters: crash through the long sides at 20 km/h or more (#333)
- dcfa0d6 Riia start: median kerbs on the ground, Kvartal wall stops flickering, trees and railing off the road (#332)
- 851968b Nõela, Pihlaka: Carrera GT on the paved yard in place of the estate car (#331)
- 1ca2b4f Merge pull request #330 from mart1nse/claude/project-thread-n9q5aw
- 2f6c655 Bus shelters: a car can nose in from the open side that faces the road
- 38e7b36 Move the Alexela, McDonald's and Decora pylons off the road and cycle path (#329)
- 19a9d2d Veski/Oru: old church-side wall back on the lap, Oru open between villa and church, no corner slab (#328)
- 2599535 Take the two parked taxis off Vanemuise tn beside the lap road (#327)
- ca6d151 Road lines round Lõunakeskus to Sõinaste match the real roads (#326)
- dfabe4d Riia road houses from Riia 128 to Sõinaste, from air photos (#325)
- 70d60ee K-Rauta, the Riia 140 yard, Selver Teemandi, Tammetõru and Aasta Auto (#324)
- 2b917d1 Ringtee and Riia junction: Alexela, Decora, Stokker, Spektri 6, Aardla 113, Olerex (#323)
- 2ceaf51 Valguse and Optika strip by Lõunakeskus from Street View and air photos (#322)
- dbd621e Lõunakeskus, Hotel Sophia and Teaduspark from Street View and air photos (#321)
- bc652c9 Catholic church at Veski 3 and the villa at Veski 5 from Street View and air photos (#320)
- 67f6caf Laptops: far ground in culled tiles, coarser below full sharpness; at most ~80 fps on fast screens (#319)


## 2026-11-22 (main 6217336, run 02:02 UTC)

| Check | Figure | Budget | |
|---|---|---|---|
| Phone canvases at DRIVE | 99 | 230 | OK |
| Phone graphics card at DRIVE | 184 | 250 | OK |
| Phone JS heap at DRIVE | 264 | 420 | OK |
| Phone total at DRIVE | 547 | 820 | OK |
| Phone peak in the 5 s after DRIVE, garbage included | 646 | 740 | OK |
| Phone graphics card peak in a map jump | 185 | 280 | OK |
| Phone graphics card growth after 3 car changes and back to the first car | 1 | 20 | OK |
| Phone graphics card peak during the car changes | 201 | 250 | OK |
| Phone total after 2 km through the centre | 810 | 870 | OK |
| Phone graphics card peak through the centre | 407 | 445 | OK |
| Graphics level tests failing (saved level, crash guard) | 0 | 0 | OK |
| Lowest graphics level at the Riia and Turu junction: pieces drawn in a frame | 352 | 460 | OK |
| Lowest graphics level at the Riia and Turu junction: triangles in a frame (thousands) | 562 | 760 | OK |
| Desktop drive through the centre: times the game was busy for over 0.1 s | 0 | 2 | OK |
| Desktop drive: longest the game was busy without a break (ms) | 59 | 150 | OK |
| Desktop drive: time in busy stretches over 50 ms (s) | 0.06 | 1.2 | OK |
| Desktop drive: gaps between frames over 0.1 s | 1 | 3 | OK |
| Desktop drive: game code per frame, 95th percentile (ms) | 7.1 | 12 | OK |
| Desktop drive: page errors | 0 | 0 | OK |
| Desktop drive: building work queued twice | 0 | 0 | OK |
| Desktop drive: longest gap between frames (ms), not judged | 139 | - | not judged |
| Phone drive through the centre: times the game was busy for over 0.1 s | 0 | 2 | OK |
| Phone drive: longest the game was busy without a break (ms) | 61 | 150 | OK |
| Phone drive: time in busy stretches over 50 ms (s) | 0.06 | 1.2 | OK |
| Phone drive: gaps between frames over 0.1 s | 1 | 3 | OK |
| Phone drive: game code per frame, 95th percentile (ms) | 5.7 | 10 | OK |
| Phone drive: page errors | 0 | 0 | OK |
| Phone drive: building work queued twice | 0 | 0 | OK |
| Phone drive: longest gap between frames (ms), not judged | 127 | - | not judged |

All within budget. Against the 21 Nov 01:19 run: phone total at DRIVE 631 -> 547 MB (heap 339 -> 264, canvases 108 -> 99), map jump card peak 212 -> 185, 5 s spike 642 -> 646. Nothing grew by more than 10 %. Both 4.5 km drives: no busy stretch over 0.1 s, longest 59 ms (desktop) and 61 ms (phone). New since the last log entry: phone after 2 km through the centre 810 MB (budget 870), card peak there 407 (445), lowest level at Riia/Turu 352 pieces and 562k triangles.

Commits merged to main in the 24 h before the run:

- 6217336 Short cut: only the checkpoint order cancels the lap (#416)
- 881f726 Short cuts cancel the lap (Jakobi cut past the Emajõe loop) (#415)
- 5f7f1cd Online list dots take each player's map arrow colour, a bit bigger (#414)
- 355b803 Countdown heading reads TO RACE START (#413)
- 4edc3e9 Race button: say when drivers on the map are on an old page (#412)
- acdfd1c Light anti-lock brakes for the RAV4 and the Mazda 6 (#411)
- 88e0178 Race finish splash: lap record shown as the record banner's two parts (#410)
- 9a1341c Lap record banner, record line on the race finish splash, tag and sound for the others (#409)
- 16e323a Finish halo ends at the underside of the START · FINISH banner (#408)
- 7afd318 Start billboard says LAP START, line under it removed (#407)
- d0f953d Race: finish splash with your place, glowing finish frame, quieter END RACE? (#406)
- e8a1722 Wheelspin howl about 18 dB louder (gain 0.05 -> 0.4), own car and other players (#405)
- 54de8b0 Race HUD tweaks: compact live list, ✕ ends a solo race, bigger JOIN, smaller race button (#404)
- 9e72bf9 Race button: ask for the race state until it arrives (#403)
- a54da74 Online race mode: vote to start, grid on Küüni, five red lights, one-lap race, live list and results (#402)
- 5f8113f After a quick lift mid donut the hold comes back gently (200 Avant and all cars) (#401)
- ed770e0 Parked cars: detailed models a third of the size, arrays let go once on the card (#400)
- 5ce2708 Floored at low speed, traction control lets the tyres spin (Carrera GT, M3) (#399)
- 6abc4ec Parked cars: pictures kept packed, unpacked when a car is first seen close up (#398)
- 9926d8f Donut from a run: the slide carries through instead of stopping dead (#397)
- dfc19c4 No hiccup mid swing in figure eights (#396)
- befc277 Phones: pictures of places left behind rest, GETTING READY on map clicks and respawns (#395)
- 06f9be1 Remove the "The car has sunk." line from the sunk screen (#394)
- 7192907 No flick in figure eights or after a brief lift mid donut (#393)
- e3f48a3 Old computers and phones: less work before each frame, building in finer steps, memory through the centre in the perf check (#392)
- 4518f31 Phones keep their memory-safe graphics level across the extra low update (#391)
- 142111f Softer start of the tail step-out: the donut hold's first push is gentler and builds up slowly (#390)
- 93444aa Stealth mode ?off=100: hidden from other players (#389)
- 00e8f8f No tail flick from a near standstill: the donut hold pushes only once the car gathers pace (#388)
- 02e3e42 Thin barriers collide as exact boxes: no more getting stuck in rails, dividers and walls (#387)
- c847196 The end of a slide out of a donut fades out instead of snapping straight (#386)
- a927971 Freeze frames: parked scans wear half-size pictures, ten places build in steps, cheaper kerb and lap lookups (#385)
- e8d48d5 Game comes back whole after switching apps on a phone (no more black houses) (#384)
- 8143466 Out of a donut, the car stops soon after it straightens (#383)
- 00d02be Phone lap board: your last laps on the left, 5 latest laps by everyone beside them (#382)
- fbf2128 Burnout brake stays on when a slide swings the car backwards (#381)
- 86fab88 Scanned car bodies stay sharp after a car change on phones and in light mode (#380)
- 4b41951 No long-press buzz when holding the touch pedals (#379)
- 1d23899 Online players list on phones (#378)
- 371be41 Braking out of a donut slides on about twice as long (#377)
- dd4eeaa Extra low graphics for old computers; building keeps pace with slow frames; start waits for the picture (#376)
- 84269ec Burnout out of a donut keeps its slide, then straightens and stops (#375)
- 7e7c1d6 Standing burnouts for rear-driven cars, calmer low-speed tail flicks (#374)
- 2c7db62 Perf check: test drives that catch freeze frames; smaller house-front pages; three places built in steps (#373)
- 18fb913 Freeze frames while driving: work queue, warmer, lighter builds (#372)

## 2026-11-23 (main cbd4016, runs 01:18 and 01:30 UTC)

The first run had one figure over; the second run (`--force`, same commit) was all inside.

| Check | Run 1 | Run 2 | Budget | Run 1 | Run 2 |
|---|---|---|---|---|---|
| Phone canvases at DRIVE | 139 | 139 | 230 | OK | OK |
| Phone graphics card at DRIVE | 187 | 187 | 250 | OK | OK |
| Phone JS heap at DRIVE | 266 | 267 | 420 | OK | OK |
| Phone total at DRIVE | 592 | 593 | 820 | OK | OK |
| Phone peak in the 5 s after DRIVE, garbage included | 637 | 634 | 740 | OK | OK |
| Phone graphics card peak in a map jump | 188 | 188 | 280 | OK | OK |
| Phone graphics card growth after 3 car changes and back to the first car | 1 | 1 | 20 | OK | OK |
| Phone graphics card peak during the car changes | 204 | 204 | 250 | OK | OK |
| Phone total after 2 km through the centre | 947 | 834 | 870 | OVER | OK |
| Phone graphics card peak through the centre | 424 | 422 | 445 | OK | OK |
| Graphics level tests failing (saved level, crash guard) | 0 | 0 | 0 | OK | OK |
| Lowest graphics level at the Riia and Turu junction: pieces drawn in a frame | 338 | 357 | 460 | OK | OK |
| Lowest graphics level at the Riia and Turu junction: triangles in a frame (thousands) | 546 | 576 | 760 | OK | OK |
| Desktop drive through the centre: times the game was busy for over 0.1 s | 0 | 0 | 2 | OK | OK |
| Desktop drive: longest the game was busy without a break (ms) | 35 | 66 | 150 | OK | OK |
| Desktop drive: time in busy stretches over 50 ms (s) | 0 | 0.12 | 1.2 | OK | OK |
| Desktop drive: gaps between frames over 0.1 s | 0 | 0 | 3 | OK | OK |
| Desktop drive: game code per frame, 95th percentile (ms) | 6.7 | 6.2 | 12 | OK | OK |
| Desktop drive: page errors | 0 | 0 | 0 | OK | OK |
| Desktop drive: building work queued twice | 0 | 0 | 0 | OK | OK |
| Desktop drive: longest gap between frames (ms), not judged | 64 | 73 | - | not judged | not judged |
| Phone drive through the centre: times the game was busy for over 0.1 s | 0 | 0 | 2 | OK | OK |
| Phone drive: longest the game was busy without a break (ms) | 57 | 46 | 150 | OK | OK |
| Phone drive: time in busy stretches over 50 ms (s) | 0.06 | 0 | 1.2 | OK | OK |
| Phone drive: gaps between frames over 0.1 s | 0 | 0 | 3 | OK | OK |
| Phone drive: game code per frame, 95th percentile (ms) | 5.7 | 5.8 | 10 | OK | OK |
| Phone drive: page errors | 0 | 0 | 0 | OK | OK |
| Phone drive: building work queued twice | 0 | 0 | 0 | OK | OK |
| Phone drive: longest gap between frames (ms), not judged | 59 | 59 | - | not judged | not judged |
| Lap drive round the race track: times the game was busy for over 25 ms | 4 | 3 | 8 | OK | OK |
| Lap drive: times the game was busy for over 33 ms | 1 | 1 | 4 | OK | OK |
| Lap drive: longest the game was busy without a break (ms) | 37 | 40 | 100 | OK | OK |
| Lap drive: frames whose game code took over 33 ms | 0 | 0 | 2 | OK | OK |
| Lap drive: house fronts painted on the way (megapixels) | 31.2 | 31.2 | 36 | OK | OK |
| Lap drive: pictures sent to the graphics card (megapixels) | 141 | 141 | 165 | OK | OK |
| Lap drive: frames that sent over 1.1 megapixels of pictures | 4 | 4 | 10 | OK | OK |
| Lap drive: most megapixels of pictures sent in one frame | 1.76 | 1.39 | 2 | OK | OK |
| Lap drive: page errors | 0 | 0 | 0 | OK | OK |
| Lap drive: building work queued twice | 0 | 0 | 0 | OK | OK |
| Lap drive: times the game was busy for over 16 ms, not judged | 20 | 19 | - | not judged | not judged |
| Lap drive: frames whose game code took over 16.7 ms, not judged | 8 | 2 | - | not judged | not judged |
| Lap drive: game code in a frame, the longest (ms), not judged | 23 | 19 | - | not judged | not judged |

Run 1 OVER: phone total after 2 km through the centre 947 MB (budget 870). Run 2: 834. The whole difference is painted canvases still held at the moment of measuring (165 MB in run 1, 58 in run 2; graphics card 416 vs 412, heap 366 vs 364): in run 1 the house-front pages (houseskin.js 57 MB, plus 22 MB being painted at houseskin.js:410), sector signs (signs.js 22 MB) and road paint (roadtex.js 13 MB) of places just passed had not yet been cut down or let go. So it is timing of the reading, not a commit; no fix made. The check itself reads canvases at one instant, which makes this figure jump by about 100 MB between runs: left for Martin to decide whether to measure it differently.

Against the 22 Nov 02:02 run: phone total at DRIVE 547 -> 592 MB (canvases at DRIVE 99 -> 139, +40 %: biggest makers houseskin pages 23, signs.js 11, keskus letters 11 MB). Centre total 810 -> 834 (run 2). Both 4.5 km drives: no busy stretch over 0.1 s, longest 35/66 ms desktop, 57/46 ms phone. Lap (first time in this log): 4 and 3 stretches over 25 ms, 141 MP sent to the card, most in one frame 1.76/1.39 MP.

Commits merged to main in the 24 h before the run:

- cbd4016 Tyres squeak now and then on paving: low groans, squeals and chirps, never the same pitch twice (#517)
- c3781ad Round borderless buttons and choices everywhere: garage cards, menu row, options, lap times, city map, controller setup (#516)
- d0b215b Reverse: a slipping clutch at up to the drop revs, so it no longer bogs (#515)
- 09c4119 Inward steering is the default; ?inward=0 turns it off (#514)
- b78e65b Smoother grass and dirt tyre marks: pressed grass, soil tear that grows with the slide (#513)
- f9adbef A touch of the slipping clutch on the 22B (0.15) and a bit more on the 200 Avant (0.3) (#512)
- 3d255a6 ?inward=1: ceiling halfway between Martin's second and third drawings (#511)
- 655f93b ?inward=1: Martin's third ceiling drawing, and the wheels stay on the line (#510)
- b573fc6 Manual starts by default: clutch drop for every car with an engine, slipping clutch on the F40 (#509)
- 561612e ?inward=1: Martin's second ceiling drawing, and wheels come back twice as fast (#508)
- cb4b3de ?inward=1: inward lock follows Martin's drawn ceiling (full to 60 km/h, easing to 1.5 deg at 170) (#507)
- 7f57c01 ?launch=1&slip=1: a turbo engine is held where its boost is full (F40 4300 rpm) (#506)
- 29d2e9b ?slip=1 with ?launch=1: floored in first the clutch keeps slipping at the drop revs (trial) (#505)
- 6b31cee ?inward=1: judge countersteering by the rotation, not the slide angle (#504)
- ceeefc5 Tyre marks on every ground: hand-laid paving and cobbles, grass, gravel, mud onto tarmac (#503)
- cb46703 TOREPOOD poster on both faces, on the Emajõe shelter, and clickable after a crash (#502)
- ea4b1ac ?launch=1: every car with an engine pulls away like a manual, clutch dropped at a third of the redline (trial) (#501)
- 7a2bc1c ?inward=1: wheels wound in past the grip lock come back quickly when let go (#500)
- d95cec7 ?launch=1: the F40 pulls away like a manual from idle, no torque converter (trial) (#499)
- 65ee879 A touch of ABS (0.2) for the 190E, CR-V, Enyaq and bZ4X: every car now has some (#498)
- 207affb A touch of ABS (0.2) for the F40, M3 and Carrera GT (#497)
- ad82d1f ?inward=1: a held key turns the wheels in past the speed's grip lock (trial) (#496)
- 3fad1d4 Race grid: 4WD cars rev on the limiter with the clutch in, clutch drop at the lights (#495)
- d6cf243 Vallikraavi: take away the parked BMW estate by the bins (racing line) (#494)
- 1bd2767 Wheelspin howl a touch louder (gain 0.4 -> 0.55, about +3 dB) (#493)
- ab6a4ac /stats: Online now list (#492)
- d38f81c Veski 20 picket fence breaks; light wood-snap sound for it and the Lai corner fence (#491)
- 3b7908b Turn-in give-way is the default steering; ?turnin=normal brings back the old (#490)
- 2ed7a26 Bus stops: clickable TOREPOOD poster (Yaga shop) on every shelter (#489)
- e1e6511 /stats: online race stats (#488)
- 20b286f Phones: race results list no longer covers the minimap (#487)
- 8c10d4d iPhone Chrome: GAS and top buttons back on screen; standings wait for the lights; round lap timer and buttons (#486)
- bd0444a Race: the last racer left in gets END RACE, not a restart into a race of one (#485)
- 901c35c Phone race HUD: place + time top centre, standings over the gas pedal; borderless lap timer and top buttons; START HOTLAP text (#484)
- de39124 Race votes: two or more votes may start when a driver leaves; a lone vote asks START NOW (#483)
- 5774646 Race: Esc on the TO RACE START screen opts out (#482)
- 9a450cd Race votes: a race starts only when somebody votes, never because drivers left (#481)
- b2e982c Race: join late, from the grid or during the race, with a start of your own (#480)
- 6a3c0ff Phone HUD as Martin drew it: race button right under the top buttons, lap timer top centre, rev counter bottom left (#479)
- 365a28b ?turnin=high: wheels held into a slide give way to the driver gradually (trial) (#478)
- 826d076 Narva mnt road paint: double solid centre line from Jaama to Peetri (#477)
- 9c24c76 Donut helper off for every car by default; ?donut=1 brings it back (#476)
- 15ce8bb Race: restart vote opens for everyone at the lights; gaps never read +- (#475)
- e2e404a Narva mnt map-load stall: freed ground in the work queue, Jänese 1 too (#474)
- 1aeccc5 Narva mnt kaardista batch 7: Peetri kirik to Raadi Maxima (#473)
- aded94d Upshift blow-off: different every change, valve opens a moment late (#472)
- 07f02ab ?donut=0 switches the donut helper off to feel the bare tyres (#471)
- 570747a Blow-off on turbo upshifts, in the gap before the gear bites (#470)
- c436531 Narva mnt kaardista batch 6: Narva 86 to 149 up towards Peetri (#469)
- 90407f8 Narva mnt kaardista batch 5: Narva 89 to 107 and the Jüri church (#468)

## 2026-11-24 (main 5fb3c99, run 01:19 UTC)

Every figure within budget.

| Check | Figure | Budget | Result |
|---|---|---|---|
| Phone canvases at DRIVE | 80 | 230 | OK |
| Phone graphics card at DRIVE | 187 | 250 | OK |
| Phone JS heap at DRIVE | 242 | 420 | OK |
| Phone total at DRIVE | 509 | 820 | OK |
| Phone peak in the 5 s after DRIVE, garbage included | 611 | 740 | OK |
| Phone graphics card peak in a map jump | 188 | 280 | OK |
| Phone graphics card growth after 3 car changes and back to the first car | 1 | 20 | OK |
| Phone graphics card peak during the car changes | 204 | 250 | OK |
| Phone total after 2 km through the centre | 755 | 870 | OK |
| Phone graphics card peak through the centre | 381 | 445 | OK |
| Graphics level tests failing (saved level, crash guard) | 0 | 0 | OK |
| Lowest graphics level at the Riia and Turu junction: pieces drawn in a frame | 330 | 460 | OK |
| Lowest graphics level at the Riia and Turu junction: triangles in a frame (thousands) | 541 | 760 | OK |
| Desktop drive through the centre: times the game was busy for over 0.1 s | 0 | 2 | OK |
| Desktop drive: longest the game was busy without a break (ms) | 75 | 150 | OK |
| Desktop drive: time in busy stretches over 50 ms (s) | 0.07 | 1.2 | OK |
| Desktop drive: gaps between frames over 0.1 s | 0 | 3 | OK |
| Desktop drive: game code per frame, 95th percentile (ms) | 6.7 | 12 | OK |
| Desktop drive: page errors | 0 | 0 | OK |
| Desktop drive: building work queued twice | 0 | 0 | OK |
| Desktop drive: longest gap between frames (ms), not judged | 76 | - | not judged |
| Phone drive through the centre: times the game was busy for over 0.1 s | 0 | 2 | OK |
| Phone drive: longest the game was busy without a break (ms) | 84 | 150 | OK |
| Phone drive: time in busy stretches over 50 ms (s) | 0.08 | 1.2 | OK |
| Phone drive: gaps between frames over 0.1 s | 0 | 3 | OK |
| Phone drive: game code per frame, 95th percentile (ms) | 6.5 | 10 | OK |
| Phone drive: page errors | 0 | 0 | OK |
| Phone drive: building work queued twice | 0 | 0 | OK |
| Phone drive: longest gap between frames (ms), not judged | 95 | - | not judged |
| Lap drive round the race track: times the game was busy for over 25 ms | 6 | 8 | OK |
| Lap drive: times the game was busy for over 33 ms | 3 | 4 | OK |
| Lap drive: longest the game was busy without a break (ms) | 53 | 100 | OK |
| Lap drive: frames whose game code took over 33 ms | 0 | 2 | OK |
| Lap drive: house fronts painted on the way (megapixels) | 31.2 | 36 | OK |
| Lap drive: pictures sent to the graphics card (megapixels) | 128 | 165 | OK |
| Lap drive: frames that sent over 1.1 megapixels of pictures | 3 | 10 | OK |
| Lap drive: most megapixels of pictures sent in one frame | 1.39 | 2 | OK |
| Lap drive: page errors | 0 | 0 | OK |
| Lap drive: building work queued twice | 0 | 0 | OK |
| Lap drive: times the game was busy for over 16 ms, not judged | 36 | - | not judged |
| Lap drive: frames whose game code took over 16.7 ms, not judged | 14 | - | not judged |
| Lap drive: game code in a frame, the longest (ms), not judged | 30 | - | not judged |
| Stage drive, a run of the Raadi rally stage: the stage counted the run as finished (runs not finished) | 0 | 0 | OK |
| Stage drive: times the game was busy for over 25 ms | 3 | 8 | OK |
| Stage drive: times the game was busy for over 33 ms | 1 | 4 | OK |
| Stage drive: longest the game was busy without a break (ms) | 34 | 100 | OK |
| Stage drive: frames whose game code took over 33 ms | 0 | 2 | OK |
| Stage drive: pictures sent to the graphics card (megapixels) | 24 | 40 | OK |
| Stage drive: frames that sent over 1.1 megapixels of pictures | 0 | 4 | OK |
| Stage drive: most megapixels of pictures sent in one frame | 1.05 | 2 | OK |
| Stage drive: page errors | 0 | 0 | OK |
| Stage drive: building work queued twice | 0 | 0 | OK |
| Stage drive: times the game was busy for over 16 ms, not judged | 9 | - | not judged |
| Stage drive: game code in a frame, the longest (ms), not judged | 20 | - | not judged |

Against the 23 Nov run 2: phone total at DRIVE 593 -> 509 MB (heap 267 -> 242, canvases 139 -> 80), centre total 834 -> 755. Grew by over 10 % (all short-hitch timings, which vary run to run): phone drive longest busy 46 -> 84 ms (data.js sector load and garbage collection), desktop drive longest 66 -> 75 ms, lap over 25 ms 3 -> 6 and over 33 ms 1 -> 3, lap longest 40 -> 53 ms (garbage collection). The 23 Nov 20:52 UTC run on 9b233b3 had lap 4 / 2 / 66 ms, so tonight sits in that range. Raadi stage (first time in this log): finished, 3 stretches over 25 ms, longest 34 ms, 24 MP sent.

Commits merged to main in the 24 h before the run:

- 5fb3c99 Raadi: tape is the border, finish tape, start beeps, heavier rounded bales, a stone (#599)
- ae53dd7 Positions in bundles: one message per player 10x/s, far cars less often (#598)
- eb0b15a Show the lap time with the lap record tag in the online list and over the car (#597)
- 41881f8 Spectating: everyone sees WATCHED · N by a watched player's name (#596)
- 2c2d14a Tyres: no "Tyres changed to" note in the garage (#595)
- 25cb7bb Spectating stays anonymous: (watching) without a name, BEING WATCHED · N, WATCHING on your own line (#594)
- d319beb Thumbs up between players: a neon sign in the receiver's back window (#593)
- d6aec63 Spectator mode (desktop): click a player in the online list or their minimap arrow to follow their car (#592)
- 6b264e0 Many players online: far cars as one-draw blocks, names over the nearest few within 150 m, position 3x/s with nobody near (#591)
- 7ea61fb Quieter tyre squeal on electric cars (6 dB down) (#590)
- f3723d8 Race: fewer votes needed to start a race with many on the map (5 up to 15 drivers, 6/7/8 above) (#589)
- d5f291c Lap times: YOUR BEST column per car on Toomemägi and Raadi (#588)
- 6e1af93 Options: notification sounds on/off; tyre squeal and grass marks choices removed (#587)
- ee6ec91 Late join: straight to the lights, JOINING THE RACE, placed by the race's clock (#586)
- a6c262a Start screen: circuit choice becomes big tiles on a taller phone (#585)
- 53b5e31 Start screen on a taller phone: circuit pills, cards and DRIVE row grow with the free height (#584)
- 5a83a41 Options: a tap or click outside the open panel closes it, and does nothing else (#583)
- 7134d93 Phones: race standings one pedal wide, place, name and gap only, whole rows (#582)
- 3be0704 Tyres: every way the game puts the car at a circuit fits its tyres (#581)
- 135bc40 Tyres: picking a circuit on the start screen fits its tyres too (#580)
- 510e3e5 Name tags over other players: plain lap-record line, whole tag raised off the racing line (#579)
- eb9e563 Perf check: a full run of the Raadi rally stage, judged for short hitches like the lap (#578)
- f646f16 Raadi: stones in size brackets, rounder second corner, fainter tracks, bale and tape moves (#577)
- dba1f75 Bus: raise the chase camera so the road shows over the roof (#576)
- 3484848 Grass marks C made even: one steady lit rut, no torn patches or clods on grass (#575)
- c4154eb Vallikraavi bend: straight iron fence along Martin's red line, none before the corner (#574)
- b4c80cd Raadi park stones the cars feel by their shape (#573)
- 9d28aa8 Grass and earth tyre marks C to compare: real ruts lit by the sun (?grassmarks=c, K cycles A/B/C) (#572)
- 2e168c0 Raadi stage: straight fence at the last corner, rounded glow in tight corners, first bale further in (#571)
- cc09cb2 Soinaste: Rehetare tee 1 and the halls on Rehepapi tee, Rattasepa tee 5 and Rehepapi tee 4 (kaardista batches 1 and 2) (#570)
- 8ea3a5c Raadi manor: the cream wall, the gatehouse and its portico, the TARTU VALD letters (kaardista batch 3) (#569)
- 175e10d Raadi stage: start tape may be broken, joined tape, overshoot and missed bale judged later (#568)
- 93f6671 Kaupmehe flats and the Coop by road 95, as seen from the road and the Raadi stage (kaardista batch 2) (#567)
- 98c07af ERM: drive under the canopy, up the plates onto the roof and off any edge (kaardista batch 1) (#566)
- 4bbc77a Raadi bales: a full-on hit costs more speed, brushes and half hits stay cheap (#565)
- dd9c53f Aovere: the cars parked on Aasa tee are BMWs (#564)
- 373176f Raadi stage: tape on sticks where the penalties begin, borders as drawn, one penalty text (#563)
- f1b272f Aovere: road paint at the Haava junction (#562)
- 1823f68 Fuel price boards: Estonian pump prices of 23 Nov 2026 (#561)
- c801478 Aovere: Tõumesila bee farm on Kiigi tee (kaardista batch 4) (#560)
- 041e649 Aovere: the farms round the Haava junction (kaardista batch 3) (#559)
- 273331b Pootsmani 12 built by hand from Street View (#557)
- 061a111 Raadi stage in neon orange on both maps, orange Raadi icon in the lap times (#558)
- 7a6f2b0 Aovere: the Haava junction and Olerex (kaardista batch 2) (#556)
- 05f3775 Raadi stage times kept on the server: records, board and track card (#555)
- e0bf297 Aovere: the three houses on Aasa tee by the Haava junction (kaardista batch 1) (#554)
- 93689e8 Raadi park: young trees, 369 stones and wider gravel from the air photo; stage time comes down away from the park (#553)
- 0dca89a No FULL button on iPhone (Martin): the Home Screen hint goes; Android and computers keep it (#552)
- ebe1a7c Start screen: phone layout fixed, larger track cards with the lapping dot; Raadi: bales off the gravel, track buttons under the top bar on phones, two start bulbs (#551)
- b312bb8 Tyres: defaults only from the in-game circuit buttons, and a "Tyres changed to" note (#550)
