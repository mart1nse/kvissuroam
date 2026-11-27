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

## 2026-11-25 (main aff05bb, run 01:19 UTC)

Every figure within budget.

| Check | Figure | Budget | Result |
|---|---|---|---|
| Phone canvases at DRIVE | 126 | 230 | OK |
| Phone graphics card at DRIVE | 189 | 250 | OK |
| Phone JS heap at DRIVE | 250 | 420 | OK |
| Phone total at DRIVE | 565 | 820 | OK |
| Phone peak in the 5 s after DRIVE, garbage included | 616 | 740 | OK |
| Phone graphics card peak in a map jump | 223 | 280 | OK |
| Phone graphics card growth after 3 car changes and back to the first car | 1 | 20 | OK |
| Phone graphics card peak during the car changes | 206 | 250 | OK |
| Phone total after 2 km through the centre | 843 | 870 | OK |
| Phone graphics card peak through the centre | 428 | 445 | OK |
| Phone total at the Raadi stage (?raadi=1) | 460 | 560 | OK |
| Phone graphics card peak at the Raadi stage | 196 | 240 | OK |
| Graphics level tests failing (saved level, crash guard) | 0 | 0 | OK |
| Lowest graphics level at the Riia and Turu junction: pieces drawn in a frame | 355 | 460 | OK |
| Lowest graphics level at the Riia and Turu junction: triangles in a frame (thousands) | 507 | 760 | OK |
| Lowest graphics level along the Raadi stage, the heaviest of three views: pieces drawn in a frame | 125 | 150 | OK |
| Lowest graphics level along the Raadi stage: triangles in a frame (thousands) | 327 | 440 | OK |
| Top graphics level (desktop) along the Raadi stage, the heaviest of three views: pieces drawn in a frame | 546 | 800 | OK |
| Top graphics level along the Raadi stage: triangles in a frame (thousands) | 1555 | 3200 | OK |
| Desktop drive through the centre: times the game was busy for over 0.1 s | 0 | 2 | OK |
| Desktop drive: longest the game was busy without a break (ms) | 55 | 150 | OK |
| Desktop drive: time in busy stretches over 50 ms (s) | 0.22 | 1.2 | OK |
| Desktop drive: gaps between frames over 0.1 s | 0 | 3 | OK |
| Desktop drive: game code per frame, 95th percentile (ms) | 7.4 | 12 | OK |
| Desktop drive: page errors | 0 | 0 | OK |
| Desktop drive: building work queued twice | 0 | 0 | OK |
| Desktop drive: longest gap between frames (ms), not judged | 72 | - | not judged |
| Phone drive through the centre: times the game was busy for over 0.1 s | 0 | 2 | OK |
| Phone drive: longest the game was busy without a break (ms) | 96 | 150 | OK |
| Phone drive: time in busy stretches over 50 ms (s) | 0.27 | 1.2 | OK |
| Phone drive: gaps between frames over 0.1 s | 0 | 3 | OK |
| Phone drive: game code per frame, 95th percentile (ms) | 6.8 | 10 | OK |
| Phone drive: page errors | 0 | 0 | OK |
| Phone drive: building work queued twice | 0 | 0 | OK |
| Phone drive: longest gap between frames (ms), not judged | 68 | - | not judged |
| Lap drive round the race track: times the game was busy for over 25 ms | 4 | 8 | OK |
| Lap drive: times the game was busy for over 33 ms | 3 | 4 | OK |
| Lap drive: longest the game was busy without a break (ms) | 77 | 100 | OK |
| Lap drive: frames whose game code took over 33 ms | 0 | 2 | OK |
| Lap drive: house fronts painted on the way (megapixels) | 31.2 | 36 | OK |
| Lap drive: pictures sent to the graphics card (megapixels) | 133 | 165 | OK |
| Lap drive: frames that sent over 1.1 megapixels of pictures | 1 | 10 | OK |
| Lap drive: most megapixels of pictures sent in one frame | 1.39 | 2 | OK |
| Lap drive: page errors | 0 | 0 | OK |
| Lap drive: building work queued twice | 0 | 0 | OK |
| Lap drive: times the game was busy for over 16 ms, not judged | 22 | - | not judged |
| Lap drive: frames whose game code took over 16.7 ms, not judged | 13 | - | not judged |
| Lap drive: game code in a frame, the longest (ms), not judged | 24 | - | not judged |
| Stage drive, a run of the Raadi rally stage: the stage counted the run as finished (runs not finished) | 0 | 0 | OK |
| Stage drive: times the game was busy for over 25 ms | 3 | 8 | OK |
| Stage drive: times the game was busy for over 33 ms | 1 | 4 | OK |
| Stage drive: longest the game was busy without a break (ms) | 39 | 100 | OK |
| Stage drive: frames whose game code took over 33 ms | 0 | 2 | OK |
| Stage drive: pictures sent to the graphics card (megapixels) | 24 | 40 | OK |
| Stage drive: frames that sent over 1.1 megapixels of pictures | 0 | 4 | OK |
| Stage drive: most megapixels of pictures sent in one frame | 1.05 | 2 | OK |
| Stage drive: page errors | 0 | 0 | OK |
| Stage drive: building work queued twice | 0 | 0 | OK |
| Stage drive: times the game was busy for over 16 ms, not judged | 10 | - | not judged |
| Stage drive: game code in a frame, the longest (ms), not judged | 32 | - | not judged |
| 60 players online: times the online code kept the page busy for over 5 ms in 40 s | 4 | 10 | OK |
| 60 players online: the online code's most in one stretch (ms) | 8.6 | 12 | OK |
| 60 players online: page errors | 0 | 0 | OK |
| 60 players online: the online code per frame (ms), not judged | 0.71 | - | not judged |
| 60 players online: times the game was busy for over 25 ms, not judged | 0 | - | not judged |
| A race of 30, 60 online: times the online code kept the page busy for over 5 ms in 30 s | 3 | 10 | OK |
| A race of 30: the online code's most in one stretch (ms) | 5.6 | 12 | OK |
| A race of 30: page errors | 0 | 0 | OK |
| Phone, shaders built the iPhone way: programs first used inside the drawing of a frame after DRIVE | 1 | 5 | OK |
| Phone, shaders built the iPhone way: most such programs in one frame | 1 | 2 | OK |
| Phone, shaders built the iPhone way: page errors | 0 | 0 | OK |

