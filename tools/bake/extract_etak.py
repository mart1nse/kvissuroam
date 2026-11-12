import fiona, json, sys, zipfile, collections
BB=(656200,6475550,659400,6478750)
out={}
import glob
for z in ['x']:
    for n in sorted(glob.glob('etak/**/*.shp',recursive=True)):
        key=n.split('/')[-1][:-4]
        feats=[]
        with fiona.open(n) as src:
            for f in src.filter(bbox=BB):
                feats.append({'p':dict(f['properties']),'g':f['geometry'].__geo_interface__ if hasattr(f['geometry'],'__geo_interface__') else dict(f['geometry'])})
        out[key]=feats
        c=collections.Counter()
        for f in feats:
            c[str(f['p'].get('tyyp_t') or f['p'].get('tyyp'))]+=1
        print(key,len(feats),dict(c.most_common(8)))
        if feats: print('   props',{k:v for k,v in feats[0]['p'].items()})
json.dump(out,open('etak_bbox.json','w'),default=str)
