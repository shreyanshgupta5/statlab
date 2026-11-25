"""Fetch Wikimedia/Flickr images found via Openverse into cand/<id>.jpg at a standard thumbnail width, politely.
    python3 fetch.py search/<file>.json id1 id2 ...  [--w 500]"""
import json, glob, os, re, subprocess, sys, time
args = sys.argv[1:]; w = '500'
if '--w' in args: w = args[args.index('--w') + 1]; args = [a for a in args if a not in ('--w', w)]
idx = {}
for f in glob.glob('search/*.json'):
    try:
        for x in json.load(open(f)).get('results', []): idx.setdefault(x['id'][:8], x)
    except Exception: pass
meta = json.load(open('meta.json')) if os.path.exists('meta.json') else {}
ok = lambda p: os.path.exists(p) and open(p, 'rb').read(2) == b'\xff\xd8'
todo = [a for a in args if not ok(f'cand/{a}.jpg')]
for attempt in range(8):
    left = []
    for i in todo:
        x = idx[i]; meta[i] = {k: x.get(k) for k in ('id', 'title', 'creator', 'license', 'license_version', 'foreign_landing_url', 'url', 'width', 'height', 'source')}
        if x['source'] == 'wikimedia':
            m = re.match(r'https://upload.wikimedia.org/wikipedia/commons/(\w)/(\w\w)/(.+)$', x['url'])
            u = f"https://upload.wikimedia.org/wikipedia/commons/thumb/{m.group(1)}/{m.group(2)}/{m.group(3)}/{w}px-{m.group(3)}" if (x['width'] or 0) > int(w) else x['url']
        else:
            u = f"https://api.openverse.org/v1/images/{x['id']}/thumb/"
        r = subprocess.run(['curl', '-s', '-L', '-A', 'StatLabFanApp/1.0 (educational fan project)', '-w', '%{http_code}', '-o', f'cand/{i}.jpg', u], capture_output=True, text=True)
        print(attempt, i, r.stdout, flush=True)
        if not ok(f'cand/{i}.jpg'): left.append(i)
        time.sleep(8 if x['source'] == 'wikimedia' else 1)
    json.dump(meta, open('meta.json', 'w'), indent=1)
    todo = left
    if not todo: break
    time.sleep(45)
print('missing', todo)
