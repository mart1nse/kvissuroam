# LINNARING: rules for every change

## Performance comes first (Martin, 20 Nov 2026)
Every new addition (a street, a house, props, a car, an effect) must be light. Phones are the limit:
an iPhone 13 reloads the page when it runs out of memory, and one morning of new painted streets was
enough to make that happen at DRIVE.

- Before merging anything that adds pictures, models or many objects, run `node tools/perf-budget.cjs`
  and keep it inside `tools/perf-budget.json`. Say the before/after figures in the PR. Raise a budget
  figure only with a reason in the commit.
- Painted canvases (house fronts, signs, walls, adverts): size them with `paintScale()` from
  `src/world/paintscale.js` (0.6 on phones and weak desktops), and share atlases instead of one canvas
  per wall. A 2048x2048 canvas is 16 MB in the browser and again on the graphics card.
- Build far-away hand-made areas only when the car comes near, not at start (look at how
  `vanemuise.js` and the other `build()` functions wait to be needed).
- Reuse geometry and materials (instancing, merged meshes); dispose what is removed from the scene.
- New shader variants: warm them (`renderer.compileAsync`) rather than compiling on the first frame.
- Graphics quality follows the frame rate (`src/quality.js`); new effects should follow the level
  (see `applyFx` in `src/main.js`).

The check also runs at night when main changed in the last 24 h; results go to the `perf-reports` branch.
