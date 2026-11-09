import sys, numpy as np, json
W,H=270,480; n=W*H; buf=sys.stdin.buffer
prev=None; t=0; ev=[]; ca=[]
while True:
    b=buf.read(n)
    if len(b)<n: break
    f=np.frombuffer(b,np.uint8).reshape(H,W).astype(np.int16)
    if prev is not None:
        d=np.abs(f-prev)>25
        ev.append(d[222:330].mean()); ca.append(d[330:400].mean())
    prev=f; t+=1
ts=np.arange(1,len(ev)+1)/30
cuts=[7.83,47.83,87.83,127.83,167.83]
def onsets(x, thr, quiet=0.5):
    x=np.array(x); out=[]; last=-9
    for i,v in enumerate(x):
        if v>thr:
            if ts[i]-last>quiet and not any(abs(ts[i]-c)<0.5 for c in cuts): out.append(round(float(ts[i]),2))
            last=ts[i]
    return out
E=onsets(ev,0.004); C=onsets(ca,0.004)
print('list/rows', len(E), E); print('cards', len(C), C)
json.dump({'rows':E,'cards':C,'cuts':cuts},open(sys.argv[1]+'/events.json','w'))
