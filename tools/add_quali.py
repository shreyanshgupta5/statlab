"""Adds a round's qualifying and starting grid to data.js before the race has run (so the race preview can show the grid).

    python3 tools/add_quali.py 21

Qualifying times (Q1/Q2/Q3) come from OpenF1 session_result; the grid (after penalties) from OpenF1 starting_grid.
add_round.py later overwrites QUALI_DETAIL for the round with the same data when the race result goes in.
"""
import json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEAM_IDS = {'Mercedes': 'MER', 'Ferrari': 'FER', 'Red Bull Racing': 'RBR', 'McLaren': 'MCL', 'Racing Bulls': 'RB',
            'Alpine': 'ALP', 'Haas F1 Team': 'HAA', 'Audi': 'AUD', 'Williams': 'WIL', 'Aston Martin': 'AMR', 'Cadillac': 'CAD'}

def openf1(path):
    req = urllib.request.Request('https://api.openf1.org/v1/' + path, headers={'User-Agent': 'statlab-data/1.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def main():
    rnd = int(sys.argv[1])
    path = os.path.join(ROOT, 'data.js')
    text = open(path, encoding='utf-8').read()
    head, rest = text.split('window.SEASON = ', 1)
    season_json, news_part = rest.split(';\nwindow.NEWS = ', 1)
    S = json.loads(season_json)
    cal = next(c for c in S['CALENDAR'] if c['round'] == rnd)
    year, race_day = cal['date'][:4], cal['date'][:10]
    sess = [s for s in openf1(f'sessions?year={year}&session_name=Qualifying') if s['date_start'][:10] <= race_day]
    q = max(sess, key=lambda s: s['date_start'])
    key = q['session_key']
    acr = {d['driver_number']: d for d in openf1(f'drivers?session_key={key}')}
    rows = sorted(openf1(f'session_result?session_key={key}'), key=lambda r: r.get('position') or 99)
    detail = []
    for n, r in enumerate(rows):
        d = acr[r['driver_number']]
        t = (r.get('duration') or []) + [None, None, None]
        times = [x for x in t[:3] if x is not None]
        detail.append({'id': d['name_acronym'], 'team': TEAM_IDS.get(d['team_name'], d['team_name']), 'pos': r.get('position') or n + 1,
                       'q1': t[0], 'q2': t[1], 'q3': t[2], 'best': min(times) if times else None})
    grid = [acr[g['driver_number']]['name_acronym'] for g in sorted(openf1(f'starting_grid?session_key={key}'), key=lambda g: g['position'] or 99)]
    S['QUALI_DETAIL'][str(rnd)] = detail
    S.setdefault('GRID', {})[str(rnd)] = grid
    with open(path, 'w', encoding='utf-8') as f:
        f.write(head + 'window.SEASON = ' + json.dumps(S, ensure_ascii=False, separators=(',', ':')) + ';\nwindow.NEWS = ' + news_part)
    print(f"round {rnd} ({q['location']}): fastest {detail[0]['id']}, grid P1 {grid[0] if grid else '-'}, {len(grid)} on the grid")

if __name__ == '__main__':
    main()
