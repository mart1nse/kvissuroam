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

