"""Contact sheet to check the sampled colours by eye: python3 tools/realism/sheet.py IMAGES.jsonl WORKDIR OUT.jpg"""
import os, pickle, sys, random
import numpy as np
from PIL import Image, ImageDraw
import colours as C

images, work, outp = sys.argv[1:4]
B, heights = pickle.load(open(os.path.join(work, 'buildings.pkl'), 'rb'))
im = C.load_images(images)
picks = pickle.load(open(os.path.join(work, 'picks.pkl'), 'rb'))
est = pickle.load(open(os.path.join(work, 'est.pkl'), 'rb'))
ground = C.Ground(heights)
random.seed(int(sys.argv[4]) if len(sys.argv) > 4 else 1)
ids = random.sample(sorted(est), 40)
sheet = Image.new('RGB', (8 * 300, 5 * 200), 'black')
for n, bi in enumerate(ids):
    i, wi, score = picks[bi][0]
    img = np.asarray(Image.open(os.path.join(work, 'thumbs', im['id'][i] + '.jpg')).convert('RGB'))
    _, (u, v) = C.wall_pixels(B[bi], wi, i, im, ground, img)
    t = Image.fromarray(img).resize((256, 192)); d = ImageDraw.Draw(t)
    for a, b in zip(u[::3], v[::3]): d.point((a * 256, b * 192), fill=(255, 0, 255))
    cell = Image.new('RGB', (300, 200), tuple(int(x) for x in C.to_rgb(np.array([est[bi][0]]))[0]))
    cell.paste(t, (0, 0))
    sheet.paste(cell, ((n % 8) * 300, (n // 8) * 200))
sheet.save(outp, quality=85)
