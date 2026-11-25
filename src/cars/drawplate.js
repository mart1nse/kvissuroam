// The car models' number plate picture (kit.js) and a player's own plate (plate.js).
// An Estonian plate: white, black border, blue EU strip with "EST". Draws into rect (x,y,w,h).
export function drawPlate(g, x, y, w, h, text) {
  g.save(); g.translate(x, y);
  const r = h * 0.1;
  g.fillStyle = '#111'; g.beginPath(); g.roundRect(0, 0, w, h, r); g.fill();
  const b = h * 0.035;
  g.fillStyle = '#f4f4f1'; g.beginPath(); g.roundRect(b, b, w - 2 * b, h - 2 * b, r * 0.7); g.fill();
  const sw = w * 0.085;
  g.save(); g.beginPath(); g.roundRect(b, b, w - 2 * b, h - 2 * b, r * 0.7); g.clip();
  g.fillStyle = '#12399c'; g.fillRect(0, 0, sw + b, h);
  g.restore();
  g.fillStyle = '#f5c400';
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.arc(b + sw / 2 + Math.cos(a) * sw * 0.27, h * 0.33 + Math.sin(a) * sw * 0.27, sw * 0.045, 0, 7); g.fill(); }
  g.fillStyle = '#fff'; g.font = `bold ${h * 0.2}px Arial, Helvetica, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('EST', b + sw / 2, h * 0.76);
  g.fillStyle = '#0c0c0c'; g.font = `bold ${h * 0.74}px "DIN Alternate", "Arial Narrow", Arial, Helvetica, sans-serif`;
  const tx = sw + b + (w - sw - 2 * b) / 2;
  g.save(); g.translate(tx, h * 0.54); g.scale(0.86, 1); g.fillText(text, 0, 0); g.restore();
  g.restore();
}
