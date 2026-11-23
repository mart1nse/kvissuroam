"""Trees and stones of Raadi manor park from the Land Board's air photo, for src/world/raadipark.json.

  python3 tools/race/raadi-park.py photo.png trees.json

photo.png: the orthophoto at 10 cm a pixel, its top left corner at E 660130, N 6476860 (L-EST), fetched in
  pieces from https://kaart.maaamet.ee/wms/fotokaart (layer EESTIFOTO, EPSG:3301) and stitched.
trees.json: the game's own trees round the park, [x, z, y, height, crown, kind] each, dumped from the running
  game with world.treesNear (the photo's trees that the map already has are left out).
Writes found.json ({ stones: [x, z, r, metres from the stage's edge], trees: [x, z, height, crown, same] })
and pictures f*.jpg of what it found, to look through before anything goes into the game. The limits in
allowed() keep it to the park north of the wood; the south loop was picked by hand from a second run.
"""
import numpy as np, json, math, os, sys
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
Image.MAX_IMAGE_PIXELS=None
PHOTO,TREES=sys.argv[1],sys.argv[2]
im=np.asarray(Image.open(PHOTO).convert('RGB')).astype(np.int16)
H,W=im.shape[:2]
mx=im.max(-1); mn=im.min(-1); lum=im.sum(-1)//3
d=json.load(open(os.path.join(os.path.dirname(__file__),'../../src/race/raadi.json')));P=np.array(d['pts']);HW=np.array(d['hw'])
T=json.load(open(TREES))
wx=lambda px:660130+px/10-657800
wz=lambda py:6477150-(6476860-py/10)
def stage_d(x,z):
    dd=np.hypot(P[:,0]-x,P[:,1]-z)-HW; return float(dd.min())
def allowed(x,z):
    if stage_d(x,z)>70: return False
    if x<2640 and z<300: return False
    if 2640<=x<=2815 and z<308+(x-2657)*0.19-2: return False
    if x<2440: return False
    if x<2500 and z<440: return False
    if x<2575 and z>455: return False
    if 2798<x<2838 and 333<z<368: return False
    if x>2860 and z<345: return False
    return True
# ---- stones
bright=(mx>178)&((mx-mn)<50)
lab,n=ndi.label(bright); sl=ndi.find_objects(lab)
stones=[]
for k in range(n):
    s=sl[k]; h=s[0].stop-s[0].start; w=s[1].stop-s[1].start
    if max(h,w)>34 or min(h,w)<3: continue
    m=(lab[s]==k+1); a=int(m.sum())
    if a<9 or a/(h*w)<0.42: continue
    y0,y1,x0,x1=max(0,s[0].start-8),min(H,s[0].stop+8),max(0,s[1].start-8),min(W,s[1].stop+8)
    box=mx[y0:y1,x0:x1]; bm=np.zeros(box.shape,bool); bm[s[0].start-y0:s[0].stop-y0,s[1].start-x0:s[1].stop-x0]=m
    ring=box[~bm]; inner=box[bm]
    if ring.mean()>168 or inner.mean()-ring.mean()<32: continue
    if (ring>185).mean()>0.2: continue
    cy,cx=ndi.center_of_mass(m); cy+=s[0].start; cx+=s[1].start
    x,z=wx(cx),wz(cy)
    if not allowed(x,z): continue
    r=math.sqrt(a/math.pi)/10
    stones.append([round(x,2),round(z,2),round(max(0.22,min(1.3,r*1.15)),2),round(stage_d(x,z),1)])
print('stones',len(stones),'near edge <2.5 m:',sum(1 for s in stones if s[3]<2.5),'on path',sum(1 for s in stones if s[3]<0))
# ---- trees the map lacks: a shadow wedge on the grass, the tree at its east-south-east end
from scipy.ndimage import uniform_filter
loc=uniform_filter(lum.astype(np.float32),size=81)
dark=(lum<loc-24)&(lum<118)&(im[...,1]>=im[...,2]-4)
dark=ndi.binary_opening(dark,iterations=1)
dark=ndi.binary_closing(dark,iterations=1)
lab,n=ndi.label(dark); sl=ndi.find_objects(lab)
U=(0.964,0.265)
sap=[]
for k in range(n):
    s=sl[k]; h=s[0].stop-s[0].start; w=s[1].stop-s[1].start
    m=(lab[s]==k+1); a=int(m.sum())
    if a<45 or a>9000: continue
    ys,xs=np.nonzero(m); pr=xs*U[0]+ys*U[1]
    if (loc[s][m]-lum[s][m]).mean()<34: continue
    L=(pr.max()-pr.min())/10
    if L<2.0 or L>34: continue
    hgt=max(2.2,min(16,L*0.5)); crown=max(1.1,min(7,hgt*0.45))
    sel=pr>=pr.max()-3
    cx=xs[sel].mean()+s[1].start-U[0]*crown*4; cy=ys[sel].mean()+s[0].start-U[1]*crown*4
    x,z=wx(cx),wz(cy)
    if not allowed(x,z): continue
    # fairly compact across the shadow's direction
    pq=-xs*U[1]+ys*U[0]; Wd=(pq.max()-pq.min())/10
    if Wd>L*1.3+1.5 or a/(L*10*max(Wd*10,1))<0.25: continue
    if any(math.hypot(x-t[0],z-t[1])<max(5,t[4]*0.6+2.5) for t in T): continue
    if any(-3<(t[0]-x)<t[3]*2.1+2 and abs((t[1]-z)-(t[0]-x)*0.27)<t[4]*0.7+2 for t in T): continue   # inside a map tree's shadow
    dd=stage_d(x,z)
    if dd<2.5: continue
    if any(math.hypot(x-q[0],z-q[1])<2.5 for q in stones): continue
    sap.append([round(x,2),round(z,2),round(hgt,1),round(crown,1),round(dd,1)])
# merge near duplicates
out=[]
for t in sorted(sap,key=lambda t:-t[2]):
    if all(math.hypot(t[0]-o[0],t[1]-o[1])>2.5 for o in out): out.append(t)
sap=out
print('young trees',len(sap))
json.dump({'stones':stones,'trees':sap},open('found.json','w'))
o=Image.open(PHOTO).convert('RGB'); dr=ImageDraw.Draw(o)
px=lambda x,z:((x+657800-660130)*10,(6476860-(6477150-z))*10)
for x,z,r,dd in stones:
    X,Y=px(x,z); R=r*10+3; dr.ellipse((X-R,Y-R,X+R,Y+R),outline=(255,0,0) if dd>2.5 else (255,0,255),width=2)
for x,z,hh,c,dd in sap:
    X,Y=px(x,z); R=c*5; dr.ellipse((X-R,Y-R,X+R,Y+R),outline=(0,255,255),width=2)
for t in T:
    X,Y=px(t[0],t[1]); R=t[4]*5; dr.ellipse((X-R,Y-R,X+R,Y+R),outline=(255,255,0),width=1)
k=0
for y0 in (0,1300):
    for x0 in (700,2150,3600,4300):
        o.crop((x0,y0,x0+1500,y0+1300)).resize((1150,997)).save(f'f{k}.jpg',quality=80);k+=1
o.resize((1933,867)).save('f_over.jpg',quality=85)
