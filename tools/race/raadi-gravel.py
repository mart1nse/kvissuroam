"""Where the gravel of Raadi manor park is wider than the drawn paths (junction corners, the outside of bends,
the park road), for the `aprons` list of src/world/raadipaths.json.

  python3 tools/race/raadi-gravel.py photo.png      (the photo as for raadi-park.py)

The photo's pale gravel, less the paths as the game draws them (the map's roads at their widths, the stage at
its own), within 14 m of the stage: pieces of 2.5 m2 and more that touch a path, smoothed, each an outline
[x, z, x, z ...] reaching 0.5 m under the path beside it. Writes aprons.json.
"""
from shapely.geometry import box
from shapely.ops import unary_union
import json, math, os, sys, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
Image.MAX_IMAGE_PIXELS=None
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'../../')
R=json.load(open(ROOT+'src/race/raadi.json')); P=R['pts']; HW=R['hw']
V=json.load(open(ROOT+'public/data/vectors.json')); PA=json.load(open(ROOT+'src/world/raadipaths.json'))
img=Image.open(sys.argv[1]).convert('RGB'); im=np.asarray(img).astype(np.int16); H,W=im.shape[:2]
px=lambda x,z:((x+657800-660130)*10,(6476860-(6477150-z))*10)
mx=im.max(-1); mn=im.min(-1)
grav=(im[...,2]>165)&((mx-mn)<75)
# game's gravel: roads in the box at their widths, the stage at its own
game=Image.new('L',(W,H),0); d=ImageDraw.Draw(game)
def band(pts,w):
    q=[px(*p[:2]) for p in pts]
    d.line(q,fill=255,width=max(1,int(round(w*10))),joint='curve')
    for a in q: r=w*5; d.ellipse([a[0]-r,a[1]-r,a[0]+r,a[1]+r],fill=255)
n=0
for r in V['roads']+PA['add']:
    xs=[p[0] for p in r['pts']]; zs=[p[1] for p in r['pts']]
    if max(xs)<2330 or min(xs)>2950 or max(zs)<290 or min(zs)>740: continue
    band(r['pts'],r.get('w',4)); n+=1
for g in PA['gravel']: band(g['line'],g['w'])
for i in range(len(P)-1): band([P[i],P[i+1]],2*HW[i])
game=np.asarray(game)>0
# stage distance field (px)
st=Image.new('L',(W,H),0); ImageDraw.Draw(st).line([px(*p) for p in P[R['start']:R['finish']+1]],fill=255,width=3)
dist=ndi.distance_transform_edt(~(np.asarray(st)>0))/10
g=ndi.binary_opening(grav,iterations=2)
g=ndi.binary_closing(g,iterations=3)
extra=g&~ndi.binary_dilation(game,iterations=3)&(dist<14)
extra=ndi.binary_opening(extra,structure=np.ones((7,7)))
lab,k=ndi.label(extra); keep=np.zeros_like(extra)
near=ndi.binary_dilation(game,iterations=8)
out=[]
for j,s in enumerate(ndi.find_objects(lab)):
    m=lab[s]==j+1; a=m.sum()/100
    if a<2.5: continue
    if not (near[s]&m).any(): continue
    keep[s]|=m; cy,cx=ndi.center_of_mass(m); out.append((round(a,1),int(cx+s[1].start),int(cy+s[0].start)))
keep[:, :1000]=False                                   # Narva mnt's paving and its shadows
m=ndi.binary_dilation(keep,iterations=5)&(keep|game)   # 0.5 m under the path beside it
lab,n=ndi.label(m); polys=[]
for j,s in enumerate(ndi.find_objects(lab)):
    mm=lab[s]==j+1; ys,xs=np.nonzero(mm[::2,::2]|mm[1::2,::2][:mm[::2,::2].shape[0]] if False else mm[::2,::2])
    cells=[box((s[1].start+2*x)/10,(s[0].start+2*y)/10,(s[1].start+2*x+2)/10,(s[0].start+2*y+2)/10) for y,x in zip(ys,xs)]
    if not cells: continue
    g=unary_union(cells).buffer(0.35).buffer(-0.35).buffer(-0.2).buffer(0.2).simplify(0.18)
    for p in (g.geoms if g.geom_type=='MultiPolygon' else [g]):
        if p.area<2.5: continue
        polys.append(p)
out=[[c for x,y in list(p.exterior.coords)[:-1] for c in (round(2330+x,1),round(290+y,1))] for p in polys]
print(len(out),'aprons',round(sum(p.area for p in polys)),'m2')
json.dump(out,open('aprons.json','w'),separators=(',',':'))
