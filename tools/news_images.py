"""Finds each news story's social preview image (og:image / twitter:image) and stores its URL on the story in data.js.

    python3 tools/news_images.py          # only stories without an image yet
    python3 tools/news_images.py --all    # re-check every story

The image is not copied into the app: the News tab loads it from the publisher's site, like a link-preview card,
credited to the source (story.tag). Needs network access to the publishers' sites.
"""
import html, json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = 'Mozilla/5.0 (compatible; ONE-F1-link-preview/1.0)'
PAT = [r'<meta[^>]+property=["\']og:image(?::secure_url)?["\'][^>]+content=["\']([^"\']+)',
       r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image',
       r'<meta[^>]+name=["\']twitter:image(?::src)?["\'][^>]+content=["\']([^"\']+)',
       r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']twitter:image']


def preview(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html'})
    page = urllib.request.urlopen(req, timeout=30).read(600_000).decode('utf-8', 'ignore')
    for p in PAT:
        m = re.search(p, page, re.I)
        if m:
            img = html.unescape(m.group(1)).strip()
            if img.startswith('//'):
                img = 'https:' + img
            if img.startswith('http'):
                return img
    return None


def main():
    path = os.path.join(ROOT, 'data.js')
    text = open(path, encoding='utf-8').read()
    head, news_json = text.split('window.NEWS = ', 1)
    news = json.loads(news_json.rstrip().rstrip(';'))
    found = 0
    for s in news:
        if s.get('image') and '--all' not in sys.argv:
            continue
        try:
            img = preview(s['url'])
        except Exception as e:  # keep going; a later run can retry
            print('fail', s['id'], e)
            continue
        print('ok  ' if img else 'none', s['id'], img or '')
        if img:
            s['image'] = img
            found += 1
    with open(path, 'w', encoding='utf-8') as f:
        f.write(head + 'window.NEWS = ' + json.dumps(news, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'{found} images found; {sum(1 for s in news if s.get("image"))} of {len(news)} stories have one')


if __name__ == '__main__':
    main()
