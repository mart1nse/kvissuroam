// For tools/freeze-profile.cjs and tools/gpu-burst.cjs. Runs in the page: __fly(points, step) moves the car along
// a line of [x, z] map points, `step` metres a frame, with no physics. __flyStat says how far it has got.
module.exports = () => {
  window.__fly = (pts, step = 0.8) => {
    const g = __game; let seg = 0, d = 0;
    window.__flyStat = { dist: 0, done: false, x: 0, z: 0 };
    function tick() {
      if (__flyStat.done) return;
      requestAnimationFrame(tick);
      if (g.mode !== 'drive') return;
      let left = step;
      while (left > 0 && seg < pts.length - 1) {
        const a = pts[seg], b = pts[seg + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (d + left < len) { d += left; left = 0; } else { left -= len - d; seg++; d = 0; }
      }
      if (seg >= pts.length - 1) { __flyStat.done = true; return; }
      const a = pts[seg], b = pts[seg + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
      const x = a[0] + ux * d, z = a[1] + uz * d;
      __flyStat.dist += step; __flyStat.x = x; __flyStat.z = z;
      g.place({ x, z, yaw: Math.atan2(ux, -uz) });
    }
    tick();
  };
};
