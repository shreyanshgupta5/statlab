"""Adds one finished Grand Prix to data.js without the full site rebuild.

Race classification comes from a curated CSV (the same format as content/data/*_race_results.csv:
pos,driver,name,team,qualified,grid,...,points,...), because stewards' decisions can change the order after
the timing feed. Qualifying times (Q1/Q2/Q3) come from OpenF1.

    python3 tools/add_round.py 20 path/to/race_results.csv --short BRA --location "São Paulo" [--sprint-csv sprint.csv]

Championship totals (OFFICIAL_POINTS, TEAM_POINTS) get the round's Grand Prix points (and sprint points, if a
sprint CSV with driver,points columns is given). Re-running for a round already in data.js does nothing.
"""
import argparse, csv, json, os, urllib.request
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEAM_IDS = {'Mercedes': 'MER', 'Ferrari': 'FER', 'Red Bull Racing': 'RBR', 'McLaren': 'MCL', 'Racing Bulls': 'RB',
            'Alpine': 'ALP', 'Haas F1 Team': 'HAA', 'Audi': 'AUD', 'Williams': 'WIL', 'Aston Martin': 'AMR', 'Cadillac': 'CAD'}

def openf1(path):
    with urllib.request.urlopen('https://api.openf1.org/v1/' + path, timeout=30) as r:
        return json.load(r)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('round', type=int)
    ap.add_argument('race_csv')
    ap.add_argument('--short', required=True)
    ap.add_argument('--location', required=True)
    ap.add_argument('--sprint-csv')
    a = ap.parse_args()

    path = os.path.join(ROOT, 'data.js')
    text = open(path, encoding='utf-8').read()
    head, rest = text.split('window.SEASON = ', 1)
    season_json, news_part = rest.split(';\nwindow.NEWS = ', 1)
    S = json.loads(season_json)
    if any(r['round'] == a.round for r in S['RESULTS']):
        print(f'Round {a.round} is already in data.js'); return
    cal = next(c for c in S['CALENDAR'] if c['round'] == a.round)
    known = {d['id'] for d in S['DRIVERS']}

    # qualifying from OpenF1
    year = cal['date'][:4]
    sess = [s for s in openf1(f'sessions?year={year}&session_name=Qualifying') if s['date_start'][:10] <= cal['date']]
    q_sess = max(sess, key=lambda s: s['date_start'])
    acr = {d['driver_number']: d for d in openf1(f"drivers?session_key={q_sess['session_key']}")}
    qrows = sorted(openf1(f"session_result?session_key={q_sess['session_key']}"), key=lambda r: r.get('position') or 99)
    detail, quali = [], []
    for r in qrows:
        d = acr[r['driver_number']]
        q = (r.get('duration') or []) + [None, None, None]
        times = [t for t in q[:3] if t is not None]
        best = min(times) if times else None
        detail.append({'id': d['name_acronym'], 'team': TEAM_IDS.get(d['team_name'], d['team_name']), 'pos': r['position'],
                       'q1': q[0], 'q2': q[1], 'q3': q[2], 'best': best})
        if best is not None:
            quali.append({'id': d['name_acronym'], 'time': best})
        if d['name_acronym'] not in known:  # stand-in driver: add after the regular line-ups
            S['DRIVERS'].append({'id': d['name_acronym'], 'first': d['first_name'], 'last': d['last_name'],
                                 'num': d['driver_number'], 'team': TEAM_IDS.get(d['team_name'], d['team_name'])})
            known.add(d['name_acronym'])
            print('added stand-in', d['name_acronym'], d['full_name'])

    # race from the curated CSV
    race, team_pts = [], {}
    for row in csv.DictReader(open(a.race_csv, encoding='utf-8')):
        finished = row['pos'].isdigit()
        pts = int(float(row['points'] or 0))
        race.append({'id': row['driver'], 'pos': int(row['pos']) if finished else None, 'points': pts,
                     'grid': int(row['grid'] or 0), 'dnf': not finished})
        tid = TEAM_IDS[row['team']]
        team_pts[tid] = team_pts.get(tid, 0) + pts
        S['OFFICIAL_POINTS'][row['driver']] = S['OFFICIAL_POINTS'].get(row['driver'], 0) + pts
    if a.sprint_csv:
        for row in csv.DictReader(open(a.sprint_csv, encoding='utf-8')):
            pts = int(float(row['points'] or 0))
            S['OFFICIAL_POINTS'][row['driver']] = S['OFFICIAL_POINTS'].get(row['driver'], 0) + pts
            tid = next(d['team'] for d in S['DRIVERS'] if d['id'] == row['driver'])
            team_pts[tid] = team_pts.get(tid, 0) + pts
    for tid, p in team_pts.items():
        S['TEAM_POINTS'][tid] = S['TEAM_POINTS'].get(tid, 0) + p

    S['RESULTS'].append({'round': a.round, 'quali': quali, 'race': race})
    S['RESULTS'].sort(key=lambda r: r['round'])
    S['QUALI_DETAIL'][str(a.round)] = detail
    S['RACE_INFO'][str(a.round)] = {'short': a.short, 'location': a.location}
    cal['laps'] = max(int(r['laps']) for r in csv.DictReader(open(a.race_csv, encoding='utf-8')) if r['laps'])

    S['DATA_UPDATED_AT'] = datetime.now(timezone.utc).isoformat(timespec='seconds')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(head + 'window.SEASON = ' + json.dumps(S, ensure_ascii=False, separators=(',', ':')) + ';\nwindow.NEWS = ' + news_part)
    print(f"round {a.round}: {len(race)} classified, pole {quali[0]['id']}, winner {race[0]['id']}")

if __name__ == '__main__':
    main()