Against the 24 Nov run: phone total at DRIVE 509 -> 565 MB (canvases 80 -> 126), centre total 755 -> 843 of 870 (card peak 381 -> 428 of 445), map jump card peak 188 -> 223. The same memory figures were already measured on ce140a6 (24 Nov 22:52 UTC, a thread's run), so the growth came in during the day on 24 Nov, not from tonight's last commits; the centre total has under 30 MB of room left. Short-hitch timings that grew by over 10 % (they vary run to run): desktop time over 50 ms 0.07 -> 0.22 s, phone drive longest 84 -> 96 ms and time over 50 ms 0.08 -> 0.27 s, lap longest 53 -> 77 ms, stage longest 34 -> 39 ms. Raadi stage finished, 3 over 25 ms; phone at the Raadi stage 460 MB. 60 online: 4 over 5 ms, most 8.6 ms; race of 30: 3, most 5.6 ms.

Commits merged to main in the 24 h before the run:

- aff05bb Raadi stage: more than 100 m the wrong way cancels the run (#680)
- e2ff931 Invisible post at the end of the Vallikraavi fence: free the field where moved or cleared map trees stood (#679)
- 1723ac8 Stand-ins: each car its own shape and colour, measured from its model (#678)
- 9002f14 Phone race HUD: standings 5 rows at most, race button one place further right with the names under it (#677)
- 588254a Phone freezes at DRIVE: shaders first used ahead of drawing, Raadi finish fix (#676)
- 3566ea1 Replays: accept a lap with an R hop; keep refused replays with the reason (#675)
- 5a7afd1 iPhone: the page can no longer be dragged sideways, and a page laid out wider than the screen is fitted again (#674)
- 9a5c555 WINNER pill in HOTLAP's pink-violet, not gold (#673)
- 8b8bd5a Phone online list: colour dot at the right end of the name, thumb stays in front (#672)
- 48fca4c WINNER over a race winner's name instead of HOTLAP (#671)
- b5af10c Phone online list lined up on the right, with the top buttons' right edge (#670)
- e5342d0 Stats: dead pages and freeze details folded into one line each, open on a tap (#669)
- 71b0e62 Toomemägi gates 50 m wide, one missed gate forgiven; remove the 42 cheated laps (#668)
- 60af289 Toomemägi lap: wrong way over 100 m cancels, checkpoints within 14 m (#667)
- c0590ac Toomemägi lap: hidden gates every 50 m, in order (closes Kroonuaia and Lai short cuts) (#666)
- 28ada99 Phone HUD: online list beside the race button, race line and standings between minimap and lap timer (#665)
- 9c9b7c1 Phones: the race list stays small until 5 s after you cross the line, then the full results (#664)
- 9812e79 Race not in: the button and chip show the race that is on, live; last race only when none is on (#663)
- bff90e3 Street label: real street names where the map names a state road by its route (#662)
- e317469 Race results: the car raced in, not one taken after the finish (#661)
- bc03e23 Stand-in cars: solid sides; car name tags keep off the HUD (#660)
- deca297 Phones: the 3 built car kinds follow what is driven most (in a race, the racers) (#659)
- 667e946 A pack of cars: nearest 10 whole, 4 with shadows; stand-ins look like cars; terrain lighter far away (#658)
- 7d9bbad Stats: what each freeze of 1 s or more had going on, on /stats and its map (#657)
- b28e135 Lap record replays: each car's record lap kept as movement and watched from the LAP TIMES board (#656)
- 61d2462 Start: free spots up Vanemuise and in the theatre park bays when the start is busy (#655)
- ecaa953 Race list: a racer's name follows their car on desktop, as in the online list (#654)
- 5d4db57 Thumbs up: click or tap a small thumb to see who gave it (#653)
- 36d36fb Stats: visits hour by hour on the 24 h tab, script errors moved to /stats-errors (#652)
- 6dc2e8d Race: other racers' name tags show their place (P3) instead of HOTLAP, a bit larger (#651)
- e30a830 Race button: RACE FINISHED once the winner is over the line (#650)
- ddda035 City map players list: narrower, slim neon scrollbar (#649)
- 35bd3e6 Race of 30: ghost car shaders made ready a piece a frame, race list written in parts (#648)
- e6eef02 Many players online: no hitch when people come, go or vote (#647)
- fba1208 Race: ends when all are through, standings and race clock stay up after you finish (#646)
- 4203de5 Stats: online demand, players turned away by SERVER FULL, peaks and averages (#645)
- 839f8bd Desktop online list: keep +N MORE over the scrolling names (#644)
- 8128dc6 Stats: count everyone online, not just the 60 names listed (#643)
- b839293 Online list on desktop: every name listed, mouse wheel scrolls it, no scrollbar (#642)
- d6284d7 Online cap counts real players, frees idle garage places when full (#641)
- 5fae5e3 Spectating: thumbs up button at the right end of the WATCHING pill (#640)
- 5a37b41 Log clues when a page dies on screen, shown on /stats (#639)
- ba3e9d9 Hotlap: NEW PERSONAL BEST banner, split labels ME and BEST (#638)
- 0de5724 Hotlap splits: delta to your best and to the car's lap record side by side (#637)
- dbaae8c Perf check: a phone's memory along the Raadi rally stage (#636)
- 44b6f4b Thumbs up: small thumbs on the back window a touch bigger (#635)
- 21020d3 Tyre marks on the ERM roof and bridge decks look like tarmac, not the grass below (#634)
- 92485a5 Other cars glide evenly up close (sender time stamps, curved paths) (#633)
- 1cd7395 Race: spectators can vote to start and join a race (#632)
- 886d115 Raadi start circle: gravel tyres on the jump, column warmed through the work queue (#631)

## 2026-11-26 (main 142e57c, run 01:18 UTC)

Every figure within budget. The run was alone on the machine (other work took 0.04 of its 4 processor cores on average).

| Check | Figure | Budget | Result |
|---|---|---|---|
| Phone canvases at DRIVE | 93 | 230 | OK |
| Phone graphics card at DRIVE | 189 | 250 | OK |
| Phone JS heap at DRIVE | 252 | 420 | OK |
| Phone total at DRIVE | 534 | 820 | OK |
| Phone peak in the 5 s after DRIVE, garbage included | 571 | 740 | OK |
| Phone graphics card peak in a map jump | 218 | 280 | OK |
| Phone graphics card growth after 3 car changes and back to the first car | 1 | 20 | OK |
| Phone graphics card peak during the car changes | 206 | 250 | OK |
| Phone total after 2 km through the centre | 788 | 870 | OK |
| Phone graphics card peak through the centre | 421 | 445 | OK |
| Phone total at the Raadi stage (?raadi=1) | 441 | 560 | OK |
| Phone graphics card peak at the Raadi stage | 196 | 240 | OK |
| Graphics level tests failing (saved level, crash guard) | 0 | 0 | OK |
| Lowest graphics level at the Riia and Turu junction: pieces drawn in a frame | 357 | 460 | OK |
| Lowest graphics level at the Riia and Turu junction: triangles in a frame (thousands) | 507 | 760 | OK |
| Lowest graphics level along the Raadi stage, the heaviest of three views: pieces drawn in a frame | 125 | 150 | OK |
| Lowest graphics level along the Raadi stage: triangles in a frame (thousands) | 327 | 440 | OK |
| Top graphics level (desktop) along the Raadi stage, the heaviest of three views: pieces drawn in a frame | 560 | 800 | OK |
| Top graphics level along the Raadi stage: triangles in a frame (thousands) | 1502 | 3200 | OK |
| Desktop drive through the centre: times the game was busy for over 0.1 s | 0 | 2 | OK |
| Desktop drive: longest the game was busy without a break (ms) | 52 | 150 | OK |
| Desktop drive: time in busy stretches over 50 ms (s) | 0.1 | 1.2 | OK |
| Desktop drive: gaps between frames over 0.1 s | 0 | 3 | OK |
| Desktop drive: game code per frame, 95th percentile (ms) | 6.3 | 12 | OK |
| Desktop drive: page errors | 0 | 0 | OK |
| Desktop drive: building work queued twice | 0 | 0 | OK |
| Desktop drive: longest gap between frames (ms), not judged | 52 | - | not judged |
| Phone drive through the centre: times the game was busy for over 0.1 s | 0 | 2 | OK |
| Phone drive: longest the game was busy without a break (ms) | 72 | 150 | OK |
| Phone drive: time in busy stretches over 50 ms (s) | 0.07 | 1.2 | OK |
| Phone drive: gaps between frames over 0.1 s | 0 | 3 | OK |
| Phone drive: game code per frame, 95th percentile (ms) | 5.8 | 10 | OK |
| Phone drive: page errors | 0 | 0 | OK |
| Phone drive: building work queued twice | 0 | 0 | OK |
| Phone drive: longest gap between frames (ms), not judged | 56 | - | not judged |
| Lap drive round the race track: times the game was busy for over 25 ms | 5 | 8 | OK |
| Lap drive: times the game was busy for over 33 ms | 2 | 4 | OK |
| Lap drive: longest the game was busy without a break (ms) | 50 | 100 | OK |
| Lap drive: frames whose game code took over 33 ms | 0 | 2 | OK |
| Lap drive: house fronts painted on the way (megapixels) | 31.2 | 36 | OK |
| Lap drive: pictures sent to the graphics card (megapixels) | 141 | 165 | OK |
| Lap drive: frames that sent over 1.1 megapixels of pictures | 5 | 10 | OK |
| Lap drive: most megapixels of pictures sent in one frame | 1.72 | 2 | OK |
| Lap drive: page errors | 0 | 0 | OK |
| Lap drive: building work queued twice | 0 | 0 | OK |
| Lap drive: times the game was busy for over 16 ms, not judged | 14 | - | not judged |
| Lap drive: frames whose game code took over 16.7 ms, not judged | 3 | - | not judged |
| Lap drive: game code in a frame, the longest (ms), not judged | 24 | - | not judged |
| Stage drive, a run of the Raadi rally stage: the stage counted the run as finished (runs not finished) | 0 | 0 | OK |
| Stage drive: times the game was busy for over 25 ms | 1 | 8 | OK |
| Stage drive: times the game was busy for over 33 ms | 0 | 4 | OK |
| Stage drive: longest the game was busy without a break (ms) | 28 | 100 | OK |
| Stage drive: frames whose game code took over 33 ms | 0 | 2 | OK |
| Stage drive: pictures sent to the graphics card (megapixels) | 24 | 40 | OK |
| Stage drive: frames that sent over 1.1 megapixels of pictures | 0 | 4 | OK |
| Stage drive: most megapixels of pictures sent in one frame | 1.05 | 2 | OK |
| Stage drive: page errors | 0 | 0 | OK |
| Stage drive: building work queued twice | 0 | 0 | OK |
| Stage drive: times the game was busy for over 16 ms, not judged | 5 | - | not judged |
| Stage drive: game code in a frame, the longest (ms), not judged | 12 | - | not judged |
| 60 players online: times the online code kept the page busy for over 5 ms in 40 s | 5 | 10 | OK |
| 60 players online: the online code's most in one stretch (ms) | 10.3 | 12 | OK |
| 60 players online: page errors | 0 | 0 | OK |
| 60 players online: the online code per frame (ms), not judged | 0.49 | - | not judged |
| 60 players online: times the game was busy for over 25 ms, not judged | 0 | - | not judged |
| A race of 30, 60 online: times the online code kept the page busy for over 5 ms in 30 s | 1 | 10 | OK |
| A race of 30: the online code's most in one stretch (ms) | 10 | 12 | OK |
| A race of 30: page errors | 0 | 0 | OK |
| New kinds of car, 60 online: frames that sent over 3 MB of model to the graphics card | 0 | 1 | OK |
| New kinds of car: page errors | 0 | 0 | OK |
| New kinds of car: most model in one frame (MB), not judged | 2.03 | - | not judged |
| New kinds of car: most pictures in one frame (megapixels), not judged | 4.19 | - | not judged |
| Phone, shaders built the iPhone way: programs first used inside the drawing of a frame after DRIVE | 4 | 5 | OK |
| Phone, shaders built the iPhone way: most such programs in one frame | 2 | 2 | OK |
| Phone, shaders built the iPhone way: page errors | 0 | 0 | OK |
| The machine: processor cores taken by other work during the check, on average (over 0.5: run it again alone), not judged | 0.04 | - | not judged |

Against the 25 Nov run: phone total at DRIVE 565 -> 534 MB (canvases 126 -> 93), peak after DRIVE 616 -> 571, centre total 843 -> 788 of 870 (card peak 428 -> 421 of 445), phone at the Raadi stage 460 -> 441. Figures that grew by over 10 % (the timing ones vary run to run): lap over 25 ms 4 -> 5 of 8, lap frames that sent over 1.1 megapixels 1 -> 5 of 10 and most in a frame 1.39 -> 1.72 of 2; 60 online over 5 ms 4 -> 5 of 10 and most 8.6 -> 10.3 of 12 ms; race of 30 most 5.6 -> 10 of 12 ms (times over 5 ms 3 -> 1); phone shaders first used inside a frame after DRIVE 1 -> 4 of 5, most in one frame 1 -> 2 of 2 (at its budget). Longest busy stretches fell: desktop drive 55 -> 52 ms, phone drive 96 -> 72, lap 77 -> 50, stage 39 -> 28. Raadi stage finished, 1 over 25 ms. New since the last run: new kinds of car in a crowd of 60 (0 frames over 3 MB of model, budget 1; most 2.03 MB) and the note of other work on the machine (#707, #730).

Commits merged to main in the 24 h before the run:

- 142e57c Rocket kickflip: fewer small bursts, long burns, pauses in the turn, more cloud at landing (#742)
- 967ec3d Stats: the Devices card also shows time spent driving per device (#741)
- 24080e3 Electric cars: regen blends in over a moment, the Rocket regenerates too, a pastel green on the dial (#740)
- 7dfcac9 Rocket: fan dust on loose ground, a fan switch, 250 kg more (#739)
- 2183995 Tyre smoke is back for every car (broken since #702) (#738)
- 1a9a520 Rocket: the kickflip fights for balance all the way (#737)
- acbefc2 Electric cars: the dial is a power meter in kW, lifting off regenerates as the real cars do (#736)
- 152fbfa Rocket: BOOST's push follows the tank (the real gas budget) (#734)
- 6e7f9ca Perf check: say when the machine was busy with other work during the run (#730)
- 56f0dda Tasku TOREPOOD banner: stand it off the glass so iPhones don't cut it into strips (#735)
- 057a896 Phones: LIVE RACE on its own line above the race text, away from JOIN RACE (#733)
- 05b6833 iPhone Chrome: also refit a page drawn zoomed (the garage cut on the right on opening, 25 Nov) (#732)
- c6c7fff Phones: tyre switcher at the dial's top left, the Rocket's BOOST by the left thumb and FLIP by the right (#731)
- 76450e0 Rocket: tail jets shut in a jump, suction fans heard and shown (#728)
- 517eb69 Idle cars: old pages put off the map by the server, a shoved car no longer counts as driven, racers judged after the lights (#727)
- 0636045 Steam Controller: read directly in Chrome and Edge, back grips as BOOST and FLIP (#726)
- c3063b8 Rocket: kickflip roll overshoots and hunts for level, BOOST roars for as long as it is held (#725)
- e90b4c6 Ko-fi panel: no light strip on the left, page edge to edge again (#724)
- 651eda1 Ko-fi Support button live for everyone, taller panel without a visible scrollbar (#723)
- 2c7a2ed Ko-fi: Support joins the row under the cars, row lined up with the car columns (only ?off=100) (#722)
- 29946d2 Start lane: a car just put on the start passes through the others up to the line (#721)
- fb1321f Rocket: 2 s reload in offline mode (?off=100) (#720)
- 99f2325 Idle cars on the map go back to the garage after 2 min, with a 15 s countdown (#719)
- ae3126f Ghost cars: a see-through car no longer patchy on desktops, and lighter to draw (#718)
- 69228a0 Tesla Roadster Rocket: thrusters, BOOST and the kickflip (hidden, only with ?off=100) (#702)
- 608bf96 Ko-fi: SUPPORT LINNARING on top, button above the EVERYDAY column, Apple Pay line removed (#717)
- d472966 Ko-fi button lines up with the EVERYDAY column, still ?off=100 only (#716)
- 7ec839a Garage key hints: R back to last spot, N sound left out (#715)
- 7c15556 Ko-fi button: SUPPORT LINNARING, still ?off=100 only (#714)
- 69bdb3c Ko-fi button: arrow down instead of ↗, still ?off=100 only (#713)
- 1491062 Ko-fi panel: "Apple Pay? Open on ko-fi.com" line on Apple browsers, still ?off=100 only (#712)
- 8efe2ae Ko-fi: button turns into the panel in place, lilac tint, still ?off=100 only (#711)
- 34353ec Ko-fi button opens the donation panel inside the game, still ?off=100 only (#710)
- d55adbb Ko-fi link dressed like DRIVE, TOETA LINNARINGI big below, still ?off=100 only (#709)
- 6b3ada6 Ko-fi link: one look, label and coin tree on the sunset fill, still ?off=100 only (#708)
- c801fdd Garage: Ko-fi link "Ega token puu otsas kasva", hidden behind ?off=100 for testing (#706)
- 9469634 Online stutters: other players' cars go to the graphics card ahead in small steps; the game counts its own short hitches (#707)
- 4d3f7fe Tasku: big clickable TOREPOOD banner on the corner (#705)
- 36be8f7 Surge safety: far back in the queue ask once a minute; board, online list and lap tickets kept off the lobby (#704)
- 9b17366 Kaubamaja: TOREPOOD poster in place of the red SUUR banner (#703)
- 6e98915 Own number plate: typed in the garage on a computer, on your car for everyone (#701)
- 65ec0b0 /stats Online now: "and 24 more" opens the whole list; each player shows where they are (background tab, Raadi stage, watching) (#700)
- 843d7ea Name filter: debiilik and raisk/rsk are allowed (#699)
- 6a72b89 Server full: a queue. Waiters get in first come first, see their place; /stats says where the non-drivers are (#698)
- d5ff6f5 Name filter: common swearing in Estonian, English and Russian too (#697)
- 48ba82c Online cap: idle garage players give up their place from 90 % of the cap (90 of 100), not only when full (#696)
- b858033 Security: believable lap floors, new bests wait for their replay, lap caps, race finish on server clock, stealth use on /stats (#695)
- 4db30dc Server: per-address API limit before the Durable Objects, change-message budget per socket, /api closed on workers.dev (#694)
- 9b31272 Server full: garage/menu/other-tab players give up their place after 30 s (was 2 min), told KICKED FOR INACTIVITY (#693)
- 3ef6b13 Online cap: a dropped or reloaded page gets its own place back at SERVER FULL; a released socket holds no place (#692)
- 843b48f Phone start screen: circuits fill the spare room above the cars, desktop details as height allows (#691)
- b34c3a3 Gravel tyres: bring off-road grip back up 1 % (#690)
- 9b5976c Raadi start stretch: +2 s once half the car is past the left tape (#689)
- ebab236 Name box: one pink blink for a refused name (#688)
- ec9c2a4 Name box refuses a racist-slur name: blinks twice, no message (#687)
- 084dee6 Big map online list: a second click on the same name watches that player (desktop) (#686)
- 4f7cf04 Gravel tyres: 2 % less grip on gravel, dirt and grass (#685)
- eeb847f Keep racist slurs out of driver names, silently (#684)
- 4bc853c More vaporwave words for new player names, one shared pool (#683)
- 0b47aef Raadi: BACK TO STAGE START more see-through and gone after 6 s, fading out (#682)
- 6af963a Phones: race button on the left under the race line, the right side all the online list's (#681)

## 2026-11-27 (main 6c18547, runs 01:2x and 01:5x UTC)

One figure OVER on both runs: phone total after 2 km through the centre (912, then 902 of 870). Not caused by a commit: the same phone pass alone on older commits read the same on this machine (142e57c, which read 788 in last night's run, now 886; c3e0cfb 863 and 904; 21cb008 871; main 887 and 895). The race of 30 was over on the first run only (27 of 10, then 4): noise. Machine: other work 0.15 of 4 cores, not busy.

Table from the second run (`--force`, alone); first run in brackets where it differed.

| Check | Figure | Budget | Result |
|---|---|---|---|
| Phone canvases at DRIVE | 129 (127) | 230 | OK |
| Phone graphics card at DRIVE | 189 | 250 | OK |
| Phone JS heap at DRIVE | 254 | 420 | OK |
| Phone total at DRIVE | 572 (570) | 820 | OK |
| Phone peak in the 5 s after DRIVE, garbage included | 626 (623) | 740 | OK |
| Phone graphics card peak in a map jump | 223 | 280 | OK |
| Phone graphics card growth after 3 car changes and back to the first car | 1 | 20 | OK |
| Phone graphics card peak during the car changes | 206 | 250 | OK |
| Phone total after 2 km through the centre | 902 (912) | 870 | OVER |
| Phone graphics card peak through the centre | 431 (430) | 445 | OK |
| Phone total at the Raadi stage (?raadi=1) | 459 (470) | 560 | OK |
| Phone graphics card peak at the Raadi stage | 196 | 240 | OK |
| Graphics level tests failing (saved level, crash guard) | 0 | 0 | OK |
| Lowest graphics level at the Riia and Turu junction: pieces drawn in a frame | 354 (357) | 460 | OK |
| Lowest graphics level at the Riia and Turu junction: triangles in a frame (thousands) | 506 (507) | 760 | OK |
| Lowest graphics level along the Raadi stage, the heaviest of three views: pieces drawn in a frame | 137 | 150 | OK |
| Lowest graphics level along the Raadi stage: triangles in a frame (thousands) | 346 | 440 | OK |
| Top graphics level (desktop) along the Raadi stage, the heaviest of three views: pieces drawn in a frame | 287 (286) | 800 | OK |
| Top graphics level along the Raadi stage: triangles in a frame (thousands) | 1345 (1338) | 3200 | OK |
| Desktop drive through the centre: times the game was busy for over 0.1 s | 0 | 2 | OK |
| Desktop drive: longest the game was busy without a break (ms) | 66 (41) | 150 | OK |
| Desktop drive: time in busy stretches over 50 ms (s) | 0.07 (0) | 1.2 | OK |
| Desktop drive: gaps between frames over 0.1 s | 0 | 3 | OK |
| Desktop drive: game code per frame, 95th percentile (ms) | 7.2 (7.4) | 12 | OK |
| Desktop drive: page errors | 0 | 0 | OK |
| Desktop drive: building work queued twice | 0 | 0 | OK |
| Desktop drive: longest gap between frames (ms), not judged | 69 (72) | - | not judged |
| Phone drive through the centre: times the game was busy for over 0.1 s | 0 | 2 | OK |
| Phone drive: longest the game was busy without a break (ms) | 56 (68) | 150 | OK |
| Phone drive: time in busy stretches over 50 ms (s) | 0.11 (0.07) | 1.2 | OK |
| Phone drive: gaps between frames over 0.1 s | 0 | 3 | OK |
| Phone drive: game code per frame, 95th percentile (ms) | 6.6 | 10 | OK |
| Phone drive: page errors | 0 | 0 | OK |
| Phone drive: building work queued twice | 0 | 0 | OK |
| Phone drive: longest gap between frames (ms), not judged | 81 (73) | - | not judged |
| Lap drive round the race track: times the game was busy for over 25 ms | 5 | 8 | OK |
| Lap drive: times the game was busy for over 33 ms | 3 | 4 | OK |
| Lap drive: longest the game was busy without a break (ms) | 52 (50) | 100 | OK |
| Lap drive: frames whose game code took over 33 ms | 0 (1) | 2 | OK |
| Lap drive: house fronts painted on the way (megapixels) | 31.2 | 36 | OK |
| Lap drive: pictures sent to the graphics card (megapixels) | 144 (141) | 165 | OK |
| Lap drive: frames that sent over 1.1 megapixels of pictures | 3 (4) | 10 | OK |
| Lap drive: most megapixels of pictures sent in one frame | 1.76 (1.62) | 2 | OK |
| Lap drive: page errors | 0 | 0 | OK |
| Lap drive: building work queued twice | 0 | 0 | OK |
| Lap drive: times the game was busy for over 16 ms, not judged | 30 (31) | - | not judged |
| Lap drive: frames whose game code took over 16.7 ms, not judged | 8 (10) | - | not judged |
| Lap drive: game code in a frame, the longest (ms), not judged | 22 (35) | - | not judged |
| Stage drive, a run of the Raadi rally stage: the stage counted the run as finished (runs not finished) | 0 | 0 | OK |
| Stage drive: times the game was busy for over 25 ms | 2 | 8 | OK |
| Stage drive: times the game was busy for over 33 ms | 2 (1) | 4 | OK |
| Stage drive: longest the game was busy without a break (ms) | 48 (43) | 100 | OK |
| Stage drive: frames whose game code took over 33 ms | 1 (0) | 2 | OK |
| Stage drive: pictures sent to the graphics card (megapixels) | 24 (23) | 40 | OK |
| Stage drive: frames that sent over 1.1 megapixels of pictures | 0 | 4 | OK |
| Stage drive: most megapixels of pictures sent in one frame | 1.05 | 2 | OK |
| Stage drive: page errors | 0 | 0 | OK |
| Stage drive: building work queued twice | 0 | 0 | OK |
| Stage drive: times the game was busy for over 16 ms, not judged | 9 | - | not judged |
| Stage drive: game code in a frame, the longest (ms), not judged | 47 (20) | - | not judged |
| 60 players online: times the online code kept the page busy for over 5 ms in 40 s | 1 (2) | 10 | OK |
| 60 players online: the online code's most in one stretch (ms) | 5.2 (6.1) | 12 | OK |
| 60 players online: page errors | 0 | 0 | OK |
| 60 players online: the online code per frame (ms), not judged | 0.55 (0.53) | - | not judged |
| 60 players online: times the game was busy for over 25 ms, not judged | 0 (1) | - | not judged |
| A race of 30, 60 online: times the online code kept the page busy for over 5 ms in 30 s | 4 (27) | 10 | OK |
| A race of 30: the online code's most in one stretch (ms) | 9.6 (8.6) | 12 | OK |
| A race of 30: page errors | 0 | 0 | OK |
| New kinds of car, 60 online: frames that sent over 3 MB of model to the graphics card | 0 | 1 | OK |
| New kinds of car: page errors | 0 | 0 | OK |
| New kinds of car: most model in one frame (MB), not judged | 2.03 | - | not judged |
| New kinds of car: most pictures in one frame (megapixels), not judged | 4.19 | - | not judged |
| Phone, shaders built the iPhone way: programs first used inside the drawing of a frame after DRIVE | 5 | 5 | OK |
| Phone, shaders built the iPhone way: most such programs in one frame | 2 | 2 | OK |
| Phone, shaders built the iPhone way: page errors | 0 | 0 | OK |
| The machine: processor cores taken by other work during the check, on average (over 0.5: run it again alone), not judged | 0.15 | - | not judged |

Against the 2026-11-26 run: phone total at DRIVE 534 -> 572 (canvases 93 -> 129), through the centre 788 -> 902, at the Raadi stage 441 -> 459. The canvas growth reads on last night's commit too, so it is this machine or something the page fetches, not the code. Timing figures over 10 % up (desktop longest busy 52 -> 66 ms, stage longest busy 28 -> 48 ms, lap busy over 16 ms 14 -> 30) are inside budget and match the slightly busier machine (0.15 cores, was 0.04).

Boards: 26 records, 5067 laps compared, 1 worth a look: toomemagi cgt 2:32.53 siuru (lap 5401, 26 Nov), part 1 in 24.5 s against the best of 70 others in that car 25.7 s. Server refused: race finish 48, car 2.

Commits merged in the last 24 h:

- 6c18547 Winbaum.ee cabin advert left of LAP START, only with ?winbaum=1 (#840)
- 6eeef93 Ford Focus RS WRC 03, hidden behind ?off=100: researched specs, anti-lag, and a bonnet that pops at 50 km/h hits and flies off over 100 (#839)
- dbaba7b One game tab online at a time: "You're playing in another tab · Continue here" (#837)
- 21cb008 Races: a minute after the winner, a racer making no progress round the lap is out (#838)
- 001f364 AUTO graphics: the sharpest rungs (2x) only while the graphics card stays well under its limit (#836)
- c3e0cfb Majoraadi: bales and barriers stand on the ground after a start from far away (#833)
- f5c98e6 Majoraadi loads the whole stage behind GETTING READY; the hitch line counts dropped frames on an uneven frame rate (#835)
- 017a6bd Race: a deploy mid-race no longer ends the race (#834)
- 9f417ab Majoraadi start: a filled circle on the ground instead of the column while on the start (#832)
- 13d7bcd LAP TIMES: each circuit's record over all cars beside its name, with driver and car (#831)
- d2cf801 Online list: names A to Z read from the top down, capitals or not (#830)
- aaca6b3 Majoraadi runners: the pill's count and its list hold steady for far-away cars (#829)
- a81ba02 /stats: Majoraadi runners at the top of Online now, in orange (#828)
- 35abd0f Watching a car: the track pills stay, with the Majoraadi runners under theirs (#827)
- 0554e8e Desktop: players on a Majoraadi run listed under the MAJORAADI pill (#826)
- a00bb72 Majoraadi pill: how many are on a timed stage run, in brackets (#825)
- da8e9f6 Stand-in cars go see-through like the whole cars when passing through ours (#824)
- 28cb420 Majoraadi open to everyone: test times deleted, stage counts on /stats (#817)
- 5a6da39 Race results: a scroll by hand stays 30 s, then back to your row; phones can scroll the results (#823)
- 47fcbe4 A second window of the game is no crash; Majoraadi waits for its stage before the lights (#821)
- 5935daa Race list: a checkered flag and a gold time for racers through the line (#822)
- fd0defe Track buttons: each circuit's outline before its name (#820)
- 5ec5ad7 Hitch line: say what the screen runs at, and count pictures shown a refresh late on a fast screen (#819)
- 9ba0da9 Hitch account: a frame rate that hops all the time is an uneven frame rate, not thousands of hitches (#818)
- ad22d41 Majoraadi finish flames start on screen out of the last corner (#816)
- 7db5215 Races: a racer standing still for a minute is out, so the race ends when the rest are through (#815)
- dbea606 Majoraadi: the race button's letters at full size on a stage run (#814)
- 2153ab2 Majoraadi flames sit lower and keep their shape (#813)
- 6902967 Lap replays: a slider to any moment of the lap, a still frame while it is held (#812)
- 0dfcca4 Racers' places over their cars for everyone, not only for those in the race (#811)
- 10c296c Enyaq and bZ4X: the fifth fades out from 20 to 70 km/h (was 50 to 120) (#810)
- 41431d5 Side views: 4 m out, in toward the car for a house or tall wall, then up; low things pass (#809)
- 5c71f44 Race results: a thumbs up right after each driver's name (#808)
- 4236ba2 Handbrake on every 4WD car works like a WRC car's: rears lock, the fronts stay driven (#807)
- badedcf Majoraadi: black flame gantries at the start and finish, fireball flames (#806)
- 8fa774d Bus shelter glass bursts when a car lands on the roof, at any speed; the frame stays as it was (#805)
- 95416c2 Lap times: each car's five best drivers, of all time and of today, and your place after your best (#804)
- 104641c Enyaq and bZ4X: a second whine a fifth over the plain one, fading out from 50 to 120 km/h (#803)
- 78a7243 Land on vehicles and bus shelters: the bus roof, parked and other players' cars, shelter roofs (#802)
- c72859c Enyaq and bZ4X: back to the original whine alone (#801)
- 3e55ed4 Raadi skid marks: none on the grass, and gone within 3 m of the gravel starting (#800)
- da3b841 Idle: 20 minutes standing on the map, then 20 more in the garage before going offline (#799)
- a525d22 Enyaq and bZ4X: the two motors tuned to the plain whine, one chord at every speed (#798)
- 4a1975d Options panel: a small gap between options in the same section (#797)
- 8250aef Raadi skid marks: a quicker fade on the first corner's gravel (#796)
- e286400 Raadi skid marks: on the start stretch's gravel too, and on into the first corner (#795)
- 7f99981 Enyaq and bZ4X: the plain whine is back, and the two motors go with it at 0.7 of its loudness (#794)
- 355b475 Options panel in the order Sound, Graphics, Controls (#793)
- 6db6d8f Take the sharpness trim and the "picture held back" count out again (#792)
- c3f9850 Thumbs up: one player to the same player at most 3 a day, judged by the server (#791)
- b3406b3 No "km/h" under the speed on any electric car's tach; the kW stands in its place (#790)
- 37e8764 Idle with room: still a 20 minute limit, and a page with nobody there for 20 minutes goes offline (#789)
- 5d2651b Roofs a car can land on and drive over, treetops to fly through, R back onto the roof (#788)
- 8840099 Raadi finish arch a touch lower, its opening filled with the finish glow (#787)
- c546485 Raadi before launch: the garage ends a run, gravel judged as gravel, the stage for spectators, top ten checked (#786)
- 830a777 Side views: 2 m out from the car with a wide lens, rising only where a house is nearer (#785)
- 8b4cd48 Raadi: the start column bluish cyan and kept faintly through a run, arches over the start and the finish (#784)
- dcf9326 Raadi and the race side by side: four small conflicts closed (#783)
- 5148786 The Raadi stage is called Majoraadi wherever the player reads its name (#782)
- 45d6259 Side views of the car on keys 5 and 6 (#781)
- 89d168b Raadi line, second pass: skid marks on the tarmac start, the finish road as gravel, six apexes rounded (#780)
- 2b17d80 Rocket: the server judges its BOOST and tank, refuses a kickflip in a lap, and its stage start holds (#779)
- e1c9279 A slow car tips over an edge nose first; bridge railings hold a car nosed against them (#778)
- a2d1c37 Wall crash: back on its wheels 70 times in 100, a side to balance on, the roof put back after 1 s, and 5 s on a timed lap (#777)
- 6aeb428 Rocket: a kickflip ends at the wheels' first touch, and the car answers from there (#776)
- deafd9b A record's drive is held against where the server saw the car during the lap; the lap clock's short side back to 1.5 s (#775)
- 9f9d661 Rocket: no races, 2100 kg, 389 km/h and 405 with the fans off, no glow round the tach's two buttons (#774)
- bafb80f Idle cars may stand while the server has room: the timeout only over 90 % full, a bus always (#773)
- 5ffa1db Rocket: the hunt for level swings in round U's, the gauges run down as gas goes out, the tach's buttons a touch higher (#772)
- 860e852 Enyaq and bZ4X: two motors heard, one whine for each axle, rising together (#771)
- 19d4840 Board audit: a slow page's 2 s on the lap clock is by design, the note watches the rest of the leeway (#770)
- 6f4c17d Leeway in the server's checks: wider where it costs an honest lap, and a reading of how much of each is used (#769)
- cfeb865 Raadi line log: a run of 60 m is kept (a launch and the first corner, then H) (#768)
- 4e0b9cf A wall is no brake: over 140 km/h and straight at it, the car ends on its roof (#767)
- f33d532 Rocket's desktop tach: BOOST and FLIP just above the fan, gear and tyre row, the speed raised (#766)
- 096da4b The car check in the race, Raadi runs judged again on the server, a nightly look at the boards (#765)
- 0f5f82b Rocket: the motors sound like straight-cut race gears, and their note all but stops rising over 200 km/h (#764)
- 75a3a85 Raadi: the stage's wheel tracks are a worn line made from real runs (first iteration, 7 runs) (#763)
- c91b045 DRIVE: shaders not all waited for inside the click (#762)
- 8d7d24d AUTO graphics keep the pictures even: sharpness is trimmed while pictures keep finishing a screen refresh late (#756)
- 6cdbc90 Rocket: no more 12 s flights over falling ground, a later catch, round buttons in the desktop tach, the weight counts (#761)
- e92e996 Perf check: race of 30 reruns when over, the lower run counts (#760)
- 388331f Races and records by the server's own eyes: it follows each racer round the lap, times record laps, checks positions (#759)
- a42ba3f Raadi: R in a timed run costs 5 s, and the run goes on from the spot the car is put back on (#758)
- a81811d Rocket: the way down ends in one big burn of all four jets; the fans are quieter (#757)
- 182f2d4 Raadi: timed runs write down where the wheels went, for a painted line made from real driving (#755)
- 1404f32 Raadi start: Narva mnt beside the stage gets its street lights, signs, islands, lines and path (#754)
- 2ce9bd8 Raadi bales: a hit presses a hollow into the bale and straw flies out (#747)
- dc75aee Refused replays: the open list no longer says which limit a tuned drive broke (#753)
- 3b4e22a Lap records: a record's drive is held against the car (two tuned Audi 200 records) (#752)
- 0c5458c Rocket jets: soft columns of vapour with wisps and sway, not hard cones (#751)
- 3d6ec3d Garage: the name is picked on the first open only, L and G work in the garage (#750)
- 39348ae Rocket: BOOST and FLIP as glass discs with a ring gauge, FLIP shows x2 or x1, the tank fills in a minute (#749)
- 96620cc Stats: top 10 driver names by time driven online (#748)
- aa79f25 Rocket kickflip, third pass: jets arc with the roll, softer lift-off, slow last metres (#746)
- aac01d5 Raadi bales: heavier (square on 680 to 950 kg, the edges 260 to 340) (#745)
- bed24dd Rocket on phones: FLIP moves right and down, onto BOOST's line (#744)
- 2ba6698 Rocket: the tank fills by itself whenever it is not full (#743)

