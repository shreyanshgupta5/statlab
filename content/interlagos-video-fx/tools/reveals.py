import sys, numpy as np, json
W,H=270,480; n=W*H; buf=sys.stdin.buffer
prev=None; t=0; rows=[]
R={'chart':(130,215),'events':(222,300),'cards':(300,385)}
while True:
    b=buf.read(n)
    if len(b)<n: break
    f=np.frombuffer(b,np.uint8).reshape(H,W).astype(np.int16)
    if prev is not None:
        rows.append([t/30]+[float(np.mean(np.abs(f[a:z]-prev[a:z])>40)) for a,z in R.values()])
    prev=f; t+=1
a=np.array(rows)
np.save(sys.argv[1]+'/diffs.npy', a)
def peaks(col, thr, gap=0.5):
    out=[]
    for i in range(1,len(a)-1):
        if a[i,col]>thr and a[i,col]>=a[i-1,col] and a[i,col]>=a[i+1,col]:
            ts=a[i,0]
            if not out or ts-out[-1]>gap: out.append(round(ts,2))
    return out
cuts=[7.83,47.83,87.83,127.83,167.83]
near=lambda ts: any(abs(ts-c)<0.6 for c in cuts)
for name,col,thr in [('events',2,0.02),('cards',3,0.05)]:
    p=[x for x in peaks(col,thr) if not near(x)]
    print(name, len(p), p)
