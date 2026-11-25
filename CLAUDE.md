# LINNARING: rules for every change

## Performance comes first (Martin, 20 Nov 2026)
Every new addition (a street, a house, props, a car, an effect) must be light. Phones are the limit:
an iPhone 13 reloads the page when it runs out of memory, and one morning of new painted streets was
enough to make that happen at DRIVE.

- Before merging anything that adds pictures, models or many objects, or that is built while the car
  is moving, run `node tools/perf-budget.cjs` and keep it inside `tools/perf-budget.json`. Raise a
  budget figure only with a reason in the commit. It measures a phone's memory (the iPhone 13 crashes)
  and drives 4.5 km through the centre counting how often and how long the game stands still (the
  freeze frames), and counts what the lowest graphics level draws at the Riia and Turu junction (old
  laptops at 10 to 18 FPS, 21 Nov), and along the Raadi stage at the lowest and the top level (24 Nov). It also drives a lap of the race track and counts the short hitches
  (the page busy for over 25 ms, frames over 33 ms) and the pictures sent to the graphics card (the slight
  microfreezes on a MacBook Pro M3 after a night of new house fronts along the track, 22 Nov), and a full run
  of the Raadi rally stage (`?raadi=1`: in as the stage builds itself, the start clock, the stage to past the
  finish) with the lap's budgets for short hitches, and a phone's memory along that stage, and what a frame sends to
  the graphics card as new kinds of car arrive in a crowd of 60 (stutters with 85 to 95 online, 25 Nov); that run fails if the stage cancels it, so a new stage rule
  that the straight drive along the stage's line breaks needs `route=stage` in `tools/freeze-profile.cjs` updated.
  It takes about 11 minutes, so it is not run after every merge: if any thread ran it in the last 2 hours
  it only prints that result (the last run is noted in the project's shared folder). Use `--force` when
  Martin asks, or when the change is likely to weigh a lot (a new painted street, a car model, hundreds
  of objects, a new place that builds itself on approach). Put the figures in the PR when you ran it.
  When a player meets a new kind of slowness, add a part to the check that would have caught it.
- Short hitches count too (22 Nov: a fast computer notices a step of 15 ms). In a queued job, `yield 'frame'`
  before a step that is long by its nature (a big wall to paint) gives it a frame of its own, and a step
  that sends a picture with `jobs.upload` is that frame's last. House fronts along the track are painted at
  18 pixels a metre, not the default 26 (`ppm` in the `skinHouses` options), and get a `label` there so the
  test drive can say which place painted how much.
- Painted canvases (house fronts, signs, walls, adverts): size them with `paintScale()` from
  `src/world/paintscale.js` (0.6 on phones and weak desktops), and share atlases instead of one canvas
  per wall. A 2048x2048 canvas is 16 MB in the browser and again on the graphics card.
- On phones the painted pictures of places the car has left behind rest (`src/world/phonetex.js`, 21 Nov:
  a phone held 553 MB at DRIVE and over 1000 MB after 2 km through the centre). Over 650 m away the
  card keeps only a small stand-in, and the full picture comes back from a packed copy within 420 m.
  Nothing to do for it in new code, but do not repaint a canvas after it has been shown, and mark a
  texture `userData.keepImage` only when its own code frees and sends it again. After the car is put
  somewhere (`place` in main.js) GETTING READY shows while that spot's pictures and map come back.
- Build far-away hand-made areas only when the car comes near, not at start (look at how
  `vanemuise.js` and the other `build()` functions wait to be needed).
- Nothing heavy in one frame while somebody is driving (the freeze frames of 20 Nov: smooth, then
  standing still for 0.1 to 1 s as a place built itself). A `build()` that takes more than a few
  milliseconds goes through the work queue as a generator, `jobs.add(function* () { ...; yield; ... },
  'name')` from `src/jobs.js`, with a `yield` between its parts and the `built` flag set before the
  call (see `baeristreet.js`, `kaluri.js`). Set the flag before `jobs.add` in every case: a place that
  sets it inside its build is queued again each frame until the job starts and then builds itself
  several times over (the test drives count this as "building work queued twice", limit 0). In a long
  loop, `if (jobs.late()) yield;` stops only when the step has taken its 5 ms, so a fast device does
  not wait a frame for nothing. Whole car models are built in the car worker
  (`buildCarInWorker`, `buildParkedInWorker`), not on the page.
- Less work before a frame is drawn (`src/still.js`, 21 Nov: on an old laptop the page's own part of
  drawing was 15 to 27 ms a frame). A group whose things never move is made with
  `still(new THREE.Group())`, so their places are worked out once; to move one later set its position
  and call `stir(it)`. See-through surfaces that show both sides are drawn in one go (flat sheets look
  the same): a closed see-through shape that needs its far side first gets
  `material.userData.twoPass = true`.
- New things are let into the picture gradually by `src/warm.js` (shaders compiled and pictures sent
  ahead, unseen) when they are added inside a place's `update`, the work queue or `warm.scope(...)`.
  What must show at once (smoke, broken glass) is added outside those. Do not add big things to the
  scene from a timer or a promise without `warm.scope`.
- Many small rectangles on a canvas (bricks, grains, pebbles): `pixelSheet` / `paintBricks` in
  `src/world/houseskin.js`, not thousands of `fillRect`. Boxes into a `Parts`: `p.box(w, h, d, hex, x,
  y, z, yaw)`. Ground textures: `groundTextures()` in `arhitekti.js`, shared by all places.
- `node tools/freeze-profile.cjs route=centre` (dev server on 5198) shows where a drive stands still
  and what ran there; add a route to `tools/freeze-routes.cjs` for a new part of the map.
- Old computers (two processor cores, Intel graphics) get the extra low setup (`xlow` in `src/main.js`:
  the phone's ground, no edge smoothing, the bottom rung of `LADDER` in `src/quality.js` with a 1.5 km
  view). Something new that is seen from far away needs a simple far form or a distance limit that
  follows the level, or the lowest level grows heavier again. `node tools/freeze-profile.cjs
  route=centre slow=5` drives as such a computer (processor 5 times slower, 15 frames a second) and
  also shows how long built things waited to get into the picture.
- Other players' cars (25 Nov: stutters with 85 to 95 online that the frame times did not show): a kind of car is
  made ready once, with its scanned body on, and goes to the graphics card ahead of its first drawing, a picture or
  about 2 MB of buffers a frame (`toCard` in `src/main.js`); until then such a car is its far stand-in. Whatever a
  car model gains (a part, a picture, work done on the page when its scan arrives) must go the same way: steps in
  the work queue (`useGlbBody` runs `onLoad` as a generator), nothing in one piece when the car is first seen.
- The game keeps its own account of short hitches while driving and what each was (`src/hitches.js`: the options
  window's last five minutes, `__game.hitches`, and the "Short hitches while driving" card on /stats, per 10
  minutes alone and in a crowd). When a player reports stutter, read that card before guessing. Work done on the
  page outside the frame (a message handler, a worker's answer) is timed with `outside.note(what, t0)`.
- Reuse geometry and materials (instancing, merged meshes); dispose what is removed from the scene.
- New shader variants: warm them (`renderer.compileAsync`) rather than compiling on the first frame.
- Graphics quality follows the frame rate (`src/quality.js`); new effects should follow the level
  (see `applyFx` in `src/main.js`).

The check also runs at night when main changed in the last 24 h; results go to the `perf-reports` branch.

For the nightly run (and anyone reading its result):
- The JSON's `checks` list has every figure with its budget, in order: the history table is that list.
  Worth a line in the summary: the phone total at DRIVE and at the Raadi stage, and for both drives the times the game was busy
  for over 0.1 s and the longest such stretch, for the lap and the Raadi stage the times over 25 ms and the
  longest, and for the lap the megapixels sent to the graphics card. A figure with no budget ("not judged") is only shown.
- A memory figure over: the script lists the biggest canvas makers. A drive figure over: it lists what
  the page was busy with in those stretches, with file and function names (`node tools/freeze-profile.cjs
  route=centre` on a dev server gives the whole list). The drive figures vary from run to run (the
  longest stretch by 20 or 30 ms): when one is over by a little, run the check once more with `--force`
  before blaming a commit, and say so if the second run is inside.
- Do not change `tools/perf-budget.cjs` or `tools/perf-budget.json` to make a figure pass. If the check
  itself seems to measure wrongly, say so and leave the decision to Martin.
