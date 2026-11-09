"""Adds stories to the top of the News tab (window.NEWS in data.js).

    python3 tools/add_news.py stories.json

stories.json is a list of {"tag", "date", "title", "dek", "url"} (newest first). Each story gets an id from its
title; a story whose id is already in data.js is skipped, so re-running is safe.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def main():
    path = os.path.join(ROOT, 'data.js')
    text = open(path, encoding='utf-8').read()
    head, news_json = text.split('window.NEWS = ', 1)
    news = json.loads(news_json.rstrip().rstrip(';'))
    have = {n['id'] for n in news}
    added = []
    for s in json.load(open(sys.argv[1], encoding='utf-8')):
        sid = re.sub(r'[^a-z0-9]+', '-', s['title'].lower()).strip('-')[:48]
        if sid in have:
            continue
        added.append({'id': sid, 'tag': s['tag'], 'date': s['date'], 'title': s['title'], 'dek': s['dek'], 'body': s.get('body', []), 'url': s['url']})
        have.add(sid)
    news = added + news
    news.sort(key=lambda n: n['date'], reverse=True)  # newest first; stable for same-day stories
    with open(path, 'w', encoding='utf-8') as f:
        f.write(head + 'window.NEWS = ' + json.dumps(news, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'added {len(added)} stories, {len(news)} in the feed')

if __name__ == '__main__':
    main()
