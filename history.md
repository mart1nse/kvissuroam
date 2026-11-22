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
