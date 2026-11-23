"""Collect more public Flipkart product reviews for large appliances, split by subtype.
Public review pages only, low request rate, last six months. Run as: python appliance_flipkart_more.py <group>"""
import csv
import datetime as dt
import json
import pathlib
import re
import sys
import time

import requests

GROUP = sys.argv[1] if len(sys.argv) > 1 else "a"
START = time.time()
BUDGET = 46 * 60
OUT = pathlib.Path("out")
OUT.mkdir(exist_ok=True)
SINCE = dt.datetime.now() - dt.timedelta(days=185)
HEADERS = {"User-Agent": ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
                          "Chrome/126.0 Safari/537.36"), "Accept-Language": "en-IN,en;q=0.9"}
# (category, subtype, search query)
QUERIES = {
    "a": [("ac", "split_1.5t", "1.5 ton inverter split ac"), ("ac", "split_1t", "1 ton split ac"),
          ("ac", "split_2t", "2 ton split ac"), ("ac", "window", "window ac"),
          ("refrigerator", "single_door", "single door refrigerator"),
          ("refrigerator", "double_door", "double door frost free refrigerator"),
          ("refrigerator", "side_by_side", "side by side refrigerator"),
          ("dishwasher", "dishwasher", "dishwasher 12 place settings"),
          ("dishwasher", "dishwasher_compact", "dishwasher 8 place settings")],
    "b": [("washing_machine", "front_load", "front load washing machine"),
          ("washing_machine", "top_load", "top load fully automatic washing machine"),
          ("washing_machine", "semi_auto", "semi automatic washing machine"),
          ("tv", "32in", "32 inch smart tv"), ("tv", "43in", "43 inch smart tv"),
          ("tv", "55in", "55 inch 4k smart tv"), ("tv", "65in", "65 inch 4k tv"),
          ("air_cooler", "desert", "desert air cooler"), ("air_cooler", "personal_tower", "personal tower air cooler")],
}[GROUP]
N_PRODUCTS, MAX_PAGES = 10, 8
MONTHS = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}
s = requests.Session()
s.headers.update(HEADERS)
log = {"group": GROUP, "queries": {}}


def left():
    return BUDGET - (time.time() - START)


def get(url):
    for _ in range(2):
        try:
            r = s.get(url, timeout=30)
            if r.status_code == 200:
                return r.text
            print("  status", r.status_code, url[:90], flush=True)
        except Exception as e:  # noqa: BLE001
            print("  error", type(e).__name__, url[:90], flush=True)
        time.sleep(8)
    return ""


def state(html):
    i = html.find("window.__INITIAL_STATE__")
    if i < 0:
        return {}
    try:
        return json.JSONDecoder().raw_decode(html[html.find("{", i):])[0]
    except Exception:  # noqa: BLE001
        return {}


def find_reviews(o, acc):
    if isinstance(o, dict):
        if {"rating", "text", "created"} <= set(o):
            acc.append(o)
        for v in o.values():
            find_reviews(v, acc)
    elif isinstance(o, list):
        for v in o:
            find_reviews(v, acc)


def in_window(created):
    c = (created or "").strip()
    m = re.match(r"(\d+)\s+months?\s+ago", c)
    if m:
        return int(m.group(1)) <= 6
    if "ago" in c or "oday" in c:
        return True
    m = re.match(r"([A-Z][a-z]{2}),\s*(\d{4})", c)
    if m and m.group(1) in MONTHS:
        return dt.datetime(int(m.group(2)), MONTHS[m.group(1)], 28) >= SINCE
    return False


f = open(OUT / f"flipkart_more_{GROUP}.csv", "w", newline="", encoding="utf-8")
w = csv.writer(f)
w.writerow(["category", "subtype", "product", "item_id", "stars", "created", "title", "text",
            "city", "state", "helpful", "certified_buyer"])
fails = 0
for cat, sub, query in QUERIES:
    if left() < 120 or fails >= 6:
        break
    html = get("https://www.flipkart.com/search?q=" + query.replace(" ", "+"))
    seen, products = set(), []
    for link, item in re.findall(r'href="(/[^"]+/p/(itm[0-9a-z]+)\?[^"]*)"', html):
        pid = re.search(r"pid=([A-Z0-9]+)", link)
        if item in seen or not pid:
            continue
        seen.add(item)
        products.append((link.split("/p/")[0].strip("/"), item, pid.group(1)))
    products = products[:N_PRODUCTS]
    q = log["queries"][f"{cat}/{sub}"] = {"products": len(products), "pages": 0, "reviews": 0}
    for slug, item, pid in products:
        for page in range(1, MAX_PAGES + 1):
            if left() < 60 or fails >= 6:
                break
            acc = []
            find_reviews(state(get(f"https://www.flipkart.com/{slug}/product-reviews/{item}"
                                   f"?pid={pid}&sortOrder=MOST_RECENT&page={page}")), acc)
            q["pages"] += 1
            time.sleep(1.5)
            if not acc:
                fails += 1 if page == 1 else 0
                break
            fails = 0
            fresh = [r for r in acc if in_window(r.get("created"))]
            for r in fresh:
                loc = r.get("location") or {}
                w.writerow([cat, sub, slug[:90], item, r.get("rating"), r.get("created"), r.get("title"),
                            (r.get("text") or "").replace("\n", " ").strip(), loc.get("city"),
                            loc.get("state"), r.get("helpfulCount"), r.get("certifiedBuyer")])
            q["reviews"] += len(fresh)
            if len(fresh) < len(acc):
                break
        f.flush()
    print(cat, sub, q, flush=True)
f.close()
log["consecutive_failures_at_end"] = fails
log["minutes"] = round((time.time() - START) / 60, 1)
(OUT / f"run_log_{GROUP}.json").write_text(json.dumps(log, indent=1))
print(json.dumps(log, indent=1))
