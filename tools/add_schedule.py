"""Adds each round's full weekend schedule (practice, sprint, qualifying, race) to the calendar in data.js, from OpenF1.

    python3 tools/add_schedule.py      # run after tools/build_data.py

Each CALENDAR entry gets sessions: [{"name": "Practice 1", "start": ISO UTC, "end": ISO UTC}, ...], matched to the round
by the race date.
"""
import json, os, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, 'data.js')
src = open(PATH, encoding='utf-8').read()
head, rest = src.split('window.SEASON = ', 1)
body, tail = rest.split(';\nwindow.NEWS = ', 1)
S = json.loads(body)
year = S['CALENDAR'][0]['date'][:4]
req = urllib.request.Request(f'https://api.openf1.org/v1/sessions?year={year}', headers={'User-Agent': 'onef1-app'})
sessions = json.load(urllib.request.urlopen(req, timeout=30))
utc = lambda s: s.replace('+00:00', 'Z')
by_meeting = {}
for s in sessions:
    by_meeting.setdefault(s['meeting_key'], []).append(s)
race_day = {next(x for x in ss if x['session_name'] == 'Race')['date_start'][:10]: ss
            for ss in by_meeting.values() if any(x['session_name'] == 'Race' for x in ss)}
n = 0
for c in S['CALENDAR']:
    ss = race_day.get(c['date'])
    if not ss:
        continue
    c['sessions'] = [{'name': x['session_name'], 'start': utc(x['date_start']), 'end': utc(x['date_end'])}
                     for x in sorted(ss, key=lambda x: x['date_start'])]
    n += 1
open(PATH, 'w', encoding='utf-8').write(head + 'window.SEASON = ' + json.dumps(S, ensure_ascii=False, separators=(',', ':')) + ';\nwindow.NEWS = ' + tail)
print(f'schedules added to {n} of {len(S["CALENDAR"])} rounds')
