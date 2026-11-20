// How finely the hand-painted pictures (house fronts, shop signs, walls) are drawn: 1 = full, less on
// phones and weak computers (main.js sets it before anything is built). Each picture is painted in metres,
// so a smaller scale only means fewer pixels per metre: the same picture, softer, in a quarter or a third
// of the memory. On an iPhone 13 the painted fronts had grown to hundreds of MB of canvases at the start.
let k = 1;
export const paintScale = () => k;
export function setPaintScale(v) { k = Math.max(0.25, Math.min(1, v)); }
